const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const releaseDir = path.join(root, 'quantumultx/steam-family/releases/0.1.0');
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

test('build emits a self-consistent release and stable snippets', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(releaseDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.release, '0.1.0');
  assert.equal(manifest.coreVersion, null);
  assert.equal(manifest.schema, 1);
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
