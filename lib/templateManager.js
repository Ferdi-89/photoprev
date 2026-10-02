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
    id: 'pastel-cream-4',
    name: 'Pastel Warm Cream (4 Foto)',
    description: 'Format 4 foto vertikal dengan nuansa krem hangat dan lembut.',
    slots: 4,
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
    id: 'vintage-film-3',
    name: 'Vintage Retro Film (3 Foto)',
    description: 'Koleksi retro analog 90s dengan palet kertas antik sepia dan aksen amber hangat.',
    slots: 3,
    type: 'builtin',
    theme: 'light',
    bgColor: '#f4ebd9',
    textColor: '#3e2723',
    subTextColor: '#795548',
    accentColor: '#b45309',
    frameBorderColor: '#d7c4a7',
    layout: 'vertical',
    outputFormat: 'double_4r',
    cuttingLine: true
  },
  {
    id: 'vintage-film-4',
    name: 'Vintage Retro Film (4 Foto)',
    description: 'Format 4 foto gaya photobooth analog klasik dengan palet warm sepia.',
    slots: 4,
    type: 'builtin',
    theme: 'light',
    bgColor: '#f4ebd9',
    textColor: '#3e2723',
    subTextColor: '#795548',
    accentColor: '#b45309',
    frameBorderColor: '#d7c4a7',
    layout: 'vertical',
    outputFormat: 'double_4r',
    cuttingLine: true
  },
  {
    id: 'rose-blush-3',
    name: 'Romantic Rose Gold (3 Foto)',
    description: 'Aura romantis pengantin dengan latar dusty blush lembut dan aksen foil rose gold.',
    slots: 3,
    type: 'builtin',
    theme: 'light',
    bgColor: '#fdf2f4',
    textColor: '#4a2835',
    subTextColor: '#8c5a6d',
    accentColor: '#b76e79',
    frameBorderColor: '#f2d1d8',
    layout: 'vertical',
    outputFormat: 'double_4r',
    cuttingLine: true
  },
  {
    id: 'rose-blush-4',
    name: 'Romantic Rose Gold (4 Foto)',
    description: 'Format 4 foto romantis dengan nuansa rose gold pastel elegan untuk wedding & engagement.',
    slots: 4,
    type: 'builtin',
    theme: 'light',
    bgColor: '#fdf2f4',
    textColor: '#4a2835',
    subTextColor: '#8c5a6d',
    accentColor: '#b76e79',
    frameBorderColor: '#f2d1d8',
    layout: 'vertical',
    outputFormat: 'double_4r',
    cuttingLine: true
  },
  {
    id: 'midnight-royal-3',
    name: 'Midnight Royal Cyan (3 Foto)',
    description: 'Tema galeri malam biru navy pekat dengan panduan aksen cyan elektrik studio.',
    slots: 3,
    type: 'builtin',
    theme: 'dark',
    bgColor: '#0b132b',
    textColor: '#f8fafc',
    subTextColor: '#94a3b8',
    accentColor: '#38bdf8',
    frameBorderColor: '#1e293b',
    layout: 'vertical',
    outputFormat: 'double_4r',
    cuttingLine: true
  },
  {
    id: 'midnight-royal-4',
    name: 'Midnight Royal Cyan (4 Foto)',
    description: 'Format 4 foto tema midnight navy dengan kontras aksen ice cyan tajam.',
    slots: 4,
    type: 'builtin',
    theme: 'dark',
    bgColor: '#0b132b',
    textColor: '#f8fafc',
    subTextColor: '#94a3b8',
    accentColor: '#38bdf8',
    frameBorderColor: '#1e293b',
    layout: 'vertical',
    outputFormat: 'double_4r',
    cuttingLine: true
  },
  {
    id: 'sage-botanical-3',
    name: 'Sage Garden Botanical (3 Foto)',
    description: 'Nuansa hijau sage organik yang menenangkan untuk tema garden photoshoot dan outdoor.',
    slots: 3,
    type: 'builtin',
    theme: 'light',
    bgColor: '#eef2ef',
    textColor: '#1b3022',
    subTextColor: '#4a6b57',
    accentColor: '#2d4a3e',
    frameBorderColor: '#cbd5cd',
    layout: 'vertical',
    outputFormat: 'double_4r',
    cuttingLine: true
  },
  {
    id: 'cyber-neon-4',
    name: 'Cyber Neon Noir (4 Foto)',
    description: 'Tema industrial gelap modern 4 foto dengan aksen neon emerald studio.',
    slots: 4,
    type: 'builtin',
    theme: 'dark',
    bgColor: '#0d1117',
    textColor: '#e6edf3',
    subTextColor: '#8b949e',
    accentColor: '#10b981',
    frameBorderColor: '#21262d',
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
  },
  {
    id: 'single-strip-4',
    name: 'Single Strip 2x6 (4 Foto)',
    description: 'Format strip tunggal 4 foto 600x1800 px (300 DPI) untuk printer potong otomatis.',
    slots: 4,
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
  },
  {
    id: 'baskara-grid-4',
    name: 'Baskara Studio 4-Grid',
    description: 'Format postcard mini-poster 4R (Grid 2x2) dengan nuansa hangat vintage, nomor slot, dan tanggal sesi dinamis.',
    slots: 4,
    type: 'builtin',
    theme: 'light',
    bgColor: '#f4f0e8',
    textColor: '#18181b',
    subTextColor: '#27272a',
    accentColor: '#b91c1c',
    frameBorderColor: '#18181b',
    layout: 'grid_2x2',
    outputFormat: 'double_4r',
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
          overlayUrl: `/templates/custom/${encodeURIComponent(file)}`,
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

  if (fs.existsSync(targetPng) || fs.existsSync(targetJson)) {
    throw new Error('Nama template sudah digunakan; pilih nama lain');
  }

  const metaData = {
    name: meta.name || safeBase.replace(/[_-]/g, ' '),
    description: meta.description || 'Desain bingkai kustom buatan klien/operator',
    slots: parseInt(meta.slots, 10) || 3,
    outputFormat: meta.outputFormat || 'double_4r',
    cuttingLine: meta.cuttingLine !== false,
    createdAt: new Date().toISOString()
  };

  fs.writeFileSync(targetPng, buffer, { flag: 'wx' });
  try {
    fs.writeFileSync(targetJson, JSON.stringify(metaData, null, 2), { encoding: 'utf8', flag: 'wx' });
  } catch (err) {
    fs.unlinkSync(targetPng);
    throw err;
  }

  return {
    id: `custom-${safeBase}`,
    ...metaData,
    overlayFile: `${safeBase}.png`,
    overlayPath: targetPng,
    overlayUrl: `/templates/custom/${safeBase}.png`
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
