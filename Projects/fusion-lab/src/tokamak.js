/* Fusion Lab — procedural ITER-class tokamak.
 *
 * Built from published overall dimensions (major radius 6.2 m, minor radius
 * 2.0 m, 18 TF coils, 6 PF coils, 6 CS modules, 54 divertor cassettes, a
 * ~29 m cryostat). Cross-sections are simplified teaching shapes, not CAD.
 * Every toroidal layer is cut into 18 sectors of 20° so the cutaway can peel
 * the machine like an onion and the exploded view can pull sectors apart.
 */
(function () {
  'use strict';
  var FL = globalThis.FL = globalThis.FL || {};
  var THREE = globalThis.THREE;
  var geo = FL.geo, core = FL.core;
  var DEG = Math.PI / 180, SECTORS = 18, STEP = 20 * DEG;
  var CUT_CENTER = 90;                                   // degrees; the cutaway faces +Z

  var SHAPE = { R0: 6.2, a: 2.0, kappa: 1.75, delta: 0.36, Z0: 0.45 };
  var BOWL_R = 5.55;

  function smooth(x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); }

  /* A wall contour point: the plasma boundary pushed out by d along its
   * normal, with the bottom stretched down and widened to make the divertor
   * pocket. extra(theta) adds poloidally varying thickness. */
  function wall(theta, d, bulge, widen) {
    var p = core.miller(SHAPE, 1, theta), q = core.miller(SHAPE, 1, theta + 1e-3);
    var tx = q.R - p.R, tz = q.Z - p.Z, tl = Math.hypot(tx, tz);
    var R = p.R + tz / tl * d, Z = p.Z - tx / tl * d;
    var s = smooth((-0.9 - p.Z) / 2.1);
    return [R + (R - BOWL_R) * widen * s, Z - bulge * s];
  }
  function contour(d, bulge, widen, n) {
    return geo.sampleClosed(function (th) { return wall(th, typeof d === 'function' ? d(th) : d, bulge, widen); }, n || 72);
  }

  /* D-shaped TF coil centreline: straight inboard leg, two Bézier arcs. */
  function tfCentreline() {
    var top = geo.bezier([2.63, 4.6], [2.63, 7.0], [4.2, 7.6], [6.0, 7.6], 12)
      .concat(geo.bezier([6.0, 7.6], [8.9, 7.6], [10.85, 4.6], [10.85, 0], 16, true));
    var pts = [], i;
    for (i = top.length - 1; i >= 0; i--) pts.push([top[i][0], -top[i][1]]);     // bottom half, outboard -> inboard
    for (i = -3; i <= 3; i++) pts.push([2.63, i * 1.1]);                         // inboard leg, going up
    for (i = 0; i < top.length - 1; i++) pts.push(top[i]);                       // top half, inboard -> outboard
    /* drop duplicate joints */
    return pts.filter(function (p, k) { var q = pts[(k + 1) % pts.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05; });
  }

  function std(color, rough, metal, extra) {
    var m = new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: rough, metalness: metal, envMapIntensity: 1.0 }, extra || {}));
    m.userData.baseOpacity = m.opacity;
    return m;
  }

  function Tokamak(engine) {
    var self = this;
    this.engine = engine;
    this.group = new THREE.Group();
    this.group.name = 'tokamak';
    this.layers = {};
    this.order = [];
    this.explode = 0; this.explodeGoal = 0;
    this.cut = 'onion';
    this.focusIds = null;
    this.shape = SHAPE;

    var fw = contour(0.2, 1.35, 0.3), blanketBack = contour(0.65, 1.35, 0.3);
    var vvIn0 = contour(0.72, 1.5, 0.32), vvIn1 = contour(0.8, 1.5, 0.32);
    var outer = function (base) { return function (th) { return base + 0.42 * Math.max(0, Math.cos(th)); }; };
    var vvOut0 = contour(outer(1.0), 1.78, 0.34), vvOut1 = contour(outer(1.08), 1.78, 0.34);
    this.profiles = { firstWall: fw, vesselOuter: vvOut1 };

    /* ----- layer helper ----- */
    function layer(id, meta) {
      var L = Object.assign({ id: id, group: new THREE.Group(), meshes: [], mats: [], opacity: 1, goal: 1, shown: true, hw: 0 }, meta);
      L.group.name = id;
      self.group.add(L.group);
      self.layers[id] = L; self.order.push(id);
      return L;
    }
    function addMesh(L, geometry, mats, info) {
      var list = Array.isArray(mats) ? [mats[0], mats[1], mats[1]] : mats;
      var mesh = new THREE.Mesh(geometry, list);
      mesh.userData = Object.assign({ part: L.pick || L.id, dir: new THREE.Vector3(), dist: L.dist || 0, cap: Array.isArray(mats) ? mats[1] : null }, info || {});
      L.group.add(mesh); L.meshes.push(mesh);
      (Array.isArray(mats) ? mats : [mats]).forEach(function (m) { if (L.mats.indexOf(m) < 0) L.mats.push(m); });
      engine.pickables.push(mesh);
      return mesh;
    }
    function sectors(L, mats, build) {
      for (var k = 0; k < SECTORS; k++) {
        var b = new geo.Builder(), p0 = k * STEP, p1 = (k + 1) * STEP, mid = (k + 0.5) * STEP;
        build(b, p0, p1, k, mid);
        addMesh(L, b.build(), mats, {
          centre: (k + 0.5) * 20, sector: k, dir: new THREE.Vector3(Math.cos(mid), L.lift || 0, Math.sin(mid)).normalize()
        });
      }
    }

    /* ----- central solenoid: six stacked modules ----- */
    var cs = layer('cs', { dist: 19 });
    var csMat = [std(0xb9764a, 0.36, 0.92), std(0xe2a274, 0.5, 0.6)];
    for (var m = 0; m < 6; m++) {
      var z0 = -6.21 + m * 2.07, b = new geo.Builder();
      b.sweep([[1.32, z0 + 0.04], [2.05, z0 + 0.04], [2.05, z0 + 2.03], [1.32, z0 + 2.03]], null, 0, geo.TAU, 72);
      addMesh(cs, b.build(), csMat, { dir: new THREE.Vector3(0, 1, 0), module: m });
    }
    var tie = new geo.Builder();
    tie.sweep([[1.1, 6.25], [2.2, 6.25], [2.2, 6.6], [1.1, 6.6]], null, 0, geo.TAU, 48);
    tie.sweep([[1.1, -6.6], [2.2, -6.6], [2.2, -6.25], [1.1, -6.25]], null, 0, geo.TAU, 48);
    tie.sweep([[1.12, -6.3], [1.26, -6.3], [1.26, 6.3], [1.12, 6.3]], null, 0, geo.TAU, 48);
    addMesh(cs, tie.build(), [std(0x8a94a2, 0.45, 0.85), std(0xc9d0d8, 0.5, 0.6)], { dir: new THREE.Vector3(0, 1, 0) });

    /* ----- toroidal field coils ----- */
    var tf = layer('tf', { dist: 11, hw: 80 });
    var centre = tfCentreline();
    var tfOuter = geo.offset(centre, 0.45), tfInner = geo.offset(centre, -0.45);
    var tfPackOuter = geo.offset(centre, 0.3), tfPackInner = geo.offset(centre, -0.3);
    this.profiles.tfOuter = tfOuter; this.profiles.tfInner = tfInner;
    var tfMat = [std(0x8793a6, 0.4, 0.88), std(0x8793a6, 0.4, 0.88)];
    var tfPackMat = std(0xc98a55, 0.42, 0.85);
    for (var k = 0; k < SECTORS; k++) {
      var phi = k * STEP, tb = new geo.Builder();
      tb.slab(tfOuter, [tfInner], phi, 0.42);
      var coil = addMesh(tf, tb.build(), tfMat, { centre: k * 20, dir: new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi)), coil: k });
      /* the winding pack shows as a raised copper inlay on both faces */
      var pb = new geo.Builder();
      pb.slab(tfPackOuter, [tfPackInner], phi, 0.435);
      var pack = new THREE.Mesh(pb.build(), tfPackMat);
      pack.userData = { part: 'tf' };
      coil.add(pack);
      if (tf.mats.indexOf(tfPackMat) < 0) tf.mats.push(tfPackMat);
    }

    /* ----- poloidal field coils, placed just outside the TF outline ----- */
    var pf = layer('pf', { dist: 0, hw: 90 });
    var pfMat = [std(0xc59350, 0.38, 0.9), std(0xf0c88c, 0.5, 0.55)];
    var above = function (R, w, sign) {
      var best = 0;
      tfOuter.forEach(function (p) { if (Math.abs(p[0] - R) < w / 2 + 0.25 && p[1] * sign > best) best = p[1] * sign; });
      return best;
    };
    var beside = function (Z, h) {
      var best = 0;
      tfOuter.forEach(function (p) { if (Math.abs(p[1] - Z) < h / 2 + 0.25 && p[0] > best) best = p[0]; });
      return best;
    };
    var pfSpec = [
      { name: 'PF1', w: 0.97, h: 0.98, R: 3.95, sign: 1 }, { name: 'PF2', w: 0.65, h: 0.6, R: 8.3, sign: 1 },
      { name: 'PF3', w: 0.7, h: 0.95, Z: 3.25 }, { name: 'PF4', w: 0.65, h: 0.95, Z: -2.45 },
      { name: 'PF5', w: 0.82, h: 0.95, R: 8.4, sign: -1 }, { name: 'PF6', w: 1.6, h: 0.98, R: 4.3, sign: -1 }
    ];
    this.pfCoils = pfSpec.map(function (c) {
      if (c.Z == null) c.Z = c.sign * (above(c.R, c.w, c.sign) + 0.2 + c.h / 2);
      else c.R = beside(c.Z, c.h) + 0.2 + c.w / 2;
      return c;
    });
    this.pfCoils.forEach(function (c, i) {
      var lift = c.Z > 0 ? 1 : -1, amount = [9, 7, 4, 4, 7, 9][i];
      for (var s = 0; s < SECTORS; s++) {
        var bb = new geo.Builder();
        bb.sweep([[c.R - c.w / 2, c.Z - c.h / 2], [c.R + c.w / 2, c.Z - c.h / 2], [c.R + c.w / 2, c.Z + c.h / 2], [c.R - c.w / 2, c.Z + c.h / 2]], null, s * STEP, (s + 1) * STEP, 4);
        addMesh(pf, bb.build(), pfMat, { centre: (s + 0.5) * 20, sector: s, dir: new THREE.Vector3(0, lift, 0), dist: amount, coil: i });
      }
    });

    /* ----- vacuum vessel: double wall, ribs, three rows of ports ----- */
    var vessel = layer('vessel', { dist: 5.2, hw: 70 });
    var vvMat = [std(0x98a2ad, 0.46, 0.85), std(0xdfe4ea, 0.6, 0.35)];
    var z0v = SHAPE.Z0;
    var eqPort = [[9.25, z0v - 1.05], [12.3, z0v - 1.05], [12.3, z0v + 1.15], [9.25, z0v + 1.15]];
    var upPort = [[7.2, 4.75], [11.6, 6.3], [11.6, 7.5], [7.2, 5.85]];
    var loPort = [[7.3, -5.55], [12.0, -5.95], [12.0, -4.75], [7.3, -4.4]];
    sectors(vessel, vvMat, function (bd, p0, p1, k, mid) {
      bd.sweep(vvIn1, [vvIn0], p0, p1, 4);
      bd.sweep(vvOut1, [vvOut0], p0, p1, 4);
      bd.slab(vvOut0, [vvIn1], mid, 0.03, { faceGroup: 0 });                // poloidal rib between the two shells
      bd.slab(vvOut0, [vvIn1], p0 + (p1 - p0) * 0.25, 0.03);
      bd.slab(vvOut0, [vvIn1], p0 + (p1 - p0) * 0.75, 0.03);
      bd.slab(eqPort, null, mid, 0.85);
      bd.slab(upPort, null, mid, 0.55);
      if (k % 2 === 0) bd.slab(loPort, null, mid, 0.6);
    });

    /* ----- blanket: 18 poloidal rows of shield modules ----- */
    var blanket = layer('blanket', { dist: 2.6, hw: 50 });
    var blMat = std(0x767e88, 0.5, 0.82, { emissive: new THREE.Color(0xff5a1e), emissiveIntensity: 0 });
    var ROWS = 18, TH0 = -0.93, TH1 = 4.06;
    this.blanketRows = [];
    sectors(blanket, blMat, function (bd, p0, p1) {
      for (var r = 0; r < ROWS; r++) {
        var a = TH0 + (TH1 - TH0) * (r + 0.03) / ROWS, e = TH0 + (TH1 - TH0) * (r + 0.97) / ROWS, mth = (a + e) / 2;
        var poly = [wall(a, 0.65, 1.35, 0.3), wall(mth, 0.65, 1.35, 0.3), wall(e, 0.65, 1.35, 0.3), wall(e, 0.2, 1.35, 0.3), wall(a, 0.2, 1.35, 0.3)];
        var outboard = Math.cos(mth) > -0.25;
        var n = outboard ? 2 : 1, gap = 0.0045;
        for (var j = 0; j < n; j++) {
          var s = p0 + (p1 - p0) * j / n + gap, t = p0 + (p1 - p0) * (j + 1) / n - gap;
          bd.sweep(poly, null, s, t, 2, { crease: 0.3, capGroup: 0 });
        }
      }
    });

    /* ----- divertor: 54 cassettes in the bottom pocket ----- */
    var divertor = layer('divertor', { dist: 2.2, hw: 50, lift: -1.4 });
    var dvMat = std(0x565c66, 0.42, 0.9);
    var bowl = [];
    for (var bi = 0; bi <= 18; bi++) bowl.push(wall(-2.26 + (1.36 * bi) / 18, 0.26, 1.35, 0.3));
    var pin = bowl[0], pout = bowl[bowl.length - 1], zb = 1e9, rc = 0;
    bowl.forEach(function (p) { if (p[1] < zb) { zb = p[1]; rc = p[0]; } });
    var top = [
      [pout[0] - 0.14, pout[1] + 0.04], [pout[0] - 0.5, zb + 0.62], [rc + 0.58, zb + 0.46], [rc + 0.3, zb + 0.92],
      [rc - 0.3, zb + 0.92], [rc - 0.58, zb + 0.46], [pin[0] + 0.5, zb + 0.62], [pin[0] + 0.14, pin[1] + 0.04]
    ];
    var cassette = bowl.concat(top);
    this.xPoint = (function () { var p = core.miller(SHAPE, 1, -Math.PI / 2 - 0.04); return [p.R, p.Z]; })();
    this.strike = {
      outer: [(top[1][0] + top[2][0]) / 2 + 0.2, (top[1][1] + top[2][1]) / 2 + 0.06],
      inner: [(top[5][0] + top[6][0]) / 2 - 0.2, (top[5][1] + top[6][1]) / 2 + 0.06]
    };
    sectors(divertor, dvMat, function (bd, p0, p1) {
      for (var j = 0; j < 3; j++) bd.sweep(cassette, null, p0 + (p1 - p0) * j / 3 + 0.004, p0 + (p1 - p0) * (j + 1) / 3 - 0.004, 2, { crease: 0.45, capGroup: 0 });
    });

    /* ----- cryostat: thin steel shell with stiffening rings ----- */
    var cryo = layer('cryostat', { dist: 0, hw: 90, baseOpacity: 0.2 });
    var cryoMat = [
      std(0x8fa3bd, 0.35, 0.9, { transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
      std(0xcfd8e4, 0.5, 0.5, { transparent: true, opacity: 0.55, depthWrite: false })
    ];
    var shellOuter = [[0, -11.6], [14.3, -11.6], [14.3, 11.0], [13.3, 12.5], [9.5, 13.25], [0, 13.5]];
    var shellInner = [[0, -11.4], [14.1, -11.4], [14.1, 10.95], [13.15, 12.32], [9.45, 13.06], [0, 13.3]];
    var shell = shellOuter.concat(shellInner.reverse());
    sectors(cryo, cryoMat, function (bd, p0, p1) {
      bd.sweep(shell, null, p0, p1, 4, { crease: 0.5, caps: false });
      [-8, -4.4, -0.8, 2.8, 6.4, 10].forEach(function (z) {
        bd.sweep([[14.3, z - 0.12], [14.62, z - 0.12], [14.62, z + 0.12], [14.3, z + 0.12]], null, p0, p1, 4, { caps: false });
      });
    });
    this.cryoMats = cryoMat;

    this.setCut('onion', true);
  }

  var CUTS = {
    closed: { scale: 0 },
    onion: { scale: 1 },
    wide: { scale: 1, override: { blanket: 70, divertor: 70, vessel: 90, tf: 100, pf: 110, cryostat: 110 } },
    half: { scale: 1, override: { blanket: 90, divertor: 90, vessel: 90, tf: 95, pf: 90, cryostat: 90 } }
  };
  Tokamak.prototype.setCut = function (name) {
    var spec = CUTS[name] || CUTS.onion, self = this;
    this.cut = name;
    this.order.forEach(function (id) {
      var L = self.layers[id];
      var hw = (spec.override && spec.override[id] != null ? spec.override[id] : L.hw) * spec.scale;
      L.meshes.forEach(function (ms) {
        if (ms.userData.centre == null) return;
        var d = Math.abs(((ms.userData.centre - CUT_CENTER + 540) % 360) - 180);
        ms.userData.cutAway = d < hw - 0.01;
        ms.visible = !ms.userData.cutAway;
      });
    });
    this._caps(true);
  };
  /* Section faces exist on both ends of every sector; draw one only where the
   * neighbouring sector is cut away (or everywhere once the machine is exploded). */
  var HIDDEN = new THREE.MeshBasicMaterial({ visible: false });
  Tokamak.prototype._caps = function (force) {
    var open = this.explode > 0.02, self = this;
    if (!force && open === this._capsOpen) return;
    this._capsOpen = open;
    this.order.forEach(function (id) {
      var L = self.layers[id], cutAt = {};
      L.meshes.forEach(function (ms) { if (ms.userData.sector != null && ms.userData.cutAway) cutAt[ms.userData.sector] = true; });
      L.meshes.forEach(function (ms) {
        var u = ms.userData;
        if (u.sector == null || !u.cap || !Array.isArray(ms.material)) return;
        var radial = Math.abs(u.dir.y) < 0.5 && u.dist > 0;       // sectors that separate when exploded
        ms.material[1] = (open && radial) || cutAt[(u.sector + 17) % 18] ? u.cap : HIDDEN;
        ms.material[2] = (open && radial) || cutAt[(u.sector + 1) % 18] ? u.cap : HIDDEN;
      });
    });
  };
  /* show: array of layer ids that should be visible; focus: ids to keep solid
   * while the rest turn to ghosts (null = everything solid). */
  Tokamak.prototype.setLayers = function (show, focus) {
    var self = this;
    this.focusIds = focus && focus.length ? focus : null;
    this.order.forEach(function (id) {
      var L = self.layers[id];
      L.shown = !show || show.indexOf(id) >= 0;
      L.goal = !L.shown ? 0 : (self.focusIds && self.focusIds.indexOf(id) < 0 ? 0.07 : 1);
      L.focus = !!(self.focusIds && self.focusIds.indexOf(id) >= 0);
    });
  };
  Tokamak.prototype.setExplode = function (k) { this.explodeGoal = Math.min(1, Math.max(0, k)); };

  Tokamak.prototype.update = function (time, dt, raw) {
    var self = this, rate = Math.min(1, raw * 5.5);
    this.explode += (this.explodeGoal - this.explode) * Math.min(1, raw * 4);
    if (Math.abs(this.explodeGoal - this.explode) < 1e-4) this.explode = this.explodeGoal;
    var ex = this.explode;
    this._caps(false);
    this.order.forEach(function (id) {
      var L = self.layers[id];
      L.opacity += (L.goal - L.opacity) * rate;
      if (Math.abs(L.goal - L.opacity) < 0.004) L.opacity = L.goal;
      /* the cryostat steps aside when the machine is pulled apart */
      var fade = id === 'cryostat' ? Math.max(0, 1 - ex * 3) : 1;
      var o = L.opacity * fade;
      L.group.visible = o > 0.012;
      L.mats.forEach(function (mat) {
        var base = mat.userData.baseOpacity == null ? 1 : mat.userData.baseOpacity;
        var solid = base >= 1 && o > 0.985;
        mat.opacity = base * o;
        if (mat.transparent === solid) { mat.transparent = !solid; mat.needsUpdate = true; }
        mat.depthWrite = base >= 1 && o > 0.5;
        if (mat.emissive && id !== 'blanket') {
          var glow = L.focus ? 0.1 + 0.05 * Math.sin(time * 2.2) : 0;
          /* amber = current flowing in this coil set (illustrative, not to scale) */
          var amp = (self.glow && self.glow[id]) || 0;
          mat.emissive.setRGB(glow * 0.5 + amp * 0.85, glow * 0.75 + amp * 0.42, glow + amp * 0.08);
        }
      });
      L.meshes.forEach(function (ms) {
        ms.userData.ghost = o < 0.3;
        var d = ms.userData.dist * ex;
        ms.position.copy(ms.userData.dir).multiplyScalar(d);
      });
    });
  };
  /* A point on the machine in (R, Z, φ°) that follows the exploded position of
   * the given layer's sector, for labels. */
  Tokamak.prototype.anchor = function (id, R, Z, phiDeg) {
    var L = this.layers[id], phi = phiDeg * DEG;
    var base = new THREE.Vector3(R * Math.cos(phi), Z, R * Math.sin(phi)), out = new THREE.Vector3();
    var ref = null, best = 1e9;
    if (L) L.meshes.forEach(function (ms) {
      var c = ms.userData.centre, d = c == null ? 0 : Math.abs(((c - phiDeg + 540) % 360) - 180);
      if (ms.userData.coil != null && id === 'pf') d += Math.abs(ms.geometry.boundingSphere.center.y - Z) * 40;
      if (ms.userData.module != null) d = Math.abs(ms.geometry.boundingSphere.center.y - Z);
      if (d < best) { best = d; ref = ms; }
    });
    return function () {
      if (L && (!L.shown || L.opacity < 0.05)) return null;
      out.copy(base);
      if (ref) out.add(ref.position);
      return out;
    };
  };

  Tokamak.SHAPE = SHAPE;
  Tokamak.wall = wall;
  FL.Tokamak = Tokamak;
})();
