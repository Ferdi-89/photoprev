/**
 * RTFTP Studio - Client Workstation & LAN Station Manager
 * Manages client booths, touchscreen stations, live WebSocket connectivity, and remote control.
 */

const { saveConfig } = require('./config');

// In-memory runtime tracking of connected sockets per station
const activeConnections = new Map(); // stationId -> Set of ws clients

const DEFAULT_STATIONS = [
  {
    id: 'station-1',
    name: 'PC Klien 1 (Kabel LAN Booth A)',
    type: 'lan',
    note: 'Layar Sentuh Booth Utama',
    createdAt: Date.now()
  },
  {
    id: 'station-2',
    name: 'PC Klien 2 (Kabel LAN Booth B)',
    type: 'lan',
    note: 'Layar Sentuh Booth 2',
    createdAt: Date.now()
  }
];

function ensureStations(config) {
  if (!Array.isArray(config.clientStations) || config.clientStations.length === 0) {
    config.clientStations = [...DEFAULT_STATIONS];
    saveConfig({ clientStations: config.clientStations });
  }
  return config.clientStations;
}

/**
 * Get all stations enriched with real-time connection status
 */
function getStations(config) {
  const stations = ensureStations(config);
  return stations.map(s => {
    const clients = activeConnections.get(s.id) || new Set();
    const isOnline = clients.size > 0;

    let remoteIp = null;
    let connectedAt = null;

    if (isOnline) {
      for (const client of clients) {
        if (client.remoteIp) remoteIp = client.remoteIp;
        if (client.connectedAt) connectedAt = client.connectedAt;
        break;
      }
    }

    return {
      ...s,
      isOnline,
      activeClientsCount: clients.size,
      remoteIp: remoteIp ? cleanIp(remoteIp) : null,
      connectedAt
    };
  });
}

function cleanIp(rawIp) {
  if (!rawIp) return '';
  if (rawIp.startsWith('::ffff:')) return rawIp.substring(7);
  if (rawIp === '::1') return '127.0.0.1 (Lokal)';
  return rawIp;
}

/**
 * Add a new client station (Operator clicks `+`)
 */
function addStation(config, { name, type = 'lan', note = '' }) {
  const stations = ensureStations(config);
  const nextNum = stations.length + 1;
  const stationId = `station-${Date.now()}`;
  const stationName = (name && name.trim()) ? name.trim() : `PC Klien ${nextNum} (${type === 'lan' ? 'Kabel LAN' : 'Wi-Fi'})`;

  const newStation = {
    id: stationId,
    name: stationName,
    type: type || 'lan',
    note: note || '',
    createdAt: Date.now()
  };

  stations.push(newStation);
  config.clientStations = stations;
  saveConfig({ clientStations: stations });

  return {
    success: true,
    station: {
      ...newStation,
      isOnline: false,
      activeClientsCount: 0,
      remoteIp: null
    }
  };
}

/**
 * Remove a client station (Operator clicks `-`)
 */
function removeStation(config, stationId) {
  const stations = ensureStations(config);
  const index = stations.findIndex(s => s.id === stationId);
  if (index === -1) {
    throw new Error('Stasiun klien tidak ditemukan');
  }

  const removed = stations.splice(index, 1)[0];
  config.clientStations = stations;
  saveConfig({ clientStations: stations });

  // Disconnect active WS clients attached to this removed station
  const clients = activeConnections.get(stationId);
  if (clients) {
    clients.forEach(ws => {
      try {
        ws.send(JSON.stringify({
          type: 'STATION_DEACTIVATED',
          message: 'Stasiun klien ini telah dinonaktifkan oleh operator studio.'
        }));
      } catch (e) {}
    });
    activeConnections.delete(stationId);
  }

  return {
    success: true,
    removedStation: removed
  };
}

/**
 * Update station properties (name, note, type)
 */
function updateStation(config, stationId, updates) {
  const stations = ensureStations(config);
  const station = stations.find(s => s.id === stationId);
  if (!station) {
    throw new Error('Stasiun klien tidak ditemukan');
  }

  if (updates.name && updates.name.trim()) station.name = updates.name.trim();
  if (updates.type) station.type = updates.type;
  if (updates.note !== undefined) station.note = updates.note;

  saveConfig({ clientStations: stations });
  return { success: true, station };
}

/**
 * Register a WebSocket connection to a station
 */
function registerStationClient(stationId, ws, req, broadcast) {
  if (!stationId) return;

  // Extract remote IP
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  ws.stationId = stationId;
  ws.remoteIp = rawIp;
  ws.connectedAt = Date.now();

  if (!activeConnections.has(stationId)) {
    activeConnections.set(stationId, new Set());
  }
  activeConnections.get(stationId).add(ws);

  console.log(`[Station] Klien terhubung ke ${stationId} dari IP: ${cleanIp(rawIp)}`);

  if (typeof broadcast === 'function') {
    broadcast({
      type: 'STATION_STATUS_CHANGED',
      stationId,
      isOnline: true,
      remoteIp: cleanIp(rawIp),
      activeClientsCount: activeConnections.get(stationId).size
    });
  }
}

/**
 * Unregister a WebSocket on disconnection
 */
function unregisterStationClient(ws, broadcast) {
  if (!ws.stationId) return;
  const stationId = ws.stationId;
  const clients = activeConnections.get(stationId);

  if (clients) {
    clients.delete(ws);
    const count = clients.size;
    if (count === 0) {
      activeConnections.delete(stationId);
    }

    console.log(`[Station] Klien terputus dari ${stationId}. Sisa koneksi: ${count}`);

    if (typeof broadcast === 'function') {
      broadcast({
        type: 'STATION_STATUS_CHANGED',
        stationId,
        isOnline: count > 0,
        activeClientsCount: count
      });
    }
  }
}

/**
 * Reload a specific client station remotely
 */
function reloadStation(stationId, wss) {
  let count = 0;
  wss.clients.forEach(client => {
    if (client.stationId === stationId) {
      try {
        client.send(JSON.stringify({ type: 'RELOAD_CLIENT' }));
        count++;
      } catch (e) {}
    }
  });
  return { success: true, reloadedClientsCount: count };
}

module.exports = {
  getStations,
  addStation,
  removeStation,
  updateStation,
  registerStationClient,
  unregisterStationClient,
  reloadStation
};
