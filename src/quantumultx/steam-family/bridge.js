(function () {
  var request = typeof $request !== 'undefined' && $request ? $request : {};
  var raw = typeof request.body === 'string' ? request.body : '';
  var status = 200;
  var result;
  try {
    if (raw.length > 524288) throw new Error('FA_QX_BODY_TOO_LARGE');
    var input = JSON.parse(raw || '{}');
    if (input.operation !== 'runtime.health') throw new Error('FA_QX_OPERATION_DENIED');
    if (input.release !== '__FA_RELEASE__' || input.buildId !== '__FA_BUILD_ID__') throw new Error('FA_QX_VERSION_MISMATCH');
    result = { ok: true, data: { release: '__FA_RELEASE__', buildId: '__FA_BUILD_ID__', coreVersion: null, schema: 1 } };
  } catch (error) {
    status = /DENIED/.test(String(error.message)) ? 403 : 400;
    result = { ok: false, error: String(error.message || 'FA_QX_BAD_REQUEST') };
  }
  $done({
    status: 'HTTP/1.1 ' + status + (status === 200 ? ' OK' : status === 403 ? ' Forbidden' : ' Bad Request'),
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(result)
  });
})();
