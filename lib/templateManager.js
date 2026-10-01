const fs = require('fs');
const path = require('path');

const TEMPLATES_ROOT = path.join(__dirname, '../templates');
const CUSTOM_TEMPLATES_DIR = path.join(TEMPLATES_ROOT, 'custom');

function ensureTemplateDirectories() {
  if (!fs.existsSync(TEMPLATES_ROOT)) {
    fs.mkdirSync(TEMPLATES_ROOT, { recursive: true });
  }
  if (!fs.existsSync(CUSTOM_TEMPLATES_DIR)) {
    fs.mkdirSync(CUSTOM_TEMPLATES_DIR, { recursive: true });
  }
}

// Built-in standard studio photostrip templates
const BUILTIN_TEMPLATES = [
  {
    id: 'classic-white-3',
    name: 'Classic White (3 Foto)',
    description: 'Format strip 3 foto vertikal dengan latar putih bersih dan tipografi minimalis studio.',
    slots: 3,
    type: 'builtin',
    theme: 'light',
    bgColor: '#ffffff',
    textColor: '#18181b',
    subTextColor: '#71717a',
    accentColor: '#2563eb',
    frameBorderColor: '#e4e4e7',
    layout: 'vertical',
    outputFormat: 'double_4r', // 1200x1800 px (300 DPI) double strip on 4R
    cuttingLine: true
  },
  {
    id: 'classic-white-4',
    name: 'Classic White (4 Foto)',
    description: 'Format strip 4 foto vertikal klasik photobooth dengan latar putih bersih.',
    slots: 4,
    type: 'builtin',
    theme: 'light',
    bgColor: '#ffffff',
    textColor: '#18181b',
    subTextColor: '#71717a',
    accentColor: '#2563eb',
    frameBorderColor: '#e4e4e7',
    layout: 'vertical',
    outputFormat: 'double_4r',
    cuttingLine: true
  },
  {
    id: 'dark-luxury-3',
    name: 'Dark Luxury (3 Foto)',
    description: 'Tema malam elegan bernuansa hitam matte dengan aksen tipografi emas.',
    slots: 3,
    type: 'builtin',
    theme: 'dark',
    bgColor: '#121316',
    textColor: '#f4f4f5',
    subTextColor: '#a1a1aa',
    accentColor: '#d4af37',
    frameBorderColor: '#27272a',
    layout: 'vertical',
    outputFormat: 'double_4r',
    cuttingLine: true
  },
  {
    id: 'dark-luxury-4',
    name: 'Dark Luxury (4 Foto)',
    description: 'Tema hitam eksklusif 4 foto dengan garis pembatas emas dan kontras tajam.',
    slots: 4,
    type: 'builtin',
    theme: 'dark',
    bgColor: '#121316',
    textColor: '#f4f4f5',
    subTextColor: '#a1a1aa',
    accentColor: '#d4af37',
    frameBorderColor: '#27272a',
    layout: 'vertical',
    outputFormat: 'double_4r',
    cuttingLine: true
  },
  {
    id: 'pastel-cream-3',
    name: 'Pastel Warm Cream (3 Foto)',
    description: 'Nuansa hangat lembut dan estetis untuk wedding, portrait santai, dan kafe.',
    slots: 3,
    type: 'builtin',
    theme: 'light',
    bgColor: '#f7f4ed',
    textColor: '#292524',
    subTextColor: '#78716c',
    accentColor: '#c2410c',
    frameBorderColor: '#e7e5e4',
    layout: 'vertical',
    outputFormat: 'double_4r',
    cuttingLine: true
  },
  {
    id: 'single-strip-3',
    name: 'Single Strip 2x6 (3 Foto)',
    description: 'Format strip tunggal 600x1800 px (300 DPI) untuk printer potong langsung.',
    slots: 3,
    type: 'builtin',
    theme: 'light',
    bgColor: '#ffffff',
    textColor: '#18181b',
    subTextColor: '#71717a',
    accentColor: '#2563eb',
    frameBorderColor: '#e4e4e7',
    layout: 'vertical',
    outputFormat: 'single_strip',
    cuttingLine: false
  }
];

function getCustomTemplates() {
  ensureTemplateDirectories();
  const custom = [];

  try {
    const files = fs.readdirSync(CUSTOM_TEMPLATES_DIR);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (ext === '.png') {
        const baseName = path.basename(file, ext);
        const metaFile = path.join(CUSTOM_TEMPLATES_DIR, `${baseName}.json`);
        let meta = {
          slots: 3,
          name: baseName.replace(/[_-]/g, ' '),
          description: `Desain template PNG kustom: ${file}`,
          outputFormat: 'double_4r',
          cuttingLine: true
        };

        if (fs.existsSync(metaFile)) {
          try {
            const data = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
            meta = { ...meta, ...data };
          } catch (_) {}
        }

        custom.push({
          id: `custom-${baseName}`,
          name: meta.name || baseName,
          description: meta.description || `Template kustom ${file}`,
          slots: meta.slots || 3,
          type: 'custom',
          theme: meta.theme || 'custom',
          overlayFile: file,
          overlayPath: path.join(CUSTOM_TEMPLATES_DIR, file),
          outputFormat: meta.outputFormat || 'double_4r',
          cuttingLine: meta.cuttingLine !== false,
          customMeta: meta
        });
      }
    }
  } catch (err) {
    console.warn('Error reading custom templates directory:', err.message);
  }

  return custom;
}

function getAllTemplates() {
  const custom = getCustomTemplates();
  return [...BUILTIN_TEMPLATES, ...custom];
}

function getTemplateById(id) {
  if (!id) return BUILTIN_TEMPLATES[0];
  const all = getAllTemplates();
  const found = all.find(t => t.id === id);
  return found || BUILTIN_TEMPLATES[0];
}

function saveCustomTemplate(filename, buffer, meta = {}) {
  ensureTemplateDirectories();
  const safeBase = path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetPng = path.join(CUSTOM_TEMPLATES_DIR, `${safeBase}.png`);
  const targetJson = path.join(CUSTOM_TEMPLATES_DIR, `${safeBase}.json`);

  fs.writeFileSync(targetPng, buffer);

  const metaData = {
    name: meta.name || safeBase.replace(/[_-]/g, ' '),
    description: meta.description || 'Desain bingkai kustom buatan klien/operator',
    slots: parseInt(meta.slots, 10) || 3,
    outputFormat: meta.outputFormat || 'double_4r',
    cuttingLine: meta.cuttingLine !== false,
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(targetJson, JSON.stringify(metaData, null, 2), 'utf8');

  return {
    id: `custom-${safeBase}`,
    ...metaData,
    overlayFile: `${safeBase}.png`,
    overlayPath: targetPng
  };
}

module.exports = {
  TEMPLATES_ROOT,
  CUSTOM_TEMPLATES_DIR,
  ensureTemplateDirectories,
  getAllTemplates,
  getTemplateById,
  saveCustomTemplate
};
