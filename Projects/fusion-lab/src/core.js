/* Fusion Lab — single source of truth for the physics math.
 * UI modules read numbers from here instead of re-deriving formulas.
 * Runs in the browser (window.FL.core) and in Node tests (module.exports).
 *
 * Everything here is a zero-dimensional teaching model. Each function states
 * its assumptions; none of it replaces a transport code or a systems code.
 */
(function () {
  'use strict';
  var FL = globalThis.FL = globalThis.FL || {};

  /* ---------- constants (CODATA 2018 / AME 2020 atomic masses) ---------- */
  var U_MEV = 931.49410242;          // MeV per atomic mass unit
  var U_KG = 1.66053906660e-27;      // kg per atomic mass unit
  var E_CHARGE = 1.602176634e-19;    // C
  var KEV_J = 1.602176634e-16;       // J per keV
  var MEV_J = 1.602176634e-13;       // J per MeV
  var MU0 = 4e-7 * Math.PI;          // H/m
  var KEV_KELVIN = 1.160451812e7;    // K per keV
  var YEAR_S = 365.25 * 86400;
  var MASS = {                       // atomic masses, u
    n: 1.00866491595,
    H: 1.00782503224,
    D: 2.01410177812,
    T: 3.01604927790,
    He3: 3.01602932265,
    He4: 4.00260325413,
    Li6: 6.0151228874,
    Li7: 7.0160034366
  };
  var TRITIUM_HALF_LIFE = 12.32;     // years
  var TRITIUM_LAMBDA = Math.LN2 / TRITIUM_HALF_LIFE; // 1/year
  var D_H_RATIO = 155.76e-6;         // VSMOW deuterium / protium atom ratio

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* ---------- reactions ---------- */
  /* Q value (MeV) from the mass defect. Atomic masses are fine because the
   * electron count is the same on both sides of every reaction used here. */
  function qValue(reactants, products) {
    var sum = function (list) { return list.reduce(function (s, k) { return s + MASS[k]; }, 0); };
    return (sum(reactants) - sum(products)) * U_MEV;
  }

  /* D + T -> He4 + n. Two-body, non-relativistic split in the centre-of-mass
   * frame: momenta are equal and opposite, so energy divides inversely to mass. */
  function dtSplit() {
    var total = qValue(['D', 'T'], ['He4', 'n']);
    var neutron = total * MASS.He4 / (MASS.He4 + MASS.n);
    return { total: total, neutron: neutron, alpha: total - neutron, massFraction: total / ((MASS.D + MASS.T) * U_MEV) };
  }
  var DT = dtSplit();

  /* Thermal reactivity <σv> in m³/s, Bosch & Hale, Nucl. Fusion 32 (1992) 611.
   * Valid for 0.2–100 keV (D-T, D-D) and 0.5–190 keV (D-He3); T is the ion
   * temperature in keV. */
  var BH = {
    DT:   { bg: 34.3827, mc2: 1124656, c: [1.17302e-9, 1.51361e-2, 7.51886e-2, 4.60643e-3, 1.35000e-2, -1.06750e-4, 1.36600e-5] },
    DDn:  { bg: 31.3970, mc2: 937814,  c: [5.43360e-12, 5.85778e-3, 7.68222e-3, 0, -2.96400e-6, 0, 0] },
    DDp:  { bg: 31.3970, mc2: 937814,  c: [5.65718e-12, 3.41267e-3, 1.99167e-3, 0, 1.05060e-5, 0, 0] },
    DHe3: { bg: 68.7508, mc2: 1124572, c: [5.51036e-10, 6.41918e-3, -2.02896e-3, -1.91080e-5, 1.35776e-4, 0, 0] }
  };
  function boschHale(p, T) {
    var c = p.c;
    var theta = T / (1 - T * (c[1] + T * (c[3] + T * c[5])) / (1 + T * (c[2] + T * (c[4] + T * c[6]))));
    var xi = Math.pow(p.bg * p.bg / (4 * theta), 1 / 3);
    return c[0] * theta * Math.sqrt(xi / (p.mc2 * T * T * T)) * Math.exp(-3 * xi) * 1e-6; // cm³/s -> m³/s
  }
  function reactivity(kind, TkeV) {
    var T = clamp(TkeV, kind === 'DHe3' ? 0.5 : 0.2, kind === 'DHe3' ? 190 : 100);
    if (kind === 'DD') return boschHale(BH.DDn, T) + boschHale(BH.DDp, T);
    if (!BH[kind]) throw new Error('unknown reaction ' + kind);
    return boschHale(BH[kind], T);
  }

  /* ---------- zero-dimensional power balance ---------- */
  /* Flat profiles, Ti = Te = T, 50:50 D-T. `fuel` is (nD + nT) / ne, i.e. how
   * much of the electron density is still fuel after helium ash and impurities.
   * Returns densities in W/m³. */
  function fusionPowerDensity(ne, TkeV, fuel) {
    var f = fuel == null ? 1 : fuel;
    var nd = 0.5 * f * ne;
    return nd * nd * reactivity('DT', TkeV) * DT.total * MEV_J;
  }
  /* Bremsstrahlung, W/m³ (ne in m⁻³, Te in keV). */
  function bremsstrahlung(ne, TkeV, zeff) {
    return 5.35e-37 * ne * ne * (zeff == null ? 1 : zeff) * Math.sqrt(TkeV);
  }
  /* Steady-state heating needed to hold n, T against transport (energy
   * confinement time tau) and bremsstrahlung, after alpha self-heating. */
  function powerBalance(o) {
    var ne = o.n, T = o.T, tau = o.tau;
    var fuel = o.fuel == null ? 1 : o.fuel, zeff = o.zeff == null ? 1 : o.zeff;
    var volume = o.volume == null ? 1 : o.volume;
    var pFus = fusionPowerDensity(ne, T, fuel);
    var pAlpha = pFus * DT.alpha / DT.total;
    var stored = 1.5 * (ne + fuel * ne) * T * KEV_J;      // electrons + fuel ions, J/m³
    var pTransport = stored / tau;
    var pBrems = bremsstrahlung(ne, T, zeff);
    var pAux = pTransport + pBrems - pAlpha;
    var ignited = pAux <= 0;
    return {
      pFus: pFus * volume, pAlpha: pAlpha * volume, pNeutron: (pFus - pAlpha) * volume,
      pTransport: pTransport * volume, pBrems: pBrems * volume,
      pAux: Math.max(0, pAux) * volume,
      Q: ignited ? Infinity : pFus / pAux,
      ignited: ignited,
      alphaFraction: (pTransport + pBrems) > 0 ? Math.min(1, pAlpha / (pTransport + pBrems)) : 0,
      triple: ne * T * tau                                  // keV·s/m³
    };
  }
  /* Ideal ignition triple product n·T·τ (keV·s/m³): alpha heating alone balances
   * transport losses, pure fuel, no radiation. Minimum sits near 14 keV. */
  function ignitionTriple(TkeV) {
    return 12 * TkeV * TkeV / (reactivity('DT', TkeV) * DT.alpha * 1000);
  }
  /* Triple product needed for a target gain Q under the same idealisation:
   * Pα(1 + 5/Q) = 3nT/τ. */
  function tripleForQ(TkeV, Q) {
    return ignitionTriple(TkeV) / (1 + 5 / Q);
  }

  /* ---------- single particles in a magnetic field ---------- */
  function speed(energyKeV, massU) { return Math.sqrt(2 * energyKeV * KEV_J / (massU * U_KG)); }
  /* Larmor radius (m) with all of the kinetic energy in perpendicular motion. */
  function gyroRadius(energyKeV, massU, charge, B) {
    return massU * U_KG * speed(energyKeV, massU) / (Math.abs(charge) * E_CHARGE * B);
  }
  /* Grad-B plus curvature drift speed (m/s) in a purely toroidal field:
   * v = (E⊥ + 2E∥) / (qBR). For a thermal particle of total kinetic energy E
   * (E⊥ = 2E/3, E∥ = E/3) that is 4E / (3qBR), i.e. 2T / (qBR). */
  function toroidalDrift(energyKeV, charge, B, R) {
    return 4 * energyKeV * 1000 / (3 * Math.abs(charge) * B * R);
  }
  function gyroFrequency(massU, charge, B) { return Math.abs(charge) * E_CHARGE * B / (massU * U_KG) / (2 * Math.PI); }
  function keVToKelvin(T) { return T * KEV_KELVIN; }

  /* ---------- tokamak field geometry ---------- */
  /* Vacuum toroidal field falls as 1/R (Ampère's law around the torus axis). */
  function toroidalField(B0, R0, R) { return B0 * R0 / R; }
  /* Poloidal field at the edge of a circular plasma carrying current Ip (A). */
  function poloidalFieldEdge(IpMA, a) { return MU0 * IpMA * 1e6 / (2 * Math.PI * a); }
  /* Edge safety factor: cylindrical estimate with an elongation correction.
   * Under-reads the real q95 of a shaped, toroidal plasma (ITER: ~3) because
   * triangularity and toroidicity are ignored; the trend with Ip and B holds. */
  function edgeSafetyFactor(o) {
    var kappa = o.kappa == null ? 1 : o.kappa;
    var qCyl = o.a * o.B / (o.R * poloidalFieldEdge(o.IpMA, o.a));
    return qCyl * (1 + kappa * kappa) / 2;
  }
  /* Greenwald density limit, 10^20 m⁻³ (Ip in MA, a in m). */
  function greenwaldDensity(IpMA, a) { return IpMA / (Math.PI * a * a); }

  /* ---------- tritium bookkeeping ---------- */
  /* Tritium burned per GW of fusion power per full-power year (kg). */
  function tritiumBurnKgPerGWyr() {
    var reactions = 1e9 * YEAR_S / (DT.total * MEV_J);
    return reactions * MASS.T * U_KG;
  }
  var BURN_KG_PER_GWYR = tritiumBurnKgPerGWyr();
  function tritiumDecayFraction(years) { return 1 - Math.exp(-TRITIUM_LAMBDA * years); }

  /* Steady flows of a D-T plant, kg of tritium per year unless noted.
   *   pFus MW, availability 0–1, burnFraction = burned / injected,
   *   tbr = tritons bred per triton burned,
   *   tProcessH = residence time of the exhaust loop (hours),
   *   tBreedD = residence time of bred tritium in the blanket + extraction (days). */
  function fuelCycle(o) {
    var burn = BURN_KG_PER_GWYR * (o.pFus / 1000) * o.availability;
    var inject = burn / o.burnFraction;
    var exhaust = inject - burn;
    var bred = o.tbr * burn;
    var loopHoldup = exhaust * (o.tProcessH / 8766);
    var blanketHoldup = bred * (o.tBreedD / 365.25);
    var holdup = loopHoldup + blanketHoldup;
    return {
      burn: burn, inject: inject, exhaust: exhaust, bred: bred,
      burnGramPerDay: burn * 1000 / 365.25,
      injectGramPerDay: inject * 1000 / 365.25,
      loopHoldup: loopHoldup, blanketHoldup: blanketHoldup, holdup: holdup,
      net: bred - burn,
      /* breeding needed just to stand still: replace what burned plus what decays in the holdups */
      tbrRequired: burn > 0 ? 1 + TRITIUM_LAMBDA * holdup / burn : NaN
    };
  }

  /* Three-reservoir inventory model (storage, exhaust loop, blanket), explicit
   * Euler. Total tritium obeys d(total)/dt = (TBR − 1)·burn − λ·total exactly. */
  function simulateInventory(o, years, samples) {
    var tLoop = Math.max(o.tProcessH / 8766, 1e-5), tBlk = Math.max(o.tBreedD / 365.25, 1e-5);
    /* the step must resolve the fastest reservoir, or Euler overshoots it */
    var n = Math.ceil(years * Math.min(60000, Math.max(400, 5 / Math.min(tLoop, tBlk))));
    var dt = years / n, every = Math.max(1, Math.floor(n / (samples || 480)));
    var burnFull = BURN_KG_PER_GWYR * (o.pFus / 1000) * o.availability;
    var S = o.startKg, L = 0, B = 0, burned = 0, bredTotal = 0, decayed = 0, starvedTime = 0;
    var out = { t: [], storage: [], loop: [], blanket: [], total: [], starved: false, doubling: null, minStorage: S, minAt: 0 };
    for (var i = 0; i <= n; i++) {
      var t = i * dt, total = S + L + B;
      if (i % every === 0 || i === n) { out.t.push(t); out.storage.push(S); out.loop.push(L); out.blanket.push(B); out.total.push(total); }
      if (S < out.minStorage) { out.minStorage = S; out.minAt = t; }
      if (out.doubling == null && t > out.minAt && t > 0.05 && S >= 2 * o.startKg) out.doubling = t;
      if (i === n) break;
      var burn = burnFull, inject = burn / o.burnFraction;
      if (inject * dt > S) { var k = Math.max(0, S / (inject * dt)); burn *= k; inject *= k; starvedTime += (1 - k) * dt; }
      var fromLoop = L / tLoop, fromBlk = B / tBlk;
      var dS = fromLoop + fromBlk - inject - TRITIUM_LAMBDA * S;
      var dL = (inject - burn) - fromLoop - TRITIUM_LAMBDA * L;
      var dB = o.tbr * burn - fromBlk - TRITIUM_LAMBDA * B;
      decayed += TRITIUM_LAMBDA * total * dt; burned += burn * dt; bredTotal += o.tbr * burn * dt;
      S = Math.max(0, S + dS * dt); L = Math.max(0, L + dL * dt); B = Math.max(0, B + dB * dt);
    }
    out.burned = burned; out.bred = bredTotal; out.decayed = decayed; out.final = S + L + B;
    out.starvedFraction = starvedTime / years; out.starved = out.starvedFraction > 0.002;
    return out;
  }

  /* ---------- breeding ---------- */
  var BREED = {
    li6: qValue(['Li6', 'n'], ['T', 'He4']),              // +4.78 MeV, any neutron energy
    li7: qValue(['Li7', 'n'], ['T', 'He4', 'n'])          // −2.47 MeV, needs a fast neutron
  };

  /* ---------- resources and energy density ---------- */
  /* Grams of deuterium in one cubic metre of fresh water at the VSMOW ratio. */
  function deuteriumGramsPerM3(waterKgPerM3) {
    var molH = 2 * (waterKgPerM3 == null ? 1000 : waterKgPerM3) * 1000 / 18.01528;
    return molH * D_H_RATIO / (1 + D_H_RATIO) * MASS.D;
  }
  /* Energy released by fusing one gram of a 50:50 D-T mix (J). */
  function dtEnergyPerGram() { return DT.total * MEV_J / ((MASS.D + MASS.T) * U_KG * 1000); }

  /* ---------- power plant accounting ---------- */
  /* pFus MW; Q = pFus / pAux (plasma gain); M = blanket energy multiplication
   * (exothermic Li-6 capture adds to the 14.1 MeV neutron); etaTh = thermal to
   * electric; etaHeat = wall-plug efficiency of the heating systems; fBop =
   * fraction of gross electric used by cryogenics, pumps and the tritium plant. */
  function plantBalance(o) {
    var pAux = o.pFus / o.Q;
    var pNeutron = o.pFus * DT.neutron / DT.total, pAlpha = o.pFus - pNeutron;
    var pThermal = o.M * pNeutron + pAlpha + pAux;
    var gross = o.etaTh * pThermal;
    var heatingElectric = pAux / o.etaHeat;
    var bop = o.fBop * gross;
    var recirc = heatingElectric + bop;
    return {
      pAux: pAux, pNeutron: pNeutron, pAlpha: pAlpha, pThermal: pThermal, gross: gross,
      heatingElectric: heatingElectric, bop: bop, recirc: recirc, net: gross - recirc,
      qEng: gross / recirc, recircFraction: recirc / gross, waste: pThermal - gross
    };
  }
  /* Average neutron wall load, MW/m². */
  function neutronWallLoad(pFusMW, wallAreaM2) { return pFusMW * DT.neutron / DT.total / wallAreaM2; }

  /* ---------- plasma shape used by both the physics and the 3D model ---------- */
  /* Miller parameterisation of a D-shaped flux surface. rho in 0..1. */
  function miller(shape, rho, theta) {
    var r = shape.a * rho, d = shape.delta * rho;
    return {
      R: shape.R0 + (shape.shift || 0) * (1 - rho * rho) + r * Math.cos(theta + d * Math.sin(theta)),
      Z: (shape.Z0 || 0) + shape.kappa * r * Math.sin(theta)
    };
  }
  /* Plasma volume by Pappus (numerical integral of the cross-section). */
  function plasmaVolume(shape, n) {
    n = n || 720;
    var vol = 0;
    for (var i = 0; i < n; i++) {
      var p = miller(shape, 1, 2 * Math.PI * i / n), q = miller(shape, 1, 2 * Math.PI * (i + 1) / n);
      vol += Math.PI * (p.R * p.R + p.R * q.R + q.R * q.R) / 3 * (q.Z - p.Z);
    }
    return Math.abs(vol);
  }

  var api = {
    U_MEV: U_MEV, U_KG: U_KG, KEV_J: KEV_J, MEV_J: MEV_J, MU0: MU0, YEAR_S: YEAR_S, MASS: MASS,
    TRITIUM_HALF_LIFE: TRITIUM_HALF_LIFE, TRITIUM_LAMBDA: TRITIUM_LAMBDA, D_H_RATIO: D_H_RATIO,
    DT: DT, BREED: BREED, BURN_KG_PER_GWYR: BURN_KG_PER_GWYR,
    clamp: clamp, qValue: qValue, dtSplit: dtSplit, reactivity: reactivity,
    fusionPowerDensity: fusionPowerDensity, bremsstrahlung: bremsstrahlung, powerBalance: powerBalance,
    ignitionTriple: ignitionTriple, tripleForQ: tripleForQ,
    speed: speed, toroidalDrift: toroidalDrift, gyroRadius: gyroRadius, gyroFrequency: gyroFrequency, keVToKelvin: keVToKelvin,
    toroidalField: toroidalField, poloidalFieldEdge: poloidalFieldEdge, edgeSafetyFactor: edgeSafetyFactor,
    greenwaldDensity: greenwaldDensity,
    tritiumBurnKgPerGWyr: tritiumBurnKgPerGWyr, tritiumDecayFraction: tritiumDecayFraction,
    fuelCycle: fuelCycle, simulateInventory: simulateInventory,
    deuteriumGramsPerM3: deuteriumGramsPerM3, dtEnergyPerGram: dtEnergyPerGram,
    plantBalance: plantBalance, neutronWallLoad: neutronWallLoad,
    miller: miller, plasmaVolume: plasmaVolume
  };
  FL.core = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
