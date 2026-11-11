/* Engine Lab application shell: module sidebar, guided director, quiz,
   theme, and the per-scene tool dispatcher. All drawing goes through
   engine-render.js + core.js. */
'use strict';

const modules = window.ENGINE_MODULES;
const stage = document.getElementById('scene');
const sctx = stage.getContext('2d');
fitCanvas(stage);

const state = { mi: 0, si: 0, angle: 90, playing: true, auto: true, rpm: 240, t: 0, sceneT: 0, answered: {} };
const params = {};
for (const m of modules) {
  params[m.id] = {};
  for (const c of (m.controls || [])) params[m.id][c.key] = c.def;
}

const mod = () => modules[state.mi];
const scene = () => mod().scenes[state.si];

// ---------- debug hook (used by tests) ----------
window.lab = {
  get angle() { return state.angle; },
  setAngle(a) { state.angle = wrap720(a); },
  gotoModule(id) { const i = modules.findIndex(m => m.id === id); if (i >= 0) switchModule(i); },
  gotoScene(key) { const i = mod().scenes.findIndex(s => s.key === key); if (i >= 0) switchScene(i); },
  state, params,
  debug() { const sc = scene(); return { module: mod().id, scene: sc.key, angle: wrap720(state.angle), spin: !!sc.spin, tool: sc.tool || 'engine', playing: state.playing }; },
};

// ---------- theme ----------
let theme = localStorage.getItem('czl-lab-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
const themeBtn = document.getElementById('themeBtn');
function applyTheme() {
  document.documentElement.setAttribute('data-theme', theme);
  themeBtn.textContent = theme === 'dark' ? '深色 Dark' : '浅色 Light';
  themeBtn.setAttribute('aria-pressed', String(theme === 'light'));
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = theme === 'light' ? '#f4f2ec' : '#101113';
}
themeBtn.addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('czl-lab-theme', theme); applyTheme(); });
applyTheme();

// ---------- sidebar ----------
const moduleList = document.getElementById('moduleList');
function buildSidebar() {
  moduleList.innerHTML = '';
  modules.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'mod' + (i === state.mi ? ' cur' : '') + (state.answered[m.id] === m.quiz.ans ? ' done' : '');
    b.setAttribute('aria-current', i === state.mi ? 'true' : 'false');
    b.innerHTML = `<span class="mod-id">${m.num}</span><span><span class="mod-title">${m.name}</span><span class="mod-sub">${m.en}</span></span>`;
    b.addEventListener('click', () => switchModule(i));
    moduleList.appendChild(b);
  });
}

// ---------- controls ----------
const paramBox = document.getElementById('paramControls');
function buildControls() {
  paramBox.innerHTML = '';
  for (const c of (mod().controls || [])) {
    const lab = document.createElement('label');
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = c.min; inp.max = c.max; inp.step = c.step;
    inp.value = params[mod().id][c.key];
    inp.setAttribute('aria-label', c.label);
    inp.addEventListener('input', () => { params[mod().id][c.key] = +inp.value; });
    lab.append(c.label + ' ', inp);
    paramBox.appendChild(lab);
  }
}

// ---------- quiz ----------
const quizCard = document.getElementById('quizBody');
function buildQuiz() {
  const q = mod().quiz;
  quizCard.innerHTML = '';
  const h = document.createElement('p'); h.className = 'quiz-q'; h.textContent = q.q;
  quizCard.appendChild(h);
  const opts = document.createElement('div'); opts.className = 'quiz-opts';
  q.opts.forEach((o, i) => {
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = o;
    b.addEventListener('click', () => {
      state.answered[mod().id] = i;
      [...opts.children].forEach((btn, j) => {
        btn.disabled = true;
        if (j === q.ans) btn.classList.add('right');
        else if (j === i) btn.classList.add('wrong');
      });
      const why = document.createElement('p'); why.className = 'quiz-why';
      why.textContent = (i === q.ans ? '✓ 对了：' : '✗ 正确答案是「' + q.opts[q.ans] + '」。') + q.why;
      quizCard.appendChild(why);
      buildSidebar();
    });
    opts.appendChild(b);
  });
  quizCard.appendChild(opts);
}

// ---------- narration ----------
const narrName = document.getElementById('narrName'), narrIdx = document.getElementById('narrIdx'), narrText = document.getElementById('narrText');
function narrate() {
  narrName.textContent = mod().num + ' · ' + mod().name + ' ' + mod().en;
  narrIdx.textContent = (state.si + 1) + ' / ' + mod().scenes.length;
  narrText.textContent = scene().narr;
  document.getElementById('angleTag').textContent = Math.round(wrap720(state.angle)) + '°';
}

// ---------- switching ----------
function switchModule(i) {
  state.mi = i; state.si = 0;
  const sc = scene();
  if (sc.angle != null) state.angle = sc.angle;
  state.playing = !!sc.spin; state.sceneT = 0;
  buildSidebar(); buildControls(); buildQuiz(); narrate(); syncButtons();
}
function switchScene(i) {
  const n = mod().scenes.length;
  state.si = ((i % n) + n) % n;
  const sc = scene();
  if (sc.angle != null) state.angle = sc.angle;
  state.playing = !!sc.spin; state.sceneT = 0;
  narrate(); syncButtons();
}
const playBtn = document.getElementById('playBtn'), autoBtn = document.getElementById('autoBtn');
function syncButtons() {
  playBtn.textContent = state.playing ? '暂停 Pause' : '播放 Play';
  autoBtn.textContent = state.auto ? '自动导览 开' : '自动导览 关';
  autoBtn.setAttribute('aria-pressed', String(state.auto));
}
playBtn.addEventListener('click', () => { state.playing = !state.playing; syncButtons(); });
autoBtn.addEventListener('click', () => { state.auto = !state.auto; syncButtons(); });
document.getElementById('nextBtn').addEventListener('click', () => { state.auto = false; switchScene(state.si + 1); });
document.getElementById('prevBtn').addEventListener('click', () => { state.auto = false; switchScene(state.si - 1); });
document.getElementById('rpmR').addEventListener('input', e => state.rpm = +e.target.value);
document.getElementById('scrubR').addEventListener('input', e => {
  state.playing = false; state.auto = false; state.angle = +e.target.value; syncButtons();
});

// ---------- bench instruments (module-local canvases drawn here) ----------
function drawCRBench(ctx, W, H, cr) {
  const ink = cssVar('--text'), dim = cssVar('--dim'), line = cssVar('--line'), cyan = cssVar('--cyan'), orange = cssVar('--orange'), red = cssVar('--red');
  ctx.fillStyle = ink; ctx.font = 'bold 26px ui-monospace,monospace';
  ctx.fillText('CR ' + cr.toFixed(1) + ' : 1', 40, 60);
  const p = crPressure(cr), t = crTemp(cr), eta = 1 - Math.pow(cr, 1 - GAMMA);
  const rows = [
    ['压缩终了压力 P_tdc', p.toFixed(0) + ' bar', p / 90],
    ['压缩终了温度 T_tdc', Math.round(t) + ' K', t / 1000],
    ['理想循环效率 η', (eta * 100).toFixed(0) + '%', eta],
  ];
  rows.forEach(([label, val, frac], i) => {
    const y = 120 + i * 74;
    ctx.fillStyle = dim; ctx.font = '13px system-ui'; ctx.fillText(label, 40, y);
    ctx.fillStyle = line; ctx.fillRect(40, y + 10, W - 200, 12);
    ctx.fillStyle = cyan; ctx.fillRect(40, y + 10, clamp(frac, 0, 1) * (W - 200), 12);
    ctx.fillStyle = ink; ctx.font = 'bold 15px ui-monospace,monospace'; ctx.fillText(val, W - 150, y + 22);
  });
  // gasoline knock limit marker
  const x = 40 + GASOLINE_MAX_CR / 15 * (W - 200);
  ctx.strokeStyle = red; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(x, 92); ctx.lineTo(x, H - 30); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = red; ctx.font = '12px system-ui'; ctx.fillText('汽油爆震极限 ≈ CR 13.5（教学值）', x + 6, H - 40);
  ctx.fillStyle = dim; ctx.font = '12px system-ui';
  ctx.fillText('P ∝ CR^1.3 · T ∝ CR^0.3 · η = 1 − CR^−0.3（γ=1.3 空气标准模型）', 40, H - 22);
}

function drawAdvCurve(ctx, W, H, advance) {
  const ink = cssVar('--text'), dim = cssVar('--dim'), line = cssVar('--line'), cyan = cssVar('--cyan'), orange = cssVar('--orange'), red = cssVar('--red');
  const padL = 40, padB = 34, padT = 26;
  const X = a => padL + (a + 6) / 42 * (W - padL - 20);
  const Y = p => H - padB - p * (H - padB - padT);
  ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - 20, H - padB); ctx.stroke();
  // knock band (advance > 22) and late band (advance < 0)
  ctx.globalAlpha = 0.13; ctx.fillStyle = red; ctx.fillRect(X(22), padT, X(36) - X(22), H - padB - padT);
  ctx.fillStyle = orange; ctx.fillRect(X(-6), padT, X(0) - X(-6), H - padB - padT); ctx.globalAlpha = 1;
  ctx.fillStyle = dim; ctx.font = '11px system-ui';
  ctx.fillText('爆震区', X(24), padT + 14); ctx.fillText('迟燃/回火区', X(-5), padT + 14);
  ctx.strokeStyle = cyan; ctx.lineWidth = 2.6; ctx.beginPath();
  for (let a = -6; a <= 36; a += 0.5) { const y = Y(relativePower(a)); a === -6 ? ctx.moveTo(X(a), y) : ctx.lineTo(X(a), y); }
  ctx.stroke();
  const y = Y(relativePower(advance));
  ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(X(advance), y, 6, 0, 7); ctx.fill();
  ctx.font = 'bold 13px ui-monospace,monospace';
  ctx.fillText((advance >= 0 ? '提前 ' + advance + '° BTDC' : '滞后 ' + (-advance) + '° ATDC') + ' · 相对功率 ' + Math.round(relativePower(advance) * 100) + '%', X(advance) + 10, y - 10);
  ctx.fillStyle = dim; ctx.font = '11px ui-monospace,monospace';
  ctx.fillText('上止点 TDC', X(0) - 30, H - padB + 18);
  ctx.fillText('−6°', X(-6), H - 12); ctx.fillText('+36°', X(36) - 20, H - 12);
  ctx.fillText('风险：爆震 ' + Math.round(knockRisk(advance) * 100) + '% · 回火 ' + Math.round(backfireRisk(advance) * 100) + '%（教学模型）', padL + 4, padT - 8);
}

function drawCompare(ctx, W, H, opts) {
  const { angle, t } = opts;
  const dim = cssVar('--dim'), ink = cssVar('--text');
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W / 2 - 2, H); ctx.clip();
  ctx.translate(0, -20); ctx.scale((W / 2) / 900, H / 620);
  drawEngine(ctx, 900, 620, { angle, labels: false, t });
  ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(W / 2 + 2, 0, W / 2 - 2, H); ctx.clip();
  ctx.translate(W / 2 + 2, -20); ctx.scale((W / 2) / 900, H / 620);
  drawEngine(ctx, 900, 620, { angle, labels: false, diesel: true, t });
  ctx.restore();
  ctx.strokeStyle = cssVar('--line'); ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  ctx.font = 'bold 14px system-ui'; ctx.fillStyle = ink;
  ctx.fillText('汽油机 Spark-ignition · CR 11.7 · 火花塞', 24, 24);
  ctx.fillText('柴油机 Compression-ignition · CR 18 · 喷油嘴', W / 2 + 24, 24);
  ctx.fillStyle = dim; ctx.font = '11px system-ui';
  ctx.fillText('同一角度 θ · 同一曲柄几何 · 只有点燃方式不同', W / 2 - 150, H - 10);
}

function drawEffBars(ctx, W, H) {
  const ink = cssVar('--text'), dim = cssVar('--dim'), cyan = cssVar('--cyan'), orange = cssVar('--orange');
  const rows = [
    ['汽油机 CR 11', 1 - Math.pow(11, 1 - GAMMA), cyan],
    ['柴油机 CR 18', 1 - Math.pow(18, 1 - GAMMA), orange],
    ['奥托 vs 柴油 · 空气标准 η = 1 − CR^−0.3'],
  ];
  rows.slice(0, 2).forEach(([label, eta, col], i) => {
    const y = 90 + i * 90;
    ctx.fillStyle = ink; ctx.font = '15px system-ui'; ctx.fillText(label, 40, y - 12);
    ctx.fillStyle = cssVar('--line'); ctx.fillRect(40, y, W - 240, 26);
    ctx.fillStyle = col; ctx.fillRect(40, y, eta * (W - 240), 26);
    ctx.fillStyle = ink; ctx.font = 'bold 18px ui-monospace,monospace'; ctx.fillText(Math.round(eta * 100) + '%', W - 160, y + 22);
  });
  ctx.fillStyle = dim; ctx.font = '12px system-ui';
  ctx.fillText(rows[2][0] + ' —— 实际热效率低一截（摩擦、泵气、传热），但排序不变。', 40, H - 40);
  ctx.fillText('更高压缩比 = 更高效率 = 柴油机的根本优势；代价是重量、喷射系统和 NOx。', 40, H - 20);
}

// ---------- per-frame dispatch ----------
function drawFrame() {
  const sc = scene(), p = params[mod().id], W = stage._w, H = stage._h;
  sctx.clearRect(0, 0, W, H);
  const a = wrap720(state.angle);
  switch (sc.tool || 'engine') {
    case 'lift': drawLiftCurves(sctx, W, H, a); break;
    case 'strip': drawTimingStrip(sctx, W, H, a, mod().id === 'spark' ? sparkAngle(p.advance) : SPARK_AT); break;
    case 'gears': drawCamGears(sctx, W, H, a); break;
    case 'pv': drawPV(sctx, W, H, { cr: p.cr, angle: a }); break;
    case 'crbench': drawCRBench(sctx, W, H, p.cr); break;
    case 'diesel': drawEngine(sctx, W, H, { angle: a, diesel: true, t: state.t }); break;
    case 'advcurve': drawAdvCurve(sctx, W, H, p.advance); break;
    case 'compare': drawCompare(sctx, W, H, { angle: a, t: state.t }); break;
    case 'effbar': drawEffBars(sctx, W, H); break;
    case 'multi': drawMultiCyl(sctx, W, H, a, sc.key === 'gap' ? 1 : 4); break;
    default:
      drawEngine(sctx, W, H, {
        angle: a, highlight: sc.highlight ?? null, t: state.t,
        spark: mod().id === 'spark' ? sparkAngle(p.advance) : null,
      });
  }
}

// ---------- director loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  state.t += dt;
  const sc = scene();
  if (state.playing && sc.spin) state.angle = wrap720(state.angle + state.rpm / 60 * 360 * dt);
  state.sceneT += dt;
  if (state.auto && state.playing && state.sceneT > (sc.hold || 12)) switchScene(state.si + 1);
  if (state.playing && sc.spin) document.getElementById('angleTag').textContent = Math.round(state.angle) + '°';
  drawFrame();
  requestAnimationFrame(loop);
}

// ---------- boot ----------
buildSidebar(); buildControls(); buildQuiz(); narrate(); syncButtons();
requestAnimationFrame(loop);
