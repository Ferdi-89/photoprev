const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');

const { loadConfig, saveConfig, getConfig } = require('./lib/config');
const { isImageFile, getImageMetadata, getOrGenerateImage } = require('./lib/thumbnail');
const { startWatcher } = require('./lib/watcher');
const printManager = require('./lib/printManager');
const { generateSamplePhotos } = require('./lib/demoData');
const { getLanInterfaces, printNetworkBanner } = require('./lib/network');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize configuration
const config = loadConfig();
printManager.setSessionDir(config.activeSessionPath);

// WebSocket Broadcast Helper
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Setup Watcher
function setupActiveWatcher(folderPath) {
  return startWatcher(folderPath, {
    onPhotoAdded: (photo) => {
      broadcast({ type: 'PHOTO_ADDED', photo });
    },
    onPhotoRemoved: (filename) => {
      broadcast({ type: 'PHOTO_REMOVED', filename });
    }
  });
}

setupActiveWatcher(config.activeSessionPath);

// Path sanitization helpers against path traversal
function safeFilename(rawFilename) {
  if (!rawFilename) return '';
  return path.basename(String(rawFilename));
}

function safeSessionDir(reqSession) {
  if (!reqSession) return config.activeSessionPath;
  const resolved = path.resolve(String(reqSession));
  if (!fs.existsSync(resolved)) return config.activeSessionPath;
  return resolved;
}

// Helper: Read all photos in current session (parallelized + cached)
async function getSessionPhotos(folderPath) {
  if (!fs.existsSync(folderPath)) return [];
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  const photoFiles = entries
    .filter(e => e.isFile() && isImageFile(e.name) && !e.name.startsWith('.'))
    .map(e => e.name);

  // Read metadata in parallel with in-memory caching
  const photos = await Promise.all(photoFiles.map(async (filename) => {
    const fullPath = path.join(folderPath, filename);
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
  return photos;
}

// ---------------- REST API ROUTES ----------------

// 1. Session Information
app.get('/api/session', async (req, res) => {
  try {
    const activePath = config.activeSessionPath;
    const photos = await getSessionPhotos(activePath);
    const selections = printManager.getSelections();

    res.json({
      success: true,
      activeSessionPath: activePath,
      sessionName: path.basename(activePath),
      totalPhotos: photos.length,
      totalSelections: selections.length,
      printSizes: config.printSizes,
      watermark: config.watermark
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

    setupActiveWatcher(config.activeSessionPath);

    const photos = await getSessionPhotos(config.activeSessionPath);
    broadcast({
      type: 'SESSION_CHANGED',
      sessionName: path.basename(config.activeSessionPath),
      activeSessionPath: config.activeSessionPath,
      photos
    });

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

// 3. List Photos
app.get('/api/photos', async (req, res) => {
  try {
    const photos = await getSessionPhotos(config.activeSessionPath);
    res.json({ success: true, photos });
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

// 4. Stream Thumbnail
app.get('/api/photo/:filename/thumb', async (req, res) => {
  try {
    const filename = safeFilename(req.params.filename);
    const sessionDir = safeSessionDir(req.query.session);
    const fullPath = path.join(sessionDir, filename);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).send('Foto tidak ditemukan');
    }
    const cachedThumb = await getOrGenerateImage(fullPath, 'thumb');
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(cachedThumb).pipe(res);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 5. Stream Preview (High-Res WebP)
app.get('/api/photo/:filename/preview', async (req, res) => {
  try {
    const filename = safeFilename(req.params.filename);
    const sessionDir = safeSessionDir(req.query.session);
    const fullPath = path.join(sessionDir, filename);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).send('Foto tidak ditemukan');
    }
    const cachedPreview = await getOrGenerateImage(fullPath, 'preview');
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(cachedPreview).pipe(res);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 6. Original Photo Download / Stream
app.get('/api/photo/:filename/original', (req, res) => {
  const filename = safeFilename(req.params.filename);
  const sessionDir = safeSessionDir(req.query.session);
  const fullPath = path.join(sessionDir, filename);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).send('Foto tidak ditemukan');
  }
  res.sendFile(fullPath, {
    maxAge: '1d',
    lastModified: true
  });
});

// 7. Get Selections (Grouped by Session + active selections)
app.get('/api/selections', (req, res) => {
  const sessions = printManager.getAllSessionQueues(config);
  res.json({
    success: true,
    activeSession: path.basename(config.activeSessionPath),
    activeSessionPath: config.activeSessionPath,
    selections: printManager.getSelections(),
    sessions
  });
});

// 8. Update Selection (Select / Deselect photo with sizes)
app.post('/api/selections', (req, res) => {
  const { filename, selected, sizes, notes, sessionPath } = req.body;
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
    sessionPath: sessionPath || config.activeSessionPath,
    selections: updatedSelections,
    sessions: allSessions
  });

  res.json({
    success: true,
    selections: updatedSelections,
    sessions: allSessions
  });
});

// 9. Clear Selections
app.post('/api/selections/clear', (req, res) => {
  const { sessionPath } = req.body || {};
  const updatedSelections = printManager.clearSelections(sessionPath);
  const allSessions = printManager.getAllSessionQueues(config);

  broadcast({
    type: 'SELECTION_CLEARED',
    sessionPath: sessionPath || config.activeSessionPath,
    selections: updatedSelections,
    sessions: allSessions
  });
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
    const photos = await getSessionPhotos(config.activeSessionPath);
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

// ---------------- WEBSOCKET HANDLING ----------------
wss.on('connection', async (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  console.log('[WebSocket] Client terhubung');
  try {
    const photos = await getSessionPhotos(config.activeSessionPath);
    const selections = printManager.getSelections();
    const sessions = printManager.getAllSessionQueues(config);
    ws.send(JSON.stringify({
      type: 'INIT',
      session: {
        activeSessionPath: config.activeSessionPath,
        sessionName: path.basename(config.activeSessionPath),
        printSizes: config.printSizes
      },
      photos,
      selections,
      sessions
    }));
  } catch (e) {
    console.error('Error on initial WS send:', e.message);
  }

  ws.on('close', () => {
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
