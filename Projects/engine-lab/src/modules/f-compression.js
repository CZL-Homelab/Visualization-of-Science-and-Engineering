/* 06 · 压缩比 Compression ratio */
'use strict';
registerModule({
  id: 'cr', num: '06', name: '压缩比', en: 'Compression ratio',
  desc: '把混合气压到多小：越高越有效率，但汽油机会爆震。',
  controls: [{ key: 'cr', label: '压缩比 CR', min: 6, max: 15, step: 0.5, def: 11.7 }],
  quiz: {
    q: '汽油机压缩比的上限主要由什么决定？',
    opts: ['缸径大小', '爆震极限——压缩终了温度压力过高会让混合气自燃', '飞轮重量', '排气门角度'],
    ans: 1,
    why: '压缩终了温度过高时混合气在火花点火前自燃（超级爆震），所以汽油机压缩比通常止步于 13–14；柴油机靠压燃反而要高压缩比。',
  },
  scenes: [
    { key: 'slider', name: '压缩比实验台', en: 'CR bench', narr: '拖动压缩比滑块，观察压缩终了（点火前）的压力与温度读数。压力 ∝ CR^1.3，温度 ∝ CR^0.3。', tool: 'crbench', spin: false },
    { key: 'temp', name: '温度才是真正的上限', en: 'Temperature', narr: 'CR=11 时压缩终了约 700 K；CR=13.5 逼近汽油自燃温度区间——再加就爆震。这就是现代汽油机压缩比停在 13 左右的原因。', tool: 'crbench', angle: 350 },
    { key: 'limit', name: '汽油机的天花板', en: 'Gasoline ceiling', narr: '红线标出教学用爆震极限 CR≈13.5。越过红线，压缩末期混合气自燃、压力波与火焰对冲——直喷、阿特金森循环都在红线内做文章。', tool: 'crbench', angle: 0 },
    { key: 'diesel', name: '柴油机反过来用', en: 'Diesel', narr: '柴油机 CR 16–22：压缩终了空气温度约 900–1000 K，喷入的柴油雾滴直接自燃——不需要火花塞。压燃换来的代价是更重更硬的机体。', tool: 'diesel', spin: true },
  ],
});
