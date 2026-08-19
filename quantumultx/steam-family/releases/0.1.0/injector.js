(function () {
  var original = typeof $response !== 'undefined' && $response && typeof $response.body === 'string' ? $response.body : '';
  var headers = typeof $response !== 'undefined' && $response && $response.headers ? $response.headers : {};
  var contentType = String(headers['Content-Type'] || headers['content-type'] || '');
  var html = /text\/html|application\/xhtml\+xml/i.test(contentType) || /<(?:!doctype\s+html|html|head|body)\b/i.test(original);
  var marker = 'data-fa-qx-bootstrap="0b8a665af6fc"';
  var body = original;
  if (html && original.indexOf(marker) === -1 && /<\/body\s*>/i.test(original)) {
    var src = '/fa-qx/v1/runtime.js?release=0.1.0&build=0b8a665af6fc';
    var payload = '<script ' + marker + ' src="' + src + '"></script>';
    body = original.replace(/<\/body\s*>/i, payload + '</body>');
  }
  $done({ body: body });
})();
