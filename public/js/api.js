/**
 * RTFTP Studio - API & WebSocket Client Connector
 */

class RTFTPApi {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.isConnected = false;
  }

  // REST API Methods
  async getSession(stationId = null, sessionPath = null) {
    const params = new URLSearchParams();
    if (stationId) params.append('station', stationId);
    if (sessionPath) params.append('session', sessionPath);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/session${qs}`);
    return await res.json();
  }

  async getNetwork() {
    const res = await fetch('/api/network');
    return await res.json();
  }

  async getPhotos(stationId = null, sessionPath = null) {
    const params = new URLSearchParams();
    if (stationId) params.append('station', stationId);
    if (sessionPath) params.append('session', sessionPath);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/photos${qs}`);
    return await res.json();
  }

  async getSelections(stationId = null, sessionPath = null) {
    const params = new URLSearchParams();
    if (stationId) params.append('station', stationId);
    if (sessionPath) params.append('session', sessionPath);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/selections${qs}`);
    return await res.json();
  }

  async setSelection(filename, selected, sizes = null, notes = '', sessionPath = null) {
    const res = await fetch('/api/selections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, selected, sizes, notes, sessionPath })
    });
    return await res.json();
  }

  async clearSelections(sessionPath = null) {
    const res = await fetch('/api/selections/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionPath })
    });
    return await res.json();
  }

  async setSessionFolder(folderPath) {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath })
    });
    return await res.json();
  }

  async exportPrint(sessionPath = null, exportAll = false) {
    const res = await fetch('/api/print/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionPath, exportAll })
    });
    return await res.json();
  }

  async generateDemo() {
    const res = await fetch('/api/demo/generate', { method: 'POST' });
    return await res.json();
  }

  // Folder Browser API Methods
  async getOperatorDrives() {
    const res = await fetch('/api/operator/drives');
    return await res.json();
  }

  async browseDirectory(targetPath = '') {
    const url = targetPath ? `/api/operator/browse-dir?path=${encodeURIComponent(targetPath)}` : '/api/operator/browse-dir';
    const res = await fetch(url);
    return await res.json();
  }

  async createFolder(parentPath, folderName) {
    const res = await fetch('/api/operator/create-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentPath, folderName })
    });
    return await res.json();
  }

  async openNativePicker(initialDir = '') {
    const res = await fetch('/api/operator/open-native-picker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialDir })
    });
    return await res.json();
  }

  // Workstation / Client Station Management API
  async getStations() {
    const res = await fetch('/api/operator/stations');
    return await res.json();
  }

  async addStation(name, type = 'lan', note = '') {
    const res = await fetch('/api/operator/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, note })
    });
    return await res.json();
  }

  async removeStation(stationId) {
    const res = await fetch(`/api/operator/stations/${encodeURIComponent(stationId)}`, {
      method: 'DELETE'
    });
    return await res.json();
  }

  async updateStation(stationId, updates) {
    const res = await fetch(`/api/operator/stations/${encodeURIComponent(stationId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return await res.json();
  }

  async reloadStation(stationId) {
    const res = await fetch(`/api/operator/stations/${encodeURIComponent(stationId)}/reload`, {
      method: 'POST'
    });
    return await res.json();
  }

  async assignStationSession(stationId, sessionPath) {
    const res = await fetch(`/api/operator/stations/${encodeURIComponent(stationId)}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionPath })
    });
    return await res.json();
  }

  // Dedicated Session Directory Management API
  async getDirectorySessions() {
    const res = await fetch('/api/operator/directory/sessions');
    return await res.json();
  }

  async createSession(name, rootDir = '', setAsActive = true) {
    const res = await fetch('/api/operator/directory/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rootDir, setAsActive })
    });
    return await res.json();
  }

  async openInExplorer(folderPath = '') {
    const res = await fetch('/api/operator/directory/open-explorer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath })
    });
    return await res.json();
  }

  async setRootDirectory(rootPath) {
    const res = await fetch('/api/operator/directory/set-root', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath })
    });
    return await res.json();
  }

  // Session Timer & Customer Pacing API
  async getTimer() {
    const res = await fetch('/api/timer');
    return await res.json();
  }

  async startTimer(durationMinutes = null) {
    const res = await fetch('/api/timer/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationMinutes })
    });
    return await res.json();
  }

  async pauseTimer() {
    const res = await fetch('/api/timer/pause', { method: 'POST' });
    return await res.json();
  }

  async resumeTimer() {
    const res = await fetch('/api/timer/resume', { method: 'POST' });
    return await res.json();
  }

  async addTimerTime(minutes = 5) {
    const res = await fetch('/api/timer/add-time', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutes })
    });
    return await res.json();
  }

  async resetTimer() {
    const res = await fetch('/api/timer/reset', { method: 'POST' });
    return await res.json();
  }

  async stopTimer() {
    const res = await fetch('/api/timer/stop', { method: 'POST' });
    return await res.json();
  }

  async updateTimerSettings(settings) {
    const res = await fetch('/api/timer/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return await res.json();
  }

  // WebSocket Methods
  connectWebSocket(onStatusChange = null, stationId = null) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (!stationId && typeof window !== 'undefined' && window.location) {
      const p = new URLSearchParams(window.location.search);
      stationId = p.get('station') || null;
    }
    const qs = stationId ? `?station=${encodeURIComponent(stationId)}` : '';
    const wsUrl = `${protocol}//${window.location.host}${qs}`;

    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnected = true;
      console.log('[RTFTP] WebSocket connected');
      if (onStatusChange) onStatusChange(true);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      console.warn('[RTFTP] WebSocket disconnected. Reconnecting in 2s...');
      if (onStatusChange) onStatusChange(false);
      this.reconnectTimer = setTimeout(() => this.connectWebSocket(onStatusChange), 2000);
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.trigger(msg.type, msg);
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };
  }

  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type).push(callback);
  }

  trigger(type, data) {
    const handlers = this.listeners.get(type);
    if (handlers) {
      handlers.forEach(fn => fn(data));
    }
  }
}

window.api = new RTFTPApi();
