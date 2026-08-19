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
  assert.match(source, /\.fa-my-contrib-exclusive-header\{flex-wrap:wrap!important;min-width:0!important/);
  assert.match(source, /\.fa-my-contrib-exclusive-pager\{gap:8px!important;flex-wrap:wrap!important;min-width:0!important;max-width:100%!important/);
  assert.match(source, /\.fa-my-contrib-exclusive-pager button\{min-height:44px!important/);
  assert.match(source, /#faContribBack[\s\S]*min-height:44px/);
  assert.match(source, /function faRememberContributionScroll\(\)/);
  assert.match(source, /function faRestoreContributionScroll\(\)/);
});

test('stacks Shared Distribution Detail and preserves tap drill-down', () => {
  const source = readSource();
  for (const hook of [
    'fa-share-detail-view',
    'fa-share-detail-columns',
    'fa-share-detail-analysis',
    'fa-share-detail-games',
  ]) assert.match(source, new RegExp(hook));

  assert.match(source, /\.fa-share-detail-columns\{display:grid!important;grid-template-columns:1fr!important/);
  assert.match(source, /\.fa-share-detail-games a\[data-fa-appid\]\{white-space:normal!important/);
  assert.match(source, /fa-share-detail-games-list/);
  assert.match(source, /#familyAnalysisPanel \.fa-share-detail-games-list\{overflow:visible!important\}/);
  assert.match(source, /onClick:\s*function\(evt, elements\)[\s\S]*renderShareDetailOverlay\(\)/);
  assert.match(source, /#faShareDetailBack[\s\S]*min-height:44px/);
});

test('keeps padded contribution cards and controls inside narrow mobile containers', () => {
  const source = readSource();
  assert.match(
    source,
    /@media\(max-width:600px\)[\s\S]*\[data-fa-tab="contribution"\],#familyAnalysisPanel \[data-fa-tab="contribution"\] \*\{box-sizing:border-box!important\}/,
  );
  assert.match(source, /\.fa-contrib-chart-card\{[^}]*width:100%/);
  assert.match(source, /\.fa-my-contrib-primary,#familyAnalysisPanel \.fa-my-contrib-exclusive\{[^}]*width:100%/);
  assert.match(source, /\.fa-share-detail-analysis,#familyAnalysisPanel \.fa-share-detail-games\{[^}]*width:100%/);
});

test('separates the overview membership card from a two-column mobile KPI grid', () => {
  const source = readSource();
  assert.match(source, /class="fa-contrib-join"/);
  assert.match(source, /class="fa-contrib-kpis"/);
  assert.match(source, /\.fa-contrib-summary\{display:grid!important;grid-template-columns:1fr!important/);
  assert.match(source, /\.fa-contrib-join\{display:block!important;grid-column:1\/-1\}/);
  assert.match(source, /\.fa-contrib-kpis\{display:grid!important;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important;gap:8px!important\}/);
});

test('makes overview and game-row primary actions full-size mobile targets', () => {
  const source = readSource();
  assert.match(source, /#faViewMyContrib\{min-height:44px!important;min-width:44px!important\}/);
  assert.equal((source.match(/class="fa-contrib-game-row"/g) || []).length, 4);
  assert.equal((source.match(/class="fa-contrib-game-link"[^>]*data-fa-appid=/g) || []).length, 4);
  assert.equal((source.match(/class="fa-contrib-game-title" data-fa-game-name/g) || []).length, 4);
  assert.match(source, /\.fa-contrib-game-row\{min-height:44px!important/);
  assert.match(source, /\.fa-contrib-game-link\{min-height:44px!important;min-width:44px!important/);
  assert.match(source, /<\/a>'\s*\+ '<span style="font-size:9px;padding:2px 6px/);
});

test('opens both contribution overlays at the top and restores the saved overview offset', () => {
  const source = readSource();
  const myStart = source.indexOf('function renderMyContributionOverlay()');
  const sharedStart = source.indexOf('function renderShareDetailOverlay()');
  const sharedEnd = source.indexOf('// ===================== 游玩动态渲染', sharedStart);
  const myRenderer = source.slice(myStart, sharedStart);
  const sharedRenderer = source.slice(sharedStart, sharedEnd);

  assert.match(source, /function faResetContributionScroll\(\)[\s\S]*scroller\.scrollTop = 0/);
  assert.match(myRenderer, /faRememberContributionScroll\(\)[\s\S]*overlay\.innerHTML = html;\s*faResetContributionScroll\(\)/);
  assert.match(sharedRenderer, /faRememberContributionScroll\(\)[\s\S]*overlay\.innerHTML = html;\s*faResetContributionScroll\(\)/);
  assert.match(source, /defaultView\.style\.display !== 'none'[\s\S]*faContributionScrollTop = scroller\.scrollTop \|\| 0/);
  assert.match(myRenderer, /if \(defaultView\) defaultView\.style\.display = '';\s*faRestoreContributionScroll\(\)/);
  assert.match(sharedRenderer, /if \(defaultView\) defaultView\.style\.display = '';\s*faRestoreContributionScroll\(\)/);
});

test('uses semantic hooks instead of inline-style substring selectors for mobile scrollers', () => {
  const source = readSource();
  assert.doesNotMatch(source, /\[style\*="overflow-y:auto"\]/);
  assert.match(source, /class="fa-contrib-member-legend"/);
  assert.match(source, /\.fa-contrib-member-legend,#familyAnalysisPanel \.fa-my-contrib-list,#familyAnalysisPanel \.fa-share-detail-analysis,#familyAnalysisPanel \.fa-share-detail-games-list\{overflow:visible!important\}/);
});
