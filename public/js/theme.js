/**
 * RTFTP Studio - Unified Theme Engine (Dark / Light / System Preference)
 * Precision calibrated for photography studio darkrooms and low-light environments.
 * Compliant with WCAG 2.1 AA/AAA contrast guidelines and Zero-Chromatic-Bias proofing.
 */
(function(window) {
  'use strict';

  const STORAGE_KEY = 'rtftp_theme';
  const TRANSITION_CLASS = 'theme-transitioning';
  const TRANSITION_MS = 280;

  // Sun and Moon icon SVGs (Zero Unicode Emojis)
  const SUN_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  const MOON_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

  function getSystemPreference() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }

  function getStoredPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  function resolveEffectiveTheme(preference) {
    if (preference === 'dark' || preference === 'light') {
      return preference;
    }
    return getSystemPreference();
  }

  function applyTheme(preference, animate = false) {
    const effective = resolveEffectiveTheme(preference);
    const root = document.documentElement;

    if (animate) {
      root.classList.add(TRANSITION_CLASS);
      setTimeout(() => {
        root.classList.remove(TRANSITION_CLASS);
      }, TRANSITION_MS);
    }

    root.setAttribute('data-theme', effective);
    root.setAttribute('data-theme-preference', preference);

    // Synchronize browser meta theme-color for mobile tabs and window titlebars
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', effective === 'dark' ? '#0f1115' : '#e7e5e4');
    }

    // Update UI toggle buttons
    updateToggleButtons(preference, effective);

    // Dispatch custom event for chart/canvas or other subscribers
    try {
      window.dispatchEvent(new CustomEvent('rtftp-theme-changed', {
        detail: { preference, effective }
      }));
    } catch (e) {}
  }

  function setTheme(preference) {
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch (e) {}
    applyTheme(preference, true);
  }

  function toggleTheme() {
    const currentStored = getStoredPreference();
    const currentEffective = resolveEffectiveTheme(currentStored);
    const next = currentEffective === 'dark' ? 'light' : 'dark';
    setTheme(next);
    return next;
  }

  function updateToggleButtons(preference, effective) {
    const isDark = effective === 'dark';
    const buttons = document.querySelectorAll('.btn-theme-toggle, [data-action="toggle-theme"]');

    buttons.forEach(btn => {
      btn.setAttribute('aria-label', isDark ? 'Beralih ke mode terang' : 'Beralih ke mode gelap');
      btn.setAttribute('title', isDark ? 'Beralih ke Mode Terang (Siang)' : 'Beralih ke Mode Gelap (Studio Darkroom)');

      const iconWrap = btn.querySelector('.theme-icon-wrap');
      if (iconWrap) {
        iconWrap.innerHTML = isDark ? SUN_ICON : MOON_ICON;
      }

      const label = btn.querySelector('.theme-label');
      if (label) {
        label.textContent = isDark ? 'Mode Terang' : 'Mode Gelap';
      }
    });
  }

  // Bind early DOM and system listeners
  function init() {
    const initialPreference = getStoredPreference();
    applyTheme(initialPreference, false);

    // Watch OS color scheme changes if user chose auto / default
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (getStoredPreference() === 'auto') {
          applyTheme('auto', true);
        }
      });
    }

    // Cross-tab synchronization
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        applyTheme(e.newValue || 'auto', true);
      }
    });

    // Delegated click handler for theme toggles
    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.btn-theme-toggle, [data-action="toggle-theme"]');
      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        toggleTheme();
      }
    });

    // Ensure buttons are updated once DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        updateToggleButtons(getStoredPreference(), resolveEffectiveTheme(getStoredPreference()));
      });
    } else {
      updateToggleButtons(getStoredPreference(), resolveEffectiveTheme(getStoredPreference()));
    }
  }

  init();

  window.themeManager = {
    getPreference: getStoredPreference,
    getEffectiveTheme: () => resolveEffectiveTheme(getStoredPreference()),
    setTheme,
    toggleTheme,
    applyTheme
  };
})(window);
