/* Module B — osmosis and osmotic pressure: why water "climbs" on its own. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, core = DL.core, charts = DL.charts, sim = DL.sim;

  var DEFAULT = { tds: 35000, temp: 25, head: 0 };

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage;
    var panel = ctx.panel;

    /* ---------------- osmosis cell diagram ---------------- */
    var wrap = ui.el('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;flex:1;min-height:0';
    var tabRow = ui.el('div', 'viewtabs');
    var btn2d = ui.el('button'); btn2d.type = 'button'; btn2d.className = 'on'; btn2d.textContent = '2D 剖面';
    var btn3d = ui.el('button'); btn3d.type = 'button'; btn3d.textContent = '3D 渗透装置';
    tabRow.appendChild(btn2d); tabRow.appendChild(btn3d);
    var cellHost = ui.el('div', 'chart');
    cellHost.style.cssText = 'flex:1;min-height:220px';
    var gaugeHost = ui.el('div', 'chart');
    gaugeHost.style.cssText = 'flex:0 0 90px;height:90px;min-height:90px';
    var glHost = ui.el('div', 'chart');
    glHost.style.cssText = 'flex:1;min-height:220px;display:none';
    var gl3d = null;
    function setMode(three) {
      if (three && !gl3d) gl3d = DL.gl.osmosis(glHost, function () {
        var c = sim.osmosisCell(st.tds, st.temp, st.head);
        return { head: st.head, pi: c.pi, appliedBar: c.appliedBar, direction: c.direction, flux: Math.min(1, Math.abs(c.appliedBar - c.pi) / Math.max(1, c.pi)) };
      });
      cellHost.style.display = three ? 'none' : '';
      gaugeHost.style.display = three ? 'none' : '';
      glHost.style.display = three ? '' : 'none';
      btn2d.className = three ? '' : 'on';
      btn3d.className = three ? 'on' : '';
    }
    btn2d.addEventListener('click', function () { setMode(false); });
    btn3d.addEventListener('click', function () { setMode(true); });
    wrap.appendChild(tabRow);
    wrap.appendChild(cellHost); wrap.appendChild(gaugeHost); wrap.appendChild(glHost);
    var note = ui.el('p', 'stage-note');
    wrap.appendChild(note);
    stage.appendChild(wrap);

    function drawCell(ctx2, w, h, p, api) {
      var cell = sim.osmosisCell(st.tds, st.temp, st.head);
      var baseY = h - 26, topY = 18, wallX = 22, cellW = w - 44;
      var memX = wallX + cellW * 0.42;
      /* vessel outline */
      ctx2.strokeStyle = p.muted; ctx2.lineWidth = 2;
      ctx2.beginPath();
      ctx2.moveTo(wallX, topY); ctx2.lineTo(wallX, baseY); ctx2.lineTo(wallX + cellW, baseY); ctx2.lineTo(wallX + cellW, topY);
      ctx2.stroke();
      /* water levels: freshwater side rises toward equilibrium head */
      var maxH = baseY - topY - 10;
      var frac = core.clamp(cell.head > 0 ? cell.appliedBar / cell.pi : 0, 0, 1);
      var freshLevel = baseY - 14 - (st.head / 300) * maxH;
      var saltLevel = baseY - 14 - Math.min(0.62, 0.5 + 0.12 * frac) * maxH;
      ctx2.fillStyle = p.blue; ctx2.globalAlpha = 0.55;
      charts.roundRect(ctx2, wallX + 3, freshLevel, memX - wallX - 6, baseY - freshLevel, 3); ctx2.fill();
      ctx2.fillStyle = p.cyan; ctx2.globalAlpha = 0.5;
      charts.roundRect(ctx2, memX + 3, saltLevel, wallX + cellW - memX - 6, baseY - saltLevel, 3); ctx2.fill();
      /* animated surface shimmer on both water levels */
      var tt = api && api.t ? api.t : 0;
      ctx2.strokeStyle = p.cyan; ctx2.globalAlpha = 0.55; ctx2.lineWidth = 1.2;
      ctx2.beginPath();
      for (var xq = memX + 6; xq < wallX + cellW - 6; xq += 5) {
        var yy = saltLevel + Math.sin(xq * 0.13 + tt * 1.9) * 1.3 + Math.sin(xq * 0.05 - tt * 1.1) * 1.0;
        if (xq === memX + 6) ctx2.moveTo(xq, yy); else ctx2.lineTo(xq, yy);
      }
      ctx2.stroke();
      ctx2.strokeStyle = p.blue; ctx2.globalAlpha = 0.5;
      ctx2.beginPath();
      for (var xq2 = wallX + 6; xq2 < memX - 6; xq2 += 5) {
        var y2 = freshLevel + Math.sin(xq2 * 0.12 - tt * 1.5) * 1.1;
        if (xq2 === wallX + 6) ctx2.moveTo(xq2, y2); else ctx2.lineTo(xq2, y2);
      }
      ctx2.stroke();
      ctx2.globalAlpha = 1; ctx2.lineWidth = 1;
      ctx2.globalAlpha = 1;
      /* membrane */
      ctx2.strokeStyle = p.violet; ctx2.lineWidth = 3;
      ctx2.beginPath(); ctx2.moveTo(memX, topY + 6); ctx2.lineTo(memX, baseY - 4); ctx2.stroke();
      ctx2.setLineDash([3, 5]); ctx2.strokeStyle = p.dim; ctx2.lineWidth = 1;
      ctx2.beginPath(); ctx2.moveTo(memX, topY + 6); ctx2.lineTo(memX, baseY - 4); ctx2.stroke();
      ctx2.setLineDash([]);
      /* salt dots on the right */
      var dots = Math.min(46, Math.round(st.tds / 1400));
      ctx2.fillStyle = p.orange;
      for (var i = 0; i < dots; i++) {
        var dx = memX + 12 + (i * 37 % (cellW - memX + wallX - 22));
        var dy = baseY - 12 - (i * 53 % Math.max(20, baseY - saltLevel - 12));
        ctx2.beginPath(); ctx2.arc(dx, dy, 2.1, 0, Math.PI * 2); ctx2.fill();
      }
      /* water arrow through membrane */
      var arrow = cell.direction === 'in' ? 1 : cell.direction === 'out' ? -1 : 0;
      if (arrow !== 0) {
        var ay = (freshLevel + saltLevel) / 2;
        ctx2.strokeStyle = p.green; ctx2.lineWidth = 2.5;
        ctx2.beginPath(); ctx2.moveTo(memX - 46 * arrow, ay); ctx2.lineTo(memX + 46 * arrow, ay); ctx2.stroke();
        ctx2.beginPath();
        ctx2.moveTo(memX + 46 * arrow, ay);
        ctx2.lineTo(memX + 46 * arrow - 10 * arrow, ay - 5);
        ctx2.lineTo(memX + 46 * arrow - 10 * arrow, ay + 5);
        ctx2.closePath(); ctx2.fillStyle = p.green; ctx2.fill();
        ctx2.fillStyle = p.green; ctx2.font = charts.font(9.5, 600); ctx2.textAlign = 'center';
        ctx2.fillText(arrow > 0 ? '水分子向浓水侧渗透' : '反渗透：水被压向淡水侧', memX, ay - 17);
        charts.flow(ctx2, [[memX - 46, ay], [memX + 46, ay]], api && api.t ? api.t : 0,
          { color: p.green, count: 7, speed: 0.45, r: 1.7, alpha: 0.95, reverse: arrow < 0 });
      } else {
        ctx2.fillStyle = p.dim; ctx2.font = charts.font(9.5); ctx2.textAlign = 'center';
        ctx2.fillText('压力差 ≈ 渗透压：两侧动态平衡', memX, topY + 26);
      }
      ctx2.fillStyle = p.muted; ctx2.font = charts.font(9); ctx2.textAlign = 'left';
      ctx2.fillText('淡水侧（纯水）', wallX + 8, topY + 12);
      ctx2.textAlign = 'right';
      ctx2.fillText('海水侧 ' + ui.fmt.int(st.tds) + ' mg/L', wallX + cellW - 8, topY + 12);
      ctx2.textAlign = 'center'; ctx2.fillStyle = p.violet;
      ctx2.fillText('半透膜', memX, baseY + 12);
    }
    var cellChart = charts.base(cellHost, { draw: drawCell, animate: true });
    var gauge = charts.gauge(gaugeHost, { max: 70, value: 0, color: 'blue', title: '施加压力 vs 渗透压 (bar)', marker: 0, markerLabel: 'π' });

    /* ---------------- panel ---------------- */
    var gCell = ui.section(panel, 'B1 · 渗透装置', 'OSMOSIS');
    var tdsCtl = ui.slider({ label: '浓水侧含盐量', min: 1000, max: 70000, step: 500, value: 35000, unit: 'mg/L', onInput: function (v) { st.tds = v; sync(); } });
    var tempCtl = ui.slider({ label: '温度', min: 5, max: 45, step: 1, value: 25, unit: '°C', hint: '渗透压 ∝ 绝对温度：加热会抬高 π。', onInput: function (v) { st.temp = v; sync(); } });
    var headCtl = ui.slider({ label: '淡水侧水柱高度', min: 0, max: 300, step: 5, value: 0, unit: 'm', hint: '水柱产生的静压就是“外加压力”：到 π 时渗透停止。', onInput: function (v) { st.head = v; sync(); } });
    gCell.appendChild(tdsCtl.el); gCell.appendChild(tempCtl.el); gCell.appendChild(headCtl.el);

    var gMetrics = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 'pi', label: '渗透压 π' },
      { key: 'head', label: '等效水柱' },
      { key: 'applied', label: '外加压力' },
      { key: 'dir', label: '净方向' }
    ]);
    gMetrics.appendChild(m.el);
    gMetrics.appendChild(ui.formula('π = i<sub>eff</sub> · C · R · T<br>i<sub>eff</sub> = 1.8（NaCl 等效，含渗透系数）'));
    var warn = ui.warn('教学简化：按 NaCl 等效稀溶液估算，不含多价离子与活度系数；真实海水 π ≈ 26–28 bar，本模型在 ±10% 内。');
    gMetrics.appendChild(warn);

    var gPress = ui.section(panel, 'B2 · 越过 π 之后', 'REVERSE');
    gPress.appendChild(ui.note('把外加压力推过 π，方向翻转——这就是反渗透（RO）的原理：不是“过滤”，而是<b>用压力抢赢渗透</b>。模块 C 会把这台装置装上真实膜。'));

    function sync() {
      var cell = sim.osmosisCell(st.tds, st.temp, st.head);
      m.set({
        pi: ui.fmt.num(cell.pi, 1) + ' bar',
        head: ui.fmt.int(cell.head) + ' m',
        applied: ui.fmt.num(cell.appliedBar, 1) + ' bar',
        dir: cell.direction === 'in' ? '渗透 →' : cell.direction === 'out' ? '← 反渗' : '平衡 ⇌'
      }, { dir: cell.direction === 'in' ? 'pos' : cell.direction === 'out' ? 'hi' : 'neg' });
      gauge.update({ value: cell.appliedBar, marker: cell.pi, markerLabel: 'π ' + ui.fmt.num(cell.pi, 1) + ' bar', valueLabel: '外加 ' + ui.fmt.num(cell.appliedBar, 1) + ' bar' });
      cellChart.redraw();
      note.textContent = cell.direction === 'in'
        ? '浓水侧在“抽水”：淡水自己穿过膜去稀释它，直到水柱压力 ≈ π。' + (cell.pi > 25 ? '海水要抬到约 ' + ui.fmt.int(cell.head) + ' 米水柱才停——这就是为什么渗透发电听起来很美，但产能极低。' : '')
        : cell.direction === 'out'
          ? '外加压力超过了 π：水被从浓水侧挤出来——反渗透产水。压力每高一档，产水通量高一档（模块 C）。'
          : '刚好平衡：净通量为零。这是渗透压的定义时刻。';
    }
    sync();

    return {
      apply: function (p) {
        if (p.tds != null) tdsCtl.set(p.tds, true);
        if (p.temp != null) tempCtl.set(p.temp, true);
        if (p.head != null) headCtl.set(p.head, true);
        if (p.head == null && p.headToPi) {
          headCtl.set(core.round(sim.osmosisCell(st.tds, st.temp, 0).head, 0), true);
        }
        if (p.headOverPi) {
          headCtl.set(core.round(sim.osmosisCell(st.tds, st.temp, 0).head + 35, 0), true);
        }
        sync();
      },
      destroy: function () { cellChart.destroy(); gauge.destroy(); if (gl3d) gl3d.destroy(); }
    };
  }

  DL.registerModule({
    id: 'B', slug: 'osmosis', order: 2,
    title: '渗透与渗透压', en: 'Osmosis',
    subtitle: '水为什么会自己爬升 273 米——以及怎么把它按回去。',
    hint: '拖动含盐量、温度与水柱高度，观察净方向何时翻转。',
    scenes: [
      {
        title: '半透膜只放行水',
        body: '<p>膜允许水分子通过，却挡住 Na⁺ 与 Cl⁻。浓水侧要“稀释自己”，水就从淡水侧穿过来——这就是<b>渗透</b>。</p>',
        guide: '看绿色箭头：方向指向浓水侧。',
        patch: { tds: 35000, head: 0 }
      },
      {
        title: '渗透压：27 bar ≈ 273 米水柱',
        body: '<p>海水（35 g/L，25 °C）的渗透压约 <b>27 bar</b>——相当于把水自己抬升约 <b>270 米</b>。渗透会持续到淡水侧水柱压力 = π 为止。</p>',
        guide: '水柱滑块停在 π 处，净方向变成“平衡”。',
        patch: { headToPi: true }
      },
      {
        title: '按回去：反渗透',
        body: '<p>把压力加到 π 以上，方向翻转：水从海水侧被挤出去，盐被留下。<b>反渗透 = 渗透的反向操作</b>，代价是高压泵做功。</p>',
        guide: '外加压力条已经越过 π 标记。',
        patch: { headOverPi: true }
      },
      {
        title: '温度不是旁观者',
        body: '<p>π = C·R·T 里的 T 是绝对温度：5 °C 与 45 °C 的海水渗透压相差约 14%。冬季产水通量下降还叠加了<b>粘度上升</b>——这就是水厂按季节调压力的原因。</p>',
        guide: '把温度拉到 45，看 π 与平衡水柱怎么变。',
        patch: { temp: 45 }
      }
    ],
    quiz: [
      {
        q: '10,000 mg/L NaCl 等效溶液在 25 °C 的渗透压最接近？',
        options: ['0.8 bar', '7.7 bar', '27 bar', '77 bar'],
        answer: 1,
        explain: 'C = 10/58.44 = 0.171 mol/L；π = 1.8 × 0.171 × 0.08314 × 298.15 ≈ 7.7 bar。海水（35,000 mg/L）的 27 bar 就是这个式子放大 3.5 倍。'
      },
      {
        q: '反渗透产水的前提条件是？',
        options: ['膜孔比盐离子小', '外加压力高于浓水侧渗透压', '把海水加热到沸腾', '先去除全部钙镁'],
        answer: 1,
        explain: 'RO 是压力驱动：只有外加压力超过浓水侧（含浓差极化）渗透压，才有净水通量。膜不是靠“筛孔”挡盐。'
      }
    ],
    mount: mount
  });
})();
