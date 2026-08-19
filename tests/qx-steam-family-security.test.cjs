const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimeDir = path.join(root, 'quantumultx/steam-family');
const sourceDir = path.join(root, 'src/quantumultx/steam-family');
const rollbackSnippetPath = path.join(runtimeDir, 'rollback/poc-7425947.snippet');
const pinnedPocCommit = '7425947';
const rollbackCommit = '2e749839d2abdbaea73d35c91b417934d5a86699';
const rawProjectPath = '/kaaaaai/kaaaaai.tools.scripts/';
const credentialName = '(?:passphrase|p12|password|passwd|token|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|client[_-]?secret|private[_-]?key|subscription[_-]?url)';
const activeCredentialAssignment = new RegExp(
  String.raw`(?:^|[;,{)\n])\s*(?:(?:const|let|var)\s+)?(?:(?:[A-Za-z_$][\w$]*\s*\.\s*)?["']?${credentialName}["']?)\s*(?:=|:)\s*([^,;\]\}\n]+)`,
  'gmi',
);
const privateKey = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
const privateProfile = /quantumult_\d{14}\.conf(?:\.bak[^\s]*)?/i;
const profileSections = /\[(?:server_local|server_remote|mitm)\]/i;
const operationNames = ['runtime.health', 'config.get', 'command.ack', 'index.publish', 'index.read', 'index.clear'];
const preferenceLiterals = [
  'kaaaaai.steam-family-qx.',
  'settings.autoScan', 'settings.storeMarking', 'settings.debug', 'settings.logLevel',
  'commands.rescan', 'commands.refreshExternal', 'commands.clearCache',
  'acknowledgements.rescan', 'acknowledgements.refreshExternal', 'acknowledgements.clearCache',
  'index.manifest', 'index.staging.', 'index.chunk.',
];
const credentialConcepts = ['passphrase', 'p12', 'password', 'passwd', 'token', 'authorization', 'apikey', 'clientsecret', 'privatekey', 'subscriptionurl', 'cookie'];

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

function assertNoActiveCredentialValue(text, file) {
  const active = [...text.matchAll(activeCredentialAssignment)].some((match) => !/^(?:""|''|null|undefined)$/i.test(match[1].trim()));
  assert.equal(active, false, `${file} contains a credential assignment`);
}

function assertSecretFree(text, file) {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const concept of credentialConcepts) {
    assert.equal(normalized.includes(concept), false, `${file} contains credential vocabulary: ${concept}`);
  }
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
}

function declaredNames(bridge, name) {
  const match = bridge.match(new RegExp(`var ${name} = \\{([\\s\\S]*?)\\};`));
  assert.ok(match, `bridge must declare ${name}`);
  const entry = /(?:'([^']+)'|([A-Za-z_$][\w$]*))\s*:\s*true/g;
  const names = [...match[1].matchAll(entry)].map((item) => item[1] || item[2]);
  const remainder = match[1].replace(entry, '').replace(/[\s,]/g, '');
  assert.equal(remainder, '', `bridge ${name} declaration contains unrecognized syntax`);
  return names;
}

function assertOnlyMembershipReferences(bridge, name, member, file) {
  assert.equal((bridge.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length, 2, `${file} has unexpected ${name} references`);
  assert.match(bridge, new RegExp(`Object\\.prototype\\.hasOwnProperty\\.call\\(${name}, ${member}\\)`), `${file} must check ${name} with an own-property lookup`);
}

function assertBridgeNetworkFree(bridge, file) {
  const compact = (text) => text.toLowerCase().replace(/\s+/g, '');
  for (const text of [compact(bridge), compact(stripComments(bridge))]) {
    for (const primitive of ['$task', 'fetch', 'xmlhttprequest', 'http://', 'https://']) {
      assert.equal(text.includes(primitive), false, `${file} contains forbidden network primitive: ${primitive}`);
    }
  }
}

function assertOperationDiscriminatorView(view, file, viewName) {
  const membership = /Object\s*\.\s*prototype\s*\.\s*hasOwnProperty\s*\.\s*call\s*\(\s*ALLOWED\s*,\s*input\s*\.\s*operation\s*\)/g;
  assert.equal([...view.matchAll(membership)].length, 1, `${file} ${viewName} must use input.operation exactly once for allowlist membership`);
  const equality = /input\s*\.\s*operation\s*===\s*'([^']+)'/g;
  const dispatched = [...view.matchAll(equality)].map((entry) => entry[1]);
  assert.deepEqual(dispatched, operationNames, `${file} ${viewName} dispatch changed`);
  const remainingOperationUses = view.replace(membership, '').replace(equality, '');
  assert.doesNotMatch(remainingOperationUses, /\binput\s*\.\s*operation\b/, `${file} ${viewName} contains an unapproved input.operation use`);
  assert.doesNotMatch(view, /\b(?:eval|Function)\b|\.\s*constructor\b|\[\s*(?:['"][^'"]*constructor[^'"]*['"]|['"][^'"]*['"]\s*\+)/, `${file} ${viewName} contains dynamic evaluation or constructor dispatch`);
  assert.doesNotMatch(view, /\binput\s*\[/, `${file} ${viewName} uses computed operation access`);
  assert.doesNotMatch(view, /\b[A-Za-z_$][\w$]*\s*\[[^\]]+\]\s*\(/, `${file} ${viewName} contains dynamic function dispatch`);
}

function assertStrictBridge(bridge, file) {
  assert.deepEqual(declaredNames(bridge, 'ALLOWED'), operationNames, `${file} allowlist changed`);
  assert.deepEqual(declaredNames(bridge, 'COMMANDS'), ['rescan', 'refreshExternal', 'clearCache'], `${file} command allowlist changed`);
  assertOnlyMembershipReferences(bridge, 'ALLOWED', 'input.operation', file);
  assertOnlyMembershipReferences(bridge, 'COMMANDS', 'payload.command', file);
  const dotted = [...bridge.matchAll(/['"]([A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z0-9_.-]+)+)['"]/g)].map((entry) => entry[1]);
  for (const literal of dotted) {
    assert.ok(operationNames.includes(literal) || preferenceLiterals.includes(literal), `${file} contains an unapproved dotted literal: ${literal}`);
  }
  assertOperationDiscriminatorView(bridge, file, 'raw source');
  assertOperationDiscriminatorView(stripComments(bridge), file, 'comment-stripped source');
  assertBridgeNetworkFree(bridge, file);
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
    assertNoActiveCredentialValue(text, relative);
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
    assert.throws(() => assertSecretFree(fixture, 'fixture'), /credential vocabulary/);
  }
});

test('public artifact credential inspection rejects normalized vocabulary and bracket properties', () => {
  for (const fixture of [
    "settings['authorization'] = value;",
    'module.exports.token = value;',
    'const harmless = "COOKIE";',
    'const harmless = "client secret";',
  ]) {
    assert.throws(() => assertSecretFree(fixture, 'fixture'));
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
    "\nvar injected = { ['profile.read']: true };\n",
    "\nvar x = $task ['fetch'];\n",
    "\nvar x = $ TaSk ['FeTcH'];\n",
    '\nvar x = XMLHttpRequest;\n',
  ]) {
    assert.throws(() => assertStrictBridge(source + mutation, 'fixture'));
  }
});

test('bridge inspection rejects computed operation dispatch', () => {
  const source = fs.readFileSync(path.join(sourceDir, 'bridge.js'), 'utf8');
  assert.throws(() => assertStrictBridge(source.replaceAll('input.operation', "input['operation']"), 'fixture'));
});

test('bridge inspection rejects an aliased seventh operation and accepts harmless formatting', () => {
  const source = fs.readFileSync(path.join(sourceDir, 'bridge.js'), 'utf8');
  const aliased = source
    .replace("'index.clear': true", "'index.clear': true, ['evil']: true")
    .replace('var payload = input.payload;', 'var operationAlias = input.operation;\n    var payload = input.payload;')
    .replace("else throw new Error('FA_QX_OPERATION_DENIED');", "else if (operationAlias === 'evil') data = {};\n    else throw new Error('FA_QX_OPERATION_DENIED');");
  assert.throws(() => assertStrictBridge(aliased, 'fixture'));

  const formatted = source.replace(
    'var COMMANDS = { rescan: true, refreshExternal: true, clearCache: true };',
    'var COMMANDS = {\n    rescan: true,\n    refreshExternal: true,\n    clearCache: true\n  };',
  );
  assert.doesNotThrow(() => assertStrictBridge(formatted, 'formatted fixture'));
});

test('bridge inspection rejects same-line string-masked evaluation and split-vocabulary operation aliases', () => {
  const source = fs.readFileSync(path.join(sourceDir, 'bridge.js'), 'utf8');
  const mutation = source
    .replace('var payload = input.payload === undefined ? {} : input.payload;', "var note = '//'; eval('ignored'); var operationAlias = input.operation;\n    var payload = input.payload === undefined ? {} : input.payload;")
    .replace("else throw new Error('FA_QX_OPERATION_DENIED');", "else if (operationAlias === ('e' + 'vil')) data = {};\n    else throw new Error('FA_QX_OPERATION_DENIED');");
  assert.throws(() => assertStrictBridge(mutation, 'fixture'));
});

test('bridge exposes exactly the six Phase 1 operations and no network credential primitives', () => {
  for (const file of [path.join(sourceDir, 'bridge.js'), path.join(runtimeDir, 'releases/0.1.0/bridge.js')]) {
    const text = fs.readFileSync(file, 'utf8');
    assertStrictBridge(text, path.relative(root, file));
    assertSecretFree(text, path.relative(root, file));
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

test('rollback snippet pins its response script to the verified POC commit', () => {
  assert.equal(fs.existsSync(rollbackSnippetPath), true, 'rollback snippet must exist');
  const snippet = fs.readFileSync(rollbackSnippetPath, 'utf8');
  assert.match(snippet, new RegExp(`https://raw\\.githubusercontent\\.com/kaaaaai/kaaaaai\\.tools\\.scripts/${pinnedPocCommit}/quantumultx/steam-family/steam-family-poc\\.js`));
  assert.doesNotMatch(snippet, /\/main\//);
});

test('rollback documentation pins the outer resource to the immutable rollback commit', () => {
  const readme = fs.readFileSync(path.join(runtimeDir, 'README.md'), 'utf8');
  const expected = `https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/${rollbackCommit}/quantumultx/steam-family/rollback/poc-7425947.snippet`;
  assert.match(readme, new RegExp(expected.replaceAll('.', '\\.')));
  assert.match(readme, /replace\s+only this module's remote-resource URL/i);
  assert.match(readme, /never restore,\s*edit, replace, or publish the full private profile/i);
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
  assert.match(readme, new RegExp(`https://raw\\.githubusercontent\\.com/kaaaaai/kaaaaai\\.tools\\.scripts/${rollbackCommit}/quantumultx/steam-family/rollback/poc-7425947\\.snippet`));
  assert.match(readme, /replace\s+only this module's remote-resource URL[\s\S]*refresh Quantumult X[\s\S]*restore the main compatibility URL later/i);
  assert.doesNotMatch(readme, /prior versioned directory/i);
  assert.match(readme, /delete only the single Steam family remote-resource line/i);
  assert.match(readme, /full QX profile[\s\S]*must never be published/i);
  assert.match(readme, /successful health badge is hidden unless debug is enabled/i);
  assert.match(readme, /redacted failure badge may appear automatically even with debug off/i);
  assert.doesNotMatch(readme, /diagnostic badge to Steam HTML responses/i);
});
