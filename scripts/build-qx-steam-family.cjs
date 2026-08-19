const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'src/quantumultx/steam-family');
const release = JSON.parse(fs.readFileSync(path.join(sourceDir, 'release.json'), 'utf8'));
const sourceNames = ['injector.js', 'page-runtime.js', 'bridge.js'];
const sources = Object.fromEntries(sourceNames.map((name) => [name, fs.readFileSync(path.join(sourceDir, name), 'utf8')]));
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

function invalidMetadata(detail) {
  const error = new Error('FA_QX_METADATA_INVALID: ' + detail);
  error.code = 'FA_QX_METADATA_INVALID';
  throw error;
}

function validateRelease(value) {
  const required = ['release', 'coreVersion', 'schema', 'indexSchema', 'routePrefix', 'preferenceNamespace', 'hosts', 'operations', 'bridgeTimeoutMs'];
  for (const field of required) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) invalidMetadata('missing ' + field);
  }
  if (typeof value.release !== 'string' || !/^[0-9A-Za-z.-]+$/.test(value.release) || value.release.includes('/') || value.release.includes('..')) invalidMetadata('release');
  if (value.coreVersion !== null && typeof value.coreVersion !== 'string') invalidMetadata('coreVersion');
  if (!Number.isSafeInteger(value.schema) || value.schema <= 0) invalidMetadata('schema');
  if (!Number.isSafeInteger(value.indexSchema) || value.indexSchema <= 0) invalidMetadata('indexSchema');
  if (typeof value.routePrefix !== 'string' || !/^\/[A-Za-z0-9._~/-]+$/.test(value.routePrefix) || value.routePrefix.endsWith('/')) invalidMetadata('routePrefix');
  if (typeof value.preferenceNamespace !== 'string' || !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+$/.test(value.preferenceNamespace)) invalidMetadata('preferenceNamespace');
  if (!Array.isArray(value.hosts) || value.hosts.length === 0 || new Set(value.hosts).size !== value.hosts.length || value.hosts.some((host) => typeof host !== 'string' || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(host))) invalidMetadata('hosts');
  if (!Array.isArray(value.operations) || value.operations.length === 0 || new Set(value.operations).size !== value.operations.length || value.operations.some((operation) => typeof operation !== 'string' || !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(operation))) invalidMetadata('operations');
  if (!Number.isSafeInteger(value.bridgeTimeoutMs) || value.bridgeTimeoutMs <= 0) invalidMetadata('bridgeTimeoutMs');
  return value;
}

validateRelease(release);

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

const buildId = sha256(canonicalJson(release) + sources['injector.js'] + sources['page-runtime.js'] + sources['bridge.js']).slice(0, 12);
const operationHandler = (operation) => {
  const parts = operation.split('.');
  return parts[0] + parts.slice(1).map((part) => part[0].toUpperCase() + part.slice(1)).join('');
};
const operationDispatch = '{\n' + release.operations.map((operation) => {
  const verb = operation.split('.')[1];
  const storeOnly = verb === 'publish' || verb === 'clear' || verb === 'ack';
  return "    '" + operation + "': { handler: " + operationHandler(operation) + ', storeOnly: ' + storeOnly + ' }';
}).join(',\n') + '\n  }';
const replacements = {
  __FA_RELEASE__: release.release,
  __FA_BUILD_ID__: buildId,
  __FA_ROUTE_PREFIX__: release.routePrefix,
  __FA_PREFERENCE_NAMESPACE__: release.preferenceNamespace,
  __FA_SCHEMA__: String(release.schema),
  __FA_INDEX_SCHEMA__: String(release.indexSchema),
  __FA_HOSTS__: JSON.stringify(release.hosts),
  __FA_OPERATION_DISPATCH__: operationDispatch,
  __FA_BRIDGE_TIMEOUT_MS__: String(release.bridgeTimeoutMs),
};

function render(source) {
  const output = Object.entries(replacements).reduce((text, [marker, value]) => text.replace(new RegExp(marker, 'g'), value), source);
  for (const marker of Object.keys(replacements)) {
    if (output.includes(marker)) throw new Error('Unreplaced source marker: ' + marker);
  }
  return output;
}

const injector = render(sources['injector.js']);
const pageRuntime = render(sources['page-runtime.js']);
const bridge = render(sources['bridge.js']);
const runtimeAsset = "(function () {\n  var pageRuntime = " + JSON.stringify(pageRuntime) + ";\n  $done({\n    headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },\n    body: pageRuntime\n  });\n})();\n";
const releaseDir = path.join(root, 'quantumultx/steam-family/releases', release.release);

fs.mkdirSync(releaseDir, { recursive: true });
const assets = { 'injector.js': injector, 'runtime-asset.js': runtimeAsset, 'bridge.js': bridge };
for (const [name, body] of Object.entries(assets)) {
  fs.writeFileSync(path.join(releaseDir, name), body, 'utf8');
}
const manifest = {
  release: release.release,
  coreVersion: release.coreVersion,
  schema: release.schema,
  indexSchema: release.indexSchema,
  routePrefix: release.routePrefix,
  preferenceNamespace: release.preferenceNamespace,
  hosts: release.hosts,
  operations: release.operations,
  bridgeTimeoutMs: release.bridgeTimeoutMs,
  buildId,
  assets: Object.fromEntries(Object.entries(assets).map(([name, body]) => [name, { sha256: sha256(body) }])),
};
fs.writeFileSync(path.join(releaseDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

const rawPrefix = 'https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/releases/' + release.release + '/';
const snippet = [
  'hostname = store.steampowered.com, keylol.com, steamdb.keylol.com',
  '^https:\\/\\/(?:store\\.steampowered\\.com|keylol\\.com|steamdb\\.keylol\\.com)\\/fa-qx\\/v1\\/runtime\\.js(?:\\?.*)?$ url script-echo-response ' + rawPrefix + 'runtime-asset.js',
  '^https:\\/\\/(?:store\\.steampowered\\.com|keylol\\.com|steamdb\\.keylol\\.com)\\/fa-qx\\/v1\\/bridge(?:\\?.*)?$ url script-echo-response ' + rawPrefix + 'bridge.js',
  '^https:\\/\\/store\\.steampowered\\.com\\/(?:\\?.*)?$ url script-response-body ' + rawPrefix + 'injector.js',
  '^https:\\/\\/keylol\\.com\\/(?:\\?.*)?$ url script-response-body ' + rawPrefix + 'injector.js',
  '^https:\\/\\/steamdb\\.keylol\\.com\\/tooltip(?:[\\/?#].*)?$ url script-response-body ' + rawPrefix + 'injector.js',
  '',
].join('\n');
for (const name of ['steam-family.snippet', 'steam-family-poc.snippet']) {
  fs.writeFileSync(path.join(root, 'quantumultx/steam-family', name), snippet, 'utf8');
}

console.log('Built QX Steam Family ' + release.release + ' (' + buildId + ')');
