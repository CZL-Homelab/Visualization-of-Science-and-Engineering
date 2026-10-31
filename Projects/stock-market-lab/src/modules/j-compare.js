/* Stock Market Lab — Module J: 同步对比实验室
 * Ten paired experiments. Each pair shares one set of initial conditions,
 * draws the two sides with the same data (or the same path) and isolates the
 * one mechanism that actually differs. Fixed-seed teaching models, no advice.
 */
(function () {
  'use strict';
  var SM = window.SM;
  var ui = SM.ui, core = SM.core, charts = SM.charts, sim = SM.sim, rules = SM.rules, datasets = SM.datasets;

  var DEFAULT = {
    pair: 0,
    visible: 40,
    days: 20,
    offerPrice: 22,
    offerQty: 1.2,
    firstDay: 30,
    profit: 12,
    shares: 10,
    peHigh: 50,
    peLow: 10,
    capitalW: 10,
    drop: 30,
    maint: 130,
    rate: 6,
    volMult: 2.5,
    payout: 5,
    price0: 5,
    profit0: 10,
    splitRatio: 2,
    issueQty: 2,
    issuePrice: 25,
    shock: -40
  };

  var PAIRS = [
    'A 股 vs 美股',
    '日 K vs 周 K',
    '红阳线 vs 绿线',
    'IPO vs 二级市场',
    '高估值 vs 低估值',
    '满仓 vs 满仓满融',
    '放量 vs 缩量上涨',
    '分红 vs 回购',
    '拆股 vs 增发',
    '单股 vs ETF'
  ];

  var CSS = [
    '.j-root{flex:1;display:flex;flex-direction:column;min-height:0;gap:8px}',
    '.j-bar{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:0 2px}',
    '.j-bar .n{font-family:var(--mono);font-size:10px;letter-spacing:.16em;color:var(--cyan)}',
    '.j-bar b{font-size:15px;letter-spacing:-.01em}',
    '.j-bar .tag{margin-left:auto}',
    '.j-body{flex:1;min-height:0;display:flex;flex-direction:column}',
    '.j-scene{display:none;flex:1;min-height:0;flex-direction:column;gap:8px}',
    '.j-scene.on{display:flex}',
    '.j-panes{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:1;min-height:0}',
    '.j-pane{display:flex;flex-direction:column;gap:6px;min-width:0;min-height:0;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 9px}',
    '.j-ph{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-height:18px;overflow:hidden}',
    '.j-ph b{font-size:12px;font-weight:600;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
    '.j-ph span{font-family:var(--mono);font-size:9.5px;color:var(--dim);letter-spacing:.08em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}',
    '.j-chart{flex:1;min-height:180px;width:auto}',
    '.j-facts{display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;min-height:64px;align-content:start}',
    '.j-facts.one{grid-template-columns:1fr}',
    '.j-fact{display:flex;justify-content:space-between;gap:6px;font-size:10.5px;color:var(--muted);border-bottom:1px dashed var(--line-soft);padding:2px 0;min-width:0}',
    '.j-fact span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:42%}',
    '.j-fact b{font-family:var(--mono);color:var(--text);font-weight:550;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:58%}',
    '.j-fact b.pos{color:var(--up)} .j-fact b.neg{color:var(--down)}',
    '.j-diff{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:7px 10px}',
    '.j-dc{min-width:0}',
    '.j-dc .k{font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--dim)}',
    '.j-dc .v{font-size:11px;line-height:1.5;color:var(--muted)}',
    '.j-dc .v b{color:var(--text);font-weight:560}',
    '.j-concl{display:flex;gap:8px;align-items:baseline;font-size:11px;line-height:1.55;color:var(--muted);background:var(--panel);border:1px solid var(--line-soft);border-left:2px solid var(--cyan);border-radius:7px;padding:6px 9px}',
    '.j-concl b{color:var(--cyan);font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;white-space:nowrap}',
    '.j-formula{font-family:var(--mono);font-size:10.5px;line-height:1.75;color:var(--muted)}',
    '.j-formula b{color:var(--text);font-weight:560}',
    '.j-read{display:grid;grid-template-columns:1fr 1fr;gap:5px 10px}',
    '.j-r{display:flex;flex-direction:column;gap:1px;min-width:0}',
    '.j-r span{font-size:9.5px;color:var(--dim)}',
    '.j-r b{font-family:var(--mono);font-size:12.5px;font-weight:560;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.j-r b.pos{color:var(--up)} .j-r b.neg{color:var(--down)}',
    '.j-note{font-size:10.5px;line-height:1.6;color:var(--dim)}',
    '@media (max-width:900px){',
    '  .j-root{height:auto}',
    '  .j-panes{grid-template-columns:1fr}',
    '  .j-chart{flex:none;height:250px;min-height:220px}',
    '  .j-diff{grid-template-columns:1fr}',
    '  .j-facts{grid-template-columns:1fr}',
    '}'
  ].join('\n');

  function ensureStyle() {
    if (document.getElementById('j-compare-style')) return;
    var s = document.createElement('style');
    s.id = 'j-compare-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function pct(v, d) { return ui.fmt.pct(v, d == null ? 1 : d); }
  function money(v) { return '¥' + ui.fmt.num(v, 0); }
  function yi(v, d) { return ui.fmt.num(v, d == null ? 2 : d) + ' 亿'; }
  function fact(k, v, tone) {
    return '<div class="j-fact"><span>' + k + '</span><b' + (tone ? ' class="' + tone + '"' : '') + '>' + v + '</b></div>';
  }
  function read(k, v, tone) {
    return '<div class="j-r"><span>' + k + '</span><b' + (tone ? ' class="' + tone + '"' : '') + '>' + v + '</b></div>';
  }
  function diff(k, v) {
    return '<div class="j-dc"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
  }
  function cloneCandle(c) {
    var x = {};
    Object.keys(c).forEach(function (k) { x[k] = c[k]; });
    return x;
  }
  function shortLabel(label) {
    var s = String(label || '');
    var m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return (+m[2]) + '/' + (+m[3]);
    m = s.match(/(\d{2})-(\d{2})/);
    if (m) return (+m[1]) + '/' + (+m[2]);
    return label;
  }
  function shortCandle(c) {
    var x = cloneCandle(c);
    x.label = shortLabel(x.label);
    return x;
  }

  function mount(ctx) {
    var st = {};
    Object.keys(DEFAULT).forEach(function (k) { st[k] = DEFAULT[k]; });
    st.pair = Math.max(0, Math.min(9, (typeof ctx.sceneIndex === 'function' && ctx.sceneIndex()) || 0));

    var stage = ctx.stage, panel = ctx.panel;
    ensureStyle();

    var root = ui.el('div', 'j-root');
    stage.appendChild(root);
    var bar = ui.el('div', 'j-bar');
    root.appendChild(bar);
    var body = ui.el('div', 'j-body');
    root.appendChild(body);

    var p = charts.palette();
    var ctrls = {};
    var groups = [];

    /* ------------------------------ panel ------------------------------ */
    var selGroup = ui.section(panel, '对比组', 'COMPARE PAIRS');
    var pairSelect = ui.select({
      label: '选择一对',
      options: PAIRS.map(function (t, i) { return { value: String(i), label: ('0' + (i + 1)).slice(-2) + ' · ' + t }; }),
      value: String(st.pair),
      onChange: function (v) {
        st.pair = Math.max(0, Math.min(9, Number(v) || 0));
        if (typeof ctx.goScene === 'function') ctx.goScene(st.pair);
        render(true);
      }
    });
    selGroup.appendChild(pairSelect.el);

    function addGroup(i, hint) {
      var g = ui.section(panel, '参数 · ' + PAIRS[i], 'CONTROLS');
      if (hint) {
        var n = ui.el('div', 'j-note');
        n.textContent = hint;
        g.appendChild(n);
      }
      groups[i] = g;
      return g;
    }
    function addSlider(i, key, o) {
      var s = ui.slider({
        value: st[key], min: o.min, max: o.max, step: o.step,
        label: o.label, unit: o.unit, hint: o.hint,
        onInput: function (v) { st[key] = v; render(false); }
      });
      ctrls[key] = s;
      groups[i].appendChild(s.el);
      return s;
    }

    addGroup(0, '两侧使用完全相同的 OHLC 数据，只改变市场配色与交易规则标注。');
    addSlider(0, 'visible', { min: 20, max: 80, step: 5, label: '回看 K 线数', unit: '根', hint: '拖动只改变显示窗口，不改变原始数据。' });

    addGroup(1, '同一段 1 分钟数据，分别按日、按周聚合。');
    addSlider(1, 'days', { min: 5, max: 30, step: 1, label: '1 分钟数据天数', unit: '天', hint: '每天 240 根 1 分钟 K 线；周 K 由这些分钟线聚合。' });

    addGroup(2, '同一组 OHLC，只交换红绿两色的含义。');
    addSlider(2, 'visible', { min: 15, max: 40, step: 5, label: '显示根数', unit: '根', hint: '最后一根被固定为收涨，方便观察颜色约定。' });

    addGroup(3, '一级市场募集资金进入公司；二级市场买卖只在投资者之间转手。');
    addSlider(3, 'offerPrice', { min: 10, max: 40, step: 1, label: '发行价', unit: '元', hint: 'IPO 发行价，不是上市首日收盘价。' });
    addSlider(3, 'offerQty', { min: 0.5, max: 3, step: 0.1, label: '新发行股数', unit: '亿股', hint: '发行后总股本 = 原 8 亿股 + 新发行股数。' });
    addSlider(3, 'firstDay', { min: -20, max: 80, step: 5, label: '首日涨跌幅', unit: '%', hint: '首日收盘价相对发行价的变化。' });

    addGroup(4, '两家公司净利润相同，只有市场愿意给的 PE 倍数不同。');
    addSlider(4, 'profit', { min: 5, max: 30, step: 1, label: '净利润', unit: '亿元', hint: '同一利润，用来分离估值倍数的效果。' });
    addSlider(4, 'shares', { min: 5, max: 20, step: 1, label: '总股本', unit: '亿股', hint: 'EPS = 净利润 ÷ 总股本。' });
    addSlider(4, 'peHigh', { min: 20, max: 80, step: 5, label: '高估值 PE', unit: '倍', hint: '高 PE 隐含更高的增长预期，不等于"更贵"。' });
    addSlider(4, 'peLow', { min: 5, max: 20, step: 1, label: '低估值 PE', unit: '倍', hint: '低 PE 也可能对应低增长或高风险。' });

    addGroup(5, '同一段下跌路径：满仓自有资金 vs 2 倍融资满仓。');
    addSlider(5, 'capitalW', { min: 5, max: 50, step: 5, label: '自有资金', unit: '万元', hint: '两边的初始自有资金相同。' });
    addSlider(5, 'drop', { min: 10, max: 50, step: 5, label: '区间跌幅', unit: '%', hint: '价格从 100 线性跌到 100 − 跌幅。' });
    addSlider(5, 'maint', { min: 110, max: 160, step: 5, label: '维持担保比例', unit: '%', hint: '权益 ÷ 负债低于该比例时触发强平。' });
    addSlider(5, 'rate', { min: 3, max: 10, step: 0.5, label: '融资年利率', unit: '%', hint: '利息会减少自有权益。' });

    addGroup(6, '价格路径完全相同，只把成交量放大或缩小。');
    addSlider(6, 'volMult', { min: 0.2, max: 3, step: 0.1, label: '右侧成交量倍数', unit: '×', hint: '价格不变，成交量是唯一被改变的变量。' });

    addGroup(7, '同样拿出 5 亿元：发现金，还是买回股份。');
    addSlider(7, 'payout', { min: 5, max: 10, step: 0.5, label: '分红 / 回购金额', unit: '亿元', hint: '两种方案使用相同的现金总额；金额低于股价时回购股数会取整为 0。' });
    addSlider(7, 'price0', { min: 2, max: 5, step: 1, label: '当前股价', unit: '元', hint: '回购按当前市价执行；5 亿元 ÷ 5 元 = 1 亿股。' });
    addSlider(7, 'profit0', { min: 5, max: 20, step: 1, label: '净利润', unit: '亿元', hint: '股本 10 亿股，用于计算 EPS 变化。' });

    addGroup(8, '拆股只改每股单位；增发会真正增加股本并带来新资金。');
    addSlider(8, 'splitRatio', { min: 2, max: 5, step: 1, label: '拆股比例', unit: '拆 1', hint: '例如 2 表示 1 股拆成 2 股。' });
    addSlider(8, 'issueQty', { min: 0.5, max: 5, step: 0.5, label: '增发新股', unit: '亿股', hint: '增发价以下方价格为准。' });
    addSlider(8, 'issuePrice', { min: 10, max: 40, step: 1, label: '增发价', unit: '元', hint: '增发价通常参考市价，可能折价。' });

    addGroup(9, '同一个冲击只打到一只持仓，看组合如何吸收。');
    addSlider(9, 'shock', { min: -60, max: 60, step: 5, label: '单只持仓冲击', unit: '%', hint: '只作用于一只成分股，其余持仓不变。' });

    var formulaGroup = ui.section(panel, '公式', 'FORMULA');
    var formulaHost = ui.el('div', 'j-formula');
    formulaGroup.appendChild(formulaHost);

    var readGroup = ui.section(panel, '读数', 'READOUT');
    var readHost = ui.el('div', 'j-read');
    readGroup.appendChild(readHost);

    var boundary = ui.section(panel, '简化假设 / 模型边界', 'DISCLOSURE');
    boundary.appendChild(ui.warn('本模块的 K 线、成交量和路径均为<b>固定种子的教学模拟</b>，用于对照机制，不是行情预测，也不构成投资建议。规则标注取自 <b>2026-10-31</b> 的本地规则库；真实交易还受税费、滑点、流动性与券商限制影响。'));
    boundary.appendChild(ui.button('恢复默认参数', function () {
      var keep = st.pair;
      Object.keys(DEFAULT).forEach(function (k) { st[k] = DEFAULT[k]; });
      st.pair = keep;
      render(true);
    }, 'ghost sm'));

    /* ------------------------------ stage ------------------------------ */
    var wrappers = [], refs = [];

    function makePane() {
      var el = ui.el('div', 'j-pane');
      var head = ui.el('div', 'j-ph');
      var chart = ui.el('div', 'chart j-chart');
      var facts = ui.el('div', 'j-facts');
      el.appendChild(head); el.appendChild(chart); el.appendChild(facts);
      return { el: el, head: head, chart: chart, facts: facts };
    }

    for (var i = 0; i < 10; i++) {
      var w = ui.el('div', 'j-scene');
      var panes = ui.el('div', 'j-panes');
      var left = makePane(), right = makePane();
      panes.appendChild(left.el); panes.appendChild(right.el);
      var diffRow = ui.el('div', 'j-diff');
      var concl = ui.el('div', 'j-concl');
      w.appendChild(panes); w.appendChild(diffRow); w.appendChild(concl);
      body.appendChild(w);
      wrappers.push(w);
      refs.push({ w: w, left: left, right: right, diff: diffRow, concl: concl });
    }
    refs[1].left.facts.className += ' one';
    refs[1].right.facts.className += ' one';

    /* ------------------------------ data ------------------------------ */
    var daily = datasets.makeDaily('volatile', 90);
    var trend = datasets.makeDaily('trend-up', 60);
    var intradayCache = { key: '', base: null };

    function shiftedCandles() {
      var c = daily.slice(0, 40).map(shortCandle);
      var prev = c[c.length - 2].c;
      var last = c[c.length - 1];
      last.o = +prev.toFixed(2);
      last.c = +(prev * 1.028).toFixed(2);
      last.h = +(last.c * 1.006).toFixed(2);
      last.l = +(last.o * 0.994).toFixed(2);
      return c;
    }

    /* ------------------------------ charts ------------------------------ */
    var jc = { left: null, right: null, pair: -1 };

    var KINDS = [
      ['kline', 'kline'], ['kline', 'kline'], ['kline', 'kline'], ['bars', 'bars'],
      ['bars', 'bars'], ['lines', 'lines'], ['kline', 'kline'], ['bars', 'bars'],
      ['bars', 'bars'], ['bars', 'donut']
    ];

    function destroyCharts() {
      ['left', 'right'].forEach(function (k) {
        if (jc[k]) {
          try { jc[k].destroy(); } catch (e) { /* idempotent */ }
          jc[k] = null;
        }
      });
      jc.pair = -1;
    }

    function ensureCharts(pair) {
      if (jc.pair === pair) return;
      destroyCharts();
      jc.pair = pair;
      var kindL = KINDS[pair][0], kindR = KINDS[pair][1];
      if (kindL === 'kline') {
        var marketL = (pair === 1 || pair === 2) ? 'cn' : (pair === 0 || pair === 2 ? 'cn' : 'cn');
        if (pair === 0 || pair === 2) marketL = 'cn';
        jc.left = charts.kline(refs[pair].left.chart, {
          candles: [], market: marketL, showVolume: pair !== 3, visibleCount: 60,
          volumeMA: [5, 10], label: '左侧 K 线'
        });
      } else if (kindL === 'bars') {
        jc.left = charts.bars(refs[pair].left.chart, { labels: [], values: [], label: '左侧柱状图' });
      } else if (kindL === 'lines') {
        jc.left = charts.lines(refs[pair].left.chart, { series: [], labels: [], zero: pair !== 5, label: '左侧权益曲线' });
      }
      if (kindR === 'kline') {
        var marketR = (pair === 0 || pair === 2) ? 'us' : 'cn';
        if (pair === 2) marketR = 'us';
        if (pair === 1) marketR = 'cn';
        jc.right = charts.kline(refs[pair].right.chart, {
          candles: [], market: marketR, showVolume: pair !== 3, visibleCount: 60,
          minCount: pair === 1 ? 4 : 12, volumeMA: [5, 10], label: '右侧 K 线'
        });
      } else if (kindR === 'bars') {
        jc.right = charts.bars(refs[pair].right.chart, { labels: [], values: [], label: '右侧柱状图' });
      } else if (kindR === 'lines') {
        jc.right = charts.lines(refs[pair].right.chart, { series: [], labels: [], zero: pair !== 5, label: '右侧权益曲线' });
      } else if (kindR === 'donut') {
        jc.right = charts.donut(refs[pair].right.chart, { segments: [], center: { value: '', label: '' }, label: 'ETF 权重' });
      }
    }

    /* ------------------------------ updaters ------------------------------ */
    var updaters = [];

    updaters[0] = function () {
      var c = daily.map(shortCandle), last = c[c.length - 1], prev = c[c.length - 2].c;
      var chg = core.changePct(prev, last.c);
      var lim = rules.limitPrices(prev, rules.cnLimitPct('main'));
      refs[0].left.head.innerHTML = '<b>A 股账户</b><span>红涨绿跌</span>';
      refs[0].right.head.innerHTML = '<b>美股账户</b><span>绿涨红跌</span>';
      var vis = Math.max(20, st.visible);
      jc.left.setData({ candles: c, visibleCount: vis, resetView: true });
      jc.right.setData({ candles: c, visibleCount: vis, resetView: true });
      refs[0].left.facts.innerHTML =
        fact('配色', '红 = 上涨') + fact('最新收盘', ui.fmt.price(last.c)) +
        fact('当日涨跌幅', pct(chg), chg >= 0 ? 'pos' : 'neg') + fact('涨停 / 跌停', ui.fmt.price(lim.upper) + ' / ' + ui.fmt.price(lim.lower)) +
        fact('回转限制', 'T+1 回转') + fact('涨跌幅', '主板 ±10%');
      refs[0].right.facts.innerHTML =
        fact('配色', '绿 = 上涨') + fact('最新收盘', ui.fmt.price(last.c)) +
        fact('当日涨跌幅', pct(chg), chg >= 0 ? 'pos' : 'neg') + fact('LULD 带宽', rules.usLuldBand(last.c, 'tier1').pct.toFixed(0) + '%') +
        fact('交收', 'T+1 交收') + fact('当日回转', '通常允许');
      refs[0].diff.innerHTML =
        diff('同一根 K 线', 'OHLC 完全一致：收盘 <b>' + ui.fmt.price(last.c) + '</b>，涨跌幅 <b>' + pct(chg) + '</b>') +
        diff('颜色约定', 'A 股红涨绿跌 ↔ 美股绿涨红跌；颜色不是买卖信号') +
        diff('规则差异', 'T+1 <b>回转</b> 限制当日卖出；T+1 <b>交收</b> 只决定钱券到账时间');
      refs[0].concl.innerHTML = '<b>结论</b>颜色只是约定，价格与涨跌幅不因市场而变；真正改变可执行性的是回转、涨跌幅和交收规则。';
      formulaHost.innerHTML = '<b>当日涨跌幅</b> = (收盘 − 前收) ÷ 前收<br><b>涨跌停价</b> = 前收 × (1 ± 限制比例)';
      readHost.innerHTML =
        read('样本根数', String(vis)) + read('最新价', ui.fmt.price(last.c)) +
        read('当日涨跌幅', pct(chg), chg >= 0 ? 'pos' : 'neg') + read('A 股涨跌停', '±10%') +
        read('A 股回转', 'T+1') + read('美股交收', 'T+1');
    };

    updaters[1] = function () {
      var key = 'd' + st.days;
      if (intradayCache.key !== key) {
        intradayCache.key = key;
        intradayCache.base = datasets.makeIntraday(20261030, st.days);
      }
      var base = intradayCache.base;
      var d = core.aggregate(base, 'D').map(shortCandle);
      var wk = core.aggregate(base, 'W').map(function (x) { var y = shortCandle(x); y.label = '周 ' + shortLabel(x.label); return y; });
      var dl = d[d.length - 1], wl = wk[wk.length - 1];
      refs[1].left.head.innerHTML = '<b>日 K</b><span>' + d.length + ' 根 · 由 1 分钟聚合</span>';
      refs[1].right.head.innerHTML = '<b>周 K</b><span>' + wk.length + ' 根 · 由同一批 1 分钟聚合</span>';
      jc.left.setData({ candles: d, visibleCount: Math.max(12, Math.min(30, d.length)), resetView: true });
      jc.right.setData({ candles: wk, visibleCount: Math.max(4, wk.length), resetView: true });
      refs[1].left.facts.innerHTML =
        fact('根数', d.length + ' 根') + fact('最后一根 O/H/L/C', [dl.o, dl.h, dl.l, dl.c].map(function (v) { return v.toFixed(2); }).join(' / ')) +
        fact('最后收盘', ui.fmt.price(dl.c)) + fact('最后一根来源', dl.count + ' 根分钟线');
      refs[1].right.facts.innerHTML =
        fact('根数', wk.length + ' 根') + fact('最后一根 O/H/L/C', [wl.o, wl.h, wl.l, wl.c].map(function (v) { return v.toFixed(2); }).join(' / ')) +
        fact('最后收盘', ui.fmt.price(wl.c)) + fact('最后一根来源', wl.count + ' 根分钟线');
      var same = Math.abs(dl.c - wl.c) < 1e-9;
      refs[1].diff.innerHTML =
        diff('聚合方向', '日 K：每天 240 根 → 1 根；周 K：每周 5 个交易日 → 1 根') +
        diff('末端价格', same ? '两者最后收盘 <b>完全一致</b> (' + ui.fmt.price(wl.c) + ')' : '存在差异，检查聚合边界') +
        diff('信息取舍', '周 K 更平滑、噪声更少；代价是更新更慢、滞后更明显');
      refs[1].concl.innerHTML = '<b>结论</b>同一批 1 分钟数据可以聚合成不同周期；末端收盘价对齐，但每根 K 线包含的时间跨度不同。';
      formulaHost.innerHTML = '<b>聚合</b>：开盘取首、收盘取末、最高取最大、最低取最小、成交量求和<br>周 K 的一根 = 该周全部交易日的聚合';
      readHost.innerHTML =
        read('1 分钟根数', String(base.length)) + read('日 K 根数', String(d.length)) +
        read('周 K 根数', String(wk.length)) + read('最后收盘（日）', ui.fmt.price(dl.c)) +
        read('最后收盘（周）', ui.fmt.price(wl.c)) + read('是否对齐', same ? '是' : '否', same ? 'pos' : 'neg');
    };

    updaters[2] = function () {
      var c = shiftedCandles();
      var last = c[c.length - 1], prev = c[c.length - 2].c;
      var chg = core.changePct(prev, last.c);
      var vis = Math.max(15, Math.min(40, st.visible));
      refs[2].left.head.innerHTML = '<b>A 股配色</b><span>红色 = 收盘高于开盘</span>';
      refs[2].right.head.innerHTML = '<b>美股配色</b><span>绿色 = 收盘高于开盘</span>';
      jc.left.setData({ candles: c, visibleCount: vis, resetView: true });
      jc.right.setData({ candles: c, visibleCount: vis, resetView: true });
      var yang = last.c > last.o;
      refs[2].left.facts.innerHTML =
        fact('最后一根', yang ? '阳线（C > O）' : '阴线（C < O）') + fact('颜色', '红色') +
        fact('当日涨跌幅', pct(chg), chg >= 0 ? 'pos' : 'neg') + fact('实体', (Math.abs(last.c - last.o) / last.o * 100).toFixed(2) + '%');
      refs[2].right.facts.innerHTML =
        fact('最后一根', yang ? '阳线（C > O）' : '阴线（C < O）') + fact('颜色', '绿色') +
        fact('当日涨跌幅', pct(chg), chg >= 0 ? 'pos' : 'neg') + fact('实体', (Math.abs(last.c - last.o) / last.o * 100).toFixed(2) + '%');
      refs[2].diff.innerHTML =
        diff('颜色', '红 ↔ 绿：同一根上涨 K 线在两地颜色相反') +
        diff('阴阳定义', '只看 <b>收盘 vs 开盘</b>，与颜色无关') +
        diff('当日涨跌幅', '<b>' + pct(chg) + '</b> 两边一致，还取决于前收');
      refs[2].concl.innerHTML = '<b>结论</b>颜色是显示约定，"阳线/阴线"由开盘与收盘决定；把颜色当成涨跌信号会误读同一根 K 线。';
      formulaHost.innerHTML = '<b>阳线</b>：收盘 &gt; 开盘；<b>阴线</b>：收盘 &lt; 开盘<br><b>当日涨跌幅</b> = (收盘 − 前收) ÷ 前收';
      readHost.innerHTML =
        read('最后一根方向', yang ? '阳线' : '阴线') + read('左边颜色', '红') +
        read('右边颜色', '绿') + read('当日涨跌幅', pct(chg), chg >= 0 ? 'pos' : 'neg') +
        read('前收', ui.fmt.price(prev)) + read('收盘', ui.fmt.price(last.c));
    };

    updaters[3] = function () {
      var proceeds = st.offerPrice * st.offerQty;
      var close = st.offerPrice * (1 + st.firstDay / 100);
      var preShares = 8, postShares = preShares + st.offerQty;
      var mcap = close * postShares;
      var tradeQty = 0.1, tradeAmt = close * tradeQty;
      refs[3].left.head.innerHTML = '<b>一级市场 · IPO</b><span>新股份 · 资金进入公司</span>';
      refs[3].right.head.innerHTML = '<b>二级市场 · 股东转手</b><span>已上市 · 股东之间</span>';
      jc.left.setData({
        labels: ['公司募资', '首日市值'],
        values: [proceeds, mcap], colors: [p.cyan, p.blue],
        yFormat: function (v) { return v.toFixed(1) + ' 亿'; }
      });
      jc.right.setData({
        labels: ['买方支出', '卖方收到', '公司收到'],
        values: [tradeAmt, tradeAmt, 0], colors: [p.orange, p.cyan, p.dim],
        yFormat: function (v) { return v.toFixed(2) + ' 亿'; }
      });
      refs[3].left.facts.innerHTML =
        fact('发行价', ui.fmt.price(st.offerPrice)) + fact('新发行', st.offerQty.toFixed(1) + ' 亿股') +
        fact('公司募资', yi(proceeds), 'pos') + fact('首日收盘', ui.fmt.price(close)) +
        fact('首日市值', yi(mcap)) + fact('募资 / 市值', (proceeds / mcap * 100).toFixed(1) + '%');
      refs[3].right.facts.innerHTML =
        fact('成交价', ui.fmt.price(close)) + fact('成交股数', tradeQty.toFixed(1) + ' 亿股') +
        fact('成交金额', yi(tradeAmt)) + fact('公司现金流入', '0', 'neg') +
        fact('股本变化', '不变') + fact('卖方', '原股东');
      refs[3].diff.innerHTML =
        diff('资金流向', 'IPO：买方 → <b>公司</b>；二级：买方 → <b>卖方</b>') +
        diff('公司是否收到钱', 'IPO <b>是</b>；二级市场 <b>否</b>') +
        diff('容易混淆', '募资额 ≠ 市值；首日成交额也 != 公司募资');
      refs[3].concl.innerHTML = '<b>结论</b>IPO 把新股份换成公司可用的现金；上市后的买卖只是股东之间的现金转手，公司不会因此再收到一次钱。';
      formulaHost.innerHTML = '<b>IPO 募资</b> = 发行价 × 新发行股数<br><b>市值</b> = 收盘价 × 发行后总股本';
      readHost.innerHTML =
        read('发行价', ui.fmt.price(st.offerPrice)) + read('公司募资', yi(proceeds), 'pos') +
        read('首日收盘', ui.fmt.price(close)) + read('首日市值', yi(mcap)) +
        read('首日涨幅', pct(st.firstDay)) + read('二级成交', yi(tradeAmt));
    };

    updaters[4] = function () {
      var eps = st.profit / st.shares;
      var pH = eps * st.peHigh, pL = eps * st.peLow;
      var capH = st.profit * st.peHigh, capL = st.profit * st.peLow;
      refs[4].left.head.innerHTML = '<b>高估值</b><span>PE ' + st.peHigh + '× · 同样利润</span>';
      refs[4].right.head.innerHTML = '<b>低估值</b><span>PE ' + st.peLow + '× · 同样利润</span>';
      jc.left.setData({
        labels: ['净利润', '市值'],
        values: [st.profit, capH], colors: [p.dim, p.orange],
        yFormat: function (v) { return v.toFixed(0) + ' 亿'; }
      });
      jc.right.setData({
        labels: ['净利润', '市值'],
        values: [st.profit, capL], colors: [p.dim, p.cyan],
        yFormat: function (v) { return v.toFixed(0) + ' 亿'; }
      });
      refs[4].left.facts.innerHTML =
        fact('EPS', '¥' + eps.toFixed(2)) + fact('PE', st.peHigh + '×') +
        fact('股价', ui.fmt.price(pH)) + fact('市值', yi(capH));
      refs[4].right.facts.innerHTML =
        fact('EPS', '¥' + eps.toFixed(2)) + fact('PE', st.peLow + '×') +
        fact('股价', ui.fmt.price(pL)) + fact('市值', yi(capL));
      refs[4].diff.innerHTML =
        diff('相同', '净利润 <b>' + yi(st.profit) + '</b>、EPS <b>¥' + eps.toFixed(2) + '</b>') +
        diff('不同', 'PE ' + st.peHigh + '× vs ' + st.peLow + '× → 市值相差 <b>' + (capH / capL).toFixed(1) + ' 倍</b>') +
        diff('怎样理解', 'PE 是价格相对盈利的倍数；高 PE 往往隐含更高增长预期，不等于"更贵"');
      refs[4].concl.innerHTML = '<b>结论</b>同样的利润，市场愿意给的倍数不同，价格就不同；判断贵贱还要看增长、风险与盈利质量，不能只看 PE 数字。';
      formulaHost.innerHTML = '<b>EPS</b> = 净利润 ÷ 总股本<br><b>股价</b> = EPS × PE；<b>市值</b> = 净利润 × PE';
      readHost.innerHTML =
        read('EPS', '¥' + eps.toFixed(2)) + read('高 PE 股价', ui.fmt.price(pH)) +
        read('低 PE 股价', ui.fmt.price(pL)) + read('高 PE 市值', yi(capH)) +
        read('低 PE 市值', yi(capL)) + read('市值倍数', (capH / capL).toFixed(1) + '×');
    };

    updaters[5] = function () {
      var n = 61, capital = st.capitalW * 10000;
      var prices = [];
      for (var k = 0; k < n; k++) prices.push(100 * (1 - st.drop / 100 * k / (n - 1)));
      var full = prices.map(function (x) { return capital * x / 100; });
      var m = sim.simulateMargin({ capital: capital, leverage: 2, prices: prices, rate: st.rate / 100, maintenance: st.maint / 100 });
      var labels = prices.map(function (x, k) { return 'D' + (k + 1); });
      var li = null;
      if (m.liquidation) li = m.liquidation.i;
      refs[5].left.head.innerHTML = '<b>满仓 · 无杠杆</b><span>自有资金 ' + st.capitalW + ' 万元</span>';
      refs[5].right.head.innerHTML = '<b>满仓满融 · 2×</b><span>担保 ' + st.maint + '%</span>';
      jc.left.setData({
        labels: labels,
        series: [{ name: '自有权益', values: full, color: p.cyan, width: 1.6, fmt: money }]
      });
      jc.right.setData({
        labels: labels,
        series: [{ name: '自有权益', values: m.series.map(function (x) { return x.equity; }), color: p.orange, width: 1.6, fmt: money }],
        markers: li != null ? [{ i: li, value: m.series[li].equity, color: p.red, text: '强平' }] : []
      });
      var fullEnd = full[n - 1];
      var fullRet = (fullEnd / capital - 1) * 100;
      var marginRet = (m.finalEquity / capital - 1) * 100;
      refs[5].left.facts.innerHTML =
        fact('期末权益', money(fullEnd)) + fact('区间收益', pct(fullRet), fullRet >= 0 ? 'pos' : 'neg') +
        fact('区间亏损', pct(-st.drop), 'neg') + fact('是否强平', '不会（无负债）');
      refs[5].right.facts.innerHTML =
        fact('期初自有', money(capital)) + fact('融资额', money(m.borrow)) +
        fact('期末权益', money(m.finalEquity), marginRet >= 0 ? 'pos' : 'neg') + fact('区间收益', pct(marginRet), marginRet >= 0 ? 'pos' : 'neg') +
        fact('强平价', m.series[0].liqPrice ? ui.fmt.price(m.series[0].liqPrice) : '—') + fact('是否强平', m.liquidation != null ? '是' : '否', m.liquidation != null ? 'neg' : 'pos');
      refs[5].diff.innerHTML =
        diff('亏损放大', '价格 −' + st.drop + '%：满仓 <b>' + pct(fullRet) + '</b>，2× 融资 <b>' + pct(marginRet) + '</b>') +
        diff('强平机制', '权益 ÷ 负债 < ' + st.maint + '% 时被强制卖出；反弹不再属于你') +
        diff('利息', '融资年利率 ' + st.rate + '%，持有期持续侵蚀权益');
      refs[5].concl.innerHTML = '<b>结论</b>杠杆同时放大盈利和亏损，并引入强平；下跌中"满仓满融"可能在公司基本面没变的情况下被迫离场。';
      formulaHost.innerHTML = '<b>权益</b> = 资产 − 负债<br><b>维持担保比例</b> = 资产 ÷ 负债；低于门槛触发强平';
      readHost.innerHTML =
        read('期末权益（满仓）', money(fullEnd)) + read('期末权益（融资）', money(m.finalEquity), marginRet >= 0 ? 'pos' : 'neg') +
        read('满仓收益', pct(fullRet), fullRet >= 0 ? 'pos' : 'neg') + read('融资收益', pct(marginRet), marginRet >= 0 ? 'pos' : 'neg') +
        read('强平价', m.series[0].liqPrice ? ui.fmt.price(m.series[0].liqPrice) : '—') + read('强平事件', m.liquidation != null ? '发生' : '未发生');
    };

    updaters[6] = function () {
      var base = trend.slice(0, 50).map(shortCandle);
      var left = base;
      var right = base.map(function (c) {
        var x = cloneCandle(c);
        x.v = Math.round(x.v * st.volMult);
        return x;
      });
      var first = base[0].c, last = base[base.length - 1].c;
      var chg = (last / first - 1) * 100;
      var volL = base.reduce(function (a, c) { return a + c.v; }, 0);
      var volR = right.reduce(function (a, c) { return a + c.v; }, 0);
      refs[6].left.head.innerHTML = '<b>基准成交量</b><span>价格路径完全相同</span>';
      refs[6].right.head.innerHTML = '<b>成交量 × ' + st.volMult.toFixed(1) + '</b><span>只改量，不改价</span>';
      jc.left.setData({ candles: left, visibleCount: 50, resetView: true });
      jc.right.setData({ candles: right, visibleCount: 50, resetView: true });
      refs[6].left.facts.innerHTML =
        fact('区间涨跌幅', pct(chg), chg >= 0 ? 'pos' : 'neg') + fact('最新价', ui.fmt.price(last)) +
        fact('成交量合计', ui.fmt.compact(volL)) + fact('价格路径', '与右侧逐根一致');
      refs[6].right.facts.innerHTML =
        fact('区间涨跌幅', pct(chg), chg >= 0 ? 'pos' : 'neg') + fact('最新价', ui.fmt.price(last)) +
        fact('成交量合计', ui.fmt.compact(volR)) + fact('量比', st.volMult.toFixed(1) + '×');
      refs[6].diff.innerHTML =
        diff('价格方向', '两边 <b>' + pct(chg) + '</b> 完全相同；成交量不改变收盘价') +
        diff('成交量', '右侧 = 左侧 × ' + st.volMult.toFixed(1) + '，只描述参与度') +
        diff('不要混淆', '<b>成交量</b>是成交股数；<b>净买入</b>需要区分主动买与主动卖');
      refs[6].concl.innerHTML = '<b>结论</b>放量或缩量都不决定价格方向；成交量说明"有多少人参与"，不能单独证明资金净流入或未来涨跌。';
      formulaHost.innerHTML = '<b>成交量</b> = 当日成交股数（或金额）<br><b>净买入</b> = 主动买入 − 主动卖出，需逐笔方向数据';
      readHost.innerHTML =
        read('区间涨跌幅', pct(chg), chg >= 0 ? 'pos' : 'neg') + read('最新价', ui.fmt.price(last)) +
        read('左成交量', ui.fmt.compact(volL)) + read('右成交量', ui.fmt.compact(volR)) +
        read('量比', st.volMult.toFixed(1) + '×') + read('价格是否相同', '是', 'pos');
    };

    updaters[7] = function () {
      var shares = 10, dps = st.payout / shares;
      var dv = core.dividend({ shares: shares, dps: dps, price: st.price0 });
      var bb = core.buyback({ shares: shares, cash: st.payout, price: st.price0, profit: st.profit0 });
      var eps0 = st.profit0 / shares;
      var epsD = st.profit0 / shares;
      var epsB = st.profit0 / bb.postShares;
      var postBB = (shares * st.price0 - st.payout) / bb.postShares;
      refs[7].left.head.innerHTML = '<b>现金分红</b><span>' + st.payout.toFixed(1) + ' 亿元发给全体股东</span>';
      refs[7].right.head.innerHTML = '<b>股份回购</b><span>同样 ' + st.payout.toFixed(1) + ' 亿元买回股份</span>';
      var pctChg = function (x) { return (x - 1) * 100; };
      jc.left.setData({
        labels: ['股本', '股价', 'EPS', '市值'],
        values: [0, pctChg(dv.exPrice / st.price0), 0, pctChg(dv.exPrice / st.price0)],
        colors: [p.dim, p.cyan, p.blue, p.violet],
        yFormat: function (v) { return (v > 0 ? '+' : '') + v.toFixed(1) + '%'; }
      });
      jc.right.setData({
        labels: ['股本', '股价', 'EPS', '市值'],
        values: [pctChg(bb.postShares / shares), pctChg(postBB / st.price0), pctChg(epsB / eps0), pctChg(bb.postShares * postBB / (shares * st.price0))],
        colors: [p.dim, p.orange, p.yellow, p.violet],
        yFormat: function (v) { return (v > 0 ? '+' : '') + v.toFixed(1) + '%'; }
      });
      refs[7].left.facts.innerHTML =
        fact('每股分红', '¥' + dps.toFixed(2)) + fact('股息率', pct(dv.yieldPct, 2)) +
        fact('除息价', ui.fmt.price(dv.exPrice)) + fact('股本', '10.0 亿股（不变）') +
        fact('每股财富', '¥' + (dv.exPrice + dps).toFixed(2)) + fact('股东拿到现金', yi(dv.cash)) +
        fact('公司现金流出', yi(st.payout));
      refs[7].right.facts.innerHTML =
        fact('回购价', ui.fmt.price(st.price0)) + fact('回购股数', bb.repurchased.toFixed(2) + ' 亿股') +
        fact('剩余股本', bb.postShares.toFixed(2) + ' 亿股') + fact('EPS', '¥' + epsB.toFixed(2) + '（原 ¥' + eps0.toFixed(2) + '）') +
        fact('每股财富', '¥' + postBB.toFixed(2)) + fact('EPS 变化', pct((epsB / eps0 - 1) * 100), 'pos') +
        fact('公司现金流出', yi(bb.spent));
      refs[7].diff.innerHTML =
        diff('现金去向', '分红：<b>全体股东</b>；回购：<b>卖出股份的股东</b>') +
        diff('股本', '分红不变；回购减少 <b>' + (shares - bb.postShares).toFixed(2) + ' 亿股</b>') +
        diff('每股指标', '分红不改变 EPS；回购后 EPS 升至 <b>¥' + epsB.toFixed(2) + '</b>');
      refs[7].concl.innerHTML = '<b>结论</b>税前每股财富都约 ¥' + (dv.exPrice + dps).toFixed(2) + '，变化的是组成：分红给现金，回购把现金变成更高的每股权益；卖出股份的股东才拿到现金。';
      formulaHost.innerHTML = '<b>除息价</b> = 前收 − 每股分红<br><b>回购后 EPS</b> = 净利润 ÷ 剩余股本；回购价与市值决定回购股数';
      readHost.innerHTML =
        read('每股分红', '¥' + dps.toFixed(2)) + read('除息价', ui.fmt.price(dv.exPrice)) +
        read('回购股数', bb.repurchased.toFixed(2) + ' 亿股') + read('剩余股本', bb.postShares.toFixed(2) + ' 亿股') +
        read('EPS（分红）', '¥' + epsD.toFixed(2)) + read('EPS（回购）', '¥' + epsB.toFixed(2), 'pos');
    };

    updaters[8] = function () {
      var shares = 10, price = 30, profit = 15;
      var sp = core.split({ shares: shares, price: price, ratio: st.splitRatio, profit: profit });
      var is = core.issuance({ preShares: shares, newShares: st.issueQty, price: st.issuePrice, prePrice: price, profit: profit });
      refs[8].left.head.innerHTML = '<b>拆股</b><span>' + st.splitRatio + ' 拆 1 · 不改变市值</span>';
      refs[8].right.head.innerHTML = '<b>增发</b><span>新发行 ' + st.issueQty.toFixed(1) + ' 亿股 · 公司拿钱</span>';
      var pctChg = function (x) { return (x - 1) * 100; };
      jc.left.setData({
        labels: ['股本', '股价', '市值', 'EPS'],
        values: [pctChg(sp.shares / shares), pctChg(sp.price / price), pctChg(sp.marketValueAfter / (shares * price)), pctChg(sp.epsAfter / (profit / shares))],
        colors: [p.dim, p.cyan, p.blue, p.violet],
        yFormat: function (v) { return (v > 0 ? '+' : '') + v.toFixed(1) + '%'; }
      });
      jc.right.setData({
        labels: ['股本', '股价', '市值', 'EPS'],
        values: [pctChg(is.postShares / shares), pctChg(is.postPrice / price), pctChg(is.postValue / (shares * price)), pctChg(is.epsAfter / (profit / shares))],
        colors: [p.dim, p.orange, p.blue, p.yellow],
        yFormat: function (v) { return (v > 0 ? '+' : '') + v.toFixed(1) + '%'; }
      });
      refs[8].left.facts.innerHTML =
        fact('拆股比例', st.splitRatio + ' : 1') + fact('股价', ui.fmt.price(price) + ' → ' + ui.fmt.price(sp.price)) +
        fact('股本', '10.0 → ' + sp.shares.toFixed(1) + ' 亿股') + fact('市值', yi(sp.marketValueAfter) + '（不变）') +
        fact('EPS', '¥' + (profit / shares).toFixed(2) + ' → ¥' + sp.epsAfter.toFixed(2)) + fact('持股比例', '不变');
      refs[8].right.facts.innerHTML =
        fact('增发价', ui.fmt.price(st.issuePrice)) + fact('发行股数', st.issueQty.toFixed(1) + ' 亿股') +
        fact('募资', yi(is.proceeds)) + fact('新股本', is.postShares.toFixed(1) + ' 亿股') +
        fact('摊薄', pct(is.dilutionPct)) + fact('增发后股价', ui.fmt.price(is.postPrice));
      refs[8].diff.innerHTML =
        diff('股本', '拆股按比例增加；增发真实新增股份') +
        diff('公司现金', '拆股 <b>0</b>；增发募资 <b>' + yi(is.proceeds) + '</b>') +
        diff('老股东', '拆股持股比例不变；增发被稀释 <b>' + pct(is.dilutionPct) + '</b>');
      refs[8].concl.innerHTML = '<b>结论</b>拆股只是把同一块蛋糕切得更细，市值和持股比例不变；增发会真正扩大股本并把新资金交给公司，同时稀释老股东。';
      formulaHost.innerHTML = '<b>拆股</b>：股价 ÷ 比例，股本 × 比例，市值不变<br><b>增发后股价</b> = (原市值 + 募资) ÷ 增发后股本';
      readHost.innerHTML =
        read('拆股后股价', ui.fmt.price(sp.price)) + read('拆股后股本', sp.shares.toFixed(1) + ' 亿股') +
        read('增发募资', yi(is.proceeds), 'pos') + read('增发后股本', is.postShares.toFixed(1) + ' 亿股') +
        read('摊薄比例', pct(is.dilutionPct), 'neg') + read('增发后股价', ui.fmt.price(is.postPrice));
    };

    updaters[9] = function () {
      var singleRet = st.shock;
      var etfRet = st.shock * 0.2;
      refs[9].left.head.innerHTML = '<b>单股 · 100%</b><span>一只持仓承受全部冲击</span>';
      refs[9].right.head.innerHTML = '<b>ETF · 5 只等权</b><span>冲击只落在 1 只持仓</span>';
      jc.left.setData({
        labels: ['组合收益'],
        values: [singleRet],
        colors: [singleRet >= 0 ? p.cyan : p.red],
        yFormat: function (v) { return v.toFixed(0) + '%'; }
      });
      jc.right.setData({
        segments: [
          { label: '受冲击持仓', value: 20, color: p.red, display: '20%' },
          { label: '其余 4 只', value: 80, color: p.cyan, display: '80%' }
        ],
        center: { value: pct(etfRet), label: '组合收益' }
      });
      refs[9].left.facts.innerHTML =
        fact('持仓数', '1 只') + fact('集中度', '100%') +
        fact('单只冲击', pct(singleRet), singleRet >= 0 ? 'pos' : 'neg') + fact('组合收益', pct(singleRet), singleRet >= 0 ? 'pos' : 'neg');
      refs[9].right.facts.innerHTML =
        fact('持仓数', '5 只等权') + fact('单只权重', '20%') +
        fact('单只冲击', pct(singleRet), singleRet >= 0 ? 'pos' : 'neg') + fact('组合收益', pct(etfRet), etfRet >= 0 ? 'pos' : 'neg');
      refs[9].diff.innerHTML =
        diff('集中度', '单股 <b>100%</b> vs ETF 单只 <b>20%</b>') +
        diff('组合冲击', '<b>' + pct(singleRet) + '</b> vs <b>' + pct(etfRet) + '</b>，约被摊薄到 1/5') +
        diff('代价', '分散降低单股冲击，也会稀释单只暴涨的贡献');
      refs[9].concl.innerHTML = '<b>结论</b>同样一只持仓出事，单股账户承受全部损失；ETF 按权重摊薄冲击。分散不是提高收益，而是改变结果的分布。';
      formulaHost.innerHTML = '<b>组合收益</b> = Σ(权重 × 各持仓收益)<br>等权 5 只时，单只 20% 权重 → 冲击 × 0.2';
      readHost.innerHTML =
        read('单只冲击', pct(singleRet), singleRet >= 0 ? 'pos' : 'neg') + read('ETF 组合收益', pct(etfRet), etfRet >= 0 ? 'pos' : 'neg') +
        read('单股集中度', '100%') + read('ETF 单只权重', '20%') +
        read('组合持仓数', '1 vs 5') + read('冲击摊薄', '约 1/5');
    };

    /* ------------------------------ render ------------------------------ */
    function render(sync) {
      var pair = Math.max(0, Math.min(9, st.pair));
      wrappers.forEach(function (w, k) { w.classList.toggle('on', k === pair); });
      groups.forEach(function (g, k) { g.style.display = k === pair ? '' : 'none'; });
      bar.innerHTML = '<span class="n">PAIR ' + ('0' + (pair + 1)).slice(-2) + ' / 10</span><b>' + PAIRS[pair] +
        '</b><span class="tag">同步初始条件 · 只改一个变量</span>';
      ensureCharts(pair);
      updaters[pair]();
      ['left', 'right'].forEach(function (k) {
        if (jc[k] && jc[k].resize) jc[k].resize();
      });
      if (pairSelect.get() !== String(pair)) pairSelect.set(String(pair));
      if (sync) {
        Object.keys(ctrls).forEach(function (k) { ctrls[k].set(st[k], true); });
      }
    }

    var inst = {
      apply: function (patch) {
        if (patch) {
          Object.keys(patch).forEach(function (k) {
            if (!Object.prototype.hasOwnProperty.call(DEFAULT, k)) return;
            var v = Number(patch[k]);
            if (!isFinite(v)) return;
            st[k] = v;
          });
        }
        render(true);
      },
      destroy: function () {
        destroyCharts();
        root.remove();
      }
    };

    render(true);
    return inst;
  }

  SM.registerModule({
    id: 'J',
    slug: 'compare',
    order: 10,
    title: '同步对比实验室',
    en: 'COMPARE',
    subtitle: '固定初始条件，只改一个变量：十组并排对照，看清机制而不是记结论。',
    hint: '先从右上角选择对比组；两侧共享初始条件，差异行会指出到底哪一项变了。',
    scenes: [
      { title: 'A 股 vs 美股', body: '同一组 OHLC 数据，左边按 A 股红涨绿跌、右边按美股绿涨红跌显示。<br>颜色之外，真正不同的是 <b>T+1 回转</b> 与 <b>T+1 交收</b>、以及涨跌幅限制，而不是价格本身。', patch: { pair: 0 }, guide: '看两侧最后一根 K 线的收盘价与涨跌幅是否一致。', duration: 15000 },
      { title: '日 K vs 周 K', body: '把同一批 1 分钟数据分别聚合成日 K 与周 K。<br>末端收盘价对齐，但周 K 每根包含 5 个交易日、噪声更少，也更滞后。', patch: { pair: 1 }, guide: '对比两侧的根数与最后一根 O/H/L/C。', duration: 15000 },
      { title: '红阳线 vs 绿线', body: '同一根上涨 K 线：A 股画成红色，美股画成绿色。<br>阴阳由 <b>收盘 vs 开盘</b> 决定，当日涨跌幅由 <b>收盘 vs 前收</b> 决定，都与颜色无关。', patch: { pair: 2 }, guide: '检查两侧“最后一根”与“当日涨跌幅”是否相同。', duration: 15000 },
      { title: 'IPO vs 二级市场', body: 'IPO 把新股份卖给投资者，募资进入<b>公司账户</b>；上市后的买卖只是股东之间的现金转手。<br>募资额、首日市值和首日成交额是三个不同的数字。', patch: { pair: 3 }, guide: '对比“公司募资”和“公司现金流入 0”。', duration: 15000 },
      { title: '高估值 vs 低估值', body: '两家公司净利润、股本完全相同，只有 PE 不同：50 倍 vs 10 倍。<br>同样的利润，市场给的倍数不同，市值就差 5 倍；PE 不是判断贵贱的唯一标准。', patch: { pair: 4 }, guide: '比较两侧 EPS 与市值，再想 PE 隐含了什么假设。', duration: 15000 },
      { title: '满仓 vs 满仓满融', body: '同一段价格下跌，左边只用自有资金，右边 2 倍融资满仓。<br>杠杆放大亏损，并在维持担保比例不足时触发<b>强制平仓</b>，之后的反弹与你无关。', patch: { pair: 5 }, guide: '把跌幅拉到 40% 以上，看右侧是否出现强平标记。', duration: 16000 },
      { title: '放量 vs 缩量上涨', body: '价格路径逐根相同，只把右侧成交量放大 2.5 倍。<br>涨跌幅完全一致：成交量描述参与度，不等于净买入，也不能单独预测方向。', patch: { pair: 6 }, guide: '对比两侧区间涨跌幅与成交量合计。', duration: 15000 },
      { title: '分红 vs 回购', body: '同样拿出 5 亿元：分红把现金发给全体股东，股本不变；回购从市场买回股份，股本减少、EPS 抬升。<br>两种方式都减少公司现金，但股东结构和每股指标不同。', patch: { pair: 7 }, guide: '看“股本 / 股价 / EPS / 市值”四根柱的变化。', duration: 16000 },
      { title: '拆股 vs 增发', body: '拆股把 1 股切成多股，股价同比例下降，市值与持股比例不变；增发真实新增股份，公司拿到募资，老股东被稀释。<br>两者都会让股本变大，但经济含义完全不同。', patch: { pair: 8 }, guide: '对比“公司现金”和“老股东”两行。', duration: 16000 },
      { title: '单股 vs ETF', body: '同一个冲击只打到一只持仓：单股账户 100% 承受，5 只等权的 ETF 只承受约 1/5。<br>分散降低单只冲击，也会稀释单只暴涨的贡献。', patch: { pair: 9 }, guide: '拖动冲击幅度，比较两侧组合收益。', duration: 15000 }
    ],
    quiz: [
      {
        q: 'A 股“T+1 回转”与美股“T+1 交收”的主要区别是？',
        options: ['两者都禁止当日卖出', 'A 股当日买入次日才能卖；美股 T+1 指交收，通常不影响当日回转', '美股当日买入必须隔日才能卖', '两者只影响手续费'],
        answer: 1,
        explain: 'A 股的 T+1 是<b>回转限制</b>：当日买入的股票次日才能卖出。美股的 T+1 是<b>交收周期</b>：钱券在成交后一个工作日完成交割，通常不妨碍当日回转交易。'
      },
      {
        q: '拆股与增发都会增加股本。下列哪项正确？',
        options: ['两者都会给公司带来新资金', '拆股不改变市值和持股比例；增发募集资金并稀释老股东', '拆股会稀释老股东，增发不会', '两者都会降低公司市值'],
        answer: 1,
        explain: '拆股只是把每股拆细：股价同比例下降、股本同比例上升，<b>市值和持股比例不变</b>。增发是真实发行新股，公司收到募资，老股东持股比例被<b>稀释</b>。'
      },
      {
        q: '“放量上涨”最能说明什么？',
        options: ['未来一定继续上涨', '有资金净买入', '参与度提高，但方向与净买入仍需其他数据判断', '主力已经出货'],
        answer: 2,
        explain: '成交量只说明成交了多少股，<b>不等于净买入</b>，更不能保证未来方向。判断资金流向需要区分主动买与主动卖，或使用逐笔、委托队列等数据。'
      }
    ],
    mount: mount
  });
})();
