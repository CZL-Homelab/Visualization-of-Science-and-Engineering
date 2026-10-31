/* Module H — 收益与杠杆：仓位、三档杠杆、利息、强平、情景、跳空与风险总结。 */
(function () {
  'use strict';
  var SM = window.SM;
  var ui = SM.ui, core = SM.core, charts = SM.charts, sim = SM.sim;

  var LEV3 = [1, 1.5, 2];
  var LEV5 = [1, 1.5, 2, 2.5, 3];

  var SCENES = {
    h1: { mode: 'h1', capitalW: 10, buyPrice: 10, price: 10.5, shares: 6000, cashPct: 40 },
    h2: { mode: 'h2', capitalW: 10, rate: 6, days: 30, priceMove: 20, h2buy: 10, maintenance: 130 },
    h3: { mode: 'h3', capitalW: 10, rate: 6, days: 30, h3buy: 10 },
    h4: { mode: 'h4', capitalW: 10, rate: 6, days: 0, maintenance: 130, h4price: 7.5, h4buy: 10 },
    h5: { mode: 'h5', capitalW: 10, rate: 6, maintenance: 130, scenario: 'slowDown' },
    h6: { mode: 'h6', capitalW: 10, maintenance: 130, gapPct: 15, limitDown: false, h6buy: 10, prevClose: 7.2 },
    h7: { mode: 'h7', capitalW: 10, maintenance: 130, h7buy: 10 }
  };
  var DEFAULT = Object.assign({ mode: 'h1' }, SCENES.h1, SCENES.h2, SCENES.h3, SCENES.h4, SCENES.h5, SCENES.h6, SCENES.h7);
  DEFAULT.mode = 'h1';

  function f(v, d) { return ui.fmt.num(v, d == null ? 2 : d); }
  function pct(v, d) { return ui.fmt.num(v, d == null ? 1 : d) + '%'; }
  function wan(v) { return v == null || !isFinite(v) ? '—' : f(v / 1e4, 2) + '万'; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function r2(v) { return Math.round(v * 100) / 100; }

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var p = charts.palette();
    var cn = charts.colorsFor('cn', p);
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
    function tableWrap(node) {
      var w = ui.el('div');
      w.style.cssText = 'overflow:auto;min-height:0';
      w.appendChild(node);
      return w;
    }
    function legendFor(list) {
      return ui.legend(list.map(function (x) { return { label: x[0], color: x[1] }; }));
    }

    /* ---------------- mode switcher ---------------- */
    var gMode = ui.section(panel, '场景切换', 'H · 7 SCENES');
    var modeSeg = ui.seg({
      options: [
        { value: 'h1', label: '仓位' },
        { value: 'h2', label: '杠杆对比' },
        { value: 'h3', label: '利息成本' },
        { value: 'h4', label: '强平机制' },
        { value: 'h5', label: '情景模拟' },
        { value: 'h6', label: '跳空滑点' },
        { value: 'h7', label: '风险总结' }
      ],
      value: 'h1',
      onChange: function (v) { st.mode = v; sync(); render(); }
    });
    gMode.appendChild(modeSeg.el);

    /* =====================================================
     *  H1 — 仓位与资产构成
     * ===================================================== */
    var v1 = makeView('h1');
    E.h1legend = legendFor([['总资产', p.cyan], ['持股市值', p.blue], ['现金', p.dim]]);
    C.h1left = fill(v1, '总资产 = 现金 + 持股数 × 股价；虚线为现金，圆点为当前价', E.h1legend);
    C.h1right = fill(v1, '资产构成（按当前价计）');
    C.h1a = charts.lines(C.h1left, {
      series: [], labels: [], zero: false,
      yFormat: function (v) { return (v / 1e4).toFixed(1) + '万'; }, label: '总资产、持股市值与现金随股价变化'
    });
    C.h1b = charts.donut(C.h1right, { segments: [], center: { value: '—', label: '仓位' }, label: '现金与持股市值构成' });

    var h1c = addBlock('h1', 'H1 · 仓位', 'CASH & POSITION');
    var s1cap = ui.slider({
      label: '初始资金', min: 2, max: 50, step: 1, value: 10, unit: '万元',
      onInput: function (v) { st.capitalW = v; sync(); render(); }
    });
    var s1cash = ui.slider({
      label: '现金比例', min: 0, max: 100, step: 1, value: 40, unit: '%',
      hint: '买入后剩余的现金占总资金的比例；按 100 股整手取整。',
      onInput: function (v) {
        var capital = st.capitalW * 1e4;
        var budget = capital * (1 - v / 100);
        st.shares = Math.floor(budget / st.buyPrice / 100) * 100;
        sync(); render();
      }
    });
    var s1buy = ui.slider({
      label: '买入价', min: 5, max: 20, step: 0.5, value: 10, unit: '元',
      onInput: function (v) { st.buyPrice = v; sync(); render(); }
    });
    var s1shares = ui.slider({
      label: '持股数', min: 0, max: 10000, step: 100, value: 6000, unit: '股',
      onInput: function (v) { st.shares = v; sync(); render(); }
    });
    var s1price = ui.slider({
      label: '当前股价', min: 4, max: 16, step: 0.1, value: 10.5, unit: '元',
      onInput: function (v) { st.price = v; sync(); render(); }
    });
    h1c.appendChild(s1cap.el); h1c.appendChild(s1cash.el); h1c.appendChild(s1buy.el);
    h1c.appendChild(s1shares.el); h1c.appendChild(s1price.el);
    var h1f = addBlock('h1', '公式', 'FORMULA');
    F.h1 = ui.formula('');
    h1f.appendChild(F.h1);
    var h1m = addBlock('h1', '读数', 'LIVE');
    M.h1 = ui.metrics([
      { key: 'total', label: '总资产' },
      { key: 'cash', label: '现金' },
      { key: 'mv', label: '持股市值' },
      { key: 'pos', label: '仓位' },
      { key: 'shares', label: '持股数' },
      { key: 'pnl', label: '浮动盈亏' }
    ]);
    h1m.appendChild(M.h1.el);
    var h1n = addBlock('h1', '边界', 'MODEL');
    h1n.appendChild(ui.note('仓位 = 持股市值 ÷ 总资产；股价变化会改变仓位，即使你不交易。'));
    h1n.appendChild(ui.warn('未计佣金、印花税与滑点；A 股买入按 100 股整手简化。现金不计利息。'));

    /* =====================================================
     *  H2 — 三档杠杆对比
     * ===================================================== */
    var v2 = makeView('h2');
    E.h2warn = ui.warn('');
    E.h2warn.style.display = 'none';
    E.h2legend = legendFor([['1×', p.cyan], ['1.5×', p.blue], ['2×', p.orange], ['本金', p.dim]]);
    var h2top = ui.el('div');
    h2top.appendChild(E.h2legend);
    h2top.appendChild(E.h2warn);
    C.h2left = fill(v2, '单位：元 · 同一笔本金、同一价格变动下的净资产；本金为虚线', h2top);
    C.h2right = ui.el('div', 'fill');
    C.h2right.style.flex = '1';
    C.h2right.appendChild(ui.note('账户对比 · 金额单位：万元；担保比例 < 1.30 触发强平'));
    E.h2table = ui.el('div');
    E.h2table.style.cssText = 'margin-top:2px;overflow:auto;min-height:0';
    C.h2right.appendChild(E.h2table);
    v2.appendChild(C.h2right);
    C.h2a = charts.lines(C.h2left, {
      series: [], labels: [], zero: false,
      yFormat: function (v) { return (v / 1e4).toFixed(1) + '万'; }, label: '三档杠杆净资产随股价变动'
    });

    var h2c = addBlock('h2', 'H2 · 杠杆对比', '1× / 1.5× / 2×');
    var s2cap = ui.slider({
      label: '本金', min: 5, max: 50, step: 1, value: 10, unit: '万元',
      onInput: function (v) { st.capitalW = v; sync(); render(); }
    });
    var s2rate = ui.slider({
      label: '融资年利率', min: 0, max: 12, step: 0.1, value: 6, unit: '%',
      hint: '示例区间；实际利率由券商与账户资质决定。',
      onInput: function (v) { st.rate = v; sync(); render(); }
    });
    var s2days = ui.slider({
      label: '持有天数', min: 0, max: 180, step: 1, value: 30, unit: '天',
      onInput: function (v) { st.days = v; sync(); render(); }
    });
    var s2move = ui.slider({
      label: '股价变动', min: -60, max: 60, step: 1, value: 0, unit: '%',
      hint: '买入价固定 10.00 元；区间相当于 4.00–16.00 元。',
      onInput: function (v) { st.priceMove = v; sync(); render(); }
    });
    h2c.appendChild(s2cap.el); h2c.appendChild(s2rate.el); h2c.appendChild(s2days.el); h2c.appendChild(s2move.el);
    var h2f = addBlock('h2', '公式', 'FORMULA');
    F.h2 = ui.formula('');
    h2f.appendChild(F.h2);
    var h2m = addBlock('h2', '读数', 'LIVE');
    M.h2 = ui.metrics([
      { key: 'n1', label: '净资产 1×' },
      { key: 'n15', label: '净资产 1.5×' },
      { key: 'n2', label: '净资产 2×' },
      { key: 'r2', label: '本金收益率 2×' },
      { key: 'i2', label: '利息 2×' },
      { key: 'l2', label: '强平价 2×' }
    ]);
    h2m.appendChild(M.h2.el);
    var h2n = addBlock('h2', '边界', 'MODEL');
    h2n.appendChild(ui.note('三档账户使用同样的买入价与持有期；杠杆越高，借款越多，利息与强平风险都越大。'));
    h2n.appendChild(ui.note('曲线越过强平价后仍按公式延伸，只用于展示放大效应；现实中账户已被平仓，不会继续按该价格持有。'));
    h2n.appendChild(ui.warn('融资额度、保证金比例、利率与强平条件由券商和账户决定；本页用示例参数演示机制，不构成建议。'));

    /* =====================================================
     *  H3 — 利息成本与保本价
     * ===================================================== */
    var v3 = makeView('h3');
    E.h3llegend = legendFor([['1×', p.cyan], ['1.5×', p.blue], ['2×', p.orange]]);
    E.h3rlegend = legendFor([['1.5× 利息', p.blue], ['2× 利息', p.orange]]);
    C.h3left = fill(v3, '单位：元 · 不同杠杆下的净资产（持有期末）', E.h3llegend);
    C.h3right = fill(v3, '单位：元 · 利息随持有天数累积（1.5× 与 2×）', E.h3rlegend);
    C.h3a = charts.lines(C.h3left, {
      series: [], labels: [], zero: false,
      yFormat: function (v) { return (v / 1e4).toFixed(1) + '万'; }, label: '不同杠杆的净资产曲线'
    });
    C.h3b = charts.lines(C.h3right, {
      series: [], labels: [], zero: false,
      yFormat: function (v) { return v < 0 ? '' : v.toFixed(0) + '元'; }, label: '利息随持有天数变化'
    });

    var h3c = addBlock('h3', 'H3 · 利息', 'CARRY & BREAK-EVEN');
    var s3cap = ui.slider({
      label: '本金', min: 5, max: 50, step: 1, value: 10, unit: '万元',
      onInput: function (v) { st.capitalW = v; sync(); render(); }
    });
    var s3rate = ui.slider({
      label: '融资年利率', min: 0, max: 12, step: 0.1, value: 6, unit: '%',
      onInput: function (v) { st.rate = v; sync(); render(); }
    });
    var s3days = ui.slider({
      label: '持有天数', min: 0, max: 180, step: 1, value: 30, unit: '天',
      onInput: function (v) { st.days = v; sync(); render(); }
    });
    h3c.appendChild(s3cap.el); h3c.appendChild(s3rate.el); h3c.appendChild(s3days.el);
    var h3f = addBlock('h3', '公式', 'FORMULA');
    F.h3 = ui.formula('');
    h3f.appendChild(F.h3);
    var h3m = addBlock('h3', '读数', 'LIVE');
    M.h3 = ui.metrics([
      { key: 'i15', label: '利息 1.5×' },
      { key: 'i2', label: '利息 2×' },
      { key: 'b15', label: '保本价 1.5×' },
      { key: 'b2', label: '保本价 2×' },
      { key: 'r20', label: '跌 20% 时收益率 2×' },
      { key: 'liq2', label: '强平价 2×' }
    ]);
    h3m.appendChild(M.h3.el);
    var h3n = addBlock('h3', '边界', 'MODEL');
    h3n.appendChild(ui.note('利息让保本价高于买入价；持有越久，门槛越高。杠杆同时放大盈利与亏损。'));
    h3n.appendChild(ui.warn('按单利、全年 365 天简化。实际融资利息可能按占用天数、分段利率或复利计算，并可能有最低收费。'));

    /* =====================================================
     *  H4 — 强平机制
     * ===================================================== */
    var v4 = makeView('h4');
    E.h4warn = ui.warn('');
    E.h4warn.style.display = 'none';
    E.h4legend = legendFor([['1.5×', p.blue], ['2×', p.orange], ['强平阈值', p.red]]);
    var h4top = ui.el('div');
    h4top.appendChild(E.h4legend);
    h4top.appendChild(E.h4warn);
    C.h4left = fill(v4, '维持担保比例 = 总资产 ÷ 债务；红色虚线为强平阈值', h4top);
    C.h4right = ui.el('div', 'fill');
    C.h4right.style.flex = '1';
    C.h4right.appendChild(ui.note('强平价与距离 · 不计新增资金与盘中执行差异'));
    E.h4table = ui.el('div');
    E.h4table.style.cssText = 'margin-top:2px;overflow:auto;min-height:0';
    C.h4right.appendChild(E.h4table);
    v4.appendChild(C.h4right);
    C.h4a = charts.lines(C.h4left, {
      series: [], labels: [], zero: false,
      bands: [{ from: 0, to: 1.3, color: 'rgba(224,90,95,.08)' }],
      yFormat: function (v) { return v.toFixed(2) + '×'; }, label: '担保比例与强平阈值'
    });

    var h4c = addBlock('h4', 'H4 · 强平', 'MAINTENANCE RATIO');
    var s4cap = ui.slider({
      label: '本金', min: 5, max: 50, step: 1, value: 10, unit: '万元',
      onInput: function (v) { st.capitalW = v; sync(); render(); }
    });
    var s4ratio = ui.slider({
      label: '维持担保比例', min: 110, max: 200, step: 5, value: 130, unit: '%',
      hint: '示例阈值；券商可能设预警线与平仓线两档。',
      onInput: function (v) { st.maintenance = v; sync(); render(); }
    });
    var s4days = ui.slider({
      label: '持有天数', min: 0, max: 180, step: 1, value: 0, unit: '天',
      onInput: function (v) { st.days = v; sync(); render(); }
    });
    var s4price = ui.slider({
      label: '当前股价', min: 4, max: 12, step: 0.25, value: 7.5, unit: '元',
      hint: '买入价 10.00 元；把价格拖到强平价下方观察强制平仓。',
      onInput: function (v) { st.h4price = v; sync(); render(); }
    });
    h4c.appendChild(s4cap.el); h4c.appendChild(s4ratio.el); h4c.appendChild(s4days.el); h4c.appendChild(s4price.el);
    var h4f = addBlock('h4', '公式', 'FORMULA');
    F.h4 = ui.formula('');
    h4f.appendChild(F.h4);
    var h4m = addBlock('h4', '读数', 'LIVE');
    M.h4 = ui.metrics([
      { key: 'l15', label: '强平价 1.5×' },
      { key: 'l2', label: '强平价 2×' },
      { key: 'r2', label: '担保比例 2×' },
      { key: 'm', label: '维持担保比例' },
      { key: 'assets2', label: '总资产 2×' },
      { key: 'debt2', label: '债务 2×' }
    ]);
    h4m.appendChild(M.h4.el);
    var h4n = addBlock('h4', '边界', 'MODEL');
    h4n.appendChild(ui.note('价格触及强平价后，券商可能先通知追加保证金，再执行平仓；不同券商的通知方式、执行时点与费用不同。'));
    h4n.appendChild(ui.warn('本页把强平简化为“担保比例低于阈值即按当价成交”。现实中有预警线、平仓线、T+1 冻结、集中撮合与滑点，规则由券商和账户合同决定。'));

    /* =====================================================
     *  H5 — 情景模拟
     * ===================================================== */
    var v5 = makeView('h5');
    var l5 = ui.el('div');
    l5.style.cssText = 'display:flex;flex-direction:column;gap:8px;min-height:0';
    var f5a = ui.el('div', 'fill');
    f5a.style.flex = '1.55';
    f5a.appendChild(ui.note('净资产曲线（元）· 初始本金 10 万元；标记处为强平'));
    f5a.appendChild(legendFor([['1×', p.cyan], ['1.5×', p.blue], ['2×', p.orange]]));
    var eqHost = ui.el('div', 'chart');
    eqHost.style.flex = '1';
    f5a.appendChild(eqHost);
    var f5b = ui.el('div', 'fill');
    f5b.style.flex = '1';
    f5b.appendChild(ui.note('价格路径（元）· 固定随机种子，可复现'));
    var pathHost = ui.el('div', 'chart');
    pathHost.style.flex = '1';
    f5b.appendChild(pathHost);
    l5.appendChild(f5a); l5.appendChild(f5b);
    v5.appendChild(l5);
    var right5 = ui.el('div', 'fill');
    right5.style.flex = '1';
    right5.appendChild(ui.note('强平事件日志'));
    E.h5log = ui.el('div');
    E.h5log.style.cssText = 'overflow:auto;min-height:110px;flex:1;margin-top:8px';
    right5.appendChild(E.h5log);
    E.h5sum = ui.note('');
    right5.appendChild(E.h5sum);
    v5.appendChild(right5);
    C.h5eq = charts.lines(eqHost, {
      series: [], labels: [], zero: false,
      yFormat: function (v) { return (v / 1e4).toFixed(1) + '万'; }, label: '三档杠杆的净资产曲线'
    });
    C.h5price = charts.lines(pathHost, {
      series: [], labels: [], zero: false,
      yFormat: function (v) { return v.toFixed(1); }, label: '模拟价格路径'
    });

    var h5c = addBlock('h5', 'H5 · 情景模拟', 'SIMULATED PATHS');
    var seg5 = ui.seg({
      label: '模拟情景',
      options: [
        { value: 'slowUp', label: '缓慢上涨' },
        { value: 'slowDown', label: '缓慢下跌' },
        { value: 'violent', label: '暴涨暴跌' },
        { value: 'gapDown', label: '跳空低开' },
        { value: 'illiquid', label: '流动性不足' },
        { value: 'limitDown', label: '连续跌停' }
      ],
      value: 'slowDown',
      onChange: function (v) { st.scenario = v; render(); }
    });
    var s5cap = ui.slider({
      label: '本金', min: 5, max: 50, step: 1, value: 10, unit: '万元',
      onInput: function (v) { st.capitalW = v; sync(); render(); }
    });
    var s5rate = ui.slider({
      label: '融资年利率', min: 0, max: 12, step: 0.1, value: 6, unit: '%',
      onInput: function (v) { st.rate = v; sync(); render(); }
    });
    var s5ratio = ui.slider({
      label: '维持担保比例', min: 110, max: 200, step: 5, value: 130, unit: '%',
      onInput: function (v) { st.maintenance = v; sync(); render(); }
    });
    h5c.appendChild(seg5.el); h5c.appendChild(s5cap.el); h5c.appendChild(s5rate.el); h5c.appendChild(s5ratio.el);
    var h5f = addBlock('h5', '公式', 'FORMULA');
    F.h5 = ui.formula('');
    h5f.appendChild(F.h5);
    var h5m = addBlock('h5', '读数', 'LIVE');
    M.h5 = ui.metrics([
      { key: 'e1', label: '期末权益 1×' },
      { key: 'e15', label: '期末权益 1.5×' },
      { key: 'e2', label: '期末权益 2×' },
      { key: 'l15', label: '强平触发 1.5×' },
      { key: 'l2', label: '强平触发 2×' },
      { key: 'last', label: '路径末价' }
    ]);
    h5m.appendChild(M.h5.el);
    var h5n = addBlock('h5', '边界', 'MODEL');
    h5n.appendChild(ui.note('<b>SIMULATED</b> · 固定随机种子，路径可复现；六种情景是规则化示例，不是预测。'));
    h5n.appendChild(ui.warn('强平按当日收盘价成交，未模拟盘中路径、停牌、跌停封单、部分成交与券商执行延迟；真实结果可能更差。'));

    /* =====================================================
     *  H6 — 跳空与滑点
     * ===================================================== */
    var v6 = makeView('h6');
    C.h6left = fill(v6, '单位：元 · 前收盘、理论强平价与实际成交价');
    C.h6right = fill(v6, '单位：元 · 理论亏损与实际亏损');
    C.h6a = charts.bars(C.h6left, {
      labels: [], values: [], yFormat: function (v) { return '¥' + v.toFixed(2); },
      label: '跳空时的成交价格'
    });
    C.h6b = charts.bars(C.h6right, {
      labels: [], values: [], yFormat: function (v) { return (v / 1e4).toFixed(1) + '万'; },
      label: '理论亏损与实际亏损'
    });

    var h6c = addBlock('h6', 'H6 · 跳空', 'GAP & SLIPPAGE');
    var s6gap = ui.slider({
      label: '跳空低开幅度', min: 0, max: 30, step: 1, value: 15, unit: '%',
      hint: '前收盘 7.20 元；2× 账户的理论强平价约 6.50 元。',
      onInput: function (v) { st.gapPct = v; sync(); render(); }
    });
    var c6limit = ui.check({
      label: '跌停封死，次日才能卖出（按再跌 10% 简化）',
      checked: false,
      onChange: function (v) { st.limitDown = v; sync(); render(); }
    });
    h6c.appendChild(s6gap.el); h6c.appendChild(c6limit.el);
    var h6f = addBlock('h6', '公式', 'FORMULA');
    F.h6 = ui.formula('');
    h6f.appendChild(F.h6);
    var h6m = addBlock('h6', '读数', 'LIVE');
    M.h6 = ui.metrics([
      { key: 'exec', label: '实际成交价' },
      { key: 'liq', label: '理论强平价' },
      { key: 'loss', label: '实际亏损' },
      { key: 'lp', label: '实际亏损率' },
      { key: 'tloss', label: '理论亏损' },
      { key: 'gap', label: '缺口损失' }
    ]);
    h6m.appendChild(M.h6.el);
    E.h6note = ui.note('');
    var h6n = addBlock('h6', '边界', 'MODEL');
    h6n.appendChild(E.h6note);
    h6n.appendChild(ui.note('跌停封死时，卖单可能完全无法成交；本页把“无法卖出”简化为次日再跌一个跌停。'));
    h6n.appendChild(ui.warn('实际成交价受集合竞价、盘口深度、停牌与券商风控执行影响；维持担保比例、平仓线与处理方式由券商和账户合同决定。'));

    /* =====================================================
     *  H7 — 风险总结
     * ===================================================== */
    var v7 = makeView('h7');
    var left7 = ui.el('div', 'fill');
    left7.style.flex = '1';
    left7.appendChild(ui.note('假设买入价 10.00 元、无利息、维持担保比例 130%；价格跌幅按整数简化'));
    E.h7table = ui.el('div');
    E.h7table.style.cssText = 'margin-top:4px;overflow:auto;min-height:0';
    left7.appendChild(E.h7table);
    left7.appendChild(ui.note('“强平距离”= 1 − 强平价 ÷ 买入价；杠杆越高，距离越短。1× 无负债，没有强平价与强平距离。'));
    v7.appendChild(left7);
    C.h7right = fill(v7, '股价下跌 20% 时的本金收益率（%）');
    C.h7a = charts.bars(C.h7right, {
      labels: [], values: [], yFormat: function (v) { return v.toFixed(0) + '%'; },
      label: '不同杠杆在股价下跌 20% 时的本金收益率'
    });

    var h7c = addBlock('h7', 'H7 · 风险', 'LEVERAGE RISK');
    var s7cap = ui.slider({
      label: '本金', min: 5, max: 50, step: 1, value: 10, unit: '万元',
      onInput: function (v) { st.capitalW = v; sync(); render(); }
    });
    var s7ratio = ui.slider({
      label: '维持担保比例', min: 110, max: 200, step: 5, value: 130, unit: '%',
      onInput: function (v) { st.maintenance = v; sync(); render(); }
    });
    h7c.appendChild(s7cap.el); h7c.appendChild(s7ratio.el);
    var h7f = addBlock('h7', '公式', 'FORMULA');
    F.h7 = ui.formula('');
    h7f.appendChild(F.h7);
    var h7m = addBlock('h7', '读数', 'LIVE');
    M.h7 = ui.metrics([
      { key: 'd2', label: '强平距离 2×' },
      { key: 'd3', label: '强平距离 3×' },
      { key: 'r2', label: '跌 10% 时 2×' },
      { key: 'r3', label: '跌 10% 时 3×' }
    ]);
    h7m.appendChild(M.h7.el);
    var h7n = addBlock('h7', '边界', 'MODEL');
    h7n.appendChild(ui.warn('融资额度、维持担保比例、利息与强平条件由券商和账户决定，本页是可配置教学模型，不构成建议。'));
    h7n.appendChild(ui.note('历史波动不能保证未来路径；杠杆的风险来自“被迫在低点卖出”，而不只是账面波动。'));

    var chartGroups = {
      h1: [C.h1a, C.h1b],
      h2: [C.h2a],
      h3: [C.h3a, C.h3b],
      h4: [C.h4a],
      h5: [C.h5eq, C.h5price],
      h6: [C.h6a, C.h6b],
      h7: [C.h7a]
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

    /* ---------------- sync ---------------- */
    function h1calc() {
      var capital = st.capitalW * 1e4;
      var maxShares = Math.floor(capital / st.buyPrice / 100) * 100;
      st.shares = clamp(Math.round(st.shares / 100) * 100, 0, maxShares);
      var cash = capital - st.shares * st.buyPrice;
      st.cashPct = capital > 0 ? cash / capital * 100 : 0;
      st.price = clamp(st.price, st.buyPrice * 0.4, st.buyPrice * 1.6);
      return maxShares;
    }

    function sync() {
      modeSeg.set(st.mode);
      Object.keys(views).forEach(function (k) { views[k].style.display = k === st.mode ? '' : 'none'; });
      Object.keys(blocks).forEach(function (k) {
        blocks[k].forEach(function (g) { g.style.display = k === st.mode ? '' : 'none'; });
      });
      resizeActive();
      var maxShares = h1calc();
      s1cap.set(st.capitalW, true);
      s1cash.set(st.cashPct, true);
      s1buy.set(st.buyPrice, true);
      s1shares.setRange(0, maxShares);
      s1shares.set(st.shares, true);
      s1price.setRange(r2(st.buyPrice * 0.4), r2(st.buyPrice * 1.6));
      s1price.set(st.price, true);
      s2cap.set(st.capitalW, true); s2rate.set(st.rate, true); s2days.set(st.days, true); s2move.set(st.priceMove, true);
      s3cap.set(st.capitalW, true); s3rate.set(st.rate, true); s3days.set(st.days, true);
      s4cap.set(st.capitalW, true); s4ratio.set(st.maintenance, true); s4days.set(st.days, true); s4price.set(st.h4price, true);
      seg5.set(st.scenario);
      s5cap.set(st.capitalW, true); s5rate.set(st.rate, true); s5ratio.set(st.maintenance, true);
      s6gap.set(st.gapPct, true); c6limit.set(st.limitDown);
      s7cap.set(st.capitalW, true); s7ratio.set(st.maintenance, true);
    }

    function render() {
      if (st.mode === 'h1') renderH1();
      else if (st.mode === 'h2') renderH2();
      else if (st.mode === 'h3') renderH3();
      else if (st.mode === 'h4') renderH4();
      else if (st.mode === 'h5') renderH5();
      else if (st.mode === 'h6') renderH6();
      else if (st.mode === 'h7') renderH7();
    }

    /* ---------------- H1 ---------------- */
    function renderH1() {
      var capital = st.capitalW * 1e4;
      var shares = st.shares, cash = capital - shares * st.buyPrice;
      var mv = shares * st.price;
      var total = cash + mv;
      var pos = total > 0 ? mv / total * 100 : 0;
      var pnl = mv - shares * st.buyPrice;
      var ps = [], worth = [], mvs = [], cashes = [], labels = [];
      for (var i = 0; i <= 24; i++) {
        var pr = st.buyPrice * (0.4 + i * 0.05);
        ps.push(pr);
        worth.push(cash + shares * pr);
        mvs.push(shares * pr);
        cashes.push(cash);
        labels.push(pr.toFixed(1));
      }
      var idx = clamp(Math.round((st.price / st.buyPrice - 0.4) / 0.05), 0, 24);
      C.h1a.setData({
        labels: labels,
        series: [
          { name: '总资产', values: worth, color: p.cyan, width: 1.8, fmt: function (v) { return ui.fmt.money(v); } },
          { name: '持股市值', values: mvs, color: p.blue, width: 1.3, fmt: function (v) { return ui.fmt.money(v); } },
          { name: '现金', values: cashes, color: p.dim, width: 1.1, dash: [4, 3], fmt: function (v) { return ui.fmt.money(v); } }
        ],
        markers: [{ i: idx, value: worth[idx], text: '', color: p.orange }]
      });
      C.h1b.setData({
        segments: [
          { label: '持股市值', value: Math.max(0, mv), color: p.cyan, display: ui.fmt.money(mv) },
          { label: '现金', value: Math.max(0, cash), color: p.blue, display: ui.fmt.money(cash) }
        ],
        center: { value: f(pos, 1) + '%', label: '仓位' }
      });
      F.h1.innerHTML =
        '持股数 = 投入资金 ÷ 买入价 = ' + f(capital * (1 - st.cashPct / 100), 0) + ' ÷ ' + f(st.buyPrice, 2) + ' ≈ <b>' + f(shares, 0) + ' 股</b><br>' +
        '总资产 = 现金 + 持股 × 现价 = ' + f(cash, 0) + ' + ' + f(shares, 0) + ' × ' + f(st.price, 2) + ' = <b>' + ui.fmt.money(total) + '</b><br>' +
        '仓位 = 持股市值 ÷ 总资产 = ' + f(mv, 0) + ' ÷ ' + f(total, 0) + ' = <b>' + pct(pos, 1) + '</b>';
      M.h1.set({
        total: ui.fmt.money(total),
        cash: ui.fmt.money(cash),
        mv: ui.fmt.money(mv),
        pos: pct(pos, 1),
        shares: f(shares, 0) + ' 股',
        pnl: ui.fmt.money(pnl)
      }, { pos: 'hi', pnl: pnl >= 0 ? 'pos' : 'neg' });
    }

    /* ---------------- H2 ---------------- */
    function renderH2() {
      var capital = st.capitalW * 1e4;
      var price0 = st.h2buy, price1 = price0 * (1 + st.priceMove / 100);
      var results = LEV3.map(function (L) {
        var borrow = capital * (L - 1);
        return {
          lev: L,
          r: core.leverage({
            capital: capital, borrow: borrow, price0: price0, price1: price1,
            days: st.days, rate: st.rate / 100, maintenance: st.maintenance / 100
          })
        };
      });
      var moves = [], labels = [], curves = { 1: [], 1.5: [], 2: [] }, flat = [];
      for (var mv = -60; mv <= 60; mv += 10) {
        moves.push(mv);
        labels.push(mv + '%');
        flat.push(capital);
        LEV3.forEach(function (L) {
          curves[L].push(core.leverage({
            capital: capital, borrow: capital * (L - 1), price0: price0,
            price1: price0 * (1 + mv / 100), days: st.days,
            rate: st.rate / 100, maintenance: st.maintenance / 100
          }).net);
        });
      }
      var mIdx = clamp(Math.round((st.priceMove + 60) / 10), 0, moves.length - 1);
      C.h2a.setData({
        labels: labels,
        series: [
          { name: '1×', values: curves[1], color: p.cyan, width: 1.4, fmt: function (v) { return ui.fmt.money(v); } },
          { name: '1.5×', values: curves[1.5], color: p.blue, width: 1.7, fmt: function (v) { return ui.fmt.money(v); } },
          { name: '2×', values: curves[2], color: p.orange, width: 2, fmt: function (v) { return ui.fmt.money(v); } },
          { name: '本金', values: flat, color: p.dim, width: 1, dash: [4, 3], fmt: function (v) { return ui.fmt.money(v); } }
        ],
        markers: results.map(function (x, k) {
          return { i: mIdx, value: x.r.net, text: '', color: [p.cyan, p.blue, p.orange][k] };
        })
      });
      var rows = results.map(function (x) {
        var r = x.r;
        var status = r.marginCall ? '已强平' : (r.ratio != null && r.ratio < 1.6 ? '警戒' : '正常');
        return [
          x.lev + '×', f(r.assets / 1e4, 2), f(r.debt / 1e4, 2), f(r.net / 1e4, 2),
          f(r.pnl / 1e4, 2), f(r.returnPct, 1) + '%',
          r.ratio == null ? '—' : f(r.ratio, 2), status
        ];
      });
      ui.clear(E.h2table);
      E.h2table.appendChild(ui.table(['杠杆', '总资产', '债务', '净资产', '浮盈', '收益率', '担保', '状态'], rows));
      var triggered = results.filter(function (x) { return x.r.marginCall; });
      if (triggered.length) {
        E.h2warn.style.display = '';
        E.h2warn.innerHTML = '强制平仓触发：' + triggered.map(function (x) { return x.lev + '×'; }).join('、') +
          ' 的维持担保比例低于 ' + f(st.maintenance, 0) + '%。这是按当前价计算的快照；实际强平会更早发生。';
      } else {
        E.h2warn.style.display = 'none';
      }
      var r2 = results[2].r, r15 = results[1].r, r1 = results[0].r;
      F.h2.innerHTML =
        '借款 = 本金 × (杠杆 − 1)；以 2× 为例：' + f(capital, 0) + ' × 1 = ' + f(capital, 0) + ' 元<br>' +
        '债务 = 借款 × (1 + 年利率 × 天数 ÷ 365) = ' + f(capital, 0) + ' × (1 + ' + f(st.rate, 1) + '% × ' + f(st.days, 0) + ' ÷ 365) = ' + f(r2.debt, 0) + ' 元<br>' +
        '维持担保比例 = 总资产 ÷ 债务 = ' + f(r2.assets, 0) + ' ÷ ' + f(r2.debt, 0) + ' = <b>' + (r2.ratio == null ? '—' : f(r2.ratio, 3)) + '</b><br>' +
        '本金收益率 2× = (' + f(r2.net, 0) + ' − ' + f(capital, 0) + ') ÷ ' + f(capital, 0) + ' = <b>' + pct(r2.returnPct, 1) + '</b>';
      M.h2.set({
        n1: ui.fmt.money(r1.net),
        n15: ui.fmt.money(r15.net),
        n2: ui.fmt.money(r2.net),
        r2: pct(r2.returnPct, 1),
        i2: ui.fmt.money(r2.interest),
        l2: r2.liqPrice > 0 ? '¥' + f(r2.liqPrice, 2) : '—'
      }, { n2: r2.net >= capital ? 'pos' : 'neg', r2: r2.returnPct >= 0 ? 'pos' : 'neg' });
    }

    /* ---------------- H3 ---------------- */
    function renderH3() {
      var capital = st.capitalW * 1e4;
      var price0 = st.h3buy;
      var results = LEV3.map(function (L) {
        var borrow = capital * (L - 1);
        return {
          lev: L,
          r: core.leverage({
            capital: capital, borrow: borrow, price0: price0, price1: price0,
            days: st.days, rate: st.rate / 100, maintenance: 1.3
          })
        };
      });
      var ps = [], labels = [];
      for (var i = 0; i <= 16; i++) {
        var pr = 6 + i * 0.5;
        ps.push(pr);
        labels.push(pr.toFixed(1));
      }
      C.h3a.setData({
        labels: labels,
        series: results.map(function (x, k) {
          var sh = x.r.shares, debt = x.r.debt;
          return {
            name: x.lev + '×',
            values: ps.map(function (pr) { return sh * pr - debt; }),
            color: [p.cyan, p.blue, p.orange][k],
            width: k === 2 ? 1.9 : 1.3,
            fmt: function (v) { return ui.fmt.money(v); }
          };
        })
      });
      var days = [], i15 = [], i2 = [], dlabels = [];
      for (var d = 0; d <= 180; d += 15) {
        days.push(d);
        dlabels.push(d + '天');
        i15.push(core.leverage({
          capital: capital, borrow: capital * 0.5, price0: price0, price1: price0,
          days: d, rate: st.rate / 100, maintenance: 1.3
        }).interest);
        i2.push(core.leverage({
          capital: capital, borrow: capital, price0: price0, price1: price0,
          days: d, rate: st.rate / 100, maintenance: 1.3
        }).interest);
      }
      var dayIdx = clamp(Math.round(st.days / 15), 0, days.length - 1);
      C.h3b.setData({
        labels: dlabels,
        series: [
          { name: '1.5× 利息', values: i15, color: p.blue, width: 1.4, fmt: function (v) { return '¥' + f(v, 0); } },
          { name: '2× 利息', values: i2, color: p.orange, width: 1.8, fmt: function (v) { return '¥' + f(v, 0); } }
        ],
        markers: [
          { i: dayIdx, value: i15[dayIdx], text: '¥' + f(i15[dayIdx], 0), color: p.blue },
          { i: dayIdx, value: i2[dayIdx], text: '¥' + f(i2[dayIdx], 0), color: p.orange }
        ]
      });
      var r15 = results[1].r, r2 = results[2].r;
      var be15 = (capital + r15.debt) / r15.shares;
      var be2 = (capital + r2.debt) / r2.shares;
      var down20 = core.leverage({
        capital: capital, borrow: capital, price0: price0, price1: price0 * 0.8,
        days: st.days, rate: st.rate / 100, maintenance: st.maintenance / 100
      });
      F.h3.innerHTML =
        '利息 = 借款 × 年利率 × 天数 ÷ 365；2× 借款 ' + f(capital, 0) + ' 元 → ' + f(r2.interest, 0) + ' 元<br>' +
        '保本价 2× = (本金 + 债务) ÷ 股数 = (' + f(capital, 0) + ' + ' + f(r2.debt, 0) + ') ÷ ' + f(r2.shares, 0) + ' = <b>¥' + f(be2, 3) + '</b><br>' +
        '保本价 1.5× = (' + f(capital, 0) + ' + ' + f(r15.debt, 0) + ') ÷ ' + f(r15.shares, 0) + ' = ' + f(be15, 3) + ' 元<br>' +
        '股价跌 20% 时 2× 本金收益率 = <b>' + pct(down20.returnPct, 1) + '</b>';
      M.h3.set({
        i15: '¥' + f(r15.interest, 0),
        i2: '¥' + f(r2.interest, 0),
        b15: '¥' + f(be15, 3),
        b2: '¥' + f(be2, 3),
        r20: pct(down20.returnPct, 1),
        liq2: '¥' + f(r2.liqPrice, 2)
      }, { b2: 'hi', r20: down20.returnPct >= 0 ? 'pos' : 'neg' });
    }

    /* ---------------- H4 ---------------- */
    function renderH4() {
      var capital = st.capitalW * 1e4;
      var price0 = st.h4buy;
      var res = [1.5, 2].map(function (L) {
        var borrow = capital * (L - 1);
        var shares = (capital + borrow) / price0;
        var debt = borrow * (1 + st.rate / 100 * st.days / 365);
        var liq = core.liquidationPrice({ shares: shares, debt: debt, maintenance: st.maintenance / 100 });
        return { lev: L, shares: shares, debt: debt, liq: liq, r: core.leverage({
          capital: capital, borrow: borrow, price0: price0, price1: st.h4price,
          days: st.days, rate: st.rate / 100, maintenance: st.maintenance / 100
        }) };
      });
      var ps = [], labels = [];
      for (var i = 0; i <= 32; i++) {
        var pr = 4 + i * 0.25;
        ps.push(pr);
        labels.push(pr.toFixed(1));
      }
      var maint = st.maintenance / 100;
      var series = res.map(function (x, k) {
        return {
          name: x.lev + '×',
          values: ps.map(function (pr) { return x.shares * pr / x.debt; }),
          color: [p.blue, p.orange][k],
          width: k === 1 ? 1.9 : 1.3,
          fmt: function (v) { return v.toFixed(2) + '×'; }
        };
      });
      series.push({
        name: '强平阈值', values: ps.map(function () { return maint; }),
        color: p.red, width: 1.2, dash: [5, 4]
      });
      var idx = clamp(Math.round((st.h4price - 4) / 0.25), 0, 32);
      C.h4a.setData({
        labels: labels,
        series: series,
        bands: [{ from: 0, to: maint, color: 'rgba(224,90,95,.08)' }],
        markers: res.map(function (x, k) {
          return {
            i: idx, value: x.shares * st.h4price / x.debt,
            text: x.lev + '× ' + (st.h4price <= x.liq ? '强平' : ''),
            color: [p.blue, p.orange][k]
          };
        })
      });
      var rows = res.map(function (x) {
        var dist = (x.liq / price0 - 1) * 100;
        var status = st.h4price <= x.liq ? '已强平' : (st.h4price < x.liq * 1.08 ? '接近' : '安全');
        return [x.lev + '×', '¥' + f(x.liq, 2), pct(dist, 1), x.r.ratio == null ? '—' : f(x.r.ratio, 2), status];
      });
      rows.unshift(['1×', '—', '—', '—', '安全']);
      ui.clear(E.h4table);
      E.h4table.appendChild(ui.table(['杠杆', '强平价', '距买入价', '担保比例', '状态'], rows));
      var hit = res.filter(function (x) { return st.h4price <= x.liq; });
      if (hit.length) {
        E.h4warn.style.display = '';
        E.h4warn.innerHTML = '强制平仓事件：股价 ¥' + f(st.h4price, 2) + ' 已跌破 ' +
          hit.map(function (x) { return x.lev + '× 强平价 ¥' + f(x.liq, 2); }).join('、') +
          '，按模型该账户被平仓，亏损锁定。';
      } else {
        E.h4warn.style.display = 'none';
      }
      var x2 = res[1];
      F.h4.innerHTML =
        '2× 股数 = 本金 × 2 ÷ 买入价 = ' + f(capital, 0) + ' × 2 ÷ ' + f(price0, 2) + ' = ' + f(x2.shares, 0) + ' 股<br>' +
        '强平价 = 债务 × 维持担保比例 ÷ 股数 = ' + f(x2.debt, 0) + ' × ' + pct(st.maintenance, 0) + ' ÷ ' + f(x2.shares, 0) + ' = <b>¥' + f(x2.liq, 2) + '</b><br>' +
        '当前担保比例 = ' + f(x2.shares * st.h4price, 0) + ' ÷ ' + f(x2.debt, 0) + ' = ' + f(x2.shares * st.h4price / x2.debt, 3) + '×<br>' +
        '距买入价的跌幅 = ' + pct((x2.liq / price0 - 1) * 100, 1) + ' 时触及强平';
      M.h4.set({
        l15: '¥' + f(res[0].liq, 2),
        l2: '¥' + f(res[1].liq, 2),
        r2: f(res[1].shares * st.h4price / res[1].debt, 2) + '×',
        m: pct(st.maintenance, 0),
        assets2: ui.fmt.money(res[1].shares * st.h4price),
        debt2: ui.fmt.money(res[1].debt)
      }, { l2: 'hi', r2: st.h4price <= res[1].liq ? 'neg' : 'hi' });
    }

    /* ---------------- H5 ---------------- */
    function scenarioPrices(kind) {
      if (kind === 'limitDown') {
        var arr = [], v = 10;
        for (var i = 0; i < 30; i++) { v *= 1.001; arr.push(r2(v)); }
        for (var d = 0; d < 8; d++) { v *= 0.9; arr.push(r2(v)); }
        while (arr.length < 120) { v *= 1.002; arr.push(r2(v)); }
        return arr;
      }
      if (kind === 'slowUp') return sim.pricePath({ seed: 41, n: 120, start: 10, driftPct: 80, volPct: 10 });
      if (kind === 'slowDown') return sim.pricePath({ seed: 42, n: 120, start: 10, driftPct: -160, volPct: 14 });
      if (kind === 'violent') return sim.pricePath({ seed: 43, n: 120, start: 10, driftPct: -10, volPct: 55 });
      if (kind === 'gapDown') return sim.pricePath({ seed: 44, n: 120, start: 10, driftPct: -25, volPct: 10, gapAt: 36, gapPct: 35 });
      return sim.pricePath({ seed: 45, n: 120, start: 10, driftPct: -35, volPct: 6, gapAt: 70, gapPct: 12 });
    }

    function renderH5() {
      var capital = st.capitalW * 1e4;
      var prices = scenarioPrices(st.scenario);
      var labels = prices.map(function (_, i) { return 'D' + (i + 1); });
      var sims = LEV3.map(function (L) {
        return {
          lev: L,
          r: sim.simulateMargin({
            capital: capital, leverage: L, prices: prices,
            rate: st.rate / 100, maintenance: st.maintenance / 100
          })
        };
      });
      var colors = [p.cyan, p.blue, p.orange];
      var markers = [];
      sims.forEach(function (x, k) {
        if (x.r.liquidation) {
          markers.push({
            i: x.r.liquidation.i, value: x.r.liquidation.equity,
            text: x.lev + '× 强平', color: colors[k]
          });
        }
      });
      C.h5eq.setData({
        labels: labels,
        series: sims.map(function (x, k) {
          return {
            name: x.lev + '×', values: x.r.series.map(function (s) { return s.equity; }),
            color: colors[k], width: k === 2 ? 2 : 1.4,
            fmt: function (v) { return ui.fmt.money(v); }
          };
        }),
        markers: markers
      });
      var pmarks = [];
      sims.forEach(function (x) {
        if (!x.r.liquidation) return;
        pmarks.push({
          i: x.r.liquidation.i, value: x.r.liquidation.price,
          text: x.lev + '×', color: x.lev === 1 ? p.cyan : (x.lev === 1.5 ? p.blue : p.orange)
        });
      });
      C.h5price.setData({
        labels: labels,
        series: [{
          name: '价格', values: prices, color: p.muted, width: 1.4, area: true,
          fmt: function (v) { return '¥' + f(v, 2); }
        }],
        markers: pmarks
      });
      ui.clear(E.h5log);
      var rows = [];
      sims.forEach(function (x) {
        var ev = x.r.liquidation;
        if (ev) {
          rows.push([x.lev + '×', 'D' + (ev.i + 1), '¥' + f(ev.price, 2), wan(ev.equity), wan(ev.loss)]);
        }
      });
      if (!rows.length) rows.push(['—', '—', '—', '—', '未触发强平']);
      E.h5log.appendChild(ui.table(['账户', '日期', '价格', '权益', '亏损'], rows));
      E.h5sum.innerHTML = '期末权益：1× ' + wan(sims[0].r.finalEquity) +
        ' · 1.5× ' + wan(sims[1].r.finalEquity) + ' · 2× ' + wan(sims[2].r.finalEquity);
      var liqDay = function (x) { return x.r.liquidation ? 'D' + (x.r.liquidation.i + 1) : '未触发'; };
      F.h5.innerHTML =
        '情景：<b>' + ({ slowUp: '缓慢上涨', slowDown: '缓慢下跌', violent: '暴涨暴跌', gapDown: '跳空低开', illiquid: '流动性不足', limitDown: '连续跌停' }[st.scenario]) + '</b>，共 120 个交易日<br>' +
        '借款 = 本金 × (杠杆 − 1)；2× 借款 ' + f(capital, 0) + ' 元<br>' +
        '强平条件：总资产 ÷ 债务 &lt; ' + pct(st.maintenance, 0) + '；2× 触发于 ' + liqDay(sims[2]) + '<br>' +
        '期末权益 2× = <b>' + wan(sims[2].r.finalEquity) + '</b>';
      M.h5.set({
        e1: wan(sims[0].r.finalEquity),
        e15: wan(sims[1].r.finalEquity),
        e2: wan(sims[2].r.finalEquity),
        l15: liqDay(sims[1]),
        l2: liqDay(sims[2]),
        last: '¥' + f(sims[2].r.finalPrice, 2)
      }, { e2: sims[2].r.finalEquity >= capital ? 'pos' : 'neg' });
    }

    /* ---------------- H6 ---------------- */
    function renderH6() {
      var capital = st.capitalW * 1e4;
      var buy = st.h6buy;
      var lev = 2;
      var borrow = capital * (lev - 1);
      var shares = (capital + borrow) / buy;
      var debt = borrow;
      var liq = core.liquidationPrice({ shares: shares, debt: debt, maintenance: st.maintenance / 100 });
      var open = st.prevClose * (1 - st.gapPct / 100);
      var exec = Math.min(open, liq);
      if (st.limitDown) exec *= 0.9;
      var theory = shares * liq - debt;
      var actual = shares * exec - debt;
      var lossT = capital - theory;
      var lossA = capital - actual;
      var crossed = open < liq;
      C.h6a.setData({
        labels: ['前收盘', '理论强平价', '实际成交价'],
        values: [r2(st.prevClose), r2(liq), r2(exec)],
        colors: [p.dim, p.orange, p.red],
        yFormat: function (v) { return '¥' + v.toFixed(2); }
      });
      C.h6b.setData({
        labels: ['理论亏损', '实际亏损'],
        values: [Math.round(lossT), Math.round(lossA)],
        colors: [p.dim, p.red],
        yFormat: function (v) { return (v / 1e4).toFixed(1) + '万'; }
      });
      F.h6.innerHTML =
        '2× 股数 = ' + f(capital, 0) + ' × 2 ÷ ' + f(buy, 2) + ' = ' + f(shares, 0) + ' 股；债务 = ' + f(debt, 0) + ' 元<br>' +
        '强平价 = 债务 × ' + pct(st.maintenance, 0) + ' ÷ 股数 = <b>¥' + f(liq, 2) + '</b><br>' +
        '跳空开盘价 = ' + f(st.prevClose, 2) + ' × (1 − ' + pct(st.gapPct, 0) + ') = ¥' + f(open, 2) +
        '；实际成交 = ' + (crossed ? '开盘价' : '强平价') + (st.limitDown ? ' × 0.90（次日跌停）' : '') + '<br>' +
        '实际亏损 = 本金 − (股数 × 成交价 − 债务) = <b>' + ui.fmt.money(lossA) + '</b>';
      E.h6note.innerHTML = crossed
        ? '跳空开盘已低于强平价，实际成交价 ' + (st.limitDown ? '被推到次日跌停价' : '由开盘价决定') + '，比理论强平价低 ¥' + f(liq - exec, 2) + '。'
        : '跳空幅度还不足以直接穿越强平价，模型按理论强平价成交；继续加大跳空幅度可看到滑点。';
      M.h6.set({
        exec: '¥' + f(exec, 2),
        liq: '¥' + f(liq, 2),
        loss: ui.fmt.money(lossA),
        lp: pct(lossA / capital * 100, 1),
        tloss: ui.fmt.money(lossT),
        gap: ui.fmt.money(Math.max(0, lossA - lossT))
      }, { loss: 'neg', lp: 'neg' });
    }

    /* ---------------- H7 ---------------- */
    function renderH7() {
      var capital = st.capitalW * 1e4;
      var maint = st.maintenance / 100;
      var rows = [], vals = [], labels = [], ds = {};
      LEV5.forEach(function (L) {
        var borrow = capital * (L - 1);
        var liq = borrow > 0 ? core.liquidationPrice({
          capital: capital, borrow: borrow, price0: st.h7buy, days: 0, rate: 0, maintenance: maint
        }) : 0;
        var dist = liq > 0 ? (1 - liq / st.h7buy) * 100 : null;
        var r10 = core.leverage({
          capital: capital, borrow: borrow, price0: st.h7buy, price1: st.h7buy * 0.9,
          days: 0, rate: 0, maintenance: maint
        });
        var r20 = core.leverage({
          capital: capital, borrow: borrow, price0: st.h7buy, price1: st.h7buy * 0.8,
          days: 0, rate: 0, maintenance: maint
        });
        rows.push([
          L + '×', liq > 0 ? '¥' + f(liq, 2) : '—',
          dist == null ? '—<br><span style="font-size:8px;color:var(--dim)">无负债</span>' : pct(dist, 1),
          pct(r10.returnPct, 1), pct(r20.returnPct, 1)
        ]);
        vals.push(r2(r20.returnPct));
        labels.push(L + '×');
        ds[L] = { dist: dist, r10: r10.returnPct };
      });
      ui.clear(E.h7table);
      E.h7table.appendChild(ui.table(['杠杆', '强平价', '强平距离', '股价 −10%', '股价 −20%'], rows));
      C.h7a.setData({
        labels: labels, values: vals,
        colors: [p.dim, p.blue, p.orange, p.violet, p.yellow]
      });
      F.h7.innerHTML =
        '本金收益率 ≈ 杠杆倍数 × 股价涨跌幅 − 利息 ÷ 本金<br>' +
        '强平距离 = 1 − 强平价 ÷ 买入价（随参数变化，见左表与读数）<br>' +
        '股价跌 10% 时：2× 本金 ' + pct(ds[2].r10, 1) + '，3× 本金 ' + pct(ds[3].r10, 1) + '<br>' +
        '杠杆放大的是<b>结果</b>，也放大了被迫平仓的概率。';
      M.h7.set({
        d2: pct(ds[2].dist, 1),
        d3: pct(ds[3].dist, 1),
        r2: pct(ds[2].r10, 1),
        r3: pct(ds[3].r10, 1)
      }, { d3: 'neg', r3: 'neg' });
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
        [C.h1a, C.h1b, C.h2a, C.h3a, C.h3b, C.h4a, C.h5eq, C.h5price, C.h6a, C.h6b, C.h7a].forEach(function (c) {
          if (c && c.destroy) c.destroy();
        });
      }
    };
  }

  SM.registerModule({
    id: 'H', slug: 'leverage', order: 8,
    title: '收益与杠杆', en: 'LEVERAGE',
    subtitle: '融资、利息与强平：杠杆把结果放大，也把选择变少',
    hint: '所有参数都可调；先把价格拖到强平价附近，再看情景模拟里的路径与事件。',
    scenes: [
      {
        title: '仓位：现金与持股市值',
        body: '总资产 = 现金 + 持股数 × 股价，仓位是持股市值占总资产的比例。<br>调整现金比例与股价，观察总资产与仓位的联动。<br>仓位会随股价变化，即使你不交易。',
        patch: SCENES.h1,
        guide: '把现金比例调到 80%：总资产对股价还敏感吗？',
        duration: 15000
      },
      {
        title: '三档杠杆：同一笔本金',
        body: '1× 不用借款，1.5× 与 2× 分别借入本金的 50% 与 100%。<br>拖动股价变动：净资产、收益率与维持担保比例同时变化。<br>杠杆放大收益，也放大亏损与利息。',
        patch: SCENES.h2,
        guide: '把股价调到 −30%：三档账户的净资产与收益率差多少？',
        duration: 16000
      },
      {
        title: '利息成本与保本价',
        body: '借款按日计息，持有越久，债务越大，保本价越高。<br>2× 的利息高于 1.5×，因为借得更多。<br>杠杆同时放大盈利与亏损，利息让亏损的一侧更重。',
        patch: SCENES.h3,
        guide: '把持有天数从 30 天拉到 180 天：2× 的保本价上升多少？',
        duration: 16000
      },
      {
        title: '强平：担保比例触及阈值',
        body: '维持担保比例 = 总资产 ÷ 债务；低于阈值时，券商可强制平仓。<br>把股价拖到强平价下方，触发强制平仓事件。<br>预警线、平仓线与执行方式由券商和账户合同决定。',
        patch: SCENES.h4,
        guide: '把维持担保比例从 130% 调到 160%：强平价如何移动？',
        duration: 16000
      },
      {
        title: '六种情景：路径决定结局',
        body: '同样的杠杆，路径不同，结局可能完全不同。<br>切换缓慢上涨、下跌、暴涨暴跌、跳空、流动性不足与连续跌停，观察净值曲线与强平标记。<br><b>SIMULATED</b>：固定种子路径，可复现，不是预测。',
        patch: SCENES.h5,
        guide: '比较缓慢下跌与跳空低开：强平发生的时点与亏损差多少？',
        duration: 18000
      },
      {
        title: '跳空：强平也会滑价',
        body: '价格跳空跌破强平价时，平仓只能按更低的开盘价成交。<br>实际亏损因此大于按理论强平价计算的亏损。<br>若跌停封死，可能根本卖不出去，损失取决于次日流动性。',
        patch: SCENES.h6,
        guide: '把跳空幅度从 15% 调到 0%：实际亏损与理论亏损何时相等？',
        duration: 16000
      },
      {
        title: '风险总结：杠杆的代价',
        body: '杠杆越高，亏损放大倍数越大，强平距离越短。<br>2× 在股价跌 35% 左右触及强平，3× 只剩约 13% 的距离。<br>融资额度、维持担保比例、利息与强平条件由券商和账户决定。',
        patch: SCENES.h7,
        guide: '比较 2× 与 3× 的强平距离：哪一档更经不起波动？',
        duration: 16000
      }
    ],
    quiz: [
      {
        q: '本金 10 万元、2× 杠杆、不计利息。股价下跌 10%，本金亏损约多少？',
        options: ['5%', '10%', '20%', '100%'],
        answer: 2,
        explain: '2× 时持股是本金的两倍，股价跌 10% 对应净资产减少约 20%：本金收益率为 −20%。'
      },
      {
        q: '维持担保比例 130%、2× 杠杆、买入价 10 元、不计利息。股价跌到多少时触及强平？',
        options: ['¥5.00', '¥6.50', '¥7.50', '¥8.00'],
        answer: 1,
        explain: '借款 10 万元、持股 2 万股，强平价 = 债务 × 130% ÷ 股数 = 100000 × 1.3 ÷ 20000 = <b>6.50 元</b>。'
      },
      {
        q: '跳空低开直接跌破强平价时，为什么实际亏损可能大于理论亏损？',
        options: [
          '因为利息在跳空当天停止',
          '因为强平只能在更低的开盘价成交，且跌停时可能无法卖出',
          '因为券商一定会按理论强平价补偿',
          '因为股价下跌不影响净资产'
        ],
        answer: 1,
        explain: '理论强平价只是触发线，不是成交保证。跳空时成交在更低的开盘价；若跌停封死，甚至可能无法卖出。'
      }
    ],
    mount: mount
  });
})();
