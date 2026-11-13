#!/usr/bin/env node
/*
 * Thermodynamic and column invariants for Distillation Lab.
 *
 * These are not "does it run" checks: every assertion encodes a relation the
 * teaching pages rely on (boiling points, azeotropes, lever rule, Rayleigh
 * balance, Rmin = Underwood, Fenske, stage stepping, batch balances, steam
 * distillation, ...).
 *
 * Run: node tests/check-thermo.cjs
 */
'use strict';

const assert = require('assert');
const T = require('../src/thermo.js');
const A = require('../src/aspen.js');

let passed = 0;
function ok(name, fn) {
  try {
    fn();
    passed++;
    process.stdout.write('  ok   ' + name + '\n');
  } catch (err) {
    process.stderr.write('  FAIL ' + name + '\n');
    throw err;
  }
}
function near(a, b, eps, msg) {
  assert.ok(Math.abs(a - b) <= (eps == null ? 1e-6 : eps), (msg || '') + ' expected ' + b + ' ± ' + eps + ', got ' + a);
}

console.log('\nDistillation Lab thermodynamic checks\n');

/* ---------- pure components ---------- */
ok('Antoine constants reproduce literature normal boiling points within 0.3 °C', () => {
  Object.keys(T.COMPONENTS).forEach((k) => {
    near(T.tsat(k, T.ATM), T.COMPONENTS[k].tbLit, 0.3, k);
  });
});

ok('ethylene glycol (NIST Antoine) boils at 197.3 °C within 0.3 °C', () => {
  near(T.tsat('eg', T.ATM), 197.3, 0.3);
  // converted from NIST's bar/K form log10 P = 4.97012 − 1914.951 / (T − 84.996)
  [100, 150, 190].forEach((t) => near(T.kPa(T.psat('eg', t)) / (100 * Math.pow(10, 4.97012 - 1914.951 / (t + 273.15 - 84.996))), 1, 1e-4, 'EG at ' + t + ' °C'));
});

ok('psat and tsat are inverse functions', () => {
  [['benzene', 50], ['water', 120], ['ethanol', 90], ['toluene', 30]].forEach(([c, t]) => {
    near(T.tsat(c, T.psat(c, t)), t, 1e-6, c);
  });
});

ok('two-range Antoine fits (water, ethanol) are blended without jumps', () => {
  [['water', 99], ['water', 100], ['water', 99.5], ['ethanol', 77], ['ethanol', 80], ['ethanol', 78.5]].forEach(([c, t]) => {
    const a = T.psat(c, t - 0.001), b = T.psat(c, t + 0.001);
    assert.ok(b > a && b / a - 1 < 2e-4, c + ' jump at ' + t + ': ' + a + ' → ' + b);
  });
  near(T.kPa(T.psat('water', 120)), 198.5, 2.5, 'water at 120 °C');
});

ok('Trouton estimate returns 1 atm at the normal boiling point', () => {
  near(T.psatTrouton(250, 250), T.ATM, 1e-9);
  near(T.tsatTrouton(250, T.ATM), 250, 1e-9);
  near(T.tsatTrouton(110.6, 400), T.tsat('toluene', 400), 2, 'Trouton vs Antoine for toluene');
});

/* ---------- binary VLE ---------- */
ok('bubble point: pure ends boil at the pure-component temperature', () => {
  const sys = T.SYSTEMS.bt;
  near(T.bubble(sys, 0, T.ATM).T, T.tsat('toluene', T.ATM), 1e-3);
  near(T.bubble(sys, 1, T.ATM).T, T.tsat('benzene', T.ATM), 1e-3);
});

ok('ideal system: α = p1*/p2* and partial pressures sum to P', () => {
  const sys = T.SYSTEMS.bt, b = T.bubble(sys, 0.4, T.ATM);
  near(b.alpha, b.p1 / b.p2, 1e-9);
  near(0.4 * b.p1 + 0.6 * b.p2, T.ATM, 0.01);
});

ok('benzene–toluene: α ≈ 2.5 at 1 atm and larger at 20 kPa', () => {
  const a1 = T.makeEq('bt').alpha(0.5), a2 = T.makeEq('bt', { P: T.mmHg(20) }).alpha(0.5);
  near(a1, 2.49, 0.05);
  assert.ok(a2 > a1 + 0.3, 'α should rise at lower pressure: ' + a1 + ' → ' + a2);
});

ok('equilibrium curves are monotone increasing in x for every bundled system', () => {
  ['bt', 'hh', 'ew', 'ac'].forEach((id) => {
    const eq = T.makeEq(id);
    for (let i = 1; i < eq.ys.length; i++) assert.ok(eq.ys[i] >= eq.ys[i - 1] - 1e-12, id + ' not monotone at ' + i);
  });
});

ok('ethanol–water (NRTL): minimum-boiling azeotrope at x ≈ 0.897, 78.16 °C (literature 0.894, 78.15 °C)', () => {
  const az = T.makeEq('ew').azeotrope;
  assert.ok(az, 'azeotrope missing');
  assert.strictEqual(az.type, 'min');
  near(az.x, 0.894, 0.006); near(az.T, 78.15, 0.1);
  assert.strictEqual(T.SYSTEMS.ew.model, 'nrtl');
});

ok('acetone–chloroform: maximum-boiling azeotrope at x ≈ 0.34, 64.5 °C', () => {
  const az = T.makeEq('ac').azeotrope;
  assert.ok(az, 'azeotrope missing');
  assert.strictEqual(az.type, 'max');
  near(az.x, 0.34, 0.005); near(az.T, 64.5, 0.15);
  assert.ok(az.T > T.tsat('acetone', T.ATM) && az.T > T.tsat('chloroform', T.ATM), 'max azeotrope must boil above both pure components');
});

ok('ideal systems have no azeotrope', () => {
  assert.strictEqual(T.makeEq('bt').azeotrope, null);
  assert.strictEqual(T.makeEq('hh').azeotrope, null);
});

ok('lower pressure moves the ethanol–water azeotrope towards ethanol (direction used by pressure swing)', () => {
  const lo = T.makeEq('ew', { P: T.mmHg(20) }).azeotrope.x;
  const mid = T.makeEq('ew').azeotrope.x;
  const hi = T.makeEq('ew', { P: T.mmHg(1000) }).azeotrope.x;
  assert.ok(lo > mid && mid > hi, [lo, mid, hi].join(' > '));
});

/* ---------- single stage ---------- */
ok('flash obeys the lever rule and x < z < y', () => {
  const eq = T.makeEq('bt');
  [0.1, 0.5, 0.9].forEach((f) => {
    const r = T.flash(eq, 0.5, f);
    near((1 - f) * r.x + f * r.y, 0.5, 1e-6);
    assert.ok(r.x < 0.5 && r.y > 0.5);
    near(r.y, eq.y(r.x), 1e-9);
  });
  const r = T.flash(eq, 0.5, 0.5);
  near(r.y, 0.611, 0.003); near(r.x, 0.389, 0.003);
});

ok('Rayleigh distillation conserves the light component and beats a flash at equal fraction', () => {
  const eq = T.makeEq('bt');
  const ry = T.rayleigh(eq, 0.5, 0.5);
  near(ry.W, 0.5, 1e-3);
  near(ry.W * ry.xW + ry.D * ry.xDavg, 0.5, 1e-6);
  const fl = T.flash(eq, 0.5, 0.5);
  assert.ok(ry.xDavg > fl.y, 'distillate ' + ry.xDavg + ' should exceed flash vapour ' + fl.y);
  assert.ok(ry.xW < fl.x);
});

/* ---------- continuous column ---------- */
const eqA = T.makeEq('alpha', { alpha: 2.5 });
ok('Rmin (pinch) equals Underwood for constant α: 1.10 at xF 0.5, q 1, xD 0.95', () => {
  near(T.rmin(eqA, 0.5, 1, 0.95).R, 1.1, 2e-3);
  near(T.underwood(2.5, 0.5, 1, 0.95).Rmin, 1.1, 1e-6);
  near(T.rmin(eqA, 0.5, 0, 0.95).R, T.underwood(2.5, 0.5, 0, 0.95).Rmin, 5e-3, 'q = 0');
  near(T.rmin(eqA, 0.4, 0.5, 0.9).R, T.underwood(2.5, 0.4, 0.5, 0.9).Rmin, 5e-3, 'q = 0.5');
});

ok('Fenske Nmin matches total-reflux stepping within one fractional stage', () => {
  const f = T.fenske(0.95, 0.05, 2.5);
  near(f, Math.log(361) / Math.log(2.5), 1e-9);
  near(T.nmin(eqA, 0.95, 0.05).N, f, 0.25);
});

ok('McCabe–Thiele: overall balance, stage order and termination', () => {
  const r = T.mccabe(eqA, { xF: 0.5, q: 1, xD: 0.95, xW: 0.05, R: 2.2 });
  near(r.D, (0.5 - 0.05) / 0.9, 1e-12);
  near(r.D + r.W, 1, 1e-12);
  for (let i = 1; i < r.stages.length; i++) assert.ok(r.stages[i].x < r.stages[i - 1].x, 'x must decrease down the column');
  assert.ok(r.stages[r.stages.length - 1].x <= 0.05 + 1e-9);
  assert.ok(isFinite(r.N) && r.N > 9 && r.N < 11, 'N = ' + r.N);
  // optimal feed stage is the step that crosses the q-line
  const fs = r.stages[r.feedStage - 1], prev = r.stages[r.feedStage - 2];
  assert.ok(fs.x < r.inter.x && prev.x >= r.inter.x);
});

ok('operating lines and q-line meet at one point', () => {
  [[0.45, 1], [0.5, 0.5], [0.3, 1.2], [0.6, 0]].forEach(([xF, q]) => {
    const r = T.mccabe(eqA, { xF: xF, q: q, xD: 0.95, xW: 0.05, R: 3 });
    near(r.yRect(r.inter.x), r.inter.y, 1e-9);
    near(r.yStrip(r.inter.x), r.inter.y, 1e-9);
    if (Math.abs(q - 1) > 1e-9) near(T.qLineY(r.inter.x, xF, q), r.inter.y, 1e-9);
  });
});

ok('more reflux → fewer stages; below Rmin → infinite', () => {
  let prev = Infinity;
  [1.05, 1.2, 1.5, 2, 3, 5].forEach((m) => {
    const N = T.mccabe(eqA, { xF: 0.5, q: 1, xD: 0.95, xW: 0.05, R: 1.1 * m }).N;
    assert.ok(N < prev, 'N should fall with R: ' + N + ' after ' + prev);
    prev = N;
  });
  assert.strictEqual(T.mccabe(eqA, { xF: 0.5, q: 1, xD: 0.95, xW: 0.05, R: 1.0 }).N, Infinity);
});

ok('Murphree efficiency below 1 always needs more stages', () => {
  const base = T.mccabe(eqA, { xF: 0.5, q: 1, xD: 0.95, xW: 0.05, R: 2.2 }).N;
  const e7 = T.mccabe(eqA, { xF: 0.5, q: 1, xD: 0.95, xW: 0.05, R: 2.2, E: 0.7 }).N;
  const e5 = T.mccabe(eqA, { xF: 0.5, q: 1, xD: 0.95, xW: 0.05, R: 2.2, E: 0.5 }).N;
  assert.ok(base < e7 && e7 < e5, [base, e7, e5].join(' < '));
});

ok('a feed stage far from optimum costs stages', () => {
  const opt = T.mccabe(eqA, { xF: 0.5, q: 1, xD: 0.95, xW: 0.05, R: 2.2 });
  const bad = T.mccabe(eqA, { xF: 0.5, q: 1, xD: 0.95, xW: 0.05, R: 2.2, feedStage: 2 });
  assert.ok(bad.N > opt.N);
});

ok('Gilliland (Eduljee) stays within 15 % of stage-by-stage results for α = 2.5', () => {
  const nm = T.fenske(0.95, 0.05, 2.5);
  [1.2, 1.5, 2, 3].forEach((m) => {
    const R = 1.1 * m;
    const exact = T.mccabe(eqA, { xF: 0.5, q: 1, xD: 0.95, xW: 0.05, R: R }).N;
    const g = T.gilliland(R, 1.1, nm).N;
    assert.ok(Math.abs(g - exact) / exact < 0.15, 'R/Rmin ' + m + ': ' + g + ' vs ' + exact);
  });
});

ok('ethanol–water: xD above the azeotrope is impossible (Rmin = ∞)', () => {
  const ew = T.makeEq('ew');
  assert.strictEqual(T.rmin(ew, 0.1, 1, 0.92).R, Infinity);
  assert.ok(isFinite(T.rmin(ew, 0.1, 1, 0.85).R));
});

/* ---------- batch ---------- */
ok('batch, constant reflux: xD falls with time and time = (R+1)·D/V', () => {
  const eq = T.makeEq('bt');
  const b = T.batch(eq, { x0: 0.5, W0: 100, N: 5, R: 3, V: 20, mode: 'constR', xWend: 0.08 });
  for (let i = 1; i < b.pts.length; i++) assert.ok(b.pts[i].xD <= b.pts[i - 1].xD + 1e-9);
  near(b.last.t, (3 + 1) * b.last.D / 20, 1e-6);
  near(b.last.W + b.last.D, 100, 1e-6);
  near(b.last.W * b.last.xW + b.last.D * b.last.xDavg, 50, 0.05);
});

ok('batch, constant xD: reflux rises and the average distillate stays on spec', () => {
  const eq = T.makeEq('bt');
  const b = T.batch(eq, { x0: 0.5, W0: 100, N: 5, xDset: 0.95, V: 20, mode: 'constXD', xWend: 0.08, Rmax: 40 });
  for (let i = 1; i < b.pts.length; i++) assert.ok(b.pts[i].R >= b.pts[i - 1].R - 1e-9);
  near(b.last.xDavg, 0.95, 0.003);
});

ok('simple distillation (N = 1, R = 0) first distillate equals y*(x0)', () => {
  const eq = T.makeEq('bt');
  const b = T.batch(eq, { x0: 0.5, W0: 100, N: 1, R: 0, V: 20, mode: 'constR', xWend: 0.1 });
  near(b.pts[0].xD, eq.y(0.5), 1e-4);
});

/* ---------- steam distillation ---------- */
ok('toluene–water steam distillation: ≈ 84 °C, ≈ 80 wt % toluene (literature 84.1 °C, 80.4 wt %)', () => {
  const s = T.steam({ P: T.ATM, organic: 'toluene' });
  near(s.T, 84.1, 0.5);
  near(s.massRatio / (1 + s.massRatio), 0.804, 0.01);
  near(s.pw + s.po, T.ATM, 1e-6);
  assert.ok(s.T < s.tbWater && s.T < s.tbOrg);
});

ok('steam distillation of a high boiler stays just below 100 °C and needs more steam', () => {
  const s = T.steam({ P: T.ATM, organic: { tb: 250, M: 150 } });
  assert.ok(s.T < 100 && s.T > 98, 'T = ' + s.T);
  assert.ok(s.steamPerKg > 5, 'steam per kg ' + s.steamPerKg);
});

/* ---------- crude TBP ---------- */
ok('synthetic TBP curves are monotone and tbpV inverts tbpT', () => {
  ['light', 'medium', 'heavy'].forEach((c) => {
    let prev = -Infinity;
    for (let v = 0; v <= 100; v += 1) { const t = T.tbpT(c, v); assert.ok(t > prev); prev = t; }
    [20, 45, 80].forEach((v) => near(T.tbpV(c, T.tbpT(c, v)), v, 1e-9));
  });
  assert.ok(T.tbpV('heavy', 370) < T.tbpV('medium', 370) && T.tbpV('medium', 370) < T.tbpV('light', 370), 'heavier crude → less distills below 370 °C');
});

ok('bubble and dew points satisfy their defining conditions (benzene–toluene, z = 0.40)', () => {
  const eq = T.makeEq('bt'), z = 0.4, Tb = eq.T(z), Td = eq.Tdew(z), P = T.kPa(T.ATM);
  const p1b = T.kPa(T.psat('benzene', Tb)), p2b = T.kPa(T.psat('toluene', Tb));
  near(z * p1b + (1 - z) * p2b, P, 0.05, 'bubble: Σ x p* = P');
  const p1d = T.kPa(T.psat('benzene', Td)), p2d = T.kPa(T.psat('toluene', Td));
  near(z * P / p1d + (1 - z) * P / p2d, 1, 5e-4, 'dew: Σ y P / p* = 1');
  assert.ok(Td > Tb, 'dew point above bubble point for a mixture');
  near(Tb, 95.14, 0.05); near(Td, 101.48, 0.05);
  near(eq.y(z), 0.622, 0.001, 'first bubble'); near(eq.x(z), 0.216, 0.001, 'first drop');
  near(eq.T(0), eq.Tdew(0), 0.01, 'pure heavy: bubble = dew'); near(eq.T(1), eq.Tdew(1), 0.01, 'pure light: bubble = dew');
});

ok('tie line and lever rule: x and y at the same T, mass balance closes, V/F rises 0 → 1', () => {
  const eq = T.makeEq('bt'), z = 0.4, Tb = eq.T(z), Td = eq.Tdew(z);
  let prev = -1;
  for (let k = 1; k < 20; k++) {
    const Tc = Tb + (Td - Tb) * k / 20, t = T.tieLine(eq, Tc, z);
    assert.ok(t, 'two-phase at ' + Tc.toFixed(2));
    near(eq.T(t.x), Tc, 0.02, 'liquid on the bubble line');
    near(eq.Tdew(t.y), Tc, 0.05, 'vapour on the dew line');
    near(t.VF * t.y + (1 - t.VF) * t.x, z, 1e-9, 'component balance');
    assert.ok(t.VF > prev, 'V/F increases with temperature'); prev = t.VF;
  }
  assert.strictEqual(T.tieLine(eq, Tb - 2, z), null, 'below the bubble point: liquid only');
  assert.strictEqual(T.tieLine(eq, Td + 2, z), null, 'above the dew point: vapour only');
  const mid = T.tieLine(eq, (Tb + Td) / 2, z);
  near(mid.x, 0.304, 0.002); near(mid.y, 0.516, 0.002); near(mid.VF, 0.452, 0.003);
});

ok('relative volatility: α = K₁/K₂, equals p₁*/p₂* for ideal solutions, crosses 1 at azeotropes', () => {
  const bt = T.makeEq('bt'), z = 0.4, y = bt.y(z), Tb = bt.T(z);
  near(bt.alpha(z), (y / z) / ((1 - y) / (1 - z)), 1e-9);
  near(bt.alpha(z), T.psat('benzene', Tb) / T.psat('toluene', Tb), 0.003, 'ideal: α = p1*/p2*');
  assert.ok(bt.alpha(0.999) > bt.alpha(0.5) && bt.alpha(0.5) > bt.alpha(0.001), 'α grows towards the light end (lower T)');
  const ew = T.makeEq('ew'), az = ew.azeotrope.x;
  assert.ok(ew.alpha(az - 0.05) > 1 && ew.alpha(az + 0.05) < 1, 'ethanol–water α crosses 1 at the azeotrope');
  near(ew.T(az), ew.Tdew(az), 0.02, 'bubble = dew at the azeotrope');
  const ac = T.makeEq('ac');
  assert.ok(ac.alpha(0.1) < 1 && ac.alpha(0.9) > 1, 'acetone–chloroform α < 1 below its azeotrope');
  near(T.fenske(0.95, 0.05, 2.5), 6.43, 0.01); near(T.fenske(0.95, 0.05, 1.2), 32.3, 0.05); near(T.fenske(0.95, 0.05, 1.05), 120.7, 0.1);
});

/* ---------- Aspen Plus V15 validation ---------- */
function aspenAzeotrope(d) {
  for (let i = 1; i < d.length; i++) {
    const a = d[i - 1], b = d[i], d0 = a[1] - a[0], d1 = b[1] - b[0];
    if (a[0] > 0 && b[0] < 1 && d0 * d1 < 0) { const f = d0 / (d0 - d1); return { x: a[0] + f * (b[0] - a[0]), T: a[2] + f * (b[2] - a[2]) }; }
  }
  return null;
}

ok('NRTL parameters in thermo.js are exactly the Aspen APV150 rows they cite', () => {
  Object.keys(T.NRTL).forEach((key) => {
    const [i, j] = key.split('|');
    const row = A.nrtl.find((r) => r[0] === i && r[1] === j);
    assert.ok(row, 'no Aspen row for ' + key);
    assert.deepStrictEqual(T.NRTL[key], [row[3], row[4], row[5], row[6], row[7]], key);
  });
});

ok('NRTL activity coefficients reproduce Aspen at every exported point (rel. error < 1e-5)', () => {
  let n = 0;
  Object.keys(A.txy).forEach((P) => A.txy[P].forEach(([x, , t, g1, g2]) => {
    const g = T.nrtlGamma(['ethanol', 'water'], [x, 1 - x], t);
    near(g[0] / g1, 1, 1e-5, P + ' kPa γ_ethanol at x ' + x);
    near(g[1] / g2, 1, 1e-5, P + ' kPa γ_water at x ' + x);
    n++;
  }));
  assert.ok(n >= 160, 'expected 4 × 41 points, got ' + n);
});

ok('ethanol–water T–x–y matches Aspen from 20 to 1000 kPa: |ΔT| ≤ 0.25 °C, |Δy| ≤ 0.003', () => {
  Object.keys(A.txy).forEach((P) => {
    const sys = T.SYSTEMS.ew, Pm = T.mmHg(Number(P));
    A.txy[P].forEach(([x, y, t]) => {
      const b = T.bubble(sys, x, Pm);
      near(b.T, t, 0.25, P + ' kPa T at x ' + x);
      near(b.y, y, 0.003, P + ' kPa y at x ' + x);
    });
  });
});

ok('model azeotropes track Aspen at all four pressures (Δx ≤ 0.01, ΔT ≤ 0.3 °C) and move towards ethanol as P falls', () => {
  let prev = Infinity;
  Object.keys(A.txy).map(Number).sort((a, b) => a - b).forEach((P) => {
    const ref = aspenAzeotrope(A.txy[String(P)]), az = T.makeEq('ew', { P: T.mmHg(P) }).azeotrope;
    assert.ok(ref && az, 'azeotrope missing at ' + P + ' kPa');
    near(az.x, ref.x, 0.01, P + ' kPa x_az'); near(az.T, ref.T, 0.3, P + ' kPa T_az');
    assert.ok(ref.x < prev, 'Aspen azeotrope should shift to lower x as P rises');
    prev = ref.x;
  });
});

ok('extractive distillation (ternary NRTL): ethylene glycol breaks the azeotrope above ≈ 3 mol %', () => {
  const none = T.extractive(0, T.ATM, 70), low = T.extractive(0.02, T.ATM, 70), hi = T.extractive(0.05, T.ATM, 70);
  assert.ok(none.azeotrope && low.azeotrope, 'azeotrope should persist at small x_EG');
  assert.ok(!hi.azeotrope && hi.minAlpha > 1, 'x_EG 0.05 should break it');
  let prev = 0;
  [0.05, 0.2, 0.4, 0.6, 0.8].forEach((xs) => { const e = T.extractive(xs, T.ATM, 70); assert.ok(e.minAlpha > prev, 'min α rises with solvent'); prev = e.minAlpha; });
  const mid = T.extractive(0.5, T.ATM, 70);
  near(mid.minAlpha, 3.04, 0.05);
  assert.ok(mid.maxYsolvent < 0.035, 'glycol should stay in the liquid: y_EG ' + mid.maxYsolvent);
  mid.pts.slice(1, -1).forEach((p) => assert.ok(p.T > 78 && p.T < 125, 'bubble T ' + p.T));
  near(mid.Tmin, 84.4, 0.5); near(mid.Tmax, 120.1, 0.5);
});

ok('bubbleMulti: binary call agrees with the binary bubble point, ternary y sums to 1', () => {
  [0.1, 0.5, 0.9].forEach((x) => {
    const m = T.bubbleMulti(['ethanol', 'water'], [x, 1 - x], T.ATM), b = T.bubble(T.SYSTEMS.ew, x, T.ATM);
    near(m.T, b.T, 0.01); near(m.y[0], b.y, 1e-3);
  });
  const t = T.bubbleMulti(['ethanol', 'water', 'eg'], [0.3, 0.3, 0.4], T.ATM);
  near(t.y.reduce((a, v) => a + v, 0), 1, 1e-4);
});

ok('rating mode reproduces the Aspen RadFrac benchmark: xD ±0.006, xW ±0.005, stage x ±0.03, T ±0.7 °C', () => {
  const R = A.radfrac, sp = R.spec, bt = T.makeEq('bt');
  const r = T.rateColumn(bt, { N: sp.N - 1, feedStage: sp.feedStage - 1, R: sp.R, DF: sp.DF, xF: sp.z });
  near(r.xD, R.x[0], 0.006, 'xD'); near(r.xW, R.x[sp.N - 1], 0.005, 'xW');
  near(sp.DF * r.xD + (1 - sp.DF) * r.xW, sp.z, 1e-4, 'benzene balance');
  const mx = [r.xD].concat(r.stages.map((q) => q.x)), mT = [bt.T(r.xD)].concat(r.stages.map((q) => q.T));
  assert.strictEqual(mx.length, sp.N, 'one composition per Aspen stage');
  mx.forEach((v, i) => { near(v, R.x[i], 0.03, 'x stage ' + (i + 1)); near(mT[i], R.T[i], 0.7, 'T stage ' + (i + 1)); });
  near(R.D * R.x[0] + R.B * R.x[sp.N - 1], sp.F * sp.z, 0.05, 'Aspen data itself balances');
  near(r.V * sp.F, R.V[1], 1e-6, 'CMO top vapour = Aspen top vapour (R+1)·D');
});

console.log('\n' + passed + ' thermodynamic checks passed\n');
