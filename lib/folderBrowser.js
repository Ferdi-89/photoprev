const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { isImageFile } = require('./thumbnail');

/**
 * Detect all available drive letters on Windows (C:\ through Z:\)
 */
function getSystemDrives() {
  const drives = [];
  const letters = 'CDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < letters.length; i++) {
    const driveRoot = `${letters[i]}:\\`;
    try {
      if (fs.existsSync(driveRoot)) {
        drives.push({ name: `${letters[i]}:`, path: driveRoot });
      }
    } catch (e) {
      // Ignore inaccessible or unmounted optical/removable drives
    }
  }
  return drives.length > 0 ? drives : [{ name: 'C:', path: 'C:\\' }];
}

/**
 * Get system shortcuts and quick access links
 */
function getSystemShortcuts(config) {
  const homedir = os.homedir();
  const candidates = [
    { name: 'Sesi Aktif', path: config ? config.activeSessionPath : null, type: 'active' },
    { name: 'Gambar (Pictures)', path: path.join(homedir, 'Pictures'), type: 'pictures' },
    { name: 'Desktop', path: path.join(homedir, 'Desktop'), type: 'desktop' },
    { name: 'Dokumen', path: path.join(homedir, 'Documents'), type: 'documents' },
    { name: 'Unduhan', path: path.join(homedir, 'Downloads'), type: 'downloads' },
    { name: 'Demo Storage', path: path.join(__dirname, '..', 'storage'), type: 'storage' }
  ];

  return candidates.filter(item => {
    if (!item.path) return false;
    try {
      return fs.existsSync(item.path);
    } catch (e) {
      return false;
    }
  });
}

/**
 * Browse a directory: returns subfolders and count of photoshoot images
 */
function browseDirectory(reqPath, fallbackPath) {
  let target = reqPath ? String(reqPath).trim() : (fallbackPath || os.homedir());
  if (!target || !fs.existsSync(target)) {
    target = fallbackPath || os.homedir();
  }

  target = path.resolve(target);
  try {
    const stat = fs.statSync(target);
    if (!stat.isDirectory()) {
      target = path.dirname(target);
    }
  } catch (e) {
    target = fallbackPath || os.homedir();
  }

  const entries = fs.readdirSync(target, { withFileTypes: true });
  const folders = [];
  let photoCount = 0;

  for (const entry of entries) {
    try {
      // Skip hidden system files and recycle bin
      if (
        entry.name.startsWith('$') ||
        entry.name.startsWith('.') ||
        entry.name.toLowerCase() === 'system volume information' ||
        entry.name.toLowerCase() === 'node_modules'
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        const fullPath = path.join(target, entry.name);
        let mtime = 0;
        try {
          const s = fs.statSync(fullPath);
          mtime = s.mtimeMs;
        } catch (err) {}

        let subPhotoCount = 0;
        try {
          const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
          for (const sub of subEntries) {
            if (sub.isFile() && isImageFile(sub.name)) subPhotoCount++;
          }
        } catch (err) {}

        folders.push({
          name: entry.name,
          path: fullPath,
          mtime,
          photoCount: subPhotoCount
        });
      } else if (entry.isFile() && isImageFile(entry.name)) {
        photoCount++;
      }
    } catch (e) {
      // Skip protected items
    }
  }

  // Sort subfolders alphabetically (case-insensitive, natural number sorting)
  folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  const parentPath = path.dirname(target);
  const isRoot = parentPath === target;

  // Build breadcrumbs path segments
  const parts = target.split(path.sep).filter(Boolean);
  const breadcrumbs = [];
  let currentAccum = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === 0 && part.includes(':')) {
      currentAccum = part + path.sep;
      breadcrumbs.push({ name: part, path: currentAccum });
    } else {
      currentAccum = path.join(currentAccum, part);
      breadcrumbs.push({ name: part, path: currentAccum });
    }
  }

  return {
    success: true,
    currentPath: target,
    parentPath: isRoot ? null : parentPath,
    breadcrumbs,
    folders,
    photoCount
  };
}

/**
 * Create a new folder inside a parent directory
 */
function createFolder(parentPath, folderName) {
  if (!parentPath || !fs.existsSync(parentPath)) {
    throw new Error('Direktori induk tidak ditemukan');
  }
  if (!folderName || !folderName.trim()) {
    throw new Error('Nama folder harus diisi');
  }

  const cleanName = folderName.trim().replace(/[<>:"/\\|?*]/g, '_');
  const targetPath = path.join(parentPath, cleanName);

  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  return {
    success: true,
    path: targetPath,
    folderPath: targetPath,
    name: cleanName
  };
}

/**
 * Launch native Windows FolderBrowserDialog on host machine (Operator PC)
 */
function openNativePicker(initialDir) {
  return new Promise((resolve) => {
    const validInitial = (initialDir && fs.existsSync(initialDir)) ? initialDir : '';
    const escapedInitial = validInitial.replace(/'/g, "''");

    const psCommand = `powershell.exe -STA -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = 'Pilih Folder Sesi Photoshoot RTFTP'; if ('${escapedInitial}') { $d.SelectedPath = '${escapedInitial}' }; $d.ShowNewFolderButton = $true; if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.SelectedPath }"`;

    exec(psCommand, { timeout: 180000 }, (error, stdout) => {
      if (error) {
        return resolve({ success: false, error: error.message });
      }
      const selected = (stdout || '').trim();
      if (selected && fs.existsSync(selected)) {
        resolve({ success: true, path: selected });
      } else {
        resolve({ success: false, cancelled: true });
      }
    });
  });
}

module.exports = {
  getSystemDrives,
  getSystemShortcuts,
  browseDirectory,
  createFolder,
  openNativePicker
};
