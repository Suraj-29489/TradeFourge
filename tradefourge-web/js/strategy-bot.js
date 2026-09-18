/**
 * TradeForge - Strategy Bot (AI Trading Co-pilot & Data Analyst)
 * Powered by Google AI Studio (Gemini 3.8 Flash - Interactions API) & Local Quantitative Engine
 */

const StrategyBotManager = {
  STORAGE_KEYS: {
    CHAT_HISTORY: 'tradeforge_bot_chat_history',
    AI_MODE: 'fourge_ai_mode'
  },

  // In-memory conversation state
  messages: [],
  isGenerating: false,
  metricsCache: null,
  lastInteractionId: null,
  offlineContext: {},
  aiMode: 'online', // 'online' | 'offline'

  /**
   * Initialize Strategy Bot
   */
  init() {
    this.loadAiMode();
    this.bindEvents();
    this.updateModeUI();
    this.updateContext();
    this.loadChatHistory();
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
   * Toggle AI mode between Online (Gemini AI) and Offline (Local Engine)
   */
  toggleAiMode() {
    this.aiMode = (this.aiMode === 'online') ? 'offline' : 'online';
    try {
      localStorage.setItem(this.STORAGE_KEYS.AI_MODE, this.aiMode);
    } catch (e) {}
    this.updateModeUI();
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
   * Call Fourge AI server proxy (/api/strategy-bot)
   * The server handles Gemini API authentication and model selection.
   * No API key is sent from the browser.
   */
  async callGeminiAPI(userQuery) {
    const endpoint = '/api/strategy-bot';

    // Helper to POST to the server proxy
    const postToProxy = async (body) => {
      return await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    };

    // Determine request payload based on conversation state
    let payload;
    const isStateful = Boolean(this.lastInteractionId);

    if (isStateful) {
      // Follow-up turn: send ONLY the new user question with previous_interaction_id
      payload = {
        previous_interaction_id: this.lastInteractionId,
        input: userQuery
      };
    } else {
      // Initial turn / after dataset change: send full context + user question
      const systemPrompt = this.buildSystemPrompt();
      const combinedContent = `[System Instructions & Trading Performance Context]\n${systemPrompt}\n\n---\n[Trader Question]\n${userQuery}`;
      payload = {
        input: combinedContent
      };
    }

    let response = await postToProxy(payload);

    // Fallback: If a stateful request returns 400 or 500, clear lastInteractionId
    // and retry exactly ONCE statelessly with the complete current context + user question.
    if (!response.ok && isStateful && (response.status === 400 || response.status === 500)) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[FourgeAI] Stateful interaction failed with HTTP ${response.status}. Resetting interaction ID and retrying once statelessly...`);
      }
      this.lastInteractionId = null;

      const systemPrompt = this.buildSystemPrompt();
      const combinedContent = `[System Instructions & Trading Performance Context]\n${systemPrompt}\n\n---\n[Trader Question]\n${userQuery}`;
      const retryPayload = {
        input: combinedContent
      };

      response = await postToProxy(retryPayload);
    }

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const formattedErr = this.parseServerError(response.status, errorJson);
      throw new Error(formattedErr);
    }

    const data = await response.json();

    // Server proxy returns { id, output_text }
    const replyText = (data.output_text || '').trim();

    if (!replyText) {
      throw new Error('Fourge AI error: Server returned empty response.');
    }

    // Save interaction ID for conversation continuity
    if (data.id) {
      this.lastInteractionId = data.id;
    }

    return replyText;
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
    const container = document.getElementById('botChatMessages');
    if (container) {
      container.innerHTML = '';
    }
    try {
      localStorage.removeItem(this.STORAGE_KEYS.CHAT_HISTORY);
    } catch (e) {}

    this.renderWelcomeMessage();
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Chat history cleared', 'info');
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

    const trades = this.getTrades();
    const tradeCount = trades ? trades.length : 0;

    const welcomeCard = document.createElement('div');
    welcomeCard.className = 'bot-welcome-card';
    welcomeCard.id = 'botWelcomeCard';

    const tradeStatusText = tradeCount > 0 
      ? `Analyzing <strong>${tradeCount} loaded trades</strong>. Ask questions about your performance, risk metrics, or trade execution.`
      : `No trades loaded yet. Upload your CSV to unlock full performance diagnostics, or ask general trading questions.`;

    const subdescText = (this.aiMode === 'offline')
      ? 'Running in Offline Mode — instant local trade calculations without cloud AI.'
      : 'Powered by Gemini AI — cloud intelligence with local offline fallback.';

    welcomeCard.innerHTML = `
      <div class="bot-welcome-header">
        <h3 class="bot-welcome-title">Fourge AI</h3>
        <p class="bot-welcome-desc">${tradeStatusText}</p>
        <p class="bot-welcome-subdesc">${subdescText}</p>
      </div>
      <div class="bot-suggested-wrap">
        <div class="bot-suggested-title">Suggested Inquiries</div>
        <div class="bot-suggested-chips">
          <button type="button" class="bot-prompt-chip" data-prompt="Run a full strategy audit on my trade history. Highlight my biggest strengths, critical leaks, and top actionable recommendations.">Full Strategy Audit</button>
          <button type="button" class="bot-prompt-chip" data-prompt="Analyze my biggest losing trades. What common patterns or mistakes stand out?">Biggest Losses</button>
          <button type="button" class="bot-prompt-chip" data-prompt="What are my best and worst performing symbols? Provide win rates, net profit, and profit factors for each.">Best & Worst Symbols</button>
          <button type="button" class="bot-prompt-chip" data-prompt="Analyze my trade hold times. Do I hold losing trades longer than winning trades?">Hold Time</button>
          <button type="button" class="bot-prompt-chip" data-prompt="Audit my risk-to-reward ratio and average win vs average loss. Is my payoff ratio healthy?">Risk/Reward</button>
          <button type="button" class="bot-prompt-chip" data-prompt="Calculate my profit factor, win rate, and expectancy. Are these metrics sustainable?">Profit Factor</button>
          <button type="button" class="bot-prompt-chip" data-prompt="Which days of the week or trading sessions produce my best and worst performance?">Best Days to Trade</button>
        </div>
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
