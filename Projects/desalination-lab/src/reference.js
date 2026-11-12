/* Desalination Lab — dated reference constants and sources.
 * Every number shown as a "literature value" must be read from here, not
 * hard-coded in a module. Update asOf, the value and the source link together.
 * Runs in the browser (window.DL.reference) and in Node tests.
 */
(function () {
  'use strict';
  var DL = globalThis.DL = globalThis.DL || {};

  var REF = {
    asOf: '2026-11-10',

    /* Earth's water distribution (USGS Water Science School). */
    earthWater: {
      freshPct: 2.5,                 // % of all Earth water that is freshwater
      icePct: 68.7,                  // % of freshwater locked in ice caps, glaciers, permanent snow
      groundwaterPct: 30.1,          // % of freshwater in groundwater and soil moisture
      surfaceOtherPct: 1.2,          // remainder: lakes, rivers, atmosphere, biota
      oceanSalinityGL: 35,           // average ocean salinity g/kg (~3.5%)
      oceanPct: 96.5                 // % of Earth's water held by oceans and inland seas
    },

    /* TDS reference bands (mg/L). River/rain values are typical textbook
     * ranges; the 500 mg/L line is an aesthetic/acceptability value, not a
     * WHO health-based guideline (WHO: TDS is "not of health concern"). */
    tdsBands: [
      { name: '雨水 / Rainwater', lo: 10, hi: 100 },
      { name: '河水 / River water', lo: 100, hi: 500 },
      { name: '微咸水 / Brackish', lo: 1000, hi: 10000 },
      { name: '海水 / Seawater', lo: 33000, hi: 37000 },
      { name: 'RO 浓盐水 / RO brine', lo: 52000, hi: 70000 }
    ],
    drinkingTdsAesthetic: 500,

    /* Global industry snapshot (IDA milestone reporting; 2024 total installed
     * capacity crossed 100 million m³/day; >20,000 plants in 2020). */
    stats: [
      { label: '全球装机产能 / World capacity', value: '>1 亿', unit: 'm³/天 (2024)', note: 'IDA 里程碑口径' },
      { label: '海水淡化厂数量 / Plants', value: '>20,000', unit: '座 (2020)', note: '含各种规模' },
      { label: '反渗透装机占比 / RO share', value: '约 60–70%', unit: '按产能', note: 'RO 为主流工艺' },
      { label: '理论最小分离功 / Min. separation', value: '≈1.06', unit: 'kWh/m³', note: 'SWRO · 50% 回收率' }
    ],

    /* Specific energy bands in kWh per m³ of product water (GED-style,
     * electricity-equivalent where thermal energy is converted). These are
     * literature ranges for teaching comparison, not plant guarantees. */
    energy: {
      theoreticalMin: 1.06,
      swro: { lo: 2.5, hi: 4.5, best: 2.5, typical: 3.7 },
      med: { lo: 3.0, hi: 6.0, typical: 4.5 },
      msf: { lo: 7.5, hi: 11.0, typical: 9.0 },
      solarStill: { lo: 0, hi: 0.4, typical: 0.1, note: '燃料为零，但土地与产水密度极低' }
    },

    /* Cost bands (USD per m³, large municipal plants, rough literature ranges
     * from industry reporting; energy price and financing dominate). */
    cost: { swro: [0.3, 0.8], msf: [1.0, 2.2], med: [0.8, 1.6] },

    /* Operating bands (teaching ranges used across modules). */
    operating: {
      swroPressureBar: [55, 72],
      swroRecovery: [0.35, 0.45],
      swroRejection: [0.990, 0.998],
      permeateFluxLMH: [12, 18],
      msfTopBrineC: [90, 120],
      msfStages: [8, 24],
      seawaterTdsMgL: 35000,
      seawaterTempC: 25
    },

    comparison: [
      {
        dimension: 'TDS / 盐度口径',
        a: 'TDS（mg/L）：蒸干后溶解性固体总质量；本页面按 NaCl 等效做渗透压估算。',
        b: '绝对盐度（g/kg, psu）与 TDS 近似但不等价；离子组成（Mg²⁺、SO₄²⁻ 等）会影响实际渗透压与结晶倾向。'
      },
      {
        dimension: '回收率 vs 截留率',
        a: '回收率 Y = 产水量 / 进水量（海水 RO 通常 35–45%）。',
        b: '截留率 R = 1 − 产水含盐 / 进水含盐（膜片标称 99.3–99.8%）。两者都高≠省水省能，Y 越高浓水越浓、结垢风险越大。'
      },
      {
        dimension: '能耗口径',
        a: '比能耗 SE（kWh/m³ 产水）通常指电耗当量 GED：含高压泵、预处理、后处理与辅助系统。',
        b: '热法（MSF/MED）以热能为主，折算成电耗当量后才与 RO 同轴比较；不同文献的折算系数不同，对比时必须注明口径。'
      },
      {
        dimension: '饮用水 TDS 标准',
        a: 'WHO：TDS「不作为健康基准制定限值」（no health-based guideline）。',
        b: '500 mg/L 是常见的口感/感官可接受参考值（如美国 EPA 二类辅助标准）；脱盐产水通常 100–300 mg/L，需再矿化。'
      },
      {
        dimension: '浓盐水边界',
        a: '浓盐水约为进水盐度的 1.7–2.2 倍（取决于回收率），经扩散器排海，近场盐度羽流需要环境评估。',
        b: '零液体排放（ZLD）是工业场景选项，能耗与成本显著更高；本页面的排放模型只做质量守恒教学。'
      },
      {
        dimension: '数据核对日期',
        a: '产能、装机份额与能耗区间按 {{ASOF}} 可核对的公开资料整理。',
        b: '行业报告逐年更新；引用本页面数字时请同时注明核对日期与来源。'
      }
    ],

    sources: [
      { label: 'USGS · How Much Water is There on Earth?', url: 'https://www.usgs.gov/water-science-school/science/how-much-water-there-earth', note: '地球水分布与淡水占比' },
      { label: 'USGS · Where is Earth\'s Water?', url: 'https://www.usgs.gov/water-science-school/science/where-earths-water', note: '淡水在冰川/地下水/地表的分布' },
      { label: 'WHO · TDS background document', url: 'https://www.who.int/docs/default-source/wash-documents/wash-chemicals/total-dissolved-solids-background-document.pdf', note: 'TDS 无健康基准限值口径' },
      { label: 'EPA · Secondary drinking water standards', url: 'https://www.epa.gov/dwstandardsregulations', note: 'TDS 500 mg/L 感官（非强制）标准' },
      { label: 'IDA · International Desalination Association', url: 'https://idawater.org', note: '全球装机与行业口径' },
      { label: 'UF/IFAS · Desalination Systems & Environmental Impacts (SS746)', url: 'https://ask.ifas.ufl.edu/publication/SS746', note: '工艺能耗与规模综述' },
      { label: 'Purdue MEPubs · Wave-powered batch RO (引理论最小分离功)', url: 'https://docs.lib.purdue.edu/cgi/viewcontent.cgi?article=1044&context=mepubs', note: 'SWRO 50% 回收率最小分离功 ≈1.06 kWh/m³' },
      { label: 'Elevation-distributed multistage RO (d-nb 论文全文)', url: 'https://d-nb.info/1286073545/34', note: '理论最小分离功 1.07 kWh/m³ 口径' }
    ]
  };

  /* fill the asOf placeholder inside the comparison table */
  REF.comparison[REF.comparison.length - 1].a =
    REF.comparison[REF.comparison.length - 1].a.replace('{{ASOF}}', REF.asOf);

  DL.reference = REF;
  if (typeof module !== 'undefined' && module.exports) module.exports = REF;
})();
