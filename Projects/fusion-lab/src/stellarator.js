/* Fusion Lab — a schematic stellarator (scene b6).
 *
 * Nested "rotating ellipse" flux surfaces, field lines with a chosen
 * rotational transform, 50 non-planar and 20 planar coils in five modules.
 * The counts follow Wendelstein 7-X; the shapes do not. The surface is the
 * textbook cartoon from core.js, the coils are closed loops on an offset
 * surface with a hand-picked toroidal wobble, and the minor radius is drawn
 * about 1.7× too large so the twist stays readable. Nothing here is a
 * computed equilibrium or a real coil set.
 */
(function () {
  'use strict';
  var FL = globalThis.FL = globalThis.FL || {};
  var THREE = globalThis.THREE;
  var geo = FL.geo, core = FL.core, fx = FL.fx;
  var TAU = Math.PI * 2, DEG = Math.PI / 180;

  var SHAPE = { R0: 5.5, a: 0.9, elong: 1.45, N: 5, axis: 0.28 };
  var GAP = 0.55;                     // plasma edge to coil centreline, m
  var CUT = [26, 154];                // toroidal sector (deg) opened towards the default camera
  var IOTA = 0.9;

  /* coil winding surface: the plasma ellipse pushed out by GAP on both semi-axes */
  var LONG = SHAPE.a * SHAPE.elong + GAP, SHORT = SHAPE.a / SHAPE.elong + GAP;
  var COIL_SHAPE = { R0: SHAPE.R0, a: Math.sqrt(LONG * SHORT), elong: Math.sqrt(LONG / SHORT), N: SHAPE.N, axis: SHAPE.axis };

  function at(shape, rho, th, ph) {
    var p = core.stellaratorSurface(shape, rho, th, ph);
    return new THREE.Vector3(p.R * Math.cos(ph), p.Z, p.R * Math.sin(ph));
  }
  function inCut(deg) { return deg > CUT[0] && deg < CUT[1]; }

  function Stellarator(engine) {
    var self = this;
    this.engine = engine;
    this.shape = SHAPE;
    this.group = new THREE.Group(); this.group.name = 'stellarator'; this.group.visible = false;
    this.iota = IOTA; this.iotaBuilt = null; this.coilMode = 'cut';
    this.flows = [];

    /* ----- nested flux surfaces ----- */
    var vert = 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }';
    var frag = [
      'uniform float uTime; uniform float uIntensity; uniform float uRim; uniform float uFill; uniform float uPow; uniform vec3 uEdge; uniform vec3 uCore;',
      'varying vec2 vUv; varying vec3 vN; varying vec3 vV;',
      'void main(){',
      '  float n = abs(dot(normalize(vN), normalize(vV)));',
      '  float rim = pow(1.0 - n, uPow);',
      /* even poloidal mode numbers: the mesh seam is half a poloidal turn out of step */
      '  float a = 6.28318 * (vUv.y * 12.0 + vUv.x * 20.0);',
      '  float b = 6.28318 * (vUv.y * 8.0 + vUv.x * 15.0);',
      '  float fil = 0.5 + 0.28 * sin(a + uTime * 1.7) + 0.22 * sin(b - uTime * 1.1 + 1.3);',
      '  vec3 col = mix(uCore, uEdge, clamp(rim * 1.25, 0.0, 1.0));',
      '  gl_FragColor = vec4(col * (uFill + uRim * rim) * (0.72 + 0.56 * fil) * uIntensity, 1.0); }'
    ].join('\n');
    this.shells = [
      { rho: 1.0, rim: 0.85, fill: 0.03, pow: 2.4, edge: 0xff4fd0, core: 0xb060ff, gain: 0.5 },
      { rho: 0.68, rim: 0.34, fill: 0.03, pow: 2.0, edge: 0xc070ff, core: 0x8f9bff, gain: 0.3 },
      { rho: 0.36, rim: 0.2, fill: 0.07, pow: 1.5, edge: 0xa9b8ff, core: 0xf2f6ff, gain: 0.22 }
    ].map(function (s, i) {
      var SP = 300, ST = 56, pos = [], nor = [], uv = [], idx = [];
      for (var a = 0; a <= SP; a++) for (var b = 0; b <= ST; b++) {
        var ph = TAU * a / SP, th = TAU * b / ST;
        var p = at(SHAPE, s.rho, th, ph), p2 = at(SHAPE, s.rho, th + 0.01, ph), p3 = at(SHAPE, s.rho, th, ph + 0.004);
        var n = p2.sub(p).cross(p3.sub(p)).normalize();
        pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(a / SP, b / ST);
        if (a < SP && b < ST) { var o = a * (ST + 1) + b, o2 = o + ST + 1; idx.push(o, o2, o + 1, o2, o2 + 1, o + 1); }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      var mat = fx.additive({
        uTime: { value: 0 }, uIntensity: { value: s.gain }, uRim: { value: s.rim }, uFill: { value: s.fill }, uPow: { value: s.pow },
        uEdge: { value: new THREE.Color(s.edge) }, uCore: { value: new THREE.Color(s.core) }
      }, vert, frag, { side: THREE.DoubleSide });
      var mesh = new THREE.Mesh(g, mat);
      mesh.renderOrder = 10 + i; mesh.frustumCulled = false;
      self.group.add(mesh);
      return mat;
    });

    /* the helical magnetic axis, faint, so the eye can follow the excursion */
    var axisPts = [];
    for (var k = 0; k < 400; k++) axisPts.push(at(SHAPE, 0, 0, TAU * k / 400));
    var axisMesh = new THREE.Mesh(geo.tube(axisPts, 0.03, 5, true), new THREE.MeshBasicMaterial({ color: fx.hdr(0xcfd8ff, 0.9), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    axisMesh.renderOrder = 13; this.group.add(axisMesh);

    /* ----- field lines (rebuilt when ι changes) ----- */
    this.fieldMat = fx.flowMaterial(fx.hdr(0x58d8ff, 1.5), { dashes: 14, speed: 0.55, base: 0.3, intensity: 1 });
    this.fieldMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.fieldMat);
    this.fieldMesh.renderOrder = 14; this.fieldMesh.frustumCulled = false;
    this.group.add(this.fieldMesh); this.flows.push(this.fieldMat);

    /* ----- coils ----- */
    var copper = new THREE.MeshStandardMaterial({ color: 0xc98a4b, roughness: 0.38, metalness: 0.9, envMapIntensity: 1.0 });
    var steel = new THREE.MeshStandardMaterial({ color: 0x7f93b4, roughness: 0.45, metalness: 0.85, envMapIntensity: 1.0 });
    var sets = { npFront: [], npBack: [], plFront: [], plBack: [] };
    var NP = 50, PL = 20, j, deg;
    for (k = 0; k < NP; k++) {
      var ph0 = TAU * (k + 0.5) / NP, loop = [];
      for (j = 0; j < 96; j++) {
        var th = TAU * j / 96;
        /* the toroidal wobble that makes the coil non-planar; its phase follows the field period */
        var w = 0.05 * Math.sin(th + SHAPE.N * ph0) + 0.022 * Math.sin(2 * th - SHAPE.N * ph0);
        loop.push(at(COIL_SHAPE, 1, th, ph0 + w));
      }
      deg = ph0 / DEG;
      sets[inCut(deg) ? 'npFront' : 'npBack'].push(geo.tube(loop, 0.105, 8, true));
    }
    for (k = 0; k < PL; k++) {
      var php = TAU * (k + 0.5) / PL, c = core.stellaratorAxis(SHAPE, php), tilt = (k % 2 ? -1 : 1) * 16 * DEG, ring = [];
      var eR = new THREE.Vector3(Math.cos(php), 0, Math.sin(php)), eP = new THREE.Vector3(-Math.sin(php), 0, Math.cos(php));
      var eT = eR.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(eP, Math.sin(tilt));
      var centre = eR.clone().multiplyScalar(c.R + 0.15); centre.y = c.Z;
      for (j = 0; j < 80; j++) {
        var t = TAU * j / 80;
        ring.push(centre.clone().addScaledVector(eT, 2.55 * Math.cos(t)).add(new THREE.Vector3(0, 2.45 * Math.sin(t), 0)));
      }
      deg = php / DEG;
      sets[inCut(deg) ? 'plFront' : 'plBack'].push(geo.tube(ring, 0.085, 8, true));
    }
    this.coils = {};
    Object.keys(sets).forEach(function (name) {
      var mesh = new THREE.Mesh(fx.mergeIndexed(sets[name]), name[0] === 'n' ? copper : steel);
      mesh.frustumCulled = false;
      self.group.add(mesh); self.coils[name] = mesh;
    });

    /* ----- label anchors ----- */
    var topOf = function (deg, r) { var o = core.stellaratorAxis(SHAPE, deg * DEG); return new THREE.Vector3(o.R * Math.cos(deg * DEG), o.Z + r, o.R * Math.sin(deg * DEG)); };
    var npAt = at(COIL_SHAPE, 1, 80 * DEG, TAU * 22.5 / NP), plAt = topOf(9, 2.45);
    var whenCoils = function (p) { return function () { return self.coilMode === 'none' ? null : p; }; };
    this.anchors = {
      nonplanar: whenCoils(npAt),          // coil labels vanish with the coils
      planar: whenCoils(plAt),
      surface: at(SHAPE, 1, 20 * DEG, 100 * DEG),
      line: at(SHAPE, 1.03, 200 * DEG, 62 * DEG),
      axis: at(SHAPE, 0, 0, 90 * DEG)
    };

    this.setCoils('cut');
    this.rebuildField();
  }

  Stellarator.prototype.rebuildField = function () {
    var key = this.iota.toFixed(3);
    if (this.iotaBuilt === key) return;
    this.iotaBuilt = key;
    var iota = this.iota, tubes = [];
    [{ rho: 1.03, n: 8, r: 0.028 }, { rho: 0.55, n: 4, r: 0.022 }].forEach(function (s) {
      for (var i = 0; i < s.n; i++) {
        var pts = [], th0 = TAU * i / s.n, STEPS = 420;
        for (var k = 0; k <= STEPS; k++) {
          var ph = TAU * k / STEPS;
          pts.push(at(SHAPE, s.rho, core.stellaratorFieldAngle(SHAPE, iota, th0, ph), ph));
        }
        tubes.push(geo.tube(pts, s.r, 5, false));
      }
    });
    this.fieldMesh.geometry.dispose();
    this.fieldMesh.geometry = fx.mergeIndexed(tubes);
  };
  Stellarator.prototype.setIota = function (iota) { this.iota = iota; this.rebuildField(); };
  /* mode: 'cut' (front sector open) | 'all' | 'none' */
  Stellarator.prototype.setCoils = function (mode) {
    this.coilMode = mode;
    var C = this.coils;
    C.npBack.visible = C.plBack.visible = mode !== 'none';
    C.npFront.visible = C.plFront.visible = mode === 'all';
  };
  Stellarator.prototype.configure = function (o) {
    o = o || {};
    this.setCoils(o.coils || 'cut');
    this.setIota(o.iota || IOTA);
  };
  Stellarator.prototype.update = function (time) {
    if (!this.group.visible) return;
    for (var i = 0; i < this.shells.length; i++) this.shells[i].uniforms.uTime.value = time;
    for (i = 0; i < this.flows.length; i++) this.flows[i].uniforms.uTime.value = time;
  };

  FL.Stellarator = Stellarator;
  FL.stellarator = { SHAPE: SHAPE, IOTA: IOTA, DRAWN_MINOR_SCALE: SHAPE.a / 0.53 };
})();
