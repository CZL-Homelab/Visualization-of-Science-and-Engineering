/* Fusion Lab — everything that glows or moves inside the machine.
 *
 * Plasma shells, magnetic field lines, guiding-centre particles, fusion
 * neutrons, heating beams, pellets and divertor strike lines. All of it is
 * choreographed illustration: brightness and speed are chosen for legibility
 * and do not encode measured quantities (gyro-radii are drawn ~20× too big,
 * particles ~10⁷× too slow).
 */
(function () {
  'use strict';
  var FL = globalThis.FL = globalThis.FL || {};
  var THREE = globalThis.THREE;
  var geo = FL.geo, core = FL.core;
  var TAU = Math.PI * 2, DEG = Math.PI / 180;

  var TORUS_GLSL = [
    'uniform float uR0; uniform float uA; uniform float uKappa; uniform float uDelta; uniform float uZ0;',
    'vec3 torusPos(float rho, float th, float ph){',
    '  float r = uA * rho; float R = uR0 + r * cos(th + uDelta * rho * sin(th));',
    '  return vec3(R * cos(ph), uZ0 + uKappa * r * sin(th), R * sin(ph)); }'
  ].join('\n');

  function shapeUniforms(shape) {
    return { uR0: { value: shape.R0 }, uA: { value: shape.a }, uKappa: { value: shape.kappa }, uDelta: { value: shape.delta }, uZ0: { value: shape.Z0 } };
  }
  function pos3(shape, rho, th, ph) {
    var p = core.miller(shape, rho, th);
    return new THREE.Vector3(p.R * Math.cos(ph), p.Z, p.R * Math.sin(ph));
  }
  function hdr(hex, k) { return new THREE.Color(hex).multiplyScalar(k); }

  function additive(uniforms, vert, frag, extra) {
    return new THREE.ShaderMaterial(Object.assign({
      uniforms: uniforms, vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }, extra || {}));
  }

  /* dashes that travel along uv.x; shared by field lines, pipes and beams */
  var FLOW_VERT = 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }';
  var FLOW_FRAG = [
    'uniform vec3 uColor; uniform float uTime; uniform float uDashes; uniform float uSpeed; uniform float uIntensity; uniform float uBase; uniform float uFadeEnds;',
    'varying vec2 vUv; varying vec3 vN; varying vec3 vV;',
    'void main(){',
    '  float f = fract(vUv.x * uDashes - uTime * uSpeed);',
    '  float dash = smoothstep(0.0, 0.12, f) * smoothstep(0.62, 0.3, f);',
    '  float ends = mix(1.0, smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.86, vUv.x), uFadeEnds);',
    '  float facing = 0.55 + 0.45 * abs(dot(normalize(vN), normalize(vV)));',
    '  gl_FragColor = vec4(uColor * (uBase + dash) * uIntensity * ends * facing, 1.0); }'
  ].join('\n');
  function flowMaterial(color, opts) {
    opts = opts || {};
    return additive({
      uColor: { value: color.isColor ? color : new THREE.Color(color) }, uTime: { value: 0 }, uDashes: { value: opts.dashes || 10 },
      uSpeed: { value: opts.speed == null ? 0.5 : opts.speed }, uIntensity: { value: opts.intensity == null ? 1 : opts.intensity },
      uBase: { value: opts.base == null ? 0.22 : opts.base }, uFadeEnds: { value: opts.fadeEnds ? 1 : 0 }
    }, FLOW_VERT, FLOW_FRAG, opts.material);
  }
  function mergeIndexed(list) {
    var np = 0, ni = 0;
    list.forEach(function (g) { np += g.attributes.position.count; ni += g.index.count; });
    var pos = new Float32Array(np * 3), nor = new Float32Array(np * 3), uv = new Float32Array(np * 2), idx = new Uint32Array(ni), po = 0, io = 0;
    list.forEach(function (g) {
      pos.set(g.attributes.position.array, po * 3); nor.set(g.attributes.normal.array, po * 3); uv.set(g.attributes.uv.array, po * 2);
      var a = g.index.array;
      for (var i = 0; i < a.length; i++) idx[io + i] = a[i] + po;
      po += g.attributes.position.count; io += a.length; g.dispose();
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }

  function Effects(engine, tokamak) {
    var self = this, shape = tokamak.shape;
    this.engine = engine; this.tokamak = tokamak; this.shape = shape;
    this.group = new THREE.Group(); this.group.name = 'effects';
    /* current value and goal for every channel; update() eases one to the other */
    this.v = {}; this.goal = {};
    ['plasma', 'heat', 'field', 'poloidal', 'current', 'particles', 'drift', 'alphas', 'neutrons', 'nbi', 'ec', 'ic', 'pellets', 'strike',
      'blanketHeat', 'csGlow', 'tfGlow', 'pfGlow', 'flicker'].forEach(function (k) { self.v[k] = 0; self.goal[k] = 0; });
    this.q = 3; this.qBuilt = null; this.toroidalOnly = false;
    this.flows = [];

    /* ----- plasma: three nested flux surfaces ----- */
    var plasmaVert = 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }';
    var plasmaFrag = [
      'uniform float uTime; uniform float uIntensity; uniform float uRim; uniform float uFill; uniform float uPow; uniform float uFlicker;',
      'uniform vec3 uEdge; uniform vec3 uCore; uniform float uQ;',
      'varying vec2 vUv; varying vec3 vN; varying vec3 vV;',
      'void main(){',
      '  float n = abs(dot(normalize(vN), normalize(vV)));',
      '  float rim = pow(1.0 - n, uPow);',
      /* filaments follow the field: constant m·θ − n·φ with m/n = q */
      '  float a = 6.28318 * (vUv.y * 12.0 - vUv.x * 4.0);',
      '  float b = 6.28318 * (vUv.y * 9.0 - vUv.x * 3.0);',
      '  float fil = 0.5 + 0.28 * sin(a + uTime * 1.7) + 0.22 * sin(b - uTime * 1.1 + 1.3);',
      '  float breathe = 1.0 + uFlicker * 0.22 * sin(uTime * 9.0 + vUv.x * 40.0) * sin(uTime * 5.3);',
      '  vec3 col = mix(uCore, uEdge, clamp(rim * 1.25, 0.0, 1.0));',
      '  float g = (uFill + uRim * rim) * (0.72 + 0.56 * fil) * breathe;',
      '  gl_FragColor = vec4(col * g * uIntensity, 1.0); }'
    ].join('\n');
    this.shells = [
      { rho: 1.0, rim: 0.85, fill: 0.02, pow: 2.6, edge: 0xff4fd0, core: 0xb060ff },
      { rho: 0.74, rim: 0.34, fill: 0.03, pow: 2.0, edge: 0xc070ff, core: 0x8f9bff },
      { rho: 0.45, rim: 0.16, fill: 0.07, pow: 1.5, edge: 0xa9b8ff, core: 0xf2f6ff }
    ].map(function (s, i) {
      var SP = 180, ST = 64, pos = [], nor = [], uv = [], idx = [];
      for (var a = 0; a <= SP; a++) for (var b = 0; b <= ST; b++) {
        var ph = TAU * a / SP, th = TAU * b / ST;
        var p = pos3(shape, s.rho, th, ph), p2 = pos3(shape, s.rho, th + 0.01, ph), p3 = pos3(shape, s.rho, th, ph + 0.01);
        var n = p2.sub(p).cross(p3.sub(p)).normalize();
        pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(a / SP, b / ST);
        if (a < SP && b < ST) { var o = a * (ST + 1) + b, o2 = o + ST + 1; idx.push(o, o2, o + 1, o2, o2 + 1, o + 1); }
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      var mat = additive({
        uTime: { value: 0 }, uIntensity: { value: 0 }, uRim: { value: s.rim }, uFill: { value: s.fill }, uPow: { value: s.pow },
        uFlicker: { value: 0 }, uEdge: { value: new THREE.Color(s.edge) }, uCore: { value: new THREE.Color(s.core) }, uQ: { value: 3 }
      }, plasmaVert, plasmaFrag, { side: THREE.DoubleSide });
      var mesh = new THREE.Mesh(g, mat);
      mesh.renderOrder = 10 + i; mesh.frustumCulled = false;
      self.group.add(mesh);
      return { mesh: mesh, mat: mat, spec: s };
    });

    /* ----- divertor legs and strike lines ----- */
    var xp = tokamak.xPoint, so = tokamak.strike.outer, si = tokamak.strike.inner;
    var legs = new geo.Builder();
    var sheet = function (a, b, w) {
      var dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = -dz / l * w, nz = dx / l * w;
      legs.sweep([[a[0] - nx, a[1] - nz], [b[0] - nx * 0.4, b[1] - nz * 0.4], [b[0] + nx * 0.4, b[1] + nz * 0.4], [a[0] + nx, a[1] + nz]], null, 0, TAU, 120);
    };
    sheet([xp[0] + 0.05, xp[1] - 0.05], so, 0.05); sheet([xp[0] - 0.05, xp[1] - 0.05], si, 0.05);
    this.legMat = new THREE.MeshBasicMaterial({ color: hdr(0xff66cc, 1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    var legMesh = new THREE.Mesh(legs.build(), this.legMat);
    legMesh.geometry.clearGroups(); legMesh.renderOrder = 9;
    this.group.add(legMesh);
    var strikes = new geo.Builder();
    [so, si].forEach(function (p) { strikes.sweep([[p[0] - 0.13, p[1] - 0.09], [p[0] + 0.13, p[1] - 0.09], [p[0] + 0.13, p[1] + 0.1], [p[0] - 0.13, p[1] + 0.1]], null, 0, TAU, 120); });
    this.strikeMat = new THREE.MeshBasicMaterial({ color: hdr(0xff8a3c, 3.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    var strikeMesh = new THREE.Mesh(strikes.build(), this.strikeMat);
    strikeMesh.geometry.clearGroups(); strikeMesh.renderOrder = 9;
    this.group.add(strikeMesh);

    /* ----- magnetic field lines (rebuilt when q changes) ----- */
    this.fieldMat = flowMaterial(hdr(0x58d8ff, 1.5), { dashes: 14, speed: 0.55, base: 0.3, intensity: 0 });
    this.fieldMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.fieldMat);
    this.fieldMesh.renderOrder = 14; this.fieldMesh.frustumCulled = false;
    this.group.add(this.fieldMesh);
    this.flows.push(this.fieldMat);

    /* poloidal loops (the field made by the plasma current) on the cut faces */
    var loops = [];
    [38, 142, 215, 270, 325].forEach(function (deg) {
      var pts = [];
      for (var i = 0; i < 72; i++) pts.push(pos3(shape, 1.07, TAU * i / 72, deg * DEG));
      loops.push(geo.tube(pts, 0.035, 5, true));
    });
    this.polMat = flowMaterial(hdr(0xffb347, 1.6), { dashes: 9, speed: 0.7, base: 0.28, intensity: 0 });
    var pol = new THREE.Mesh(mergeIndexed(loops), this.polMat);
    pol.renderOrder = 14; this.group.add(pol); this.flows.push(this.polMat);

    /* plasma current: a ring along the magnetic axis */
    var axis = [];
    for (var ai = 0; ai < 200; ai++) axis.push(pos3(shape, 0, 0, -TAU * ai / 200));
    this.currentMat = flowMaterial(hdr(0xffd27a, 2.2), { dashes: 22, speed: 1.1, base: 0.35, intensity: 0 });
    var cur = new THREE.Mesh(geo.tube(axis, 0.075, 6, true), this.currentMat);
    cur.renderOrder = 15; this.group.add(cur); this.flows.push(this.currentMat);

    /* ----- guiding-centre particles ----- */
    var N = 1100, seed = new Float32Array(N * 4), kind = new Float32Array(N), dummy = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      var k = i < 380 ? 0 : i < 760 ? 1 : i < 980 ? 2 : 3;
      seed[i * 4] = k === 3 ? 0.15 + 0.5 * Math.random() : 0.12 + 0.86 * Math.sqrt(Math.random());
      seed[i * 4 + 1] = Math.random() * TAU; seed[i * 4 + 2] = Math.random() * TAU; seed[i * 4 + 3] = 0.55 + 0.9 * Math.random();
      kind[i] = k;
    }
    var pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(dummy, 3));
    pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    pg.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    this.partMat = additive(Object.assign({
      uTime: { value: 0 }, uQ: { value: 3 }, uIntensity: { value: 0 }, uAlpha: { value: 0 }, uDrift: { value: 0 }, uGyro: { value: 1 }, uPx: { value: 600 }
    }, shapeUniforms(shape)), [
      'attribute vec4 aSeed; attribute float aKind; uniform float uTime; uniform float uQ; uniform float uDrift; uniform float uGyro; uniform float uPx; uniform float uAlpha; uniform float uIntensity;',
      TORUS_GLSL,
      'varying vec3 vCol; varying float vA;',
      'void main(){',
      '  float e = step(1.5, aKind) * step(aKind, 2.5); float al = step(2.5, aKind);',
      '  float dir = mix(1.0, -1.0, e);',                       // electrons carry the current the other way
      '  float spd = mix(0.11, 0.42, e) + al * 0.2;',
      '  float ph = aSeed.z + uTime * spd * aSeed.w * dir;',
      '  float th = aSeed.y + ph / uQ;',
      '  vec3 p = torusPos(aSeed.x, th, ph);',
      '  vec3 eR = vec3(cos(ph), 0.0, sin(ph));',
      '  float rg = uGyro * (mix(0.11, 0.022, e) + al * 0.2);',
      '  float gy = uTime * mix(7.0, 23.0, e) * dir + aSeed.y * 31.0;',
      '  p += rg * (cos(gy) * eR + sin(gy) * vec3(0.0, 1.0, 0.0));',
      /* toroidal field alone: ions and electrons drift apart vertically, then E×B throws both outward */
      '  float life = fract(uTime * 0.055 * aSeed.w + aSeed.z * 0.159);',
      '  p.y += uDrift * dir * life * 2.6; p += eR * uDrift * life * life * 3.4;',
      '  vA = uIntensity * mix(1.0, smoothstep(1.0, 0.55, life) * smoothstep(0.0, 0.08, life), step(0.01, uDrift)) * mix(1.0, uAlpha, al);',
      '  vCol = aKind < 0.5 ? vec3(0.25, 0.85, 1.6) : aKind < 1.5 ? vec3(1.7, 0.75, 0.2) : aKind < 2.5 ? vec3(0.9, 0.95, 1.1) : vec3(1.2, 1.7, 0.35);',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  gl_PointSize = (mix(0.2, 0.085, e) + al * 0.1) * uPx / max(0.5, -mv.z);',
      '  gl_Position = projectionMatrix * mv; }'
    ].join('\n'), 'varying vec3 vCol; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d); gl_FragColor = vec4(vCol * a * a * vA, 1.0); }');
    var parts = new THREE.Points(pg, this.partMat);
    parts.frustumCulled = false; parts.renderOrder = 16;
    this.group.add(parts);

    /* ----- fusion neutrons: straight lines until the blanket stops them ----- */
    var NN = 320, org = new Float32Array(NN * 3), dirs = new Float32Array(NN * 3), ns = new Float32Array(NN * 2), fw = tokamak.profiles.firstWall;
    for (var n = 0; n < NN; n++) {
      var o = pos3(shape, 0.6 * Math.sqrt(Math.random()), Math.random() * TAU, Math.random() * TAU);
      var u = Math.random() * 2 - 1, az = Math.random() * TAU, sq = Math.sqrt(1 - u * u);
      var d = new THREE.Vector3(sq * Math.cos(az), u, sq * Math.sin(az)), dist = 0, p = new THREE.Vector3();
      for (dist = 0.2; dist < 26; dist += 0.12) {
        p.copy(o).addScaledVector(d, dist);
        if (!geo.insidePoly(fw, Math.hypot(p.x, p.z), p.y)) break;
      }
      org.set([o.x, o.y, o.z], n * 3); dirs.set([d.x, d.y, d.z], n * 3); ns[n * 2] = Math.random(); ns[n * 2 + 1] = dist + 0.28;
    }
    var ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(org, 3));
    ng.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
    ng.setAttribute('aSeed', new THREE.BufferAttribute(ns, 2));
    this.neutronMat = additive({ uTime: { value: 0 }, uIntensity: { value: 0 }, uPx: { value: 600 } }, [
      'attribute vec3 aDir; attribute vec2 aSeed; uniform float uTime; uniform float uPx; uniform float uIntensity; varying float vA; varying float vHit;',
      'void main(){',
      '  float p = fract(uTime * 0.42 + aSeed.x);',
      '  float fly = min(1.0, p / 0.72);',                      // the last 28 % of the cycle is the flash in the blanket
      '  vec3 pos = position + aDir * aSeed.y * fly;',
      '  vHit = smoothstep(0.72, 0.76, p) * smoothstep(1.0, 0.8, p);',
      '  vA = uIntensity * (smoothstep(0.0, 0.05, p) * step(p, 0.72) * 0.9 + vHit * 1.6);',
      '  vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
      '  gl_PointSize = mix(0.13, 0.42, vHit) * uPx / max(0.5, -mv.z);',
      '  gl_Position = projectionMatrix * mv; }'
    ].join('\n'), 'varying float vA; varying float vHit; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); vec3 c = mix(vec3(0.85, 0.95, 1.25), vec3(1.9, 0.7, 0.2), vHit); gl_FragColor = vec4(c * a * a * vA, 1.0); }');
    var neutrons = new THREE.Points(ng, this.neutronMat);
    neutrons.frustumCulled = false; neutrons.renderOrder = 17;
    this.group.add(neutrons);

    /* ----- heating systems ----- */
    var z0 = shape.Z0;
    /* neutral beam: tangential, straight through the field because it is neutral */
    var alpha = 50 * DEG, Rt = 5.3;
    var T = new THREE.Vector3(Rt * Math.cos(alpha), z0, Rt * Math.sin(alpha)), dirN = new THREE.Vector3(-Math.sin(alpha), 0, Math.cos(alpha));
    var nbStart = T.clone().addScaledVector(dirN, 13.6), nbEnd = T.clone().addScaledVector(dirN, -2.6);
    this.nbiMat = flowMaterial(hdr(0x8fd2ff, 2.4), { dashes: 9, speed: 2.6, base: 0.5, intensity: 0, fadeEnds: true });
    var nb = new THREE.Mesh(geo.tube([nbStart, nbStart.clone().lerp(nbEnd, 0.33), nbStart.clone().lerp(nbEnd, 0.66), nbEnd], 0.24, 10, false), this.nbiMat);
    nb.renderOrder = 18; this.group.add(nb); this.flows.push(this.nbiMat);
    this.nbiBox = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 3.2), new THREE.MeshStandardMaterial({ color: 0x6f8098, roughness: 0.45, metalness: 0.85, transparent: true, opacity: 0 }));
    this.nbiBox.position.copy(nbStart).addScaledVector(dirN, 1.5);
    this.nbiBox.lookAt(T); this.group.add(this.nbiBox);
    this.anchors = { nbi: nbStart.clone().lerp(nbEnd, 0.35), nbiBox: this.nbiBox.position.clone().add(new THREE.Vector3(0, 1.6, 0)) };

    /* electron cyclotron: narrow millimetre-wave beams from the upper launchers */
    var ecTubes = [];
    [[66, 74], [114, 106]].forEach(function (pair) {
      var a = pair[0] * DEG, b = pair[1] * DEG;
      var s = new THREE.Vector3(8.9 * Math.cos(a), 5.3, 8.9 * Math.sin(a)), e = new THREE.Vector3(5.9 * Math.cos(b), 1.5, 5.9 * Math.sin(b));
      ecTubes.push(geo.tube([s, s.clone().lerp(e, 0.5), e], 0.085, 8, false));
      self.anchors.ec = s.clone();
    });
    this.ecMat = flowMaterial(hdr(0x7dffa0, 2.2), { dashes: 16, speed: 3.2, base: 0.4, intensity: 0, fadeEnds: true });
    var ec = new THREE.Mesh(mergeIndexed(ecTubes), this.ecMat);
    ec.renderOrder = 18; this.group.add(ec); this.flows.push(this.ecMat);

    /* ion cyclotron: an antenna on the far outboard wall and expanding wave fronts */
    var icPhi = 262 * DEG, icGroup = new THREE.Group();
    icGroup.position.set(8.02 * Math.cos(icPhi), z0, 8.02 * Math.sin(icPhi));
    icGroup.lookAt(6.2 * Math.cos(icPhi), z0, 6.2 * Math.sin(icPhi));
    this.icPlate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 0.12), new THREE.MeshBasicMaterial({ color: hdr(0xff9a3d, 1), transparent: true, opacity: 0 }));
    icGroup.add(this.icPlate);
    this.icRings = [];
    for (var r = 0; r < 4; r++) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 48), new THREE.MeshBasicMaterial({ color: hdr(0xffa24a, 2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      icGroup.add(ring); this.icRings.push(ring);
    }
    this.group.add(icGroup);
    this.anchors.ic = icGroup.position.clone();

    /* pellets of frozen D-T fired from the high-field side */
    this.pelletPath = [pos3(shape, 1.5, 2.25, 100 * DEG), pos3(shape, 1.12, 2.4, 99 * DEG), pos3(shape, 0.55, 2.7, 97 * DEG)];
    this.pellets = [];
    for (var pl = 0; pl < 3; pl++) {
      var ball = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color: hdr(0xdff4ff, 3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.group.add(ball); this.pellets.push(ball);
    }
    this.anchors.pellet = this.pelletPath[0].clone();
    this.anchors.xPoint = new THREE.Vector3(0, xp[1], xp[0]);
    this.anchors.strike = new THREE.Vector3(so[0] * Math.cos(128 * DEG), so[1], so[0] * Math.sin(128 * DEG));

    this.rebuildField();
  }

  Effects.prototype.rebuildField = function () {
    var q = this.toroidalOnly ? 1e6 : this.q, key = q.toFixed(3);
    if (this.qBuilt === key) return;
    this.qBuilt = key;
    var shape = this.shape, tubes = [];
    [{ rho: 1.03, n: 9, r: 0.03 }, { rho: 0.6, n: 5, r: 0.024 }].forEach(function (s) {
      for (var i = 0; i < s.n; i++) {
        var pts = [], th0 = TAU * i / s.n, STEPS = 190;
        for (var k = 0; k <= STEPS; k++) { var ph = -TAU * k / STEPS; pts.push(pos3(shape, s.rho, th0 + ph / q, ph)); }
        tubes.push(geo.tube(pts, s.r, 5, false));
      }
    });
    this.fieldMesh.geometry.dispose();
    this.fieldMesh.geometry = mergeIndexed(tubes);
  };
  Effects.prototype.setQ = function (q, toroidalOnly) {
    this.q = q; this.toroidalOnly = !!toroidalOnly;
    this.rebuildField();
  };
  /* set any subset of channels; unspecified channels keep their goals */
  Effects.prototype.set = function (o) { for (var k in o) if (k in this.goal) this.goal[k] = o[k]; };
  Effects.prototype.reset = function () { for (var k in this.goal) this.goal[k] = 0; };

  Effects.prototype.update = function (time, dt, raw) {
    var v = this.v, g = this.goal, k, rate = Math.min(1, raw * 3.2);
    for (k in g) { v[k] += (g[k] - v[k]) * rate; if (Math.abs(g[k] - v[k]) < 0.002) v[k] = g[k]; }
    var px = this.engine.h * this.engine.dpr / (2 * Math.tan(this.engine.camera.fov * DEG / 2));
    var heat = v.heat, i;
    for (i = 0; i < this.shells.length; i++) {
      var s = this.shells[i], u = s.mat.uniforms;
      u.uTime.value = time; u.uFlicker.value = v.flicker;
      /* the edge stays pink and cool; heating lights the core up and thins the edge glow */
      var gain = i === 0 ? 1 - 0.3 * heat : i === 1 ? 0.5 + 0.7 * heat : 0.15 + 1.5 * heat;
      u.uIntensity.value = v.plasma * gain;
      s.mesh.visible = u.uIntensity.value > 0.004;
    }
    this.legMat.opacity = Math.min(1, v.plasma) * (0.25 + 0.5 * v.strike); this.strikeMat.opacity = v.strike * (0.8 + 0.2 * Math.sin(time * 6));
    for (i = 0; i < this.flows.length; i++) this.flows[i].uniforms.uTime.value = time;
    this.fieldMat.uniforms.uIntensity.value = v.field; this.fieldMesh.visible = v.field > 0.004;
    this.polMat.uniforms.uIntensity.value = v.poloidal;
    this.currentMat.uniforms.uIntensity.value = v.current;
    var pu = this.partMat.uniforms;
    pu.uTime.value = time; pu.uIntensity.value = v.particles; pu.uAlpha.value = v.alphas; pu.uDrift.value = v.drift;
    pu.uQ.value = this.toroidalOnly ? 1e6 : this.q; pu.uPx.value = px;
    var nu = this.neutronMat.uniforms;
    nu.uTime.value = time; nu.uIntensity.value = v.neutrons; nu.uPx.value = px;
    this.nbiMat.uniforms.uIntensity.value = v.nbi; this.nbiBox.material.opacity = Math.min(1, v.nbi * 1.5); this.nbiBox.visible = v.nbi > 0.01;
    this.ecMat.uniforms.uIntensity.value = v.ec;
    this.icPlate.material.opacity = v.ic * (0.6 + 0.3 * Math.sin(time * 14));
    for (i = 0; i < this.icRings.length; i++) {
      var f = (time * 0.55 + i / this.icRings.length) % 1, ring = this.icRings[i];
      ring.scale.setScalar(0.5 + f * 1.3); ring.position.z = 0.2 + f * 2.6;
      ring.material.opacity = v.ic * (1 - f) * 0.9; ring.visible = v.ic > 0.01;
    }
    for (i = 0; i < this.pellets.length; i++) {
      var t = (time * 0.45 + i / 3) % 1, P = this.pelletPath, b = this.pellets[i];
      var a = t < 0.5 ? P[0].clone().lerp(P[1], t * 2) : P[1].clone().lerp(P[2], (t - 0.5) * 2);
      b.position.copy(a);
      /* the pellet ablates once it crosses the separatrix: it swells into a cloud and fades */
      var inside = Math.max(0, (t - 0.5) * 2);
      b.scale.setScalar(1 + inside * 4.5); b.material.opacity = v.pellets * (1 - inside * 0.92); b.visible = v.pellets > 0.01;
    }
    var bl = this.tokamak.layers.blanket.mats[0];
    bl.emissiveIntensity = v.blanketHeat * (0.16 + 0.03 * Math.sin(time * 3.1));
    this.tokamak.glow = { cs: v.csGlow, tf: v.tfGlow, pf: v.pfGlow };
  };

  FL.Effects = Effects;
  FL.fx = { flowMaterial: flowMaterial, mergeIndexed: mergeIndexed, hdr: hdr, additive: additive, pos3: pos3 };
})();
