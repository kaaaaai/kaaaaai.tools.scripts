const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const boxjsPath = path.resolve(__dirname, '..', 'quantumultx/steam-family/boxjs.json');
const installUrl = 'https://cdn.jsdelivr.net/gh/kaaaaai/kaaaaai.tools.scripts@main/quantumultx/steam-family/boxjs.json';
const expectedKeys = [
  'kaaaaai.steam-family-qx.settings.autoScan',
  'kaaaaai.steam-family-qx.settings.storeMarking',
  'kaaaaai.steam-family-qx.settings.debug',
  'kaaaaai.steam-family-qx.settings.logLevel',
  'kaaaaai.steam-family-qx.commands.rescan',
  'kaaaaai.steam-family-qx.commands.refreshExternal',
  'kaaaaai.steam-family-qx.commands.clearCache',
  'kaaaaai.steam-family-qx.acknowledgements.rescan',
  'kaaaaai.steam-family-qx.acknowledgements.refreshExternal',
  'kaaaaai.steam-family-qx.acknowledgements.clearCache',
  'kaaaaai.steam-family-qx.health',
];

test('BoxJS metadata exposes only the documented QX controls', () => {
  const boxjs = JSON.parse(fs.readFileSync(boxjsPath, 'utf8'));
  assert.equal(boxjs.id, 'kaaaaai.steam-family-qx.subscription');
  assert.equal(boxjs.repo, 'https://github.com/kaaaaai/kaaaaai.tools.scripts');
  assert.equal(boxjs.apps.length, 1);
  const app = boxjs.apps[0];
  assert.equal(app.id, 'kaaaaai.steam-family-qx');
  assert.deepEqual(app.keys, expectedKeys);
  assert.deepEqual(app.settings.map((setting) => setting.id), expectedKeys.slice(0, 7));
  for (const setting of app.settings) {
    assert.doesNotMatch(setting.id, /token|cookie|password|passphrase|p12|authorization|subscription/i);
  }
});

test('public install documentation uses the BoxJS-compatible JSON transport', () => {
  for (const readmePath of [
    path.resolve(__dirname, '..', 'README.md'),
    path.resolve(__dirname, '..', 'quantumultx/steam-family/README.md'),
  ]) {
    const readme = fs.readFileSync(readmePath, 'utf8');
    assert.match(readme, new RegExp(installUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(readme, /raw\.githubusercontent\.com\/kaaaaai\/kaaaaai\.tools\.scripts\/main\/quantumultx\/steam-family\/boxjs\.json/);
  }
});

test('public QX documentation advertises the installed v2.08 core and complete health badge', () => {
  const readme = fs.readFileSync(path.resolve(__dirname, '..', 'quantumultx/steam-family/README.md'), 'utf8');
  assert.match(readme, /complete Steam Family v2\.08 core/i);
  assert.match(readme, /\| Core \| `2\.08` \|/);
  assert.match(readme, /FA QX 0\.2\.4 · runtime ✓ · bridge ✓ · core 2\.08 ✓ · nav ✓/);
  assert.doesNotMatch(readme, /does \*\*not\*\* yet scan|Core \| `not installed`/i);
});
