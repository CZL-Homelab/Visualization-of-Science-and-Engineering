/* Desalination Lab — WebGL 3D views on the vendored three.js build.
 * DL.gl.view(host, opts) wires renderer/camera/drag/visibility;
 * DL.gl.osmosis / spiralRO / plant are the teaching scenes for modules
 * B, C and G. Scenes read live state through a getter each frame so the
 * sliders drive the 3D exactly like the 2D diagrams.
 * Fallback: if WebGL is unavailable the host shows a note and the 2D
 * diagram stays available.
 */
(function () {
  'use strict';
  var DL = globalThis.DL = globalThis.DL || {};
  var THREE = globalThis.THREE;
  var clamp = DL.charts ? DL.charts.clamp : function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  function points(parent, n, color, size) {
    var g = new THREE.BufferGeometry();
    var pos = new Float32Array(n * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var m = new THREE.PointsMaterial({ color: color, size: size || 0.07, transparent: true, opacity: 0.92, sizeAttenuation: true, depthWrite: false });
    var obj = new THREE.Points(g, m);
    obj.renderOrder = 10;   /* particles must never hide behind transparent water volumes */
    parent.add(obj);
    return { pos: pos, n: n, obj: obj, mat: m, dirty: function () { g.attributes.position.needsUpdate = true; } };
  }

  function view(host, opts) {
    opts = opts || {};
    host.classList.add('chart', 'glhost');
    host.innerHTML = '';
    var api = { host: host, destroyed: false };
    if (!THREE) { fallback('3D 引擎未加载'); return api; }
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) {
      fallback('当前环境不支持 WebGL——2D 示意图不受影响。');
      return api;
    }
    function fallback(msg) {
      host.innerHTML = '<div class="gl-fallback" style="display:flex;align-items:center;justify-content:center;height:100%;font:11px ui-monospace,monospace;color:#8a929b;text-align:center;padding:16px">' + msg + '</div>';
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    var canvas = renderer.domElement;
    canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    host.appendChild(canvas);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x20262e, 1.45));
    var key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(6, 10, 7);
    scene.add(key);
    var rim = new THREE.DirectionalLight(0x8fb7ff, 0.4);
    rim.position.set(-7, 4, -6);
    scene.add(rim);

    var cam = { r: opts.radius || 9, th: opts.theta != null ? opts.theta : 0.85, ph: opts.phi != null ? opts.phi : 1.12 };
    var target = new THREE.Vector3(opts.tx || 0, opts.ty || 0, opts.tz || 0);
    var group = new THREE.Group();
    scene.add(group);
    var stateFn = opts.state || function () { return {}; };

    if (opts.build) opts.build(group, { points: points, scene: scene, state: stateFn });
    /* transparent shells must not write depth, otherwise they occlude the
       particles floating inside them */
    group.traverse(function (o) {
      if (o.material && o.material.transparent && o.material.depthWrite !== false) o.material.depthWrite = false;
    });

    /* drag to orbit, wheel to zoom */
    var dragging = false, lastX = 0, lastY = 0;
    canvas.addEventListener('pointerdown', function (e) {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      cam.th -= (e.clientX - lastX) * 0.006;
      cam.ph = clamp(cam.ph - (e.clientY - lastY) * 0.005, 0.22, 2.72);
      lastX = e.clientX; lastY = e.clientY;
    });
    canvas.addEventListener('pointerup', function () { dragging = false; });
    canvas.addEventListener('pointercancel', function () { dragging = false; });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      cam.r = clamp(cam.r * (1 + e.deltaY * 0.001), opts.minR || 4, opts.maxR || 40);
    }, { passive: false });

    var visible = false;
    var io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.04 });
    io.observe(host);
    function resize() {
      var r = host.getBoundingClientRect();
      var w = Math.max(60, r.width), h = Math.max(60, r.height || 260);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    var ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();
    /* paint one static frame immediately so the scene is never blank,
       even before the visibility-gated ticker gets a chance */
    try {
      if (opts.tick) opts.tick(group, stateFn(), 0, 0);
      camera.position.set(
        target.x + cam.r * Math.sin(cam.ph) * Math.cos(cam.th),
        target.y + cam.r * Math.cos(cam.ph),
        target.z + cam.r * Math.sin(cam.ph) * Math.sin(cam.th)
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
    } catch (e) { console.error(e); }

    var stop = DL.charts.every(function (t, dt) {
      if (!visible || document.hidden || api.destroyed) return;
      if (!dragging && !DL.charts.reducedMotion()) cam.th += dt * 0.10;
      camera.position.set(
        target.x + cam.r * Math.sin(cam.ph) * Math.cos(cam.th),
        target.y + cam.r * Math.cos(cam.ph),
        target.z + cam.r * Math.sin(cam.ph) * Math.sin(cam.th)
      );
      camera.lookAt(target);
      if (opts.tick) opts.tick(group, stateFn(), t, dt);
      renderer.render(scene, camera);
    });

    api.destroy = function () {
      api.destroyed = true;
      io.disconnect(); ro.disconnect(); stop();
      try { renderer.dispose(); } catch (e) { /* ignore */ }
      host.innerHTML = '';
    };
    return api;
  }

  /* ---------------- scene B: osmosis cell ---------------- */
  function osmosis(host, getState) {
    var waterFresh = null, waterSalt = null, mol = null, ions = null, seed = null;
    var view3d = view(host, {
      state: getState,
      radius: 5.2, tx: 0, ty: 0.5, minR: 3, maxR: 12,
      build: function (g, ctx) {
        var glass = new THREE.MeshStandardMaterial({ color: 0xbdd6ee, transparent: true, opacity: 0.14, roughness: 0.12, metalness: 0.1, side: THREE.DoubleSide });
        function tank(x) {
          var box = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.6, 1.15), glass);
          box.position.set(x, 0.8, 0);
          g.add(box);
          var edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: 0x8fa3b8, transparent: true, opacity: 0.65 }));
          edges.position.copy(box.position);
          g.add(edges);
        }
        tank(-0.9); tank(0.9);
        var membrane = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.6),
          new THREE.MeshStandardMaterial({ color: 0xb07cd8, transparent: true, opacity: 0.5, roughness: 0.6, side: THREE.DoubleSide }));
        membrane.rotation.y = Math.PI / 2;
        membrane.position.set(0, 0.8, 0);
        g.add(membrane);
        waterFresh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.05),
          new THREE.MeshStandardMaterial({ color: 0x7aa2d8, transparent: true, opacity: 0.55, roughness: 0.25 }));
        waterSalt = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.05),
          new THREE.MeshStandardMaterial({ color: 0x5bc8be, transparent: true, opacity: 0.5, roughness: 0.25 }));
        waterFresh.position.set(-0.9, 0.5, 0);
        waterSalt.position.set(0.9, 0.5, 0);
        g.add(waterFresh); g.add(waterSalt);
        /* floor */
        var floor = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.08, 1.6), new THREE.MeshStandardMaterial({ color: 0x2c333c, roughness: 0.9 }));
        floor.position.y = -0.04;
        g.add(floor);
        mol = ctx.points(g, 110, 0x8fc7ee, 0.09);
        ions = ctx.points(g, 70, 0xe0955a, 0.11);
        seed = new Float32Array(110 * 2 + 70 * 2);
        for (var i = 0; i < seed.length; i++) seed[i] = Math.random();
      },
      tick: function (g, s, t, dt) {
        var headFrac = clamp((s.head || 0) / 300, 0, 1);
        var saltH = 1.28 + 0.1 * clamp(s.pi ? s.appliedBar / s.pi : 0, 0, 1);
        waterFresh.scale.set(1, Math.max(0.06, headFrac * 1.5 + 0.06), 1);
        waterFresh.position.y = waterFresh.scale.y * 0.5 + 0.04;
        waterSalt.scale.set(1, saltH, 1);
        waterSalt.position.y = saltH * 0.5 + 0.04;
        var slow = DL.charts.reducedMotion() ? 0 : 1;
        var dir = s.direction === 'in' ? 1 : s.direction === 'out' ? -1 : 0;
        var speed = (0.5 + (s.flux || 0.35)) * slow;
        for (var i = 0; i < mol.n; i++) {
          var b = seed[i * 2];
          if (dir !== 0) b = (b + dt * speed * 0.16 * dir) % 1;
          if (b < 0) b += 1;
          seed[i * 2] = b;
          mol.pos[i * 3] = -1.7 + b * 3.4;
          mol.pos[i * 3 + 1] = 0.25 + seed[i * 2 + 1] * 0.9 + Math.sin(t * 1.6 + i) * 0.05;
          mol.pos[i * 3 + 2] = (seed[i * 2 + 1] - 0.5) * 0.85;
          mol.mat.opacity = dir === 0 ? 0.35 : 0.92;
        }
        mol.dirty();
        for (var j = 0; j < ions.n; j++) {
          ions.pos[j * 3] = 0.16 + seed[220 + j * 2] * 1.45;
          ions.pos[j * 3 + 1] = 0.18 + seed[221 + j * 2] * Math.max(0.35, saltH - 0.18) + Math.sin(t * 2.2 + j * 1.3) * 0.05 * slow;
          ions.pos[j * 3 + 2] = (seed[220 + j * 2] - 0.5) * 0.8;
        }
        ions.dirty();
      }
    });
    view3d.getState = getState;
    return view3d;
  }

  /* ---------------- scene C: spiral-wound RO element ---------------- */
  function spiralRO(host, getState) {
    var feed = null, perm = null, brine = null, glow = null;
    var view3d = view(host, {
      state: getState,
      radius: 8, tx: 0, ty: 0.2, minR: 4.5, maxR: 18,
      build: function (g, ctx) {
        var housing = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 6.2, 40, 1, true),
          new THREE.MeshStandardMaterial({ color: 0xcfd6df, transparent: true, opacity: 0.12, roughness: 0.2, metalness: 0.35, side: THREE.DoubleSide }));
        housing.rotation.z = Math.PI / 2;
        g.add(housing);
        var core = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 5.9, 24),
          new THREE.MeshStandardMaterial({ color: 0xe6e9ee, roughness: 0.4, metalness: 0.25 }));
        core.rotation.z = Math.PI / 2;
        g.add(core);
        /* membrane spiral: radius shrinks toward the core */
        var pts = [];
        for (var i = 0; i <= 240; i++) {
          var q = i / 240;
          var r = 1.3 - 0.82 * q;
          var a = q * Math.PI * 12;
          pts.push(new THREE.Vector3((q - 0.5) * 5.2, r * Math.cos(a), r * Math.sin(a)));
        }
        var curve = new THREE.CatmullRomCurve3(pts);
        var memb = new THREE.Mesh(new THREE.TubeGeometry(curve, 260, 0.14, 8, false),
          new THREE.MeshStandardMaterial({ color: 0xe8e3d5, roughness: 0.7 }));
        g.add(memb);
        var feedSpacer = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
          pts.map(function (v) { var s = 1.22; return new THREE.Vector3(v.x, v.y * s, v.z * s); })
        ), 200, 0.05, 6, false),
          new THREE.MeshStandardMaterial({ color: 0xd07a55, transparent: true, opacity: 0.55, roughness: 0.8 }));
        g.add(feedSpacer);
        glow = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.72, 0.25, 40),
          new THREE.MeshStandardMaterial({ color: 0x7aa2d8, transparent: true, opacity: 0.35, emissive: 0x2a4a72 }));
        glow.rotation.z = Math.PI / 2;
        glow.position.x = -3.1;
        g.add(glow);
        feed = ctx.points(g, 150, 0xe0955a, 0.07);
        perm = ctx.points(g, 120, 0x5bc8be, 0.065);
        brine = ctx.points(g, 60, 0xe05a5f, 0.075);
      },
      tick: function (g, s, t, dt) {
        var slow = DL.charts.reducedMotion() ? 0 : 1;
        var feas = s.feasible !== false;
        var flux = feas ? clamp(s.flux || 0, 0, 18) : 0;
        var feedSp = 0.24 * slow;
        var permSp = clamp(0.06 + flux * 0.03, 0, 0.6) * slow * (feas ? 1 : 0);
        var brineSp = 0.3 * slow * (feas ? 1 : 0.5);
        /* seed via index hash — deterministic spread */
        for (var i = 0; i < feed.n; i++) {
          var ph = ((t * feedSp) + i / feed.n) % 1;
          var a0 = (i * 2.399963) % (Math.PI * 2);
          var rr = 1.42 + Math.sin(i * 7.7) * 0.06;
          feed.pos[i * 3] = -3.4 + ph * 6.0;
          feed.pos[i * 3 + 1] = rr * Math.cos(a0 + ph * 1.2);
          feed.pos[i * 3 + 2] = rr * Math.sin(a0 + ph * 1.2);
        }
        feed.mat.opacity = 0.85;
        feed.dirty();
        for (var j = 0; j < perm.n; j++) {
          var q = ((t * permSp) + j / perm.n) % 1;
          var ang = (j * 2.399963) % (Math.PI * 2);
          var r = 1.25 - 1.05 * q;
          var x = (q - 0.5) * 4.2 + (q > 0.75 ? (q - 0.75) * 8.5 : 0);
          perm.pos[j * 3] = Math.min(3.0, x);
          perm.pos[j * 3 + 1] = Math.max(0.18, r) * Math.cos(ang + q * 6);
          perm.pos[j * 3 + 2] = Math.max(0.18, r) * Math.sin(ang + q * 6);
        }
        perm.mat.opacity = feas ? 0.9 : 0.15;
        perm.dirty();
        for (var k2 = 0; k2 < brine.n; k2++) {
          var q2 = ((t * brineSp) + k2 / brine.n) % 1;
          var a2 = (k2 * 2.399963) % (Math.PI * 2);
          brine.pos[k2 * 3] = 1.6 + q2 * 2.4;
          brine.pos[k2 * 3 + 1] = 1.35 * Math.cos(a2);
          brine.pos[k2 * 3 + 2] = 1.35 * Math.sin(a2);
        }
        brine.mat.opacity = feas ? 0.85 : 0.6;
        brine.dirty();
        if (glow) {
          var over = Math.max(0, (s.appliedBar || 0) - (s.piBrine || 0));
          glow.material.opacity = 0.18 + clamp(over / 20, 0, 1) * 0.5 + (slow ? 0.08 * Math.sin(t * 2.4) : 0);
        }
      }
    });
    view3d.getState = getState;
    return view3d;
  }

  /* ---------------- scene G: whole-plant flyover ---------------- */
  function plant(host, getState) {
    var seaIn = null, permPts = null, brinePts = null, plume = null, sea = null;
    var view3d = view(host, {
      state: getState,
      radius: 12.5, theta: 1.32, phi: 1.02, tx: 2.2, ty: 0.7, minR: 6, maxR: 28,
      build: function (g, ctx) {
        sea = new THREE.Mesh(new THREE.PlaneGeometry(26, 14),
          new THREE.MeshStandardMaterial({ color: 0x1e3a52, transparent: true, opacity: 0.75, roughness: 0.6 }));
        sea.rotation.x = -Math.PI / 2;
        sea.position.set(-1, -0.35, 0);
        g.add(sea);
        var seaShelf = new THREE.Mesh(new THREE.PlaneGeometry(10, 8),
          new THREE.MeshStandardMaterial({ color: 0x2b5578, transparent: true, opacity: 0.55, roughness: 0.7 }));
        seaShelf.rotation.x = -Math.PI / 2;
        seaShelf.position.set(-4.5, -0.33, 2.5);
        g.add(seaShelf);
        /* land strip the plant sits on */
        var land = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.3, 4.2),
          new THREE.MeshStandardMaterial({ color: 0x4a5563, roughness: 0.95 }));
        land.position.set(2.6, -0.2, 0);
        g.add(land);
        function box(x, y, z, w, h, d, color, op) {
          var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
            new THREE.MeshStandardMaterial({ color: color, transparent: op != null, opacity: op != null ? op : 1, roughness: 0.75 }));
          m.position.set(x, y, z);
          g.add(m);
          var ed = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),
            new THREE.LineBasicMaterial({ color: 0xaab6c4, transparent: true, opacity: 0.4 }));
          ed.position.copy(m.position);
          g.add(ed);
          return m;
        }
        box(-3.2, 0.1, 0, 1.4, 0.5, 0.9, 0x37434f);          /* intake screen */
        box(-1.4, 0.35, 0, 1.8, 0.7, 1.1, 0x44525f);          /* pretreatment */
        box(-1.4, 0.78, 0, 1.95, 0.12, 1.25, 0x5a6773);       /* pretreatment roof */
        for (var f = 0; f < 2; f++) {                          /* clarifier tanks */
          var tank2 = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 20),
            new THREE.MeshStandardMaterial({ color: 0x5f7080, roughness: 0.6 }));
          tank2.position.set(-1.75 + f * 0.7, 1.05, -0.15);
          g.add(tank2);
        }
        box(0.4, 0.35, 0, 1.2, 0.7, 0.9, 0x3fae7a, 0.5);      /* UF/DF */
        for (var u = 0; u < 2; u++) {                          /* UF membrane trains */
          var uf = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.85, 14),
            new THREE.MeshStandardMaterial({ color: 0x7fd0b0, transparent: true, opacity: 0.85, roughness: 0.4 }));
          uf.position.set(0.15 + u * 0.5, 1.12, 0.2);
          g.add(uf);
        }
        box(2.6, 0.16, 0, 2.9, 0.14, 3.2, 0x46525f);          /* RO skid base */
        for (var i = 0; i < 3; i++) {
          var skid = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.2, 20),
            new THREE.MeshStandardMaterial({ color: i === 1 ? 0xe6ebf1 : 0xd3dae2, roughness: 0.45, metalness: 0.3 }));
          skid.rotation.z = Math.PI / 2;
          skid.position.set(2.6, 0.55, -1.35 + i * 1.35);
          g.add(skid);
          var capL = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.1, 20),
            new THREE.MeshStandardMaterial({ color: 0x8fa3b8, roughness: 0.5, metalness: 0.4 }));
          capL.rotation.z = Math.PI / 2;
          capL.position.set(1.42, 0.55, -1.35 + i * 1.35);
          g.add(capL);
          var capR = capL.clone();
          capR.position.x = 3.78;
          g.add(capR);
        }
        box(4.8, 0.7, 0, 1.3, 1.4, 1.3, 0x7aa2d8, 0.55);      /* clear well */
        var wellTop = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 1.24),
          new THREE.MeshStandardMaterial({ color: 0x9fc8ee, transparent: true, opacity: 0.9, roughness: 0.12 }));
        wellTop.rotation.x = -Math.PI / 2;
        wellTop.position.set(4.8, 1.42, 0);
        g.add(wellTop);
        box(6.8, 0.6, -0.6, 0.8, 1.2, 0.8, 0x8f98a3);         /* city A */
        box(7.4, 0.9, 0.3, 0.9, 1.8, 0.9, 0x7d8894);          /* city B */
        box(6.6, 0.45, 0.9, 0.7, 0.9, 0.7, 0x9aa4b0);         /* city C */
        box(7.9, 0.55, 1.1, 0.65, 1.1, 0.7, 0x86919d);        /* city D */
        /* pipes */
        function pipe(x1, x2, y, z, r, color, op) {
          var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, x2 - x1, 12),
            new THREE.MeshStandardMaterial({ color: color, transparent: true, opacity: op != null ? op : 0.9, roughness: 0.5 }));
          m.rotation.z = Math.PI / 2;
          m.position.set((x1 + x2) / 2, y, z);
          g.add(m);
        }
        pipe(-3.6, 1.4, 0.18, 0, 0.16, 0xe8a066);             /* seawater feed */
        pipe(3.8, 5.6, 0.95, 0, 0.13, 0x5bc8be);              /* permeate */
        pipe(5.5, 7.6, 0.5, 0.1, 0.11, 0x8fb7ff);             /* distribution */
        pipe(1.4, 2.6, 0.95, -0.45, 0.1, 0xbfd3e6);           /* UF → RO feed */
        var brinePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 12),
          new THREE.MeshStandardMaterial({ color: 0x5f4a52, transparent: true, opacity: 0.9, roughness: 0.6 }));
        brinePipe.rotation.z = Math.PI / 2.6;
        brinePipe.position.set(1.4, -0.1, 1.6);
        g.add(brinePipe);
        seaIn = ctx.points(g, 140, 0xf0a55e, 0.085);
        permPts = ctx.points(g, 95, 0x5bc8be, 0.07);
        brinePts = ctx.points(g, 55, 0xe05a5f, 0.08);
        plume = ctx.points(g, 70, 0xc26a6f, 0.09);
      },
      tick: function (g, s, t, dt) {
        var slow = DL.charts.reducedMotion() ? 0 : 1;
        var Y = clamp(s.recovery || 0.45, 0.2, 0.7);
        for (var i = 0; i < seaIn.n; i++) {
          var f = ((t * 0.18 * slow) + i / seaIn.n) % 1;
          seaIn.pos[i * 3] = -3.6 + f * 5.0;
          seaIn.pos[i * 3 + 1] = 0.32 + Math.sin(t * 2 + i) * 0.04 * slow;
          seaIn.pos[i * 3 + 2] = (Math.sin(i * 7.1) * 0.28);
        }
        seaIn.mat.opacity = 0.85; seaIn.dirty();
        for (var j = 0; j < permPts.n; j++) {
          var q = ((t * (0.14 + Y * 0.2) * slow) + j / permPts.n) % 1;
          permPts.pos[j * 3] = 3.8 + q * 1.8;
          permPts.pos[j * 3 + 1] = 0.98 + Math.sin(t * 2.4 + j) * 0.03 * slow;
          permPts.pos[j * 3 + 2] = Math.sin(j * 5.3) * 0.2;
        }
        permPts.mat.opacity = 0.9; permPts.dirty();
        for (var k2 = 0; k2 < brinePts.n; k2++) {
          var w = ((t * 0.2 * slow) + k2 / brinePts.n) % 1;
          brinePts.pos[k2 * 3] = 0.2 + w * 2.4;
          brinePts.pos[k2 * 3 + 1] = 0.25 - w * 0.55;
          brinePts.pos[k2 * 3 + 2] = 1.0 + w * 1.2 + Math.sin(k2 * 3.7) * 0.12;
        }
        brinePts.mat.opacity = 0.85; brinePts.dirty();
        for (var m = 0; m < plume.n; m++) {
          var sp = ((t * 0.06 * slow) + m / plume.n) % 1;
          plume.pos[m * 3] = 2.4 + sp * 2.6 + Math.sin(m * 9.1) * sp * 1.2;
          plume.pos[m * 3 + 1] = -0.3 - Math.abs(Math.sin(m * 4.4)) * 0.1;
          plume.pos[m * 3 + 2] = 2.2 + sp * 1.4 + Math.cos(m * 6.7) * sp;
        }
        plume.mat.opacity = 0.35; plume.dirty();
        if (sea) sea.position.y = -0.35 + Math.sin(t * 0.9) * 0.025 * slow;
      }
    });
    view3d.getState = getState;
    return view3d;
  }

  DL.gl = { view: view, osmosis: osmosis, spiralRO: spiralRO, plant: plant };
})();
