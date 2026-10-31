/* Module A — shares, ownership, market cap and where the money actually goes. */
(function () {
  'use strict';
  var SM = window.SM;
  var ui = SM.ui, core = SM.core, charts = SM.charts;

  var DEFAULT = {
    mode: 'a1',
    shares: 1e8, price: 10, founderPct: 45, instPct: 30, splitRatio: 1,
    tradePrice: 10.5, tradeQty: 500,
    issueQty: 2e7, issuePrice: 10
  };

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var p = charts.palette();
    var stage = ctx.stage;
    var panel = ctx.panel;

    /* ---------------- stage ---------------- */
    var wrapA1 = ui.el('div', 'stage-grid two');
    wrapA1.style.cssText = 'flex:1;min-height:0';
    var left = ui.el('div', 'fill');
    var donutHost = ui.el('div', 'chart');
    donutHost.style.flex = '1';
    left.appendChild(donutHost);
    var right = ui.el('div', 'fill');
    var barHost = ui.el('div', 'chart');
    barHost.style.flex = '1';
    right.appendChild(barHost);
    wrapA1.appendChild(left); wrapA1.appendChild(right);

    var wrapA2 = ui.el('div');
    wrapA2.style.cssText = 'display:flex;flex-direction:column;justify-content:center;gap:18px;flex:1;min-height:0';
    var flow = ui.el('div', 'flow');
    flow.style.flex = '0 0 auto';
    var flowBars = ui.el('div', 'chart');
    flowBars.style.cssText = 'flex:0 0 230px;height:230px;min-height:230px';
    wrapA2.appendChild(flow); wrapA2.appendChild(flowBars);
    var a1Note = ui.el('p', 'stage-note');
    var a2Note = ui.el('p', 'stage-note');
    stage.appendChild(wrapA1); stage.appendChild(wrapA2); stage.appendChild(a1Note); stage.appendChild(a2Note);

    var donut = charts.donut(donutHost, { segments: [], center: { value: '—', label: '总市值' }, label: '股权结构饼图' });
    var bars = charts.bars(barHost, { labels: [], values: [], yFormat: function (v) { return v.toFixed(1) + '亿'; }, label: '股东持股市值与公司现金对比' });
    var flowChart = charts.bars(flowBars, { labels: [], values: [], yFormat: function (v) { return ui.fmt.compact(v); }, label: '现金分布' });

    /* ---------------- panel ---------------- */
    var gCompany = ui.section(panel, 'A1 · 公司设定', 'SHARES');
    var sharesCtl = ui.slider({ label: '总股本', min: 0.2, max: 5, step: 0.1, value: 1, unit: '亿股', onInput: function (v) { st.shares = v * 1e8; sync(); } });
    var priceCtl = ui.slider({ label: '每股价格', min: 2, max: 60, step: 0.5, value: 10, unit: '元', onInput: function (v) { st.price = v; sync(); } });
    var founderCtl = ui.slider({ label: '创始人持股', min: 5, max: 90, step: 1, value: 45, unit: '%', onInput: function (v) { st.founderPct = v; fitOwners(); sync(); } });
    var instCtl = ui.slider({ label: '机构持股', min: 0, max: 60, step: 1, value: 30, unit: '%', onInput: function (v) { st.instPct = v; fitOwners(); sync(); } });
    gCompany.appendChild(sharesCtl.el); gCompany.appendChild(priceCtl.el);
    gCompany.appendChild(founderCtl.el); gCompany.appendChild(instCtl.el);
    var ownerWarn = ui.warn('创始人 + 机构不得超过 95%，否则公众持股不足 5%。');
    ownerWarn.style.display = 'none';
    gCompany.appendChild(ownerWarn);

    var gSplit = ui.section(panel, 'A1 · 股票拆分', 'SPLIT');
    var splitCtl = ui.seg({
      label: '1 股拆为',
      options: [{ value: '1', label: '不拆' }, { value: '2', label: '2 股' }, { value: '3', label: '3 股' }, { value: '4', label: '4 股' }],
      value: 1,
      onChange: function (v) { st.splitRatio = Number(v); sync(); }
    });
    gSplit.appendChild(splitCtl.el);
    var splitNote = ui.note('');
    gSplit.appendChild(splitNote);

    var gMetrics = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 'cap', label: '总市值' },
      { key: 'cash', label: '公司账上现金' },
      { key: 'shares', label: '总股本' },
      { key: 'price', label: '每股价格' },
      { key: 'founder', label: '创始人持股' },
      { key: 'founderVal', label: '创始人持股市值' }
    ]);
    gMetrics.appendChild(m.el);
    gMetrics.appendChild(ui.formula('市值 = 股价 × 总股本<br>股东持股市值 = 持股数 × 股价<br><b>公司现金不随股价变化</b>'));
    var companyNote = ui.note('公司账上现金是经营与融资的结果。股价上涨只改变<strong>市场报价</strong>，不等于公司收到等额现金。');
    gMetrics.appendChild(companyNote);

    var gMarket = ui.section(panel, 'A2 · 市场', 'FLOW');
    var modeCtl = ui.seg({
      label: '交易场景',
      options: [{ value: 'secondary', label: '二级市场' }, { value: 'primary', label: '一级市场发行' }],
      value: 'secondary',
      onChange: function (v) { st.primary = v === 'primary'; sync(); }
    });
    gMarket.appendChild(modeCtl.el);

    var gSecondary = ui.section(panel, 'A2 · 投资者之间', 'SECONDARY');
    var tradePriceCtl = ui.slider({ label: '成交价', min: 5, max: 30, step: 0.5, value: 10.5, unit: '元', onInput: function (v) { st.tradePrice = v; sync(); } });
    var tradeQtyCtl = ui.slider({ label: '成交数量', min: 100, max: 1000, step: 100, value: 500, unit: '股', onInput: function (v) { st.tradeQty = v; sync(); } });
    gSecondary.appendChild(tradePriceCtl.el); gSecondary.appendChild(tradeQtyCtl.el);
    gSecondary.appendChild(ui.note('A 把股票卖给 B。现金从 B 流向 A，股票从 A 流向 B；<b>公司不在这笔交易里</b>。'));

    var gPrimary = ui.section(panel, 'A2 · 公司发行新股', 'PRIMARY');
    var issueQtyCtl = ui.slider({ label: '新发行股数', min: 100, max: 5000, step: 100, value: 2000, unit: '万股', onInput: function (v) { st.issueQty = v * 1e4; sync(); } });
    var issuePriceCtl = ui.slider({ label: '发行价', min: 3, max: 30, step: 0.5, value: 10, unit: '元', onInput: function (v) { st.issuePrice = v; sync(); } });
    gPrimary.appendChild(issueQtyCtl.el); gPrimary.appendChild(issuePriceCtl.el);
    gPrimary.appendChild(ui.note('公司向认购方发行新股，认购款进入<b>公司账户</b>；老股东持股比例被稀释。'));

    var gFlowMetrics = ui.section(panel, '资金读数', 'CASH');
    var fm = ui.metrics([
      { key: 'aCash', label: 'A 现金' },
      { key: 'aShares', label: 'A 持股' },
      { key: 'bCash', label: 'B / 认购方现金' },
      { key: 'bShares', label: 'B / 认购方持股' },
      { key: 'coCash', label: '公司现金' },
      { key: 'coShares', label: '公司总股本' }
    ]);
    gFlowMetrics.appendChild(fm.el);
    var flowFormula = ui.formula('');
    gFlowMetrics.appendChild(flowFormula);
    var flowWarn = ui.warn('');
    gFlowMetrics.appendChild(flowWarn);

    var gReset = ui.section(panel);
    gReset.appendChild(ui.row([ui.reset(function () { Object.assign(st, DEFAULT); sync(); })]));

    function fitOwners() {
      if (st.founderPct + st.instPct > 95) {
        st.instPct = Math.max(0, 95 - st.founderPct);
        instCtl.set(st.instPct, true);
      }
      var sum = st.founderPct + st.instPct;
      ownerWarn.style.display = sum > 90 ? 'block' : 'none';
    }

    /* ---------------- calculations ---------------- */
    function numbers() {
      var postShares = st.shares * st.splitRatio;
      var postPrice = st.price / st.splitRatio;
      var cap = postShares * postPrice;
      var founderShares = postShares * st.founderPct / 100;
      var instShares = postShares * st.instPct / 100;
      var publicShares = postShares - founderShares - instShares;
      return {
        postShares: postShares, postPrice: postPrice, cap: cap,
        founderShares: founderShares, instShares: instShares, publicShares: publicShares,
        founderValue: founderShares * postPrice,
        instValue: instShares * postPrice,
        publicValue: publicShares * postPrice,
        companyCash: 2e8,
        splitBefore: st.shares, splitBeforePrice: st.price
      };
    }

    function secondary() {
      var q = Math.min(st.tradeQty, 1000);
      var p0 = st.tradePrice;
      var aCash = 100000 + q * p0;
      var aShares = 1000 - q;
      var bCash = 100000 - q * p0;
      var bShares = q;
      return {
        aCash: aCash, aShares: aShares, bCash: bCash, bShares: bShares,
        aValue: (1000 - q) * p0, bValue: q * p0, coCash: 0, coShares: 1e8,
        traded: q * p0, labelA: '投资者 A（卖出）', labelB: '投资者 B（买入）',
        note: 'A 收到现金 ¥' + ui.fmt.num(q * p0, 0) + '，B 付出同等现金；公司现金仍为 ¥0。'
      };
    }

    function primary() {
      var proceeds = st.issueQty * st.issuePrice;
      var coShares = 1e8 + st.issueQty;
      var founderAfter = 45 * 1e8 / coShares;
      var instCash = 1e9 - proceeds;
      return {
        aCash: 100000, aShares: 1000,
        bCash: instCash, bShares: st.issueQty,
        aValue: 1000 * st.issuePrice, bValue: proceeds, coCash: proceeds, coShares: coShares,
        proceeds: proceeds, founderAfter: founderAfter,
        dilution: st.issueQty / coShares * 100,
        labelA: '投资者 A（未参与）', labelB: '认购方（机构）',
        note: '认购款 ¥' + ui.fmt.compact(proceeds) + ' 从认购方流入公司；老股东持股比例由 45% 降至 ' + founderAfter.toFixed(2) + '%。'
      };
    }

    function current() { return st.mode === 'a2' ? (st.primary ? primary() : secondary()) : numbers(); }

    /* ---------------- render ---------------- */
    function renderA1() {
      var n = numbers();
      donut.setData({
        segments: [
          { label: '创始人', value: st.founderPct, color: p.cyan, display: ui.fmt.compact(n.founderValue) },
          { label: '机构', value: st.instPct, color: p.blue, display: ui.fmt.compact(n.instValue) },
          { label: '公众', value: 100 - st.founderPct - st.instPct, color: p.violet, display: ui.fmt.compact(n.publicValue) }
        ],
        center: { value: ui.fmt.compact(n.cap), label: '总市值' }
      });
      bars.setData({
        labels: ['创始人', '机构', '公众', '公司现金'],
        values: [n.founderValue / 1e8, n.instValue / 1e8, n.publicValue / 1e8, n.companyCash / 1e8],
        colors: [p.cyan, p.blue, p.violet, p.orange]
      });
      m.set({
        cap: ui.fmt.compact(n.cap), cash: ui.fmt.compact(n.companyCash),
        shares: ui.fmt.compact(n.postShares) + ' 股', price: '¥' + ui.fmt.price(n.postPrice),
        founder: st.founderPct + '%', founderVal: ui.fmt.compact(n.founderValue)
      }, { cap: 'hi' });
      splitNote.innerHTML = st.splitRatio > 1
        ? '拆股前：' + ui.fmt.compact(n.splitBefore) + ' 股 × ¥' + ui.fmt.price(n.splitBeforePrice) +
          '<br>拆股后：' + ui.fmt.compact(n.postShares) + ' 股 × ¥' + ui.fmt.price(n.postPrice) +
          '<br>总市值不变，创始人持股比例仍是 ' + st.founderPct + '%。'
        : '拆股只改变“股数 × 每股价格”的组合，不自动创造价值。';
      companyNote.innerHTML = '公司账上现金 <b>' + ui.fmt.compact(n.companyCash) + '</b>，与总市值 <b>' + ui.fmt.compact(n.cap) + '</b> 是两个概念。股价上涨不会把这笔差额打进公司账户。';
      a1Note.innerHTML = '市值 = 每股价格 ¥' + ui.fmt.price(n.postPrice) + ' × 总股本 ' + ui.fmt.compact(n.postShares) +
        ' 股 = <b>' + ui.fmt.compact(n.cap) + '</b>；公司账上现金 <b>' + ui.fmt.compact(n.companyCash) + '</b>。' +
        '市值是市场给全部股份的报价，不是公司可以动用的现金。';
      a1Note.style.display = '';
    }

    function renderA2() {
      var d = st.primary ? primary() : secondary();
      flow.innerHTML = '';
      var cards = [
        { title: d.labelA, cash: d.aCash, shares: d.aShares, cls: '' },
        { title: d.labelB, cash: d.bCash, shares: d.bShares, cls: 'accent' },
        { title: '上市公司', cash: d.coCash, shares: d.coShares, cls: 'company' }
      ];
      cards.forEach(function (c, i) {
        var card = ui.el('div', 'flow-card ' + c.cls);
        card.innerHTML = '<div class="fc-name">' + c.title + '</div>' +
          '<div class="fc-row"><span>现金</span><b>' + ui.fmt.money(c.cash) + '</b></div>' +
          '<div class="fc-row"><span>持股</span><b>' + ui.fmt.compact(c.shares) + ' 股</b></div>';
        if (i === 2) {
          card.innerHTML += '<div class="fc-row highlight"><span>' + (st.primary ? '本次募资' : '二级市场收款') + '</span><b>' + (st.primary ? ui.fmt.compact(d.proceeds) : '¥0') + '</b></div>';
        } else {
          card.innerHTML += '<div class="fc-row"><span>持仓市值</span><b>' + ui.fmt.money(i === 0 ? d.aValue : d.bValue) + '</b></div>';
        }
        flow.appendChild(card);
        if (i < 2) {
          var mid = ui.el('div', 'flow-mid');
          mid.innerHTML = st.primary && i === 0
            ? '<span class="flow-arrow">认购款 →</span><span class="flow-arrow back">新股 →</span>'
            : '<span class="flow-arrow">股票 →</span><span class="flow-arrow back">← 现金</span>';
          flow.appendChild(mid);
        }
      });
      var labels = st.primary ? ['投资者 A', '认购方', '公司现金'] : ['投资者 A', '投资者 B', '公司现金'];
      var values = st.primary ? [d.aCash, d.bCash, d.coCash] : [d.aCash, d.bCash, d.coCash];
      flowChart.setData({ labels: labels, values: values, colors: [p.blue, p.violet, p.orange] });
      if (st.primary) {
        a2Note.innerHTML = '公司收到认购款 <b>' + ui.fmt.compact(d.proceeds) + '</b>，总股本从 ' + ui.fmt.compact(1e8) +
          ' 股增加到 <b>' + ui.fmt.compact(d.coShares) + '</b> 股；老股东没有收到这笔钱，但持股比例被稀释到 <b>' +
          d.founderAfter.toFixed(2) + '%</b>。';
      } else {
        a2Note.innerHTML = '成交金额 <b>' + ui.fmt.money(d.traded) + '</b>：A 的现金增加、B 的现金减少，' +
          '公司现金始终为 <b>¥0</b>。二级市场里股票和现金只在投资者之间换手。';
      }
      a2Note.style.display = '';
      fm.set({
        aCash: ui.fmt.money(d.aCash), aShares: ui.fmt.compact(d.aShares),
        bCash: ui.fmt.money(d.bCash), bShares: ui.fmt.compact(d.bShares),
        coCash: ui.fmt.money(d.coCash), coShares: ui.fmt.compact(d.coShares)
      }, { coCash: st.primary ? 'pos' : 'hi' });
      if (st.primary) {
        flowFormula.innerHTML = '募资 = 新发行股数 × 发行价 = ' + ui.fmt.compact(st.issueQty) + ' × ¥' + ui.fmt.price(st.issuePrice) +
          ' = <b>' + ui.fmt.compact(d.proceeds) + '</b><br>稀释后创始人比例 = 45% × 原股本 / 新股本 = <b>' + d.founderAfter.toFixed(2) + '%</b>';
        flowWarn.textContent = '注意：认购款进入公司；老股东没有收到这笔钱，但持股比例被稀释。';
        flowWarn.style.display = 'block';
      } else {
        flowFormula.innerHTML = '成交金额 = ' + ui.fmt.int(Math.min(st.tradeQty, 1000)) + ' × ¥' + ui.fmt.price(st.tradePrice) +
          ' = <b>' + ui.fmt.money(d.traded) + '</b><br>现金守恒：A 增加 = B 减少；公司现金变化 = <b>¥0</b>';
        flowWarn.textContent = '二级市场价格上涨，只是 A、B 之间的成交价变化，公司没有收到等额现金。';
        flowWarn.style.display = 'block';
      }
    }

    function sync() {
      var a1 = st.mode === 'a1';
      wrapA1.style.display = a1 ? '' : 'none';
      wrapA2.style.display = a1 ? 'none' : '';
      a1Note.style.display = a1 ? '' : 'none';
      a2Note.style.display = a1 ? 'none' : '';
      gMetrics.style.display = a1 ? '' : 'none';
      gFlowMetrics.style.display = a1 ? 'none' : '';
      gCompany.style.display = a1 ? '' : 'none';
      gSplit.style.display = a1 ? '' : 'none';
      companyNote.style.display = a1 ? '' : 'none';
      gMarket.style.display = a1 ? 'none' : '';
      gSecondary.style.display = !a1 && !st.primary ? '' : 'none';
      gPrimary.style.display = !a1 && st.primary ? '' : 'none';
      fm.el.style.display = a1 ? 'none' : '';
      flowFormula.style.display = a1 ? 'none' : '';
      flowWarn.style.display = 'none';
      modeCtl.set(st.primary ? 'primary' : 'secondary');
      sharesCtl.set(st.shares / 1e8, true);
      priceCtl.set(st.price, true);
      founderCtl.set(st.founderPct, true);
      instCtl.set(st.instPct, true);
      splitCtl.set(String(st.splitRatio));
      tradePriceCtl.set(st.tradePrice, true);
      tradeQtyCtl.set(Math.min(st.tradeQty, 1000), true);
      issueQtyCtl.set(st.issueQty / 1e4, true);
      issuePriceCtl.set(st.issuePrice, true);
      if (a1) renderA1(); else renderA2();
    }

    function apply(patch) {
      Object.assign(st, patch || {});
      if (patch && patch.mode) st.mode = patch.mode;
      if (st.mode === 'a2') st.primary = !!st.primary;
      fitOwners();
      sync();
    }

    sync();

    return { apply: apply, destroy: function () { donut.destroy(); bars.destroy(); flowChart.destroy(); } };
  }

  SM.registerModule({
    id: 'A', slug: 'basics', order: 1,
    title: '股票、公司与市场', en: 'BASICS',
    subtitle: '股份、市值、拆股，以及钱到底流向了谁',
    hint: '拖动滑块，观察持股比例、总市值与公司现金如何分开变化。',
    scenes: [
      {
        title: '把公司切成 1 亿份',
        body: '一家公司发行 <b>1 亿股</b>，每股 <b>10 元</b>，总市值就是 10 亿元。创始人拿 45%，机构拿 30%，其余是公众股东。<br>买一股，买的是这家公司的<strong>一部分所有权</strong>，不是一张会生息的票据。',
        patch: { mode: 'a1', shares: 1e8, price: 10, founderPct: 45, instPct: 30, splitRatio: 1 },
        guide: '观察饼图：三块相加必须是 100%。',
        duration: 11000
      },
      {
        title: '股价翻倍，谁的钱变了？',
        body: '把股价从 10 元调到 <b>20 元</b>：总市值从 10 亿变成 20 亿，创始人持股市值也翻倍。<br>但公司账上现金仍是 <b>2 亿元</b>——它没有因为股价上涨收到一分钱。市值是<strong>市场报价 × 总股本</strong>，不是公司的银行存款。',
        patch: { price: 20 },
        guide: '对比柱状图：三根持股柱变长，现金柱不动。',
        duration: 12000
      },
      {
        title: '拆股：股数翻倍，价格减半',
        body: '选择 <b>1 拆 2</b>：股数变成 2 亿股，每股价格变成 5 元，总市值仍是 10 亿元，创始人依旧持有 45%。<br>拆股降低的是“每股价格”这个门槛，不会自动创造财富。',
        patch: { splitRatio: 2, price: 10 },
        guide: '看“拆股前 / 拆股后”两行：乘积是否相同？',
        duration: 11000
      },
      {
        title: '二级市场：A 卖给 B',
        body: '投资者 A 把 500 股卖给 B，成交价 10.5 元。现金从 B 流向 A，股票从 A 流向 B。<br>整笔交易里，<strong>上市公司不是交易对手</strong>，公司现金变化为 0。',
        patch: { mode: 'a2', primary: false, tradePrice: 10.5, tradeQty: 500 },
        guide: '看三张卡片：A 与 B 的现金一增一减，公司卡片不变。',
        duration: 12000
      },
      {
        title: '股价涨了，公司还是没收到钱',
        body: '把成交价调到 <b>20 元</b>：B 付出的现金更多，A 收到的更多，公司现金仍为 <b>0</b>。<br>这就是“股价上涨 ≠ 公司融资”的最直接演示。二级市场只是股东之间的转手。',
        patch: { tradePrice: 20 },
        guide: '确认“公司现金”卡片始终是 ¥0。',
        duration: 11000
      },
      {
        title: '一级市场：发行新股才收到钱',
        body: '切换到一级市场：公司新发行 <b>2000 万股</b>，发行价 10 元，募集 2 亿元进入<strong>公司账户</strong>。<br>代价是总股本变大，老股东持股比例从 45% 被稀释到约 36.7%。',
        patch: { mode: 'a2', primary: true, issueQty: 2e7, issuePrice: 10 },
        guide: '看“公司现金”：只有发行新股时它才增加。',
        duration: 13000
      }
    ],
    quiz: [
      {
        q: '公司总股本 2 亿股，股价 15 元。总市值是多少？',
        options: ['15 亿元', '30 亿元', '2 亿元', '无法计算，要看公司现金'],
        answer: 1,
        explain: '总市值 = 股价 × 总股本 = 15 × 2 亿 = <b>30 亿元</b>。公司账上现金不参与这个乘法。'
      },
      {
        q: '1 拆 2 之后，下列哪一项保持不变？',
        options: ['每股价格', '总股本', '总市值与持股比例', '每股收益'],
        answer: 2,
        explain: '股数翻倍、价格减半，乘积（总市值）不变；持股比例也不变。每股收益会因股数增加而减半。'
      },
      {
        q: '你在二级市场花 2000 元买入 100 股，上市公司收到多少？',
        options: ['2000 元', '扣除佣金后的余额', '0 元', '取决于公司是否分红'],
        answer: 2,
        explain: '二级市场交易发生在投资者之间，钱付给卖出方，公司<b>收到 0 元</b>。只有 IPO、增发、配股等一级市场发行，公司才收到募集资金。'
      }
    ],
    mount: mount
  });
})();
