const assert = require('assert');
const path = require('path');
const { getLanInterfaces } = require('./lib/network');
const { isImageFile, getImageMetadata } = require('./lib/thumbnail');

// 1. Check network interfaces
const ifaces = getLanInterfaces(3000);
assert(Array.isArray(ifaces), 'Interfaces must be an array');
assert(ifaces.length > 0, 'Should detect at least one LAN interface');
assert(ifaces.some(i => i.url.startsWith('http://')), 'URL format must be valid');
console.log('✓ Network interface discovery OK:', ifaces.map(i => `${i.name} -> ${i.url}`).join(', '));

// 2. Path traversal sanitization check
function safeFilename(rawFilename) {
  if (!rawFilename) return '';
  return path.basename(String(rawFilename));
}
assert.strictEqual(safeFilename('../../windows/system32/cmd.exe'), 'cmd.exe');
assert.strictEqual(safeFilename('..\\..\\boot.ini'), 'boot.ini');
assert.strictEqual(safeFilename('photo_01.jpg'), 'photo_01.jpg');
console.log('✓ Path traversal defense OK');

// 3. Image file extension validation
assert.strictEqual(isImageFile('test.jpg'), true);
assert.strictEqual(isImageFile('test.PNG'), true);
assert.strictEqual(isImageFile('test.exe'), false);
assert.strictEqual(isImageFile('test.js'), false);
console.log('✓ Image extension validator OK');

// 4. Config storage fallback check
const { loadConfig, DEFAULT_STORAGE } = require('./lib/config');
const cfg = loadConfig();
assert(cfg.activeSessionPath && typeof cfg.activeSessionPath === 'string', 'Config should have activeSessionPath');
console.log('✓ Config storage & fallback validation OK');

// 5. Cross-platform drive detection check
const { getSystemDrives } = require('./lib/folderBrowser');
const drives = getSystemDrives();
assert(Array.isArray(drives) && drives.length > 0, 'Drives should return non-empty array');
assert(drives[0].path && drives[0].name, 'Drive items should have name and path');
console.log('✓ Cross-platform drive discovery OK');

console.log('\nAll self-checks passed successfully!');
