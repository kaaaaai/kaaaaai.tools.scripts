const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

const scriptPath = path.resolve(__dirname, '..', 'steam-family-game-analysis.user.js');
const readSource = () => fs.readFileSync(scriptPath, 'utf8');
const repoRoot = path.resolve(__dirname, '..');
const readRepoFile = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

function loadTopNavigationHelpers() {
  const source = readSource();
  const start = source.indexOf('// <FA_TOP_NAV_HELPERS>');
  const end = source.indexOf('// </FA_TOP_NAV_HELPERS>');
  assert.notEqual(start, -1, 'top-navigation helpers are missing');
  assert.ok(end > start, 'top-navigation helper boundary is missing');
  const context = {};
  vm.runInNewContext(source.slice(start, end), context);
  return context;
}

function setRect(element, top) {
  element.getBoundingClientRect = () => ({ top, bottom: top + 44, left: 0, right: 100, width: 100, height: 44 });
}

test('publishes updates from the kaaaaai repository', () => {
  const source = readSource();
  const installUrl = 'https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/steam-family-game-analysis.user.js';
  assert.match(source, new RegExp(`^// @downloadURL  ${installUrl.replaceAll('.', '\\.')}$`, 'm'));
  assert.match(source, new RegExp(`^// @updateURL    ${installUrl.replaceAll('.', '\\.')}$`, 'm'));
  assert.doesNotMatch(source, /raw\.githubusercontent\.com\/LeonInNB\/kaaaaai\.tools\.scripts/);

  for (const relativePath of [
    'README.md',
    'docs/superpowers/specs/2026-08-19-mobile-contribution-layout-design.md',
    'docs/superpowers/plans/2026-08-19-mobile-contribution-layout.md',
  ]) {
    const artifact = readRepoFile(relativePath);
    assert.match(artifact, /kaaaaai\/kaaaaai\.tools\.scripts/);
    assert.doesNotMatch(artifact, /LeonInNB\/kaaaaai\.tools\.scripts/);
  }
});

test('uses Steam navigation entries without a floating mobile launcher', () => {
  const source = readSource();
  assert.doesNotMatch(source, /FA_MOBILE_LAUNCHER|fa-mobile-launcher|faEnsureMobileLauncher/);
  assert.match(source, /setting_btn\.id = "setting_btn"/);
  assert.match(source, /function plugWishlistSibling\(\)/);
  assert.match(source, /function plugDropdown\(\)/);
});

test('finds the Steam App wishlist tab when its React top bar is not a semantic header', () => {
  const { faFindTopWishlistLink } = loadTopNavigationHelpers();
  const { document } = parseHTML('<main><a id="content" href="/wishlist/">查看您愿望单里的所有游戏</a></main><div class="react-topbar"><a id="top" href="/wishlist/profiles/76561198000000000/">愿望单 33</a></div>');
  setRect(document.querySelector('#content'), 900);
  setRect(document.querySelector('#top'), 290);
  assert.equal(faFindTopWishlistLink(document, 420).id, 'top');
});

test('finds the Steam App wishlist tab when React renders it without a link', () => {
  const { faFindTopWishlistLink } = loadTopNavigationHelpers();
  const { document } = parseHTML('<div class="react-topbar"><div id="menu" role="button">菜单</div><div id="top" role="button"><span>愿望单</span><span>33</span></div><div role="button">钱包（¥ 27.48）</div></div>');
  setRect(document.querySelector('#top'), 290);
  setRect(document.querySelector('#top span'), 290);
  assert.equal(faFindTopWishlistLink(document, 420).id, 'top');
});

test('resolves the smallest Steam App navigation row and direct wishlist child', () => {
  const { faFindTopNavigationPlacement } = loadTopNavigationHelpers();
  const { document } = parseHTML('<div id="shell"><div id="row"><div role="button">菜单</div><div id="wish-wrap"><span id="wish">愿望单</span></div><div role="button">钱包（¥ 27.48）</div></div><main>精选和推荐</main></div>');
  setRect(document.querySelector('#row'), 270);
  setRect(document.querySelector('#wish'), 290);
  const placement = faFindTopNavigationPlacement(document.querySelector('#wish'), 420);
  assert.equal(placement.row.id, 'row');
  assert.equal(placement.before.id, 'wish-wrap');
});

test('rejects a broad page container as a Steam App navigation row', () => {
  const { faFindTopNavigationPlacement } = loadTopNavigationHelpers();
  const { document } = parseHTML('<div id="page"><span id="wish">愿望单</span><main>菜单 钱包 精选和推荐</main></div>');
  setRect(document.querySelector('#page'), 0);
  setRect(document.querySelector('#wish'), 290);
  assert.equal(faFindTopNavigationPlacement(document.querySelector('#wish'), 420), null);
});

test('styles the Steam App family entry inline with a polished fallback', () => {
  const { faStyleTopNavigationEntry } = loadTopNavigationHelpers();
  const { document } = parseHTML('<a id="inline"></a><a id="fallback"></a>');
  const inline = document.querySelector('#inline');
  const fallback = document.querySelector('#fallback');

  faStyleTopNavigationEntry(inline, 'inline');
  assert.equal(inline.classList.contains('fa-family-nav-inline'), true);
  assert.equal(inline.style.minHeight, '44px');
  assert.equal(inline.style.whiteSpace, 'nowrap');
  assert.equal(inline.style.display, 'inline-flex');

  faStyleTopNavigationEntry(fallback, 'fallback');
  assert.equal(fallback.classList.contains('fa-family-nav-fallback'), true);
  assert.equal(fallback.style.minHeight, '44px');
  assert.equal(fallback.style.borderRadius, '999px');
  assert.equal(fallback.style.alignSelf, 'center');

  const source = readSource();
  assert.match(source, />家庭库<span class="fa-menu-count"/);
  assert.doesNotMatch(source, /<\/span>我的家庭库<span class="fa-menu-count"/);
});

test('finds the compact Steam App logo bar when wishlist navigation is absent', () => {
  const { faFindTopSteamLogoLink } = loadTopNavigationHelpers();
  const { document } = parseHTML('<main><a id="promo" href="/"><span>STEAM FEST</span></a></main><div class="compact-topbar"><a id="logo" href="/"><img alt="STEAM"></a></div>');
  setRect(document.querySelector('#promo'), 800);
  setRect(document.querySelector('#logo'), 150);
  assert.equal(faFindTopSteamLogoLink(document, 320).id, 'logo');
});

test('finds a compact Steam App logo control even when it is not an anchor', () => {
  const { faFindTopSteamLogoLink } = loadTopNavigationHelpers();
  const { document } = parseHTML('<div class="compact-topbar"><button id="logo-control" aria-label="Steam"><img alt="STEAM"></button></div>');
  setRect(document.querySelector('#logo-control'), 150);
  setRect(document.querySelector('img'), 150);
  assert.equal(faFindTopSteamLogoLink(document, 320).id, 'logo-control');
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
  assert.match(source, /#familyAnalysisPanel \.fa-panel-content\{[^}]*overscroll-behavior:contain!important/);
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
