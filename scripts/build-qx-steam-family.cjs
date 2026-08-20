const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const sourceNames = ['injector.js', 'page-runtime.js', 'core-adapter.js', 'bridge.js', 'proxy.js', 'asset.js'];
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const snippetContract = {
  routePrefix: '/fa-qx/v1',
  hosts: ['store.steampowered.com', 'keylol.com', 'steamdb.keylol.com'],
};

function invalidMetadata(detail) {
  const error = new Error('FA_QX_METADATA_INVALID: ' + detail);
  error.code = 'FA_QX_METADATA_INVALID';
  throw error;
}

function validateRelease(value) {
  const required = ['release', 'coreVersion', 'schema', 'indexSchema', 'routePrefix', 'preferenceNamespace', 'hosts', 'operations', 'proxyOperations', 'dependencies', 'bridgeTimeoutMs'];
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
  if (!Array.isArray(value.proxyOperations) || value.proxyOperations.length === 0 || new Set(value.proxyOperations).size !== value.proxyOperations.length || value.proxyOperations.some((operation) => typeof operation !== 'string' || !/^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/.test(operation))) invalidMetadata('proxyOperations');
  if (!value.dependencies || typeof value.dependencies !== 'object' || Array.isArray(value.dependencies) || JSON.stringify(Object.keys(value.dependencies).sort()) !== JSON.stringify(['app-detail', 'chart', 'pinyin'])) invalidMetadata('dependencies');
  for (const dependency of Object.values(value.dependencies)) {
    if (!dependency || typeof dependency.url !== 'string' || !/^https:\/\//.test(dependency.url) || typeof dependency.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(dependency.sha256)) invalidMetadata('dependencies');
  }
  if (!Number.isSafeInteger(value.bridgeTimeoutMs) || value.bridgeTimeoutMs <= 0) invalidMetadata('bridgeTimeoutMs');
  return value;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

const operationHandler = (operation) => {
  const parts = operation.split('.');
  return parts[0] + parts.slice(1).map((part) => part[0].toUpperCase() + part.slice(1)).join('');
};
function immutableRelease() {
  const error = new Error('FA_QX_RELEASE_IMMUTABLE');
  error.code = 'FA_QX_RELEASE_IMMUTABLE';
  throw error;
}

function publishRelease(releaseDir, files) {
  if (fs.existsSync(releaseDir)) {
    for (const [name, expected] of Object.entries(files)) {
      const target = path.join(releaseDir, name);
      if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== expected) immutableRelease();
    }
    return;
  }
  fs.mkdirSync(releaseDir, { recursive: true });
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(releaseDir, name), body, 'utf8');
}

function build(projectRoot = path.resolve(__dirname, '..')) {
  const sourceDir = path.join(projectRoot, 'src/quantumultx/steam-family');
  const release = JSON.parse(fs.readFileSync(path.join(sourceDir, 'release.json'), 'utf8'));
  const sources = Object.fromEntries(sourceNames.map((name) => [name, fs.readFileSync(path.join(sourceDir, name), 'utf8')]));
  const userscriptSource = fs.readFileSync(path.join(projectRoot, 'steam-family-game-analysis.user.js'), 'utf8');
  const metadata = userscriptSource.match(/^\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==\s*/m);
  if (!metadata || !/^\/\/ @version\s+2\.06\s*$/m.test(metadata[0])) throw new Error('FA_QX_CORE_VERSION_INVALID');
  const core = userscriptSource.slice(metadata[0].length);
  validateRelease(release);
  if (release.routePrefix !== snippetContract.routePrefix) invalidMetadata('routePrefix diverges from snippet contract');
  if (JSON.stringify(release.hosts) !== JSON.stringify(snippetContract.hosts)) invalidMetadata('hosts diverge from snippet contract');

  const buildId = sha256(canonicalJson(release) + sourceNames.map((name) => sources[name]).join('') + core).slice(0, 12);
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
    __FA_MUTATION_HOST__: 'store.steampowered.com',
    __FA_OPERATION_DISPATCH__: operationDispatch,
    __FA_BRIDGE_TIMEOUT_MS__: String(release.bridgeTimeoutMs),
    __FA_CORE_VERSION__: release.coreVersion,
    __FA_PROXY_OPERATIONS__: JSON.stringify(release.proxyOperations),
  };

  function render(source) {
    const output = Object.entries(replacements).reduce((text, [marker, value]) => text.replace(new RegExp(marker, 'g'), value), source);
    for (const marker of Object.keys(replacements)) {
      if (output.includes(marker)) throw new Error('Unreplaced source marker: ' + marker);
    }
    return output;
  }

  const injector = render(sources['injector.js']);
  const pageRuntime = render(sources['core-adapter.js']) + '\n' + render(sources['page-runtime.js']);
  const bridge = render(sources['bridge.js']);
  const proxy = render(sources['proxy.js']);
  const rawPrefix = 'https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/releases/' + release.release + '/';
  replacements.__FA_ASSET_SOURCES__ = JSON.stringify({
    chart: release.dependencies.chart.url,
    pinyin: release.dependencies.pinyin.url,
    'app-detail': release.dependencies['app-detail'].url,
    core: rawPrefix + 'core.js',
  });
  const assetAsset = render(sources['asset.js']);
  const runtimeAsset = "(function () {\n  var pageRuntime = " + JSON.stringify(pageRuntime) + ";\n  $done({\n    headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },\n    body: pageRuntime\n  });\n})();\n";
  const assets = { 'injector.js': injector, 'runtime-asset.js': runtimeAsset, 'bridge.js': bridge, 'proxy.js': proxy, 'asset-asset.js': assetAsset, 'core.js': core };
  const manifest = {
    release: release.release,
    coreVersion: release.coreVersion,
    schema: release.schema,
    indexSchema: release.indexSchema,
    routePrefix: release.routePrefix,
    preferenceNamespace: release.preferenceNamespace,
    hosts: release.hosts,
    operations: release.operations,
    proxyOperations: release.proxyOperations,
    dependencies: release.dependencies,
    bridgeTimeoutMs: release.bridgeTimeoutMs,
    buildId,
    assets: Object.fromEntries(Object.entries(assets).map(([name, body]) => [name, { sha256: sha256(body) }])),
  };
  const releaseFiles = { ...assets, 'manifest.json': JSON.stringify(manifest, null, 2) + '\n' };
  const releaseDir = path.join(projectRoot, 'quantumultx/steam-family/releases', release.release);

  const snippet = [
    'hostname = store.steampowered.com, keylol.com, steamdb.keylol.com',
    '^https:\\/\\/(?:store\\.steampowered\\.com|keylol\\.com|steamdb\\.keylol\\.com)\\/fa-qx\\/v1\\/runtime\\.js(?:\\?.*)?$ url script-echo-response ' + rawPrefix + 'runtime-asset.js',
    '^https:\\/\\/(?:store\\.steampowered\\.com|keylol\\.com|steamdb\\.keylol\\.com)\\/fa-qx\\/v1\\/bridge(?:\\?.*)?$ url script-echo-response ' + rawPrefix + 'bridge.js',
    '^https:\\/\\/store\\.steampowered\\.com\\/fa-qx\\/v1\\/proxy$ url script-analyze-echo-response ' + rawPrefix + 'proxy.js',
    '^https:\\/\\/(?:store\\.steampowered\\.com|keylol\\.com|steamdb\\.keylol\\.com)\\/fa-qx\\/v1\\/asset\\/(?:chart|pinyin|app-detail|core)\\.js(?:\\?.*)?$ url script-echo-response ' + rawPrefix + 'asset-asset.js',
    '^https:\\/\\/store\\.steampowered\\.com\\/(?:\\?.*)?$ url script-response-body ' + rawPrefix + 'injector.js',
    '^https:\\/\\/keylol\\.com\\/(?:\\?.*)?$ url script-response-body ' + rawPrefix + 'injector.js',
    '^https:\\/\\/steamdb\\.keylol\\.com\\/tooltip(?:[\\/?#].*)?$ url script-response-body ' + rawPrefix + 'injector.js',
    '',
  ].join('\n');

  publishRelease(releaseDir, releaseFiles);
  const publishedRoot = path.join(projectRoot, 'quantumultx/steam-family');
  fs.mkdirSync(publishedRoot, { recursive: true });
  for (const name of ['steam-family.snippet', 'steam-family-poc.snippet']) {
    fs.writeFileSync(path.join(publishedRoot, name), snippet, 'utf8');
  }
  return { release: release.release, buildId, files: releaseFiles, snippet };
}

module.exports = { build, validateRelease };

if (require.main === module) {
  const result = build();
  console.log('Built QX Steam Family ' + result.release + ' (' + result.buildId + ')');
}
