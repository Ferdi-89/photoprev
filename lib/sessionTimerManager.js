/**
 * RTFTP Studio - Session Timer & Customer Pacing Engine
 * Manages customer photo selection countdown, warnings, pauses, extensions, and expiry state.
 */

const { saveConfig } = require('./config');

class SessionTimerManager {
  constructor() {
    this.config = null;
    this.broadcast = null;
    this.intervalId = null;

    // Runtime state
    this.state = {
      enabled: false,
      isRunning: false,
      isPaused: false,
      isExpired: false,
      totalSeconds: 900,
      remainingSeconds: 900,
      durationMinutes: 15,
      warningThresholdMinutes: 3,
      lockOnExpiry: false,
      autoStartOnSessionChange: false,
      messageOnExpiry: 'Waktu sesi pemilihan foto telah selesai. Tim studio kami siap membantu menyelesaikan pesanan cetak Anda.',
      startedAt: null,
      pausedAt: null
    };
  }

  init(config, broadcastFn) {
    this.config = config;
    this.broadcast = broadcastFn;

    const saved = config.sessionTimer || {};
    this.state.enabled = saved.enabled ?? false;
    this.state.durationMinutes = saved.durationMinutes ?? 15;
    this.state.warningThresholdMinutes = saved.warningThresholdMinutes ?? 3;
    this.state.lockOnExpiry = saved.lockOnExpiry ?? false;
    this.state.autoStartOnSessionChange = saved.autoStartOnSessionChange ?? false;
    if (saved.messageOnExpiry) {
      this.state.messageOnExpiry = saved.messageOnExpiry;
    }

    this.state.totalSeconds = Math.max(60, this.state.durationMinutes * 60);
    this.state.remainingSeconds = this.state.totalSeconds;
  }

  getState() {
    const isWarning = this.state.remainingSeconds <= (this.state.warningThresholdMinutes * 60) && this.state.remainingSeconds > 0;
    return {
      ...this.state,
      formattedTime: this.formatTime(this.state.remainingSeconds),
      isWarning
    };
  }

  formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  start({ durationMinutes } = {}) {
    if (durationMinutes && Number(durationMinutes) > 0) {
      this.state.durationMinutes = Number(durationMinutes);
    }
    this.state.totalSeconds = this.state.durationMinutes * 60;
    this.state.remainingSeconds = this.state.totalSeconds;
    this.state.isRunning = true;
    this.state.isPaused = false;
    this.state.isExpired = false;
    this.state.startedAt = Date.now();
    this.state.pausedAt = null;

    this._startTicker();
    this._broadcastEvent('TIMER_STARTED');
    return this.getState();
  }

  pause() {
    if (!this.state.isRunning || this.state.isPaused || this.state.isExpired) return this.getState();
    this.state.isPaused = true;
    this.state.pausedAt = Date.now();
    this._stopTicker();
    this._broadcastEvent('TIMER_PAUSED');
    return this.getState();
  }

  resume() {
    if (!this.state.isRunning || !this.state.isPaused || this.state.isExpired) return this.getState();
    this.state.isPaused = false;
    this.state.pausedAt = null;
    this._startTicker();
    this._broadcastEvent('TIMER_RESUMED');
    return this.getState();
  }

  addTime(minutes = 5) {
    const additionalSec = Math.max(60, Number(minutes) * 60);
    this.state.remainingSeconds += additionalSec;
    this.state.totalSeconds += additionalSec;

    // If it was expired, un-expire and resume
    if (this.state.isExpired) {
      this.state.isExpired = false;
      this.state.isRunning = true;
      this.state.isPaused = false;
      this._startTicker();
    }

    this._broadcastEvent('TIMER_EXTENDED', { addedMinutes: minutes });
    return this.getState();
  }

  reset() {
    this._stopTicker();
    this.state.totalSeconds = this.state.durationMinutes * 60;
    this.state.remainingSeconds = this.state.totalSeconds;
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.state.isExpired = false;
    this.state.startedAt = null;
    this.state.pausedAt = null;
    this._broadcastEvent('TIMER_RESET');
    return this.getState();
  }

  stop() {
    this._stopTicker();
    this.state.isRunning = false;
    this.state.isPaused = false;
    this._broadcastEvent('TIMER_STOPPED');
    return this.getState();
  }

  updateSettings(settings = {}) {
    if (typeof settings.enabled === 'boolean') this.state.enabled = settings.enabled;
    if (settings.durationMinutes && Number(settings.durationMinutes) > 0) {
      this.state.durationMinutes = Number(settings.durationMinutes);
      if (!this.state.isRunning) {
        this.state.totalSeconds = this.state.durationMinutes * 60;
        this.state.remainingSeconds = this.state.totalSeconds;
      }
    }
    if (settings.warningThresholdMinutes !== undefined) {
      this.state.warningThresholdMinutes = Number(settings.warningThresholdMinutes);
    }
    if (typeof settings.lockOnExpiry === 'boolean') {
      this.state.lockOnExpiry = settings.lockOnExpiry;
    }
    if (typeof settings.autoStartOnSessionChange === 'boolean') {
      this.state.autoStartOnSessionChange = settings.autoStartOnSessionChange;
    }
    if (typeof settings.messageOnExpiry === 'string') {
      this.state.messageOnExpiry = settings.messageOnExpiry.trim();
    }

    if (this.config) {
      this.config.sessionTimer = {
        enabled: this.state.enabled,
        durationMinutes: this.state.durationMinutes,
        warningThresholdMinutes: this.state.warningThresholdMinutes,
        lockOnExpiry: this.state.lockOnExpiry,
        autoStartOnSessionChange: this.state.autoStartOnSessionChange,
        messageOnExpiry: this.state.messageOnExpiry
      };
      saveConfig({ sessionTimer: this.config.sessionTimer });
    }

    this._broadcastEvent('TIMER_SETTINGS_UPDATED');
    return this.getState();
  }

  onSessionChanged() {
    if (this.state.enabled && this.state.autoStartOnSessionChange) {
      this.start();
    } else {
      this.reset();
    }
  }

  _startTicker() {
    this._stopTicker();
    this.intervalId = setInterval(() => {
      if (!this.state.isRunning || this.state.isPaused) return;

      this.state.remainingSeconds = Math.max(0, this.state.remainingSeconds - 1);

      if (this.state.remainingSeconds <= 0) {
        this.state.remainingSeconds = 0;
        this.state.isExpired = true;
        this.state.isRunning = false;
        this._stopTicker();
        this._broadcastEvent('TIMER_EXPIRED');
      } else {
        this._broadcastEvent('TIMER_TICK');
      }
    }, 1000);
  }

  _stopTicker() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  _broadcastEvent(type, extra = {}) {
    if (typeof this.broadcast === 'function') {
      this.broadcast({
        type,
        timer: this.getState(),
        ...extra
      });
    }
  }
}

const sessionTimerManager = new SessionTimerManager();
module.exports = sessionTimerManager;
