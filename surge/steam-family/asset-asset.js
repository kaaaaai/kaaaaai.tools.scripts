// Surge adapter for the QX Steam Family 0.2.4 release.
// The upstream module code below is copied from this repository's QX release.
(function (surgeDone) {
  function qxDone(result) {
    result = result || {};
    var status = typeof result.status === 'number' ? result.status : Number(String(result.status || '').match(/\b([1-5][0-9][0-9])\b/)?.[1] || 200);
    surgeDone({ response: { status: status, headers: result.headers || {}, body: result.body || '' } });
  }
  var $done = qxDone;
  var $task = {
    fetch: function (options) {
      return new Promise(function (resolve, reject) {
        $httpClient.get({ url: options.url, timeout: 20, 'auto-redirect': true, 'auto-cookie': false }, function (error, response, data) {
          if (error) { reject(new Error(String(error))); return; }
          resolve({ statusCode: response.status, body: typeof data === 'string' ? data : '' });
        });
      });
    }
  };
(function () {
  var request = typeof $request !== 'undefined' && $request ? $request : {};
  var route = typeof request.url === 'string' ? request.url.match(/^https:\/\/([^/?#]+)(\/[^?#]*)(?:\?[^#]*)?$/) : null;
  var hosts = ["store.steampowered.com","keylol.com","steamdb.keylol.com"];
  var prefix = '/fa-qx/v1/asset/';
  var sources = {"chart":"https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.js","pinyin":"https://update.greasyfork.org/scripts/590086/1895071/SGLV%20%E6%8B%BC%E9%9F%B3%E5%AD%97%E5%BA%93%20%28Library%29.js","app-detail":"https://update.greasyfork.org/scripts/590084/1894626/SGLV%20App%20Detail%20Library.js","core":"https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/releases/0.2.4/core.js"};
  var path = route && hosts.indexOf(route[1].toLowerCase()) !== -1 ? route[2] : '';
  var name = path.indexOf(prefix) === 0 && /\.js$/.test(path) ? path.slice(prefix.length, -3) : '';
  var upstream = name && sources[name];
  if (!upstream) {
    $done({ status: 'HTTP/1.1 404 Not Found', headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' }, body: '' });
    return;
  }
  $task.fetch({ url: upstream, method: 'GET', opts: { redirection: true } }).then(function (response) {
    if (!response || response.statusCode < 200 || response.statusCode >= 300 || typeof response.body !== 'string') throw new Error('FA_QX_ASSET_UPSTREAM');
    $done({ status: 'HTTP/1.1 200 OK', headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' }, body: response.body });
  }).catch(function () {
    $done({ status: 'HTTP/1.1 502 Bad Gateway', headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' }, body: '' });
  });
})();

})($done);
