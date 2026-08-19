(function () {
  var original = (typeof $response !== 'undefined' && $response && typeof $response.body === 'string')
    ? $response.body
    : '';
  var body = original;
  var looksLikeHtml = /<(?:!doctype\s+html|html|head|body)\b/i.test(original);

  if (
    looksLikeHtml &&
    original.indexOf('id="fa-qx-poc"') === -1 &&
    /<\/body\s*>/i.test(original)
  ) {
    var payload = '<div id="fa-qx-poc" data-js="pending" style="position:fixed;left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483647;max-width:none;box-sizing:border-box;padding:8px 12px;border-radius:8px;background:#111827;color:#f9fafb;font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none">FA QX · HTML ✓ · JS …</div><script>(function(){var badge=document.getElementById("fa-qx-poc");if(badge){badge.setAttribute("data-js","ok");badge.textContent="FA QX · HTML ✓ · JS ✓";}})();</script>';
    body = original.replace(/<\/body\s*>/i, payload + '</body>');
  }

  $done({ body: body });
})();
