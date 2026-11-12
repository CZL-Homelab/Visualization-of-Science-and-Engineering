/* Fusion Lab — the femtometre stage.
 *
 * Nucleons as glossy spheres: red = proton, blue-grey = neutron. Three plays:
 *   fuse     D + T  → ⁴He + n          (products leave with a 1 : 4 speed ratio)
 *   scatter  D + T approach, the Coulomb barrier turns them around
 *   breed    n + ⁶Li → T + ⁴He
 * A cartoon of a quantum process: real nuclei are not hard balls, there is no
 * definite trajectory, and nothing here is to scale in size, speed or time.
 */
(function () {
  'use strict';
  var FL = globalThis.FL = globalThis.FL || {};
  var THREE = globalThis.THREE;
  var fx = FL.fx;

  var LAYOUT = {
    1: [[0, 0, 0]],
    2: [[-0.43, 0, 0], [0.43, 0, 0]],
    3: [[-0.48, -0.28, 0], [0.48, -0.28, 0], [0, 0.55, 0]],
    4: [[-0.45, -0.32, 0.32], [0.45, -0.32, 0.32], [0, -0.32, -0.5], [0, 0.48, 0]],
    5: [[-0.5, 0, 0.3], [0.5, 0, 0.3], [0, 0, -0.56], [0, 0.72, 0], [0, -0.72, 0]],
    6: [[-0.66, 0, 0], [0.66, 0, 0], [0, 0.66, 0], [0, -0.66, 0], [0, 0, 0.66], [0, 0, -0.66]],
    7: [[-0.7, 0, 0], [0.7, 0, 0], [0, 0.7, 0], [0, -0.7, 0], [0, 0, 0.7], [0, 0, -0.7], [0, 0, 0]]
  };
  var PLAYS = {
    fuse: {
      a: { name: '氘 D', sub: '1 质子 + 1 中子', n: ['p', 'n'], charge: 1 },
      b: { name: '氚 T', sub: '1 质子 + 2 中子', n: ['p', 'n', 'n'], charge: 1 },
      /* indices into the combined nucleon list [a..., b...] */
      out: [
        { name: '⁴He（α 粒子）', sub: '3.5 MeV · 带电，被磁场留住', pick: [0, 1, 2, 3], dir: [-1, -0.18, 0.1], speed: 1, tone: 'he' },
        { name: '中子 n', sub: '14.1 MeV · 不带电，直穿磁场', pick: [4], dir: [1, 0.18, -0.1], speed: 4, tone: 'n' }
      ]
    },
    breed: {
      a: { name: '中子 n', sub: '来自聚变', n: ['n'], charge: 0, fast: true },
      b: { name: '锂-6', sub: '3 质子 + 3 中子', n: ['p', 'p', 'p', 'n', 'n', 'n'], charge: 3, still: true },
      out: [
        { name: '氚 T', sub: '2.7 MeV · 新造出的燃料', pick: [1, 0, 4], dir: [0.9, 0.42, 0.1], speed: 1.33, tone: 't' },
        { name: '⁴He', sub: '2.1 MeV', pick: [2, 3, 5, 6], dir: [-0.9, -0.42, -0.1], speed: 1, tone: 'he' }
      ]
    }
  };

  function Micro(engine) {
    var self = this;
    this.engine = engine;
    this.group = new THREE.Group(); this.group.name = 'micro'; this.group.visible = false;
    this.play = 'fuse'; this.outcome = 'fuse'; this.fuseChance = 1;
    this.t = 0; this.cycle = 0; this.phase = '';
    this.duration = 8;

    var geom = new THREE.SphereGeometry(0.5, 32, 20);
    this.matP = new THREE.MeshStandardMaterial({ color: 0xff5b4a, roughness: 0.28, metalness: 0.15, emissive: 0x4a0d06 });
    this.matN = new THREE.MeshStandardMaterial({ color: 0x8ea3c2, roughness: 0.3, metalness: 0.2, emissive: 0x10161f });
    this.nucleons = [];
    for (var i = 0; i < 7; i++) { var m = new THREE.Mesh(geom, this.matN); this.group.add(m); this.nucleons.push({ mesh: m, pos: new THREE.Vector3() }); }

    /* Coulomb "atmosphere" around each charged reactant */
    var auraMat = function (hex) {
      return fx.additive({ uColor: { value: new THREE.Color(hex) }, uIntensity: { value: 0 } },
        'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }',
        'uniform vec3 uColor; uniform float uIntensity; varying vec3 vN; varying vec3 vV; void main(){ float n = abs(dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(uColor * pow(1.0 - n, 2.2) * uIntensity, 1.0); }');
    };
    this.aura = [new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), auraMat(0x6aa8ff)), new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), auraMat(0x6aa8ff))];
    this.aura.forEach(function (a) { a.renderOrder = 20; self.group.add(a); });

    /* the flash and two expanding shock rings at the moment of fusion */
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color: fx.hdr(0xfff1d0, 1.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.group.add(this.flash);
    this.rings = [0, 1].map(function () {
      var r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 80), new THREE.MeshBasicMaterial({ color: fx.hdr(0xffc27a, 2.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      self.group.add(r); return r;
    });
    /* streaks behind the products: length shows speed */
    this.trails = [0, 1].map(function () {
      var g = new THREE.CylinderGeometry(0.02, 0.42, 1, 16, 1, true);
      g.translate(0, -0.5, 0);
      var t = new THREE.Mesh(g, fx.additive({ uColor: { value: new THREE.Color(0xffffff) }, uIntensity: { value: 0 } },
        'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        'uniform vec3 uColor; uniform float uIntensity; varying vec2 vUv; void main(){ gl_FragColor = vec4(uColor * vUv.y * vUv.y * uIntensity, 1.0); }', { side: THREE.DoubleSide }));
      t.renderOrder = 19; self.group.add(t); return t;
    });

    /* thermal background: the rest of the plasma, out of focus */
    var N = 420, pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
    for (var k = 0; k < N; k++) {
      pos.set([(Math.random() - 0.5) * 70, (Math.random() - 0.5) * 40, -6 - Math.random() * 46], k * 3);
      seed.set([Math.random(), Math.random(), Math.random()], k * 3);
    }
    var bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    this.bgMat = fx.additive({ uTime: { value: 0 }, uPx: { value: 600 }, uHot: { value: 0.5 } },
      'attribute vec3 aSeed; uniform float uTime; uniform float uPx; uniform float uHot; varying vec3 vC; void main(){ float sp = 0.6 + 3.4 * uHot; vec3 p = position + vec3(sin(uTime * sp * (0.3 + aSeed.x) + aSeed.y * 40.0), cos(uTime * sp * (0.25 + aSeed.y) + aSeed.z * 40.0), sin(uTime * sp * 0.2 + aSeed.x * 20.0)) * (1.0 + 2.5 * uHot); vC = aSeed.z < 0.5 ? vec3(0.2, 0.55, 1.0) : vec3(1.0, 0.5, 0.18); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (0.5 + aSeed.x) * uPx * 0.9 / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }',
      'varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * a * a * 0.5, 1.0); }');
    var pts = new THREE.Points(bg, this.bgMat); pts.frustumCulled = false; this.group.add(pts);

    this.centers = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this._restart();
  }

  Micro.prototype.setPlay = function (play, opts) {
    opts = opts || {};
    var changed = play !== this.play;
    this.play = play;
    if (opts.fuseChance != null) this.fuseChance = opts.fuseChance;
    if (opts.hot != null) this.bgMat.uniforms.uHot.value = opts.hot;
    if (changed || opts.restart) { this.t = 0; this._restart(); }
  };
  Micro.prototype._restart = function () {
    var P = PLAYS[this.play === 'breed' ? 'breed' : 'fuse'];
    this.spec = P;
    this.cycle++;
    /* deterministic alternation keeps the lesson repeatable: chance 0.5 means every other try */
    this.acc = (this.acc || 0) + this.fuseChance;
    this.outcome = this.play === 'breed' ? 'fuse' : (this.play === 'scatter' ? 'scatter' : (this.acc >= 1 ? 'fuse' : 'scatter'));
    if (this.acc >= 1) this.acc -= 1;
    var all = P.a.n.concat(P.b.n), self = this;
    this.nucleons.forEach(function (nu, i) {
      nu.mesh.visible = i < all.length;
      if (i < all.length) nu.mesh.material = all[i] === 'p' ? self.matP : self.matN;
    });
    this.phase = '';
  };
  /* where every cluster centre is at time t (seconds into the cycle) */
  Micro.prototype._solve = function (t) {
    var P = this.spec, c = this.centers, far = 11.5, meet = 2.9;
    var approach = Math.min(1, t / meet), e = 1 - Math.pow(1 - approach, 2.2);     // decelerating: repulsion
    if (P.a.fast) e = approach;
    var gapEnd = this.outcome === 'fuse' ? 0.0 : 2.3;
    var ax = -far + (far - gapEnd / 2 - (P.b.still ? 0 : 0)) * e, bx = P.b.still ? 0 : far - (far - gapEnd / 2) * e;
    if (P.b.still) ax = -far * 1.3 + (far * 1.3 - 0.4) * e;
    c[0].set(ax, 0.0, 0); c[1].set(bx, 0, 0);
    var after = Math.max(0, t - meet);
    if (this.outcome === 'scatter') {
      /* turn-around: fly back out on deflected paths */
      var k = after * after * 1.5 + after * 0.6;
      c[0].set(ax - k * 0.92, k * 0.42, k * 0.1); c[1].set(bx + k * 0.92, -k * 0.42, -k * 0.1);
      return { stage: after > 0 ? 'bounce' : 'approach', after: after, e: e };
    }
    if (after <= 0) return { stage: 'approach', after: 0, e: e };
    var hold = 0.38;
    if (after < hold) { c[0].set(0, 0, 0); c[1].set(0, 0, 0); return { stage: 'compound', after: after, e: 1 }; }
    var fly = after - hold;
    for (var i = 0; i < 2; i++) {
      var o = P.out[i], d = (0.9 + fly * 2.1) * o.speed * Math.min(1, fly * 3 + 0.2);
      c[2 + i].set(o.dir[0], o.dir[1], o.dir[2]).normalize().multiplyScalar(d * fly * 1.6 + 0.3);
    }
    return { stage: 'products', after: fly, e: 1 };
  };
  Micro.prototype.labels = function () {
    var P = this.spec, c = this.centers, self = this, st = this.phase;
    var up = function (v, h) { return function () { return self.group.visible ? new THREE.Vector3(v.x, v.y + h, v.z) : null; }; };
    if (st === 'products') return P.out.map(function (o, i) { return { id: 'mo' + i, text: o.name, sub: o.sub, at: up(c[2 + i], i === 0 ? 1.5 : 1.0), tone: o.tone }; });
    var list = [{ id: 'ma', text: P.a.name, sub: P.a.sub, at: up(c[0], 1.3), tone: P.a.charge ? 'd' : 'n', side: 'l' }, { id: 'mb', text: P.b.name, sub: P.b.sub, at: up(c[1], P.b.n.length > 3 ? 1.7 : 1.4), tone: 't' }];
    if (st === 'bounce') list.push({ id: 'mx', text: '库仑斥力把它们推开', sub: '动能不够，隧穿概率太小', at: function () { return self.group.visible ? new THREE.Vector3(0, -1.6, 0) : null; }, tone: 'warn' });
    return list;
  };
  Micro.prototype.update = function (time, dt) {
    if (!this.group.visible) return;
    this.t += dt;
    if (this.t > this.duration) { this.t = 0; this._restart(); }
    var s = this._solve(this.t), P = this.spec, c = this.centers, i;
    if (s.stage !== this.phase) { this.phase = s.stage; if (this.onPhase) this.onPhase(s.stage, this.outcome); }
    var na = P.a.n.length, total = na + P.b.n.length, spin = time * 0.9;
    var place = function (nu, centre, layout, idx, wob) {
      var o = layout[idx];
      var cs = Math.cos(spin + wob), sn = Math.sin(spin + wob);
      nu.pos.set(centre.x + o[0] * cs - o[2] * sn, centre.y + o[1] + 0.04 * Math.sin(time * 9 + idx * 2.1), centre.z + o[0] * sn + o[2] * cs);
    };
    for (i = 0; i < total; i++) {
      var nu = this.nucleons[i];
      if (s.stage === 'approach' || s.stage === 'bounce') {
        if (i < na) place(nu, c[0], LAYOUT[na], i, 0); else place(nu, c[1], LAYOUT[total - na], i - na, 1.7);
      } else if (s.stage === 'compound') {
        place(nu, c[0], LAYOUT[total], i, time * 6);            // one agitated compound nucleus
      } else {
        for (var k = 0; k < 2; k++) { var idx = P.out[k].pick.indexOf(i); if (idx >= 0) place(nu, c[2 + k], LAYOUT[P.out[k].pick.length], idx, k * 1.3); }
      }
      nu.mesh.position.lerp(nu.pos, s.stage === 'compound' ? 0.35 : 0.5);
      if (s.stage === 'approach' && this.t < 0.05) nu.mesh.position.copy(nu.pos);
    }
    /* Coulomb atmospheres brighten as the two charges close in */
    var gap = c[0].distanceTo(c[1]), close = Math.max(0, 1 - gap / 9);
    for (i = 0; i < 2; i++) {
      var spec = i === 0 ? P.a : P.b, a = this.aura[i];
      var on = (s.stage === 'approach' || s.stage === 'bounce') && spec.charge > 0;
      a.visible = on; a.position.copy(c[i]);
      a.scale.setScalar((spec.n.length > 3 ? 1.9 : 1.35) + close * 0.5);
      a.material.uniforms.uIntensity.value = on ? 0.25 + 1.6 * close * close * (P.a.charge ? 1 : 0.3) : 0;
    }
    /* flash, rings, trails */
    var f = s.stage === 'compound' ? s.after / 0.38 : s.stage === 'products' ? Math.max(0, 1 - s.after * 1.8) : 0;
    this.flash.visible = f > 0.01; this.flash.scale.setScalar(0.25 + f * 0.35);
    this.flash.material.opacity = f * 0.18;
    for (i = 0; i < 2; i++) {
      var ring = this.rings[i], rt = s.stage === 'products' ? s.after - i * 0.22 : -1;
      ring.visible = rt > 0 && rt < 2.4;
      if (ring.visible) { ring.scale.setScalar(0.6 + rt * 5.5); ring.material.opacity = Math.max(0, 0.8 - rt / 2.4); ring.lookAt(this.engine.camera.position); }
      var trail = this.trails[i];
      trail.visible = s.stage === 'products';
      if (trail.visible) {
        var o = P.out[i], dir = c[2 + i].clone().normalize();
        trail.position.copy(c[2 + i]);
        trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        trail.scale.set(1, Math.min(c[2 + i].length(), 1.2 + o.speed * 2.6), 1);
        trail.material.uniforms.uColor.value.set(o.tone === 'n' ? 0xcfe2ff : o.tone === 't' ? 0xffb060 : 0xd8f27a);
        trail.material.uniforms.uIntensity.value = Math.min(1, s.after * 3) * Math.max(0, 1 - s.after / 4.2) * 0.9;
      }
    }
    var u = this.bgMat.uniforms;
    u.uTime.value = time; u.uPx.value = this.engine.h * this.engine.dpr / (2 * Math.tan(this.engine.camera.fov * Math.PI / 360));
  };

  FL.Micro = Micro;
})();
