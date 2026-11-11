/* 01 · 结构拆解 Anatomy */
'use strict';
registerModule({
  id: 'anatomy', num: '01', name: '结构拆解', en: 'Anatomy',
  desc: '认识一台单缸四冲程发动机的每个零件。',
  quiz: {
    q: '为什么四冲程发动机的曲轴要转两圈（720°）才完成一个循环？',
    opts: ['转两圈才够摩擦生热', '四个冲程各占曲轴一圈的一半（180°），合计 720°', '因为飞轮太重', '为了配气'],
    ans: 1,
    why: '每个冲程对应活塞从上止点到下止点一次，曲轴转 180°；进压做排四个冲程合计 720°。凸轮轴因此正好转一圈。',
  },
  scenes: [
    { key: 'overview', name: '整机纵剖', en: 'Cutaway', narr: '这是纵剖视图：上部是气缸与缸盖，中部活塞在缸内上下运动，下部是曲轴和飞轮。先看全景。', spin: true },
    { key: 'piston', name: '活塞与环', en: 'Piston & rings', narr: '活塞把气体压力变成直线运动；三道环：两道气环密封燃烧气体，一道油环刮掉缸壁多余机油。', highlight: 'piston', angle: 120 },
    { key: 'conrod', name: '连杆与曲轴', en: 'Conrod & crank', narr: '连杆把活塞的直线运动传给曲轴曲柄销。注意轨迹不是正弦：连杆倾斜让上止点附近更“尖”、下止点附近更“平”。', highlight: 'conrod', spin: true },
    { key: 'valves', name: '气门与弹簧', en: 'Valves', narr: '进气门（蓝）放进混合气，排气门（红）放出废气。弹簧负责把气门压回关闭位——凸轮只负责推开它。', highlight: 'valves', spin: true },
    { key: 'plug', name: '火花塞', en: 'Spark plug', narr: '火花塞在压缩末段跳火，点燃被压缩的混合气。点火时刻在上止点前几度，详见“点火正时”模块。', highlight: 'plug', angle: 358 },
    { key: 'flywheel', name: '飞轮', en: 'Flywheel', narr: '只有做功冲程输出动力，其余三个冲程靠飞轮储存的动能带着曲轴转过去。飞轮是这台发动机的“电池”。', highlight: 'flywheel', spin: true },
    { key: 'block', name: '缸体与水套', en: 'Block & jacket', narr: '缸壁外侧的点阵是水套。燃烧室温度上千度，靠循环冷却水带走多余热量，保持金属和润滑在可用范围。', highlight: 'block', angle: 200 },
  ],
});
