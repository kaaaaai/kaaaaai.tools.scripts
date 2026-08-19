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
  const { calls } = runQx(readAsset('bridge.js'), { $request: { body } });
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
      nodes.push(node);
      return node;
    },
  };
  return {
    documentElement,
    createElement() {
      return { id: '', textContent: '', style: { cssText: '' } };
    },
    querySelector(selector) {
      return selector === '#fa-qx-diagnostic' ? nodes.find((node) => node.id === 'fa-qx-diagnostic') || null : null;
    },
  };
}

function runPageRuntime({ config = { debug: false }, health, fetchImpl } = {}) {
  const document = documentStub();
  const window = {};
  const postedRequests = [];
  const runtimeHealth = health || { release: '0.1.0', buildId: JSON.parse(fs.readFileSync(path.join(releaseDir, 'manifest.json'), 'utf8')).buildId, schema: 1 };
  const fetch = fetchImpl || ((url, options) => {
    const request = JSON.parse(options.body);
    postedRequests.push(request);
    const data = request.operation === 'runtime.health' ? runtimeHealth : config;
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data }) });
  });
  vm.runInNewContext(pageRuntime(), { window, document, fetch, Promise });
  return { window, document, postedRequests };
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
  assert.match(badge.textContent, /FA_QX_BRIDGE_HTTP_503/);
  assert.doesNotMatch(badge.textContent, new RegExp(responseBody));
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
  const denied = runBridge(JSON.stringify({ operation: 'profile.read', release: '0.1.0', buildId }));
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
