# Steam App Family Navigation Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put `家庭库 <count>` in the Steam App's existing mobile navigation row, with a polished second-row pill only when the row cannot be identified safely.

**Architecture:** Extend the userscript's isolated top-navigation helpers with a bounded ancestor resolver that returns the row and its direct wishlist child. The existing `plug()` flow uses that placement when available and otherwise applies an explicit fallback presentation. The QX builder packages the same userscript core into a new immutable release.

**Tech Stack:** JavaScript userscript, DOM APIs, Node.js `node:test`, LinkeDOM, Quantumult X generated rewrite assets.

## Global Constraints

- The preferred entry text is exactly `家庭库 <count>` and remains on one line.
- Same-row placement must not depend on generated Steam React class names.
- Same-row and fallback targets have a minimum 44px touch height.
- The fallback is a centered compact pill below the navigation, not an edge-to-edge text row.
- Existing click handling, live count updates, hydration delay, duplicate checks, and `nav ✓` semantics remain unchanged.
- Do not add a floating launcher or duplicate family entry.
- Keep release directories `0.2.0`, `0.2.1`, and `0.2.2` byte-identical.

---

### Task 1: Resolve the Native Navigation Row

**Files:**
- Modify: `tests/s-f-mobile-contribution.test.cjs`
- Modify: `steam-family-game-analysis.user.js:498-563`

**Interfaces:**
- Consumes: `faFindTopWishlistLink(root, maxTop) -> Element|null`
- Produces: `faFindTopNavigationPlacement(wishlist, maxTop) -> { row: Element, before: Element }|null`

- [ ] **Step 1: Write the failing row-resolution tests**

Add tests that build a React-like header and verify the smallest shared row and direct insertion child:

```js
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
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test --test-name-pattern='navigation row|broad page container' tests/s-f-mobile-contribution.test.cjs`

Expected: FAIL because `faFindTopNavigationPlacement` is undefined.

- [ ] **Step 3: Implement bounded semantic row discovery**

Inside `FA_TOP_NAV_HELPERS`, add normalized label checks, bounded ancestor traversal, top-area geometry checks, and direct-child resolution. Return only a container that includes distinct menu, wishlist, and wallet labels without page-content text.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `node --test --test-name-pattern='navigation row|broad page container' tests/s-f-mobile-contribution.test.cjs`

Expected: 2 passing tests and 0 failures.

- [ ] **Step 5: Commit the resolver**

```bash
git add tests/s-f-mobile-contribution.test.cjs steam-family-game-analysis.user.js
git commit -m "fix: resolve Steam App navigation row"
```

### Task 2: Apply Same-Row and Fallback Presentation

**Files:**
- Modify: `tests/s-f-mobile-contribution.test.cjs`
- Modify: `steam-family-game-analysis.user.js:1509-1565`
- Modify: `/Users/kaaaaai/Documents/KaiLab/Tools/s-f.js`

**Interfaces:**
- Consumes: `faFindTopNavigationPlacement(wishlist, maxTop)` from Task 1
- Produces: `faStyleTopNavigationEntry(entry, mode)` where `mode` is `inline` or `fallback`

- [ ] **Step 1: Write failing presentation tests**

Add source-level assertions for the exact compact label and both presentation modes:

```js
test('styles the Steam App family entry inline with a polished fallback', () => {
  const source = readSource();
  assert.match(source, /function faStyleTopNavigationEntry\(entry, mode\)/);
  assert.match(source, /fa-family-nav-inline/);
  assert.match(source, /fa-family-nav-fallback/);
  assert.match(source, /minHeight = '44px'/);
  assert.match(source, /whiteSpace = 'nowrap'/);
  assert.match(source, />家庭库<span class="fa-menu-count"/);
});
```

- [ ] **Step 2: Run the focused presentation test and verify RED**

Run: `node --test --test-name-pattern='styles the Steam App family entry' tests/s-f-mobile-contribution.test.cjs`

Expected: FAIL because the styling helper and compact label are absent.

- [ ] **Step 3: Implement minimal presentation behavior**

Add `faStyleTopNavigationEntry(entry, mode)` to apply inline-flex alignment, nowrap, 44px touch height, compact padding, inherited color, and mode-specific classes. In `plug()`, insert before `placement.before` with `inline`; if placement is unavailable, retain the current functional insertion point with `fallback`. Change only the visible label from `我的家庭库` to `家庭库`; preserve `.fa-menu-count`, `onclick`, hydration timing, and navigation reporting.

- [ ] **Step 4: Synchronize the standalone source**

Run: `cp steam-family-game-analysis.user.js /Users/kaaaaai/Documents/KaiLab/Tools/s-f.js`

- [ ] **Step 5: Run focused and complete userscript tests**

Run: `node --test tests/s-f-mobile-contribution.test.cjs`

Expected: all tests pass with 0 failures.

- [ ] **Step 6: Commit presentation behavior**

```bash
git add steam-family-game-analysis.user.js tests/s-f-mobile-contribution.test.cjs
git commit -m "style: align family entry with Steam mobile navigation"
```

### Task 3: Build and Publish the Immutable QX Release

**Files:**
- Modify: `steam-family-game-analysis.user.js`
- Modify: `scripts/build-qx-steam-family.cjs`
- Modify: `src/quantumultx/steam-family/release.json`
- Modify: `quantumultx/steam-family/README.md`
- Modify: `quantumultx/steam-family/boxjs.json`
- Modify: QX release-version assertions under `tests/`
- Create: `quantumultx/steam-family/releases/0.2.3/*`
- Generate: `quantumultx/steam-family/steam-family.snippet`
- Generate: `quantumultx/steam-family/steam-family-poc.snippet`

**Interfaces:**
- Consumes: userscript core with compact navigation placement
- Produces: immutable runtime `0.2.3`, core `2.07`, stable subscription snippets, and matching BoxJS metadata

- [ ] **Step 1: Write failing release assertions**

Update release tests to expect runtime `0.2.3`, core `2.07`, stable asset paths under `releases/0.2.3/`, and diagnostic text containing `core 2.07 ✓ · nav ✓`.

- [ ] **Step 2: Run release tests and verify RED**

Run: `node --test tests/qx-steam-family-build.test.cjs tests/qx-steam-family-boxjs.test.cjs tests/qx-steam-family-runtime.test.cjs`

Expected: FAIL on the old `0.2.2` / `2.06` metadata.

- [ ] **Step 3: Bump metadata and documentation**

Set userscript `@version 2.07`, release metadata `0.2.3` / `2.07`, builder validation `2.07`, BoxJS description `0.2.3 / 2.07`, README status `FA QX 0.2.3 · runtime ✓ · bridge ✓ · core 2.07 ✓ · nav ✓`, and rollback target to immutable commit `1f1d90e33bbb2a8db1b71f4e2925e932bac4b23d`.

- [ ] **Step 4: Build twice and verify deterministic output**

Run:

```bash
node scripts/build-qx-steam-family.cjs
node scripts/build-qx-steam-family.cjs
```

Expected: both builds report the same 12-character build ID for `0.2.3`.

- [ ] **Step 5: Run the full verification suite**

Run:

```bash
for file in steam-family-game-analysis.user.js src/quantumultx/steam-family/*.js quantumultx/steam-family/releases/0.2.3/*.js; do node --check "$file"; done
node --test tests/*.test.cjs
git diff --check
cmp steam-family-game-analysis.user.js /Users/kaaaaai/Documents/KaiLab/Tools/s-f.js
cmp quantumultx/steam-family/steam-family.snippet quantumultx/steam-family/steam-family-poc.snippet
git diff --exit-code -- quantumultx/steam-family/releases/0.2.0 quantumultx/steam-family/releases/0.2.1 quantumultx/steam-family/releases/0.2.2
```

Expected: syntax checks pass, all tests pass with 0 failures, both source/snippet comparisons match, and previous releases have no diff.

- [ ] **Step 6: Commit and publish using the required GitHub identity**

```bash
gh auth switch --hostname github.com --user kaaaaai
test "$(gh api user --jq .login)" = kaaaaai
test "$(git remote get-url origin)" = 'git@kaaaaai.github.com:kaaaaai/kaaaaai.tools.scripts.git'
git add quantumultx scripts src steam-family-game-analysis.user.js tests
git commit -m "release: publish compact Steam App navigation"
git push origin main
```

- [ ] **Step 7: Verify published bytes and repository state**

Download the stable snippets, BoxJS JSON, userscript, manifest, and every `0.2.3` asset from GitHub Raw with a commit-SHA cache buster; compare each file with `cmp`. Then fetch `origin/main`, verify local and remote SHA equality, and require an empty `git status --porcelain`.
