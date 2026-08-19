const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.resolve(__dirname, '..', 'steam-family-game-analysis.user.js');
const readSource = () => fs.readFileSync(scriptPath, 'utf8');

test('renders the standard family-share marker as a complete purple pill', () => {
  const source = readSource();

  assert.match(source, /flag\.className = "ds_flag ds_family_share_flag fa-fs-standard"/);
  assert.match(
    source,
    /\.fa-fs-standard\{left:0!important;right:auto!important;width:auto!important;min-width:max-content!important;height:24px!important/,
  );
  assert.match(source, /\.fa-fs-standard\{[^}]*box-sizing:border-box!important/);
  assert.match(source, /\.fa-fs-standard\{[^}]*overflow:hidden!important/);
  assert.match(source, /\.fa-fs-standard\{[^}]*background-position:5px center!important/);
  assert.match(source, /flag\.textContent = '家庭共享'/);
  assert.doesNotMatch(source, /家庭共享&nbsp;&nbsp;/);
});

test('keeps horizontal game rows on the compact icon-only marker', () => {
  const source = readSource();

  assert.match(
    source,
    /\.fa-fs-compact\{left:0!important;right:auto!important;width:20px!important;height:20px!important/,
  );
  assert.match(source, /flag\.className = "ds_flag ds_family_share_flag fa-fs-compact"/);
  assert.match(source, /flag\.innerHTML = ''/);
});
