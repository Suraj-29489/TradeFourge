/**
 * TradeForge - Google Authentication Manager (Server-Side OAuth 2.0 Session Client)
 *
 * Security Invariants:
 * - Zero OAuth access_tokens, refresh_tokens, or client_secrets ever touch browser JS or web storage.
 * - OAuth Authorization Code + PKCE runs exclusively through backend endpoints (/api/auth/google -> /api/auth/callback),
 *   storing credentials strictly inside encrypted AES-256-GCM HttpOnly cookies.
 * - Browser stores only non-secret public profile metadata (sub, email, name, picture) for offline display & account isolation.
 */

(function (global) {
  'use strict';

  const ACCOUNT_STORAGE_KEY = 'tradeforge_google_account';
  const KNOWN_ACCOUNTS_KEY = 'tradeforge_google_accounts_index';

  const AUTH_ERROR_MESSAGES = {
    access_denied: 'Google sign-in was cancelled. You can continue using local mode or try again anytime.',
    drive_scope_denied: 'Google Drive access is required so TradeForge can store and sync your trading journal in My Drive / TradeForge.',
    server_not_configured: 'Google sign-in is temporarily unavailable on this server. Please check back shortly.',
    invalid_state: 'Your sign-in request expired or could not be verified. Please click Continue with Google again.',
    missing_code: 'Google sign-in did not complete cleanly. Please try again.',
    token_exchange_failed: 'Could not verify your Google sign-in right now. Please try again.',
    identity_failed: 'Could not verify your Google account identity. Please try again.',
    oauth_failed: 'Google sign-in did not complete. Please try again.',
    auth_failed: 'Google sign-in failed. Please try again.'
  };

  function _getStorage() {
    try {
      if (global.localStorage) return global.localStorage;
    } catch (e) {
      // Ignore storage access restrictions
    }
    return null;
  }

  function _getFetchFn() {
    if (GoogleAuthManager._customFetch) return GoogleAuthManager._customFetch;
    if (typeof global.fetch === 'function') return global.fetch.bind(global);
    return null;
  }

  function _getEndpoints() {
    if (typeof TradeForgeConfig !== 'undefined' && typeof TradeForgeConfig.getAuthConfig === 'function') {
      return TradeForgeConfig.getAuthConfig().endpoints;
    }
    return {
      googleStart: '/api/auth/google',
      session: '/api/auth/session',
      me: '/api/auth/me',
      logout: '/api/auth/logout'
    };
  }

  function _getDriveEndpoints() {
    if (typeof TradeForgeConfig !== 'undefined' && typeof TradeForgeConfig.getDriveEndpoints === 'function') {
      return TradeForgeConfig.getDriveEndpoints();
    }
    return {
      authorize: '/api/drive/authorize'
    };
  }

  const GoogleAuthManager = {
    ACCOUNT_STORAGE_KEY,
    KNOWN_ACCOUNTS_KEY,
    status: 'signed_out', // 'signed_out' | 'authenticating' | 'authenticated' | 'expired'
    account: null, // { sub, email, name, picture, emailVerified, connectedAt }
    driveConnected: false,
    driveScopeGranted: false,
    serverConfigured: true,
    rememberMe: true,
    expiresAt: 0,
    lastError: null,
    _listeners: [],
    _customFetch: null,
    _customNavigate: null,
    _checkSessionPromise: null,

    init() {
      const saved = this._loadSavedAccount();
      if (saved && saved.sub) {
        this.account = saved;
        // Until `/api/auth/me` verifies active HttpOnly cookie on this online load, treat cached profile as cached/expired
        if (this.status !== 'authenticated') {
          this.status = 'expired';
          this.driveConnected = false;
          this.driveScopeGranted = false;
        }
      } else {
        this.account = null;
        this.status = 'signed_out';
        this.driveConnected = false;
        this.driveScopeGranted = false;
      }
      this._emit('init');
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
      const snapshot = this.getState();
      snapshot.eventType = eventType;
      snapshot.detail = detail;
      this._listeners.slice().forEach((fn) => {
        try {
          fn(snapshot);
        } catch (e) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('GoogleAuthManager listener error:', e);
          }
        }
      });
    },

    getState() {
      return {
        status: this.status,
        isConfigured: this.isConfigured(),
        isSignedIn: Boolean(this.account && this.account.sub),
        hasValidToken: this.hasValidToken(),
        driveConnected: Boolean(this.driveConnected),
        driveScopeGranted: Boolean(this.driveScopeGranted),
        rememberMe: Boolean(this.rememberMe),
        expiresAt: this.expiresAt || 0,
        account: this.account ? { ...this.account } : null,
        lastError: this.lastError ? { ...this.lastError } : null
      };
    },

    isConfigured() {
      return Boolean(this.serverConfigured);
    },

    hasValidToken() {
      return Boolean(this.status === 'authenticated' && this.account && this.account.sub && this.driveConnected && this.driveScopeGranted);
    },

    getScopes() {
      if (typeof TradeForgeConfig !== 'undefined' && TradeForgeConfig.getGoogleScopes) {
        return TradeForgeConfig.getGoogleScopes();
      }
      return 'openid email profile https://www.googleapis.com/auth/drive.file';
    },

    getRequiredDriveScope() {
      if (typeof TradeForgeConfig !== 'undefined' && TradeForgeConfig.getRequiredDriveScope) {
        return TradeForgeConfig.getRequiredDriveScope();
      }
      return 'https://www.googleapis.com/auth/drive.file';
    },

    invalidateToken(reason = 'expired') {
      this.driveConnected = false;
      this.expiresAt = 0;
      if (this.account && this.account.sub) {
        this.status = 'expired';
      } else {
        this.status = 'signed_out';
      }
      this.lastError = reason ? { code: 'AUTH_EXPIRED', message: 'Google authorization expired. Please reconnect.' } : null;
      this._emit('auth_expired', { reason });
    },

    _loadSavedAccount() {
      const storage = _getStorage();
      if (!storage) return null;
      try {
        const raw = storage.getItem(ACCOUNT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.sub || !parsed.email) return null;
        return {
          sub: String(parsed.sub),
          email: String(parsed.email),
          name: parsed.name ? String(parsed.name) : String(parsed.email),
          picture: parsed.picture ? String(parsed.picture) : '',
          emailVerified: Boolean(parsed.emailVerified),
          connectedAt: parsed.connectedAt || null
        };
      } catch (e) {
        return null;
      }
    },

    _persistSavedAccount(profile) {
      const storage = _getStorage();
      if (!storage) return;
      try {
        if (profile && profile.sub) {
          const publicOnly = {
            sub: String(profile.sub),
            email: String(profile.email),
            name: String(profile.name || profile.email),
            picture: profile.picture ? String(profile.picture) : '',
            emailVerified: Boolean(profile.emailVerified),
            connectedAt: profile.connectedAt || new Date().toISOString()
          };
          storage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(publicOnly));
          this._upsertKnownAccountIndex(publicOnly);
        } else {
          storage.removeItem(ACCOUNT_STORAGE_KEY);
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('Could not persist public Google account metadata:', e);
        }
      }
    },

    _upsertKnownAccountIndex(profile) {
      const storage = _getStorage();
      if (!storage || !profile || !profile.sub) return [];
      try {
        const raw = storage.getItem(KNOWN_ACCOUNTS_KEY);
        const list = raw ? JSON.parse(raw) : [];
        const dedupedMap = new Map();
        if (Array.isArray(list)) {
          list.forEach((item) => {
            if (item && item.sub) dedupedMap.set(String(item.sub), item);
          });
        }
        const existing = dedupedMap.get(String(profile.sub)) || {};
        dedupedMap.set(String(profile.sub), {
          sub: String(profile.sub),
          email: String(profile.email),
          name: String(profile.name || profile.email),
          picture: profile.picture ? String(profile.picture) : '',
          firstConnectedAt: existing.firstConnectedAt || profile.connectedAt || new Date().toISOString(),
          lastConnectedAt: new Date().toISOString()
        });
        const mergedList = Array.from(dedupedMap.values());
        storage.setItem(KNOWN_ACCOUNTS_KEY, JSON.stringify(mergedList));
        return mergedList;
      } catch (e) {
        return [];
      }
    },

    getKnownAccounts() {
      const storage = _getStorage();
      if (!storage) return [];
      try {
        const raw = storage.getItem(KNOWN_ACCOUNTS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];
        const map = new Map();
        parsed.forEach((a) => {
          if (a && a.sub && !map.has(a.sub)) map.set(a.sub, a);
        });
        return Array.from(map.values());
      } catch (e) {
        return [];
      }
    },

    _buildError(code, message, rawError = null) {
      const err = new Error(message);
      err.code = code;
      err.rawError = rawError;
      return err;
    },

    /**
     * Reads `?auth=success` or `?auth_error=...` from the URL once and cleans URL query bar.
     */
    consumeCallbackParams() {
      if (typeof global.location === 'undefined' || !global.location.search) {
        return null;
      }
      const params = new URLSearchParams(global.location.search);
      const authStatus = params.get('auth');
      const authError = params.get('auth_error');
      const authErrorDesc = params.get('auth_error_desc');

      if (!authStatus && !authError) {
        return null;
      }

      params.delete('auth');
      params.delete('auth_error');
      params.delete('auth_error_desc');

      if (global.history && typeof global.history.replaceState === 'function') {
        const remaining = params.toString();
        const nextUrl = `${global.location.pathname || '/'}${remaining ? '?' + remaining : ''}${global.location.hash || ''}`;
        try {
          global.history.replaceState({}, '', nextUrl);
        } catch (e) {}
      }

      if (authError) {
        const message = authErrorDesc || AUTH_ERROR_MESSAGES[authError] || AUTH_ERROR_MESSAGES.auth_failed;
        if (this.status === 'authenticating') {
          this.status = (this.account && this.account.sub) ? (this.driveConnected ? 'authenticated' : 'expired') : 'signed_out';
        }
        this.lastError = { code: authError.toUpperCase(), message };
        this._emit('auth_error', { error: this.lastError });
        return { ok: false, errorCode: authError, message };
      }

      if (authStatus === 'success') {
        this.lastError = null;
        return { ok: true, callbackSuccess: true };
      }

      return null;
    },

    /**
     * Query server-side verified session cookie via GET /api/auth/me.
     * Never returns or exposes OAuth tokens.
     */
    async checkSession() {
      if (this._checkSessionPromise) {
        return this._checkSessionPromise;
      }

      const fetchFn = _getFetchFn();
      if (!fetchFn) {
        return this.getState();
      }

      const run = async () => {
        const endpoints = _getEndpoints();
        const url = endpoints.me || endpoints.session || '/api/auth/me';
        try {
          const res = await fetchFn(url, {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store'
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data) {
            return this.getState();
          }

          if (typeof data.configured === 'boolean') {
            this.serverConfigured = data.configured;
            if (typeof TradeForgeConfig !== 'undefined' && TradeForgeConfig.setServerOAuthConfigured) {
              TradeForgeConfig.setServerOAuthConfigured(data.configured);
            }
          }

          if (data.authenticated && data.user && data.user.sub) {
            const prevSub = this.account ? this.account.sub : null;
            const prevStatus = this.status;
            const accountRecord = {
              sub: String(data.user.sub),
              email: String(data.user.email),
              name: String(data.user.name || data.user.email),
              picture: data.user.picture ? String(data.user.picture) : '',
              emailVerified: Boolean(data.user.emailVerified),
              connectedAt: (this.account && this.account.sub === String(data.user.sub) && this.account.connectedAt)
                ? this.account.connectedAt
                : new Date().toISOString()
            };

            this.account = accountRecord;
            this.driveConnected = Boolean(data.driveConnected);
            this.driveScopeGranted = Boolean(data.driveScopeGranted);
            this.rememberMe = data.rememberMe !== undefined ? Boolean(data.rememberMe) : true;
            this.expiresAt = Number(data.expiresAt || 0);
            this.status = (data.status === 'authenticated' && this.driveConnected && this.driveScopeGranted)
              ? 'authenticated'
              : 'expired';
            if (this.status === 'authenticated') {
              this.lastError = null;
            }
            this._persistSavedAccount(accountRecord);

            const switchedAccount = Boolean(prevSub && prevSub !== accountRecord.sub);
            if (this.status === 'authenticated' && (prevStatus !== 'authenticated' || switchedAccount)) {
              this._emit('signed_in', { account: { ...accountRecord }, switchedAccount, rememberMe: this.rememberMe });
            } else if (this.status === 'expired' && prevStatus !== 'expired') {
              this._emit('auth_expired', { reason: 'server_expired' });
            } else {
              this._emit('session_checked', { state: this.getState() });
            }
            return this.getState();
          }

          // Server reports not authenticated (signed out or refresh token revoked)
          const wasSignedIn = Boolean(this.account && this.account.sub);
          if (data.status === 'expired' && data.expiredUser && data.expiredUser.sub) {
            this.account = {
              sub: String(data.expiredUser.sub),
              email: String(data.expiredUser.email || ''),
              name: String(data.expiredUser.name || data.expiredUser.email || ''),
              picture: data.expiredUser.picture ? String(data.expiredUser.picture) : '',
              emailVerified: Boolean(data.expiredUser.emailVerified),
              connectedAt: this.account ? this.account.connectedAt : null
            };
            this.status = 'expired';
            this.driveConnected = false;
            this.driveScopeGranted = false;
            this.expiresAt = 0;
            this._persistSavedAccount(this.account);
            this._emit('auth_expired', { reason: 'refresh_revoked' });
            return this.getState();
          }

          this.account = null;
          this.status = 'signed_out';
          this.driveConnected = false;
          this.driveScopeGranted = false;
          this.expiresAt = 0;
          this._persistSavedAccount(null);
          if (wasSignedIn) {
            this._emit('signed_out', { reason: 'server_unauthenticated' });
          } else {
            this._emit('session_checked', { state: this.getState() });
          }
          return this.getState();
        } catch (err) {
          // Offline / server unreachable: preserve cached public metadata cleanly without signing out
          return this.getState();
        } finally {
          this._checkSessionPromise = null;
        }
      };

      this._checkSessionPromise = run();
      return this._checkSessionPromise;
    },

    _buildOAuthUrl(basePath, params = {}) {
      const sp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          sp.set(k, String(v));
        }
      });
      const qs = sp.toString();
      return qs ? `${basePath}?${qs}` : basePath;
    },

    _navigateToUrl(url) {
      if (typeof this._customNavigate === 'function') {
        return this._customNavigate(url);
      }
      if (typeof global.location !== 'undefined' && typeof global.location.assign === 'function') {
        global.location.assign(url);
        return true;
      }
      if (typeof global.location !== 'undefined') {
        global.location.href = url;
        return true;
      }
      return false;
    },

    async _startPopupOAuth(url) {
      if (typeof global.open !== 'function' || typeof global.addEventListener !== 'function') {
        this._navigateToUrl(url);
        return { redirected: true, url };
      }

      const w = 520;
      const h = 640;
      const left = typeof global.screenX === 'number' ? Math.max(0, global.screenX + ((global.outerWidth || 1000) - w) / 2) : 100;
      const top = typeof global.screenY === 'number' ? Math.max(0, global.screenY + ((global.outerHeight || 700) - h) / 2) : 80;
      const popup = global.open(url, 'tradeforge_google_oauth', `width=${w},height=${h},left=${left},top=${top},popup=yes`);

      if (!popup) {
        this._navigateToUrl(url);
        return { redirected: true, url };
      }

      this.status = 'authenticating';
      this._emit('authenticating', { flow: 'popup' });

      return new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
          clearInterval(pollClosed);
          clearTimeout(timeoutId);
          global.removeEventListener('message', onMessage);
        };

        const timeoutId = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          this.status = this.account ? (this.hasValidToken() ? 'authenticated' : 'expired') : 'signed_out';
          reject(this._buildError('AUTH_TIMEOUT', 'Google sign-in timed out before completing.'));
        }, 120000);

        const pollClosed = setInterval(() => {
          if (popup.closed && !settled) {
            settled = true;
            cleanup();
            this.checkSession().then((st) => {
              if (st.hasValidToken) {
                resolve({ account: st.account, expiresAt: st.expiresAt });
              } else {
                reject(this._buildError('POPUP_CLOSED', 'Google sign-in window was closed before completing.'));
              }
            });
          }
        }, 450);

        const onMessage = async (event) => {
          if (event.origin !== global.location.origin) return;
          const payload = event.data;
          if (!payload || payload.type !== 'tradeforge_oauth_result' || settled) return;
          settled = true;
          cleanup();
          if (!payload.ok) {
            const code = String(payload.errorCode || 'auth_failed').toUpperCase();
            const msg = payload.errorMessage || AUTH_ERROR_MESSAGES[payload.errorCode] || 'Google sign-in did not complete.';
            this.status = this.account ? (this.hasValidToken() ? 'authenticated' : 'expired') : 'signed_out';
            const err = this._buildError(code, msg);
            this.lastError = { code: err.code, message: err.message };
            this._emit('auth_error', { error: this.lastError });
            reject(err);
            return;
          }
          const st = await this.checkSession();
          resolve({ account: st.account, expiresAt: st.expiresAt });
        };

        global.addEventListener('message', onMessage);
      });
    },

    /**
     * Initiate Google Sign-In via server OAuth Authorization Code Flow (/api/auth/google)
     */
    async signIn(options = {}) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const err = this._buildError('OFFLINE', 'Cannot sign in with Google while offline.');
        this.lastError = { code: err.code, message: err.message };
        this._emit('auth_error', { error: this.lastError });
        throw err;
      }

      if (!this.serverConfigured) {
        const err = this._buildError('SERVER_NOT_CONFIGURED', AUTH_ERROR_MESSAGES.server_not_configured);
        this.lastError = { code: err.code, message: err.message };
        this._emit('auth_error', { error: this.lastError });
        throw err;
      }

      const endpoints = _getEndpoints();
      const basePath = endpoints.googleStart || '/api/auth/google';
      const selectAccount = options.selectAccount !== false;
      const rememberMe = options.rememberMe !== undefined ? Boolean(options.rememberMe) : true;
      const mode = options.mode === 'popup' ? 'popup' : 'redirect';

      const oauthUrl = this._buildOAuthUrl(basePath, {
        mode,
        prompt: selectAccount ? 'select_account' : '',
        remember: rememberMe ? '1' : '0',
        returnTo: options.returnTo || '/'
      });

      this.status = 'authenticating';
      this.lastError = null;
      this._emit('authenticating', { flow: 'signin', mode });

      if (mode === 'popup') {
        return this._startPopupOAuth(oauthUrl);
      }

      this._navigateToUrl(oauthUrl);
      return { redirected: true, url: oauthUrl };
    },

    /**
     * Reconnect Google Drive consent / expired session via /api/drive/authorize
     */
    async reconnect(options = {}) {
      return this.authorizeDrive(options);
    },

    async authorizeDrive(options = {}) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const err = this._buildError('OFFLINE', 'Cannot connect Google Drive while offline.');
        this.lastError = { code: err.code, message: err.message };
        this._emit('auth_error', { error: this.lastError });
        throw err;
      }

      if (!this.serverConfigured) {
        const err = this._buildError('SERVER_NOT_CONFIGURED', AUTH_ERROR_MESSAGES.server_not_configured);
        this.lastError = { code: err.code, message: err.message };
        this._emit('auth_error', { error: this.lastError });
        throw err;
      }

      const driveEndpoints = _getDriveEndpoints();
      const basePath = driveEndpoints.authorize || '/api/drive/authorize';
      const mode = options.mode === 'popup' ? 'popup' : 'redirect';
      const switchAccount = Boolean(options.selectAccount);
      const rememberMe = options.rememberMe !== undefined ? Boolean(options.rememberMe) : true;

      const oauthUrl = this._buildOAuthUrl(basePath, {
        mode,
        switch: switchAccount ? '1' : '0',
        remember: rememberMe ? '1' : '0',
        returnTo: options.returnTo || '/'
      });

      this.status = 'authenticating';
      this.lastError = null;
      this._emit('authenticating', { flow: 'drive_authorize', mode });

      if (mode === 'popup') {
        return this._startPopupOAuth(oauthUrl);
      }

      this._navigateToUrl(oauthUrl);
      return { redirected: true, url: oauthUrl };
    },

    /**
     * Sign out from TradeForge on both server (revokes Google token + clears HttpOnly cookies) and client cache.
     */
    async signOut() {
      const fetchFn = _getFetchFn();
      const endpoints = _getEndpoints();
      const logoutUrl = endpoints.logout || '/api/auth/logout';

      if (fetchFn) {
        try {
          await fetchFn(logoutUrl, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
          });
        } catch (e) {
          // Offline sign-out still resets local session cleanly
        }
      }

      const previousAccount = this.account ? { ...this.account } : null;
      this.account = null;
      this.status = 'signed_out';
      this.driveConnected = false;
      this.driveScopeGranted = false;
      this.rememberMe = true;
      this.expiresAt = 0;
      this.lastError = null;
      this._persistSavedAccount(null);
      this._emit('signed_out', { previousAccount });
      return true;
    }
  };

  global.GoogleAuthManager = GoogleAuthManager;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleAuthManager;
  }
})(typeof window !== 'undefined' ? window : globalThis);
