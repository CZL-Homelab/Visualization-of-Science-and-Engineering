/* Fusion Lab — reference numbers, with where they come from.
 *
 * Programme dates and design values drift; every entry is tied to CHECKED.
 * Derived physics numbers are computed in core.js, not typed here.
 */
(function () {
  'use strict';
  var FL = globalThis.FL = globalThis.FL || {};

  var CHECKED = '2026-11-12';

  var SOURCES = {
    iterFacts: { label: 'ITER Organization · Facts & Figures', url: 'https://www.iter.org/fusion-energy/what-will-iter-do' },
    iterMachine: { label: 'ITER Organization · Machine', url: 'https://www.iter.org/machine' },
    iterBaseline: { label: 'ITER Organization · report to IAEA GC68 (2024 baseline)', url: 'https://iaea.org/sites/default/files/24/09/iter-gc68.pdf' },
    boschHale: { label: 'Bosch & Hale, Nucl. Fusion 32 (1992) 611', url: 'https://doi.org/10.1088/0029-5515/32/4/I07' },
    ame: { label: 'AME2020 atomic mass evaluation', url: 'https://www-nds.iaea.org/amdc/' },
    wesson: { label: 'Wesson, Tokamaks (Oxford University Press)', url: 'https://global.oup.com/academic/product/tokamaks-9780199592234' },
    abdou: { label: 'Abdou et al., Nucl. Fusion 61 (2021) 013001', url: 'https://doi.org/10.1088/1741-4326/abbf35' },
    eurofusion: { label: 'EUROfusion · Research Roadmap', url: 'https://euro-fusion.org/eurofusion/roadmap/' },
    federici: { label: 'Federici et al., Nucl. Fusion 59 (2019) 066013', url: 'https://doi.org/10.1088/1741-4326/ab1178' },
    jet: { label: 'EUROfusion · JET D-T results', url: 'https://euro-fusion.org/eurofusion-news/dte3record/' },
    sparc: { label: 'Creely et al., J. Plasma Phys. 86 (2020) 865860502', url: 'https://doi.org/10.1017/S0022377820001257' },
    cfetr: { label: 'Zhuang et al., Nucl. Fusion 59 (2019) 112010', url: 'https://doi.org/10.1088/1741-4326/ab0e27' },
    best: { label: '中国科学院 · BEST 研究计划（2025）', url: 'https://www.cas.cn/cm/202511/t20251125_5089788.shtml' },
    cfs: { label: 'CFS · SPARC programme', url: 'https://www.cfs.energy/technology/sparc/' },
    step: { label: 'UKAEA · STEP programme', url: 'https://step.ukaea.uk/' },
    w7x: { label: 'Max-Planck-IPP · Wendelstein 7-X', url: 'https://www.ipp.mpg.de/w7x' },
    w7xData: { label: 'Max-Planck-IPP · W7-X technical data', url: 'https://www.ipp.mpg.de/16931/einfuehrung' },
    w7xRecord: { label: 'Max-Planck-IPP · W7-X performance records (2025)', url: 'https://www.ipp.mpg.de/5532945/w7x' }
  };

  /* Published overall figures for ITER. `model` flags what the 3D model
   * reproduces versus what is only quoted in text. */
  var ITER = {
    R0: 6.2, a: 2.0, plasmaVolume: 840, Ip: 15, Bt: 5.3, pFus: 500, Q: 10, burn: 400, pAuxNominal: 50,
    wallArea: 680, machineMass: 23000,
    parts: {
      cs: {
        name: '中心螺线管', en: 'Central Solenoid · CS', tone: 'coil',
        lead: '装置的“变压器原边”。电流变化在等离子体里感应出环向电流。',
        facts: [['结构', '6 个独立模块叠放'], ['超导体', 'Nb₃Sn，4.5 K'], ['峰值磁场', '13 T'], ['尺寸 / 质量', '高约 18 m · 约 1000 t'], ['储能', '约 6.4 GJ']],
        why: '磁通只能单向摆动一次，所以纯感应驱动的放电注定是脉冲的；要稳态运行必须靠非感应电流驱动与自举电流。'
      },
      tf: {
        name: '环向场线圈', en: 'Toroidal Field coils · TF', tone: 'coil',
        lead: '18 个 D 形线圈围成一圈，产生沿大环方向的主磁场。',
        facts: [['数量', '18 个'], ['超导体', 'Nb₃Sn，4.5 K'], ['磁场', '导体处最高 11.8 T · 等离子体轴上 5.3 T'], ['单个线圈', '约 17 m × 9 m · 约 360 t'], ['总储能', '约 41 GJ']],
        why: '环向场按 1/R 衰减：内侧强、外侧弱。这个不均匀正是粒子漂移的来源，也是为什么还需要极向场。'
      },
      pf: {
        name: '极向场线圈', en: 'Poloidal Field coils · PF', tone: 'coil',
        lead: '6 个水平大环，把等离子体推成 D 形、托住它的位置，并拉出偏滤器的 X 点。',
        facts: [['数量', '6 个（另有 18 个校正线圈，模型未画）'], ['超导体', 'NbTi，4.5 K'], ['直径', '约 8–24 m'], ['最重的单个', '约 400 t']],
        why: '拉长的等离子体在垂直方向天然不稳定，需要 PF 线圈配合真空室内的快控线圈做毫秒级反馈。'
      },
      vessel: {
        name: '真空室', en: 'Vacuum Vessel · VV', tone: 'steel',
        lead: '双层不锈钢的环形容器：提供超高真空，也是第一道放射性包容边界。',
        facts: [['分段', '9 个 40° 扇段现场焊接'], ['材料', '316L(N)-IG 不锈钢，夹层走冷却水'], ['外径 / 高', '约 19.4 m / 11.4 m'], ['质量', '约 5200 t（装上内部件约 8000 t）'], ['窗口', '44 个（上 18 · 中 17 · 下 9）']],
        why: '窗口是加热、诊断、抽气与遥操作维护进出真空室的唯一通道。模型把每个扇区的窗口简化成三根方管。'
      },
      blanket: {
        name: '包层', en: 'Blanket', tone: 'steel',
        lead: '贴满真空室内壁的屏蔽模块：挡住中子，把中子动能变成冷却水带走的热。',
        facts: [['模块数', '约 440 块，覆盖约 600 m²'], ['单块', '约 1 m × 1.5 m，最重约 4.6 t'], ['面向等离子体材料', '2024 基线改为钨（原设计为铍）'], ['排热能力', '最高约 736 MW']],
        why: 'ITER 的包层只屏蔽、不增殖氚；增殖功能靠窗口里的试验包层模块（TBM）做验证。商用堆的包层必须同时产热与产氚。'
      },
      divertor: {
        name: '偏滤器', en: 'Divertor', tone: 'steel',
        lead: '装置的“排气管”。磁力线把边界等离子体导到这里，氦灰和杂质从这里被抽走。',
        facts: [['结构', '54 个盒体，可遥操作更换'], ['靶板', '钨单块，主动水冷'], ['稳态热负荷', '设计 10 MW/m²'], ['慢瞬态', '可达 20 MW/m²']],
        why: '这是装置内热负荷最高的部件。运行时要靠注入杂质气体让大部分功率在到达靶板前辐射掉（脱靶运行）。'
      },
      cryostat: {
        name: '低温恒温器', en: 'Cryostat', tone: 'steel',
        lead: '罩住整台装置的不锈钢真空罐，给 4.5 K 的超导磁体做真空绝热。',
        facts: [['尺寸', '约 29 m × 29 m'], ['质量', '约 3850 t'], ['容积', '约 16 000 m³']],
        why: '几米之外是上亿度的等离子体，线圈却要保持在 4.5 K：热屏、真空与液氦共同撑起这个跨越 9 个数量级的温度梯度。'
      }
    }
  };

  /* Wendelstein 7-X, the stellarator quoted in scene b6. Published values;
   * the 3D model borrows only the coil and module counts. */
  var W7X = {
    nonPlanar: 50, planar: 20, modules: 5, R0: 5.5, a: 0.53, volume: 30, B: 3,
    record: '2025 年 5 月的实验中，一次 360 秒的放电能量周转 1.8 GJ；另一次把三重积的高值维持了 43 秒'
  };

  /* Devices compared in chapter G. R, a in metres, B on axis in tesla.
   * `status` is the state on CHECKED; planned dates are targets, not facts. */
  var MACHINES = [
    { id: 'jet', name: 'JET', where: '英国', R: 2.96, a: 1.25, kappa: 1.68, B: 3.45, status: '1983–2023 运行，已退役', note: '2023 年 D-T 实验 5 秒释放 69 MJ', tone: 'past' },
    { id: 'sparc', name: 'SPARC', where: '美国 · CFS / MIT', R: 1.85, a: 0.57, kappa: 1.97, B: 12.2, status: '建造中，目标 Q > 1', note: '高温超导（REBCO）强场路线', tone: 'build' },
    { id: 'best', name: 'BEST', where: '中国 · 合肥', R: 3.6, a: 1.1, kappa: 1.9, B: 6.15, status: '建造中，计划 2027 年建成', note: '紧凑型燃烧等离子体实验装置', tone: 'build' },
    { id: 'iter', name: 'ITER', where: '法国 · 七方合作', R: 6.2, a: 2.0, kappa: 1.7, B: 5.3, status: '总装中，2024 基线：2034 起研究运行', note: '500 MW · Q ≥ 10 · 400 s', tone: 'now' },
    { id: 'cfetr', name: 'CFETR', where: '中国 · 设计', R: 7.2, a: 2.2, kappa: 2.0, B: 6.5, status: '2019 文献设计参数；非最新基线', note: '目标衔接 ITER 与示范堆，验证氚自持', tone: 'plan' },
    { id: 'demo', name: 'EU-DEMO', where: '欧盟 · 概念设计', R: 9.0, a: 2.9, kappa: 1.65, B: 5.9, status: '概念设计，目标本世纪中叶', note: '约 2 GW 聚变 · 约 500 MW 净电', tone: 'plan' }
  ];

  /* Programme milestones for the roadmap strip. kind: done | plan */
  var ROADMAP = [
    { year: 1997, label: 'JET D-T：16 MW，Q ≈ 0.67', kind: 'done' },
    { year: 2007, label: 'ITER 组织成立', kind: 'done' },
    { year: 2022, label: 'NIF 惯性约束首次靶增益 > 1', kind: 'done' },
    { year: 2023, label: 'JET 最后一轮 D-T：69 MJ / 5 s', kind: 'done' },
    { year: 2027, label: 'BEST、SPARC 计划建成', kind: 'plan' },
    { year: 2034, label: 'ITER 研究运行开始（氢 / 氘）', kind: 'plan' },
    { year: 2039, label: 'ITER 氘氚运行', kind: 'plan' },
    { year: 2050, label: '各方 DEMO / 首批电站目标窗口', kind: 'plan' }
  ];

  var RULES = [
    { item: 'D-T 反应能量', value: '17.59 MeV = α 3.54 + 中子 14.05', basis: '由 AME2020 原子质量差计算；能量按质量反比分配', src: ['ame'] },
    { item: '热核反应率 ⟨σv⟩', value: '10 keV：1.1×10⁻²² m³/s；峰值约 65 keV', basis: 'Bosch–Hale 1992 参数化，适用 0.2–100 keV', src: ['boschHale'] },
    { item: '理想点火三重积', value: 'n·T·τ ≈ 2.8×10²¹ keV·s/m³（约 13.5 keV）', basis: '纯燃料、平剖面、不计辐射的 0 维能量平衡', src: ['wesson'] },
    { item: 'ITER 主要参数', value: 'R 6.2 m · a 2.0 m · 15 MA · 5.3 T · 840 m³', basis: 'ITER 组织公布的设计值', src: ['iterFacts', 'iterMachine'] },
    { item: 'ITER 性能目标', value: '500 MW 聚变功率，Q ≥ 10，燃烧约 400 s', basis: '设计目标，尚未实验验证', src: ['iterFacts'] },
    { item: 'ITER 进度', value: '2034 研究运行 · 2036 满磁能 · 2039 氘氚', basis: '2024 年提出的新基线；仍可能调整', src: ['iterBaseline'] },
    { item: '氚半衰期', value: '12.32 年（每年衰变约 5.5%）', basis: 'β⁻ 衰变为 ³He', src: ['abdou'] },
    { item: '氚消耗', value: '约 56 kg / GW 聚变功率·满功率年', basis: '由单次反应能量与氚原子质量计算', src: ['ame', 'abdou'] },
    { item: '增殖反应', value: 'n + ⁶Li → T + ⁴He + 4.78 MeV；n + ⁷Li → T + ⁴He + n − 2.47 MeV', basis: '由 AME2020 原子质量差计算', src: ['ame'] },
    { item: '氚增殖比要求', value: '工程目标 TBR ≈ 1.05–1.15', basis: '需覆盖衰变、滞留与为下一座堆备料；取值随燃料循环设计变化', src: ['abdou', 'federici'] },
    { item: '海水中的氘', value: '约 33 g/m³（D/H ≈ 156 ppm）', basis: 'VSMOW 同位素比；淡水按 35 g/m³ 计', src: ['wesson'] },
    { item: 'Wendelstein 7-X', value: '50 个非平面 + 20 个平面超导线圈 · 5 个模块 · R 5.5 m · a 0.53 m · 30 m³ · 3 T', basis: 'IPP 公布的装置参数；三维模型只借用线圈与模块数量，形状是示意', src: ['w7x', 'w7xData'] },
    { item: 'W7-X 长脉冲纪录', value: '1.8 GJ / 360 s；三重积高值维持 43 s', basis: '2025 年 OP 2.3 实验阶段，IPP 2025 年 6 月公布；此后的结果未核对', src: ['w7xRecord'] },
    { item: 'EU-DEMO 量级', value: '约 2 GW 聚变 · 约 500 MW 净电 · R ≈ 9 m', basis: '2018 年前后的概念设计基线，持续修订', src: ['federici', 'eurofusion'] }
  ];

  var MYTHS = [
    { q: '“ITER 建成后就能发电。”', a: 'ITER 不接汽轮机，也不向电网送电。它要验证的是等离子体增益 Q ≥ 10（约 50 MW 加热换 500 MW 聚变功率）和一系列堆级技术，热量由冷却塔直接排走。', go: 'g1' },
    { q: '“Q = 10 就是产出十倍电能。”', a: 'Q 只比较聚变功率与注入等离子体的加热功率。把加热系统的效率、低温与泵的用电、热电转换效率都算上，ITER 这套参数的“工程 Q”小于 1。', go: 'e4' },
    { q: '“聚变堆会像核弹或裂变堆一样失控。”', a: '真空室里任何时刻只有不到一克的燃料，维持燃烧需要极苛刻的温度与约束；一旦失控条件被破坏，等离子体在毫秒到秒量级内熄灭。风险在于破裂对部件的冲击，而不是链式反应。', go: 'd6' },
    { q: '“燃料取自海水，所以取之不尽。”', a: '只有氘来自海水。氚在自然界几乎不存在，必须用聚变中子轰击锂在包层里现造，而且增殖比要略大于 1 才能自持——这一点至今没有在整堆尺度上验证过。', go: 'f2' },
    { q: '“聚变没有放射性。”', a: '氚本身是放射性的（半衰期 12.3 年），14 MeV 中子还会活化结构材料。区别在于：没有长寿命高放裂变产物，选用低活化钢后，材料可在约百年量级内降到可回收水平。', go: 'g4' },
    { q: '“等离子体有一亿度，会把容器熔化。”', a: '等离子体极稀薄（密度约为空气的百万分之一），总热量有限，而且被磁场托在离壁十几厘米之外。真正的难题是偏滤器靶板上每平方米 10–20 MW 的持续热流。', go: 'e3' },
    { q: '“磁场把所有粒子都关住了。”', a: '磁场只约束带电粒子。占 80% 能量的中子不带电，会径直穿出等离子体——这正是设计意图：中子把能量送进包层，同时用来增殖氚。', go: 'e1' },
    { q: '“激光聚变已经点火，磁约束没必要了。”', a: 'NIF 2022 年的靶增益 > 1 是相对于打到靶上的激光能量；相对于整个装置的耗电仍差两个数量级，重复频率也远不够电站要求。两条路线面对的工程问题不同，都还没走完。', go: 'g5' }
  ];

  FL.ref = { CHECKED: CHECKED, SOURCES: SOURCES, ITER: ITER, W7X: W7X, MACHINES: MACHINES, ROADMAP: ROADMAP, RULES: RULES, MYTHS: MYTHS };
  if (typeof module !== 'undefined' && module.exports) module.exports = FL.ref;
})();
