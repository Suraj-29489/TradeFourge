const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Load website modules
const TradeParser = require('../js/parser.js');
const TradeAnalytics = require('../js/analytics.js');

console.log('================================================================');
console.log('STARTING TIMEZONE & DAILY GROUPING REGRESSION TEST SUITE (WEB)');
console.log('================================================================\n');

// --- Case A: Midnight boundary (00:00:00.000 IST belongs to that date) ---
console.log('Running Case A: Midnight boundary...');
const tradeMidnight = { closeTime: '2026-10-07T18:30:00Z', profit: 10 }; // 00:00:00 IST on Oct 8
assert.strictEqual(TradeAnalytics.getTradeDate(tradeMidnight), '2026-10-08');
console.log('✓ Case A Passed: 00:00:00 IST on Oct 8 resolves to 2026-10-08');

// --- Case B: Just before midnight (23:59:59.999 IST belongs to that date) ---
console.log('Running Case B: Just before midnight...');
const tradeJustBeforeMidnight = { closeTime: '2026-10-08T18:29:59.999Z', profit: 10 }; // 23:59:59.999 IST on Oct 8
assert.strictEqual(TradeAnalytics.getTradeDate(tradeJustBeforeMidnight), '2026-10-08');
console.log('✓ Case B Passed: 23:59:59.999 IST on Oct 8 resolves to 2026-10-08');

// --- Case C: Exactly next midnight (00:00:00.000 IST next day belongs to next day) ---
console.log('Running Case C: Exactly next midnight...');
const tradeNextMidnight = { closeTime: '2026-10-08T18:30:00Z', profit: 10 }; // 00:00:00 IST on Oct 9
assert.strictEqual(TradeAnalytics.getTradeDate(tradeNextMidnight), '2026-10-09');
console.log('✓ Case C Passed: 00:00:00 IST on Oct 9 resolves to 2026-10-09 (excluded from Oct 8)');

// --- Case D: UTC date differs from IST date ---
console.log('Running Case D: UTC date differs from IST date...');
// Trade closed at 18:45:00 UTC on Oct 7 (which is 00:15:00 AM IST on Oct 8)
const tradeUtcDiffers = { closeTime: '2026-10-07T18:45:00Z', profit: 5 };
assert.strictEqual(TradeAnalytics.getTradeDate(tradeUtcDiffers), '2026-10-08');
console.log('✓ Case D Passed: Oct 7 18:45:00 UTC resolves to 2026-10-08 in IST');

// --- Case E: Early-morning trades ---
console.log('Running Case E: Early-morning trades...');
const morningTimes = [
  '2026-10-07T18:30:00Z', // 12:00 AM IST
  '2026-10-07T19:30:00Z', // 01:00 AM IST
  '2026-10-07T21:30:00Z', // 03:00 AM IST
  '2026-10-07T23:59:59Z', // 05:29:59 AM IST
];
morningTimes.forEach((tStr, idx) => {
  const t = { closeTime: tStr, profit: 1 };
  assert.strictEqual(TradeAnalytics.getTradeDate(t), '2026-10-08', `Failed for early morning time: ${tStr}`);
});
console.log('✓ Case E Passed: All early-morning trades (12:00 AM, 1:00 AM, 3:00 AM, 5:29 AM IST) resolve to 2026-10-08');

// --- Case H: Month boundaries ---
console.log('Running Case H: Month boundaries...');
// Sep 30 18:30:00 UTC -> Oct 1 00:00:00 IST
assert.strictEqual(TradeAnalytics.getTradeDate({ closeTime: '2026-09-30T18:30:00Z' }), '2026-10-01');
// Oct 31 18:30:00 UTC -> Nov 1 00:00:00 IST
assert.strictEqual(TradeAnalytics.getTradeDate({ closeTime: '2026-10-31T18:30:00Z' }), '2026-11-01');
console.log('✓ Case H Passed: Month transitions respect IST boundaries');

// --- Case I: Full CSV Dataset Validation ---
console.log('Running Case I: Full CSV Dataset Import & Validation...');
const csv1Path = path.join(__dirname, '../../../AndroidStudioProjects/TradeFourge/csv_audit/07_10_2026-20_10_2026.csv');
const csv2Path = path.join(__dirname, '../../../AndroidStudioProjects/TradeFourge/csv_audit/08_10_2026-20_10_2026.csv');

const csv1 = fs.readFileSync(csv1Path, 'utf8');
const csv2 = fs.readFileSync(csv2Path, 'utf8');

const trades1 = TradeParser.parseCSV(csv1);
const trades2 = TradeParser.parseCSV(csv2);
const allTrades = [...trades1, ...trades2];

assert.strictEqual(allTrades.length, 196, 'Total trades must equal 196');

// Run full analytics metrics calculation
const metrics = TradeAnalytics.calculateMetrics(allTrades);

// Check October 8 daily map entry
const oct8DayData = metrics.dailyMap['2026-10-08'];
assert(oct8DayData, 'October 8 must exist in dailyMap');
assert.strictEqual(oct8DayData.trades, 26, `Expected 26 trades on Oct 8, got ${oct8DayData.trades}`);
assert.strictEqual(oct8DayData.wins, 8, `Expected 8 winners on Oct 8, got ${oct8DayData.wins}`);
assert.strictEqual(oct8DayData.losses, 18, `Expected 18 losers on Oct 8, got ${oct8DayData.losses}`);
assert.strictEqual(Math.round(oct8DayData.pnl * 100) / 100, 512.09, `Expected P&L of +512.09, got ${oct8DayData.pnl}`);

// Check getTradesForDate('2026-10-08')
const oct8List = TradeAnalytics.getTradesForDate('2026-10-08', allTrades);
assert.strictEqual(oct8List.length, 26, `getTradesForDate must return 26 trades, got ${oct8List.length}`);
const oct8ListPnL = Math.round(oct8List.reduce((s, t) => s + (Number(t.profit) || 0), 0) * 100) / 100;
assert.strictEqual(oct8ListPnL, 512.09, `getTradesForDate P&L must be 512.09, got ${oct8ListPnL}`);

console.log('✓ Case I Passed: October 8 yields 26 trades, 8 wins, 18 losses, +₹512.09 matching Android perfectly');

// Verify entire daily reconciliation table under IST
console.log('\n--- Full Date Reconciliation Table (Web vs Expected IST) ---');
const expectedDailyIst = {
  '2026-10-07': { trades: 7, pnl: -138.50 },
  '2026-10-08': { trades: 26, pnl: 512.09 },
  '2026-10-09': { trades: 9, pnl: 21.33 },
  '2026-10-11': { trades: 1, pnl: -8.95 },
  '2026-10-12': { trades: 12, pnl: 158.70 },
  '2026-10-13': { trades: 27, pnl: -423.80 },
  '2026-10-14': { trades: 41, pnl: -934.39 },
  '2026-10-15': { trades: 25, pnl: -248.20 },
  '2026-10-16': { trades: 9, pnl: 6.42 },
  '2026-10-17': { trades: 5, pnl: 16.00 },
  '2026-10-19': { trades: 11, pnl: 184.04 },
  '2026-10-20': { trades: 23, pnl: 97.83 }
};

for (const [dStr, exp] of Object.entries(expectedDailyIst)) {
  const dData = metrics.dailyMap[dStr];
  assert(dData, `Date ${dStr} must exist in metrics.dailyMap`);
  assert.strictEqual(dData.trades, exp.trades, `Date ${dStr}: expected ${exp.trades} trades, got ${dData.trades}`);
  const actualPnL = Math.round(dData.pnl * 100) / 100;
  assert.strictEqual(actualPnL, exp.pnl, `Date ${dStr}: expected ${exp.pnl} P&L, got ${actualPnL}`);
  console.log(`  ${dStr}: ${dData.trades} trades, P&L = ${actualPnL.toFixed(2)} [MATCH]`);
}

console.log('\n================================================================');
console.log('ALL TIMEZONE & REGRESSION TESTS PASSED SUCCESSFULLY (WEB)');
console.log('================================================================');
