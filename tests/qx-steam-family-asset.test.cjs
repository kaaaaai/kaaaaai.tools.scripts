const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const releaseDir = path.resolve(__dirname, '..', 'quantumultx/steam-family/releases/0.2.4');
const source = () => fs.readFileSync(path.join(releaseDir, 'asset-asset.js'), 'utf8');

function call(url, upstream) {
  const requests = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('asset did not finish')), 1000);
    vm.runInNewContext(source(), {
      $request: { method: 'GET', url },
      $task: { fetch(request) { requests.push(request); return upstream || Promise.resolve({ statusCode: 200, body: 'window.AssetLoaded=true;' }); } },
      $done(result) { clearTimeout(timer); resolve({ result, requests }); },
      Promise,
    });
  });
}

test('asset service maps virtual names to fixed pinned sources', async () => {
  const chart = await call('https://store.steampowered.com/fa-qx/v1/asset/chart.js?release=0.2.4');
  assert.equal(chart.result.status, 'HTTP/1.1 200 OK');
  assert.equal(chart.requests.length, 1);
  assert.equal(chart.requests[0].url, 'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.js');
  assert.equal(chart.result.body, 'window.AssetLoaded=true;');

  const core = await call('https://keylol.com/fa-qx/v1/asset/core.js');
  assert.equal(core.requests[0].url, 'https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/releases/0.2.4/core.js');
});

test('asset service rejects unconfigured hosts and unknown names without an upstream request', async () => {
  for (const url of [
    'https://evil.example/fa-qx/v1/asset/chart.js',
    'https://store.steampowered.com/fa-qx/v1/asset/arbitrary.js',
  ]) {
    const response = await call(url);
    assert.equal(response.result.status, 'HTTP/1.1 404 Not Found');
    assert.equal(response.requests.length, 0);
  }
});

test('asset service returns an empty redacted failure response', async () => {
  const response = await call('https://store.steampowered.com/fa-qx/v1/asset/pinyin.js', Promise.reject(new Error('private detail')));
  assert.equal(response.result.status, 'HTTP/1.1 502 Bad Gateway');
  assert.equal(response.result.body, '');
});
