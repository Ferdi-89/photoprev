/**
 * RTFTP Studio - Unified Toast & Dialog Engine
 * Provides studio-grade microinteractions, feedback pills, and custom confirm dialogs.
 */
class StudioFeedback {
  constructor() {
    this.container = null;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    let container = document.getElementById('studio-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'studio-toast-container';
      container.className = 'studio-toast-container';
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', 'Notifikasi Studio');
      document.body.appendChild(container);
    }
    this.container = container;
  }

  showToast(message, type = 'info', duration = 3200) {
    if (!this.container) this.init();

    const toast = document.createElement('div');
    toast.className = `studio-toast toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    const icons = {
      blue: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`,
      success: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
      warning: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      warn: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      danger: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
      error: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
      info: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    const iconSvg = icons[type] || icons.info;

    toast.innerHTML = `
      <span class="toast-icon-badge" aria-hidden="true">${iconSvg}</span>
      <span class="toast-text">${message}</span>
      <button class="toast-close-btn" aria-label="Tutup notifikasi">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    this.container.prepend(toast);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (window.gsap && !prefersReducedMotion) {
      gsap.fromTo(toast,
        { autoAlpha: 0, y: 16, scale: 0.94 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.22, ease: "power2.out", clearProps: "transform,opacity,visibility" }
      );
    }

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      if (window.gsap && !prefersReducedMotion) {
        gsap.to(toast, {
          autoAlpha: 0,
          y: -10,
          scale: 0.94,
          duration: 0.18,
          ease: "power2.in",
          onComplete: () => toast.remove()
        });
      } else {
        toast.remove();
      }
    };

    const closeBtn = toast.querySelector('.toast-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
    });

    toast.addEventListener('click', dismiss);

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }

  showConfirm(title, message, confirmText = 'Lanjutkan', isDestructive = false) {
    return new Promise((resolve) => {
      let modal = document.getElementById('studio-confirm-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'studio-confirm-modal';
        modal.className = 'modal-overlay';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.innerHTML = `
          <div class="modal-card confirm-dialog-card">
            <div class="confirm-dialog-body">
              <h4 id="confirm-modal-title">Konfirmasi</h4>
              <p id="confirm-modal-desc">Apakah Anda yakin?</p>
            </div>
            <div class="modal-footer">
              <button id="confirm-modal-cancel" class="btn btn-sm">Batal</button>
              <button id="confirm-modal-ok" class="btn btn-sm btn-primary">Lanjutkan</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }

      const titleEl = document.getElementById('confirm-modal-title');
      const descEl = document.getElementById('confirm-modal-desc');
      const cancelBtn = document.getElementById('confirm-modal-cancel');
      const okBtn = document.getElementById('confirm-modal-ok');

      titleEl.textContent = title;
      descEl.textContent = message;
      okBtn.textContent = confirmText;
      okBtn.className = `btn btn-sm ${isDestructive ? 'btn-danger' : 'btn-gold'}`;

      modal.classList.add('active');

      const cleanup = (result) => {
        modal.classList.remove('active');
        cancelBtn.removeEventListener('click', onCancel);
        okBtn.removeEventListener('click', onOk);
        window.removeEventListener('keydown', onKey);
        resolve(result);
      };

      const onCancel = () => cleanup(false);
      const onOk = () => cleanup(true);
      const onKey = (e) => {
        if (e.key === 'Escape') cleanup(false);
      };

      cancelBtn.addEventListener('click', onCancel);
      okBtn.addEventListener('click', onOk);
      window.addEventListener('keydown', onKey);
    });
  }
}

window.studioFeedback = new StudioFeedback();
window.showToast = (msg, type = 'info', duration = 3200) => window.studioFeedback.showToast(msg, type, duration);
window.showConfirm = (title, msg, confirmText, isDestructive) => window.studioFeedback.showConfirm(title, msg, confirmText, isDestructive);
