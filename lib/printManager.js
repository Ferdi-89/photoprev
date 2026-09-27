const fs = require('fs');
const path = require('path');

let currentSelections = new Map(); // filename -> { filename, sizes: [{ size, qty }], notes, selectedAt }
let activeSessionDir = '';

function setSessionDir(dir) {
  activeSessionDir = dir ? path.resolve(dir) : '';
  currentSelections.clear();
  loadSelectionsFromDisk();
}

function getSelectionsFilePath(dir = null) {
  const targetDir = dir ? path.resolve(dir) : activeSessionDir;
  if (!targetDir || !fs.existsSync(targetDir)) return null;
  return path.join(targetDir, '.rtftp_selections.json');
}

function loadSelectionsFromDisk() {
  const filePath = getSelectionsFilePath();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      currentSelections = new Map(Object.entries(data));
    } catch (e) {
      console.warn('Could not read existing selections:', e.message);
    }
  }
}

function saveSelectionsToDisk() {
  const filePath = getSelectionsFilePath();
  if (filePath) {
    try {
      const obj = Object.fromEntries(currentSelections);
      fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving selections:', e.message);
    }
  }
}

function readSelectionsFromFile(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  const resolved = path.resolve(dir);
  if (resolved === activeSessionDir) {
    return Array.from(currentSelections.values());
  }
  const filePath = path.join(resolved, '.rtftp_selections.json');
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return Object.values(data);
    } catch (e) {
      return [];
    }
  }
  return [];
}

function getSelections(sessionDir = null) {
  if (sessionDir) {
    return readSelectionsFromFile(sessionDir);
  }
  return Array.from(currentSelections.values());
}

function getAllSessionQueues(config = {}) {
  const sessionMap = new Map();

  function addSession(dir, isActive = false) {
    if (!dir || !fs.existsSync(dir)) return;
    const resolved = path.resolve(dir);
    if (sessionMap.has(resolved)) {
      if (isActive) sessionMap.get(resolved).isActive = true;
      return;
    }

    const selections = readSelectionsFromFile(resolved);
    let totalCopies = 0;
    let latestSelectedAt = null;

    selections.forEach(item => {
      if (item.sizes) {
        item.sizes.forEach(s => totalCopies += (parseInt(s.qty, 10) || 1));
      } else {
        totalCopies += 1;
      }
      if (item.selectedAt) {
        if (!latestSelectedAt || new Date(item.selectedAt) > new Date(latestSelectedAt)) {
          latestSelectedAt = item.selectedAt;
        }
      }
    });

    sessionMap.set(resolved, {
      sessionName: path.basename(resolved),
      sessionPath: resolved,
      isActive: Boolean(isActive),
      totalItems: selections.length,
      totalCopies,
      latestSelectedAt,
      selections
    });
  }

  // 1. Active session
  const activeDir = activeSessionDir || (config.activeSessionPath ? path.resolve(config.activeSessionPath) : '');
  if (activeDir && fs.existsSync(activeDir)) {
    addSession(activeDir, true);
  }

  // 2. Recent folders from config
  if (Array.isArray(config.recentFolders)) {
    config.recentFolders.forEach(folder => {
      if (fs.existsSync(folder)) addSession(folder, false);
    });
  }

  // 3. Sibling sessions in parent directory
  if (activeDir && fs.existsSync(activeDir)) {
    const parentDir = path.dirname(activeDir);
    if (fs.existsSync(parentDir)) {
      try {
        const entries = fs.readdirSync(parentDir, { withFileTypes: true });
        const ignored = new Set(['cache', 'node_modules', '.git', '_SIAP_CETAK']);
        for (const entry of entries) {
          if (entry.isDirectory() && !ignored.has(entry.name) && !entry.name.startsWith('.')) {
            const subDirPath = path.join(parentDir, entry.name);
            const selFile = path.join(subDirPath, '.rtftp_selections.json');
            if (fs.existsSync(selFile)) {
              addSession(subDirPath, false);
            }
          }
        }
      } catch (err) {
        console.warn('Error reading sibling sessions:', err.message);
      }
    }
  }

  const list = Array.from(sessionMap.values());
  list.sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return b.totalItems - a.totalItems;
  });

  return list;
}

function updateSelection(filename, data, sessionDir = null) {
  const targetDir = sessionDir ? path.resolve(sessionDir) : activeSessionDir;
  if (!targetDir) return [];

  if (targetDir === activeSessionDir) {
    if (!data || data.selected === false) {
      currentSelections.delete(filename);
    } else {
      currentSelections.set(filename, {
        filename,
        sizes: data.sizes || [{ size: '4R', qty: 1 }],
        notes: data.notes || '',
        selectedAt: data.selectedAt || new Date().toISOString()
      });
    }
    saveSelectionsToDisk();
    return getSelections();
  }

  // For non-active session folder
  const filePath = path.join(targetDir, '.rtftp_selections.json');
  let mapObj = {};
  if (fs.existsSync(filePath)) {
    try {
      mapObj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      mapObj = {};
    }
  }

  if (!data || data.selected === false) {
    delete mapObj[filename];
  } else {
    mapObj[filename] = {
      filename,
      sizes: data.sizes || [{ size: '4R', qty: 1 }],
      notes: data.notes || '',
      selectedAt: data.selectedAt || new Date().toISOString()
    };
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(mapObj, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving selections for session:', e.message);
  }

  return Object.values(mapObj);
}

function clearSelections(sessionDir = null) {
  const targetDir = sessionDir ? path.resolve(sessionDir) : activeSessionDir;
  if (!targetDir) return [];

  if (targetDir === activeSessionDir) {
    currentSelections.clear();
    saveSelectionsToDisk();
    return [];
  }

  const filePath = path.join(targetDir, '.rtftp_selections.json');
  if (fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf8');
    } catch (e) {
      console.error('Error clearing selections in session:', e.message);
    }
  }
  return [];
}

async function exportToPrintFolder(sessionDir = null, customOutputFolder = null) {
  const targetSessionDir = sessionDir ? path.resolve(sessionDir) : activeSessionDir;
  if (!targetSessionDir || !fs.existsSync(targetSessionDir)) {
    throw new Error('Sesi tidak ditemukan');
  }

  const selections = readSelectionsFromFile(targetSessionDir);
  if (selections.length === 0) {
    throw new Error('Belum ada foto yang dipilih untuk dicetak pada sesi ini');
  }

  const targetDir = customOutputFolder || path.join(targetSessionDir, '_SIAP_CETAK');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const results = [];
  let totalCopies = 0;
  const sizeBreakdown = {};
  const copyOperations = [];

  for (const item of selections) {
    const srcPath = path.join(targetSessionDir, item.filename);
    if (fs.existsSync(srcPath)) {
      const ext = path.extname(item.filename);
      const base = path.basename(item.filename, ext);

      for (const s of (item.sizes || [{ size: '4R', qty: 1 }])) {
        const sizeTag = s.size.replace(/[^a-zA-Z0-9]/g, '_');
        const qty = parseInt(s.qty, 10) || 1;
        totalCopies += qty;
        sizeBreakdown[s.size] = (sizeBreakdown[s.size] || 0) + qty;

        const destName = `${base}__${sizeTag}_x${qty}${ext}`;
        const destPath = path.join(targetDir, destName);

        copyOperations.push(
          fs.promises.copyFile(srcPath, destPath).then(() => {
            results.push({
              original: item.filename,
              exported: destName,
              size: s.size,
              qty: qty
            });
          })
        );
      }
    }
  }

  // Execute all file copies concurrently without blocking event loop
  await Promise.all(copyOperations);

  // Summary file
  const summaryTime = new Date().toLocaleString('id-ID');
  let summaryText = `========================================================\n`;
  summaryText += `       REKAP DAFTAR CETAK FOTO (RTFTP STUDIO)           \n`;
  summaryText += `========================================================\n`;
  summaryText += `Tanggal & Waktu   : ${summaryTime}\n`;
  summaryText += `Folder Sesi       : ${targetSessionDir}\n`;
  summaryText += `Total Foto Unik   : ${selections.length} Foto\n`;
  summaryText += `Total Lembar Cetak: ${totalCopies} Lembar\n\n`;
  summaryText += `--- RINCIAN UKURAN CETAK ---\n`;
  for (const [sz, count] of Object.entries(sizeBreakdown)) {
    summaryText += `- Ukuran ${sz.padEnd(12)}: ${count} lembar\n`;
  }
  summaryText += `\n--- DAFTAR DETAIL FOTO TERPILIH ---\n`;
  selections.forEach((sel, i) => {
    const sizeStr = (sel.sizes || []).map(s => `${s.size} (${s.qty}x)`).join(', ');
    summaryText += `${(i + 1).toString().padStart(2, ' ')}. ${sel.filename.padEnd(30)} -> ${sizeStr}`;
    if (sel.notes) summaryText += ` [Catatan: ${sel.notes}]`;
    summaryText += `\n`;
  });
  summaryText += `\n========================================================\n`;

  fs.writeFileSync(path.join(targetDir, 'REKAP_CETAK.txt'), summaryText, 'utf8');

  fs.writeFileSync(path.join(targetDir, 'order_manifest.json'), JSON.stringify({
    exportedAt: new Date().toISOString(),
    sessionDir: targetSessionDir,
    totalPhotos: selections.length,
    totalCopies,
    sizeBreakdown,
    items: results
  }, null, 2), 'utf8');

  return {
    sessionName: path.basename(targetSessionDir),
    sessionDir: targetSessionDir,
    targetDir,
    totalPhotos: selections.length,
    totalCopies,
    sizeBreakdown,
    results
  };
}

module.exports = {
  setSessionDir,
  getSelections,
  getAllSessionQueues,
  updateSelection,
  clearSelections,
  exportToPrintFolder
};
