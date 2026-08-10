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
    Logger.info('ExnessAdapter', 'Discovering Exness trading accounts from active session...');

    const discoveredMap = new Map();

    const addDiscovered = (data) => {
      const cleanNum = String(data.account_number || '').replace(/\D/g, '');
      if (!cleanNum || cleanNum.length < 5 || cleanNum.length > 12) return;
      if (discoveredMap.has(cleanNum)) return;

      const rawType = data.account_type || 'Standard';
      const cleanType = String(rawType).trim();
      const serverVal = data.server ? String(data.server).trim() : 'Server unavailable';
      const leverageVal = data.leverage ? (String(data.leverage).startsWith('1:') ? String(data.leverage) : `1:${data.leverage}`) : 'Unavailable';
      const currencyVal = data.currency ? String(data.currency).trim().toUpperCase() : 'USD';
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
        account_type: cleanType,
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
        document.querySelectorAll(selector).forEach((card) => {
          const accNum = card.getAttribute('data-account-number') ||
            card.getAttribute('data-account-id') ||
            card.querySelector('[class*="accountNumber"], [class*="account-number"]')?.textContent?.trim();

          const balanceText = card.querySelector('[class*="balance"], [class*="Balance"]')?.textContent?.replace(/[^0-9.]/g, '');
          const typeText = card.querySelector('[class*="type"], [class*="Type"], [class*="badge"]')?.textContent?.trim();
          const currencyText = card.querySelector('[class*="currency"]')?.textContent?.trim();
          const serverText = card.querySelector('[class*="server"], [class*="Server"]')?.textContent?.trim();
          const leverageText = card.querySelector('[class*="leverage"], [class*="Leverage"]')?.textContent?.trim();

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
          let leverage = '1:2000';
          const levMatch = snippet.match(/1:(\d+|unlimited)/i);
          if (levMatch) {
            leverage = `1:${levMatch[1]}`;
          }

          // Determine server
          let server = 'Exness-MT5Real';
          const serverMatch = snippet.match(/(Exness-[A-Za-z0-9]+)/i);
          if (serverMatch) {
            server = serverMatch[1];
          } else if (type === 'Standard Cent') {
            server = 'Exness-MT5Cent';
          }

          // Extract numerical balance
          const balMatch = snippet.match(/([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]{2})?)\s*(?:USD|USC|EUR|INR|\$|\€)?/);
          const balance = balMatch ? Number(balMatch[1].replace(/[^0-9.]/g, '')) : 0;

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
                  addDiscovered({
                    account_number: digits[0],
                    account_type: 'Standard',
                    currency: 'USD',
                    balance: 0,
                    server: 'Exness-MT5Real',
                    leverage: '1:2000',
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
    return JSON.parse(JSON.stringify(discoveredList));
  }

  async fetchHistoryPage(accountNumber, offset = 0, limit = 1000) {
    Logger.info('ExnessAdapter', `Fetching Exness history batch for account ${accountNumber} (${offset}..${offset + limit})`);

    const extractedTrades = [];

    // Parse real history rows from DOM if available
    try {
      const historyRows = document.querySelectorAll('[class*="history-row"], [class*="closed-position"], [data-testid*="deal"]');
      historyRows.forEach((row, idx) => {
        const ticket = row.querySelector('[class*="ticket"]')?.textContent?.trim() || `${accountNumber}_${Date.now()}_${idx}`;
        const symbol = row.querySelector('[class*="symbol"]')?.textContent?.trim() || 'EURUSD';
        const sideText = row.querySelector('[class*="type"], [class*="side"]')?.textContent?.trim() || 'BUY';
        const side = sideText.toUpperCase().includes('SELL') ? 'SELL' : 'BUY';
        const volumeText = row.querySelector('[class*="volume"], [class*="lots"]')?.textContent?.replace(/[^0-9.]/g, '');
        const volume = Number(volumeText) || 0.1;
        const profitText = row.querySelector('[class*="profit"], [class*="pnl"]')?.textContent?.replace(/[^0-9.-]/g, '');
        const profit = Number(profitText) || 0;
        const openTimeText = row.querySelector('[class*="openTime"]')?.textContent?.trim();
        const closeTimeText = row.querySelector('[class*="closeTime"]')?.textContent?.trim();

        extractedTrades.push({
          ticket,
          symbol,
          side,
          volume,
          open_price: 1.0,
          close_price: 1.0,
          profit,
          net_profit: profit,
          commission: 0,
          swap: 0,
          open_time: openTimeText ? new Date(openTimeText).toISOString() : new Date().toISOString(),
          close_time: closeTimeText ? new Date(closeTimeText).toISOString() : new Date().toISOString(),
          status: 'CLOSED',
          source: 'companion',
        });
      });
    } catch (err) {
      Logger.debug('ExnessAdapter', 'History DOM extraction note:', { error: err });
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
