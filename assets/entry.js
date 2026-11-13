/* A finite, skippable entrance shared by the catalog and every offline lab. */
(function () {
  'use strict';
  var id = document.currentScript.dataset.lab;
  var lines = {
    'catalog': ['科学与工程可视化', 'SCIENCE / ENGINEERING', '看见结构，理解原理。', '<path d="m80 16 44 25v50l-44 27-44-27V41Z M36 41l44 26 44-26 M80 67v51"/>'],
    'motor-lab': ['电机原理实验室', 'MOTOR / LAB', '从结构出发，追踪能量的运动。', '<circle cx="80" cy="68" r="45"/><path d="M80 15v20m0 66v20M27 68h20m66 0h20"/><path class="entry-detail" d="m62 48 37 20-37 20Z"/>'],
    'stock-market-lab': ['股票市场原理实验室', 'STOCK MARKET / LAB', '看见价格，也看清资金流向。', '<path d="M27 24v90h111M43 98l24-25 22 10 36-46"/><path class="entry-detail" d="M49 42v36m-7-26h14v16H42Zm38-20v31m-7-21h14v13H73Zm38-40v29m-7-20h14v13h-14Z"/>'],
    'desalination-lab': ['海水淡化原理实验室', 'DESALINATION / LAB', '把盐留下，把水带走。', '<path d="M30 30v77h100V30M80 24v87M35 66h38m14 0h38"/><path class="entry-detail" d="m59 58 10 8-10 8M93 87h22m-22-40h22"/><circle class="entry-dot" cx="108" cy="81" r="3"/>'],
    'fusion-lab': ['核聚变反应堆实验室', 'FUSION / LAB', '沿着磁场，理解一座聚变装置。', '<ellipse cx="80" cy="70" rx="57" ry="34"/><ellipse cx="80" cy="70" rx="31" ry="16"/><path class="entry-detail" d="M38 45q-17 30 0 50m84-50q17 30 0 50M61 38q-12 31 0 64m38-64q12 31 0 64"/>'],
    'distillation-lab': ['精馏原理实验室', 'DISTILLATION / LAB', '从蒸气压出发，一级一级把混合物分开。', '<rect x="62" y="22" width="36" height="96" rx="9"/><path d="M80 22V11h36v17M122 34h16M80 118v11h36M34 70h28m-8-5 8 5-8 5"/><circle cx="116" cy="34" r="6"/><path class="entry-detail" d="M62 44h24M74 58h24M62 72h24M74 86h24M62 100h24"/><circle class="entry-dot" cx="71" cy="65" r="2.5"/><circle class="entry-dot" cx="89" cy="79" r="2.5"/>']
  };
  var info = lines[id]; if (!info) return;
  var media = window.matchMedia('(prefers-reduced-motion: reduce)'), overlay = null, leaving = null, timer = 0, removal = 0, replay, initialPending = true;
  function close(immediate) {
    clearTimeout(timer); clearTimeout(removal);
    if (leaving) { leaving.remove(); leaving = null; }
    document.documentElement.classList.remove('czl-entering');
    if (!overlay) return;
    var previous = overlay; overlay = null;
    if (previous.contains(document.activeElement)) {
      var target = replay || document.querySelector('.skip, header a'); if (target) target.focus({ preventScroll: true });
    }
    if (immediate) previous.remove();
    else { leaving = previous; previous.classList.add('is-leaving'); previous.querySelector('button').disabled = true; removal = setTimeout(function () { previous.remove(); if (leaving === previous) leaving = null; }, 230); }
  }
  function show() {
    close(true);
    if (media.matches || document.hidden) return;
    overlay = document.createElement('div'); overlay.className = 'czl-entry';
    var content = document.createElement('div'); content.className = 'czl-entry-content'; overlay.appendChild(content);
    var brand = document.createElement('div'); brand.className = 'czl-entry-brand';
    var image = document.createElement('img'); image.alt = ''; image.src = document.querySelector('link[rel="icon"]').href;
    brand.appendChild(image); brand.appendChild(document.createTextNode('CZL-HOMELAB / VISUAL LABS')); content.appendChild(brand);
    var art = document.createElement('div'); art.setAttribute('aria-hidden', 'true');
    art.innerHTML = '<svg class="czl-entry-graphic" viewBox="0 0 160 140" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g class="entry-stroke">' + info[3] + '</g></svg>'; content.appendChild(art);
    var name = document.createElement('h2'); name.textContent = info[0]; content.appendChild(name);
    var code = document.createElement('div'); code.className = 'czl-entry-code'; code.textContent = info[1]; content.appendChild(code);
    var copy = document.createElement('p'); copy.textContent = info[2]; content.appendChild(copy);
    var skip = document.createElement('button'); skip.type = 'button'; skip.className = 'czl-entry-skip'; skip.textContent = '跳过入场';
    skip.addEventListener('click', function () { close(true); }); content.appendChild(skip);
    document.body.appendChild(overlay); document.documentElement.classList.add('czl-entering');
    timer = setTimeout(function () { close(false); }, 1400);
  }
  function syncMotion() {
    if (replay) { replay.disabled = media.matches; replay.title = media.matches ? '系统已开启减少动态效果，跳过入场' : '回放入场动效'; }
    if (media.matches) close(true);
  }
  function init() {
    // Downloaded pages may contain a snapshot of generated controls/entrance.
    document.querySelectorAll('.czl-entry, .czl-entry-replay, .czl-theme-system').forEach(function (el) { el.remove(); });
    document.documentElement.classList.remove('czl-entering');
    var theme = document.getElementById('themeToggle');
    replay = document.createElement('button'); replay.type = 'button'; replay.className = 'czl-entry-replay';
    replay.setAttribute('aria-label', '回放入场动效'); replay.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 10a8 8 0 1 1 0 5M4 4v6h6"/></svg>';
    replay.addEventListener('click', show); if (theme) theme.insertAdjacentElement('afterend', replay);
    var footer = document.querySelector('footer');
    if (footer) {
      var automatic = document.createElement('button'); automatic.type = 'button'; automatic.className = 'czl-theme-system';
      automatic.textContent = '主题：跟随系统'; automatic.title = '清除手动主题选择，恢复跟随系统';
      function syncAutomatic() { automatic.setAttribute('aria-pressed', String(window.CZLLabTheme.isAutomatic())); }
      automatic.addEventListener('click', function () { window.CZLLabTheme.followSystem(); });
      window.addEventListener('czl:theme', syncAutomatic); syncAutomatic(); footer.appendChild(automatic);
    }
    syncMotion();
    // Paint the real page before starting the finite presentation, including
    // expensive WebGL initialization performed by later DOM-ready handlers.
    if (!location.hash && !media.matches) requestAnimationFrame(function () { requestAnimationFrame(function () {
      if (initialPending) { initialPending = false; show(); }
    }); });
  }
  document.addEventListener('pointerdown', function (e) {
    initialPending = false;
    if (!overlay || e.target.closest('.czl-entry-skip')) return;
    // First interaction dismisses the presentation, never activates a hidden control.
    if (overlay.contains(e.target)) { e.preventDefault(); e.stopPropagation(); }
    close(true);
  }, true);
  document.addEventListener('keydown', function (e) { initialPending = false; if (overlay) { close(true); if (e.key !== 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); } } }, true);
  document.addEventListener('wheel', function () { initialPending = false; if (overlay) close(true); }, { passive: true, capture: true });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { initialPending = false; close(true); } });
  window.addEventListener('pagehide', function () { initialPending = false; close(true); });
  media.addEventListener('change', syncMotion);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
