/* Module D — the order book: spread, queue, matching, market orders and costs.
 * All matching goes through SM.sim.orderBook. The depth and the rules are a
 * teaching model, not an exchange feed. */
(function () {
  'use strict';
  var SM = window.SM;
  var ui = SM.ui, core = SM.core, charts = SM.charts, sim = SM.sim, rules = SM.rules;

  var TICK = 0.01, BASE_MID = 100;
  var CN_NAME = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  var DEFAULT = {
    mode: 'd1',
    mid: 100, seed: 20261031,
    side: 'buy', type: 'limit', price: 100, qty: 500, useLimits: true,
    crossQty: 350,
    sweepQty: 9000,
    pressure: 'base',
    cnPrice: 20, cnQty: 1000, cnComm: 0.025, cnMin: 5, cnStamp: 0.05, cnTransfer: 0.001,
    usPrice: 200, usQty: 100, usComm: 0, usMin: 0, usSec: 0.00278, usTaf: 0.000166, usTafMax: 8.3
  };

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function clock(i) {
    var sec = 9 * 3600 + 30 * 60 + Math.round((i || 0) * 4);
    sec = sec % 86400;
    return pad2(Math.floor(sec / 3600)) + ':' + pad2(Math.floor((sec % 3600) / 60)) + ':' + pad2(sec % 60);
  }
  function r2(v) { return Math.round(v * 100) / 100; }
  function statusInfo(res) {
    if (!res || res.ok === false || res.status === 'rejected') {
      return { key: 'rejected', label: '已拒绝', cls: 'rej' };
    }
    if (res.status === 'filled') return { key: 'filled', label: '全部成交', cls: 'ok' };
    if (res.status === 'resting') return { key: 'resting', label: '挂单中', cls: 'rest' };
    return { key: 'partial', label: '部分成交', cls: 'part' };
  }
  function fillAvg(fills) {
    var q = 0, v = 0;
    (fills || []).forEach(function (f) { q += f.qty; v += f.qty * f.price; });
    return q ? v / q : null;
  }

  function mount(ctx) {
    var p = charts.palette();
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage, panel = ctx.panel;
    var book = sim.orderBook({ mid: BASE_MID, tick: TICK, depth: 5, seed: st.seed });

    // A fresh instance re-seeds the RNG from st.seed. book.reset() keeps drawing
    // from the same generator, so repeated "reset" would silently change the
    // example depth. Pressure/sweep comparisons need identical starting books.
    function freshBook() {
      book = sim.orderBook({ mid: BASE_MID, tick: TICK, depth: 5, seed: st.seed });
      return book;
    }
    var tradeLog = [], queue = [], chartsByMode = {};

    injectStyle();

    /* ================= stage scaffolding ================= */
    var wrap = {};
    ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].forEach(function (m) {
      var w = ui.el('div', 'd-stage');
      w.style.cssText = 'display:none;flex:1;min-height:0;flex-direction:column';
      stage.appendChild(w);
      wrap[m] = w;
    });

    function card(title, right) {
      var c = ui.el('div', 'd-card');
      var h = ui.el('div', 'd-card-head');
      h.innerHTML = '<span>' + title + '</span><span>' + (right || '') + '</span>';
      var body = ui.el('div', 'd-card-body');
      c.appendChild(h); c.appendChild(body);
      return { el: c, body: body, head: h };
    }
    function kpi(label, value, cls) {
      var d = ui.el('div', 'd-kpi' + (cls ? ' ' + cls : ''));
      d.innerHTML = '<span>' + label + '</span><b>' + value + '</b>';
      return d;
    }
    function kpiRow(items) {
      var row = ui.el('div', 'd-kpis');
      items.forEach(function (it) { row.appendChild(kpi(it[0], it[1], it[2])); });
      return row;
    }
    function setKpis(host, items) {
      host.innerHTML = '';
      items.forEach(function (it) { host.appendChild(kpi(it[0], it[1], it[2])); });
    }

    /* ================= shared ladder ================= */
    function ladderHTML(snap, opt) {
      opt = opt || {};
      var maxQ = 1;
      snap.asks.concat(snap.bids).forEach(function (lv) { maxQ = Math.max(maxQ, lv.qty); });
      var html = '<div class="d-lad-head"><span>档位</span><span>价格</span><span>数量</span><span>深度</span></div>';
      var i, lv, rank, hot, hit, fq;
      for (i = snap.asks.length - 1; i >= 0; i--) {
        lv = snap.asks[i]; rank = i + 1;
        hot = opt.hot && opt.hot.side === 'sell' && Math.abs(opt.hot.price - lv.price) < TICK / 2;
        hit = opt.hitPrice != null && Math.abs(opt.hitPrice - lv.price) < TICK / 2;
        fq = opt.fillByPrice ? (opt.fillByPrice[r2(lv.price)] || 0) : 0;
        html += '<div class="d-lad-row ask' + (hot ? ' hot' : '') + (hit || fq ? ' hit' : '') + '">' +
          '<span class="n">卖' + (CN_NAME[rank] || rank) + '</span>' +
          '<span class="p">' + ui.fmt.price(lv.price) + '</span>' +
          '<span class="q">' + ui.fmt.int(lv.qty) + (fq ? '<em class="d-filled">−' + ui.fmt.int(fq) + '</em>' : '') + '</span>' +
          '<span class="d-lad-bar"><em style="width:' + Math.max(2, lv.qty / maxQ * 100) + '%"></em></span>' +
          '</div>';
      }
      if (!opt.askOnly) {
        html += '<div class="d-spread-row"><span>买一 ' + (snap.bids[0] ? ui.fmt.price(snap.bids[0].price) : '—') +
          '</span><b>价差 ' + (snap.spread == null ? '—' : ui.fmt.price(snap.spread)) + '</b><span>卖一 ' +
          (snap.asks[0] ? ui.fmt.price(snap.asks[0].price) : '—') + '</span></div>';
        snap.bids.forEach(function (lv2, j) {
          rank = j + 1;
          hot = opt.hot && opt.hot.side === 'buy' && Math.abs(opt.hot.price - lv2.price) < TICK / 2;
          hit = opt.hitPrice != null && Math.abs(opt.hitPrice - lv2.price) < TICK / 2;
          html += '<div class="d-lad-row bid' + (hot ? ' hot' : '') + (hit ? ' hit' : '') + '">' +
            '<span class="n">买' + (CN_NAME[rank] || rank) + '</span>' +
            '<span class="p">' + ui.fmt.price(lv2.price) + '</span>' +
            '<span class="q">' + ui.fmt.int(lv2.qty) + '</span>' +
            '<span class="d-lad-bar"><em style="width:' + Math.max(2, lv2.qty / maxQ * 100) + '%"></em></span>' +
            '</div>';
        });
      }
      html += '<div class="d-last-row"><span>最新成交</span><b>' + ui.fmt.price(snap.last) +
        '</b><span>中间价 ' + ui.fmt.price(snap.mid) + '</span></div>';
      return html;
    }

    function fillMap(fills) {
      var m = {};
      (fills || []).forEach(function (f) { m[r2(f.price)] = (m[r2(f.price)] || 0) + f.qty; });
      return m;
    }

    /* ================= D1 — anatomy ================= */
    var d1grid = ui.el('div', 'd-two');
    wrap.d1.appendChild(d1grid);
    var d1Ladder = card('盘口 · LEVEL 2', '五档');
    var d1LadderHost = ui.el('div', 'd-ladder');
    d1Ladder.body.appendChild(d1LadderHost);
    var d1Readout = ui.el('div', 'd-readout');
    d1Ladder.body.appendChild(d1Readout);
    d1grid.appendChild(d1Ladder.el);

    var d1right = ui.el('div', 'd-col');
    var d1kpis = kpiRow([['最新成交', '—'], ['价差', '—'], ['买一', '—'], ['卖一', '—']]);
    d1right.appendChild(d1kpis);
    var d1chartCard = card('五档委托量', 'QUANTITY');
    d1chartCard.el.style.flex = '1';
    d1chartCard.el.style.minHeight = '150px';
    var d1ChartHost = ui.el('div', 'chart');
    d1ChartHost.style.cssText = 'flex:1;min-height:140px';
    d1chartCard.body.style.padding = '0';
    d1chartCard.body.appendChild(d1ChartHost);
    d1right.appendChild(d1chartCard.el);
    var d1explain = ui.el('div', 'd-callout');
    d1explain.innerHTML = '<b>为什么买一 &lt; 卖一？</b><br>' +
      '买一是最高的买价，卖一是最低的卖价。如果买一 ≥ 卖一，两张委托立刻就能撮合，盘口不会停留在交叉状态；' +
      '连续竞价里两者之间的差额就是<b>价差</b>，也是立即成交要付出的隐性成本。';
    d1right.appendChild(d1explain);
    d1grid.appendChild(d1right);
    var d1Chart = charts.bars(d1ChartHost, {
      labels: [], values: [], colors: [],
      yFormat: function (v) { return ui.fmt.compact(v); },
      label: '五档委托量'
    });
    chartsByMode.d1 = [d1Chart];

    function renderD1() {
      var snap = book.snapshot();
      d1LadderHost.innerHTML = ladderHTML(snap);
      setKpis(d1kpis, [
        ['最新成交', ui.fmt.price(snap.last), 'hi'],
        ['价差', snap.spread == null ? '—' : ui.fmt.price(snap.spread)],
        ['买一', snap.bids[0] ? ui.fmt.price(snap.bids[0].price) : '—'],
        ['卖一', snap.asks[0] ? ui.fmt.price(snap.asks[0].price) : '—']
      ]);
      var bidTotal = snap.bids.reduce(function (s, lv) { return s + lv.qty; }, 0);
      var askTotal = snap.asks.reduce(function (s, lv) { return s + lv.qty; }, 0);
      var bb = book.best('buy'), ba = book.best('sell');
      d1Readout.innerHTML =
        '<div><span>价差</span><b>' + (snap.spread == null ? '—' : (snap.spread / TICK).toFixed(0) + ' 个最小变动') + '</b></div>' +
        '<div><span>五档买盘</span><b>' + ui.fmt.int(bidTotal) + ' 股</b></div>' +
        '<div><span>五档卖盘</span><b>' + ui.fmt.int(askTotal) + ' 股</b></div>' +
        '<div><span>买一/卖一队列</span><b>' + (bb ? bb.orders.length : 0) + ' / ' + (ba ? ba.orders.length : 0) + ' 笔</b></div>';
      var labels = [], values = [], colors = [];
      snap.asks.slice().reverse().forEach(function (lv, i) {
        labels.push('卖' + (CN_NAME[snap.asks.length - i] || (snap.asks.length - i)));
        values.push(lv.qty); colors.push(p.orange);
      });
      snap.bids.forEach(function (lv, i) {
        labels.push('买' + (CN_NAME[i + 1] || (i + 1)));
        values.push(lv.qty); colors.push(p.cyan);
      });
      d1Chart.setData({ labels: labels, values: values, colors: colors });
      mD1.set({
        last: '¥' + ui.fmt.price(snap.last),
        spread: snap.spread == null ? '—' : '¥' + ui.fmt.price(snap.spread),
        mid: '¥' + ui.fmt.price(snap.mid),
        bid: snap.bids[0] ? '¥' + ui.fmt.price(snap.bids[0].price) : '—',
        ask: snap.asks[0] ? '¥' + ui.fmt.price(snap.asks[0].price) : '—',
        depth: snap.bids.length + snap.asks.length + ' 档'
      }, { last: 'hi' });
    }

    /* ================= D2 — submit a limit order ================= */
    var d2grid = ui.el('div', 'd-two');
    wrap.d2.appendChild(d2grid);
    var d2Ladder = card('实时盘口', 'BOOK');
    var d2LadderHost = ui.el('div', 'd-ladder');
    d2Ladder.body.appendChild(d2LadderHost);
    var d2Hint = ui.el('div', 'd-hintbox');
    d2Ladder.body.appendChild(d2Hint);
    d2grid.appendChild(d2Ladder.el);

    var d2right = ui.el('div', 'd-col');
    var d2result = card('委托结果', 'STATUS');
    var d2resultBody = ui.el('div', 'd-result');
    d2result.body.appendChild(d2resultBody);
    d2right.appendChild(d2result.el);
    var d2log = card('委托日志', 'LOG');
    d2log.el.style.flex = '1';
    var d2logHost = ui.el('div', 'd-scroll');
    d2log.body.style.padding = '0';
    d2log.body.appendChild(d2logHost);
    d2right.appendChild(d2log.el);
    d2grid.appendChild(d2right);
    var d2Kpis = kpiRow([['最新价', '—'], ['价差', '—'], ['你的队列位置', '—'], ['状态', '—']]);
    d2right.insertBefore(d2Kpis, d2result.el);

    function renderD2() {
      var snap = book.snapshot();
      d2LadderHost.innerHTML = ladderHTML(snap, {
        hot: st.last ? { side: st.last.side, price: st.last.price } : null,
        hitPrice: st.last && st.last.fills && st.last.fills.length ? st.last.fills[0].price : null
      });
      d2Hint.innerHTML = '想<b>立即成交</b>：买入报价 ≥ 卖一 ' + (snap.asks[0] ? '¥' + ui.fmt.price(snap.asks[0].price) : '—') +
        '，卖出报价 ≤ 买一 ' + (snap.bids[0] ? '¥' + ui.fmt.price(snap.bids[0].price) : '—') +
        '；想<b>排队等待</b>，就把限价报在对手价之外。' +
        '<br>黄色行 = 你的委托价位；青色标记 = 本次成交所在档位。';
      var info = statusInfo(st.last && st.last.res);
      var html = '';
      if (!st.last) {
        html += '<div class="d-empty">尚未提交委托。在右侧面板选择方向、类型、价格与数量，然后点击「提交委托」。</div>';
        html += '<div class="d-legend">' +
          '<span class="d-tag rest">挂单中</span><span class="d-tag ok">全部成交</span>' +
          '<span class="d-tag part">部分成交</span><span class="d-tag rej">已拒绝</span></div>';
        html += '<div class="d-formula">限价单：先按价格优先、同价按时间优先撮合；不能立即成交的部分留在盘口。<br>市价单：只吃对手盘，剩余部分撤销。</div>';
      } else {
        var L = st.last;
        html += '<div class="d-statusline"><span class="d-pill ' + info.cls + '">' + info.label + '</span>' +
          '<span class="d-status-msg">' + (L.res.reason || (info.key === 'resting' ? '未成交部分已加入队列' : info.key === 'filled' ? '全部数量已成交' : '部分成交，剩余处理见下')) + '</span></div>';
        html += '<div class="d-kv-grid">' +
          '<div><span>方向</span><b>' + (L.side === 'buy' ? '买入' : '卖出') + '</b></div>' +
          '<div><span>类型</span><b>' + (L.type === 'market' ? '市价' : '限价') + '</b></div>' +
          '<div><span>委托价</span><b>' + (L.price == null ? '市价' : '¥' + ui.fmt.price(L.price)) + '</b></div>' +
          '<div><span>数量</span><b>' + ui.fmt.int(L.qty) + ' 股</b></div>' +
          '<div><span>成交</span><b>' + ui.fmt.int(L.res.filled) + ' 股</b></div>' +
          '<div><span>成交均价</span><b>' + (L.avg == null ? '—' : '¥' + ui.fmt.price(L.avg)) + '</b></div>' +
          '</div>';
        if (L.res.remaining > 0) {
          html += '<div class="d-note-line">剩余 ' + ui.fmt.int(L.res.remaining) + ' 股：' +
            (L.type === 'market' ? '市价单不挂单，剩余部分已撤销。' :
              info.key === 'rejected' ? '申报被拒绝，未进入队列。' :
                '已挂在 ¥' + ui.fmt.price(L.price) + '。') + '</div>';
        }
        if (L.queuePos) html += '<div class="d-note-line">你的委托在 ¥' + ui.fmt.price(L.price) + ' 的' + (L.side === 'buy' ? '买盘' : '卖盘') + '队列第 <b>' + L.queuePos + '</b> 位（同价按时间优先）。</div>';
        if (L.res.fills && L.res.fills.length) {
          var rows = L.res.fills.map(function (f, i) {
            return ['#' + (i + 1), '¥' + ui.fmt.price(f.price), ui.fmt.int(f.qty), '成交'];
          });
          html += '<div class="d-tbl">' + ui.table(['成交', '价格', '数量', '状态'], rows).outerHTML + '</div>';
        }
        html += '<div class="d-note-line">最新成交价：<b>¥' + ui.fmt.price(L.res.book ? L.res.book.last : snap.last) + '</b></div>';
      }
      d2resultBody.innerHTML = html;
      setKpis(d2Kpis, [
        ['最新价', '¥' + ui.fmt.price(snap.last), 'hi'],
        ['价差', snap.spread == null ? '—' : '¥' + ui.fmt.price(snap.spread)],
        ['你的队列位置', st.last && st.last.queuePos ? '第 ' + st.last.queuePos + ' 位' : (st.last && st.last.res && st.last.res.remaining > 0 ? '已加入' : '—')],
        ['状态', st.last ? statusInfo(st.last.res).label : '未提交']
      ]);
      var rows2 = tradeLog.slice().reverse().map(function (e) {
        return [e.time, e.sideLabel, e.price, ui.fmt.int(e.qty), '<span class="d-mini ' + e.cls + '">' + e.status + '</span>'];
      });
      d2logHost.innerHTML = '';
      if (!rows2.length) d2logHost.innerHTML = '<div class="d-empty small">还没有提交过委托。</div>';
      else d2logHost.appendChild(ui.table(['时间', '方向', '价格', '数量', '状态'], rows2));
    }

    /* ================= D3 — time priority ================= */
    var d3grid = ui.el('div', 'd-two');
    wrap.d3.appendChild(d3grid);
    var d3queue = card('同一价位的队列', 'FIFO');
    d3queue.body.style.padding = '0';
    var d3queueHost = ui.el('div', 'd-scroll');
    d3queue.body.appendChild(d3queueHost);
    d3grid.appendChild(d3queue.el);

    var d3right = ui.el('div', 'd-col');
    var d3result = card('穿价买单', 'CROSS');
    var d3resultBody = ui.el('div', 'd-result');
    d3result.body.appendChild(d3resultBody);
    d3right.appendChild(d3result.el);
    var d3explain = ui.el('div', 'd-callout');
    d3explain.innerHTML = '<b>价格优先，时间优先</b><br>同一价格的买单（或卖单）按到达顺序排队。' +
      '穿价单一档一档吃对手盘；同价先到先成交，后来者只能排在队尾。';
    d3right.appendChild(d3explain);
    d3grid.appendChild(d3right);
    var d3Kpis = kpiRow([['队列剩余', '—'], ['累计成交', '—'], ['队列笔数', '—'], ['价位', '—']]);
    d3right.insertBefore(d3Kpis, d3result.el);

    function lastResting(side, price) {
      var lv = book.best(side);
      if (!lv || Math.abs(lv.price - price) > TICK / 2) return null;
      return lv.orders.length ? lv.orders[lv.orders.length - 1] : null;
    }

    function setupQueue() {
      freshBook();
      var best = book.best('sell');
      st.queuePrice = best ? best.price : r2(BASE_MID + TICK);
      if (best) best.orders.slice().forEach(function (o) { book.cancel(o.id); });
      queue = [];
      [200, 300, 400].forEach(function (qty, i) {
        book.submit({ side: 'sell', type: 'limit', price: st.queuePrice, qty: qty, meta: { label: '同价卖单 ' + (i + 1) } });
        var rest = lastResting('sell', st.queuePrice);
        if (rest) queue.push({ id: rest.id, qty: rest.qty, filled: 0, t: rest.t, no: i + 1 });
      });
      st.cross = null;
    }

    function queuePosition(o) {
      var pos = 0;
      for (var i = 0; i < queue.length; i++) {
        pos++;
        if (queue[i].id === o.id) return pos;
      }
      return null;
    }

    function renderD3() {
      var snap = book.snapshot();
      var html = '<div class="d-qhead"><div><span>卖一价位</span><b>¥' + ui.fmt.price(st.queuePrice) + '</b></div>' +
        '<div><span>队列结构</span><b>' + queue.length + ' 笔</b></div></div>';
      html += '<div class="d-qrow qhead"><span>位置</span><span>单号 / 时间</span><span>委托</span><span>已成交</span><span>剩余</span></div>';
      queue.forEach(function (o, i) {
        var rem = Math.max(0, o.qty - o.filled);
        html += '<div class="d-qrow' + (rem === 0 ? ' done' : '') + '">' +
          '<span class="pos">' + (i + 1) + '</span>' +
          '<span class="id">#' + o.id + ' · ' + clock(o.t) + '</span>' +
          '<span>' + ui.fmt.int(o.qty) + '</span>' +
          '<span class="' + (o.filled ? 'fill' : '') + '">' + ui.fmt.int(o.filled) + '</span>' +
          '<span>' + ui.fmt.int(rem) + '</span></div>';
      });
      if (!queue.length) html += '<div class="d-empty">队列为空。</div>';
      var totalQ = queue.reduce(function (s, o) { return s + o.qty; }, 0);
      if (totalQ) {
        var segs = queue.map(function (o, i) {
          return '<span class="seg' + (i % 2 ? ' alt' : '') + '" style="width:' + (o.qty / totalQ * 100) + '%">' +
            (o.qty >= 150 ? ui.fmt.int(o.qty) : '') + '</span>';
        }).join('');
        html += '<div class="d-alloc"><div class="d-alloc-head"><span>队列容量（按到达顺序）</span><span>穿价单 ' +
          ui.fmt.int(st.crossQty) + ' 股</span></div><div class="d-alloc-bar">' + segs + '</div>' +
          '<div class="d-alloc-note">从左到右依次成交：买单先填满第 1 笔，再进入第 2 笔。' +
          (st.crossQty > totalQ ? ' 买单数量超过队列总量，剩余会转为买盘挂单。' : '') + '</div></div>';
      }
      html += '<div class="d-note-line">每笔卖单都是 100 股整数倍；时间显示为模拟时钟 09:30:00 起。</div>';
      d3queueHost.innerHTML = html;

      var resHtml = '';
      if (!st.cross) {
        resHtml += '<div class="d-empty">点击面板中的「穿价买入」，观察成交顺序。买价 = 卖方队列价位，数量可调。</div>';
      } else {
        var C = st.cross, info = statusInfo(C.res);
        resHtml += '<div class="d-statusline"><span class="d-pill ' + info.cls + '">' + info.label + '</span>' +
          '<span class="d-status-msg">买入 ' + ui.fmt.int(C.qty) + ' 股，成交 ' + ui.fmt.int(C.res.filled) + ' 股</span></div>';
        resHtml += '<div class="d-note-line">成交均价：<b>' + (C.avg == null ? '—' : '¥' + ui.fmt.price(C.avg)) +
          '</b> · 盘口最新价：<b>¥' + ui.fmt.price(book.snapshot().last) + '</b></div>';
        if (C.res.fills && C.res.fills.length) {
          var rows = C.res.fills.map(function (f) {
            var maker = null;
            for (var k = 0; k < queue.length; k++) if (queue[k].id === f.makerId) maker = queue[k];
            return ['#' + f.makerId, maker ? '第 ' + maker.no + ' 笔' : '更早挂单', '¥' + ui.fmt.price(f.price), ui.fmt.int(f.qty)];
          });
          resHtml += '<div class="d-tbl">' + ui.table(['对手单', '队列', '价格', '数量'], rows).outerHTML + '</div>';
        }
        if (C.res.remaining > 0) resHtml += '<div class="d-note-line">剩余 ' + ui.fmt.int(C.res.remaining) + ' 股转为买盘挂单（限价单）。</div>';
      }
      d3resultBody.innerHTML = resHtml;
      var totalFilled = queue.reduce(function (s, o) { return s + o.filled; }, 0);
      setKpis(d3Kpis, [
        ['队列剩余', ui.fmt.int(queue.reduce(function (s, o) { return s + Math.max(0, o.qty - o.filled); }, 0)) + ' 股'],
        ['累计成交', ui.fmt.int(totalFilled) + ' 股', totalFilled ? 'pos' : ''],
        ['队列笔数', queue.filter(function (o) { return o.filled < o.qty; }).length + ' 笔'],
        ['价位', '¥' + ui.fmt.price(st.queuePrice)]
      ]);
      mD3.set({ filled: ui.fmt.int(totalFilled) + ' 股', left: ui.fmt.int(queue.reduce(function (s, o) { return s + Math.max(0, o.qty - o.filled); }, 0)) + ' 股', last: '¥' + ui.fmt.price(snap.last), price: '¥' + ui.fmt.price(st.queuePrice) });
    }

    /* ================= D4 — market sweep ================= */
    var d4grid = ui.el('div', 'd-two');
    wrap.d4.appendChild(d4grid);
    var d4Ladder = card('卖方盘口', 'ASKS');
    var d4LadderHost = ui.el('div', 'd-ladder');
    d4Ladder.body.appendChild(d4LadderHost);
    d4grid.appendChild(d4Ladder.el);

    var d4right = ui.el('div', 'd-col');
    var d4Kpis = kpiRow([['成交数量', '—'], ['成交均价', '—'], ['滑点', '—'], ['状态', '—']]);
    d4right.appendChild(d4Kpis);
    var d4result = card('逐档成交', 'FILLS');
    d4result.el.style.flex = '1';
    var d4resultBody = ui.el('div', 'd-scroll');
    d4result.body.style.padding = '0';
    d4result.body.appendChild(d4resultBody);
    d4right.appendChild(d4result.el);
    var d4note = ui.el('div', 'd-callout');
    d4note.innerHTML = '<b>市价单扫盘</b><br>市价买单从卖一开始逐档吃单，成交价越来越高；' +
      '平均成交价高于卖一的部分就是<b>滑点</b>。盘口深度不够时，剩余数量撤销，不会挂在盘口。';
    d4right.appendChild(d4note);
    d4grid.appendChild(d4right);

    function runSweep() {
      freshBook();
      var before = book.snapshot();
      var bestAsk = before.asks.length ? before.asks[0].price : null;
      var res = book.submit({ side: 'buy', type: 'market', qty: st.sweepQty });
      var avg = fillAvg(res.fills);
      var groups = [];
      (res.fills || []).forEach(function (f) {
        var g = null;
        for (var i = 0; i < groups.length; i++) if (Math.abs(groups[i].price - f.price) < TICK / 2) g = groups[i];
        if (!g) { g = { price: f.price, qty: 0, n: 0, level: 0 }; groups.push(g); }
        g.qty += f.qty; g.n++;
      });
      groups.forEach(function (g) {
        before.asks.forEach(function (lv, i) { if (Math.abs(lv.price - g.price) < TICK / 2) g.level = i + 1; });
      });
      st.sweep = {
        before: before, res: res, bestAsk: bestAsk, avg: avg,
        slip: avg != null && bestAsk != null ? avg - bestAsk : null,
        groups: groups, qty: st.sweepQty
      };
    }

    function renderD4() {
      var before = st.sweep ? st.sweep.before : book.snapshot();
      var html = ladderHTML(before, { askOnly: true, fillByPrice: st.sweep ? fillMap(st.sweep.res.fills) : null });
      if (st.sweep) {
        var after = st.sweep.res.book;
        html += '<div class="d-subhead">扫盘后剩余卖盘</div>';
        html += after && after.asks.length ? ladderHTML(after, { askOnly: true }) :
          '<div class="d-empty small">卖盘已被吃空。再提交市价买单，将因没有对手盘被拒绝。</div>';
      }
      d4LadderHost.innerHTML = html;
      if (!st.sweep) {
        d4resultBody.innerHTML = '<div class="d-empty">点击「执行市价买入」以当前盘口扫单。</div>';
        setKpis(d4Kpis, [['成交数量', '—'], ['成交均价', '—'], ['滑点', '—'], ['状态', '—']]);
        return;
      }
      var S = st.sweep, info = statusInfo(S.res);
      var html = '<div class="d-statusline"><span class="d-pill ' + info.cls + '">' + info.label + '</span>' +
        '<span class="d-status-msg">市价买入 ' + ui.fmt.int(S.qty) + ' 股，成交 ' + ui.fmt.int(S.res.filled) + ' 股</span></div>';
      if (S.groups.length) {
        var rows = S.groups.map(function (g) {
          return ['卖' + (CN_NAME[g.level] || g.level), '¥' + ui.fmt.price(g.price), ui.fmt.int(g.qty), '¥' + ui.fmt.num(g.price * g.qty, 2)];
        });
        html += '<div class="d-tbl">' + ui.table(['档位', '成交价', '数量', '金额'], rows).outerHTML + '</div>';
      } else {
        html += '<div class="d-empty small">盘口没有可成交的对手单，委托被拒绝。</div>';
      }
      html += '<div class="d-note-line">卖一价 <b>¥' + (S.bestAsk == null ? '—' : ui.fmt.price(S.bestAsk)) +
        '</b> · 成交均价 <b>' + (S.avg == null ? '—' : '¥' + ui.fmt.price(S.avg)) + '</b></div>';
      if (S.slip != null) {
        html += '<div class="d-note-line">滑点 = 均价 − 卖一 = <b>¥' + ui.fmt.num(S.slip, 4) + '</b>（' +
          ui.fmt.num(S.slip / S.bestAsk * 100, 3) + '%，约 ' + ui.fmt.num(S.slip / TICK, 1) + ' 个最小变动单位）</div>';
      }
      if (S.res.remaining > 0) {
        html += '<div class="d-warn-line">剩余 <b>' + ui.fmt.int(S.res.remaining) + '</b> 股没有对手盘，市价单剩余部分<b>已撤销</b>，不会变成挂单。</div>';
      } else {
        html += '<div class="d-note-line">全部数量成交，没有剩余撤销。</div>';
      }
      d4resultBody.innerHTML = html;
      setKpis(d4Kpis, [
        ['成交数量', ui.fmt.int(S.res.filled) + ' 股', 'hi'],
        ['成交均价', S.avg == null ? '—' : '¥' + ui.fmt.price(S.avg)],
        ['滑点', S.slip == null ? '—' : '¥' + ui.fmt.num(S.slip, 4)],
        ['状态', info.label]
      ]);
      mD4.set({
        filled: ui.fmt.int(S.res.filled) + ' 股',
        avg: S.avg == null ? '—' : '¥' + ui.fmt.price(S.avg),
        slip: S.slip == null ? '—' : '¥' + ui.fmt.num(S.slip, 4),
        rest: S.res.remaining > 0 ? '撤销 ' + ui.fmt.int(S.res.remaining) : '0'
      });
    }

    /* ================= D5 — pressure ================= */
    var d5grid = ui.el('div', 'd-two');
    wrap.d5.appendChild(d5grid);
    var d5depth = card('盘口深度', 'DEPTH');
    var d5depthHost = ui.el('div', 'd-depth');
    d5depth.body.appendChild(d5depthHost);
    d5grid.appendChild(d5depth.el);

    var d5right = ui.el('div', 'd-col');
    var d5Kpis = kpiRow([['最新价', '—'], ['价差', '—'], ['买盘总量', '—'], ['卖盘总量', '—']]);
    d5right.appendChild(d5Kpis);
    var d5cmp = card('压力前后', 'BEFORE / AFTER');
    var d5cmpBody = ui.el('div', 'd-scroll');
    d5cmp.body.style.padding = '0';
    d5cmp.body.appendChild(d5cmpBody);
    d5cmp.el.style.flex = '1';
    d5right.appendChild(d5cmp.el);
    var d5concl = ui.el('div', 'd-callout');
    d5concl.innerHTML = '<b>结论</b><br>买单很多、看着“买盘厚”，并不保证价格更高。价格由<b>委托价格</b>、' +
      '可成交的<b>对手盘</b>和<b>实际撮合</b>共同决定；挂在买一以下的单子再大，也不会把价格推上去。';
    d5right.appendChild(d5concl);
    d5grid.appendChild(d5right);

    function depthHTML(snap) {
      var maxQ = 1;
      snap.asks.concat(snap.bids).forEach(function (lv) { maxQ = Math.max(maxQ, lv.qty); });
      var html = '<div class="d-depth-head"><span>卖方 · ASK</span><span>价格</span><span>数量</span><span></span></div>';
      for (var i = snap.asks.length - 1; i >= 0; i--) {
        var lv = snap.asks[i];
        html += '<div class="d-depth-row ask"><span>卖' + (CN_NAME[i + 1] || (i + 1)) + '</span><span class="p">' + ui.fmt.price(lv.price) +
          '</span><span class="q">' + ui.fmt.int(lv.qty) + '</span><span class="bar"><em style="width:' + (lv.qty / maxQ * 100) + '%"></em></span></div>';
      }
      html += '<div class="d-depth-mid">最新 <b>' + ui.fmt.price(snap.last) + '</b> · 价差 <b>' + (snap.spread == null ? '—' : ui.fmt.price(snap.spread)) + '</b></div>';
      snap.bids.forEach(function (lv2, j) {
        html += '<div class="d-depth-row bid"><span>买' + (CN_NAME[j + 1] || (j + 1)) + '</span><span class="p">' + ui.fmt.price(lv2.price) +
          '</span><span class="q">' + ui.fmt.int(lv2.qty) + '</span><span class="bar"><em style="width:' + (lv2.qty / maxQ * 100) + '%"></em></span></div>';
      });
      return html;
    }

    function totals(snap) {
      return {
        bid: snap.bids.reduce(function (s, lv) { return s + lv.qty; }, 0),
        ask: snap.asks.reduce(function (s, lv) { return s + lv.qty; }, 0)
      };
    }

    var PRESS_LABEL = { base: '初始盘口', buy: '买方压力', sell: '卖方压力', sparse: '交易稀疏' };

    function runPressure(style) {
      freshBook();
      var before = book.snapshot();
      var results = style === 'base' ? [] : book.pressure(style);
      var after = book.snapshot();
      st.press = {
        style: style, before: before, after: after, results: results,
        trades: book.trades.length,
        tradesAfter: book.trades.slice(),
        tb: totals(before), ta: totals(after)
      };
    }

    function renderD5() {
      var P = st.press || (runPressure('base'), st.press);
      var snap = P.after;
      d5depthHost.innerHTML = depthHTML(snap);
      setKpis(d5Kpis, [
        ['最新价', '¥' + ui.fmt.price(snap.last), 'hi'],
        ['价差', snap.spread == null ? '—' : '¥' + ui.fmt.price(snap.spread)],
        ['买盘总量', ui.fmt.int(P.ta.bid) + ' 股'],
        ['卖盘总量', ui.fmt.int(P.ta.ask) + ' 股']
      ]);
      var rows = [
        ['最新成交', '¥' + ui.fmt.price(P.before.last), '¥' + ui.fmt.price(P.after.last)],
        ['价差', P.before.spread == null ? '—' : '¥' + ui.fmt.price(P.before.spread), P.after.spread == null ? '—' : '¥' + ui.fmt.price(P.after.spread)],
        ['买盘总量', ui.fmt.int(P.tb.bid), ui.fmt.int(P.ta.bid)],
        ['卖盘总量', ui.fmt.int(P.tb.ask), ui.fmt.int(P.ta.ask)],
        ['五档成交笔数', '0', String(P.trades)]
      ];
      var head = '<div class="d-press-head"><span class="d-pill press">' + PRESS_LABEL[P.style] + '</span>' +
        '<span class="d-status-msg">买/卖盘 ' + (P.style === 'sell' ? '卖压' : P.style === 'buy' ? '买压' : P.style === 'sparse' ? '稀疏' : '基准') + '</span></div>';
      d5cmpBody.innerHTML = head + ui.table(['指标', '压力前', '压力后'], rows).outerHTML;
      var extra = '';
      if (P.style === 'buy') extra = '市价买单吃掉了部分卖盘，最新价被推高；随后的大额限价买单只是挂在买盘，并未继续推高价格。';
      else if (P.style === 'sell') extra = '市价卖单打掉买盘，最新价下移；新增卖单挂在卖盘，继续压低价格需要有人真的接单。';
      else if (P.style === 'sparse') extra = '成交稀疏、价差较宽；一笔小单就能明显改变某一侧的深度，价格发现更不稳定。';
      else extra = '这是未施加压力的初始盘口。选择「买方压力 / 卖方压力 / 交易稀疏」再观察变化。';
      var el = ui.el('div', 'd-note-line');
      el.innerHTML = extra;
      d5cmpBody.appendChild(el);
      if (P.tradesAfter.length) {
        var trows = P.tradesAfter.map(function (t) {
          return [clock(t.t), t.taker === 'buy' ? '主动买入' : '主动卖出', '¥' + ui.fmt.price(t.price), ui.fmt.int(t.qty)];
        });
        var tWrap = ui.el('div', 'd-trade-log');
        tWrap.appendChild(ui.table(['时间', '主动方', '价格', '数量'], trows));
        d5cmpBody.appendChild(tWrap);
      }
      mD5.set({
        last: '¥' + ui.fmt.price(snap.last),
        spread: snap.spread == null ? '—' : '¥' + ui.fmt.price(snap.spread),
        bids: ui.fmt.int(P.ta.bid) + ' 股',
        asks: ui.fmt.int(P.ta.ask) + ' 股',
        style: PRESS_LABEL[P.style]
      });
    }

    /* ================= D6 — costs ================= */
    var d6 = ui.el('div', 'd-fees');
    wrap.d6.appendChild(d6);
    var d6cards = ui.el('div', 'd-two');
    d6.appendChild(d6cards);
    var cnCard = card('A 股 · 买入 + 卖出', 'CNY');
    var cnBody = ui.el('div', 'd-fee-card');
    cnCard.body.style.padding = '0';
    cnCard.body.appendChild(cnBody);
    d6cards.appendChild(cnCard.el);
    var usCard = card('美股 · 买入 + 卖出', 'USD');
    var usBody = ui.el('div', 'd-fee-card');
    usCard.body.style.padding = '0';
    usCard.body.appendChild(usBody);
    d6cards.appendChild(usCard.el);
    var d6chartCard = card('单边成本率', 'COST %');
    d6chartCard.el.style.flex = '1';
    d6chartCard.el.style.minHeight = '170px';
    d6chartCard.body.style.padding = '0';
    var d6ChartHost = ui.el('div', 'chart');
    d6ChartHost.style.cssText = 'flex:1;min-height:150px';
    d6chartCard.body.appendChild(d6ChartHost);
    d6.appendChild(d6chartCard.el);
    var d6Chart = charts.bars(d6ChartHost, {
      labels: [], values: [], colors: [],
      yFormat: function (v) { return v.toFixed(3) + '%'; },
      valueLabels: false, label: '单边成本率'
    });
    chartsByMode.d6 = [d6Chart];

    function feeNumbers() {
      var cnBuy = core.fees({
        market: 'cn', side: 'buy', price: st.cnPrice, qty: st.cnQty,
        commissionRate: st.cnComm / 100, minCommission: st.cnMin,
        stampRate: st.cnStamp / 100, transferRate: st.cnTransfer / 100
      });
      var cnSell = core.fees({
        market: 'cn', side: 'sell', price: st.cnPrice, qty: st.cnQty,
        commissionRate: st.cnComm / 100, minCommission: st.cnMin,
        stampRate: st.cnStamp / 100, transferRate: st.cnTransfer / 100
      });
      var usBuy = core.fees({
        market: 'us', side: 'buy', price: st.usPrice, qty: st.usQty,
        commissionRate: st.usComm / 100, minCommission: st.usMin
      });
      var usSell = core.fees({
        market: 'us', side: 'sell', price: st.usPrice, qty: st.usQty,
        commissionRate: st.usComm / 100, minCommission: st.usMin,
        secFeeRate: st.usSec / 100, tafPerShare: st.usTaf, tafMax: st.usTafMax
      });
      return { cnBuy: cnBuy, cnSell: cnSell, usBuy: usBuy, usSell: usSell, cnRound: cnBuy.total + cnSell.total, usRound: usBuy.total + usSell.total };
    }

    function feeRows(f, cur) {
      var rows = [
        ['成交金额', ui.fmt.money(f.amount, cur)],
        ['佣金', ui.fmt.money(f.commission, cur)]
      ];
      if (f.stamp) rows.push(['印花税（卖出）', ui.fmt.money(f.stamp, cur)]);
      if (f.transfer) rows.push(['过户费', ui.fmt.money(f.transfer, cur)]);
      if (f.secFee) rows.push(['SEC 监管费', ui.fmt.money(f.secFee, cur)]);
      if (f.taf) rows.push(['FINRA TAF', ui.fmt.money(f.taf, cur)]);
      if (f.other) rows.push(['其他费用', ui.fmt.money(f.other, cur)]);
      rows.push(['单边合计', '<b>' + ui.fmt.money(f.total, cur) + '</b>']);
      return rows;
    }

    function renderD6() {
      var N = feeNumbers();
      var cnRate = N.cnRound / (st.cnPrice * st.cnQty) * 100;
      var usRate = N.usRound / (st.usPrice * st.usQty) * 100;
      cnBody.innerHTML = '<div class="d-fee-sec">买入</div>' + ui.table(['项目', '金额'], feeRows(N.cnBuy, 'CNY')).outerHTML +
        '<div class="d-fee-sec">卖出</div>' + ui.table(['项目', '金额'], feeRows(N.cnSell, 'CNY')).outerHTML +
        '<div class="d-fee-total"><span>往返合计</span><b>¥' + ui.fmt.num(N.cnRound, 2) + '</b></div>' +
        '<div class="d-note-line">往返成本率 <b>' + ui.fmt.num(cnRate, 4) + '%</b> · 约需上涨 ' + ui.fmt.num(cnRate, 4) + '% 回本（近似）</div>';
      usBody.innerHTML = '<div class="d-fee-sec">买入</div>' + ui.table(['项目', '金额'], feeRows(N.usBuy, 'USD')).outerHTML +
        '<div class="d-fee-sec">卖出</div>' + ui.table(['项目', '金额'], feeRows(N.usSell, 'USD')).outerHTML +
        '<div class="d-fee-total"><span>往返合计</span><b>$' + ui.fmt.num(N.usRound, 2) + '</b></div>' +
        '<div class="d-note-line">往返成本率 <b>' + ui.fmt.num(usRate, 4) + '%</b> · 约需上涨 ' + ui.fmt.num(usRate, 4) + '% 回本（近似）</div>';
      d6Chart.setData({
        labels: ['A股 买入', 'A股 卖出', '美股 买入', '美股 卖出'],
        values: [N.cnBuy.totalRate, N.cnSell.totalRate, N.usBuy.totalRate, N.usSell.totalRate],
        colors: [p.red, p.orange, p.blue, p.cyan]
      });
      mD6.set({
        cnRound: '¥' + ui.fmt.num(N.cnRound, 2),
        cnRate: ui.fmt.num(cnRate, 4) + '%',
        usRound: '$' + ui.fmt.num(N.usRound, 2),
        usRate: ui.fmt.num(usRate, 4) + '%'
      }, { cnRound: 'hi', usRound: 'hi' });
    }

    /* ================= panel ================= */
    var gMode = ui.section(panel, '实验室', 'D1–D6');
    var modeCtl = ui.seg({
      options: [
        { value: 'd1', label: 'D1 盘口' }, { value: 'd2', label: 'D2 下单' }, { value: 'd3', label: 'D3 排队' },
        { value: 'd4', label: 'D4 扫盘' }, { value: 'd5', label: 'D5 压力' }, { value: 'd6', label: 'D6 成本' }
      ],
      value: 'd1',
      onChange: function (v) { switchMode(v); }
    });
    gMode.appendChild(modeCtl.el);

    var gD1 = ui.section(panel, 'D1 · 盘口', 'BOOK');
    var midCtl = ui.slider({
      label: '中间价', min: 95, max: 105, step: 0.01, value: 100, unit: '元',
      hint: '改变盘口中心价，观察五档价格与价差如何整体平移。',
      onInput: function (v) {
        st.mid = v;
        book = sim.orderBook({ mid: v, tick: TICK, depth: 5, seed: st.seed });
        renderD1();
      }
    });
    gD1.appendChild(midCtl.el);
    var mD1 = ui.metrics([
      { key: 'last', label: '最新成交' }, { key: 'spread', label: '价差' },
      { key: 'mid', label: '中间价' }, { key: 'bid', label: '买一' },
      { key: 'ask', label: '卖一' }, { key: 'depth', label: '展示档位' }
    ]);
    gD1.appendChild(mD1.el);
    gD1.appendChild(ui.formula('价差 = 卖一 − 买一<br>中间价 = (买一 + 卖一) / 2<br>最新价 = 最近一笔成交价'));
    gD1.appendChild(ui.note('五档只是盘口的一部分；真实市场还有隐藏单、冰山单和更深的档位，本模型未模拟。'));

    var gD2 = ui.section(panel, 'D2 · 提交委托', 'ORDER');
    var sideCtl = ui.seg({
      label: '方向',
      options: [{ value: 'buy', label: '买入' }, { value: 'sell', label: '卖出' }],
      value: 'buy', onChange: function (v) { st.side = v; renderD2(); }
    });
    var typeCtl = ui.seg({
      label: '类型',
      options: [{ value: 'limit', label: '限价' }, { value: 'market', label: '市价' }],
      value: 'limit',
      onChange: function (v) {
        st.type = v;
        priceCtl.input.disabled = v === 'market';
        priceCtl.range.disabled = v === 'market';
        renderD2();
      }
    });
    gD2.appendChild(sideCtl.el); gD2.appendChild(typeCtl.el);
    var priceCtl = ui.slider({
      label: '限价', min: 88, max: 112, step: 0.01, value: 100, unit: '元',
      hint: '涨停 110.00 / 跌停 90.00（示例：昨收 100，主板 ±10%）。',
      onInput: function (v) { st.price = v; renderD2(); }
    });
    var qtyCtl = ui.slider({
      label: '数量', min: 100, max: 12000, step: 100, value: 500, unit: '股',
      onInput: function (v) { st.qty = v; renderD2(); }
    });
    gD2.appendChild(priceCtl.el); gD2.appendChild(qtyCtl.el);
    var limitCtl = ui.check({
      label: '启用涨跌幅限制（示例）', checked: true,
      onChange: function (v) { st.useLimits = v; renderD2(); }
    });
    gD2.appendChild(limitCtl.el);
    gD2.appendChild(ui.row([
      ui.button('填入买一价', function () {
        var s = book.snapshot();
        if (s.bids[0]) { st.price = s.bids[0].price; priceCtl.set(st.price, true); renderD2(); }
      }, 'sm ghost'),
      ui.button('填入卖一价', function () {
        var s = book.snapshot();
        if (s.asks[0]) { st.price = s.asks[0].price; priceCtl.set(st.price, true); renderD2(); }
      }, 'sm ghost')
    ]));
    var submitBtn = ui.button('提交委托', submitOrder, 'primary');
    gD2.appendChild(submitBtn);
    var mD2 = ui.metrics([
      { key: 'last', label: '最新价' }, { key: 'spread', label: '价差' },
      { key: 'queue', label: '队列位置' }, { key: 'state', label: '状态' }
    ]);
    gD2.appendChild(mD2.el);
    gD2.appendChild(ui.formula('成交条件：买价 ≥ 卖一 或 卖价 ≤ 买一<br>剩余数量：限价单挂单 / 市价单撤销<br>状态：全部成交 · 部分成交 · 挂单中 · 已拒绝'));
    var logLegend = ui.el('div', 'd-legend');
    logLegend.innerHTML = '<span class="d-tag rest">挂单中</span><span class="d-tag ok">全部成交</span><span class="d-tag part">部分成交</span><span class="d-tag rej">已拒绝</span>';
    gD2.appendChild(logLegend);

    var gD3 = ui.section(panel, 'D3 · 同价排队', 'FIFO');
    var crossCtl = ui.slider({
      label: '穿价买入数量', min: 100, max: 1200, step: 50, value: 350, unit: '股',
      hint: '买价固定为卖一价位；数量超过队列总量时，剩余转为买盘挂单。',
      onInput: function (v) { st.crossQty = v; }
    });
    gD3.appendChild(crossCtl.el);
    gD3.appendChild(ui.row([
      ui.button('穿价买入', function () { crossQueue(); }, 'primary'),
      ui.button('追加同价卖单', function () { addQueueOrder(); }, 'sm ghost'),
      ui.button('重置队列', function () { setupQueue(); renderD3(); }, 'sm ghost')
    ]));
    var mD3 = ui.metrics([
      { key: 'left', label: '队列剩余' }, { key: 'filled', label: '累计成交' },
      { key: 'last', label: '最新价' }, { key: 'price', label: '队列价位' }
    ]);
    gD3.appendChild(mD3.el);
    gD3.appendChild(ui.formula('同价卖单：先到先成交<br>成交量 = min(买单数量, 队首剩余)<br>队列位置按到达顺序重新编号'));
    gD3.appendChild(ui.note('场景开始时取消了卖一价位的初始挂单，只留下三笔同价卖单，便于观察先后顺序。'));

    var gD4 = ui.section(panel, 'D4 · 市价扫盘', 'SWEEP');
    var sweepCtl = ui.slider({
      label: '市价买入数量', min: 1000, max: 40000, step: 500, value: 9000, unit: '股',
      hint: '把数量调到超过五档总量，可以看到“部分成交 + 剩余撤销”。',
      onInput: function (v) { st.sweepQty = v; }
    });
    gD4.appendChild(sweepCtl.el);
    gD4.appendChild(ui.row([
      ui.button('执行市价买入', function () { runSweep(); renderD4(); }, 'primary'),
      ui.button('重置盘口', function () { freshBook(); st.sweep = null; renderD4(); }, 'sm ghost')
    ]));
    var mD4 = ui.metrics([
      { key: 'filled', label: '成交数量' }, { key: 'avg', label: '成交均价' },
      { key: 'slip', label: '滑点（相对卖一）' }, { key: 'rest', label: '剩余撤销' }
    ]);
    gD4.appendChild(mD4.el);
    gD4.appendChild(ui.formula('成交均价 = Σ(价格 × 数量) / Σ数量<br>滑点 = 成交均价 − 卖一价<br>市价单剩余 = 0 或撤销，不挂单'));

    var gD5 = ui.section(panel, 'D5 · 压力场景', 'PRESSURE');
    gD5.appendChild(ui.row([
      ui.button('买方压力', function () { runPressure('buy'); renderD5(); }, 'sm'),
      ui.button('卖方压力', function () { runPressure('sell'); renderD5(); }, 'sm'),
      ui.button('交易稀疏', function () { runPressure('sparse'); renderD5(); }, 'sm')
    ]));
    gD5.appendChild(ui.row([
      ui.button('恢复初始盘口', function () { runPressure('base'); renderD5(); }, 'sm ghost')
    ]));
    var mD5 = ui.metrics([
      { key: 'last', label: '最新价' }, { key: 'spread', label: '价差' },
      { key: 'bids', label: '买盘总量' }, { key: 'asks', label: '卖盘总量' },
      { key: 'style', label: '当前场景' }
    ]);
    gD5.appendChild(mD5.el);
    gD5.appendChild(ui.formula('价格变化来自实际成交，不来自挂单数量<br>买盘厚度 ≠ 涨价概率'));
    gD5.appendChild(ui.warn('教学模型：盘口只有五档、没有隐藏单/冰山单；压力场景用固定随机种子，结果可重复。'));

    var gD6 = ui.section(panel, 'D6 · A 股成本', 'CNY');
    function numCtl(parent, label, value, step, onChange) {
      var c = ui.number({ label: label, value: value, step: step, onChange: function (v) { onChange(v); renderD6(); } });
      parent.appendChild(c.el);
      return c;
    }
    var cnPriceCtl = numCtl(gD6, '成交价（元）', st.cnPrice, 0.5, function (v) { st.cnPrice = v; });
    var cnQtyCtl = numCtl(gD6, '数量（股，100 的整数倍）', st.cnQty, 100, function (v) { st.cnQty = Math.max(0, Math.round(v)); });
    var cnCommCtl = numCtl(gD6, '佣金率（%）', st.cnComm, 0.001, function (v) { st.cnComm = v; });
    var cnMinCtl = numCtl(gD6, '最低佣金（元）', st.cnMin, 1, function (v) { st.cnMin = v; });
    var cnStampCtl = numCtl(gD6, '印花税（卖出，%）', st.cnStamp, 0.001, function (v) { st.cnStamp = v; });
    var cnTransCtl = numCtl(gD6, '过户费（%，双向）', st.cnTransfer, 0.0005, function (v) { st.cnTransfer = v; });
    var mD6 = ui.metrics([
      { key: 'cnRound', label: 'A 股往返成本' }, { key: 'cnRate', label: 'A 股成本率' },
      { key: 'usRound', label: '美股往返成本' }, { key: 'usRate', label: '美股成本率' }
    ]);
    gD6.appendChild(mD6.el);
    gD6.appendChild(ui.note('费率可改；默认值来自 SM.rules 的示例报价（佣金 0.025%、最低 5 元、印花税 0.05%、过户费 0.001%）。'));

    var gD6us = ui.section(panel, 'D6 · 美股成本', 'USD');
    var usPriceCtl = numCtl(gD6us, '成交价（美元）', st.usPrice, 1, function (v) { st.usPrice = v; });
    var usQtyCtl = numCtl(gD6us, '数量（股）', st.usQty, 1, function (v) { st.usQty = Math.max(0, Math.round(v)); });
    var usCommCtl = numCtl(gD6us, '佣金率（%）', st.usComm, 0.001, function (v) { st.usComm = v; });
    var usMinCtl = numCtl(gD6us, '最低佣金（美元）', st.usMin, 1, function (v) { st.usMin = v; });
    var usSecCtl = numCtl(gD6us, 'SEC 监管费（卖出，%）', st.usSec, 0.0001, function (v) { st.usSec = v; });
    var usTafCtl = numCtl(gD6us, 'TAF（美元/股）', st.usTaf, 0.00001, function (v) { st.usTaf = v; });
    var usTafMaxCtl = numCtl(gD6us, 'TAF 上限（美元）', st.usTafMax, 0.1, function (v) { st.usTafMax = v; });
    gD6us.appendChild(ui.warn('券商费率差异很大，且可能变化；这里只是<b>示例费率</b>，不是全市场统一规则，也不构成投资建议。'));
    gD6us.appendChild(ui.note('A 股印花税只在卖出时收取；美股 SEC 费与 TAF 也只在卖出时产生（本模型）。'));

    var gReset = ui.section(panel);
    gReset.appendChild(ui.row([ui.reset(resetCurrent)]));
    gReset.appendChild(ui.warn('模型边界：连续竞价、简化的五档深度、无隐藏单/冰山单；不含交易所全部撮合细则、停牌与盘后交易。'));

    /* ================= behaviour ================= */
    function submitOrder() {
      var snap = book.snapshot();
      var lim = rules.limitPrices(BASE_MID, rules.cnLimitPct('main'));
      var res = book.submit({
        side: st.side, type: st.type,
        price: st.type === 'market' ? null : st.price,
        qty: st.qty,
        limitUp: st.useLimits ? lim.upper : null,
        limitDown: st.useLimits ? lim.lower : null
      });
      var info = statusInfo(res);
      var avg = fillAvg(res.fills);
      var queuePos = null;
      if ((res.status === 'resting' || res.status === 'partial') && res.order) {
        // The simulator appends a new resting order (the queued maker) and the
        // submit result keeps the original taker object. The queue position is
        // therefore the last slot at the best level when our price is at that level.
        var sideArr = st.side === 'buy' ? book.best('buy') : book.best('sell');
        if (sideArr && Math.abs(sideArr.price - st.price) < TICK / 2) {
          queuePos = sideArr.orders.length;
        }
      }
      st.last = {
        res: res, side: st.side, type: st.type, qty: st.qty,
        price: st.type === 'market' ? null : st.price,
        avg: avg, fills: res.fills, queuePos: queuePos
      };
      tradeLog.push({
        time: clock(tradeLog.length + 1), sideLabel: (st.side === 'buy' ? '买入' : '卖出') + (st.type === 'market' ? ' 市价' : ' 限价'),
        price: st.type === 'market' ? '市价' : '¥' + ui.fmt.price(st.price),
        qty: st.qty, status: info.label, cls: info.cls
      });
      if (tradeLog.length > 14) tradeLog.shift();
      renderD2();
    }

    function crossQueue() {
      var res = book.submit({ side: 'buy', type: 'limit', price: st.queuePrice, qty: st.crossQty });
      (res.fills || []).forEach(function (f) {
        for (var i = 0; i < queue.length; i++) if (queue[i].id === f.makerId) queue[i].filled += f.qty;
      });
      st.cross = { res: res, qty: st.crossQty, avg: fillAvg(res.fills) };
      renderD3();
    }

    function addQueueOrder() {
      var res = book.submit({ side: 'sell', type: 'limit', price: st.queuePrice, qty: 100, meta: { label: '追加卖单' } });
      if (res.fills && res.fills.length) {
        // A crossing order may fill immediately; reflect it in the queue if it
        // came from our own earlier bid.
        toastSafe('新卖单与盘口买价交叉，已直接成交 ' + ui.fmt.int(res.filled) + ' 股');
      }
      var rest = lastResting('sell', st.queuePrice);
      if (rest) queue.push({ id: rest.id, qty: rest.qty, filled: 0, t: rest.t, no: queue.length + 1 });
      renderD3();
    }

    var toastTimer = null;
    function toastSafe(msg) {
      var t = ui.el('div', 'd-toast', msg);
      wrap.d3.appendChild(t);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { t.remove(); }, 2600);
    }

    function switchMode(m) {
      st.mode = m;
      prepare(m);
      if (m === 'd3') setupQueue();
      if (m === 'd4') runSweep();
      if (m === 'd5') runPressure('base');
      sync();
    }

    function prepare(mode) {
      if (mode === 'd1') {
        book = sim.orderBook({ mid: st.mid, tick: TICK, depth: 5, seed: st.seed });
      } else {
        book = sim.orderBook({ mid: BASE_MID, tick: TICK, depth: 5, seed: st.seed });
      }
      tradeLog = [];
      queue = [];
      st.last = null;
      st.cross = null;
      st.sweep = null;
      st.press = null;
    }

    function resetCurrent() {
      var m = st.mode;
      Object.assign(st, DEFAULT);
      st.mode = m;
      switchMode(m);
    }

    function sync() {
      ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].forEach(function (m) {
        wrap[m].style.display = m === st.mode ? 'flex' : 'none';
      });
      gD1.style.display = st.mode === 'd1' ? '' : 'none';
      gD2.style.display = st.mode === 'd2' ? '' : 'none';
      gD3.style.display = st.mode === 'd3' ? '' : 'none';
      gD4.style.display = st.mode === 'd4' ? '' : 'none';
      gD5.style.display = st.mode === 'd5' ? '' : 'none';
      gD6.style.display = st.mode === 'd6' ? '' : 'none';
      gD6us.style.display = st.mode === 'd6' ? '' : 'none';
      modeCtl.set(st.mode);
      midCtl.set(st.mid, true);
      sideCtl.set(st.side); typeCtl.set(st.type);
      priceCtl.set(st.price, true); qtyCtl.set(st.qty, true);
      limitCtl.set(st.useLimits);
      crossCtl.set(st.crossQty, true);
      sweepCtl.set(st.sweepQty, true);
      priceCtl.input.disabled = st.type === 'market';
      priceCtl.range.disabled = st.type === 'market';
      cnPriceCtl.input.value = st.cnPrice; cnQtyCtl.input.value = st.cnQty;
      cnCommCtl.input.value = st.cnComm; cnMinCtl.input.value = st.cnMin;
      cnStampCtl.input.value = st.cnStamp; cnTransCtl.input.value = st.cnTransfer;
      usPriceCtl.input.value = st.usPrice; usQtyCtl.input.value = st.usQty;
      usCommCtl.input.value = st.usComm; usMinCtl.input.value = st.usMin;
      usSecCtl.input.value = st.usSec; usTafCtl.input.value = st.usTaf;
      usTafMaxCtl.input.value = st.usTafMax;
      if (st.mode === 'd1') renderD1();
      else if (st.mode === 'd2') renderD2();
      else if (st.mode === 'd3') renderD3();
      else if (st.mode === 'd4') renderD4();
      else if (st.mode === 'd5') renderD5();
      else renderD6();
      var cs = chartsByMode[st.mode] || [];
      requestAnimationFrame(function () { cs.forEach(function (c) { c.resize(); }); });
    }

    function apply(patch) {
      patch = patch || {};
      Object.assign(st, patch);
      prepare(st.mode);
      if (st.mode === 'd3') setupQueue();
      if (st.mode === 'd4') runSweep();
      if (st.mode === 'd5') runPressure(patch.pressure || 'base');
      sync();
    }

    sync();

    return {
      apply: apply,
      destroy: function () {
        Object.keys(chartsByMode).forEach(function (k) { chartsByMode[k].forEach(function (c) { c.destroy(); }); });
      }
    };
  }

  /* Module-scoped styles, injected once. */
  function injectStyle() {
    if (document.getElementById('sml-d-styles')) return;
    var s = document.createElement('style');
    s.id = 'sml-d-styles';
    s.textContent = [
      '.d-stage{display:flex;flex-direction:column;flex:1;min-height:0;gap:8px;position:relative}',
      '.d-two{display:grid;grid-template-columns:1.06fr .94fr;gap:8px;flex:1;min-height:0}',
      '.d-col{display:flex;flex-direction:column;gap:8px;min-height:0;min-width:0}',
      '.d-card{border:1px solid var(--line);border-radius:10px;background:var(--panel-2);display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden}',
      '.d-card-head{flex:none;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--line-soft);font-family:var(--mono);font-size:9px;letter-spacing:.13em;color:var(--dim)}',
      '.d-card-head span:last-child{color:var(--dim);letter-spacing:.08em}',
      '.d-card-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:6px;padding:8px 10px;overflow:auto}',
      '.d-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;flex:none}',
      '.d-kpi{border:1px solid var(--line-soft);border-radius:7px;padding:5px 8px;background:var(--panel-3);min-width:0}',
      '.d-kpi span{display:block;font-size:8.5px;letter-spacing:.06em;color:var(--dim);font-family:var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.d-kpi b{display:block;font-family:var(--mono);font-size:12.5px;font-weight:560;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.d-kpi.hi b{color:var(--cyan)}',
      '.d-ladder{display:flex;flex-direction:column;gap:1px;font-family:var(--mono);font-size:10.5px}',
      '.d-lad-head,.d-lad-row{display:grid;grid-template-columns:42px 64px 58px minmax(0,1fr);gap:6px;align-items:center;padding:3px 6px}',
      '.d-lad-head{font-size:8.5px;color:var(--dim);letter-spacing:.08em;padding-bottom:2px}',
      '.d-lad-row{border-radius:5px}',
      '.d-lad-row .n{color:var(--dim);font-size:9.5px}',
      '.d-lad-row .p{font-size:11.5px}',
      '.d-lad-row .q{text-align:right;color:var(--muted)}',
      '.d-lad-row.ask .p{color:var(--orange)}',
      '.d-lad-row.bid .p{color:var(--cyan)}',
      '.d-lad-row.hot{background:color-mix(in srgb,var(--yellow) 15%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--yellow) 50%,transparent)}',
      '.d-lad-row.hit{background:color-mix(in srgb,var(--cyan) 8%,transparent)}',
      '.d-lad-bar{height:6px;border-radius:4px;background:var(--panel-3);overflow:hidden}',
      '.d-lad-bar em{display:block;height:100%;border-radius:4px}',
      '.d-lad-row.ask .d-lad-bar em{background:color-mix(in srgb,var(--orange) 70%,transparent)}',
      '.d-lad-row.bid .d-lad-bar em{background:color-mix(in srgb,var(--cyan) 65%,transparent)}',
      '.d-spread-row{display:flex;justify-content:space-between;align-items:center;gap:6px;margin:4px 0;padding:4px 8px;border-top:1px dashed var(--line);border-bottom:1px dashed var(--line);font-family:var(--mono);font-size:9px;color:var(--dim)}',
      '.d-spread-row b{color:var(--yellow);font-weight:560;letter-spacing:.04em}',
      '.d-last-row{display:flex;justify-content:space-between;align-items:baseline;gap:6px;margin-top:4px;padding:5px 8px;border-radius:6px;background:var(--panel-3);font-family:var(--mono);font-size:9.5px;color:var(--dim)}',
      '.d-last-row b{font-size:15px;color:var(--text);font-weight:560}',
      '.d-callout{border:1px solid var(--line-soft);border-left:2px solid var(--cyan);border-radius:0 8px 8px 0;background:var(--panel-2);padding:7px 10px;font-size:10.5px;line-height:1.6;color:var(--muted);flex:none}',
      '.d-callout b{color:var(--text);font-weight:600}',
      '.d-result{font-size:10.5px;color:var(--muted);display:flex;flex-direction:column;gap:7px;line-height:1.5}',
      '.d-scroll{flex:1;min-height:0;overflow:auto;padding:8px 10px}',
      '.d-empty{font-size:10.5px;color:var(--dim);line-height:1.6;padding:6px 2px}',
      '.d-empty.small{padding:4px 2px}',
      '.d-statusline{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.d-status-msg{font-size:10px;color:var(--dim);flex:1;min-width:120px}',
      '.d-pill{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-family:var(--mono);font-size:9px;letter-spacing:.06em;border:1px solid var(--line);color:var(--muted);white-space:nowrap}',
      '.d-pill.ok,.d-pill.filled{color:var(--green);border-color:color-mix(in srgb,var(--green) 45%,transparent);background:color-mix(in srgb,var(--green) 10%,transparent)}',
      '.d-pill.part{color:var(--yellow);border-color:color-mix(in srgb,var(--yellow) 45%,transparent);background:color-mix(in srgb,var(--yellow) 10%,transparent)}',
      '.d-pill.rest{color:var(--blue);border-color:color-mix(in srgb,var(--blue) 45%,transparent);background:color-mix(in srgb,var(--blue) 10%,transparent)}',
      '.d-pill.rej{color:var(--red);border-color:color-mix(in srgb,var(--red) 45%,transparent);background:color-mix(in srgb,var(--red) 10%,transparent)}',
      '.d-pill.press{color:var(--cyan);border-color:color-mix(in srgb,var(--cyan) 45%,transparent)}',
      '.d-tag{display:inline-block;font-family:var(--mono);font-size:8.5px;letter-spacing:.05em;padding:1px 6px;border-radius:4px;border:1px solid var(--line);color:var(--dim)}',
      '.d-tag.ok{color:var(--green);border-color:color-mix(in srgb,var(--green) 40%,transparent)}',
      '.d-tag.part{color:var(--yellow);border-color:color-mix(in srgb,var(--yellow) 40%,transparent)}',
      '.d-tag.rest{color:var(--blue);border-color:color-mix(in srgb,var(--blue) 40%,transparent)}',
      '.d-tag.rej{color:var(--red);border-color:color-mix(in srgb,var(--red) 40%,transparent)}',
      '.d-legend{display:flex;flex-wrap:wrap;gap:5px}',
      '.d-kv-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px 10px}',
      '.d-kv-grid div{display:flex;justify-content:space-between;gap:6px;border-bottom:1px dashed var(--line-soft);padding:2px 0;font-size:10px}',
      '.d-kv-grid span{color:var(--dim)}',
      '.d-kv-grid b{font-family:var(--mono);font-weight:550}',
      '.d-note-line{font-size:10px;color:var(--dim);line-height:1.55}',
      '.d-note-line b{color:var(--text);font-weight:600}',
      '.d-warn-line{font-size:10px;color:var(--orange);line-height:1.55;background:color-mix(in srgb,var(--orange) 8%,transparent);border-radius:6px;padding:5px 7px}',
      '.d-formula{font-family:var(--mono);font-size:9px;line-height:1.6;color:var(--dim);background:var(--panel-3);border-radius:6px;padding:6px 8px}',
      '.d-tbl{overflow:auto;max-height:180px}',
      '.d-tbl .ptable{font-size:9.5px}',
      '.d-tbl .ptable td,.d-tbl .ptable th{padding:2px 4px}',
      '.d-mini{font-family:var(--mono);font-size:9px}',
      '.d-mini.ok{color:var(--green)}.d-mini.part{color:var(--yellow)}.d-mini.rest{color:var(--blue)}.d-mini.rej{color:var(--red)}',
      '.d-qhead{display:flex;gap:16px;flex:none;padding:2px 0 6px}',
      '.d-qhead div{display:flex;flex-direction:column;gap:1px}',
      '.d-qhead span{font-size:9px;color:var(--dim);font-family:var(--mono)}',
      '.d-qhead b{font-family:var(--mono);font-size:13px;font-weight:560}',
      '.d-qrow{display:grid;grid-template-columns:38px minmax(0,1.4fr) 58px 54px 54px;gap:6px;align-items:center;padding:5px 6px;border-radius:5px;font-family:var(--mono);font-size:10px;border-bottom:1px solid var(--line-soft)}',
      '.d-qrow.qhead{border-bottom:1px solid var(--line);color:var(--dim);font-size:8.5px;letter-spacing:.05em}',
      '.d-qrow .pos{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--panel-3);color:var(--muted);font-size:9px}',
      '.d-qrow .id{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.d-qrow .fill{color:var(--green)}',
      '.d-qrow.done{opacity:.45}',
      '.d-depth{display:flex;flex-direction:column;gap:2px;font-family:var(--mono);font-size:10px}',
      '.d-depth-head{display:grid;grid-template-columns:52px 58px 56px minmax(0,1fr);gap:6px;font-size:8.5px;color:var(--dim);padding:0 4px 2px}',
      '.d-depth-row{display:grid;grid-template-columns:52px 58px 56px minmax(0,1fr);gap:6px;align-items:center;padding:3px 4px;border-radius:4px}',
      '.d-depth-row>span:first-child{color:var(--dim);font-size:9.5px}',
      '.d-depth-row .p{font-size:11px}',
      '.d-depth-row .q{text-align:right;color:var(--muted)}',
      '.d-depth-row.ask .p{color:var(--orange)}',
      '.d-depth-row.bid .p{color:var(--cyan)}',
      '.d-depth-row .bar{height:7px;border-radius:4px;background:var(--panel-3);overflow:hidden}',
      '.d-depth-row .bar em{display:block;height:100%}',
      '.d-depth-row.ask .bar em{background:color-mix(in srgb,var(--orange) 72%,transparent)}',
      '.d-depth-row.bid .bar em{background:color-mix(in srgb,var(--cyan) 68%,transparent)}',
      '.d-depth-mid{display:flex;justify-content:space-between;gap:8px;margin:3px 0;padding:4px 6px;border-top:1px dashed var(--line);border-bottom:1px dashed var(--line);color:var(--dim);font-size:9px}',
      '.d-depth-mid b{color:var(--text);font-weight:560}',
      '.d-press-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
      '.d-fees{display:flex;flex-direction:column;gap:8px;flex:1;min-height:0}',
      '.d-fees>.d-two{flex:none;max-height:390px}',
      '.d-fee-card{padding:6px 10px 8px;overflow:auto;display:flex;flex-direction:column;gap:3px}',
      '.d-fee-sec{font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;color:var(--dim);margin-top:4px}',
      '.d-fee-card .ptable{font-size:9.5px}',
      '.d-fee-card .ptable td,.d-fee-card .ptable th{padding:2px 4px}',
      '.d-fee-total{display:flex;justify-content:space-between;align-items:baseline;gap:8px;border-top:1px solid var(--line);margin-top:4px;padding-top:4px;font-size:10.5px;color:var(--muted)}',
      '.d-fee-total b{font-family:var(--mono);font-size:13px;color:var(--cyan);font-weight:560}',
      '.d-toast{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);background:var(--panel-3);border:1px solid var(--line);border-radius:8px;padding:7px 12px;font-size:10.5px;color:var(--text);z-index:5;box-shadow:var(--shadow-sm)}',
      '.d-readout{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin-top:8px;padding-top:7px;border-top:1px dashed var(--line)}',
      '.d-readout div{display:flex;justify-content:space-between;gap:8px;font-family:var(--mono);font-size:9px;color:var(--dim)}',
      '.d-readout b{color:var(--muted);font-weight:550;white-space:nowrap}',
      '.d-hintbox{margin-top:8px;padding:7px 9px;border:1px solid var(--line-soft);border-radius:7px;background:var(--panel-3);font-size:10px;line-height:1.6;color:var(--dim)}',
      '.d-hintbox b{color:var(--text);font-weight:600}',
      '.d-subhead{margin:10px 0 4px;padding-top:7px;border-top:1px solid var(--line);font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;color:var(--dim)}',
      '.d-lad-row .q .d-filled{display:block;font-style:normal;font-size:7.5px;color:var(--green);line-height:1.2}',
      '.d-alloc{margin-top:8px;padding-top:7px;border-top:1px dashed var(--line)}',
      '.d-alloc-head{display:flex;justify-content:space-between;gap:8px;font-family:var(--mono);font-size:8.5px;color:var(--dim);margin-bottom:4px}',
      '.d-alloc-bar{display:flex;height:18px;border-radius:4px;overflow:hidden;background:var(--panel-3)}',
      '.d-alloc-bar .seg{display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:8px;color:var(--bg);background:color-mix(in srgb,var(--cyan) 62%,transparent);border-right:1px solid var(--panel-2)}',
      '.d-alloc-bar .seg.alt{background:color-mix(in srgb,var(--blue) 62%,transparent)}',
      '.d-alloc-note{font-size:9px;color:var(--dim);line-height:1.5;margin-top:4px}',
      '.d-trade-log{margin-top:6px;max-height:150px;overflow:auto}',
      '.d-trade-log .ptable{font-size:9px}',
      '.d-trade-log .ptable td,.d-trade-log .ptable th{padding:2px 4px}',
      '@media (max-width:900px){.d-two{grid-template-columns:1fr}.d-kpis{grid-template-columns:repeat(2,1fr)}.d-fees>.d-two{max-height:none}.d-lad-head,.d-lad-row{grid-template-columns:40px 62px 52px minmax(0,1fr)}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  SM.registerModule({
    id: 'D', slug: 'order-book', order: 4,
    title: '订单簿与撮合', en: 'ORDER BOOK',
    subtitle: '五档盘口、排队撮合、市价扫盘与交易成本',
    hint: '拖动价格与数量、点击提交，观察委托进入哪一侧的队列，以及成交价如何逐档变化。',
    scenes: [
      {
        title: '盘口：还没成交的意愿',
        body: '五档买盘从<b>买一</b>往下排，五档卖盘从<b>卖一</b>往上排。买一是最高买价，卖一最低卖价，两者之差是<b>价差</b>。<br>买一永远低于卖一：若相等或交叉，它们当场就成交了，不会留在盘口。',
        patch: { mode: 'd1', mid: 100 },
        guide: '看价格列与深度条：价差是多少？中间价落在哪里？',
        duration: 12000
      },
      {
        title: '提交一张限价单',
        body: '限价买单价格高于卖一就立即成交，低于卖一则进入买盘排队。<br>盘口会用<b>黄色高亮</b>标出你的委托所在价位，状态显示全部成交、部分成交或挂单中；超出涨跌停范围的报价会被直接拒绝。',
        patch: { mode: 'd2', mid: 100, side: 'buy', type: 'limit', price: 100, qty: 500, useLimits: true },
        guide: '试试点「填入卖一价」再提交；然后把价格拖到 111 元，观察拒绝原因。',
        duration: 13000
      },
      {
        title: '同价排队：时间优先',
        body: '三笔同价卖单按到达顺序排队：200 股、300 股、400 股，单号和时间就是它们的顺序。<br>一笔 350 股的穿价买单先吃掉队首 200 股，再吃第二笔的 150 股——价格相同，<strong>先到先成交</strong>。',
        patch: { mode: 'd3', queuePrice: null, crossQty: 350 },
        guide: '看每一行的“已成交/剩余”：队尾的 400 股完全没动。',
        duration: 13000
      },
      {
        title: '市价单扫盘',
        body: '市价买入 9,000 股会从<b>卖一</b>开始逐档吃单，成交价一档比一档高。<br>平均成交价减去卖一价，就是这一单的<strong>滑点</strong>。如果数量大于五档总量，剩余部分会被<strong>撤销</strong>——市价单不挂单。',
        patch: { mode: 'd4', sweepQty: 9000 },
        guide: '把数量调到 40,000 股再执行，观察“部分成交 + 剩余撤销”。',
        duration: 13000
      },
      {
        title: '压力测试：买盘厚 ≠ 会涨',
        body: '买方压力用市价单吃掉卖盘，再用限价单把大额买单挂在买盘。最新价只被真正成交的部分推高，挂着的买单<strong>不会自动抬价</strong>。<br>卖方压力与交易稀疏是另外两种状态，注意比较价差与深度。',
        patch: { mode: 'd5', pressure: 'buy' },
        guide: '依次点击三种压力，比较“压力前/压力后”的最新价、价差与买卖盘总量。',
        duration: 14000
      },
      {
        title: '交易成本：A 股与美股',
        body: 'A 股买入通常有佣金和过户费，卖出再加<b>印花税</b>；美股常见零佣金，但卖出可能有 SEC 监管费与 FINRA TAF。<br>往返成本率决定了价格要涨多少才“回本”，最低佣金会显著抬高小额交易的成本率。',
        patch: { mode: 'd6' },
        guide: '把 A 股数量改成 100 股，看最低 5 元佣金如何把成本率抬高。',
        duration: 14000
      }
    ],
    quiz: [
      {
        q: '盘口买一 10.00 元、卖一 10.02 元。你提交 10.02 元的限价买单 100 股，成交价最可能是？',
        options: ['10.00 元', '10.01 元', '10.02 元', '10.03 元'],
        answer: 2,
        explain: '限价买价 ≥ 卖一时，按卖一价成交：<b>10.02 元</b>。你愿意出的最高价不是成交价，卖方的最低要价才是。'
      },
      {
        q: '同一价位上，A 先挂了 200 股卖单，B 后挂了 300 股。一笔 250 股买单到达，如何成交？',
        options: ['A 成交 200 股，B 成交 50 股', 'B 成交 250 股', 'A、B 按比例各成交 125 股', '无法成交'],
        answer: 0,
        explain: '价格相同，按<b>时间优先</b>：A 的 200 股先全部成交，剩下的 50 股才轮到 B。'
      },
      {
        q: '盘口卖一到卖三合计只有 4,000 股，你提交市价买入 5,000 股。剩余 1,000 股会怎样？',
        options: ['挂在买一价', '挂在卖一价', '自动撤销', '变成 1,000 股新股'],
        answer: 2,
        explain: '市价单只吃对手盘，不挂单。成交 4,000 股后剩余 1,000 股<b>撤销</b>，状态为部分成交。'
      }
    ],
    mount: mount
  });
})();
