/* Module A — water, salt and where the freshwater actually is. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, core = DL.core, charts = DL.charts, sim = DL.sim, ref = DL.reference;

  var DEFAULT = { tds: 35000 };

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage;
    var panel = ctx.panel;

    /* ---------------- stage ---------------- */
    var grid = ui.el('div', 'stage-grid two');
    grid.style.cssText = 'flex:1;min-height:0';
    var left = ui.el('div', 'fill');
    var donutHost = ui.el('div', 'chart');
    donutHost.style.flex = '1';
    left.appendChild(donutHost);
    var right = ui.el('div', 'fill');
    var ladderHost = ui.el('div', 'chart');
    ladderHost.style.flex = '1';
    right.appendChild(ladderHost);
    grid.appendChild(left); grid.appendChild(right);
    var note = ui.el('p', 'stage-note');
    stage.appendChild(grid); stage.appendChild(note);

    var donut = charts.donut(donutHost, {
      segments: sim.freshwaterSplit(),
      center: { value: '2.5%', label: '淡水占地球总水' }
    });
    var ladder = charts.bars(ladderHost, {
      labels: [], values: [], colors: [], log: true,
      threshold: ref.drinkingTdsAesthetic,
      thresholdLabel: '饮用水参考 500 mg/L',
      valueFormat: function (v) { return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v); },
      yFormat: function (v) { return v >= 1000 ? (v / 1000) + 'k' : String(v); },
      label: 'TDS mg/L · 对数轴 · 教学近似'
    });

    /* ---------------- panel ---------------- */
    var gSalt = ui.section(panel, 'A2 · 水的含盐量', 'TDS');
    var tdsCtl = ui.slider({
      label: '含盐量 TDS', min: 10, max: 300000, step: 10, value: 35000, unit: 'mg/L',
      hint: '拖动跨越数量级：雨水 → 河水 → 海水 → 浓盐水 → 盐湖卤水。',
      onInput: function (v) { st.tds = v; sync(); }
    });
    gSalt.appendChild(tdsCtl.el);
    var preset = ui.seg({
      label: '跳到典型水型',
      options: [
        { value: '30', label: '雨水' }, { value: '200', label: '河水' },
        { value: '3000', label: '微咸水' }, { value: '35000', label: '海水' },
        { value: '63400', label: 'RO浓水' }, { value: '200000', label: '盐湖卤水' }
      ],
      value: '35000',
      onChange: function (v) { tdsCtl.set(Number(v)); }
    });
    gSalt.appendChild(preset.el);

    var gMetrics = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 'tds', label: 'TDS' },
      { key: 'ec', label: '电导率（近似）' },
      { key: 'density', label: '密度' },
      { key: 'vs', label: '相对饮用水参考' }
    ]);
    gMetrics.appendChild(m.el);
    gMetrics.appendChild(ui.formula('电导率 ≈ TDS / 0.64（海水经验系数）<br>密度 ≈ 1000 + 0.706 × (g/L)'));
    var bandNote = ui.note('');
    gMetrics.appendChild(bandNote);

    var gEarth = ui.section(panel, 'A1 · 地球的水', 'SPLIT');
    gEarth.appendChild(ui.table(
      ['水体', '占比', '说明'],
      [
        ['海洋与内陆海', ref.earthWater.oceanPct + '%', '盐度约 35 g/kg，不可直接饮用'],
        ['淡水（合计）', ref.earthWater.freshPct + '%', '其中 ' + ref.earthWater.icePct + '% 在冰盖与冰川'],
        ['地下水与土壤', ref.earthWater.groundwaterPct + '%（占淡水）', '开采速度常超过补给速度'],
        ['湖泊/河流/大气', ref.earthWater.surfaceOtherPct + '%（占淡水）', '最容易取用，也最容易被污染']
      ]
    ));
    gEarth.appendChild(ui.note('来源：USGS Water Science School（口径核对 ' + ref.asOf + '）。“可 drinking 的水”只占地球总水的极小薄片。'));

    var gWhy = ui.section(panel, 'A3 · 为什么要淡化', 'WHY');
    gWhy.appendChild(ui.note('全球装机产能已超 1 亿 m³/天（IDA 口径，2024 年跨过 100 M m³/d），因为对缺水的沿海城市来说，海水是<b>唯一不被他人占用的水源</b>——代价是能量与浓盐水。'));

    function bandOf(v) {
      var bands = ref.tdsBands;
      for (var i = 0; i < bands.length; i++) {
        if (v >= bands[i].lo && v <= bands[i].hi) return bands[i].name;
      }
      return v < 1000 ? '低矿化水' : (v > 70000 ? '高浓卤水' : '介于类别之间');
    }

    function sync() {
      var ec = core.conductivity(st.tds);
      m.set({
        tds: ui.fmt.int(st.tds) + ' mg/L',
        ec: ui.fmt.int(ec) + ' µS/cm',
        density: ui.fmt.num(core.density(st.tds), 1) + ' kg/m³',
        vs: st.tds <= ref.drinkingTdsAesthetic ? '低于 500' : '超出 ' + ui.fmt.num(st.tds / ref.drinkingTdsAesthetic, 1) + '×'
      }, { vs: st.tds <= ref.drinkingTdsAesthetic ? 'pos' : 'neg' });
      bandNote.innerHTML = '当前水型：<b>' + bandOf(st.tds) + '</b>。500 mg/L 是口感/感官参考值（WHO 不为 TDS 设健康基准），不是健康红线。';
      ladder.update({ values: [st.tds], labels: ['当前水样'], colors: ['orange'] });
      note.textContent = st.tds > 10000
        ? '左侧是淡水在地球上的位置，右侧是你手上这杯“水”的含盐量。海水淡化要做的事：把右边的数字拉到 500 以下，同时别把能量烧光。'
        : '含盐量低于 1,000 mg/L 时，通常先考虑常规净水工艺；淡化真正登场，是从“常规工艺搞不定这个盐度”开始。';
    }

    /* first paint with the ladder + current sample side by side */
    ladder.update({
      values: sim.salinityLadder().map(function (r) { return r.tds; }),
      labels: sim.salinityLadder().map(function (r) { return r.name; }),
      colors: sim.salinityLadder().map(function (r) { return r.color; })
    });
    sync();

    return {
      apply: function (p) {
        if (p.tds != null) tdsCtl.set(p.tds);
        if (p.donutCenter) donut.update({ center: p.donutCenter });
        if (p.ladderFocus != null) {
          ladder.update({
            values: sim.salinityLadder().map(function (r) { return r.tds; }),
            labels: sim.salinityLadder().map(function (r) { return r.name; }),
            colors: sim.salinityLadder().map(function (r) { return r.name === p.ladderFocus ? 'orange' : r.color; })
          });
        }
        sync();
      },
      destroy: function () { donut.destroy(); ladder.destroy(); }
    };
  }

  DL.registerModule({
    id: 'A', slug: 'water', order: 1,
    title: '水与盐', en: 'Water & Salt',
    subtitle: '地球上的淡水到底在哪，海水里到底有什么。',
    hint: '拖动含盐量滑块，观察电导率、密度与标准线的关系。',
    scenes: [
      {
        title: '地球的水几乎全是咸的',
        body: '<p>海洋占地球总水约 <b>96.5%</b>；淡水只有 <b>2.5%</b>，其中近七成锁在冰盖与冰川里，湖河等最容易取用的地表水只占淡水的约 1%。</p><p>所以对很多沿海城市来说，“最近的淡水”根本不存在——最近的水是海，需要先处理。</p>',
        guide: '看左图：淡水的内部结构。绿色切片小到几乎看不见。',
        patch: { donutCenter: { value: '2.5%', label: '淡水占地球总水' } }
      },
      {
        title: '35 g/L：海水的含盐量',
        body: '<p>平均海水 TDS ≈ <b>35,000 mg/L</b>（≈35 g/kg）。把它调到右侧滑块上：电导率约 54 mS/cm，密度约 1,025 kg/m³。</p><p>而饮用水的感官参考线在 <b>500 mg/L</b>——淡化要把盐砍掉 99%。</p>',
        guide: '把滑块停在 35,000，读右下角的“相对饮用水参考”。',
        patch: { tds: 35000, ladderFocus: '海水' }
      },
      {
        title: 'TDS 不是健康红线',
        body: '<p>WHO 明确：<b>TDS 不作为健康基准制定限值</b>。500 mg/L 是口感与感官的可接受参考（如美国 EPA 二类辅助标准）。</p><p>真正让人拒绝喝水的是咸味、苦涩与腐蚀风险，而不是 TDS 本身。</p>',
        guide: '读面板提示：水型判断和标准线含义。',
        patch: { tds: 500 }
      },
      {
        title: '浓盐水：淡化的另一面',
        body: '<p>淡化不会消灭盐，只是<b>搬运盐</b>。一半海水变成淡水，剩下的浓盐水盐度接近翻倍（约 60–70 g/L）。</p><p>下一模块开始讲“水是怎么穿过膜而不带盐”的机制。</p>',
        guide: '跳到“RO浓水”档，看它比海水浓多少。',
        patch: { tds: 63400, ladderFocus: 'RO 浓盐水' }
      }
    ],
    quiz: [
      {
        q: '地球总水中，淡水占比最接近？',
        options: ['0.5%', '2.5%', '10%', '25%'],
        answer: 1,
        explain: 'USGS 口径：淡水约占总水的 2.5%，其中约 68.7% 在冰盖/冰川，30.1% 是地下水与土壤水。'
      },
      {
        q: '关于饮用水的 TDS 500 mg/L，正确的说法是？',
        options: ['WHO 的健康基准限值', '口感/感官参考值（非强制）', '法律强制红线', 'RO 膜的物理上限'],
        answer: 1,
        explain: 'WHO 对 TDS 不设健康基准限值；500 mg/L 来自口感可接受的辅助标准（如 EPA 二类标准）。'
      }
    ],
    mount: mount
  });
})();
