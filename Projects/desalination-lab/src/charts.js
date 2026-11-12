/* Desalination Lab — canvas chart library.
 * Bars, multi-series lines, donut and gauge on Canvas 2D, sized by
 * ResizeObserver and re-themed on `dl:theme`. Module diagrams draw their
 * own canvases through DL.charts.base().
 */
(function () {
  'use strict';
  var DL = globalThis.DL = globalThis.DL || {};

  function cssv(name, fb) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fb;
  }
  function palette() {
    return {
      panel: cssv('--panel', '#181a1e'),
      panel2: cssv('--panel-2', '#1e2126'),
      panel3: cssv('--panel-3', '#23272d'),
      text: cssv('--text', '#eceef1'),
      muted: cssv('--muted', '#9aa1a9'),
      dim: cssv('--dim', '#6e757d'),
      line: cssv('--line', '#2d3238'),
      grid: cssv('--grid', 'rgba(255,255,255,.06)'),
      gridStrong: cssv('--grid-strong', 'rgba(255,255,255,.12)'),
      red: cssv('--red', '#e05a5f'),
      green: cssv('--green', '#3fae7a'),
      cyan: cssv('--cyan', '#5bc8be'),
      orange: cssv('--orange', '#e0955a'),
      blue: cssv('--blue', '#7aa2d8'),
      violet: cssv('--violet', '#b07cd8'),
      yellow: cssv('--yellow', '#d9c069')
    };
  }
  function colorOf(name, p) {
    return p[name] || p.cyan;
  }
  function font(size, weight) {
    return (weight || 400) + ' ' + size + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function niceTicks(min, max, count) {
    var span = max - min;
    if (!(span > 0)) return [min];
    var step = Math.pow(10, Math.floor(Math.log10(span / Math.max(1, count - 1))));
    var mult = [1, 2, 5, 10];
    for (var i = 0; i < mult.length; i++) {
      if (span / (step * mult[i]) <= count) { step *= mult[i]; break; }
    }
    var ticks = [];
    for (var v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(v);
    return ticks;
  }

  var instances = [];
  function disposeAll() {
    instances.forEach(function (i) { try { i.destroy(); } catch (e) { /* stale */ } });
    instances = instances.filter(function (i) { return document.body.contains(i.host); });
  }
  window.addEventListener('dl:theme', function () {
    instances.forEach(function (i) { i.redraw(); });
  });

  /* Base surface: canvas fitted to host box with devicePixelRatio. */
  function base(host, opts) {
    opts = opts || {};
    host.classList.add('chart');
    host.innerHTML = '';
    var canvas = document.createElement('canvas');
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var drawFn = opts.draw || null;
    var api = { host: host, canvas: canvas, ctx: ctx };

    function redraw() {
      var r = host.getBoundingClientRect();
      var w = Math.max(60, r.width);
      var h = Math.max(60, r.height || opts.height || 220);
      var dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var p = palette();
      if (drawFn) {
        try { drawFn(ctx, w, h, p, api); } catch (e) { console.error(e); }
      }
    }
    api.setDraw = function (fn) { drawFn = fn; redraw(); };
    api.redraw = redraw;
    var ro = new ResizeObserver(function () { requestAnimationFrame(redraw); });
    ro.observe(host);
    api.destroy = function () { ro.disconnect(); instances = instances.filter(function (i) { return i !== api; }); };
    instances.push(api);
    requestAnimationFrame(redraw);
    return api;
  }

  /* Vertical bars, optionally log-scale values. */
  function bars(host, opts) {
    var o = opts || {};
    var api = base(host, { draw: function (ctx, w, h, p) {
      var data = o.values || [];
      var labels = o.labels || [];
      if (!data.length) return;
      var padL = 44, padR = 12, padT = 22, padB = 34;
      var useLog = !!o.log;
      var vals = data.map(function (v) { return Math.max(useLog ? 1 : 0, v); });
      var min = useLog ? 1 : 0;
      var max = Math.max.apply(null, vals) * 1.12;
      var lg = function (v) { return useLog ? (Math.log(v / min) / Math.log(max / min)) : (v / max); };
      ctx.font = font(9);
      ctx.fillStyle = p.dim;
      ctx.textAlign = 'left';
      var ticks = useLog ? [1, 10, 100, 1000, 10000, 100000] : niceTicks(0, max, 4);
      ticks.forEach(function (t) {
        if (t < min || t > max) return;
        var y = h - padB - lg(t) * (h - padT - padB);
        ctx.strokeStyle = p.grid;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
        ctx.fillText(o.yFormat ? o.yFormat(t) : String(t), 4, y + 3);
      });
      var n = data.length;
      var bw = (w - padL - padR) / n;
      var barW = Math.min(56, bw * 0.62);
      data.forEach(function (v, i) {
        var x = padL + bw * i + (bw - barW) / 2;
        var bh = Math.max(2, lg(vals[i]) * (h - padT - padB));
        var y = h - padB - bh;
        var c = o.colors ? colorOf(o.colors[i], p) : p.cyan;
        ctx.fillStyle = c;
        roundRect(ctx, x, y, barW, bh, 4); ctx.fill();
        ctx.fillStyle = p.text;
        ctx.font = font(10, 600);
        ctx.textAlign = 'center';
        ctx.fillText(o.valueFormat ? o.valueFormat(v) : String(v), x + barW / 2, y - 6);
        ctx.fillStyle = p.muted;
        ctx.font = font(9.5);
        var lab = labels[i] || '';
        ctx.fillText(lab.length > 10 ? lab.slice(0, 9) + '…' : lab, padL + bw * i + bw / 2, h - padB + 16);
      });
      if (o.threshold != null) {
        var ty = h - padB - lg(Math.max(min, Math.min(max, o.threshold))) * (h - padT - padB);
        ctx.strokeStyle = p.green; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(padL, ty); ctx.lineTo(w - padR, ty); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = p.green; ctx.font = font(9, 600); ctx.textAlign = 'right';
        ctx.fillText(o.thresholdLabel || ('阈值 ' + o.threshold), w - padR, ty - 5);
      }
      if (o.label) {
        ctx.fillStyle = p.dim; ctx.font = font(9); ctx.textAlign = 'left';
        ctx.fillText(o.label, padL, 12);
      }
    } });
    api.update = function (next) { o = Object.assign(o, next); api.redraw(); };
    return api;
  }

  /* Multi-series line chart. */
  function lines(host, opts) {
    var o = opts || {};
    var api = base(host, { draw: function (ctx, w, h, p) {
      var series = o.series || [];
      if (!series.length) return;
      var padL = 46, padR = 14, padT = 20, padB = 30;
      var lo = o.yMin, hi = o.yMax;
      if (lo == null || hi == null) {
        lo = Infinity; hi = -Infinity;
        series.forEach(function (s) { s.values.forEach(function (v) { if (v == null) return; if (v < lo) lo = v; if (v > hi) hi = v; }); });
        if (!isFinite(lo) || lo === hi) { lo = 0; hi = 1; }
        hi += (hi - lo) * 0.08; lo -= (hi - lo) * 0.06;
      }
      ctx.font = font(9); ctx.textAlign = 'left'; ctx.fillStyle = p.dim;
      niceTicks(lo, hi, 4).forEach(function (t) {
        var y = h - padB - (t - lo) / (hi - lo) * (h - padT - padB);
        ctx.strokeStyle = p.grid;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
        ctx.fillText(o.yFormat ? o.yFormat(t) : String(Math.round(t * 100) / 100), 4, y + 3);
      });
      series.forEach(function (s) {
        var n = s.values.length;
        ctx.strokeStyle = colorOf(s.color || 'cyan', p);
        ctx.lineWidth = s.width || 2;
        if (s.dash) ctx.setLineDash(s.dash); else ctx.setLineDash([]);
        ctx.beginPath();
        var started = false;
        s.values.forEach(function (v, i) {
          if (v == null) return;
          var x = padL + (n > 1 ? i / (n - 1) : 0.5) * (w - padL - padR);
          var y = h - padB - clamp((v - lo) / (hi - lo), 0, 1) * (h - padT - padB);
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
        if (s.endLabel) {
          var lastV = s.values[s.values.length - 1];
          ctx.fillStyle = colorOf(s.color || 'cyan', p);
          ctx.font = font(9.5, 600); ctx.textAlign = 'right';
          ctx.fillText(s.endLabel, w - padR, h - padB - clamp((lastV - lo) / (hi - lo), 0, 1) * (h - padT - padB) - 6);
        }
      });
      if (o.markers) o.markers.forEach(function (m) {
        var x = padL + m.frac * (w - padL - padR);
        ctx.strokeStyle = colorOf(m.color || 'orange', p); ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = colorOf(m.color || 'orange', p); ctx.font = font(9, 600); ctx.textAlign = 'left';
        ctx.fillText(m.text, x + 4, padT + 10);
      });
      ctx.fillStyle = p.dim; ctx.font = font(9); ctx.textAlign = 'center';
      ctx.fillText(o.xLabel || '', w / 2, h - 6);
      if (o.label) { ctx.textAlign = 'left'; ctx.fillText(o.label, padL, 12); }
    } });
    api.update = function (next) { o = Object.assign(o, next); api.redraw(); };
    return api;
  }

  /* Donut with a center readout. */
  function donut(host, opts) {
    var o = opts || {};
    var api = base(host, { draw: function (ctx, w, h, p) {
      var segs = o.segments || [];
      var total = segs.reduce(function (a, s) { return a + s.value; }, 0);
      var cx = w / 2, cy = h / 2, rOut = Math.min(w, h) * 0.42, rIn = rOut * 0.58;
      var a0 = -Math.PI / 2;
      segs.forEach(function (s) {
        var a1 = a0 + (total > 0 ? s.value / total : 0) * Math.PI * 2;
        ctx.fillStyle = colorOf(s.color || 'cyan', p);
        ctx.beginPath();
        ctx.arc(cx, cy, rOut, a0, a1);
        ctx.arc(cx, cy, rIn, a1, a0, true);
        ctx.closePath(); ctx.fill();
        var am = (a0 + a1) / 2;
        ctx.fillStyle = p.muted; ctx.font = font(9.5);
        ctx.textAlign = Math.cos(am) < 0 ? 'right' : 'left';
        ctx.fillText(s.name + ' ' + s.value + '%', cx + Math.cos(am) * (rOut + 10), cy + Math.sin(am) * (rOut + 10));
        a0 = a1;
      });
      if (o.center) {
        ctx.fillStyle = p.text; ctx.font = font(17, 700); ctx.textAlign = 'center';
        ctx.fillText(o.center.value, cx, cy + 2);
        ctx.fillStyle = p.dim; ctx.font = font(9);
        ctx.fillText(o.center.label, cx, cy + 18);
      }
    } });
    api.update = function (next) { o = Object.assign(o, next); api.redraw(); };
    return api;
  }

  /* Horizontal gauge with an optional reference marker. */
  function gauge(host, opts) {
    var o = opts || {};
    var api = base(host, { height: 96, draw: function (ctx, w, h, p) {
      var pad = 14, bh = 20;
      var y = h / 2 - bh / 2 + 6;
      ctx.fillStyle = p.panel3;
      roundRect(ctx, pad, y, w - pad * 2, bh, 6); ctx.fill();
      var frac = clamp((o.value || 0) / (o.max || 1), 0, 1);
      ctx.fillStyle = colorOf(o.color || 'cyan', p);
      roundRect(ctx, pad, y, Math.max(6, frac * (w - pad * 2)), bh, 6); ctx.fill();
      if (o.marker != null) {
        var mx = pad + clamp(o.marker / (o.max || 1), 0, 1) * (w - pad * 2);
        ctx.strokeStyle = p.orange; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(mx, y - 8); ctx.lineTo(mx, y + bh + 8); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = p.orange; ctx.font = font(9.5, 600); ctx.textAlign = 'center';
        ctx.fillText(o.markerLabel || '', mx, y - 12);
      }
      ctx.fillStyle = p.text; ctx.font = font(11, 600); ctx.textAlign = 'left';
      ctx.fillText(o.valueLabel || String(o.value), pad, y + bh + 20);
      ctx.fillStyle = p.dim; ctx.font = font(9); ctx.textAlign = 'right';
      ctx.fillText(o.title || '', w - pad, y - 12);
    } });
    api.update = function (next) { o = Object.assign(o, next); api.redraw(); };
    return api;
  }

  DL.charts = {
    palette: palette, colorOf: colorOf, font: font, clamp: clamp, roundRect: roundRect,
    niceTicks: niceTicks, base: base, bars: bars, lines: lines, donut: donut, gauge: gauge,
    disposeAll: disposeAll
  };
})();
