/* Exercise actual module mounts and UI setters without a GPU. Rendering is
 * stubbed; model state passed into the 3D layer must follow lesson patches. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function node() {
  return { style: {}, children: [], classList: { add() {}, remove() {}, toggle() {} },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {}, setAttribute() {}, querySelector() { return this.valueNode ||= {}; } };
}
const states = {};
const chart = () => ({ update() {}, redraw() {}, destroy() {} });
const context = { console, document: { createElement: node } };
context.window = context;
context.DL = { charts: { base: chart, gauge: chart, bars: chart },
  registerModule(def) { this.modules[def.id] = def; }, modules: {},
  gl: Object.fromEntries(['osmosis', 'spiralRO', 'plant'].map(name => [name, (host, state) => { states[name] = state; return { destroy() {} }; }])) };
vm.createContext(context);
for (const file of ['core.js', 'reference.js', 'simulations.js', 'ui.js', 'modules/b-osmosis.js', 'modules/c-ro.js', 'modules/g-plant.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context, { filename: file });
}
const mounted = {};
for (const id of ['B', 'C', 'G']) mounted[id] = context.DL.modules[id].mount({ stage: node(), panel: node() });
mounted.B.apply({ headToPi: true });
assert.equal(states.osmosis().direction, 'balance');
mounted.B.apply({ headOverPi: true });
assert.equal(states.osmosis().direction, 'out');
mounted.B.apply({ tds: 70000, temp: 45, headOverPi: true });
assert.equal(states.osmosis().direction, 'out');
mounted.B.apply({ head: 0 });
assert.equal(states.osmosis().direction, 'in');
mounted.C.apply({ pressure: 40 });
assert.equal(states.spiralRO().feasible, false);
assert.equal(states.spiralRO().flux, 0);
mounted.C.apply({ pressure: 85, recovery: 50 });
assert.equal(states.spiralRO().feasible, true);
assert.equal(states.spiralRO().recovery, 0.5);
const before = states.plant().brineTds;
mounted.G.apply({ recovery: 55 });
assert.equal(states.plant().recovery, 0.55);
assert.ok(states.plant().brineTds > before);
Object.values(mounted).forEach(instance => instance.destroy());
console.log('PASS: B equilibrium/reversal, C pressure/flux, G recovery/brine follow lesson patches.');
