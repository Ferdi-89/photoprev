const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');

const { loadConfig, saveConfig, getConfig } = require('./lib/config');
const { isImageFile, getImageMetadata, getOrGenerateImage } = require('./lib/thumbnail');
const { initWatcher, startWatcher, addWatchFolder, unwatchFolder, syncWatchedFolders, getWatchedFolders } = require('./lib/watcher');
const printManager = require('./lib/printManager');
const { generateSamplePhotos } = require('./lib/demoData');
const { getLanInterfaces, printNetworkBanner } = require('./lib/network');
const {
  getSystemDrives,
  getSystemShortcuts,
  browseDirectory,
  createFolder,
  openNativePicker
} = require('./lib/folderBrowser');
const {
  getStations,
  getStationById,
  addStation,
  removeStation,
  updateStation,
  assignSessionToStation,
  registerStationClient,
  unregisterStationClient,
  reloadStation
} = require('./lib/stationManager');
const {
  getRootDirectory,
  getDriveStorageInfo,
  listSessions,
  createSession,
  openInWindowsExplorer,
  setRootDirectory
} = require('./lib/sessionDirectoryManager');
const sessionTimerManager = require('./lib/sessionTimerManager');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize configuration
const config = loadConfig();
printManager.setSessionDir(config.activeSessionPath);

// WebSocket Broadcast Helper (supports optional targetSessionPath scoping)
function broadcast(data, targetSessionPath = null) {
  const message = JSON.stringify(data);
  const resolvedTarget = targetSessionPath ? path.resolve(targetSessionPath).toLowerCase() : null;

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      if (resolvedTarget) {
        // Scoped broadcast: send if client is operator dashboard (no stationId) OR assigned to target session
        if (!client.stationId) {
          client.send(message);
        } else {
          const clientSession = client.assignedSessionPath ? path.resolve(client.assignedSessionPath).toLowerCase() : null;
          if (clientSession === resolvedTarget) {
            client.send(message);
          }
        }
      } else {
        // Global broadcast (stations, timer, etc.)
        client.send(message);
      }
    }
  });
}

// Initialize Session Timer Manager
sessionTimerManager.init(config, broadcast);

// In-memory cache for active session photos (instant 0ms response)
let activePhotosCache = null;
let activePhotosPath = '';

async function reloadSessionPhotos(folderPath) {
  const resolved = path.resolve(folderPath);
  if (!fs.existsSync(resolved)) {
    activePhotosCache = [];
    activePhotosPath = resolved;
    return [];
  }
  const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
  const photoFiles = entries
    .filter(e => e.isFile() && isImageFile(e.name) && !e.name.startsWith('.'))
    .map(e => e.name);

  // Read metadata in parallel with in-memory caching
  const photos = await Promise.all(photoFiles.map(async (filename) => {
    const fullPath = path.join(resolved, filename);
    const meta = await getImageMetadata(fullPath);
    return {
      id: filename,
      filename,
      size: meta.size,
      mtime: meta.mtime,
      width: meta.width,
      height: meta.height,
      aspectRatio: meta.aspectRatio
    };
  }));

  // Sort by newest first
  photos.sort((a, b) => b.mtime - a.mtime);
  activePhotosCache = photos;
  activePhotosPath = resolved;
  return photos;
}

// Collect all photoshoot folders that should be actively monitored
function getAllActiveSessionFolders() {
  const folders = new Set();
  if (config.activeSessionPath && fs.existsSync(config.activeSessionPath)) {
    folders.add(path.resolve(config.activeSessionPath));
  }
  if (Array.isArray(config.clientStations)) {
    config.clientStations.forEach(st => {
      if (st.assignedSessionPath && fs.existsSync(st.assignedSessionPath)) {
        folders.add(path.resolve(st.assignedSessionPath));
      }
    });
  }
  return Array.from(folders);
}

// Setup Multi-Session Active Watcher
function setupActiveWatcher() {
  const folders = getAllActiveSessionFolders();
  folders.forEach(f => reloadSessionPhotos(f).catch(() => {}));

  return initWatcher(folders, {
    onPhotoAdded: (photo) => {
      // If photo belongs to the global active session, update in-memory cache
      if (photo.sessionPath && path.resolve(photo.sessionPath) === path.resolve(config.activeSessionPath)) {
        if (activePhotosCache && activePhotosPath === path.resolve(config.activeSessionPath)) {
          const idx = activePhotosCache.findIndex(p => p.filename === photo.filename);
          if (idx >= 0) {
            activePhotosCache[idx] = photo;
          } else {
            activePhotosCache.unshift(photo);
          }
        }
      }
      broadcast({ type: 'PHOTO_ADDED', photo, sessionPath: photo.sessionPath }, photo.sessionPath);
    },
    onPhotoRemoved: ({ filename, sessionPath }) => {
      if (sessionPath && path.resolve(sessionPath) === path.resolve(config.activeSessionPath)) {
        if (activePhotosCache && activePhotosPath === path.resolve(config.activeSessionPath)) {
          activePhotosCache = activePhotosCache.filter(p => p.filename !== filename);
        }
      }
      broadcast({ type: 'PHOTO_REMOVED', filename, sessionPath }, sessionPath);
    }
  });
}

setupActiveWatcher();

// Path sanitization helpers against path traversal & multi-session resolver
function safeFilename(rawFilename) {
  if (!rawFilename) return '';
  return path.basename(String(rawFilename));
}

function resolveSessionForRequest(req) {
  // 1. Explicit session path in query or body
  const explicit = (req.query && req.query.session) || (req.body && req.body.sessionPath);
  if (explicit && String(explicit).trim() !== '') {
    const resolved = path.resolve(String(explicit).trim());
    if (fs.existsSync(resolved)) return resolved;
  }

  // 2. Station ID in query or body (e.g. ?station=station-1)
  const stationId = (req.query && req.query.station) || (req.body && req.body.stationId);
  if (stationId) {
    const st = getStationById(config, String(stationId).trim());
    if (st && st.assignedSessionPath) {
      const resolved = path.resolve(st.assignedSessionPath);
      if (fs.existsSync(resolved)) return resolved;
    }
  }

  // 3. Fallback to global active session
  return config.activeSessionPath ? path.resolve(config.activeSessionPath) : '';
}

function safeSessionDir(reqSession) {
  if (!reqSession) return config.activeSessionPath;
  const resolved = path.resolve(String(reqSession));
  if (!fs.existsSync(resolved)) return config.activeSessionPath;
  return resolved;
}

// Helper: Read all photos in session (instant in-memory if active session, otherwise reads disk)
async function getSessionPhotos(folderPath) {
  const resolved = path.resolve(folderPath);
  if (activePhotosCache && activePhotosPath === resolved) {
    return activePhotosCache;
  }
  return await reloadSessionPhotos(resolved);
}

// ---------------- REST API ROUTES ----------------

// 0. Health Check for Container Probes & Cloud Deployment Monitoring
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 1. Session Information (supports ?station=... or ?session=...)
app.get('/api/session', async (req, res) => {
  try {
    const targetPath = resolveSessionForRequest(req);
    const photos = await getSessionPhotos(targetPath);
    const selections = printManager.getSelections(targetPath);

    res.json({
      success: true,
      activeSessionPath: targetPath,
      sessionName: path.basename(targetPath),
      totalPhotos: photos.length,
      totalSelections: selections.length,
      printSizes: config.printSizes,
      watermark: config.watermark,
      recentFolders: config.recentFolders || []
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Change Active Session Folder
app.post('/api/session', async (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath || !fs.existsSync(folderPath)) {
      return res.status(400).json({ success: false, error: 'Path folder tidak valid atau tidak ditemukan' });
    }

    config.activeSessionPath = path.resolve(folderPath);
    if (!Array.isArray(config.recentFolders)) config.recentFolders = [];
    if (!config.recentFolders.includes(config.activeSessionPath)) {
      config.recentFolders.unshift(config.activeSessionPath);
      config.recentFolders = config.recentFolders.slice(0, 15);
    }
    saveConfig({ activeSessionPath: config.activeSessionPath, recentFolders: config.recentFolders });
    printManager.setSessionDir(config.activeSessionPath);

    addWatchFolder(config.activeSessionPath);

    const photos = await getSessionPhotos(config.activeSessionPath);
    broadcast({
      type: 'SESSION_CHANGED',
      sessionName: path.basename(config.activeSessionPath),
      activeSessionPath: config.activeSessionPath,
      photos
    }, config.activeSessionPath);
    sessionTimerManager.onSessionChanged();

    res.json({
      success: true,
      activeSessionPath: config.activeSessionPath,
      sessionName: path.basename(config.activeSessionPath),
      totalPhotos: photos.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. List Photos (supports ?station=... or ?session=...)
app.get('/api/photos', async (req, res) => {
  try {
    const targetPath = resolveSessionForRequest(req);
    const photos = await getSessionPhotos(targetPath);
    res.json({ success: true, sessionPath: targetPath, photos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3b. Network Discovery for LAN & Wi-Fi Client Tablets
app.get('/api/network', (req, res) => {
  try {
    const PORT = process.env.PORT || config.port || 3000;
    const interfaces = getLanInterfaces(PORT);
    res.json({
      success: true,
      port: PORT,
      interfaces,
      primaryUrl: interfaces[0] ? interfaces[0].url : `http://localhost:${PORT}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Stream Thumbnail (with HTTP 304 Not Modified & ETag caching)
app.get('/api/photo/:filename/thumb', async (req, res) => {
  try {
    const filename = safeFilename(req.params.filename);
    const sessionDir = resolveSessionForRequest(req);
    const fullPath = path.join(sessionDir, filename);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).send('Foto tidak ditemukan');
    }
    const cachedThumb = await getOrGenerateImage(fullPath, 'thumb');
    res.sendFile(cachedThumb, {
      maxAge: '7d',
      lastModified: true,
      immutable: true
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 5. Stream Preview (High-Res WebP with HTTP 304 Not Modified & ETag caching)
app.get('/api/photo/:filename/preview', async (req, res) => {
  try {
    const filename = safeFilename(req.params.filename);
    const sessionDir = resolveSessionForRequest(req);
    const fullPath = path.join(sessionDir, filename);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).send('Foto tidak ditemukan');
    }
    const cachedPreview = await getOrGenerateImage(fullPath, 'preview');
    res.sendFile(cachedPreview, {
      maxAge: '7d',
      lastModified: true,
      immutable: true
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 6. Original Photo Download / Stream
app.get('/api/photo/:filename/original', (req, res) => {
  const filename = safeFilename(req.params.filename);
  const sessionDir = resolveSessionForRequest(req);
  const fullPath = path.join(sessionDir, filename);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).send('Foto tidak ditemukan');
  }
  res.sendFile(fullPath, {
    maxAge: '1d',
    lastModified: true
  });
});

// 7. Get Selections (Grouped by Session + active selections, supports ?station=... or ?session=...)
app.get('/api/selections', (req, res) => {
  const targetPath = resolveSessionForRequest(req);
  const sessions = printManager.getAllSessionQueues(config);
  res.json({
    success: true,
    activeSession: path.basename(targetPath),
    activeSessionPath: targetPath,
    selections: printManager.getSelections(targetPath),
    sessions
  });
});

// 8. Update Selection (Select / Deselect photo with sizes)
app.post('/api/selections', (req, res) => {
  const { filename, selected, sizes, notes } = req.body || {};
  const sessionPath = resolveSessionForRequest(req);
  if (!filename) {
    return res.status(400).json({ success: false, error: 'Filename dibutuhkan' });
  }

  const updatedSelections = printManager.updateSelection(filename, {
    selected: selected !== false,
    sizes,
    notes
  }, sessionPath);

  const allSessions = printManager.getAllSessionQueues(config);

  broadcast({
    type: 'SELECTION_UPDATED',
    filename,
    selected: selected !== false,
    sessionPath,
    selections: updatedSelections,
    sessions: allSessions
  }, sessionPath);

  res.json({
    success: true,
    selections: updatedSelections,
    sessions: allSessions
  });
});

// 9. Clear Selections
app.post('/api/selections/clear', (req, res) => {
  const sessionPath = resolveSessionForRequest(req);
  const updatedSelections = printManager.clearSelections(sessionPath);
  const allSessions = printManager.getAllSessionQueues(config);

  broadcast({
    type: 'SELECTION_CLEARED',
    sessionPath,
    selections: updatedSelections,
    sessions: allSessions
  }, sessionPath);

  res.json({
    success: true,
    selections: updatedSelections,
    sessions: allSessions
  });
});

// 10. Export to Print Folder (_SIAP_CETAK)
app.post('/api/print/export', async (req, res) => {
  try {
    const { sessionPath, exportAll } = req.body || {};

    if (exportAll) {
      const allSessions = printManager.getAllSessionQueues(config);
      const reports = [];
      for (const s of allSessions) {
        if (s.totalItems > 0) {
          const rep = await printManager.exportToPrintFolder(s.sessionPath);
          reports.push(rep);
        }
      }
      broadcast({ type: 'PRINT_EXPORTED', reports });
      return res.json({ success: true, reports });
    }

    const report = await printManager.exportToPrintFolder(sessionPath);
    broadcast({
      type: 'PRINT_EXPORTED',
      report
    });
    res.json({ success: true, report });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 11. Generate Demo Photos
app.post('/api/demo/generate', async (req, res) => {
  try {
    const force = req.body && req.body.force !== undefined ? req.body.force : true;
    await generateSamplePhotos(config.activeSessionPath, force);
    const photos = await reloadSessionPhotos(config.activeSessionPath);
    broadcast({
      type: 'SESSION_CHANGED',
      sessionName: path.basename(config.activeSessionPath),
      photos
    });
    res.json({ success: true, message: 'Foto demo berhasil dibuat!', totalPhotos: photos.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Operator Folder Browser: Get System Drives & Shortcuts
app.get('/api/operator/drives', (req, res) => {
  try {
    const drives = getSystemDrives();
    const shortcuts = getSystemShortcuts(config.activeSessionPath);
    res.json({
      success: true,
      drives,
      shortcuts,
      activeSessionPath: config.activeSessionPath
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 13. Operator Folder Browser: Browse Directory Tree
app.get('/api/operator/browse-dir', (req, res) => {
  try {
    const targetPath = req.query.path || config.activeSessionPath;
    const result = browseDirectory(targetPath, config.activeSessionPath);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Operator Folder Browser: Create New Subfolder
app.post('/api/operator/create-folder', (req, res) => {
  try {
    const { parentPath, folderName } = req.body;
    if (!parentPath || !folderName) {
      return res.status(400).json({ success: false, error: 'Parent path dan nama folder harus diisi' });
    }
    const result = createFolder(parentPath, folderName);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 15. Operator Folder Browser: Launch Native Windows Folder Picker Dialog
app.post('/api/operator/open-native-picker', async (req, res) => {
  try {
    const initialDir = req.body.initialDir || config.activeSessionPath;
    const result = await openNativePicker(initialDir);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 16. Operator Stations: Get All Configured Stations with Live Status
app.get('/api/operator/stations', (req, res) => {
  try {
    const stations = getStations(config);
    res.json({ success: true, stations });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 17. Operator Stations: Add New Workstation / Client Slot (+)
app.post('/api/operator/stations', (req, res) => {
  try {
    const { name, type, note } = req.body;
    const result = addStation(config, { name, type, note });
    broadcast({
      type: 'STATIONS_UPDATED',
      stations: getStations(config)
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 18. Operator Stations: Remove Workstation / Client Slot (-)
app.delete('/api/operator/stations/:id', (req, res) => {
  try {
    const result = removeStation(config, req.params.id);
    broadcast({
      type: 'STATIONS_UPDATED',
      stations: getStations(config)
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 19. Operator Stations: Update Workstation Info
app.put('/api/operator/stations/:id', (req, res) => {
  try {
    const result = updateStation(config, req.params.id, req.body);
    broadcast({
      type: 'STATIONS_UPDATED',
      stations: getStations(config)
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 20. Operator Stations: Remotely Reload Client Workstation Screen
app.post('/api/operator/stations/:id/reload', (req, res) => {
  try {
    const result = reloadStation(req.params.id, wss);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 20b. Operator Stations: Assign Photoshoot Session to Station
app.post(['/api/operator/stations/:id/session', '/api/operator/station/:id/session'], (req, res) => {
  try {
    const { sessionPath } = req.body || {};
    const result = assignSessionToStation(config, req.params.id, sessionPath, broadcast, (effectivePath) => {
      if (effectivePath) addWatchFolder(effectivePath);
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 21. Operator Directory: List All Sessions in Root Directory
app.get('/api/operator/directory/sessions', (req, res) => {
  try {
    const data = listSessions(config);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 22. Operator Directory: Create New Session with Template Preset
app.post('/api/operator/directory/create', async (req, res) => {
  try {
    const { name, rootDir, setAsActive } = req.body;
    const result = createSession(config, { name, rootDir, setAsActive });

    if (result.isActive) {
      printManager.setSessionDir(result.sessionPath);
      setupActiveWatcher(result.sessionPath);
      const photos = await getSessionPhotos(result.sessionPath);
      broadcast({
        type: 'SESSION_CHANGED',
        sessionName: path.basename(result.sessionPath),
        activeSessionPath: result.sessionPath,
        photos
      });
      sessionTimerManager.onSessionChanged();
    }

    broadcast({
      type: 'SESSION_DIRECTORIES_UPDATED',
      ...listSessions(config)
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 23. Operator Directory: Open Folder in Host Windows Explorer
app.post('/api/operator/directory/open-explorer', async (req, res) => {
  try {
    const folderPath = req.body.folderPath || config.activeSessionPath;
    const result = await openInWindowsExplorer(folderPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 24. Operator Directory: Set Working Root Storage Directory
app.post('/api/operator/directory/set-root', (req, res) => {
  try {
    const { rootPath } = req.body;
    const result = setRootDirectory(config, rootPath);
    broadcast({
      type: 'SESSION_DIRECTORIES_UPDATED',
      ...listSessions(config)
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 25. Session Timer: Get Current State & Settings
app.get('/api/timer', (req, res) => {
  const timer = sessionTimerManager.getState();
  res.json({ success: true, timer, data: timer });
});

// 26. Session Timer: Start Countdown
app.post('/api/timer/start', (req, res) => {
  try {
    const { durationMinutes } = req.body || {};
    const timer = sessionTimerManager.start({ durationMinutes });
    res.json({ success: true, timer, data: timer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 27. Session Timer: Pause Countdown
app.post('/api/timer/pause', (req, res) => {
  try {
    const timer = sessionTimerManager.pause();
    res.json({ success: true, timer, data: timer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 28. Session Timer: Resume Countdown
app.post('/api/timer/resume', (req, res) => {
  try {
    const timer = sessionTimerManager.resume();
    res.json({ success: true, timer, data: timer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 29. Session Timer: Add Extra Time (+5 Min, +10 Min)
app.post('/api/timer/add-time', (req, res) => {
  try {
    const minutes = Number(req.body && req.body.minutes) || 5;
    const timer = sessionTimerManager.addTime(minutes);
    res.json({ success: true, timer, data: timer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 30. Session Timer: Reset Timer
app.post('/api/timer/reset', (req, res) => {
  try {
    const timer = sessionTimerManager.reset();
    res.json({ success: true, timer, data: timer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 31. Session Timer: Stop / Deactivate Timer
app.post('/api/timer/stop', (req, res) => {
  try {
    const timer = sessionTimerManager.stop();
    res.json({ success: true, timer, data: timer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 32. Session Timer: Update Settings
app.post('/api/timer/settings', (req, res) => {
  try {
    const timer = sessionTimerManager.updateSettings(req.body || {});
    res.json({ success: true, timer, data: timer });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ---------------- WEBSOCKET HANDLING ----------------
wss.on('connection', async (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  const sendInitToSocket = async (socket) => {
    try {
      const targetPath = socket.assignedSessionPath || config.activeSessionPath;
      const photos = await getSessionPhotos(targetPath);
      const selections = printManager.getSelections(targetPath);
      const sessions = printManager.getAllSessionQueues(config);
      const stations = getStations(config);
      socket.send(JSON.stringify({
        type: 'INIT',
        stationId: socket.stationId || null,
        session: {
          activeSessionPath: targetPath,
          sessionName: path.basename(targetPath),
          printSizes: config.printSizes
        },
        photos,
        selections,
        sessions,
        stations,
        timer: sessionTimerManager.getState()
      }));
    } catch (e) {
      console.error('Error on initial WS send:', e.message);
    }
  };

  // Check URL query param for station ID (e.g. ws://host:3000/?station=station-1)
  try {
    if (req && req.url) {
      const urlObj = new URL(req.url, 'http://localhost');
      const stationId = urlObj.searchParams.get('station');
      if (stationId) {
        registerStationClient(stationId, ws, req, broadcast, config);
      }
    }
  } catch (e) {}

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'REGISTER_STATION' && msg.stationId) {
        registerStationClient(msg.stationId, ws, req, broadcast, config);
        await sendInitToSocket(ws);
      }
    } catch (e) {}
  });

  console.log(`[WebSocket] Client terhubung ${ws.stationId ? `(Stasiun: ${ws.stationId})` : '(Operator Dashboard)'}`);
  await sendInitToSocket(ws);

  ws.on('close', () => {
    unregisterStationClient(ws, broadcast);
    console.log('[WebSocket] Client terputus');
  });
});

// Periodic Ping Heartbeat (30s) to prune broken Wi-Fi sockets
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Start Server (Explicit 0.0.0.0 LAN binding)
const PORT = process.env.PORT || config.port || 3000;
server.listen(PORT, '0.0.0.0', async () => {
  printNetworkBanner(PORT, config.activeSessionPath);

  // Ensure demo photos exist if session folder is empty
  try {
    const created = await generateSamplePhotos(config.activeSessionPath);
    if (created) {
      console.log(`[Demo] 6 foto demo berkualitas studio berhasil dibuat di folder sesi.`);
    }
  } catch (err) {
    console.warn('[Demo] Could not generate initial demo:', err.message);
  }
});
