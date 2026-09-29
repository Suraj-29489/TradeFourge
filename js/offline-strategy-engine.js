/**
 * TradeForge - Fourge AI Offline Strategy & Analytics Engine
 *
 * Deterministic local trading analytics assistant.
 * Operates 100% offline without Gemini or external network requests.
 * Uses local trade dataset and TradeAnalytics calculations.
 */

(function(global) {
  'use strict';

  const OfflineStrategyEngine = {
    /**
     * Standard symbol aliases for fuzzy matching
     */
    SYMBOL_ALIASES: {
      'gold': 'XAUUSD',
      'xau': 'XAUUSD',
      'xauusd': 'XAUUSD',
      'xauusdc': 'XAUUSDC',
      'xauusdm': 'XAUUSD',
      'silver': 'XAGUSD',
      'xag': 'XAGUSD',
      'xagusd': 'XAGUSD',
      'bitcoin': 'BTCUSD',
      'btc': 'BTCUSD',
      'btcusd': 'BTCUSD',
      'btcusdt': 'BTCUSD',
      'ethereum': 'ETHUSD',
      'eth': 'ETHUSD',
      'ethusd': 'ETHUSD',
      'oil': 'USOIL',
      'crude': 'USOIL',
      'wti': 'USOIL',
      'usoil': 'USOIL',
      'nasdaq': 'NAS100',
      'nas': 'NAS100',
      'nas100': 'NAS100',
      'us100': 'NAS100',
      'us30': 'US30',
      'dow': 'US30',
      'spx': 'SPX500',
      'sp500': 'SPX500'
    },

    /**
     * Format currency using TradeAnalytics if available
     */
    formatCurrency(val, withSign = true) {
      if (typeof TradeAnalytics !== 'undefined' && typeof TradeAnalytics.formatCurrency === 'function') {
        return TradeAnalytics.formatCurrency(val, withSign);
      }
      const num = Number(val) || 0;
      const absVal = Math.abs(num).toFixed(2);
      if (num < 0) return `-$${absVal}`;
      if (withSign && num > 0) return `+$${absVal}`;
      return `$${absVal}`;
    },

    /**
     * Format trade duration helper
     */
    formatDuration(ms) {
      if (!ms || isNaN(ms) || ms < 0) return 'N/A';
      if (typeof TradeAnalytics !== 'undefined' && typeof TradeAnalytics.formatDuration === 'function') {
        return TradeAnalytics.formatDuration(ms);
      }
      const totalSec = Math.round(ms / 1000);
      if (totalSec < 60) return `${totalSec}s`;
      const totalMin = Math.floor(totalSec / 60);
      if (totalMin < 60) return `${totalMin}m`;
      const hrs = Math.floor(totalMin / 60);
      const remM = totalMin % 60;
      return remM > 0 ? `${hrs}h ${remM}m` : `${hrs}h`;
    },

    /**
     * Normalize symbol name
     */
    normalizeSymbol(sym) {
      if (!sym || typeof sym !== 'string') return '';
      const clean = sym.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const lower = clean.toLowerCase();
      if (this.SYMBOL_ALIASES[lower]) {
        return this.SYMBOL_ALIASES[lower];
      }
      return clean;
    },

    /**
     * Extract symbol references from query
     */
    extractSymbols(query, availableSymbols = []) {
      const lower = query.toLowerCase();
      const matched = [];

      // Check available symbols from dataset
      for (const s of availableSymbols) {
        const sNorm = s.toUpperCase();
        const sLower = s.toLowerCase();
        if (lower.includes(sLower) || lower.includes(sLower.replace(/m$/, ''))) {
          if (!matched.includes(sNorm)) matched.push(sNorm);
        }
      }

      // Check known aliases
      for (const [alias, canonical] of Object.entries(this.SYMBOL_ALIASES)) {
        const regex = new RegExp(`\\b${alias}\\b`, 'i');
        if (regex.test(lower)) {
          const found = availableSymbols.find(s => s.toUpperCase().startsWith(canonical) || canonical.startsWith(s.toUpperCase()));
          const toAdd = found ? found.toUpperCase() : canonical;
          if (!matched.includes(toAdd)) matched.push(toAdd);
        }
      }

      return matched;
    },

    /**
     * Format a readable date string from YYYY-MM-DD
     */
    formatDateFriendly(dateStr) {
      if (!dateStr || dateStr.length !== 10) return dateStr || '';
      const parts = dateStr.split('-').map(Number);
      const mNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const mIdx = parts[1] - 1;
      const mName = mNames[mIdx] || '';
      return `${mName} ${parts[2]}, ${parts[0]}`;
    },

    /**
     * Helper to extract potential date/month/weekday from user query
     */
    extractDateDetails(query, trades = []) {
      const qLower = query.toLowerCase().trim();
      const cleanQ = qLower.replace(/(\d+)(st|nd|rd|th)\b/g, '$1');

      // 1. Check for 'today'
      if (/\btoday\b/.test(cleanQ)) {
        const now = new Date();
        const yr = now.getFullYear();
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const da = String(now.getDate()).padStart(2, '0');
        return {
          type: 'today',
          dateStr: `${yr}-${mo}-${da}`,
          label: 'Today',
          friendly: this.formatDateFriendly(`${yr}-${mo}-${da}`)
        };
      }

      // 2. Check for 'yesterday'
      if (/\byesterday\b/.test(cleanQ)) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yr = yesterday.getFullYear();
        const mo = String(yesterday.getMonth() + 1).padStart(2, '0');
        const da = String(yesterday.getDate()).padStart(2, '0');
        return {
          type: 'yesterday',
          dateStr: `${yr}-${mo}-${da}`,
          label: 'Yesterday',
          friendly: this.formatDateFriendly(`${yr}-${mo}-${da}`)
        };
      }

      // 3. Check for 'latest trading day' / 'last trading day' / 'recent day'
      if (/\b(latest|last|most recent)\s+(trading\s+)?(day|profit|pnl|trades?)\b/.test(cleanQ) || /\b(what did i make recently|latest profit|recent profit)\b/.test(cleanQ)) {
        let latestDate = null;
        if (typeof TradeAnalytics !== 'undefined' && typeof TradeAnalytics.getLatestTradingDay === 'function') {
          const lDay = TradeAnalytics.getLatestTradingDay(trades);
          if (lDay) latestDate = lDay.date;
        }
        if (!latestDate && trades.length > 0) {
          const sorted = [...trades].sort((a, b) => (b.closeTime || b.openTime || '').localeCompare(a.closeTime || a.openTime || ''));
          latestDate = (sorted[0].closeTime || sorted[0].openTime || '').slice(0, 10);
        }
        return {
          type: 'latest_trading_day',
          dateStr: latestDate,
          label: 'Latest Trading Day',
          friendly: latestDate ? this.formatDateFriendly(latestDate) : 'Latest Trading Day'
        };
      }

      // 4. Exact date: YYYY-MM-DD
      const isoMatch = cleanQ.match(/\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/);
      if (isoMatch) {
        const y = isoMatch[1];
        const m = String(isoMatch[2]).padStart(2, '0');
        const d = String(isoMatch[3]).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        return {
          type: 'exact_date',
          dateStr,
          label: dateStr,
          friendly: this.formatDateFriendly(dateStr)
        };
      }

      // 5. Exact date: Month Day (e.g. "September 23", "Sep 28, 2026", "August 28")
      const months = {
        'jan': '01', 'january': '01',
        'feb': '02', 'february': '02',
        'mar': '03', 'march': '03',
        'apr': '04', 'april': '04',
        'may': '05',
        'jun': '06', 'june': '06',
        'jul': '07', 'july': '07',
        'aug': '08', 'august': '08',
        'sep': '09', 'sept': '09', 'september': '09',
        'oct': '10', 'october': '10',
        'nov': '11', 'november': '11',
        'dec': '12', 'december': '12'
      };

      const mdyMatch = cleanQ.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b[,\s]+(\d{1,2})(?:[,\s]+(\d{4}))?/i);
      if (mdyMatch) {
        const mStr = mdyMatch[1].toLowerCase();
        const monthNum = months[mStr] || '01';
        const dayNum = String(mdyMatch[2]).padStart(2, '0');
        let yearNum = mdyMatch[3] ? parseInt(mdyMatch[3], 10) : null;
        if (!yearNum) {
          if (trades.length > 0) {
            const firstDate = (trades[0].closeTime || trades[0].openTime || '').slice(0, 10);
            if (firstDate && firstDate.length >= 4) {
              yearNum = parseInt(firstDate.slice(0, 4), 10);
            }
          }
          if (!yearNum) yearNum = new Date().getFullYear();
        }
        const dateStr = `${yearNum}-${monthNum}-${dayNum}`;
        return {
          type: 'exact_date',
          dateStr,
          label: `${mdyMatch[1]} ${dayNum}`,
          friendly: this.formatDateFriendly(dateStr)
        };
      }

      // 6. Exact date: Day Month (e.g. "23 September", "28 Aug 2026")
      const dmyWordMatch = cleanQ.match(/\b(\d{1,2})[,\s]+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:[,\s]+(\d{4}))?/i);
      if (dmyWordMatch) {
        const dayNum = String(dmyWordMatch[1]).padStart(2, '0');
        const mStr = dmyWordMatch[2].toLowerCase();
        const monthNum = months[mStr] || '01';
        let yearNum = dmyWordMatch[3] ? parseInt(dmyWordMatch[3], 10) : null;
        if (!yearNum) {
          if (trades.length > 0) {
            const firstDate = (trades[0].closeTime || trades[0].openTime || '').slice(0, 10);
            if (firstDate && firstDate.length >= 4) {
              yearNum = parseInt(firstDate.slice(0, 4), 10);
            }
          }
          if (!yearNum) yearNum = new Date().getFullYear();
        }
        const dateStr = `${yearNum}-${monthNum}-${dayNum}`;
        return {
          type: 'exact_date',
          dateStr,
          label: `${dayNum} ${dmyWordMatch[2]}`,
          friendly: this.formatDateFriendly(dateStr)
        };
      }

      // 7. Month query (e.g. "in September", "September P&L", "how many trades in September", "in August")
      const monthOnlyMatch = cleanQ.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s+(\d{4}))?/i);
      if (monthOnlyMatch && !mdyMatch && !dmyWordMatch) {
        const mStr = monthOnlyMatch[1].toLowerCase();
        const monthNum = months[mStr] || '01';
        let yearNum = monthOnlyMatch[2] ? parseInt(monthOnlyMatch[2], 10) : null;
        if (!yearNum) {
          if (trades.length > 0) {
            const firstDate = (trades[0].closeTime || trades[0].openTime || '').slice(0, 10);
            if (firstDate && firstDate.length >= 4) {
              yearNum = parseInt(firstDate.slice(0, 4), 10);
            }
          }
          if (!yearNum) yearNum = new Date().getFullYear();
        }
        const monthKey = `${yearNum}-${monthNum}`;
        return {
          type: 'month',
          monthKey,
          monthName: monthOnlyMatch[1],
          year: yearNum
        };
      }

      // 8. Weekday queries (e.g. "Monday", "Wednesday", "on Monday", "average Monday")
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      for (let i = 0; i < dayNames.length; i++) {
        const dName = dayNames[i].toLowerCase();
        if (new RegExp(`\\b${dName}s?\\b`).test(cleanQ)) {
          return {
            type: 'weekday',
            weekdayIndex: i,
            weekdayName: dayNames[i],
            isAverage: cleanQ.includes('average') || cleanQ.includes('avg') || cleanQ.includes('usually') || cleanQ.includes('overall') || cleanQ.includes('all ') || cleanQ.endsWith('s'),
            isBest: cleanQ.includes('which') && cleanQ.includes('best') || cleanQ.includes('best ' + dName)
          };
        }
      }

      // 9. Year query (e.g. "in 2026", "2026 P&L")
      const yearMatch = cleanQ.match(/\b(20\d{2})\b/);
      if (yearMatch) {
        return {
          type: 'year',
          year: parseInt(yearMatch[1], 10)
        };
      }

      return null;
    },

    /**
     * Main evaluation entry point
     * @param {string} query - The user question
     * @param {Array} trades - Array of trade objects
     * @param {Object} metricsCache - Pre-calculated metrics or null
     * @param {Object} context - Optional conversational context { lastDate, lastSymbol, lastMonth, lastIntent, ... }
     * @returns {Object} { text: string, intent: string, contextUpdate: Object }
     */
    evaluate(query, trades = [], metricsCache = null, context = {}) {
      const q = (query || '').trim();
      const qLower = q.toLowerCase();
      const qClean = qLower.replace(/p&l|p\/l|pandl/g, 'pnl');
      const hasTrades = Array.isArray(trades) && trades.length > 0;

      // 1. GREETINGS & BASIC ASSISTANT INFO
      const greetingMatch = this.handleGreetings(qLower);
      if (greetingMatch) {
        return {
          text: greetingMatch,
          intent: 'greeting',
          contextUpdate: { ...context, lastIntent: 'greeting' }
        };
      }

      // 2. ZERO TRADES HANDLING
      if (!hasTrades) {
        return {
          text: 'No trades are loaded yet. Upload a CSV or add trades first.',
          intent: 'no_data',
          contextUpdate: { ...context, lastIntent: 'no_data' }
        };
      }

      // 3. COMPUTE METRICS
      const m = metricsCache || (typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.calculateMetrics(trades) : null);
      if (!m) {
        return {
          text: 'Unable to calculate statistics from the current trade log. Please check your data format.',
          intent: 'calculation_error',
          contextUpdate: context
        };
      }

      const availableSymbols = (m.symbolBreakdown || []).map(s => s.symbol);
      const mentionedSymbols = this.extractSymbols(qLower, availableSymbols);

      // Extract date / temporal details from query
      const dateInfo = this.extractDateDetails(q, trades);

      // =========================================================================
      // 4. DATE / TIME-SPECIFIC DETERMINISTIC QUERIES
      // =========================================================================

      // A. TODAY QUERY
      if (dateInfo && dateInfo.type === 'today') {
        const todayStr = dateInfo.dateStr;
        const dailyStats = typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.getDailyStats(todayStr, trades) : null;

        if (!dailyStats || dailyStats.trades === 0) {
          return {
            text: `No trades are recorded for ${dateInfo.friendly} in the current dataset.`,
            intent: 'today_empty',
            contextUpdate: { ...context, lastDate: todayStr, lastIntent: 'today_empty' }
          };
        }

        const wr = dailyStats.trades > 0 ? dailyStats.winRate.toFixed(1) : '0.0';
        return {
          text: `Today (${dateInfo.friendly}):\n• Net P&L: ${this.formatCurrency(dailyStats.pnl)}\n• Trades: ${dailyStats.trades} (${dailyStats.wins}W / ${dailyStats.losses}L, ${wr}% WR)\n• Gross Profit: ${this.formatCurrency(dailyStats.grossProfit, false)} | Gross Loss: ${this.formatCurrency(dailyStats.grossLoss, false)}`,
          intent: 'today_stats',
          contextUpdate: { ...context, lastDate: todayStr, lastIntent: 'today_stats' }
        };
      }

      // B. YESTERDAY QUERY
      if (dateInfo && dateInfo.type === 'yesterday') {
        const yestStr = dateInfo.dateStr;
        const dailyStats = typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.getDailyStats(yestStr, trades) : null;

        if (!dailyStats || dailyStats.trades === 0) {
          return {
            text: `No trades are recorded for ${dateInfo.friendly} in the current dataset.`,
            intent: 'yesterday_empty',
            contextUpdate: { ...context, lastDate: yestStr, lastIntent: 'yesterday_empty' }
          };
        }

        const wr = dailyStats.trades > 0 ? dailyStats.winRate.toFixed(1) : '0.0';
        return {
          text: `Yesterday (${dateInfo.friendly}):\n• Net P&L: ${this.formatCurrency(dailyStats.pnl)}\n• Trades: ${dailyStats.trades} (${dailyStats.wins}W / ${dailyStats.losses}L, ${wr}% WR)`,
          intent: 'yesterday_stats',
          contextUpdate: { ...context, lastDate: yestStr, lastIntent: 'yesterday_stats' }
        };
      }

      // C. LATEST TRADING DAY
      if (dateInfo && dateInfo.type === 'latest_trading_day') {
        const latestStats = typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.getLatestTradingDay(trades) : null;
        if (!latestStats) {
          return {
            text: 'No trading dates found in the current dataset.',
            intent: 'latest_trading_day_empty',
            contextUpdate: context
          };
        }

        const friendly = this.formatDateFriendly(latestStats.date);
        const wr = latestStats.trades > 0 ? latestStats.winRate.toFixed(1) : '0.0';
        return {
          text: `Latest Trading Day (${friendly}):\n• Net P&L: ${this.formatCurrency(latestStats.pnl)}\n• Total Trades: ${latestStats.trades} (${latestStats.wins}W / ${latestStats.losses}L, ${wr}% WR)\n• Gross Profit: ${this.formatCurrency(latestStats.grossProfit, false)} | Gross Loss: ${this.formatCurrency(latestStats.grossLoss, false)}`,
          intent: 'latest_trading_day',
          contextUpdate: { ...context, lastDate: latestStats.date, lastIntent: 'latest_trading_day' }
        };
      }

      // D. BEST TRADING DAY
      if (qLower.includes('best day') || qLower.includes('best trading day') || qLower.includes('top day') || qLower.includes('most profitable day') || qLower.includes('highest profit day')) {
        const bestDay = typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.getBestTradingDay(trades) : null;
        if (bestDay) {
          const friendly = this.formatDateFriendly(bestDay.date);
          const wr = bestDay.trades > 0 ? bestDay.winRate.toFixed(1) : '0.0';
          return {
            text: `Best Trading Day: ${friendly} (${bestDay.dayName})\n• Net P&L: ${this.formatCurrency(bestDay.pnl)}\n• Trades: ${bestDay.trades} (${bestDay.wins}W / ${bestDay.losses}L, ${wr}% WR)\n• Gross Profit: ${this.formatCurrency(bestDay.grossProfit, false)}`,
            intent: 'best_day',
            contextUpdate: { ...context, lastDate: bestDay.date, lastIntent: 'best_day' }
          };
        }
      }

      // E. WORST TRADING DAY
      if (qLower.includes('worst day') || qLower.includes('worst trading day') || qLower.includes('most losing day') || qLower.includes('biggest loss day') || qLower.includes('lowest profit day')) {
        const worstDay = typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.getWorstTradingDay(trades) : null;
        if (worstDay) {
          const friendly = this.formatDateFriendly(worstDay.date);
          const wr = worstDay.trades > 0 ? worstDay.winRate.toFixed(1) : '0.0';
          return {
            text: `Worst Trading Day: ${friendly} (${worstDay.dayName})\n• Net P&L: ${this.formatCurrency(worstDay.pnl)}\n• Trades: ${worstDay.trades} (${worstDay.wins}W / ${worstDay.losses}L, ${wr}% WR)\n• Gross Loss: ${this.formatCurrency(worstDay.grossLoss, false)}`,
            intent: 'worst_day',
            contextUpdate: { ...context, lastDate: worstDay.date, lastIntent: 'worst_day' }
          };
        }
      }

      // F. EXACT DATE QUERY (e.g. September 23, September 28, August 28, 2026-09-23)
      if (dateInfo && dateInfo.type === 'exact_date') {
        const targetDate = dateInfo.dateStr;
        const dailyStats = typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.getDailyStats(targetDate, trades) : null;

        if (!dailyStats || dailyStats.trades === 0) {
          return {
            text: `No trades are recorded for ${dateInfo.friendly} in the current dataset.`,
            intent: 'exact_date_empty',
            contextUpdate: { ...context, lastDate: targetDate, lastIntent: 'exact_date_empty' }
          };
        }

        // Specific metric on exact date
        if (qLower.includes('how many trades') || qLower.includes('trade count') || qLower.includes('number of trades')) {
          return {
            text: `${dateInfo.friendly}: ${dailyStats.trades} trades (${dailyStats.wins} wins, ${dailyStats.losses} losses).`,
            intent: 'date_trade_count',
            contextUpdate: { ...context, lastDate: targetDate, lastIntent: 'date_trade_count' }
          };
        }

        if (qLower.includes('win rate') || qLower.includes('win percentage') || qLower.includes('wr')) {
          const wr = dailyStats.trades > 0 ? dailyStats.winRate.toFixed(1) : '0.0';
          return {
            text: `${dateInfo.friendly} Win Rate: ${wr}% (${dailyStats.wins} wins / ${dailyStats.trades} trades).`,
            intent: 'date_win_rate',
            contextUpdate: { ...context, lastDate: targetDate, lastIntent: 'date_win_rate' }
          };
        }

        if (qLower.includes('biggest loss') || qLower.includes('worst trade') || qLower.includes('max loss')) {
          const wt = dailyStats.worstTrade;
          if (wt) {
            const sym = wt.symbol || 'N/A';
            const type = (wt.type || '').toUpperCase();
            return {
              text: `Biggest loss on ${dateInfo.friendly}:\n• Symbol: ${sym} ${type ? '(' + type + ')' : ''}\n• Loss: ${this.formatCurrency(wt.profit)}\n• Hold: ${this.formatDuration(wt.durationMinutes ? wt.durationMinutes * 60000 : 0)}`,
              intent: 'date_worst_trade',
              contextUpdate: { ...context, lastDate: targetDate, lastIntent: 'date_worst_trade' }
            };
          }
        }

        if (qLower.includes('biggest win') || qLower.includes('best trade') || qLower.includes('max win')) {
          const bt = dailyStats.bestTrade;
          if (bt) {
            const sym = bt.symbol || 'N/A';
            const type = (bt.type || '').toUpperCase();
            return {
              text: `Best trade on ${dateInfo.friendly}:\n• Symbol: ${sym} ${type ? '(' + type + ')' : ''}\n• Profit: ${this.formatCurrency(bt.profit)}\n• Hold: ${this.formatDuration(bt.durationMinutes ? bt.durationMinutes * 60000 : 0)}`,
              intent: 'date_best_trade',
              contextUpdate: { ...context, lastDate: targetDate, lastIntent: 'date_best_trade' }
            };
          }
        }

        // Full daily summary for exact date
        const wr = dailyStats.trades > 0 ? dailyStats.winRate.toFixed(1) : '0.0';
        return {
          text: `${dateInfo.friendly} (${dailyStats.dayName}):\n• Net P&L: ${this.formatCurrency(dailyStats.pnl)}\n• Trades: ${dailyStats.trades} (${dailyStats.wins}W / ${dailyStats.losses}L, ${wr}% WR)\n• Gross Profit: ${this.formatCurrency(dailyStats.grossProfit, false)} | Gross Loss: ${this.formatCurrency(dailyStats.grossLoss, false)}`,
          intent: 'exact_date_pnl',
          contextUpdate: { ...context, lastDate: targetDate, lastIntent: 'exact_date_pnl' }
        };
      }

      // G. MONTH QUERY (e.g. "How did I perform in September?", "September P&L", "Trades in August")
      if (dateInfo && dateInfo.type === 'month') {
        const monthStats = typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.getMonthStats(dateInfo.monthKey, trades) : null;
        if (!monthStats || monthStats.totalDays === 0) {
          return {
            text: `No trades are recorded for ${dateInfo.monthName} ${dateInfo.year} in the current dataset.`,
            intent: 'month_empty',
            contextUpdate: { ...context, lastMonth: dateInfo.monthKey, lastIntent: 'month_empty' }
          };
        }

        if (qLower.includes('best day')) {
          const bd = monthStats.bestDay;
          if (bd) {
            return {
              text: `Best day in ${dateInfo.monthName} ${dateInfo.year}: ${this.formatDateFriendly(bd.date)} (${this.formatCurrency(bd.pnl)}, ${bd.trades} trades).`,
              intent: 'month_best_day',
              contextUpdate: { ...context, lastMonth: dateInfo.monthKey, lastDate: bd.date, lastIntent: 'month_best_day' }
            };
          }
        }

        if (qLower.includes('how many trades') || qLower.includes('trade count')) {
          return {
            text: `${dateInfo.monthName} ${dateInfo.year}: ${monthStats.trades} total trades across ${monthStats.totalDays} trading days (${monthStats.wins}W / ${monthStats.losses}L).`,
            intent: 'month_trade_count',
            contextUpdate: { ...context, lastMonth: dateInfo.monthKey, lastIntent: 'month_trade_count' }
          };
        }

        const wr = monthStats.winRate.toFixed(1);
        return {
          text: `${dateInfo.monthName} ${dateInfo.year} Performance:\n• Net P&L: ${this.formatCurrency(monthStats.pnl)}\n• Total Trades: ${monthStats.trades} (${monthStats.wins}W / ${monthStats.losses}L, ${wr}% WR)\n• Active Trading Days: ${monthStats.totalDays}${monthStats.bestDay ? '\n• Best Day: ' + this.formatDateFriendly(monthStats.bestDay.date) + ' (' + this.formatCurrency(monthStats.bestDay.pnl) + ')' : ''}`,
          intent: 'month_stats',
          contextUpdate: { ...context, lastMonth: dateInfo.monthKey, lastIntent: 'month_stats' }
        };
      }

      // H. WEEKDAY QUERY (e.g. "What was my Monday P&L?", "What is my average Monday P&L?", "Which Monday was best?")
      if (dateInfo && dateInfo.type === 'weekday') {
        const wkStats = typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.getWeekdayStats(dateInfo.weekdayIndex, trades) : null;
        if (!wkStats || wkStats.totalDays === 0) {
          return {
            text: `No trading records found on ${dateInfo.weekdayName}s in the current dataset.`,
            intent: 'weekday_empty',
            contextUpdate: context
          };
        }

        // Which Monday was best
        if (dateInfo.isBest || qLower.includes('which ' + dateInfo.weekdayName.toLowerCase()) || qLower.includes('best ' + dateInfo.weekdayName.toLowerCase())) {
          const sorted = [...wkStats.days].sort((a, b) => b.pnl - a.pnl);
          const best = sorted[0];
          return {
            text: `Best ${dateInfo.weekdayName}: ${this.formatDateFriendly(best.date)}\n• Net P&L: ${this.formatCurrency(best.pnl)}\n• Trades: ${best.trades} (${best.wins}W / ${best.losses}L)`,
            intent: 'weekday_best_instance',
            contextUpdate: { ...context, lastDate: best.date, lastIntent: 'weekday_best_instance' }
          };
        }

        // Average or aggregate weekday
        const wr = wkStats.winRate.toFixed(1);
        return {
          text: `${dateInfo.weekdayName} Performance (${wkStats.totalDays} sessions):\n• Total P&L: ${this.formatCurrency(wkStats.pnl)}\n• Average P&L per ${dateInfo.weekdayName}: ${this.formatCurrency(wkStats.avgPnLPerDay)}\n• Trades: ${wkStats.trades} (${wkStats.wins}W / ${wkStats.losses}L, ${wr}% WR)`,
          intent: 'weekday_stats',
          contextUpdate: { ...context, lastIntent: 'weekday_stats' }
        };
      }

      // =========================================================================
      // 5. CONVERSATIONAL FOLLOW-UP CONTEXT RESOLUTION
      // =========================================================================

      const isFollowUpQuestion = (
        qLower === 'how many trades?' || qLower === 'how many trades' || qLower === 'trade count' || qLower === 'trades?' ||
        qLower === 'win rate?' || qLower === 'win rate' || qLower === 'what was my win rate?' || qLower === 'wr?' ||
        qLower === 'biggest loss?' || qLower === 'worst trade?' || qLower === 'biggest win?' || qLower === 'best trade?' ||
        qLower === 'net profit?' || qLower === 'pnl?' || qLower === 'profit?' || qLower === 'how much?'
      );

      if (isFollowUpQuestion) {
        // If user asked about a specific date previously
        if (context.lastDate) {
          const dailyStats = typeof TradeAnalytics !== 'undefined' ? TradeAnalytics.getDailyStats(context.lastDate, trades) : null;
          if (dailyStats) {
            const friendly = this.formatDateFriendly(context.lastDate);
            if (qLower.includes('how many') || qLower.includes('trade count') || qLower.includes('trades')) {
              return {
                text: `On ${friendly}, you took ${dailyStats.trades} trades (${dailyStats.wins} wins, ${dailyStats.losses} losses).`,
                intent: 'followup_date_trades',
                contextUpdate: context
              };
            }
            if (qLower.includes('win rate') || qLower.includes('wr')) {
              const wr = dailyStats.trades > 0 ? dailyStats.winRate.toFixed(1) : '0.0';
              return {
                text: `Win rate on ${friendly}: ${wr}% (${dailyStats.wins} wins / ${dailyStats.trades} trades).`,
                intent: 'followup_date_winrate',
                contextUpdate: context
              };
            }
            if (qLower.includes('loss') || qLower.includes('worst')) {
              const wt = dailyStats.worstTrade;
              return {
                text: wt ? `Worst trade on ${friendly}: ${wt.symbol} (${this.formatCurrency(wt.profit)}).` : `No losing trades on ${friendly}.`,
                intent: 'followup_date_worst',
                contextUpdate: context
              };
            }
            if (qLower.includes('win') || qLower.includes('best')) {
              const bt = dailyStats.bestTrade;
              return {
                text: bt ? `Best trade on ${friendly}: ${bt.symbol} (${this.formatCurrency(bt.profit)}).` : `No winning trades on ${friendly}.`,
                intent: 'followup_date_best',
                contextUpdate: context
              };
            }
            if (qLower.includes('profit') || qLower.includes('pnl') || qLower.includes('how much')) {
              return {
                text: `Net P&L on ${friendly}: ${this.formatCurrency(dailyStats.pnl)}.`,
                intent: 'followup_date_pnl',
                contextUpdate: context
              };
            }
          }
        }

        // If user asked about a symbol previously
        if (context.lastSymbol) {
          const symData = (m.symbolBreakdown || []).find(s => this.normalizeSymbol(s.symbol) === this.normalizeSymbol(context.lastSymbol));
          if (symData) {
            if (qLower.includes('how many') || qLower.includes('trade count') || qLower.includes('trades')) {
              return {
                text: `${symData.symbol}: ${symData.trades} trades (${symData.wins} wins, ${symData.losses} losses).`,
                intent: 'followup_symbol_trades',
                contextUpdate: context
              };
            }
            if (qLower.includes('win rate') || qLower.includes('wr')) {
              const wr = symData.trades > 0 ? ((symData.wins / symData.trades) * 100).toFixed(1) : '0.0';
              return {
                text: `${symData.symbol} Win Rate: ${wr}% (${symData.wins} wins / ${symData.trades} trades).`,
                intent: 'followup_symbol_winrate',
                contextUpdate: context
              };
            }
            if (qLower.includes('profit') || qLower.includes('pnl') || qLower.includes('how much')) {
              return {
                text: `${symData.symbol} Net P&L: ${this.formatCurrency(symData.pnl)}.`,
                intent: 'followup_symbol_pnl',
                contextUpdate: context
              };
            }
          }
        }
      }

      // =========================================================================
      // 6. SYMBOL COMPARISON & ANALYSIS
      // =========================================================================

      const isComparisonQuery = qLower.includes('compare') || qLower.includes('better') || qLower.includes('versus') || qLower.includes(' vs ') || qLower.endsWith(' vs') || qLower.includes('which one') || qLower.includes('which made more');
      if (isComparisonQuery) {
        let sym1 = mentionedSymbols[0];
        let sym2 = mentionedSymbols[1];

        if (!sym1 && !sym2 && context.lastSymbol && context.previousSymbol) {
          sym1 = context.previousSymbol;
          sym2 = context.lastSymbol;
        } else if (sym1 && !sym2 && context.lastSymbol && sym1 !== context.lastSymbol) {
          sym2 = context.lastSymbol;
        }

        if (sym1 && sym2 && sym1 !== sym2) {
          return this.handleSymbolComparison(sym1, sym2, m, context);
        }
      }

      const makeSymbolContext = (newSym, intentName) => {
        const prev = (context.lastSymbol && context.lastSymbol !== newSym) ? context.lastSymbol : (context.previousSymbol || null);
        return { ...context, previousSymbol: prev, lastSymbol: newSym, lastIntent: intentName };
      };

      if (mentionedSymbols.length === 1 || (context.lastSymbol && (qLower.includes('and ') || qLower.startsWith('what about') || qLower.startsWith('how about') || qLower.includes('that pair') || qLower.includes('that symbol')))) {
        const targetSym = mentionedSymbols[0] || context.lastSymbol;
        const symData = (m.symbolBreakdown || []).find(s => this.normalizeSymbol(s.symbol) === this.normalizeSymbol(targetSym));
        
        if (symData) {
          if (qLower.includes('win rate') || qLower.includes('win percentage') || qLower.includes('wr')) {
            const wr = symData.trades > 0 ? ((symData.wins / symData.trades) * 100).toFixed(1) : '0.0';
            return {
              text: `${symData.symbol} Win Rate: ${wr}% (${symData.wins} wins / ${symData.trades} trades).`,
              intent: 'symbol_win_rate',
              contextUpdate: makeSymbolContext(symData.symbol, 'symbol_win_rate')
            };
          }
          if (qLower.includes('profit') || qLower.includes('pnl') || qLower.includes('make') || qLower.includes('lose') || qLower.includes('loss')) {
            return {
              text: `${symData.symbol} Net PnL: ${this.formatCurrency(symData.pnl)} across ${symData.trades} trades.`,
              intent: 'symbol_pnl',
              contextUpdate: makeSymbolContext(symData.symbol, 'symbol_pnl')
            };
          }
          if (qLower.includes('how many trades') || qLower.includes('trade count') || qLower.includes('total trades')) {
            return {
              text: `${symData.symbol}: ${symData.trades} total trades (${symData.wins}W / ${symData.losses}L).`,
              intent: 'symbol_count',
              contextUpdate: makeSymbolContext(symData.symbol, 'symbol_count')
            };
          }

          const wr = symData.trades > 0 ? ((symData.wins / symData.trades) * 100).toFixed(1) : '0.0';
          return {
            text: `${symData.symbol}\nTrades: ${symData.trades}\nWin rate: ${wr}% (${symData.wins}W / ${symData.losses}L)\nNet PnL: ${this.formatCurrency(symData.pnl)}`,
            intent: 'symbol_summary',
            contextUpdate: makeSymbolContext(symData.symbol, 'symbol_summary')
          };
        }
      }

      // Best / Worst Symbol
      if (qLower.includes('best symbol') || qLower.includes('best pair') || qLower.includes('top symbol') || qLower.includes('most profitable symbol') || qLower.includes('which market performs best') || qLower.includes('highest win rate symbol')) {
        const sorted = [...(m.symbolBreakdown || [])].sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
        if (sorted.length > 0) {
          const best = sorted[0];
          const wr = best.trades > 0 ? ((best.wins / best.trades) * 100).toFixed(1) : '0.0';
          return {
            text: `Best symbol: ${best.symbol}\nNet PnL: ${this.formatCurrency(best.pnl)}\nWin rate: ${wr}% (${best.wins}W / ${best.trades} trades)`,
            intent: 'best_symbol',
            contextUpdate: { ...context, lastSymbol: best.symbol, lastIntent: 'best_symbol' }
          };
        }
      }

      if (qLower.includes('worst symbol') || qLower.includes('worst pair') || qLower.includes('least profitable symbol') || qLower.includes('which market performs worst') || qLower.includes('most losing symbol')) {
        const sorted = [...(m.symbolBreakdown || [])].sort((a, b) => (a.pnl || 0) - (b.pnl || 0));
        if (sorted.length > 0) {
          const worst = sorted[0];
          const wr = worst.trades > 0 ? ((worst.wins / worst.trades) * 100).toFixed(1) : '0.0';
          return {
            text: `Worst symbol: ${worst.symbol}\nNet PnL: ${this.formatCurrency(worst.pnl)}\nWin rate: ${wr}% (${worst.wins}W / ${worst.trades} trades)`,
            intent: 'worst_symbol',
            contextUpdate: { ...context, lastSymbol: worst.symbol, lastIntent: 'worst_symbol' }
          };
        }
      }

      if (qLower.includes('best and worst') || qLower.includes('best & worst') || qLower.includes('all symbols') || qLower.includes('symbol performance') || qLower.includes('symbols breakdown') || qLower.includes('list symbols') || qLower.includes('show symbols') || qLower.includes('performing symbols')) {
        const list = (m.symbolBreakdown || []).map(s => {
          const wr = s.trades > 0 ? ((s.wins / s.trades) * 100).toFixed(1) : '0.0';
          return `• ${s.symbol}: ${this.formatCurrency(s.pnl)} (${s.trades} trades, ${wr}% WR)`;
        }).join('\n');
        return {
          text: `Symbol Breakdown:\n${list || 'No symbol data.'}`,
          intent: 'all_symbols',
          contextUpdate: { ...context, lastIntent: 'all_symbols' }
        };
      }

      // =========================================================================
      // 7. CORE METRICS (WIN RATE, PROFIT FACTOR, P&L, STREAKS, ETC.)
      // =========================================================================

      // Win Rate / Winners / Losers
      if (qLower.includes('win rate') || qLower.includes('winning percentage') || qLower.includes('win percentage') || qLower.includes('how often do i win') || qLower.includes('wins vs losses') || qLower.includes('w/l ratio') || qLower.includes('losing percentage')) {
        const wr = m.winRate !== undefined ? m.winRate.toFixed(1) : '0.0';
        return {
          text: `Win rate: ${wr}%\n${m.winnersCount || 0} wins / ${m.losersCount || 0} losses / ${m.breakEvenCount || 0} break-even (${trades.length} total trades).`,
          intent: 'win_rate',
          contextUpdate: { ...context, lastIntent: 'win_rate' }
        };
      }

      if (qLower.includes('how many win') || qLower.includes('how many winning') || qLower.includes('number of winners') || qLower.includes('total winners')) {
        const pct = trades.length > 0 ? (((m.winnersCount || 0) / trades.length) * 100).toFixed(1) : '0.0';
        return {
          text: `Winning trades: ${m.winnersCount || 0} (${pct}% of ${trades.length} trades).`,
          intent: 'winners_count',
          contextUpdate: { ...context, lastIntent: 'winners_count' }
        };
      }

      if (qLower.includes('how many loss') || qLower.includes('how many losing') || qLower.includes('number of losers') || qLower.includes('total losers')) {
        const pct = trades.length > 0 ? (((m.losersCount || 0) / trades.length) * 100).toFixed(1) : '0.0';
        return {
          text: `Losing trades: ${m.losersCount || 0} (${pct}% of ${trades.length} trades).`,
          intent: 'losers_count',
          contextUpdate: { ...context, lastIntent: 'losers_count' }
        };
      }

      if (qLower.includes('break even') || qLower.includes('breakeven')) {
        return {
          text: `Break-even trades: ${m.breakEvenCount || 0} of ${trades.length} total trades.`,
          intent: 'breakeven_count',
          contextUpdate: { ...context, lastIntent: 'breakeven_count' }
        };
      }

      // Profit Factor
      if (qLower.includes('profit factor') || qLower === 'pf' || qLower.includes(' pf ') || qLower.endsWith(' pf') || qLower.includes('profit/loss ratio')) {
        const pf = m.profitFactor >= 99 ? '∞' : (m.profitFactor !== undefined ? m.profitFactor.toFixed(2) : 'N/A');
        return {
          text: `Profit factor: ${pf} (Gross profit: ${this.formatCurrency(m.grossProfit || 0, false)} / Gross loss: ${this.formatCurrency(m.grossLoss || 0, false)}).`,
          intent: 'profit_factor',
          contextUpdate: { ...context, lastIntent: 'profit_factor' }
        };
      }

      // Gross Profit / Loss / Net PnL
      if (qLower.includes('gross profit')) {
        return {
          text: `Gross profit: ${this.formatCurrency(m.grossProfit || 0, false)} across ${m.winnersCount || 0} winning trades.`,
          intent: 'gross_profit',
          contextUpdate: { ...context, lastIntent: 'gross_profit' }
        };
      }

      if (qLower.includes('gross loss')) {
        return {
          text: `Gross loss: ${this.formatCurrency(m.grossLoss || 0, false)} across ${m.losersCount || 0} losing trades.`,
          intent: 'gross_loss',
          contextUpdate: { ...context, lastIntent: 'gross_loss' }
        };
      }

      if (qClean.includes('net profit') || qClean.includes('net pnl') || qClean.includes('total profit') || qClean.includes('total pnl') || qClean.includes('what is my profit') || qClean.includes("what's my profit") || qClean.includes('how much did i make') || qClean.includes('how much have i made') || qClean.includes('how much money am i making') || qClean.includes('total money') || qClean.includes('pnl') || qClean.includes('total return') || qClean.includes('overall profit') || qClean.includes('all time profit')) {
        return {
          text: `Net profit: ${this.formatCurrency(m.totalPnL || 0)}.`,
          intent: 'net_pnl',
          contextUpdate: { ...context, lastIntent: 'net_pnl' }
        };
      }

      if (qLower.includes('am i profitable') || qLower.includes('am i in profit') || qLower.includes('profitable or not') || qLower.includes('in profit or loss')) {
        const isProfitable = (m.totalPnL || 0) >= 0;
        return {
          text: isProfitable
            ? `Yes, you are profitable with a Net PnL of ${this.formatCurrency(m.totalPnL)}.`
            : `Currently in drawdown with a Net PnL of ${this.formatCurrency(m.totalPnL)}.`,
          intent: 'profitability_status',
          contextUpdate: { ...context, lastIntent: 'profitability_status' }
        };
      }

      // Average Win / Loss / Trade
      if (qLower.includes('average win') || qLower.includes('avg win') || qLower.includes('make when i win')) {
        return {
          text: `Average win: ${this.formatCurrency(m.avgWin || 0, false)}.`,
          intent: 'avg_win',
          contextUpdate: { ...context, lastIntent: 'avg_win' }
        };
      }

      if (qLower.includes('average loss') || qLower.includes('avg loss') || qLower.includes('lose when i lose')) {
        return {
          text: `Average loss: ${this.formatCurrency(m.avgLoss || 0, false)}.`,
          intent: 'avg_loss',
          contextUpdate: { ...context, lastIntent: 'avg_loss' }
        };
      }

      if (qLower.includes('average trade') || qLower.includes('average pnl') || qLower.includes('average result') || qLower.includes('avg trade')) {
        const avgTrade = trades.length > 0 ? (m.totalPnL / trades.length) : 0;
        return {
          text: `Average trade: ${this.formatCurrency(avgTrade)} per trade (Avg win: ${this.formatCurrency(m.avgWin || 0, false)} / Avg loss: ${this.formatCurrency(m.avgLoss || 0, false)}).`,
          intent: 'avg_trade',
          contextUpdate: { ...context, lastIntent: 'avg_trade' }
        };
      }

      if (qLower.includes('risk to reward') || qLower.includes('risk reward') || qLower.includes('rr ratio') || qLower.includes('payoff ratio') || qLower.includes(' r:r ') || qLower.includes(' rr ')) {
        const rr = (m.avgLoss && m.avgLoss > 0) ? (m.avgWin / m.avgLoss).toFixed(2) : 'N/A';
        return {
          text: `Risk-to-reward payoff: ${rr}:1 (Avg win: ${this.formatCurrency(m.avgWin || 0, false)} / Avg loss: ${this.formatCurrency(m.avgLoss || 0, false)}).`,
          intent: 'risk_reward',
          contextUpdate: { ...context, lastIntent: 'risk_reward' }
        };
      }

      // Best / Worst Individual Trades
      if (qLower.includes('best trade') || qLower.includes('biggest winner') || qLower.includes('biggest win') || qLower.includes('largest profit') || qLower.includes('largest win') || qLower.includes('top win')) {
        const maxW = m.maxWinTrade || [...trades].sort((a, b) => (b.profit || 0) - (a.profit || 0))[0];
        if (maxW) {
          const sym = maxW.symbol || 'N/A';
          const pnl = this.formatCurrency(maxW.profit || 0);
          const type = (maxW.type || '').toUpperCase();
          const openTime = maxW.openTime ? maxW.openTime.slice(0, 16) : '';
          return {
            text: `Biggest winning trade:\n• Symbol: ${sym} ${type ? '(' + type + ')' : ''}\n• Profit: ${pnl}\n• Date: ${openTime || 'N/A'}`,
            intent: 'best_trade',
            contextUpdate: { ...context, lastSymbol: sym, lastIntent: 'best_trade' }
          };
        }
      }

      if (qLower.includes('worst trade') || qLower.includes('biggest loser') || qLower.includes('biggest loss') || qLower.includes('largest loss') || qLower.includes('top loss')) {
        const maxL = m.maxLossTrade || [...trades].sort((a, b) => (a.profit || 0) - (b.profit || 0))[0];
        if (maxL) {
          const sym = maxL.symbol || 'N/A';
          const pnl = this.formatCurrency(maxL.profit || 0);
          const type = (maxL.type || '').toUpperCase();
          const openTime = maxL.openTime ? maxL.openTime.slice(0, 16) : '';
          return {
            text: `Biggest losing trade:\n• Symbol: ${sym} ${type ? '(' + type + ')' : ''}\n• Loss: ${pnl}\n• Date: ${openTime || 'N/A'}`,
            intent: 'worst_trade',
            contextUpdate: { ...context, lastSymbol: sym, lastIntent: 'worst_trade' }
          };
        }
      }

      // Streaks
      if (qLower.includes('streak') || qLower.includes('in a row') || qLower.includes('consecutive')) {
        return {
          text: `Max winning streak: ${m.maxWinStreak || 0} consecutive wins\nMax losing streak: ${m.maxLossStreak || 0} consecutive losses`,
          intent: 'streaks',
          contextUpdate: { ...context, lastIntent: 'streaks' }
        };
      }

      // Expectancy
      if (qLower.includes('expectancy') || qLower.includes('expected profit') || qLower.includes('expected value')) {
        const exp = m.expectancy !== undefined ? m.expectancy : (trades.length > 0 ? (m.totalPnL / trades.length) : 0);
        return {
          text: `Trading expectancy: ${this.formatCurrency(exp)} per trade. On average, each trade you take yields ${this.formatCurrency(exp)}.`,
          intent: 'expectancy',
          contextUpdate: { ...context, lastIntent: 'expectancy' }
        };
      }

      // Total Trades
      if (qLower.includes('how many trades') || qLower.includes('total trades') || qLower.includes('number of trades') || qLower.includes('trade count') || qLower.includes('how active') || qLower.includes('dataset look like') || qLower.includes('dataset loaded') || qLower.includes('trades are loaded') || qLower.includes('do i have trades') || qLower.includes('have any trades')) {
        return {
          text: `Total trades loaded: ${trades.length} (${m.winnersCount || 0} wins, ${m.losersCount || 0} losses, ${m.breakEvenCount || 0} break-even).`,
          intent: 'total_trades',
          contextUpdate: { ...context, lastIntent: 'total_trades' }
        };
      }

      // Weekday Overview
      if (qLower.includes('weekday') || qLower.includes('day of week') || qLower.includes('which day is best') || qLower.includes('best day to trade')) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayStats = Object.keys(m.weekdayMap || {}).map(idx => ({
          name: dayNames[idx],
          pnl: m.weekdayMap[idx] || 0,
          trades: m.weekdayCount ? (m.weekdayCount[idx] || 0) : 0,
          wins: m.weekdayWins ? (m.weekdayWins[idx] || 0) : 0
        })).filter(d => d.trades > 0).sort((a, b) => b.pnl - a.pnl);

        if (dayStats.length > 0) {
          const best = dayStats[0];
          const worst = dayStats[dayStats.length - 1];
          const bestWR = best.trades > 0 ? ((best.wins / best.trades) * 100).toFixed(1) : '0.0';
          return {
            text: `Best trading day: ${best.name} (${this.formatCurrency(best.pnl)}, ${bestWR}% WR across ${best.trades} trades).\nWorst trading day: ${worst.name} (${this.formatCurrency(worst.pnl)}, ${worst.trades} trades).`,
            intent: 'weekday_analysis',
            contextUpdate: { ...context, lastIntent: 'weekday_analysis' }
          };
        }
      }

      // Trade Hold Time
      if (qLower.includes('hold time') || qLower.includes('holding time') || qLower.includes('trade duration') || qLower.includes('how long do i hold') || qLower.includes('longest trade') || qLower.includes('duration')) {
        const dur = m.durationMetrics || {};
        if (dur.avgDurationMs) {
          return {
            text: `Trade Duration:\n• Average hold time: ${this.formatDuration(dur.avgDurationMs)}\n• Average winning hold: ${this.formatDuration(dur.avgWinDurationMs)}\n• Average losing hold: ${this.formatDuration(dur.avgLossDurationMs)}`,
            intent: 'duration_analysis',
            contextUpdate: { ...context, lastIntent: 'duration_analysis' }
          };
        }
      }

      // Drawdown
      if (qLower.includes('drawdown') || qLower.includes('max dd') || qLower.includes('account fall')) {
        let peak = 0;
        let maxDd = 0;
        const ts = m.cumulativeTimeseries || [];
        if (ts.length > 0) {
          ts.forEach(pt => {
            if (pt.cumulativePnL > peak) peak = pt.cumulativePnL;
            const dd = peak - pt.cumulativePnL;
            if (dd > maxDd) maxDd = dd;
          });
          const maxDdFormatted = this.formatCurrency(maxDd, false);
          const maxDdPct = peak > 0 ? ((maxDd / peak) * 100).toFixed(1) : '0.0';
          return {
            text: `Maximum drawdown: ${maxDdFormatted} (${maxDdPct}% from peak equity).`,
            intent: 'drawdown',
            contextUpdate: { ...context, lastIntent: 'drawdown' }
          };
        }
      }

      // Direction (BUY vs SELL)
      if (qLower.includes('buy') || qLower.includes('sell') || qLower.includes('long') || qLower.includes('short') || qLower.includes('direction')) {
        let buyCount = 0, buyPnL = 0, buyWins = 0;
        let sellCount = 0, sellPnL = 0, sellWins = 0;

        trades.forEach(t => {
          const type = (t.type || '').toLowerCase();
          const pnl = t.profit || 0;
          if (type.includes('buy') || type.includes('long')) {
            buyCount++;
            buyPnL += pnl;
            if (pnl > 0) buyWins++;
          } else if (type.includes('sell') || type.includes('short')) {
            sellCount++;
            sellPnL += pnl;
            if (pnl > 0) sellWins++;
          }
        });

        if (buyCount > 0 || sellCount > 0) {
          const buyWR = buyCount > 0 ? ((buyWins / buyCount) * 100).toFixed(1) : '0.0';
          const sellWR = sellCount > 0 ? ((sellWins / sellCount) * 100).toFixed(1) : '0.0';
          return {
            text: `Direction Performance:\n• Buys: ${this.formatCurrency(buyPnL)} (${buyCount} trades, ${buyWR}% WR)\n• Sells: ${this.formatCurrency(sellPnL)} (${sellCount} trades, ${sellWR}% WR)`,
            intent: 'direction_analysis',
            contextUpdate: { ...context, lastIntent: 'direction_analysis' }
          };
        }
      }

      // Overall Summary / Performance
      if (qLower.includes('summary') || qLower.includes('overview') || qLower.includes('stats') || qLower.includes('audit') || qLower.includes('how am i doing') || qLower.includes('overall performance') || qLower.includes('performance') || qLower.includes('report') || qLower.includes('statistics')) {
        const wr = m.winRate !== undefined ? m.winRate.toFixed(1) : '0.0';
        const pf = m.profitFactor >= 99 ? '∞' : (m.profitFactor !== undefined ? m.profitFactor.toFixed(2) : 'N/A');
        const sorted = [...(m.symbolBreakdown || [])].sort((a, b) => (b.pnl || 0) - (a.pnl || 0));
        const best = sorted[0];

        return {
          text: `Trading Performance Summary:\n• Total Trades: ${trades.length}\n• Net PnL: ${this.formatCurrency(m.totalPnL || 0)}\n• Win Rate: ${wr}% (${m.winnersCount || 0}W / ${m.losersCount || 0}L)\n• Profit Factor: ${pf}\n• Expectancy: ${this.formatCurrency(m.expectancy || 0)} / trade${best ? '\n• Top Symbol: ' + best.symbol + ' (' + this.formatCurrency(best.pnl) + ')' : ''}`,
          intent: 'overview_summary',
          contextUpdate: { ...context, lastIntent: 'overview_summary' }
        };
      }

      // Biggest Problem / Weakness
      if (qLower.includes('problem') || qLower.includes('weakness') || qLower.includes('mistake') || qLower.includes('why am i losing')) {
        const maxL = m.maxLossTrade || [...trades].sort((a, b) => (a.profit || 0) - (b.profit || 0))[0];
        const sortedWorst = [...(m.symbolBreakdown || [])].sort((a, b) => (a.pnl || 0) - (b.pnl || 0));
        const worstSym = sortedWorst[0];

        return {
          text: `Objective Dataset Metrics:\n• Largest single loss: ${this.formatCurrency(m.maxLoss || (maxL ? maxL.profit : 0), false)}${maxL ? ' on ' + (maxL.symbol || 'N/A') : ''}\n• Max losing streak: ${m.maxLossStreak || 0} trades\n• Average loss: ${this.formatCurrency(m.avgLoss || 0, false)} vs average win: ${this.formatCurrency(m.avgWin || 0, false)}${worstSym && worstSym.pnl < 0 ? '\n• Most unprofitable symbol: ' + worstSym.symbol + ' (' + this.formatCurrency(worstSym.pnl) + ')' : ''}`,
          intent: 'objective_weakness',
          contextUpdate: { ...context, lastIntent: 'objective_weakness' }
        };
      }

      // Fallback
      return {
        text: "I can answer questions about specific dates (e.g. 'September 23 P&L'), weekdays, months, symbols, win rate, net profit, or best/worst days.",
        intent: 'unknown',
        contextUpdate: context
      };
    },

    /**
     * Handle Symbol Comparison
     */
    handleSymbolComparison(sym1, sym2, m, context) {
      const breakdown = m.symbolBreakdown || [];
      const s1 = breakdown.find(s => this.normalizeSymbol(s.symbol) === this.normalizeSymbol(sym1));
      const s2 = breakdown.find(s => this.normalizeSymbol(s.symbol) === this.normalizeSymbol(sym2));

      if (!s1 && !s2) {
        return {
          text: `Neither ${sym1} nor ${sym2} were found in your loaded trades.`,
          intent: 'symbol_comparison_empty',
          contextUpdate: context
        };
      }

      const formatSym = (s, name) => {
        if (!s) return `• ${name}: 0 trades in dataset`;
        const wr = s.trades > 0 ? ((s.wins / s.trades) * 100).toFixed(1) : '0.0';
        return `• ${s.symbol}: ${this.formatCurrency(s.pnl)} (${s.trades} trades, ${wr}% WR)`;
      };

      return {
        text: `Symbol Comparison:\n${formatSym(s1, sym1)}\n${formatSym(s2, sym2)}`,
        intent: 'symbol_comparison',
        contextUpdate: { ...context, lastSymbol: (s1 ? s1.symbol : sym1), lastIntent: 'symbol_comparison' }
      };
    },

    /**
     * Handle basic conversational greetings and capability questions
     */
    handleGreetings(qLower) {
      if (qLower === 'hi' || qLower === 'hello' || qLower === 'hey' || qLower === 'hey fourge' || qLower === 'hi fourge' || qLower === 'hello fourge' || qLower.startsWith('good morning') || qLower.startsWith('good afternoon') || qLower.startsWith('good evening')) {
        return "Hey. I'm Fourge AI. I can analyze your loaded trade data locally. Ask me about specific dates, PnL, win rate, symbols, streaks, expectancy, or trade counts.";
      }

      if (qLower.includes('who are you') || qLower.includes('what can you do') || qLower.includes('what do you know') || qLower.includes('help') || qLower.includes('what can i ask') || qLower === 'commands') {
        return "I can analyze your loaded trades — exact dates (e.g. 'September 23 P&L'), weekdays, months, PnL, win rate, profit factor, winners/losers, symbols, streaks, expectancy, duration, and more.";
      }

      if (qLower.includes('are you online') || qLower.includes('are you offline') || qLower.includes('can you analyze my trades')) {
        return "I am currently analyzing your trade data deterministically using TradeForge's quantitative dataset engine.";
      }

      return null;
    }
  };

  // Export to global scope
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineStrategyEngine;
  }
  if (typeof window !== 'undefined') {
    window.OfflineStrategyEngine = OfflineStrategyEngine;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.OfflineStrategyEngine = OfflineStrategyEngine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
