/* 04 · 点火正时 Ignition timing */
'use strict';
registerModule({
  id: 'spark', num: '04', name: '点火正时', en: 'Ignition timing',
  desc: '点火提前角：太早敲缸回火，太晚没劲发热。',
  controls: [{ key: 'advance', label: '点火提前角 advance', min: -6, max: 36, step: 1, def: 12 }],
  quiz: {
    q: '点火提前角过大最典型的坏结果是什么？',
    opts: ['油耗降低', '爆震（敲缸）与回火，严重时损坏发动机', '功率无限增大', '排放变干净'],
    ans: 1,
    why: '过早点火让燃烧压力在活塞还在上行时就达到峰值，反向冲击活塞（爆震）；火焰甚至可能窜回进气道（回火）。',
  },
  scenes: [
    { key: 'curve', name: '功率-提前角曲线', en: 'Power vs advance', narr: '横轴点火提前角（上止点前度数），纵轴相对功率。峰值在约 12° 附近：燃烧要有时间，压力峰值要刚好落在活塞开始下行之后。拖动滑块。', tool: 'advcurve', spin: false },
    { key: 'ideal', name: '最佳点', en: 'Best advance', narr: '提前角 12°：火焰从火花塞蔓延到整个燃烧室约需十几度曲轴转角，最高压力落在上止点后 10–20°，活塞已下行，做功最有效。', tool: 'engine', angle: 372 },
    { key: 'early', name: '太早：爆震', en: 'Too early', narr: '提前角拉到 30°+：混合气在活塞到达上止点前大量燃烧，压力顶着上行活塞反做负功，压力波撞击缸壁——爆震。高温高压还会烧蚀零件。', tool: 'engine', angle: 330 },
    { key: 'late', name: '太晚：没劲又发热', en: 'Too late', narr: '提前角 0° 或更晚：燃烧大半发生在活塞已下行之后，压力做不了多少功，热量留给排气——功率掉、排气温度飙，还容易回火。', tool: 'engine', angle: 400 },
  ],
});
