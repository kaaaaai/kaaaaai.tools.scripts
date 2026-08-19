const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.resolve(__dirname, '..', 'quantumultx/steam-family/steam-family-poc.js');
const source = fs.readFileSync(scriptPath, 'utf8');
const snippetPath = path.resolve(__dirname, '..', 'quantumultx/steam-family/steam-family-poc.snippet');
const readmePath = path.resolve(__dirname, '..', 'quantumultx/steam-family/README.md');
const publicArtifacts = [scriptPath, snippetPath, readmePath];
const rawPrefix = 'https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/';
const resourceLine = `${rawPrefix}quantumultx/steam-family/steam-family-poc.snippet, tag=Steam家庭库POC, update-interval=86400, opt-parser=false, enabled=true`;

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

test('executes the inline script from the production-injected payload', () => {
  const injected = runPoc('<!doctype html><html><body>Steam</body></html>');
  const scriptMatch = injected.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'production injection must include an inline script');

  const attributes = new Map([['data-js', 'pending']]);
  const badge = {
    textContent: 'FA QX · HTML ✓ · JS …',
    setAttribute(name, value) { attributes.set(name, value); },
  };
  const inlineScript = new vm.Script(scriptMatch[1], { filename: 'steam-family-poc-inline.js' });
  inlineScript.runInNewContext({
    document: {
      getElementById(id) {
        assert.equal(id, 'fa-qx-poc');
        return badge;
      },
    },
  });

  assert.equal(badge.textContent, 'FA QX · HTML ✓ · JS ✓');
  assert.equal(attributes.get('data-js'), 'ok');
});

test('keeps the diagnostic badge non-interactive and within the safe area', () => {
  const injected = runPoc('<html><body>Steam</body></html>');
  assert.match(injected, /pointer-events:none/);
  assert.ok(injected.includes(
    'left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483647;max-width:none;',
  ));
});

test('publishes an exact public Quantumult X rewrite snippet', () => {
  const snippet = fs.readFileSync(snippetPath, 'utf8');
  const expected = [
    'hostname = store.steampowered.com',
    `^https:\\/\\/store\\.steampowered\\.com\\/(?:\\?.*)?$ url script-response-body ${rawPrefix}quantumultx/steam-family/steam-family-poc.js`,
    '',
  ].join('\n');
  assert.equal(snippet, expected);
});

test('keeps the public POC free of private profile and credential material', () => {
  for (const artifactPath of publicArtifacts) {
    const artifactText = fs.readFileSync(artifactPath, 'utf8');
    const artifactName = path.relative(path.resolve(__dirname, '..'), artifactPath);
    const urls = artifactText.match(/https?:\/\/[^\s<>"'`]+/g) || [];

    for (const candidate of urls) {
      const parsed = new URL(candidate.replace(/[),.;]+$/, ''));
      assert.equal(parsed.username, '', `${artifactName} URL must not contain userinfo`);
      assert.equal(parsed.password, '', `${artifactName} URL must not contain userinfo`);
      assert.equal(parsed.search, '', `${artifactName} URL must not contain a query`);
      assert.equal(parsed.hash, '', `${artifactName} URL must not contain a fragment`);
      if (parsed.hostname === 'raw.githubusercontent.com') {
        assert.ok(parsed.href.startsWith(rawPrefix), `${artifactName} raw GitHub URL must use ${rawPrefix}`);
      }
    }

    assert.doesNotMatch(
      artifactText,
      /^\s*(?:passphrase|p12|password|passwd|user(?:name)?|token|(?:access|refresh)[_-]?token|api[_-]?key|authorization|secret|client[_-]?secret|private[_-]?key|subscription(?:[_-]?url)?)\s*=\s*\S+/gmi,
      `${artifactName} must not contain an active credential value field`,
    );
    assert.doesNotMatch(artifactText, /^\s*\[(?:server_local|server_remote|mitm)\]\s*$/gmi);
    assert.doesNotMatch(artifactText, /quantumult_\d{14}\.conf(?:\.bak[^\s]*)?/i);
  }
});

test('documents installation, diagnostics, and removal of the public resource', () => {
  const readme = fs.readFileSync(readmePath, 'utf8');
  const documentedResourceLines = readme
    .split('\n')
    .filter((line) => line.includes(`${rawPrefix}quantumultx/steam-family/steam-family-poc.snippet`));
  assert.deepEqual(documentedResourceLines, [resourceLine, resourceLine]);
  assert.doesNotMatch(readme, /```text\n\[rewrite_remote\]/);
  assert.match(readme, /under (?:the user's|your) existing `\[rewrite_remote\]`/i);
  assert.match(readme, /Open exactly `https:\/\/store\.steampowered\.com\/`/);
  assert.match(readme, /root homepage.*optional query/is);
  assert.match(readme, /App, login, checkout, API, and static paths are\s+excluded\./);
  assert.match(readme, /no badge/i);
  assert.match(readme, /HTML ✓ · JS …/);
  assert.match(readme, /HTML ✓ · JS ✓/);
  assert.match(readme, /HTML ✓ · JS ….*(?:CSP|Content Security Policy).*embedded web-view policy.*blocked inline JavaScript/is);
  assert.match(readme, /CA|certificate authority/i);
  assert.match(readme, /trust|trusted/i);
  assert.match(readme, /Quantumult X.*tunnel|tunnel.*Quantumult X/i);
  assert.match(readme, /refresh|import/i);
  assert.match(readme, /remove|delete/i);
  assert.match(readme, /never.*publish|do not.*publish/i);
});
