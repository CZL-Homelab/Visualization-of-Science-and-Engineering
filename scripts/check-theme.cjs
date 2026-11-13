/* Theme behavior, using the actual shared source and a minimal browser surface. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/theme.js'), 'utf8');
function browser({light = true, saved = {}, blocked = false} = {}) {
  const listeners = {}, mediaListeners = [], stored = new Map(Object.entries(saved)), buttonListeners = [];
  const icon = {}, label = {}, attrs = {}, meta = {}, root = {dataset: {}};
  const button = {querySelector: s => s === '.theme-icon' ? icon : label,
    setAttribute: (k,v) => {attrs[k] = v;}, addEventListener: (k,fn) => {if(k==='click')buttonListeners.push(fn);} };
  const media = {matches: light, addEventListener: (k,fn) => mediaListeners.push(fn)};
  const context = {document: {documentElement: root, currentScript: {dataset: {light: '#fafafa',dark: '#181818',event: 'chart:theme'}},
    querySelector: () => meta, getElementById: () => button},
    localStorage: {getItem(k){if(blocked)throw Error('storage disabled');return stored.get(k)??null;},
      setItem(k,v){if(blocked)throw Error('storage disabled');stored.set(k,v);},
      removeItem(k){if(blocked)throw Error('storage disabled');stored.delete(k);}},
    matchMedia: () => media,
    addEventListener(k,fn){(listeners[k] ||= []).push(fn);},
    dispatchEvent(e){(listeners[e.type]||[]).forEach(fn=>fn(e));},
    Event: class {constructor(type){this.type=type;}},
    CustomEvent: class {constructor(type,init){this.type=type;this.detail=init.detail;}}};
  context.window = context; vm.runInNewContext(source, context);
  return {root,stored,icon,label,attrs,meta,api:context.CZLLabTheme,
    click(){buttonListeners.forEach(fn=>fn());},
    system(value){media.matches=value;mediaListeners.forEach(fn=>fn({matches:value}));},
    storage(value){context.dispatchEvent({type:'storage',key:'czl-lab-theme',newValue:value});}};
}
const auto = browser(); auto.api.mount();
assert.equal(auto.root.dataset.theme,'light');assert.equal(auto.meta.content,'#fafafa');assert.equal(auto.stored.size,0);
auto.system(false);assert.equal(auto.root.dataset.theme,'dark');assert.equal(auto.attrs['aria-pressed'],'true');
auto.click();assert.equal(auto.root.dataset.theme,'light');assert.equal(auto.stored.get('czl-lab-theme'),'light');
auto.system(false);assert.equal(auto.root.dataset.theme,'light');
auto.storage('dark');assert.equal(auto.root.dataset.theme,'dark');
auto.storage(null);assert.equal(auto.root.dataset.theme,'dark');auto.system(true);assert.equal(auto.root.dataset.theme,'light');
const manual = browser({saved:{'czl-lab-theme':'dark'}});manual.api.mount();assert.equal(manual.root.dataset.theme,'dark');
manual.system(true);assert.equal(manual.root.dataset.theme,'dark');manual.api.followSystem();assert.equal(manual.root.dataset.theme,'light');
const legacy=browser({saved:{'sml.theme':'dark'}});assert.equal(legacy.root.dataset.theme,'dark');assert.equal(legacy.stored.get('czl-lab-theme'),'dark');assert.equal(legacy.stored.has('sml.theme'),false);
const denied=browser({blocked:true});denied.api.mount();assert.equal(denied.root.dataset.theme,'light');denied.click();assert.equal(denied.root.dataset.theme,'dark');denied.system(false);denied.system(true);assert.equal(denied.root.dataset.theme,'dark');
const invalid=browser({saved:{'czl-lab-theme':'unexpected'}});invalid.api.mount();assert.equal(invalid.root.dataset.theme,'light');
invalid.api.mount();invalid.click();assert.equal(invalid.root.dataset.theme,'dark');
console.log('PASS: first paint, system changes, manual persistence, cross-tab/reset, legacy migration, denied storage and single binding.');
