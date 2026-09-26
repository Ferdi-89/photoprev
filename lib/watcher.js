const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { isImageFile, getImageMetadata, getOrGenerateImage } = require('./thumbnail');

let watcherInstance = null;
let currentFolder = '';

function startWatcher(targetFolder, callbacks = {}) {
  currentFolder = targetFolder;

  if (watcherInstance) {
    watcherInstance.close();
  }

  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  console.log(`[Watcher] Memantau folder: ${targetFolder}`);

  watcherInstance = chokidar.watch(targetFolder, {
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
    const filename = path.basename(filePath);
    console.log(`[Watcher] Foto baru terdeteksi: ${filename}`);

    try {
      const meta = await getImageMetadata(filePath);
      if (callbacks.onPhotoAdded) {
        callbacks.onPhotoAdded({
          id: filename,
          filename,
          size: meta.size,
          mtime: meta.mtime,
          width: meta.width,
          height: meta.height,
          aspectRatio: meta.aspectRatio
        });
      }
      // Pre-generate thumbnail and preview in background for instantaneous client viewing
      getOrGenerateImage(filePath, 'thumb').catch(() => {});
      getOrGenerateImage(filePath, 'preview').catch(() => {});
    } catch (e) {
      console.error(`[Watcher] Gagal memproses file baru ${filename}:`, e.message);
    }
  });

  watcherInstance.on('unlink', (filePath) => {
    const filename = path.basename(filePath);
    console.log(`[Watcher] Foto dihapus: ${filename}`);
    if (callbacks.onPhotoRemoved) {
      callbacks.onPhotoRemoved(filename);
    }
  });

  return watcherInstance;
}

function stopWatcher() {
  if (watcherInstance) {
    watcherInstance.close();
    watcherInstance = null;
  }
}

module.exports = {
  startWatcher,
  stopWatcher
};
