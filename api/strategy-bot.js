/**
 * TradeForge - Fourge AI Server-Side Gemini Proxy
 *
 * Secure serverless endpoint for Google Gemini Interactions API (gemini-3.8-flash).
 * Reads GEMINI_API_KEY strictly from server environment variables.
 * Never exposes credentials to client browsers.
 */

const fs = require('fs');
const path = require('path');

// Lightweight local .env.local loader for development environments
function loadLocalEnv() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY') {
    return;
  }
    const cwd = (typeof process !== 'undefined' && typeof process.cwd === 'function') ? process.cwd() : '.';
    const baseDir = (typeof __dirname !== 'undefined') ? __dirname : '.';
    const candidates = [
      path.resolve(cwd, '.env.local'),
      path.resolve(baseDir, '../.env.local'),
      path.resolve(baseDir, '.env.local')
    ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (key === 'GEMINI_API_KEY' && val && val !== 'YOUR_GEMINI_API_KEY' && !process.env.GEMINI_API_KEY) {
              process.env.GEMINI_API_KEY = val;
            }
          }
        }
        if (process.env.GEMINI_API_KEY) break;
      }
    } catch (e) {
      // Ignore filesystem read errors in constrained environments
    }
  }
}

// Sanitize messages so no API keys, credentials, or internal patterns leak
function sanitizeError(msg) {
  if (!msg || typeof msg !== 'string') return 'An error occurred during AI processing.';
  return msg
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED]')
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]')
    .replace(/x-goog-api-key:[^\n\r]+/gi, 'x-goog-api-key: [REDACTED]')
    .replace(/bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]');
}

module.exports = async function handler(req, res) {
  loadLocalEnv();

  // Set response headers
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  // 1. Validate HTTP Method
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: {
        message: 'Method not allowed. Only POST is supported.',
        status: 405
      }
    });
  }

  // 2. Parse request body
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (err) {
      return res.status(400).json({
        error: {
          message: 'Invalid JSON payload in request body.',
          status: 400
        }
      });
    }
  }

  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      error: {
        message: 'Request body must be a valid JSON object.',
        status: 400
      }
    });
  }

  const { input, previous_interaction_id } = body;

  // 3. Validate input field
  if (typeof input !== 'string' || !input.trim()) {
    return res.status(400).json({
      error: {
        message: 'Field "input" is required and must be a non-empty string.',
        status: 400
      }
    });
  }

  if (input.length > 50000) {
    return res.status(400).json({
      error: {
        message: 'Field "input" exceeds maximum allowed length of 50,000 characters.',
        status: 400
      }
    });
  }

  if (previous_interaction_id !== undefined && previous_interaction_id !== null && typeof previous_interaction_id !== 'string') {
    return res.status(400).json({
      error: {
        message: 'Field "previous_interaction_id" must be a string if provided.',
        status: 400
      }
    });
  }

  // 4. Verify Server-Side API Key from process.env
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || !apiKey.trim()) {
    return res.status(500).json({
      error: {
        message: 'GEMINI_API_KEY is not configured on the server. Please configure it in your Vercel/hosting environment variables.',
        status: 500
      }
    });
  }

  // 5. Construct upstream Google Gemini Interactions request
  const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  const geminiPayload = {
    model: 'gemini-3.8-flash',
    input: input.trim()
  };

  if (previous_interaction_id && previous_interaction_id.trim()) {
    geminiPayload.previous_interaction_id = previous_interaction_id.trim();
  }

  // 6. Execute request to Google Gemini API
  try {
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim()
      },
      body: JSON.stringify(geminiPayload)
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      let errorMsg = 'Google Gemini service error.';
      if (data && data.error && data.error.message) {
        errorMsg = data.error.message;
      } else if (data && typeof data === 'string') {
        errorMsg = data;
      }
      return res.status(response.status).json({
        error: {
          message: sanitizeError(errorMsg),
          status: response.status
        }
      });
    }

    // 7. Return sanitized response to client
    return res.status(200).json({
      id: data.id || null,
      output_text: data.output_text || ''
    });
  } catch (err) {
    return res.status(502).json({
      error: {
        message: sanitizeError(err.message || 'Failed to communicate with Google AI service.'),
        status: 502
      }
    });
  }
};
