/* Stock Market Lab — Module I: ETF 与长期投资
 * Six scenes: index construction, stock vs ETF, diversification, fees and
 * dividends, monthly investing, and currency exposure. Every number is a
 * fixed-seed teaching model, never a forecast.
 */
(function () {
  'use strict';
  var SM = window.SM;
  var ui = SM.ui, core = SM.core, charts = SM.charts, sim = SM.sim;

  var START = 100000;
  var MC_SEED = 20261101;

  var DEFAULT = {
    priceB: 40,
    mktPrice: 2.56,
    rho: 0.55,
    basket: 12,
    feeSingle: 1.2,
    feeEtf: 0.25,
    divYield: 2.4,
    growth: 6,
    monthly: 1000,
    rate: 6,
    years: 20,
    usdReturn: 8,
    fx: -2
  };

  var SHORT = ['指数', '个股 vs ETF', '分散', '费用分红', '定投', '汇率'];

  var CSS = [
    '.i-root{flex:1;display:flex;flex-direction:column;min-height:0;gap:8px}',
    '.i-scene{display:none;flex:1;min-height:0;gap:8px}',
    '.i-scene.on{display:flex;flex-direction:column}',
    '.i-two{display:grid;grid-template-columns:1.08fr .92fr;gap:8px;flex:1;min-height:0}',
    '.i-two.even{grid-template-columns:1fr 1fr}',
    '.i-rows{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0}',
    '.i-rows>.i-chart{flex:1;min-height:0}',
    '.i-bottom{display:grid;grid-template-columns:1fr;gap:6px;min-width:0}',
    '.i-bottom>*{min-width:0}',
    '.i-calc{margin-top:-1px}',
    '.i-calc .row b{font-size:12px}',
    '.i-col{display:flex;flex-direction:column;gap:8px;min-width:0;min-height:0}',
    '.i-chart{flex:1;min-height:200px;width:auto;position:relative}',
    '.i-axis-tag{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;pointer-events:none;white-space:nowrap;font:10px/1.3 var(--sans);color:var(--muted);background:rgba(10,14,20,.55);border:1px solid var(--line-soft);border-radius:999px;padding:2px 8px}',
    '.i-prem{height:112px;flex:none;min-height:112px}',
    '.i-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;color:var(--dim)}',
    '.i-head b{color:var(--muted);font-weight:500;letter-spacing:.04em}',
    '.i-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}',
    '.i-card{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:8px 9px;display:flex;flex-direction:column;gap:3px;min-width:0}',
    '.i-card.act{border-color:color-mix(in srgb,var(--cyan) 55%,var(--line))}',
    '.i-card .n{display:flex;justify-content:space-between;gap:6px;font-size:10px;color:var(--dim)}',
    '.i-card .p{font-family:var(--mono);font-size:19px;font-weight:600;letter-spacing:-.02em}',
    '.i-card .m{font-size:10px;color:var(--muted);font-family:var(--mono)}',
    '.i-card .bar{height:4px;background:var(--panel-3);border-radius:2px;overflow:hidden;margin-top:2px}',
    '.i-card .bar i{display:block;height:100%;background:var(--cyan)}',
    '.i-box{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:9px 10px;display:flex;flex-direction:column;gap:5px;min-width:0}',
    '.i-box .k{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;color:var(--dim)}',
    '.i-box .big{font-family:var(--mono);font-size:22px;font-weight:600;letter-spacing:-.02em}',
    '.i-box .row{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--muted)}',
    '.i-box .row b{font-family:var(--mono);color:var(--text);font-weight:550}',
    '.i-note{font-size:10.5px;line-height:1.6;color:var(--dim)}',
    '.i-note b{color:var(--muted)}',
    '.i-foot{min-height:34px;font-size:10.5px;line-height:1.6;color:var(--muted);background:var(--panel);border:1px solid var(--line-soft);border-radius:8px;padding:6px 9px}',
    '.i-foot b{color:var(--text);font-family:var(--mono);font-weight:560}',
    '.i-legend{margin-top:-2px}',
    '.i-table{min-height:0}',
    '@media (max-width:900px){',
    '  .i-root{height:auto}',
    '  .i-scene.on{display:flex}',
    '  .i-two,.i-two.even{grid-template-columns:1fr}',
    '  .i-chart{flex:none;height:240px;min-height:210px}',
    '  .i-cards{grid-template-columns:1fr}',
    '}'
  ].join('\n');

  function ensureStyle() {
    if (document.getElementById('i-etf-style')) return;
    var s = document.createElement('style');
    s.id = 'i-etf-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function pct(v, d) { return ui.fmt.pct(v, d == null ? 1 : d); }
  function money(v) { return '¥' + ui.fmt.num(v, 0); }
  function signedMoney(v) { return v < 0 ? '−' + money(-v) : money(v); }
  function yi(v) { return (v / 1e8).toFixed(2) + ' 亿'; }

  function mount(ctx) {
    var st = {};
    Object.keys(DEFAULT).forEach(function (k) { st[k] = DEFAULT[k]; });

    var stage = ctx.stage, panel = ctx.panel;
    ensureStyle();

    var root = ui.el('div', 'i-root');
    stage.appendChild(root);

    /* ------------------------------------------------------------------ */
    /*  Panel                                                             */
    /* ------------------------------------------------------------------ */
    var paramGroups = [], formulaGroups = [], readGroups = [];
    var metrics = [];
    var ctrls = {};
    var i;

    for (i = 0; i < 6; i++) {
      paramGroups.push(ui.section(panel, '参数 · ' + SHORT[i], 'CONTROLS'));
    }

    function addSlider(scene, key, opts) {
      var o = {
        value: st[key], min: opts.min, max: opts.max, step: opts.step,
        label: opts.label, unit: opts.unit, hint: opts.hint,
        onInput: function (v) { st[key] = v; render(false); }
      };
      var s = ui.slider(o);
      ctrls[key] = s;
      paramGroups[scene].appendChild(s.el);
      return s;
    }

    addSlider(0, 'priceB', {
      min: 24, max: 60, step: 1, label: '公司 B 股价', unit: '元',
      hint: '其余两家公司价格不变。拖动它，观察指数点位而不是只看 B 的股价。'
    });

    addSlider(1, 'mktPrice', {
      min: 2.3, max: 2.7, step: 0.01, label: 'ETF 市价 / 份', unit: '元',
      hint: '净值/份约 2.50 元。市价高于净值是溢价，低于净值是折价。'
    });

    addSlider(2, 'rho', {
      min: 0, max: 0.9, step: 0.05, label: '成分股相关系数 ρ', unit: '',
      hint: 'ρ 越低，分散效果越强；ρ = 1 时一篮子与单股没有区别。'
    });
    addSlider(2, 'basket', {
      min: 2, max: 30, step: 1, label: '一篮子股票数 n', unit: '只',
      hint: '固定种子 20261101，同一参数下结果可复现。'
    });
    var repeatBtn = ui.button('再跑一次（同一种子）', function () {
      mcCache.key = '';
      update();
      if (ctx.toast) ctx.toast('固定种子 ' + MC_SEED + '：这次结果与上次完全一致');
    }, 'ghost sm');
    paramGroups[2].appendChild(ui.row([repeatBtn]));

    addSlider(3, 'feeSingle', {
      min: 0, max: 2, step: 0.05, label: '单股综合费率', unit: '%/年',
      hint: '管理、托管、交易摩擦等合并成一个示例费率，按资产比例扣除。'
    });
    addSlider(3, 'feeEtf', {
      min: 0, max: 1, step: 0.05, label: 'ETF 综合费率', unit: '%/年',
      hint: '指数基金通常低于主动选股，但仍会持续拖累终值。'
    });
    addSlider(3, 'divYield', {
      min: 0, max: 6, step: 0.2, label: '股息率', unit: '%/年',
      hint: '分红来自公司利润，不是额外收益；除息日股价会相应下调。'
    });
    addSlider(3, 'growth', {
      min: 2, max: 10, step: 0.5, label: '价格年涨幅假设', unit: '%/年',
      hint: '固定假设，仅用于算术演示，不是对未来收益的预测。'
    });

    addSlider(4, 'monthly', {
      min: 300, max: 5000, step: 100, label: '每月投入', unit: '元',
      hint: '月末投入，按假设年化收益率复利增值。'
    });
    addSlider(4, 'rate', {
      min: 0, max: 10, step: 0.5, label: '假设年化收益率', unit: '%',
      hint: '模型里保持不变；真实市场收益会波动，也可能为负。'
    });
    addSlider(4, 'years', {
      min: 5, max: 30, step: 1, label: '投资年数', unit: '年',
      hint: '时间越长，投入与收益的差距通常越大，但并非保证。'
    });

    addSlider(5, 'usdReturn', {
      min: 0, max: 12, step: 0.5, label: '美元资产年化', unit: '%',
      hint: '假设资产以美元计价、收益全部留在美元账户。'
    });
    addSlider(5, 'fx', {
      min: -8, max: 8, step: 0.5, label: '人民币兑美元年变动', unit: '%/年',
      hint: '负值表示人民币升值（美元贬值），折算回人民币会压低收益。'
    });

    /* formulas */
    var FORMULAS = [
      '<b>指数点位</b> = Σ(股价 × 股本) ÷ 除数<br>除数固定为 0.5 亿元；基准点位 1000',
      '<b>ETF 净值/份</b> = Σ(持仓价格 × 数量) ÷ 基金份额<br><b>溢价率</b> = 市价 ÷ 净值 − 1',
      '<b>组合波动</b> ≈ σ × √((1 + (n − 1)ρ) ÷ n)<br>平均回撤 = 各路径最大回撤的平均值',
      '<b>年化净回报</b> ≈ 价格涨幅 + 股息率 − 费率<br>终值 = 初始 × (1 + 净回报)<sup>10</sup>',
      '<b>FV</b> = 月供 × [((1 + r)<sup>n</sup> − 1) ÷ r]<br>r 为月利率，n 为月数',
      '<b>人民币收益</b> ≈ (1 + 美元收益) × (1 + 汇率变动) − 1<br>汇率变动按每年复合'
    ];
    for (i = 0; i < 6; i++) {
      formulaGroups.push(ui.section(panel, '公式 · ' + SHORT[i], 'FORMULA'));
      formulaGroups[i].appendChild(ui.formula(FORMULAS[i]));
    }

    /* metrics */
    var METRIC_DEFS = [
      [
        { key: 'level', label: '指数点位' },
        { key: 'cap', label: '三家公司总市值' },
        { key: 'chg', label: '指数较基准' },
        { key: 'w', label: 'B 公司权重' }
      ],
      [
        { key: 'single', label: '单股市值' },
        { key: 'etf', label: 'ETF 对应净值' },
        { key: 'nav', label: '净值 / 份' },
        { key: 'prem', label: '市价相对净值' },
        { key: 'maxw', label: 'ETF 最大权重' },
        { key: 'shares', label: '买入 ETF 份额' }
      ],
      [
        { key: 'medS', label: '中位终值 · 单股' },
        { key: 'medE', label: '中位终值 · 一篮' },
        { key: 'ddS', label: '平均回撤 · 单股' },
        { key: 'ddE', label: '平均回撤 · 一篮' },
        { key: 'sigS', label: '单股年化波动' },
        { key: 'sigE', label: '一篮年化波动' }
      ],
      [
        { key: 'fv', label: 'ETF 10 年终值' },
        { key: 'drag', label: '相对零费率拖累' },
        { key: 'div', label: '分红再投贡献' },
        { key: 'ann', label: 'ETF 年化净回报' }
      ],
      [
        { key: 'contrib', label: '累计投入' },
        { key: 'fv', label: '账户终值' },
        { key: 'gain', label: '账面收益' },
        { key: 'ratio', label: '收益 / 投入' }
      ],
      [
        { key: 'usd', label: '美元口径 5 年' },
        { key: 'cny', label: '人民币口径 5 年' },
        { key: 'fx', label: '汇率折算差' },
        { key: 'end', label: '期末人民币值' }
      ]
    ];
    for (i = 0; i < 6; i++) {
      readGroups.push(ui.section(panel, '读数 · ' + SHORT[i], 'READOUT'));
      var m = ui.metrics(METRIC_DEFS[i]);
      metrics.push(m);
      readGroups[i].appendChild(m.el);
    }

    var boundary = ui.section(panel, '简化假设 / 模型边界', 'DISCLOSURE');
    boundary.appendChild(ui.warn('本模块所有路径、分布与终值都是<b>固定种子的教学模拟</b>，用于展示机制，不含预测能力，也不构成投资建议。指数点位、ETF 净值、分红与汇率数字均为示例；真实世界还有税收、交易摩擦、跟踪误差、申赎限制与流动性差异。'));
    boundary.appendChild(ui.button('恢复默认参数', function () {
      Object.keys(DEFAULT).forEach(function (k) { st[k] = DEFAULT[k]; });
      mcCache.key = '';
      render(true);
    }, 'ghost sm'));

    /* ------------------------------------------------------------------ */
    /*  Stage shells                                                      */
    /* ------------------------------------------------------------------ */
    var wrappers = [], refs = [], built = [];
    var chartApi = {};

    function sceneWrap(cls) {
      var w = ui.el('div', 'i-scene' + (cls ? ' ' + cls : ''));
      root.appendChild(w);
      wrappers.push(w);
      return w;
    }

    var w1 = sceneWrap();
    (function () {
      var two = ui.el('div', 'i-two');
      var left = ui.el('div', 'i-col');
      var cards = ui.el('div', 'i-cards');
      var calc = ui.el('div', 'i-box i-calc');
      var table = ui.el('div', 'i-table');
      left.appendChild(cards); left.appendChild(calc); left.appendChild(table);
      var right = ui.el('div', 'i-col');
      var donut = ui.el('div', 'chart i-chart');
      var foot = ui.el('div', 'i-foot');
      right.appendChild(donut); right.appendChild(foot);
      two.appendChild(left); two.appendChild(right);
      w1.appendChild(two);
      refs[0] = { cards: cards, table: table, donut: donut, foot: foot, calc: calc };
    })();

    var w2 = sceneWrap();
    (function () {
      var two = ui.el('div', 'i-two even');
      var left = ui.el('div', 'i-col');
      var single = ui.el('div', 'i-box');
      var holdTable = ui.el('div', 'i-table');
      var note = ui.el('div', 'i-note');
      left.appendChild(single); left.appendChild(holdTable); left.appendChild(note);
      var right = ui.el('div', 'i-col');
      var h1 = ui.el('div', 'i-head', '<span>一张图 · 净值 vs 市价</span><b>共用 Y 轴 · ¥/份</b>');
      var navChart = ui.el('div', 'chart i-chart');
      var h2 = ui.el('div', 'i-head', '<span>副图 · 溢价率</span><b>市价 ÷ 净值 − 1</b>');
      var premChart = ui.el('div', 'chart i-prem');
      var legend = ui.el('div', 'i-legend');
      var navNote = ui.el('div', 'i-note');
      right.appendChild(h1); right.appendChild(navChart); right.appendChild(h2); right.appendChild(premChart); right.appendChild(legend); right.appendChild(navNote);
      two.appendChild(left); two.appendChild(right);
      w2.appendChild(two);
      refs[1] = { single: single, table: holdTable, note: note, chart: navChart, prem: premChart, legend: legend, navNote: navNote };
    })();

    var w3 = sceneWrap();
    (function () {
      var two = ui.el('div', 'i-two even');
      var a = ui.el('div', 'i-col');
      var b = ui.el('div', 'i-col');
      var ha = ui.el('div', 'i-head', '<span>单只股票 · 260 条路径</span><b>横轴：累计收益 %</b>');
      var hb = ui.el('div', 'i-head', '<span>一篮子股票 · 同一批冲击</span><b>横轴：累计收益 %</b>');
      var ca = ui.el('div', 'chart i-chart');
      var cb = ui.el('div', 'chart i-chart');
      var fa = ui.el('div', 'i-foot');
      var fb = ui.el('div', 'i-foot');
      a.appendChild(ha); a.appendChild(ca); a.appendChild(fa);
      b.appendChild(hb); b.appendChild(cb); b.appendChild(fb);
      two.appendChild(a); two.appendChild(b);
      w3.appendChild(two);
      refs[2] = { a: ca, b: cb, fa: fa, fb: fb };
    })();

    var w4 = sceneWrap();
    (function () {
      var two = ui.el('div', 'i-two');
      var left = ui.el('div', 'i-col');
      var chart = ui.el('div', 'chart i-chart');
      var legend = ui.el('div', 'i-legend');
      left.appendChild(chart); left.appendChild(legend);
      var right = ui.el('div', 'i-col');
      var bars = ui.el('div', 'chart i-chart');
      var note = ui.el('div', 'i-note');
      right.appendChild(bars); right.appendChild(note);
      two.appendChild(left); two.appendChild(right);
      w4.appendChild(two);
      refs[3] = { chart: chart, legend: legend, bars: bars, note: note };
    })();

    var w5 = sceneWrap();
    (function () {
      var rows = ui.el('div', 'i-rows');
      var chart = ui.el('div', 'chart i-chart');
      var legend = ui.el('div', 'i-legend');
      var bottom = ui.el('div', 'i-bottom');
      var table = ui.el('div', 'i-table');
      var note = ui.el('div', 'i-note');
      bottom.appendChild(table); bottom.appendChild(note);
      rows.appendChild(chart); rows.appendChild(legend); rows.appendChild(bottom);
      w5.appendChild(rows);
      refs[4] = { chart: chart, table: table, note: note, legend: legend };
    })();

    var w6 = sceneWrap();
    (function () {
      var rows = ui.el('div', 'i-rows');
      var chart = ui.el('div', 'chart i-chart');
      var legend = ui.el('div', 'i-legend');
      var bottom = ui.el('div', 'i-bottom');
      var table = ui.el('div', 'i-table');
      var note = ui.el('div', 'i-note');
      bottom.appendChild(table); bottom.appendChild(note);
      rows.appendChild(chart); rows.appendChild(legend); rows.appendChild(bottom);
      w6.appendChild(rows);
      refs[5] = { chart: chart, table: table, note: note, legend: legend };
    })();

    /* ------------------------------------------------------------------ */
    /*  Scene data                                                        */
    /* ------------------------------------------------------------------ */
    var DIVISOR = 5e7;

    function companies() {
      return [
        { name: 'A 公司', tag: '消费', price: 100, shares: 1e8 },
        { name: 'B 公司', tag: '制造', price: st.priceB, shares: 5e8 },
        { name: 'C 公司', tag: '金融', price: 20, shares: 1e9 }
      ];
    }

    function holdings() {
      return [
        { name: 'A 公司', price: 50, qty: 600 },
        { name: 'B 公司', price: 25, qty: 1000 },
        { name: 'C 公司', price: 80, qty: 250 },
        { name: 'D 公司', price: 20, qty: 750 },
        { name: 'E 公司', price: 40, qty: 250 }
      ];
    }
    var ETF_SHARES = 40000;

    function etfBase() {
      var h = holdings();
      var nav = core.etfNAV(h, ETF_SHARES);
      var weights = h.map(function (x) { return x.price * x.qty; });
      var total = weights.reduce(function (a, b) { return a + b; }, 0);
      return { holdings: h, nav: nav, weights: weights, total: total, perShare: nav.perShare };
    }

    var mcCache = { key: '', res: null };

    function runMC() {
      var key = [st.rho, st.basket, MC_SEED].join('|');
      if (mcCache.key === key && mcCache.res) return mcCache.res;
      mcCache.key = key;
      mcCache.res = sim.monteCarlo({
        seed: MC_SEED, years: 10, paths: 260, muPct: 7, sigmaPct: 28,
        rho: st.rho, basketSize: st.basket,
        feeSinglePct: 0, feeEtfPct: 0, divSinglePct: 0, divEtfPct: 0,
        monthly: 0, start: START
      });
      return mcCache.res;
    }

    /* ------------------------------------------------------------------ */
    /*  Builders                                                          */
    /* ------------------------------------------------------------------ */
    function ensure(i) {
      if (built[i]) return;
      built[i] = true;
      if (i === 0) {
        chartApi.donut = charts.donut(refs[0].donut, {
          segments: [], center: { value: '1000.0', label: '指数点位' }, label: '指数权重与点位'
        });
      } else if (i === 1) {
        chartApi.nav = charts.lines(refs[1].chart, {
          series: [], labels: [], zero: false, label: 'ETF 净值与市价（同一坐标轴，¥/份；教学模拟）',
          yFormat: function (v) { return v.toFixed(2); }
        });
        chartApi.prem = charts.lines(refs[1].prem, {
          series: [], labels: [], zero: false, label: '溢价率（市价 ÷ 净值 − 1，%）',
          yFormat: function (v) { return v.toFixed(2) + '%'; }
        });
        var axisTag = ui.el('div', 'i-axis-tag', '同一纵轴 · 两线间距 = 每份价差');
        refs[1].chart.appendChild(axisTag);
      } else if (i === 2) {
        chartApi.mcA = charts.bars(refs[2].a, { labels: [], values: [], label: '单股收益分布' });
        chartApi.mcB = charts.bars(refs[2].b, { labels: [], values: [], label: '一篮子收益分布' });
      } else if (i === 3) {
        chartApi.feeLine = charts.lines(refs[3].chart, { series: [], labels: [], zero: false, label: '十年终值对比' });
        chartApi.feeBar = charts.bars(refs[3].bars, { labels: [], values: [], label: '终值构成' });
      } else if (i === 4) {
        chartApi.dca = charts.lines(refs[4].chart, { series: [], labels: [], zero: false, min: 0, label: '定投：投入与账户价值' });
      } else if (i === 5) {
        chartApi.fx = charts.lines(refs[5].chart, { series: [], labels: [], zero: false, label: '美元资产与人民币投资者的收益指数' });
      }
    }

    var p = charts.palette();

    function updateS1() {
      var cos = companies(), total = 0;
      cos.forEach(function (c) { c.cap = c.price * c.shares; total += c.cap; });
      var idx = core.capWeightedLevel(cos, DIVISOR, 1000);
      var lvl = idx.level;
      refs[0].cards.innerHTML = '';
      cos.forEach(function (c, k) {
        var w = c.cap / total * 100;
        var card = ui.el('div', 'i-card' + (k === 1 ? ' act' : ''));
        card.innerHTML = '<div class="n"><span>' + c.name + '</span><span>' + c.tag + '</span></div>' +
          '<div class="p">' + ui.fmt.price(c.price) + '</div>' +
          '<div class="m">' + (c.shares / 1e8).toFixed(1) + ' 亿股 · 市值 ' + yi(c.cap) + '</div>' +
          '<div class="bar"><i style="width:' + w.toFixed(1) + '%"></i></div>' +
          '<div class="m">权重 ' + w.toFixed(1) + '%</div>';
        refs[0].cards.appendChild(card);
      });

      var rows = cos.map(function (c) {
        return [c.name, ui.fmt.price(c.price), (c.shares / 1e8).toFixed(1) + ' 亿', yi(c.cap), (c.cap / total * 100).toFixed(1) + '%'];
      });
      rows.push(['<b>合计</b>', '—', '—', '<b>' + yi(total) + '</b>', '100.0%']);
      ui.clear(refs[0].table);
      refs[0].table.appendChild(ui.table(['公司', '股价', '股本', '市值', '权重'], rows));

      refs[0].calc.innerHTML = '<div class="k">从市值到点位 · 当前读数</div>' +
        '<div class="row"><span>Σ(股价 × 股本)</span><b>' + yi(total) + '</b></div>' +
        '<div class="row"><span>÷ 固定除数</span><b>0.50 亿元</b></div>' +
        '<div class="row"><span>= 指数点位</span><b>' + lvl.toFixed(1) + ' 点</b></div>' +
        '<div class="i-note">点位没有货币单位，也不等于任何一只股票的价格；除数只在样本调整时修改。</div>';

      var chg = (lvl / 1000 - 1) * 100;
      refs[0].foot.innerHTML = 'B 公司权重 <b>' + (cos[1].cap / total * 100).toFixed(1) + '%</b>：它的股价每变动 10%，指数约变动 <b>' +
        (cos[1].cap / total * 10).toFixed(2) + '%</b>；指数现为 <b>' + lvl.toFixed(1) + '</b> 点。';

      chartApi.donut.setData({
        segments: cos.map(function (c, k) {
          return { label: c.name, value: c.cap / total * 100, color: [p.red, p.cyan, p.violet][k], display: yi(c.cap) };
        }),
        center: { value: lvl.toFixed(1), label: '指数点位' }
      });

      metrics[0].set({
        level: lvl.toFixed(1),
        cap: yi(total),
        chg: pct(chg),
        w: (cos[1].cap / total * 100).toFixed(1) + '%'
      }, { chg: chg > 0.001 ? 'pos' : (chg < -0.001 ? 'neg' : '') });
    }

    function updateS2() {
      var base = etfBase();
      var etfShares = START / st.mktPrice;
      var etfValue = etfShares * base.perShare;
      var prem = core.premiumPct(st.mktPrice, base.perShare);
      var stockShares = START / 50;

      refs[1].single.innerHTML = '<div class="k">单股账户</div>' +
        '<div class="big">' + money(START) + '</div>' +
        '<div class="row"><span>A 公司 ' + stockShares.toFixed(0) + ' 股 × ¥50</span><b>占比 100%</b></div>' +
        '<div class="row"><span>分散度</span><b>1 只股票</b></div>';

      var rows = base.holdings.map(function (h, k) {
        var v = h.price * h.qty;
        return [h.name, ui.fmt.price(h.price), ui.fmt.num(h.qty, 0), money(v), (v / base.total * 100).toFixed(1) + '%'];
      });
      rows.push(['<b>合计</b>', '—', '—', '<b>' + money(base.total) + '</b>', '100.0%']);
      ui.clear(refs[1].table);
      refs[1].table.appendChild(ui.table(['成分', '价格', '数量', '市值', '权重'], rows));

      refs[1].note.innerHTML = '表中是<b>整只 ETF 的示意组合</b>，规模与单股账户同为 <b>10 万元</b>。持仓市值除以 <b>4 万份</b>，得到净值/份 <b>¥' +
        base.perShare.toFixed(2) + '</b>；按市价 ¥' + st.mktPrice.toFixed(2) + ' 买入，份额约 <b>' +
        ui.fmt.num(etfShares, 0) + '</b> 份，对应净值 <b>' + money(etfValue) + '</b>。';

      var labels = [], navs = [], prices = [], prems = [];
      var rng = sim.rngFrom(101);
      var nav = 2.5;
      var targetPrem = st.mktPrice / base.perShare - 1;
      for (var k = 0; k < 40; k++) {
        if (k > 0) nav = nav * (1 + (rng() - 0.5) * 0.0032);
        var px = nav * (1 + targetPrem) + (rng() - 0.5) * 0.0012;
        labels.push('D' + (k + 1));
        navs.push(+nav.toFixed(3));
        prices.push(+px.toFixed(3));
        prems.push(+((px / nav - 1) * 100).toFixed(3));
      }
      chartApi.nav.setData({
        labels: labels,
        series: [
          { name: '净值/份', values: navs, color: p.cyan, fmt: function (v) { return '¥' + v.toFixed(3); } },
          { name: '市价/份', values: prices, color: p.orange, width: 1.2, fmt: function (v) { return '¥' + v.toFixed(3); } }
        ]
      });
      chartApi.prem.setData({
        labels: labels,
        series: [{ name: '溢价率', values: prems, color: p.orange, width: 1.2, fmt: function (v) { return v.toFixed(2) + '%'; } }]
      });
      ui.clear(refs[1].legend);
      refs[1].legend.appendChild(ui.legend([{ label: '基金净值（持仓决定）', color: p.cyan }, { label: '二级市场市价（供需决定）', color: p.orange }]));

      refs[1].navNote.innerHTML = '主图是<b>一张折线图</b>：橙色市价与青色净值共用<b>同一 Y 轴</b>（¥/份），两条线的纵向间距就是每份价差；价差除以净值即副图溢价率。费率、现金拖累、成分调整与申赎节奏会造成<b>跟踪误差</b>。';

      metrics[1].set({
        single: money(START),
        etf: money(etfValue),
        nav: '¥' + base.perShare.toFixed(2),
        prem: pct(prem, 2),
        maxw: (Math.max.apply(null, base.weights) / base.total * 100).toFixed(1) + '%',
        shares: ui.fmt.num(etfShares, 0) + ' 份'
      }, { prem: prem > 0.0001 ? 'neg' : (prem < -0.0001 ? 'pos' : '') });
    }

    function updateS3() {
      var res = runMC();
      var start = START;
      var all = res.distribution.single.concat(res.distribution.etf).map(function (v) { return (v / start - 1) * 100; });
      var lo = Math.max(-95, Math.floor(Math.min.apply(null, all) / 10) * 10);
      var hi = Math.min(300, Math.ceil(Math.max.apply(null, all) / 10) * 10);
      if (hi - lo < 40) hi = lo + 40;
      var bins = 12, step = (hi - lo) / bins;
      var cA = new Array(bins).fill(0), cB = new Array(bins).fill(0);
      res.distribution.single.forEach(function (v) {
        var r = (v / start - 1) * 100;
        cA[Math.max(0, Math.min(bins - 1, Math.floor((r - lo) / step)))]++;
      });
      res.distribution.etf.forEach(function (v) {
        var r = (v / start - 1) * 100;
        cB[Math.max(0, Math.min(bins - 1, Math.floor((r - lo) / step)))]++;
      });
      var labels = [];
      for (var k = 0; k < bins; k++) labels.push(Math.round(lo + k * step) + '%');
      chartApi.mcA.setData({ labels: labels, values: cA, color: p.orange });
      chartApi.mcB.setData({ labels: labels, values: cB, color: p.cyan });

      var qs = res.single.quantiles, qe = res.etf.quantiles;
      var rs = function (v) { return (v / start - 1) * 100; };
      refs[2].fa.innerHTML = '柱高 = 路径数 · 中位 <b>' + pct(rs(qs.p50)) + '</b> · 10%–90% 区间 <b>' + pct(rs(qs.p10)) + ' ~ ' + pct(rs(qs.p90)) +
        '</b> · 平均最大回撤 <b>' + (res.single.avgDrawdown * 100).toFixed(1) + '%</b>';
      refs[2].fb.innerHTML = '柱高 = 路径数 · 中位 <b>' + pct(rs(qe.p50)) + '</b> · 10%–90% 区间 <b>' + pct(rs(qe.p10)) + ' ~ ' + pct(rs(qe.p90)) +
        '</b> · 平均最大回撤 <b>' + (res.etf.avgDrawdown * 100).toFixed(1) + '%</b>';

      metrics[2].set({
        medS: money(qs.p50),
        medE: money(qe.p50),
        ddS: (res.single.avgDrawdown * 100).toFixed(1) + '%',
        ddE: (res.etf.avgDrawdown * 100).toFixed(1) + '%',
        sigS: res.params.sigma.toFixed(0) + '%',
        sigE: res.etfSigmaPct.toFixed(1) + '%'
      });
    }

    function updateS4() {
      var g = st.growth, f1 = st.feeSingle, f2 = st.feeEtf, d = st.divYield;
      var priceOnly = [START], cashOnly = [START], reinv = [START], etf = [START];
      var divAcc = 0, labels = ['0 年'];
      for (var y = 1; y <= 10; y++) {
        priceOnly.push(priceOnly[y - 1] * (1 + (g - f1) / 100));
        divAcc += priceOnly[y - 1] * d / 100;
        cashOnly.push(priceOnly[y] + divAcc);
        reinv.push(reinv[y - 1] * (1 + (g - f1) / 100) * (1 + d / 100));
        etf.push(etf[y - 1] * (1 + (g - f2) / 100) * (1 + d / 100));
        labels.push(y + ' 年');
      }
      chartApi.feeLine.setData({
        labels: labels,
        series: [
          { name: '单股 · 仅价格', values: priceOnly, color: p.red, fmt: money },
          { name: '单股 · 分红不再投', values: cashOnly, color: p.orange, fmt: money },
          { name: '单股 · 分红再投', values: reinv, color: p.violet, fmt: money },
          { name: 'ETF · 低费率再投', values: etf, color: p.cyan, width: 1.8, area: true, fmt: money }
        ]
      });
      ui.clear(refs[3].legend);
      refs[3].legend.appendChild(ui.legend([
        { label: '仅价格', color: p.red }, { label: '分红现金', color: p.orange },
        { label: '单股再投', color: p.violet }, { label: 'ETF 再投', color: p.cyan }
      ]));

      var bench = START * Math.pow(1 + g / 100, 10);
      chartApi.feeBar.setData({
        labels: ['价格', '分红现金', '分红再投', 'ETF 再投'],
        values: [priceOnly[10], cashOnly[10], reinv[10], etf[10]],
        colors: [p.dim, p.orange, p.violet, p.cyan],
        yFormat: function (v) { return (v / 10000).toFixed(1) + ' 万'; }
      });
      var drag = bench - etf[10];
      var ann = (Math.pow(etf[10] / START, 1 / 10) - 1) * 100;
      refs[3].note.innerHTML = '单股费率 <b>' + f1.toFixed(2) + '%</b> vs ETF <b>' + f2.toFixed(2) + '%</b>：10 年后，ETF 终值 <b>' + money(etf[10]) +
        '</b>。费率每高 1 个百分点，长期终值就会被持续侵蚀；分红再投则把现金分红重新变成份额。';

      metrics[3].set({
        fv: money(etf[10]),
        drag: signedMoney(drag),
        div: money(reinv[10] - priceOnly[10]),
        ann: pct(ann, 2)
      }, { drag: drag > 0 ? 'neg' : '', div: reinv[10] > priceOnly[10] ? 'pos' : '' });
    }

    function updateS5() {
      var rows = sim.dca({ years: st.years, ratePct: st.rate, monthly: st.monthly });
      var yearly = rows.filter(function (r) { return r.m % 12 === 0; });
      if (yearly[yearly.length - 1].m !== rows[rows.length - 1].m) yearly.push(rows[rows.length - 1]);
      var labels = yearly.map(function (r) { return (r.m / 12).toFixed(0) + ' 年'; });
      var values = yearly.map(function (r) { return r.value; });
      var contributed = yearly.map(function (r) { return r.contributed; });
      chartApi.dca.setData({
        labels: labels,
        series: [
          { name: '累计投入', values: contributed, color: p.blue, dash: [4, 3], fmt: money },
          { name: '账户价值', values: values, color: p.cyan, width: 1.8, area: true, fmt: money }
        ]
      });
      ui.clear(refs[4].legend);
      refs[4].legend.appendChild(ui.legend([
        { label: '累计投入（虚线）', color: p.blue },
        { label: '账户价值（青色实线，含假设收益）', color: p.cyan }
      ]));
      var last = rows[rows.length - 1];
      var gain = last.value - last.contributed;
      var tail = ['0', Math.round(st.years / 3), Math.round(st.years * 2 / 3), st.years].filter(function (v, k, arr) {
        return v <= st.years && arr.indexOf(v) === k;
      });
      var tableRows = tail.map(function (y) {
        var r = rows[Math.min(rows.length - 1, Math.round(y * 12))];
        return [y + ' 年', money(r.contributed), money(r.value), money(r.value - r.contributed)];
      });
      ui.clear(refs[4].table);
      refs[4].table.appendChild(ui.table(['时点', '累计投入', '账户价值', '账面收益'], tableRows));
      refs[4].note.innerHTML = '每月 <b>' + money(st.monthly) + '</b>，假设年化 <b>' + st.rate.toFixed(1) +
        '%</b>。收益曲线在后期变陡，是因为复利作用在本金和既有收益上；这不代表未来也能取得同样收益。';

      metrics[4].set({
        contrib: money(last.contributed),
        fv: money(last.value),
        gain: money(gain),
        ratio: last.contributed ? (last.value / last.contributed).toFixed(2) + '×' : '—'
      }, { gain: gain > 0 ? 'pos' : (gain < 0 ? 'neg' : '') });
    }

    function updateS6() {
      var r = st.usdReturn / 100, f = st.fx / 100;
      var labels = [], usd = [], cny = [];
      for (var y = 0; y <= 5; y++) {
        labels.push(y + ' 年');
        usd.push(100 * Math.pow(1 + r, y));
        cny.push(100 * Math.pow((1 + r) * (1 + f), y));
      }
      chartApi.fx.setData({
        labels: labels,
        series: [
          { name: '美元口径（起点 100）', values: usd, color: p.blue, fmt: function (v) { return v.toFixed(1); } },
          { name: '人民币口径（起点 100）', values: cny, color: p.cyan, width: 1.8, fmt: function (v) { return v.toFixed(1); } }
        ]
      });
      ui.clear(refs[5].legend);
      refs[5].legend.appendChild(ui.legend([
        { label: '美元口径（蓝色，不含汇率）', color: p.blue },
        { label: '人民币口径（青色，含汇率折算）', color: p.cyan }
      ]));
      var usdRet = (Math.pow(1 + r, 5) - 1) * 100;
      var cnyRet = (Math.pow((1 + r) * (1 + f), 5) - 1) * 100;
      var end = START * Math.pow((1 + r) * (1 + f), 5);
      var rows = [];
      for (var k = 0; k <= 5; k++) {
        rows.push([k + ' 年', (100 * Math.pow(1 + r, k)).toFixed(1), (100 * Math.pow((1 + r) * (1 + f), k)).toFixed(1)]);
      }
      ui.clear(refs[5].table);
      refs[5].table.appendChild(ui.table(['时点', '美元指数', '人民币指数'], rows));
      refs[5].note.innerHTML = '美元资产年化 <b>' + st.usdReturn.toFixed(1) + '%</b>，人民币兑美元每年 <b>' +
        (st.fx > 0 ? '+' : '') + st.fx.toFixed(1) + '%</b>。5 年后：美元口径 <b>' + pct(usdRet) + '</b>，折算成人民币 <b>' +
        pct(cnyRet) + '</b>。海外 ETF 跟踪的是海外资产，汇率暴露不会因为换了基金而消失。';

      metrics[5].set({
        usd: pct(usdRet),
        cny: pct(cnyRet),
        fx: pct(cnyRet - usdRet),
        end: money(end)
      }, { cny: cnyRet >= 0 ? 'pos' : 'neg', fx: cnyRet - usdRet >= 0 ? 'pos' : 'neg' });
    }

    var UPDATERS = [updateS1, updateS2, updateS3, updateS4, updateS5, updateS6];

    function currentScene() {
      var i = typeof ctx.sceneIndex === 'function' ? ctx.sceneIndex() : 0;
      return Math.max(0, Math.min(5, i || 0));
    }

    function syncControls() {
      Object.keys(ctrls).forEach(function (k) { ctrls[k].set(st[k], true); });
    }

    var SCENE_CHARTS = [['donut'], ['nav', 'prem'], ['mcA', 'mcB'], ['feeLine', 'feeBar'], ['dca'], ['fx']];
    var lastScene = -1;

    function teardown(i) {
      (SCENE_CHARTS[i] || []).forEach(function (k) {
        if (chartApi[k]) {
          try { chartApi[k].destroy(); } catch (e) { /* idempotent */ }
          delete chartApi[k];
        }
      });
      built[i] = false;
    }

    function render(sync) {
      var cur = currentScene();
      if (lastScene >= 0 && lastScene !== cur) teardown(lastScene);
      lastScene = cur;
      wrappers.forEach(function (w, k) { w.classList.toggle('on', k === cur); });
      paramGroups.forEach(function (g, k) { g.style.display = k === cur ? '' : 'none'; });
      formulaGroups.forEach(function (g, k) { g.style.display = k === cur ? '' : 'none'; });
      readGroups.forEach(function (g, k) { g.style.display = k === cur ? '' : 'none'; });
      ensure(cur);
      UPDATERS[cur]();
      var api = null;
      if (cur === 0) api = chartApi.donut;
      else if (cur === 1) { chartApi.nav.resize(); chartApi.prem.resize(); }
      else if (cur === 2) { chartApi.mcA.resize(); chartApi.mcB.resize(); }
      else if (cur === 3) { chartApi.feeLine.resize(); chartApi.feeBar.resize(); }
      else if (cur === 4) api = chartApi.dca;
      else if (cur === 5) api = chartApi.fx;
      if (api) api.resize();
      if (sync) syncControls();
    }

    /* ------------------------------------------------------------------ */
    /*  API                                                               */
    /* ------------------------------------------------------------------ */
    var inst = {
      apply: function (patch) {
        if (patch) {
          Object.keys(patch).forEach(function (k) {
            if (Object.prototype.hasOwnProperty.call(DEFAULT, k) && isFinite(Number(patch[k]))) {
              st[k] = Number(patch[k]);
            }
          });
        }
        render(true);
      },
      destroy: function () {
        Object.keys(chartApi).forEach(function (k) {
          try { chartApi[k].destroy(); } catch (e) { /* idempotent */ }
        });
        chartApi = {};
        root.remove();
      }
    };

    render(true);
    return inst;
  }

  SM.registerModule({
    id: 'I',
    slug: 'etf',
    order: 9,
    title: 'ETF 与长期投资',
    en: 'PORTFOLIO',
    subtitle: '指数、分散、费用、复利与汇率：把长期投资拆成可计算的零件。',
    hint: '拖动参数，先看公式，再读数字：指数点位、净值、费用与汇率都会一起变化。',
    scenes: [
      {
        title: '指数不是股票',
        body: '把三家公司按 <b>股价 × 股本</b> 加总，再除以一个固定除数，就得到指数点位。它衡量的是一篮子公司的总市值，<b>不是任何一只股票的价格</b>。<br>股本大、市值高的公司权重更大，所以同样涨 10%，对指数的影响并不相同。',
        patch: { priceB: 40 },
        guide: '拖动 B 公司股价：看它的权重、总市值与指数点位如何一起变化。',
        duration: 14000
      },
      {
        title: '个股 vs ETF',
        body: '同样 10 万元：买一只股票，全部身家押在一个代码上；买 ETF，同一笔钱被拆成一篮子持仓。<br>ETF 的 <b>净值/份</b> 来自持仓市值除以基金份额，市价则围绕净值波动，形成溢价或折价。',
        patch: { mktPrice: 2.56 },
        guide: '对比左右两栏：单股集中度 100%，ETF 最大权重是多少？再拖动市价看溢价率。',
        duration: 14000
      },
      {
        title: '分散与相关性',
        body: '把同一个收益与波动假设跑很多次：单股结果分布很宽，一篮子则收窄，这就是分散。<br>分散效果取决于<b>成分股相关性</b>与<b>篮子大小</b>：相关性越低、持仓越分散，组合波动通常越小。',
        patch: { rho: 0.55, basket: 12 },
        guide: '先把 ρ 拉到 0.9，再把 ρ 拉到 0，比较两张分布的宽度与平均回撤。',
        duration: 15000
      },
      {
        title: '费用与分红',
        body: '费用按资产比例持续扣除，短期不起眼，长期会明显拖累终值；分红则把部分收益以现金返还。<br>你看到的是<b>价格回报</b>还是<b>含分红的总回报</b>，取决于分红是否再投资。',
        patch: { feeSingle: 1.2, feeEtf: 0.25, divYield: 2.4, growth: 6 },
        guide: '把单股费率从 0 拉到 2%，看 10 年终值；再切换股息率，看分红现金与再投的差距。',
        duration: 15000
      },
      {
        title: '定投与复利',
        body: '每月固定投入，收益按假设年化复利增长，时间会把投入和收益拉开。<br>图中两条线的差距不是保证，而是<b>固定利率假设</b>下的算术结果；真实收益会波动，也可能为负。',
        patch: { monthly: 1000, rate: 6, years: 20 },
        guide: '改变月供与年数，比较“累计投入”和“账户价值”两条线。',
        duration: 14000
      },
      {
        title: '汇率风险',
        body: '持有美元资产，你同时承担资产涨跌和<b>汇率变化</b>。<br>美元资产涨 8%，若人民币升值 3%，折算回人民币的收益约为 4.8%，而不是 11%。',
        patch: { usdReturn: 8, fx: -2 },
        guide: '把汇率年变动从负值拉到正值，观察人民币口径曲线如何与美元口径分叉。',
        duration: 14000
      }
    ],
    quiz: [
      {
        q: '三家公司总市值 500 亿元，除数 0.5 亿元，指数点位是多少？',
        options: ['500 点', '1000 点', '250 点', '无法计算，需要知道股价'],
        answer: 1,
        explain: '指数点位 = 总市值 ÷ 除数 = 500 ÷ 0.5 = <b>1000 点</b>。它反映的是加权总市值，不是某只股票的价格。'
      },
      {
        q: 'ETF 持仓市值 1 亿元、基金份额 4000 万份，市价 2.60 元。下列哪项正确？',
        options: ['净值/份 2.50 元，溢价 4%', '净值/份 2.60 元，溢价 0', '净值/份 2.50 元，折价 4%', '净值/份 2.40 元，溢价 8.3%'],
        answer: 0,
        explain: '净值/份 = 1 亿 ÷ 4000 万 = <b>2.50 元</b>；溢价率 = 2.60 ÷ 2.50 − 1 = <b>4%</b>。买入时支付了高于持仓净值的价格。'
      },
      {
        q: '美元资产一年涨 8%，同期人民币兑美元升值 3%。人民币投资者粗算收益约为？',
        options: ['+11%', '+8%', '+4.8%', '−3%'],
        answer: 2,
        explain: '人民币收益 ≈ (1 + 8%) × (1 − 3%) − 1 ≈ <b>+4.8%</b>。汇率不是简单相加，人民币升值会压缩折算后的收益。'
      }
    ],
    mount: mount
  });
})();
