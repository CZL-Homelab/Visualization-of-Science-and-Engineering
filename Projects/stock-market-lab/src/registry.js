/* Module registry — loaded before the module files so each module can call
 * SM.registerModule() at parse time. app.js consumes SM.modules. */
(function () {
  'use strict';
  var SM = window.SM = window.SM || {};
  SM.modules = [];
  SM.registerModule = function (def) {
    if (!def || !def.id) throw new Error('registerModule: missing id');
    if (SM.modules.some(function (m) { return m.id === def.id; })) {
      throw new Error('registerModule: duplicate id ' + def.id);
    }
    SM.modules.push(def);
  };
})();
