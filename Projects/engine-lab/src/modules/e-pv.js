/* 05 · 示功图 The P-V diagram */
'use strict';
registerModule({
  id: 'pv', num: '05', name: '示功图', en: 'P-V diagram',
  desc: '压力×体积的闭合环——环的面积就是发动机一个循环做的净功。',
  quiz: {
    q: 'P-V 图上闭合环的面积代表什么？',
    opts: ['活塞质量', '一个循环的净指示功（做功减去压缩付出的功）', '油耗', '排气量'],
    ans: 1,
    why: '膨胀线下的面积是气体对外做的功，压缩线下的面积是活塞对气体付出的功，两者之差正是闭合环面积——净功。',
  },
  scenes: [
    { key: 'loop', name: '闭合环', en: 'The loop', narr: '横轴气缸容积 V，纵轴压力 P。青线是压缩，橙线是燃烧+膨胀，灰线是排气与进气。随曲轴转动描点。', tool: 'pv', spin: true },
    { key: 'compress', name: '压缩段', en: 'Compression', narr: '从下止点（右）到上止点（左）：体积缩到约 1/11，压力沿 P·V^1.3 爬到几十 bar——这段是活塞“付出去”的功。', tool: 'pv', angle: 260 },
    { key: 'burn', name: '燃烧竖跳', en: 'Combustion jump', narr: '上止点附近体积几乎不变而压力近乎垂直跳升——燃烧在极小体积变化内把压力推到峰值约 70 bar。', tool: 'pv', angle: 375 },
    { key: 'area', name: '面积=功', en: 'Area = work', narr: '橙色阴影是环内面积：膨胀“赚”的功减去压缩“花”的功，剩下净功输出给曲轴。这就是示功图的本质。', tool: 'pv', angle: 480 },
    { key: 'cr', name: '压缩比的影响', en: 'With compression ratio', narr: '拖动压缩比：环整体变高变宽，净功增大——但汽油机压缩比受爆震限制，见下一模块。', tool: 'pv', spin: false },
  ],
  controls: [{ key: 'cr', label: '压缩比 CR', min: 7, max: 14, step: 0.5, def: 11.7 }],
});
