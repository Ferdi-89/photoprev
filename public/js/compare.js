/**
 * RTFTP Studio - Side-by-Side Comparison Engine
 */

class RTFTPCompare {
  constructor() {
    this.modal = document.getElementById('compare-modal');
    this.grid = document.getElementById('compare-body');
    this.counter = document.getElementById('compare-count-badge');
    this.closeBtn = document.getElementById('compare-close-btn');

    this.comparedFilenames = new Set();
    this.allPhotosMap = new Map();

    this.initEvents();
  }

  initEvents() {
    this.closeBtn.addEventListener('click', () => this.close());

    // Global ESC to close compare
    window.addEventListener('keydown', (e) => {
      if (this.modal.classList.contains('active') && e.key === 'Escape') {
        this.close();
      }
    });
  }

  setPhotos(photos) {
    this.allPhotosMap.clear();
    photos.forEach(p => this.allPhotosMap.set(p.filename, p));
  }

  toggle(filename) {
    if (this.comparedFilenames.has(filename)) {
      this.comparedFilenames.delete(filename);
    } else {
      if (this.comparedFilenames.size >= 4) {
        window.showToast('Maksimal membandingkan 4 foto sekaligus', 'warning');
        return false;
      }
      this.comparedFilenames.add(filename);
    }
    this.updateUI();
    return this.comparedFilenames.has(filename);
  }

  isCompared(filename) {
    return this.comparedFilenames.has(filename);
  }

  get count() {
    return this.comparedFilenames.size;
  }

  open() {
    if (this.comparedFilenames.size < 2) {
      window.showToast('Pilih minimal 2 foto untuk dibandingkan', 'info');
      return;
    }
    this.render();
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (window.gsap) {
      const items = this.grid.querySelectorAll('.compare-item');
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion && items.length > 0) {
        gsap.fromTo(items,
          { autoAlpha: 0, scale: 0.96 },
          { autoAlpha: 1, scale: 1, duration: 0.25, stagger: 0.04, ease: "power2.out", clearProps: "transform,opacity,visibility" }
        );
      }
    }
  }

  close() {
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  clear() {
    this.comparedFilenames.clear();
    this.updateUI();
  }

  updateUI() {
    const compareBtn = document.getElementById('open-compare-btn');
    const badge = document.getElementById('compare-badge-count');
    if (compareBtn && badge) {
      badge.textContent = this.comparedFilenames.size;
      if (this.comparedFilenames.size > 0) {
        compareBtn.style.display = 'inline-flex';
      } else {
        compareBtn.style.display = 'none';
      }
    }

    // Refresh active classes in main gallery
    document.querySelectorAll('.photo-card').forEach(card => {
      const fn = card.getAttribute('data-filename');
      if (this.comparedFilenames.has(fn)) {
        card.classList.add('in-compare');
      } else {
        card.classList.remove('in-compare');
      }
    });
  }

  render() {
    this.grid.className = `compare-body items-${this.comparedFilenames.size}`;
    this.grid.innerHTML = '';
    this.counter.textContent = `${this.comparedFilenames.size} Foto`;

    let compIdx = 0;
    this.comparedFilenames.forEach(filename => {
      compIdx++;
      const photo = this.allPhotosMap.get(filename);
      if (!photo) return;

      const isSelected = window.selectionManager.isSelected(filename);

      const item = document.createElement('div');
      item.className = `compare-item ${isSelected ? 'is-selected' : ''}`;
      item.id = `compare-item-${filename.replace(/[^a-zA-Z0-9]/g, '_')}`;

      item.innerHTML = `
        <div class="compare-item-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: var(--color-amber-bg); color: var(--color-amber-text); border: 1px solid var(--color-amber-border); font-size: 0.72rem; font-weight: 700; padding: 1px 7px; border-radius: var(--radius-xs); font-family: 'JetBrains Mono', monospace;">Slot ${compIdx}</span>
            <span class="compare-item-name">${filename}</span>
          </div>
          <button class="btn btn-sm btn-danger btn-remove-compare" title="Keluarkan dari perbandingan" aria-label="Keluarkan dari perbandingan">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.2" fill="none" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="compare-item-viewport" title="Klik untuk memperbesar">
          <img src="/api/photo/${encodeURIComponent(filename)}/preview" alt="Foto perbandingan ${filename}" loading="lazy"/>
        </div>
        <div class="compare-item-footer">
          <button class="btn ${isSelected ? 'btn-gold' : 'btn-primary'} btn-choose-this">
            ${isSelected ? 'Terpilih untuk Cetak' : 'Pilih Foto Ini'}
          </button>
        </div>
      `;

      // Remove from compare button
      item.querySelector('.btn-remove-compare').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggle(filename);
        if (this.comparedFilenames.size < 2) {
          this.close();
        } else {
          this.render();
        }
      });

      // Select / Deselect button
      const chooseBtn = item.querySelector('.btn-choose-this');
      chooseBtn.addEventListener('click', () => {
        window.selectionManager.toggleSelect(filename);
        const nowSelected = window.selectionManager.isSelected(filename);
        item.classList.toggle('is-selected', nowSelected);
        if (nowSelected) {
          chooseBtn.className = 'btn btn-gold btn-choose-this';
          chooseBtn.textContent = 'Terpilih untuk Cetak';
        } else {
          chooseBtn.className = 'btn btn-primary btn-choose-this';
          chooseBtn.textContent = 'Pilih Foto Ini';
        }
      });

      // Quick zoom click in comparison viewport
      const viewport = item.querySelector('.compare-item-viewport');
      const img = viewport.querySelector('img');
      let isZoomed = false;
      viewport.addEventListener('click', () => {
        isZoomed = !isZoomed;
        img.style.transform = isZoomed ? 'scale(2)' : 'scale(1)';
        viewport.style.cursor = isZoomed ? 'zoom-out' : 'zoom-in';
      });

      this.grid.appendChild(item);
    });
  }
}

window.compareManager = new RTFTPCompare();
