const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const childProcess = require('node:child_process');

const root = path.resolve(__dirname, '..');
const releaseDir = path.join(root, 'quantumultx/steam-family/releases/0.1.0');
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const expectedHosts = ['store.steampowered.com', 'keylol.com', 'steamdb.keylol.com'];
const expectedOperations = ['runtime.health', 'config.get', 'command.ack', 'index.publish', 'index.read', 'index.clear'];

function temporaryBuildRoot() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fa-qx-build-metadata-'));
  fs.mkdirSync(path.join(temporaryRoot, 'src/quantumultx'), { recursive: true });
  fs.cpSync(path.join(root, 'src/quantumultx/steam-family'), path.join(temporaryRoot, 'src/quantumultx/steam-family'), { recursive: true });
  fs.mkdirSync(path.join(temporaryRoot, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(root, 'scripts/build-qx-steam-family.cjs'), path.join(temporaryRoot, 'scripts/build-qx-steam-family.cjs'));
  return temporaryRoot;
}

function runTemporaryBuild(temporaryRoot) {
  return childProcess.spawnSync(process.execPath, ['scripts/build-qx-steam-family.cjs'], {
    cwd: temporaryRoot,
    encoding: 'utf8',
  });
}

test('release metadata is the authoritative complete runtime contract', () => {
  const release = JSON.parse(fs.readFileSync(path.join(root, 'src/quantumultx/steam-family/release.json'), 'utf8'));
  assert.deepEqual(release.hosts, expectedHosts);
  assert.deepEqual(release.operations, expectedOperations);
  assert.equal(release.preferenceNamespace, 'kaaaaai.steam-family-qx');
  assert.equal(release.schema, 1);
  assert.equal(release.indexSchema, 1);
  assert.equal(release.bridgeTimeoutMs, 8000);
});

test('builder rejects missing, invalid, and duplicate runtime metadata', () => {
  const mutations = [
    (release) => { delete release.preferenceNamespace; },
    (release) => { delete release.bridgeTimeoutMs; },
    (release) => { release.hosts.push(release.hosts[0]); },
    (release) => { release.hosts[0] = 'https://store.steampowered.com'; },
    (release) => { release.operations.push(release.operations[0]); },
    (release) => { release.operations[0] = 'Runtime Health'; },
  ];
  for (const mutate of mutations) {
    const temporaryRoot = temporaryBuildRoot();
    const metadataPath = path.join(temporaryRoot, 'src/quantumultx/steam-family/release.json');
    const release = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    mutate(release);
    fs.writeFileSync(metadataPath, JSON.stringify(release, null, 2) + '\n');
    const built = runTemporaryBuild(temporaryRoot);
    assert.notEqual(built.status, 0, `invalid metadata unexpectedly built: ${built.stdout}`);
    assert.match(built.stderr, /FA_QX_METADATA_INVALID/);
  }
});

test('runtime sources consume metadata through generated tokens', () => {
  const bridgeSource = fs.readFileSync(path.join(root, 'src/quantumultx/steam-family/bridge.js'), 'utf8');
  const pageSource = fs.readFileSync(path.join(root, 'src/quantumultx/steam-family/page-runtime.js'), 'utf8');
  for (const token of ['__FA_PREFERENCE_NAMESPACE__', '__FA_SCHEMA__', '__FA_INDEX_SCHEMA__', '__FA_HOSTS__', '__FA_OPERATION_DISPATCH__']) {
    assert.match(bridgeSource, new RegExp(token));
  }
  for (const token of ['__FA_SCHEMA__', '__FA_BRIDGE_TIMEOUT_MS__']) assert.match(pageSource, new RegExp(token));
  const generatedBridge = fs.readFileSync(path.join(releaseDir, 'bridge.js'), 'utf8');
  assert.match(generatedBridge, /var NS = 'kaaaaai\.steam-family-qx\.';/);
  assert.match(generatedBridge, /var HOSTS = \["store\.steampowered\.com","keylol\.com","steamdb\.keylol\.com"\];/);
  assert.doesNotMatch(generatedBridge, /__FA_[A-Z0-9_]+__/);
});

test('build emits a self-consistent release and stable snippets', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(releaseDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.release, '0.1.0');
  assert.equal(manifest.coreVersion, null);
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.indexSchema, 1);
  assert.equal(manifest.preferenceNamespace, 'kaaaaai.steam-family-qx');
  assert.deepEqual(manifest.hosts, expectedHosts);
  assert.deepEqual(manifest.operations, expectedOperations);
  assert.equal(manifest.bridgeTimeoutMs, 8000);
  for (const name of ['injector.js', 'runtime-asset.js', 'bridge.js']) {
    const body = fs.readFileSync(path.join(releaseDir, name), 'utf8');
    assert.equal(manifest.assets[name].sha256, sha256(body));
  }
  const canonical = fs.readFileSync(path.join(root, 'quantumultx/steam-family/steam-family.snippet'), 'utf8');
  const compatible = fs.readFileSync(path.join(root, 'quantumultx/steam-family/steam-family-poc.snippet'), 'utf8');
  assert.equal(compatible, canonical);
  assert.match(canonical, /releases\/0\.1\.0\/injector\.js/);
  assert.match(canonical, /script-echo-response .*releases\/0\.1\.0\/runtime-asset\.js/);
  assert.match(canonical, /script-echo-response .*releases\/0\.1\.0\/bridge\.js/);
});
