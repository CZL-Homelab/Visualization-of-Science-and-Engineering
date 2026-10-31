#!/usr/bin/env node
/*
 * Finance invariants for Stock Market Lab.
 *
 * These are not "does it run" checks: every assertion encodes a rule the
 * teaching pages rely on (OHLC constraints, aggregation identity, RSI range,
 * IPO dilution, fee treatment, liquidation, order priority, ...).
 *
 * Run: node tests/check-finance.cjs
 */
'use strict';

const assert = require('assert');
const core = require('../src/core.js');
const rules = require('../src/market-rules.js');
const data = require('../src/datasets.js');
const sim = require('../src/simulations.js');

let passed = 0;
function ok(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write('  ok   ' + name + '\n');
  } catch (err) {
    process.stderr.write('  FAIL ' + name + '\n');
    throw err;
  }
}
function near(a, b, eps, msg) {
  assert.ok(Math.abs(a - b) <= (eps == null ? 1e-6 : eps), (msg || '') + ' expected ' + b + ', got ' + a);
}

console.log('\nStock Market Lab finance checks\n');

/* ---------- basic helpers ---------- */
ok('round / clamp handle teaching precision', () => {
  near(core.round(11.44, 1), 11.4);
  assert.strictEqual(core.clamp(120, 0, 100), 100);
  assert.strictEqual(core.clamp(-1, 0, 100), 0);
});

/* ---------- moving averages ---------- */
ok('MA5 of 10,11,12,11,13 is 11.4 and earlier slots are null', () => {
  const ma = core.ma([10, 11, 12, 11, 13], 5);
  assert.deepStrictEqual(ma.slice(0, 4), [null, null, null, null]);
  near(ma[4], 11.4);
});

ok('EMA of a constant series equals the constant', () => {
  const e = core.ema([5, 5, 5, 5], 3);
  near(e[e.length - 1], 5);
});

/* ---------- indicators ---------- */
ok('RSI is bounded, 100 for a monotone rise, 50 for a flat series', () => {
  const up = core.rsi(Array.from({ length: 40 }, (_, i) => 100 + i), 14);
  near(up[up.length - 1], 100);
  const flat = core.rsi(new Array(40).fill(50), 14);
  near(flat[flat.length - 1], 50);
  const noisy = core.rsi(data.makeDaily('volatile', 120).map((c) => c.c), 14);
  noisy.filter((v) => v != null).forEach((v) => assert.ok(v >= 0 && v <= 100, 'RSI out of range: ' + v));
});

ok('MACD of a constant series is zero', () => {
  const m = core.macd(new Array(80).fill(20), 12, 26, 9);
  const last = m.hist.length - 1;
  near(m.dif[last], 0);
  near(m.dea[last], 0);
  near(m.hist[last], 0);
});

ok('KDJ and WR stay inside their conventional ranges', () => {
  const candles = data.makeDaily('volatile', 90);
  const kdj = core.kdj(candles, 9, 3, 3);
  kdj.k.filter((v) => v != null).forEach((v) => assert.ok(v >= 0 && v <= 100));
  kdj.d.filter((v) => v != null).forEach((v) => assert.ok(v >= 0 && v <= 100));
  core.wr(candles, 14).filter((v) => v != null).forEach((v) => assert.ok(v <= 0 && v >= -100));
});

ok('BOLL collapses to a point for a constant series', () => {
  const b = core.boll(new Array(40).fill(7), 20, 2);
  const i = b.mid.length - 1;
  near(b.mid[i], 7);
  near(b.upper[i], 7);
  near(b.lower[i], 7);
  near(b.width[i], 0);
});

ok('DMI ADX is a percentage and never negative', () => {
  const d = core.dmi(data.makeDaily('trend-up', 120), 14, 6);
  d.adx.filter((v) => v != null).forEach((v) => assert.ok(v >= 0 && v <= 100, 'ADX ' + v));
});

ok('BIAS / CCI / ROC / OBV are finite and directionally correct', () => {
  const up = data.makeDaily('trend-up', 80);
  const closes = up.map((c) => c.c);
  const bias = core.bias(closes, 6).filter((v) => v != null);
  assert.ok(bias[bias.length - 1] > 0, 'rising market should have positive BIAS');
  assert.ok(core.cci(up, 14).filter((v) => v != null).every(Number.isFinite));
  assert.ok(core.roc(closes, 12).filter((v) => v != null).every(Number.isFinite));
  const obv = core.obv(up);
  assert.ok(obv[obv.length - 1] > obv[0], 'OBV should rise in an up trend with volume');
});

/* ---------- market arithmetic ---------- */
ok('change / amplitude / turnover use the documented denominators', () => {
  near(core.changePct(100, 110), 10);
  near(core.changePct(100, 90), -10);
  near(core.amplitude(110, 90, 100), 20);
  near(core.turnover(1e6, 1e8), 1);
});

ok('market cap, EPS, PE, PB, ROE, dividend yield and EV', () => {
  near(core.marketCap(10, 1e8), 1e9);
  near(core.eps(1e8, 1e8), 1);
  near(core.pe(10, 1), 10);
  assert.strictEqual(core.pe(10, 0), null);
  near(core.pb(10, 5), 2);
  near(core.roe(1e8, 5e8), 20);
  near(core.dividendYield(0.5, 10), 5);
  near(core.enterpriseValue(1e9, 2e8, 1e8), 1.1e9);
  near(core.grossMargin(1e9, 6e8), 40);
  near(core.netMargin(1e8, 1e9), 10);
});

/* ---------- corporate actions ---------- */
ok('a 2-for-1 split doubles shares, halves price, keeps value and halves EPS', () => {
  const s = core.split({ shares: 1e8, price: 10, ratio: 2, profit: 1e8 });
  near(s.shares, 2e8);
  near(s.price, 5);
  near(s.marketValueBefore, s.marketValueAfter);
  near(s.epsAfter, 0.5);
});

ok('IPO issuance: proceeds go to the company, founders are diluted, EPS falls', () => {
  const r = core.issuance({ preShares: 1e8, newShares: 2e7, price: 10, prePrice: 10, profit: 1e8 });
  near(r.proceeds, 2e8);
  near(r.postShares, 1.2e8);
  near(r.postValue, 1.2e9);
  near(r.dilutionPct, 16.666666, 1e-3);
  near(r.epsAfter, 0.833333, 1e-5);
  near(r.pe, 12);
});

ok('cash dividend moves cash to the holder and reduces the ex-price by DPS', () => {
  const d = core.dividend({ shares: 1000, dps: 0.5, price: 10 });
  near(d.cash, 500);
  near(d.exPrice, 9.5);
  near(d.totalValue, 10000);
  near(d.yieldPct, 5);
});

ok('buyback reduces shares and raises EPS when funded from cash', () => {
  const b = core.buyback({ shares: 1e8, price: 10, cash: 5e8, profit: 1e8 });
  near(b.repurchased, 5e7);
  near(b.postShares, 5e7);
  near(b.epsAfter, 2);
});

ok('stock-funded merger creates new shares and dilutes the acquirer', () => {
  const m = core.merger({ acquirerShares: 1e8, acquirerPrice: 20, targetValue: 2e8, premiumPct: 20, acquirerProfit: 2e8, targetProfit: 5e7 });
  near(m.dealValue, 2.4e8);
  near(m.newShares, 1.2e7);
  near(m.postShares, 1.12e8);
  near(m.targetStakePct, 10.714285, 1e-3);
});

/* ---------- fees ---------- */
ok('A-share sell pays commission, stamp duty and transfer fee; buy pays no stamp', () => {
  const sell = core.fees({ market: 'cn', side: 'sell', price: 10, qty: 1000 });
  near(sell.amount, 10000);
  near(sell.commission, 5); // minimum commission dominates
  near(sell.stamp, 5);
  near(sell.transfer, 0.1);
  near(sell.total, 10.1);
  const buy = core.fees({ market: 'cn', side: 'buy', price: 10, qty: 1000 });
  near(buy.stamp, 0);
  near(buy.total, 5.1);
});

ok('US sale pays SEC fee and FINRA TAF per share; no stamp duty', () => {
  const f = core.fees({ market: 'us', side: 'sell', price: 100, qty: 100 });
  near(f.stamp, 0);
  near(f.secFee, 0.278, 1e-9);
  near(f.taf, 0.0166, 1e-9);
  near(f.total, 0.2946, 1e-9);
  const capped = core.fees({ market: 'us', side: 'sell', price: 1, qty: 100000 });
  near(capped.taf, 8.3);
});

/* ---------- leverage ---------- */
ok('2x leverage on a -40% price move loses ~80% of equity and triggers maintenance', () => {
  const l = core.leverage({ capital: 100000, borrow: 100000, price0: 10, price1: 6, days: 30, rate: 0.06, maintenance: 1.3 });
  near(l.shares, 20000);
  near(l.assets, 120000);
  near(l.debt, 100493.1507, 1e-3);
  near(l.net, 19506.8493, 1e-3);
  near(l.returnPct, -80.4932, 1e-3);
  near(l.ratio, 1.1941, 1e-3);
  assert.strictEqual(l.marginCall, true);
  near(l.liqPrice, 6.5321, 1e-3);
  const safer = core.leverage({ capital: 100000, borrow: 100000, price0: 10, price1: 8, days: 30, rate: 0.06, maintenance: 1.3 });
  assert.strictEqual(safer.marginCall, false);
});

ok('liquidation price is debt x maintenance / shares', () => {
  near(core.liquidationPrice({ shares: 20000, debt: 100000, maintenance: 1.3 }), 6.5);
  near(core.liquidationPrice({ capital: 100000, borrow: 100000, price0: 10, maintenance: 1.3 }), 6.5);
  assert.strictEqual(core.liquidationPrice({ maintenance: 1.3 }), 0);
});

/* ---------- long run ---------- */
ok('CAGR, future value and real return', () => {
  near(core.cagr(100, 200, 10), 7.177346, 1e-5);
  near(core.futureValue({ monthly: 1000, years: 10, annualRatePct: 7 }).fv, 173084.8074, 1e-3);
  near(core.realReturn(10, 3), 6.796116, 1e-5);
});

/* ---------- OHLC validation and aggregation ---------- */
ok('OHLC validator rejects impossible candles', () => {
  assert.deepStrictEqual(core.validateOHLC({ o: 10, h: 11, l: 9, c: 10.5 }), []);
  assert.ok(core.validateOHLC({ o: 10, h: 9.5, l: 9, c: 10.5 }).length > 0);
  assert.ok(core.validateOHLC({ o: 10, h: 11, l: 10.6, c: 10.5 }).length > 0);
  assert.ok(core.validateOHLC({ o: 10, h: 11, l: 12, c: 10.5 }).length > 0);
});

ok('candle type and anatomy separate body from shadows', () => {
  assert.strictEqual(core.candleType({ o: 10, c: 11 }), 'yang');
  assert.strictEqual(core.candleType({ o: 11, c: 10 }), 'yin');
  assert.strictEqual(core.candleType({ o: 10, c: 10 }), 'doji');
  const a = core.candleAnatomy({ o: 100, h: 110, l: 90, c: 105 });
  near(a.body, 5);
  near(a.upper, 5);
  near(a.lower, 10);
  near(a.bodyPct, 25);
  near(a.upperPct + a.lowerPct + a.bodyPct, 100);
});

ok('weekly/monthly aggregation preserves OHLCV identities', () => {
  const daily = data.makeDaily('trend-up', 150);
  ['W', 'M'].forEach((period) => {
    const agg = core.aggregate(daily, period);
    assert.ok(agg.length > 1 && agg.length < daily.length, period + ' should compress');
    let cursor = 0;
    agg.forEach((bar) => {
      const members = daily.slice(cursor, cursor + bar.count);
      assert.strictEqual(bar.o, members[0].o, 'first open');
      assert.strictEqual(bar.c, members[members.length - 1].c, 'last close');
      near(bar.h, Math.max.apply(null, members.map((m) => m.h)));
      near(bar.l, Math.min.apply(null, members.map((m) => m.l)));
      near(bar.v, members.reduce((s, m) => s + m.v, 0));
      cursor += bar.count;
    });
    assert.strictEqual(cursor, daily.length);
  });
});

ok('intraday 5m/15m/30m/60m aggregation is consistent and session-anchored', () => {
  const raw = data.makeIntraday(20261030, 2);
  assert.strictEqual(raw.length, 480);
  const sizes = { '5m': 96, '15m': 32, '30m': 16, '60m': 8 };
  Object.keys(sizes).forEach((p) => {
    const agg = core.aggregate(raw, p);
    assert.strictEqual(agg.length, sizes[p], p + ' length');
    let cursor = 0;
    agg.forEach((bar) => {
      const members = raw.slice(cursor, cursor + bar.count);
      assert.strictEqual(bar.o, members[0].o);
      assert.strictEqual(bar.c, members[members.length - 1].c);
      near(bar.h, Math.max.apply(null, members.map((m) => m.h)));
      near(bar.l, Math.min.apply(null, members.map((m) => m.l)));
      near(bar.v, members.reduce((s, m) => s + m.v, 0));
      cursor += bar.count;
    });
    assert.strictEqual(cursor, raw.length);
  });
  const h1 = core.aggregate(raw, '60m')[0];
  assert.ok(h1.label.indexOf('09:30') >= 0, 'first 60m bar starts at 09:30: ' + h1.label);
});

/* ---------- order book ---------- */
ok('order book seed has a two-tick spread and five levels', () => {
  const b = sim.orderBook({ mid: 10, tick: 0.01, depth: 5, seed: 3 });
  const s = b.snapshot();
  assert.strictEqual(s.bids.length, 5);
  assert.strictEqual(s.asks.length, 5);
  near(s.spread, 0.02);
  near(s.bids[0].price, 9.99);
  near(s.asks[0].price, 10.01);
});

ok('a crossing limit buy fills at the ask, best price first', () => {
  const b = sim.orderBook({ mid: 10, tick: 0.01, depth: 5, seed: 3 });
  const r = b.submit({ side: 'buy', type: 'limit', price: 10.05, qty: 1000 });
  assert.strictEqual(r.status, 'filled');
  assert.strictEqual(r.filled, 1000);
  assert.strictEqual(r.fills[0].price, 10.01);
  assert.strictEqual(r.fills[0].qty, 600);
  assert.strictEqual(r.fills[1].price, 10.02);
  assert.strictEqual(b.snapshot().asks[0].qty, 400);
});

ok('a market sell walks the bids and can fill across levels', () => {
  const b = sim.orderBook({ mid: 10, tick: 0.01, depth: 5, seed: 3 });
  const r = b.submit({ side: 'sell', type: 'market', qty: 3000 });
  assert.strictEqual(r.status, 'filled');
  assert.deepStrictEqual(r.fills.map((f) => f.price), [9.99, 9.98]);
  near(r.fills.reduce((s, f) => s + f.qty * f.price, 0) / r.filled, 9.985, 1e-9);
});

ok('time priority: the earlier order at the same price fills first', () => {
  const b = sim.orderBook({ mid: 10, tick: 0.01, depth: 1, seed: 3 });
  const first = b.submit({ side: 'sell', type: 'limit', price: 10.20, qty: 500 });
  const second = b.submit({ side: 'sell', type: 'limit', price: 10.20, qty: 700 });
  assert.strictEqual(first.status, 'resting');
  assert.strictEqual(second.status, 'resting');
  // 600 shares sit at 10.01 in the seeded book, so 1100 buys 600 + the older 10.20 order.
  const r = b.submit({ side: 'buy', type: 'market', qty: 1100 });
  assert.deepStrictEqual(r.fills.map((f) => f.qty), [600, 500]);
  assert.strictEqual(r.fills[1].price, 10.20);
  assert.strictEqual(b.snapshot().asks.find((a) => a.price === 10.20).qty, 700);
});

ok('orders outside the daily price limit are rejected with a reason', () => {
  const b = sim.orderBook({ mid: 10, tick: 0.01, depth: 5, seed: 3 });
  const r = b.submit({ side: 'buy', type: 'limit', price: 11.5, qty: 100, limitUp: 11, limitDown: 9 });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.status, 'rejected');
  assert.ok(/涨停/.test(r.reason));
});

/* ---------- IPO demand ---------- */
ok('IPO demand falls as the offer price rises; allocation never exceeds the offer', () => {
  const cheap = sim.ipoDemand({ price: 9, offerQty: 2e7, seed: 5 });
  const rich = sim.ipoDemand({ price: 16, offerQty: 2e7, seed: 5 });
  assert.ok(cheap.demandQty > rich.demandQty);
  assert.ok(cheap.oversubscription > 1);
  const alloc = cheap.bids.reduce((s, b) => s + b.allocation, 0);
  near(alloc, Math.min(cheap.offerQty, cheap.demandQty), 1);
  assert.ok(rich.oversubscription < cheap.oversubscription);
});

/* ---------- margin simulation ---------- */
ok('margin simulation forces liquidation on a falling path and reports it', () => {
  const m = sim.simulateMargin({ capital: 1e5, leverage: 2, prices: [10, 9.5, 9, 8.5, 8, 7, 6], rate: 0.06, maintenance: 1.3 });
  assert.ok(m.events.length > 0, 'expected at least one maintenance event');
  assert.ok(m.liquidation, 'expected a liquidation record');
  assert.ok(m.finalEquity < 1e5);
  assert.strictEqual(m.series[m.series.length - 1].forced, true);
});

/* ---------- Monte Carlo ---------- */
ok('Monte Carlo is deterministic for a fixed seed and diversification lowers sigma', () => {
  const a = sim.monteCarlo({ seed: 7, years: 10, paths: 150, muPct: 7, sigmaPct: 20, rho: 0.3, basketSize: 20 });
  const b = sim.monteCarlo({ seed: 7, years: 10, paths: 150, muPct: 7, sigmaPct: 20, rho: 0.3, basketSize: 20 });
  assert.strictEqual(a.single.quantiles.p50, b.single.quantiles.p50);
  assert.ok(a.etfSigmaPct < 20);
  assert.ok(a.single.quantiles.p10 < a.single.quantiles.p90);
  assert.ok(a.single.avgDrawdown >= a.etf.avgDrawdown - 1e-9);
  assert.ok(a.etf.quantiles.p10 > a.single.quantiles.p10, 'diversification should lift the bad tail');
});

/* ---------- market rules ---------- */
ok('A-share board limits and lots are dated and board-specific', () => {
  assert.strictEqual(rules.asOf, '2026-10-31');
  assert.strictEqual(rules.cnLimitPct('main'), 10);
  assert.strictEqual(rules.cnLimitPct('star'), 20);
  assert.strictEqual(rules.cnLimitPct('chinext'), 20);
  assert.strictEqual(rules.cnLimitPct('bse'), 30);
  assert.strictEqual(rules.cnLimitPct('new'), null);
  assert.deepStrictEqual(rules.limitPrices(10, 10), { upper: 11, lower: 9, pct: 10 });
  const board = (code) => { const b = rules.boardOf(code); return { key: b.key, limitPct: b.limitPct, lot: b.lot }; };
  assert.deepStrictEqual(board('688001'), { key: 'star', limitPct: 20, lot: 200 });
  assert.deepStrictEqual(board('300001'), { key: 'chinext', limitPct: 20, lot: 100 });
  assert.deepStrictEqual(board('830001'), { key: 'bse', limitPct: 30, lot: 100 });
  assert.deepStrictEqual(board('600000'), { key: 'main', limitPct: 10, lot: 100 });
  assert.strictEqual(rules.boardOf('900901').key, 'main');
});

ok('US LULD bands and market-wide circuit breakers use the right tiers', () => {
  assert.deepStrictEqual(rules.usLuldBand(100, 1), { pct: 5, lower: 95, upper: 105, tier: 1 });
  assert.deepStrictEqual(rules.usLuldBand(100, 2), { pct: 20, lower: 80, upper: 120, tier: 2 });
  assert.strictEqual(rules.usMarketBreaker(-7).level, 1);
  assert.strictEqual(rules.usMarketBreaker(-13).level, 2);
  assert.strictEqual(rules.usMarketBreaker(-20).level, 3);
  assert.strictEqual(rules.usMarketBreaker(-3).level, 0);
});

/* ---------- data generation and import ---------- */
ok('generated presets are valid OHLCV and deterministic', () => {
  data.PRESET_ORDER.forEach((key) => {
    const a = data.makeDaily(key, 60);
    const b = data.makeDaily(key, 60);
    assert.strictEqual(a.length, 60);
    assert.deepStrictEqual(a.map((c) => c.c), b.map((c) => c.c), key + ' must be deterministic');
    a.forEach((c) => assert.deepStrictEqual(core.validateOHLC(c), [], key + ' invalid candle'));
    assert.ok(a.every((c) => c.source === 'sim'));
  });
});

ok('import parser accepts CSV, flags bad rows and never throws on garbage', () => {
  const csv = 'date,open,high,low,close,volume\n2026-01-05,10,11,9.5,10.5,1000\n2026-01-06,10.5,10.6,9.8,9.9,1200\n';
  const r = data.parseImport(csv, { sourceName: 'unit.csv' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.candles.length, 2);
  assert.strictEqual(r.meta.rows, 2);
  assert.strictEqual(r.candles[1].c, 9.9);
  const bad = data.parseImport('not,a,csv\n1,2,3', {});
  assert.strictEqual(bad.ok, false);
  assert.ok(bad.errors.length > 0);
});

/* ---------- index math ---------- */
ok('cap-weighted index responds to price but not to a pure split', () => {
  const a = core.capWeightedLevel([{ price: 10, shares: 100 }, { price: 20, shares: 50 }], 1000);
  const b = core.capWeightedLevel([{ price: 20, shares: 100 }, { price: 20, shares: 50 }], 1000);
  assert.ok(b.level > a.level);
  const split = core.capWeightedLevel([{ price: 5, shares: 200 }, { price: 20, shares: 50 }], 1000);
  near(split.level, a.level, 1e-9);
});

console.log('\n' + passed + ' finance checks passed\n');
