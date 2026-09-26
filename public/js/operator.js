/**
 * RTFTP Studio - Operator Control Dashboard Controller
 * Multi-view left-sidebar navigation with persistent real-time WebSocket connection.
 */

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

    // Dedicated Directory Management Elements
    this.navDirectoriesBadge = document.getElementById('nav-directories-badge');
    this.mobileNavDirectoriesBadge = document.getElementById('mobile-nav-directories-badge');
    this.dirSessionsGrid = document.getElementById('dir-sessions-grid');
    this.dirEmptySessionsNotice = document.getElementById('dir-empty-sessions-notice');
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
    this.directorySessions = [];
    this.directoryRootPath = '';

    this.init();
  }

  async init() {
    this.initViewRouting();
    this.bindEvents();
    this.initFolderPicker();
    this.initStationsManager();
    this.initDirectoryManager();

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
   * Supports: #session (default), #queue, #logs
   */
  initViewRouting() {
    const viewMap = {
      '#session': 'view-session',
      '#directories': 'view-directories',
      '#queue': 'view-queue',
      '#stations': 'view-stations',
      '#logs': 'view-logs'
    };

    const viewTitles = {
      'view-session': 'Ringkasan Sesi',
      'view-directories': 'Direktori Sesi',
      'view-queue': 'Antrean Siap Cetak',
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

      if (updateHash) {
        for (const [hash, vId] of Object.entries(viewMap)) {
          if (vId === targetViewId) {
            history.replaceState(null, '', hash);
            break;
          }
        }
      }
    };

    // Nav Item Click Listener (Desktop + Mobile)
    this.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const viewId = item.getAttribute('data-view');
        switchView(viewId, true);
      });
    });

    // Handle Hash Changes
    window.addEventListener('hashchange', () => {
      const targetView = viewMap[window.location.hash] || 'view-session';
      switchView(targetView, false);
    });

    // Initial View from Hash
    const initialView = viewMap[window.location.hash] || 'view-session';
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
    // Save Folder Path
    document.getElementById('btn-save-folder').addEventListener('click', async () => {
      const newPath = this.sessionPathInput.value.trim();
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
  }

  bindWebSocketEvents() {
    window.api.on('INIT', (data) => {
      this.log('WebSocket terhubung dengan server lokal studio', 'success');
      const activePath = data.session ? data.session.activeSessionPath : null;
      this.renderSessionQueues(data.sessions || [], activePath);
      if (data.stations) {
        this.renderStations(data.stations);
      }
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
      } else if (data.report) {
        this.log(`Pesanan cetak diproses: ${data.report.totalCopies} lembar ke _SIAP_CETAK`, 'success');
      }
      this.refreshData();
    });

    window.api.on('SESSION_DIRECTORIES_UPDATED', (data) => {
      this.renderDirectorySessions(data);
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
        this.currentPathDisplay.textContent = session.activeSessionPath;
        this.sessionPathInput.value = session.activeSessionPath;
        this.renderRecentFolders(session.recentFolders || [], session.activeSessionPath);
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

      // Refresh Client Workstations
      await this.refreshStations();

      // Refresh Studio Session Directories
      await this.refreshDirectorySessions();
    } catch (e) {
      console.error('Error refreshing operator data:', e);
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

    // Filter sessions with pending items
    const sessionsWithItems = this.sessions.filter(s => s.totalItems > 0);

    if (sessionsWithItems.length === 0) {
      if (this.queueSessionsContainer) this.queueSessionsContainer.innerHTML = '';
      if (this.emptyTableNotice) this.emptyTableNotice.style.display = 'block';
      return;
    }

    if (this.emptyTableNotice) this.emptyTableNotice.style.display = 'none';
    if (!this.queueSessionsContainer) return;
    this.queueSessionsContainer.innerHTML = '';

    sessionsWithItems.forEach(session => {
      const isActive = session.isActive || (activeSessionPath && session.sessionPath.toLowerCase() === activeSessionPath.toLowerCase());
      const card = document.createElement('div');
      card.className = `session-queue-card ${isActive ? 'is-active-session' : ''}`;

      const iconClass = isActive ? 'session-icon-active' : 'session-icon-stored';
      const statusClass = isActive ? 'session-status-active' : 'session-status-stored';
      const statusLabel = isActive ? 'Sesi Aktif' : 'Tersimpan';

      const updateTimeText = session.latestSelectedAt
        ? `Update: ${new Date(session.latestSelectedAt).toLocaleTimeString('id-ID')}`
        : 'Update Baru';

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
          <div class="session-header-actions">
            ${!isActive ? `
              <button class="btn btn-sm btn-activate-session" data-path="${session.sessionPath}" title="Aktifkan sesi ini untuk layar klien">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Aktifkan Sesi
              </button>
            ` : ''}
            <button class="btn btn-sm btn-gold btn-export-session" data-path="${session.sessionPath}" title="Salin foto sesi ini ke _SIAP_CETAK">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              Salin ke _SIAP_CETAK
            </button>
            <button class="btn btn-sm btn-danger btn-reset-session" data-path="${session.sessionPath}" data-name="${session.sessionName}" title="Hapus semua pilihan foto pada sesi ini">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              Reset Sesi
            </button>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th style="width: 44px;">#</th>
                <th style="width: 68px;">Foto</th>
                <th>Nama File</th>
                <th>Ukuran & Jumlah</th>
                <th>Waktu Dipilih</th>
                <th style="text-align: right; width: 140px;">Aksi</th>
              </tr>
            </thead>
            <tbody class="session-table-body">
              <!-- Item rows -->
            </tbody>
          </table>
        </div>
      `;

      // Wire Header Action Buttons
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
              <span class="queue-inspect-chip">Lihat Detail ↗</span>
            </button>
          </td>
          <td style="padding: 12px 16px;">${sizesText}</td>
          <td style="padding: 12px 16px; font-size: 0.78rem; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">
            ${item.selectedAt ? new Date(item.selectedAt).toLocaleTimeString('id-ID') : '-'}
          </td>
          <td style="padding: 12px 16px; text-align: right;">
            <div style="display: inline-flex; align-items: center; gap: 6px;">
              <button type="button" class="btn-inspect-item" title="Lihat detail resolusi penuh">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                Detail
              </button>
              <button type="button" class="btn btn-sm btn-danger btn-remove-item" title="Batalkan foto ini dari antrean" aria-label="Batalkan foto ini">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.2" fill="none" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </td>
        `;

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
        this.sessionPathInput.value = folderPath;
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
          const startDir = this.selectedFolderPath || this.currentBrowsePath || this.sessionPathInput.value;
          const res = await window.api.openNativePicker(startDir);
          if (res.success && !res.canceled && res.selectedPath) {
            closeModal();

            if (typeof this.folderPickerCallback === 'function') {
              const cb = this.folderPickerCallback;
              this.folderPickerCallback = null;
              await cb(res.selectedPath);
              return;
            }

            this.sessionPathInput.value = res.selectedPath;
            const applyRes = await window.api.setSessionFolder(res.selectedPath);
            if (applyRes.success) {
              this.log(`Folder dipilih via Windows Explorer: ${res.selectedPath}`, 'success');
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
    if (this.btnOpenRootExplorer) {
      this.btnOpenRootExplorer.addEventListener('click', async () => {
        try {
          const res = await window.api.openInExplorer(this.directoryRootPath);
          if (res.success) {
            window.showToast(`Membuka folder induk di Windows Explorer`, 'blue');
            this.log(`Membuka folder induk di Windows Explorer: ${res.openedPath}`, 'info');
          } else {
            window.showToast('Gagal membuka Explorer: ' + res.error, 'danger');
          }
        } catch (err) {
          window.showToast('Error: ' + err.message, 'danger');
        }
      });
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

    // Refresh Directory Sessions Button
    if (this.btnRefreshDirSessions) {
      this.btnRefreshDirSessions.addEventListener('click', async () => {
        await this.refreshDirectorySessions();
        window.showToast('Daftar sesi diperbarui', 'info');
      });
    }
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

    // Update Navigation Badges
    const count = this.directorySessions.length;
    if (this.navDirectoriesBadge) {
      this.navDirectoriesBadge.textContent = count;
      this.navDirectoriesBadge.classList.toggle('has-items', count > 0);
    }
    if (this.mobileNavDirectoriesBadge) {
      this.mobileNavDirectoriesBadge.textContent = count;
      this.mobileNavDirectoriesBadge.classList.toggle('has-items', count > 0);
    }

    // Update Metric Stat Cards
    if (this.statDirTotalSessions) {
      this.statDirTotalSessions.textContent = count;
    }

    const activeSession = this.directorySessions.find(s => s.isActive);
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
        this.dirDiskProgress.style.width = `${Math.min(100, Math.max(0, usedPercent))}%`;
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

    // Filter Sessions by Search Query
    const query = (this.dirSessionsSearch ? this.dirSessionsSearch.value : '').trim().toLowerCase();
    const filteredSessions = query
      ? this.directorySessions.filter(s => s.name.toLowerCase().includes(query) || s.path.toLowerCase().includes(query))
      : this.directorySessions;

    // Empty state handling
    if (filteredSessions.length === 0) {
      this.dirSessionsGrid.innerHTML = '';
      if (this.dirEmptySessionsNotice) {
        this.dirEmptySessionsNotice.style.display = 'block';
        if (query) {
          const titleEl = this.dirEmptySessionsNotice.querySelector('div');
          const pEl = this.dirEmptySessionsNotice.querySelector('p');
          if (titleEl) titleEl.textContent = `Tidak Ditemukan Sesi "${query}"`;
          if (pEl) pEl.textContent = 'Silakan coba kata kunci pencarian lain atau buat folder sesi baru.';
        } else {
          const titleEl = this.dirEmptySessionsNotice.querySelector('div');
          const pEl = this.dirEmptySessionsNotice.querySelector('p');
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
      card.className = `session-dir-card ${s.isActive ? 'is-active' : ''}`;

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

      card.innerHTML = `
        <div class="session-dir-header">
          <div class="session-dir-title-area">
            <h3 class="session-dir-title" title="${s.name}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${s.isActive ? 'var(--accent-gold)' : 'currentColor'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
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
            ${s.isActive
              ? `<span class="badge-session-active"><span class="live-dot" style="width: 6px; height: 6px; background-color: var(--accent-green);"></span> SESI AKTIF</span>`
              : `<span class="badge-session-archive">TERSEDIA</span>`
            }
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
          </div>

          <div>
            ${s.isActive
              ? `<button class="btn-dir-activate is-current" disabled title="Sesi ini sedang aktif digunakan">✓ Sesi Aktif</button>`
              : `<button class="btn-dir-activate btn-make-active" data-path="${s.path}" data-name="${s.name}" title="Jadikan folder ini sebagai sesi aktif untuk klien dan operator">Jadikan Sesi Aktif</button>`
            }
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
        explorerBtn.addEventListener('click', async () => {
          const p = explorerBtn.getAttribute('data-path');
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
          if (!s.isActive) {
            try {
              await window.api.setSessionFolder(p);
              await this.refreshData();
              await this.refreshDirectorySessions();
            } catch (err) {}
          }
          window.location.hash = '#session';
        });
      }

      // Wire Make Active Button
      const activateBtn = card.querySelector('.btn-make-active');
      if (activateBtn) {
        activateBtn.addEventListener('click', async () => {
          const p = activateBtn.getAttribute('data-path');
          const name = activateBtn.getAttribute('data-name');
          activateBtn.disabled = true;
          activateBtn.textContent = 'Mengaktifkan...';

          try {
            const res = await window.api.setSessionFolder(p);
            if (res.success) {
              this.log(`Sesi aktif dialihkan ke: ${name}`, 'success');
              window.showToast(`Sesi photoshoot "${name}" sekarang aktif!`, 'success');
              await this.refreshData();
              await this.refreshDirectorySessions();
            } else {
              window.showToast('Gagal mengaktifkan sesi: ' + res.error, 'danger');
              activateBtn.disabled = false;
              activateBtn.textContent = 'Jadikan Sesi Aktif';
            }
          } catch (err) {
            window.showToast('Error: ' + err.message, 'danger');
            activateBtn.disabled = false;
            activateBtn.textContent = 'Jadikan Sesi Aktif';
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
}

document.addEventListener('DOMContentLoaded', () => {
  window.operatorApp = new RTFTPOperator();
});
