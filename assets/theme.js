/* Shared pre-paint theme and runtime preference controller. Offline, no deps. */
(function () {
  'use strict';
  var script = document.currentScript, root = document.documentElement;
  var lightColor = script.dataset.light, darkColor = script.dataset.dark, eventName = script.dataset.event;
  var key = 'czl-lab-theme', system = window.matchMedia('(prefers-color-scheme: light)');
  var preference = null, callback = null, mounted = false;
  function valid(value) { return value === 'light' || value === 'dark'; }
  try {
    var saved = localStorage.getItem(key), legacy = localStorage.getItem('sml.theme');
    preference = valid(saved) ? saved : valid(legacy) ? legacy : null;
    if (!valid(saved) && valid(legacy)) {
      localStorage.setItem(key, legacy); localStorage.removeItem('sml.theme');
    }
  } catch (e) { /* System preference still works when storage is unavailable. */ }
  function desired() { return preference || (system.matches ? 'light' : 'dark'); }
  function apply(theme) {
    root.dataset.theme = theme;
    var meta = document.querySelector('meta[name="theme-color"]'), light = theme === 'light';
    if (meta) meta.content = light ? lightColor : darkColor;
    var btn = document.getElementById('themeToggle');
    if (btn) {
      var icon = btn.querySelector('.theme-icon'), label = btn.querySelector('.theme-label');
      if (icon) icon.textContent = light ? '☾' : '☀';
      if (label) label.textContent = light ? '深色' : '浅色';
      btn.setAttribute('aria-pressed', String(!light));
      btn.setAttribute('aria-label', light ? '当前浅色主题，切换到深色' : '当前深色主题，切换到浅色');
      btn.title = (preference ? '已记住手动选择' : '跟随系统主题') + ' · 点击切换深色 / 浅色';
    }
    if (callback) callback(theme);
    if (eventName) window.dispatchEvent(new Event(eventName));
    window.dispatchEvent(new CustomEvent('czl:theme', { detail: { theme: theme, automatic: !preference } }));
  }
  apply(desired()); // Before first paint, independent of localStorage access.
  system.addEventListener('change', function () { if (!preference) apply(desired()); });
  window.addEventListener('storage', function (e) {
    if (e.key !== key && e.key !== null) return;
    preference = valid(e.newValue) ? e.newValue : null; apply(desired());
  });
  window.CZLLabTheme = {
    isAutomatic: function () { return !preference; },
    mount: function (onChange) {
      callback = onChange || null;
      var btn = document.getElementById('themeToggle');
      if (!mounted && btn) {
        btn.addEventListener('click', function () {
          preference = root.dataset.theme === 'light' ? 'dark' : 'light';
          try { localStorage.setItem(key, preference); } catch (e) { /* Keep it in memory. */ }
          apply(preference);
        }); mounted = true;
      }
      apply(desired());
    },
    followSystem: function () {
      preference = null;
      try { localStorage.removeItem(key); localStorage.removeItem('sml.theme'); } catch (e) { /* memory fallback */ }
      apply(desired());
    }
  };
})();
