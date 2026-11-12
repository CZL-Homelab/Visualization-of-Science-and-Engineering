/* Module C — the reverse osmosis stage: pressure, flux, salt balance, energy. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, core = DL.core, charts = DL.charts, sim = DL.sim, ref = DL.reference;

  var DEFAULT = { pressure: 62, recovery: 45, rejection: 99.3, A: 1.2 };

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage;
    var panel = ctx.panel;

    /* ---------------- stage: membrane flow + pressure gauge ---------------- */
    var wrap = ui.el('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;flex:1;min-height:0';
    var tabRow = ui.el('div', 'viewtabs');
    var btn2d = ui.el('button'); btn2d.type = 'button'; btn2d.className = 'on'; btn2d.textContent = '2D 单段剖面';
    var btn3d = ui.el('button'); btn3d.type = 'button'; btn3d.textContent = '3D 卷式膜元件';
    tabRow.appendChild(btn2d); tabRow.appendChild(btn3d);
    var flowHost = ui.el('div', 'chart');
    flowHost.style.cssText = 'flex:1;min-height:200px';
    var gaugeHost = ui.el('div', 'chart');
    gaugeHost.style.cssText = 'flex:0 0 84px;height:84px;min-height:84px';
    var glHost = ui.el('div', 'chart');
    glHost.style.cssText = 'flex:1;min-height:200px;display:none';
    var gl3d = null;
    function setMode(three) {
      flowHost.style.display = three ? 'none' : '';
      gaugeHost.style.display = three ? 'none' : '';
      glHost.style.display = three ? '' : 'none';
      if (three && !gl3d) gl3d = DL.gl.spiralRO(glHost, function () {
        var r = sim.roStage({ pressure: st.pressure, recovery: st.recovery / 100, rejection: st.rejection / 100, permeability: st.A, feed: 100 });
        return { flux: r.flow.flux, feasible: r.feasible, appliedBar: st.pressure, netPressure: r.flow.nd, recovery: st.recovery / 100 };
      });
      btn2d.className = three ? '' : 'on';
      btn3d.className = three ? 'on' : '';
      btn2d.setAttribute('aria-pressed', String(!three));
      btn3d.setAttribute('aria-pressed', String(three));
    }
    btn2d.addEventListener('click', function () { setMode(false); });
    btn3d.addEventListener('click', function () { setMode(true); });
    wrap.appendChild(tabRow);
    wrap.appendChild(flowHost); wrap.appendChild(gaugeHost); wrap.appendChild(glHost);
    var note = ui.el('p', 'stage-note');
    wrap.appendChild(note);
    stage.appendChild(wrap);

    function drawFlow(c2, w, h, p, api) {
      var r = sim.roStage({
        pressure: st.pressure, recovery: st.recovery / 100, rejection: st.rejection / 100,
        permeability: st.A, feed: 100
      });
      var midY = h / 2;
      var memX = w * 0.52;
      /* feed pipe */
      function pipe(x1, x2, y, frac, color, label, sub, right) {
        var th = 5 + frac * 26;
        c2.fillStyle = color; c2.globalAlpha = 0.75;
        charts.roundRect(c2, x1, y - th / 2, x2 - x1, th, 4); c2.fill();
        c2.globalAlpha = 1;
        c2.fillStyle = p.text; c2.font = charts.font(10, 600); c2.textAlign = right ? 'right' : 'left';
        c2.fillText(label, right ? x2 - 6 : x1 + 6, y - th / 2 - 6);
        c2.fillStyle = p.muted; c2.font = charts.font(9);
        c2.fillText(sub, right ? x2 - 6 : x1 + 6, y + th / 2 + 14);
      }
      var feedFrac = 1;
      var permFrac = r.bal.P / 100;
      var brineFrac = r.bal.B / 100;
      pipe(16, memX - 14, midY, feedFrac, p.orange, '进水 ' + ui.fmt.int(r.bal.F) + ' m³/h', 'TDS ' + ui.fmt.int(r.bal.F ? 35000 : 0) + ' mg/L', false);
      /* membrane */
      c2.strokeStyle = p.violet; c2.lineWidth = 4;
      c2.beginPath(); c2.moveTo(memX, midY - 52); c2.lineTo(memX, midY + 52); c2.stroke();
      /* permeate down-right, brine right */
      pipe(memX + 14, w - 16, midY - 46, permFrac, p.cyan, '产水 ' + ui.fmt.num(r.bal.P, 0) + ' m³/h', 'TDS ' + ui.fmt.int(r.bal.Cp) + ' mg/L');
      pipe(memX + 14, w - 16, midY + 46, brineFrac, p.red, '浓水 ' + ui.fmt.num(r.bal.B, 0) + ' m³/h', 'TDS ' + ui.fmt.int(r.bal.Cb) + ' mg/L');
      /* travelling flow dots inside each pipe */
      var tt = api && api.t ? api.t : 0;
      var sp = r.feasible ? 0.22 + r.flow.flux * 0.02 : 0.06;
      charts.flow(c2, [[16, midY], [memX - 14, midY]], tt, { color: '#ffffff', count: 9, speed: sp, r: 1.7, alpha: 0.55 });
      charts.flow(c2, [[memX + 14, midY - 46], [w - 16, midY - 46]], tt, { color: '#ffffff', count: 7, speed: sp * (0.5 + r.bal.P / 100), r: 1.6, alpha: 0.6 });
      charts.flow(c2, [[memX + 14, midY + 46], [w - 16, midY + 46]], tt, { color: '#ffffff', count: 7, speed: sp * (0.5 + r.bal.B / 100), r: 1.6, alpha: 0.6 });
      /* flux arrows through membrane */
      var flux = r.flow.flux;
      var n = Math.min(8, Math.max(0, Math.round(flux / 4)));
      c2.fillStyle = p.green;
      for (var i = 0; i < n; i++) {
        var y = midY - 34 + i * 9;
        var xj = ((tt * 0.5 + i * 0.13) % 1) * 22;
        c2.beginPath();
        c2.moveTo(memX - 26 + xj, y); c2.lineTo(memX + 16, y); c2.lineTo(memX + 10, y - 3); c2.lineTo(memX + 16, y); c2.lineTo(memX + 10, y + 3);
        c2.strokeStyle = p.green; c2.lineWidth = 1.6; c2.stroke();
      }
      c2.fillStyle = p.green; c2.font = charts.font(9.5, 600); c2.textAlign = 'center';
      c2.fillText('通量 ' + ui.fmt.num(flux, 1) + ' LMH', memX, midY - 62);
      if (!r.feasible) {
        c2.fillStyle = p.red; c2.font = charts.font(10, 700);
        c2.fillText('净驱动压力 ≤ 0：不产水', memX, midY + 70);
      }
    }
    var flowChart = charts.base(flowHost, { draw: drawFlow, animate: true });
    var gauge = charts.gauge(gaugeHost, { max: 90, value: st.pressure, color: 'blue', title: '外加压力 vs 浓水侧渗透压 (bar)', marker: 40, markerLabel: 'β·π_b' });

    /* ---------------- panel ---------------- */
    var gPress = ui.section(panel, 'C1 · 压力', 'PRESSURE');
    var pCtl = ui.slider({ label: '进水压力', min: 40, max: 85, step: 1, value: 62, unit: 'bar', hint: '真实海水 RO 高压泵一般运行在 55–72 bar。', onInput: function (v) { st.pressure = v; sync(); } });
    gPress.appendChild(pCtl.el);

    var gRecovery = ui.section(panel, 'C2 · 回收率与截留率', 'BALANCE');
    var yCtl = ui.slider({ label: '回收率 Y', min: 20, max: 70, step: 1, value: 45, unit: '%', hint: '海水 RO 常规 35–45%；再高会撞结垢阈值（模块 E）。', onInput: function (v) { st.recovery = v; sync(); } });
    var rCtl = ui.slider({ label: '截留率 R', min: 98.5, max: 99.9, step: 0.1, value: 99.3, unit: '%', onInput: function (v) { st.rejection = v; sync(); } });
    gRecovery.appendChild(yCtl.el); gRecovery.appendChild(rCtl.el);
    gRecovery.appendChild(ui.formula('质量守恒：F·C_f = P·C_p + B·C_b<br>C_b = (F·C_f − P·C_p) / B'));

    var gFlux = ui.section(panel, 'C3 · 膜与通量', 'FLUX');
    var aCtl = ui.slider({ label: '膜透水性 A', min: 0.6, max: 1.8, step: 0.05, value: 1.2, unit: 'LMH/bar', hint: 'J = A·(P − β·π_brine)，β≈1.1 是浓差极化系数。', onInput: function (v) { st.A = v; sync(); } });
    gFlux.appendChild(aCtl.el);

    var gMetrics = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 'nd', label: '净驱动压力' },
      { key: 'flux', label: '产水通量' },
      { key: 'perm', label: '产水 TDS' },
      { key: 'brine', label: '浓水 TDS' },
      { key: 'se', label: '比能耗' },
      { key: 'min', label: '理论最小' }
    ]);
    gMetrics.appendChild(m.el);
    var energyWarn = ui.warn('能耗模型：高压泵功 + 能量回收（η_pump 0.82 / η_erd 0.55，单段简化）。不含预处理、后处理与辅助用电。');
    gMetrics.appendChild(energyWarn);
    var quality = ui.note('');
    gMetrics.appendChild(quality);

    function sync() {
      var r = sim.roStage({
        pressure: st.pressure, recovery: st.recovery / 100, rejection: st.rejection / 100,
        permeability: st.A, feed: 100
      });
      m.set({
        nd: ui.fmt.num(r.flow.nd, 1) + ' bar',
        flux: ui.fmt.num(r.flow.flux, 1) + ' LMH',
        perm: ui.fmt.int(r.bal.Cp) + ' mg/L',
        brine: ui.fmt.int(r.bal.Cb) + ' mg/L',
        se: ui.fmt.num(r.energy.net, 2) + ' kWh/m³',
        min: ui.fmt.num(r.minSe, 2) + ' kWh/m³'
      }, { nd: r.feasible ? null : 'neg', se: r.energy.net > ref.energy.swro.hi ? 'neg' : null });
      gauge.update({
        value: st.pressure, marker: r.flow.piBrine * 1.1,
        markerLabel: 'β·π_b ' + ui.fmt.num(r.flow.piBrine * 1.1, 1) + ' bar',
        valueLabel: '外加 ' + st.pressure + ' bar'
      });
      flowChart.redraw();
      quality.innerHTML = r.bal.Cp <= 500
        ? '产水 TDS <b>' + ui.fmt.int(r.bal.Cp) + ' mg/L</b>：达标（口感参考 500），但仍然<b>缺矿物质</b>，并网前必须再矿化（模块 G）。'
        : '产水超标：截留率 ' + ui.fmt.num(st.rejection, 1) + '% 挡不住 ' + ui.fmt.int(r.bal.Cp) + ' mg/L——真实膜片老化、O 型圈泄漏就是这种画面。';
      note.textContent = r.feasible
        ? '回收率 ' + st.recovery + '% 把浓水推到 ' + ui.fmt.int(r.bal.Cb) + ' mg/L，浓水侧渗透压升到 ' + ui.fmt.num(r.flow.piBrine, 1) + ' bar；净驱动压力只剩 ' + ui.fmt.num(r.flow.nd, 1) + ' bar——压力不是白给的。'
        : '压力低于浓水侧渗透压：膜两侧净通量为零或倒流。把压力拉回 60 bar 以上。';
    }
    sync();
    setMode(true);

    return {
      apply: function (p) {
        if (p.pressure != null) pCtl.set(p.pressure);
        if (p.recovery != null) yCtl.set(p.recovery);
        if (p.rejection != null) rCtl.set(p.rejection);
        if (p.A != null) aCtl.set(p.A);
        sync();
      },
      destroy: function () { flowChart.destroy(); gauge.destroy(); if (gl3d) gl3d.destroy(); }
    };
  }

  DL.registerModule({
    id: 'C', slug: 'reverse-osmosis', order: 3,
    title: '反渗透 RO', en: 'Reverse Osmosis',
    subtitle: '一台能调参数的单段 RO：通量、盐平衡与能耗同时守恒。',
    hint: '调压力、回收率与截留率，盯住质量守恒两边是否配平。',
    scenes: [
      {
        title: '越过渗透压才有水',
        body: '<p>62 bar 外加压力 vs 浓水侧渗透压（约 48 bar × β）：净驱动压力决定通量。<b>产水通量 J = A·ND</b>，本模型默认约 10.5 LMH。</p>',
        guide: '下方压力条：绿色长度是外加压力，橙色标记是浓水侧渗透压。',
        patch: { pressure: 62, recovery: 45, rejection: 99.3 }
      },
      {
        title: '回收率：多产水，浓更浓',
        body: '<p>回收率从 45% 拉到 60%：产水多了，但浓水盐度从约 63 k 冲向 88 k mg/L，浓水侧渗透压吃掉净驱动压力，通量反而下降——这就是工艺被锁在 35–45% 的物理原因。</p>',
        guide: '把回收率拉到 60，看“净驱动压力”与“浓水 TDS”。',
        patch: { recovery: 60 }
      },
      {
        title: '99.3% 截留率 ≠ 无盐',
        body: '<p>35,000 × (1 − 99.3%) = <b>245 mg/L</b>。产水达标靠的是膜片标称截留率；把滑块降到 98.6% 试试——产水立刻超过饮用水参考线。</p>',
        guide: '把截留率降到 98.6，产水读数变红。',
        patch: { rejection: 98.6 }
      },
      {
        title: '能量回收装置的作用',
        body: '<p>浓水带着 62 bar 的压力白白排掉是浪费。<b>压力交换器</b>把浓水压力传给进水，比能耗从约 4.9 降到 3–4 kWh/m³。滑块面板里的 η_erd 就是这台装置。</p>',
        guide: '比能耗读数 = 泵功 − 回收功。',
        patch: { pressure: 62, recovery: 45 }
      },
      {
        title: '离理论极限还有多远',
        body: '<p>理论最小分离功（50% 回收率）约 <b>1.06 kWh/m³</b>；现实最好的商用厂约 2.5–3 kWh/m³。系统效率约三成——省能的空间还在，但物理下限省不掉。</p>',
        guide: '对比“比能耗”与“理论最小”两个读数。',
        patch: { recovery: 50 }
      }
    ],
    quiz: [
      {
        q: '进水 TDS 35,000 mg/L，回收率 45%，截留率 99.3%，浓水 TDS 最接近？',
        options: ['35,000', '51,000', '63,400', '87,000'],
        answer: 2,
        explain: 'F·C_f − P·C_p = 3.5e6 − 45×245 ≈ 3.489e6 g；除以浓水 55 m³ → ≈63,400 mg/L（≈1.8×进水）。'
      },
      {
        q: '回收率提高时通量下降的主要原因是？',
        options: ['膜孔径变小', '浓水侧渗透压升高吃掉净驱动压力', '水温下降', '泵效率降低'],
        answer: 1,
        explain: 'ND = P − β·π_brine；回收率↑ → 浓水更浓 → π_brine↑ → ND↓ → J↓。'
      }
    ],
    mount: mount
  });
})();
