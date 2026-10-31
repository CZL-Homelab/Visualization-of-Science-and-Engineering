/* Module G — 估值与基本面：利润到 EPS、PE、PB/ROE、增长、稀释与企业价值。 */
(function () {
  'use strict';
  var SM = window.SM;
  var ui = SM.ui, core = SM.core, charts = SM.charts;

  var SCENES = {
    g1: { mode: 'g1', revenue: 100, margin: 10, shares: 10 },
    g2: { mode: 'g2', profit: 1, pe: 20, g2shares: 10 },
    g3: { mode: 'g3', bv: 60, roe: 15, dps: 0.6, price: 18, g3shares: 10 },
    g4: { mode: 'g4', g4profit: 10, growth: 20, fpe: 20, g4price: 20, g4shares: 10 },
    g5: {
      mode: 'g5', g5profit: 10, preShares: 10, newShares: 2, issuePrice: 18,
      prePrice: 20, efficiency: 1, path: 'issue'
    },
    g6: { mode: 'g6', g6price: 20, g6shares: 10, debt: 20, cash: 10 }
  };
  var DEFAULT = Object.assign({ mode: 'g1' }, SCENES.g1, SCENES.g2, SCENES.g3, SCENES.g4, SCENES.g5, SCENES.g6);
  DEFAULT.mode = 'g1';

  function f(v, d) { return ui.fmt.num(v, d == null ? 2 : d); }
  function pct(v, d) { return ui.fmt.num(v, d == null ? 1 : d) + '%'; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var p = charts.palette();
    var stage = ctx.stage, panel = ctx.panel;
    var views = {}, blocks = {}, M = {}, F = {}, C = {}, E = {};

    function makeView(mode, cls) {
      var w = ui.el('div', cls || 'stage-grid two');
      w.style.cssText = 'flex:1;min-height:0';
      stage.appendChild(w);
      views[mode] = w;
      return w;
    }
    function addBlock(mode, title, hint) {
      var g = ui.section(panel, title, hint);
      (blocks[mode] = blocks[mode] || []).push(g);
      return g;
    }
    function fill(host, caption, extra) {
      var box = ui.el('div', 'fill');
      box.style.flex = '1';
      if (caption) box.appendChild(ui.note(caption));
      if (extra) box.appendChild(extra);
      var c = ui.el('div', 'chart');
      c.style.flex = '1';
      box.appendChild(c);
      host.appendChild(box);
      return c;
    }
    function legendFor(list) {
      return ui.legend(list.map(function (x) { return { label: x[0], color: x[1] }; }));
    }
    function tableWrap(node) {
      var w = ui.el('div');
      w.style.cssText = 'overflow:auto;min-height:0';
      w.appendChild(node);
      return w;
    }

    /* ---------------- mode switcher ---------------- */
    var gMode = ui.section(panel, '场景切换', 'G · 6 SCENES');
    var modeSeg = ui.seg({
      options: [
        { value: 'g1', label: '利润→EPS' },
        { value: 'g2', label: 'PE 倍数' },
        { value: 'g3', label: 'PB / ROE' },
        { value: 'g4', label: '增长估值' },
        { value: 'g5', label: '稀释' },
        { value: 'g6', label: '市值 vs EV' }
      ],
      value: 'g1',
      onChange: function (v) { st.mode = v; sync(); render(); }
    });
    gMode.appendChild(modeSeg.el);

    /* =====================================================
     *  G1 — 营收 → 净利润 → EPS
     * ===================================================== */
    var v1 = makeView('g1');
    C.g1left = fill(v1, '单位：亿元 · 营收先扣成本与费用，得到净利润');
    C.g1right = fill(v1, '单位：元/股 · 每股营收 × 净利率 = EPS');
    C.g1a = charts.bars(C.g1left, { labels: [], values: [], label: '营收、成本费用与净利润' });
    C.g1b = charts.bars(C.g1right, { labels: [], values: [], label: '每股营收与每股收益' });

    var g1c = addBlock('g1', 'G1 · 利润表', 'REVENUE → EPS');
    var s1rev = ui.slider({
      label: '营业收入', min: 10, max: 300, step: 1, value: 100, unit: '亿元',
      onInput: function (v) { st.revenue = v; sync(); render(); }
    });
    var s1mar = ui.slider({
      label: '净利率', min: 1, max: 40, step: 0.5, value: 10, unit: '%',
      hint: '净利润 ÷ 营业收入；已把成本、费用与税负合并为一个比例。',
      onInput: function (v) { st.margin = v; sync(); render(); }
    });
    var s1shr = ui.slider({
      label: '总股本', min: 1, max: 40, step: 1, value: 10, unit: '亿股',
      onInput: function (v) { st.shares = v; sync(); render(); }
    });
    g1c.appendChild(s1rev.el); g1c.appendChild(s1mar.el); g1c.appendChild(s1shr.el);

    var g1f = addBlock('g1', '公式', 'FORMULA');
    F.g1 = ui.formula('');
    g1f.appendChild(F.g1);
    var g1m = addBlock('g1', '读数', 'LIVE');
    M.g1 = ui.metrics([
      { key: 'profit', label: '净利润（亿元）' },
      { key: 'eps', label: '每股收益 EPS（元）' },
      { key: 'rps', label: '每股营收（元）' },
      { key: 'margin', label: '净利率' }
    ]);
    g1m.appendChild(M.g1.el);
    var g1n = addBlock('g1', '边界', 'MODEL');
    g1n.appendChild(ui.note('EPS 只描述“每一股分到多少利润”，不告诉你市场愿意为这份利润付多少钱。'));
    g1n.appendChild(ui.warn('净利率被压缩成一个参数，未拆分毛利率、费用率、税率与一次性损益；股本变化也不考虑回购与期权。'));

    /* =====================================================
     *  G2 — PE 倍数
     * ===================================================== */
    var v2 = makeView('g2');
    E.g2note = ui.note('');
    C.g2left = fill(v2, '单位：元/股 · 固定净利润 1 亿元，PE 从 5× 到 60×');
    C.g2right = fill(v2, '单位：亿元 · 四个常见 PE 对应的市值', E.g2note);
    C.g2a = charts.lines(C.g2left, {
      series: [], labels: [], zero: false,
      yFormat: function (v) { return '¥' + v.toFixed(1); }, label: 'PE 与每股价格'
    });
    C.g2b = charts.bars(C.g2right, {
      labels: ['10×', '20×', '30×', '50×'], values: [10, 20, 30, 50],
      yFormat: function (v) { return v.toFixed(0) + '亿'; }, label: '四个 PE 对应的市值'
    });

    var g2c = addBlock('g2', 'G2 · PE', 'PROFIT × MULTIPLE');
    var s2pe = ui.slider({
      label: 'PE 倍数', min: 5, max: 60, step: 1, value: 20, unit: '×',
      hint: '市盈率 = 股价 ÷ 每股收益 = 市值 ÷ 净利润。',
      onInput: function (v) { st.pe = v; sync(); render(); }
    });
    var seg2pe = ui.seg({
      label: '常用倍数',
      options: [
        { value: '10', label: '10×' }, { value: '20', label: '20×' },
        { value: '30', label: '30×' }, { value: '50', label: '50×' }
      ],
      value: '20',
      onChange: function (v) { st.pe = Number(v); sync(); render(); }
    });
    var s2shr = ui.slider({
      label: '总股本', min: 1, max: 30, step: 1, value: 10, unit: '亿股',
      onInput: function (v) { st.g2shares = v; sync(); render(); }
    });
    g2c.appendChild(s2pe.el); g2c.appendChild(seg2pe.el); g2c.appendChild(s2shr.el);
    var g2f = addBlock('g2', '公式', 'FORMULA');
    F.g2 = ui.formula('');
    g2f.appendChild(F.g2);
    var g2m = addBlock('g2', '读数', 'LIVE');
    M.g2 = ui.metrics([
      { key: 'cap', label: '总市值' },
      { key: 'price', label: '每股价格' },
      { key: 'eps', label: 'EPS' },
      { key: 'ey', label: '盈利收益率' }
    ]);
    g2m.appendChild(M.g2.el);
    var g2n = addBlock('g2', '边界', 'MODEL');
    g2n.appendChild(ui.note('<b>PE 不是回本年限。</b>它把增长预期、风险溢价与利率环境打包成一个倍数；同样的 1 亿元利润，市场给 10× 还是 30×，价格差三倍。'));
    g2n.appendChild(ui.note('这里把净利润固定为 1 亿元，因此市值只随 PE 变化；股本只决定把市值切成多少股、每股多少钱。'));
    g2n.appendChild(ui.warn('低 PE 可能便宜，也可能在反映利润下滑；高 PE 可能贵，也可能对应高增长。未考虑周期、会计口径与非经常性损益。'));

    /* =====================================================
     *  G3 — PB / ROE / 股息率
     * ===================================================== */
    var v3 = makeView('g3');
    E.g3legend = legendFor([['PE 10×', p.blue], ['PE 20×', p.cyan], ['PE 30×', p.orange], ['PE 50×', p.violet]]);
    C.g3left = fill(v3, 'PB 随 ROE 上升；四条参考线对应 PE 10× / 20× / 30× / 50×', E.g3legend);
    C.g3right = fill(v3, '利润分配：现金分红与留存收益');
    C.g3a = charts.lines(C.g3left, {
      series: [], labels: [], zero: false,
      yFormat: function (v) { return v < 0 ? '' : v.toFixed(1) + '×'; }, label: 'PB、ROE 与 PE 的关系'
    });
    C.g3b = charts.donut(C.g3right, { segments: [], center: { value: '—', label: '股息率' }, label: '分红与留存收益占比' });

    var g3c = addBlock('g3', 'G3 · PB / ROE', 'BOOK VALUE & PAYOUT');
    var s3bv = ui.slider({
      label: '净资产（账面）', min: 20, max: 200, step: 5, value: 60, unit: '亿元',
      onInput: function (v) { st.bv = v; sync(); render(); }
    });
    var s3roe = ui.slider({
      label: 'ROE', min: 2, max: 30, step: 1, value: 15, unit: '%',
      hint: '净利润 ÷ 净资产；高 ROE 也可能来自高杠杆。',
      onInput: function (v) { st.roe = v; sync(); render(); }
    });
    var s3dps = ui.slider({
      label: '每股分红', min: 0, max: 1.5, step: 0.05, value: 0.6, unit: '元',
      onInput: function (v) { st.dps = v; sync(); render(); }
    });
    var s3price = ui.slider({
      label: '股价', min: 5, max: 40, step: 0.5, value: 18, unit: '元',
      onInput: function (v) { st.price = v; sync(); render(); }
    });
    g3c.appendChild(s3bv.el); g3c.appendChild(s3roe.el); g3c.appendChild(s3dps.el); g3c.appendChild(s3price.el);
    var g3f = addBlock('g3', '公式', 'FORMULA');
    F.g3 = ui.formula('');
    g3f.appendChild(F.g3);
    var g3m = addBlock('g3', '读数', 'LIVE');
    M.g3 = ui.metrics([
      { key: 'pb', label: 'PB（市净率）' },
      { key: 'pe', label: 'PE（市盈率）' },
      { key: 'dy', label: '股息率' },
      { key: 'payout', label: '派息率' },
      { key: 'bvps', label: '每股净资产' },
      { key: 'roe', label: 'ROE' }
    ]);
    g3m.appendChild(M.g3.el);
    var g3n = addBlock('g3', '边界', 'MODEL');
    g3n.appendChild(ui.note('<b>PB = PE × ROE</b> 是恒等式：PE 给利润定价，ROE 把利润与净资产连起来。股息率取决于分红政策，不是固定的“利息”。'));
    g3n.appendChild(ui.warn('账面净资产可能低估无形资产，也可能高估存货与应收；高 ROE 可能由杠杆或一次性收益推高。跨行业比较 PB 的意义有限。'));

    /* =====================================================
     *  G4 — 增长与估值
     * ===================================================== */
    var v4 = makeView('g4');
    E.g4legend = legendFor([['估值线（远期 PE × 明年 EPS）', p.cyan], ['当前股价', p.dim]]);
    C.g4left = fill(v4, '估值线：远期 PE × 明年 EPS；虚线为当前股价', E.g4legend);
    C.g4right = fill(v4, '单位：亿元 · 今年与明年净利润');
    C.g4a = charts.lines(C.g4left, {
      series: [], labels: [], zero: false,
      yFormat: function (v) { return '¥' + v.toFixed(1); }, label: '增长率、PE 与估值线'
    });
    C.g4b = charts.bars(C.g4right, {
      labels: [], values: [], yFormat: function (v) { return v.toFixed(0) + '亿'; },
      label: '今年与明年净利润'
    });

    var g4c = addBlock('g4', 'G4 · 增长', 'GROWTH & FORWARD PE');
    var s4g = ui.slider({
      label: '利润增长率', min: -20, max: 50, step: 1, value: 20, unit: '%',
      hint: '教学参数，不是预测；负增长同样可调。',
      onInput: function (v) { st.growth = v; sync(); render(); }
    });
    var s4pe = ui.slider({
      label: '愿意给的远期 PE', min: 5, max: 50, step: 1, value: 20, unit: '×',
      onInput: function (v) { st.fpe = v; sync(); render(); }
    });
    var s4price = ui.slider({
      label: '当前股价', min: 5, max: 60, step: 0.5, value: 20, unit: '元',
      onInput: function (v) { st.g4price = v; sync(); render(); }
    });
    g4c.appendChild(s4g.el); g4c.appendChild(s4pe.el); g4c.appendChild(s4price.el);
    var g4f = addBlock('g4', '公式', 'FORMULA');
    F.g4 = ui.formula('');
    g4f.appendChild(F.g4);
    var g4m = addBlock('g4', '读数', 'LIVE');
    M.g4 = ui.metrics([
      { key: 'nextProfit', label: '明年净利润' },
      { key: 'nextEps', label: '明年 EPS' },
      { key: 'fpe', label: '远期 PE' },
      { key: 'value', label: '估值线价格' },
      { key: 'space', label: '相对当前股价' },
      { key: 'pe', label: '当前 PE（滚动）' }
    ]);
    g4m.appendChild(M.g4.el);
    var g4n = addBlock('g4', '边界', 'MODEL');
    g4n.appendChild(ui.note('远期 PE = 当前股价 ÷ 明年 EPS。市场给多少倍，取决于增长能否兑现、竞争格局与风险溢价，<b>不是公式算出来的必然值</b>。'));
    g4n.appendChild(ui.warn('假设利润增长直接落到每股收益、股本不变；未考虑增发、回购、税率变化与一次性项目。增长率只是输入，不是预测。'));

    /* =====================================================
     *  G5 — 稀释
     * ===================================================== */
    var v5 = makeView('g5');
    C.g5left = fill(v5, '单位：元/股 · 增发前后 EPS 与发行后股价');
    C.g5right = fill(v5, '发行后的股东结构');
    C.g5a = charts.bars(C.g5left, {
      labels: [], values: [], yFormat: function (v) { return '¥' + v.toFixed(2); },
      label: '增发前后的每股收益'
    });
    C.g5b = charts.donut(C.g5right, { segments: [], center: { value: '—', label: '新股占比' }, label: '发行后股权结构' });

    var g5c = addBlock('g5', 'G5 · 增发与稀释', 'ISSUANCE');
    var seg5path = ui.seg({
      label: '新增股份来源',
      options: [{ value: 'issue', label: '增发' }, { value: 'option', label: '期权行权' }],
      value: 'issue',
      onChange: function (v) {
        st.path = v;
        if (v === 'option') { st.newShares = 1; st.issuePrice = 8; }
        else { st.newShares = 2; st.issuePrice = 18; }
        st.efficiency = 1;
        sync(); render();
      }
    });
    var s5new = ui.slider({
      label: '新发行股数', min: 0.5, max: 5, step: 0.5, value: 2, unit: '亿股',
      onInput: function (v) { st.newShares = v; sync(); render(); }
    });
    var s5price = ui.slider({
      label: '发行价', min: 5, max: 30, step: 0.5, value: 18, unit: '元',
      onInput: function (v) { st.issuePrice = v; sync(); render(); }
    });
    var s5pre = ui.slider({
      label: '发行前股价', min: 5, max: 30, step: 0.5, value: 20, unit: '元',
      onInput: function (v) { st.prePrice = v; sync(); render(); }
    });
    var s5eff = ui.slider({
      label: '募资使用效率', min: 0.5, max: 1.5, step: 0.1, value: 1, unit: '×',
      hint: '1.0 = 每 1 元募资创造 1 元企业价值；小于 1 表示折价投入。',
      onInput: function (v) { st.efficiency = v; sync(); render(); }
    });
    g5c.appendChild(seg5path.el); g5c.appendChild(s5new.el); g5c.appendChild(s5price.el);
    g5c.appendChild(s5pre.el); g5c.appendChild(s5eff.el);
    var g5f = addBlock('g5', '公式', 'FORMULA');
    F.g5 = ui.formula('');
    g5f.appendChild(F.g5);
    var g5m = addBlock('g5', '读数', 'LIVE');
    M.g5 = ui.metrics([
      { key: 'eps0', label: 'EPS：发行前' },
      { key: 'eps1', label: 'EPS：发行后' },
      { key: 'price1', label: '发行后股价' },
      { key: 'stake', label: '原股东占比' },
      { key: 'proceeds', label: '募集资金' },
      { key: 'dilute', label: '股本稀释' }
    ]);
    g5m.appendChild(M.g5.el);
    var g5n = addBlock('g5', '边界', 'MODEL');
    g5n.appendChild(ui.note('同样增加股本，<b>期权行权</b>的行权价通常事先约定；若显著低于市价，稀释更强。把“发行价”调低即可比较。'));
    g5n.appendChild(ui.warn('未计承销费、税费、锁定期与募集资金的时间价值；股价由“发行前市值 + 募资 × 效率”简化得到。期权、可转债的会计处理更复杂。'));

    /* =====================================================
     *  G6 — 市值 vs 企业价值
     * ===================================================== */
    var v6 = makeView('g6');
    var g6left = ui.el('div', 'fill');
    g6left.style.flex = '1';
    g6left.appendChild(ui.note('EV 桥 · 单位：亿元 · 市值 + 净债务（债务 − 现金）'));
    E.g6stack = ui.el('div');
    E.g6stack.style.cssText = 'display:flex;gap:2px;height:42px;border-radius:8px;overflow:hidden;border:1px solid var(--line);background:var(--panel-2);flex:0 0 auto';
    g6left.appendChild(E.g6stack);
    E.g6big = ui.el('div');
    E.g6big.style.cssText = 'font-family:var(--mono);color:var(--cyan);font-size:26px;line-height:1.15;margin:8px 0 2px;letter-spacing:-.02em';
    g6left.appendChild(E.g6big);
    E.g6caption = ui.note('');
    g6left.appendChild(E.g6caption);
    E.g6table = ui.el('div');
    E.g6table.style.cssText = 'margin-top:8px;overflow:auto;min-height:0';
    g6left.appendChild(E.g6table);
    E.g6legend = ui.el('div');
    E.g6legend.style.cssText = 'margin-top:6px';
    g6left.appendChild(E.g6legend);
    v6.appendChild(g6left);
    C.g6right = fill(v6, '同市值 ≠ 同企业价值：B 公司债务 30 亿、现金 5 亿');
    C.g6a = charts.bars(C.g6right, {
      labels: ['A 市值', 'A EV', 'B 市值', 'B EV'], values: [], yFormat: function (v) { return v.toFixed(0) + '亿'; },
      label: '两家公司的市值与企业价值'
    });

    var g6c = addBlock('g6', 'G6 · 企业价值', 'MARKET CAP → EV');
    var s6price = ui.slider({
      label: '股价', min: 5, max: 40, step: 0.5, value: 20, unit: '元',
      onInput: function (v) { st.g6price = v; sync(); render(); }
    });
    var s6shr = ui.slider({
      label: '总股本', min: 1, max: 20, step: 1, value: 10, unit: '亿股',
      onInput: function (v) { st.g6shares = v; sync(); render(); }
    });
    var s6debt = ui.slider({
      label: '债务', min: 0, max: 100, step: 1, value: 20, unit: '亿元',
      onInput: function (v) { st.debt = v; sync(); render(); }
    });
    var s6cash = ui.slider({
      label: '现金', min: 0, max: 80, step: 1, value: 10, unit: '亿元',
      onInput: function (v) { st.cash = v; sync(); render(); }
    });
    g6c.appendChild(s6price.el); g6c.appendChild(s6shr.el); g6c.appendChild(s6debt.el); g6c.appendChild(s6cash.el);
    var g6f = addBlock('g6', '公式', 'FORMULA');
    F.g6 = ui.formula('');
    g6f.appendChild(F.g6);
    var g6m = addBlock('g6', '读数', 'LIVE');
    M.g6 = ui.metrics([
      { key: 'cap', label: '总市值' },
      { key: 'ev', label: '企业价值 EV' },
      { key: 'nd', label: '净债务' },
      { key: 'ratio', label: 'EV / 市值' }
    ]);
    g6m.appendChild(M.g6.el);
    var g6n = addBlock('g6', '边界', 'MODEL');
    g6n.appendChild(ui.note('EV 把“买下整个公司”需要承担的债务与可动用的现金算进来，因此适合比较资本结构不同的公司。'));
    g6n.appendChild(ui.note('<b>估值是分析工具，不是必然成交价。</b>'));
    g6n.appendChild(ui.warn('EV 假设债务按账面值、现金可全额抵消；少数股东权益、受限现金、表外负债、周期位置与行业差异都会让比较失真。'));

    var chartGroups = {
      g1: [C.g1a, C.g1b],
      g2: [C.g2a, C.g2b],
      g3: [C.g3a, C.g3b],
      g4: [C.g4a, C.g4b],
      g5: [C.g5a, C.g5b],
      g6: [C.g6a]
    };
    function resizeActive() {
      var list = chartGroups[st.mode] || [];
      list.forEach(function (c) { if (c && c.resize) c.resize(); });
      if (window.requestAnimationFrame) {
        window.requestAnimationFrame(function () {
          list.forEach(function (c) { if (c && c.resize) c.resize(); });
        });
      }
    }

    /* ---------------- reset ---------------- */
    var gr = ui.section(panel, '操作', 'RESET');
    gr.appendChild(ui.reset(function () {
      Object.assign(st, SCENES[st.mode]);
      sync(); render();
    }));

    /* ---------------- sync / render ---------------- */
    function sync() {
      modeSeg.set(st.mode);
      Object.keys(views).forEach(function (k) { views[k].style.display = k === st.mode ? '' : 'none'; });
      Object.keys(blocks).forEach(function (k) {
        blocks[k].forEach(function (g) { g.style.display = k === st.mode ? '' : 'none'; });
      });
      resizeActive();
      s1rev.set(st.revenue, true); s1mar.set(st.margin, true); s1shr.set(st.shares, true);
      s2pe.set(st.pe, true); seg2pe.set(String(st.pe)); s2shr.set(st.g2shares, true);
      s3bv.set(st.bv, true); s3roe.set(st.roe, true); s3dps.set(st.dps, true); s3price.set(st.price, true);
      s4g.set(st.growth, true); s4pe.set(st.fpe, true); s4price.set(st.g4price, true);
      seg5path.set(st.path);
      s5new.set(st.newShares, true); s5price.set(st.issuePrice, true);
      s5pre.set(st.prePrice, true); s5eff.set(st.efficiency, true);
      s6price.set(st.g6price, true); s6shr.set(st.g6shares, true);
      s6debt.set(st.debt, true); s6cash.set(st.cash, true);
    }

    function render() {
      if (st.mode === 'g1') renderG1();
      else if (st.mode === 'g2') renderG2();
      else if (st.mode === 'g3') renderG3();
      else if (st.mode === 'g4') renderG4();
      else if (st.mode === 'g5') renderG5();
      else if (st.mode === 'g6') renderG6();
    }

    function renderG1() {
      var revenue = st.revenue, margin = st.margin, shares = st.shares;
      var profit = revenue * margin / 100;
      var cost = revenue - profit;
      var eps = core.eps(profit, shares);
      var rps = revenue / shares;
      C.g1a.setData({
        labels: ['营收', '成本费用', '净利润'],
        values: [revenue, cost, profit].map(function (v) { return Math.round(v * 10) / 10; }),
        colors: [p.cyan, p.dim, p.orange],
        yFormat: function (v) { return v.toFixed(0) + '亿'; }
      });
      C.g1b.setData({
        labels: ['每股营收', 'EPS'],
        values: [Math.round(rps * 100) / 100, Math.round(eps * 100) / 100],
        colors: [p.blue, p.orange],
        yFormat: function (v) { return '¥' + v.toFixed(2); }
      });
      F.g1.innerHTML =
        '净利润 = 营收 × 净利率 = ' + f(revenue, 1) + ' × ' + pct(margin, 1) + ' = <b>' + f(profit, 2) + ' 亿元</b><br>' +
        'EPS = 净利润 ÷ 总股本 = ' + f(profit, 2) + ' ÷ ' + f(shares, 1) + ' = <b>' + f(eps, 2) + ' 元</b><br>' +
        '每股营收 = ' + f(revenue, 1) + ' ÷ ' + f(shares, 1) + ' = ' + f(rps, 2) + ' 元';
      M.g1.set({
        profit: f(profit, 2) + ' 亿',
        eps: '¥' + f(eps, 2),
        rps: '¥' + f(rps, 2),
        margin: pct(margin, 1)
      }, { eps: 'hi' });
    }

    function renderG2() {
      var profit = st.profit, shares = st.g2shares, pe = st.pe;
      var eps = core.eps(profit, shares);
      var price = pe * eps;
      var cap = profit * pe;
      var pes = [], prices = [], labels = [];
      for (var x = 5; x <= 60; x++) {
        pes.push(x);
        prices.push(Math.round(x * eps * 100) / 100);
        labels.push(x + '×');
      }
      C.g2a.setData({
        labels: labels,
        series: [{ name: '每股价格', values: prices, color: p.cyan, width: 1.8, fmt: function (v) { return '¥' + v.toFixed(2); } }],
        markers: [{ i: Math.round(pe) - 5, value: price, text: 'PE ' + pe + '× → ¥' + f(price, 2), color: p.orange }]
      });
      var preset = [10, 20, 30, 50];
      C.g2b.setData({
        labels: preset.map(function (v) { return v + '×'; }),
        values: preset.map(function (v) { return Math.round(profit * v * 100) / 100; }),
        colors: preset.map(function (v) { return v === pe ? p.cyan : p.blue; })
      });
      E.g2note.innerHTML = '柱高为市值：当前 ' + pe + '× → <b>' + f(cap, 0) + ' 亿</b>。';
      F.g2.innerHTML =
        '市值 = 净利润 × PE = ' + f(profit, 2) + ' 亿 × ' + pe + '× = <b>' + f(cap, 2) + ' 亿元</b><br>' +
        '每股价格 = 市值 ÷ 总股本 = ' + f(cap, 2) + ' ÷ ' + f(shares, 1) + ' = <b>¥' + f(price, 2) + '</b><br>' +
        'EPS = ' + f(profit, 2) + ' ÷ ' + f(shares, 1) + ' = ¥' + f(eps, 3) + '；盈利收益率 = 1 ÷ ' + pe + ' = ' + pct(100 / pe, 2);
      M.g2.set({
        cap: f(cap, 2) + ' 亿',
        price: '¥' + f(price, 2),
        eps: '¥' + f(eps, 3),
        ey: pct(100 / pe, 2)
      }, { cap: 'hi' });
    }

    function renderG3() {
      var shares = st.g3shares, bv = st.bv, price = st.price;
      var profit = bv * st.roe / 100;
      var eps = core.eps(profit, shares);
      var bvps = bv / shares;
      var pe = core.pe(price, eps);
      var pb = core.pb(price, bvps);
      var dy = core.dividendYield(st.dps, price);
      var payout = core.payoutRatio(st.dps, eps);
      var roes = [], labels = [];
      for (var r = 0; r <= 30; r++) { roes.push(r); labels.push(r + '%'); }
      var lines = [10, 20, 30, 50].map(function (mult, i) {
        return {
          name: 'PE ' + mult + '×',
          values: roes.map(function (r2) { return mult * r2 / 100; }),
          color: [p.blue, p.cyan, p.orange, p.violet][i],
          width: 1.3
        };
      });
      var idx = clamp(Math.round(st.roe), 0, roes.length - 1);
      C.g3a.setData({
        labels: labels,
        series: lines,
        markers: [{ i: idx, value: pb, text: 'PB ' + f(pb, 2) + '×', color: p.red }]
      });
      var div = st.dps * shares;
      var retained = profit - div;
      var segs = [{ label: '现金分红', value: Math.max(0, div), color: p.orange, display: f(div, 2) + ' 亿元' }];
      if (retained >= 0) segs.push({ label: '留存收益', value: retained, color: p.blue, display: f(retained, 2) + ' 亿元' });
      else segs.push({ label: '分红缺口', value: -retained, color: p.red, display: f(-retained, 2) + ' 亿元（超过净利润）' });
      C.g3b.setData({ segments: segs, center: { value: pct(dy, 2), label: '股息率' } });
      F.g3.innerHTML =
        '每股净资产 = ' + f(bv, 1) + ' ÷ ' + f(shares, 1) + ' = ' + f(bvps, 2) + ' 元<br>' +
        'EPS = ' + f(profit, 2) + ' ÷ ' + f(shares, 1) + ' = ' + f(eps, 2) + ' 元<br>' +
        'PE = ' + f(price, 2) + ' ÷ ' + f(eps, 2) + ' = ' + f(pe, 2) + '×；PB = ' + f(price, 2) + ' ÷ ' + f(bvps, 2) + ' = ' + f(pb, 2) + '×<br>' +
        '<b>PB = PE × ROE = ' + f(pe, 2) + ' × ' + pct(st.roe, 1) + ' = ' + f(pe * st.roe / 100, 2) + '×</b><br>' +
        '股息率 = ' + f(st.dps, 2) + ' ÷ ' + f(price, 2) + ' = ' + pct(dy, 2) + '；派息率 = ' + pct(payout, 1);
      M.g3.set({
        pb: f(pb, 2) + '×',
        pe: f(pe, 2) + '×',
        dy: pct(dy, 2),
        payout: pct(payout, 1),
        bvps: '¥' + f(bvps, 2),
        roe: pct(st.roe, 1)
      }, { pb: 'hi', dy: 'hi' });
    }

    function renderG4() {
      var shares = st.g4shares;
      var eps0 = st.g4profit / shares;
      var nextEps = eps0 * (1 + st.growth / 100);
      var nextProfit = st.g4profit * (1 + st.growth / 100);
      var fpe = st.g4price > 0 ? st.g4price / nextEps : null;
      var peNow = st.g4price / eps0;
      var value = st.fpe * nextEps;
      var space = value > 0 ? (value / st.g4price - 1) * 100 : null;
      var gs = [], labels = [], vals = [], flat = [];
      for (var g = -20; g <= 50; g += 5) {
        gs.push(g);
        labels.push(g + '%');
        vals.push(st.fpe * eps0 * (1 + g / 100));
        flat.push(st.g4price);
      }
      var gIdx = clamp(Math.round((st.growth + 20) / 5), 0, gs.length - 1);
      C.g4a.setData({
        labels: labels,
        series: [
          { name: '估值线', values: vals, color: p.cyan, width: 1.8, fmt: function (v) { return '¥' + v.toFixed(2); } },
          { name: '当前股价', values: flat, color: p.dim, width: 1.1, dash: [4, 3] }
        ],
        markers: [{ i: gIdx, value: vals[gIdx], text: '¥' + f(vals[gIdx], 2), color: p.orange }]
      });
      C.g4b.setData({
        labels: ['今年净利润', '明年净利润'],
        values: [Math.round(st.g4profit * 10) / 10, Math.round(nextProfit * 10) / 10],
        colors: [p.blue, p.cyan],
        yFormat: function (v) { return v.toFixed(0) + '亿'; }
      });
      F.g4.innerHTML =
        '明年净利润 = ' + f(st.g4profit, 2) + ' × (1 + ' + pct(st.growth, 1) + ') = <b>' + f(nextProfit, 2) + ' 亿元</b><br>' +
        '远期 PE = ' + f(st.g4price, 2) + ' ÷ ' + f(nextEps, 2) + ' = ' + f(fpe, 2) + '×<br>' +
        '估值线价格 = ' + st.fpe + '× × ' + f(nextEps, 2) + ' = <b>¥' + f(value, 2) + '</b><br>' +
        '当前滚动 PE = ' + f(st.g4price, 2) + ' ÷ ' + f(eps0, 2) + ' = ' + f(peNow, 2) + '×';
      M.g4.set({
        nextProfit: f(nextProfit, 2) + ' 亿',
        nextEps: '¥' + f(nextEps, 2),
        fpe: f(fpe, 2) + '×',
        value: '¥' + f(value, 2),
        space: pct(space, 1),
        pe: f(peNow, 2) + '×'
      }, { fpe: 'hi', value: 'hi', space: space >= 0 ? 'pos' : 'neg' });
    }

    function renderG5() {
      var iss = core.issuance({
        preShares: st.preShares, newShares: st.newShares, price: st.issuePrice,
        prePrice: st.prePrice, profit: st.g5profit
      });
      var postPrice = iss.postShares ? (st.preShares * st.prePrice + iss.proceeds * st.efficiency) / iss.postShares : st.prePrice;
      var stake = st.preShares / iss.postShares * 100;
      C.g5a.setData({
        labels: ['EPS 前', 'EPS 后'],
        values: [Math.round(iss.epsBefore * 100) / 100, Math.round(iss.epsAfter * 100) / 100],
        colors: [p.blue, p.orange],
        yFormat: function (v) { return '¥' + v.toFixed(2); }
      });
      C.g5b.setData({
        segments: [
          { label: '原股东', value: st.preShares, color: p.cyan, display: f(st.preShares, 1) + ' 亿股' },
          { label: '新股东', value: st.newShares, color: p.orange, display: f(st.newShares, 1) + ' 亿股' }
        ],
        center: { value: pct(iss.dilutionPct, 1), label: '新股占比' }
      });
      F.g5.innerHTML =
        '发行后总股本 = ' + f(st.preShares, 1) + ' + ' + f(st.newShares, 1) + ' = <b>' + f(iss.postShares, 1) + ' 亿股</b><br>' +
        'EPS：' + f(iss.epsBefore, 2) + ' → ' + f(iss.epsAfter, 2) + ' 元<br>' +
        '发行后股价 = (' + f(iss.preValue, 1) + ' + ' + f(iss.proceeds, 1) + ' × ' + f(st.efficiency, 1) + ') ÷ ' + f(iss.postShares, 1) + ' = <b>¥' + f(postPrice, 2) + '</b><br>' +
        '原股东占比 = ' + f(st.preShares, 1) + ' ÷ ' + f(iss.postShares, 1) + ' = ' + pct(stake, 1);
      M.g5.set({
        eps0: '¥' + f(iss.epsBefore, 2),
        eps1: '¥' + f(iss.epsAfter, 2),
        price1: '¥' + f(postPrice, 2),
        stake: pct(stake, 1),
        proceeds: f(iss.proceeds, 2) + ' 亿',
        dilute: pct(iss.dilutionPct, 1)
      }, { eps1: 'neg', price1: postPrice < st.prePrice ? 'neg' : 'pos' });
    }

    function renderG6() {
      var cap = st.g6price * st.g6shares;
      var ev = core.enterpriseValue(cap, st.debt, st.cash);
      var nd = st.debt - st.cash;
      var bEv = cap + 30 - 5;
      C.g6a.setData({
        labels: ['A 市值', 'A EV', 'B 市值', 'B EV'],
        values: [cap, ev, cap, bEv].map(function (v) { return Math.round(v * 10) / 10; }),
        colors: [p.dim, p.cyan, p.dim, p.orange]
      });
      ui.clear(E.g6stack);
      function seg(val, color, label) {
        var d = ui.el('div');
        d.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:9.5px;font-family:var(--mono);color:var(--panel);overflow:hidden;white-space:nowrap';
        d.style.background = color;
        d.style.width = val + '%';
        if (val > 9) d.textContent = label;
        d.title = label;
        E.g6stack.appendChild(d);
      }
      ui.clear(E.g6legend);
      if (nd >= 0) {
        var total = Math.max(cap + nd, 1);
        seg(cap / total * 100, p.cyan, '市值');
        seg(nd / total * 100, p.orange, nd > 1 ? '净债务' : '');
        E.g6caption.innerHTML = 'EV = 市值 ' + f(cap, 2) + ' + 净债务 ' + f(nd, 2) +
          '（债务 ' + f(st.debt, 2) + ' − 现金 ' + f(st.cash, 2) + '）= <b>' + f(ev, 2) + ' 亿元</b>';
        E.g6legend.appendChild(ui.legend([
          { label: '市值', color: p.cyan }, { label: '净债务（债务−现金）', color: p.orange }
        ]));
      } else if (ev > 0) {
        var total2 = Math.max(cap, 1);
        seg(ev / total2 * 100, p.cyan, '企业价值');
        seg((cap - ev) / total2 * 100, p.green, '净现金');
        E.g6caption.innerHTML = '市值 ' + f(cap, 2) + ' = EV ' + f(ev, 2) + ' + 净现金 ' + f(-nd, 2) +
          '（现金 ' + f(st.cash, 2) + ' − 债务 ' + f(st.debt, 2) + '），即 <b>EV = 市值 − 净现金</b>';
        E.g6legend.appendChild(ui.legend([
          { label: '企业价值', color: p.cyan }, { label: '净现金（现金−债务）', color: p.green }
        ]));
      } else {
        seg(100, p.green, '净现金超过市值');
        E.g6caption.innerHTML = '净现金 ' + f(-nd, 2) + ' 已超过市值 ' + f(cap, 2) +
          '，EV = 市值 − 净现金 = <b>' + f(ev, 2) + ' 亿元</b>（极端情形，柱高无法按比例表示）。';
        E.g6legend.appendChild(ui.legend([
          { label: '净现金（现金−债务）', color: p.green }
        ]));
      }
      E.g6big.innerHTML = f(ev, 2) + ' <span style="font-size:11px;color:var(--dim)">亿元 · 企业价值</span>';
      E.g6table.innerHTML = '';
      E.g6table.appendChild(ui.table(['项目', '金额（亿元）', '说明'], [
        ['市值', f(cap, 2), '股价 × 总股本 = ' + f(st.g6shares, 1) + ' 亿股'],
        ['+ 债务', f(st.debt, 2), '有息负债按账面值简化'],
        ['− 现金', f(st.cash, 2), '假设可全额抵消'],
        ['= EV', f(ev, 2), '买下整个公司的近似成本']
      ]));
      F.g6.innerHTML =
        '市值 = ' + f(st.g6price, 2) + ' × ' + f(st.g6shares, 1) + ' = <b>' + f(cap, 2) + ' 亿元</b><br>' +
        'EV = 市值 + 债务 − 现金 = ' + f(cap, 2) + ' + ' + f(st.debt, 2) + ' − ' + f(st.cash, 2) + ' = <b>' + f(ev, 2) + ' 亿元</b><br>' +
        '净债务 = ' + f(nd, 2) + ' 亿元；EV ÷ 市值 = ' + f(cap ? ev / cap : 0, 2) + '×';
      M.g6.set({
        cap: f(cap, 2) + ' 亿',
        ev: f(ev, 2) + ' 亿',
        nd: f(nd, 2) + ' 亿',
        ratio: f(cap ? ev / cap : 0, 2) + '×'
      }, { ev: 'hi' });
    }

    function apply(patch) {
      if (typeof patch === 'function') patch = patch(st);
      Object.assign(st, patch || {});
      if (patch && patch.mode) st.mode = patch.mode;
      sync(); render();
    }

    sync(); render();
    return {
      apply: apply,
      destroy: function () {
        [C.g1a, C.g1b, C.g2a, C.g2b, C.g3a, C.g3b, C.g4a, C.g4b, C.g5a, C.g5b, C.g6a].forEach(function (c) {
          if (c && c.destroy) c.destroy();
        });
      }
    };
  }

  SM.registerModule({
    id: 'G', slug: 'valuation', order: 7,
    title: '估值与基本面', en: 'VALUATION',
    subtitle: '利润、倍数、净资产与增长：把价格拆成可以讨论的假设',
    hint: '拖动参数，先看公式里的数字，再读图；所有倍数与增长率都是教学假设，不是预测。',
    scenes: [
      {
        title: '利润表怎样变成 EPS',
        body: '净利润 = 营业收入 × 净利率，再除以总股本就是每股收益。<br>拖动营收、净利率与股本：左边拆利润，右边把利润分到每一股。<br><b>EPS</b> 是每股对应的盈利，不是股价。',
        patch: SCENES.g1,
        guide: '把净利率降到 5%：净利润与 EPS 是否同比例下降？',
        duration: 15000
      },
      {
        title: 'PE：市场愿意付几倍利润',
        body: '市值 = 净利润 × PE；每股价格再把市值分到总股本上。<br>点击 10× / 20× / 30× / 50×，看同样的 1 亿元利润如何得到完全不同的定价。<br>PE 不是回本年限，它包含增长、风险与利率环境。',
        patch: SCENES.g2,
        guide: '把 PE 从 20× 调到 50×：市值与每股价格各变化多少？',
        duration: 15000
      },
      {
        title: 'PB、ROE 与股息率',
        body: 'PB 比较股价与每股净资产，ROE 衡量净资产创造利润的效率。<br>三者满足 <b>PB = PE × ROE</b>；股息率则取决于分红政策与股价。<br>调整 ROE 与股价，观察 PB 如何移动。',
        patch: SCENES.g3,
        guide: '固定股价，把 ROE 从 15% 调到 8%：PE 与 PB 怎样变化？',
        duration: 16000
      },
      {
        title: '增长预期与远期估值',
        body: '把明年的预期利润代入 PE，就得到一条随增长率移动的估值线。<br>远期 PE = 当前股价 ÷ 明年 EPS，反映市场已经提前定价了多少增长。<br>增长率是假设，不是预测；风险溢价变化也会改变合理倍数。',
        patch: SCENES.g4,
        guide: '把增长率调到 0：远期 PE 与当前 PE 还有区别吗？',
        duration: 16000
      },
      {
        title: '增发与稀释',
        body: '增发或期权行权增加总股本，EPS 被摊薄。<br>股价是否下跌，取决于发行价与募资能否创造相应价值：低于市价发行、资金闲置或低效投入都会伤害原股东。<br>同时关注 <b>EPS、持股比例与资金用途</b>。',
        patch: SCENES.g5,
        guide: '把发行价从 18 元调到 20 元：发行后股价与折价损失如何变化？',
        duration: 16000
      },
      {
        title: '市值之外：企业价值 EV',
        body: 'EV = 市值 + 债务 − 现金，把资本结构差异还原掉。<br>同样市值的两家公司，负债多的那家 EV 更高，收购成本也更贵。<br>EV 常用于跨公司比较；<b>估值是分析工具，不是必然成交价</b>。',
        patch: SCENES.g6,
        guide: '把债务加到 60 亿：A 的市值变了吗？EV 呢？',
        duration: 15000
      }
    ],
    quiz: [
      {
        q: '某公司净利润 10 亿元，总股本 5 亿股，EPS 是多少？',
        options: ['0.5 元', '2 元', '5 元', '50 元'],
        answer: 1,
        explain: 'EPS = 净利润 ÷ 总股本 = 10 ÷ 5 = <b>2 元/股</b>。它描述每股对应的利润，不是股价。'
      },
      {
        q: '某公司 PE 为 20×，ROE 为 15%，PB 最接近下列哪一个？',
        options: ['0.75×', '1.33×', '3×', '35×'],
        answer: 2,
        explain: 'PB = PE × ROE = 20 × 15% = <b>3×</b>。这个恒等式来自 PE = 股价/EPS 与 ROE = EPS/每股净资产。'
      },
      {
        q: '公司以低于市价增发新股，募资全部投入且使用效率为 1。以下哪项最准确？',
        options: [
          'EPS 不变，股价也不变',
          'EPS 下降；因发行价低于市价，老股东每股价值被摊薄',
          'EPS 上升，因为公司拿到了现金',
          '只要募资效率为 1，老股东就不会受损'
        ],
        answer: 1,
        explain: '总股本增加使 EPS 下降；发行价低于市价意味着新股东以折扣取得股份，老股东的每股价值被摊薄——即使募资全部有效使用。'
      }
    ],
    mount: mount
  });
})();
