const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { isImageFile, getImageMetadata, getOrGenerateImage } = require('./thumbnail');

let watcherInstance = null;
const watchedFolders = new Set();
let registeredCallbacks = {};

/**
 * Setup or re-initialize Chokidar watcher for multiple photoshoot folders
 */
function initWatcher(folders, callbacks = {}) {
  registeredCallbacks = { ...registeredCallbacks, ...callbacks };

  const folderList = (Array.isArray(folders) ? folders : [folders])
    .filter(Boolean)
    .map(f => path.resolve(f));

  if (watcherInstance) {
    watcherInstance.close();
    watcherInstance = null;
    watchedFolders.clear();
  }

  folderList.forEach(folder => {
    if (!fs.existsSync(folder)) {
      try {
        fs.mkdirSync(folder, { recursive: true });
      } catch (e) {}
    }
    watchedFolders.add(folder);
  });

  const targets = Array.from(watchedFolders);
  console.log(`[Watcher] Memantau ${targets.length} direktori photoshoot sesi:`, targets);

  watcherInstance = chokidar.watch(targets, {
    depth: 0,
    ignoreInitial: true,
    ignored: [
      /(^|[\/\\])\../,            // ignore dotfiles
      /(^|[\/\\])_SIAP_CETAK/,    // ignore output print folder
      /(^|[\/\\])cache/           // ignore cache
    ],
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 400,
      pollInterval: 100
    }
  });

  watcherInstance.on('add', async (filePath) => {
    if (!isImageFile(filePath)) return;
    const resolvedPath = path.resolve(filePath);
    const sessionPath = path.dirname(resolvedPath);
    const filename = path.basename(resolvedPath);

    console.log(`[Watcher] Foto baru terdeteksi di [${path.basename(sessionPath)}]: ${filename}`);

    try {
      const meta = await getImageMetadata(resolvedPath);
      if (registeredCallbacks.onPhotoAdded) {
        registeredCallbacks.onPhotoAdded({
          id: filename,
          filename,
          sessionPath,
          size: meta.size,
          mtime: meta.mtime,
          width: meta.width,
          height: meta.height,
          aspectRatio: meta.aspectRatio
        });
      }
      // Pre-generate thumbnail and preview in background for instantaneous client viewing
      getOrGenerateImage(resolvedPath, 'thumb').catch(() => {});
      getOrGenerateImage(resolvedPath, 'preview').catch(() => {});
    } catch (e) {
      console.error(`[Watcher] Gagal memproses file baru ${filename}:`, e.message);
    }
  });

  watcherInstance.on('unlink', (filePath) => {
    const resolvedPath = path.resolve(filePath);
    const sessionPath = path.dirname(resolvedPath);
    const filename = path.basename(resolvedPath);

    console.log(`[Watcher] Foto dihapus dari [${path.basename(sessionPath)}]: ${filename}`);
    if (registeredCallbacks.onPhotoRemoved) {
      registeredCallbacks.onPhotoRemoved({
        filename,
        sessionPath
      });
    }
  });

  return watcherInstance;
}

/**
 * Add an additional photoshoot folder to live watching
 */
function addWatchFolder(folderPath) {
  if (!folderPath) return;
  const resolved = path.resolve(folderPath);

  if (!fs.existsSync(resolved)) {
    try {
      fs.mkdirSync(resolved, { recursive: true });
    } catch (e) {}
  }

  if (!watchedFolders.has(resolved)) {
    watchedFolders.add(resolved);
    if (watcherInstance) {
      watcherInstance.add(resolved);
      console.log(`[Watcher] Ditambahkan folder pantauan baru: ${resolved}`);
    }
  }
}

/**
 * Remove a folder from watching
 */
function unwatchFolder(folderPath) {
  if (!folderPath) return;
  const resolved = path.resolve(folderPath);
  if (watchedFolders.has(resolved)) {
    watchedFolders.delete(resolved);
    if (watcherInstance) {
      watcherInstance.unwatch(resolved);
      console.log(`[Watcher] Berhenti memantau folder: ${resolved}`);
    }
  }
}

/**
 * Sync active watched folders to match all active session directories
 */
function syncWatchedFolders(foldersList) {
  if (!Array.isArray(foldersList)) return;
  foldersList.forEach(folder => {
    if (folder) addWatchFolder(folder);
  });
}

/**
 * Backward-compatible startWatcher wrapper
 */
function startWatcher(targetFolder, callbacks = {}) {
  return initWatcher(targetFolder, callbacks);
}

function stopWatcher() {
  if (watcherInstance) {
    watcherInstance.close();
    watcherInstance = null;
    watchedFolders.clear();
  }
}

function getWatchedFolders() {
  return Array.from(watchedFolders);
}

module.exports = {
  initWatcher,
  startWatcher,
  stopWatcher,
  addWatchFolder,
  unwatchFolder,
  syncWatchedFolders,
  getWatchedFolders
};
