(function () {
  var original = typeof $response !== 'undefined' && $response && typeof $response.body === 'string' ? $response.body : '';
  var headers = typeof $response !== 'undefined' && $response && $response.headers ? $response.headers : {};
  var contentType = String(headers['Content-Type'] || headers['content-type'] || '');
  var html = /text\/html|application\/xhtml\+xml/i.test(contentType) || /<(?:!doctype\s+html|html|head|body)\b/i.test(original);
  var marker = 'data-fa-qx-bootstrap="__FA_BUILD_ID__"';
  var body = original;
  if (html && original.indexOf(marker) === -1 && /<\/body\s*>/i.test(original)) {
    var src = '__FA_ROUTE_PREFIX__/runtime.js?release=__FA_RELEASE__&build=__FA_BUILD_ID__';
    var payload = '<script ' + marker + ' src="' + src + '"></script>';
    body = original.replace(/<\/body\s*>/i, payload + '</body>');
  }
  $done({ body: body });
})();
