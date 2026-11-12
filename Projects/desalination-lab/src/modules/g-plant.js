/* Module G — the whole plant: from intake to tap, and where the brine goes. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, core = DL.core, charts = DL.charts, sim = DL.sim;

  var DEFAULT = { recovery: 45, calcium: 40 };

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage;
    var panel = ctx.panel;

    /* ---------------- plant flow diagram ---------------- */
    var wrap = ui.el('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;flex:1;min-height:0';
    var tabRow = ui.el('div', 'viewtabs');
    var btn2d = ui.el('button'); btn2d.type = 'button'; btn2d.className = 'on'; btn2d.textContent = '2D 整厂流程';
    var btn3d = ui.el('button'); btn3d.type = 'button'; btn3d.textContent = '3D 厂区巡览';
    tabRow.appendChild(btn2d); tabRow.appendChild(btn3d);
    var flowHost = ui.el('div', 'chart');
    flowHost.style.cssText = 'flex:1;min-height:210px';
    var statHost = ui.el('div', 'chart');
    statHost.style.cssText = 'flex:0 0 110px;height:110px;min-height:110px';
    var glHost = ui.el('div', 'chart');
    glHost.style.cssText = 'flex:1;min-height:210px;display:none';
    var gl3d = null;
    function setMode(three) {
      if (three && !gl3d) gl3d = DL.gl.plant(glHost, function () { return { recovery: st.recovery / 100 }; });
      flowHost.style.display = three ? 'none' : '';
      statHost.style.display = three ? 'none' : '';
      glHost.style.display = three ? '' : 'none';
      btn2d.className = three ? '' : 'on';
      btn3d.className = three ? 'on' : '';
    }
    btn2d.addEventListener('click', function () { setMode(false); });
    btn3d.addEventListener('click', function () { setMode(true); });
    wrap.appendChild(tabRow);
    wrap.appendChild(flowHost); wrap.appendChild(statHost); wrap.appendChild(glHost);
    var note = ui.el('p', 'stage-note');
    wrap.appendChild(note);
    stage.appendChild(wrap);

    function drawPlant(c2, w, h, p, api) {
      var pl = sim.plant({ feed: 100000, recovery: st.recovery / 100, rejection: 0.993, calcium: st.calcium });
      var midY = h * 0.46;
      var steps = [
        { x: 0.04, label: '取水', sub: '格栅/筛网' },
        { x: 0.22, label: '预处理', sub: '混凝+UF/DF' },
        { x: 0.42, label: 'RO 膜系列', sub: '高压泵+ERD' },
        { x: 0.64, label: '后处理', sub: '再矿化+消毒' },
        { x: 0.86, label: '配水管网', sub: '城市水库' }
      ];
      var feedTh = 26;
      /* metric captions sit above the node chips, never inside them */
      c2.font = charts.font(9, 600);
      c2.fillStyle = p.orange; c2.textAlign = 'left';
      c2.fillText('进水 100,000 m³/h · TDS 35,000', 12, 14);
      c2.fillStyle = p.cyan; c2.textAlign = 'right';
      c2.fillText('产水 ' + ui.fmt.int(pl.bal.P) + ' m³/h · TDS ' + ui.fmt.int(pl.bal.Cp) + ' · Ca ' + ui.fmt.int(pl.rem.ca) + ' mg/L', w - 12, 14);
      /* main pipe widths shrink by recovery after RO */
      c2.fillStyle = p.orange; c2.globalAlpha = 0.75;
      charts.roundRect(c2, w * 0.04, midY - feedTh / 2, w * (0.42 - 0.04), feedTh, 6); c2.fill();
      c2.fillStyle = p.cyan;
      var permTh = 5 + (pl.bal.P / 100000) * feedTh;
      charts.roundRect(c2, w * 0.42, midY - permTh / 2, w * 0.56, permTh, 6); c2.fill();
      /* brine branch */
      var brineTh = 5 + (pl.bal.B / 100000) * feedTh;
      var brineY = midY + h * 0.22;
      c2.fillStyle = p.red; c2.globalAlpha = 0.75;
      c2.beginPath();
      c2.moveTo(w * 0.44, midY + feedTh / 2);
      c2.lineTo(w * 0.52, brineY);
      c2.lineTo(w * 0.82, brineY);
      c2.strokeStyle = p.red; c2.lineWidth = brineTh; c2.lineCap = 'round';
      c2.stroke(); c2.lineCap = 'butt'; c2.lineWidth = 1; c2.globalAlpha = 1;
      /* travelling flow dots along the three liquid paths */
      var tt = api && api.t ? api.t : 0;
      charts.flow(c2, [[w * 0.04, midY], [w * 0.42, midY]], tt, { color: '#ffffff', count: 10, speed: 0.16, r: 1.6, alpha: 0.5 });
      charts.flow(c2, [[w * 0.42, midY], [w * 0.86, midY]], tt, { color: '#ffffff', count: 9, speed: 0.12 + pl.bal.P / 100000 * 0.18, r: 1.5, alpha: 0.55 });
      charts.flow(c2, [[w * 0.44, midY + feedTh / 2], [w * 0.52, brineY], [w * 0.82, brineY]], tt, { color: '#ffffff', count: 8, speed: 0.12 + pl.bal.B / 100000 * 0.16, r: 1.5, alpha: 0.5 });
      /* nodes */
      steps.forEach(function (s) {
        var x = w * s.x;
        c2.fillStyle = p.panel3;
        charts.roundRect(c2, x - 34, midY - 40, 68, 24, 5); c2.fill();
        c2.strokeStyle = p.line; c2.stroke();
        c2.fillStyle = p.text; c2.font = charts.font(9.5, 600); c2.textAlign = 'center';
        c2.fillText(s.label, x, midY - 23);
        c2.fillStyle = p.dim; c2.font = charts.font(8);
        c2.fillText(s.sub, x, midY + feedTh / 2 + 14);
      });
      /* brine diffuser */
      c2.fillStyle = p.red; c2.font = charts.font(9, 600); c2.textAlign = 'left';
      c2.fillText('浓盐水 ' + ui.fmt.int(pl.bal.B) + ' m³/h · ' + ui.fmt.int(pl.bal.Cb) + ' mg/L', w * 0.54, brineY - brineTh / 2 - 5);
      for (var i = 0; i < 5; i++) {
        c2.strokeStyle = p.red; c2.globalAlpha = 0.5 - i * 0.09;
        c2.beginPath();
        c2.arc(w * 0.82 + i * 6, brineY, 4 + i * 3.4, -0.5, 0.5);
        c2.stroke();
      }
      c2.globalAlpha = 1;
      c2.fillStyle = p.dim; c2.font = charts.font(8.5); c2.textAlign = 'right';
      c2.fillText('扩散器稀释羽流', w - 8, brineY + brineTh / 2 + 12);
    }
    var flow = charts.base(flowHost, { draw: drawPlant, animate: true });

    var stat = charts.bars(statHost, {
      labels: ['进水', '产水', '浓盐水'],
      values: [100, 45, 55],
      colors: ['orange', 'cyan', 'red'],
      valueFormat: function (v) { return v.toFixed(0) + '%'; },
      label: '物流分配（份额随回收率联动）'
    });

    /* ---------------- panel ---------------- */
    var gBalance = ui.section(panel, 'G1 · 物料平衡', 'BALANCE');
    var yCtl = ui.slider({ label: '回收率 Y', min: 30, max: 60, step: 1, value: 45, unit: '%', onInput: function (v) { st.recovery = v; sync(); } });
    gBalance.appendChild(yCtl.el);
    gBalance.appendChild(ui.formula('F = P + B<br>F·C_f = P·C_p + B·C_b'));

    var gRem = ui.section(panel, 'G2 · 再矿化', 'REMINERALIZE');
    var caCtl = ui.slider({ label: '目标钙硬度', min: 0, max: 80, step: 2, value: 40, unit: 'mg/L', hint: '溶入方解石（CaCO₃）并补充 CO₂：产水从“腐蚀性软水”变成稳定饮用水。', onInput: function (v) { st.calcium = v; sync(); } });
    gRem.appendChild(caCtl.el);
    var remNote = ui.note('');
    gRem.appendChild(remNote);

    var gBrine = ui.section(panel, 'G3 · 浓盐水', 'BRINE');
    var brineNote = ui.warn('');
    gBrine.appendChild(brineNote);
    gBrine.appendChild(ui.table(
      ['环节', '教学要点'],
      [
        ['取水', '低速取水 + 筛网，减少海洋生物卷吸（impingement/entrainment）'],
        ['预处理', '混凝/超滤/介质过滤：把 SDI 压到膜能受住的水平'],
        ['能量回收', '压力交换器把浓水压力传回进水，RO 能耗的大头在这省'],
        ['后处理', '再矿化 + pH 调节 + 氯消毒：稳定、不腐蚀、可储存'],
        ['排放', '扩散器快速稀释；近场盐度羽流与混合区是环评核心']
      ]
    ));

    var gMetrics = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 'prod', label: '日产淡水' },
      { key: 'brine', label: '浓盐水' },
      { key: 'cb', label: '浓水盐度' },
      { key: 'ph', label: '再矿化后 pH' },
      { key: 'alk', label: '碱度(CaCO₃)' },
      { key: 'kw', label: '厂负荷(模型)' }
    ]);
    gMetrics.appendChild(m.el);

    function sync() {
      var pl = sim.plant({ feed: 100000, recovery: st.recovery / 100, rejection: 0.993, calcium: st.calcium });
      stat.update({ values: [100, st.recovery, 100 - st.recovery], labels: ['进水', '产水', '浓盐水'] });
      m.set({
        prod: ui.fmt.int(pl.dailyProduct) + ' m³',
        brine: ui.fmt.int(pl.bal.B * 24) + ' m³/天',
        cb: ui.fmt.int(pl.bal.Cb) + ' mg/L',
        ph: ui.fmt.num(pl.rem.ph, 1),
        alk: ui.fmt.int(pl.rem.alkalinity) + ' mg/L',
        kw: ui.fmt.int(pl.dailyProduct * pl.energyPerM3 / 24) + ' kW'
      });
      remNote.innerHTML = st.calcium <= 5
        ? '钙硬度几乎为零：<b>腐蚀性软水</b>会溶解管道里的金属，口感也“空”。真实厂不会让这种水进管网。'
        : '方解石溶到 Ca ' + st.calcium + ' mg/L：碱度约 ' + ui.fmt.int(pl.rem.alkalinity) + ' mg/L（CaCO₃ 计），pH ≈ ' + ui.fmt.num(pl.rem.ph, 1) + '——稳定、口感正常。';
      brineNote.innerHTML = '浓盐水是进水的 <b>' + ui.fmt.num(pl.bal.Cb / 35000, 2) + '×</b> 盐度、约 ' + ui.fmt.pct(100 - st.recovery, 0) + ' 体积。排海靠扩散器稀释到近场混合区；“直接倒回去”在环评里不成立。';
      flow.redraw();
      note.textContent = '一条城市水管的真实旅程：取水 → 预处理 → 膜 → 再矿化 → 龙头，外加一条必须交代清楚的浓盐水支线。';
    }
    sync();

    return {
      apply: function (p) {
        if (p.recovery != null) yCtl.set(p.recovery, true);
        if (p.calcium != null) caCtl.set(p.calcium, true);
        sync();
      },
      destroy: function () { flow.destroy(); stat.destroy(); if (gl3d) gl3d.destroy(); }
    };
  }

  DL.registerModule({
    id: 'G', slug: 'plant', order: 7,
    title: '整厂流程', en: 'Whole Plant',
    subtitle: '淡化厂不是只有一台膜：取水、预处理、再矿化与浓盐水。',
    hint: '调回收率与再矿化目标，检查物料平衡与浓盐水读数。',
    scenes: [
      {
        title: '进水 100,000 m³/h 的旅程',
        body: '<p>主流从橙色（海水）在膜处变成青色（产水），下方红色支线是浓盐水。<b>每一滴都有去处</b>：F = P + B，盐也一样守恒。</p>',
        guide: '看三色管道：比例就是回收率。',
        patch: { recovery: 45 }
      },
      {
        title: '膜之后必须再矿化',
        body: '<p>RO 产水 TDS 约 245 mg/L、几乎无碱度：直接喝口感差，进管网会<b>腐蚀管道</b>。方解石溶解器把钙与碱度加回来——这是“产水”变“饮用水”的临门一脚。</p>',
        guide: '把目标钙拉到 0 再拉回 40，读 pH 与碱度。',
        patch: { calcium: 40 }
      },
      {
        title: '浓盐水去哪',
        body: '<p>浓盐水约为进水的 55–65% 体积、盐度近两倍。靠<b>扩散器</b>在排放口制造快速稀释，让近场盐度羽流在混合区内回到海域本底——这是环评的核心论证。</p>',
        guide: '读“浓水盐度”：回收率越高它越刺眼。',
        patch: { recovery: 55 }
      },
      {
        title: '全厂能耗是一个系统',
        body: '<p>高压泵占大头，但取水、预处理、化学清洗、后处理与输配都在账单里。把三个模块串起来看：<b>回收率↑ → 浓水更浓 → 能耗↑</b>，而结垢阈值决定了这不是随便拉的滑块。</p>',
        guide: '读“厂负荷(模型)”与回收率的联动。',
        patch: { recovery: 50 }
      }
    ],
    quiz: [
      {
        q: '回收率 45% 时，浓盐水体积约为进水的？',
        options: ['45%', '55%', '90%', '2×'],
        answer: 1,
        explain: 'B = F − P = 55% F；浓度约为进水的 1.8×，不是体积翻倍。'
      },
      {
        q: '淡化产水并网前再矿化的主要目的是？',
        options: ['让水变甜', '防止管网腐蚀并提高稳定性/口感', '杀菌', '降低水价'],
        answer: 1,
        explain: '低硬度低碱度水腐蚀性强且不稳定；方解石/CO₂ 再矿化把钙与碱度加回，保护管网并改善口感。'
      }
    ],
    mount: mount
  });
})();
