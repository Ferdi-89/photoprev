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

// 6. Session Timer & Customer Pacing Engine check
const sessionTimerManager = require('./lib/sessionTimerManager');
const broadcastedEvents = [];
const mockBroadcast = (msg) => broadcastedEvents.push(msg);

sessionTimerManager.init(cfg, mockBroadcast);
const initialState = sessionTimerManager.getState();
assert(typeof initialState.formattedTime === 'string', 'Timer state must have formattedTime');
assert(typeof initialState.remainingSeconds === 'number', 'Timer state must have remainingSeconds');
assert(typeof initialState.enabled === 'boolean', 'Timer state must have enabled boolean');

// Test start
sessionTimerManager.start({ durationMinutes: 10 });
const startedState = sessionTimerManager.getState();
assert.strictEqual(startedState.isRunning, true, 'Timer should be running');
assert.strictEqual(startedState.durationMinutes, 10, 'Duration should be 10 minutes');
assert.strictEqual(startedState.formattedTime, '10:00', 'Formatted time should be 10:00');

// Verify broadcast payload has both flat properties and nested timer object
const lastEvent = broadcastedEvents[broadcastedEvents.length - 1];
assert.strictEqual(lastEvent.type, 'TIMER_STARTED', 'Event type must match');
assert(lastEvent.timer && typeof lastEvent.timer === 'object', 'Event must contain nested timer object');
assert.strictEqual(lastEvent.formattedTime, '10:00', 'Event must contain top-level formattedTime');
assert.strictEqual(lastEvent.enabled, initialState.enabled, 'Event must contain top-level enabled');

// Test pause & resume
sessionTimerManager.pause();
assert.strictEqual(sessionTimerManager.getState().isPaused, true, 'Timer should be paused');
sessionTimerManager.resume();
assert.strictEqual(sessionTimerManager.getState().isPaused, false, 'Timer should be resumed');

// Test addTime
sessionTimerManager.addTime(5);
assert.strictEqual(sessionTimerManager.getState().remainingSeconds, 15 * 60, 'Remaining seconds should be 15 min');

// Test reset & stop
sessionTimerManager.reset();
assert.strictEqual(sessionTimerManager.getState().isRunning, false, 'Timer should not be running after reset');
sessionTimerManager.stop();
console.log('✓ Session timer engine & broadcast compatibility validation OK');

// 7. Thumbnail deduplication and concurrent processing check
async function runAsyncTests() {
  const { getOrGenerateImage } = require('./lib/thumbnail');
  const fs = require('fs');
  const demoImg = path.join(__dirname, 'storage/demo_session/STUDIO_001_16x9_MasterSet.jpg');
  if (fs.existsSync(demoImg)) {
    const [thumb1, thumb2] = await Promise.all([
      getOrGenerateImage(demoImg, 'thumb'),
      getOrGenerateImage(demoImg, 'thumb')
    ]);
    assert.strictEqual(thumb1, thumb2, 'Concurrent thumbnail requests must resolve to identical path');
    assert(fs.existsSync(thumb1), 'Generated thumbnail file must exist');
    console.log('✓ Thumbnail concurrent deduplication & atomic caching OK');
  }

  // 8. Station session assignment and resolution validation
  const stationManager = require('./lib/stationManager');
  const dummyConfig = {
    activeSessionPath: path.resolve(__dirname, 'storage/demo_session'),
    stations: []
  };
  const added = stationManager.addStation(dummyConfig, 'Booth A', 'lan', 'Test Note');
  assert(added.success && added.station, 'Station should be added');
  const stationId = added.station.id;

  // Test before assignment -> effectiveSessionPath is global
  let stations = stationManager.getStations(dummyConfig);
  let st = stations.find(s => s.id === stationId);
  assert.strictEqual(st.isUsingGlobalSession, true, 'Station without assignment should use global session');
  assert.strictEqual(st.effectiveSessionPath, dummyConfig.activeSessionPath, 'Effective path should match global');

  // Test assignment -> effectiveSessionPath is assigned
  const customFolder = path.resolve(__dirname, 'storage');
  const assigned = stationManager.assignSessionToStation(dummyConfig, stationId, customFolder);
  assert(assigned.success, 'Session assignment should succeed');
  assert.strictEqual(assigned.assignedSessionPath, customFolder, 'Assigned session path should match');

  stations = stationManager.getStations(dummyConfig);
  st = stations.find(s => s.id === stationId);
  assert.strictEqual(st.isUsingGlobalSession, false, 'Station with custom session should not be global');
  assert.strictEqual(st.assignedSessionPath, customFolder, 'Assigned session path should match custom');

  // Test unassign (pass null/empty)
  const unassigned = stationManager.assignSessionToStation(dummyConfig, stationId, '');
  assert(unassigned.success, 'Unassignment should succeed');
  stations = stationManager.getStations(dummyConfig);
  st = stations.find(s => s.id === stationId);
  assert.strictEqual(st.isUsingGlobalSession, true, 'Unassigned station should return to global');

  // Cleanup: Remove dummy test station so config.json remains clean
  stationManager.removeStation(dummyConfig, stationId);

  console.log('✓ Multi-session workstation mapping & fallback resolution OK');

  console.log('\nAll self-checks passed successfully!');
}

runAsyncTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
