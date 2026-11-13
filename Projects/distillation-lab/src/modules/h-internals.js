/* Module H — column internals: tray hydraulics window, Murphree efficiency and packing HETP.
 * The operating window is a qualitative sketch; boundaries vary with design and physical properties. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, T = DL.thermo, plot = DL.plot;

  var DEFAULT = { type: 'sieve', vap: 70, liq: 45, E: 0.7, HETP: 0.5, spacing: 0.6 };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function bounds(type, liq) {
    if (type === 'packing') return { flood: 100 - 0.2 * liq, load: 80 - 0.2 * liq, weep: null, wet: 12, dc: null };
    return { flood: 100 - 0.1 * liq, load: 85 - 0.1 * liq, weep: (type === 'valve' ? 15 : 30) + 0.22 * liq, wet: null, dc: 88 };
  }
  function regime(type, vap, liq) {
    var b = bounds(type, liq);
    if (type === 'packing') {
      if (vap >= b.flood) return { key: 'flood', name: '液泛', f: 0.25, cls: 'bad', why: '气速过高，液体被托住无法下流，压降急升。' };
      if (liq < b.wet) return { key: 'dry', name: '润湿不足', f: 0.6, cls: 'warn', why: '液量太少，填料表面没有被液膜充分覆盖。' };
      if (vap >= b.load) return { key: 'load', name: '载点区', f: 0.95, cls: 'warn', why: '接近液泛：持液量上升、压降变大，留出余量。' };
      return { key: 'ok', name: '正常', f: 1, cls: 'ok', why: '液膜沿填料下流，蒸汽在空隙中上升，接触良好。' };
    }
    if (liq > b.dc) return { key: 'dc', name: '降液管液泛', f: 0.3, cls: 'bad', why: '液量过大，降液管来不及排液，液体倒灌上一层。' };
    if (vap >= b.flood) return { key: 'flood', name: '液泛', f: 0.25, cls: 'bad', why: '泡沫层充满板间，液体被大量带到上一层，分离失效。' };
    if (vap >= b.load) return { key: 'ent', name: '雾沫夹带', f: 1 - 0.3 * (vap - b.load) / (b.flood - b.load), cls: 'warn', why: '气速偏高，液滴被带到上一块板，降低效率。' };
    if (vap < b.weep * 0.6) return { key: 'dump', name: '严重漏液', f: 0.4, cls: 'bad', why: '气速太低，液体大量从孔中漏下，接触几乎失效。' };
    if (vap < b.weep) return { key: 'weep', name: '漏液', f: 0.75, cls: 'warn', why: '气速不足以托住液层，部分液体从孔中漏下。' };
    return { key: 'ok', name: '正常', f: 1, cls: 'ok', why: '蒸汽穿过液层形成泡沫，接触充分。' };
  }

  /* ------------------------- tray canvas ------------------------- */
  function trayCanvas(host) {
    var canvas = document.createElement('canvas'); host.appendChild(canvas);
    var ctx = canvas.getContext('2d'), W = 0, H = 0, dpr = 1, st = DEFAULT, rg = { key: 'ok' };
    var parts = [], raf = 0, visible = true, last = 0;
    function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
    var C = {};
    function colors() { ['--panel', '--panel-2', '--panel-3', '--line', '--muted', '--dim', '--text', '--cyan', '--orange', '--blue', '--red', '--yellow'].forEach(function (k) { C[k] = cssv(k); }); }
    colors();
    window.addEventListener('distl:theme', function () { colors(); draw(); });
    function resize() {
      var r = host.getBoundingClientRect(); W = Math.max(200, r.width); H = Math.max(220, r.height);
      dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
    }
    function geo() {
      var x0 = W * 0.12, x1 = W * 0.88, top = 34, bot = H - 14;
      var sp = (bot - top) / 3.1;
      return { x0: x0, x1: x1, top: top, bot: bot, sp: sp, trays: [top + sp * 0.95, top + sp * 1.95, top + sp * 2.95], dc: (x1 - x0) * 0.16 };
    }
    function spawn() {
      var g = geo(), p = { t: Math.random() };
      var v = st.vap / 100;
      if (st.type === 'packing') {
        p.kind = Math.random() < 0.55 ? 'film' : 'gas';
        p.x = g.x0 + 10 + Math.random() * (g.x1 - g.x0 - 20); p.y = g.top + Math.random() * (g.bot - g.top);
        return p;
      }
      var r = Math.random();
      var ti = Math.floor(Math.random() * 3), ty = g.trays[ti];
      var dcRight = ti % 2 === 0;
      var px0 = dcRight ? g.x0 + 4 : g.x0 + g.dc, px1 = dcRight ? g.x1 - g.dc : g.x1 - 4;
      p.x = px0 + 8 + Math.random() * (px1 - px0 - 16); p.ty = ty; p.ti = ti;
      if ((rg.key === 'weep' || rg.key === 'dump') && r < (rg.key === 'dump' ? 0.5 : 0.25)) { p.kind = 'weep'; p.y = ty; }
      else if ((rg.key === 'ent' || rg.key === 'flood') && r < (rg.key === 'flood' ? 0.45 : 0.3)) { p.kind = 'spray'; p.y = ty - 8; p.vx = (Math.random() - 0.5) * 30; p.vy = -(60 + 120 * v); }
      else { p.kind = 'bubble'; p.y = ty - 1; p.r = 1.5 + Math.random() * 2.5; p.vy = -(20 + 60 * v); }
      return p;
    }
    function seed() { parts = []; var n = st.type === 'packing' ? 70 : Math.round(40 + 90 * st.vap / 100); for (var i = 0; i < n; i++) parts.push(spawn()); }
    function froth(ti) {
      var base = 6 + 10 * st.liq / 100;
      var h = base + 26 * Math.pow(st.vap / 100, 1.6);
      if (rg.key === 'weep' || rg.key === 'dump') h = base * 0.7;
      if (rg.key === 'flood') h = geo().sp * 0.92;
      return Math.min(geo().sp * 0.95, h);
    }
    function draw() {
      if (!W) return;
      var g = geo();
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = C['--panel']; ctx.fillRect(0, 0, W, H);
      ctx.font = '600 12px "Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif'; ctx.fillStyle = C['--text']; ctx.textAlign = 'left';
      ctx.fillText(st.type === 'packing' ? '散堆填料段（示意）' : (st.type === 'valve' ? '浮阀塔板剖面（示意）' : '筛板剖面（示意）'), 12, 20);
      // shell
      ctx.strokeStyle = C['--muted']; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(g.x0, g.top - 10); ctx.lineTo(g.x0, g.bot); ctx.moveTo(g.x1, g.top - 10); ctx.lineTo(g.x1, g.bot); ctx.stroke();
      if (st.type === 'packing') { drawPacking(g); return; }
      g.trays.forEach(function (ty, ti) {
        var dcRight = ti % 2 === 0;
        var px0 = dcRight ? g.x0 : g.x0 + g.dc, px1 = dcRight ? g.x1 - g.dc : g.x1;
        var fh = froth(ti);
        // froth / liquid
        var grad = ctx.createLinearGradient(0, ty - fh, 0, ty);
        grad.addColorStop(0, hexA(C['--cyan'], rg.key === 'flood' ? 0.5 : 0.12));
        grad.addColorStop(1, hexA(C['--cyan'], 0.65));
        ctx.fillStyle = grad; ctx.fillRect(px0 + 2, ty - fh, px1 - px0 - 4, fh);
        // plate + holes / valves
        ctx.strokeStyle = C['--text']; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px0, ty); ctx.lineTo(px1, ty); ctx.stroke();
        ctx.strokeStyle = C['--panel']; ctx.lineWidth = 2;
        for (var hx = px0 + 14; hx < px1 - 10; hx += 16) {
          ctx.beginPath(); ctx.moveTo(hx - 2.5, ty); ctx.lineTo(hx + 2.5, ty); ctx.stroke();
          if (st.type === 'valve') {
            var lift = Math.min(6, 1 + 6 * st.vap / 100);
            ctx.fillStyle = C['--muted']; ctx.fillRect(hx - 5, ty - lift - 2, 10, 2);
          }
        }
        // weir & downcomer
        var wx = dcRight ? px1 : px0;
        ctx.strokeStyle = C['--text']; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(wx, ty - 8 - 6 * st.liq / 100); ctx.lineTo(wx, ty + g.sp * 0.82); ctx.stroke();
        var dcx0 = dcRight ? px1 : g.x0, dcx1 = dcRight ? g.x1 : px0;
        var back = 0.25 + 0.4 * st.liq / 100 + 0.25 * st.vap / 100;
        if (rg.key === 'dc' || rg.key === 'flood') back = 1;
        var dch = g.sp * 0.82 * Math.min(1, back);
        ctx.fillStyle = hexA(C['--cyan'], 0.5);
        ctx.fillRect(Math.min(dcx0, dcx1) + 2, ty + g.sp * 0.82 - dch, Math.abs(dcx1 - dcx0) - 4, dch);
        ctx.fillStyle = C['--text']; ctx.font = '10px ui-monospace,Menlo,monospace';
        ctx.textAlign = 'center';
        if (ti < 2) ctx.fillText('降液管', (dcx0 + dcx1) / 2, ty + g.sp * 0.5);
      });
      // particles
      parts.forEach(function (p) {
        if (p.kind === 'bubble') { ctx.fillStyle = hexA(C['--orange'], 0.75); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
        else if (p.kind === 'weep') { ctx.fillStyle = C['--blue']; ctx.beginPath(); ctx.ellipse(p.x, p.y, 1.8, 3, 0, 0, 6.283); ctx.fill(); }
        else if (p.kind === 'spray') { ctx.fillStyle = hexA(C['--cyan'], 0.9); ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 6.283); ctx.fill(); }
      });
      // labels
      ctx.textAlign = 'right'; ctx.font = '10px ui-monospace,Menlo,monospace'; ctx.fillStyle = C['--orange'];
      ctx.fillText('↑ 蒸汽 ' + st.vap.toFixed(0) + '% 液泛气速', W - 10, H - 4);
      ctx.textAlign = 'left'; ctx.fillStyle = C['--cyan'];
      ctx.fillText('↓ 液体负荷 ' + st.liq.toFixed(0) + '%', 10, H - 4);
    }
    function drawPacking(g) {
      ctx.strokeStyle = C['--line']; ctx.lineWidth = 1.2;
      var seedR = 7;
      for (var y = g.top; y < g.bot - 6; y += 14) for (var x = g.x0 + 10 + ((y / 14) % 2) * 7; x < g.x1 - 8; x += 15) {
        ctx.beginPath(); ctx.arc(x, y, seedR * 0.55, 0, 6.283); ctx.stroke();
      }
      parts.forEach(function (p) {
        if (p.kind === 'film') { ctx.fillStyle = hexA(C['--cyan'], st.liq < 12 ? 0.35 : 0.85); ctx.beginPath(); ctx.ellipse(p.x, p.y, 1.6, 3.2, 0, 0, 6.283); ctx.fill(); }
        else { ctx.fillStyle = hexA(C['--orange'], 0.6); ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 6.283); ctx.fill(); }
      });
      if (rg.key === 'flood') { ctx.fillStyle = hexA(C['--cyan'], 0.35); ctx.fillRect(g.x0 + 2, g.top, g.x1 - g.x0 - 4, (g.bot - g.top) * 0.45); }
      ctx.textAlign = 'right'; ctx.font = '10px ui-monospace,Menlo,monospace'; ctx.fillStyle = C['--orange'];
      ctx.fillText('↑ 蒸汽 ' + st.vap.toFixed(0) + '%', W - 10, H - 4);
      ctx.textAlign = 'left'; ctx.fillStyle = C['--cyan'];
      ctx.fillText('↓ 液膜 ' + st.liq.toFixed(0) + '%', 10, H - 4);
    }
    function hexA(hex, a) { hex = (hex || '#888888').replace('#', ''); var n = parseInt(hex, 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
    function step(dt) {
      var g = geo();
      parts.forEach(function (p, i) {
        if (p.kind === 'bubble') { p.y += p.vy * dt; if (p.y < p.ty - froth(p.ti)) parts[i] = spawn(); }
        else if (p.kind === 'weep') { p.y += 90 * dt; if (p.y > p.ty + g.sp * 0.9) parts[i] = spawn(); }
        else if (p.kind === 'spray') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 140 * dt; if (p.y > p.ty || p.y < g.top - 20) parts[i] = spawn(); }
        else if (p.kind === 'film') { p.y += (20 + 30 * st.liq / 100) * dt * (rg.key === 'flood' ? 0.2 : 1); if (p.y > g.bot) { p.y = g.top; } }
        else if (p.kind === 'gas') { p.y -= (30 + 60 * st.vap / 100) * dt; if (p.y < g.top) p.y = g.bot; }
      });
    }
    function loop(ts) { raf = 0; if (!visible || document.hidden || reduceMotion) return; var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts; step(dt); draw(); raf = requestAnimationFrame(loop); }
    function kick() { if (!raf && visible && !reduceMotion) { last = 0; raf = requestAnimationFrame(loop); } }
    var ro = new ResizeObserver(resize); ro.observe(host);
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) kick(); }) : null;
    if (io) io.observe(host);
    return {
      set: function (s, r) { var reseed = !parts.length || s.type !== st.type || r.key !== rg.key; st = s; rg = r; if (reseed) seed(); draw(); kick(); },
      destroy: function () { ro.disconnect(); if (io) io.disconnect(); if (raf) cancelAnimationFrame(raf); host.innerHTML = ''; }
    };
  }

  /* ------------------------- module ------------------------- */
  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage, panel = ctx.panel;
    var eq = T.makeEq('bt');
    var xF = 0.45, xD = 0.95, xW = 0.05, R = 1.5 * T.rmin(eq, xF, 1, xD).R;
    var theo = T.mccabe(eq, { xF: xF, q: 1, xD: xD, xW: xW, R: R });

    var row = ui.el('div', 'stage-row c2');
    var trayHost = ui.el('div', 'schem');
    var stack = ui.el('div', 'stage-stack');
    var h1 = ui.el('div'), h2 = ui.el('div');
    stack.appendChild(h1); stack.appendChild(h2);
    row.appendChild(trayHost); row.appendChild(stack);
    var cards = ui.el('div', 'cards');
    var note = ui.el('p', 'stage-note');
    stage.appendChild(row); stage.appendChild(cards); stage.appendChild(note);
    var tray = trayCanvas(trayHost);

    var win = plot.chart(h1, {
      label: '塔板操作区示意图', title: '操作区 <b>（定性示意）</b>',
      x: { min: 0, max: 100, label: '液相负荷 / %' }, y: { min: 0, max: 120, label: '气相负荷 / % 液泛' },
      pad: { b: 32, t: 24 },
      hover: function (x, y) { var r = regime(st.type, y, x); return { html: '液 ' + x.toFixed(0) + '% · 汽 ' + y.toFixed(0) + '%<br><b>' + r.name + '</b>' }; }
    });
    var mt = plot.chart(h2, {
      label: '考虑板效率的 McCabe–Thiele 图', title: 'Murphree 效率 <b id="hTitle"></b>',
      x: { min: 0, max: 1, label: '液相 x（苯）' }, y: { min: 0, max: 1, label: '气相 y' }, pad: { b: 32, t: 24 }
    });

    var cardRefs = {};
    ['reg', 'nt', 'na', 'h'].forEach(function (k) { var el = ui.el('div', 'card', '<span></span><b>—</b><small></small>'); cards.appendChild(el); cardRefs[k] = el; });
    function setCard(k, label, v, sub, tone) { var el = cardRefs[k]; el.querySelector('span').textContent = label; el.querySelector('b').textContent = v; el.querySelector('small').textContent = sub || ''; el.className = 'card' + (tone ? ' ' + tone : ''); }

    var gT = ui.section(panel, '内件类型', 'INTERNALS');
    var typeCtl = ui.seg({ options: [{ value: 'sieve', label: '筛板' }, { value: 'valve', label: '浮阀' }, { value: 'packing', label: '散堆填料' }], value: st.type, onChange: function (v) { st.type = v; sync(); } });
    gT.appendChild(typeCtl.el);
    var gL = ui.section(panel, '负荷', 'LOAD');
    var vapCtl = ui.slider({ label: '气相负荷（占液泛气速）', min: 5, max: 115, step: 1, value: st.vap, unit: '%', onInput: function (v) { st.vap = v; sync(); } });
    var liqCtl = ui.slider({ label: '液相负荷（相对）', min: 2, max: 100, step: 1, value: st.liq, unit: '%', onInput: function (v) { st.liq = v; sync(); } });
    gL.appendChild(vapCtl.el); gL.appendChild(liqCtl.el);
    var gE = ui.section(panel, '效率', 'EFFICIENCY');
    var ECtl = ui.slider({ label: '设计点 Murphree 效率 E_MV', min: 0.3, max: 1, step: 0.01, value: st.E, onInput: function (v) { st.E = v; sync(); } });
    var spCtl = ui.slider({ label: '板间距', min: 0.3, max: 0.9, step: 0.05, value: st.spacing, unit: 'm', onInput: function (v) { st.spacing = v; sync(); } });
    var hetpCtl = ui.slider({ label: '等板高度 HETP', min: 0.2, max: 1.2, step: 0.05, value: st.HETP, unit: 'm', onInput: function (v) { st.HETP = v; sync(); } });
    [ECtl, spCtl, hetpCtl].forEach(function (c) { gE.appendChild(c.el); });
    var gM = ui.section(panel, '读数', 'LIVE');
    var formula = ui.formula(''); gM.appendChild(formula);
    var warn = ui.warn(''); gM.appendChild(warn);
    var gR = ui.section(panel);
    gR.appendChild(ui.row([ui.reset(function () { Object.assign(st, DEFAULT); sync(); })]));
    gR.appendChild(ui.note('操作区边界与“效率随工况下降”的系数是示意值，用来表达方向；真实值需按塔板/填料厂商资料和水力学关联式核算。'));

    function sync() {
      typeCtl.set(st.type);
      [[vapCtl, st.vap], [liqCtl, st.liq], [ECtl, st.E], [spCtl, st.spacing], [hetpCtl, st.HETP]].forEach(function (p) { p[0].set(p[1], true); });
      var isPack = st.type === 'packing';
      ECtl.el.style.display = spCtl.el.style.display = isPack ? 'none' : '';
      hetpCtl.el.style.display = isPack ? '' : 'none';
      var rg = regime(st.type, st.vap, st.liq);
      tray.set(Object.assign({}, st), rg);

      win.draw(function (g) {
        g.grid().open();
        var fl = [], ld = [], wp = [];
        for (var l = 0; l <= 100; l += 2) { var b = bounds(st.type, l); fl.push([l, b.flood]); ld.push([l, b.load]); if (b.weep != null) wp.push([l, b.weep]); }
        g.path(fl.concat([[100, 120], [0, 120]]), { c: 'none', fill: 'var(--red)', fop: 0.12, closed: true, w: 0 });
        g.path(ld.concat(fl.slice().reverse()), { c: 'none', fill: 'var(--orange)', fop: 0.1, closed: true, w: 0 });
        if (wp.length) g.path(wp.concat([[100, 0], [0, 0]]), { c: 'none', fill: 'var(--blue)', fop: 0.12, closed: true, w: 0 });
        g.path(fl, { c: 'var(--red)', w: 1.8 }); g.path(ld, { c: 'var(--orange)', w: 1.2, dash: '4 3' });
        if (wp.length) g.path(wp, { c: 'var(--blue)', w: 1.8 });
        var b0 = bounds(st.type, 0);
        if (b0.dc) { g.rect(b0.dc, 0, 100, 120, { fill: 'var(--red)', fop: 0.1 }); g.vline(b0.dc, { c: 'var(--red)', w: 1.2, dash: '4 3' }); g.text(b0.dc, 60, '降液管液泛', { dx: 4, c: 'var(--red)', size: 9.5 }); }
        if (b0.wet) { g.rect(0, 0, b0.wet, 120, { fill: 'var(--blue)', fop: 0.12 }); g.text(b0.wet, 20, '润湿不足', { dx: 4, c: 'var(--blue)', size: 9.5 }); }
        g.text(4, 112, '液泛', { c: 'var(--red)', size: 10 });
        g.text(4, b0.load - 6, isPack ? '载点区' : '雾沫夹带', { c: 'var(--orange)', size: 10 });
        if (b0.weep != null) g.text(4, b0.weep * 0.45, '漏液', { c: 'var(--blue)', size: 10 });
        g.text(45, (b0.load + (b0.weep || 20)) / 2, '正常操作区', { anchor: 'middle', c: 'var(--cyan)', size: 10.5 });
        g.dot(st.liq, Math.min(119, st.vap), { c: 'var(--yellow)', r: 6 });
        g.close();
      });

      var Eeff = isPack ? 1 : Math.max(0.08, st.E * rg.f);
      var act = isPack ? theo : T.mccabe(eq, { xF: xF, q: 1, xD: xD, xW: xW, R: R, E: Eeff, maxStages: 200 });
      var ht = document.getElementById('hTitle');
      if (ht) ht.textContent = isPack ? '（填料：用 HETP 换算）' : 'E = ' + (Eeff * 100).toFixed(0) + '%';
      mt.draw(function (g) { plot.mccabe(g, eq, act, { labels: false }); });
      var Nt = theo.N, Na = act.N;
      setCard('reg', '工况', rg.name, rg.why, rg.cls === 'ok' ? 'hi' : rg.cls === 'bad' ? 'bad' : 'warm');
      setCard('nt', '理论级数', Nt.toFixed(2), '苯–甲苯 · 1.5 Rmin · 含再沸器', '');
      if (isPack) {
        var hetp = st.HETP / rg.f;
        var Hp = (Nt - 1) * hetp;
        setCard('na', '有效 HETP', hetp.toFixed(2) + ' m', rg.f < 1 ? '工况恶化使 HETP 变大' : '设计值', rg.f < 1 ? 'warm' : '');
        setCard('h', '填料层高度', Hp.toFixed(1) + ' m', '(N − 1) × HETP，再沸器另计', 'hi');
        formula.innerHTML = '填料层高度 Z = N<sub>塔内</sub> × HETP = ' + (Nt - 1).toFixed(2) + ' × ' + hetp.toFixed(2) + ' = <b>' + Hp.toFixed(1) + ' m</b>';
      } else {
        var Ntray = isFinite(Na) ? Math.ceil(Na - 1) : Infinity;
        var Hc = isFinite(Ntray) ? Ntray * st.spacing : Infinity;
        setCard('na', '实际塔板数', isFinite(Ntray) ? String(Ntray) : '∞', isFinite(Na) ? '全塔效率 ≈ ' + ((Nt - 1) / (Na - 1) * 100).toFixed(0) + '%' : '效率过低，无法完成分离', isFinite(Na) ? 'warm' : 'bad');
        setCard('h', '塔板段高度', isFinite(Hc) ? Hc.toFixed(1) + ' m' : '∞', '实际板数 × 板间距 ' + st.spacing.toFixed(2) + ' m', 'hi');
        formula.innerHTML = 'Murphree：E<sub>MV</sub> = (y<sub>n</sub> − y<sub>n+1</sub>)/(y*<sub>n</sub> − y<sub>n+1</sub>)<br>有效效率 = 设计 ' + (st.E * 100).toFixed(0) + '% × 工况系数 ' + rg.f.toFixed(2) + ' = <b>' + (Eeff * 100).toFixed(0) + '%</b><br>虚线 = 伪平衡线：台阶只走到它';
      }
      var w = [];
      if (rg.cls !== 'ok') w.push(rg.name + '：' + rg.why);
      warn.innerHTML = w.join('<br>'); warn.style.display = w.length ? '' : 'none';
      note.innerHTML = isPack
        ? '填料塔没有“一块一块”的板：用<b>等板高度 HETP</b>把理论级数换算成填料层高度。HETP 取决于填料类型与尺寸、液体分布和负荷；液泛或润湿不足时会显著变大。'
        : '真实塔板上气液接触有限，每块板只走到平衡的一部分：E<sub>MV</sub> = ' + (Eeff * 100).toFixed(0) + '% 时，' + Nt.toFixed(1) + ' 个理论级需要 <b>' + (isFinite(Na) ? Math.ceil(Na - 1) : '∞') + '</b> 块实际塔板（再沸器另计）。工况偏离操作区时效率下降，实际板数随之增加。';
    }
    function apply(p) { Object.assign(st, p || {}); sync(); }
    sync();
    return { apply: apply, destroy: function () { tray.destroy(); win.destroy(); mt.destroy(); } };
  }

  DL.registerModule({
    id: 'H', slug: 'internals', order: 8,
    title: '塔板、填料与效率', en: 'COLUMN INTERNALS',
    subtitle: '理论级怎样变成真实的塔高',
    hint: '拖动气、液负荷，观察左侧塔板状态与右上操作区中的黄点。',
    scenes: [
      {
        title: '筛板：蒸汽穿孔，液体横流',
        body: '蒸汽从筛孔向上穿过液层，形成翻腾的泡沫；液体沿板面横向流过，越过溢流堰进入<b>降液管</b>，流到下一块板。气液在泡沫层中接触传质。',
        patch: { type: 'sieve', vap: 70, liq: 45, E: 0.7 }, guide: '橙色是上升的蒸汽泡，青色是板上的液层。', duration: 12000
      },
      {
        title: '气速太低：漏液',
        body: '把气相负荷降到 28%：蒸汽托不住液层，液体从筛孔直接漏到下一块板（蓝色液滴），绕过了接触过程，效率下降。',
        patch: { vap: 28 }, guide: '黄点进入蓝色漏液区。', duration: 11000
      },
      {
        title: '气速太高：雾沫夹带与液泛',
        body: '把气相负荷提高到 92%：液滴被蒸汽带到上一块板，等于“返混”；继续增大到 105%，泡沫充满板间、降液管倒灌——<b>液泛</b>，分离彻底失效。',
        patch: { vap: 92 }, guide: '再把滑块拖过 100% 看看。', duration: 12000
      },
      {
        title: '浮阀：更宽的操作弹性',
        body: '浮阀随气量自动升降，低气速时阀片关小、减少漏液。同样 28% 的气相负荷，浮阀板仍在正常区——这就是“操作弹性”更大。',
        patch: { type: 'valve', vap: 28 }, guide: '比较筛板与浮阀的漏液边界。', duration: 12000
      },
      {
        title: '真实塔板不是理论级',
        body: 'Murphree 效率 E<sub>MV</sub> 描述一块板实际完成的组成变化占平衡变化的比例。伪平衡线（虚线）夹在平衡线与操作线之间，台阶只走到它：E = 60% 时，约 12 个理论级（含再沸器）需要约 19 块实际塔板。',
        patch: { type: 'sieve', vap: 70, liq: 45, E: 0.6 }, guide: '右下图的虚线就是伪平衡线。', duration: 13000
      },
      {
        title: '填料塔：用 HETP 换算高度',
        body: '散堆或规整填料让液体以液膜形式向下流，蒸汽在空隙中上升，接触连续发生。用<b>等板高度</b> HETP 把理论级换成填料层高度；填料塔压降小，适合减压精馏。',
        patch: { type: 'packing', vap: 65, liq: 40, HETP: 0.5 }, guide: '把液量降到很低，可以看到润湿不足。', duration: 12000
      }
    ],
    mount: mount
  });
})();
