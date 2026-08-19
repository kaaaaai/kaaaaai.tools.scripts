# Quantumult X Steam App Injection POC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a credential-free Quantumult X rewrite module that diagnoses HTML injection and inline JavaScript execution on the Steam App Store homepage, then add one remote resource reference to the user's private local profile.

**Architecture:** A homepage-only `script-response-body` rule runs a small idempotent response transformer. The transformer injects a non-interactive diagnostic badge with independent HTML and JavaScript states; Node VM tests execute the real QX script with mocked `$response` and `$done` globals.

**Tech Stack:** Quantumult X rewrite snippets, Quantumult X JavaScript globals, Node.js `node:test` and `vm`, GitHub Raw.

## Global Constraints

- Never copy or commit `/Users/kaaaaai/Downloads/quantumult_20260819170610.conf` or its backup.
- Never expose its MITM passphrase, P12 payload, proxy subscription URLs, cookies, headers, or account identifiers.
- The public module matches only `https://store.steampowered.com/` with an optional query string.
- The public module MITM hostname is exactly `store.steampowered.com`.
- The response script must call `$done` exactly once on every execution path.
- Non-HTML responses, empty bodies, already-injected bodies, and HTML without `</body>` remain byte-for-byte unchanged.
- The diagnostic badge must show separate HTML and JavaScript states and must not capture pointer input.
- BoxJS preferences, Steam API access, family-library scanning, and the full userscript UI remain out of scope.
- Every public URL points to `https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/`.

---

### Task 1: Build and Test the Response Injector

**Files:**
- Create: `quantumultx/steam-family/steam-family-poc.js`
- Create: `tests/qx-steam-family-poc.test.cjs`

**Interfaces:**
- Consumes: Quantumult X globals `$response.body` and `$done(result)`.
- Produces: one `$done({ body: string })` call; injected element `#fa-qx-poc` with `data-js="pending"`, followed by an inline script that sets `data-js="ok"` and the final text.

- [ ] **Step 1: Write VM-based failing tests**

Create a test helper that executes the real script in a fresh VM context:

```js
function runPoc(body) {
  const calls = [];
  vm.runInNewContext(source, {
    $response: { body },
    $done(result) { calls.push(result); },
  });
  assert.equal(calls.length, 1);
  return calls[0].body;
}
```

Add tests asserting:

```js
assert.equal(runPoc(undefined), '');
assert.equal(runPoc('{"ok":true}'), '{"ok":true}');
assert.equal(runPoc('<html><body>no close'), '<html><body>no close');
assert.equal(runPoc('<html><body><div id="fa-qx-poc"></div></body></html>'), duplicateBody);
assert.match(runPoc('<!doctype html><html><body>Steam</body></html>'), /id="fa-qx-poc"/);
assert.match(injected, /FA QX · HTML ✓ · JS …/);
assert.match(injected, /FA QX · HTML ✓ · JS ✓/);
assert.match(injected, /pointer-events:none/);
assert.match(injected, /env\(safe-area-inset-bottom\)/);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/qx-steam-family-poc.test.cjs`

Expected: failure because `quantumultx/steam-family/steam-family-poc.js` does not exist.

- [ ] **Step 3: Implement the minimal QX transformer**

Implement one IIFE with one completion point:

```js
(function () {
  var original = ($response && typeof $response.body === 'string') ? $response.body : '';
  var body = original;
  var looksLikeHtml = /<(?:!doctype\s+html|html|head|body)\b/i.test(original);
  if (looksLikeHtml && original.indexOf('id="fa-qx-poc"') === -1 && /<\/body\s*>/i.test(original)) {
    var payload = '...diagnostic badge and inline state script...';
    body = original.replace(/<\/body\s*>/i, payload + '</body>');
  }
  $done({ body: body });
})();
```

The actual payload must use only literal HTML/CSS/JavaScript, set `pointer-events:none`, use safe-area bottom/left offsets, constrain its maximum width, and avoid logging or reading headers.

- [ ] **Step 4: Run focused verification**

Run:

```bash
node --check quantumultx/steam-family/steam-family-poc.js
node --test tests/qx-steam-family-poc.test.cjs
git diff --check
```

Expected: syntax succeeds; all focused tests pass; diff check is silent.

- [ ] **Step 5: Commit**

```bash
git add quantumultx/steam-family/steam-family-poc.js tests/qx-steam-family-poc.test.cjs
git commit -m "feat: add Quantumult X Steam injection probe"
```

### Task 2: Add the Public Rewrite Module and Documentation

**Files:**
- Create: `quantumultx/steam-family/steam-family-poc.snippet`
- Create: `quantumultx/steam-family/README.md`
- Modify: `tests/qx-steam-family-poc.test.cjs`

**Interfaces:**
- Consumes: published response script path `quantumultx/steam-family/steam-family-poc.js`.
- Produces: importable rewrite resource URL ending in `steam-family-poc.snippet`.

- [ ] **Step 1: Add failing snippet and security tests**

Read the snippet and the three public POC files. Assert:

```js
assert.match(snippet, /^hostname = store\.steampowered\.com$/m);
assert.match(snippet, /^\^https:\\\/\\\/store\\\.steampowered\\\.com\\\/(?:\\\?\.\*)?\$ url script-response-body https:\/\/raw\.githubusercontent\.com\/kaaaaai\/kaaaaai\.tools\.scripts\/main\/quantumultx\/steam-family\/steam-family-poc\.js$/m);
assert.doesNotMatch(publicText, /^(?:passphrase|p12)\s*=/mi);
assert.doesNotMatch(publicText, /\[(?:server_local|server_remote|mitm)\]/i);
assert.doesNotMatch(publicText, /quantumult_20260819170610\.conf/);
```

The README test must require the exact remote resource line and all three diagnostic outcomes.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/qx-steam-family-poc.test.cjs`

Expected: failure because the snippet and README do not exist.

- [ ] **Step 3: Create the snippet and README**

The snippet contains exactly:

```text
hostname = store.steampowered.com
^https:\/\/store\.steampowered\.com\/(?:\?.*)?$ url script-response-body https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family-poc.js
```

The README documents:

- the exact `[rewrite_remote]` resource line;
- CA installation/trust and Quantumult X tunnel prerequisites;
- refresh/import steps;
- meanings of no badge, `HTML ✓ · JS …`, and `HTML ✓ · JS ✓`;
- removal steps that delete only the one remote resource line;
- a warning never to publish an exported complete profile.

- [ ] **Step 4: Run the complete repository verification**

Run:

```bash
node --check quantumultx/steam-family/steam-family-poc.js
node --test tests/qx-steam-family-poc.test.cjs
node --test tests/s-f-family-share-badge.test.cjs
node --test tests/s-f-mobile-contribution.test.cjs
node --test /Users/kaaaaai/Documents/KaiLab/Tools/tests/s-f-stay-compat.test.cjs
git diff --check
```

Expected: all test files pass with zero failures; diff check is silent.

- [ ] **Step 5: Commit**

```bash
git add quantumultx/steam-family/steam-family-poc.snippet quantumultx/steam-family/README.md tests/qx-steam-family-poc.test.cjs
git commit -m "docs: publish Steam injection POC module"
```

### Task 3: Review, Publish, and Patch the Private Local Profile

**Files:**
- Verify: all repository changes from Tasks 1–2
- Back up: `/Users/kaaaaai/Downloads/quantumult_20260819170610.conf` → `/Users/kaaaaai/Downloads/quantumult_20260819170610.conf.bak-before-steam-family-poc`
- Modify: `/Users/kaaaaai/Downloads/quantumult_20260819170610.conf`

**Interfaces:**
- Consumes: reviewed POC module on the feature branch.
- Produces: public raw POC resources and a private local profile containing exactly one enabled remote resource reference.

- [ ] **Step 1: Run independent code and security review**

Review the complete feature diff against the design. Block publication for any credential-like value, broad URL match, multiple `$done` calls, missing idempotence, or missing negative-path test.

- [ ] **Step 2: Merge and verify GitHub identity**

After all tests and review pass, fast-forward merge the feature branch into `main`, then run:

```bash
gh auth switch --hostname github.com --user kaaaaai
gh api user --jq .login
```

Expected: exact output `kaaaaai`.

- [ ] **Step 3: Push and verify raw resources**

Run `git push origin main`, then verify both raw URLs return HTTP 200:

```text
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family-poc.snippet
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family-poc.js
```

Confirm the raw snippet contains the exact homepage-only rule and the raw script contains `FA QX · HTML ✓ · JS ✓`.

- [ ] **Step 4: Create a non-overwriting private backup**

Run:

```bash
test ! -e /Users/kaaaaai/Downloads/quantumult_20260819170610.conf.bak-before-steam-family-poc
cp /Users/kaaaaai/Downloads/quantumult_20260819170610.conf /Users/kaaaaai/Downloads/quantumult_20260819170610.conf.bak-before-steam-family-poc
cmp /Users/kaaaaai/Downloads/quantumult_20260819170610.conf /Users/kaaaaai/Downloads/quantumult_20260819170610.conf.bak-before-steam-family-poc
```

Expected: the target did not already exist and `cmp` exits 0.

- [ ] **Step 5: Add exactly one local remote resource line**

Insert immediately after `[rewrite_remote]`:

```text
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family-poc.snippet, tag=Steam家庭库POC, update-interval=86400, opt-parser=false, enabled=true
```

Verify the patched profile contains exactly one occurrence of the resource URL. Remove that one line from an in-memory copy and compare it to the backup; the normalized result must be byte-for-byte identical, proving no private content changed.

- [ ] **Step 6: Hand off device acceptance**

Tell the user to refresh the resource in Quantumult X, verify its CA is installed and trusted, start the tunnel, open the Steam App Store homepage, and report exactly one outcome:

```text
无角标
HTML ✓ · JS …
HTML ✓ · JS ✓
```
