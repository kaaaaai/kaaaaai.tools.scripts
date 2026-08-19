(function () {
  var pageRuntime = "(function () {\n  'use strict';\n  if (window.__FA_QX__ && window.__FA_QX__.buildId === '7f2d9dbd78b4') return;\n  function bridge(operation, payload) {\n    return fetch('/fa-qx/v1/bridge', {\n      method: 'POST',\n      credentials: 'same-origin',\n      headers: { 'Content-Type': 'application/json', 'X-FA-QX-Build': '7f2d9dbd78b4' },\n      body: JSON.stringify({ operation: operation, payload: payload || {}, release: '0.1.0', buildId: '7f2d9dbd78b4' })\n    }).then(function (response) {\n      if (!response.ok) throw new Error('FA_QX_BRIDGE_HTTP_' + response.status);\n      return response.json();\n    }).then(function (result) {\n      if (!result || result.ok !== true) throw new Error(result && result.error ? result.error : 'FA_QX_BRIDGE_INVALID');\n      return result.data;\n    });\n  }\n  window.__FA_QX__ = { release: '0.1.0', buildId: '7f2d9dbd78b4', bridge: bridge };\n  bridge('runtime.health', {}).catch(function () {});\n})();\n";
  $done({
    headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
    body: pageRuntime
  });
})();
