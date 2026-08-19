(function () {
  'use strict';
  window.__FA_QX_INSTALL_ADAPTER__ = function (bridge, runtime) {
    var values = Object.create(null);
    var database = null;
    var DB_NAME = 'kaaaaai-steam-family-qx';
    var STORE_NAME = 'gm';
    var publishQueue = Promise.resolve();
    var lastGeneration = 0;
    function clone(value) {
      if (value === undefined) return undefined;
      try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
    }
    function addStyle(css) {
      var style = document.createElement('style');
      style.textContent = String(css || '');
      (document.head || document.documentElement).appendChild(style);
      return style;
    }
    function hydrateLocal() {
      var indexedDb = window.indexedDB;
      if (!indexedDb || typeof indexedDb.open !== 'function') return Promise.resolve();
      return new Promise(function (resolve) {
        var request;
        try { request = indexedDb.open(DB_NAME, 1); } catch (_) { resolve(); return; }
        request.onupgradeneeded = function () {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
        };
        request.onerror = function () { resolve(); };
        request.onsuccess = function () {
          database = request.result;
          try {
            var cursor = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).openCursor();
            cursor.onerror = function () { resolve(); };
            cursor.onsuccess = function () {
              var item = cursor.result;
              if (!item) { resolve(); return; }
              values[item.key] = item.value;
              item.continue();
            };
          } catch (_) { resolve(); }
        };
      });
    }
    function compactSaves(value, sourceUpdatedAt) {
      if (!value || value.version !== 1 || !Array.isArray(value.members) || !Array.isArray(value.games) || value.members.length > 6 || value.games.length > 50000) throw new Error('FA_QX_INDEX_CORRUPT');
      var members = [];
      var names = {};
      for (var memberIndex = 0; memberIndex < value.members.length; memberIndex += 1) {
        var member = value.members[memberIndex];
        if (!Array.isArray(member) || member.length < 2 || typeof member[0] !== 'string' || !/^[0-9]{5,20}$/.test(member[0]) || typeof member[1] !== 'string') throw new Error('FA_QX_INDEX_CORRUPT');
        members.push({ steamid: member[0], userName: member[1] });
        names[member[0]] = member[1];
      }
      var list = [];
      var info = {};
      for (var gameIndex = 0; gameIndex < value.games.length; gameIndex += 1) {
        var game = value.games[gameIndex];
        if (!Array.isArray(game) || game.length < 3 || typeof game[0] !== 'string' || !/^[0-9]{1,10}$/.test(game[0]) || !Array.isArray(game[1]) || typeof game[2] !== 'number') throw new Error('FA_QX_INDEX_CORRUPT');
        var owners = game[1].map(function (index) { return members[index] && members[index].steamid; }).filter(Boolean);
        if (owners.length !== game[1].length) throw new Error('FA_QX_INDEX_CORRUPT');
        list.push(game[0]);
        info[game[0]] = { name: typeof game[3] === 'string' ? game[3] : '', owners: owners, time: game[2], icon_hash: '' };
      }
      var current = Number.isSafeInteger(value.current) && members[value.current] ? members[value.current].steamid : '';
      return {
        version: 20240501,
        familyGameList: { GameList: list, GameInfo: info },
        familyInfo: { family_groupid: null, family_name: null, family_member: members, steamIdtoName: names },
        familyWishlist: { GameList: [], GameInfo: {}, lastUpdated: 0 },
        lastupDateTime: sourceUpdatedAt || 0,
        steamid: current,
        settings: { isAutoScan: true, enableStoreMarking: true }
      };
    }
    function hydrateCompactIndex() {
      var host = window.location && String(window.location.hostname || window.location.host || '').toLowerCase();
      if (host !== 'keylol.com' && host !== 'steamdb.keylol.com') return Promise.resolve();
      return bridge('index.read', { part: 'manifest' }).then(function (manifest) {
        if (!manifest || !Number.isSafeInteger(manifest.generation) || !Number.isSafeInteger(manifest.chunks) || manifest.chunks < 1 || manifest.chunks > 32) return;
        var reads = [];
        for (var index = 0; index < manifest.chunks; index += 1) reads.push(bridge('index.read', { part: 'chunk', generation: manifest.generation, chunkIndex: index }));
        return Promise.all(reads).then(function (parts) {
          var raw = parts.map(function (part) { return part && part.chunk; }).join('');
          var imported = compactSaves(JSON.parse(raw), manifest.sourceUpdatedAt);
          values.saves = imported;
          persist('saves', imported, false);
        });
      }).catch(function () {});
    }
    function hydrate() { return hydrateLocal().then(hydrateCompactIndex); }
    function fnv1a(text) {
      var hash = 2166136261;
      for (var index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
      return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
    }
    function compactIndex(saves) {
      if (!saves || !saves.familyInfo || !saves.familyGameList || !Array.isArray(saves.familyGameList.GameList) || saves.familyGameList.GameList.length === 0) return null;
      var sourceMembers = Array.isArray(saves.familyInfo.family_member) ? saves.familyInfo.family_member : [];
      var nameMap = saves.familyInfo.steamIdtoName || {};
      var members = [];
      var memberIndexes = Object.create(null);
      sourceMembers.slice(0, 6).forEach(function (member) {
        var id = String(member.steamid || '');
        if (!/^[0-9]{5,20}$/.test(id) || Object.prototype.hasOwnProperty.call(memberIndexes, id)) return;
        memberIndexes[id] = members.length;
        members.push([id, String(member.userName || nameMap[id] || id)]);
      });
      var games = [];
      saves.familyGameList.GameList.forEach(function (appid) {
        var id = String(appid);
        var info = saves.familyGameList.GameInfo && saves.familyGameList.GameInfo[appid];
        if (!/^[0-9]{1,10}$/.test(id) || !info || !Array.isArray(info.owners)) return;
        var owners = info.owners.map(function (owner) { return memberIndexes[String(owner)]; }).filter(function (index) { return Number.isSafeInteger(index); });
        if (owners.length === 0) return;
        games.push([id, owners, Number.isSafeInteger(info.time) ? info.time : 0, typeof info.name === 'string' ? info.name : '']);
      });
      if (games.length === 0) return null;
      var current = Object.prototype.hasOwnProperty.call(memberIndexes, String(saves.steamid || '')) ? memberIndexes[String(saves.steamid)] : -1;
      return { version: 1, current: current, members: members, games: games };
    }
    function publishCompactIndex(saves) {
      var host = window.location && String(window.location.hostname || window.location.host || '').toLowerCase();
      if (host !== 'store.steampowered.com') return;
      var compact = compactIndex(saves);
      if (!compact) return;
      publishQueue = publishQueue.then(function () {
        var raw = JSON.stringify(compact);
        var chunks = [];
        for (var offset = 0; offset < raw.length; offset += 12000) chunks.push(raw.slice(offset, offset + 12000));
        if (chunks.length < 1 || chunks.length > 32) throw new Error('FA_QX_INDEX_TOO_LARGE');
        return bridge('index.read', { part: 'manifest' }).catch(function () { return null; }).then(function (installed) {
          var floor = installed && Number.isSafeInteger(installed.generation) ? installed.generation + 1 : 1;
          var generation = Math.max(Date.now(), lastGeneration + 1, floor);
          lastGeneration = generation;
          var manifest = { schema: 1, generation: generation, sourceUpdatedAt: Number.isSafeInteger(saves.lastupDateTime) ? saves.lastupDateTime : 0, chunks: chunks.length, checksum: fnv1a(raw) };
          var chain = Promise.resolve();
          chunks.forEach(function (chunk, chunkIndex) {
            chain = chain.then(function () { return bridge('index.publish', { phase: 'stage', manifest: manifest, chunkIndex: chunkIndex, chunk: chunk }); });
          });
          return chain.then(function () { return bridge('index.publish', { phase: 'commit', manifest: manifest }); });
        });
      }).catch(function () {});
    }
    function persist(key, value, remove) {
      if (!database || /(?:token|cookie|authorization|passphrase|p12)/i.test(String(key))) return;
      try {
        var store = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
        if (remove) store.delete(key); else store.put(clone(value), key);
      } catch (_) {}
    }
    function proxyOperation(target) {
      var host = target.hostname.toLowerCase();
      var pathname = target.pathname;
      var params = target.searchParams;
      if (host === 'api.steampowered.com') {
        var requestToken = params.get('access_token') || '';
        if (/\/IFamilyGroupsService\/GetFamilyGroupForUser\/v1\/?$/i.test(pathname)) return { operation: 'steam.familyGroup', payload: { token: requestToken } };
        if (/\/IFamilyGroupsService\/GetSharedLibraryApps\/v1\/?$/i.test(pathname)) return { operation: 'steam.sharedApps', payload: { token: requestToken, familyGroupId: params.get('family_groupid') || '' } };
        if (/\/IPlayerService\/GetPlayerLinkDetails\/v1\/?$/i.test(pathname)) {
          var steamIds = [];
          params.forEach(function (value, key) { if (/^steamids\[[0-9]+\]$/.test(key)) steamIds.push(value); });
          return { operation: 'steam.playerLinks', payload: { token: requestToken, steamIds: steamIds } };
        }
        if (/\/IPlayerService\/GetRecentlyPlayedGames\/v1\/?$/i.test(pathname)) return { operation: 'steam.recentGames', payload: { token: requestToken, steamId: params.get('steamid') || '' } };
        if (/\/IPlayerService\/GetOwnedGames\/v1\/?$/i.test(pathname)) return { operation: 'steam.ownedGames', payload: { token: requestToken, steamId: params.get('steamid') || '' } };
        if (/\/IStoreBrowseService\/GetItems\/v1\/?$/i.test(pathname)) {
          var parsedInput;
          try { parsedInput = JSON.parse(params.get('input_json') || '{}'); } catch (_) { throw new Error('FA_QX_PROXY_PAYLOAD_INVALID'); }
          return { operation: 'steam.storeItems', payload: { input: parsedInput } };
        }
      }
      if (host === 'store.steampowered.com' && pathname === '/api/appdetails') {
        var appIds = String(params.get('appids') || '').split(',').filter(Boolean);
        return { operation: 'steam.appDetails', payload: { appIds: appIds, language: String(params.get('l') || 'schinese').toLowerCase(), country: String(params.get('cc') || 'cn').toLowerCase() } };
      }
      var wishlist = host === 'store.steampowered.com' ? pathname.match(/^\/wishlist\/(profiles|id)\/([^/]+)\/?$/) : null;
      if (wishlist) return { operation: 'steam.wishlist', payload: { kind: wishlist[1], identifier: decodeURIComponent(wishlist[2]) } };
      if (host === 'bartervg.com' && pathname === '/browse/bundles/json/') return { operation: 'external.bundle', payload: {} };
      if (host === 'bartervg.com' && pathname === '/browse/dlc/json/') return { operation: 'external.dlc', payload: {} };
      var goty = host === 'raw.githubusercontent.com' ? pathname.match(/^\/SmallRob\/steam-namespace\/refs\/heads\/main\/data\/([0-9]{8})\.json$/) : null;
      if (goty) return { operation: 'external.goty', payload: { date: goty[1] } };
      if (host === 'open.er-api.com' && pathname === '/v6/latest/CNY') return { operation: 'external.exchangeRates', payload: {} };
      if (host === 'api.augmentedsteam.com' && pathname === '/rates/v1') return { operation: 'external.augmentedRates', payload: {} };
      throw new Error('FA_QX_PROXY_OPERATION_DENIED');
    }
    function invoke(details) {
      details = details || {};
      var stopped = false;
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var timeoutId = null;
      function callback(name, value) { if (!stopped && typeof details[name] === 'function') details[name](value); }
      var target;
      try { target = new URL(String(details.url || ''), window.location && window.location.href); }
      catch (error) { callback('onerror', error); return { abort: function () {} }; }
      var promise;
      if (window.location && target.origin === window.location.origin) {
        promise = fetch(target.href, { method: details.method || 'GET', headers: details.headers, body: details.data, credentials: 'include', signal: controller ? controller.signal : undefined })
          .then(function (response) { return response.text().then(function (text) { return { status: response.status, statusText: response.statusText, responseText: text, responseURL: response.url }; }); });
      } else {
        var mapped;
        try { mapped = proxyOperation(target); } catch (error) { callback('onerror', error); return { abort: function () {} }; }
        promise = fetch('__FA_ROUTE_PREFIX__/proxy', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: mapped.operation, payload: mapped.payload, release: runtime.release, buildId: runtime.buildId }),
          signal: controller ? controller.signal : undefined
        }).then(function (response) { return response.json(); }).then(function (result) {
          if (!result || result.ok !== true || !result.data) throw new Error(result && /^FA_QX_[A-Z0-9_]+$/.test(result.error) ? result.error : 'FA_QX_PROXY_INVALID');
          return result.data;
        });
      }
      if (details.timeout > 0) timeoutId = setTimeout(function () { if (controller) controller.abort(); callback('ontimeout'); }, details.timeout);
      promise.then(function (response) { if (timeoutId) clearTimeout(timeoutId); callback('onload', response); })
        .catch(function (error) { if (timeoutId) clearTimeout(timeoutId); if (!stopped && (!error || error.name !== 'AbortError')) callback('onerror', error); });
      return { abort: function () { stopped = true; if (timeoutId) clearTimeout(timeoutId); if (controller) controller.abort(); } };
    }
    var adapter = {
      hydrate: hydrate,
      get: function (key, fallback) { return Object.prototype.hasOwnProperty.call(values, key) ? clone(values[key]) : fallback; },
      set: function (key, value) { values[key] = clone(value); persist(key, value, false); if (key === 'saves') publishCompactIndex(value); return true; },
      remove: function (key) { delete values[key]; persist(key, null, true); return true; },
      request: invoke
    };
    window.unsafeWindow = window;
    window.GM_getValue = adapter.get;
    window.GM_setValue = adapter.set;
    window.GM_deleteValue = adapter.remove;
    window.GM_addStyle = addStyle;
    window.GM_registerMenuCommand = function () {};
    window.GM_xmlhttpRequest = adapter.request;
    window.GM = {
      getValue: function (key, fallback) { return Promise.resolve(adapter.get(key, fallback)); },
      setValue: function (key, value) { adapter.set(key, value); return Promise.resolve(); },
      deleteValue: function (key) { adapter.remove(key); return Promise.resolve(); },
      xmlHttpRequest: function (details) { return adapter.request(details); }
    };
    return adapter;
  };
})();
