/**
 * RTFTP Studio - Client Workstation & LAN Station Manager
 * Manages client booths, touchscreen stations, live WebSocket connectivity, remote control,
 * and independent photoshoot session directory mapping per client PC.
 */

const fs = require('fs');
const path = require('path');
const { saveConfig } = require('./config');
const { isImageFile } = require('./thumbnail');

// In-memory runtime tracking of connected sockets per station
const activeConnections = new Map(); // stationId -> Set of ws clients

const DEFAULT_STATIONS = [
  {
    id: 'station-1',
    name: 'PC Klien 1 (Kabel LAN Booth A)',
    type: 'lan',
    note: 'Layar Sentuh Booth Utama',
    assignedSessionPath: null,
    assignedSessionName: null,
    createdAt: Date.now()
  },
  {
    id: 'station-2',
    name: 'PC Klien 2 (Kabel LAN Booth B)',
    type: 'lan',
    note: 'Layar Sentuh Booth 2',
    assignedSessionPath: null,
    assignedSessionName: null,
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

function cleanIp(rawIp) {
  if (!rawIp) return '';
  if (rawIp.startsWith('::ffff:')) return rawIp.substring(7);
  if (rawIp === '::1') return '127.0.0.1 (Lokal)';
  return rawIp;
}

/**
 * Get single station by ID
 */
function getStationById(config, stationId) {
  if (!stationId) return null;
  const stations = getStations(config);
  return stations.find(s => s.id === stationId) || null;
}

/**
 * Get all stations enriched with real-time connection status and session mapping
 */
function getStations(config) {
  const stations = ensureStations(config);
  const globalActivePath = config.activeSessionPath ? path.resolve(config.activeSessionPath) : '';

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

    // Determine effective session path for this station
    let effectiveSessionPath = globalActivePath;
    let isUsingGlobalSession = true;
    let assignedSessionPath = null;
    let assignedSessionName = null;

    if (s.assignedSessionPath) {
      const resolved = path.resolve(s.assignedSessionPath);
      if (fs.existsSync(resolved)) {
        assignedSessionPath = resolved;
        assignedSessionName = s.assignedSessionName || path.basename(resolved);
        effectiveSessionPath = resolved;
        isUsingGlobalSession = false;
      } else {
        // Fallback to global active session if assigned folder no longer exists
        console.warn(`[Station] Folder sesi ${s.assignedSessionPath} tidak ditemukan untuk ${s.id}, fallback ke sesi global.`);
      }
    }

    const effectiveSessionName = isUsingGlobalSession
      ? (globalActivePath ? path.basename(globalActivePath) : 'Sesi Global Default')
      : assignedSessionName;

    // Shallow photo count calculation for this station's session
    let photoCount = 0;
    try {
      if (effectiveSessionPath && fs.existsSync(effectiveSessionPath)) {
        const files = fs.readdirSync(effectiveSessionPath);
        photoCount = files.filter(f => isImageFile(f) && !f.startsWith('.')).length;
      }
    } catch (e) {}

    return {
      ...s,
      isOnline,
      activeClientsCount: clients.size,
      remoteIp: remoteIp ? cleanIp(remoteIp) : null,
      connectedAt,
      assignedSessionPath,
      assignedSessionName,
      effectiveSessionPath,
      effectiveSessionName,
      isUsingGlobalSession,
      photoCount
    };
  });
}

/**
 * Add a new client station (Operator clicks `+`)
 */
function addStation(config, payloadOrName, maybeType = 'lan', maybeNote = '') {
  let name, type, note;
  if (typeof payloadOrName === 'object' && payloadOrName !== null) {
    name = payloadOrName.name;
    type = payloadOrName.type || 'lan';
    note = payloadOrName.note || '';
  } else {
    name = payloadOrName;
    type = maybeType || 'lan';
    note = maybeNote || '';
  }
  const stations = ensureStations(config);
  const nextNum = stations.length + 1;
  const stationId = `station-${Date.now()}`;
  const stationName = (name && name.trim()) ? name.trim() : `PC Klien ${nextNum} (${type === 'lan' ? 'Kabel LAN' : 'Wi-Fi'})`;

  const newStation = {
    id: stationId,
    name: stationName,
    type: type || 'lan',
    note: note || '',
    assignedSessionPath: null,
    assignedSessionName: null,
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
      remoteIp: null,
      isUsingGlobalSession: true,
      effectiveSessionPath: config.activeSessionPath,
      effectiveSessionName: path.basename(config.activeSessionPath || ''),
      photoCount: 0
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
 * Assign a photoshoot session folder to a specific client station
 * If sessionPath is null or empty, resets the station to follow the global active session.
 */
function assignSessionToStation(config, stationId, sessionPath, broadcastFn, onSessionAssignedCallback) {
  const stations = ensureStations(config);
  const station = stations.find(s => s.id === stationId);
  if (!station) {
    throw new Error('Stasiun klien tidak ditemukan');
  }

  if (!sessionPath || String(sessionPath).trim() === '') {
    station.assignedSessionPath = null;
    station.assignedSessionName = null;
  } else {
    const resolved = path.resolve(String(sessionPath).trim());
    if (!fs.existsSync(resolved)) {
      throw new Error(`Folder sesi tidak ditemukan di disk: ${sessionPath}`);
    }
    station.assignedSessionPath = resolved;
    station.assignedSessionName = path.basename(resolved);
  }

  saveConfig({ clientStations: stations });

  const effectivePath = station.assignedSessionPath || config.activeSessionPath;
  const effectiveName = station.assignedSessionName || path.basename(config.activeSessionPath || '');

  // Notify any active WebSocket clients connected on this station
  const clients = activeConnections.get(stationId);
  if (clients) {
    clients.forEach(ws => {
      ws.assignedSessionPath = effectivePath;
      try {
        ws.send(JSON.stringify({
          type: 'SESSION_ASSIGNED',
          stationId,
          sessionPath: effectivePath,
          sessionName: effectiveName
        }));
      } catch (e) {}
    });
  }

  // Trigger watcher sync callback
  if (typeof onSessionAssignedCallback === 'function') {
    onSessionAssignedCallback(effectivePath);
  }

  // Broadcast updated stations list to operator dashboard
  if (typeof broadcastFn === 'function') {
    broadcastFn({
      type: 'STATIONS_UPDATED',
      stations: getStations(config)
    });
  }

  const enriched = getStations(config).find(s => s.id === stationId);
  return {
    success: true,
    station: enriched,
    assignedSessionPath: station.assignedSessionPath,
    assignedSessionName: station.assignedSessionName
  };
}

/**
 * Register a WebSocket connection to a station
 */
function registerStationClient(stationId, ws, req, broadcast, config) {
  if (!stationId) return;

  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  ws.stationId = stationId;
  ws.remoteIp = rawIp;
  ws.connectedAt = Date.now();

  // Attach station's assigned session path if config provided
  if (config) {
    const stations = ensureStations(config);
    const st = stations.find(s => s.id === stationId);
    if (st && st.assignedSessionPath && fs.existsSync(st.assignedSessionPath)) {
      ws.assignedSessionPath = path.resolve(st.assignedSessionPath);
    } else {
      ws.assignedSessionPath = config.activeSessionPath ? path.resolve(config.activeSessionPath) : null;
    }
  }

  if (!activeConnections.has(stationId)) {
    activeConnections.set(stationId, new Set());
  }
  activeConnections.get(stationId).add(ws);

  console.log(`[Station] Klien terhubung ke ${stationId} dari IP: ${cleanIp(rawIp)} (Sesi: ${ws.assignedSessionPath ? path.basename(ws.assignedSessionPath) : 'Global'})`);

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
  getStationById,
  addStation,
  removeStation,
  updateStation,
  assignSessionToStation,
  registerStationClient,
  unregisterStationClient,
  reloadStation,
  activeConnections
};
