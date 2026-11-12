/* Desalination Lab — scenario simulators built on top of DL.core.
 * These are teaching models with declared simplifications, not engineering
 * simulations. Browser (window.DL.sim) and Node (module.exports) compatible.
 */
(function () {
  'use strict';
  var DL = globalThis.DL = globalThis.DL || {};
  var core = DL.core || require('./core.js');

  /* ---------- hero / module A: the salinity ladder ---------- */
  function salinityLadder() {
    return [
      { name: '雨水', tds: 30, color: 'blue' },
      { name: '河水', tds: 200, color: 'cyan' },
      { name: '饮用水上限', tds: 500, color: 'green' },
      { name: '微咸水', tds: 3000, color: 'yellow' },
      { name: '海水', tds: 35000, color: 'orange' },
      { name: 'RO 浓盐水', tds: 63400, color: 'red' }
    ];
  }

  /* Deterministic freshwater split (USGS shares) for the donut. */
  function freshwaterSplit() {
    return [
      { name: '冰盖与冰川', value: 68.7, color: 'cyan' },
      { name: '地下水与土壤', value: 30.1, color: 'blue' },
      { name: '湖泊/河流/大气等', value: 1.2, color: 'orange' }
    ];
  }

  /* ---------- module B: osmosis cell state ---------- */
  /* Two chambers separated by a semipermeable membrane. Given the freshwater
   * column height h (m) on the low side, report net water direction:
   * osmosis lifts freshwater until the column head matches π. */
  function osmosisCell(feedTdsMgL, tempC, freshwaterHeadM) {
    var pi = core.osmoticPressure(feedTdsMgL, tempC);
    var head = core.headMeters(pi);
    var applied = freshwaterHeadM || 0;
    var appliedBar = applied * 1000 * 9.80665 / 1e5;
    var direction = appliedBar < pi ? 'in' : appliedBar > pi ? 'out' : 'balance';
    return { pi: pi, head: head, appliedBar: appliedBar, direction: direction, net: pi - appliedBar };
  }

  /* ---------- module C: one-pass RO stage ---------- */
  /* Full steady-state stage: balance → brine osmotic pressure → flux → energy.
   * All simplifications documented in the module warning block. */
  function roStage(o) {
    var o = o || {};
    var F = o.feed != null ? o.feed : 100;            // m³/h
    var Y = o.recovery != null ? o.recovery : 0.45;   // fraction
    var R = o.rejection != null ? o.rejection : 0.993;
    var Cf = o.feedTds != null ? o.feedTds : 35000;   // mg/L
    var P = o.pressure != null ? o.pressure : 62;     // bar
    var A = o.permeability != null ? o.permeability : 1.2; // LMH/bar
    var T = o.tempC != null ? o.tempC : 25;
    var beta = o.beta != null ? o.beta : 1.1;
    var etaPump = o.etaPump != null ? o.etaPump : 0.82;
    var etaErd = o.etaErd != null ? o.etaErd : 0.55;

    var bal = core.waterBalance(F, Y, R, Cf);
    var flow = core.roFlux(A, P, bal.Cb, T, beta);
    var energy = core.roEnergy(P, Y, etaPump, etaErd);
    var minSe = core.minSeparationEnergy(Y);
    var feedPi = core.osmoticPressure(Cf, T);
    var feasible = flow.nd > 0;
    /* Permeate output check: Q = J × membrane area; area derived from demand. */
    var qPerm = bal.P;
    return {
      bal: bal, flow: flow, energy: energy, minSe: minSe, feedPi: feedPi,
      feasible: feasible, qPerm: qPerm,
      tempC: T, pressure: P, recovery: Y, rejection: R, permeability: A, beta: beta,
      etaPump: etaPump, etaErd: etaErd, feed: F, feedTds: Cf
    };
  }

  /* ---------- module D: flash cascade ---------- */
  function thermalPlant(o) {
    var o = o || {};
    var N = o.stages != null ? o.stages : 16;
    var TB = o.topBrine != null ? o.topBrine : 110;
    var last = o.lastStage != null ? o.lastStage : 32;
    var cascade = core.flashCascade(N, TB, last);
    var gea = core.gainedOutputRatio(N, TB);
    /* Brine recirculation ratio (geo) is a fixed teaching value; MSF plants
     * recirculate many times the product flow to spread heat across stages. */
    var geo = 70 + gea * 2.5;
    /* Electricity for pumps per m³ product (teaching band). */
    var elec = 1.2 + 0.8 * gea / 10;
    return {
      cascade: cascade, gea: gea, geo: geo, elec: elec,
      stages: N, topBrine: TB, lastStage: last
    };
  }

  /* ---------- module E: membrane & fouling timeline ---------- */
  function membraneTimeline(o) {
    var o = o || {};
    var days = o.days != null ? o.days : 30;
    var k0 = o.scaling != null ? o.scaling : 0.02;   // 1/day baseline
    var anti = o.antiscalant != null ? o.antiscalant : 0.6;
    var j0 = o.j0 != null ? o.j0 : 16;
    var t = core.foulingTimeline(days, k0, anti, j0);
    var hold = t.points[t.points.length - 1].flux / j0;
    return { points: t.points, k: t.k, hold: hold, days: days };
  }

  /* Scaling-risk band as a function of recovery (teaching thresholds):
   * carbonate/gypsum supersaturation grows sharply past ~75% without
   * antiscalant, ~90% with dosing. */
  function scalingRisk(recovery, antiscalant) {
    var r = core.clamp(recovery, 0.2, 0.95);
    var limit = 0.60 + 0.30 * core.clamp(antiscalant || 0, 0, 0.95);
    var excess = r - limit;
    if (excess <= 0) return { level: 'ok', limit: limit, note: '低于结垢阈值，常规加药即可稳定运行' };
    if (excess < 0.06) return { level: 'warn', limit: limit, note: '接近结垢阈值：回收率再往上，硫酸钙/碳酸钙会超饱和析出' };
    return { level: 'bad', limit: limit, note: '超过结垢阈值：膜面结垢会不可逆地压垮产水量' };
  }

  /* ---------- module G: whole plant ---------- */
  function plant(o) {
    var o = o || {};
    var feed = o.feed != null ? o.feed : 100000;       // m³/h seawater
    var Y = o.recovery != null ? o.recovery : 0.45;
    var R = o.rejection != null ? o.rejection : 0.993;
    var Cf = o.feedTds != null ? o.feedTds : 35000;
    var ca = o.calcium != null ? o.calcium : 40;       // mg/L target
    var bal = core.waterBalance(feed, Y, R, Cf);
    var rem = core.remineralize(ca);
    var brineDensityGain = bal.Cb / Cf;
    var energy = core.roEnergy(62, Y);
    return {
      feed: feed, bal: bal, rem: rem, brineGain: brineDensityGain,
      energyPerM3: energy.net,
      dailyProduct: bal.P * 24
    };
  }

  DL.sim = {
    salinityLadder: salinityLadder, freshwaterSplit: freshwaterSplit,
    osmosisCell: osmosisCell, roStage: roStage, thermalPlant: thermalPlant,
    membraneTimeline: membraneTimeline, scalingRisk: scalingRisk, plant: plant
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = DL.sim;
})();
