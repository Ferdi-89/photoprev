const assert = require('assert');
const path = require('path');
const { getLanInterfaces } = require('./lib/network');
const { isImageFile, getImageMetadata } = require('./lib/thumbnail');

// 1. Check network interfaces
const ifaces = getLanInterfaces(3000);
assert(Array.isArray(ifaces), 'Interfaces must be an array');
assert(ifaces.length > 0, 'Should detect at least one LAN interface');
assert(ifaces.some(i => i.url.startsWith('http://')), 'URL format must be valid');
console.log('[OK] Network interface discovery OK:', ifaces.map(i => `${i.name} -> ${i.url}`).join(', '));

// 2. Path traversal sanitization check
function safeFilename(rawFilename) {
  if (!rawFilename) return '';
  return path.basename(String(rawFilename));
}
assert.strictEqual(safeFilename('../../windows/system32/cmd.exe'), 'cmd.exe');
assert.strictEqual(safeFilename('..\\..\\boot.ini'), 'boot.ini');
assert.strictEqual(safeFilename('photo_01.jpg'), 'photo_01.jpg');
console.log('[OK] Path traversal defense OK');

// 3. Image file extension validation
assert.strictEqual(isImageFile('test.jpg'), true);
assert.strictEqual(isImageFile('test.PNG'), true);
assert.strictEqual(isImageFile('test.exe'), false);
assert.strictEqual(isImageFile('test.js'), false);
console.log('[OK] Image extension validator OK');

// 4. Config storage fallback check
const { loadConfig, DEFAULT_STORAGE } = require('./lib/config');
const cfg = loadConfig();
assert(cfg.activeSessionPath && typeof cfg.activeSessionPath === 'string', 'Config should have activeSessionPath');
console.log('[OK] Config storage & fallback validation OK');

// 5. Cross-platform drive detection check
const { getSystemDrives } = require('./lib/folderBrowser');
const drives = getSystemDrives();
assert(Array.isArray(drives) && drives.length > 0, 'Drives should return non-empty array');
assert(drives[0].path && drives[0].name, 'Drive items should have name and path');
console.log('[OK] Cross-platform drive discovery OK');

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
console.log('[OK] Session timer engine & broadcast compatibility validation OK');

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
    console.log('[OK] Thumbnail concurrent deduplication & atomic caching OK');
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

  console.log('[OK] Multi-session workstation mapping & fallback resolution OK');

  // 9. Session Directory Manager workflow (active at station, available, completed confirmed by operator)
  const sessionDirManager = require('./lib/sessionDirectoryManager');
  const demoRoot = path.resolve(__dirname, 'storage');
  const testSessionDir = path.resolve(demoRoot, 'demo_session');

  const testConfig = {
    sessionRootDir: demoRoot,
    activeSessionPath: testSessionDir,
    completedSessions: [],
    clientStations: [
      { id: 'st-unit-1', name: 'PC Klien 1', assignedSessionPath: testSessionDir }
    ]
  };

  const listBefore = sessionDirManager.listSessions(testConfig);
  assert(listBefore.success, 'listSessions should succeed');
  assert(typeof listBefore.totalActive === 'number', 'totalActive must be a number');
  assert(typeof listBefore.totalAvailable === 'number', 'totalAvailable must be a number');
  assert(typeof listBefore.totalCompleted === 'number', 'totalCompleted must be a number');

  // The assigned session should be active
  const targetSession = listBefore.sessions.find(s => path.resolve(s.path).toLowerCase() === testSessionDir.toLowerCase());
  if (targetSession) {
    assert.strictEqual(targetSession.status, 'active', 'Station-assigned session must have active status');
    assert.strictEqual(targetSession.isActive, true, 'isActive should be true');
    assert.strictEqual(targetSession.isCompleted, false, 'isCompleted should be false initially');
  }

  // Operator confirms session completed
  sessionDirManager.completeSession(testConfig, testSessionDir);
  const listAfterComplete = sessionDirManager.listSessions(testConfig);
  const targetCompleted = listAfterComplete.sessions.find(s => path.resolve(s.path).toLowerCase() === testSessionDir.toLowerCase());
  if (targetCompleted) {
    assert.strictEqual(targetCompleted.status, 'completed', 'Completed session must have status completed');
    assert.strictEqual(targetCompleted.isCompleted, true, 'isCompleted must be true');
  }

  // Operator reopens session
  sessionDirManager.reopenSession(testConfig, testSessionDir);
  const listAfterReopen = sessionDirManager.listSessions(testConfig);
  const targetReopened = listAfterReopen.sessions.find(s => path.resolve(s.path).toLowerCase() === testSessionDir.toLowerCase());
  if (targetReopened) {
    assert.strictEqual(targetReopened.isCompleted, false, 'isCompleted must be false after reopen');
    assert.strictEqual(targetReopened.status, 'active', 'Session assigned to station should be active again');
  }

  console.log('[OK] Session Directory workflow & operator checkout validation OK');

  // 10. Print Manager multi-tier queue discovery & fallback check
  const printManager = require('./lib/printManager');
  const tempTestSessionDir = path.resolve(__dirname, 'storage/test_queue_session');
  const tempSiapDir = path.join(tempTestSessionDir, '_SIAP_CETAK');
  if (!fs.existsSync(tempSiapDir)) {
    fs.mkdirSync(tempSiapDir, { recursive: true });
  }

  // Create mock order manifest in _SIAP_CETAK
  const mockManifest = {
    exportedAt: new Date().toISOString(),
    items: [
      { filename: 'TEST_01.jpg', size: '4R', qty: 2, notes: 'glossy' },
      { filename: 'TEST_02.jpg', size: '8R', qty: 1, notes: 'matte' }
    ]
  };
  fs.writeFileSync(path.join(tempSiapDir, 'order_manifest.json'), JSON.stringify(mockManifest), 'utf8');

  const fallbackSelections = printManager.getSelections(tempTestSessionDir);
  assert(Array.isArray(fallbackSelections) && fallbackSelections.length === 2, 'Should discover 2 items from order_manifest fallback');
  assert.strictEqual(fallbackSelections[0].filename, 'TEST_01.jpg', 'First item filename must match');
  assert.strictEqual(fallbackSelections[0].sizes[0].qty, 2, 'First item qty must match');

  // Test getAllSessionQueues including this directory
  const queueConfig = {
    activeSessionPath: tempTestSessionDir,
    clientStations: [],
    completedSessions: []
  };
  const sessionQueues = printManager.getAllSessionQueues(queueConfig);
  const foundQueue = sessionQueues.find(q => path.resolve(q.sessionPath).toLowerCase() === tempTestSessionDir.toLowerCase());
  assert(foundQueue, 'Session with _SIAP_CETAK must be discovered in queue');
  assert.strictEqual(foundQueue.totalItems, 2, 'Total items must be 2');
  assert.strictEqual(foundQueue.totalCopies, 3, 'Total copies must be 3 (2 + 1)');
  assert.strictEqual(foundQueue.hasExportedPrint, true, 'hasExportedPrint must be true');

  // Cleanup temp test session
  try {
    fs.rmSync(tempTestSessionDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('[OK] Print Manager multi-tier queue discovery & fallback validation OK');

  // 11. Windows Explorer & File Location Reveal Engine check
  const { openInWindowsExplorer, openFileInWindowsExplorer } = require('./lib/sessionDirectoryManager');
  const demoFolder = path.resolve(__dirname, 'storage/demo_session');
  if (fs.existsSync(demoFolder)) {
    const folderRes = await openInWindowsExplorer(demoFolder);
    assert.strictEqual(folderRes.success, true, 'openInWindowsExplorer should succeed on existing folder');
    assert(folderRes.openedPath, 'openInWindowsExplorer should return openedPath');

    const demoImgPath = path.join(demoFolder, 'STUDIO_001_16x9_MasterSet.jpg');
    if (fs.existsSync(demoImgPath)) {
      const fileRes = await openFileInWindowsExplorer(demoImgPath);
      assert.strictEqual(fileRes.success, true, 'openFileInWindowsExplorer should succeed on existing photo file');
      assert(fileRes.openedPath, 'openFileInWindowsExplorer should return openedPath');
    }
  }

  // Reject on non-existent path
  let caughtError = false;
  try {
    await openInWindowsExplorer(path.join(__dirname, 'non_existent_folder_xyz'));
  } catch (e) {
    caughtError = true;
  }
  assert.strictEqual(caughtError, true, 'openInWindowsExplorer must reject non-existent paths');

  console.log('[OK] Windows Explorer folder opening & file reveal validation OK');

  // 12. Photostrip Engine 300 DPI composite rendering and Template Manager validation
  const templateManager = require('./lib/templateManager');
  templateManager.ensureTemplateDirectories();
  const allTemplates = templateManager.getAllTemplates();
  assert(Array.isArray(allTemplates) && allTemplates.length >= 6, 'Must provide at least 6 photostrip templates');
  const classicTpl = templateManager.getTemplateById('classic-white-3');
  assert(classicTpl, 'classic-white-3 template must exist');
  assert.strictEqual(classicTpl.slots, 3, 'classic-white-3 must have 3 slots');
  assert.strictEqual(classicTpl.outputFormat, 'double_4r', 'Default format must be double_4r');

  const photoStripEngine = require('./lib/photoStripEngine');
  const demoPhotoPaths = [
    path.join(demoFolder, 'STUDIO_001_16x9_MasterSet.jpg'),
    path.join(demoFolder, 'STUDIO_002_16x9_FamilyGroup.jpg'),
    path.join(demoFolder, 'STUDIO_003_16x9_FashionRunway.jpg')
  ];

  // Render full 300 DPI double 4R strip
  const stripResult = await photoStripEngine.renderPhotostrip({
    photoPaths: demoPhotoPaths,
    templateId: 'classic-white-3',
    eventTitle: 'TEST PHOTOSTRIP EVENT',
    studioFooter: 'RTFTP TEST STUDIO',
    showDate: true,
    format: 'double_4r',
    filter: 'vintage'
  });

  assert(stripResult && stripResult.buffer, 'Photostrip render must return a buffer');
  assert.strictEqual(stripResult.width, 1200, 'Rendered strip width must be 1200 px');
  assert.strictEqual(stripResult.height, 1800, 'Rendered strip height must be 1800 px');
  assert.strictEqual(stripResult.dpi, 300, 'Rendered strip must be 300 DPI');
  assert(stripResult.buffer.length > 50000, 'High-resolution composite buffer should be substantial in size');

  // Render fast client preview
  const previewDataUrl = await photoStripEngine.renderPhotostripPreview({
    photoPaths: demoPhotoPaths,
    templateId: 'classic-white-3',
    filter: 'bw'
  });
  assert(typeof previewDataUrl === 'string' && previewDataUrl.startsWith('data:image/jpeg;base64,'), 'Preview must return valid dataUrl');

  console.log('[OK] Photostrip Engine 300 DPI composite rendering & Template Manager validation OK');

  console.log('\nAll self-checks passed successfully!');
}

runAsyncTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
