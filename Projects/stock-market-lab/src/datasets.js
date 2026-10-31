/* Stock Market Lab — deterministic synthetic data + local file import.
 *
 * Every series is generated from an explicit seed, so tests and screenshots
 * are reproducible. Nothing here is a real quote, and nothing touches the
 * network. Imported files stay in memory unless the user asks to keep them.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.SM = root.SM || {}; root.SM.datasets = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ---------------- deterministic RNG ---------------- */

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gaussian(rng) {
    var u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function hashSeed(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ---------------- calendars ---------------- */

  function isWeekend(d) { var w = d.getDay(); return w === 0 || w === 6; }

  function tradingDays(endISO, count) {
    var out = [];
    var d = new Date(endISO + 'T15:00:00');
    while (out.length < count) {
      if (!isWeekend(d)) out.unshift(new Date(d.getTime()));
      d.setDate(d.getDate() - 1);
    }
    return out;
  }

  var CN_SESSIONS = [
    { h: 9, m: 30, n: 120 },   // 09:30–11:29
    { h: 13, m: 0, n: 120 }    // 13:00–14:59
  ];

  function intradayStamps(days) {
    var stamps = [];
    days.forEach(function (day) {
      CN_SESSIONS.forEach(function (s) {
        for (var i = 0; i < s.n; i++) {
          stamps.push(new Date(day.getFullYear(), day.getMonth(), day.getDate(), s.h, s.m + i).getTime());
        }
      });
    });
    return stamps;
  }

  /* ---------------- generators ---------------- */

  var PRESETS = {
    'trend-up': { key: 'trend-up', label: '持续上涨', desc: '斜率稳定、回撤较小的上行趋势', seed: 101, drift: 0.32, vol: 0.14, gap: 0.15, volume: 2.4e8, market: 'cn' },
    'trend-down': { key: 'trend-down', label: '持续下跌', desc: '重心不断下移，反弹乏力', seed: 202, drift: -0.30, vol: 0.19, gap: 0.2, volume: 2.6e8, market: 'cn' },
    'volatile': { key: 'volatile', label: '高波动震荡', desc: '大阳大阴交替，区间内反复', seed: 303, drift: 0.02, vol: 0.42, gap: 0.35, volume: 3.2e8, market: 'cn' },
    'quiet': { key: 'quiet', label: '低波动横盘', desc: '窄幅整理，影线很短', seed: 404, drift: 0.01, vol: 0.07, gap: 0.06, volume: 1.5e8, market: 'cn' },
    'gaps': { key: 'gaps', label: '跳空行情', desc: '开盘直接跳过前收，留下缺口', seed: 505, drift: 0.10, vol: 0.24, gap: 0.9, volume: 2.8e8, market: 'cn' },
    'volume-spike': { key: 'volume-spike', label: '放量与缩量', desc: '价格平稳，但成交量出现突增', seed: 606, drift: 0.12, vol: 0.16, gap: 0.12, volume: 2.2e8, volumeSpikes: true, market: 'cn' },
    'reversal': { key: 'reversal', label: '趋势反转', desc: '前半段上涨，后半段转弱', seed: 707, drift: 0.30, vol: 0.20, gap: 0.18, volume: 2.5e8, regimeAt: 0.55, regimeDrift: -0.55, market: 'cn' },
    'us-tech': { key: 'us-tech', label: '美股成长股（示例）', desc: '高波动上行，用于跨市场对比', seed: 808, drift: 0.26, vol: 0.30, gap: 0.5, volume: 5.2e7, market: 'us' }
  };

  var PRESET_ORDER = ['trend-up', 'trend-down', 'volatile', 'quiet', 'gaps', 'volume-spike', 'reversal', 'us-tech'];

  function makeDaily(presetKey, count) {
    var preset = PRESETS[presetKey] || PRESETS['trend-up'];
    count = count || 150;
    var rng = mulberry32(preset.seed);
    var days = tradingDays('2026-10-30', count);
    var price = preset.market === 'us' ? 128 : 32;
    var candles = [];
    var dt = 1 / 252;
    for (var i = 0; i < days.length; i++) {
      var drift = preset.drift;
      if (preset.regimeAt != null && i / days.length > preset.regimeAt) drift = preset.regimeDrift;
      var z = gaussian(rng);
      var ret = (drift - 0.5 * preset.vol * preset.vol) * dt + preset.vol * Math.sqrt(dt) * z;
      var prevClose = price;
      price = Math.max(0.5, price * Math.exp(ret));
      var gap = gaussian(rng) * preset.gap * preset.vol * Math.sqrt(dt) * prevClose * 6;
      var open = Math.max(0.2, prevClose + gap);
      var close = price;
      var wick = (0.25 + rng() * 0.9) * Math.abs(close - open) + prevClose * preset.vol * Math.sqrt(dt) * (0.4 + rng());
      var high = Math.max(open, close) + wick * (0.35 + rng() * 0.65);
      var low = Math.min(open, close) - wick * (0.35 + rng() * 0.65);
      low = Math.max(0.05, low);
      var vol = preset.volume * (0.55 + 0.9 * Math.abs(close / prevClose - 1) / (preset.vol * Math.sqrt(dt) + 1e-9));
      vol *= 0.6 + rng() * 0.8;
      if (preset.volumeSpikes && rng() < 0.07) vol *= 2.6 + rng() * 1.8;
      var day = days[i];
      candles.push({
        t: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 15, 0).getTime(),
        o: +open.toFixed(2), h: +high.toFixed(2), l: +low.toFixed(2), c: +close.toFixed(2),
        v: Math.round(vol), amount: Math.round(vol * close),
        label: day.getFullYear() + '-' + pad2(day.getMonth() + 1) + '-' + pad2(day.getDate()),
        source: 'sim', preset: preset.key
      });
    }
    return candles;
  }

  function makeIntraday(seed, days) {
    var rng = mulberry32(seed || 909);
    var baseDays = tradingDays('2026-10-30', days || 5);
    var stamps = intradayStamps(baseDays);
    var price = 42.5, candles = [];
    for (var i = 0; i < stamps.length; i++) {
      var open = price;
      var step = price * (0.0006 + rng() * 0.0016) * gaussian(rng);
      price = Math.max(1, price + step);
      var close = price;
      var wick = price * (0.0004 + rng() * 0.0012);
      var high = Math.max(open, close) + wick * rng();
      var low = Math.min(open, close) - wick * rng();
      var vol = Math.round(180000 * (0.4 + rng() * 1.2) * (1 + Math.abs(close / open - 1) * 400));
      candles.push({
        t: stamps[i], o: +open.toFixed(2), h: +high.toFixed(2), l: +low.toFixed(2), c: +close.toFixed(2),
        v: vol, amount: Math.round(vol * close), label: timeLabel(stamps[i]), source: 'sim', preset: 'intraday'
      });
    }
    return candles;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function timeLabel(t) {
    var d = new Date(t);
    return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function heroCandles() {
    var daily = makeDaily('reversal', 320);
    var weekly = aggregateLocal(daily, 'W').slice(-64);
    // Rescale the synthetic series onto the teaching range 3574.27–4258.86 so
    // the hero figure reads like the SSE Composite weekly chart it imitates.
    var hi = -Infinity, lo = Infinity;
    weekly.forEach(function (c) { hi = Math.max(hi, c.h); lo = Math.min(lo, c.l); });
    var top = 4258.86, bot = 3574.27;
    var a = (top - bot) / (hi - lo), b = top - a * hi;
    return weekly.map(function (c) {
      return Object.assign({}, c, {
        o: Math.round((a * c.o + b) * 100) / 100,
        h: Math.round((a * c.h + b) * 100) / 100,
        l: Math.round((a * c.l + b) * 100) / 100,
        c: Math.round((a * c.c + b) * 100) / 100
      });
    });
  }

  // Local copy of aggregation so datasets.js has no hard dependency on core.js.
  function aggregateLocal(candles, period) {
    var byKey = {}, order = [];
    candles.forEach(function (c) {
      var d = new Date(c.t);
      var key;
      if (period === 'W') {
        var off = (d.getDay() + 6) % 7;
        key = new Date(d.getFullYear(), d.getMonth(), d.getDate() - off).getTime();
      } else {
        key = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      }
      if (!byKey[key]) {
        byKey[key] = { t: key, o: c.o, h: c.h, l: c.l, c: c.c, v: 0, amount: 0, firstT: c.t, lastT: c.t };
        order.push(key);
      }
      var g = byKey[key];
      g.h = Math.max(g.h, c.h); g.l = Math.min(g.l, c.l); g.c = c.c;
      g.v += c.v || 0; g.amount += c.amount || 0; g.lastT = c.t;
    });
    return order.map(function (k) {
      var g = byKey[k], d = new Date(k);
      g.label = period === 'W'
        ? d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
        : d.getFullYear() + '-' + pad2(d.getMonth() + 1);
      g.source = 'sim';
      return g;
    });
  }

  function indexSnapshot() {
    // Illustrative snapshot. Values are generated, not quotes.
    return [
      { code: '000001', name: '上证指数', en: 'SSE COMPOSITE', value: 3862.41, pct: 0.71, sim: true },
      { code: '399001', name: '深证成指', en: 'SZSE COMPONENT', value: 12480.63, pct: -0.32, sim: true },
      { code: '000300', name: '沪深 300', en: 'CSI 300', value: 4521.88, pct: 0.44, sim: true },
      { code: 'SPX', name: '标普 500', en: 'S&P 500', value: 6210.5, pct: 0.18, sim: true }
    ];
  }

  /* ---------------- import ---------------- */

  var ALIASES = {
    t: ['date', 'datetime', 'time', 'timestamp', 'day', 't'],
    o: ['open', 'o', 'openprice', '开盘', '开盘价'],
    h: ['high', 'h', 'highprice', '最高', '最高价'],
    l: ['low', 'l', 'lowprice', '最低', '最低价'],
    c: ['close', 'c', 'closeprice', '收盘', '收盘价'],
    v: ['volume', 'vol', 'v', '成交量'],
    amount: ['amount', 'turnovervalue', '成交额', '成交金额'],
    code: ['code', 'symbol', 'ticker', '证券代码', '代码'],
    market: ['market', '市场'],
    adjusted: ['adjusted', 'adj', '复权', '复权方式']
  };

  function normalizeKey(k) { return String(k).trim().toLowerCase().replace(/[\s_\-()]/g, ''); }

  function buildHeaderMap(headerCells) {
    var map = {};
    headerCells.forEach(function (raw, idx) {
      var key = normalizeKey(raw);
      Object.keys(ALIASES).forEach(function (field) {
        if (ALIASES[field].some(function (a) { return normalizeKey(a) === key; })) map[field] = idx;
      });
    });
    return map;
  }

  function toNumber(v) {
    if (typeof v === 'number') return v;
    if (v == null) return NaN;
    var s = String(v).trim().replace(/[,%$\u00a5\u20ac\s]/g, '');
    if (!s || s === '-' || s === '--') return NaN;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  function parseDateValue(v) {
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v > 1e11 ? v : v * 1000;
    var s = String(v == null ? '' : v).trim();
    if (!s) return NaN;
    if (/^\d{10}$/.test(s)) return Number(s) * 1000;
    if (/^\d{13}$/.test(s)) return Number(s);
    s = s.replace(/\//g, '-');
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
      return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
    }
    var parsed = Date.parse(s);
    return isFinite(parsed) ? parsed : NaN;
  }

  function detectDelimiter(line) {
    var candidates = [',', '\t', ';'];
    var best = ',', bestCount = -1;
    candidates.forEach(function (d) {
      var n = line.split(d).length;
      if (n > bestCount) { bestCount = n; best = d; }
    });
    return best;
  }

  function splitCsvLine(line, delimiter) {
    // Minimal quote support: "a,b",c
    var out = [], cur = '', quoted = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === delimiter && !quoted) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map(function (s) { return s.trim(); });
  }

  function rowsFromCSV(text) {
    var lines = text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/).filter(function (l) { return l.trim() !== ''; });
    if (lines.length < 2) throw new Error('CSV 至少需要一行表头和一行数据');
    var delim = detectDelimiter(lines[0]);
    var header = splitCsvLine(lines[0], delim);
    var headerMap = buildHeaderMap(header);
    if (headerMap.t == null || headerMap.o == null || headerMap.h == null || headerMap.l == null || headerMap.c == null) {
      // Maybe no header: expect date,o,h,l,c[,v]
      var first = splitCsvLine(lines[0], delim);
      if (!isNaN(parseDateValue(first[0]))) {
        headerMap = { t: 0, o: 1, h: 2, l: 3, c: 4, v: first.length > 5 ? 5 : null };
        return { rows: lines.map(function (l) { return splitCsvLine(l, delim); }), headerMap: headerMap, hasHeader: false };
      }
      throw new Error('找不到必需的列：date/open/high/low/close');
    }
    return { rows: lines.slice(1).map(function (l) { return splitCsvLine(l, delim); }), headerMap: headerMap, hasHeader: true };
  }

  function rowsFromJSON(parsed) {
    var list = Array.isArray(parsed) ? parsed
      : parsed && Array.isArray(parsed.candles) ? parsed.candles
        : parsed && Array.isArray(parsed.data) ? parsed.data
          : parsed && Array.isArray(parsed.rows) ? parsed.rows : null;
    if (!list) throw new Error('JSON 必须是数组，或包含 candles / data / rows 数组');
    return list.map(function (item) {
      if (Array.isArray(item)) return item;
      return item;
    });
  }

  function normalizeRows(rawRows, opts) {
    opts = opts || {};
    var errors = [], warnings = [], candles = [], hasVolume = false, codes = {}, markets = {};
    var headerMap = opts.headerMap;
    var limit = 16;
    rawRows.forEach(function (row, i) {
      var get = function (field) {
        if (Array.isArray(row)) {
          var idx = headerMap ? headerMap[field] : null;
          return idx == null ? undefined : row[idx];
        }
        if (row && typeof row === 'object') {
          var found;
          Object.keys(row).forEach(function (k) {
            if (found !== undefined) return;
            var nk = normalizeKey(k);
            if (ALIASES[field] && ALIASES[field].some(function (a) { return normalizeKey(a) === nk; })) found = row[k];
          });
          return found;
        }
        return undefined;
      };
      var t = parseDateValue(get('t'));
      var o = toNumber(get('o')), h = toNumber(get('h')), l = toNumber(get('l')), c = toNumber(get('c'));
      var v = toNumber(get('v'));
      var amount = toNumber(get('amount'));
      var code = get('code'), market = get('market'), adjusted = get('adjusted');
      var rowNo = i + (opts.hasHeader === false ? 1 : 2);
      if (!isFinite(t)) { if (errors.length < limit) errors.push({ row: rowNo, message: '时间无法解析' }); return; }
      if ([o, h, l, c].some(function (x) { return !isFinite(x); })) {
        if (errors.length < limit) errors.push({ row: rowNo, message: 'OHLC 含有非法数字' });
        return;
      }
      var errs = [];
      if (l > Math.min(o, c) + 1e-9) errs.push('low 高于 min(open, close)');
      if (h < Math.max(o, c) - 1e-9) errs.push('high 低于 max(open, close)');
      if (h < l) errs.push('high 低于 low');
      if (errs.length) {
        if (errors.length < limit) errors.push({ row: rowNo, message: errs.join('；') });
        return;
      }
      if (isFinite(v)) hasVolume = true;
      if (code) codes[String(code)] = (codes[String(code)] || 0) + 1;
      if (market) markets[String(market)] = true;
      candles.push({
        t: t, o: o, h: h, l: l, c: c, v: isFinite(v) ? Math.max(0, v) : 0,
        amount: isFinite(amount) ? amount : null,
        code: code || null, market: market || null, adjusted: adjusted || null,
        source: 'import', label: timeLabel(t)
      });
    });

    candles.sort(function (a, b) { return a.t - b.t; });
    var dedup = [], dropped = 0;
    candles.forEach(function (c) {
      var last = dedup[dedup.length - 1];
      if (last && last.t === c.t) { dedup[dedup.length - 1] = c; dropped++; }
      else dedup.push(c);
    });
    if (dropped) warnings.push('发现 ' + dropped + ' 个重复时间戳，已保留后一条');
    for (var i = 1; i < dedup.length; i++) {
      var jump = dedup[i].o / dedup[i - 1].c - 1;
      if (Math.abs(jump) > 0.5) { warnings.push('第 ' + (i + 1) + ' 根 K 线相对前收跳变 ' + (jump * 100).toFixed(1) + '%，请确认数据或复权方式'); break; }
    }
    if (!hasVolume) warnings.push('没有可用的成交量列：成交量与成交量类指标将显示为 0，不代表真实无成交');
    if (!dedup.length) errors.push({ row: 0, message: '没有任何有效数据行' });

    var meta = {
      sourceName: opts.sourceName || '本地文件',
      importedAt: new Date().toISOString(),
      rows: rawRows.length,
      accepted: dedup.length,
      from: dedup.length ? dedup[0].t : null,
      to: dedup.length ? dedup[dedup.length - 1].t : null,
      hasVolume: hasVolume,
      codes: Object.keys(codes),
      markets: Object.keys(markets),
      timezone: '按本地时区解释（未带时区的日期）',
      currency: opts.currency || '未说明',
      adjusted: opts.adjusted || (dedup[0] && dedup[0].adjusted) || '未说明',
      period: opts.period || '未说明'
    };
    return { ok: dedup.length > 0, candles: dedup, meta: meta, errors: errors, warnings: warnings };
  }

  function parseImport(text, opts) {
    opts = opts || {};
    var sourceName = opts.sourceName || '粘贴的数据';
    function failed(message) {
      return { ok: false, candles: [], meta: { sourceName: sourceName, rows: 0 }, errors: [message], warnings: [] };
    }
    var trimmed = String(text || '').trim();
    if (!trimmed) return failed('内容为空');
    try {
      if (trimmed[0] === '[' || trimmed[0] === '{') {
        var parsed;
        try { parsed = JSON.parse(trimmed); } catch (e) { return failed('JSON 解析失败：' + e.message); }
        var rows = rowsFromJSON(parsed);
        return normalizeRows(rows, { sourceName: sourceName, hasHeader: false });
      }
      var csv = rowsFromCSV(trimmed);
      return normalizeRows(csv.rows, { sourceName: sourceName, headerMap: csv.headerMap, hasHeader: csv.hasHeader });
    } catch (e) {
      return failed(e && e.message ? e.message : '无法解析输入');
    }
  }

  function toCSV(candles) {
    var head = 'date,open,high,low,close,volume\n';
    return head + candles.map(function (c) {
      var d = new Date(c.t);
      return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' '
        + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ','
        + c.o + ',' + c.h + ',' + c.l + ',' + c.c + ',' + (c.v || 0);
    }).join('\n') + '\n';
  }

  function templateCSV() { return toCSV(makeDaily('trend-up', 30)); }

  return {
    mulberry32: mulberry32, gaussian: gaussian, hashSeed: hashSeed,
    PRESETS: PRESETS, PRESET_ORDER: PRESET_ORDER,
    makeDaily: makeDaily, makeIntraday: makeIntraday, heroCandles: heroCandles,
    aggregateLocal: aggregateLocal, indexSnapshot: indexSnapshot,
    parseImport: parseImport, normalizeRows: normalizeRows,
    toCSV: toCSV, templateCSV: templateCSV, parseDateValue: parseDateValue,
    CN_SESSIONS: CN_SESSIONS
  };
});
