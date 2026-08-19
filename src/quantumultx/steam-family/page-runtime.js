(function () {
  'use strict';
  if (window.__FA_QX__ && window.__FA_QX__.buildId === '__FA_BUILD_ID__') return;
  function bridge(operation, payload) {
    return Promise.resolve().then(function () {
      return fetch('__FA_ROUTE_PREFIX__/bridge', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-FA-QX-Build': '__FA_BUILD_ID__' },
        body: JSON.stringify({ operation: operation, payload: payload || {}, release: '__FA_RELEASE__', buildId: '__FA_BUILD_ID__' })
      });
    }).then(function (response) {
      if (!response.ok) throw new Error('FA_QX_BRIDGE_HTTP_' + response.status);
      return response.json();
    }).then(function (result) {
      if (!result || result.ok !== true) throw new Error(result && result.error ? result.error : 'FA_QX_BRIDGE_INVALID');
      return result.data;
    });
  }

  function redactError(error) {
    var code = error && error.message;
    return typeof code === 'string' && /^FA_QX_[A-Z0-9_]+$/.test(code) ? code : 'FA_QX_UNKNOWN';
  }

  function validateHealth(health) {
    if (!health || health.release !== '__FA_RELEASE__' || health.buildId !== '__FA_BUILD_ID__' || health.schema !== 1) {
      throw new Error('FA_QX_RUNTIME_HEALTH_INVALID');
    }
    return health;
  }

  function renderDiagnostic(config, errorCode) {
    if (window.__FA_QX__ !== api) return;
    var existing = document.querySelector('#fa-qx-diagnostic');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    if ((!config || config.debug !== true) && !errorCode) return;
    var badge = document.createElement('div');
    badge.id = 'fa-qx-diagnostic';
    badge.style.cssText = 'position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483647;pointer-events:none;padding:6px 8px;border-radius:6px;background:#1b1b1b;color:#fff;font:12px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;';
    badge.textContent = 'FA QX __FA_RELEASE__ · runtime ' + (errorCode ? '✕' : '✓') + ' · bridge ' + (errorCode ? '✕' : '✓') + (errorCode ? ' · ' + errorCode : '');
    document.documentElement.appendChild(badge);
  }

  var api = { release: '__FA_RELEASE__', buildId: '__FA_BUILD_ID__', state: 'starting', bridge: bridge, ready: null };
  window.__FA_QX__ = api;
  api.ready = bridge('runtime.health', {}).then(validateHealth).then(function () {
    return bridge('config.get', {});
  }).then(function (config) {
    if (window.__FA_QX__ === api) {
      api.state = 'ready';
      api.config = config;
      renderDiagnostic(config, null);
    }
    return api;
  }).catch(function (error) {
    if (window.__FA_QX__ === api) {
      api.state = 'error';
      api.error = redactError(error);
      renderDiagnostic({ debug: false }, api.error);
    }
    throw error;
  });
  api.ready.catch(function () {});
})();
