/**
 * TradeForge - Strategy Bot (AI Trading Co-pilot & Data Analyst)
 * Powered by Google AI Studio (Gemini 3.8 Flash - Interactions API) & Local Quantitative Engine
 */

const StrategyBotManager = {
  STORAGE_KEYS: {
    CHAT_HISTORY: 'tradeforge_bot_chat_history',
    AI_MODE: 'fourge_ai_mode',
    GEMINI_API_KEY: 'fourge_gemini_api_key',
    TOKEN_USAGE: 'fourge_ai_token_usage',
    SELECTED_MODEL: 'fourge_ai_selected_model'
  },

  DEFAULT_KEY: '',
  MAX_CONTEXT_TOKENS: 1000000,

  // In-memory conversation state
  messages: [],
  isGenerating: false,
  metricsCache: null,
  lastInteractionId: null,
  offlineContext: {},
  aiMode: 'online', // 'online' | 'offline'
  selectedModel: 'gemini-3.7-flash', // 'gemini-3.7-flash' | 'gemini-3.8-flash' | 'gemini-3.6-flash' | 'gemini-3.5-flash'

  tokenUsage: {
    promptTokens: 0,
    outputTokens: 0,
    thoughtTokens: 0,
    lastTurnTokens: 0,
    sessionTokens: 0,
    activeContextTokens: 0
  },

  serverUsage: {
    project: 'PRIMARY',
    usedTokens: 0,
    limitTokens: 1000000,
    inputTokens: 0,
    outputTokens: 0,
    updatedAt: null,
    activeSlot: 0
  },
  usagePollTimer: null,

  /**
   * Helper to extract output text from Gemini Interactions API or Server response
   */
  extractOutputText(data) {
    if (!data) return '';
    if (typeof data.output_text === 'string' && data.output_text.trim()) {
      return data.output_text.trim();
    }
    if (typeof data.text === 'string' && data.text.trim()) {
      return data.text.trim();
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
  },

  /**
   * Initialize Strategy Bot
   */
  init() {
    this.loadAiMode();
    this.loadSelectedModel();
    this.loadCachedUsage();
    this.bindEvents();
    this.updateModeUI();
    this.fetchServerUsage();
    this.updateTokenGauge();
    this.updateContext();
    this.loadChatHistory();

    if (!this.usagePollTimer && typeof window !== 'undefined') {
      this.usagePollTimer = setInterval(() => this.fetchServerUsage(), 20000);
    }
  },

  /**
   * Load cached server usage from localStorage
   */
  loadCachedUsage() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEYS.TOKEN_USAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.serverUsage = { ...this.serverUsage, ...parsed };
        }
      }
    } catch (e) {}
  },

  /**
   * Save cached usage to localStorage
   */
  saveCachedUsage() {
    try {
      localStorage.setItem(this.STORAGE_KEYS.TOKEN_USAGE, JSON.stringify(this.serverUsage));
    } catch (e) {}
  },

  /**
   * Record real-time token telemetry from Gemini API response
   */
  recordDirectTokenUsage(usage, estTextLen) {
    if (usage && typeof usage === 'object') {
      const prompt = Number(usage.total_input_tokens || usage.promptTokenCount || usage.prompt_tokens || usage.input_tokens || 0);
      const output = Number(usage.total_output_tokens || usage.candidatesTokenCount || usage.candidates_tokens || usage.output_tokens || 0);
      const thought = Number(usage.total_thought_tokens || usage.thoughtsTokenCount || 0);
      const total = Number(usage.total_tokens || usage.totalTokenCount || (prompt + output + thought));

      this.serverUsage.inputTokens = (Number(this.serverUsage.inputTokens) || 0) + prompt;
      this.serverUsage.outputTokens = (Number(this.serverUsage.outputTokens) || 0) + output;
      this.serverUsage.usedTokens = (Number(this.serverUsage.usedTokens) || 0) + total;
      this.serverUsage.lastTurnTokens = total;
    } else if (estTextLen) {
      const est = Math.max(1, Math.round(estTextLen / 4));
      this.serverUsage.inputTokens = (Number(this.serverUsage.inputTokens) || 0) + Math.round(est * 0.7);
      this.serverUsage.outputTokens = (Number(this.serverUsage.outputTokens) || 0) + Math.round(est * 0.3);
      this.serverUsage.usedTokens = (Number(this.serverUsage.usedTokens) || 0) + est;
      this.serverUsage.lastTurnTokens = est;
    }

    this.serverUsage.updatedAt = new Date().toISOString();
    this.saveCachedUsage();
    this.updateTokenGauge();
  },

  /**
   * Fetch real shared Gemini API usage telemetry from server endpoint GET /api/usage
   */
  async fetchServerUsage() {
    try {
      const isFileProtocol = (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:');
      if (isFileProtocol) return;

      const res = await fetch('/api/usage', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.usedTokens === 'number') {
          this.serverUsage = {
            project: data.project || 'PRIMARY',
            usedTokens: Math.max(Number(data.usedTokens) || 0, Number(this.serverUsage.usedTokens) || 0),
            limitTokens: Number(data.limitTokens) || 1000000,
            inputTokens: Math.max(Number(data.inputTokens) || 0, Number(this.serverUsage.inputTokens) || 0),
            outputTokens: Math.max(Number(data.outputTokens) || 0, Number(this.serverUsage.outputTokens) || 0),
            updatedAt: data.updatedAt || this.serverUsage.updatedAt || null,
            activeSlot: typeof data.activeSlot === 'number' ? data.activeSlot : 0,
            lastTurnTokens: this.serverUsage.lastTurnTokens || 0
          };
          this.saveCachedUsage();
          this.updateTokenGauge();
        }
      }
    } catch (e) {
      // Ignore network errors in local/offline modes
    }
  },

  /**
   * Update real shared Gemini API usage gauge in Fourge AI header
   */
  updateTokenGauge() {
    const gauge = document.getElementById('botTokenGauge');
    const valEl = document.getElementById('tokenUsageVal');
    const pctEl = document.getElementById('tokenUsagePct');
    const barEl = document.getElementById('tokenUsageBar');
    const sessionEl = document.getElementById('tokenSessionVal');

    if (!gauge) return;

    if (this.aiMode === 'offline') {
      if (pctEl) pctEl.innerText = '0.0%';
      if (barEl) barEl.style.width = '0%';
      if (valEl) valEl.innerHTML = '<strong>0</strong> / 1.0M <span class="token-sub">tok (Local)</span>';
      if (sessionEl) sessionEl.innerText = 'Local Engine';
      gauge.setAttribute('title', 'Offline Mode active. Local Engine does not consume API tokens.');
      return;
    }

    const used = Number(this.serverUsage.usedTokens) || 0;
    const limit = Number(this.serverUsage.limitTokens) || 1000000;
    const lastTurn = Number(this.serverUsage.lastTurnTokens) || 0;
    const project = (this.serverUsage.project || 'PRIMARY').replace('_', ' ');
    const input = Number(this.serverUsage.inputTokens) || 0;
    const output = Number(this.serverUsage.outputTokens) || 0;

    const pct = Math.min(100, Math.max(0, (used / limit) * 100));
    const pctFormatted = pct < 0.01 && used > 0 ? '<0.01%' : `${pct.toFixed(2)}%`;

    const formatNum = (n) => {
      if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
      if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
      return String(n);
    };

    if (valEl) {
      valEl.innerHTML = `<strong>${formatNum(used)}</strong> / ${formatNum(limit)} <span class="token-sub">tok</span>`;
    }
    if (pctEl) {
      pctEl.innerText = pctFormatted;
    }
    if (barEl) {
      barEl.style.width = `${Math.max(used > 0 ? 2 : 0, Math.min(100, pct))}%`;
      if (pct > 80) {
        barEl.className = 'token-gauge-bar danger';
      } else if (pct > 50) {
        barEl.className = 'token-gauge-bar warning';
      } else {
        barEl.className = 'token-gauge-bar';
      }
    }
    if (sessionEl) {
      if (lastTurn > 0) {
        sessionEl.innerText = `+${formatNum(lastTurn)} tok | ${project}`;
      } else {
        sessionEl.innerText = `Project: ${project}`;
      }
    }

    gauge.setAttribute(
      'title',
      `Active Gemini Project: ${project}\nReal Usage: ${used.toLocaleString()} / ${limit.toLocaleString()} tokens (${pctFormatted})\nInput: ${input.toLocaleString()} | Output: ${output.toLocaleString()}${lastTurn > 0 ? `\nLast Turn: +${lastTurn.toLocaleString()} tok` : ''}`
    );
  },

  /**
   * Load AI mode preference from localStorage (online or offline only)
   */
  loadAiMode() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.AI_MODE);
      if (stored === 'offline' || stored === 'online') {
        this.aiMode = stored;
      } else {
        this.aiMode = 'online';
      }
    } catch (e) {
      this.aiMode = 'online';
    }
  },

  /**
   * Load selected Gemini model from localStorage
   */
  loadSelectedModel() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.SELECTED_MODEL);
      const validModels = ['gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
      if (stored && validModels.includes(stored)) {
        this.selectedModel = stored;
      } else {
        this.selectedModel = 'gemini-3.7-flash';
      }
    } catch (e) {
      this.selectedModel = 'gemini-3.7-flash';
    }

    const selectEl = document.getElementById('botModelSelect');
    if (selectEl) {
      selectEl.value = this.selectedModel;
    }
  },

  /**
   * Set active Gemini model
   */
  setModel(modelName) {
    this.selectedModel = modelName || 'gemini-3.7-flash';
    try {
      localStorage.setItem(this.STORAGE_KEYS.SELECTED_MODEL, this.selectedModel);
    } catch (e) {}

    const selectEl = document.getElementById('botModelSelect');
    if (selectEl && selectEl.value !== this.selectedModel) {
      selectEl.value = this.selectedModel;
    }

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(`Fourge AI: Switched to ${this.selectedModel}`, 'info');
    }
  },

  /**
   * Toggle AI mode between Online (Gemini AI) and Offline (Local Engine)
   */
  toggleAiMode() {
    this.aiMode = (this.aiMode === 'online') ? 'offline' : 'online';
    try {
      localStorage.setItem(this.STORAGE_KEYS.AI_MODE, this.aiMode);
    } catch (e) {}
    this.updateModeUI();
    this.updateTokenGauge();
    if (this.messages.length === 0) {
      this.renderWelcomeMessage();
    }
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast(this.aiMode === 'online' ? 'Fourge AI: Online Mode active (Gemini AI).' : 'Fourge AI: Offline Mode active (Local Engine).', 'info');
    }
  },

  /**
   * Update header mode toggle button and live status badge
   */
  updateModeUI() {
    const toggleBtn = document.getElementById('botModeToggleBtn');
    const toggleText = document.getElementById('botModeToggleText');
    const headerBadge = document.getElementById('botLiveStatusBadge');

    if (this.aiMode === 'offline') {
      if (toggleBtn) {
        toggleBtn.className = 'btn-secondary bot-mode-toggle-btn offline';
        toggleBtn.setAttribute('title', 'AI is OFF (using Offline Local Engine). Click to enable Online AI.');
      }
      if (toggleText) {
        toggleText.innerHTML = '○ AI OFF';
      }
      if (headerBadge) {
        headerBadge.className = 'bot-status-pill offline';
        headerBadge.innerHTML = '<span class="pulse-dot" style="background: var(--text-muted);"></span> Offline Mode';
      }
    } else {
      if (toggleBtn) {
        toggleBtn.className = 'btn-secondary bot-mode-toggle-btn online';
        toggleBtn.setAttribute('title', 'AI is ON (using Gemini Cloud Router). Click to switch to Offline Mode.');
      }
      if (toggleText) {
        toggleText.innerHTML = '● AI ON';
      }
      if (headerBadge) {
        headerBadge.className = 'bot-status-pill online';
        headerBadge.innerHTML = '<span class="pulse-dot"></span> Fourge AI Live';
      }
    }
  },

  /**
   * Called when user switches to the 'strategy-bot' view
   */
  onViewActivated() {
    this.updateModeUI();
    this.updateTokenGauge();
    this.updateContext();
    this.scrollToBottom();
    const input = document.getElementById('botChatInput');
    if (input) {
      setTimeout(() => input.focus(), 150);
    }
  },

  /**
   * Bind DOM event listeners
   */
  bindEvents() {
    // Mode toggle button
    const modeToggleBtn = document.getElementById('botModeToggleBtn');
    if (modeToggleBtn) {
      modeToggleBtn.addEventListener('click', () => this.toggleAiMode());
    }

    // Model selector dropdown
    const modelSelect = document.getElementById('botModelSelect');
    if (modelSelect) {
      modelSelect.addEventListener('change', (e) => this.setModel(e.target.value));
    }

    // Send message on click
    const sendBtn = document.getElementById('botSendBtn');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.handleSendMessage());
    }

    // Send message on Enter (Shift+Enter for newline)
    const chatInput = document.getElementById('botChatInput');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
      // Auto-grow textarea height
      chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
      });
    }

    // Prompt suggestion chips (delegated for in-chat rendered chips and static chips)
    const chatMessagesContainer = document.getElementById('botChatMessages');
    if (chatMessagesContainer) {
      chatMessagesContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.bot-prompt-chip');
        if (chip) {
          const text = chip.getAttribute('data-prompt') || chip.innerText.trim();
          this.sendPrompt(text);
        }
      });
    }

    document.querySelectorAll('.bot-prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-prompt') || chip.innerText.trim();
        this.sendPrompt(text);
      });
    });

    // Clear Chat
    const clearBtn = document.getElementById('botClearChatBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearChat());
    }

    // Export Chat
    const exportBtn = document.getElementById('botExportChatBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportChat());
    }
  },

  /**
   * Get active trades from App or StorageManager
   */
  getTrades() {
    if (this.tradesCache && this.tradesCache.length > 0) {
      return this.tradesCache;
    }
    if (typeof App !== 'undefined' && App.trades && App.trades.length > 0) {
      return App.trades;
    }
    if (typeof StorageManager !== 'undefined') {
      return StorageManager.getTrades() || [];
    }
    return [];
  },

  /**
   * Update the trade context summary banner & cache current metrics
   */
  updateContext() {
    // Reset conversation interaction ID and offline context on any dataset/currency context change
    this.lastInteractionId = null;
    this.offlineContext = {};
    const trades = this.getTrades();
    const bannerText = document.getElementById('botContextText');
    const bannerBadge = document.getElementById('botContextBadge');

    if (!trades || trades.length === 0) {
      this.metricsCache = null;
      if (bannerText) {
        bannerText.innerHTML = '<strong>No trade data loaded.</strong> Upload a CSV trade log on the Dashboard to unlock deep data analysis.';
      }
      if (bannerBadge) {
        bannerBadge.className = 'bot-badge bot-badge-neutral';
        bannerBadge.innerText = '0 Trades';
      }
      return;
    }

    // Calculate current metrics
    if (typeof TradeAnalytics !== 'undefined') {
      this.metricsCache = TradeAnalytics.calculateMetrics(trades);
    }

    const m = this.metricsCache;
    if (!m) return;

    const symCount = (m.symbolBreakdown || []).length;
    const formattedPnl = typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.formatCurrency(m.totalPnL) : `$${m.totalPnL.toFixed(2)}`;
    const isProfitable = m.totalPnL >= 0;

    if (bannerText) {
      bannerText.innerHTML = `
        <strong>${trades.length} Trades Loaded</strong> &bull;
        Net P&L: <span style="color: ${isProfitable ? 'var(--color-profit)' : 'var(--color-loss)'}; font-weight: 700;">${formattedPnl}</span> &bull;
        Win Rate: <strong>${m.winRate.toFixed(1)}%</strong> &bull;
        Profit Factor: <strong>${m.profitFactor >= 99 ? '∞' : m.profitFactor.toFixed(2)}</strong> &bull;
        ${symCount} Symbols
      `;
    }

    if (bannerBadge) {
      bannerBadge.className = `bot-badge ${isProfitable ? 'bot-badge-profit' : 'bot-badge-loss'}`;
      bannerBadge.innerText = `${trades.length} Trades (${formattedPnl})`;
    }
  },

  /**
   * Parse error response from the /api/strategy-bot server proxy.
   * The server already sanitizes error messages — no API keys can leak.
   */
  parseServerError(status, errorJson) {
    const errObj = errorJson?.error || errorJson;
    let rawMsg = errObj?.message || '';

    if (!rawMsg) {
      switch (status) {
        case 400: rawMsg = 'Bad Request — invalid format or parameters.'; break;
        case 429: rawMsg = 'Rate limit exceeded. Please wait a moment.'; break;
        case 500: rawMsg = 'Server error. The AI service is temporarily unavailable.'; break;
        case 502: rawMsg = 'Unable to reach the AI service. Please try again.'; break;
        case 503: rawMsg = 'Service unavailable. Please try again shortly.'; break;
        default: rawMsg = 'Request failed.'; break;
      }
    }

    return `Fourge AI error (${status}): ${rawMsg}`;
  },

  /**
   * Send prompt from suggestion chips or external trigger
   */
  sendPrompt(promptText) {
    const chatInput = document.getElementById('botChatInput');
    if (chatInput) {
      chatInput.value = promptText;
    }
    return this.handleSendMessage();
  },

  /**
   * Handle user submitting a message
   */
  async handleSendMessage() {
    if (this.isGenerating) return;

    const chatInput = document.getElementById('botChatInput');
    if (!chatInput) return;

    const text = chatInput.value.trim();
    if (!text) return;

    // Clear input
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Append User Message
    this.appendMessage('user', text);

    // Show typing / thinking indicator
    this.showTypingIndicator(true);
    this.isGenerating = true;

    try {
      let reply = '';

      if (this.aiMode === 'offline') {
        // AI OFF: strictly local deterministic evaluation without server/network call
        reply = await this.runLocalSmartEngine(text);
      } else {
        // AI ON: try server proxy with multi-project Gemini failover
        try {
          reply = await this.callGeminiAPI(text);
        } catch (serverErr) {
          // Automatic fallback to local engine on server errors (Failed to fetch, 502/503, GEMINI_API_KEY is not configured)
          const isServerDown = serverErr.message && (
            serverErr.message.includes('Failed to fetch') ||
            serverErr.message.includes('NetworkError') ||
            serverErr.message.includes('502') ||
            serverErr.message.includes('503') ||
            serverErr.message.includes('GEMINI_API_KEY is not configured') ||
            serverErr.message.includes('Fourge AI error')
          );

          if (isServerDown) {
            console.warn('[FourgeAI] Server unavailable or failed, falling back to local engine:', serverErr.message);
            reply = await this.runLocalSmartEngine(text);
          } else {
            reply = await this.runLocalSmartEngine(text);
          }
        }
      }

      this.showTypingIndicator(false);
      this.appendMessage('assistant', reply);
    } catch (err) {
      this.showTypingIndicator(false);
      
      const errorMsg = err.message && err.message.startsWith('Fourge AI error')
        ? `⚠️ **${err.message}**`
        : `⚠️ **Error generating response:** ${err.message || 'Something went wrong.'}`;
      this.appendMessage('assistant', errorMsg);
    } finally {
      this.isGenerating = false;
      this.saveChatHistory();
    }
  },

  /**
   * Retrieve active Gemini API key from localStorage, window, or runtime fallback
   */
  getApiKey() {
    const fromStorage = localStorage.getItem(this.STORAGE_KEYS.GEMINI_API_KEY);
    if (fromStorage && fromStorage.trim()) return fromStorage.trim();
    if (typeof window !== 'undefined' && window.GEMINI_API_KEY) return window.GEMINI_API_KEY;

    try {
      if (typeof atob === 'function') {
        return atob('QVEuQWI4Uk42SWJMT2ZuU0kwMUVsY0JCaGx6bUp3dEk1eEh3XzN0X3NYMnd0ZmZpRnlKYUE=');
      }
    } catch (e) {}
    return '';
  },

  /**
   * Direct Gemini API client-side call (used when running under file:// protocol or standalone)
   */
  async callDirectGemini(userQuery) {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('Fourge AI error: No Gemini API Key configured. Please add your GEMINI_API_KEY.');
    }

    const preferredModel = this.selectedModel || 'gemini-3.7-flash';
    const fallbackModels = [preferredModel, 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
    const modelsToTry = [...new Set(fallbackModels)];

    let lastError = null;

    for (const model of modelsToTry) {
      const geminiInteractionsUrl = 'https://generativelanguage.googleapis.com/v1beta/interactions';
      const isStateful = Boolean(this.lastInteractionId);

      const postInteractions = async (input, prevId) => {
        const payload = {
          model: model,
          input: input.trim()
        };
        if (prevId) {
          payload.previous_interaction_id = prevId;
        }
        const resp = await fetch(geminiInteractionsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key.trim()
          },
          body: JSON.stringify(payload)
        });
        const data = await resp.json().catch(() => ({}));
        return { ok: resp.ok, status: resp.status, data };
      };

      const postGenerateContent = async (input) => {
        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key.trim())}`;
        const payload = {
          contents: [{ parts: [{ text: input.trim() }] }]
        };
        const resp = await fetch(genUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await resp.json().catch(() => ({}));
        return { ok: resp.ok, status: resp.status, data };
      };

      try {
        let result;
        if (isStateful) {
          result = await postInteractions(userQuery, this.lastInteractionId);
          if (!result.ok && (result.status === 400 || result.status === 404)) {
            this.lastInteractionId = null;
            const systemPrompt = this.buildSystemPrompt();
            const combinedContent = `[System Instructions & Trading Performance Context]\n${systemPrompt}\n\n---\n[Trader Question]\n${userQuery}`;
            result = await postInteractions(combinedContent, null);
          }
        } else {
          const systemPrompt = this.buildSystemPrompt();
          const combinedContent = `[System Instructions & Trading Performance Context]\n${systemPrompt}\n\n---\n[Trader Question]\n${userQuery}`;
          result = await postInteractions(combinedContent, null);
        }

        // If interactions API endpoint returned 404 or method not supported, try generateContent
        if (!result.ok && (result.status === 404 || result.status === 400)) {
          const systemPrompt = this.buildSystemPrompt();
          const combinedContent = `[System Instructions & Trading Performance Context]\n${systemPrompt}\n\n---\n[Trader Question]\n${userQuery}`;
          result = await postGenerateContent(combinedContent);
        }

        if (result.ok) {
          const text = this.extractOutputText(result.data);
          if (text) {
            if (result.data?.id) {
              this.lastInteractionId = result.data.id;
            }
            const usageObj = result.data?.usage || result.data?.usageMetadata || null;
            this.recordDirectTokenUsage(usageObj, userQuery.length + text.length);
            this.fetchServerUsage();
            return text;
          }
        }

        // Check if rate limited (429) or high demand (503) -> try next fallback model
        if (result.status === 429 || result.status === 503) {
          lastError = result.data?.error?.message || `Rate limit / high demand on ${model}`;
          console.warn(`[FourgeAI Direct] ${model} status ${result.status}. Trying next model...`);
          continue;
        }

        const formattedErr = this.parseServerError(result.status, result.data);
        lastError = formattedErr;
      } catch (netErr) {
        lastError = netErr.message;
        continue;
      }
    }

    throw new Error(lastError || 'Fourge AI error: All Gemini models failed to respond.');
  },

  /**
   * Call Fourge AI server proxy (/api/strategy-bot) with direct client failover fallback
   */
  async callGeminiAPI(userQuery) {
    const isFileProtocol = (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:');

    // Under file:// protocol, directly call Gemini Interactions API
    if (isFileProtocol) {
      return await this.callDirectGemini(userQuery);
    }

    try {
      const endpoint = '/api/strategy-bot';

      // Helper to POST to the server proxy
      const postToProxy = async (body) => {
        return await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      };

      const selectedModel = this.selectedModel || 'gemini-3.7-flash';

      // Determine request payload based on conversation state
      let payload;
      const isStateful = Boolean(this.lastInteractionId);

      if (isStateful) {
        payload = {
          model: selectedModel,
          previous_interaction_id: this.lastInteractionId,
          input: userQuery
        };
      } else {
        const systemPrompt = this.buildSystemPrompt();
        const combinedContent = `[System Instructions & Trading Performance Context]\n${systemPrompt}\n\n---\n[Trader Question]\n${userQuery}`;
        payload = {
          model: selectedModel,
          input: combinedContent
        };
      }

      let response = await postToProxy(payload);

      // Fallback: If a stateful request returns 400 or 500, clear lastInteractionId and retry statelessly
      if (!response.ok && isStateful && (response.status === 400 || response.status === 500)) {
        this.lastInteractionId = null;
        const systemPrompt = this.buildSystemPrompt();
        const combinedContent = `[System Instructions & Trading Performance Context]\n${systemPrompt}\n\n---\n[Trader Question]\n${userQuery}`;
        response = await postToProxy({ model: selectedModel, input: combinedContent });
      }

      if (response.ok) {
        const data = await response.json();
        const text = this.extractOutputText(data);
        if (text) {
          if (data.id) this.lastInteractionId = data.id;
          const usageObj = data.usage || null;
          this.recordDirectTokenUsage(usageObj, userQuery.length + text.length);
          await this.fetchServerUsage();
          return text;
        }
      }

      // If server proxy returned error, try direct client fallback
      return await this.callDirectGemini(userQuery);
    } catch (proxyErr) {
      // Direct client fallback when proxy is unreachable
      console.warn('[FourgeAI] Server proxy unavailable, falling back to direct client Gemini API call:', proxyErr.message);
      return await this.callDirectGemini(userQuery);
    }
  },

  /**
   * Helper to format hold duration for a single trade
   */
  getTradeHoldTime(t) {
    if (!t) return 'N/A';
    if (t.durationFormatted) return t.durationFormatted;
    if (typeof t.durationMinutes === 'number' && !isNaN(t.durationMinutes)) {
      return `${Math.round(t.durationMinutes)}m`;
    }
    if (t.openTime && t.closeTime) {
      const o = new Date(t.openTime).getTime();
      const c = new Date(t.closeTime).getTime();
      const ms = c - o;
      if (!isNaN(ms) && ms >= 0) {
        if (typeof TradeAnalytics !== 'undefined' && TradeAnalytics.formatDuration) {
          return TradeAnalytics.formatDuration(ms);
        }
        const totalSec = Math.round(ms / 1000);
        if (totalSec < 60) return `${totalSec}s`;
        const totalMin = Math.floor(totalSec / 60);
        if (totalMin < 60) return `${totalMin}m`;
        const hrs = Math.floor(totalMin / 60);
        const remM = totalMin % 60;
        return remM > 0 ? `${hrs}h ${remM}m` : `${hrs}h`;
      }
    }
    return 'N/A';
  },

  /**
   * Built-in Local Smart Analytics Engine (Zero API Key required)
   * Delegates to OfflineStrategyEngine for natural-language deterministic insights.
   */
  async runLocalSmartEngine(query) {
    // Artificial small delay for conversational feel
    await new Promise(r => setTimeout(r, 250));

    const trades = this.getTrades();
    const m = this.metricsCache || (typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.calculateMetrics(trades) : null);

    if (typeof OfflineStrategyEngine !== 'undefined' && typeof OfflineStrategyEngine.evaluate === 'function') {
      const result = OfflineStrategyEngine.evaluate(query, trades, m, this.offlineContext || {});
      if (result && result.contextUpdate) {
        this.offlineContext = result.contextUpdate;
      }
      return (result && result.text) ? result.text : 'No analysis generated.';
    }

    // Fallback if offline engine not yet loaded
    return 'Offline Strategy Engine unavailable.';
  },

  /**
   * Build exhaustive system prompt with all trade data and metrics for Gemini
   */
  buildSystemPrompt() {
    const trades = this.getTrades();
    const currSym = typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.getCurrencySymbol() : '$';
    const fmt = (val, withSign = true) => typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.formatCurrency(val, withSign) : `${val >= 0 && withSign ? '+' : ''}${currSym}${val.toFixed(2)}`;

    let metricsText = 'No CSV trade data loaded yet.';
    let symbolsText = 'None';
    let worstTradesText = 'None';
    let bestTradesText = 'None';
    let daysText = 'None';
    let recentTradesText = 'None';

    if (trades && trades.length > 0) {
      const m = this.metricsCache || (typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.calculateMetrics(trades) : null);
      if (m) {
        let peak = 0;
        let maxDd = 0;
        (m.cumulativeTimeseries || []).forEach(pt => {
          if (pt.cumulativePnL > peak) peak = pt.cumulativePnL;
          const dd = peak - pt.cumulativePnL;
          if (dd > maxDd) maxDd = dd;
        });
        const maxDrawdown = Math.round(maxDd * 100) / 100;
        const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;

        const dur = m.durationMetrics || {};
        const avgHoldMin = dur.avgDurationMs ? Math.round(dur.avgDurationMs / 60000) : 0;
        const winHoldMin = dur.avgWinDurationMs ? Math.round(dur.avgWinDurationMs / 60000) : 0;
        const lossHoldMin = dur.avgLossDurationMs ? Math.round(dur.avgLossDurationMs / 60000) : 0;

        metricsText = `
- Total Trades Executed: ${trades.length}
- Net Profit/Loss: ${fmt(m.totalPnL)}
- Gross Profit: ${fmt(m.grossProfit, false)} | Gross Loss: ${fmt(m.grossLoss, false)}
- Win Rate: ${m.winRate.toFixed(2)}% (${m.winnersCount} Winning Trades, ${m.losersCount} Losing Trades, ${m.breakEvenCount} Break-even)
- Profit Factor: ${m.profitFactor >= 99 ? 'Infinite' : m.profitFactor.toFixed(2)}
- Average Winning Trade: ${fmt(m.avgWin, false)}
- Average Losing Trade: ${fmt(m.avgLoss, false)}
- Risk-to-Reward Ratio: ${m.avgLoss > 0 ? (m.avgWin / m.avgLoss).toFixed(2) : 'N/A'}:1
- Max Peak-to-Valley Drawdown: ${fmt(maxDrawdown, false)} (${maxDrawdownPercent.toFixed(2)}%)
- Longest Win Streak: ${m.maxWinStreak} consecutive trades
- Longest Loss Streak: ${m.maxLossStreak} consecutive trades
- Long (Buy) Trades: ${m.typeBreakdown?.buy?.count || 0} (P&L: ${fmt(m.typeBreakdown?.buy?.pnl || 0)})
- Short (Sell) Trades: ${m.typeBreakdown?.sell?.count || 0} (P&L: ${fmt(m.typeBreakdown?.sell?.pnl || 0)})
- Average Hold Time: ${avgHoldMin} minutes (Winners: ${winHoldMin}m, Losers: ${lossHoldMin}m)
        `.trim();

        // Symbols breakdown
        const symbolsList = m.symbolBreakdown || [];
        symbolsText = symbolsList.map(s => {
          const wr = s.trades > 0 ? ((s.wins / s.trades) * 100).toFixed(1) : 0;
          return `${s.symbol}: ${s.trades} trades, ${wr}% win rate, Net P&L: ${fmt(s.pnl)}`;
        }).join('\n');

        // Top 5 worst trades
        const worst = [...trades].sort((a, b) => (a.profit || 0) - (b.profit || 0)).slice(0, 5);
        worstTradesText = worst.map(t => `Ticket #${t.ticket || 'N/A'}: ${t.symbol} ${t.type} | P&L: ${fmt(t.profit)} | Date: ${t.openTime} | Hold: ${this.getTradeHoldTime(t)}`).join('\n');

        // Top 5 best trades
        const best = [...trades].sort((a, b) => (b.profit || 0) - (a.profit || 0)).slice(0, 5);
        bestTradesText = best.map(t => `Ticket #${t.ticket || 'N/A'}: ${t.symbol} ${t.type} | P&L: ${fmt(t.profit)} | Date: ${t.openTime} | Hold: ${this.getTradeHoldTime(t)}`).join('\n');

        // Weekdays
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        daysText = Object.keys(m.weekdayMap || {}).map(i => `${dayNames[i]}: ${fmt(m.weekdayMap[i])} (${m.weekdayCount?.[i] || 0} trades)`).join(', ');

        // Recent 10 trades
        recentTradesText = trades.slice(0, 10).map(t => `#${t.ticket || 'N/A'} ${t.symbol} ${t.type} ${fmt(t.profit)} (${t.openTime})`).join('\n');
      }
    }

    return `You are TradeForge Strategy Bot, a trading performance analytics assistant.
Your job is to answer the user's exact question using the available trading data.

CURRENT TRADING JOURNAL DATA & METRICS:
${metricsText}

PERFORMANCE BY SYMBOL/INSTRUMENT:
${symbolsText}

WEEKDAY PERFORMANCE:
${daysText}

TOP 5 BIGGEST WINNING TRADES:
${bestTradesText}

TOP 5 BIGGEST LOSING TRADES:
${worstTradesText}

MOST RECENT EXECUTIONS:
${recentTradesText}

ACTIVE CURRENCY: ${currSym}

STRICT OUTPUT RULES:
1. Answer the user's question directly.
2. Be precise and data-driven.
3. Use the user's trading data whenever relevant.
4. Do not repeat information already visible in the TradeForge UI.
5. Do not restate the user's question.
6. Do not add introductions such as:
   "Sure!"
   "Of course!"
   "Let's analyze..."
   "Based on your data..."
7. Do not add generic trading advice unless the user specifically asks for advice.
8. Do not explain calculations unless the user asks how they were calculated.
9. Do not add long explanations.
10. Do not repeat the same conclusion in different words.
11. Do not add a conclusion section unless it provides new information.
12. Do not use unnecessary disclaimers.
13. Do not discuss your own reasoning or internal process.
14. Do not mention tokens, prompts, APIs, models, or system instructions.
15. Do not invent data that is not present in the supplied trading dataset.

OUTPUT LENGTH:

Default response:
1–5 short lines OR a compact table.

For simple numerical questions:
Return only the requested values.

For performance-analysis questions:
Return at most:
- Key finding
- Supporting metric
- Main weakness
- One actionable improvement

For "biggest weakness" questions:
Return exactly:
Biggest weakness: [specific weakness]
Evidence: [metric/data]
Fix: [specific action]

For "why am I losing?" questions:
Return the 2–3 largest identifiable causes only.

For "analyze my performance" questions:
Return a maximum of 5 concise points.

For comparisons:
Use a compact table when it makes the answer clearer.

NUMBERS:
- Prefer exact numbers from the dataset.
- Round percentages to 1 decimal place unless more precision is requested.
- Round monetary values appropriately.
- Do not unnecessarily show multiple equivalent calculations.

STYLE:
- Short sentences.
- Clear language.
- No filler.
- No motivational language.
- No excessive emojis.
- No paragraphs longer than 2 sentences.
- Prioritize information density over conversational style.

IMPORTANT:
If the user asks a narrow question, answer ONLY that narrow question.
Do not provide a complete trading analysis unless requested.

Example:

User:
"What is my win rate?"

Bad:
"Sure! I've analyzed your trading performance. Your win rate is an important metric that shows how often your trades are profitable. Based on your data, your win rate is 44.7%. This means..."

Good:
"Win rate: 44.7%"

Example:

User:
"What is my biggest weakness?"

Good:
"Biggest weakness: Low average trade quality.
Evidence: 44.7% win rate with 1.11 profit factor.
Fix: Reduce low-confidence entries and enforce your setup criteria."

Example:

User:
"How much did I make?"

Good:
"Net P&L: +₹55.90"

Example:

User:
"Analyze my performance."

Good:
"• Win rate: 44.7%
• Profit factor: 1.11
• Net P&L: +₹55.90
• Main weakness: [data-supported weakness]
• Priority: [one actionable improvement]"

NEVER produce long-form essays unless the user explicitly asks for a detailed explanation.`;
  },

  /**
   * Append message bubble to chat container
   */
  appendMessage(role, content, options = {}) {
    const container = document.getElementById('botChatMessages');
    if (!container) return;

    const messageObj = {
      role,
      content,
      timestamp: new Date().toISOString()
    };
    this.messages.push(messageObj);

    const msgEl = document.createElement('div');
    msgEl.className = `bot-message bot-message-${role}`;

    const formattedContent = this.formatMarkdown(content);

    msgEl.innerHTML = `
      <div class="bot-msg-body">
        <div class="bot-msg-header">
          <span class="bot-msg-author">${role === 'user' ? 'You' : 'Fourge AI'}</span>
          <span class="bot-msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          ${role === 'assistant' ? `<button class="bot-copy-btn" title="Copy response" onclick="StrategyBotManager.copyMessage(this)">Copy</button>` : ''}
        </div>
        <div class="bot-msg-text">${formattedContent}</div>
      </div>
    `;

    container.appendChild(msgEl);
    this.scrollToBottom();
  },

  /**
   * Append inline system notice
   */
  appendSystemNotice(text) {
    const container = document.getElementById('botChatMessages');
    if (!container) return;

    const noticeEl = document.createElement('div');
    noticeEl.className = 'bot-system-notice';
    noticeEl.innerHTML = `<span>${this.formatMarkdown(text)}</span>`;
    container.appendChild(noticeEl);
    this.scrollToBottom();
  },

  /**
   * Copy message text to clipboard
   */
  copyMessage(btnEl) {
    const textEl = btnEl.closest('.bot-msg-body')?.querySelector('.bot-msg-text');
    if (!textEl) return;

    navigator.clipboard.writeText(textEl.innerText).then(() => {
      const orig = btnEl.textContent;
      btnEl.textContent = 'Copied';
      btnEl.classList.add('copied');
      setTimeout(() => {
        btnEl.textContent = orig;
        btnEl.classList.remove('copied');
      }, 2000);
    }).catch(err => {
      console.warn('Failed to copy text:', err);
    });
  },

  /**
   * Show/Hide animated typing indicator
   */
  showTypingIndicator(show) {
    const container = document.getElementById('botChatMessages');
    if (!container) return;

    let typingEl = document.getElementById('botInChatTyping');
    if (show) {
      if (!typingEl) {
        typingEl = document.createElement('div');
        typingEl.id = 'botInChatTyping';
        typingEl.className = 'bot-message bot-message-assistant bot-typing-bubble-wrap';
        typingEl.innerHTML = `
          <div class="bot-msg-body">
            <div class="bot-msg-header">
              <span class="bot-msg-author">Fourge AI</span>
            </div>
            <div class="bot-msg-text bot-typing-dots">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
          </div>
        `;
        container.appendChild(typingEl);
      }
      this.scrollToBottom();
    } else {
      if (typingEl) {
        typingEl.remove();
      }
    }
  },

  /**
   * Smooth scroll chat stream to bottom
   */
  scrollToBottom() {
    const container = document.getElementById('botChatMessages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  },

  /**
   * Format lightweight markdown into HTML
   */
  formatMarkdown(text) {
    if (!text) return '';

    let html = text;

    // Sanitize basic HTML tags (preserve existing spans if they have style)
    html = html.replace(/<(?!\/?(span|strong|em|b|i|code|br)\b)[^>]+>/gi, '');

    // Code blocks ```code```
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
      return `<pre class="bot-code-block"><code>${this.escapeHtml(code.trim())}</code></pre>`;
    });

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code class="bot-inline-code">$1</code>');

    // Headers: ### Header
    html = html.replace(/^### (.*$)/gim, '<h4 class="bot-h4">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="bot-h3">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 class="bot-h2">$1</h2>');

    // Tables: simple markdown table parser
    const tableRegex = /\|(.+)\|[\r\n]+\|[-:| ]+\|[\r\n]+((?:\|.+[\|\r\n]*)+)/g;
    html = html.replace(tableRegex, (match, headerRow, bodyRows) => {
      const headers = headerRow.split('|').map(h => h.trim()).filter(h => h !== '');
      const headerHtml = headers.map(h => `<th>${h}</th>`).join('');

      const bodyHtml = bodyRows.trim().split('\n').map(row => {
        const cols = row.split('|').map(c => c.trim()).filter(c => c !== '');
        if (cols.length === 0) return '';
        return `<tr>${cols.map(c => `<td>${c}</td>`).join('')}</tr>`;
      }).join('');

      return `<div class="bot-table-wrapper"><table class="bot-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
    });

    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic *text*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Unordered lists (- item or * item)
    html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li class="bot-li">$1</li>');
    html = html.replace(/(<li class="bot-li">.*<\/li>(\n|$))+/g, '<ul class="bot-ul">$&</ul>');

    // Numbered lists (1. item)
    html = html.replace(/^\s*\d+\.\s+(.*)$/gim, '<li class="bot-ol-li">$1</li>');
    html = html.replace(/(<li class="bot-ol-li">.*<\/li>(\n|$))+/g, '<ol class="bot-ol">$&</ol>');

    // Line breaks
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n(?!\s*<[\/]?([u|o]l|li|pre|code|table|tr|th|td|h[1-6]))/g, '<br>');

    return html;
  },

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Clear Chat History
   */
  clearChat() {
    this.messages = [];
    this.lastInteractionId = null;
    this.tokenUsage = {
      promptTokens: 0,
      outputTokens: 0,
      thoughtTokens: 0,
      lastTurnTokens: 0,
      sessionTokens: 0,
      activeContextTokens: 0
    };
    this.saveTokenUsage();
    this.updateTokenGauge();

    const container = document.getElementById('botChatMessages');
    if (container) {
      container.innerHTML = '';
    }
    try {
      localStorage.removeItem(this.STORAGE_KEYS.CHAT_HISTORY);
    } catch (e) {}

    this.renderWelcomeMessage();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Chat history and token session reset', 'info');
    }
  },

  /**
   * Export conversation to text/markdown file
   */
  exportChat() {
    if (this.messages.length === 0) {
      if (typeof App !== 'undefined' && App.showToast) {
        App.showToast('No messages to export', 'warning');
      }
      return;
    }

    const currSym = typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.getCurrencySymbol() : '$';
    let output = `# TradeForge - Fourge AI - Conversation Export\n`;
    output += `Date: ${new Date().toLocaleString()}\n`;
    output += `Currency: ${currSym}\n\n---\n\n`;

    this.messages.forEach(m => {
      const author = m.role === 'user' ? 'Trader' : 'Fourge AI';
      output += `### [${author}] - ${new Date(m.timestamp).toLocaleTimeString()}\n\n`;
      output += `${m.content}\n\n---\n\n`;
    });

    const blob = new Blob([output], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TradeForge-FourgeAI-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Chat exported as Markdown file', 'success');
    }
  },

  /**
   * Persist messages in localStorage
   */
  saveChatHistory() {
    try {
      // Save last 20 messages
      const toSave = this.messages.slice(-20);
      localStorage.setItem(this.STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(toSave));
    } catch (e) {}
  },

  /**
   * Load messages from localStorage on initialization
   */
  loadChatHistory() {
    const container = document.getElementById('botChatMessages');
    if (!container) return;

    container.innerHTML = '';
    let loaded = false;

    try {
      const raw = localStorage.getItem(this.STORAGE_KEYS.CHAT_HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.messages = [];
          parsed.forEach(m => {
            this.appendMessage(m.role, m.content);
          });
          loaded = true;
        }
      }
    } catch (e) {}

    if (!loaded) {
      this.renderWelcomeMessage();
    }
  },

  /**
   * Render initial welcome message inside the chat stream
   */
  renderWelcomeMessage() {
    const container = document.getElementById('botChatMessages');
    if (!container) return;

    container.innerHTML = '';

    const trades = this.getTrades();
    const tradeCount = trades ? trades.length : 0;

    const welcomeCard = document.createElement('div');
    welcomeCard.className = 'bot-welcome-card';
    welcomeCard.id = 'botWelcomeCard';

    const tradeStatusText = tradeCount > 0 
      ? `Analyzing <strong>${tradeCount} loaded trades</strong>. Ask questions about your performance, risk metrics, or trade execution.`
      : `No trades loaded yet. Upload your CSV to unlock full performance diagnostics, or ask general trading questions.`;

    const isOffline = (this.aiMode === 'offline');
    const subdescText = isOffline
      ? 'Running in Offline Mode — instant local trade calculations without cloud AI.'
      : 'Powered by Gemini AI — cloud intelligence with local offline fallback.';

    const chipsHtml = isOffline ? `
      <div class="bot-suggested-chips">
        <button type="button" class="bot-prompt-chip" data-prompt="Overview summary">Overview Summary</button>
        <button type="button" class="bot-prompt-chip" data-prompt="What is my win rate and profit factor?">Win Rate & PF</button>
        <button type="button" class="bot-prompt-chip" data-prompt="What is my total net profit?">Net Profit</button>
        <button type="button" class="bot-prompt-chip" data-prompt="Which symbols performed best and worst?">Best & Worst Symbols</button>
        <button type="button" class="bot-prompt-chip" data-prompt="Show my biggest winning and losing trades">Biggest Wins & Losses</button>
        <button type="button" class="bot-prompt-chip" data-prompt="What is my average hold time for winning vs losing trades?">Hold Times</button>
        <button type="button" class="bot-prompt-chip" data-prompt="What is my biggest problem or mistake?">Weakness Audit</button>
      </div>
    ` : `
      <div class="bot-suggested-chips">
        <button type="button" class="bot-prompt-chip" data-prompt="Run a full strategy audit on my trade history. Highlight my biggest strengths, critical leaks, and top actionable recommendations.">Full Strategy Audit</button>
        <button type="button" class="bot-prompt-chip" data-prompt="Analyze my biggest losing trades. What common patterns or mistakes stand out?">Biggest Losses</button>
        <button type="button" class="bot-prompt-chip" data-prompt="What are my best and worst performing symbols? Provide win rates, net profit, and profit factors for each.">Best & Worst Symbols</button>
        <button type="button" class="bot-prompt-chip" data-prompt="Analyze my trade hold times. Do I hold losing trades longer than winning trades?">Hold Time</button>
        <button type="button" class="bot-prompt-chip" data-prompt="Audit my risk-to-reward ratio and average win vs average loss. Is my payoff ratio healthy?">Risk/Reward</button>
        <button type="button" class="bot-prompt-chip" data-prompt="Calculate my profit factor, win rate, and expectancy. Are these metrics sustainable?">Profit Factor</button>
        <button type="button" class="bot-prompt-chip" data-prompt="Which days of the week or trading sessions produce my best and worst performance?">Best Days to Trade</button>
      </div>
    `;

    welcomeCard.innerHTML = `
      <div class="bot-welcome-header">
        <h3 class="bot-welcome-title">Fourge AI</h3>
        <p class="bot-welcome-desc">${tradeStatusText}</p>
        <p class="bot-welcome-subdesc">${subdescText}</p>
      </div>
      <div class="bot-suggested-wrap">
        <div class="bot-suggested-title">${isOffline ? 'Offline Local Commands' : 'Suggested Inquiries'}</div>
        ${chipsHtml}
      </div>
    `;

    container.appendChild(welcomeCard);
    this.scrollToBottom();
  }
};

// Export to window
if (typeof window !== 'undefined') {
  window.StrategyBotManager = StrategyBotManager;
}
