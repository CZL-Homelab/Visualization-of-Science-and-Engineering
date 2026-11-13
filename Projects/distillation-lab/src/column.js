/* Distillation Lab — animated column schematic (Canvas 2D).
 *
 * Draws a tray column with condenser, reflux drum, reboiler (or batch still
 * pot), feed and product streams. Liquid on each tray is coloured by its
 * composition (orange = heavy-rich, cyan = light-rich). Bubbles rise with the
 * vapour flow, droplets fall in the downcomers. The animation is a schematic,
 * not a hydraulic simulation; it pauses off-screen and under reduced motion.
 */
(function () {
  'use strict';
  var DL = window.DL = window.DL || {};

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var colors = null;
  function cssv(n, fb) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || fb; }
  function readColors() {
    colors = {
      panel: cssv('--panel', '#181a1e'), panel2: cssv('--panel-2', '#1e2126'), panel3: cssv('--panel-3', '#23272d'),
      line: cssv('--line', '#2d3238'), text: cssv('--text', '#eceef1'), muted: cssv('--muted', '#9aa1a9'), dim: cssv('--dim', '#6e757d'),
      cyan: cssv('--cyan', '#5bc8be'), orange: cssv('--orange', '#e0955a'), blue: cssv('--blue', '#7aa2d8'),
      red: cssv('--red', '#e05a5f'), yellow: cssv('--yellow', '#d9c069'), violet: cssv('--violet', '#b07cd8'),
      steel: cssv('--steel', '#3a4048')
    };
  }
  window.addEventListener('distl:theme', function () { readColors(); instances.forEach(function (i) { i.redraw(); }); });

  function hexRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    var A = hexRgb(a), B = hexRgb(b);
    t = Math.max(0, Math.min(1, t));
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }
  function alpha(hex, a) { var c = hexRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function compColor(x) { return mix(colors.orange, colors.cyan, x); }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function arrow(ctx, x1, y1, x2, y2, col, w) {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w || 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    var a = Math.atan2(y2 - y1, x2 - x1), s = 6 + (w || 2);
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45));
    ctx.lineTo(x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45));
    ctx.closePath(); ctx.fill();
  }
  function font(size, weight, mono) {
    return (weight || 400) + ' ' + size + 'px ' + (mono === false ? '"Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif' : 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace');
  }

  var instances = [];

  function create(host, opts) {
    opts = opts || {};
    if (!colors) readColors();
    host.classList.add('column-host');
    host.innerHTML = '';
    if (opts.label) { host.setAttribute('role', 'img'); host.setAttribute('aria-label', opts.label); }
    var canvas = document.createElement('canvas');
    host.appendChild(canvas);
    var tip = document.createElement('div');
    tip.className = 'chart-tip';
    host.appendChild(tip);
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var st = { mode: 'continuous', stages: [] };
    var geo = null;
    var bubbles = [], drops = [];
    var hoverIdx = null, highlightIdx = null;
    var visible = true, playing = opts.autoplay !== false, raf = 0, last = 0;

    function resize() {
      var r = host.getBoundingClientRect();
      W = Math.max(160, Math.round(r.width)); H = Math.max(240, Math.round(r.height));
      dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
      draw();
    }

    function trayStages() {
      // Non-reboiler stages; in batch mode the pot is the last stage too.
      var s = st.stages || [];
      return s.length > 1 ? s.slice(0, s.length - 1) : [];
    }

    function layout() {
      var compact = opts.compact || W < 300;
      var topH = Math.max(58, H * 0.15), botH = Math.max(56, H * (st.mode === 'batch' ? 0.2 : 0.14));
      var cw = Math.max(54, Math.min(128, W * (compact ? 0.3 : 0.24)));
      var cx = W * (opts.cxFrac || 0.44);
      var y0 = topH + 8, y1 = H - botH - 6;
      var trays = trayStages();
      var nT = trays.length;
      var nDraw = Math.min(nT, opts.maxTrays || 24);
      var map = [];
      for (var i = 0; i < nDraw; i++) map.push(nDraw === 1 ? 0 : Math.round(i * (nT - 1) / (nDraw - 1)));
      geo = { cx: cx, cw: cw, x0: cx - cw / 2, x1: cx + cw / 2, y0: y0, y1: y1, topH: topH, botH: botH, nDraw: nDraw, map: map, nT: nT,
              sp: nDraw ? (y1 - y0) / nDraw : (y1 - y0), compact: compact };
      geo.dc = Math.max(10, cw * 0.17);
      seedParticles();
    }

    function trayY(i) { return geo.y0 + geo.sp * (i + 1) - Math.min(8, geo.sp * 0.18); }
    function feedDrawIndex() {
      if (!st.feedStage || !geo.nDraw) return null;
      var target = st.feedStage - 1, best = 0, bd = 1e9;
      geo.map.forEach(function (s, i) { var d = Math.abs(s - target); if (d < bd) { bd = d; best = i; } });
      return best;
    }

    function seedParticles() {
      bubbles = []; drops = [];
      if (!geo) return;
      var vScale = Math.max(0.4, Math.min(2.4, (st.V || 1.5) / Math.max(0.2, st.Dref || st.D || 0.5) / 2.2));
      var nb = Math.round(Math.max(14, Math.min(90, geo.nDraw * 3.2 * vScale)));
      for (var i = 0; i < nb; i++) bubbles.push(newBubble(true));
      var nd = Math.round(Math.max(8, Math.min(60, geo.nDraw * 2)));
      for (var k = 0; k < nd; k++) drops.push(newDrop(true));
    }
    function newBubble(anywhere) {
      var y = anywhere ? geo.y0 + Math.random() * (geo.y1 - geo.y0) : geo.y1 + 4;
      return { x: geo.x0 + geo.dc + 4 + Math.random() * (geo.cw - 2 * geo.dc - 8), y: y, r: 1.2 + Math.random() * 2.2, v: 18 + Math.random() * 22, ph: Math.random() * 6.28 };
    }
    function newDrop(anywhere) {
      var i = Math.floor(Math.random() * Math.max(1, geo.nDraw));
      return { tray: i, t: anywhere ? Math.random() : 0, v: 0.35 + Math.random() * 0.4 };
    }

    function stageAtY(py) {
      if (!geo || !geo.nDraw) return null;
      var i = Math.floor((py - geo.y0) / geo.sp);
      if (i < 0 || i >= geo.nDraw) return null;
      return geo.map[i];
    }
    function compAtY(py, useVapor) {
      var trays = trayStages();
      if (!trays.length) return 0.5;
      var t = (py - geo.y0) / (geo.y1 - geo.y0);
      var idx = Math.max(0, Math.min(trays.length - 1, t * (trays.length - 1)));
      var a = trays[Math.floor(idx)], b = trays[Math.ceil(idx)], f = idx - Math.floor(idx);
      var va = useVapor ? a.y : a.x, vb = useVapor ? b.y : b.x;
      return va + (vb - va) * f;
    }

    function draw() {
      if (!geo) return;
      var c = colors;
      ctx.clearRect(0, 0, W, H);
      var trays = trayStages();
      var g = geo;

      /* ---------- condenser + reflux drum ---------- */
      var condW = Math.min(g.cw * 1.25, W * 0.34), condH = Math.max(22, g.topH * 0.36);
      var condX = g.cx - condW / 2 + g.cw * 0.25, condY = 8;
      var drumW = Math.min(g.cw * 1.0, W * 0.24), drumH = Math.max(14, g.topH * 0.2);
      var drumX = Math.min(W - drumW - 8, g.x1 + 10), drumY = condY + condH + Math.max(10, g.topH * 0.12);
      // vapour line column top → condenser
      ctx.strokeStyle = alpha(c.orange, 0.75); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(g.cx, g.y0 - 2); ctx.lineTo(g.cx, condY + condH / 2); ctx.lineTo(condX + 4, condY + condH / 2); ctx.stroke();
      // condenser shell
      rr(ctx, condX, condY, condW, condH, condH / 2);
      ctx.fillStyle = c.panel3; ctx.fill(); ctx.strokeStyle = c.line; ctx.lineWidth = 1.2; ctx.stroke();
      // coolant coil
      ctx.strokeStyle = alpha(c.blue, 0.9); ctx.lineWidth = 1.5; ctx.beginPath();
      for (var k = 0; k <= 24; k++) {
        var px = condX + 8 + (condW - 16) * k / 24, py = condY + condH / 2 + Math.sin(k * 1.3) * condH * 0.22;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = c.muted; ctx.font = font(9.5, 500, false); ctx.textAlign = 'left';
      if (!g.compact) ctx.fillText('冷凝器', condX + condW + 6, condY + condH / 2 + 3);
      // condenser → drum
      ctx.strokeStyle = alpha(c.cyan, 0.8); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(condX + condW - 10, condY + condH); ctx.lineTo(condX + condW - 10, drumY + drumH / 2); ctx.lineTo(drumX + 2, drumY + drumH / 2); ctx.stroke();
      rr(ctx, drumX, drumY, drumW, drumH, drumH / 2);
      ctx.fillStyle = c.panel3; ctx.fill(); ctx.strokeStyle = c.line; ctx.stroke();
      rr(ctx, drumX + 3, drumY + drumH * 0.45, drumW - 6, drumH * 0.5, drumH * 0.25);
      ctx.fillStyle = alpha(hexOf(compColor(st.xD || 0.9)), 0.85); ctx.fill();
      // reflux back to top tray
      var refluxY = g.y0 + 6;
      ctx.strokeStyle = alpha(c.cyan, 0.75); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(drumX + 8, drumY + drumH); ctx.lineTo(drumX + 8, refluxY); ctx.lineTo(g.x1 - 2, refluxY); ctx.stroke();
      // distillate
      if (st.mode === 'batch') drawReceiver(drumX + drumW, drumY + drumH / 2);
      else {
        var dx2 = Math.min(W - 6, drumX + drumW + 28);
        arrow(ctx, drumX + drumW, drumY + drumH / 2, dx2, drumY + drumH / 2, c.cyan, 2);
        ctx.fillStyle = c.cyan; ctx.font = font(10, 600); ctx.textAlign = 'right';
        var dlabel = 'D  xD ' + (st.xD != null ? st.xD.toFixed(3) : '—');
        ctx.fillText(dlabel, W - 6, drumY + drumH + 15);
      }
      if (!g.compact && st.R != null && isFinite(st.R)) {
        ctx.fillStyle = c.dim; ctx.font = font(9.5); ctx.textAlign = 'left';
        ctx.fillText('回流 R = ' + st.R.toFixed(2), Math.min(drumX + 12, W - 90), refluxY + 13);
      }

      /* ---------- column shell ---------- */
      rr(ctx, g.x0, g.y0 - 4, g.cw, g.y1 - g.y0 + 8, 12);
      ctx.fillStyle = c.panel2; ctx.fill();
      ctx.strokeStyle = c.line; ctx.lineWidth = 1.5; ctx.stroke();

      if (!trays.length) {
        ctx.fillStyle = c.dim; ctx.font = font(11, 500, false); ctx.textAlign = 'center';
        var msg = st.message || (st.pinched ? '夹紧：需要无穷多级' : '无可行设计');
        wrapText(msg, g.cx, (g.y0 + g.y1) / 2, g.cw - 10, 15);
      }

      // trays
      for (var i = 0; i < g.nDraw; i++) {
        var s = trays[g.map[i]];
        var y = trayY(i);
        var dcRight = i % 2 === 0;
        var px0 = dcRight ? g.x0 + 3 : g.x0 + g.dc;
        var px1 = dcRight ? g.x1 - g.dc : g.x1 - 3;
        var lh = Math.max(2, Math.min(7, g.sp * 0.28));
        // liquid on tray (froth)
        ctx.fillStyle = alpha(hexOf(compColor(s.x)), 0.78);
        ctx.fillRect(px0, y - lh, px1 - px0, lh);
        // plate
        ctx.strokeStyle = c.muted; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(px0, y); ctx.lineTo(px1, y); ctx.stroke();
        // weir + downcomer apron
        var wx = dcRight ? px1 : px0;
        ctx.beginPath(); ctx.moveTo(wx, y - lh - 1); ctx.lineTo(wx, y + g.sp * 0.62); ctx.stroke();
        // downcomer liquid
        ctx.fillStyle = alpha(hexOf(compColor(s.x)), 0.35);
        var dxa = dcRight ? px1 : g.x0 + 3, dxb = dcRight ? g.x1 - 3 : px0;
        ctx.fillRect(Math.min(dxa, dxb), y + g.sp * 0.35, Math.abs(dxb - dxa), g.sp * 0.27);
        // highlight
        var stageNo = g.map[i] + 1;
        if (highlightIdx === stageNo || hoverIdx === stageNo) {
          ctx.strokeStyle = c.yellow; ctx.lineWidth = 1.5;
          ctx.strokeRect(g.x0 + 1, y - g.sp + 4, g.cw - 2, g.sp - 2);
        }
        // labels
        var isFeed = st.mode !== 'batch' && i === feedDrawIndex();
        if (!g.compact && (g.nDraw <= 14 || i % 2 === 0 || stageNo === st.feedStage)) {
          ctx.textAlign = 'right'; ctx.font = font(9); ctx.fillStyle = c.dim;
          var lbl = isFinite(s.T) ? s.T.toFixed(1) + '°' : '';
          if (!isFeed) ctx.fillText(lbl, g.x0 - 6, y - 1);
          ctx.textAlign = 'left'; ctx.fillStyle = c.muted;
          ctx.fillText(String(stageNo), g.x1 + 5, y - 1);
        }
      }
      if (!g.compact && trays.length) {
        ctx.font = font(8.5); ctx.fillStyle = c.dim; ctx.textAlign = 'right';
        ctx.fillText('T', g.x0 - 6, g.y0 - 8);
        ctx.textAlign = 'left'; ctx.fillText('级', g.x1 + 5, g.y0 - 8);
        if (g.nT > g.nDraw) { ctx.textAlign = 'center'; ctx.fillText('（示意：' + g.nDraw + ' 块代表 ' + g.nT + ' 级）', g.cx, g.y1 + 18 > H - 4 ? H - 4 : g.y1 + 2); }
      }

      // particles
      ctx.save();
      ctx.beginPath(); ctx.rect(g.x0 + 2, g.y0, g.cw - 4, g.y1 - g.y0); ctx.clip();
      if (trays.length) {
        bubbles.forEach(function (b) {
          ctx.fillStyle = alpha(hexOf(compColor(compAtY(b.y, true))), 0.7);
          ctx.beginPath(); ctx.arc(b.x + Math.sin(b.ph) * 1.5, b.y, b.r, 0, 6.283); ctx.fill();
        });
        drops.forEach(function (d) {
          var i2 = d.tray, y = trayY(i2), dcRight = i2 % 2 === 0;
          var x = dcRight ? g.x1 - g.dc / 2 - 1 : g.x0 + g.dc / 2 + 1;
          var yy = y + d.t * g.sp * 0.95;
          var s2 = trays[g.map[Math.min(i2, g.nDraw - 1)]];
          ctx.fillStyle = alpha(hexOf(compColor(s2 ? s2.x : 0.5)), 0.9);
          ctx.beginPath(); ctx.ellipse(x, yy, 1.6, 2.6, 0, 0, 6.283); ctx.fill();
        });
      }
      ctx.restore();

      /* ---------- feed ---------- */
      if (st.mode !== 'batch') {
        var fi = feedDrawIndex();
        if (fi != null) {
          var fy = trayY(fi) - g.sp * 0.45;
          var fx0 = Math.max(4, g.x0 - (g.compact ? 34 : 80));
          arrow(ctx, fx0, fy, g.x0 - 1, fy, c.yellow, 2.4);
          ctx.fillStyle = c.yellow; ctx.font = font(10, 600); ctx.textAlign = 'left';
          ctx.fillText('F', fx0, fy - 6);
          if (!g.compact) {
            ctx.font = font(9); ctx.fillStyle = c.muted;
            ctx.fillText('xF ' + (st.xF != null ? st.xF.toFixed(2) : '') + (st.q != null ? ' q ' + st.q.toFixed(1) : ''), fx0, fy + 13);
          }
        }
      }

      /* ---------- bottom: reboiler or still pot ---------- */
      if (st.mode === 'batch') drawPot(); else drawReboiler();
    }

    function drawReboiler() {
      var c = colors, g = geo;
      var rw = Math.min(g.cw * 1.35, W * 0.4), rh = Math.max(22, g.botH * 0.42);
      var rx = g.cx - rw / 2 + g.cw * 0.18, ry = g.y1 + Math.max(14, g.botH * 0.3);
      // liquid from column bottom to reboiler
      var xB = st.xW != null ? st.xW : 0.05;
      ctx.strokeStyle = alpha(hexOf(compColor(xB)), 0.85); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(g.x0 + 12, g.y1 + 4); ctx.lineTo(g.x0 + 12, ry + rh / 2); ctx.lineTo(rx + 2, ry + rh / 2); ctx.stroke();
      // vapour back
      ctx.strokeStyle = alpha(c.orange, 0.75); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(rx + rw * 0.7, ry); ctx.lineTo(rx + rw * 0.7, g.y1 - 6); ctx.stroke();
      rr(ctx, rx, ry, rw, rh, rh / 2);
      ctx.fillStyle = c.panel3; ctx.fill(); ctx.strokeStyle = c.line; ctx.lineWidth = 1.2; ctx.stroke();
      rr(ctx, rx + 3, ry + rh * 0.42, rw - 6, rh * 0.52, rh * 0.25);
      ctx.fillStyle = alpha(hexOf(compColor(xB)), 0.8); ctx.fill();
      // heat
      ctx.strokeStyle = c.red; ctx.lineWidth = 1.4;
      for (var k = 0; k < 4; k++) {
        var hx = rx + rw * (0.2 + 0.18 * k);
        ctx.beginPath();
        for (var j = 0; j <= 8; j++) { var yy = ry + rh + 3 + j * 1.6; var xx = hx + Math.sin(j * 1.2 + phase * 3) * 2; if (j === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
        ctx.stroke();
      }
      if (!g.compact) { ctx.fillStyle = c.muted; ctx.font = font(9.5, 500, false); ctx.textAlign = 'left'; ctx.fillText('再沸器', rx + rw + 6, ry + rh / 2 - 2); }
      // bottoms
      var bx2 = Math.min(W - 6, rx + rw + (g.compact ? 18 : 30));
      arrow(ctx, rx + rw, ry + rh * 0.75, bx2, ry + rh * 0.75, hexOf(compColor(xB)), 2);
      ctx.fillStyle = c.orange; ctx.font = font(10, 600); ctx.textAlign = 'right';
      ctx.fillText('W  xW ' + (st.xW != null ? st.xW.toFixed(3) : '—'), W - 6, Math.min(H - 4, ry + rh + 16));
    }

    function drawPot() {
      var c = colors, g = geo;
      var pw = Math.min(g.cw * 1.9, W * 0.5), ph = Math.max(36, g.botH * 0.7);
      var px = g.cx - pw / 2, py = g.y1 + 8;
      ctx.beginPath();
      ctx.moveTo(px, py); ctx.lineTo(px + pw, py);
      ctx.quadraticCurveTo(px + pw, py + ph, g.cx, py + ph);
      ctx.quadraticCurveTo(px, py + ph, px, py);
      ctx.fillStyle = c.panel3; ctx.fill(); ctx.strokeStyle = c.line; ctx.lineWidth = 1.4; ctx.stroke();
      var lvl = Math.max(0.04, Math.min(1, st.potLevel == null ? 1 : st.potLevel));
      ctx.save(); ctx.clip();
      ctx.fillStyle = alpha(hexOf(compColor(st.xW != null ? st.xW : 0.5)), 0.85);
      ctx.fillRect(px, py + ph * (1 - lvl * 0.92), pw, ph);
      ctx.restore();
      ctx.strokeStyle = c.red; ctx.lineWidth = 1.4;
      for (var k = 0; k < 5; k++) {
        var hx = px + pw * (0.22 + 0.14 * k);
        ctx.beginPath();
        for (var j = 0; j <= 6; j++) { var yy = py + ph + 2 + j * 1.6; var xx = hx + Math.sin(j * 1.2 + phase * 3) * 2; if (j === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
        ctx.stroke();
      }
      ctx.fillStyle = c.muted; ctx.font = font(9.5, 500, false); ctx.textAlign = 'left';
      if (!g.compact) ctx.fillText('釜 xW ' + (st.xW != null ? st.xW.toFixed(3) : ''), px + pw + 6, py + ph * 0.55);
    }

    function drawReceiver(x, y) {
      var c = colors;
      var rw = 26, rh = Math.min(110, H * 0.3);
      var rx = Math.min(W - rw - 8, x + 22), ry = y - 6;
      arrow(ctx, x, y, rx + rw / 2 - 2, y, c.cyan, 1.8);
      ctx.strokeStyle = c.line; ctx.lineWidth = 1.2;
      ctx.strokeRect(rx, ry + 8, rw, rh);
      var cuts = st.receiver || [];
      var total = st.receiverMax || 1, yb = ry + 8 + rh;
      cuts.forEach(function (cut) {
        var h = rh * cut.amount / total;
        ctx.fillStyle = alpha(hexOf(compColor(cut.x)), 0.85);
        ctx.fillRect(rx + 1, yb - h, rw - 2, h);
        yb -= h;
      });
      ctx.fillStyle = c.muted; ctx.font = font(9, 500, false); ctx.textAlign = 'center';
      ctx.fillText('接收器', rx + rw / 2, ry + rh + 22);
    }

    function wrapText(text, x, y, maxW, lh) {
      var chars = String(text).split(''), line = '', lines = [];
      chars.forEach(function (ch) { var t = line + ch; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = ch; } else line = t; });
      if (line) lines.push(line);
      lines.forEach(function (l, i) { ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * lh); });
    }
    function hexOf(rgb) {
      if (rgb[0] === '#') return rgb;
      var m = rgb.match(/\d+/g);
      return '#' + m.slice(0, 3).map(function (v) { return ('0' + Number(v).toString(16)).slice(-2); }).join('');
    }

    var phase = 0;
    function step(dt) {
      if (!geo) return;
      phase += dt;
      var vk = Math.max(0.5, Math.min(2.2, (st.speed || 1)));
      var hScale = (geo.y1 - geo.y0) / 400;
      bubbles.forEach(function (b, i) {
        b.y -= b.v * dt * vk * Math.max(0.6, hScale);
        b.ph += dt * 6;
        if (b.y < geo.y0 - 4) bubbles[i] = newBubble(false);
      });
      drops.forEach(function (d, i) {
        d.t += d.v * dt * vk * 0.9;
        if (d.t > 1) { drops[i] = newDrop(false); drops[i].tray = (d.tray + 1) % Math.max(1, geo.nDraw); }
      });
    }

    function loop(ts) {
      raf = 0;
      if (!playing || !visible || document.hidden || reduceMotion) return;
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
      last = ts;
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf && playing && visible && !reduceMotion) { last = 0; raf = requestAnimationFrame(loop); } }

    canvas.addEventListener('pointermove', function (e) {
      if (!geo) return;
      var r = canvas.getBoundingClientRect();
      var px = e.clientX - r.left, py = e.clientY - r.top;
      var idx = (px > geo.x0 - 40 && px < geo.x1 + 30) ? stageAtY(py) : null;
      var trays = trayStages();
      if (idx == null || !trays[idx]) { tip.classList.remove('on'); if (hoverIdx != null) { hoverIdx = null; draw(); if (opts.onHover) opts.onHover(null); } return; }
      var s = trays[idx];
      if (hoverIdx !== idx + 1) { hoverIdx = idx + 1; draw(); if (opts.onHover) opts.onHover(hoverIdx); }
      tip.innerHTML = '<b>第 ' + (idx + 1) + ' 级</b>' + (idx + 1 === st.feedStage ? ' · 进料板' : '') +
        '<br>液相 x = ' + s.x.toFixed(3) + '<br>气相 y = ' + s.y.toFixed(3) + (isFinite(s.T) ? '<br>T = ' + s.T.toFixed(1) + ' °C' : '');
      tip.classList.add('on');
      var left = px + 14, top = py + 10;
      if (left + tip.offsetWidth > W - 4) left = px - tip.offsetWidth - 14;
      tip.style.left = left + 'px'; tip.style.top = Math.min(H - tip.offsetHeight - 4, top) + 'px';
    });
    canvas.addEventListener('pointerleave', function () { tip.classList.remove('on'); if (hoverIdx != null) { hoverIdx = null; draw(); if (opts.onHover) opts.onHover(null); } });

    var ro = new ResizeObserver(function () { resize(); });
    ro.observe(host);
    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; if (visible) kick(); });
      io.observe(host);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });

    var api = {
      set: function (state) {
        var prevN = st.stages ? st.stages.length : -1;
        st = Object.assign({ mode: 'continuous' }, state || {});
        if (!st.stages) st.stages = [];
        var changed = prevN !== st.stages.length;
        if (changed || !geo) layout(); else { geo.nT = trayStages().length; }
        draw();
        kick();
      },
      highlight: function (n) { highlightIdx = n; draw(); },
      play: function (on) { playing = on !== false; if (playing) kick(); },
      redraw: function () { draw(); },
      destroy: function () {
        ro.disconnect(); if (io) io.disconnect(); if (raf) cancelAnimationFrame(raf); raf = 0;
        var i = instances.indexOf(api); if (i >= 0) instances.splice(i, 1);
        host.innerHTML = '';
      }
    };
    instances.push(api);
    resize();
    setTimeout(resize, 40);
    return api;
  }

  DL.column = { create: create, mix: function (a, b, t) { if (!colors) readColors(); return mix(a, b, t); }, compColor: function (x) { if (!colors) readColors(); return compColor(x); } };
})();
