/* Four-stroke engine core model — pure functions, no DOM.

   Geometry, kinematics, valve timing, ignition and the cylinder
   pressure / P-V model for the teaching lab. Dimensions are drawing
   units; pressures are illustrative (gamma = 1.3), not engineering data.
*/
'use strict';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap720 = deg => ((deg % 720) + 720) % 720;

// ---------- crank-slider kinematics ----------
const GEO = { CX: 450, BORE: 62, DECK: 165, CLEAR: 18, PISTON_H: 56, R: 75, L: 190 };
GEO.CRANK_Y = GEO.DECK + GEO.CLEAR + GEO.PISTON_H / 2 + GEO.R + GEO.L;
const SWEPT = 2 * GEO.R;                    // piston travel, drawing units

function pistonDisplacement(deg) {
  const t = deg * D2R;
  return GEO.R * (1 - Math.cos(t)) + GEO.L - Math.sqrt(GEO.L * GEO.L - Math.pow(GEO.R * Math.sin(t), 2));
}
function pistonTop(deg) { return GEO.DECK + GEO.CLEAR + pistonDisplacement(deg); }
function crankPin(deg) {
  const t = deg * D2R;
  return { x: GEO.CX + GEO.R * Math.sin(t), y: GEO.CRANK_Y - GEO.R * Math.cos(t) };
}
function conrodLength(deg) {
  const p = crankPin(deg), pinY = pistonTop(deg) + GEO.PISTON_H / 2;
  return Math.hypot(GEO.CX - p.x, pinY - p.y);
}

// ---------- valve timing (simplified, with overlap & IVC) ----------
function liftProfile(deg, open, close) {
  let d = deg - open; if (d < 0) d += 720;
  const span = (close - open + 720) % 720;
  if (d > span) return 0;
  return Math.sin(Math.PI * d / span);
}
const MAX_LIFT = 16;
const INTAKE_OPEN = 695, INTAKE_CLOSE = 245;   // IVC at 245° (late intake closing)
const EXHAUST_OPEN = 475, EXHAUST_CLOSE = 25;  // EVO late power, EVC early intake
const intakeLift = deg => liftProfile(wrap720(deg), INTAKE_OPEN, INTAKE_CLOSE) * MAX_LIFT;
const exhaustLift = deg => liftProfile(wrap720(deg), EXHAUST_OPEN, EXHAUST_CLOSE) * MAX_LIFT;
const overlapPeak = 720;                      // both valves near peak of their tails here

// ---------- spark & combustion ----------
const SPARK_AT = 358;                         // 2° before TDC of power stroke
function sparkFlash(deg, spark = SPARK_AT) {
  const a = wrap720(deg), d = a - spark;
  return (d > -18 && d < 44) ? clamp(1 - Math.abs(d) / 16, 0, 1) : 0;
}
function burnFraction(deg, spark = SPARK_AT) {
  const a = wrap720(deg);
  if (a < spark - 3 || a > spark + 102) return 0;
  return clamp((a - (spark - 3)) / 105, 0, 1);
}

// ---------- cylinder pressure model (bar, gamma = 1.3) ----------
const GAMMA = 1.3;
function chamberVol(deg, cr) {
  const clear = SWEPT / (cr - 1);
  return clear + pistonDisplacement(deg);
}
function pressure(deg, cr = 11.7, spark = SPARK_AT) {
  const a = wrap720(deg);
  const v = chamberVol(a, cr);
  if (a <= 180) return 1.05;                                  // intake ≈ ambient
  if (a <= spark) return Math.pow(chamberVol(180, cr) / v, GAMMA);  // compression
  if (a <= 540) {                                             // combustion + expansion
    const P0 = Math.pow(chamberVol(180, cr) / chamberVol(spark, cr), GAMMA);
    const Ps = P0 * (1 + 3.2 * clamp((a - spark) / 22, 0, 1));
    return Ps * Math.pow(chamberVol(spark, cr) / v, GAMMA) * (1 - clamp((a - (spark + 102)) / 80, 0, 1) * 0.35);
  }
  const pend = Math.pow(chamberVol(180, cr) / chamberVol(540, cr), GAMMA) * 3.0;  // blowdown
  return 1.4 + (pend - 1.4) * Math.exp(-(a - 540) / 45);
}
const PRESSURE_CURVE = Array.from({ length: 720 }, (_, a) => pressure(a));

// Net indicated work of the closed P-V loop (∮ P dV, arbitrary units).
function pvWork(cr = 11.7, spark = SPARK_AT) {
  let w = 0;
  for (let a = 1; a <= 720; a++) w += pressure(a, cr, spark) * (chamberVol(a, cr) - chamberVol(a - 1, cr));
  return w;
}
function pvPoint(deg, cr = 11.7, spark = SPARK_AT) {
  return { v: chamberVol(wrap720(deg), cr), p: pressure(wrap720(deg), cr, spark) };
}

// ---------- compression ratio ----------
function crPressure(cr) { return Math.pow(chamberVol(180, cr) / chamberVol(SPARK_AT, cr), GAMMA); }
function crTemp(cr) { return 340 * Math.pow(cr, GAMMA - 1); }   // kelvin, ambient 340 K
const GASOLINE_MAX_CR = 13.5;                                   // knock-limited, teaching figure

// ---------- ignition advance ----------
// advance = degrees before TDC of power stroke (spark at 360 - advance).
function sparkAngle(advance) { return 360 - advance; }
function relativePower(advance) { return Math.exp(-Math.pow(advance - 12, 2) / 320); }
function knockRisk(advance) { return clamp((advance - 22) / 16, 0, 1); }
function backfireRisk(advance) { return clamp((-advance - 4) / 14, 0, 1); }   // spark after TDC-ish

// ---------- four-cylinder inline engine ----------
// Firing order 1-3-4-2; crank throws put pistons 1&4 and 2&3 together.
const CYL_PHASES = [0, 540, 180, 360];       // cycle offsets for cylinders 1..4
const FIRING_ORDER = [1, 3, 4, 2];
function cylStroke(cyl, angle) { return strokeIndex(wrap720(angle - CYL_PHASES[cyl - 1])); }
function firingPulseDeg(cyl) { return wrap720(CYL_PHASES[cyl - 1] + 372); }

// ---------- strokes ----------
const STROKES = [
  ['进气', 'Intake', '活塞下行，进气门打开（排气门仍有少量叠开），新鲜混合气被吸入气缸。'],
  ['压缩', 'Compression', '进气门在压缩初段才关闭（晚关利用惯性多充气），随后两气门全关，活塞上行把混合气压到约 1/11 容积。'],
  ['做功', 'Power', '点火稍早于上止点，燃烧气体膨胀推动活塞下行——唯一输出动力的冲程。'],
  ['排气', 'Exhaust', '排气门打开，废气先自动泄出（blowdown），再由上行活塞推出气缸。'],
];
function strokeIndex(deg) { return Math.floor(wrap720(deg) / 180) % 4; }
