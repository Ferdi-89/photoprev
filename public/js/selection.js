/**
 * RTFTP Studio - Photostrip Selection & Builder Controller
 */

class RTFTPSelection {
  constructor() {
    this.selections = new Map(); // filename -> { filename, slot, order, sizes, notes, selectedAt }
    this.templates = [];
    this.activeTemplateId = 'classic-white-3';
    this.activeFilter = 'normal'; // 'normal' | 'bw' | 'vintage'
    this.previewDebounceTimer = null;

    this.dock = document.getElementById('selection-dock');
    this.dockCount = document.getElementById('dock-count');
    this.dockTotalCopies = document.getElementById('dock-total-copies');
    this.modal = document.getElementById('print-modal');

    this.initEvents();
    this.loadTemplates();
  }

  async loadTemplates() {
    try {
      if (window.api && window.api.getPhotostripTemplates) {
        const res = await window.api.getPhotostripTemplates();
        if (res.success && Array.isArray(res.templates)) {
          this.templates = res.templates;
          if (res.activeTemplateId) {
            this.activeTemplateId = res.activeTemplateId;
          }
          if (res.config && res.config.filter) {
            this.activeFilter = res.config.filter;
          }
          this.populateTemplateSelect();
          this.updateUI();
        }
      }
    } catch (e) {
      console.warn('Could not load photostrip templates:', e.message);
    }
  }

  get maxSlots() {
    const t = this.templates.find(item => item.id === this.activeTemplateId);
    return t ? (t.slots || 3) : 3;
  }

  initEvents() {
    // Dock Buttons
    const reviewBtn = document.getElementById('dock-review-btn');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          this.openDrawer();
        } else {
          this.openModal();
        }
      });
    }

    const dockClearBtn = document.getElementById('dock-clear-btn');
    if (dockClearBtn) {
      dockClearBtn.addEventListener('click', () => this.confirmClearAll());
    }

    // Mobile Drawer Close Buttons & Backdrop
    const closeDrawerBtn = document.getElementById('btn-close-strip-drawer');
    if (closeDrawerBtn) {
      closeDrawerBtn.addEventListener('click', () => this.closeDrawer());
    }

    const backdrop = document.getElementById('live-strip-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => this.closeDrawer());
    }

    // Live Sidebar Actions
    const livePrintBtn = document.getElementById('btn-live-print-submit');
    if (livePrintBtn) {
      livePrintBtn.addEventListener('click', async () => {
        await this.submitOrder();
      });
    }

    const liveClearBtn = document.getElementById('btn-live-clear-all');
    if (liveClearBtn) {
      liveClearBtn.addEventListener('click', () => this.confirmClearAll());
    }

    // Toolbar Clear Button
    const toolbarClearBtn = document.getElementById('toolbar-clear-btn');
    if (toolbarClearBtn) {
      toolbarClearBtn.addEventListener('click', () => this.confirmClearAll());
    }

    const modalCloseBtn = document.getElementById('print-modal-close-btn');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', () => this.closeModal());
    }

    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    if (modalCancelBtn) {
      modalCancelBtn.addEventListener('click', () => this.closeModal());
    }

    // ESC to close modal or drawer
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.modal && this.modal.classList.contains('active')) {
          this.closeModal();
        }
        this.closeDrawer();
      }
    });

    // Confirm & Submit order in modal
    const modalSubmitBtn = document.getElementById('modal-submit-btn');
    if (modalSubmitBtn) {
      modalSubmitBtn.addEventListener('click', async () => {
        await this.submitOrder();
      });
    }

    // Clear all button in modal
    const modalClearBtn = document.getElementById('modal-clear-btn');
    if (modalClearBtn) {
      modalClearBtn.addEventListener('click', () => this.confirmClearAll());
    }

    // Template Select Change (both sidebar and modal)
    document.querySelectorAll('#select-strip-template, #select-modal-strip-template, .strip-template-select').forEach(select => {
      select.addEventListener('change', (e) => {
        this.activeTemplateId = e.target.value;
        this.populateTemplateSelect();
        this.updateModalSummary();
        this.renderModalItems();
        this.renderLiveStrip();
        this.requestPreview();
      });
    });

    // Filter Chips Click (both sidebar and modal)
    document.querySelectorAll('.btn-strip-filter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('.btn-strip-filter');
        if (!targetBtn) return;
        const newFilter = targetBtn.getAttribute('data-filter') || 'normal';
        this.activeFilter = newFilter;
        document.querySelectorAll('.btn-strip-filter').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-filter') === newFilter);
        });
        this.renderLiveStrip();
        this.requestPreview();
      });
    });
  }

  openDrawer() {
    const sidebar = document.getElementById('live-photostrip-sidebar');
    const backdrop = document.getElementById('live-strip-backdrop');
    if (sidebar) sidebar.classList.add('active');
    if (backdrop) backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  closeDrawer() {
    const sidebar = document.getElementById('live-photostrip-sidebar');
    const backdrop = document.getElementById('live-strip-backdrop');
    if (sidebar) sidebar.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  populateTemplateSelect() {
    const selects = document.querySelectorAll('#select-strip-template, #select-modal-strip-template, .strip-template-select');
    if (!selects.length || this.templates.length === 0) return;

    const html = this.templates.map(t =>
      `<option value="${t.id}" ${t.id === this.activeTemplateId ? 'selected' : ''}>${t.name} (${t.slots} Foto)</option>`
    ).join('');

    selects.forEach(select => {
      select.innerHTML = html;
      select.value = this.activeTemplateId;
    });
  }

  getSessionPath() {
    return (window.galleryApp && window.galleryApp.currentSessionPath)
      || (window.gallery && window.gallery.currentSessionPath)
      || new URLSearchParams(window.location.search).get('session')
      || null;
  }

  getStationId() {
    return (window.galleryApp && window.galleryApp.stationId)
      || (window.gallery && window.gallery.stationId)
      || new URLSearchParams(window.location.search).get('station')
      || null;
  }

  async confirmClearAll() {
    if (this.totalItems === 0) return;
    const confirmed = await window.showConfirm(
      'Batalkan Semua Pilihan?',
      'Semua foto yang telah Anda pilih untuk strip photobooth akan dibatalkan sehingga Anda dapat memilih ulang.',
      'Ya, Batalkan Semua',
      true
    );
    if (confirmed) {
      await window.api.clearSelections(this.getSessionPath(), this.getStationId());
      this.selections.clear();
      this.updateUI();
      this.closeModal();
      if (window.galleryApp && window.galleryApp.activeFilter === 'selected') {
        window.galleryApp.render();
      }
      window.showToast('Semua pilihan foto strip telah dibatalkan', 'info');
    }
  }

  setAvailableSizes(sizes) {
    // Retained for backward compatibility
  }

  initFromData(selectionsArray) {
    this.selections.clear();
    if (Array.isArray(selectionsArray)) {
      selectionsArray.forEach((item, idx) => {
        this.selections.set(item.filename, {
          ...item,
          order: typeof item.order === 'number' ? item.order : idx,
          slot: typeof item.slot === 'number' ? item.slot : (idx + 1)
        });
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
    const sessionPath = this.getSessionPath();
    const stationId = this.getStationId();

    if (isCurrentlySelected) {
      this.selections.delete(filename);
      // Re-index remaining selections
      const remaining = Array.from(this.selections.values()).map((it, i) => ({
        ...it,
        order: i,
        slot: i + 1
      }));
      this.selections.clear();
      remaining.forEach(it => this.selections.set(it.filename, it));

      if (window.api.setSelectionsBatch) {
        await window.api.setSelectionsBatch(remaining, sessionPath, stationId);
      } else {
        await window.api.setSelection(filename, false, null, '', sessionPath, stationId);
      }
    } else {
      if (this.totalItems >= this.maxSlots) {
        window.showToast(`Strip foto sudah terisi penuh (${this.maxSlots} foto). Buka menu "Susun & Cetak Strip" untuk menukar posisi foto.`, 'warning', 4500);
        return;
      }

      const nextSlot = this.totalItems + 1;
      const defaultData = {
        filename,
        slot: nextSlot,
        order: this.totalItems,
        sizes: [{ size: '4R', qty: 1 }],
        notes: ''
      };
      this.selections.set(filename, defaultData);

      const allItems = Array.from(this.selections.values());
      if (window.api.setSelectionsBatch) {
        await window.api.setSelectionsBatch(allItems, sessionPath, stationId);
      } else {
        await window.api.setSelection(filename, true, defaultData.sizes, defaultData.notes, sessionPath, stationId);
      }
    }

    this.updateUI();

    // Visual feedback on card
    const cardId = `card-${filename.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const card = document.getElementById(cardId);
    if (card) {
      const chip = card.querySelector('.card-select-chip');
      if (chip) this.triggerBadgePop(chip);
    }

    if (window.galleryApp && window.galleryApp.activeFilter === 'selected') {
      window.galleryApp.render();
    }
  }

  get totalItems() {
    return this.selections.size;
  }

  get totalCopies() {
    return 1; // Photostrip output is 1 composite sheet (containing double strip)
  }

  triggerBadgePop(el) {
    if (!el) return;
    if (window.gsap) {
      gsap.killTweensOf(el);
      gsap.fromTo(el,
        { scale: 0.88 },
        { scale: 1, duration: 0.2, ease: "back.out(2)", clearProps: "transform" }
      );
    } else {
      el.classList.remove('badge-pop');
      void el.offsetWidth;
      el.classList.add('badge-pop');
    }
  }

  updateUI() {
    // Synchronize live single photostrip canvas directly on page
    this.renderLiveStrip();

    // Update floating dock
    if (this.dock) {
      if (this.totalItems > 0) {
        const wasActive = this.dock.classList.contains('active');
        this.dock.classList.add('active');
        if (this.dockCount) {
          this.dockCount.textContent = `${this.totalItems}/${this.maxSlots}`;
          this.triggerBadgePop(this.dockCount);
        }
        if (this.dockTotalCopies) {
          if (this.totalItems >= this.maxSlots) {
            this.dockTotalCopies.textContent = 'Strip Lengkap (Siap Cetak)';
          } else {
            const need = this.maxSlots - this.totalItems;
            this.dockTotalCopies.textContent = `Pilih ${need} foto lagi untuk strip`;
          }
        }

        if (window.gsap && !wasActive) {
          gsap.fromTo(this.dock,
            { scale: 0.94 },
            { scale: 1, duration: 0.28, ease: "power2.out", clearProps: "transform" }
          );
        }
      } else {
        this.dock.classList.remove('active');
      }
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

  renderLiveStrip() {
    const card = document.getElementById('live-single-strip-card');
    const container = document.getElementById('live-strip-slots-container');
    const statusText = document.getElementById('live-strip-status-text');
    const readyBadge = document.getElementById('live-strip-ready-badge');
    const printBtn = document.getElementById('btn-live-print-submit');
    const clearBtn = document.getElementById('btn-live-clear-all');
    const brandEvent = document.getElementById('strip-brand-event');
    const brandFooter = document.getElementById('strip-brand-footer');
    const brandDate = document.getElementById('strip-brand-date');

    if (!container || !card) return;

    const t = this.templates.find(item => item.id === this.activeTemplateId) || this.templates[0] || {};
    const slotCount = t.slots || 3;
    const items = Array.from(this.selections.values());

    // Update physical card background and typography colors based on template
    card.style.backgroundColor = t.bgColor || '#ffffff';
    card.style.color = t.textColor || '#18181b';
    card.style.borderColor = t.frameBorderColor || '#e4e4e7';

    // Update header event title and footer texts
    if (brandEvent) {
      brandEvent.textContent = (t.name ? t.name.replace(/\s*\(\d+\s*Foto\)/i, '') : 'PHOTOBOOTH MEMORIES').toUpperCase();
      brandEvent.style.color = t.accentColor || t.textColor || '#18181b';
    }
    if (brandFooter) {
      brandFooter.textContent = 'RTFTP PHOTO LAB';
      brandFooter.style.color = t.subTextColor || '#71717a';
    }
    if (brandDate) {
      const now = new Date();
      brandDate.textContent = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
      brandDate.style.color = t.subTextColor || '#71717a';
    }

    container.innerHTML = '';

    const sPath = this.getSessionPath();
    const stId = this.getStationId();
    const sQuery = sPath
      ? `?session=${encodeURIComponent(sPath)}`
      : (stId ? `?station=${encodeURIComponent(stId)}` : '');

    for (let i = 0; i < slotCount; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = `live-strip-slot ${slotCount === 4 ? 'slot-count-4' : ''}`;
      slotEl.setAttribute('data-slot-index', i);

      const photoItem = items[i];

      if (photoItem) {
        slotEl.classList.add('filled');
        const isFirst = i === 0;
        const isLast = i === items.length - 1;
        const photoSrc = `/api/photo/${encodeURIComponent(photoItem.filename)}/thumb${sQuery}`;

        slotEl.innerHTML = `
          <img src="${photoSrc}" class="slot-photo-img filter-${this.activeFilter}" alt="Slot ${i + 1}" />
          <span class="slot-badge">#${i + 1}</span>
          <div class="slot-filled-overlay">
            <div></div>
            <div class="slot-micro-actions">
              <button type="button" class="btn-slot-action btn-move-up" title="Pindah ke atas" ${isFirst ? 'disabled' : ''} aria-label="Pindah ke atas">
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="18 15 12 9 6 15"></polyline></svg>
              </button>
              <button type="button" class="btn-slot-action btn-move-down" title="Pindah ke bawah" ${isLast ? 'disabled' : ''} aria-label="Pindah ke bawah">
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </button>
              <button type="button" class="btn-slot-action btn-slot-remove" title="Keluarkan dari strip" aria-label="Hapus dari strip">
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
        `;

        slotEl.querySelector('.btn-move-up').addEventListener('click', (e) => {
          e.stopPropagation();
          this.moveSlot(i, i - 1);
        });
        slotEl.querySelector('.btn-move-down').addEventListener('click', (e) => {
          e.stopPropagation();
          this.moveSlot(i, i + 1);
        });
        slotEl.querySelector('.btn-slot-remove').addEventListener('click', async (e) => {
          e.stopPropagation();
          await this.toggleSelect(photoItem.filename);
        });
      } else {
        slotEl.classList.add('empty');
        slotEl.innerHTML = `
          <div class="slot-empty-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
          <span class="slot-empty-label">Slot #${i + 1}</span>
          <span class="slot-empty-hint">Pilih foto dari galeri</span>
        `;
        slotEl.addEventListener('click', () => {
          window.showToast(`Klik salah satu foto di galeri untuk mengisi Slot #${i + 1}`, 'info', 2500);
        });
      }

      container.appendChild(slotEl);
    }

    // Update bottom status & buttons
    if (statusText) {
      statusText.textContent = `${items.length} / ${slotCount} Foto Terisi`;
    }

    const isFull = items.length >= slotCount;
    if (readyBadge) {
      readyBadge.style.display = isFull ? 'inline-block' : 'none';
    }

    if (clearBtn) {
      clearBtn.style.display = items.length > 0 ? 'inline-flex' : 'none';
    }

    if (printBtn) {
      if (items.length === 0) {
        printBtn.disabled = true;
        printBtn.innerHTML = `<span>Pilih ${slotCount} Foto dari Galeri</span>`;
      } else if (!isFull) {
        printBtn.disabled = false;
        printBtn.innerHTML = `<span>Cetak Strip (${items.length}/${slotCount} Foto)</span>`;
      } else {
        printBtn.disabled = false;
        printBtn.innerHTML = `<span>Cetak Foto Strip Sekarang</span>`;
      }
    }
  }

  openModal() {
    if (this.totalItems === 0) {
      window.showToast('Pilih minimal 1 foto dari galeri untuk menyusun strip', 'warning');
      return;
    }

    this.populateTemplateSelect();
    this.renderModalItems();
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Set active filter button
    document.querySelectorAll('.btn-strip-filter').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === this.activeFilter);
    });

    this.requestPreview();

    if (window.gsap) {
      const modalContent = this.modal.querySelector('.modal-card');
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion && modalContent) {
        gsap.fromTo(modalContent,
          { autoAlpha: 0, scale: 0.96, y: 6 },
          { autoAlpha: 1, scale: 1, y: 0, duration: 0.22, ease: "power2.out", clearProps: "transform,opacity,visibility" }
        );
      }
    }
  }

  closeModal() {
    if (this.modal) {
      this.modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  async moveSlot(fromIndex, toIndex) {
    const items = Array.from(this.selections.values());
    if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) {
      return;
    }

    // Swap items
    const [moved] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, moved);

    // Re-index slots
    this.selections.clear();
    items.forEach((it, i) => {
      it.order = i;
      it.slot = i + 1;
      this.selections.set(it.filename, it);
    });

    if (window.api.setSelectionsBatch) {
      await window.api.setSelectionsBatch(items, this.getSessionPath(), this.getStationId());
    }

    this.renderLiveStrip();
    this.renderModalItems();
    this.requestPreview();
  }

  renderModalItems() {
    const listContainer = document.getElementById('selected-items-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const items = Array.from(this.selections.values());
    const slotsCounter = document.getElementById('photostrip-slots-counter');
    if (slotsCounter) {
      slotsCounter.textContent = `${items.length} / ${this.maxSlots} Slot Terisi`;
    }

    const sPath = this.getSessionPath();
    const stId = this.getStationId();
    const sQuery = sPath
      ? `?session=${encodeURIComponent(sPath)}`
      : (stId ? `?station=${encodeURIComponent(stId)}` : '');

    items.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'photostrip-slot-row';

      const isFirst = index === 0;
      const isLast = index === items.length - 1;

      row.innerHTML = `
        <span class="photostrip-slot-badge">Slot #${index + 1}</span>
        <img class="photostrip-slot-thumb" src="/api/photo/${encodeURIComponent(item.filename)}/thumb${sQuery}" alt="Slot ${index + 1}"/>
        <div class="photostrip-slot-info">
          <div class="photostrip-slot-title">${item.filename}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">Urutan foto ke-${index + 1} pada strip</div>
        </div>
        <div class="photostrip-slot-actions">
          <button type="button" class="btn-slot-move btn-move-up" title="Pindah ke atas" ${isFirst ? 'disabled' : ''} aria-label="Pindah ke atas">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="18 15 12 9 6 15"></polyline></svg>
          </button>
          <button type="button" class="btn-slot-move btn-move-down" title="Pindah ke bawah" ${isLast ? 'disabled' : ''} aria-label="Pindah ke bawah">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          <button type="button" class="btn-slot-delete" title="Keluarkan dari strip" aria-label="Hapus dari strip">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      `;

      row.querySelector('.btn-move-up').addEventListener('click', () => this.moveSlot(index, index - 1));
      row.querySelector('.btn-move-down').addEventListener('click', () => this.moveSlot(index, index + 1));
      row.querySelector('.btn-slot-delete').addEventListener('click', async () => {
        await this.toggleSelect(item.filename);
        this.renderModalItems();
        if (this.totalItems === 0) {
          this.closeModal();
        } else {
          this.requestPreview();
        }
      });

      listContainer.appendChild(row);
    });

    this.updateModalSummary();
  }

  updateModalSummary() {
    const summaryEl = document.getElementById('modal-summary-text');
    if (!summaryEl) return;

    const t = this.templates.find(item => item.id === this.activeTemplateId);
    const templateName = t ? t.name : 'Classic White';
    const isDouble = t ? (t.outputFormat !== 'single_strip') : true;

    summaryEl.innerHTML = `
      <span style="color: var(--text-secondary); font-size: 0.8rem;">Status:</span>
      <strong style="color: var(--color-blue-text); font-weight: 700; margin-left: 4px; font-size: 0.86rem;">${this.totalItems}/${this.maxSlots} Foto</strong>
      <span style="display: inline-flex; align-items: center; margin-left: 8px; background: var(--color-slate-bg); color: var(--color-slate-text); border: 1px solid var(--color-slate-border); padding: 1px 8px; border-radius: var(--radius-xs); font-weight: 700; font-size: 0.75rem; font-family: var(--font-mono);">
        ${templateName} (${isDouble ? 'Double Strip 4R' : 'Single Strip'})
      </span>
    `;

    const formatText = document.getElementById('photostrip-preview-format-text');
    if (formatText) {
      formatText.textContent = isDouble
        ? 'Format Cetak: Double Strip 2x6 (Kertas 4R - Sekali Cetak Jadi 2 Lembar)'
        : 'Format Cetak: Single Strip 2x6 (Potong Langsung)';
    }
  }

  requestPreview() {
    if (this.totalItems === 0) return;

    if (this.previewDebounceTimer) {
      clearTimeout(this.previewDebounceTimer);
    }

    const previewImg = document.getElementById('photostrip-preview-img');
    const previewLoading = document.getElementById('photostrip-preview-loading');
    const previewPlaceholder = document.getElementById('photostrip-preview-placeholder');

    if (previewLoading) previewLoading.style.display = 'flex';

    this.previewDebounceTimer = setTimeout(async () => {
      try {
        const filenames = Array.from(this.selections.keys());
        const res = await window.api.getPhotostripPreview({
          filenames,
          sessionPath: this.getSessionPath(),
          templateId: this.activeTemplateId,
          filter: this.activeFilter
        });

        if (res.success && res.dataUrl) {
          if (previewPlaceholder) previewPlaceholder.style.display = 'none';
          if (previewImg) {
            previewImg.src = res.dataUrl;
            previewImg.style.display = 'block';
          }
        }
      } catch (err) {
        console.warn('Error fetching photostrip preview:', err.message);
      } finally {
        if (previewLoading) previewLoading.style.display = 'none';
      }
    }, 180);
  }

  async submitOrder() {
    if (this.totalItems === 0) return;

    const modalBtn = document.getElementById('modal-submit-btn');
    const liveBtn = document.getElementById('btn-live-print-submit');

    try {
      if (modalBtn) {
        modalBtn.disabled = true;
        modalBtn.textContent = 'Memproses Render Strip...';
      }
      if (liveBtn) {
        liveBtn.disabled = true;
        liveBtn.innerHTML = '<span>Memproses Render Strip...</span>';
      }

      const res = await window.api.exportPrint(
        this.getSessionPath(),
        false,
        this.getStationId(),
        {
          templateId: this.activeTemplateId,
          filter: this.activeFilter
        }
      );

      if (res.success) {
        window.showToast('Foto Strip Photobooth berhasil disusun dan siap dicetak!', 'success');
        this.closeModal();
        this.closeDrawer();
      } else {
        window.showToast('Gagal memproses strip: ' + res.error, 'danger');
      }
    } catch (err) {
      window.showToast('Terjadi kesalahan: ' + err.message, 'danger');
    } finally {
      if (modalBtn) {
        modalBtn.disabled = false;
        modalBtn.textContent = 'Konfirmasi & Siapkan Cetak Strip';
      }
      this.renderLiveStrip();
    }
  }
}

window.selectionManager = new RTFTPSelection();
