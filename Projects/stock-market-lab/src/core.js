/* Stock Market Lab — core finance & data engine.
 *
 * Every module must compute through this file so that the same concept never
 * gets two different formulas. Pure functions, no DOM, usable from Node tests.
 *
 * Conventions (also documented in README):
 *   - Prices/amounts are plain numbers; percentage outputs are in percent units
 *     (e.g. 1.44 means 1.44 %), never fractions.
 *   - EMA is seeded with the first value (common in Chinese charting software);
 *     MACD histogram = 2 * (DIF - DEA).
 *   - RSI uses Wilder smoothing.
 *   - "Turnover" is percent of float shares.
 *   - Fees are illustrative and configurable; no single broker's schedule is
 *     treated as the market standard.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.SM = root.SM || {}; root.SM.core = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
  var round = function (v, d) {
    var m = Math.pow(10, d == null ? 2 : d);
    return Math.round((v + (v >= 0 ? 1e-9 : -1e-9)) * m) / m;
  };
  var sum = function (arr) { return arr.reduce(function (a, b) { return a + b; }, 0); };
  var mean = function (arr) { return arr.length ? sum(arr) / arr.length : 0; };
  var isValidNum = function (v) { return typeof v === 'number' && isFinite(v); };

  /* ---------------- basic series ---------------- */

  // Simple moving average. Output aligned to input; null until a full window.
  function ma(values, period) {
    var out = new Array(values.length).fill(null);
    if (period <= 0) return out;
    var acc = 0, count = 0;
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (!isValidNum(v)) { acc = 0; count = 0; continue; }
      acc += v; count++;
      if (count > period) { acc -= values[i - period]; count--; }
      if (count === period) out[i] = acc / period;
    }
    return out;
  }

  // Exponential moving average, seeded with the first finite value.
  function ema(values, period) {
    var out = new Array(values.length).fill(null);
    var k = 2 / (period + 1);
    var prev = null;
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (!isValidNum(v)) continue;
      prev = prev == null ? v : v * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  }

  function stdev(values) {
    var clean = values.filter(isValidNum);
    if (clean.length < 2) return 0;
    var m = mean(clean);
    return Math.sqrt(mean(clean.map(function (v) { return (v - m) * (v - m); })));
  }

  // Wilder-smoothed RSI. First value at index `period`.
  // A flat window has neither gains nor losses; reporting 50 is less
  // misleading than calling it "overbought" at 100.
  function rsiValue(avgG, avgL) {
    if (avgG === 0 && avgL === 0) return 50;
    if (avgL === 0) return 100;
    if (avgG === 0) return 0;
    return 100 - 100 / (1 + avgG / avgL);
  }

  function rsi(closes, period) {
    period = period || 14;
    var out = new Array(closes.length).fill(null);
    if (closes.length <= period) return out;
    var gain = 0, loss = 0;
    for (var i = 1; i <= period; i++) {
      var d = closes[i] - closes[i - 1];
      if (d >= 0) gain += d; else loss -= d;
    }
    var avgG = gain / period, avgL = loss / period;
    out[period] = rsiValue(avgG, avgL);
    for (var j = period + 1; j < closes.length; j++) {
      var ch = closes[j] - closes[j - 1];
      avgG = (avgG * (period - 1) + Math.max(ch, 0)) / period;
      avgL = (avgL * (period - 1) + Math.max(-ch, 0)) / period;
      out[j] = rsiValue(avgG, avgL);
    }
    return out;
  }

  function macd(closes, fast, slow, signal) {
    fast = fast || 12; slow = slow || 26; signal = signal || 9;
    var ef = ema(closes, fast), es = ema(closes, slow);
    var dif = closes.map(function (_, i) {
      return ef[i] == null || es[i] == null ? null : ef[i] - es[i];
    });
    var dea = ema(dif, signal);
    var hist = dif.map(function (v, i) {
      return v == null || dea[i] == null ? null : 2 * (v - dea[i]);
    });
    return { dif: dif, dea: dea, hist: hist };
  }

  function kdj(candles, n, k1, d1) {
    n = n || 9; k1 = k1 || 3; d1 = d1 || 3;
    var K = [], D = [], J = [], pk = 50, pd = 50;
    for (var i = 0; i < candles.length; i++) {
      var from = Math.max(0, i - n + 1);
      var hh = -Infinity, ll = Infinity;
      for (var j = from; j <= i; j++) { hh = Math.max(hh, candles[j].h); ll = Math.min(ll, candles[j].l); }
      var rsv = hh === ll ? 50 : (candles[i].c - ll) / (hh - ll) * 100;
      pk = (k1 - 1) / k1 * pk + rsv / k1;
      pd = (d1 - 1) / d1 * pd + pk / d1;
      K.push(pk); D.push(pd); J.push(3 * pk - 2 * pd);
    }
    return { k: K, d: D, j: J };
  }

  function boll(closes, n, mult) {
    n = n || 20; mult = mult == null ? 2 : mult;
    var mid = ma(closes, n), upper = [], lower = [], width = [];
    for (var i = 0; i < closes.length; i++) {
      if (mid[i] == null) { upper.push(null); lower.push(null); width.push(null); continue; }
      var sd = stdev(closes.slice(i - n + 1, i + 1));
      upper.push(mid[i] + mult * sd);
      lower.push(mid[i] - mult * sd);
      width.push(mid[i] ? (upper[i] - lower[i]) / mid[i] * 100 : null);
    }
    return { mid: mid, upper: upper, lower: lower, width: width };
  }

  // Williams %R: 0 (strong) .. -100 (weak).
  function wr(candles, n) {
    n = n || 14;
    return candles.map(function (c, i) {
      var from = Math.max(0, i - n + 1), hh = -Infinity, ll = Infinity;
      if (i < n - 1) return null;
      for (var j = from; j <= i; j++) { hh = Math.max(hh, candles[j].h); ll = Math.min(ll, candles[j].l); }
      return hh === ll ? -50 : (hh - c.c) / (hh - ll) * -100;
    });
  }

  // Directional movement system (Wilder). Returns DI+, DI-, ADX, ADXR.
  function dmi(candles, n, m) {
    n = n || 14; m = m || 6;
    var tr = [], pdm = [], mdm = [];
    for (var i = 0; i < candles.length; i++) {
      if (i === 0) { tr.push(candles[0].h - candles[0].l); pdm.push(0); mdm.push(0); continue; }
      var p = candles[i - 1];
      tr.push(Math.max(candles[i].h - candles[i].l, Math.abs(candles[i].h - p.c), Math.abs(candles[i].l - p.c)));
      var up = candles[i].h - p.h, dn = p.l - candles[i].l;
      pdm.push(up > dn && up > 0 ? up : 0);
      mdm.push(dn > up && dn > 0 ? dn : 0);
    }
    var str = 0, sp = 0, sm = 0;
    var pdi = new Array(candles.length).fill(null);
    var mdi = new Array(candles.length).fill(null);
    var dx = new Array(candles.length).fill(null);
    for (var k = 0; k < candles.length; k++) {
      if (k < n) { str += tr[k]; sp += pdm[k]; sm += mdm[k]; continue; }
      str = str - str / n + tr[k];
      sp = sp - sp / n + pdm[k];
      sm = sm - sm / n + mdm[k];
      var dip = str === 0 ? 0 : sp / str * 100;
      var dim = str === 0 ? 0 : sm / str * 100;
      pdi[k] = dip; mdi[k] = dim;
      dx[k] = dip + dim === 0 ? 0 : Math.abs(dip - dim) / (dip + dim) * 100;
    }
    var adx = new Array(candles.length).fill(null);
    var valid = [];
    for (var q = 0; q < candles.length; q++) if (dx[q] != null) valid.push(q);
    for (var vi = n - 1; vi < valid.length; vi++) {
      var win = valid.slice(vi - n + 1, vi + 1);
      if (win[win.length - 1] - win[0] !== n - 1) continue;
      adx[valid[vi]] = mean(win.map(function (idx) { return dx[idx]; }));
    }
    var adxr = adx.map(function (v, idx) { return v == null || idx - m < 0 ? null : adx[idx - m] == null ? null : (v + adx[idx - m]) / 2; });
    return { pdi: pdi, mdi: mdi, adx: adx, adxr: adxr, dx: dx };
  }

  function bias(closes, n) {
    var m = ma(closes, n);
    return closes.map(function (c, i) { return m[i] ? (c - m[i]) / m[i] * 100 : null; });
  }

  function obv(candles) {
    var out = [], acc = 0;
    for (var i = 0; i < candles.length; i++) {
      if (i > 0) {
        if (candles[i].c > candles[i - 1].c) acc += candles[i].v;
        else if (candles[i].c < candles[i - 1].c) acc -= candles[i].v;
      }
      out.push(acc);
    }
    return out;
  }

  function cci(candles, n) {
    n = n || 14;
    var tp = candles.map(function (c) { return (c.h + c.l + c.c) / 3; });
    var m = ma(tp, n);
    return tp.map(function (v, i) {
      if (m[i] == null) return null;
      var win = tp.slice(i - n + 1, i + 1);
      var md = mean(win.map(function (x) { return Math.abs(x - m[i]); }));
      return md === 0 ? 0 : (v - m[i]) / (0.015 * md);
    });
  }

  function roc(closes, n) {
    n = n || 12;
    return closes.map(function (c, i) { return i < n || !closes[i - n] ? null : (c / closes[i - n] - 1) * 100; });
  }

  /* ---------------- market maths ---------------- */

  function changePct(prev, cur) { return !prev ? null : (cur / prev - 1) * 100; }
  function amplitude(high, low, prevClose) { return !prevClose ? null : (high - low) / prevClose * 100; }
  function turnover(volume, floatShares) { return !floatShares ? null : volume / floatShares * 100; }
  function marketCap(price, shares) { return price * shares; }
  function eps(profit, shares) { return !shares ? null : profit / shares; }
  function pe(price, epsValue) { return !epsValue || epsValue <= 0 ? null : price / epsValue; }
  function pb(price, bvps) { return !bvps || bvps <= 0 ? null : price / bvps; }
  function roe(profit, equity) { return !equity ? null : profit / equity * 100; }
  function dividendYield(dps, price) { return !price ? null : dps / price * 100; }
  function enterpriseValue(mcap, debt, cash) { return mcap + (debt || 0) - (cash || 0); }
  function grossMargin(revenue, cost) { return !revenue ? null : (revenue - cost) / revenue * 100; }
  function netMargin(profit, revenue) { return !revenue ? null : profit / revenue * 100; }
  function payoutRatio(dps, epsValue) { return !epsValue ? null : dps / epsValue * 100; }

  /* ---------------- corporate actions ---------------- */

  // n-for-1 split: shares x n, price / n, market value unchanged.
  function split(opts) {
    var ratio = opts.ratio || 2;
    var shares = opts.shares * ratio;
    var price = opts.price / ratio;
    return {
      ratio: ratio, shares: shares, price: price,
      marketValueBefore: opts.shares * opts.price,
      marketValueAfter: shares * price,
      epsBefore: opts.profit != null ? opts.profit / opts.shares : null,
      epsAfter: opts.profit != null ? opts.profit / shares : null
    };
  }

  // Primary issuance (增发/IPO). New shares sold at `price`; company receives
  // `newShares * price` (gross, before underwriting fees).
  function issuance(opts) {
    var preShares = opts.preShares, newShares = opts.newShares, price = opts.price;
    var prePrice = opts.prePrice == null ? price : opts.prePrice;
    var postShares = preShares + newShares;
    var proceeds = newShares * price;
    var postValue = preShares * prePrice + proceeds;
    var postPrice = postValue / postShares;
    return {
      preShares: preShares, newShares: newShares, postShares: postShares,
      proceeds: proceeds, postPrice: postPrice,
      preValue: preShares * prePrice, postValue: postValue,
      dilutionPct: postShares ? newShares / postShares * 100 : null,
      founderStakeAfter: preShares / postShares * 100,
      epsBefore: opts.profit != null ? opts.profit / preShares : null,
      epsAfter: opts.profit != null ? opts.profit / postShares : null,
      pe: opts.profit != null ? postValue / opts.profit : null
    };
  }

  // Cash dividend: company pays shares * dps, price drops by dps on ex-date
  // (all else equal). Total return must include the cash.
  function dividend(opts) {
    var shares = opts.shares, dps = opts.dps, price = opts.price;
    var cash = shares * dps;
    var exPrice = price - dps;
    return {
      cash: cash, exPrice: exPrice, dripShares: exPrice > 0 ? cash / exPrice : 0,
      yieldPct: price ? dps / price * 100 : null,
      totalValue: shares * exPrice + cash,
      valueBefore: shares * price
    };
  }

  function buyback(opts) {
    var price = opts.price, cash = opts.cash;
    var repurchased = Math.min(opts.shares, Math.floor(cash / price));
    var postShares = opts.shares - repurchased;
    return {
      repurchased: repurchased, postShares: postShares, spent: repurchased * price,
      epsBefore: opts.profit != null ? opts.profit / opts.shares : null,
      epsAfter: opts.profit != null && postShares ? opts.profit / postShares : null
    };
  }

  // Stock-for-stock acquisition: buyer issues new shares worth target value+premium.
  function merger(opts) {
    var dealValue = opts.targetValue * (1 + (opts.premiumPct || 0) / 100);
    var newShares = dealValue / opts.acquirerPrice;
    var postShares = opts.acquirerShares + newShares;
    var combinedProfit = (opts.acquirerProfit || 0) + (opts.targetProfit || 0);
    return {
      dealValue: dealValue, newShares: newShares, postShares: postShares,
      targetStakePct: newShares / postShares * 100,
      acquirerStakePct: opts.acquirerShares / postShares * 100,
      epsBefore: opts.acquirerProfit != null ? opts.acquirerProfit / opts.acquirerShares : null,
      epsAfter: combinedProfit && postShares ? combinedProfit / postShares : null
    };
  }

  /* ---------------- trading costs ---------------- */

  // Configurable, illustrative fee model. Rates are fractions (0.00025 = 0.025 %).
  function fees(opts) {
    var market = opts.market === 'us' ? 'us' : 'cn';
    var amount = opts.price * opts.qty;
    var side = opts.side === 'sell' ? 'sell' : 'buy';
    var out = { market: market, side: side, amount: amount, commission: 0, stamp: 0, transfer: 0, secFee: 0, taf: 0, other: 0 };
    if (market === 'cn') {
      var rate = opts.commissionRate == null ? 0.00025 : opts.commissionRate;
      var minC = opts.minCommission == null ? 5 : opts.minCommission;
      out.commission = Math.max(amount * rate, minC);
      out.stamp = side === 'sell' ? amount * (opts.stampRate == null ? 0.0005 : opts.stampRate) : 0;
      out.transfer = amount * (opts.transferRate == null ? 0.00001 : opts.transferRate);
    } else {
      var perShare = opts.usCommissionPerShare || 0;
      out.commission = Math.max(amount * (opts.commissionRate || 0), perShare * opts.qty, opts.minCommission || 0);
      if (side === 'sell') {
        out.secFee = amount * (opts.secFeeRate == null ? 0.0000278 : opts.secFeeRate);
        out.taf = Math.min((opts.tafPerShare == null ? 0.000166 : opts.tafPerShare) * opts.qty, opts.tafMax == null ? 8.3 : opts.tafMax);
      }
    }
    out.other = opts.otherFee || 0;
    out.total = out.commission + out.stamp + out.transfer + out.secFee + out.taf + out.other;
    out.totalRate = amount ? out.total / amount * 100 : null;
    out.cashDelta = side === 'buy' ? -(amount + out.total) : amount - out.total;
    return out;
  }

  /* ---------------- leverage ---------------- */

  // Fully-invested margin position: own capital + borrowed cash buys shares.
  function leverage(opts) {
    var capital = opts.capital, borrow = opts.borrow || 0;
    var price0 = opts.price0, price1 = opts.price1 == null ? price0 : opts.price1;
    var days = opts.days || 0, rate = opts.rate || 0;
    var shares = price0 > 0 ? (capital + borrow) / price0 : 0;
    var debt = borrow * (1 + rate * days / 365);
    var assets = shares * price1;
    var net = assets - debt;
    var ratio = debt > 0 ? assets / debt : null;
    var maintenance = opts.maintenance == null ? 1.3 : opts.maintenance;
    var liqPrice = liquidationPrice({ capital: capital, borrow: borrow, rate: rate, days: days, price0: price0, maintenance: maintenance });
    return {
      shares: shares, debt: debt, assets: assets, net: net,
      pnl: net - capital,
      returnPct: capital ? (net - capital) / capital * 100 : null,
      priceReturnPct: price0 ? (price1 / price0 - 1) * 100 : null,
      ratio: ratio, maintenance: maintenance,
      marginCall: ratio != null && ratio < maintenance,
      liqPrice: liqPrice,
      interest: debt - borrow
    };
  }

  // Price at which equity/debt = maintenance ratio.
  // Accepts either an actual position ({shares, debt}) or the loan terms
  // ({capital, borrow, price0, rate, days}).
  function liquidationPrice(opts) {
    var maintenance = opts.maintenance == null ? 1.3 : opts.maintenance;
    var shares = opts.shares, debt = opts.debt;
    if (!(shares > 0) || !(debt > 0)) {
      var borrow = opts.borrow || 0;
      if (!borrow || !(opts.price0 > 0)) return 0;
      shares = (opts.capital + borrow) / opts.price0;
      debt = borrow * (1 + (opts.rate || 0) * (opts.days || 0) / 365);
    }
    if (!(shares > 0) || !(debt > 0)) return 0;
    return debt * maintenance / shares;
  }

  // Extra cash needed to restore assets/debt = maintenance.
  function marginDeposit(state) {
    if (!(state.debt > 0)) return 0;
    var assets = state.assets != null ? state.assets : (state.net || 0) + state.debt;
    return Math.max(0, state.maintenance * state.debt - assets);
  }

  /* ---------------- return / valuation over time ---------------- */

  function cagr(begin, end, years) {
    if (!begin || begin <= 0 || years <= 0) return null;
    return (Math.pow(end / begin, 1 / years) - 1) * 100;
  }

  function totalReturn(opts) {
    var dividends = opts.dividends || 0;
    var end = opts.endPrice + dividends;
    return {
      priceReturnPct: opts.startPrice ? (opts.endPrice / opts.startPrice - 1) * 100 : null,
      totalReturnPct: opts.startPrice ? (end / opts.startPrice - 1) * 100 : null,
      endValue: opts.shares != null ? opts.shares * end : end
    };
  }

  // Monthly contribution future value, rate in percent per year.
  function futureValue(opts) {
    var monthly = opts.monthly || 0, years = opts.years || 0;
    var r = (opts.annualRatePct || 0) / 100 / 12;
    var n = Math.round(years * 12);
    var fvLump = (opts.lump || 0) * Math.pow(1 + r, n);
    var fvContrib = r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r);
    return { months: n, fv: fvLump + fvContrib, contributed: (opts.lump || 0) + monthly * n };
  }

  function realReturn(nominalPct, inflationPct) {
    return ((1 + nominalPct / 100) / (1 + inflationPct / 100) - 1) * 100;
  }

  /* ---------------- indices / ETF ---------------- */

  // Capitalisation-weighted index level from a basket.
  function capWeightedLevel(stocks, divisor, base) {
    var total = sum(stocks.map(function (s) { return s.price * s.shares; }));
    return { level: total / divisor, totalCap: total, base: base || null };
  }

  function etfNAV(holdings, sharesOutstanding) {
    var nav = sum(holdings.map(function (h) { return h.price * h.qty; }));
    return { nav: nav, perShare: sharesOutstanding ? nav / sharesOutstanding : null };
  }

  function premiumPct(price, navPerShare) {
    return !navPerShare ? null : (price / navPerShare - 1) * 100;
  }

  /* ---------------- candles ---------------- */

  var INTRADAY = { '1m': 60e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3, '60m': 3600e3 };
  var PERIODS = ['1m', '5m', '15m', '30m', '60m', 'D', 'W', 'M'];
  var PERIOD_LABEL = { '1m': '1 分钟', '5m': '5 分钟', '15m': '15 分钟', '30m': '30 分钟', '60m': '60 分钟', D: '日 K', W: '周 K', M: '月 K' };

  // Intraday buckets are anchored to the A-share sessions (09:30, 13:00) so a
  // 60-minute bar is 09:30-10:29, not 09:00-09:59.
  function bucketStart(t, period) {
    var d = new Date(t);
    if (INTRADAY[period]) {
      var spanMin = INTRADAY[period] / 60000;
      var mins = d.getHours() * 60 + d.getMinutes();
      var anchor = null;
      if (mins >= 570 && mins < 690) anchor = 570;
      else if (mins >= 780 && mins < 900) anchor = 780;
      if (anchor == null) return Math.floor(t / INTRADAY[period]) * INTRADAY[period];
      var step = Math.floor((mins - anchor) / spanMin);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, anchor + step * spanMin).getTime();
    }
    if (period === 'D') return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    if (period === 'W') {
      var offset = (d.getDay() + 6) % 7;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset).getTime();
    }
    if (period === 'M') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    return t;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function periodLabel(t, period) {
    var d = new Date(t);
    if (INTRADAY[period]) return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    if (period === 'D') return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    if (period === 'W') {
      var end = new Date(t); end.setDate(end.getDate() + 6);
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' → ' + pad2(end.getMonth() + 1) + '-' + pad2(end.getDate());
    }
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }

  // Aggregate one base series into a higher period. O = first open, C = last
  // close, H/L = extremes, V = sum. Never generates a separate series per
  // period, so periods can't contradict each other.
  function aggregate(candles, period) {
    if (!candles || !candles.length) return [];
    var sorted = candles.slice().sort(function (a, b) { return a.t - b.t; });
    var out = [], cur = null;
    for (var i = 0; i < sorted.length; i++) {
      var c = sorted[i];
      var key = bucketStart(c.t, period);
      if (!cur || cur.t !== key) {
        if (cur) out.push(cur);
        cur = {
          t: key, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v || 0,
          amount: c.amount || 0, count: 1, firstT: c.t, lastT: c.t,
          label: periodLabel(key, period), source: c.source
        };
      } else {
        cur.h = Math.max(cur.h, c.h);
        cur.l = Math.min(cur.l, c.l);
        cur.c = c.c;
        cur.v += c.v || 0;
        cur.amount += c.amount || 0;
        cur.count++;
        cur.lastT = c.t;
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  function validateOHLC(c) {
    var errs = [];
    ['o', 'h', 'l', 'c'].forEach(function (k) {
      if (!isValidNum(c[k])) errs.push(k + ' 不是有效数字');
    });
    if (errs.length) return errs;
    if (c.l > Math.min(c.o, c.c) + 1e-9) errs.push('最低价高于开盘/收盘中的较小值');
    if (c.h < Math.max(c.o, c.c) - 1e-9) errs.push('最高价低于开盘/收盘中的较大值');
    if (c.h < c.l) errs.push('最高价低于最低价');
    return errs;
  }

  function candleType(c) {
    if (c.c > c.o) return 'yang';
    if (c.c < c.o) return 'yin';
    return 'doji';
  }

  // Body / shadow proportions, useful for pattern teaching.
  function candleAnatomy(c) {
    var range = c.h - c.l;
    var body = Math.abs(c.c - c.o);
    return {
      range: range,
      body: body,
      upper: c.h - Math.max(c.o, c.c),
      lower: Math.min(c.o, c.c) - c.l,
      bodyPct: range ? body / range * 100 : 0,
      upperPct: range ? (c.h - Math.max(c.o, c.c)) / range * 100 : 0,
      lowerPct: range ? (Math.min(c.o, c.c) - c.l) / range * 100 : 0,
      type: candleType(c),
      doji: range > 0 && body / range <= 0.1
    };
  }

  function aggregateStats(candles) {
    var hi = -Infinity, lo = Infinity, vol = 0;
    candles.forEach(function (c) { hi = Math.max(hi, c.h); lo = Math.min(lo, c.l); vol += c.v || 0; });
    return { high: hi, low: lo, volume: vol, bars: candles.length };
  }

  /* ---------------- misc ---------------- */

  function quantile(values, p) {
    var a = values.slice().sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    var idx = (a.length - 1) * p, lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (idx - lo);
  }

  function correlation(a, b) {
    var n = Math.min(a.length, b.length);
    if (n < 2) return null;
    var x = a.slice(0, n), y = b.slice(0, n);
    var mx = mean(x), my = mean(y);
    var num = 0, dx = 0, dy = 0;
    for (var i = 0; i < n; i++) {
      num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) * (x[i] - mx); dy += (y[i] - my) * (y[i] - my);
    }
    return dx && dy ? num / Math.sqrt(dx * dy) : 0;
  }

  return {
    clamp: clamp, round: round, sum: sum, mean: mean, stdev: stdev,
    ma: ma, sma: ma, ema: ema,
    rsi: rsi, macd: macd, kdj: kdj, boll: boll, wr: wr, dmi: dmi, bias: bias,
    obv: obv, cci: cci, roc: roc,
    changePct: changePct, amplitude: amplitude, turnover: turnover,
    marketCap: marketCap, eps: eps, pe: pe, pb: pb, roe: roe,
    dividendYield: dividendYield, enterpriseValue: enterpriseValue,
    grossMargin: grossMargin, netMargin: netMargin, payoutRatio: payoutRatio,
    split: split, issuance: issuance, dividend: dividend, buyback: buyback, merger: merger,
    fees: fees, leverage: leverage, liquidationPrice: liquidationPrice, marginDeposit: marginDeposit,
    cagr: cagr, totalReturn: totalReturn, futureValue: futureValue, realReturn: realReturn,
    capWeightedLevel: capWeightedLevel, etfNAV: etfNAV, premiumPct: premiumPct,
    aggregate: aggregate, bucketStart: bucketStart, periodLabel: periodLabel,
    validateOHLC: validateOHLC, candleType: candleType, candleAnatomy: candleAnatomy,
    aggregateStats: aggregateStats, quantile: quantile, correlation: correlation,
    INTRADAY: INTRADAY, PERIODS: PERIODS, PERIOD_LABEL: PERIOD_LABEL, isValidNum: isValidNum
  };
});
