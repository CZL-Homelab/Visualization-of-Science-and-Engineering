/* Module D — thermal distillation: multi-stage flash (MSF) teaching model. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, core = DL.core, charts = DL.charts, sim = DL.sim, ref = DL.reference;

  var DEFAULT = { stages: 16, topBrine: 110 };

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage;
    var panel = ctx.panel;

    /* ---------------- cascade diagram ---------------- */
    var wrap = ui.el('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;flex:1;min-height:0';
    var cascadeHost = ui.el('div', 'chart');
    cascadeHost.style.cssText = 'flex:1;min-height:220px';
    var barHost = ui.el('div', 'chart');
    barHost.style.cssText = 'flex:0 0 150px;height:150px;min-height:150px';
    wrap.appendChild(cascadeHost); wrap.appendChild(barHost);
    var note = ui.el('p', 'stage-note');
    wrap.appendChild(note);
    stage.appendChild(wrap);

    function drawCascade(c2, w, h, p) {
      var plant = sim.thermalPlant({ stages: st.stages, topBrine: st.topBrine });
      var list = plant.cascade.stages;
      var n = list.length;
      var colW = (w - 24) / n;
      var maxT = 130;
      list.forEach(function (s, i) {
        var x = 12 + i * colW;
        var frac = s.temp / maxT;
        var bh = Math.max(8, frac * (h - 46));
        var grad = c2.createLinearGradient(0, h - 22 - bh, 0, h - 22);
        grad.addColorStop(0, p.orange);
        grad.addColorStop(1, p.cyan);
        c2.fillStyle = grad;
        charts.roundRect(c2, x, h - 22 - bh, Math.max(4, colW - 3), bh, 3); c2.fill();
        /* flashing vapor hint at the top */
        c2.fillStyle = p.yellow;
        c2.globalAlpha = 0.65;
        for (var k = 0; k < 3; k++) {
          c2.beginPath();
          c2.arc(x + colW / 2 + (k - 1) * 4, h - 26 - bh - 4 - k * 3, 1.8, 0, Math.PI * 2);
          c2.fill();
        }
        c2.globalAlpha = 1;
        if (i === 0 || i === n - 1 || n <= 12) {
          c2.fillStyle = p.muted; c2.font = charts.font(8.5); c2.textAlign = 'center';
          c2.fillText(Math.round(s.temp) + '°', x + colW / 2, h - 8);
        }
      });
      c2.fillStyle = p.dim; c2.font = charts.font(9); c2.textAlign = 'left';
      c2.fillText('顶卤 ' + Math.round(plant.cascade.top) + '°C → 末级 ' + Math.round(plant.cascade.last) + '°C · 每级降压闪蒸', 12, 14);
      c2.textAlign = 'right';
      c2.fillText('GEA = ' + ui.fmt.num(plant.gea, 1), w - 12, 14);
    }
    var cascade = charts.base(cascadeHost, { draw: drawCascade });

    var bar = charts.bars(barHost, {
      labels: ['理论最小', 'SWRO 典型', 'MED', 'MSF'],
      values: [ref.energy.theoreticalMin, ref.energy.swro.typical, ref.energy.med.typical, ref.energy.msf.typical],
      colors: ['green', 'cyan', 'blue', 'orange'],
      valueFormat: function (v) { return v.toFixed(1); },
      yFormat: function (v) { return v.toFixed(0); },
      label: '电耗当量 kWh/m³ · 文献区间中值（热法按折算口径）'
    });

    /* ---------------- panel ---------------- */
    var gStages = ui.section(panel, 'D1 · 级数与顶卤温度', 'MSF');
    var nCtl = ui.slider({ label: '闪蒸级数 N', min: 6, max: 26, step: 1, value: 16, unit: '级', hint: '级数越多，蒸汽潜热被反复利用，GEA 越高。', onInput: function (v) { st.stages = v; sync(); } });
    var tbCtl = ui.slider({ label: '顶卤温度', min: 85, max: 125, step: 1, value: 110, unit: '°C', hint: '更高顶卤提高回收与 GEA，但结垢与腐蚀也加剧（硅垢在 ~120°C 附近出现）。', onInput: function (v) { st.topBrine = v; sync(); } });
    gStages.appendChild(nCtl.el); gStages.appendChild(tbCtl.el);

    var gMetrics = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 'gea', label: 'GEA 产水增益比' },
      { key: 'dT', label: '级间温差' },
      { key: 'geo', label: '循环倍率 geo' },
      { key: 'elec', label: '泵送电耗' }
    ]);
    gMetrics.appendChild(m.el);
    gMetrics.appendChild(ui.formula('GEA = 产水 / 加热室进料蒸汽<br>每级闪蒸的蒸汽去冷凝下一级的进料，潜热反复利用'));
    var warn = ui.warn('教学相关性：GEA 随级数与顶卤温度单调上升，落在文献 MSF 的 3–9 区间。这是教学模型，不是热工设计计算。');
    gMetrics.appendChild(warn);

    var gMed = ui.section(panel, 'D2 · MED：另一种热法', 'MED');
    gMed.appendChild(ui.note('多效蒸馏（MED）把“效”串成瀑布：第一效的蒸汽冷凝热去蒸发第二效。它与电厂余热/太阳能耦合很自然，中东大量新建产能是 MED+RO 混配。'));
    var gEER = ui.section(panel, 'D3 · 能耗口径', 'EER');
    gEER.appendChild(ui.note('热法 EER 含大量热能。与 RO 比较必须折算成电耗当量（GED），不同折算系数会让 MED/MSF 排名互换——口径不一致的对比都是耍流氓。'));

    function sync() {
      var plant = sim.thermalPlant({ stages: st.stages, topBrine: st.topBrine });
      m.set({
        gea: ui.fmt.num(plant.gea, 2),
        dT: ui.fmt.num(plant.cascade.dT, 2) + ' °C',
        geo: ui.fmt.int(plant.geo),
        elec: ui.fmt.num(plant.elec, 2) + ' kWh/m³'
      });
      cascade.redraw();
      note.textContent = plant.gea > 7
        ? 'GEA ' + ui.fmt.num(plant.gea, 1) + '：接近现代大型 MSF 的上沿——代价是更多级、更大换热面积与更高顶卤结垢风险。'
        : 'GEA ' + ui.fmt.num(plant.gea, 1) + '：级数少时潜热利用不充分，单位产水的热耗大幅上升。';
    }
    sync();

    return {
      apply: function (p) {
        if (p.stages != null) nCtl.set(p.stages, true);
        if (p.topBrine != null) tbCtl.set(p.topBrine, true);
        if (p.barFocus != null) {
          var ladder = ['green', 'cyan', 'blue', 'orange'];
          bar.update({ colors: ladder.map(function (cc, i) { return i === p.barFocus ? 'yellow' : cc; }) });
        }
        sync();
      },
      destroy: function () { cascade.destroy(); bar.destroy(); }
    };
  }

  DL.registerModule({
    id: 'D', slug: 'thermal', order: 4,
    title: '蒸馏法 MSF / MED', en: 'Thermal Distillation',
    subtitle: '不是把海水烧开——是把同一份热量反复用掉八次。',
    hint: '调级数与顶卤温度，看闪蒸瀑布与 GEA 怎么变。',
    scenes: [
      {
        title: '真空里的“闪蒸”',
        body: '<p>MSF 的热水在<b>低于其沸点压力的真空室</b>里瞬间汽化：末级接近真空，温度只要 32–40 °C 也能闪蒸。不需要把整锅海水烧到 100 °C。</p>',
        guide: '柱子从橙色（热）渐变到青色（冷）：每级压力更低。',
        patch: { stages: 16, topBrine: 110 }
      },
      {
        title: 'GEA：一份热产八份水',
        body: '<p>每级产生的蒸汽去冷凝<b>下一级的进料</b>，潜热被逐级回收。级数 16 时 GEA ≈ 5；级数拉到 24、顶卤 110 °C 时逼近大型厂的实际值 ~8。</p>',
        guide: '把级数拉到 24，右上角 GEA 读数上升。',
        patch: { stages: 24 }
      },
      {
        title: '顶卤温度的天花板',
        body: '<p>顶卤 >120 °C 会析出<b>硅垢</b>，90–120 °C 是石膏/碳酸钙与硅垢夹缝里的操作带。温度不是越高越好——这是热法厂永远在和结垢谈判。</p>',
        guide: '把顶卤推到 125，想想真实厂为什么会停。',
        patch: { topBrine: 122 }
      },
      {
        title: '和 RO 比能耗，先统一口径',
        body: '<p>底部柱状图是<b>电耗当量</b>：MSF 文献区间 7.5–11 kWh/m³，MED 3–6，SWRO 2.5–4.5，理论最小 1.06。热法输给 RO 的不只是效率，还有燃料与冷却海的依赖。</p>',
        guide: 'MSF 柱子是橙色——它最耗能。',
        patch: { barFocus: 3 }
      }
    ],
    quiz: [
      {
        q: 'MSF 的 GEA（产水增益比）≈ 8 的含义是？',
        options: ['热效率 80%', '每份进料蒸汽产出约 8 份水', '8 台并联装置', '回收率 80%'],
        answer: 1,
        explain: 'GEA = 总产水 / 加热室进料流量：潜热被各级反复利用，一份蒸汽最终换来约 8 份淡水。'
      },
      {
        q: '热法与 RO 能耗必须折算成同一口径才能比较，原因是？',
        options: ['电价不同', '热法主要消耗热能，折算系数不同排名会变', 'RO 不用计量', 'MSF 没有电耗'],
        answer: 1,
        explain: 'GED 把热耗按功/热折算成电耗当量；不同系数下 MED 与 MSF 的相对排名可能互换，口径必须先声明。'
      }
    ],
    mount: mount
  });
})();
