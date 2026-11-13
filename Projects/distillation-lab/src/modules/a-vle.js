/* Module A — vapour–liquid equilibrium: vapour pressure, T–x–y, x–y and α. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, T = DL.thermo, plot = DL.plot;

  var DEFAULT = { sys: 'bt', alpha: 2.5, P: 101.325, x: 0.4, view: 'txy' };

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage, panel = ctx.panel;
    var eq = null;

    var row = ui.el('div', 'stage-row c2');
    var leftHost = ui.el('div'), rightHost = ui.el('div');
    row.appendChild(leftHost); row.appendChild(rightHost);
    var cards = ui.el('div', 'cards');
    var note = ui.el('p', 'stage-note');
    stage.appendChild(row); stage.appendChild(cards); stage.appendChild(note);

    var left = plot.chart(leftHost, {
      label: '温度–组成相图或蒸气压曲线', title: '<b id="aLeftTitle">T–x–y</b>',
      x: { min: 0, max: 1 }, y: { min: 60, max: 120 },
      hover: function (x, y) {
        if (st.view === 'psat') {
          var p1 = T.kPa(T.psat(eq.sys.light, x)), p2 = T.kPa(T.psat(eq.sys.heavy, x));
          return { html: 'T = ' + x.toFixed(1) + ' °C<br>' + T.COMPONENTS[eq.sys.light].name + ' p* = ' + p1.toFixed(1) + ' kPa<br>' + T.COMPONENTS[eq.sys.heavy].name + ' p* = ' + p2.toFixed(1) + ' kPa', vx: x };
        }
        if (!eq.hasT) return null;
        var Tb = eq.T(x), Td = eq.Tdew(x);
        var lo = Math.min(Tb, Td), hi = Math.max(Tb, Td);
        var region = y < lo ? '过冷液体' : y > hi ? '过热蒸汽' : '气液两相';
        return { html: 'z = ' + x.toFixed(3) + '　T = ' + y.toFixed(1) + ' °C<br><b>' + region + '</b><br>泡点 ' + Tb.toFixed(1) + ' °C · 露点 ' + Td.toFixed(1) + ' °C', vx: x };
      }
    });
    var right = plot.chart(rightHost, {
      label: 'x–y 平衡曲线', square: true, title: 'x–y 图 <b id="aRightTitle"></b>',
      x: { min: 0, max: 1, label: '液相 x（轻组分）' }, y: { min: 0, max: 1, label: '气相 y' },
      hover: function (x) {
        var xx = Math.max(0, Math.min(1, x)), y = eq.y(xx);
        return { html: 'x = ' + xx.toFixed(3) + '<br>y* = ' + y.toFixed(3) + '<br>α = ' + eq.alpha(xx).toFixed(3), marks: [[xx, y, 'var(--cyan)']] };
      }
    });

    var cardRefs = {};
    [['tb', '泡点 T_bub'], ['y', '平衡气相 y*'], ['alpha', '相对挥发度 α'], ['gam', '活度系数 γ₁ / γ₂']].forEach(function (c) {
      var el = ui.el('div', 'card', '<span>' + c[1] + '</span><b>—</b><small></small>');
      cards.appendChild(el); cardRefs[c[0]] = el;
    });
    function setCard(k, v, sub, tone) { var el = cardRefs[k]; el.querySelector('b').textContent = v; el.querySelector('small').textContent = sub || ''; el.className = 'card' + (tone ? ' ' + tone : ''); }

    /* panel */
    var gS = ui.section(panel, '体系', 'SYSTEM');
    var sysCtl = ui.seg({ options: DL.systemOptions({ max: true }), value: st.sys, onChange: function (v) { st.sys = v; sync(); } });
    gS.appendChild(sysCtl.el);
    var alphaCtl = ui.slider({ label: '相对挥发度 α', min: 1.05, max: 8, step: 0.05, value: st.alpha, onInput: function (v) { st.alpha = v; sync(); } });
    gS.appendChild(alphaCtl.el);
    var gV = ui.section(panel, '左图', 'VIEW');
    var viewCtl = ui.seg({ options: [{ value: 'txy', label: 'T–x–y 相图' }, { value: 'psat', label: '蒸气压曲线' }], value: st.view, onChange: function (v) { st.view = v; sync(); } });
    gV.appendChild(viewCtl.el);
    var gC = ui.section(panel, '条件', 'STATE');
    var PCtl = ui.slider({ label: '总压 P', min: 10, max: 1100, step: 0.5, value: st.P, unit: 'kPa', onInput: function (v) { st.P = v; sync(); } });
    var xCtl = ui.slider({ label: '液相组成 x（轻组分）', min: 0, max: 1, step: 0.01, value: st.x, onInput: function (v) { st.x = v; sync(); } });
    gC.appendChild(PCtl.el); gC.appendChild(xCtl.el);
    gC.appendChild(ui.row([20, 101.325, 500, 1000].map(function (p) { return ui.button(p === 101.325 ? '1 atm' : p + ' kPa', function () { st.P = p; sync(); }, 'sm'); })));
    var aspenNote = ui.note('乙醇–水在 20 / 101.3 / 500 / 1000 kPa 下，图上的白色圆点是 Aspen Plus V15（NRTL）的计算结果，可直接与曲线对照。');
    gC.appendChild(aspenNote);

    var gM = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 'p1', label: '轻组分饱和蒸气压 p₁*' }, { key: 'p2', label: '重组分饱和蒸气压 p₂*' },
      { key: 'pp1', label: '轻组分分压 x·γ₁·p₁*' }, { key: 'pp2', label: '重组分分压' },
      { key: 'td', label: '同组成的露点' }, { key: 'gap', label: '露点 − 泡点' }
    ]);
    gM.appendChild(m.el);
    var formula = ui.formula('');
    gM.appendChild(formula);
    var warn = ui.warn(''); gM.appendChild(warn);
    var gR = ui.section(panel);
    gR.appendChild(ui.row([ui.reset(function () { Object.assign(st, DEFAULT); sync(); })]));
    gR.appendChild(ui.note('气相按理想气体；液相用 Raoult 定律、NRTL（乙醇–水，Aspen Plus V15 APV150 参数）或 van Laar（丙酮–氯仿，由 1 atm 恒沸点反算）。'));

    function aspenSet() {
      if (st.sys !== 'ew' || !DL.aspen) return null;
      var keys = Object.keys(DL.aspen.txy);
      for (var i = 0; i < keys.length; i++) if (Math.abs(+keys[i] - st.P) / +keys[i] < 0.005) return DL.aspen.txy[keys[i]];
      return null;
    }
    function drawLeft() {
      var titleEl = document.getElementById('aLeftTitle');
      if (st.view === 'psat' && eq.hasT) {
        var tl = eq.tbLight, th = eq.tbHeavy;
        var Tmin = Math.floor((Math.min(tl, th) - 45) / 10) * 10, Tmax = Math.ceil((Math.max(tl, th) + 25) / 10) * 10;
        left.setAxes({ min: Tmin, max: Tmax, label: '温度 T / °C' }, { min: 2, max: 500, log: true, label: '饱和蒸气压 / kPa（对数）', fmt: function (v) { return String(v); } });
        if (titleEl) titleEl.textContent = 'ANTOINE 蒸气压曲线';
        left.draw(function (g) {
          g.grid().open();
          var a = [], b = [];
          for (var t = Tmin; t <= Tmax; t += 1) { a.push([t, T.kPa(T.psat(eq.sys.light, t))]); b.push([t, T.kPa(T.psat(eq.sys.heavy, t))]); }
          g.path(a, { c: 'var(--cyan)', w: 2.2 });
          g.path(b, { c: 'var(--orange)', w: 2.2 });
          g.hline(st.P, { c: 'var(--text)', w: 1, dash: '4 3' });
          g.text(Tmin, st.P, '系统压力 ' + st.P.toFixed(1) + ' kPa', { dx: 6, dy: -6, c: 'var(--text)', size: 10 });
          g.dot(tl, st.P, { c: 'var(--cyan)' }); g.dot(th, st.P, { c: 'var(--orange)' });
          g.text(tl, st.P, T.COMPONENTS[eq.sys.light].name + ' ' + tl.toFixed(1) + '°', { dx: -4, dy: 16, anchor: 'end', c: 'var(--cyan)' });
          g.text(th, st.P, T.COMPONENTS[eq.sys.heavy].name + ' ' + th.toFixed(1) + '°', { dx: 4, dy: 16, c: 'var(--orange)' });
          var b0 = T.bubble(eq.sys, st.x, T.mmHg(st.P));
          if (isFinite(b0.T)) {
            g.vline(b0.T, { c: 'var(--yellow)', w: 1, dash: '3 3' });
            g.text(b0.T, 2, 'x = ' + st.x.toFixed(2) + ' 的泡点', { dx: 4, dy: -6, c: 'var(--yellow)', size: 9.5 });
          }
          g.close();
        });
      } else if (eq.hasT) {
        var Ts = eq.Ts.filter(isFinite);
        var lo = Math.min.apply(null, Ts), hi = Math.max.apply(null, Ts);
        var pad = Math.max(3, (hi - lo) * 0.12);
        left.setAxes({ min: 0, max: 1, label: 'x 或 y（轻组分摩尔分数）' }, { min: Math.floor(lo - pad), max: Math.ceil(hi + pad), label: '温度 T / °C' });
        if (titleEl) titleEl.textContent = 'T–x–y · ' + st.P.toFixed(1) + ' kPa';
        left.draw(function (g) {
          plot.txy(g, eq, { x: st.x });
          var ad = aspenSet();
          if (ad) {
            g.open();
            ad.forEach(function (p, i) { if (i % 2) return; g.dot(p[0], p[2], { c: 'var(--text)', r: 2.6, sw: 1 }); g.dot(p[1], p[2], { c: 'var(--text)', r: 2.6, sw: 1 }); });
            g.close();
            g.label(g.area.x0 + 8, g.area.y0 + 14, '● Aspen Plus V15 · NRTL', { c: 'var(--text)', size: 10, sans: true });
          }
          if (eq.azeotrope) { g.open(); g.dot(eq.azeotrope.x, eq.azeotrope.T, { c: 'var(--red)', r: 4.5 }); g.text(eq.azeotrope.x, eq.azeotrope.T, '恒沸点', { dy: eq.azeotrope.type === 'min' ? 16 : -9, anchor: 'middle', c: 'var(--red)' }); g.close(); }
          var Tb = eq.T(st.x);
          g.label(g.area.x1 - 6, g.area.y1 - 8, '泡点线（液相）', { anchor: 'end', c: 'var(--blue)', size: 9.5, sans: true });
          g.text(st.x, Tb, 'x', { dx: -10, dy: 4, c: 'var(--blue)', size: 10 });
          g.text(eq.y(st.x), Tb, 'y*', { dx: 6, dy: 4, c: 'var(--orange)', size: 10 });
        });
      } else {
        left.setAxes({ min: 0, max: 1 }, { min: 0, max: 1 });
        if (titleEl) titleEl.textContent = '无温度信息';
        left.draw(function (g) {
          g.label(g.W / 2, g.H / 2 - 6, st.sys === 'alpha' ? '恒定 α 模型只描述 x–y 关系' : '导入数据只含 x–y', { anchor: 'middle', c: 'var(--muted)', size: 12, sans: true });
          g.label(g.W / 2, g.H / 2 + 14, '选择真实体系可查看 T–x–y 与蒸气压', { anchor: 'middle', c: 'var(--dim)', size: 10.5, sans: true });
        });
      }
    }
    function drawRight() {
      var t = document.getElementById('aRightTitle');
      if (t) t.textContent = eq.azeotrope ? '· 曲线穿过对角线' : '· α ≈ ' + eq.alpha(0.5).toFixed(2);
      right.draw(function (g) {
        g.grid().open();
        g.line(0, 0, 1, 1, { c: 'var(--dim)', w: 1, dash: '3 4' });
        if (st.sys !== 'alpha' && st.sys !== 'custom') {
          // reference: constant-alpha curve with the mid-range α, to show non-ideality
          var a = eq.alpha(0.5), ref = [];
          if (!eq.azeotrope) {
            for (var i = 0; i <= 50; i++) { var xx = i / 50; ref.push([xx, a * xx / (1 + (a - 1) * xx)]); }
            g.path(ref, { c: 'var(--dim)', w: 1, dash: '2 3' });
          }
        }
        g.path(plot.eqPoints(eq), { c: 'var(--cyan)', w: 2.4 });
        var ad = aspenSet();
        if (ad) ad.forEach(function (p, i) { if (i % 2 === 0) g.dot(p[0], p[1], { c: 'var(--text)', r: 2.6, sw: 1 }); });
        var y = eq.y(st.x);
        g.line(st.x, 0, st.x, y, { c: 'var(--blue)', w: 1, dash: '3 3' });
        g.line(0, y, st.x, y, { c: 'var(--orange)', w: 1, dash: '3 3' });
        g.dot(st.x, y, { c: 'var(--yellow)', r: 5 });
        g.text(st.x, y, '(' + st.x.toFixed(2) + ', ' + y.toFixed(3) + ')', { dx: 8, dy: 12, c: 'var(--text)' });
        if (eq.azeotrope) {
          g.dot(eq.azeotrope.x, eq.azeotrope.x, { c: 'var(--red)', r: 5 });
          g.text(eq.azeotrope.x, eq.azeotrope.x, '恒沸 ' + eq.azeotrope.x.toFixed(3), { dx: -8, dy: -10, anchor: 'end', c: 'var(--red)' });
        }
        g.close();
      });
    }

    function sync() {
      if (st.sys === 'custom' && !DL.data.custom) st.sys = 'bt';
      eq = DL.eqFor(st.sys, st.P, st.alpha);
      sysCtl.set(st.sys); viewCtl.set(st.view);
      alphaCtl.el.style.display = st.sys === 'alpha' ? '' : 'none';
      PCtl.el.style.display = eq.hasT ? '' : 'none';
      aspenNote.style.display = st.sys === 'ew' ? '' : 'none';
      [[alphaCtl, st.alpha], [PCtl, st.P], [xCtl, st.x]].forEach(function (p) { p[0].set(p[1], true); });
      drawLeft(); drawRight();

      var y = eq.y(st.x), a = eq.alpha(st.x);
      var b = eq.hasT ? T.bubble(eq.sys, st.x, T.mmHg(st.P)) : null;
      var Td = eq.hasT ? eq.Tdew(st.x) : NaN;
      setCard('tb', b ? b.T.toFixed(2) + ' °C' : '—', b ? 'x = ' + st.x.toFixed(2) + ' 的液体开始沸腾' : '无温度模型', 'hi');
      setCard('y', y.toFixed(3), y > st.x + 1e-4 ? '气相比液相富集轻组分 ' + ((y - st.x) * 100).toFixed(1) + ' 个百分点' : (y < st.x - 1e-4 ? '气相反而更贫：越过了恒沸点' : 'y = x：无法分离'), y < st.x - 1e-4 ? 'bad' : '');
      setCard('alpha', a.toFixed(3), a > 1.0005 ? '>1：可以靠精馏分离' : a < 0.9995 ? '<1：轻重关系颠倒' : '≈1：恒沸', Math.abs(a - 1) < 0.02 ? 'bad' : 'warm');
      setCard('gam', b ? b.g[0].toFixed(3) + ' / ' + b.g[1].toFixed(3) : '1 / 1', b && Math.abs(b.g[0] - 1) + Math.abs(b.g[1] - 1) > 0.01 ? (b.g[0] > 1 ? '正偏差：分子“互相排斥”' : '负偏差：分子“互相吸引”') : '理想溶液');
      if (b) {
        m.set({
          p1: (b.p1 / T.KPA).toFixed(2) + ' kPa', p2: (b.p2 / T.KPA).toFixed(2) + ' kPa',
          pp1: (st.x * b.g[0] * b.p1 / T.KPA).toFixed(2) + ' kPa', pp2: ((1 - st.x) * b.g[1] * b.p2 / T.KPA).toFixed(2) + ' kPa',
          td: isFinite(Td) ? Td.toFixed(2) + ' °C' : '—', gap: isFinite(Td) ? (Td - b.T).toFixed(2) + ' K' : '—'
        });
      } else m.set({ p1: '—', p2: '—', pp1: '—', pp2: '—', td: '—', gap: '—' });
      formula.innerHTML = eq.hasT
        ? '修正 Raoult：y<sub>i</sub>·P = x<sub>i</sub>·γ<sub>i</sub>·p<sub>i</sub>*(T)<br>泡点：Σ x<sub>i</sub>γ<sub>i</sub>p<sub>i</sub>*(T) = P = <b>' + st.P.toFixed(1) + ' kPa</b><br>α = (y/x)/((1−y)/(1−x)) = γ₁p₁*/(γ₂p₂*)'
        : '恒定 α：y = αx / (1 + (α − 1)x)<br>α = (y/x)/((1−y)/(1−x))';
      var w = [];
      if (eq.azeotrope) w.push('恒沸点 x = ' + eq.azeotrope.x.toFixed(3) + '、' + (isFinite(eq.azeotrope.T) ? eq.azeotrope.T.toFixed(2) + ' °C' : '') + '：此处 y = x，普通精馏无法越过。');
      if (eq.hasT && eq.sys.model === 'vanlaar' && Math.abs(st.P - 101.325) > 30) w.push('丙酮–氯仿的 van Laar 参数在 1 atm 拟合，当前压力下恒沸组成只示意趋势。');
      if (aspenSet()) w.push('与 Aspen Plus V15 对照：本页曲线与 Aspen 结果的泡点温度相差 ≤ 0.21 °C，气相组成相差 ≤ 0.0024。');
      warn.innerHTML = w.join('<br>'); warn.style.display = w.length ? '' : 'none';
      if (eq.hasT) {
        note.innerHTML = '在 <b>' + st.P.toFixed(1) + ' kPa</b> 下，组成 x = ' + st.x.toFixed(2) + ' 的液体在 <b>' + b.T.toFixed(1) + ' °C</b> 开始沸腾，第一个气泡的组成是 y* = <b>' + y.toFixed(3) + '</b>。' +
          (y > st.x ? '气相比液相更富含易挥发组分——这就是一切精馏的出发点。' : '此时气相不比液相更“轻”，单靠汽化无法继续提浓。');
      } else {
        note.innerHTML = 'α = ' + st.alpha.toFixed(2) + ' 时，x = ' + st.x.toFixed(2) + ' 的液体与 y* = <b>' + y.toFixed(3) + '</b> 的蒸汽平衡。α 越接近 1，y 与 x 越接近，分离越难。';
      }
    }
    function apply(p) { Object.assign(st, p || {}); sync(); }
    sync();
    return { apply: apply, destroy: function () { left.destroy(); right.destroy(); } };
  }

  DL.registerModule({
    id: 'A', slug: 'vle', order: 1,
    title: '气液平衡', en: 'VAPOUR–LIQUID EQUILIBRIUM',
    subtitle: '蒸气压、泡点露点、相对挥发度与恒沸',
    hint: '拖动液相组成 x，观察两张图上的同一个平衡点。',
    scenes: [
      {
        title: '两种液体，两条蒸气压曲线',
        body: '苯和甲苯各自的饱和蒸气压随温度指数上升（Antoine 方程）。在<b>任何温度</b>下苯的蒸气压都更高——它更“易挥发”。虚线是系统压力，曲线与它的交点就是各自的沸点：80.1 °C 与 110.6 °C。',
        patch: { sys: 'bt', P: 101.325, x: 0.4, view: 'psat' },
        guide: '在左图上移动鼠标，读出同一温度下两者的蒸气压。', duration: 12000
      },
      {
        title: '泡点：第一个气泡',
        body: '把 x = 0.40 的苯–甲苯液体加热。到<b>泡点</b>时，两者分压之和刚好等于总压，冒出第一个气泡。这个气泡里苯的摩尔分数约 0.62——比液体高得多。',
        patch: { view: 'txy', x: 0.4 },
        guide: '左图蓝点 = 液相 x，橙点 = 平衡气相 y*，两点同一温度。', duration: 12000
      },
      {
        title: '露点与两相区',
        body: '下方蓝线是<b>泡点线</b>（液体开始沸腾），上方橙线是<b>露点线</b>（蒸汽开始冷凝）。两线之间是气液两相区：一根水平“连结线”两端就是共存的液相与气相组成。',
        patch: { view: 'txy', x: 0.25 },
        guide: '在左图里移动鼠标，看各区域对应的状态。', duration: 12000
      },
      {
        title: '相对挥发度 α',
        body: '<code>α = (y/x)/((1−y)/(1−x))</code> 衡量“气相把轻组分富集了几倍”。苯–甲苯的 α ≈ 2.4，几乎不随组成变化；α 越大，x–y 曲线离对角线越远，分离越容易。',
        patch: { view: 'txy', x: 0.5 },
        guide: '右图虚线是恒定 α 参考曲线，几乎与真实曲线重合。', duration: 12000
      },
      {
        title: '压力改变沸点，也改变 α',
        body: '把总压降到 <b>20 kPa</b>：整张相图向下平移约 45–50 °C。低温下苯–甲苯的 α 从约 2.5 增至约 3.0——这是减压精馏除保护热敏物外的另一个好处（模块 G）。',
        patch: { P: 20, x: 0.5 },
        guide: '比较 101.3 kPa 与 20 kPa 下的泡点和 α。', duration: 12000
      },
      {
        title: '正偏差：乙醇–水的最低恒沸物',
        body: '乙醇与水分子间作用力弱于各自内部（γ &gt; 1），蒸气压偏高。x–y 曲线在 <b>x ≈ 0.9</b> 处穿过对角线（文献 0.894），T–x–y 图上出现一个最低点：<b>最低恒沸物</b>，约 78.15 °C，比纯乙醇还低。白点是 Aspen Plus V15 的 NRTL 计算结果。',
        patch: { sys: 'ew', P: 101.325, x: 0.5, view: 'txy' },
        guide: '把 x 拖过 0.894，看 y* 与 x 的大小关系翻转。', duration: 14000
      },
      {
        title: '负偏差：丙酮–氯仿的最高恒沸物',
        body: '丙酮与氯仿之间形成氢键（γ &lt; 1），蒸气压偏低。恒沸点在 x ≈ 0.34、约 64.5 °C，<b>高于</b>两个纯组分的沸点——普通精馏时它会留在塔底。',
        patch: { sys: 'ac', P: 101.325, x: 0.34, view: 'txy' },
        guide: '找到 T–x–y 图上的最高点。', duration: 13000
      }
    ],
    mount: mount
  });
})();
