const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.resolve(__dirname, '..', 'quantumultx/steam-family/steam-family-poc.js');
const source = fs.readFileSync(scriptPath, 'utf8');
const snippetPath = path.resolve(__dirname, '..', 'quantumultx/steam-family/steam-family-poc.snippet');
const readmePath = path.resolve(__dirname, '..', 'quantumultx/steam-family/README.md');

function runPoc(body) {
  const calls = [];
  vm.runInNewContext(source, {
    $response: { body },
    $done(result) { calls.push(result); },
  });
  assert.equal(calls.length, 1);
  return calls[0].body;
}

test('leaves missing and non-HTML response bodies unchanged', () => {
  assert.equal(runPoc(undefined), '');
  assert.equal(runPoc(''), '');
  assert.equal(runPoc('{"ok":true}'), '{"ok":true}');
  assert.equal(runPoc('<html><body>no close'), '<html><body>no close');
});

test('does not duplicate an existing diagnostic badge', () => {
  const duplicateBody = '<html><body><div id="fa-qx-poc"></div></body></html>';
  assert.equal(runPoc(duplicateBody), duplicateBody);
});

test('injects separate HTML and JavaScript diagnostic states', () => {
  const injected = runPoc('<!doctype html><html><body>Steam</body></html>');
  assert.match(injected, /id="fa-qx-poc"/);
  assert.match(injected, /data-js="pending"/);
  assert.match(injected, /FA QX · HTML ✓ · JS …/);
  assert.match(injected, /setAttribute\("data-js","ok"\)/);
  assert.match(injected, /FA QX · HTML ✓ · JS ✓/);
});

test('keeps the diagnostic badge non-interactive and within the safe area', () => {
  const injected = runPoc('<html><body>Steam</body></html>');
  assert.match(injected, /pointer-events:none/);
  assert.match(injected, /env\(safe-area-inset-bottom\)/);
  assert.match(injected, /env\(safe-area-inset-left\)/);
  assert.match(injected, /max-width:calc\(100vw - 24px\)/);
});

test('publishes an exact public Quantumult X rewrite snippet', () => {
  const snippet = fs.readFileSync(snippetPath, 'utf8');
  assert.match(snippet, /^hostname = store\.steampowered\.com$/m);
  assert.match(
    snippet,
    /^\^https:\\\/\\\/store\\\.steampowered\\\.com\\\/\(\?:\\\?\.\*\)\?\$ url script-response-body https:\/\/raw\.githubusercontent\.com\/kaaaaai\/kaaaaai\.tools\.scripts\/main\/quantumultx\/steam-family\/steam-family-poc\.js$/m,
  );
});

test('keeps the public POC free of private profile and credential material', () => {
  const publicText = [
    fs.readFileSync(scriptPath, 'utf8'),
    fs.readFileSync(snippetPath, 'utf8'),
    fs.readFileSync(readmePath, 'utf8'),
  ].join('\n');
  assert.doesNotMatch(publicText, /^(?:passphrase|p12)\s*=/mi);
  assert.doesNotMatch(publicText, /\[(?:server_local|server_remote|mitm)\]/i);
  assert.doesNotMatch(publicText, /quantumult_20260819170610\.conf/);
  assert.match(publicText, /hostname = store\.steampowered\.com/);
});

test('documents installation, diagnostics, and removal of the public resource', () => {
  const readme = fs.readFileSync(readmePath, 'utf8');
  assert.match(
    readme,
    /^\[rewrite_remote\]\nhttps:\/\/raw\.githubusercontent\.com\/kaaaaai\/kaaaaai\.tools\.scripts\/main\/quantumultx\/steam-family\/steam-family-poc\.snippet$/m,
  );
  assert.match(readme, /no badge/i);
  assert.match(readme, /HTML ✓ · JS …/);
  assert.match(readme, /HTML ✓ · JS ✓/);
  assert.match(readme, /CA|certificate authority/i);
  assert.match(readme, /trust|trusted/i);
  assert.match(readme, /Quantumult X.*tunnel|tunnel.*Quantumult X/i);
  assert.match(readme, /refresh|import/i);
  assert.match(readme, /remove|delete/i);
  assert.match(readme, /never.*publish|do not.*publish/i);
});
