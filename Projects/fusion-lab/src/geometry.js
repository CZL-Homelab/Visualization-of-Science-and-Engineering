/* Fusion Lab — geometry helpers on top of the vendored three.js core.
 *
 * Every toroidal part of the machine is described by a polygon in the (R, Z)
 * half-plane and swept around the vertical axis. Cut faces go into a second
 * material group so a cutaway can show the section in a contrasting shade.
 * Convention: x = R cos φ, y = Z, z = R sin φ.
 */
(function () {
  'use strict';
  var FL = globalThis.FL = globalThis.FL || {};
  var THREE = globalThis.THREE;
  var TAU = Math.PI * 2;

  /* ---------- 2D polygon utilities (arrays of [R, Z]) ---------- */
  function area(poly) {
    var s = 0;
    for (var i = 0, n = poly.length; i < n; i++) { var a = poly[i], b = poly[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; }
    return s / 2;
  }
  function ccw(poly) { return area(poly) >= 0 ? poly : poly.slice().reverse(); }
  function cw(poly) { return area(poly) <= 0 ? poly : poly.slice().reverse(); }

  /* Offset a closed polygon along its vertex normals (positive = outward for
   * a counter-clockwise polygon). Good for smooth, well-sampled contours. */
  function offset(poly, d) {
    var n = poly.length, out = [], sign = area(poly) >= 0 ? 1 : -1;
    for (var i = 0; i < n; i++) {
      var p = poly[(i + n - 1) % n], c = poly[i], q = poly[(i + 1) % n];
      var ax = c[0] - p[0], ay = c[1] - p[1], bx = q[0] - c[0], by = q[1] - c[1];
      var al = Math.hypot(ax, ay) || 1, bl = Math.hypot(bx, by) || 1;
      var nx = ay / al + by / bl, ny = -ax / al - bx / bl;
      var nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      /* mitre: keep the perpendicular distance to both edges equal to d */
      var cos = nx * (ay / al) + ny * (-ax / al);
      var k = typeof d === 'function' ? d(i, n) : d;
      var m = k * sign / Math.max(0.35, cos);
      out.push([c[0] + nx * m, c[1] + ny * m]);
    }
    return out;
  }
  function sampleClosed(fn, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(fn(TAU * i / n, i));
    return out;
  }
  function bezier(p0, c1, c2, p1, n, includeEnd) {
    var out = [];
    for (var i = 0; i < n + (includeEnd ? 1 : 0); i++) {
      var t = i / n, u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
        u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1]
      ]);
    }
    return out;
  }
  function insidePoly(poly, r, z) {
    var c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[1] > z) !== (b[1] > z) && r < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }

  /* ---------- non-indexed triangle builder with two material groups ---------- */
  function Builder() {
    this.pos = [[], [], []];        // 0 = swept surface, 1 = cut face at the start angle, 2 = cut face at the end angle
    this.nor = [[], [], []];
  }
  Builder.prototype.tri = function (g, a, b, c, na, nb, nc) {
    /* wind the triangle so its face normal agrees with the supplied normals */
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    var P = this.pos[g], N = this.nor[g];
    if (fx * na[0] + fy * na[1] + fz * na[2] < 0) {
      P.push(a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2]);
      N.push(na[0], na[1], na[2], nc[0], nc[1], nc[2], nb[0], nb[1], nb[2]);
    } else {
      P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      N.push(na[0], na[1], na[2], nb[0], nb[1], nb[2], nc[0], nc[1], nc[2]);
    }
  };
  Builder.prototype.quad = function (g, a, b, c, d, na, nb, nc, nd) {
    this.tri(g, a, b, c, na, nb, nc);
    this.tri(g, a, c, d, na, nc, nd);
  };

  /* Per-vertex 2D normals of a contour: smooth where the corner is gentle,
   * split (one normal per edge) where it is sharper than `crease`. */
  function contourNormals(poly, crease) {
    var n = poly.length, en = [], out = [];
    for (var i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n];
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      en.push([dy / l, -dx / l]);
    }
    var limit = Math.cos(crease);
    for (var j = 0; j < n; j++) {
      var prev = en[(j + n - 1) % n], cur = en[j];
      if (prev[0] * cur[0] + prev[1] * cur[1] > limit) {
        var sx = prev[0] + cur[0], sy = prev[1] + cur[1], sl = Math.hypot(sx, sy) || 1;
        out.push({ before: [sx / sl, sy / sl], after: [sx / sl, sy / sl] });
      } else out.push({ before: prev, after: cur });
    }
    return out;
  }

  function triangulate(outer, holes) {
    var v2 = function (p) { return new THREE.Vector2(p[0], p[1]); };
    var all = outer.concat.apply(outer, holes || []);
    var faces = THREE.ShapeUtils.triangulateShape(outer.map(v2), (holes || []).map(function (h) { return h.map(v2); }));
    return faces.map(function (f) { return [all[f[0]], all[f[1]], all[f[2]]]; });
  }

  /* Sweep a polygon (with optional holes) from phi0 to phi1. A full turn has
   * no end caps. opts.crease in radians (default 35°). */
  Builder.prototype.sweep = function (outer, holes, phi0, phi1, segs, opts) {
    opts = opts || {};
    var self = this, crease = opts.crease == null ? 0.61 : opts.crease;
    var full = Math.abs(phi1 - phi0) >= TAU - 1e-6;
    var loops = [ccw(outer)].concat((holes || []).map(cw));
    var at = function (p, phi) { return [p[0] * Math.cos(phi), p[1], p[0] * Math.sin(phi)]; };
    var n3 = function (n, phi) { return [n[0] * Math.cos(phi), n[1], n[0] * Math.sin(phi)]; };
    loops.forEach(function (loop) {
      var normals = contourNormals(loop, crease), n = loop.length;
      for (var i = 0; i < n; i++) {
        var p = loop[i], q = loop[(i + 1) % n];
        if (p[0] < 1e-6 && q[0] < 1e-6) continue;          // edge lying on the axis
        var np = normals[i].after, nq = normals[(i + 1) % n].before;
        for (var s = 0; s < segs; s++) {
          var a = phi0 + (phi1 - phi0) * s / segs, b = phi0 + (phi1 - phi0) * (s + 1) / segs;
          self.quad(0, at(p, a), at(q, a), at(q, b), at(p, b), n3(np, a), n3(nq, a), n3(nq, b), n3(np, b));
        }
      }
    });
    if (!full && opts.caps !== false) {
      var tris = triangulate(loops[0], loops.slice(1));
      [[phi0, -1, 1], [phi1, 1, 2]].forEach(function (end) {
        var phi = end[0], s = end[1] * Math.sign(phi1 - phi0 || 1);
        var nn = [-Math.sin(phi) * s, 0, Math.cos(phi) * s];
        var g = opts.capGroup == null ? end[2] : opts.capGroup;
        tris.forEach(function (t) { self.tri(g, at(t[0], phi), at(t[1], phi), at(t[2], phi), nn, nn, nn); });
      });
    }
    return this;
  };

  /* Extrude an (R, Z) polygon to a constant-width slab centred on the
   * meridional plane at angle phi (TF coils, ports, ribs). */
  Builder.prototype.slab = function (outer, holes, phi, halfWidth, opts) {
    opts = opts || {};
    var self = this, crease = opts.crease == null ? 0.61 : opts.crease;
    var er = [Math.cos(phi), 0, Math.sin(phi)], et = [-Math.sin(phi), 0, Math.cos(phi)];
    var loops = [ccw(outer)].concat((holes || []).map(cw));
    var at = function (p, w) { return [p[0] * er[0] + w * et[0], p[1], p[0] * er[2] + w * et[2]]; };
    var n3 = function (n) { return [n[0] * er[0], n[1], n[0] * er[2]]; };
    loops.forEach(function (loop) {
      var normals = contourNormals(loop, crease), n = loop.length;
      for (var i = 0; i < n; i++) {
        var p = loop[i], q = loop[(i + 1) % n];
        var np = n3(normals[i].after), nq = n3(normals[(i + 1) % n].before);
        self.quad(0, at(p, -halfWidth), at(q, -halfWidth), at(q, halfWidth), at(p, halfWidth), np, nq, nq, np);
      }
    });
    var g = opts.faceGroup == null ? 0 : opts.faceGroup;
    triangulate(loops[0], loops.slice(1)).forEach(function (t) {
      var neg = [-et[0], 0, -et[2]];
      self.tri(g, at(t[0], halfWidth), at(t[1], halfWidth), at(t[2], halfWidth), et, et, et);
      self.tri(g, at(t[0], -halfWidth), at(t[1], -halfWidth), at(t[2], -halfWidth), neg, neg, neg);
    });
    return this;
  };

  /* Bake any three.js geometry into the builder through a matrix. */
  Builder.prototype.add = function (geometry, matrix, group) {
    var g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    var p = g.attributes.position.array, n = g.attributes.normal.array, G = group || 0;
    for (var i = 0; i < p.length; i++) { this.pos[G].push(p[i]); this.nor[G].push(n[i]); }
    g.dispose();
    return this;
  };
  Builder.prototype.box = function (w, h, d, matrix, group) { return this.add(new THREE.BoxGeometry(w, h, d), matrix, group); };

  Builder.prototype.build = function () {
    var total = this.pos[0].length + this.pos[1].length + this.pos[2].length;
    var pos = new Float32Array(total), nor = new Float32Array(total), at = 0;
    var geo = new THREE.BufferGeometry();
    for (var g = 0; g < 3; g++) {
      pos.set(this.pos[g], at); nor.set(this.nor[g], at);
      if (this.pos[g].length) geo.addGroup(at / 3, this.pos[g].length / 3, g);
      at += this.pos[g].length;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.computeBoundingSphere();
    return geo;
  };

  /* Tube along a polyline with u running 0..1 along its length (uv.x), for
   * flowing-dash shaders. `closed` joins the ends. */
  function tube(points, radius, radial, closed) {
    var n = points.length, rings = closed ? n + 1 : n;
    var pos = new Float32Array(rings * (radial + 1) * 3), nor = new Float32Array(rings * (radial + 1) * 3);
    var uv = new Float32Array(rings * (radial + 1) * 2), idx = [];
    var len = [0], total = 0, i;
    for (i = 1; i < rings; i++) { total += points[i % n].distanceTo(points[(i - 1) % n]); len.push(total); }
    var T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), up = new THREE.Vector3(), v = new THREE.Vector3();
    var prevN = null;
    for (i = 0; i < rings; i++) {
      var p = points[i % n];
      var a = points[closed ? (i + n - 1) % n : Math.max(0, i - 1)], b = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      T.subVectors(b, a).normalize();
      if (prevN) N.copy(prevN).addScaledVector(T, -prevN.dot(T)).normalize();
      else { up.set(0, 1, 0); if (Math.abs(T.y) > 0.9) up.set(1, 0, 0); N.crossVectors(T, up).normalize(); }
      B.crossVectors(T, N).normalize();
      prevN = prevN || new THREE.Vector3(); prevN.copy(N);
      for (var j = 0; j <= radial; j++) {
        var ang = TAU * j / radial, c = Math.cos(ang), s = Math.sin(ang), o = (i * (radial + 1) + j);
        v.set(0, 0, 0).addScaledVector(N, c).addScaledVector(B, s);
        nor[o * 3] = v.x; nor[o * 3 + 1] = v.y; nor[o * 3 + 2] = v.z;
        pos[o * 3] = p.x + v.x * radius; pos[o * 3 + 1] = p.y + v.y * radius; pos[o * 3 + 2] = p.z + v.z * radius;
        uv[o * 2] = total ? len[i] / total : 0; uv[o * 2 + 1] = j / radial;
      }
    }
    for (i = 0; i < rings - 1; i++) for (var k = 0; k < radial; k++) {
      var p0 = i * (radial + 1) + k, p1 = p0 + radial + 1;
      idx.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.userData.length = total;
    return geo;
  }

  /* Rounded poly-line through way-points (pipes with elbow fillets). */
  function roundedPath(pts, radius, per) {
    var out = [], n = pts.length, per_ = per || 6;
    out.push(pts[0].clone());
    for (var i = 1; i < n - 1; i++) {
      var p = pts[i], a = pts[i - 1], b = pts[i + 1];
      var da = a.clone().sub(p), db = b.clone().sub(p);
      var r = Math.min(radius, da.length() / 2, db.length() / 2);
      var s = p.clone().addScaledVector(da.normalize(), r), e = p.clone().addScaledVector(db.normalize(), r);
      for (var k = 0; k <= per_; k++) {
        var t = k / per_, u = 1 - t;
        out.push(new THREE.Vector3(
          u * u * s.x + 2 * u * t * p.x + t * t * e.x,
          u * u * s.y + 2 * u * t * p.y + t * t * e.y,
          u * u * s.z + 2 * u * t * p.z + t * t * e.z));
      }
    }
    out.push(pts[n - 1].clone());
    /* resample long straight runs so flow dashes keep an even speed */
    var dense = [out[0]];
    for (var j = 1; j < out.length; j++) {
      var d = out[j].distanceTo(out[j - 1]), steps = Math.max(1, Math.round(d / 1.2));
      for (var m = 1; m <= steps; m++) dense.push(out[j - 1].clone().lerp(out[j], m / steps));
    }
    return dense;
  }

  FL.geo = {
    TAU: TAU, area: area, ccw: ccw, cw: cw, offset: offset, sampleClosed: sampleClosed, bezier: bezier,
    insidePoly: insidePoly, Builder: Builder, tube: tube, roundedPath: roundedPath, triangulate: triangulate
  };
})();
