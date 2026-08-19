(function () {
  'use strict';
  window.__FA_QX_INSTALL_ADAPTER__ = function (bridge) {
    var values = Object.create(null);
    function clone(value) {
      if (value === undefined) return undefined;
      try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
    }
    function addStyle(css) {
      var style = document.createElement('style');
      style.textContent = String(css || '');
      (document.head || document.documentElement).appendChild(style);
      return style;
    }
    var adapter = {
      hydrate: function () { return Promise.resolve(); },
      get: function (key, fallback) { return Object.prototype.hasOwnProperty.call(values, key) ? clone(values[key]) : fallback; },
      set: function (key, value) { values[key] = clone(value); return true; },
      remove: function (key) { delete values[key]; return true; },
      request: function () { throw new Error('FA_QX_PROXY_NOT_READY'); }
    };
    window.unsafeWindow = window;
    window.GM_getValue = adapter.get;
    window.GM_setValue = adapter.set;
    window.GM_deleteValue = adapter.remove;
    window.GM_addStyle = addStyle;
    window.GM_registerMenuCommand = function () {};
    window.GM_xmlhttpRequest = adapter.request;
    return adapter;
  };
})();
