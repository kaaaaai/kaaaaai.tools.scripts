const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimeDir = path.join(root, 'quantumultx/steam-family');
const sourceDir = path.join(root, 'src/quantumultx/steam-family');
const rawProjectPath = '/kaaaaai/kaaaaai.tools.scripts/';
const secretAssignment = /^\s*(?:passphrase|p12|password|passwd|token|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|client[_-]?secret|private[_-]?key|subscription[_-]?url)\s*=\s*\S+/gmi;
const privateKey = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const privateProfile = /quantumult_\d{14}\.conf(?:\.bak[^\s]*)?/i;
const profileSections = /\[(?:server_local|server_remote|mitm)\]/i;
const operationNames = ['runtime.health', 'config.get', 'command.ack', 'index.publish', 'index.read', 'index.clear'];

function publicRuntimeFiles() {
  const files = childProcess.execFileSync('git', [
    'ls-files',
    'quantumultx/steam-family',
    'src/quantumultx/steam-family',
    'scripts/build-qx-steam-family.cjs',
  ], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  return files
    .filter((file) => file !== 'quantumultx/steam-family/README.md')
    .map((file) => path.join(root, file));
}

function urls(text) {
  return text.match(/https?:\/\/[^\s<>"'`]+/g) || [];
}

function trimUrl(candidate) {
  return candidate.replace(/[),.;]+$/, '');
}

function assertSafeUrl(candidate, file) {
  const url = new URL(trimUrl(candidate));
  assert.equal(url.username, '', `${file} URL must not include a username`);
  assert.equal(url.password, '', `${file} URL must not include a password`);
  assert.equal(url.search, '', `${file} URL must not include a query string`);
  assert.equal(url.hash, '', `${file} URL must not include a fragment`);
  if (url.hostname === 'raw.githubusercontent.com') {
    assert.ok(url.pathname.startsWith(rawProjectPath), `${file} raw GitHub URL must stay under kaaaaai/kaaaaai.tools.scripts`);
  }
  if (url.hostname === 'github.com') {
    assert.ok(
      url.pathname.startsWith('/crossutility/Quantumult-X') || url.pathname.startsWith('/chavyleung/scripts') || url.pathname.startsWith('/kaaaaai/kaaaaai.tools.scripts'),
      `${file} GitHub URL must be the project or a documented official reference`,
    );
  }
}

function allowedOperations(bridge) {
  const match = bridge.match(/var ALLOWED = \{([\s\S]*?)\n  \};/);
  assert.ok(match, 'bridge must declare an operation allowlist');
  return [...match[1].matchAll(/'([^']+)': true/g)].map((entry) => entry[1]);
}

function assertStrictBridge(bridge, file) {
  assert.deepEqual(allowedOperations(bridge), operationNames, `${file} allowlist changed`);
  assert.doesNotMatch(bridge, /\bALLOWED\s*\[\s*['"][^'"]+['"]\s*\]\s*=\s*true/, `${file} mutates its operation allowlist`);
  const dispatched = [...bridge.matchAll(/\binput\.operation\s*===\s*'([^']+)'/g)].map((entry) => entry[1]);
  assert.deepEqual(dispatched, operationNames, `${file} dispatch changed`);
}

test('public runtime and source artifacts exclude private profile and credential material', () => {
  for (const file of publicRuntimeFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file);
    assert.doesNotMatch(text, secretAssignment, `${relative} contains a credential assignment`);
    assert.doesNotMatch(text, privateKey, `${relative} contains a private key`);
    assert.doesNotMatch(text, privateProfile, `${relative} names a private QX profile`);
    assert.doesNotMatch(text, profileSections, `${relative} contains private profile sections`);
    for (const candidate of urls(text)) assertSafeUrl(candidate, relative);
  }
});

test('public documentation is reviewed for copied secret values while permitting a private-profile warning', () => {
  for (const file of [path.join(runtimeDir, 'README.md'), path.join(root, 'README.md')]) {
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file);
    assert.doesNotMatch(text, secretAssignment, `${relative} contains a credential assignment`);
    assert.doesNotMatch(text, privateKey, `${relative} contains a private key`);
    for (const candidate of urls(text)) assertSafeUrl(candidate, relative);
  }
});

test('security URL validation rejects Raw GitHub repository lookalikes', () => {
  assert.throws(
    () => assertSafeUrl('https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scriptsevil/main/runtime.js', 'fixture'),
    /raw GitHub URL must stay under kaaaaai\/kaaaaai\.tools\.scripts/,
  );
});

test('bridge inspection rejects a later operation allowlist mutation', () => {
  const bridge = fs.readFileSync(path.join(sourceDir, 'bridge.js'), 'utf8') + "\nALLOWED['profile.read'] = true;\n";
  assert.throws(() => assertStrictBridge(bridge, 'fixture'), /mutates its operation allowlist/);
});

test('bridge exposes exactly the six Phase 1 operations and no network credential primitives', () => {
  for (const file of [path.join(sourceDir, 'bridge.js'), path.join(runtimeDir, 'releases/0.1.0/bridge.js')]) {
    const text = fs.readFileSync(file, 'utf8');
    assertStrictBridge(text, path.relative(root, file));
    assert.doesNotMatch(text, /http:\/\//i);
    assert.doesNotMatch(text, /https:\/\//i);
    assert.doesNotMatch(text, /\$task\.fetch/);
    assert.doesNotMatch(text, /Cookie/);
    assert.doesNotMatch(text, /Authorization/);
  }
});

test('canonical and compatibility snippets stay byte-identical and the installed line is retained', () => {
  const canonical = fs.readFileSync(path.join(runtimeDir, 'steam-family.snippet'), 'utf8');
  const compatibility = fs.readFileSync(path.join(runtimeDir, 'steam-family-poc.snippet'), 'utf8');
  const readme = fs.readFileSync(path.join(runtimeDir, 'README.md'), 'utf8');
  const line = 'https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family-poc.snippet, tag=Steam家庭库POC, update-interval=86400, opt-parser=false, enabled=true';
  assert.equal(compatibility, canonical);
  assert.ok(readme.split('\n').includes(line), 'README must retain the installed compatibility resource line');
});

test('installation documentation describes the production runtime without the diagnostic-only POC module', () => {
  const readme = fs.readFileSync(path.join(runtimeDir, 'README.md'), 'utf8');
  assert.match(readme, /steam-family\.snippet, tag=Steam家庭库/);
  assert.match(readme, /boxjs\.json/);
  assert.match(readme, /BoxJS.*rewrite resource/i);
  assert.match(readme, /no runtime/i);
  assert.match(readme, /runtime ✓/i);
  assert.match(readme, /bridge ✓/i);
  assert.match(readme, /version mismatch/i);
  assert.match(readme, /redacted error/i);
  assert.match(readme, /调试角标[\s\S]*badge/i);
  assert.match(readme, /0\.1\.0[\s\S]*not installed[\s\S]*schema.*1[\s\S]*index schema.*1/i);
  assert.match(readme, /prior versioned directory/i);
  assert.match(readme, /delete only the single Steam family remote-resource line/i);
  assert.match(readme, /full QX profile[\s\S]*must never be published/i);
  assert.doesNotMatch(readme, /diagnostic badge to Steam HTML responses/i);
});
