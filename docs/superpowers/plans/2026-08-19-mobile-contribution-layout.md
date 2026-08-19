# Mobile Contribution Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the floating mobile launcher and make the contribution overview, My Contribution, and Shared Distribution Detail usable as single-column mobile views without changing desktop behavior.

**Architecture:** Keep the existing single userscript and renderers. Add stable class hooks to the current generated markup, apply narrowly scoped `max-width:600px` CSS, and preserve all calculations and Chart.js data paths. Use a focused Node source-regression suite because the UI is generated inside one standalone userscript.

**Tech Stack:** JavaScript userscript, DOM/CSS, Chart.js 4.4.2, Node.js `node:test`, Git, GitHub raw userscript distribution.

## Global Constraints

- Mobile rules apply only at viewport widths up to 600px.
- Desktop layout above 600px must remain unchanged.
- Do not change contribution calculations, persisted data, Chart.js dependency, or non-contribution tabs.
- Do not create a separate mobile renderer or add runtime dependencies.
- All mobile interactive controls must be at least 44×44 CSS pixels with 8px separation where adjacent.
- Contribution views use one vertical scroll axis and must not introduce horizontal page scrolling.
- Preserve existing safe-area padding and Steam dark-theme colors.
- Release version is exactly `2.03`.
- Repository update and download URLs remain `https://raw.githubusercontent.com/LeonInNB/kaaaaai.tools.scripts/main/steam-family-game-analysis.user.js`.

## File Map

- Modify: `steam-family-game-analysis.user.js` — the published userscript, generated contribution markup, Chart.js interaction, mobile CSS, and metadata.
- Create: `tests/s-f-mobile-contribution.test.cjs` — focused static regression checks for the published standalone script.
- Synchronize after verification: `/Users/kaaaaai/Documents/KaiLab/Tools/s-f.js` — local working copy used by the original compatibility test suite.
- Verify: `/Users/kaaaaai/Documents/KaiLab/Tools/tests/s-f-stay-compat.test.cjs` — existing Stay/Safari regression suite run against `/Users/kaaaaai/Documents/KaiLab/Tools/s-f.js`.
- Existing design source: `docs/superpowers/specs/2026-08-19-mobile-contribution-layout-design.md`.

---

### Task 1: Remove the Floating Launcher and Establish Regression Coverage

**Files:**
- Create: `tests/s-f-mobile-contribution.test.cjs`
- Modify: `steam-family-game-analysis.user.js:272-302,498-507,1475-1476,1521,4-5`

**Interfaces:**
- Consumes: existing Steam header functions `init()`, `plug()`, `plugWishlistSibling()`, and `plugDropdown()`.
- Produces: a userscript with no `faEnsureMobileLauncher`/`fa-mobile-launcher` code and a reusable source test harness.

- [ ] **Step 1: Write the failing launcher-removal test**

Create `tests/s-f-mobile-contribution.test.cjs`:

```js
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
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test tests/s-f-mobile-contribution.test.cjs
```

Expected: FAIL because `FA_MOBILE_LAUNCHER`, `fa-mobile-launcher`, and `faEnsureMobileLauncher` are present.

- [ ] **Step 3: Remove the floating launcher and bump metadata**

Delete every line from the opening marker through the closing marker so the compatibility adapter is followed directly by the existing global declarations:

```js
})();
// </FA_COMPAT>

var dialog,appid,observer
```

Delete the bootstrap immediately after `readstorage()`, delete both calls inside `init()`, and delete the call from `updateMenuBadge()`. Keep `window.__faOpenFamilyPanel = btnonclick;` only if another call site uses it; otherwise remove it as launcher-only state.

Set metadata to:

```js
// @version      2.03
// @description  扫描 Steam 家庭库库存，在游戏页面标记已有游戏，并提供家庭库数据分析。v2.03: 移除移动端浮动入口并优化贡献页面的 Mobile Safari 布局。
```

- [ ] **Step 4: Run the focused test and syntax check**

Run:

```bash
node --check steam-family-game-analysis.user.js
node --test tests/s-f-mobile-contribution.test.cjs
```

Expected: syntax check exits 0; 1 test passes.

- [ ] **Step 5: Commit Task 1**

```bash
git add steam-family-game-analysis.user.js tests/s-f-mobile-contribution.test.cjs
git commit -m "fix: remove mobile floating launcher"
```

---

### Task 2: Make the Contribution Overview a Mobile Vertical Flow

**Files:**
- Modify: `tests/s-f-mobile-contribution.test.cjs`
- Modify: `steam-family-game-analysis.user.js:5452-5485,7735-7746`

**Interfaces:**
- Consumes: `contribRangeBtnHtml()`, `renderContributionExtras()`, `observer_5()`, and existing `data-*` selectors.
- Produces: stable hooks `.fa-contrib-default`, `.fa-contrib-layout`, `.fa-contrib-summary`, `.fa-contrib-chart-card`, `.fa-contrib-side`, `.fa-contrib-footer`, `.fa-contrib-actions`, and `.fa-contrib-tap-hint`.

- [ ] **Step 1: Add failing overview hook and CSS tests**

Append to `tests/s-f-mobile-contribution.test.cjs`:

```js
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
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test tests/s-f-mobile-contribution.test.cjs
```

Expected: FAIL because the stable overview hooks and mobile rules do not exist.

- [ ] **Step 3: Add stable overview markup hooks**

Change the generated overview markup to the following structure while preserving existing inner HTML and IDs:

```js
+ '      <div data-contrib-default class="fa-contrib-default">'
+ '      <div class="fa-contrib-layout" style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;align-items:stretch;">'
+ '        <div class="fa-contrib-summary" style="flex:0 0 148px;min-width:130px;display:flex;flex-direction:column;gap:6px;">' + myJoinHtml + kpiColHtml + '</div>'
+ '        <div data-chart-bar-card class="fa-contrib-chart-card" style="flex:1 1 380px;min-width:0;position:relative;background:rgba(30,41,59,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;box-shadow:0 4px 24px rgba(0,0,0,0.35);">'
+ '          <div data-contrib-range-toggle class="fa-contrib-range-toggle" style="position:absolute;top:10px;right:12px;display:flex;gap:2px;background:rgba(15,23,42,0.85);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:2px;z-index:5;">' + contribRangeBtnHtml() + '</div>'
+ '          <canvas id="Family_countChart" width="560" height="460" style="display:block;box-sizing:border-box;height:460px;width:560px;max-width:100%;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.2));"></canvas>'
+ '          <div class="fa-contrib-tap-hint">轻触柱状图查看共享分布详情</div>'
+ '        </div>'
+ '        <div class="fa-contrib-side" style="flex:1 1 230px;min-width:210px;display:flex;flex-direction:column;gap:10px;">'
// existing member-donut and halfyear cards
+ '        </div>'
+ '      </div>'
+ '      <div class="fa-contrib-footer" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">'
// existing last scan text
+ '        <div class="fa-contrib-actions" style="display:flex;align-items:center;gap:8px;">'
// existing toggle and export buttons
+ '        </div>'
+ '      </div>'
```

Keep `.fa-contrib-tap-hint` hidden by default so desktop remains visually unchanged.

- [ ] **Step 4: Add scoped overview mobile CSS**

Add the base hidden rule immediately before the existing `@media(max-width:600px)` fragment, then add the remaining selectors inside that existing media block:

```css
.fa-contrib-tap-hint{display:none}
/* the following selectors are inside the existing @media(max-width:600px) block */
  #familyAnalysisPanel .fa-contrib-layout{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
  #familyAnalysisPanel .fa-contrib-summary,#familyAnalysisPanel .fa-contrib-chart-card,#familyAnalysisPanel .fa-contrib-side{width:100%!important;min-width:0!important;flex:none!important}
  #familyAnalysisPanel .fa-contrib-chart-card{padding:12px!important;display:flex!important;flex-direction:column!important;gap:8px!important}
  #familyAnalysisPanel .fa-contrib-chart-card [data-contrib-range-toggle]{position:static!important;align-self:stretch!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;background:transparent!important;border:0!important;padding:0!important}
  #familyAnalysisPanel .fa-contrib-chart-card [data-contrib-range]{min-height:44px!important}
  #familyAnalysisPanel .fa-contrib-side{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
  #familyAnalysisPanel .fa-contrib-footer{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}
  #familyAnalysisPanel .fa-contrib-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;width:100%!important}
  #familyAnalysisPanel .fa-contrib-actions .fa-toggle-switch{grid-column:1/-1;min-height:44px}
  #familyAnalysisPanel .fa-contrib-actions .fa-btn-green{width:100%!important}
  #familyAnalysisPanel .fa-contrib-tap-hint{display:block;text-align:center;color:#8097a8;font-size:11px;line-height:1.4}
```

Because the stylesheet is assembled as JavaScript strings, encode each selector as its own string fragment, for example `+ '.fa-contrib-tap-hint{display:none}'`, without changing selector contents.

- [ ] **Step 5: Run overview tests**

Run:

```bash
node --check steam-family-game-analysis.user.js
node --test tests/s-f-mobile-contribution.test.cjs
```

Expected: syntax check exits 0; 2 tests pass.

- [ ] **Step 6: Commit Task 2**

```bash
git add steam-family-game-analysis.user.js tests/s-f-mobile-contribution.test.cjs
git commit -m "feat: stack contribution overview on mobile"
```

---

### Task 3: Optimize My Contribution for Mobile

**Files:**
- Modify: `tests/s-f-mobile-contribution.test.cjs`
- Modify: `steam-family-game-analysis.user.js:2269-2484,7735-7746`

**Interfaces:**
- Consumes: `renderMyContributionOverlay()`, `#faContribBack`, `myExclusivePage`, existing cover/name loaders.
- Produces: `.fa-contrib-overlay`, `.fa-my-contrib-view`, `.fa-contrib-overlay-header`, `.fa-contrib-overlay-kpis`, `.fa-my-contrib-columns`, `.fa-my-contrib-primary`, and `.fa-my-contrib-exclusive`.

- [ ] **Step 1: Add failing My Contribution tests**

Append:

```js
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
  assert.match(source, /#faContribBack[\s\S]*min-height:44px/);
  assert.match(source, /function faRememberContributionScroll\(\)/);
  assert.match(source, /function faRestoreContributionScroll\(\)/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run `node --test tests/s-f-mobile-contribution.test.cjs`.

Expected: FAIL because the My Contribution hooks and rules are absent.

- [ ] **Step 3: Add My Contribution class hooks**

At the start of `renderMyContributionOverlay()` set:

```js
overlay.className = 'fa-contrib-overlay fa-my-contrib-view';
```

Define scroll preservation once beside the contribution overlay renderers:

```js
var faContributionScrollTop = 0;
function faRememberContributionScroll() {
    var scroller = panel.querySelector('.fa-panel-content');
    var defaultView = panel.querySelector('[data-contrib-default]');
    if (scroller && defaultView && defaultView.style.display !== 'none') {
        faContributionScrollTop = scroller.scrollTop || 0;
    }
}
function faRestoreContributionScroll() {
    var scroller = panel.querySelector('.fa-panel-content');
    if (!scroller) return;
    requestAnimationFrame(function () { scroller.scrollTop = faContributionScrollTop; });
}
```

Call `faRememberContributionScroll()` before hiding the default view. Call `faRestoreContributionScroll()` in the `#faContribBack` handler immediately after restoring the default view. Because the helper records only while the default view is visible, pagination re-renders do not overwrite the saved position.

Change generated wrapper openings to:

```js
html += '<div class="fa-contrib-overlay-header" style="display:flex;align-items:center;gap:10px;flex-shrink:0;">';
html += '<div class="fa-contrib-overlay-kpis" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;flex-shrink:0;">';
html += '<div class="fa-my-contrib-columns" style="display:flex;gap:12px;flex-wrap:wrap;flex:1;min-height:0;">';
html += '<div class="fa-my-contrib-primary" style="flex:1 1 300px;min-width:260px;display:flex;flex-direction:column;gap:12px;">';
html += '<div class="fa-my-contrib-exclusive" style="flex:1 1 300px;min-width:260px;background:rgba(30,41,59,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;box-shadow:0 4px 24px rgba(0,0,0,0.35);display:flex;flex-direction:column;">';
```

Keep all existing contents, pagination IDs, and event binding unchanged.

- [ ] **Step 4: Add My Contribution mobile CSS**

Add these exact mobile rules as stylesheet string fragments:

```css
#familyAnalysisPanel .fa-contrib-overlay{min-width:0!important;overflow:visible!important}
#familyAnalysisPanel .fa-contrib-overlay-header{position:sticky!important;top:0;z-index:8;min-height:52px;padding:4px 0;background:rgba(15,23,42,.96);backdrop-filter:blur(10px)}
#familyAnalysisPanel .fa-contrib-overlay-header button{min-height:44px!important}
#familyAnalysisPanel .fa-contrib-overlay-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}
#familyAnalysisPanel .fa-contrib-overlay-kpis>div:last-child:nth-child(odd){grid-column:1/-1}
#familyAnalysisPanel .fa-my-contrib-columns{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;min-width:0!important}
#familyAnalysisPanel .fa-my-contrib-primary,#familyAnalysisPanel .fa-my-contrib-exclusive{min-width:0!important;width:100%!important;flex:none!important}
#familyAnalysisPanel .fa-my-contrib-view a[data-fa-appid]{white-space:normal!important;overflow-wrap:anywhere}
#familyAnalysisPanel #faContribBack{min-height:44px!important}
#familyAnalysisPanel #faExcPrevPage,#familyAnalysisPanel #faExcNextPage{min-height:44px!important}
```

- [ ] **Step 5: Run My Contribution tests**

Run:

```bash
node --check steam-family-game-analysis.user.js
node --test tests/s-f-mobile-contribution.test.cjs
```

Expected: syntax check exits 0; 3 tests pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add steam-family-game-analysis.user.js tests/s-f-mobile-contribution.test.cjs
git commit -m "feat: adapt My Contribution for mobile"
```

---

### Task 4: Optimize Shared Distribution Detail and Touch Interaction

**Files:**
- Modify: `tests/s-f-mobile-contribution.test.cjs`
- Modify: `steam-family-game-analysis.user.js:2573-2818,6267-6310,7735-7746`

**Interfaces:**
- Consumes: `renderShareDetailOverlay()`, `#faShareDetailBack`, `shareDetailPage`, Chart.js `onClick`.
- Produces: `.fa-share-detail-view`, `.fa-share-detail-columns`, `.fa-share-detail-analysis`, `.fa-share-detail-games`, and touch-safe pagination/back controls.

- [ ] **Step 1: Add failing Shared Detail tests**

Append:

```js
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
  assert.match(source, /onClick:\s*function\(evt, elements\)[\s\S]*renderShareDetailOverlay\(\)/);
  assert.match(source, /#faShareDetailBack[\s\S]*min-height:44px/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run `node --test tests/s-f-mobile-contribution.test.cjs`.

Expected: FAIL because Shared Detail hooks and rules are absent.

- [ ] **Step 3: Add Shared Detail class hooks**

At the start of `renderShareDetailOverlay()` set:

```js
overlay.className = 'fa-contrib-overlay fa-share-detail-view';
```

Call the Task 3 helper `faRememberContributionScroll()` before hiding the default view, and call `faRestoreContributionScroll()` in the `#faShareDetailBack` handler immediately after restoring the default view.

Reuse `.fa-contrib-overlay-header` and `.fa-contrib-overlay-kpis`, then change the two-column wrappers to:

```js
html += '<div class="fa-share-detail-columns" style="display:flex;gap:12px;flex-wrap:wrap;flex:1;min-height:0;">';
html += '<div class="fa-share-detail-analysis" style="flex:1 1 280px;min-width:260px;background:rgba(30,41,59,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;box-shadow:0 4px 24px rgba(0,0,0,0.35);display:flex;flex-direction:column;overflow-y:auto;min-height:0;">';
html += '<div class="fa-share-detail-games" style="flex:1 1 380px;min-width:320px;background:rgba(30,41,59,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;box-shadow:0 4px 24px rgba(0,0,0,0.35);display:flex;flex-direction:column;">';
```

Do not alter `memberContrib`, `ownerDist`, sorting, `shareDetailPage`, or cover/name loading.

- [ ] **Step 4: Add Shared Detail mobile CSS**

Add:

```css
#familyAnalysisPanel .fa-share-detail-columns{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;min-width:0!important}
#familyAnalysisPanel .fa-share-detail-analysis,#familyAnalysisPanel .fa-share-detail-games{min-width:0!important;width:100%!important;flex:none!important;overflow:visible!important}
#familyAnalysisPanel .fa-share-detail-games a[data-fa-appid]{white-space:normal!important;overflow-wrap:anywhere}
#familyAnalysisPanel #faShareDetailBack,#familyAnalysisPanel #faSdPrevPage,#familyAnalysisPanel #faSdNextPage{min-height:44px!important}
```

The current Chart.js `onClick` already supports taps. Keep it unchanged and rely on the new `.fa-contrib-tap-hint` for discoverability.

- [ ] **Step 5: Run all focused tests**

Run:

```bash
node --check steam-family-game-analysis.user.js
node --test tests/s-f-mobile-contribution.test.cjs
```

Expected: syntax check exits 0; 4 tests pass.

- [ ] **Step 6: Commit Task 4**

```bash
git add steam-family-game-analysis.user.js tests/s-f-mobile-contribution.test.cjs
git commit -m "feat: adapt shared contribution detail for mobile"
```

---

### Task 5: Synchronize, Run Full Verification, and Publish v2.03

**Files:**
- Synchronize: `steam-family-game-analysis.user.js` → `/Users/kaaaaai/Documents/KaiLab/Tools/s-f.js`
- Test: `tests/s-f-mobile-contribution.test.cjs`
- Test: `/Users/kaaaaai/Documents/KaiLab/Tools/tests/s-f-stay-compat.test.cjs`

**Interfaces:**
- Consumes: completed v2.03 userscript and both regression suites.
- Produces: verified local source, clean repository state, pushed `main`, and an HTTP 200 install URL serving v2.03.

- [ ] **Step 1: Synchronize the local working copy mechanically**

Run:

```bash
cp steam-family-game-analysis.user.js /Users/kaaaaai/Documents/KaiLab/Tools/s-f.js
```

Expected: `cmp steam-family-game-analysis.user.js /Users/kaaaaai/Documents/KaiLab/Tools/s-f.js` exits 0.

- [ ] **Step 2: Update the existing compatibility metadata expectation**

In `/Users/kaaaaai/Documents/KaiLab/Tools/tests/s-f-stay-compat.test.cjs`, change only the version assertion:

```js
assert.match(source, /^\/\/ @version\s+2\.03$/m);
```

Remove the old test and helper that require the deleted `FA_MOBILE_LAUNCHER` block. Preserve all compatibility, storage, lifecycle, safe-area, and request tests.

- [ ] **Step 3: Run fresh full verification**

Run from `kaaaaai.tools.scripts`:

```bash
node --check steam-family-game-analysis.user.js
node --test tests/s-f-mobile-contribution.test.cjs
node --test /Users/kaaaaai/Documents/KaiLab/Tools/tests/s-f-stay-compat.test.cjs
git diff --check
git status --short
```

Expected:

- syntax check exits 0;
- focused suite reports 4 passing tests and 0 failures;
- Stay compatibility suite reports all remaining tests passing and 0 failures;
- `git diff --check` has no output;
- repository status is clean before publishing (the synchronized parent files are outside this repository).

- [ ] **Step 4: Verify GitHub identity before mutation**

Run:

```bash
gh auth switch --hostname github.com --user LeonInNB
gh api user --jq .login
```

Expected: exact output `LeonInNB`. Stop without pushing if verification fails.

- [ ] **Step 5: Push main and verify the raw install URL**

Run:

```bash
git push origin main
curl -sS -I -L https://raw.githubusercontent.com/LeonInNB/kaaaaai.tools.scripts/main/steam-family-game-analysis.user.js
curl -sS -L https://raw.githubusercontent.com/LeonInNB/kaaaaai.tools.scripts/main/steam-family-game-analysis.user.js | sed -n '1,38p'
```

Expected:

- push succeeds without force;
- raw URL returns HTTP 200 and `content-type: text/plain`;
- remote metadata shows `@version      2.03` and both GitHub raw update URLs.

- [ ] **Step 6: Perform real-device acceptance**

Install/update the raw script in Stay, reload Steam Store, and verify:

1. The top Family Library entry is present and the bottom-right floating entry is absent.
2. Contribution Overview, My Contribution, and Shared Detail have no horizontal scrolling.
3. Range, back, and pagination controls are comfortably tappable.
4. Tapping a contribution bar opens Shared Detail.
5. Portrait/landscape rotation keeps charts inside the panel.
6. Desktop layout remains unchanged above 600px.
