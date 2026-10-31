/* Stock Market Lab — simulation engines.
 *
 * Order matching, IPO demand, margin accounts and seeded portfolio paths.
 * These are deliberately simplified teaching models: they implement price/time
 * priority and common risk rules, not an exchange's full rulebook.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.SM = root.SM || {}; root.SM.sim = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var rngFrom = function (seed) {
    var a = (seed || 1) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  var gauss = function (rng) {
    var u = 0, v = 0;
    while (!u) u = rng();
    while (!v) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  var r2 = function (v) { return Math.round(v * 100) / 100; };

  var nextQty = function (rng, base) {
    return Math.max(100, Math.round(base * (0.5 + rng()) / 100) * 100);
  };

  /* ================= order book ================= */

  function orderBook(opts) {
    opts = opts || {};
    var tick = opts.tick || 0.01;
    var mid = opts.mid || 100;
    var depth = opts.depth || 5;
    var rng = rngFrom(opts.seed || 2026);
    var seq = 0;
    var bids = [], asks = [], trades = [], history = [];
    var last = mid;
    var initial = null;

    function level(side, price) {
      var arr = side === 'buy' ? bids : asks;
      for (var i = 0; i < arr.length; i++) if (Math.abs(arr[i].price - price) < tick / 2) return arr[i];
      return null;
    }

    function sortBook() {
      bids.sort(function (a, b) { return b.price - a.price; });
      asks.sort(function (a, b) { return a.price - b.price; });
    }

    function seed() {
      bids = []; asks = []; trades = []; history = []; seq = 0; last = mid;
      for (var i = 0; i < depth; i++) {
        bids.push({ price: r2(mid - tick * (i + 1)), orders: [] });
        asks.push({ price: r2(mid + tick * (i + 1)), orders: [] });
      }
      for (var k = 0; k < depth; k++) {
        var bq = nextQty(rng, 1200 + k * 400), aq = nextQty(rng, 1100 + k * 350);
        addResting('buy', bids[k].price, bq);
        addResting('sell', asks[k].price, aq);
      }
      initial = snapshot();
    }

    function addResting(side, price, qty, meta) {
      var lv = level(side, price);
      if (!lv) {
        lv = { price: price, orders: [] };
        (side === 'buy' ? bids : asks).push(lv);
        sortBook();
      }
      var order = { id: ++seq, side: side, type: 'limit', price: price, qty: qty, t: seq, meta: meta || null };
      lv.orders.push(order);
      history.push({ kind: 'rest', id: order.id, side: side, price: price, qty: qty, t: seq });
      return order;
    }

    function best(side) {
      var lv = (side === 'buy' ? bids : asks)[0];
      return lv || null;
    }

    function levelQty(lv) {
      return lv.orders.reduce(function (s, o) { return s + o.qty; }, 0);
    }

    function snapshot() {
      var b = bids.slice(0, depth).map(function (lv) { return { price: lv.price, qty: levelQty(lv) }; });
      var a = asks.slice(0, depth).map(function (lv) { return { price: lv.price, qty: levelQty(lv) }; });
      var bb = b[0] ? b[0].price : null, ba = a[0] ? a[0].price : null;
      return {
        bids: b, asks: a, last: last,
        spread: bb != null && ba != null ? r2(ba - bb) : null,
        mid: bb != null && ba != null ? r2((bb + ba) / 2) : last,
        filled: !!a.length
      };
    }

    function match(order) {
      var fills = [];
      var opposite = order.side === 'buy' ? asks : bids;
      while (order.qty > 0.0001 && opposite.length) {
        var lv = opposite[0];
        if (order.type === 'limit') {
          if (order.side === 'buy' && lv.price > order.price + 1e-9) break;
          if (order.side === 'sell' && lv.price < order.price - 1e-9) break;
        }
        while (order.qty > 0.0001 && lv.orders.length) {
          var maker = lv.orders[0];
          var take = Math.min(order.qty, maker.qty);
          order.qty -= take;
          maker.qty -= take;
          last = lv.price;
          fills.push({ price: lv.price, qty: take, makerId: maker.id });
          trades.push({ price: lv.price, qty: take, taker: order.side, t: ++seq });
          if (maker.qty <= 0.0001) lv.orders.shift();
        }
        if (!lv.orders.length) {
          var idx = opposite.indexOf(lv);
          if (idx >= 0) opposite.splice(idx, 1);
        }
      }
      return fills;
    }

    // Submit an order. Returns fills, status and the resulting book.
    function submit(input) {
      var side = input.side === 'sell' ? 'sell' : 'buy';
      var type = input.type === 'market' ? 'market' : 'limit';
      var order = {
        id: ++seq, side: side, type: type,
        price: type === 'market' ? null : r2(input.price),
        qty: Math.max(0, Math.round(input.qty)),
        t: seq, meta: input.meta || null
      };
      function reject(reason) {
        history.push({ kind: 'reject', id: order.id, side: side, type: type, price: order.price, qty: order.qty, t: order.t, reason: reason });
        return {
          ok: false, order: order, fills: [], filled: 0, remaining: order.qty,
          status: 'rejected', reason: reason, book: snapshot()
        };
      }
      if (!order.qty) return reject('数量必须大于 0');
      if (type === 'limit' && !(order.price > 0)) return reject('限价必须大于 0');
      // A-shares cannot trade through the daily limit.
      if (input.limitUp != null && order.price != null && order.price > input.limitUp + 1e-9) {
        return reject('报价高于涨停价 ' + input.limitUp.toFixed(2) + ' 元，无法申报');
      }
      if (input.limitDown != null && order.price != null && order.price < input.limitDown - 1e-9) {
        return reject('报价低于跌停价 ' + input.limitDown.toFixed(2) + ' 元，无法申报');
      }
      history.push({ kind: 'submit', id: order.id, side: side, type: type, price: order.price, qty: order.qty, t: order.t });
      var fills = match(order);
      var filled = fills.reduce(function (s, f) { return s + f.qty; }, 0);
      var status;
      if (order.qty <= 0.0001) status = 'filled';
      else if (type === 'market') status = filled > 0 ? 'partial' : 'rejected';
      else {
        addResting(side, order.price, order.qty, { takerId: order.id });
        status = filled > 0 ? 'partial' : 'resting';
      }
      if (order.type === 'market' && order.qty > 0.0001) {
        history.push({ kind: 'cancel', id: order.id, qty: order.qty, reason: '市价单剩余部分撤销' });
      }
      return {
        ok: status !== 'rejected', order: order, fills: fills, filled: filled,
        remaining: Math.max(0, order.qty), status: status,
        reason: status === 'rejected' ? '盘口没有可成交的对手单' : null,
        book: snapshot()
      };
    }

    function cancel(orderId) {
      [bids, asks].forEach(function (side) {
        side.forEach(function (lv) {
          lv.orders = lv.orders.filter(function (o) { return o.id !== orderId; });
        });
      });
      bids = bids.filter(function (lv) { return lv.orders.length; });
      asks = asks.filter(function (lv) { return lv.orders.length; });
      history.push({ kind: 'cancel', id: orderId, t: ++seq });
      return snapshot();
    }

    function reset() { rng = rngFrom(opts.seed || 2026); seed(); return snapshot(); }

    // Scripted pressure used by the teaching scenes.
    function pressure(style) {
      var out = [];
      if (style === 'buy') {
        out.push(submit({ side: 'buy', type: 'market', qty: 6000, meta: { scripted: true } }));
        out.push(submit({ side: 'buy', type: 'limit', price: r2(snapshot().mid + tick * 2), qty: 4000, meta: { scripted: true } }));
      } else if (style === 'sell') {
        out.push(submit({ side: 'sell', type: 'market', qty: 6000, meta: { scripted: true } }));
        out.push(submit({ side: 'sell', type: 'limit', price: r2(snapshot().mid - tick * 2), qty: 4000, meta: { scripted: true } }));
      } else if (style === 'sparse') {
        out.push(submit({ side: 'buy', type: 'limit', price: r2(snapshot().mid - tick), qty: 300, meta: { scripted: true } }));
      }
      return out;
    }

    seed();
    return {
      submit: submit, cancel: cancel, reset: reset, pressure: pressure,
      snapshot: snapshot, best: best, seed: seed,
      get trades() { return trades; },
      get history() { return history; },
      get initialBook() { return initial; }
    };
  }

  /* ================= IPO demand ================= */

  // Simplified book-building: each investor bids a maximum price and a size.
  // This is a demand-curve model, not a prediction of real allocation.
  function ipoDemand(opts) {
    var price = opts.price;
    var offerQty = opts.offerQty;
    var investors = opts.investors || defaultInvestors(opts.seed);
    var bids = investors.map(function (inv) {
      var willing = inv.maxPrice >= price;
      var qty = willing ? inv.qty : 0;
      return { name: inv.name, maxPrice: inv.maxPrice, wanted: inv.qty, qty: qty };
    });
    var demand = bids.reduce(function (s, b) { return s + b.qty; }, 0);
    bids.forEach(function (b) { b.allocation = demand > 0 ? Math.min(b.qty, offerQty * (b.qty / demand)) : 0; });
    var allocated = bids.reduce(function (s, b) { return s + b.allocation; }, 0);
    return {
      price: price,
      offerQty: offerQty,
      demandQty: demand,
      oversubscription: offerQty ? demand / offerQty : null,
      proceedsGross: offerQty * price,
      allocated: allocated,
      unfilled: Math.max(0, offerQty - allocated),
      bids: bids,
      clearingPrice: clearingPrice(investors, offerQty)
    };
  }

  function clearingPrice(investors, offerQty) {
    var sorted = investors.slice().sort(function (a, b) { return b.maxPrice - a.maxPrice; });
    var qty = 0, price = null;
    for (var i = 0; i < sorted.length; i++) {
      qty += sorted[i].qty;
      price = sorted[i].maxPrice;
      if (qty >= offerQty) return price;
    }
    return price;
  }

  function defaultInvestors(seed) {
    var rng = rngFrom(seed || 31);
    var names = ['长期基金 A', '长期基金 B', '公募组合 C', '保险资金 D', '对冲基金 E', '个人大额 F', '产业资本 G', '指数基金 H'];
    return names.map(function (name, i) {
      return { name: name, maxPrice: r2(8 + rng() * 10), qty: Math.round((20 + rng() * 90) * 1e5) };
    });
  }

  /* ================= margin path ================= */

  // Walk a price path with a fully-invested margin position. Once equity/debt
  // falls below the maintenance ratio, the position is liquidated at that
  // bar's price (gap risk means this can be far below the theoretical line).
  function simulateMargin(opts) {
    var capital = opts.capital;
    var lev = opts.leverage || 1;
    var prices = opts.prices || [];
    var rate = opts.rate || 0.06;
    var maintenance = opts.maintenance == null ? 1.3 : opts.maintenance;
    var borrow = capital * (lev - 1);
    var price0 = prices[0];
    var shares = price0 > 0 ? capital * lev / price0 : 0;
    var debt = borrow;
    var series = [], events = [];
    var alive = true;
    for (var i = 0; i < prices.length; i++) {
      var p = prices[i];
      if (i > 0) debt *= 1 + rate / 365;
      var assets = shares * p;
      var equity = assets - debt;
      var ratio = debt > 0 ? assets / debt : null;
      var liqPrice = debt > 0 ? debt * maintenance / shares : 0;
      series.push({
        i: i, price: p, assets: assets, debt: debt, equity: alive ? equity : series[series.length - 1].equity,
        ratio: alive ? ratio : null, liqPrice: liqPrice, paidIn: capital
      });
      if (!alive) continue;
      if (debt > 0 && ratio < maintenance) {
        var loss = equity - capital;
        series[i].equity = equity;
        series[i].forced = true;
        events.push({
          i: i, price: p, equity: equity, loss: loss, liqPrice: liqPrice,
          reason: '总资产/负债 = ' + ratio.toFixed(2) + '，低于维持担保比例 ' + maintenance.toFixed(2)
        });
        alive = false;
      }
    }
    var lastState = series[series.length - 1] || {};
    return {
      series: series, events: events, liquidation: events[0] || null,
      finalEquity: alive ? lastState.equity : events[0].equity,
      finalPrice: prices[prices.length - 1], shares: shares, borrow: borrow,
      returnPct: capital ? ((alive ? lastState.equity : events[0].equity) - capital) / capital * 100 : null
    };
  }

  /* ================= portfolio monte carlo ================= */

  // Correlated monthly returns for one stock and a basket. The basket vol is
  // derived from the average correlation, so "diversification" is a mechanism,
  // not a decorative label. Fees and dividends are applied monthly.
  function monteCarlo(opts) {
    var rng = rngFrom(opts.seed || 7);
    var years = opts.years || 10;
    var months = Math.round(years * 12);
    var paths = opts.paths || 300;
    var mu = (opts.muPct == null ? 7 : opts.muPct) / 100;
    var sigma = (opts.sigmaPct == null ? 28 : opts.sigmaPct) / 100;
    var rho = opts.rho == null ? 0.3 : opts.rho;
    var n = opts.basketSize || 30;
    var feeSingle = (opts.feeSinglePct || 0) / 100;
    var feeEtf = (opts.feeEtfPct == null ? 0.15 : opts.feeEtfPct) / 100;
    var divSingle = (opts.divSinglePct || 0) / 100;
    var divEtf = (opts.divEtfPct == null ? 1.8 : opts.divEtfPct) / 100;
    var monthly = opts.monthly || 0;
    var start = opts.start || 100000;
    var etfSigma = sigma * Math.sqrt((1 + (n - 1) * rho) / n);
    var dt = 1 / 12;

    function path(muAnnual, sig, fee, div) {
      var v = start, contributed = start, peak = start, maxDd = 0;
      var arr = [{ m: 0, value: v, contributed: contributed }];
      for (var m = 1; m <= months; m++) {
        var z = gauss(rng);
        var r = (muAnnual - 0.5 * sig * sig) * dt + sig * Math.sqrt(dt) * z;
        v = v * Math.exp(r) - v * fee / 12 + v * div / 12;
        if (monthly) { v += monthly; contributed += monthly; }
        arr.push({ m: m, value: v, contributed: contributed });
        peak = Math.max(peak, v);
        maxDd = Math.max(maxDd, (peak - v) / peak);
      }
      return { arr: arr, values: arr.map(function (x) { return x.value; }), end: v, contributed: contributed, maxDd: maxDd };
    }

    var singles = [], etfs = [], finals = { single: [], etf: [] };
    for (var p = 0; p < paths; p++) {
      var single = path(mu, sigma, feeSingle, divSingle);
      var etf = path(mu - feeEtf, etfSigma, 0, divEtf);
      singles.push(single); etfs.push(etf);
      finals.single.push(single.end); finals.etf.push(etf.end);
    }

    function quant(list) {
      var s = list.slice().sort(function (a, b) { return a - b; });
      return {
        p10: s[Math.floor(s.length * 0.1)], p25: s[Math.floor(s.length * 0.25)],
        p50: s[Math.floor(s.length * 0.5)], p75: s[Math.floor(s.length * 0.75)],
        p90: s[Math.floor(s.length * 0.9)], mean: s.reduce(function (a, b) { return a + b; }, 0) / s.length
      };
    }

    // Deterministic sample paths for drawing (first 40, evenly strided).
    var width = Math.max(1, Math.floor(paths / 40));
    var samples = [];
    for (var k = 0; k < paths; k += width) samples.push(k);

    var avgDdSingle = singles.reduce(function (a, s) { return a + s.maxDd; }, 0) / paths;
    var avgDdEtf = etfs.reduce(function (a, s) { return a + s.maxDd; }, 0) / paths;

    return {
      params: { years: years, months: months, paths: paths, sigma: sigma * 100, etfSigma: etfSigma * 100, rho: rho, n: n, feeEtf: feeEtf * 100, feeSingle: feeSingle * 100 },
      single: { quantiles: quant(finals.single), avgDrawdown: avgDdSingle, sample: singles[0] },
      etf: { quantiles: quant(finals.etf), avgDrawdown: avgDdEtf, sample: etfs[0] },
      samples: samples.map(function (i) { return { single: singles[i].values, etf: etfs[i].values }; }),
      distribution: { single: finals.single, etf: finals.etf },
      etfSigmaPct: etfSigma * 100
    };
  }

  /* ================= supporting helpers ================= */

  // Build a price path with drift/vol used by scenario scenes (H, I).
  function pricePath(opts) {
    var rng = rngFrom(opts.seed || 11);
    var n = opts.n || 120;
    var start = opts.start || 100;
    var drift = (opts.driftPct || 0) / 100 / 252;
    var vol = (opts.volPct || 25) / 100 / Math.sqrt(252);
    var out = [start];
    for (var i = 1; i < n; i++) {
      var r = drift + vol * gauss(rng);
      out.push(r2(Math.max(0.5, out[i - 1] * Math.exp(r))));
    }
    if (opts.gapAt != null && out[opts.gapAt] != null) {
      var factor = 1 - (opts.gapPct || 10) / 100;
      for (var j = opts.gapAt; j < n; j++) out[j] = r2(out[j] * factor);
    }
    return out;
  }

  // Deposit plan vs lump sum, monthly compounding at a fixed rate.
  function dca(opts) {
    var months = Math.round((opts.years || 20) * 12);
    var r = (opts.ratePct || 6) / 100 / 12;
    var monthly = opts.monthly || 1000;
    var lump = opts.lump || 0;
    var out = [];
    var v = lump, contributed = lump;
    for (var m = 0; m <= months; m++) {
      out.push({ m: m, value: v, contributed: contributed });
      v = v * (1 + r) + monthly;
      contributed += monthly;
    }
    return out;
  }

  return {
    orderBook: orderBook,
    ipoDemand: ipoDemand, defaultInvestors: defaultInvestors, clearingPrice: clearingPrice,
    simulateMargin: simulateMargin,
    monteCarlo: monteCarlo,
    pricePath: pricePath, dca: dca,
    rngFrom: rngFrom, gauss: gauss
  };
});
