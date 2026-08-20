# Steam App Secondary Family Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rounded fallback family-library pill with a flat full-width Steam-style secondary navigation bar.

**Architecture:** Keep the existing placement resolver and `faStyleTopNavigationEntry(entry, mode)` boundary. Extend only fallback-mode styling and add stable icon/count hooks so the helper can style and animate the entry without generated Steam classes. Package the same userscript source into a new immutable QX release.

**Tech Stack:** JavaScript userscript, DOM APIs, Node.js `node:test`, LinkeDOM, Quantumult X generated rewrite assets.

## Global Constraints

- Fallback width fills the available parent and has a `48px` minimum touch height.
- Fallback background is `#171d25`, with no radius, capsule outline, or shadow.
- Fallback horizontal padding is `20px`; content is left aligned and vertically centered.
- Only subtle top and bottom divider lines remain.
- Icon is `16px` and `#66c0f4`; label is `14px` and `#dcdedf`; count is `12px` and `#8f98a0`.
- Pointer/touch activation changes icon and label to `#1a9fff`, then restores them.
- Native same-row geometry, click handling, live count updates, hydration delay, duplicate guards, and `nav ✓` semantics remain unchanged.
- Do not add a floating launcher or duplicate entry.
- Keep release directories `0.2.0` through `0.2.3` byte-identical.

---

### Task 1: Implement the Flat Secondary Navigation Style

**Files:**
- Modify: `tests/s-f-mobile-contribution.test.cjs`
- Modify: `steam-family-game-analysis.user.js:558-594,1588-1594`
- Synchronize: `/Users/kaaaaai/Documents/KaiLab/Tools/s-f.js`

**Interfaces:**
- Consumes: `faStyleTopNavigationEntry(entry, mode)` and `mode === 'fallback'`
- Produces: fallback geometry plus `.fa-family-nav-icon`, `.fa-menu-count`, and `data-fa-nav-mode="fallback"` hooks

- [ ] **Step 1: Write the failing fallback-style test**

Replace the capsule assertions with exact Steam secondary-bar behavior:

```js
test('styles the fallback as a flat Steam secondary navigation bar', () => {
  const { faStyleTopNavigationEntry } = loadTopNavigationHelpers();
  const { document } = parseHTML('<a id="entry"><span class="fa-family-nav-icon"></span>家庭库<span class="fa-menu-count">386</span></a>');
  const entry = document.querySelector('#entry');
  faStyleTopNavigationEntry(entry, 'fallback');
  assert.equal(entry.getAttribute('data-fa-nav-mode'), 'fallback');
  assert.equal(entry.style.width, '100%');
  assert.equal(entry.style.minHeight, '48px');
  assert.equal(entry.style.justifyContent, 'flex-start');
  assert.equal(entry.style.padding, '0px 20px');
  assert.equal(entry.style.background, '#171d25');
  assert.equal(entry.style.borderRadius, '0px');
  assert.equal(entry.style.boxShadow, 'none');
  assert.equal(entry.querySelector('.fa-family-nav-icon').style.color, '#66c0f4');
  assert.equal(entry.querySelector('.fa-family-nav-icon').style.marginTop, '0px');
  assert.equal(entry.querySelector('.fa-menu-count').style.fontSize, '12px');
  assert.equal(entry.querySelector('.fa-menu-count').style.color, '#8f98a0');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern='flat Steam secondary navigation bar' tests/s-f-mobile-contribution.test.cjs`

Expected: FAIL because fallback width is `fit-content`, height is `44px`, and radius is `999px`.

- [ ] **Step 3: Implement minimal fallback styling**

In `faStyleTopNavigationEntry`, preserve the inline branch and set the fallback branch to `display:flex`, `width:100%`, `max-width:100%`, `min-height:48px`, `justify-content:flex-start`, `padding:0 20px`, `margin:0`, `align-self:stretch`, `background:#171d25`, `border-radius:0`, `box-shadow:none`, and one-pixel low-opacity top/bottom dividers. Add `data-fa-nav-mode`, style `.fa-family-nav-icon` and `.fa-menu-count`, and keep one-line text.

- [ ] **Step 4: Write and verify activation feedback**

Extend the test to dispatch `pointerdown` and `pointerup`, expecting entry/icon color `#1a9fff` while pressed and restoration to `#dcdedf` / `#66c0f4`. Bind listeners once using `data-fa-nav-press-bound="1"`.

- [ ] **Step 5: Add stable inner hooks and synchronize sources**

Change the icon span to `class="fa-family-nav-icon"` and the count's default color to `#8f98a0`. Run:

```bash
cp steam-family-game-analysis.user.js /Users/kaaaaai/Documents/KaiLab/Tools/s-f.js
cmp steam-family-game-analysis.user.js /Users/kaaaaai/Documents/KaiLab/Tools/s-f.js
```

- [ ] **Step 6: Run the complete userscript test file**

Run: `node --test tests/s-f-mobile-contribution.test.cjs`

Expected: all tests pass with 0 failures.

- [ ] **Step 7: Commit the style change**

```bash
git add steam-family-game-analysis.user.js tests/s-f-mobile-contribution.test.cjs
git commit -m "style: match Steam secondary navigation"
```

### Task 2: Publish QX 0.2.4 and Core 2.08

**Files:**
- Modify: `steam-family-game-analysis.user.js`
- Modify: `scripts/build-qx-steam-family.cjs`
- Modify: `src/quantumultx/steam-family/release.json`
- Modify: `quantumultx/steam-family/README.md`
- Modify: `quantumultx/steam-family/boxjs.json`
- Modify: QX release-version assertions under `tests/`
- Create: `quantumultx/steam-family/releases/0.2.4/*`
- Generate: `quantumultx/steam-family/steam-family.snippet`
- Generate: `quantumultx/steam-family/steam-family-poc.snippet`

**Interfaces:**
- Consumes: flat fallback styling from Task 1
- Produces: immutable runtime `0.2.4`, core `2.08`, and stable subscription metadata

- [ ] **Step 1: Change release tests first**

Update current-release test constants and assertions from `0.2.3` / `2.07` to `0.2.4` / `2.08`, including escaped regular expressions and the public diagnostic string.

- [ ] **Step 2: Run release tests and verify RED**

Run: `node --test tests/qx-steam-family-build.test.cjs tests/qx-steam-family-boxjs.test.cjs tests/qx-steam-family-runtime.test.cjs`

Expected: FAIL because production metadata and `releases/0.2.4` do not exist yet.

- [ ] **Step 3: Update production metadata and rollback documentation**

Set userscript `@version 2.08`, release metadata `0.2.4` / `2.08`, builder validation `2.08`, BoxJS description `0.2.4 / 2.08`, README diagnostic `FA QX 0.2.4 · runtime ✓ · bridge ✓ · core 2.08 ✓ · nav ✓`, and previous-release rollback commit `6eabcc3deb53c038b03758e05368e3a984b11744`.

- [ ] **Step 4: Build twice and verify deterministic output**

Run `node scripts/build-qx-steam-family.cjs` twice and require identical 12-character build IDs in both output and `releases/0.2.4/manifest.json`.

- [ ] **Step 5: Run full verification**

```bash
for file in steam-family-game-analysis.user.js src/quantumultx/steam-family/*.js quantumultx/steam-family/releases/0.2.4/*.js; do node --check "$file"; done
node --test tests/*.test.cjs
git diff --check
cmp steam-family-game-analysis.user.js /Users/kaaaaai/Documents/KaiLab/Tools/s-f.js
cmp quantumultx/steam-family/steam-family.snippet quantumultx/steam-family/steam-family-poc.snippet
git diff --exit-code -- quantumultx/steam-family/releases/0.2.0 quantumultx/steam-family/releases/0.2.1 quantumultx/steam-family/releases/0.2.2 quantumultx/steam-family/releases/0.2.3
```

Expected: all syntax checks and tests pass, both comparisons match, and every earlier release has no diff.

- [ ] **Step 6: Commit and push with the required identity**

```bash
gh auth switch --hostname github.com --user kaaaaai
test "$(gh api user --jq .login)" = kaaaaai
test "$(git remote get-url origin)" = 'git@kaaaaai.github.com:kaaaaai/kaaaaai.tools.scripts.git'
git add quantumultx scripts src steam-family-game-analysis.user.js tests
git commit -m "release: publish Steam secondary navigation"
git push origin main
```

- [ ] **Step 7: Verify GitHub Raw bytes**

Download the stable snippets, BoxJS JSON, README, userscript, manifest, and every `0.2.4` asset with a commit-SHA cache buster. Compare each to the local file with `cmp`, fetch `origin/main`, require matching local/remote SHAs, and require an empty `git status --porcelain`.
