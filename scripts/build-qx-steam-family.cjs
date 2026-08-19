const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'src/quantumultx/steam-family');
const release = JSON.parse(fs.readFileSync(path.join(sourceDir, 'release.json'), 'utf8'));
const sourceNames = ['injector.js', 'page-runtime.js', 'bridge.js'];
const sources = Object.fromEntries(sourceNames.map((name) => [name, fs.readFileSync(path.join(sourceDir, name), 'utf8')]));
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

if (typeof release.release !== 'string' || !/^[0-9A-Za-z.-]+$/.test(release.release) || release.release.includes('/') || release.release.includes('..')) {
  throw new Error('Invalid release identifier');
}

const buildId = sha256(canonicalJson(release) + sources['injector.js'] + sources['page-runtime.js'] + sources['bridge.js']).slice(0, 12);
const replacements = {
  __FA_RELEASE__: release.release,
  __FA_BUILD_ID__: buildId,
  __FA_ROUTE_PREFIX__: release.routePrefix,
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
