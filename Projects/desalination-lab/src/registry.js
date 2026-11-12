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
})();
