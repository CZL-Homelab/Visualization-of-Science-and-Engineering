/* Module registry: every module file registers exactly one module. */
'use strict';
window.ENGINE_MODULES = [];
function registerModule(mod) {
  if (!mod || !mod.id || !Array.isArray(mod.scenes) || !mod.quiz) throw new Error('invalid module: ' + (mod && mod.id));
  window.ENGINE_MODULES.push(mod);
}
