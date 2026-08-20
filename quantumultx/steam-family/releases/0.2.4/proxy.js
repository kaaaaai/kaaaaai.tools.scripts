(function () {
  'use strict';
  var ROUTE = '/fa-qx/v1/proxy';
  var ALLOWED = ["steam.familyGroup","steam.sharedApps","steam.playerLinks","steam.recentGames","steam.ownedGames","steam.storeItems","steam.appDetails","steam.wishlist","external.bundle","external.dlc","external.goty","external.exchangeRates","external.augmentedRates"];
  var MAX_REQUEST_BYTES = 131072;
  var MAX_RESPONSE_BYTES = 8388608;
  var finished = false;

  function utf8Bytes(text) {
    var bytes = 0;
    for (var index = 0; index < text.length; index += 1) {
      var code = text.charCodeAt(index);
      if (code < 128) bytes += 1;
      else if (code < 2048) bytes += 2;
      else if (code >= 55296 && code <= 56319 && index + 1 < text.length && text.charCodeAt(index + 1) >= 56320 && text.charCodeAt(index + 1) <= 57343) { bytes += 4; index += 1; }
      else bytes += 3;
    }
    return bytes;
  }
  function only(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys.slice().sort());
  }
  function token(value) { return typeof value === 'string' && /^[A-Za-z0-9._~-]{3,4096}$/.test(value); }
  function steamId(value) { return typeof value === 'string' && /^[0-9]{5,20}$/.test(value); }
  function positiveId(value) { return (typeof value === 'string' && /^[1-9][0-9]{0,24}$/.test(value)) || (typeof value === 'number' && Number.isSafeInteger(value) && value > 0); }
  function encoded(value) { return encodeURIComponent(String(value)); }
  function rejectPayload() { throw new Error('FA_QX_PROXY_PAYLOAD_INVALID'); }

  function upstream(operation, payload) {
    var base = 'https://api.steampowered.com/';
    if (operation === 'steam.familyGroup') {
      if (!only(payload, ['token']) || !token(payload.token)) rejectPayload();
      return base + 'IFamilyGroupsService/GetFamilyGroupForUser/v1/?access_token=' + encoded(payload.token) + '&include_family_group_response=true';
    }
    if (operation === 'steam.sharedApps') {
      if (!only(payload, ['token', 'familyGroupId']) || !token(payload.token) || !positiveId(payload.familyGroupId)) rejectPayload();
      return base + 'IFamilyGroupsService/GetSharedLibraryApps/v1/?access_token=' + encoded(payload.token) + '&family_groupid=' + encoded(payload.familyGroupId) + '&include_own=true&include_excluded=false&include_non_games=false';
    }
    if (operation === 'steam.playerLinks') {
      if (!only(payload, ['token', 'steamIds']) || !token(payload.token) || !Array.isArray(payload.steamIds) || payload.steamIds.length < 1 || payload.steamIds.length > 6 || payload.steamIds.some(function (id) { return !steamId(id); })) rejectPayload();
      return base + 'IPlayerService/GetPlayerLinkDetails/v1/?access_token=' + encoded(payload.token) + payload.steamIds.map(function (id, index) { return '&steamids%5B' + index + '%5D=' + encoded(id); }).join('');
    }
    if (operation === 'steam.recentGames' || operation === 'steam.ownedGames') {
      if (!only(payload, ['token', 'steamId']) || !token(payload.token) || !steamId(payload.steamId)) rejectPayload();
      var endpoint = operation === 'steam.recentGames' ? 'GetRecentlyPlayedGames' : 'GetOwnedGames';
      var suffix = operation === 'steam.ownedGames' ? '&include_appinfo=1&include_played_free_games=1' : '';
      return base + 'IPlayerService/' + endpoint + '/v1/?access_token=' + encoded(payload.token) + '&steamid=' + encoded(payload.steamId) + suffix;
    }
    if (operation === 'steam.storeItems') {
      if (!only(payload, ['input']) || !payload.input || typeof payload.input !== 'object' || Array.isArray(payload.input)) rejectPayload();
      var input = JSON.stringify(payload.input);
      if (utf8Bytes(input) > 65536) rejectPayload();
      return base + 'IStoreBrowseService/GetItems/v1?input_json=' + encodeURIComponent(input);
    }
    if (operation === 'steam.appDetails') {
      if (!only(payload, ['appIds', 'language', 'country']) || !Array.isArray(payload.appIds) || payload.appIds.length < 1 || payload.appIds.length > 200 || payload.appIds.some(function (id) { return !/^[1-9][0-9]{0,9}$/.test(id); }) || !/^[a-z]{2,16}$/.test(payload.language) || !/^[a-z]{2}$/.test(payload.country)) rejectPayload();
      return 'https://store.steampowered.com/api/appdetails?appids=' + encodeURIComponent(payload.appIds.join(',')) + '&l=' + encoded(payload.language) + '&cc=' + encoded(payload.country);
    }
    if (operation === 'steam.wishlist') {
      if (!only(payload, ['kind', 'identifier']) || (payload.kind !== 'profiles' && payload.kind !== 'id') || typeof payload.identifier !== 'string') rejectPayload();
      if (payload.kind === 'profiles' ? !/^[0-9]{17,20}$/.test(payload.identifier) : !/^[A-Za-z0-9_-]{1,64}$/.test(payload.identifier)) rejectPayload();
      return 'https://store.steampowered.com/wishlist/' + payload.kind + '/' + encoded(payload.identifier) + '/';
    }
    if (operation === 'external.bundle') { if (!only(payload, [])) rejectPayload(); return 'https://bartervg.com/browse/bundles/json/'; }
    if (operation === 'external.dlc') { if (!only(payload, [])) rejectPayload(); return 'https://bartervg.com/browse/dlc/json/'; }
    if (operation === 'external.goty') {
      if (!only(payload, ['date']) || typeof payload.date !== 'string' || !/^[0-9]{8}$/.test(payload.date)) rejectPayload();
      return 'https://raw.githubusercontent.com/SmallRob/steam-namespace/refs/heads/main/data/' + payload.date + '.json';
    }
    if (operation === 'external.exchangeRates') { if (!only(payload, [])) rejectPayload(); return 'https://open.er-api.com/v6/latest/CNY'; }
    if (operation === 'external.augmentedRates') { if (!only(payload, [])) rejectPayload(); return 'https://api.augmentedsteam.com/rates/v1'; }
    throw new Error('FA_QX_PROXY_OPERATION_DENIED');
  }

  function statusText(code) {
    if (code >= 200 && code < 300) return 'OK';
    if (code === 400) return 'Bad Request';
    if (code === 403) return 'Forbidden';
    if (code === 404) return 'Not Found';
    if (code === 413) return 'Payload Too Large';
    if (code === 502) return 'Bad Gateway';
    return 'Error';
  }
  function done(code, value) {
    if (finished) return;
    finished = true;
    $done({ status: 'HTTP/1.1 ' + code + ' ' + statusText(code), headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(value) });
  }
  function publicCode(error) {
    var code = error && error.message;
    return typeof code === 'string' && /^FA_QX_[A-Z0-9_]+$/.test(code) ? code : 'FA_QX_PROXY_UPSTREAM_FAILED';
  }

  try {
    var request = typeof $request !== 'undefined' && $request ? $request : {};
    if (request.method !== 'POST') throw new Error('FA_QX_METHOD_DENIED');
    var route = typeof request.url === 'string' ? request.url.match(/^https:\/\/([^/?#]+)(\/[^?#]*)$/) : null;
    if (!route || route[1].toLowerCase() !== 'store.steampowered.com' || route[2] !== ROUTE) throw new Error('FA_QX_ROUTE_DENIED');
    var raw = typeof request.body === 'string' ? request.body : '';
    if (utf8Bytes(raw) > MAX_REQUEST_BYTES) throw new Error('FA_QX_BODY_TOO_LARGE');
    var input = JSON.parse(raw || '{}');
    if (!only(input, ['operation', 'payload', 'release', 'buildId'])) throw new Error('FA_QX_REQUEST_INVALID');
    if (input.release !== '0.2.4' || input.buildId !== '435720e3b4fc') throw new Error('FA_QX_VERSION_MISMATCH');
    if (ALLOWED.indexOf(input.operation) === -1) throw new Error('FA_QX_PROXY_OPERATION_DENIED');
    var url = upstream(input.operation, input.payload);
    $task.fetch({ url: url, method: 'GET', opts: { redirection: true, 'auto-cookie': false } }).then(function (response) {
      var body = response && typeof response.body === 'string' ? response.body : '';
      if (utf8Bytes(body) > MAX_RESPONSE_BYTES) throw new Error('FA_QX_PROXY_RESPONSE_TOO_LARGE');
      var status = response && Number(response.statusCode);
      if (!Number.isSafeInteger(status) || status < 100 || status > 599) status = 502;
      done(200, { ok: true, data: { status: status, statusText: statusText(status), responseText: body, responseURL: url.replace(/\?.*$/, '') } });
    }).catch(function (error) { done(502, { ok: false, error: publicCode(error) }); });
  } catch (error) {
    var code = publicCode(error);
    var status = /DENIED/.test(code) ? 403 : code === 'FA_QX_BODY_TOO_LARGE' ? 413 : 400;
    done(status, { ok: false, error: code });
  }
})();
