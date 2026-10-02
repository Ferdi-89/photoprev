const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const sharp = require('sharp');
const { WebSocketServer, WebSocket } = require('ws');

const { loadConfig, saveConfig, getConfig } = require('./lib/config');
const { isImageFile, getImageMetadata, getOrGenerateImage } = require('./lib/thumbnail');
const { initWatcher, startWatcher, addWatchFolder, unwatchFolder, syncWatchedFolders, getWatchedFolders } = require('./lib/watcher');
const printManager = require('./lib/printManager');
const templateManager = require('./lib/templateManager');
const { renderPhotostrip } = require('./lib/photoStripEngine');
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
  openFileInWindowsExplorer,
  setRootDirectory,
  completeSession,
  reopenSession
} = require('./lib/sessionDirectoryManager');
const sessionTimerManager = require('./lib/sessionTimerManager');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/templates', express.static(path.join(__dirname, 'templates')));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

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
      sessionPath: resolved,
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
  // All non-completed sessions in storage root are actively watched
  try {
    const listRes = listSessions(config);
    if (listRes && Array.isArray(listRes.sessions)) {
      listRes.sessions.forEach(s => {
        if (!s.isCompleted && fs.existsSync(s.path)) {
          folders.add(path.resolve(s.path));
        }
      });
    }
  } catch (e) {}

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
  let explicit = (req.query && req.query.session) || (req.body && req.body.sessionPath);

  // Check Referer header if not in query/body
  if (!explicit && req.headers && req.headers.referer) {
    try {
      const refererUrl = new URL(req.headers.referer, 'http://localhost');
      const refSession = refererUrl.searchParams.get('session');
      if (refSession) explicit = refSession;
    } catch (e) {}
  }

  if (explicit && String(explicit).trim() !== '') {
    const resolved = path.resolve(String(explicit).trim());
    if (fs.existsSync(resolved)) return resolved;
  }

  // 2. Station ID in query or body (e.g. ?station=station-1)
  let stationId = (req.query && req.query.station) || (req.body && req.body.stationId);

  // Check Referer header if not in query/body
  if (!stationId && req.headers && req.headers.referer) {
    try {
      const refererUrl = new URL(req.headers.referer, 'http://localhost');
      const refStation = refererUrl.searchParams.get('station');
      if (refStation) stationId = refStation;
    } catch (e) {}
  }

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

// Find a photo file across the requested session, active station sessions, or storage session folders
function findPhotoInAnySession(filename, preferredSessionDir) {
  if (!filename) return null;

  // 1. Check preferred session folder first
  if (preferredSessionDir && fs.existsSync(preferredSessionDir)) {
    const preferredPath = path.join(preferredSessionDir, filename);
    if (fs.existsSync(preferredPath)) {
      return { fullPath: preferredPath, sessionDir: preferredSessionDir };
    }
    const siapPath = path.join(preferredSessionDir, '_SIAP_CETAK', filename);
    if (fs.existsSync(siapPath)) {
      return { fullPath: siapPath, sessionDir: preferredSessionDir };
    }
  }

  // 2. Check all client station assigned sessions
  if (Array.isArray(config.clientStations)) {
    for (const st of config.clientStations) {
      if (st.assignedSessionPath && fs.existsSync(st.assignedSessionPath)) {
        const sDir = path.resolve(st.assignedSessionPath);
        const p = path.join(sDir, filename);
        if (fs.existsSync(p)) {
          return { fullPath: p, sessionDir: sDir };
        }
        const pSiap = path.join(sDir, '_SIAP_CETAK', filename);
        if (fs.existsSync(pSiap)) {
          return { fullPath: pSiap, sessionDir: sDir };
        }
      }
    }
  }

  // 3. Check all active monitored session folders
  try {
    const activeFolders = getAllActiveSessionFolders();
    for (const folder of activeFolders) {
      const p = path.join(folder, filename);
      if (fs.existsSync(p)) {
        return { fullPath: p, sessionDir: folder };
      }
      const pSiap = path.join(folder, '_SIAP_CETAK', filename);
      if (fs.existsSync(pSiap)) {
        return { fullPath: pSiap, sessionDir: folder };
      }
    }
  } catch (e) {}

  // 4. Check global activeSessionPath
  if (config.activeSessionPath && fs.existsSync(config.activeSessionPath)) {
    const aDir = path.resolve(config.activeSessionPath);
    const p = path.join(aDir, filename);
    if (fs.existsSync(p)) {
      return { fullPath: p, sessionDir: aDir };
    }
    const pSiap = path.join(aDir, '_SIAP_CETAK', filename);
    if (fs.existsSync(pSiap)) {
      return { fullPath: pSiap, sessionDir: aDir };
    }
  }

  return null;
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
    const photosWithSession = photos.map(p => ({
      ...p,
      sessionPath: p.sessionPath || targetPath
    }));
    res.json({ success: true, sessionPath: targetPath, photos: photosWithSession });
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
    const found = findPhotoInAnySession(filename, sessionDir);
    if (!found) {
      return res.status(404).send('Foto tidak ditemukan');
    }
    const cachedThumb = await getOrGenerateImage(found.fullPath, 'thumb');
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
    const found = findPhotoInAnySession(filename, sessionDir);
    if (!found) {
      return res.status(404).send('Foto tidak ditemukan');
    }
    const cachedPreview = await getOrGenerateImage(found.fullPath, 'preview');
    res.sendFile(cachedPreview, {
      maxAge: '7d',
      lastModified: true,
      immutable: true
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 6. Original / Raw Photo Download / Stream
app.get(['/api/photo/:filename/original', '/api/photo/:filename/raw'], (req, res) => {
  const filename = safeFilename(req.params.filename);
  const sessionDir = resolveSessionForRequest(req);
  const found = findPhotoInAnySession(filename, sessionDir);
  if (!found) {
    return res.status(404).send('Foto tidak ditemukan');
  }
  res.sendFile(found.fullPath, {
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
    const { exportAll } = req.body || {};
    const sessionPath = resolveSessionForRequest(req);

    if (exportAll) {
      const allSessions = printManager.getAllSessionQueues(config);
      const reports = [];
      for (const s of allSessions) {
        if (s.totalItems > 0) {
          const rep = await printManager.exportToPrintFolder(s.sessionPath, null, req.body || {});
          reports.push(rep);
        }
      }
      const updatedSessions = printManager.getAllSessionQueues(config);
      broadcast({ type: 'PRINT_EXPORTED', reports, sessions: updatedSessions });
      return res.json({ success: true, reports, sessions: updatedSessions });
    }

    if (!sessionPath) {
      return res.status(400).json({ success: false, error: 'Path sesi tidak ditemukan' });
    }

    const report = await printManager.exportToPrintFolder(sessionPath, null, req.body || {});
    const updatedSessions = printManager.getAllSessionQueues(config);
    broadcast({
      type: 'PRINT_EXPORTED',
      sessionPath,
      report,
      sessions: updatedSessions
    });
    res.json({ success: true, report, sessions: updatedSessions });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 10A-1. Photostrip Templates & Settings
app.get('/api/photostrip/templates', (req, res) => {
  try {
    const templates = templateManager.getAllTemplates();
    const activeTemplateId = (config.photostrip && config.photostrip.activeTemplateId) || 'classic-white-3';
    res.json({
      success: true,
      templates,
      activeTemplateId,
      config: config.photostrip || {}
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/photostrip/templates/upload', async (req, res) => {
  try {
    const { name, filename, imageBase64, slots, outputFormat } = req.body || {};
    if (typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'Data gambar PNG template tidak ditemukan' });
    }
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
      return res.status(400).json({ success: false, error: 'Nama template wajib diisi (maksimal 80 karakter)' });
    }
    if (![3, 4].includes(Number(slots)) || !['double_4r', 'single_strip'].includes(outputFormat)) {
      return res.status(400).json({ success: false, error: 'Jumlah slot atau format template tidak valid' });
    }
    const match = imageBase64.match(/^data:image\/png;base64,([A-Za-z0-9+/]+=*)$/);
    if (!match || match[1].length > 35 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'File harus PNG valid dengan ukuran maksimal 25 MB' });
    }
    const buffer = Buffer.from(match[1], 'base64');
    if (!buffer.length || buffer.length > 25 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'Ukuran PNG maksimal 25 MB' });
    }
    let imageInfo;
    try {
      imageInfo = await sharp(buffer, { limitInputPixels: 25_000_000 }).metadata();
    } catch (_) {
      return res.status(400).json({ success: false, error: 'File tidak dapat dibaca sebagai PNG' });
    }
    const expectedDimensions = outputFormat === 'single_strip' ? [600, 1800] : [1200, 1800];
    if (imageInfo.format !== 'png' || imageInfo.width !== expectedDimensions[0] || imageInfo.height !== expectedDimensions[1]) {
      return res.status(400).json({ success: false, error: `Dimensi PNG harus ${expectedDimensions[0]}x${expectedDimensions[1]} piksel` });
    }

    const safeName = filename || `${name.trim()}.png`;

    const saved = templateManager.saveCustomTemplate(safeName, buffer, {
      name: name || path.basename(safeName, path.extname(safeName)),
      slots: parseInt(slots, 10) || 3,
      outputFormat: outputFormat || 'double_4r'
    });

    const allTemplates = templateManager.getAllTemplates();
    broadcast({
      type: 'TEMPLATES_UPDATED',
      templates: allTemplates,
      newTemplateId: saved.id
    });

    res.json({
      success: true,
      template: saved,
      templates: allTemplates
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/photostrip/config', (req, res) => {
  try {
    const newPsConfig = {
      ...(config.photostrip || {}),
      ...(req.body || {})
    };
    config.photostrip = newPsConfig;
    saveConfig({ photostrip: config.photostrip });

    broadcast({
      type: 'PHOTOSTRIP_CONFIG_CHANGED',
      photostrip: config.photostrip
    });

    res.json({ success: true, photostrip: config.photostrip });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/photostrip/preview', async (req, res) => {
  try {
    const {
      filenames,
      items,
      cropOffsets,
      sessionPath,
      templateId,
      eventTitle,
      studioFooter,
      dateText,
      filter,
      outputFormat
    } = req.body || {};

    const targetSession = sessionPath ? path.resolve(sessionPath) : resolveSessionForRequest(req);
    const photoObjects = [];

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const fn = typeof item === 'string' ? item : (item && item.filename);
        if (!fn) continue;
        const found = findPhotoInAnySession(path.basename(fn), targetSession);
        if (found && fs.existsSync(found.fullPath)) {
          photoObjects.push({
            path: found.fullPath,
            filename: path.basename(fn),
            cropOffsetY: typeof item.cropOffsetY === 'number' ? item.cropOffsetY : 50,
            cropOffsetX: typeof item.cropOffsetX === 'number' ? item.cropOffsetX : 50
          });
        }
      }
    } else {
      const photoFiles = Array.isArray(filenames) ? filenames : [];
      photoFiles.forEach((fn, idx) => {
        const found = findPhotoInAnySession(path.basename(fn), targetSession);
        if (found && fs.existsSync(found.fullPath)) {
          const cY = (Array.isArray(cropOffsets) && typeof cropOffsets[idx] === 'number') ? cropOffsets[idx] : 50;
          photoObjects.push({
            path: found.fullPath,
            filename: path.basename(fn),
            cropOffsetY: cY,
            cropOffsetX: 50
          });
        }
      });
    }

    if (photoObjects.length === 0) {
      return res.status(400).json({ success: false, error: 'Tidak ada foto valid yang dipilih untuk preview strip' });
    }

    const tId = templateId || (config.photostrip && config.photostrip.activeTemplateId) || 'classic-white-3';
    const eTitle = eventTitle || (config.photostrip && config.photostrip.eventTitle) || 'PHOTOBOOTH MEMORIES';
    const sFooter = studioFooter || (config.photostrip && config.photostrip.studioFooter) || 'RTFTP PHOTO STUDIO';
    const psConfig = config.photostrip || {};
    const dText = dateText !== undefined ? dateText : (psConfig.showDate === false ? '' : new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }));
    const outFmt = outputFormat || (config.photostrip && config.photostrip.outputFormat) || 'double_4r';

    const renderRes = await renderPhotostrip(photoObjects, {
      templateId: tId,
      eventTitle: eTitle,
      studioFooter: sFooter,
      dateText: dText,
      filter: filter || (config.photostrip && config.photostrip.filter) || 'normal',
      outputFormat: outFmt,
      outputPath: null
    });

    if (!renderRes || !renderRes.buffer) {
      return res.status(500).json({ success: false, error: 'Gagal membuat preview strip' });
    }

    const base64 = renderRes.buffer.toString('base64');
    res.json({
      success: true,
      dataUrl: `data:image/jpeg;base64,${base64}`,
      templateId: tId,
      slotCount: renderRes.slotCount,
      width: renderRes.width,
      height: renderRes.height
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10A-2. Batch Set Ordered Selections (Photostrip Slot Reordering)
app.post('/api/selections/batch', (req, res) => {
  try {
    const { selections } = req.body || {};
    const sessionPath = resolveSessionForRequest(req);

    if (!Array.isArray(selections)) {
      return res.status(400).json({ success: false, error: 'Format selections tidak valid' });
    }

    const updated = printManager.setSelections(selections, sessionPath);
    const allSessions = printManager.getAllSessionQueues(config);

    broadcast({
      type: 'SELECTIONS_UPDATED',
      sessionPath,
      selections: updated,
      sessions: allSessions
    }, sessionPath);

    res.json({
      success: true,
      selections: updated,
      sessions: allSessions
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10B. Operator Queue: Reveal Specific Photo in Windows Explorer
app.post('/api/operator/queue/open-file', async (req, res) => {
  try {
    const { sessionPath, filename } = req.body || {};
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Nama file tidak boleh kosong' });
    }

    const safeFilename = path.basename(filename);
    const targetSession = sessionPath ? path.resolve(sessionPath) : (config.activeSessionPath ? path.resolve(config.activeSessionPath) : '');
    let targetFilePath = targetSession ? path.join(targetSession, safeFilename) : null;

    // 1. Direct match in session root
    if (!targetFilePath || !fs.existsSync(targetFilePath)) {
      // 2. Exact match in _SIAP_CETAK
      const siapExact = targetSession ? path.join(targetSession, '_SIAP_CETAK', safeFilename) : null;
      if (siapExact && fs.existsSync(siapExact)) {
        targetFilePath = siapExact;
      } else {
        // 3. Scan _SIAP_CETAK for exported variant (e.g. filename__4R_x1.jpg)
        const namePart = path.parse(safeFilename).name;
        const extPart = path.parse(safeFilename).ext.toLowerCase();
        const siapDir = targetSession ? path.join(targetSession, '_SIAP_CETAK') : null;
        let foundInSiap = null;

        if (siapDir && fs.existsSync(siapDir)) {
          try {
            const files = fs.readdirSync(siapDir);
            foundInSiap = files.find(f => {
              if (f.toLowerCase() === safeFilename.toLowerCase()) return true;
              if (f.startsWith(namePart + '__') && f.toLowerCase().endsWith(extPart)) return true;
              return false;
            });
          } catch (e) {}
        }

        if (foundInSiap) {
          targetFilePath = path.join(siapDir, foundInSiap);
        } else {
          // 4. Scan any other session folder
          const foundAny = findPhotoInAnySession(safeFilename, targetSession);
          if (foundAny && fs.existsSync(foundAny.fullPath)) {
            targetFilePath = foundAny.fullPath;
          } else {
            // 5. Fallback: if specific file not found, open the session folder itself
            if (targetSession && fs.existsSync(targetSession)) {
              const folderResult = await openInWindowsExplorer(targetSession);
              return res.json({ success: true, openedPath: targetSession, fallbackToFolder: true });
            }
            return res.status(404).json({ success: false, error: 'File foto tidak ditemukan di folder sesi' });
          }
        }
      }
    }

    const result = await openFileInWindowsExplorer(targetFilePath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10C. Operator Queue: Open Session or _SIAP_CETAK Folder in Windows Explorer
app.post('/api/operator/queue/open-folder', async (req, res) => {
  try {
    const { sessionPath, target } = req.body || {};
    let baseSession = sessionPath ? path.resolve(sessionPath) : config.activeSessionPath;
    if (!baseSession || !fs.existsSync(baseSession)) {
      baseSession = (config.activeSessionPath && fs.existsSync(config.activeSessionPath))
        ? config.activeSessionPath
        : getRootDirectory(config);
    }

    let targetDir = baseSession;
    if (target === 'print' || target === '_SIAP_CETAK') {
      const printFolder = path.join(baseSession, '_SIAP_CETAK');
      if (fs.existsSync(printFolder)) {
        targetDir = printFolder;
      }
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ success: false, error: 'Direktori tidak ditemukan' });
    }

    const result = await openInWindowsExplorer(targetDir);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10D. Web & OS Direct Print Preview / Trigger Route
app.get('/api/print/render', (req, res) => {
  try {
    const sessionPath = req.query.session ? path.resolve(req.query.session) : config.activeSessionPath;
    const filename = req.query.file ? path.basename(req.query.file) : null;
    const isBatch = req.query.batch === 'true' || req.query.batch === '1';

    if (!sessionPath || !fs.existsSync(sessionPath)) {
      return res.status(404).send('Folder sesi tidak ditemukan');
    }

    let pages = [];

    if (filename) {
      // Single photo
      const photoPath = path.join(sessionPath, filename);
      if (!fs.existsSync(photoPath)) {
        return res.status(404).send('File foto tidak ditemukan di sesi ini');
      }

      let parsedSizes = [];
      if (req.query.sizes) {
        try {
          parsedSizes = JSON.parse(req.query.sizes);
        } catch (e) {
          parsedSizes = [{ size: req.query.sizes, qty: 1 }];
        }
      }
      if (!Array.isArray(parsedSizes) || parsedSizes.length === 0) {
        parsedSizes = [{ size: '4R', qty: 1 }];
      }

      parsedSizes.forEach(s => {
        const qty = Math.max(1, parseInt(s.qty, 10) || 1);
        for (let i = 0; i < qty; i++) {
          pages.push({
            filename,
            size: s.size || '4R',
            copyNum: i + 1,
            totalCopies: qty
          });
        }
      });
    } else if (isBatch) {
      // All selections in session
      const selections = printManager.getSelections(sessionPath);
      if (selections.length === 0) {
        return res.status(400).send('Belum ada foto yang dipilih untuk dicetak pada sesi ini');
      }

      selections.forEach(item => {
        const sizes = item.sizes || [{ size: '4R', qty: 1 }];
        sizes.forEach(s => {
          const qty = Math.max(1, parseInt(s.qty, 10) || 1);
          for (let i = 0; i < qty; i++) {
            pages.push({
              filename: item.filename,
              size: s.size || '4R',
              copyNum: i + 1,
              totalCopies: qty
            });
          }
        });
      });
    } else {
      return res.status(400).send('Parameter pencetakan tidak valid (harus menyertakan file atau batch=true)');
    }

    const sessionName = path.basename(sessionPath);

    const esc = (str) => String(str || '').replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cetak Foto - ${esc(sessionName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page {
      size: auto;
      margin: 0mm;
    }
    @media print {
      .no-print { display: none !important; }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      .print-page {
        width: 100vw;
        height: 100vh;
        page-break-after: always;
        page-break-inside: avoid;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .print-page img {
        max-width: 100%;
        max-height: 100%;
        width: auto;
        height: auto;
        object-fit: contain;
      }
    }
    @media screen {
      body {
        background: #090d16;
        color: #f1f5f9;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        padding: 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        min-height: 100vh;
      }
      .print-toolbar {
        position: sticky;
        top: 16px;
        z-index: 100;
        background: #131b2e;
        border: 1px solid #1e293b;
        border-radius: 12px;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        gap: 16px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.6);
        margin-bottom: 28px;
        flex-wrap: wrap;
      }
      .print-btn {
        background: #d97706;
        color: #ffffff;
        font-weight: 700;
        padding: 9px 20px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.92rem;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: background 0.15s ease;
      }
      .print-btn:hover { background: #b45309; }
      .close-btn {
        background: #1e293b;
        color: #cbd5e1;
        padding: 9px 16px;
        border: 1px solid #334155;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.88rem;
        font-weight: 600;
        transition: all 0.15s ease;
      }
      .close-btn:hover { background: #334155; color: #ffffff; }
      .session-tag {
        font-size: 0.84rem;
        color: #94a3b8;
        font-family: monospace;
      }
      .preview-container {
        display: flex;
        flex-direction: column;
        gap: 24px;
        max-width: 820px;
        width: 100%;
      }
      .preview-sheet {
        background: #ffffff;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px;
      }
      .sheet-header {
        width: 100%;
        display: flex;
        justify-content: space-between;
        font-size: 0.76rem;
        color: #64748b;
        margin-bottom: 12px;
        font-family: monospace;
        font-weight: 600;
        border-bottom: 1px dashed #e2e8f0;
        padding-bottom: 8px;
      }
      .preview-sheet img {
        max-width: 100%;
        max-height: 65vh;
        object-fit: contain;
        display: block;
      }
    }
  </style>
</head>
<body>
  <div class="print-toolbar no-print">
    <button class="print-btn" onclick="window.print()">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
      <span>Kirim ke Printer (Print)</span>
    </button>
    <span class="session-tag">${esc(sessionName)} &bull; ${pages.length} Lembar Foto</span>
    <button class="close-btn" onclick="window.close()">Tutup Jendela</button>
  </div>
  <div class="preview-container">
    ${pages.map((p, idx) => `
      <div class="preview-sheet print-page">
        <div class="sheet-header no-print">
          <span>Lembar ${idx + 1} dari ${pages.length} &bull; ${esc(p.filename)}</span>
          <span>Ukuran: ${esc(p.size)} (Salinan ${p.copyNum}/${p.totalCopies})</span>
        </div>
        <img src="/api/photo/${encodeURIComponent(p.filename)}/original?session=${encodeURIComponent(sessionPath)}" alt="${esc(p.filename)}" loading="eager">
      </div>
    `).join('')}
  </div>
  <script>
    let loadedCount = 0;
    const imgs = document.querySelectorAll('.preview-sheet img');
    const totalImgs = imgs.length;

    function checkReadyAndPrint() {
      loadedCount++;
      if (loadedCount >= totalImgs) {
        setTimeout(() => {
          window.print();
        }, 350);
      }
    }

    if (totalImgs === 0) {
      window.print();
    } else {
      imgs.forEach(img => {
        if (img.complete) {
          checkReadyAndPrint();
        } else {
          img.addEventListener('load', checkReadyAndPrint);
          img.addEventListener('error', checkReadyAndPrint);
        }
      });
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send('Error rendering print layout: ' + err.message);
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
    let folderPath = req.body && req.body.folderPath;
    if (folderPath === 'templates') folderPath = path.join(__dirname, 'templates');
    if (!folderPath || !fs.existsSync(folderPath)) {
      folderPath = (config.sessionRootPath && fs.existsSync(config.sessionRootPath))
        ? path.resolve(config.sessionRootPath)
        : ((config.activeSessionPath && fs.existsSync(config.activeSessionPath))
            ? path.resolve(config.activeSessionPath)
            : getRootDirectory(config));
    }
    const result = await openInWindowsExplorer(folderPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 23B. Operator Directory: Mark Session as Completed (Checkout / Print Done confirmed by Operator)
app.post(['/api/operator/session/confirm-complete', '/api/operator/directory/complete'], (req, res) => {
  try {
    const { sessionPath, releaseStation = true, stationId } = req.body || {};
    if (!sessionPath) {
      return res.status(400).json({ success: false, error: 'Path sesi tidak boleh kosong' });
    }

    const resolved = path.resolve(sessionPath);
    const result = completeSession(config, resolved);

    const releasedStations = [];
    if (releaseStation) {
      const stations = getStations(config);
      const targetStations = stations.filter(st => {
        if (stationId) return st.id === stationId;
        return st.assignedSessionPath && path.resolve(st.assignedSessionPath).toLowerCase() === resolved.toLowerCase();
      });

      for (const st of targetStations) {
        // Notify client tablets / touchscreens connected to this station
        broadcast({
          type: 'SESSION_COMPLETED',
          stationId: st.id,
          sessionPath: resolved,
          sessionName: path.basename(resolved),
          message: 'Sesi photoshoot telah selesai dikonfirmasi oleh operator studio. Terima kasih!'
        });

        assignSessionToStation(config, st.id, null, broadcast);
        releasedStations.push(st.name || st.id);
      }
    }

    setupActiveWatcher();
    const dirData = listSessions(config);
    broadcast({
      type: 'SESSION_DIRECTORIES_UPDATED',
      ...dirData
    });
    broadcast({
      type: 'STATIONS_UPDATED',
      stations: getStations(config)
    });

    res.json({
      success: true,
      ...result,
      releasedStations,
      ...dirData
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 23C. Operator Directory: Reopen Completed Session Back to Active
app.post(['/api/operator/session/reopen', '/api/operator/directory/reopen'], (req, res) => {
  try {
    const { sessionPath } = req.body || {};
    if (!sessionPath) {
      return res.status(400).json({ success: false, error: 'Path sesi tidak boleh kosong' });
    }
    const resolved = path.resolve(sessionPath);
    const result = reopenSession(config, resolved);
    setupActiveWatcher();
    const dirData = listSessions(config);
    broadcast({
      type: 'SESSION_DIRECTORIES_UPDATED',
      ...dirData
    });
    res.json({ success: true, ...result, ...dirData });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
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
        photostrip: {
          config: config.photostrip || {},
          templates: templateManager.getAllTemplates()
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
