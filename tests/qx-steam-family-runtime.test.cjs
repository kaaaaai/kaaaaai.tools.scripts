const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { runQx } = require('./helpers/run-qx-script.cjs');

const releaseDir = path.resolve(__dirname, '..', 'quantumultx/steam-family/releases/0.2.3');
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
    $request: { method: 'GET', url: `https://store.steampowered.com/fa-qx/v1/bridge?request=${encodeURIComponent(body)}` },
  });
  assert.equal(calls.length, 1);
  return calls[0];
}

function pageRuntime() {
  return runAsset().body;
}

function documentStub() {
  const nodes = [];
  const loadedScripts = [];
  const documentElement = {
    appendChild(node) {
      node.parentNode = documentElement;
      nodes.push(node);
      if (node.tagName === 'SCRIPT') {
        loadedScripts.push(node.src);
        Promise.resolve().then(() => {
          if (typeof document.onScriptAppend === 'function') document.onScriptAppend(node);
          if (typeof node.onload === 'function') node.onload();
        });
      }
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
  const document = {
    documentElement,
    createElement(tagName) {
      return { id: '', tagName: String(tagName || '').toUpperCase(), parentNode: null, textContent: '', src: '', style: { cssText: '' } };
    },
    querySelector(selector) {
      return selector === '#fa-qx-diagnostic' ? nodes.find((node) => node.id === 'fa-qx-diagnostic') || null : null;
    },
    diagnosticCount() {
      return nodes.filter((node) => node.id === 'fa-qx-diagnostic').length;
    },
    loadedScripts,
  };
  return document;
}

function currentScriptStub(buildId = currentBuildId(), release = '0.2.3', src) {
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
  const runtimeHealth = health || { release: '0.2.3', buildId: currentBuildId(), schema: 1 };
  const fetch = fetchImpl || ((url, options) => {
    const request = JSON.parse(decodeURIComponent(url.split('?request=')[1]));
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
    URL,
    AbortController,
    Promise: PromiseImpl,
    setTimeout: setTimeoutImpl,
    clearTimeout: clearTimeoutImpl,
  });
  return { window, document, postedRequests };
}

function requestFromBridgeUrl(url) {
  const marker = '?request=';
  const index = url.indexOf(marker);
  assert.notEqual(index, -1);
  return JSON.parse(decodeURIComponent(url.slice(index + marker.length)));
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
  assert.match(injected, /\/fa-qx\/v1\/runtime\.js\?release=0\.2\.3&build=[0-9a-f]{12}/);
});

test('runtime asset returns the page runtime as JavaScript', () => {
  assert.equal(runAsset().headers['Content-Type'], 'application/javascript; charset=utf-8');
  assert.match(runAsset().body, /window\.__FA_QX__/);
});

test('full-core runtime installs its adapter and loads pinned dependencies before the v2.07 core', async () => {
  const document = documentStub();
  const { window } = runPageRuntime({ document, config: { debug: true } });
  await window.__FA_QX__.ready;
  assert.equal(window.__FA_QX__.coreVersion, '2.07');
  assert.equal(window.__FA_QX__.coreState, 'ready');
  assert.equal(typeof window.GM_getValue, 'function');
  assert.equal(typeof window.GM_xmlhttpRequest, 'function');
  assert.deepEqual(document.loadedScripts.map((src) => src.replace(/\?.*$/, '')), [
    '/fa-qx/v1/asset/chart.js',
    '/fa-qx/v1/asset/pinyin.js',
    '/fa-qx/v1/asset/app-detail.js',
    '/fa-qx/v1/asset/core.js',
  ]);
  assert.match(document.querySelector('#fa-qx-diagnostic').textContent, /core 2\.07 ✓/);
});

test('GM request adapter sends Steam credentials only in the analyze-proxy POST body', async () => {
  const proxyCalls = [];
  const window = { location: { href: 'https://store.steampowered.com/', origin: 'https://store.steampowered.com' } };
  const fetchImpl = (url, options) => {
    if (url === '/fa-qx/v1/proxy') {
      proxyCalls.push({ url, options });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, data: { status: 200, statusText: 'OK', responseText: '{"response":{}}', responseURL: 'https://api.steampowered.com/IFamilyGroupsService/GetFamilyGroupForUser/v1/' } }),
      });
    }
    const request = requestFromBridgeUrl(url);
    const data = request.operation === 'runtime.health'
      ? { release: '0.2.3', buildId: currentBuildId(), schema: 1 }
      : { debug: false };
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data }) });
  };
  const page = runPageRuntime({ window, fetchImpl });
  await page.window.__FA_QX__.ready;
  const token = 'test-token.private-value';
  await new Promise((resolve, reject) => {
    page.window.GM_xmlhttpRequest({
      method: 'GET',
      url: `https://api.steampowered.com/IFamilyGroupsService/GetFamilyGroupForUser/v1/?access_token=${token}&include_family_group_response=true`,
      onload(response) { assert.equal(response.status, 200); resolve(); },
      onerror: reject,
    });
  });
  assert.equal(proxyCalls.length, 1);
  assert.equal(proxyCalls[0].url, '/fa-qx/v1/proxy');
  assert.equal(proxyCalls[0].options.method, 'POST');
  assert.doesNotMatch(proxyCalls[0].url, new RegExp(token.replace('.', '\\.')));
  const envelope = JSON.parse(proxyCalls[0].options.body);
  assert.equal(envelope.operation, 'steam.familyGroup');
  assert.equal(envelope.payload.token, token);
});

test('community runtime hydrates the compact family index before loading the shared core', async () => {
  const compact = JSON.stringify({
    version: 1,
    current: 0,
    members: [['76561198000000000', 'Kai']],
    games: [['10', [0], 1234]],
  });
  const manifest = { schema: 1, generation: 7, sourceUpdatedAt: 1234, chunks: 1, checksum: 'ignored-by-page' };
  const window = { location: { href: 'https://keylol.com/thread-1-1-1.html', origin: 'https://keylol.com', hostname: 'keylol.com', host: 'keylol.com' } };
  const fetchImpl = (url) => {
    const request = requestFromBridgeUrl(url);
    let data;
    if (request.operation === 'runtime.health') data = { release: '0.2.3', buildId: currentBuildId(), schema: 1 };
    else if (request.operation === 'config.get') data = { debug: false };
    else if (request.operation === 'index.read' && request.payload.part === 'manifest') data = manifest;
    else if (request.operation === 'index.read' && request.payload.part === 'chunk') data = { chunk: compact };
    else throw new Error(`unexpected operation ${request.operation}`);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data }) });
  };
  const page = runPageRuntime({ window, fetchImpl });
  await page.window.__FA_QX__.ready;
  const saves = page.window.GM_getValue('saves');
  assert.deepEqual(Array.from(saves.familyGameList.GameList), ['10']);
  assert.deepEqual(Array.from(saves.familyGameList.GameInfo['10'].owners), ['76561198000000000']);
  assert.equal(saves.familyInfo.steamIdtoName['76561198000000000'], 'Kai');
});

test('Steam runtime publishes a compact cross-origin index after the core saves a scan', async () => {
  const requests = [];
  const window = { location: { href: 'https://store.steampowered.com/', origin: 'https://store.steampowered.com', hostname: 'store.steampowered.com', host: 'store.steampowered.com' } };
  const fetchImpl = (url) => {
    const request = requestFromBridgeUrl(url);
    requests.push(request);
    let data;
    if (request.operation === 'runtime.health') data = { release: '0.2.3', buildId: currentBuildId(), schema: 1 };
    else if (request.operation === 'config.get') data = { debug: false };
    else if (request.operation === 'index.read') data = null;
    else if (request.operation === 'index.publish') data = request.payload.phase === 'stage' ? { staged: request.payload.chunkIndex } : { generation: request.payload.manifest.generation };
    else throw new Error(`unexpected operation ${request.operation}`);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data }) });
  };
  const page = runPageRuntime({ window, fetchImpl });
  await page.window.__FA_QX__.ready;
  page.window.GM_setValue('saves', {
    version: 20240501,
    steamid: '76561198000000000',
    lastupDateTime: 1234,
    familyInfo: { family_member: [{ steamid: '76561198000000000', userName: 'Kai' }], steamIdtoName: { '76561198000000000': 'Kai' } },
    familyGameList: { GameList: ['10'], GameInfo: { '10': { name: 'Test Game', owners: ['76561198000000000'], time: 1234 } } },
  });
  await waitFor(() => requests.some((request) => request.operation === 'index.publish' && request.payload.phase === 'commit'));
  const stage = requests.find((request) => request.operation === 'index.publish' && request.payload.phase === 'stage');
  assert.ok(stage);
  const compact = JSON.parse(stage.payload.chunk);
  assert.deepEqual(Array.from(compact.members[0]), ['76561198000000000', 'Kai']);
  assert.deepEqual(Array.from(compact.games[0]), ['10', [0], 1234, 'Test Game']);
  assert.doesNotMatch(JSON.stringify(compact), /token|cookie|authorization/i);
});

test('runtime applies BoxJS scan and marking settings to the loaded shared core', async () => {
  const window = { location: { href: 'https://store.steampowered.com/', origin: 'https://store.steampowered.com', hostname: 'store.steampowered.com', host: 'store.steampowered.com' } };
  const document = documentStub();
  document.onScriptAppend = (script) => {
    if (/\/asset\/core\.js/.test(script.src)) window.saves = { settings: { isAutoScan: true, enableStoreMarking: true } };
  };
  const page = runPageRuntime({ window, document, config: { debug: false, autoScan: false, storeMarking: false, commands: {}, acknowledgements: {} } });
  await page.window.__FA_QX__.ready;
  assert.equal(page.window.saves.settings.isAutoScan, false);
  assert.equal(page.window.saves.settings.enableStoreMarking, false);
});

test('runtime executes pending BoxJS maintenance commands once and acknowledges them', async () => {
  const requests = [];
  const calls = { rescan: 0, bundle: 0, goty: 0, dlc: 0 };
  const window = { location: { href: 'https://store.steampowered.com/', origin: 'https://store.steampowered.com', hostname: 'store.steampowered.com', host: 'store.steampowered.com' } };
  const document = documentStub();
  document.onScriptAppend = (script) => {
    if (!/\/asset\/core\.js/.test(script.src)) return;
    window.saves = { settings: { isAutoScan: true, enableStoreMarking: true } };
    window.scan = () => { calls.rescan += 1; };
    window.faLoadBundleData = () => { calls.bundle += 1; return Promise.resolve(); };
    window.faLoadGotyData = (force) => { assert.equal(force, true); calls.goty += 1; return Promise.resolve(); };
    window.faLoadDlcDatabase = () => { calls.dlc += 1; return Promise.resolve(); };
  };
  const config = {
    debug: false,
    commands: { rescan: 2, refreshExternal: 3, clearCache: 0 },
    acknowledgements: { rescan: 1, refreshExternal: 2, clearCache: 0 },
  };
  const fetchImpl = (url) => {
    const request = requestFromBridgeUrl(url);
    requests.push(request);
    const data = request.operation === 'runtime.health'
      ? { release: '0.2.3', buildId: currentBuildId(), schema: 1 }
      : request.operation === 'config.get'
        ? config
        : { acknowledged: request.payload.id };
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data }) });
  };
  const page = runPageRuntime({ window, document, fetchImpl });
  await page.window.__FA_QX__.ready;
  assert.deepEqual(calls, { rescan: 1, bundle: 1, goty: 1, dlc: 1 });
  assert.deepEqual(requests.filter((request) => request.operation === 'command.ack').map((request) => request.payload), [
    { command: 'rescan', id: 2 },
    { command: 'refreshExternal', id: 3 },
  ]);
});

test('runtime requires page confirmation before clearing QX family data', async () => {
  const requests = [];
  let confirmDone;
  let deleted = false;
  const window = { location: { href: 'https://store.steampowered.com/', origin: 'https://store.steampowered.com', hostname: 'store.steampowered.com', host: 'store.steampowered.com' } };
  const document = documentStub();
  document.onScriptAppend = (script) => {
    if (!/\/asset\/core\.js/.test(script.src)) return;
    window.saves = { settings: {} };
    window.savestorage = (isDelete) => { deleted = isDelete === true; };
    window.faCompat = {
      confirm() {
        return { done(callback) { confirmDone = callback; return this; } };
      },
    };
  };
  const config = {
    debug: false,
    commands: { rescan: 0, refreshExternal: 0, clearCache: 4 },
    acknowledgements: { rescan: 0, refreshExternal: 0, clearCache: 3 },
  };
  const fetchImpl = (url) => {
    const request = requestFromBridgeUrl(url);
    requests.push(request);
    const data = request.operation === 'runtime.health'
      ? { release: '0.2.3', buildId: currentBuildId(), schema: 1 }
      : request.operation === 'config.get'
        ? config
        : request.operation === 'index.clear'
          ? { cleared: true }
          : { acknowledged: request.payload.id };
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data }) });
  };
  const page = runPageRuntime({ window, document, fetchImpl });
  await page.window.__FA_QX__.ready;
  assert.equal(deleted, false);
  assert.equal(requests.some((request) => request.operation === 'index.clear'), false);
  assert.equal(typeof confirmDone, 'function');
  confirmDone();
  await waitFor(() => requests.some((request) => request.operation === 'command.ack' && request.payload.command === 'clearCache'));
  assert.equal(deleted, true);
  assert.deepEqual(requests.filter((request) => request.operation === 'index.clear').length, 1);
});

test('page runtime sends the bridge envelope through an echo-compatible GET URL', async () => {
  const requests = [];
  const fetchImpl = (url, options) => {
    requests.push({ url, options });
    const envelope = JSON.parse(decodeURIComponent(url.split('?request=')[1]));
    const data = envelope.operation === 'runtime.health'
      ? { release: '0.2.3', buildId: currentBuildId(), schema: 1 }
      : { debug: false };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, data }) });
  };
  const { window } = runPageRuntime({ fetchImpl });
  await window.__FA_QX__.ready;

  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.match(request.url, /^\/fa-qx\/v1\/bridge\?request=/);
    assert.equal(request.options.method, 'GET');
    assert.equal(Object.prototype.hasOwnProperty.call(request.options, 'body'), false);
  }
});

test('page runtime surfaces a safe bridge error code from a non-2xx JSON response', async () => {
  const fetchImpl = () => Promise.resolve({
    ok: false,
    status: 400,
    json: () => Promise.resolve({ ok: false, error: 'FA_QX_REQUEST_INVALID' }),
  });
  const { window } = runPageRuntime({ fetchImpl });
  await assert.rejects(window.__FA_QX__.ready, (error) => error && error.message === 'FA_QX_REQUEST_INVALID');
});

test('runtime rejects absent, invalid, and mixed-build currentScript before bridge startup', async () => {
  const buildId = currentBuildId();
  const cases = [
    null,
    { src: currentScriptStub().src },
    currentScriptStub('111111111111'),
    {
      src: `https://store.steampowered.com/fa-qx/v1/runtime.js?release=0.2.3&build=111111111111`,
      getAttribute(name) { return name === 'data-fa-qx-bootstrap' ? buildId : null; },
    },
    {
      src: `https://store.steampowered.com/fa-qx/v1/runtime.js?release=0.1.2&build=${buildId}`,
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
    json: () => Promise.resolve({ ok: true, data: { release: '0.2.3', buildId: currentBuildId(), schema: 1 } }),
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
    json: () => Promise.resolve({ ok: true, data: { release: '0.2.3', buildId: currentBuildId(), schema: 1 } }),
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
  assert.match(badge.textContent, /FA QX 0\.2\.3/);
  assert.match(badge.textContent, /runtime ✓/);
  assert.match(badge.textContent, /bridge ✓/);
  assert.match(badge.style.cssText, /pointer-events:none/);
  assert.match(badge.style.cssText, /env\(safe-area-inset-bottom\)/);
});

test('debug diagnostic reports whether the family navigation entry was inserted', async () => {
  const { window, document } = runPageRuntime({ config: { debug: true } });
  await window.__FA_QX__.ready;
  assert.match(document.querySelector('#fa-qx-diagnostic').textContent, /nav …/);
  window.__FA_QX__.reportNavigation('ready');
  assert.match(document.querySelector('#fa-qx-diagnostic').textContent, /nav ✓/);
  assert.equal(window.__FA_QX__.navState, 'ready');
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
      assert.equal(options.method, 'GET');
      assert.equal(requestFromBridgeUrl(url).operation, 'runtime.health');
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
      assert.equal(options.method, 'GET');
      const request = requestFromBridgeUrl(url);
      postedRequests.push(request);
      if (request.operation === 'runtime.health') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, data: { release: '0.2.3', buildId: currentBuildId(), schema: 1 } }),
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
    assert.equal(options.method, 'GET');
    const request = requestFromBridgeUrl(url);
    requests.push(request);
    if (request.buildId === oldBuildId && request.operation === 'runtime.health') return oldHealth.promise;
    if (request.buildId === oldBuildId && request.operation === 'config.get') return oldConfig.promise;
    const data = request.operation === 'runtime.health'
      ? { release: '0.2.3', buildId: request.buildId, schema: 1 }
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
    json: () => Promise.resolve({ ok: true, data: { release: '0.2.3', buildId: oldBuildId, schema: 1 } }),
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
  const success = runBridge(JSON.stringify({ operation: 'runtime.health', payload: {}, release: '0.2.3', buildId }));
  assert.equal(success.status, 'HTTP/1.1 200 OK');
  assert.deepEqual(JSON.parse(success.body), {
    ok: true,
    data: { release: '0.2.3', buildId, coreVersion: '2.07', schema: 1 },
  });
  const denied = runBridge(JSON.stringify({ operation: 'profile.read', payload: {}, release: '0.2.3', buildId }));
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
    release: '0.1.2',
    buildId,
  }));
  assert.equal(result.status, 'HTTP/1.1 400 Bad Request');
  assert.equal(JSON.parse(result.body).error, 'FA_QX_VERSION_MISMATCH');
});

test('bridge rejects a body whose UTF-8 bytes exceed the limit', () => {
  const buildId = runAsset().body.match(/buildId: '([0-9a-f]{12})'/)[1];
  const body = JSON.stringify({
    operation: 'runtime.health',
    release: '0.2.3',
    buildId,
    payload: { text: '😀'.repeat(131200) },
  });
  assert.ok(body.length < 524288);
  assert.ok(Buffer.byteLength(body, 'utf8') > 524288);
  const result = runBridge(body);
  assert.equal(result.status, 'HTTP/1.1 400 Bad Request');
  assert.equal(JSON.parse(result.body).error, 'FA_QX_BODY_TOO_LARGE');
});
