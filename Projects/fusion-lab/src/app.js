/* Fusion Lab — application controller.
 *
 * Owns the theme, the tour (chapters, scenes, auto-play), the mapping from a
 * scene description to the 3D world, and the side-panel instruments.
 * Explicit pause and any manual input always win over the auto-director.
 */
(function () {
  'use strict';
  var FL = globalThis.FL = globalThis.FL || {};
  var THREE = globalThis.THREE;
  var C = FL.content, ref = FL.ref, ui = FL.ui;
  var $ = function (id) { return document.getElementById(id); };
  var DEG = Math.PI / 180;

  var LEGEND = {
    proton: ['质子', '#ff5b4a'], neutron: ['中子', '#8ea3c2'], coulomb: ['库仑斥力', '#6aa8ff'],
    d: ['氘核', '#58c8f0'], t: ['氚核', '#f0a04a'], e: ['电子', '#e8ecf5'], he: ['α 粒子（氦核）', '#c9e265'], n: ['中子', '#cfe0ff'],
    plasma: ['等离子体', '#ff7fdc'], strike: ['打击点', '#ff8a3c'], heat: ['被加热的包层', '#ff6a3d'],
    field: ['磁力线', '#58d8ff', 1], current: ['电流', '#ffd27a', 1], nbi: ['中性束', '#8fd2ff', 1], ec: ['电子回旋波', '#7dffa0', 1], ic: ['离子回旋波', '#ffa24a', 1],
    dPipe: ['氘', '#58d8ff', 1], tPipe: ['氚', '#ffa64a', 1], dtPipe: ['氘氚混合气', '#c78bff', 1], hePipe: ['氦', '#c9e265', 1],
    hot: ['热段', '#ff6a3d', 1], cold: ['冷段 / 给水', '#4f8dff', 1], steam: ['蒸汽', '#e8f0ff', 1], power: ['电力', '#ffe45c', 1]
  };
  var ALL_LAYERS = ['cs', 'tf', 'pf', 'vessel', 'blanket', 'divertor', 'cryostat'];
  var INTRO = {
    id: 'intro', title: '七章，从一次反应到一座电站', cap: '', set: 'machine', layers: ALL_LAYERS, cut: 'onion',
    fx: { plasma: 1, heat: 0.75, particles: 0.8, strike: 0.9, neutrons: 0.6, alphas: 0.6, blanketHeat: 0.5 },
    shot: { t: [4.5, 0.6, 0], az: 30, pol: 68, d: 50 }, spin: 0.05, labels: [],
    body: ['可以跟着自动讲解从头看到尾，也可以跳到任意一章。每一幕都能拖动三维模型，右侧的仪器可以随时自己调。'],
    panel: { type: 'toc' }
  };

  var app = FL.app = {
    index: -1, scene: INTRO, playing: false, elapsed: 0, speed: 1, part: null,
    pulseT: 0, pulseManual: false, pulseAnim: null, instrument: null, started: false, seen: {}
  };

  /* ---------- theme (repository-wide convention) ---------- */
  function initTheme() { window.CZLLabTheme.mount(); }

  /* ---------- 3D world ---------- */
  function initWorld() {
    var engine = app.engine = new FL.Engine($('view'), $('hud'));
    if (!engine.ok) { $('fallback').hidden = false; $('stage').classList.add('no-gl'); }
    else engine.buildEnvironment();
    var key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(22, 40, 30);
    var rim = new THREE.DirectionalLight(0x8fb4ff, 0.9); rim.position.set(-30, 12, -24);
    engine.scene.add(key, rim, new THREE.HemisphereLight(0x9bb4ff, 0x1c2028, 0.55));
    app.tokamak = new FL.Tokamak(engine);
    app.effects = new FL.Effects(engine, app.tokamak);
    app.plant = new FL.Plant(engine);
    app.micro = new FL.Micro(engine);
    engine.scene.add(app.tokamak.group, app.effects.group, app.plant.group, app.micro.group);
    app.micro.onPhase = function () { if (app.scene.labels === 'micro') engine.setLabels(app.micro.labels()); };
    engine.addUpdater(update);
    engine.on('interact', function () { takeover(); });
    engine.on('pick', function (part) { if (part) app.selectPart(part === app.part ? null : part, true); });
    if (FL.reducedMotion()) setMotion(false);
  }

  function anchor(a) {
    if (a[0] === 'tk') return app.tokamak.anchor(a[1], a[2], a[3], a[4]);
    if (a[0] === 'fx') return app.effects.anchors[a[1]];
    if (a[0] === 'pl') { var p = app.plant.anchors[a[1]]; return p; }
    if (a[0] === 'torus') return FL.fx.pos3(app.tokamak.shape, a[1], a[2] * DEG, a[3] * DEG);
    return new THREE.Vector3(a[1], a[2], a[3]);
  }
  function setLabels(list) {
    app.engine.setLabels((list || []).map(function (l) { return { id: l.id, text: l.text, sub: l.sub, tone: l.tone, side: l.side, at: anchor(l.at) }; }));
  }

  /* the per-frame hook: tour clock, pulse clock, all 3D updaters */
  function update(time, dt, raw) {
    var s = app.scene;
    if (app.playing && app.engine.clock.running) {
      app.elapsed += raw * app.speed;
      var dur = sceneDuration(s);
      $('directorBar').style.width = Math.min(100, app.elapsed / dur * 100) + '%';
      if (app.elapsed >= dur) {
        if (app.index < C.SCENES.length - 1) goScene(app.index + 1, false);
        else setPlaying(false, '讲解结束');
      }
    }
    if (s.pulse && app.pulseAnim && !app.pulseManual && app.engine.clock.running) {
      var a = app.pulseAnim;
      a.t = Math.min(1, a.t + raw * app.speed / a.dur);
      app.pulseT = a.from + (a.to - a.from) * a.t;
    }
    if (s.pulse) app.effects.set(C.pulse(app.pulseT).fx);
    if (app.fadeDir) {
      app.engine.fade = Math.min(1, Math.max(0, app.engine.fade + app.fadeDir * raw * 5));
      if (app.fadeDir < 0 && app.engine.fade <= 0) { var fn = app.fadeThen; app.fadeThen = null; app.fadeDir = 1; if (fn) fn(); }
      else if (app.fadeDir > 0 && app.engine.fade >= 1) app.fadeDir = 0;
    }
    app.tokamak.update(time, dt, raw);
    app.effects.update(time, dt, raw);
    app.plant.update(time, dt, raw);
    app.micro.update(time, dt);
    if (app.instrument && app.instrument.tick) app.instrument.tick(time);
  }
  function sceneDuration(s) {
    var chars = (s.body || []).join('').replace(/<[^>]+>/g, '').length;
    return Math.min(34, Math.max(15, 9 + chars * 0.085));
  }

  function applyWorld(s, instant) {
    var micro = s.set === 'micro', wasMicro = app.micro.group.visible;
    var swap = function () {
      app.micro.group.visible = micro;
      app.tokamak.group.visible = app.effects.group.visible = app.plant.group.visible = !micro;
      app.engine.params.bloom = micro ? 0.7 : 0.9;
      app.engine.params.vignette = micro ? 0.75 : 0.55;
      app.engine.flyTo(s.shot, 0);
      configure();
    };
    var configure = function () {
      if (micro) {
        app.micro.setPlay(s.micro.play, { fuseChance: s.micro.fuseChance == null ? 1 : s.micro.fuseChance, hot: s.micro.hot, restart: true });
        if (!app.engine.clock.running) app.micro.t = 4.1;          // a paused stage still shows the outcome
      } else {
        app.tokamak.setCut(s.cut || 'onion');
        app.tokamak.setLayers(s.layers || ALL_LAYERS, s.focus || null);
        app.tokamak.setExplode(s.explode || 0);
        app.effects.reset();
        app.effects.setQ(s.q || 3, !!s.toroidalOnly);
        if (s.pulse) {
          app.pulseManual = false;
          app.pulseAnim = { from: s.pulse[0], to: s.pulse[1], t: 0, dur: Math.max(8, sceneDuration(s) * 0.8) };
          app.pulseT = app.engine.clock.running ? s.pulse[0] : s.pulse[1];
          app.effects.set(C.pulse(app.pulseT).fx);
        } else app.effects.set(s.fx || {});
        app.plant.show(s.plant || {});
        app.plant.emphasise(s.pipes || null);
      }
      if (s.labels === 'micro') app.engine.setLabels(app.micro.labels()); else setLabels(s.labels);
      app.engine.autoRotate = s.spin == null ? 0.03 : s.spin;
      app.engine.pickEnabled = !!(s.panel && s.panel.type === 'anatomy');
    };
    if (micro !== wasMicro && !instant && app.engine.ok) { app.engine.setLabels([]); app.fadeThen = swap; app.fadeDir = -1; }
    else if (micro !== wasMicro) swap();
    else { app.engine.flyTo(s.shot, instant ? 0 : 2.4); configure(); }
  }

  /* ---------- panel ---------- */
  function mountPanel(s) {
    var chapter = C.CHAPTERS[s.chapter];
    $('sceneChapter').textContent = chapter ? chapter.n + ' · ' + chapter.title : 'FUSION LAB';
    $('sceneCount').textContent = chapter ? '第 ' + (chapter.scenes.indexOf(s.index) + 1) + ' / ' + chapter.scenes.length + ' 幕' : '导览';
    $('sceneTitle').textContent = s.title;
    $('sceneBody').innerHTML = (s.body || []).map(function (p) { return '<p>' + p + '</p>'; }).join('');
    var n = $('sceneNote'); n.hidden = !s.note; n.textContent = s.note || '';
    $('hudKicker').textContent = chapter ? chapter.n + ' / ' + chapter.en : 'ITER · TOKAMAK';
    $('hudTitle').textContent = chapter ? s.title : '';
    $('caption').textContent = s.cap || '';
    $('legend').innerHTML = (s.legend || []).map(function (k) {
      var L = LEGEND[k]; return '<span><i class="' + (L[2] ? 'bar' : '') + '" style="--k:' + L[1] + '"></i>' + L[0] + '</span>';
    }).join('');
    $('modelBadge').textContent = s.set === 'micro' ? '比喻式动画 · 非物理仿真' : '教学示意 · 非工程仿真';
    if (app.instrument && app.instrument.dispose) app.instrument.dispose();
    var mount = $('inst'); mount.innerHTML = ''; mount.scrollTop = 0;
    app.part = null;
    var type = s.panel && s.panel.type;
    app.instrument = (type === 'toc' ? toc : FL.instruments[type])(mount, app, s.panel || {}) || null;
    if (s.panel && s.panel.part) app.selectPart(s.panel.part, false);
    $('panel').querySelector('.scene-head').scrollTop = 0;
  }
  function toc(mount) {
    var list = ui.h('div', 'toc');
    C.CHAPTERS.forEach(function (c) {
      var b = ui.h('button', '', '<em>' + c.n + '</em><span><b>' + c.title + '</b><small>' + c.blurb + '</small></span><i>' + c.scenes.length + ' 幕</i>');
      b.type = 'button';
      b.addEventListener('click', function () { goScene(c.scenes[0], true); });
      list.appendChild(b);
    });
    mount.appendChild(list);
    var p = ui.h('p', 'inst-note', '<b>操作：</b>拖动旋转 · 双指或点击后滚轮缩放 · Shift + 拖动平移。← → 键切换上一幕 / 下一幕。');
    mount.appendChild(p);
  }

  /* ---------- navigation ---------- */
  function buildNav() {
    var nav = $('chapterNav');
    C.CHAPTERS.forEach(function (c, i) {
      var b = ui.h('button', 'chapter-tab', '<em>' + c.n + '</em><b>' + c.title + '</b><small>' + c.en + '</small><i></i>');
      b.type = 'button'; b.dataset.ch = i;
      b.setAttribute('aria-label', '第 ' + (i + 1) + ' 章：' + c.title);
      b.addEventListener('click', function () { goScene(c.scenes[0], true); });
      nav.appendChild(b);
    });
  }
  function refreshNav() {
    var s = app.scene, ch = s.chapter;
    Array.prototype.forEach.call($('chapterNav').children, function (b, i) {
      var c = C.CHAPTERS[i], done = c.scenes.filter(function (k) { return app.seen[C.SCENES[k].id]; }).length;
      if (i === ch) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      b.querySelector('i').style.width = (done / c.scenes.length * 100) + '%';
      if (i === ch && b.scrollIntoView && b.parentElement.scrollWidth > b.parentElement.clientWidth) b.parentElement.scrollTo({ left: b.offsetLeft - 40, behavior: 'smooth' });
    });
    var dots = $('sceneDots'); dots.innerHTML = '';
    if (ch != null && ch >= 0) C.CHAPTERS[ch].scenes.forEach(function (k, n) {
      var sc = C.SCENES[k], d = ui.h('button', app.seen[sc.id] ? 'seen' : '');
      d.type = 'button'; d.setAttribute('role', 'tab'); d.setAttribute('aria-selected', String(k === app.index));
      d.setAttribute('aria-label', '第 ' + (n + 1) + ' 幕：' + sc.title); d.title = sc.title;
      d.addEventListener('click', function () { goScene(k, true); });
      dots.appendChild(d);
    });
    $('prevScene').disabled = app.index <= 0;
    $('nextScene').disabled = app.index >= C.SCENES.length - 1;
  }
  function goScene(which, manual, instant) {
    var idx = typeof which === 'string' ? C.SCENES.findIndex(function (s) { return s.id === which; }) : which;
    if (idx < 0 || idx >= C.SCENES.length) return;
    if (!app.started) dismissIntro();
    if (manual && app.playing) setPlaying(false);
    app.index = idx; app.scene = C.SCENES[idx]; app.elapsed = 0;
    app.seen[app.scene.id] = 1;
    try { localStorage.setItem('fusion-lab-seen', Object.keys(app.seen).join(',')); } catch (e) { /* ignore */ }
    $('directorBar').style.width = '0%';
    applyWorld(app.scene, instant);
    mountPanel(app.scene);
    refreshNav();
    try { history.replaceState(null, '', '#' + app.scene.id); } catch (e) { /* file:// in some browsers */ }
  }
  app.goScene = function (which, manual) {
    goScene(which, manual);
    var top = $('lab').getBoundingClientRect().top;
    if (Math.abs(top) > 160) $('lab').scrollIntoView({ behavior: FL.reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };

  function setPlaying(on, status) {
    app.playing = on;
    var b = $('playScenes');
    b.textContent = on ? '❙❙ 暂停讲解' : (app.index >= 0 && app.elapsed > 0.5 ? '▶ 继续讲解' : '▶ 自动讲解');
    b.setAttribute('aria-pressed', String(on));
    var st = $('directorStatus');
    st.textContent = status || (on ? '自动讲解中' : '手动模式');
    st.classList.toggle('on', on);
    if (on && !app.engine.clock.running) setMotion(true);
  }
  /* any manual input hands control back to the user */
  function takeover() { if (app.playing) setPlaying(false, '已暂停 · 你在操作'); }
  app.takeover = takeover;

  function setMotion(on) {
    app.engine.clock.running = on;
    var b = $('btnMotion');
    b.setAttribute('aria-pressed', String(on));
    b.querySelector('span[aria-hidden]').textContent = on ? '❙❙' : '▶';
    b.title = on ? '暂停全部动效' : '恢复动效';
    if (!on && app.playing) setPlaying(false, '动效已暂停');
  }

  app.setPulse = function (t, manual) {
    app.pulseT = t;
    if (manual) { app.pulseManual = true; takeover(); }
  };
  app.selectPart = function (id, manual) {
    if (!app.scene.panel || app.scene.panel.type !== 'anatomy') return;
    app.part = id;
    var layers = app.scene.layers || ALL_LAYERS;
    app.tokamak.setLayers(layers, id ? [id] : null);
    if (manual) {
      takeover();
      app.effects.set({ csGlow: 0, tfGlow: 0, pfGlow: 0 });
      var P = ref.ITER.parts[id];
      if (P) {
        var at = { cs: ['tk', 'cs', 2.05, 5.2, 96], tf: ['tk', 'tf', 11.25, 3.4, 180], pf: ['tk', 'pf', 12.2, 3.25, 356], vessel: ['tk', 'vessel', 9.6, 2.4, 161], blanket: ['tk', 'blanket', 8.6, 2.2, 39], divertor: ['tk', 'divertor', 6.0, -4.05, 38], cryostat: ['tk', 'cryostat', 14.4, 8.5, 2] }[id];
        setLabels([{ id: 'sel', text: P.name, sub: P.en, at: at, side: id === 'tf' || id === 'vessel' ? 'l' : 'r' }]);
      } else setLabels(app.scene.labels === 'micro' ? [] : app.scene.labels);
    }
    if (app.instrument && app.instrument.refresh) app.instrument.refresh();
  };

  function dismissIntro() {
    app.started = true;
    $('intro').classList.add('gone');
    $('stage').classList.remove('intro-on');
  }

  /* ---------- static sections ---------- */
  function buildReference() {
    var wrap = $('rulesTable'), keys = Object.keys(ref.SOURCES);
    wrap.innerHTML = '<div class="rule head"><span>项目</span><span>数值</span><span>口径与来源</span></div>' + ref.RULES.map(function (r) {
      return '<div class="rule"><b>' + r.item + '</b><span class="val">' + r.value + '</span><span class="basis">' + r.basis +
        r.src.map(function (k) { return '<sup>[' + (keys.indexOf(k) + 1) + ']</sup>'; }).join('') + '</span></div>';
    }).join('');
    $('ruleSources').innerHTML = '<span class="stamp">核对日期 ' + ref.CHECKED + ' · 外部链接需要联网</span>' + keys.map(function (k, i) {
      var s = ref.SOURCES[k]; return '<a href="' + s.url + '" target="_blank" rel="noopener"><sup>[' + (i + 1) + ']</sup>' + s.label + '</a>';
    }).join('');
    var list = $('mythList');
    ref.MYTHS.forEach(function (m) {
      var d = ui.h('details', 'myth');
      d.innerHTML = '<summary>' + m.q + '</summary><div class="ans"><p>' + m.a + '</p></div>';
      var b = ui.h('button', '', '去看这一幕 →'); b.type = 'button';
      b.addEventListener('click', function () { app.goScene(m.go, true); });
      d.querySelector('.ans').appendChild(b);
      list.appendChild(d);
    });
  }
  function initToTop() {
    var b = ui.h('button', 'to-top', '<span aria-hidden="true">↑</span><span>顶部</span>');
    b.type = 'button'; b.setAttribute('aria-label', '回到页面顶部');
    b.addEventListener('click', function () { globalThis.scrollTo({ top: 0, behavior: FL.reducedMotion() ? 'auto' : 'smooth' }); });
    document.body.appendChild(b);
    var onScroll = function () { b.classList.toggle('show', globalThis.scrollY > globalThis.innerHeight * 0.9); };
    globalThis.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  function init() {
    initTheme();
    try { (localStorage.getItem('fusion-lab-seen') || '').split(',').forEach(function (k) { if (k) app.seen[k] = 1; }); } catch (e) { /* ignore */ }
    buildNav(); buildReference(); initToTop();
    initWorld();
    $('prevScene').addEventListener('click', function () { goScene(app.index - 1, true); });
    $('nextScene').addEventListener('click', function () { goScene(Math.max(0, app.index + 1), true); });
    $('playScenes').addEventListener('click', function () {
      if (app.index < 0) { goScene(0, false); setPlaying(true); return; }
      if (!app.playing && app.index >= C.SCENES.length - 1 && app.elapsed >= sceneDuration(app.scene)) goScene(0, false);
      setPlaying(!app.playing);
    });
    $('dirSpeed').addEventListener('change', function (e) { app.speed = +e.target.value; });
    $('btnMotion').addEventListener('click', function () { setMotion(!app.engine.clock.running); });
    $('btnReset').addEventListener('click', function () { app.engine.flyTo(app.scene.shot, 1.2); });
    $('btnZoomIn').addEventListener('click', function () { app.engine.zoom(0.82); });
    $('btnZoomOut').addEventListener('click', function () { app.engine.zoom(1.22); });
    $('startTour').addEventListener('click', function () { goScene(0, false); setPlaying(true); });
    $('startFree').addEventListener('click', function () { goScene('c1', true); });
    document.addEventListener('keydown', function (e) {
      if (e.target !== document.body || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') goScene(Math.max(0, app.index + 1), true);
      else if (e.key === 'ArrowLeft' && app.index > 0) goScene(app.index - 1, true);
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden && app.playing) setPlaying(false, '已暂停 · 页面在后台'); });

    var hash = (location.hash || '').slice(1);
    if (C.SCENES.some(function (s) { return s.id === hash; })) goScene(hash, true, true);
    else {
      $('stage').classList.add('intro-on');
      applyWorld(INTRO, true); mountPanel(INTRO); refreshNav();
    }
    setPlaying(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
