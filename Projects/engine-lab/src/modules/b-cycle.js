/* 02 · 四个冲程 The Four Strokes */
'use strict';
registerModule({
  id: 'cycle', num: '02', name: '四个冲程', en: 'The cycle',
  desc: '进气 → 压缩 → 做功 → 排气，720° 走一遍。',
  quiz: {
    q: '四个冲程里，哪个是唯一对外输出动力的冲程？',
    opts: ['进气', '压缩', '做功', '排气'],
    ans: 2,
    why: '只有做功冲程是高压燃气推活塞输出功；进气、压缩、排气都要消耗曲轴动能，由飞轮储能供给。',
  },
  scenes: [
    { key: 'intake', name: '进气冲程', en: 'Intake', narr: '0°–180°：活塞下行形成低压，进气门开着，大气把新鲜混合气压进气缸。排气门此时已基本关闭。', angle: 90, spin: false },
    { key: 'compression', name: '压缩冲程', en: 'Compression', narr: '180°–360°：进气门在压缩初段才关闭（IVC 245°），随后两门全关，活塞上行把气体压到约 1/11 容积，压力和温度一起升高。', angle: 290 },
    { key: 'spark', name: '点火时刻', en: 'Ignition', narr: '358°：上止点前 2° 火花塞跳火。燃烧需要时间，提前点火才能让最高压力正好出现在活塞开始下行时。', angle: 362 },
    { key: 'power', name: '做功冲程', en: 'Power', narr: '360°–540°：燃烧气体膨胀，推动活塞下行输出动力。压力从峰值约 70 bar 一路降到几 bar——做功的过程就是压力衰减的过程。', angle: 430, spin: false },
    { key: 'exhaust', name: '排气冲程', en: 'Exhaust', narr: '540°–720°：排气门在做功末段已提前打开，残压自动泄出（blowdown），上行活塞把残余废气推出去。', angle: 630 },
    { key: 'full', name: '连续循环', en: 'Full cycle', narr: '连续播放：注意每 720° 只有中段一次“橙色爆闪”。气门叠开出现在排气→进气交接（约 695°–25°），废气惯性顺便帮新气进缸。', spin: true },
  ],
});
