#!/usr/bin/env node
/*
 * Packaging checks for Stock Market Lab.
 *
 * The deliverable is a single offline HTML file. This test makes sure the
 * generated file has no remote dependencies, keeps the documented anchors,
 * and really contains all ten registered modules.
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

console.log('\nStock Market Lab packaging checks\n');

ok('the entry point starts with a doctype and has the expected title', () => {
  assert.ok(/^<!doctype html>/i.test(html.trim()), 'missing doctype');
  assert.ok(/<html[^>]+lang="zh-CN"/.test(html), 'lang should be zh-CN');
  assert.ok(html.includes('股票市场原理实验室'), 'Chinese title missing');
  assert.ok(/<title>[^<]*Stock Market Lab|<title>[^<]*股票市场/.test(html), 'title tag missing');
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

ok('no build placeholders or source links survive the build', () => {
  ['{{PROJECT_CARDS}}', '<!-- SITE_ICON -->', '<!-- BRAND_ICON -->', '<!-- LAB_SCRIPTS -->', '/* LAB_STYLES */', '<!-- COURSE_PANEL -->']
    .forEach((token) => assert.ok(!html.includes(token), 'leftover token: ' + token));
  assert.ok(!/<script[^>]+src=["']src\//i.test(html), 'source-relative script found');
});

ok('the interactive lab anchors exist', () => {
  ['lab', 'stageBody', 'modulePanel', 'rulesTable', 'mythList', 'importFile', 'quizMount', 'heroChart', 'indexStrip']
    .forEach((id) => assert.ok(html.includes('id="' + id + '"'), 'missing #' + id));
  assert.ok(html.includes('id="themeToggle"'), 'missing theme toggle');
  assert.ok(html.includes('id="downloadPage"'), 'missing offline download control');
});

ok('all ten modules are registered', () => {
  const matches = html.match(/SM\.registerModule\(/g) || [];
  assert.ok(matches.length >= 10, 'expected 10 registerModule calls, found ' + matches.length);
  const slugs = ['basics', 'kline', 'indicators', 'order-book', 'market-rules', 'ipo', 'valuation', 'leverage', 'etf', 'compare'];
  slugs.forEach((slug) => assert.ok(html.includes("slug: '" + slug + "'"), 'missing module slug ' + slug));
});

ok('the page is a single, substantial document', () => {
  assert.ok(html.length > 150000, 'generated page is unexpectedly small: ' + html.length);
  assert.ok(html.length < 3.5e6, 'generated page is unexpectedly large: ' + html.length);
  assert.ok((html.match(/<canvas/g) || []).length === 0 || !html.includes('<canvas src='), 'canvas must be inline');
});

ok('module sources each register exactly one module with a quiz and scenes', () => {
  const files = fs.readdirSync(path.join(ROOT, 'src/modules')).filter((f) => f.endsWith('.js'));
  assert.strictEqual(files.length, 10, 'expected 10 module files, found ' + files.length);
  const ids = new Set();
  files.forEach((file) => {
    const src = fs.readFileSync(path.join(ROOT, 'src/modules', file), 'utf8');
    const regs = src.match(/SM\.registerModule\(/g) || [];
    assert.strictEqual(regs.length, 1, file + ' should register exactly one module');
    const m = src.match(/id:\s*'([A-J])'/);
    assert.ok(m, file + ' missing module id');
    assert.ok(!ids.has(m[1]), 'duplicate module id ' + m[1]);
    ids.add(m[1]);
    assert.ok(/scenes:\s*\[/.test(src), file + ' missing scenes');
    assert.ok(/quiz:\s*\[/.test(src), file + ' missing quiz');
  });
  assert.deepStrictEqual([...ids].sort(), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
});

console.log('\n' + passed + ' packaging checks passed\n');
