/**
 * RTFTP Studio - Operator Control Dashboard Controller
 * Multi-view left-sidebar navigation with persistent real-time WebSocket connection.
 */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

class RTFTPOperator {
  constructor() {
    // Navigation & Views (Desktop Sidebar + Mobile Drawer)
    this.navItems = document.querySelectorAll('.sidebar-nav .nav-item, .mobile-drawer-nav .nav-item');
    this.views = document.querySelectorAll('.operator-view');
    this.navQueueBadge = document.getElementById('nav-queue-badge');
    this.mobileNavQueueBadge = document.getElementById('mobile-nav-queue-badge');

    // Sidebar & Mobile Drawer Elements
    this.sidebar = document.getElementById('operator-sidebar');
    this.btnPinSidebar = document.getElementById('btn-pin-sidebar');
    this.mobileDrawer = document.getElementById('mobile-sidebar-drawer');
    this.btnMobileMenu = document.getElementById('btn-mobile-menu');
    this.btnMobileClose = document.getElementById('btn-mobile-close');
    this.mobileDrawerBackdrop = document.getElementById('mobile-drawer-backdrop');
    this.mobileViewIndicator = document.getElementById('mobile-view-indicator');
    this.mobileStatusText = document.getElementById('mobile-status-text');
    this.sidebarLiveDot = document.getElementById('sidebar-live-dot');
    this.mobileLiveDot = document.getElementById('mobile-live-dot');
    this.btnMobileRefresh = document.getElementById('btn-mobile-refresh');

    // Controls & Displays
    this.sessionPathInput = document.getElementById('session-path-input');
    this.currentPathDisplay = document.getElementById('current-path-display');
    this.statTotalPhotos = document.getElementById('stat-total-photos');
    this.statSelectedPhotos = document.getElementById('stat-selected-photos');
    this.statTotalCopies = document.getElementById('stat-total-copies');
    this.statClientStatus = document.getElementById('stat-client-status');
    this.sidebarStatusText = document.getElementById('sidebar-status-text');

    // Table, Sessions & Console
    this.queueSessionsContainer = document.getElementById('queue-sessions-container');
    this.btnExportAllPrint = document.getElementById('btn-export-all-print');
    this.emptyTableNotice = document.getElementById('empty-selection-notice');
    this.logConsole = document.getElementById('log-console');
    this.sessions = [];

    // Stations Elements
    this.navStationsBadge = document.getElementById('nav-stations-badge');
    this.mobileNavStationsBadge = document.getElementById('mobile-nav-stations-badge');
    this.stationsGrid = document.getElementById('stations-grid');
    this.statTotalStations = document.getElementById('stat-total-stations');
    this.statOnlineStations = document.getElementById('stat-online-stations');
    this.btnAddStation = document.getElementById('btn-add-station');
    this.addStationModal = document.getElementById('add-station-modal');
    this.formAddStation = document.getElementById('form-add-station');
    this.stations = [];
    this.primaryLanUrl = '';

    // Studio Sessions Hub & Filter Elements
    this.navTemplatesBadge = document.getElementById('nav-templates-badge');
    this.mobileNavTemplatesBadge = document.getElementById('mobile-nav-templates-badge');
    this.navSessionsBadge = document.getElementById('nav-sessions-badge') || document.getElementById('nav-directories-badge');
    this.mobileNavSessionsBadge = document.getElementById('mobile-nav-sessions-badge') || document.getElementById('mobile-nav-directories-badge');
    this.navDirectoriesBadge = this.navSessionsBadge;
    this.mobileNavDirectoriesBadge = this.mobileNavSessionsBadge;
    this.dirSessionsGrid = document.getElementById('dir-sessions-grid');
    this.dirEmptySessionsNotice = document.getElementById('dir-empty-sessions-notice');
    this.statActiveSessions = document.getElementById('stat-active-sessions');
    this.statActiveSessionsPill = document.getElementById('stat-active-sessions-pill');
    this.statTotalStationsKpi = document.getElementById('stat-total-stations-kpi');
    this.statDirTotalSessions = document.getElementById('stat-dir-total-sessions');
    this.statDirActiveName = document.getElementById('stat-dir-active-name');
    this.statDirDiskFree = document.getElementById('stat-dir-disk-free');
    this.statDirDiskPercent = document.getElementById('stat-dir-disk-percent');
    this.dirDiskProgress = document.getElementById('dir-disk-progress');
    this.dirDiskWarning = document.getElementById('dir-disk-warning');
    this.dirCurrentRootPath = document.getElementById('dir-current-root-path');
    this.dirSessionsSearch = document.getElementById('dir-sessions-search');
    this.btnRefreshDirSessions = document.getElementById('btn-refresh-dir-sessions');
    this.btnOpenRootExplorer = document.getElementById('btn-open-root-explorer');
    this.btnChangeRootDir = document.getElementById('btn-change-root-dir');
    this.btnOpenCreateSessionModal = document.getElementById('btn-open-create-session-modal');
    this.modalCreateSession = document.getElementById('modal-create-session');
    this.formCreateSession = document.getElementById('form-create-session');
    this.createSessionNameInput = document.getElementById('create-session-name-input');
    this.createSessionActiveCheckbox = document.getElementById('create-session-active-checkbox');
    this.createSessionRootDisplay = document.getElementById('create-session-root-display');
    this.createSessionCloseBtn = document.getElementById('create-session-close-btn');
    this.btnCancelCreateSession = document.getElementById('btn-cancel-create-session');
    this.sessionFilter = 'all';
    this.countFilterAll = document.getElementById('count-filter-all');
    this.countFilterActive = document.getElementById('count-filter-active');
    this.countFilterAvailable = document.getElementById('count-filter-available');
    this.countFilterCompleted = document.getElementById('count-filter-completed');
    this.directorySessions = [];
    this.directoryRootPath = '';

    // Assign Session to Station Modal Elements
    this.modalAssignSession = document.getElementById('modal-assign-station-session');
    this.assignModalCloseBtn = document.getElementById('assign-session-close-btn');
    this.assignModalCancelBtn = document.getElementById('btn-cancel-assign-session');
    this.formAssignSession = document.getElementById('form-assign-session');
    this.assignModalSessionName = document.getElementById('assign-modal-session-name');
    this.assignModalSessionPathText = document.getElementById('assign-modal-session-path-text');
    this.assignModalSessionPath = document.getElementById('assign-modal-session-path');
    this.assignModalStationSelect = document.getElementById('assign-modal-station-select');

    // Operator Checkout Modal Elements (Selesaikan Sesi & Release Station)
    this.modalCheckoutSession = document.getElementById('modal-checkout-session');
    this.formCheckoutSession = document.getElementById('form-checkout-session');
    this.checkoutModalSessionPath = document.getElementById('checkout-modal-session-path');
    this.checkoutModalStationId = document.getElementById('checkout-modal-station-id');
    this.checkoutModalSessionName = document.getElementById('checkout-modal-session-name');
    this.checkoutModalStationsBadge = document.getElementById('checkout-modal-stations-badge');
    this.checkoutModalPhotoCount = document.getElementById('checkout-modal-photo-count');
    this.checkoutModalQueueStatus = document.getElementById('checkout-modal-queue-status');
    this.checkoutModalReleaseStation = document.getElementById('checkout-modal-release-station');
    this.checkoutSessionCloseBtn = document.getElementById('checkout-session-close-btn');
    this.btnCancelCheckoutSession = document.getElementById('btn-cancel-checkout-session');
    this.checkoutSessionBackdrop = document.getElementById('checkout-session-backdrop');

    // Session Timer & Customer Pacing Elements
    this.toggleTimerEnabled = document.getElementById('toggle-timer-enabled');
    this.timerStatusBadge = document.getElementById('timer-status-badge');
    this.operatorTimerActiveContainer = document.getElementById('operator-timer-active-container');
    this.operatorTimerClock = document.getElementById('operator-timer-clock');
    this.operatorTimerStatePill = document.getElementById('operator-timer-state-pill');
    this.operatorTimerProgressFill = document.getElementById('operator-timer-progress-fill');
    this.operatorTimerInfoText = document.getElementById('operator-timer-info-text');
    this.btnTimerStartPause = document.getElementById('btn-timer-start-pause');
    this.iconTimerPlay = document.getElementById('icon-timer-play');
    this.iconTimerPause = document.getElementById('icon-timer-pause');
    this.labelTimerStartPause = document.getElementById('label-timer-start-pause');
    this.btnTimerAdd5 = document.getElementById('btn-timer-add-5');
    this.btnTimerAdd10 = document.getElementById('btn-timer-add-10');
    this.btnTimerReset = document.getElementById('btn-timer-reset');
    this.btnTimerStop = document.getElementById('btn-timer-stop');
    this.formTimerSettings = document.getElementById('form-timer-settings');
    this.timerInputDuration = document.getElementById('timer-input-duration');
    this.timerInputWarning = document.getElementById('timer-input-warning');
    this.timerSelectMode = document.getElementById('timer-select-mode');
    this.timerCheckAutostart = document.getElementById('timer-check-autostart');
    this.timerInputMessage = document.getElementById('timer-input-message');
    this.timerClockBox = document.querySelector('.operator-timer-clock-box');
    this.timerPresetChips = document.querySelectorAll('.btn-timer-chip');
    this.timerState = null;

    this.init();
  }

  async init() {
    this.initViewRouting();
    this.bindEvents();
    this.initFolderPicker();
    this.initStationsManager();
    this.initDirectoryManager();
    this.initSessionTimer();
    this.initPhotostripManager();

    // Connect WebSocket for live updates
    window.api.connectWebSocket((isConnected) => {
      this.updateConnectionStatus(isConnected);
    });

    this.bindWebSocketEvents();
    await this.refreshData();
    await this.loadNetworkInfo();
  }

  /**
   * Render LAN / Wi-Fi Interfaces for Client Tablets
   */
  async loadNetworkInfo() {
    const container = document.getElementById('lan-links-container');
    const copyStatus = document.getElementById('lan-copy-status');
    if (!container) return;

    try {
      const netRes = await window.api.getNetwork();
      if (netRes.success) {
        this.primaryLanUrl = netRes.primaryUrl || (netRes.interfaces && netRes.interfaces[0] ? netRes.interfaces[0].url : `http://${window.location.host}`);
        if (this.stations && this.stations.length > 0) {
          this.renderStations(this.stations);
        }
      }

      if (!netRes.success || !netRes.interfaces || netRes.interfaces.length === 0) {
        container.innerHTML = `
          <div style="color: var(--text-muted); font-size: 0.85rem;">
            Tidak ada IP LAN eksternal terdeteksi. Gunakan <code>http://localhost:${netRes.port || 3000}</code> di PC ini.
          </div>
        `;
        return;
      }

      container.innerHTML = netRes.interfaces.map(iface => {
        const isWifi = iface.isWifi;
        const badgeColor = isWifi ? 'var(--accent-green)' : iface.isEthernet ? 'var(--accent-blue)' : 'var(--text-muted)';
        const badgeText = isWifi ? 'Wi-Fi (Tablet/HP)' : iface.isEthernet ? 'Kabel LAN' : iface.name;

        return `
          <div style="background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 14px; min-width: 260px; flex: 1 1 calc(50% - 12px);">
            <div>
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: ${badgeColor}; border: 1px solid ${badgeColor}; padding: 1px 6px; border-radius: 4px;">${badgeText}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${iface.name}</span>
              </div>
              <a href="${iface.url}" target="_blank" rel="noopener noreferrer" style="font-family: 'JetBrains Mono', monospace; font-size: 0.92rem; color: var(--text-primary); font-weight: 600; text-decoration: none;" title="Buka di tab baru">${iface.url}</a>
            </div>
            <button class="btn btn-sm btn-copy-lan" data-url="${iface.url}" style="padding: 6px 10px; font-size: 0.78rem; white-space: nowrap;">
              Salin Link
            </button>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.btn-copy-lan').forEach(btn => {
        btn.addEventListener('click', () => {
          const url = btn.getAttribute('data-url');
          if (navigator.clipboard && url) {
            navigator.clipboard.writeText(url).then(() => {
              if (copyStatus) {
                copyStatus.style.display = 'block';
                setTimeout(() => { copyStatus.style.display = 'none'; }, 2000);
              }
              btn.textContent = 'Disalin!';
              setTimeout(() => { btn.textContent = 'Salin Link'; }, 2000);
            });
          }
        });
      });
    } catch (err) {
      console.warn('Gagal memuat info jaringan:', err.message);
    }
  }

  /**
   * Single-page view router with URL Hash support
   * Supports: #session (default), #queue, #templates, #logs
   */
  initViewRouting() {
    const viewMap = {
      '#sessions': 'view-sessions',
      '#session': 'view-sessions',
      '#directories': 'view-sessions',
      '#queue': 'view-queue',
      '#templates': 'view-templates',
      '#stations': 'view-stations',
      '#logs': 'view-logs'
    };

    const viewTitles = {
      'view-sessions': 'Sesi Studio',
      'view-queue': 'Antrean Siap Cetak',
      'view-templates': 'Template Strip',
      'view-stations': 'Stasiun & Klien',
      'view-logs': 'Log Aktivitas'
    };

    const switchView = (targetViewId, updateHash = true) => {
      // Toggle View Panels
      this.views.forEach(v => {
        const isActive = v.id === targetViewId;
        v.classList.toggle('active', isActive);
      });

      // Toggle Nav Items across Desktop & Mobile
      this.navItems.forEach(item => {
        const isMatched = item.getAttribute('data-view') === targetViewId;
        item.classList.toggle('active', isMatched);
        item.setAttribute('aria-selected', isMatched ? 'true' : 'false');
      });

      // Update Mobile Header View Indicator Tag
      if (this.mobileViewIndicator && viewTitles[targetViewId]) {
        this.mobileViewIndicator.textContent = viewTitles[targetViewId];
      }

      // Close Mobile Drawer if open
      if (this.closeMobileDrawer) {
        this.closeMobileDrawer();
      }

      if (targetViewId === 'view-queue') {
        this.refreshData();
      } else if (targetViewId === 'view-templates') {
        this.loadPhotostripTemplates();
      }

      if (updateHash) {
        for (const [hash, vId] of Object.entries(viewMap)) {
          if (vId === targetViewId) {
            history.replaceState(null, '', hash);
            break;
          }
        }
      }
    };

    this.switchView = switchView;

    // Delegated click listener for any button with data-switch-view attribute
    document.addEventListener('click', (e) => {
      const switchTrigger = e.target.closest('[data-switch-view]');
      if (switchTrigger) {
        const targetViewId = switchTrigger.getAttribute('data-switch-view');
        if (targetViewId) {
          switchView(targetViewId, true);
        }
      }
    });

    // Nav Item Click Listener (Desktop + Mobile)
    this.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const viewId = item.getAttribute('data-view');
        switchView(viewId, true);
      });
    });

    // Handle Hash Changes
    window.addEventListener('hashchange', () => {
      const targetView = viewMap[window.location.hash] || 'view-sessions';
      switchView(targetView, false);
    });

    // Initial View from Hash
    const initialView = viewMap[window.location.hash] || 'view-sessions';
    switchView(initialView, false);
  }

  log(msg, type = 'info') {
    if (!this.logConsole) return;
    const time = new Date().toLocaleTimeString('id-ID');
    const line = document.createElement('div');
    line.style.padding = '6px 0';
    line.style.fontSize = '0.78rem';
    line.style.borderBottom = '1px solid var(--border-subtle)';
    line.style.display = 'flex';
    line.style.alignItems = 'baseline';
    line.style.gap = '6px';

    let badgeText = 'INFO';
    let badgeBg = 'var(--color-blue-bg)';
    let badgeColor = 'var(--color-blue-text)';
    let badgeBorder = 'var(--color-blue-border)';

    if (type === 'success') {
      badgeText = 'OK';
      badgeBg = 'var(--color-emerald-bg)';
      badgeColor = 'var(--color-emerald-text)';
      badgeBorder = 'var(--color-emerald-border)';
    } else if (type === 'warn') {
      badgeText = 'ALERT';
      badgeBg = 'var(--color-rose-bg)';
      badgeColor = 'var(--color-rose-text)';
      badgeBorder = 'var(--color-rose-border)';
    } else if (type === 'blue') {
      badgeText = 'EVENT';
      badgeBg = 'var(--color-blue-bg)';
      badgeColor = 'var(--color-blue-text)';
      badgeBorder = 'var(--color-blue-border)';
    } else if (type === 'gold' || type === 'amber') {
      badgeText = 'CETAK';
      badgeBg = 'var(--color-amber-bg)';
      badgeColor = 'var(--color-amber-text)';
      badgeBorder = 'var(--color-amber-border)';
    }

    line.innerHTML = `
      <span style="color: var(--text-dim); font-size: 0.72rem; flex-shrink: 0;">${time}</span>
      <span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; padding: 1px 6px; border-radius: var(--radius-xs); font-size: 0.68rem; font-weight: 700; flex-shrink: 0;">${badgeText}</span>
      <span style="color: var(--text-main); flex: 1;">${msg}</span>
    `;
    this.logConsole.appendChild(line);

    if (window.gsap) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion) {
        gsap.from(line, { autoAlpha: 0, x: -6, duration: 0.16, ease: "power1.out", clearProps: "transform,opacity,visibility" });
      }
    }
    this.logConsole.scrollTop = this.logConsole.scrollHeight;
  }

  animateStat(el) {
    if (!el || !window.gsap) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    gsap.fromTo(el,
      { scale: 1 },
      { scale: 1.15, duration: 0.1, yoyo: true, repeat: 1, ease: "power1.out", clearProps: "transform" }
    );
  }

  bindEvents() {
    // Save Folder Path (if legacy input exists)
    const btnSaveFolder = document.getElementById('btn-save-folder');
    if (btnSaveFolder) {
      btnSaveFolder.addEventListener('click', async () => {
        const newPath = this.sessionPathInput ? this.sessionPathInput.value.trim() : '';
        if (!newPath) return window.showToast('Masukkan path folder sesi', 'warning');

        try {
          const res = await window.api.setSessionFolder(newPath);
          if (res.success) {
            this.log(`Folder sesi aktif diubah ke: ${newPath}`, 'success');
            window.showToast('Folder sesi aktif berhasil diperbarui', 'success');
            await this.refreshData();
          } else {
            window.showToast('Gagal mengganti folder: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
      });
    }

    // Active Session Overview: Open in Windows Explorer
    const btnOpenActiveExplorer = document.getElementById('btn-open-active-explorer');
    if (btnOpenActiveExplorer) {
      btnOpenActiveExplorer.addEventListener('click', async (e) => {
        if (e) e.stopPropagation();
        const activePath = this.activeSessionPath || (this.currentPathDisplay ? this.currentPathDisplay.textContent.trim() : '');
        try {
          const res = await window.api.openInExplorer(activePath);
          if (res.success) {
            window.showToast('Membuka folder sesi di Windows Explorer', 'blue');
            this.log(`Membuka folder sesi di Windows Explorer: ${res.openedPath}`, 'info');
          } else {
            window.showToast('Gagal membuka Explorer: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
      });
    }

    // Generate Demo Photos
    document.getElementById('btn-generate-demo').addEventListener('click', async () => {
      try {
        this.log('Sedang membuat 6 foto demo studio berkualitas tinggi...', 'info');
        window.showToast('Membuat 6 foto demo studio...', 'blue', 2000);
        const res = await window.api.generateDemo();
        if (res.success) {
          this.log(res.message, 'success');
          window.showToast(res.message, 'success');
          await this.refreshData();
        } else {
          window.showToast('Gagal membuat demo: ' + res.error, 'danger');
        }
      } catch (e) {
        window.showToast('Error: ' + e.message, 'danger');
      }
    });

    // Export All Sessions to _SIAP_CETAK
    if (this.btnExportAllPrint) {
      this.btnExportAllPrint.addEventListener('click', async () => {
        this.btnExportAllPrint.disabled = true;
        this.btnExportAllPrint.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="spin" aria-hidden="true"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
          Mengekspor Semua Sesi...
        `;

        try {
          const res = await window.api.exportPrint(null, true);
          if (res.success) {
            const count = (res.reports || []).reduce((acc, r) => acc + (r.totalCopies || 0), 0);
            this.log(`BERHASIL: Total ${count} lembar foto diekspor dari semua sesi`, 'success');
            window.showToast(`Sukses! Sebanyak ${count} lembar foto diekspor ke folder _SIAP_CETAK.`, 'success', 5000);
            await this.refreshData();
          } else {
            window.showToast('Gagal mengekspor: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        } finally {
          this.btnExportAllPrint.disabled = false;
          this.btnExportAllPrint.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            Ekspor Semua Sesi ke _SIAP_CETAK
          `;
        }
      });
    }

    // Clear Console
    const clearConsoleBtn = document.getElementById('btn-clear-console');
    if (clearConsoleBtn) {
      clearConsoleBtn.addEventListener('click', () => {
        this.logConsole.innerHTML = '';
        this.log('Layar log dibersihkan oleh operator', 'info');
      });
    }

    // Refresh Button
    document.getElementById('btn-refresh').addEventListener('click', () => {
      this.refreshData();
      this.log('Data sesi diperbarui secara manual', 'info');
    });

    // Sidebar Desktop Hover Expansion & Pin Management (Aceternity Dock GSAP RAF)
    if (this.sidebar) {
      const isMobile = () => window.innerWidth <= 900;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const expandSidebar = () => {
        if (isMobile() || this.sidebar.classList.contains('is-pinned')) return;
        this.sidebar.classList.add('is-expanded');
        if (window.gsap && !prefersReducedMotion) {
          gsap.to(this.sidebar, { width: 270, duration: 0.22, ease: "power2.out", overwrite: "auto" });
        }
      };

      const collapseSidebar = () => {
        if (isMobile() || this.sidebar.classList.contains('is-pinned')) return;
        this.sidebar.classList.remove('is-expanded');
        if (window.gsap && !prefersReducedMotion) {
          gsap.to(this.sidebar, { width: 68, duration: 0.2, ease: "power2.out", overwrite: "auto", clearProps: "width" });
        }
      };

      this.sidebar.addEventListener('mouseenter', expandSidebar);
      this.sidebar.addEventListener('mouseleave', collapseSidebar);

      if (this.btnPinSidebar) {
        const savedPin = localStorage.getItem('rtftp_operator_sidebar_pinned') === 'true';
        if (savedPin) {
          this.sidebar.classList.add('is-pinned');
          this.btnPinSidebar.setAttribute('aria-pressed', 'true');
          if (window.gsap) gsap.set(this.sidebar, { width: 270 });
        }

        this.btnPinSidebar.addEventListener('click', () => {
          const isPinned = this.sidebar.classList.toggle('is-pinned');
          this.btnPinSidebar.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
          try {
            localStorage.setItem('rtftp_operator_sidebar_pinned', isPinned ? 'true' : 'false');
          } catch (e) {}

          if (window.gsap) {
            if (isPinned) {
              this.sidebar.classList.remove('is-expanded');
              gsap.to(this.sidebar, { width: 270, duration: 0.22, ease: "power2.out", overwrite: "auto" });
            } else {
              gsap.to(this.sidebar, { width: 68, duration: 0.2, ease: "power2.out", overwrite: "auto", clearProps: "width" });
            }
          }
        });
      }
    }

    // Mobile Drawer Controls (Aceternity Mobile Sliding Drawer)
    const openMobileDrawer = () => {
      if (!this.mobileDrawer) return;
      this.mobileDrawer.classList.add('active');
      this.mobileDrawer.setAttribute('aria-hidden', 'false');
      if (this.btnMobileMenu) this.btnMobileMenu.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    };

    const closeMobileDrawer = () => {
      if (!this.mobileDrawer) return;
      this.mobileDrawer.classList.remove('active');
      this.mobileDrawer.setAttribute('aria-hidden', 'true');
      if (this.btnMobileMenu) this.btnMobileMenu.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };

    this.closeMobileDrawer = closeMobileDrawer;

    if (this.btnMobileMenu) {
      this.btnMobileMenu.addEventListener('click', openMobileDrawer);
    }

    if (this.btnMobileClose) {
      this.btnMobileClose.addEventListener('click', closeMobileDrawer);
    }

    if (this.mobileDrawerBackdrop) {
      this.mobileDrawerBackdrop.addEventListener('click', closeMobileDrawer);
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.mobileDrawer && this.mobileDrawer.classList.contains('active')) {
        closeMobileDrawer();
      }
    });

    if (this.btnMobileRefresh) {
      this.btnMobileRefresh.addEventListener('click', () => {
        this.refreshData();
        closeMobileDrawer();
        this.log('Data sesi diperbarui via menu mobile', 'info');
      });
    }

    // Unbreakable Global Delegated Click Listener for Explorer & Location Reveal Buttons
    document.addEventListener('click', async (e) => {
      // 1. Session Directory Card "Buka di Explorer"
      const dirBtn = e.target.closest('.btn-dir-explorer');
      if (dirBtn) {
        e.preventDefault();
        e.stopPropagation();
        const p = dirBtn.getAttribute('data-path') || '';
        try {
          const res = await window.api.openInExplorer(p);
          if (res.success) {
            window.showToast('Membuka folder di Windows Explorer', 'blue');
            this.log(`Folder dibuka di Windows Explorer: ${res.openedPath}`, 'info');
          } else {
            window.showToast('Gagal membuka Explorer: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
        return;
      }

      // 2. Ready-to-Print Queue Session Card "Buka di Explorer"
      const queueExpBtn = e.target.closest('.btn-explorer-session');
      if (queueExpBtn) {
        e.preventDefault();
        e.stopPropagation();
        const p = queueExpBtn.getAttribute('data-path') || '';
        try {
          const res = await window.api.openInExplorer(p);
          if (res.success) {
            window.showToast('Membuka folder sesi di Windows Explorer', 'blue');
            this.log(`Folder sesi dibuka di Windows Explorer: ${res.openedPath}`, 'info');
          } else {
            window.showToast('Gagal membuka Explorer: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
        return;
      }

      // 3. Ready-to-Print Queue Table Row "Lokasi"
      const locateBtn = e.target.closest('.btn-locate-item');
      if (locateBtn) {
        e.preventDefault();
        e.stopPropagation();
        const tr = locateBtn.closest('tr');
        const sessionCard = locateBtn.closest('.session-queue-card');
        const sessionPath = locateBtn.getAttribute('data-path')
          || (sessionCard ? sessionCard.querySelector('.btn-explorer-session')?.getAttribute('data-path') : '')
          || '';
        const filename = locateBtn.getAttribute('data-filename')
          || (tr ? tr.querySelector('.queue-filename-text')?.textContent.trim() : '')
          || '';

        if (filename) {
          try {
            const res = await window.api.openFileLocation(sessionPath, filename);
            if (res.success) {
              window.showToast(`Membuka file di Explorer: ${filename}`, 'blue');
              this.log(`Menyorot file di Explorer: ${res.openedPath}`, 'info');
            } else {
              window.showToast('Gagal membuka lokasi file: ' + res.error, 'danger');
            }
          } catch (err) {
            window.showToast('Error: ' + err.message, 'danger');
          }
        }
        return;
      }

      // 4. Photostrip Banner "Buka di Explorer"
      const stripLocateBtn = e.target.closest('.btn-locate-strip');
      if (stripLocateBtn) {
        e.preventDefault();
        e.stopPropagation();
        const sessionPath = stripLocateBtn.getAttribute('data-path') || '';
        const filename = stripLocateBtn.getAttribute('data-filename') || '';
        if (filename) {
          try {
            const res = await window.api.openFileLocation(sessionPath, filename);
            if (res.success) {
              window.showToast(`Membuka file strip di Explorer: ${filename}`, 'blue');
              this.log(`Menyorot file strip di Explorer: ${res.openedPath}`, 'info');
            } else {
              window.showToast('Gagal membuka lokasi file: ' + res.error, 'danger');
            }
          } catch (err) {
            window.showToast('Error: ' + err.message, 'danger');
          }
        }
        return;
      }
    });
  }

  bindWebSocketEvents() {
    window.api.on('INIT', (data) => {
      this.log('WebSocket terhubung dengan server lokal studio', 'success');
      const activePath = data.session ? data.session.activeSessionPath : null;
      this.renderSessionQueues(data.sessions || [], activePath);
      if (data.stations) {
        this.renderStations(data.stations);
      }
      if (data.timer) {
        this.renderTimerState(data.timer);
      }
      if (data.photostrip) {
        this.loadPhotostripTemplates();
      }
    });

    // Session Timer & Customer Pacing WebSocket Events
    window.api.on('TIMER_TICK', (data) => {
      this.renderTimerTick(data);
    });

    window.api.on('TIMER_STARTED', (data) => {
      const timer = (data && data.timer) || data;
      this.log(`Timer sesi dimulai: ${timer.formattedTime || ''}`, 'info');
      this.renderTimerState(data);
    });

    window.api.on('TIMER_PAUSED', (data) => {
      const timer = (data && data.timer) || data;
      this.log(`Timer sesi dijeda pada: ${timer.formattedTime || ''}`, 'warn');
      this.renderTimerState(data);
    });

    window.api.on('TIMER_RESUMED', (data) => {
      const timer = (data && data.timer) || data;
      this.log(`Timer sesi dilanjutkan: ${timer.formattedTime || ''}`, 'info');
      this.renderTimerState(data);
    });

    window.api.on('TIMER_EXTENDED', (data) => {
      const timer = (data && data.timer) || data;
      const added = data.addedMinutes || (data.timer && data.timer.addedMinutes) || 5;
      this.log(`Tambahan waktu +${added} menit diberikan. Sisa: ${timer.formattedTime || ''}`, 'success');
      this.renderTimerState(data);
    });

    window.api.on('TIMER_RESET', (data) => {
      const timer = (data && data.timer) || data;
      this.log(`Timer sesi di-reset: ${timer.formattedTime || ''}`, 'info');
      this.renderTimerState(data);
    });

    window.api.on('TIMER_STOPPED', (data) => {
      this.log('Timer sesi dihentikan', 'info');
      this.renderTimerState(data);
    });

    window.api.on('TIMER_EXPIRED', (data) => {
      this.log('Waktu sesi pemilihan foto telah habis!', 'warn');
      this.renderTimerState(data);
    });

    window.api.on('TIMER_SETTINGS_UPDATED', (data) => {
      this.renderTimerState(data);
    });

    window.api.on('STATION_STATUS_CHANGED', (data) => {
      this.log(`Status stasiun ${data.stationId}: ${data.isOnline ? 'Terhubung (Online)' : 'Terputus (Offline)'}`, data.isOnline ? 'success' : 'warn');
      const st = (this.stations || []).find(s => s.id === data.stationId);
      if (st) {
        st.isOnline = data.isOnline;
        st.activeClientsCount = data.activeClientsCount || 0;
        if (data.remoteIp) st.remoteIp = data.remoteIp;
        this.renderStations(this.stations);
      } else {
        this.refreshStations();
      }
    });

    window.api.on('STATIONS_UPDATED', (data) => {
      if (data.stations) {
        this.renderStations(data.stations);
      }
    });

    window.api.on('SESSION_ASSIGNED', (data) => {
      this.log(`Stasiun "${data.stationId}" diarahkan ke: ${data.sessionName}`, 'info');
      this.refreshStations();
      this.refreshDirectorySessions();
    });

    window.api.on('PHOTO_ADDED', (data) => {
      this.log(`File baru masuk: ${data.photo.filename}`, 'info');
      this.refreshData();
    });

    window.api.on('PHOTO_REMOVED', (data) => {
      this.log(`File dihapus: ${data.filename}`, 'warn');
      this.refreshData();
    });

    window.api.on('SELECTION_UPDATED', (data) => {
      const act = data.selected ? 'memilih' : 'membatalkan';
      this.log(`Klien ${act} foto: ${data.filename}`, data.selected ? 'blue' : 'info');
      if (data.sessions) {
        this.renderSessionQueues(data.sessions, data.sessionPath);
      } else {
        this.refreshData();
      }
    });

    window.api.on('SELECTION_CLEARED', (data) => {
      this.log('Pilihan foto dibersihkan', 'warn');
      if (data.sessions) {
        this.renderSessionQueues(data.sessions, data.sessionPath);
      } else {
        this.refreshData();
      }
    });

    window.api.on('SESSION_CHANGED', (data) => {
      this.log(`Sesi aktif diubah: ${data.sessionName}`, 'blue');
      this.refreshData();
    });

    window.api.on('PRINT_EXPORTED', (data) => {
      if (data.reports) {
        const total = data.reports.reduce((acc, r) => acc + (r.totalCopies || 0), 0);
        this.log(`Semua sesi diekspor: total ${total} lembar cetak disiapkan`, 'success');
        window.showToast(`Pesanan cetak massal berhasil disiapkan (${total} lembar)`, 'success', 5000);
      } else if (data.report) {
        this.log(`Pesanan cetak dikonfirmasi: ${data.report.totalCopies} lembar untuk ${data.report.sessionName}`, 'success');
        window.showToast(`Pesanan siap cetak masuk dari: ${data.report.sessionName} (${data.report.totalCopies} lembar)`, 'success', 6000);
      }
      if (data.sessions) {
        this.renderSessionQueues(data.sessions, this.activeSessionPath);
      }
      this.refreshData();
    });

    window.api.on('SESSION_DIRECTORIES_UPDATED', (data) => {
      this.renderDirectorySessions(data);
    });

    window.api.on('PHOTOSTRIP_CONFIG_CHANGED', () => {
      this.log('Konfigurasi template photostrip diperbarui', 'info');
    });

    window.api.on('TEMPLATES_UPDATED', () => {
      this.log('Koleksi template photostrip diperbarui', 'info');
    });
  }

  updateConnectionStatus(isConnected) {
    const dotColor = isConnected ? 'var(--accent-green)' : 'var(--accent-red)';
    const statusText = isConnected ? 'Terhubung' : 'Terputus';

    if (this.statClientStatus) {
      this.statClientStatus.innerHTML = `<span class="live-dot" style="width: 8px; height: 8px; background-color: ${dotColor};" aria-hidden="true"></span> ${isConnected ? 'Aktif' : 'Terputus'}`;
      this.statClientStatus.style.color = dotColor;
    }

    if (this.sidebarLiveDot) {
      this.sidebarLiveDot.style.backgroundColor = dotColor;
    }

    if (this.sidebarStatusText) {
      this.sidebarStatusText.textContent = statusText;
      this.sidebarStatusText.style.color = dotColor;
    }

    if (this.mobileLiveDot) {
      this.mobileLiveDot.style.backgroundColor = dotColor;
    }

    if (this.mobileStatusText) {
      this.mobileStatusText.textContent = statusText;
      this.mobileStatusText.style.color = dotColor;
    }
  }

  async refreshData() {
    try {
      const session = await window.api.getSession();
      const photosRes = await window.api.getPhotos();
      const selRes = await window.api.getSelections();

      if (session.success) {
        this.activeSessionPath = session.activeSessionPath;
        if (this.currentPathDisplay) {
          this.currentPathDisplay.textContent = session.activeSessionPath;
        }
        if (this.sessionPathInput) {
          this.sessionPathInput.value = session.activeSessionPath;
        }
        this.renderRecentFolders(session.recentFolders || [], session.activeSessionPath);
        this.updateActiveSessionOverview(session.activeSessionPath);
      }

      const photos = photosRes.success ? photosRes.photos : [];
      const newTotal = photos ? photos.length : 0;
      if (this.statTotalPhotos.textContent !== String(newTotal)) {
        this.statTotalPhotos.textContent = newTotal;
        this.animateStat(this.statTotalPhotos);
      }

      const sessions = selRes.sessions || [];
      const activePath = session.activeSessionPath || selRes.activeSessionPath;
      this.renderSessionQueues(sessions, activePath);

      // Refresh Studio Session Directories first so directorySessions is populated for station cards
      await this.refreshDirectorySessions();

      // Refresh Client Workstations
      await this.refreshStations();

      // Refresh Photostrip Templates & Settings
      await this.loadPhotostripTemplates();

      // Keep overview card stations connectivity up to date
      this.updateActiveSessionOverview(this.activeSessionPath);
    } catch (e) {
      console.error('Error refreshing operator data:', e);
    }
  }

  /**
   * Update Active Session Status in Overview Card
   */
  updateActiveSessionOverview(activePath) {
    const overviewName = document.getElementById('overview-session-name');
    if (overviewName) {
      if (activePath) {
        const cleanPath = activePath.replace(/\\/g, '/');
        const parts = cleanPath.split('/').filter(Boolean);
        overviewName.textContent = parts[parts.length - 1] || activePath;
      } else {
        overviewName.textContent = 'Belum Dipilih';
      }
    }

    const overviewStations = document.getElementById('overview-session-stations');
    if (overviewStations) {
      if (!activePath) {
        overviewStations.textContent = 'Standby';
        overviewStations.style.color = 'var(--text-muted)';
        return;
      }
      const actNorm = activePath.toLowerCase().replace(/\\/g, '/');
      const assignedStations = (this.stations || []).filter(st => {
        if (!st.assignedSession) return false;
        const stNorm = st.assignedSession.toLowerCase().replace(/\\/g, '/');
        return stNorm === actNorm || actNorm.endsWith(stNorm) || stNorm.endsWith(actNorm);
      });
      if (assignedStations.length > 0) {
        overviewStations.textContent = `${assignedStations.length} PC Klien Terhubung`;
        overviewStations.style.color = 'var(--accent-green)';
      } else if ((this.stations || []).length > 0) {
        overviewStations.textContent = 'Semua PC Klien (Default)';
        overviewStations.style.color = 'var(--accent-blue)';
      } else {
        overviewStations.textContent = 'Standby (0 Klien)';
        overviewStations.style.color = 'var(--text-muted)';
      }
    }
  }

  /**
   * Render Multi-Session Print Queue Container
   * Organizes print items per photoshoot session folder with inspection lightbox support.
   */
  renderSessionQueues(sessions, activeSessionPath) {
    this.sessions = sessions || [];

    // Aggregate statistics across all sessions
    let grandTotalItems = 0;
    let grandTotalCopies = 0;
    this.sessions.forEach(s => {
      grandTotalItems += (s.totalItems || 0);
      grandTotalCopies += (s.totalCopies || 0);
    });

    // Update Top Stat Cards
    if (this.statSelectedPhotos && this.statSelectedPhotos.textContent !== String(grandTotalItems)) {
      this.statSelectedPhotos.textContent = grandTotalItems;
      this.animateStat(this.statSelectedPhotos);
    }

    if (this.statTotalCopies && this.statTotalCopies.textContent !== String(grandTotalCopies)) {
      this.statTotalCopies.textContent = grandTotalCopies;
      this.animateStat(this.statTotalCopies);
    }

    // Update Sidebar Queue Badges (Desktop & Mobile)
    if (this.navQueueBadge) {
      this.navQueueBadge.textContent = grandTotalItems;
      this.navQueueBadge.classList.toggle('has-items', grandTotalItems > 0);
      if (grandTotalItems > 0) this.animateStat(this.navQueueBadge);
    }
    if (this.mobileNavQueueBadge) {
      this.mobileNavQueueBadge.textContent = grandTotalItems;
      this.mobileNavQueueBadge.classList.toggle('has-items', grandTotalItems > 0);
      if (grandTotalItems > 0) this.animateStat(this.mobileNavQueueBadge);
    }

    // Update Export All Button State
    if (this.btnExportAllPrint) {
      this.btnExportAllPrint.disabled = (grandTotalItems === 0);
    }

    // Filter sessions with pending items or exported print copies
    const sessionsWithItems = this.sessions.filter(s => (s.totalItems > 0) || s.hasExportedPrint);

    if (sessionsWithItems.length === 0) {
      if (this.queueSessionsContainer) this.queueSessionsContainer.innerHTML = '';
      if (this.emptyTableNotice) this.emptyTableNotice.style.display = 'block';
      return;
    }

    if (this.emptyTableNotice) this.emptyTableNotice.style.display = 'none';
    if (!this.queueSessionsContainer) return;
    this.queueSessionsContainer.innerHTML = '';

    sessionsWithItems.forEach(session => {
      const hasStations = Array.isArray(session.assignedStations) && session.assignedStations.length > 0;
      const stationNames = hasStations ? session.assignedStations.join(', ') : '';
      const isDefaultActive = !!(activeSessionPath && session.sessionPath.toLowerCase() === activeSessionPath.toLowerCase());
      const isActive = session.isActive || isDefaultActive || hasStations;
      const card = document.createElement('div');
      card.className = `session-queue-card ${isActive ? 'is-active-session' : ''}`;

      const iconClass = isActive ? 'session-icon-active' : 'session-icon-stored';
      let statusClass = 'session-status-stored';
      let statusLabel = 'Tersimpan';

      if (hasStations) {
        statusClass = 'session-status-active';
        statusLabel = `Aktif di ${stationNames}`;
      } else if (isActive) {
        statusClass = 'session-status-active';
        statusLabel = 'Sesi Aktif';
      }

      const updateTimeText = session.latestSelectedAt
        ? `Update: ${new Date(session.latestSelectedAt).toLocaleTimeString('id-ID')}`
        : 'Update Baru';

      const orderStatusBadge = session.hasExportedPrint
        ? `<span class="session-pill" style="background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.35); color: var(--accent-green); font-weight: 700;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Pesanan Siap Cetak (Dikonfirmasi)
          </span>`
        : `<span class="session-pill" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); color: #d97706; font-weight: 600;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            Sedang Dipilih Pelanggan
          </span>`;

      const hasPhotostrip = session.photostrip && session.photostrip.exportedFile;
      const photostripBannerHtml = hasPhotostrip ? `
        <div class="session-photostrip-banner" style="background: rgba(99, 102, 241, 0.08); border-top: 1px solid rgba(99, 102, 241, 0.25); border-bottom: 1px solid rgba(99, 102, 241, 0.25); padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div class="photostrip-thumb-preview" data-filename="${session.photostrip.exportedFile}" data-path="${session.sessionPath}" style="width: 44px; height: 62px; background: #0b0f19; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="Klik untuk lihat detail strip foto">
              <img src="/api/photo/${encodeURIComponent(session.photostrip.exportedFile)}/thumb?session=${encodeURIComponent(session.sessionPath)}" style="width: 100%; height: 100%; object-fit: contain;" alt="Strip Preview" />
            </div>
            <div>
              <div style="font-weight: 700; font-size: 0.92rem; color: var(--accent-blue); display: flex; align-items: center; gap: 6px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                Hasil Foto Strip Photobooth Siap Cetak (300 DPI)
              </div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
                File: <span style="font-family: 'JetBrains Mono', monospace; color: var(--text-primary); font-weight: 600;">${session.photostrip.exportedFile}</span> &bull; Template: <span style="font-weight: 600; color: var(--accent-gold);">${session.photostrip.templateId || 'Standar'}</span> &bull; Format: <span style="font-weight: 600;">${session.photostrip.outputFormat === 'single_strip' ? '1 Strip (2x6")' : '2 Strip 4R (1200x1800)'}</span>
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn btn-sm btn-gold btn-print-strip" data-filename="${session.photostrip.exportedFile}" data-path="${session.sessionPath}" title="Cetak File Foto Strip Ini Langsung" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              <span>Cetak Strip</span>
            </button>
            <button type="button" class="btn btn-sm btn-secondary btn-locate-strip" data-filename="${session.photostrip.exportedFile}" data-path="${session.sessionPath}" title="Buka dan sorot file strip di Windows Explorer" style="display: inline-flex; align-items: center; gap: 6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              <span>Buka di Explorer</span>
            </button>
          </div>
        </div>
      ` : '';

      card.innerHTML = `
        <div class="session-queue-header">
          <div class="session-header-left">
            <div class="session-icon-badge ${iconClass}" aria-hidden="true">
              ${isActive ? `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                  <circle cx="12" cy="13" r="4"></circle>
                </svg>
              ` : `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
              `}
            </div>
            <div class="session-info">
              <div class="session-name-row">
                <h3 class="session-name-title">${session.sessionName}</h3>
                <span class="session-status-badge ${statusClass}">${statusLabel}</span>
              </div>
              <div class="session-path-sub">${session.sessionPath}</div>
              <div class="session-meta-pills">
                ${orderStatusBadge}
                <span class="session-pill session-pill-blue">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  ${session.totalItems} Foto Unik
                </span>
                <span class="session-pill session-pill-amber">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                  ${session.totalCopies} Lembar Cetak
                </span>
                <span class="session-pill session-pill-slate">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  ${updateTimeText}
                </span>
              </div>
            </div>
          </div>
          <div class="session-header-actions" style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <button class="btn btn-sm btn-complete-queue-session" data-path="${session.sessionPath}" data-name="${session.sessionName}" title="Konfirmasi penyelesaian sesi dan lepaskan stasiun PC klien" style="background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.35); color: var(--accent-green); font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Konfirmasi Selesai</span>
            </button>
            <button class="btn btn-sm btn-print-session" data-path="${session.sessionPath}" title="Buka jendela cetak langsung untuk semua foto sesi ini (${session.totalCopies} lembar)" style="background: var(--color-blue-bg); border: 1px solid var(--color-blue-border); color: var(--accent-blue); font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              <span>Cetak Sesi Ini</span>
            </button>
            <button class="btn btn-sm btn-secondary btn-explorer-session" data-path="${session.sessionPath}" title="Buka folder sesi ini di Windows Explorer" style="display: inline-flex; align-items: center; gap: 6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>Buka di Explorer</span>
            </button>
            <button class="btn btn-sm btn-gold btn-export-session" data-path="${session.sessionPath}" title="Salin foto sesi ini ke _SIAP_CETAK">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              Salin ke _SIAP_CETAK
            </button>
            ${(!isActive && !hasStations) ? `
              <button class="btn btn-sm btn-secondary btn-activate-session" data-path="${session.sessionPath}" title="Aktifkan sesi ini untuk layar klien">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Aktifkan Sesi
              </button>
            ` : ''}
            <button class="btn btn-sm btn-danger btn-reset-session" data-path="${session.sessionPath}" data-name="${session.sessionName}" title="Hapus semua pilihan foto pada sesi ini">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              Reset Sesi
            </button>
          </div>
        </div>

        ${photostripBannerHtml}

        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th style="width: 44px;">#</th>
                <th style="width: 68px;">Foto</th>
                <th>Nama File</th>
                <th>Ukuran & Jumlah</th>
                <th>Waktu Dipilih</th>
                <th style="text-align: right; width: 250px;">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody class="session-table-body">
              <!-- Item rows -->
            </tbody>
          </table>
        </div>
      `;

      // Wire Header Action Buttons
      const btnCompleteQueue = card.querySelector('.btn-complete-queue-session');
      if (btnCompleteQueue) {
        btnCompleteQueue.addEventListener('click', () => {
          this.openCheckoutModal(session);
        });
      }

      const btnPrintSession = card.querySelector('.btn-print-session');
      if (btnPrintSession) {
        btnPrintSession.addEventListener('click', () => {
          window.api.openDirectPrintWindow(session.sessionPath, null, null, true);
          this.log(`Membuka jendela cetak batch untuk sesi: ${session.sessionName} (${session.totalCopies} lembar)`, 'info');
        });
      }

      const btnExplorerSession = card.querySelector('.btn-explorer-session');
      if (btnExplorerSession) {
        btnExplorerSession.addEventListener('click', async (e) => {
          if (e) e.stopPropagation();
          try {
            const res = await window.api.openInExplorer(session.sessionPath);
            if (res.success) {
              window.showToast(`Membuka folder sesi di Windows Explorer`, 'blue');
              this.log(`Folder sesi dibuka di Explorer: ${session.sessionName}`, 'info');
            } else {
              window.showToast('Gagal membuka Explorer: ' + res.error, 'danger');
            }
          } catch (err) {
            window.showToast('Error: ' + err.message, 'danger');
          }
        });
      }

      const btnActivate = card.querySelector('.btn-activate-session');
      if (btnActivate) {
        btnActivate.addEventListener('click', async () => {
          try {
            const res = await window.api.setSessionFolder(session.sessionPath);
            if (res.success) {
              this.log(`Sesi aktif dialihkan ke: ${session.sessionName}`, 'success');
              window.showToast(`Sesi aktif dialihkan ke: ${session.sessionName}`, 'success');
              await this.refreshData();
            } else {
              window.showToast('Gagal mengaktifkan sesi: ' + res.error, 'danger');
            }
          } catch (err) {
            window.showToast('Error: ' + err.message, 'danger');
          }
        });
      }

      const btnExport = card.querySelector('.btn-export-session');
      if (btnExport) {
        btnExport.addEventListener('click', async () => {
          btnExport.disabled = true;
          const origText = btnExport.innerHTML;
          btnExport.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="spin" aria-hidden="true"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
            Menyalin...
          `;

          try {
            const res = await window.api.exportPrint(session.sessionPath);
            if (res.success) {
              const rep = res.report;
              this.log(`BERHASIL: ${rep.totalCopies} lembar foto diekspor ke: ${rep.targetDir}`, 'success');
              window.showToast(`Sukses! ${rep.totalCopies} lembar foto disalin ke _SIAP_CETAK.`, 'success', 5000);
              try {
                await window.api.openQueueFolder(session.sessionPath, 'print');
              } catch (e) {}
              await this.refreshData();
            } else {
              window.showToast('Gagal mengekspor: ' + res.error, 'danger');
            }
          } catch (err) {
            window.showToast('Error: ' + err.message, 'danger');
          } finally {
            btnExport.disabled = false;
            btnExport.innerHTML = origText;
          }
        });
      }

      const btnReset = card.querySelector('.btn-reset-session');
      if (btnReset) {
        btnReset.addEventListener('click', async () => {
          const confirmed = await window.showConfirm(
            'Reset Pilihan Sesi?',
            `Hapus seluruh antrean pilihan cetak untuk sesi "${session.sessionName}"?`,
            'Ya, Reset Sesi',
            true
          );
          if (confirmed) {
            await window.api.clearSelections(session.sessionPath);
            this.log(`Daftar pilihan cetak sesi "${session.sessionName}" telah dibersihkan`, 'warn');
            window.showToast(`Pilihan cetak sesi "${session.sessionName}" dibersihkan`, 'info');
            await this.refreshData();
          }
        });
      }

      // Wire Photostrip Strip Actions
      if (hasPhotostrip) {
        const btnPrintStrip = card.querySelector('.btn-print-strip');
        if (btnPrintStrip) {
          btnPrintStrip.addEventListener('click', () => {
            window.api.openDirectPrintWindow(session.sessionPath, session.photostrip.exportedFile, [{ size: '4R Strip', qty: 1 }]);
            this.log(`Membuka jendela cetak untuk foto strip: ${session.photostrip.exportedFile}`, 'info');
          });
        }

        const btnLocateStrip = card.querySelector('.btn-locate-strip');
        if (btnLocateStrip) {
          btnLocateStrip.addEventListener('click', async (e) => {
            if (e) e.stopPropagation();
            try {
              const res = await window.api.openFileLocation(session.sessionPath, session.photostrip.exportedFile);
              if (res.success) {
                window.showToast(`Membuka file strip di Explorer: ${session.photostrip.exportedFile}`, 'blue');
                this.log(`Menyorot file strip di Explorer: ${res.openedPath}`, 'info');
              } else {
                window.showToast('Gagal membuka file strip di Explorer: ' + res.error, 'danger');
              }
            } catch (err) {
              window.showToast('Error: ' + err.message, 'danger');
            }
          });
        }

        const thumbStrip = card.querySelector('.photostrip-thumb-preview');
        if (thumbStrip && window.lightbox) {
          thumbStrip.addEventListener('click', () => {
            window.lightbox.open([{
              filename: session.photostrip.exportedFile,
              sessionPath: session.sessionPath,
              sizes: [{ size: '4R Strip', qty: 1 }],
              isSelected: true
            }], 0);
          });
        }
      }

      // Populate Session Table Rows
      const tbody = card.querySelector('.session-table-body');
      const selections = session.selections || [];

      // Lightbox photo list for this session inspection view
      const sessionPhotosForLightbox = selections.map(item => ({
        filename: item.filename,
        sessionPath: session.sessionPath,
        sizes: item.sizes,
        isSelected: true
      }));

      const openDetailLightbox = (index) => {
        if (!window.lightbox) return;
        window.lightbox.open(sessionPhotosForLightbox, index);
      };

      selections.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-subtle)';

        const sizesText = item.sizes
          ? item.sizes.map(s => {
              let bg = 'var(--color-blue-bg)';
              let color = 'var(--color-blue-text)';
              let border = 'var(--color-blue-border)';
              if (s.size.includes('8R') || s.size.includes('10R')) {
                bg = 'var(--color-slate-bg)';
                color = 'var(--color-slate-text)';
                border = 'var(--color-slate-border)';
              } else if (s.size.includes('12R') || s.size.includes('Kanvas')) {
                bg = 'var(--color-amber-bg)';
                color = 'var(--color-amber-text)';
                border = 'var(--color-amber-border)';
              }
              return `<span class="badge-size" style="background: ${bg}; color: ${color}; border: 1px solid ${border}; padding: 2px 8px; border-radius: var(--radius-xs); font-size: 0.78rem; margin-right: 4px; font-weight: 700; font-family: 'JetBrains Mono', monospace;">${s.size} (${s.qty}x)</span>`;
            }).join(' ')
          : `<span class="badge-size" style="background: var(--color-blue-bg); color: var(--color-blue-text); border: 1px solid var(--color-blue-border); padding: 2px 8px; border-radius: var(--radius-xs); font-size: 0.78rem; font-weight: 700; font-family: 'JetBrains Mono', monospace;">4R (1x)</span>`;

        tr.innerHTML = `
          <td style="padding: 12px 16px; font-size: 0.78rem; font-family: 'JetBrains Mono', monospace;">
            <span style="background: var(--color-blue-bg); color: var(--color-blue-text); border: 1px solid var(--color-blue-border); font-weight: 700; padding: 2px 7px; border-radius: var(--radius-xs);">${index + 1}</span>
          </td>
          <td style="padding: 10px 16px;">
            <img src="/api/photo/${encodeURIComponent(item.filename)}/thumb?session=${encodeURIComponent(session.sessionPath)}"
                 alt="Thumbnail ${item.filename}"
                 class="queue-preview-thumb"
                 loading="lazy"
                 title="Klik untuk lihat detail & deep zoom"/>
          </td>
          <td style="padding: 12px 16px;">
            <button type="button" class="queue-photo-title-btn" title="Klik untuk lihat detail & deep zoom">
              <span class="queue-filename-text">${item.filename}</span>
              <span class="queue-inspect-chip">Lihat Detail <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg></span>
            </button>
          </td>
          <td style="padding: 12px 16px;">${sizesText}</td>
          <td style="padding: 12px 16px; font-size: 0.78rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">
            ${item.selectedAt ? new Date(item.selectedAt).toLocaleTimeString('id-ID') : '-'}
          </td>
          <td style="padding: 10px 16px; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px;">
              <button type="button" class="btn btn-sm btn-gold btn-print-item" title="Cetak foto ini sekarang (${item.filename})" style="padding: 5px 10px; font-size: 0.78rem; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                <span>Cetak</span>
              </button>
              <button type="button" class="btn btn-sm btn-secondary btn-locate-item" data-filename="${item.exportedFilename || item.filename}" data-path="${session.sessionPath}" title="Buka dan sorot file ini di Windows Explorer" style="padding: 5px 9px; font-size: 0.78rem; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                <span>Lokasi</span>
              </button>
              <button type="button" class="btn-inspect-item" title="Lihat detail resolusi penuh" style="padding: 5px 9px; font-size: 0.78rem;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                <span>Detail</span>
              </button>
              <button type="button" class="btn btn-sm btn-danger btn-remove-item" title="Batalkan foto ini dari antrean" aria-label="Batalkan foto ini" style="padding: 5px 8px;">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.2" fill="none" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </td>
        `;

        // Wire Direct Print Item
        const btnPrintItem = tr.querySelector('.btn-print-item');
        if (btnPrintItem) {
          btnPrintItem.addEventListener('click', () => {
            window.api.openDirectPrintWindow(session.sessionPath, item.filename, item.sizes);
            this.log(`Membuka jendela cetak untuk foto: ${item.filename}`, 'info');
          });
        }

        // Wire Locate File in Explorer
        const btnLocateItem = tr.querySelector('.btn-locate-item');
        if (btnLocateItem) {
          btnLocateItem.addEventListener('click', async (e) => {
            if (e) e.stopPropagation();
            try {
              const targetName = btnLocateItem.getAttribute('data-filename') || item.exportedFilename || item.filename;
              const res = await window.api.openFileLocation(session.sessionPath, targetName);
              if (res.success) {
                window.showToast(`Membuka file di Explorer: ${item.filename}`, 'blue');
                this.log(`Menyorot file di Explorer: ${res.openedPath}`, 'info');
              } else {
                window.showToast('Gagal membuka lokasi file: ' + res.error, 'danger');
              }
            } catch (err) {
              window.showToast('Error: ' + err.message, 'danger');
            }
          });
        }

        // Wire Inspection Trigger: Thumbnail, Title Button, Inspect Button
        tr.querySelector('.queue-preview-thumb').addEventListener('click', () => openDetailLightbox(index));
        tr.querySelector('.queue-photo-title-btn').addEventListener('click', () => openDetailLightbox(index));
        tr.querySelector('.btn-inspect-item').addEventListener('click', () => openDetailLightbox(index));

        // Wire Remove Item
        tr.querySelector('.btn-remove-item').addEventListener('click', async () => {
          await window.api.setSelection(item.filename, false, null, '', session.sessionPath);
          this.log(`Foto ${item.filename} dibatalkan dari antrean sesi "${session.sessionName}"`, 'warn');
          await this.refreshData();
        });

        tbody.appendChild(tr);
      });

      this.queueSessionsContainer.appendChild(card);
    });

    // GSAP Stagger Entrance for Session Cards
    if (window.gsap) {
      const cards = this.queueSessionsContainer.querySelectorAll('.session-queue-card');
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion && cards.length > 0) {
        gsap.from(cards, {
          autoAlpha: 0,
          y: 10,
          duration: 0.22,
          stagger: 0.05,
          ease: "power2.out",
          clearProps: "transform,opacity,visibility"
        });
      }
    }
  }

  /**
   * Render Recent Session Folders Quick Chips
   */
  renderRecentFolders(recentFolders, activePath) {
    const wrapper = document.getElementById('recent-folders-wrapper');
    const container = document.getElementById('recent-folders-list');
    if (!wrapper || !container) return;

    if (!Array.isArray(recentFolders) || recentFolders.length === 0) {
      wrapper.style.display = 'none';
      return;
    }

    wrapper.style.display = 'block';
    container.innerHTML = '';

    recentFolders.forEach(folderPath => {
      if (!folderPath) return;
      const parts = folderPath.replace(/\\/g, '/').split('/').filter(Boolean);
      const folderName = parts[parts.length - 1] || folderPath;
      const isActive = folderPath.toLowerCase() === (activePath || '').toLowerCase();

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `recent-folder-chip${isActive ? ' is-active' : ''}`;
      chip.title = folderPath;
      chip.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="recent-folder-chip-icon">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>${folderName}</span>
      `;

      chip.addEventListener('click', async () => {
        if (isActive) return;
        if (this.sessionPathInput) {
          this.sessionPathInput.value = folderPath;
        }
        try {
          const res = await window.api.setSessionFolder(folderPath);
          if (res.success) {
            this.log(`Folder sesi diganti ke: ${folderPath}`, 'success');
            window.showToast(`Sesi aktif beralih ke: ${folderName}`, 'success');
            await this.refreshData();
          } else {
            window.showToast('Gagal memuat folder: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
      });

      container.appendChild(chip);
    });
  }

  /**
   * Interactive In-App Folder Browser and Native Windows Picker
   */
  initFolderPicker() {
    this.btnBrowseFolder = document.getElementById('btn-browse-folder');
    this.folderModal = document.getElementById('folder-picker-modal');
    this.folderBackdrop = document.getElementById('folder-picker-backdrop');
    this.folderCloseBtn = document.getElementById('folder-picker-close-btn');
    this.btnFolderCancel = document.getElementById('btn-folder-cancel');
    this.btnFolderConfirm = document.getElementById('btn-folder-select-confirm');
    this.btnNativePicker = document.getElementById('btn-native-picker');
    this.btnFolderUp = document.getElementById('btn-folder-up');
    this.btnCreateSubfolder = document.getElementById('btn-create-subfolder');
    this.folderSearchInput = document.getElementById('folder-search-input');
    this.folderItemsContainer = document.getElementById('folder-items-container');
    this.folderDrivesContainer = document.getElementById('folder-picker-drives');
    this.folderShortcutsContainer = document.getElementById('folder-picker-shortcuts');
    this.folderBreadcrumbs = document.getElementById('folder-breadcrumbs');
    this.folderPreviewPath = document.getElementById('folder-selected-path-preview');
    this.folderCountBadge = document.getElementById('folder-selected-count-badge');

    if (!this.folderModal) return;

    this.currentBrowsePath = '';
    this.parentBrowsePath = '';
    this.selectedFolderPath = '';
    this.selectedFolderPhotoCount = 0;
    this.currentFoldersList = [];
    this.searchFilter = '';

    // Open Modal Trigger
    if (this.btnBrowseFolder) {
      this.btnBrowseFolder.addEventListener('click', () => {
        this.openFolderPicker();
      });
    }

    // Close Modal Triggers
    const closeModal = () => {
      this.folderModal.style.display = 'none';
      document.body.style.overflow = '';
    };

    if (this.folderCloseBtn) this.folderCloseBtn.addEventListener('click', closeModal);
    if (this.folderBackdrop) this.folderBackdrop.addEventListener('click', closeModal);
    if (this.btnFolderCancel) this.btnFolderCancel.addEventListener('click', closeModal);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.folderModal.style.display === 'flex') {
        closeModal();
      }
    });

    // Up / Parent Directory Trigger
    if (this.btnFolderUp) {
      this.btnFolderUp.addEventListener('click', () => {
        if (this.parentBrowsePath) {
          this.browseToDirectory(this.parentBrowsePath);
        }
      });
    }

    // Search filter input
    if (this.folderSearchInput) {
      this.folderSearchInput.addEventListener('input', (e) => {
        this.searchFilter = (e.target.value || '').trim().toLowerCase();
        this.renderFolderList();
      });
    }

    // Create New Subfolder
    if (this.btnCreateSubfolder) {
      this.btnCreateSubfolder.addEventListener('click', async () => {
        if (!this.currentBrowsePath) return;
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
        const defaultName = `Sesi_${dateStr}`;
        const folderName = window.prompt('Masukkan nama folder sesi pemotretan baru:', defaultName);
        if (!folderName || !folderName.trim()) return;

        try {
          const res = await window.api.createFolder(this.currentBrowsePath, folderName.trim());
          if (res.success) {
            window.showToast(`Folder "${folderName.trim()}" berhasil dibuat`, 'success');
            this.log(`Folder baru dibuat: ${res.folderPath}`, 'success');
            await this.browseToDirectory(res.folderPath);
          } else {
            window.showToast('Gagal membuat folder: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
      });
    }

    // Confirm Folder Selection
    if (this.btnFolderConfirm) {
      this.btnFolderConfirm.addEventListener('click', async () => {
        const targetPath = this.selectedFolderPath || this.currentBrowsePath;
        if (!targetPath) return;

        closeModal();

        if (typeof this.folderPickerCallback === 'function') {
          const cb = this.folderPickerCallback;
          this.folderPickerCallback = null;
          await cb(targetPath);
          return;
        }

        this.sessionPathInput.value = targetPath;
        try {
          const res = await window.api.setSessionFolder(targetPath);
          if (res.success) {
            this.log(`Folder sesi aktif diubah ke: ${targetPath}`, 'success');
            window.showToast('Folder sesi aktif berhasil diperbarui', 'success');
            await this.refreshData();
          } else {
            window.showToast('Gagal mengganti folder: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
      });
    }

    // Native Windows Picker (PowerShell Host Dialog)
    if (this.btnNativePicker) {
      this.btnNativePicker.addEventListener('click', async () => {
        const originalContent = this.btnNativePicker.innerHTML;
        this.btnNativePicker.disabled = true;
        this.btnNativePicker.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
          <span>Membuka Explorer...</span>
        `;

        try {
          const startDir = this.selectedFolderPath || this.currentBrowsePath || (this.sessionPathInput ? this.sessionPathInput.value : '') || this.directoryRootPath || '';
          const res = await window.api.openNativePicker(startDir);
          const chosenPath = res.selectedPath || res.path;
          if (res.success && !res.canceled && !res.cancelled && chosenPath) {
            closeModal();

            if (typeof this.folderPickerCallback === 'function') {
              const cb = this.folderPickerCallback;
              this.folderPickerCallback = null;
              await cb(chosenPath);
              return;
            }

            if (this.sessionPathInput) {
              this.sessionPathInput.value = chosenPath;
            }
            const applyRes = await window.api.setSessionFolder(chosenPath);
            if (applyRes.success) {
              this.log(`Folder dipilih via Windows Explorer: ${chosenPath}`, 'success');
              window.showToast('Folder sesi aktif berhasil diperbarui', 'success');
              await this.refreshData();
            }
          }
        } catch (err) {
          window.showToast('Gagal membuka dialog Windows: ' + err.message, 'danger');
        } finally {
          this.btnNativePicker.disabled = false;
          this.btnNativePicker.innerHTML = originalContent;
        }
      });
    }
  }

  async openFolderPicker(initialPath = null, onSelectCallback = null) {
    this.folderPickerCallback = onSelectCallback;
    this.folderModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Clear search filter
    if (this.folderSearchInput) {
      this.folderSearchInput.value = '';
      this.searchFilter = '';
    }

    // Load drives and shortcuts
    await this.loadDrivesAndShortcuts();

    // Start navigating from initialPath, current session path input or fallback
    const startPath = initialPath || this.sessionPathInput.value.trim() || '';
    await this.browseToDirectory(startPath);
  }

  async loadDrivesAndShortcuts() {
    try {
      const data = await window.api.getOperatorDrives();
      if (!data.success) return;

      // Render Drives
      if (this.folderDrivesContainer) {
        this.folderDrivesContainer.innerHTML = '';
        (data.drives || []).forEach(drive => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'drive-chip';
          btn.title = drive.label || drive.name;
          btn.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="12" x2="2" y2="12"></line>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
              <line x1="6" y1="16" x2="6.01" y2="16"></line>
              <line x1="10" y1="16" x2="10.01" y2="16"></line>
            </svg>
            <span>${drive.name}</span>
          `;
          btn.addEventListener('click', () => {
            this.browseToDirectory(drive.path);
          });
          this.folderDrivesContainer.appendChild(btn);
        });
      }

      // Render Shortcuts
      if (this.folderShortcutsContainer) {
        this.folderShortcutsContainer.innerHTML = '';
        (data.shortcuts || []).forEach(sc => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'shortcut-chip';
          btn.title = sc.path;
          btn.innerHTML = `<span>${sc.name}</span>`;
          btn.addEventListener('click', () => {
            this.browseToDirectory(sc.path);
          });
          this.folderShortcutsContainer.appendChild(btn);
        });
      }
    } catch (err) {
      console.warn('Gagal memuat drives & shortcuts:', err);
    }
  }

  async browseToDirectory(dirPath) {
    if (!this.folderItemsContainer) return;

    this.folderItemsContainer.innerHTML = `
      <div class="folder-loading-state">
        <div class="spinner"></div>
        <span>Membaca direktori folder...</span>
      </div>
    `;

    try {
      const result = await window.api.browseDirectory(dirPath);
      if (!result.success) {
        this.folderItemsContainer.innerHTML = `
          <div class="folder-empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color: var(--accent-red);"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            <div>Gagal membuka folder: ${result.error || 'Akses ditolak atau direktori tidak ditemukan'}</div>
          </div>
        `;
        return;
      }

      this.currentBrowsePath = result.currentPath;
      this.parentBrowsePath = result.parentPath || '';
      this.selectedFolderPath = result.currentPath;
      this.selectedFolderPhotoCount = result.photoCount || 0;
      this.currentFoldersList = result.folders || [];

      // Up button state
      if (this.btnFolderUp) {
        this.btnFolderUp.disabled = !this.parentBrowsePath;
      }

      // Update Breadcrumbs
      this.renderBreadcrumbs(result.breadcrumbs || []);

      // Highlight active drive / shortcuts
      this.updateActiveDriveChip(result.currentPath);

      // Render Folders
      this.renderFolderList();

      // Update Footer Preview
      this.updateFooterSelection(this.selectedFolderPath, this.selectedFolderPhotoCount);
    } catch (err) {
      this.folderItemsContainer.innerHTML = `
        <div class="folder-empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color: var(--accent-red);"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <div>Terjadi kesalahan saat memuat direktori: ${err.message}</div>
        </div>
      `;
    }
  }

  renderBreadcrumbs(breadcrumbs) {
    if (!this.folderBreadcrumbs) return;
    this.folderBreadcrumbs.innerHTML = '';

    breadcrumbs.forEach((item, idx) => {
      const isLast = idx === breadcrumbs.length - 1;
      const bItem = document.createElement('span');
      bItem.className = `breadcrumb-item${isLast ? ' is-current' : ''}`;
      bItem.textContent = item.name;

      if (!isLast) {
        bItem.title = item.path;
        bItem.addEventListener('click', () => {
          this.browseToDirectory(item.path);
        });
      }

      this.folderBreadcrumbs.appendChild(bItem);

      if (!isLast) {
        const sep = document.createElement('span');
        sep.className = 'breadcrumb-separator';
        sep.textContent = '>';
        this.folderBreadcrumbs.appendChild(sep);
      }
    });

    // Scroll breadcrumbs to end
    this.folderBreadcrumbs.scrollLeft = this.folderBreadcrumbs.scrollWidth;
  }

  updateActiveDriveChip(currentPath) {
    if (!this.folderDrivesContainer) return;
    const driveChips = this.folderDrivesContainer.querySelectorAll('.drive-chip');
    driveChips.forEach(chip => {
      const text = chip.textContent.trim().toUpperCase();
      const isActive = currentPath.toUpperCase().startsWith(text);
      chip.classList.toggle('is-active', isActive);
    });
  }

  renderFolderList() {
    if (!this.folderItemsContainer) return;

    let folders = this.currentFoldersList;
    if (this.searchFilter) {
      folders = folders.filter(f => f.name.toLowerCase().includes(this.searchFilter));
    }

    if (folders.length === 0) {
      this.folderItemsContainer.innerHTML = `
        <div class="folder-empty-state">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color: var(--text-dim);"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          <div>${this.searchFilter ? 'Tidak ada subfolder yang cocok dengan pencarian' : 'Tidak ada subfolder di direktori ini'}</div>
        </div>
      `;
      return;
    }

    this.folderItemsContainer.innerHTML = '';

    folders.forEach(f => {
      const isSelected = this.selectedFolderPath.toLowerCase() === f.path.toLowerCase();
      const itemEl = document.createElement('div');
      itemEl.className = `folder-item${isSelected ? ' is-selected' : ''}`;
      itemEl.title = `${f.name} (${f.photoCount} foto pemotretan)`;

      const photoBadge = f.photoCount > 0
        ? `<span class="folder-badge-photos">${f.photoCount} foto</span>`
        : `<span style="font-size: 0.70rem; color: var(--text-dim);">kosong</span>`;

      itemEl.innerHTML = `
        <div class="folder-item-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <div class="folder-item-body">
          <div class="folder-item-name">${f.name}</div>
          <div class="folder-item-meta">
            ${photoBadge}
          </div>
        </div>
        <button class="folder-item-enter-btn" title="Buka dan masuki folder ini">Buka ></button>
      `;

      // Single click selects folder
      itemEl.addEventListener('click', (e) => {
        if (e.target.closest('.folder-item-enter-btn')) return;
        this.selectFolderItem(f.path, f.photoCount);
      });

      // Double click navigates into folder
      itemEl.addEventListener('dblclick', () => {
        this.browseToDirectory(f.path);
      });

      // Enter button navigates into folder
      const enterBtn = itemEl.querySelector('.folder-item-enter-btn');
      if (enterBtn) {
        enterBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.browseToDirectory(f.path);
        });
      }

      this.folderItemsContainer.appendChild(itemEl);
    });
  }

  selectFolderItem(folderPath, photoCount) {
    this.selectedFolderPath = folderPath;
    this.selectedFolderPhotoCount = photoCount;

    // Update highlight
    const items = this.folderItemsContainer.querySelectorAll('.folder-item');
    items.forEach(el => {
      const isMatch = el.title.startsWith(folderPath) || el.querySelector('.folder-item-name')?.textContent === folderPath.split('\\').pop();
      el.classList.toggle('is-selected', isMatch);
    });

    this.updateFooterSelection(this.selectedFolderPath, this.selectedFolderPhotoCount);
  }

  updateFooterSelection(folderPath, photoCount) {
    if (this.folderPreviewPath) {
      this.folderPreviewPath.textContent = folderPath || '-';
    }
    if (this.folderCountBadge) {
      this.folderCountBadge.textContent = `${photoCount || 0} foto photoshoot`;
    }
    if (this.btnFolderConfirm) {
      this.btnFolderConfirm.disabled = !folderPath;
    }
  }

  /**
   * Client Workstations & Booth Slot Manager
   */
  initStationsManager() {
    if (!this.btnAddStation) return;

    // Open Add Station Modal (+)
    this.btnAddStation.addEventListener('click', () => {
      if (this.addStationModal) {
        this.addStationModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        const nameInput = document.getElementById('station-name-input');
        if (nameInput) {
          nameInput.value = `PC Klien ${(this.stations ? this.stations.length : 0) + 1} (Kabel LAN)`;
          nameInput.focus();
        }
      }
    });

    // Close Add Station Modal
    const closeAddModal = () => {
      if (this.addStationModal) {
        this.addStationModal.style.display = 'none';
        document.body.style.overflow = '';
      }
    };

    const closeBtn = document.getElementById('add-station-close-btn');
    const cancelBtn = document.getElementById('btn-cancel-add-station');
    const backdrop = document.getElementById('add-station-backdrop');

    if (closeBtn) closeBtn.addEventListener('click', closeAddModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeAddModal);
    if (backdrop) backdrop.addEventListener('click', closeAddModal);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.addStationModal && this.addStationModal.style.display === 'flex') {
        closeAddModal();
      }
    });

    // Handle Form Submit (+)
    if (this.formAddStation) {
      this.formAddStation.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('station-name-input');
        const typeSelect = document.getElementById('station-type-select');
        const noteInput = document.getElementById('station-note-input');

        const name = (nameInput?.value || '').trim();
        const type = typeSelect?.value || 'lan';
        const note = (noteInput?.value || '').trim();

        if (!name) return window.showToast('Nama stasiun harus diisi', 'warning');

        try {
          const res = await window.api.addStation(name, type, note);
          if (res.success) {
            this.log(`Stasiun baru ditambahkan: "${name}" (${type})`, 'success');
            window.showToast(`Stasiun "${name}" berhasil ditambahkan (+)`, 'success');
            closeAddModal();
            await this.refreshStations();
          } else {
            window.showToast('Gagal menambah stasiun: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
      });
    }
  }

  async refreshStations() {
    try {
      const res = await window.api.getStations();
      if (res.success && res.stations) {
        this.renderStations(res.stations);
      }
    } catch (err) {
      console.warn('Gagal memuat stasiun:', err);
    }
  }

  renderStations(stations) {
    this.stations = stations || [];
    const totalCount = this.stations.length;
    const onlineCount = this.stations.filter(s => s.isOnline).length;

    // Update badges
    if (this.navStationsBadge) this.navStationsBadge.textContent = String(totalCount);
    if (this.mobileNavStationsBadge) this.mobileNavStationsBadge.textContent = String(totalCount);

    // Update stats cards
    if (this.statTotalStations) this.statTotalStations.textContent = String(totalCount);
    if (this.statOnlineStations) this.statOnlineStations.textContent = String(onlineCount);

    if (!this.stationsGrid) return;

    if (totalCount === 0) {
      this.stationsGrid.innerHTML = `
        <div class="stations-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom: 12px; color: var(--text-dim);">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main); margin-bottom: 6px;">Belum Ada Stasiun PC Klien Didaftarkan</div>
          <p style="font-size: 0.85rem; max-width: 420px; margin: 0 auto 16px auto;">Tambahkan slot stasiun PC klien touchscreen atau tablet booth studio Anda dengan menekan tombol di bawah.</p>
          <button class="btn btn-gold" id="btn-empty-add-station">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>+ Tambah Stasiun Pertama</span>
          </button>
        </div>
      `;
      const btnEmpty = document.getElementById('btn-empty-add-station');
      if (btnEmpty) {
        btnEmpty.addEventListener('click', () => {
          if (this.btnAddStation) this.btnAddStation.click();
        });
      }
      return;
    }

    this.stationsGrid.innerHTML = '';

    const baseUrl = this.primaryLanUrl || window.location.origin;

    this.stations.forEach(s => {
      const stationUrl = `${baseUrl}/?station=${encodeURIComponent(s.id)}`;
      const card = document.createElement('div');
      card.className = `station-card${s.isOnline ? ' is-online' : ''}`;
      card.id = `card-${s.id}`;

      let typeBadgeClass = 'type-lan';
      let typeLabel = 'Kabel LAN';
      if (s.type === 'wifi') {
        typeBadgeClass = 'type-wifi';
        typeLabel = 'Wi-Fi';
      } else if (s.type === 'touchscreen') {
        typeBadgeClass = 'type-touchscreen';
        typeLabel = 'Touchscreen';
      }

      const statusBadge = s.isOnline
        ? `<span class="station-status-pill is-online"><span class="live-dot" style="width: 7px; height: 7px; background-color: var(--accent-green);"></span> Online</span>`
        : `<span class="station-status-pill is-offline"><span class="live-dot" style="width: 7px; height: 7px; background-color: var(--text-dim);"></span> Standby</span>`;

      card.innerHTML = `
        <div class="station-card-header">
          <div class="station-card-left">
            <div class="station-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            <div class="station-title-info">
              <div class="station-title-row">
                <span class="station-title">${s.name}</span>
                <span class="station-type-badge ${typeBadgeClass}">${typeLabel}</span>
              </div>
              <div class="station-note">${s.note || 'Booth Pemilihan Foto Studio'}</div>
            </div>
          </div>
          ${statusBadge}
        </div>

        <div class="station-card-body">
          <div style="font-size: 0.72rem; color: var(--text-dim); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Tautan Akses Khusus Stasiun:</div>
          <div class="station-link-box">
            <span class="station-url-text" title="${stationUrl}">${stationUrl}</span>
            <button class="btn btn-sm btn-station-copy" data-url="${stationUrl}" title="Salin tautan ini">
              Salin
            </button>
          </div>

          <div class="station-meta-row">
            <span>Alamat IP Klien:</span>
            <strong style="font-family: var(--font-mono); color: var(--text-main);">${s.remoteIp || 'Belum Terhubung'}</strong>
          </div>

          <div class="station-meta-row">
            <span>Koneksi Layar:</span>
            <span style="font-weight: 600; color: ${s.isOnline ? 'var(--accent-green)' : 'var(--text-muted)'};">
              ${s.activeClientsCount > 0 ? `${s.activeClientsCount} perangkat aktif` : '0 perangkat (Standby)'}
            </span>
          </div>

          <div class="station-meta-row station-session-binding">
            <div style="min-width: 0; flex: 1;">
              <div style="font-size: 0.72rem; color: var(--text-dim); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
                Sesi Foto Ditampilkan:
              </div>
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                ${s.assignedSessionPath
                  ? `<span class="badge-station-session-custom">Sesi Khusus</span>`
                  : `<span class="badge-station-session-global">Sesi Global</span>`
                }
                <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">
                  ${s.photoCount || 0} foto
                </span>
              </div>
            </div>
            <select class="station-session-select" data-id="${s.id}" title="Pilih direktori sesi khusus untuk stasiun ini">
              <option value="" ${(!s.assignedSessionPath) ? 'selected' : ''}>[ Ikuti Sesi Global: ${this.getActiveSessionName()} ]</option>
              ${this.directorySessions.map(dir => `
                <option value="${dir.path}" ${s.assignedSessionPath === dir.path ? 'selected' : ''}>
                  ${dir.name} (${dir.photoCount || 0} foto)
                </option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="station-card-footer">
          <div class="station-actions-left">
            <a href="${stationUrl}" target="_blank" rel="noopener noreferrer" class="btn-station-open" title="Buka tampilan layar stasiun ini di tab baru">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              <span>Buka Layar</span>
            </a>
            <button class="btn-station-reload" data-id="${s.id}" title="Muat ulang layar PC klien dari jarak jauh">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>Reload Layar</span>
            </button>
          </div>

          <button class="btn-remove-station" data-id="${s.id}" data-name="${s.name}" title="Hapus slot stasiun ini (-)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Hapus (-)</span>
          </button>
        </div>
      `;

      // Wire Session Dropdown
      const sessionSelect = card.querySelector('.station-session-select');
      if (sessionSelect) {
        sessionSelect.addEventListener('change', async (e) => {
          const chosenPath = e.target.value;
          try {
            const res = await window.api.assignStationSession(s.id, chosenPath);
            if (res.success) {
              window.showToast(`Sesi stasiun "${s.name}" diubah ke: ${res.assignedSessionName || 'Sesi Global'}`, 'success');
              this.log(`Stasiun "${s.name}" diarahkan ke sesi: ${res.assignedSessionName || 'Sesi Global'}`, 'info');
              await this.refreshStations();
              await this.refreshDirectorySessions();
            } else {
              window.showToast('Gagal mengubah sesi: ' + res.error, 'danger');
            }
          } catch (err) {
            window.showToast('Error: ' + err.message, 'danger');
          }
        });
      }

      // Wire Copy
      const copyBtn = card.querySelector('.btn-station-copy');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const url = copyBtn.getAttribute('data-url');
          if (navigator.clipboard && url) {
            navigator.clipboard.writeText(url).then(() => {
              copyBtn.textContent = 'Tersalin!';
              setTimeout(() => { copyBtn.textContent = 'Salin'; }, 2000);
            });
          }
        });
      }

      // Wire Reload
      const reloadBtn = card.querySelector('.btn-station-reload');
      if (reloadBtn) {
        reloadBtn.addEventListener('click', async () => {
          try {
            await window.api.reloadStation(s.id);
            window.showToast(`Sinyal reload dikirim ke ${s.name}`, 'blue');
            this.log(`Operator memicu reload layar untuk ${s.name}`, 'info');
          } catch (e) {
            window.showToast('Gagal reload: ' + e.message, 'danger');
          }
        });
      }

      // Wire Remove (-)
      const removeBtn = card.querySelector('.btn-remove-station');
      if (removeBtn) {
        removeBtn.addEventListener('click', async () => {
          const confirmed = window.confirm(`Apakah Anda yakin ingin menghapus "${s.name}" (-)?\nKoneksi klien pada meja ini akan dinonaktifkan.`);
          if (!confirmed) return;

          try {
            const res = await window.api.removeStation(s.id);
            if (res.success) {
              this.log(`Stasiun "${s.name}" dihapus (-) oleh operator`, 'warn');
              window.showToast(`Stasiun "${s.name}" berhasil dihapus (-)`, 'success');
              await this.refreshStations();
            } else {
              window.showToast('Gagal menghapus: ' + res.error, 'danger');
            }
          } catch (err) {
            window.showToast('Error: ' + err.message, 'danger');
          }
        });
      }

      this.stationsGrid.appendChild(card);
    });

    // GSAP entrance
    if (window.gsap) {
      const cards = this.stationsGrid.querySelectorAll('.station-card');
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion && cards.length > 0) {
        gsap.from(cards, {
          autoAlpha: 0,
          y: 8,
          duration: 0.2,
          stagger: 0.04,
          ease: 'power2.out',
          clearProps: 'transform,opacity,visibility'
        });
      }
    }
  }

  /**
   * Dedicated Photoshoot Session Directory Manager
   */
  initDirectoryManager() {
    if (!this.dirSessionsGrid) return;

    // Open Create Session Modal
    if (this.btnOpenCreateSessionModal) {
      this.btnOpenCreateSessionModal.addEventListener('click', () => {
        if (this.modalCreateSession) {
          this.modalCreateSession.style.display = 'flex';
          document.body.style.overflow = 'hidden';
          if (this.createSessionNameInput) {
            this.createSessionNameInput.value = '';
            this.createSessionNameInput.focus();
          }
          if (this.createSessionRootDisplay) {
            this.createSessionRootDisplay.textContent = this.directoryRootPath || '-';
          }
          // Reset pills selection
          this.modalCreateSession.querySelectorAll('.btn-template-pill').forEach(p => p.classList.remove('is-selected'));
        }
      });
    }

    // Close Create Session Modal
    const closeCreateModal = () => {
      if (this.modalCreateSession) {
        this.modalCreateSession.style.display = 'none';
        document.body.style.overflow = '';
      }
    };

    if (this.createSessionCloseBtn) this.createSessionCloseBtn.addEventListener('click', closeCreateModal);
    if (this.btnCancelCreateSession) this.btnCancelCreateSession.addEventListener('click', closeCreateModal);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalCreateSession && this.modalCreateSession.style.display === 'flex') {
        closeCreateModal();
      }
    });

    // Template Preset Pills Click
    if (this.modalCreateSession) {
      const pills = this.modalCreateSession.querySelectorAll('.btn-template-pill');
      pills.forEach(pill => {
        pill.addEventListener('click', () => {
          pills.forEach(p => p.classList.remove('is-selected'));
          pill.classList.add('is-selected');

          const preset = pill.getAttribute('data-preset') || 'Photoshoot';
          const now = new Date();
          const yyyy = now.getFullYear();
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          if (this.createSessionNameInput) {
            this.createSessionNameInput.value = `${yyyy}-${mm}-${dd}_${preset}_`;
            this.createSessionNameInput.focus();
          }
        });
      });
    }

    // Submit Create Session Form
    if (this.formCreateSession) {
      this.formCreateSession.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawName = this.createSessionNameInput ? this.createSessionNameInput.value.trim() : '';
        if (!rawName) return;

        const setAsActive = this.createSessionActiveCheckbox ? this.createSessionActiveCheckbox.checked : true;
        const submitBtn = document.getElementById('btn-submit-create-session');
        const origBtnText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Membuat Folder...</span>`;
        }

        try {
          const res = await window.api.createSession(rawName, this.directoryRootPath, setAsActive);
          if (res.success) {
            this.log(`Folder sesi photoshoot baru dibuat: ${res.name}`, 'success');
            window.showToast(`Sesi photoshoot "${res.name}" berhasil dibuat!`, 'success');
            closeCreateModal();
            this.formCreateSession.reset();
            await this.refreshDirectorySessions();
            if (setAsActive) {
              await this.refreshData();
            }
          } else {
            window.showToast('Gagal membuat sesi: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origBtnText;
          }
        }
      });
    }

    // Open Root Directory in Windows Explorer
    const handleOpenRootExplorer = async (e) => {
      if (e) e.stopPropagation();
      try {
        const targetDir = this.directoryRootPath
          || (this.dirCurrentRootPath ? this.dirCurrentRootPath.textContent.trim() : '')
          || '';
        const res = await window.api.openInExplorer(targetDir);
        if (res.success) {
          window.showToast('Membuka folder induk di Windows Explorer', 'blue');
          this.log(`Membuka folder induk di Windows Explorer: ${res.openedPath}`, 'info');
        } else {
          window.showToast('Gagal membuka Explorer: ' + res.error, 'danger');
        }
      } catch (err) {
        window.showToast('Error: ' + err.message, 'danger');
      }
    };

    if (this.btnOpenRootExplorer) {
      this.btnOpenRootExplorer.addEventListener('click', handleOpenRootExplorer);
    }
    const btnOpenRootExplorerInline = document.getElementById('btn-open-root-explorer-inline');
    if (btnOpenRootExplorerInline) {
      btnOpenRootExplorerInline.addEventListener('click', handleOpenRootExplorer);
    }

    // Change Root Directory via Interactive Folder Browser
    if (this.btnChangeRootDir) {
      this.btnChangeRootDir.addEventListener('click', () => {
        this.openFolderPicker(this.directoryRootPath, async (newRootPath) => {
          if (!newRootPath) return;
          try {
            const res = await window.api.setRootDirectory(newRootPath);
            if (res.success) {
              this.log(`Direktori induk studio diubah ke: ${newRootPath}`, 'success');
              window.showToast('Folder induk studio berhasil diubah', 'success');
              await this.refreshDirectorySessions();
            } else {
              window.showToast('Gagal mengubah direktori induk: ' + res.error, 'danger');
            }
          } catch (err) {
            window.showToast('Error: ' + err.message, 'danger');
          }
        });
      });
    }

    // Search / Filter Input
    if (this.dirSessionsSearch) {
      this.dirSessionsSearch.addEventListener('input', () => {
        if (this.lastDirectoryData) {
          this.renderDirectorySessions(this.lastDirectoryData, false);
        }
      });
    }

    // Filter Buttons (Semua Sesi / Sesi Aktif / Selesai Cetak)
    const filterBtns = document.querySelectorAll('.session-filter-btn[data-filter]');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.sessionFilter = btn.getAttribute('data-filter') || 'all';
        if (this.lastDirectoryData) {
          this.renderDirectorySessions(this.lastDirectoryData, false);
        }
      });
    });

    // Refresh Directory Sessions Button
    if (this.btnRefreshDirSessions) {
      this.btnRefreshDirSessions.addEventListener('click', async () => {
        await this.refreshDirectorySessions();
        window.showToast('Daftar sesi diperbarui', 'info');
      });
    }

    // Assign Session to Station Modal Events
    const closeAssignModal = () => {
      if (this.modalAssignSession) {
        this.modalAssignSession.style.display = 'none';
        document.body.style.overflow = '';
      }
    };

    if (this.assignModalCloseBtn) this.assignModalCloseBtn.addEventListener('click', closeAssignModal);
    if (this.assignModalCancelBtn) this.assignModalCancelBtn.addEventListener('click', closeAssignModal);
    const assignBackdrop = document.getElementById('assign-session-backdrop');
    if (assignBackdrop) assignBackdrop.addEventListener('click', closeAssignModal);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalAssignSession && this.modalAssignSession.style.display === 'flex') {
        closeAssignModal();
      }
    });

    if (this.formAssignSession) {
      this.formAssignSession.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sessionPath = this.assignModalSessionPath ? this.assignModalSessionPath.value : '';
        const stationId = this.assignModalStationSelect ? this.assignModalStationSelect.value : '';
        if (!stationId) return;

        const submitBtn = document.getElementById('btn-submit-assign-session');
        const origText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Menerapkan...</span>';
        }

        try {
          const res = await window.api.assignStationSession(stationId, sessionPath);
          if (res.success) {
            this.log(`Stasiun dialihkan ke: ${res.assignedSessionName || 'Sesi Global'}`, 'success');
            window.showToast(`Sesi berhasil diarahkan ke stasiun target!`, 'success');
            closeAssignModal();
            await this.refreshStations();
            await this.refreshDirectorySessions();
          } else {
            window.showToast('Gagal mengalihkan sesi: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origText;
          }
        }
      });
    }

    // Operator Checkout Session Modal Events
    const closeCheckoutModal = () => {
      if (this.modalCheckoutSession) {
        this.modalCheckoutSession.style.display = 'none';
        document.body.style.overflow = '';
      }
    };

    if (this.checkoutSessionCloseBtn) this.checkoutSessionCloseBtn.addEventListener('click', closeCheckoutModal);
    if (this.btnCancelCheckoutSession) this.btnCancelCheckoutSession.addEventListener('click', closeCheckoutModal);
    if (this.checkoutSessionBackdrop) this.checkoutSessionBackdrop.addEventListener('click', closeCheckoutModal);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalCheckoutSession && this.modalCheckoutSession.style.display === 'flex') {
        closeCheckoutModal();
      }
    });

    if (this.formCheckoutSession) {
      this.formCheckoutSession.addEventListener('submit', async (e) => {
        e.preventDefault();
        const sessionPath = this.checkoutModalSessionPath ? this.checkoutModalSessionPath.value : '';
        const stationId = this.checkoutModalStationId ? this.checkoutModalStationId.value : '';
        const releaseStation = this.checkoutModalReleaseStation ? this.checkoutModalReleaseStation.checked : true;
        const submitBtn = document.getElementById('btn-submit-checkout-session');
        const origText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Menyelesaikan Sesi...</span>';
        }

        try {
          const res = await window.api.confirmCompleteSession(sessionPath, releaseStation, stationId || null);
          if (res.success) {
            const name = this.checkoutModalSessionName ? this.checkoutModalSessionName.textContent : 'Sesi';
            this.log(`Sesi telah diselesaikan oleh operator: ${name}`, 'success');
            window.showToast(`Sesi "${name}" berhasil diselesaikan dan di-checkout!`, 'success');
            closeCheckoutModal();
            await this.refreshDirectorySessions();
            await this.refreshStations();
            await this.refreshData();
          } else {
            window.showToast('Gagal menyelesaikan sesi: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origText;
          }
        }
      });
    }
  }

  openCheckoutModal(session) {
    if (!this.modalCheckoutSession || !session) return;
    const sessionName = session.name || session.sessionName || (session.path ? session.path.split(/[\\/]/).pop() : 'Sesi Studio');
    const sessionPath = session.path || session.sessionPath || '';

    // Determine assigned stations
    let stationNames = '';
    let firstStationId = '';
    if (session.assignedStations && session.assignedStations.length > 0) {
      stationNames = session.assignedStations.map(st => st.name || st).join(', ');
      firstStationId = session.assignedStations[0].id || '';
    } else if (this.stations && this.stations.length > 0) {
      const match = this.stations.filter(st => st.assignedSessionPath && sessionPath && st.assignedSessionPath.toLowerCase() === sessionPath.toLowerCase());
      if (match.length > 0) {
        stationNames = match.map(m => m.name).join(', ');
        firstStationId = match[0].id;
      }
    }

    const photoCount = session.photoCount !== undefined ? session.photoCount : (session.totalPhotos || 0);

    // Check print queue items for this session
    let queueStatusText = 'Belum ada antrean cetak';
    if (this.lastPrintData && Array.isArray(this.lastPrintData.sessions)) {
      const qMatch = this.lastPrintData.sessions.find(q => q.sessionPath && sessionPath && q.sessionPath.toLowerCase() === sessionPath.toLowerCase());
      if (qMatch && qMatch.totalItems > 0) {
        queueStatusText = `${qMatch.totalItems} Foto (${qMatch.totalCopies} lembar cetak)`;
      }
    } else if (session.totalItems !== undefined && session.totalItems > 0) {
      queueStatusText = `${session.totalItems} Foto (${session.totalCopies || session.totalItems} lembar cetak)`;
    }

    if (this.checkoutModalSessionName) this.checkoutModalSessionName.textContent = sessionName;
    if (this.checkoutModalSessionPath) this.checkoutModalSessionPath.value = sessionPath;
    if (this.checkoutModalStationId) this.checkoutModalStationId.value = firstStationId;
    if (this.checkoutModalPhotoCount) this.checkoutModalPhotoCount.textContent = `${photoCount} Foto Tersimpan`;
    if (this.checkoutModalQueueStatus) this.checkoutModalQueueStatus.textContent = queueStatusText;

    if (this.checkoutModalStationsBadge) {
      if (stationNames) {
        this.checkoutModalStationsBadge.textContent = `Aktif di: ${stationNames}`;
        this.checkoutModalStationsBadge.style.color = 'var(--accent-green)';
        this.checkoutModalStationsBadge.style.background = 'rgba(34, 197, 94, 0.12)';
      } else {
        this.checkoutModalStationsBadge.textContent = 'Tidak Terhubung ke PC Klien';
        this.checkoutModalStationsBadge.style.color = 'var(--text-muted)';
        this.checkoutModalStationsBadge.style.background = 'var(--bg-surface-elevated)';
      }
    }

    if (this.checkoutModalReleaseStation) {
      this.checkoutModalReleaseStation.checked = !!stationNames;
    }

    this.modalCheckoutSession.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  openAssignStationModal(session) {
    if (!this.modalAssignSession || !session) return;
    if (this.assignModalSessionName) this.assignModalSessionName.textContent = session.name;
    if (this.assignModalSessionPathText) this.assignModalSessionPathText.textContent = session.path;
    if (this.assignModalSessionPath) this.assignModalSessionPath.value = session.path;

    if (this.assignModalStationSelect) {
      if (!this.stations || this.stations.length === 0) {
        this.assignModalStationSelect.innerHTML = '<option value="" disabled>Belum ada stasiun PC klien terdaftar</option>';
      } else {
        this.assignModalStationSelect.innerHTML = this.stations.map(st => {
          const currentBinding = st.assignedSessionPath
            ? `(Saat ini: ${st.assignedSessionName || 'Sesi Lain'})`
            : `(Saat ini: Sesi Global)`;
          const isCurrent = st.assignedSessionPath === session.path;
          return `<option value="${st.id}" ${isCurrent ? 'selected' : ''}>${st.name} ${currentBinding}</option>`;
        }).join('');
      }
    }

    this.modalAssignSession.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  getActiveSessionName() {
    const activeDir = (this.directorySessions || []).find(d => d.isActive);
    if (activeDir) return activeDir.name;
    if (this.currentSessionData && this.currentSessionData.sessionName) return this.currentSessionData.sessionName;
    return 'Demo Studio';
  }

  /**
   * Fetch session directories and drive storage metrics
   */
  async refreshDirectorySessions() {
    try {
      const res = await window.api.getDirectorySessions();
      if (res && res.success) {
        this.renderDirectorySessions(res);
      }
    } catch (err) {
      console.warn('Gagal memuat direktori sesi:', err.message);
    }
  }

  /**
   * Render Session Directory Cards, Storage Info, and Thumbnail Strips
   */
  renderDirectorySessions(data, animate = true) {
    if (!data || !this.dirSessionsGrid) return;
    this.lastDirectoryData = data;
    this.directorySessions = data.sessions || [];
    this.directoryRootPath = data.rootPath || '';

    // Update Filter Tab Count Badges & Navigation Badges
    const totalAll = this.directorySessions.length;
    const totalActive = data.totalActive !== undefined
      ? data.totalActive
      : this.directorySessions.filter(s => s.status === 'active' || (s.assignedStations && s.assignedStations.length > 0 && !s.isCompleted)).length;
    const totalAvailable = data.totalAvailable !== undefined
      ? data.totalAvailable
      : this.directorySessions.filter(s => s.status === 'available' || (!s.isCompleted && (!s.assignedStations || s.assignedStations.length === 0))).length;
    const totalCompleted = data.totalCompleted !== undefined
      ? data.totalCompleted
      : this.directorySessions.filter(s => s.isCompleted).length;

    if (this.countFilterAll) this.countFilterAll.textContent = totalAll;
    if (this.countFilterActive) this.countFilterActive.textContent = totalActive;
    if (this.countFilterAvailable) this.countFilterAvailable.textContent = totalAvailable;
    if (this.countFilterCompleted) this.countFilterCompleted.textContent = totalCompleted;

    if (this.navSessionsBadge) {
      this.navSessionsBadge.textContent = totalActive;
      this.navSessionsBadge.classList.toggle('has-items', totalActive > 0);
    }
    if (this.mobileNavSessionsBadge) {
      this.mobileNavSessionsBadge.textContent = totalActive;
      this.mobileNavSessionsBadge.classList.toggle('has-items', totalActive > 0);
    }
    if (this.navDirectoriesBadge) {
      this.navDirectoriesBadge.textContent = totalActive;
    }
    if (this.mobileNavDirectoriesBadge) {
      this.mobileNavDirectoriesBadge.textContent = totalActive;
    }

    // Update Global KPI Stat Cards
    if (this.statActiveSessions) {
      this.statActiveSessions.textContent = totalActive;
    }
    if (this.statActiveSessionsPill) {
      this.statActiveSessionsPill.textContent = `${totalActive} Aktif di Stasiun (${totalAvailable} Tersedia)`;
    }
    if (this.statTotalStationsKpi) {
      this.statTotalStationsKpi.textContent = (this.stations || []).length;
    }
    if (this.statDirTotalSessions) {
      this.statDirTotalSessions.textContent = totalAll;
    }

    const activeSession = this.directorySessions.find(s => s.status === 'active' || (s.assignedStations && s.assignedStations.length > 0 && !s.isCompleted));
    if (this.statDirActiveName) {
      if (activeSession) {
        this.statDirActiveName.textContent = activeSession.name;
        this.statDirActiveName.title = activeSession.path;
      } else {
        this.statDirActiveName.textContent = '(Tidak Ada Sesi Aktif)';
        this.statDirActiveName.title = '';
      }
    }

    // Update Storage Info Gauge
    if (data.storageInfo) {
      const { freeGB, totalGB, usedPercent, driveLetter, isLowSpace } = data.storageInfo;
      if (this.statDirDiskFree) {
        this.statDirDiskFree.textContent = `${freeGB} Sisa (${driveLetter})`;
      }
      if (this.statDirDiskPercent) {
        this.statDirDiskPercent.textContent = `${usedPercent}% Terpakai dari ${totalGB}`;
      }
      if (this.dirDiskProgress) {
        this.dirDiskProgress.style.transform = `scaleX(${Math.min(100, Math.max(0, usedPercent)) / 100})`;
      }
      if (this.dirDiskWarning) {
        this.dirDiskWarning.style.display = isLowSpace ? 'block' : 'none';
      }
    }

    // Update Current Root Display
    if (this.dirCurrentRootPath) {
      this.dirCurrentRootPath.textContent = this.directoryRootPath || '-';
      this.dirCurrentRootPath.title = this.directoryRootPath || '';
    }
    if (this.createSessionRootDisplay) {
      this.createSessionRootDisplay.textContent = this.directoryRootPath || '-';
    }

    // Filter Sessions by Active Filter Tab (all / active / available / completed)
    let displaySessions = this.directorySessions;
    if (this.sessionFilter === 'active') {
      displaySessions = displaySessions.filter(s => s.status === 'active' || (s.assignedStations && s.assignedStations.length > 0 && !s.isCompleted));
    } else if (this.sessionFilter === 'available') {
      displaySessions = displaySessions.filter(s => s.status === 'available' || (!s.isCompleted && (!s.assignedStations || s.assignedStations.length === 0)));
    } else if (this.sessionFilter === 'completed') {
      displaySessions = displaySessions.filter(s => s.isCompleted);
    }

    // Filter Sessions by Search Query
    const query = (this.dirSessionsSearch ? this.dirSessionsSearch.value : '').trim().toLowerCase();
    const filteredSessions = query
      ? displaySessions.filter(s => s.name.toLowerCase().includes(query) || s.path.toLowerCase().includes(query))
      : displaySessions;

    // Empty state handling
    if (filteredSessions.length === 0) {
      this.dirSessionsGrid.innerHTML = '';
      if (this.dirEmptySessionsNotice) {
        this.dirEmptySessionsNotice.style.display = 'block';
        const titleEl = this.dirEmptySessionsNotice.querySelector('div');
        const pEl = this.dirEmptySessionsNotice.querySelector('p');
        if (query) {
          if (titleEl) titleEl.textContent = `Tidak Ditemukan Sesi "${query}"`;
          if (pEl) pEl.textContent = 'Silakan coba kata kunci pencarian lain atau buat folder sesi baru.';
        } else if (this.sessionFilter === 'active') {
          if (titleEl) titleEl.textContent = 'Tidak Ada Sesi yang Sedang Terhubung ke PC Klien';
          if (pEl) pEl.textContent = 'Hubungkan folder sesi yang tersedia ke PC klien melalui tombol "Hubungkan ke PC Klien" di tab Tersedia.';
        } else if (this.sessionFilter === 'available') {
          if (titleEl) titleEl.textContent = 'Tidak Ada Sesi Tersedia';
          if (pEl) pEl.textContent = 'Semua sesi photoshoot sedang aktif di PC klien atau telah selesai. Klik "+ Buat Sesi Baru" untuk sesi berikutnya.';
        } else if (this.sessionFilter === 'completed') {
          if (titleEl) titleEl.textContent = 'Belum Ada Sesi yang Selesai';
          if (pEl) pEl.textContent = 'Sesi yang telah dikonfirmasi selesai oleh operator akan muncul di sini.';
        } else {
          if (titleEl) titleEl.textContent = 'Belum Ada Folder Sesi Ditemukan';
          if (pEl) pEl.textContent = 'Tidak ada folder photoshoot di dalam direktori induk saat ini. Klik tombol "+ Buat Sesi Baru" di atas untuk membuat sesi foto pertama Anda.';
        }
      }
      return;
    }

    if (this.dirEmptySessionsNotice) {
      this.dirEmptySessionsNotice.style.display = 'none';
    }

    this.dirSessionsGrid.innerHTML = '';

    filteredSessions.forEach(s => {
      const card = document.createElement('div');
      card.className = `session-dir-card ${s.isCompleted ? 'is-completed' : (s.isCurrentActive ? 'is-active' : '')}`;
      if (s.isCompleted) {
        card.style.opacity = '0.85';
      }

      const dateStr = s.mtime
        ? new Date(s.mtime).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '-';

      // Thumbnail strip generator (up to 4 thumbnails)
      let thumbStripHtml = '';
      if (s.previewPhotos && s.previewPhotos.length > 0) {
        const thumbItems = s.previewPhotos.map(photo => {
          const thumbUrl = `/api/photo/${encodeURIComponent(photo)}/thumb?session=${encodeURIComponent(s.path)}`;
          return `
            <div class="session-thumb-item" title="${photo}">
              <img src="${thumbUrl}" alt="${photo}" loading="lazy" onerror="this.parentElement.style.display='none'"/>
            </div>
          `;
        }).join('');
        thumbStripHtml = `<div class="session-thumb-strip">${thumbItems}</div>`;
      } else {
        thumbStripHtml = `
          <div class="session-thumb-strip">
            <div class="session-thumb-empty-placeholder">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              <span>Belum ada foto di sesi ini</span>
            </div>
          </div>
        `;
      }

      let statusBadgeHtml = '';
      if (s.isCompleted) {
        statusBadgeHtml = `<span class="badge-station badge-station-offline" style="background: rgba(148, 163, 184, 0.12); color: var(--text-muted); border: 1px solid var(--border-subtle); font-weight: 700;">SELESAI</span>`;
      } else if (s.assignedStations && s.assignedStations.length > 0) {
        statusBadgeHtml = `<span class="badge-session-active"><span class="live-dot" style="width: 6px; height: 6px; background-color: var(--accent-green);"></span> AKTIF (${s.assignedStations.join(', ')})</span>`;
      } else if (s.isCurrentActive) {
        statusBadgeHtml = `<span class="badge-session-active"><span class="live-dot" style="width: 6px; height: 6px; background-color: var(--accent-green);"></span> AKTIF (PC Klien)</span>`;
      } else {
        statusBadgeHtml = `<span class="badge-session-active" style="background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.25); color: var(--accent-gold);"><span class="live-dot" style="width: 6px; height: 6px; background-color: var(--accent-gold);"></span> TERSEDIA</span>`;
      }

      const iconStroke = s.isCompleted
        ? 'var(--text-muted)'
        : (s.assignedStations && s.assignedStations.length > 0) || s.isCurrentActive
          ? 'var(--accent-green)'
          : 'var(--accent-gold)';

      card.innerHTML = `
        <div class="session-dir-header">
          <div class="session-dir-title-area">
            <h3 class="session-dir-title" title="${s.name}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconStroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>${s.name}</span>
            </h3>
            <div class="session-dir-time">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>Diperbarui: ${dateStr}</span>
            </div>
          </div>
          <div>
            ${statusBadgeHtml}
          </div>
        </div>

        <div class="session-dir-body">
          <div class="session-dir-path-row" title="${s.path}">
            <span class="session-dir-path-text">${s.path}</span>
            <button class="btn btn-sm btn-copy-dir-path" data-path="${s.path}" style="padding: 3px 8px; font-size: 0.72rem; flex-shrink: 0;" title="Salin path lengkap">
              Salin
            </button>
          </div>

          <div class="session-dir-meta-row">
            <span class="session-photo-count-pill">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                <circle cx="12" cy="13" r="4"></circle>
              </svg>
              <strong>${s.photoCount}</strong> Foto Tersimpan
            </span>
          </div>

          ${thumbStripHtml}

          ${(s.assignedStations && s.assignedStations.length > 0) ? `
            <div class="session-assigned-stations-row">
              <span class="assigned-stations-label">Dibuka di:</span>
              ${s.assignedStations.map(stName => `
                <span class="badge-station-binding">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                  <span>${stName}</span>
                </span>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div class="session-dir-footer">
          <div class="session-dir-actions-left">
            <button class="btn-dir-explorer" data-path="${s.path}" title="Buka folder sesi ini langsung di Windows Explorer komputer">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>Buka di Explorer</span>
            </button>
            <button class="btn-dir-gallery" data-path="${s.path}" title="Buka dan tinjau galeri foto sesi ini di layar klien">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <span>Galeri</span>
            </button>
            ${!s.isCompleted ? `
              <button class="btn-dir-assign-station" data-path="${s.path}" data-name="${s.name}" title="Hubungkan sesi folder ini ke salah satu stasiun PC klien">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
                <span>${(s.assignedStations && s.assignedStations.length > 0) ? 'Ganti Stasiun' : 'Hubungkan ke PC Klien'}</span>
              </button>
            ` : ''}
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            ${s.isCompleted ? `
              <button class="btn btn-sm btn-reopen-session" data-path="${s.path}" data-name="${s.name}" title="Buka kembali sesi ini menjadi aktif" style="font-size: 0.78rem; font-weight: 600; padding: 6px 12px; border-radius: var(--radius-sm); background: var(--color-blue-bg); border: 1px solid var(--color-blue-border); color: var(--accent-blue); cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 4v6h-6"></path>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                <span>Buka Kembali</span>
              </button>
            ` : `
              <button class="btn btn-sm btn-checkout-session" data-path="${s.path}" data-name="${s.name}" title="Konfirmasi penyelesaian sesi oleh operator (checkout pelanggan)" style="font-size: 0.78rem; font-weight: 600; padding: 6px 14px; border-radius: var(--radius-sm); background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); color: var(--accent-green); cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Konfirmasi Selesai</span>
              </button>
            `}
          </div>
        </div>
      `;

      // Wire Copy Path Button
      const copyBtn = card.querySelector('.btn-copy-dir-path');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const pathVal = copyBtn.getAttribute('data-path');
          if (navigator.clipboard && pathVal) {
            navigator.clipboard.writeText(pathVal).then(() => {
              copyBtn.textContent = 'Disalin!';
              setTimeout(() => { copyBtn.textContent = 'Salin'; }, 2000);
            });
          }
        });
      }

      // Wire Open in Explorer Button
      const explorerBtn = card.querySelector('.btn-dir-explorer');
      if (explorerBtn) {
        explorerBtn.addEventListener('click', async (e) => {
          if (e) e.stopPropagation();
          const p = explorerBtn.getAttribute('data-path') || s.path;
          try {
            const res = await window.api.openInExplorer(p);
            if (res.success) {
              window.showToast(`Membuka folder di Explorer: ${s.name}`, 'blue');
              this.log(`Folder dibuka di Windows Explorer: ${s.name}`, 'info');
            } else {
              window.showToast('Gagal membuka Explorer: ' + res.error, 'danger');
            }
          } catch (err) {
            window.showToast('Error: ' + err.message, 'danger');
          }
        });
      }

      // Wire Open Gallery Button
      const galleryBtn = card.querySelector('.btn-dir-gallery');
      if (galleryBtn) {
        galleryBtn.addEventListener('click', async () => {
          const p = galleryBtn.getAttribute('data-path');
          try {
            if (!s.isCurrentActive) {
              await window.api.setSessionFolder(p);
              await this.refreshData();
              await this.refreshDirectorySessions();
            }
            window.open('index.html', '_blank');
          } catch (err) {}
        });
      }

      // Wire Assign Station Button
      const assignStationBtn = card.querySelector('.btn-dir-assign-station');
      if (assignStationBtn) {
        assignStationBtn.addEventListener('click', () => {
          this.openAssignStationModal(s);
        });
      }

      // Wire Checkout Session Button (Operator Confirmation Modal)
      const checkoutBtn = card.querySelector('.btn-checkout-session');
      if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
          this.openCheckoutModal(s);
        });
      }

      // Wire Complete Session Button (Direct completion fallback if present)
      const completeBtn = card.querySelector('.btn-complete-session');
      if (completeBtn) {
        completeBtn.addEventListener('click', () => {
          this.openCheckoutModal(s);
        });
      }

      // Wire Reopen Session Button
      const reopenBtn = card.querySelector('.btn-reopen-session');
      if (reopenBtn) {
        reopenBtn.addEventListener('click', async () => {
          const p = reopenBtn.getAttribute('data-path');
          const name = reopenBtn.getAttribute('data-name');
          reopenBtn.disabled = true;
          reopenBtn.textContent = 'Membuka...';
          try {
            const res = await window.api.reopenSession(p);
            if (res.success) {
              this.log(`Sesi dibuka kembali: ${name}`, 'success');
              window.showToast(`Sesi "${name}" aktif kembali!`, 'success');
              await this.refreshDirectorySessions();
              await this.refreshStations();
            } else {
              window.showToast('Gagal membuka sesi: ' + res.error, 'danger');
              reopenBtn.disabled = false;
              reopenBtn.textContent = 'Buka Kembali';
            }
          } catch (err) {
            window.showToast('Error: ' + err.message, 'danger');
            reopenBtn.disabled = false;
            reopenBtn.textContent = 'Buka Kembali';
          }
        });
      }

      this.dirSessionsGrid.appendChild(card);
    });

    // GSAP Stagger Entrance
    if (animate && window.gsap) {
      const cards = this.dirSessionsGrid.querySelectorAll('.session-dir-card');
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion && cards.length > 0) {
        gsap.from(cards, {
          autoAlpha: 0,
          y: 10,
          duration: 0.22,
          stagger: 0.04,
          ease: 'power2.out',
          clearProps: 'transform,opacity,visibility'
        });
      }
    }
  }

  /* ===================================================================
   * SESSION TIMER & CUSTOMER PACING LOGIC
   * =================================================================== */

  initSessionTimer() {
    // Master Toggle Switch
    if (this.toggleTimerEnabled) {
      this.toggleTimerEnabled.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        try {
          const res = await window.api.updateTimerSettings({ enabled });
          if (res.success) {
            window.showToast(`Timer sesi ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`, 'info');
            this.renderTimerState(res.data);
          } else {
            window.showToast('Gagal mengubah status timer: ' + res.error, 'danger');
            e.target.checked = !enabled;
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
          e.target.checked = !enabled;
        }
      });
    }

    // Start / Pause / Resume Button
    if (this.btnTimerStartPause) {
      this.btnTimerStartPause.addEventListener('click', async () => {
        try {
          if (!this.timerState || !this.timerState.isRunning) {
            const res = await window.api.startTimer();
            if (res.success) {
              window.showToast('Timer sesi dimulai', 'success');
              this.renderTimerState(res.data);
            }
          } else if (this.timerState.isPaused) {
            const res = await window.api.resumeTimer();
            if (res.success) {
              window.showToast('Timer sesi dilanjutkan', 'info');
              this.renderTimerState(res.data);
            }
          } else {
            const res = await window.api.pauseTimer();
            if (res.success) {
              window.showToast('Timer sesi dijeda', 'info');
              this.renderTimerState(res.data);
            }
          }
        } catch (err) {
          window.showToast('Error timer: ' + err.message, 'danger');
        }
      });
    }

    // +5 Menit Quick Extension
    if (this.btnTimerAdd5) {
      this.btnTimerAdd5.addEventListener('click', async () => {
        try {
          const res = await window.api.addTimerTime(5);
          if (res.success) {
            window.showToast('Tambahan +5 menit berhasil diberikan', 'success');
            this.renderTimerState(res.data);
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
      });
    }

    // +10 Menit Quick Extension
    if (this.btnTimerAdd10) {
      this.btnTimerAdd10.addEventListener('click', async () => {
        try {
          const res = await window.api.addTimerTime(10);
          if (res.success) {
            window.showToast('Tambahan +10 menit berhasil diberikan', 'success');
            this.renderTimerState(res.data);
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
      });
    }

    // Reset Button
    if (this.btnTimerReset) {
      this.btnTimerReset.addEventListener('click', async () => {
        try {
          const res = await window.api.resetTimer();
          if (res.success) {
            window.showToast('Timer sesi di-reset ke durasi penuh', 'info');
            this.renderTimerState(res.data);
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
      });
    }

    // Stop Button
    if (this.btnTimerStop) {
      this.btnTimerStop.addEventListener('click', async () => {
        try {
          const res = await window.api.stopTimer();
          if (res.success) {
            window.showToast('Timer sesi dihentikan', 'info');
            this.renderTimerState(res.data);
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
      });
    }

    // Preset Duration Chips (10m, 15m, 20m, 30m)
    if (this.timerPresetChips) {
      this.timerPresetChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const mins = Number(chip.getAttribute('data-mins'));
          if (this.timerInputDuration) {
            this.timerInputDuration.value = mins;
          }
          this.timerPresetChips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        });
      });
    }

    // Settings Form Submission
    if (this.formTimerSettings) {
      this.formTimerSettings.addEventListener('submit', async (e) => {
        e.preventDefault();
        const durationMinutes = Number(this.timerInputDuration.value) || 15;
        const warningThresholdMinutes = Number(this.timerInputWarning.value) || 3;
        const lockOnExpiry = this.timerSelectMode.value === 'strict';
        const autoStartOnSessionChange = this.timerCheckAutostart.checked;
        const messageOnExpiry = this.timerInputMessage.value.trim();

        try {
          const res = await window.api.updateTimerSettings({
            durationMinutes,
            warningThresholdMinutes,
            lockOnExpiry,
            autoStartOnSessionChange,
            messageOnExpiry
          });
          if (res.success) {
            window.showToast('Pengaturan timer berhasil disimpan ke server', 'success');
            this.renderTimerState(res.data);
          } else {
            window.showToast('Gagal menyimpan pengaturan: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
      });
    }

    // Fetch initial timer state from server
    window.api.getTimer().then(res => {
      if (res && res.success && res.data) {
        this.renderTimerState(res.data);
      }
    }).catch(err => {
      console.warn('Gagal memuat status awal timer:', err);
    });
  }

  renderTimerTick(data) {
    if (!data) return;
    const timer = (data && data.timer) || data;
    this.timerState = timer;

    if (this.operatorTimerClock) {
      this.operatorTimerClock.textContent = timer.formattedTime || '00:00';
    }

    if (this.operatorTimerProgressFill) {
      const pct = timer.totalSeconds > 0 ? Math.max(0, Math.min(100, (timer.remainingSeconds / timer.totalSeconds) * 100)) : 0;
      this.operatorTimerProgressFill.style.transform = `scaleX(${pct / 100})`;
    }

    if (this.timerClockBox) {
      this.timerClockBox.classList.toggle('is-warning', !!timer.isWarning);
      this.timerClockBox.classList.toggle('is-expired', !!timer.isExpired);
      this.timerClockBox.classList.toggle('is-paused', !!timer.isPaused);
    }

    if (this.operatorTimerStatePill) {
      if (timer.isExpired) {
        this.operatorTimerStatePill.className = 'stat-pill stat-pill-red';
        this.operatorTimerStatePill.textContent = 'Waktu Habis';
      } else if (timer.isPaused) {
        this.operatorTimerStatePill.className = 'stat-pill stat-pill-amber';
        this.operatorTimerStatePill.textContent = 'Dijeda';
      } else if (timer.isWarning) {
        this.operatorTimerStatePill.className = 'stat-pill stat-pill-amber';
        this.operatorTimerStatePill.textContent = 'Sisa Menit Sedikit';
      } else if (timer.isRunning) {
        this.operatorTimerStatePill.className = 'stat-pill stat-pill-green';
        this.operatorTimerStatePill.textContent = 'Sedang Berjalan';
      } else {
        this.operatorTimerStatePill.className = 'stat-pill stat-pill-blue';
        this.operatorTimerStatePill.textContent = 'Siap Mulai';
      }
    }
  }

  renderTimerState(data) {
    if (!data) return;
    const timer = (data && data.timer) || data;
    this.timerState = timer;

    // Toggle switch & status badge
    if (this.toggleTimerEnabled) {
      this.toggleTimerEnabled.checked = !!timer.enabled;
    }
    if (this.timerStatusBadge) {
      this.timerStatusBadge.className = timer.enabled ? 'badge-station badge-station-online' : 'badge-station badge-station-offline';
      this.timerStatusBadge.textContent = timer.enabled ? 'Aktif' : 'Nonaktif';
    }
    if (this.operatorTimerActiveContainer) {
      this.operatorTimerActiveContainer.classList.toggle('is-disabled', !timer.enabled);
    }

    // Tick display elements
    this.renderTimerTick(timer);

    // Play/Pause button icons & label
    if (this.btnTimerStartPause) {
      if (timer.isRunning && !timer.isPaused) {
        if (this.iconTimerPlay) this.iconTimerPlay.style.display = 'none';
        if (this.iconTimerPause) this.iconTimerPause.style.display = 'inline-block';
        if (this.labelTimerStartPause) this.labelTimerStartPause.textContent = 'Jeda Timer';
        this.btnTimerStartPause.className = 'btn btn-secondary';
      } else if (timer.isPaused) {
        if (this.iconTimerPlay) this.iconTimerPlay.style.display = 'inline-block';
        if (this.iconTimerPause) this.iconTimerPause.style.display = 'none';
        if (this.labelTimerStartPause) this.labelTimerStartPause.textContent = 'Lanjutkan';
        this.btnTimerStartPause.className = 'btn btn-primary';
      } else {
        if (this.iconTimerPlay) this.iconTimerPlay.style.display = 'inline-block';
        if (this.iconTimerPause) this.iconTimerPause.style.display = 'none';
        if (this.labelTimerStartPause) this.labelTimerStartPause.textContent = 'Mulai Timer';
        this.btnTimerStartPause.className = 'btn btn-primary';
      }
    }

    // Form fields sync (only if user is not actively editing)
    if (this.timerInputDuration && document.activeElement !== this.timerInputDuration) {
      this.timerInputDuration.value = timer.durationMinutes || 15;
    }
    if (this.timerInputWarning && document.activeElement !== this.timerInputWarning) {
      this.timerInputWarning.value = timer.warningThresholdMinutes ?? 3;
    }
    if (this.timerSelectMode && document.activeElement !== this.timerSelectMode) {
      this.timerSelectMode.value = timer.lockOnExpiry ? 'strict' : 'polite';
    }
    if (this.timerCheckAutostart && document.activeElement !== this.timerCheckAutostart) {
      this.timerCheckAutostart.checked = !!timer.autoStartOnSessionChange;
    }
    if (this.timerInputMessage && document.activeElement !== this.timerInputMessage) {
      this.timerInputMessage.value = timer.messageOnExpiry || '';
    }

    // Preset chips sync
    if (this.timerPresetChips) {
      this.timerPresetChips.forEach(chip => {
        const mins = Number(chip.getAttribute('data-mins'));
        chip.classList.toggle('active', mins === timer.durationMinutes);
      });
    }

    // Info footer
    if (this.operatorTimerInfoText) {
      const modeText = timer.lockOnExpiry ? 'Mode: Kunci Layar Klien' : 'Mode: Ramah Pelanggan';
      this.operatorTimerInfoText.textContent = `Durasi: ${timer.durationMinutes} menit | Peringatan: ${timer.warningThresholdMinutes} menit terakhir | ${modeText}`;
    }
  }

  /**
   * Photostrip Template and Layout Manager
   */
  initPhotostripManager() {
    this.formPhotostripSettings = document.getElementById('form-photostrip-settings');
    this.inputPsEventTitle = document.getElementById('input-ps-event-title');
    this.inputPsStudioFooter = document.getElementById('input-ps-studio-footer');
    this.selectPsOutputFormat = document.getElementById('select-ps-output-format');
    this.checkPsShowDate = document.getElementById('check-ps-show-date');
    this.templatesCardsGrid = document.getElementById('templates-cards-grid');
    this.templatesCountBadge = document.getElementById('templates-count-badge');
    this.btnOpenTemplatesFolder = document.getElementById('btn-open-templates-folder');
    this.btnOpenUploadTemplate = document.getElementById('btn-open-upload-template');
    this.modalUploadTemplate = document.getElementById('modal-upload-template');
    this.uploadTemplateCloseBtn = document.getElementById('upload-template-close-btn');
    this.btnCancelUploadTemplate = document.getElementById('btn-cancel-upload-template');
    this.formUploadTemplate = document.getElementById('form-upload-template');
    this.templateUploadName = document.getElementById('template-upload-name');
    this.templateUploadSlots = document.getElementById('template-upload-slots');
    this.templateUploadFormat = document.getElementById('template-upload-format');
    this.templateDropZone = document.getElementById('template-drop-zone');
    this.templateDropText = document.getElementById('template-drop-text');
    this.templateFileInput = document.getElementById('template-file-input');
    this.btnSubmitUploadTemplate = document.getElementById('btn-submit-upload-template');

    // 1. Open Templates Folder in Explorer
    if (this.btnOpenTemplatesFolder) {
      this.btnOpenTemplatesFolder.addEventListener('click', async () => {
        try {
          const res = await window.api.openInExplorer('templates');
          if (res.success) {
            window.showToast('Folder templates dibuka di Windows Explorer', 'blue');
          } else {
            window.showToast('Gagal membuka folder templates: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
      });
    }

    // 2. Save Event Branding & Layout Settings
    if (this.formPhotostripSettings) {
      this.formPhotostripSettings.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = this.formPhotostripSettings.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        const updates = {
          eventTitle: this.inputPsEventTitle ? this.inputPsEventTitle.value.trim() : '',
          studioFooter: this.inputPsStudioFooter ? this.inputPsStudioFooter.value.trim() : '',
          outputFormat: this.selectPsOutputFormat ? this.selectPsOutputFormat.value : 'double_4r',
          showDate: this.checkPsShowDate ? this.checkPsShowDate.checked : true
        };
        try {
          const res = await window.api.savePhotostripConfig(updates);
          if (res.success) {
            window.showToast('Pengaturan branding photostrip berhasil disimpan!', 'success');
            this.log('Pengaturan branding photostrip diperbarui', 'success');
          } else {
            window.showToast('Gagal menyimpan pengaturan: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    // 3. Custom Template Upload Modal
    const openUploadModal = () => {
      if (this.modalUploadTemplate) {
        this.modalUploadTemplate.classList.add('active');
        this.modalUploadTemplate.setAttribute('aria-hidden', 'false');
      }
    };

    const closeUploadModal = () => {
      if (this.modalUploadTemplate) {
        this.modalUploadTemplate.classList.remove('active');
        this.modalUploadTemplate.setAttribute('aria-hidden', 'true');
      }
      if (this.formUploadTemplate && !this.btnSubmitUploadTemplate?.disabled) {
        this.formUploadTemplate.reset();
        selectedTemplateBase64 = null;
        if (this.templateDropText) this.templateDropText.textContent = 'Pilih File PNG atau Tarik ke Sini';
      }
    };

    if (this.btnOpenUploadTemplate) {
      this.btnOpenUploadTemplate.addEventListener('click', openUploadModal);
    }
    if (this.uploadTemplateCloseBtn) {
      this.uploadTemplateCloseBtn.addEventListener('click', closeUploadModal);
    }
    if (this.btnCancelUploadTemplate) {
      this.btnCancelUploadTemplate.addEventListener('click', closeUploadModal);
    }

    // File Drag & Drop / Input Picker
    let selectedTemplateBase64 = null;

    const handleTemplateFile = (file) => {
      if (!file || (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png'))) {
        selectedTemplateBase64 = null;
        if (this.templateFileInput) this.templateFileInput.value = '';
        window.showToast('File harus berformat PNG dengan area foto transparan', 'danger');
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        selectedTemplateBase64 = null;
        if (this.templateFileInput) this.templateFileInput.value = '';
        window.showToast('Ukuran file maksimal 25 MB', 'danger');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        selectedTemplateBase64 = e.target.result;
        if (this.templateDropText) {
          this.templateDropText.textContent = `File siap: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
        }
      };
      reader.onerror = () => window.showToast('Gagal membaca file PNG', 'danger');
      reader.readAsDataURL(file);
    };

    if (this.templateDropZone && this.templateFileInput) {
      this.templateDropZone.setAttribute('role', 'button');
      this.templateDropZone.setAttribute('tabindex', '0');
      this.templateDropZone.setAttribute('aria-label', 'Pilih file template PNG');
      this.templateDropZone.addEventListener('click', () => this.templateFileInput.click());
      this.templateDropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.templateFileInput.click();
        }
      });
      this.modalUploadTemplate?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeUploadModal();
      });

      this.templateDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.templateDropZone.style.borderColor = 'var(--accent-gold)';
        this.templateDropZone.style.background = 'rgba(217, 119, 6, 0.08)';
      });

      this.templateDropZone.addEventListener('dragleave', () => {
        this.templateDropZone.style.borderColor = 'var(--border-subtle)';
        this.templateDropZone.style.background = 'var(--bg-primary)';
      });

      this.templateDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        this.templateDropZone.style.borderColor = 'var(--border-subtle)';
        this.templateDropZone.style.background = 'var(--bg-primary)';
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleTemplateFile(e.dataTransfer.files[0]);
        }
      });

      this.templateFileInput.addEventListener('change', () => {
        if (this.templateFileInput.files && this.templateFileInput.files[0]) {
          handleTemplateFile(this.templateFileInput.files[0]);
        }
      });
    }

    // Submit Custom Template Form
    if (this.formUploadTemplate) {
      this.formUploadTemplate.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = this.templateUploadName ? this.templateUploadName.value.trim() : '';
        const slots = this.templateUploadSlots ? parseInt(this.templateUploadSlots.value, 10) : 3;
        const outputFormat = this.templateUploadFormat ? this.templateUploadFormat.value : 'double_4r';
        const selectedFile = this.templateFileInput?.files?.[0];
        const uploadFilename = selectedFile ? `${name}.png` : '';

        if (!name) {
          window.showToast('Nama template harus diisi', 'danger');
          return;
        }
        if (!selectedTemplateBase64) {
          window.showToast('Silakan pilih file PNG frame transparan terlebih dahulu', 'danger');
          return;
        }

        if (this.btnSubmitUploadTemplate) {
          this.btnSubmitUploadTemplate.disabled = true;
          this.btnSubmitUploadTemplate.innerHTML = 'Mengunggah Frame...';
        }

        try {
          const res = await window.api.uploadPhotostripTemplate({
            name,
            filename: uploadFilename,
            slots,
            outputFormat,
            imageBase64: selectedTemplateBase64
          });

          if (res.success) {
            window.showToast(`Template "${res.template.name}" berhasil diunggah dan siap digunakan!`, 'success');
            this.log(`Template strip kustom diunggah: ${res.template.name}`, 'success');
            closeUploadModal();
            this.formUploadTemplate.reset();
            selectedTemplateBase64 = null;
            if (this.templateDropText) {
              this.templateDropText.textContent = 'Pilih File PNG atau Tarik ke Sini';
            }
            await this.loadPhotostripTemplates();
          } else {
            window.showToast('Gagal mengunggah template: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        } finally {
          if (this.btnSubmitUploadTemplate) {
            this.btnSubmitUploadTemplate.disabled = false;
            this.btnSubmitUploadTemplate.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Simpan Template</span>
            `;
          }
        }
      });
    }
  }

  /**
   * Render Authentic Physical Photostrip Preview (Real DOM Components with Demo Portraits)
   */
  renderAuthenticTemplatePreview(tpl, config = {}) {
    const isGrid2x2 = tpl.layout === 'grid_2x2';
    const isSingle = tpl.outputFormat === 'single_strip';
    const isDouble = !isGrid2x2 && !isSingle;
    const isCustom = tpl.type === 'custom';

    const bgColor = /^#[0-9a-f]{6}$/i.test(tpl.bgColor || '') ? tpl.bgColor : '#ffffff';
    const textColor = tpl.textColor || '#18181b';
    const subTextColor = tpl.subTextColor || '#71717a';
    const accentColor = tpl.accentColor || '#2563eb';
    const borderColor = tpl.frameBorderColor || '#e4e4e7';
    const cuttingColor = tpl.cuttingColor || (tpl.theme === 'dark' ? '#3f3f46' : '#cbd5e1');

    const eventTitle = escapeHtml((config && config.eventTitle) || 'PHOTOBOOTH MEMORIES').toUpperCase();
    const studioFooter = escapeHtml((config && config.studioFooter) || 'RTFTP PHOTO STUDIO').toUpperCase();
    const showDate = config ? config.showDate !== false : true;
    const dateText = showDate ? new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : '';

    const demoPhotos = [
      '/demo_assets/STUDIO_001_16x9_MasterSet.jpg',
      '/demo_assets/STUDIO_002_16x9_FamilyGroup.jpg',
      '/demo_assets/STUDIO_003_16x9_FashionRunway.jpg',
      '/demo_assets/STUDIO_005_16x9_BeautyCinema.jpg'
    ];

    const slotsCount = tpl.slots || (isGrid2x2 ? 4 : 3);

    const renderSlotsHtml = () => {
      let html = '';
      for (let i = 0; i < slotsCount; i++) {
        const pSrc = demoPhotos[i % demoPhotos.length];
        html += `
          <div class="authentic-slot-box slots-${slotsCount}" style="border-color: ${borderColor};">
            <img src="${pSrc}" class="authentic-slot-img" alt="Foto Demo ${i + 1}" loading="lazy"/>
          </div>
        `;
      }
      return html;
    };

    let innerStrip = '';

    if (isGrid2x2) {
      innerStrip = `
        <div class="authentic-strip-wrapper authentic-grid-4r" style="background-color: ${bgColor}; color: ${textColor}; border-color: ${borderColor};">
          <div class="authentic-grid-header">
            <span class="authentic-baskara-bar"></span>
            <span class="authentic-grid-title" style="color: ${textColor};">${studioFooter || 'BASKARA STUDIO'}</span>
          </div>
          <div class="authentic-grid-slots">
            ${[0, 1, 2, 3].map(i => `
              <div class="authentic-grid-slot-item" style="border-color: ${borderColor};">
                <img src="${demoPhotos[i % demoPhotos.length]}" class="authentic-slot-img" alt="Demo ${i+1}"/>
                <div class="authentic-grid-slot-meta">
                  <span class="authentic-grid-slot-num" style="color: ${textColor};">${['-01', '02', '03', '04'][i]}</span>
                  <span class="authentic-grid-slot-date" style="color: ${subTextColor};">${dateText || '02.10.2026'}</span>
                </div>
              </div>
            `).join('')}
          </div>
          ${isCustom && tpl.overlayUrl ? `<img src="${tpl.overlayUrl}" class="authentic-overlay-img" alt="Frame Overlay"/>` : ''}
        </div>
      `;
    } else if (isSingle) {
      innerStrip = `
        <div class="authentic-strip-wrapper authentic-single-strip" style="background-color: ${bgColor}; color: ${textColor}; border-color: ${borderColor};">
          <div class="authentic-strip-content">
            <div class="authentic-strip-header">
              <div class="authentic-strip-event" style="color: ${textColor};">${eventTitle}</div>
              <div class="authentic-strip-divider" style="background-color: ${accentColor};"></div>
            </div>
            <div class="authentic-slots-col">
              ${renderSlotsHtml()}
            </div>
            <div class="authentic-strip-footer">
              <div class="authentic-strip-studio" style="color: ${subTextColor};">${studioFooter}</div>
              ${showDate ? `<div class="authentic-strip-date" style="color: ${accentColor};">${dateText}</div>` : ''}
            </div>
          </div>
          ${isCustom && tpl.overlayUrl ? `<img src="${tpl.overlayUrl}" class="authentic-overlay-img" alt="Frame Overlay"/>` : ''}
        </div>
      `;
    } else {
      // Double 4R
      const columnHtml = `
        <div class="authentic-strip-header">
          <div class="authentic-strip-event" style="color: ${textColor};">${eventTitle}</div>
          <div class="authentic-strip-divider" style="background-color: ${accentColor};"></div>
        </div>
        <div class="authentic-slots-col">
          ${renderSlotsHtml()}
        </div>
        <div class="authentic-strip-footer">
          <div class="authentic-strip-studio" style="color: ${subTextColor};">${studioFooter}</div>
          ${showDate ? `<div class="authentic-strip-date" style="color: ${accentColor};">${dateText}</div>` : ''}
        </div>
      `;

      innerStrip = `
        <div class="authentic-strip-wrapper authentic-double-4r" style="background-color: ${bgColor}; color: ${textColor}; border-color: ${borderColor};">
          <div class="authentic-strip-half left-half">
            ${columnHtml}
          </div>
          <div class="authentic-cutter-line" style="border-right-color: ${cuttingColor};">
            <span class="authentic-cutter-glyph" style="color: ${cuttingColor};">&#9986;</span>
          </div>
          <div class="authentic-strip-half right-half">
            ${columnHtml}
          </div>
          ${isCustom && tpl.overlayUrl ? `<img src="${tpl.overlayUrl}" class="authentic-overlay-img" alt="Frame Overlay"/>` : ''}
        </div>
      `;
    }

    return `
      <div class="authentic-strip-container">
        ${innerStrip}
      </div>
    `;
  }

  /**
   * Load and Render Photostrip Templates & Active Settings
   */
  async loadPhotostripTemplates() {
    try {
      const requestId = (this.photostripTemplatesRequestId || 0) + 1;
      this.photostripTemplatesRequestId = requestId;
      const res = await window.api.getPhotostripTemplates();
      if (requestId !== this.photostripTemplatesRequestId) return;
      if (!res.success) throw new Error(res.error || 'Gagal memuat template');

      const { templates = [], activeTemplateId, config } = res;

      // Sync Branding Form Fields (if not actively edited)
      if (config) {
        if (this.inputPsEventTitle && document.activeElement !== this.inputPsEventTitle) {
          this.inputPsEventTitle.value = config.eventTitle || 'PHOTOBOOTH MEMORIES';
        }
        if (this.inputPsStudioFooter && document.activeElement !== this.inputPsStudioFooter) {
          this.inputPsStudioFooter.value = config.studioFooter || 'RTFTP PHOTO STUDIO';
        }
        if (this.selectPsOutputFormat && document.activeElement !== this.selectPsOutputFormat) {
          this.selectPsOutputFormat.value = config.outputFormat || 'double_4r';
        }
        if (this.checkPsShowDate && document.activeElement !== this.checkPsShowDate) {
          this.checkPsShowDate.checked = config.showDate !== false;
        }
      }

      if (this.navTemplatesBadge) {
        this.navTemplatesBadge.textContent = templates.length;
      }
      if (this.mobileNavTemplatesBadge) {
        this.mobileNavTemplatesBadge.textContent = templates.length;
      }
      if (this.templatesCountBadge) {
        this.templatesCountBadge.textContent = `${templates.length} Template`;
      }

      // Render Template Cards
      if (!this.templatesCardsGrid) return;
      this.templatesCardsGrid.innerHTML = '';

      if (!Array.isArray(templates) || templates.length === 0) {
        this.templatesCardsGrid.textContent = 'Belum ada template tersedia.';
        return;
      }

      templates.forEach(tpl => {
        const isActive = tpl.id === activeTemplateId;
        const card = document.createElement('div');
        card.className = `card template-card ${isActive ? 'is-active-template' : ''}`;
        card.style.background = 'var(--bg-card)';
        card.style.border = isActive ? '2px solid var(--accent-gold)' : '1px solid var(--border-subtle)';
        card.style.borderRadius = 'var(--radius-md)';
        card.style.padding = '18px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'space-between';
        card.style.gap = '14px';
        card.style.position = 'relative';

        const isGrid2x2 = tpl.layout === 'grid_2x2';
        const isDouble = tpl.outputFormat !== 'single_strip' && !isGrid2x2;
        const isCustom = tpl.type === 'custom';
        const formatBadge = isGrid2x2 ? 'Grid 4R Postcard' : (isDouble ? 'Double 4R' : 'Single Strip');
        const originBadge = isCustom ? 'Kustom PNG' : 'Bawaan Studio';
        const originBg = isCustom ? 'var(--color-purple-bg)' : 'var(--color-blue-bg)';
        const originColor = isCustom ? 'var(--color-purple-text)' : 'var(--color-blue-text)';
        const originBorder = isCustom ? 'var(--color-purple-border)' : 'var(--color-blue-border)';

        const miniFramePreview = this.renderAuthenticTemplatePreview(tpl, config);

        card.innerHTML = `
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
              <div>
                <h4 style="margin: 0; font-size: 0.96rem; font-weight: 700; color: var(--text-main);">${escapeHtml(tpl.name)}</h4>
                <div style="display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap;">
                  <span class="badge-station" style="background: ${originBg}; color: ${originColor}; border-color: ${originBorder}; font-size: 0.72rem;">${originBadge}</span>
                  <span class="badge-station badge-station-lan" style="font-size: 0.72rem;">${tpl.slots || 3} Foto</span>
                  <span class="badge-station" style="background: rgba(255,255,255,0.06); font-size: 0.72rem;">${formatBadge}</span>
                </div>
              </div>
              ${isActive ? `
                <span class="stat-pill stat-pill-gold" style="font-size: 0.75rem; font-weight: 700;">Aktif</span>
              ` : ''}
            </div>

            ${miniFramePreview}

            <p style="font-size: 0.78rem; color: var(--text-muted); margin: 10px 0 0; line-height: 1.4;">
              ${escapeHtml(tpl.description || 'Template foto strip studio resolusi tinggi 300 DPI.')}
            </p>
          </div>

          <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px;">
            <button type="button" class="btn btn-sm ${isActive ? 'btn-gold' : 'btn-secondary'} btn-activate-template" style="flex: 1; justify-content: center; font-weight: 700;" ${isActive ? 'disabled' : ''}>
              ${isActive ? `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Sedang Digunakan</span>
              ` : `
                <span>Gunakan Sebagai Default</span>
              `}
            </button>
          </div>
        `;

        const btnActivate = card.querySelector('.btn-activate-template');
        if (btnActivate && !isActive) {
          btnActivate.addEventListener('click', async () => {
            try {
              const saveRes = await window.api.savePhotostripConfig({ activeTemplateId: tpl.id });
              if (saveRes.success) {
                window.showToast(`Template "${tpl.name}" sekarang aktif sebagai pilihan utama!`, 'success');
                this.log(`Template aktif dialihkan ke: ${tpl.name}`, 'success');
                await this.loadPhotostripTemplates();
              } else {
                window.showToast('Gagal mengaktifkan template: ' + saveRes.error, 'danger');
              }
            } catch (err) {
              window.showToast('Error: ' + err.message, 'danger');
            }
          });
        }

        this.templatesCardsGrid.appendChild(card);
      });
    } catch (err) {
      if (this.templatesCardsGrid) {
        this.templatesCardsGrid.replaceChildren();
        const message = document.createElement('p');
        message.textContent = `Gagal memuat template: ${err.message}`;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'btn btn-secondary';
        retry.textContent = 'Coba Lagi';
        retry.addEventListener('click', () => this.loadPhotostripTemplates());
        this.templatesCardsGrid.append(message, retry);
      }
      console.warn('Gagal memuat template photostrip:', err.message);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.operatorApp = new RTFTPOperator();
});
