/* Module E — A-share vs US market rules as a dual lab bench.
 * All rule numbers come from SM.rules; the account, halt and session models
 * are teaching simplifications and say so. */
(function () {
  'use strict';
  var SM = window.SM;
  var ui = SM.ui, rules = SM.rules;

  var DEFAULT = {
    mode: 'e1',
    sel: 0,
    qty: 100,
    prev: 10, scope: 'main', side: 'buy', price3: 10, pressure: 'none', result3: null,
    ref: 100, tier: 1, price4: 100, halted: false, haltPrice: null, e4events: [],
    spPct: 0, timeMin: 600,
    dst: 'edt'
  };

  var BOARDS = [
    { value: 'main', label: '主板（含 ST）' },
    { value: 'chinext', label: '创业板' },
    { value: 'star', label: '科创板' },
    { value: 'bse', label: '北交所' },
    { value: 'new', label: '新股前 5 日' }
  ];
  var US_BREAKER_NOTE = rules.markets.us.limits[2].note;
  var CUTOFF_TEXT = (US_BREAKER_NOTE.match(/\d{1,2}:\d{2}/) || ['15:25'])[0];
  var CUTOFF_MIN = (function () { var p = CUTOFF_TEXT.split(':'); return (+p[0]) * 60 + (+p[1]); })();
  var LEVELS = [-7, -13, -20].map(function (p) { return rules.usMarketBreaker(p); });

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(min) {
    min = ((min % 1440) + 1440) % 1440;
    return pad2(Math.floor(min / 60)) + ':' + pad2(min % 60);
  }
  function r2(v) { return Math.round(v * 100) / 100; }
  function signOf(v) { return v > 0 ? '+' : v < 0 ? '−' : ''; }
  function parseRange(s) {
    var m = String(s).match(/(\d{1,2}):(\d{2})\s*[–\-]\s*(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return [(+m[1]) * 60 + (+m[2]), (+m[3]) * 60 + (+m[4])];
  }
  function boardLabel(scope) {
    for (var i = 0; i < BOARDS.length; i++) if (BOARDS[i].value === scope) return BOARDS[i].label;
    return scope;
  }
  function cnLimitOf(s) { return rules.limitPrices(s.prev, rules.cnLimitPct(s.scope)); }

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage, panel = ctx.panel;

    injectStyle();

    /* E2 account state */
    var cnAcct = null, usAcct = null, day = 1, e2logs = [], msgCN = null, msgUS = null;
    var CN_PRICE = 20, US_PRICE = 200;

    function resetAccounts() {
      cnAcct = { cash: 100000, hold: 0, avail: 0, pending: 0 };
      usAcct = { cash: 100000, hold: 0, avail: 0, pending: 0 };
      day = 1; e2logs = [];
      msgCN = { text: 'T+1 回转：今天买入的股票，下一交易日起才能卖出。当前无持仓。', tone: 'dim' };
      msgUS = { text: 'T+1 交收：常规账户当日可回转交易，钱/券在 T+1 交收。当前无持仓。', tone: 'dim' };
    }
    resetAccounts();

    /* ================= stage scaffolding ================= */
    var wrap = {};
    ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'].forEach(function (m) {
      var w = ui.el('div', 'e-stage');
      w.style.display = 'none';
      stage.appendChild(w);
      wrap[m] = w;
    });

    function card(title, right) {
      var c = ui.el('div', 'e-card');
      var h = ui.el('div', 'e-card-head');
      h.innerHTML = '<span>' + title + '</span><span>' + (right || '') + '</span>';
      var body = ui.el('div', 'e-card-body');
      c.appendChild(h); c.appendChild(body);
      return { el: c, body: body, head: h };
    }
    function pill(text, tone) { return '<span class="e-pill ' + (tone || '') + '">' + text + '</span>'; }

    /* ================= E1 comparison ================= */
    var e1grid = ui.el('div', 'e1-grid');
    wrap.e1.appendChild(e1grid);
    var e1left = card('制度对照', 'COMPARISON');
    e1left.body.style.padding = '0';
    e1left.body.style.display = 'flex';
    e1left.body.style.flexDirection = 'column';
    var e1TableHost = ui.el('div', 'e1-table');
    e1left.body.appendChild(e1TableHost);
    var e1quick = ui.el('div', 'e1-quick');
    e1quick.innerHTML =
      '<div><span>A 股</span><p>回转 T+1；涨跌幅按板块 10 / 20 / 30%；集合竞价 + 连续竞价；100 股整数倍。</p></div>' +
      '<div><span>美股</span><p>无统一涨跌幅；LULD 个股价格带；T+1 交收；1 股起，部分券商支持碎股。</p></div>';
    e1left.body.appendChild(e1quick);
    var e1keys = ui.el('div', 'e1-keybox');
    e1keys.innerHTML =
      '<div class="e1-keybox-h">三个最容易混淆的点</div>' +
      '<div class="e1-key"><span>回转</span><b>A 股 T+1 限制</b><i>美股常规账户通常可当日回转</i></div>' +
      '<div class="e1-key"><span>交收</span><b>两地现在都是 T+1</b><i>美股自 2024-05-28 起改为 T+1</i></div>' +
      '<div class="e1-key"><span>波动</span><b>个股价格带 + 市场熔断</b><i>两级机制，触发条件不同</i></div>';
    e1left.body.appendChild(e1keys);
    e1grid.appendChild(e1left.el);

    var e1side = ui.el('div', 'e1-side');
    var e1asof = ui.el('div', 'e1-asof');
    e1side.appendChild(e1asof);
    var e1noteCard = card('差异说明', 'NOTE');
    e1noteCard.el.style.flex = '1';
    var e1noteHost = ui.el('div', 'e1-note-body');
    e1noteCard.body.style.padding = '0';
    e1noteCard.body.appendChild(e1noteHost);
    e1side.appendChild(e1noteCard.el);
    var e1warn = ui.el('div', 'e1-warn');
    e1warn.innerHTML = '规则可能变化，以交易所、监管机构与券商的最新公告为准。本页是制度对照，不是交易建议。';
    e1side.appendChild(e1warn);
    e1grid.appendChild(e1side);

    function renderE1() {
      var rows = '<div class="e1-row head"><span class="dim">维度</span><span>A 股</span><span>美股</span></div>';
      rules.comparison.forEach(function (r, i) {
        rows += '<div class="e1-row' + (i === st.sel ? ' sel' : '') + '" data-i="' + i + '">' +
          '<span class="dim">' + r.dimension + '</span>' +
          '<span class="cn">' + r.cn + '</span>' +
          '<span class="us">' + r.us + '</span></div>';
      });
      e1TableHost.innerHTML = rows;
      var r2c = rules.comparison[st.sel] || rules.comparison[0];
      e1asof.innerHTML = '<span class="e1-asof-k">规则快照</span><b>asOf ' + rules.asOf + '</b><i>规则可能变化，以官方为准</i>';
      e1noteHost.innerHTML =
        '<div class="e1-note-top"><span class="e1-dim-no">' + (st.sel + 1) + ' / ' + rules.comparison.length + '</span>' +
        '<h3>' + r2c.dimension + '</h3></div>' +
        '<div class="e1-pair"><div><span class="e1-tag cn">A 股</span><p>' + r2c.cn + '</p></div>' +
        '<div><span class="e1-tag us">美股</span><p>' + r2c.us + '</p></div></div>' +
        '<div class="e1-note-box"><span>NOTE</span><p>' + r2c.note + '</p></div>' +
        '<div class="e1-myths"><div class="e1-myths-h">常见误解</div>' +
        '<p>✗ 美股 T+1 交收 = 当天不能卖 —— 交收是钱券到账，不是回转限制。</p>' +
        '<p>✗ 涨停 = 停止交易 —— 涨停只限制申报价，仍可排队成交。</p>' +
        '<p>✗ 交易所规则 = 券商规则 —— 佣金、品种与账户权限由券商与监管共同决定。</p></div>' +
        '<div class="e1-click-hint">点击左侧任意一行，查看该维度的说明。</div>';
    }
    e1TableHost.addEventListener('click', function (ev) {
      var row = ev.target.closest ? ev.target.closest('.e1-row') : null;
      if (!row || row.classList.contains('head')) return;
      st.sel = +row.getAttribute('data-i');
      renderE1();
      if (e1SelCtl) e1SelCtl.set(String(st.sel));
    });

    /* ================= E2 T+1 ================= */
    var e2Banner = ui.el('div', 'e2-banner');
    e2Banner.innerHTML = '<b>A 股 · T+1 回转</b> 今天买入，下一交易日才能卖 &nbsp;·&nbsp; ' +
      '<b>美股 · T+1 交收</b> 常规账户可当日买卖，钱/券在成交后 T+1 交收';
    wrap.e2.appendChild(e2Banner);

    var e2grid = ui.el('div', 'e2-grid');
    var e2cn = card('A 股账户', 'CNY · T+1 回转');
    var e2cnHost = ui.el('div', 'e2-acct');
    e2cn.body.style.padding = '0';
    e2cn.body.appendChild(e2cnHost);
    var e2us = card('美股账户', 'USD · T+1 交收');
    var e2usHost = ui.el('div', 'e2-acct');
    e2us.body.style.padding = '0';
    e2us.body.appendChild(e2usHost);
    e2grid.appendChild(e2cn.el); e2grid.appendChild(e2us.el);
    wrap.e2.appendChild(e2grid);

    var e2logCard = card('账户流水', 'LOG');
    e2logCard.el.style.flex = '1';
    e2logCard.el.style.minHeight = '120px';
    var e2logHost = ui.el('div', 'e2-log');
    e2logCard.body.style.padding = '0';
    e2logCard.body.appendChild(e2logHost);
    wrap.e2.appendChild(e2logCard.el);

    function e2AccountHTML(market, cur, a, msg) {
      var isCN = market === 'cn';
      var pendingText = isCN ? ('股票 ' + a.pending + ' 股') : ('现金 ' + (cur === 'CNY' ? '¥' : '$') + ui.fmt.num(a.pending, 2));
      var badge = a.avail > 0 ? pill('可卖 ' + a.avail + ' 股', 'ok') : pill('可卖 0 股', 'warn');
      return '<div class="e2-top"><div class="e2-name"><span class="e2-dot ' + (isCN ? 'cn' : 'us') + '"></span>' +
        (isCN ? 'A 股' : '美股') + '<span class="e2-sub">' + (isCN ? 'T+1 回转' : 'T+1 交收') + '</span></div>' + badge + '</div>' +
        '<div class="e2-big"><div><span>持仓</span><b>' + a.hold + '</b><em>股</em></div>' +
        '<div><span>可卖</span><b class="' + (a.avail > 0 ? 'ok' : 'warn') + '">' + a.avail + '</b><em>股</em></div></div>' +
        '<div class="e2-rows">' +
        '<div><span>现金</span><b>' + (cur === 'CNY' ? '¥' : '$') + ui.fmt.num(a.cash, 2) + '</b></div>' +
        '<div><span>待交收</span><b>' + pendingText + '</b></div>' +
        '<div><span>交收周期</span><b>' + (isCN ? rules.markets.cn.settlement.stock : rules.markets.us.settlement.stock) + '</b></div>' +
        '</div>' +
        '<div class="e2-msg ' + msg.tone + '">' + msg.text + '</div>' +
        '<div class="e2-fine">' + (isCN ? rules.markets.cn.settlement.sellRestriction : rules.markets.us.settlement.note) + '</div>';
    }

    function renderE2() {
      e2cnHost.innerHTML = e2AccountHTML('cn', 'CNY', cnAcct, msgCN);
      e2usHost.innerHTML = e2AccountHTML('us', 'USD', usAcct, msgUS);
      e2logHost.innerHTML = '';
      if (!e2logs.length) {
        e2logHost.innerHTML = '<div class="e-empty">点击「两边买入」，再点「两边尝试当日卖出」，观察 A 股与美股的区别。</div>';
      } else {
        var rows = e2logs.slice().reverse().map(function (l) {
          return ['D' + l.day, l.market, l.action, '<span class="e2-lres ' + l.tone + '">' + l.result + '</span>'];
        });
        e2logHost.appendChild(ui.table(['日', '市场', '操作', '结果'], rows));
      }
      mE2.set({
        cnHold: cnAcct.hold + ' 股', cnAvail: cnAcct.avail + ' 股',
        cnCash: '¥' + ui.fmt.num(cnAcct.cash, 0), cnPend: cnAcct.pending + ' 股',
        usHold: usAcct.hold + ' 股', usAvail: usAcct.avail + ' 股',
        usCash: '$' + ui.fmt.num(usAcct.cash, 0), usPend: '$' + ui.fmt.num(usAcct.pending, 2)
      }, { cnAvail: cnAcct.avail > 0 ? 'pos' : 'neg' });
      e2Banner.innerHTML = '<b>第 ' + day + ' 天（D' + day + '）</b> &nbsp; A 股 · T+1 回转：今天买入，下一交易日才能卖 &nbsp;·&nbsp; ' +
        '美股 · T+1 交收：常规账户可当日买卖，钱/券在成交后 T+1 交收';
    }

    function logE2(market, action, result, tone) {
      e2logs.push({ day: day, market: market, action: action, result: result, tone: tone || '' });
      if (e2logs.length > 24) e2logs.shift();
    }

    function buyBoth() {
      var q = st.qty, a1 = q * CN_PRICE, a2 = q * US_PRICE;
      if (cnAcct.cash >= a1) {
        cnAcct.cash -= a1; cnAcct.hold += q; cnAcct.pending += q;
        msgCN = { text: '买入 ' + q + ' 股 @ ¥' + ui.fmt.price(CN_PRICE) + '：持仓 ' + cnAcct.hold + '，可卖 ' + cnAcct.avail + '。当日买入被 T+1 回转锁定，下一交易日才可卖。', tone: 'warn' };
        logE2('A 股', '买入 ' + q + ' 股', '成交；可卖仍为 ' + cnAcct.avail, 'warn');
      } else {
        msgCN = { text: '现金不足：需要 ¥' + ui.fmt.num(a1, 2) + '。', tone: 'bad' };
        logE2('A 股', '买入 ' + q + ' 股', '拒绝：现金不足', 'bad');
      }
      if (usAcct.cash >= a2) {
        usAcct.cash -= a2; usAcct.hold += q; usAcct.avail += q;
        msgUS = { text: '买入 ' + q + ' 股 @ $' + ui.fmt.price(US_PRICE) + '：持仓 ' + usAcct.hold + '，可卖 ' + usAcct.avail + '（账户允许当日回转），股票 T+1 交收。', tone: 'ok' };
        logE2('美股', '买入 ' + q + ' 股', '成交；可卖 +' + q, 'ok');
      } else {
        msgUS = { text: '现金不足：需要 $' + ui.fmt.num(a2, 2) + '。', tone: 'bad' };
        logE2('美股', '买入 ' + q + ' 股', '拒绝：现金不足', 'bad');
      }
      renderE2();
    }

    function sellBoth() {
      var q = st.qty, a1 = q * CN_PRICE, a2 = q * US_PRICE;
      if (cnAcct.avail >= q) {
        cnAcct.avail -= q; cnAcct.hold -= q; cnAcct.cash += a1;
        msgCN = { text: '卖出 ' + q + ' 股 @ ¥' + ui.fmt.price(CN_PRICE) + ' 成交：持仓 ' + cnAcct.hold + '，可卖 ' + cnAcct.avail + '。卖出所得当日可继续买入，提现时间以券商为准。', tone: 'ok' };
        logE2('A 股', '卖出 ' + q + ' 股', '成交；现金 +¥' + ui.fmt.num(a1, 2), 'ok');
      } else {
        var exact = 'A 股 T+1 回转：当日买入不可卖出，可卖数量 ' + cnAcct.avail + '，下一交易日 ' + cnAcct.hold;
        msgCN = { text: exact, tone: 'bad' };
        logE2('A 股', '尝试当日卖出 ' + q + ' 股', '拒绝：可卖数量 ' + cnAcct.avail + '，T+1 回转限制', 'bad');
      }
      if (usAcct.avail >= q) {
        usAcct.avail -= q; usAcct.hold -= q; usAcct.pending += a2;
        msgUS = { text: '卖出 ' + q + ' 股 @ $' + ui.fmt.price(US_PRICE) + ' 成交：价款 $' + ui.fmt.num(a2, 2) + ' 进入待交收，下一交易日到账；持仓 ' + usAcct.hold + '，可卖 ' + usAcct.avail + '。', tone: 'ok' };
        logE2('美股', '卖出 ' + q + ' 股', '成交；待交收 +$' + ui.fmt.num(a2, 2), 'ok');
      } else {
        msgUS = { text: '可卖数量不足：当前可卖 ' + usAcct.avail + ' 股。', tone: 'bad' };
        logE2('美股', '卖出 ' + q + ' 股', '拒绝：可卖不足', 'bad');
      }
      renderE2();
    }

    function nextDay() {
      day += 1;
      var cnAvail = cnAcct.hold;
      var settled = usAcct.pending;
      cnAcct.avail = cnAvail; cnAcct.pending = 0;
      usAcct.cash += settled; usAcct.pending = 0;
      msgCN = { text: '进入第 ' + day + ' 天（D' + day + '）：昨日买入的 ' + cnAvail + ' 股完成交收，可卖数量更新为 ' + cnAvail + '。T+1 回转限制解除。', tone: 'ok' };
      msgUS = { text: '进入第 ' + day + ' 天（D' + day + '）：T+1 交收到账 $' + ui.fmt.num(settled, 2) + '，现金 $' + ui.fmt.num(usAcct.cash, 2) + '；可卖数量仍为 ' + usAcct.avail + '。', tone: 'ok' };
      logE2('A 股', '进入下一交易日', '可卖更新为 ' + cnAvail + ' 股', 'ok');
      logE2('美股', '进入下一交易日', '交收 $' + ui.fmt.num(settled, 2) + ' 到账', 'ok');
      renderE2();
    }

    /* ================= E3 price limits ================= */
    var e3grid = ui.el('div', 'e3-grid');
    wrap.e3.appendChild(e3grid);
    var e3left = card('价格带', 'PRICE BAND');
    var e3big = ui.el('div', 'e-bigline');
    var e3gaugeHost = ui.el('div', 'e-gauge-host');
    var e3stats = ui.el('div', 'e-band-stats');
    e3left.body.appendChild(e3big);
    e3left.body.appendChild(e3gaugeHost);
    e3left.body.appendChild(e3stats);
    var e3formula = ui.el('div', 'e-formula');
    e3left.body.appendChild(e3formula);
    var e3ref = ui.el('div', 'e-ref');
    e3left.body.appendChild(e3ref);
    e3grid.appendChild(e3left.el);

    var e3right = card('申报校验', 'CHECK');
    var e3checkHost = ui.el('div', 'e-check');
    e3right.body.appendChild(e3checkHost);
    var e3note = ui.el('div', 'e-note');
    e3right.body.appendChild(e3note);
    var e3lot = ui.el('div', 'e-ref');
    e3right.body.appendChild(e3lot);
    e3grid.appendChild(e3right.el);

    function renderE3() {
      var lim = cnLimitOf(st);
      var pct = lim.pct, lower = lim.lower, upper = lim.upper;
      var price = st.price3;
      var state = pct == null ? '无涨跌幅限制' :
        price > upper + 0.005 ? '高于涨停价' :
          price < lower - 0.005 ? '低于跌停价' :
            price >= upper - 0.005 ? '涨停' :
              price <= lower + 0.005 ? '跌停' : '正常';
      var chg = (price / st.prev - 1) * 100;
      var tone = state === '涨停' || state === '高于涨停价' ? 'up' :
        state === '跌停' || state === '低于跌停价' ? 'down' : state === '无涨跌幅限制' ? 'warn' : '';
      e3big.innerHTML = '<b>¥' + ui.fmt.price(price) + '</b>' +
        '<span class="e-chg ' + (chg > 0 ? 'up' : chg < 0 ? 'down' : '') + '">' + signOf(chg) + ui.fmt.num(Math.abs(chg), 2) + '%</span>' +
        '<span class="e-state ' + tone + '">' + state + '</span>' +
        '<span class="e-board">' + boardLabel(st.scope) + '</span>';
      e3gaugeHost.innerHTML = bandGauge({
        prev: st.prev, lower: lower, upper: upper, price: price,
        hot: state === '涨停' || state === '跌停'
      });
      e3stats.innerHTML =
        '<div><span>跌停价</span><b>' + (lower == null ? '—' : '¥' + ui.fmt.price(lower)) + '</b></div>' +
        '<div><span>昨收</span><b>¥' + ui.fmt.price(st.prev) + '</b></div>' +
        '<div><span>涨停价</span><b>' + (upper == null ? '—' : '¥' + ui.fmt.price(upper)) + '</b></div>';
      e3formula.innerHTML = pct == null ?
        '无涨跌幅限制：新股上市前 5 个交易日不设价格带；第 6 个交易日起按所属板块执行。' :
        '涨停价 = round2(昨收 × (1 + ' + pct + '%)) = ¥' + ui.fmt.price(upper) + '<br>' +
        '跌停价 = round2(昨收 × (1 − ' + pct + '%)) = ¥' + ui.fmt.price(lower) + '<br>' +
        '可申报区间：¥' + ui.fmt.price(lower) + ' – ¥' + ui.fmt.price(upper);
      var boardRows = BOARDS.map(function (b) {
        var p2 = rules.cnLimitPct(b.value);
        return '<div class="e-ref-cell' + (b.value === st.scope ? ' on' : '') + '"><span>' + b.label + '</span><b>' + (p2 == null ? '不设' : '±' + p2 + '%') + '</b></div>';
      }).join('');
      e3ref.innerHTML = '<div class="e-ref-h">板块与幅度</div><div class="e-ref-grid">' + boardRows + '</div>' +
        '<p class="e-ref-note">' + rules.markets.cn.limits[0].note + '；新股第 6 个交易日起按所属板块执行。</p>';
      e3lot.innerHTML = '<div class="e-ref-h">申报单位（示例）</div>' +
        '<p class="e-ref-note">' + rules.markets.cn.lot.note + '</p>' +
        '<p class="e-ref-note">价格带只约束申报价，不保证成交；涨停时买单仍可能排队。' + (pct == null ? '当前无价格带。' : '') + '</p>';
      var res = st.result3;
      var range = pct == null ? '无涨跌幅限制' : '¥' + ui.fmt.price(lower) + ' – ¥' + ui.fmt.price(upper);
      var html = '<div class="e-check-head"><span class="e-side ' + (st.side === 'buy' ? 'up' : 'down') + '">' + (st.side === 'buy' ? '买入' : '卖出') + '</span>' +
        '<span>限价 ¥' + ui.fmt.price(price) + '</span><span>' + st.qty + ' 股</span></div>';
      html += '<div class="e-check-status ' + (res ? (res.ok ? 'ok' : 'bad') : 'dim') + '">' +
        (res ? (res.ok ? '已受理' : '已拒绝') : '未提交') + '</div>';
      html += '<div class="e-check-msg">' + (res ? res.msg : '点击「提交申报」，检查报价是否落在允许的价格带内。本页只做申报校验，不撮合。') + '</div>';
      html += '<div class="e-range"><span>可申报区间</span><b>' + range + '</b></div>';
      if (state === '高于涨停价') html += '<div class="e-tip up">申报价高于涨停价 ¥' + ui.fmt.price(upper) + '，会被交易所拒绝；把价格拉回区间内再提交。</div>';
      else if (state === '低于跌停价') html += '<div class="e-tip down">申报价低于跌停价 ¥' + ui.fmt.price(lower) + '，会被交易所拒绝；把价格拉回区间内再提交。</div>';
      else if (state === '涨停') html += '<div class="e-tip up">涨停价仍可成交：价格被限制在 ¥' + ui.fmt.price(upper) + '，高于该价的买单申报会被拒绝，但已在排队或成交的委托可以继续。涨停≠不能交易。</div>';
      else if (state === '跌停') html += '<div class="e-tip down">跌停价同样可以成交：低于 ¥' + ui.fmt.price(lower) + ' 的卖单申报会被拒绝。跌停≠一定卖不出去。</div>';
      else if (state === '无涨跌幅限制') html += '<div class="e-tip">新股前 5 日没有价格带；波动可能更大，交易所仍会用临时停牌等工具控制异常波动。</div>';
      else html += '<div class="e-tip">价格在价格带内，申报可被受理。价格带只限制申报价格，不保证成交。</div>';
      e3checkHost.innerHTML = html;
      e3note.innerHTML = '<b>主板 ST</b>：' + rules.markets.cn.limits[0].note + '。不同板块的幅度不同，' +
        '以 ' + rules.asOf + ' 的规则快照为准。';
      var stTone = state === '涨停' ? 'up' : state === '跌停' ? 'down' : '';
      mE3.set({
        up: upper == null ? '—' : '¥' + ui.fmt.price(upper),
        down: lower == null ? '—' : '¥' + ui.fmt.price(lower),
        state: state,
        range: range
      }, { up: 'pos', down: 'neg' });
    }

    function submitE3() {
      var lim = cnLimitOf(st);
      if (lim.pct == null) {
        st.result3 = { ok: true, msg: '申报价 ¥' + ui.fmt.price(st.price3) + ' 已受理：新股前 5 个交易日不设涨跌幅限制（仅校验，不撮合）。' };
      } else if (st.price3 > lim.upper + 0.0001) {
        st.result3 = { ok: false, msg: '报价高于涨停价 ' + ui.fmt.price(lim.upper) + ' 元，无法申报；可申报区间 ¥' + ui.fmt.price(lim.lower) + ' – ¥' + ui.fmt.price(lim.upper) + '。' };
      } else if (st.price3 < lim.lower - 0.0001) {
        st.result3 = { ok: false, msg: '报价低于跌停价 ' + ui.fmt.price(lim.lower) + ' 元，无法申报；可申报区间 ¥' + ui.fmt.price(lim.lower) + ' – ¥' + ui.fmt.price(lim.upper) + '。' };
      } else {
        st.result3 = { ok: true, msg: '申报价 ¥' + ui.fmt.price(st.price3) + ' 位于 ¥' + ui.fmt.price(lim.lower) + ' – ¥' + ui.fmt.price(lim.upper) + ' 内，已受理（仅校验，不撮合）。' };
      }
      renderE3();
    }

    function pressureE3(kind) {
      var lim = cnLimitOf(st);
      st.pressure = kind;
      if (kind === 'buy') st.price3 = lim.upper != null ? lim.upper : r2(st.prev * 1.1);
      else st.price3 = lim.lower != null ? lim.lower : r2(st.prev * 0.9);
      st.result3 = null;
      mE3.set({});
      renderE3();
      if (price3Ctl) price3Ctl.set(st.price3, true);
    }

    /* ================= E4 LULD ================= */
    var e4grid = ui.el('div', 'e4-grid');
    wrap.e4.appendChild(e4grid);
    var e4left = card('个股价格带', 'LULD');
    var e4big = ui.el('div', 'e-bigline');
    var e4gaugeHost = ui.el('div', 'e-gauge-host');
    var e4stats = ui.el('div', 'e-band-stats');
    var e4formula = ui.el('div', 'e-formula');
    e4left.body.appendChild(e4big);
    e4left.body.appendChild(e4gaugeHost);
    e4left.body.appendChild(e4stats);
    e4left.body.appendChild(e4formula);
    var e4ref = ui.el('div', 'e-ref');
    e4left.body.appendChild(e4ref);
    e4grid.appendChild(e4left.el);

    var e4right = card('交易状态', 'STATUS');
    var e4statusHost = ui.el('div', 'e-check');
    e4right.body.appendChild(e4statusHost);
    var e4steps = ui.el('div', 'e-ref');
    e4right.body.appendChild(e4steps);
    var e4foot = ui.el('div', 'e-foot');
    e4right.el.appendChild(e4foot);
    e4grid.appendChild(e4right.el);

    function luldNow() { return rules.usLuldBand(st.ref, st.tier); }

    function renderE4() {
      var b = luldNow();
      var state = st.halted ? '暂停交易' : '正常交易';
      var tone = st.halted ? 'bad' : 'ok';
      var chg = (st.price4 / st.ref - 1) * 100;
      e4big.innerHTML = '<b>$' + ui.fmt.price(st.price4) + '</b>' +
        '<span class="e-chg ' + (chg > 0 ? 'up' : chg < 0 ? 'down' : '') + '">' + signOf(chg) + ui.fmt.num(Math.abs(chg), 2) + '%</span>' +
        '<span class="e-state ' + (st.halted ? 'down' : '') + '">' + state + '</span>' +
        '<span class="e-board">Tier ' + st.tier + ' · ±' + b.pct + '%</span>';
      e4gaugeHost.innerHTML = bandGauge({
        prev: st.ref, lower: b.lower, upper: b.upper, price: st.price4, hot: st.halted
      });
      e4stats.innerHTML =
        '<div><span>下轨</span><b>$' + ui.fmt.price(b.lower) + '</b></div>' +
        '<div><span>参考价</span><b>$' + ui.fmt.price(st.ref) + '</b></div>' +
        '<div><span>上轨</span><b>$' + ui.fmt.price(b.upper) + '</b></div>';
      e4formula.innerHTML = '价格带 = 参考价 × (1 ± ' + b.pct + '%)：$' + ui.fmt.price(b.lower) + ' – $' + ui.fmt.price(b.upper) +
        '<br>Tier 1：股价 &gt; $3 通常 5%，$0.75–$3 为 10%；Tier 2 为 20%。';
      e4ref.innerHTML = '<div class="e-ref-h">Tier 与价格带</div><div class="e-ref-grid">' +
        '<div class="e-ref-cell' + (st.tier === 1 && st.ref > 3 ? ' on' : '') + '"><span>Tier 1 · &gt;$3</span><b>±5%</b></div>' +
        '<div class="e-ref-cell' + (st.tier === 1 && st.ref <= 3 ? ' on' : '') + '"><span>Tier 1 · $0.75–$3</span><b>±10%</b></div>' +
        '<div class="e-ref-cell' + (st.tier === 2 ? ' on' : '') + '"><span>Tier 2</span><b>±20%</b></div>' +
        '</div><p class="e-ref-note">价格带按参考价重算；复盘后的新参考价会改变上下轨。</p>';
      e4steps.innerHTML = '<div class="e-ref-h">暂停与复盘</div>' +
        '<ol class="e-steps"><li>成交价越过上轨或下轨</li><li>个股暂停交易 5 分钟</li><li>集合竞价复盘，产生新参考价</li><li>按新参考价重算价格带</li></ol>';
      var evs = st.e4events.slice(-4).reverse().map(function (e) {
        return '<div class="e4-event">' + e.text + '</div>';
      }).join('');
      e4statusHost.innerHTML =
        '<div class="e-check-status ' + tone + '">' + state + '</div>' +
        '<div class="e-check-msg">' + (st.halted ?
          '价格 $' + ui.fmt.price(st.price4) + ' 越过价格带边界 → 触发暂停。实际规则是暂停 5 分钟后通过集合竞价复盘；本模型用「复盘并重算」代替计时。' :
          '价格仍在 $' + ui.fmt.price(b.lower) + ' – $' + ui.fmt.price(b.upper) + ' 内，连续交易正常进行。拖动价格滑杆越过边界即可触发暂停。') + '</div>' +
        '<div class="e-range"><span>参考价</span><b>$' + ui.fmt.price(st.ref) + '</b></div>' +
        '<div class="e-range"><span>价格带宽度</span><b>±' + b.pct + '%</b></div>' +
        '<div class="e4-events"><div class="e4-events-h">事件</div>' + (evs || '<div class="e-empty small">暂无暂停事件。</div>') + '</div>' +
        '<div class="e-tip">LULD 是<b>个股</b>价格带；标普 500 级别的 7/13/20% 熔断见 E5，两者不是同一机制。</div>';
      mE4.set({
        state: state,
        width: '±' + b.pct + '%',
        upper: '$' + ui.fmt.price(b.upper),
        lower: '$' + ui.fmt.price(b.lower),
        count: String(st.e4events.length)
      }, { state: st.halted ? 'neg' : '' });
    }

    function price4Changed(v) {
      var b = luldNow();
      st.price4 = v;
      if (!st.halted && (v > b.upper + 0.0001 || v < b.lower - 0.0001)) {
        st.halted = true;
        st.haltPrice = v;
        var side = v > b.upper ? '上轨 $' + ui.fmt.price(b.upper) : '下轨 $' + ui.fmt.price(b.lower);
        st.e4events.push({ text: '价格 $' + ui.fmt.price(v) + ' 越过' + side + ' → 暂停交易' });
      }
      renderE4();
    }

    function reopenE4() {
      if (!st.halted) return;
      var from = st.haltPrice;
      st.ref = r2(from);
      st.price4 = st.ref;
      st.halted = false;
      st.haltPrice = null;
      var b = luldNow();
      st.e4events.push({ text: '复盘：参考价更新为 $' + ui.fmt.price(st.ref) + '，新价格带 $' + ui.fmt.price(b.lower) + ' – $' + ui.fmt.price(b.upper) });
      if (refCtl) refCtl.input.value = st.ref;
      if (price4Ctl) {
        price4Ctl.setRange(r2(st.ref * 0.7), r2(st.ref * 1.3));
        price4Ctl.set(st.price4, true);
      }
      renderE4();
    }
    e4foot.appendChild(ui.button('复盘并重算价格带', reopenE4, 'sm primary'));

    /* ================= E5 market-wide breakers ================= */
    var e5top = ui.el('div', 'e5-top');
    var e5levelCard = card('市场级熔断', 'MARKET-WIDE');
    var e5levelHost = ui.el('div', 'e5-level');
    e5levelCard.body.appendChild(e5levelHost);
    e5top.appendChild(e5levelCard.el);
    var e5actionCard = card('当前处置', 'ACTION');
    var e5actionHost = ui.el('div', 'e5-action');
    e5actionCard.body.appendChild(e5actionHost);
    e5top.appendChild(e5actionCard.el);
    wrap.e5.appendChild(e5top);

    var e5timelineCard = card('交易日时间轴', 'ET');
    var e5timelineHost = ui.el('div', 'e5-timeline');
    e5timelineCard.body.appendChild(e5timelineHost);
    e5timelineCard.el.style.flex = '1';
    wrap.e5.appendChild(e5timelineCard.el);

    var e5thHost = ui.el('div', 'e5-thresholds');
    wrap.e5.appendChild(e5thHost);

    function renderE5() {
      var b = rules.usMarketBreaker(st.spPct);
      var beforeCutoff = st.timeMin < CUTOFF_MIN;
      var closed = st.timeMin >= 960;
      var applies = b.level > 0 && b.level < 3 && beforeCutoff && !closed;
      var action;
      if (b.level === 0) action = '正常交易';
      else if (b.level === 3) action = '当天剩余时间停止交易';
      else if (closed) action = '已收盘：不再触发盘中停牌';
      else if (!beforeCutoff) action = CUTOFF_TEXT + ' 后触发：不停牌（规则）';
      else action = '停牌 15 分钟，至 ' + hhmm(Math.min(960, st.timeMin + 15));
      var levelCls = 'lv' + b.level;
      e5levelHost.innerHTML = '<div class="e5-kicker">S&amp;P 500 · 相对前收</div>' +
        '<div class="e5-big ' + levelCls + '">LEVEL <b>' + b.level + '</b></div>' +
        '<div class="e5-drop">标普 500 <b>' + (st.spPct > 0 ? '+' : '') + ui.fmt.num(st.spPct, 1) + '%</b></div>' +
        '<div class="e5-sub">' + (b.level === 0 ? '未触发任何市场级阈值' : '触发 ' + b.pct + '% 阈值') + '</div>';
      e5actionHost.innerHTML =
        '<div class="e5-row"><span>当前 ET</span><b>' + hhmm(st.timeMin) + '</b></div>' +
        '<div class="e5-row"><span>规则动作</span><b>' + b.action + '</b></div>' +
        '<div class="e5-row"><span>本模型处置</span><b class="' + (applies || b.level === 3 ? 'warn' : '') + '">' + action + '</b></div>' +
        '<div class="e5-row"><span>15:25 截止</span><b>' + CUTOFF_TEXT + (beforeCutoff ? ' 前' : ' 后') + '</b></div>' +
        '<div class="e-tip">' + (b.level === 3 ?
          'Level 3：标普 500 跌幅达到 20%，当天剩余时间停止交易。' :
          b.level > 0 ? 'Level ' + b.level + '：' + b.action + '；15:25 之后触发的一级/二级不再停牌。' :
            '跌幅未到 7%，市场级熔断未触发。个股 LULD 仍可能独立触发。') + '</div>';
      var p = (st.timeMin - 570) / 390 * 100;
      var ticks = [[570, '09:30'], [630, '11:00'], [720, '12:30'], [810, '14:00'], [925, CUTOFF_TEXT], [960, '16:00']];
      var tickHTML = ticks.map(function (t, i) {
        return '<span class="e5-tick' + (i === 0 ? ' first' : '') + (i === ticks.length - 1 ? ' last' : '') + '" style="left:' + ((t[0] - 570) / 390 * 100) + '%"><i>' + t[1] + '</i></span>';
      }).join('');
      var halt = '';
      if (applies) {
        var w = Math.min(15, 960 - st.timeMin) / 390 * 100;
        halt = '<span class="e5-halt" style="left:' + p + '%;width:' + w + '%"><i>停牌 15 分钟</i></span>';
      }
      var closeShade = b.level === 3 ? '<span class="e5-closed" style="left:' + p + '%;width:' + (100 - p) + '%"></span>' : '';
      e5timelineHost.innerHTML = '<div class="e5-track">' + closeShade + '<span class="e5-progress" style="width:' + p + '%"></span>' +
        halt + '<span class="e5-marker" style="left:' + p + '%"></span>' + tickHTML + '</div>' +
        '<div class="e5-legend"><span class="lg"><em></em>交易时段</span><span class="lg halt"><em></em>停牌 15 分钟</span>' +
        '<span class="lg cutoff"><em></em>' + CUTOFF_TEXT + ' 截止线</span>' +
        (b.level === 3 ? '<span class="lg closed"><em></em>全天休市</span>' : '') + '</div>' +
        '<div class="e5-compare">' +
        '<div class="cmp ok"><span>10:00 触发 −7%</span><b>停牌 15 分钟</b></div>' +
        '<div class="cmp warn"><span>' + CUTOFF_TEXT + ' 后触发 −7%</span><b>不再停牌</b></div>' +
        '<div class="cmp bad"><span>任意时间触发 −20%</span><b>当天休市</b></div>' +
        '</div>' +
        '<div class="e5-footnote">一级、二级熔断各自最多触发一次；15:25 之后即使跌幅扩大也不再停牌（Level 3 除外）。标普 500 熔断管的是整个市场，个股 LULD 仍独立运行。</div>';
      e5thHost.innerHTML = LEVELS.map(function (lv) {
        var active = b.level >= lv.level;
        return '<div class="e5-th' + (active ? ' active lv' + lv.level : '') + '">' +
          '<span class="e5-th-pct">−' + lv.pct + '%</span>' +
          '<b>LEVEL ' + lv.level + '</b>' +
          '<small>' + (lv.level === 3 ? '全天停止交易' : '停牌 15 分钟（15:25 前）') + '</small></div>';
      }).join('');
      mE5.set({
        drop: (st.spPct > 0 ? '+' : '') + ui.fmt.num(st.spPct, 1) + '%',
        level: 'LEVEL ' + b.level,
        action: action,
        time: hhmm(st.timeMin)
      }, { level: b.level >= 2 ? 'neg' : b.level === 1 ? 'hi' : '' });
    }

    /* ================= E6 sessions & timezones ================= */
    var e6grid = ui.el('div', 'e6-grid');
    var e6cn = card('A 股 · 北京时间', 'CN SESSION');
    var e6cnHost = ui.el('div', 'e6-tl');
    e6cn.body.appendChild(e6cnHost);
    var e6us = card('美股 · 美东时间', 'US SESSION');
    var e6usHost = ui.el('div', 'e6-tl');
    e6us.body.appendChild(e6usHost);
    e6grid.appendChild(e6cn.el); e6grid.appendChild(e6us.el);
    wrap.e6.appendChild(e6grid);

    var e6bottom = ui.el('div', 'e6-bottom');
    var e6conv = card('时区换算', 'TIME ZONE');
    var e6convHost = ui.el('div', 'e6-conv');
    e6conv.body.style.padding = '0';
    e6conv.body.appendChild(e6convHost);
    e6bottom.appendChild(e6conv.el);
    var e6notes = card('盘后与边界', 'NOTES');
    var e6notesHost = ui.el('div', 'e6-notes');
    e6notes.body.appendChild(e6notesHost);
    e6bottom.appendChild(e6notes.el);
    wrap.e6.appendChild(e6bottom);

    function sessionClass(name) {
      if (/集合竞价/.test(name)) return 'auction';
      if (/盘前|盘后/.test(name)) return 'after';
      return 'regular';
    }
    function timelineHTML(sessions, market) {
      var blocks = sessions.map(function (s) {
        var r = parseRange(s.time);
        if (!r) return '';
        var left = r[0] / 1440 * 100, width = (r[1] - r[0]) / 1440 * 100;
        return '<span class="e6-block ' + market + ' ' + sessionClass(s.name) + '" style="left:' + left + '%;width:' + Math.max(0.35, width) + '%" title="' + s.name + ' ' + s.time + '"></span>';
      }).join('');
      var ticks = [0, 4, 8, 12, 16, 20, 24].map(function (h, i) {
        return '<span class="e6-xtick' + (i === 0 ? ' first' : '') + (i === 6 ? ' last' : '') + '" style="left:' + (h / 24 * 100) + '%"><i>' + pad2(h) + ':00</i></span>';
      }).join('');
      return '<div class="e6-axis">' + blocks + '<span class="e6-axis-line"></span>' + ticks + '</div>';
    }
    function listHTML(sessions) {
      return sessions.map(function (s) {
        return '<div class="e6-li"><span class="e6-dot ' + sessionClass(s.name) + '"></span>' +
          '<span class="e6-li-name">' + s.name + '</span>' +
          '<span class="e6-li-time">' + s.time + '</span>' +
          '<span class="e6-li-note">' + (s.note || '') + '</span></div>';
      }).join('');
    }
    function renderE6() {
      var cn = rules.markets.cn, us = rules.markets.us;
      e6cnHost.innerHTML = timelineHTML(cn.sessions, 'cn') + '<div class="e6-list">' + listHTML(cn.sessions) + '</div>';
      e6usHost.innerHTML = timelineHTML(us.sessions, 'us') + '<div class="e6-list">' + listHTML(us.sessions) + '</div>';
      var edt = st.dst === 'edt';
      var off = edt ? 12 : 13;
      var usOpen = 570 + off * 60, usClose = 960 + off * 60;
      var bj = function (m) {
        var d = Math.floor(m / 1440);
        return (d > 0 ? '次日 ' : d < 0 ? '前一日 ' : '') + hhmm(m);
      };
      var cnOpenET = 570 - off * 60, cnCloseET = 900 - off * 60;
      e6convHost.innerHTML = ui.table(
        ['事件', '交易所当地时间', '换算（' + (edt ? '夏令时 ET+12' : '冬令时 ET+13') + '）'],
        [
          ['美股开盘', '09:30 ET', bj(usOpen) + ' 北京'],
          ['美股收盘', '16:00 ET', bj(usClose) + ' 北京'],
          ['A 股开盘', '09:30 北京', bj(cnOpenET) + ' ET'],
          ['A 股收盘', '15:00 北京', bj(cnCloseET) + ' ET']
        ]
      ).outerHTML;
      e6notesHost.innerHTML =
        '<div class="e6-note"><b>夏令时 vs 冬令时</b><br>美国夏令时通常在 3 月中旬至 11 月初，期间美东比北京慢 12 小时；冬令时慢 13 小时。这里用固定偏移演示，不处理具体年份的切换日、节假日与半日市。</div>' +
        '<div class="e6-note"><b>盘后固定价格交易</b><br>' + cn.sessions[4].note + '本模型不模拟 15:05–15:30 的盘后固定价格交易。</div>' +
        '<div class="e6-note"><b>交易所 vs 券商</b><br>交易所规定交易时段与撮合规则；券商可能提供盘前/盘后路由、夜盘等附加服务，不能把券商能力当成交易所规则。</div>';
      var cnMain = cn.sessions.filter(function (s) { return /连续竞价|收盘集合竞价/.test(s.name); })
        .reduce(function (sum, s) { var r = parseRange(s.time); return sum + (r ? r[1] - r[0] : 0); }, 0);
      mE6.set({
        cn: Math.floor(cnMain / 60) + 'h' + pad2(cnMain % 60) + 'm',
        us: '6h30m',
        diff: edt ? '12 小时' : '13 小时',
        after: '15:05–15:30'
      });
    }

    /* ================= shared band gauge ================= */
    function bandGauge(o) {
      var span = o.prev * 0.35;
      var lo = Math.max(0, o.prev - span), hi = o.prev + span;
      var pos = function (v) { return Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)); };
      var lower = o.lower, upper = o.upper;
      var bl = lower == null ? 0 : pos(lower);
      var bh = upper == null ? 100 : pos(upper);
      var mp = pos(o.price);
      var html = '<div class="e-band"><div class="e-band-track">' +
        '<div class="e-band-zone' + (lower == null ? ' noband' : '') + '" style="left:' + bl + '%;width:' + Math.max(0, bh - bl) + '%"></div>';
      if (lower != null) html += '<span class="e-band-line lower" style="left:' + bl + '%"></span>';
      if (upper != null) html += '<span class="e-band-line upper" style="left:' + bh + '%"></span>';
      html += '<span class="e-band-mid" style="left:' + pos(o.prev) + '%"></span>' +
        '<span class="e-band-mark' + (o.hot ? ' hot' : '') + '" style="left:' + mp + '%"></span>' +
        '</div><div class="e-band-axis"><span>' + ui.fmt.price(lo) + '</span><span>' + ui.fmt.price(hi) + '</span></div></div>';
      return html;
    }

    /* ================= panel ================= */
    var gMode = ui.section(panel, '实验室', 'E1–E6');
    var modeCtl = ui.seg({
      options: [
        { value: 'e1', label: 'E1 总览' }, { value: 'e2', label: 'E2 T+1' }, { value: 'e3', label: 'E3 涨跌幅' },
        { value: 'e4', label: 'E4 LULD' }, { value: 'e5', label: 'E5 熔断' }, { value: 'e6', label: 'E6 时段' }
      ],
      value: 'e1',
      onChange: function (v) { switchMode(v); }
    });
    gMode.appendChild(modeCtl.el);

    var gE1 = ui.section(panel, 'E1 · 制度总览', 'COMPARISON');
    var e1SelCtl = ui.select({
      label: '聚焦维度', options: rules.comparison.map(function (r, i) { return { value: String(i), label: r.dimension }; }),
      value: '0',
      onChange: function (v) { st.sel = +v; renderE1(); }
    });
    gE1.appendChild(e1SelCtl.el);
    var mE1 = ui.metrics([{ key: 'n', label: '对比维度' }, { key: 'asOf', label: '规则快照' }]);
    gE1.appendChild(mE1.el);
    gE1.appendChild(ui.note('点击表格行或上方选择维度；说明栏会显示该维度的边界。'));

    var gE2 = ui.section(panel, 'E2 · T+1 回转 / 交收', 'ACCOUNTS');
    var qtyCtl = ui.slider({
      label: '每次买卖数量', min: 100, max: 400, step: 100, value: 100, unit: '股',
      hint: '初始现金：A 股 ¥100,000、美股 $100,000；示例价 A 股 ¥20、美股 $200。',
      onInput: function (v) { st.qty = v; }
    });
    gE2.appendChild(qtyCtl.el);
    gE2.appendChild(ui.row([
      ui.button('两边买入', buyBoth, 'primary'),
      ui.button('两边尝试当日卖出', sellBoth, 'sm')
    ]));
    gE2.appendChild(ui.row([
      ui.button('进入下一交易日', nextDay, 'sm'),
      ui.button('清空重建账户', function () { resetAccounts(); renderE2(); }, 'sm ghost')
    ]));
    var mE2 = ui.metrics([
      { key: 'cnHold', label: 'A 股持仓' }, { key: 'cnAvail', label: 'A 股可卖' },
      { key: 'cnCash', label: 'A 股现金' }, { key: 'cnPend', label: 'A 股待交收' },
      { key: 'usHold', label: '美股持仓' }, { key: 'usAvail', label: '美股可卖' },
      { key: 'usCash', label: '美股现金' }, { key: 'usPend', label: '美股待交收' }
    ]);
    gE2.appendChild(mE2.el);
    gE2.appendChild(ui.warn('A 股是“T+1 回转限制”，美股是“T+1 交收周期”，两个概念不能混用。账户规则（PDT、保证金）因券商而异，本模型只演示基础流程。'));

    var gE3 = ui.section(panel, 'E3 · 涨跌幅限制', 'PRICE LIMIT');
    var prevCtl = ui.number({
      label: '昨收价（元）', value: 10, min: 1, max: 1000, step: 0.1,
      onChange: function (v) {
        if (v > 0) {
          st.prev = r2(v); st.price3 = r2(v); st.result3 = null;
          price3Ctl.setRange(r2(v * 0.65), r2(v * 1.35)); price3Ctl.set(st.price3, true);
          mE3.set({});
          renderE3();
        }
      }
    });
    gE3.appendChild(prevCtl.el);
    var boardCtl = ui.select({
      label: '板块 / 情形', options: BOARDS, value: 'main',
      onChange: function (v) {
        st.scope = v; st.price3 = st.prev; st.result3 = null;
        price3Ctl.setRange(r2(st.prev * 0.65), r2(st.prev * 1.35)); price3Ctl.set(st.price3, true);
        renderE3();
      }
    });
    gE3.appendChild(boardCtl.el);
    var side3Ctl = ui.seg({
      label: '方向', options: [{ value: 'buy', label: '买入' }, { value: 'sell', label: '卖出' }],
      value: 'buy', onChange: function (v) { st.side = v; renderE3(); }
    });
    gE3.appendChild(side3Ctl.el);
    var price3Ctl = ui.slider({
      label: '申报价', min: 6.5, max: 13.5, step: 0.01, value: 10, unit: '元',
      hint: '把价格拖到涨停/跌停之外，再提交，观察拒绝原因。',
      onInput: function (v) { st.price3 = v; st.result3 = null; renderE3(); }
    });
    gE3.appendChild(price3Ctl.el);
    gE3.appendChild(ui.row([
      ui.button('买方压力 → 涨停', function () { pressureE3('buy'); }, 'sm'),
      ui.button('卖方压力 → 跌停', function () { pressureE3('sell'); }, 'sm')
    ]));
    gE3.appendChild(ui.button('提交申报', submitE3, 'primary'));
    var mE3 = ui.metrics([
      { key: 'up', label: '涨停价' }, { key: 'down', label: '跌停价' },
      { key: 'state', label: '当前状态' }, { key: 'range', label: '可申报区间' }
    ]);
    gE3.appendChild(mE3.el);
    gE3.appendChild(ui.formula('涨停价 = round2(昨收 × (1 + pct))<br>跌停价 = round2(昨收 × (1 − pct))<br>pct 来自 SM.rules.cnLimitPct(scope)'));
    gE3.appendChild(ui.note('本页只校验申报价格，不模拟撮合。'));

    var gE4 = ui.section(panel, 'E4 · 美股 LULD', 'LULD');
    var refCtl = ui.number({
      label: '参考价（美元）', value: 100, min: 0.5, max: 2000, step: 1,
      onChange: function (v) {
        if (v > 0) {
          st.ref = r2(v); st.price4 = st.ref; st.halted = false; st.haltPrice = null; st.e4events = [];
          price4Ctl.setRange(r2(st.ref * 0.7), r2(st.ref * 1.3)); price4Ctl.set(st.price4, true);
          renderE4();
        }
      }
    });
    gE4.appendChild(refCtl.el);
    var tierCtl = ui.seg({
      label: '价格带层级', options: [{ value: '1', label: 'Tier 1' }, { value: '2', label: 'Tier 2' }],
      value: '1',
      onChange: function (v) {
        st.tier = +v; st.price4 = st.ref; st.halted = false; st.haltPrice = null; st.e4events = [];
        renderE4();
      }
    });
    gE4.appendChild(tierCtl.el);
    var price4Ctl = ui.slider({
      label: '成交价', min: 70, max: 130, step: 0.01, value: 100, unit: '美元',
      hint: '拖过价格带边界，触发暂停；再点「复盘并重算价格带」。',
      onInput: price4Changed
    });
    gE4.appendChild(price4Ctl.el);
    gE4.appendChild(ui.row([
      ui.button('越过上轨', function () { var b = luldNow(); price4Ctl.set(r2(b.upper + 0.5), true); price4Changed(r2(b.upper + 0.5)); }, 'sm'),
      ui.button('越过下轨', function () { var b = luldNow(); price4Ctl.set(r2(b.lower - 0.5), true); price4Changed(r2(b.lower - 0.5)); }, 'sm')
    ]));
    gE4.appendChild(ui.button('复盘并重算价格带', reopenE4, 'sm primary'));
    var mE4 = ui.metrics([
      { key: 'state', label: '交易状态' }, { key: 'width', label: '价格带' },
      { key: 'upper', label: '上轨' }, { key: 'lower', label: '下轨' },
      { key: 'count', label: '暂停事件' }
    ]);
    gE4.appendChild(mE4.el);
    gE4.appendChild(ui.warn('LULD 实际是 5 分钟暂停 + 集合竞价复盘；这里用按钮代替计时，并省略个股停牌分层、期货联动等细节。'));

    var gE5 = ui.section(panel, 'E5 · 市场级熔断', 'CIRCUIT BREAKER');
    var spCtl = ui.slider({
      label: '标普 500 当日涨跌', min: -25, max: 3, step: 0.5, value: 0, unit: '%',
      hint: '拖动到 −7% / −13% / −20% 观察 Level 1/2/3。',
      onInput: function (v) { st.spPct = v; renderE5(); }
    });
    gE5.appendChild(spCtl.el);
    gE5.appendChild(ui.row([
      ui.button('−3%', function () { setSp(-3); }, 'sm ghost'),
      ui.button('−7%', function () { setSp(-7); }, 'sm ghost'),
      ui.button('−13%', function () { setSp(-13); }, 'sm ghost'),
      ui.button('−20%', function () { setSp(-20); }, 'sm ghost')
    ]));
    var timeCtl = ui.slider({
      label: '当前时间（美东）', min: 570, max: 960, step: 5, value: 600, unit: '',
      hint: '15:25 之后触发的一级/二级不再停牌，三级仍全天休市。',
      onInput: function (v) { st.timeMin = v; renderE5(); }
    });
    gE5.appendChild(timeCtl.el);
    var mE5 = ui.metrics([
      { key: 'drop', label: '标普 500' }, { key: 'level', label: '等级' },
      { key: 'action', label: '措施' }, { key: 'time', label: '当前 ET' }
    ]);
    gE5.appendChild(mE5.el);
    gE5.appendChild(ui.formula('跌幅 = −当日涨跌幅<br>≥7% → L1，≥13% → L2，≥20% → L3<br>' + CUTOFF_TEXT + ' 截止线来自 SM.rules 规则说明'));
    gE5.appendChild(ui.warn('只演示市场级三层熔断，不覆盖个股 LULD、期货熔断、盘中数据发布与跨市场联动。'));

    var gE6 = ui.section(panel, 'E6 · 交易时间与时区', 'SESSIONS');
    var dstCtl = ui.seg({
      label: '美国时令', options: [{ value: 'edt', label: '夏令时' }, { value: 'est', label: '冬令时' }],
      value: 'edt', onChange: function (v) { st.dst = v; renderE6(); }
    });
    gE6.appendChild(dstCtl.el);
    var mE6 = ui.metrics([
      { key: 'cn', label: 'A 股常规竞价' }, { key: 'us', label: '美股常规时段' },
      { key: 'diff', label: '美东/北京时差' }, { key: 'after', label: 'A 股盘后固定价格' }
    ]);
    gE6.appendChild(mE6.el);
    gE6.appendChild(ui.formula('北京时间 = 美东时间 + 12h（夏令时）/ +13h（冬令时）<br>美股 09:30 ET ↔ 北京 21:30 / 22:30'));
    gE6.appendChild(ui.note('时间来自 SM.rules 的交易时段；节假日、半日市与临时休市未建模。'));

    var gReset = ui.section(panel);
    gReset.appendChild(ui.row([ui.reset(resetCurrent)]));
    gReset.appendChild(ui.warn('模型边界：账户、价格带与熔断都是教学模型；规则可能变化，以交易所、监管机构与券商公告为准，不构成投资建议。'));

    /* ================= behaviour ================= */
    function setSp(v) {
      st.spPct = v;
      if (spCtl) spCtl.set(v, true);
      renderE5();
    }

    function switchMode(m) {
      st.mode = m;
      prepare(m);
      sync();
    }

    function prepare(mode) {
      if (mode === 'e2') resetAccounts();
      if (mode === 'e3') { st.price3 = st.prev; st.result3 = null; }
      if (mode === 'e4') { st.price4 = st.ref; st.halted = false; st.haltPrice = null; st.e4events = []; }
    }

    function resetCurrent() {
      var m = st.mode;
      Object.assign(st, DEFAULT);
      st.mode = m;
      prepare(m);
      sync();
    }

    function sync() {
      ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'].forEach(function (m) {
        wrap[m].style.display = m === st.mode ? 'flex' : 'none';
      });
      [gE1, gE2, gE3, gE4, gE5, gE6].forEach(function (g, i) {
        g.style.display = st.mode === ('e' + (i + 1)) ? '' : 'none';
      });
      modeCtl.set(st.mode);
      if (e1SelCtl) e1SelCtl.set(String(st.sel));
      qtyCtl.set(st.qty, true);
      prevCtl.input.value = st.prev;
      boardCtl.set(st.scope);
      side3Ctl.set(st.side);
      var lim = cnLimitOf(st);
      price3Ctl.setRange(r2(st.prev * 0.65), r2(st.prev * 1.35));
      price3Ctl.set(st.price3, true);
      refCtl.input.value = st.ref;
      tierCtl.set(String(st.tier));
      price4Ctl.setRange(r2(st.ref * 0.7), r2(st.ref * 1.3));
      price4Ctl.set(st.price4, true);
      spCtl.set(st.spPct, true);
      timeCtl.set(st.timeMin, true);
      dstCtl.set(st.dst);
      if (st.mode === 'e1') { renderE1(); mE1.set({ n: String(rules.comparison.length), asOf: rules.asOf }); }
      else if (st.mode === 'e2') renderE2();
      else if (st.mode === 'e3') renderE3();
      else if (st.mode === 'e4') renderE4();
      else if (st.mode === 'e5') renderE5();
      else renderE6();
    }

    function apply(patch) {
      patch = patch || {};
      Object.assign(st, patch);
      prepare(st.mode);
      if (st.mode === 'e6') {
        // renderE6 is called by sync
      }
      sync();
    }

    sync();

    return {
      apply: apply,
      destroy: function () {}
    };
  }

  /* Module-scoped styles, injected once. */
  function injectStyle() {
    if (document.getElementById('sml-e-styles')) return;
    var s = document.createElement('style');
    s.id = 'sml-e-styles';
    s.textContent = [
      '.e-stage{display:flex;flex-direction:column;flex:1;min-height:0;gap:8px}',
      '.e-card{border:1px solid var(--line);border-radius:10px;background:var(--panel-2);display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden}',
      '.e-card-head{flex:none;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--line-soft);font-family:var(--mono);font-size:9px;letter-spacing:.13em;color:var(--dim)}',
      '.e-card-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:7px;padding:9px 11px;overflow:auto}',
      '.e-pill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-family:var(--mono);font-size:9px;letter-spacing:.05em;border:1px solid var(--line);color:var(--muted);white-space:nowrap}',
      '.e-pill.ok{color:var(--green);border-color:color-mix(in srgb,var(--green) 45%,transparent);background:color-mix(in srgb,var(--green) 10%,transparent)}',
      '.e-pill.warn{color:var(--yellow);border-color:color-mix(in srgb,var(--yellow) 45%,transparent);background:color-mix(in srgb,var(--yellow) 10%,transparent)}',
      '.e-pill.bad{color:var(--red);border-color:color-mix(in srgb,var(--red) 45%,transparent);background:color-mix(in srgb,var(--red) 10%,transparent)}',
      '.e-empty{font-size:10.5px;color:var(--dim);line-height:1.6;padding:6px 2px}',
      '.e-empty.small{padding:3px 0}',
      '.e-tip{border:1px solid var(--line-soft);border-left:2px solid var(--cyan);border-radius:0 7px 7px 0;background:var(--panel-3);padding:6px 9px;font-size:10px;line-height:1.6;color:var(--muted)}',
      '.e-tip.up{border-left-color:var(--red)}.e-tip.down{border-left-color:var(--green)}',
      '.e-tip b{color:var(--text)}',
      '.e-note{font-size:9.5px;line-height:1.55;color:var(--dim)}',
      '.e-note b{color:var(--muted)}',
      '.e-formula{font-family:var(--mono);font-size:9px;line-height:1.6;color:var(--dim);background:var(--panel-3);border-radius:6px;padding:6px 8px}',
      '.e-foot{flex:none;padding:0 10px 9px}',
      '.e-foot .btn{width:100%}',
      '.e-bigline{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
      '.e-bigline b{font-family:var(--mono);font-size:26px;font-weight:560;letter-spacing:-.02em}',
      '.e-chg{font-family:var(--mono);font-size:12px;color:var(--dim)}',
      '.e-chg.up{color:var(--red)}.e-chg.down{color:var(--green)}',
      '.e-state{font-family:var(--mono);font-size:9px;padding:2px 7px;border-radius:4px;border:1px solid var(--line);color:var(--muted)}',
      '.e-state.up{color:var(--red);border-color:color-mix(in srgb,var(--red) 45%,transparent)}',
      '.e-state.down{color:var(--green);border-color:color-mix(in srgb,var(--green) 45%,transparent)}',
      '.e-state.warn{color:var(--yellow);border-color:color-mix(in srgb,var(--yellow) 45%,transparent)}',
      '.e-board{margin-left:auto;font-family:var(--mono);font-size:9px;color:var(--dim)}',
      '.e-band-track{position:relative;height:64px;border-radius:8px;background:var(--panel-3);overflow:hidden;margin:14px 0 4px}',
      '.e-band-zone{position:absolute;top:9px;bottom:9px;background:color-mix(in srgb,var(--cyan) 12%,transparent);border-left:1px dashed color-mix(in srgb,var(--cyan) 55%,transparent);border-right:1px dashed color-mix(in srgb,var(--cyan) 55%,transparent)}',
      '.e-band-zone.noband{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--yellow) 9%,transparent) 0 6px,transparent 6px 12px);border:none}',
      '.e-band-line{position:absolute;top:0;bottom:0;width:1px;background:color-mix(in srgb,var(--cyan) 55%,transparent)}',
      '.e-band-mid{position:absolute;top:6px;bottom:6px;width:1px;background:var(--line);border-left:1px dashed var(--muted)}',
      '.e-band-mark{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--yellow);box-shadow:0 0 0 1px color-mix(in srgb,var(--yellow) 30%,transparent)}',
      '.e-band-mark.hot{background:var(--red);box-shadow:0 0 0 1px color-mix(in srgb,var(--red) 35%,transparent)}',
      '.e-band-axis{display:flex;justify-content:space-between;font-family:var(--mono);font-size:8.5px;color:var(--dim)}',
      '.e-band-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}',
      '.e-band-stats div{border:1px solid var(--line-soft);border-radius:7px;padding:5px 8px;background:var(--panel-3)}',
      '.e-band-stats span{display:block;font-size:8.5px;color:var(--dim);font-family:var(--mono)}',
      '.e-band-stats b{display:block;font-family:var(--mono);font-size:12px;font-weight:550}',
      '.e-check{display:flex;flex-direction:column;gap:7px;font-size:10.5px}',
      '.e-check-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-family:var(--mono);font-size:10px;color:var(--muted)}',
      '.e-side{font-weight:600;padding:1px 6px;border-radius:4px;border:1px solid var(--line)}',
      '.e-side.up{color:var(--red);border-color:color-mix(in srgb,var(--red) 45%,transparent)}',
      '.e-side.down{color:var(--green);border-color:color-mix(in srgb,var(--green) 45%,transparent)}',
      '.e-check-status{font-family:var(--mono);font-size:16px;letter-spacing:.04em;padding:6px 9px;border-radius:7px;border:1px solid var(--line);background:var(--panel-3)}',
      '.e-check-status.ok{color:var(--green);border-color:color-mix(in srgb,var(--green) 40%,transparent)}',
      '.e-check-status.bad{color:var(--red);border-color:color-mix(in srgb,var(--red) 40%,transparent)}',
      '.e-check-status.dim{color:var(--dim)}',
      '.e-check-msg{font-size:10px;line-height:1.6;color:var(--muted)}',
      '.e-range{display:flex;justify-content:space-between;gap:8px;border-top:1px dashed var(--line-soft);padding-top:5px;font-size:10px;color:var(--dim)}',
      '.e-range b{font-family:var(--mono);color:var(--text);font-weight:550}',
      '.e4-events{border-top:1px dashed var(--line-soft);padding-top:5px;display:flex;flex-direction:column;gap:4px}',
      '.e4-events-h{font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;color:var(--dim)}',
      '.e4-event{font-family:var(--mono);font-size:9px;color:var(--muted);line-height:1.45;border-left:2px solid var(--line);padding-left:7px}',
      '.e1-grid{display:grid;grid-template-columns:1.55fr 1fr;gap:8px;flex:1;min-height:0}',
      '.e1-table{flex:1;min-height:0;overflow:auto}',
      '.e1-quick{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:7px 10px;border-top:1px solid var(--line)}',
      '.e1-quick>div{border:1px solid var(--line-soft);border-radius:6px;padding:5px 7px;background:var(--panel-3)}',
      '.e1-quick span{font-family:var(--mono);font-size:8px;letter-spacing:.08em;color:var(--dim)}',
      '.e1-quick p{margin:2px 0 0;font-size:8.5px;line-height:1.5;color:var(--muted)}',
      '.e1-keybox{flex:none;border-top:1px solid var(--line);padding:7px 10px 8px;display:flex;flex-direction:column;gap:3px;background:var(--panel-2)}',
      '.e1-keybox-h{font-family:var(--mono);font-size:8px;letter-spacing:.1em;color:var(--dim);margin-bottom:2px}',
      '.e1-key{display:grid;grid-template-columns:38px 1.1fr 1.5fr;gap:6px;align-items:baseline;font-size:9px;line-height:1.4}',
      '.e1-key span{font-family:var(--mono);font-size:8px;color:var(--dim)}',
      '.e1-key b{font-weight:550;color:var(--muted)}',
      '.e1-key i{font-style:normal;color:var(--dim);font-size:8.5px}',
      '.e1-myths{border-top:1px dashed var(--line-soft);padding-top:7px;display:flex;flex-direction:column;gap:3px}',
      '.e1-myths-h{font-family:var(--mono);font-size:8px;letter-spacing:.1em;color:var(--dim)}',
      '.e1-myths p{margin:0;font-size:9px;line-height:1.5;color:var(--dim)}',
      '.e1-row{display:grid;grid-template-columns:92px 1fr 1fr;gap:9px;padding:6px 10px;border-bottom:1px solid var(--line-soft);font-size:10px;line-height:1.45;cursor:pointer}',
      '.e1-row:hover{background:var(--panel-3)}',
      '.e1-row.sel{background:color-mix(in srgb,var(--cyan) 8%,transparent);box-shadow:inset 2px 0 0 var(--cyan)}',
      '.e1-row.head{position:sticky;top:0;z-index:1;background:var(--panel-3);font-family:var(--mono);font-size:8.5px;letter-spacing:.08em;color:var(--dim);cursor:default}',
      '.e1-row .dim{color:var(--muted);font-weight:550}',
      '.e1-row .cn{color:var(--muted)}',
      '.e1-row .us{color:var(--muted)}',
      '.e1-side{display:flex;flex-direction:column;gap:8px;min-height:0}',
      '.e1-asof{border:1px solid var(--line);border-radius:9px;background:var(--panel-2);padding:8px 10px;display:flex;flex-direction:column;gap:2px}',
      '.e1-asof-k{font-family:var(--mono);font-size:8px;letter-spacing:.12em;color:var(--dim)}',
      '.e1-asof b{font-family:var(--mono);font-size:12px;font-weight:550}',
      '.e1-asof i{font-style:normal;font-size:9.5px;color:var(--orange)}',
      '.e1-note-body{padding:10px;display:flex;flex-direction:column;gap:9px}',
      '.e1-note-top{display:flex;align-items:baseline;gap:8px}',
      '.e1-dim-no{font-family:var(--mono);font-size:8.5px;color:var(--dim)}',
      '.e1-note-top h3{margin:0;font-size:13px;font-weight:600}',
      '.e1-pair{display:flex;flex-direction:column;gap:6px}',
      '.e1-pair>div{border:1px solid var(--line-soft);border-radius:7px;padding:6px 8px;background:var(--panel-3)}',
      '.e1-tag{font-family:var(--mono);font-size:8px;letter-spacing:.06em;color:var(--dim)}',
      '.e1-pair p{margin:2px 0 0;font-size:10px;line-height:1.5;color:var(--muted)}',
      '.e1-note-box{border-top:1px dashed var(--line);padding-top:8px}',
      '.e1-note-box span{font-family:var(--mono);font-size:8px;letter-spacing:.1em;color:var(--dim)}',
      '.e1-note-box p{margin:4px 0 0;font-size:10px;line-height:1.6;color:var(--text)}',
      '.e1-click-hint{font-size:9px;color:var(--dim);border-top:1px dashed var(--line-soft);padding-top:7px;margin-top:auto}',
      '.e1-warn{font-size:9px;line-height:1.55;color:var(--orange);background:color-mix(in srgb,var(--orange) 8%,transparent);border-radius:7px;padding:6px 8px}',
      '.e2-banner{flex:none;border:1px solid var(--line);border-radius:9px;background:var(--panel-2);padding:7px 10px;font-size:9.5px;line-height:1.5;color:var(--dim)}',
      '.e2-banner b{color:var(--text);font-weight:600}',
      '.e2-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:none}',
      '.e2-acct{padding:9px 11px;display:flex;flex-direction:column;gap:7px}',
      '.e2-top{display:flex;justify-content:space-between;align-items:center;gap:8px}',
      '.e2-name{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600}',
      '.e2-sub{font-family:var(--mono);font-size:8px;font-weight:400;color:var(--dim);letter-spacing:.05em;margin-left:2px}',
      '.e2-dot{width:7px;height:7px;border-radius:50%;display:inline-block}',
      '.e2-dot.cn{background:var(--red)}.e2-dot.us{background:var(--blue)}',
      '.e2-big{display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px dashed var(--line-soft);border-bottom:1px dashed var(--line-soft);padding:7px 0}',
      '.e2-big div{display:flex;align-items:baseline;gap:5px;flex-wrap:wrap}',
      '.e2-big span{font-size:9px;color:var(--dim);font-family:var(--mono);width:100%}',
      '.e2-big b{font-family:var(--mono);font-size:25px;font-weight:560;line-height:1}',
      '.e2-big b.ok{color:var(--green)}', '.e2-big b.warn{color:var(--orange)}',
      '.e2-big em{font-style:normal;font-size:9px;color:var(--dim)}',
      '.e2-rows{display:flex;flex-direction:column;gap:3px}',
      '.e2-rows div{display:flex;justify-content:space-between;gap:10px;font-size:9.5px;color:var(--dim);border-bottom:1px dashed var(--line-soft);padding-bottom:3px}',
      '.e2-rows b{font-family:var(--mono);color:var(--text);font-weight:500;text-align:right}',
      '.e2-msg{font-size:9.5px;line-height:1.55;padding:5px 7px;border-radius:6px;background:var(--panel-3);color:var(--muted)}',
      '.e2-msg.ok{color:var(--green);background:color-mix(in srgb,var(--green) 8%,transparent)}',
      '.e2-msg.warn{color:var(--yellow);background:color-mix(in srgb,var(--yellow) 8%,transparent)}',
      '.e2-msg.bad{color:var(--red);background:color-mix(in srgb,var(--red) 8%,transparent)}',
      '.e2-fine{font-size:8.5px;line-height:1.45;color:var(--dim)}',
      '.e2-log{flex:1;min-height:0;overflow:auto;padding:7px 10px}',
      '.e2-log .ptable{font-size:9.5px}',
      '.e2-log .ptable td,.e2-log .ptable th{padding:3px 5px}',
      '.e2-lres{font-size:9px}',
      '.e2-lres.ok{color:var(--green)}.e2-lres.warn{color:var(--yellow)}.e2-lres.bad{color:var(--red)}',
      '.e3-grid,.e4-grid{display:grid;grid-template-columns:1.2fr .9fr;gap:8px;flex:1;min-height:0}',
      '.e3-grid .e-band-track,.e4-grid .e-band-track{height:92px}',
      '.e-ref{margin-top:8px;border-top:1px dashed var(--line-soft);padding-top:7px}',
      '.e-ref-h{font-family:var(--mono);font-size:8px;letter-spacing:.1em;color:var(--dim);margin-bottom:5px}',
      '.e-ref-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}',
      '.e-ref-cell{display:flex;justify-content:space-between;gap:6px;align-items:baseline;border:1px solid var(--line-soft);border-radius:5px;padding:4px 6px;font-size:9px;color:var(--dim)}',
      '.e-ref-cell b{font-family:var(--mono);font-size:9.5px;font-weight:550;color:var(--muted)}',
      '.e-ref-cell.on{border-color:color-mix(in srgb,var(--cyan) 45%,transparent);background:color-mix(in srgb,var(--cyan) 7%,transparent)}',
      '.e-ref-cell.on b{color:var(--cyan)}',
      '.e-ref-note{margin:5px 0 0;font-size:8.5px;line-height:1.5;color:var(--dim)}',
      '.e-steps{margin:0;padding-left:14px;display:flex;flex-direction:column;gap:3px;font-size:9px;line-height:1.45;color:var(--dim)}',
      '.e5-top{display:grid;grid-template-columns:1.15fr .95fr;gap:8px;flex:none}',
      '.e5-level{padding:9px 11px;display:flex;flex-direction:column;gap:5px}',
      '.e5-kicker{font-family:var(--mono);font-size:8px;letter-spacing:.13em;color:var(--dim)}',
      '.e5-big{font-family:var(--mono);font-size:14px;letter-spacing:.1em;color:var(--dim)}',
      '.e5-big b{font-size:42px;font-weight:560;letter-spacing:-.03em;color:var(--text);vertical-align:middle}',
      '.e5-big.lv1 b{color:var(--yellow)}', '.e5-big.lv2 b{color:var(--orange)}', '.e5-big.lv3 b{color:var(--red)}',
      '.e5-drop{font-family:var(--mono);font-size:11px;color:var(--dim)}',
      '.e5-drop b{font-size:18px;color:var(--text);font-weight:560}',
      '.e5-sub{font-size:9.5px;color:var(--dim)}',
      '.e5-action{padding:9px 11px;display:flex;flex-direction:column;gap:5px}',
      '.e5-row{display:flex;justify-content:space-between;gap:8px;font-size:9.5px;border-bottom:1px dashed var(--line-soft);padding-bottom:4px}',
      '.e5-row span{color:var(--dim)}',
      '.e5-row b{font-family:var(--mono);font-weight:550;text-align:right}',
      '.e5-row b.warn{color:var(--orange)}',
      '.e5-timeline{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-start;gap:6px;padding:6px 10px 8px}',
      '.e5-timeline .e5-footnote{margin-top:auto}',
      '.e5-compare{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}',
      '.e5-compare .cmp{border:1px solid var(--line-soft);border-radius:7px;background:var(--panel-3);padding:6px 8px;display:flex;flex-direction:column;gap:2px}',
      '.e5-compare .cmp span{font-size:8.5px;color:var(--dim)}',
      '.e5-compare .cmp b{font-family:var(--mono);font-size:10px;font-weight:550;color:var(--muted)}',
      '.e5-compare .cmp.ok b{color:var(--cyan)}',
      '.e5-compare .cmp.warn b{color:var(--yellow)}',
      '.e5-compare .cmp.bad b{color:var(--red)}',
      '.e5-footnote{font-size:8.5px;line-height:1.5;color:var(--dim);border-top:1px dashed var(--line-soft);padding-top:5px}',
      '.e5-track{position:relative;height:34px;border-radius:6px;background:var(--panel-3);overflow:visible;margin:8px 0 22px}',
      '.e5-progress{position:absolute;left:0;top:0;bottom:0;background:color-mix(in srgb,var(--cyan) 10%,transparent);border-radius:6px 0 0 6px}',
      '.e5-halt{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--orange) 28%,transparent) 0 5px,transparent 5px 10px);border-left:1px solid var(--orange);border-right:1px solid var(--orange)}',
      '.e5-halt i{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-style:normal;font-family:var(--mono);font-size:8px;color:var(--orange);white-space:nowrap}',
      '.e5-closed{position:absolute;top:0;bottom:0;background:color-mix(in srgb,var(--red) 13%,transparent);border-right:1px solid var(--red)}',
      '.e5-marker{position:absolute;top:-7px;bottom:-7px;width:2px;background:var(--yellow);z-index:2}',
      '.e5-tick{position:absolute;top:100%;width:1px;height:5px;background:var(--line)}',
      '.e5-tick i{position:absolute;top:6px;left:50%;transform:translateX(-50%);font-style:normal;font-family:var(--mono);font-size:8px;color:var(--dim);white-space:nowrap}',
      '.e5-tick.first i{left:0;transform:none}', '.e5-tick.last i{left:auto;right:0;transform:none}',
      '.e5-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:8.5px;color:var(--dim);font-family:var(--mono)}',
      '.e5-legend .lg{display:inline-flex;align-items:center;gap:4px}',
      '.e5-legend em{width:10px;height:8px;border-radius:2px;background:color-mix(in srgb,var(--cyan) 25%,transparent)}',
      '.e5-legend .halt em{background:color-mix(in srgb,var(--orange) 35%,transparent)}',
      '.e5-legend .closed em{background:color-mix(in srgb,var(--red) 30%,transparent)}',
      '.e5-legend .cutoff em{width:1px;height:10px;background:var(--yellow)}',
      '.e5-thresholds{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;flex:none}',
      '.e5-th{border:1px solid var(--line);border-radius:9px;background:var(--panel-2);padding:8px 10px;display:flex;flex-direction:column;gap:2px}',
      '.e5-th-pct{font-family:var(--mono);font-size:11px;color:var(--dim)}',
      '.e5-th b{font-family:var(--mono);font-size:11px;font-weight:550;color:var(--dim)}',
      '.e5-th small{font-size:8.5px;color:var(--dim);line-height:1.4}',
      '.e5-th.active{border-color:color-mix(in srgb,var(--orange) 45%,transparent);background:color-mix(in srgb,var(--orange) 6%,transparent)}',
      '.e5-th.active .e5-th-pct,.e5-th.active b{color:var(--text)}',
      '.e5-th.active.lv3{border-color:color-mix(in srgb,var(--red) 55%,transparent);background:color-mix(in srgb,var(--red) 8%,transparent)}',
      '.e6-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:none}',
      '.e6-tl{padding:8px 10px 4px}',
      '.e6-axis{position:relative;height:54px;margin:4px 0 2px;border-bottom:1px solid var(--line)}',
      '.e6-axis-line{position:absolute;left:0;right:0;top:18px;height:1px;background:var(--line-soft)}',
      '.e6-block{position:absolute;top:10px;height:16px;border-radius:2px;background:color-mix(in srgb,var(--cyan) 45%,transparent)}',
      '.e6-block.us{background:color-mix(in srgb,var(--blue) 45%,transparent)}',
      '.e6-block.auction{top:7px;height:22px;background:color-mix(in srgb,var(--orange) 55%,transparent)}',
      '.e6-block.after{top:14px;height:8px;background:color-mix(in srgb,var(--violet) 55%,transparent);opacity:.8}',
      '.e6-xtick{position:absolute;top:20px;width:1px;height:6px;background:var(--line)}',
      '.e6-xtick i{position:absolute;top:8px;left:50%;transform:translateX(-50%);font-style:normal;font-family:var(--mono);font-size:7.5px;color:var(--dim);white-space:nowrap}',
      '.e6-xtick.first i{left:0;transform:none}', '.e6-xtick.last i{left:auto;right:0;transform:none}',
      '.e6-list{display:flex;flex-direction:column;gap:3px;padding:4px 0 2px}',
      '.e6-li{display:grid;grid-template-columns:8px 1.15fr .9fr 1.35fr;gap:6px;align-items:baseline;font-size:9px;line-height:1.45;border-bottom:1px dashed var(--line-soft);padding:3px 0}',
      '.e6-dot{width:6px;height:6px;border-radius:50%;background:var(--cyan);margin-top:3px}',
      '.e6-dot.auction{background:var(--orange)}', '.e6-dot.after{background:var(--violet)}',
      '.e6-li-name{color:var(--muted)}',
      '.e6-li-time{font-family:var(--mono);color:var(--text);font-size:8.5px}',
      '.e6-li-note{color:var(--dim);font-size:8.5px}',
      '.e6-bottom{display:grid;grid-template-columns:1.25fr .9fr;gap:8px;flex:1;min-height:0}',
      '.e6-conv{padding:4px 10px 8px;overflow:auto}',
      '.e6-conv .ptable{font-size:9.5px}',
      '.e6-conv .ptable td,.e6-conv .ptable th{padding:3px 5px}',
      '.e6-notes{padding:8px 10px;display:flex;flex-direction:column;gap:7px;overflow:auto}',
      '.e6-note{font-size:9px;line-height:1.55;color:var(--dim)}',
      '.e6-note b{color:var(--muted)}',
      '@media (max-width:1180px){.e1-grid{grid-template-columns:1.35fr 1fr}.e3-grid,.e4-grid{grid-template-columns:1.05fr .95fr}}',
      '@media (max-width:900px){.e1-grid,.e3-grid,.e4-grid,.e5-top,.e6-grid,.e6-bottom{grid-template-columns:1fr}.e1-side{min-height:300px}.e5-thresholds{grid-template-columns:1fr}.e2-grid{grid-template-columns:1fr}.e-band-track{height:52px}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  SM.registerModule({
    id: 'E', slug: 'market-rules', order: 5,
    title: 'A 股与美股', en: 'MARKET RULES',
    subtitle: '回转与交收、价格带、熔断与交易时段',
    hint: '左右对照两个市场的制度：先看总览，再分别操作 T+1 账户、涨跌幅、LULD 与熔断。',
    scenes: [
      {
        title: '两套制度，十个维度',
        body: '把 A 股和美股放在同一张表里对照：交易所、货币、红绿习惯、当日买卖、结算、涨跌幅、最小单位、卖空、交易时间与波动控制。<br>最容易被混淆的是<b>当日买卖</b>与<b>结算周期</b>——A 股是 T+1 回转限制，美股是 T+1 交收周期。',
        patch: { mode: 'e1', sel: 0 },
        guide: '点击任意一行，右侧会显示这一维度的边界与常见误解。',
        duration: 13000
      },
      {
        title: 'T+1 回转 vs T+1 交收',
        body: 'A 股账户今天买入 100 股，今天尝试卖出会被拒绝：<b>可卖数量 0，下一交易日 100</b>；进入下一交易日才可卖。<br>美股账户今天买入即可卖出（受账户规则约束），但卖出价款要到 <b>T+1</b> 才交收。回转是“能不能卖”，交收是“钱/券何时到账”。',
        patch: { mode: 'e2', qty: 100 },
        guide: '依次点「两边买入」→「两边尝试当日卖出」→「进入下一交易日」，看两边的可卖与待交收。',
        duration: 15000
      },
      {
        title: '涨跌幅限制：价格带',
        body: 'A 股主板 ±10%，创业板/科创板 ±20%，北交所 ±30%，新股前 5 日不设限。涨停价与跌停价由<b>昨收</b>和板块幅度决定，超出区间的申报会被拒绝。<br>涨停/跌停不是“不能交易”，只是申报价格被限制在价格带内。',
        patch: { mode: 'e3', prev: 10, scope: 'main', side: 'buy', price3: 10, pressure: 'none', result3: null },
        guide: '点「买方压力 → 涨停」，再手动把价格拖到 11 元以上提交，观察拒绝信息与可申报区间。',
        duration: 15000
      },
      {
        title: '美股 LULD：个股价格带',
        body: '美股没有统一的日涨跌幅，但有个股 <b>LULD</b> 价格带：Tier 1 的 5% / 10%，Tier 2 的 20%。价格越过带子会触发短暂停牌，复盘后按新参考价重算。<br>LULD 是个股机制，不是 E5 的标普 500 市场级熔断。',
        patch: { mode: 'e4', ref: 100, tier: 1, price4: 100, halted: false, haltPrice: null, e4events: [] },
        guide: '把成交价拖过 ±5% 边界，再点「复盘并重算价格带」；也试试 Tier 2 的 20%。',
        duration: 15000
      },
      {
        title: '市场级熔断：7 / 13 / 20%',
        body: '标普 500 较前收下跌 7% 触发 Level 1，13% 触发 Level 2，20% 触发 Level 3。前两级在 <b>15:25 前</b>停牌 15 分钟，之后触发不再停牌；Level 3 当天剩余时间停止交易。<br>拖动时间滑杆，看同一下跌幅度在 15:25 前后的不同处置。',
        patch: { mode: 'e5', spPct: 0, timeMin: 600 },
        guide: '点 −7% / −13% / −20%，再把时间拖到 15:30 比较。',
        duration: 15000
      },
      {
        title: '交易时间与时区',
        body: 'A 股：09:15–09:25 开盘集合竞价，09:30–11:30 与 13:00–15:00 连续竞价，14:57–15:00 收盘集合竞价。美股常规时段 09:30–16:00 ET，另有盘前/盘后。<br>美东与北京相差 12 小时（夏令时）或 13 小时（冬令时）；A 股还有 15:05–15:30 的盘后固定价格交易，本模型不模拟。',
        patch: { mode: 'e6', dst: 'edt' },
        guide: '切换夏令时/冬令时，看同一事件在两地时钟上的位置。',
        duration: 15000
      }
    ],
    quiz: [
      {
        q: 'A 股账户今天买入 100 股，今天可以卖出吗？',
        options: ['可以，只要价格合适', '不可以，T+1 回转：下一交易日起才能卖', '只能卖出 50 股', '取决于券商佣金'],
        answer: 1,
        explain: 'A 股股票实行 <b>T+1 回转</b>：当日买入的股票当日不可卖出，可卖数量为 0，下一交易日起才可卖。'
      },
      {
        q: '美股实行 T+1 交收，是否意味着当天买入的股票当天不能卖？',
        options: ['是，和 A 股一样', '不是；交收周期与当日回转是两件事', '只有机构能当天卖', '只有在盘前不能卖'],
        answer: 1,
        explain: 'T+1 交收指钱/券在成交后一个工作日完成交收；常规美股账户通常允许当日回转交易（仍受账户类型、保证金与 PDT 约束）。'
      },
      {
        q: '某主板股票昨收 10.00 元，涨跌幅 10%。它的涨停价与跌停价是？',
        options: ['10.10 / 9.90', '11.00 / 9.00', '12.00 / 8.00', '没有涨跌幅限制'],
        answer: 1,
        explain: '涨停价 = 10.00 × 1.10 = <b>11.00</b>，跌停价 = 10.00 × 0.90 = <b>9.00</b>。超出这个区间的申报会被拒绝。'
      }
    ],
    mount: mount
  });
})();
