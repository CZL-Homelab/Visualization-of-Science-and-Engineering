/* Module C — volume, moving-average windows, MA systems, RSI/MACD and
 * eight extended indicators. Every number is computed by SM.core; the
 * synthetic series come from SM.datasets with a fixed seed. */
(function () {
  'use strict';
  var SM = window.SM;
  var ui = SM.ui, core = SM.core, charts = SM.charts, ds = SM.datasets;

  var FLOAT_SHARES = 6e9;           // teaching assumption: 60 亿股流通股本
  var C3_BARS = 33;
  var C3_EDIT_INDEX = 30;           // window middle when the window ends at bar 33
  var C3_BASE = [
    9.20, 9.34, 9.28, 9.42, 9.55, 9.61, 9.48, 9.36, 9.44, 9.58,
    9.66, 9.72, 9.61, 9.49, 9.38, 9.46, 9.60, 9.74, 9.81, 9.69,
    9.57, 9.45, 9.33, 9.21, 9.29, 9.42, 9.56, 9.68,
    10.00, 11.00, 12.00, 11.00, 13.00
  ];

  var DEFAULT = {
    mode: 'c1',
    c1Preset: 'volume-spike', c1Mult: 1.5,
    c2Case: 'upVol', c2Window: 100,
    c3Window: C3_BARS - 5, c3EditVal: 12,
    ma: { 5: true, 10: true, 20: true, 60: false }, c4Lag: 0,
    c5Ind: 'rsi', c5Rsi: 14, c5Fast: 12, c5Slow: 26, c5Signal: 9,
    c6Ind: 'kdj',
    c6BollN: 20, c6BollM: 2, c6KdjN: 9, c6WrN: 14,
    c6DmiN: 14, c6BiasN: 12, c6CciN: 14, c6RocN: 12
  };

  var STYLE_ID = 'c-indicators-style';
  var CSS = [
    '.c-lab{display:none;flex:1;min-height:0;flex-direction:column;gap:8px}',
    '.c-lab.on{display:flex}',
    '.c-host{flex:1;min-height:220px}',
    '.c-cap{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:0 2px;font-family:var(--mono);font-size:9.5px;letter-spacing:.05em;color:var(--dim)}',
    '.c-cap b{color:var(--muted);font-weight:500}',
    '.c-cap .c-sep{color:var(--line)}',
    '.c-card{border:1px solid var(--line);border-radius:9px;background:var(--panel);padding:8px 10px;min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:5px}',
    '.c-card-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;color:var(--dim)}',
    '.c-card-h b{color:var(--muted);font-weight:500;font-family:var(--sans);font-size:11.5px;letter-spacing:0}',
    '.c-card-h .c-stamp{font-size:9px;color:var(--dim);white-space:nowrap}',
    '.c1-bottom{display:grid;grid-template-columns:1.06fr 1fr;gap:8px;min-height:192px;flex:0 0 auto}',
    '.c-sides{display:grid;grid-template-columns:1fr 1fr;gap:7px;min-height:0}',
    '.c-side{border:1px solid var(--line);border-radius:8px;padding:7px 8px;display:flex;flex-direction:column;gap:3px;min-width:0;background:var(--panel-2)}',
    '.c-side.buy{border-color:color-mix(in srgb,var(--cyan) 38%,var(--line))}',
    '.c-side.sell{border-color:color-mix(in srgb,var(--orange) 38%,var(--line))}',
    '.c-role{font-family:var(--mono);font-size:9px;letter-spacing:.12em;color:var(--dim)}',
    '.c-side b{font-family:var(--mono);font-size:13px;font-weight:560;line-height:1.3}',
    '.c-side small{font-family:var(--mono);font-size:10.5px;color:var(--muted);line-height:1.35}',
    '.c-case-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;flex:0 0 auto}',
    '.c-case-btns{display:flex;gap:5px;flex-wrap:wrap}',
    '.c-case-btn{border:1px solid var(--line);background:var(--panel);color:var(--muted);border-radius:7px;padding:4px 10px;font-size:11px;cursor:pointer;transition:.14s;white-space:nowrap}',
    '.c-case-btn:hover{border-color:var(--dim);color:var(--text)}',
    '.c-case-btn[aria-pressed="true"]{border-color:var(--cyan);color:var(--cyan);background:var(--panel-3)}',
    '.c2-bottom{display:grid;grid-template-columns:1.15fr 1fr;gap:8px;min-height:128px;flex:0 0 auto}',
    '.c2-concl-body{font-size:10.5px;line-height:1.55;color:var(--muted)}',
    '.c2-concl-body b{color:var(--text);font-weight:600}',
    '.c3-top{display:grid;grid-template-columns:1.58fr 1fr;gap:8px;flex:1;min-height:0}',
    '.c3-chart{min-height:260px}',
    '.c3-calc{overflow:auto;gap:6px}',
    '.c3-eq{font-family:var(--mono);font-size:12px;line-height:1.6;color:var(--muted);border:1px solid var(--line-soft);border-radius:7px;padding:7px 8px;background:var(--panel-2)}',
    '.c3-eq b{color:var(--cyan);font-size:14px;font-weight:600}',
    '.c3-chips{display:flex;gap:4px;flex-wrap:wrap}',
    '.c3-chip{border:1px solid var(--line);border-radius:6px;padding:3px 6px;display:flex;flex-direction:column;gap:1px;background:var(--panel);min-width:46px}',
    '.c3-chip i{font-style:normal;font-family:var(--mono);font-size:8.5px;color:var(--dim)}',
    '.c3-chip b{font-family:var(--mono);font-size:11px;font-weight:560;color:var(--muted)}',
    '.c3-chip.in{border-color:color-mix(in srgb,var(--cyan) 55%,var(--line));background:color-mix(in srgb,var(--cyan) 6%,var(--panel))}',
    '.c3-chip.in b{color:var(--cyan)}',
    '.c3-chip.edit{border-style:dashed;border-color:var(--orange)}',
    '.c3-chip.edit b{color:var(--orange)}',
    '.c3-note{font-size:10px;line-height:1.55;color:var(--dim)}',
    '.c3-note b{color:var(--muted)}',
    '.c4-bottom,.c5-bottom,.c6-bottom{display:grid;grid-template-columns:1.2fr 1fr;gap:8px;min-height:108px;flex:0 0 auto}',
    '.c4-legend{flex:0 0 auto}',
    '.c4-text,.c5-read,.c6-read{font-size:10.5px;line-height:1.55;color:var(--muted)}',
    '.c4-text b,.c5-read b,.c6-read b{color:var(--text);font-weight:600}',
    '.c5-formula-sm{font-family:var(--mono);font-size:10px;line-height:1.55;color:var(--dim)}',
    '.c6-tabs{display:flex;gap:5px;flex-wrap:wrap;flex:0 0 auto}',
    '.c6-tab{border:1px solid var(--line);background:var(--panel);color:var(--muted);border-radius:6px;padding:3px 9px;font-family:var(--mono);font-size:10px;letter-spacing:.04em;cursor:pointer}',
    '.c6-tab:hover{color:var(--text);border-color:var(--dim)}',
    '.c6-tab[aria-pressed="true"]{color:var(--cyan);border-color:var(--cyan);background:var(--panel-3)}',
    '.c6-table{font-size:9.5px}',
    '.c6-table th,.c6-table td{padding:3px 3px;vertical-align:top}',
    '.c6-bottom .legend{font-size:9px;gap:7px;margin-top:2px}',
    '.c1-trade-note{font-size:10px;line-height:1.5;color:var(--dim)}',
    '.c-mode .seg{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}',
    '.c-mode .seg button{padding:4px 2px;font-size:10px;line-height:1.3;width:100%}',
    '@media (max-width:900px){',
    '  .c1-bottom,.c2-bottom,.c3-top,.c4-bottom,.c5-bottom,.c6-bottom{grid-template-columns:1fr;min-height:0}',
    '  .c1-bottom{grid-template-columns:1fr}',
    '  .c-host{min-height:200px}',
    '  .c3-chart{min-height:230px}',
    '  .c3-calc{overflow:visible}',
    '  .c1-trade-note{display:none}',
    '  .c-sides{gap:6px}',
    '}',
    '@media (max-width:600px){',
    '  .c-side b{font-size:12px}',
    '  .c-case-btn{padding:3px 7px;font-size:10.5px}',
    '  .c6-tab{padding:3px 6px}',
    '}'
  ].join('\n');

  function injectCss() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function isNarrow() { return window.innerWidth <= 600; }
  function viewCandles(data) {
    if (!isNarrow()) return data;
    return data.map(function (c) {
      var d = Object.assign({}, c);
      if (d.label) d.label = d.label.slice(5);
      return d;
    });
  }

  function alpha(color, a) {
    var c = String(color || '').trim();
    if (c.charAt(0) !== '#') return c;
    var h = c.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length < 6) return c;
    var n = parseInt(h.slice(0, 6), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function avg(values) {
    if (!values.length) return 0;
    var s = 0;
    values.forEach(function (v) { s += v; });
    return s / values.length;
  }

  /* charts.js drawIndicator() currently references a free `ctx` variable.
   * Bind the active kline context here instead of editing the shared file.
   * Only C5/C6 create indicator panes, and inactive ones are destroyed. */
  function bindIndicatorCtx(host) {
    var canvas = host && host.querySelector('canvas');
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var C6_KEYS = {
    boll: 'c6BollN', kdj: 'c6KdjN', wr: 'c6WrN', dmi: 'c6DmiN',
    bias: 'c6BiasN', cci: 'c6CciN', roc: 'c6RocN'
  };
  var C6_LABEL = {
    boll: 'BOLL 布林带', kdj: 'KDJ 随机指标', wr: 'WR 威廉指标',
    dmi: 'DMI 趋向指标', bias: 'BIAS 乖离率', obv: 'OBV 能量潮',
    cci: 'CCI 顺势指标', roc: 'ROC 变动率'
  };
  var C6_ORDER = ['boll', 'kdj', 'wr', 'dmi', 'bias', 'obv', 'cci', 'roc'];
  var C2_CASES = [
    { value: 'upVol', label: '放量上涨' },
    { value: 'upShrink', label: '缩量上涨' },
    { value: 'downVol', label: '放量下跌' },
    { value: 'downShrink', label: '缩量下跌' }
  ];

  function mount(ctx) {
    var stage = ctx.stage, panel = ctx.panel;
    var p = charts.palette();
    var st = JSON.parse(JSON.stringify(DEFAULT));
    var cache = {};
    var inst = { c1: null, c2: null, c4: null, c5: null, c6: null };

    injectCss();

    function dataC1(preset) {
      var key = 'c1-' + preset;
      if (!cache[key]) cache[key] = ds.makeDaily(preset, 100);
      return cache[key].map(function (c) {
        var v = Math.max(1000, Math.round(c.v * st.c1Mult));
        return Object.assign({}, c, { v: v, amount: Math.round(v * c.c) });
      });
    }

    function dataC2() {
      var key = 'c2-' + st.c2Case;
      if (cache[key]) return cache[key];
      var upDir = st.c2Case === 'upVol' || st.c2Case === 'upShrink';
      var base = ds.makeDaily(upDir ? 'trend-up' : 'trend-down', 150);
      var n = base.length, rampStart = n - 60;
      var expand = st.c2Case === 'upVol' || st.c2Case === 'downVol';
      var out = base.map(function (c, i) {
        var t = clamp((i - rampStart) / 60, 0, 1);
        var f = expand ? (0.70 + 2.35 * t) : (2.20 - 1.50 * t);
        var v = Math.max(1000, Math.round(c.v * f));
        return Object.assign({}, c, { v: v, amount: Math.round(v * c.c) });
      });
      // Keep the final bar consistent with the advertised regime, so the
      // per-day ratio card does not contradict the 20-day average.
      var last = out.length - 1;
      var prev5 = avg(out.slice(last - 5, last).map(function (c) { return c.v; }));
      var target = Math.round(prev5 * (expand ? 1.4 : 0.65));
      out[last] = Object.assign({}, out[last], {
        v: Math.max(1000, target),
        amount: Math.round(Math.max(1000, target) * out[last].c)
      });
      cache[key] = out;
      return out;
    }

    function c4Data() {
      if (!cache.c4) cache.c4 = ds.makeDaily('trend-up', 240);
      return cache.c4;
    }
    function c5Data() {
      if (!cache.c5) cache.c5 = ds.makeDaily('trend-down', 140);
      return cache.c5;
    }
    function c6Data() {
      if (!cache.c6) cache.c6 = ds.makeDaily('reversal', 160);
      return cache.c6;
    }

    /* =========================================================
     *  Stage containers
     * ========================================================= */
    function lab(mode) {
      var d = ui.el('div', 'c-lab');
      d.setAttribute('data-lab', mode);
      stage.appendChild(d);
      return d;
    }

    // C1 — volume
    var wrapC1 = lab('c1');
    var capC1 = ui.el('div', 'c-cap', '<b>上</b> 日 K 线 <span class="c-sep">|</span> <b>下</b> 成交量柱（柱高＝股数，颜色随当日 K 线）');
    var c1Host = ui.el('div', 'chart c-host');
    var c1Bottom = ui.el('div', 'c1-bottom');
    var c1Trade = ui.el('div', 'c-card');
    var c1MetricsCard = ui.el('div', 'c-card');
    var c1Met = ui.metrics([
      { key: 'vol', label: '成交量 / VOLUME' },
      { key: 'amount', label: '成交额 / AMOUNT' },
      { key: 'turn', label: '换手率 / TURNOVER' },
      { key: 'ratio', label: '量比（前5日均量）' },
      { key: 'state', label: '量能状态 / REGIME', wide: true }
    ]);
    c1MetricsCard.appendChild(ui.el('div', 'c-card-h', '<b>当日读数</b><span class="c-stamp">SIMULATED</span>'));
    c1MetricsCard.appendChild(c1Met.el);
    c1Bottom.appendChild(c1Trade);
    c1Bottom.appendChild(c1MetricsCard);
    wrapC1.appendChild(capC1);
    wrapC1.appendChild(c1Host);
    wrapC1.appendChild(c1Bottom);

    // C2 — price/volume regimes
    var wrapC2 = lab('c2');
    var c2Bar = ui.el('div', 'c-case-row');
    var c2Btns = ui.el('div', 'c-case-btns');
    var c2BtnsArr = [];
    C2_CASES.forEach(function (c) {
      var b = ui.el('button', 'c-case-btn', c.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        st.c2Case = c.value;
        render();
      });
      c2Btns.appendChild(b);
      c2BtnsArr.push({ value: c.value, el: b });
    });
    var c2Legend = ui.legend([
      { label: '量 MA5', color: p.orange },
      { label: '量 MA10', color: p.violet }
    ]);
    c2Bar.appendChild(c2Btns);
    c2Bar.appendChild(c2Legend);
    var capC2 = ui.el('div', 'c-cap', '<b>上</b> 日 K 线 <span class="c-sep">|</span> <b>下</b> 成交量（股）＋成交量均线');
    var c2Host = ui.el('div', 'chart c-host');
    var c2Bottom = ui.el('div', 'c2-bottom');
    var c2MetricsCard = ui.el('div', 'c-card');
    var c2Met = ui.metrics([
      { key: 'ret', label: '近20日涨跌幅' },
      { key: 'vol', label: '20日均量 ÷ 前20日' },
      { key: 'today', label: '当日量 ÷ 前5日均量' },
      { key: 'avg', label: '当日成交量' }
    ]);
    c2MetricsCard.appendChild(ui.el('div', 'c-card-h', '<b>量价读数</b><span class="c-stamp">仅缩放成交量</span>'));
    c2MetricsCard.appendChild(c2Met.el);
    var c2Concl = ui.el('div', 'c-card');
    c2Concl.appendChild(ui.el('div', 'c-card-h', '<b>结论 / READ</b><span class="c-stamp">NOT A SIGNAL</span>'));
    var c2ConclBody = ui.el('div', 'c2-concl-body');
    c2Concl.appendChild(c2ConclBody);
    c2Bottom.appendChild(c2MetricsCard);
    c2Bottom.appendChild(c2Concl);
    wrapC2.appendChild(c2Bar);
    wrapC2.appendChild(capC2);
    wrapC2.appendChild(c2Host);
    wrapC2.appendChild(c2Bottom);

    // C3 — MA window
    var wrapC3 = lab('c3');
    var capC3 = ui.el('div', 'c-cap', '<b>柱</b> 收盘价（根序号） <span class="c-sep">|</span> <b>线</b> MA5 <span class="c-sep">|</span> <b>底色</b> 当前 5 根窗口');
    var c3Top = ui.el('div', 'c3-top');
    var c3Host = ui.el('div', 'chart c3-chart');
    var c3Calc = ui.el('div', 'c-card c3-calc');
    c3Calc.appendChild(ui.el('div', 'c-card-h', '<b>窗口计算 / MA5</b><span class="c-stamp">5-BAR WINDOW</span>'));
    var c3Eq = ui.el('div', 'c3-eq');
    var c3Chips = ui.el('div', 'c3-chips');
    var c3Met = ui.metrics([
      { key: 'ma', label: '当前窗口 MA5' },
      { key: 'win', label: '窗口位置' },
      { key: 'edit', label: '被改写收盘价' },
      { key: 'delta', label: '相对原始值 Δ' }
    ]);
    var c3Note = ui.el('div', 'c3-note');
    var c3LagNote = ui.el('div', 'c3-note', '<b>滞后：</b>MA5 是过去 5 根收盘的平均。每来一根新 K 线，窗口只向前挪一格，旧值还会影响后面 4 根，所以均线转折总落后于价格。');
    c3Calc.appendChild(c3Eq);
    c3Calc.appendChild(c3Chips);
    c3Calc.appendChild(c3Met.el);
    c3Calc.appendChild(c3Note);
    c3Calc.appendChild(c3LagNote);
    c3Top.appendChild(c3Host);
    c3Top.appendChild(c3Calc);
    wrapC3.appendChild(capC3);
    wrapC3.appendChild(c3Top);

    // C4 — MA system
    var wrapC4 = lab('c4');
    var capC4 = ui.el('div', 'c-cap', '<b>上</b> 日 K 线＋均线 <span class="c-sep">|</span> <b>下</b> 成交量 <span class="c-sep">|</span> <b>标记</b> 金叉/死叉由均线计算，箭头只标在价格上');
    var c4Host = ui.el('div', 'chart c-host');
    var c4Bottom = ui.el('div', 'c4-bottom');
    var c4Left = ui.el('div', 'c-card');
    var c4LeftHead = ui.el('div', 'c-card-h', '<b>均线读数 / MA</b><span class="c-stamp">CORE.MA</span>');
    var c4Legend = ui.el('div', 'legend c4-legend');
    var c4Met = ui.metrics([
      { key: 'align', label: '均线排列' },
      { key: 'ma5', label: 'MA5 当前值' },
      { key: 'ma20', label: 'MA20 当前值' },
      { key: 'sig', label: '最近信号' }
    ]);
    c4Left.appendChild(c4LeftHead);
    c4Left.appendChild(c4Legend);
    c4Left.appendChild(c4Met.el);
    var c4Right = ui.el('div', 'c-card');
    c4Right.appendChild(ui.el('div', 'c-card-h', '<b>怎么读 / READ</b><span class="c-stamp">LAG</span>'));
    var c4Text = ui.el('div', 'c4-text');
    c4Right.appendChild(c4Text);
    c4Bottom.appendChild(c4Left);
    c4Bottom.appendChild(c4Right);
    wrapC4.appendChild(capC4);
    wrapC4.appendChild(c4Host);
    wrapC4.appendChild(c4Bottom);

    // C5 — RSI / MACD
    var wrapC5 = lab('c5');
    var capC5 = ui.el('div', 'c-cap');
    var c5Host = ui.el('div', 'chart c-host');
    var c5Bottom = ui.el('div', 'c5-bottom');
    var c5MetricsCard = ui.el('div', 'c-card');
    var c5Met = ui.metrics([
      { key: 'rsi', label: 'RSI(周期)' },
      { key: 'dif', label: 'MACD DIF' },
      { key: 'dea', label: 'MACD DEA' },
      { key: 'hist', label: 'MACD 柱 2×(DIF−DEA)' }
    ]);
    c5MetricsCard.appendChild(ui.el('div', 'c-card-h', '<b>指标读数</b><span class="c-stamp">CORE.RSI / CORE.MACD</span>'));
    c5MetricsCard.appendChild(c5Met.el);
    var c5ReadCard = ui.el('div', 'c-card');
    c5ReadCard.appendChild(ui.el('div', 'c-card-h', '<b>当前副图 / PANE</b><span class="c-stamp">PAST ONLY</span>'));
    var c5Read = ui.el('div', 'c5-read');
    var c5Legend = ui.el('div', 'legend');
    c5ReadCard.appendChild(c5Read);
    c5ReadCard.appendChild(c5Legend);
    c5Bottom.appendChild(c5MetricsCard);
    c5Bottom.appendChild(c5ReadCard);
    wrapC5.appendChild(capC5);
    wrapC5.appendChild(c5Host);
    wrapC5.appendChild(c5Bottom);

    // C6 — extended indicators
    var wrapC6 = lab('c6');
    var c6Tabs = ui.el('div', 'c6-tabs');
    var c6TabsArr = [];
    C6_ORDER.forEach(function (key) {
      var b = ui.el('button', 'c6-tab', key.toUpperCase());
      b.type = 'button';
      b.title = C6_LABEL[key];
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        st.c6Ind = key;
        syncC6Controls();
        render();
      });
      c6Tabs.appendChild(b);
      c6TabsArr.push({ value: key, el: b });
    });
    var capC6 = ui.el('div', 'c-cap');
    var c6Host = ui.el('div', 'chart c-host');
    var c6Bottom = ui.el('div', 'c6-bottom');
    var c6MetricsCard = ui.el('div', 'c-card');
    var c6MetricsHost = ui.el('div');
    c6MetricsCard.appendChild(ui.el('div', 'c-card-h', '<b>指标读数</b><span class="c-stamp">SAME PRICE, DIFFERENT LENS</span>'));
    c6MetricsCard.appendChild(c6MetricsHost);
    var c6ReadCard = ui.el('div', 'c-card');
    c6ReadCard.appendChild(ui.el('div', 'c-card-h', '<b>怎么读 / PANE</b><span class="c-stamp">DESCRIPTIVE</span>'));
    var c6Read = ui.el('div', 'c6-read');
    var c6Legend = ui.el('div', 'legend');
    c6ReadCard.appendChild(c6Read);
    c6ReadCard.appendChild(c6Legend);
    c6Bottom.appendChild(c6MetricsCard);
    c6Bottom.appendChild(c6ReadCard);
    wrapC6.appendChild(c6Tabs);
    wrapC6.appendChild(capC6);
    wrapC6.appendChild(c6Host);
    wrapC6.appendChild(c6Bottom);

    /* =========================================================
     *  Panel
     * ========================================================= */
    var gMode = ui.section(panel, '实验 / LAB', 'C1–C6');
    var modeCtl = ui.seg({
      options: [
        { value: 'c1', label: '成交量' }, { value: 'c2', label: '量价' },
        { value: 'c3', label: '均线窗口' }, { value: 'c4', label: '均线系统' },
        { value: 'c5', label: 'RSI·MACD' }, { value: 'c6', label: '扩展指标' }
      ],
      value: st.mode,
      onChange: function (v) { switchMode(v); }
    });
    modeCtl.el.classList.add('c-mode');
    gMode.appendChild(modeCtl.el);

    // C1 panel
    var gC1 = ui.section(panel, 'C1 · 成交量参数', 'VOLUME');
    var c1MultCtl = ui.slider({
      label: '成交量倍数', min: 0.3, max: 3, step: 0.1, value: st.c1Mult, unit: '×',
      hint: '倍数缩放全部成交量，量比（相对自身）不变；换手率随成交量等比变化。OHLC 保持不变。',
      onInput: function (v) { st.c1Mult = v; render(); }
    });
    var c1PresetCtl = ui.select({
      label: '数据形态', value: st.c1Preset,
      options: [
        { value: 'volume-spike', label: '放量突增' },
        { value: 'trend-up', label: '稳定上涨' },
        { value: 'trend-down', label: '持续下跌' }
      ],
      onChange: function (v) { st.c1Preset = v; render(); }
    });
    var c1Formula = ui.formula('');
    gC1.appendChild(c1MultCtl.el);
    gC1.appendChild(c1PresetCtl.el);
    gC1.appendChild(c1Formula);
    gC1.appendChild(ui.note('流通股本按 <b>60 亿股</b> 教学假设计算换手率；真实个股请用当期流通股本。'));
    gC1.appendChild(ui.warn('成交量不是“净买入资金”。每一笔成交都同时有买方和卖方，成交量只统计成交股数一次。'));

    // C2 panel
    var gC2 = ui.section(panel, 'C2 · 量价组合', 'PRICE × VOLUME');
    var c2WinCtl = ui.slider({
      label: '观察窗口', min: 40, max: 150, step: 1, value: st.c2Window, unit: '根',
      hint: '四种形态共用同一套 OHLC，只改变成交量的缩放节奏。',
      onInput: function (v) { st.c2Window = v; render(); }
    });
    var c2Formula = ui.formula('');
    gC2.appendChild(c2WinCtl.el);
    gC2.appendChild(c2Formula);
    gC2.appendChild(ui.note('柱状图为成交量，橙色/紫色线为成交量 MA5/MA10。它们只描述过去 5/10 根的平均成交股数。'));
    gC2.appendChild(ui.warn('放量、缩量本身没有好坏：放量代表换手更活跃，缩量代表换手下降。都不能单独证明“资金流入/流出”。'));

    // C3 panel
    var gC3 = ui.section(panel, 'C3 · 5 根窗口', 'WINDOW');
    var c3WinCtl = ui.slider({
      label: '窗口起点', min: 0, max: C3_BARS - 5, step: 1, value: st.c3Window, unit: '根',
      hint: '把 5 根窗口沿序列滑动，观察哪 5 个收盘价进入 MA5。',
      onInput: function (v) { st.c3Window = v; render(); }
    });
    var c3EditCtl = ui.number({
      label: '第 31 根收盘价（原 12.00）', value: st.c3EditVal, min: 4, max: 20, step: 0.1,
      onChange: function (v) {
        if (!isFinite(v)) return;
        st.c3EditVal = clamp(v, 4, 20);
        c3EditCtl.input.value = st.c3EditVal;
        render();
      }
    });
    var c3Formula = ui.formula('');
    gC3.appendChild(c3WinCtl.el);
    gC3.appendChild(c3EditCtl.el);
    gC3.appendChild(c3Formula);
    gC3.appendChild(ui.note('窗口在默认位置时，五个收盘价正好是 <b>10、11、12、11、13</b>，MA5 = <b>11.4</b>。'));
    gC3.appendChild(ui.note('只有窗口内的 5 根参与计算；把窗口滑走，改写的那根就会被移出，MA5 不受影响。'));

    // C4 panel
    var gC4 = ui.section(panel, 'C4 · 均线系统', 'MA SYSTEM');
    var c4Checks = {};
    [5, 10, 20, 60].forEach(function (period) {
      var ck = ui.check({
        label: 'MA' + period + '（' + period + ' 日）', checked: !!st.ma[period],
        onChange: function (on) { st.ma[period] = on; render(); }
      });
      c4Checks[period] = ck;
      gC4.appendChild(ck.el);
    });
    var c4LagCtl = ui.slider({
      label: '滞后对比：MA5 右移', min: 0, max: 10, step: 1, value: st.c4Lag, unit: '根',
      hint: '右移后画的是 N 根之前的 MA5（虚线），价格不动，用来看均线转折落后多少。',
      onInput: function (v) { st.c4Lag = v; render(); }
    });
    var c4Formula = ui.formula('');
    gC4.appendChild(c4LagCtl.el);
    gC4.appendChild(c4Formula);
    gC4.appendChild(ui.note('金叉＝短均线从下方穿越长均线；死叉＝从上方穿越。信号只使用收盘价，盘中触及时会来回变化。'));
    gC4.appendChild(ui.warn('均线是滞后指标。多头排列/空头排列描述的是已经形成的排列，不是买卖建议。'));

    // C5 panel
    var gC5 = ui.section(panel, 'C5 · RSI 与 MACD', 'MOMENTUM');
    var c5IndCtl = ui.seg({
      label: '副图指标', value: st.c5Ind,
      options: [{ value: 'rsi', label: 'RSI' }, { value: 'macd', label: 'MACD' }],
      onChange: function (v) { st.c5Ind = v; syncC5Controls(); render(); }
    });
    var c5RsiCtl = ui.slider({
      label: 'RSI 周期', min: 6, max: 24, step: 1, value: st.c5Rsi, unit: '根',
      hint: '周期越短越敏感，信号也越频繁；这里固定用 Wilder 平滑。',
      onInput: function (v) { st.c5Rsi = v; render(); }
    });
    var c5FastCtl = ui.slider({
      label: 'MACD 快线 EMA', min: 5, max: 20, step: 1, value: st.c5Fast, unit: '根',
      onInput: function (v) {
        st.c5Fast = v;
        if (st.c5Slow <= st.c5Fast + 2) {
          st.c5Slow = Math.min(40, st.c5Fast + 2);
          c5SlowCtl.set(st.c5Slow, true);
        }
        render();
      }
    });
    var c5SlowCtl = ui.slider({
      label: 'MACD 慢线 EMA', min: 15, max: 40, step: 1, value: st.c5Slow, unit: '根',
      onInput: function (v) {
        st.c5Slow = Math.max(v, st.c5Fast + 2);
        c5SlowCtl.set(st.c5Slow, true);
        render();
      }
    });
    var c5SignalCtl = ui.slider({
      label: 'MACD 信号线 DEA', min: 5, max: 15, step: 1, value: st.c5Signal, unit: '根',
      onInput: function (v) { st.c5Signal = v; render(); }
    });
    var c5Formula = ui.formula('');
    gC5.appendChild(c5IndCtl.el);
    gC5.appendChild(c5RsiCtl.el);
    gC5.appendChild(c5FastCtl.el);
    gC5.appendChild(c5SlowCtl.el);
    gC5.appendChild(c5SignalCtl.el);
    gC5.appendChild(c5Formula);
    gC5.appendChild(ui.warn('RSI 低于 30 只表示过去一段跌得多，<b>不等于反弹保证</b>；价格可以在超卖区停留很久，也可以继续下跌。'));

    // C6 panel
    var gC6 = ui.section(panel, 'C6 · 扩展指标', 'EIGHT LENSES');
    var c6Sel = ui.select({
      label: '指标 / INDICATOR', value: st.c6Ind,
      options: C6_ORDER.map(function (k) { return { value: k, label: C6_LABEL[k] }; }),
      onChange: function (v) { st.c6Ind = v; syncC6Controls(); render(); }
    });
    var c6NCtl = ui.slider({
      label: '周期 N', min: 5, max: 30, step: 1, value: 9, unit: '根',
      onInput: function (v) {
        var key = C6_KEYS[st.c6Ind];
        if (key) st[key] = v;
        render();
      }
    });
    var c6MultCtl = ui.slider({
      label: 'BOLL 标准差倍数', min: 1, max: 3, step: 0.5, value: st.c6BollM, unit: 'σ',
      onInput: function (v) { st.c6BollM = v; render(); }
    });
    var c6Formula = ui.formula('');
    var c6Table = ui.table(
      ['指标 / 参数', '含义', '常见误读'],
      [
        ['BOLL 20, 2σ', '价格相对均线的波动区间', '触上轨 ≠ 必跌'],
        ['KDJ 9, 3, 3', '收盘在近期高低区间的位置', 'J &gt; 100 ≠ 买点'],
        ['WR 14', '收盘距 N 日高点的距离（0～−100）', '把 0 当成超买'],
        ['DMI 14, 6', '趋势方向 +DI/−DI 与强度 ADX', 'ADX 高 ≠ 一定上涨'],
        ['BIAS 12', '收盘偏离均线的百分比', '偏离大 ≠ 马上回归'],
        ['OBV —', '按涨跌方向累加成交量', 'OBV 升 ≠ 主力吸筹'],
        ['CCI 14', '典型价偏离均值的程度', '±100 外 ≠ 必然反转'],
        ['ROC 12', 'N 日涨跌幅动量', 'ROC 高 ≠ 继续上涨']
      ],
      'c6-table'
    );
    gC6.appendChild(c6Sel.el);
    gC6.appendChild(c6NCtl.el);
    gC6.appendChild(c6MultCtl.el);
    gC6.appendChild(c6Formula);
    gC6.appendChild(c6Table);
    gC6.appendChild(ui.note('参数不同，读数就不同；所有指标都只描述过去的价格/成交量，不包含未来信息。'));
    gC6.appendChild(ui.warn('指标在趋势市与震荡市中的表现不同：趋势指标在横盘时反复打脸，摆动指标在单边行情中会长期钝化。'));

    var gReset = ui.section(panel, '', '');
    gReset.appendChild(ui.reset(function () {
      var keepMode = st.mode;
      st = JSON.parse(JSON.stringify(DEFAULT));
      st.mode = keepMode;
      syncControls();
      render();
    }, '恢复全部默认'));

    /* =========================================================
     *  Controls sync
     * ========================================================= */
    function syncPanelVisibility() {
      var map = { c1: gC1, c2: gC2, c3: gC3, c4: gC4, c5: gC5, c6: gC6 };
      Object.keys(map).forEach(function (k) {
        map[k].style.display = st.mode === k ? '' : 'none';
      });
      [wrapC1, wrapC2, wrapC3, wrapC4, wrapC5, wrapC6].forEach(function (w) {
        w.classList.toggle('on', w.getAttribute('data-lab') === st.mode);
      });
    }

    function syncC5Controls() {
      modeCtl.set(st.mode);
      c5IndCtl.set(st.c5Ind);
      c5RsiCtl.el.style.display = st.c5Ind === 'rsi' ? '' : 'none';
      c5FastCtl.el.style.display = st.c5Ind === 'macd' ? '' : 'none';
      c5SlowCtl.el.style.display = st.c5Ind === 'macd' ? '' : 'none';
      c5SignalCtl.el.style.display = st.c5Ind === 'macd' ? '' : 'none';
    }

    function syncC6Controls() {
      c6Sel.set(st.c6Ind);
      c6TabsArr.forEach(function (t) { t.el.setAttribute('aria-pressed', String(t.value === st.c6Ind)); });
      var key = C6_KEYS[st.c6Ind];
      var n = key ? st[key] : null;
      c6NCtl.el.style.display = key ? '' : 'none';
      c6MultCtl.el.style.display = st.c6Ind === 'boll' ? '' : 'none';
      if (key) {
        c6NCtl.set(n, true);
        var top = c6NCtl.el.querySelector('.ctl-top span');
        if (top) top.textContent = C6_LABEL[st.c6Ind].split(' ')[0] + ' 周期 N';
      }
      c6MultCtl.set(st.c6BollM, true);
    }

    function syncControls() {
      modeCtl.set(st.mode);
      c1MultCtl.set(st.c1Mult, true);
      c1PresetCtl.set(st.c1Preset);
      c2WinCtl.set(st.c2Window, true);
      c3WinCtl.set(st.c3Window, true);
      c3EditCtl.input.value = st.c3EditVal;
      [5, 10, 20, 60].forEach(function (period) { c4Checks[period].set(!!st.ma[period]); });
      c4LagCtl.set(st.c4Lag, true);
      c5RsiCtl.set(st.c5Rsi, true);
      c5FastCtl.set(st.c5Fast, true);
      c5SlowCtl.set(st.c5Slow, true);
      c5SignalCtl.set(st.c5Signal, true);
      syncC5Controls();
      syncC6Controls();
      syncPanelVisibility();
    }

    function switchMode(v) {
      if (v === st.mode) { render(); return; }
      st.mode = v;
      syncControls();
      render();
    }

    /* =========================================================
     *  C1 render
     * ========================================================= */
    function renderC1() {
      if (!inst.c1) {
        inst.c1 = charts.kline(c1Host, {
          candles: [], market: 'cn', fill: 'solid', showVolume: true,
          visibleCount: 80, volumeMA: [5, 10], label: '日 K 线与成交量'
        });
      }
      var data = dataC1(st.c1Preset);
      inst.c1.setData({ candles: viewCandles(data), overlays: [], markers: [], indicator: null, visibleCount: isNarrow() ? 42 : Math.min(80, data.length), resetView: true });
      var last = data[data.length - 1];
      var prev5 = data.slice(-6, -1).map(function (c) { return c.v; });
      var ratio = last.v / (avg(prev5) || 1);
      var state = ratio >= 1.25 ? '放量' : ratio <= 0.8 ? '缩量' : '量能平稳';
      c1Met.set({
        vol: ui.fmt.compact(last.v) + ' 股',
        amount: ui.fmt.money(last.amount),
        turn: core.turnover(last.v, FLOAT_SHARES).toFixed(2) + '%',
        ratio: ratio.toFixed(2) + '×',
        state: state + ' · 当日量 ÷ 前5日均量'
      }, { ratio: 'hi', state: 'hi' });
      var qty = 1000, cash = last.c * qty;
      c1Trade.innerHTML =
        '<div class="c-card-h"><b>一笔成交的两侧</b><span class="c-stamp">' + qty + ' 股 @ ' + last.c.toFixed(2) + ' 元</span></div>' +
        '<div class="c-sides">' +
        '  <div class="c-side buy"><span class="c-role">买方 / BUYER</span><b>现金 −' + ui.fmt.money(cash) + '</b><small>股票 +' + qty + ' 股</small></div>' +
        '  <div class="c-side sell"><span class="c-role">卖方 / SELLER</span><b>现金 +' + ui.fmt.money(cash) + '</b><small>股票 −' + qty + ' 股</small></div>' +
        '</div>' +
        '<div class="c1-trade-note">成交量只计 <b>' + qty + ' 股</b>，不是 2,000 股；买卖双方的现金和股票方向相反、数量相等（不计费用）。</div>';
      c1Formula.innerHTML = '成交量 = <b>' + ui.fmt.compact(last.v) + ' 股</b>；成交额 = 成交量 × 成交价 ≈ <b>' + ui.fmt.money(last.amount) + '</b><br>' +
        '换手率 = 成交量 ÷ 流通股本 × 100% = ' + ui.fmt.compact(last.v) + ' ÷ 60 亿股 = <b>' + core.turnover(last.v, FLOAT_SHARES).toFixed(2) + '%</b>';
    }

    /* =========================================================
     *  C2 render
     * ========================================================= */
    function renderC2() {
      if (!inst.c2) {
        inst.c2 = charts.kline(c2Host, {
          candles: [], market: 'cn', fill: 'solid', showVolume: true,
          visibleCount: 100, volumeMA: [5, 10], label: '量价关系：价格与成交量'
        });
      }
      var data = dataC2();
      var n = data.length;
      inst.c2.setData({ candles: viewCandles(data), overlays: [], markers: [], indicator: null, visibleCount: clamp(st.c2Window, 20, n), resetView: true });
      c2BtnsArr.forEach(function (b) { b.el.setAttribute('aria-pressed', String(b.value === st.c2Case)); });
      var closes = data.map(function (c) { return c.c; });
      var ret20 = core.changePct(closes[n - 21], closes[n - 1]);
      var last20 = avg(data.slice(n - 20).map(function (c) { return c.v; }));
      var prev20 = avg(data.slice(n - 40, n - 20).map(function (c) { return c.v; }));
      var volRatio = last20 / (prev20 || 1);
      var todayRatio = data[n - 1].v / (avg(data.slice(n - 6, n - 1).map(function (c) { return c.v; })) || 1);
      c2Met.set({
        ret: ui.fmt.pct(ret20),
        vol: volRatio.toFixed(2) + '×',
        today: todayRatio.toFixed(2) + '×',
        avg: ui.fmt.compact(last20) + ' 股'
      }, { ret: ret20 >= 0 ? 'pos' : 'neg', vol: volRatio >= 1.15 ? 'hi' : '' });
      var text = {
        upVol: '<b>放量上涨</b>：换手放大、价格上行。它说明交易更活跃，<b>不等于存在“净买入资金”</b>——每一笔成交都有买方和卖方。',
        upShrink: '<b>缩量上涨</b>：价格上行但换手下降。可能是抛压减轻，也可能是参与度不足，不能单独当作见顶或见底信号。',
        downVol: '<b>放量下跌</b>：下跌伴随高换手，分歧加大。<b>不等于“主力出货”</b>——卖出的人多，接盘的人也多，成交量只记录换手。',
        downShrink: '<b>缩量下跌</b>：下跌但成交萎缩。可能是卖压衰减，也可能只是缺少接盘，需要结合价格位置与后续走势。'
      }[st.c2Case];
      c2ConclBody.innerHTML = text;
      c2Formula.innerHTML = '20 日涨跌幅 = (' + closes[n - 1].toFixed(2) + ' ÷ ' + closes[n - 21].toFixed(2) + ' − 1) × 100% = <b>' + ui.fmt.pct(ret20) + '</b><br>' +
        '20 日均量 ÷ 前 20 日均量 = ' + ui.fmt.compact(last20) + ' ÷ ' + ui.fmt.compact(prev20) + ' = <b>' + volRatio.toFixed(2) + '×</b>';
    }

    /* =========================================================
     *  C3 render (custom bars + MA line)
     * ========================================================= */
    var c3Canvas = document.createElement('canvas');
    c3Host.appendChild(c3Canvas);
    var c3Ctx = c3Canvas.getContext('2d');
    var c3W = 0, c3H = 0, c3Dpr = 1;
    var c3Raf = 0;

    function c3Series() {
      var a = C3_BASE.slice();
      a[C3_EDIT_INDEX] = st.c3EditVal;
      return a;
    }
    function c3WindowStart() { return clamp(Math.round(st.c3Window), 0, C3_BARS - 5); }

    function c3Draw() {
      var host = c3Host;
      var r = host.getBoundingClientRect();
      var W = Math.max(180, Math.round(r.width));
      var H = Math.max(150, Math.round(r.height));
      if (W < 40 || H < 40) return;
      var dpr = Math.min(2.5, window.devicePixelRatio || 1);
      if (c3W !== W || c3H !== H || c3Dpr !== dpr) {
        c3W = W; c3H = H; c3Dpr = dpr;
        c3Canvas.width = Math.round(W * dpr);
        c3Canvas.height = Math.round(H * dpr);
      }
      c3Ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var ctx = c3Ctx, pp = charts.palette();
      ctx.clearRect(0, 0, W, H);

      var L = 8, R = W - 54, T = 30, B = H - 28;
      var closes = c3Series();
      var ma = core.ma(closes, 5);
      var win = c3WindowStart();
      var hi = -Infinity, lo = Infinity;
      closes.forEach(function (v) { hi = Math.max(hi, v); lo = Math.min(lo, v); });
      hi += 0.45; lo -= 0.45;
      if (hi === lo) hi = lo + 1;
      var bw = (R - L) / closes.length;
      var x = function (i) { return L + (i + 0.5) * bw; };
      var y = function (v) { return T + (hi - v) / (hi - lo) * (B - T); };

      // grid + right labels
      ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (var g = 0; g <= 4; g++) {
        var gv = lo + (hi - lo) * g / 4;
        var gy = Math.round(y(gv)) + 0.5;
        ctx.strokeStyle = pp.grid; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(L, gy); ctx.lineTo(R, gy); ctx.stroke();
        ctx.fillStyle = pp.dim;
        ctx.fillText(gv.toFixed(1), W - 5, gy);
      }

      // window band
      ctx.fillStyle = alpha(pp.cyan, 0.09);
      ctx.fillRect(L + win * bw, T, 5 * bw, B - T);
      ctx.strokeStyle = alpha(pp.cyan, 0.35);
      ctx.lineWidth = 1;
      ctx.strokeRect(L + win * bw + 0.5, T + 0.5, 5 * bw - 1, B - T - 1);

      // bars
      var barW = Math.max(2, Math.min(17, bw * 0.62));
      for (var i = 0; i < closes.length; i++) {
        var included = i >= win && i < win + 5;
        var bx = x(i) - barW / 2;
        var by = y(closes[i]);
        ctx.fillStyle = included ? pp.cyan : alpha(pp.muted, 0.42);
        ctx.fillRect(bx, by, barW, B - by);
        if (i === C3_EDIT_INDEX) {
          ctx.strokeStyle = pp.orange; ctx.lineWidth = 1.3;
          ctx.strokeRect(bx - 1.5, by - 1.5, barW + 3, B - by + 3);
        }
      }

      // MA5 line
      ctx.strokeStyle = pp.orange; ctx.lineWidth = 1.7;
      ctx.beginPath();
      var started = false;
      for (var j = 0; j < ma.length; j++) {
        if (ma[j] == null) { started = false; continue; }
        var mx = x(j), my = y(ma[j]);
        if (!started) { ctx.moveTo(mx, my); started = true; } else ctx.lineTo(mx, my);
      }
      ctx.stroke();
      for (var k = 4; k < ma.length; k++) {
        if (ma[k] == null) continue;
        ctx.fillStyle = pp.orange;
        ctx.beginPath(); ctx.arc(x(k), y(ma[k]), k >= win && k < win + 5 ? 2.4 : 1.4, 0, 7); ctx.fill();
      }

      // included value labels (1 decimal to avoid overlap)
      ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      for (var q = win; q < win + 5; q++) {
        ctx.fillStyle = q === C3_EDIT_INDEX ? pp.orange : pp.cyan;
        ctx.fillText(closes[q].toFixed(1), x(q), y(closes[q]) - 4);
      }

      // MA5 current pill
      var maNow = ma[win + 4];
      if (maNow != null) {
        var label = 'MA5 ' + maNow.toFixed(2);
        ctx.font = '9.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
        var tw = ctx.measureText(label).width + 12;
        var px = clamp(x(win + 4) + 8, L + 2, R - tw - 2);
        var py = clamp(y(maNow) - 20, T + 2, B - 18);
        ctx.fillStyle = pp.panel3;
        roundRect(ctx, px, py, tw, 15, 4); ctx.fill();
        ctx.fillStyle = pp.orange; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(label, px + 6, py + 8);
      }

      // x labels
      ctx.fillStyle = pp.dim; ctx.font = '8.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (var z = 0; z < closes.length; z += 4) {
        ctx.fillText(String(z + 1), x(z), B + 5);
      }
      ctx.fillText(String(closes.length), clamp(x(closes.length - 1), L + 8, R - 2), B + 5);

      // legend (top)
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      var lx = L + 2;
      ctx.fillStyle = pp.cyan; ctx.fillRect(lx, 9, 8, 8);
      ctx.fillStyle = pp.dim; ctx.fillText('窗口内收盘', lx + 12, 13);
      lx += 88;
      ctx.strokeStyle = pp.orange; ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.moveTo(lx, 13); ctx.lineTo(lx + 12, 13); ctx.stroke();
      ctx.fillStyle = pp.dim; ctx.fillText('MA5', lx + 17, 13);
      lx += 48;
      ctx.strokeStyle = pp.orange; ctx.lineWidth = 1.2;
      ctx.strokeRect(lx, 8, 9, 10);
      ctx.fillStyle = pp.dim; ctx.fillText('橙框＝可改写', lx + 13, 13);
    }

    function c3Resize() {
      c3Draw();
      if (c3Raf) cancelAnimationFrame(c3Raf);
      c3Raf = requestAnimationFrame(function () { c3Raf = 0; c3Draw(); });
    }
    var c3RO = new ResizeObserver(c3Resize);
    c3RO.observe(c3Host);
    c3Draw();

    function c3Theme() { c3Draw(); }
    window.addEventListener('sm:theme', c3Theme);

    function renderC3() {
      var win = c3WindowStart();
      var closes = c3Series();
      var maNow = core.ma(closes, 5)[win + 4];
      var maBase = core.ma(C3_BASE.slice(), 5)[win + 4];
      var delta = maNow == null || maBase == null ? 0 : maNow - maBase;
      var inWindow = C3_EDIT_INDEX >= win && C3_EDIT_INDEX < win + 5;
      var vals = closes.slice(win, win + 5);
      c3Eq.innerHTML = '(' + vals.map(function (v) { return v.toFixed(2); }).join(' + ') + ') ÷ 5 = <b>' + (maNow == null ? '—' : maNow.toFixed(2)) + '</b>';
      c3Chips.innerHTML = vals.map(function (v, i) {
        var idx = win + i;
        return '<div class="c3-chip in' + (idx === C3_EDIT_INDEX ? ' edit' : '') + '">' +
          '<i>第 ' + (idx + 1) + ' 根</i><b>' + v.toFixed(2) + '</b></div>';
      }).join('');
      c3Met.set({
        ma: maNow == null ? '—' : maNow.toFixed(2),
        win: '第 ' + (win + 1) + '–' + (win + 5) + ' 根',
        edit: st.c3EditVal.toFixed(2),
        delta: (delta >= 0 ? '+' : '') + delta.toFixed(2)
      }, { delta: delta > 0 ? 'pos' : delta < 0 ? 'neg' : '' });
      c3Note.innerHTML = inWindow
        ? '改写的那根在窗口内：<b>12.00 → ' + st.c3EditVal.toFixed(2) + '</b>，MA5 变化 <b>' + (delta >= 0 ? '+' : '') + delta.toFixed(2) + '</b>。每改变 1 元，MA5 变化 0.20 元。'
        : '改写的那根已经滑出当前窗口，<b>MA5 不变</b>——只有窗口内的 5 根参与计算。把窗口拖回最后一格就能看到它。';
      c3Formula.innerHTML = 'MA5 = (C₁ + C₂ + C₃ + C₄ + C₅) ÷ 5<br>= (' + vals.map(function (v) { return v.toFixed(2); }).join(' + ') + ') ÷ 5 = <b>' + (maNow == null ? '—' : maNow.toFixed(2)) + '</b>';
      c3Resize();
    }

    /* =========================================================
     *  C4 render
     * ========================================================= */
    function c4Series() {
      var data = c4Data();
      return data.map(function (c) { return c.c; });
    }

    function renderC4() {
      if (!inst.c4) {
        inst.c4 = charts.kline(c4Host, {
          candles: [], market: 'cn', fill: 'solid', showVolume: true,
          visibleCount: 120, volumeMA: [], label: '均线系统与金叉死叉'
        });
      }
      var data = c4Data();
      var closes = c4Series();
      var n = closes.length;
      var visible = isNarrow() ? 60 : 120;
      var start = n - visible;
      var mas = {};
      [5, 10, 20, 60].forEach(function (period) { mas[period] = core.ma(closes, period); });
      var enabled = [5, 10, 20, 60].filter(function (period) { return !!st.ma[period]; });
      var colors = { 5: p.cyan, 10: p.orange, 20: p.violet, 60: p.blue };
      var overlays = enabled.map(function (period) {
        return { name: 'MA' + period, values: mas[period], color: colors[period], width: period === 5 ? 1.5 : 1.2 };
      });
      if (st.c4Lag > 0 && st.ma[5]) {
        var shifted = mas[5].map(function (_, i) { return i - st.c4Lag >= 0 ? mas[5][i - st.c4Lag] : null; });
        overlays.push({ name: 'MA5 右移' + st.c4Lag, values: shifted, color: p.yellow, width: 1.3, dash: [3, 3] });
      }

      var events = [];
      for (var e = 0; e < enabled.length - 1; e++) {
        var a = enabled[e], b = enabled[e + 1];
        for (var i = Math.max(1, start); i < n; i++) {
          if (mas[a][i - 1] == null || mas[b][i - 1] == null) continue;
          var prev = mas[a][i - 1] - mas[b][i - 1];
          var cur = mas[a][i] - mas[b][i];
          if (prev <= 0 && cur > 0) events.push({ i: i, gold: true, a: a, b: b });
          else if (prev >= 0 && cur < 0) events.push({ i: i, gold: false, a: a, b: b });
        }
      }
      events.sort(function (x, y) { return x.i - y.i; });
      var picked = [];
      for (var j = events.length - 1; j >= 0 && picked.length < 3; j--) {
        var ev = events[j];
        if (picked.every(function (other) { return Math.abs(other.i - ev.i) >= 14; })) picked.push(ev);
      }
      picked.reverse();
      var markers = picked.map(function (ev) {
        var c = data[ev.i];
        return {
          index: ev.i,
          price: ev.gold ? c.l - (c.h - c.l) * 0.18 : c.h + (c.h - c.l) * 0.18,
          text: (ev.gold ? '金叉 ' : '死叉 ') + ev.a + '×' + ev.b,
          color: ev.gold ? p.red : p.green,
          dir: ev.gold ? 'up' : 'down'
        };
      });
      inst.c4.setData({ candles: viewCandles(data), overlays: overlays, markers: markers, indicator: null, visibleCount: visible, resetView: true });

      var last = n - 1;
      var align = '均线不足';
      if (enabled.length >= 2) {
        var up = true, down = true;
        for (var k = 1; k < enabled.length; k++) {
          if (!(mas[enabled[k - 1]][last] > mas[enabled[k]][last])) up = false;
          if (!(mas[enabled[k - 1]][last] < mas[enabled[k]][last])) down = false;
        }
        align = up ? '多头排列' : down ? '空头排列' : '交织';
      }
      var lastSig = picked[picked.length - 1];
      var sigText = lastSig ? (lastSig.gold ? '金叉 ' : '死叉 ') + lastSig.a + '×' + lastSig.b : '未检出';
      var tone = { align: align === '多头排列' ? 'pos' : align === '空头排列' ? 'neg' : '', sig: lastSig ? (lastSig.gold ? 'pos' : 'neg') : '' };
      c4Met.set({
        align: align,
        ma5: st.ma[5] && mas[5][last] != null ? mas[5][last].toFixed(2) : 'MA5 关闭',
        ma20: st.ma[20] && mas[20][last] != null ? mas[20][last].toFixed(2) : 'MA20 关闭',
        sig: sigText
      }, tone);
      c4Legend.innerHTML = enabled.map(function (period) {
        return '<span><i style="background:' + colors[period] + '"></i>MA' + period + '</span>';
      }).join('') + (st.c4Lag > 0 ? '<span><i style="background:' + p.yellow + '"></i>MA5 右移 ' + st.c4Lag + ' 根</span>' : '');
      var lagMa = st.c4Lag > 0 && last - st.c4Lag >= 0 ? mas[5][last - st.c4Lag] : null;
      c4Text.innerHTML = '标记只画在价格上，信号却由均线计算：<b>金叉＝短均线上穿长均线</b>，死叉相反。<br>' +
        (st.c4Lag > 0
          ? '虚线是 <b>' + st.c4Lag + ' 根之前</b>的 MA5：' + (lagMa == null ? '—' : lagMa.toFixed(2)) + '，当前 MA5 是 ' + (mas[5][last] == null ? '—' : mas[5][last].toFixed(2)) + '。价格已经转向时，均线还在讲上一段故事。'
          : '把“滞后对比”滑块拉开，就能看到 MA5 的历史值总在当前价格之后才转向。');
      c4Formula.innerHTML = 'MA5 = (' + closes.slice(-5).map(function (v) { return v.toFixed(2); }).join(' + ') + ') ÷ 5 = <b>' + (mas[5][last] == null ? '—' : mas[5][last].toFixed(2)) + '</b><br>' +
        'MA20 = 最近 20 根收盘均值 = <b>' + (mas[20][last] == null ? '—' : mas[20][last].toFixed(2)) + '</b>；信号检测使用相邻均线（' + (enabled.length > 1 ? '5×10、10×20 等' : '至少两条均线') + '）。';
      if (st.c4Lag > 0) {
        c4Formula.innerHTML += '<br>显示：MA5 右移 ' + st.c4Lag + ' 根，使用 ' + st.c4Lag + ' 根之前的均线值。';
      }
    }

    /* =========================================================
     *  C5 render
     * ========================================================= */
    function c5Close() { return c5Data().map(function (c) { return c.c; }); }

    function c5RsiValues() { return core.rsi(c5Close(), st.c5Rsi); }
    function c5MacdValues() { return core.macd(c5Close(), st.c5Fast, st.c5Slow, st.c5Signal); }

    function renderC5() {
      if (!inst.c5) {
        inst.c5 = charts.kline(c5Host, {
          candles: [], market: 'cn', fill: 'solid', showVolume: true,
          visibleCount: 140, volumeMA: [], label: 'RSI 与 MACD 副图'
        });
      }
      var data = c5Data();
      var closes = c5Close();
      var rsiVals = c5RsiValues();
      var macdVals = c5MacdValues();
      var n = closes.length, last = n - 1;
      var rsiNow = rsiVals[last];
      var difNow = macdVals.dif[last];
      var deaNow = macdVals.dea[last];
      var histNow = macdVals.hist[last];

      var indicator = null;
      if (st.c5Ind === 'rsi') {
        indicator = {
          series: [{ values: rsiVals, color: p.cyan, width: 1.5 }],
          bands: [{ from: 30, to: 70, color: alpha(p.cyan, 0.05) }],
          lines: [
            { value: 70, label: '70 超买', color: p.red, dash: [2, 3] },
            { value: 30, label: '30 超卖', color: p.green, dash: [2, 3] }
          ],
          range: [0, 100]
        };
      } else {
        indicator = {
          series: [
            { values: macdVals.dif, color: p.cyan, width: 1.4 },
            { values: macdVals.dea, color: p.orange, width: 1.2 },
            { values: macdVals.hist, hist: true }
          ],
          lines: [{ value: 0, color: p.gridStrong, dash: [] }]
        };
      }
      bindIndicatorCtx(c5Host);
      inst.c5.setData({ candles: viewCandles(data), overlays: [], markers: [], indicator: indicator, visibleCount: n, resetView: true });

      c5Met.set({
        rsi: rsiNow == null ? '—' : rsiNow.toFixed(1),
        dif: difNow == null ? '—' : difNow.toFixed(2),
        dea: deaNow == null ? '—' : deaNow.toFixed(2),
        hist: histNow == null ? '—' : histNow.toFixed(2)
      }, { hist: histNow == null ? '' : histNow >= 0 ? 'pos' : 'neg' });

      var period = st.c5Rsi;
      var band = rsiNow >= 70 ? '超买区（≥70）' : rsiNow <= 30 ? '超卖区（≤30）' : '中性区（30–70）';
      capC5.innerHTML = '<b>上</b> 日 K 线 <span class="c-sep">|</span> <b>中</b> 成交量 <span class="c-sep">|</span> <b>下</b> ' +
        (st.c5Ind === 'rsi' ? 'RSI(' + period + ') 0–100，虚线 30/70' : 'MACD ' + st.c5Fast + '/' + st.c5Slow + '/' + st.c5Signal + '，柱 2×(DIF−DEA)');
      if (st.c5Ind === 'rsi') {
        c5Read.innerHTML = '<b>RSI(' + period + ') = ' + (rsiNow == null ? '—' : rsiNow.toFixed(1)) + '</b>，' + band + '。它衡量过去 ' + period + ' 根的涨跌力量对比；超卖只说明跌得多，不包含“即将反弹”的信息。';
        c5Legend.innerHTML = '<span><i style="background:' + p.cyan + '"></i>RSI</span><span><i style="background:' + p.red + '"></i>70 超买</span><span><i style="background:' + p.green + '"></i>30 超卖</span>';
        c5Formula.innerHTML = 'RSI(' + period + ') = 100 − 100 ÷ (1 + RS)，RS＝' + period + ' 根平均涨幅 ÷ 平均跌幅（Wilder 平滑）<br>当前：RSI(' + period + ') = <b>' + (rsiNow == null ? '—' : rsiNow.toFixed(1)) + '</b>；≥70 超买，≤30 超卖。';
      } else {
        c5Read.innerHTML = '<b>DIF ' + (difNow == null ? '—' : difNow.toFixed(2)) + ' / DEA ' + (deaNow == null ? '—' : deaNow.toFixed(2)) + ' / 柱 ' + (histNow == null ? '—' : histNow.toFixed(2)) + '</b>。柱翻红只代表 DIF 回到 DEA 上方，动量改善；不等于价格一定上涨。';
        c5Legend.innerHTML = '<span><i style="background:' + p.cyan + '"></i>DIF</span><span><i style="background:' + p.orange + '"></i>DEA</span><span><i style="background:' + p.red + '"></i>正柱</span><span><i style="background:' + p.green + '"></i>负柱</span>';
        c5Formula.innerHTML = 'DIF = EMA' + st.c5Fast + ' − EMA' + st.c5Slow + ' = <b>' + (difNow == null ? '—' : difNow.toFixed(2)) + '</b><br>' +
          'DEA = EMA' + st.c5Signal + '(DIF) = <b>' + (deaNow == null ? '—' : deaNow.toFixed(2)) + '</b><br>' +
          'MACD 柱 = 2 × (DIF − DEA) = <b>' + (histNow == null ? '—' : histNow.toFixed(2)) + '</b>';
      }
    }

    /* =========================================================
     *  C6 render
     * ========================================================= */
    function c6Params() {
      return {
        boll: [st.c6BollN, st.c6BollM],
        kdj: [st.c6KdjN],
        wr: [st.c6WrN],
        dmi: [st.c6DmiN],
        bias: [st.c6BiasN],
        cci: [st.c6CciN],
        roc: [st.c6RocN]
      };
    }

    function symRange(values, floor) {
      var m = floor || 1;
      values.forEach(function (v) { if (v != null && isFinite(v)) m = Math.max(m, Math.abs(v)); });
      return [-m * 1.15, m * 1.15];
    }

    function c6Pack() {
      var data = c6Data();
      var closes = data.map(function (c) { return c.c; });
      var n = closes.length, last = n - 1, ind = st.c6Ind;
      var overlays = [], indicator = null, metrics = [], read = '', formula = '', pane = '';
      if (ind === 'boll') {
        var boll = core.boll(closes, st.c6BollN, st.c6BollM);
        overlays = [
          { name: 'BOLL 上轨', values: boll.upper, color: p.blue, width: 1.1, dash: [4, 3] },
          { name: 'BOLL 中轨', values: boll.mid, color: p.cyan, width: 1.3 },
          { name: 'BOLL 下轨', values: boll.lower, color: p.violet, width: 1.1, dash: [4, 3] }
        ];
        pane = '主图 · BOLL(' + st.c6BollN + ', ' + st.c6BollM + 'σ)';
        metrics = [
          { key: 'up', label: '上轨', value: boll.upper[last] == null ? '—' : boll.upper[last].toFixed(2), tone: 'hi' },
          { key: 'mid', label: '中轨 MA' + st.c6BollN, value: boll.mid[last] == null ? '—' : boll.mid[last].toFixed(2) },
          { key: 'low', label: '下轨', value: boll.lower[last] == null ? '—' : boll.lower[last].toFixed(2), tone: 'hi' },
          { key: 'w', label: '带宽 %', value: boll.width[last] == null ? '—' : boll.width[last].toFixed(2) }
        ];
        read = '<b>BOLL</b> 把均线与标准差画成通道：中轨是 MA' + st.c6BollN + '，上下轨是中轨 ± ' + st.c6BollM + 'σ。<br>价格触上轨只表示相对均线偏高，<b>不是必跌</b>；单边趋势中价格可以贴着上轨走很久。';
        formula = '中轨 = MA' + st.c6BollN + ' = <b>' + (boll.mid[last] == null ? '—' : boll.mid[last].toFixed(2)) + '</b><br>' +
          '上轨 = 中轨 + ' + st.c6BollM + 'σ = <b>' + (boll.upper[last] == null ? '—' : boll.upper[last].toFixed(2)) + '</b><br>' +
          '下轨 = 中轨 − ' + st.c6BollM + 'σ = <b>' + (boll.lower[last] == null ? '—' : boll.lower[last].toFixed(2)) + '</b>';
      } else if (ind === 'kdj') {
        var kdj = core.kdj(data, st.c6KdjN, 3, 3);
        indicator = {
          series: [
            { values: kdj.k, color: p.cyan, width: 1.4 },
            { values: kdj.d, color: p.orange, width: 1.2 },
            { values: kdj.j, color: p.violet, width: 1.1 }
          ],
          bands: [{ from: 20, to: 80, color: alpha(p.cyan, 0.04) }],
          lines: [
            { value: 80, label: '80 超买', color: p.red, dash: [2, 3] },
            { value: 20, label: '20 超卖', color: p.green, dash: [2, 3] }
          ],
          range: [0, 100]
        };
        pane = '副图 · KDJ(' + st.c6KdjN + ') 0–100';
        var kNow = kdj.k[last], dNow = kdj.d[last], jNow = kdj.j[last];
        metrics = [
          { key: 'k', label: 'K', value: kNow.toFixed(1), tone: kNow >= 80 ? 'hi' : '' },
          { key: 'd', label: 'D', value: dNow.toFixed(1) },
          { key: 'j', label: 'J（3K−2D）', value: jNow.toFixed(1), tone: jNow > 100 || jNow < 0 ? 'hi' : '' },
          { key: 'st', label: '状态', value: kNow >= 80 ? '超买区' : kNow <= 20 ? '超卖区' : '中性区' }
        ];
        read = '<b>KDJ</b> 先算 RSV＝收盘在最近 ' + st.c6KdjN + ' 日高低区间中的位置，再做两次平滑。J 可以超出 0–100，<b>J &gt; 100 不是买点</b>，只是位置极端。';
        formula = 'RSV = (C − L' + st.c6KdjN + ') ÷ (H' + st.c6KdjN + ' − L' + st.c6KdjN + ') × 100<br>K = 2/3 × K₋₁ + 1/3 × RSV = <b>' + kNow.toFixed(1) + '</b><br>D = 2/3 × D₋₁ + 1/3 × K = <b>' + dNow.toFixed(1) + '</b>；J = 3K − 2D = <b>' + jNow.toFixed(1) + '</b>';
      } else if (ind === 'wr') {
        var wr = core.wr(data, st.c6WrN);
        indicator = {
          series: [{ values: wr, color: p.cyan, width: 1.5 }],
          bands: [{ from: -80, to: -20, color: alpha(p.cyan, 0.04) }],
          lines: [
            { value: -20, label: '−20 超买', color: p.red, dash: [2, 3] },
            { value: -80, label: '−80 超卖', color: p.green, dash: [2, 3] }
          ],
          range: [-100, 0]
        };
        pane = '副图 · WR(' + st.c6WrN + ') −100–0';
        var wrNow = wr[last];
        metrics = [
          { key: 'wr', label: 'WR', value: wrNow == null ? '—' : wrNow.toFixed(1), tone: wrNow != null && (wrNow <= -80 || wrNow >= -20) ? 'hi' : '' },
          { key: 'hi', label: '超买线', value: '−20' },
          { key: 'lo', label: '超卖线', value: '−80' },
          { key: 'st', label: '状态', value: wrNow == null ? '—' : wrNow <= -80 ? '超卖区' : wrNow >= -20 ? '超买区' : '中性区' }
        ];
        read = '<b>WR</b> 的读数和常见摆动指标方向相反：<b>0 附近偏强，−100 附近偏弱</b>。把 0 当超买是常见误读；这里 −20 以上算超买、−80 以下算超卖。';
        formula = 'WR(' + st.c6WrN + ') = (H' + st.c6WrN + ' − C) ÷ (H' + st.c6WrN + ' − L' + st.c6WrN + ') × (−100) = <b>' + (wrNow == null ? '—' : wrNow.toFixed(1)) + '</b>';
      } else if (ind === 'dmi') {
        var dmi = core.dmi(data, st.c6DmiN, 6);
        indicator = {
          series: [
            { values: dmi.pdi, color: p.cyan, width: 1.4 },
            { values: dmi.mdi, color: p.orange, width: 1.4 },
            { values: dmi.adx, color: p.violet, width: 1.2 }
          ],
          lines: [{ value: 20, label: '20 趋势阈值', color: p.gridStrong, dash: [2, 3] }],
          range: [0, 100]
        };
        pane = '副图 · DMI(' + st.c6DmiN + ') 0–100';
        var pdiNow = dmi.pdi[last], mdiNow = dmi.mdi[last], adxNow = dmi.adx[last];
        metrics = [
          { key: 'pdi', label: '+DI', value: pdiNow == null ? '—' : pdiNow.toFixed(1), tone: 'hi' },
          { key: 'mdi', label: '−DI', value: mdiNow == null ? '—' : mdiNow.toFixed(1) },
          { key: 'adx', label: 'ADX', value: adxNow == null ? '—' : adxNow.toFixed(1) },
          { key: 'st', label: '状态', value: adxNow == null ? '—' : adxNow >= 25 ? '趋势较强' : '趋势偏弱' }
        ];
        read = '<b>DMI</b> 用 +DI/−DI 表示方向、ADX 表示趋势强度。<b>ADX 高只说明趋势强，不说明方向</b>；上涨和下跌都可能是强趋势。';
        formula = '+DI = ' + (pdiNow == null ? '—' : pdiNow.toFixed(1)) + '；−DI = ' + (mdiNow == null ? '—' : mdiNow.toFixed(1)) + '；ADX = ' + (adxNow == null ? '—' : adxNow.toFixed(1)) + '<br>ADX 由 DX 平滑得到，DX = |+DI − −DI| ÷ (+DI + −DI) × 100。';
      } else if (ind === 'bias') {
        var bias = core.bias(closes, st.c6BiasN);
        indicator = {
          series: [{ values: bias, color: p.cyan, width: 1.5 }],
          lines: [{ value: 0, label: '0 均线', color: p.gridStrong, dash: [] }]
        };
        pane = '副图 · BIAS(' + st.c6BiasN + ') 围绕 0';
        var biasNow = bias[last];
        var maNow = core.ma(closes, st.c6BiasN)[last];
        metrics = [
          { key: 'bias', label: 'BIAS', value: biasNow == null ? '—' : biasNow.toFixed(2) + '%', tone: biasNow == null ? '' : biasNow >= 0 ? 'pos' : 'neg' },
          { key: 'ma', label: 'MA' + st.c6BiasN, value: maNow == null ? '—' : maNow.toFixed(2) },
          { key: 'sign', label: '位置', value: biasNow == null ? '—' : biasNow >= 0 ? '均线上方' : '均线下方' },
          { key: 'st', label: '状态', value: biasNow == null ? '—' : Math.abs(biasNow) >= 5 ? '偏离较大' : '贴近均线' }
        ];
        read = '<b>BIAS</b>＝收盘相对均线的百分比偏离。<b>偏离大不等于马上回归</b>：强趋势中 BIAS 可以长期维持高位或低位。';
        formula = 'BIAS(' + st.c6BiasN + ') = (C − MA' + st.c6BiasN + ') ÷ MA' + st.c6BiasN + ' × 100% = <b>' + (biasNow == null ? '—' : biasNow.toFixed(2) + '%') + '</b>';
      } else if (ind === 'obv') {
        var obv = core.obv(data);
        indicator = {
          series: [{ values: obv, color: p.cyan, width: 1.6 }],
          lines: []
        };
        pane = '副图 · OBV 累计量能（股）';
        var obvNow = obv[last], obvPrev = obv[last - 1];
        metrics = [
          { key: 'obv', label: 'OBV', value: ui.fmt.compact(obvNow) },
          { key: 'chg', label: '较前一根', value: ui.fmt.compact(obvNow - obvPrev), tone: obvNow >= obvPrev ? 'pos' : 'neg' },
          { key: 'dir', label: '20 日方向', value: obvNow >= obv[Math.max(0, last - 20)] ? '向上' : '向下', tone: obvNow >= obv[Math.max(0, last - 20)] ? 'pos' : 'neg' },
          { key: 'st', label: '口径', value: '涨加跌减' }
        ];
        read = '<b>OBV</b> 按收盘涨跌把成交量累加：上涨日加量、下跌日减量。它把“量”和“价”的方向绑在一起，<b>OBV 上升不等于主力吸筹</b>，只是上涨日成交更多。';
        formula = 'OBVₜ = OBVₜ₋₁ ' + (obvNow >= obvPrev ? '+' : '−') + ' Vₜ = <b>' + ui.fmt.compact(obvNow) + '</b> 股<br>规则：收盘上涨加当日量，下跌减当日量，平盘不变。';
      } else if (ind === 'cci') {
        var cci = core.cci(data, st.c6CciN);
        indicator = {
          series: [{ values: cci, color: p.cyan, width: 1.5 }],
          lines: [
            { value: 100, label: '+100', color: p.red, dash: [2, 3] },
            { value: -100, label: '−100', color: p.green, dash: [2, 3] },
            { value: 0, label: '0', color: p.gridStrong, dash: [] }
          ],
          range: symRange(cci, 100)
        };
        pane = '副图 · CCI(' + st.c6CciN + ') ±100';
        var cciNow = cci[last];
        metrics = [
          { key: 'cci', label: 'CCI', value: cciNow == null ? '—' : cciNow.toFixed(1), tone: cciNow == null ? '' : cciNow >= 0 ? 'pos' : 'neg' },
          { key: 'up', label: '+100', value: '强势线' },
          { key: 'dn', label: '−100', value: '弱势线' },
          { key: 'st', label: '状态', value: cciNow == null ? '—' : cciNow > 100 ? '上破 +100' : cciNow < -100 ? '下破 −100' : '区间内' }
        ];
        read = '<b>CCI</b> 用典型价 (H+L+C)/3 衡量偏离程度。突破 ±100 只表示偏离较大，<b>不是必然反转</b>；强趋势中 CCI 可以在 100 以上停留很久。';
        formula = 'CCI(' + st.c6CciN + ') = (TP − MA(TP)) ÷ (0.015 × 平均绝对偏差) = <b>' + (cciNow == null ? '—' : cciNow.toFixed(1)) + '</b><br>TP = (H + L + C) ÷ 3。';
      } else {
        var roc = core.roc(closes, st.c6RocN);
        indicator = {
          series: [{ values: roc, color: p.cyan, width: 1.5 }],
          lines: [{ value: 0, label: '0 轴', color: p.gridStrong, dash: [] }],
          range: symRange(roc, 1)
        };
        pane = '副图 · ROC(' + st.c6RocN + ') 围绕 0';
        var rocNow = roc[last];
        metrics = [
          { key: 'roc', label: 'ROC', value: rocNow == null ? '—' : rocNow.toFixed(2) + '%', tone: rocNow == null ? '' : rocNow >= 0 ? 'pos' : 'neg' },
          { key: 'zero', label: '0 轴', value: '无涨跌' },
          { key: 'base', label: st.c6RocN + ' 日前收盘', value: closes[last - st.c6RocN] == null ? '—' : closes[last - st.c6RocN].toFixed(2) },
          { key: 'st', label: '状态', value: rocNow == null ? '—' : rocNow >= 0 ? '正动量' : '负动量' }
        ];
        read = '<b>ROC</b> 是最直接的动量：当前收盘相对 N 日前收盘的涨跌幅。<b>ROC 高不代表还会涨</b>，它只是过去 N 根的变动幅度。';
        formula = 'ROC(' + st.c6RocN + ') = (Cₜ ÷ Cₜ₋' + st.c6RocN + ' − 1) × 100% = <b>' + (rocNow == null ? '—' : rocNow.toFixed(2) + '%') + '</b>';
      }
      return { data: data, overlays: overlays, indicator: indicator, pane: pane, metrics: metrics, read: read, formula: formula };
    }

    function renderC6() {
      if (!inst.c6) {
        inst.c6 = charts.kline(c6Host, {
          candles: [], market: 'cn', fill: 'solid', showVolume: true,
          visibleCount: 120, volumeMA: [], label: '扩展指标副图'
        });
      }
      var pack = c6Pack();
      bindIndicatorCtx(c6Host);
      inst.c6.setData({
        candles: viewCandles(pack.data), overlays: pack.overlays, markers: [],
        indicator: pack.indicator, visibleCount: isNarrow() ? 60 : 120, resetView: true
      });
      c6TabsArr.forEach(function (t) { t.el.setAttribute('aria-pressed', String(t.value === st.c6Ind)); });
      capC6.innerHTML = '<b>上</b> 价格' + (pack.overlays.length ? ' + BOLL 上/中/下轨' : '') +
        ' <span class="c-sep">|</span> <b>中</b> 成交量 <span class="c-sep">|</span> <b>下</b> ' + (pack.indicator ? pack.pane.replace('副图 · ', '') : '无副图');
      c6MetricsHost.innerHTML = '';
      c6MetricsHost.appendChild(ui.metrics(pack.metrics).el);
      c6Read.innerHTML = pack.read;
      var lg = '';
      if (st.c6Ind === 'boll') lg = '<span><i style="background:' + p.blue + '"></i>上轨（虚线）</span><span><i style="background:' + p.cyan + '"></i>中轨</span><span><i style="background:' + p.violet + '"></i>下轨（虚线）</span>';
      else if (st.c6Ind === 'kdj') lg = '<span><i style="background:' + p.cyan + '"></i>K</span><span><i style="background:' + p.orange + '"></i>D</span><span><i style="background:' + p.violet + '"></i>J</span><span><i style="background:' + p.red + '"></i>80</span><span><i style="background:' + p.green + '"></i>20</span>';
      else if (st.c6Ind === 'wr') lg = '<span><i style="background:' + p.cyan + '"></i>WR</span><span><i style="background:' + p.red + '"></i>−20</span><span><i style="background:' + p.green + '"></i>−80</span>';
      else if (st.c6Ind === 'dmi') lg = '<span><i style="background:' + p.cyan + '"></i>+DI</span><span><i style="background:' + p.orange + '"></i>−DI</span><span><i style="background:' + p.violet + '"></i>ADX</span><span><i style="background:' + p.gridStrong + '"></i>20</span>';
      else if (st.c6Ind === 'bias') lg = '<span><i style="background:' + p.cyan + '"></i>BIAS</span><span><i style="background:' + p.gridStrong + '"></i>0</span>';
      else if (st.c6Ind === 'obv') lg = '<span><i style="background:' + p.cyan + '"></i>OBV 累计量</span>';
      else if (st.c6Ind === 'cci') lg = '<span><i style="background:' + p.cyan + '"></i>CCI</span><span><i style="background:' + p.red + '"></i>+100</span><span><i style="background:' + p.green + '"></i>−100</span><span><i style="background:' + p.gridStrong + '"></i>0</span>';
      else lg = '<span><i style="background:' + p.cyan + '"></i>ROC</span><span><i style="background:' + p.gridStrong + '"></i>0</span>';
      c6Legend.innerHTML = lg;
      c6Formula.innerHTML = pack.formula;
    }

    /* =========================================================
     *  render / apply / destroy
     * ========================================================= */
    function render() {
      syncPanelVisibility();
      ['c1', 'c2', 'c4', 'c5', 'c6'].forEach(function (key) {
        if (st.mode !== key && inst[key]) { inst[key].destroy(); inst[key] = null; }
      });
      if (st.mode === 'c1') renderC1();
      else if (st.mode === 'c2') renderC2();
      else if (st.mode === 'c3') renderC3();
      else if (st.mode === 'c4') renderC4();
      else if (st.mode === 'c5') renderC5();
      else if (st.mode === 'c6') renderC6();
    }

    function apply(patch) {
      if (!patch) return;
      Object.keys(patch).forEach(function (k) {
        if (k === 'ma') st.ma = Object.assign({}, st.ma, patch.ma);
        else st[k] = patch[k];
      });
      st.mode = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].indexOf(st.mode) >= 0 ? st.mode : 'c1';
      st.c3Window = clamp(Math.round(st.c3Window), 0, C3_BARS - 5);
      st.c3EditVal = clamp(st.c3EditVal, 4, 20);
      st.c2Window = clamp(Math.round(st.c2Window), 40, 150);
      st.c4Lag = clamp(st.c4Lag, 0, 10);
      syncControls();
      render();
    }

    syncControls();
    render();

    return {
      apply: apply,
      destroy: function () {
        if (c3RO) c3RO.disconnect();
        if (c3Raf) cancelAnimationFrame(c3Raf);
        window.removeEventListener('sm:theme', c3Theme);
        Object.keys(inst).forEach(function (k) {
          if (inst[k] && inst[k].destroy) inst[k].destroy();
          inst[k] = null;
        });
        c3Canvas.width = 0; c3Canvas.height = 0;
      }
    };
  }

  SM.registerModule({
    id: 'C', slug: 'indicators', order: 3,
    title: '成交量与技术指标', en: 'INDICATORS',
    subtitle: '成交量、均线窗口、RSI/MACD 与八种扩展指标',
    hint: '切换实验，拖动参数，观察指标如何由价格与成交量计算出来。',
    scenes: [
      {
        title: '成交量：一笔成交的两侧',
        body: '成交量是这一周期内成交的股数，<b>每一笔成交都同时有一个买方和一个卖方</b>。<br>成交量只统计一次，不是把买卖双方各算一遍；放大或缩小成交量，观察柱高与换手率如何一起变化。',
        patch: { mode: 'c1', c1Preset: 'volume-spike', c1Mult: 1.5 },
        guide: '看下方两张卡片：买方与卖方的现金、股票方向相反；再看成交量状态是放量还是缩量。',
        duration: 12000
      },
      {
        title: '量价关系：放量不等于净买入',
        body: '同样的 K 线可以配放量或缩量，得到四种常见组合。<br><b>放量只说明换手更活跃</b>，不等于存在“净买入资金”；每一笔成交仍有买卖双方。',
        patch: { mode: 'c2', c2Case: 'upVol', c2Window: 100 },
        guide: '依次点四个按钮，比较 20 日涨跌幅与量能变化；结论文字会说明每种组合不能证明什么。',
        duration: 13000
      },
      {
        title: '均线窗口：五个收盘价怎么变成 11.4',
        body: '把五个收盘价 10、11、12、11、13 相加再除以 5，MA5 = <b>11.4</b>。<br>拖动窗口滑块，看哪五根被纳入；改写中间那根 12，观察均值如何变化。',
        patch: { mode: 'c3', c3Window: C3_BARS - 5, c3EditVal: 12 },
        guide: '窗口默认在最后一格；把 12 改成 14，MA5 应从 11.40 变成 11.80。',
        duration: 13000
      },
      {
        title: '均线系统：金叉、死叉与滞后',
        body: '短均线上穿长均线叫<b>金叉</b>，下穿叫<b>死叉</b>；多条均线按周期从短到长排列，分别称为多头排列或空头排列。<br>均线是过去 N 根收盘的平均，转折天然滞后。',
        patch: { mode: 'c4', ma: { 5: true, 10: true, 20: true, 60: false }, c4Lag: 0 },
        guide: '先看默认 5/10/20 的排列与箭头；再把“滞后对比”拉到 6 根，比较虚线 MA5 与当前 MA5。',
        duration: 14000
      },
      {
        title: 'RSI 与 MACD：超卖不是反弹保证',
        body: 'RSI 把涨跌力量压缩到 0–100，MACD 用两条 EMA 的差观察动量。<br>RSI 低于 30 只表示<b>过去跌得多</b>，不是反弹保证；MACD 柱的正负也会反复。',
        patch: { mode: 'c5', c5Ind: 'rsi', c5Rsi: 14, c5Fast: 12, c5Slow: 26, c5Signal: 9 },
        guide: '先看 RSI 的 30/70 虚线，再切到 MACD；拖动周期，观察同一个价格序列怎样得到不同读数。',
        duration: 14000
      },
      {
        title: '扩展指标：同一段价格，不同透镜',
        body: 'BOLL、KDJ、WR、DMI、BIAS、OBV、CCI、ROC 各自回答不同问题：波动区间、超买超卖、趋势方向、偏离程度或累积量能。<br>它们都只描述过去，在趋势市和震荡市中的表现并不相同。',
        patch: { mode: 'c6', c6Ind: 'kdj' },
        guide: '逐个切换八个指标：注意副图纵轴范围（0–100、−100–0、±100、围绕 0）并不相同。',
        duration: 15000
      }
    ],
    quiz: [
      {
        q: '某笔成交 1,000 股，价格 10 元。关于成交量，下列哪项正确？',
        options: [
          '买方和卖方各 1,000 股，所以成交量计 2,000 股',
          '成交量计 1,000 股，买卖双方各改变 1,000 股',
          '成交量只在上涨时计入',
          '成交量等于公司收到的现金'
        ],
        answer: 1,
        explain: '成交量只统计成交股数一次，是 <b>1,000 股</b>；买方得到 1,000 股、付出 10,000 元，卖方相反。公司不是二级市场的交易对手。'
      },
      {
        q: '“放量上涨”最能说明什么？',
        options: [
          '有净买入资金进场，后市必涨',
          '换手更活跃，但每一笔成交仍有买卖双方',
          '所有卖方都看多',
          '公司获得了融资'
        ],
        answer: 1,
        explain: '放量＝成交更活跃，不是“净买入”。每一笔成交都同时有买方和卖方；后市方向不能由成交量单独保证。'
      },
      {
        q: '五个收盘价 10、11、12、11、13 的 MA5，以及把 12 改成 15 后的 MA5，分别是？',
        options: ['11.4；12.0', '11.4；11.8', '11.0；12.0', '57；60'],
        answer: 0,
        explain: '原值 (10+11+12+11+13)÷5 = <b>11.4</b>；改为 15 后 (10+11+15+11+13)÷5 = 60÷5 = <b>12.0</b>。'
      }
    ],
    mount: mount
  });
})();
