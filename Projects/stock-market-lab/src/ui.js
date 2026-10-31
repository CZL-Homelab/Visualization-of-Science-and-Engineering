/* Stock Market Lab — small DOM + control helpers.
 * Browser only. Keeps the 10 modules visually consistent without a framework.
 */
(function () {
  'use strict';
  var SM = window.SM = window.SM || {};

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function fmtNum(v, d, fallback) {
    if (v == null || !isFinite(v)) return fallback == null ? '—' : fallback;
    d = d == null ? 2 : d;
    return Number(v).toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  var fmt = {
    num: fmtNum,
    int: function (v) { return fmtNum(v, 0); },
    price: function (v) { return fmtNum(v, 2); },
    pct: function (v, d) {
      if (v == null || !isFinite(v)) return '—';
      var s = fmtNum(v, d == null ? 2 : d);
      return (v > 0 ? '+' : '') + s + '%';
    },
    sign: function (v) { return v > 0 ? 'up' : v < 0 ? 'down' : 'flat'; },
    compact: function (v) {
      if (v == null || !isFinite(v)) return '—';
      var a = Math.abs(v);
      if (a >= 1e12) return fmtNum(v / 1e12, 2) + ' 万亿';
      if (a >= 1e8) return fmtNum(v / 1e8, 2) + ' 亿';
      if (a >= 1e4) return fmtNum(v / 1e4, 2) + ' 万';
      return fmtNum(v, 2);
    },
    money: function (v, currency) {
      if (v == null || !isFinite(v)) return '—';
      var a = Math.abs(v);
      if (a >= 1e8) return (currency === 'USD' ? '$' : '¥') + fmtNum(v / 1e8, 2) + ' 亿';
      if (a >= 1e4) return (currency === 'USD' ? '$' : '¥') + fmtNum(v / 1e4, 2) + ' 万';
      return (currency === 'USD' ? '$' : '¥') + fmtNum(v, 2);
    },
    date: function (t) {
      var d = new Date(t);
      return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
    },
    time: function (t) {
      var d = new Date(t);
      return p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
    }
  };
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  function onChange(node, fn) {
    node.addEventListener('input', function (e) { fn(e, true); });
    node.addEventListener('change', function (e) { fn(e, false); });
  }

  /* ---------- panel sections ---------- */
  function section(panel, title, hint) {
    var g = el('div', 'pgroup');
    if (title) {
      var head = el('div', 'pgroup-title');
      head.appendChild(el('span', null, title));
      if (hint) head.appendChild(el('span', null, hint));
      g.appendChild(head);
    }
    panel.appendChild(g);
    g.body = g;
    return g;
  }

  /* ---------- slider with editable number ---------- */
  function slider(o) {
    var wrap = el('div', 'ctl');
    var top = el('div', 'ctl-top');
    var label = el('span', null, o.label);
    var numWrap = el('span', 'num-wrap');
    var input = el('input');
    input.type = 'number';
    input.min = o.min; input.max = o.max; input.step = o.step == null ? 1 : o.step;
    input.value = o.value;
    input.className = 'num-in';
    numWrap.appendChild(input);
    if (o.unit) numWrap.appendChild(el('span', 'u', o.unit));
    top.appendChild(label); top.appendChild(numWrap);
    var range = el('input');
    range.type = 'range'; range.min = o.min; range.max = o.max; range.step = o.step == null ? 1 : o.step;
    range.value = o.value;
    range.setAttribute('aria-label', o.label);
    var hint = el('div', 'note');
    if (o.hint) hint.innerHTML = o.hint; else hint.style.display = 'none';
    wrap.appendChild(top); wrap.appendChild(range); wrap.appendChild(hint);

    var state = { value: o.value, min: o.min, max: o.max };
    function clampVal(v) { return Math.min(state.max, Math.max(state.min, v)); }
    function paint(v) {
      state.value = clampVal(v);
      range.value = state.value;
      input.value = Number(state.value.toFixed(o.step && o.step < 1 ? 2 : 0));
    }
    function commit(v, fromRange) {
      var n = Number(v);
      if (!isFinite(n)) { input.classList.add('invalid'); return; }
      input.classList.remove('invalid');
      n = clampVal(n);
      paint(n);
      if (o.onInput) o.onInput(n, fromRange);
    }
    range.addEventListener('input', function () { commit(range.value, true); });
    input.addEventListener('input', function () {
      var n = Number(input.value);
      if (!isFinite(n) || n < state.min || n > state.max) { input.classList.add('invalid'); return; }
      input.classList.remove('invalid');
      range.value = n;
      state.value = n;
      if (o.onInput) o.onInput(n, false);
    });
    input.addEventListener('blur', function () {
      input.classList.remove('invalid');
      commit(input.value, false);
    });
    return {
      el: wrap,
      get: function () { return state.value; },
      set: function (v, silent) { paint(v); if (!silent && o.onInput) o.onInput(state.value, false); },
      setRange: function (lo, hi) { state.min = lo; state.max = hi; range.min = lo; range.max = hi; input.min = lo; input.max = hi; },
      input: input, range: range
    };
  }

  function select(o) {
    var wrap = el('div', 'ctl');
    var top = el('div', 'ctl-top');
    top.appendChild(el('span', null, o.label));
    var sel = el('select');
    (o.options || []).forEach(function (opt) {
      var item = typeof opt === 'string' ? { value: opt, label: opt } : opt;
      var op = el('option', null, item.label);
      op.value = item.value;
      sel.appendChild(op);
    });
    sel.value = o.value;
    sel.addEventListener('change', function () { if (o.onChange) o.onChange(sel.value); });
    wrap.appendChild(top); wrap.appendChild(sel);
    return { el: wrap, get: function () { return sel.value; }, set: function (v) { sel.value = v; }, select: sel };
  }

  function seg(o) {
    var wrap = el('div', 'ctl');
    if (o.label) wrap.appendChild(el('div', 'ctl-top', '<span>' + o.label + '</span>'));
    var box = el('div', 'seg');
    var buttons = [];
    var current = o.value;
    (o.options || []).forEach(function (opt) {
      var item = typeof opt === 'string' ? { value: opt, label: opt } : opt;
      var b = el('button', null, item.label);
      b.type = 'button';
      b.dataset.value = item.value;
      b.setAttribute('aria-pressed', item.value === o.value ? 'true' : 'false');
      b.addEventListener('click', function () {
        current = item.value;
        buttons.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        if (o.onChange) o.onChange(item.value);
      });
      buttons.push(b);
      box.appendChild(b);
    });
    wrap.appendChild(box);
    return {
      el: wrap,
      get: function () { return current; },
      set: function (v) {
        current = v;
        buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.value === String(v))); });
      }
    };
  }

  function check(o) {
    var lab = el('label', 'chk');
    var input = el('input');
    input.type = 'checkbox';
    input.checked = !!o.checked;
    input.addEventListener('change', function () { if (o.onChange) o.onChange(input.checked); });
    lab.appendChild(input);
    lab.appendChild(el('span', null, o.label));
    return { el: lab, get: function () { return input.checked; }, set: function (v) { input.checked = !!v; }, input: input };
  }

  function number(o) {
    var wrap = el('div', 'ctl');
    var top = el('div', 'ctl-top');
    top.appendChild(el('span', null, o.label));
    var input = el('input');
    input.type = 'number';
    input.value = o.value;
    input.min = o.min != null ? o.min : '';
    input.max = o.max != null ? o.max : '';
    input.step = o.step || 1;
    input.addEventListener('change', function () {
      var v = Number(input.value);
      if (o.onChange) o.onChange(v);
    });
    wrap.appendChild(top); wrap.appendChild(input);
    return { el: wrap, get: function () { return Number(input.value); }, input: input };
  }

  /* ---------- metrics ---------- */
  function metrics(items, cls) {
    var grid = el('div', 'metrics' + (cls ? ' ' + cls : ''));
    var refs = {};
    (items || []).forEach(function (m) {
      var cell = el('div', 'metric' + (m.wide ? ' wide' : '') + (m.tone ? ' ' + m.tone : ''));
      cell.appendChild(el('span', null, m.label));
      var b = el('b', null, m.value == null ? '—' : m.value);
      cell.appendChild(b);
      grid.appendChild(cell);
      refs[m.key] = cell;
    });
    return {
      el: grid,
      set: function (obj, toneMap) {
        Object.keys(obj).forEach(function (k) {
          var cell = refs[k];
          if (!cell) return;
          var v = obj[k];
          var tone = toneMap && toneMap[k];
          cell.classList.remove('pos', 'neg', 'hi');
          if (tone) cell.classList.add(tone);
          cell.querySelector('b').textContent = v == null ? '—' : v;
        });
      },
      refs: refs
    };
  }

  function formula(html) { return el('div', 'formula', html); }
  function note(html) { return el('div', 'note', html); }
  function warn(html) { return el('div', 'warn', html); }
  function ok(html) { return el('div', 'ok', html); }

  function table(head, rows, cls) {
    var t = el('table', 'ptable' + (cls ? ' ' + cls : ''));
    if (head) {
      var thead = el('thead'), tr = el('tr');
      head.forEach(function (h) { tr.appendChild(el('th', null, h)); });
      thead.appendChild(tr); t.appendChild(thead);
    }
    var tb = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr');
      r.forEach(function (c, i) {
        var td = el('td', i === 0 ? 't' : null, c == null ? '' : c);
        if (c && typeof c === 'object' && c.nodeType) { td.innerHTML = ''; td.appendChild(c); }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    return t;
  }

  function button(label, fn, cls) {
    var b = el('button', 'btn' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  function row(children, cls) {
    var r = el('div', cls || 'btn-row');
    children.forEach(function (c) { if (c) r.appendChild(c); });
    return r;
  }

  function legend(items) {
    var l = el('div', 'legend');
    items.forEach(function (i) {
      var s = el('span', null, '<i style="background:' + i.color + '"></i>' + i.label);
      l.appendChild(s);
    });
    return l;
  }

  function reset(fn, label) { return button(label || '恢复默认', fn, 'sm ghost'); }

  function download(name, text, mime) {
    var blob = new Blob([text], { type: (mime || 'text/csv') + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
  }

  function spacer(h) { var d = el('div'); d.style.height = (h || 6) + 'px'; return d; }

  SM.ui = {
    el: el, clear: clear, fmt: fmt, onChange: onChange,
    section: section, slider: slider, select: select, seg: seg, check: check, number: number,
    metrics: metrics, formula: formula, note: note, warn: warn, ok: ok,
    table: table, button: button, row: row, legend: legend, reset: reset, download: download, spacer: spacer
  };
})();
