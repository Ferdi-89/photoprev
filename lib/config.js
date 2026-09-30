const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../config.json');
const DEFAULT_STORAGE = path.join(__dirname, '../storage/demo_session');
const DEFAULT_CACHE = path.join(__dirname, '../storage/cache');

const defaultConfig = {
  port: 3000,
  activeSessionPath: DEFAULT_STORAGE,
  recentFolders: [],
  watermark: {
    enabled: false,
    text: 'STUDIO PREVIEW'
  },
  printSizes: [
    { id: '4R', label: '4R (10 x 15 cm)' },
    { id: '5R', label: '5R (13 x 18 cm)' },
    { id: '8R', label: '8R (20 x 25 cm)' },
    { id: '10R', label: '10R (25 x 30 cm)' },
    { id: '12R', label: '12R (30 x 40 cm)' },
    { id: 'Kanvas', label: 'Kanvas (40 x 60 cm)' }
  ],
  sessionTimer: {
    enabled: false,
    durationMinutes: 15,
    warningThresholdMinutes: 3,
    lockOnExpiry: false,
    autoStartOnSessionChange: false,
    messageOnExpiry: 'Waktu sesi pemilihan foto telah selesai. Tim studio kami siap membantu menyelesaikan pesanan cetak Anda.'
  },
  completedSessions: [],
  clientStations: [
    {
      id: 'station-1',
      name: 'PC Klien 1 (Kabel LAN Booth A)',
      type: 'lan',
      note: 'Layar Sentuh Booth Utama',
      assignedSessionPath: null,
      assignedSessionName: null,
      createdAt: 1790693658391
    },
    {
      id: 'station-2',
      name: 'PC Klien 2 (Kabel LAN Booth B)',
      type: 'lan',
      note: 'Layar Sentuh Booth 2',
      assignedSessionPath: null,
      assignedSessionName: null,
      createdAt: 1790693658391
    }
  ]
};

let currentConfig = { ...defaultConfig };

function ensureDirectories() {
  if (!fs.existsSync(DEFAULT_STORAGE)) {
    fs.mkdirSync(DEFAULT_STORAGE, { recursive: true });
  }
  if (!fs.existsSync(DEFAULT_CACHE)) {
    fs.mkdirSync(DEFAULT_CACHE, { recursive: true });
  }
}

function loadConfig() {
  ensureDirectories();
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      currentConfig = { ...defaultConfig, ...data };
    } catch (err) {
      console.warn('Failed to parse config.json, using defaults', err.message);
    }
  } else {
    saveConfig(defaultConfig);
  }

  // Fallback if configured path does not exist on this environment (e.g. Docker, Linux, or another PC)
  if (!currentConfig.activeSessionPath || !fs.existsSync(currentConfig.activeSessionPath)) {
    currentConfig.activeSessionPath = DEFAULT_STORAGE;
  }

  return currentConfig;
}

function saveConfig(newConfig) {
  try {
    currentConfig = { ...currentConfig, ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf8');
    return currentConfig;
  } catch (err) {
    console.error('Failed to save config:', err.message);
    return currentConfig;
  }
}

function getConfig() {
  return currentConfig;
}

module.exports = {
  loadConfig,
  saveConfig,
  getConfig,
  DEFAULT_STORAGE,
  DEFAULT_CACHE
};
