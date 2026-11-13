/* Distillation Lab — SVG chart helpers.
 *
 * Charts are rebuilt as SVG strings on every update and on resize. Colours are
 * CSS variables inside style attributes, so a theme switch re-colours them
 * without a redraw. Shared drawings (McCabe–Thiele, T–x–y) live here so every
 * module draws the same diagram the same way.
 */
(function () {
  'use strict';
  var DL = window.DL = window.DL || {};

  var C = {
    light: 'var(--cyan)', heavy: 'var(--orange)', eq: 'var(--cyan)', diag: 'var(--dim)',
    rect: 'var(--violet)', strip: 'var(--orange)', qline: 'var(--yellow)', step: 'var(--text)',
    liquid: 'var(--blue)', vapor: 'var(--orange)', muted: 'var(--muted)', dim: 'var(--dim)', red: 'var(--red)', green: 'var(--green)'
  };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function num(v) { return Math.round(v * 100) / 100; }
  function styleOf(st, kind) {
    st = st || {};
    var out = [];
    if (kind === 'text') {
      out.push('fill:' + (st.c || 'var(--muted)'));
      out.push('font-size:' + (st.size || 10.5) + 'px');
      out.push('font-family:' + (st.sans ? 'var(--sans)' : 'var(--mono)'));
      if (st.weight) out.push('font-weight:' + st.weight);
      if (st.halo !== false) out.push('paint-order:stroke;stroke:var(--panel);stroke-width:3px;stroke-linejoin:round');
      if (st.op != null) out.push('opacity:' + st.op);
      return out.join(';');
    }
    out.push('stroke:' + (st.c || 'none'));
    out.push('stroke-width:' + (st.w == null ? 1.5 : st.w));
    out.push('fill:' + (st.fill || 'none'));
    if (st.dash) out.push('stroke-dasharray:' + st.dash);
    if (st.op != null) out.push('opacity:' + st.op);
    if (st.fop != null) out.push('fill-opacity:' + st.fop);
    out.push('stroke-linejoin:round;stroke-linecap:round');
    return out.join(';');
  }

  function niceTicks(min, max, n) {
    var span = max - min;
    if (!(span > 0)) return [min];
    var step = Math.pow(10, Math.floor(Math.log10(span / (n || 5))));
    var err = span / (n || 5) / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var t = [], v = Math.ceil(min / step - 1e-9) * step;
    for (; v <= max + 1e-9; v += step) t.push(Math.round(v / step) * step);
    return t;
  }

  /* ================================================================== */
  /*  Generic chart                                                      */
  /* ================================================================== */
  function chart(host, opts) {
    opts = opts || {};
    host.classList.add('chart', 'svg-chart');
    host.innerHTML = '';
    if (opts.label) { host.setAttribute('role', 'img'); host.setAttribute('aria-label', opts.label); }
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'plot-svg');
    host.appendChild(svg);
    var tip = document.createElement('div');
    tip.className = 'chart-tip';
    host.appendChild(tip);
    var cap = null;
    if (opts.title) {
      cap = document.createElement('div');
      cap.className = 'chart-label';
      cap.innerHTML = opts.title;
      host.appendChild(cap);
    }
    var api = { host: host, svg: svg, x: opts.x || { min: 0, max: 1 }, y: opts.y || { min: 0, max: 1 }, drawFn: null, W: 0, H: 0 };
    var pad = Object.assign({ l: 46, r: 14, t: opts.title ? 26 : 14, b: 36 }, opts.pad || {});
    var area = { x0: 0, y0: 0, x1: 0, y1: 0 };

    function layout() {
      var r = host.getBoundingClientRect();
      api.W = Math.max(120, Math.round(r.width));
      api.H = Math.max(120, Math.round(r.height));
      var x0 = pad.l, x1 = api.W - pad.r, y0 = pad.t, y1 = api.H - pad.b;
      if (opts.square) {
        var s = Math.min(x1 - x0, y1 - y0);
        var cx = (x0 + x1) / 2;
        x0 = Math.max(pad.l, cx - s / 2); x1 = x0 + s;
        y1 = y0 + s;
      }
      area = { x0: x0, y0: y0, x1: x1, y1: y1 };
      svg.setAttribute('width', api.W);
      svg.setAttribute('height', api.H);
      svg.setAttribute('viewBox', '0 0 ' + api.W + ' ' + api.H);
    }
    function sx(v) { var a = api.x; var t = a.log ? (Math.log10(v) - Math.log10(a.min)) / (Math.log10(a.max) - Math.log10(a.min)) : (v - a.min) / (a.max - a.min); return area.x0 + t * (area.x1 - area.x0); }
    function sy(v) { var a = api.y; var t = a.log ? (Math.log10(v) - Math.log10(a.min)) / (Math.log10(a.max) - Math.log10(a.min)) : (v - a.min) / (a.max - a.min); return area.y1 - t * (area.y1 - area.y0); }
    function ix(px) { var a = api.x; var t = (px - area.x0) / (area.x1 - area.x0); return a.log ? Math.pow(10, Math.log10(a.min) + t * (Math.log10(a.max) - Math.log10(a.min))) : a.min + t * (a.max - a.min); }
    function iy(py) { var a = api.y; var t = (area.y1 - py) / (area.y1 - area.y0); return a.log ? Math.pow(10, Math.log10(a.min) + t * (Math.log10(a.max) - Math.log10(a.min))) : a.min + t * (a.max - a.min); }
    api.sx = sx; api.sy = sy; api.area = function () { return area; };

    function builder() {
      var parts = [];
      var clipId = 'clip' + Math.random().toString(36).slice(2, 8);
      var g = {
        W: api.W, H: api.H, area: area, sx: sx, sy: sy, parts: parts, clipId: clipId,
        xmin: api.x.min, xmax: api.x.max, ymin: api.y.min, ymax: api.y.max,
        raw: function (s) { parts.push(s); return g; },
        grid: function (o) {
          o = o || {};
          var xt = api.x.ticks || (api.x.log ? logTicks(api.x.min, api.x.max) : niceTicks(api.x.min, api.x.max, o.nx || 5));
          var yt = api.y.ticks || (api.y.log ? logTicks(api.y.min, api.y.max) : niceTicks(api.y.min, api.y.max, o.ny || 5));
          var xf = api.x.fmt || function (v) { return String(num(v)); };
          var yf = api.y.fmt || function (v) { return String(num(v)); };
          var s = '<g class="grid">';
          xt.forEach(function (v) {
            var X = sx(v);
            s += '<line x1="' + X + '" y1="' + area.y0 + '" x2="' + X + '" y2="' + area.y1 + '" style="stroke:var(--grid);stroke-width:1"/>';
            s += '<text x="' + X + '" y="' + (area.y1 + 14) + '" text-anchor="middle" style="fill:var(--dim);font-size:9.5px;font-family:var(--mono)">' + esc(xf(v)) + '</text>';
          });
          yt.forEach(function (v) {
            var Y = sy(v);
            s += '<line x1="' + area.x0 + '" y1="' + Y + '" x2="' + area.x1 + '" y2="' + Y + '" style="stroke:var(--grid);stroke-width:1"/>';
            s += '<text x="' + (area.x0 - 6) + '" y="' + (Y + 3) + '" text-anchor="end" style="fill:var(--dim);font-size:9.5px;font-family:var(--mono)">' + esc(yf(v)) + '</text>';
          });
          s += '<rect x="' + area.x0 + '" y="' + area.y0 + '" width="' + (area.x1 - area.x0) + '" height="' + (area.y1 - area.y0) + '" style="fill:none;stroke:var(--grid-strong);stroke-width:1"/>';
          if (api.x.label) s += '<text x="' + ((area.x0 + area.x1) / 2) + '" y="' + (area.y1 + 29) + '" text-anchor="middle" style="fill:var(--muted);font-size:10.5px;font-family:var(--sans)">' + esc(api.x.label) + '</text>';
          if (api.y.label) s += '<text transform="translate(' + (area.x0 - 34) + ',' + ((area.y0 + area.y1) / 2) + ') rotate(-90)" text-anchor="middle" style="fill:var(--muted);font-size:10.5px;font-family:var(--sans)">' + esc(api.y.label) + '</text>';
          s += '</g>';
          s += '<defs><clipPath id="' + clipId + '"><rect x="' + area.x0 + '" y="' + area.y0 + '" width="' + (area.x1 - area.x0) + '" height="' + (area.y1 - area.y0) + '"/></clipPath></defs>';
          parts.push(s);
          return g;
        },
        open: function () { parts.push('<g clip-path="url(#' + clipId + ')">'); return g; },
        close: function () { parts.push('</g>'); return g; },
        path: function (pts, st) {
          var d = '', started = false;
          for (var i = 0; i < pts.length; i++) {
            var p = pts[i];
            if (!p || !isFinite(p[0]) || !isFinite(p[1])) { started = false; continue; }
            d += (started ? 'L' : 'M') + num(sx(p[0])) + ' ' + num(sy(p[1]));
            started = true;
          }
          if (st && st.closed) d += 'Z';
          if (d) parts.push('<path d="' + d + '" style="' + styleOf(st) + '"/>');
          return g;
        },
        line: function (x1, y1, x2, y2, st) { return g.path([[x1, y1], [x2, y2]], st); },
        hline: function (y, st) { return g.path([[api.x.min, y], [api.x.max, y]], st); },
        vline: function (x, st) { return g.path([[x, api.y.min], [x, api.y.max]], st); },
        rect: function (x0, y0, x1, y1, st) {
          var X0 = sx(x0), X1 = sx(x1), Y0 = sy(y0), Y1 = sy(y1);
          parts.push('<rect x="' + num(Math.min(X0, X1)) + '" y="' + num(Math.min(Y0, Y1)) + '" width="' + num(Math.abs(X1 - X0)) + '" height="' + num(Math.abs(Y1 - Y0)) + '" style="' + styleOf(Object.assign({ w: 0 }, st)) + '"/>');
          return g;
        },
        dot: function (x, y, st) {
          st = st || {};
          parts.push('<circle cx="' + num(sx(x)) + '" cy="' + num(sy(y)) + '" r="' + (st.r || 3.5) + '" style="' + styleOf({ c: st.stroke || 'var(--panel)', w: st.sw == null ? 1.5 : st.sw, fill: st.c || 'var(--cyan)' }) + '"/>');
          return g;
        },
        text: function (x, y, str, st) {
          st = st || {};
          var X = sx(x) + (st.dx || 0), Y = sy(y) + (st.dy || 0);
          parts.push('<text x="' + num(X) + '" y="' + num(Y) + '" text-anchor="' + (st.anchor || 'start') + '" style="' + styleOf(st, 'text') + '">' + esc(str) + '</text>');
          return g;
        },
        label: function (px, py, str, st) {
          st = st || {};
          parts.push('<text x="' + num(px) + '" y="' + num(py) + '" text-anchor="' + (st.anchor || 'start') + '" style="' + styleOf(st, 'text') + '">' + esc(str) + '</text>');
          return g;
        }
      };
      return g;
    }

    function logTicks(min, max) {
      var t = [];
      for (var e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
        [1, 2, 5].forEach(function (m) { var v = m * Math.pow(10, e); if (v >= min * 0.999 && v <= max * 1.001) t.push(v); });
      }
      return t;
    }

    function render() {
      layout();
      if (!api.drawFn) { svg.innerHTML = ''; return; }
      var g = builder();
      try { api.drawFn(g); } catch (err) { console.error(err); }
      svg.innerHTML = g.parts.join('') + '<g class="hover-layer"></g>';
    }
    api.draw = function (fn) { api.drawFn = fn; render(); return api; };
    api.redraw = render;
    api.setAxes = function (x, y) { if (x) api.x = x; if (y) api.y = y; };
    api.setTitle = function (html) { if (cap) cap.innerHTML = html; };
    api.setOpts = function (o) { Object.assign(opts, o || {}); };

    // hover
    function hideTip() { tip.classList.remove('on'); var hl = svg.querySelector('.hover-layer'); if (hl) hl.innerHTML = ''; }
    svg.addEventListener('pointermove', function (e) {
      if (!opts.hover) return;
      var r = svg.getBoundingClientRect();
      var px = e.clientX - r.left, py = e.clientY - r.top;
      if (px < area.x0 || px > area.x1 || py < area.y0 || py > area.y1) { hideTip(); return; }
      var res = opts.hover(ix(px), iy(py), api);
      if (!res) { hideTip(); return; }
      tip.innerHTML = res.html;
      tip.classList.add('on');
      var w = tip.offsetWidth, h = tip.offsetHeight;
      var left = px + 14, top = py + 12;
      if (left + w > api.W - 4) left = px - w - 14;
      if (top + h > api.H - 4) top = py - h - 12;
      tip.style.left = Math.max(2, left) + 'px';
      tip.style.top = Math.max(2, top) + 'px';
      var hl = svg.querySelector('.hover-layer');
      if (hl) {
        var s = '';
        (res.marks || []).forEach(function (m) {
          s += '<circle cx="' + num(sx(m[0])) + '" cy="' + num(sy(m[1])) + '" r="4" style="fill:none;stroke:' + (m[2] || 'var(--text)') + ';stroke-width:1.5"/>';
        });
        if (res.vx != null) s += '<line x1="' + num(sx(res.vx)) + '" x2="' + num(sx(res.vx)) + '" y1="' + area.y0 + '" y2="' + area.y1 + '" style="stroke:var(--dim);stroke-dasharray:2 3"/>';
        hl.innerHTML = s;
      }
    });
    svg.addEventListener('pointerleave', hideTip);

    var ro = new ResizeObserver(function () { render(); });
    ro.observe(host);
    api.destroy = function () { ro.disconnect(); host.innerHTML = ''; };
    layout();
    return api;
  }

  /* ================================================================== */
  /*  Shared diagrams                                                    */
  /* ================================================================== */
  function eqPoints(eq, step) {
    var pts = [], k = step || 3;
    for (var i = 0; i < eq.xs.length; i += k) pts.push([eq.xs[i], eq.ys[i]]);
    pts.push([1, 1]);
    return pts;
  }

  /** McCabe–Thiele diagram. o: { highlight, showQ, showOps, showSteps, pseudoE, labels } */
  function mccabe(g, eq, res, o) {
    o = o || {};
    g.grid({ nx: 5, ny: 5 }).open();
    g.line(0, 0, 1, 1, { c: C.diag, w: 1, dash: '3 4' });
    // equilibrium curve
    g.path(eqPoints(eq), { c: C.eq, w: 2.2 });
    if (res && res.E < 1 && o.showPseudo !== false && !res.infeasible) {
      var ps = [];
      for (var i = 0; i <= 100; i++) {
        var x = res.xW + (res.xD - res.xW) * i / 100;
        var yop = x >= res.inter.x ? res.yRect(x) : res.yStrip(x);
        ps.push([x, yop + res.E * (eq.y(x) - yop)]);
      }
      g.path(ps, { c: C.eq, w: 1.4, dash: '5 3', op: 0.85 });
    }
    if (res && !res.infeasible) {
      var I = res.inter;
      if (o.showOps !== false) {
        g.line(res.xD, res.xD, I.x, I.y, { c: C.rect, w: 1.8 });
        g.line(I.x, I.y, res.xW, res.xW, { c: C.strip, w: 1.8 });
      }
      if (o.showQ !== false) {
        var qx0 = res.xF, qy0 = res.xF;
        if (Math.abs(res.q - 1) < 1e-9) g.line(qx0, qy0, qx0, Math.max(I.y, eq.y(qx0)), { c: C.qline, w: 1.5, dash: '4 3' });
        else {
          var qp = DL.thermo.qPinch(eq, res.xF, res.q);
          var xe = Math.abs(qp.x - qx0) > Math.abs(I.x - qx0) ? qp.x : I.x;
          g.line(qx0, qy0, xe, DL.thermo.qLineY(xe, res.xF, res.q), { c: C.qline, w: 1.5, dash: '4 3' });
        }
      }
      if (o.showSteps !== false && res.stages.length) {
        var pts = [[res.xD, res.xD]];
        var maxDraw = Math.min(res.stages.length, 60);
        for (var n = 0; n < maxDraw; n++) {
          var s = res.stages[n];
          pts.push([s.x, s.y]);
          var next = res.stages[n + 1];
          if (next) pts.push([s.x, next.y]);
          else pts.push([s.x, Math.max(s.x, res.xW)]);
        }
        g.path(pts, { c: C.step, w: 1.2, op: 0.9 });
        // stage numbers
        var crowd = res.stages.length > 18;
        for (var m = 0; m < maxDraw; m++) {
          var st = res.stages[m];
          var hi = o.highlight === m + 1;
          if (hi) g.dot(st.x, st.y, { r: 5, c: 'var(--yellow)' });
          if (!crowd || hi || m === 0 || (m + 1) % 5 === 0 || m + 1 === res.feedStage) {
            g.text(st.x, st.y, String(m + 1), { dx: -5, dy: -5, anchor: 'end', size: 9.5, c: hi ? 'var(--yellow)' : (m + 1 === res.feedStage ? C.qline : C.muted) });
          }
        }
      }
      // markers
      g.dot(res.xD, res.xD, { r: 3.5, c: C.rect });
      g.dot(res.xW, res.xW, { r: 3.5, c: C.strip });
      g.dot(res.xF, res.xF, { r: 3.5, c: C.qline });
      if (o.labels !== false) {
        g.text(res.xD, res.xD, 'xD', { dy: 14, dx: -2, anchor: 'end', c: C.rect, size: 10 });
        g.text(res.xW, res.xW, 'xW', { dy: 14, dx: 4, c: C.strip, size: 10 });
        g.text(res.xF, res.xF, 'xF', { dy: 14, dx: 4, c: C.qline, size: 10 });
      }
    }
    if (eq.azeotrope) {
      var az = eq.azeotrope;
      g.dot(az.x, az.x, { r: 4, c: 'var(--red)' });
      g.text(az.x, az.x, '恒沸点 ' + az.x.toFixed(3), { dx: -8, dy: -9, anchor: 'end', c: 'var(--red)', size: 10 });
    }
    g.close();
    return g;
  }

  /** T–x–y diagram. o: { x (liquid mark), z (overall), T (tie line temperature), shade } */
  function txy(g, eq, o) {
    o = o || {};
    g.grid({ nx: 5, ny: 5 }).open();
    var bub = [], dew = [];
    for (var i = 0; i < eq.xs.length; i += 3) { bub.push([eq.xs[i], eq.Ts[i]]); dew.push([eq.ys[i], eq.Ts[i]]); }
    bub.push([1, eq.Ts[eq.Ts.length - 1]]); dew.push([1, eq.Ts[eq.Ts.length - 1]]);
    // two-phase region shading
    var poly = bub.concat(dew.slice().reverse());
    g.path(poly, { c: 'none', fill: 'var(--cyan)', fop: 0.07, closed: true, w: 0 });
    g.path(bub, { c: C.liquid, w: 2.2 });
    g.path(dew, { c: C.vapor, w: 2.2 });
    if (o.labels !== false) {
      var ymin = g.area.y0, ymax = g.area.y1;
      g.label(g.area.x0 + 8, ymax - 8, '液相 L', { c: C.liquid, size: 10.5, sans: true });
      g.label(g.area.x1 - 8, ymin + 14, '气相 V', { c: C.vapor, size: 10.5, anchor: 'end', sans: true });
    }
    if (o.x != null && isFinite(o.x)) {
      var T = eq.T(o.x), y = eq.y(o.x);
      g.line(o.x, T, y, T, { c: 'var(--text)', w: 1.2, dash: '3 3' });
      g.line(o.x, g.ymin, o.x, T, { c: C.liquid, w: 1, dash: '2 3', op: 0.7 });
      g.line(y, g.ymin, y, T, { c: C.vapor, w: 1, dash: '2 3', op: 0.7 });
      g.dot(o.x, T, { c: C.liquid, r: 4 });
      g.dot(y, T, { c: C.vapor, r: 4 });
      if (o.z != null) g.dot(o.z, T, { c: 'var(--yellow)', r: 3.5 });
    }
    g.close();
    return g;
  }

  DL.plot = {
    chart: chart, mccabe: mccabe, txy: txy, eqPoints: eqPoints, niceTicks: niceTicks, esc: esc, C: C
  };
})();
