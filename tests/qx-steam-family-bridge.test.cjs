const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runQx } = require('./helpers/run-qx-script.cjs');

const releaseDir = path.resolve(__dirname, '..', 'quantumultx/steam-family/releases/0.1.0');
const bridge = () => fs.readFileSync(path.join(releaseDir, 'bridge.js'), 'utf8');
const releaseManifest = () => JSON.parse(fs.readFileSync(path.join(releaseDir, 'manifest.json'), 'utf8'));
const preferences = new Map();
const failWrites = new Set();
const NS = 'kaaaaai.steam-family-qx.';

function fnv1a(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
}

function reset() {
  preferences.clear();
  failWrites.clear();
}

function call(operation, payload, options = {}) {
  const { release, buildId } = releaseManifest();
  const body = options.body === undefined
    ? JSON.stringify({ operation, payload, release, buildId })
    : options.body;
  const { calls } = runQx(bridge(), {
    $request: { body },
    $prefs: {
      valueForKey(key) { return preferences.has(key) ? preferences.get(key) : null; },
      setValueForKey(value, key) {
        if (failWrites.has(key)) return false;
        preferences.set(key, String(value));
        return true;
      },
      removeValueForKey(key) { return preferences.delete(key); },
    },
  });
  assert.equal(calls.length, 1);
  return { ...JSON.parse(calls[0].body), status: Number(calls[0].status.match(/\d{3}/)[0]) };
}

function manifest(generation, chunks, overrides = {}) {
  return {
    schema: 1,
    generation,
    sourceUpdatedAt: 1700000000000,
    chunks: chunks.length,
    checksum: fnv1a(chunks.join('')),
    ...overrides,
  };
}

function install(generation = 7, chunks = ['alpha', 'bravo']) {
  const index = manifest(generation, chunks);
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    assert.equal(call('index.publish', { phase: 'stage', manifest: index, chunkIndex, chunk: chunks[chunkIndex] }).data.staged, chunkIndex);
  }
  assert.equal(call('index.publish', { phase: 'commit', manifest: index }).data.generation, generation);
  return index;
}

test('bridge returns allowlisted default preferences and records health', { concurrency: false }, () => {
  reset();
  assert.deepEqual(call('config.get', {}).data, {
    autoScan: true,
    storeMarking: true,
    debug: false,
    logLevel: 'warn',
    commands: { rescan: 0, refreshExternal: 0, clearCache: 0 },
    acknowledgements: { rescan: 0, refreshExternal: 0, clearCache: 0 },
  });
  assert.equal(call('unknown.operation', {}).status, 403);
  const health = call('runtime.health', {}).data;
  assert.equal(health.release, releaseManifest().release);
  assert.equal(health.buildId, releaseManifest().buildId);
  assert.deepEqual(Object.keys(JSON.parse(preferences.get(`${NS}health`))).sort(), ['buildId', 'coreVersion', 'release', 'schema', 'timestamp']);
});

test('config.get accepts only the documented preference types', { concurrency: false }, () => {
  reset();
  preferences.set(`${NS}settings.autoScan`, 'false');
  preferences.set(`${NS}settings.storeMarking`, 'invalid');
  preferences.set(`${NS}settings.debug`, true);
  preferences.set(`${NS}settings.logLevel`, 'debug');
  preferences.set(`${NS}commands.rescan`, '8');
  preferences.set(`${NS}commands.refreshExternal`, '-1');
  preferences.set(`${NS}acknowledgements.rescan`, 3);
  preferences.set(`${NS}acknowledgements.clearCache`, 'not-a-number');
  assert.deepEqual(call('config.get', {}).data, {
    autoScan: false,
    storeMarking: true,
    debug: true,
    logLevel: 'debug',
    commands: { rescan: 8, refreshExternal: 0, clearCache: 0 },
    acknowledgements: { rescan: 3, refreshExternal: 0, clearCache: 0 },
  });
});

test('index publishes, reads, and clears a validated compact index', { concurrency: false }, () => {
  reset();
  const chunks = ['alpha', 'bravo'];
  const index = manifest(7, chunks);
  assert.equal(call('index.publish', { phase: 'stage', manifest: index, chunkIndex: 0, chunk: chunks[0] }).data.staged, 0);
  assert.equal(call('index.publish', { phase: 'stage', manifest: index, chunkIndex: 1, chunk: chunks[1] }).data.staged, 1);
  assert.equal(call('index.publish', { phase: 'commit', manifest: index }).data.generation, 7);
  assert.deepEqual(call('index.read', { part: 'manifest' }).data, index);
  assert.equal(call('index.read', { part: 'chunk', generation: 7, chunkIndex: 0 }).data.chunk, chunks[0]);
  assert.equal(call('index.read', { part: 'chunk', generation: 7, chunkIndex: 0 }).data.checksum, fnv1a(chunks[0]));
  assert.equal(call('index.clear', {}).data.cleared, true);
  assert.equal(call('index.read', { part: 'manifest' }).data, null);
});

test('index rejects invalid staged and committed manifests without replacing the installed index', { concurrency: false }, () => {
  reset();
  const oldManifest = install();
  const nextChunks = ['charlie'];
  const nextManifest = manifest(8, nextChunks);
  const rejected = [
    { phase: 'stage', manifest: manifest(8, nextChunks, { schema: 2 }), chunkIndex: 0, chunk: nextChunks[0] },
    { phase: 'stage', manifest: manifest(8, nextChunks, { chunks: 33 }), chunkIndex: 0, chunk: nextChunks[0] },
    { phase: 'stage', manifest: nextManifest, chunkIndex: 1, chunk: nextChunks[0] },
    { phase: 'stage', manifest: nextManifest, chunkIndex: 0, chunk: 'x'.repeat(98305) },
  ];
  for (const payload of rejected) assert.equal(call('index.publish', payload).status, 400);
  assert.equal(call('index.publish', { phase: 'stage', manifest: nextManifest, chunkIndex: 0, chunk: nextChunks[0] }).data.staged, 0);
  assert.equal(call('index.publish', { phase: 'stage', manifest: nextManifest, chunkIndex: 0, chunk: nextChunks[0] }).status, 400);
  assert.equal(call('index.publish', { phase: 'commit', manifest: manifest(8, nextChunks, { checksum: '00000000' }) }).status, 400);
  assert.deepEqual(call('index.read', { part: 'manifest' }).data, oldManifest);
  assert.equal(call('index.read', { part: 'chunk', generation: 7, chunkIndex: 1 }).data.chunk, 'bravo');
  assert.equal(call('index.publish', { phase: 'commit', manifest: oldManifest }).status, 400);
});

test('index read rejects corrupted stored data and staged write failures preserve the old index', { concurrency: false }, () => {
  reset();
  const oldManifest = install();
  const nextManifest = manifest(8, ['charlie']);
  failWrites.add(`${NS}index.staging.8.0`);
  assert.match(call('index.publish', { phase: 'stage', manifest: nextManifest, chunkIndex: 0, chunk: 'charlie' }).error, /FA_QX_PREF_WRITE_FAILED/);
  assert.deepEqual(call('index.read', { part: 'manifest' }).data, oldManifest);
  preferences.set(`${NS}index.manifest`, '{bad json');
  assert.equal(call('index.read', { part: 'manifest' }).error, 'FA_QX_INDEX_CORRUPT');
});

test('index read validates generation and chunk range', { concurrency: false }, () => {
  reset();
  install();
  assert.equal(call('index.read', { part: 'chunk', generation: 6, chunkIndex: 0 }).status, 400);
  assert.equal(call('index.read', { part: 'chunk', generation: 7, chunkIndex: 2 }).status, 400);
  assert.equal(call('index.read', { part: 'chunk', generation: 7, chunkIndex: 0.5 }).status, 400);
});

test('command acknowledgements are constrained to each command counter', { concurrency: false }, () => {
  reset();
  preferences.set(`${NS}commands.rescan`, '5');
  preferences.set(`${NS}acknowledgements.rescan`, '3');
  assert.equal(call('command.ack', { command: 'rescan', id: 4 }).data.acknowledged, 4);
  assert.equal(call('command.ack', { command: 'rescan', id: 4.5 }).status, 400);
  assert.equal(call('command.ack', { command: 'rescan', id: 2 }).status, 400);
  assert.equal(call('command.ack', { command: 'rescan', id: 6 }).status, 400);
  assert.equal(call('command.ack', { command: 'not-allowed', id: 4 }).status, 400);
  assert.equal(preferences.get(`${NS}acknowledgements.rescan`), '4');
});

test('bridge rejects malformed JSON and an over-limit UTF-8 request body', { concurrency: false }, () => {
  reset();
  assert.equal(call(null, null, { body: '{"operation":' }).status, 400);
  const { release, buildId } = releaseManifest();
  const body = JSON.stringify({ operation: 'config.get', payload: { text: '😀'.repeat(131200) }, release, buildId });
  assert.ok(body.length < 524288);
  assert.ok(Buffer.byteLength(body, 'utf8') > 524288);
  const result = call(null, null, { body });
  assert.equal(result.status, 400);
  assert.equal(result.error, 'FA_QX_BODY_TOO_LARGE');
});
