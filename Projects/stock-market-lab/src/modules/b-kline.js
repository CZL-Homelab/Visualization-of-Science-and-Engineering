/* Module B — the candlestick laboratory: anatomy, colour conventions,
 * period aggregation and the limits of what one bar can tell you. */
(function () {
  'use strict';
  var SM = window.SM;
  var ui = SM.ui, core = SM.core, charts = SM.charts;
  var NS = 'http://www.w3.org/2000/svg';

  var B1_DEFAULT = { o: 100, h: 108, l: 98, c: 106 };
  var B2_CASES = {
    gapUp: { prev: 100, o: 97, h: 100.6, l: 96, c: 99, title: '低开收涨，但仍低于昨收' },
    gapDown: { prev: 95, o: 99, h: 100.2, l: 96, c: 96.5, title: '高开低走收阴，但仍高于昨收' }
  };
  var PERIODS = ['1m', '5m', '15m', '30m', '60m', 'D', 'W', 'M'];

  function svgEl(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function mount(ctx) {
    var p = charts.palette();
    var st = {
      mode: 'b1',
      market: 'cn', fill: 'solid',
      b1: Object.assign({}, B1_DEFAULT),
      b2: 'gapUp', prev: 100,
      period: 'D', ma: { 5: true, 10: true, 20: true, 60: false },
      pattern: 'bigUp', vol: 1, pathSeed: 1
    };
    var stage = ctx.stage, panel = ctx.panel;

    /* ================= stage containers ================= */
    function box() {
      var d = ui.el('div');
      d.style.cssText = 'display:flex;flex-direction:column;gap:8px;flex:1;min-height:0';
      stage.appendChild(d);
      return d;
    }

    // B1
    var wrapB1 = ui.el('div');
    wrapB1.style.cssText = 'display:flex;flex-direction:column;gap:8px;flex:1;min-height:0';
    var edHost = ui.el('div', 'ed-host');
    edHost.style.flex = '1';
    wrapB1.appendChild(edHost);
    stage.appendChild(wrapB1);
    var editor = candleEditor(edHost, st, function () { render(); });

    // B2
    var wrapB2 = box();
    var b2ChartHost = ui.el('div', 'chart');
    b2ChartHost.style.flex = '1';
    wrapB2.appendChild(b2ChartHost);
    var b2Cards = ui.el('div', 'b2-cards');
    wrapB2.appendChild(b2Cards);
    var b2Chart = charts.kline(b2ChartHost, { candles: [], market: 'cn', fill: 'solid', showVolume: false, visibleCount: 2, minCount: 2, skipLabel: true, label: '两根日 K 线对比' });

    // B3
    var wrapB3 = box();
    var b3Info = ui.el('div', 'info-strip');
    wrapB3.appendChild(b3Info);
    var b3ChartHost = ui.el('div', 'chart');
    b3ChartHost.style.flex = '1';
    wrapB3.appendChild(b3ChartHost);
    var b3Chart = charts.kline(b3ChartHost, { candles: [], market: 'cn', fill: 'solid', showVolume: true, visibleCount: 120, label: '多周期 K 线' });

    // B4
    var wrapB4 = ui.el('div', 'stage-grid two');
    wrapB4.style.flex = '1';
    var b4Left = ui.el('div', 'fill');
    var b4Right = ui.el('div', 'fill');
    var b4ChartHost = ui.el('div', 'chart');
    var pathHost = ui.el('div', 'chart');
    b4Left.appendChild(b4ChartHost);
    var pathLegend = ui.el('div', 'legend');
    b4Right.appendChild(pathHost);
    b4Right.appendChild(pathLegend);
    wrapB4.appendChild(b4Left); wrapB4.appendChild(b4Right);
    stage.appendChild(wrapB4);
    var b4Chart = charts.kline(b4ChartHost, { candles: [], market: 'cn', fill: 'solid', showVolume: true, visibleCount: 12, minCount: 4, volumeMA: [], label: '形态示例' });
    var pathChart = charts.lines(pathHost, { series: [], labels: [], zero: false, label: '同一 OHLC 的不同盘中路径' });

    /* ================= panel ================= */
    var gMode = ui.section(panel, '实验室', 'B1–B4');
    var modeCtl = ui.seg({
      options: [
        { value: 'b1', label: 'B1 单根' }, { value: 'b2', label: 'B2 颜色' },
        { value: 'b3', label: 'B3 周期' }, { value: 'b4', label: 'B4 形态' }
      ],
      value: 'b1',
      onChange: function (v) { st.mode = v; syncUI(true); }
    });
    gMode.appendChild(modeCtl.el);

    var gDisplay = ui.section(panel, '显示约定', 'COLOUR');
    var marketCtl = ui.seg({
      label: '市场配色',
      options: [{ value: 'cn', label: 'A 股 红涨绿跌' }, { value: 'us', label: '美股 绿涨红跌' }],
      value: 'cn',
      onChange: function (v) { st.market = v; render(); }
    });
    var fillCtl = ui.seg({
      label: '实体填充',
      options: [{ value: 'solid', label: '实心' }, { value: 'hollow', label: '空心' }],
      value: 'solid',
      onChange: function (v) { st.fill = v; render(); }
    });
    gDisplay.appendChild(marketCtl.el); gDisplay.appendChild(fillCtl.el);
    gDisplay.appendChild(ui.note('颜色和空心/实心都是<strong>软件显示约定</strong>，不代表成交量大小，也不改变 OHLC 数值。'));

    // B1 controls
    var gB1 = ui.section(panel, 'B1 · 四价编辑', 'OHLC');
    var ctlO = ui.slider({ label: '开盘 Open', min: 80, max: 125, step: 0.5, value: 100, onInput: function (v) { st.b1.o = v; clampBars('o'); render(); } });
    var ctlH = ui.slider({ label: '最高 High', min: 80, max: 125, step: 0.5, value: 108, onInput: function (v) { st.b1.h = v; clampBars('h'); render(); } });
    var ctlL = ui.slider({ label: '最低 Low', min: 80, max: 125, step: 0.5, value: 98, onInput: function (v) { st.b1.l = v; clampBars('l'); render(); } });
    var ctlC = ui.slider({ label: '收盘 Close', min: 80, max: 125, step: 0.5, value: 106, onInput: function (v) { st.b1.c = v; clampBars('c'); render(); } });
    [ctlO, ctlH, ctlL, ctlC].forEach(function (c) { gB1.appendChild(c.el); });
    gB1.appendChild(ui.row([
      ui.button('阳线', function () { Object.assign(st.b1, { o: 100, h: 108, l: 98, c: 106 }); render(); }, 'sm'),
      ui.button('阴线', function () { Object.assign(st.b1, { o: 106, h: 108, l: 98, c: 100 }); render(); }, 'sm'),
      ui.button('十字星', function () { Object.assign(st.b1, { o: 102, h: 107, l: 97, c: 102.1 }); render(); }, 'sm')
    ]));
    var b1Check = ui.note('');
    gB1.appendChild(b1Check);

    // B2 controls
    var gB2 = ui.section(panel, 'B2 · 两个“涨跌”', 'TWO RULES');
    var caseCtl = ui.seg({
      options: [{ value: 'gapUp', label: '低开收涨' }, { value: 'gapDown', label: '高开低走' }],
      value: 'gapUp',
      onChange: function (v) { st.b2 = v; Object.assign(st, { prev: B2_CASES[v].prev }); render(); }
    });
    var prevCtl = ui.slider({ label: '昨收价', min: 85, max: 110, step: 0.5, value: 100, unit: '元', onInput: function (v) { st.prev = v; render(); } });
    gB2.appendChild(caseCtl.el); gB2.appendChild(prevCtl.el);
    gB2.appendChild(ui.note('阳线/阴线只比较<strong>收盘与开盘</strong>；行情软件的涨跌幅比较<strong>当前价与昨收</strong>。两套规则可以给出相反结论。'));

    // B3 controls
    var gB3 = ui.section(panel, 'B3 · 周期聚合', 'AGGREGATE');
    var periodCtl = ui.seg({
      label: 'K 线周期',
      options: PERIODS.map(function (x) { return { value: x, label: core.PERIOD_LABEL[x] }; }),
      value: 'D',
      onChange: function (v) {
        if (!dataCache[v] || !dataCache[v].length) {
          ctx.toast('当前基础序列是日线，无法聚合出 ' + core.PERIOD_LABEL[v]);
          periodCtl.set(st.period);
          return;
        }
        st.period = v; render();
      }
    });
    gB3.appendChild(periodCtl.el);
    var srcCtl = ui.seg({
      label: '序列来源',
      options: [{ value: 'sim', label: '模拟数据' }, { value: 'import', label: '导入数据' }],
      value: 'sim',
      onChange: function (v) {
        if (v === 'import' && !importRes) {
          ctx.toast('还没有导入数据：可在页面下方「数据」区粘贴 CSV/JSON 或选择文件');
          srcCtl.set('sim');
          return;
        }
        applySource(v);
      }
    });
    gB3.appendChild(srcCtl.el);
    var srcNote = ui.note('当前使用<strong>模拟行情</strong>：固定随机种子，可重复。导入数据会标明来源，但不会与模拟数据混在一起。');
    gB3.appendChild(srcNote);
    var maBox = ui.el('div', 'seg');
    [5, 10, 20, 60].forEach(function (n) {
      var b = ui.el('button', null, 'MA' + n);
      b.type = 'button';
      b.setAttribute('aria-pressed', st.ma[n] ? 'true' : 'false');
      b.addEventListener('click', function () {
        st.ma[n] = !st.ma[n];
        b.setAttribute('aria-pressed', st.ma[n] ? 'true' : 'false');
        render();
      });
      maBox.appendChild(b);
    });
    var maWrap = ui.el('div', 'ctl');
    maWrap.appendChild(ui.el('div', 'ctl-top', '<span>均线叠加</span>'));
    maWrap.appendChild(maBox);
    gB3.appendChild(maWrap);
    gB3.appendChild(ui.row([ui.button('定位到最新', function () { render(); b3Chart.zoomTo(dataCache[st.period].length - 90, 90); updateInfo(); }, 'sm')]));
    gB3.appendChild(ui.note('所有周期都由<strong>同一组 1 分钟基础数据</strong>聚合：开=首、高=最高、低=最低、收=尾、量=求和。'));

    // B4 controls
    var gB4 = ui.section(panel, 'B4 · 形态与路径', 'PATTERN');
    var patternCtl = ui.select({
      label: '形态预设',
      options: [
        { value: 'bigUp', label: '大阳线' }, { value: 'bigDown', label: '大阴线' },
        { value: 'upperShadow', label: '长上影线' }, { value: 'lowerShadow', label: '长下影线' },
        { value: 'doji', label: '十字星' }, { value: 'gap', label: '跳空高开' },
        { value: 'streak', label: '连续上涨' }, { value: 'range', label: '震荡行情' }
      ],
      value: 'bigUp',
      onChange: function (v) { st.pattern = v; render(); }
    });
    var volCtl = ui.slider({ label: '影线放大', min: 0.4, max: 2, step: 0.1, value: 1, unit: '×', onInput: function (v) { st.vol = v; render(); } });
    gB4.appendChild(patternCtl.el); gB4.appendChild(volCtl.el);
    gB4.appendChild(ui.row([ui.button('换一条盘中路径', function () { st.pathSeed++; render(); }, 'sm')]));
    gB4.appendChild(ui.warn('形态名称只是对过去价格形状的描述，不是可靠的必涨/必跌信号。同样的四价可以来自完全不同的盘中路径。'));

    // metrics
    var gMetrics = ui.section(panel, '读数', 'LIVE');
    var metB1 = ui.metrics([
      { key: 'type', label: '类型' }, { key: 'body', label: '实体' },
      { key: 'upper', label: '上影线' }, { key: 'lower', label: '下影线' },
      { key: 'range', label: '振幅（对开盘）' }, { key: 'arrow', label: '收盘 − 开盘' }
    ]);
    var metB2 = ui.metrics([
      { key: 'candle', label: 'K 线方向' }, { key: 'day', label: '较昨收' },
      { key: 'gap', label: '开盘缺口' }, { key: 'range', label: '当日振幅' }
    ]);
    var metB3 = ui.metrics([
      { key: 'period', label: '当前周期' }, { key: 'bars', label: 'K 线根数' },
      { key: 'per', label: '每根合成' }, { key: 'vol', label: '最近成交量' }
    ]);
    var metB4 = ui.metrics([
      { key: 'body', label: '实体占比' }, { key: 'upper', label: '上影 / 实体' },
      { key: 'lower', label: '下影 / 实体' }, { key: 'path', label: '路径检验' }
    ]);
    [metB1, metB2, metB3, metB4].forEach(function (x) { gMetrics.appendChild(x.el); });
    var formulaBox = ui.formula('');
    gMetrics.appendChild(formulaBox);
    var gReset = ui.section(panel);
    gReset.appendChild(ui.row([ui.reset(function () {
      st.mode = 'b1'; st.market = 'cn'; st.fill = 'solid';
      st.b1 = Object.assign({}, B1_DEFAULT); st.period = 'D'; st.pattern = 'bigUp'; st.vol = 1; st.pathSeed = 1;
      st.prev = 100; st.b2 = 'gapUp';
      syncUI(true);
    })]));

    /* ================= data for B3 ================= */
    var simRaw = SM.datasets.makeIntraday(20261030, 160);
    simRaw = simRaw.map(function (c) {
      var d = new Date(c.t);
      return Object.assign({}, c, { label: pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) });
    });
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    var raw = simRaw, basePer = '1m', importRes = null, sourceKind = 'sim';
    var dataCache = {}, maCache = {};
    function rebuildCaches() {
      dataCache = {}; maCache = {};
      PERIODS.forEach(function (per) {
        if (PERIODS.indexOf(per) < PERIODS.indexOf(basePer)) dataCache[per] = [];
        else dataCache[per] = per === basePer ? raw : core.aggregate(raw, per);
      });
    }
    rebuildCaches();
    function importIsIntraday(candles) {
      return candles.some(function (c) {
        var d = new Date(c.t);
        return d.getHours() !== 0 || d.getMinutes() !== 0;
      });
    }
    function applySource(kind) {
      if (kind === 'import' && !importRes) return;
      sourceKind = kind;
      if (kind === 'import') {
        raw = importRes.candles.slice();
        basePer = importIsIntraday(raw) ? '1m' : 'D';
        st.period = basePer;
      } else {
        raw = simRaw; basePer = '1m'; st.period = 'D';
      }
      rebuildCaches();
      if (!dataCache[st.period] || !dataCache[st.period].length) st.period = basePer;
      periodCtl.set(st.period);
      srcCtl.set(kind);
      srcNote.innerHTML = kind === 'import'
        ? '使用<strong>导入数据</strong>（' + ui.fmt.int(importRes.candles.length) + ' 根，来源：' + (importRes.meta.sourceName || '本地文件') +
          '）。时区按本地解释；币种与复权状态未说明。切回模拟数据不会丢失导入内容。'
        : '当前使用<strong>模拟行情</strong>：固定随机种子，可重复。导入数据会标明来源，但不会与模拟数据混在一起。';
      render();
    }
    function withMA(per) {
      var arr = dataCache[per] || [];
      if (!maCache[per]) {
        var closes = arr.map(function (c) { return c.c; });
        maCache[per] = {
          5: core.ma(closes, 5), 10: core.ma(closes, 10),
          20: core.ma(closes, 20), 60: core.ma(closes, 60)
        };
      }
      var colors = { 5: p.orange, 10: p.cyan, 20: p.violet, 60: p.blue };
      return Object.keys(st.ma).filter(function (k) { return st.ma[k]; }).map(function (k) {
        return { name: 'MA' + k, values: maCache[per][k], color: colors[k], width: 1 };
      });
    }

    /* ================= B1 editor ================= */
    function candleEditor(host, state, onChange) {
      var W = 660, H = 400, L = 60, R = 500, T = 24, B = 356;
      var PMIN = 80, PMAX = 126;
      var upKey = 'h';
      host.innerHTML = '';
      var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': '可拖动的单根 K 线编辑图' });
      svg.setAttribute('class', 'ed-svg');
      host.appendChild(svg);
      var gGrid = svgEl('g'), gDyn = svgEl('g');
      svg.appendChild(gGrid); svg.appendChild(gDyn);

      function y(price) { return T + (PMAX - price) / (PMAX - PMIN) * (B - T); }
      function priceAt(py) { return PMAX - (py - T) / (B - T) * (PMAX - PMIN); }

      [80, 90, 100, 110, 120].forEach(function (price) {
        var yy = y(price);
        gGrid.appendChild(svgEl('line', { x1: L, x2: R, y1: yy, y2: yy, class: 'ed-gridline' }));
        var t = svgEl('text', { x: L - 10, y: yy + 3.5, class: 'ed-axis', 'text-anchor': 'end' });
        t.textContent = price.toFixed(0);
        gGrid.appendChild(t);
      });
      var cap = svgEl('text', { x: L, y: 15, class: 'ed-cap' });
      cap.textContent = '价格（元）';
      gGrid.appendChild(cap);

      function drag(e) {
        var key = e.target.getAttribute('data-key');
        if (!key) return;
        e.preventDefault();
        upKey = key;
        host.setPointerCapture && host.setPointerCapture(e.pointerId);
        svg.setPointerCapture && svg.setPointerCapture(e.pointerId);
        move(e);
      }
      function move(e) {
        if (!upKey) return;
        var pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        var loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        var price = Math.round(Math.min(PMAX, Math.max(PMIN, priceAt(loc.y))) * 2) / 2;
        var b = state.b1;
        if (upKey === 'h') b.h = Math.max(price, b.o, b.c);
        else if (upKey === 'l') b.l = Math.min(price, b.o, b.c);
        else if (upKey === 'o') b.o = Math.min(Math.max(price, b.l), b.h);
        else if (upKey === 'c') b.c = Math.min(Math.max(price, b.l), b.h);
        onChange();
      }
      function stop() { upKey = null; }
      svg.addEventListener('pointerdown', drag);
      svg.addEventListener('pointermove', function (e) { if (upKey) move(e); });
      svg.addEventListener('pointerup', stop);
      svg.addEventListener('pointercancel', stop);

      function draw() {
        while (gDyn.firstChild) gDyn.removeChild(gDyn.firstChild);
        var b = state.b1;
        var col = charts.colorsFor(state.market, charts.palette());
        var up = b.c >= b.o;
        var color = up ? col.up : col.down;
        var cx = 300, bw = 64;
        // body
        var top = y(Math.max(b.o, b.c)), bot = y(Math.min(b.o, b.c));
        gDyn.appendChild(svgEl('line', { x1: cx, x2: cx, y1: y(b.h), y2: y(b.l), stroke: color, 'stroke-width': 2 }));
        if (Math.abs(bot - top) < 1.2) {
          gDyn.appendChild(svgEl('line', { x1: cx - bw / 2, x2: cx + bw / 2, y1: top, y2: top, stroke: color, 'stroke-width': 3 }));
        } else if (state.fill === 'hollow') {
          gDyn.appendChild(svgEl('rect', { x: cx - bw / 2, y: top, width: bw, height: bot - top, fill: 'var(--panel)', stroke: color, 'stroke-width': 2 }));
        } else {
          gDyn.appendChild(svgEl('rect', { x: cx - bw / 2, y: top, width: bw, height: bot - top, fill: color, opacity: '.9' }));
        }
        // anatomy labels
        function label(txt, yy, cls) {
          var t = svgEl('text', { x: cx + bw / 2 + 12, y: yy + 4, class: 'ed-label ' + (cls || '') });
          t.textContent = txt;
          gDyn.appendChild(t);
        }
        if (y(b.h) < top - 6) label('上影线', (y(b.h) + top) / 2);
        if (bot < y(b.l) - 6) label('下影线', (bot + y(b.l)) / 2);
        if (bot - top > 14) label('实体', (top + bot) / 2);
        // handles + value chips (chips are nudged apart when prices are close)
        var rows = [['h', b.h, '最高 High'], ['o', b.o, '开盘 Open'], ['c', b.c, '收盘 Close'], ['l', b.l, '最低 Low']]
          .map(function (it) { return { key: it[0], price: it[1], name: it[2], hy: y(it[1]) }; })
          .sort(function (a, b2) { return a.hy - b2.hy; });
        var lastChip = -99;
        rows.forEach(function (row) {
          row.chipY = Math.max(row.hy, lastChip + 23);
          row.chipY = Math.min(row.chipY, H - 16);
          lastChip = row.chipY;
        });
        rows.forEach(function (row) {
          gDyn.appendChild(svgEl('line', { x1: cx + bw / 2, x2: 552, y1: row.hy, y2: row.hy, class: 'ed-leader' }));
          gDyn.appendChild(svgEl('line', { x1: 552, x2: 600, y1: row.hy, y2: row.chipY, class: 'ed-leader' }));
          var labelBg = svgEl('rect', { x: 602, y: row.chipY - 10, width: 56, height: 20, rx: 4, class: 'ed-chip' });
          gDyn.appendChild(labelBg);
          var t = svgEl('text', { x: 630, y: row.chipY + 4, class: 'ed-chip-text' });
          t.textContent = row.price.toFixed(1);
          gDyn.appendChild(t);
          var tt = svgEl('text', { x: 546, y: row.hy + 4, class: 'ed-handle-label' });
          tt.textContent = row.name;
          gDyn.appendChild(tt);
          var c = svgEl('circle', { cx: 566, cy: row.hy, r: 8, class: 'ed-handle', 'data-key': row.key, tabindex: '0' });
          c.setAttribute('fill', 'var(--panel-3)');
          c.setAttribute('stroke', color);
          c.setAttribute('stroke-width', '2');
          gDyn.appendChild(c);
        });
        // constraint status
        var ok = b.l <= Math.min(b.o, b.c) + 1e-9 && Math.max(b.o, b.c) <= b.h + 1e-9;
        var note = svgEl('text', { x: 60, y: 388, class: 'ed-status' });
        note.textContent = '约束：Low ' + b.l.toFixed(1) + ' ≤ min(O,C) ' + Math.min(b.o, b.c).toFixed(1) +
          ' ≤ max(O,C) ' + Math.max(b.o, b.c).toFixed(1) + ' ≤ High ' + b.h.toFixed(1) + (ok ? '  ✓' : '  ✗');
        gDyn.appendChild(note);
      }
      return { draw: draw, svg: svg };
    }

    /* ================= B2 ================= */
    function renderB2() {
      var c = B2_CASES[st.b2];
      var prev = st.prev;
      var today = { t: new Date(2026, 9, 30).getTime(), o: c.o, h: c.h, l: c.l, c: c.c, v: 0, label: '今日' };
      var yest = { t: new Date(2026, 9, 29).getTime(), o: prev - 0.4, h: prev + 0.6, l: prev - 1.2, c: prev, v: 0, label: '昨日' };
      b2Chart.setMarket(st.market);
      b2Chart.setFill(st.fill);
      b2Chart.setData({ candles: [yest, today], overlays: [], markers: [], visibleCount: 2, resetView: true });
      var isYang = c.c > c.o;
      var isDoji = Math.abs(c.c - c.o) < 0.05;
      var dayPct = core.changePct(prev, c.c);
      var gapPct = core.changePct(prev, c.o);
      var rangePct = (c.h - c.l) / prev * 100;
      var cls = isDoji ? 'flat' : (isYang ? 'up' : 'down');
      var dayCls = dayPct > 0 ? 'up' : dayPct < 0 ? 'down' : 'flat';
      b2Cards.innerHTML =
        '<div class="b2-card"><span>K 线方向（收盘 vs 开盘）</span><b class="' + cls + '">' + (isDoji ? '十字星' : isYang ? '阳线' : '阴线') + '</b>' +
        '<small>收盘 ' + c.c.toFixed(2) + ' ' + (isYang ? '>' : '<') + ' 开盘 ' + c.o.toFixed(2) + '</small></div>' +
        '<div class="b2-card"><span>当日涨跌幅（收盘 vs 昨收）</span><b class="' + dayCls + '">' + ui.fmt.pct(dayPct) + '</b>' +
        '<small>收盘 ' + c.c.toFixed(2) + ' ' + (dayPct >= 0 ? '>' : '<') + ' 昨收 ' + prev.toFixed(2) + '</small></div>' +
        '<div class="b2-card"><span>开盘缺口</span><b class="' + (gapPct > 0 ? 'up' : gapPct < 0 ? 'down' : 'flat') + '">' + ui.fmt.pct(gapPct) + '</b>' +
        '<small>开盘 ' + c.o.toFixed(2) + ' / 昨收 ' + prev.toFixed(2) + '</small></div>';
      metB2.set({
        candle: isDoji ? '十字星' : isYang ? '阳线' : '阴线',
        day: ui.fmt.pct(dayPct), gap: ui.fmt.pct(gapPct), range: rangePct.toFixed(2) + '%'
      }, { candle: cls, day: dayCls, gap: gapPct > 0 ? 'pos' : gapPct < 0 ? 'neg' : '' });
    }

    /* ================= B4 ================= */
    function patternData() {
      var v = st.vol, arr = [];
      var t0 = new Date(2026, 8, 1).getTime();
      function add(o, h, l, c, vol) {
        var mid = (o + c) / 2;
        h = mid + (h - mid) * v; l = mid + (l - mid) * v;
        h = Math.max(h, o, c) + 0.001; l = Math.min(l, o, c) - 0.001;
        arr.push({ t: t0 + arr.length * 864e5, o: r2(o), h: r2(h), l: r2(l), c: r2(c), v: vol, label: 'D' + (arr.length + 1) });
      }
      function r2(x) { return Math.round(x * 100) / 100; }
      var k = st.pattern;
      if (k === 'bigUp') add(100, 111, 99, 110, 2.4e8);
      else if (k === 'bigDown') add(110, 111, 99, 100, 2.8e8);
      else if (k === 'upperShadow') add(100, 110, 99, 101, 1.5e8);
      else if (k === 'lowerShadow') add(101, 102, 90, 100, 1.4e8);
      else if (k === 'doji') add(100, 107, 93, 100.1, 1.2e8);
      else if (k === 'gap') { add(98.5, 99.6, 97.8, 98.6, 1.1e8); add(104, 109, 103.4, 107.5, 2.6e8); }
      else if (k === 'streak') {
        var px = 100;
        for (var i = 0; i < 7; i++) { add(px, px + 2.4, px - 0.6, px + 2, 1.4e8 + i * 1e7); px += 2; }
      } else {
        var q = 100;
        for (var j = 0; j < 9; j++) { var d = j % 2 ? -1.6 : 1.8; add(q, q + 2.2, q - 2.2, q + d, 8e7 + (j % 3) * 3e7); q += d; }
      }
      return arr;
    }

    function pathSeries() {
      var O = 100, C = 104, H = 108, L = 95, N = 64;
      var rng = SM.datasets.mulberry32(1000 + st.pathSeed);
      var order = st.pathSeed % 3;
      var way = order === 0
        ? [[0, O], [10, H], [40, L], [N - 1, C]]
        : order === 1
          ? [[0, O], [14, L], [44, H], [N - 1, C]]
          : [[0, O], [8, H], [26, L], [48, H], [N - 1, C]];
      var pts = new Array(N);
      for (var s = 0; s < way.length - 1; s++) {
        var a = way[s], b = way[s + 1];
        for (var i = a[0]; i <= b[0]; i++) {
          var t = (i - a[0]) / Math.max(1, b[0] - a[0]);
          var v = a[1] + (b[1] - a[1]) * t;
          v += (rng() - 0.5) * Math.sin(Math.PI * t) * 2.4;
          pts[i] = Math.min(H - 0.05, Math.max(L + 0.05, v));
        }
      }
      pts[0] = O; pts[N - 1] = C;
      way.forEach(function (w) { pts[w[0]] = w[1]; });
      var labels = pts.map(function (_, i) { return i % 16 === 0 ? i + ' 分钟' : ''; });
      return {
        pts: pts,
        labels: labels,
        series: [
          { name: '实际路径', values: pts, color: p.cyan, width: 1.8, area: true },
          { name: '最高 ' + H, values: new Array(N).fill(H), color: p.red, width: 1, dash: [5, 4] },
          { name: '开盘 ' + O, values: new Array(N).fill(O), color: p.yellow, width: 1, dash: [2, 4] },
          { name: '收盘 ' + C, values: new Array(N).fill(C), color: p.blue, width: 1, dash: [2, 4] },
          { name: '最低 ' + L, values: new Array(N).fill(L), color: p.green, width: 1, dash: [5, 4] }
        ]
      };
    }

    /* ================= render ================= */
    function clampBars(key) {
      var b = st.b1;
      if (key === 'h') b.h = Math.max(b.h, b.o, b.c);
      if (key === 'l') b.l = Math.min(b.l, b.o, b.c);
      b.o = Math.min(Math.max(b.o, b.l), b.h);
      b.c = Math.min(Math.max(b.c, b.l), b.h);
      if (b.h - b.l < 1) b.h = b.l + 1;
    }

    function render() {
      var mode = st.mode;
      wrapB1.style.display = mode === 'b1' ? '' : 'none';
      wrapB2.style.display = mode === 'b2' ? '' : 'none';
      wrapB3.style.display = mode === 'b3' ? '' : 'none';
      wrapB4.style.display = mode === 'b4' ? '' : 'none';
      gB1.style.display = mode === 'b1' ? '' : 'none';
      gB2.style.display = mode === 'b2' ? '' : 'none';
      gB3.style.display = mode === 'b3' ? '' : 'none';
      gB4.style.display = mode === 'b4' ? '' : 'none';
      gDisplay.style.display = mode === 'b4' ? 'none' : '';
      [metB1, metB2, metB3, metB4].forEach(function (x, i) {
        x.el.style.display = ['b1', 'b2', 'b3', 'b4'][i] === mode ? '' : 'none';
      });
      modeCtl.set(mode);
      marketCtl.set(st.market); fillCtl.set(st.fill);
      ctlO.set(st.b1.o, true); ctlH.set(st.b1.h, true); ctlL.set(st.b1.l, true); ctlC.set(st.b1.c, true);
      prevCtl.set(st.prev, true); caseCtl.set(st.b2);
      periodCtl.set(st.period);
      patternCtl.set(st.pattern); volCtl.set(st.vol, true);

      if (mode === 'b1') {
        var b = st.b1;
        var an = core.candleAnatomy(b);
        editor.draw();
        metB1.set({
          type: an.type === 'yang' ? '阳线' : an.type === 'yin' ? '阴线' : '十字星',
          body: an.body.toFixed(2), upper: an.upper.toFixed(2), lower: an.lower.toFixed(2),
          range: ((b.h - b.l) / b.o * 100).toFixed(2) + '%',
          arrow: (b.c - b.o >= 0 ? '+' : '') + (b.c - b.o).toFixed(2)
        }, { type: an.type === 'yang' ? 'pos' : an.type === 'yin' ? 'neg' : '', arrow: b.c >= b.o ? 'pos' : 'neg' });
        b1Check.innerHTML = b.l <= Math.min(b.o, b.c) && Math.max(b.o, b.c) <= b.h
          ? '<span style="color:var(--cyan)">✓ 约束成立</span>：拖动最高价到实体下方会被拒绝，并停在 max(开盘, 收盘)。'
          : '<span style="color:var(--red)">✗ 约束被破坏</span>';
        formulaBox.innerHTML = '实体 = |收盘 − 开盘| = <b>' + an.body.toFixed(2) + '</b><br>上影线 = 最高 − max(开盘, 收盘) = <b>' + an.upper.toFixed(2) + '</b><br>下影线 = min(开盘, 收盘) − 最低 = <b>' + an.lower.toFixed(2) + '</b>';
      } else if (mode === 'b2') {
        renderB2();
        formulaBox.innerHTML = 'K 线方向：收盘 ' + B2_CASES[st.b2].c.toFixed(2) + ' vs 开盘 ' + B2_CASES[st.b2].o.toFixed(2) + '<br>当日涨跌幅：(收盘 − 昨收) / 昨收 = <b>' + ui.fmt.pct(core.changePct(st.prev, B2_CASES[st.b2].c)) + '</b>';
      } else if (mode === 'b3') {
        renderB3();
      } else {
        renderB4();
      }
    }

    function renderB3() {
      var per = st.period;
      var arr = dataCache[per] || [];
      if (!arr.length) {
        b3Info.innerHTML = '<span>当前周期没有可用数据：基础序列是日线，无法聚合出分钟周期。</span>';
        formulaBox.innerHTML = '导入数据只包含日线或更长周期时，1/5/15/30/60 分钟周期不可用。<br>请切换回「日 K」「周 K」或「月 K」。';
        b3Chart.setData({ candles: [], overlays: [], markers: [], visibleCount: 30, resetView: true });
        metB3.set({ period: core.PERIOD_LABEL[per], bars: 0, per: '—', vol: '—' }, {});
        return;
      }
      var overlays = withMA(per);
      b3Chart.setMarket(st.market);
      b3Chart.setFill(st.fill);
      var count = per === '1m' ? 120 : per === 'D' ? 90 : Math.min(90, arr.length);
      b3Chart.setData({ candles: arr, overlays: overlays, markers: [], visibleCount: count, resetView: true });
      var perRaw = basePer === '1m'
        ? (per === '1m' ? 1 : per === 'D' ? 240 : per === 'W' ? 1200 : per === 'M' ? 4800 : parseInt(per, 10))
        : (per === 'D' ? 1 : per === 'W' ? 5 : per === 'M' ? 20 : 0);
      metB3.set({
        period: core.PERIOD_LABEL[per],
        bars: arr.length,
        per: basePer === '1m' ? perRaw + ' 根 1m' : (perRaw ? perRaw + ' 个交易日' : '—'),
        vol: ui.fmt.compact(arr[arr.length - 1].v)
      }, {});
      var srcLabel = sourceKind === 'import' ? ('导入 · ' + (importRes.meta.sourceName || '本地文件')) : '模拟数据';
      b3Info.innerHTML = '<span>数据源：<b>' + srcLabel + '</b> · 基础序列 <b>' + ui.fmt.int(raw.length) + '</b> 根' +
        (basePer === '1m' ? ' 1 分钟 K 线' : '日线') + '（' + ui.fmt.date(raw[0].t) + ' → ' + ui.fmt.date(raw[raw.length - 1].t) + '）</span>' +
        '<span>当前：<b>' + core.PERIOD_LABEL[per] + '</b> · ' + arr.length + ' 根 · ' + (basePer === '1m' ? '每根约 ' + perRaw + ' 根 1m' : '每根约 ' + perRaw + ' 个交易日') + '</span>';
      formulaBox.innerHTML = '聚合规则：Open = 首根开盘，High = 区间最高，Low = 区间最低，<br>Close = 末根收盘，Volume = 区间成交量之和。<br>鼠标滚轮缩放、拖动平移、悬停查看 OHLC。';
    }

    function renderB4() {
      var arr = patternData();
      b4Chart.setMarket(st.market); b4Chart.setFill(st.fill);
      b4Chart.setData({ candles: arr, overlays: [], markers: [], visibleCount: Math.max(4, arr.length), resetView: true });
      var path = pathSeries();
      pathChart.setData({ series: path.series, labels: path.labels });
      pathLegend.innerHTML = '';
      ['实际路径', '最高', '开盘', '收盘', '最低'].forEach(function (name, i) {
        var s = path.series[i];
        var sp = ui.el('span', null, '<i style="background:' + s.color + '"></i>' + s.name);
        pathLegend.appendChild(sp);
      });
      var last = arr[arr.length - 1];
      var an = core.candleAnatomy(last);
      metB4.set({
        body: an.bodyPct.toFixed(1) + '%',
        upper: an.body ? (an.upper / an.body).toFixed(2) + '×' : '—',
        lower: an.body ? (an.lower / an.body).toFixed(2) + '×' : '—',
        path: '4 价相同'
      }, {});
      formulaBox.innerHTML = '路径检验：右侧 5 种颜色共享同一组 O/H/L/C，<br>但盘中顺序完全不同 → 单根 K 线无法还原路径。<br>影线放大 ' + st.vol.toFixed(1) + '× 只改变最高/最低，不改变实体。';
      updateInfo();
    }

    function updateInfo() {
      if (st.mode !== 'b3') return;
      var v = b3Chart.getVisible();
      b3Info.setAttribute('data-range', v.start + '-' + v.count);
    }

    /* ================= mode plumbing ================= */
    function syncUI(reset) {
      if (reset) {
        if (st.mode === 'b1') Object.assign(st.b1, B1_DEFAULT);
        if (st.mode === 'b2') st.prev = B2_CASES[st.b2].prev;
      }
      render();
    }

    function apply(patch) {
      if (!patch) return;
      Object.assign(st, patch);
      if (patch.b1) st.b1 = Object.assign({}, st.b1, patch.b1);
      if (patch.ma) st.ma = Object.assign({}, st.ma, patch.ma);
      render();
    }

    var onImport = function (res) {
      if (!res || !res.candles || !res.candles.length) return;
      importRes = res;
      srcNote.innerHTML = '已接收导入数据（' + ui.fmt.int(res.candles.length) + ' 根，来源：' + (res.meta.sourceName || '本地文件') +
        '）。当前仍显示' + (sourceKind === 'import' ? '导入数据' : '模拟数据') + '，可随时切换。';
      applySource('import');
    };
    SM.bus.on('sm:data', onImport);

    syncUI(false);

    return {
      apply: apply,
      destroy: function () {
        SM.bus.off('sm:data', onImport);
        editor.svg.remove();
        b2Chart.destroy(); b3Chart.destroy(); b4Chart.destroy(); pathChart.destroy();
      }
    };
  }

  SM.registerModule({
    id: 'B', slug: 'kline', order: 2,
    title: 'K 线图', en: 'CANDLESTICK',
    subtitle: '四价、颜色、周期聚合与形态的边界',
    hint: '拖动价格手柄，或切换周期与配色，观察同一组数据如何被不同方式讲述。',
    scenes: [
      {
        title: '一根 K 线只有四个价格', body: '拖动右侧四个手柄，改变开盘、最高、最低、收盘。<br>实体是开盘与收盘之间的距离；上影线是最高价到实体顶部的距离；下影线是最低价到实体底部的距离。',
        patch: { mode: 'b1', b1: { o: 100, h: 108, l: 98, c: 106 } },
        guide: '试着把“最高”拖到实体下方：它会被拒绝，并停在 max(开盘, 收盘)。', duration: 12000
      },
      {
        title: '十字星：开盘与收盘几乎相同', body: '当开盘价和收盘价非常接近，实体缩成一条线，就是<b>十字星</b>。<br>它只说明这个周期内多空没有分出明显胜负，不保证下一步方向。',
        patch: { mode: 'b1', b1: { o: 102, h: 107, l: 97, c: 102.1 } },
        guide: '观察实体长度与上下影线的比例。', duration: 10000
      },
      {
        title: '红色不一定代表上涨', body: 'A 股软件常见<b>红涨绿跌</b>，美股软件常见<b>绿涨红跌</b>。切换配色，OHLC 数字完全不变，只是视觉编码变了。<br>空心/实心同样只是填充约定，不表示成交量。',
        patch: { mode: 'b2', market: 'cn', b2: 'gapUp', prev: 100 },
        guide: '先看 A 股配色，再切到美股配色：阳线颜色会互换。', duration: 12000
      },
      {
        title: '阳线，却录得负涨跌幅', body: '今天低开到 97 元、收盘 99 元：<b>收盘 &gt; 开盘</b>，收出阳线；但昨收是 100 元，<b>当日涨跌幅为 −1%</b>。<br>两根 K 线分别回答两个不同的问题。',
        patch: { mode: 'b2', b2: 'gapUp', prev: 100 },
        guide: '看下方两张卡片：K 线方向与当日涨跌幅给出相反结论。', duration: 13000
      },
      {
        title: '日 K 如何变成周 K', body: '一根周 K 线汇总一周的交易日：<b>开盘取周一开盘，最高取全周最高，最低取全周最低，收盘取周五收盘，成交量求和</b>。<br>切换 1 分钟到月 K，所有周期都来自同一组基础数据。',
        patch: { mode: 'b3', period: 'D' },
        guide: '依次切换周期，注意 K 线根数如何减少、每根代表的时间如何变长。', duration: 14000
      },
      {
        title: '同一根 K 线，无数条路径', body: '右侧五种颜色共享同一组 O/H/L/C，却代表完全不同的盘中顺序：先冲高回落，或先砸盘再拉回。<br>K 线压缩了路径信息，这是它的效率，也是它的局限。',
        patch: { mode: 'b4', pattern: 'bigUp' },
        guide: '点“换一条盘中路径”，观察右侧曲线变化、左侧 K 线不动。', duration: 13000
      }
    ],
    quiz: [
      {
        q: '某日开盘 10 元，最高 11 元，最低 9.5 元，收盘 10.8 元。这根 K 线是？',
        options: ['阴线', '阳线', '十字星', '无法判断'],
        answer: 1,
        explain: '收盘 10.8 &gt; 开盘 10，所以是<b>阳线</b>（与昨收无关）。实体 0.8，上影线 0.2，下影线 0.5。'
      },
      {
        q: '低开 3%，收盘仍比开盘高 2%，但全天相对昨收下跌 1%。下列哪项正确？',
        options: ['收阳线，当日涨跌幅为负', '收阴线，当日涨跌幅为正', '收阳线，当日涨跌幅为正', 'K 线方向与涨跌幅必然一致'],
        answer: 0,
        explain: '收盘 &gt; 开盘 → <b>阳线</b>；收盘 &lt; 昨收 → <b>负涨跌幅</b>。两个指标的口径不同。'
      },
      {
        q: '一根日 K 线能否还原当天价格是先涨后跌还是先跌后涨？',
        options: ['能，看影线方向', '能，看实体颜色', '不能，四价丢失了盘中顺序', '只有十字星不能'],
        answer: 2,
        explain: 'OHLC 只保留四个价格极值与总量，<b>盘中路径不可恢复</b>；需要更细周期或逐笔数据。'
      }
    ],
    mount: mount
  });
})();
