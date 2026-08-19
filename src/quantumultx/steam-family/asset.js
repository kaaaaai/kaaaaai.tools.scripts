(function () {
  var request = typeof $request !== 'undefined' && $request ? $request : {};
  var route = typeof request.url === 'string' ? request.url.match(/^https:\/\/([^/?#]+)(\/[^?#]*)(?:\?[^#]*)?$/) : null;
  var hosts = __FA_HOSTS__;
  var prefix = '__FA_ROUTE_PREFIX__/asset/';
  var sources = __FA_ASSET_SOURCES__;
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
