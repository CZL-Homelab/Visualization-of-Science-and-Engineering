#!/usr/bin/env node
/*
 * Packaging checks for Desalination Lab.
 *
 * The deliverable is a single offline HTML file. This test makes sure the
 * generated file has no remote dependencies, keeps the documented anchors,
 * registers all seven modules and keeps the repository-wide theme/navigation
 * conventions intact.
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
function ok(name, fn) {
  fn();
  passed++;
  console.log('  ok   ' + name);
}

console.log('\nDesalination Lab packaging checks\n');

ok('the entry point starts with a doctype and has the expected title', () => {
  assert.ok(/^<!doctype html>/i.test(html.trim()), 'missing doctype');
  assert.ok(/<html[^>]+lang="zh-CN"/.test(html), 'lang should be zh-CN');
  assert.ok(html.includes('海水淡化原理实验室'), 'Chinese title missing');
  assert.ok(/<title>[^<]*Desalination Lab|<title>[^<]*海水淡化/.test(html), 'title tag missing');
});

ok('the favicon and repository identity are embedded', () => {
  assert.ok(/rel="icon"/.test(html), 'favicon link missing');
  assert.ok(html.includes('data:image/svg+xml;base64,'), 'favicon should be an inline data URI');
  assert.ok(html.includes('CZL-Homelab/Visualization-of-Science-and-Engineering'), 'repository link missing');
});

ok('no remote script, stylesheet, font, image or CSS import', () => {
  assert.ok(!/<script[^>]+src\s*=/i.test(html), 'remote <script src> found');
  assert.ok(!/<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:/i.test(html), 'remote stylesheet found');
  assert.ok(!/@import\s+url\(\s*["']?https?:/i.test(html), 'remote @import found');
  assert.ok(!/\ssrcset\s*=/i.test(html), 'srcset found (not supported by the offline check)');
  assert.ok(!/\ssrc\s*=\s*["']https?:/i.test(html), 'remote image/script src found');
  assert.ok(!/url\(\s*["']?https?:/i.test(html), 'remote url() found');
});

ok('no build placeholders survive the build', () => {
  ['<!-- SITE_ICON -->', '<!-- BRAND_ICON -->', '<!-- LAB_SCRIPTS -->', '/* LAB_STYLES */']
    .forEach((token) => assert.ok(!html.includes(token), 'leftover token: ' + token));
  assert.ok(!/<script[^>]+src=["']src\//i.test(html), 'source-relative script found');
});

ok('all seven teaching modules register', () => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  ids.forEach((id) => {
    assert.ok(html.includes("id: '" + id + "'"), 'module ' + id + ' missing');
  });
  const count = (html.match(/DL\.registerModule\(\{/g) || []).length;
  assert.strictEqual(count, 7, 'expected 7 registerModule calls, got ' + count);
});

ok('the vendored 3D engine and motion layer are embedded', () => {
  assert.ok(html.includes('WebGLRenderer'), 'vendored three.js engine not embedded');
  assert.ok(html.includes('spiralRO'), 'WebGL scene layer not embedded');
  assert.ok(html.includes('viewtabs'), '2D/3D view switch styles missing');
});

ok('the interactive lab anchors exist', () => {
  ['lab', 'stageBody', 'modulePanel', 'rulesTable', 'mythList', 'quizMount', 'heroChart', 'indexStrip', 'sceneDots', 'directorBar']
    .forEach((id) => assert.ok(html.includes('id="' + id + '"'), 'missing #' + id));
  assert.ok(html.includes('id="themeToggle"'), 'missing theme toggle');
  assert.ok(html.includes('aria-pressed'), 'theme toggle should expose aria-pressed');
  assert.ok(html.includes('id="downloadPage"'), 'missing offline download control');
});

ok('theme and navigation follow the repository conventions', () => {
  assert.ok(html.includes('czl-lab-theme'), 'shared theme key missing');
  assert.ok(/data-theme="dark"/.test(html), 'data-theme should be set before first paint');
  assert.ok(html.includes('meta name="theme-color"'), 'theme-color meta missing');
  assert.ok(html.includes('Lab Projects'), 'header back link missing');
  assert.ok(html.includes('lab-directory'), 'pre-footer lab directory missing');
  assert.ok(html.includes('../motor-lab/index.html'), 'directory link to Motor Lab missing');
  assert.ok(html.includes('../stock-market-lab/index.html'), 'directory link to Stock Market Lab missing');
  assert.ok(html.includes('../index.html#projects'), 'catalog back link missing');
  assert.ok(html.includes('aria-current="page"'), 'current lab should be marked');
});

ok('simulated-model disclaimers are present', () => {
  assert.ok(html.includes('教学模型'), 'teaching-model disclaimer missing');
  assert.ok(html.includes('非工程仿真'), 'engineering-simulation boundary missing');
  assert.ok(html.includes('核对日期'), 'reference date missing');
});

console.log('\n' + passed + ' packaging checks passed.\n');
