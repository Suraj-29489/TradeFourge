/**
 * TradeForge - Shared Gemini API Usage Server-Side Store
 * Handles persistent tracking of real Gemini API tokens across projects.
 */

const fs = require('fs');
const path = require('path');

function getPrimaryStorePath() {
  const cwd = (typeof process !== 'undefined' && typeof process.cwd === 'function') ? process.cwd() : '.';
  return path.resolve(cwd, 'data', 'usage.json');
}

function getFallbackStorePath() {
  return path.resolve('/tmp', 'tradefourge_usage.json');
}

function getDefaultStore() {
  return {
    activeProject: 'PRIMARY',
    updatedAt: new Date().toISOString(),
    projects: {
      PRIMARY: { usedTokens: 0, limitTokens: 1000000, inputTokens: 0, outputTokens: 0, updatedAt: null },
      BACKUP_1: { usedTokens: 0, limitTokens: 1000000, inputTokens: 0, outputTokens: 0, updatedAt: null },
      BACKUP_2: { usedTokens: 0, limitTokens: 1000000, inputTokens: 0, outputTokens: 0, updatedAt: null },
      BACKUP_3: { usedTokens: 0, limitTokens: 1000000, inputTokens: 0, outputTokens: 0, updatedAt: null },
      BACKUP_4: { usedTokens: 0, limitTokens: 1000000, inputTokens: 0, outputTokens: 0, updatedAt: null }
    }
  };
}

function loadStore() {
  const primaryPath = getPrimaryStorePath();
  const fallbackPath = getFallbackStorePath();

  let data = null;

  try {
    if (fs.existsSync(primaryPath)) {
      data = fs.readFileSync(primaryPath, 'utf8');
    } else if (fs.existsSync(fallbackPath)) {
      data = fs.readFileSync(fallbackPath, 'utf8');
    }
  } catch (e) {
    try {
      if (fs.existsSync(fallbackPath)) {
        data = fs.readFileSync(fallbackPath, 'utf8');
      }
    } catch (e2) {}
  }

  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === 'object' && parsed.projects) {
        const defaultStore = getDefaultStore();
        return {
          activeProject: parsed.activeProject || 'PRIMARY',
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          projects: { ...defaultStore.projects, ...parsed.projects }
        };
      }
    } catch (err) {}
  }

  return getDefaultStore();
}

function saveStore(store) {
  const jsonStr = JSON.stringify(store, null, 2);
  const primaryPath = getPrimaryStorePath();
  const fallbackPath = getFallbackStorePath();

  // Try saving to data/usage.json first
  let saved = false;
  try {
    const dir = path.dirname(primaryPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(primaryPath, jsonStr, 'utf8');
    saved = true;
  } catch (e) {
    // Filesystem may be read-only in serverless environment
  }

  // Always sync to /tmp fallback as well
  try {
    fs.writeFileSync(fallbackPath, jsonStr, 'utf8');
    saved = true;
  } catch (e) {}

  return saved;
}

function extractTokens(usageObj) {
  if (!usageObj || typeof usageObj !== 'object') return null;

  const input = Number(
    usageObj.input_tokens ??
    usageObj.total_input_tokens ??
    usageObj.promptTokenCount ??
    usageObj.prompt_tokens ??
    usageObj.inputTokens ??
    0
  );

  const output = Number(
    usageObj.output_tokens ??
    usageObj.total_output_tokens ??
    usageObj.candidatesTokenCount ??
    usageObj.candidates_tokens ??
    usageObj.outputTokens ??
    0
  );

  const total = Number(
    usageObj.total_tokens ??
    usageObj.totalTokenCount ??
    usageObj.totalTokens ??
    (input + output)
  );

  if (isNaN(input) || isNaN(output) || isNaN(total)) return null;
  if (input === 0 && output === 0 && total === 0) return null;

  return { input, output, total };
}

function recordGeminiUsage(slotName, usageObj) {
  const tokens = extractTokens(usageObj);
  if (!tokens || tokens.total <= 0) {
    return false; // Do not record if no valid tokens returned
  }

  const store = loadStore();
  const key = (slotName || 'PRIMARY').toUpperCase();

  if (!store.projects[key]) {
    store.projects[key] = { usedTokens: 0, limitTokens: 1000000, inputTokens: 0, outputTokens: 0, updatedAt: null };
  }

  const proj = store.projects[key];
  proj.inputTokens = (proj.inputTokens || 0) + tokens.input;
  proj.outputTokens = (proj.outputTokens || 0) + tokens.output;
  proj.usedTokens = (proj.usedTokens || 0) + tokens.total;
  proj.updatedAt = new Date().toISOString();

  store.activeProject = key;
  store.updatedAt = proj.updatedAt;

  saveStore(store);
  return true;
}

function getGeminiUsage() {
  const store = loadStore();
  const activeKey = (store.activeProject || 'PRIMARY').toUpperCase();
  const proj = store.projects[activeKey] || {
    usedTokens: 0,
    limitTokens: 1000000,
    inputTokens: 0,
    outputTokens: 0,
    updatedAt: null
  };

  const slotMap = { PRIMARY: 0, BACKUP_1: 1, BACKUP_2: 2, BACKUP_3: 3, BACKUP_4: 4 };

  return {
    project: activeKey,
    usedTokens: proj.usedTokens || 0,
    limitTokens: proj.limitTokens || 1000000,
    inputTokens: proj.inputTokens || 0,
    outputTokens: proj.outputTokens || 0,
    updatedAt: proj.updatedAt || store.updatedAt,
    activeSlot: slotMap[activeKey] ?? 0
  };
}

module.exports = {
  loadStore,
  saveStore,
  recordGeminiUsage,
  getGeminiUsage
};

