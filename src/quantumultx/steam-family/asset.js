(function () {
  var request = typeof $request !== 'undefined' && $request ? $request : {};
  var match = typeof request.url === 'string' ? request.url.match(/^https:\/\/[^/?#]+__FA_ROUTE_PREFIX__\/asset\/(chart|pinyin|app-detail|core)\.js(?:\?[^#]*)?$/) : null;
  var sources = __FA_ASSET_SOURCES__;
  var name = match && match[1];
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
