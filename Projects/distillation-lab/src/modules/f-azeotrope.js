/* Module F — azeotropes and how to get past them: pressure-swing, extractive, heterogeneous azeotropic. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, T = DL.thermo, plot = DL.plot;

  var DEFAULT = { mode: 'limit', sys: 'ew', P: 101.325, xD: 0.85, Plo: 20, Phi: 1000, xS: 0.5 };
  var extCache = {};
  function extractiveAt(xS) {
    var k = xS.toFixed(3);
    if (!extCache[k]) extCache[k] = DL.thermo.extractive(xS, DL.thermo.ATM, 70);
    return extCache[k];
  }
  /** Azeotrope interpolated from the Aspen Plus V15 Txy export at pressure P (kPa), if available. */
  function aspenAz(P) {
    if (!DL.aspen) return null;
    var keys = Object.keys(DL.aspen.txy), key = null;
    keys.forEach(function (k) { if (Math.abs(+k - P) / +k < 0.02) key = k; });
    if (!key) return null;
    var d = DL.aspen.txy[key];
    for (var i = 1; i < d.length; i++) {
      var a = d[i - 1], b = d[i], d0 = a[1] - a[0], d1 = b[1] - b[0];
      if (a[0] > 0 && b[0] < 1 && d0 * d1 < 0) { var t = d0 / (d0 - d1); return { x: a[0] + t * (b[0] - a[0]), T: a[2] + t * (b[2] - a[2]), P: +key }; }
    }
    return null;
  }

  function colSvg(x, y, w, h, n) {
    var s = '<rect class="s-shell" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="12"/>';
    for (var i = 1; i < n; i++) {
      var yy = y + h * i / n, left = i % 2 === 0;
      s += '<path class="s-line" d="M' + (left ? x + 4 : x + w * 0.22) + ' ' + yy + ' H' + (left ? x + w * 0.78 : x + w - 4) + '"/>';
    }
    return s;
  }
  function arrowHead(x, y, dir, cls) {
    var d = dir === 'r' ? 'M' + (x - 8) + ' ' + (y - 5) + ' L' + x + ' ' + y + ' L' + (x - 8) + ' ' + (y + 5)
      : dir === 'l' ? 'M' + (x + 8) + ' ' + (y - 5) + ' L' + x + ' ' + y + ' L' + (x + 8) + ' ' + (y + 5)
      : dir === 'd' ? 'M' + (x - 5) + ' ' + (y - 8) + ' L' + x + ' ' + y + ' L' + (x + 5) + ' ' + (y - 8)
      : 'M' + (x - 5) + ' ' + (y + 8) + ' L' + x + ' ' + y + ' L' + (x + 5) + ' ' + (y + 8);
    return '<path class="' + cls + '" d="' + d + '"/>';
  }
  function t(x, y, s, cls, anchor) { return '<text class="' + (cls || 's-mono') + '" x="' + x + '" y="' + y + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + s + '</text>'; }

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage, panel = ctx.panel;

    var row = ui.el('div', 'stage-row c2');
    var h1 = ui.el('div'), right = ui.el('div', 'stage-stack'), sch = ui.el('div', 'schem fixed');
    var cards = ui.el('div', 'cards c2');
    right.appendChild(sch); right.appendChild(cards);
    row.appendChild(h1); row.appendChild(right);
    var note = ui.el('p', 'stage-note');
    stage.appendChild(row); stage.appendChild(note);

    var chart = plot.chart(h1, {
      label: '恒沸体系 x–y 图', square: true, title: '<b id="fTitle">x–y</b>',
      x: { min: 0, max: 1, label: '液相 x（轻组分 / 溶剂无基）' }, y: { min: 0, max: 1, label: '气相 y' }
    });
    var cardRefs = {};
    [['a', '—'], ['b', '—'], ['c', '—'], ['d', '—']].forEach(function (c) {
      var el = ui.el('div', 'card', '<span>' + c[1] + '</span><b>—</b><small></small>');
      cards.appendChild(el); cardRefs[c[0]] = el;
    });
    function setCard(k, label, v, sub, tone) { var el = cardRefs[k]; el.querySelector('span').textContent = label; el.querySelector('b').textContent = v; el.querySelector('small').textContent = sub || ''; el.className = 'card' + (tone ? ' ' + tone : ''); }

    var gMode = ui.section(panel, '方法', 'METHOD');
    var modeCtl = ui.seg({ options: [{ value: 'limit', label: '普通精馏的极限' }, { value: 'psd', label: '变压精馏' }, { value: 'extractive', label: '萃取精馏' }, { value: 'hetero', label: '非均相共沸精馏' }], value: st.mode, onChange: function (v) { st.mode = v; sync(); } });
    gMode.appendChild(modeCtl.el);
    var gL = ui.section(panel, '普通精馏', 'LIMIT');
    var sysCtl = ui.seg({ options: [{ value: 'ew', label: '乙醇–水（最低恒沸）' }, { value: 'ac', label: '丙酮–氯仿（最高恒沸）' }], value: st.sys, onChange: function (v) { st.sys = v; st.xD = v === 'ew' ? 0.85 : 0.97; sync(); } });
    var PCtl = ui.slider({ label: '操作压力', min: 15, max: 1000, step: 1, value: st.P, unit: 'kPa', onInput: function (v) { st.P = v; sync(); } });
    var xDCtl = ui.slider({ label: '塔顶目标 xD', min: 0.6, max: 0.99, step: 0.002, value: st.xD, onInput: function (v) { st.xD = v; sync(); } });
    [sysCtl, PCtl, xDCtl].forEach(function (c) { gL.appendChild(c.el); });
    var gP = ui.section(panel, '变压精馏', 'PRESSURE SWING');
    var PloCtl = ui.slider({ label: '塔 1 压力（低压）', min: 15, max: 101, step: 1, value: st.Plo, unit: 'kPa', onInput: function (v) { st.Plo = v; sync(); } });
    var PhiCtl = ui.slider({ label: '塔 2 压力（高压）', min: 101, max: 1500, step: 10, value: st.Phi, unit: 'kPa', onInput: function (v) { st.Phi = v; sync(); } });
    gP.appendChild(PloCtl.el); gP.appendChild(PhiCtl.el);
    var gE = ui.section(panel, '萃取精馏', 'EXTRACTIVE');
    var SFCtl = ui.slider({ label: '萃取段液相中乙二醇摩尔分数 x_EG', min: 0, max: 0.8, step: 0.01, value: st.xS, onInput: function (v) { st.xS = v; sync(); } });
    gE.appendChild(SFCtl.el);
    gE.appendChild(ui.note('乙醇–水–乙二醇三元 NRTL 泡点计算（参数：Aspen Plus V15 APV150；乙二醇蒸气压：NIST WebBook），按溶剂无基组成 x′ = x<sub>乙醇</sub>/(x<sub>乙醇</sub> + x<sub>水</sub>) 作图。萃取段内溶剂摩尔分数近似恒定。'));
    var gM = ui.section(panel, '读数', 'LIVE');
    var formula = ui.formula(''); gM.appendChild(formula);
    var warn = ui.warn(''); gM.appendChild(warn);
    var gR = ui.section(panel);
    gR.appendChild(ui.row([ui.reset(function () { Object.assign(st, DEFAULT); sync(); })]));

    function drawLimit() {
      var eq = DL.eqFor(st.sys, st.P);
      var az = eq.azeotrope;
      var ew = st.sys === 'ew';
      var xF = ew ? 0.1 : 0.65, xW = ew ? 0.02 : (az ? Math.min(0.6, az.x + 0.06) : 0.4);
      var rm = T.rmin(eq, xF, 1, st.xD);
      var res = isFinite(rm.R) && st.xD > xF ? T.mccabe(eq, { xF: xF, q: 1, xD: st.xD, xW: xW, R: 1.5 * rm.R, maxStages: 150 }) : { stages: [], infeasible: true, xF: xF, xD: st.xD, xW: xW, q: 1 };
      var tt = document.getElementById('fTitle'); if (tt) tt.textContent = eq.sys.name + ' · ' + st.P.toFixed(0) + ' kPa';
      chart.draw(function (g) {
        if (res.infeasible) { plot.mccabe(g, eq, null, {}); g.open(); g.dot(st.xD, st.xD, { c: 'var(--red)', r: 5 }); g.text(st.xD, st.xD, 'xD 不可达', { dx: -8, dy: 16, anchor: 'end', c: 'var(--red)' }); g.close(); }
        else plot.mccabe(g, eq, res, {});
      });
      var feas = !res.infeasible && !res.pinched;
      setCard('a', '恒沸组成（模型）', az ? az.x.toFixed(3) : '无', az ? (az.type === 'min' ? '最低恒沸 ' : '最高恒沸 ') + az.T.toFixed(1) + ' °C' : '', 'hi');
      setCard('b', '目标 xD', st.xD.toFixed(3), ew ? (az && st.xD >= az.x ? '越过恒沸点' : '在恒沸点以下') : '富丙酮一侧', feas ? '' : 'bad');
      setCard('c', '理论级数（1.5 Rmin）', feas ? res.N.toFixed(1) : '∞', feas ? 'Rmin = ' + rm.R.toFixed(2) : '不可能', feas ? 'warm' : 'bad');
      setCard('d', ew ? '塔底产品' : '塔底产品', ew ? '水' : '恒沸物', ew ? 'xW = 0.02' : 'x ≈ ' + (az ? az.x.toFixed(2) : '—'), '');
      sch.innerHTML = limitSvg(eq, az, ew, feas);
      formula.innerHTML = '恒沸点：y = x，α = γ₁p₁*/(γ₂p₂*) = 1' + '<br>最低恒沸（正偏差 γ &gt; 1）→ 恒沸物从塔顶出<br>最高恒沸（负偏差 γ &lt; 1）→ 恒沸物从塔底出';
      var w = [];
      if (!feas && ew) w.push('xD 越过（或贴近）恒沸组成：操作线必然碰到平衡线。');
      if (ew && Math.abs(st.P - 101.325) > 20) w.push('乙醇–水用 NRTL（Aspen Plus V15 APV150 参数）；在 20–1000 kPa 与 Aspen 的恒沸组成相差 < 0.01。文献报告恒沸点在约 9 kPa 以下消失，本模型在低压下仍给出恒沸点。');
      if (!ew && Math.abs(st.P - 101.325) > 20) w.push('丙酮–氯仿的 van Laar 参数在 1 atm 拟合，改变压力后的恒沸组成只示意方向。');
      warn.innerHTML = w.join('<br>'); warn.style.display = w.length ? '' : 'none';
      note.innerHTML = ew
        ? '乙醇–水在 ' + st.P.toFixed(0) + ' kPa 下的恒沸组成为 <b>' + (az ? az.x.toFixed(3) : '—') + '</b>。xD = ' + st.xD.toFixed(3) + (feas ? ' 需要 <b>' + res.N.toFixed(1) + '</b> 个理论级，台阶在塔顶附近挤成一团。' : ' <b>无论多少级都做不到</b>。') + ' 想得到无水乙醇，必须改变平衡本身。'
        : '丙酮–氯仿是负偏差体系：恒沸点 x ≈ <b>' + (az ? az.x.toFixed(2) : '—') + '</b> 的沸点最高，普通精馏时它从<b>塔底</b>出来；从富丙酮一侧进料只能得到纯丙酮 + 恒沸物。';
    }

    function limitSvg(eq, az, ew, feas) {
      return '<svg viewBox="0 0 460 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
        t(14, 24, '普通精馏：被恒沸点挡住', 's-title') +
        colSvg(190, 50, 64, 200, 9) +
        '<path class="s-feed" d="M70 150 H190"/>' + arrowHead(190, 150, 'r', 's-feed') + t(70, 140, 'F', 's-mono') + t(70, 170, ew ? 'x = 0.10' : 'x = 0.65', 's-small') +
        '<path class="s-light" d="M222 50 V28 H360"/>' + arrowHead(360, 28, 'r', 's-light') +
        t(366, 24, ew ? '≈ 恒沸物' : '丙酮', 's-mono') + t(366, 40, ew ? 'x ≤ ' + (az ? az.x.toFixed(3) : '—') : 'x → 1', 's-small') +
        '<path class="s-heavy" d="M222 250 V276 H360"/>' + arrowHead(360, 276, 'r', 's-heavy') +
        t(366, 272, ew ? '水' : '恒沸物', 's-mono') + t(366, 288, ew ? 'x → 0' : 'x ≈ ' + (az ? az.x.toFixed(2) : '—'), 's-small') +
        t(270, 150, feas ? '可行' : '不可行', feas ? 's-small' : 's-mono', 'start') +
        '</svg>';
    }

    function drawPSD() {
      var lo = DL.eqFor('ew', st.Plo), hi = DL.eqFor('ew', st.Phi);
      var azL = lo.azeotrope, azH = hi.azeotrope;
      var tt = document.getElementById('fTitle'); if (tt) tt.textContent = '乙醇–水 · ' + st.Plo.toFixed(0) + ' / ' + st.Phi.toFixed(0) + ' kPa';
      chart.draw(function (g) {
        g.grid().open();
        g.line(0, 0, 1, 1, { c: 'var(--dim)', w: 1, dash: '3 4' });
        g.path(plot.eqPoints(lo), { c: 'var(--cyan)', w: 2.2 });
        g.path(plot.eqPoints(hi), { c: 'var(--violet)', w: 2.2 });
        if (azL) { g.dot(azL.x, azL.x, { c: 'var(--cyan)', r: 5 }); g.text(azL.x, azL.x, azL.x.toFixed(3) + ' @' + st.Plo.toFixed(0) + ' kPa', { dx: -8, dy: -10, anchor: 'end', c: 'var(--cyan)' }); }
        if (azH) { g.dot(azH.x, azH.x, { c: 'var(--violet)', r: 5 }); g.text(azH.x, azH.x, azH.x.toFixed(3) + ' @' + st.Phi.toFixed(0) + ' kPa', { dx: 8, dy: 16, c: 'var(--violet)' }); }
        [aspenAz(st.Plo), aspenAz(st.Phi)].forEach(function (a) {
          if (!a) return;
          g.raw('<circle cx="' + g.sx(a.x) + '" cy="' + g.sy(a.x) + '" r="8" style="fill:none;stroke:var(--text);stroke-width:1.4;stroke-dasharray:2 2"/>');
        });
        if (aspenAz(st.Plo) || aspenAz(st.Phi)) g.label(g.area.x0 + 8, g.area.y0 + 14, '◌ Aspen Plus V15 恒沸点', { c: 'var(--text)', size: 10, sans: true });
        g.close();
      });
      var xB2 = 0.995, xW1 = 0.01, xF = 0.1;
      var x1 = azL ? azL.x - 0.01 : NaN, x2 = azH ? azH.x + 0.01 : NaN;
      var ok = x1 > x2 + 0.005;
      var B2 = (xF - xW1) / (xB2 - xW1);
      var D2 = ok ? B2 * (xB2 - x1) / (x1 - x2) : Infinity;
      setCard('a', '低压恒沸组成', azL ? azL.x.toFixed(3) : '—', st.Plo.toFixed(0) + ' kPa · ' + (azL ? azL.T.toFixed(1) + ' °C' : ''), 'hi');
      setCard('b', '高压恒沸组成', azH ? azH.x.toFixed(3) : '—', st.Phi.toFixed(0) + ' kPa · ' + (azH ? azH.T.toFixed(1) + ' °C' : ''), '');
      setCard('c', '恒沸组成差', ok ? (azL.x - azH.x).toFixed(3) : '—', '差越小，循环越大', ok ? 'warm' : 'bad');
      setCard('d', '循环量 / 产品量', ok ? (D2 / B2).toFixed(2) : '∞', 'D₂ / B₂（每 1 份乙醇产品）', ok && D2 / B2 < 3 ? '' : 'bad');
      sch.innerHTML = psdSvg(x1, x2, ok, D2, B2);
      formula.innerHTML = '塔 2 物料衡算：D₁ = B₂ + D₂，D₁x₁ = B₂x<sub>B2</sub> + D₂x₂<br>⇒ D₂/B₂ = (x<sub>B2</sub> − x₁)/(x₁ − x₂) = <b>' + (ok ? (D2 / B2).toFixed(2) : '∞') + '</b>';
      var aL = aspenAz(st.Plo), aH = aspenAz(st.Phi);
      var w = ['恒沸组成由 NRTL（Aspen Plus V15 APV150 参数）计算' + ((aL || aH) ? '；对照 Aspen：' + [aL, aH].filter(Boolean).map(function (a) { return a.P + ' kPa 下 ' + a.x.toFixed(3); }).join('，') : '') + '。真实乙醇–水的恒沸组成随压力变化较小，工业上很少用变压法给乙醇脱水，更常用于 THF–水、乙腈–水等体系。'];
      warn.innerHTML = w.join('<br>'); warn.style.display = '';
      note.innerHTML = '塔 1 在 <b>' + st.Plo.toFixed(0) + ' kPa</b> 运行，塔顶接近该压力下的恒沸物（' + (ok ? x1.toFixed(3) : '—') + '）；送进 <b>' + st.Phi.toFixed(0) + ' kPa</b> 的塔 2 时，它已落在<b>新恒沸点的富乙醇一侧</b>，于是乙醇从塔 2 塔底出来，塔顶的高压恒沸物循环回塔 1。';
    }
    function psdSvg(x1, x2, ok, D2, B2) {
      return '<svg viewBox="0 0 460 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
        t(14, 24, '变压精馏：两塔、两个压力', 's-title') +
        colSvg(110, 70, 56, 180, 8) + colSvg(300, 70, 56, 180, 8) +
        t(138, 64, '塔 1 · 低压', 's-small', 'middle') + t(328, 64, '塔 2 · 高压', 's-small', 'middle') +
        '<path class="s-feed" d="M20 170 H110"/>' + arrowHead(110, 170, 'r', 's-feed') + t(20, 160, 'F x=0.10', 's-small') +
        '<path class="s-heavy" d="M138 250 V280 H60"/>' + arrowHead(60, 280, 'l', 's-heavy') + t(20, 274, '水', 's-mono') +
        '<path class="s-light" d="M138 70 V44 H240 V150 H300"/>' + arrowHead(300, 150, 'r', 's-light') + t(178, 40, 'D₁ x≈' + (isFinite(x1) ? x1.toFixed(3) : '—'), 's-small') +
        '<path class="s-light" d="M328 250 V280 H430"/>' + arrowHead(430, 280, 'r', 's-light') + t(372, 272, '乙醇 x≈0.995', 's-small') +
        '<path class="s-solvent flow-dash" d="M328 70 V36 H420 V210 H260 V200 H166"/>' + arrowHead(166, 200, 'l', 's-solvent') +
        t(376, 32, '循环 D₂ x≈' + (isFinite(x2) ? x2.toFixed(3) : '—'), 's-small') +
        t(270, 226, ok ? 'D₂/B₂ = ' + (D2 / B2).toFixed(2) : '无法分离', 's-mono') +
        '</svg>';
    }

    function drawExtractive() {
      var eq = DL.eqFor('ew', 101.325);
      var ex = extractiveAt(st.xS);
      var broken = !ex.azeotrope && st.xS > 0;
      var pts = ex.pts.map(function (p) { return [p.x, p.y]; });
      var tt = document.getElementById('fTitle'); if (tt) tt.textContent = '溶剂无基 x–y · x_EG = ' + st.xS.toFixed(2);
      chart.draw(function (g) {
        g.grid().open();
        g.line(0, 0, 1, 1, { c: 'var(--dim)', w: 1, dash: '3 4' });
        g.path(plot.eqPoints(eq), { c: 'var(--dim)', w: 1.6, dash: '5 3' });
        g.path(pts, { c: 'var(--violet)', w: 2.4 });
        if (eq.azeotrope) { g.dot(eq.azeotrope.x, eq.azeotrope.x, { c: 'var(--red)', r: 4 }); g.text(eq.azeotrope.x, eq.azeotrope.x, '无溶剂恒沸点', { dx: -8, dy: -10, anchor: 'end', c: 'var(--red)' }); }
        g.label(g.area.x0 + 8, g.area.y0 + 14, '虚线：无溶剂　紫线：加乙二醇（三元 NRTL）', { c: 'var(--muted)', size: 10, sans: true });
        g.close();
      });
      var near = ex.pts.filter(function (p) { return p.x > 0.85 && p.x < 0.95 && isFinite(p.alpha); })[0];
      setCard('a', '液相乙二醇分数 x_EG', st.xS.toFixed(2), '萃取段，近似恒定', '');
      setCard('b', '最小 α（溶剂无基）', isFinite(ex.minAlpha) ? ex.minAlpha.toFixed(3) : '—', broken ? '处处 > 1：恒沸消失' : '仍有 α ≤ 1 的区域', broken ? 'hi' : 'bad');
      setCard('c', 'x′ ≈ 0.9 处的 α', near ? near.alpha.toFixed(2) : '—', '无溶剂时约 1.0', near && near.alpha > 1.5 ? 'hi' : 'warm');
      setCard('d', '乙二醇进入气相', st.xS > 0 ? (ex.maxYsolvent * 100).toFixed(2) + ' %' : '—', '泡点 ' + (isFinite(ex.Tmin) ? ex.Tmin.toFixed(1) + '–' + ex.Tmax.toFixed(1) + ' °C' : '—'), '');
      sch.innerHTML = extractiveSvg(broken);
      formula.innerHTML = '三元泡点：Σ x<sub>i</sub>γ<sub>i</sub>(x, T)p<sub>i</sub>*(T) = P，γ 用 NRTL<br>溶剂无基：x′ = x₁/(x₁ + x₂)，y′ = y₁/(y₁ + y₂)<br>当前最小 α = <b>' + (isFinite(ex.minAlpha) ? ex.minAlpha.toFixed(3) : '—') + '</b> ' + (broken ? '&gt; 1：可以把乙醇提到高纯' : '≤ 1：恒沸点仍在');
      warn.innerHTML = '萃取段内溶剂分数视为常数；塔板数、溶剂进料位置与溶剂回收塔需要严格模拟（如 Aspen RadFrac）来设计。'; warn.style.display = '';
      note.innerHTML = '在塔的上部加入<b>高沸点溶剂乙二醇</b>：它与水的亲和力更强，把水“拉”在液相里，乙醇相对更易挥发。液相中乙二醇占 <b>' + (st.xS * 100).toFixed(0) + ' mol%</b> 时，溶剂无基的最小 α = <b>' + (isFinite(ex.minAlpha) ? ex.minAlpha.toFixed(2) : '—') + '</b>' +
        (broken ? '，曲线不再穿过对角线，塔顶可得高纯乙醇；乙二醇几乎不进入气相（≤ ' + (ex.maxYsolvent * 100).toFixed(1) + ' %），从塔底随水进入回收塔，再循环使用。' : '，还不足以消除恒沸点——继续加大溶剂分数。') +
        ' 按本模型约 3 mol% 乙二醇就能让曲线离开对角线，但恒沸点附近 α 仍接近 1；实际设计用更高的溶剂比，让 α 足够大、塔板数合理。';
    }
    function extractiveSvg(broken) {
      return '<svg viewBox="0 0 460 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
        t(14, 24, '萃取精馏：溶剂改变相对挥发度', 's-title') +
        colSvg(120, 60, 58, 200, 9) + colSvg(300, 90, 52, 160, 7) +
        t(149, 54, '萃取塔', 's-small', 'middle') + t(326, 84, '溶剂回收塔', 's-small', 'middle') +
        '<path class="s-feed" d="M24 180 H120"/>' + arrowHead(120, 180, 'r', 's-feed') + t(24, 170, 'F 近恒沸', 's-small') +
        '<path class="s-light" d="M149 60 V36 H260"/>' + arrowHead(260, 36, 'r', 's-light') + t(266, 40, broken ? '乙醇 高纯' : '乙醇 受限', 's-mono') +
        '<path class="s-heavy" d="M149 260 V280 H250 V200 H300"/>' + arrowHead(300, 200, 'r', 's-heavy') + t(190, 294, '水 + 溶剂', 's-small') +
        '<path class="s-heavy" d="M326 90 V66 H430"/>' + arrowHead(430, 66, 'r', 's-heavy') + t(390, 60, '水', 's-mono') +
        '<path class="s-solvent flow-dash" d="M326 250 V286 H440 V20 H60 V90 H120"/>' + arrowHead(120, 90, 'r', 's-solvent') +
        t(70, 84, 'S 溶剂', 's-small') + t(420, 300, '', 's-small') +
        '</svg>';
    }

    function drawHetero() {
      var eq = DL.eqFor('ew', 101.325);
      var tt = document.getElementById('fTitle'); if (tt) tt.textContent = '乙醇–水 · 101.3 kPa';
      chart.draw(function (g) {
        plot.mccabe(g, eq, null, {});
        g.open();
        g.rect(eq.azeotrope.x, 0, 1, 1, { fill: 'var(--violet)', fop: 0.08 });
        g.text(0.95, 0.12, '夹带剂帮忙跨过', { anchor: 'end', c: 'var(--violet)', size: 10 });
        g.text(0.95, 0.06, '的区域', { anchor: 'end', c: 'var(--violet)', size: 10 });
        g.close();
      });
      setCard('a', '进料', '≈ 恒沸物', '来自普通精馏塔顶', '');
      setCard('b', '夹带剂', '环己烷等', '历史上曾用苯', 'warm');
      setCard('c', '塔顶', '三元非均相恒沸物', '冷凝后分成两层', 'hi');
      setCard('d', '塔底', '无水乙醇', 'x → 1', 'hi');
      sch.innerHTML = heteroSvg();
      formula.innerHTML = '夹带剂与水形成沸点更低的<b>非均相</b>恒沸物 → 从塔顶带走水<br>冷凝后在分层器中分为两液相：富夹带剂层回流，富水层去汽提塔';
      warn.innerHTML = '这一页是流程示意：三元相图与液液平衡不在本页模型中计算。'; warn.style.display = '';
      note.innerHTML = '加入一种与水<b>不互溶</b>的夹带剂：它与水、乙醇形成沸点更低的三元恒沸物，从塔顶带走水；塔底得到无水乙醇。塔顶冷凝液在<b>分层器</b>里自动分成两层，这正是能把夹带剂循环回来的关键。';
    }
    function heteroSvg() {
      return '<svg viewBox="0 0 460 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
        t(14, 24, '非均相共沸精馏：分层器是关键', 's-title') +
        colSvg(110, 70, 58, 190, 9) + colSvg(330, 140, 48, 120, 5) +
        t(139, 64, '共沸塔', 's-small', 'middle') + t(354, 134, '汽提塔', 's-small', 'middle') +
        '<path class="s-feed" d="M20 170 H110"/>' + arrowHead(110, 170, 'r', 's-feed') + t(20, 160, 'F ≈ 恒沸物', 's-small') +
        '<path class="s-light" d="M139 260 V284 H60"/>' + arrowHead(60, 284, 'l', 's-light') + t(14, 280, '无水乙醇', 's-mono') +
        '<path class="s-line" style="stroke:var(--orange);stroke-width:2.4" d="M139 70 V40 H230"/>' +
        '<rect class="s-box" x="230" y="28" width="60" height="22" rx="11"/><path class="s-cool" d="M238 39 q5 -5 10 0 q5 5 10 0 q5 -5 10 0 q5 5 10 0"/>' +
        '<path class="s-line" d="M260 50 V70" style="stroke:var(--muted);stroke-width:2"/>' +
        '<rect class="s-shell" x="226" y="70" width="70" height="44" rx="8"/>' +
        '<rect x="229" y="73" width="64" height="18" style="fill:var(--violet);opacity:.55"/>' +
        '<rect x="229" y="91" width="64" height="20" style="fill:var(--blue);opacity:.55"/>' +
        t(261, 85, '富夹带剂', 's-small', 'middle') + t(261, 105, '富水', 's-small', 'middle') + t(261, 128, '分层器', 's-small', 'middle') +
        '<path class="s-solvent flow-dash" d="M226 80 H190 V92 H168"/>' + arrowHead(168, 92, 'l', 's-solvent') + t(176, 80, '回流', 's-small') +
        '<path class="s-steam" d="M296 102 H354 V140"/>' + arrowHead(354, 140, 'd', 's-steam') +
        '<path class="s-heavy" d="M354 260 V284 H440"/>' + arrowHead(440, 284, 'r', 's-heavy') + t(400, 278, '水', 's-mono') +
        '<path class="s-line flow-dash" d="M354 140 V130 H420 V40 H290" style="stroke:var(--orange);stroke-width:1.8"/>' + t(380, 34, '汽提塔顶回冷凝器', 's-small') +
        '</svg>';
    }

    function sync() {
      modeCtl.set(st.mode); sysCtl.set(st.sys);
      [[PCtl, st.P], [xDCtl, st.xD], [PloCtl, st.Plo], [PhiCtl, st.Phi], [SFCtl, st.xS]].forEach(function (p) { p[0].set(p[1], true); });
      gL.style.display = st.mode === 'limit' ? '' : 'none';
      gP.style.display = st.mode === 'psd' ? '' : 'none';
      gE.style.display = st.mode === 'extractive' ? '' : 'none';
      if (st.mode === 'limit') drawLimit();
      else if (st.mode === 'psd') drawPSD();
      else if (st.mode === 'extractive') drawExtractive();
      else drawHetero();
    }
    function apply(p) { Object.assign(st, p || {}); sync(); }
    sync();
    return { apply: apply, destroy: function () { chart.destroy(); } };
  }

  DL.registerModule({
    id: 'F', slug: 'azeotrope', order: 6,
    title: '共沸、变压与萃取精馏', en: 'AZEOTROPES',
    subtitle: '平衡线碰到对角线之后怎么办',
    hint: '切换四种方法，比较它们“改变”的是什么：压力、溶剂、还是液液分层。',
    scenes: [
      {
        title: '恒沸点：y = x',
        body: '乙醇–水在 1 atm 下于 x ≈ 0.894（本页 NRTL 模型 0.897）形成最低恒沸物。台阶越接近红点越密：在恒沸点上，汽化不再改变组成，<b>普通精馏到此为止</b>。',
        patch: { mode: 'limit', sys: 'ew', P: 101.325, xD: 0.85 }, guide: '把“塔顶目标 xD”往 0.89 拖。', duration: 12000
      },
      {
        title: '恒沸点是普通精馏的上限',
        body: '把 xD 定为 0.888：1.5 Rmin 下理论级数从 xD = 0.85 时的约 22 级增至约 45 级；越过 0.897 就“不可能”。这与塔高、回流比无关——是平衡本身的限制。',
        patch: { mode: 'limit', sys: 'ew', xD: 0.888 }, guide: '看卡片里理论级数的变化。', duration: 12000
      },
      {
        title: '最高恒沸物：留在塔底',
        body: '丙酮–氯仿相反：恒沸物沸点最高。从富丙酮一侧进料，塔顶得到纯丙酮，塔底得到恒沸物（x ≈ 0.34）。',
        patch: { mode: 'limit', sys: 'ac', xD: 0.97, P: 101.325 }, guide: '注意平衡线在恒沸点以下位于对角线下方。', duration: 12000
      },
      {
        title: '压力能移动恒沸点',
        body: '同一体系在不同压力下的 x–y 曲线（青：低压，紫：高压）：恒沸点随压力移动。对乙醇–水，<b>压力越低，恒沸物含乙醇越多</b>。',
        patch: { mode: 'psd', Plo: 20, Phi: 1000 }, guide: '拖动两个压力，看两个恒沸点的距离。', duration: 12000
      },
      {
        title: '变压精馏：两塔接力',
        body: '低压塔顶的近恒沸物送进高压塔时，正好落在高压恒沸点的<b>另一侧</b>，于是纯组分从高压塔底采出，高压恒沸物循环回低压塔。恒沸点移动越小，循环量越大、能耗越高。',
        patch: { mode: 'psd', Plo: 20, Phi: 600 }, guide: '降低高压塔压力，看循环量如何增大。', duration: 13000
      },
      {
        title: '萃取精馏：加一种“偏心”的溶剂',
        body: '在塔上部加入高沸点溶剂乙二醇。它更“喜欢”水，使乙醇的相对挥发度升高。这里是乙醇–水–乙二醇三元 NRTL 的真实计算：液相乙二醇 50 mol% 时，溶剂无基 α 在原恒沸点附近约 3，曲线远离对角线。',
        patch: { mode: 'extractive', xS: 0.5 }, guide: '把 x_EG 从 0 慢慢拖大，看曲线何时离开对角线。', duration: 13000
      },
      {
        title: '非均相共沸精馏：会分层的塔顶',
        body: '加入与水不互溶的夹带剂（如环己烷）：它把水以三元恒沸物形式从塔顶带走，冷凝后分为两液层，富夹带剂层回流、富水层去汽提，塔底得到无水乙醇。',
        patch: { mode: 'hetero' }, guide: '跟着流程图看夹带剂的循环路线。', duration: 13000
      },
      {
        title: '不止精馏：吸附与膜',
        body: '燃料乙醇脱水在工业上大量使用<b>分子筛变压吸附</b>：先精馏到接近恒沸，再用分子筛吸走剩余的水；渗透汽化膜也是选项。选择哪种方法，取决于规模、能耗与产品要求。',
        patch: { mode: 'limit', sys: 'ew', xD: 0.86, P: 101.325 }, guide: '先用普通精馏接近恒沸，再换一种原理越过它。', duration: 12000
      }
    ],
    mount: mount
  });
})();
