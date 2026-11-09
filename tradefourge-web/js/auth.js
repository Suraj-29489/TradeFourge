/**
 * TradeForge - Authentication Validation, Adapter Contract, Session State & UI Controller
 *
 * Architectural & Security Principles:
 * - Strict separation between application login session state (AuthSessionManager)
 *   and Google Drive API authorization tokens (GoogleAuthManager / GoogleDriveStorage).
 * - NEVER stores plaintext passwords, password hashes, or OAuth tokens in localStorage/sessionStorage.
 * - Keeps email/password auth decoupled behind AuthServiceAdapter so real server-side
 *   endpoints (/api/auth/login, /api/auth/register, /api/auth/forgot-password) can be
 *   connected without changing UI code or inventing insecure local password checks.
 */

(function (global) {
  'use strict';

  const SESSION_STORAGE_KEY = 'tradeforge_auth_session';
  const TEMP_SESSION_KEY = 'tradeforge_auth_session_tmp';
  const PREFS_STORAGE_KEY = 'tradeforge_auth_prefs';

  // ==================== 1. PURE FIELD VALIDATORS ====================
  const AuthValidators = {
    MIN_PASSWORD_LENGTH: 8,

    validateEmail(rawEmail) {
      const email = String(rawEmail === undefined || rawEmail === null ? '' : rawEmail).trim();
      if (!email) {
        return { valid: false, email: '', error: 'Email address is required.' };
      }
      if (/\s/.test(email) || email.length > 254) {
        return { valid: false, email, error: 'Please enter a valid email address.' };
      }
      const parts = email.split('@');
      if (parts.length !== 2) {
        return { valid: false, email, error: 'Please enter a valid email address.' };
      }
      const [localPart, domainPart] = parts;
      if (
        !localPart ||
        localPart.startsWith('.') ||
        localPart.endsWith('.') ||
        localPart.includes('..') ||
        !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)
      ) {
        return { valid: false, email, error: 'Please enter a valid email address.' };
      }
      if (
        !domainPart ||
        !domainPart.includes('.') ||
        domainPart.startsWith('.') ||
        domainPart.endsWith('.') ||
        domainPart.includes('..') ||
        !/^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(domainPart)
      ) {
        return { valid: false, email, error: 'Please enter a valid email address.' };
      }
      const tld = domainPart.split('.').pop();
      if (!tld || tld.length < 2) {
        return { valid: false, email, error: 'Please enter a valid email domain.' };
      }
      return { valid: true, email, error: '' };
    },

    validatePassword(rawPassword) {
      const password = String(rawPassword === undefined || rawPassword === null ? '' : rawPassword);
      if (!password) {
        return { valid: false, error: 'Password is required.' };
      }
      if (password.length < this.MIN_PASSWORD_LENGTH) {
        return {
          valid: false,
          error: `Password must be at least ${this.MIN_PASSWORD_LENGTH} characters.`
        };
      }
      return { valid: true, error: '' };
    },

    validateFullName(rawName) {
      const fullName = String(rawName === undefined || rawName === null ? '' : rawName).trim();
      if (!fullName) {
        return { valid: false, fullName: '', error: 'Full name is required.' };
      }
      if (fullName.length < 2) {
        return { valid: false, fullName, error: 'Full name must be at least 2 characters.' };
      }
      return { valid: true, fullName, error: '' };
    },

    validateLoginForm({ email, password } = {}) {
      const emailRes = this.validateEmail(email);
      const passRes = this.validatePassword(password);
      const errors = {};
      if (!emailRes.valid) errors.email = emailRes.error;
      if (!passRes.valid) errors.password = passRes.error;

      return {
        valid: Object.keys(errors).length === 0,
        values: {
          email: emailRes.email
        },
        errors
      };
    },

    validateRegisterForm({ fullName, email, password, confirmPassword, acceptTerms } = {}) {
      const nameRes = this.validateFullName(fullName);
      const emailRes = this.validateEmail(email);
      const passRes = this.validatePassword(password);
      const confirmStr = String(confirmPassword === undefined || confirmPassword === null ? '' : confirmPassword);
      const errors = {};

      if (!nameRes.valid) errors.fullName = nameRes.error;
      if (!emailRes.valid) errors.email = emailRes.error;
      if (!passRes.valid) errors.password = passRes.error;

      if (!confirmStr) {
        errors.confirmPassword = 'Please confirm your password.';
      } else if (String(password || '') !== confirmStr) {
        errors.confirmPassword = 'Passwords do not match.';
      }

      if (!acceptTerms) {
        errors.acceptTerms = 'You must agree to the Terms & Conditions to create an account.';
      }

      return {
        valid: Object.keys(errors).length === 0,
        values: {
          fullName: nameRes.fullName,
          email: emailRes.email
        },
        errors
      };
    },

    validateForgotPasswordForm({ email } = {}) {
      const emailRes = this.validateEmail(email);
      const errors = {};
      if (!emailRes.valid) errors.email = emailRes.error;
      return {
        valid: Object.keys(errors).length === 0,
        values: {
          email: emailRes.email
        },
        errors
      };
    }
  };

  // ==================== 2. BACKEND AUTH ADAPTER ====================
  const AuthServiceAdapter = {
    _customFetch: null,
    _customConfig: null,
    _simulatedDelayMs: 180,

    _getAuthConfig() {
      if (this._customConfig) return this._customConfig;
      if (typeof TradeForgeConfig !== 'undefined' && typeof TradeForgeConfig.getAuthConfig === 'function') {
        return TradeForgeConfig.getAuthConfig();
      }
      return {
        enabled: false,
        baseUrl: '',
        endpoints: {
          login: '/api/auth/login',
          register: '/api/auth/register',
          forgotPassword: '/api/auth/forgot-password',
          logout: '/api/auth/logout',
          session: '/api/auth/session'
        }
      };
    },

    isBackendConfigured() {
      return Boolean(this._getAuthConfig().enabled);
    },

    _getFetchFn() {
      if (this._customFetch) return this._customFetch;
      if (typeof global.fetch === 'function') return global.fetch.bind(global);
      return null;
    },

    _resolveUrl(endpointPath) {
      const cfg = this._getAuthConfig();
      const base = String(cfg.baseUrl || '').replace(/\/+$/, '');
      if (!base) return endpointPath;
      return `${base}${endpointPath.startsWith('/') ? endpointPath : '/' + endpointPath}`;
    },

    async _yieldTick() {
      const ms = Math.max(0, Number(this._simulatedDelayMs) || 0);
      if (!ms) return;
      await new Promise((resolve) => setTimeout(resolve, ms));
    },

    async _postJson(endpointKey, payload) {
      const cfg = this._getAuthConfig();
      const fetchFn = this._getFetchFn();
      if (!fetchFn) {
        return {
          ok: false,
          code: 'FETCH_UNAVAILABLE',
          title: 'Network Unavailable',
          message: 'Browser fetch API is unavailable in this environment.'
        };
      }
      const path = (cfg.endpoints && cfg.endpoints[endpointKey]) || `/api/auth/${endpointKey}`;
      const url = this._resolveUrl(path);

      try {
        const res = await fetchFn(url, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        let data = null;
        try {
          data = await res.json();
        } catch (e) {
          data = null;
        }

        if (!res.ok) {
          return {
            ok: false,
            code: (data && data.code) || `HTTP_${res.status}`,
            title: res.status === 401 ? 'Invalid Credentials' : 'Authentication Error',
            message: (data && data.message) || `Authentication server returned status ${res.status}.`
          };
        }

        return Object.assign({ ok: true }, data || {});
      } catch (err) {
        return {
          ok: false,
          code: 'NETWORK_ERROR',
          title: 'Connection Error',
          message: (err && err.message) || 'Could not reach the authentication server.'
        };
      }
    },

    async loginWithEmail({ email, password, rememberMe = false } = {}) {
      const check = AuthValidators.validateLoginForm({ email, password });
      if (!check.valid) {
        return { ok: false, code: 'VALIDATION_ERROR', errors: check.errors, message: 'Please correct the highlighted fields.' };
      }

      if (!this.isBackendConfigured()) {
        await this._yieldTick();
        return {
          ok: false,
          code: 'AUTH_BACKEND_REQUIRED',
          title: 'Email Sign-In Unavailable',
          message: 'Email and password sign-in is not enabled yet. Click "Continue with Google" below to sign in and sync your trading journal.'
        };
      }

      const res = await this._postJson('login', {
        email: check.values.email,
        password: String(password),
        rememberMe: Boolean(rememberMe)
      });

      if (!res.ok) return res;
      if (!res.user || !res.user.email) {
        return {
          ok: false,
          code: 'INVALID_RESPONSE',
          title: 'Invalid Server Response',
          message: 'Authentication server did not return valid account details.'
        };
      }

      return {
        ok: true,
        user: {
          id: String(res.user.id || res.user.sub || res.user.email),
          name: String(res.user.name || check.values.email.split('@')[0]),
          email: String(res.user.email),
          picture: res.user.picture ? String(res.user.picture) : '',
          provider: 'email'
        }
      };
    },

    async registerWithEmail({ fullName, email, password, confirmPassword, acceptTerms } = {}) {
      const check = AuthValidators.validateRegisterForm({
        fullName,
        email,
        password,
        confirmPassword,
        acceptTerms
      });
      if (!check.valid) {
        return { ok: false, code: 'VALIDATION_ERROR', errors: check.errors, message: 'Please correct the highlighted fields.' };
      }

      if (!this.isBackendConfigured()) {
        await this._yieldTick();
        return {
          ok: false,
          code: 'AUTH_BACKEND_REQUIRED',
          title: 'Email Registration Unavailable',
          message: 'Email and password registration is not enabled yet. Click "Sign up with Google" below to create your account and sync with Google Drive.'
        };
      }

      const res = await this._postJson('register', {
        fullName: check.values.fullName,
        email: check.values.email,
        password: String(password),
        acceptTerms: true
      });

      if (!res.ok) return res;
      if (!res.user || !res.user.email) {
        return {
          ok: false,
          code: 'INVALID_RESPONSE',
          title: 'Invalid Server Response',
          message: 'Registration endpoint did not return a user profile.'
        };
      }

      return {
        ok: true,
        user: {
          id: String(res.user.id || res.user.sub || res.user.email),
          name: String(res.user.name || check.values.fullName),
          email: String(res.user.email),
          picture: res.user.picture ? String(res.user.picture) : '',
          provider: 'email'
        }
      };
    },

    async requestPasswordReset({ email } = {}) {
      const check = AuthValidators.validateForgotPasswordForm({ email });
      if (!check.valid) {
        return { ok: false, code: 'VALIDATION_ERROR', errors: check.errors, message: check.errors.email };
      }

      if (!this.isBackendConfigured()) {
        await this._yieldTick();
        return {
          ok: false,
          code: 'AUTH_BACKEND_REQUIRED',
          title: 'Password Reset Unavailable',
          message: 'Password reset via email is not enabled yet. Use "Continue with Google" to access your account without a password.'
        };
      }

      const res = await this._postJson('forgotPassword', { email: check.values.email });
      if (!res.ok) return res;

      return {
        ok: true,
        title: 'Reset Request Sent',
        message: res.message || `If an account exists for ${check.values.email}, a password reset link has been sent.`
      };
    },

    async logoutBackend() {
      if (!this.isBackendConfigured()) return { ok: true };
      return this._postJson('logout', {});
    }
  };

  // ==================== 3. SESSION MANAGER ====================
  function _getLocalStorage() {
    try {
      if (typeof global.localStorage !== 'undefined') return global.localStorage;
    } catch (e) {}
    return null;
  }

  function _getSessionStorage() {
    try {
      if (typeof global.sessionStorage !== 'undefined') return global.sessionStorage;
    } catch (e) {}
    return null;
  }

  function _sanitizeUserProfile(rawUser, fallbackProvider = 'google') {
    if (!rawUser || !rawUser.email) return null;
    const provider = rawUser.provider === 'email' ? 'email' : fallbackProvider;
    const id = rawUser.id || rawUser.sub || rawUser.email;
    return {
      id: String(id),
      name: String(rawUser.name || rawUser.email),
      email: String(rawUser.email),
      picture: rawUser.picture ? String(rawUser.picture) : '',
      provider
    };
  }

  const AuthSessionManager = {
    SESSION_STORAGE_KEY,
    TEMP_SESSION_KEY,
    PREFS_STORAGE_KEY,

    status: 'unauthenticated', // 'unauthenticated' | 'authenticating' | 'authenticated'
    user: null,
    rememberMe: false,
    _initialized: false,
    _listeners: [],
    _inFlightGooglePromise: null,
    _unsubGoogle: null,
    _ignoreGoogleEvents: false,

    init() {
      const prefs = this._readPrefs();
      this.rememberMe = Boolean(prefs.rememberMe);

      const restored = this._readStoredSession();
      if (restored && restored.user) {
        this.user = restored.user;
        this.rememberMe = Boolean(restored.rememberMe);
        this.status = 'authenticated';
      } else if (
        typeof GoogleAuthManager !== 'undefined' &&
        GoogleAuthManager.hasValidToken &&
        GoogleAuthManager.hasValidToken() &&
        GoogleAuthManager.account
      ) {
        const gAcct = GoogleAuthManager.account;
        this.setSession(
          {
            id: gAcct.sub,
            name: gAcct.name,
            email: gAcct.email,
            picture: gAcct.picture,
            provider: 'google'
          },
          { rememberMe: this.rememberMe, silent: true }
        );
      } else {
        this.user = null;
        this.status = 'unauthenticated';
      }

      if (this._unsubGoogle) {
        this._unsubGoogle();
        this._unsubGoogle = null;
      }
      if (typeof GoogleAuthManager !== 'undefined' && typeof GoogleAuthManager.subscribe === 'function') {
        this._unsubGoogle = GoogleAuthManager.subscribe((authEvent) => {
          if (!authEvent || this._ignoreGoogleEvents) return;
          if (authEvent.eventType === 'signed_in' && authEvent.account) {
            const gAcct = authEvent.account;
            const sameActiveUser = Boolean(this.isAuthenticated() && this.user && this.user.provider === 'google' && this.user.id === gAcct.sub);
            const keepRemember = (authEvent.detail && typeof authEvent.detail.rememberMe === 'boolean')
              ? authEvent.detail.rememberMe
              : (this.user && this.user.provider === 'google' ? this.rememberMe : true);
            this.setSession(
              {
                id: gAcct.sub,
                name: gAcct.name,
                email: gAcct.email,
                picture: gAcct.picture,
                provider: 'google'
              },
              { rememberMe: keepRemember, silent: sameActiveUser }
            );
          } else if (
            authEvent.eventType === 'signed_out' ||
            (authEvent.eventType === 'session_checked' && !authEvent.isSignedIn)
          ) {
            if (this.user && this.user.provider === 'google') {
              this._clearPersistedSessions();
              this.user = null;
              this.status = 'unauthenticated';
              this._emit('session_locked', { reason: 'google_signed_out' });
            }
          }
        });
      }

      this._initialized = true;
      this._emit('init');
      return this.getState();
    },

    async syncWithServerSession() {
      if (typeof GoogleAuthManager === 'undefined' || typeof GoogleAuthManager.checkSession !== 'function') {
        return this.getState();
      }
      const st = await GoogleAuthManager.checkSession();
      if (st && st.isSignedIn && st.hasValidToken && st.account) {
        const sameActiveUser = Boolean(this.isAuthenticated() && this.user && this.user.provider === 'google' && this.user.id === st.account.sub);
        const keepRemember = typeof st.rememberMe === 'boolean' ? st.rememberMe : true;
        if (!sameActiveUser || this.rememberMe !== keepRemember) {
          this.setSession(
            {
              id: st.account.sub,
              name: st.account.name,
              email: st.account.email,
              picture: st.account.picture,
              provider: 'google'
            },
            { rememberMe: keepRemember, silent: sameActiveUser }
          );
        }
      } else if (st && !st.isSignedIn && this.user && this.user.provider === 'google') {
        this._clearPersistedSessions();
        this.user = null;
        this.status = 'unauthenticated';
        this._emit('session_locked', { reason: 'google_signed_out' });
      }
      return this.getState();
    },

    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      this._listeners.push(listener);
      return () => {
        this._listeners = this._listeners.filter((fn) => fn !== listener);
      };
    },

    _emit(eventType, detail = {}) {
      const snapshot = Object.assign({}, this.getState(), { eventType, detail });
      this._listeners.slice().forEach((fn) => {
        try {
          fn(snapshot);
        } catch (e) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('AuthSessionManager listener error:', e);
          }
        }
      });
    },

    isAuthenticated() {
      return Boolean(this.status === 'authenticated' && this.user && this.user.email);
    },

    getState() {
      return {
        status: this.status,
        isAuthenticated: this.isAuthenticated(),
        rememberMe: this.rememberMe,
        user: this.user ? Object.assign({}, this.user) : null,
        prefs: this._readPrefs(),
        returningGoogleAccount: this.getReturningGoogleAccount()
      };
    },

    getReturningGoogleAccount() {
      if (this.isAuthenticated()) return null;
      if (typeof GoogleAuthManager === 'undefined') return null;
      const acct = GoogleAuthManager.account || (GoogleAuthManager._loadSavedAccount && GoogleAuthManager._loadSavedAccount());
      if (!acct || !acct.email) return null;
      return {
        sub: String(acct.sub || ''),
        name: String(acct.name || acct.email),
        email: String(acct.email),
        picture: acct.picture ? String(acct.picture) : ''
      };
    },

    _readPrefs() {
      const ls = _getLocalStorage();
      if (!ls) return { rememberMe: false, lastEmail: '' };
      try {
        const raw = ls.getItem(PREFS_STORAGE_KEY);
        if (!raw) return { rememberMe: false, lastEmail: '' };
        const parsed = JSON.parse(raw);
        return {
          rememberMe: Boolean(parsed && parsed.rememberMe),
          lastEmail: parsed && parsed.lastEmail ? String(parsed.lastEmail) : ''
        };
      } catch (e) {
        return { rememberMe: false, lastEmail: '' };
      }
    },

    _savePrefs({ rememberMe, lastEmail }) {
      const ls = _getLocalStorage();
      if (!ls) return;
      try {
        ls.setItem(
          PREFS_STORAGE_KEY,
          JSON.stringify({
            rememberMe: Boolean(rememberMe),
            lastEmail: rememberMe && lastEmail ? String(lastEmail) : ''
          })
        );
      } catch (e) {}
    },

    _readStoredSession() {
      const parseRaw = (raw, expectedRemember) => {
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw);
          if (!parsed || !parsed.user) return null;
          const user = _sanitizeUserProfile(parsed.user, parsed.provider || 'google');
          if (!user) return null;
          return {
            user,
            rememberMe: expectedRemember !== undefined ? expectedRemember : Boolean(parsed.rememberMe),
            authenticatedAt: parsed.authenticatedAt || null
          };
        } catch (e) {
          return null;
        }
      };

      const ss = _getSessionStorage();
      if (ss) {
        const tempHit = parseRaw(ss.getItem(TEMP_SESSION_KEY), false);
        if (tempHit) return tempHit;
      }

      const ls = _getLocalStorage();
      if (ls) {
        const persistentHit = parseRaw(ls.getItem(SESSION_STORAGE_KEY), true);
        if (persistentHit) return persistentHit;
      }

      return null;
    },

    _clearPersistedSessions() {
      const ls = _getLocalStorage();
      const ss = _getSessionStorage();
      if (ls) {
        try { ls.removeItem(SESSION_STORAGE_KEY); } catch (e) {}
      }
      if (ss) {
        try { ss.removeItem(TEMP_SESSION_KEY); } catch (e) {}
      }
    },

    setSession(rawUser, options = {}) {
      const user = _sanitizeUserProfile(rawUser, options.provider || (rawUser && rawUser.provider) || 'google');
      if (!user) return null;

      const rememberMe = options.rememberMe !== undefined ? Boolean(options.rememberMe) : this.rememberMe;
      this.user = user;
      this.rememberMe = rememberMe;
      this.status = 'authenticated';

      const payload = JSON.stringify({
        schemaVersion: 1,
        provider: user.provider,
        rememberMe,
        authenticatedAt: new Date().toISOString(),
        user
      });

      const ls = _getLocalStorage();
      const ss = _getSessionStorage();

      if (rememberMe) {
        if (ls) {
          try { ls.setItem(SESSION_STORAGE_KEY, payload); } catch (e) {}
        }
        if (ss) {
          try { ss.removeItem(TEMP_SESSION_KEY); } catch (e) {}
        }
      } else {
        if (ss) {
          try { ss.setItem(TEMP_SESSION_KEY, payload); } catch (e) {}
        }
        if (ls) {
          try { ls.removeItem(SESSION_STORAGE_KEY); } catch (e) {}
        }
      }

      this._savePrefs({
        rememberMe,
        lastEmail: user.email
      });

      if (!options.silent) {
        this._emit('session_unlocked', { user: Object.assign({}, user), rememberMe });
      }
      return this.getState();
    },

    signInWithGoogle(options = {}) {
      if (this._inFlightGooglePromise) {
        return this._inFlightGooglePromise;
      }

      if (typeof GoogleAuthManager === 'undefined') {
        const err = new Error('Google authentication module is not loaded.');
        err.code = 'MODULE_MISSING';
        return Promise.reject(err);
      }

      const selectAccount = options.selectAccount !== false;
      const rememberMe = options.rememberMe !== undefined ? Boolean(options.rememberMe) : true;
      const hint = options.hint ? String(options.hint) : '';
      const prevStatus = this.status;

      this.status = 'authenticating';
      this._emit('authenticating', { provider: 'google' });

      const run = async () => {
        this._ignoreGoogleEvents = true;
        try {
          const mode = options.mode === 'popup' ? 'popup' : 'redirect';
          const res = !selectAccount && hint && typeof GoogleAuthManager.reconnect === 'function'
            ? await GoogleAuthManager.reconnect({ selectAccount: false, rememberMe, mode, returnTo: options.returnTo })
            : await GoogleAuthManager.signIn({ selectAccount, hint, rememberMe, mode, returnTo: options.returnTo });

          if (res && res.redirected) {
            return {
              ok: true,
              redirected: true,
              url: res.url
            };
          }

          const acct = res && res.account ? res.account : GoogleAuthManager.account;
          if (!acct || !acct.email) {
            const profileErr = new Error('Google did not return valid account profile information.');
            profileErr.code = 'INVALID_PROFILE';
            throw profileErr;
          }

          this.setSession(
            {
              id: acct.sub,
              name: acct.name,
              email: acct.email,
              picture: acct.picture,
              provider: 'google'
            },
            { rememberMe, silent: false }
          );

          return {
            ok: true,
            user: Object.assign({}, this.user),
            switchedAccount: Boolean(res && res.switchedAccount)
          };
        } catch (err) {
          this.status = this.user ? 'authenticated' : (prevStatus === 'authenticated' ? 'authenticated' : 'unauthenticated');
          this._emit('auth_error', { error: err });
          throw err;
        } finally {
          this._ignoreGoogleEvents = false;
          this._inFlightGooglePromise = null;
        }
      };

      this._inFlightGooglePromise = run();
      return this._inFlightGooglePromise;
    },

    async signOut(options = {}) {
      const clearGoogle = options.clearGoogle !== false;
      this._clearPersistedSessions();
      const prevUser = this.user ? Object.assign({}, this.user) : null;

      this.user = null;
      this.status = 'unauthenticated';

      if (clearGoogle && typeof GoogleAuthManager !== 'undefined') {
        this._ignoreGoogleEvents = true;
        try {
          await GoogleAuthManager.signOut();
        } finally {
          this._ignoreGoogleEvents = false;
        }
      }

      if (prevUser && prevUser.provider === 'email') {
        try {
          await AuthServiceAdapter.logoutBackend();
        } catch (e) {}
      }

      this._emit('session_locked', { reason: 'user_sign_out', previousUser: prevUser });
      return true;
    }
  };

  // ==================== 4. AUTH PAGE UI CONTROLLER ====================
  const AuthUIController = {
    _initialized: false,
    _activeTab: 'login', // 'login' | 'register' | 'forgot'
    _isSubmitting: false,

    init() {
      if (typeof document === 'undefined') return;
      const gate = document.getElementById('authGateView');
      if (!gate) return;

      if (!this._initialized) {
        this._initialized = true;
        this._bindEvents();
      }

      this.syncFromSessionState();
    },

    _bindEvents() {
      const tabLogin = document.getElementById('authTabLogin');
      const tabRegister = document.getElementById('authTabRegister');
      const loginForm = document.getElementById('authLoginForm');
      const registerForm = document.getElementById('authRegisterForm');
      const forgotForm = document.getElementById('authForgotForm');
      const forgotBtn = document.getElementById('authForgotPasswordBtn');
      const backToLoginBtn = document.getElementById('authBackToLoginBtn');
      const googleLoginBtn = document.getElementById('authGoogleLoginBtn');
      const googleRegisterBtn = document.getElementById('authGoogleRegisterBtn');
      const returningReconnectBtn = document.getElementById('authReturningReconnectBtn');
      const alertCloseBtn = document.getElementById('authAlertCloseBtn');
      const termsToggleBtn = document.getElementById('authTermsTriggerBtn');

      if (tabLogin) tabLogin.addEventListener('click', () => this.switchTab('login'));
      if (tabRegister) tabRegister.addEventListener('click', () => this.switchTab('register'));

      if (forgotBtn) {
        forgotBtn.addEventListener('click', () => {
          const loginEmail = document.getElementById('authLoginEmail');
          const forgotEmail = document.getElementById('authForgotEmail');
          if (loginEmail && forgotEmail && !forgotEmail.value.trim() && loginEmail.value.trim()) {
            forgotEmail.value = loginEmail.value.trim();
          }
          this.switchTab('forgot');
        });
      }

      if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', () => this.switchTab('login'));
      }

      if (alertCloseBtn) {
        alertCloseBtn.addEventListener('click', () => this.clearAlert());
      }

      if (termsToggleBtn) {
        termsToggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const box = document.getElementById('authTermsInlineBox');
          if (box) {
            const nextHidden = !box.hidden;
            box.hidden = nextHidden;
            termsToggleBtn.setAttribute('aria-expanded', nextHidden ? 'false' : 'true');
          }
        });
      }

      // Show/Hide password toggles
      document.querySelectorAll('#authGateView .auth-password-toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetId = btn.getAttribute('data-target');
          const input = targetId ? document.getElementById(targetId) : null;
          if (!input) return;
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          btn.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
          btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        });
      });

      // Live input clearing + blur validation
      const bindFieldClear = (id, validatorFn) => {
        const el = document.getElementById(id);
        if (!el) return;
        const clear = () => this.setFieldError(id, '');
        el.addEventListener('input', clear);
        el.addEventListener('change', clear);
        if (validatorFn) {
          el.addEventListener('blur', () => {
            if (!el.value && el.type !== 'checkbox') return;
            const err = validatorFn(el);
            this.setFieldError(id, err || '');
          });
        }
      };

      bindFieldClear('authLoginEmail', (el) => {
        const r = AuthValidators.validateEmail(el.value);
        return r.valid ? '' : r.error;
      });
      bindFieldClear('authLoginPassword', (el) => {
        const r = AuthValidators.validatePassword(el.value);
        return r.valid ? '' : r.error;
      });
      bindFieldClear('authRegisterName', (el) => {
        const r = AuthValidators.validateFullName(el.value);
        return r.valid ? '' : r.error;
      });
      bindFieldClear('authRegisterEmail', (el) => {
        const r = AuthValidators.validateEmail(el.value);
        return r.valid ? '' : r.error;
      });
      bindFieldClear('authRegisterPassword', (el) => {
        const r = AuthValidators.validatePassword(el.value);
        return r.valid ? '' : r.error;
      });
      bindFieldClear('authRegisterConfirmPassword', (el) => {
        const pwd = document.getElementById('authRegisterPassword')?.value || '';
        if (!el.value) return '';
        return el.value === pwd ? '' : 'Passwords do not match.';
      });
      bindFieldClear('authRegisterTerms', null);
      bindFieldClear('authForgotEmail', (el) => {
        const r = AuthValidators.validateEmail(el.value);
        return r.valid ? '' : r.error;
      });

      // Login form submission
      if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleLoginSubmit();
        });
      }

      // Register form submission
      if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleRegisterSubmit();
        });
      }

      // Forgot password submission
      if (forgotForm) {
        forgotForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleForgotSubmit();
        });
      }

      // Google auth buttons
      if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
          const remember = Boolean(document.getElementById('authRememberMe')?.checked);
          this.handleGoogleAuth({ buttonId: 'authGoogleLoginBtn', selectAccount: true, rememberMe: remember });
        });
      }

      if (googleRegisterBtn) {
        googleRegisterBtn.addEventListener('click', () => {
          this.handleGoogleAuth({ buttonId: 'authGoogleRegisterBtn', selectAccount: true, rememberMe: true });
        });
      }

      if (returningReconnectBtn) {
        returningReconnectBtn.addEventListener('click', () => {
          const returning = AuthSessionManager.getReturningGoogleAccount();
          const remember = Boolean(document.getElementById('authRememberMe')?.checked);
          this.handleGoogleAuth({
            buttonId: 'authReturningReconnectBtn',
            selectAccount: false,
            hint: returning ? returning.email : '',
            rememberMe: remember
          });
        });
      }
    },

    switchTab(tabName) {
      const next = tabName === 'register' ? 'register' : (tabName === 'forgot' ? 'forgot' : 'login');
      this._activeTab = next;
      this.clearAlert();
      this.clearAllFieldErrors();

      const tabsWrap = document.getElementById('authTabs');
      const tabLogin = document.getElementById('authTabLogin');
      const tabRegister = document.getElementById('authTabRegister');
      const panelLogin = document.getElementById('authLoginPanel');
      const panelRegister = document.getElementById('authRegisterPanel');
      const panelForgot = document.getElementById('authForgotPanel');

      if (tabsWrap) {
        tabsWrap.hidden = next === 'forgot';
        tabsWrap.setAttribute('data-active-tab', next === 'register' ? 'register' : 'login');
      }

      if (tabLogin) {
        tabLogin.classList.toggle('active', next === 'login');
        tabLogin.setAttribute('aria-selected', next === 'login' ? 'true' : 'false');
      }
      if (tabRegister) {
        tabRegister.classList.toggle('active', next === 'register');
        tabRegister.setAttribute('aria-selected', next === 'register' ? 'true' : 'false');
      }

      if (panelLogin) panelLogin.hidden = next !== 'login';
      if (panelRegister) panelRegister.hidden = next !== 'register';
      if (panelForgot) panelForgot.hidden = next !== 'forgot';
    },

    setFieldError(inputId, message) {
      const input = document.getElementById(inputId);
      const errorEl = document.getElementById(`${inputId}Error`);
      if (input) {
        input.classList.toggle('is-invalid', Boolean(message));
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
      }
      if (errorEl) {
        errorEl.textContent = message || '';
      }
    },

    clearAllFieldErrors() {
      [
        'authLoginEmail',
        'authLoginPassword',
        'authRegisterName',
        'authRegisterEmail',
        'authRegisterPassword',
        'authRegisterConfirmPassword',
        'authRegisterTerms',
        'authForgotEmail'
      ].forEach((id) => this.setFieldError(id, ''));
    },

    applyValidationErrors(mapping) {
      let firstInvalidId = null;
      Object.keys(mapping).forEach((inputId) => {
        const msg = mapping[inputId];
        this.setFieldError(inputId, msg);
        if (msg && !firstInvalidId) {
          firstInvalidId = inputId;
        }
      });
      if (firstInvalidId) {
        const el = document.getElementById(firstInvalidId);
        if (el && typeof el.focus === 'function') el.focus();
      }
    },

    showAlert({ type = 'info', title = '', message = '', actionLabel = '', onAction = null } = {}) {
      const box = document.getElementById('authAlertBox');
      const titleEl = document.getElementById('authAlertTitle');
      const msgEl = document.getElementById('authAlertMessage');
      const actionBtn = document.getElementById('authAlertActionBtn');
      if (!box) return;

      box.className = `auth-alert ${type}`;
      if (titleEl) {
        titleEl.textContent = title || '';
        titleEl.hidden = !title;
      }
      if (msgEl) msgEl.textContent = message || '';
      if (actionBtn) {
        if (actionLabel && typeof onAction === 'function') {
          actionBtn.textContent = actionLabel;
          actionBtn.hidden = false;
          actionBtn.onclick = onAction;
        } else {
          actionBtn.hidden = true;
          actionBtn.onclick = null;
        }
      }
      box.hidden = false;
    },

    clearAlert() {
      const box = document.getElementById('authAlertBox');
      if (box) box.hidden = true;
    },

    setLoading(activeButtonId, loading) {
      this._isSubmitting = Boolean(loading);
      const gate = document.getElementById('authGateView');
      if (!gate) return;

      const interactiveIds = [
        'authLoginSubmitBtn',
        'authRegisterSubmitBtn',
        'authForgotSubmitBtn',
        'authGoogleLoginBtn',
        'authGoogleRegisterBtn',
        'authReturningReconnectBtn',
        'authTabLogin',
        'authTabRegister',
        'authForgotPasswordBtn',
        'authBackToLoginBtn'
      ];

      interactiveIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = Boolean(loading);
        el.classList.toggle('is-loading', Boolean(loading && id === activeButtonId));
      });
    },

    clearSensitiveInputs() {
      ['authLoginPassword', 'authRegisterPassword', 'authRegisterConfirmPassword'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.value = '';
          el.type = 'password';
        }
      });
      document.querySelectorAll('#authGateView .auth-password-toggle').forEach((btn) => {
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', 'Show password');
      });
    },

    syncFromSessionState() {
      const state = AuthSessionManager.getState();
      this.setLocked(!state.isAuthenticated);

      // Prefill email/remember checkbox if user opted in
      const emailEl = document.getElementById('authLoginEmail');
      const rememberEl = document.getElementById('authRememberMe');
      if (state.prefs) {
        if (rememberEl) rememberEl.checked = Boolean(state.prefs.rememberMe);
        if (emailEl && !emailEl.value && state.prefs.rememberMe && state.prefs.lastEmail) {
          emailEl.value = state.prefs.lastEmail;
        }
      }

      // Show returning Google account quick-reconnect banner when locked
      const returningBox = document.getElementById('authReturningGoogleBox');
      const ret = state.returningGoogleAccount;
      if (returningBox) {
        if (!state.isAuthenticated && ret) {
          const avatar = document.getElementById('authReturningAvatar');
          const initials = document.getElementById('authReturningInitials');
          const nameEl = document.getElementById('authReturningName');
          const mailEl = document.getElementById('authReturningEmail');
          if (nameEl) nameEl.textContent = ret.name || ret.email;
          if (mailEl) mailEl.textContent = ret.email;

          const letter = (ret.name || ret.email || 'G')
            .split(/\s+/)
            .map((p) => p[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
          if (ret.picture && avatar) {
            avatar.src = ret.picture;
            avatar.hidden = false;
            if (initials) initials.hidden = true;
          } else {
            if (avatar) avatar.hidden = true;
            if (initials) {
              initials.textContent = letter || 'G';
              initials.hidden = false;
            }
          }
          returningBox.hidden = false;
        } else {
          returningBox.hidden = true;
        }
      }
    },

    setLocked(locked) {
      if (typeof document === 'undefined') return;
      const isLocked = Boolean(locked);
      document.body.classList.toggle('auth-locked', isLocked);
      const gate = document.getElementById('authGateView');
      if (gate) {
        gate.setAttribute('aria-hidden', isLocked ? 'false' : 'true');
      }
      if (!isLocked) {
        this.clearSensitiveInputs();
        this.clearAlert();
        this.clearAllFieldErrors();
      }
    },

    async handleLoginSubmit() {
      if (this._isSubmitting) return;
      this.clearAlert();

      const email = document.getElementById('authLoginEmail')?.value || '';
      const password = document.getElementById('authLoginPassword')?.value || '';
      const rememberMe = Boolean(document.getElementById('authRememberMe')?.checked);

      const validation = AuthValidators.validateLoginForm({ email, password });
      if (!validation.valid) {
        this.applyValidationErrors({
          authLoginEmail: validation.errors.email || '',
          authLoginPassword: validation.errors.password || ''
        });
        return;
      }

      this.setLoading('authLoginSubmitBtn', true);
      try {
        const res = await AuthServiceAdapter.loginWithEmail({
          email: validation.values.email,
          password,
          rememberMe
        });

        if (res.ok && res.user) {
          this.clearSensitiveInputs();
          AuthSessionManager.setSession(res.user, { rememberMe, silent: false });
          return;
        }

        if (res.code === 'VALIDATION_ERROR' && res.errors) {
          this.applyValidationErrors({
            authLoginEmail: res.errors.email || '',
            authLoginPassword: res.errors.password || ''
          });
          return;
        }

        this.clearSensitiveInputs();
        this.showAlert({
          type: res.code === 'AUTH_BACKEND_REQUIRED' ? 'info' : 'error',
          title: res.title || 'Unable to Sign In',
          message: res.message || 'Sign-in failed. Please try again.'
        });
      } finally {
        this.setLoading(null, false);
      }
    },

    async handleRegisterSubmit() {
      if (this._isSubmitting) return;
      this.clearAlert();

      const fullName = document.getElementById('authRegisterName')?.value || '';
      const email = document.getElementById('authRegisterEmail')?.value || '';
      const password = document.getElementById('authRegisterPassword')?.value || '';
      const confirmPassword = document.getElementById('authRegisterConfirmPassword')?.value || '';
      const acceptTerms = Boolean(document.getElementById('authRegisterTerms')?.checked);

      const validation = AuthValidators.validateRegisterForm({
        fullName,
        email,
        password,
        confirmPassword,
        acceptTerms
      });
      if (!validation.valid) {
        this.applyValidationErrors({
          authRegisterName: validation.errors.fullName || '',
          authRegisterEmail: validation.errors.email || '',
          authRegisterPassword: validation.errors.password || '',
          authRegisterConfirmPassword: validation.errors.confirmPassword || '',
          authRegisterTerms: validation.errors.acceptTerms || ''
        });
        return;
      }

      this.setLoading('authRegisterSubmitBtn', true);
      try {
        const res = await AuthServiceAdapter.registerWithEmail({
          fullName: validation.values.fullName,
          email: validation.values.email,
          password,
          confirmPassword,
          acceptTerms
        });

        if (res.ok && res.user) {
          this.clearSensitiveInputs();
          AuthSessionManager.setSession(res.user, { rememberMe: true, silent: false });
          return;
        }

        if (res.code === 'VALIDATION_ERROR' && res.errors) {
          this.applyValidationErrors({
            authRegisterName: res.errors.fullName || '',
            authRegisterEmail: res.errors.email || '',
            authRegisterPassword: res.errors.password || '',
            authRegisterConfirmPassword: res.errors.confirmPassword || '',
            authRegisterTerms: res.errors.acceptTerms || ''
          });
          return;
        }

        this.clearSensitiveInputs();
        this.showAlert({
          type: res.code === 'AUTH_BACKEND_REQUIRED' ? 'info' : 'error',
          title: res.title || 'Account Registration Notice',
          message: res.message || 'Could not create account.'
        });
      } finally {
        this.setLoading(null, false);
      }
    },

    async handleForgotSubmit() {
      if (this._isSubmitting) return;
      this.clearAlert();

      const email = document.getElementById('authForgotEmail')?.value || '';
      const validation = AuthValidators.validateForgotPasswordForm({ email });
      if (!validation.valid) {
        this.applyValidationErrors({
          authForgotEmail: validation.errors.email || ''
        });
        return;
      }

      this.setLoading('authForgotSubmitBtn', true);
      try {
        const res = await AuthServiceAdapter.requestPasswordReset({
          email: validation.values.email
        });
        this.showAlert({
          type: res.ok ? 'success' : (res.code === 'AUTH_BACKEND_REQUIRED' ? 'info' : 'error'),
          title: res.title || (res.ok ? 'Reset Link Requested' : 'Reset Unavailable'),
          message: res.message || ''
        });
      } finally {
        this.setLoading(null, false);
      }
    },

    async handleGoogleAuth({ buttonId = 'authGoogleLoginBtn', selectAccount = true, hint = '', rememberMe = true } = {}) {
      if (this._isSubmitting) return;
      this.clearAlert();
      this.setLoading(buttonId, true);
      let redirected = false;

      try {
        const res = await AuthSessionManager.signInWithGoogle({ selectAccount, hint, rememberMe });
        redirected = Boolean(res && res.redirected);
      } catch (err) {
        const code = err && err.code ? err.code : 'AUTH_FAILED';
        const isConfigIssue = code === 'SERVER_NOT_CONFIGURED' || code === 'OFFLINE';
        this.showAlert({
          type: isConfigIssue ? 'info' : 'error',
          title: code === 'SERVER_NOT_CONFIGURED' ? 'Google Sign-In Unavailable' : 'Google Sign-In Did Not Complete',
          message: (err && err.message) || 'Could not sign in with Google.'
        });
      } finally {
        if (!redirected) {
          this.setLoading(null, false);
        }
      }
    }
  };

  global.AuthValidators = AuthValidators;
  global.AuthServiceAdapter = AuthServiceAdapter;
  global.AuthSessionManager = AuthSessionManager;
  global.AuthUIController = AuthUIController;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      AuthValidators,
      AuthServiceAdapter,
      AuthSessionManager,
      AuthUIController
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
