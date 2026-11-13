/* Module D — reflux vs stages vs energy: Fenske–Underwood–Gilliland and a relative cost curve. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, T = DL.thermo, plot = DL.plot;

  var DEFAULT = { alpha: 2.5, xF: 0.5, q: 1, xD: 0.95, xW: 0.05, rf: 1.3, F: 100, lam: 32, wE: 1, wC: 1 };

  // Relative cost model (illustrative): shell ∝ N·√V, exchangers ∝ V^0.65, energy ∝ V.
  var K_SHELL = 0.055, K_HX = 0.45, K_E = 1.0;

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage, panel = ctx.panel;
    var data = null;

    var row = ui.el('div', 'stage-row c2');
    var h1 = ui.el('div'), h2 = ui.el('div');
    row.appendChild(h1); row.appendChild(h2);
    var cards = ui.el('div', 'cards');
    var note = ui.el('p', 'stage-note');
    stage.appendChild(row); stage.appendChild(cards); stage.appendChild(note);

    var c1 = plot.chart(h1, {
      label: '理论级数与回流比', title: '理论级数 N <b>vs</b> R / Rmin',
      x: { min: 1, max: 4, label: 'R / Rmin' }, y: { min: 0, max: 40, label: '理论级数 N（含再沸器）' },
      hover: function (x) {
        if (!data) return null;
        var p = interpCurve(data.curve, x);
        if (!p) return null;
        return { html: 'R/Rmin = ' + x.toFixed(2) + '<br>R = ' + (x * data.Rmin).toFixed(3) + '<br>逐级：N = ' + p.N.toFixed(2) + '<br>Gilliland：N ≈ ' + p.G.toFixed(2), vx: x, marks: [[x, p.N, 'var(--cyan)']] };
      }
    });
    var c2 = plot.chart(h2, {
      label: '相对年成本与回流比', title: '相对年成本 <b>（示意模型）</b>',
      x: { min: 1, max: 4, label: 'R / Rmin' }, y: { min: 0, max: 4, label: '相对成本' },
      hover: function (x) {
        if (!data) return null;
        var p = interpCurve(data.curve, x);
        if (!p) return null;
        return { html: 'R/Rmin = ' + x.toFixed(2) + '<br>设备 ' + p.cap.toFixed(2) + ' · 能耗 ' + p.en.toFixed(2) + '<br><b>合计 ' + (p.cap + p.en).toFixed(2) + '</b>', vx: x };
      }
    });
    function interpCurve(c, x) {
      for (var i = 1; i < c.length; i++) {
        if (c[i].rf >= x) {
          var a = c[i - 1], b = c[i], t = (x - a.rf) / (b.rf - a.rf);
          return { N: a.N + t * (b.N - a.N), G: a.G + t * (b.G - a.G), cap: a.cap + t * (b.cap - a.cap), en: a.en + t * (b.en - a.en) };
        }
      }
      return null;
    }

    var cardRefs = {};
    [['nmin', 'Fenske 最少级数 Nmin'], ['rmin', 'Underwood 最小回流 Rmin'], ['n', '理论级数 N'], ['q', '再沸器 / 冷凝器负荷']].forEach(function (c) {
      var el = ui.el('div', 'card', '<span>' + c[1] + '</span><b>—</b><small></small>');
      cards.appendChild(el); cardRefs[c[0]] = el;
    });
    function setCard(k, v, sub, tone) { var el = cardRefs[k]; el.querySelector('b').textContent = v; el.querySelector('small').textContent = sub || ''; el.className = 'card' + (tone ? ' ' + tone : ''); }

    var gA = ui.section(panel, '分离难度', 'SEPARATION');
    var aCtl = ui.slider({ label: '相对挥发度 α（恒定）', min: 1.15, max: 5, step: 0.05, value: st.alpha, onInput: function (v) { st.alpha = v; sync(); } });
    var xFCtl = ui.slider({ label: '进料 xF', min: 0.1, max: 0.9, step: 0.01, value: st.xF, onInput: function (v) { st.xF = v; sync(); } });
    var qCtl = ui.slider({ label: '进料热状态 q', min: 0, max: 1.3, step: 0.05, value: st.q, onInput: function (v) { st.q = v; sync(); } });
    var xDCtl = ui.slider({ label: '塔顶 xD', min: 0.8, max: 0.995, step: 0.005, value: st.xD, onInput: function (v) { st.xD = v; sync(); } });
    var xWCtl = ui.slider({ label: '塔底 xW', min: 0.005, max: 0.2, step: 0.005, value: st.xW, onInput: function (v) { st.xW = v; sync(); } });
    [aCtl, xFCtl, qCtl, xDCtl, xWCtl].forEach(function (c) { gA.appendChild(c.el); });
    var gR = ui.section(panel, '回流与能量', 'REFLUX / ENERGY');
    var rfCtl = ui.slider({ label: 'R / Rmin', min: 1.02, max: 4, step: 0.01, value: st.rf, onInput: function (v) { st.rf = v; sync(); } });
    var FCtl = ui.slider({ label: '进料量 F', min: 10, max: 500, step: 5, value: st.F, unit: 'kmol/h', onInput: function (v) { st.F = v; sync(); } });
    var lamCtl = ui.slider({ label: '平均汽化潜热 λ', min: 20, max: 45, step: 0.5, value: st.lam, unit: 'kJ/mol', onInput: function (v) { st.lam = v; sync(); } });
    [rfCtl, FCtl, lamCtl].forEach(function (c) { gR.appendChild(c.el); });
    var gC = ui.section(panel, '成本权重（示意）', 'COST');
    var wECtl = ui.slider({ label: '能源价格系数', min: 0.3, max: 3, step: 0.05, value: st.wE, onInput: function (v) { st.wE = v; sync(); } });
    var wCCtl = ui.slider({ label: '设备费系数', min: 0.3, max: 3, step: 0.05, value: st.wC, onInput: function (v) { st.wC = v; sync(); } });
    gC.appendChild(wECtl.el); gC.appendChild(wCCtl.el);
    gC.appendChild(ui.note('成本曲线只用来表达“设备费 vs 能耗”的此消彼长：塔体 ∝ N·√V，换热器 ∝ V<sup>0.65</sup>，能耗 ∝ V。不是估价工具。'));
    var gM = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 'R', label: '回流比 R' }, { key: 'opt', label: '成本最低的 R / Rmin' },
      { key: 'D', label: '馏出量 D' }, { key: 'V', label: '塔顶蒸汽量 V' },
      { key: 'theta', label: 'Underwood 根 θ' }, { key: 'X', label: 'Gilliland X / Y' }
    ]);
    gM.appendChild(m.el);
    var formula = ui.formula(''); gM.appendChild(formula);
    var gZ = ui.section(panel);
    gZ.appendChild(ui.row([ui.reset(function () { Object.assign(st, DEFAULT); sync(); })]));

    function compute() {
      var eq = T.makeEq('alpha', { alpha: st.alpha });
      var nmF = T.fenske(st.xD, st.xW, st.alpha);
      var uw = T.underwood(st.alpha, st.xF, st.q, st.xD);
      var Rmin = Math.max(0.05, uw.Rmin); // floor: a very rich feed can make Underwood's Rmin ≤ 0
      var D = st.F * (st.xF - st.xW) / (st.xD - st.xW);
      var V0 = (1.3 * Rmin + 1) * D;
      var curve = [];
      for (var rf = 1.01; rf <= 4.001; rf += rf < 1.2 ? 0.01 : 0.05) {
        var R = rf * Rmin;
        var res = T.mccabe(eq, { xF: st.xF, q: st.q, xD: st.xD, xW: st.xW, R: R, maxStages: 400 });
        var N = res.N;
        var G = T.gilliland(R, Rmin, nmF).N; // Fenske/Gilliland stages already include the partial reboiler
        var V = (R + 1) * D;
        var cap = st.wC * (K_SHELL * (isFinite(N) ? N : 400) * Math.sqrt(V / V0) + K_HX * Math.pow(V / V0, 0.65));
        var en = st.wE * K_E * V / V0;
        curve.push({ rf: rf, R: R, N: N, G: G, cap: cap, en: en, tot: cap + en });
      }
      var best = curve.reduce(function (a, b) { return b.tot < a.tot ? b : a; });
      var R = st.rf * Rmin;
      var cur = T.mccabe(eq, { xF: st.xF, q: st.q, xD: st.xD, xW: st.xW, R: R, maxStages: 400 });
      var gil = T.gilliland(R, Rmin, nmF);
      var V = (R + 1) * D, Vb = V - (1 - st.q) * st.F;
      return { eq: eq, nmF: nmF, Rmin: Rmin, theta: uw.theta, curve: curve, best: best, R: R, cur: cur, gil: gil, D: D, V: V, Vb: Vb };
    }

    function sync() {
      if (!(st.xD > st.xF + 0.02 && st.xF > st.xW + 0.02)) { st.xF = Math.min(Math.max(st.xF, st.xW + 0.03), st.xD - 0.03); }
      [[aCtl, st.alpha], [xFCtl, st.xF], [qCtl, st.q], [xDCtl, st.xD], [xWCtl, st.xW], [rfCtl, st.rf], [FCtl, st.F], [lamCtl, st.lam], [wECtl, st.wE], [wCCtl, st.wC]].forEach(function (p) { p[0].set(p[1], true); });
      data = compute();
      var d = data;
      var yMax = Math.max(10, Math.ceil(Math.min(d.nmF * 4.2 + 4, 120) / 5) * 5);
      c1.setAxes(null, { min: 0, max: yMax, label: '理论级数 N（含再沸器）' });
      c1.draw(function (g) {
        g.grid().open();
        g.hline(d.nmF, { c: 'var(--violet)', w: 1, dash: '4 3' });
        g.text(3.95, d.nmF, 'Nmin ≈ ' + d.nmF.toFixed(1) + '（Fenske，含再沸器）', { dy: -5, anchor: 'end', c: 'var(--violet)', size: 9.5 });
        g.vline(1, { c: 'var(--red)', w: 1.2, dash: '4 3' });
        g.text(1, yMax, 'Rmin', { dx: 5, dy: 14, c: 'var(--red)' });
        g.path(d.curve.map(function (p) { return [p.rf, p.G]; }), { c: 'var(--violet)', w: 1.6, dash: '6 3' });
        g.path(d.curve.map(function (p) { return [p.rf, Math.min(p.N, yMax * 1.5)]; }), { c: 'var(--cyan)', w: 2.4 });
        if (isFinite(d.cur.N)) { g.dot(st.rf, d.cur.N, { c: 'var(--yellow)', r: 5 }); g.text(st.rf, d.cur.N, 'N = ' + d.cur.N.toFixed(1), { dx: 8, dy: -8, c: 'var(--text)' }); }
        g.vline(d.best.rf, { c: 'var(--green)', w: 1, dash: '2 3' });
        g.label(g.area.x1 - 8, g.area.y0 + 14, '实线：逐级（McCabe–Thiele）', { anchor: 'end', c: 'var(--cyan)', size: 10, sans: true });
        g.label(g.area.x1 - 8, g.area.y0 + 29, '虚线：Gilliland 估算', { anchor: 'end', c: 'var(--violet)', size: 10, sans: true });
        g.close();
      });
      var tops = d.curve.map(function (p) { return p.tot; });
      var yM = Math.max(2, Math.min(Math.max.apply(null, tops.slice(Math.floor(tops.length * 0.25))) * 1.15, d.best.tot * 3));
      c2.setAxes(null, { min: 0, max: Math.ceil(yM * 2) / 2, label: '相对年成本' });
      c2.draw(function (g) {
        g.grid().open();
        g.path(d.curve.map(function (p) { return [p.rf, p.cap]; }), { c: 'var(--blue)', w: 1.8 });
        g.path(d.curve.map(function (p) { return [p.rf, p.en]; }), { c: 'var(--orange)', w: 1.8 });
        g.path(d.curve.map(function (p) { return [p.rf, p.tot]; }), { c: 'var(--text)', w: 2.4 });
        g.dot(d.best.rf, d.best.tot, { c: 'var(--green)', r: 5 });
        g.text(d.best.rf, d.best.tot, '最低 ' + d.best.rf.toFixed(2) + ' Rmin', { dx: 8, dy: 16, c: 'var(--green)' });
        g.vline(st.rf, { c: 'var(--yellow)', w: 1, dash: '2 3' });
        g.label(g.area.x1 - 8, g.area.y0 + 14, '设备费', { anchor: 'end', c: 'var(--blue)', size: 10, sans: true });
        g.label(g.area.x1 - 8, g.area.y0 + 29, '能耗费', { anchor: 'end', c: 'var(--orange)', size: 10, sans: true });
        g.label(g.area.x1 - 8, g.area.y0 + 44, '合计', { anchor: 'end', c: 'var(--text)', size: 10, sans: true });
        g.close();
      });
      var qr = d.Vb * st.lam * 1000 / 3600, qc = d.V * st.lam * 1000 / 3600;
      setCard('nmin', d.nmF.toFixed(2), '全回流 · 含再沸器（逐级 ' + T.nmin(d.eq, st.xD, st.xW).N.toFixed(2) + '）', '');
      setCard('rmin', d.Rmin.toFixed(3), '当前 R = ' + d.R.toFixed(3), '');
      setCard('n', isFinite(d.cur.N) ? d.cur.N.toFixed(2) : '∞', 'Gilliland 估 ' + d.gil.N.toFixed(2) + ' · 偏差 ' + (isFinite(d.cur.N) ? ((d.gil.N - d.cur.N) / d.cur.N * 100).toFixed(0) + '%' : '—'), 'hi');
      setCard('q', ui.fmt.num(qr, 0) + ' kW', '冷凝器 ' + ui.fmt.num(qc, 0) + ' kW', 'warm');
      m.set({
        R: d.R.toFixed(3), opt: d.best.rf.toFixed(2),
        D: d.D.toFixed(1) + ' kmol/h', V: d.V.toFixed(1) + ' kmol/h',
        theta: d.theta.toFixed(4), X: d.gil.X.toFixed(3) + ' / ' + d.gil.Y.toFixed(3)
      }, { opt: 'hi' });
      formula.innerHTML = 'Fenske：Nmin = ln[(xD/(1−xD))·((1−xW)/xW)] / ln α = <b>' + d.nmF.toFixed(2) + '</b>' +
        '<br>Underwood：αxF/(α−θ) + (1−xF)/(1−θ) = 1 − q → Rmin = <b>' + d.Rmin.toFixed(3) + '</b>' +
        '<br>Gilliland（Eduljee）：Y = 0.75(1 − X<sup>0.5668</sup>)，X = (R−Rmin)/(R+1)，Y = (N−Nmin)/(N+1)' +
        '<br>Q<sub>R</sub> ≈ V′·λ，V′ = (R+1)D − (1−q)F';
      note.innerHTML = '在 R = <b>' + st.rf.toFixed(2) + ' Rmin</b> 下需要约 <b>' + (isFinite(d.cur.N) ? d.cur.N.toFixed(1) : '∞') + '</b> 个理论级，再沸器约 <b>' + ui.fmt.num(qr, 0) + ' kW</b>。' +
        '回流比靠近 Rmin 时级数飙升，远离时能耗线性增长；按当前权重，总成本最低点在 <b>' + d.best.rf.toFixed(2) + ' Rmin</b>（工程经验常取 1.1–1.5 Rmin）。';
    }
    function apply(p) { Object.assign(st, p || {}); sync(); }
    sync();
    return { apply: apply, destroy: function () { c1.destroy(); c2.destroy(); } };
  }

  DL.registerModule({
    id: 'D', slug: 'shortcut', order: 4,
    title: '回流比、能耗与简捷法', en: 'REFLUX & ENERGY',
    subtitle: 'Fenske、Underwood、Gilliland 与最优回流比',
    hint: '拖动 R / Rmin，同时看级数与成本两条曲线。',
    scenes: [
      {
        title: '两个极限',
        body: '同一个分离任务有两个极限：<b>Rmin</b>（左侧红线）时需要无穷多级；<b>全回流</b>时级数最少（Nmin，紫色水平线）但没有产品。真实设计落在两者之间。',
        patch: { alpha: 2.5, xF: 0.5, q: 1, xD: 0.95, xW: 0.05, rf: 1.3, wE: 1, wC: 1 }, guide: '左图实线从 Rmin 处向上无限延伸，右端逼近 Nmin。', duration: 12000
      },
      {
        title: 'Fenske：全回流的最少级数',
        body: '恒定 α 时，全回流下每一级都把“轻/重比”乘以 α。所以 <code>Nmin = ln(S)/ln α</code>，S 是塔顶与塔底轻重比之比。α = 2.5、xD = 0.95、xW = 0.05 时 Nmin ≈ 6.4。',
        patch: { rf: 3.5 }, guide: '读数卡片“Fenske 最少级数”。', duration: 12000
      },
      {
        title: 'Underwood：最小回流比',
        body: 'Underwood 方程先求一个根 θ（介于两组分 α 之间），再算出 Rmin。对二元恒 α 体系，它与 McCabe–Thiele 图上“进料处夹紧”的结果完全一致：这里 Rmin = 1.10。',
        patch: { rf: 1.05 }, guide: '在 1.05 Rmin 附近，N 已经很大。', duration: 12000
      },
      {
        title: 'Gilliland：从两个极限估算 N',
        body: 'Gilliland 关联把 (R−Rmin)/(R+1) 与 (N−Nmin)/(N+1) 联系起来，只需 Nmin、Rmin 就能估出任意 R 下的级数。虚线是估算，实线是逐级结果，常见偏差在 10% 左右。',
        patch: { rf: 1.5 }, guide: '比较同一 R 下虚线与实线的差距。', duration: 12000
      },
      {
        title: '能耗随回流线性增长',
        body: '塔顶蒸汽量 V = (R+1)D，冷凝器与再沸器负荷都与它成正比。从 1.3 Rmin 提高到 3 Rmin，能耗增加约 80%，而级数只从约 13 级减到约 9 级。',
        patch: { rf: 3 }, guide: '看右图橙色能耗线和卡片里的 kW。', duration: 12000
      },
      {
        title: '总成本有一个最低点',
        body: '设备费在 Rmin 附近因级数无穷而飙升，能耗费随 R 线性增加，两者相加形成 U 形曲线。按这里的示意权重，最低点在约 1.1–1.3 Rmin。',
        patch: { rf: 1.25, wE: 1, wC: 1 }, guide: '绿色点是总成本最低处。', duration: 12000
      },
      {
        title: '能源变贵，最优回流比左移',
        body: '把能源价格系数提高到 2.5：能耗费曲线变陡，最优点向 Rmin 靠近——宁可多装几块塔板，也要省蒸汽。反之设备昂贵时，最优点右移。',
        patch: { wE: 2.5, wC: 1 }, guide: '绿色最低点的位置变化。', duration: 12000
      },
      {
        title: '难分离：所有数字一起变大',
        body: '把 α 降到 1.3：Nmin 从约 6 级涨到 20 级以上，Rmin 也大幅增加。能耗与 α−1 大致成反比，这就是为什么挥发度相近的体系（如同分异构体）分离代价极高。',
        patch: { alpha: 1.3, wE: 1, rf: 1.3 }, guide: '看 Nmin、Rmin 与 kW 同时变大。', duration: 13000
      }
    ],
    mount: mount
  });
})();
