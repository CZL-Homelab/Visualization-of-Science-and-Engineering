/* Module F — energy & cost: compare technologies on one honest axis. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, core = DL.core, charts = DL.charts, sim = DL.sim, ref = DL.reference;

  var DEFAULT = { tech: 'ro', recovery: 45, capacity: 80000 };

  var TECH = {
    ro: { name: 'SWRO', band: ref.energy.swro, cost: ref.cost.swro },
    med: { name: 'MED', band: ref.energy.med, cost: ref.cost.med },
    msf: { name: 'MSF', band: ref.energy.msf, cost: ref.cost.msf }
  };

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage;
    var panel = ctx.panel;

    /* ---------------- stage ---------------- */
    var wrap = ui.el('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;flex:1;min-height:0';
    var barHost = ui.el('div', 'chart');
    barHost.style.cssText = 'flex:1;min-height:200px';
    var curveHost = ui.el('div', 'chart');
    curveHost.style.cssText = 'flex:0 0 170px;height:170px;min-height:170px';
    wrap.appendChild(barHost); wrap.appendChild(curveHost);
    var note = ui.el('p', 'stage-note');
    wrap.appendChild(note);
    stage.appendChild(wrap);

    var bar = charts.bars(barHost, {
      labels: ['理论最小', 'SWRO', 'MED', 'MSF', '太阳能蒸馏'],
      values: [1.06, 3.7, 4.5, 9.0, 0.1],
      colors: ['green', 'cyan', 'blue', 'orange', 'yellow'],
      valueFormat: function (v) { return v < 1 ? '0 kWh' : v.toFixed(2); },
      yFormat: function (v) { return v.toFixed(0); },
      label: '电耗当量 kWh/m³（文献区间中值；SWRO 柱随回收率联动模型）'
    });

    /* SE vs recovery curve (RO model) with theoretical minimum below */
    var curve = charts.lines(curveHost, {
      series: [], yMin: 0, yFormat: function (v) { return v.toFixed(1); },
      xLabel: '回收率 20% → 70%',
      label: '模型比能耗 vs 理论最小分离功'
    });

    /* ---------------- panel ---------------- */
    var gTech = ui.section(panel, 'F1 · 工艺选择', 'TECH');
    var techCtl = ui.seg({
      label: '工艺',
      options: [
        { value: 'ro', label: 'SWRO' },
        { value: 'med', label: 'MED' },
        { value: 'msf', label: 'MSF' }
      ],
      value: 'ro',
      onChange: function (v) { st.tech = v; sync(); }
    });
    gTech.appendChild(techCtl.el);

    var gOp = ui.section(panel, 'F2 · 运行工况', 'OPERATING');
    var yCtl = ui.slider({ label: '回收率（RO 模型）', min: 25, max: 65, step: 1, value: 45, unit: '%', hint: '曲线是 C 模块的能耗模型 + 理论最小分离功。', onInput: function (v) { st.recovery = v; sync(); } });
    var capCtl = ui.slider({ label: '厂规模', min: 5000, max: 400000, step: 5000, value: 80000, unit: 'm³/天', onInput: function (v) { st.capacity = v; sync(); } });
    var powerPrice = ui.slider({ label: '电价', min: 0.03, max: 0.15, step: 0.005, value: 0.06, unit: 'USD/kWh', onInput: function (v) { st.price = v; sync(); } });
    gOp.appendChild(yCtl.el); gOp.appendChild(capCtl.el); gOp.appendChild(powerPrice.el);

    var gMetrics = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 'se', label: '比能耗（模型）' },
      { key: 'min', label: '理论最小' },
      { key: 'eff', label: '能效比' },
      { key: 'energyCost', label: '能量成本' },
      { key: 'daily', label: '日产水' },
      { key: 'power', label: '厂用电负荷' }
    ]);
    gMetrics.appendChild(m.el);
    var costNote = ui.note('');
    gMetrics.appendChild(costNote);
    var warn = ui.warn('文献区间是“口径混合”的数字：不同年份、不同 GED 折算、是否含 O&M。用于量级对比可以，用于决策必须回原始资料。');
    gMetrics.appendChild(warn);

    function sync() {
      var t = TECH[st.tech];
      var modelSE, minSE;
      if (st.tech === 'ro') {
        var r = sim.roStage({ recovery: st.recovery / 100, pressure: 62 });
        modelSE = r.energy.net;
        minSE = core.minSeparationEnergy(st.recovery / 100);
      } else {
        modelSE = t.band.typical;
        minSE = ref.energy.theoreticalMin;
      }
      bar.update({
        values: [ref.energy.theoreticalMin, st.tech === 'ro' ? modelSE : TECH.ro.band.typical, TECH.med.band.typical, TECH.msf.band.typical, ref.energy.solarStill.typical],
        colors: ['green', st.tech === 'ro' ? 'yellow' : 'cyan', st.tech === 'med' ? 'yellow' : 'blue', st.tech === 'msf' ? 'yellow' : 'orange', 'yellow']
      });
      /* curve: recovery sweep */
      var xs = [];
      var model = [];
      var minima = [];
      for (var y = 20; y <= 70; y += 5) {
        xs.push(y);
        model.push(sim.roStage({ recovery: y / 100, pressure: 62 }).energy.net);
        minima.push(core.minSeparationEnergy(y / 100));
      }
      curve.update({
        series: [
          { name: '模型 SE', values: model, color: st.tech === 'ro' ? 'cyan' : 'dim' },
          { name: '理论最小', values: minima, color: 'green', dash: [5, 4] }
        ],
        markers: [{ frac: (st.recovery - 20) / 50, color: 'orange', text: st.recovery + '%' }]
      });
      var price = st.price != null ? st.price : 0.06;
      var energyCost = (st.tech === 'ro' ? modelSE : t.band.typical) * price;
      m.set({
        se: ui.fmt.num(st.tech === 'ro' ? modelSE : t.band.typical, 2) + ' kWh/m³',
        min: ui.fmt.num(minSE, 2) + ' kWh/m³',
        eff: ui.fmt.pct(minSE / (st.tech === 'ro' ? modelSE : t.band.typical) * 100, 0),
        energyCost: '$' + ui.fmt.num(energyCost, 3) + '/m³',
        daily: ui.fmt.int(st.capacity) + ' m³',
        power: ui.fmt.int(st.capacity / 24 * (st.tech === 'ro' ? modelSE : t.band.typical)) + ' kW'
      });
      costNote.innerHTML = '仅能量成本约 <b>$' + ui.fmt.num(energyCost, 3) + '/m³</b>。文献总水价区间：SWRO $' + t.cost[0].toFixed(1) + '–' + t.cost[1].toFixed(1) + '/m³——膜更换、药剂、预处理与财务费用都是大头。太阳能蒸馏“燃料免费”，但每平方米每天只有几升水。';
      note.textContent = st.tech === 'ro'
        ? '模型（青线）永远在理论最小（绿虚线）上方——差距就是真实世界的不可逆性：泵损、浓差极化、膜污染与系统调度。'
        : '热法柱按电耗当量画；如果按“燃烧的热”直接比燃料，柱子会更高。口径！口径！口径！';
    }
    sync();

    return {
      apply: function (p) {
        if (p.tech != null) { st.tech = p.tech; techCtl.set(p.tech); }
        if (p.recovery != null) yCtl.set(p.recovery, true);
        sync();
      },
      destroy: function () { bar.destroy(); curve.destroy(); }
    };
  }

  DL.registerModule({
    id: 'F', slug: 'energy', order: 6,
    title: '能耗与成本', en: 'Energy & Cost',
    subtitle: '1.06 kWh/m³ 是物理下限——其余都是工程账单。',
    hint: '切换工艺、拖回收率与电价，看能耗与成本的联动。',
    scenes: [
      {
        title: '先画物理下限',
        body: '<p>把海水与淡水分开，热力学最少要做这么多功：SWRO 在 50% 回收率下文献值约 <b>1.06 kWh/m³</b>。任何工艺都不可能低于它——这是分离的账单底线。</p>',
        guide: '绿色柱：理论最小。所有其他柱都在它上面。',
        patch: { tech: 'ro', recovery: 50 }
      },
      {
        title: 'RO 的现实账',
        body: '<p>最好的商用 SWRO 约 2.5–3 kWh/m³（含能量回收），典型 3.7。能效比约三成——剩下七成在泵损、极化与污染里烧掉了，还能压，但不会压到零。</p>',
        guide: '青柱 vs 绿柱，读数区的“能效比”。',
        patch: { tech: 'ro', recovery: 45 }
      },
      {
        title: '热法为什么贵',
        body: '<p>MSF 电耗当量 7.5–11 kWh/m³：它把高品位热拉去蒸发水，热力学上比“只克服渗透压”贵得多。MED 介于中间，靠低温热（电厂余热、太阳能集热）扳回一部分。</p>',
        guide: '切到 MSF，看柱高与能量成本翻倍。',
        patch: { tech: 'msf' }
      },
      {
        title: '太阳能蒸馏的陷阱',
        body: '<p>燃料零 = 能量成本零，但产水密度每平方米每天只有几升：要灌满一座 10 万 m³/天的城市，需要的面积能把沙漠铺满。<b>“免费”不等于便宜。</b></p>',
        guide: '看黄色柱的“0 kWh”和面板里那句提示。',
        patch: { tech: 'ro', recovery: 45 }
      }
    ],
    quiz: [
      {
        q: 'SWRO 典型比能耗 3.7 kWh/m³，理论最小 1.06 kWh/m³，系统能效比约？',
        options: ['12%', '29%', '50%', '72%'],
        answer: 1,
        explain: '1.06 / 3.7 ≈ 0.29——三成左右；其余损耗来自泵效率、能量回收不完全、极化与污染。'
      },
      {
        q: '“太阳能蒸馏不耗能所以最便宜”错在哪？',
        options: ['太阳能其实要花钱买', '产水密度极低，土地/存储/泵送使单位水价不低', '海水不能太阳能淡化', '效率超过 100% 不可能'],
        answer: 1,
        explain: '燃料免费 ≠ 水便宜：~几升/(m²·天) 的产率意味着面积、囤储与抽水成本主导单位水价。'
      }
    ],
    mount: mount
  });
})();
