/* 07 · 汽油 vs 柴油 Gasoline vs Diesel */
'use strict';
registerModule({
  id: 'compare', num: '07', name: '汽油对比柴油', en: 'Gasoline vs Diesel',
  desc: '同一套四冲程，两种点火哲学：火花点燃 vs 压燃。',
  quiz: {
    q: '柴油机为什么不需要火花塞？',
    opts: ['柴油更便宜', '压缩比高到压缩终了空气温度超过柴油自燃点，喷油即燃', '柴油自己会冒火花', '转速太低'],
    ans: 1,
    why: 'CR 16–22 让压缩终了空气达到 900 K 以上，柴油雾滴喷入即自燃。汽油反过来不能用高压燃——会爆震。',
  },
  scenes: [
    { key: 'side', name: '并排看', en: 'Side by side', narr: '左边汽油机（火花塞，CR≈11.7），右边柴油机（喷油嘴，CR≈18）。同样的四个冲程，只有“怎么点燃”不同。', tool: 'compare', spin: true },
    { key: 'intake', name: '进气差', en: 'Intake', narr: '汽油机进气冲程吸入的是汽油+空气混合气；柴油机只吸纯空气——燃油在压缩末才直接喷进燃烧室，避免提前点燃。', tool: 'compare', angle: 90 },
    { key: 'ignite', name: '点燃差', en: 'Ignition', narr: '汽油机 358° 火花跳火；柴油机约 350° 喷油嘴雾化喷入高温空气，十几度后自燃起火。柴油机没有“点火提前角”，只有“喷油提前角”。', tool: 'compare', angle: 365 },
    { key: 'eff', name: '效率差', en: 'Efficiency', narr: '理想循环效率 η=1−CR^−0.3：CR 11 约 51%，CR 18 约 58%。柴油机热效率更高，根源就是压缩比更高。', tool: 'effbar', spin: false },
    { key: 'use', name: '用途分野', en: 'Where each wins', narr: '柴油机低速扭矩大、耐久、省油——卡车、船、发电机；汽油机转速高、轻、便宜、安静——乘用车。四冲程本身两种都用。', tool: 'effbar', spin: false },
  ],
});
