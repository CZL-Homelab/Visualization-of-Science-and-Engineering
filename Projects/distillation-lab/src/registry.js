/* Module registry — loaded before the module files so each module can call
 * DL.registerModule() at parse time. app.js consumes DL.modules. */
(function () {
  'use strict';
  var DL = window.DL = window.DL || {};
  DL.modules = [];
  DL.registerModule = function (def) {
    if (!def || !def.id) throw new Error('registerModule: missing id');
    if (DL.modules.some(function (m) { return m.id === def.id; })) {
      throw new Error('registerModule: duplicate id ' + def.id);
    }
    DL.modules.push(def);
  };
  // Shared event bus (imported data, cross-module links).
  var busMap = {};
  DL.bus = {
    on: function (k, fn) { (busMap[k] = busMap[k] || []).push(fn); },
    off: function (k, fn) { busMap[k] = (busMap[k] || []).filter(function (f) { return f !== fn; }); },
    emit: function (k, payload) { (busMap[k] || []).forEach(function (fn) { try { fn(payload); } catch (e) { console.error(e); } }); }
  };
  DL.data = { custom: null };

  /** Systems offered in selectors; includes imported data when present. */
  DL.systemOptions = function (opts) {
    opts = opts || {};
    var list = [
      { value: 'bt', label: '苯–甲苯' },
      { value: 'hh', label: '己烷–庚烷' },
      { value: 'ew', label: '乙醇–水' }
    ];
    if (opts.max) list.push({ value: 'ac', label: '丙酮–氯仿' });
    if (opts.alpha !== false) list.push({ value: 'alpha', label: '恒定 α' });
    if (opts.custom !== false && DL.data.custom) list.push({ value: 'custom', label: '导入数据' });
    return list;
  };
  /** Build an equilibrium object for a selector value. P in kPa. */
  DL.eqFor = function (sys, Pkpa, alpha) {
    var T = DL.thermo;
    if (sys === 'custom' && DL.data.custom) {
      return T.makeEq({ id: 'custom', name: '导入数据', model: 'table', table: DL.data.custom, tableKey: DL.data.custom.key });
    }
    if (sys === 'custom') sys = 'bt';
    return T.makeEq(sys, { P: T.mmHg(Pkpa || 101.325), alpha: alpha });
  };
})();
