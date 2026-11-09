/**
 * TradeForge Auth - Verified Current User Info Endpoint
 * GET /api/auth/me
 * Alias of /api/auth/session returning only non-secret verified Google user metadata.
 */

module.exports = require('./session');
