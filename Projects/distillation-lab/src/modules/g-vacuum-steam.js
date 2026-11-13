/* Module G — lowering the boiling temperature: vacuum distillation and steam distillation. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, T = DL.thermo, plot = DL.plot;

  var DEFAULT = { mode: 'vacuum', P: 101.325, org: 'toluene', tb: 250, M: 150 };

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

    function po(T0) { return st.org === 'toluene' ? T.psat('toluene', T0) : T.psatTrouton(st.tb, T0); }
    function orgName() { return st.org === 'toluene' ? '甲苯' : '高沸点有机物'; }
    var chart = plot.chart(h1, {
      label: '蒸气压曲线与沸腾温度', title: '蒸气压 <b>vs</b> 温度',
      x: { min: 0, max: 280, label: '温度 T / °C' }, y: { min: 0.1, max: 1000, log: true, label: '压力 / kPa（对数）', fmt: function (v) { return v < 1 ? String(v) : String(Math.round(v)); } },
      hover: function (x) {
        var pw = T.kPa(T.psat('water', x)), p2 = T.kPa(po(x));
        return { html: 'T = ' + x.toFixed(1) + ' °C<br>水 p* = ' + pw.toFixed(2) + ' kPa<br>' + orgName() + ' p* = ' + p2.toFixed(3) + ' kPa<br>两者之和 = ' + (pw + p2).toFixed(2) + ' kPa', vx: x };
      }
    });
    var cardRefs = {};
    ['a', 'b', 'c', 'd'].forEach(function (k) { var el = ui.el('div', 'card', '<span></span><b>—</b><small></small>'); cards.appendChild(el); cardRefs[k] = el; });
    function setCard(k, label, v, sub, tone) { var el = cardRefs[k]; el.querySelector('span').textContent = label; el.querySelector('b').textContent = v; el.querySelector('small').textContent = sub || ''; el.className = 'card' + (tone ? ' ' + tone : ''); }

    var gMo = ui.section(panel, '方法', 'METHOD');
    var modeCtl = ui.seg({ options: [{ value: 'vacuum', label: '减压蒸馏' }, { value: 'steam', label: '水蒸气蒸馏' }], value: st.mode, onChange: function (v) { st.mode = v; sync(); } });
    gMo.appendChild(modeCtl.el);
    var gP = ui.section(panel, '压力', 'PRESSURE');
    var PCtl = ui.slider({ label: '系统总压', min: 0.5, max: 101.3, step: 0.1, value: st.P, unit: 'kPa', onInput: function (v) { st.P = v; sync(); } });
    gP.appendChild(PCtl.el);
    gP.appendChild(ui.row([ui.button('101.3', function () { st.P = 101.325; sync(); }, 'sm'), ui.button('20', function () { st.P = 20; sync(); }, 'sm'), ui.button('5', function () { st.P = 5; sync(); }, 'sm'), ui.button('1 kPa', function () { st.P = 1; sync(); }, 'sm')]));
    var gO = ui.section(panel, '有机物', 'ORGANIC');
    var orgCtl = ui.seg({ options: [{ value: 'toluene', label: '甲苯（Antoine）' }, { value: 'custom', label: '自定高沸物（估算）' }], value: st.org, onChange: function (v) { st.org = v; sync(); } });
    var tbCtl = ui.slider({ label: '常压沸点 Tb', min: 130, max: 360, step: 1, value: st.tb, unit: '°C', onInput: function (v) { st.tb = v; sync(); } });
    var MCtl = ui.slider({ label: '摩尔质量 M', min: 80, max: 320, step: 1, value: st.M, unit: 'g/mol', onInput: function (v) { st.M = v; sync(); } });
    [orgCtl, tbCtl, MCtl].forEach(function (c) { gO.appendChild(c.el); });
    gO.appendChild(ui.note('自定物质的蒸气压用 Clausius–Clapeyron + Trouton 规则（ΔS<sub>vap</sub> ≈ 88 J/(mol·K)）由常压沸点估算，误差可达数 °C 到十几 °C，只示意量级。'));
    var gM = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 'tbo', label: orgName() + '在此压力的沸点' }, { key: 'tbw', label: '水在此压力的沸点' },
      { key: 'ts', label: '水蒸气蒸馏温度' }, { key: 'ratio', label: '馏出物中 有机物 : 水（质量）' },
      { key: 'y', label: '蒸汽中有机物摩尔分数' }, { key: 'steam', label: '每 kg 有机物耗蒸汽' }
    ]);
    gM.appendChild(m.el);
    var formula = ui.formula(''); gM.appendChild(formula);
    var warn = ui.warn(''); gM.appendChild(warn);
    var gR = ui.section(panel);
    gR.appendChild(ui.row([ui.reset(function () { Object.assign(st, DEFAULT); sync(); })]));

    function sync() {
      modeCtl.set(st.mode); orgCtl.set(st.org);
      [[PCtl, st.P], [tbCtl, st.tb], [MCtl, st.M]].forEach(function (p) { p[0].set(p[1], true); });
      tbCtl.el.style.display = MCtl.el.style.display = st.org === 'custom' ? '' : 'none';
      var P = T.mmHg(st.P);
      var org = st.org === 'toluene' ? 'toluene' : { tb: st.tb, M: st.M };
      var sd = T.steam({ P: P, organic: org });
      var tbo = sd.tbOrg, tbw = sd.tbWater;
      var tbo1 = st.org === 'toluene' ? T.tsat('toluene', T.ATM) : st.tb;
      var sd1 = T.steam({ P: T.ATM, organic: org });
      var Tmax = Math.max(140, Math.ceil((tbo1 + 30) / 20) * 20);
      chart.setAxes({ min: 0, max: Tmax, label: '温度 T / °C' }, null);
      chart.draw(function (g) {
        g.grid().open();
        var w = [], o = [], s = [];
        for (var T0 = 0; T0 <= Tmax; T0 += 1) {
          var pw = T.kPa(T.psat('water', T0)), p2 = T.kPa(po(T0));
          w.push([T0, pw]); o.push([T0, p2]); s.push([T0, pw + p2]);
        }
        g.path(w, { c: 'var(--blue)', w: 2.2 });
        g.path(o, { c: 'var(--orange)', w: 2.2 });
        if (st.mode === 'steam') g.path(s, { c: 'var(--violet)', w: 2.2, dash: '6 3' });
        g.hline(st.P, { c: 'var(--text)', w: 1, dash: '4 3' });
        g.text(2, st.P, '总压 ' + st.P.toFixed(1) + ' kPa', { dx: 4, dy: -6, c: 'var(--text)' });
        g.dot(tbw, st.P, { c: 'var(--blue)' }); g.text(tbw, st.P, '水 ' + tbw.toFixed(1) + '°', { dx: -4, dy: 16, anchor: 'end', c: 'var(--blue)' });
        if (tbo < Tmax) { g.dot(tbo, st.P, { c: 'var(--orange)' }); g.text(tbo, st.P, orgName() + ' ' + tbo.toFixed(1) + '°', { dx: 4, dy: 16, c: 'var(--orange)' }); }
        if (st.mode === 'steam') { g.dot(sd.T, st.P, { c: 'var(--violet)', r: 5 }); g.text(sd.T, st.P, '共沸腾 ' + sd.T.toFixed(1) + '°', { dx: -6, dy: -10, anchor: 'end', c: 'var(--violet)' }); }
        g.label(g.area.x1 - 8, g.area.y1 - 38, '蓝：水', { anchor: 'end', c: 'var(--blue)', size: 10, sans: true });
        g.label(g.area.x1 - 8, g.area.y1 - 23, '橙：' + orgName(), { anchor: 'end', c: 'var(--orange)', size: 10, sans: true });
        if (st.mode === 'steam') g.label(g.area.x1 - 8, g.area.y1 - 8, '紫虚线：两者蒸气压之和', { anchor: 'end', c: 'var(--violet)', size: 10, sans: true });
        g.close();
      });
      if (st.mode === 'vacuum') {
        setCard('a', orgName() + '沸点 @ ' + st.P.toFixed(1) + ' kPa', tbo.toFixed(1) + ' °C', '常压 ' + tbo1.toFixed(1) + ' °C', 'hi');
        setCard('b', '沸点降低', Math.max(0, tbo1 - tbo).toFixed(1) + ' K', '压力降为 ' + (st.P / 101.325 * 100).toFixed(1) + ' %', 'warm');
        setCard('c', '蒸汽体积（同摩尔量）', '×' + (101.325 / st.P * (tbo + 273.15) / (tbo1 + 273.15)).toFixed(1), '相对常压沸腾：塔径要更大', '');
        setCard('d', '冷凝温度', tbo.toFixed(0) + ' °C', tbo < 35 ? '可能需要冷冻水' : '冷却水可用', tbo < 35 ? 'bad' : '');
      } else {
        setCard('a', '水蒸气蒸馏温度', sd.T.toFixed(1) + ' °C', '低于水的 ' + tbw.toFixed(1) + ' °C 与有机物的 ' + tbo.toFixed(0) + ' °C', 'hi');
        setCard('b', '馏出物 有机物 : 水', sd.massRatio.toFixed(sd.massRatio < 0.1 ? 3 : 2) + ' : 1', '质量比', 'warm');
        setCard('c', '每 kg 有机物耗蒸汽', sd.steamPerKg.toFixed(sd.steamPerKg < 10 ? 2 : 0) + ' kg', '只计被带出的水，不含加热损失', sd.steamPerKg > 10 ? 'bad' : '');
        setCard('d', '常压对照', sd1.T.toFixed(1) + ' °C', '101.3 kPa 下的水蒸气蒸馏温度', '');
      }
      m.set({
        tbo: tbo.toFixed(1) + ' °C', tbw: tbw.toFixed(1) + ' °C', ts: sd.T.toFixed(1) + ' °C',
        ratio: sd.massRatio.toFixed(3) + ' : 1', y: sd.yOrg.toFixed(4), steam: sd.steamPerKg.toFixed(2) + ' kg'
      }, { ts: st.mode === 'steam' ? 'hi' : '', tbo: st.mode === 'vacuum' ? 'hi' : '' });
      formula.innerHTML = st.mode === 'vacuum'
        ? '沸腾条件：p*(T) = P<br>Antoine：log₁₀p* = A − B/(C + T)，P 越低，T 越低'
        : '不互溶液体：各自贡献全部蒸气压<br>p*<sub>水</sub>(T) + p*<sub>有机</sub>(T) = P<br>m<sub>有机</sub>/m<sub>水</sub> = (p*<sub>有机</sub>·M<sub>有机</sub>)/(p*<sub>水</sub>·M<sub>水</sub>)';
      var w = [];
      if (st.org === 'custom') w.push('自定物质的蒸气压为 Trouton 规则估算值。');
      if (st.mode === 'steam' && st.org === 'toluene' && Math.abs(st.P - 101.325) < 0.5) w.push('文献：甲苯–水非均相恒沸点约 84.1 °C、含甲苯约 80 wt%；本模型给出 ' + sd.T.toFixed(1) + ' °C、' + (sd.massRatio / (1 + sd.massRatio) * 100).toFixed(1) + ' wt%。');
      warn.innerHTML = w.join('<br>'); warn.style.display = w.length ? '' : 'none';
      sch.innerHTML = st.mode === 'vacuum' ? vacuumSvg(tbo) : steamSvg(sd);
      note.innerHTML = st.mode === 'vacuum'
        ? '把压力从 101.3 kPa 降到 <b>' + st.P.toFixed(1) + ' kPa</b>，' + orgName() + '的沸点从 ' + tbo1.toFixed(1) + ' °C 降到 <b>' + tbo.toFixed(1) + ' °C</b>。高沸点、热敏物料（维生素、香料、重油）因此可以在分解温度以下蒸出；代价是真空设备、更大的塔径和更低的冷凝温度。'
        : orgName() + '与水互不相溶，两者各自贡献全部蒸气压，<b>' + sd.T.toFixed(1) + ' °C</b> 时总和就达到 ' + st.P.toFixed(1) + ' kPa——低于两者各自的沸点。每蒸出 1 kg ' + orgName() + '要带出约 <b>' + sd.steamPerKg.toFixed(2) + ' kg</b> 水；有机物越难挥发，耗蒸汽越多。';
    }

    function vacuumSvg(tbo) {
      var gauge = Math.max(0.03, Math.min(1, st.P / 101.325));
      var ang = Math.PI * (1 - gauge);
      return '<svg viewBox="0 0 460 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
        t(14, 24, '减压蒸馏', 's-title') + t(14, 42, '真空泵抽走不凝气，整套装置处于低压', 's-small') +
        '<defs><clipPath id="vacPot"><circle cx="110" cy="200" r="54"/></clipPath></defs>' +
        '<circle class="s-shell" cx="110" cy="200" r="54"/>' +
        '<rect x="56" y="206" width="108" height="48" style="fill:var(--orange);opacity:.6" clip-path="url(#vacPot)"/>' +
        '<path class="s-heat" d="M80 262 q4 -8 8 0 q4 8 8 0 q4 -8 8 0 q4 8 8 0 q4 -8 8 0 q4 8 8 0"/>' +
        t(110, 204, tbo.toFixed(0) + ' °C', 's-mono', 'middle') +
        '<path class="s-line" d="M110 146 V90 H250" style="stroke:var(--orange);stroke-width:2.4"/>' +
        '<rect class="s-box" x="240" y="78" width="120" height="26" rx="13" transform="rotate(16 300 91)"/>' +
        '<path class="s-cool" d="M252 88 q6 -6 12 0 q6 6 12 0 q6 -6 12 0 q6 6 12 0 q6 -6 12 0 q6 6 12 0 q6 -6 12 0" transform="rotate(16 300 91)"/>' +
        '<path class="s-light" d="M356 122 V160"/>' +
        '<path class="s-line" d="M336 160 h40 v70 a6 6 0 0 1 -6 6 h-28 a6 6 0 0 1 -6 -6 z"/>' +
        '<rect x="338" y="200" width="36" height="34" style="fill:var(--orange);opacity:.75"/>' +
        '<path class="s-line" d="M376 172 H420 V230" style="stroke:var(--dim);stroke-width:2"/>' +
        '<rect class="s-box" x="398" y="230" width="44" height="34" rx="6"/>' + t(420, 252, '真空泵', 's-small', 'middle') +
        '<circle class="s-box" cx="420" cy="120" r="26"/>' +
        '<path d="M' + (420 + 20 * Math.cos(ang)) + ' ' + (120 - 20 * Math.sin(ang)) + ' L420 120" style="stroke:var(--red);stroke-width:2.2"/>' +
        t(420, 160, st.P.toFixed(1) + ' kPa', 's-mono', 'middle') +
        '</svg>';
    }
    function steamSvg(sd) {
      var orgFrac = sd.massRatio / (1 + sd.massRatio);
      var hOrg = Math.max(4, 64 * orgFrac), hW = 64 - hOrg;
      var orgLight = st.org === 'toluene'; // toluene is lighter than water; many high boilers are too, treat as top layer
      return '<svg viewBox="0 0 460 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
        t(14, 24, '水蒸气蒸馏', 's-title') + t(14, 42, '通入蒸汽 → 物料与水一起沸腾 → 冷凝后分层', 's-small') +
        '<rect class="s-box" x="20" y="160" width="60" height="80" rx="10"/>' + t(50, 256, '蒸汽发生器', 's-small', 'middle') +
        '<path class="s-heat" d="M30 250 q4 -8 8 0 q4 8 8 0 q4 -8 8 0 q4 8 8 0"/>' +
        '<path class="s-steam" d="M50 160 V120 H130 V196"/>' +
        '<defs><clipPath id="stmPot"><circle cx="150" cy="210" r="48"/></clipPath></defs>' +
        '<circle class="s-shell" cx="150" cy="210" r="48"/>' +
        '<rect x="102" y="212" width="96" height="46" style="fill:var(--orange);opacity:.55" clip-path="url(#stmPot)"/>' +
        t(150, 206, sd.T.toFixed(1) + ' °C', 's-mono', 'middle') +
        '<path class="s-line" d="M150 162 V96 H262" style="stroke:var(--violet);stroke-width:2.4"/>' +
        '<rect class="s-box" x="252" y="84" width="112" height="26" rx="13" transform="rotate(16 308 97)"/>' +
        '<path class="s-cool" d="M264 94 q6 -6 12 0 q6 6 12 0 q6 -6 12 0 q6 6 12 0 q6 -6 12 0 q6 6 12 0" transform="rotate(16 308 97)"/>' +
        '<path class="s-line" d="M360 128 V168" style="stroke:var(--muted);stroke-width:2"/>' +
        '<path class="s-line" d="M328 168 h64 l-14 90 h-36 z"/>' +
        '<rect x="336" y="' + (178) + '" width="48" height="' + (orgLight ? hOrg : hW) + '" style="fill:' + (orgLight ? 'var(--orange)' : 'var(--blue)') + ';opacity:.7"/>' +
        '<rect x="336" y="' + (178 + (orgLight ? hOrg : hW)) + '" width="48" height="' + (orgLight ? hW : hOrg) + '" style="fill:' + (orgLight ? 'var(--blue)' : 'var(--orange)') + ';opacity:.7"/>' +
        t(400, 190, orgName(), 's-small') + t(400, 206, (orgFrac * 100).toFixed(1) + ' wt%', 's-mono') +
        t(400, 228, '水', 's-small') + t(400, 244, ((1 - orgFrac) * 100).toFixed(1) + ' wt%', 's-mono') +
        t(360, 276, '分液漏斗', 's-small', 'middle') +
        '</svg>';
    }

    function apply(p) { Object.assign(st, p || {}); sync(); }
    sync();
    return { apply: apply, destroy: function () { chart.destroy(); } };
  }

  DL.registerModule({
    id: 'G', slug: 'vacuum-steam', order: 7,
    title: '减压与水蒸气蒸馏', en: 'VACUUM & STEAM',
    subtitle: '让高沸点、热敏物料在低温下蒸出',
    hint: '把总压拖低，或切换到水蒸气蒸馏，看沸腾温度落在哪里。',
    scenes: [
      {
        title: '沸点取决于压力',
        body: '液体在蒸气压等于外压时沸腾。甲苯的蒸气压曲线与 101.3 kPa 横线交于 110.6 °C；把横线下移，交点就向左移——<b>沸点降低</b>。',
        patch: { mode: 'vacuum', org: 'toluene', P: 101.325 }, guide: '在图上移动鼠标读蒸气压。', duration: 11000
      },
      {
        title: '减压到 10 kPa',
        body: '压力降到 <b>10 kPa</b>，甲苯沸点降到约 45 °C。同样的分离可以在低得多的温度下进行，热敏物料不易分解、聚合或结焦。',
        patch: { mode: 'vacuum', P: 10 }, guide: '注意卡片中的冷凝温度：太低就需要冷冻水。', duration: 11000
      },
      {
        title: '高沸点物质：减压是必需的',
        body: '一个常压沸点约 250 °C 的物质，在 1 kPa 下估计只需约 90 °C 就能沸腾。原油常压渣油送去<b>减压蒸馏</b>也是这个道理（模块 I）。',
        patch: { mode: 'vacuum', org: 'custom', tb: 250, M: 150, P: 1 }, guide: '拖动 Tb，看减压下沸点的变化。', duration: 12000
      },
      {
        title: '不互溶：各自贡献全部蒸气压',
        body: '甲苯与水几乎不互溶。两者<b>各自</b>按纯物质的蒸气压汽化，总压 = 两者之和。紫色虚线在约 84 °C 达到 101.3 kPa——低于水的 100 °C 和甲苯的 110.6 °C。',
        patch: { mode: 'steam', org: 'toluene', P: 101.325 }, guide: '紫色虚线与总压线的交点就是沸腾温度。', duration: 13000
      },
      {
        title: '高沸点物质的水蒸气蒸馏',
        body: '换成常压沸点 250 °C、M = 150 的物质：混合物在 100 °C 稍下就沸腾，物质被“温和地”带出，但每 kg 产品要消耗约 8–9 kg 蒸汽。精油提取就是典型应用。',
        patch: { mode: 'steam', org: 'custom', tb: 250, M: 150, P: 101.325 }, guide: '看“每 kg 有机物耗蒸汽”。', duration: 12000
      },
      {
        title: '减压 + 水蒸气',
        body: '两种方法可以叠加：在 20 kPa 下进行水蒸气蒸馏，沸腾温度降到约 60 °C；对这个物质，蒸汽中有机物的比例略有下降（耗蒸汽由约 8.5 增至约 9.9 kg/kg），温度换来了蒸汽。减压塔常向塔底通入汽提蒸汽，正是同样的原理。',
        patch: { mode: 'steam', org: 'custom', tb: 250, M: 150, P: 20 }, guide: '比较 101.3 kPa 与 20 kPa 下的读数。', duration: 12000
      }
    ],
    mount: mount
  });
})();
