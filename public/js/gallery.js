/**
 * RTFTP Studio - Main Gallery & Real-time Live Stream Controller
 */

class RTFTPGallery {
  constructor() {
    this.photos = [];
    this.activeFilter = 'all'; // 'all' | 'selected'
    this.currentGridCols = 'cols-4';

    const urlParams = new URLSearchParams(window.location.search);
    this.stationId = urlParams.get('station') || null;
    this.currentSessionPath = urlParams.get('session') || null;

    this.container = document.getElementById('gallery-grid');
    this.emptyState = document.getElementById('empty-gallery');
    this.sessionNameEl = document.getElementById('session-name-display');
    this.countAllBadge = document.getElementById('count-all');

    this.init();
  }

  async init() {
    this.bindEvents();

    // Connect WebSocket with reactive connection status tracking
    window.api.connectWebSocket((isConnected) => {
      this.updateConnectionStatus(isConnected);
      if (isConnected) {
        if (this.stationId && window.api.ws && window.api.ws.readyState === WebSocket.OPEN) {
          window.api.ws.send(JSON.stringify({
            type: 'REGISTER_STATION',
            stationId: this.stationId
          }));
        }
      }
    });

    // Listen to WebSocket events
    this.bindWebSocketEvents();

    // Initial Load via REST
    await this.loadInitialData();
  }

  updateConnectionStatus(isConnected) {
    const pill = document.getElementById('client-conn-pill');
    const dot = document.getElementById('client-live-dot');
    const label = document.getElementById('client-conn-label');

    if (!pill || !dot || !label) return;

    if (isConnected) {
      pill.classList.remove('is-offline');
      dot.style.backgroundColor = 'var(--accent-green)';
      label.textContent = 'Live Sync';
      pill.title = 'Terhubung ke server studio (WebSocket Aktif)';
    } else {
      pill.classList.add('is-offline');
      dot.style.backgroundColor = 'var(--accent-red)';
      label.textContent = 'Terputus';
      pill.title = 'Koneksi ke server terputus. Mencoba menghubungkan kembali...';
      if (window.showToast) {
        window.showToast('Koneksi studio terputus. Menghubungkan ulang...', 'warning', 4000);
      }
    }
  }

  bindEvents() {
    // Filter Tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active', 'gold'));
        const filter = e.target.getAttribute('data-filter');
        this.activeFilter = filter;
        e.target.classList.add('active');
        this.render();
      });
    });

    // Grid Column Size Buttons
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const cols = e.target.getAttribute('data-cols');
        this.currentGridCols = `cols-${cols}`;
        this.container.className = `gallery-grid ${this.currentGridCols}`;
      });
    });

    // Open Compare Button
    const compareBtn = document.getElementById('open-compare-btn');
    if (compareBtn) {
      compareBtn.addEventListener('click', () => {
        window.compareManager.open();
      });
    }
  }

  bindWebSocketEvents() {
    window.api.on('INIT', (data) => {
      if (data.session) {
        if (data.session.activeSessionPath) {
          this.currentSessionPath = data.session.activeSessionPath;
        }
        if (this.sessionNameEl) this.sessionNameEl.textContent = data.session.sessionName || 'Demo Studio';
        if (data.session.printSizes) {
          window.selectionManager.setAvailableSizes(data.session.printSizes);
        }
      }
      if (data.photos) {
        this.photos = data.photos;
        window.compareManager.setPhotos(this.photos);
      }
      if (data.selections) {
        window.selectionManager.initFromData(data.selections);
      }
      this.render();
    });

    window.api.on('PHOTO_ADDED', (data) => {
      if (data.sessionPath && this.currentSessionPath && data.sessionPath !== this.currentSessionPath) {
        return;
      }
      if (data.photo) {
        this.photos = this.photos.filter(p => p.filename !== data.photo.filename);
        this.photos.unshift(data.photo);
        window.compareManager.setPhotos(this.photos);
        this.render();
        window.showToast('Foto baru ditambahkan ke galeri', 'blue');

        // GSAP spotlight entrance for the newly arrived live photo
        if (window.gsap) {
          const cardId = `card-${data.photo.filename.replace(/[^a-zA-Z0-9]/g, '_')}`;
          const newCard = document.getElementById(cardId);
          if (newCard) {
            gsap.fromTo(newCard,
              { y: -10, outline: "2px solid #1d4ed8" },
              { y: 0, outline: "2px solid transparent", duration: 0.35, ease: "power2.out", clearProps: "outline,transform" }
            );
          }
        }
      }
    });

    window.api.on('PHOTO_REMOVED', (data) => {
      if (data.sessionPath && this.currentSessionPath && data.sessionPath !== this.currentSessionPath) {
        return;
      }
      if (data.filename) {
        this.photos = this.photos.filter(p => p.filename !== data.filename);
        window.compareManager.setPhotos(this.photos);
        this.render();
        window.showToast('Foto telah dihapus dari galeri', 'info');
      }
    });

    window.api.on('SESSION_ASSIGNED', async (data) => {
      if (this.stationId && data.stationId === this.stationId) {
        this.currentSessionPath = data.sessionPath;
        if (this.sessionNameEl) this.sessionNameEl.textContent = data.sessionName || 'Sesi Studio';
        if (data.photos) {
          this.photos = data.photos;
          window.compareManager.setPhotos(this.photos);
        } else {
          const photoRes = await window.api.getPhotos(this.stationId, this.currentSessionPath);
          if (photoRes.success) {
            this.photos = photoRes.photos;
            window.compareManager.setPhotos(this.photos);
          }
        }
        if (data.selections) {
          window.selectionManager.initFromData(data.selections);
        } else {
          const selRes = await window.api.getSelections(this.stationId, this.currentSessionPath);
          if (selRes.success) {
            window.selectionManager.initFromData(selRes.selections);
          } else {
            window.selectionManager.initFromData([]);
          }
        }
        window.compareManager.clear();
        this.render();
        window.showToast(`Sesi dialihkan ke: ${data.sessionName}`, 'blue', 3500);
      }
    });

    window.api.on('SESSION_CHANGED', (data) => {
      // If station has specific custom session assigned that doesn't match this change, ignore
      if (data.sessionPath && this.currentSessionPath && data.sessionPath !== this.currentSessionPath) {
        return;
      }
      if (data.sessionPath) {
        this.currentSessionPath = data.sessionPath;
      }
      if (data.sessionName && this.sessionNameEl) {
        this.sessionNameEl.textContent = data.sessionName;
      }
      if (data.photos) {
        this.photos = data.photos;
        window.compareManager.setPhotos(this.photos);
      }
      window.compareManager.clear();
      window.selectionManager.initFromData([]);
      this.render();
      window.showToast(`Sesi berganti ke: ${data.sessionName}`, 'blue');
    });

    window.api.on('SELECTION_UPDATED', (data) => {
      if (data.sessionPath && this.currentSessionPath && data.sessionPath !== this.currentSessionPath) {
        return;
      }
      if (data.selections) {
        window.selectionManager.initFromData(data.selections);
        if (this.activeFilter === 'selected') {
          this.render();
        }
      }
    });

    window.api.on('SELECTION_CLEARED', (data) => {
      if (data && data.sessionPath && this.currentSessionPath && data.sessionPath !== this.currentSessionPath) {
        return;
      }
      window.selectionManager.initFromData([]);
      if (this.activeFilter === 'selected') {
        this.render();
      }
    });

    window.api.on('RELOAD_CLIENT', () => {
      window.showToast('Memuat ulang layar dari operator...', 'blue', 1500);
      setTimeout(() => window.location.reload(), 500);
    });

    window.api.on('STATION_DEACTIVATED', (data) => {
      window.showToast(data.message || 'Stasiun ini telah dinonaktifkan oleh operator.', 'danger', 8000);
    });
  }

  async loadInitialData() {
    try {
      const session = await window.api.getSession(this.stationId, this.currentSessionPath);
      if (session.success) {
        if (session.activeSessionPath) {
          this.currentSessionPath = session.activeSessionPath;
        }
        if (this.sessionNameEl) this.sessionNameEl.textContent = session.sessionName || 'Sesi Studio';
        if (session.printSizes) {
          window.selectionManager.setAvailableSizes(session.printSizes);
        }
      }

      const photoRes = await window.api.getPhotos(this.stationId, this.currentSessionPath);
      if (photoRes.success) {
        this.photos = photoRes.photos;
        window.compareManager.setPhotos(this.photos);
      }

      const selRes = await window.api.getSelections(this.stationId, this.currentSessionPath);
      if (selRes.success) {
        window.selectionManager.initFromData(selRes.selections);
      }

      this.render();
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }

  getFilteredPhotos() {
    if (this.activeFilter === 'selected') {
      return this.photos.filter(p => window.selectionManager.isSelected(p.filename));
    }
    return this.photos;
  }

  render() {
    const filtered = this.getFilteredPhotos();

    // Update count badges
    this.countAllBadge.textContent = this.photos.length;
    document.getElementById('count-selected').textContent = window.selectionManager.totalItems;

    if (filtered.length === 0) {
      this.container.innerHTML = '';
      this.emptyState.style.display = 'flex';
      const emptyTitle = this.emptyState.querySelector('.empty-title');
      const emptySubtitle = this.emptyState.querySelector('.empty-subtitle');
      if (this.activeFilter === 'selected') {
        if (emptyTitle) emptyTitle.textContent = 'Belum Ada Foto Terpilih';
        if (emptySubtitle) emptySubtitle.textContent = 'Klik foto di galeri untuk memilih foto yang ingin dicetak.';
      } else {
        if (emptyTitle) emptyTitle.textContent = 'Belum Ada Foto dalam Sesi Ini';
        if (emptySubtitle) emptySubtitle.textContent = 'Foto akan otomatis tampil secara real-time saat kamera mentransfer file ke folder sesi.';
      }
      return;
    }

    this.emptyState.style.display = 'none';
    this.container.className = `gallery-grid ${this.currentGridCols}`;
    this.container.innerHTML = '';

    filtered.forEach((photo, index) => {
      const isSelected = window.selectionManager.isSelected(photo.filename);
      const inCompare = window.compareManager.isCompared(photo.filename);
      const isLandscape = (photo.aspectRatio && parseFloat(photo.aspectRatio) > 1.05) || (photo.width > photo.height);

      const card = document.createElement('div');
      card.className = `photo-card ${isLandscape ? 'is-landscape' : 'is-portrait'} ${isSelected ? 'selected' : ''} ${inCompare ? 'in-compare' : ''}`;
      card.setAttribute('data-filename', photo.filename);
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      card.setAttribute('aria-label', `Foto ${photo.filename}, ${isSelected ? 'terpilih' : 'belum dipilih'}`);
      card.id = `card-${photo.filename.replace(/[^a-zA-Z0-9]/g, '_')}`;

      const aspectStyle = (photo.width && photo.height)
        ? `style="aspect-ratio: ${photo.width} / ${photo.height};"`
        : '';
      const sQuery = this.currentSessionPath
        ? `?session=${encodeURIComponent(this.currentSessionPath)}`
        : (this.stationId ? `?station=${encodeURIComponent(this.stationId)}` : '');
      const photoSrc = `/api/photo/${encodeURIComponent(photo.filename)}/original${sQuery}`;

      card.innerHTML = `
        <div class="photo-img-wrapper" ${aspectStyle}>
          <img src="${photoSrc}" alt="Foto ${photo.filename}" loading="lazy"/>
          <div class="card-chrome-top">
            <span class="card-frame-seq">#${String(index + 1).padStart(3, '0')}</span>
            <button type="button" class="card-select-chip ${isSelected ? 'active' : ''}" title="${isSelected ? 'Batalkan pilihan cetak' : 'Pilih untuk dicetak'}" aria-label="Pilih foto ${photo.filename} untuk dicetak" aria-pressed="${isSelected}">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
          </div>
          <div class="card-overlay">
            <div class="overlay-actions">
              <button type="button" class="btn-compare-toggle" title="Tambah ke perbandingan" aria-label="Bandingkan foto ${photo.filename}">
                <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
              <button type="button" class="btn-zoom-preview" title="Lihat detail & deep zoom" aria-label="Perbesar foto ${photo.filename}">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </button>
            </div>
          </div>
        </div>
      `;

      // Primary Action: Clicking/tapping the card toggles print selection cleanly
      card.addEventListener('click', (e) => {
        // Prevent selection if clicking the explicit zoom or compare buttons
        if (e.target.closest('.btn-zoom-preview') || e.target.closest('.btn-compare-toggle')) return;
        window.selectionManager.toggleSelect(photo.filename);
      });

      // Keyboard Accessibility: Enter or Space on the card toggles print selection
      card.addEventListener('keydown', (e) => {
        if (e.target === card) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            window.selectionManager.toggleSelect(photo.filename);
          }
        }
      });

      // Dedicated Fullscreen Preview Button -> Opens Lightbox modal
      const zoomBtn = card.querySelector('.btn-zoom-preview');
      if (zoomBtn) {
        zoomBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.lightbox.open(filtered, index);
        });
      }

      // Dedicated Compare toggle button
      const compBtn = card.querySelector('.btn-compare-toggle');
      if (compBtn) {
        compBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.compareManager.toggle(photo.filename);
        });
      }

      this.container.appendChild(card);
    });

    // GSAP Stagger Entrance for Gallery Cards (Crisp opacity & Y translation without image scale)
    if (window.gsap) {
      const cards = this.container.querySelectorAll('.photo-card');
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion && cards.length > 0) {
        gsap.fromTo(cards,
          { autoAlpha: 0, y: 12 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.22,
            stagger: { amount: Math.min(0.2, cards.length * 0.02), from: "start" },
            ease: "power2.out",
            clearProps: "transform,opacity,visibility"
          }
        );
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.galleryApp = new RTFTPGallery();
});
