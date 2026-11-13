/* Distillation Lab — application shell: module registry, lesson director,
 * navigation, data tables, custom x–y import and static sections.
 * The director logic mirrors Stock Market Lab so both labs behave alike. */
(function () {
  'use strict';
  var DL = window.DL = window.DL || {};
  var ui = DL.ui, T = DL.thermo, plot = DL.plot;
  var modules = DL.modules;

  var $ = function (id) { return document.getElementById(id); };
  var state = {
    modId: null, scene: 0, playing: false, speed: 1, voice: false,
    inst: null, def: null, timer: 0, offset: 0, startedAt: 0
  };
  function toast(msg) {
    var el = ui.el('div', 'toast', msg);
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 2100);
    setTimeout(function () { el.remove(); }, 2600);
  }

  /* ------------------------------------------------------------------ */
  /*  Theme                                                             */
  /* ------------------------------------------------------------------ */
  // Shared controller (assets/theme.js, inlined by scripts/shared_experience.py):
  // follows the system until the user chooses, remembers only explicit choices
  // and fires 'distl:theme' so canvases and plots re-read colours.
  function initTheme() { window.CZLLabTheme.mount(); }

  /* ------------------------------------------------------------------ */
  /*  Hero + boiling-point strip                                        */
  /* ------------------------------------------------------------------ */
  function initHero() {
    var eq = T.makeEq('bt');
    var xF = 0.45, xD = 0.97, xW = 0.03, q = 1;
    var rm = T.rmin(eq, xF, q, xD).R;
    var res = T.mccabe(eq, { xF: xF, q: q, xD: xD, xW: xW, R: 1.5 * rm });
    var ch = plot.chart($('heroChart'), {
      label: '苯–甲苯 McCabe–Thiele 图', square: true,
      title: 'McCABE–THIELE <b>N = ' + res.N.toFixed(1) + ' 级 · 第 ' + res.feedStage + ' 级进料</b>',
      x: { min: 0, max: 1, label: '液相 x（苯）' }, y: { min: 0, max: 1, label: '气相 y（苯）' },
      pad: { l: 40, b: 34, r: 10 }
    });
    function sync(h) { ch.draw(function (g) { plot.mccabe(g, eq, res, { highlight: h }); }); }
    var col = DL.column.create($('heroColumn'), {
      label: '苯–甲苯连续精馏塔示意动画：悬停塔板查看组成与温度', maxTrays: 16,
      onHover: function (n) { sync(n); }
    });
    col.set(res);
    sync(null);
  }

  function initBoilStrip() {
    var host = $('boilStrip');
    var ew = T.makeEq('ew').azeotrope;
    var rows = [
      { name: '苯', code: 'BENZENE', T: T.tsat('benzene', T.ATM), lit: 80.1 },
      { name: '甲苯', code: 'TOLUENE', T: T.tsat('toluene', T.ATM), lit: 110.6 },
      { name: '乙醇–水恒沸物', code: 'AZEOTROPE x=' + ew.x.toFixed(3), T: ew.T, lit: 78.15 },
      { name: '水', code: 'WATER', T: T.tsat('water', T.ATM), lit: 100.0 }
    ];
    host.innerHTML = rows.map(function (r) {
      return '<div class="idx"><div class="idx-name">' + r.name + '<em>' + r.code + '</em></div>' +
        '<div class="idx-val">' + r.T.toFixed(2) + ' °C</div>' +
        '<div class="idx-chg flat">文献 ' + r.lit + ' °C</div></div>';
    }).join('') + '<p class="index-note">101.325 kPa 下由 Antoine 常数（恒沸物另加 NRTL 活度系数）现算的沸点；与文献值的差就是本页模型的精度量级。</p>';
  }

  /* ------------------------------------------------------------------ */
  /*  Module navigation                                                 */
  /* ------------------------------------------------------------------ */
  function sortedModules() { return modules.slice().sort(function (a, b) { return a.order - b.order; }); }

  function renderModuleList() {
    var host = $('moduleList');
    host.innerHTML = '';
    sortedModules().forEach(function (def) {
      var btn = ui.el('button', 'mod');
      btn.type = 'button';
      btn.setAttribute('aria-current', def.id === state.modId ? 'true' : 'false');
      btn.dataset.mod = def.id;
      btn.innerHTML = '<span class="mod-id">' + def.id + '</span><span>' +
        '<span class="mod-title">' + def.title + '</span>' +
        '<span class="mod-sub">' + (def.en || '') + '</span></span>';
      btn.addEventListener('click', function () { openModule(def.id, 0); });
      host.appendChild(btn);
    });
  }

  function openModule(id, sceneIndex) {
    var def = sortedModules().filter(function (m) { return m.id === id; })[0];
    if (!def) return;
    pause();
    if (state.inst && state.inst.destroy) {
      try { state.inst.destroy(); } catch (e) { console.error(e); }
    }
    state.inst = null;
    state.def = def;
    state.modId = id;
    state.scene = 0;
    var stageBody = $('stageBody');
    var panel = $('modulePanel');
    stageBody.innerHTML = '';
    panel.innerHTML = '';
    $('stageKicker').textContent = 'MODULE ' + def.id + ' / ' + (def.en || '').toUpperCase();
    $('stageTitle').textContent = def.title;
    $('stageSub').textContent = def.subtitle || '';
    var ctx = {
      stage: stageBody, panel: panel, id: def.id, def: def,
      sceneIndex: function () { return state.scene; },
      takeover: function () { takeover(); },
      toast: toast,
      goScene: function (i) { applyScene(i); },
      module: function () { return state.inst; }
    };
    try {
      state.inst = def.mount(ctx) || {};
    } catch (err) {
      console.error('模块挂载失败：' + def.id, err);
      stageBody.innerHTML = '<div class="stage-error"><b>模块加载失败</b><p>' + String(err && err.message || err) + '</p></div>';
      state.inst = {};
    }
    renderModuleList();
    buildSceneDots();
    applyScene(Math.max(0, Math.min(sceneIndex || 0, def.scenes.length - 1)));
    $('takeoverBtn').hidden = def.scenes.length < 2;
  }

  /* ------------------------------------------------------------------ */
  /*  Director                                                          */
  /* ------------------------------------------------------------------ */
  function buildSceneDots() {
    var host = $('sceneDots');
    host.innerHTML = '';
    if (!state.def) return;
    state.def.scenes.forEach(function (scene, i) {
      var b = ui.el('button');
      b.type = 'button';
      b.title = (i + 1) + '. ' + scene.title;
      b.setAttribute('aria-label', '第 ' + (i + 1) + ' 幕：' + scene.title);
      b.addEventListener('click', function () {
        applyScene(i);
        if (!state.playing) setStatus('手动模式', '');
      });
      host.appendChild(b);
    });
  }
  function sceneDuration() {
    var sc = state.def && state.def.scenes[state.scene];
    return ((sc && sc.duration) || 12000) / state.speed;
  }
  function setStatus(text, cls) {
    var el = $('directorStatus');
    el.textContent = text;
    el.className = 'tr-status' + (cls ? ' ' + cls : '');
  }
  function updatePlayButton() {
    $('playScenes').textContent = state.playing ? '❚❚ 暂停' : '▶ 自动讲解';
    $('takeoverBtn').textContent = state.playing ? '⏸ 暂停讲解，我要自己试' : '▶ 继续自动讲解';
  }
  function applyScene(i, opts) {
    if (!state.def) return;
    var def = state.def;
    var sc = def.scenes[i];
    if (!sc) return;
    state.scene = i;
    $('sceneChapter').textContent = '场景 ' + (i + 1) + ' / ' + def.scenes.length;
    $('sceneBadge').textContent = state.playing ? '自动讲解' : '手动模式';
    $('sceneTitle').textContent = sc.title;
    $('sceneBody').innerHTML = sc.body || '';
    $('stageHint').textContent = sc.guide || def.hint || '调整滑块，观察相图、塔板与读数如何一起变化。';
    Array.prototype.forEach.call($('sceneDots').children, function (b, k) {
      b.setAttribute('aria-current', k === i ? 'true' : 'false');
    });
    if (sc.patch && state.inst && state.inst.apply) {
      try {
        state.inst.apply(typeof sc.patch === 'function' ? sc.patch() : sc.patch);
      } catch (err) {
        console.error('场景应用失败：' + def.id + '/' + (i + 1), err);
      }
    }
    renderModuleList();
    resetDirectorProgress();
    if (state.playing) startTimer();
    if (state.voice) speak(sc.title + '。' + stripTags(sc.body || ''));
    if (!opts || opts.autoplay !== false) updatePlayButton();
  }
  function stripTags(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return (d.textContent || '').replace(/\s+/g, ' ').slice(0, 160);
  }
  function resetDirectorProgress() {
    state.offset = 0;
    state.startedAt = performance.now();
    $('directorBar').style.width = '0%';
  }
  function startTimer() {
    stopTimer();
    state.startedAt = performance.now() - state.offset;
    state.timer = setInterval(tick, 90);
  }
  function stopTimer() { if (state.timer) { clearInterval(state.timer); state.timer = 0; } }
  function tick() {
    if (!state.playing) return;
    var dur = sceneDuration();
    var elapsed = performance.now() - state.startedAt;
    $('directorBar').style.width = Math.min(100, elapsed / dur * 100) + '%';
    if (elapsed >= dur) nextScene(true);
  }
  function play() {
    if (!state.def || state.timer) return;
    state.playing = true;
    $('sceneBadge').textContent = '自动讲解';
    setStatus('自动讲解', 'live');
    updatePlayButton();
    startTimer();
  }
  function pause() {
    if (state.timer) state.offset = performance.now() - state.startedAt;
    stopTimer();
    state.playing = false;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    updatePlayButton();
    if (state.def) $('sceneBadge').textContent = '手动模式';
  }
  function takeover() {
    if (!state.playing) return;
    pause();
    setStatus('已接管', 'taken');
    toast('已暂停自动讲解，现在的参数由你控制');
  }
  function nextScene(auto) {
    if (!state.def) return;
    var i = state.scene + 1;
    if (i < state.def.scenes.length) {
      state.offset = 0;
      applyScene(i);
      if (!state.playing) setStatus('手动模式', '');
      return;
    }
    pause();
    setStatus('讲解结束', 'live');
    if (auto) toast('「' + state.def.title + '」讲解结束，可继续选择下一模块');
  }
  function prevScene() {
    if (!state.def) return;
    state.offset = 0;
    applyScene(Math.max(0, state.scene - 1));
    if (!state.playing) setStatus('手动模式', '');
  }
  function replay() {
    if (!state.def) return;
    pause();
    state.offset = 0;
    applyScene(0);
    setStatus('手动模式', '');
  }
  function speak(text) {
    if (!window.speechSynthesis || !text) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text.slice(0, 140));
      u.lang = 'zh-CN';
      u.rate = 1.02;
      window.speechSynthesis.speak(u);
    } catch (e) { /* speech is optional */ }
  }

  /* ------------------------------------------------------------------ */
  /*  Family map, data tables, misconceptions                           */
  /* ------------------------------------------------------------------ */
  var FAMILY = [
    ['A', '气液平衡', '一切精馏的起点：两种液体在同一温度下的蒸气压不同，气相因此富集易挥发组分。', '为什么：没有 y ≠ x，就没有分离。'],
    ['B', '闪蒸 / 简单蒸馏', '一次部分汽化：闪蒸是连续的单级平衡，简单蒸馏是釜内逐渐蒸干的微分过程。', '为什么：设备最简单，但纯度有限。'],
    ['C', '连续精馏', '把很多次“部分汽化 + 部分冷凝”叠成逆流塔：回流把冷凝液送回塔顶，再沸器提供上升蒸汽。', '为什么：用级数换纯度。'],
    ['D', '回流比与能耗', '回流比越大级数越少、能耗越高；两头都有极限（Rmin、Nmin），最优点在中间。', '为什么：精馏是化工里最耗能的单元之一。'],
    ['E', '间歇精馏', '一釜料分批蒸出：塔顶组成随时间下降，可以恒回流或恒馏出组成操作。', '为什么：小批量、多品种、溶剂回收。'],
    ['F', '共沸 / 萃取 / 变压', '恒沸点处 y = x，普通精馏无法越过；加夹带剂、加溶剂或换压力来“移动”平衡。', '为什么：乙醇–水等体系不能直接提纯。'],
    ['G', '减压 / 水蒸气蒸馏', '降低总压或借助不互溶的水，让高沸点、热敏物在较低温度下蒸出。', '为什么：避免分解、聚合与焦化。'],
    ['H', '塔板与填料', '真实塔板不是平衡级：有效率、有操作区（漏液、雾沫夹带、液泛）。', '为什么：理论板数要换算成真实塔高。'],
    ['I', '原油常压蒸馏', '原油是连续的混合物：按沸程切割成石脑油、煤油、柴油、瓦斯油和渣油。', '为什么：多组分、侧线抽出、切割点。'],
    ['J', '同步对比', '同一初始条件下只改一个变量：回流、进料热状态、挥发度、效率、压力……', '为什么：看清因果，而不是记结论。']
  ];
  function renderFamily() {
    var host = $('familyGrid');
    host.innerHTML = '';
    FAMILY.forEach(function (f) {
      var b = ui.el('button', 'fam');
      b.type = 'button';
      b.innerHTML = '<span class="fam-id">MODULE ' + f[0] + '</span><h3>' + f[1] + '</h3><p>' + f[2] + '</p><span class="fam-why">' + f[3] + '</span>';
      b.addEventListener('click', function () {
        openModule(f[0], 0);
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        $('lab').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      });
      host.appendChild(b);
    });
  }

  function renderData() {
    var html = '<table class="rules-table prop-table"><thead><tr><th>组分 / Component</th><th>M g/mol</th><th>Antoine A</th><th>B</th><th>C</th><th>适用 °C</th><th>模型沸点</th><th>文献沸点</th><th>汽化潜热</th></tr></thead><tbody>';
    Object.keys(T.COMPONENTS).forEach(function (k) {
      var c = T.COMPONENTS[k];
      var tb = T.tsat(k, T.ATM), dev = tb - c.tbLit;
      c.antoine.forEach(function (a, i) {
        html += '<tr><td>' + (i === 0 ? c.name + ' <span class="sub">' + c.en + ' · ' + c.formula + ' · CAS ' + c.cas + '</span>' : '<span class="sub">（第二温区）</span>') + '</td>' +
          '<td class="num">' + (i === 0 ? c.M.toFixed(2) : '') + '</td>' +
          '<td class="num">' + a[0].toFixed(5) + '</td><td class="num">' + a[1].toFixed(3) + '</td><td class="num">' + a[2].toFixed(3) + '</td>' +
          '<td class="num">' + a[3] + ' – ' + a[4] + '</td>' +
          '<td class="num ' + (Math.abs(dev) < 0.3 ? 'good' : 'off') + '">' + (i === 0 ? tb.toFixed(2) + ' °C' : '') + '</td>' +
          '<td class="num">' + (i === 0 ? c.tbLit.toFixed(1) + ' °C' : '') + '</td>' +
          '<td class="num">' + (i === 0 ? c.hvap.toFixed(1) + ' kJ/mol' : '') + '</td></tr>';
      });
    });
    html += '</tbody></table>';
    $('compTable').innerHTML = html;

    var s = '<table class="rules-table prop-table"><thead><tr><th>体系 / System</th><th>液相模型</th><th>参数</th><th>模型恒沸点（101.3 kPa）</th><th>文献恒沸点</th><th>说明</th></tr></thead><tbody>';
    ['bt', 'hh', 'ew', 'ac'].forEach(function (id) {
      var sys = T.SYSTEMS[id], eq = T.makeEq(id);
      var az = eq.azeotrope, lit = sys.azeoLit;
      s += '<tr><td>' + sys.name + '<span class="asof">' + sys.en + '</span></td>' +
        '<td>' + (sys.model === 'ideal' ? 'Raoult（理想溶液）' : sys.model === 'nrtl' ? 'NRTL（Aspen APV150）' : 'van Laar（1 atm 恒沸点反算）') + '</td>' +
        '<td class="num">' + (sys.model === 'vanlaar' ? 'A₁₂ = ' + sys.A12.toFixed(4) + '<br>A₂₁ = ' + sys.A21.toFixed(4) : sys.model === 'nrtl' ? 'τ<sub>ij</sub> = a<sub>ij</sub> + b<sub>ij</sub>/T<br>见下表' : '—') + '</td>' +
        '<td class="num">' + (az ? 'x = ' + az.x.toFixed(3) + '<br>' + az.T.toFixed(2) + ' °C · ' + (az.type === 'min' ? '最低' : '最高') + '恒沸' : '无') + '</td>' +
        '<td class="num">' + (lit ? 'x ≈ ' + lit.x + '<br>' + lit.T + ' °C' : '无') + '</td>' +
        '<td>' + sys.note + '</td></tr>';
    });
    s += '</tbody></table>';
    $('sysTable').innerHTML = s;
    renderAspen();

    var src = [
      ['NIST WebBook · 苯', 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C71432&Mask=4'],
      ['甲苯', 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C108883&Mask=4'],
      ['乙醇', 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C64175&Mask=4'],
      ['水', 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C7732185&Mask=4'],
      ['丙酮', 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C67641&Mask=4'],
      ['氯仿', 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C67663&Mask=4'],
      ['正己烷', 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C110543&Mask=4'],
      ['正庚烷', 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C142825&Mask=4'],
      ['乙二醇', 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C107211&Mask=4']
    ];
    $('dataSources').innerHTML = '<span>Antoine 常数为常用手册的 mmHg/°C 形式，已与 NIST Chemistry WebBook 的 bar/K 拟合交叉核对（压力偏差 ≤ 1.6 %）：</span>' +
      src.map(function (s2) { return '<a href="' + s2[1] + '" target="_blank" rel="noopener">' + s2[0] + '</a>'; }).join('') +
      '<span>· NRTL 参数、T–x–y 与 RadFrac 基准由项目维护者用 Aspen Plus V15 导出（APV150 数据库）。</span>' +
      '<span>· 方法参考：McCabe & Thiele (1925)、Fenske (1932)、Underwood (1948)、Gilliland (1940) / Eduljee (1975)、Renon & Prausnitz (1968, NRTL)。</span>';
  }

  function renderAspen() {
    var A = DL.aspen;
    if (!A) return;
    var names = { water: '水', ethanol: '乙醇', eg: '乙二醇', benzene: '苯', toluene: '甲苯' };
    var used = { 'water|ethanol': '乙醇–水；萃取精馏', 'water|eg': '萃取精馏', 'ethanol|eg': '萃取精馏' };
    var h = '<table class="rules-table prop-table"><thead><tr><th>NRTL 二元参数 · Aspen Plus V15</th><th>来源</th><th>a<sub>ij</sub></th><th>a<sub>ji</sub></th><th>b<sub>ij</sub> / K</th><th>b<sub>ji</sub> / K</th><th>c<sub>ij</sub></th><th>适用 °C</th><th>本页用途</th></tr></thead><tbody>';
    A.nrtl.forEach(function (r) {
      var u = used[r[0] + '|' + r[1]];
      h += '<tr><td>' + names[r[0]] + ' (i) – ' + names[r[1]] + ' (j)</td><td>' + r[2] + '</td>' +
        [r[3], r[4], r[5], r[6], r[7]].map(function (v) { return '<td class="num">' + v + '</td>'; }).join('') +
        '<td class="num">' + r[8] + ' – ' + r[9] + '</td><td class="' + (u ? 'good' : '') + '">' + (u || '仅列出') + '</td></tr>';
    });
    h += '</tbody></table>';
    $('nrtlTable').innerHTML = h;

    // azeotrope + T–x–y comparison
    var t = '<table class="rules-table prop-table"><thead><tr><th>乙醇–水 · 与 Aspen 对照</th><th>Aspen 恒沸点</th><th>本页模型恒沸点</th><th>Δx</th><th>泡点 |ΔT| 最大</th><th>气相 |Δy| 最大</th></tr></thead><tbody>';
    Object.keys(A.txy).map(Number).sort(function (a, b) { return a - b; }).forEach(function (P) {
      var d = A.txy[String(P)], eq = T.makeEq('ew', { P: T.mmHg(P) }), az = null, dT = 0, dy = 0;
      for (var i = 1; i < d.length; i++) {
        var a = d[i - 1], b = d[i], d0 = a[1] - a[0], d1 = b[1] - b[0];
        if (a[0] > 0 && b[0] < 1 && d0 * d1 < 0) { var f = d0 / (d0 - d1); az = { x: a[0] + f * (b[0] - a[0]), T: a[2] + f * (b[2] - a[2]) }; }
      }
      d.forEach(function (p) { var bb = T.bubble(eq.sys, p[0], T.mmHg(P)); dT = Math.max(dT, Math.abs(bb.T - p[2])); dy = Math.max(dy, Math.abs(bb.y - p[1])); });
      var m = eq.azeotrope;
      t += '<tr><td>' + (P === 101.325 ? '101.325 kPa（1 atm）' : P + ' kPa') + '</td><td class="num">' + az.x.toFixed(4) + ' · ' + az.T.toFixed(2) + ' °C</td><td class="num">' + m.x.toFixed(4) + ' · ' + m.T.toFixed(2) + ' °C</td><td class="num">' + (m.x - az.x >= 0 ? '+' : '') + (m.x - az.x).toFixed(4) + '</td><td class="num">' + dT.toFixed(2) + ' °C</td><td class="num">' + dy.toFixed(4) + '</td></tr>';
    });
    var R = A.radfrac, sp = R.spec, bt = T.makeEq('bt');
    var r = T.rateColumn(bt, { N: sp.N - 1, feedStage: sp.feedStage - 1, R: sp.R, DF: sp.DF, xF: sp.z });
    var mx = [r.xD].concat(r.stages.map(function (q) { return q.x; }));
    var mT = [bt.T(r.xD)].concat(r.stages.map(function (q) { return q.T; }));
    var dx = 0, dTT = 0;
    mx.forEach(function (v, i) { dx = Math.max(dx, Math.abs(v - R.x[i])); dTT = Math.max(dTT, Math.abs(mT[i] - R.T[i])); });
    t += '<tr><td>苯–甲苯 RadFrac 基准塔<span class="asof">16 级 · 第 8 级进料 · R 1.9 · D/F 0.45 · IDEAL</span></td><td class="num">xD ' + R.x[0].toFixed(4) + '<br>xW ' + R.x[15].toFixed(4) + '</td><td class="num">xD ' + r.xD.toFixed(4) + '<br>xW ' + r.xW.toFixed(4) + '</td><td class="num">逐级 ≤ ' + dx.toFixed(3) + '</td><td class="num">' + dTT.toFixed(2) + ' °C</td><td class="num">Q<sub>R</sub> ' + R.Qr.toFixed(0) + ' kW（Aspen）</td></tr>';
    t += '</tbody></table>';
    $('aspenTable').innerHTML = t;
  }

  var MYTHS = [
    ['沸点低的组分会先“全部”蒸出来，然后才轮到沸点高的。', '两个组分同时汽化，只是气相中轻组分的比例更高（<code>y &gt; x</code>）。单次汽化得不到纯物质，这正是需要多级精馏的原因。', '模块 A / B'],
    ['塔板越多越好，回流比越大越好。', '板数增加与回流比增大都能提高纯度，但都有代价：设备费、能耗。在 Rmin 附近板数趋于无穷，在全回流时能耗无穷大、产量为零。', '模块 C / D'],
    ['回流比低于最小回流比只是“效果差一点”。', '低于 Rmin 时操作线与平衡线相交，出现夹紧点：<b>无论多少块板</b>都达不到指定的塔顶纯度。', '模块 C'],
    ['理论板数就是实际要装的塔板数。', '真实塔板达不到平衡，Murphree 效率常见 50–90 %。实际板数 ≈ 理论板数 / 全塔效率，填料塔则用 HETP 换算高度。', '模块 H'],
    ['只要塔够高，普通精馏能把乙醇提到 100 %。', '1 atm 下乙醇–水在 x ≈ 0.894（95.6 wt%）形成最低恒沸物，此处 y = x，再多塔板也越不过去。需要共沸/萃取/变压精馏或分子筛等手段。', '模块 F'],
    ['恒沸物是一种化合物。', '恒沸组成会随压力改变（变压精馏就利用这一点），说明它只是特定条件下的相平衡状态，不是化学计量确定的化合物。', '模块 F'],
    ['水蒸气蒸馏是靠水把有机物“带出来”，温度一定是 100 °C。', '互不相溶的两种液体各自贡献全部蒸气压，总压达到外压时就沸腾，所以沸腾温度低于两者各自的沸点（甲苯–水约 84 °C）。', '模块 G'],
    ['减压只是让蒸馏变快。', '减压的主要目的是降低沸腾温度，保护热敏物料；同时气体体积变大、塔径增大，相对挥发度也会随温度改变。', '模块 G'],
    ['进料从哪块板进都一样。', '最优进料位置在操作线交点处跨越的那一级；进料偏高或偏低都会让所需板数增加，偏离太多甚至无法完成分离。', '模块 C'],
    ['间歇精馏开着不动，塔顶纯度就会一直保持。', '釜液中的轻组分不断减少，恒回流操作时塔顶组成持续下降；要保持纯度，就必须逐步加大回流比，代价是时间与能耗。', '模块 E'],
    ['原油蒸馏能把每一种烃分离出来。', '原油含成千上万种化合物，常压塔按沸程切割成馏分；相邻馏分之间存在重叠或间隙，产品是混合物而非纯物质。', '模块 I'],
    ['加大蒸汽量一定能提高处理能力。', '气速超过上限会造成雾沫夹带和液泛，效率急剧下降；气速过低又会漏液。塔板只能在一个操作窗口内工作。', '模块 H']
  ];
  function renderMyths() {
    $('mythList').innerHTML = MYTHS.map(function (m, i) {
      return '<details class="myth"><summary><span class="num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span>' + m[0] + '</span><span class="where">' + m[2] + '</span></summary>' +
        '<div class="myth-body">' + m[1] + '</div></details>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /*  Custom x–y import                                                 */
  /* ------------------------------------------------------------------ */
  function parseXY(text) {
    var rows = String(text || '').split(/\r?\n/);
    var pts = [], errors = [];
    rows.forEach(function (line, i) {
      var s = line.trim();
      if (!s || /^#/.test(s)) return;
      var parts = s.split(/[,;\t ]+/).filter(Boolean);
      if (parts.length < 2) { errors.push('第 ' + (i + 1) + ' 行：需要两列'); return; }
      var x = Number(parts[0]), y = Number(parts[1]);
      if (!isFinite(x) || !isFinite(y)) { if (i > 0) errors.push('第 ' + (i + 1) + ' 行：无法解析数字'); return; }
      if (x < 0 || x > 1 || y < 0 || y > 1) { errors.push('第 ' + (i + 1) + ' 行：x、y 必须在 0–1 之间'); return; }
      pts.push([x, y]);
    });
    pts.sort(function (a, b) { return a[0] - b[0]; });
    var uniq = [];
    pts.forEach(function (p) { if (!uniq.length || Math.abs(uniq[uniq.length - 1][0] - p[0]) > 1e-9) uniq.push(p); });
    if (!uniq.length || uniq[0][0] > 0) uniq.unshift([0, 0]);
    if (uniq[uniq.length - 1][0] < 1) uniq.push([1, 1]);
    for (var k = 1; k < uniq.length; k++) {
      if (uniq[k][1] <= uniq[k - 1][1]) return { ok: false, errors: ['y 在 x = ' + uniq[k][0] + ' 处没有单调递增，无法反查 x(y)。'].concat(errors) };
    }
    if (uniq.length < 4) return { ok: false, errors: ['至少需要 2 个内部数据点。'].concat(errors) };
    return { ok: true, x: uniq.map(function (p) { return p[0]; }), y: uniq.map(function (p) { return p[1]; }), n: uniq.length, errors: errors };
  }
  function setImportStatus(html, cls) {
    var el = $('importStatus');
    el.className = 'import-status' + (cls ? ' ' + cls : '');
    el.innerHTML = html;
  }
  function handleImport(text, name) {
    var res = parseXY(text);
    if (!res.ok) { setImportStatus('<b>无法载入。</b><br>' + res.errors.slice(0, 3).join('<br>'), 'err'); return; }
    res.key = 'c' + Date.now();
    DL.data.custom = res;
    var eq = DL.eqFor('custom');
    var az = eq.azeotrope;
    setImportStatus('<b>已载入 ' + res.n + ' 个点</b>（来源：' + name + '）' + (az ? '<br>曲线在 x ≈ ' + az.x.toFixed(3) + ' 穿过对角线：恒沸点，xD 不能越过。' : '') +
      (res.errors.length ? '<br><span class="muted">跳过：' + res.errors.slice(0, 2).join('；') + '</span>' : '') +
      '<br><button class="btn sm" type="button" id="useImport">在 McCabe–Thiele 中查看</button>', 'good');
    $('useImport').addEventListener('click', function () {
      openModule('C', 0);
      if (state.inst && state.inst.apply) state.inst.apply({ sys: 'custom' });
      $('lab').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    DL.bus.emit('dl:data', res);
    if (state.def && (state.def.id === 'A' || state.def.id === 'C')) openModule(state.def.id, state.scene);
  }
  function initImport() {
    $('importFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { handleImport(String(reader.result || ''), file.name); };
      reader.onerror = function () { setImportStatus('读取文件失败。', 'err'); };
      reader.readAsText(file, 'utf-8');
    });
    $('importTemplate').addEventListener('click', function () {
      var eq = T.makeEq('bt'), lines = ['x,y'];
      for (var i = 0; i <= 10; i++) { var x = i / 10; lines.push(x.toFixed(2) + ',' + eq.y(x).toFixed(4)); }
      ui.download('distillation-lab-xy-template.csv', lines.join('\n') + '\n', 'text/csv');
    });
    $('importClear').addEventListener('click', function () {
      DL.data.custom = null;
      $('importFile').value = '';
      $('importText').value = '';
      setImportStatus('尚未导入。课程使用内置体系。');
      DL.bus.emit('dl:data', null);
      if (state.def && (state.def.id === 'A' || state.def.id === 'C')) openModule(state.def.id, state.scene);
    });
    $('importPaste').addEventListener('click', function () {
      var text = $('importText').value.trim();
      if (!text) { setImportStatus('文本框是空的。', 'err'); return; }
      handleImport(text, '粘贴内容');
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Wiring                                                            */
  /* ------------------------------------------------------------------ */
  function initTransport() {
    $('playScenes').addEventListener('click', function () {
      if (state.playing) { pause(); setStatus('已暂停', ''); } else play();
    });
    $('prevScene').addEventListener('click', function () { pause(); prevScene(); });
    $('nextScene').addEventListener('click', function () { pause(); nextScene(false); });
    $('replayScene').addEventListener('click', function () { replay(); });
    $('takeoverBtn').addEventListener('click', function () {
      if (state.playing) { pause(); setStatus('已接管', 'taken'); } else play();
    });
    $('dirSpeed').addEventListener('change', function (e) {
      state.speed = parseFloat(e.target.value) || 1;
      state.offset = 0;
      if (state.playing) startTimer();
    });
    $('voiceToggle').addEventListener('change', function (e) {
      state.voice = e.target.checked;
      if (!state.voice && window.speechSynthesis) window.speechSynthesis.cancel();
      if (state.voice) {
        var sc = state.def && state.def.scenes[state.scene];
        if (sc) speak(sc.title + '。' + stripTags(sc.body || ''));
      }
    });
    // Any manual interaction inside the bench takes over from the director.
    ['pointerdown', 'input', 'change'].forEach(function (ev) {
      $('lab').addEventListener(ev, function (e) {
        if (e.target.closest('.transport') || e.target.closest('.scene-dots') || e.target.closest('.scene-head')) return;
        if (!e.target.closest('#modulePanel') && !e.target.closest('#stageBody')) return;
        takeover();
      }, true);
    });
    document.addEventListener('keydown', function (e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      if (e.key === ' ' && e.target.closest && e.target.closest('#lab') && !e.target.closest('button')) {
        e.preventDefault();
        if (state.playing) { pause(); setStatus('已暂停', ''); } else play();
      }
      if (e.target.closest && e.target.closest('#lab') && !/^(BUTTON)$/.test(document.activeElement.tagName)) {
        if (e.key === 'ArrowRight') { pause(); nextScene(false); }
        if (e.key === 'ArrowLeft') { pause(); prevScene(); }
      }
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state.playing) { pause(); setStatus('已暂停', ''); }
    });
  }
  function initDownload() {
    $('downloadPage').addEventListener('click', function () {
      var clone = document.documentElement.cloneNode(true);
      ['heroColumn', 'heroChart', 'boilStrip', 'moduleList', 'stageBody', 'modulePanel', 'sceneDots', 'familyGrid', 'compTable', 'sysTable', 'dataSources', 'mythList'].forEach(function (id) {
        var el = clone.querySelector('#' + id);
        if (el) el.innerHTML = '';
      });
      clone.querySelectorAll('.chart-tip, .toast, .to-top').forEach(function (el) { el.remove(); });
      ui.download('distillation-lab-offline.html', '<!doctype html>\n' + clone.outerHTML, 'text/html');
      toast('已导出干净的离线副本（脚本会重新挂载实验）');
    });
  }
  function initToTop() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'to-top';
    b.setAttribute('aria-label', '回到页面顶部');
    b.innerHTML = '<span aria-hidden="true">↑</span><span class="to-top-label">顶部</span>';
    document.body.appendChild(b);
    function sync() { b.classList.toggle('show', (window.scrollY || window.pageYOffset) > 600); }
    window.addEventListener('scroll', sync, { passive: true });
    b.addEventListener('click', function () {
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
    sync();
  }

  function boot() {
    initTheme();
    try { initHero(); } catch (e) { console.error('hero', e); }
    initBoilStrip();
    renderFamily();
    renderData();
    renderMyths();
    initImport();
    initTransport();
    initDownload();
    initToTop();
    $('buildStamp').textContent = 'Distillation Lab · Antoine + Raoult / NRTL / van Laar · 恒摩尔流 · Aspen Plus V15 对照 · 教学模型，非工程设计';
    renderModuleList();
    var hash = (location.hash || '').match(/^#module-([A-J])$/);
    var first = hash ? hash[1] : (sortedModules()[0] && sortedModules()[0].id);
    if (first) openModule(first, 0);
    setStatus('手动模式', '');
    updatePlayButton();
  }

  DL.app = { openModule: openModule, takeover: takeover, toast: toast, state: state, modules: modules };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
