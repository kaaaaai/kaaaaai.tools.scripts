const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runQx } = require('./helpers/run-qx-script.cjs');

const root = path.resolve(__dirname, '..');
const steamFamilyDir = path.join(root, 'quantumultx/steam-family');
const releaseDir = path.join(steamFamilyDir, 'releases/0.1.1');
const rawPrefix = 'https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/';
const compatibilitySnippetUrl = `${rawPrefix}quantumultx/steam-family/steam-family-poc.snippet`;
const compatibilityResourceLine = `${compatibilitySnippetUrl}, tag=Steam家庭库POC, update-interval=86400, opt-parser=false, enabled=true`;

function runProductionInjector(body, headers = { 'Content-Type': 'text/html' }) {
  const source = fs.readFileSync(path.join(releaseDir, 'injector.js'), 'utf8');
  const { calls } = runQx(source, { $response: { body, headers } });
  assert.equal(calls.length, 1);
  return calls[0].body;
}

test('compatibility snippet remains byte-identical to the canonical production snippet', () => {
  const compatibility = fs.readFileSync(path.join(steamFamilyDir, 'steam-family-poc.snippet'), 'utf8');
  const canonical = fs.readFileSync(path.join(steamFamilyDir, 'steam-family.snippet'), 'utf8');
  assert.equal(compatibility, canonical);
  assert.match(compatibility, /releases\/0\.1\.1\/injector\.js/);
});

test('installed compatibility snippet URL remains documented exactly', () => {
  const readme = fs.readFileSync(path.join(steamFamilyDir, 'README.md'), 'utf8');
  assert.ok(readme.split('\n').includes(compatibilityResourceLine));
});

test('production injector injects its external runtime without the obsolete POC badge', () => {
  const injected = runProductionInjector('<!doctype html><html><body>Steam</body></html>');
  assert.match(injected, /data-fa-qx-bootstrap="[0-9a-f]{12}"/);
  assert.match(injected, /\/fa-qx\/v1\/runtime\.js\?release=0\.1\.1&build=[0-9a-f]{12}/);
  assert.doesNotMatch(injected, /fa-qx-poc|FA QX · HTML ✓ · JS/);
});

test('production injector preserves non-HTML bodies and does not duplicate its bootstrap', () => {
  assert.equal(runProductionInjector('{"ok":true}', { 'Content-Type': 'application/json' }), '{"ok":true}');
  const once = runProductionInjector('<html><body>Steam</body></html>');
  assert.equal((runProductionInjector(once).match(/data-fa-qx-bootstrap=/g) || []).length, 1);
});
