/* Module F — IPO and capital operations.
 *
 * F1 IPO mechanics, F2 proceeds vs market cap, F3 demand curve and pricing,
 * F4 aftermarket wealth effects, F5 four refinancing routes, F6 buyback /
 * split / dividend / stock-funded merger, F7 a map of capital operations.
 *
 * All money values inside this module are in 亿元 and all share counts in
 * 亿股, so 亿股 × 元 = 亿元 and 亿元 ÷ 亿股 = 元/股. The shared core functions
 * are unit-agnostic; the only place that needs raw units is buyback(), whose
 * repurchase count is floored to whole shares.
 */
(function () {
  'use strict';
  var SM = window.SM;
  var ui = SM.ui, core = SM.core, charts = SM.charts, sim = SM.sim;
  var YI = 1e8;

  var DEFAULT = {
    mode: 'f1',
    preShares: 1.00, prePrice: 10,
    newShares: 0.25, offerPrice: 12,
    profit: 1.00, marketPE: 25, demandHeat: 1.0,
    feeRate: 6,
    transferMode: 'new', oldShares: 0.15,
    secondaryPrice: 12,
    refinance: 'issue', raiseAmount: 3.0,
    debtRate: 5, convCoupon: 2, convPremium: 20, rightsDiscount: 30,
    buybackCash: 0.5, splitRatio: 2, dps: 0.4,
    dealTargetValue: 3.0, dealPremium: 30, dealTargetProfit: 0.6
  };

  var OWNER_DEF = [
    { name: '创始人', pct: 60, key: 'cyan' },
    { name: '早期投资人', pct: 24, key: 'blue' },
    { name: '员工持股', pct: 16, key: 'yellow' }
  ];

  var MYTHS = [
    {
      s: 'IPO 募资 3 亿元，公司的市值就因此增加 3 亿元。',
      ans: false,
      why: '募资是公司收到的<b>现金</b>；市值是<b>股价 × 总股本</b>。两者口径不同，不能相加。'
    },
    {
      s: '老股转让的钱，最后会进入公司账户。',
      ans: false,
      why: '老股转让是现有股东把股票卖给新投资者，<b>现金归卖方</b>，公司股本和现金都不变。'
    },
    {
      s: '拆股后股数变多，公司的总市值也会随之变大。',
      ans: false,
      why: '股数 × 比例、股价 ÷ 比例，<b>总市值不变</b>；变化的只是计价单位。'
    },
    {
      s: '回购注销减少股本，在利润不变时可能抬高每股收益。',
      ans: true,
      why: '分母变小，同样的利润分到更少股份上，<b>EPS 上升</b>；但公司也付出现金，市值等额下降。'
    }
  ];

  var CSS = [
    '.fipo-wrap{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0}',
    '.fipo-h{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}',
    '.fipo-h .k{font-family:var(--mono);font-size:9px;letter-spacing:.12em;color:var(--dim)}',
    '.fipo-h b.t{font-size:12.5px;color:var(--text);font-weight:600}',
    '.fipo-note{font-size:10.5px;color:var(--dim);line-height:1.6}',
    '.fipo-note b{color:var(--muted);font-weight:500}',
    '.fipo-sec{font-family:var(--mono);font-size:9px;letter-spacing:.12em;color:var(--dim);display:flex;justify-content:space-between;gap:8px}',

    /* F1 */
    '.fipo-f1{height:100%;min-height:0}',
    '.fipo-f1-left{display:flex;flex-direction:column;gap:8px;min-height:0}',
    '.fipo-f1-left .chart{flex:1;min-height:150px}',
    '.fipo-f1-right{display:flex;flex-direction:column;gap:8px;min-height:0;overflow:auto;padding-right:2px}',
    '.fipo-f1-right .metrics{margin:0}',

    /* F2 */
    '.fipo-f2{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0}',
    '.fipo-money{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;flex:1;min-height:0}',
    '.fipo-mc{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 16px 13px;display:flex;flex-direction:column;gap:8px;min-width:0;overflow:hidden}',
    '.fipo-mc::before{content:"";position:absolute;left:0;top:16px;bottom:16px;width:2px;border-radius:2px;background:var(--cyan)}',
    '.fipo-mc.b::before{background:var(--blue)}',
    '.fipo-mc.c::before{background:var(--violet)}',
    '.fipo-mc .idx{font-family:var(--mono);font-size:10px;color:var(--dim)}',
    '.fipo-mc .lab{font-size:12px;color:var(--muted)}',
    '.fipo-mc .val{font-family:var(--mono);font-size:clamp(23px,2.5vw,33px);font-weight:600;letter-spacing:-.02em;line-height:1.1;word-break:break-all}',
    '.fipo-mc .sub{font-family:var(--mono);font-size:10px;color:var(--dim);line-height:1.55}',
    '.fipo-mc .extra{font-size:10.5px;color:var(--muted);border-top:1px dashed var(--line);padding-top:8px;margin-top:auto;line-height:1.55}',
    '.fipo-mc.a .val{color:var(--cyan)}',
    '.fipo-mc.zero .val{color:var(--red)}',
    '.fipo-mc .tag2{position:absolute;top:12px;right:12px;font-family:var(--mono);font-size:8.5px;letter-spacing:.06em;border:1px solid var(--line);border-radius:4px;padding:1px 5px;color:var(--dim);white-space:nowrap}',
    '.fipo-mc.a .tag2{color:var(--cyan);border-color:color-mix(in srgb,var(--cyan) 35%,transparent)}',
    '.fipo-mc.b .tag2{color:var(--blue);border-color:color-mix(in srgb,var(--blue) 40%,transparent)}',
    '.fipo-mc.c .tag2{color:var(--violet);border-color:color-mix(in srgb,var(--violet) 40%,transparent)}',
    '.fipo-toggle{display:flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--panel)}',
    '.fipo-toggle button{border:0;background:transparent;color:var(--muted);font-size:11px;padding:5px 12px;cursor:pointer;font-family:var(--sans)}',
    '.fipo-toggle button[aria-pressed="true"]{background:var(--panel-3);color:var(--cyan)}',
    '.fipo-f2-bottom{display:grid;grid-template-columns:1.5fr 1fr;gap:8px}',
    '.fipo-flows{display:flex;flex-direction:column;justify-content:space-evenly;gap:2px;flex:.9;min-height:0;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:7px 12px;overflow:auto}',
    '.fipo-flow-head{display:flex;justify-content:space-between;gap:8px;font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;color:var(--dim);padding-bottom:4px}',
    '.fipo-flow-head b{color:var(--muted);font-weight:500;letter-spacing:.02em}',
    '.fipo-lane{display:grid;grid-template-columns:76px 62px 158px 62px 1fr;align-items:center;gap:8px;border-top:1px solid var(--line-soft);padding:6px 0;transition:opacity .15s}',
    '.fipo-lane.off{opacity:.55}',
    '.fipo-chip{font-family:var(--mono);font-size:8px;letter-spacing:.04em;color:var(--dim);border:1px solid var(--line);border-radius:4px;padding:1px 4px;text-align:center;white-space:nowrap}',
    '.fipo-lane.new .fipo-chip{color:var(--cyan);border-color:color-mix(in srgb,var(--cyan) 35%,transparent)}',
    '.fipo-lane.old .fipo-chip{color:var(--blue);border-color:color-mix(in srgb,var(--blue) 40%,transparent)}',
    '.fipo-party{font-size:10px;color:var(--text);background:var(--panel-2);border-radius:5px;padding:3px 6px;text-align:center;white-space:nowrap}',
    '.fipo-arrow{display:flex;align-items:center;justify-content:center;gap:5px;font-size:9.5px;color:var(--muted);white-space:nowrap}',
    '.fipo-arrow b{font-family:var(--mono);font-weight:500;color:var(--cyan)}',
    '.fipo-lane.old .fipo-arrow b{color:var(--blue)}',
    '.fipo-lane.sec .fipo-arrow b{color:var(--muted)}',
    '.fipo-arrow i{font-style:normal;color:var(--dim);font-size:13px}',
    '.fipo-flow-note{font-size:9.5px;color:var(--dim);line-height:1.4}',
    '.fipo-flow-note b{color:var(--muted);font-weight:500}',
    '.fipo-call{font-size:10.5px;line-height:1.6;color:var(--muted);background:color-mix(in srgb,var(--cyan) 6%,transparent);border:1px solid color-mix(in srgb,var(--cyan) 24%,transparent);border-radius:8px;padding:8px 10px}',
    '.fipo-call b{color:var(--text)}',
    '.fipo-vs{display:flex;align-items:center;justify-content:space-around;gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px 10px}',
    '.fipo-vs .it{display:flex;flex-direction:column;gap:0;min-width:0}',
    '.fipo-vs span{font-size:9px;color:var(--dim)}',
    '.fipo-vs b{font-family:var(--mono);font-size:13px;font-weight:600;white-space:nowrap}',
    '.fipo-vs .neq{font-family:var(--mono);font-size:16px;color:var(--orange)}',

    /* F3 */
    '.fipo-f3 .chart-label{flex-direction:column;align-items:flex-start;gap:1px;line-height:1.5}',
    '.fipo-f3 .chart-label .sub{color:var(--dim);font-size:8.5px;letter-spacing:.06em}',
    '.fipo-f3-right{display:flex;flex-direction:column;gap:7px;min-height:0;overflow:auto;padding-right:2px}',
    '.fipo-book{width:100%}',
    '.fipo-book tr.out td{opacity:.42}',
    '.fipo-risk{border-radius:7px;padding:6px 8px;font-size:10.5px;line-height:1.5}',
    '.fipo-risk.warn{color:var(--orange);background:color-mix(in srgb,var(--orange) 9%,transparent);border:1px solid color-mix(in srgb,var(--orange) 28%,transparent)}',
    '.fipo-risk.ok{color:var(--cyan);background:color-mix(in srgb,var(--cyan) 8%,transparent);border:1px solid color-mix(in srgb,var(--cyan) 26%,transparent)}',

    /* F4 */
    '.fipo-f4{display:grid;grid-template-columns:1.35fr .65fr;gap:8px;flex:1;min-height:0}',
    '.fipo-f4-left{display:flex;flex-direction:column;gap:6px;min-height:0}',
    '.fipo-f4-left .chart{flex:1;min-height:180px}',
    '.fipo-f4-right{display:flex;flex-direction:column;gap:8px;min-height:0;overflow:auto;padding-right:2px}',
    '.fipo-pct{display:flex;gap:4px;flex-wrap:wrap}',
    '.fipo-pct button{border:1px solid var(--line);background:var(--panel-2);color:var(--muted);border-radius:6px;padding:3px 8px;font-size:10px;cursor:pointer;font-family:var(--mono)}',
    '.fipo-pct button[aria-pressed="true"]{border-color:var(--cyan);color:var(--cyan);background:var(--panel-3)}',
    '.fipo-cashline{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-family:var(--mono);font-size:11px;border:1px dashed var(--line);border-radius:7px;padding:7px 9px;color:var(--dim)}',
    '.fipo-cashline b{color:var(--cyan);font-weight:600}',

    /* F5 */
    '.fipo-f5{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0}',
    '.fipo-f5-top{display:grid;grid-template-columns:1.3fr .7fr;gap:8px;flex:1;min-height:0}',
    '.fipo-chartbox{display:flex;flex-direction:column;gap:4px;min-height:0}',
    '.fipo-chartbox .chart{flex:1;min-height:180px}',
    '.fipo-detail{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;min-height:0;overflow:auto}',
    '.fipo-detail h3{font-size:13px;display:flex;justify-content:space-between;gap:8px;align-items:baseline}',
    '.fipo-detail h3 span{font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;color:var(--dim)}',
    '.fipo-detail p{font-size:10.5px;color:var(--muted);line-height:1.6}',
    '.fipo-dcells{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line-soft);border:1px solid var(--line-soft);border-radius:7px;overflow:hidden}',
    '.fipo-dcells div{background:var(--panel-2);padding:6px 8px;display:flex;flex-direction:column;gap:1px}',
    '.fipo-dcells span{font-size:9px;color:var(--dim)}',
    '.fipo-dcells b{font-family:var(--mono);font-size:12px;font-weight:560}',
    '.fipo-detail .foot{font-size:9.5px;color:var(--dim);line-height:1.5;margin-top:auto}',
    '.fipo-tablewrap{max-height:196px;overflow:auto;border-top:1px solid var(--line-soft);padding-top:6px}',
    '.fipo-tablewrap tr.sel td{color:var(--text)}',
    '.fipo-tablewrap tr.sel td:first-child{color:var(--cyan)}',

    /* F6 */
    '.fipo-f6{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0}',
    '.fipo-base{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line-soft);border:1px solid var(--line-soft);border-radius:8px;overflow:hidden}',
    '.fipo-base div{background:var(--panel);padding:6px 9px;display:flex;flex-direction:column;gap:0;min-width:0}',
    '.fipo-base span{font-size:8.5px;color:var(--dim);letter-spacing:.04em}',
    '.fipo-base b{font-family:var(--mono);font-size:12px;font-weight:560;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.fipo-labs{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:1;min-height:0}',
    '.fipo-mini{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:5px;min-height:0;overflow:auto}',
    '.fipo-mini-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px}',
    '.fipo-mini-h b{font-size:12.5px;font-weight:600}',
    '.fipo-mini-h span{font-family:var(--mono);font-size:8px;letter-spacing:.1em;color:var(--dim)}',
    '.fipo-mini-note{font-size:9.5px;color:var(--dim);line-height:1.5}',
    '.fipo-ba{display:flex;flex-direction:column;margin-top:1px}',
    '.fipo-ba-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px;border-top:1px solid var(--line-soft);padding:3.5px 0}',
    '.fipo-ba-row span{font-size:9px;color:var(--dim);white-space:nowrap}',
    '.fipo-ba-row b{font-family:var(--mono);font-size:10.5px;font-weight:500;text-align:right}',
    '.fipo-mini-out{font-size:9.5px;color:var(--muted);line-height:1.45;margin-top:auto;border-left:2px solid var(--cyan);padding-left:7px}',

    /* F7 */
    '.fipo-f7{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0}',
    '.fipo-map{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;flex:1;min-height:0}',
    '.fipo-map-col{border:1px solid var(--line);border-radius:10px;background:var(--panel);padding:9px 10px;display:flex;flex-direction:column;justify-content:space-between;gap:8px;min-height:0;overflow:auto}',
    '.fipo-map-h{display:flex;align-items:center;justify-content:space-between;gap:6px;padding-bottom:5px;border-bottom:1px solid var(--line-soft)}',
    '.fipo-map-h b{font-size:11px}',
    '.fipo-map-h span{font-family:var(--mono);font-size:8.5px;letter-spacing:.05em;border:1px solid var(--line);border-radius:4px;padding:0 4px;color:var(--dim);white-space:nowrap}',
    '.fipo-map-col.a .fipo-map-h b{color:var(--cyan)}',
    '.fipo-map-col.b .fipo-map-h b{color:var(--blue)}',
    '.fipo-map-col.c .fipo-map-h b{color:var(--orange)}',
    '.fipo-op{border-left:2px solid var(--line);padding:1px 0 1px 7px}',
    '.fipo-map-col.a .fipo-op{border-color:color-mix(in srgb,var(--cyan) 55%,transparent)}',
    '.fipo-map-col.b .fipo-op{border-color:color-mix(in srgb,var(--blue) 55%,transparent)}',
    '.fipo-map-col.c .fipo-op{border-color:color-mix(in srgb,var(--orange) 55%,transparent)}',
    '.fipo-op b{display:block;font-size:10.5px;color:var(--text);font-weight:560}',
    '.fipo-op span{display:block;font-size:9.5px;color:var(--dim);line-height:1.45}',
    '.fipo-op .ex{font-family:var(--mono);font-size:8.5px;color:var(--muted);line-height:1.35;margin-top:2px}',
    '.fipo-map-foot{border-top:1px solid var(--line-soft);padding-top:7px;font-size:9px;color:var(--dim);line-height:1.45}',
    '.fipo-map-foot b{color:var(--muted);font-weight:500}',
    '.fipo-myths{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}',
    '.fipo-myth{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:8px 9px;display:flex;flex-direction:column;gap:5px;min-width:0}',
    '.fipo-myth-q{font-size:10px;line-height:1.5;color:var(--text)}',
    '.fipo-myth-btns{display:flex;gap:4px}',
    '.fipo-myth-btns button{flex:1;border:1px solid var(--line);background:var(--panel-2);border-radius:5px;padding:2px 0;font-size:9.5px;color:var(--muted);cursor:pointer}',
    '.fipo-myth-btns button:hover{border-color:var(--dim);color:var(--text)}',
    '.fipo-myth-btns button[disabled]{cursor:default;opacity:.7}',
    '.fipo-myth.right{border-color:color-mix(in srgb,var(--cyan) 40%,transparent)}',
    '.fipo-myth.wrong{border-color:color-mix(in srgb,var(--red) 40%,transparent)}',
    '.fipo-myth-a{display:none;font-size:9px;line-height:1.45;color:var(--muted)}',
    '.fipo-myth-a.on{display:block}',
    '.fipo-myth-a b{color:var(--cyan)}',

    '@media (max-width:900px){',
    '  .fipo-f4{display:flex;flex-direction:column}',
    '  .fipo-f4-left{min-height:280px}',
    '  .fipo-f5-top{display:flex;flex-direction:column}',
    '  .fipo-f5-top .chart{min-height:250px}',
    '  .fipo-money{grid-template-columns:1fr;flex:none}',
    '  .fipo-flows{flex:none;padding:7px 10px}',
    '  .fipo-lane{display:flex;flex-wrap:wrap;gap:5px 8px;padding:7px 0}',
    '  .fipo-flow-note{flex:1 0 100%}',
    '  .fipo-arrow{margin-left:auto}',
    '  .fipo-f2-bottom{grid-template-columns:1fr}',
    '  .fipo-map{grid-template-columns:1fr;flex:none}',
    '  .fipo-map-col{overflow:visible}',
    '  .fipo-myths{grid-template-columns:1fr 1fr}',
    '  .fipo-base{grid-template-columns:1fr 1fr}',
    '  .fipo-tablewrap{max-height:none}',
    '}',
    '@media (max-width:620px){',
    '  .fipo-labs{grid-template-columns:1fr}',
    '  .fipo-myths{grid-template-columns:1fr}',
    '  .fipo-mc .val{font-size:26px}',
    '}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('fipo-style')) return;
    var s = document.createElement('style');
    s.id = 'fipo-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function num(v, d) { return ui.fmt.num(v, d == null ? 2 : d); }
  function yi(v, d) { return '¥' + num(v, d == null ? 2 : d) + ' 亿'; }
  function sh(v, d) { return num(v, d == null ? 2 : d) + ' 亿股'; }
  function px(v) { return '¥' + num(v, 2); }
  function pc(v, d) { return num(v, d == null ? 1 : d) + '%'; }
  function tx(v, d) { return num(v, d == null ? 2 : d) + '×'; }
  function signedYi(v) {
    var sign = v > 0 ? '+' : (v < 0 ? '-' : '');
    return sign + '¥' + num(Math.abs(v), 2) + ' 亿';
  }

  function mount(ctx) {
    injectStyle();
    var p = charts.palette();
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage, panel = ctx.panel;
    var BASE_INV = sim.defaultInvestors(31);
    var OWNERS = OWNER_DEF.map(function (o) { return { name: o.name, pct: o.pct, color: p[o.key] }; });

    /* =========================================================
     *  shared model
     * ========================================================= */
    function scaledInvestors() {
      return BASE_INV.map(function (inv) {
        return { name: inv.name, maxPrice: inv.maxPrice, qty: Math.round(inv.qty * st.demandHeat) };
      });
    }
    function model() {
      var iss = core.issuance({
        preShares: st.preShares, newShares: st.newShares,
        price: st.offerPrice, prePrice: st.offerPrice, profit: st.profit
      });
      var gross = iss.proceeds;
      var fee = gross * st.feeRate / 100;
      var post = iss.postShares;
      var founderShares = st.preShares * 0.60;
      var demand = sim.ipoDemand({
        price: st.offerPrice, offerQty: st.newShares * YI, investors: scaledInvestors()
      });
      return {
        iss: iss, post: post, gross: gross, fee: fee, net: gross - fee,
        cap: core.marketCap(st.offerPrice, post),
        epsBefore: iss.epsBefore, epsAfter: iss.epsAfter,
        peOffer: core.pe(st.offerPrice, iss.epsAfter),
        founderShares: founderShares,
        founderPct: founderShares / post * 100,
        fairCap: st.profit * st.marketPE,
        fairPrice: st.profit * st.marketPE / post,
        over: demand.oversubscription,
        demandQty: demand.demandQty / YI
      };
    }

    /* =========================================================
     *  stage containers
     * ========================================================= */
    var wrapF1 = ui.el('div', 'stage-grid two fipo-f1');
    var wrapF2 = ui.el('div', 'fipo-wrap fipo-f2');
    var wrapF3 = ui.el('div', 'stage-grid two fipo-f3');
    var wrapF4 = ui.el('div', 'fipo-f4');
    var wrapF5 = ui.el('div', 'fipo-f5');
    var wrapF6 = ui.el('div', 'fipo-f6');
    var wrapF7 = ui.el('div', 'fipo-f7');
    [wrapF1, wrapF2, wrapF3, wrapF4, wrapF5, wrapF6, wrapF7].forEach(function (w) {
      w.style.display = 'none';
      stage.appendChild(w);
    });

    /* ================= F1 ================= */
    var f1Left = ui.el('div', 'fipo-f1-left');
    var f1Right = ui.el('div', 'fipo-f1-right');
    wrapF1.appendChild(f1Left); wrapF1.appendChild(f1Right);

    var donutPreHost = ui.el('div', 'chart');
    var donutPostHost = ui.el('div', 'chart');
    f1Left.appendChild(donutPreHost); f1Left.appendChild(donutPostHost);
    var donutPre = charts.donut(donutPreHost, { segments: [], center: { value: '', label: '' }, label: '发行前股权结构' });
    var donutPost = charts.donut(donutPostHost, { segments: [], center: { value: '', label: '' }, label: '发行后股权结构' });
    donutPreHost.appendChild(ui.el('div', 'chart-label', '<b>发行前</b> 股权结构'));
    donutPostHost.appendChild(ui.el('div', 'chart-label', '<b>发行后</b> 股权结构 · 含新股'));

    var f1Met = ui.metrics([
      { key: 'shares', label: '上市后总股本' },
      { key: 'raise', label: '募资额（毛）' },
      { key: 'cap', label: '上市后总市值' },
      { key: 'founder', label: '创始人持股' },
      { key: 'eps', label: 'EPS 发行前 → 后' },
      { key: 'pe', label: '发行 PE / 可比 PE' },
      { key: 'dilution', label: '新股稀释比例' },
      { key: 'demand', label: '机构认购倍数' }
    ]);
    f1Right.appendChild(f1Met.el);

    var f1TableHost = ui.el('div');
    f1Right.appendChild(f1TableHost);
    var f1Note = ui.el('div', 'fipo-note');
    f1Right.appendChild(f1Note);

    /* ================= F2 ================= */
    var f2Head = ui.el('div', 'fipo-h');
    f2Head.innerHTML = '<div><div class="k">PROCEEDS ≠ MARKET CAP</div><b class="t">同一笔发行，三种口径</b></div>';
    var f2Toggle = ui.el('div', 'fipo-toggle');
    var f2BtnNew = ui.button('新股发行', function () { st.transferMode = 'new'; render(); }, 'sm');
    var f2BtnOld = ui.button('老股转让', function () { st.transferMode = 'old'; render(); }, 'sm');
    f2BtnNew.style.border = '0';
    f2BtnOld.style.border = '0';
    f2Toggle.appendChild(f2BtnNew); f2Toggle.appendChild(f2BtnOld);
    f2Head.appendChild(f2Toggle);
    wrapF2.appendChild(f2Head);

    var f2Grid = ui.el('div', 'fipo-money');
    wrapF2.appendChild(f2Grid);
    function moneyCard(cls, idx, lab, tag) {
      var card = ui.el('div', 'fipo-mc ' + cls);
      card.innerHTML = '<span class="idx">' + idx + '</span>' +
        '<span class="tag2">' + tag + '</span>' +
        '<div class="lab">' + lab + '</div>' +
        '<div class="val">—</div>' +
        '<div class="sub">—</div>' +
        '<div class="extra">—</div>';
      f2Grid.appendChild(card);
      return {
        el: card,
        val: card.querySelector('.val'),
        sub: card.querySelector('.sub'),
        extra: card.querySelector('.extra'),
        tag: card.querySelector('.tag2')
      };
    }
    var mcCash = moneyCard('a', '①', '公司收到的现金', '进入公司');
    var mcShare = moneyCard('b', '②', '原股东持股的账面市值', '股东账面');
    var mcCap = moneyCard('c', '③', '上市后总市值', '市场报价');
    var f2Flows = ui.el('div', 'fipo-flows');
    wrapF2.appendChild(f2Flows);

    var f2Bottom = ui.el('div', 'fipo-f2-bottom');
    var f2Call = ui.el('div', 'fipo-call');
    var f2Vs = ui.el('div', 'fipo-vs');
    f2Vs.innerHTML = '<div class="it"><span>募资额</span><b class="a">—</b></div>' +
      '<div class="neq">≠</div>' +
      '<div class="it"><span>总市值</span><b class="b">—</b></div>';
    f2Bottom.appendChild(f2Call); f2Bottom.appendChild(f2Vs);
    wrapF2.appendChild(f2Bottom);

    /* ================= F3 ================= */
    var f3ChartHost = ui.el('div', 'chart');
    wrapF3.appendChild(f3ChartHost);
    var f3Chart = charts.lines(f3ChartHost, {
      series: [], labels: [], zero: true, label: '机构需求曲线',
      yFormat: function (v) { return v < 0 ? '' : ui.fmt.num(v, 0) + '万'; }
    });
    f3ChartHost.appendChild(ui.el('div', 'chart-label', '<span><b>需求曲线</b> 股数 vs 发行价（元）</span><span class="sub">虚线 = 发行规模</span>'));

    var f3Right = ui.el('div', 'fipo-f3-right');
    wrapF3.appendChild(f3Right);
    var f3Head = ui.el('div', 'fipo-h');
    f3Head.innerHTML = '<div><div class="k">BOOKBUILDING · 模拟</div><b class="t">机构报价簿</b></div><span class="tag">固定种子 31</span>';
    f3Right.appendChild(f3Head);
    var f3Met = ui.metrics([
      { key: 'over', label: '认购倍数' },
      { key: 'demand', label: '机构总需求' },
      { key: 'raise', label: '拟募资额（毛）' },
      { key: 'clear', label: '需求出清价' }
    ]);
    f3Right.appendChild(f3Met.el);
    var f3Risk = ui.el('div', 'fipo-risk ok', '');
    f3Right.appendChild(f3Risk);
    var f3TableHost = ui.el('div');
    f3Right.appendChild(f3TableHost);
    var f3Note = ui.el('div', 'fipo-note');
    f3Right.appendChild(f3Note);

    /* ================= F4 ================= */
    var f4Left = ui.el('div', 'fipo-f4-left');
    var f4Right = ui.el('div', 'fipo-f4-right');
    wrapF4.appendChild(f4Left); wrapF4.appendChild(f4Right);
    var wealthHost = ui.el('div', 'chart');
    f4Left.appendChild(wealthHost);
    var wealthChart = charts.lines(wealthHost, {
      series: [], labels: [], zero: true, label: '二级价格与财富',
      yFormat: function (v) { return v.toFixed(1) + '亿'; }
    });
    wealthHost.appendChild(ui.el('div', 'chart-label', '<b>财富随二级价格变化</b> 亿元 · 横轴股价（元）'));
    var f4Legend = ui.legend([
      { label: '总市值', color: p.blue },
      { label: '创始人财富', color: p.cyan },
      { label: '公众盈亏', color: p.orange },
      { label: '公司现金', color: p.green }
    ]);
    f4Left.appendChild(f4Legend);

    var f4Met = ui.metrics([
      { key: 'cap', label: '总市值' },
      { key: 'founder', label: '创始人财富' },
      { key: 'pnl', label: '公众投资者盈亏' },
      { key: 'pe', label: '二级市场 PE' }
    ]);
    f4Right.appendChild(f4Met.el);
    var f4Cash = ui.el('div', 'fipo-cashline');
    f4Cash.innerHTML = '<span>公司账上现金（发行净额）</span><b>—</b>';
    f4Right.appendChild(f4Cash);
    var f4Pct = ui.el('div', 'fipo-pct');
    var f4PctBtns = [];
    [-30, -15, 0, 15, 30].forEach(function (delta) {
      var b = ui.button(delta === 0 ? '发行价' : (delta > 0 ? '+' : '') + delta + '%', function () {
        st.secondaryPrice = Math.min(48, Math.max(2, st.offerPrice * (1 + delta / 100)));
        render();
      }, 'sm');
      b.setAttribute('data-pct', delta);
      f4PctBtns.push(b);
      f4Pct.appendChild(b);
    });
    f4Right.appendChild(f4Pct);
    var f4Note = ui.el('div', 'fipo-note');
    f4Right.appendChild(f4Note);

    /* ================= F5 ================= */
    var f5Top = ui.el('div', 'fipo-f5-top');
    wrapF5.appendChild(f5Top);
    var refiBox = ui.el('div', 'fipo-chartbox');
    var refiCap = ui.el('div', 'fipo-sec');
    refiCap.innerHTML = '<span>摊薄后 EPS · 元/股</span><span>四种方案</span>';
    refiBox.appendChild(refiCap);
    var refiHost = ui.el('div', 'chart');
    refiBox.appendChild(refiHost);
    f5Top.appendChild(refiBox);
    var refiChart = charts.bars(refiHost, {
      labels: [], values: [], label: '再融资方案 EPS 对比',
      yFormat: function (v) { return v < 0 ? '-¥' + Math.abs(v).toFixed(2) : '¥' + v.toFixed(2); }
    });
    var refiDetail = ui.el('div', 'fipo-detail');
    f5Top.appendChild(refiDetail);
    var f5TableWrap = ui.el('div', 'fipo-tablewrap');
    wrapF5.appendChild(f5TableWrap);

    /* ================= F6 ================= */
    var f6Base = ui.el('div', 'fipo-base');
    var f6BaseCells = [];
    ['共享基线 · 股本', '股价', '年净利润', '账上净现金'].forEach(function (lab) {
      var cell = ui.el('div');
      cell.innerHTML = '<span>' + lab + '</span><b>—</b>';
      f6BaseCells.push(cell.querySelector('b'));
      f6Base.appendChild(cell);
    });
    wrapF6.appendChild(f6Base);
    var f6Labs = ui.el('div', 'fipo-labs');
    wrapF6.appendChild(f6Labs);

    var MINI_DEF = [
      { key: 'buy', title: '回购注销', en: 'BUYBACK', note: '公司用账上现金按市价买回股票并注销。' },
      { key: 'split', title: '拆股', en: 'SPLIT', note: '把 1 股拆成多股，股价按比例下调。' },
      { key: 'div', title: '现金分红', en: 'DIVIDEND', note: '把现金按持股比例分给全体股东。' },
      { key: 'merger', title: '换股并购', en: 'STOCK MERGER', note: '发行新股支付收购对价，不直接付现金。' }
    ];
    var miniRefs = {};
    MINI_DEF.forEach(function (def) {
      var card = ui.el('div', 'fipo-mini');
      card.innerHTML = '<div class="fipo-mini-h"><b>' + def.title + '</b><span>' + def.en + '</span></div>' +
        '<div class="fipo-mini-note">' + def.note + '</div>' +
        '<div class="fipo-ba"></div>' +
        '<div class="fipo-mini-out"></div>';
      f6Labs.appendChild(card);
      miniRefs[def.key] = { rows: card.querySelector('.fipo-ba'), out: card.querySelector('.fipo-mini-out') };
    });

    /* ================= F7 ================= */
    var f7Head = ui.el('div', 'fipo-h');
    f7Head.innerHTML = '<div><div class="k">CAPITAL MAP</div><b class="t">三种资本动作，三种现金流方向</b></div>' +
      '<span class="fipo-note">同一操作可能同时属于多类</span>';
    wrapF7.appendChild(f7Head);

    function op(title, text, ex) {
      return '<div class="fipo-op"><b>' + title + '</b><span>' + text + '</span>' +
        (ex ? '<span class="ex">' + ex + '</span>' : '') + '</div>';
    }
    var map = ui.el('div', 'fipo-map');
    function fillMap() {
      var m = model(), p = st.offerPrice, R = st.raiseAmount;
      var rightsP = p * (1 - st.rightsDiscount / 100);
      var convP = p * (1 + st.convPremium / 100);
      var interest = R * st.debtRate / 100;
      var oldCash = st.oldShares * p;
      var bbShares = core.buyback({ shares: m.post * YI, price: p, cash: st.buybackCash * YI, profit: st.profit * YI }).repurchased / 1e4;
      var splitS = m.post * st.splitRatio, splitP = p / st.splitRatio;
      var deal = st.dealTargetValue * (1 + st.dealPremium / 100), dealSh = deal / p;
      map.innerHTML =
        '<div class="fipo-map-col a"><div class="fipo-map-h"><b>① 现金流入公司</b><span>公司 +现金</span></div>' +
        op('IPO 新股发行', '公众把钱交给公司，股本增加', sh(st.newShares) + ' × ' + px(p) + ' = ' + yi(st.newShares * p) + ' 进公司') +
        op('增发新股', '向新投资者发行，按市价或折价', yi(R) + ' ÷ ' + px(p) + ' = ' + sh(R / p) + ' 新股') +
        op('配股', '向老股东按比例要钱', '折价 ' + pc(st.rightsDiscount, 0) + ' → 配股价 ' + px(rightsP)) +
        op('可转债（转股前）', '低息借钱，转股后债务变股本', '票面 ' + pc(st.convCoupon, 1) + ' · 转股价 ' + px(convP)) +
        op('银行借款 / 债券', '借来的钱，要还本付息', '利率 ' + pc(st.debtRate, 1) + ' · 年息 ' + yi(interest)) +
        '<div class="fipo-map-foot"><b>净效果</b>：公司现金增加，股东名单变长。</div>' +
        '</div>' +
        '<div class="fipo-map-col b"><div class="fipo-map-h"><b>② 只在股东之间转移</b><span>公司现金 0</span></div>' +
        op('老股转让', '卖方收钱，公司一股没发', sh(st.oldShares) + ' × ' + px(p) + ' = ' + yi(oldCash) + ' 归卖方') +
        op('二级市场买卖', '投资者互相撮合，公司不参与', '若 ' + px(p * 1.5) + ' → 市值 ' + yi(m.post * p * 1.5)) +
        op('拆股', '股数 × 比例、股价 ÷ 比例，市值不变', '1 拆 ' + num(st.splitRatio, 0) + ' → ' + sh(splitS) + ' × ' + px(splitP)) +
        op('换股并购', '发新股买资产，不动公司现金', '对价 ' + yi(deal) + ' ÷ ' + px(p) + ' = ' + sh(dealSh) + ' 新股') +
        '<div class="fipo-map-foot"><b>净效果</b>：公司现金不变，股票换了持有人。</div>' +
        '</div>' +
        '<div class="fipo-map-col c"><div class="fipo-map-h"><b>③ 现金流出 / 未来义务</b><span>公司 −现金</span></div>' +
        op('债务本息', '利息吞利润，到期要还本金', yi(R) + ' × ' + pc(st.debtRate, 1) + ' = ' + yi(interest) + ' / 年') +
        op('可转债转股', '转股后原股东被稀释', '转股价 ' + px(convP) + '，全转后 ' + sh(m.post + R / convP)) +
        op('回购注销', '现金付给卖出股票的股东', yi(st.buybackCash) + ' ÷ ' + px(p) + ' = ' + num(bbShares, 1) + ' 万股') +
        op('现金分红', '现金分给全体股东，股价除权', px(st.dps) + ' × ' + sh(m.post) + ' = ' + yi(m.post * st.dps)) +
        '<div class="fipo-map-foot"><b>净效果</b>：现金减少，或增加未来偿付义务。</div>' +
        '</div>';
    }
    wrapF7.appendChild(map);

    var f7MythHead = ui.el('div', 'fipo-h');
    f7MythHead.innerHTML = '<div><div class="k">MISCONCEPTIONS</div><b class="t">这句话对吗？</b></div>' +
      '<span class="fipo-note">点“对/错”查看解释</span>';
    wrapF7.appendChild(f7MythHead);
    var mythHost = ui.el('div', 'fipo-myths');
    wrapF7.appendChild(mythHost);
    var mythPicks = MYTHS.map(function () { return -1; });

    function buildMyths() {
      ui.clear(mythHost);
      MYTHS.forEach(function (m, i) {
        var card = ui.el('div', 'fipo-myth');
        card.innerHTML = '<div class="fipo-myth-q">' + m.s + '</div>' +
          '<div class="fipo-myth-btns"><button type="button" data-v="1">对</button><button type="button" data-v="0">错</button></div>' +
          '<div class="fipo-myth-a"></div>';
        var btns = card.querySelectorAll('button');
        function pick(v) {
          mythPicks[i] = v;
          var right = (v === (m.ans ? 1 : 0));
          card.classList.toggle('right', right);
          card.classList.toggle('wrong', !right);
          Array.prototype.forEach.call(btns, function (b) {
            b.disabled = true;
            b.style.borderColor = (+b.getAttribute('data-v') === v) ? (right ? 'var(--cyan)' : 'var(--red)') : '';
          });
          var a = card.querySelector('.fipo-myth-a');
          a.innerHTML = '<b>' + (right ? '答对了。' : '再想想。') + '</b>' + m.why;
          a.classList.add('on');
        }
        btns[0].addEventListener('click', function () { pick(1); });
        btns[1].addEventListener('click', function () { pick(0); });
        mythHost.appendChild(card);
      });
    }
    buildMyths();

    /* =========================================================
     *  panel
     * ========================================================= */
    var gMode = ui.section(panel, '实验室', 'F1–F7');
    var modeCtl = ui.seg({
      value: st.mode,
      options: [
        { value: 'f1', label: 'F1 起步' },
        { value: 'f2', label: 'F2 募资≠市值' },
        { value: 'f3', label: 'F3 定价' },
        { value: 'f4', label: 'F4 上市后' },
        { value: 'f5', label: 'F5 再融资' },
        { value: 'f6', label: 'F6 四件事' },
        { value: 'f7', label: 'F7 总结' }
      ],
      onChange: function (v) { st.mode = v; render(); }
    });
    gMode.appendChild(modeCtl.el);

    var gF1 = ui.section(panel, 'F1 · 发行结构', 'ISSUANCE');
    var ctlPre = ui.slider({ label: '发行前股本', min: 0.4, max: 2.0, step: 0.05, value: st.preShares, unit: '亿股', onInput: function (v) { st.preShares = v; render(); } });
    var ctlNew = ui.slider({ label: '发行新股', min: 0.05, max: 0.8, step: 0.025, value: st.newShares, unit: '亿股', onInput: function (v) { st.newShares = v; render(); } });
    var ctlPrice = ui.slider({ label: '发行价', min: 6, max: 24, step: 0.5, value: st.offerPrice, unit: '元', onInput: function (v) { st.offerPrice = v; render(); } });
    var ctlProfit = ui.slider({ label: '年净利润', min: 0.2, max: 3.0, step: 0.1, value: st.profit, unit: '亿元', onInput: function (v) { st.profit = v; render(); } });
    var ctlPE = ui.slider({ label: '可比公司 PE', min: 8, max: 60, step: 1, value: st.marketPE, unit: '倍', hint: '只作为估值参照，不代表发行价一定按它定。', onInput: function (v) { st.marketPE = v; render(); } });
    var ctlHeat = ui.slider({ label: '机构需求热度', min: 0.5, max: 2.0, step: 0.1, value: st.demandHeat, unit: '×', hint: '等比例放大 8 家机构的申购量。', onInput: function (v) { st.demandHeat = v; render(); } });
    [ctlPre, ctlNew, ctlPrice, ctlProfit, ctlPE, ctlHeat].forEach(function (c) { gF1.appendChild(c.el); });

    var gF2 = ui.section(panel, 'F2 · 发行方式', 'PRIMARY / SECONDARY');
    var ctlFee = ui.slider({ label: '承销费率（简化）', min: 0, max: 12, step: 0.5, value: st.feeRate, unit: '%', hint: '只扣这一项费用；真实发行还有保荐、审计、律师等成本。', onInput: function (v) { st.feeRate = v; render(); } });
    var ctlOld = ui.slider({ label: '转让老股数量', min: 0.02, max: 0.5, step: 0.01, value: st.oldShares, unit: '亿股', hint: '老股转让不改变总股本，钱归卖方。', onInput: function (v) { st.oldShares = v; render(); } });
    gF2.appendChild(ctlFee.el); gF2.appendChild(ctlOld.el);
    gF2.appendChild(ui.note('在舞台上用“新股发行 / 老股转让”切换；只有新股发行会给公司带来现金。'));

    var gF3 = ui.section(panel, 'F3 · 定价与需求', 'DEMAND');
    var ctlPrice3 = ui.slider({ label: '发行价', min: 6, max: 24, step: 0.5, value: st.offerPrice, unit: '元', onInput: function (v) { st.offerPrice = v; render(); } });
    var ctlQty3 = ui.slider({ label: '发行规模', min: 0.05, max: 0.8, step: 0.025, value: st.newShares, unit: '亿股', onInput: function (v) { st.newShares = v; render(); } });
    var ctlHeat3 = ui.slider({ label: '需求热度', min: 0.5, max: 2.0, step: 0.1, value: st.demandHeat, unit: '×', onInput: function (v) { st.demandHeat = v; render(); } });
    gF3.appendChild(ctlPrice3.el); gF3.appendChild(ctlQty3.el); gF3.appendChild(ctlHeat3.el);
    gF3.appendChild(ui.note('机构报价是教学设定，固定种子 31。A 股询价与美股累计投标的分配规则不同。'));

    var gF4 = ui.section(panel, 'F4 · 上市之后', 'AFTERMARKET');
    var ctlSec = ui.slider({ label: '二级市场股价', min: 2, max: 48, step: 0.5, value: st.secondaryPrice, unit: '元', hint: '公司现金不随二级价格变化。', onInput: function (v) { st.secondaryPrice = v; render(); } });
    gF4.appendChild(ctlSec.el);

    var gF5 = ui.section(panel, 'F5 · 再融资', 'REFINANCING');
    var ctlRefi = ui.seg({
      label: '方案',
      options: [
        { value: 'issue', label: '增发新股' },
        { value: 'rights', label: '配股' },
        { value: 'convert', label: '可转债' },
        { value: 'debt', label: '普通债务' }
      ],
      value: st.refinance,
      onChange: function (v) { st.refinance = v; render(); }
    });
    var ctlRaise = ui.slider({ label: '募资规模', min: 1, max: 10, step: 0.5, value: st.raiseAmount, unit: '亿元', onInput: function (v) { st.raiseAmount = v; render(); } });
    var ctlDebtRate = ui.slider({ label: '债务 / 借款利率', min: 2, max: 10, step: 0.5, value: st.debtRate, unit: '%', onInput: function (v) { st.debtRate = v; render(); } });
    var ctlCoupon = ui.slider({ label: '可转债票面利率', min: 0, max: 5, step: 0.25, value: st.convCoupon, unit: '%', onInput: function (v) { st.convCoupon = v; render(); } });
    var ctlConvPre = ui.slider({ label: '转股溢价', min: 0, max: 60, step: 5, value: st.convPremium, unit: '%', onInput: function (v) { st.convPremium = v; render(); } });
    var ctlRightsDis = ui.slider({ label: '配股折价', min: 0, max: 50, step: 5, value: st.rightsDiscount, unit: '%', onInput: function (v) { st.rightsDiscount = v; render(); } });
    [ctlRefi, ctlRaise, ctlDebtRate, ctlCoupon, ctlConvPre, ctlRightsDis].forEach(function (c) { gF5.appendChild(c.el); });

    var gF6 = ui.section(panel, 'F6 · 资本动作', 'CORPORATE ACTIONS');
    var ctlBuy = ui.slider({ label: '回购金额', min: 0.1, max: 2.5, step: 0.1, value: st.buybackCash, unit: '亿元', hint: '以账上净现金为上限，按市价回购。', onInput: function (v) { st.buybackCash = v; render(); } });
    var ctlSplit = ui.slider({ label: '拆股比例（1 拆 N）', min: 1, max: 5, step: 1, value: st.splitRatio, unit: 'N', hint: '2 表示 1 股拆成 2 股。', onInput: function (v) { st.splitRatio = v; render(); } });
    var ctlDps = ui.slider({ label: '每股分红（元）', min: 0.1, max: 1.5, step: 0.05, value: st.dps, unit: '元', onInput: function (v) { st.dps = v; render(); } });
    var ctlDeal = ui.slider({ label: '标的估值（不含溢价）', min: 1, max: 8, step: 0.5, value: st.dealTargetValue, unit: '亿元', hint: '标的净利润固定 0.60 亿元，溢价固定 30%。', onInput: function (v) { st.dealTargetValue = v; render(); } });
    [ctlBuy, ctlSplit, ctlDps, ctlDeal].forEach(function (c) { gF6.appendChild(c.el); });

    var gF7 = ui.section(panel, 'F7 · 总结', 'SUMMARY');
    gF7.appendChild(ui.note('分类是教学归纳。真实交易常同时具有多种效果：例如可转债既带来现金，也带来利息与潜在稀释。'));

    var gFormula = ui.section(panel, '公式', 'SUBSTITUTED');
    var fx = {};
    ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'].forEach(function (k) {
      fx[k] = ui.formula('');
      gFormula.appendChild(fx[k]);
    });

    var gWarn = ui.section(panel, '模型边界', 'ASSUMPTIONS');
    var wn = {};
    ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'].forEach(function (k) {
      wn[k] = ui.warn('');
      gWarn.appendChild(wn[k]);
    });
    wn.f1.innerHTML = '忽略承销费以外的发行成本、税收与限售安排。EPS 按发行后总股本直接摊薄，未假设募资投入后新增利润。';
    wn.f2.innerHTML = '承销费按单一费率简化；老股转让未计卖方税费与锁定期。现实中的募资净额还受超额配售、绿鞋等机制影响。';
    wn.f3.innerHTML = '机构报价、申购量与分配均为<b>教学模拟</b>，固定种子 31，不是真实簿记建档，也不能预测上市后价格。';
    wn.f4.innerHTML = '只考虑股价变化，忽略分红、解禁、税费与锁定期。公众盈亏按全部新股以发行价买入计算。';
    wn.f5.innerHTML = '增发按市价、配股按设定折价、可转债按设定溢价转股，均为简化；未考虑募集资金投向回报、所得税与发行费用。';
    wn.f6.innerHTML = '回购按市价且全额注销，分红为现金分红，并购为换股且无协同效应；忽略税费、限售与商誉减值。';
    wn.f7.innerHTML = '“现金流入 / 股东之间 / 义务”是教学分类，不构成会计科目或监管口径。';

    var gReset = ui.section(panel, '重置', 'RESET');
    var resetBtn = ui.reset(function () {
      var keepMode = st.mode;
      Object.assign(st, DEFAULT);
      st.mode = keepMode;
      mythPicks = MYTHS.map(function () { return -1; });
      buildMyths();
      render();
    });
    gReset.appendChild(resetBtn);
    gReset.appendChild(ui.note('恢复全部参数默认值，保留当前场景。'));

    /* =========================================================
     *  F1 render
     * ========================================================= */
    function renderF1() {
      var m = model();
      var preSegs = OWNERS.map(function (o) {
        return { label: o.name, value: o.pct, color: o.color, display: sh(st.preShares * o.pct / 100) };
      });
      donutPre.setData({
        segments: preSegs,
        center: { value: sh(st.preShares, 2), label: '发行前总股本' }
      });
      var postSegs = OWNERS.map(function (o) {
        return {
          label: o.name, value: o.pct * st.preShares / m.post, color: o.color,
          display: sh(st.preShares * o.pct / 100)
        };
      });
      postSegs.push({
        label: '公众（新股）', value: st.newShares / m.post * 100, color: p.violet,
        display: sh(st.newShares)
      });
      donutPost.setData({
        segments: postSegs,
        center: { value: sh(m.post, 2), label: '发行后总股本' }
      });

      f1Met.set({
        shares: sh(m.post, 2),
        raise: yi(m.gross, 2),
        cap: yi(m.cap, 2),
        founder: pc(60) + ' → ' + pc(m.founderPct),
        eps: '¥' + num(m.epsBefore, 2) + ' → ¥' + num(m.epsAfter, 2),
        pe: tx(m.peOffer, 1) + ' / ' + tx(st.marketPE, 0),
        dilution: pc(st.newShares / m.post * 100),
        demand: m.over == null ? '—' : tx(m.over, 2)
      }, { cap: 'hi', demand: m.over < 1 ? 'neg' : 'hi' });

      ui.clear(f1TableHost);
      f1TableHost.appendChild(ui.table(['口径', '数值'], [
        ['发行前股本', sh(st.preShares)],
        ['发行新股', sh(st.newShares)],
        ['发行后总股本', sh(m.post)],
        ['发行前估值（私募轮 ¥10）', yi(st.preShares * st.prePrice)],
        ['发行后总市值', yi(m.cap)]
      ]));

      var discount = m.fairPrice > 0 ? (1 - st.offerPrice / m.fairPrice) * 100 : 0;
      f1Note.innerHTML = '可比 PE ' + num(st.marketPE, 0) + '× → 合理市值 <b>' + yi(m.fairCap) +
        '</b>、合理股价 <b>' + px(m.fairPrice) + '</b>；发行价 ' + px(st.offerPrice) +
        (discount >= 0 ? ' 低于' : ' 高于') + '合理价 <b>' + pc(Math.abs(discount)) + '</b>。<br>' +
        '毛募资 ' + yi(m.gross) + '，承销费 ' + num(st.feeRate, 1) + '% → 公司净收 <b>' + yi(m.net) + '</b>。';
    }

    /* =========================================================
     *  F2 render
     * ========================================================= */
    function renderF2() {
      var isNew = st.transferMode !== 'old';
      var gross = st.newShares * st.offerPrice;
      var fee = gross * st.feeRate / 100;
      var net = gross - fee;
      var old = Math.min(st.oldShares, st.preShares * 0.9);
      var companyCash = isNew ? net : 0;
      var sellerCash = isNew ? 0 : old * st.offerPrice;
      var remain = isNew ? st.preShares * st.offerPrice : (st.preShares - old) * st.offerPrice;
      var totalCap = (isNew ? st.preShares + st.newShares : st.preShares) * st.offerPrice;

      mcCash.el.classList.toggle('zero', !isNew);
      mcCash.tag.textContent = isNew ? '进入公司' : '公司 0';
      mcCash.val.textContent = yi(companyCash);
      mcCash.sub.textContent = isNew
        ? sh(st.newShares) + ' × ' + px(st.offerPrice) + ' − 费用 ' + num(st.feeRate, 1) + '%'
        : '没有发行新股，公司不收款';
      mcCash.extra.textContent = isNew
        ? '毛募资 ' + yi(gross) + '，净额 ' + yi(net) + ' 进入公司账户'
        : '售股款 ' + yi(sellerCash) + ' 直接进入卖方账户';

      mcShare.tag.textContent = isNew ? '股东账面' : '剩余持股';
      mcShare.val.textContent = yi(remain);
      mcShare.sub.textContent = isNew
        ? sh(st.preShares) + ' × ' + px(st.offerPrice) + '（按发行价）'
        : '剩余 ' + sh(st.preShares - old) + ' × ' + px(st.offerPrice);
      mcShare.extra.innerHTML = isNew
        ? '发行后老股东仍持有 ' + pc(st.preShares / (st.preShares + st.newShares) * 100) + ' 的股份'
        : '<b>+ 售股现金 ' + yi(sellerCash) + '</b>（归卖方，不进公司）';

      mcCap.val.textContent = yi(totalCap);
      mcCap.sub.textContent = sh(isNew ? st.preShares + st.newShares : st.preShares) + ' × ' + px(st.offerPrice);
      mcCap.extra.textContent = isNew
        ? '原股东 ' + yi(remain) + ' + 新股东 ' + yi(st.newShares * st.offerPrice)
        : '股本不变，只是部分股票换了持有人';

      f2Call.innerHTML = '只有 <b>①</b> 是公司账户里的钱；<b>②</b> 是股东手里股票值多少；<b>③</b> 是市场给全部股权的报价。' +
        '三者不能相加，也不一定相等。' +
        (isNew ? '' : '<br>老股转让时，公司募资为 <b>0</b>，但总市值仍可能很大。');
      f2Vs.querySelector('.a').textContent = yi(isNew ? gross : 0);
      f2Vs.querySelector('.b').textContent = yi(totalCap);

      f2BtnNew.setAttribute('aria-pressed', String(isNew));
      f2BtnOld.setAttribute('aria-pressed', String(!isNew));

      var activeNote = isNew ? '当前：新股发行' : '当前：老股转让';
      var newOff = isNew ? '' : ' off';
      var oldOff = isNew ? ' off' : '';
      var oldCash = old * st.offerPrice;
      f2Flows.innerHTML =
        '<div class="fipo-flow-head"><span>钱与股票的方向</span><b>' + activeNote + '</b></div>' +
        '<div class="fipo-lane new' + newOff + '">' +
          '<span class="fipo-chip">新股发行</span>' +
          '<span class="fipo-party">投资者</span>' +
          '<span class="fipo-arrow"><b>现金 ' + yi(gross) + '</b><i>→</i></span>' +
          '<span class="fipo-party">公司</span>' +
          '<span class="fipo-flow-note">公司收款、发行 <b>' + sh(st.newShares) + '</b> 新股</span>' +
        '</div>' +
        '<div class="fipo-lane old' + oldOff + '">' +
          '<span class="fipo-chip">老股转让</span>' +
          '<span class="fipo-party">受让方</span>' +
          '<span class="fipo-arrow"><b>现金 ' + yi(oldCash) + '</b><i>→</i></span>' +
          '<span class="fipo-party">老股东</span>' +
          '<span class="fipo-flow-note">钱归卖方，公司<b>股本不变、现金 0</b></span>' +
        '</div>' +
        '<div class="fipo-lane sec">' +
          '<span class="fipo-chip">二级市场</span>' +
          '<span class="fipo-party">买方</span>' +
          '<span class="fipo-arrow"><b>现金 ↔ 股票</b><i>⇄</i></span>' +
          '<span class="fipo-party">卖方</span>' +
          '<span class="fipo-flow-note">公司不参与，<b>股价涨跌不动公司现金</b></span>' +
        '</div>';

      fx.f2.innerHTML = isNew
        ? '公司现金 = ' + num(st.newShares) + ' × ' + num(st.offerPrice) + ' × (1 − ' + num(st.feeRate, 1) + '%) = <b>' + yi(net) + '</b><br>' +
          '原股东市值 = ' + num(st.preShares) + ' × ' + num(st.offerPrice) + ' = <b>' + yi(remain) + '</b><br>' +
          '总市值 = ' + num(st.preShares + st.newShares) + ' × ' + num(st.offerPrice) + ' = <b>' + yi(totalCap) + '</b>'
        : '公司现金 = <b>¥0</b>（没有新股）<br>' +
          '售股股东收到 = ' + num(old) + ' × ' + num(st.offerPrice) + ' = <b>' + yi(sellerCash) + '</b><br>' +
          '总市值 = ' + num(st.preShares) + ' × ' + num(st.offerPrice) + ' = <b>' + yi(totalCap) + '</b>';
    }

    /* =========================================================
     *  F3 render
     * ========================================================= */
    function renderF3() {
      var invs = scaledInvestors();
      var offerQty = st.newShares * YI;
      var r = sim.ipoDemand({ price: st.offerPrice, offerQty: offerQty, investors: invs });

      var P0 = 6, P1 = 24, STEP = 1;
      var labels = [], demandVals = [];
      for (var price = P0; price <= P1; price += STEP) {
        var q = 0;
        invs.forEach(function (inv) { if (inv.maxPrice >= price) q += inv.qty; });
        labels.push(String(price));
        demandVals.push(q / 1e4);
      }
      var markI = Math.max(0, Math.min(labels.length - 1, Math.round((st.offerPrice - P0) / STEP)));
      var markVal = demandVals[markI];
      var markText = st.offerPrice <= 20
        ? num(st.offerPrice, 1) + ' 元 · ' + (r.oversubscription == null ? '—' : tx(r.oversubscription, 1))
        : '';
      f3Chart.setData({
        labels: labels,
        series: [
          { name: '机构累计需求', values: demandVals, color: p.cyan, width: 2, area: true },
          {
            name: '本次发行规模', values: labels.map(function () { return offerQty / 1e4; }),
            color: p.orange, width: 1.3, dash: [5, 4]
          }
        ],
        markers: [{ i: markI, value: markVal, text: markText, color: p.orange }]
      });

      var over = r.oversubscription;
      f3Met.set({
        over: over == null ? '—' : tx(over, 2),
        demand: sh(r.demandQty / YI, 2),
        raise: yi(st.newShares * st.offerPrice, 2),
        clear: r.clearingPrice == null ? '—' : px(r.clearingPrice)
      }, { over: over != null && over < 1 ? 'neg' : 'hi' });

      var risk = '';
      var cls = 'ok';
      if (r.demandQty < offerQty) {
        cls = 'warn';
        risk = '认购不足：需求 ' + sh(r.demandQty / YI, 2) + ' < 发行 ' + sh(st.newShares, 2) + '，发行可能失败或缩减规模。';
      } else if (over < 1.2) {
        cls = 'warn';
        risk = '需求刚过发行规模（' + tx(over, 2) + '），定价容错空间有限。';
      } else {
        risk = '认购 ' + tx(over, 2) + '：需求覆盖发行规模；认购倍数不是上市后涨幅。';
      }
      f3Risk.className = 'fipo-risk ' + cls;
      f3Risk.textContent = risk;

      var sorted = r.bids.slice().sort(function (a, b) { return b.maxPrice - a.maxPrice; });
      var rows = sorted.map(function (b) {
        return [
          b.name,
          px(b.maxPrice),
          b.wanted ? num(b.wanted / YI * 1e4, 0) + ' 万' : '—',
          b.qty ? num(b.allocation / YI * 1e4, 0) + ' 万' : '—'
        ];
      });
      ui.clear(f3TableHost);
      var book = ui.table(['机构', '最高报价', '申购', '获配'], rows, 'fipo-book');
      Array.prototype.forEach.call(book.querySelectorAll('tbody tr'), function (tr, i) {
        if (!sorted[i].qty) tr.classList.add('out');
      });
      f3TableHost.appendChild(book);

      var gap = r.clearingPrice == null ? null : (st.offerPrice / r.clearingPrice - 1) * 100;
      f3Note.innerHTML = '出清价是累计需求刚好覆盖发行规模时的报价。当前发行价 ' + px(st.offerPrice) +
        (gap == null ? '' : '，比出清价' + (gap <= 0 ? '低 ' : '高 ') + pc(Math.abs(gap), 1)) +
        '。<br>获配按需求比例分配，<b>不是先到先得</b>；真实 IPO 的分配还受回拨、锁定期与承销商裁量影响。';

      fx.f3.innerHTML = '需求 = Σ（报价 ≥ ' + num(st.offerPrice) + ' 元的申购量）= <b>' + sh(r.demandQty / YI, 2) + '</b><br>' +
        '认购倍数 = ' + num(r.demandQty / YI, 2) + ' ÷ ' + num(st.newShares, 2) + ' = <b>' + (over == null ? '—' : tx(over, 2)) + '</b><br>' +
        '拟募资额 = ' + num(st.newShares, 2) + ' × ' + num(st.offerPrice) + ' = <b>' + yi(st.newShares * st.offerPrice) + '</b>（若足额发行）';
    }

    /* =========================================================
     *  F4 render
     * ========================================================= */
    function renderF4() {
      var m = model();
      var lo = st.offerPrice * 0.4, hi = st.offerPrice * 2.0, N = 25;
      var labels = [], capV = [], foundV = [], pnlV = [], cashV = [];
      for (var i = 0; i < N; i++) {
        var price = lo + (hi - lo) * i / (N - 1);
        labels.push(price.toFixed(1));
        capV.push(m.post * price);
        foundV.push(m.founderShares * price);
        pnlV.push(st.newShares * (price - st.offerPrice));
        cashV.push(m.net);
      }
      var markI = Math.max(0, Math.min(N - 1, Math.round((st.secondaryPrice - lo) / (hi - lo) * (N - 1))));
      wealthChart.setData({
        labels: labels,
        series: [
          { name: '总市值', values: capV, color: p.blue, width: 1.6 },
          { name: '创始人财富', values: foundV, color: p.cyan, width: 2.2 },
          { name: '公众投资者盈亏', values: pnlV, color: p.orange, width: 1.6 },
          { name: '公司现金', values: cashV, color: p.green, width: 1.2, dash: [4, 4] }
        ],
        markers: [
          { i: markI, value: capV[markI], color: p.blue },
          { i: markI, value: foundV[markI], color: p.cyan },
          { i: markI, value: pnlV[markI], color: p.orange },
          { i: markI, value: cashV[markI], color: p.green }
        ]
      });

      var cap = m.post * st.secondaryPrice;
      var founder = m.founderShares * st.secondaryPrice;
      var pnl = st.newShares * (st.secondaryPrice - st.offerPrice);
      var pe = core.pe(st.secondaryPrice, m.epsAfter);
      f4Met.set({
        cap: yi(cap, 2),
        founder: yi(founder, 2),
        pnl: signedYi(pnl),
        pe: pe == null ? '—' : tx(pe, 1)
      }, { pnl: pnl >= 0 ? 'pos' : 'neg' });
      f4Cash.querySelector('b').textContent = yi(m.net) + '（不变）';
      Array.prototype.forEach.call(f4Pct.children, function (b) {
        var delta = +b.getAttribute('data-pct');
        var target = st.offerPrice * (1 + delta / 100);
        b.setAttribute('aria-pressed', String(Math.abs(st.secondaryPrice - target) < 0.01));
      });
      f4Note.innerHTML = '公司现金来自 IPO 净募资，<b>与二级价格无关</b>。公众盈亏按全部新股以 ' + px(st.offerPrice) +
        ' 买入计算；创始人财富按 ' + sh(m.founderShares) + ' 计算。<br>二级市场买卖只是在投资者之间转移现金。';
      fx.f4.innerHTML = '总市值 = ' + num(m.post) + ' × ' + num(st.secondaryPrice) + ' = <b>' + yi(cap) + '</b><br>' +
        '创始人财富 = ' + num(m.founderShares) + ' × ' + num(st.secondaryPrice) + ' = <b>' + yi(founder) + '</b><br>' +
        '公众盈亏 = ' + num(st.newShares) + ' × (' + num(st.secondaryPrice) + ' − ' + num(st.offerPrice) + ') = <b>' + signedYi(pnl) + '</b>';
    }

    /* =========================================================
     *  F5 render
     * ========================================================= */
    function refiData() {
      var m = model();
      var baseShares = m.post, price = st.offerPrice, cash = m.net, R = st.raiseAmount;
      var issueShares = R / price;
      var iss = core.issuance({ preShares: baseShares, newShares: issueShares, price: price, prePrice: price, profit: st.profit });
      var rightsPrice = price * (1 - st.rightsDiscount / 100);
      var rightsShares = R / rightsPrice;
      var issR = core.issuance({ preShares: baseShares, newShares: rightsShares, price: rightsPrice, prePrice: price, profit: st.profit });
      var convPrice = price * (1 + st.convPremium / 100);
      var convShares = R / convPrice;
      var coupon = R * st.convCoupon / 100;
      var interest = R * st.debtRate / 100;
      var debtEps = (st.profit - interest) / baseShares;
      return {
        baseShares: baseShares, price: price, cash: cash, R: R,
        issue: {
          key: 'issue', label: '增发新股', en: 'EQUITY', desc: '按市价向新投资者发行，现金进入公司，股本变大。',
          dilution: iss.dilutionPct, debt: 0, interest: 0, eps: iss.epsAfter,
          shares: iss.postShares, extra: '发行价 ' + px(price)
        },
        rights: {
          key: 'rights', label: '配股', en: 'RIGHTS', desc: '向现有股东按持股比例配售，通常折价；不参与就会被稀释。',
          dilution: issR.dilutionPct, debt: 0, interest: 0, eps: issR.epsAfter,
          shares: issR.postShares, extra: '配股价 ' + px(rightsPrice) + '（折价 ' + num(st.rightsDiscount, 0) + '%）'
        },
        convert: {
          key: 'convert', label: '可转债', en: 'CONVERTIBLE', desc: '先按债付低息，转股价高于现价；转股后债务消失、股本增加。',
          dilution: convShares / (baseShares + convShares) * 100, debt: R, interest: coupon,
          eps: st.profit / (baseShares + convShares), shares: baseShares + convShares,
          extra: '转股价 ' + px(convPrice) + ' · 年息 ' + yi(coupon)
        },
        debt: {
          key: 'debt', label: '普通债务', en: 'DEBT', desc: '借钱，不稀释；利息从利润里扣，到期还本。',
          dilution: 0, debt: R, interest: interest, eps: debtEps,
          shares: baseShares, extra: '利率 ' + num(st.debtRate, 1) + '% · 年息 ' + yi(interest)
        }
      };
    }

    function renderF5() {
      var d = refiData();
      var order = ['issue', 'rights', 'convert', 'debt'];
      var sel = d[st.refinance] || d.issue;
      var vals = order.map(function (k) { return +d[k].eps.toFixed(2); });
      var colors = order.map(function (k) { return k === sel.key ? p.orange : p.blue; });
      refiChart.setData({
        labels: order.map(function (k) { return d[k].label; }),
        values: vals,
        colors: colors
      });

      var epsTxt = sel.eps < 0 ? '-' + '¥' + num(Math.abs(sel.eps), 2) : '¥' + num(sel.eps, 2);
      refiDetail.innerHTML = '<h3>' + sel.label + '<span>' + sel.en + '</span></h3>' +
        '<p>' + sel.desc + '</p>' +
        '<div class="fipo-dcells">' +
        '<div><span>稀释（新股 / 总股本）</span><b>' + pc(sel.dilution, 1) + '</b></div>' +
        '<div><span>新增负债</span><b>' + (sel.debt ? yi(sel.debt) : '—') + '</b></div>' +
        '<div><span>年利息</span><b>' + (sel.interest ? yi(sel.interest) : '—') + '</b></div>' +
        '<div><span>摊薄后 EPS</span><b>' + epsTxt + '</b></div>' +
        '</div>' +
        '<div class="foot">' + sel.extra + '<br>募资后账上现金 ' + yi(d.cash + d.R) + '；' +
        (sel.key === 'convert' ? 'EPS 按全部转股计算。' : sel.key === 'debt' ? 'EPS 已扣除利息。' : 'EPS 未计新增利润。') + '</div>';

      var rows = order.map(function (k) {
        var x = d[k];
        var eps = x.eps < 0 ? '-¥' + num(Math.abs(x.eps), 2) : '¥' + num(x.eps, 2);
        return [
          k === sel.key ? '<b>' + x.label + '</b>' : x.label,
          yi(d.R),
          pc(x.dilution, 1),
          x.debt ? yi(x.debt) : '—',
          x.interest ? yi(x.interest) : '—',
          yi(d.cash + d.R),
          eps
        ];
      });
      ui.clear(f5TableWrap);
      var tbl = ui.table(['方案', '募资', '稀释', '新增负债', '年利息', '账上现金', '摊薄 EPS'], rows);
      Array.prototype.forEach.call(tbl.querySelectorAll('tbody tr'), function (tr, i) {
        if (order[i] === sel.key) tr.classList.add('sel');
      });
      f5TableWrap.appendChild(tbl);

      var f = '';
      if (sel.key === 'issue') {
        f = '新股数 = ' + num(d.R) + ' ÷ ' + num(d.price) + ' = <b>' + sh(d.issue.shares - d.baseShares, 3) + '</b><br>' +
          '稀释 = ' + num(d.issue.shares - d.baseShares, 3) + ' ÷ ' + num(d.issue.shares, 3) + ' = <b>' + pc(d.issue.dilution, 2) + '</b><br>' +
          'EPS = ' + num(st.profit) + ' ÷ ' + num(d.issue.shares, 3) + ' = <b>¥' + num(d.issue.eps, 3) + '</b>';
      } else if (sel.key === 'rights') {
        f = '配股价 = ' + num(d.price) + ' × (1 − ' + num(st.rightsDiscount, 0) + '%) = <b>' + px(d.price * (1 - st.rightsDiscount / 100)) + '</b><br>' +
          '新股数 = ' + num(d.R) + ' ÷ 配股价 = <b>' + sh(d.rights.shares - d.baseShares, 3) + '</b><br>' +
          '不参与配股 → 稀释 <b>' + pc(d.rights.dilution, 2) + '</b>';
      } else if (sel.key === 'convert') {
        f = '转股价 = ' + num(d.price) + ' × (1 + ' + num(st.convPremium, 0) + '%) = <b>' + px(d.price * (1 + st.convPremium / 100)) + '</b><br>' +
          '全转股新股数 = ' + num(d.R) + ' ÷ 转股价 = <b>' + sh(d.convert.shares - d.baseShares, 3) + '</b><br>' +
          '转股后 EPS = ' + num(st.profit) + ' ÷ ' + num(d.convert.shares, 3) + ' = <b>¥' + num(d.convert.eps, 3) + '</b>';
      } else {
        f = '年利息 = ' + num(d.R) + ' × ' + num(st.debtRate, 1) + '% = <b>' + yi(d.debt.interest) + '</b><br>' +
          'EPS = (' + num(st.profit) + ' − ' + num(d.debt.interest) + ') ÷ ' + num(d.baseShares) + ' = <b>¥' + num(d.debt.eps, 3) + '</b><br>' +
          '稀释 = <b>0%</b>，但负债 ' + yi(d.R) + ' 要还本付息。';
      }
      fx.f5.innerHTML = f;
    }

    /* =========================================================
     *  F6 render
     * ========================================================= */
    function renderF6() {
      var m = model();
      var shares = m.post, price = st.secondaryPrice, cash = m.net, profit = st.profit;
      var epsBefore = profit / shares;

      f6BaseCells[0].textContent = sh(shares, 2);
      f6BaseCells[1].textContent = px(price);
      f6BaseCells[2].textContent = yi(profit);
      f6BaseCells[3].textContent = yi(cash);

      /* buyback */
      var budget = Math.min(st.buybackCash, cash);
      var bb = core.buyback({ shares: shares * YI, price: price, cash: budget * YI, profit: profit * YI });
      var bbShares = bb.postShares / YI;
      var bbCash = cash - bb.spent / YI;
      miniRefs.buy.rows.innerHTML =
        '<div class="fipo-ba-row"><span>股本</span><b>' + num(shares, 2) + ' → ' + num(bbShares, 3) + ' 亿股</b></div>' +
        '<div class="fipo-ba-row"><span>账上现金</span><b>' + num(cash, 2) + ' → ' + num(bbCash, 2) + ' 亿元</b></div>' +
        '<div class="fipo-ba-row"><span>EPS</span><b>¥' + num(epsBefore, 2) + ' → ¥' + num(bb.epsAfter, 2) + '</b></div>' +
        '<div class="fipo-ba-row"><span>总市值</span><b>' + num(shares * price, 1) + ' → ' + num(bbShares * price, 1) + ' 亿元</b></div>';
      miniRefs.buy.out.textContent = '注销 ' + num(bb.repurchased / 1e4, 1) + ' 万股；现金减少 ' +
        num(bb.spent / YI, 2) + ' 亿元，市值等额下降。';

      /* split */
      var sp = core.split({ shares: shares, price: price, ratio: st.splitRatio, profit: profit });
      miniRefs.split.rows.innerHTML =
        '<div class="fipo-ba-row"><span>股本</span><b>' + num(shares, 2) + ' → ' + num(sp.shares, 2) + ' 亿股</b></div>' +
        '<div class="fipo-ba-row"><span>股价</span><b>' + px(price) + ' → ' + px(sp.price) + '</b></div>' +
        '<div class="fipo-ba-row"><span>EPS</span><b>¥' + num(sp.epsBefore, 2) + ' → ¥' + num(sp.epsAfter, 2) + '</b></div>' +
        '<div class="fipo-ba-row"><span>总市值</span><b>' + num(sp.marketValueBefore, 1) + ' → ' + num(sp.marketValueAfter, 1) + ' 亿元</b></div>';
      miniRefs.split.out.textContent = '1 拆 ' + st.splitRatio + '：股数 ×' + st.splitRatio +
        '、股价 ÷' + st.splitRatio + '，市值不变，只是单位变小。';

      /* dividend */
      var dv = core.dividend({ shares: shares, dps: st.dps, price: price });
      miniRefs.div.rows.innerHTML =
        '<div class="fipo-ba-row"><span>每股分红</span><b>¥' + num(st.dps, 2) + ' / 股</b></div>' +
        '<div class="fipo-ba-row"><span>派现总额</span><b>' + yi(dv.cash) + '</b></div>' +
        '<div class="fipo-ba-row"><span>除权价 / 股息率</span><b>' + px(dv.exPrice) + ' / ' + pc(dv.yieldPct, 2) + '</b></div>' +
        '<div class="fipo-ba-row"><span>账上现金</span><b>' + num(cash, 2) + ' → ' + num(cash - dv.cash, 2) + ' 亿元</b></div>';
      miniRefs.div.out.textContent = '股东收到现金，除权后股价下调；税前总价值不变（' + yi(dv.valueBefore) + '）。';

      /* stock merger */
      var mg = core.merger({
        acquirerShares: shares, acquirerPrice: price,
        targetValue: st.dealTargetValue, premiumPct: st.dealPremium,
        acquirerProfit: profit, targetProfit: st.dealTargetProfit
      });
      var dilution = mg.newShares / mg.postShares * 100;
      var dealValue = st.dealTargetValue * (1 + st.dealPremium / 100);
      var targetPE = st.dealTargetValue / st.dealTargetProfit;
      var acqPE = price / epsBefore;
      miniRefs.merger.rows.innerHTML =
        '<div class="fipo-ba-row"><span>新发股份</span><b>' + num(mg.newShares, 3) + ' 亿股（对价 ' + num(dealValue, 2) + ' 亿）</b></div>' +
        '<div class="fipo-ba-row"><span>稀释</span><b>' + pc(dilution, 1) + '</b></div>' +
        '<div class="fipo-ba-row"><span>合并净利润</span><b>' + num(profit + st.dealTargetProfit, 2) + ' 亿元</b></div>' +
        '<div class="fipo-ba-row"><span>EPS</span><b>¥' + num(epsBefore, 2) + ' → ¥' + num(mg.epsAfter, 2) + '</b></div>';
      miniRefs.merger.out.textContent = '标的 PE ' + num(targetPE, 1) + '× vs 收购方 ' + num(acqPE, 1) + '× → ' +
        (mg.epsAfter >= epsBefore ? '增厚' : '摊薄') + ' EPS；现金没有流出，但原股东被稀释。';

      var d = '';
      d += '回购：' + num(budget, 2) + ' 亿 ÷ ' + num(price) + ' 元 = <b>' + num(bb.repurchased / 1e4, 1) + ' 万股</b>注销<br>';
      d += '拆股：' + num(shares, 2) + ' 亿股 × ' + st.splitRatio + ' = <b>' + num(sp.shares, 2) + ' 亿股</b>，股价 ' + px(sp.price) + '<br>';
      d += '分红：' + num(shares, 2) + ' 亿股 × ' + num(st.dps, 2) + ' 元 = <b>' + yi(dv.cash) + '</b><br>';
      d += '并购：对价 ' + num(dealValue, 2) + ' 亿 ÷ ' + num(price) + ' 元 = <b>' + num(mg.newShares, 3) + ' 亿股</b>新股';
      fx.f6.innerHTML = d;
    }

    /* =========================================================
     *  F7 render
     * ========================================================= */
    function renderF7() {
      fillMap();
      fx.f7.innerHTML = '市值 = 股价 × 总股本 → 二级价格改变的是<b>股东财富</b>，不是公司现金。<br>' +
        '公司现金的变化来自：发行募资、经营现金流、借款、回购与分红。<br>' +
        '资本动作先分类，再算账：<b>谁付钱、谁收钱、谁被稀释、谁承担义务</b>。';
    }

    /* =========================================================
     *  render + panel sync
     * ========================================================= */
    function render() {
      var mode = st.mode;
      wrapF1.style.display = mode === 'f1' ? '' : 'none';
      wrapF2.style.display = mode === 'f2' ? '' : 'none';
      wrapF3.style.display = mode === 'f3' ? '' : 'none';
      wrapF4.style.display = mode === 'f4' ? '' : 'none';
      wrapF5.style.display = mode === 'f5' ? '' : 'none';
      wrapF6.style.display = mode === 'f6' ? '' : 'none';
      wrapF7.style.display = mode === 'f7' ? '' : 'none';

      gF1.style.display = mode === 'f1' ? '' : 'none';
      gF2.style.display = mode === 'f2' ? '' : 'none';
      gF3.style.display = mode === 'f3' ? '' : 'none';
      gF4.style.display = mode === 'f4' ? '' : 'none';
      gF5.style.display = mode === 'f5' ? '' : 'none';
      gF6.style.display = mode === 'f6' ? '' : 'none';
      gF7.style.display = mode === 'f7' ? '' : 'none';

      Object.keys(fx).forEach(function (k) { fx[k].style.display = k === mode ? '' : 'none'; });
      Object.keys(wn).forEach(function (k) { wn[k].style.display = k === mode ? '' : 'none'; });

      modeCtl.set(mode);
      ctlPre.set(st.preShares, true); ctlNew.set(st.newShares, true); ctlPrice.set(st.offerPrice, true);
      ctlProfit.set(st.profit, true); ctlPE.set(st.marketPE, true); ctlHeat.set(st.demandHeat, true);
      ctlFee.set(st.feeRate, true); ctlOld.set(st.oldShares, true);
      ctlOld.el.style.display = st.transferMode === 'old' ? '' : 'none';
      f2BtnNew.setAttribute('aria-pressed', String(st.transferMode !== 'old'));
      f2BtnOld.setAttribute('aria-pressed', String(st.transferMode === 'old'));
      ctlPrice3.set(st.offerPrice, true); ctlQty3.set(st.newShares, true); ctlHeat3.set(st.demandHeat, true);
      ctlSec.set(st.secondaryPrice, true);
      ctlRefi.set(st.refinance); ctlRaise.set(st.raiseAmount, true); ctlDebtRate.set(st.debtRate, true);
      ctlCoupon.set(st.convCoupon, true); ctlConvPre.set(st.convPremium, true); ctlRightsDis.set(st.rightsDiscount, true);
      ctlBuy.set(st.buybackCash, true); ctlSplit.set(st.splitRatio, true); ctlDps.set(st.dps, true); ctlDeal.set(st.dealTargetValue, true);

      if (mode === 'f1') renderF1();
      else if (mode === 'f2') renderF2();
      else if (mode === 'f3') renderF3();
      else if (mode === 'f4') renderF4();
      else if (mode === 'f5') renderF5();
      else if (mode === 'f6') renderF6();
      else renderF7();
    }

    render();

    return {
      apply: function (patch) {
        if (!patch) return;
        Object.assign(st, patch);
        render();
      },
      destroy: function () {
        donutPre.destroy(); donutPost.destroy();
        f3Chart.destroy(); wealthChart.destroy(); refiChart.destroy();
      }
    };
  }

  SM.registerModule({
    id: 'F', slug: 'ipo', order: 6,
    title: 'IPO 与资本运作', en: 'CAPITAL',
    subtitle: '从发行、定价到再融资、回购、拆股与并购',
    hint: '先问钱进了谁的口袋，再看股本、每股收益和市值怎么变。',
    scenes: [
      {
        title: 'IPO：把公司的一部分卖给公众',
        body: '上市前 1 亿股、年净利润 1 亿元，创始人持股 60%。公司增发 2,500 万股，以每股 12 元卖给公众。<br>发行后总股本 1.25 亿股：募资 3 亿元进入公司，创始人持股被稀释到 48%，每股收益从 1.00 元降到 0.80 元。',
        patch: {
          mode: 'f1', preShares: 1, prePrice: 10, newShares: 0.25, offerPrice: 12,
          profit: 1, marketPE: 25, demandHeat: 1, feeRate: 6
        },
        guide: '先改发行价，再改发行股数：看募资额、总市值和创始人持股如何分头变化。',
        duration: 13000
      },
      {
        title: '募资额、老股东市值、总市值是三本账',
        body: '同样是“股数 × 价格”，钱可能进公司，也可能进卖股票的老股东口袋。<br>只有新股发行募到的现金属于公司；老股转让、二级市场买卖都只在股东之间换手。',
        patch: { mode: 'f2', transferMode: 'new', feeRate: 6, oldShares: 0.15 },
        guide: '切到“老股转让”：公司收到的现金变成 0，但卖方拿到了钱。',
        duration: 13000
      },
      {
        title: '需求曲线决定你能定多高的价',
        body: '把 8 家机构的最高报价从高到低排开：发行价越低，愿意认购的股数越多。<br>发行价高于“出清价”会认购不足；低于出清价则超额认购。这是课堂模型，不是对真实 IPO 的预测。',
        patch: { mode: 'f3', offerPrice: 12, newShares: 0.25, demandHeat: 1 },
        guide: '把发行价拖到 16 元以上，观察认购倍数跌破 1 倍时会发生什么。',
        duration: 14000
      },
      {
        title: '上市之后：股价涨跌不改变公司现金',
        body: '把二级市场股价从 12 元推到 18 元：总市值和创始人的股票市值都上涨，打新中签的投资者浮盈。<br>但公司账上仍然是发行时收到的那笔钱，一分没多。',
        patch: { mode: 'f4', offerPrice: 12, newShares: 0.25, secondaryPrice: 18, feeRate: 6 },
        guide: '把二级价格拖到 6 元：公司现金不变，公众投资者却亏损。',
        duration: 13000
      },
      {
        title: '再融资：四条路，四种代价',
        body: '公司需要 3 亿元：增发让新股东分享未来，配股向老股东要钱，可转债先低息借钱、转股后再稀释，债务不稀释但利息吞利润。<br>募资额相同，代价不同。',
        patch: { mode: 'f5', refinance: 'issue', raiseAmount: 3, debtRate: 5, convCoupon: 2, convPremium: 20, rightsDiscount: 30 },
        guide: '依次切换四种方案，比较“稀释”和“利息”两列。',
        duration: 14000
      },
      {
        title: '四个资本动作，四本账',
        body: '回购和分红把现金送出公司；拆股只改单位、不改市值；换股并购不付现金，却会发行新股、稀释原股东。<br>每个小实验只动一个变量，观察股本、现金、EPS 和市值如何联动。',
        patch: {
          mode: 'f6', preShares: 1, newShares: 0.25, offerPrice: 12, secondaryPrice: 12,
          profit: 1, feeRate: 6, buybackCash: 0.5, splitRatio: 2, dps: 0.4,
          dealTargetValue: 3, dealPremium: 30, dealTargetProfit: 0.6
        },
        guide: '四个小实验共享同一家公司；先看回购，再看拆股，对比“股本变化”与“市值变化”。',
        duration: 15000
      },
      {
        title: '把资本动作分成三类',
        body: '真正给公司送钱的、只在股东之间搬价值的、给公司留下未来义务的。<br>看懂一笔操作属于哪一类，比记住它的名字更有用；同一操作也可能同时属于两类。',
        patch: { mode: 'f7' },
        guide: '先读三列分类，再点下面的判断卡，检验自己是否真的分清。',
        duration: 14000
      }
    ],
    quiz: [
      {
        q: '某公司 IPO 发行 2,500 万股、每股 12 元，承销费率 6%。公司真正收到的募资净额约为？',
        options: ['2.82 亿元', '3.00 亿元', '15.00 亿元', '1.80 亿元'],
        answer: 0,
        explain: '毛募资 = 2,500 万 × 12 = 3.00 亿元；扣 6% 承销费后 ≈ <b>2.82 亿元</b>。15 亿是总市值，1.8 亿是老股转让的卖方所得。'
      },
      {
        q: '上市后股价从 12 元涨到 18 元，公司账上现金会怎样？',
        options: ['增加 6 亿元', '不变', '减少', '按持股比例增加'],
        answer: 1,
        explain: '二级市场买卖只发生在投资者之间，<b>公司没有收到新增现金</b>；它的现金来自发行、经营和融资。'
      },
      {
        q: '回购注销股票，在利润不变时通常会使每股收益（EPS）如何变化？',
        options: ['上升，因为股本变小', '下降，因为现金变少', '不变，因为市值不变', '无法判断'],
        answer: 0,
        explain: 'EPS = 净利润 ÷ 总股本；回购注销让<b>分母变小</b>，EPS 可能上升。但公司同时付出现金，市值等额下降。'
      }
    ],
    mount: mount
  });
})();
