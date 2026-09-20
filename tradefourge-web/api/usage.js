/**
 * TradeForge - Shared Gemini API Usage Endpoint
 * GET /api/usage
 * Returns the current server-side aggregated Gemini API usage for the active project.
 */

const { getGeminiUsage } = require('./usage-store');

module.exports = async function handler(req, res) {
  // Set headers
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: {
        message: 'Method not allowed. Only GET is supported.',
        status: 405
      }
    });
  }

  try {
    const usage = getGeminiUsage();
    return res.status(200).json(usage);
  } catch (err) {
    return res.status(500).json({
      error: {
        message: 'Failed to retrieve Gemini API usage metrics.',
        status: 500
      }
    });
  }
};

