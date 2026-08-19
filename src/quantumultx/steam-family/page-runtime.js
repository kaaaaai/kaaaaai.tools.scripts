(function () {
  'use strict';
  if (window.__FA_QX__ && window.__FA_QX__.buildId === '__FA_BUILD_ID__') return;
  function bridge(operation, payload) {
    return fetch('__FA_ROUTE_PREFIX__/bridge', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-FA-QX-Build': '__FA_BUILD_ID__' },
      body: JSON.stringify({ operation: operation, payload: payload || {}, release: '__FA_RELEASE__', buildId: '__FA_BUILD_ID__' })
    }).then(function (response) {
      if (!response.ok) throw new Error('FA_QX_BRIDGE_HTTP_' + response.status);
      return response.json();
    }).then(function (result) {
      if (!result || result.ok !== true) throw new Error(result && result.error ? result.error : 'FA_QX_BRIDGE_INVALID');
      return result.data;
    });
  }
  window.__FA_QX__ = { release: '__FA_RELEASE__', buildId: '__FA_BUILD_ID__', bridge: bridge };
  bridge('runtime.health', {}).catch(function () {});
})();
