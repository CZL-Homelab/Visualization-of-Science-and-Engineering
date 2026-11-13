/* Module I — multicomponent distillation: crude-oil atmospheric column, TBP curve and cut points.
 * The TBP curves are synthetic teaching curves, not assays of real crudes. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, T = DL.thermo, plot = DL.plot;

  var DEFAULT = { crude: 'medium', c0: 30, c1: 180, c2: 240, c3: 350, c4: 370, sharp: 0.6 };
  var PRODUCTS = [
    { key: 'gas', name: '气体 / 轻烃', color: 'var(--dim)' },
    { key: 'nap', name: '石脑油', color: 'var(--cyan)' },
    { key: 'ker', name: '煤油', color: 'var(--blue)' },
    { key: 'die', name: '柴油', color: 'var(--yellow)' },
    { key: 'ago', name: '常压瓦斯油', color: 'var(--orange)' },
    { key: 'res', name: '常压渣油', color: 'var(--red)' }
  ];
  function logistic(z) { return 1 / (1 + Math.exp(-z)); }

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage, panel = ctx.panel;

    var row = ui.el('div', 'stage-row c2');
    var sch = ui.el('div', 'schem fixed wide');
    var stack = ui.el('div', 'stage-stack');
    var h1 = ui.el('div'), h2 = ui.el('div');
    stack.appendChild(sch); stack.appendChild(h2);
    row.appendChild(stack); row.appendChild(h1);
    var note = ui.el('p', 'stage-note');
    stage.appendChild(row); stage.appendChild(note);

    var tbp = plot.chart(h1, {
      label: '原油实沸点曲线与切割点', title: '实沸点曲线 TBP <b>（合成示意）</b>',
      x: { min: 0, max: 100, label: '累计馏出 / 体积%' }, y: { min: 0, max: 800, label: '实沸点 / °C' }, pad: { b: 32, t: 24 },
      hover: function (v) { var Tt = T.tbpT(st.crude, v); return { html: v.toFixed(1) + ' vol% 处<br>实沸点 ' + Tt.toFixed(0) + ' °C<br>属于：' + productAt(Tt).name, vx: v, marks: [[v, Tt, 'var(--text)']] }; }
    });
    var dist = plot.chart(h2, {
      label: '各产品在沸点上的分布', title: '分馏精度：<b>相邻产品的重叠</b>',
      x: { min: 0, max: 600, label: 'TBP 温度 / °C' }, y: { min: 0, max: 1.05, label: '进入该产品的分率' }, pad: { b: 32, t: 24 },
      hover: function (Tt) { var f = fractions(Tt); var s = ''; PRODUCTS.forEach(function (p, i) { if (f[i] > 0.01) s += p.name + ' ' + (f[i] * 100).toFixed(0) + '%<br>'; }); return { html: Tt.toFixed(0) + ' °C 的组分进入：<br>' + s, vx: Tt }; }
    });

    function cuts() { return [st.c0, st.c1, st.c2, st.c3, st.c4]; }
    function productAt(Tt) { var c = cuts(); for (var i = 0; i < c.length; i++) if (Tt < c[i]) return PRODUCTS[i]; return PRODUCTS[5]; }
    function sigma() { return 4 + (1 - st.sharp) * 36; }
    function fractions(Tt) {
      var c = cuts(), s = sigma(), out = [];
      for (var i = 0; i < 6; i++) {
        var lo = i === 0 ? 1 : logistic((Tt - c[i - 1]) / s);
        var hi = i === 5 ? 0 : logistic((Tt - c[i]) / s);
        out.push(Math.max(0, lo - hi));
      }
      return out;
    }
    function yields() {
      var c = cuts(), v = [0];
      c.forEach(function (x) { v.push(Math.max(0, Math.min(100, T.tbpV(st.crude, x)))); });
      v.push(100);
      return PRODUCTS.map(function (p, i) { return { p: p, v0: v[i], v1: v[i + 1], y: Math.max(0, v[i + 1] - v[i]) }; });
    }

    var gC = ui.section(panel, '原油', 'CRUDE');
    var crudeCtl = ui.seg({ options: [{ value: 'light', label: '轻质' }, { value: 'medium', label: '中质' }, { value: 'heavy', label: '重质' }], value: st.crude, onChange: function (v) { st.crude = v; sync(); } });
    gC.appendChild(crudeCtl.el);
    gC.appendChild(ui.note('三条 TBP 曲线均为合成示意，用来比较“轻/重”趋势，不对应任何具体原油。'));
    var gK = ui.section(panel, '切割点（TBP 温度）', 'CUT POINTS');
    var c0 = ui.slider({ label: '气体 | 石脑油', min: 10, max: 60, step: 1, value: st.c0, unit: '°C', onInput: function (v) { st.c0 = v; fix('c0'); sync(); } });
    var c1 = ui.slider({ label: '石脑油 | 煤油', min: 120, max: 220, step: 1, value: st.c1, unit: '°C', onInput: function (v) { st.c1 = v; fix('c1'); sync(); } });
    var c2 = ui.slider({ label: '煤油 | 柴油', min: 200, max: 300, step: 1, value: st.c2, unit: '°C', onInput: function (v) { st.c2 = v; fix('c2'); sync(); } });
    var c3 = ui.slider({ label: '柴油 | 常压瓦斯油', min: 300, max: 380, step: 1, value: st.c3, unit: '°C', onInput: function (v) { st.c3 = v; fix('c3'); sync(); } });
    var c4 = ui.slider({ label: '常压瓦斯油 | 渣油', min: 340, max: 400, step: 1, value: st.c4, unit: '°C', onInput: function (v) { st.c4 = v; fix('c4'); sync(); } });
    [c0, c1, c2, c3, c4].forEach(function (c) { gK.appendChild(c.el); });
    var gS = ui.section(panel, '分馏精度', 'SHARPNESS');
    var sCtl = ui.slider({ label: '分馏精度（回流、塔板、汽提）', min: 0, max: 1, step: 0.01, value: st.sharp, onInput: function (v) { st.sharp = v; sync(); } });
    gS.appendChild(sCtl.el);
    var gM = ui.section(panel, '产品收率（体积%）', 'YIELDS');
    var tableHost = ui.el('div'); gM.appendChild(tableHost);
    var formula = ui.formula(''); gM.appendChild(formula);
    var gR = ui.section(panel);
    gR.appendChild(ui.row([ui.reset(function () { Object.assign(st, DEFAULT); sync(); })]));

    function fix(k) {
      var order = ['c0', 'c1', 'c2', 'c3', 'c4'], i = order.indexOf(k);
      for (var j = i + 1; j < order.length; j++) if (st[order[j]] < st[order[j - 1]] + 10) st[order[j]] = st[order[j - 1]] + 10;
      for (var m = i - 1; m >= 0; m--) if (st[order[m]] > st[order[m + 1]] - 10) st[order[m]] = st[order[m + 1]] - 10;
    }

    function towerSvg(ys) {
      var x = 160, w = 64, top = 40, bot = 262;
      var s = '<svg viewBox="0 0 520 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
        '<text class="s-title" x="14" y="22">常压蒸馏塔（示意）</text>' +
        '<text class="s-small" x="14" y="40">塔顶约 110–130 °C</text>' +
        '<rect class="s-shell" x="' + x + '" y="' + top + '" width="' + w + '" height="' + (bot - top) + '" rx="14"/>';
      for (var i = 1; i < 14; i++) { var yy = top + (bot - top) * i / 14; s += '<path class="s-line" d="M' + (x + (i % 2 ? 4 : 16)) + ' ' + yy + ' H' + (x + w - (i % 2 ? 16 : 4)) + '"/>'; }
      // furnace + feed
      s += '<rect class="s-box" x="24" y="186" width="70" height="56" rx="6"/><path class="s-heat" d="M36 234 q5 -12 10 0 q5 12 10 0 q5 -12 10 0 q5 12 10 0"/>' +
        '<text class="s-small" x="59" y="180" text-anchor="middle">加热炉</text>' +
        '<path class="s-feed" d="M10 266 H40 V242"/><text class="s-small" x="8" y="284">原油</text>' +
        '<path class="s-feed" d="M94 214 H' + x + '"/><text class="s-small" x="98" y="206">350–370 °C</text>';
      // overhead: condenser + reflux drum
      s += '<path class="s-light" d="M' + (x + w / 2) + ' ' + top + ' V18 H268"/>' +
        '<rect class="s-box" x="268" y="8" width="46" height="20" rx="10"/><path class="s-cool" d="M274 18 q4 -5 8 0 q4 5 8 0 q4 -5 8 0 q4 5 8 0"/>' +
        '<path class="s-line" d="M291 28 V40" style="stroke:var(--muted);stroke-width:2"/>' +
        '<rect class="s-shell" x="266" y="40" width="54" height="20" rx="10"/>' +
        '<path class="s-line" d="M266 54 H' + (x + w + 2) + '" style="stroke:var(--cyan);stroke-width:1.6;stroke-dasharray:3 3"/>' +
        '<text class="s-small" x="232" y="50">回流</text>';
      // side draws + side strippers
      var drawY = [top + 62, top + 112, top + 162];
      drawY.forEach(function (yy, k) {
        var pi = k + 2, sx = 262;
        s += '<path class="s-line" d="M' + (x + w) + ' ' + yy + ' H' + sx + '" style="stroke:' + PRODUCTS[pi].color + ';stroke-width:2.2"/>' +
          '<rect class="s-shell" x="' + sx + '" y="' + (yy - 6) + '" width="22" height="36" rx="6"/>' +
          '<path class="s-steam" d="M' + (sx + 32) + ' ' + (yy + 26) + ' H' + (sx + 22) + '" style="stroke-width:1.4"/>' +
          '<path class="s-line" d="M' + (sx + 11) + ' ' + (yy - 6) + ' V' + (yy - 12) + ' H' + (x + w) + '" style="stroke:var(--orange);stroke-width:1.2;stroke-dasharray:3 3"/>' +
          '<path class="s-line" d="M' + (sx + 11) + ' ' + (yy + 30) + ' V' + (yy + 36) + ' H360" style="stroke:' + PRODUCTS[pi].color + ';stroke-width:1.6"/>';
      });
      // bottoms + stripping steam
      s += '<path class="s-heavy" d="M' + (x + w / 2) + ' ' + bot + ' V' + (bot + 18) + ' H360"/>' +
        '<path class="s-steam" d="M' + (x + w + 30) + ' ' + (bot - 14) + ' H' + (x + w) + '" style="stroke-width:1.4"/>' +
        '<text class="s-small" x="' + (x + w + 6) + '" y="' + (bot - 20) + '">汽提蒸汽</text>';
      // overhead products
      s += '<path class="s-line" d="M320 46 H360" style="stroke:var(--dim);stroke-width:1.6"/>' +
        '<path class="s-line" d="M293 60 V76 H360" style="stroke:var(--cyan);stroke-width:1.6"/>';
      // yield bars (label above each bar)
      var bx = 364, maxW = 130;
      var barY = [42, 72, drawY[0] + 32, drawY[1] + 32, drawY[2] + 32, bot + 14];
      ys.forEach(function (y, k) {
        var wbar = Math.max(2, maxW * y.y / 60);
        s += '<rect x="' + bx + '" y="' + barY[k] + '" width="' + wbar + '" height="8" rx="2" style="fill:' + y.p.color + ';opacity:.85"/>' +
          '<text class="s-small" x="' + bx + '" y="' + (barY[k] - 3) + '">' + y.p.name + ' ' + y.y.toFixed(1) + '%</text>';
      });
      s += '</svg>';
      return s;
    }

    function sync() {
      crudeCtl.set(st.crude);
      [[c0, st.c0], [c1, st.c1], [c2, st.c2], [c3, st.c3], [c4, st.c4], [sCtl, st.sharp]].forEach(function (p) { p[0].set(p[1], true); });
      var ys = yields(), c = cuts();
      sch.innerHTML = towerSvg(ys);
      tbp.draw(function (g) {
        g.grid().open();
        ys.forEach(function (y) {
          if (y.y <= 0) return;
          var pts = [[y.v0, 0]];
          for (var v = y.v0; v <= y.v1; v += 0.5) pts.push([v, T.tbpT(st.crude, v)]);
          pts.push([y.v1, T.tbpT(st.crude, y.v1)], [y.v1, 0]);
          g.path(pts, { c: 'none', fill: y.p.color, fop: 0.28, closed: true, w: 0 });
        });
        var curve = []; for (var v2 = 0; v2 <= 100; v2 += 0.5) curve.push([v2, T.tbpT(st.crude, v2)]);
        g.path(curve, { c: 'var(--text)', w: 2.2 });
        c.forEach(function (ct, i) { g.hline(ct, { c: PRODUCTS[i + 1].color, w: 1, dash: '3 3', op: 0.8 }); g.text(99, ct, ct + '°', { anchor: 'end', dy: -3, c: PRODUCTS[i + 1].color, size: 9.5 }); });
        g.close();
      });
      dist.draw(function (g) {
        g.grid().open();
        for (var i = 0; i < 6; i++) {
          var pts = [];
          for (var Tt = 0; Tt <= 600; Tt += 3) pts.push([Tt, fractions(Tt)[i]]);
          g.path(pts, { c: PRODUCTS[i].color, w: 2, fill: PRODUCTS[i].color, fop: 0.1 });
        }
        c.forEach(function (ct) { g.vline(ct, { c: 'var(--dim)', w: 1, dash: '2 3' }); });
        g.close();
      });
      tableHost.innerHTML = '';
      tableHost.appendChild(ui.table(['产品', '沸程 °C', '收率'], ys.map(function (y, i) {
        var lo = i === 0 ? '—' : c[i - 1], hi = i === 5 ? '—' : c[i];
        return ['<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + y.p.color + ';margin-right:6px"></span>' + y.p.name, lo + ' – ' + hi, y.y.toFixed(1) + '%'];
      })));
      var ov = 5.9 * sigma();
      formula.innerHTML = '收率 = TBP(切割点上限) − TBP(切割点下限)（体积%）<br>相邻产品 5–95% 重叠宽度 ≈ 5.9σ = <b>' + ov.toFixed(0) + ' °C</b>（σ 为示意的“模糊宽度”）';
      var res = ys[5].y, light = ys[1].y + ys[2].y + ys[3].y;
      note.innerHTML = '原油不是两三种纯物质，而是成千上万种烃的连续混合物，所以常压塔按<b>沸程</b>切割：在当前切割点下，石脑油 + 煤油 + 柴油合计约 <b>' + light.toFixed(0) + '%</b>，常压渣油 <b>' + res.toFixed(0) + '%</b>。' +
        '渣油沸点太高，再加热会裂解，于是送去<b>减压蒸馏</b>（模块 G 的原理）。相邻产品之间总有约 ' + ov.toFixed(0) + ' °C 的重叠：回流、塔板与侧线汽提越好，重叠越窄。';
    }
    function apply(p) { Object.assign(st, p || {}); sync(); }
    sync();
    return { apply: apply, destroy: function () { tbp.destroy(); dist.destroy(); } };
  }

  DL.registerModule({
    id: 'I', slug: 'crude', order: 9,
    title: '原油常压蒸馏', en: 'CRUDE OIL',
    subtitle: '多组分、侧线抽出与切割点',
    hint: '拖动切割点，看 TBP 曲线上的彩色区间与右侧收率表同步变化。',
    scenes: [
      {
        title: '原油：连续的混合物',
        body: '原油含有从甲烷到沥青质的海量组分，没有两条清晰的“蒸气压曲线”。描述它的方式是<b>实沸点曲线（TBP）</b>：把原油在高效精馏柱里逐步蒸出，记录每蒸出一定体积时的温度。',
        patch: { crude: 'medium', c0: 30, c1: 180, c2: 240, c3: 350, c4: 370, sharp: 0.6 }, guide: '在 TBP 图上移动鼠标读数。', duration: 12000
      },
      {
        title: '常压塔：一座塔，多个侧线',
        body: '原油加热到约 350–370 °C 进入塔的进料段。轻组分上升，重组分下降；塔的不同高度温度不同，于是可以从<b>侧线</b>抽出不同沸程的产品，每条侧线再经小汽提塔用蒸汽吹出轻组分。',
        patch: {}, guide: '跟着左图的彩色侧线找到每个产品。', duration: 12000
      },
      {
        title: '切割点决定收率',
        body: '“切割点”就是相邻产品分界的 TBP 温度。收率 = TBP 曲线上两个切割点之间的体积%。中质原油在这组切割点下，柴油约占 20%，常压渣油约 40%。',
        patch: {}, guide: '右侧表格就是从 TBP 曲线读出的收率。', duration: 12000
      },
      {
        title: '煤油与柴油：抢同一段',
        body: '把煤油 | 柴油切割点从 240 °C 提高到 270 °C：煤油收率增加、柴油减少——这一段组分归谁，是按市场需求和产品规格（闪点、冰点、凝点）调节的。',
        patch: { c2: 270 }, guide: '比较前后两次的收率表。', duration: 12000
      },
      {
        title: '分馏不完美：产品之间的重叠',
        body: '真实塔不可能在切割点处“一刀切”：轻产品里会带一点重组分，重产品里也有轻组分。把分馏精度降到 0.2，分布曲线明显变宽；提高回流、增加塔板或加强汽提才能收窄。',
        patch: { c2: 240, sharp: 0.2 }, guide: '看右下图相邻曲线的交叠区域。', duration: 12000
      },
      {
        title: '重质原油：更多渣油',
        body: '换成重质原油：同样的切割点下轻质产品明显减少，常压渣油超过一半。炼厂需要更多的减压蒸馏、焦化或加氢裂化能力来“消化”它。',
        patch: { crude: 'heavy', sharp: 0.6 }, guide: '对比轻质、中质、重质三种原油的收率。', duration: 12000
      },
      {
        title: '渣油为什么去减压塔',
        body: '常压渣油在 370 °C 以上继续加热会开始热裂解、结焦。把它送进<b>减压塔</b>，在几 kPa 下操作，沸点大幅降低，就能在不裂解的温度下再分出减压瓦斯油（模块 G）。',
        patch: { crude: 'medium', c4: 370 }, guide: '回到模块 G，试试在 1–5 kPa 下的沸点。', duration: 12000
      }
    ],
    mount: mount
  });
})();
