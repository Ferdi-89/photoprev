/**
 * RTFTP Studio - Session Directory & Storage Manager
 * Dedicated engine for studio photoshoot session folders, disk monitoring, and template creation.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { saveConfig } = require('./config');
const { isImageFile } = require('./thumbnail');

/**
 * Get current working root directory for sessions
 */
function getRootDirectory(config) {
  if (config.sessionRootPath && fs.existsSync(config.sessionRootPath)) {
    return path.resolve(config.sessionRootPath);
  }
  if (config.activeSessionPath && fs.existsSync(config.activeSessionPath)) {
    return path.dirname(path.resolve(config.activeSessionPath));
  }
  return path.join(__dirname, '../storage');
}

/**
 * Get disk space and capacity for the drive of targetPath
 */
function getDriveStorageInfo(targetPath) {
  try {
    const resolved = path.resolve(targetPath);
    if (!fs.existsSync(resolved)) return null;

    const stats = fs.statfsSync(resolved);
    const freeBytes = stats.bfree * stats.bsize;
    const totalBytes = stats.blocks * stats.bsize;
    const usedBytes = totalBytes - freeBytes;

    const freeGB = (freeBytes / (1024 ** 3)).toFixed(1);
    const totalGB = (totalBytes / (1024 ** 3)).toFixed(1);
    const usedGB = (usedBytes / (1024 ** 3)).toFixed(1);
    const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;

    // Drive letter (e.g. C:\)
    const match = resolved.match(/^([A-Za-z]:\\)/);
    const driveLetter = match ? match[1] : path.parse(resolved).root;

    return {
      driveLetter,
      freeGB: `${freeGB} GB`,
      totalGB: `${totalGB} GB`,
      usedGB: `${usedGB} GB`,
      usedPercent,
      isLowSpace: (freeBytes / (1024 ** 3)) < 15 // Warning if < 15GB during shoot
    };
  } catch (err) {
    return null;
  }
}

/**
 * List all session folders inside the session root directory
 */
function listSessions(config) {
  const rootDir = getRootDirectory(config);
  const activePath = config.activeSessionPath ? path.resolve(config.activeSessionPath) : '';
  const storageInfo = getDriveStorageInfo(rootDir) || getDriveStorageInfo(activePath);

  if (!fs.existsSync(rootDir)) {
    return {
      rootPath: rootDir,
      activeSessionPath: activePath,
      totalSessions: 0,
      storageInfo,
      sessions: []
    };
  }

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const sessions = [];

  for (const entry of entries) {
    try {
      if (!entry.isDirectory()) continue;

      // Skip internal cache, git, node_modules, system files
      const nameLower = entry.name.toLowerCase();
      if (
        nameLower === 'cache' ||
        nameLower === 'node_modules' ||
        nameLower === '.git' ||
        nameLower.startsWith('$') ||
        nameLower.startsWith('.') ||
        nameLower === 'system volume information'
      ) {
        continue;
      }

      const folderPath = path.join(rootDir, entry.name);
      const isCurrentActive = folderPath.toLowerCase() === activePath.toLowerCase();

      let mtime = 0;
      let birthtime = 0;
      try {
        const stat = fs.statSync(folderPath);
        mtime = stat.mtimeMs;
        birthtime = stat.birthtimeMs || stat.ctimeMs;
      } catch (e) {}

      // Shallow scan photoshoot images inside this session folder
      let photoCount = 0;
      const previewPhotos = [];

      try {
        const files = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const file of files) {
          if (file.isFile() && isImageFile(file.name) && !file.name.startsWith('.')) {
            photoCount++;
            if (previewPhotos.length < 4) {
              previewPhotos.push(file.name);
            }
          }
        }
      } catch (e) {}

      // Check which stations are currently assigned to this session folder
      const assignedStations = (Array.isArray(config.clientStations) ? config.clientStations : [])
        .filter(st => st.assignedSessionPath && path.resolve(st.assignedSessionPath).toLowerCase() === folderPath.toLowerCase())
        .map(st => ({ id: st.id, name: st.name }));

      sessions.push({
        name: entry.name,
        path: folderPath,
        isActive: isCurrentActive,
        photoCount,
        previewPhotos,
        assignedStations,
        mtime,
        birthtime
      });
    } catch (e) {
      // Skip inaccessible folders
    }
  }

  // Sort: Active session first, then newest modified first
  sessions.sort((a, b) => {
    if (a.isActive) return -1;
    if (b.isActive) return 1;
    return b.mtime - a.mtime;
  });

  return {
    rootPath: rootDir,
    activeSessionPath: activePath,
    totalSessions: sessions.length,
    storageInfo,
    sessions
  };
}

/**
 * Create a new photoshoot session folder
 */
function createSession(config, { name, rootDir, setAsActive = true }) {
  const targetRoot = (rootDir && fs.existsSync(rootDir)) ? path.resolve(rootDir) : getRootDirectory(config);

  if (!name || !name.trim()) {
    throw new Error('Nama folder sesi harus diisi');
  }

  // Sanitize folder name
  const cleanName = name.trim().replace(/[<>:"/\\|?*]/g, '_');
  const targetPath = path.join(targetRoot, cleanName);

  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  if (setAsActive) {
    config.activeSessionPath = targetPath;
    if (!Array.isArray(config.recentFolders)) config.recentFolders = [];
    if (!config.recentFolders.includes(targetPath)) {
      config.recentFolders.unshift(targetPath);
      config.recentFolders = config.recentFolders.slice(0, 15);
    }
    saveConfig({
      activeSessionPath: config.activeSessionPath,
      recentFolders: config.recentFolders
    });
  }

  return {
    success: true,
    sessionPath: targetPath,
    name: cleanName,
    isActive: !!setAsActive
  };
}

/**
 * Open folder directly in host Windows Explorer
 */
function openInWindowsExplorer(folderPath) {
  return new Promise((resolve, reject) => {
    if (!folderPath || !fs.existsSync(folderPath)) {
      return reject(new Error('Path folder tidak ditemukan di sistem'));
    }

    const resolved = path.resolve(folderPath);
    // Use Windows explorer.exe
    exec(`explorer.exe "${resolved}"`, (err) => {
      // explorer.exe returns exit code 1 even on success in some Windows versions
      resolve({ success: true, openedPath: resolved });
    });
  });
}

/**
 * Set root directory for session storage
 */
function setRootDirectory(config, newRootPath) {
  if (!newRootPath || !fs.existsSync(newRootPath)) {
    throw new Error('Direktori root tidak valid atau tidak ditemukan');
  }
  const resolved = path.resolve(newRootPath);
  config.sessionRootPath = resolved;
  saveConfig({ sessionRootPath: resolved });
  return { success: true, rootPath: resolved };
}

module.exports = {
  getRootDirectory,
  getDriveStorageInfo,
  listSessions,
  createSession,
  openInWindowsExplorer,
  setRootDirectory
};
