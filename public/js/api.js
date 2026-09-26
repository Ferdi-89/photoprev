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
  async getSession() {
    const res = await fetch('/api/session');
    return await res.json();
  }

  async getNetwork() {
    const res = await fetch('/api/network');
    return await res.json();
  }

  async getPhotos() {
    const res = await fetch('/api/photos');
    return await res.json();
  }

  async getSelections() {
    const res = await fetch('/api/selections');
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

  // WebSocket Methods
  connectWebSocket(onStatusChange = null) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnected = true;
      console.log('⚡ Connected to RTFTP WebSocket');
      if (onStatusChange) onStatusChange(true);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      console.warn('⚠️ WebSocket disconnected. Reconnecting in 2s...');
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
