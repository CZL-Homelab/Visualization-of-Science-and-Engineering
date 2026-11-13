#!/usr/bin/env node
/*
 * Physics invariants for Desalination Lab.
 *
 * Every assertion encodes a rule the teaching pages rely on: osmotic
 * pressure anchors, mass-balance identity, energy-model sanity and the
 * literature minimum-separation anchor. Run: node tests/check-physics.cjs
 */
'use strict';

const assert = require('assert');
const core = require('../src/core.js');
const ref = require('../src/reference.js');
const sim = require('../src/simulations.js');

let passed = 0;
function ok(name, fn) {
  fn();
  passed++;
  process.stdout.write('  ok   ' + name + '\n');
}
function near(a, b, eps, msg) {
  assert.ok(Math.abs(a - b) <= (eps == null ? 1e-6 : eps), (msg || '') + ' expected ' + b + ', got ' + a);
}

console.log('\nDesalination Lab physics checks\n');

/* ---------- osmotic pressure ---------- */
ok('seawater osmotic pressure lands in the published 26–28 bar band', () => {
  const pi = core.osmoticPressure(35000, 25);
  assert.ok(pi >= 26 && pi <= 28, 'π(35 g/L, 25°C) = ' + pi.toFixed(2));
});

ok('dilute NaCl anchor: 10 g/L at 25°C ≈ 7.7 bar', () => {
  near(core.osmoticPressure(10000, 25), 7.71, 0.15);
});

ok('osmotic pressure scales with absolute temperature', () => {
  const cold = core.osmoticPressure(35000, 5);
  const warm = core.osmoticPressure(35000, 45);
  near(warm / cold, 318.15 / 278.15, 1e-9);
});

ok('equivalent head for seawater π is ~270 m of water column', () => {
  const h = core.headMeters(core.osmoticPressure(35000, 25));
  assert.ok(h > 255 && h < 285, 'head = ' + h.toFixed(1));
});

/* ---------- pressure direction, including display rounding ---------- */
ok('salt-side pressure opposes osmosis and reverses flow above equilibrium', () => {
  const h = sim.osmosisCell(35000, 25, 0).head;
  assert.strictEqual(sim.osmosisCell(35000, 25, 0).direction, 'in');
  assert.strictEqual(sim.osmosisCell(35000, 25, h).direction, 'balance');
  assert.strictEqual(sim.osmosisCell(35000, 25, h + 35).direction, 'out');
});
ok('rounding the equilibrium head to whole metres does not invent a flow', () => {
  for (const salt of [1000, 35000, 70000]) {
    const h = sim.osmosisCell(salt, 25, 0).head;
    assert.strictEqual(sim.osmosisCell(salt, 25, Math.round(h)).direction, 'balance');
  }
});

/* ---------- mass balance ---------- */
ok('water balance identity F·Cf = P·Cp + B·Cb holds', () => {
  const b = core.waterBalance(100, 0.45, 0.993, 35000);
  near(b.F * 35000, b.P * b.Cp + b.B * b.Cb, 1e-6);
});

ok('brine concentration anchor: Y=45%, R=99.3% → ≈63,436 mg/L', () => {
  const b = core.waterBalance(100, 0.45, 0.993, 35000);
  near(b.Cb, 63435.9, 1);
  near(b.Cp, 245, 0.01);
});

ok('recovery clamp keeps the balance physical', () => {
  const b = core.waterBalance(100, 1.5, 0.993, 35000);
  assert.ok(b.Y <= 0.98 && b.B > 0);
});

/* ---------- conductivity & density ---------- */
ok('seawater conductivity estimate ≈ 54.7 mS/cm (k=0.64)', () => {
  near(core.conductivity(35000), 54687.5, 1);
});

ok('density grows with TDS and matches seawater at 35 g/L', () => {
  near(core.density(35000), 1024.7, 0.1);
  assert.ok(core.density(60000) > core.density(35000));
});

/* ---------- minimum separation energy ---------- */
ok('literature anchor: min separation energy = 1.06 kWh/m³ at 50% recovery', () => {
  near(core.minSeparationEnergy(0.5), ref.energy.theoreticalMin, 1e-9);
});

ok('min separation energy is monotonic on (0,1)', () => {
  let prev = 0;
  for (let y = 0.05; y <= 0.94; y += 0.01) {
    const v = core.minSeparationEnergy(y);
    assert.ok(v >= prev - 1e-9, 'non-monotonic at ' + y);
    prev = v;
  }
});

/* ---------- RO energy model ---------- */
ok('RO specific energy sits in the 2.5–4.5 kWh/m³ literature band at 62 bar / 45%', () => {
  const e = core.roEnergy(62, 0.45);
  assert.ok(e.net >= ref.energy.swro.lo && e.net <= ref.energy.swro.hi, 'net = ' + e.net.toFixed(2));
});

ok('energy-recovery device lowers net specific energy', () => {
  const withErd = core.roEnergy(62, 0.45, 0.82, 0.55);
  const noErd = core.roEnergy(62, 0.45, 0.82, 0);
  assert.ok(withErd.net < noErd.net);
});

ok('real RO energy stays above the thermodynamic minimum', () => {
  const e = core.roEnergy(62, 0.45);
  assert.ok(e.net > core.minSeparationEnergy(0.45));
});

/* ---------- RO flux ---------- */
ok('flux needs applied pressure above β·π_brine', () => {
  const stage = sim.roStage({ pressure: 40, recovery: 0.45 });
  assert.ok(!stage.feasible && stage.flow.flux === 0);
  const good = sim.roStage({ pressure: 62, recovery: 0.45 });
  assert.ok(good.feasible && good.flow.flux > 5 && good.flow.flux < 30);
});

/* ---------- thermal model ---------- */
ok('GEA is monotonic in stage count and top-brine temperature', () => {
  assert.ok(core.gainedOutputRatio(20, 110) > core.gainedOutputRatio(10, 110));
  assert.ok(core.gainedOutputRatio(16, 115) > core.gainedOutputRatio(16, 95));
});

ok('flash cascade is strictly decreasing and spans top → last', () => {
  const c = core.flashCascade(16, 110, 32);
  for (let i = 1; i < c.stages.length; i++) {
    assert.ok(c.stages[i].temp < c.stages[i - 1].temp);
  }
  near(c.stages[0].temp, 110, 1e-9);
  near(c.stages[c.stages.length - 1].temp + c.dT, 110 - c.dT * 15 + c.dT, 1e-9);
});

/* ---------- fouling ---------- */
ok('antiscalant slows flux decline', () => {
  const no = sim.membraneTimeline({ days: 30, scaling: 0.04, antiscalant: 0 });
  const yes = sim.membraneTimeline({ days: 30, scaling: 0.04, antiscalant: 0.8 });
  assert.ok(yes.hold > no.hold);
});

ok('scaling risk crosses from ok to warn/bad with recovery', () => {
  assert.strictEqual(sim.scalingRisk(0.4, 0.6).level, 'ok');
  assert.notStrictEqual(sim.scalingRisk(0.85, 0.2).level, 'ok');
});

/* ---------- remineralisation ---------- */
ok('calcite dosing: Ca 40 mg/L → ≈100 mg/L alkalinity as CaCO3', () => {
  const r = core.remineralize(40);
  near(r.alkalinity, 99.8, 0.6);
  assert.ok(r.ph > 8 && r.ph < 8.4);
});

/* ---------- whole plant ---------- */
ok('plant balance conserves volume and salt', () => {
  const pl = sim.plant({ feed: 100000, recovery: 0.45 });
  near(pl.bal.F, pl.bal.P + pl.bal.B, 1e-6);
  near(pl.bal.Cb / 35000, 1.81, 0.02);
});

console.log('\n' + passed + ' physics checks passed.\n');
