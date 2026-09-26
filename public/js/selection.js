/**
 * RTFTP Studio - Selection & Print Cart Manager
 */

class RTFTPSelection {
  constructor() {
    this.selections = new Map(); // filename -> { filename, sizes: [{ size, qty }], notes }
    this.availableSizes = [
      { id: '4R', label: '4R (10 x 15 cm)' },
      { id: '5R', label: '5R (13 x 18 cm)' },
      { id: '8R', label: '8R (20 x 25 cm)' },
      { id: '10R', label: '10R (25 x 30 cm)' },
      { id: '12R', label: '12R (30 x 40 cm)' },
      { id: 'Kanvas', label: 'Kanvas (40 x 60 cm)' }
    ];

    this.dock = document.getElementById('selection-dock');
    this.dockCount = document.getElementById('dock-count');
    this.dockTotalCopies = document.getElementById('dock-total-copies');
    this.modal = document.getElementById('print-modal');

    this.initEvents();
  }

  initEvents() {
    // Dock Buttons
    document.getElementById('dock-review-btn').addEventListener('click', () => this.openModal());
    const dockClearBtn = document.getElementById('dock-clear-btn');
    if (dockClearBtn) {
      dockClearBtn.addEventListener('click', () => this.confirmClearAll());
    }

    // Toolbar Clear Button
    const toolbarClearBtn = document.getElementById('toolbar-clear-btn');
    if (toolbarClearBtn) {
      toolbarClearBtn.addEventListener('click', () => this.confirmClearAll());
    }

    document.getElementById('print-modal-close-btn').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-cancel-btn').addEventListener('click', () => this.closeModal());

    // ESC to close modal
    window.addEventListener('keydown', (e) => {
      if (this.modal.classList.contains('active') && e.key === 'Escape') {
        this.closeModal();
      }
    });

    // Confirm & Submit order
    document.getElementById('modal-submit-btn').addEventListener('click', async () => {
      await this.submitOrder();
    });

    // Clear all button in modal
    document.getElementById('modal-clear-btn').addEventListener('click', () => this.confirmClearAll());
  }

  async confirmClearAll() {
    if (this.totalItems === 0) return;
    const confirmed = await window.showConfirm(
      'Batalkan Semua Pilihan?',
      'Semua foto yang telah Anda pilih untuk dicetak akan dibatalkan sehingga Anda dapat memilih ulang dari awal.',
      'Ya, Batalkan Semua',
      true
    );
    if (confirmed) {
      await window.api.clearSelections();
      this.selections.clear();
      this.updateUI();
      this.closeModal();
      if (window.galleryApp && window.galleryApp.activeFilter === 'selected') {
        window.galleryApp.render();
      }
      window.showToast('Semua pilihan foto telah dibatalkan', 'info');
    }
  }

  setAvailableSizes(sizes) {
    if (sizes && sizes.length > 0) {
      this.availableSizes = sizes;
    }
  }

  initFromData(selectionsArray) {
    this.selections.clear();
    if (Array.isArray(selectionsArray)) {
      selectionsArray.forEach(item => {
        this.selections.set(item.filename, item);
      });
    }
    this.updateUI();
  }

  isSelected(filename) {
    return this.selections.has(filename);
  }

  async toggleSelect(filename) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    const isCurrentlySelected = this.isSelected(filename);
    if (isCurrentlySelected) {
      this.selections.delete(filename);
      await window.api.setSelection(filename, false);
    } else {
      const defaultData = {
        filename,
        sizes: [{ size: '4R', qty: 1 }],
        notes: ''
      };
      this.selections.set(filename, defaultData);
      await window.api.setSelection(filename, true, defaultData.sizes, defaultData.notes);
    }
    this.updateUI();

    // Genjutsu Shutter Feedback on Selected Card
    if (window.gsap) {
      const cardId = `card-${filename.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const card = document.getElementById(cardId);
      if (card) {
        gsap.fromTo(card,
          { scale: 0.96 },
          { scale: 1, duration: 0.24, ease: "back.out(2)", clearProps: "transform" }
        );
      }
    }

    if (window.galleryApp && window.galleryApp.activeFilter === 'selected') {
      window.galleryApp.render();
    }
  }

  get totalItems() {
    return this.selections.size;
  }

  get totalCopies() {
    let count = 0;
    this.selections.forEach(item => {
      if (item.sizes) {
        item.sizes.forEach(s => count += (parseInt(s.qty, 10) || 1));
      }
    });
    return count;
  }

  triggerBadgePop(el) {
    if (!el) return;
    if (window.gsap) {
      gsap.fromTo(el,
        { scale: 1 },
        { scale: 1.18, duration: 0.1, yoyo: true, repeat: 1, ease: "power1.out", clearProps: "transform" }
      );
    } else {
      el.classList.remove('badge-pop');
      void el.offsetWidth;
      el.classList.add('badge-pop');
    }
  }

  updateUI() {
    // Update floating dock
    if (this.totalItems > 0) {
      const wasActive = this.dock.classList.contains('active');
      this.dock.classList.add('active');
      this.dockCount.textContent = this.totalItems;
      this.dockTotalCopies.textContent = `${this.totalCopies} lembar cetak`;
      this.triggerBadgePop(this.dockCount);

      if (window.gsap && !wasActive) {
        gsap.fromTo(this.dock,
          { scale: 0.94 },
          { scale: 1, duration: 0.28, ease: "power2.out", clearProps: "transform" }
        );
      }
    } else {
      this.dock.classList.remove('active');
    }

    // Update gallery card highlights & chips
    document.querySelectorAll('.photo-card').forEach(card => {
      const fn = card.getAttribute('data-filename');
      const selected = this.isSelected(fn);
      card.classList.toggle('selected', selected);
      const chip = card.querySelector('.card-select-chip');
      if (chip) chip.classList.toggle('active', selected);
    });

    // Update tab counter
    const filterSelectedBadge = document.getElementById('count-selected');
    if (filterSelectedBadge) {
      filterSelectedBadge.textContent = this.totalItems;
      this.triggerBadgePop(filterSelectedBadge);
    }

    // Update toolbar clear button
    const toolbarClearBtn = document.getElementById('toolbar-clear-btn');
    if (toolbarClearBtn) {
      toolbarClearBtn.style.display = this.totalItems > 0 ? 'inline-flex' : 'none';
    }
  }

  openModal() {
    if (this.totalItems === 0) {
      window.showToast('Belum ada foto yang dipilih untuk dicetak', 'warning');
      return;
    }
    this.renderModalItems();
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (window.gsap) {
      const modalContent = this.modal.querySelector('.modal-card');
      const rows = this.modal.querySelectorAll('.print-order-row');
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion && modalContent) {
        const tl = gsap.timeline();
        tl.fromTo(modalContent,
          { autoAlpha: 0, scale: 0.96, y: 6 },
          { autoAlpha: 1, scale: 1, y: 0, duration: 0.22, ease: "power2.out", clearProps: "transform,opacity,visibility" }
        );
        if (rows.length > 0) {
          tl.fromTo(rows,
            { autoAlpha: 0, y: 8 },
            { autoAlpha: 1, y: 0, duration: 0.16, stagger: 0.03, ease: "power1.out", clearProps: "transform,opacity,visibility" },
            "-=0.1"
          );
        }
      }
    }
  }

  closeModal() {
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  renderModalItems() {
    const listContainer = document.getElementById('selected-items-list');
    listContainer.innerHTML = '';

    let orderIndex = 0;
    this.selections.forEach((item, filename) => {
      orderIndex++;
      const row = document.createElement('div');
      row.className = 'print-order-row';
      row.style.cssText = `
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 16px;
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        margin-bottom: 10px;
        box-shadow: var(--shadow-sm);
      `;

      // Sizes Select HTML
      const currentSize = (item.sizes && item.sizes[0]) ? item.sizes[0].size : '4R';
      const currentQty = (item.sizes && item.sizes[0]) ? item.sizes[0].qty : 1;

      let sizeOptionsHtml = this.availableSizes.map(s =>
        `<option value="${s.id}" ${s.id === currentSize ? 'selected' : ''}>${s.label}</option>`
      ).join('');

      row.innerHTML = `
        <img src="/api/photo/${encodeURIComponent(filename)}/thumb" alt="Thumbnail foto #${orderIndex}" style="width: 56px; height: 56px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: var(--bg-primary); flex-shrink: 0;"/>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
            <span style="background: var(--color-blue-bg); color: var(--color-blue-text); border: 1px solid var(--color-blue-border); font-size: 0.72rem; font-weight: 700; padding: 1px 7px; border-radius: var(--radius-xs); font-family: 'JetBrains Mono', monospace; letter-spacing: -0.02em;">#${orderIndex}</span>
            <span style="font-weight: 700; font-size: 0.86rem; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${filename}</span>
          </div>
          <div style="font-size: 0.74rem; color: var(--text-muted);">Ukuran cetak & kuantiti lembar:</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <select class="size-select" style="background: var(--bg-primary); border: 1px solid var(--border-subtle); color: var(--text-main); padding: 6px 10px; border-radius: var(--radius-sm); font-size: 0.8rem; font-family: inherit; font-weight: 600; cursor: pointer;">
            ${sizeOptionsHtml}
          </select>
          <div style="display: flex; align-items: center; background: #ffffff; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); overflow: hidden; box-shadow: var(--shadow-sm);">
            <button class="qty-btn qty-minus" style="background: none; border: none; color: var(--text-main); width: 28px; height: 30px; cursor: pointer; font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; justify-content: center;" aria-label="Kurangi kuantiti">−</button>
            <span class="qty-display" style="padding: 0 8px; font-size: 0.86rem; font-weight: 800; color: var(--color-purple-text); font-family: 'JetBrains Mono', monospace; min-width: 24px; text-align: center;">${currentQty}</span>
            <button class="qty-btn qty-plus" style="background: none; border: none; color: var(--text-main); width: 28px; height: 30px; cursor: pointer; font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; justify-content: center;" aria-label="Tambah kuantiti">+</button>
          </div>
          <button class="btn btn-sm btn-danger btn-delete-row" title="Hapus foto ini dari daftar cetak" aria-label="Hapus foto ini" style="padding: 6px 10px;">
            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.2" fill="none" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      `;

      // Event listeners for size & qty
      const sizeSelect = row.querySelector('.size-select');
      const qtyDisplay = row.querySelector('.qty-display');
      const minusBtn = row.querySelector('.qty-minus');
      const plusBtn = row.querySelector('.qty-plus');
      const delBtn = row.querySelector('.btn-delete-row');

      const saveItemChanges = async (newSize, newQty) => {
        item.sizes = [{ size: newSize, qty: newQty }];
        this.selections.set(filename, item);
        await window.api.setSelection(filename, true, item.sizes, item.notes);
        this.updateUI();
        this.updateModalSummary();
      };

      sizeSelect.addEventListener('change', () => {
        saveItemChanges(sizeSelect.value, parseInt(qtyDisplay.textContent, 10));
      });

      minusBtn.addEventListener('click', () => {
        let q = parseInt(qtyDisplay.textContent, 10);
        if (q > 1) {
          q--;
          qtyDisplay.textContent = q;
          saveItemChanges(sizeSelect.value, q);
        }
      });

      plusBtn.addEventListener('click', () => {
        let q = parseInt(qtyDisplay.textContent, 10);
        q++;
        qtyDisplay.textContent = q;
        saveItemChanges(sizeSelect.value, q);
      });

      delBtn.addEventListener('click', async () => {
        await this.toggleSelect(filename);
        this.renderModalItems();
        if (this.totalItems === 0) {
          this.closeModal();
        }
      });

      listContainer.appendChild(row);
    });

    this.updateModalSummary();
  }

  updateModalSummary() {
    const summaryEl = document.getElementById('modal-summary-text');
    if (!summaryEl) return;
    summaryEl.innerHTML = `
      <span style="color: var(--text-secondary); font-size: 0.82rem;">Total Pesanan:</span>
      <strong style="color: var(--color-blue-text); font-weight: 700; margin-left: 4px; font-size: 0.88rem;">${this.totalItems} Foto</strong>
      <span style="display: inline-flex; align-items: center; margin-left: 8px; background: var(--color-slate-bg); color: var(--color-slate-text); border: 1px solid var(--color-slate-border); padding: 1px 8px; border-radius: var(--radius-xs); font-weight: 700; font-size: 0.76rem; font-family: 'JetBrains Mono', monospace;">${this.totalCopies} lembar cetak</span>
    `;
  }

  async submitOrder() {
    try {
      const submitBtn = document.getElementById('modal-submit-btn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Memproses...';

      const res = await window.api.exportPrint();
      if (res.success) {
        window.showToast(`Pesanan siap! ${res.report.totalCopies} lembar foto siap dicetak`, 'success');
        this.closeModal();
      } else {
        window.showToast('Gagal memproses pesanan: ' + res.error, 'danger');
      }
    } catch (err) {
      window.showToast('Terjadi kesalahan: ' + err.message, 'danger');
    } finally {
      const submitBtn = document.getElementById('modal-submit-btn');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Konfirmasi & Siapkan Cetak';
    }
  }
}

window.selectionManager = new RTFTPSelection();
