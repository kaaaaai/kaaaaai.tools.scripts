(function () {
  $done({
    status: 'HTTP/1.1 501 Not Implemented',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ ok: false, error: 'FA_QX_PROXY_NOT_READY' })
  });
})();
