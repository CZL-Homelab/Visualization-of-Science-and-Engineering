/* Desalination Lab — application shell: module registry consumption,
 * lesson director, navigation, quizzes and the static reference sections. */
(function () {
  'use strict';
  var DL = window.DL = window.DL || {};
  var ui = DL.ui;
  var charts = DL.charts;
  var sim = DL.sim;

  var modules = DL.modules;

  var busMap = {};
  DL.bus = {
    on: function (k, fn) { (busMap[k] = busMap[k] || []).push(fn); },
    off: function (k, fn) { busMap[k] = (busMap[k] || []).filter(function (f) { return f !== fn; }); },
    emit: function (k, payload) { (busMap[k] || []).forEach(function (fn) { try { fn(payload); } catch (e) { console.error(e); } }); }
  };

  var $ = function (id) { return document.getElementById(id); };
  var state = {
    modId: null, scene: 0, playing: false, speed: 1, voice: false,
    inst: null, def: null, timer: 0, offset: 0, startedAt: 0
  };
  var progress = loadProgress();

  function loadProgress() {
    try {
      var raw = localStorage.getItem('dl.progress.v1');
      var parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.scenes && parsed.done) return parsed;
    } catch (e) { /* storage may be unavailable */ }
    return { scenes: {}, done: {} };
  }
  function saveProgress() {
    try { localStorage.setItem('dl.progress.v1', JSON.stringify(progress)); } catch (e) { /* ignore */ }
  }

  function toast(msg) {
    var el = ui.el('div', 'toast', msg);
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('out'); }, 2100);
    setTimeout(function () { el.remove(); }, 2600);
  }

  /* ------------------------------------------------------------------ */
  /*  Theme                                                             */
  /* ------------------------------------------------------------------ */
  function initTheme() { window.CZLLabTheme.mount(); }

  /* ------------------------------------------------------------------ */
  /*  Hero + stats strip                                                */
  /* ------------------------------------------------------------------ */
  function initHero() {
    var host = $('heroChart');
    if (!host) return;
    var ladder = sim.salinityLadder();
    charts.bars(host, {
      labels: ladder.map(function (r) { return r.name; }),
      values: ladder.map(function (r) { return r.tds; }),
      colors: ladder.map(function (r) { return r.color; }),
      log: true,
      threshold: 500,
      thresholdLabel: '饮用水参考 500 mg/L',
      valueFormat: function (v) { return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v); },
      yFormat: function (v) { return v >= 1000 ? (v / 1000) + 'k' : String(v); },
      label: 'TDS mg/L · 对数轴'
    });
  }

  function initIndexStrip() {
    var host = $('indexStrip');
    if (!host) return;
    var rows = DL.reference.stats;
    host.innerHTML = rows.map(function (r) {
      return '<div class="idx"><div class="idx-name">' + r.label + '<em>' + r.note + '</em></div>' +
        '<div class="idx-val">' + r.value + '</div>' +
        '<div class="idx-chg flat">' + r.unit + '</div></div>';
    }).join('') + '<p class="index-note">行业数字为公开报告口径（核对 ' + DL.reference.asOf + '），不是实时数据；引用请注明来源与日期。</p>';
  }

  /* ------------------------------------------------------------------ */
  /*  Module navigation                                                 */
  /* ------------------------------------------------------------------ */
  function sortedModules() { return modules.slice().sort(function (a, b) { return a.order - b.order; }); }

  function renderModuleList() {
    var host = $('moduleList');
    host.innerHTML = '';
    sortedModules().forEach(function (def) {
      var btn = ui.el('button', 'mod' + (progress.done[def.id] ? ' done' : ''));
      btn.type = 'button';
      btn.setAttribute('aria-current', def.id === state.modId ? 'true' : 'false');
      btn.dataset.mod = def.id;
      btn.innerHTML = '<span class="mod-id">' + def.id + '</span><span>' +
        '<span class="mod-title">' + def.title + '</span>' +
        '<span class="mod-sub">' + (def.en || '') + '</span></span>';
      btn.addEventListener('click', function () { openModule(def.id, 0); });
      host.appendChild(btn);
    });
    var done = sortedModules().filter(function (d) { return progress.done[d.id]; }).length;
    $('progressText').textContent = done + ' / ' + sortedModules().length;
    $('progressBar').style.width = (done / Math.max(1, sortedModules().length) * 100) + '%';
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
    renderQuiz(def);
    $('takeoverBtn').hidden = def.scenes.length < 2;
    saveProgress();
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
    $('stageHint').textContent = sc.guide || def.hint || '拖动滑块、切换场景，观察数字如何一起变化。';
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
    var seen = progress.scenes[def.id] = progress.scenes[def.id] || [];
    if (seen.indexOf(i) < 0) seen.push(i);
    if (i === def.scenes.length - 1) progress.done[def.id] = true;
    saveProgress();
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
    if (!state.def) return;
    if (state.timer) return;
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
    setStatus('本模块完成', 'live');
    progress.done[state.def.id] = true;
    saveProgress();
    renderModuleList();
    if (auto) toast('「' + state.def.title + '」讲解结束，可继续选择下一模块');
  }
  function prevScene() {
    if (!state.def) return;
    var i = Math.max(0, state.scene - 1);
    state.offset = 0;
    applyScene(i);
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
  /*  Quiz                                                              */
  /* ------------------------------------------------------------------ */
  function renderQuiz(def) {
    var host = $('quizMount');
    host.innerHTML = '';
    var qs = def.quiz || [];
    var head = ui.el('div', 'quiz-set');
    head.innerHTML = '<span>当前模块 · ' + def.id + ' ' + def.title + '</span><span>共 ' + qs.length + ' 题 · 点击选项立即判定</span>';
    host.appendChild(head);
    if (!qs.length) {
      host.appendChild(ui.el('p', 'small muted', '本模块暂无自测题，请在实验台里完成一次参数实验。'));
      return;
    }
    qs.forEach(function (q, qi) {
      var card = ui.el('div', 'quiz-card');
      card.innerHTML = '<div class="quiz-q"><span class="tag">Q' + (qi + 1) + '</span> ' + q.q + '</div>';
      var opts = ui.el('div', 'quiz-opts');
      q.options.forEach(function (opt, oi) {
        var b = ui.el('button', 'quiz-opt');
        b.type = 'button';
        b.innerHTML = '<span class="k">' + 'ABCDEF'[oi] + '</span><span>' + opt + '</span>';
        b.addEventListener('click', function () {
          if (card.dataset.answered) return;
          card.dataset.answered = '1';
          Array.prototype.forEach.call(opts.children, function (el, k) {
            if (k === q.answer) el.classList.add('right');
            else if (k === oi) el.classList.add('wrong');
            el.disabled = true;
          });
          card.querySelector('.quiz-explain').classList.add('on');
        });
        opts.appendChild(b);
      });
      card.appendChild(opts);
      var ex = ui.el('div', 'quiz-explain', q.explain || '');
      card.appendChild(ex);
      host.appendChild(card);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Reference + misconceptions                                        */
  /* ------------------------------------------------------------------ */
  function renderRules() {
    var r = DL.reference;
    var t = $('rulesTable');
    var html = '<table class="rules-table"><thead><tr><th>维度 / Dimension</th><th class="cn-cell">口径 A</th><th class="us-cell">口径 B / 边界</th></tr></thead><tbody>';
    r.comparison.forEach(function (row) {
      html += '<tr><td>' + row.dimension + '</td>' +
        '<td class="cn-cell">' + row.a + '</td><td class="us-cell">' + row.b + '</td></tr>';
    });
    html += '</tbody></table>';
    t.innerHTML = html;
    var src = '<span>口径核对日期 ' + r.asOf + ' · 来源：</span>';
    src += r.sources.map(function (s) {
      return '<a href="' + s.url + '" target="_blank" rel="noopener" title="' + (s.note || '') + '">' + s.label + '</a>';
    }).join('');
    $('ruleSources').innerHTML = src;
  }

  var MYTHS = [
    ['淡化产水是"纯净水"，直接喝最好。', 'RO 产水几乎不含矿物质（TDS 常低于 300 mg/L），口感差、有腐蚀性，也不补矿物质。市政供水必须<b>再矿化</b>（溶入石灰石/方解石等）到合适的钙与碱度，再并网。', '模块 A / G'],
    ['膜就是更细的筛子，把盐颗粒挡住。', '溶解的 Na⁺/Cl⁻ 不是颗粒，比筛孔小得多。RO 膜是致密聚酰胺层，靠<b>溶解-扩散</b>与电荷排斥让水分子优先透过，离子被水合层与 Donnan 排斥拒于膜外。', '模块 E'],
    ['渗透压不需要外界能量，水自己就会"吸"过来。', '渗透是自由能下降的方向，但要<b>反</b>渗透必须施加高于渗透压的压力——海水侧约 27 bar。能量省不掉：理论最小分离功约 1.06 kWh/m³（文献值）。', '模块 B / F'],
    ['截留率 99.3%，产水里就没有盐。', '1 − 99.3% = 0.7%：35,000 mg/L 海水的产水仍有约 <b>245 mg/L</b> TDS，正好贴近饮用水感官参考线。截留率再高一档，产水才能降到 100 mg/L 以下。', '模块 C'],
    ['回收率可以随便调高，多产水产。', '回收率越高，浓水侧盐度越高，硫酸钙/碳酸钙超饱和就会在膜面结垢，产水量永久损失。海水 RO 常规回收率被约束在 <b>35–45%</b>，加阻垢剂也只是把阈值后移。', '模块 C / E'],
    ['浓盐水直接倒回海里没有任何影响。', '浓盐水量约为进水的 50–65%、盐度接近翻倍。排放必须用扩散器制造快速稀释，近场盐度羽流与取水卷吸（impingement）都要做环评，不是"倒回去就完事"。', '模块 G'],
    ['太阳能蒸馏"不花钱"，所以最便宜。', '太阳能蒸馏燃料为零，但产水密度只有每平方米每天几升，土地、存储与泵送成本让单位水价并不低；它适合小规模离网场景，不适合百万级城市供水。', '模块 F'],
    ['蒸馏法就是把海水烧开。', 'MSF 在<b>低于常压沸点</b>的真空室里让热水"闪蒸"，靠逐级降压把一次蒸汽潜热反复利用（GEA 可达 8 左右）。把海水烧开一次只产一次蒸汽，能耗会高得离谱。', '模块 D'],
    ['RO 能耗只有 MSF 三分之一，所以任何场合都该选 RO。', 'RO 电耗确实低（约 3–4.5 kWh/m³ vs MSF 8–11），但进水水质、膜污染、场地与既有热电厂余热（MED 常与发电耦合）都会改变结论；能耗口径也必须统一成 GED 才能比。', '模块 F'],
    ['淡化厂建成之后能耗就固定了。', '同一种工艺，能耗随回收率、进水温度、膜污染、能量回收装置与调度大幅变化；文献给的是区间（如 SWRO 2.5–4.5 kWh/m³），任何单一数字都只是某工况。', '模块 C / F']
  ];

  function renderMyths() {
    var host = $('mythList');
    host.innerHTML = MYTHS.map(function (m, i) {
      return '<details class="myth"><summary><span class="num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span>' + m[0] + '</span><span class="where">' + m[2] + '</span></summary>' +
        '<div class="myth-body">' + m[1] + '</div></details>';
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /*  Wiring                                                            */
  /* ------------------------------------------------------------------ */
  function initTransport() {
    $('playScenes').addEventListener('click', function () {
      if (state.playing) { pause(); setStatus('已暂停', ''); }
      else { play(); }
    });
    $('prevScene').addEventListener('click', function () { pause(); prevScene(); });
    $('nextScene').addEventListener('click', function () { pause(); nextScene(false); });
    $('replayScene').addEventListener('click', function () { replay(); });
    $('takeoverBtn').addEventListener('click', function () {
      if (state.playing) { pause(); setStatus('已接管', 'taken'); }
      else play();
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
    ['pointerdown', 'input', 'change'].forEach(function (ev) {
      $('lab').addEventListener(ev, function (e) {
        if (e.target.closest('.transport') || e.target.closest('.scene-dots') || e.target.closest('.scene-head')) return;
        if (!e.target.closest('#modulePanel') && !e.target.closest('#stageBody')) return;
        takeover();
      }, true);
    });
    document.addEventListener('keydown', function (e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (state.playing) { pause(); setStatus('已暂停', ''); } else play();
      }
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state.playing) { pause(); setStatus('已暂停', ''); }
    });
  }

  function initDownload() {
    $('downloadPage').addEventListener('click', function () {
      var clone = document.documentElement.cloneNode(true);
      ['heroChart', 'indexStrip', 'moduleList', 'stageBody', 'modulePanel', 'sceneDots', 'quizMount'].forEach(function (id) {
        var el = clone.querySelector('#' + id);
        if (el) el.innerHTML = '';
      });
      clone.querySelectorAll('.chart-tip, .toast').forEach(function (el) { el.remove(); });
      var html = '<!doctype html>\n' + clone.outerHTML;
      DL.ui.download('desalination-lab-offline.html', html, 'text/html;charset=utf-8');
      toast('已导出干净的离线副本（脚本会重新挂载实验）');
    });
  }

  function initBuildStamp() {
    $('buildStamp').textContent = 'Desalination Lab · 口径核对 ' + DL.reference.asOf + ' · 教学模型 · 非工程仿真';
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
    initHero();
    initIndexStrip();
    renderRules();
    renderMyths();
    initTransport();
    initDownload();
    initBuildStamp();
    initToTop();
    renderModuleList();
    var first = sortedModules()[0];
    if (first) openModule(first.id, 0);
    setStatus('手动模式', '');
    updatePlayButton();
  }

  DL.app = {
    openModule: openModule,
    takeover: takeover,
    toast: toast,
    state: state,
    modules: modules
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
