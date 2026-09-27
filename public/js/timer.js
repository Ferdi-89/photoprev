/**
 * RTFTP Studio - Client Session Countdown Timer & Customer Pacing Engine
 * Synchronizes client countdown with server ticker and presents polite or strict expiry dialogs.
 */

class SessionTimerClient {
  constructor() {
    this.badge = document.getElementById('client-session-timer');
    this.digits = document.getElementById('client-timer-digits');
    this.modal = document.getElementById('client-timer-modal');
    this.modalCard = document.querySelector('.client-timer-card');
    this.modalTitle = document.getElementById('client-timer-modal-title');
    this.modalDesc = document.getElementById('client-timer-modal-desc');
    this.statCount = document.getElementById('client-timer-modal-count');
    this.strictNotice = document.getElementById('client-timer-strict-notice');
    this.btnReview = document.getElementById('btn-timer-review-selection');
    this.btnDismiss = document.getElementById('btn-timer-dismiss-dialog');

    this.timerState = null;
    this.hasShownExpiryModal = false;

    this.init();
  }

  async init() {
    this.bindDOMEvents();
    this.bindWebSocketEvents();

    // Fetch initial state
    try {
      const res = await window.api.getTimer();
      if (res && res.success && res.data) {
        this.handleTimerState(res.data);
      }
    } catch (err) {
      console.warn('Gagal memuat status timer awal di klien:', err);
    }
  }

  bindDOMEvents() {
    if (this.btnReview) {
      this.btnReview.addEventListener('click', () => {
        this.hideExpiryModal();
        if (window.selectionManager && typeof window.selectionManager.openModal === 'function') {
          window.selectionManager.openModal();
        }
      });
    }

    if (this.btnDismiss) {
      this.btnDismiss.addEventListener('click', () => {
        this.hideExpiryModal();
      });
    }
  }

  bindWebSocketEvents() {
    window.api.on('INIT', (data) => {
      if (data && data.timer) {
        this.handleTimerState(data.timer);
      }
    });

    window.api.on('TIMER_TICK', (data) => {
      this.handleTimerTick(data);
    });

    window.api.on('TIMER_STARTED', (data) => {
      this.hasShownExpiryModal = false;
      this.hideExpiryModal();
      this.handleTimerState(data);
    });

    window.api.on('TIMER_PAUSED', (data) => {
      this.handleTimerState(data);
    });

    window.api.on('TIMER_RESUMED', (data) => {
      this.handleTimerState(data);
    });

    window.api.on('TIMER_EXTENDED', (data) => {
      this.hasShownExpiryModal = false;
      this.hideExpiryModal();
      this.handleTimerState(data);
      if (window.showToast) {
        window.showToast(`Operator memberikan tambahan waktu +${data.addedMinutes} menit`, 'success', 4000);
      }
    });

    window.api.on('TIMER_RESET', (data) => {
      this.hasShownExpiryModal = false;
      this.hideExpiryModal();
      this.handleTimerState(data);
    });

    window.api.on('TIMER_STOPPED', (data) => {
      this.hasShownExpiryModal = false;
      this.hideExpiryModal();
      this.handleTimerState(data);
    });

    window.api.on('TIMER_EXPIRED', (data) => {
      this.handleTimerState(data);
      this.showExpiryModal();
    });

    window.api.on('TIMER_SETTINGS_UPDATED', (data) => {
      this.handleTimerState(data);
    });
  }

  handleTimerTick(data) {
    if (!data) return;
    this.timerState = data;

    if (this.digits) {
      this.digits.textContent = data.formattedTime || '00:00';
    }

    if (this.badge) {
      this.badge.classList.toggle('is-warning', !!data.isWarning);
      this.badge.classList.toggle('is-expired', !!data.isExpired);
      this.badge.classList.toggle('is-paused', !!data.isPaused);
    }
  }

  handleTimerState(data) {
    if (!data) return;
    this.timerState = data;

    if (!data.enabled) {
      if (this.badge) this.badge.style.display = 'none';
      this.hideExpiryModal();
      return;
    }

    if (this.badge) {
      this.badge.style.display = 'inline-flex';
    }

    this.handleTimerTick(data);

    if (data.isExpired && !this.hasShownExpiryModal) {
      this.showExpiryModal();
    }
  }

  showExpiryModal() {
    if (!this.modal) return;

    const isStrict = this.timerState && this.timerState.lockOnExpiry;

    if (this.modalCard) {
      this.modalCard.classList.toggle('is-strict', !!isStrict);
    }

    if (this.modalTitle) {
      this.modalTitle.textContent = isStrict ? 'Sesi Pemilihan Foto Selesai' : 'Waktu Pemilihan Selesai';
    }

    if (this.modalDesc) {
      const msg = this.timerState && this.timerState.messageOnExpiry
        ? this.timerState.messageOnExpiry
        : 'Waktu sesi pemilihan foto telah selesai. Tim studio kami siap membantu menyelesaikan pesanan cetak Anda.';
      this.modalDesc.textContent = msg;
    }

    if (this.statCount) {
      const count = window.selectionManager ? window.selectionManager.selectedPhotos.size : 0;
      this.statCount.textContent = `${count} Foto`;
    }

    if (this.strictNotice) {
      this.strictNotice.style.display = isStrict ? 'block' : 'none';
    }

    if (this.btnDismiss) {
      this.btnDismiss.style.display = isStrict ? 'none' : 'inline-flex';
    }

    this.modal.style.display = 'flex';
    requestAnimationFrame(() => {
      this.modal.classList.add('active');
    });

    this.hasShownExpiryModal = true;
  }

  hideExpiryModal() {
    if (!this.modal) return;
    this.modal.classList.remove('active');
    setTimeout(() => {
      if (!this.modal.classList.contains('active')) {
        this.modal.style.display = 'none';
      }
    }, 200);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.sessionTimerClient = new SessionTimerClient();
});
