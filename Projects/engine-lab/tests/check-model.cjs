#!/usr/bin/env node
/*
 * Model checks for Engine Lab: crank-slider kinematics, valve timing,
 * ignition behaviour, the P-V pressure model, four-cylinder phasing and
 * module registration. Pure logic only — no browser required.
 *
 * Run:  node tests/check-model.cjs
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let passed = 0;
function ok(name, fn) { fn(); passed++; console.log('  ok   ' + name); }

const ctx = vm.createContext({ window: {}, console });
function run(rel) { vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel }); }
function get(expr) { return vm.runInContext('(' + expr + ')', ctx); }

run('src/core.js');
const wrap = deg => ((deg % 720) + 720) % 720;

console.log('\n\nEngine Lab model checks\n');

// ---------- kinematics ----------
ok('TDC at 0° and 360°, BDC at 180° and 540°', () => {
  const tdc = get('pistonTop(0)'), bdc = get('pistonTop(180)');
  assert(Math.abs(get('pistonTop(360)') - tdc) < 1e-9);
  assert(Math.abs(get('pistonTop(540)') - bdc) < 1e-9);
  assert(Math.abs(bdc - tdc - 150) < 1e-9, 'stroke = 2R = 150');
});
ok('conrod measures exactly L at every crank angle', () => {
  for (let a = 0; a < 720; a += 7) assert(Math.abs(get('conrodLength(' + a + ')') - 190) < 1e-8);
});
ok('piston descends during intake (0→180) and ascends during compression', () => {
  assert(get('pistonTop(90)') > get('pistonTop(45)'));
  assert(get('pistonTop(270)') < get('pistonTop(200)'));
});

// ---------- valve timing ----------
ok('intake open through intake stroke, closed mid-compression', () => {
  assert(get('intakeLift(90)') > 10);
  assert(get('intakeLift(300)') === 0);
});
ok('intake closes late (IVC 245°) — valve still open just past BDC', () => {
  assert(get('intakeLift(200)') > 0, 'open past BDC');
  assert(get('intakeLift(244)') > 0);
  assert(get('intakeLift(246)') === 0, 'closed after IVC');
});
ok('exhaust opens late power (EVO 475°), closes early (EVC 25°)', () => {
  assert(get('exhaustLift(500)') > 0);
  assert(get('exhaustLift(360)') === 0);
  assert(get('exhaustLift(610)') > 15, 'near peak at mid-exhaust');
  assert(get('exhaustLift(700)') > 5, 'descending toward EVC');
  assert(get('exhaustLift(26)') === 0);
});
ok('valve overlap: both open around TDC of exhaust→intake', () => {
  assert(get('intakeLift(710)') > 0 && get('exhaustLift(710)') > 0);
  assert(get('intakeLift(10)') > 0 && get('exhaustLift(10)') > 0);
});
ok('lift profiles are non-negative and bounded by MAX_LIFT', () => {
  for (let a = 0; a < 720; a++) {
    const i = get('intakeLift(' + a + ')'), e = get('exhaustLift(' + a + ')');
    assert(i >= 0 && i <= 16.000001 && e >= 0 && e <= 16.000001);
  }
});

// ---------- ignition ----------
ok('spark flash peaks at 358° (2° BTDC)', () => {
  assert(get('sparkFlash(358)') > 0.99);
  assert(get('sparkFlash(300)') === 0);
  assert(get('sparkFlash(420)') === 0);
});
ok('relative power peaks at ~12° advance, falls off both sides', () => {
  const best = get('relativePower(12)');
  assert(best > get('relativePower(0)'));
  assert(best > get('relativePower(24)'));
  assert(best > get('relativePower(-4)'));
});
ok('knock risk rises past 22°, backfire risk rises past late spark', () => {
  assert(get('knockRisk(30)') > 0.4);
  assert(get('knockRisk(10)') === 0);
  assert(get('backfireRisk(-8)') > 0.2);
  assert(get('backfireRisk(10)') === 0);
});

// ---------- pressure & P-V ----------
ok('intake pressure ≈ ambient', () => {
  const p = get('pressure(90)'); assert(Math.abs(p - 1.05) < 1e-9);
});
ok('compression pressure strictly increases toward spark', () => {
  let prev = 0;
  for (let a = 181; a <= 355; a += 10) { const p = get('pressure(' + a + ')'); assert(p > prev); prev = p; }
  assert(prev > 12, 'compression peak in tens of bar');
});
ok('pressure peak lands just after spark (358–400°)', () => {
  const curve = get('PRESSURE_CURVE');
  let arg = 0, max = 0;
  for (let a = 0; a < 720; a++) if (curve[a] > max) { max = curve[a]; arg = a; }
  assert(arg >= 358 && arg <= 400, 'peak at ' + arg);
  assert(max > 40 && max < 120);
});
ok('exhaust blowdown decays monotonically after 540°', () => {
  let prev = 1e9;
  for (let a = 545; a <= 715; a += 15) { const p = get('pressure(' + a + ')'); assert(p < prev); prev = p; }
  assert(prev < 2.2);
});
ok('net P-V loop work is positive', () => {
  assert(get('pvWork()') > 0);
});
ok('higher compression ratio raises peak pressure and net work', () => {
  assert(get('crPressure(13)') > get('crPressure(9)'));
  assert(get('pvWork(13)') > get('pvWork(9)'));
  assert(get('crTemp(13)') > get('crTemp(9)'));
});
ok('diesel CR 18 compresses air past diesel autoignition temperature', () => {
  assert(get('crTemp(18)') > 800);   // > ~533 K diesel AIT
});

// ---------- four-cylinder ----------
ok('pistons 1&4 move together, 2&3 move together (opposite pair)', () => {
  for (const a of [0, 60, 137, 240]) {
    assert(Math.abs(get('pistonTop(wrap720(' + a + ' - CYL_PHASES[0]))') - get('pistonTop(wrap720(' + a + ' - CYL_PHASES[3]))')) < 1e-9);
    assert(Math.abs(get('pistonTop(wrap720(' + a + ' - CYL_PHASES[1]))') - get('pistonTop(wrap720(' + a + ' - CYL_PHASES[2]))')) < 1e-9);
  }
});
ok('firing pulses fire every 180° in cyclic order 1-3-4-2', () => {
  const pulses = [1, 2, 3, 4].map(c => get('firingPulseDeg(' + c + ')'));
  // rotate the timeline so cylinder 1 fires first
  const rel = pulses.map(p => (p - pulses[0] + 720) % 720);
  assert.strictEqual(rel[0], 0);
  assert.strictEqual(rel[2], 180);   // cyl 3
  assert.strictEqual(rel[3], 360);   // cyl 4
  assert.strictEqual(rel[1], 540);   // cyl 2
});
ok('stroke assignment: at θ=0 cylinder 1 fires (power), cylinder 3 compresses→fires next', () => {
  assert(get('cylStroke(1, 372)') === 2);
  assert(get('cylStroke(3, 552)') === 2);
});

// ---------- module registration ----------
run('src/registry.js');
for (const f of fs.readdirSync(path.join(ROOT, 'src/modules')).sort()) run('src/modules/' + f);
ok('exactly eight modules registered in order a→h', () => {
  const ids = get('window.ENGINE_MODULES.map(m=>m.id).join(",")');
  assert.strictEqual(ids, 'anatomy,cycle,timing,spark,pv,cr,compare,multi');
});
ok('every module has a quiz with a valid answer index and ≥4 scenes', () => {
  const n = get('window.ENGINE_MODULES.every(m=>m.quiz && Number.isInteger(m.quiz.ans) && m.quiz.ans>=0 && m.quiz.ans<m.quiz.opts.length && m.scenes.length>=4 && m.scenes.every(s=>s.key && s.narr))');
  assert.strictEqual(n, true);
});
ok('scene count is 39 total', () => {
  assert.strictEqual(get('window.ENGINE_MODULES.reduce((n,m)=>n+m.scenes.length,0)'), 39);
});

console.log('\n' + passed + ' engine checks passed\n');
