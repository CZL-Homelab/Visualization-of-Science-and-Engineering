/* Stock Market Lab — canvas chart library.
 *
 * Three instruments share one surface: candlesticks (with volume + one
 * indicator pane), multi-series line charts, bars and a donut. Everything is
 * drawn with Canvas 2D, sized by ResizeObserver and re-themed on `sm:theme`.
 */
(function () {
  'use strict';
  var SM = window.SM = window.SM || {};
  var core = SM.core;

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
  function colorsFor(market, p) {
    return market === 'us' ? { up: p.green, down: p.red } : { up: p.red, down: p.green };
  }
  function font(size, weight) {
    return (weight || 400) + ' ' + size + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
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

  var instances = [];
  window.addEventListener('sm:theme', function () { instances.forEach(function (i) { i.redraw(); }); });

  function base(host, opts) {
    host.classList.add('chart');
    host.innerHTML = '';
    host.style.touchAction = 'none';
    if (opts.label) { host.setAttribute('role', 'img'); host.setAttribute('aria-label', opts.label); }
    var canvas = document.createElement('canvas');
    host.appendChild(canvas);
    var tip = document.createElement('div');
    tip.className = 'chart-tip';
    host.appendChild(tip);
    var ctx = canvas.getContext('2d');
    var api = { host: host, canvas: canvas, tip: tip, ctx: ctx, W: 0, H: 0, dpr: 1 };
    api.resize = function () {
      var r = host.getBoundingClientRect();
      api.W = Math.max(80, Math.round(r.width));
      api.H = Math.max(80, Math.round(r.height));
      api.dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(api.W * api.dpr);
      canvas.height = Math.round(api.H * api.dpr);
      ctx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);
      if (api.redraw) api.redraw();
    };
    api.tipAt = function (html, x, y) {
      tip.innerHTML = html;
      tip.classList.add('on');
      var w = tip.offsetWidth, h = tip.offsetHeight;
      var left = x + 14, top = y + 12;
      if (left + w > api.W - 4) left = x - w - 14;
      if (top + h > api.H - 4) top = y - h - 12;
      tip.style.left = Math.max(2, left) + 'px';
      tip.style.top = Math.max(2, top) + 'px';
      return tip;
    };
    api.hideTip = function () { tip.classList.remove('on'); };
    api.destroy = function () {
      if (api.ro) api.ro.disconnect();
      var i = instances.indexOf(api);
      if (i >= 0) instances.splice(i, 1);
      host.innerHTML = '';
    };
    var ro = new ResizeObserver(function () { api.resize(); });
    ro.observe(host);
    api.ro = ro;
    instances.push(api);
    api.resize();
    setTimeout(function () { api.resize(); }, 40);
    return api;
  }

  function pos(api, e) {
    var r = api.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function timeAxisLabel(t, spanMs) {
    var d = new Date(t);
    if (spanMs <= 2 * 864e5) return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    if (spanMs < 400 * 864e5) return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }

  /* =========================================================
   *  Candlestick chart
   * ========================================================= */
  function kline(host, options) {
    var o = Object.assign({
      market: 'cn', fill: 'solid', showVolume: true, visibleCount: 90, minCount: 12,
      interactive: true, volumeMA: [5, 10], label: 'K 线图'
    }, options || {});
    var b = base(host, o);
    var st = {
      candles: [], overlays: [], indicator: null, markers: [],
      market: o.market, fill: o.fill, selected: null,
      start: 0, count: o.visibleCount, hover: null, drag: null, moved: false
    };

    function len() { return st.candles.length; }
    function fit() {
      var maxCount = Math.max(o.minCount, len());
      st.count = clamp(st.count, Math.min(o.minCount, maxCount), maxCount);
      st.start = clamp(st.start, 0, Math.max(0, len() - st.count));
    }
    function setData(d) {
      if (d.candles) st.candles = d.candles.slice();
      if ('overlays' in d) st.overlays = d.overlays || [];
      if ('indicator' in d) st.indicator = d.indicator || null;
      if ('markers' in d) st.markers = d.markers || [];
      if (d.visibleCount) st.count = d.visibleCount;
      fit();
      if (d.resetView !== false) st.start = Math.max(0, len() - st.count);
      if (st.selected != null && st.selected >= len()) st.selected = null;
      draw();
    }
    function geom() {
      var W = b.W, H = b.H, padL = 8, padR = 56, padT = 8, padB = 20;
      var volH = o.showVolume ? Math.min(64, Math.max(36, H * 0.14)) : 0;
      var indH = st.indicator ? Math.min(86, Math.max(56, H * 0.18)) : 0;
      var priceB = H - padB - volH - (indH ? indH + 8 : 0);
      return {
        W: W, H: H, L: padL, R: W - padR, T: padT,
        priceB: priceB, priceH: Math.max(30, priceB - padT),
        volT: priceB, volH: volH,
        indT: priceB + volH + 8, indH: indH,
        plotW: Math.max(20, W - padL - padR), bottom: H - padB
      };
    }
    function visible() { return st.candles.slice(st.start, st.start + st.count); }

    function priceRange(g, vis) {
      var hi = -Infinity, lo = Infinity;
      vis.forEach(function (c) { hi = Math.max(hi, c.h); lo = Math.min(lo, c.l); });
      st.overlays.forEach(function (ov) {
        if (!ov.values) return;
        for (var i = st.start; i < st.start + vis.length; i++) {
          var v = ov.values[i];
          if (v != null && isFinite(v)) { hi = Math.max(hi, v); lo = Math.min(lo, v); }
        }
      });
      st.markers.forEach(function (m) {
        if (m.price != null && m.index >= st.start && m.index < st.start + vis.length) {
          hi = Math.max(hi, m.price); lo = Math.min(lo, m.price);
        }
      });
      if (!isFinite(hi) || !isFinite(lo)) return { hi: 1, lo: 0 };
      if (hi === lo) { hi += 1; lo -= 1; }
      var pad = (hi - lo) * 0.08;
      return { hi: hi + pad, lo: lo - pad };
    }

    function draw() {
      var p = palette(), ctx = b.ctx, g = geom();
      ctx.clearRect(0, 0, g.W, g.H);
      if (!len()) {
        ctx.fillStyle = p.dim; ctx.font = font(12); ctx.textAlign = 'center';
        ctx.fillText('暂无数据', g.W / 2, g.H / 2);
        return;
      }
      fit();
      var vis = visible(), n = vis.length;
      if (!n) return;
      var bw = g.plotW / st.count;
      var range = priceRange(g, vis);
      var y = function (price) { return g.T + (range.hi - price) / (range.hi - range.lo) * g.priceH; };
      var xAt = function (idx) { return g.L + (idx - st.start + 0.5) * bw; };
      var cw = st.candles, pcol = colorsFor(st.market, p);

      // price grid + right labels
      ctx.font = font(9.5);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (var k = 0; k <= 4; k++) {
        if (k === 0) continue; // lowest grid label would collide with the time axis
        var price = range.lo + (range.hi - range.lo) * k / 4;
        var yy = Math.round(y(price)) + 0.5;
        ctx.strokeStyle = p.grid; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(g.L, yy); ctx.lineTo(g.R, yy); ctx.stroke();
        ctx.fillStyle = p.dim;
        ctx.fillText(price.toFixed(2), g.W - 6, yy);
      }

      // vertical grid + time labels
      var span = vis[n - 1].t - vis[0].t;
      var sampleLbl = vis[Math.floor(n / 2)].label || timeAxisLabel(vis[Math.floor(n / 2)].t, span);
      var step = Math.max(1, Math.ceil((ctx.measureText(sampleLbl).width + 18) / bw));
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (var i = 0; i < n; i += step) {
        var xx = Math.round(xAt(st.start + i)) + 0.5;
        ctx.strokeStyle = p.grid; ctx.beginPath(); ctx.moveTo(xx, g.T); ctx.lineTo(xx, g.bottom); ctx.stroke();
        ctx.fillStyle = p.dim;
        var lbl = vis[i].label || timeAxisLabel(vis[i].t, span);
        var tw = ctx.measureText(lbl).width;
        if (xx - tw / 2 > g.L - 2 && xx + tw / 2 < g.R + 2) ctx.fillText(lbl, xx, g.bottom + 4);
      }

      // selected column
      if (st.selected != null && st.selected >= st.start && st.selected < st.start + n) {
        ctx.fillStyle = 'rgba(91,200,190,.09)';
        ctx.fillRect(g.L + (st.selected - st.start) * bw, g.T, bw, g.bottom - g.T);
      }

      // volume pane
      if (o.showVolume) {
        var maxV = 0;
        vis.forEach(function (c) { maxV = Math.max(maxV, c.v || 0); });
        maxV = maxV || 1;
        ctx.strokeStyle = p.grid; ctx.beginPath();
        ctx.moveTo(g.L, Math.round(g.volT) + 0.5); ctx.lineTo(g.R, Math.round(g.volT) + 0.5); ctx.stroke();
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = p.dim;
        ctx.fillText(shortNum(maxV), g.W - 6, g.volT + 10);
        vis.forEach(function (c, i) {
          var vh = (c.v || 0) / maxV * (g.volH - 8);
          ctx.fillStyle = (c.c >= c.o ? pcol.up : pcol.down) + '99';
          var vw = Math.max(1, Math.min(18, bw * 0.6));
          var bx = g.L + i * bw + (bw - vw) / 2;
          ctx.fillRect(bx, g.volT + g.volH - vh, vw, vh);
        });
        (o.volumeMA || []).forEach(function (period, idx) {
          var series = core.ma(cw.map(function (c) { return c.v || 0; }), period);
          var col = [p.orange, p.violet, p.blue][idx % 3];
          ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath();
          var started = false;
          for (var j = 0; j < n; j++) {
            var val = series[st.start + j];
            if (val == null) { started = false; continue; }
            var vx = g.L + j * bw + bw / 2;
            var vy = g.volT + g.volH - val / maxV * (g.volH - 8);
            if (!started) { ctx.moveTo(vx, vy); started = true; } else ctx.lineTo(vx, vy);
          }
          ctx.stroke();
        });
      }

      // candles
      vis.forEach(function (c, i) {
        var cx = g.L + i * bw + bw / 2;
        var col = c.c >= c.o ? pcol.up : pcol.down;
        if (c.c === c.o) col = p.muted;
        ctx.strokeStyle = col; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(cx) + 0.5, Math.round(y(c.h)) + 0.5);
        ctx.lineTo(Math.round(cx) + 0.5, Math.round(y(c.l)) + 0.5);
        ctx.stroke();
        var top = y(Math.max(c.o, c.c)), bot = y(Math.min(c.o, c.c));
        var bh = Math.max(1, bot - top);
        var bwd = Math.max(1, Math.min(22, bw * 0.62));
        if (st.fill === 'hollow' && bh > 2 && bwd > 2) {
          ctx.fillStyle = p.panel;
          ctx.fillRect(cx - bwd / 2, top, bwd, bh);
          ctx.strokeStyle = col; ctx.lineWidth = 1;
          ctx.strokeRect(Math.round(cx - bwd / 2) + 0.5, Math.round(top) + 0.5, Math.round(bwd) - 1, Math.round(bh) - 1);
        } else {
          ctx.fillStyle = col;
          ctx.fillRect(cx - bwd / 2, top, bwd, bh);
        }
      });

      // overlays
      st.overlays.forEach(function (ov) {
        if (!ov.values) return;
        ctx.strokeStyle = ov.color || p.cyan;
        ctx.lineWidth = ov.width || 1.1;
        ctx.setLineDash(ov.dash || []);
        ctx.beginPath();
        var on = false;
        for (var i = 0; i < n; i++) {
          var v = ov.values[st.start + i];
          if (v == null) { on = false; continue; }
          var px = g.L + i * bw + bw / 2, py = y(v);
          if (!on) { ctx.moveTo(px, py); on = true; } else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // indicator pane
      if (st.indicator && g.indH > 20) drawIndicator(g, vis, bw, p, ctx);

      // markers
      ctx.font = font(9.5);
      st.markers.forEach(function (m) {
        if (m.index < st.start || m.index >= st.start + n) return;
        var mx = xAt(m.index);
        var my = y(m.price != null ? m.price : cw[m.index].h);
        var col = m.color || p.cyan;
        ctx.fillStyle = col;
        ctx.beginPath();
        if (m.dir === 'down') {
          ctx.moveTo(mx, my + 3); ctx.lineTo(mx - 4, my - 5); ctx.lineTo(mx + 4, my - 5);
        } else {
          ctx.moveTo(mx, my - 3); ctx.lineTo(mx - 4, my + 5); ctx.lineTo(mx + 4, my + 5);
        }
        ctx.closePath(); ctx.fill();
        if (m.text) {
          ctx.textAlign = mx > g.R - 60 ? 'right' : 'left';
          ctx.textBaseline = 'middle';
          var tx = mx + (ctx.textAlign === 'right' ? -7 : 7);
          var ty = my + (m.dir === 'down' ? 14 : -14);
          ctx.lineWidth = 3; ctx.strokeStyle = p.panel; ctx.strokeText(m.text, tx, ty);
          ctx.fillStyle = col; ctx.fillText(m.text, tx, ty);
        }
      });

      // hover crosshair
      if (st.hover && st.hover.index >= st.start && st.hover.index < st.start + n) {
        var hx = Math.round(xAt(st.hover.index)) + 0.5;
        ctx.strokeStyle = p.gridStrong; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(hx, g.T); ctx.lineTo(hx, g.bottom); ctx.stroke();
        if (st.hover.y > g.T && st.hover.y < g.priceB) {
          var hy = Math.round(st.hover.y) + 0.5;
          ctx.beginPath(); ctx.moveTo(g.L, hy); ctx.lineTo(g.R, hy); ctx.stroke();
          var hp = range.hi - (st.hover.y - g.T) / g.priceH * (range.hi - range.lo);
          ctx.setLineDash([]);
          ctx.fillStyle = p.panel3;
          roundRect(ctx, g.W - 54, hy - 7, 50, 14, 3); ctx.fill();
          ctx.fillStyle = p.text; ctx.font = font(9.5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(hp.toFixed(2), g.W - 29, hy);
        }
        var c = cw[st.hover.index];
        if (c) {
          var lb = c.label || timeAxisLabel(c.t, span);
          ctx.setLineDash([]);
          ctx.font = font(9.5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          var lw = ctx.measureText(lb).width + 12;
          var lx = clamp(hx, g.L + lw / 2, g.R - lw / 2);
          ctx.fillStyle = p.panel3;
          roundRect(ctx, lx - lw / 2, g.bottom + 1, lw, 15, 3); ctx.fill();
          ctx.fillStyle = p.text;
          ctx.fillText(lb, lx, g.bottom + 9);
        }
      }
    }

    function drawIndicator(g, vis, bw, p, ctx) {
      var ind = st.indicator;
      var vals = [];
      ind.series.forEach(function (s) { s.values && s.values.forEach(function (v) { if (v != null && isFinite(v)) vals.push(v); }); });
      var lo, hi;
      if (ind.range) { lo = ind.range[0]; hi = ind.range[1]; }
      else {
        lo = Infinity; hi = -Infinity;
        for (var vi = 0; vi < vals.length; vi++) { if (vals[vi] < lo) lo = vals[vi]; if (vals[vi] > hi) hi = vals[vi]; }
        if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
        if (hi === lo) { hi += 1; lo -= 1; }
        var pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
      }
      var y = function (v) { return g.indT + (hi - v) / (hi - lo) * (g.indH - 4); };
      ctx.strokeStyle = p.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(g.L, Math.round(g.indT) + 0.5); ctx.lineTo(g.R, Math.round(g.indT) + 0.5); ctx.stroke();
      (ind.bands || []).forEach(function (band) {
        var y1 = y(band.to), y2 = y(band.from);
        ctx.fillStyle = band.color || 'rgba(91,200,190,.05)';
        ctx.fillRect(g.L, Math.min(y1, y2), g.plotW, Math.abs(y2 - y1));
      });
      (ind.lines || []).forEach(function (line) {
        var ly = Math.round(y(line.value)) + 0.5;
        ctx.strokeStyle = line.color || p.gridStrong; ctx.setLineDash(line.dash || [2, 3]);
        ctx.beginPath(); ctx.moveTo(g.L, ly); ctx.lineTo(g.R, ly); ctx.stroke();
        ctx.setLineDash([]);
        if (line.label) { ctx.fillStyle = p.dim; ctx.font = font(9); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(line.label, g.L + 3, ly - 1); }
      });
      if (lo < 0 && hi > 0) {
        ctx.strokeStyle = p.gridStrong; ctx.beginPath(); ctx.moveTo(g.L, Math.round(y(0)) + 0.5); ctx.lineTo(g.R, Math.round(y(0)) + 0.5); ctx.stroke();
      }
      ind.series.forEach(function (s) {
        if (s.hist) {
          for (var hi2 = 0; hi2 < st.count; hi2++) {
            var v = s.values[st.start + hi2];
            if (v == null) continue;
            var y0 = y(0), y1 = y(v);
            ctx.fillStyle = v >= 0 ? (p.red + 'cc') : (p.green + 'cc');
            var bx = g.L + hi2 * bw + bw * 0.2;
            ctx.fillRect(bx, Math.min(y0, y1), Math.max(1, bw * 0.6), Math.max(1, Math.abs(y1 - y0)));
          }
          return;
        }
        ctx.strokeStyle = s.color || p.cyan;
        ctx.lineWidth = s.width || 1;
        ctx.beginPath();
        var on = false;
        for (var i = 0; i < st.count; i++) {
          var v = s.values[st.start + i];
          if (v == null) { on = false; continue; }
          var px = g.L + i * bw + bw / 2, py = y(v);
          if (!on) { ctx.moveTo(px, py); on = true; } else ctx.lineTo(px, py);
        }
        ctx.stroke();
      });
      if (ind.label) {
        ctx.font = font(9); ctx.fillStyle = p.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(ind.label, g.L + 3, g.indT + 2);
      }
      if (ind.range) {
        ctx.fillStyle = p.dim; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = font(8.5);
        ctx.fillText(String(ind.range[1]), b.W - 6, g.indT + 4);
        ctx.fillText(String(ind.range[0]), b.W - 6, g.indT + g.indH - 4);
      }
    }

    function shortNum(v) {
      if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿';
      if (v >= 1e4) return (v / 1e4).toFixed(1) + '万';
      return String(Math.round(v));
    }

    function tooltip(c, idx) {
      var prev = st.candles[idx - 1];
      var pct = prev ? core.changePct(prev.c, c.c) : null;
      var p = palette(), col = colorsFor(st.market, p);
      var html = '<div><b>' + (c.label || core.periodLabel(c.t, 'D')) + '</b></div>';
      html += '<div>开 <b>' + c.o.toFixed(2) + '</b>　高 <b>' + c.h.toFixed(2) + '</b></div>';
      html += '<div>低 <b>' + c.l.toFixed(2) + '</b>　收 <b>' + c.c.toFixed(2) + '</b></div>';
      if (pct != null) html += '<div>较前收 <span style="color:' + (pct >= 0 ? col.up : col.down) + '">' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%</span></div>';
      if (c.v) html += '<div>成交量 <b>' + shortNum(c.v) + '</b></div>';
      var lines = [];
      st.overlays.forEach(function (ov) {
        if (ov.name && ov.values && ov.values[idx] != null) lines.push(ov.name + ' ' + ov.values[idx].toFixed(2));
      });
      if (lines.length) html += '<div>' + lines.join('　') + '</div>';
      return html;
    }

    if (o.interactive !== false) {
      var canvas = b.canvas;
      canvas.style.cursor = 'crosshair';
      canvas.addEventListener('pointerdown', function (e) {
        canvas.setPointerCapture(e.pointerId);
        var pt = pos(b, e);
        st.drag = { x: pt.x, start: st.start };
        st.moved = false;
      });
      canvas.addEventListener('pointermove', function (e) {
        var pt = pos(b, e);
        if (st.drag) {
          var g = geom();
          var bw = g.plotW / st.count;
          var delta = Math.round((pt.x - st.drag.x) / bw);
          if (Math.abs(pt.x - st.drag.x) > 2) st.moved = true;
          if (st.moved) {
            st.start = clamp(st.drag.start - delta, 0, Math.max(0, len() - st.count));
            st.hover = null;
            b.hideTip();
            draw();
            return;
          }
        }
        var g2 = geom();
        var bw2 = g2.plotW / st.count;
        var idx = st.start + Math.floor((pt.x - g2.L) / bw2);
        if (idx < 0 || idx >= len() || pt.x < g2.L || pt.x > g2.R) { st.hover = null; b.hideTip(); draw(); return; }
        st.hover = { index: idx, y: pt.y };
        draw();
        var c = st.candles[idx];
        if (c && pt.y < g2.priceB) b.tipAt(tooltip(c, idx), pt.x, pt.y);
        else b.hideTip();
        if (o.onHover) o.onHover(c, idx);
      });
      var end = function () {
        st.drag = null;
        canvas.style.cursor = 'crosshair';
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('pointerleave', function () {
        st.drag = null; st.hover = null; b.hideTip(); draw();
        if (o.onHover) o.onHover(null, null);
      });
      canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        var pt = pos(b, e), g = geom();
        var anchor = st.start + (pt.x - g.L) / (g.plotW / st.count);
        var factor = e.deltaY > 0 ? 1.16 : 0.86;
        st.count = clamp(Math.round(st.count * factor), Math.min(o.minCount, len()), len());
        st.start = clamp(Math.round(anchor - (pt.x - g.L) / (g.plotW / st.count)), 0, Math.max(0, len() - st.count));
        draw();
      }, { passive: false });
      canvas.addEventListener('dblclick', function () {
        st.count = Math.min(o.visibleCount, len());
        st.start = Math.max(0, len() - st.count);
        draw();
      });
      host.tabIndex = 0;
      host.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { st.start = clamp(st.start - Math.max(1, Math.round(st.count / 10)), 0, Math.max(0, len() - st.count)); draw(); e.preventDefault(); }
        if (e.key === 'ArrowRight') { st.start = clamp(st.start + Math.max(1, Math.round(st.count / 10)), 0, Math.max(0, len() - st.count)); draw(); e.preventDefault(); }
        if (e.key === '+' || e.key === '=') { st.count = clamp(Math.round(st.count * 0.85), Math.min(o.minCount, len()), len()); fit(); draw(); e.preventDefault(); }
        if (e.key === '-') { st.count = clamp(Math.round(st.count * 1.18), Math.min(o.minCount, len()), len()); st.start = Math.max(0, len() - st.count); draw(); e.preventDefault(); }
      });
    }

    b.redraw = draw;
    if (options && options.candles) setData(options);

    return {
      setData: setData,
      setMarket: function (m) { st.market = m === 'us' ? 'us' : 'cn'; draw(); },
      setFill: function (f) { st.fill = f === 'hollow' ? 'hollow' : 'solid'; draw(); },
      setSelected: function (i) { st.selected = i; draw(); },
      zoomTo: function (start, count) {
        if (count) st.count = clamp(count, Math.min(o.minCount, len()), len());
        st.start = clamp(start || 0, 0, Math.max(0, len() - st.count));
        draw();
      },
      focus: function (idx) { st.start = clamp(idx - Math.floor(st.count / 2), 0, Math.max(0, len() - st.count)); draw(); },
      getVisible: function () { return { start: st.start, count: st.count }; },
      resize: function () { b.resize(); }, destroy: b.destroy,
      redraw: draw
    };
  }

  /* =========================================================
   *  Multi-series line chart
   * ========================================================= */
  function lines(host, options) {
    var o = Object.assign({ label: '折线图', zero: true, xLabels: null, yFormat: null }, options || {});
    var b = base(host, o);
    var st = { series: [], labels: [], markers: [], bands: [], hover: null };
    function setData(d) {
      if (d.series) st.series = d.series;
      if (d.labels) st.labels = d.labels;
      if ('markers' in d) st.markers = d.markers || [];
      if ('bands' in d) st.bands = d.bands || [];
      draw();
    }
    function draw() {
      var p = palette(), ctx = b.ctx, W = b.W, H = b.H;
      ctx.clearRect(0, 0, W, H);
      var L = 8, R = W - 54, T = 8, B = H - 20;
      var n = 0;
      st.series.forEach(function (s) { n = Math.max(n, s.values.length); });
      if (!n) { ctx.fillStyle = p.dim; ctx.font = font(12); ctx.textAlign = 'center'; ctx.fillText('暂无数据', W / 2, H / 2); return; }
      var lo = Infinity, hi = -Infinity;
      st.series.forEach(function (s) { s.values.forEach(function (v) { if (v != null && isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); });
      if (!isFinite(lo)) { lo = 0; hi = 1; }
      if (o.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
      if (hi === lo) { hi += 1; lo -= 1; }
      var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
      if (o.min != null && lo < o.min) lo = o.min;
      if (o.max != null && hi > o.max) hi = o.max;
      if (hi === lo) { hi += 1; lo -= 1; }
      var y = function (v) { return T + (hi - v) / (hi - lo) * (B - T); };
      var x = function (i) { return L + (n <= 1 ? (R - L) / 2 : i / (n - 1) * (R - L)); };
      ctx.font = font(9.5); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (var k = 0; k <= 4; k++) {
        var vv = lo + (hi - lo) * k / 4, yy = Math.round(y(vv)) + 0.5;
        ctx.strokeStyle = p.grid; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke();
        ctx.fillStyle = p.dim;
        var txt = o.yFormat ? o.yFormat(vv) : (Math.abs(vv) >= 1e4 ? (vv / 1e4).toFixed(1) + '万' : vv.toFixed(0));
        ctx.fillText(txt, W - 5, yy);
      }
      if (o.zero && lo < 0 && hi > 0) {
        ctx.strokeStyle = p.gridStrong; ctx.beginPath(); ctx.moveTo(L, Math.round(y(0)) + 0.5); ctx.lineTo(R, Math.round(y(0)) + 0.5); ctx.stroke();
      }
      st.bands.forEach(function (band) {
        var y1 = y(band.to), y2 = y(band.from);
        ctx.fillStyle = band.color; ctx.fillRect(L, Math.min(y1, y2), R - L, Math.abs(y2 - y1));
      });
      st.series.forEach(function (s) {
        if (s.area) {
          var grd = ctx.createLinearGradient(0, T, 0, B);
          grd.addColorStop(0, s.color + '33'); grd.addColorStop(1, s.color + '00');
          ctx.fillStyle = grd; ctx.beginPath();
          var first = true;
          for (var i = 0; i < s.values.length; i++) { if (s.values[i] == null) continue; if (first) { ctx.moveTo(x(i), y(s.values[i])); first = false; } else ctx.lineTo(x(i), y(s.values[i])); }
          if (!first) {
            ctx.lineTo(x(s.values.length - 1), y(0)); ctx.lineTo(x(0), y(0)); ctx.closePath(); ctx.fill();
          }
        }
        ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 1.4; ctx.setLineDash(s.dash || []);
        ctx.beginPath();
        var on = false;
        for (var j = 0; j < s.values.length; j++) {
          if (s.values[j] == null) { on = false; continue; }
          if (!on) { ctx.moveTo(x(j), y(s.values[j])); on = true; } else ctx.lineTo(x(j), y(s.values[j]));
        }
        ctx.stroke(); ctx.setLineDash([]);
        if (s.dots) s.values.forEach(function (v, i) { if (v == null) return; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(x(i), y(v), 2, 0, 7); ctx.fill(); });
      });
      st.markers.forEach(function (m) {
        var mx = x(m.i), my = y(m.value);
        ctx.fillStyle = m.color || p.cyan; ctx.beginPath(); ctx.arc(mx, my, 3, 0, 7); ctx.fill();
        if (m.text) { ctx.font = font(9.5); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText(m.text, mx + 5, my - 4); }
      });
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = p.dim;
      var step = Math.max(1, Math.ceil(n / 6));
      for (var q = 0; q < n; q += step) {
        var lb = st.labels[q] != null ? String(st.labels[q]) : String(q);
        var first = q === 0, last = q + step >= n;
        ctx.textAlign = first ? 'left' : (last ? 'right' : 'center');
        ctx.fillText(lb, first ? L : (last ? R : x(q)), B + 4);
      }
      if (st.hover != null) {
        var i2 = clamp(st.hover, 0, n - 1);
        ctx.strokeStyle = p.gridStrong; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x(i2), T); ctx.lineTo(x(i2), B); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    b.canvas.addEventListener('pointermove', function (e) {
      var pt = pos(b, e);
      var L = 8, R = b.W - 54, n = 0;
      st.series.forEach(function (s) { n = Math.max(n, s.values.length); });
      if (!n) return;
      var i = clamp(Math.round((pt.x - L) / (R - L) * (n - 1)), 0, n - 1);
      st.hover = i; draw();
      var html = st.labels && st.labels[i] != null ? '<div><b>' + st.labels[i] + '</b></div>' : '';
      st.series.forEach(function (s) {
        if (s.values[i] == null) return;
        html += '<div><span style="color:' + s.color + '">■</span> ' + s.name + ' <b>' + (s.fmt ? s.fmt(s.values[i]) : Math.round(s.values[i]).toLocaleString('zh-CN')) + '</b></div>';
      });
      b.tipAt(html, pt.x, pt.y);
    });
    b.canvas.addEventListener('pointerleave', function () { st.hover = null; b.hideTip(); draw(); });
    b.redraw = draw;
    if (options && options.series) setData(options);
    return { setData: setData, resize: function () { b.resize(); }, destroy: b.destroy, redraw: draw };
  }

  /* =========================================================
   *  Bars
   * ========================================================= */
  function bars(host, options) {
    var o = Object.assign({ label: '柱状图', yFormat: null, valueLabels: false, color: null }, options || {});
    var b = base(host, o);
    var st = { labels: [], values: [], colors: [], hover: null };
    function setData(d) {
      if (d.labels) st.labels = d.labels;
      if (d.values) st.values = d.values;
      if (d.colors) st.colors = d.colors;
      draw();
    }
    function draw() {
      var p = palette(), ctx = b.ctx, W = b.W, H = b.H;
      ctx.clearRect(0, 0, W, H);
      var L = 8, R = W - 50, T = 22, B = H - 20;
      var n = st.values.length;
      if (!n) { ctx.fillStyle = p.dim; ctx.font = font(12); ctx.textAlign = 'center'; ctx.fillText('暂无数据', W / 2, H / 2); return; }
      var lo = Math.min(0, Math.min.apply(null, st.values));
      var hi = Math.max(0, Math.max.apply(null, st.values));
      if (hi === lo) hi = lo + 1;
      var y = function (v) { return T + (hi - v) / (hi - lo) * (B - T); };
      ctx.font = font(9.5); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (var k = 0; k <= 4; k++) {
        var vv = lo + (hi - lo) * k / 4, yy = Math.round(y(vv)) + 0.5;
        ctx.strokeStyle = p.grid; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke();
        ctx.fillStyle = p.dim;
        ctx.fillText(o.yFormat ? o.yFormat(vv) : (Math.abs(vv) >= 1e4 ? (vv / 1e4).toFixed(1) + '万' : vv.toFixed(0)), W - 5, yy);
      }
      var slot = (R - L) / n, bw = Math.min(slot, 96);
      var x0 = L + ((R - L) - bw * n) / 2;
      st.values.forEach(function (v, i) {
        var bx = x0 + i * bw + bw / 2;
        var barW = Math.min(bw * 0.58, 48);
        var y0 = y(0), y1 = y(v);
        ctx.fillStyle = st.colors[i] || o.color || (v >= 0 ? p.cyan : p.red);
        ctx.globalAlpha = st.hover === i ? 1 : 0.82;
        ctx.fillRect(bx - barW / 2, Math.min(y0, y1), Math.max(1, barW), Math.max(1, Math.abs(y1 - y0)));
        ctx.globalAlpha = 1;
        if (o.valueLabels && bw > 18) {
          ctx.font = font(8.5); ctx.fillStyle = p.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          var vt = o.valueFormat ? o.valueFormat(v) : (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('zh-CN') : (Number.isInteger(v) ? String(v) : v.toFixed(2)));
          ctx.fillText(vt, bx, Math.max(T + 9, Math.min(y0, y1) - 3));
        }
      });
      ctx.fillStyle = p.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = font(9);
      var step = Math.max(1, Math.ceil(n / 7));
      for (var q = 0; q < n; q += step) ctx.fillText(st.labels[q] != null ? st.labels[q] : q, x0 + q * bw + bw / 2, B + 4);
      if (st.hover != null && st.hover < n) {
        ctx.strokeStyle = p.gridStrong; ctx.beginPath(); ctx.moveTo(x0 + st.hover * bw, T); ctx.lineTo(x0 + st.hover * bw, B); ctx.stroke();
      }
    }
    b.canvas.addEventListener('pointermove', function (e) {
      var pt = pos(b, e), n = st.values.length;
      if (!n) return;
      var slot = (b.W - 58) / n, bw = Math.min(slot, 96);
      var x0 = 8 + ((b.W - 58) - bw * n) / 2;
      var i = clamp(Math.floor((pt.x - x0) / bw), 0, n - 1);
      st.hover = i; draw();
      b.tipAt('<b>' + (st.labels[i] != null ? st.labels[i] : i) + '</b><br>' + (o.yFormat ? o.yFormat(st.values[i]) : st.values[i]), pt.x, pt.y);
    });
    b.canvas.addEventListener('pointerleave', function () { st.hover = null; b.hideTip(); draw(); });
    b.redraw = draw;
    if (options && options.values) setData(options);
    return { setData: setData, resize: function () { b.resize(); }, destroy: b.destroy, redraw: draw };
  }

  /* =========================================================
   *  Donut
   * ========================================================= */
  function donut(host, options) {
    var o = Object.assign({ label: '占比图', center: null }, options || {});
    var b = base(host, o);
    var st = { segments: [], hover: -1, center: o.center || null };
    function setData(d) { st.segments = d.segments || []; if (d.center !== undefined) st.center = d.center; draw(); }
    function draw() {
      var p = palette(), ctx = b.ctx, W = b.W, H = b.H;
      ctx.clearRect(0, 0, W, H);
      var segs = st.segments, total = segs.reduce(function (s, x) { return s + Math.max(0, x.value); }, 0);
      if (!total) { ctx.fillStyle = p.dim; ctx.font = font(12); ctx.textAlign = 'center'; ctx.fillText('暂无数据', W / 2, H / 2); return; }
      var wide = W > 360;
      var cx = wide ? W * 0.28 : W / 2, cy = wide ? H / 2 : H * 0.42;
      var rad = Math.min(wide ? W * 0.21 : H * 0.3, H * 0.3, 118);
      var inner = rad * 0.62;
      var start = -Math.PI / 2;
      segs.forEach(function (s, i) {
        var ang = Math.max(0, s.value) / total * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, st.hover === i ? rad + 3 : rad, start, start + ang);
        ctx.arc(cx, cy, inner, start + ang, start, true);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.globalAlpha = st.hover === -1 || st.hover === i ? 1 : 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
        start += ang;
      });
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = p.text; ctx.font = font(16, 600);
      ctx.fillText(st.center ? st.center.value : '', cx, cy - 6);
      ctx.fillStyle = p.dim; ctx.font = font(9);
      ctx.fillText(st.center ? st.center.label : '', cx, cy + 14);
      var lx = wide ? W * 0.52 : 10;
      var rowH = wide ? 34 : 22;
      var ly = wide ? Math.max(26, cy - (segs.length - 1) * rowH / 2) : H * 0.78;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = font(10);
      segs.forEach(function (s, i) {
        if (!wide && i > 3) return;
        var yy = ly + i * rowH;
        ctx.fillStyle = s.color; ctx.fillRect(lx, yy - 4, 9, 9);
        ctx.fillStyle = p.text;
        var label = s.label + ' ' + (s.value / total * 100).toFixed(1) + '%';
        ctx.fillText(label, lx + 15, yy);
        if (wide) {
          ctx.fillStyle = p.dim; ctx.font = font(10);
          ctx.fillText(s.display || '', lx + 15, yy + 13);
          ctx.font = font(10);
        }
      });
      b._segs = { cx: cx, cy: cy, rad: rad, inner: inner, total: total };
    }
    b.canvas.addEventListener('pointermove', function (e) {
      if (!b._segs) return;
      var pt = pos(b, e), s = b._segs;
      var dx = pt.x - s.cx, dy = pt.y - s.cy, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < s.inner || dist > s.rad + 4) { if (st.hover !== -1) { st.hover = -1; draw(); } b.hideTip(); return; }
      var ang = Math.atan2(dy, dx) + Math.PI / 2;
      if (ang < 0) ang += Math.PI * 2;
      var acc = 0, found = -1;
      st.segments.forEach(function (seg, i) {
        var a = Math.max(0, seg.value) / s.total * Math.PI * 2;
        if (ang >= acc && ang < acc + a) found = i;
        acc += a;
      });
      if (found !== st.hover) { st.hover = found; draw(); }
      if (found >= 0) {
        var seg = st.segments[found];
        b.tipAt('<b>' + seg.label + '</b><br>' + (seg.display || seg.value) + '<br>' + (seg.value / s.total * 100).toFixed(1) + '%', pt.x, pt.y);
      }
    });
    b.canvas.addEventListener('pointerleave', function () { st.hover = -1; b.hideTip(); draw(); });
    b.redraw = draw;
    if (options && options.segments) setData(options);
    return { setData: setData, setCenter: function (c) { st.center = c; draw(); }, resize: function () { b.resize(); }, destroy: b.destroy, redraw: draw };
  }

  /* =========================================================
   *  Histogram helper
   * ========================================================= */
  function histogram(host, options) {
    var o = Object.assign({ bins: 24, color: null }, options || {});
    var values = options.values || [];
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    if (hi === lo) { hi = lo + 1; }
    var step = (hi - lo) / o.bins;
    var counts = new Array(o.bins).fill(0);
    values.forEach(function (v) {
      var i = clamp(Math.floor((v - lo) / step), 0, o.bins - 1);
      counts[i]++;
    });
    var labels = counts.map(function (_, i) { return shortAxis(lo + i * step); });
    return bars(host, {
      labels: labels, values: counts, color: o.color, valueLabels: false,
      yFormat: function (v) { return String(Math.round(v)); }, label: o.label || '分布直方图'
    });
  }
  function shortAxis(v) {
    if (Math.abs(v) >= 1e4) return (v / 1e4).toFixed(0) + '万';
    if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(0) + 'k';
    return v.toFixed(0);
  }

  SM.charts = {
    kline: kline, lines: lines, bars: bars, donut: donut, histogram: histogram,
    palette: palette, colorsFor: colorsFor
  };
})();
