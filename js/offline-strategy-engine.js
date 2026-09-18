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
      const absVal = Math.abs(val || 0).toFixed(2);
      if (val < 0) return `-$${absVal}`;
      if (withSign && val > 0) return `+$${absVal}`;
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
        // Word boundary or containment check
        const regex = new RegExp(`\\b${alias}\\b`, 'i');
        if (regex.test(lower)) {
          // Check if dataset has this canonical symbol or a variation
          const found = availableSymbols.find(s => s.toUpperCase().startsWith(canonical) || canonical.startsWith(s.toUpperCase()));
          const toAdd = found ? found.toUpperCase() : canonical;
          if (!matched.includes(toAdd)) matched.push(toAdd);
        }
      }

      return matched;
    },

    /**
     * Main evaluation entry point
     * @param {string} query - The user question
     * @param {Array} trades - Array of trade objects
     * @param {Object} metricsCache - Pre-calculated metrics or null
     * @param {Object} context - Optional conversational context { lastSymbol, lastIntent, ... }
     * @returns {Object} { text: string, intent: string, contextUpdate: Object }
     */
    evaluate(query, trades = [], metricsCache = null, context = {}) {
      const q = (query || '').trim();
      const qLower = q.toLowerCase();
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

      // 4. SYMBOL COMPARISON
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

      // Helper to generate context update with previousSymbol tracking
      const makeSymbolContext = (newSym, intentName) => {
        const prev = (context.lastSymbol && context.lastSymbol !== newSym) ? context.lastSymbol : (context.previousSymbol || null);
        return { ...context, previousSymbol: prev, lastSymbol: newSym, lastIntent: intentName };
      };

      // 5. SPECIFIC SYMBOL INQUIRY
      if (mentionedSymbols.length === 1 || (context.lastSymbol && (qLower.includes('and ') || qLower.startsWith('what about') || qLower.startsWith('how about') || qLower.includes('that pair') || qLower.includes('that symbol')))) {
        const targetSym = mentionedSymbols[0] || context.lastSymbol;
        const symData = (m.symbolBreakdown || []).find(s => this.normalizeSymbol(s.symbol) === this.normalizeSymbol(targetSym));
        
        if (symData) {
          // If asking a specific metric for this symbol (e.g. win rate on gold, profit on gold)
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

          // General symbol summary
          const wr = symData.trades > 0 ? ((symData.wins / symData.trades) * 100).toFixed(1) : '0.0';
          return {
            text: `${symData.symbol}\nTrades: ${symData.trades}\nWin rate: ${wr}% (${symData.wins}W / ${symData.losses}L)\nNet PnL: ${this.formatCurrency(symData.pnl)}`,
            intent: 'symbol_summary',
            contextUpdate: makeSymbolContext(symData.symbol, 'symbol_summary')
          };
        }
      }

      // 6. GENERAL BEST / WORST SYMBOL
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

      // 7. WIN RATE / WINNERS / LOSERS / BREAK-EVEN
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

      // 8. PROFIT FACTOR
      if (qLower.includes('profit factor') || qLower === 'pf' || qLower.includes(' pf ') || qLower.endsWith(' pf') || qLower.includes('profit/loss ratio')) {
        const pf = m.profitFactor >= 99 ? '∞' : (m.profitFactor !== undefined ? m.profitFactor.toFixed(2) : 'N/A');
        return {
          text: `Profit factor: ${pf} (Gross profit: ${this.formatCurrency(m.grossProfit || 0, false)} / Gross loss: ${this.formatCurrency(m.grossLoss || 0, false)}).`,
          intent: 'profit_factor',
          contextUpdate: { ...context, lastIntent: 'profit_factor' }
        };
      }

      // 9. PROFIT / LOSS / PNL
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

      if (qLower.includes('net profit') || qLower.includes('net pnl') || qLower.includes('total profit') || qLower.includes('total pnl') || qLower.includes('what is my profit') || qLower.includes("what's my profit") || qLower.includes('how much did i make') || qLower.includes('how much have i made') || qLower.includes('how much money am i making') || qLower.includes('total money') || qLower.includes('pnl')) {
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

      // 10. AVERAGE WIN / LOSS / AVERAGE TRADE
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

      // 11. BEST / WORST TRADES
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

      // 12. STREAKS
      if (qLower.includes('streak') || qLower.includes('in a row') || qLower.includes('consecutive')) {
        return {
          text: `Max winning streak: ${m.maxWinStreak || 0} consecutive wins\nMax losing streak: ${m.maxLossStreak || 0} consecutive losses`,
          intent: 'streaks',
          contextUpdate: { ...context, lastIntent: 'streaks' }
        };
      }

      // 13. EXPECTANCY
      if (qLower.includes('expectancy') || qLower.includes('expected profit') || qLower.includes('expected value')) {
        const exp = m.expectancy !== undefined ? m.expectancy : (trades.length > 0 ? (m.totalPnL / trades.length) : 0);
        return {
          text: `Trading expectancy: ${this.formatCurrency(exp)} per trade. On average, each trade you take yields ${this.formatCurrency(exp)}.`,
          intent: 'expectancy',
          contextUpdate: { ...context, lastIntent: 'expectancy' }
        };
      }

      // 14. TOTAL TRADES / DATASET COUNT
      if (qLower.includes('how many trades') || qLower.includes('total trades') || qLower.includes('number of trades') || qLower.includes('trade count') || qLower.includes('how active') || qLower.includes('dataset look like') || qLower.includes('dataset loaded') || qLower.includes('trades are loaded') || qLower.includes('do i have trades') || qLower.includes('have any trades')) {
        return {
          text: `Total trades loaded: ${trades.length} (${m.winnersCount || 0} wins, ${m.losersCount || 0} losses, ${m.breakEvenCount || 0} break-even).`,
          intent: 'total_trades',
          contextUpdate: { ...context, lastIntent: 'total_trades' }
        };
      }

      // 15. TIME / WEEKDAY PERFORMANCE
      if (qLower.includes('weekday') || qLower.includes('day of week') || qLower.includes('which day') || qLower.includes('best day') || qLower.includes('worst day') || qLower.includes('monday') || qLower.includes('tuesday') || qLower.includes('wednesday') || qLower.includes('thursday') || qLower.includes('friday')) {
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
        return {
          text: 'Weekday performance data is not available in the current dataset.',
          intent: 'weekday_analysis',
          contextUpdate: context
        };
      }

      // 16. TRADE HOLD TIME & DURATION
      if (qLower.includes('hold time') || qLower.includes('holding time') || qLower.includes('trade duration') || qLower.includes('how long do i hold') || qLower.includes('longest trade') || qLower.includes('duration')) {
        const dur = m.durationMetrics || {};
        if (dur.avgDurationMs) {
          return {
            text: `Trade Duration:\n• Average hold time: ${this.formatDuration(dur.avgDurationMs)}\n• Average winning hold: ${this.formatDuration(dur.avgWinDurationMs)}\n• Average losing hold: ${this.formatDuration(dur.avgLossDurationMs)}`,
            intent: 'duration_analysis',
            contextUpdate: { ...context, lastIntent: 'duration_analysis' }
          };
        }
        return {
          text: 'Trade hold time data is not available (open/close timestamps missing).',
          intent: 'duration_analysis',
          contextUpdate: context
        };
      }

      // 17. DRAWDOWN
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
        return {
          text: "Drawdown data isn't available in the current dataset.",
          intent: 'drawdown',
          contextUpdate: context
        };
      }

      // 18. DIRECTION (BUY VS SELL)
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

      // 19. OVERALL SUMMARY / AUDIT / STATS / "HOW AM I DOING?"
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

      // 20. OBJECTIVE "BIGGEST PROBLEM / WEAKNESS"
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

      // 21. UNKNOWN / UNSUPPORTED QUESTION FALLBACK
      return {
        text: "Offline Mode can answer trade statistics and dataset questions.\nTry: 'What's my win rate?', 'What's my net profit?', or 'How is XAUUSD performing?'",
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
        return "Hey. I'm Fourge AI in Offline Mode. I can analyze your loaded trade data locally. Ask me about PnL, win rate, symbols, streaks, expectancy, or trade counts.";
      }

      if (qLower.includes('who are you') || qLower.includes('what can you do') || qLower.includes('what do you know') || qLower.includes('help') || qLower.includes('what can i ask') || qLower === 'commands') {
        return "I can analyze your loaded trades locally — PnL, win rate, profit factor, winners/losers, symbols, streaks, expectancy, duration, and more.";
      }

      if (qLower.includes('are you online') || qLower.includes('are you offline') || qLower.includes('can you analyze my trades')) {
        return "I am currently running in Offline Mode, analyzing your trade data locally without internet or external AI APIs.";
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
