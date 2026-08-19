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

test('defines a single-column mobile contribution overview', () => {
  const source = readSource();
  for (const hook of [
    'fa-contrib-default',
    'fa-contrib-layout',
    'fa-contrib-summary',
    'fa-contrib-chart-card',
    'fa-contrib-side',
    'fa-contrib-footer',
    'fa-contrib-actions',
    'fa-contrib-tap-hint',
  ]) assert.match(source, new RegExp(hook));

  assert.match(source, /@media\(max-width:600px\)[\s\S]*\.fa-contrib-layout\{display:grid!important;grid-template-columns:1fr!important/);
  assert.match(source, /\.fa-contrib-chart-card \[data-contrib-range-toggle\]\{position:static!important/);
  assert.match(source, /\.fa-contrib-actions\{display:grid!important;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(source, /\.fa-contrib-tap-hint\{display:block/);
});
