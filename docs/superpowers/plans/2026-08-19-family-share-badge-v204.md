# Family Share Badge v2.04 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the clipped Steam family-share flag with a deterministic purple text pill while preserving compact horizontal-row badges, then publish v2.04.

**Architecture:** Keep the existing flag creation flow and SVG asset. Add one semantic class for the non-compact variant and isolate all native-Steam overrides to that class, avoiding broad changes to `.ds_flag` or unrelated badges.

**Tech Stack:** JavaScript userscript, CSS strings injected through `GM_addStyle`, Node.js built-in test runner, GitHub raw hosting.

## Global Constraints

- The standard badge is a top-left purple pill containing the existing icon and `家庭共享` text.
- The standard badge is exactly 24 CSS pixels high and its background fully contains the label.
- `.fa-fs-compact` remains an icon-only 20×20 badge for horizontal rows.
- Owned-library flags, bundle badges, contribution views, calculations, storage, and other Steam UI remain unchanged.
- Release version is exactly `2.04`.
- Install and update URL is exactly `https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/steam-family-game-analysis.user.js`.

---

### Task 1: Add Regression Coverage and Implement the Stable Badge

**Files:**
- Modify: `tests/s-f-family-share-badge.test.cjs`
- Modify: `steam-family-game-analysis.user.js:1-525,6823-6840`

**Interfaces:**
- Consumes: existing `FAMILY_SHARE_FLAG_ICON`, `addflag(node, insertBeforeStyle)`, `.fa-fs-compact`.
- Produces: semantic `.fa-fs-standard` class and deterministic standard badge box.

- [ ] **Step 1: Write the failing regression test**

Create `tests/s-f-family-share-badge.test.cjs` to assert:

```js
assert.match(source, /className = "ds_flag ds_family_share_flag fa-fs-standard"/);
assert.match(source, /\.fa-fs-standard\{left:0!important;right:auto!important;width:auto!important;min-width:max-content!important;height:24px!important/);
assert.match(source, /box-sizing:border-box!important/);
assert.match(source, /background-position:5px center!important/);
assert.match(source, /flag\.textContent = '家庭共享'/);
assert.doesNotMatch(source, /家庭共享&nbsp;&nbsp;/);
assert.match(source, /\.fa-fs-compact\{left:0!important;right:auto!important;width:20px!important;height:20px!important/);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/s-f-family-share-badge.test.cjs`

Expected: failure because `.fa-fs-standard` does not exist.

- [ ] **Step 3: Implement the minimal semantic badge fix**

Add `.fa-fs-standard` to the non-compact flag, replace HTML spacing with `textContent`, and inject an explicit top-left, 24px-high, border-box pill rule. Keep `.fa-fs-compact` unchanged.

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
node --check steam-family-game-analysis.user.js
node --test tests/s-f-family-share-badge.test.cjs
node --test tests/s-f-mobile-contribution.test.cjs
node --test /Users/kaaaaai/Documents/KaiLab/Tools/tests/s-f-stay-compat.test.cjs
git diff --check
```

Expected: syntax succeeds; badge test passes; mobile suite reports 10/10; Stay suite reports 21/21; diff check is silent.

- [ ] **Step 5: Commit**

```bash
git add steam-family-game-analysis.user.js tests/s-f-family-share-badge.test.cjs
git commit -m "fix: stabilize family share badge"
```

### Task 2: Release v2.04

**Files:**
- Modify: `steam-family-game-analysis.user.js:1-5`
- Synchronize: `steam-family-game-analysis.user.js` → `/Users/kaaaaai/Documents/KaiLab/Tools/s-f.js`

**Interfaces:**
- Consumes: verified standard badge implementation.
- Produces: synchronized local source and published raw v2.04 userscript.

- [ ] **Step 1: Set exact release metadata**

Set `@version 2.04` and update the description suffix to mention the family-share badge fix. Update the compatibility suite version assertion from `2.03` to `2.04` without removing other coverage.

- [ ] **Step 2: Synchronize and verify**

Run the complete commands from Task 1 Step 4, then:

```bash
cp steam-family-game-analysis.user.js /Users/kaaaaai/Documents/KaiLab/Tools/s-f.js
cmp steam-family-game-analysis.user.js /Users/kaaaaai/Documents/KaiLab/Tools/s-f.js
```

Expected: all tests pass and `cmp` exits 0.

- [ ] **Step 3: Commit release metadata**

```bash
git add steam-family-game-analysis.user.js
git commit -m "chore: release userscript v2.04"
```

- [ ] **Step 4: Verify GitHub identity and publish**

Run:

```bash
gh auth switch --hostname github.com --user kaaaaai
gh api user --jq .login
git push origin main
```

Expected: identity is exactly `kaaaaai`; push succeeds without force.

- [ ] **Step 5: Verify raw release**

Run HTTP header and metadata checks against the exact raw URL. Expected: HTTP 200, `content-type: text/plain`, `@version 2.04`, and both URLs point to `kaaaaai/kaaaaai.tools.scripts`.
