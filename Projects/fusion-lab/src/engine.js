/* Fusion Lab — rendering engine.
 *
 * One WebGL canvas, an HDR render target, a hand-written bloom chain (the
 * vendored three.js core ships no post-processing), ACES tone mapping, orbit
 * controls that never steal the page scroll, a camera director and projected
 * HTML labels. No remote resources.
 */
(function () {
  'use strict';
  var FL = globalThis.FL = globalThis.FL || {};
  var THREE = globalThis.THREE;

  var FULL_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  var BRIGHT_FRAG = [
    'uniform sampler2D tMap; uniform float uThreshold; uniform float uKnee; varying vec2 vUv;',
    'void main(){ vec3 c = texture2D(tMap, vUv).rgb; float l = max(c.r, max(c.g, c.b));',
    '  float w = smoothstep(uThreshold, uThreshold + uKnee, l);',
    '  gl_FragColor = vec4(min(c * w, vec3(24.0)), 1.0); }'
  ].join('\n');
  var BLUR_FRAG = [
    'uniform sampler2D tMap; uniform vec2 uDir; varying vec2 vUv;',
    'void main(){ vec3 c = texture2D(tMap, vUv).rgb * 0.227027;',
    '  c += (texture2D(tMap, vUv + uDir * 1.384615).rgb + texture2D(tMap, vUv - uDir * 1.384615).rgb) * 0.316216;',
    '  c += (texture2D(tMap, vUv + uDir * 3.230769).rgb + texture2D(tMap, vUv - uDir * 3.230769).rgb) * 0.070270;',
    '  gl_FragColor = vec4(c, 1.0); }'
  ].join('\n');
  var FINAL_FRAG = [
    'uniform sampler2D tScene; uniform sampler2D tB0; uniform sampler2D tB1; uniform sampler2D tB2; uniform sampler2D tB3;',
    'uniform float uBloom; uniform float uExposure; uniform float uVignette; uniform float uTime; uniform float uFade;',
    'varying vec2 vUv;',
    'vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
    'void main(){',
    '  vec3 c = texture2D(tScene, vUv).rgb;',
    '  vec3 b = texture2D(tB0, vUv).rgb * 0.42 + texture2D(tB1, vUv).rgb * 0.30 + texture2D(tB2, vUv).rgb * 0.18 + texture2D(tB3, vUv).rgb * 0.10;',
    '  c += b * uBloom;',
    '  vec2 q = vUv - 0.5; c *= mix(1.0, smoothstep(0.92, 0.18, dot(q, q) * 1.9), uVignette);',
    '  c = aces(c * uExposure);',
    '  c = pow(c, vec3(1.0 / 2.2));',
    '  c += (hash(vUv * 917.0 + uTime) - 0.5) / 255.0;',
    '  gl_FragColor = vec4(c * uFade, 1.0); }'
  ].join('\n');

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  var reducedMotion = function () {
    return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  function Engine(canvas, hud, options) {
    options = options || {};
    var self = this;
    this.canvas = canvas;
    this.hud = hud;
    this.ok = false;
    this.listeners = {};
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
      this.ok = true;
    } catch (e) { this.error = e; }          // no WebGL: the page keeps working without the 3D view
    var r = this.renderer;
    if (this.ok) {
      r.setClearColor(0x05070b, 1);
      r.toneMapping = THREE.NoToneMapping;
      r.outputColorSpace = THREE.LinearSRGBColorSpace;   // the final pass encodes to sRGB itself
      this.hdr = r.capabilities.isWebGL2 && !!r.extensions.get('EXT_color_buffer_float');
    }
    this.w = 2; this.h = 2; this.dpr = 1;
    this.quality = options.quality || 1;               // multiplies device pixel ratio
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 1200);
    this.clock = { time: 0, last: 0, running: true, speed: 1 };
    this.updaters = [];
    this.params = { bloom: 0.9, exposure: 1.0, vignette: 0.55, threshold: 0.85 };
    this.fade = 1;

    /* --- post-processing chain --- */
    this.fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.fsQuad.frustumCulled = false;
    var pass = function (frag, uniforms) {
      return new THREE.ShaderMaterial({ vertexShader: FULL_VERT, fragmentShader: frag, uniforms: uniforms, depthTest: false, depthWrite: false });
    };
    this.matBright = pass(BRIGHT_FRAG, { tMap: { value: null }, uThreshold: { value: 0.85 }, uKnee: { value: 0.7 } });
    this.matBlur = pass(BLUR_FRAG, { tMap: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.matFinal = pass(FINAL_FRAG, {
      tScene: { value: null }, tB0: { value: null }, tB1: { value: null }, tB2: { value: null }, tB3: { value: null },
      uBloom: { value: 0.9 }, uExposure: { value: 1 }, uVignette: { value: 0.55 }, uTime: { value: 0 }, uFade: { value: 1 }
    });
    this.targets = null;

    /* --- orbit state --- */
    this.view = { target: new THREE.Vector3(0, 0, 0), az: 0.6, pol: 1.2, dist: 60, fov: 38 };
    this.goal = { target: new THREE.Vector3(0, 0, 0), az: 0.6, pol: 1.2, dist: 60, fov: 38 };
    this.limits = { minDist: 2, maxDist: 400, minPol: 0.12, maxPol: 1.62 };
    this.tween = null;
    this.autoRotate = 0;           // rad/s, applied while nobody is dragging
    this.dragging = false;
    this.lastInteract = -1e9;
    this.labels = [];
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'label-layer';
    if (hud) hud.appendChild(this.labelLayer);
    this.pickables = [];
    this._bindPointer();

    this.visible = true;
    if (globalThis.IntersectionObserver) {
      new IntersectionObserver(function (entries) { self.visible = entries[0].isIntersecting; }, { threshold: 0.02 }).observe(canvas);
    }
    if (globalThis.ResizeObserver) new ResizeObserver(function () { self.resize(); }).observe(canvas.parentElement);
    globalThis.addEventListener('resize', function () { self.resize(); });
    this.resize();
    this._frame = this._frame.bind(this);
    this.frameMs = 16;
    this.slowFrames = 0;
    requestAnimationFrame(this._frame);
  }

  Engine.prototype.on = function (name, fn) { (this.listeners[name] = this.listeners[name] || []).push(fn); };
  Engine.prototype.emit = function (name, arg) { (this.listeners[name] || []).forEach(function (fn) { fn(arg); }); };

  /* ---------- environment for metallic reflections (generated, no files) ---------- */
  Engine.prototype.buildEnvironment = function () {
    var env = new THREE.Scene();
    var sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(vec3(0.015, 0.02, 0.035), vec3(0.16, 0.2, 0.28), smoothstep(-0.2, 0.9, h)); gl_FragColor = vec4(c, 1.0); }'
    }));
    env.add(sky);
    var panel = function (color, intensity, w, h, pos) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0, 0); env.add(m);
    };
    panel(0xffffff, 9, 26, 12, [0, 38, 6]);        // overhead soft box
    panel(0x9fc4ff, 5, 14, 30, [-40, 8, -14]);     // cool rim
    panel(0xffc890, 4, 12, 22, [38, 4, 22]);       // warm fill
    panel(0xff72d8, 2.4, 10, 10, [6, -30, 30]);    // plasma-coloured bounce
    var pm = new THREE.PMREMGenerator(this.renderer);
    var rt = pm.fromScene(env, 0.03);
    this.scene.environment = rt.texture;
    pm.dispose();
    env.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  };

  /* ---------- sizing ---------- */
  Engine.prototype.resize = function () {
    if (!this.ok) return;
    var box = this.canvas.parentElement.getBoundingClientRect();
    var w = Math.max(2, Math.round(box.width)), h = Math.max(2, Math.round(box.height));
    var dpr = Math.min(globalThis.devicePixelRatio || 1, 2) * this.quality;
    if (w * h * dpr * dpr > 5.2e6) dpr = Math.sqrt(5.2e6 / (w * h));
    if (this.w === w && this.h === h && this.dpr === dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    var pw = Math.round(w * dpr), ph = Math.round(h * dpr), self = this;
    if (this.targets) { this.targets.scene.dispose(); this.targets.blur.forEach(function (p) { p[0].dispose(); p[1].dispose(); }); }
    var type = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
    var mk = function (tw, th, samples, depth) {
      return new THREE.WebGLRenderTarget(Math.max(2, tw), Math.max(2, th), {
        type: type, samples: samples || 0, depthBuffer: !!depth, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
      });
    };
    this.targets = { scene: mk(pw, ph, self.renderer.capabilities.isWebGL2 ? 4 : 0, true), blur: [] };
    for (var i = 0; i < 4; i++) {
      var s = Math.pow(2, i + 1);
      this.targets.blur.push([mk(Math.round(pw / s), Math.round(ph / s)), mk(Math.round(pw / s), Math.round(ph / s))]);
    }
  };

  /* ---------- camera ---------- */
  Engine.prototype._applyView = function () {
    var v = this.view, sp = Math.sin(v.pol);
    this.camera.position.set(
      v.target.x + v.dist * sp * Math.sin(v.az),
      v.target.y + v.dist * Math.cos(v.pol),
      v.target.z + v.dist * sp * Math.cos(v.az));
    this.camera.lookAt(v.target);
    if (Math.abs(this.camera.fov - v.fov) > 0.01) { this.camera.fov = v.fov; this.camera.updateProjectionMatrix(); }
    this.camera.near = Math.max(0.05, v.dist / 400);
    this.camera.far = Math.max(600, v.dist * 12);
    this.camera.updateProjectionMatrix();
  };
  /* shot: { t:[x,y,z], az:deg, pol:deg, d, fov } */
  Engine.prototype.flyTo = function (shot, seconds) {
    var from = { target: this.view.target.clone(), az: this.view.az, pol: this.view.pol, dist: this.view.dist, fov: this.view.fov };
    var to = {
      target: new THREE.Vector3(shot.t[0], shot.t[1], shot.t[2]),
      az: shot.az * Math.PI / 180, pol: shot.pol * Math.PI / 180, dist: shot.d, fov: shot.fov || 38
    };
    /* phone-shaped viewports need more distance to keep the subject in frame */
    var aspect = this.w / this.h;
    if (aspect < 1.25) to.dist *= Math.min(1.9, 1 + (1.25 - aspect) * 0.95);
    var d = to.az - from.az;
    d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    to.az = from.az + d;
    var dur = reducedMotion() ? 0 : (seconds == null ? 2.2 : seconds);
    if (dur <= 0) { this.view = to; this.tween = null; return; }
    this.tween = { from: from, to: to, t: 0, dur: dur };
  };
  Engine.prototype._updateCamera = function (dt) {
    var v = this.view;
    if (this.tween) {
      var tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      var k = ease(tw.t);
      v.target.lerpVectors(tw.from.target, tw.to.target, k);
      v.az = lerp(tw.from.az, tw.to.az, k);
      v.pol = lerp(tw.from.pol, tw.to.pol, k);
      /* swing slightly wide in the middle of long moves so the cut feels like a crane shot */
      var bulge = Math.sin(Math.PI * k) * Math.min(0.18, Math.abs(tw.to.az - tw.from.az) * 0.08);
      v.dist = lerp(tw.from.dist, tw.to.dist, k) * (1 + bulge);
      v.fov = lerp(tw.from.fov, tw.to.fov, k);
      if (tw.t >= 1) this.tween = null;
    } else if (!this.dragging && this.autoRotate && !reducedMotion() && this.clock.running) {
      v.az += this.autoRotate * dt;
    }
    this._applyView();
  };

  Engine.prototype._bindPointer = function () {
    var self = this, c = this.canvas, pts = {}, last = null, pinch = 0, moved = 0, downAt = 0;
    var L = this.limits;
    var userMove = function () {
      self.tween = null;
      self.lastInteract = performance.now();
      self.emit('interact');
    };
    c.addEventListener('pointerdown', function (e) {
      pts[e.pointerId] = { x: e.clientX, y: e.clientY };
      last = { x: e.clientX, y: e.clientY, button: e.button };
      moved = 0; downAt = performance.now();
      try { c.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      self.dragging = true;
      var ids = Object.keys(pts);
      if (ids.length === 2) pinch = Math.hypot(pts[ids[0]].x - pts[ids[1]].x, pts[ids[0]].y - pts[ids[1]].y);
    });
    c.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) { self._hover(e); return; }
      var ids = Object.keys(pts), v = self.view;
      if (ids.length >= 2) {
        pts[e.pointerId] = { x: e.clientX, y: e.clientY };
        var d = Math.hypot(pts[ids[0]].x - pts[ids[1]].x, pts[ids[0]].y - pts[ids[1]].y);
        if (pinch > 0 && d > 0) { v.dist = Math.min(L.maxDist, Math.max(L.minDist, v.dist * pinch / d)); userMove(); }
        pinch = d;
        return;
      }
      var dx = e.clientX - last.x, dy = e.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved < 4) return;
      if (last.button === 2 || e.shiftKey) {
        var s = v.dist * 0.0014;
        var right = new THREE.Vector3().setFromMatrixColumn(self.camera.matrixWorld, 0);
        var up = new THREE.Vector3().setFromMatrixColumn(self.camera.matrixWorld, 1);
        v.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
      } else {
        v.az -= dx * 0.0052;
        v.pol = Math.min(L.maxPol, Math.max(L.minPol, v.pol - dy * 0.0046));
      }
      last.x = e.clientX; last.y = e.clientY;
      userMove();
    });
    var up = function (e) {
      if (pts[e.pointerId] && moved < 5 && performance.now() - downAt < 450 && e.type === 'pointerup') self._pick(e);
      delete pts[e.pointerId];
      if (!Object.keys(pts).length) self.dragging = false;
      pinch = 0;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    /* wheel zooms only once the stage has focus, so the page keeps scrolling */
    c.addEventListener('wheel', function (e) {
      if (document.activeElement !== c && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      self.zoom(Math.exp(e.deltaY * 0.0011));
    }, { passive: false });
    c.addEventListener('pointerleave', function () { if (document.activeElement === c && !self.dragging) c.blur(); self._setHover(null); });
    c.addEventListener('keydown', function (e) {
      var v = self.view, hit = true;
      if (e.key === 'ArrowLeft') v.az -= 0.09;
      else if (e.key === 'ArrowRight') v.az += 0.09;
      else if (e.key === 'ArrowUp') v.pol = Math.max(L.minPol, v.pol - 0.07);
      else if (e.key === 'ArrowDown') v.pol = Math.min(L.maxPol, v.pol + 0.07);
      else if (e.key === '+' || e.key === '=') v.dist = Math.max(L.minDist, v.dist * 0.9);
      else if (e.key === '-' || e.key === '_') v.dist = Math.min(L.maxDist, v.dist * 1.1);
      else hit = false;
      if (hit) { e.preventDefault(); userMove(); }
    });
  };
  Engine.prototype.zoom = function (factor) {
    var L = this.limits;
    this.view.dist = Math.min(L.maxDist, Math.max(L.minDist, this.view.dist * factor));
    this.tween = null;
    this.lastInteract = performance.now();
    this.emit('interact');
  };

  /* ---------- picking ---------- */
  Engine.prototype._ray = function (e) {
    var b = this.canvas.getBoundingClientRect();
    var ndc = new THREE.Vector2((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    this.raycaster = this.raycaster || new THREE.Raycaster();
    this.raycaster.setFromCamera(ndc, this.camera);
    var list = this.pickables.filter(function (m) {
      for (var o = m; o; o = o.parent) if (!o.visible) return false;
      return !m.userData.ghost;
    });
    var hit = this.raycaster.intersectObjects(list, false)[0];
    return hit ? hit.object.userData.part : null;
  };
  Engine.prototype._pick = function (e) { if (this.pickEnabled) this.emit('pick', this._ray(e)); };
  Engine.prototype._hover = function (e) {
    if (!this.pickEnabled || e.pointerType === 'touch') return;
    var now = performance.now();
    if (now - (this._hoverAt || 0) < 70) return;
    this._hoverAt = now;
    this._setHover(this._ray(e));
  };
  Engine.prototype._setHover = function (part) {
    if (part === this.hoverPart) return;
    this.hoverPart = part;
    this.canvas.style.cursor = part ? 'pointer' : '';
    this.emit('hover', part);
  };

  /* ---------- labels ---------- */
  /* items: [{ id, text, sub, at: THREE.Vector3 | function, tone }] */
  Engine.prototype.setLabels = function (items) {
    var self = this, keep = {};
    (items || []).forEach(function (it) {
      keep[it.id] = true;
      var cur = self.labels.filter(function (l) { return l.id === it.id; })[0];
      if (!cur) {
        var el = document.createElement('div');
        el.className = 'tag3d';
        el.innerHTML = '<i></i><span><b></b><small></small></span>';
        self.labelLayer.appendChild(el);
        cur = { id: it.id, el: el, shown: false };
        self.labels.push(cur);
        requestAnimationFrame(function () { el.classList.add('in'); });
      }
      cur.at = it.at; cur.dead = false;
      cur.el.dataset.tone = it.tone || '';
      cur.el.dataset.side = it.side || 'r';
      cur.el.querySelector('b').textContent = it.text;
      var sm = cur.el.querySelector('small');
      sm.textContent = it.sub || ''; sm.style.display = it.sub ? '' : 'none';
    });
    this.labels = this.labels.filter(function (l) {
      if (keep[l.id]) return true;
      l.el.classList.remove('in');
      setTimeout(function () { if (l.el.parentNode) l.el.parentNode.removeChild(l.el); }, 320);
      return false;
    });
  };
  Engine.prototype._updateLabels = function () {
    var v = new THREE.Vector3(), w = this.w, h = this.h;
    for (var i = 0; i < this.labels.length; i++) {
      var l = this.labels[i];
      var p = typeof l.at === 'function' ? l.at() : l.at;
      if (!p) { l.el.style.visibility = 'hidden'; continue; }
      v.copy(p).project(this.camera);
      var on = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.02;
      l.el.style.visibility = on ? 'visible' : 'hidden';
      if (on) l.el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
    }
  };

  /* ---------- frame loop ---------- */
  Engine.prototype.addUpdater = function (fn) { this.updaters.push(fn); };
  Engine.prototype._frame = function (now) {
    requestAnimationFrame(this._frame);
    if (!this.ok) return;
    var raw = Math.min(0.1, (now - (this.clock.last || now)) / 1000);
    this.clock.last = now;
    if (!this.visible || document.hidden) return;
    var dt = this.clock.running ? raw * this.clock.speed : 0;
    this.clock.time += dt;
    this._updateCamera(raw);
    for (var i = 0; i < this.updaters.length; i++) this.updaters[i](this.clock.time, dt, raw);
    this.render();
    this._updateLabels();
    /* adaptive resolution: shed pixels if the device cannot hold ~30 fps */
    this.frameMs = this.frameMs * 0.92 + raw * 1000 * 0.08;
    if (this.frameMs > 34 && raw < 0.09) { if (++this.slowFrames > 50 && this.quality > 0.55) { this.quality *= 0.82; this.slowFrames = 0; this.resize(); } }
    else this.slowFrames = Math.max(0, this.slowFrames - 1);
  };
  Engine.prototype._pass = function (material, target) {
    this.fsQuad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsQuad, this.fsCamera);
  };
  Engine.prototype.render = function () {
    var r = this.renderer, T = this.targets, P = this.params;
    r.setRenderTarget(T.scene);
    r.clear();
    r.render(this.scene, this.camera);
    var src = T.scene.texture;
    this.matBright.uniforms.uThreshold.value = P.threshold;
    for (var i = 0; i < 4; i++) {
      var pair = T.blur[i];
      if (i === 0) { this.matBright.uniforms.tMap.value = src; this._pass(this.matBright, pair[1]); src = pair[1].texture; }
      this.matBlur.uniforms.tMap.value = src;
      this.matBlur.uniforms.uDir.value.set(1 / pair[0].width, 0);
      this._pass(this.matBlur, pair[0]);
      this.matBlur.uniforms.tMap.value = pair[0].texture;
      this.matBlur.uniforms.uDir.value.set(0, 1 / pair[1].height);
      this._pass(this.matBlur, pair[1]);
      src = pair[1].texture;
    }
    var u = this.matFinal.uniforms;
    u.tScene.value = T.scene.texture;
    u.tB0.value = T.blur[0][1].texture; u.tB1.value = T.blur[1][1].texture;
    u.tB2.value = T.blur[2][1].texture; u.tB3.value = T.blur[3][1].texture;
    u.uBloom.value = P.bloom; u.uExposure.value = P.exposure; u.uVignette.value = P.vignette;
    u.uTime.value = this.clock.time % 97; u.uFade.value = this.fade;
    this._pass(this.matFinal, null);
  };

  FL.Engine = Engine;
  FL.ease = ease;
  FL.lerp = lerp;
  FL.reducedMotion = reducedMotion;
})();
