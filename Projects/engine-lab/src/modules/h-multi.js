/* 08 · 四缸机 Inline Four */
'use strict';
registerModule({
  id: 'multi', num: '08', name: '四缸机', en: 'Inline four',
  desc: '单缸每 720° 只有一次爆发；四缸把它摊成每 180° 一次。',
  quiz: {
    q: '直列四缸机曲轴每转两圈（720°）里点火几次？',
    opts: ['1 次', '4 次——四个缸轮流，每 180° 一次', '8 次', '2 次'],
    ans: 1,
    why: '每个缸 720° 循环点火一次，四个缸错开排列，合计每 180° 就有一缸点火，动力间隔均匀四倍于单缸。',
  },
  scenes: [
    { key: 'gap', name: '单缸的空窗', en: 'Single-cylinder gap', narr: '只看缸 1：橙色脉冲 720° 里只出现一次，其余 540° 全靠飞轮动能撑着。这就是单缸机怠速“突突”的原因。', tool: 'multi', angle: 100 },
    { key: 'phase', name: '四缸的相位', en: 'Phases', narr: '曲柄相位 0/540/180/360°：活塞 1 与 4 同上下、2 与 3 同上下（互相镜像）。两两配对，惯性力先抵消一半。', tool: 'multi', spin: true },
    { key: 'order', name: '点火顺序 1-3-4-2', en: 'Firing order', narr: '点火沿 1→3→4→2，脉冲间隔正好 180°——曲轴每半圈收到一次推力，输出从“脉冲”变成“连续”。', tool: 'multi', angle: 372 },
    { key: 'balance', name: '飞轮与平衡', en: 'Flywheel & balance', narr: '四缸仍需飞轮：180° 间隔仍有扭矩波动，且排气/二阶惯性力无法完全平衡。缸数越多越顺，代价是更重更贵。', tool: 'multi', spin: true },
  ],
});
