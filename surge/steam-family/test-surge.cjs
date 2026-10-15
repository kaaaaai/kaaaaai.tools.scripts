const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = __dirname;
const storage = new Map();
function run(name, request, response, getBody = 'upstream body') {
  return new Promise((resolve, reject) => {
    const context = {
      $request: request,
      $response: response,
      $done: resolve,
      $persistentStore: {
        read: key => storage.get(key) ?? null,
        write: (value, key) => { if (value === null) storage.delete(key); else storage.set(key, value); return true; }
      },
      $httpClient: { get: (options, callback) => callback(null, { status: 200 }, getBody) },
      console, Promise, setTimeout
    };
    try {
      vm.runInNewContext(fs.readFileSync(path.join(root, name), 'utf8'), context, { timeout: 5000 });
    } catch (error) { reject(error); }
  });
}

test('runtime is served as a synthetic JavaScript response', async () => {
  const result = await run('runtime-asset.js', { method: 'GET', url: 'https://store.steampowered.com/fa-qx/v1/runtime.js' });
  assert.equal(result.response.status, 200);
  assert.match(result.response.body, /__FA_QX__/);
});

test('bridge uses Surge persistent storage', async () => {
  const request = encodeURIComponent(JSON.stringify({ operation: 'runtime.health', payload: {}, release: '0.2.4', buildId: '435720e3b4fc' }));
  const result = await run('bridge.js', { method: 'GET', url: `https://store.steampowered.com/fa-qx/v1/bridge?request=${request}` });
  assert.equal(result.response.status, 200);
  assert.equal(JSON.parse(result.response.body).ok, true);
  assert.ok(storage.size > 0);
});

test('proxy uses Surge HTTP client and keeps the allowlist', async () => {
  const body = JSON.stringify({ operation: 'external.exchangeRates', payload: {}, release: '0.2.4', buildId: '435720e3b4fc' });
  const result = await run('proxy.js', { method: 'POST', url: 'https://store.steampowered.com/fa-qx/v1/proxy', body }, null, '{"rates":{"USD":0.14}}');
  assert.equal(result.response.status, 200);
  assert.equal(JSON.parse(result.response.body).data.status, 200);
  const denied = await run('proxy.js', { method: 'GET', url: 'https://store.steampowered.com/fa-qx/v1/proxy' });
  assert.equal(denied.response.status, 403);
});

test('asset bridge fetches a library and returns it as JavaScript', async () => {
  const result = await run('asset-asset.js', { method: 'GET', url: 'https://store.steampowered.com/fa-qx/v1/asset/core.js' });
  assert.equal(result.response.status, 200);
  assert.equal(result.response.body, 'upstream body');
});

test('injector adds runtime to Steam HTML', async () => {
  const result = await run('injector.js', { method: 'GET', url: 'https://store.steampowered.com/' }, { body: '<html><head></head><body></body></html>', headers: { 'Content-Type': 'text/html' } });
  assert.match(result.body, /fa-qx\/v1/);
});
