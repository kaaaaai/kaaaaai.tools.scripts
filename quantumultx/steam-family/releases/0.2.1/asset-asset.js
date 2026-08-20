(function () {
  var request = typeof $request !== 'undefined' && $request ? $request : {};
  var route = typeof request.url === 'string' ? request.url.match(/^https:\/\/([^/?#]+)(\/[^?#]*)(?:\?[^#]*)?$/) : null;
  var hosts = ["store.steampowered.com","keylol.com","steamdb.keylol.com"];
  var prefix = '/fa-qx/v1/asset/';
  var sources = {"chart":"https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.js","pinyin":"https://update.greasyfork.org/scripts/590086/1895071/SGLV%20%E6%8B%BC%E9%9F%B3%E5%AD%97%E5%BA%93%20%28Library%29.js","app-detail":"https://update.greasyfork.org/scripts/590084/1894626/SGLV%20App%20Detail%20Library.js","core":"https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/releases/0.2.1/core.js"};
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
