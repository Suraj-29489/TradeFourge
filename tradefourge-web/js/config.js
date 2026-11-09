/**
 * TradeForge Runtime Configuration Resolver
 * Resolves public backend auth & Google Drive endpoint paths without any secrets or client-side tokens.
 */

(function (global) {
  'use strict';

  const DEFAULTS = {
    GOOGLE_PROJECT_NAME: 'TradeForge Authentication',
    GOOGLE_PROJECT_ID: 'tradefourge-authentication',
    GOOGLE_OAUTH_CLIENT_NAME: 'TradeForge Web Client',
    GOOGLE_SCOPES: 'openid email profile https://www.googleapis.com/auth/drive.file',
    GOOGLE_DRIVE_REQUIRED_SCOPE: 'https://www.googleapis.com/auth/drive.file',
    SCHEMA_VERSION: '1.0.0',
    AUTH_ENDPOINTS: {
      googleStart: '/api/auth/google',
      callback: '/api/auth/callback',
      session: '/api/auth/session',
      me: '/api/auth/me',
      logout: '/api/auth/logout',
      login: '/api/auth/login',
      register: '/api/auth/register',
      forgotPassword: '/api/auth/forgot-password'
    },
    DRIVE_ENDPOINTS: {
      authorize: '/api/drive/authorize',
      status: '/api/drive/status',
      folder: '/api/drive/folder',
      sync: '/api/drive/sync',
      backups: '/api/drive/backups'
    }
  };

  let _serverOAuthConfigured = true;

  function getAuthConfig() {
    const localCfg = global.TRADEFORGE_LOCAL_CONFIG || {};
    const appCfg = global.TRADEFORGE_CONFIG || {};
    const baseUrl = String(localCfg.AUTH_API_BASE || appCfg.AUTH_API_BASE || '').trim().replace(/\/+$/, '');
    const explicitlyEnabled = Boolean(localCfg.AUTH_API_ENABLED || appCfg.AUTH_API_ENABLED || baseUrl);
    return {
      enabled: explicitlyEnabled,
      baseUrl,
      endpoints: Object.assign({}, DEFAULTS.AUTH_ENDPOINTS, appCfg.AUTH_ENDPOINTS || {}, localCfg.AUTH_ENDPOINTS || {})
    };
  }

  function getDriveEndpoints() {
    const localCfg = global.TRADEFORGE_LOCAL_CONFIG || {};
    const appCfg = global.TRADEFORGE_CONFIG || {};
    return Object.assign({}, DEFAULTS.DRIVE_ENDPOINTS, appCfg.DRIVE_ENDPOINTS || {}, localCfg.DRIVE_ENDPOINTS || {});
  }

  function isPasswordAuthBackendConfigured() {
    return Boolean(getAuthConfig().enabled);
  }

  function setServerOAuthConfigured(val) {
    _serverOAuthConfigured = Boolean(val);
    return _serverOAuthConfigured;
  }

  function isGoogleAuthConfigured() {
    return Boolean(_serverOAuthConfigured);
  }

  const TradeForgeConfig = {
    DEFAULTS,
    getAuthConfig,
    getDriveEndpoints,
    isPasswordAuthBackendConfigured,
    setServerOAuthConfigured,
    isGoogleAuthConfigured,
    // Keep lightweight compatibility shims returning empty strings so zero client secrets/IDs are stored in browser storage
    getGoogleClientId() {
      return '';
    },
    setGoogleClientId() {
      return '';
    },
    getGoogleScopes() {
      return DEFAULTS.GOOGLE_SCOPES;
    },
    getRequiredDriveScope() {
      return DEFAULTS.GOOGLE_DRIVE_REQUIRED_SCOPE;
    },
    getProjectInfo() {
      return {
        projectName: DEFAULTS.GOOGLE_PROJECT_NAME,
        projectId: DEFAULTS.GOOGLE_PROJECT_ID,
        clientName: DEFAULTS.GOOGLE_OAUTH_CLIENT_NAME,
        configuredOrigin: typeof global.location !== 'undefined' && global.location.origin
          ? global.location.origin
          : 'http://localhost:3000'
      };
    }
  };

  global.TradeForgeConfig = TradeForgeConfig;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TradeForgeConfig;
  }
})(typeof window !== 'undefined' ? window : globalThis);
