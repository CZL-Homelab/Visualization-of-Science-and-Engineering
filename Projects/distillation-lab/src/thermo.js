/* Distillation Lab — thermodynamics & column engine.
 *
 * Every module must compute through this file so that a concept never gets two
 * different formulas. Pure functions, no DOM, usable from Node tests.
 *
 * Conventions (also documented in README):
 *   - Temperatures in °C, pressures in mmHg internally (UI shows kPa).
 *   - Compositions are mole fractions of the LIGHT (more volatile) component.
 *   - Antoine form: log10(P/mmHg) = A − B / (C + T/°C).
 *   - Liquid activity: Raoult (ideal), NRTL (ethanol / water / ethylene glycol,
 *     Aspen Plus V15 APV150 parameters) or van Laar fitted to the 1 atm
 *     azeotrope (acetone / chloroform). Vapour is an ideal gas.
 *   - Column calculations assume constant molar overflow (CMO), a total
 *     condenser and a partial reboiler that counts as one equilibrium stage.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.DL = root.DL || {}; root.DL.thermo = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ATM = 760;            // mmHg
  var KPA = 7.500617;       // mmHg per kPa
  var R_GAS = 8.314462618;  // J/(mol·K)
  var RMIN_FLOOR = 0.05;    // lower bound used when the pinch gives Rmin ≤ 0

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function kPa(mmHg) { return mmHg / KPA; }
  function mmHg(kpa) { return kpa * KPA; }

  /* ------------------------------------------------------------------ */
  /*  Pure components                                                    */
  /* ------------------------------------------------------------------ */
  // Antoine constants (mmHg, °C). Water uses two ranges. Values are common
  // handbook constants; they were cross-checked against the NIST Chemistry
  // WebBook bar/K fits (agreement within ~1.6 % in pressure, see README).
  var COMPONENTS = {
    benzene:    { id: 'benzene', name: '苯', en: 'Benzene', formula: 'C₆H₆', M: 78.11, cas: '71-43-2', tbLit: 80.1, hvap: 30.7,
                  antoine: [[6.90565, 1211.033, 220.790, 8, 104]] },
    toluene:    { id: 'toluene', name: '甲苯', en: 'Toluene', formula: 'C₇H₈', M: 92.14, cas: '108-88-3', tbLit: 110.6, hvap: 33.2,
                  antoine: [[6.95464, 1344.800, 219.482, 6, 137]] },
    hexane:     { id: 'hexane', name: '正己烷', en: 'n-Hexane', formula: 'C₆H₁₄', M: 86.18, cas: '110-54-3', tbLit: 68.7, hvap: 28.9,
                  antoine: [[6.87601, 1171.170, 224.410, -25, 92]] },
    heptane:    { id: 'heptane', name: '正庚烷', en: 'n-Heptane', formula: 'C₇H₁₆', M: 100.20, cas: '142-82-5', tbLit: 98.4, hvap: 31.8,
                  antoine: [[6.89385, 1264.370, 216.636, -2, 124]] },
    ethanol:    { id: 'ethanol', name: '乙醇', en: 'Ethanol', formula: 'C₂H₅OH', M: 46.07, cas: '64-17-5', tbLit: 78.3, hvap: 38.6,
                  antoine: [[8.20417, 1642.890, 230.300, -57, 80], [7.68117, 1332.040, 199.200, 77, 243]] },
    water:      { id: 'water', name: '水', en: 'Water', formula: 'H₂O', M: 18.015, cas: '7732-18-5', tbLit: 100.0, hvap: 40.7,
                  antoine: [[8.07131, 1730.630, 233.426, 1, 100], [8.14019, 1810.940, 244.485, 99, 374]] },
    acetone:    { id: 'acetone', name: '丙酮', en: 'Acetone', formula: 'C₃H₆O', M: 58.08, cas: '67-64-1', tbLit: 56.1, hvap: 29.1,
                  antoine: [[7.11714, 1210.595, 229.664, -13, 120]] },
    eg:         { id: 'eg', name: '乙二醇', en: 'Ethylene glycol', formula: 'C₂H₆O₂', M: 62.07, cas: '107-21-1', tbLit: 197.3, hvap: 50.5,
                  // NIST WebBook (Jones and Tamplin, 1952): 4.97012, 1914.951, −84.996 in bar/K, 323–473 K → mmHg/°C
                  antoine: [[7.84522, 1914.951, 188.154, 50, 200]] },
    chloroform: { id: 'chloroform', name: '氯仿', en: 'Chloroform', formula: 'CHCl₃', M: 119.38, cas: '67-66-3', tbLit: 61.2, hvap: 29.2,
                  antoine: [[6.95465, 1170.966, 226.232, -10, 120]] }
  };

  function antoineLog(a, T) { return a[0] - a[1] / (a[2] + T); }
  /** Saturation pressure in mmHg at T (°C). Where two Antoine ranges overlap,
   *  log10(p) is blended linearly across the overlap so the curve stays smooth. */
  function psat(id, T) {
    var c = typeof id === 'string' ? COMPONENTS[id] : id;
    var sets = c.antoine;
    if (sets.length === 1) return Math.pow(10, antoineLog(sets[0], T));
    var lo = sets[1][3], hi = sets[0][4];
    if (T <= lo) return Math.pow(10, antoineLog(sets[0], T));
    if (T >= hi) return Math.pow(10, antoineLog(sets[1], T));
    var w = (T - lo) / (hi - lo);
    return Math.pow(10, (1 - w) * antoineLog(sets[0], T) + w * antoineLog(sets[1], T));
  }
  /** Saturation temperature in °C at P (mmHg). */
  function tsat(id, P) {
    var lo = -60, hi = 400;
    for (var i = 0; i < 70; i++) {
      var m = (lo + hi) / 2;
      if (psat(id, m) > P) hi = m; else lo = m;
    }
    return (lo + hi) / 2;
  }

  /** Clausius–Clapeyron with Trouton's rule: an estimate for a generic organic
   *  given only its normal boiling point (°C). ΔS_vap ≈ 88 J/(mol·K). */
  function psatTrouton(tb, T, dS) {
    var s = (dS || 88) / R_GAS;
    var Tb = tb + 273.15, Tk = T + 273.15;
    return ATM * Math.exp(s * (1 - Tb / Tk));
  }
  function tsatTrouton(tb, P, dS) {
    var s = (dS || 88) / R_GAS;
    var Tb = tb + 273.15;
    return Tb / (1 - Math.log(P / ATM) / s) - 273.15;
  }

  /* ------------------------------------------------------------------ */
  /*  Binary systems                                                     */
  /* ------------------------------------------------------------------ */
  /* NRTL binary parameters (Aspen Plus V15, APV150 VLE-IG), Aspen convention:
   * τij = aij + bij/T (T in K), Gij = exp(−cij·τij). Stored as i|j → [aij, aji, bij, bji, cij]. */
  var NRTL = {
    'water|ethanol': [3.4578, -0.8009, -586.081, 246.18, 0.3],
    'water|eg': [0.3479, -0.0567, 34.8234, -147.137, 0.3],
    'ethanol|eg': [14.8422, -0.1115, -4664.41, 157.594, 0.47]
  };
  function nrtlPair(i, j) {
    var p = NRTL[i + '|' + j];
    if (p) return { a: p[0], b: p[2], c: p[4] };
    p = NRTL[j + '|' + i];
    if (p) return { a: p[1], b: p[3], c: p[4] };
    return null;
  }
  /** Multicomponent NRTL activity coefficients. ids: component ids, x: mole fractions, Tc: °C. */
  function nrtlGamma(ids, x, Tc) {
    var n = ids.length, Tk = Tc + 273.15, tau = [], G = [], i, j, k;
    for (i = 0; i < n; i++) {
      tau.push([]); G.push([]);
      for (j = 0; j < n; j++) {
        if (i === j) { tau[i].push(0); G[i].push(1); continue; }
        var p = nrtlPair(ids[i], ids[j]);
        if (!p) throw new Error('missing NRTL pair ' + ids[i] + '/' + ids[j]);
        var t = p.a + p.b / Tk;
        tau[i].push(t); G[i].push(Math.exp(-p.c * t));
      }
    }
    var den = [];
    for (j = 0; j < n; j++) { var d = 0; for (k = 0; k < n; k++) d += x[k] * G[k][j]; den.push(d); }
    var g = [];
    for (i = 0; i < n; i++) {
      var s1 = 0;
      for (j = 0; j < n; j++) s1 += x[j] * tau[j][i] * G[j][i];
      var lng = s1 / den[i];
      for (j = 0; j < n; j++) {
        var s2 = 0;
        for (var m = 0; m < n; m++) s2 += x[m] * tau[m][j] * G[m][j];
        lng += x[j] * G[i][j] / den[j] * (tau[i][j] - s2 / den[j]);
      }
      g.push(Math.exp(lng));
    }
    return g;
  }

  var SYSTEMS = {
    bt: { id: 'bt', name: '苯–甲苯', en: 'Benzene / Toluene', light: 'benzene', heavy: 'toluene', model: 'ideal',
          note: '近理想体系：Raoult 定律即可，α 约 2.3–2.6。' },
    hh: { id: 'hh', name: '正己烷–正庚烷', en: 'Hexane / Heptane', light: 'hexane', heavy: 'heptane', model: 'ideal',
          note: '同系物，近理想；沸点差约 30 °C。' },
    ew: { id: 'ew', name: '乙醇–水', en: 'Ethanol / Water', light: 'ethanol', heavy: 'water', model: 'nrtl',
          azeoLit: { x: 0.894, T: 78.15, P: ATM, type: 'min' },
          note: '强正偏差：最低恒沸物，1 atm 下约 x = 0.894（95.6 wt%）、78.15 °C。NRTL 参数取自 Aspen Plus V15（APV150）。' },
    ac: { id: 'ac', name: '丙酮–氯仿', en: 'Acetone / Chloroform', light: 'acetone', heavy: 'chloroform', model: 'vanlaar',
          A12: -0.8444, A21: -0.5868, azeoLit: { x: 0.34, T: 64.5, P: ATM, type: 'max' },
          note: '负偏差（氢键）：最高恒沸物，1 atm 下约 x = 0.34、64.5 °C。' },
    alpha: { id: 'alpha', name: '恒定 α', en: 'Constant α', model: 'alpha',
          note: '理想化模型：相对挥发度处处相同，只描述 x–y 关系，不含温度。' }
  };

  /** Fit van Laar constants so that an azeotrope sits at (x, T) for pressure P. */
  function fitVanLaar(light, heavy, x1, T, P) {
    P = P || ATM;
    var l1 = Math.log(P / psat(light, T)), l2 = Math.log(P / psat(heavy, T));
    var x2 = 1 - x1;
    return {
      A12: l1 * Math.pow(1 + x2 * l2 / (x1 * l1), 2),
      A21: l2 * Math.pow(1 + x1 * l1 / (x2 * l2), 2)
    };
  }

  function gammas(sys, x, Tc) {
    if (sys.model === 'nrtl') { var xx = clamp(x, 0, 1); return nrtlGamma([sys.light, sys.heavy], [xx, 1 - xx], Tc); }
    if (sys.model !== 'vanlaar') return [1, 1];
    var A12 = sys.A12, A21 = sys.A21, x1 = clamp(x, 0, 1), x2 = 1 - x1;
    var d = A12 * x1 + A21 * x2;
    if (Math.abs(d) < 1e-12) return [1, 1];
    return [Math.exp(A12 * Math.pow(A21 * x2 / d, 2)), Math.exp(A21 * Math.pow(A12 * x1 / d, 2))];
  }

  /** Bubble point at liquid composition x and pressure P (mmHg). */
  function bubble(sys, x, P) {
    if (sys.model === 'alpha') {
      var a = sys.alpha;
      return { T: NaN, y: a * x / (1 + (a - 1) * x), g: [1, 1], alpha: a };
    }
    var tdep = sys.model === 'nrtl';
    var g = gammas(sys, x, 80);
    var lo = -40, hi = 300, T = 0;
    for (var i = 0; i < 64; i++) {
      T = (lo + hi) / 2;
      if (tdep) g = gammas(sys, x, T);
      var s = x * g[0] * psat(sys.light, T) + (1 - x) * g[1] * psat(sys.heavy, T);
      if (s > P) hi = T; else lo = T;
    }
    if (tdep) g = gammas(sys, x, T);
    var p1 = psat(sys.light, T), p2 = psat(sys.heavy, T);
    var K1 = g[0] * p1 / P, K2 = g[1] * p2 / P;
    return { T: T, y: clamp(x * K1, 0, 1), g: g, p1: p1, p2: p2, K1: K1, K2: K2, alpha: K1 / K2 };
  }

  /* ------------------------------------------------------------------ */
  /*  Equilibrium object: dense table + fast interpolation               */
  /* ------------------------------------------------------------------ */
  var eqCache = {};
  function makeEq(sysId, opts) {
    opts = opts || {};
    var base = typeof sysId === 'object' ? sysId : SYSTEMS[sysId];
    if (!base) throw new Error('unknown system ' + sysId);
    var P = opts.P || ATM;
    var sys = Object.assign({}, base);
    if (sys.model === 'alpha') sys.alpha = opts.alpha || 2.5;
    if (sys.model === 'table') sys.table = opts.table || sys.table;
    var key = sys.id + '|' + P.toFixed(3) + '|' + (sys.alpha || '') + '|' + (sys.model === 'table' ? sys.tableKey : '');
    if (eqCache[key]) return eqCache[key];

    var n = 600, xs = [], ys = [], Ts = [];
    if (sys.model === 'table') {
      var t = sys.table;
      for (var k = 0; k <= n; k++) {
        var xx = k / n;
        xs.push(xx); ys.push(interp(t.x, t.y, xx)); Ts.push(NaN);
      }
    } else {
      for (var i = 0; i <= n; i++) {
        // Denser near the ends where curves bend most.
        var u = i / n, x = 0.5 - 0.5 * Math.cos(Math.PI * u);
        var b = bubble(sys, x, P);
        xs.push(x); ys.push(i === 0 ? 0 : i === n ? 1 : b.y); Ts.push(b.T);
      }
    }
    function yOf(x) { return interp(xs, ys, clamp(x, 0, 1)); }
    function TOf(x) { return interp(xs, Ts, clamp(x, 0, 1)); }
    // x(y): the curve is monotone increasing in y for all bundled systems.
    function xOf(y) { return interp(ys, xs, clamp(y, 0, 1)); }
    // Dew temperature: the bubble T of the liquid in equilibrium with vapour y.
    function TdewOf(y) { return TOf(xOf(y)); }
    function alphaAt(x) {
      if (sys.model === 'alpha') return sys.alpha;
      var xx = clamp(x, 1e-4, 1 - 1e-4), yy = yOf(xx);
      return (yy / xx) / ((1 - yy) / (1 - xx));
    }
    var azeo = findAzeotrope(xs, ys, Ts);
    var eq = {
      sys: sys, P: P, xs: xs, ys: ys, Ts: Ts, y: yOf, x: xOf, T: TOf, Tdew: TdewOf, alpha: alphaAt,
      hasT: sys.model !== 'alpha' && sys.model !== 'table', azeotrope: azeo,
      tbLight: sys.light ? tsat(sys.light, P) : NaN, tbHeavy: sys.heavy ? tsat(sys.heavy, P) : NaN
    };
    eqCache[key] = eq;
    return eq;
  }

  function interp(xa, ya, x) {
    var n = xa.length;
    if (x <= xa[0]) return ya[0];
    if (x >= xa[n - 1]) return ya[n - 1];
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      var m = (lo + hi) >> 1;
      if (xa[m] <= x) lo = m; else hi = m;
    }
    var t = (x - xa[lo]) / ((xa[hi] - xa[lo]) || 1);
    return ya[lo] + t * (ya[hi] - ya[lo]);
  }

  function findAzeotrope(xs, ys, Ts) {
    for (var i = 2; i < xs.length - 2; i++) {
      var d0 = ys[i] - xs[i], d1 = ys[i + 1] - xs[i + 1];
      if (d0 === 0 || d0 * d1 < 0) {
        var t = d0 === 0 ? 0 : d0 / (d0 - d1);
        var x = xs[i] + t * (xs[i + 1] - xs[i]);
        var T = Ts[i] + t * (Ts[i + 1] - Ts[i]);
        var type = d0 > 0 ? 'min' : 'max'; // y > x before the crossing → minimum-boiling
        return { x: x, T: T, type: type };
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /*  Multicomponent (NRTL) bubble point and extractive distillation     */
  /* ------------------------------------------------------------------ */
  /** Bubble point of a liquid mixture with NRTL activity and ideal vapour. */
  function bubbleMulti(ids, x, P) {
    var lo = -40, hi = 350, T = 0, g = null;
    for (var it = 0; it < 64; it++) {
      T = (lo + hi) / 2;
      g = nrtlGamma(ids, x, T);
      var s = 0;
      for (var i = 0; i < ids.length; i++) s += x[i] * g[i] * psat(ids[i], T);
      if (s > P) hi = T; else lo = T;
    }
    g = nrtlGamma(ids, x, T);
    var y = ids.map(function (id, i) { return x[i] * g[i] * psat(id, T) / P; });
    return { T: T, y: y, g: g };
  }
  /** Solvent-free x–y curve of ethanol/water with ethylene glycol at liquid
   *  mole fraction xS (ternary NRTL bubble points). */
  function extractive(xS, P, n) {
    P = P || ATM; n = n || 80;
    var pts = [], minA = Infinity, maxYs = 0, Tmin = Infinity, Tmax = -Infinity;
    for (var k = 0; k <= n; k++) {
      var u = k / n, xp = 0.5 - 0.5 * Math.cos(Math.PI * u);
      if (k === 0 || k === n) { pts.push({ x: xp, y: xp, T: NaN }); continue; }
      var x = [xp * (1 - xS), (1 - xp) * (1 - xS), xS];
      var b = bubbleMulti(['ethanol', 'water', 'eg'], x, P);
      var yp = b.y[0] / (b.y[0] + b.y[1]);
      var a = (yp / xp) / ((1 - yp) / (1 - xp));
      minA = Math.min(minA, a); maxYs = Math.max(maxYs, b.y[2]);
      Tmin = Math.min(Tmin, b.T); Tmax = Math.max(Tmax, b.T);
      pts.push({ x: xp, y: yp, T: b.T, alpha: a, yS: b.y[2] });
    }
    return { xS: xS, pts: pts, minAlpha: minA, maxYsolvent: maxYs, Tmin: Tmin, Tmax: Tmax, azeotrope: minA < 1 };
  }

  /* ------------------------------------------------------------------ */
  /*  Single-stage processes                                             */
  /* ------------------------------------------------------------------ */
  /** Equilibrium flash specified by vapour fraction f = V/F. */
  function flash(eq, z, f) {
    f = clamp(f, 0, 1);
    // z = (1−f)·x + f·y(x); g(x) increases monotonically in x.
    var lo = 0, hi = 1;
    for (var i = 0; i < 60; i++) {
      var m = (lo + hi) / 2;
      var g = (1 - f) * m + f * eq.y(m);
      if (g > z) hi = m; else lo = m;
    }
    var x = (lo + hi) / 2, y = eq.y(x);
    return { x: x, y: y, f: f, T: eq.hasT ? eq.T(x) : NaN, L: 1 - f, V: f };
  }

  /** Rayleigh (simple differential) distillation from pot composition x0 until
   *  a fraction `frac` of the charge has been distilled. */
  function rayleigh(eq, x0, frac, steps) {
    steps = steps || 400;
    var target = Math.log(1 / Math.max(1e-6, 1 - clamp(frac, 0, 0.995)));
    var path = [{ x: x0, W: 1, D: 0, xDavg: eq.y(x0), xDinst: eq.y(x0) }];
    var x = x0, lnW = 0;
    var dx = x0 / steps;
    while (-lnW < target && x > 1e-5) {
      var h = Math.min(dx, x * 0.5);
      // RK2 on d(lnW)/dx = 1 / (y − x)
      var k1 = 1 / Math.max(1e-9, eq.y(x) - x);
      var k2 = 1 / Math.max(1e-9, eq.y(x - h / 2) - (x - h / 2));
      var dln = -h * k2;
      if (-(lnW + dln) > target) { h *= (target + lnW) / (-dln); dln = -(target + lnW); }
      lnW += dln;
      x -= h;
      var W = Math.exp(lnW), D = 1 - W;
      path.push({ x: x, W: W, D: D, xDavg: D > 1e-9 ? (x0 - W * x) / D : eq.y(x0), xDinst: eq.y(x) });
      if (k1 > 1e6) break; // azeotrope pinch
    }
    var last = path[path.length - 1];
    return { path: path, xW: last.x, W: last.W, D: last.D, xDavg: last.xDavg, T0: eq.hasT ? eq.T(x0) : NaN, Tend: eq.hasT ? eq.T(last.x) : NaN };
  }

  /* ------------------------------------------------------------------ */
  /*  Continuous column: McCabe–Thiele                                    */
  /* ------------------------------------------------------------------ */
  function qLineY(x, xF, q) {
    if (Math.abs(q - 1) < 1e-9) return NaN; // vertical
    return q / (q - 1) * x - xF / (q - 1);
  }
  /** Intersection of the q-line with the rectifying line y = R/(R+1)x + xD/(R+1). */
  function opIntersect(xF, q, xD, R) {
    var s = R / (R + 1), b = xD / (R + 1);
    if (Math.abs(q - 1) < 1e-9) return { x: xF, y: s * xF + b };
    var a = q / (q - 1), c = -xF / (q - 1);
    var x = (b - c) / (a - s);
    return { x: x, y: s * x + b };
  }
  /** q-line ∩ equilibrium curve. */
  function qPinch(eq, xF, q) {
    if (Math.abs(q - 1) < 1e-9) return { x: xF, y: eq.y(xF) };
    if (Math.abs(q) < 1e-9) return { x: eq.x(xF), y: xF };
    var lo = 0, hi = 1;
    var f = function (x) { return eq.y(x) - qLineY(x, xF, q); };
    // For q > 1 or q < 0 the q-line has positive slope; search the bracket.
    var fl = f(lo), fh = f(hi);
    if (fl * fh > 0) {
      // scan for a sign change
      var prev = 0, pv = fl;
      for (var i = 1; i <= 400; i++) {
        var xx = i / 400, v = f(xx);
        if (pv * v <= 0) { lo = prev; hi = xx; break; }
        prev = xx; pv = v;
      }
    }
    for (var k = 0; k < 60; k++) {
      var m = (lo + hi) / 2;
      if (f(lo) * f(m) <= 0) hi = m; else lo = m;
    }
    var x = (lo + hi) / 2;
    return { x: x, y: eq.y(x) };
  }

  /** Minimum reflux ratio: the rectifying line pivoting on (xD, xD) must stay
   *  below the equilibrium curve between the q-line pinch and xD (covers both
   *  feed pinch and a tangent pinch in the rectifying section). */
  function rmin(eq, xF, q, xD) {
    var p = qPinch(eq, xF, q);
    var sMax = (xD - p.y) / (xD - p.x);
    var tangent = false;
    var xa = Math.min(p.x, xD), N = 500;
    for (var i = 0; i < N; i++) {
      var x = xa + (xD - xa) * i / N;
      if (xD - x < 1e-4) break;
      var s = (xD - eq.y(x)) / (xD - x);
      if (s > sMax + 1e-9) { sMax = s; tangent = true; }
    }
    if (!(sMax < 1)) return { R: Infinity, pinch: p, tangent: tangent };
    // A feed already richer than the pinch can give Rmin ≤ 0; keep a small
    // positive floor so "R = k·Rmin" stays meaningful.
    var R = sMax / (1 - sMax);
    return { R: Math.max(RMIN_FLOOR, R), raw: R, floored: R < RMIN_FLOOR, pinch: p, tangent: tangent };
  }

  /**
   * Step off stages from the top.
   * o: { xF, q, xD, xW, R, E (Murphree vapour efficiency 0–1, default 1),
   *      feedStage (optional fixed feed stage, 1-based), maxStages }
   * Stage numbering: 1 = top tray; the last stage is the partial reboiler.
   */
  function mccabe(eq, o) {
    var xF = o.xF, q = o.q, xD = o.xD, xW = o.xW, R = o.R;
    var E = o.E == null ? 1 : clamp(o.E, 0.05, 1);
    var maxStages = o.maxStages || 120;
    var F = o.F || 1;
    var D = F * (xF - xW) / (xD - xW), W = F - D;
    var L = R * D, V = L + D, Lb = L + q * F, Vb = V - (1 - q) * F;
    var inter = opIntersect(xF, q, xD, R);
    var sR = R / (R + 1), bR = xD / (R + 1);
    var sS = Vb > 1e-9 ? Lb / Vb : Infinity, bS = Vb > 1e-9 ? -W * xW / Vb : 0;
    function yRect(x) { return sR * x + bR; }
    function yStrip(x) { return sS * x + bS; }
    var res = {
      xF: xF, q: q, xD: xD, xW: xW, R: R, E: E, D: D, W: W, L: L, V: V, Lb: Lb, Vb: Vb,
      inter: inter, stages: [], N: Infinity, feedStage: null, pinched: false, infeasible: false,
      yRect: yRect, yStrip: yStrip
    };
    if (!(xD > xF && xF > xW) || D <= 0 || W <= 0) { res.infeasible = true; res.reason = '需要 xD > xF > xW'; return res; }
    if (Vb <= 1e-9) { res.infeasible = true; res.reason = '提馏段上升蒸汽量 ≤ 0（q 过小或 R 过低）'; return res; }
    var stripping = false;
    var y = xD, xPrev = xD;
    for (var n = 1; n <= maxStages; n++) {
      var opY = stripping ? yStrip : yRect;
      // Murphree pseudo-equilibrium: y_n = y_op(x_n) + E·(y*(x_n) − y_op(x_n))
      var x = solveStage(eq, y, opY, E);
      if (x === null) { res.pinched = true; break; }
      res.stages.push({ n: n, x: x, y: y, yEq: eq.y(x), T: eq.hasT ? eq.T(x) : NaN, section: stripping ? 'S' : 'R', xPrev: xPrev });
      if (x <= xW + 1e-9) {
        var frac = (xPrev - xW) / Math.max(1e-12, xPrev - x);
        res.N = n - 1 + clamp(frac, 0, 1);
        res.Nint = n;
        break;
      }
      if (!stripping) {
        // Feed stage = the step that straddles the q-line (optimal) or a fixed stage.
        if (o.feedStage ? n >= o.feedStage : x < inter.x) { stripping = true; res.feedStage = n; }
      }
      if (Math.abs(xPrev - x) < 1e-6 && n > 2) { res.pinched = true; break; }
      xPrev = x;
      y = (stripping ? yStrip : yRect)(x);
      if (n === maxStages) res.pinched = true;
    }
    if (res.feedStage == null && res.stages.length) res.feedStage = res.stages.length;
    if (res.pinched) { res.N = Infinity; }
    return res;
  }

  function solveStage(eq, y, opY, E) {
    // Find x with  opY(x) + E·(eq.y(x) − opY(x)) = y, x in [0, 1].
    if (E >= 1) {
      if (y >= 1) return 1;
      var xe = eq.x(y);
      return isFinite(xe) ? xe : null;
    }
    var f = function (x) { return opY(x) + E * (eq.y(x) - opY(x)) - y; };
    var lo = 0, hi = 1;
    if (f(lo) > 0) return 0;
    if (f(hi) < 0) return null;
    for (var i = 0; i < 60; i++) {
      var m = (lo + hi) / 2;
      if (f(m) > 0) hi = m; else lo = m;
    }
    return (lo + hi) / 2;
  }

  /** Minimum number of stages at total reflux (stepping against y = x). */
  function nmin(eq, xD, xW) {
    var x = xD, n = 0, xPrev = xD, stages = [];
    while (n < 200) {
      n++;
      var xn = eq.x(x);
      stages.push({ n: n, x: xn, y: x });
      if (xn <= xW) return { N: n - 1 + (xPrev - xW) / Math.max(1e-12, xPrev - xn), stages: stages };
      if (Math.abs(xn - xPrev) < 1e-7) return { N: Infinity, stages: stages };
      xPrev = xn; x = xn;
    }
    return { N: Infinity, stages: stages };
  }

  /** Rating mode under CMO: given N stages (reboiler included), feed stage
   *  (1-based from the top tray; saturated-liquid feed onto it), reflux ratio R
   *  and D/F, find xD and the stage profile. */
  function rateColumn(eq, o) {
    var N = o.N, f = o.feedStage, R = o.R, DF = o.DF, xF = o.xF, q = o.q == null ? 1 : o.q;
    function xWof(xD) { return (xF - DF * xD) / (1 - DF); }
    function profile(xD) {
      var xW = xWof(xD), L = R * DF, V = L + DF, Lb = L + q, Vb = V - (1 - q);
      var y = xD, x, st = [];
      for (var n = 1; n <= N; n++) {
        x = eq.x(y);
        st.push({ n: n, x: x, y: y, T: eq.hasT ? eq.T(x) : NaN });
        y = n < f ? (L / V) * x + DF / V * xD : (Lb / Vb) * x - (1 - DF) * xW / Vb;
      }
      return st;
    }
    var lo = xF + 1e-6, hi = 1 - 1e-9;
    for (var i = 0; i < 90; i++) {
      var m = (lo + hi) / 2, st = profile(m);
      if (st[N - 1].x - xWof(m) > 0) hi = m; else lo = m;
    }
    var xD = (lo + hi) / 2;
    return { xD: xD, xW: xWof(xD), stages: profile(xD), L: R * DF, V: (R + 1) * DF, Lb: R * DF + q, Vb: (R + 1) * DF - (1 - q) };
  }

  /* ------------------------------------------------------------------ */
  /*  Shortcut methods                                                   */
  /* ------------------------------------------------------------------ */
  // Two-phase state of a binary with overall light-component fraction z at
  // temperature Tc on eq's isobar: liquid x on the bubble line, vapour
  // y = y*(x) at the other end of the tie line, and V/F from the lever rule.
  // Returns null outside the two-phase region.
  function tieLine(eq, Tc, z) {
    var cand = null;
    for (var i = 0; i < eq.xs.length - 1; i++) {
      var a = eq.Ts[i] - Tc, b = eq.Ts[i + 1] - Tc;
      if (!isFinite(a) || !isFinite(b) || a * b > 0 || a === b) continue;
      var f = a / (a - b), x = eq.xs[i] + f * (eq.xs[i + 1] - eq.xs[i]), y = eq.y(x);
      if (z >= Math.min(x, y) - 1e-9 && z <= Math.max(x, y) + 1e-9) { cand = { x: x, y: y }; break; }
    }
    if (!cand || Math.abs(cand.y - cand.x) < 1e-9) return null;
    cand.VF = clamp((z - cand.x) / (cand.y - cand.x), 0, 1);
    return cand;
  }

  function fenske(xD, xW, alpha) {
    return Math.log((xD / (1 - xD)) * ((1 - xW) / xW)) / Math.log(alpha);
  }
  /** Binary Underwood (constant α): solve Σ αi zi/(αi − θ) = 1 − q, then Rmin + 1 = Σ αi xDi/(αi − θ). */
  function underwood(alpha, xF, q, xD) {
    var f = function (t) { return alpha * xF / (alpha - t) + (1 - xF) / (1 - t) - (1 - q); };
    var lo = 1 + 1e-9, hi = alpha - 1e-9;
    for (var i = 0; i < 100; i++) {
      var m = (lo + hi) / 2;
      // f increases with θ between the two α values
      if (f(m) > 0) hi = m; else lo = m;
    }
    var th = (lo + hi) / 2;
    return { theta: th, Rmin: alpha * xD / (alpha - th) + (1 - xD) / (1 - th) - 1 };
  }
  /** Gilliland correlation, Eduljee (1975) fit: Y = 0.75·(1 − X^0.5668). */
  function gilliland(R, Rmin, Nmin) {
    var X = (R - Rmin) / (R + 1);
    if (X <= 0) return { X: X, Y: 1, N: Infinity };
    var Y = 0.75 * (1 - Math.pow(X, 0.5668));
    return { X: X, Y: Y, N: (Nmin + Y) / (1 - Y) };
  }

  /* ------------------------------------------------------------------ */
  /*  Batch distillation                                                 */
  /* ------------------------------------------------------------------ */
  /** Liquid composition leaving the pot when stepping N stages (pot included)
   *  down from distillate xD along the rectifying line of reflux ratio R. */
  function stepDown(eq, xD, R, N) {
    var y = xD, x = xD;
    for (var n = 0; n < N; n++) {
      x = eq.x(y);
      y = R / (R + 1) * x + xD / (R + 1);
    }
    return x;
  }

  /**
   * o: { x0, W0 (kmol), N (stages incl. pot), R, V (kmol/h boil-up), mode: 'constR'|'constXD',
   *      xDset, xWend, Rmax }
   */
  function batch(eq, o) {
    var x0 = o.x0, W0 = o.W0 || 100, N = Math.max(1, Math.round(o.N)), V = o.V || 20;
    var xWend = o.xWend == null ? 0.05 : o.xWend;
    var pts = [];
    var t = 0, W = W0, Dc = 0, lightD = 0;
    var steps = 160, xW = x0, h = (x0 - xWend) / steps;
    var stopReason = 'xW';
    for (var i = 0; i <= steps; i++) {
      var R, xD;
      if (o.mode === 'constXD') {
        xD = o.xDset;
        // find the R that brings stepDown to xW
        var lo = 0, hi = o.Rmax || 40;
        if (stepDown(eq, xD, hi, N) > xW) { stopReason = 'Rmax'; break; }
        for (var k = 0; k < 50; k++) {
          var m = (lo + hi) / 2;
          if (stepDown(eq, xD, m, N) > xW) lo = m; else hi = m;
        }
        R = hi;
      } else {
        R = o.R;
        var lo2 = xW, hi2 = 1;
        for (var k2 = 0; k2 < 50; k2++) {
          var m2 = (lo2 + hi2) / 2;
          if (stepDown(eq, m2, R, N) > xW) hi2 = m2; else lo2 = m2;
        }
        xD = lo2;
      }
      pts.push({ t: t, W: W, D: Dc, xW: xW, xD: xD, R: R, xDavg: Dc > 1e-9 ? lightD / Dc : xD, T: eq.hasT ? eq.T(xW) : NaN });
      if (i === steps) break;
      // advance pot composition by h: dW/W = dxW/(xD − xW)
      var xNext = xW - h;
      var dlnW = -h / Math.max(1e-6, xD - xW);
      var Wn = W * Math.exp(dlnW);
      var dD = W - Wn;
      lightD += W * xW - Wn * xNext;
      Dc += dD;
      t += dD * (R + 1) / V;
      W = Wn; xW = xNext;
      if (xD - xW < 1e-4) { stopReason = 'pinch'; break; }
    }
    var last = pts[pts.length - 1] || null;
    if (!last) stopReason = 'infeasible'; // target xD unreachable even at the start
    return {
      pts: pts, last: last, stopReason: stopReason,
      recovery: last ? (lightD) / (W0 * x0) : 0
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Immiscible (steam) distillation                                    */
  /* ------------------------------------------------------------------ */
  /** o: { P (mmHg), organic: 'toluene' | { tb, M } } */
  function steam(o) {
    var P = o.P || ATM;
    var org = o.organic;
    var po = typeof org === 'string' ? function (T) { return psat(org, T); } : function (T) { return psatTrouton(org.tb, T); };
    var Mo = typeof org === 'string' ? COMPONENTS[org].M : org.M;
    var lo = -20, hi = 250;
    for (var i = 0; i < 70; i++) {
      var m = (lo + hi) / 2;
      if (psat('water', m) + po(m) > P) hi = m; else lo = m;
    }
    var T = (lo + hi) / 2, pw = psat('water', T), pO = po(T);
    var massRatio = pO * Mo / (pw * COMPONENTS.water.M); // kg organic per kg water
    return {
      T: T, pw: pw, po: pO, yOrg: pO / P, massRatio: massRatio,
      steamPerKg: 1 / massRatio,
      tbWater: tsat('water', P),
      tbOrg: typeof org === 'string' ? tsat(org, P) : tsatTrouton(org.tb, P)
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Crude oil TBP (synthetic, for teaching)                            */
  /* ------------------------------------------------------------------ */
  var CRUDES = {
    light:  { name: '轻质原油（示意）',  v: [0, 3, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], T: [10, 40, 85, 128, 168, 210, 255, 302, 355, 420, 505, 680] },
    medium: { name: '中质原油（示意）',  v: [0, 2, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], T: [15, 45, 105, 160, 210, 262, 318, 375, 440, 515, 610, 760] },
    heavy:  { name: '重质原油（示意）',  v: [0, 1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], T: [25, 60, 140, 210, 275, 340, 400, 465, 535, 615, 700, 820] }
  };
  function tbpT(crude, v) { var c = CRUDES[crude]; return interp(c.v, c.T, clamp(v, 0, 100)); }
  function tbpV(crude, T) { var c = CRUDES[crude]; return interp(c.T, c.v, T); }

  return {
    ATM: ATM, KPA: KPA, kPa: kPa, mmHg: mmHg, clamp: clamp, interp: interp,
    COMPONENTS: COMPONENTS, SYSTEMS: SYSTEMS, CRUDES: CRUDES,
    psat: psat, tsat: tsat, psatTrouton: psatTrouton, tsatTrouton: tsatTrouton,
    gammas: gammas, bubble: bubble, fitVanLaar: fitVanLaar, makeEq: makeEq,
    NRTL: NRTL, nrtlGamma: nrtlGamma, bubbleMulti: bubbleMulti, extractive: extractive, rateColumn: rateColumn,
    flash: flash, rayleigh: rayleigh,
    qLineY: qLineY, opIntersect: opIntersect, qPinch: qPinch, rmin: rmin, mccabe: mccabe, nmin: nmin,
    tieLine: tieLine, fenske: fenske, underwood: underwood, gilliland: gilliland,
    stepDown: stepDown, batch: batch, steam: steam, tbpT: tbpT, tbpV: tbpV
  };
});
