/* Module J — synchronized comparisons: same starting point, one variable changed. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, T = DL.thermo, plot = DL.plot;

  var DEFAULT = { pair: 'reflux', xF: 0.45, xD: 0.95, xW: 0.05 };
  var PAIRS = [
    { value: 'reflux', label: '低回流 vs 高回流' },
    { value: 'q', label: '饱和液 vs 饱和汽进料' },
    { value: 'alpha', label: '易分离 vs 难分离' },
    { value: 'feed', label: '最优 vs 偏离进料位置' },
    { value: 'eff', label: '理论板 vs 实际板' },
    { value: 'system', label: '理想体系 vs 恒沸体系' },
    { value: 'single', label: '闪蒸 vs 简单蒸馏' },
    { value: 'pressure', label: '常压 vs 减压' },
    { value: 'rigorous', label: '简化模型 vs Aspen 严格模拟' }
  ];

  function lam(eq) { var s = eq.sys; return s.light ? (T.COMPONENTS[s.light].hvap + T.COMPONENTS[s.heavy].hvap) / 2 : 32; }
  function design(eq, o) {
    var rm = T.rmin(eq, o.xF, o.q == null ? 1 : o.q, o.xD);
    var R = (o.rf || 1.5) * rm.R;
    var res = T.mccabe(eq, { xF: o.xF, q: o.q == null ? 1 : o.q, xD: o.xD, xW: o.xW, R: R, E: o.E, feedStage: o.feedStage, maxStages: 200 });
    var qr = res.Vb * 100 * lam(eq) * 1000 / 3600;
    return { rm: rm, R: R, res: res, qr: qr };
  }

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage, panel = ctx.panel;

    var grid = ui.el('div', 'compare-grid');
    var sides = [0, 1].map(function (i) {
      var box = ui.el('div', 'compare-side');
      var h = ui.el('h4', null, '<b></b><span>' + (i ? 'CASE B' : 'CASE A') + '</span>');
      var host = ui.el('div');
      var cards = ui.el('div', 'cards');
      var refs = [0, 1, 2].map(function () { var c = ui.el('div', 'card', '<span></span><b>—</b><small></small>'); cards.appendChild(c); return c; });
      box.appendChild(h); box.appendChild(host); box.appendChild(cards);
      grid.appendChild(box);
      var chart = plot.chart(host, { label: '对比图 ' + (i ? 'B' : 'A'), square: true, x: { min: 0, max: 1, label: '液相 x' }, y: { min: 0, max: 1, label: '气相 y' }, pad: { l: 40, b: 32, r: 8, t: 10 } });
      return { box: box, h: h, chart: chart, refs: refs };
    });
    var note = ui.el('p', 'stage-note');
    stage.appendChild(grid); stage.appendChild(note);

    var gP = ui.section(panel, '对比组', 'PAIR');
    var pairCtl = ui.select({ label: '只改变一个变量', options: PAIRS, value: st.pair, onChange: function (v) { st.pair = v; sync(); } });
    gP.appendChild(pairCtl.el);
    var gS = ui.section(panel, '共同条件', 'SHARED');
    var xFCtl = ui.slider({ label: '进料 xF', min: 0.15, max: 0.8, step: 0.01, value: st.xF, onInput: function (v) { st.xF = v; sync(); } });
    var xDCtl = ui.slider({ label: '塔顶 xD', min: 0.8, max: 0.99, step: 0.005, value: st.xD, onInput: function (v) { st.xD = v; sync(); } });
    var xWCtl = ui.slider({ label: '塔底 xW', min: 0.01, max: 0.12, step: 0.005, value: st.xW, onInput: function (v) { st.xW = v; sync(); } });
    [xFCtl, xDCtl, xWCtl].forEach(function (c) { gS.appendChild(c.el); });
    var sharedNote = ui.note(''); gS.appendChild(sharedNote);
    var gM = ui.section(panel, '差异', 'DELTA');
    var deltaBox = ui.formula(''); gM.appendChild(deltaBox);
    var gR = ui.section(panel);
    gR.appendChild(ui.row([ui.reset(function () { Object.assign(st, DEFAULT); sync(); })]));

    function setSide(i, cfg) {
      var s = sides[i];
      s.h.querySelector('b').textContent = cfg.title;
      cfg.cards.forEach(function (c, k) {
        var el = s.refs[k];
        el.querySelector('span').textContent = c[0]; el.querySelector('b').textContent = c[1]; el.querySelector('small').textContent = c[2] || '';
        el.className = 'card' + (c[3] ? ' ' + c[3] : '');
      });
      if (cfg.kind === 'custom') {
        s.chart.setOpts({ square: false });
        s.chart.setAxes(cfg.x, cfg.y);
        s.chart.draw(cfg.draw);
        return;
      }
      s.chart.setOpts({ square: true });
      if (cfg.kind === 'mccabe') {
        s.chart.setAxes({ min: 0, max: 1, label: '液相 x' }, { min: 0, max: 1, label: '气相 y' });
        s.chart.draw(function (g) { plot.mccabe(g, cfg.eq, cfg.res, { labels: true }); });
      } else {
        var eq = cfg.eq, Ts = eq.Ts.filter(isFinite), lo = Math.min.apply(null, Ts), hi = Math.max.apply(null, Ts);
        s.chart.setAxes({ min: 0, max: 1, label: '组成 x / y' }, { min: Math.floor(lo - 3), max: Math.ceil(hi + 3), label: 'T / °C' });
        s.chart.draw(function (g) {
          plot.txy(g, eq, cfg.kind === 'flash' ? { x: cfg.fl.x, z: cfg.z } : {});
          g.open();
          if (cfg.kind === 'rayleigh') {
            var path = cfg.ry.path.map(function (p) { return [p.x, eq.T(p.x)]; });
            g.path(path, { c: 'var(--yellow)', w: 3.5, op: 0.85 });
            g.dot(cfg.z, eq.T(cfg.z), { c: 'var(--yellow)' }); g.text(cfg.z, eq.T(cfg.z), '起点', { dx: 6, dy: -6, c: 'var(--yellow)' });
            g.dot(cfg.ry.xW, eq.T(cfg.ry.xW), { c: 'var(--orange)', r: 4.5 }); g.text(cfg.ry.xW, eq.T(cfg.ry.xW), '釜残 ' + cfg.ry.xW.toFixed(3), { dx: -6, dy: 14, anchor: 'end', c: 'var(--orange)' });
            g.dot(cfg.ry.xDavg, eq.T(cfg.z) - 1.5, { c: 'var(--cyan)', r: 4.5 }); g.text(cfg.ry.xDavg, eq.T(cfg.z) - 1.5, '馏出平均 ' + cfg.ry.xDavg.toFixed(3), { dx: 6, dy: 14, c: 'var(--cyan)' });
          } else {
            g.text(cfg.fl.x, cfg.fl.T, 'x ' + cfg.fl.x.toFixed(3), { dx: -6, dy: 16, anchor: 'end', c: 'var(--blue)' });
            g.text(cfg.fl.y, cfg.fl.T, 'y ' + cfg.fl.y.toFixed(3), { dx: 6, dy: 16, c: 'var(--orange)' });
          }
          g.close();
        });
      }
    }

    function sync() {
      pairCtl.set(st.pair);
      if (st.xF < st.xW + 0.05) st.xF = st.xW + 0.05;
      if (st.xF > st.xD - 0.05) st.xF = st.xD - 0.05;
      [[xFCtl, st.xF], [xDCtl, st.xD], [xWCtl, st.xW]].forEach(function (p) { p[0].set(p[1], true); });
      var bt = T.makeEq('bt');
      var base = { xF: st.xF, xD: st.xD, xW: st.xW };
      var A, B, text, delta;
      function mcCards(d, extra) {
        var r = d.res;
        return [
          ['理论级数 N', isFinite(r.N) ? r.N.toFixed(2) : '∞', '第 ' + (r.feedStage || '—') + ' 级进料', isFinite(r.N) ? 'hi' : 'bad'],
          ['回流比 R', d.R.toFixed(2), 'Rmin = ' + d.rm.R.toFixed(2), ''],
          extra || ['再沸器负荷', ui.fmt.num(d.qr, 0) + ' kW', 'F = 100 kmol/h', 'warm']
        ];
      }
      var shared = true;
      if (st.pair === 'reflux') {
        var a = design(bt, Object.assign({ rf: 1.2 }, base)), b = design(bt, Object.assign({ rf: 2.5 }, base));
        A = { title: 'R = 1.2 Rmin', kind: 'mccabe', eq: bt, res: a.res, cards: mcCards(a) };
        B = { title: 'R = 2.5 Rmin', kind: 'mccabe', eq: bt, res: b.res, cards: mcCards(b) };
        delta = 'N：' + a.res.N.toFixed(1) + ' → ' + b.res.N.toFixed(1) + '<br>再沸器：' + ui.fmt.num(a.qr, 0) + ' → ' + ui.fmt.num(b.qr, 0) + ' kW（×' + (b.qr / a.qr).toFixed(2) + '）';
        text = '回流比加大一倍多，理论级数从 <b>' + a.res.N.toFixed(1) + '</b> 降到 <b>' + b.res.N.toFixed(1) + '</b>，但再沸器负荷增加到 <b>' + (b.qr / a.qr).toFixed(2) + '</b> 倍：用能耗换塔高。';
      } else if (st.pair === 'q') {
        var a2 = design(bt, Object.assign({ q: 1 }, base)), b2 = design(bt, Object.assign({ q: 0 }, base));
        A = { title: '饱和液体进料 q = 1', kind: 'mccabe', eq: bt, res: a2.res, cards: mcCards(a2, ['提馏段汽量 V′/F', a2.res.Vb.toFixed(2), '', '']) };
        B = { title: '饱和蒸汽进料 q = 0', kind: 'mccabe', eq: bt, res: b2.res, cards: mcCards(b2, ['提馏段汽量 V′/F', b2.res.Vb.toFixed(2), '', '']) };
        delta = 'Rmin：' + a2.rm.R.toFixed(2) + ' → ' + b2.rm.R.toFixed(2) + '<br>N（1.5 Rmin）：' + a2.res.N.toFixed(1) + ' → ' + b2.res.N.toFixed(1);
        text = '蒸汽进料把 q 线放平，夹紧点下移，<b>Rmin 变大</b>（' + a2.rm.R.toFixed(2) + ' → ' + b2.rm.R.toFixed(2) + '）；进料自带的汽化热使再沸器少干活（V′ 变小），冷凝器却要多干活。热量从哪里加入，会改变塔内汽液分布。';
      } else if (st.pair === 'alpha') {
        var ea = T.makeEq('alpha', { alpha: 2.5 }), eb = T.makeEq('alpha', { alpha: 1.4 });
        var a3 = design(ea, base), b3 = design(eb, base);
        A = { title: 'α = 2.5', kind: 'mccabe', eq: ea, res: a3.res, cards: mcCards(a3, ['Nmin（Fenske）', T.fenske(st.xD, st.xW, 2.5).toFixed(1), '', '']) };
        B = { title: 'α = 1.4', kind: 'mccabe', eq: eb, res: b3.res, cards: mcCards(b3, ['Nmin（Fenske）', T.fenske(st.xD, st.xW, 1.4).toFixed(1), '', '']) };
        delta = 'N：' + a3.res.N.toFixed(1) + ' → ' + (isFinite(b3.res.N) ? b3.res.N.toFixed(1) : '∞') + '<br>Rmin：' + a3.rm.R.toFixed(2) + ' → ' + b3.rm.R.toFixed(2);
        text = '相对挥发度从 2.5 降到 1.4，平衡线贴近对角线：最少级数与最小回流比<b>同时</b>大幅增加。α 是决定精馏难易的第一因素。';
      } else if (st.pair === 'feed') {
        var a4 = design(bt, base);
        var b4 = design(bt, Object.assign({ feedStage: 2 }, base));
        A = { title: '最优进料（第 ' + a4.res.feedStage + ' 级）', kind: 'mccabe', eq: bt, res: a4.res, cards: mcCards(a4) };
        B = { title: '强制第 2 级进料', kind: 'mccabe', eq: bt, res: b4.res, cards: mcCards(b4) };
        delta = 'N：' + a4.res.N.toFixed(1) + ' → ' + (isFinite(b4.res.N) ? b4.res.N.toFixed(1) : '∞') + '（同一回流比）';
        text = '同样的回流比，进料位置过高使提馏段操作线过早启用，台阶变矮：需要 <b>' + (isFinite(b4.res.N) ? b4.res.N.toFixed(1) : '∞') + '</b> 级而不是 <b>' + a4.res.N.toFixed(1) + '</b> 级。';
      } else if (st.pair === 'eff') {
        var a5 = design(bt, base), b5 = design(bt, Object.assign({ E: 0.6 }, base));
        A = { title: '理论板 E = 100%', kind: 'mccabe', eq: bt, res: a5.res, cards: mcCards(a5) };
        B = { title: '实际板 E_MV = 60%', kind: 'mccabe', eq: bt, res: b5.res, cards: mcCards(b5, ['塔内实际板', isFinite(b5.res.N) ? String(Math.ceil(b5.res.N - 1)) : '∞', '板间距 0.6 m → ' + (isFinite(b5.res.N) ? (Math.ceil(b5.res.N - 1) * 0.6).toFixed(1) + ' m' : '—'), 'warm']) };
        delta = '级数：' + a5.res.N.toFixed(1) + ' → ' + b5.res.N.toFixed(1);
        text = '板效率 60% 时，伪平衡线（虚线）离操作线更近，台阶更矮。理论上 ' + a5.res.N.toFixed(1) + ' 级的任务，实际要 ' + b5.res.N.toFixed(1) + ' 级。';
      } else if (st.pair === 'system') {
        shared = false;
        var sp = { xF: 0.3, xD: 0.85, xW: 0.02 };
        var ew = T.makeEq('ew');
        var a6 = design(bt, sp), b6 = design(ew, sp);
        A = { title: '苯–甲苯（理想）', kind: 'mccabe', eq: bt, res: a6.res, cards: mcCards(a6) };
        B = { title: '乙醇–水（有恒沸点）', kind: 'mccabe', eq: ew, res: b6.res, cards: mcCards(b6, ['恒沸组成', ew.azeotrope.x.toFixed(3), 'xD 不能超过', 'bad']) };
        delta = '相同规格 xF 0.30 → xD 0.85<br>N：' + a6.res.N.toFixed(1) + ' vs ' + b6.res.N.toFixed(1);
        text = '同样的规格，乙醇–水的台阶在塔顶附近被挤压：平衡线在恒沸点附近几乎贴着对角线（切点夹紧）。再提高 xD，级数会急剧增加并最终不可能。';
      } else if (st.pair === 'single') {
        shared = false;
        var z = 0.5, f = 0.5;
        var fl = T.flash(bt, z, f), ry = T.rayleigh(bt, z, f);
        A = { title: '闪蒸 · V/F = 0.5', kind: 'flash', eq: bt, fl: fl, z: z, cards: [['蒸汽 y', fl.y.toFixed(3), '与最终液体平衡', 'hi'], ['液体 x', fl.x.toFixed(3), '', 'warm'], ['温度', fl.T.toFixed(1) + ' °C', '恒温操作', '']] };
        B = { title: '简单蒸馏 · D/F = 0.5', kind: 'rayleigh', eq: bt, ry: ry, z: z, cards: [['馏出平均 x̄D', ry.xDavg.toFixed(3), '比闪蒸更富', 'hi'], ['釜残 xW', ry.xW.toFixed(3), '比闪蒸更贫', 'warm'], ['釜温', ry.T0.toFixed(1) + '→' + ry.Tend.toFixed(1) + ' °C', '温度不断升高', '']] };
        delta = '轻组分：' + fl.y.toFixed(3) + ' vs ' + ry.xDavg.toFixed(3);
        text = '同样蒸出一半，简单蒸馏的平均馏出物（' + ry.xDavg.toFixed(3) + '）比闪蒸蒸汽（' + fl.y.toFixed(3) + '）更富轻组分：蒸汽一产生就离开，不会与越来越贫的液体“重新平衡”。';
      } else if (st.pair === 'rigorous') {
        shared = false;
        var A = DL.aspen.radfrac, sp = A.spec;
        var r = T.rateColumn(bt, { N: sp.N - 1, feedStage: sp.feedStage - 1, R: sp.R, DF: sp.DF, xF: sp.z });
        var mx = [r.xD].concat(r.stages.map(function (q) { return q.x; }));
        var stagesX = { min: 1, max: 16, label: '级（1 = 全凝器，16 = 再沸器）', ticks: [1, 4, 8, 12, 16] };
        var lam = (T.COMPONENTS.benzene.hvap + T.COMPONENTS.toluene.hvap) / 2;
        var qrModel = r.Vb * sp.F * lam * 1000 / 3600;
        var dmax = 0; mx.forEach(function (v, i) { dmax = Math.max(dmax, Math.abs(v - A.x[i])); });
        A = DL.aspen.radfrac;
        var cmoL = sp.R * sp.DF * sp.F, cmoV = (sp.R + 1) * sp.DF * sp.F;
        var Aside = A;
        A = {
          title: '液相组成分布', kind: 'custom', x: stagesX, y: { min: 0, max: 1, label: '液相苯摩尔分数' },
          draw: function (g) {
            g.grid().open();
            g.vline(sp.feedStage, { c: 'var(--yellow)', w: 1, dash: '3 3' });
            g.text(sp.feedStage, 0.04, '进料级', { dx: 5, c: 'var(--yellow)', size: 9.5 });
            g.path(mx.map(function (v, i) { return [i + 1, v]; }), { c: 'var(--cyan)', w: 2.2 });
            Aside.x.forEach(function (v, i) { g.dot(i + 1, v, { c: 'var(--text)', r: 3 }); });
            g.label(g.area.x1 - 8, g.area.y0 + 14, '线：恒摩尔流模型　点：Aspen RadFrac', { anchor: 'end', c: 'var(--muted)', size: 10, sans: true });
            g.close();
          },
          cards: [['塔顶 xD · 模型', r.xD.toFixed(4), 'Aspen ' + Aside.x[0].toFixed(4), 'hi'], ['塔底 xW · 模型', r.xW.toFixed(4), 'Aspen ' + Aside.x[15].toFixed(4), 'warm'], ['逐级最大偏差', dmax.toFixed(3), '液相苯摩尔分数', '']]
        };
        B = {
          title: '级间流率分布', kind: 'custom', x: stagesX, y: { min: 0, max: 200, label: '流率 / kmol·h⁻¹' },
          draw: function (g) {
            g.grid().open();
            g.path([[2, cmoL], [sp.feedStage - 1, cmoL]], { c: 'var(--cyan)', w: 2 });
            g.path([[sp.feedStage, cmoL + sp.F], [15, cmoL + sp.F]], { c: 'var(--cyan)', w: 2 });
            g.path([[2, cmoV], [16, cmoV]], { c: 'var(--orange)', w: 2 });
            for (var i = 1; i < 15; i++) g.dot(i + 1, Aside.L[i], { c: 'var(--cyan)', r: 3, stroke: 'var(--text)' });
            for (var k = 1; k < 16; k++) g.dot(k + 1, Aside.V[k], { c: 'var(--orange)', r: 3, stroke: 'var(--text)' });
            g.label(g.area.x1 - 8, g.area.y1 - 22, '青：液相 L　橙：汽相 V', { anchor: 'end', c: 'var(--muted)', size: 10, sans: true });
            g.label(g.area.x1 - 8, g.area.y1 - 8, '线：恒摩尔流　点：Aspen', { anchor: 'end', c: 'var(--muted)', size: 10, sans: true });
            g.close();
          },
          cards: [['进料上方 L · Aspen', Aside.L[6].toFixed(1), '恒摩尔流 ' + cmoL.toFixed(1), 'warm'], ['再沸蒸汽 · Aspen', Aside.boilup.toFixed(1), '恒摩尔流 ' + cmoV.toFixed(1), 'warm'], ['再沸器负荷 · Aspen', ui.fmt.num(Aside.Qr, 0) + ' kW', '模型 ≈ ' + ui.fmt.num(qrModel, 0) + ' kW', 'hi']]
        };
        delta = 'xD：' + r.xD.toFixed(4) + ' vs ' + Aside.x[0].toFixed(4) + '<br>xW：' + r.xW.toFixed(4) + ' vs ' + Aside.x[15].toFixed(4) + '<br>逐级最大偏差 ' + dmax.toFixed(3);
        text = '同一座塔（15 个平衡级、第 8 级进料、R = 1.9、D/F = 0.45），左侧线是本页的恒摩尔流模型，点是 <b>Aspen Plus V15 RadFrac</b> 严格计算（IDEAL 物性）。组成分布几乎重合，xD 只差 ' + (r.xD - Aside.x[0]).toFixed(4) + '。差别主要来自流率：甲苯的汽化潜热比苯大，严格能量衡算下汽、液摩尔流沿塔逐级变化（右图的点），而恒摩尔流假设它们是常数（右图的线）。';
      } else {
        var e1 = T.makeEq('bt', { P: T.mmHg(101.325) }), e2 = T.makeEq('bt', { P: T.mmHg(20) });
        var a8 = design(e1, base), b8 = design(e2, base);
        var top = function (d) { return d.res.stages[0].T.toFixed(0) + '/' + d.res.stages[d.res.stages.length - 1].T.toFixed(0) + ' °C'; };
        A = { title: '101.3 kPa', kind: 'mccabe', eq: e1, res: a8.res, cards: mcCards(a8, ['塔顶 / 塔底温度', top(a8), 'α ≈ ' + e1.alpha(0.5).toFixed(2), '']) };
        B = { title: '20 kPa', kind: 'mccabe', eq: e2, res: b8.res, cards: mcCards(b8, ['塔顶 / 塔底温度', top(b8), 'α ≈ ' + e2.alpha(0.5).toFixed(2), 'hi']) };
        delta = '温度降低约 ' + (a8.res.stages[0].T - b8.res.stages[0].T).toFixed(0) + ' K<br>N：' + a8.res.N.toFixed(1) + ' → ' + b8.res.N.toFixed(1);
        text = '减压到 20 kPa：塔内温度整体下降约 45–50 K，α 由 ' + e1.alpha(0.5).toFixed(2) + ' 增至 ' + e2.alpha(0.5).toFixed(2) + '，所需级数也随之减少；代价是真空系统和更大的塔径（低压蒸汽体积大）。';
      }
      setSide(0, A); setSide(1, B);
      xFCtl.el.style.display = xDCtl.el.style.display = xWCtl.el.style.display = shared ? '' : 'none';
      sharedNote.innerHTML = shared ? '两侧使用完全相同的规格，只改变所选变量。' : '这一组使用固定的演示规格，共同条件滑块不适用。';
      deltaBox.innerHTML = delta;
      note.innerHTML = text;
    }
    function apply(p) { Object.assign(st, p || {}); sync(); }
    sync();
    return { apply: apply, destroy: function () { sides.forEach(function (s) { s.chart.destroy(); }); } };
  }

  DL.registerModule({
    id: 'J', slug: 'compare', order: 10,
    title: '同步对比实验室', en: 'COMPARE',
    subtitle: '同一起点，只改一个变量',
    hint: '左右两侧使用相同的规格；只有标题里那一个变量不同。',
    scenes: [
      { title: '低回流 vs 高回流', body: '同样的分离任务：1.2 Rmin 需要更多塔板，2.5 Rmin 塔板少但能耗高。<b>级数与能耗此消彼长</b>。', patch: { pair: 'reflux', xF: 0.45, xD: 0.95, xW: 0.05 }, guide: '比较两侧的 N 与 kW。', duration: 11000 },
      { title: '饱和液 vs 饱和蒸汽进料', body: '进料热状态改变 q 线方向与 Rmin。蒸汽进料时 Rmin 变大，再沸器负荷转移到了进料预热上。', patch: { pair: 'q' }, guide: '看两侧 q 线（黄色虚线）的方向。', duration: 11000 },
      { title: '易分离 vs 难分离', body: 'α 从 2.5 降到 1.4：平衡线贴近对角线，级数与回流比一起膨胀。', patch: { pair: 'alpha' }, guide: '右侧台阶又密又矮。', duration: 11000 },
      { title: '最优 vs 偏离进料', body: '进料位置偏离最优点，同样的回流比需要更多级数。', patch: { pair: 'feed' }, guide: '对比两侧黄色编号的进料级。', duration: 11000 },
      { title: '理论板 vs 实际板', body: 'Murphree 效率 60%：伪平衡线代替平衡线，台阶变矮、级数增加。', patch: { pair: 'eff' }, guide: '右侧虚线是伪平衡线。', duration: 11000 },
      { title: '理想体系 vs 恒沸体系', body: '同样规格下，乙醇–水在塔顶附近出现切点夹紧，级数显著多于苯–甲苯。', patch: { pair: 'system' }, guide: '右侧红点是恒沸点。', duration: 11000 },
      { title: '闪蒸 vs 简单蒸馏', body: '同样蒸出一半：简单蒸馏的馏出物更富、釜残更贫，但两者都只是一个平衡级。', patch: { pair: 'single' }, guide: '右侧黄线是釜液组成沿泡点线的轨迹。', duration: 11000 },
      { title: '常压 vs 减压', body: '20 kPa 下塔内温度下降约 45–50 K，α 增大，所需级数减少。', patch: { pair: 'pressure', xF: 0.45, xD: 0.95, xW: 0.05 }, guide: '对比两侧的塔顶 / 塔底温度。', duration: 11000 },
      { title: '简化模型 vs Aspen 严格模拟', body: '同一座苯–甲苯塔：左图组成分布，线是本页的恒摩尔流计算，点是 Aspen Plus V15 RadFrac。两者几乎重合；右图显示真正的差别——严格能量衡算下汽、液流率沿塔逐级变化。', patch: { pair: 'rigorous' }, guide: '看右图：点（Aspen）偏离水平线（恒摩尔流）多少。', duration: 13000 }
    ],
    quiz: [
      {
        q: '在同步对比中“只改变一个变量”的目的是什么？',
        options: ['让图更好看', '把结果的差异归因到这个变量上', '减少计算量', '保证两侧级数相同'],
        answer: 1,
        explain: '其余条件相同，差异才能<b>归因</b>于被改变的那个变量——这就是对照实验。'
      },
      {
        q: '其他条件相同，把回流比从 1.2 Rmin 提高到 2.5 Rmin，最可能的结果是？',
        options: ['N 减少，再沸器负荷增加', 'N 增加，再沸器负荷减少', '两者都减少', '两者都不变'],
        answer: 0,
        explain: '回流加大，操作线远离平衡线，<b>级数减少</b>；V = (R+1)D，<b>热负荷增加</b>。'
      },
      {
        q: '苯–甲苯从 101.3 kPa 减压到 20 kPa 精馏，下列说法正确的是？',
        options: ['α 减小，需要更多级', '温度降低且 α 增大', '温度升高', '恒沸点出现'],
        answer: 1,
        explain: '降压使沸腾温度下降约 45–50 K，此体系的 <b>α 随温度降低而增大</b>（约 2.5 → 3.0）。'
      }
    ],
    mount: mount
  });
})();
