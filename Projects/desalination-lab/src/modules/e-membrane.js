/* Module E — membranes, rejection mechanisms and fouling. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, core = DL.core, charts = DL.charts, sim = DL.sim;

  var DEFAULT = { days: 30, scaling: 0.04, antiscalant: 60, recovery: 45 };

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage;
    var panel = ctx.panel;

    /* ---------------- stage: membrane layers + timeline ---------------- */
    var wrap = ui.el('div', 'stage-grid two');
    wrap.style.cssText = 'flex:1;min-height:0';
    var left = ui.el('div', 'fill');
    var layersHost = ui.el('div', 'chart');
    layersHost.style.flex = '1';
    left.appendChild(layersHost);
    var right = ui.el('div', 'fill');
    var lineHost = ui.el('div', 'chart');
    lineHost.style.flex = '1';
    right.appendChild(lineHost);
    wrap.appendChild(left); wrap.appendChild(right);
    var riskNote = ui.el('p', 'stage-note');
    stage.appendChild(wrap); stage.appendChild(riskNote);

    function drawLayers(c2, w, h, p) {
      var narrow = w < 560;
      var layers = [
        { name: '聚酯支撑层（多孔）', short: '支撑层', h: 0.42, color: p.panel3 },
        { name: '多孔中间层', short: '中间层', h: 0.26, color: p.blue },
        { name: '聚酰胺致密分离层 ~200 nm', short: '分离层 ~200nm', h: 0.12, color: p.violet },
        { name: '水侧边界层', short: '边界层', h: 0.08, color: p.cyan }
      ];
      var x = narrow ? 72 : 84, bw = narrow ? w * 0.5 : Math.min(150, w * 0.34);
      var y = 14;
      layers.forEach(function (L) {
        var lh = Math.max(14, L.h * (h - 30));
        c2.fillStyle = L.color; c2.globalAlpha = L.color === p.panel3 ? 0.8 : 0.9;
        charts.roundRect(c2, x, y, bw, lh, 4); c2.fill(); c2.globalAlpha = 1;
        c2.fillStyle = p.text; c2.font = charts.font(narrow ? 8.5 : 9.5, 600);
        if (narrow) { c2.textAlign = 'right'; c2.fillText(L.short, w - 6, y + lh / 2 + 3); }
        else { c2.textAlign = 'left'; c2.fillText(L.name, x + bw + 10, y + lh / 2 + 3); }
        y += lh + 2;
      });
      /* water molecules pass the dense layer; hydrated ions bounce */
      var midY = h * 0.35;
      c2.strokeStyle = p.green; c2.lineWidth = 2;
      c2.beginPath(); c2.moveTo(x - 26, midY); c2.lineTo(x + bw + 6, midY); c2.stroke();
      c2.beginPath(); c2.moveTo(x + bw + 6, midY); c2.lineTo(x + bw - 2, midY - 4); c2.moveTo(x + bw + 6, midY); c2.lineTo(x + bw - 2, midY + 4); c2.stroke();
      c2.fillStyle = p.green; c2.font = charts.font(narrow ? 8 : 9);
      if (narrow) { c2.textAlign = 'right'; c2.fillText('H₂O 透过', x - 10, midY - 9); }
      else { c2.textAlign = 'left'; c2.fillText('H₂O 溶解-扩散透过', x + bw + 10, midY - 12); }
      c2.strokeStyle = p.red; c2.lineWidth = 1.8;
      [midY + 26, midY + 40].forEach(function (yy, i) {
        c2.beginPath(); c2.moveTo(x - 30, yy); c2.lineTo(x - 6, yy);
        c2.arc(x - 3, yy, 3.4, 0, Math.PI * 2); c2.stroke();
        c2.beginPath(); c2.moveTo(x - 3, yy); c2.lineTo(x - 14, yy - 12); c2.stroke();
        c2.fillStyle = p.red; c2.font = charts.font(8.5); c2.textAlign = 'right';
        c2.fillText(i === 0 ? 'Na⁺ 被拒' : 'Cl⁻ 被拒', x - 12, yy - 6);
      });
      c2.fillStyle = p.dim; c2.font = charts.font(9); c2.textAlign = 'left';
      c2.fillText('TFC 复合膜剖面（放大示意）', 12, h - 6);
    }
    var layers = charts.base(layersHost, { draw: drawLayers });

    var line = charts.lines(lineHost, {
      series: [{ name: '通量', values: [], color: 'cyan', endLabel: '' }],
      yMin: 0, yFormat: function (v) { return v.toFixed(0); },
      xLabel: '运行天数',
      label: '产水通量随污染衰减（教学指数模型）'
    });

    /* ---------------- panel ---------------- */
    var gRej = ui.section(panel, 'E1 · 截留率', 'REJECTION');
    var rejCtl = ui.slider({ label: '膜片截留率', min: 98, max: 99.9, step: 0.1, value: 99.5, unit: '%', hint: '标称 99.3–99.8%；产水 TDS = 35,000 × (1 − R)。', onInput: function (v) { st.rejection = v; sync(); } });
    gRej.appendChild(rejCtl.el);

    var gFoul = ui.section(panel, 'E2 · 污染与阻垢', 'FOULING');
    var daysCtl = ui.slider({ label: '运行天数', min: 7, max: 90, step: 1, value: 30, unit: '天', onInput: function (v) { st.days = v; sync(); } });
    var scaleCtl = ui.slider({ label: '结垢倾向 k₀', min: 0.005, max: 0.08, step: 0.005, value: 0.04, unit: '/天', hint: '进水硬度、温度、回收率共同决定；生物污染另算。', onInput: function (v) { st.scaling = v; sync(); } });
    var antiCtl = ui.slider({ label: '阻垢剂效率', min: 0, max: 90, step: 5, value: 60, unit: '%', onInput: function (v) { st.antiscalant = v; sync(); } });
    gFoul.appendChild(daysCtl.el); gFoul.appendChild(scaleCtl.el); gFoul.appendChild(antiCtl.el);

    var gRisk = ui.section(panel, 'E3 · 回收率 vs 结垢阈值', 'RISK');
    var recCtl = ui.slider({ label: '回收率', min: 30, max: 85, step: 1, value: 45, unit: '%', onInput: function (v) { st.recovery = v; sync(); } });
    gRisk.appendChild(recCtl.el);
    var riskBox = ui.warn('');
    gRisk.appendChild(riskBox);

    var gMetrics = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 'perm', label: '产水 TDS' },
      { key: 'fluxNow', label: '当前通量' },
      { key: 'hold', label: '通量保持率' },
      { key: 'limit', label: '结垢阈值 Y' }
    ]);
    gMetrics.appendChild(m.el);
    var clean = ui.note('化学清洗（CIP）能恢复一部分通量，但每一次污染都在缩短膜寿命。真实厂靠<b>预处理</b>（UF/DF + 加药）把污染速率压低，而不是事后救火。');
    gMetrics.appendChild(clean);

    function sync() {
      var rej = (st.rejection != null ? st.rejection : 99.5) / 100;
      var perm = 35000 * (1 - rej);
      var timeline = sim.membraneTimeline({ days: st.days, scaling: st.scaling, antiscalant: st.antiscalant / 100, j0: 16 });
      line.update({
        series: [{ name: '通量', values: timeline.points.map(function (pt) { return pt.flux; }), color: 'cyan', endLabel: ui.fmt.num(timeline.points[timeline.points.length - 1].flux, 1) + ' LMH' }],
        markers: [{ frac: 0.75, color: 'red', text: '清洗触发线' }]
      });
      var risk = sim.scalingRisk(st.recovery / 100, st.antiscalant / 100);
      riskBox.className = risk.level === 'ok' ? 'ok' : risk.level === 'warn' ? 'note' : 'warn';
      riskBox.innerHTML = risk.note + '（阈值 ' + ui.fmt.pct(risk.limit * 100, 0) + '）。';
      m.set({
        perm: ui.fmt.int(perm) + ' mg/L',
        fluxNow: ui.fmt.num(timeline.points[timeline.points.length - 1].flux, 1) + ' LMH',
        hold: ui.fmt.pct(timeline.hold * 100, 0),
        limit: ui.fmt.pct(risk.limit * 100, 0)
      }, { hold: timeline.hold < 0.7 ? 'neg' : null, perm: perm > 500 ? 'neg' : null });
      riskNote.textContent = '膜不是耗材也不是永恒：图上这条曲线就是“为什么预处理比膜便宜还要做”的答案。';
    }
    sync();

    return {
      apply: function (p) {
        if (p.rejection != null) rejCtl.set(p.rejection, true);
        if (p.days != null) daysCtl.set(p.days, true);
        if (p.scaling != null) scaleCtl.set(p.scaling, true);
        if (p.antiscalant != null) antiCtl.set(p.antiscalant, true);
        if (p.recovery != null) recCtl.set(p.recovery, true);
        sync();
      },
      destroy: function () { layers.destroy(); line.destroy(); }
    };
  }

  DL.registerModule({
    id: 'E', slug: 'membrane', order: 5,
    title: '膜与污染', en: 'Membranes & Fouling',
    subtitle: '膜挡盐靠的不是筛孔；膜寿命靠的是预处理。',
    hint: '调截留率、污染速率与阻垢效率，看通量曲线和结垢阈值。',
    scenes: [
      {
        title: '致密层只有 200 nm',
        body: '<p>TFC 聚酰胺分离层致密到<b>没有“孔”可谈</b>：水分子溶解进聚合物再扩散穿过，水合离子因尺寸与电荷排斥被拒（Donnan 效应）。说“膜孔比盐小”是错的。</p>',
        guide: '左图：紫色薄层就是分离层；红色离子被弹回。',
        patch: { rejection: 99.5 }
      },
      {
        title: '通量在悄悄掉',
        body: '<p>结垢、生物膜、胶体在膜面扎根，通量按指数滑落。右图：不治理时 30 天掉三成——这就是厂里“产水单价每月在涨”的物理原因。</p>',
        guide: '把运行天数拉到 90，看通量保持率。',
        patch: { days: 90, scaling: 0.05, antiscalant: 20 }
      },
      {
        title: '阻垢剂把阈值后移',
        body: '<p>阻垢剂抑制硫酸钙/碳酸钙结晶生长，让回收率安全带上移（约 60%→更高）。但加药不是万能：磷酸盐本身还会喂生物污染。</p>',
        guide: '把阻垢效率从 20% 拉到 80%，看阈值读数。',
        patch: { antiscalant: 80, recovery: 60 }
      },
      {
        title: '撞上限的后果',
        body: '<p>回收率越过结垢阈值：膜面析出硬垢，化学清洗救不回来，只能换膜。<b>35–45% 回收率</b>不是保守，是物理与药剂共同划的界。</p>',
        guide: '把回收率推到 80%（阻垢 60%），读数区警告变红。',
        patch: { recovery: 80 }
      }
    ],
    quiz: [
      {
        q: '截留率 99.5% 的膜处理 35,000 mg/L 海水，产水 TDS 是？',
        options: ['0 mg/L', '175 mg/L', '350 mg/L', '700 mg/L'],
        answer: 1,
        explain: '35,000 × (1 − 0.995) = 175 mg/L——低于 500 参考线，但仍远不是“纯水”。'
      },
      {
        q: 'RO 膜拒盐的主要机制是？',
        options: ['筛孔比离子小', '溶解-扩散 + 水合离子/电荷排斥', '磁铁吸附', '离子被蒸发'],
        answer: 1,
        explain: '致密聚酰胺层没有筛孔；水经溶解-扩散透过，水合离子与 Donnan 排斥被拒于膜外。'
      }
    ],
    mount: mount
  });
})();
