/**
 * RTFTP Studio - Lightbox & Deep Zoom Engine (Studio Mojave)
 * High-clarity full-resolution photo inspection suite.
 */

class RTFTPLightbox {
  constructor() {
    this.modal = document.getElementById('lightbox-modal');
    this.viewport = document.getElementById('lightbox-viewport');
    this.img = document.getElementById('lightbox-img');
    this.counter = document.getElementById('lightbox-index');
    this.zoomText = document.getElementById('zoom-level-text');
    this.selectBtn = document.getElementById('lightbox-select-btn');

    this.filenameEl = document.getElementById('lightbox-filename');
    this.badgeRes = document.getElementById('lightbox-badge-res');
    this.badgeRatio = document.getElementById('lightbox-badge-ratio');
    this.badgeSize = document.getElementById('lightbox-badge-size');
    this.badgeStatus = document.getElementById('lightbox-badge-status');
    this.printInfo = document.getElementById('lightbox-print-info');

    this.photos = [];
    this.currentIndex = 0;
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.rafId = null;
    this.lastTap = 0;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;

    this.initEvents();
  }

  initEvents() {
    // Close button
    const closeBtn = document.getElementById('lightbox-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    // Prev / Next
    const prevBtn = document.getElementById('lightbox-prev-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => this.prev());

    const nextBtn = document.getElementById('lightbox-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => this.next());

    // Zoom Buttons
    const zoomInBtn = document.getElementById('zoom-in-btn');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoom(0.25));

    const zoomOutBtn = document.getElementById('zoom-out-btn');
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoom(-0.25));

    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    if (zoomResetBtn) zoomResetBtn.addEventListener('click', () => this.resetZoom());

    const zoomActualBtn = document.getElementById('zoom-actual-btn');
    if (zoomActualBtn) zoomActualBtn.addEventListener('click', () => this.actualPixels());

    // Wheel Zoom
    if (this.viewport) {
      this.viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        this.zoom(delta);
      }, { passive: false });

      // Unified Pointer Events (Mouse, Stylus, and Touch Pan / Drag)
      this.viewport.addEventListener('pointerdown', (e) => {
        // Double-tap / double-click detection (toggles Fit vs 100% 1:1)
        const now = Date.now();
        if (now - this.lastTap < 300) {
          e.preventDefault();
          if (this.scale > 1) {
            this.resetZoom();
          } else {
            this.actualPixels();
          }
          this.lastTap = 0;
          return;
        }
        this.lastTap = now;

        if (this.scale > 1) {
          this.isDragging = true;
          this.startX = e.clientX - this.panX;
          this.startY = e.clientY - this.panY;
          try { this.viewport.setPointerCapture(e.pointerId); } catch (err) {}
        } else {
          this.touchStartX = e.clientX;
          this.touchStartY = e.clientY;
          this.touchStartTime = now;
        }
      });

      this.viewport.addEventListener('pointermove', (e) => {
        if (!this.isDragging || this.scale <= 1) return;
        this.panX = e.clientX - this.startX;
        this.panY = e.clientY - this.startY;
        if (!this.rafId) {
          this.rafId = requestAnimationFrame(() => {
            this.applyTransform();
            this.rafId = null;
          });
        }
      });

      const handlePointerEnd = (e) => {
        if (this.scale <= 1 && this.touchStartX !== 0) {
          const deltaX = e.clientX - this.touchStartX;
          const deltaY = e.clientY - this.touchStartY;
          const deltaTime = Date.now() - this.touchStartTime;

          // Horizontal swipe threshold: > 48px travel, relatively flat (< 80px Y deviation), under 600ms
          if (Math.abs(deltaX) > 48 && Math.abs(deltaY) < 80 && deltaTime < 600) {
            if (deltaX < 0) {
              this.next();
            } else {
              this.prev();
            }
          }
        }

        this.isDragging = false;
        this.touchStartX = 0;
        this.touchStartY = 0;
        try { this.viewport.releasePointerCapture(e.pointerId); } catch (err) {}
      };

      this.viewport.addEventListener('pointerup', handlePointerEnd);
      this.viewport.addEventListener('pointercancel', handlePointerEnd);

      // Pinch to Zoom for Multitouch Screens (iPad / Tablets)
      let initialPinchDist = 0;
      let startScale = 1;

      this.viewport.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          initialPinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          startScale = this.scale;
        }
      }, { passive: false });

      this.viewport.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDist > 0) {
          e.preventDefault();
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          const ratio = currentDist / initialPinchDist;
          let newScale = startScale * ratio;
          if (newScale < 0.5) newScale = 0.5;
          if (newScale > 5) newScale = 5;
          this.scale = newScale;
          this.applyTransform();
        }
      }, { passive: false });

      this.viewport.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
          initialPinchDist = 0;
        }
      });
    }

    // Keyboard Navigation
    window.addEventListener('keydown', (e) => {
      if (!this.modal || !this.modal.classList.contains('active')) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
      if (e.key === '+' || e.key === '=') this.zoom(0.25);
      if (e.key === '-') this.zoom(-0.25);
      if (e.key === '0') this.resetZoom();
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.toggleSelection();
      }
    });

    // Lightbox Select Button
    if (this.selectBtn) {
      this.selectBtn.addEventListener('click', () => this.toggleSelection());
    }
  }

  formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return 'Studio Raw';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  }

  getAspectLabel(w, h, ratio) {
    if (w && h) {
      const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
      const d = gcd(w, h);
      const rw = Math.round(w / d);
      const rh = Math.round(h / d);
      if ((rw === 3 && rh === 2) || (rw === 2 && rh === 3)) return `${rw}:${rh}`;
      if ((rw === 16 && rh === 9) || (rw === 9 && rh === 16)) return `${rw}:${rh}`;
      if ((rw === 4 && rh === 3) || (rw === 3 && rh === 4)) return `${rw}:${rh}`;
      if (rw === 1 && rh === 1) return '1:1';
    }
    if (ratio) {
      const r = parseFloat(ratio);
      if (Math.abs(r - 1.5) < 0.05) return '3:2';
      if (Math.abs(r - 1.78) < 0.05) return '16:9';
      if (Math.abs(r - 1.33) < 0.05) return '4:3';
      if (Math.abs(r - 1.0) < 0.05) return '1:1';
      return `${r.toFixed(2)}:1`;
    }
    return 'Studio';
  }

  open(photos, index) {
    if (!this.modal) return;
    this.photos = photos || [];
    this.currentIndex = Math.max(0, Math.min(index || 0, this.photos.length - 1));
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    this.loadCurrentPhoto();

    if (window.gsap) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion) {
        gsap.fromTo(this.img,
          { autoAlpha: 0, scale: 0.94 },
          { autoAlpha: 1, scale: 1, duration: 0.24, ease: "power2.out", clearProps: "opacity,visibility" }
        );
      }
    }
  }

  close() {
    if (!this.modal) return;
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
    this.resetZoom();
  }

  loadCurrentPhoto(direction = 0) {
    const photo = this.photos[this.currentIndex];
    if (!photo) return;

    if (this.counter) {
      this.counter.textContent = `${this.currentIndex + 1} / ${this.photos.length}`;
    }

    if (this.filenameEl) {
      this.filenameEl.textContent = photo.filename;
      this.filenameEl.title = photo.filename;
    }

    if (this.badgeRes) {
      this.badgeRes.textContent = (photo.width && photo.height)
        ? `${photo.width} × ${photo.height} px`
        : 'Resolusi Tinggi';
    }

    if (this.badgeRatio) {
      this.badgeRatio.textContent = this.getAspectLabel(photo.width, photo.height, photo.aspectRatio);
    }

    if (this.badgeSize) {
      this.badgeSize.textContent = this.formatBytes(photo.size);
    }

    this.img.onload = () => {
      const w = photo.width || this.img.naturalWidth;
      const h = photo.height || this.img.naturalHeight;
      if (w && h) {
        if (this.badgeRes) this.badgeRes.textContent = `${w} × ${h} px`;
        if (this.badgeRatio) this.badgeRatio.textContent = this.getAspectLabel(w, h, photo.aspectRatio);
      }
    };

    const sessionQuery = photo.sessionPath ? `?session=${encodeURIComponent(photo.sessionPath)}` : '';
    this.img.src = `/api/photo/${encodeURIComponent(photo.filename)}/original${sessionQuery}`;
    this.img.alt = `Foto studio ${photo.filename}`;
    this.resetZoom();
    this.updateSelectButton();

    if (window.gsap && direction !== 0) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion) {
        gsap.fromTo(this.img,
          { autoAlpha: 0, x: direction * 28 },
          { autoAlpha: 1, x: 0, duration: 0.2, ease: "power2.out", clearProps: "transform,opacity,visibility" }
        );
      }
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.loadCurrentPhoto(-1);
    }
  }

  next() {
    if (this.currentIndex < this.photos.length - 1) {
      this.currentIndex++;
      this.loadCurrentPhoto(1);
    }
  }

  zoom(amount) {
    let newScale = this.scale + amount;
    if (newScale < 0.5) newScale = 0.5;
    if (newScale > 5) newScale = 5;
    this.scale = newScale;
    this.applyTransform();
  }

  actualPixels() {
    this.scale = 1.8;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  resetZoom() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
  }

  applyTransform() {
    if (!this.img) return;
    this.img.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    if (this.zoomText) {
      this.zoomText.textContent = `${Math.round(this.scale * 100)}%`;
    }
  }

  toggleSelection() {
    const photo = this.photos[this.currentIndex];
    if (!photo || !window.selectionManager) return;
    window.selectionManager.toggleSelect(photo.filename);
    this.updateSelectButton();
  }

  updateSelectButton() {
    const photo = this.photos[this.currentIndex];
    if (!photo || !this.selectBtn) return;

    if (!window.selectionManager) {
      this.selectBtn.style.display = 'none';
      const sizeStr = (photo.sizes && photo.sizes[0])
        ? `${photo.sizes[0].size} (${photo.sizes[0].qty}x)`
        : '';

      if (this.badgeStatus) {
        this.badgeStatus.style.display = 'inline-flex';
        this.badgeStatus.textContent = 'Siap Cetak';
      }
      if (this.printInfo) {
        this.printInfo.textContent = sizeStr ? `Pesanan: ${sizeStr}` : 'Antrean Cetak Sesi';
      }
      return;
    }

    this.selectBtn.style.display = 'inline-flex';
    const isSelected = window.selectionManager.isSelected(photo.filename);

    if (this.badgeStatus) {
      if (isSelected) {
        this.badgeStatus.style.display = 'inline-flex';
        this.badgeStatus.textContent = 'Terpilih';
      } else {
        this.badgeStatus.style.display = 'none';
      }
    }

    if (isSelected) {
      const item = window.selectionManager.selections.get(photo.filename);
      const sizeStr = (item && item.sizes && item.sizes[0])
        ? `${item.sizes[0].size} (${item.sizes[0].qty}x)`
        : '4R (1x)';

      if (this.printInfo) {
        this.printInfo.textContent = `Siap cetak: ${sizeStr}`;
      }

      this.selectBtn.className = 'btn btn-gold';
      this.selectBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.4" fill="none" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Terpilih (${sizeStr})</span>
      `;
    } else {
      if (this.printInfo) {
        this.printInfo.textContent = '';
      }

      this.selectBtn.className = 'btn btn-primary';
      this.selectBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.2" fill="none" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Pilih untuk Cetak</span>
      `;
    }
  }
}

window.lightbox = new RTFTPLightbox();
