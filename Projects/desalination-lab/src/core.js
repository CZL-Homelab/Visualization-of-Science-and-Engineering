/* Desalination Lab — the single source of truth for all physics math.
 * Modules must not re-derive formulas; they read them from here.
 * Runs in the browser (window.DL.core) and in Node tests (module.exports).
 */
(function () {
  'use strict';
  var DL = globalThis.DL = globalThis.DL || {};

  /* ---------- constants ---------- */
  var R_GAS = 8.314462618;            // J/(mol·K)
  var MW_NACL = 58.443;               // g/mol
  var BAR_PER_R = 0.0831446;          // bar·L/(mol·K)
  var I_EFF_NACL = 1.8;               // effective van 't Hoff factor for NaCl
                                      // in seawater (osmotic coefficient ~0.9)
  var G = 9.80665;                    // m/s²
  var K_TDS_EC = 0.64;                // mg/L TDS per µS/cm (empirical seawater factor)
  var ANCHOR_MIN_SE = 1.06;           // kWh/m³, literature minimum separation energy
                                      // for SWRO at 50% recovery (see reference.js)

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function round(v, d) { var p = Math.pow(10, d == null ? 2 : d); return Math.round((v + 0) * p) / p; }
  function isValidNum(v) { return typeof v === 'number' && isFinite(v); }

  /* ---------- water properties ---------- */
  /* Solution density from TDS (mg/L). Linear approximation: +0.706 kg/m³ per g/L.
   * At 35 g/L this gives ~1024.7 kg/m³, matching published seawater density. */
  function density(tdsMgL) { return 1000 + 0.706 * tdsMgL / 1000; }

  /* NaCl-equivalent molarity (mol/L) from TDS in mg/L. */
  function molarity(tdsMgL) { return tdsMgL / 1000 / MW_NACL; }

  /* van 't Hoff osmotic pressure in bar: π = i_eff · C · R · T.
   * Simplification: NaCl-equivalent, ideal-dilute solution with an effective
   * factor of 1.8 (captures the seawater osmotic coefficient, not ion pairing). */
  function osmoticPressure(tdsMgL, tempC) {
    var T = (tempC == null ? 25 : tempC) + 273.15;
    return I_EFF_NACL * molarity(tdsMgL) * BAR_PER_R * T;
  }

  /* Static head (metres of freshwater column) equivalent to a pressure in bar. */
  function headMeters(pressureBar) {
    return pressureBar * 1e5 / (density(0) * G);
  }

  /* Empirical conductivity (µS/cm) from TDS; the ratio k ≈ 0.64 is the
   * common seawater calibration factor. */
  function conductivity(tdsMgL) { return tdsMgL / K_TDS_EC; }

  /* ---------- mass balance ---------- */
  /* Steady-state single-stage balance.
   * F feed (m³), Y recovery fraction (P = Y·F), R salt rejection fraction,
   * Cf feed TDS (mg/L). Returns permeate/brine flows and concentrations.
   * Identity enforced: F·Cf = P·Cp + B·Cb. */
  function waterBalance(F, Y, R, Cf) {
    Y = clamp(Y, 0, 0.98);
    R = clamp(R, 0, 0.999);
    var P = F * Y;
    var B = F - P;
    var Cp = Cf * (1 - R);
    var Cb = B > 0 ? (F * Cf - P * Cp) / B : Cf / Y;
    return { F: F, P: P, B: B, Cp: Cp, Cb: Cb, Y: Y, R: R };
  }

  /* ---------- reverse osmosis ---------- */
  /* Permeate flux J (L/m²·h) = A · NDN, with NDN = P − β·π_brine (permeate
   * osmotic pressure is negligible). β is the concentration-polarisation
   * factor on the brine side. A is the membrane permeability (LMH/bar). */
  function roFlux(A, appliedBar, brineTdsMgL, tempC, beta) {
    beta = beta == null ? 1.1 : beta;
    var piB = osmoticPressure(brineTdsMgL, tempC);
    var nd = appliedBar - beta * piB;
    return { nd: nd, flux: A * Math.max(0, nd), piBrine: piB };
  }

  /* Specific energy of an RO train in kWh per m³ of permeate:
   *   E = ΔP / (3.6e6·η_pump·Y) − (1−Y)·ΔP·η_erd / 3.6e6   (ΔP in Pa)
   * First term: high-pressure pump work spread over permeate. Second term:
   * energy recovered from the brine stream by an energy-recovery device. */
  function roEnergy(appliedBar, recovery, etaPump, etaErd) {
    var dp = appliedBar * 1e5;
    etaPump = etaPump == null ? 0.82 : etaPump;
    etaErd = etaErd == null ? 0.55 : etaErd;
    var hp = dp / (3.6e6 * etaPump * clamp(recovery, 0.05, 0.98));
    var recovered = (1 - recovery) * dp * etaErd / 3.6e6;
    return { gross: hp, recovered: recovered, net: Math.max(0.15, hp - recovered) };
  }

  /* Thermodynamic minimum separation energy, teaching approximation.
   * Anchored to the literature value ≈ 1.06 kWh/m³ at 50% recovery for
   * 35 g/L seawater; below 50% it follows the ideal-mixing entropy term,
   * above 50% it grows linearly (concentrating brine costs more).
   * Labelled as an approximation everywhere it is displayed. */
  function minSeparationEnergy(recovery) {
    var Y = clamp(recovery, 0.01, 0.95);
    var entropy = -(Y * Math.log(Y) + (1 - Y) * Math.log(1 - Y));
    if (Y <= 0.5) return ANCHOR_MIN_SE * entropy / (0.5 * Math.LN2 * 2);
    return ANCHOR_MIN_SE * (1 + 2.4 * (Y - 0.5));
  }

  /* ---------- thermal distillation (teaching flash-cascade model) ---------- */
  /* GEA (gained output ratio) teaching correlation, monotonic in stage count
   * and top-brine temperature; tuned to land in the 3–9 band of published
   * MSF plants. NOT a substitute for a thermal design calculation. */
  function gainedOutputRatio(stages, topBrineC) {
    stages = clamp(stages, 4, 30);
    topBrineC = clamp(topBrineC, 75, 130);
    return clamp((topBrineC - 92) / 25 + 0.35 + 0.22 * stages, 1, 12);
  }

  /* Stage temperature cascade from the top brine temperature down to the
   * last-stage temperature; returns per-stage flash temperatures and the
   * average per-stage drop (which includes the brine-temperature-elevation
   * loss conceptually, without a BPE model). */
  function flashCascade(stages, topBrineC, lastStageC) {
    stages = clamp(stages, 4, 30);
    lastStageC = lastStageC == null ? 32 : lastStageC;
    var top = clamp(topBrineC, lastStageC + 10, 130);
    var dT = (top - lastStageC) / stages;
    var out = [];
    for (var i = 0; i < stages; i++) {
      out.push({ stage: i + 1, temp: top - i * dT, flash: dT });
    }
    return { stages: out, dT: dT, top: top, last: lastStageC };
  }

  /* ---------- membrane fouling (teaching exponential decay) ---------- */
  /* Flux over t days: J(t) = J0 · exp(−k·t), k reduced by antiscalant dose.
   * k0 = 0.02 /day baseline scaling tendency for hard seawater. */
  function foulingTimeline(days, k0, antiscalant, j0) {
    var k = (k0 == null ? 0.02 : k0) * (1 - clamp(antiscalant == null ? 0.5 : antiscalant, 0, 0.95));
    var out = [];
    for (var d = 0; d <= days; d++) {
      out.push({ day: d, flux: (j0 == null ? 16 : j0) * Math.exp(-k * d) });
    }
    return { points: out, k: k };
  }

  /* ---------- remineralisation ---------- */
  /* Calcite-dissolution dosing: adding Ca (mg/L) raises alkalinity expressed
   * as CaCO3 by the equivalent-weight ratio (50/20.04 per mg Ca). */
  function remineralize(caMgL) {
    var alkalinity = caMgL * 50 / 20.04;
    /* pH teaching curve: CO2-stripped soft water sits near 6.2; alkalinity
     * near 100 mg/L as CaCO3 buffers to ~8.3 (open CO2 system). */
    var ph = 6.2 + 2.1 * clamp(alkalinity / 100, 0, 1);
    return { ca: caMgL, alkalinity: alkalinity, ph: ph };
  }

  DL.core = {
    R_GAS: R_GAS, MW_NACL: MW_NACL, I_EFF_NACL: I_EFF_NACL, K_TDS_EC: K_TDS_EC, ANCHOR_MIN_SE: ANCHOR_MIN_SE,
    clamp: clamp, round: round, isValidNum: isValidNum,
    density: density, molarity: molarity, osmoticPressure: osmoticPressure,
    headMeters: headMeters, conductivity: conductivity,
    waterBalance: waterBalance, roFlux: roFlux, roEnergy: roEnergy,
    minSeparationEnergy: minSeparationEnergy,
    gainedOutputRatio: gainedOutputRatio, flashCascade: flashCascade,
    foulingTimeline: foulingTimeline, remineralize: remineralize
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DL.core;
})();
