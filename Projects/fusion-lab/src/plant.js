/* Fusion Lab — the plant around the machine.
 *
 * Two stylised equipment sets on a common floor: the tritium plant (inner and
 * outer fuel loops) and the power-conversion island of a future power plant.
 * Blocks are diagrammatic stand-ins placed for legibility: sizes, distances
 * and pipe routes are not a plant layout. Pipe colour = what flows, dash speed
 * = direction only.
 */
(function () {
  'use strict';
  var FL = globalThis.FL = globalThis.FL || {};
  var THREE = globalThis.THREE;
  var geo = FL.geo, fx = FL.fx;
  var FLOOR = -11.6;
  var COLORS = {
    d: 0x58d8ff, t: 0xffa64a, dt: 0xc78bff, he: 0xc9e265, hot: 0xff6a3d, cold: 0x4f8dff,
    steam: 0xe8f0ff, power: 0xffe45c, li: 0x9be8c0
  };

  function V(x, y, z) { return new THREE.Vector3(x, y, z); }

  function Plant(engine) {
    var self = this;
    this.engine = engine;
    this.group = new THREE.Group(); this.group.name = 'plant';
    this.sets = { cycle: new THREE.Group(), power: new THREE.Group() };
    this.level = { cycle: 0, power: 0 }; this.goal = { cycle: 0, power: 0 };
    this.flows = []; this.spin = []; this.anchors = {};
    this.pipeGroups = { cycle: [], power: [] };
    this.group.add(this.sets.cycle, this.sets.power);

    /* ----- floor ----- */
    var floorMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uInk: { value: new THREE.Color(0x7f93b8) }, uBase: { value: new THREE.Color(0x0b0e14) }, uOpacity: { value: 1 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform vec3 uInk; uniform vec3 uBase; uniform float uOpacity; varying vec3 vP;',
        'float grid(vec2 p, float s){ vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s); return 1.0 - min(min(g.x, g.y), 1.0); }',
        'void main(){ float r = length(vP.xy); float fade = smoothstep(120.0, 20.0, r);',
        '  float g = grid(vP.xy, 5.0) * 0.16 + grid(vP.xy, 25.0) * 0.22;',
        '  vec3 c = uBase + uInk * g * fade;',
        '  gl_FragColor = vec4(c, uOpacity * smoothstep(125.0, 60.0, r)); }'
      ].join('\n')
    });
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(125, 96), floorMat);
    this.floor.rotation.x = -Math.PI / 2; this.floor.position.y = FLOOR - 0.02; this.floor.renderOrder = -5;
    this.group.add(this.floor);
    this.floorMat = floorMat;

    /* a person for scale, on the floor in front of the cutaway */
    var person = new THREE.Group(), skin = new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.6, metalness: 0.1, emissive: 0x5a4208 });
    var body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.0, 4, 10), skin); body.position.y = 0.74;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin); head.position.y = 1.63;
    person.add(body, head); person.position.set(4.5, FLOOR, 17.5);
    this.group.add(person); this.person = person;
    this.anchors.person = V(4.5, FLOOR + 2.1, 17.5);

    /* ----- shared part factories ----- */
    var steel = function (color, rough) { return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.42 : rough, metalness: 0.85 }); };
    var trim = function (mesh, color) {
      var e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), new THREE.LineBasicMaterial({ color: fx.hdr(color, 1.5), transparent: true, opacity: 0.55 }));
      mesh.add(e); return mesh;
    };
    function box(set, w, h, d, x, z, color, accent, y) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steel(color));
      m.position.set(x, (y == null ? FLOOR : y) + h / 2, z);
      if (accent) trim(m, accent);
      self.sets[set].add(m); return m;
    }
    function cyl(set, r, h, x, z, color, accent, opts) {
      opts = opts || {};
      var m = new THREE.Mesh(new THREE.CylinderGeometry(opts.rTop == null ? r : opts.rTop, r, h, 28), steel(color, opts.rough));
      m.position.set(x, (opts.y == null ? FLOOR : opts.y) + h / 2, z);
      if (opts.axis === 'z') { m.rotation.x = Math.PI / 2; m.position.y = opts.y; }
      if (opts.dome) {
        var cap = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.material);
        cap.position.y = h / 2; m.add(cap);
      }
      if (accent) {
        var band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, Math.max(0.04, r * 0.035), 6, 40), new THREE.MeshBasicMaterial({ color: fx.hdr(accent, 1.6) }));
        band.rotation.x = Math.PI / 2; band.position.y = opts.bandY == null ? h * 0.3 : opts.bandY; m.add(band);
      }
      self.sets[set].add(m); return m;
    }
    function pad(set, x, z, w, d, color) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), new THREE.MeshStandardMaterial({ color: 0x161b24, roughness: 0.85, metalness: 0.2 }));
      m.position.set(x, FLOOR + 0.09, z); trim(m, color);
      self.sets[set].add(m); return m;
    }
    /* a pipe = dark carrier tube + additive flow dashes */
    var carrier = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.5, metalness: 0.8 });
    function pipe(set, pts, kind, opts) {
      opts = opts || {};
      var path = geo.roundedPath(pts, opts.fillet == null ? 1.4 : opts.fillet), r = opts.r || 0.22;
      var len = 0;
      for (var i = 1; i < path.length; i++) len += path[i].distanceTo(path[i - 1]);
      var base = new THREE.Mesh(geo.tube(path, r, 8, false), carrier);
      var mat = fx.flowMaterial(fx.hdr(COLORS[kind], opts.gain || 1.7), { dashes: Math.max(2, len / (opts.dash || 2.6)), speed: (opts.speed || 4.2) / Math.max(1, len) * (len / (opts.dash || 2.6)), base: 0.16, intensity: 0 });
      var flow = new THREE.Mesh(geo.tube(path, r * 1.22, 8, false), mat);
      flow.renderOrder = 6;
      self.sets[set].add(base, flow);
      self.flows.push(mat); self.pipeGroups[set].push(mat);
      return { base: base, flow: flow, mat: mat, mid: path[Math.floor(path.length / 2)].clone() };
    }

    /* ================= tritium plant (−X side) ================= */
    var C = 'cycle', lo = FLOOR + 1.1, hi = FLOOR + 6.5;
    pad(C, -30, 2, 34, 54, COLORS.t);
    /* exhaust processing: palladium-silver permeators */
    box(C, 6, 3.2, 5, -24, -8, 0x5d6878, COLORS.dt);
    [-1.6, 0, 1.6].forEach(function (dx) { cyl(C, 0.55, 3.4, -24 + dx, -8, 0x8a96a8, COLORS.dt, { y: FLOOR + 3.2, dome: true, bandY: 0.6 }); });
    this.anchors.tep = V(-24, FLOOR + 8.4, -8);
    /* isotope separation: cryogenic distillation columns */
    box(C, 7.5, 1.4, 5.5, -36, 4, 0x4d5868, COLORS.t);
    [[-38.4, 3], [-36.4, 5.2], [-34.6, 2.8], [-33.4, 5.4]].forEach(function (p, i) {
      cyl(C, 0.62, 12.5 - i * 1.3, p[0], p[1], 0xa9b6c9, i % 2 ? COLORS.d : COLORS.t, { y: FLOOR + 1.4, dome: true, bandY: 2 + i });
    });
    this.anchors.iss = V(-36.4, FLOOR + 15.6, 4);
    /* storage and delivery: getter beds */
    box(C, 8, 1.2, 5, -25, 17, 0x4d5868, COLORS.t);
    for (var b = 0; b < 6; b++) cyl(C, 0.62, 3.6, -28 + (b % 3) * 3, 15.6 + Math.floor(b / 3) * 2.8, 0x7d6a55, COLORS.t, { y: FLOOR + 1.2, dome: true, bandY: 1.2 });
    this.anchors.sds = V(-25, FLOOR + 7.4, 17);
    /* fuelling: pellet injector and gas valve boxes */
    box(C, 4.2, 2.6, 3, -17.5, 14, 0x5d6878, COLORS.dt);
    cyl(C, 0.4, 4.6, -17.5, 12.4, 0x9aa6b8, COLORS.dt, { axis: 'z', y: FLOOR + 3.4 });
    this.anchors.fuelling = V(-17.5, FLOOR + 6.0, 14);
    /* blanket tritium extraction */
    box(C, 5.5, 2.4, 4.5, -23, -21, 0x5d6878, COLORS.li);
    cyl(C, 0.8, 6.5, -24.2, -21, 0x9fb6a8, COLORS.li, { y: FLOOR + 2.4, dome: true, bandY: 2 });
    cyl(C, 0.8, 5.2, -21.8, -21, 0x9fb6a8, COLORS.t, { y: FLOOR + 2.4, dome: true, bandY: 1.6 });
    this.anchors.tes = V(-23, FLOOR + 10.6, -21);
    /* detritiation and helium vent */
    box(C, 4, 2.2, 4, -39, -13, 0x4d5868, COLORS.he);
    cyl(C, 0.55, 17, -39, -13, 0x8f99a6, COLORS.he, { y: FLOOR + 2.2, rTop: 0.38, bandY: 6 });
    this.anchors.stack = V(-39, FLOOR + 20.6, -13);
    /* deuterium supply */
    cyl(C, 1.7, 4.4, -41, 19, 0x3f6f8c, COLORS.d, { dome: true, bandY: 0.4 });
    this.anchors.dsupply = V(-41, FLOOR + 8, 19);
    /* torus cryopumps sit in the lower ports of the machine */
    this.anchors.cryopump = V(-12.4, -5.1, -2.2);
    this.anchors.blanketOut = V(-9.6, 4.6, -9.6);

    this.pipes = {};
    this.pipes.exhaust = pipe(C, [V(-12.6, -5.3, -2.2), V(-17, -5.3, -2.2), V(-17, lo, -2.2), V(-17, lo, -8), V(-21, lo, -8)], 'dt');
    this.pipes.tepIss = pipe(C, [V(-27, lo, -8), V(-31, lo, -8), V(-31, lo, 3.2), V(-33.6, lo, 3.2)], 'dt');
    this.pipes.helium = pipe(C, [V(-24, FLOOR + 6.4, -9.5), V(-24, FLOOR + 6.4, -13), V(-37, FLOOR + 6.4, -13)], 'he', { r: 0.16 });
    this.pipes.issT = pipe(C, [V(-36.4, FLOOR + 3.2, 6), V(-36.4, FLOOR + 3.2, 11), V(-30, FLOOR + 3.2, 11), V(-30, FLOOR + 3.2, 15.6), V(-28.6, FLOOR + 3.2, 15.6)], 't', { r: 0.18 });
    this.pipes.issD = pipe(C, [V(-38.4, FLOOR + 4.6, 3.6), V(-41.5, FLOOR + 4.6, 3.6), V(-41.5, FLOOR + 4.6, 13), V(-33, FLOOR + 4.6, 13), V(-33, FLOOR + 4.6, 18.4), V(-28.6, FLOOR + 4.6, 18.4)], 'd', { r: 0.18 });
    this.pipes.dFeed = pipe(C, [V(-39.3, FLOOR + 1.6, 19), V(-34, FLOOR + 1.6, 19), V(-34, FLOOR + 1.6, 21.6), V(-28, FLOOR + 1.6, 21.6), V(-28, FLOOR + 1.6, 19.2)], 'd', { r: 0.16 });
    this.pipes.fuel = pipe(C, [V(-21, lo + 0.6, 17), V(-17.5, lo + 0.6, 17), V(-17.5, lo + 0.6, 15.5)], 'dt');
    this.pipes.inject = pipe(C, [V(-17.5, FLOOR + 3.4, 10.1), V(-17.5, FLOOR + 3.4, 7), V(-17.5, 3.4, 7), V(-11.2, 3.4, 4.5)], 'dt', { r: 0.18 });
    this.pipes.bred = pipe(C, [V(-9.4, 4.4, -9.4), V(-16, 4.4, -16), V(-16, hi, -21), V(-20.6, hi, -21)], 't', { r: 0.18 });
    this.pipes.tesIss = pipe(C, [V(-25.6, FLOOR + 4.2, -21), V(-32.5, FLOOR + 4.2, -21), V(-32.5, FLOOR + 4.2, 1.4), V(-34.6, FLOOR + 4.2, 1.4)], 't', { r: 0.18 });

    /* ================= power conversion (+X side) ================= */
    var P = 'power';
    pad(P, 37, 2, 46, 52, COLORS.hot);
    /* steam generators */
    [-7, 7].forEach(function (z) { cyl(P, 2.1, 11, 24, z, 0x8793a6, COLORS.hot, { dome: true, bandY: 3 }); });
    this.anchors.sg = V(24, FLOOR + 15.2, -7);
    /* turbine train along z: HP, two LP casings, generator */
    var deckY = FLOOR + 5.2;
    box(P, 9, 3.4, 30, 40, 0, 0x2d3440, COLORS.steam);
    this.anchors.condenser = V(44.6, FLOOR + 2.2, -6);
    cyl(P, 1.7, 5, 40, -11, 0x9aa6b8, COLORS.steam, { axis: 'z', y: deckY + 0.6 });
    cyl(P, 2.7, 6, 40, -4.5, 0xa9b6c9, COLORS.steam, { axis: 'z', y: deckY + 1.0 });
    cyl(P, 2.7, 6, 40, 2.5, 0xa9b6c9, COLORS.steam, { axis: 'z', y: deckY + 1.0 });
    cyl(P, 2.0, 6.5, 40, 10.5, 0x4f7fb0, COLORS.power, { axis: 'z', y: deckY + 0.7 });
    this.anchors.turbine = V(40, deckY + 5.6, -3);
    this.anchors.generator = V(40, deckY + 4.6, 10.5);
    /* visible couplings on the shaft so rotation can be read */
    [-7.9, -1, 6.4].forEach(function (z) {
      var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.3, metalness: 0.9, flatShading: true }));
      disc.rotation.x = Math.PI / 2; disc.position.set(40, deckY + 0.9, z);
      self.sets.power.add(disc); self.spin.push(disc);
    });
    /* cooling tower */
    var towerPts = [];
    for (var ti = 0; ti <= 20; ti++) { var u = ti / 20; towerPts.push(new THREE.Vector2(4.6 + 4.2 * Math.pow(1 - u * 1.25, 2), u * 21)); }
    var tower = new THREE.Mesh(new THREE.LatheGeometry(towerPts, 40), new THREE.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide }));
    tower.position.set(57, FLOOR, -12); this.sets.power.add(tower);
    this.anchors.tower = V(57, FLOOR + 24, -12);
    /* vapour: soft points rising out of the tower */
    var VN = 70, vp = new Float32Array(VN * 3), vs = new Float32Array(VN);
    for (var vi = 0; vi < VN; vi++) { vp.set([57 + (Math.random() - 0.5) * 6, FLOOR + 21, -12 + (Math.random() - 0.5) * 6], vi * 3); vs[vi] = Math.random(); }
    var vg = new THREE.BufferGeometry();
    vg.setAttribute('position', new THREE.BufferAttribute(vp, 3)); vg.setAttribute('aSeed', new THREE.BufferAttribute(vs, 1));
    this.vapourMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uPx: { value: 600 }, uIntensity: { value: 0 } },
      vertexShader: 'attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA; void main(){ float p = fract(uTime * 0.06 + aSeed); vec3 q = position + vec3(sin(aSeed * 40.0 + p * 3.0) * 2.0 * p + p * 5.0, p * 16.0, cos(aSeed * 31.0) * 2.0 * p); vA = smoothstep(0.0, 0.15, p) * (1.0 - p); vec4 mv = modelViewMatrix * vec4(q, 1.0); gl_PointSize = (3.0 + 7.0 * p) * uPx / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uIntensity; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.75, 0.8, 0.88), smoothstep(0.5, 0.0, d) * vA * 0.16 * uIntensity); }'
    });
    var vapour = new THREE.Points(vg, this.vapourMat); vapour.frustumCulled = false; vapour.renderOrder = 7;
    this.sets.power.add(vapour);
    /* transformer and the first two pylons of the grid connection */
    var tr = box(P, 4.5, 3.6, 3.6, 40, 20, 0x5d6878, COLORS.power);
    [-1.3, 0, 1.3].forEach(function (dx) { var ins = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.8, 10), steel(0xc9b89a)); ins.position.set(dx, 2.7, 0); tr.add(ins); });
    this.anchors.transformer = V(40, FLOOR + 7.2, 20);
    var pylonMat = new THREE.LineBasicMaterial({ color: 0x9aa6b8, transparent: true, opacity: 0.9 });
    var pylon = function (x, z, h) {
      var pts = [], w = 2.2, arm = 4.2;
      [[-w, -w], [w, -w], [w, w], [-w, w]].forEach(function (c, i, all) {
        var n = all[(i + 1) % 4];
        pts.push(V(c[0], 0, c[1]), V(c[0] * 0.25, h, c[1] * 0.25), V(c[0], 0, c[1]), V(n[0] * 0.6, h * 0.45, n[1] * 0.6), V(n[0], 0, n[1]), V(c[0] * 0.6, h * 0.45, c[1] * 0.6));
      });
      [0.72, 0.9].forEach(function (k) { pts.push(V(-arm, h * k, 0), V(arm, h * k, 0), V(-arm, h * k, 0), V(0, h * k + 1.2, 0), V(arm, h * k, 0), V(0, h * k + 1.2, 0)); });
      var m = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), pylonMat);
      m.position.set(x, FLOOR, z); m.rotation.y = -0.62; self.sets.power.add(m);
    };
    pylon(52, 30, 15); pylon(72, 44, 15);
    this.anchors.grid = V(62, FLOOR + 16, 37);
    this.anchors.recirc = V(22, FLOOR + 3.6, 22);

    var hotY = 2.6, coldY = -2.2, sgTop = FLOOR + 9.5, sgLow = FLOOR + 2.4;
    this.pipes.hotA = pipe(P, [V(12.6, hotY, -3.2), V(18, hotY, -3.2), V(18, sgTop, -7), V(21.9, sgTop, -7)], 'hot', { r: 0.3 });
    this.pipes.hotB = pipe(P, [V(12.6, hotY, 3.2), V(18, hotY, 3.2), V(18, sgTop, 7), V(21.9, sgTop, 7)], 'hot', { r: 0.3 });
    this.pipes.coldA = pipe(P, [V(21.9, sgLow, -7), V(16, sgLow, -7), V(16, coldY, -4.6), V(12.6, coldY, -4.6)], 'cold', { r: 0.3 });
    this.pipes.coldB = pipe(P, [V(21.9, sgLow, 7), V(16, sgLow, 7), V(16, coldY, 4.6), V(12.6, coldY, 4.6)], 'cold', { r: 0.3 });
    this.pipes.steamA = pipe(P, [V(24, FLOOR + 13.2, -7), V(24, FLOOR + 15.4, -7), V(40, FLOOR + 15.4, -11), V(40, deckY + 2.4, -11)], 'steam', { r: 0.26, speed: 6 });
    this.pipes.steamB = pipe(P, [V(24, FLOOR + 13.2, 7), V(24, FLOOR + 16.6, 7), V(37, FLOOR + 16.6, -11), V(39.4, deckY + 2.4, -11.6)], 'steam', { r: 0.26, speed: 6 });
    this.pipes.feed = pipe(P, [V(36, FLOOR + 1.4, 0), V(30, FLOOR + 1.4, 0), V(30, FLOOR + 1.4, -7), V(26.2, FLOOR + 1.4, -7)], 'cold', { r: 0.22 });
    this.pipes.feedB = pipe(P, [V(30, FLOOR + 1.4, 0), V(30, FLOOR + 1.4, 7), V(26.2, FLOOR + 1.4, 7)], 'cold', { r: 0.22 });
    this.pipes.towerOut = pipe(P, [V(44.5, FLOOR + 2.2, -8), V(50, FLOOR + 2.2, -8), V(50, FLOOR + 2.2, -12), V(52.6, FLOOR + 2.2, -12)], 'hot', { r: 0.26, gain: 0.9 });
    this.pipes.towerBack = pipe(P, [V(52.8, FLOOR + 0.9, -14.5), V(47, FLOOR + 0.9, -14.5), V(47, FLOOR + 0.9, -3), V(44.5, FLOOR + 0.9, -3)], 'cold', { r: 0.26 });
    this.pipes.bus = pipe(P, [V(40, deckY + 0.7, 13.8), V(40, deckY + 0.7, 16.5), V(40, FLOOR + 4.6, 18.2)], 'power', { r: 0.12, fillet: 0.6, speed: 8 });
    this.pipes.gridLine = pipe(P, [V(40, FLOOR + 5.4, 21), V(46, FLOOR + 13.6, 26), V(52, FLOOR + 13.6, 30), V(72, FLOOR + 13.6, 44), V(96, FLOOR + 13.6, 61)], 'power', { r: 0.1, fillet: 0.4, speed: 9, dash: 3.4 });
    this.pipes.recirc = pipe(P, [V(38, FLOOR + 1.0, 20), V(22, FLOOR + 1.0, 22), V(14, FLOOR + 1.0, 17), V(11.5, -3, 12.5)], 'power', { r: 0.1, fillet: 1.2, speed: 6, gain: 1.1 });

    this.sets.cycle.scale.y = 0.001; this.sets.power.scale.y = 0.001;
    this.sets.cycle.position.y = 0; this.sets.power.position.y = 0;
  }

  Plant.COLORS = COLORS;
  Plant.FLOOR = FLOOR;
  Plant.prototype.show = function (o) {
    this.goal.cycle = o && o.cycle ? 1 : 0;
    this.goal.power = o && o.power ? 1 : 0;
  };
  /* per-pipe emphasis: names listed stay bright, the rest dim (null = all bright) */
  Plant.prototype.emphasise = function (names) { this.emph = names && names.length ? names : null; };
  Plant.prototype.update = function (time, dt, raw) {
    var self = this, px = this.engine.h * this.engine.dpr / (2 * Math.tan(this.engine.camera.fov * Math.PI / 360));
    ['cycle', 'power'].forEach(function (k) {
      var L = self.level, g = self.goal[k];
      L[k] += (g - L[k]) * Math.min(1, raw * 3);
      if (Math.abs(g - L[k]) < 0.002) L[k] = g;
      var set = self.sets[k], e = FL.ease(L[k]);
      set.visible = L[k] > 0.004;
      /* equipment rises out of the floor instead of popping in */
      set.scale.y = Math.max(0.001, e); set.position.y = Plant.FLOOR * (1 - Math.max(0.001, e));
    });
    for (var name in this.pipes) {
      var p = this.pipes[name], set = p.flow.parent === this.sets.cycle ? 'cycle' : 'power';
      var on = !this.emph || this.emph.indexOf(name) >= 0;
      var u = p.mat.uniforms;
      u.uTime.value = time;
      u.uIntensity.value += ((on ? 1 : 0.12) * this.level[set] - u.uIntensity.value) * Math.min(1, raw * 4);
    }
    for (var i = 0; i < this.spin.length; i++) this.spin[i].rotation.y += dt * 5.5 * this.level.power;
    var vu = this.vapourMat.uniforms;
    vu.uTime.value = time; vu.uPx.value = px; vu.uIntensity.value = this.level.power;
  };

  FL.Plant = Plant;
})();
