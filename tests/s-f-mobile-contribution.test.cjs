const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.resolve(__dirname, '..', 'steam-family-game-analysis.user.js');
const readSource = () => fs.readFileSync(scriptPath, 'utf8');

test('uses Steam navigation entries without a floating mobile launcher', () => {
  const source = readSource();
  assert.doesNotMatch(source, /FA_MOBILE_LAUNCHER|fa-mobile-launcher|faEnsureMobileLauncher/);
  assert.match(source, /setting_btn\.id = "setting_btn"/);
  assert.match(source, /function plugWishlistSibling\(\)/);
  assert.match(source, /function plugDropdown\(\)/);
});
