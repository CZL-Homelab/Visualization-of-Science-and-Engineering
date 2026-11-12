/* Offline teaching scenes. Geometry is schematic, not a hydraulic simulation.
 * Shared controls, projected annotations and local simulation time keep the
 * three views usable without camera drift, including reduced-motion mode. */
(function () {
  'use strict';
  var DL = globalThis.DL = globalThis.DL || {};
  var THREE = globalThis.THREE;
  var clamp = DL.charts.clamp;
  var C = { feed: 0xe0955a, product: 0x5bc8be, brine: 0xe05a5f, water: 0x7aa2d8, membrane: 0xb09bc7, metal: 0xb7c1ca };
  function v(x, y, z) { return new THREE.Vector3(x, y, z); }
  function mat(color, opacity) {
    return new THREE.MeshStandardMaterial({ color: color, roughness: 0.65, metalness: 0.08,
      transparent: opacity != null, opacity: opacity == null ? 1 : opacity,
      depthWrite: opacity == null, side: THREE.DoubleSide });
  }
  function mesh(g, geometry, material, x, y, z) {
    var m = new THREE.Mesh(geometry, material); m.position.set(x || 0, y || 0, z || 0); g.add(m); return m;
  }
  function box(g, x, y, z, w, h, d, color, opacity) {
    return mesh(g, new THREE.BoxGeometry(w, h, d), mat(color, opacity), x, y, z);
  }
  function cylinder(g, x, y, z, r, length, color, axis, opacity) {
    var m = mesh(g, new THREE.CylinderGeometry(r, r, length, 32, 1, true), mat(color, opacity), x, y, z);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    return m;
  }
  function ring(g, x, r, color, y, z) {
    var m = mesh(g, new THREE.TorusGeometry(r, 0.045, 8, 64), mat(color), x, y, z);
    m.rotation.y = Math.PI / 2; return m;
  }
  function path(g, coords, color, radius) {
    var pts = coords.map(function (a) { return v(a[0], a[1], a[2]); });
    /* A polyline curve preserves pipe corners and exactly matches the particles. */
    var curve = new THREE.CurvePath();
    for (var i = 1; i < pts.length; i++) curve.add(new THREE.LineCurve3(pts[i - 1], pts[i]));
    mesh(g, new THREE.TubeGeometry(curve, Math.max(24, coords.length * 12), radius || 0.055, 8, false), mat(color, 0.42));
    return curve;
  }
  function points(g, n, color, size) {
    var geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var dot = document.createElement('canvas'); dot.width = dot.height = 32;
    var c = dot.getContext('2d'); c.fillStyle = '#fff'; c.beginPath(); c.arc(16, 16, 13, 0, Math.PI * 2); c.fill();
    var material = new THREE.PointsMaterial({ color: color, size: size || 0.09, map: new THREE.CanvasTexture(dot),
      transparent: true, alphaTest: 0.1, opacity: 0.95, depthWrite: false });
    var obj = new THREE.Points(geo, material); g.add(obj);
    /* Positions start at zero and are rewritten before each render. Dynamic
     * paths must not be culled using that initial zero-sized bounding sphere. */
    obj.frustumCulled = false;
    return { pos: pos, n: n, obj: obj, mat: material, dirty: function () { geo.attributes.position.needsUpdate = true; } };
  }
  function stream(g, coords, color, n, size) {
    var curve = path(g, coords, color, size ? size * 0.6 : 0.055);
    var p = points(g, n || 40, color, size), at = v(0, 0, 0);
    return { update: function (t, speed, fraction) {
      var count = Math.round(p.n * clamp(fraction == null ? 1 : fraction, 0, 1));
      p.obj.geometry.setDrawRange(0, count);
      for (var i = 0; i < count; i++) {
        curve.getPoint((t * speed + i / Math.max(1, count)) % 1, at);
        p.pos[i * 3] = at.x; p.pos[i * 3 + 1] = at.y; p.pos[i * 3 + 2] = at.z;
      }
      p.dirty();
    } };
  }
  function view(host, opts) {
    host.classList.add('chart', 'glhost'); host.innerHTML = '';
    var api = { host: host, destroyed: false, destroy: function () { api.destroyed = true; host.innerHTML = ''; } };
    function fallback() {
      host.textContent = '3D 暂不可用，请切换到 2D 视图继续实验。'; host.classList.add('gl-fallback');
    }
    if (!THREE) { fallback(); return api; }
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch (e) { fallback(); return api; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    var viewport = document.createElement('div'); viewport.className = 'gl-viewport'; host.appendChild(viewport);
    var canvas = renderer.domElement; viewport.appendChild(canvas);
    canvas.tabIndex = 0; canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', opts.title + '。方向键旋转，加减键缩放；也可拖动模型。');
    var labels = [], layer = document.createElement('div'); layer.className = 'gl-labels'; viewport.appendChild(layer);
    var toolbar = document.createElement('div'); toolbar.className = 'gl-toolbar'; host.appendChild(toolbar);
    function button(text, fn, pressed) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = text;
      if (pressed != null) b.setAttribute('aria-pressed', String(pressed));
      b.addEventListener('click', fn); toolbar.appendChild(b); return b;
    }
    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var paused = motionQuery.matches, localTime = 0, visible = true, dragging = false;
    var pauseBtn = button(paused ? '播放流动' : '暂停流动', function () {
      paused = !paused; pauseBtn.textContent = paused ? '播放流动' : '暂停流动'; pauseBtn.setAttribute('aria-pressed', String(paused));
    }, paused);
    var cam = { r: opts.radius, th: opts.theta == null ? 1.16 : opts.theta, ph: opts.phi || 1.13 };
    button('复位视角', function () { cam.r = opts.radius; cam.th = opts.theta == null ? 1.16 : opts.theta; cam.ph = opts.phi || 1.13; });
    button('放大', function () { zoom(0.85); }); button('缩小', function () { zoom(1.18); });
    if (opts.cutaway) {
      var cut = true;
      var cutBtn = button('剖切', function () { cut = !cut; opts.cutaway(cut); cutBtn.setAttribute('aria-pressed', String(cut)); }, true);
    }
    var readout = document.createElement('p'); readout.className = 'gl-readout'; host.appendChild(readout);
    var legend = document.createElement('p'); legend.className = 'gl-legend';
    opts.legend.forEach(function (item) {
      var span = document.createElement('span'), dot = document.createElement('i'); dot.style.background = item[1];
      span.appendChild(dot); span.appendChild(document.createTextNode(item[0])); legend.appendChild(span);
    }); host.appendChild(legend);
    var scene = new THREE.Scene(), group = new THREE.Group(); scene.add(group);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x626a78, 1.8));
    var light = new THREE.DirectionalLight(0xffffff, 2.1); light.position.set(-3, 8, 6); scene.add(light);
    var rim = new THREE.DirectionalLight(0xabc8ef, 0.8); rim.position.set(5, 2, -5); scene.add(rim);
    var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 150), target = v(0, opts.ty || 0, 0), fit = 1;
    opts.build(group, { points: points, label: function (text, x, y, z) {
      var el = document.createElement('span'); el.className = 'gl-label'; el.textContent = text; layer.appendChild(el);
      labels.push({ el: el, point: v(x, y, z) });
    } });
    function zoom(factor) { cam.r = clamp(cam.r * factor, opts.radius * 0.65, opts.radius * 1.8); }
    canvas.addEventListener('pointerdown', function (e) {
      dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId);
    });
    var lastX = 0, lastY = 0;
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      cam.th -= (e.clientX - lastX) * 0.006; cam.ph = clamp(cam.ph - (e.clientY - lastY) * 0.005, 0.3, 1.8);
      lastX = e.clientX; lastY = e.clientY;
    });
    canvas.addEventListener('pointerup', function () { dragging = false; });
    canvas.addEventListener('pointercancel', function () { dragging = false; });
    canvas.addEventListener('wheel', function (e) { e.preventDefault(); zoom(Math.exp(clamp(e.deltaY, -120, 120) * 0.001)); }, { passive: false });
    canvas.addEventListener('keydown', function (e) {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].indexOf(e.key) < 0) return;
      e.preventDefault();
      if (e.key === 'ArrowLeft') cam.th -= 0.1;
      if (e.key === 'ArrowRight') cam.th += 0.1;
      if (e.key === 'ArrowUp') cam.ph = clamp(cam.ph - 0.1, 0.3, 1.8);
      if (e.key === 'ArrowDown') cam.ph = clamp(cam.ph + 0.1, 0.3, 1.8);
      if (e.key === '+' || e.key === '=') zoom(0.9);
      if (e.key === '-') zoom(1.1);
    });
    function reduced(e) {
      if (e.matches) { paused = true; pauseBtn.textContent = '播放流动'; pauseBtn.setAttribute('aria-pressed', 'true'); }
    }
    motionQuery.addEventListener('change', reduced);
    function resize() {
      var w = Math.max(60, viewport.clientWidth), h = Math.max(60, viewport.clientHeight);
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      fit = Math.max(1, 1.65 / camera.aspect);
    }
    var ro = new ResizeObserver(resize); ro.observe(viewport); resize();
    var io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }); io.observe(viewport);
    var projection = v(0, 0, 0);
    function render(dt) {
      if (api.destroyed) return;
      if (!paused) localTime += dt;
      var s = opts.state(); opts.tick(group, s, localTime);
      camera.position.set(target.x + cam.r * fit * Math.sin(cam.ph) * Math.cos(cam.th),
        target.y + cam.r * fit * Math.cos(cam.ph), target.z + cam.r * fit * Math.sin(cam.ph) * Math.sin(cam.th));
      camera.lookAt(target); camera.updateMatrixWorld(); renderer.render(scene, camera);
      var occupied = [], w = viewport.clientWidth, h = viewport.clientHeight;
      labels.forEach(function (l) {
        projection.copy(l.point).project(camera);
        var x = (projection.x + 1) * w / 2, y = (1 - projection.y) * h / 2;
        var lw = l.el.offsetWidth || 80, lh = l.el.offsetHeight || 23;
        var rect = { x: clamp(x - lw / 2, 5, Math.max(5, w - lw - 5)), y: y, w: lw, h: lh };
        var hide = projection.z > 1 || projection.z < -1 || y < 6 || y > h - lh - 5 || x < 0 || x > w;
        if (!hide) hide = occupied.some(function (r) { return rect.x < r.x + r.w + 5 && rect.x + rect.w + 5 > r.x && rect.y < r.y + r.h + 4 && rect.y + rect.h + 4 > r.y; });
        l.el.style.visibility = hide ? 'hidden' : 'visible';
        l.el.style.transform = 'translate(' + rect.x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        if (!hide) occupied.push(rect);
      });
      var text = opts.describe(s); if (readout.textContent !== text) readout.textContent = text;
    }
    render(0);
    var elapsed = 0;
    var stop = DL.charts.every(function (t, dt) {
      if (!visible || document.hidden || api.destroyed) return;
      elapsed += dt; if (elapsed < 1 / 30) return; render(elapsed); elapsed = 0;
    });
    api.destroy = function () {
      if (api.destroyed) return;
      api.destroyed = true; stop(); io.disconnect(); ro.disconnect(); motionQuery.removeEventListener('change', reduced);
      var geometries = new Set(), materials = new Set(), textures = new Set();
      group.traverse(function (o) {
        if (o.geometry) geometries.add(o.geometry);
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { materials.add(m); if (m.map) textures.add(m.map); });
      });
      geometries.forEach(function (g) { g.dispose(); }); materials.forEach(function (m) { m.dispose(); }); textures.forEach(function (t) { t.dispose(); });
      renderer.dispose(); renderer.forceContextLoss(); host.innerHTML = '';
    };
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); if (!api.destroyed) { api.destroy(); fallback(); } });
    return api;
  }

  /* B: a salt-side piston represents the applied pressure. Chamber heights
   * are schematic; h is an equivalent pressure head, not a literal tank scale. */
  function osmosis(host, getState) {
    var water, ions, piston, pistonRod, arrow;
    return view(host, {
      title: '半透膜与盐水侧加压装置', state: getState, radius: 6.4, ty: 0.8,
      legend: [['淡水 / 水分子', '#7aa2d8'], ['盐离子（留在盐水侧）', '#e0955a'], ['半透膜', '#b09bc7']],
      build: function (g, ctx) {
        box(g, 0, -0.1, 0, 4.5, 0.18, 1.8, 0x525a64);
        [-1, 1].forEach(function (x) {
          var tank = box(g, x, 0.85, 0, 1.95, 1.7, 1.4, 0xaec8df, 0.08);
          var edges = new THREE.LineSegments(new THREE.EdgesGeometry(tank.geometry), new THREE.LineBasicMaterial({ color: C.metal })); edges.position.copy(tank.position); g.add(edges);
          box(g, x, 0.63, 0, 1.87, 1.2, 1.32, x < 0 ? C.water : C.product, 0.12);
        });
        box(g, 0, 0.86, 0, 0.055, 1.72, 1.4, C.membrane, 0.55);
        piston = box(g, 1, 1.8, 0, 1.8, 0.09, 1.3, C.metal);
        pistonRod = cylinder(g, 1, 2.08, 0, 0.07, 0.65, C.metal);
        arrow = new THREE.ArrowHelper(v(1, 0, 0), v(-0.6, 0.8, 0.85), 1.2, C.product, 0.18, 0.11); g.add(arrow);
        water = points(g, 90, C.water, 0.085); ions = points(g, 70, C.feed, 0.11);
        ctx.label('淡水', -1.05, 0, 0.95); ctx.label('盐水 · 施压侧', 1.1, 0, 0.95); ctx.label('半透膜', 0, 1.85, 0);
      },
      tick: function (g, s, t) {
        var dir = s.direction === 'in' ? 1 : s.direction === 'out' ? -1 : 0;
        var speed = dir * clamp(s.flux || 0, 0, 1) * 0.12;
        piston.position.y = 1.8 - clamp(s.appliedBar / 60, 0, 1) * 0.48;
        pistonRod.position.y = piston.position.y + 0.35;
        arrow.visible = dir !== 0; arrow.position.x = dir > 0 ? -0.6 : 0.6; arrow.setDirection(v(dir || 1, 0, 0));
        for (var i = 0; i < water.n; i++) {
          var f = ((i / water.n + t * speed) % 1 + 1) % 1;
          water.pos[i * 3] = -1.9 + f * 3.8;
          water.pos[i * 3 + 1] = 0.18 + ((i * 0.618) % 1) * 0.93;
          water.pos[i * 3 + 2] = (((i * 0.414) % 1) - 0.5) * 1.2;
        } water.dirty();
        var count = Math.round(ions.n * clamp(s.tds / 70000, 0, 1)); ions.obj.geometry.setDrawRange(0, count);
        for (var j = 0; j < ions.n; j++) {
          ions.pos[j * 3] = 0.15 + ((j * 0.618) % 1) * 1.65;
          ions.pos[j * 3 + 1] = 0.17 + ((j * 0.414) % 1) * 0.95 + Math.sin(t + j) * 0.025;
          ions.pos[j * 3 + 2] = (((j * 0.732) % 1) - 0.5) * 1.2;
        } ions.dirty();
      },
      describe: function (s) { return 'π ' + s.pi.toFixed(1) + ' bar · 盐水侧压力 ' + s.appliedBar.toFixed(1) + ' bar · ' + (s.direction === 'in' ? '淡水 → 盐水' : s.direction === 'out' ? '盐水 → 淡水（反渗透）' : '动态平衡，净通量为零') + ' · 水柱为等效压头，装置不按比例'; }
    });
  }

  /* C: extruded spiral membrane sheets, not a helical tube. Each leaf winds
   * around x; feed flows along x, permeate collects along the leaf then tube.
   * A front-upper quadrant is removed to expose the collection tube. */
  function spiralSheet(offset, phase) {
    var pos = [], indices = [], segments = 180;
    for (var i = 0; i <= segments; i++) {
      var q = i / segments, a = q * Math.PI * 2.6 + phase, r = 0.38 + q * 1.02 + offset;
      pos.push(-2.35, r * Math.cos(a), r * Math.sin(a), 2.35, r * Math.cos(a), r * Math.sin(a));
      var angle = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (i < segments && !(angle > 0 && angle < Math.PI / 2)) {
        var k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(indices); geo.computeVertexNormals(); return geo;
  }
  function spiralRO(host, getState) {
    var shell, feedStreams = [], perm, product, brine;
    return view(host, {
      title: '卷式膜剖切与三条水路', state: getState, radius: 10.4, phi: 1.18,
      legend: [['进水 → 轴向流道', '#e0955a'], ['产水 → 中心管', '#5bc8be'], ['浓水 → 端部', '#e05a5f']],
      cutaway: function (cut) { shell.visible = !cut; },
      build: function (g, ctx) {
        shell = cylinder(g, 0, 0, 0, 1.57, 5.1, C.metal, 'x', 0.24); shell.visible = false;
        for (var j = 0; j < 3; j++) {
          var phase = j * Math.PI * 2 / 3;
          mesh(g, spiralSheet(0, phase), mat(0xd5d0bd));
          mesh(g, spiralSheet(0.045, phase), mat(0x829baf));
        }
        cylinder(g, 0.3, 0, 0, 0.27, 6.1, C.product, 'x', 0.25);
        ring(g, -2.5, 1.5, C.metal); ring(g, 2.5, 1.5, C.metal);
        ring(g, -2.75, 0.27, C.product); ring(g, 3.35, 0.27, C.product);
        /* Visible collector perforations. */
        for (var h = -2; h <= 2; h += 0.5) {
          var hole = mesh(g, new THREE.CircleGeometry(0.055, 12), mat(0x1c4447), h, 0.19, 0.2);
          hole.rotation.x = -Math.PI / 4;
        }
        for (var f = 0; f < 4; f++) {
          var a = 0.1 + f * 0.38, y = 1.12 * Math.cos(a), z = 1.12 * Math.sin(a);
          feedStreams.push(stream(g, [[-3.4, y, z], [-2.4, y, z], [2.4, y, z]], C.feed, 24, 0.085));
        }
        /* One enlarged, representative leaf path; not a molecular trajectory. */
        var coords = [];
        for (var p = 0; p <= 60; p++) {
          var u = p / 60, angle = 0.35 + (1 - u) * Math.PI * 2.6, rr = 0.28 + (1 - u) * 1.08;
          coords.push([0.35, rr * Math.cos(angle), rr * Math.sin(angle)]);
        }
        coords.push([0.35, 0, 0], [3.8, 0, 0]); perm = stream(g, coords, C.product, 55, 0.08);
        product = stream(g, [[3.35, 0, 0], [4, 0, 0]], C.product, 12, 0.12);
        brine = stream(g, [[2.4, 0.8, 0.8], [2.9, 0.8, 0.8], [3.7, 0.8, 1.55]], C.brine, 36, 0.095);
        ctx.label('卷绕膜片 / 产水流道', -0.6, 1.6, -0.3);
        ctx.label('进水 →', -3.15, 1.5, 0.3); ctx.label('浓水 →', 3.25, 1.15, 1.55);
        ctx.label('中心集水管 → 产水', 2.6, -0.7, 0.5);
      },
      tick: function (g, s, t) {
        var active = s.feasible && s.flux > 0;
        feedStreams.forEach(function (f) { f.update(t, 0.12); });
        perm.update(t, 0.04 + clamp(s.flux, 0, 30) * 0.005, active ? s.recovery : 0);
        product.update(t, 0.2, active ? s.recovery : 0); brine.update(t, 0.17, active ? 1 - s.recovery : 1);
      },
      describe: function (s) { return '进水 ' + s.appliedBar.toFixed(0) + ' bar · 净驱动压 ' + s.netPressure.toFixed(1) + ' bar · 通量 ' + s.flux.toFixed(1) + ' LMH · ' + (s.feasible ? '目标回收率 ' + Math.round(s.recovery * 100) + '%' : '压力不足：停止产水') + ' · 膜层与水路放大示意'; }
    });
  }

  /* G: pipes and particles share paths so every flow reaches its equipment.
   * The brine outfall is a separate branch with a visible diffuser manifold. */
  function plant(host, getState) {
    var flows = [], outflows = [], brineFlow;
    return view(host, {
      title: '海水淡化厂与浓盐水排放支线', state: getState, radius: 16.8, theta: 1.28, phi: 0.95, ty: 0.3,
      legend: [['海水进水', '#e0955a'], ['产水 / 配水', '#5bc8be'], ['浓盐水支线', '#e05a5f']],
      build: function (g, ctx) {
        box(g, 0, -0.18, -0.4, 14.4, 0.3, 4.1, 0x60666a);
        box(g, 0, -0.32, 3.2, 14.4, 0.15, 3.1, 0x3f657a, 0.75);
        /* Intake screen. */
        box(g, -5.4, 0.18, 3.1, 0.9, 0.6, 0.8, 0x667e8d);
        for (var s = 0; s < 6; s++) box(g, -5.75 + s * 0.14, 0.22, 3.52, 0.04, 0.6, 0.04, C.metal);
        /* Pretreatment tanks with exposed water surfaces. */
        [-3.9, -2.9].forEach(function (x) {
          cylinder(g, x, 0.56, -0.25, 0.42, 1.1, C.metal);
          var top = mesh(g, new THREE.CircleGeometry(0.39, 32), mat(C.water), x, 1.04, -0.25); top.rotation.x = -Math.PI / 2;
        });
        /* High-pressure pump and motor. */
        box(g, -1.5, 0.1, 0, 1.4, 0.16, 1, 0x343b43);
        cylinder(g, -1.6, 0.4, 0, 0.28, 0.8, C.feed, 'x');
        box(g, -1.05, 0.4, 0, 0.35, 0.55, 0.6, C.metal);
        /* Three parallel membrane pressure vessels with a visible skid. */
        box(g, 0.7, 0.12, 0, 2.4, 0.18, 2, 0x3d454d);
        [-0.66, 0, 0.66].forEach(function (z) {
          cylinder(g, 0.7, 0.65, z, 0.25, 2, 0xd4d9df, 'x');
          ring(g, -0.3, 0.25, C.feed, 0.65, z); ring(g, 1.7, 0.25, C.product, 0.65, z);
          path(g, [[-0.55, 0.32, 0], [-0.55, 0.65, z], [-0.3, 0.65, z]], C.feed);
          path(g, [[1.7, 0.65, z], [1.95, 0.65, z], [1.95, 0.32, 0]], C.product);
          path(g, [[1.7, 0.65, z], [1.8, 0.28, z], [1.8, 0.28, 1.1]], C.brine, 0.035);
        });
        /* Post treatment / clear well, then distribution. */
        cylinder(g, 3.3, 0.7, 0, 0.6, 1.4, C.product, null, 0.35);
        cylinder(g, 4.45, 0.4, -0.5, 0.27, 0.8, C.metal);
        box(g, 5.8, 0.65, -0.6, 0.7, 1.3, 0.8, 0x9aa5b0);
        box(g, 6.65, 0.95, 0.2, 0.7, 1.9, 0.8, 0x87939f);
        for (var win = 0; win < 4; win++) box(g, 6.65, 0.4 + win * 0.35, 0.61, 0.38, 0.12, 0.02, C.water);
        flows.push(stream(g, [[-5.4, 0.3, 3.1], [-5.4, 0.3, 0], [-3.9, 0.3, 0], [-1.6, 0.3, 0], [-0.55, 0.32, 0]], C.feed, 55, 0.13));
        flows.push(stream(g, [[-0.55, 0.32, 0], [-0.55, 0.65, 0], [1.7, 0.65, 0]], C.feed, 24, 0.09));
        outflows.push(stream(g, [[1.95, 0.32, 0], [3.3, 0.32, 0], [4.45, 0.32, 0], [6.65, 0.32, 0]], C.product, 65, 0.12));
        /* Concentrate pressure recovery is shown as equipment on its branch. */
        cylinder(g, 2.6, 0.35, 1.2, 0.23, 0.6, C.metal);
        brineFlow = stream(g, [[1.8, 0.28, 1.1], [2.6, 0.28, 1.1], [2.6, 0.08, 3.8], [0, 0.08, 3.8]], C.brine, 55, 0.12);
        path(g, [[-1.3, 0.08, 3.8], [1.3, 0.08, 3.8]], C.brine, 0.07);
        for (var d = -1; d <= 1; d += 0.5) {
          outflows.push(stream(g, [[d, 0.08, 3.8], [d, 0.4, 3.8], [d + 0.18, 0.52, 4.3]], C.brine, 8, 0.08));
        }
        ctx.label('01 取水', -5.4, 0.7, 3.1); ctx.label('02 预处理', -3.4, 1.4, 0);
        ctx.label('03 高压泵', -1.6, 0.9, 0); ctx.label('04 RO 膜组', 0.7, 1.2, 0);
        ctx.label('05 再矿化 / 消毒', 3.5, 1.8, 0); ctx.label('06 配水', 6.3, 2.1, 0);
        ctx.label('浓盐水 → 扩散器', 0, 0.7, 4.4);
      },
      tick: function (g, s, t) {
        var y = clamp(s.recovery, 0.2, 0.7);
        flows.forEach(function (f) { f.update(t, 0.12); });
        brineFlow.update(t, 0.12, 1 - y);
        outflows.forEach(function (f, i) { f.update(t, 0.16, i === 0 ? y : 1 - y); });
      },
      describe: function (s) {
        return '进水 100% = 产水 ' + Math.round(s.recovery * 100) + '% + 浓水 ' + Math.round((1 - s.recovery) * 100) + '% · 浓水 ' + (s.brineTds / 1000).toFixed(1) + ' g/L · 流程示意，未计算排海扩散与设备尺寸';
      }
    });
  }
  DL.gl = { view: view, osmosis: osmosis, spiralRO: spiralRO, plant: plant };
})();
