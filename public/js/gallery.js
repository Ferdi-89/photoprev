/**
 * RTFTP Studio - Main Gallery & Real-time Live Stream Controller
 */

class RTFTPGallery {
  constructor() {
    this.photos = [];
    this.activeFilter = 'all'; // 'all' | 'selected'
    this.currentGridCols = 'cols-4';

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
              { scale: 0.94, y: -12, outline: "2px solid #1d4ed8" },
              { scale: 1, y: 0, outline: "2px solid transparent", duration: 0.35, ease: "power2.out", clearProps: "outline,transform" }
            );
          }
        }
      }
    });

    window.api.on('PHOTO_REMOVED', (data) => {
      if (data.filename) {
        this.photos = this.photos.filter(p => p.filename !== data.filename);
        window.compareManager.setPhotos(this.photos);
        this.render();
        window.showToast('Foto telah dihapus dari galeri', 'info');
      }
    });

    window.api.on('SESSION_CHANGED', (data) => {
      if (data.sessionName && this.sessionNameEl) {
        this.sessionNameEl.textContent = data.sessionName;
      }
      if (data.photos) {
        this.photos = data.photos;
        window.compareManager.setPhotos(this.photos);
      }
      window.selectionManager.initFromData([]);
      this.render();
      window.showToast(`Sesi berganti ke: ${data.sessionName}`, 'blue');
    });

    window.api.on('SELECTION_UPDATED', (data) => {
      if (data.selections) {
        window.selectionManager.initFromData(data.selections);
        if (this.activeFilter === 'selected') {
          this.render();
        }
      }
    });

    window.api.on('SELECTION_CLEARED', () => {
      window.selectionManager.initFromData([]);
      if (this.activeFilter === 'selected') {
        this.render();
      }
    });
  }

  async loadInitialData() {
    try {
      const session = await window.api.getSession();
      if (session.success) {
        if (this.sessionNameEl) this.sessionNameEl.textContent = session.sessionName || 'Sesi Studio';
        if (session.printSizes) {
          window.selectionManager.setAvailableSizes(session.printSizes);
        }
      }

      const photoRes = await window.api.getPhotos();
      if (photoRes.success) {
        this.photos = photoRes.photos;
        window.compareManager.setPhotos(this.photos);
      }

      const selRes = await window.api.getSelections();
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

      card.innerHTML = `
        <div class="photo-img-wrapper" ${aspectStyle}>
          <img src="/api/photo/${encodeURIComponent(photo.filename)}/thumb" alt="Foto ${photo.filename}" loading="lazy"/>
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

      // Tap/Click photo thumbnail -> Open Lightbox for high-resolution inspection
      const imgWrapper = card.querySelector('.photo-img-wrapper');
      imgWrapper.addEventListener('click', (e) => {
        if (e.target.closest('.card-select-chip') || e.target.closest('.btn-compare-toggle') || e.target.closest('.btn-zoom-preview')) return;
        window.lightbox.open(filtered, index);
      });

      // Tap/Click select chip -> Toggle print selection directly
      const selectChip = card.querySelector('.card-select-chip');
      if (selectChip) {
        selectChip.addEventListener('click', (e) => {
          e.stopPropagation();
          window.selectionManager.toggleSelect(photo.filename);
        });
      }

      // Keyboard Accessibility: Enter = Inspect (Lightbox), Space = Toggle Select
      card.addEventListener('keydown', (e) => {
        if (e.target === card) {
          if (e.key === 'Enter') {
            e.preventDefault();
            window.lightbox.open(filtered, index);
          } else if (e.key === ' ') {
            e.preventDefault();
            window.selectionManager.toggleSelect(photo.filename);
          }
        }
      });

      // Explicit zoom button
      const zoomBtn = card.querySelector('.btn-zoom-preview');
      if (zoomBtn) {
        zoomBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.lightbox.open(filtered, index);
        });
      }

      // Click Compare toggle
      const compBtn = card.querySelector('.btn-compare-toggle');
      if (compBtn) {
        compBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.compareManager.toggle(photo.filename);
        });
      }

      // Genjutsu 3D Perspective Tilt on Desktop Hover
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        card.addEventListener('mousemove', (e) => {
          if (!window.gsap) return;
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;
          const tiltX = (y / (rect.height / 2)) * -4;
          const tiltY = (x / (rect.width / 2)) * 4;
          gsap.to(card, {
            rotationX: tiltX,
            rotationY: tiltY,
            transformPerspective: 900,
            duration: 0.16,
            ease: "power1.out"
          });
        });

        card.addEventListener('mouseleave', () => {
          if (!window.gsap) return;
          gsap.to(card, {
            rotationX: 0,
            rotationY: 0,
            duration: 0.32,
            ease: "power2.out",
            clearProps: "transform"
          });
        });
      }

      this.container.appendChild(card);
    });

    // GSAP Stagger Entrance for Gallery Cards
    if (window.gsap) {
      const cards = this.container.querySelectorAll('.photo-card');
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion && cards.length > 0) {
        gsap.fromTo(cards,
          { autoAlpha: 0, y: 16, scale: 0.97 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.28,
            stagger: { amount: Math.min(0.24, cards.length * 0.025), from: "start" },
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
