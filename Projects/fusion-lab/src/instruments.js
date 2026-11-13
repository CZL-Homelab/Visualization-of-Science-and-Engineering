/* Fusion Lab — side-panel instruments.
 *
 * Each instrument is a function (mount, app, params) that builds DOM into the
 * panel and returns { dispose?, tick?, refresh? }. All numbers come from
 * core.js / reference.js; nothing is computed twice. Charts are plain 2D
 * canvas and re-read the CSS palette on every draw so both themes work.
 */
(function () {
  'use strict';
  var FL = globalThis.FL = globalThis.FL || {};
  var core = FL.core, ref = FL.ref;

  /* ---------- tiny DOM kit ---------- */
  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function fmt(v, d) {
    if (!isFinite(v)) return '∞';
    var a = Math.abs(v);
    if (d == null) d = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
    return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function sci(v, d) {
    if (!isFinite(v) || v === 0) return String(v);
    var e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e);
    var sup = String(e).replace(/-/g, '⁻').replace(/\d/g, function (c) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]; });
    return m.toFixed(d == null ? 1 : d) + '×10' + sup;
  }
  /* cards: [[label, value, sub?, tone?], ...] */
  function cards(mount, list, cols) {
    var g = h('div', 'stat-grid' + (cols === 1 ? ' one' : cols === 3 ? ' three' : ''));
    var els = list.map(function (c) {
      var card = h('div', 'stat' + (c[3] ? ' tone-' + c[3] : ''));
      card.appendChild(h('span', 'stat-k', c[0]));
      var v = h('b', 'stat-v', c[1]); card.appendChild(v);
      var s = h('small', 'stat-s', c[2] || ''); card.appendChild(s);
      g.appendChild(card);
      return { v: v, s: s, card: card };
    });
    mount.appendChild(g);
    return els;
  }
  var uid = 0;
  /* slider({ label, min, max, step, value, unit, log, show }) -> { input, set, value } */
  function slider(mount, o, onInput) {
    var id = 'fl-s' + (++uid), wrap = h('label', 'ctl');
    wrap.setAttribute('for', id);
    var top = h('span', 'ctl-top'), name = h('span', 'ctl-name', o.label), out = h('output', 'ctl-val');
    top.appendChild(name); top.appendChild(out);
    var input = h('input');
    input.type = 'range'; input.id = id;
    var toPos = function (v) { return o.log ? Math.log(v / o.min) / Math.log(o.max / o.min) * 1000 : v; };
    var fromPos = function (p) { return o.log ? o.min * Math.pow(o.max / o.min, p / 1000) : p; };
    input.min = o.log ? 0 : o.min; input.max = o.log ? 1000 : o.max; input.step = o.log ? 1 : (o.step || 1);
    var show = function (v) { out.textContent = (o.show ? o.show(v) : fmt(v)) + (o.unit ? ' ' + o.unit : ''); input.setAttribute('aria-valuetext', out.textContent); };
    input.value = toPos(o.value); show(o.value);
    input.addEventListener('input', function () { var v = fromPos(+input.value); show(v); onInput(v, true); });
    wrap.appendChild(top); wrap.appendChild(input);
    mount.appendChild(wrap);
    return { input: input, value: function () { return fromPos(+input.value); }, set: function (v) { input.value = toPos(v); show(v); } };
  }
  /* segmented control: options [[value, label], ...] */
  function seg(mount, label, options, value, onChange) {
    var wrap = h('div', 'seg'), btns = [];
    wrap.setAttribute('role', 'group'); wrap.setAttribute('aria-label', label);
    options.forEach(function (o) {
      var b = h('button', '', o[1]);
      b.type = 'button'; b.dataset.v = o[0];
      b.setAttribute('aria-pressed', String(o[0] === value));
      b.addEventListener('click', function () { api.set(o[0]); onChange(o[0], true); });
      wrap.appendChild(b); btns.push(b);
    });
    var api = { set: function (v) { btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === String(v))); }); } };
    mount.appendChild(wrap);
    return api;
  }
  function note(mount, html, cls) { var n = h('p', 'inst-note' + (cls ? ' ' + cls : ''), html); mount.appendChild(n); return n; }
  function title(mount, text, tag) { var t = h('div', 'inst-title'); t.appendChild(h('span', '', text)); if (tag) t.appendChild(h('em', '', tag)); mount.appendChild(t); return t; }

  /* ---------- canvas charts ---------- */
  function palette() {
    var cs = getComputedStyle(document.documentElement), g = function (n) { return cs.getPropertyValue(n).trim(); };
    return {
      text: g('--text'), muted: g('--muted'), dim: g('--dim'), line: g('--line'), grid: g('--grid'), panel: g('--panel-2'),
      plasma: g('--plasma'), d: g('--c-d'), t: g('--c-t'), he: g('--c-he'), n: g('--c-n'), heat: g('--c-heat'), field: g('--c-field'),
      power: g('--c-power'), ok: g('--ok'), warn: g('--warn'), bad: g('--bad'), accent: g('--accent')
    };
  }
  function Chart(mount, height, draw, label) {
    var self = this;
    this.canvas = h('canvas', 'chart');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', label || '图表');
    this.height = height; this.drawFn = draw;
    var box = h('div', 'chart-box'); box.style.height = height + 'px'; box.appendChild(this.canvas);
    mount.appendChild(box);
    this.box = box;
    this._ro = globalThis.ResizeObserver ? new ResizeObserver(function () { self.draw(); }) : null;
    if (this._ro) this._ro.observe(box);
    this._theme = function () { self.draw(); };
    globalThis.addEventListener('fl:theme', this._theme);
    this.draw();
  }
  Chart.prototype.draw = function () {
    var w = this.box.clientWidth, hh = this.height, dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    if (w < 10) return;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(hh * dpr)) {
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(hh * dpr);
      this.canvas.style.width = w + 'px'; this.canvas.style.height = hh + 'px';
    }
    var ctx = this.canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    this.drawFn(ctx, w, hh, palette());
  };
  Chart.prototype.dispose = function () {
    if (this._ro) this._ro.disconnect();
    globalThis.removeEventListener('fl:theme', this._theme);
  };
  /* axes: returns { X, Y, box } and draws grid + tick labels */
  function axes(ctx, w, hh, P, o) {
    var box = { l: o.left == null ? 44 : o.left, r: w - (o.right == null ? 10 : o.right), t: o.top == null ? 10 : o.top, b: hh - (o.bottom == null ? 26 : o.bottom) };
    var map = function (a, lo, hi) {
      return a.log ? function (v) { return lo + (hi - lo) * Math.log(v / a.min) / Math.log(a.max / a.min); }
        : function (v) { return lo + (hi - lo) * (v - a.min) / (a.max - a.min); };
    };
    var X = map(o.x, box.l, box.r), Y = map(o.y, box.b, box.t);
    ctx.lineWidth = 1; ctx.strokeStyle = P.grid; ctx.fillStyle = P.muted;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    (o.x.ticks || []).forEach(function (v) {
      var x = Math.round(X(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, box.t); ctx.lineTo(x, box.b); ctx.stroke();
      ctx.fillText(o.x.fmt ? o.x.fmt(v) : String(v), x, box.b + 5);
    });
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    (o.y.ticks || []).forEach(function (v) {
      var y = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(box.l, y); ctx.lineTo(box.r, y); ctx.stroke();
      ctx.fillText(o.y.fmt ? o.y.fmt(v) : String(v), box.l - 6, y);
    });
    ctx.strokeStyle = P.line; ctx.strokeRect(box.l + 0.5, box.t + 0.5, box.r - box.l, box.b - box.t);
    ctx.fillStyle = P.dim; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    if (o.x.label) ctx.fillText(o.x.label, box.r, hh - 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    if (o.y.label) ctx.fillText(o.y.label, box.l + 5, box.t + 4);
    return { X: X, Y: Y, box: box };
  }
  function path(ctx, pts, color, width, dash) {
    ctx.save(); ctx.beginPath();
    pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
    ctx.strokeStyle = color; ctx.lineWidth = width || 2; ctx.lineJoin = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.stroke(); ctx.restore();
  }
  function dot(ctx, x, y, color, r) {
    ctx.beginPath(); ctx.arc(x, y, r || 4.5, 0, 6.2832); ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke();
  }
  function tag(ctx, text, x, y, color, align) {
    ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y);
  }
  var sup = function (e) { return '10' + String(e).replace(/-/g, '⁻').replace(/\d/g, function (c) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]; }); };
  /* horizontal bars: rows [[label, value, color, text], ...] */
  function bars(mount, rows, o) {
    o = o || {};
    var wrap = h('div', 'bars');
    var max = o.max || Math.max.apply(null, rows.map(function (r) { return r[1]; }));
    var els = rows.map(function (r) {
      var row = h('div', 'bar-row');
      row.appendChild(h('span', 'bar-k', r[0]));
      var track = h('div', 'bar-track'), fill = h('i');
      var frac = o.log ? Math.log(r[1] / o.min) / Math.log(max / o.min) : r[1] / max;
      fill.style.width = Math.max(1.5, Math.min(100, frac * 100)) + '%'; fill.style.background = 'var(' + r[2] + ')';
      track.appendChild(fill); row.appendChild(track);
      var v = h('b', 'bar-v', r[3] == null ? fmt(r[1]) : r[3]); row.appendChild(v);
      wrap.appendChild(row);
      return { fill: fill, v: v };
    });
    mount.appendChild(wrap);
    return { els: els, set: function (i, value, text) { var f = value / max; els[i].fill.style.width = Math.max(0, Math.min(100, f * 100)) + '%'; els[i].v.textContent = text; } };
  }

  var I = {};
  var DT = core.DT;

  /* ============ A · reaction ============ */
  I.massEnergy = function (m) {
    var before = core.MASS.D + core.MASS.T, after = core.MASS.He4 + core.MASS.n, perGram = core.dtEnergyPerGram();
    title(m, '质量亏损', 'AME2020 原子质量');
    cards(m, [
      ['反应前 D + T', before.toFixed(6) + ' u'], ['反应后 ⁴He + n', after.toFixed(6) + ' u'],
      ['少掉的质量', (before - after).toFixed(6) + ' u', '占 ' + (DT.massFraction * 100).toFixed(3) + '%', 'plasma'],
      ['变成的能量', DT.total.toFixed(2) + ' MeV', '× 931.494 MeV/u', 'plasma']
    ]);
    var strip = h('div', 'mass-strip');
    strip.innerHTML = '<i style="flex:' + (1 - DT.massFraction) + '"></i><b style="flex:' + DT.massFraction + '"></b>';
    m.appendChild(strip);
    note(m, '上面这条按真实比例画：右端那条细线就是变成能量的 0.38%。');
    title(m, '换算到日常尺度');
    cards(m, [
      ['1 克氘氚混合燃料', fmt(perGram / 3.6e9, 1) + ' MWh', '≈ ' + fmt(perGram / 41.868e9, 1) + ' 吨标准油'],
      ['单次反应 vs 烧一个碳原子', '≈ ' + fmt(DT.total * 1e6 / 4.1 / 1e6, 1) + ' 百万倍', 'C + O₂ 约 4.1 eV']
    ]);
  };

  function reactivityChart(m, kinds, getT, height) {
    var colors = { DT: 'plasma', DD: 'd', DHe3: 'he' }, names = { DT: 'D-T', DD: 'D-D', DHe3: 'D-³He' };
    return new Chart(m, height || 190, function (ctx, w, hh, P) {
      var a = axes(ctx, w, hh, P, {
        x: { min: 1, max: 100, log: true, ticks: [1, 2, 5, 10, 20, 50, 100], label: '离子温度 keV' },
        y: { min: 1e-27, max: 2e-21, log: true, ticks: [1e-26, 1e-24, 1e-22], fmt: function (v) { return sup(Math.round(Math.log10(v))); }, label: '⟨σv⟩ m³/s' }
      });
      kinds.forEach(function (k) {
        var pts = [];
        for (var i = 0; i <= 80; i++) { var T = Math.pow(100, i / 80), v = core.reactivity(k, T); if (v > 1e-27) pts.push([a.X(T), a.Y(v)]); }
        path(ctx, pts, P[colors[k]], k === 'DT' ? 2.4 : 1.8);
        var end = pts[pts.length - 1];
        tag(ctx, names[k], end[0] - 4, end[1] + (k === 'DT' ? -9 : 10), P[colors[k]], 'right');
      });
      var T0 = getT(), x = a.X(T0);
      ctx.strokeStyle = P.muted; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, a.box.t); ctx.lineTo(x, a.box.b); ctx.stroke(); ctx.setLineDash([]);
      kinds.forEach(function (k) { var v = core.reactivity(k, T0); if (v > 1e-27) dot(ctx, x, a.Y(v), P[colors[k]], k === 'DT' ? 5 : 3.5); });
    }, '热核反应率随温度变化的曲线');
  }

  I.barrier = function (m, app) {
    var T = 6, chart, c;
    title(m, '调温度，看隧穿', 'Bosch–Hale 1992');
    var apply = function (user) {
      var sv = core.reactivity('DT', T);
      c[0].v.textContent = fmt(core.keVToKelvin(T) / 1e8, 2) + ' 亿 K'; c[0].s.textContent = fmt(T, 1) + ' keV';
      c[1].v.textContent = sci(sv) + ' m³/s'; c[1].s.textContent = '是 10 keV 时的 ' + fmt(sv / core.reactivity('DT', 10), sv / core.reactivity('DT', 10) < 0.01 ? 4 : 2) + ' 倍';
      /* the cartoon's success rate is compressed so that something visible still happens at low T */
      var chance = Math.min(1, Math.pow(sv / core.reactivity('DT', 20), 0.4));
      c[2].v.textContent = chance > 0.95 ? '几乎每次' : chance < 0.08 ? '极少' : '约每 ' + Math.round(1 / chance) + ' 次成功 1 次';
      app.micro.setPlay('fuse', { fuseChance: chance, hot: Math.log(T) / Math.log(100) });
      if (chart) chart.draw();
      if (user) app.takeover();
    };
    slider(m, { label: '燃料温度', min: 1, max: 100, value: T, log: true, unit: 'keV', show: function (v) { return fmt(v, v < 10 ? 1 : 0); } }, function (v, user) { T = v; apply(user); });
    c = cards(m, [['温度', ''], ['D-T 反应率', ''], ['动画里的成功比例', '', '示意：远高于真实比例', 'warn']], 1);
    chart = reactivityChart(m, ['DT'], function () { return T; }, 170);
    note(m, '真实等离子体里，绝大多数碰撞只是互相散射。一个氘核平均要飞行很久、碰撞很多次才会发生一次聚变——所以必须把它们长时间关住。');
    apply(false);
    return { dispose: function () { chart.dispose(); } };
  };

  I.fuels = function (m, app) {
    var T = 15, chart, c;
    title(m, '三种燃料的反应率', 'Bosch–Hale 1992');
    chart = reactivityChart(m, ['DT', 'DD', 'DHe3'], function () { return T; }, 210);
    var apply = function (user) {
      var dt = core.reactivity('DT', T), dd = core.reactivity('DD', T), dh = core.reactivity('DHe3', T);
      c[0].v.textContent = '× ' + fmt(dt / dd, 0); c[1].v.textContent = '× ' + fmt(dt / dh, dt / dh > 100 ? 0 : 1);
      chart.draw(); if (user) app.takeover();
    };
    slider(m, { label: '比较温度', min: 2, max: 100, value: T, log: true, unit: 'keV', show: function (v) { return fmt(v, v < 10 ? 1 : 0); } }, function (v, user) { T = v; apply(user); });
    c = cards(m, [['D-T 比 D-D 快', '', '同温度、同密度', 'plasma'], ['D-T 比 D-³He 快', '', '同温度、同密度', 'plasma']]);
    cards(m, [
      ['D-D', '燃料最易得', '但要 5 亿度以上，仍产生中子'],
      ['D-³He', '几乎无中子', '³He 地球上极稀缺，需约 10 亿度']
    ]);
    apply(false);
    return { dispose: function () { chart.dispose(); } };
  };

  I.split = function (m) {
    var vn = core.speed(DT.neutron * 1000, core.MASS.n), va = core.speed(DT.alpha * 1000, core.MASS.He4);
    title(m, '动量守恒决定分配', '非相对论两体');
    var strip = h('div', 'split-strip');
    strip.innerHTML = '<div class="s-he" style="flex:' + DT.alpha + '"><b>α ' + DT.alpha.toFixed(2) + ' MeV</b><span>' + (DT.alpha / DT.total * 100).toFixed(1) + '%</span></div>' +
      '<div class="s-n" style="flex:' + DT.neutron + '"><b>中子 ' + DT.neutron.toFixed(2) + ' MeV</b><span>' + (DT.neutron / DT.total * 100).toFixed(1) + '%</span></div>';
    m.appendChild(strip);
    cards(m, [
      ['中子速度', sci(vn) + ' m/s', '光速的 ' + (vn / 2.998e8 * 100).toFixed(0) + '%', 'n'],
      ['α 粒子速度', sci(va) + ' m/s', '质量是中子的 ' + (core.MASS.He4 / core.MASS.n).toFixed(2) + ' 倍', 'he'],
      ['速度比', (vn / va).toFixed(2) + ' : 1', '= 质量的反比'], ['能量比', (DT.neutron / DT.alpha).toFixed(2) + ' : 1', '½mv² 再乘一次速度比']
    ]);
    note(m, '<b>α 粒子</b>带 2 个正电荷，在 5.3 T 磁场里回旋半径约 ' + fmt(core.gyroRadius(DT.alpha * 1000, core.MASS.He4, 2, 5.3) * 100, 1) + ' cm，远小于 2 m 的等离子体半径，所以被留住。<b>中子</b>不带电，磁场对它无效。');
  };

  I.lawson = function (m, app) {
    var s = { n: 1.0, T: 10, tau: 3.0 }, FUEL = 0.86, ZEFF = 1.7, VOL = ref.ITER.plasmaVolume, chart, c, sl = {};
    title(m, '0 维能量平衡', '教学模型');
    var presets = [['iter', 'ITER 设计点', { n: 1.0, T: 10, tau: 3.0 }], ['today', '现有大装置量级', { n: 0.4, T: 6, tau: 0.6 }], ['ign', '点火', { n: 1.2, T: 15, tau: 5.5 }]];
    var sg = seg(m, '预设', presets.map(function (p) { return [p[0], p[1]]; }), 'iter', function (v) {
      var p = presets.filter(function (x) { return x[0] === v; })[0][2];
      s.n = p.n; s.T = p.T; s.tau = p.tau; sl.n.set(s.n); sl.T.set(s.T); sl.tau.set(s.tau); apply('preset');
    });
    var apply = function (user) {
      var r = core.powerBalance({ n: s.n * 1e20, T: s.T, tau: s.tau, fuel: FUEL, zeff: ZEFF, volume: VOL });
      c[0].v.textContent = r.ignited ? '∞ 点火' : 'Q = ' + fmt(r.Q, r.Q < 10 ? 2 : 1);
      c[0].card.className = 'stat tone-' + (r.ignited || r.Q >= 10 ? 'ok' : r.Q >= 1 ? 'warn' : 'bad');
      c[0].s.textContent = r.ignited ? '不需要外部加热' : r.Q >= 10 ? '达到 ITER 目标' : r.Q >= 1 ? '超过得失相当' : '聚变功率小于加热功率';
      c[1].v.textContent = sci(r.triple) + ''; c[1].s.textContent = 'keV·s/m³';
      c[2].v.textContent = fmt(r.pFus / 1e6, 0) + ' MW'; c[2].s.textContent = '按 ITER 体积 ' + VOL + ' m³';
      c[3].v.textContent = r.ignited ? '0 MW' : fmt(r.pAux / 1e6, 0) + ' MW'; c[3].s.textContent = 'α 自加热占 ' + fmt(r.alphaFraction * 100, 0) + '%';
      app.effects.set({ heat: Math.min(1, s.T / 14), alphas: Math.min(1, r.alphaFraction * 1.2), plasma: 0.6 + 0.4 * Math.min(1, s.n) });
      chart.draw();
      if (user) { app.takeover(); if (user !== 'preset') sg.set(''); }
    };
    sl.n = slider(m, { label: '密度 n', min: 0.2, max: 2, step: 0.02, value: s.n, unit: '×10²⁰ m⁻³', show: function (v) { return v.toFixed(2); } }, function (v, u) { s.n = v; apply(u); });
    sl.T = slider(m, { label: '温度 T', min: 2, max: 40, step: 0.5, value: s.T, unit: 'keV', show: function (v) { return v.toFixed(1); } }, function (v, u) { s.T = v; apply(u); });
    sl.tau = slider(m, { label: '能量约束时间 τ', min: 0.1, max: 10, value: s.tau, log: true, unit: 's', show: function (v) { return v.toFixed(2); } }, function (v, u) { s.tau = v; apply(u); });
    c = cards(m, [['等离子体增益', ''], ['三重积 n·T·τ', ''], ['聚变功率', ''], ['所需外部加热', '']]);
    chart = new Chart(m, 190, function (ctx, w, hh, P) {
      var a = axes(ctx, w, hh, P, {
        x: { min: 2, max: 60, log: true, ticks: [2, 5, 10, 20, 50], label: 'T keV' },
        y: { min: 1e19, max: 1e23, log: true, ticks: [1e19, 1e20, 1e21, 1e22, 1e23], fmt: function (v) { return sup(Math.round(Math.log10(v))); }, label: 'n·T·τ' }
      });
      [[Infinity, P.ok, '点火'], [10, P.plasma, 'Q = 10'], [1, P.warn, 'Q = 1']].forEach(function (q) {
        var pts = [];
        for (var i = 0; i <= 60; i++) { var T = 2 * Math.pow(30, i / 60), v = isFinite(q[0]) ? core.tripleForQ(T, q[0]) : core.ignitionTriple(T); if (v < 1e23) pts.push([a.X(T), a.Y(v)]); }
        path(ctx, pts, q[1], 1.8, isFinite(q[0]) ? [5, 3] : null);
        var mid = pts[Math.floor(pts.length * 0.86)];
        tag(ctx, q[2], mid[0] - 2, mid[1] - 9, q[1], 'right');
      });
      var y = Math.max(1e19, Math.min(1e23, s.n * 1e20 * s.T * s.tau));
      dot(ctx, a.X(Math.max(2, Math.min(60, s.T))), a.Y(y), P.text, 5.5);
    }, '三重积与点火曲线');
    note(m, '假设：平剖面、离子与电子同温、燃料纯度 86%（其余为氦灰与杂质）、Z<sub>eff</sub> = 1.7，损失 = 热传导 + 轫致辐射。三条参考线是不计辐射的纯燃料理想值，所以白点的 Q 会略低于它所在位置的理想线。');
    apply(false);
    return { dispose: function () { chart.dispose(); } };
  };

  /* ============ B · confinement ============ */
  I.gyro = function (m, app) {
    var B = 5.3, sp = 'D', c;
    var species = { D: { m: core.MASS.D, z: 1, e: 10, name: '氘核 · 10 keV' }, e: { m: 5.48579909e-4, z: 1, e: 10, name: '电子 · 10 keV' }, a: { m: core.MASS.He4, z: 2, e: DT.alpha * 1000, name: 'α 粒子 · 3.5 MeV' } };
    title(m, '回旋半径', 'r = mv / qB');
    seg(m, '粒子', [['D', '氘核'], ['e', '电子'], ['a', 'α 粒子']], sp, function (v, u) { sp = v; apply(u); });
    var apply = function (user) {
      var s = species[sp], r = core.gyroRadius(s.e, s.m, s.z, B), f = core.gyroFrequency(s.m, s.z, B);
      c[0].v.textContent = r >= 0.01 ? fmt(r * 100, 1) + ' cm' : r >= 1e-4 ? fmt(r * 1000, 2) + ' mm' : fmt(r * 1e6, 0) + ' µm';
      c[0].s.textContent = s.name;
      c[1].v.textContent = f > 1e9 ? fmt(f / 1e9, 0) + ' GHz' : fmt(f / 1e6, 1) + ' MHz'; c[1].s.textContent = '每秒绕圈次数';
      c[2].v.textContent = '1 : ' + fmt(ref.ITER.a / r, 0); c[2].s.textContent = '回旋半径 : 等离子体小半径';
      app.effects.partMat.uniforms.uGyro.value = Math.max(0.35, Math.min(3.2, 5.3 / B));
      if (user) app.takeover();
    };
    slider(m, { label: '磁场强度 B', min: 1, max: 13, step: 0.1, value: B, unit: 'T', show: function (v) { return v.toFixed(1); } }, function (v, u) { B = v; apply(u); });
    c = cards(m, [['回旋半径', ''], ['回旋频率', ''], ['尺度对比', '']], 1);
    note(m, '磁场越强，圈越小。ITER 的离子回旋、电子回旋加热频率，正是为了与这两个回旋频率共振而选的。');
    apply(false);
    return { dispose: function () { app.effects.partMat.uniforms.uGyro.value = 1; } };
  };

  I.fieldMode = function (m, app) {
    var mode = app.scene.toroidalOnly ? 'tor' : 'hel', c;
    var vd = core.toroidalDrift(15, 1, ref.ITER.Bt, ref.ITER.R0);
    title(m, '切换磁场位形');
    seg(m, '磁场位形', [['tor', '只有环向场'], ['hel', '环向 + 极向']], mode, function (v, u) { mode = v; apply(u); });
    var apply = function (user) {
      var tor = mode === 'tor';
      app.effects.setQ(3, tor);
      app.effects.set({ drift: tor ? 1 : 0, poloidal: tor ? 0 : 1, current: tor ? 0 : 1, plasma: tor ? 0.18 : 0.32 });
      c[0].v.textContent = tor ? '闭合的圆' : '螺旋，铺满磁面';
      c[1].v.textContent = tor ? '约 ' + fmt(vd, 0) + ' m/s，方向恒定' : '被螺旋运动平均掉';
      c[1].s.textContent = tor ? '离子向上、电子向下' : '半圈向外漂，半圈漂回来';
      c[2].v.textContent = tor ? '约 ' + fmt(ref.ITER.a / vd * 1000, 0) + ' ms 量级' : '秒量级（ITER 约 3–4 s）';
      c[2].card.className = 'stat tone-' + (tor ? 'bad' : 'ok');
      if (user) app.takeover();
    };
    c = cards(m, [['磁力线形状', ''], ['垂直漂移', '', ''], ['粒子能待多久', '', '', 'bad']], 1);
    note(m, '漂移速度按 v ≈ 2T / (qBR) 估算，取 T = 10 keV、B = 5.3 T、R = 6.2 m。电荷分离后的 E×B 外抛比这还快，所以“几毫秒”是上限。');
    apply(false);
  };

  I.safety = function (m, app) {
    /* shape factor fixed so that ITER's design point reads its published q95 = 3 */
    var I0 = ref.ITER, base = core.edgeSafetyFactor({ a: I0.a, R: I0.R0, B: I0.Bt, IpMA: I0.Ip, kappa: 1.7 }), K = 3 / base;
    var s = { ip: 15, b: 5.3 }, c, pending = 0;
    title(m, '安全因子', '估算 · 按 ITER 设计点标定');
    var apply = function (user) {
      var q = core.edgeSafetyFactor({ a: I0.a, R: I0.R0, B: s.b, IpMA: s.ip, kappa: 1.7 }) * K;
      c[0].v.textContent = 'q₉₅ ≈ ' + q.toFixed(2);
      c[0].card.className = 'stat tone-' + (q < 2 ? 'bad' : q < 2.6 ? 'warn' : 'ok');
      c[0].s.textContent = q < 2 ? '外扭曲模不稳定：破裂' : q < 2.6 ? '离极限很近，破裂风险高' : q > 5 ? '很稳，但电流小、约束差' : '运行区间';
      c[1].v.textContent = fmt(core.poloidalFieldEdge(s.ip, I0.a), 2) + ' T'; c[1].s.textContent = '环向场 ' + s.b.toFixed(1) + ' T';
      c[2].v.textContent = fmt(core.greenwaldDensity(s.ip, I0.a), 2) + ' ×10²⁰ m⁻³'; c[2].s.textContent = '电流越大，可承载密度越高';
      clearTimeout(pending);
      pending = setTimeout(function () { app.effects.setQ(Math.max(1.05, Math.min(9, q)), false); }, user ? 60 : 0);
      if (user) app.takeover();
    };
    slider(m, { label: '等离子体电流 Ip', min: 5, max: 24, step: 0.5, value: s.ip, unit: 'MA', show: function (v) { return v.toFixed(1); } }, function (v, u) { s.ip = v; apply(u); });
    slider(m, { label: '环向场 B', min: 3, max: 7, step: 0.1, value: s.b, unit: 'T', show: function (v) { return v.toFixed(1); } }, function (v, u) { s.b = v; apply(u); });
    c = cards(m, [['边界安全因子', ''], ['边界极向场', ''], ['密度极限（Greenwald）', '']], 1);
    note(m, 'q 按圆柱近似加拉长修正计算，再乘一个固定形状因子，使 15 MA / 5.3 T 时等于 ITER 公布的 q₉₅ = 3。趋势可信，绝对值只是估算。');
    apply(false);
    return { dispose: function () { clearTimeout(pending); } };
  };

  I.stellarator = function (m, app) {
    var S = ref.W7X, st = app.stell, s = { iota: st.iota, coils: st.coilMode }, c, pending = 0;
    title(m, '旋转变换 ι', '示意 · 非 W7-X 实测位形');
    var apply = function (user) {
      c[0].v.textContent = 'ι = ' + s.iota.toFixed(2);
      c[0].s.textContent = '磁力线绕大环 1 圈，绕小截面 ' + s.iota.toFixed(2) + ' 圈';
      c[1].v.textContent = 'q = 1/ι ≈ ' + (1 / s.iota).toFixed(2);
      clearTimeout(pending);
      pending = setTimeout(function () { st.setIota(s.iota); }, user ? 60 : 0);
      if (user) app.takeover();
    };
    slider(m, { label: '旋转变换 ι', min: 0.7, max: 1.3, step: 0.01, value: s.iota, show: function (v) { return v.toFixed(2); } }, function (v, u) { s.iota = v; apply(u); });
    c = cards(m, [['磁力线的扭转', '', ''], ['换算成安全因子', '', '托卡马克 ITER：q₉₅ ≈ 3，即 ι ≈ 0.33'], ['扭转来自', '线圈的三维形状', '等离子体里不需要大电流', 'ok']], 1);
    title(m, '线圈显示');
    seg(m, '线圈显示', [['cut', '剖开'], ['all', '全部'], ['none', '隐藏']], s.coils, function (v, u) { s.coils = v; st.setCoils(v); if (u) app.takeover(); });
    title(m, '托卡马克与仿星器');
    var t = h('div', 'cmp');
    t.innerHTML = '<div><span></span><b>托卡马克</b><b>仿星器</b></div>' +
      '<div><span>谁来拧磁力线</span><i>等离子体电流（ITER 15 MA）</i><i>外部线圈的三维形状</i></div>' +
      '<div><span>中心螺线管</span><i>需要，感应驱动电流</i><i>不需要</i></div>' +
      '<div><span>运行方式</span><i>感应驱动时是脉冲</i><i>原理上可以稳态</i></div>' +
      '<div><span>大破裂</span><i>电流失稳时会发生</i><i>没有大电流，基本避免</i></div>' +
      '<div><span>几何</span><i>轴对称，线圈是平面的</i><i>三维，线圈非平面</i></div>' +
      '<div><span>难点</span><i>电流驱动与破裂防护</i><i>线圈制造精度、三维场里的粒子约束</i></div>';
    m.appendChild(t);
    title(m, 'Wendelstein 7-X', '德国 · 格赖夫斯瓦尔德');
    cards(m, [['线圈', S.nonPlanar + ' + ' + S.planar, '非平面 + 平面，均为超导'], ['模块', S.modules + ' 个', '每个模块的线圈形状重复'],
      ['大半径 / 小半径', S.R0 + ' m / ' + S.a + ' m', '等离子体体积 ' + S.volume + ' m³'], ['磁场', S.B + ' T', '']]);
    note(m, '<b>已做到：</b>' + S.record + '。');
    note(m, '<b>图上是示意几何。</b>磁面按“旋转椭圆”画出，线圈只表现“非平面”这一特征，不是 W7-X 的真实磁面与线圈；小半径放大约 ' + FL.stellarator.DRAWN_MINOR_SCALE.toFixed(1) + ' 倍。滑块的 ι 范围是示意值，真实装置靠调节各组线圈的电流来改变 ι。');
    apply(false);
    return { dispose: function () { clearTimeout(pending); } };
  };

  I.shape = function (m, app) {
    var sh = app.tokamak.shape, vol = core.plasmaVolume(sh);
    title(m, '截面形状', '模型用 Miller 参数化');
    var chart = new Chart(m, 230, function (ctx, w, hh, P) {
      var s = Math.min((w - 20) / 7.4, (hh - 16) / 10.4), ox = w / 2 - 6.0 * s, oy = hh / 2 - 0.35 * s;
      var X = function (R) { return ox + R * s; }, Y = function (Z) { return oy - Z * s; };
      var poly = function (pts, stroke, fill, width) {
        ctx.beginPath(); pts.forEach(function (p, i) { if (i) ctx.lineTo(X(p[0]), Y(p[1])); else ctx.moveTo(X(p[0]), Y(p[1])); });
        ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = stroke; ctx.lineWidth = width || 1.5; ctx.stroke();
      };
      poly(app.tokamak.profiles.vesselOuter, P.line, P.panel, 1.5);
      poly(app.tokamak.profiles.firstWall, P.muted, null, 1.5);
      [1, 0.75, 0.5, 0.25].forEach(function (rho, i) {
        var pts = [];
        for (var k = 0; k < 90; k++) { var p = core.miller(sh, rho, k / 90 * 6.2832); pts.push([p.R, p.Z]); }
        ctx.globalAlpha = i === 0 ? 1 : 0.5; poly(pts, P.plasma, i === 0 ? 'rgba(232,90,200,.1)' : null, i === 0 ? 2.2 : 1); ctx.globalAlpha = 1;
      });
      var xp = app.tokamak.xPoint, so = app.tokamak.strike.outer, si = app.tokamak.strike.inner;
      ctx.strokeStyle = P.heat; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(X(so[0]), Y(so[1])); ctx.lineTo(X(xp[0]), Y(xp[1])); ctx.lineTo(X(si[0]), Y(si[1])); ctx.stroke();
      dot(ctx, X(xp[0]), Y(xp[1]), P.plasma, 3.5);
      tag(ctx, 'X 点', X(xp[0]) + 8, Y(xp[1]) - 2, P.text);
      tag(ctx, '第一壁', X(8.5), Y(3.4), P.muted); tag(ctx, '闭合磁面', X(sh.R0) - 16, Y(sh.Z0), P.plasma);
      ctx.strokeStyle = P.dim; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(sh.R0), Y(4.6)); ctx.lineTo(X(sh.R0), Y(-3.4)); ctx.stroke(); ctx.setLineDash([]);
    }, '等离子体截面示意');
    cards(m, [
      ['拉长比 κ', sh.kappa.toFixed(2), '高 / 宽'], ['三角形变 δ', sh.delta.toFixed(2), 'D 形的“尖”程度'],
      ['模型体积', fmt(vol, 0) + ' m³', 'ITER 公布值约 ' + ref.ITER.plasmaVolume + ' m³'], ['大半径 / 小半径', sh.R0 + ' / ' + sh.a + ' m', '环径比 ' + (sh.R0 / sh.a).toFixed(1)]
    ]);
    note(m, '模型的闭合磁面用光滑的 Miller 形状近似，真实分界面在 X 点处是尖的；偏滤器腿用两条直线示意。');
    return { dispose: function () { chart.dispose(); } };
  };

  /* ============ C · anatomy ============ */
  I.anatomy = function (m, app, p) {
    var parts = ref.ITER.parts, ids = ['cs', 'tf', 'pf', 'vessel', 'blanket', 'divertor', 'cryostat'], btn = {}, info, ex, cutSeg;
    title(m, '零件', '点击模型或下面的名字');
    var list = h('div', 'part-list');
    ids.forEach(function (id) {
      var b = h('button', 'part-chip', '<i></i>' + parts[id].name);
      b.type = 'button'; b.dataset.part = id;
      b.addEventListener('click', function () { app.selectPart(app.part === id ? null : id, true); });
      list.appendChild(b); btn[id] = b;
    });
    m.appendChild(list);
    info = h('div', 'part-info'); m.appendChild(info);
    title(m, '拆解与剖切');
    ex = slider(m, { label: '爆炸图', min: 0, max: 100, step: 1, value: Math.round(app.tokamak.explodeGoal * 100), unit: '%', show: function (v) { return v.toFixed(0); } }, function (v) { app.tokamak.setExplode(v / 100); app.takeover(); if (v > 5) app.engine.flyTo({ t: [0, 1.5, 0], az: app.engine.view.az * 57.2958, pol: 62, d: 54 + v * 0.42 }, 0.8); });
    cutSeg = seg(m, '剖切方式', [['closed', '合上'], ['onion', '洋葱剖'], ['wide', '大开'], ['half', '半剖']], app.tokamak.cut, function (v) { app.tokamak.setCut(v); app.takeover(); });
    var refresh = function () {
      ids.forEach(function (id) { btn[id].setAttribute('aria-pressed', String(app.part === id)); });
      var d = parts[app.part];
      if (!d) { info.innerHTML = '<p class="part-empty">选一个零件查看它的作用与关键数字。从里到外依次是：等离子体 → 包层 / 偏滤器 → 真空室 → 磁体 → 恒温器。</p>'; return; }
      info.innerHTML = '<h4>' + d.name + '<small>' + d.en + '</small></h4><p>' + d.lead + '</p><dl>' +
        d.facts.map(function (f) { return '<div><dt>' + f[0] + '</dt><dd>' + f[1] + '</dd></div>'; }).join('') + '</dl><p class="why">' + d.why + '</p>';
    };
    app.part = p.part || null;
    refresh();
    return { refresh: function () { refresh(); ex.set(Math.round(app.tokamak.explodeGoal * 100)); cutSeg.set(app.tokamak.cut); } };
  };

  /* ============ D · pulse ============ */
  I.pulse = function (m, app) {
    var range = FL.content.PULSE_RANGE, chart, c, sl, phase;
    title(m, '放电时间轴', '示意 · ITER 15 MA 感应方案量级');
    phase = h('div', 'phase-chip'); m.appendChild(phase);
    chart = new Chart(m, 210, function (ctx, w, hh, P) {
      var a = axes(ctx, w, hh, P, {
        x: { min: range[0], max: range[1], ticks: [0, 130, 300, 520, 750], label: '时间 s' },
        y: { min: -1.1, max: 1.15, ticks: [-1, 0, 1], fmt: function (v) { return v === 0 ? '0' : v > 0 ? '满' : '−满'; } }, left: 34
      });
      var series = [['cs', P.t, 1.6, [4, 3]], ['ip', P.power, 2.2], ['pAux', P.field, 1.8], ['pFus', P.plasma, 2.6]], norm = { cs: 1, ip: 15, pAux: 50 / 0.32, pFus: 500 / 0.92 };
      series.forEach(function (sr) {
        var pts = [];
        for (var i = 0; i <= 200; i++) { var t = range[0] + (range[1] - range[0]) * i / 200, v = FL.content.pulse(t)[sr[0]] / norm[sr[0]]; pts.push([a.X(t), a.Y(v)]); }
        path(ctx, pts, sr[1], sr[2], sr[3]);
      });
      var x = a.X(app.pulseT);
      ctx.fillStyle = P.grid; ctx.fillRect(a.box.l, a.box.t, Math.max(0, x - a.box.l), a.box.b - a.box.t);
      ctx.strokeStyle = P.text; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, a.box.t); ctx.lineTo(x, a.box.b); ctx.stroke();
      tag(ctx, '聚变功率', a.X(300), a.Y(0.92) - 9, P.plasma, 'center'); tag(ctx, '等离子体电流', a.X(300), a.Y(1.0) + 11, P.power, 'center');
      tag(ctx, '加热', a.X(300), a.Y(0.32) - 9, P.field, 'center'); tag(ctx, '螺线管电流', a.X(520), a.Y(-0.72) + 12, P.t, 'right');
    }, '一次放电中各量随时间的变化');
    sl = slider(m, { label: '时间', min: range[0], max: range[1], step: 1, value: app.pulseT, unit: 's', show: function (v) { return (v < 0 ? '−' : '') + Math.abs(Math.round(v)); } }, function (v) { app.setPulse(v, true); });
    c = cards(m, [['等离子体电流', ''], ['外部加热', ''], ['聚变功率', '', '', 'plasma'], ['Q', '']]);
    var last = null;
    var tick = function () {
      if (last === app.pulseT) return;
      last = app.pulseT;
      var p = FL.content.pulse(app.pulseT);
      phase.textContent = p.phase; phase.dataset.on = p.pFus > 250 ? 'burn' : '';
      c[0].v.textContent = fmt(p.ip, 1) + ' MA'; c[0].s.textContent = '螺线管 ' + (p.cs >= 0 ? '+' : '−') + fmt(Math.abs(p.cs) * 100, 0) + '%';
      c[1].v.textContent = fmt(p.pAux, 0) + ' MW';
      c[2].v.textContent = fmt(p.pFus, 0) + ' MW'; c[2].s.textContent = 'α 加热 ' + fmt(p.pFus * DT.alpha / DT.total, 0) + ' MW';
      c[3].v.textContent = p.pAux > 1 ? fmt(p.pFus / p.pAux, 1) : '—';
      sl.set(app.pulseT); chart.draw();
    };
    tick();
    note(m, '曲线是手绘的分段斜坡，只为说明先后顺序与量级；真实放电由实时控制系统按等离子体状态调度。');
    return { tick: tick, dispose: function () { chart.dispose(); } };
  };

  /* ============ E · energy ============ */
  I.powerSplit = function (m) {
    var I0 = ref.ITER, pn = I0.pFus * DT.neutron / DT.total, pa = I0.pFus - pn;
    title(m, 'ITER 满功率时的去向', '设计目标');
    var strip = h('div', 'split-strip tall');
    strip.innerHTML = '<div class="s-he" style="flex:' + pa + '"><b>α ' + fmt(pa, 0) + ' MW</b><span>留在等离子体</span></div><div class="s-n" style="flex:' + pn + '"><b>中子 ' + fmt(pn, 0) + ' MW</b><span>进入包层</span></div>';
    m.appendChild(strip);
    cards(m, [
      ['聚变功率', I0.pFus + ' MW', '持续约 ' + I0.burn + ' s', 'plasma'], ['外部加热', I0.pAuxNominal + ' MW', 'Q = ' + I0.Q],
      ['等离子体总加热', fmt(pa + I0.pAuxNominal, 0) + ' MW', 'α ' + fmt(pa, 0) + ' + 外部 ' + I0.pAuxNominal], ['α 占比', fmt(pa / (pa + I0.pAuxNominal) * 100, 0) + '%', '燃烧等离子体：自加热为主', 'he']
    ]);
    note(m, '等离子体吸收的 ' + fmt(pa + I0.pAuxNominal, 0) + ' MW 最终也要离开：一部分变成辐射打在第一壁上，其余沿磁力线流向偏滤器。稳态下进多少、出多少。');
  };

  I.wallLoad = function (m) {
    var I0 = ref.ITER, nwl = core.neutronWallLoad(I0.pFus, I0.wallArea);
    title(m, '中子壁负载', '平均值');
    cards(m, [
      ['中子功率', fmt(I0.pFus * DT.neutron / DT.total, 0) + ' MW', '14.1 MeV', 'n'], ['第一壁面积', '约 ' + I0.wallArea + ' m²'],
      ['平均中子壁负载', fmt(nwl, 2) + ' MW/m²', 'ITER', 'heat'], ['发电堆量级', '1–2 MW/m²', '功率密度更高']
    ]);
    title(m, 'ITER 与发电堆的包层');
    var t = h('div', 'cmp');
    t.innerHTML = '<div><span></span><b>ITER</b><b>发电堆</b></div>' +
      '<div><span>功能</span><i>屏蔽 + 排热</i><i>屏蔽 + 产热 + 产氚</i></div>' +
      '<div><span>材料</span><i>不锈钢 + 水</i><i>低活化钢 + 锂 + 倍增剂</i></div>' +
      '<div><span>冷却剂出口</span><i>约 100–150 °C</i><i>约 300–500 °C</i></div>' +
      '<div><span>热的去向</span><i>冷却塔</i><i>蒸汽发生器 → 汽轮机</i></div>';
    m.appendChild(t);
    note(m, '壁负载是面积平均：外侧赤道面附近更高，内侧与上下更低。');
  };

  I.heatFlux = function (m) {
    title(m, '热流密度对比', '对数刻度 · MW/m²');
    bars(m, [
      ['正午阳光（地面）', 0.001, '--c-power', '0.001'], ['ITER 第一壁（常规区）', 2, '--c-n', '1–2'], ['ITER 第一壁（加强区）', 4.7, '--c-n', '4.7'],
      ['偏滤器靶板 · 稳态', 10, '--c-heat', '10'], ['偏滤器靶板 · 慢瞬态', 20, '--c-heat', '20'], ['太阳表面', 63, '--plasma', '63']
    ], { log: true, min: 0.0005, max: 100 });
    note(m, '第一壁与偏滤器为 ITER 设计值；太阳表面按 5772 K 黑体辐射计算。');
    cards(m, [['靶板材料', '钨', '熔点 3422 °C'], ['不加控制时', '> 40 MW/m²', '任何材料都撑不住', 'bad'], ['脱靶运行', '辐射掉 60–90%', '注入氮、氖等杂质', 'ok']], 1);
  };

  I.plantCalc = function (m, app, p) {
    var pre = p.preset === 'demo'
      ? { pFus: 2000, Q: 40, M: 1.18, etaTh: 0.37, etaHeat: 0.4, fBop: 0.25, name: 'DEMO 量级（2 GW 聚变）' }
      : { pFus: 500, Q: 10, M: 1.0, etaTh: 0.33, etaHeat: 0.4, fBop: 0.5, name: '假如给 ITER 接上汽轮机' };
    var s = Object.assign({}, pre), c, b;
    title(m, pre.name, '功率记账模型');
    var apply = function (user) {
      var r = core.plantBalance(s);
      b.set(0, r.pThermal, fmt(r.pThermal, 0) + ' MW'); b.set(1, r.gross, fmt(r.gross, 0) + ' MW');
      b.set(2, r.recirc, fmt(r.recirc, 0) + ' MW'); b.set(3, Math.max(0, r.net), fmt(r.net, 0) + ' MW');
      c[0].v.textContent = 'Q = ' + fmt(s.Q, 0); c[0].s.textContent = '加热 ' + fmt(r.pAux, 0) + ' MW 进等离子体';
      c[1].v.textContent = fmt(r.qEng, 2); c[1].card.className = 'stat tone-' + (r.qEng >= 2 ? 'ok' : r.qEng >= 1 ? 'warn' : 'bad');
      c[1].s.textContent = r.qEng < 1 ? '自己用的电比发的还多' : '发电 ÷ 厂用电';
      c[2].v.textContent = fmt(r.net, 0) + ' MW'; c[2].card.className = 'stat tone-' + (r.net > 0 ? 'ok' : 'bad');
      c[2].s.textContent = '厂用电占发电 ' + fmt(r.recircFraction * 100, 0) + '%';
      if (user) app.takeover();
    };
    slider(m, { label: '等离子体增益 Q', min: 1, max: 60, step: 1, value: s.Q }, function (v, u) { s.Q = v; apply(u); });
    slider(m, { label: '加热系统电效率', min: 20, max: 70, step: 1, value: s.etaHeat * 100, unit: '%' }, function (v, u) { s.etaHeat = v / 100; apply(u); });
    slider(m, { label: '热电转换效率', min: 25, max: 50, step: 1, value: s.etaTh * 100, unit: '%' }, function (v, u) { s.etaTh = v / 100; apply(u); });
    slider(m, { label: '低温 / 泵 / 氚工厂用电', min: 5, max: 60, step: 1, value: s.fBop * 100, unit: '% 发电量' }, function (v, u) { s.fBop = v / 100; apply(u); });
    c = cards(m, [['等离子体增益', ''], ['工程增益 Q_eng', ''], ['净上网功率', '']], 3);
    b = bars(m, [['热功率', 1, '--c-heat', ''], ['总发电', 1, '--c-power', ''], ['厂用电', 1, '--warn', ''], ['净上网', 1, '--ok', '']], { max: pre.pFus * 1.25 });
    note(m, '聚变功率固定为 ' + pre.pFus + ' MW；包层能量倍增系数 M = ' + pre.M + (pre.M > 1 ? '（锂-6 俘获中子放热）' : '（屏蔽包层，无锂）') + '。这是功率记账，不含脉冲占空比、可用率与造价。');
    apply(false);
  };

  /* ============ F · fuel cycle ============ */
  I.deuterium = function (m) {
    var g = core.deuteriumGramsPerM3(), sea = g * 1025 * (1 - 0.035) / 1000;
    var perLitre = sea / 1000 / core.MASS.D * 6.02214076e23 * DT.total * core.MEV_J;        // J, if every D meets a T
    title(m, '海水里的氘', 'VSMOW 同位素比');
    cards(m, [
      ['氢原子中氘的比例', '1 / ' + fmt(1 / core.D_H_RATIO, 0), (core.D_H_RATIO * 1e6).toFixed(0) + ' ppm', 'd'], ['每立方米淡水', fmt(g, 1) + ' g 氘'],
      ['每立方米海水', '约 ' + fmt(sea, 0) + ' g 氘', '盐度 3.5%，密度 1025 kg/m³', 'd'], ['1 升海水的氘（配足氚）', fmt(perLitre / 3.6e9, 1) + ' MWh', '≈ ' + fmt(perLitre / 41.868e9 * 1000, 0) + ' kg 标准油']
    ]);
    title(m, '一座电站一年的燃料');
    var burn = core.BURN_KG_PER_GWYR * 2.7;
    bars(m, [['氘', burn * core.MASS.D / core.MASS.T, '--c-d', fmt(burn * core.MASS.D / core.MASS.T, 0) + ' kg'], ['氚（厂内增殖）', burn, '--c-t', fmt(burn, 0) + ' kg'], ['锂-6（造氚消耗）', burn * core.MASS.Li6 / core.MASS.T, '--c-li', fmt(burn * core.MASS.Li6 / core.MASS.T, 0) + ' kg']]);
    note(m, '按 1 GW 电功率 ≈ 2.7 GW 聚变功率、全年满发估算。作为对比，同样电量的燃煤电站一年要烧约 300 万吨煤。真正从厂外运进来的只有氘和锂。');
  };

  I.tritium = function (m, app) {
    var s = { p: 1000, years: 12.32 }, c, chart;
    title(m, '衰变', '半衰期 ' + core.TRITIUM_HALF_LIFE + ' 年');
    chart = new Chart(m, 150, function (ctx, w, hh, P) {
      var a = axes(ctx, w, hh, P, { x: { min: 0, max: 50, ticks: [0, 12.32, 24.64, 36.96, 50], fmt: function (v) { return v ? v.toFixed(0) : '0'; }, label: '年' }, y: { min: 0, max: 1, ticks: [0, 0.25, 0.5, 1], fmt: function (v) { return v * 100 + '%'; } } });
      var pts = [];
      for (var i = 0; i <= 100; i++) { var t = i / 2; pts.push([a.X(t), a.Y(1 - core.tritiumDecayFraction(t))]); }
      path(ctx, pts, P.t, 2.4);
      dot(ctx, a.X(s.years), a.Y(1 - core.tritiumDecayFraction(s.years)), P.t, 5);
    }, '氚的衰变曲线');
    var apply = function (user) {
      var left = 1 - core.tritiumDecayFraction(s.years), burn = core.BURN_KG_PER_GWYR * s.p / 1000;
      c[0].v.textContent = fmt(left * 100, 1) + '%'; c[0].s.textContent = '放置 ' + s.years.toFixed(1) + ' 年后还剩';
      c[1].v.textContent = fmt(burn, 1) + ' kg / 年'; c[1].s.textContent = '≈ ' + fmt(burn * 1000 / 365.25, 0) + ' g / 天';
      c[2].v.textContent = fmt(30 / burn * 12, burn > 30 ? 1 : 0) + ' 个月'; c[2].s.textContent = '若全球库存按 30 kg 计';
      chart.draw(); if (user) app.takeover();
    };
    slider(m, { label: '放置时间', min: 0, max: 50, step: 0.5, value: s.years, unit: '年', show: function (v) { return v.toFixed(1); } }, function (v, u) { s.years = v; apply(u); });
    slider(m, { label: '聚变功率（全年满发）', min: 100, max: 3000, step: 50, value: s.p, unit: 'MW' }, function (v, u) { s.p = v; apply(u); });
    c = cards(m, [['剩余氚', '', '', 't'], ['每年烧掉', ''], ['外购氚能撑', '', '', 'bad']], 1);
    note(m, '“全球库存 30 kg”只是量级示意：民用氚主要来自 CANDU 重水堆，随堆的退役与衰变还在变化。ITER 整个氘氚阶段都靠这部分外购氚。');
    apply(false);
    return { dispose: function () { chart.dispose(); } };
  };

  I.breeding = function (m, app) {
    var s = { mult: 1.6, loss: 0.22, cover: 0.85 }, c;
    title(m, '增殖反应', 'AME2020 质量差');
    cards(m, [
      ['n + ⁶Li → T + ⁴He', '+' + core.BREED.li6.toFixed(2) + ' MeV', '任何能量的中子都行，慢中子更容易', 'ok'],
      ['n + ⁷Li → T + ⁴He + n′', core.BREED.li7.toFixed(2) + ' MeV', '吸热，只有快中子能做到，但中子还在', 'warn']
    ], 1);
    title(m, '中子账本', '教学估算，不是中子学计算');
    var apply = function (user) {
      var tbr = s.mult * (1 - s.loss) * s.cover;
      c[0].v.textContent = 'TBR ≈ ' + tbr.toFixed(2);
      c[0].card.className = 'stat tone-' + (tbr >= 1.05 ? 'ok' : tbr >= 1 ? 'warn' : 'bad');
      c[0].s.textContent = tbr >= 1.05 ? '有余量覆盖衰变与滞留' : tbr >= 1 ? '账面打平，实际不够' : '氚越烧越少';
      if (user) app.takeover();
    };
    slider(m, { label: '中子倍增（铍 / 铅）', min: 1, max: 1.9, step: 0.02, value: s.mult, unit: '个 / 聚变中子', show: function (v) { return v.toFixed(2); } }, function (v, u) { s.mult = v; apply(u); });
    slider(m, { label: '被结构与冷却剂吸收', min: 0, max: 40, step: 1, value: s.loss * 100, unit: '%' }, function (v, u) { s.loss = v / 100; apply(u); });
    slider(m, { label: '包层覆盖率', min: 60, max: 98, step: 1, value: s.cover * 100, unit: '%' }, function (v, u) { s.cover = v / 100; apply(u); });
    c = cards(m, [['氚增殖比', '']], 1);
    note(m, 'TBR ≈ 倍增 ×（1 − 吸收）× 覆盖率。真实设计要用三维中子输运程序逐个模块计算；窗口、偏滤器和加热天线占掉的面积都产不了氚。天然锂里 ⁶Li 只占 7.6%，包层用锂通常要富集。');
    apply(false);
  };

  I.innerLoop = function (m, app) {
    var s = { fb: 0.0036, tp: 6 }, c;
    title(m, '内循环流量', '按 2 GW 聚变功率连续运行');
    var apply = function (user) {
      var r = core.fuelCycle({ pFus: 2000, availability: 1, burnFraction: s.fb, tbr: 1.1, tProcessH: s.tp, tBreedD: 5 });
      c[0].v.textContent = fmt(r.burnGramPerDay, 0) + ' g / 天'; c[0].s.textContent = '真正发生聚变的氚';
      c[1].v.textContent = fmt(r.injectGramPerDay / 1000, 1) + ' kg / 天'; c[1].s.textContent = '是烧掉量的 ' + fmt(1 / s.fb, 0) + ' 倍';
      c[2].v.textContent = fmt(r.loopHoldup, 2) + ' kg'; c[2].s.textContent = '管道与设备里随时“在途”的氚';
      c[2].card.className = 'stat tone-' + (r.loopHoldup > 5 ? 'bad' : r.loopHoldup > 1.5 ? 'warn' : 'ok');
      if (user) app.takeover();
    };
    slider(m, { label: '燃烧率（烧掉 / 注入）', min: 0.002, max: 0.05, value: s.fb, log: true, unit: '%', show: function (v) { return (v * 100).toFixed(2); } }, function (v, u) { s.fb = v; apply(u); });
    slider(m, { label: '尾气处理一圈的时间', min: 1, max: 24, step: 0.5, value: s.tp, unit: '小时', show: function (v) { return v.toFixed(1); } }, function (v, u) { s.tp = v; apply(u); });
    c = cards(m, [['每天烧掉', '', '', 't'], ['每天要注入', ''], ['内循环在途量', '']], 1);
    note(m, '起始值 0.36% 是文献对 ITER 的估算量级。燃烧率低一倍，在途量就翻一倍——提高燃烧率、缩短处理时间（例如让部分尾气不经同位素分离直接回注）是发电堆燃料循环的主攻方向。');
    apply(false);
  };

  I.outerLoop = function (m) {
    title(m, '两类增殖包层', '主要候选方案');
    cards(m, [
      ['固态 · 氦冷球床（HCPB / HCCB）', '锂陶瓷小球 + 铍', '氦气吹扫把氚带出来；氦冷却'],
      ['液态 · 水冷锂铅（WCLL）', '液态 PbLi 合金', '铅做倍增剂；把液态金属泵出来脱氚']
    ], 1);
    title(m, '氚为什么难管');
    cards(m, [
      ['渗透', '氢同位素能穿过热的钢壁', '需要防氚渗透涂层'], ['滞留', '吸附在壁面、粉尘与冷却剂里', '抬高启动库存'],
      ['放射性', '低能 β，体外危害小', '吸入或食入才构成剂量'], ['除氚', '所有排气都要过除氚系统', '以氚化水形式回收']
    ]);
    note(m, '模型里的管线只画了主干。真实氚工厂还有水除氚、气氛除氚、分析与核算系统，占一整栋楼。');
  };

  I.inventory = function (m, app) {
    var s = { tbr: 1.1, fb: 0.01, tp: 6, start: 6 }, YEARS = 20, chart, c, res;
    title(m, '氚库存模拟', '三库存模型 · 2 GW · 可用率 50%');
    chart = new Chart(m, 200, function (ctx, w, hh, P) {
      if (!res) return;
      var top = Math.max(2 * s.start * 1.15, Math.min(60, Math.max.apply(null, res.total) * 1.1));
      var a = axes(ctx, w, hh, P, { x: { min: 0, max: YEARS, ticks: [0, 5, 10, 15, 20], label: '运行年' }, y: { min: 0, max: top, ticks: [0, s.start, 2 * s.start], fmt: function (v) { return fmt(v, 0); }, label: 'kg 氚' }, left: 34 });
      var line = function (arr) { return arr.map(function (v, i) { return [a.X(res.t[i]), a.Y(Math.min(top, v))]; }); };
      ctx.strokeStyle = P.ok; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(a.box.l, a.Y(2 * s.start)); ctx.lineTo(a.box.r, a.Y(2 * s.start)); ctx.stroke(); ctx.setLineDash([]);
      tag(ctx, '够再启动一座堆', a.box.r - 4, a.Y(2 * s.start) - 8, P.ok, 'right');
      path(ctx, line(res.total), P.muted, 1.4, [2, 3]);
      path(ctx, line(res.loop), P.plasma, 1.6); path(ctx, line(res.blanket), P.he, 1.6); path(ctx, line(res.storage), P.t, 2.6);
      if (res.doubling) dot(ctx, a.X(res.doubling), a.Y(2 * s.start), P.ok, 4.5);
      tag(ctx, '储存', a.box.l + 6, a.box.b - 34, P.t); tag(ctx, '内循环在途', a.box.l + 44, a.box.b - 34, P.plasma); tag(ctx, '包层在途', a.box.l + 118, a.box.b - 34, P.he);
    }, '氚库存随运行年份的变化');
    var apply = function (user) {
      var o = { pFus: 2000, availability: 0.5, burnFraction: s.fb, tbr: s.tbr, tProcessH: s.tp, tBreedD: 5, startKg: s.start };
      res = core.simulateInventory(o, YEARS);
      var f = core.fuelCycle(o);
      c[0].v.textContent = res.starved ? '燃料断供' : res.doubling ? fmt(res.doubling, 1) + ' 年' : '> ' + YEARS + ' 年';
      c[0].card.className = 'stat tone-' + (res.starved ? 'bad' : res.doubling && res.doubling < 10 ? 'ok' : 'warn');
      c[0].s.textContent = res.starved ? '储存见底，有 ' + fmt(res.starvedFraction * 100, 0) + '% 的时间被迫停堆' : '储存翻倍所需时间';
      c[1].v.textContent = f.tbrRequired.toFixed(3); c[1].s.textContent = '仅抵消在途氚的衰变；不含渗漏与备料';
      c[2].v.textContent = fmt(res.minStorage, 2) + ' kg'; c[2].s.textContent = '储存最低点（第 ' + fmt(res.minAt, 2) + ' 年）';
      c[3].v.textContent = fmt(res.final, 1) + ' kg'; c[3].s.textContent = YEARS + ' 年后全厂总量';
      chart.draw(); if (user) app.takeover();
    };
    slider(m, { label: '氚增殖比 TBR', min: 0.95, max: 1.3, step: 0.005, value: s.tbr, show: function (v) { return v.toFixed(3); } }, function (v, u) { s.tbr = v; apply(u); });
    slider(m, { label: '燃烧率', min: 0.002, max: 0.05, value: s.fb, log: true, unit: '%', show: function (v) { return (v * 100).toFixed(2); } }, function (v, u) { s.fb = v; apply(u); });
    slider(m, { label: '尾气处理时间', min: 1, max: 24, step: 0.5, value: s.tp, unit: '小时', show: function (v) { return v.toFixed(1); } }, function (v, u) { s.tp = v; apply(u); });
    slider(m, { label: '启动库存', min: 2, max: 20, step: 0.5, value: s.start, unit: 'kg', show: function (v) { return v.toFixed(1); } }, function (v, u) { s.start = v; apply(u); });
    c = cards(m, [['倍增时间', ''], ['最低必须的 TBR', ''], ['最紧张的时刻', ''], ['期末总量', '']]);
    note(m, '模型：总量变化 =（TBR − 1）× 燃烧量 − 衰变量，三个库存之间按停留时间流转；不含渗透损失、壁滞留与停堆期。数值仅用于看趋势。');
    apply(false);
    return { dispose: function () { chart.dispose(); } };
  };

  I.tbm = function (m) {
    title(m, '试验包层模块要测什么');
    cards(m, [
      ['产氚率', '实测 vs 中子学计算', '验证设计程序能否预测 TBR'], ['氚提取', '吹扫 / 脱气是否顺畅', '滞留量有多大'],
      ['热工', '高温冷却剂取热', '为发电回路提供数据'], ['材料', '低活化钢在真实环境下的表现', '焊缝、涂层、相容性']
    ]);
    note(m, '参与方包括中国、欧盟、日本、韩国等，方案覆盖水冷 / 氦冷与陶瓷球床 / 液态锂铅。ITER 的中子注量远低于发电堆，所以 TBM 验证的是“功能”，材料寿命还需要专门的辐照装置。');
    title(m, 'ITER 自己的氚');
    cards(m, [['来源', '外购', 'CANDU 重水堆副产'], ['燃烧率', '千分之几', '所以回收系统必须完整']], 2);
  };

  /* ============ G · power plant ============ */
  function roadmapStrip(m, from, to) {
    var wrap = h('div', 'roadmap');
    ref.ROADMAP.filter(function (r) { return r.year >= from && r.year <= to; }).forEach(function (r) {
      var row = h('div', 'rm-row ' + r.kind);
      row.innerHTML = '<b>' + r.year + '</b><i></i><span>' + r.label + '</span><em>' + (r.kind === 'done' ? '已发生' : '计划') + '</em>';
      wrap.appendChild(row);
    });
    m.appendChild(wrap);
  }
  I.mission = function (m) {
    var I0 = ref.ITER;
    title(m, 'ITER 的目标', '设计值，待实验验证');
    cards(m, [
      ['聚变功率', I0.pFus + ' MW', '热功率，不发电', 'plasma'], ['等离子体增益', 'Q ≥ ' + I0.Q, '燃烧约 ' + I0.burn + ' s'],
      ['长脉冲', 'Q ≈ 5', '目标约 3000 s'], ['此前纪录', 'Q ≈ 0.67', 'JET 1997 · 16 MW']
    ]);
    title(m, '时间表', '2024 基线 · 核对于 ' + ref.CHECKED);
    roadmapStrip(m, 2007, 2040);
    note(m, '计划节点可能继续调整，请以 ITER 组织的最新公告为准。');
  };

  I.plantLegend = function (m) {
    title(m, '沿着管道读这张图');
    var list = h('div', 'flow-legend');
    [['hot', '一回路热段', '包层出口 → 蒸汽发生器'], ['cold', '一回路冷段 / 给水', '回到包层与蒸汽发生器'], ['steam', '主蒸汽', '蒸汽发生器 → 汽轮机'], ['power', '电力', '发电机 → 变压器 → 电网 / 厂用电']].forEach(function (r) {
      var row = h('div', 'fl-row'); row.innerHTML = '<i class="sw sw-' + r[0] + '"></i><b>' + r[1] + '</b><span>' + r[2] + '</span>'; list.appendChild(row);
    });
    m.appendChild(list);
    title(m, '和裂变电站比');
    var t = h('div', 'cmp');
    t.innerHTML = '<div><span></span><b>聚变电站</b><b>压水堆</b></div>' +
      '<div><span>热源</span><i>包层吸收中子</i><i>燃料棒裂变</i></div>' +
      '<div><span>堆内燃料量</span><i>克级，连续补给</i><i>约百吨，一装烧 1–2 年</i></div>' +
      '<div><span>停堆后余热</span><i>低，来自活化材料</i><i>高，需长期冷却</i></div>' +
      '<div><span>厂用电比例</span><i>约 20–40%</i><i>约 5%</i></div>' +
      '<div><span>常规岛</span><i>汽轮机 + 发电机</i><i>汽轮机 + 发电机</i></div>';
    m.appendChild(t);
    note(m, '管线颜色只表示介质，流动快慢不代表流量。');
  };

  I.materials = function (m) {
    title(m, '结构钢的辐照损伤', 'dpa · 量级');
    bars(m, [['ITER · 全寿期', 3, '--c-n', '< 3'], ['EU-DEMO · 首套包层', 20, '--warn', '20'], ['EU-DEMO · 第二套包层', 50, '--c-heat', '50'], ['商用堆目标', 120, '--bad', '100–150']], { max: 150 });
    cards(m, [
      ['聚变中子的特别之处', '氦生成约 10 appm / dpa', '裂变堆约 0.3：氦让钢变脆', 'warn'], ['低活化钢', 'EUROFER · CLAM · F82H', '去掉 Mo、Nb、Ni 等长寿命活化元素'],
      ['更换周期', '包层几年一换', '偏滤器更短'], ['维护方式', '全部遥操作', '停堆后人无法进入真空室']
    ]);
    note(m, '目前没有任何装置能提供发电堆量级的 14 MeV 中子注量来考验材料——这正是 IFMIF-DONES 等专用中子源要补的空白。dpa 数值随设计与运行年限变化，这里只取代表量级。');
  };

  I.roadmap = function (m, app) {
    title(m, '同一把尺子上的截面', 'R、a 为公布或设计值');
    var list = ref.MACHINES;
    var chart = new Chart(m, 230, function (ctx, w, hh, P) {
      var gap = 10, total = list.reduce(function (s, d) { return s + 2 * d.a; }, 0);
      var s = Math.min((w - gap * (list.length + 1)) / total, (hh - 58) / (2 * 2.9 * 1.65)), x = (w - (total * s + gap * (list.length - 1))) / 2, mid = (hh - 46) / 2 + 4;
      list.forEach(function (d) {
        var cx = x + d.a * s, col = d.tone === 'past' ? P.muted : d.tone === 'now' ? P.plasma : d.tone === 'build' ? P.field : P.t;
        ctx.beginPath();
        for (var k = 0; k <= 80; k++) { var th = k / 80 * 6.2832, px = cx + d.a * s * Math.cos(th + 0.4 * Math.sin(th)), py = mid - d.kappa * d.a * s * Math.sin(th); if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.closePath(); ctx.globalAlpha = 0.16; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = col; ctx.lineWidth = d.id === 'iter' ? 2.4 : 1.6; if (d.tone === 'plan') ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
        tag(ctx, d.name, cx, hh - 36, P.text, 'center'); tag(ctx, 'R ' + d.R + ' m', cx, hh - 22, P.muted, 'center'); tag(ctx, d.B + ' T', cx, hh - 8, P.dim, 'center');
        x += 2 * d.a * s + gap;
      });
      /* a 1.8 m person at the same scale */
      ctx.fillStyle = P.warn; ctx.fillRect(6, mid + 2.9 * 1.65 * s - 1.8 * s, Math.max(2, 0.45 * s), 1.8 * s);
      tag(ctx, '人', 6, mid + 2.9 * 1.65 * s - 1.8 * s - 8, P.warn);
    }, '各装置等离子体截面的尺寸对比');
    var legend = h('div', 'chip-legend');
    legend.innerHTML = '<span class="k-past">已退役</span><span class="k-now">总装中</span><span class="k-build">建造中</span><span class="k-plan">设计 / 规划</span>';
    m.appendChild(legend);
    var tb = h('div', 'machine-list');
    list.forEach(function (d) { var row = h('div', 'ml-row'); row.innerHTML = '<b>' + d.name + '<small>' + d.where + '</small></b><span>' + d.status + '<small>' + d.note + '</small></span>'; tb.appendChild(row); });
    m.appendChild(tb);
    title(m, '里程碑', '核对于 ' + ref.CHECKED);
    roadmapStrip(m, 1990, 2060);
    note(m, '强磁场为什么能缩小装置：聚变功率密度约与 B⁴ 成正比。磁场翻一倍，同样的功率可以装进小一个量级的体积——前提是高温超导磁体、以及更集中的热负荷和中子负载都能被工程接住。');
    void app;
    return { dispose: function () { chart.dispose(); } };
  };

  I.challenges = function (m, app) {
    title(m, '五道关', '点击回到对应场景');
    var items = [
      ['燃烧等离子体', '长时间自持燃烧、避免破裂', 'ITER 验证', 'd5', 'now'], ['排热', '偏滤器长期承受 10 MW/m² 级热流', 'ITER 验证', 'e3', 'now'],
      ['氚自持', '整堆 TBR > 1，燃料循环闭合', 'ITER 部分验证 · 示范堆', 'f6', 'plan'], ['材料与维护', '耐 14 MeV 中子，遥操作更换', '辐照装置 · 示范堆', 'g4', 'plan'],
      ['经济性', '可用率、厂用电比例与造价', '示范堆 · 首批电站', 'g3', 'plan']
    ];
    var list = h('div', 'gate-list');
    items.forEach(function (it, i) {
      var b = h('button', 'gate ' + it[4], '<em>' + (i + 1) + '</em><span><b>' + it[0] + '</b><small>' + it[1] + '</small></span><i>' + it[2] + '</i>');
      b.type = 'button'; b.addEventListener('click', function () { app.goScene(it[3], true); });
      list.appendChild(b);
    });
    m.appendChild(list);
    note(m, '看完了全部七章。可以回到任何一幕自己动手调参数，或者往下翻，核对本页用到的数字和它们的出处。');
  };

  FL.instruments = I;
  FL.ui = { h: h, fmt: fmt, sci: sci, cards: cards, slider: slider, seg: seg, Chart: Chart, palette: palette };
})();
