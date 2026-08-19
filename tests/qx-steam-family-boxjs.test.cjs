const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const boxjsPath = path.resolve(__dirname, '..', 'quantumultx/steam-family/boxjs.json');
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
