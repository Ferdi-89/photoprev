const fs = require('fs');
const path = require('path');
const { isImageFile } = require('./thumbnail');
const { renderPhotostrip } = require('./photoStripEngine');
const { getTemplateById } = require('./templateManager');
const { getConfig } = require('./config');

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
  if (resolved === activeSessionDir && currentSelections.size > 0) {
    return Array.from(currentSelections.values());
  }

  // 1. Read persistent .rtftp_selections.json
  const filePath = path.join(resolved, '.rtftp_selections.json');
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const items = Object.values(data);
      if (items.length > 0) return items;
    } catch (e) {
      // Continue to check _SIAP_CETAK
    }
  }

  // 2. Fallback: check _SIAP_CETAK/order_manifest.json
  const manifestPath = path.join(resolved, '_SIAP_CETAK', 'order_manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (Array.isArray(manifest.items) && manifest.items.length > 0) {
        return manifest.items.map(item => ({
          filename: item.original || item.filename,
          sizes: [{ size: item.size || '4R', qty: parseInt(item.qty, 10) || 1 }],
          notes: item.notes || '',
          selectedAt: manifest.exportedAt || null,
          isExported: true
        }));
      }
    } catch (e) {}
  }

    // 3. Fallback: scan _SIAP_CETAK directly for exported prints
    const siapDir = path.join(resolved, '_SIAP_CETAK');
    if (fs.existsSync(siapDir)) {
      try {
        const files = fs.readdirSync(siapDir);
        const printFiles = files.filter(f => f !== 'order_manifest.json' && f !== 'REKAP_CETAK.txt' && isImageFile(f));
        if (printFiles.length > 0) {
          return printFiles.map(f => {
            let originalName = f;
            let size = '4R';
            let qty = 1;
            let isPhotostrip = false;
            const match = f.match(/^(.*?)__([^_]+)_x(\d+)(\.[^.]+)$/);
            if (match) {
              originalName = match[1] + match[4];
              size = match[2];
              qty = parseInt(match[3], 10) || 1;
            } else if (f.startsWith('STRIP_')) {
              isPhotostrip = true;
              size = '4R Double Strip';
              qty = 1;
            }
            return {
              filename: originalName,
              exportedFilename: f,
              sizes: [{ size, qty }],
              notes: '',
              selectedAt: null,
              isExported: true,
              isPhotostrip
            };
          });
        }
      } catch (e) {}
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
  const completedSet = new Set((config.completedSessions || []).map(p => path.resolve(p).toLowerCase()));

  // Map station assignments to sessions: sessionPath -> [stationNames]
  const stationAssignments = new Map();
  if (Array.isArray(config.clientStations)) {
    config.clientStations.forEach(st => {
      if (st.assignedSessionPath && fs.existsSync(st.assignedSessionPath)) {
        const resolved = path.resolve(st.assignedSessionPath);
        if (!stationAssignments.has(resolved)) {
          stationAssignments.set(resolved, []);
        }
        stationAssignments.get(resolved).push(st.name || st.id);
      }
    });
  }

  function addSession(dir, isDefaultActive = false) {
    if (!dir || !fs.existsSync(dir)) return;
    const resolved = path.resolve(dir);
    const assignedStations = stationAssignments.get(resolved) || [];
    const isActive = isDefaultActive || assignedStations.length > 0;
    const isCompleted = completedSet.has(resolved.toLowerCase());

    if (sessionMap.has(resolved)) {
      const existing = sessionMap.get(resolved);
      if (isActive) existing.isActive = true;
      if (assignedStations.length > 0) existing.assignedStations = assignedStations;
      return;
    }

    const selections = readSelectionsFromFile(resolved);
    const manifestFile = path.join(resolved, '_SIAP_CETAK', 'order_manifest.json');
    const siapDir = path.join(resolved, '_SIAP_CETAK');
    const hasExportedPrint = fs.existsSync(manifestFile) || (fs.existsSync(siapDir) && fs.readdirSync(siapDir).some(f => isImageFile(f)));

    let photostrip = null;
    let manifestData = null;
    if (fs.existsSync(manifestFile)) {
      try {
        manifestData = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        if (manifestData.photostrip) photostrip = manifestData.photostrip;
      } catch (_) {}
    }
    if (!photostrip && fs.existsSync(siapDir)) {
      try {
        const files = fs.readdirSync(siapDir);
        const stripFile = files.filter(f => f.startsWith('STRIP_') && isImageFile(f)).pop();
        if (stripFile) {
          photostrip = {
            exportedFile: stripFile,
            templateId: 'photobooth',
            isDouble: true
          };
        }
      } catch (_) {}
    }

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

    if (manifestData && typeof manifestData.totalCopies === 'number' && manifestData.totalCopies > 0) {
      totalCopies = manifestData.totalCopies;
    } else if (photostrip && typeof photostrip.copies === 'number' && photostrip.copies > 0) {
      totalCopies = photostrip.copies;
    }

    sessionMap.set(resolved, {
      sessionName: path.basename(resolved),
      sessionPath: resolved,
      isActive: Boolean(isActive),
      isCompleted,
      assignedStations,
      hasExportedPrint,
      photostrip,
      totalItems: selections.length,
      totalCopies,
      latestSelectedAt,
      selections
    });
  }

  // 1. Global Active Session
  const activeDir = activeSessionDir || (config.activeSessionPath ? path.resolve(config.activeSessionPath) : '');
  if (activeDir && fs.existsSync(activeDir)) {
    addSession(activeDir, true);
  }

  // 2. All Workstation-Assigned Sessions
  if (Array.isArray(config.clientStations)) {
    config.clientStations.forEach(st => {
      if (st.assignedSessionPath && fs.existsSync(st.assignedSessionPath)) {
        addSession(st.assignedSessionPath, false);
      }
    });
  }

  // 3. Subdirectories in Session Root Path (Session Directory)
  const rootDir = config.sessionRootPath || config.sessionRootDir;
  if (rootDir && fs.existsSync(rootDir)) {
    try {
      const entries = fs.readdirSync(rootDir, { withFileTypes: true });
      const ignored = new Set(['cache', 'node_modules', '.git', '_SIAP_CETAK']);
      for (const entry of entries) {
        if (entry.isDirectory() && !ignored.has(entry.name) && !entry.name.startsWith('.')) {
          addSession(path.join(rootDir, entry.name), false);
        }
      }
    } catch (err) {
      console.warn('Error reading session root directories for queue:', err.message);
    }
  }

  // 4. Recent folders from config
  if (Array.isArray(config.recentFolders)) {
    config.recentFolders.forEach(folder => {
      if (fs.existsSync(folder)) addSession(folder, false);
    });
  }

  // 5. Sibling sessions in parent directory of activeDir
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
    if (a.hasExportedPrint && !b.hasExportedPrint) return -1;
    if (!a.hasExportedPrint && b.hasExportedPrint) return 1;
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
        slot: typeof data.slot === 'number' ? data.slot : null,
        order: typeof data.order === 'number' ? data.order : currentSelections.size,
        sizes: data.sizes || [{ size: '4R', qty: 1 }],
        notes: data.notes || '',
        cropOffsetY: typeof data.cropOffsetY === 'number' ? data.cropOffsetY : 50,
        cropOffsetX: typeof data.cropOffsetX === 'number' ? data.cropOffsetX : 50,
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
      slot: typeof data.slot === 'number' ? data.slot : null,
      order: typeof data.order === 'number' ? data.order : Object.keys(mapObj).length,
      sizes: data.sizes || [{ size: '4R', qty: 1 }],
      notes: data.notes || '',
      cropOffsetY: typeof data.cropOffsetY === 'number' ? data.cropOffsetY : 50,
      cropOffsetX: typeof data.cropOffsetX === 'number' ? data.cropOffsetX : 50,
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

function setSelections(newSelections, sessionDir = null) {
  const targetDir = sessionDir ? path.resolve(sessionDir) : activeSessionDir;
  if (!targetDir) return [];

  const map = new Map();
  if (Array.isArray(newSelections)) {
    newSelections.forEach((item, idx) => {
      if (item && item.filename) {
        map.set(item.filename, {
          filename: item.filename,
          order: typeof item.order === 'number' ? item.order : idx,
          slot: typeof item.slot === 'number' ? item.slot : (idx + 1),
          sizes: item.sizes || [{ size: '4R', qty: 1 }],
          notes: item.notes || '',
          cropOffsetY: typeof item.cropOffsetY === 'number' ? item.cropOffsetY : 50,
          cropOffsetX: typeof item.cropOffsetX === 'number' ? item.cropOffsetX : 50,
          selectedAt: item.selectedAt || new Date().toISOString()
        });
      }
    });
  }

  if (targetDir === activeSessionDir) {
    currentSelections = map;
    saveSelectionsToDisk();
    return Array.from(currentSelections.values());
  }

  const filePath = path.join(targetDir, '.rtftp_selections.json');
  try {
    const obj = Object.fromEntries(map);
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving batch selections for session:', e.message);
  }
  return Array.from(map.values());
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

async function exportToPrintFolder(sessionDir = null, customOutputFolder = null, exportOptions = {}) {
  const targetSessionDir = sessionDir ? path.resolve(sessionDir) : activeSessionDir;
  if (!targetSessionDir || !fs.existsSync(targetSessionDir)) {
    throw new Error('Sesi tidak ditemukan');
  }

  let selections = readSelectionsFromFile(targetSessionDir);
  if (selections.length === 0) {
    const selFile = path.join(targetSessionDir, '.rtftp_selections.json');
    if (fs.existsSync(selFile)) {
      try {
        selections = Object.values(JSON.parse(fs.readFileSync(selFile, 'utf8')));
      } catch (_) {}
    }
  }
  if (selections.length === 0) {
    throw new Error('Belum ada foto yang dipilih untuk dicetak pada sesi ini');
  }

  const targetDir = customOutputFolder || path.join(targetSessionDir, '_SIAP_CETAK');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  } else {
    // Clean up older generated copies to avoid orphan/stale prints
    try {
      const existingFiles = fs.readdirSync(targetDir);
      for (const f of existingFiles) {
        if (f === 'order_manifest.json' || f === 'REKAP_CETAK.txt') continue;
        if ((f.includes('__') || f.startsWith('STRIP_')) && isImageFile(f)) {
          try { fs.unlinkSync(path.join(targetDir, f)); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  const results = [];
  let totalCopies = 0;
  const sizeBreakdown = {};
  const copyOperations = [];

  // Photostrip Composite Generation
  const cfg = getConfig();
  const psConfig = {
    enabled: true,
    activeTemplateId: 'classic-white-3',
    eventTitle: 'PHOTOBOOTH MEMORIES',
    studioFooter: 'RTFTP PHOTO STUDIO',
    showDate: true,
    filter: 'normal',
    outputFormat: 'double_4r',
    ...(cfg.photostrip || {}),
    ...exportOptions
  };

  let photostripMeta = null;
  const orderedPhotoObjects = selections
    .slice()
    .sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : (typeof a.slot === 'number' ? a.slot : 0);
      const orderB = typeof b.order === 'number' ? b.order : (typeof b.slot === 'number' ? b.slot : 0);
      return orderA - orderB;
    })
    .map(item => {
      const full = path.join(targetSessionDir, item.filename);
      if (fs.existsSync(full)) {
        return {
          path: full,
          filename: item.filename,
          cropOffsetY: typeof item.cropOffsetY === 'number' ? item.cropOffsetY : 50,
          cropOffsetX: typeof item.cropOffsetX === 'number' ? item.cropOffsetX : 50
        };
      }
      return null;
    })
    .filter(Boolean);

  const exportTemplateId = exportOptions.templateId || psConfig.activeTemplateId;
  const tpl = getTemplateById(exportTemplateId);
  const exportFormat = exportOptions.outputFormat || (tpl && tpl.outputFormat) || psConfig.outputFormat || 'double_4r';
  const exportCopies = Math.max(1, Math.min(20, parseInt(exportOptions.copies || psConfig.copies || 1, 10)));
  if (orderedPhotoObjects.length > 0 && psConfig.enabled) {
    const safeSession = path.basename(targetSessionDir).replace(/[^a-zA-Z0-9_-]/g, '_');
    const stamp = Date.now();
    const stripExt = '.jpg';
    const stripName = `STRIP_${safeSession}__${String(exportTemplateId || 'classic').replace(/[^a-zA-Z0-9_-]/g, '_')}__${stamp}${stripExt}`;
    const stripPath = path.join(targetDir, stripName);

    try {
      const stripRes = await renderPhotostrip(orderedPhotoObjects, {
        templateId: exportTemplateId,
        eventTitle: psConfig.eventTitle,
        studioFooter: psConfig.studioFooter,
        dateText: psConfig.showDate === false ? '' : (psConfig.dateText || new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })),
        filter: exportOptions.filter || psConfig.filter,
        outputFormat: exportFormat,
        outputPath: stripPath
      });

      if (stripRes && stripRes.success) {
        const stripSizeLabel = exportFormat === 'single_strip' ? '2x6 Strip' : (exportFormat === 'grid_2x2' ? '4R Grid 2x2' : '4R Double Strip (2x6)');
        photostripMeta = {
          exportedFile: stripName,
          templateId: exportTemplateId,
          outputFormat: exportFormat,
          slotCount: stripRes.slotCount,
          isDouble: stripRes.isDouble,
          size: stripSizeLabel,
          copies: exportCopies,
          photos: orderedPhotoObjects.map(p => p.filename)
        };

        totalCopies += 1;
        sizeBreakdown[stripSizeLabel] = (sizeBreakdown[stripSizeLabel] || 0) + 1;

        results.push({
          original: 'PHOTOSTRIP_COMPOSITE',
          exported: stripName,
          size: stripSizeLabel,
          qty: 1,
          isPhotostrip: true
        });

        // Generate additional physical copies if requested
        if (exportCopies > 1) {
          for (let c = 2; c <= exportCopies; c++) {
            const copyName = `STRIP_${safeSession}__${String(exportTemplateId || 'classic').replace(/[^a-zA-Z0-9_-]/g, '_')}__${stamp}__copy${c}${stripExt}`;
            const copyPath = path.join(targetDir, copyName);
            try {
              fs.copyFileSync(stripPath, copyPath);
              totalCopies += 1;
              sizeBreakdown[stripSizeLabel] = (sizeBreakdown[stripSizeLabel] || 0) + 1;
              results.push({
                original: 'PHOTOSTRIP_COMPOSITE',
                exported: copyName,
                size: stripSizeLabel,
                qty: 1,
                isPhotostrip: true
              });
            } catch (copyErr) {
              console.warn(`Could not create print copy ${c}:`, copyErr.message);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error creating photostrip composite in export:', err.message);
    }
  }

  // Only copy individual original photos if not a photostrip or if explicitly requested
  const shouldCopyLoosePhotos = !photostripMeta || exportOptions.includeLoosePhotos === true;

  if (shouldCopyLoosePhotos) {
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

  if (photostripMeta) {
    summaryText += `--- HASIL CETAK FOTO STRIP PHOTOBOOTH ---\n`;
    summaryText += `File Strip      : ${photostripMeta.exportedFile}\n`;
    summaryText += `Format Layout   : ${photostripMeta.size}\n`;
    summaryText += `Template Bingkai: ${photostripMeta.templateId}\n`;
    summaryText += `Slot Foto (${photostripMeta.photos.length}): ${photostripMeta.photos.join(', ')}\n\n`;
  }

  summaryText += `--- RINCIAN UKURAN CETAK ---\n`;
  for (const [sz, count] of Object.entries(sizeBreakdown)) {
    summaryText += `- Ukuran ${sz.padEnd(16)}: ${count} lembar\n`;
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
    photostrip: photostripMeta,
    items: results
  }, null, 2), 'utf8');

  return {
    sessionName: path.basename(targetSessionDir),
    sessionDir: targetSessionDir,
    targetDir,
    hasExportedPrint: true,
    totalPhotos: selections.length,
    totalCopies,
    sizeBreakdown,
    photostrip: photostripMeta,
    results
  };
}

module.exports = {
  setSessionDir,
  getSelections,
  getAllSessionQueues,
  updateSelection,
  setSelections,
  clearSelections,
  exportToPrintFolder
};
