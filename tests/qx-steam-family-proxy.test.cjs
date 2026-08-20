const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const releaseDir = path.resolve(__dirname, '..', 'quantumultx/steam-family/releases/0.2.2');
const proxySource = () => fs.readFileSync(path.join(releaseDir, 'proxy.js'), 'utf8');
const manifest = () => JSON.parse(fs.readFileSync(path.join(releaseDir, 'manifest.json'), 'utf8'));

function call(operation, payload, options = {}) {
  const requests = [];
  const release = manifest();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('proxy did not finish')), 1000);
    const envelope = options.body === undefined
      ? JSON.stringify({ operation, payload, release: release.release, buildId: release.buildId })
      : options.body;
    vm.runInNewContext(proxySource(), {
      $request: {
        method: options.method === undefined ? 'POST' : options.method,
        url: options.url === undefined ? 'https://store.steampowered.com/fa-qx/v1/proxy' : options.url,
        body: envelope,
      },
      $task: {
        fetch(request) {
          requests.push(request);
          return Promise.resolve(options.upstream || { statusCode: 200, status: 'HTTP/1.1 200 OK', body: '{"response":{}}' });
        },
      },
      $done(result) { clearTimeout(timer); resolve({ result, requests }); },
      Promise,
      JSON,
      setTimeout,
      clearTimeout,
    });
  });
}

test('body-aware proxy constructs the Steam family request from a named operation', async () => {
  const token = 'public-test-token.never-persisted';
  const { result, requests } = await call('steam.familyGroup', { token });
  assert.equal(result.status, 'HTTP/1.1 200 OK');
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /^https:\/\/api\.steampowered\.com\/IFamilyGroupsService\/GetFamilyGroupForUser\/v1\//);
  assert.match(requests[0].url, new RegExp(`access_token=${token.replace('.', '\\.')}`));
  assert.doesNotMatch(requests[0].url, /fa-qx\/v1\/proxy/);
  assert.equal(JSON.parse(result.body).data.responseText, '{"response":{}}');
});

test('proxy supports fixed Steam store app-details and wishlist operations for community pages', async () => {
  const details = await call('steam.appDetails', { appIds: ['10', '20'], language: 'schinese', country: 'cn' });
  assert.equal(details.requests.length, 1);
  assert.equal(details.requests[0].url, 'https://store.steampowered.com/api/appdetails?appids=10%2C20&l=schinese&cc=cn');

  const wishlist = await call('steam.wishlist', { kind: 'profiles', identifier: '76561198000000000' });
  assert.equal(wishlist.requests.length, 1);
  assert.equal(wishlist.requests[0].url, 'https://store.steampowered.com/wishlist/profiles/76561198000000000/');
});

test('proxy rejects arbitrary operations, non-POST requests, query routes, and invalid versions before fetching', async () => {
  for (const request of [
    () => call('network.fetch', { url: 'https://evil.example/' }),
    () => call('steam.familyGroup', { token: 'abc' }, { method: 'GET' }),
    () => call('steam.familyGroup', { token: 'abc' }, { url: 'https://store.steampowered.com/fa-qx/v1/proxy?token=abc' }),
    () => call('steam.familyGroup', { token: 'abc' }, { body: '{}' }),
  ]) {
    const { result, requests } = await request();
    assert.equal(requests.length, 0);
    assert.match(JSON.parse(result.body).error, /^FA_QX_/);
  }
});

test('proxy validates operation payloads and redacts upstream failures', async () => {
  const invalid = await call('steam.playerLinks', { token: 'abc', steamIds: ['not-an-id'] });
  assert.equal(invalid.requests.length, 0);
  assert.equal(JSON.parse(invalid.result.body).error, 'FA_QX_PROXY_PAYLOAD_INVALID');

  const failed = await call('external.bundle', {}, { upstream: Promise.reject(new Error('private upstream detail')) });
  assert.equal(JSON.parse(failed.result.body).error, 'FA_QX_PROXY_UPSTREAM_FAILED');
  assert.doesNotMatch(failed.result.body, /private upstream detail/);
});

test('shared core routes active cross-origin playtime calls through the privileged request adapter', () => {
  const core = fs.readFileSync(path.resolve(__dirname, '..', 'steam-family-game-analysis.user.js'), 'utf8');
  for (const name of ['fetchMemberRecentlyPlayed', 'fetchMemberOwnedGamesTotal']) {
    const start = core.indexOf(`function ${name}`);
    const end = core.indexOf('\nfunction ', start + 10);
    const source = core.slice(start, end);
    assert.ok(source.length > 100);
    assert.doesNotMatch(source, /new\s+XMLHttpRequest/);
    assert.match(source, /faGmGetJson/);
  }
});
