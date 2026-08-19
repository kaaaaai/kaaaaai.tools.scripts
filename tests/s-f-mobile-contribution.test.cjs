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

test('stacks My Contribution with sticky mobile navigation', () => {
  const source = readSource();
  for (const hook of [
    'fa-my-contrib-view',
    'fa-contrib-overlay-header',
    'fa-contrib-overlay-kpis',
    'fa-my-contrib-columns',
    'fa-my-contrib-primary',
    'fa-my-contrib-exclusive',
  ]) assert.match(source, new RegExp(hook));

  assert.match(source, /\.fa-contrib-overlay-header\{position:sticky!important;top:0/);
  assert.match(source, /\.fa-contrib-overlay-kpis\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(source, /\.fa-my-contrib-columns\{display:grid!important;grid-template-columns:1fr!important/);
  assert.match(source, /#familyAnalysisPanel \.fa-panel-content\{overflow-y:auto!important;overflow-x:hidden!important/);
  assert.match(source, /#familyAnalysisPanel \[data-fa-tab="contribution"\]\{overflow:visible!important\}/);
  assert.match(source, /\.fa-contrib-default \[style\*="overflow-y:auto"\],#familyAnalysisPanel \.fa-my-contrib-view \[style\*="overflow-y:auto"\]\{overflow:visible!important\}/);
  assert.match(source, /\.fa-my-contrib-exclusive-header\{flex-wrap:wrap!important;min-width:0!important/);
  assert.match(source, /\.fa-my-contrib-exclusive-pager\{gap:8px!important;flex-wrap:wrap!important;min-width:0!important;max-width:100%!important/);
  assert.match(source, /\.fa-my-contrib-exclusive-pager button\{min-height:44px!important/);
  assert.match(source, /#faContribBack[\s\S]*min-height:44px/);
  assert.match(source, /function faRememberContributionScroll\(\)/);
  assert.match(source, /function faRestoreContributionScroll\(\)/);
});
