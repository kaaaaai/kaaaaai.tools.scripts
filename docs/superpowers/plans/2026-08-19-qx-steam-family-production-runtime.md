# Quantumult X Steam Family Production Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible Quantumult X injection POC with a production bootstrap, versioned same-origin runtime asset, allowlisted bridge, chunked preference store, and BoxJS settings application while preserving the currently installed remote-resource URL.

**Architecture:** Quantumult X injects only a small bootstrap into eligible HTML. The bootstrap requests a page runtime from a same-origin virtual URL; `script-echo-response` handlers serve the runtime and accept a fixed set of local bridge operations backed by `$prefs`. A deterministic Node build writes versioned release assets plus byte-identical canonical and POC-compatible snippets.

**Tech Stack:** Plain ES5-compatible browser and Quantumult X JavaScript, Quantumult X `$response`/`$request`/`$prefs`/`$done`, BoxJS JSON metadata, Node.js `node:test`/`vm`/`crypto`, GitHub Raw.

## Global Constraints

- Never commit, copy, log, or publish `/Users/kaaaaai/Downloads/quantumult_20260819170610.conf` or its backups.
- Never persist Steam access tokens, cookies, authorization headers, P12 data, passphrases, proxy subscriptions, or captured response bodies.
- The currently installed `quantumultx/steam-family/steam-family-poc.snippet` URL must continue to work without a profile edit.
- `steam-family-poc.snippet` and `steam-family.snippet` must be byte-identical generated files.
- Runtime version `0.1.0` is the first production-runtime release; its shared-core version is JSON `null` until Phase 2 installs shared family-library code.
- Page-to-QX calls use named operations only. Phase 1 permits `runtime.health`, `config.get`, `command.ack`, `index.publish`, `index.read`, and `index.clear`.
- Phase 1 does not call external Steam or third-party APIs; `$task.fetch` operation adapters begin in Phase 2.
- The diagnostic badge is hidden by default and appears only when BoxJS debug is enabled or bootstrap failure prevents the preference lookup.
- The QX bridge must return JSON, terminate through exactly one `$done` call, reject unknown operations, cap request bodies at 512 KiB, cap index chunks at 96 KiB each, and cap an index at 32 chunks.
- Full data remains outside `$prefs`; Phase 1 persists only settings, command acknowledgements, runtime health, and the compact-index protocol.
- Use TDD for every task and commit each independently testable deliverable.
- Before every GitHub mutation, run `gh auth switch --hostname github.com --user kaaaaai` and verify `gh api user --jq .login` returns exactly `kaaaaai`.
- Git pushes use `git@kaaaaai.github.com:kaaaaai/kaaaaai.tools.scripts.git`; do not force-push.

## File Structure

### Source and build files

- `src/quantumultx/steam-family/release.json` — release number, schema versions, route prefix, target hosts, and preference namespace.
- `src/quantumultx/steam-family/injector.js` — QX HTML response transformer template.
- `src/quantumultx/steam-family/page-runtime.js` — browser-side bootstrap runtime and bridge client.
- `src/quantumultx/steam-family/bridge.js` — QX echo-response dispatcher, validation, `$prefs` storage, and JSON responses.
- `scripts/build-qx-steam-family.cjs` — deterministic token replacement, asset wrapping, hashing, manifest creation, and stable snippet generation.

### Generated public files

- `quantumultx/steam-family/releases/0.1.0/injector.js` — published response-body script.
- `quantumultx/steam-family/releases/0.1.0/runtime-asset.js` — QX echo-response script serving browser JavaScript.
- `quantumultx/steam-family/releases/0.1.0/bridge.js` — published bridge echo-response script.
- `quantumultx/steam-family/releases/0.1.0/manifest.json` — release, schema, build ID, routes, and SHA-256 values.
- `quantumultx/steam-family/steam-family.snippet` — canonical QX rewrite resource.
- `quantumultx/steam-family/steam-family-poc.snippet` — installed compatibility path, byte-identical to the canonical snippet.
- `quantumultx/steam-family/boxjs.json` — BoxJS subscription containing settings and maintenance switches.

### Tests and documentation

- `tests/helpers/run-qx-script.cjs` — reusable VM harness for `$done`, `$prefs`, `$request`, and `$response`.
- `tests/qx-steam-family-build.test.cjs` — deterministic build, manifest, hash, and snippet assertions.
- `tests/qx-steam-family-runtime.test.cjs` — injector, asset serving, page bootstrap, version handshake, and debug behavior.
- `tests/qx-steam-family-bridge.test.cjs` — operation allowlist, validation, chunk publication, rollback, and command acknowledgement.
- `tests/qx-steam-family-security.test.cjs` — public-artifact credential scan and bridge-route restrictions.
- `quantumultx/steam-family/README.md` — production installation, BoxJS subscription, diagnostics, rollback, and removal instructions.

---

### Task 1: Build a Deterministic End-to-End Runtime Skeleton

**Files:**
- Create: `src/quantumultx/steam-family/release.json`
- Create: `src/quantumultx/steam-family/injector.js`
- Create: `src/quantumultx/steam-family/page-runtime.js`
- Create: `src/quantumultx/steam-family/bridge.js`
- Create: `scripts/build-qx-steam-family.cjs`
- Create: `tests/helpers/run-qx-script.cjs`
- Create: `tests/qx-steam-family-build.test.cjs`
- Create: `tests/qx-steam-family-runtime.test.cjs`
- Generate: `quantumultx/steam-family/releases/0.1.0/*`
- Generate: `quantumultx/steam-family/steam-family.snippet`
- Modify: `quantumultx/steam-family/steam-family-poc.snippet`

**Interfaces:**
- Consumes: QX `$response.body`, `$response.headers`, `$request.url`, `$request.body`, `$done(result)`.
- Produces: `window.__FA_QX__` with `{ release, buildId, bridge(operation, payload) }`; virtual routes `/fa-qx/v1/runtime.js` and `/fa-qx/v1/bridge`; manifest schema `1`.

- [ ] **Step 1: Add the VM harness and failing build contract**

Create `tests/helpers/run-qx-script.cjs`:

```js
const vm = require('node:vm');

function runQx(source, overrides = {}) {
  const calls = [];
  const values = new Map(Object.entries(overrides.prefValues || {}));
  const prefs = overrides.$prefs || {
    valueForKey(key) { return values.has(key) ? values.get(key) : null; },
    setValueForKey(value, key) { values.set(key, String(value)); return true; },
    removeValueForKey(key) { return values.delete(key); },
  };
  const context = {
    $request: overrides.$request,
    $response: overrides.$response,
    $prefs: prefs,
    $done(result) { calls.push(result); },
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(source, context, { timeout: 1000 });
  return { calls, values, context };
}

module.exports = { runQx };
```

Create `tests/qx-steam-family-build.test.cjs` with assertions that initially fail because the builder and release files are absent:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const releaseDir = path.join(root, 'quantumultx/steam-family/releases/0.1.0');
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

test('build emits a self-consistent release and stable snippets', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(releaseDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.release, '0.1.0');
  assert.equal(manifest.coreVersion, null);
  assert.equal(manifest.schema, 1);
  for (const name of ['injector.js', 'runtime-asset.js', 'bridge.js']) {
    const body = fs.readFileSync(path.join(releaseDir, name), 'utf8');
    assert.equal(manifest.assets[name].sha256, sha256(body));
  }
  const canonical = fs.readFileSync(path.join(root, 'quantumultx/steam-family/steam-family.snippet'), 'utf8');
  const compatible = fs.readFileSync(path.join(root, 'quantumultx/steam-family/steam-family-poc.snippet'), 'utf8');
  assert.equal(compatible, canonical);
  assert.match(canonical, /releases\/0\.1\.0\/injector\.js/);
  assert.match(canonical, /script-echo-response .*releases\/0\.1\.0\/runtime-asset\.js/);
  assert.match(canonical, /script-echo-response .*releases\/0\.1\.0\/bridge\.js/);
});
```

- [ ] **Step 2: Run the build test and confirm RED**

Run:

```bash
node --test tests/qx-steam-family-build.test.cjs
```

Expected: FAIL with `ENOENT` for `releases/0.1.0/manifest.json`.

- [ ] **Step 3: Add the exact release contract and minimal runtime sources**

Create `src/quantumultx/steam-family/release.json`:

```json
{
  "release": "0.1.0",
  "coreVersion": null,
  "schema": 1,
  "indexSchema": 1,
  "routePrefix": "/fa-qx/v1",
  "preferenceNamespace": "kaaaaai.steam-family-qx",
  "hosts": [
    "store.steampowered.com",
    "keylol.com",
    "steamdb.keylol.com"
  ]
}
```

Create `src/quantumultx/steam-family/injector.js` as an IIFE that:

```js
(function () {
  var original = typeof $response !== 'undefined' && $response && typeof $response.body === 'string' ? $response.body : '';
  var headers = typeof $response !== 'undefined' && $response && $response.headers ? $response.headers : {};
  var contentType = String(headers['Content-Type'] || headers['content-type'] || '');
  var html = /text\/html|application\/xhtml\+xml/i.test(contentType) || /<(?:!doctype\s+html|html|head|body)\b/i.test(original);
  var marker = 'data-fa-qx-bootstrap="__FA_BUILD_ID__"';
  var body = original;
  if (html && original.indexOf(marker) === -1 && /<\/body\s*>/i.test(original)) {
    var src = '__FA_ROUTE_PREFIX__/runtime.js?release=__FA_RELEASE__&build=__FA_BUILD_ID__';
    var payload = '<script ' + marker + ' src="' + src + '"></script>';
    body = original.replace(/<\/body\s*>/i, payload + '</body>');
  }
  $done({ body: body });
})();
```

Create `src/quantumultx/steam-family/page-runtime.js` with a single public runtime object and a POST-only bridge client:

```js
(function () {
  'use strict';
  if (window.__FA_QX__ && window.__FA_QX__.buildId === '__FA_BUILD_ID__') return;
  function bridge(operation, payload) {
    return fetch('__FA_ROUTE_PREFIX__/bridge', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-FA-QX-Build': '__FA_BUILD_ID__' },
      body: JSON.stringify({ operation: operation, payload: payload || {}, release: '__FA_RELEASE__', buildId: '__FA_BUILD_ID__' })
    }).then(function (response) {
      if (!response.ok) throw new Error('FA_QX_BRIDGE_HTTP_' + response.status);
      return response.json();
    }).then(function (result) {
      if (!result || result.ok !== true) throw new Error(result && result.error ? result.error : 'FA_QX_BRIDGE_INVALID');
      return result.data;
    });
  }
  window.__FA_QX__ = { release: '__FA_RELEASE__', buildId: '__FA_BUILD_ID__', bridge: bridge };
  bridge('runtime.health', {}).catch(function () {});
})();
```

Create the initial `src/quantumultx/steam-family/bridge.js` with exact-operation dispatch:

```js
(function () {
  var request = typeof $request !== 'undefined' && $request ? $request : {};
  var raw = typeof request.body === 'string' ? request.body : '';
  var status = 200;
  var result;
  try {
    if (raw.length > 524288) throw new Error('FA_QX_BODY_TOO_LARGE');
    var input = JSON.parse(raw || '{}');
    if (input.operation !== 'runtime.health') throw new Error('FA_QX_OPERATION_DENIED');
    if (input.release !== '__FA_RELEASE__' || input.buildId !== '__FA_BUILD_ID__') throw new Error('FA_QX_VERSION_MISMATCH');
    result = { ok: true, data: { release: '__FA_RELEASE__', buildId: '__FA_BUILD_ID__', coreVersion: null, schema: 1 } };
  } catch (error) {
    status = /DENIED/.test(String(error.message)) ? 403 : 400;
    result = { ok: false, error: String(error.message || 'FA_QX_BAD_REQUEST') };
  }
  $done({
    status: 'HTTP/1.1 ' + status + (status === 200 ? ' OK' : status === 403 ? ' Forbidden' : ' Bad Request'),
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(result)
  });
})();
```

- [ ] **Step 4: Implement the deterministic builder**

Create `scripts/build-qx-steam-family.cjs`. It must:

1. Read `release.json` and the three source files as UTF-8.
2. Compute `buildId` as the first 12 hexadecimal characters of the SHA-256 of the canonical JSON release object plus the three unmodified source strings.
3. Replace every `__FA_RELEASE__`, `__FA_BUILD_ID__`, and `__FA_ROUTE_PREFIX__` token.
4. Wrap the complete page runtime string in `runtime-asset.js` using `JSON.stringify(pageRuntime)` and one `$done` response with JavaScript content type and `no-store`.
5. Write the three release scripts and then a manifest containing SHA-256 values of their exact written bytes.
6. Generate one snippet string and write it unchanged to both stable snippet paths.

Use these exact snippet rules, substituting the release asset raw URLs:

```text
hostname = store.steampowered.com, keylol.com, steamdb.keylol.com
^https:\/\/(?:store\.steampowered\.com|keylol\.com|steamdb\.keylol\.com)\/fa-qx\/v1\/runtime\.js(?:\?.*)?$ url script-echo-response https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/releases/0.1.0/runtime-asset.js
^https:\/\/(?:store\.steampowered\.com|keylol\.com|steamdb\.keylol\.com)\/fa-qx\/v1\/bridge(?:\?.*)?$ url script-echo-response https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/releases/0.1.0/bridge.js
^https:\/\/store\.steampowered\.com\/(?:\?.*)?$ url script-response-body https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/releases/0.1.0/injector.js
^https:\/\/keylol\.com\/(?:\?.*)?$ url script-response-body https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/releases/0.1.0/injector.js
^https:\/\/steamdb\.keylol\.com\/tooltip(?:[\/?#].*)?$ url script-response-body https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/releases/0.1.0/injector.js
```

The builder must reject a release containing `/`, `..`, or characters outside `[0-9A-Za-z.-]`; assert every source token is fully replaced; create only the explicit `releases/0.1.0` directory; and print `Built QX Steam Family 0.1.0 (` followed by the computed 12-character build ID and `)`.

- [ ] **Step 5: Add runtime tests and run GREEN**

Create `tests/qx-steam-family-runtime.test.cjs` to execute the generated injector and bridge through `runQx`. Include these exact cases:

```js
assert.equal(runInjector('{"ok":true}', { 'Content-Type': 'application/json' }), '{"ok":true}');
assert.equal(runInjector('<html><body>x</body></html>', { 'Content-Type': 'text/html' }).match(/data-fa-qx-bootstrap=/g).length, 1);
assert.equal(runInjector(runInjector('<html><body>x</body></html>', htmlHeaders), htmlHeaders).match(/data-fa-qx-bootstrap=/g).length, 1);
assert.match(injected, /\/fa-qx\/v1\/runtime\.js\?release=0\.1\.0&build=[0-9a-f]{12}/);
assert.equal(runAsset().headers['Content-Type'], 'application/javascript; charset=utf-8');
assert.match(runAsset().body, /window\.__FA_QX__/);
```

Run:

```bash
node scripts/build-qx-steam-family.cjs
node --check quantumultx/steam-family/releases/0.1.0/injector.js
node --check quantumultx/steam-family/releases/0.1.0/runtime-asset.js
node --check quantumultx/steam-family/releases/0.1.0/bridge.js
node --test tests/qx-steam-family-build.test.cjs tests/qx-steam-family-runtime.test.cjs
git diff --check
```

Expected: the build message reports a 12-character build ID; all checks and tests pass; diff check is silent.

- [ ] **Step 6: Commit the runtime skeleton**

```bash
git add src/quantumultx/steam-family scripts/build-qx-steam-family.cjs tests/helpers/run-qx-script.cjs tests/qx-steam-family-build.test.cjs tests/qx-steam-family-runtime.test.cjs quantumultx/steam-family/releases/0.1.0 quantumultx/steam-family/steam-family.snippet quantumultx/steam-family/steam-family-poc.snippet
git commit -m "feat: add Quantumult X production runtime"
```

### Task 2: Add the Allowlisted Preference and Compact-Index Bridge

**Files:**
- Modify: `src/quantumultx/steam-family/bridge.js`
- Create: `tests/qx-steam-family-bridge.test.cjs`
- Regenerate: `quantumultx/steam-family/releases/0.1.0/*`

**Interfaces:**
- Consumes: POST JSON `{ operation, payload, release, buildId }` and QX `$prefs`.
- Produces: six-operation dispatcher; preference keys under `kaaaaai.steam-family-qx.*`; compact-index manifest `{ schema, generation, sourceUpdatedAt, chunks, checksum }`.

- [ ] **Step 1: Write failing bridge tests**

Create tests using one shared `Map` as the preference store. Require:

```js
assert.deepEqual(call('config.get', {}).data, {
  autoScan: true,
  storeMarking: true,
  debug: false,
  logLevel: 'warn',
  commands: { rescan: 0, refreshExternal: 0, clearCache: 0 },
  acknowledgements: { rescan: 0, refreshExternal: 0, clearCache: 0 }
});
assert.equal(call('unknown.operation', {}).status, 403);
assert.equal(call('index.publish', { phase: 'stage', manifest, chunkIndex: 0, chunk: chunks[0] }).data.staged, 0);
assert.equal(call('index.publish', { phase: 'commit', manifest }).data.generation, 7);
assert.deepEqual(call('index.read', { part: 'manifest' }).data, manifest);
assert.equal(call('index.read', { part: 'chunk', generation: 7, chunkIndex: 0 }).data.chunk, chunks[0]);
assert.equal(call('command.ack', { command: 'rescan', id: 4 }).data.acknowledged, 4);
assert.equal(call('index.clear', {}).data.cleared, true);
```

Also test rejection of non-integer command IDs, generation rollback, a manifest declaring more than 32 chunks, a staged chunk over 98,304 characters, out-of-range and duplicate chunk indexes, checksum mismatch, schema mismatch, malformed JSON, a request over 524,288 characters, and simulated `$prefs.setValueForKey` failure. For stage or commit failure, assert the old manifest and old chunks remain readable.

- [ ] **Step 2: Run the bridge tests and confirm RED**

Run:

```bash
node --test tests/qx-steam-family-bridge.test.cjs
```

Expected: FAIL because only `runtime.health` is accepted.

- [ ] **Step 3: Implement exact operation dispatch and validation**

Expand `bridge.js` with these fixed constants and helpers:

```js
var NS = 'kaaaaai.steam-family-qx.';
var ALLOWED = {
  'runtime.health': true,
  'config.get': true,
  'command.ack': true,
  'index.publish': true,
  'index.read': true,
  'index.clear': true
};
var DEFAULTS = {
  autoScan: true,
  storeMarking: true,
  debug: false,
  logLevel: 'warn',
  commands: { rescan: 0, refreshExternal: 0, clearCache: 0 },
  acknowledgements: { rescan: 0, refreshExternal: 0, clearCache: 0 }
};
function readJson(key, fallback) {
  var raw = $prefs.valueForKey(NS + key);
  if (typeof raw !== 'string' || raw === '') return fallback;
  try { return JSON.parse(raw); } catch (_) { return fallback; }
}
function writeJson(key, value) {
  if ($prefs.setValueForKey(JSON.stringify(value), NS + key) !== true) throw new Error('FA_QX_PREF_WRITE_FAILED');
}
function fnv1a(text) {
  var hash = 2166136261;
  for (var i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}
```

`config.get` reads the individual keys `settings.autoScan`, `settings.storeMarking`, `settings.debug`, `settings.logLevel`, `commands.rescan`, `commands.refreshExternal`, `commands.clearCache`, `acknowledgements.rescan`, `acknowledgements.refreshExternal`, and `acknowledgements.clearCache`. BoxJS values are strings, so booleans accept only `true`, `false`, `"true"`, or `"false"`; counters accept only non-negative safe integers or their decimal string form; `logLevel` accepts only `error|warn|info|debug`. Invalid values fall back to their defaults. `runtime.health` writes a credential-free JSON health record containing only release, build ID, core version, schema, and the current millisecond timestamp to `kaaaaai.steam-family-qx.health`.

`index.publish` requires schema `1`, a positive integer generation newer than the installed generation, a non-negative integer `sourceUpdatedAt`, a declared count of 1–32 chunks, and checksum `fnv1a(allChunks.join(''))`. A `phase: "stage"` call carries exactly one `chunkIndex` and one string `chunk` of at most 98,304 characters; write it to ``index.staging.${generation}.${chunkIndex}`` and read it back for equality. A `phase: "commit"` call carries only the manifest; read every declared staging chunk, reject any missing chunk or checksum mismatch, then write `index.manifest` last and remove the prior generation's chunks. On any failure, retain the prior manifest. A later successful generation or `index.clear` removes abandoned staging keys named by the validated incoming/current manifests.

`index.read` with `part: "manifest"` returns the validated manifest or JSON `null` when no index exists. With `part: "chunk"`, it requires the installed generation and an in-range integer `chunkIndex`, reads one chunk, and returns `{ chunk, checksum }`, where `checksum` is `fnv1a(chunk)`. The page fetches chunks individually and validates the full manifest checksum after concatenation. Invalid installed data returns `FA_QX_INDEX_CORRUPT` without partial data.

`command.ack` accepts command names `rescan`, `refreshExternal`, or `clearCache`; its integer ID must be at least the current acknowledgement and no greater than the corresponding current command value. It writes only the corresponding individual acknowledgement key formed as `acknowledgements.` plus the validated command name.

`index.clear` removes the current generation's chunks and manifest only after all key names have been derived from the validated manifest.

- [ ] **Step 4: Rebuild and run bridge verification**

Run:

```bash
node scripts/build-qx-steam-family.cjs
node --test tests/qx-steam-family-build.test.cjs tests/qx-steam-family-runtime.test.cjs tests/qx-steam-family-bridge.test.cjs
git diff --check
```

Expected: all tests pass and regenerated manifest hashes match all assets.

- [ ] **Step 5: Commit the bridge**

```bash
git add src/quantumultx/steam-family/bridge.js tests/qx-steam-family-bridge.test.cjs quantumultx/steam-family/releases/0.1.0
git commit -m "feat: add Quantumult X preference bridge"
```

### Task 3: Add the BoxJS Application and Page Runtime Diagnostics

**Files:**
- Modify: `src/quantumultx/steam-family/page-runtime.js`
- Create: `quantumultx/steam-family/boxjs.json`
- Modify: `tests/qx-steam-family-runtime.test.cjs`
- Create: `tests/qx-steam-family-boxjs.test.cjs`
- Regenerate: `quantumultx/steam-family/releases/0.1.0/*`

**Interfaces:**
- Consumes: `config.get` response and BoxJS keys under `kaaaaai.steam-family-qx.*`.
- Produces: runtime readiness state, optional `#fa-qx-diagnostic`, settings subscription, and maintenance command counters.

- [ ] **Step 1: Write failing BoxJS and browser-runtime tests**

Assert the BoxJS file has one app with ID `kaaaaai.steam-family-qx`, repository URL `https://github.com/kaaaaai/kaaaaai.tools.scripts`, and keys for settings, commands, acknowledgements, and health. Assert no setting ID contains `token`, `cookie`, `password`, `passphrase`, `p12`, `authorization`, or `subscription`.

Run the actual page runtime in a VM with mocked `window`, `document`, and `fetch`. Cover:

```js
assert.equal(window.__FA_QX__.state, 'ready');
assert.equal(document.querySelector('#fa-qx-diagnostic'), null);
assert.equal(postedRequests[0].operation, 'runtime.health');
assert.equal(postedRequests[1].operation, 'config.get');
```

With `{ debug: true }`, require one badge whose text contains `FA QX 0.1.0`, `runtime ✓`, and `bridge ✓`, whose style contains `pointer-events:none` and `env(safe-area-inset-bottom)`. With a rejected health request, require state `error` and a badge containing only the redacted code `FA_QX_BRIDGE_HTTP_503`, never the mocked response body.

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```bash
node --test tests/qx-steam-family-runtime.test.cjs tests/qx-steam-family-boxjs.test.cjs
```

Expected: FAIL because the runtime has no state/diagnostic behavior and `boxjs.json` is absent.

- [ ] **Step 3: Create the BoxJS metadata**

Create valid JSON with this application contract:

```json
{
  "id": "kaaaaai.steam-family-qx.subscription",
  "name": "Steam 家庭库 QX",
  "author": "kaaaaai",
  "repo": "https://github.com/kaaaaai/kaaaaai.tools.scripts",
  "apps": [
    {
      "id": "kaaaaai.steam-family-qx",
      "name": "Steam 家庭库 QX",
      "descs_html": [
        "设置 Steam 家庭库 QX 运行时。完整家庭库数据保存在 Steam 网页 IndexedDB，不保存在 BoxJS。",
        "维护命令为递增编号；页面确认处理后会更新对应 acknowledgement。"
      ],
      "keys": [
        "kaaaaai.steam-family-qx.settings.autoScan",
        "kaaaaai.steam-family-qx.settings.storeMarking",
        "kaaaaai.steam-family-qx.settings.debug",
        "kaaaaai.steam-family-qx.settings.logLevel",
        "kaaaaai.steam-family-qx.commands.rescan",
        "kaaaaai.steam-family-qx.commands.refreshExternal",
        "kaaaaai.steam-family-qx.commands.clearCache",
        "kaaaaai.steam-family-qx.acknowledgements.rescan",
        "kaaaaai.steam-family-qx.acknowledgements.refreshExternal",
        "kaaaaai.steam-family-qx.acknowledgements.clearCache",
        "kaaaaai.steam-family-qx.health"
      ],
      "settings": [
        { "id": "kaaaaai.steam-family-qx.settings.autoScan", "name": "自动扫描", "val": true, "type": "boolean" },
        { "id": "kaaaaai.steam-family-qx.settings.storeMarking", "name": "商店页面标记", "val": true, "type": "boolean" },
        { "id": "kaaaaai.steam-family-qx.settings.debug", "name": "调试角标", "val": false, "type": "boolean" },
        { "id": "kaaaaai.steam-family-qx.settings.logLevel", "name": "日志级别", "val": "warn", "type": "text", "desc": "可填写 error、warn、info 或 debug" },
        { "id": "kaaaaai.steam-family-qx.commands.rescan", "name": "重新扫描命令编号", "val": 0, "type": "number" },
        { "id": "kaaaaai.steam-family-qx.commands.refreshExternal", "name": "刷新外部数据命令编号", "val": 0, "type": "number" },
        { "id": "kaaaaai.steam-family-qx.commands.clearCache", "name": "清理缓存命令编号", "val": 0, "type": "number" }
      ]
    }
  ]
}
```

- [ ] **Step 4: Implement the readiness and diagnostic state machine**

Update `page-runtime.js` so initialization performs `runtime.health`, verifies returned release/build/schema, then performs `config.get`. Set `window.__FA_QX__.state` through `starting`, `ready`, or `error`.

Use one `renderDiagnostic(config, errorCode)` function. It removes an existing `#fa-qx-diagnostic`; returns without adding a node when debug is false and no error exists; otherwise appends a non-interactive safe-area badge to `document.documentElement`. Display only release, runtime/bridge status, and a redacted `FA_QX_*` code matching `/^FA_QX_[A-Z0-9_]+$/`. Convert every other error to `FA_QX_UNKNOWN`.

Expose a `ready` promise on `window.__FA_QX__` so Phase 2 can wait for configuration without duplicating startup calls:

```js
var api = { release: '__FA_RELEASE__', buildId: '__FA_BUILD_ID__', state: 'starting', bridge: bridge, ready: null };
api.ready = bridge('runtime.health', {}).then(validateHealth).then(function () {
  return bridge('config.get', {});
}).then(function (config) {
  api.state = 'ready';
  api.config = config;
  renderDiagnostic(config, null);
  return api;
}).catch(function (error) {
  api.state = 'error';
  api.error = redactError(error);
  renderDiagnostic({ debug: false }, api.error);
  throw error;
});
window.__FA_QX__ = api;
```

- [ ] **Step 5: Rebuild and run focused verification**

Run:

```bash
node scripts/build-qx-steam-family.cjs
node --test tests/qx-steam-family-runtime.test.cjs tests/qx-steam-family-boxjs.test.cjs tests/qx-steam-family-bridge.test.cjs tests/qx-steam-family-build.test.cjs
git diff --check
```

Expected: all tests pass; debug is false by default; error output is redacted.

- [ ] **Step 6: Commit BoxJS and diagnostics**

```bash
git add src/quantumultx/steam-family/page-runtime.js quantumultx/steam-family/boxjs.json tests/qx-steam-family-runtime.test.cjs tests/qx-steam-family-boxjs.test.cjs quantumultx/steam-family/releases/0.1.0
git commit -m "feat: add BoxJS runtime controls"
```

### Task 4: Harden Public Artifacts and Document Installation

**Files:**
- Create: `tests/qx-steam-family-security.test.cjs`
- Modify: `tests/qx-steam-family-poc.test.cjs`
- Modify: `quantumultx/steam-family/README.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: all Phase 1 public artifacts and the existing remote resource line.
- Produces: secret-safe release gate, production instructions, canonical snippet URL, compatibility note, BoxJS subscription URL, and rollback procedure.

- [ ] **Step 1: Write failing security and compatibility tests**

Walk only tracked public runtime files under `quantumultx/steam-family`, source files under `src/quantumultx/steam-family`, and `scripts/build-qx-steam-family.cjs`. Documentation may name the private profile solely to state that it must not be published, so it is reviewed separately for copied values rather than rejected for mentioning its path. Reject these patterns in the public runtime and source set:

```js
/^\s*(?:passphrase|p12|password|passwd|token|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|client[_-]?secret|private[_-]?key|subscription[_-]?url)\s*=\s*\S+/gmi
/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
/quantumult_\d{14}\.conf(?:\.bak[^\s]*)?/i
/\[(?:server_local|server_remote|mitm)\]/i
```

For every public URL, parse it with `new URL()` and reject username, password, query, or fragment. Permit GitHub Raw URLs only under `kaaaaai/kaaaaai.tools.scripts` and documented official references under `github.com/crossutility/Quantumult-X` or `github.com/chavyleung/scripts`.

Statically assert that the bridge contains only the six Phase 1 operation names and no `http://`, `https://`, `$task.fetch`, `Cookie`, or `Authorization`. Assert the two snippets are byte-identical and that the existing exact remote profile line remains documented.

- [ ] **Step 2: Run security tests and confirm RED**

Run:

```bash
node --test tests/qx-steam-family-security.test.cjs tests/qx-steam-family-poc.test.cjs
```

Expected: FAIL because the POC tests and README still require the diagnostic-only homepage module.

- [ ] **Step 3: Update documentation and legacy tests**

Rewrite `quantumultx/steam-family/README.md` to include:

- the unchanged installed compatibility resource line using `steam-family-poc.snippet`;
- the canonical new-install resource line using `steam-family.snippet`;
- the BoxJS subscription URL ending in `/quantumultx/steam-family/boxjs.json`;
- confirmed prerequisite that the existing profile already enables the BoxJS QX rewrite resource;
- exact meanings of no runtime, `runtime ✓`, `bridge ✓`, version mismatch, and redacted error states;
- how to enable the diagnostic badge in BoxJS;
- a release table containing runtime `0.1.0`, core `not installed`, schema `1`, and index schema `1`;
- rollback by changing only the snippet's release asset references to a prior versioned directory;
- removal by deleting only the single Steam family remote-resource line and refreshing QX;
- the warning that the full QX profile and its private certificate/subscription material must never be published.

Update the repository `README.md` with separate install links for the userscript, canonical QX snippet, compatibility QX snippet, and BoxJS application. Do not imply Phase 1 already scans a family library.

Replace obsolete POC assertions with compatibility assertions that execute the production injector, confirm the old snippet URL remains valid, and confirm the POC badge text is absent from default production output.

- [ ] **Step 4: Run the complete Phase 1 regression suite**

Run:

```bash
node scripts/build-qx-steam-family.cjs
node --check quantumultx/steam-family/releases/0.1.0/injector.js
node --check quantumultx/steam-family/releases/0.1.0/runtime-asset.js
node --check quantumultx/steam-family/releases/0.1.0/bridge.js
node --test tests/qx-steam-family-build.test.cjs
node --test tests/qx-steam-family-runtime.test.cjs
node --test tests/qx-steam-family-bridge.test.cjs
node --test tests/qx-steam-family-boxjs.test.cjs
node --test tests/qx-steam-family-security.test.cjs
node --test tests/qx-steam-family-poc.test.cjs
node --test tests/s-f-family-share-badge.test.cjs
node --test tests/s-f-mobile-contribution.test.cjs
node --test /Users/kaaaaai/Documents/KaiLab/Tools/tests/s-f-stay-compat.test.cjs
git diff --check
```

Expected: every suite reports zero failures; all generated files are current; diff check is silent.

- [ ] **Step 5: Commit documentation and hardening**

```bash
git add README.md quantumultx/steam-family/README.md tests/qx-steam-family-security.test.cjs tests/qx-steam-family-poc.test.cjs
git commit -m "docs: publish Quantumult X runtime setup"
```

### Task 5: Review, Publish, and Perform Real-Device Runtime Acceptance

**Files:**
- Verify: all Phase 1 source, generated artifacts, tests, and documentation.
- Do not modify: `/Users/kaaaaai/Downloads/quantumult_20260819170610.conf`.

**Interfaces:**
- Consumes: reviewed Phase 1 commits on the implementation branch.
- Produces: published raw assets, refreshed existing remote resource, imported BoxJS app, and a recorded Steam App runtime/bridge result.

- [ ] **Step 1: Run independent review gates**

Request one specification-compliance review against
`docs/superpowers/specs/2026-08-19-qx-steam-family-full-parity-design.md` and this plan, then one code-quality/security review. Block publication for any broadened bridge operation, credential-like data, non-deterministic artifact, mismatch between snippets, unbounded body/chunk input, multiple `$done` calls, or missing negative-path test.

- [ ] **Step 2: Rebuild from clean tracked sources and verify no drift**

Run:

```bash
node scripts/build-qx-steam-family.cjs
git diff --exit-code -- quantumultx/steam-family/releases/0.1.0 quantumultx/steam-family/steam-family.snippet quantumultx/steam-family/steam-family-poc.snippet
git status --short
```

Expected: the generated-artifact diff command exits 0; status contains no uncommitted Phase 1 changes.

- [ ] **Step 3: Run final verification and verify GitHub identity**

Run the full command block from Task 4 Step 4, then:

```bash
gh auth switch --hostname github.com --user kaaaaai
test "$(gh api user --jq .login)" = "kaaaaai"
git remote get-url origin
```

Expected: identity check succeeds and the remote is `git@kaaaaai.github.com:kaaaaai/kaaaaai.tools.scripts.git`.

- [ ] **Step 4: Push without changing the private profile**

Push the reviewed branch through the selected integration workflow, then push `main` normally. Do not force-push and do not edit the existing QX profile: it already points to `steam-family-poc.snippet`, which is now the compatibility production snippet.

- [ ] **Step 5: Verify public release bytes**

Fetch these URLs and require HTTP 200:

```text
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family-poc.snippet
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family.snippet
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/boxjs.json
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/releases/0.1.0/manifest.json
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/releases/0.1.0/injector.js
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/releases/0.1.0/runtime-asset.js
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/releases/0.1.0/bridge.js
```

Compare the two raw snippets byte-for-byte. Recompute every manifest SHA-256 from the fetched bytes and require an exact match.

- [ ] **Step 6: Complete device acceptance**

In Quantumult X, refresh the existing `Steam家庭库POC` remote resource. In BoxJS, subscribe to `boxjs.json`, open `Steam 家庭库 QX`, and enable `调试角标`. Open the Steam Store homepage inside the Steam App and require a badge showing:

```text
FA QX 0.1.0 · runtime ✓ · bridge ✓
```

Disable `调试角标`, reload the page, and require the badge to disappear. Confirm Steam navigation and store interaction remain normal. Repeat a runtime check on `https://keylol.com/` and the SteamDB Keylol tooltip route. Record the build ID from the badge or BoxJS health value with the Phase 1 acceptance result; do not record page bodies, cookies, headers, or account identifiers.

## Phase 1 Completion Boundary

Phase 1 is complete only after all automated gates and real-device checks pass. It intentionally exposes no family-library scan, Steam API call, analysis panel, store marker, or Keylol badge. Those begin in the separate Phase 2 plan, which consumes the stable interfaces `window.__FA_QX__.ready`, `window.__FA_QX__.bridge()`, the six-operation dispatcher, the compact-index manifest, and release build tooling defined here.
