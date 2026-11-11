/* 03 · 配气正时 Valve timing */
'use strict';
registerModule({
  id: 'timing', num: '03', name: '配气正时', en: 'Valve timing',
  desc: '气门何时开、何时关，以及为什么不是正好 0° 和 180°。',
  quiz: {
    q: '进气门为什么在活塞过了下止点之后才关闭（IVC 245°）？',
    opts: ['防止漏气', '利用进气气流的惯性，活塞开始上行时还能继续充进一段气', '设计失误', '为了降温'],
    ans: 1,
    why: '下止点时进气道里的气还在高速流入，晚关气门让惯性继续充气，增加充气量——这是转速越高越明显的手法。',
  },
  scenes: [
    { key: 'lift', name: '升程曲线', en: 'Lift curves', narr: '两条半正弦升程曲线横轴是 0–720°。青色区是气门叠开：排气门还没关严、进气门已经提前打开。拖动角度游标对照。', tool: 'lift', spin: true },
    { key: 'overlap', name: '气门叠开', en: 'Valve overlap', narr: '约 695°→25° 两门同开。排气废气正高速冲出排气道，在进气口形成低压“抽吸”，帮新鲜气体进来。高转速机叠开角更大。', tool: 'lift', angle: 705 },
    { key: 'ivc', name: '晚进与晚排', en: 'IVC & EVC', narr: '进气门关在 245°（过了下止点 65°），排气门关在 25°（过了上止点 25°）。四个开闭点都不落在死点，全部为气流惯性让路。', tool: 'strip', angle: 230 },
    { key: 'cam', name: '凸轮轴 2:1', en: 'Cam drive', narr: '曲轴齿轮带动凸轮轴齿轮，传动比 2:1：曲轴转 720°，凸轮轴正好转 360°——每个气门一个循环只被顶开一次。', tool: 'gears', spin: true },
  ],
});
