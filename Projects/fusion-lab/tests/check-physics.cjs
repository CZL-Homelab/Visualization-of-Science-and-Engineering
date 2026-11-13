'use strict';
const assert = require('node:assert/strict');
const c = require('../src/core.js');
let checks = 0;
function near(actual, expected, relative = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= relative * Math.max(1, Math.abs(expected)), `${actual} ≠ ${expected}`);
  checks++;
}
near(c.DT.total, 17.59, 0.001);
near(c.DT.alpha + c.DT.neutron, c.DT.total);
near(c.DT.alpha * c.MASS.He4, c.DT.neutron * c.MASS.n);
near(c.reactivity('DT', 10) / 1e-22, 1.136, 0.001);
assert.ok(c.reactivity('DT', 20) > c.reactivity('DT', 10));
near(c.reactivity('DHe3', 0.1), c.reactivity('DHe3', 0.5));
near(c.fusionPowerDensity(2e20, 15), 4 * c.fusionPowerDensity(1e20, 15));
const b = c.powerBalance({n: 1e20, T: 15, tau: 1, volume: 840});
near(b.pAlpha + b.pNeutron, b.pFus);
near(b.pAux + b.pAlpha, b.pTransport + b.pBrems);
near(c.gyroRadius(10, c.MASS.D, 1, 10), c.gyroRadius(10, c.MASS.D, 1, 5) / 2);
near(c.toroidalField(5.3, 6.2, 12.4), 2.65);
near(c.tritiumDecayFraction(c.TRITIUM_HALF_LIFE), 0.5);
near(c.BURN_KG_PER_GWYR, 56.08, 0.001);
near(c.deuteriumGramsPerM3(), 34.82, 0.001);
assert.ok(c.BREED.li6 > 4.7 && c.BREED.li7 < -2.4);
for (const Q of [1, 10, 40, Infinity]) {
  const p = c.plantBalance({pFus: 2000, Q, M: 1.1, etaTh: 0.4, etaHeat: 0.5, fBop: 0.1});
  near(p.net + p.recirc, p.gross);
  near(p.gross + p.waste, p.pThermal);
}
near(c.plasmaVolume({R0: 6.2, a: 2, kappa: 1, delta: 0}, 1440), 2 * Math.PI ** 2 * 6.2 * 4, 1e-5);
for (const tbr of [0.95, 1.1, 1.3]) {
  const o = {pFus: 2000, availability: 0.5, burnFraction: 0.01, tbr, tProcessH: 6, tBreedD: 5, startKg: 6};
  const f = c.fuelCycle(o);
  near(f.inject, f.burn + f.exhaust);
  const r = c.simulateInventory(o, 2, 100);
  near(r.final, o.startKg + r.bred - r.burned - r.decayed, 1e-8);
  assert.ok([...r.storage, ...r.loop, ...r.blanket].every(v => Number.isFinite(v) && v >= 0));
}
/* stellarator cartoon: field periodicity, stellarator symmetry and the winding of a field line */
const st = {R0: 5.5, a: 0.9, elong: 1.45, N: 5, axis: 0.28};
for (const [th, ph] of [[0.3, 0.2], [2.1, 1.7], [4.4, 5.9]]) {
  const p = c.stellaratorSurface(st, 1, th, ph);
  const next = c.stellaratorSurface(st, 1, th + Math.PI, ph + 2 * Math.PI / st.N);
  near(next.R, p.R); near(next.Z, p.Z);
  const mirror = c.stellaratorSurface(st, 1, -th, -ph);
  near(mirror.R, p.R); near(mirror.Z, -p.Z);
}
near(c.rotationalTransform(3), 1 / 3);
for (const iota of [5 / 6, 1, 5 / 4]) {
  const turns = 60, steps = turns * 720;
  let wound = 0, prev = null;
  for (let k = 0; k <= steps; k++) {
    const ph = 2 * Math.PI * turns * k / steps;
    const p = c.stellaratorSurface(st, 1, c.stellaratorFieldAngle(st, iota, 0.4, ph), ph), o = c.stellaratorAxis(st, ph);
    const ang = Math.atan2(p.Z - o.Z, p.R - o.R);
    if (prev != null) wound += Math.atan2(Math.sin(ang - prev), Math.cos(ang - prev));
    prev = ang;
  }
  near(wound / (2 * Math.PI * turns), iota, 0.01);
}
console.log(`PASS: ${checks} fusion, energy, geometry, stellarator and tritium conservation checks.`);
