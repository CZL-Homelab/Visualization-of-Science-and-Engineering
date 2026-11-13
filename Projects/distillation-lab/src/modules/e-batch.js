/* Module E — batch distillation: simple, constant reflux, constant distillate composition. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, T = DL.thermo, plot = DL.plot;

  var DEFAULT = { sys: 'bt', alpha: 2.5, x0: 0.5, N: 5, mode: 'constR', R: 3, xDset: 0.95, xWend: 0.08, prog: 0.5, V: 20, W0: 100, cut: 0.9 };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function stagesFor(eq, xD, R, N) {
    var out = [], y = xD;
    for (var n = 0; n < N; n++) {
      var x = eq.x(y);
      out.push({ n: n + 1, x: x, y: y, T: eq.hasT ? eq.T(x) : NaN });
      y = R / (R + 1) * x + xD / (R + 1);
    }
    return out;
  }

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage, panel = ctx.panel;
    var eq = null, sim = null, raf = 0;

    var row = ui.el('div', 'stage-row col-mt');
    var colHost = ui.el('div', 'column-host');
    colHost.style.cssText = 'border:1px solid var(--line-soft);border-radius:9px;background:var(--panel)';
    var stack = ui.el('div', 'stage-stack');
    var h1 = ui.el('div'), h2 = ui.el('div');
    stack.appendChild(h1); stack.appendChild(h2);
    row.appendChild(colHost); row.appendChild(stack);
    var note = ui.el('p', 'stage-note');
    stage.appendChild(row); stage.appendChild(note);

    var col = DL.column.create(colHost, { label: '间歇精馏釜与塔示意：釜液位、塔板组成与接收器中的分段馏出物', maxTrays: 14 });
    var c1 = plot.chart(h1, {
      label: '组成随时间', title: '组成 <b>随时间</b>', x: { min: 0, max: 10, label: '时间 / h' }, y: { min: 0, max: 1, label: '轻组分摩尔分数' },
      hover: function (t) { var p = at(t); return p ? { html: 't = ' + t.toFixed(2) + ' h<br>塔顶 xD = ' + p.xD.toFixed(3) + '<br>釜液 xW = ' + p.xW.toFixed(3) + '<br>累计平均 ' + p.xDavg.toFixed(3), vx: t } : null; }
    });
    var c2 = plot.chart(h2, {
      label: '回流比或累计馏出量随时间', title: '<b id="eTitle2">累计馏出量</b>', x: { min: 0, max: 10, label: '时间 / h' }, y: { min: 0, max: 100 },
      hover: function (t) { var p = at(t); return p ? { html: 't = ' + t.toFixed(2) + ' h<br>D = ' + p.D.toFixed(1) + ' kmol<br>R = ' + p.R.toFixed(2), vx: t } : null; }
    });
    function at(t) {
      if (!sim || !sim.pts.length) return null;
      var pts = sim.pts;
      for (var i = 1; i < pts.length; i++) if (pts[i].t >= t) {
        var a = pts[i - 1], b = pts[i], f = (t - a.t) / ((b.t - a.t) || 1);
        var o = {}; ['t', 'W', 'D', 'xW', 'xD', 'R', 'xDavg', 'T'].forEach(function (k) { o[k] = a[k] + f * (b[k] - a[k]); });
        return o;
      }
      return pts[pts.length - 1];
    }

    var gS = ui.section(panel, '体系与装料', 'CHARGE');
    var sysCtl = ui.seg({ options: DL.systemOptions({ custom: false }), value: st.sys, onChange: function (v) { st.sys = v; if (v === 'ew') Object.assign(st, { x0: 0.2, xDset: 0.8, xWend: 0.03 }); sync(); } });
    var alphaCtl = ui.slider({ label: '相对挥发度 α', min: 1.2, max: 5, step: 0.05, value: st.alpha, onInput: function (v) { st.alpha = v; sync(); } });
    var x0Ctl = ui.slider({ label: '初始釜液 x₀', min: 0.1, max: 0.9, step: 0.01, value: st.x0, onInput: function (v) { st.x0 = v; sync(); } });
    gS.appendChild(sysCtl.el); gS.appendChild(alphaCtl.el); gS.appendChild(x0Ctl.el);
    gS.appendChild(ui.note('装料 W₀ = 100 kmol，蒸发速率 V = 20 kmol/h；忽略塔内持液。'));
    var gO = ui.section(panel, '操作方式', 'MODE');
    var modeCtl = ui.seg({ options: [{ value: 'simple', label: '简单蒸馏' }, { value: 'constR', label: '恒回流' }, { value: 'constXD', label: '恒馏出组成' }], value: st.mode, onChange: function (v) { st.mode = v; sync(); } });
    var NCtl = ui.slider({ label: '理论级数（含釜）', min: 2, max: 15, step: 1, value: st.N, onInput: function (v) { st.N = v; sync(); } });
    var RCtl = ui.slider({ label: '回流比 R', min: 0.5, max: 12, step: 0.1, value: st.R, onInput: function (v) { st.R = v; sync(); } });
    var xDCtl = ui.slider({ label: '目标 xD', min: 0.7, max: 0.99, step: 0.005, value: st.xDset, onInput: function (v) { st.xDset = v; sync(); } });
    var xWCtl = ui.slider({ label: '停止时釜液 xW', min: 0.01, max: 0.4, step: 0.01, value: st.xWend, onInput: function (v) { st.xWend = v; sync(); } });
    [modeCtl, NCtl, RCtl, xDCtl, xWCtl].forEach(function (c) { gO.appendChild(c.el); });
    var gP = ui.section(panel, '批次进程', 'TIMELINE');
    var progCtl = ui.slider({ label: '进程', min: 0, max: 100, step: 1, value: st.prog * 100, unit: '%', onInput: function (v) { stopRun(); st.prog = v / 100; render(); } });
    var runBtn = ui.button('▶ 运行批次', function () { if (raf) stopRun(); else startRun(); }, 'sm');
    gP.appendChild(progCtl.el); gP.appendChild(ui.row([runBtn]));
    var gM = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 't', label: '时间 / 总时长' }, { key: 'D', label: '已馏出 D' },
      { key: 'xD', label: '此刻塔顶 xD' }, { key: 'avg', label: '累计平均 x̄D' },
      { key: 'xW', label: '釜液 xW / 釜温' }, { key: 'R', label: '此刻回流比 R' },
      { key: 'rec', label: '轻组分回收率（至此刻）', wide: true }
    ]);
    gM.appendChild(m.el);
    var formula = ui.formula(''); gM.appendChild(formula);
    var warn = ui.warn(''); gM.appendChild(warn);
    var gR = ui.section(panel);
    gR.appendChild(ui.row([ui.reset(function () { stopRun(); Object.assign(st, DEFAULT); sync(); })]));

    function startRun() {
      if (reduceMotion) { st.prog = 1; render(); return; }
      if (st.prog >= 0.999) st.prog = 0;
      runBtn.textContent = '❚❚ 暂停';
      var lastT = 0;
      function frame(ts) {
        var dt = lastT ? (ts - lastT) / 1000 : 0; lastT = ts;
        st.prog = Math.min(1, st.prog + dt / 9);
        render();
        if (st.prog < 1) raf = requestAnimationFrame(frame); else stopRun();
      }
      raf = requestAnimationFrame(frame);
    }
    function stopRun() { if (raf) cancelAnimationFrame(raf); raf = 0; runBtn.textContent = '▶ 运行批次'; }

    function sync() {
      eq = DL.eqFor(st.sys, 101.325, st.alpha);
      sysCtl.set(st.sys); modeCtl.set(st.mode);
      alphaCtl.el.style.display = st.sys === 'alpha' ? '' : 'none';
      NCtl.el.style.display = st.mode === 'simple' ? 'none' : '';
      RCtl.el.style.display = st.mode === 'constR' ? '' : 'none';
      xDCtl.el.style.display = st.mode === 'constXD' ? '' : 'none';
      if (eq.azeotrope && st.x0 > eq.azeotrope.x - 0.02) st.x0 = eq.azeotrope.x - 0.05;
      if (st.xWend >= st.x0) st.xWend = Math.max(0.01, st.x0 - 0.05);
      [[alphaCtl, st.alpha], [x0Ctl, st.x0], [NCtl, st.N], [RCtl, st.R], [xDCtl, st.xDset], [xWCtl, st.xWend]].forEach(function (p) { p[0].set(p[1], true); });
      var o = st.mode === 'simple'
        ? { x0: st.x0, W0: st.W0, N: 1, R: 0, V: st.V, mode: 'constR', xWend: st.xWend }
        : { x0: st.x0, W0: st.W0, N: st.N, R: st.R, V: st.V, mode: st.mode, xDset: st.xDset, xWend: st.xWend, Rmax: 40 };
      sim = T.batch(eq, o);
      render();
    }

    function renderInfeasible() {
      col.set({ mode: 'batch', stages: [], xW: st.x0, potLevel: 1, receiver: [], message: '目标 xD 在 R ≤ 40 时也达不到' });
      [c1, c2].forEach(function (c) { c.draw(function (g) { g.grid(); g.label(g.W / 2, g.H / 2, '无可行操作：增加级数或降低目标 xD', { anchor: 'middle', c: 'var(--red)', size: 12, sans: true }); }); });
      m.set({ t: '—', D: '0 kmol', xD: '—', avg: '—', xW: st.x0.toFixed(3), R: '> 40', rec: '0 %' });
      warn.innerHTML = '以 ' + st.N + ' 个理论级（含釜）、回流比上限 40，从 x₀ = ' + st.x0.toFixed(2) + ' 的釜液出发也得不到 xD = ' + st.xDset.toFixed(3) + '。'; warn.style.display = '';
      note.innerHTML = '<span class="warn-t">恒馏出组成操作无法开始：</span>塔的分离能力（级数 × 回流）不足以在第一刻就达到目标纯度。增加级数、降低目标 xD，或改用恒回流。';
    }
    function render() {
      progCtl.set(st.prog * 100, true);
      if (!sim.last) { renderInfeasible(); return; }
      var tEnd = sim.last.t || 1e-6;
      var t = st.prog * tEnd;
      var p = at(t) || sim.pts[0];
      var N = st.mode === 'simple' ? 1 : st.N;
      var stages = stagesFor(eq, p.xD, p.R, N);
      // receiver: up to 8 slices of collected distillate
      var cuts = [], slices = 8, pts = sim.pts;
      for (var k = 0; k < slices; k++) {
        var d0 = p.D * k / slices, d1 = p.D * (k + 1) / slices;
        if (d1 <= d0) continue;
        var xs = pts.filter(function (q) { return q.D >= d0 && q.D <= d1; });
        var xm = xs.length ? xs.reduce(function (s, q) { return s + q.xD; }, 0) / xs.length : p.xD;
        cuts.push({ amount: d1 - d0, x: xm });
      }
      col.set({
        mode: 'batch', stages: stages, xD: p.xD, xW: p.xW, R: st.mode === 'simple' ? null : p.R,
        potLevel: p.W / st.W0, receiver: cuts, receiverMax: Math.max(10, sim.last.D * 1.05),
        message: st.mode === 'simple' ? '简单蒸馏：没有塔板，釜内蒸汽直接进入冷凝器' : null
      });
      var xMax = Math.max(0.5, Math.ceil(tEnd * 1.05 * 2) / 2);
      c1.setAxes({ min: 0, max: xMax, label: '时间 / h' }, null);
      c1.draw(function (g) {
        g.grid().open();
        g.path(pts.map(function (q) { return [q.t, q.xD]; }), { c: 'var(--cyan)', w: 2.4 });
        g.path(pts.map(function (q) { return [q.t, q.xDavg]; }), { c: 'var(--cyan)', w: 1.4, dash: '5 3' });
        g.path(pts.map(function (q) { return [q.t, q.xW]; }), { c: 'var(--orange)', w: 2.4 });
        if (st.cut) { g.hline(st.cut, { c: 'var(--violet)', w: 1, dash: '2 3' }); g.text(xMax, st.cut, '主馏分要求 ' + st.cut, { dx: -4, dy: -5, anchor: 'end', c: 'var(--violet)', size: 9.5 }); }
        g.vline(t, { c: 'var(--text)', w: 1, dash: '2 3' });
        g.dot(t, p.xD, { c: 'var(--cyan)' }); g.dot(t, p.xW, { c: 'var(--orange)' });
        g.label(g.area.x0 + 8, g.area.y1 - 22, '青实线：塔顶 xD　青虚线：累计平均', { c: 'var(--muted)', size: 10, sans: true });
        g.label(g.area.x0 + 8, g.area.y1 - 8, '橙：釜液 xW', { c: 'var(--orange)', size: 10, sans: true });
        g.close();
      });
      var useR = st.mode === 'constXD';
      var tt = document.getElementById('eTitle2'); if (tt) tt.textContent = useR ? '回流比 R(t)：必须不断加大' : '累计馏出量 D(t)';
      var yMax = useR ? Math.max(5, Math.ceil(Math.max.apply(null, pts.map(function (q) { return q.R; })) * 1.1)) : st.W0;
      c2.setAxes({ min: 0, max: xMax, label: '时间 / h' }, { min: 0, max: yMax, label: useR ? '回流比 R' : '馏出量 D / kmol' });
      c2.draw(function (g) {
        g.grid().open();
        if (useR) g.path(pts.map(function (q) { return [q.t, q.R]; }), { c: 'var(--violet)', w: 2.4 });
        else {
          g.path(pts.map(function (q) { return [q.t, q.D]; }), { c: 'var(--cyan)', w: 2.4 });
          g.path(pts.map(function (q) { return [q.t, q.W]; }), { c: 'var(--orange)', w: 1.6, dash: '5 3' });
          g.label(g.area.x1 - 8, g.area.y0 + 14, '实线：馏出 D　虚线：釜内 W', { anchor: 'end', c: 'var(--muted)', size: 10, sans: true });
        }
        g.vline(t, { c: 'var(--text)', w: 1, dash: '2 3' });
        g.close();
      });
      var lightD = p.xDavg * p.D;
      m.set({
        t: t.toFixed(2) + ' / ' + tEnd.toFixed(2) + ' h', D: p.D.toFixed(1) + ' kmol',
        xD: p.xD.toFixed(3), avg: p.xDavg.toFixed(3),
        xW: p.xW.toFixed(3) + (isFinite(p.T) ? ' / ' + p.T.toFixed(1) + ' °C' : ''),
        R: st.mode === 'simple' ? '0（无回流）' : p.R.toFixed(2),
        rec: (lightD / (st.W0 * st.x0) * 100).toFixed(1) + ' %'
      }, { xD: 'hi', avg: 'hi' });
      formula.innerHTML = '釜内物料衡算（Rayleigh 型）：dW/W = dxW/(xD − xW)' +
        '<br>时间：dt = (R + 1)·dD / V' +
        (st.mode === 'constXD' ? '<br>恒 xD：D = W₀(x₀ − xW)/(xD − xW)，R 随 xW 下降而增大' : '<br>恒 R：每一时刻 xD 由“从 xD 沿操作线走 N 级正好到 xW”决定');
      var w = [];
      if (sim.stopReason === 'Rmax') w.push('回流比已达上限 40 仍无法保持 xD：剩余釜液 xW = ' + sim.last.xW.toFixed(3) + '，批次在此停止。');
      if (sim.stopReason === 'pinch') w.push('塔顶与釜液组成几乎相同，继续蒸馏已无分离作用。');
      warn.innerHTML = w.join('<br>'); warn.style.display = w.length ? '' : 'none';
      var final = sim.last;
      note.innerHTML = (st.mode === 'simple' ? '简单蒸馏' : st.mode === 'constR' ? '恒回流（R = ' + st.R.toFixed(1) + '）' : '恒馏出组成（xD = ' + st.xDset.toFixed(3) + '）') +
        '：批次共 <b>' + final.t.toFixed(2) + ' h</b>，馏出 <b>' + final.D.toFixed(1) + ' kmol</b>，平均组成 <b>' + final.xDavg.toFixed(3) + '</b>，轻组分回收 <b>' + (sim.recovery * 100).toFixed(1) + '%</b>。' +
        (st.mode === 'constR' ? '塔顶组成随釜液变贫而下降——前段可作主馏分，后段为过渡馏分。' : st.mode === 'constXD' ? '纯度稳定，但回流比与时间不断增加。' : '没有回流，馏出物从一开始就不纯，而且越来越差。');
    }

    function apply(p) { stopRun(); Object.assign(st, p || {}); sync(); }
    sync();
    return { apply: apply, destroy: function () { stopRun(); col.destroy(); c1.destroy(); c2.destroy(); } };
  }

  DL.registerModule({
    id: 'E', slug: 'batch', order: 5,
    title: '间歇精馏', en: 'BATCH DISTILLATION',
    subtitle: '釜液越蒸越贫：恒回流还是恒纯度',
    hint: '点“运行批次”或拖动进程滑块，看塔顶组成、釜液位和接收器随时间变化。',
    scenes: [
      {
        title: '一釜料，分批蒸',
        body: '间歇精馏把原料一次装进釜里，加热后蒸汽经塔上升、冷凝，一部分回流、一部分采出。与连续塔不同，<b>没有稳态</b>：釜里的轻组分越来越少，一切都随时间变化。',
        patch: { sys: 'bt', mode: 'constR', N: 5, R: 3, x0: 0.5, xWend: 0.08, prog: 0 }, guide: '注意釜液位和右侧时间轴的起点。', duration: 12000
      },
      {
        title: '简单蒸馏：没有回流',
        body: '没有塔、没有回流时就是简单蒸馏（模块 B 的 Rayleigh 过程）。最先蒸出的 xD 约 0.71，随后一路下降；蒸到釜液 xW = 0.08 时，整批馏出物的平均组成只有约 0.55。',
        patch: { mode: 'simple', prog: 1 }, guide: '青色实线一直在下降。', duration: 12000
      },
      {
        title: '恒回流：开头很纯，后面变差',
        body: '加上 5 个理论级、回流比 R = 3：开始时塔顶 xD ≈ 0.97。随着釜液变贫，同样的塔和回流已无力维持，xD 逐渐下滑，后段急剧下降。',
        patch: { mode: 'constR', N: 5, R: 3, prog: 0.55 }, guide: '拖动进程，观察 xD 与 xW 两条曲线。', duration: 13000
      },
      {
        title: '恒馏出组成：回流比要不断加大',
        body: '若要求 xD 始终为 0.95，就必须随釜液变贫而<b>逐步加大回流比</b>。右下图 R(t) 越来越陡，直到上限——剩下的轻组分已经无法以这个纯度蒸出。',
        patch: { mode: 'constXD', xDset: 0.95, prog: 1 }, guide: '看右下 R(t) 曲线末端的陡升。', duration: 13000
      },
      {
        title: '纯度的代价是时间',
        body: '回流越大，单位时间采出越少：dt = (R+1)dD/V。恒纯度操作的批次时间明显长于恒回流，能耗也随之增加。实际生产常把两种方式组合，或在后期改为过渡馏分。',
        patch: { mode: 'constXD', xDset: 0.95, prog: 0.6 }, guide: '比较读数里的“总时长”。', duration: 12000
      },
      {
        title: '切割：主馏分与过渡馏分',
        body: '回到恒回流：接收器里的颜色从青逐渐变橙。在 xD 低于产品要求（紫色虚线 0.90）前收集的是<b>主馏分</b>，之后切换到另一个接收器收集<b>过渡馏分</b>，回炼到下一批。',
        patch: { mode: 'constR', N: 5, R: 3, prog: 1 }, guide: '看接收器中由下到上的颜色变化。', duration: 13000
      },
      {
        title: '什么时候选间歇？',
        body: '处理量小、品种多、原料组成多变，或需要用同一套设备回收多种溶剂时，间歇精馏更灵活；大规模单一产品则选连续塔，能耗与人工都更低。',
        patch: { mode: 'constR', N: 8, R: 4, prog: 0.4 }, guide: '试着增加级数，看主馏分能延长多久。', duration: 11000
      }
    ],
    quiz: [
      {
        q: '恒回流间歇精馏中，随着时间推移塔顶组成 xD 会怎样？',
        options: ['保持不变', '逐渐上升', '逐渐下降', '先降后升'],
        answer: 2,
        explain: '釜液中的轻组分不断减少，同样的级数与回流比所能达到的塔顶组成随之<b>下降</b>。'
      },
      {
        q: '要在间歇精馏中保持 xD 恒定，操作上必须？',
        options: ['逐渐减小回流比', '逐渐加大回流比', '逐渐降低加热量', '减少理论级数'],
        answer: 1,
        explain: '釜液变贫后，只能靠<b>加大回流</b>让操作线更接近对角线，以维持同样的塔顶纯度；代价是采出变慢。'
      },
      {
        q: '蒸发速率 V = 20 kmol/h，回流比 R = 4，采出 10 kmol 馏出物至少需要多少时间？',
        options: ['0.5 h', '2.0 h', '2.5 h', '4.0 h'],
        answer: 2,
        explain: '采出速率 D = V/(R+1) = 20/5 = 4 kmol/h，10 kmol 需 <b>2.5 h</b>。'
      }
    ],
    mount: mount
  });
})();
