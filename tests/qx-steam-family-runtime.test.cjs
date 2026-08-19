const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { runQx } = require('./helpers/run-qx-script.cjs');

const releaseDir = path.resolve(__dirname, '..', 'quantumultx/steam-family/releases/0.1.0');
const readAsset = (name) => fs.readFileSync(path.join(releaseDir, name), 'utf8');

function runInjector(body, headers) {
  const { calls } = runQx(readAsset('injector.js'), { $response: { body, headers } });
  assert.equal(calls.length, 1);
  return calls[0].body;
}

function runAsset() {
  const { calls } = runQx(readAsset('runtime-asset.js'));
  assert.equal(calls.length, 1);
  return calls[0];
}

function runBridge(body) {
  const { calls } = runQx(readAsset('bridge.js'), {
    $request: { body, method: 'POST', url: 'https://store.steampowered.com/fa-qx/v1/bridge' },
  });
  assert.equal(calls.length, 1);
  return calls[0];
}

function pageRuntime() {
  return runAsset().body;
}

function documentStub() {
  const nodes = [];
  const documentElement = {
    appendChild(node) {
      node.parentNode = documentElement;
      nodes.push(node);
      return node;
    },
    removeChild(node) {
      const index = nodes.indexOf(node);
      if (index === -1) throw new Error('node is not a child');
      nodes.splice(index, 1);
      node.parentNode = null;
      return node;
    },
  };
  return {
    documentElement,
    createElement() {
      return { id: '', parentNode: null, textContent: '', style: { cssText: '' } };
    },
    querySelector(selector) {
      return selector === '#fa-qx-diagnostic' ? nodes.find((node) => node.id === 'fa-qx-diagnostic') || null : null;
    },
    diagnosticCount() {
      return nodes.filter((node) => node.id === 'fa-qx-diagnostic').length;
    },
  };
}

function currentScriptStub(buildId = currentBuildId(), release = '0.1.0', src) {
  const marker = buildId;
  return {
    src: src === undefined ? `https://store.steampowered.com/fa-qx/v1/runtime.js?release=${release}&build=${buildId}` : src,
    getAttribute(name) {
      return name === 'data-fa-qx-bootstrap' ? marker : null;
    },
  };
}

function currentBuildId() {
  return JSON.parse(fs.readFileSync(path.join(releaseDir, 'manifest.json'), 'utf8')).buildId;
}

function runtimeForBuild(buildId) {
  return pageRuntime().replaceAll(currentBuildId(), buildId);
}

function deferred(PromiseImpl = Promise) {
  let resolve;
  let reject;
  const promise = new PromiseImpl((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitFor(condition) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail('condition did not become true');
}

function runPageRuntime({ config = { debug: false }, health, fetchImpl, document = documentStub(), currentScript, window = {}, runtime = pageRuntime(), PromiseImpl = Promise, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
  const postedRequests = [];
  const runtimeHealth = health || { release: '0.1.0', buildId: currentBuildId(), schema: 1 };
  const fetch = fetchImpl || ((url, options) => {
    const request = JSON.parse(options.body);
    postedRequests.push(request);
    const data = request.operation === 'runtime.health' ? runtimeHealth : config;
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data }) });
  });
  const runtimeBuild = (runtime.match(/buildId: '([0-9a-f]{12})'/) || [])[1] || currentBuildId();
  document.currentScript = currentScript === undefined ? currentScriptStub(runtimeBuild) : currentScript;
  vm.runInNewContext(runtime, {
    window,
    document,
    fetch,
    Promise: PromiseImpl,
    setTimeout: setTimeoutImpl,
    clearTimeout: clearTimeoutImpl,
  });
  return { window, document, postedRequests };
}

function fakeTimers() {
  let nextId = 1;
  const pending = new Map();
  return {
    setTimeout(callback, delay) {
      const id = nextId++;
      pending.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { pending.delete(id); },
    fireNext() {
      const entry = pending.entries().next().value;
      assert.ok(entry, 'expected a pending timer');
      pending.delete(entry[0]);
      entry[1].callback();
      return entry[1].delay;
    },
    count() { return pending.size; },
  };
}

test('injector preserves non-HTML and injects the runtime only once', () => {
  const htmlHeaders = { 'Content-Type': 'text/html' };
  assert.equal(runInjector('{"ok":true}', { 'Content-Type': 'application/json' }), '{"ok":true}');
  assert.equal(runInjector('<html><body>x</body></html>', { 'Content-Type': 'text/html' }).match(/data-fa-qx-bootstrap=/g).length, 1);
  assert.equal(runInjector(runInjector('<html><body>x</body></html>', htmlHeaders), htmlHeaders).match(/data-fa-qx-bootstrap=/g).length, 1);
  const injected = runInjector('<html><body>x</body></html>', htmlHeaders);
  assert.match(injected, /\/fa-qx\/v1\/runtime\.js\?release=0\.1\.0&build=[0-9a-f]{12}/);
});

test('runtime asset returns the page runtime as JavaScript', () => {
  assert.equal(runAsset().headers['Content-Type'], 'application/javascript; charset=utf-8');
  assert.match(runAsset().body, /window\.__FA_QX__/);
});

test('runtime rejects absent, invalid, and mixed-build currentScript before bridge startup', async () => {
  const buildId = currentBuildId();
  const cases = [
    null,
    { src: currentScriptStub().src },
    currentScriptStub('111111111111'),
    {
      src: `https://store.steampowered.com/fa-qx/v1/runtime.js?release=0.1.0&build=111111111111`,
      getAttribute(name) { return name === 'data-fa-qx-bootstrap' ? buildId : null; },
    },
    {
      src: `https://store.steampowered.com/fa-qx/v1/runtime.js?release=0.1.1&build=${buildId}`,
      getAttribute(name) { return name === 'data-fa-qx-bootstrap' ? buildId : null; },
    },
  ];
  for (const currentScript of cases) {
    const { window, document, postedRequests } = runPageRuntime({ currentScript });
    await assert.rejects(window.__FA_QX__.ready, (error) => error && error.message === 'FA_QX_VERSION_MISMATCH');
    assert.equal(window.__FA_QX__.state, 'error');
    assert.equal(window.__FA_QX__.error, 'FA_QX_VERSION_MISMATCH');
    assert.equal(postedRequests.length, 0);
    const badge = document.querySelector('#fa-qx-diagnostic');
    assert.match(badge.textContent, /runtime ✕/);
    assert.match(badge.textContent, /bridge ✕/);
  }
});

test('bridge timeout settles after 8000 ms, clears its timer, and ignores a late response', async () => {
  const timers = fakeTimers();
  const response = deferred();
  const { window, document } = runPageRuntime({
    fetchImpl() { return response.promise; },
    setTimeoutImpl: timers.setTimeout,
    clearTimeoutImpl: timers.clearTimeout,
  });
  await waitFor(() => timers.count() === 1);
  assert.equal(timers.fireNext(), 8000);
  await assert.rejects(window.__FA_QX__.ready, (error) => error && error.message === 'FA_QX_BRIDGE_TIMEOUT');
  const timedOutApi = window.__FA_QX__;
  const timedOutBadge = document.querySelector('#fa-qx-diagnostic');
  assert.equal(timedOutApi.state, 'error');
  assert.equal(timedOutApi.error, 'FA_QX_BRIDGE_TIMEOUT');
  assert.match(timedOutBadge.textContent, /runtime ✓/);
  assert.match(timedOutBadge.textContent, /bridge ✕/);
  assert.equal(timers.count(), 0);
  response.resolve({
    ok: true,
    json: () => Promise.resolve({ ok: true, data: { release: '0.1.0', buildId: currentBuildId(), schema: 1 } }),
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(window.__FA_QX__, timedOutApi);
  assert.equal(timedOutApi.state, 'error');
  assert.equal(document.querySelector('#fa-qx-diagnostic'), timedOutBadge);
});

test('same-build reinjection replaces an errored runtime but remains idempotent while starting or ready', async () => {
  const window = {};
  const document = documentStub();
  const failed = runPageRuntime({
    window,
    document,
    fetchImpl() { return Promise.reject(new Error('private failure')); },
  });
  await assert.rejects(failed.window.__FA_QX__.ready, /FA_QX_UNKNOWN/);
  const failedApi = window.__FA_QX__;
  const recovered = runPageRuntime({ window, document });
  const recoveredApi = window.__FA_QX__;
  assert.notEqual(recoveredApi, failedApi);
  await recoveredApi.ready;
  assert.equal(recoveredApi.state, 'ready');

  runPageRuntime({ window, document });
  assert.equal(window.__FA_QX__, recoveredApi);

  const startingWindow = {};
  const startingHealth = deferred();
  runPageRuntime({ window: startingWindow, fetchImpl() { return startingHealth.promise; } });
  const startingApi = startingWindow.__FA_QX__;
  runPageRuntime({ window: startingWindow });
  assert.equal(startingWindow.__FA_QX__, startingApi);
  startingHealth.resolve({
    ok: true,
    json: () => Promise.resolve({ ok: true, data: { release: '0.1.0', buildId: currentBuildId(), schema: 1 } }),
  });
  await startingApi.ready;
});

test('page runtime becomes ready after health and configuration requests without a default diagnostic', async () => {
  const { window, document, postedRequests } = runPageRuntime();
  await window.__FA_QX__.ready;
  assert.equal(window.__FA_QX__.state, 'ready');
  assert.equal(document.querySelector('#fa-qx-diagnostic'), null);
  assert.equal(postedRequests[0].operation, 'runtime.health');
  assert.equal(postedRequests[1].operation, 'config.get');
});

test('page runtime renders a safe-area diagnostic only when debug is enabled', async () => {
  const { window, document } = runPageRuntime({ config: { debug: true } });
  await window.__FA_QX__.ready;
  const badge = document.querySelector('#fa-qx-diagnostic');
  assert.ok(badge);
  assert.match(badge.textContent, /FA QX 0\.1\.0/);
  assert.match(badge.textContent, /runtime ✓/);
  assert.match(badge.textContent, /bridge ✓/);
  assert.match(badge.style.cssText, /pointer-events:none/);
  assert.match(badge.style.cssText, /env\(safe-area-inset-bottom\)/);
});

test('page runtime replaces an existing diagnostic instead of duplicating it', async () => {
  const document = documentStub();
  const oldBadge = document.createElement('div');
  oldBadge.id = 'fa-qx-diagnostic';
  document.documentElement.appendChild(oldBadge);
  const { window } = runPageRuntime({ document, config: { debug: true } });
  await window.__FA_QX__.ready;
  const newBadge = document.querySelector('#fa-qx-diagnostic');
  assert.notEqual(newBadge, oldBadge);
  assert.equal(oldBadge.parentNode, null);
  assert.equal(document.diagnosticCount(), 1);
});

test('page runtime redacts rejected health responses in its diagnostic', async () => {
  const responseBody = 'upstream response body must remain private';
  const { window, document } = runPageRuntime({
    fetchImpl(url, options) {
      assert.equal(JSON.parse(options.body).operation, 'runtime.health');
      return Promise.resolve({ ok: false, status: 503, text: () => Promise.resolve(responseBody) });
    },
  });
  assert.ok(window.__FA_QX__.ready && typeof window.__FA_QX__.ready.then === 'function');
  await assert.rejects(window.__FA_QX__.ready);
  assert.equal(window.__FA_QX__.state, 'error');
  const badge = document.querySelector('#fa-qx-diagnostic');
  assert.ok(badge);
  assert.match(badge.textContent, /runtime ✓/);
  assert.match(badge.textContent, /bridge ✕/);
  assert.match(badge.textContent, /FA_QX_BRIDGE_HTTP_503/);
  assert.doesNotMatch(badge.textContent, new RegExp(responseBody));
});

test('browser bridge rejects malicious server errors with an independently redacted public Error', async () => {
  const malicious = 'private server detail with preference contents';
  const { window, document } = runPageRuntime({
    fetchImpl() {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: false, error: malicious }),
      });
    },
  });
  await assert.rejects(window.__FA_QX__.ready, (error) => error && error.message === 'FA_QX_UNKNOWN');
  assert.equal(window.__FA_QX__.error, 'FA_QX_UNKNOWN');
  assert.doesNotMatch(document.querySelector('#fa-qx-diagnostic').textContent, new RegExp(malicious));
  await assert.rejects(window.__FA_QX__.bridge('config.get', {}), (error) => error && error.message === 'FA_QX_UNKNOWN');
});

test('page runtime rejects invalid health without requesting configuration', async () => {
  const { window, document, postedRequests } = runPageRuntime({
    health: { release: 'wrong-release', buildId: currentBuildId(), schema: 1 },
  });
  await assert.rejects(window.__FA_QX__.ready, /FA_QX_RUNTIME_HEALTH_INVALID/);
  assert.equal(window.__FA_QX__.state, 'error');
  assert.equal(window.__FA_QX__.error, 'FA_QX_RUNTIME_HEALTH_INVALID');
  assert.equal(postedRequests.length, 1);
  assert.match(document.querySelector('#fa-qx-diagnostic').textContent, /FA_QX_RUNTIME_HEALTH_INVALID/);
});

test('page runtime redacts a rejected configuration request', async () => {
  const originalError = new Error('private configuration response');
  const { window, document, postedRequests } = runPageRuntime({
    fetchImpl(url, options) {
      const request = JSON.parse(options.body);
      postedRequests.push(request);
      if (request.operation === 'runtime.health') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: { release: '0.1.0', buildId: currentBuildId(), schema: 1 } }),
        });
      }
      return Promise.reject(originalError);
    },
  });
  await assert.rejects(window.__FA_QX__.ready, (error) => error && error.message === 'FA_QX_UNKNOWN');
  assert.equal(window.__FA_QX__.state, 'error');
  assert.equal(window.__FA_QX__.error, 'FA_QX_UNKNOWN');
  assert.deepEqual(postedRequests.map((request) => request.operation), ['runtime.health', 'config.get']);
  const badge = document.querySelector('#fa-qx-diagnostic');
  assert.match(badge.textContent, /FA_QX_UNKNOWN/);
  assert.doesNotMatch(badge.textContent, /private configuration response/);
});

test('page runtime publishes a rejected startup API after a synchronous fetch failure', async () => {
  const originalError = new Error('private synchronous fetch failure');
  let page;
  assert.doesNotThrow(() => {
    page = runPageRuntime({ fetchImpl() { throw originalError; } });
  });
  const { window, document } = page;
  assert.ok(window.__FA_QX__);
  await assert.rejects(window.__FA_QX__.ready, (error) => error && error.message === 'FA_QX_UNKNOWN');
  assert.equal(window.__FA_QX__.state, 'error');
  const badge = document.querySelector('#fa-qx-diagnostic');
  assert.ok(badge);
  assert.equal(document.diagnosticCount(), 1);
  assert.match(badge.textContent, /FA_QX_UNKNOWN/);
  assert.doesNotMatch(badge.textContent, /private synchronous fetch failure/);
});

test('page runtime internally observes rejected startup without changing ready rejection semantics', async () => {
  class TrackingPromise extends Promise {
    constructor(executor) {
      super(executor);
      this.hasRejectionObserver = false;
    }

    then(onFulfilled, onRejected) {
      if (typeof onRejected === 'function') this.hasRejectionObserver = true;
      return super.then(onFulfilled, onRejected);
    }
  }
  const originalError = new Error('private rejected startup');
  const startup = deferred(TrackingPromise);
  const { window } = runPageRuntime({ PromiseImpl: TrackingPromise, fetchImpl() { return startup.promise; } });
  assert.equal(window.__FA_QX__.ready.hasRejectionObserver, true);
  const observed = assert.rejects(window.__FA_QX__.ready, (error) => error && error.message === 'FA_QX_UNKNOWN');
  startup.reject(originalError);
  await observed;
});

test('a superseded runtime cannot overwrite the current runtime after its health resolves and config rejects', async () => {
  const oldBuildId = '111111111111';
  const oldHealth = deferred();
  const oldConfig = deferred();
  const oldError = new Error('private old config rejection');
  const document = documentStub();
  const window = {};
  const requests = [];
  const fetchImpl = (url, options) => {
    const request = JSON.parse(options.body);
    requests.push(request);
    if (request.buildId === oldBuildId && request.operation === 'runtime.health') return oldHealth.promise;
    if (request.buildId === oldBuildId && request.operation === 'config.get') return oldConfig.promise;
    const data = request.operation === 'runtime.health'
      ? { release: '0.1.0', buildId: request.buildId, schema: 1 }
      : { debug: true };
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data }) });
  };
  const oldPage = runPageRuntime({ window, document, fetchImpl, runtime: runtimeForBuild(oldBuildId) });
  const oldApi = window.__FA_QX__;
  const currentPage = runPageRuntime({ window, document, fetchImpl });
  const currentApi = window.__FA_QX__;
  await currentApi.ready;
  const currentBadge = document.querySelector('#fa-qx-diagnostic');
  oldHealth.resolve({
    ok: true,
    json: () => Promise.resolve({ ok: true, data: { release: '0.1.0', buildId: oldBuildId, schema: 1 } }),
  });
  await waitFor(() => requests.some((request) => request.buildId === oldBuildId && request.operation === 'config.get'));
  oldConfig.reject(oldError);
  await assert.rejects(oldApi.ready, (error) => error && error.message === 'FA_QX_UNKNOWN');
  assert.equal(window.__FA_QX__, currentApi);
  assert.equal(currentApi.state, 'ready');
  assert.equal(document.querySelector('#fa-qx-diagnostic'), currentBadge);
  assert.equal(document.diagnosticCount(), 1);
  assert.doesNotMatch(currentBadge.textContent, /FA_QX_UNKNOWN/);
  assert.notEqual(oldPage.window.__FA_QX__, oldApi);
});

test('bridge only serves the matching runtime health operation', () => {
  const asset = runAsset().body;
  const buildId = asset.match(/buildId: '([0-9a-f]{12})'/)[1];
  const success = runBridge(JSON.stringify({ operation: 'runtime.health', payload: {}, release: '0.1.0', buildId }));
  assert.equal(success.status, 'HTTP/1.1 200 OK');
  assert.deepEqual(JSON.parse(success.body), {
    ok: true,
    data: { release: '0.1.0', buildId, coreVersion: null, schema: 1 },
  });
  const denied = runBridge(JSON.stringify({ operation: 'profile.read', payload: {}, release: '0.1.0', buildId }));
  assert.equal(denied.status, 'HTTP/1.1 403 Forbidden');
  assert.equal(JSON.parse(denied.body).error, 'FA_QX_OPERATION_DENIED');
});

test('bridge rejects malformed JSON', () => {
  const result = runBridge('{"operation":');
  assert.equal(result.status, 'HTTP/1.1 400 Bad Request');
  assert.equal(JSON.parse(result.body).ok, false);
});

test('bridge rejects mismatched runtime versions', () => {
  const buildId = runAsset().body.match(/buildId: '([0-9a-f]{12})'/)[1];
  const result = runBridge(JSON.stringify({
    operation: 'runtime.health',
    payload: {},
    release: '0.1.1',
    buildId,
  }));
  assert.equal(result.status, 'HTTP/1.1 400 Bad Request');
  assert.equal(JSON.parse(result.body).error, 'FA_QX_VERSION_MISMATCH');
});

test('bridge rejects a body whose UTF-8 bytes exceed the limit', () => {
  const buildId = runAsset().body.match(/buildId: '([0-9a-f]{12})'/)[1];
  const body = JSON.stringify({
    operation: 'runtime.health',
    release: '0.1.0',
    buildId,
    payload: { text: '😀'.repeat(131200) },
  });
  assert.ok(body.length < 524288);
  assert.ok(Buffer.byteLength(body, 'utf8') > 524288);
  const result = runBridge(body);
  assert.equal(result.status, 'HTTP/1.1 400 Bad Request');
  assert.equal(JSON.parse(result.body).error, 'FA_QX_BODY_TOO_LARGE');
});
