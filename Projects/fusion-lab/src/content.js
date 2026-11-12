/* Fusion Lab — the lesson: 7 chapters, 41 scenes.
 *
 * Each scene is plain data: narration, a camera shot, which parts of the 3D
 * world are on, and which instrument sits in the side panel. app.js applies
 * it; nothing here touches the DOM or three.js.
 *
 * Shot: t = look-at target (m), az/pol in degrees (az 0 looks into the
 * cutaway from +Z), d = distance (m).
 * Label anchors: ['tk', layer, R, Z, φ°] on the machine, ['fx', name],
 * ['pl', name] on the plant, ['torus', ρ, θ°, φ°] on a flux surface.
 */
(function () {
  'use strict';
  var FL = globalThis.FL = globalThis.FL || {};

  var ALL = ['cs', 'tf', 'pf', 'vessel', 'blanket', 'divertor', 'cryostat'];
  var CORE = ['cs', 'tf', 'pf', 'vessel', 'blanket', 'divertor'];
  var BURN = { plasma: 1, heat: 1, particles: 0.85, strike: 1, neutrons: 1, alphas: 1, blanketHeat: 1 };
  var GLOW = { plasma: 1, heat: 0.55, particles: 0.7, strike: 0.6 };

  var SHOT = {
    hero: { t: [0, -1.5, 0], az: 22, pol: 66, d: 72 },
    wide: { t: [0, 0, 0], az: -18, pol: 62, d: 62 },
    inside: { t: [0, 0.2, 2.5], az: 6, pol: 77, d: 27 },
    field: { t: [0, 0.4, 0], az: 18, pol: 58, d: 33 },
    section: { t: [-6.2, 0.3, 0.5], az: 2, pol: 84, d: 15.5 },
    micro: { t: [0, 0, 0], az: 0, pol: 86, d: 23, fov: 34 },
    cycle: { t: [-17, -6.5, 1], az: -34, pol: 56, d: 82 },
    power: { t: [27, -5.5, 3], az: 38, pol: 58, d: 96 },
    plant: { t: [6, -6, 4], az: 6, pol: 50, d: 150 }
  };

  var L = {
    plasma: { id: 'plasma', text: '等离子体', sub: '约 1.5 亿 °C', at: ['torus', 1.0, 55, 62], tone: 'plasma' },
    cs: { id: 'cs', text: '中心螺线管 CS', at: ['tk', 'cs', 2.05, 5.2, 96] },
    tf: { id: 'tf', text: '环向场线圈 TF', sub: '18 个', at: ['tk', 'tf', 11.25, 3.4, 180], side: 'l' },
    pf: { id: 'pf', text: '极向场线圈 PF', sub: '6 个', at: ['tk', 'pf', 12.2, 3.25, 356] },
    vessel: { id: 'vessel', text: '真空室', at: ['tk', 'vessel', 9.6, 2.4, 161], side: 'l' },
    blanket: { id: 'blanket', text: '包层', at: ['tk', 'blanket', 8.6, 2.2, 39] },
    divertor: { id: 'divertor', text: '偏滤器', at: ['tk', 'divertor', 6.0, -4.05, 38] },
    cryostat: { id: 'cryostat', text: '低温恒温器', at: ['tk', 'cryostat', 14.4, 8.5, 2] },
    person: { id: 'person', text: '人', sub: '1.8 m', at: ['pl', 'person'], tone: 'warn' }
  };

  var CHAPTERS = [
    { id: 'a', n: '01', title: '聚变反应', en: 'THE REACTION', blurb: '质量怎样变成能量，为什么选氘和氚' },
    { id: 'b', n: '02', title: '磁约束', en: 'CONFINEMENT', blurb: '用磁场托住一亿度的气体' },
    { id: 'c', n: '03', title: 'ITER 解剖', en: 'ANATOMY', blurb: '逐层拆开 23 000 吨的装置' },
    { id: 'd', n: '04', title: '一次放电', en: 'ONE PULSE', blurb: '从击穿、加热到燃烧的时间轴' },
    { id: 'e', n: '05', title: '能量账本', en: 'ENERGY', blurb: '500 MW 去了哪里，Q 到底指什么' },
    { id: 'f', n: '06', title: '氘氚循环', en: 'FUEL CYCLE', blurb: '氚从哪来：增殖、回收与自持' },
    { id: 'g', n: '07', title: '商用堆', en: 'POWER PLANT', blurb: '从 ITER 到并网发电还差什么' }
  ];

  var SCENES = [
    /* ================= A · the reaction ================= */
    {
      id: 'a1', title: '少掉的质量，变成了能量', cap: '氘 + 氚 → 氦-4 + 中子 + 17.6 MeV',
      body: ['一个<b>氘核</b>（1 质子 + 1 中子）与一个<b>氚核</b>（1 质子 + 2 中子）靠得足够近时，强核力把它们并成一个氦-4 核，同时甩出一个中子。',
        '产物的总质量比反应物少了约 <b>0.38%</b>。这点质量按 E = mc² 变成产物的动能——每次反应 <b>17.6 MeV</b>，是烧掉一个碳原子放能的几百万倍。'],
      set: 'micro', micro: { play: 'fuse', fuseChance: 1, hot: 0.55 }, shot: SHOT.micro, spin: 0, labels: 'micro',
      legend: ['proton', 'neutron'], panel: { type: 'massEnergy' }
    },
    {
      id: 'a2', title: '先要翻过库仑势垒', cap: '同种电荷相斥：温度不够，只会被弹开',
      body: ['两个原子核都带正电，越近斥力越大。要让强核力接手，它们得靠到约 10⁻¹⁵ m 以内。',
        '按经典力学，这需要几十亿度。实际上靠<b>量子隧穿</b>，在 <b>1–2 亿 °C</b>（10–20 keV）下就有足够多的碰撞能穿过势垒。拖动温度滑块：温度低时几乎全被弹开，温度升高后成功的比例迅速上升。'],
      set: 'micro', micro: { play: 'fuse', fuseChance: 0.5, hot: 0.4 }, shot: { t: [0, 0, 0], az: 12, pol: 82, d: 24, fov: 34 }, labels: 'micro',
      legend: ['proton', 'neutron', 'coulomb'], panel: { type: 'barrier' }
    },
    {
      id: 'a3', title: '为什么是氘和氚', cap: '同样的温度，D-T 的反应率高出两个数量级',
      body: ['聚变燃料有很多种组合，决定难易的是<b>反应率 ⟨σv⟩</b>：单位密度下每秒发生多少次反应。',
        'D-T 的反应率在 10–20 keV 就很高，峰值约在 65 keV；D-D 在同温度下低约 100 倍，D-³He 要到 100 keV 以上才追上来。所以第一代聚变堆几乎都选 D-T——代价是要处理氚和高能中子。'],
      set: 'micro', micro: { play: 'fuse', fuseChance: 1, hot: 0.7 }, shot: { t: [0, 0, 0], az: -14, pol: 80, d: 26, fov: 34 }, labels: 'micro',
      legend: ['proton', 'neutron'], panel: { type: 'fuels' }
    },
    {
      id: 'a4', title: '能量四比一分给中子', cap: '中子 14.1 MeV，α 粒子 3.5 MeV',
      body: ['反应后两个产物背向飞开，动量大小相等。质量小的跑得快：中子的质量只有 α 粒子的四分之一，所以速度是 4 倍，带走 <b>80%</b> 的能量。',
        '这个 4 : 1 决定了整座聚变堆的结构：<b>带电的 α 粒子</b>被磁场留在等离子体里继续加热燃料；<b>不带电的中子</b>直接穿出去，能量只能在外面的包层里收集。'],
      set: 'micro', micro: { play: 'fuse', fuseChance: 1, hot: 0.7 }, shot: { t: [0, 0, 0], az: 0, pol: 78, d: 30, fov: 34 }, labels: 'micro',
      legend: ['he', 'n'], panel: { type: 'split' }
    },
    {
      id: 'a5', title: '劳森判据：密度 × 温度 × 时间', cap: '三重积 n·T·τ 够大，聚变才能自己烧下去',
      body: ['等离子体一边靠 α 粒子自加热，一边通过热传导和辐射漏掉能量。漏得越慢（<b>能量约束时间 τ</b> 越长）、越密（<b>n</b>）、越热（<b>T</b>），聚变越占上风。',
        '三者的乘积超过约 <b>3×10²¹ keV·s/m³</b> 时，自加热就能抵消全部损失，即“点火”。ITER 的目标是 Q = 10：聚变功率达到外部加热的 10 倍。调三个滑块，看 Q 如何变化。'],
      set: 'machine', layers: ['tf', 'cs'], focus: ['none'], cut: 'onion', fx: { plasma: 1, heat: 0.8, particles: 0.8, alphas: 0.6 },
      shot: SHOT.field, spin: 0.05, labels: [L.plasma], legend: ['d', 't', 'e', 'he'], panel: { type: 'lawson' }
    },

    /* ================= B · confinement ================= */
    {
      id: 'b1', title: '带电粒子绕着磁力线转', cap: '洛伦兹力让粒子做回旋运动，只能沿磁力线滑行',
      body: ['一亿度下原子早已电离，燃料是由离子和电子组成的<b>等离子体</b>。任何固体壁都托不住它，但磁场可以。',
        '带电粒子在磁场里受洛伦兹力，垂直方向被弯成小圆圈，只能沿磁力线自由运动。在 5.3 T 的磁场里，10 keV 氘核的回旋半径只有约 <b>4 mm</b>，电子更小——粒子像珠子一样穿在磁力线上。'],
      note: '图中回旋半径放大约 20 倍，粒子速度放慢约 10⁷ 倍。',
      set: 'machine', layers: ['tf', 'cs'], focus: ['none'], cut: 'onion', toroidalOnly: true,
      fx: { plasma: 0.25, field: 1, particles: 1 }, shot: { t: [-6.0, 0.6, 2.2], az: -4, pol: 70, d: 13 }, spin: 0,
      labels: [{ id: 'fl', text: '磁力线', at: ['torus', 1.03, 40, 118], tone: 'field', side: 'l' }], legend: ['d', 't', 'e', 'field'], panel: { type: 'gyro' }
    },
    {
      id: 'b2', title: '只有环向场：粒子会漂走', cap: '环向磁场内强外弱，离子和电子上下分离',
      body: ['把磁力线弯成一个闭合的环，粒子沿环跑就不会从两端漏掉——这是 TF 线圈产生的<b>环向场</b>。',
        '但环向场内侧强、外侧弱（按 1/R 衰减）。这个不均匀让离子向上漂、电子向下漂，上下分离的电荷产生电场，电场再把所有粒子一起推向外壁。<b>只有环向场，约束几毫秒就垮了。</b>'],
      set: 'machine', layers: ['tf', 'cs'], focus: ['none'], cut: 'onion', toroidalOnly: true,
      fx: { plasma: 0.18, field: 1, particles: 1, drift: 1, tfGlow: 0.5 }, shot: SHOT.field, spin: 0.04,
      labels: [L.tf, { id: 'dr', text: '离子上漂 · 电子下漂', sub: '随后一起被推向外侧', at: ['torus', 1.15, 80, 122], tone: 'warn', side: 'l' }],
      legend: ['d', 't', 'e', 'field'], panel: { type: 'fieldMode' }
    },
    {
      id: 'b3', title: '加上极向场：磁力线拧成螺旋', cap: '等离子体自身的电流让磁力线绕小截面旋转',
      body: ['托卡马克的解法：让等离子体里流过一股很大的<b>环向电流</b>（ITER 为 15 MA）。电流产生绕小截面的<b>极向场</b>，与环向场叠加后，磁力线变成螺旋。',
        '粒子沿螺旋线跑时，一会儿在环的上半部、一会儿在下半部，向上的漂移被平均掉了。上下的电荷也被沿磁力线流动的电子短路——约束恢复。'],
      set: 'machine', layers: ['tf', 'cs'], focus: ['none'], cut: 'onion', q: 3,
      fx: { plasma: 0.3, field: 1, poloidal: 1, current: 1, particles: 1 }, shot: SHOT.field, spin: 0.04,
      labels: [{ id: 'ip', text: '等离子体电流 Ip', sub: '15 MA', at: ['torus', 0, 0, 128], tone: 'current', side: 'l' }, { id: 'bp', text: '极向场', at: ['torus', 1.07, 120, 38], tone: 'current' }, { id: 'fl', text: '螺旋磁力线', at: ['torus', 1.03, 60, 62], tone: 'field' }],
      legend: ['field', 'current', 'd', 't', 'e'], panel: { type: 'fieldMode' }
    },
    {
      id: 'b4', title: '安全因子 q：螺旋不能拧太紧', cap: 'q = 磁力线绕大环几圈才绕小截面一圈',
      body: ['磁力线一层套一层，铺成嵌套的<b>磁面</b>。每个磁面上，磁力线绕大环 q 圈才绕小截面 1 圈——q 叫<b>安全因子</b>。',
        '电流越大，极向场越强，q 越小，约束越好；但边界 q 降到 2 附近时，整个等离子体柱会像拧过头的橡皮筋一样扭曲（扭曲模），在毫秒内<b>破裂</b>。ITER 取 q₉₅ ≈ 3。拖动电流，看磁力线的螺距和判据怎样变。'],
      set: 'machine', layers: ['tf', 'cs'], focus: ['none'], cut: 'onion', q: 3,
      fx: { plasma: 0.3, field: 1, current: 0.7, particles: 0.5 }, shot: { t: [0, 0.4, 0], az: -24, pol: 50, d: 34 }, spin: 0.05,
      labels: [{ id: 'fl', text: '磁力线', at: ['torus', 1.03, 60, 62], tone: 'field' }], legend: ['field', 'current'], panel: { type: 'safety' }
    },
    {
      id: 'b5', title: 'D 形截面与 X 点', cap: '极向场线圈把等离子体拉长，并拉出偏滤器位形',
      body: ['只靠等离子体电流，截面是圆的。外面 6 个<b>极向场线圈</b>再推一把，把截面拉成竖长的 D 形：同样的大半径下体积更大，能承载的电流和压强也更高。',
        '底部的线圈把磁面拉出一个 <b>X 点</b>。X 点以内磁面闭合，约束等离子体；以外的磁力线是开放的，直接通向偏滤器靶板——逃出来的粒子和氦灰沿着这两条“腿”被导走，而不是随机地撞向第一壁。'],
      set: 'machine', layers: ['pf', 'cs', 'vessel', 'blanket', 'divertor'], focus: ['pf', 'divertor'], cut: 'half', q: 3,
      fx: { plasma: 0.28, heat: 0.15, strike: 0.35, pfGlow: 0.3, particles: 0.15 }, shot: { t: [-3, -0.5, 0], az: 2, pol: 78, d: 36 }, spin: 0,
      labels: [{ id: 'xp', text: 'X 点', at: ['p', -5.42, -3.05, 0.02], tone: 'plasma', side: 'l' }, { id: 'sp', text: '打击点', sub: '热流最集中处', at: ['p', -6.55, -4.3, 0.02], tone: 'warn' }, { id: 'pf', text: '极向场线圈', at: ['tk', 'pf', 12.2, 3.25, 180] }],
      legend: ['plasma', 'strike'], panel: { type: 'shape' }
    },

    /* ================= C · anatomy ================= */
    {
      id: 'c1', title: 'ITER：把它整个装起来', cap: '高约 30 米、重 23 000 吨，旁边那个黄点是一个人',
      body: ['<b>ITER</b>（国际热核聚变实验堆）建在法国南部卡达拉舍，由中国、欧盟、印度、日本、韩国、俄罗斯、美国七方共同建造，是迄今最大的托卡马克。',
        '从里到外：等离子体 → 包层与偏滤器 → 真空室 → 三套超导磁体 → 低温恒温器。接下来逐层拆开。可以直接<b>点击模型上的零件</b>，或用右侧的滑块把装置炸开。'],
      set: 'machine', layers: ALL, cut: 'onion', fx: GLOW, shot: SHOT.hero, spin: 0.045,
      labels: [L.plasma, L.cs, L.tf, L.pf, L.vessel, L.blanket, L.cryostat, L.person], panel: { type: 'anatomy' }
    },
    {
      id: 'c2', title: '中心螺线管：一台巨型变压器', cap: '6 个模块 · 13 T · 驱动 15 MA 等离子体电流',
      body: ['立在正中央的铜色圆柱是<b>中心螺线管</b>。它是变压器的原边，等离子体环是只有一匝的副边：螺线管里的电流一变，环里就感应出电压，推着等离子体电流流起来。',
        '6 个模块可以独立供电，除了驱动电流，还参与塑形。它的磁通只能朝一个方向“摆”一次，摆完就没有感应电压了——这是托卡马克天然是<b>脉冲装置</b>的根源。'],
      set: 'machine', layers: CORE, focus: ['cs'], cut: 'onion', fx: { plasma: 0.5, current: 1, csGlow: 0.8 }, shot: { t: [0, 0.5, 0], az: 12, pol: 64, d: 36 }, spin: 0.04,
      labels: [L.cs, { id: 'ip', text: '感应出的等离子体电流', at: ['torus', 0, 0, 126], tone: 'current', side: 'l' }], panel: { type: 'anatomy', part: 'cs' }
    },
    {
      id: 'c3', title: '环向场线圈：18 个 D 形巨环', cap: '每个 360 吨 · 导体处 11.8 T · 4.5 K',
      body: ['18 个 <b>TF 线圈</b>像橘子瓣一样围住真空室，产生约束等离子体的主磁场。每个线圈高 17 m，用 Nb₃Sn 超导线绕成，泡在 4.5 K 的超临界氦里。',
        '线圈通电后彼此之间有巨大的向心力——内侧直腿互相楔紧成拱，把几万吨的力顶住。D 形不是为了好看：它让线圈在这个受力下接近纯拉伸，弯矩最小。'],
      set: 'machine', layers: CORE, focus: ['tf'], cut: 'onion', fx: { plasma: 0.5, field: 0.8, tfGlow: 0.6 }, toroidalOnly: true, shot: { t: [0, 0.3, 0], az: 34, pol: 62, d: 44 }, spin: 0.04,
      labels: [L.tf, { id: 'bt', text: '环向磁场', sub: '轴上 5.3 T', at: ['torus', 1.03, 30, 60], tone: 'field' }], panel: { type: 'anatomy', part: 'tf' }
    },
    {
      id: 'c4', title: '极向场线圈：塑形与定位', cap: '6 个水平大环，最大直径 24 m',
      body: ['套在 TF 线圈外面的 6 个水平环是 <b>PF 线圈</b>。它们的磁场决定等离子体的形状和位置：拉长、加三角形变、形成 X 点，并在放电全程实时调整。',
        '最大的两个直径约 24 m，大到无法运输，是在 ITER 现场的厂房里绕制的。PF 线圈用 NbTi 超导体——它们所在位置磁场较低，不需要更贵的 Nb₃Sn。'],
      set: 'machine', layers: CORE, focus: ['pf'], cut: 'onion', fx: { plasma: 0.6, strike: 0.5, pfGlow: 0.6 }, shot: { t: [0, 0.3, 0], az: -22, pol: 54, d: 46 }, spin: 0.04,
      labels: [L.pf], panel: { type: 'anatomy', part: 'pf' }
    },
    {
      id: 'c5', title: '真空室：双层钢壳', cap: '9 个扇段焊成，44 个窗口通向内部',
      body: ['<b>真空室</b>是一只 D 形截面的环形钢罐。聚变需要的不是高压，而是极干净的高真空：任何杂质都会把等离子体的能量辐射掉。',
        '它是双层壁，夹层里流着冷却水和屏蔽块，同时是放射性物质的第一道包容边界。壁上的窗口让加热束、诊断设备、抽气泵和维护机械臂进出。剖面上能看到两层壳和中间的肋板。'],
      set: 'machine', layers: CORE, focus: ['vessel'], cut: 'onion', fx: { plasma: 0.5 }, shot: { t: [0, 0.2, 2], az: 26, pol: 70, d: 34 }, spin: 0.03,
      labels: [L.vessel, { id: 'port', text: '窗口', sub: '上 / 中 / 下三排', at: ['tk', 'vessel', 12.2, 0.5, 190], side: 'l' }], panel: { type: 'anatomy', part: 'vessel' }
    },
    {
      id: 'c6', title: '包层：直面等离子体的墙', cap: '约 440 块屏蔽模块，挡住 14 MeV 中子',
      body: ['真空室内壁贴满了砖块一样的<b>包层模块</b>。朝向等离子体的一面是第一壁面板，后面是厚重的钢水屏蔽块。',
        '中子在这里被慢化、吸收，动能变成热，被高压冷却水带走；同时它保护后面的真空室和超导线圈不被中子照坏。<b>在 ITER 里包层只做屏蔽</b>——到了发电堆，这一层还要负责增殖氚，后面第 6 章会回到这里。'],
      set: 'machine', layers: CORE, focus: ['blanket'], cut: 'onion', fx: { plasma: 0.9, heat: 0.7, neutrons: 1, blanketHeat: 1 }, shot: SHOT.inside, spin: 0.03,
      labels: [L.blanket, { id: 'neu', text: '中子', sub: '穿出等离子体，停在包层里', at: ['torus', 1.12, 20, 300], tone: 'n' }], legend: ['n', 'heat'], panel: { type: 'anatomy', part: 'blanket' }
    },
    {
      id: 'c7', title: '偏滤器：装置的排气管', cap: '54 个钨盒体，承受 10–20 MW/m² 热流',
      body: ['真空室底部一圈是<b>偏滤器</b>。X 点以外的磁力线把从等离子体边缘逃出来的粒子导到这里的靶板上，中和成气体后被下方的低温泵抽走——聚变“灰烬”氦就是这样排出去的。',
        '两条亮线是<b>打击点</b>：全装置热流最集中的地方，每平方米承受的功率堪比火箭喷管。靶板用钨（熔点 3422 °C）做成小块，背后通高速冷却水，整个盒体坏了可以用遥操作小车换掉。'],
      set: 'machine', layers: CORE, focus: ['divertor'], cut: 'wide', fx: { plasma: 1, heat: 0.5, strike: 1, particles: 0.3 }, shot: { t: [0, -3.2, 4.5], az: 14, pol: 62, d: 19 }, spin: 0.03,
      labels: [L.divertor, { id: 'sp', text: '打击点', at: ['fx', 'strike'], tone: 'warn', side: 'l' }], legend: ['plasma', 'strike'], panel: { type: 'anatomy', part: 'divertor' }
    },
    {
      id: 'c8', title: '低温恒温器：世界上最大的保温瓶', cap: '29 m × 29 m 的真空罐，里面是 4.5 K 的磁体',
      body: ['最外层的<b>低温恒温器</b>把整台装置罩在真空里。超导磁体总重约 10 000 吨，全部要冷到 4.5 K（−269 °C），真空加上镀银热屏才能把漏热压到制冷机带得走的水平。',
        '于是在几米的距离内，同时存在宇宙里最热和最冷的地方之一：等离子体芯部约 1.5 亿 °C，线圈只比绝对零度高 4 度。把装置炸开，看看这些层是怎样一层层套起来的。'],
      set: 'machine', layers: ALL, focus: ['cryostat'], cut: 'onion', explode: 0.0, fx: GLOW, shot: SHOT.wide, spin: 0.045,
      labels: [L.cryostat, L.person], panel: { type: 'anatomy', part: 'cryostat' }
    },

    /* ================= D · one pulse ================= */
    {
      id: 'd1', title: '准备：抽空、充气、给线圈充电', cap: '真空室里只放进不到 1 克的燃料气体',
      body: ['放电前，真空室被抽到比大气稀薄十亿倍以上。TF 线圈已经稳态通电，中心螺线管预先充到正向满电流。',
        '然后向真空室喷入极少量的氢同位素气体。整个环里的燃料加起来<b>不到 1 克</b>——这也是聚变堆不会“失控”的直接原因：里面根本没有可供失控的燃料量。'],
      set: 'machine', layers: CORE, cut: 'onion', pulse: [-30, -2], shot: { t: [0, 0.5, 0], az: 14, pol: 68, d: 44 }, spin: 0.03,
      labels: [L.cs, L.tf], panel: { type: 'pulse' }
    },
    {
      id: 'd2', title: '击穿：气体变成等离子体', cap: '螺线管电流开始下降，环里感应出电压',
      body: ['中心螺线管的电流开始快速下降。变化的磁通在环里感应出环向电场，把气体里的零星自由电子加速，它们撞出更多电子——雪崩式<b>击穿</b>，几十毫秒内气体变成等离子体。',
        '电子回旋波在这一步帮忙预电离，让击穿在很低的电场下就能发生。此时等离子体又冷又暗，电流只有几十万安培。'],
      set: 'machine', layers: CORE, cut: 'onion', pulse: [-1, 6], shot: SHOT.inside, spin: 0.02,
      labels: [L.cs, { id: 'ec', text: '电子回旋波', sub: '辅助击穿', at: ['fx', 'ec'], tone: 'ec' }], panel: { type: 'pulse' }
    },
    {
      id: 'd3', title: '电流爬升：0 → 15 MA', cap: '约一分多钟，等离子体从小圆截面长成满尺寸 D 形',
      body: ['螺线管继续摆动磁通，等离子体电流稳步上升。电流流过有电阻的等离子体，本身就在加热它（欧姆加热）。',
        'PF 线圈同步调整，让等离子体从贴着内壁的小截面长成完整的 D 形并拉出 X 点。但温度越高等离子体电阻越小，欧姆加热在约一千万度就后继乏力——离聚变需要的温度还差一个量级。'],
      set: 'machine', layers: CORE, cut: 'onion', pulse: [6, 80], shot: { t: [0, 0.3, 1], az: -10, pol: 66, d: 36 }, spin: 0.03,
      labels: [{ id: 'ip', text: '等离子体电流', at: ['torus', 0, 0, 126], tone: 'current', side: 'l' }, L.cs], legend: ['current', 'plasma'], panel: { type: 'pulse' }
    },
    {
      id: 'd4', title: '辅助加热：三种办法一起上', cap: '中性束、电子回旋、离子回旋——把温度推到 1.5 亿度',
      body: ['<b>中性束注入</b>：把氘离子加速到 1 MeV 再中和成原子，中性的束流不受磁场影响，一直射进芯部，电离后把能量交给等离子体。',
        '<b>电子回旋</b>（170 GHz）和<b>离子回旋</b>（几十 MHz）则像微波炉：用与粒子回旋频率共振的电磁波定点加热，电子回旋波还能精确地驱动局部电流、压制不稳定性。原设计三者合计约 73 MW；2024 基线调整为以电子回旋为主。'],
      set: 'machine', layers: CORE, cut: 'onion', pulse: [80, 128], shot: { t: [0, 0.6, 3], az: -16, pol: 70, d: 32 }, spin: 0.02,
      labels: [{ id: 'nbi', text: '中性束 NBI', sub: '1 MeV 氘原子', at: ['fx', 'nbi'], tone: 'nbi', side: 'l' }, { id: 'ec', text: '电子回旋 ECRH', sub: '170 GHz', at: ['fx', 'ec'], tone: 'ec' }, { id: 'ic', text: '离子回旋 ICRH', at: ['fx', 'ic'], tone: 'ic' }],
      legend: ['nbi', 'ec', 'ic'], panel: { type: 'pulse' }
    },
    {
      id: 'd5', title: '燃烧：α 粒子接管加热', cap: '500 MW 聚变功率，持续约 400 秒',
      body: ['温度过了一亿度，聚变反应大量发生。每次反应留下的 <b>α 粒子</b>被磁场困在等离子体里，把 3.5 MeV 的能量一点点交给周围的燃料。',
        '在 Q = 10 时，α 加热约 100 MW，是外部加热（50 MW）的两倍——等离子体主要靠自己烧。这种<b>燃烧等离子体</b>是 ITER 的核心科学目标，以前没有装置长时间做到过。期间靠弹丸从高场侧不断补充燃料。'],
      set: 'machine', layers: CORE, cut: 'onion', pulse: [130, 520], shot: SHOT.inside, spin: 0.035,
      labels: [L.plasma, { id: 'pel', text: '燃料弹丸', sub: '冻结的氘氚冰', at: ['fx', 'pellet'], tone: 'd', side: 'l' }, { id: 'neu', text: '中子', at: ['torus', 1.12, 20, 300], tone: 'n' }],
      legend: ['he', 'n', 'd', 't'], panel: { type: 'pulse' }
    },
    {
      id: 'd6', title: '收尾：软着陆，以及万一破裂', cap: '磁通用完前，把电流和热量平稳地降下来',
      body: ['螺线管的磁通快摆完时，放电必须结束。先停止加料、降加热功率让聚变熄灭，再在一两分钟内把 15 MA 的电流缓缓降到零。',
        '如果等离子体中途失稳，会发生<b>破裂</b>：几毫秒内把上百兆焦的热能和磁能砸到壁上。ITER 为此准备了<b>碎裂弹丸注入</b>系统——在破裂前打进大量冷冻杂质，把能量变成均匀的辐射。破裂损伤的是部件，装置不会爆炸。'],
      set: 'machine', layers: CORE, cut: 'onion', pulse: [520, 760], shot: { t: [0, 0.4, 0], az: 20, pol: 66, d: 44 }, spin: 0.03,
      labels: [L.cs], panel: { type: 'pulse' }
    },

    /* ================= E · energy ================= */
    {
      id: 'e1', title: 'α 留下，中子离开', cap: '五分之一留在等离子体里，五分之四穿墙而出',
      body: ['再看一次那个 4 : 1。ITER 满功率时聚变功率 500 MW：其中约 <b>100 MW</b> 由 α 粒子携带，留在磁场里加热等离子体；约 <b>400 MW</b> 由中子携带。',
        '中子不带电，磁场对它毫无作用，它以光速的 17% 沿直线飞出，在几十纳秒内撞进包层。等离子体本身只是“火”，真正把能量交出来的地方在墙里。'],
      set: 'machine', layers: CORE, cut: 'onion', fx: BURN, shot: SHOT.inside, spin: 0.035,
      labels: [{ id: 'al', text: 'α 粒子', sub: '沿磁力线回旋，留在里面', at: ['torus', 0.5, 70, 64], tone: 'he' }, { id: 'neu', text: '中子', sub: '直线飞出', at: ['torus', 1.12, 20, 300], tone: 'n' }],
      legend: ['he', 'n', 'd', 't'], panel: { type: 'powerSplit' }
    },
    {
      id: 'e2', title: '包层把中子变成热', cap: '平均每平方米墙面承受约 0.6 MW 的中子功率',
      body: ['中子在包层的钢和水里反复碰撞，十几厘米内把动能交光，变成热。冷却水把热带出装置。',
        '在 ITER，这些热经过二次、三次回路，最后由冷却塔排进大气——<b>ITER 不发电</b>。在发电堆里，同样的冷却回路会接上蒸汽发生器和汽轮机；而且包层要换成含锂的增殖包层，冷却剂温度也要提高到 300–500 °C 才有像样的热效率。'],
      set: 'machine', layers: CORE, focus: ['blanket'], cut: 'onion', fx: BURN, shot: { t: [0, 0.5, 3], az: 28, pol: 72, d: 26 }, spin: 0.03,
      labels: [L.blanket, { id: 'neu', text: '中子在此停下', at: ['torus', 1.14, 10, 296], tone: 'n' }], legend: ['n', 'heat'], panel: { type: 'wallLoad' }
    },
    {
      id: 'e3', title: '偏滤器：最烫的地方', cap: '稳态 10 MW/m²——接近太阳表面热流的六分之一',
      body: ['α 粒子交给等离子体的那 100 MW，加上外部加热的 50 MW，最终都要从等离子体边缘漏出来。其中相当一部分顺着开放磁力线流向偏滤器。',
        '这股热流落在靶板上只有几厘米宽的两条带上，不加控制的话会远超任何材料的承受极限。办法是往偏滤器里喷氮或氖，让等离子体在碰到靶板前先把大部分能量<b>辐射</b>成向四面八方的光——这叫“脱靶”运行。'],
      set: 'machine', layers: CORE, focus: ['divertor'], cut: 'wide', fx: { plasma: 1, heat: 0.9, strike: 1, particles: 0.5, alphas: 1 }, shot: { t: [0, -3.2, 4.5], az: -12, pol: 60, d: 18 }, spin: 0.03,
      labels: [{ id: 'sp', text: '打击点', sub: '设计热流 10 MW/m²', at: ['fx', 'strike'], tone: 'warn', side: 'l' }, L.divertor], legend: ['plasma', 'strike'], panel: { type: 'heatFlux' }
    },
    {
      id: 'e4', title: '三个“Q”，别混着用', cap: '等离子体 Q = 10，不等于电站净发电',
      body: ['<b>等离子体增益 Q</b> = 聚变功率 ÷ 注入等离子体的加热功率。ITER 的 Q = 10 指的就是 500 MW ÷ 50 MW。',
        '但 50 MW 的加热束需要一百多兆瓦的电来产生；低温系统、水泵、磁体电源还要再吃掉一大块。如果给 ITER 接上汽轮机，按右侧模型算出来的<b>工程增益 Q<sub>eng</sub></b>（发出的电 ÷ 自己用的电）小于 1。商用堆需要 Q 在 30–50 以上，自用电才降到发电量的两三成。'],
      set: 'machine', layers: ALL, cut: 'onion', fx: BURN, shot: SHOT.hero, spin: 0.04,
      labels: [L.plasma], panel: { type: 'plantCalc', preset: 'iter' }
    },

    /* ================= F · fuel cycle ================= */
    {
      id: 'f1', title: '氘：海水里就有', cap: '每立方米海水含约 33 克氘',
      body: ['氢有三种同位素：氕（普通的氢）、氘、氚。水里每约 6400 个氢原子就有一个是<b>氘</b>，它是稳定的，用成熟的化工流程（水-硫化氢交换、电解、精馏）就能提取。',
        '一座 1 GW 电功率的聚变电站，一年只需要约 100 千克氘。按人类目前的能源消费，海水里的氘够用几十亿年。<b>氘不是瓶颈。</b>'],
      set: 'machine', layers: CORE, cut: 'onion', fx: GLOW, plant: { cycle: 1 }, pipes: ['dFeed', 'fuel', 'inject'], shot: { t: [-28, -7, 14], az: -52, pol: 60, d: 46 }, spin: 0.02,
      labels: [{ id: 'ds', text: '氘气储罐', sub: '源头：海水', at: ['pl', 'dsupply'], tone: 'd', side: 'l' }, { id: 'sds', text: '储存与配送', at: ['pl', 'sds'], tone: 't' }, { id: 'fu', text: '加料系统', at: ['pl', 'fuelling'], tone: 'dt' }],
      legend: ['dPipe', 'dtPipe'], panel: { type: 'deuterium' }
    },
    {
      id: 'f2', title: '氚：自然界几乎没有', cap: '半衰期 12.3 年，全球库存只有几十千克',
      body: ['<b>氚</b>具有放射性，半衰期 12.32 年——每年约 5.5% 自己衰变掉，所以地球上不存在天然的氚矿。',
        '现有的民用氚主要是加拿大等地 CANDU 重水裂变堆的副产品，全球库存只有<b>几十千克</b>量级。而一座 1 GW 聚变功率的堆满功率运行一年要烧掉约 <b>56 千克</b>。靠外购氚，一座电站连一年都撑不过：聚变堆必须<b>自己造氚</b>。'],
      set: 'machine', layers: CORE, cut: 'onion', fx: GLOW, plant: { cycle: 1 }, pipes: ['issT', 'fuel', 'inject'], shot: SHOT.cycle, spin: 0.02,
      labels: [{ id: 'sds', text: '氚储存床', sub: '以金属氚化物形式锁住', at: ['pl', 'sds'], tone: 't' }, { id: 'iss', text: '同位素分离', at: ['pl', 'iss'], tone: 't', side: 'l' }],
      legend: ['tPipe', 'dtPipe'], panel: { type: 'tritium' }
    },
    {
      id: 'f3', title: '用中子把锂变成氚', cap: 'n + ⁶Li → T + ⁴He + 4.8 MeV',
      body: ['办法就藏在反应产物里：让飞出的<b>中子</b>去撞<b>锂-6</b>。锂-6 吃掉一个中子后裂成一个氚核和一个氦核，还额外放出 4.8 MeV 的热。',
        '每次聚变只产生 1 个中子，却要换回至少 1 个氚，而中子难免被结构材料吸收或从窗口漏掉。所以包层里还要放<b>中子倍增剂</b>（铍或铅）：一个高能中子打上去能敲出两个。最终每烧掉一个氚能造出的氚数叫<b>氚增殖比 TBR</b>，必须大于 1。'],
      set: 'micro', micro: { play: 'breed', hot: 0.25 }, shot: { t: [0, 0, 0], az: 8, pol: 82, d: 25, fov: 34 }, labels: 'micro',
      legend: ['proton', 'neutron'], panel: { type: 'breeding' }
    },
    {
      id: 'f4', title: '内循环：烧掉的不到 1%', cap: '打进去的燃料绝大部分没烧就被抽出来，净化后再打回去',
      body: ['注入等离子体的氚，只有极小一部分来得及发生聚变——在 ITER 约为千分之几。其余的和氦灰一起流到偏滤器，被<b>低温泵</b>抽走。',
        '抽出的混合气送进氚工厂：<b>尾气处理</b>用钯银合金膜把氢同位素从氦和杂质里筛出来；<b>同位素分离</b>在约 20 K 的低温精馏塔里把氕、氘、氚分开；<b>储存与配送</b>系统把氘氚配好比例，交给<b>加料系统</b>冻成弹丸打回等离子体。这个闭环一圈要几小时。'],
      set: 'machine', layers: CORE, cut: 'onion', fx: BURN, plant: { cycle: 1 }, pipes: ['exhaust', 'tepIss', 'helium', 'issT', 'issD', 'fuel', 'inject'], shot: SHOT.cycle, spin: 0.02,
      labels: [{ id: 'cp', text: '低温泵', sub: '抽走未燃燃料与氦', at: ['pl', 'cryopump'], tone: 'dt' }, { id: 'tep', text: '尾气处理', sub: '钯膜渗透器', at: ['pl', 'tep'], tone: 'dt' }, { id: 'iss', text: '同位素分离', sub: '低温精馏', at: ['pl', 'iss'], tone: 't', side: 'l' },
        { id: 'sds', text: '储存与配送', at: ['pl', 'sds'], tone: 't' }, { id: 'fu', text: '加料', sub: '弹丸 / 喷气', at: ['pl', 'fuelling'], tone: 'dt' }, { id: 'st', text: '除氚后排氦', at: ['pl', 'stack'], tone: 'he', side: 'l' }],
      legend: ['dtPipe', 'dPipe', 'tPipe', 'hePipe'], panel: { type: 'innerLoop' }
    },
    {
      id: 'f5', title: '外循环：从包层里把氚取出来', cap: '新造的氚汇入同一座氚工厂',
      body: ['包层里增殖出的氚混在锂陶瓷小球或液态锂铅里。用低压氦气吹扫（固态）或把液态金属泵出来脱气，就能把氚带出包层，送到<b>包层氚提取</b>系统。',
        '提取出的氚同样进入同位素分离和储存，与内循环回收的氚汇合。于是整座电站从外面只需要补充<b>氘和锂</b>，氚在厂内闭环。难点在于：氚极易渗透进金属和冷却剂，每一处滞留都在抬高“必须的增殖比”。'],
      set: 'machine', layers: CORE, focus: ['blanket'], cut: 'onion', fx: BURN, plant: { cycle: 1 }, pipes: ['bred', 'tesIss', 'issT', 'fuel', 'inject'], shot: { t: [-16, -5, -6], az: -64, pol: 54, d: 70 }, spin: 0.02,
      labels: [{ id: 'bo', text: '增殖包层', sub: '锂 + 中子 → 氚', at: ['pl', 'blanketOut'], tone: 'li' }, { id: 'tes', text: '包层氚提取', at: ['pl', 'tes'], tone: 'li', side: 'l' }, { id: 'iss', text: '同位素分离', at: ['pl', 'iss'], tone: 't', side: 'l' }, { id: 'sds', text: '储存与配送', at: ['pl', 'sds'], tone: 't' }],
      legend: ['tPipe', 'dtPipe'], panel: { type: 'outerLoop' }
    },
    {
      id: 'f6', title: '氚自持：一本要算二十年的账', cap: '增殖要略多于消耗，还要追上衰变与滞留',
      body: ['电站开机需要一笔<b>启动库存</b>。运行后，库存先下降——氚被压进各个回路和包层里“在途”——再随着增殖慢慢回升。',
        '右边是一个三库存模型：储存、内循环、包层。把增殖比调到 1.00，库存会因衰变一路下滑；燃烧率太低，在途量就吃光储存；增殖比到 1.1 左右，几年后能攒出再启动一座堆的量（<b>倍增时间</b>）。这就是为什么工程目标是 TBR ≈ 1.05–1.15，而这个数至今没有在整堆尺度上实测过。'],
      set: 'machine', layers: CORE, cut: 'onion', fx: BURN, plant: { cycle: 1 }, shot: { t: [-14, -6, 2], az: -20, pol: 50, d: 92 }, spin: 0.03,
      labels: [{ id: 'sds', text: '储存', at: ['pl', 'sds'], tone: 't' }, { id: 'iss', text: '内循环在途', at: ['pl', 'iss'], tone: 'dt', side: 'l' }, { id: 'bo', text: '包层在途', at: ['pl', 'blanketOut'], tone: 'li' }],
      legend: ['dtPipe', 'dPipe', 'tPipe', 'hePipe'], panel: { type: 'inventory' }
    },
    {
      id: 'f7', title: 'ITER 怎么验证这件事', cap: '试验包层模块：在真实聚变中子下测增殖',
      body: ['ITER 自己不靠增殖运行，它的氚从外部采购。但它提供了地球上唯一的堆级 14 MeV 中子环境，所以在赤道窗口里留了位置，安装各方研制的<b>试验包层模块（TBM）</b>。',
        '这些模块是未来增殖包层的缩比样机：水冷或氦冷、锂陶瓷球床或液态锂铅。它们要回答的问题是——实测的产氚率和计算对不对得上？氚能不能顺利取出来？这些数据将直接决定第一代发电堆的包层怎么造。'],
      set: 'machine', layers: CORE, focus: ['blanket', 'vessel'], cut: 'onion', fx: BURN, shot: { t: [0, 0.4, 3], az: -30, pol: 72, d: 27 }, spin: 0.03,
      labels: [{ id: 'tbm', text: '赤道窗口', sub: '试验包层模块安装位置', at: ['tk', 'vessel', 12.2, 0.5, 10] }, L.blanket], legend: ['n', 'heat'], panel: { type: 'tbm' }
    },

    /* ================= G · power plant ================= */
    {
      id: 'g1', title: 'ITER 要证明什么', cap: '它是实验堆：验证燃烧等离子体与堆级技术',
      body: ['ITER 的任务书里没有“发电”两个字。它要回答的是：能否让等离子体主要靠自加热稳定燃烧几百秒？超导磁体、遥操作维护、氚处理、偏滤器这些堆级技术，能否在同一台机器上协同工作？',
        '按 2024 年提出的新基线，ITER 计划 <b>2034 年</b>开始氢、氘研究运行，<b>2039 年</b>进入氘氚运行。这比原计划推迟了多年，也说明首台堆级装置的工程难度。'],
      set: 'machine', layers: ALL, cut: 'onion', fx: BURN, shot: SHOT.hero, spin: 0.045,
      labels: [L.plasma, L.person], panel: { type: 'mission' }
    },
    {
      id: 'g2', title: '聚变电站长什么样', cap: '核岛还是那个托卡马克，后面接的是熟悉的蒸汽循环',
      body: ['把 ITER 的屏蔽包层换成<b>增殖包层</b>，把冷却回路接到<b>蒸汽发生器</b>上，后面就是任何热电厂都有的东西：汽轮机、发电机、凝汽器、冷却塔、变压器。',
        '沿着管道看：红色热段把包层的热送到蒸汽发生器，蓝色冷段回流；白色蒸汽推动汽轮机；黄色电力一路上网，另一路折回来给加热系统、低温制冷机和水泵供电——这部分叫<b>厂用电</b>，是聚变电站经济性的关键。'],
      note: '模型里的核岛沿用 ITER 尺寸，仅作示意；DEMO 级装置更大，包层与冷却回路的布置也不同。',
      set: 'machine', layers: CORE, cut: 'onion', fx: BURN, plant: { power: 1 }, shot: SHOT.power, spin: 0.015,
      labels: [{ id: 'sg', text: '蒸汽发生器', at: ['pl', 'sg'], tone: 'heat', side: 'l' }, { id: 'tb', text: '汽轮机', at: ['pl', 'turbine'], tone: 'steam' }, { id: 'gen', text: '发电机', at: ['pl', 'generator'], tone: 'power' },
        { id: 'ct', text: '冷却塔', at: ['pl', 'tower'], tone: 'steam' }, { id: 'grid', text: '电网', at: ['pl', 'grid'], tone: 'power' }, { id: 'rc', text: '厂用电回送', at: ['pl', 'recirc'], tone: 'power', side: 'l' }],
      legend: ['hot', 'cold', 'steam', 'power'], panel: { type: 'plantLegend' }
    },
    {
      id: 'g3', title: '从聚变功率到净电功率', cap: '2 GW 聚变功率，上网的大约只有 500 MW',
      body: ['一座 DEMO 级电站的账大致是这样：2000 MW 聚变功率，加上包层里锂反应的额外放热，共约 2300 MW 热；热电效率三成多，发出约 850 MW 电。',
        '其中三到四成要留给自己：加热与电流驱动、低温、冷却泵、氚工厂。最后上网约 <b>500 MW</b>。调右边的滑块就能看到，净电功率对<b>等离子体 Q</b>和<b>厂用电比例</b>极其敏感——这是聚变电站比裂变电站更“挑参数”的地方。'],
      set: 'machine', layers: CORE, cut: 'onion', fx: BURN, plant: { power: 1 }, pipes: ['bus', 'gridLine', 'recirc', 'hotA', 'hotB'], shot: { t: [30, -5, 12], az: 62, pol: 60, d: 78 }, spin: 0.015,
      labels: [{ id: 'gen', text: '发电机', sub: '总发电', at: ['pl', 'generator'], tone: 'power' }, { id: 'grid', text: '上网', sub: '净电', at: ['pl', 'grid'], tone: 'power' }, { id: 'rc', text: '厂用电', sub: '加热 + 低温 + 泵', at: ['pl', 'recirc'], tone: 'power', side: 'l' }],
      legend: ['hot', 'steam', 'power'], panel: { type: 'plantCalc', preset: 'demo' }
    },
    {
      id: 'g4', title: '材料：被中子打出来的难题', cap: '商用堆第一壁的辐照损伤，是 ITER 的几十倍',
      body: ['14 MeV 中子打进钢里，会把原子从晶格位置上撞开。衡量这种损伤的单位是 <b>dpa</b>（每个原子平均被撞离的次数）。ITER 全寿期结构材料只累积几个 dpa；发电堆的包层每满功率年就要承受十个 dpa 以上。',
        '中子还会在材料里嬗变出氦，让钢变脆、肿胀。为此研制了<b>低活化铁素体/马氏体钢</b>（如 EUROFER、中国的 CLAM）：既更耐辐照，又在停堆约百年后能降到可回收的放射性水平。即便如此，包层和偏滤器仍是消耗品，要用遥操作定期整体更换。'],
      set: 'machine', layers: CORE, focus: ['blanket', 'divertor'], cut: 'wide', fx: BURN, shot: { t: [0, -0.5, 4], az: 20, pol: 70, d: 25 }, spin: 0.03,
      labels: [L.blanket, L.divertor], legend: ['n', 'heat'], panel: { type: 'materials' }
    },
    {
      id: 'g5', title: '路线图：谁在做什么', cap: '大而稳的国际路线，与小而强场的新路线并行',
      body: ['<b>ITER 之后</b>，各方规划了各自的示范堆（DEMO）：欧盟的 EU-DEMO、中国的 CFETR、日本的 JA-DEMO、韩国的 K-DEMO，目标都是在本世纪中叶前后实现氚自持并向电网送电。',
        '另一条路是<b>高温超导强磁场</b>：磁场从 5 T 提到 12 T 以上，同样的性能可以用小得多的装置实现。美国 CFS 的 SPARC、中国合肥的 BEST 都在建造燃烧等离子体实验装置；英国的 STEP 走球形托卡马克路线。右边把这些装置的截面画在同一把尺子上。'],
      note: '计划日期均为各项目公布的目标，不是已发生的事实；核对日期见下方口径表。',
      set: 'machine', layers: ALL, cut: 'onion', fx: GLOW, shot: SHOT.wide, spin: 0.05,
      labels: [L.person], panel: { type: 'roadmap' }
    },
    {
      id: 'g6', title: '还剩下哪些硬骨头', cap: '物理基本清楚，工程和经济性还要一项项兑现',
      body: ['走到并网发电，至少还要同时做到：<b>①</b> 燃烧等离子体长时间稳定运行，不破裂；<b>②</b> 偏滤器长期扛住热流；<b>③</b> 增殖包层实测 TBR > 1，氚循环闭合；<b>④</b> 材料扛住中子，部件能遥操作更换；<b>⑤</b> 可用率和造价让电价有竞争力。',
        '其中没有一项是“原理上不行”，但也没有一项已经在堆级条件下完整验证过。ITER 回答 ①② 和一部分 ③；④⑤ 要靠材料辐照装置和示范堆。聚变不是明天的能源，但路径上的每一步都已经有人在建造。'],
      set: 'machine', layers: CORE, cut: 'onion', fx: BURN, plant: { cycle: 1, power: 1 }, shot: SHOT.plant, spin: 0.035,
      labels: [{ id: 'tp', text: '氚工厂', at: ['pl', 'iss'], tone: 't', side: 'l' }, { id: 'tb', text: '汽轮机岛', at: ['pl', 'turbine'], tone: 'steam' }, { id: 'grid', text: '电网', at: ['pl', 'grid'], tone: 'power' }],
      legend: ['dtPipe', 'tPipe', 'hot', 'steam', 'power'], panel: { type: 'challenges' }
    }
  ];

  SCENES.forEach(function (s, i) {
    s.index = i;
    s.chapter = CHAPTERS.findIndex(function (c) { return c.id === s.id[0]; });
  });
  CHAPTERS.forEach(function (c, i) {
    c.scenes = SCENES.filter(function (s) { return s.chapter === i; }).map(function (s) { return s.index; });
  });

  /* ---------- the schematic pulse (chapter D) ---------- */
  /* A stylised 15 MA inductive discharge. Times are of the right order for
   * ITER's Q = 10 scenario but the curves are hand-drawn ramps, not a
   * simulation. Returns programme values plus the 3D effect channels. */
  function ramp(t, a, b) { return Math.min(1, Math.max(0, (t - a) / (b - a))); }
  function pulse(t) {
    var up = ramp(t, 2, 80), down = 1 - ramp(t, 610, 750);
    var ip = 15 * Math.min(up, down);
    var heatOn = ramp(t, 82, 104) * (1 - ramp(t, 525, 575));
    var burn = ramp(t, 98, 130) * (1 - ramp(t, 520, 585));
    var exists = t >= 0 && t <= 750 ? 1 : 0;
    var pre = t < 0 ? ramp(t, -30, -4) : 0;
    var phase = t < 0 ? '预充' : t < 2 ? '击穿' : t < 80 ? '电流爬升' : t < 130 ? '加热' : t < 520 ? '燃烧平顶' : t < 610 ? '熄火' : t < 750 ? '电流下降' : '结束';
    return {
      t: t, phase: phase, ip: ip, pAux: 50 * heatOn, pFus: 500 * burn * burn,
      /* solenoid current: +full before breakdown, swings through zero to −full at end of flat-top */
      cs: t < 0 ? pre : 1 - 2 * ramp(t, 0, 600),
      density: 1.0 * Math.min(ramp(t, 2, 110), down) * exists,
      fx: {
        plasma: exists * (0.12 + 0.88 * Math.min(ramp(t, 0, 60), 1 - ramp(t, 640, 750))),
        flicker: exists * (1 - ramp(t, 1, 10)),
        heat: Math.max(0.12 * up * down, 0.25 * heatOn + 0.75 * burn),
        current: exists * Math.min(up, down) * 0.9,
        particles: exists * 0.8 * Math.min(ramp(t, 1, 40), down),
        strike: exists * ramp(t, 40, 80) * down,
        neutrons: burn, alphas: burn, blanketHeat: burn,
        nbi: ramp(t, 84, 90) * (1 - ramp(t, 525, 540)),
        ec: Math.max(ramp(t, -1.5, 0) * (1 - ramp(t, 4, 8)), ramp(t, 82, 88) * (1 - ramp(t, 550, 575))),
        ic: ramp(t, 92, 100) * (1 - ramp(t, 525, 545)),
        pellets: ramp(t, 100, 110) * (1 - ramp(t, 505, 520)),
        csGlow: t < 0 ? pre * 0.9 : Math.abs(1 - 2 * ramp(t, 0, 600)) * 0.9 * (1 - ramp(t, 700, 760)),
        tfGlow: 0.28, pfGlow: exists * 0.35 * Math.min(1, up * 2) * down
      }
    };
  }

  FL.content = { CHAPTERS: CHAPTERS, SCENES: SCENES, pulse: pulse, PULSE_RANGE: [-30, 780] };
})();
