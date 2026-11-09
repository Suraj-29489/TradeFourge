/**
 * TradeForge - Global Theme Manager
 * Supports three persistent themes: 'classic' (default), 'midnight', and 'light'.
 * Early pre-paint initialization happens in <head> via localStorage['tradeforge_theme']
 * to avoid any flash of unstyled or mismatched content.
 */

const ThemeManager = {
  STORAGE_KEY: 'tradeforge_theme',
  SETTINGS_KEY: 'tradeforge_settings',
  DEFAULT_THEME: 'classic',
  THEME_ORDER: ['classic', 'midnight', 'light'],

  THEMES: {
    classic: {
      id: 'classic',
      name: 'Classic',
      tagline: 'Original Obsidian & Slate',
      metaColor: '#141D21',
      colorScheme: 'dark'
    },
    midnight: {
      id: 'midnight',
      name: 'Midnight',
      tagline: 'Deep Navy & Electric Blue',
      metaColor: '#0B1218',
      colorScheme: 'dark'
    },
    light: {
      id: 'light',
      name: 'Light',
      tagline: 'Crisp Daylight Terminal',
      metaColor: '#F1F5F9',
      colorScheme: 'light'
    }
  },

  currentTheme: 'classic',
  _listeners: [],
  _selectorBound: false,

  _getStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
      if (typeof localStorage !== 'undefined') return localStorage;
      if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
    } catch (e) {
      // Safe fallback in restricted browser / test contexts
    }
    return null;
  },

  isValidTheme(theme) {
    return typeof theme === 'string' && Object.prototype.hasOwnProperty.call(this.THEMES, theme);
  },

  normalizeTheme(theme) {
    if (typeof theme !== 'string') return this.DEFAULT_THEME;
    const cleaned = theme.trim().toLowerCase();
    return this.isValidTheme(cleaned) ? cleaned : this.DEFAULT_THEME;
  },

  hasStoredThemePreference() {
    const storage = this._getStorage();
    if (!storage) return false;
    try {
      const direct = storage.getItem(this.STORAGE_KEY);
      if (direct && this.isValidTheme(direct.trim().toLowerCase())) {
        return true;
      }
      const rawSettings = storage.getItem(this.SETTINGS_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed && parsed.theme && this.isValidTheme(String(parsed.theme).trim().toLowerCase())) {
          return true;
        }
      }
    } catch (e) {
      // Ignore malformed storage entries
    }
    return false;
  },

  getStoredTheme() {
    const storage = this._getStorage();
    if (!storage) return this.DEFAULT_THEME;

    try {
      const direct = storage.getItem(this.STORAGE_KEY);
      if (direct && this.isValidTheme(direct.trim().toLowerCase())) {
        return this.normalizeTheme(direct);
      }

      const rawSettings = storage.getItem(this.SETTINGS_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed && parsed.theme && this.isValidTheme(String(parsed.theme).trim().toLowerCase())) {
          return this.normalizeTheme(parsed.theme);
        }
      }
    } catch (e) {
      // Ignore malformed JSON and fall back cleanly to Classic
    }

    return this.DEFAULT_THEME;
  },

  persistTheme(theme) {
    const normalized = this.normalizeTheme(theme);
    const storage = this._getStorage();
    if (!storage) return normalized;

    try {
      storage.setItem(this.STORAGE_KEY, normalized);

      let existingSettings = {};
      try {
        const raw = storage.getItem(this.SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            existingSettings = parsed;
          }
        }
      } catch (e) {
        existingSettings = {};
      }

      storage.setItem(
        this.SETTINGS_KEY,
        JSON.stringify({
          ...existingSettings,
          theme: normalized,
          updatedAt: new Date().toISOString()
        })
      );
    } catch (e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('Could not persist theme preference:', e);
      }
    }

    return normalized;
  },

  getTheme() {
    return this.normalizeTheme(this.currentTheme || this.getStoredTheme());
  },

  getThemeMeta(theme = this.currentTheme) {
    const normalized = this.normalizeTheme(theme);
    return this.THEMES[normalized] || this.THEMES.classic;
  },

  setTheme(theme, options = {}) {
    return this.applyTheme(theme, {
      persist: true,
      silent: false,
      ...options
    });
  },

  applyTheme(theme, options = {}) {
    const normalized = this.normalizeTheme(theme);
    const previousTheme = this.currentTheme;
    const meta = this.getThemeMeta(normalized);
    this.currentTheme = normalized;

    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', normalized);
      this.updateMetaThemeColor(meta);
    }

    if (options.persist !== false) {
      this.persistTheme(normalized);
    }

    this.updateSelectorUI();

    if (!options.silent) {
      this._emit({
        theme: normalized,
        previousTheme,
        meta
      });
    }

    return normalized;
  },

  updateMetaThemeColor(meta = this.getThemeMeta()) {
    if (typeof document === 'undefined') return;
    const metaEl = document.querySelector('meta[name="theme-color"]');
    if (metaEl && meta && meta.metaColor) {
      metaEl.setAttribute('content', meta.metaColor);
    }
  },

  updateSelectorUI() {
    if (typeof document === 'undefined') return;
    const activeTheme = this.normalizeTheme(this.currentTheme);
    const activeMeta = this.getThemeMeta(activeTheme);

    document.querySelectorAll('.appearance-theme-card[data-theme-choice]').forEach(card => {
      const choice = card.getAttribute('data-theme-choice');
      const isSelected = choice === activeTheme;
      card.classList.toggle('active', isSelected);
      card.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      card.setAttribute('tabindex', isSelected ? '0' : '-1');
      const badgeEl = card.querySelector('.appearance-theme-status');
      if (badgeEl) {
        badgeEl.textContent = isSelected ? 'Active' : (choice === 'classic' ? 'Default' : 'Select');
      }
    });

    const activeLabel = document.getElementById('settingsActiveThemeLabel');
    if (activeLabel && activeMeta) {
      activeLabel.textContent = `${activeMeta.name} (${activeMeta.tagline})`;
    }
  },

  bindSelectorEvents() {
    if (this._selectorBound || typeof document === 'undefined') return;
    const grid = document.getElementById('appearanceThemeGrid');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('.appearance-theme-card[data-theme-choice]'));
    if (cards.length === 0) return;

    cards.forEach((card, idx) => {
      card.addEventListener('click', () => {
        const chosen = card.getAttribute('data-theme-choice');
        this.setTheme(chosen);
        const meta = this.getThemeMeta(chosen);
        if (typeof App !== 'undefined' && App.showToast) {
          App.showToast(`Theme switched to ${meta.name}`, 'success');
        }
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const chosen = card.getAttribute('data-theme-choice');
          this.setTheme(chosen);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          const next = cards[(idx + 1) % cards.length];
          if (next) {
            next.focus();
            this.setTheme(next.getAttribute('data-theme-choice'));
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = cards[(idx - 1 + cards.length) % cards.length];
          if (prev) {
            prev.focus();
            this.setTheme(prev.getAttribute('data-theme-choice'));
          }
        }
      });
    });

    this._selectorBound = true;
  },

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this._listeners.push(listener);
    return () => {
      this._listeners = this._listeners.filter(fn => fn !== listener);
    };
  },

  _emit(payload) {
    if (!this._listeners || this._listeners.length === 0) return;
    this._listeners.slice().forEach(fn => {
      try {
        fn(payload);
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('ThemeManager listener error:', e);
        }
      }
    });
  },

  init() {
    let initial = this.getStoredTheme();
    if (typeof document !== 'undefined' && document.documentElement) {
      const domAttr = document.documentElement.getAttribute('data-theme');
      if (domAttr && this.isValidTheme(domAttr)) {
        initial = this.normalizeTheme(domAttr);
      }
    }
    this.applyTheme(initial, { persist: false, silent: true });
    this.bindSelectorEvents();
    this.updateSelectorUI();
    return initial;
  }
};

if (typeof window !== 'undefined') {
  window.ThemeManager = ThemeManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
if (typeof globalThis !== 'undefined') {
  globalThis.ThemeManager = ThemeManager;
}
