const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimeDir = path.join(root, 'quantumultx/steam-family');
const sourceDir = path.join(root, 'src/quantumultx/steam-family');
const rawProjectPath = '/kaaaaai/kaaaaai.tools.scripts/';
const credentialName = '(?:passphrase|p12|password|passwd|token|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|client[_-]?secret|private[_-]?key|subscription[_-]?url)';
const secretAssignment = new RegExp(
  String.raw`(?:^|[;,{)\n])\s*(?:(?:const|let|var)\s+)?(?:(?:[A-Za-z_$][\w$]*\s*\.\s*)?["']?${credentialName}["']?)\s*(?:=|:)\s*([^,;\]\}\n]+)`,
  'gmi',
);
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
  const normalized = trimUrl(candidate);
  assert.equal(normalized.endsWith('?'), false, `${file} URL must not end with a bare query delimiter`);
  assert.equal(normalized.endsWith('#'), false, `${file} URL must not end with a bare fragment delimiter`);
  const url = new URL(normalized);
  assert.equal(url.username, '', `${file} URL must not include a username`);
  assert.equal(url.password, '', `${file} URL must not include a password`);
  assert.equal(url.search, '', `${file} URL must not include a query string`);
  assert.equal(url.hash, '', `${file} URL must not include a fragment`);
  if (url.hostname === 'raw.githubusercontent.com') {
    assert.ok(url.pathname.startsWith(rawProjectPath), `${file} raw GitHub URL must stay under kaaaaai/kaaaaai.tools.scripts`);
  }
  if (url.hostname === 'github.com') {
    const permittedRepositories = [
      '/crossutility/Quantumult-X',
      '/chavyleung/scripts',
      '/kaaaaai/kaaaaai.tools.scripts',
    ];
    assert.ok(
      permittedRepositories.some((repository) => url.pathname === repository || url.pathname.startsWith(repository + '/')),
      `${file} GitHub URL must be the project or a documented official reference`,
    );
  }
}

function assertSecretFree(text, file) {
  const active = [...text.matchAll(secretAssignment)].some((match) => !/^(?:""|''|null|undefined)$/i.test(match[1].trim()));
  assert.equal(active, false, `${file} contains a credential assignment`);
}

function declaredNames(bridge, name) {
  const match = bridge.match(new RegExp(`var ${name} = \\{([\\s\\S]*?)\\};`));
  assert.ok(match, `bridge must declare ${name}`);
  return [...match[1].matchAll(/(?:'([^']+)'|([A-Za-z_$][\w$]*))\s*:\s*true/g)].map((entry) => entry[1] || entry[2]);
}

function assertOnlyMembershipReferences(bridge, name, member, file) {
  assert.equal((bridge.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length, 2, `${file} has unexpected ${name} references`);
  assert.match(bridge, new RegExp(`Object\\.prototype\\.hasOwnProperty\\.call\\(${name}, ${member}\\)`), `${file} must check ${name} with an own-property lookup`);
}

function assertStrictBridge(bridge, file) {
  assert.deepEqual(declaredNames(bridge, 'ALLOWED'), operationNames, `${file} allowlist changed`);
  assert.deepEqual(declaredNames(bridge, 'COMMANDS'), ['rescan', 'refreshExternal', 'clearCache'], `${file} command allowlist changed`);
  assertOnlyMembershipReferences(bridge, 'ALLOWED', 'input.operation', file);
  assertOnlyMembershipReferences(bridge, 'COMMANDS', 'payload.command', file);
  const dispatched = [...bridge.matchAll(/\binput\.operation\s*===\s*'([^']+)'/g)].map((entry) => entry[1]);
  assert.deepEqual(dispatched, operationNames, `${file} dispatch changed`);
  assert.doesNotMatch(bridge, /\b(?:eval|Function)\b|\.\s*constructor\b|\[\s*(?:['"][^'"]*constructor[^'"]*['"]|['"][^'"]*['"]\s*\+)/, `${file} contains dynamic evaluation or constructor dispatch`);
}

test('public runtime and source artifacts exclude private profile and credential material', () => {
  for (const file of publicRuntimeFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file);
    assertSecretFree(text, relative);
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
    assertSecretFree(text, relative);
    assert.doesNotMatch(text, privateKey, `${relative} contains a private key`);
    for (const candidate of urls(text)) assertSafeUrl(candidate, relative);
  }
});

test('credential inspection rejects active values in JavaScript, JSON, YAML, and bare assignment syntax', () => {
  const fixtures = [
    'const accessToken = "secret";',
    'if (enabled) accessToken = "secret";',
    'let PASSWORD = "secret";',
    'var api_key = "secret";',
    'settings.authorization = "Bearer secret";',
    '{"client_secret":"secret"}',
    'subscription_url: https://example.test/subscription',
    'refresh-token=secret',
  ];
  for (const fixture of fixtures) {
    assert.throws(() => assertSecretFree(fixture, 'fixture'), /credential assignment/);
  }
});

test('security URL validation rejects Raw GitHub repository lookalikes', () => {
  assert.throws(
    () => assertSafeUrl('https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scriptsevil/main/runtime.js', 'fixture'),
    /raw GitHub URL must stay under kaaaaai\/kaaaaai\.tools\.scripts/,
  );
});

test('security URL validation rejects bare delimiters and official repository lookalikes', () => {
  for (const candidate of [
    'https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/runtime.js?',
    'https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/runtime.js#',
    'https://github.com/crossutility/Quantumult-Xevil',
    'https://github.com/chavyleung/scriptsevil',
  ]) {
    assert.throws(() => assertSafeUrl(candidate, 'fixture'));
  }
});

test('bridge inspection rejects a later operation allowlist mutation', () => {
  const bridge = fs.readFileSync(path.join(sourceDir, 'bridge.js'), 'utf8') + "\nALLOWED['profile.read'] = true;\n";
  assert.throws(() => assertStrictBridge(bridge, 'fixture'), /unexpected ALLOWED references/);
});

test('bridge inspection rejects dynamic allowlist references and evaluation primitives', () => {
  const source = fs.readFileSync(path.join(sourceDir, 'bridge.js'), 'utf8');
  for (const mutation of [
    '\nALLOWED[operation] = true;\n',
    '\nCOMMANDS[command] = true;\n',
    '\nvar x = ALLOWED.extra;\n',
    '\neval("ignored");\n',
    '\neval/*x*/("AL" + "LOWED[\\\'profile.read\\\'] = true");\n',
    '\nObject.constructor("ignored");\n',
    '\nObject["con" + "structor"]("ignored");\n',
  ]) {
    assert.throws(() => assertStrictBridge(source + mutation, 'fixture'));
  }
});

test('bridge exposes exactly the six Phase 1 operations and no network credential primitives', () => {
  for (const file of [path.join(sourceDir, 'bridge.js'), path.join(runtimeDir, 'releases/0.1.0/bridge.js')]) {
    const text = fs.readFileSync(file, 'utf8');
    assertStrictBridge(text, path.relative(root, file));
    assert.doesNotMatch(text, /http:\/\//i);
    assert.doesNotMatch(text, /https:\/\//i);
    assert.doesNotMatch(text, /\$task\.fetch/);
    assert.doesNotMatch(text, /Cookie/i);
    assert.doesNotMatch(text, /Authorization/i);
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
  assert.match(readme, /https:\/\/raw\.githubusercontent\.com\/kaaaaai\/kaaaaai\.tools\.scripts\/7425947\/quantumultx\/steam-family\/steam-family-poc\.snippet/);
  assert.match(readme, /replace\s+only this module's remote-resource URL[\s\S]*refresh Quantumult X[\s\S]*restore the main compatibility URL later/i);
  assert.doesNotMatch(readme, /prior versioned directory/i);
  assert.match(readme, /delete only the single Steam family remote-resource line/i);
  assert.match(readme, /full QX profile[\s\S]*must never be published/i);
  assert.match(readme, /successful health badge is hidden unless debug is enabled/i);
  assert.match(readme, /redacted failure badge may appear automatically even with debug off/i);
  assert.doesNotMatch(readme, /diagnostic badge to Steam HTML responses/i);
});
