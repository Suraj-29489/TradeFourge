/**
 * TradeForge - Fourge AI Server-Side Gemini Router & Failover Proxy
 *
 * Secure serverless endpoint for Google Gemini Interactions API (gemini-3.8-flash).
 * Supports up to 5 separately configured Gemini API projects with automatic failover:
 * - Primary: GEMINI_API_KEY_PRIMARY (or fallback GEMINI_API_KEY) & optional GEMINI_PROJECT_PRIMARY
 * - Backup 1: GEMINI_API_KEY_BACKUP_1 & optional GEMINI_PROJECT_BACKUP_1
 * - Backup 2: GEMINI_API_KEY_BACKUP_2 & optional GEMINI_PROJECT_BACKUP_2
 * - Backup 3: GEMINI_API_KEY_BACKUP_3 & optional GEMINI_PROJECT_BACKUP_3
 * - Backup 4: GEMINI_API_KEY_BACKUP_4 & optional GEMINI_PROJECT_BACKUP_4
 *
 * Credentials strictly remain on the server and are NEVER sent or exposed to clients.
 */

const fs = require('fs');
const path = require('path');

// Lightweight local .env.local loader for development environments
function loadLocalEnv() {
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
            if (key.startsWith('GEMINI_') && val && !val.includes('YOUR_GEMINI_API_KEY') && !process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      }
    } catch (e) {
      // Ignore filesystem read errors in constrained serverless environments
    }
  }
}

// Retrieve configured Gemini project slots in priority order
function getConfiguredProjects() {
  const slots = [
    {
      slot: 0,
      name: 'PRIMARY',
      key: process.env.GEMINI_API_KEY_PRIMARY || process.env.GEMINI_API_KEY,
      project: process.env.GEMINI_PROJECT_PRIMARY || 'Primary Project'
    },
    {
      slot: 1,
      name: 'BACKUP_1',
      key: process.env.GEMINI_API_KEY_BACKUP_1,
      project: process.env.GEMINI_PROJECT_BACKUP_1 || 'Backup Project 1'
    },
    {
      slot: 2,
      name: 'BACKUP_2',
      key: process.env.GEMINI_API_KEY_BACKUP_2,
      project: process.env.GEMINI_PROJECT_BACKUP_2 || 'Backup Project 2'
    },
    {
      slot: 3,
      name: 'BACKUP_3',
      key: process.env.GEMINI_API_KEY_BACKUP_3,
      project: process.env.GEMINI_PROJECT_BACKUP_3 || 'Backup Project 3'
    },
    {
      slot: 4,
      name: 'BACKUP_4',
      key: process.env.GEMINI_API_KEY_BACKUP_4,
      project: process.env.GEMINI_PROJECT_BACKUP_4 || 'Backup Project 4'
    }
  ];

  return slots.filter(s => s.key && typeof s.key === 'string' && s.key.trim() && s.key !== 'YOUR_GEMINI_API_KEY');
}

// Extract output text from Gemini Interactions API or GenerateContent response formats
function extractOutputText(data) {
  if (!data) return '';
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }
  if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      if (step && step.type === 'model_output' && Array.isArray(step.content)) {
        for (const item of step.content) {
          if (item && (item.type === 'text' || typeof item.text === 'string') && item.text) {
            return item.text.trim();
          }
        }
      } else if (step && Array.isArray(step.content)) {
        for (const item of step.content) {
          if (item && item.text) return item.text.trim();
        }
      }
    }
  }
  if (Array.isArray(data.candidates) && data.candidates[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text.trim();
  }
  return '';
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

// Helper to make an upstream Interactions API call
async function callGeminiEndpoint(apiKey, input, previousInteractionId) {
  const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  const geminiPayload = {
    model: 'gemini-3.8-flash',
    input: input.trim()
  };

  if (previousInteractionId && typeof previousInteractionId === 'string' && previousInteractionId.trim()) {
    geminiPayload.previous_interaction_id = previousInteractionId.trim();
  }

  const response = await fetch(geminiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey.trim()
    },
    body: JSON.stringify(geminiPayload)
  });

  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
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

  // 4. Get configured Gemini project slots
  const projects = getConfiguredProjects();
  if (projects.length === 0) {
    return res.status(500).json({
      error: {
        message: 'GEMINI_API_KEY_PRIMARY (or GEMINI_API_KEY) is not configured on the server. Please configure it in your Vercel/hosting environment variables.',
        status: 500
      }
    });
  }

  let lastError = null;
  let lastStatus = 500;

  // 5. Multi-Project Failover Router Loop
  // Primary (index 0) is always attempted first (Primary Recovery).
  // If Primary fails with retryable error (429, 5xx), seamlessly failover to Backup 1..4.
  for (let i = 0; i < projects.length; i++) {
    const currentProj = projects[i];

    try {
      let result = await callGeminiEndpoint(currentProj.key, input, previous_interaction_id);

      // Safe cross-project / invalid interaction ID handling:
      // If a stateful request returns 400 or 404 (invalid interaction ID), retry ONCE statelessly on this project
      if (!result.ok && previous_interaction_id && (result.status === 400 || result.status === 404)) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[FourgeAI Router] Interaction ID rejected by ${currentProj.name} (${result.status}). Retrying statelessly...`);
        }
        result = await callGeminiEndpoint(currentProj.key, input, null);
      }

      if (result.ok && result.data) {
        const text = extractOutputText(result.data);
        if (text) {
          // Success! Return sanitized output + usage telemetry
          return res.status(200).json({
            id: result.data.id || null,
            output_text: text,
            usage: result.data.usage || null
          });
        }
      }

      // Record error
      lastStatus = result.status;
      if (result.data && result.data.error && result.data.error.message) {
        lastError = result.data.error.message;
      } else {
        lastError = `Google Gemini service returned status ${result.status}`;
      }

      // Check if we should failover to next project
      const isRetryable = [429, 500, 502, 503, 504].includes(result.status);
      const hasNext = i < projects.length - 1;

      if (hasNext) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[FourgeAI Router] ${currentProj.name} returned status ${result.status}. Failing over to ${projects[i + 1].name}...`);
        }
        continue; // Try next backup project
      }
    } catch (netErr) {
      lastStatus = 502;
      lastError = netErr.message || 'Network error communicating with Google AI service.';
      const hasNext = i < projects.length - 1;

      if (hasNext) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[FourgeAI Router] ${currentProj.name} network exception. Failing over to ${projects[i + 1].name}...`);
        }
        continue;
      }
    }
  }

  // 6. If all configured projects failed, return sanitized error
  return res.status(lastStatus || 500).json({
    error: {
      message: sanitizeError(lastError || 'All configured Gemini AI projects failed to process request.'),
      status: lastStatus || 500
    }
  });
};
