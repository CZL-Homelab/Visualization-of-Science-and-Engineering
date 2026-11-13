/* Module B — single-stage separations: equilibrium flash vs simple (Rayleigh) distillation. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, T = DL.thermo, plot = DL.plot;

  var DEFAULT = { sys: 'bt', alpha: 2.5, z: 0.5, f: 0.5 };

  function flashSvg(fl, z, eq) {
    var x = fl.x, y = fl.y, f = fl.f;
    var Ttxt = isFinite(fl.T) ? fl.T.toFixed(1) + ' °C' : '—';
    var lvl = 150 - 70 * (1 - f);
    return '<svg viewBox="0 0 420 220" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<text class="s-title" x="14" y="22">闪蒸 · 一次平衡</text>' +
      '<text class="s-small" x="14" y="38">连续进料 → 加热 / 减压 → 气液分离罐</text>' +
      '<path class="s-feed" d="M14 130 H70"/><text class="s-mono" x="14" y="122">F  z=' + z.toFixed(2) + '</text>' +
      '<rect class="s-box" x="70" y="114" width="44" height="32" rx="5"/><path class="s-heat" d="M80 140 q4 -8 8 0 q4 8 8 0 q4 -8 8 0"/>' +
      '<text class="s-small" x="72" y="108">加热器</text>' +
      '<path class="s-feed" d="M114 130 H146"/><path class="s-line" d="M146 122 l14 16 v-16 l-14 16 z" style="fill:var(--panel-3)"/>' +
      '<text class="s-small" x="138" y="158">节流阀</text>' +
      '<path class="s-feed" d="M160 130 H196"/>' +
      '<rect class="s-shell" x="196" y="56" width="70" height="140" rx="30"/>' +
      '<rect x="199" y="' + lvl + '" width="64" height="' + (190 - lvl) + '" rx="10" style="fill:' + DL.column.compColor(x) + ';opacity:.75"/>' +
      '<text class="s-mono" x="231" y="84" text-anchor="middle">' + Ttxt + '</text>' +
      '<path class="s-light" d="M231 56 V30 H330"/><path class="s-light" d="M322 24 l10 6 l-10 6"/>' +
      '<text class="s-mono" x="340" y="26">V = ' + f.toFixed(2) + 'F</text><text class="s-mono" x="340" y="42" style="fill:var(--cyan)">y = ' + y.toFixed(3) + '</text>' +
      '<path class="s-heavy" d="M231 196 V210 H330"/><path class="s-heavy" d="M322 204 l10 6 l-10 6"/>' +
      '<text class="s-mono" x="340" y="196">L = ' + (1 - f).toFixed(2) + 'F</text><text class="s-mono" x="340" y="212" style="fill:var(--orange)">x = ' + x.toFixed(3) + '</text>' +
      '</svg>';
  }
  function stillSvg(ry, z, f) {
    var lvl = 0.15 + 0.85 * ry.W;
    var recv = Math.max(0.03, ry.D);
    return '<svg viewBox="0 0 420 220" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<text class="s-title" x="14" y="22">简单蒸馏 · 微分汽化</text>' +
      '<text class="s-small" x="14" y="38">一釜料边蒸边冷凝，蒸汽即时离开</text>' +
      '<defs><clipPath id="potClip"><circle cx="92" cy="150" r="44"/></clipPath></defs>' +
      '<circle class="s-shell" cx="92" cy="150" r="44"/>' +
      '<rect x="40" y="' + (194 - 88 * lvl) + '" width="110" height="' + (88 * lvl) + '" clip-path="url(#potClip)" style="fill:' + DL.column.compColor(ry.xW) + ';opacity:.8"/>' +
      '<path class="s-heat" d="M66 204 q4 -8 8 0 q4 8 8 0 q4 -8 8 0 q4 8 8 0 q4 -8 8 0 q4 8 8 0"/>' +
      '<text class="s-mono" x="92" y="154" text-anchor="middle">xW ' + ry.xW.toFixed(3) + '</text>' +
      '<path class="s-line" d="M92 106 V70 H210" style="stroke:var(--orange);stroke-width:2.4"/>' +
      '<rect class="s-box" x="200" y="56" width="120" height="26" rx="13" transform="rotate(14 260 69)"/>' +
      '<path class="s-cool" d="M214 66 q6 -6 12 0 q6 6 12 0 q6 -6 12 0 q6 6 12 0 q6 -6 12 0 q6 6 12 0 q6 -6 12 0" transform="rotate(14 260 69)"/>' +
      '<text class="s-small" x="236" y="52">冷凝器</text>' +
      '<path class="s-light" d="M318 96 V120"/>' +
      '<path class="s-line" d="M296 124 h44 v76 a6 6 0 0 1 -6 6 h-32 a6 6 0 0 1 -6 -6 z"/>' +
      '<rect x="298" y="' + (204 - 76 * recv) + '" width="40" height="' + (76 * recv) + '" style="fill:' + DL.column.compColor(ry.xDavg) + ';opacity:.85"/>' +
      '<text class="s-mono" x="346" y="150">D = ' + ry.D.toFixed(2) + '</text><text class="s-mono" x="346" y="166" style="fill:var(--cyan)">x̄D ' + ry.xDavg.toFixed(3) + '</text>' +
      '<text class="s-small" x="346" y="184">此刻 ' + ry.path[ry.path.length - 1].xDinst.toFixed(3) + '</text>' +
      '</svg>';
  }

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage, panel = ctx.panel;
    var eq = null, fl = null, ry = null;

    var top = ui.el('div', 'stage-row c2'); top.style.flex = '0.8';
    var s1 = ui.el('div', 'schem'), s2 = ui.el('div', 'schem');
    top.appendChild(s1); top.appendChild(s2);
    var bottom = ui.el('div', 'stage-row c2'); bottom.style.flex = '1.2';
    var h1 = ui.el('div'), h2 = ui.el('div');
    bottom.appendChild(h1); bottom.appendChild(h2);
    var note = ui.el('p', 'stage-note');
    stage.appendChild(top); stage.appendChild(bottom); stage.appendChild(note);

    var c1 = plot.chart(h1, { label: '闪蒸的杠杆规则', title: '<b id="bTitle1">T–x–y · 杠杆规则</b>', x: { min: 0, max: 1, label: '轻组分摩尔分数' }, y: { min: 70, max: 115, label: 'T / °C' } });
    var c2 = plot.chart(h2, {
      label: '汽化分率与产品组成', title: '同一汽化分率 f 下 <b>两种方式对比</b>',
      x: { min: 0, max: 1, label: '已汽化 / 馏出分率 f = V/F 或 D/F' }, y: { min: 0, max: 1, label: '组成' },
      hover: function (f) {
        if (f < 0.01 || f > 0.98) return null;
        var a = T.flash(eq, st.z, f), b = T.rayleigh(eq, st.z, f);
        return { html: 'f = ' + f.toFixed(2) + '<br>闪蒸：y = ' + a.y.toFixed(3) + '，x = ' + a.x.toFixed(3) + '<br>简单蒸馏：x̄D = ' + b.xDavg.toFixed(3) + '，xW = ' + b.xW.toFixed(3), vx: f };
      }
    });

    var gS = ui.section(panel, '体系', 'SYSTEM');
    var sysCtl = ui.seg({ options: DL.systemOptions({ custom: false }), value: st.sys, onChange: function (v) { st.sys = v; sync(); } });
    gS.appendChild(sysCtl.el);
    var alphaCtl = ui.slider({ label: '相对挥发度 α', min: 1.1, max: 6, step: 0.05, value: st.alpha, onInput: function (v) { st.alpha = v; sync(); } });
    gS.appendChild(alphaCtl.el);
    var gF = ui.section(panel, '操作', 'OPERATION');
    var zCtl = ui.slider({ label: '进料 / 初始釜液组成 z', min: 0.05, max: 0.95, step: 0.01, value: st.z, onInput: function (v) { st.z = v; sync(); } });
    var fCtl = ui.slider({ label: '汽化分率 f（闪蒸 V/F；简单蒸馏 D/F）', min: 0.02, max: 0.95, step: 0.01, value: st.f, onInput: function (v) { st.f = v; sync(); } });
    gF.appendChild(zCtl.el); gF.appendChild(fCtl.el);
    var gM = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 'T', label: '闪蒸温度' }, { key: 'fy', label: '闪蒸气相 y' },
      { key: 'fx', label: '闪蒸液相 x' }, { key: 'rD', label: '简单蒸馏馏出平均 x̄D' },
      { key: 'rW', label: '简单蒸馏釜残 xW' }, { key: 'rT', label: '釜温 开始 → 结束' }
    ]);
    gM.appendChild(m.el);
    var formula = ui.formula(''); gM.appendChild(formula);
    var warn = ui.warn(''); gM.appendChild(warn);
    var gR = ui.section(panel);
    gR.appendChild(ui.row([ui.reset(function () { Object.assign(st, DEFAULT); sync(); })]));
    gR.appendChild(ui.note('两种方式都只有“一个平衡级”。简单蒸馏按 Rayleigh 方程积分，忽略持液与雾沫。'));

    function sync() {
      eq = DL.eqFor(st.sys, 101.325, st.alpha);
      sysCtl.set(st.sys);
      alphaCtl.el.style.display = st.sys === 'alpha' ? '' : 'none';
      [[alphaCtl, st.alpha], [zCtl, st.z], [fCtl, st.f]].forEach(function (p) { p[0].set(p[1], true); });
      fl = T.flash(eq, st.z, st.f);
      ry = T.rayleigh(eq, st.z, st.f);
      s1.innerHTML = flashSvg(fl, st.z, eq);
      s2.innerHTML = stillSvg(ry, st.z, st.f);

      if (eq.hasT) {
        var Ts = eq.Ts.filter(isFinite), lo = Math.min.apply(null, Ts), hi = Math.max.apply(null, Ts), pad = Math.max(3, (hi - lo) * 0.12);
        c1.setAxes({ min: 0, max: 1, label: '轻组分摩尔分数' }, { min: Math.floor(lo - pad), max: Math.ceil(hi + pad), label: 'T / °C' });
        var tt = document.getElementById('bTitle1'); if (tt) tt.textContent = 'T–x–y · 杠杆规则';
        c1.draw(function (g) {
          plot.txy(g, eq, { x: fl.x, z: st.z });
          g.open();
          var Tf = fl.T;
          g.text(st.z, Tf, 'z', { dx: -3, dy: -8, anchor: 'middle', c: 'var(--yellow)' });
          g.line(fl.x, Tf - (g.ymax - g.ymin) * 0.06, st.z, Tf - (g.ymax - g.ymin) * 0.06, { c: 'var(--orange)', w: 3, op: 0.7 });
          g.line(st.z, Tf - (g.ymax - g.ymin) * 0.06, fl.y, Tf - (g.ymax - g.ymin) * 0.06, { c: 'var(--cyan)', w: 3, op: 0.7 });
          g.text((fl.x + st.z) / 2, Tf - (g.ymax - g.ymin) * 0.06, '∝V', { dy: 14, anchor: 'middle', c: 'var(--orange)', size: 9.5 });
          g.text((st.z + fl.y) / 2, Tf - (g.ymax - g.ymin) * 0.06, '∝L', { dy: 14, anchor: 'middle', c: 'var(--cyan)', size: 9.5 });
          g.close();
        });
      } else {
        c1.setAxes({ min: 0, max: 1, label: '液相 x' }, { min: 0, max: 1, label: '气相 y' });
        var tt2 = document.getElementById('bTitle1'); if (tt2) tt2.textContent = 'x–y · 闪蒸操作线';
        c1.draw(function (g) {
          g.grid().open();
          g.line(0, 0, 1, 1, { c: 'var(--dim)', w: 1, dash: '3 4' });
          g.path(plot.eqPoints(eq), { c: 'var(--cyan)', w: 2.2 });
          // flash operating line through (z, z) with slope −L/V
          g.line(st.z, st.z, fl.x, fl.y, { c: 'var(--yellow)', w: 1.8 });
          g.dot(fl.x, fl.y, { c: 'var(--yellow)', r: 5 }); g.dot(st.z, st.z, { c: 'var(--text)' });
          g.text(fl.x, fl.y, '(x, y)', { dx: 8, dy: -6, c: 'var(--text)' });
          g.close();
        });
      }
      c2.draw(function (g) {
        g.grid().open();
        var a = [], b = [], c = [], d = [];
        for (var i = 1; i <= 60; i++) {
          var f = i / 62;
          var F = T.flash(eq, st.z, f), R = T.rayleigh(eq, st.z, f, 200);
          a.push([f, F.y]); b.push([f, F.x]); c.push([f, R.xDavg]); d.push([f, R.xW]);
        }
        g.hline(st.z, { c: 'var(--yellow)', w: 1, dash: '3 3' });
        g.text(0.98, st.z, '进料 z', { dy: -5, anchor: 'end', c: 'var(--yellow)', size: 9.5 });
        g.path(a, { c: 'var(--cyan)', w: 1.8, dash: '5 3' });
        g.path(c, { c: 'var(--cyan)', w: 2.4 });
        g.path(b, { c: 'var(--orange)', w: 1.8, dash: '5 3' });
        g.path(d, { c: 'var(--orange)', w: 2.4 });
        g.vline(st.f, { c: 'var(--text)', w: 1, dash: '2 3' });
        g.dot(st.f, fl.y, { c: 'var(--cyan)', r: 3.5 }); g.dot(st.f, ry.xDavg, { c: 'var(--cyan)', r: 4.5 });
        g.dot(st.f, fl.x, { c: 'var(--orange)', r: 3.5 }); g.dot(st.f, ry.xW, { c: 'var(--orange)', r: 4.5 });
        g.label(g.area.x0 + 8, g.area.y0 + 14, '实线：简单蒸馏　虚线：闪蒸', { c: 'var(--muted)', size: 10, sans: true });
        g.label(g.area.x0 + 8, g.area.y0 + 29, '青：馏出 / 气相　橙：釜残 / 液相', { c: 'var(--dim)', size: 10, sans: true });
        g.close();
      });

      m.set({
        T: isFinite(fl.T) ? fl.T.toFixed(1) + ' °C' : '—', fy: fl.y.toFixed(3), fx: fl.x.toFixed(3),
        rD: ry.xDavg.toFixed(3), rW: ry.xW.toFixed(3),
        rT: isFinite(ry.T0) ? ry.T0.toFixed(1) + ' → ' + ry.Tend.toFixed(1) + ' °C' : '—'
      }, { rD: 'hi', fy: 'hi' });
      formula.innerHTML = '闪蒸（杠杆规则）：V/F = (z − x)/(y − x) = <b>' + st.f.toFixed(2) + '</b><br>简单蒸馏（Rayleigh）：ln(W₀/W) = ∫<sub>xW</sub><sup>x₀</sup> dx/(y* − x)<br>同一 f：x̄D − y<sub>闪蒸</sub> = <b>' + (ry.xDavg - fl.y >= 0 ? '+' : '') + (ry.xDavg - fl.y).toFixed(3) + '</b>';
      var w = [];
      if (eq.azeotrope && st.z > eq.azeotrope.x) w.push('初始组成在恒沸点另一侧：馏出物反而比釜液更贫轻组分。');
      warn.innerHTML = w.join('<br>'); warn.style.display = w.length ? '' : 'none';
      note.innerHTML = '把一半进料汽化（f = ' + st.f.toFixed(2) + '）：闪蒸得到的蒸汽 y = <b>' + fl.y.toFixed(3) + '</b>，简单蒸馏收集的馏出物平均 x̄D = <b>' + ry.xDavg.toFixed(3) + '</b>，釜残 ' + ry.xW.toFixed(3) + '（闪蒸液相 ' + fl.x.toFixed(3) + '）。' +
        '简单蒸馏更好，因为蒸汽一产生就离开、与越来越贫的釜液“不再平衡”；但两者都只有一个平衡级，想要 0.95 以上的纯度必须用多级精馏（模块 C）。';
    }
    function apply(p) { Object.assign(st, p || {}); sync(); }
    sync();
    return { apply: apply, destroy: function () { c1.destroy(); c2.destroy(); } };
  }

  DL.registerModule({
    id: 'B', slug: 'flash', order: 2,
    title: '闪蒸与简单蒸馏', en: 'SINGLE-STAGE',
    subtitle: '一次部分汽化能分到什么程度',
    hint: '拖动汽化分率 f，左侧两套装置与右侧曲线同步变化。',
    scenes: [
      {
        title: '闪蒸：连续的一次平衡',
        body: '进料先加热或减压，进入分离罐后部分汽化。罐内蒸汽与液体<b>互相平衡</b>，分别从顶部和底部离开。苯–甲苯 z = 0.50 汽化一半：蒸汽 y ≈ 0.61，液体 x ≈ 0.39。',
        patch: { sys: 'bt', z: 0.5, f: 0.5 }, guide: '看左上分离罐的两股出料。', duration: 12000
      },
      {
        title: '杠杆规则',
        body: '在 T–x–y 图上，闪蒸温度下的水平连结线两端是 x 与 y，进料 z 落在中间。<b>V/F = (z − x)/(y − x)</b>：z 离哪一端越近，那一相的量就越多——就像杠杆的两臂。',
        patch: { f: 0.3 }, guide: '图下方两段彩色线段的长度比 = 两相量的反比。', duration: 12000
      },
      {
        title: '多汽化一些，蒸汽反而不纯',
        body: '把 f 提高到 0.8：蒸汽量多了，但 y 降到约 0.54——更多的重组分也被一起汽化。液相 x 则降到约 0.33。<b>汽化越多，蒸汽越不纯</b>，这是单级分离的内在矛盾。',
        patch: { f: 0.8 }, guide: '右图虚线：闪蒸 y 随 f 下降。', duration: 12000
      },
      {
        title: '简单蒸馏：蒸汽一产生就离开',
        body: '实验室里的圆底烧瓶 + 冷凝器就是简单蒸馏。蒸汽<b>即时</b>冷凝收集，釜液不断变贫、温度逐渐升高；最先馏出的最纯，后面的越来越差。',
        patch: { f: 0.5 }, guide: '看右上：当前馏出组成比平均值低。', duration: 12000
      },
      {
        title: '同样蒸出一半，简单蒸馏分得更好',
        body: '同为 f = 0.5，简单蒸馏的平均馏出组成 x̄D ≈ 0.65，高于闪蒸的 y ≈ 0.61；釜残也更贫。差别来自“过程中不断与新鲜釜液平衡”。但两者的提升都有限。',
        patch: { f: 0.5 }, guide: '比较右图同一竖线上的实线与虚线。', duration: 12000
      },
      {
        title: '一个平衡级的天花板',
        body: '换成 α = 1.5 的难分离体系：无论 f 取多少，馏出物最多也只有约 0.60（f → 0 时的 y*）。<b>要把纯度推上去，就得把很多次汽化–冷凝串起来</b>，并用回流让它们逆流接触——这就是精馏塔。',
        patch: { sys: 'alpha', alpha: 1.5, z: 0.5, f: 0.3 }, guide: '把 f 拖到最小，馏出物纯度也停在约 0.60。', duration: 13000
      }
    ],
    mount: mount
  });
})();
