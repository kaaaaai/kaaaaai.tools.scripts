(function () {
  'use strict';
  var SCHEMA = __FA_SCHEMA__;
  var BRIDGE_TIMEOUT_MS = __FA_BRIDGE_TIMEOUT_MS__;
  var CORE_VERSION = '__FA_CORE_VERSION__';

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
    badge.textContent = 'FA QX __FA_RELEASE__ · runtime ' + (runtimeLoaded ? '✓' : '✕') + ' · bridge ' + (errorCode ? '✕' : '✓') + (api.coreState === 'ready' ? ' · core ' + CORE_VERSION + ' ✓ · nav ' + (api.navState === 'ready' ? '✓' : '…') : '') + (errorCode ? ' · ' + errorCode : '');
    document.documentElement.appendChild(badge);
  }

  function loadScript(name) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var settled = false;
      var timer = setTimeout(function () { finish(reject, new Error('FA_QX_CORE_ASSET_TIMEOUT')); }, BRIDGE_TIMEOUT_MS);
      function finish(callback, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        callback(value);
      }
      script.src = '__FA_ROUTE_PREFIX__/asset/' + name + '.js?release=__FA_RELEASE__&build=__FA_BUILD_ID__';
      script.onload = function () { finish(resolve); };
      script.onerror = function () { finish(reject, new Error('FA_QX_CORE_ASSET_FAILED')); };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  function applyCoreConfig(config) {
    try {
      if (window.saves && window.saves.settings) {
        if (typeof config.autoScan === 'boolean') window.saves.settings.isAutoScan = config.autoScan;
        if (typeof config.storeMarking === 'boolean') window.saves.settings.enableStoreMarking = config.storeMarking;
        if (typeof window.savestorage === 'function') window.savestorage();
      }
    } catch (_) {}
  }

  function pendingCommand(config, name) {
    var commands = config && config.commands;
    var acknowledgements = config && config.acknowledgements;
    var command = commands && commands[name];
    var acknowledgement = acknowledgements && acknowledgements[name];
    return Number.isSafeInteger(command) && command > 0 && Number.isSafeInteger(acknowledgement) && command > acknowledgement ? command : 0;
  }

  function recordCommandError(name, error) {
    api.commandErrors = api.commandErrors || {};
    api.commandErrors[name] = redactError(error);
  }

  function acknowledgeCommand(name, id) {
    return bridge('command.ack', { command: name, id: id });
  }

  function scheduleClearCache(config) {
    var id = pendingCommand(config, 'clearCache');
    if (!id || !window.faCompat || typeof window.faCompat.confirm !== 'function' || typeof window.savestorage !== 'function') return;
    var confirmation = window.faCompat.confirm('清理家庭库缓存', '此操作会删除 QX 中的家庭库扫描缓存与跨站标记数据，之后需要重新扫描。', '确认清理', '取消');
    if (!confirmation || typeof confirmation.done !== 'function') return;
    confirmation.done(function () {
      bridge('index.clear', {}).then(function () {
        window.savestorage(true);
        return acknowledgeCommand('clearCache', id);
      }).catch(function (error) { recordCommandError('clearCache', error); });
    });
  }

  function processCommands(config) {
    var chain = Promise.resolve();
    var rescan = pendingCommand(config, 'rescan');
    if (rescan && typeof window.scan === 'function') {
      chain = chain.then(function () {
        window.scan(true);
        return acknowledgeCommand('rescan', rescan);
      }).catch(function (error) { recordCommandError('rescan', error); });
    }
    var refreshExternal = pendingCommand(config, 'refreshExternal');
    if (refreshExternal) {
      chain = chain.then(function () {
        var jobs = [];
        if (typeof window.faLoadBundleData === 'function') jobs.push(window.faLoadBundleData());
        if (typeof window.faLoadGotyData === 'function') jobs.push(window.faLoadGotyData(true));
        if (typeof window.faLoadDlcDatabase === 'function') jobs.push(window.faLoadDlcDatabase());
        return Promise.all(jobs).then(function () { return acknowledgeCommand('refreshExternal', refreshExternal); });
      }).catch(function (error) { recordCommandError('refreshExternal', error); });
    }
    return chain.then(function () { scheduleClearCache(config); });
  }

  function startCore(config) {
    if (typeof window.__FA_QX_INSTALL_ADAPTER__ !== 'function') throw new Error('FA_QX_CORE_ADAPTER_MISSING');
    api.coreState = 'loading';
    var adapter = window.__FA_QX_INSTALL_ADAPTER__(bridge, api);
    return adapter.hydrate().then(function () { return loadScript('chart'); })
      .then(function () { return loadScript('pinyin'); })
      .then(function () { return loadScript('app-detail'); })
      .then(function () { return loadScript('core'); })
      .then(function () { applyCoreConfig(config); return processCommands(config); })
      .then(function () { api.coreState = 'ready'; api.coreVersion = CORE_VERSION; });
  }

  function reportNavigation(state) {
    if (state !== 'ready') return;
    api.navState = state;
    if (api.state === 'ready') renderDiagnostic(api.config, null, true);
  }

  var api = { release: '__FA_RELEASE__', buildId: '__FA_BUILD_ID__', coreVersion: null, coreState: 'idle', navState: 'pending', state: 'starting', bridge: bridge, reportNavigation: reportNavigation, ready: null };
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
    api.config = config;
    return startCore(config).then(function () { return config; });
  }).then(function (config) {
    if (window.__FA_QX__ === api) {
      api.state = 'ready';
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
