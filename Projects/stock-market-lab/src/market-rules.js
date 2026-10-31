/* Stock Market Lab — market rules, dated and sourced.
 *
 * Rules change. Every entry carries the date it was checked and, where it
 * matters, the date it took effect. The lab only models common cases; anything
 * not covered is labelled as an introduction, not a full simulation.
 *
 * CHECKED: 2026-10-31 (Asia/Shanghai)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.SM = root.SM || {}; root.SM.rules = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ASOF = '2026-10-31';

  var sources = [
    { label: '上海证券交易所 · 交易规则', url: 'https://www.sse.com.cn/lawandrules/sselawsrules/stock/trading/', kind: 'official', note: '沪市交易规则与业务细则' },
    { label: '深圳证券交易所 · 交易规则', url: 'https://www.szse.cn/lawrules/rule/trade/', kind: 'official', note: '深市交易规则与业务细则' },
    { label: '中国证监会', url: 'https://www.csrc.gov.cn/', kind: 'official', note: '监管规则与政策发布' },
    { label: '沪深北交易所 2026 年修订《交易规则》（2026-07-06 施行）', url: 'https://www.cnstock.com/commonDetail/688560', kind: 'media', note: '主板风险警示股票涨跌幅调整为 10% 等' },
    { label: '上海证券交易所 · 交易规则修订技术指南', url: 'https://www.sse.com.cn/services/tradingtech/development/c/10816505/files/8006a51174524e7cae832568b5e726a6.pdf', kind: 'official', note: '2026 年修订的技术准备说明' },
    { label: 'SEC · T+1 交收生效（2024-05-28）', url: 'https://www.sec.gov/newsroom/press-releases/2024-62', kind: 'official', note: '美国证券交易标准交收周期缩短至 T+1' },
    { label: 'Investor.gov · 日内交易与保证金', url: 'https://www.investor.gov/introduction-investing/investing-basics/glossary/pattern-day-trader', kind: 'official', note: 'PDT 25,000 美元与保证金账户说明' },
    { label: 'FINRA Rule 4210 · 保证金要求', url: 'https://www.finra.org/rules-guidance/rulebooks/finra-rules/4210', kind: 'official', note: '初始与维持保证金要求' },
    { label: 'LULD Plan · 涨跌停带', url: 'https://www.luldplan.com/', kind: 'official', note: '个股价格波动带与停牌机制' },
    { label: 'NYSE · 市场级熔断', url: 'https://www.nyse.com/markets/nyse/trading-info', kind: 'official', note: 'Level 1/2/3 熔断与交易时段' }
  ];

  var cn = {
    id: 'cn',
    label: 'A 股',
    full: '中国境内证券交易所（沪、深、北）',
    currency: 'CNY',
    currencyLabel: '人民币',
    colorScheme: 'red-up',
    exchanges: '上海证券交易所、深圳证券交易所、北京证券交易所',
    sessions: [
      { name: '开盘集合竞价', time: '09:15 – 09:25', note: '09:20–09:25 通常不可撤单' },
      { name: '上午连续竞价', time: '09:30 – 11:30' },
      { name: '下午连续竞价', time: '13:00 – 14:57' },
      { name: '收盘集合竞价', time: '14:57 – 15:00', note: '沪深均设收盘集合竞价' },
      { name: '盘后固定价格交易', time: '15:05 – 15:30', note: '科创板、创业板先行；2026 年新规扩展至全部 A 股与 ETF，具体以交易所规则为准' }
    ],
    settlement: {
      stock: 'T+1 交收',
      sellRestriction: 'T+1 回转：当日买入的股票，次一交易日起才能卖出',
      cash: '卖出所得资金当日通常可继续买入，提现时间以券商为准',
      note: '股票 T+1；债券、部分 ETF 等品种的回转规则不同，不能一概而论'
    },
    limits: [
      { scope: '主板普通股票', pct: 10, effective: '长期', note: 'ST/*ST 自 2026-07-06 起由 5% 调整为 10%' },
      { scope: '创业板、科创板', pct: 20, effective: '长期', note: '风险警示股票同样为 20%' },
      { scope: '北交所', pct: 30, effective: '长期' },
      { scope: '新股上市前 5 个交易日', pct: null, effective: '全面注册制以来', note: '不设涨跌幅限制；第 6 个交易日起按所属板块执行' }
    ],
    lot: { buy: 100, note: '主板/创业板 100 股整数倍；科创板 200 股起、1 股递增；零股可一次性卖出' },
    shortSelling: '融资融券受标的名单、投资者资格与监管条件约束，不是所有股票都能融券卖空',
    volatilityControls: '个股涨跌幅限制、盘中异常波动临时停牌、严重异常波动核查；与美股 LULD 不是同一机制',
    fees: {
      commissionRate: 0.00025,
      minCommission: 5,
      stampRate: 0.0005,
      transferRate: 0.00001,
      note: '佣金为示例费率，最高不超过成交额 3‰ 且通常有最低 5 元；印花税卖出单边 0.05%；过户费双向 0.001%。实际以券商与登记结算规则为准。'
    }
  };

  var us = {
    id: 'us',
    label: '美股',
    full: '美国证券交易所（NYSE、Nasdaq 等）',
    currency: 'USD',
    currencyLabel: '美元',
    colorScheme: 'green-up',
    exchanges: '纽约证券交易所（NYSE）、纳斯达克（Nasdaq）等全国性交易所与多家另类交易系统',
    sessions: [
      { name: '盘前', time: '04:00 – 09:30 ET', note: '各交易场所与券商支持程度不同' },
      { name: '常规交易', time: '09:30 – 16:00 ET' },
      { name: '盘后', time: '16:00 – 20:00 ET', note: '流动性通常更差，价差更宽' }
    ],
    settlement: {
      stock: 'T+1 交收（2024-05-28 起）',
      sellRestriction: '常规账户通常允许当日回转交易，但受账户类型、保证金与 PDT 等规则约束',
      cash: '交收与“资金可用/可提”不是同一概念，券商可能先行融通',
      note: 'T+1 交收 ≠ T+1 回转限制；不要与 A 股的 T+1 混为一谈'
    },
    limits: [
      { scope: '常规股票', pct: null, effective: '长期', note: '没有统一的每日涨跌幅限制，价格由撮合形成' },
      { scope: 'LULD 价格带', pct: null, effective: '现行', note: 'Tier 1 股价 > $3 通常为 5%，$0.75–$3 为 10%；Tier 2 为 20%，触发后短暂停牌' },
      { scope: '市场级熔断', pct: null, effective: '现行', note: '标普 500 较前收跌 7% / 13% / 20% 分三级；前两级 15:25 前停 15 分钟，第三级全天停' }
    ],
    lot: { buy: 1, note: '按股交易；部分券商支持碎股，交易所与产品规则可能不同' },
    shortSelling: '卖空受 Reg SHO、保证金、券商可借券源与账户资格约束；PDT 规则要求保证金账户维持 25,000 美元以上才能频繁日内交易',
    volatilityControls: 'LULD 个股价格带停牌、市场级熔断、交易所异常波动处置，三者层级不同',
    fees: {
      commissionRate: 0,
      minCommission: 0,
      secFeeRate: 0.0000278,
      tafPerShare: 0.000166,
      tafMax: 8.3,
      note: '许多券商股票佣金为 0；卖出时可能有 SEC 监管费与 FINRA TAF。费率为示例，随年度与成交金额调整，可在界面修改。'
    }
  };

  var comparison = [
    { dimension: '主要交易所', cn: '上交所、深交所、北交所', us: 'NYSE、Nasdaq 等', note: '交易所规则与上市标准并不统一' },
    { dimension: '计价货币', cn: '人民币（CNY）', us: '美元（USD）', note: '跨境投资还要考虑汇率' },
    { dimension: '红绿配色', cn: '常见红涨绿跌', us: '常见绿涨红跌', note: '只是软件习惯，可切换；颜色不是唯一信息通道' },
    { dimension: '当日买卖', cn: '股票 T+1 回转，当日买入次日才能卖', us: '常规账户通常可当日回转，受账户与 PDT 约束', note: 'A 股是“回转限制”，美股是“交收周期”，两个概念' },
    { dimension: '结算周期', cn: '证券 T+1 交收', us: '证券 T+1 交收（2024-05-28 起）', note: '交收完成时间不等于可交易时间' },
    { dimension: '涨跌幅机制', cn: '主板 10%、创业板/科创板 20%、北交所 30%，新股前 5 日不设限', us: '无统一日涨跌幅；有个股 LULD 价格带与市场级熔断', note: '机制层级不同，不能直接比较“谁更自由”' },
    { dimension: '最小交易单位', cn: '通常 100 股；科创板 200 股起、1 股递增', us: '1 股；部分券商支持碎股', note: '以交易所与券商规则为准' },
    { dimension: '卖空与融资', cn: '融资融券标的与资格限制', us: '保证金账户、可借券源、PDT 等限制', note: '杠杆成本与强平规则由券商合同决定' },
    { dimension: '交易时间', cn: '09:15–15:00（北京时间），含集合竞价', us: '09:30–16:00（美东时间），另有盘前盘后', note: '夏令时切换会让北京时间的对应时刻变化' },
    { dimension: '波动控制', cn: '涨跌幅限制 + 临时停牌', us: 'LULD + 市场级熔断', note: '个股层面与市场层面要分开看' }
  ];

  /* ---------------- rule calculators (pure) ---------------- */

  function cnLimitPct(scope) {
    if (scope === 'star' || scope === 'chinext') return 20;
    if (scope === 'bse') return 30;
    if (scope === 'new') return null;
    return 10;
  }

  // A-share limit prices are rounded to the 0.01 tick.
  function limitPrices(prevClose, pct) {
    if (pct == null) return { upper: null, lower: null, pct: null };
    var up = Math.round(prevClose * (1 + pct / 100) * 100) / 100;
    var lo = Math.round(prevClose * (1 - pct / 100) * 100) / 100;
    return { upper: up, lower: lo, pct: pct };
  }

  function roundLot(qty, lot) {
    lot = lot || 100;
    return Math.floor(qty / lot) * lot;
  }

  function usLuldBand(refPrice, tier) {
    var pct;
    if (tier === 2) pct = 20;
    else if (refPrice > 3) pct = 5;
    else pct = 10;
    return {
      pct: pct,
      lower: Math.round(refPrice * (1 - pct / 100) * 100) / 100,
      upper: Math.round(refPrice * (1 + pct / 100) * 100) / 100,
      tier: tier || 1
    };
  }

  function usMarketBreaker(sp500Pct) {
    var drop = -sp500Pct;
    if (drop >= 20) return { level: 3, action: '全天停止交易', pct: 20 };
    if (drop >= 13) return { level: 2, action: '15:25 前停牌 15 分钟', pct: 13 };
    if (drop >= 7) return { level: 1, action: '15:25 前停牌 15 分钟', pct: 7 };
    return { level: 0, action: '正常交易', pct: null };
  }

  // Which A-share "board" a code belongs to (teaching helper only).
  function boardOf(code) {
    code = String(code || '').replace(/\D/g, '');
    if (/^688|^689/.test(code)) return { key: 'star', label: '科创板', limitPct: 20, lot: 200 };
    if (/^30/.test(code)) return { key: 'chinext', label: '创业板', limitPct: 20, lot: 100 };
    if (/^(8|4|92)/.test(code)) return { key: 'bse', label: '北交所', limitPct: 30, lot: 100 };
    return { key: 'main', label: '主板', limitPct: 10, lot: 100 };
  }

  return {
    asOf: ASOF,
    disclaimer: '规则按 ' + ASOF + ' 可核对的公开资料整理，可能变化；教学模拟不覆盖全部证券、板块与特殊时段，实际以交易所和券商现行规则为准。',
    sources: sources,
    markets: { cn: cn, us: us },
    comparison: comparison,
    pricing: {
      cn: { currency: 'CNY', tick: 0.01, colorScheme: 'red-up' },
      us: { currency: 'USD', tick: 0.01, colorScheme: 'green-up' }
    },
    cnLimitPct: cnLimitPct,
    limitPrices: limitPrices,
    roundLot: roundLot,
    usLuldBand: usLuldBand,
    usMarketBreaker: usMarketBreaker,
    boardOf: boardOf
  };
});
