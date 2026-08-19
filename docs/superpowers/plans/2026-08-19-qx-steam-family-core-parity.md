# Quantumult X Steam Family Core Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the complete Steam Family v2.04 userscript feature core inside the Steam App through Quantumult X, including the top navigation entry, scanning, persistence, markers, and all analysis views.

**Architecture:** The existing QX bootstrap loads a browser adapter, three pinned dependencies, and a generated core copied from the single tracked userscript source. The adapter exposes synchronous in-memory `GM_*` storage hydrated from IndexedDB and maps privileged requests to a POST-only `script-analyze-echo-response` proxy with named allowlisted operations; the existing GET bridge remains responsible for health, configuration, commands, and the compact cross-origin index.

**Tech Stack:** ES5-compatible browser/QX JavaScript, Quantumult X `$task.fetch`, `script-analyze-echo-response`, IndexedDB, Node.js deterministic build scripts, `node:test` and `vm`, Chart.js 4.4.2, SGLV Pinyin 1.1.0, SGLV App Detail 1.1.0.

## Global Constraints

- Publish release `0.2.0` with shared core version `2.04`; preserve immutable `0.1.0` and `0.1.1` directories.
- Keep only the Steam top-navigation “我的家庭库” entry; never add a bottom-right launcher.
- Generate the QX core from `steam-family-game-analysis.user.js`; do not create a separately edited feature fork.
- Never persist or log Steam access tokens, cookies, authorization headers, response bodies, or the private QX profile.
- Send privileged request envelopes only in a same-origin POST body handled by `script-analyze-echo-response`; never place tokens in bridge URLs or `$prefs`.
- The proxy constructs every upstream URL from a fixed named operation and validated fields; page code cannot supply an arbitrary destination.
- Keep the installed `steam-family-poc.snippet` URL working and byte-identical to `steam-family.snippet`.
- Load dependencies and core sequentially; a failed asset leaves host navigation untouched and reports a redacted `FA_QX_CORE_*` code.
- Use TDD for every behavior and preserve all existing userscript and QX tests.

---

### Task 1: Define the deterministic full-core release contract

**Files:**
- Modify: `src/quantumultx/steam-family/release.json`
- Modify: `scripts/build-qx-steam-family.cjs`
- Modify: `tests/qx-steam-family-build.test.cjs`
- Generate: `quantumultx/steam-family/releases/0.2.0/*`

**Interfaces:**
- Consumes: tracked userscript plus four QX source templates.
- Produces: manifest assets `injector.js`, `runtime-asset.js`, `bridge.js`, `proxy.js`, `asset-asset.js`, and `core.js`; `coreVersion: "2.04"`.

- [ ] Add a failing build test requiring release `0.2.0`, core `2.04`, the six exact asset hashes, and snippet routes for `/runtime.js`, `/bridge`, `/proxy`, `/asset/<name>.js`, and HTML injection.
- [ ] Run `node --test tests/qx-steam-family-build.test.cjs`; confirm RED because release 0.1.1 has no full-core assets.
- [ ] Extend metadata with an immutable dependency table containing exact upstream URLs and SHA-256 values, plus the named proxy-operation list.
- [ ] Extend the builder so `core.js` is derived by removing only the userscript metadata block from `steam-family-game-analysis.user.js`; assert the parsed version is exactly `2.04`.
- [ ] Generate the two stable snippets from one string and run the build twice; require byte-identical outputs and immutable-release rejection.
- [ ] Commit the release-contract deliverable.

### Task 2: Install the QX browser compatibility adapter and top entry

**Files:**
- Create: `src/quantumultx/steam-family/core-adapter.js`
- Modify: `src/quantumultx/steam-family/page-runtime.js`
- Modify: `tests/qx-steam-family-runtime.test.cjs`

**Interfaces:**
- Produces: `window.__FA_QX_CORE_ADAPTER__`, `GM_getValue(key, fallback)`, `GM_setValue(key, value)`, `GM_deleteValue(key)`, `GM_addStyle(css)`, `GM_registerMenuCommand()`, `GM_xmlhttpRequest(details)`, and `unsafeWindow`.
- Startup result: `window.__FA_QX__.coreState` equals `loading`, `ready`, or `error` and `coreVersion` equals `2.04` only after the core loads.

- [ ] Add a failing runtime test that simulates ordered script loading and requires dependency order `chart`, `pinyin`, `app-detail`, `core`, followed by a single top entry and no floating launcher.
- [ ] Run the focused test and confirm RED with no core loader or entry.
- [ ] Implement IndexedDB hydration into an in-memory map before core execution; make synchronous GM reads use the map and asynchronous writes update one `qx-gm` object store without exposing secrets.
- [ ] Implement style injection and a no-op menu registry whose commands are mirrored through the existing BoxJS command counters.
- [ ] Load same-origin virtual dependency/core scripts sequentially with release/build query parameters, exact timeout handling, idempotence, and redacted diagnostics.
- [ ] Run focused runtime and mobile-entry tests; confirm GREEN and commit.

### Task 3: Add the body-aware named network proxy

**Files:**
- Create: `src/quantumultx/steam-family/proxy.js`
- Modify: `src/quantumultx/steam-family/core-adapter.js`
- Create: `tests/qx-steam-family-proxy.test.cjs`
- Modify: `tests/qx-steam-family-security.test.cjs`

**Interfaces:**
- Page request: `POST /fa-qx/v1/proxy` with JSON `{ operation, payload, release, buildId }`.
- Response: `{ ok: true, data: { status, statusText, responseText, responseURL } }` or `{ ok: false, error: "FA_QX_*" }`.
- Named operations: `steam.familyGroup`, `steam.sharedApps`, `steam.playerLinks`, `steam.recentGames`, `steam.ownedGames`, `steam.storeItems`, `external.bundle`, `external.dlc`, `external.goty`, `external.exchangeRates`, and `external.augmentedRates`.

- [ ] Add failing proxy tests proving exact method/route/version validation, operation allowlisting, numeric bounds, response-size caps, timeout classification, and error redaction.
- [ ] Add security tests proving token-bearing requests use POST body, no token is written to `$prefs`, proxy URLs never contain tokens, and arbitrary upstream URLs are rejected.
- [ ] Run the focused tests and confirm RED because `proxy.js` does not exist.
- [ ] Implement operation-specific upstream construction and `$task.fetch`; return through exactly one `$done`, cap text responses, and never log request or response data.
- [ ] Implement the page `GM_xmlhttpRequest` adapter: perform same-origin store requests directly, translate every privileged URL pattern into a named operation, preserve callback/abort semantics, and reject unmatched destinations with `FA_QX_PROXY_OPERATION_DENIED`.
- [ ] Replace the two direct cross-origin `XMLHttpRequest` playtime calls in the shared userscript with its existing `faGmGetJson` helper so both build targets use the same request abstraction.
- [ ] Run proxy, security, and userscript tests; confirm GREEN and commit.

### Task 4: Serve pinned dependencies and the generated core

**Files:**
- Create: `src/quantumultx/steam-family/asset.js`
- Modify: `scripts/build-qx-steam-family.cjs`
- Modify: `tests/qx-steam-family-runtime.test.cjs`
- Modify: `tests/qx-steam-family-security.test.cjs`

**Interfaces:**
- Virtual routes: `/fa-qx/v1/asset/chart.js`, `/asset/pinyin.js`, `/asset/app-detail.js`, and `/asset/core.js`.
- Asset handler fetches only metadata-pinned immutable sources; the core route reads the release-pinned repository `core.js`.

- [ ] Add failing tests for exact route-to-source mapping, dependency response content type, upstream failure redaction, and rejection of query-controlled source URLs.
- [ ] Run the focused tests and confirm RED.
- [ ] Implement a fixed asset dispatcher using `$task.fetch`, JavaScript content type, `no-store` during validation, and one `$done` path.
- [ ] Add snippet rules using `script-echo-response` for the four virtual assets while reserving `script-analyze-echo-response` for `/proxy`.
- [ ] Run asset, runtime, build, and security tests; confirm GREEN and commit.

### Task 5: Close BoxJS, documentation, and release verification

**Files:**
- Modify: `quantumultx/steam-family/boxjs.json`
- Modify: `quantumultx/steam-family/README.md`
- Modify: `tests/qx-steam-family-boxjs.test.cjs`
- Modify: `tests/qx-steam-family-poc.test.cjs`

**Interfaces:**
- BoxJS exposes scanning, store marking, debug, log level, rescan, external refresh, and cache clearing without any secret input.
- Successful debug badge reads `FA QX 0.2.0 · runtime ✓ · bridge ✓ · core 2.04 ✓`.

- [ ] Add failing tests for core metadata, commands, current release documentation, stable manual subscription URLs, and the complete success badge.
- [ ] Run focused tests and confirm RED on the 0.1.1 shell-only contract.
- [ ] Update BoxJS and documentation with real full-core behavior, recovery codes, unchanged manual URLs, and immutable 0.1.1 rollback instructions.
- [ ] Build twice; run `node --check` on every generated script, `node --test tests/*.test.cjs`, `git diff --check`, and public secret scans.
- [ ] Switch GitHub CLI to `kaaaaai`, verify the login exactly, commit intentionally, push `main`, and compare every public 0.2.0 asset byte-for-byte with the local release.
- [ ] Perform the real-device acceptance sequence: refresh QX resource, enable debug, reopen Steam, confirm the complete badge and top entry, scan once, reopen the app, and verify the entry/data persist.
