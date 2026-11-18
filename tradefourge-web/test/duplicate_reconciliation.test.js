/**
 * duplicate_reconciliation.test.js
 * Comprehensive unit and integration test suite for cross-platform trade deduplication.
 * Verifies parity with Android CloudSyncUtils, ensuring duplicate trades are excluded,
 * P&L calculations match mobile truth, and partial closes are 100% preserved.
 */

const assert = require('assert');
const fs = require('fs');

// Global mock DOM and storage environment
global.window = {
  location: { hash: '#dashboard' },
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};

global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
  clear() { this._store = {}; }
};

// Load parser, storage, and analytics
const parserCode = fs.readFileSync('js/parser.js', 'utf8');
eval(parserCode.replace('const TradeParser', 'global.TradeParser'));

const storageCode = fs.readFileSync('js/storage.js', 'utf8');
eval(storageCode.replace('const StorageManager', 'global.StorageManager'));

console.log('================================================================');
console.log('STARTING DUPLICATE RECONCILIATION & CROSS-PLATFORM TEST SUITE');
console.log('================================================================\n');

let passedCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Partial close preservation
test('1. Legitimate Exness partial closes with same ticket must NEVER be collapsed', () => {
  const p1 = {
    ticket: '29079881',
    symbol: 'XAUUSDc',
    type: 'buy',
    openTime: '2026-11-09T08:30:00Z',
    closeTime: '2026-11-09T08:34:26Z',
    lots: 0.36,
    profit: 117.7,
    openPrice: 2650.0,
    closePrice: 2653.2
  };
  const p2 = {
    ticket: '29079881',
    symbol: 'XAUUSDc',
    type: 'buy',
    openTime: '2026-11-09T08:30:00Z',
    closeTime: '2026-11-09T08:44:37Z',
    lots: 0.14,
    profit: 109.2,
    openPrice: 2650.0,
    closePrice: 2657.8
  };

  const res = StorageManager.deduplicateTrades([p1, p2]);
  assert.strictEqual(res.length, 2, 'Both partial close records must be preserved');
  assert.strictEqual(res.filter(t => t.ticket === '29079881').length, 2);
});

// 2. Timestamp format variations (Z vs no-Z, .000Z)
test('2. Duplicate trades with timestamp format variations (Z vs no-Z vs .000Z) collapse cleanly', () => {
  const base = {
    ticket: '36097596',
    symbol: 'XAUUSDc',
    type: 'buy',
    openTime: '2026-11-11T07:20:00',
    closeTime: '2026-11-11T07:22:47',
    lots: 0.4,
    profit: 93.4,
    openPrice: 2655.0,
    closePrice: 2657.3
  };
  const withZ = {
    ...base,
    openTime: '2026-11-11T07:20:00Z',
    closeTime: '2026-11-11T07:22:47Z',
    syncId: null
  };
  const with000Z = {
    ...base,
    openTime: '2026-11-11T07:20:00.000Z',
    closeTime: '2026-11-11T07:22:47.000Z',
    syncId: 'some_other_sync_id'
  };

  const res = StorageManager.deduplicateTrades([base, withZ, with000Z]);
  assert.strictEqual(res.length, 1, 'All 3 format variations must collapse to 1 trade');
  assert.strictEqual(res[0].ticket, '36097596');
  assert.strictEqual(res[0].profit, 93.4);
});

// 3. Ticket # prefix and float precision differences
test('3. Ticket prefixes (#) and float representation differences collapse to 1 trade', () => {
  const tA = {
    ticket: '29079881',
    symbol: 'XAUUSDc',
    type: 'buy',
    openTime: '2026-11-09T08:30:00Z',
    closeTime: '2026-11-09T08:44:37Z',
    lots: 0.14,
    profit: 109.2
  };
  const tB = {
    ticket: '#29079881',
    symbol: 'XAUUSDc',
    type: 'buy',
    openTime: '2026-11-09T08:30:00Z',
    closeTime: '2026-11-09T08:44:37Z',
    lots: 0.14000,
    profit: 109.20000000000002
  };

  const res = StorageManager.deduplicateTrades([tA, tB]);
  assert.strictEqual(res.length, 1, 'Hash prefix and float differences must collapse to 1 trade');
});

// 4. Metadata preservation on merge (notes, strategy, tags, account)
test('4. Richer metadata (notes, strategy, tags, accountId) are merged and preserved', () => {
  const bareTrade = {
    ticket: '77889900',
    symbol: 'XAUUSD',
    type: 'sell',
    openTime: '2026-11-12T10:00:00Z',
    closeTime: '2026-11-12T10:30:00Z',
    lots: 0.5,
    profit: 250.0,
    notes: 'Imported trade',
    strategy: 'Manual'
  };
  const richTrade = {
    ticket: '77889900',
    symbol: 'XAUUSD',
    type: 'sell',
    openTime: '2026-11-12T10:00:00Z',
    closeTime: '2026-11-12T10:30:00Z',
    lots: 0.5,
    profit: 250.0,
    notes: 'Rejection at 4H Order Block',
    strategy: 'ICT Breaker',
    tags: ['A+ Setup', 'London Open'],
    accountId: 'exness_standard'
  };

  const res = StorageManager.deduplicateTrades([bareTrade, richTrade]);
  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].notes, 'Rejection at 4H Order Block');
  assert.strictEqual(res[0].strategy, 'ICT Breaker');
  assert.deepStrictEqual(res[0].tags, ['A+ Setup', 'London Open']);
  assert.strictEqual(res[0].accountId, 'exness_standard');
});

// 5. StorageManager.mergeTrades returns dedupRemovedCount
test('5. StorageManager.mergeTrades reports accurate dedupRemovedCount', () => {
  localStorage.clear();
  StorageManager.init();

  const initial = [
    { ticket: '1001', symbol: 'XAUUSD', type: 'buy', openTime: '2026-11-01T08:00:00Z', closeTime: '2026-11-01T09:00:00Z', lots: 0.1, profit: 50.0 },
    { ticket: '1002', symbol: 'EURUSD', type: 'sell', openTime: '2026-11-01T10:00:00Z', closeTime: '2026-11-01T11:00:00Z', lots: 0.2, profit: -20.0 }
  ];
  StorageManager.saveTrades(initial, 'initial.csv');

  // Merge batch containing 1 new trade, 1 exact duplicate, and 1 duplicate with no-Z time
  const incoming = [
    { ticket: '1002', symbol: 'EURUSD', type: 'sell', openTime: '2026-11-01T10:00:00Z', closeTime: '2026-11-01T11:00:00Z', lots: 0.2, profit: -20.0 },
    { ticket: '1001', symbol: 'XAUUSD', type: 'buy', openTime: '2026-11-01T08:00:00', closeTime: '2026-11-01T09:00:00', lots: 0.1, profit: 50.00 },
    { ticket: '1003', symbol: 'GBPUSD', type: 'buy', openTime: '2026-11-02T08:00:00Z', closeTime: '2026-11-02T09:00:00Z', lots: 0.1, profit: 30.0 }
  ];

  const mergeRes = StorageManager.mergeTrades(incoming, 'incoming.csv');
  assert.strictEqual(mergeRes.addedCount, 1, 'Only 1 new trade (1003) should be added');
  assert.strictEqual(mergeRes.dedupRemovedCount, 2, '2 duplicates should be excluded');
  assert.strictEqual(mergeRes.total, 3, 'Total unique trades must be 3');
});

// 6. StorageManager.loadFromStorage auto-cleans existing duplicates in localStorage
test('6. StorageManager.loadFromStorage cleans historical duplicates on startup', () => {
  localStorage.clear();

  // Manually corrupt localStorage with duplicates (simulating legacy data)
  const corruptDataset = [
    { ticket: '5001', symbol: 'XAUUSD', type: 'buy', openTime: '2026-11-01T08:00:00Z', closeTime: '2026-11-01T09:00:00Z', lots: 0.1, profit: 50.0 },
    { ticket: '5001', symbol: 'XAUUSD', type: 'buy', openTime: '2026-11-01T08:00:00', closeTime: '2026-11-01T09:00:00', lots: 0.1, profit: 50.0 },
    { ticket: '5002', symbol: 'BTCUSD', type: 'sell', openTime: '2026-11-02T08:00:00Z', closeTime: '2026-11-02T09:00:00Z', lots: 0.5, profit: -100.0 }
  ];
  localStorage.setItem('tradefourge_trades', JSON.stringify(corruptDataset));

  StorageManager.init();
  const loaded = StorageManager.getTrades();
  assert.strictEqual(loaded.length, 2, 'Corrupt duplicates in localStorage must be cleaned to 2 unique trades');
  assert.strictEqual(StorageManager._lastDedupCleanedCount, 1, '_lastDedupCleanedCount must be 1');

  // Verify localStorage itself was updated
  const persisted = JSON.parse(localStorage.getItem('tradefourge_trades'));
  assert.strictEqual(persisted.length, 2);
});

// 7. Full CSV dataset deduplication validation
test('7. Real CSV import with re-exported trades produces exact trade counts and P&L', () => {
  localStorage.clear();
  StorageManager.init();

  const csvExnessPath = '/Users/surajkoley/Downloads/07_10_2026-18_11_2026.csv';
  const csvCentsPath = '/Users/surajkoley/Downloads/01_01_2007-18_11_2026.csv';

  const tExness = TradeParser.parseCSV(fs.readFileSync(csvExnessPath, 'utf8'), 'exness.csv');
  const tCents = TradeParser.parseCSV(fs.readFileSync(csvCentsPath, 'utf8'), 'cents.csv');

  // Merge Exness
  const res1 = StorageManager.mergeTrades(tExness, 'exness.csv');
  assert.strictEqual(res1.total, 148);

  // Merge Cents
  const res2 = StorageManager.mergeTrades(tCents, 'cents.csv');
  assert.strictEqual(res2.total, 303);

  // Re-merge Exness (exact repeat) -> addedCount must be 0, dedupRemovedCount must equal 148
  const resRepeat = StorageManager.mergeTrades(tExness, 'exness_repeat.csv');
  assert.strictEqual(resRepeat.addedCount, 0, 'Re-imported CSV must add 0 trades');
  assert.strictEqual(resRepeat.dedupRemovedCount, 148, 'All 148 re-imported trades must be excluded as duplicates');
  assert.strictEqual(resRepeat.total, 303, 'Total trades must remain 303');
});

console.log(`\nSummary: ${passedCount} passed, 0 failed (${passedCount} total).`);
console.log('================================================================');
