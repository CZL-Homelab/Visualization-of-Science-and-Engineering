/* Shared canvas renderer for the Engine Lab.
   One engine drawing used by every module; parts can be highlighted or
   dimmed. Instruments (timing strip, P-V diagram, lift curves, gears,
   multi-cylinder) live here too. Colors come from theme CSS variables. */
'use strict';

const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function fitCanvas(cv) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.width, h = cv.height;
  cv.width = w * dpr; cv.height = h * dpr;
  cv.getContext('2d').scale(dpr, dpr);
  cv._w = w; cv._h = h;
  return { w, h };
}

const PARTS = ['block', 'piston', 'conrod', 'crank', 'flywheel', 'valves', 'plug'];

function drawEngine(ctx, W, H, opts) {
  const { angle, highlight = null, flow = true, labels = true, diesel = false, spark = null, t = 0 } = opts;
  const a = wrap720(angle);
  const sparkAt = spark ?? (diesel ? 350 : SPARK_AT);
  const ink = cssVar('--text'), dim = cssVar('--dim'), line = cssVar('--line'), panel = cssVar('--panel');
  const cyan = cssVar('--cyan'), blue = cssVar('--blue'), orange = cssVar('--orange'), red = cssVar('--red');
  const al = part => highlight && highlight !== part ? 0.22 : 1;
  const set = part => { ctx.globalAlpha = al(part); };

  const pTop = pistonTop(a), gasH = pTop - GEO.DECK;
  const idx = strokeIndex(a);

  // cylinder walls + water jacket
  set('block');
  ctx.strokeStyle = ink; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(GEO.CX - GEO.BORE - 4, 60); ctx.lineTo(GEO.CX - GEO.BORE - 4, GEO.CRANK_Y - 120);
  ctx.moveTo(GEO.CX + GEO.BORE + 4, 60); ctx.lineTo(GEO.CX + GEO.BORE + 4, GEO.CRANK_Y - 120); ctx.stroke();
  ctx.fillStyle = dim; ctx.globalAlpha = al('block') * 0.35;
  for (let y = 90; y < GEO.CRANK_Y - 150; y += 22) { ctx.fillRect(GEO.CX - GEO.BORE - 16, y, 6, 10); ctx.fillRect(GEO.CX + GEO.BORE + 10, y, 6, 10); }
  ctx.globalAlpha = al('block');

  // head with intake (left) / exhaust (right) ports
  ctx.fillStyle = panel; ctx.strokeStyle = ink; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(GEO.CX - GEO.BORE - 46, 58, 120, GEO.DECK - 58, 10);
  ctx.roundRect(GEO.CX + 30, 58, 120, GEO.DECK - 58, 10);
  ctx.fill();
  ctx.fillStyle = cssVar('--bg');
  ctx.beginPath(); ctx.moveTo(GEO.CX - 110, 58); ctx.lineTo(GEO.CX - 14, GEO.DECK - 4); ctx.lineTo(GEO.CX - 44, GEO.DECK + 2); ctx.lineTo(GEO.CX - 132, 72); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(GEO.CX + 110, 58); ctx.lineTo(GEO.CX + 14, GEO.DECK - 4); ctx.lineTo(GEO.CX + 44, GEO.DECK + 2); ctx.lineTo(GEO.CX + 132, 72); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.stroke();

  // gas volume + combustion glow
  const cols = [blue, cyan, orange, dim];
  ctx.globalAlpha = al('block') * (0.28 + 0.35 * (gasH < 40 ? (1 - gasH / 40) : 0.25));
  ctx.fillStyle = cols[idx];
  ctx.fillRect(GEO.CX - GEO.BORE, GEO.DECK, GEO.BORE * 2, gasH);
  if (idx === 2) {
    const f = burnFraction(a, sparkAt);
    const g = ctx.createRadialGradient(GEO.CX, GEO.DECK + 8, 4, GEO.CX, GEO.DECK + 8, GEO.BORE + 30);
    g.addColorStop(0, 'rgba(255,200,90,' + (0.85 * clamp(f * 1.6, 0, 1) * al('block')) + ')');
    g.addColorStop(1, 'rgba(230,110,40,0)');
    ctx.fillStyle = g; ctx.fillRect(GEO.CX - GEO.BORE, GEO.DECK, GEO.BORE * 2, Math.min(gasH, GEO.BORE + 20));
  }
  ctx.globalAlpha = 1;

  // spark flash / diesel injector
  set('plug');
  const sf = diesel ? clamp(1 - Math.abs(a - sparkAt) / 14, 0, 1) : sparkFlash(a, sparkAt);
  if (sf > 0) { ctx.fillStyle = 'rgba(255,240,180,' + sf + ')'; ctx.beginPath(); ctx.arc(GEO.CX, GEO.DECK + 8, 7 + 10 * sf, 0, 7); ctx.fill(); }
  ctx.fillStyle = ink;
  if (diesel) { ctx.fillRect(GEO.CX - 4, 38, 8, 24); ctx.fillStyle = orange; ctx.fillRect(GEO.CX - 7, 32, 14, 7); }
  else { ctx.fillRect(GEO.CX - 5, 36, 10, 26); ctx.fillStyle = red; ctx.fillRect(GEO.CX - 8, 30, 16, 8); }
  ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(GEO.CX, 62); ctx.lineTo(GEO.CX, GEO.DECK + 2); ctx.stroke();

  // valves
  const il = intakeLift(a), el = exhaustLift(a);
  set('valves');
  function valve(x, lift, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x, 52); ctx.lineTo(x, GEO.DECK + lift - 6); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = dim; ctx.beginPath();
    for (let i = 0; i < 5; i++) { const y = 62 + i * 9 + lift * 0.55; ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y + 5); }
    ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x - 17, GEO.DECK + lift - 4, 34, 9, 4); ctx.fill();
  }
  valve(GEO.CX - 34, il, blue); valve(GEO.CX + 34, el, red);

  // flow chevrons
  if (flow && highlight !== 'flywheel') {
    function flowDots(sx, sy, ex, ey, color) {
      ctx.fillStyle = color;
      for (let i = 0; i < 3; i++) { const f = ((t * 1.1 + i / 3) % 1); ctx.globalAlpha = al('valves') * 0.65 * (1 - Math.abs(f - 0.55)); ctx.beginPath(); ctx.arc(sx + (ex - sx) * f, sy + (ey - sy) * f, 4, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    if (il > 3) flowDots(GEO.CX - 130, 58, GEO.CX - 34, GEO.DECK + il + 16, blue);
    if (el > 3) flowDots(GEO.CX + 34, GEO.DECK + el + 16, GEO.CX + 130, 58, dim);
  }

  // piston
  set('piston');
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.roundRect(GEO.CX - GEO.BORE + 3, pTop, (GEO.BORE - 3) * 2, GEO.PISTON_H, 6); ctx.fill();
  ctx.strokeStyle = panel; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(GEO.CX - GEO.BORE + 6, pTop + 8 + i * 7); ctx.lineTo(GEO.CX + GEO.BORE - 6, pTop + 8 + i * 7); ctx.stroke(); }
  const pinY = pTop + GEO.PISTON_H / 2;
  ctx.fillStyle = dim; ctx.beginPath(); ctx.arc(GEO.CX, pinY, 8, 0, 7); ctx.fill();

  // conrod
  const cp = crankPin(a);
  set('conrod');
  ctx.strokeStyle = dim; ctx.lineWidth = 15; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(GEO.CX, pinY); ctx.lineTo(cp.x, cp.y); ctx.stroke();
  ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(cp.x, cp.y, 11, 0, 7); ctx.fill();

  // crank web + counterweight
  set('crank');
  ctx.save(); ctx.translate(GEO.CX, GEO.CRANK_Y); ctx.rotate(a * D2R);
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.roundRect(-14, -GEO.R - 6, 28, GEO.R + 20, 8); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 52, Math.PI * 0.65, Math.PI * 1.35); ctx.arc(0, 0, 20, Math.PI * 1.35, Math.PI * 0.65, true); ctx.fill();
  ctx.fillStyle = cyan; ctx.beginPath(); ctx.arc(0, -GEO.R, 8, 0, 7); ctx.fill();
  ctx.restore();
  ctx.fillStyle = dim; ctx.beginPath(); ctx.arc(GEO.CX, GEO.CRANK_Y, 9, 0, 7); ctx.fill();

  // flywheel
  set('flywheel');
  ctx.strokeStyle = line; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(GEO.CX, GEO.CRANK_Y, 104, 0, 7); ctx.stroke();
  ctx.save(); ctx.translate(GEO.CX, GEO.CRANK_Y); ctx.rotate(a * D2R);
  ctx.fillStyle = orange; ctx.fillRect(-3, -112, 6, 14);
  ctx.globalAlpha = al('flywheel') * 0.35;
  ctx.strokeStyle = dim; ctx.lineWidth = 4;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(66 * Math.cos(i * Math.PI / 3), 66 * Math.sin(i * Math.PI / 3)); ctx.stroke(); }
  ctx.restore();
  ctx.globalAlpha = 1;

  if (labels && highlight === null) {
    ctx.fillStyle = dim; ctx.font = '12px system-ui';
    ctx.fillText(diesel ? '喷油嘴 Injector' : '火花塞 Spark plug', GEO.CX + 18, 26);
    ctx.fillText('进气门 Intake valve', GEO.CX - 185, 30);
    ctx.fillText('排气门 Exhaust valve', GEO.CX + 118, 30);
    ctx.fillText('活塞 Piston', GEO.CX + GEO.BORE + 18, pTop + 20);
    ctx.fillText('连杆 Conrod', GEO.CX + 30, (pinY + cp.y) / 2);
    ctx.fillText('曲轴/飞轮 Crank · Flywheel', GEO.CX + 112, GEO.CRANK_Y + 40);
  }
  ctx.fillStyle = ink; ctx.font = 'bold 14px ui-monospace,monospace';
  ctx.fillText('θ=' + Math.round(a) + '°', GEO.CX - 38, GEO.CRANK_Y + 150);
}

// ---------- timing strip (valve lift + spark windows, 0–720°) ----------
function drawTimingStrip(ctx, W, H, angle, spark = SPARK_AT) {
  const pad = 34, base = H - 16, top = 20, bar = 12;
  const x = a => pad + a / 719 * (W - pad - 10);
  ctx.font = '11px system-ui';
  function strip(y, fn, color, label) {
    ctx.fillStyle = cssVar('--line'); ctx.fillRect(pad, y, W - pad - 10, bar);
    ctx.fillStyle = color;
    let start = -1;
    for (let a = 0; a <= 720; a++) {
      const v = fn(a % 720);
      if (v > 0.05 && start < 0) start = a;
      if (v <= 0.05 && start >= 0) { ctx.fillRect(x(start), y, x(a) - x(start), bar); start = -1; }
    }
    if (start >= 0) ctx.fillRect(x(start), y, x(720) - x(start), bar);
    ctx.fillStyle = cssVar('--dim'); ctx.fillText(label, pad, y - 6);
  }
  strip(top, a => intakeLift(a) / MAX_LIFT, cssVar('--blue'), '进气门升程 Intake lift · 开 695° → 关 245°（IVC）');
  strip(top + 34, a => exhaustLift(a) / MAX_LIFT, cssVar('--red'), '排气门升程 Exhaust lift · 开 475° → 关 25°');
  ctx.fillStyle = cssVar('--orange'); ctx.fillRect(x(spark - 18), top + 68, x(spark + 44) - x(spark - 18), bar);
  ctx.fillStyle = cssVar('--dim'); ctx.fillText('燃烧窗口 Combustion ~' + spark + '° 起（点火提前于上止点）', pad, top + 62);
  // overlap marker
  ctx.fillStyle = cssVar('--cyan'); ctx.fillRect(x(695), top + 18, x(25) - x(695) + x(720) - x(695), 3);
  ctx.strokeStyle = cssVar('--cyan'); ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x(wrap720(angle)), top - 8); ctx.lineTo(x(wrap720(angle)), base + 2); ctx.stroke();
  ctx.fillStyle = cssVar('--dim'); ctx.fillText('0°', pad, H - 6); ctx.fillText('720°', W - 42, H - 6);
}

// ---------- P-V diagram ----------
function drawPV(ctx, W, H, opts) {
  const { cr = 11.7, spark = SPARK_AT, angle = null, trail = true } = opts;
  const ink = cssVar('--text'), dim = cssVar('--dim'), line = cssVar('--line');
  const padL = 46, padB = 30, padT = 14, padR = 16;
  const vs = Array.from({ length: 721 }, (_, a) => chamberVol(a, cr));
  const ps = Array.from({ length: 721 }, (_, a) => pressure(a, cr, spark));
  const vmax = Math.max(...vs), vmin = Math.min(...vs), pmax = Math.max(...ps);
  const X = v => padL + (v - vmin) / (vmax - vmin) * (W - padL - padR);
  const Y = p => H - padB - p / pmax * (H - padB - padT);
  ctx.strokeStyle = line; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();
  ctx.fillStyle = dim; ctx.font = '11px ui-monospace,monospace';
  ctx.fillText('V →', W - 60, H - 10); ctx.save(); ctx.translate(14, padT + 40); ctx.rotate(-Math.PI / 2); ctx.fillText('P →', 0, 0); ctx.restore();
  ctx.fillText('V_死点 ' + vmin.toFixed(0), padL, H - 10);
  ctx.fillText('P_max ' + pmax.toFixed(0) + ' bar', padL + 4, padT + 10);
  // loop: compression path, combustion, expansion, exhaust, intake
  ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
  ctx.strokeStyle = cssVar('--cyan'); ctx.beginPath();
  for (let a = 180; a <= spark; a++) { a === 180 ? ctx.moveTo(X(vs[a]), Y(ps[a])) : ctx.lineTo(X(vs[a]), Y(ps[a])); }
  ctx.stroke();
  ctx.strokeStyle = cssVar('--orange'); ctx.beginPath();
  for (let a = spark; a <= 540; a++) { a === spark ? ctx.moveTo(X(vs[a]), Y(ps[a])) : ctx.lineTo(X(vs[a]), Y(ps[a])); }
  ctx.stroke();
  ctx.strokeStyle = dim; ctx.lineWidth = 1.8; ctx.beginPath();
  for (let a = 540; a <= 720; a++) ctx.lineTo(X(vs[a]), Y(ps[a]));
  for (let a = 0; a <= 180; a++) ctx.lineTo(X(vs[a]), Y(ps[a]));
  ctx.stroke();
  // shaded net work area
  ctx.globalAlpha = 0.14; ctx.fillStyle = cssVar('--orange');
  ctx.beginPath();
  for (let a = spark; a <= 540; a++) ctx.lineTo(X(vs[a]), Y(ps[a]));
  for (let a = 540; a >= 0; a--) ctx.lineTo(X(vs[a % 720]), Y(ps[a % 720]));
  for (let a = 0; a <= spark; a++) ctx.lineTo(X(vs[a]), Y(ps[a]));
  ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  if (trail) {
    const cur = pvPoint(angle ?? 0, cr, spark);
    ctx.fillStyle = cssVar('--cyan'); ctx.beginPath(); ctx.arc(X(cur.v), Y(cur.p), 5, 0, 7); ctx.fill();
    ctx.fillStyle = ink; ctx.font = 'bold 12px ui-monospace,monospace';
    ctx.fillText(Math.round(cur.p) + ' bar @ ' + Math.round(wrap720(angle ?? 0)) + '°', X(cur.v) + 8, Y(cur.p) - 8);
  }
  ctx.fillStyle = dim; ctx.font = '11px system-ui';
  ctx.fillText('闭合环的面积 = 一循环净指示功 ≈ ' + Math.round(pvWork(cr, spark)) + ' (任意单位)', padL + 8, H - padB - 6);
}

// ---------- valve lift curves with annotations ----------
function drawLiftCurves(ctx, W, H, angle) {
  const padL = 40, padB = 28, padT = 16;
  const line = cssVar('--line'), dim = cssVar('--dim');
  const x = a => padL + a / 720 * (W - padL - 16);
  const y = lift => H - padB - lift / MAX_LIFT * (H - padB - padT - 8);
  ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - 16, H - padB); ctx.stroke();
  // overlap shading around 720/0
  ctx.fillStyle = cssVar('--cyan'); ctx.globalAlpha = 0.12;
  ctx.fillRect(x(695), padT, x(720) - x(695), H - padB - padT);
  ctx.fillRect(x(0), padT, x(25), H - padB - padT);
  ctx.globalAlpha = 1;
  ctx.fillStyle = dim; ctx.font = '11px system-ui';
  ctx.fillText('气门叠开', x(695) + 2, padT + 12);
  for (const [fn, color, label] of [[intakeLift, cssVar('--blue'), '进气门'], [exhaustLift, cssVar('--red'), '排气门']]) {
    ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.beginPath();
    for (let a = 0; a <= 720; a++) { const v = fn(a % 720); a === 0 ? ctx.moveTo(x(a), y(v)) : ctx.lineTo(x(a), y(v)); }
    ctx.stroke();
  }
  ctx.fillStyle = cssVar('--blue'); ctx.fillText('进气门 Intake', padL + 6, padT + 26);
  ctx.fillStyle = cssVar('--red'); ctx.fillText('排气门 Exhaust', padL + 130, padT + 26);
  ctx.fillStyle = dim;
  ctx.fillText('EVO 475°', x(475) - 20, H - padB + 14); ctx.fillText('EVC 25°', x(25) - 8, H - padB + 14);
  ctx.fillText('IVO 695°', x(695) + 6, H - padB + 14); ctx.fillText('IVC 245°', x(245) - 4, H - padB + 14);
  ctx.strokeStyle = cssVar('--cyan'); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x(wrap720(angle)), padT); ctx.lineTo(x(wrap720(angle)), H - padB); ctx.stroke();
  ctx.fillStyle = dim; ctx.fillText('0°', padL, H - 8); ctx.fillText('360°', x(360) - 12, H - 8); ctx.fillText('720°', W - 44, H - 8);
}

// ---------- cam drive gears (2:1 reduction) ----------
function drawCamGears(ctx, W, H, angle) {
  const dim = cssVar('--dim'), cyan = cssVar('--cyan'), ink = cssVar('--text');
  const cx1 = W * 0.32, cy = H * 0.55, r1 = Math.min(W, H) * 0.24, r2 = r1 * 2;
  const cx2 = cx1 + r1 + r2;
  function gear(x, r, rot, teeth, label) {
    ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, cy, r, 0, 7); ctx.stroke();
    ctx.save(); ctx.translate(x, cy); ctx.rotate(rot);
    ctx.strokeStyle = dim; ctx.lineWidth = 3;
    for (let i = 0; i < teeth; i++) { const t = i / teeth * Math.PI * 2; ctx.beginPath(); ctx.moveTo((r - 6) * Math.cos(t), (r - 6) * Math.sin(t)); ctx.lineTo((r + 5) * Math.cos(t), (r + 5) * Math.sin(t)); ctx.stroke(); }
    ctx.fillStyle = cyan; ctx.beginPath(); ctx.arc(0, -r + 8, 5, 0, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = dim; ctx.font = '12px system-ui'; ctx.fillText(label, x - 30, cy + r + 26);
  }
  gear(cx1, r1, angle * D2R, 12, '曲轴齿轮 1×');
  gear(cx2, r2, -angle / 2 * D2R, 24, '凸轮轴齿轮 0.5×');
  ctx.fillStyle = ink; ctx.font = 'bold 13px ui-monospace,monospace';
  ctx.fillText('曲轴转 720° = 凸轮轴转 360°', cx1 - 40, 22);
}

// ---------- mini engine for comparisons ----------
function drawMiniEngine(ctx, W, H, opts) {
  const { angle, diesel = false, t = 0 } = opts;
  ctx.save();
  ctx.translate(0, -26); ctx.scale(W / 900, H / 620);
  drawEngine(ctx, 900, 620, { angle, labels: false, flow: true, diesel, t });
  ctx.restore();
}

// ---------- inline four-cylinder ----------
function drawMultiCyl(ctx, W, H, angle, count = 4) {
  const a = wrap720(angle);
  const ink = cssVar('--text'), dim = cssVar('--dim'), cyan = cssVar('--cyan'), orange = cssVar('--orange'), blue = cssVar('--blue');
  const colW = W / count;
  for (let c = 1; c <= count; c++) {
    const ph = wrap720(a - CYL_PHASES[c - 1]);
    const cx = colW * (c - 0.5), bore = colW * 0.30, deck = H * 0.30;
    const stroke = bore * 0.9, disp = pistonDisplacement(ph) / (2 * GEO.R) * stroke;
    const top = deck + 6 + disp;
    ctx.strokeStyle = ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - bore, deck - 14); ctx.lineTo(cx - bore, top + stroke + 26); ctx.moveTo(cx + bore, deck - 14); ctx.lineTo(cx + bore, top + stroke + 26); ctx.stroke();
    const si = strokeIndex(ph);
    const cols = [blue, cyan, orange, dim];
    ctx.globalAlpha = 0.4; ctx.fillStyle = cols[si];
    ctx.fillRect(cx - bore, deck, bore * 2, top - deck); ctx.globalAlpha = 1;
    ctx.fillStyle = ink; ctx.beginPath(); ctx.roundRect(cx - bore + 2, top, bore * 2 - 4, stroke * 0.42, 4); ctx.fill();
    if (si === 2) { ctx.fillStyle = orange; ctx.beginPath(); ctx.arc(cx, deck + 6, 7, 0, 7); ctx.fill(); }
    ctx.fillStyle = dim; ctx.font = '12px ui-monospace,monospace';
    ctx.fillText('缸 ' + c, cx - 14, top + stroke * 0.42 + 20);
    ctx.fillStyle = cyan; ctx.fillText(STROKES[si][0], cx - 16, top + stroke * 0.42 + 38);
  }
  // firing pulse bar: 720° timeline, pulse every 180° once per cyl
  const by = H - 26, x = deg => 30 + deg / 720 * (W - 60);
  ctx.fillStyle = dim; ctx.font = '11px system-ui'; ctx.fillText('点火脉冲（每 180° 一次，缸序 1-3-4-2）', 30, by - 14);
  ctx.fillStyle = cssVar('--line'); ctx.fillRect(30, by, W - 60, 10);
  for (let c = 1; c <= count; c++) ctx.fillStyle = orange, ctx.fillRect(x(firingPulseDeg(c)) - 3, by - 3, 6, 16);
  ctx.strokeStyle = cyan; ctx.beginPath(); ctx.moveTo(x(a), by - 6); ctx.lineTo(x(a), by + 14); ctx.stroke();
  ctx.fillStyle = dim; ctx.font = '11px system-ui';
  ctx.fillText(count === 1 ? '点火脉冲（720° 里只有 1 次）' : '点火脉冲（每 180° 一次，缸序 1-3-4-2）', 30, by - 14);
}
