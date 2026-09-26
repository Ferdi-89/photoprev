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

    this.init();
  }

  async init() {
    this.initViewRouting();
    this.bindEvents();

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
      '#queue': 'view-queue',
      '#logs': 'view-logs'
    };

    const viewTitles = {
      'view-session': 'Folder & Sesi',
      'view-queue': 'Antrean Siap Cetak',
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
}

document.addEventListener('DOMContentLoaded', () => {
  window.operatorApp = new RTFTPOperator();
});
