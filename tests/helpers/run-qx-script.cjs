const vm = require('node:vm');

function runQx(source, overrides = {}) {
  const calls = [];
  const values = new Map(Object.entries(overrides.prefValues || {}));
  const prefs = overrides.$prefs || {
    valueForKey(key) { return values.has(key) ? values.get(key) : null; },
    setValueForKey(value, key) { values.set(key, String(value)); return true; },
    removeValueForKey(key) { return values.delete(key); },
  };
  const context = {
    $request: overrides.$request,
    $response: overrides.$response,
    $prefs: prefs,
    $done(result) { calls.push(result); },
    console: { log() {}, warn() {}, error() {} },
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(source, context, { timeout: 1000 });
  return { calls, values, context };
}

module.exports = { runQx };
