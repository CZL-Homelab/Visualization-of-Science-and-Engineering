/* Stock Market Lab — application shell: module registry, lesson director,
 * navigation, quizzes, data import and the static reference sections. */
(function () {
  'use strict';
  var SM = window.SM = window.SM || {};
  var ui = SM.ui;
  var charts = SM.charts;
  var core = SM.core;

  var modules = SM.modules;

  // Tiny event bus used for cross-module signals (e.g. imported datasets).
  var busMap = {};
  SM.bus = {
    on: function (k, fn) { (busMap[k] = busMap[k] || []).push(fn); },
    off: function (k, fn) { busMap[k] = (busMap[k] || []).filter(function (f) { return f !== fn; }); },
    emit: function (k, payload) { (busMap[k] || []).forEach(function (fn) { try { fn(payload); } catch (e) { console.error(e); } }); }
  };
  SM.data = SM.data || { import: null };

  var $ = function (id) { return document.getElementById(id); };
  var state = {
    modId: null, scene: 0, playing: false, speed: 1, voice: false,
    inst: null, def: null, timer: 0, offset: 0, startedAt: 0
  };
  var progress = loadProgress();
  var lastFocused = null;

  function loadProgress() {
    try {
      var raw = localStorage.getItem('sml.progress.v2');
      var parsed = raw ? JSON.parse(raw) : null;
      if (parsed && parsed.scenes && parsed.done) return parsed;
    } catch (e) { /* storage may be unavailable */ }
    return { scenes: {}, done: {} };
  }
  function saveProgress() {
    try { localStorage.setItem('sml.progress.v2', JSON.stringify(progress)); } catch (e) { /* ignore */ }
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
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = $('themeToggle');
    if (btn) {
      btn.textContent = theme === 'dark' ? '浅色' : '深色';
      btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    }
    try { localStorage.setItem('sml.theme', theme); } catch (e) { /* ignore */ }
    window.dispatchEvent(new Event('sm:theme'));
  }
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('sml.theme'); } catch (e) { /* ignore */ }
    var theme = saved || 'dark';
    applyTheme(theme);
    $('themeToggle').addEventListener('click', function () {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Hero + index strip                                                */
  /* ------------------------------------------------------------------ */
  function initHero() {
    var host = $('heroChart');
    if (!host) return;
    var candles = SM.datasets.heroCandles();
    var closes = candles.map(function (c) { return c.c; });
    var p = charts.palette();
    var hiIdx = 0, loIdx = 0;
    candles.forEach(function (c, i) {
      if (c.h > candles[hiIdx].h) hiIdx = i;
      if (c.l < candles[loIdx].l) loIdx = i;
    });
    charts.kline(host, {
      candles: candles, market: 'cn', fill: 'hollow', showVolume: true,
      visibleCount: 64, interactive: false, volumeMA: [],
      overlays: [
        { name: 'MA10', values: core.ma(closes, 10), color: p.orange, width: 1 },
        { name: 'MA30', values: core.ma(closes, 30), color: p.violet, width: 1 }
      ],
      markers: [
        { index: hiIdx, price: candles[hiIdx].h, text: '4258.86', color: p.red, dir: 'down' },
        { index: loIdx, price: candles[loIdx].l, text: '3574.27', color: p.green, dir: 'up' }
      ],
      label: '示例周 K 线：上证指数形态的教学模拟'
    });
  }

  function initIndexStrip() {
    var host = $('indexStrip');
    if (!host) return;
    var rows = SM.datasets.indexSnapshot();
    var html = rows.map(function (r) {
      var cls = r.pct > 0 ? 'up' : (r.pct < 0 ? 'down' : 'flat');
      return '<div class="idx"><div class="idx-name">' + r.name + '<em>' + r.code + '</em></div>' +
        '<div class="idx-val">' + r.value.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) + '</div>' +
        '<div class="idx-chg ' + cls + '">' + (r.pct >= 0 ? '+' : '') + r.pct.toFixed(2) + '%</div></div>';
    }).join('');
    host.innerHTML = html + '<p class="index-note">演示快照，非实时行情。指数点位是加权计算结果，不是任何一只股票的价格。</p>';
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
    $('stageHint').textContent = sc.guide || def.hint || '拖动图表、调整滑块，观察数字如何一起变化。';
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
  /*  Rules + misconceptions                                            */
  /* ------------------------------------------------------------------ */
  function renderRules() {
    var r = SM.rules;
    var t = $('rulesTable');
    var html = '<table class="rules-table"><thead><tr><th>维度 / Dimension</th><th class="cn-cell">A 股</th><th class="us-cell">美股</th></tr></thead><tbody>';
    r.comparison.forEach(function (row) {
      html += '<tr><td>' + row.dimension + '<span class="asof">' + (row.note || '') + '</span></td>' +
        '<td class="cn-cell">' + row.cn + '</td><td class="us-cell">' + row.us + '</td></tr>';
    });
    html += '</tbody></table>';
    t.innerHTML = html;
    var src = '<span>规则核对日期 ' + r.asOf + ' · 来源：</span>';
    src += r.sources.map(function (s) {
      return '<a href="' + s.url + '" target="_blank" rel="noopener" title="' + (s.note || '') + '">' + s.label + '</a>';
    }).join('');
    $('ruleSources').innerHTML = src;
  }

  var MYTHS = [
    ['收出阳线，就说明今天股价上涨了。', '阳线只说明<code>收盘价 &gt; 开盘价</code>，即相对当天开盘上涨。行情软件显示的“涨跌幅”通常对比<strong>上一交易日收盘价</strong>。低开高走仍可能收出阳线却录得负涨跌幅。', '模块 B2'],
    ['开盘价、最高价、最低价、收盘价可以随便填，只要看起来像 K 线。', '四价必须满足 <code>low ≤ min(open, close) ≤ max(open, close) ≤ high</code>。实验台会拒绝并解释越界输入，因为越界 K 线在真实数据中不可能存在。', '模块 B1'],
    ['一根日 K 线能还原当天价格是怎么走的。', '一根 K 线只有四个价格和一个成交量。当天可能先跌 5% 再拉回，也可能一路阴跌，K 线可以完全相同。要还原路径需要更细的周期或逐笔数据。', '模块 B4'],
    ['成交量放大，说明买盘比卖盘多。', '每一笔成交都同时有一个买方和一个卖方，成交量统计的是成交股数，不是净买入。放量只说明换手更活跃，方向要看价格与订单簿。', '模块 C1 / D'],
    ['公司市值上涨，公司就拿到了现金。', '二级市场买卖发生在投资者之间，钱进的是卖出方的账户。只有 IPO、增发、配股等<strong>一级市场</strong>发行，公司才收到募集资金。', '模块 A2 / F'],
    ['IPO 募资额就是公司上市后的总市值。', '募资 = 新发行股数 × 发行价；总市值 = 上市后总股本 × 市价。两者口径不同，老股并不会因为上市自动变成公司现金。', '模块 F1'],
    ['拆股让股东的财富增加了。', '拆股只改变股数与每股价格的比例，持股比例和总市值不变（忽略交易摩擦）。10 拆 2 后股价约为一半、股数翻倍。', '模块 A1 / F4'],
    ['增发和拆股差不多，都是股本变大。', '拆股不募资、不改变公司价值；增发会带来新资金（或资产），同时稀释原股东持股比例。两者现金流方向完全不同。', '模块 F3 / F4'],
    ['A 股 T+1 和美股 T+1 是同一件事。', 'A 股 T+1 是<strong>回转限制</strong>：当日买入的股票当日不能卖出。美股 T+1 是<strong>交收周期</strong>：成交后一个工作日完成证券与资金交收，通常不妨碍当日回转交易（受账户规则约束）。', '模块 E1'],
    ['市盈率就是几年回本。', 'PE = 股价 / 每股收益，是估值倍数。只有在利润不变、全部分红、折现率为零等强假设下，才近似“回本年数”。增长与风险会改变合理倍数。', '模块 G'],
    ['RSI 超卖，价格就该反弹了。', 'RSI 只描述过去一段涨跌幅度的强弱。强趋势中 RSI 可以长期钝化在低位或高位，指标不包含未来信息，也不构成买卖信号。', '模块 C3'],
    ['杠杆只是把收益放大，亏损不会更糟。', '融资买入同时放大亏损，并产生利息与维持担保比例约束。价格下跌会先侵蚀自有资金，跌破维持比例可能被强制平仓，反弹也来不及参与。', '模块 H'],
    ['交易所规则、券商规则和我的账户规则是一回事。', '交易所规定交易机制，券商在此基础上加收费用、设置风控与适当性要求，账户类型（如融资融券、PDT）又不同。实验里的费率都是可改的示例。', '模块 D3 / E'],
    ['模拟出来的收益率可以作为未来预测。', '所有路径、需求曲线与收益分布都是固定种子的教学模型，用来展示机制与风险，不含任何预测能力，也不构成投资建议。', '模块 I / J']
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
  /*  Data import                                                       */
  /* ------------------------------------------------------------------ */
  function setImportStatus(html, cls) {
    var el = $('importStatus');
    el.className = 'import-status' + (cls ? ' ' + cls : '');
    el.innerHTML = html;
  }

  function handleImport(text, name) {
    var res;
    try { res = SM.datasets.parseImport(text, { sourceName: name || '粘贴内容' }); }
    catch (err) { setImportStatus('解析失败：' + (err.message || err), 'err'); return; }
    if (!res.ok) {
      var errs = (res.errors || []).slice(0, 3).map(function (e) { return typeof e === 'string' ? e : ((e.row ? '第 ' + e.row + ' 行：' : '') + (e.message || e)); }).join('<br>');
      setImportStatus('<b>无法载入。</b><br>' + (errs || '没有可用的数据行。'), 'err');
      return;
    }
    SM.data.import = res;
    var first = res.candles[0], last = res.candles[res.candles.length - 1];
    var range = ui.fmt.date(first.t) + ' → ' + ui.fmt.date(last.t);
    var warn = (res.warnings || []).length ? '<br><span class="muted">提示：' + res.warnings.slice(0, 3).join('；') + '</span>' : '';
    setImportStatus('<b>已载入 ' + res.candles.length + ' 根 K 线</b>（来源：' + (name || '粘贴内容') + '）<br>' +
      '时间范围 ' + range + ' · 时区按本地解释 · 币种/复权状态未说明<br>' +
      '<button class="btn sm" type="button" id="useImport">在 K 线实验室查看</button>' + warn, 'good');
    $('useImport').addEventListener('click', function () {
      openModule('B', 4);
      $('lab').scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(function () { SM.bus.emit('sm:data', res); }, 60);
    });
    SM.bus.emit('sm:data', res);
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
      SM.ui.download('stock-market-lab-template.csv', SM.datasets.templateCSV(), 'text/csv;charset=utf-8');
    });
    $('importClear').addEventListener('click', function () {
      SM.data.import = null;
      $('importFile').value = '';
      $('importText').value = '';
      setImportStatus('尚未导入。课程将使用模拟数据。');
      SM.bus.emit('sm:data', null);
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
    // Any interaction inside the lab bench counts as manual takeover.
    ['pointerdown', 'input', 'change'].forEach(function (ev) {
      $('lab').addEventListener(ev, function (e) {
        if (e.target.closest('.transport') || e.target.closest('.scene-dots') || e.target.closest('.scene-head')) return;
        if (!e.target.closest('#modulePanel') && !e.target.closest('#stageBody')) return;
        takeover();
      }, true);
    });
    document.addEventListener('keydown', function (e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      if (e.key === ' ' && !e.target.closest('.chart')) {
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
      var html = '<!doctype html>\n' + document.documentElement.outerHTML;
      SM.ui.download('stock-market-lab-offline.html', html, 'text/html;charset=utf-8');
      toast('已导出当前页面的单文件副本');
    });
  }

  function initBuildStamp() {
    $('buildStamp').textContent = 'Stock Market Lab · 规则核对 ' + SM.rules.asOf + ' · 教学模拟 · 非投资建议';
  }

  function boot() {
    initTheme();
    initHero();
    initIndexStrip();
    renderRules();
    renderMyths();
    initImport();
    initTransport();
    initDownload();
    initBuildStamp();
    renderModuleList();
    var first = sortedModules()[0];
    if (first) openModule(first.id, 0);
    setStatus('手动模式', '');
    updatePlayButton();
  }

  SM.app = {
    openModule: openModule,
    takeover: takeover,
    toast: toast,
    state: state,
    modules: modules
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
