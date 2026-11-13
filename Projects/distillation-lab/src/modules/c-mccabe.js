/* Module C — continuous rectification: McCabe–Thiele with a live column. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, T = DL.thermo, plot = DL.plot;

  var DEFAULT = {
    sys: 'bt', alpha: 2.5, xF: 0.45, q: 1, xD: 0.95, xW: 0.05, rf: 1.5,
    feedMode: 'opt', feedStage: 4, view: 'all'
  };
  var Q_PRESETS = [
    { value: '1.2', label: '过冷液' }, { value: '1', label: '饱和液' }, { value: '0.5', label: '气液各半' },
    { value: '0', label: '饱和汽' }, { value: '-0.2', label: '过热汽' }
  ];

  function hvapOf(eq) {
    var s = eq.sys;
    if (s.light && s.heavy) return (T.COMPONENTS[s.light].hvap + T.COMPONENTS[s.heavy].hvap) / 2;
    return 32;
  }

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage, panel = ctx.panel;

    /* ---------------- stage ---------------- */
    var row = ui.el('div', 'stage-row col-mt');
    var colHost = ui.el('div', 'column-host');
    colHost.style.cssText = 'border:1px solid var(--line-soft);border-radius:9px;background:var(--panel)';
    var chartHost = ui.el('div');
    row.appendChild(colHost); row.appendChild(chartHost);
    var cards = ui.el('div', 'cards');
    var note = ui.el('p', 'stage-note');
    stage.appendChild(row); stage.appendChild(cards); stage.appendChild(note);

    var hl = null, last = null, eq = null;
    var col = DL.column.create(colHost, {
      label: '连续精馏塔示意：塔板液层颜色表示组成，悬停查看每一级',
      onHover: function (n) { hl = n; drawChart(); }
    });
    var chart = plot.chart(chartHost, {
      label: 'McCabe–Thiele 图解', square: true,
      title: 'x–y 图 <b id="mtTitle"></b>',
      x: { min: 0, max: 1, label: '液相 x（轻组分摩尔分数）' }, y: { min: 0, max: 1, label: '气相 y' },
      hover: function (x, y) {
        if (!last || !last.stages.length) return null;
        var best = null, bd = 1e9;
        last.stages.forEach(function (s) { var d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } });
        if (!best || bd > 0.08) { if (hl) { hl = null; col.highlight(null); } return { html: 'x = ' + x.toFixed(3) + '<br>y* = ' + eq.y(Math.max(0, Math.min(1, x))).toFixed(3), marks: [[x, eq.y(Math.max(0, Math.min(1, x))), 'var(--cyan)']] }; }
        if (hl !== best.n) { hl = best.n; col.highlight(best.n); }
        return {
          html: '<b>第 ' + best.n + ' 级</b>' + (best.n === last.feedStage ? ' · 进料' : '') + (best.n === last.stages.length && isFinite(last.N) ? ' · 再沸器' : '') +
            '<br>x = ' + best.x.toFixed(3) + '　y = ' + best.y.toFixed(3) + (isFinite(best.T) ? '<br>T = ' + best.T.toFixed(1) + ' °C' : '') +
            '<br>' + (best.section === 'R' ? '精馏段' : '提馏段'),
          marks: [[best.x, best.y, 'var(--yellow)']]
        };
      }
    });
    var cardRefs = {};
    [['N', '理论级数 N'], ['feed', '进料级'], ['rmin', '最小回流比 Rmin'], ['qr', '再沸器负荷']].forEach(function (c) {
      var el = ui.el('div', 'card', '<span>' + c[1] + '</span><b>—</b><small></small>');
      cards.appendChild(el); cardRefs[c[0]] = el;
    });
    function setCard(k, v, sub, tone) {
      var el = cardRefs[k];
      el.querySelector('b').textContent = v;
      el.querySelector('small').textContent = sub || '';
      el.className = 'card' + (tone ? ' ' + tone : '');
    }

    /* ---------------- panel ---------------- */
    var gSys = ui.section(panel, '体系', 'SYSTEM');
    var sysCtl = ui.seg({ options: DL.systemOptions(), value: st.sys, onChange: function (v) { st.sys = v; if (v === 'ew') Object.assign(st, { xF: 0.1, xD: 0.8, xW: 0.02 }); sync(); } });
    gSys.appendChild(sysCtl.el);
    var alphaCtl = ui.slider({ label: '相对挥发度 α', min: 1.1, max: 6, step: 0.05, value: st.alpha, onInput: function (v) { st.alpha = v; sync(); } });
    gSys.appendChild(alphaCtl.el);

    var gFeed = ui.section(panel, '进料', 'FEED');
    var xFCtl = ui.slider({ label: '进料组成 xF', min: 0.05, max: 0.9, step: 0.01, value: st.xF, onInput: function (v) { st.xF = v; sync(); } });
    var qCtl = ui.slider({ label: '进料热状态 q', min: -0.5, max: 1.5, step: 0.05, value: st.q, onInput: function (v) { st.q = v; sync(); } });
    var qSeg = ui.seg({ options: Q_PRESETS, value: '1', onChange: function (v) { st.q = Number(v); sync(); } });
    gFeed.appendChild(xFCtl.el); gFeed.appendChild(qCtl.el); gFeed.appendChild(qSeg.el);
    gFeed.appendChild(ui.note('q = 进料中液相的分率（更准确地说：使 1 mol 进料汽化所需热量 / 摩尔汽化潜热）。q &gt; 1 过冷液，q &lt; 0 过热汽。'));

    var gSpec = ui.section(panel, '产品规格', 'SPECS');
    var xDCtl = ui.slider({ label: '塔顶 xD', min: 0.6, max: 0.995, step: 0.005, value: st.xD, onInput: function (v) { st.xD = v; sync(); } });
    var xWCtl = ui.slider({ label: '塔底 xW', min: 0.005, max: 0.4, step: 0.005, value: st.xW, onInput: function (v) { st.xW = v; sync(); } });
    gSpec.appendChild(xDCtl.el); gSpec.appendChild(xWCtl.el);

    var gR = ui.section(panel, '回流', 'REFLUX');
    var rfCtl = ui.slider({ label: '回流比倍数 R / Rmin', min: 1.0, max: 5, step: 0.01, value: st.rf, onInput: function (v) { st.rf = v; sync(); } });
    gR.appendChild(rfCtl.el);
    var feedSeg = ui.seg({ label: '进料位置', options: [{ value: 'opt', label: '最优（跨越交点处）' }, { value: 'fix', label: '指定级' }], value: 'opt', onChange: function (v) { st.feedMode = v; sync(); } });
    var feedCtl = ui.slider({ label: '指定进料级', min: 1, max: 30, step: 1, value: st.feedStage, onInput: function (v) { st.feedStage = v; st.feedMode = 'fix'; sync(); } });
    gR.appendChild(feedSeg.el); gR.appendChild(feedCtl.el);

    var gM = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 'R', label: '回流比 R' }, { key: 'nmin', label: '最少级数 Nmin（全回流）' },
      { key: 'DF', label: 'D / F' }, { key: 'VF', label: 'V / F（精馏段汽量）' },
      { key: 'VbF', label: "V′ / F（提馏段汽量）" }, { key: 'Tt', label: '塔顶 / 塔底温度' }
    ]);
    gM.appendChild(m.el);
    var formula = ui.formula('');
    gM.appendChild(formula);
    var warn = ui.warn('');
    gM.appendChild(warn);
    var gReset = ui.section(panel);
    gReset.appendChild(ui.row([ui.reset(function () { Object.assign(st, DEFAULT); sync(); })]));
    gReset.appendChild(ui.note('假设：恒摩尔流、全凝器（回流为饱和液）、再沸器为一个平衡级、各级均为理论级。'));

    /* ---------------- compute + render ---------------- */
    function drawChart() {
      if (!eq) return;
      chart.draw(function (g) {
        plot.mccabe(g, eq, last, {
          highlight: hl,
          showSteps: st.view !== 'lines',
          showQ: true
        });
      });
    }

    function sync() {
      eq = DL.eqFor(st.sys, 101.325, st.alpha);
      alphaCtl.el.style.display = st.sys === 'alpha' ? '' : 'none';
      sysCtl.set(st.sys);
      [[alphaCtl, st.alpha], [xFCtl, st.xF], [qCtl, st.q], [xDCtl, st.xD], [xWCtl, st.xW], [rfCtl, st.rf], [feedCtl, st.feedStage]].forEach(function (p) { p[0].set(p[1], true); });
      qSeg.set(String(st.q));
      feedSeg.set(st.feedMode);
      feedCtl.el.style.display = st.feedMode === 'fix' ? '' : 'none';

      var ok = st.xD > st.xF + 0.01 && st.xF > st.xW + 0.01;
      var rm = ok ? T.rmin(eq, st.xF, st.q, st.xD) : { R: NaN };
      var R = st.rf * rm.R;
      var res;
      if (!ok) {
        res = { stages: [], infeasible: true, reason: '需要 xD > xF > xW', xF: st.xF, xD: st.xD, xW: st.xW, q: st.q };
      } else if (!isFinite(rm.R)) {
        res = { stages: [], infeasible: true, reason: 'xD 超过恒沸组成：任何回流比都达不到', xF: st.xF, xD: st.xD, xW: st.xW, q: st.q };
      } else {
        res = T.mccabe(eq, { xF: st.xF, q: st.q, xD: st.xD, xW: st.xW, R: R, feedStage: st.feedMode === 'fix' ? st.feedStage : null, maxStages: 150 });
      }
      last = res;
      var nm = ok ? T.nmin(eq, st.xD, st.xW).N : NaN;
      var lam = hvapOf(eq);
      var Fk = 100; // kmol/h
      var qr = res.Vb != null ? res.Vb * Fk * lam * 1000 / 3600 : NaN;

      // column
      col.set(Object.assign({}, res, {
        stages: res.pinched ? [] : res.stages,
        message: res.infeasible ? res.reason : (res.pinched ? '夹紧：操作线碰到平衡线，需要无穷多级' : null),
        xD: st.xD, xW: st.xW, xF: st.xF, q: st.q, R: R
      }));
      drawChart();
      var t = document.getElementById('mtTitle');
      if (t) t.textContent = res.pinched || res.infeasible ? '· 不可行 / 夹紧' : '· N = ' + res.N.toFixed(2) + ' 级';

      // cards
      if (res.infeasible) {
        setCard('N', '—', res.reason, 'bad'); setCard('feed', '—', ''); setCard('rmin', isFinite(rm.R) ? rm.R.toFixed(3) : '∞', '', isFinite(rm.R) ? '' : 'bad'); setCard('qr', '—', '');
      } else {
        setCard('N', res.pinched ? '∞' : res.N.toFixed(2), res.pinched ? '夹紧点' : '含再沸器 · 塔内 ' + (res.N - 1).toFixed(2) + ' 块理论板', res.pinched ? 'bad' : 'hi');
        setCard('feed', res.pinched ? '—' : '第 ' + res.feedStage + ' 级', st.feedMode === 'opt' ? '最优位置' : '人为指定', st.feedMode === 'opt' ? '' : 'warm');
        setCard('rmin', rm.R.toFixed(3), (rm.tangent ? '切点夹紧' : '进料处夹紧') + ' · R = ' + R.toFixed(3));
        setCard('qr', isFinite(qr) ? ui.fmt.num(qr, 0) + ' kW' : '—', 'F = 100 kmol/h · λ ≈ ' + lam.toFixed(1) + ' kJ/mol', 'warm');
      }
      var top = res.stages && res.stages[0], bot = res.stages && res.stages[res.stages.length - 1];
      m.set({
        R: isFinite(R) ? R.toFixed(3) : '—',
        nmin: isFinite(nm) ? nm.toFixed(2) + ' 级' : '∞',
        DF: res.D != null ? res.D.toFixed(3) : '—',
        VF: res.V != null ? res.V.toFixed(3) : '—',
        VbF: res.Vb != null ? res.Vb.toFixed(3) : '—',
        Tt: eq.hasT && top && bot && !res.pinched ? top.T.toFixed(1) + ' / ' + bot.T.toFixed(1) + ' °C' : '—'
      }, { R: 'hi' });
      formula.innerHTML = '精馏段：y = <b>' + (isFinite(R) ? (R / (R + 1)).toFixed(3) : '—') + '</b>·x + ' + (isFinite(R) ? (st.xD / (R + 1)).toFixed(3) : '—') +
        '<br>q 线：y = q/(q−1)·x − xF/(q−1)' + (Math.abs(st.q - 1) < 1e-9 ? '（q = 1 时为竖线 x = xF）' : '') +
        '<br>D/F = (xF − xW)/(xD − xW) = <b>' + (ok ? ((st.xF - st.xW) / (st.xD - st.xW)).toFixed(3) : '—') + '</b>';
      var w = [];
      if (!ok) w.push('规格不自洽：必须 xD > xF > xW。');
      if (eq.azeotrope && st.xD > eq.azeotrope.x - 0.002) w.push('xD 已越过恒沸组成 ' + eq.azeotrope.x.toFixed(3) + '：平衡线在此与对角线相交，普通精馏不可能达到（见模块 F）。');
      if (res.pinched && ok && isFinite(rm.R)) w.push(st.feedMode === 'fix' ? '指定的进料级让台阶卡在操作线与平衡线之间：换一个进料级或加大回流。' : '回流比太接近 Rmin，台阶在夹紧点附近无限变小。');
      if (st.q < 0 && res.Vb != null && res.Vb < 0.05 && !res.infeasible) w.push('过热蒸汽进料使提馏段上升汽量很小，再沸器几乎不起作用。');
      warn.innerHTML = w.join('<br>');
      warn.style.display = w.length ? '' : 'none';

      if (res.infeasible) note.innerHTML = '<span class="warn-t">' + res.reason + '。</span>';
      else if (res.pinched) note.innerHTML = '回流比 R = <b>' + R.toFixed(3) + '</b> 时操作线与平衡线之间的空间在夹紧点处闭合：台阶越画越小，<b>理论级数趋于无穷</b>。这就是“最小回流比”的含义。';
      else note.innerHTML = '在 R = <b>' + R.toFixed(2) + '</b>（' + st.rf.toFixed(2) + ' × Rmin）下，从塔顶 xD = ' + st.xD.toFixed(3) + ' 画到塔底 xW = ' + st.xW.toFixed(3) +
        ' 需要 <b>' + res.N.toFixed(2) + '</b> 个理论级，第 <b>' + res.feedStage + '</b> 级进料。全回流时最少需 ' + (isFinite(nm) ? nm.toFixed(2) : '∞') + ' 级；回流越接近 Rmin，级数越多。';
    }

    function apply(patch) {
      Object.assign(st, patch || {});
      if (patch && patch.sys === 'custom' && !DL.data.custom) st.sys = 'bt';
      sync();
    }
    sync();
    return { apply: apply, destroy: function () { col.destroy(); chart.destroy(); } };
  }

  DL.registerModule({
    id: 'C', slug: 'mccabe', order: 3,
    title: '连续精馏：McCabe–Thiele', en: 'CONTINUOUS COLUMN',
    subtitle: '回流、进料热状态、理论级与最小回流比',
    hint: '悬停塔板或台阶：左右两边同一级会同时高亮。',
    scenes: [
      {
        title: '一座塔 = 一摞平衡级',
        body: '上升的蒸汽与下降的液体在每块塔板上接触。若接触充分，离开塔板的气液达到平衡——这就是<b>理论级</b>。塔顶冷凝液一部分作为<b>回流</b>送回，塔底<b>再沸器</b>产生上升蒸汽。<br>左图的液层颜色：橙色偏重组分，青色偏轻组分。',
        patch: { sys: 'bt', xF: 0.45, q: 1, xD: 0.95, xW: 0.05, rf: 1.5, feedMode: 'opt', view: 'all' },
        guide: '把鼠标放在左侧任一塔板上，右图对应的台阶会高亮。', duration: 13000
      },
      {
        title: '操作线：物料衡算画出的直线',
        body: '在恒摩尔流假设下，相邻两级之间的 y 与 x 满足一条直线：精馏段 <code>y = R/(R+1)·x + xD/(R+1)</code>（紫线），提馏段过 (xW, xW)（橙线）。它们只来自<b>物料衡算</b>，与相平衡无关。',
        patch: { view: 'lines' },
        guide: '只看三条直线：紫色精馏段、橙色提馏段、黄色 q 线。', duration: 12000
      },
      {
        title: 'q 线：进料的热状态',
        body: '进料是冷液、饱和液还是蒸汽，决定了它进塔后有多少变成下降液体。<b>q 线</b>从 (xF, xF) 出发，斜率 q/(q−1)；两条操作线必交于 q 线上。改成气液各半（q = 0.5），交点左移。',
        patch: { view: 'lines', q: 0.5 },
        guide: '比较 q = 1 时的竖直 q 线与 q = 0.5 时的斜线。', duration: 12000
      },
      {
        title: '在平衡线与操作线之间画台阶',
        body: '从 (xD, xD) 出发：水平走到平衡线 = 一个理论级的平衡；竖直落到操作线 = 物料衡算连接下一级。跨过交点后换用提馏段操作线。台阶数就是理论级数（含再沸器）。',
        patch: { view: 'all', q: 1 },
        guide: '数一数台阶，与左侧塔板数对应。', duration: 13000
      },
      {
        title: '加大回流：台阶变大，级数变少',
        body: '回流比提高到 <b>3 × Rmin</b>：精馏段操作线更靠近对角线，台阶变“高”，所需理论级明显减少——代价是塔顶冷凝与塔底再沸的热负荷都按 (R+1) 增加。',
        patch: { rf: 3 },
        guide: '注意右下角“再沸器负荷”卡片随 R 上升。', duration: 12000
      },
      {
        title: '逼近最小回流：夹紧点',
        body: '把 R 降到 <b>1.03 × Rmin</b>：操作线交点几乎贴上平衡线，交点附近的台阶越画越小，级数陡增。R = Rmin 时需要无穷多级；再低就完全做不到。',
        patch: { rf: 1.03 },
        guide: '看交点附近密集的台阶。', duration: 13000
      },
      {
        title: '全回流：最少理论级数',
        body: '另一个极限是<b>全回流</b>（R → ∞，没有产品采出）：操作线与对角线重合，所需级数最少，称为 Nmin。设计时常用 R ≈ 1.1–1.5 Rmin，在两个极限之间取舍（模块 D）。',
        patch: { rf: 5 },
        guide: '读数里的 Nmin 是台阶贴着对角线走出的级数。', duration: 12000
      },
      {
        title: '进料位置不对，要多付板数',
        body: '最优进料级是台阶跨越操作线交点的那一级。若强行在第 2 级进料，提馏段操作线过早启用，台阶变矮，总级数增加；若过低，台阶会卡在精馏段线与平衡线之间。',
        patch: { rf: 1.5, feedMode: 'fix', feedStage: 2 },
        guide: '拖动“指定进料级”，观察 N 的变化。', duration: 13000
      },
      {
        title: '乙醇–水：越不过的恒沸点',
        body: '换成乙醇–水，进料 xF = 0.10。平衡线在 x ≈ 0.897 处与对角线相交（红点，文献 0.894）。把 xD 定为 0.80 还能做到（1.5 Rmin 下约 14 级），但台阶在塔顶附近挤成一团；xD 越接近恒沸点，所需级数越多，越过它就不可能。',
        patch: { sys: 'ew', xF: 0.1, xD: 0.8, xW: 0.02, rf: 1.5, feedMode: 'opt' },
        guide: '把“塔顶 xD”滑到 0.89 以上看看会发生什么。', duration: 14000
      }
    ],
    mount: mount
  });
})();
