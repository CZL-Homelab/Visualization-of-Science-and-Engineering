/* Module A — vapour–liquid equilibrium: vapour pressure, bubble and dew points,
 * the two-phase region and lever rule, relative volatility and azeotropes. */
(function () {
  'use strict';
  var DL = window.DL;
  var ui = DL.ui, T = DL.thermo, plot = DL.plot;

  // mode: 'bubble' (heat a liquid of composition z), 'dew' (cool a vapour of
  // composition z) or 'heat' (follow z from subcooled liquid to superheated
  // vapour; heat = 0 at the bubble point, 1 at the dew point).
  var DEFAULT = { sys: 'bt', alpha: 2.5, P: 101.325, x: 0.4, view: 'txy', right: 'xy', mode: 'bubble', heat: 0.5 };
  var NMIN = function (a) { return a > 1.0001 ? T.fenske(0.95, 0.05, a) : Infinity; };

  function mount(ctx) {
    var st = Object.assign({}, DEFAULT);
    var stage = ctx.stage, panel = ctx.panel;
    var eq = null, cur = null;

    var row = ui.el('div', 'stage-row c2');
    var leftHost = ui.el('div'), rightHost = ui.el('div');
    row.appendChild(leftHost); row.appendChild(rightHost);
    var cards = ui.el('div', 'cards');
    var note = ui.el('p', 'stage-note');
    stage.appendChild(row); stage.appendChild(cards); stage.appendChild(note);

    var left = plot.chart(leftHost, {
      label: '温度–组成相图或蒸气压曲线', title: '<b id="aLeftTitle">T–x–y</b>',
      x: { min: 0, max: 1 }, y: { min: 60, max: 120 },
      hover: function (x, y) {
        if (st.view === 'psat') {
          var p1 = T.kPa(T.psat(eq.sys.light, x)), p2 = T.kPa(T.psat(eq.sys.heavy, x));
          return { html: 'T = ' + x.toFixed(1) + ' °C<br>' + T.COMPONENTS[eq.sys.light].name + ' p* = ' + p1.toFixed(1) + ' kPa<br>' + T.COMPONENTS[eq.sys.heavy].name + ' p* = ' + p2.toFixed(1) + ' kPa<br>p₁*/p₂* = ' + (p1 / p2).toFixed(2), vx: x };
        }
        if (!eq.hasT) return null;
        var Tb = eq.T(x), Td = eq.Tdew(x);
        var lo = Math.min(Tb, Td), hi = Math.max(Tb, Td);
        var region = y < lo ? '过冷液体（低于泡点）' : y > hi ? '过热蒸汽（高于露点）' : '气液两相';
        return { html: 'z = ' + x.toFixed(3) + '　T = ' + y.toFixed(1) + ' °C<br><b>' + region + '</b><br>泡点 ' + Tb.toFixed(1) + ' °C · 露点 ' + Td.toFixed(1) + ' °C', vx: x };
      }
    });
    var right = plot.chart(rightHost, {
      label: 'x–y 平衡曲线或相对挥发度随组成的变化', square: true, title: '<b id="aRightTitle">x–y 图</b>',
      x: { min: 0, max: 1, label: '液相 x（轻组分）' }, y: { min: 0, max: 1, label: '气相 y' },
      hover: function (x) {
        var xx = Math.max(0.001, Math.min(0.999, x)), y = eq.y(xx);
        var html = 'x = ' + xx.toFixed(3) + '<br>y* = ' + y.toFixed(3) + '<br>α = ' + eq.alpha(xx).toFixed(3);
        if (st.right === 'alpha') return { html: html, marks: [[xx, eq.alpha(xx), 'var(--cyan)']] };
        return { html: html, marks: [[xx, y, 'var(--cyan)']] };
      }
    });

    var cardRefs = {};
    [['tb', '泡点 T_bub'], ['td', '露点 T_dew'], ['alpha', '相对挥发度 α'], ['four', '沸程']].forEach(function (c) {
      var el = ui.el('div', 'card', '<span>' + c[1] + '</span><b>—</b><small></small>');
      cards.appendChild(el); cardRefs[c[0]] = el;
    });
    function setCard(k, label, v, sub, tone) {
      var el = cardRefs[k];
      if (label) el.querySelector('span').textContent = label;
      el.querySelector('b').textContent = v; el.querySelector('small').textContent = sub || '';
      el.className = 'card' + (tone ? ' ' + tone : '');
    }

    /* panel */
    var gS = ui.section(panel, '体系', 'SYSTEM');
    var sysCtl = ui.seg({ options: DL.systemOptions({ max: true }), value: st.sys, onChange: function (v) { st.sys = v; sync(); } });
    gS.appendChild(sysCtl.el);
    var alphaCtl = ui.slider({ label: '相对挥发度 α', min: 1.05, max: 8, step: 0.05, value: st.alpha, onInput: function (v) { st.alpha = v; sync(); } });
    gS.appendChild(alphaCtl.el);
    var gV = ui.section(panel, '图', 'VIEW');
    var viewCtl = ui.seg({ label: '左图', options: [{ value: 'txy', label: 'T–x–y 相图' }, { value: 'psat', label: '蒸气压曲线' }], value: st.view, onChange: function (v) { st.view = v; sync(); } });
    var rightCtl = ui.seg({ label: '右图', options: [{ value: 'xy', label: 'x–y 图' }, { value: 'alpha', label: 'α 随组成' }], value: st.right, onChange: function (v) { st.right = v; sync(); } });
    gV.appendChild(viewCtl.el); gV.appendChild(rightCtl.el);
    var gC = ui.section(panel, '条件', 'STATE');
    var PCtl = ui.slider({ label: '总压 P', min: 10, max: 1100, step: 0.5, value: st.P, unit: 'kPa', onInput: function (v) { st.P = v; sync(); } });
    var xCtl = ui.slider({ label: '组成 z（轻组分摩尔分数）', min: 0, max: 1, step: 0.01, value: st.x, onInput: function (v) { st.x = v; sync(); } });
    gC.appendChild(PCtl.el); gC.appendChild(xCtl.el);
    gC.appendChild(ui.row([20, 101.325, 500, 1000].map(function (p) { return ui.button(p === 101.325 ? '1 atm' : p + ' kPa', function () { st.P = p; sync(); }, 'sm'); })));
    var aspenNote = ui.note('乙醇–水在 20 / 101.3 / 500 / 1000 kPa 下，图上的白色圆点是 Aspen Plus V15（NRTL）的计算结果，可直接与曲线对照。');
    gC.appendChild(aspenNote);

    var gO = ui.section(panel, '观察', 'FOCUS');
    var modeCtl = ui.seg({ options: [{ value: 'bubble', label: '泡点' }, { value: 'dew', label: '露点' }, { value: 'heat', label: '加热全过程' }], value: st.mode, onChange: function (v) { st.mode = v; sync(); } });
    gO.appendChild(modeCtl.el);
    var heatCtl = ui.slider({ label: '加热温度 T', min: 60, max: 120, step: 0.1, value: 90, unit: '°C', onInput: function (v) {
      if (!cur || !isFinite(cur.Tb)) return;
      var span = cur.Td - cur.Tb;
      st.heat = Math.abs(span) < 1e-6 ? (v >= cur.Tb ? 1 : 0) : (v - cur.Tb) / span;
      sync();
    } });
    gO.appendChild(heatCtl.el);
    var modeNote = ui.note('');
    gO.appendChild(modeNote);

    var gM = ui.section(panel, '读数', 'LIVE');
    var m = ui.metrics([
      { key: 'p1', label: '泡点下轻组分 p₁*' }, { key: 'p2', label: '泡点下重组分 p₂*' },
      { key: 'pp1', label: '轻组分分压 x₁γ₁p₁*' }, { key: 'pp2', label: '重组分分压 x₂γ₂p₂*' },
      { key: 'K', label: 'K₁ = y/x · K₂' }, { key: 'gam', label: '活度系数 γ₁ / γ₂' },
      { key: 'ratio', label: 'p₁*/p₂*（理想溶液的 α）' }, { key: 'nmin', label: '最少理论级 N_min（5%→95%）' }
    ]);
    gM.appendChild(m.el);
    var formula = ui.formula('');
    gM.appendChild(formula);
    var warn = ui.warn(''); gM.appendChild(warn);
    var gR = ui.section(panel);
    gR.appendChild(ui.row([ui.reset(function () { Object.assign(st, DEFAULT); sync(); })]));
    gR.appendChild(ui.note('气相按理想气体；液相用 Raoult 定律、NRTL（乙醇–水，Aspen Plus V15 APV150 参数）或 van Laar（丙酮–氯仿，由 1 atm 恒沸点反算）。N_min 用 Fenske 式和当前组成下的 α 估算。'));

    function aspenSet() {
      if (st.sys !== 'ew' || !DL.aspen) return null;
      var keys = Object.keys(DL.aspen.txy);
      for (var i = 0; i < keys.length; i++) if (Math.abs(+keys[i] - st.P) / +keys[i] < 0.005) return DL.aspen.txy[keys[i]];
      return null;
    }
    // Everything the drawings, cards and narration need for the current state.
    function compute() {
      var z = st.x, c = { z: z, y: eq.y(z), xd: eq.x(z), a: eq.alpha(z) };
      c.K1 = c.y / Math.max(z, 1e-9); c.K2 = (1 - c.y) / Math.max(1 - z, 1e-9);
      if (eq.hasT) {
        c.b = T.bubble(eq.sys, z, T.mmHg(st.P));
        c.Tb = c.b.T; c.Td = eq.Tdew(z);
        c.ratio = c.b.p1 / c.b.p2;
        c.Theat = c.Tb + st.heat * (c.Td - c.Tb);
        if (st.heat <= 0) c.phase = 'liquid';
        else if (st.heat >= 1) c.phase = 'vapour';
        else {
          var tie = T.tieLine(eq, c.Theat, z);
          c.phase = 'two';
          if (tie) { c.xL = tie.x; c.yV = tie.y; c.VF = tie.VF; }
        }
      }
      return c;
    }

    function drawLeft() {
      var titleEl = document.getElementById('aLeftTitle');
      if (st.view === 'psat' && eq.hasT) {
        var tl = eq.tbLight, th = eq.tbHeavy;
        var Tmin = Math.floor((Math.min(tl, th) - 45) / 10) * 10, Tmax = Math.ceil((Math.max(tl, th) + 25) / 10) * 10;
        left.setAxes({ min: Tmin, max: Tmax, label: '温度 T / °C' }, { min: 2, max: 500, log: true, label: '饱和蒸气压 / kPa（对数）', fmt: function (v) { return String(v); } });
        if (titleEl) titleEl.textContent = 'ANTOINE 蒸气压曲线';
        left.draw(function (g) {
          g.grid().open();
          var a = [], b = [];
          for (var t = Tmin; t <= Tmax; t += 1) { a.push([t, T.kPa(T.psat(eq.sys.light, t))]); b.push([t, T.kPa(T.psat(eq.sys.heavy, t))]); }
          g.path(a, { c: 'var(--cyan)', w: 2.2 });
          g.path(b, { c: 'var(--orange)', w: 2.2 });
          g.hline(st.P, { c: 'var(--text)', w: 1, dash: '4 3' });
          g.text(Tmin, st.P, '系统压力 ' + st.P.toFixed(1) + ' kPa', { dx: 6, dy: -6, c: 'var(--text)', size: 10 });
          g.dot(tl, st.P, { c: 'var(--cyan)' }); g.dot(th, st.P, { c: 'var(--orange)' });
          g.text(tl, st.P, T.COMPONENTS[eq.sys.light].name + ' ' + tl.toFixed(1) + '°', { dx: -4, dy: 16, anchor: 'end', c: 'var(--cyan)' });
          g.text(th, st.P, T.COMPONENTS[eq.sys.heavy].name + ' ' + th.toFixed(1) + '°', { dx: 4, dy: 16, c: 'var(--orange)' });
          if (cur && isFinite(cur.Tb)) {
            var p1 = T.kPa(cur.b.p1), p2 = T.kPa(cur.b.p2);
            g.vline(cur.Tb, { c: 'var(--yellow)', w: 1, dash: '3 3' });
            g.line(cur.Tb, p2, cur.Tb, p1, { c: 'var(--yellow)', w: 3, op: 0.75 });
            g.dot(cur.Tb, p1, { c: 'var(--cyan)', r: 4.5 }); g.dot(cur.Tb, p2, { c: 'var(--orange)', r: 4.5 });
            g.text(cur.Tb, p2, 'p₁*/p₂* = ' + cur.ratio.toFixed(2), { dx: -9, dy: 14, anchor: 'end', c: 'var(--yellow)', size: 10.5 });
            g.text(cur.Tb, 2, 'z = ' + st.x.toFixed(2) + ' 的泡点 ' + cur.Tb.toFixed(1) + '°', { dx: 4, dy: -6, c: 'var(--yellow)', size: 9.5 });
          }
          g.close();
          g.label(g.area.x0 + 8, g.area.y0 + 14, '对数坐标：两线的竖直间距 = ln(p₁*/p₂*)', { c: 'var(--muted)', size: 9.5, sans: true });
        });
      } else if (eq.hasT) {
        var Ts = eq.Ts.filter(isFinite);
        var lo = Math.min.apply(null, Ts), hi = Math.max.apply(null, Ts);
        var pad = Math.max(3, (hi - lo) * 0.12);
        left.setAxes({ min: 0, max: 1, label: 'x 或 y（轻组分摩尔分数）' }, { min: Math.floor(lo - pad), max: Math.ceil(hi + pad), label: '温度 T / °C' });
        if (titleEl) titleEl.textContent = 'T–x–y · ' + st.P.toFixed(1) + ' kPa';
        left.draw(function (g) {
          plot.txy(g, eq, {});
          var ad = aspenSet();
          g.open();
          if (ad) ad.forEach(function (p, i) { if (i % 2) return; g.dot(p[0], p[2], { c: 'var(--text)', r: 2.6, sw: 1 }); g.dot(p[1], p[2], { c: 'var(--text)', r: 2.6, sw: 1 }); });
          if (eq.azeotrope) { g.dot(eq.azeotrope.x, eq.azeotrope.T, { c: 'var(--red)', r: 4.5 }); g.text(eq.azeotrope.x, eq.azeotrope.T, '恒沸点', { dy: eq.azeotrope.type === 'min' ? 16 : -9, anchor: 'middle', c: 'var(--red)' }); }
          var c = cur, z = st.x, lab = { size: 10 };
          var leftSide = z > 0.55;
          g.line(z, g.ymin, z, g.ymax, { c: 'var(--yellow)', w: 1, dash: '2 4', op: 0.65 });
          if (st.mode === 'bubble') {
            g.line(z, g.ymin, z, c.Tb, { c: 'var(--blue)', w: 2, op: 0.55 });
            g.line(z, c.Tb, c.y, c.Tb, { c: 'var(--text)', w: 1.3, dash: '4 3' });
            g.dot(z, c.Tb, { c: 'var(--blue)', r: 5 }); g.dot(c.y, c.Tb, { c: 'var(--orange)', r: 5 });
            if (Math.abs(c.y - z) < 0.01) {
              g.text(z, c.Tb, '恒沸：y* = z，泡点 = 露点 ' + c.Tb.toFixed(1) + '°', Object.assign({ dy: -27, anchor: 'middle', c: 'var(--red)' }, lab));
            } else {
            g.text(z, c.Tb, '泡点 ' + c.Tb.toFixed(1) + '°', Object.assign({ dx: leftSide ? 8 : -8, dy: 14, anchor: leftSide ? 'start' : 'end', c: 'var(--blue)' }, lab));
            g.text(c.y, c.Tb, '第一个气泡 y* = ' + c.y.toFixed(3), Object.assign({ dx: c.y > 0.82 ? -6 : c.y < 0.18 ? 6 : 0, dy: -11, anchor: c.y > 0.82 ? 'end' : c.y < 0.18 ? 'start' : 'middle', c: 'var(--orange)' }, lab));
            }
          } else if (st.mode === 'dew') {
            g.line(z, g.ymax, z, c.Td, { c: 'var(--orange)', w: 2, op: 0.55 });
            g.line(c.xd, c.Td, z, c.Td, { c: 'var(--text)', w: 1.3, dash: '4 3' });
            g.dot(z, c.Td, { c: 'var(--orange)', r: 5 }); g.dot(c.xd, c.Td, { c: 'var(--blue)', r: 5 });
            if (Math.abs(c.xd - z) < 0.01) {
              g.text(z, c.Td, '恒沸：x* = z，露点 = 泡点 ' + c.Td.toFixed(1) + '°', Object.assign({ dy: -27, anchor: 'middle', c: 'var(--red)' }, lab));
            } else {
            g.text(z, c.Td, '露点 ' + c.Td.toFixed(1) + '°', Object.assign({ dx: 8, dy: -9, c: 'var(--orange)' }, lab));
            g.text(c.xd, c.Td, '第一滴液体 x* = ' + c.xd.toFixed(3), Object.assign({ dx: c.xd > 0.82 ? -6 : c.xd < 0.18 ? 6 : 0, dy: 19, anchor: c.xd > 0.82 ? 'end' : c.xd < 0.18 ? 'start' : 'middle', c: 'var(--blue)' }, lab));
            }
          } else {
            g.dot(z, c.Tb, { c: 'var(--blue)', r: 3.5 }); g.dot(z, c.Td, { c: 'var(--orange)', r: 3.5 });
            if (g.W > 520) {
              g.text(z, c.Tb, '泡点', { dx: -7, dy: 4, anchor: 'end', c: 'var(--blue)', size: 9.5 });
              g.text(z, c.Td, '露点', { dx: 7, dy: 4, c: 'var(--orange)', size: 9.5 });
            }
            if (c.phase === 'two' && c.xL != null) {
              g.line(c.xL, c.Theat, c.yV, c.Theat, { c: 'var(--text)', w: 1.4 });
              g.line(c.xL, c.Theat, z, c.Theat, { c: 'var(--orange)', w: 5, op: 0.35 });
              g.line(z, c.Theat, c.yV, c.Theat, { c: 'var(--blue)', w: 5, op: 0.35 });
              g.dot(c.xL, c.Theat, { c: 'var(--blue)', r: 4.5 }); g.dot(c.yV, c.Theat, { c: 'var(--orange)', r: 4.5 });
              g.text(c.xL, c.Theat, '液 x = ' + c.xL.toFixed(3), { dx: -6, dy: 15, anchor: 'end', c: 'var(--blue)', size: 9.5 });
              g.text(c.yV, c.Theat, '气 y = ' + c.yV.toFixed(3), { dx: 6, dy: 15, c: 'var(--orange)', size: 9.5 });
              g.text(z, c.Theat, 'V/F = ' + c.VF.toFixed(2), { dy: -12, anchor: 'middle', c: 'var(--text)', size: 10.5 });
            } else {
              g.text(z, c.Theat, c.phase === 'liquid' ? '过冷液体' : '过热蒸汽', { dx: 9, dy: 4, c: 'var(--text)', size: 10 });
            }
            g.dot(z, c.Theat, { c: 'var(--yellow)', r: 5.5 });
          }
          g.close();
          if (ad) g.label(g.area.x0 + 8, g.area.y0 + 14, '● Aspen Plus V15 · NRTL', { c: 'var(--text)', size: 10, sans: true });
          g.label(g.area.x1 - 8, g.area.y0 + 30, '露点线（蒸汽开始冷凝）', { anchor: 'end', c: 'var(--orange)', size: 9.5, sans: true });
          g.label(g.area.x1 - 8, g.area.y1 - 8, '泡点线（液体开始沸腾）', { anchor: 'end', c: 'var(--blue)', size: 9.5, sans: true });
        });
      } else {
        left.setAxes({ min: 0, max: 1 }, { min: 0, max: 1 });
        if (titleEl) titleEl.textContent = '无温度信息';
        left.draw(function (g) {
          g.label(g.W / 2, g.H / 2 - 6, st.sys === 'alpha' ? '恒定 α 模型只描述 x–y 关系' : '导入数据只含 x–y', { anchor: 'middle', c: 'var(--muted)', size: 12, sans: true });
          g.label(g.W / 2, g.H / 2 + 14, '选择真实体系可查看泡点、露点与蒸气压', { anchor: 'middle', c: 'var(--dim)', size: 10.5, sans: true });
        });
      }
    }

    function alphaPoints() {
      var pts = [], ideal = [];
      for (var i = 0; i <= 120; i++) {
        var x = 0.002 + 0.996 * i / 120;
        pts.push([x, eq.alpha(x)]);
        if (eq.hasT && eq.sys.model !== 'ideal') {
          var Tb = eq.T(x);
          ideal.push([x, T.psat(eq.sys.light, Tb) / T.psat(eq.sys.heavy, Tb)]);
        }
      }
      return { pts: pts, ideal: ideal };
    }
    function drawRight() {
      var t = document.getElementById('aRightTitle');
      var c = cur, z = st.x;
      if (st.right === 'alpha') {
        var ap = alphaPoints();
        var all = ap.pts.concat(ap.ideal).map(function (p) { return p[1]; }).filter(isFinite);
        var amin = Math.min.apply(null, all.concat([1])), amax = Math.max.apply(null, all.concat([1]));
        var lo = Math.max(0.2, amin * 0.85), hi = Math.max(1.5, amax * 1.15), useLog = hi / lo > 6;
        right.setOpts({ square: false });
        right.setAxes({ min: 0, max: 1, label: '液相 x（轻组分）' }, useLog
          ? { min: Math.pow(10, Math.floor(Math.log10(lo) * 2) / 2), max: Math.pow(10, Math.ceil(Math.log10(hi) * 2) / 2), log: true, label: '相对挥发度 α（对数）', fmt: function (v) { return String(v); } }
          : { min: Math.floor(lo * 10) / 10, max: Math.ceil(hi * 10) / 10, label: '相对挥发度 α' });
        if (t) t.textContent = 'α 随液相组成的变化';
        right.draw(function (g) {
          g.grid().open();
          g.hline(1, { c: 'var(--red)', w: 1.2, dash: '5 4' });
          if (ap.ideal.length) g.path(ap.ideal, { c: 'var(--dim)', w: 1.4, dash: '3 3' });
          g.path(ap.pts, { c: 'var(--cyan)', w: 2.4 });
          g.dot(z, c.a, { c: 'var(--yellow)', r: 5 });
          g.text(z, c.a, 'α = ' + c.a.toFixed(2), { dx: z > 0.7 ? -8 : 8, dy: -9, anchor: z > 0.7 ? 'end' : 'start', c: 'var(--text)', size: 10.5 });
          g.close();
          var leftFar = Math.abs(Math.log(eq.alpha(0.12))) >= Math.abs(Math.log(eq.alpha(0.88)));
          g.label(leftFar ? g.area.x0 + 8 : g.area.x1 - 8, g.sy(1) - 6, 'α = 1：y = x，无法分离', { anchor: leftFar ? 'start' : 'end', c: 'var(--red)', size: 9.5, sans: true });
          if (ap.ideal.length) g.label(g.area.x0 + 8, g.area.y0 + 14, '虚线：若是理想溶液，α = p₁*/p₂*', { c: 'var(--muted)', size: 9.5, sans: true });
        });
        return;
      }
      right.setOpts({ square: true });
      right.setAxes({ min: 0, max: 1, label: '液相 x（轻组分）' }, { min: 0, max: 1, label: '气相 y' });
      if (t) t.textContent = 'x–y 图 · ' + (eq.azeotrope ? '曲线穿过对角线' : 'α ≈ ' + eq.alpha(0.5).toFixed(2));
      right.draw(function (g) {
        g.grid().open();
        g.line(0, 0, 1, 1, { c: 'var(--dim)', w: 1, dash: '3 4' });
        if (st.sys === 'alpha') {
          [1.2, 1.5, 2, 3, 5].forEach(function (a) {
            if (Math.abs(a - st.alpha) < 0.05) return;
            var ref = [];
            for (var i = 0; i <= 50; i++) { var xx = i / 50; ref.push([xx, a * xx / (1 + (a - 1) * xx)]); }
            g.path(ref, { c: 'var(--dim)', w: 1, op: 0.6 });
            var xm = 0.32; g.text(xm, a * xm / (1 + (a - 1) * xm), 'α ' + a, { dx: -4, dy: -3, anchor: 'end', c: 'var(--dim)', size: 9 });
          });
        } else if (st.sys !== 'custom' && !eq.azeotrope) {
          var a = eq.alpha(0.5), ref = [];
          for (var j = 0; j <= 50; j++) { var x2 = j / 50; ref.push([x2, a * x2 / (1 + (a - 1) * x2)]); }
          g.path(ref, { c: 'var(--dim)', w: 1, dash: '2 3' });
        }
        g.path(plot.eqPoints(eq), { c: 'var(--cyan)', w: 2.4 });
        var ad = aspenSet();
        if (ad) ad.forEach(function (p, i) { if (i % 2 === 0) g.dot(p[0], p[1], { c: 'var(--text)', r: 2.6, sw: 1 }); });
        var px = z, py = c.y, label = '(' + z.toFixed(2) + ', ' + c.y.toFixed(3) + ')';
        if (st.mode === 'dew') { px = c.xd; py = z; label = '第一滴液体 (' + c.xd.toFixed(3) + ', ' + z.toFixed(2) + ')'; }
        else if (st.mode === 'heat' && c.phase === 'two' && c.xL != null) { px = c.xL; py = c.yV; label = '两相 (' + c.xL.toFixed(3) + ', ' + c.yV.toFixed(3) + ')'; }
        else if (st.mode === 'bubble') label = '第一个气泡 (' + z.toFixed(2) + ', ' + c.y.toFixed(3) + ')';
        g.line(px, 0, px, py, { c: 'var(--blue)', w: 1, dash: '3 3' });
        g.line(0, py, px, py, { c: 'var(--orange)', w: 1, dash: '3 3' });
        g.dot(px, py, { c: 'var(--yellow)', r: 5 });
        g.text(px, py, label, { dx: px > 0.55 ? -8 : 8, dy: px > 0.55 ? -10 : 14, anchor: px > 0.55 ? 'end' : 'start', c: 'var(--text)' });
        if (eq.azeotrope) {
          g.dot(eq.azeotrope.x, eq.azeotrope.x, { c: 'var(--red)', r: 5 });
          g.text(eq.azeotrope.x, eq.azeotrope.x, '恒沸 ' + eq.azeotrope.x.toFixed(3), { dx: -8, dy: -10, anchor: 'end', c: 'var(--red)' });
        }
        g.close();
      });
    }

    function sync() {
      if (st.sys === 'custom' && !DL.data.custom) st.sys = 'bt';
      eq = DL.eqFor(st.sys, st.P, st.alpha);
      sysCtl.set(st.sys); viewCtl.set(st.view); rightCtl.set(st.right); modeCtl.set(st.mode);
      alphaCtl.el.style.display = st.sys === 'alpha' ? '' : 'none';
      PCtl.el.style.display = eq.hasT ? '' : 'none';
      aspenNote.style.display = st.sys === 'ew' ? '' : 'none';
      [[alphaCtl, st.alpha], [PCtl, st.P], [xCtl, st.x]].forEach(function (p) { p[0].set(p[1], true); });
      cur = compute();
      var c = cur;
      heatCtl.el.style.display = st.mode === 'heat' && eq.hasT ? '' : 'none';
      if (eq.hasT) {
        var lo = Math.floor((c.Tb - 8) * 10) / 10, hi = Math.ceil((c.Td + 8) * 10) / 10;
        heatCtl.setRange(lo, hi);
        heatCtl.set(Math.max(lo, Math.min(hi, c.Theat)), true);
      }
      modeNote.innerHTML = st.mode === 'bubble' ? '把组成为 z 的<b>液体</b>慢慢加热：泡点处冒出第一个气泡。'
        : st.mode === 'dew' ? '把组成为 z 的<b>蒸汽</b>慢慢冷却：露点处凝出第一滴液体。'
        : '拖动温度，看组成为 z 的混合物从过冷液体、两相，到过热蒸汽。';
      drawLeft(); drawRight();

      var nmin = NMIN(c.a);
      if (eq.hasT) {
        setCard('tb', '泡点 T_bub', c.Tb.toFixed(2) + ' °C', '第一个气泡 y* = ' + c.y.toFixed(3), st.mode === 'bubble' ? 'hi' : '');
        setCard('td', '露点 T_dew', c.Td.toFixed(2) + ' °C', '第一滴液体 x* = ' + c.xd.toFixed(3), st.mode === 'dew' ? 'warm' : '');
      } else {
        setCard('tb', '泡点 T_bub', '—', '第一个气泡 y* = ' + c.y.toFixed(3), st.mode === 'bubble' ? 'hi' : '');
        setCard('td', '露点 T_dew', '—', '第一滴液体 x* = ' + c.xd.toFixed(3), st.mode === 'dew' ? 'warm' : '');
      }
      setCard('alpha', '相对挥发度 α', c.a.toFixed(3), 'K₁ / K₂ = ' + c.K1.toFixed(3) + ' / ' + c.K2.toFixed(3), Math.abs(c.a - 1) < 0.02 ? 'bad' : '');
      if (st.mode === 'heat' && eq.hasT) {
        var vf = c.phase === 'liquid' ? 0 : c.phase === 'vapour' ? 1 : c.VF;
        setCard('four', '汽化分率 V/F', vf == null ? '—' : vf.toFixed(2),
          c.phase === 'liquid' ? '低于泡点：全部是液体' : c.phase === 'vapour' ? '高于露点：全部是蒸汽' : c.xL != null ? '液 x = ' + c.xL.toFixed(3) + ' · 气 y = ' + c.yV.toFixed(3) : '两相', 'hi');
      } else if (eq.hasT) {
        var gap = Math.abs(c.Td - c.Tb) < 0.005 ? 0 : c.Td - c.Tb;
        setCard('four', '沸程 T_dew − T_bub', gap.toFixed(2) + ' K', Math.abs(gap) < 0.05 ? '泡点 = 露点，像纯物质' : '在一段温度内逐渐汽化', '');
      } else {
        setCard('four', '最少理论级 N_min', isFinite(nmin) ? nmin.toFixed(1) : '∞', '全回流下从 5% 提到 95%', 'warm');
      }

      if (c.b) {
        m.set({
          p1: T.kPa(c.b.p1).toFixed(2) + ' kPa', p2: T.kPa(c.b.p2).toFixed(2) + ' kPa',
          pp1: T.kPa(st.x * c.b.g[0] * c.b.p1).toFixed(2) + ' kPa', pp2: T.kPa((1 - st.x) * c.b.g[1] * c.b.p2).toFixed(2) + ' kPa',
          K: c.K1.toFixed(3) + ' · ' + c.K2.toFixed(3), gam: c.b.g[0].toFixed(3) + ' / ' + c.b.g[1].toFixed(3),
          ratio: c.ratio.toFixed(3), nmin: isFinite(nmin) ? nmin.toFixed(1) + ' 级' : '∞（α ≤ 1）'
        });
      } else m.set({ p1: '—', p2: '—', pp1: '—', pp2: '—', K: c.K1.toFixed(3) + ' · ' + c.K2.toFixed(3), gam: '—', ratio: '—', nmin: isFinite(nmin) ? nmin.toFixed(1) + ' 级' : '∞（α ≤ 1）' });

      var f = [];
      if (eq.hasT) {
        if (st.mode === 'bubble') f.push('泡点：Σ x<sub>i</sub>γ<sub>i</sub>p<sub>i</sub>*(T) = P = <b>' + st.P.toFixed(1) + ' kPa</b>　→　y<sub>i</sub> = x<sub>i</sub>γ<sub>i</sub>p<sub>i</sub>*/P');
        else if (st.mode === 'dew') f.push('露点：Σ y<sub>i</sub>P / (γ<sub>i</sub>p<sub>i</sub>*(T)) = 1　→　x<sub>i</sub> = y<sub>i</sub>P / (γ<sub>i</sub>p<sub>i</sub>*)');
        else f.push('杠杆规则：V/F = (z − x)/(y − x)，x、y 是同一温度连结线两端的组成');
      }
      f.push('K<sub>i</sub> = y<sub>i</sub>/x<sub>i</sub>　α = K₁/K₂ = (y/x)/((1−y)/(1−x))' + (eq.hasT ? ' = γ₁p₁*/(γ₂p₂*)' : ''));
      f.push('平衡线：y = αx / (1 + (α − 1)x)　Fenske：N<sub>min</sub> = ln[(0.95/0.05)²] / ln α');
      formula.innerHTML = f.join('<br>');

      var w = [];
      if (eq.azeotrope) w.push('恒沸点 x = ' + eq.azeotrope.x.toFixed(3) + '、' + (isFinite(eq.azeotrope.T) ? eq.azeotrope.T.toFixed(2) + ' °C' : '') + '：此处 α = 1、y = x，泡点与露点重合，普通精馏无法越过。');
      if (eq.hasT && eq.sys.model === 'vanlaar' && Math.abs(st.P - 101.325) > 30) w.push('丙酮–氯仿的 van Laar 参数在 1 atm 拟合，当前压力下恒沸组成只示意趋势。');
      if (aspenSet()) w.push('与 Aspen Plus V15 对照：本页曲线与 Aspen 结果的泡点温度相差 ≤ 0.21 °C，气相组成相差 ≤ 0.0024。');
      warn.innerHTML = w.join('<br>'); warn.style.display = w.length ? '' : 'none';

      if (!eq.hasT) {
        note.innerHTML = 'α = ' + c.a.toFixed(2) + ' 时，z = ' + st.x.toFixed(2) + ' 的液体与 y* = <b>' + c.y.toFixed(3) + '</b> 的蒸汽平衡。全回流下从 5% 提纯到 95% 至少需要 <b>' + (isFinite(nmin) ? nmin.toFixed(1) : '∞') + '</b> 个理论级——α 越接近 1，需要的级数越多。';
      } else if (st.mode === 'bubble') {
        note.innerHTML = '在 <b>' + st.P.toFixed(1) + ' kPa</b> 下，组成 ' + st.x.toFixed(2) + ' 的液体加热到 <b>' + c.Tb.toFixed(1) + ' °C</b> 时，各组分分压之和刚好等于总压，冒出第一个气泡，其组成 y* = <b>' + c.y.toFixed(3) + '</b>。' +
          (c.y > st.x + 1e-4 ? '气泡比液体更富含易挥发组分——这就是一切精馏的出发点。' : '此时气泡并不比液体更“轻”，单靠汽化无法继续提浓。');
      } else if (st.mode === 'dew') {
        note.innerHTML = '组成 ' + st.x.toFixed(2) + ' 的蒸汽冷却到 <b>' + c.Td.toFixed(1) + ' °C</b> 凝出第一滴液体，组成 x* = <b>' + c.xd.toFixed(3) + '</b>' +
          (c.xd < st.x - 1e-4 ? '，比蒸汽更富含难挥发组分。同一组成下露点比泡点高 ' + (c.Td - c.Tb).toFixed(1) + ' K。' : '。');
      } else {
        note.innerHTML = c.phase === 'liquid' ? '在 ' + c.Theat.toFixed(1) + ' °C，混合物还低于泡点 ' + c.Tb.toFixed(1) + ' °C，全部是过冷液体。'
          : c.phase === 'vapour' ? '在 ' + c.Theat.toFixed(1) + ' °C，已高于露点 ' + c.Td.toFixed(1) + ' °C，全部是过热蒸汽，组成又回到 z = ' + st.x.toFixed(2) + '。'
          : '在 <b>' + c.Theat.toFixed(1) + ' °C</b>，混合物分成两相：液相 x = <b>' + (c.xL != null ? c.xL.toFixed(3) : '—') + '</b>、气相 y = <b>' + (c.yV != null ? c.yV.toFixed(3) : '—') + '</b>，按杠杆规则已有 <b>' + (c.VF != null ? (c.VF * 100).toFixed(0) : '—') + '%</b> 汽化。继续加热，两相都变得更贫轻组分。';
      }
    }
    function apply(p) { Object.assign(st, p || {}); sync(); }
    sync();
    return { apply: apply, destroy: function () { left.destroy(); right.destroy(); } };
  }

  DL.registerModule({
    id: 'A', slug: 'vle', order: 1,
    title: '气液平衡', en: 'VAPOUR–LIQUID EQUILIBRIUM',
    subtitle: '蒸气压、泡点与露点、两相区、相对挥发度与恒沸',
    hint: '拖动组成 z，切换“泡点 / 露点 / 加热全过程”，两张图显示同一个平衡状态。',
    scenes: [
      {
        title: '两种液体，两条蒸气压曲线',
        body: '苯和甲苯各自的饱和蒸气压随温度指数上升（Antoine 方程）。在<b>任何温度</b>下苯的蒸气压都更高——它更“易挥发”。虚线是系统压力，曲线与它的交点就是各自的沸点：80.1 °C 与 110.6 °C。',
        patch: { sys: 'bt', P: 101.325, x: 0.4, view: 'psat', right: 'xy', mode: 'bubble' },
        guide: '在左图上移动鼠标，读出同一温度下两者的蒸气压。', duration: 12000
      },
      {
        title: '泡点：液体冒出第一个气泡',
        body: '把苯含量 z = 0.40 的<b>液体</b>慢慢加热（左图竖直蓝线）。升到 <b>95.1 °C</b> 时，苯的分压 0.40 × 157.5 = 63.0 kPa 加上甲苯的分压 0.60 × 63.9 = 38.3 kPa，正好等于 101.3 kPa 的总压，液体开始沸腾——这个温度叫<b>泡点</b>。第一个气泡里苯占 <b>0.622</b>，比液体富得多。',
        patch: { sys: 'bt', P: 101.325, x: 0.4, view: 'txy', right: 'xy', mode: 'bubble' },
        guide: '右侧读数里的两个分压相加，就是总压。', duration: 14000
      },
      {
        title: '露点：蒸汽凝出第一滴液体',
        body: '反过来，把苯含量 0.40 的<b>蒸汽</b>慢慢冷却（左图竖直橙线）。到 <b>101.5 °C</b> 时凝出第一滴液体，这个温度叫<b>露点</b>。这滴液体里苯只有 <b>0.216</b>：难挥发的甲苯优先冷凝。露点条件是 Σ y<sub>i</sub>P / p<sub>i</sub>* = 1。',
        patch: { sys: 'bt', P: 101.325, x: 0.4, view: 'txy', right: 'xy', mode: 'dew' },
        guide: '右图黄点：第一滴液体 x* 与 y = 0.40 的蒸汽互相平衡。', duration: 13000
      },
      {
        title: '两条线、三个区域',
        body: '把每个组成的泡点连起来是下方的<b>泡点线</b>（液相线），露点连起来是上方的<b>露点线</b>（气相线）。线下是过冷液体，线上是过热蒸汽，两线之间是气液两相区。z = 0.40 时露点比泡点高 6.3 K：混合物不在一个温度沸腾，而是在一段<b>沸程</b>里逐渐汽化。两条线在 x = 0 和 1 处会合——纯物质的泡点就是露点，也就是沸点。',
        patch: { sys: 'bt', P: 101.325, x: 0.4, view: 'txy', right: 'xy', mode: 'heat', heat: -0.4 },
        guide: '黄点在泡点线以下：92.6 °C 时还是过冷液体。', duration: 15000
      },
      {
        title: '两相区：连结线与杠杆规则',
        body: '加热到泡点与露点之间（98.3 °C），混合物分成共存的两相：同一温度的水平<b>连结线</b>左端是液相（苯 0.304），右端是气相（苯 0.516）。总物料守恒给出<b>杠杆规则</b> V/F = (z − x)/(y − x) = (0.40 − 0.304)/(0.516 − 0.304) ≈ 0.45：约 45% 已经汽化。',
        patch: { sys: 'bt', P: 101.325, x: 0.4, view: 'txy', right: 'xy', mode: 'heat', heat: 0.5 },
        guide: '拖动“加热温度”，看液相、气相与汽化分率一起变化。', duration: 15000
      },
      {
        title: '从泡点到露点，两相都在变贫',
        body: '继续加热到 101.2 °C：液相苯降到 0.225，气相降到 0.412，已有 94% 汽化。液相沿泡点线下滑，气相沿露点线下滑；到露点时最后一滴液体（苯 0.216）消失，蒸汽组成回到 0.40。<b>一次部分汽化</b>得到的蒸汽总比液体富，但两者都离纯物质很远——要从 0.40 提到 0.95，就得把汽化与冷凝重复很多次，这就是精馏。',
        patch: { sys: 'bt', P: 101.325, x: 0.4, view: 'txy', right: 'xy', mode: 'heat', heat: 0.95 },
        guide: '右图黄点沿平衡线移动：每个温度对应一对平衡的 x 与 y。', duration: 15000
      },
      {
        title: '相对挥发度：两个 K 值之比',
        body: '每个组分在气液两相间的分配用 <b>K = y/x</b> 表示：泡点下苯 K₁ = 0.622/0.40 = 1.555，甲苯 K₂ = 0.378/0.60 = 0.630。两者之比就是<b>相对挥发度</b> α = K₁/K₂ ≈ 2.47：气相里苯与甲苯的比值是液相里的 2.47 倍。对理想溶液 α = p₁*/p₂*，左图黄色竖线连起泡点温度下的两个蒸气压：157.5 / 63.9 ≈ 2.47。',
        patch: { sys: 'bt', P: 101.325, x: 0.4, view: 'psat', right: 'xy', mode: 'bubble' },
        guide: '对数坐标上，两条蒸气压曲线的竖直间距就是 ln α。', duration: 16000
      },
      {
        title: 'α 随组成缓慢变化',
        body: '右图换成 α 随液相组成的曲线。苯–甲苯是理想溶液，α 只随泡点温度变化：苯很稀时约 2.35，接近纯苯时约 2.60——越靠近轻组分一端温度越低，α 越大。全程变化约 11%，所以设计计算常用一个平均 α 近似。',
        patch: { sys: 'bt', P: 101.325, x: 0.4, view: 'txy', right: 'alpha', mode: 'bubble' },
        guide: '拖动组成 z，黄点沿 α 曲线移动。', duration: 13000
      },
      {
        title: 'α 决定需要多少级',
        body: 'α 越接近 1，x–y 曲线越贴近对角线，每一级能提浓的幅度越小。全回流下把 5% 提到 95%，至少需要 N<sub>min</sub> = ln(19²) / ln α 个理论级（Fenske 式）：α = 2.5 约 6.4 级，α = 1.5 约 14.5 级，α = 1.2 约 32 级，α = 1.05 约 121 级。',
        patch: { sys: 'alpha', alpha: 1.2, x: 0.4, right: 'xy', mode: 'bubble' },
        guide: '拖动 α，看卡片里“最少理论级”的变化；灰线是其他 α 的平衡线。', duration: 15000
      },
      {
        title: '压力改变沸点，也改变 α',
        body: '把总压降到 <b>20 kPa</b>：整张相图向下平移约 45–50 °C。低温下苯–甲苯的 α 从约 2.5 增至约 3.0——这是减压精馏除保护热敏物外的另一个好处（模块 G）。',
        patch: { sys: 'bt', P: 20, x: 0.5, view: 'txy', right: 'alpha', mode: 'bubble' },
        guide: '比较 101.3 kPa 与 20 kPa 下的泡点和 α 曲线。', duration: 12000
      },
      {
        title: '正偏差：乙醇–水的最低恒沸物',
        body: '乙醇与水分子间作用力弱于各自内部（γ &gt; 1），蒸气压偏高。x–y 曲线在 <b>x ≈ 0.9</b> 处穿过对角线（文献 0.894），T–x–y 图上出现一个最低点：<b>最低恒沸物</b>，约 78.15 °C，比纯乙醇还低。白点是 Aspen Plus V15 的 NRTL 计算结果。',
        patch: { sys: 'ew', P: 101.325, x: 0.5, view: 'txy', right: 'xy', mode: 'bubble' },
        guide: '把 z 拖过 0.894，看 y* 与 z 的大小关系翻转。', duration: 14000
      },
      {
        title: '恒沸点：α = 1，泡点等于露点',
        body: '乙醇–水的 α 变化剧烈：乙醇很稀时高达 12.6，x = 0.5 时 1.93，在恒沸点 x ≈ 0.897 处正好等于 1，再往上小于 1——乙醇反而成了“难挥发”的一方。虚线是假如它们是理想溶液的 α = p₁*/p₂*，始终约 2.2–2.3：差别全部来自活度系数 γ。恒沸点上泡点等于露点，混合物像纯物质一样在一个温度沸腾。',
        patch: { sys: 'ew', P: 101.325, x: 0.3, view: 'txy', right: 'alpha', mode: 'bubble' },
        guide: '把 z 拖到 0.9 附近，左图的泡点与露点几乎重合。', duration: 16000
      },
      {
        title: '负偏差：丙酮–氯仿的最高恒沸物',
        body: '丙酮与氯仿之间形成氢键（γ &lt; 1），蒸气压偏低。恒沸点在 x ≈ 0.34、约 64.5 °C，<b>高于</b>两个纯组分的沸点——普通精馏时它会留在塔底。在 x &lt; 0.34 一侧 α &lt; 1，丙酮反而比氯仿难挥发。',
        patch: { sys: 'ac', P: 101.325, x: 0.34, view: 'txy', right: 'xy', mode: 'bubble' },
        guide: '找到 T–x–y 图上的最高点。', duration: 13000
      }
    ],
    mount: mount
  });
})();
