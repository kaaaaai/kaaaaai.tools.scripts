(function () {
  'use strict';
  var SCHEMA = __FA_SCHEMA__;
  var BRIDGE_TIMEOUT_MS = __FA_BRIDGE_TIMEOUT_MS__;

  function redactError(error) {
    var code = error && error.message;
    return typeof code === 'string' && /^FA_QX_[A-Z0-9_]+$/.test(code) ? code : 'FA_QX_UNKNOWN';
  }

  function validCurrentScript() {
    try {
      var script = document && document.currentScript;
      if (!script || typeof script.getAttribute !== 'function' || script.getAttribute('data-fa-qx-bootstrap') !== '__FA_BUILD_ID__') return false;
      var expected = '__FA_ROUTE_PREFIX__/runtime.js?release=__FA_RELEASE__&build=__FA_BUILD_ID__';
      var source = typeof script.src === 'string' ? script.src : script.getAttribute('src');
      if (source === expected) return true;
      if (typeof source !== 'string' || source.slice(-expected.length) !== expected) return false;
      return /^https:\/\/[^/?#]+$/.test(source.slice(0, -expected.length));
    } catch (_) {
      return false;
    }
  }

  var handshakeValid = validCurrentScript();
  if (handshakeValid && window.__FA_QX__ && window.__FA_QX__.buildId === '__FA_BUILD_ID__' && window.__FA_QX__.state !== 'error') return;

  function bridge(operation, payload) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        settle(reject, new Error('FA_QX_BRIDGE_TIMEOUT'));
      }, BRIDGE_TIMEOUT_MS);

      function settle(callback, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        callback(value);
      }

      Promise.resolve().then(function () {
        var envelope = JSON.stringify({ operation: operation, payload: payload === undefined ? {} : payload, release: '__FA_RELEASE__', buildId: '__FA_BUILD_ID__' });
        return fetch('__FA_ROUTE_PREFIX__/bridge?request=' + encodeURIComponent(envelope), {
          method: 'GET',
          credentials: 'same-origin'
        });
      }).then(function (response) {
        var parsed = typeof response.json === 'function' ? response.json().catch(function () { return null; }) : Promise.resolve(null);
        return parsed.then(function (result) {
          if (!response.ok) throw new Error(result && result.error ? result.error : 'FA_QX_BRIDGE_HTTP_' + response.status);
          return result;
        });
      }).then(function (result) {
        if (!result || result.ok !== true) throw new Error(result && result.error ? result.error : 'FA_QX_BRIDGE_INVALID');
        settle(resolve, result.data);
      }).catch(function (error) {
        settle(reject, error);
      });
    }).catch(function (error) {
      throw new Error(redactError(error));
    });
  }

  function validateHealth(health) {
    if (!health || health.release !== '__FA_RELEASE__' || health.buildId !== '__FA_BUILD_ID__' || health.schema !== SCHEMA) {
      throw new Error('FA_QX_RUNTIME_HEALTH_INVALID');
    }
    return health;
  }

  function renderDiagnostic(config, errorCode, runtimeLoaded) {
    if (window.__FA_QX__ !== api) return;
    var existing = document.querySelector('#fa-qx-diagnostic');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    if ((!config || config.debug !== true) && !errorCode) return;
    var badge = document.createElement('div');
    badge.id = 'fa-qx-diagnostic';
    badge.style.cssText = 'position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483647;pointer-events:none;padding:6px 8px;border-radius:6px;background:#1b1b1b;color:#fff;font:12px/1.3 -apple-system,BlinkMacSystemFont,sans-serif;';
    badge.textContent = 'FA QX __FA_RELEASE__ · runtime ' + (runtimeLoaded ? '✓' : '✕') + ' · bridge ' + (errorCode ? '✕' : '✓') + (errorCode ? ' · ' + errorCode : '');
    document.documentElement.appendChild(badge);
  }

  var api = { release: '__FA_RELEASE__', buildId: '__FA_BUILD_ID__', state: 'starting', bridge: bridge, ready: null };
  window.__FA_QX__ = api;
  if (!handshakeValid) {
    api.state = 'error';
    api.error = 'FA_QX_VERSION_MISMATCH';
    renderDiagnostic({ debug: false }, api.error, false);
    api.ready = Promise.reject(new Error(api.error));
    api.ready.catch(function () {});
    return;
  }
  api.ready = bridge('runtime.health', {}).then(validateHealth).then(function () {
    return bridge('config.get', {});
  }).then(function (config) {
    if (window.__FA_QX__ === api) {
      api.state = 'ready';
      api.config = config;
      renderDiagnostic(config, null, true);
    }
    return api;
  }).catch(function (error) {
    if (window.__FA_QX__ === api) {
      api.state = 'error';
      api.error = redactError(error);
      renderDiagnostic({ debug: false }, api.error, true);
    }
    throw new Error(redactError(error));
  });
  api.ready.catch(function () {});
})();
