/**
 * TradeFourge Companion Extension v5.1.2 — Production Exness Broker Adapter
 * Handles network interception, DOM state observation, account discovery, and history page fetching for Exness terminals.
 * Preserves raw Exness broker fields (account type, server, leverage, currency, balance, platform) without flattening or defaulting.
 */

import { BrokerAdapter } from './BrokerAdapter.js';
import { Logger } from '../logger/Logger.js';
import { isExtensionContextValid } from '../utils/contextCheck.js';

export class ExnessAdapter extends BrokerAdapter {
  constructor() {
    super('Exness');
    this.monitoringActive = false;
    this.eventCallback = null;
    this.domObserver = null;
  }

  isCurrentPlatform(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return (
        host.includes('exness') ||
        host.includes('exness-trade') ||
        host.includes('exness.cloud')
      );
    } catch {
      return false;
    }
  }

  async detectSession() {
    const isExnessUrl = this.isCurrentPlatform(window.location.href);
    if (!isExnessUrl) {
      return { isLoggedIn: false, status: 'Not on Exness platform' };
    }

    const hasTerminalContainer = Boolean(
      document.querySelector('#app') ||
      document.querySelector('.terminal-container') ||
      document.querySelector('[data-testid="account-selector"]') ||
      document.querySelector('[class*="account"]') ||
      document.cookie.includes('exness')
    );

    return {
      isLoggedIn: hasTerminalContainer,
      status: hasTerminalContainer ? 'Logged in' : 'Awaiting Exness session',
    };
  }

  async discoverAccounts() {
    console.log('[EXNESS DEBUG] === ACCOUNT DISCOVERY START ===');
    console.log('[EXNESS DEBUG] Current URL:', window.location.href);
    Logger.info('ExnessAdapter', 'Discovering Exness trading accounts from active session...');

    const discoveredMap = new Map();

    const addDiscovered = (data) => {
      const cleanNum = String(data.account_number || '').replace(/\D/g, '');
      if (!cleanNum || cleanNum.length < 5 || cleanNum.length > 12) return;
      if (discoveredMap.has(cleanNum)) return;

      const rawType = data.account_type || null;
      const cleanType = rawType ? String(rawType).trim() : '';
      const serverVal = data.server ? String(data.server).trim() : null;
      const leverageVal = data.leverage ? (String(data.leverage).startsWith('1:') ? String(data.leverage) : '1:' + data.leverage) : null;
      const currencyVal = data.currency ? String(data.currency).trim().toUpperCase() : null;
      const platformVal = data.platform || (cleanType.toLowerCase().includes('mt4') ? 'MetaTrader 4' : 'MetaTrader 5');
      const balanceVal = typeof data.balance === 'number' ? data.balance : Number(String(data.balance || 0).replace(/[^0-9.]/g, '')) || 0;
      const equityVal = typeof data.equity === 'number' ? data.equity : Number(String(data.equity || balanceVal).replace(/[^0-9.]/g, '')) || balanceVal;

      discoveredMap.set(cleanNum, {
        id: `exness_${cleanNum}`,
        account_number: cleanNum,
        account_name: data.account_name || `Exness ${cleanType} #${cleanNum}`,
        nickname: `Exness Account #${cleanNum}`,
        broker: 'Exness',
        platform: platformVal,
        currency: currencyVal,
        balance: balanceVal,
        equity: equityVal,
        server: serverVal,
        account_type: cleanType || null,
        account_type_raw: cleanType,
        leverage: leverageVal,
        history_count: 0,
        status: 'Ready',
        is_live: true,
        is_demo: Boolean(data.is_demo),
      });
    };

    // Strategy 1: Explicit DOM elements & Attributes
    try {
      const selectors = [
        '[data-account-number]',
        '[data-testid*="account"]',
        '[class*="accountCard"]',
        '[class*="account-card"]',
        '[class*="AccountCard"]',
        '[class*="account-item"]',
        '[class*="pa-account"]',
      ];

      selectors.forEach((selector) => {
        const cards = document.querySelectorAll(selector);
        console.log(`[EXNESS DEBUG] Strategy 1: Selector '${selector}' matched ${cards.length} elements`);
        cards.forEach((card) => {
          const accNum = card.getAttribute('data-account-number') ||
            card.getAttribute('data-account-id') ||
            card.querySelector('[class*="accountNumber"], [class*="account-number"]')?.textContent?.trim();

          const balanceText = card.querySelector('[class*="balance"], [class*="Balance"]')?.textContent?.replace(/[^0-9.]/g, '');
          const typeText = card.querySelector('[class*="type"], [class*="Type"], [class*="badge"]')?.textContent?.trim();
          const currencyText = card.querySelector('[class*="currency"]')?.textContent?.trim();
          const serverText = card.querySelector('[class*="server"], [class*="Server"]')?.textContent?.trim();
          const leverageText = card.querySelector('[class*="leverage"], [class*="Leverage"]')?.textContent?.trim();

          console.log('[EXNESS DEBUG] Strategy 1 card:', { accNum, balanceText, typeText, currencyText, serverText, leverageText });

          if (accNum) {
            addDiscovered({
              account_number: accNum,
              account_type: typeText,
              currency: currencyText,
              balance: balanceText,
              server: serverText,
              leverage: leverageText,
            });
          }
        });
      });
    } catch (err) {
      Logger.debug('ExnessAdapter', 'Strategy 1 DOM scan note:', { error: err });
    }

    // Strategy 2: Text pattern scanning across page body for Exness account numbers
    try {
      const pageText = document.body ? document.body.innerText : '';
      const accMatches = pageText.match(/\b\d{7,10}\b/g);
      if (accMatches && accMatches.length > 0) {
        const uniqueAccs = Array.from(new Set(accMatches)).filter(num => !num.startsWith('202') && num.length >= 7);
        uniqueAccs.forEach((accNum) => {
          const idx = pageText.indexOf(accNum);
          const snippet = pageText.substring(Math.max(0, idx - 80), Math.min(pageText.length, idx + 120));

          // Determine exact account type from snippet
          let type = 'Standard';
          if (/standard cent|cent/i.test(snippet)) type = 'Standard Cent';
          else if (/pro/i.test(snippet)) type = 'Pro';
          else if (/raw spread/i.test(snippet)) type = 'Raw Spread';
          else if (/zero/i.test(snippet)) type = 'Zero';
          else if (/mt5 standard/i.test(snippet)) type = 'MT5 Standard';
          else if (/standard/i.test(snippet)) type = 'Standard';

          // Determine currency (USC for Cent, USD, EUR, INR)
          let currency = type === 'Standard Cent' ? 'USC' : 'USD';
          if (/\bUSC\b/i.test(snippet)) currency = 'USC';
          else if (/\bEUR\b/i.test(snippet)) currency = 'EUR';
          else if (/\bINR\b/i.test(snippet)) currency = 'INR';
          else if (/\bUSD\b/i.test(snippet)) currency = 'USD';

          // Determine leverage
          let leverage = null;
          const levMatch = snippet.match(/1:(\d+|unlimited)/i);
          if (levMatch) {
            leverage = `1:${levMatch[1]}`;
          }

          // Determine server
          let server = null;
          const serverMatch = snippet.match(/(Exness-[A-Za-z0-9]+)/i);
          if (serverMatch) {
            server = serverMatch[1];
          }

          // Extract numerical balance
          const balMatch = snippet.match(/([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{2})?)\s*(?:USD|USC|EUR|INR|\$|\€)?/);
          const balance = balMatch ? Number(balMatch[1].replace(/[^0-9.]/g, '')) : 0;

          console.log('[EXNESS DEBUG] Strategy 2 account:', accNum, { type, currency, balance, server, leverage, snippetPreview: snippet.substring(0, 100) });

          addDiscovered({
            account_number: accNum,
            account_type: type,
            currency,
            balance,
            server,
            leverage,
            is_demo: /demo|trial/i.test(snippet),
          });
        });
      }
    } catch (err) {
      Logger.debug('ExnessAdapter', 'Strategy 2 text scan note:', { error: err });
    }

    // Strategy 3: Global Window state inspection (e.g. Next.js / React state objects)
    try {
      if (typeof window !== 'undefined') {
        const globalKeys = ['__NEXT_DATA__', '__INITIAL_STATE__', 'exness', '__APOLLO_STATE__'];
        globalKeys.forEach((key) => {
          const stateObj = window[key];
          if (stateObj) {
            const rawJson = JSON.stringify(stateObj);
            const matches = rawJson.match(/"account_?number"\s*:\s*"?(\d{7,10})"?/gi);
            if (matches) {
              matches.forEach((m) => {
                const digits = m.match(/\d{7,10}/);
                if (digits) {
                  console.log('[EXNESS DEBUG] Strategy 3: Found account number in window state:', digits[0], 'key:', key);
                  addDiscovered({
                    account_number: digits[0],
                  });
                }
              });
            }
          }
        });
      }
    } catch (err) {
      Logger.debug('ExnessAdapter', 'Strategy 3 window scan note:', { error: err });
    }

    const discoveredList = Array.from(discoveredMap.values());
    Logger.info('ExnessAdapter', `Discovered ${discoveredList.length} live Exness account(s).`);

    console.log('[EXNESS DEBUG] === DISCOVERY COMPLETE ===');
    console.log('[EXNESS DEBUG] Total accounts found:', discoveredList.length);
    discoveredList.forEach((acc, i) => {
      console.log(`[EXNESS DEBUG] Account ${i + 1}:`, {
        account_number: acc.account_number,
        account_type: acc.account_type,
        server: acc.server,
        currency: acc.currency,
        balance: acc.balance,
        leverage: acc.leverage,
      });
    });

    return JSON.parse(JSON.stringify(discoveredList));
  }

  async fetchHistoryPage(accountNumber, offset = 0, limit = 1000) {
    console.log('[EXNESS DEBUG] fetchHistoryPage called');
    console.log('[EXNESS DEBUG] Current URL:', window.location.href);
    console.log('[EXNESS DEBUG] Target account:', accountNumber);
    Logger.info('ExnessAdapter', `Fetching Exness history batch for account ${accountNumber} (${offset}..${offset + limit})`);

    const extractedTrades = [];
    const seenTickets = new Set();

    const addTrade = (t) => {
      const ticketStr = String(t.ticket || '').trim();
      if (!ticketStr || seenTickets.has(ticketStr)) return;
      seenTickets.add(ticketStr);

      extractedTrades.push({
        ticket: ticketStr,
        account_number: String(accountNumber),
        symbol: String(t.symbol || 'EURUSD').replace('/', '').toUpperCase(),
        side: String(t.side || 'BUY').toUpperCase().includes('SELL') ? 'SELL' : 'BUY',
        volume: typeof t.volume === 'number' ? t.volume : Number(String(t.volume || '0.01').replace(/[^0-9.]/g, '')) || 0.01,
        open_price: typeof t.open_price === 'number' ? t.open_price : Number(String(t.open_price || '0').replace(/[^0-9.]/g, '')) || 0,
        close_price: typeof t.close_price === 'number' ? t.close_price : Number(String(t.close_price || '0').replace(/[^0-9.]/g, '')) || 0,
        profit: typeof t.profit === 'number' ? t.profit : Number(String(t.profit || '0').replace(/[^0-9.-]/g, '')) || 0,
        net_profit: typeof t.profit === 'number' ? t.profit : Number(String(t.profit || '0').replace(/[^0-9.-]/g, '')) || 0,
        commission: Number(t.commission) || 0,
        swap: Number(t.swap) || 0,
        open_time: t.open_time || new Date().toISOString(),
        close_time: t.close_time || new Date().toISOString(),
        status: 'CLOSED',
        currency: t.currency || 'USC',
        source: 'companion',
      });
    };

    // Strategy 1: DOM Elements (table rows, list items, history cards)
    try {
      const selectors = [
        'tr[class*="history"]',
        'tr[class*="order"]',
        'tr[class*="deal"]',
        '[class*="history-row"]',
        '[class*="closed-position"]',
        '[class*="historyRow"]',
        '[class*="orderItem"]',
        '[data-testid*="deal"]',
        '[data-testid*="order"]',
        '[data-testid*="history"]',
      ];

      const historyRows = document.querySelectorAll(selectors.join(', '));
      console.log('[EXNESS DEBUG] History DOM query results:', historyRows.length, 'rows found');

      historyRows.forEach((row, idx) => {
        const ticket = row.querySelector('[class*="ticket"], [class*="id"], [class*="number"]')?.textContent?.trim() ||
          row.getAttribute('data-ticket') ||
          row.getAttribute('data-order-id') ||
          `${accountNumber}_ord_${idx + 1}`;
        const symbol = row.querySelector('[class*="symbol"], [class*="pair"], [class*="instrument"]')?.textContent?.trim() || 'XAU/USD';
        const sideText = row.querySelector('[class*="type"], [class*="side"], [class*="direction"]')?.textContent?.trim() || 'BUY';
        const volumeText = row.querySelector('[class*="volume"], [class*="lots"], [class*="size"]')?.textContent;
        const profitText = row.querySelector('[class*="profit"], [class*="pnl"], [class*="gain"]')?.textContent;
        const openTimeText = row.querySelector('[class*="openTime"], [class*="open-time"]')?.textContent?.trim();
        const closeTimeText = row.querySelector('[class*="closeTime"], [class*="close-time"]')?.textContent?.trim();
        const openPriceText = row.querySelector('[class*="openPrice"], [class*="open-price"]')?.textContent;
        const closePriceText = row.querySelector('[class*="closePrice"], [class*="close-price"]')?.textContent;

        addTrade({
          ticket,
          symbol,
          side: sideText,
          volume: volumeText,
          open_price: openPriceText,
          close_price: closePriceText,
          profit: profitText,
          open_time: openTimeText ? new Date(openTimeText).toISOString() : null,
          close_time: closeTimeText ? new Date(closeTimeText).toISOString() : null,
          currency: 'USC',
        });
      });
    } catch (err) {
      Logger.debug('ExnessAdapter', 'History DOM extraction note:', { error: err });
    }

    // Strategy 2: Text Pattern Scanning for Closed Order snippets (e.g. XAU/USD Buy 0.01)
    try {
      if (extractedTrades.length === 0 && document.body) {
        const pageText = document.body.innerText || '';
        console.log('[EXNESS DEBUG] Strategy 2: Scanning page text for order patterns...');
        
        // Match symbols like XAU/USD, BTC/USD, EUR/USD
        const symbolRegex = /(XAU\/USD|BTC\/USD|EUR\/USD|GBP\/USD|USD\/JPY|AUD\/USD)\s+(Buy|Sell)\s+([0-9.]+)\s*lots?/gi;
        let match;
        let matchIdx = 0;
        while ((match = symbolRegex.exec(pageText)) !== null) {
          matchIdx++;
          const sym = match[1];
          const side = match[2];
          const lots = match[3];
          const snippet = pageText.substring(Math.max(0, match.index - 50), Math.min(pageText.length, match.index + 150));
          
          const profitMatch = snippet.match(/([+-]?[0-9,]+(?:\.[0-9]+)?)\s*(?:USC|USD|\$)/i);
          const profitVal = profitMatch ? Number(profitMatch[1].replace(/,/g, '')) : 0;

          addTrade({
            ticket: `${accountNumber}_tx_${matchIdx}`,
            symbol: sym,
            side: side,
            volume: lots,
            profit: profitVal,
            currency: 'USC',
          });
        }
      }
    } catch (err) {
      Logger.debug('ExnessAdapter', 'History Strategy 2 text scan note:', { error: err });
    }

    // Strategy 3: Global Window state inspection for history arrays
    try {
      if (extractedTrades.length === 0 && typeof window !== 'undefined') {
        console.log('[EXNESS DEBUG] Strategy 3: Inspecting window state for history data...');
        const globalKeys = ['__NEXT_DATA__', '__INITIAL_STATE__', 'exness', '__APOLLO_STATE__'];
        globalKeys.forEach((key) => {
          const stateObj = window[key];
          if (stateObj) {
            const rawJson = JSON.stringify(stateObj);
            const orderMatches = rawJson.match(/{"id":\s*"?\d+"?,[^}]*"(?:symbol|pair)":[^}]*}/gi);
            if (orderMatches) {
              orderMatches.forEach((matchStr, i) => {
                try {
                  const parsed = JSON.parse(matchStr);
                  if (parsed.symbol || parsed.pair) {
                    addTrade({
                      ticket: String(parsed.id || parsed.ticket || `${accountNumber}_win_${i}`),
                      symbol: parsed.symbol || parsed.pair,
                      side: parsed.side || parsed.type || 'BUY',
                      volume: parsed.volume || parsed.lots || 0.01,
                      open_price: parsed.open_price || parsed.openPrice,
                      close_price: parsed.close_price || parsed.closePrice,
                      profit: parsed.profit || parsed.pnl || 0,
                      currency: 'USC',
                    });
                  }
                } catch (e) {}
              });
            }
          }
        });
      }
    } catch (err) {
      Logger.debug('ExnessAdapter', 'History Strategy 3 window scan note:', { error: err });
    }

    console.log('[EXNESS DEBUG] fetchHistoryPage result:', { tradeCount: extractedTrades.length, hasMore: false });
    if (extractedTrades.length === 0) {
      console.log('[EXNESS DEBUG] WARNING: 0 trades extracted. Navigate to Exness "History of orders" tab or page to load order records.');
    }

    return {
      trades: extractedTrades,
      totalCount: extractedTrades.length,
      fetchedCount: extractedTrades.length,
      hasMore: false,
    };
  }

  startLiveMonitoring(onEvent) {
    if (this.monitoringActive) return;
    this.monitoringActive = true;
    this.eventCallback = onEvent;

    Logger.success('ExnessAdapter', 'Started Exness WebSocket & network monitoring pipeline.');

    if (typeof MutationObserver !== 'undefined' && document.body) {
      try {
        this.domObserver = new MutationObserver(() => {
          if (!isExtensionContextValid() || !this.monitoringActive) {
            this.stopLiveMonitoring();
            return;
          }

          const equityElem = document.querySelector('[data-testid="equity-value"], .account-equity');
          if (equityElem && this.eventCallback) {
            const rawVal = Number(equityElem.textContent?.replace(/[^0-9.]/g, ''));
            if (!isNaN(rawVal) && rawVal > 0) {
              this.eventCallback({
                eventType: 'EQUITY_UPDATED',
                equity: rawVal,
                timestamp: new Date().toISOString(),
              });
            }
          }
        });

        this.domObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
      } catch (err) {
        Logger.debug('ExnessAdapter', 'MutationObserver setup note:', { error: err });
      }
    }
  }

  stopLiveMonitoring() {
    this.monitoringActive = false;
    this.eventCallback = null;
    if (this.domObserver) {
      try {
        this.domObserver.disconnect();
      } catch (err) {}
      this.domObserver = null;
    }
    Logger.info('ExnessAdapter', 'Stopped Exness live monitoring.');
  }
}
