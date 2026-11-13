#!/usr/bin/env node
/*
 * Packaging checks for Distillation Lab.
 *
 * The deliverable is a single offline HTML file. This test makes sure the
 * generated file has no remote dependencies, keeps the documented anchors,
 * inlines the shared theme/entrance sources, links every lab registered in
 * site/projects.json and really contains all ten registered modules.
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

console.log('\nDistillation Lab packaging checks\n');

ok('the entry point starts with a doctype and has the expected title', () => {
  assert.ok(/^<!doctype html>/i.test(html.trim()), 'missing doctype');
  assert.ok(/<html[^>]+lang="zh-CN"/.test(html), 'lang should be zh-CN');
  assert.ok(/<title>[^<]*精馏原理实验室[^<]*Distillation Lab/.test(html), 'title tag missing');
});

ok('the favicon and repository identity are embedded', () => {
  assert.ok(/rel="icon"/.test(html), 'favicon link missing');
  assert.ok(html.includes('data:image/svg+xml;base64,'), 'favicon should be an inline data URI');
  assert.ok(html.includes('CZL-Homelab/Visualization-of-Science-and-Engineering'), 'repository link missing');
});

ok('no remote script, stylesheet, font, image or CSS import', () => {
  assert.ok(!/<script[^>]+src\s*=/i.test(html), 'remote <script src> found');
  assert.ok(!/<link[^>]+rel=["']stylesheet["']/i.test(html), 'external stylesheet found');
  assert.ok(!/@import\s+url\(/i.test(html), '@import found');
  assert.ok(!/\ssrcset\s*=/i.test(html), 'srcset found');
  assert.ok(!/\ssrc\s*=\s*["']https?:/i.test(html), 'remote image/script src found');
  assert.ok(!/url\(\s*["']?https?:/i.test(html), 'remote url() found');
});

ok('no build placeholders survive the build', () => {
  ['<!-- SITE_ICON -->', '<!-- BRAND_ICON -->', '<!-- LAB_SCRIPTS -->', '/* LAB_STYLES */']
    .forEach((token) => assert.ok(!html.includes(token), 'leftover token: ' + token));
});

ok('shared theme and entrance (assets/theme.js, entry.js) are inlined for this lab', () => {
  const head = html.slice(0, html.indexOf('</head>'));
  ['<!-- THEME_BOOT -->', '<!-- SHARED_EXPERIENCE -->'].forEach((t) => assert.ok(!html.includes(t), 'leftover token: ' + t));
  assert.ok(/<script data-light="#f4f2ec" data-dark="#101113" data-event="distl:theme">/.test(head), 'theme boot must run in <head> before first paint');
  assert.ok(head.includes("key = 'czl-lab-theme'") && head.includes('prefers-color-scheme'), 'shared controller missing');
  assert.ok(head.includes('<script data-lab="distillation-lab">'), 'shared entrance missing');
  assert.ok(/id="themeToggle"[^>]*aria-pressed/.test(html), 'theme toggle needs aria-pressed');
  assert.ok(/<meta name="theme-color"/.test(html), 'theme-color meta missing');
  assert.ok(/<footer[\s>]/.test(html), 'footer needed for the follow-system control');
  const app = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  assert.ok(app.includes('CZLLabTheme.mount('), 'app must mount the shared controller');
  assert.ok(!app.includes('czl-lab-theme'), 'theme persistence belongs to the shared controller');
});

ok('lab navigation: Lab Projects back link and a directory listing every registered lab', () => {
  assert.ok(html.includes('href="../index.html#projects"'), 'Lab Projects back link missing');
  const slugs = JSON.parse(fs.readFileSync(path.join(ROOT, '../../site/projects.json'), 'utf8')).map((p) => p.slug);
  assert.ok(slugs.includes('distillation-lab'), 'distillation-lab must be registered in site/projects.json');
  const dir = html.slice(html.indexOf('class="lab-directory"'), html.indexOf('</section>', html.indexOf('class="lab-directory"')));
  slugs.forEach((slug) => {
    const href = slug === 'distillation-lab' ? './index.html' : '../' + slug + '/index.html';
    assert.ok(dir.includes('href="' + href + '"'), 'directory link missing: ' + href);
  });
  assert.strictEqual((dir.match(/class="dir-card/g) || []).length, slugs.length, 'one card per registered lab');
  assert.ok(/class="dir-card current"[^>]*aria-current="page"/.test(dir), 'current lab must be marked');
});

ok('the interactive lab anchors exist', () => {
  ['lab', 'stageBody', 'modulePanel', 'heroColumn', 'heroChart', 'boilStrip', 'familyGrid', 'compTable', 'sysTable', 'nrtlTable', 'aspenTable', 'mythList', 'importFile']
    .forEach((id) => assert.ok(html.includes('id="' + id + '"'), 'missing #' + id));
  assert.ok(html.includes('id="downloadPage"'), 'missing offline download control');
});

ok('Aspen Plus V15 reference data is embedded with its attribution', () => {
  assert.ok(html.includes('DL.aspen'), 'aspen.js not bundled');
  ['Aspen Plus V15', 'APV150', 'RadFrac', 'NRTL'].forEach((t) => assert.ok(html.includes(t), 'missing ' + t));
});

ok('all ten modules are registered', () => {
  const matches = html.match(/DL\.registerModule\(\{/g) || [];
  assert.strictEqual(matches.length, 10, 'expected 10 registerModule calls, found ' + matches.length);
  ['vle', 'flash', 'mccabe', 'shortcut', 'batch', 'azeotrope', 'vacuum-steam', 'internals', 'crude', 'compare']
    .forEach((slug) => assert.ok(html.includes("slug: '" + slug + "'"), 'missing module slug ' + slug));
});

ok('module sources each register exactly one module with scenes and no quiz', () => {
  const dir = path.join(ROOT, 'src/modules');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
  assert.strictEqual(files.length, 10, 'expected 10 module files, found ' + files.length);
  const ids = new Set();
  files.forEach((file) => {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.strictEqual((src.match(/DL\.registerModule\(\{/g) || []).length, 1, file + ' should register exactly one module');
    const m = src.match(/id:\s*'([A-J])'/);
    assert.ok(m, file + ' missing module id');
    assert.ok(!ids.has(m[1]), 'duplicate module id ' + m[1]);
    ids.add(m[1]);
    assert.ok(/scenes:\s*\[/.test(src), file + ' missing scenes');
    assert.ok(!/quiz/i.test(src), file + ' should not contain quiz questions (popular-science lab, no tests for readers)');
  });
  assert.deepStrictEqual([...ids].sort(), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
});

ok('no quiz or self-test section reaches the page', () => {
  ['id="quiz"', 'quizMount', 'quiz-card', '理解检验'].forEach((t) => assert.ok(!html.includes(t), 'leftover quiz markup: ' + t));
});

ok('the page is a single, substantial document', () => {
  assert.ok(html.length > 150000, 'generated page is unexpectedly small: ' + html.length);
  assert.ok(html.length < 3.5e6, 'generated page is unexpectedly large: ' + html.length);
});

console.log('\n' + passed + ' packaging checks passed\n');
