#!/usr/bin/env node
/*
 * Packaging checks for Engine Lab.
 *
 * The deliverable is a single offline HTML file. This test makes sure the
 * generated file has no remote dependencies, keeps the documented anchors,
 * embeds all eight registered modules and wires the shared theme/navigation.
 *
 * Run after `python build.py`:  node tests/check-build.cjs
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let passed = 0;
function ok(name, fn) { fn(); passed++; console.log('  ok   ' + name); }

console.log('\n\nEngine Lab packaging checks\n');

ok('the entry point starts with a doctype and has the expected title', () => {
  assert(html.startsWith('<!doctype html>'));
  assert(html.includes('四冲程发动机原理实验室 · Engine Lab'));
});
ok('the favicon and repository identity are embedded', () => {
  assert(html.includes('rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,'));
  assert(html.includes('class="brand-mark" src="data:image/svg+xml;base64,'));
});
ok('no remote script, stylesheet, font, image or CSS import', () => {
  for (const bad of ['<script src=', '<link rel="stylesheet"', '@import url(', 'srcset=', 'fetch(', 'XMLHttpRequest']) assert(!html.includes(bad));
});
ok('no build placeholders or source links survive the build', () => {
  for (const token of ['<!-- SITE_ICON -->', '<!-- BRAND_ICON -->', '/* LAB_STYLES */', '<!-- LAB_SCRIPTS -->']) assert(!html.includes(token));
});
ok('shared theme key czl-lab-theme is read before first paint', () => {
  const head = html.slice(0, html.indexOf('</head>'));
  assert(head.includes("'czl-lab-theme'"));
});
ok('the interactive lab anchors exist', () => {
  for (const id of ['id="lab"', 'id="quiz"', 'id="limits"', 'id="scene"', 'id="moduleList"']) assert(html.includes(id));
});
ok('all eight modules are registered', () => {
  for (const id of ['anatomy', 'cycle', 'timing', 'spark', 'pv', 'cr', 'compare', 'multi']) {
    assert(html.includes("id: '" + id + "'"), id);
  }
});
ok('lab directory links every sibling lab with relative paths', () => {
  assert(html.includes('href="../motor-lab/index.html"'));
  assert(html.includes('href="../stock-market-lab/index.html"'));
  assert(html.includes('href="../index.html#projects"'));
});
ok('the page is a single, substantial document', () => {
  assert(html.length > 60000, 'expected a bundled page, got ' + html.length + ' chars');
});

console.log('\n' + passed + ' packaging checks passed\n');
