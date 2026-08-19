const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.resolve(__dirname, '..', 'quantumultx/steam-family/steam-family-poc.js');
const source = fs.readFileSync(scriptPath, 'utf8');

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
