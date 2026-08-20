const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const runtimeDir = path.join(root, 'quantumultx/steam-family');
const sourceDir = path.join(root, 'src/quantumultx/steam-family');
const rollbackSnippetPath = path.join(runtimeDir, 'rollback/poc-7425947.snippet');
const pinnedPocCommit = '742594724a9cc761d48a5edb06c1802896073958';
const rollbackCommit = 'c16b1c22b430088609f027edbbb9be32755d4cff';
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
  if (!carriesRuntimeCredentialVocabulary(file)) assert.equal(url.search, '', `${file} URL must not include a query string`);
  assert.equal(url.hash, '', `${file} URL must not include a fragment`);
  if (url.hostname === 'raw.githubusercontent.com') {
    assert.ok(
      url.pathname.startsWith(rawProjectPath) || url.pathname.startsWith('/SmallRob/steam-namespace/refs/heads/main/data/'),
      `${file} raw GitHub URL must stay under an allowlisted public data repository`,
    );
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

function carriesRuntimeCredentialVocabulary(file) {
  return /(?:^|\/)(?:core-adapter|proxy|asset)\.js$/.test(file)
    || /releases\/0\.2\.(?:0|1|2|3|4)\/(?:core|runtime-asset|proxy|asset-asset)\.js$/.test(file)
    || /(?:^|\/)release\.json$/.test(file)
    || /releases\/0\.2\.(?:0|1|2|3|4)\/manifest\.json$/.test(file);
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
}

function assertBridgeNetworkFree(bridge, file) {
  const compact = (text) => text.toLowerCase().replace(/\s+/g, '');
  for (const text of [compact(bridge), compact(stripComments(bridge))]) {
    for (const primitive of ['$task', 'fetch', 'xmlhttprequest', 'http://', 'https://']) {
      assert.equal(text.includes(primitive), false, `${file} contains forbidden network primitive: ${primitive}`);
    }
  }
}

function generatedOperationDispatch(bridge, file) {
  const declaration = bridge.match(/var OPERATIONS = \{([\s\S]*?)\n  \};/);
  assert.ok(declaration, `${file} must contain the generated operation dispatch`);
  const entries = [...declaration[1].matchAll(/'([^']+)': \{ handler: ([A-Za-z_$][\w$]*), storeOnly: (true|false) \}/g)]
    .map((match) => ({ name: match[1], handler: match[2], storeOnly: match[3] === 'true' }));
  const remainder = declaration[1]
    .replace(/'([^']+)': \{ handler: ([A-Za-z_$][\w$]*), storeOnly: (?:true|false) \}/g, '')
    .replace(/[\s,]/g, '');
  assert.equal(remainder, '', `${file} operation dispatch contains unrecognized syntax`);
  return entries;
}

function assertStaticBridgeSafety(bridge, file) {
  assertBridgeNetworkFree(bridge, file);
  for (const view of [bridge, stripComments(bridge)]) {
    assert.doesNotMatch(view, /\b(?:eval|Function)\b|\.\s*constructor\b|\[\s*(?:['"][^'"]*constructor[^'"]*['"]|['"][^'"]*['"]\s*\+)/, `${file} contains dynamic evaluation or constructor dispatch`);
  }
}

test('public runtime and source artifacts exclude private profile and credential material', () => {
  for (const file of publicRuntimeFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file);
    // The full core and its proxy necessarily contain variable names such as
    // accessToken. They may contain vocabulary, but never embedded values.
    if (!carriesRuntimeCredentialVocabulary(relative)) assertSecretFree(text, relative);
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
    /raw GitHub URL must stay under an allowlisted public data repository/,
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

test('bridge inspection rejects dynamic evaluation and network primitives', () => {
  const source = fs.readFileSync(path.join(sourceDir, 'bridge.js'), 'utf8');
  for (const mutation of [
    '\neval("ignored");\n',
    '\neval/*x*/("AL" + "LOWED[\\\'profile.read\\\'] = true");\n',
    '\nObject.constructor("ignored");\n',
    '\nObject["con" + "structor"]("ignored");\n',
    "\nvar x = $task ['fetch'];\n",
    "\nvar x = $ TaSk ['FeTcH'];\n",
    '\nvar x = XMLHttpRequest;\n',
  ]) {
    assert.throws(() => assertStaticBridgeSafety(source + mutation, 'fixture'));
  }
});

test('bridge exposes exactly the six Phase 1 operations and no network credential primitives', () => {
  for (const file of [path.join(sourceDir, 'bridge.js'), path.join(runtimeDir, 'releases/0.2.4/bridge.js')]) {
    const text = fs.readFileSync(file, 'utf8');
    assertStaticBridgeSafety(text, path.relative(root, file));
    assertSecretFree(text, path.relative(root, file));
  }
});

test('release metadata generates one exact handler entry for every Phase 1 operation', () => {
  const release = JSON.parse(fs.readFileSync(path.join(sourceDir, 'release.json'), 'utf8'));
  assert.deepEqual(release.operations, operationNames);
  const source = fs.readFileSync(path.join(sourceDir, 'bridge.js'), 'utf8');
  assert.equal((source.match(/__FA_OPERATION_DISPATCH__/g) || []).length, 1);
  for (const operation of operationNames) assert.doesNotMatch(source, new RegExp(`['"]${operation.replace('.', '\\.')}['"]`));
  const generated = fs.readFileSync(path.join(runtimeDir, 'releases/0.2.4/bridge.js'), 'utf8');
  const dispatch = generatedOperationDispatch(generated, 'generated bridge');
  assert.deepEqual(dispatch.map((entry) => entry.name), operationNames);
  assert.equal(new Set(dispatch.map((entry) => entry.handler)).size, operationNames.length);
  assert.equal(dispatch.length, operationNames.length);
  assert.doesNotMatch(generated, /input\.operation\s*===/);
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
  assert.doesNotMatch(snippet, /kaaaaai\.tools\.scripts\/[0-9a-f]{7}\//, 'rollback revisions must never use short commit hashes');
});

test('rollback documentation pins the outer resource to the immutable rollback commit', () => {
  const readme = fs.readFileSync(path.join(runtimeDir, 'README.md'), 'utf8');
  const expected = `https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/${rollbackCommit}/quantumultx/steam-family/rollback/poc-7425947.snippet`;
  assert.match(readme, new RegExp(expected.replaceAll('.', '\\.')));
  assert.doesNotMatch(readme, /kaaaaai\.tools\.scripts\/[0-9a-f]{7}\//, 'outer rollback revisions must never use short commit hashes');
  assert.match(readme, /replace\s+only this module's remote-resource URL/i);
  assert.match(readme, /never restore,\s*edit, replace, or publish the full private profile/i);
});

test('installation documentation describes the production runtime without the diagnostic-only POC module', () => {
  const readme = fs.readFileSync(path.join(runtimeDir, 'README.md'), 'utf8');
  assert.match(readme, /steam-family\.snippet, tag=Steam家庭库/);
  assert.match(readme, /boxjs\.json/);
  assert.match(readme, /BoxJS.*rewrite resource/i);
  assert.match(readme, /no badge is ambiguous/i);
  assert.match(readme, /no badge after debug was enabled and the page refreshed/i);
  assert.match(readme, /runtime ✓/i);
  assert.match(readme, /bridge ✓/i);
  assert.match(readme, /version mismatch/i);
  assert.match(readme, /redacted error/i);
  assert.match(readme, /调试角标[\s\S]*badge/i);
  assert.match(readme, /0\.2\.4[\s\S]*2\.08[\s\S]*schema.*1[\s\S]*index schema.*1/i);
  assert.match(readme, new RegExp(`https://raw\\.githubusercontent\\.com/kaaaaai/kaaaaai\\.tools\\.scripts/${rollbackCommit}/quantumultx/steam-family/rollback/poc-7425947\\.snippet`));
  assert.match(readme, /replace\s+only this module's remote-resource URL[\s\S]*refresh Quantumult X[\s\S]*restore the main compatibility URL later/i);
  assert.doesNotMatch(readme, /prior versioned directory/i);
  assert.match(readme, /delete only the single Steam family remote-resource line/i);
  assert.match(readme, /full QX profile[\s\S]*must never be published/i);
  assert.match(readme, /successful health badge is hidden unless debug is enabled/i);
  assert.match(readme, /redacted failure badge may appear automatically even with debug off/i);
  assert.doesNotMatch(readme, /diagnostic badge to Steam HTML responses/i);
});
