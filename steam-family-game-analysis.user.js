// ==UserScript==
// @name         steam-family-game-analysis (Publishable)
// @namespace    http://tampermonkey.net/
// @version      2.03
// @description  扫描 Steam 家庭库库存，在游戏页面标记已有游戏，并提供家庭库数据分析。v2.03: 移除移动端浮动入口并优化贡献页面的 Mobile Safari 布局。
// @author       SmallRob
// @match        https://store.steampowered.com/*
// @match        https://keylol.com/*
// @match        https://steamdb.keylol.com/tooltip*
// @icon         data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%238b5cf6'/%3E%3Cstop offset='0.5' stop-color='%23ec4899'/%3E%3Cstop offset='1' stop-color='%23f59e0b'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='64' height='64' rx='14' fill='url(%23g)'/%3E%3Cg fill='%23fff'%3E%3Crect x='14' y='34' width='8' height='16' rx='2' opacity='.72'/%3E%3Crect x='25' y='27' width='8' height='23' rx='2' opacity='.85'/%3E%3Crect x='36' y='20' width='8' height='30' rx='2' opacity='.97'/%3E%3Crect x='47' y='30' width='8' height='20' rx='2' opacity='.80'/%3E%3C/g%3E%3Ccircle cx='18' cy='29' r='4.5' fill='%23fff' opacity='.92'/%3E%3Ccircle cx='29' cy='22' r='4.5' fill='%23fff' opacity='.92'/%3E%3Ccircle cx='40' cy='15' r='4.5' fill='%23fff' opacity='.92'/%3E%3Ccircle cx='51' cy='25' r='4.5' fill='%23fff' opacity='.92'/%3E%3Cpath d='M14 54 L50 54' stroke='%23fff' stroke-width='2.5' stroke-linecap='round' opacity='.6'/%3E%3C/svg%3E
// @require      https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.js
// @require      https://update.greasyfork.org/scripts/590086/1895071/SGLV%20%E6%8B%BC%E9%9F%B3%E5%AD%97%E5%BA%93%20%28Library%29.js
// @require      https://update.greasyfork.org/scripts/590084/1894626/SGLV%20App%20Detail%20Library.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @connect      store.steampowered.com
// @connect      api.steampowered.com
// @connect      bartervg.com
// @connect      raw.githubusercontent.com
// @connect      api.augmentedsteam.com
// @connect      open.er-api.com
// @run-at       document-end
// @noframes
// @compatible   chrome
// @compatible   edge
// @compatible   firefox
// @compatible   safari
// @license      GPLv3
// @downloadURL  https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/steam-family-game-analysis.user.js
// @updateURL    https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/steam-family-game-analysis.user.js
// ==/UserScript==

// <FA_COMPAT>
var faCompat = (function () {
    var pageWindow = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
    function parseAttr(name) {
        try {
            var el = document.getElementById('application_config');
            var value = el ? JSON.parse(el.getAttribute(name) || '{}') : {};
            return value && typeof value === 'object' ? value : {};
        } catch (e) { return {}; }
    }
    function accountId() {
        var user = parseAttr('data-userinfo');
        return Number(pageWindow.g_AccountID || user.accountid || 0);
    }
    function serverTime() {
        return Number(pageWindow.g_ServerTime || Math.floor(Date.now() / 1000));
    }
    function getSession() {
        var store = parseAttr('data-store_user_config');
        var user = parseAttr('data-userinfo');
        return {
            accountId: accountId(),
            steamId: String(user.steamid || ''),
            accessToken: String(store.webapi_token || ''),
            serverTime: serverTime()
        };
    }
    function storeCountryCode() {
        return String(parseAttr('data-store_user_config').country_code || '').toLowerCase();
    }
    function resolveGlobal(name) {
        if (pageWindow && pageWindow[name] != null) return pageWindow[name];
        if (window && window[name] != null) return window[name];
        return undefined;
    }
    function callNativeDialog(name, args) {
        var fn = resolveGlobal(name);
        return typeof fn === 'function' ? fn.apply(pageWindow, args) : null;
    }
    function ensureDialogStyle() {
        if (!document || document.getElementById('fa-compat-dialog-style')) return;
        var style = document.createElement('style');
        style.id = 'fa-compat-dialog-style';
        style.textContent = '.fa-compat-dialog-overlay{position:fixed;inset:0;z-index:1000005;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:rgba(0,0,0,.68);box-sizing:border-box}'
            + '.fa-compat-dialog{width:min(440px,100%);max-height:80vh;max-height:80dvh;overflow:auto;background:#1b2838;color:#c7d5e0;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:18px;box-sizing:border-box;box-shadow:0 16px 48px rgba(0,0,0,.6);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}'
            + '.fa-compat-dialog-title{font-size:17px;font-weight:700;color:#fff;margin-bottom:12px}'
            + '.fa-compat-dialog-body{font-size:14px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}'
            + '.fa-compat-dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;flex-wrap:wrap}'
            + '.fa-compat-dialog button{min-height:44px;min-width:88px;border:0;border-radius:8px;padding:8px 14px;font-size:14px;color:#fff;background:#3b536b}'
            + '.fa-compat-dialog button[data-primary="1"]{background:#3a7f2e}';
        (document.head || document.documentElement).appendChild(style);
    }
    function removeFallbackDialog() {
        var old = document && document.getElementById ? document.getElementById('fa-compat-dialog-overlay') : null;
        if (old && old.remove) old.remove();
    }
    function fallbackDialog(title, bodyHtml, options) {
        options = options || {};
        ensureDialogStyle();
        removeFallbackDialog();
        var overlay = document.createElement('div');
        overlay.id = 'fa-compat-dialog-overlay';
        overlay.className = 'fa-compat-dialog-overlay';
        var box = document.createElement('div');
        box.className = 'fa-compat-dialog';
        var titleEl = document.createElement('div');
        titleEl.className = 'fa-compat-dialog-title';
        titleEl.textContent = String(title || '提示');
        var bodyEl = document.createElement('div');
        bodyEl.className = 'fa-compat-dialog-body';
        bodyEl.innerHTML = String(bodyHtml || '');
        var actions = document.createElement('div');
        actions.className = 'fa-compat-dialog-actions';
        var doneCallbacks = [], failCallbacks = [];
        var handle = {
            done: function (fn) { if (typeof fn === 'function') doneCallbacks.push(fn); return handle; },
            fail: function (fn) { if (typeof fn === 'function') failCallbacks.push(fn); return handle; },
            Dismiss: function () { if (overlay && overlay.remove) overlay.remove(); return handle; },
            update: function (message) { bodyEl.textContent = String(message || ''); return handle; }
        };
        function addButton(label, primary, callbacks) {
            var button = document.createElement('button');
            button.textContent = label;
            if (primary) button.setAttribute('data-primary', '1');
            button.addEventListener('click', function () {
                callbacks.slice().forEach(function (fn) { try { fn(); } catch (e) { console.error('[FA] dialog callback failed:', e); } });
                handle.Dismiss();
            });
            actions.appendChild(button);
        }
        box.appendChild(titleEl);
        box.appendChild(bodyEl);
        if (!options.wait) {
            if (options.cancelText) addButton(options.cancelText, false, failCallbacks);
            addButton(options.okText || '好的', true, doneCallbacks);
            box.appendChild(actions);
        }
        overlay.appendChild(box);
        (document.body || document.documentElement).appendChild(overlay);
        return handle;
    }
    function alertDialog(title, bodyHtml, okText) {
        return callNativeDialog('ShowAlertDialog', [title, bodyHtml, okText])
            || fallbackDialog(title, bodyHtml, { okText: okText || '好的' });
    }
    function confirmDialog(title, bodyHtml, okText, cancelText) {
        return callNativeDialog('ShowConfirmDialog', [title, bodyHtml, okText, cancelText])
            || fallbackDialog(title, bodyHtml, { okText: okText || '好的', cancelText: cancelText || '取消' });
    }
    function waitDialog(message) {
        return callNativeDialog('ShowBlockingWaitDialog', [message])
            || fallbackDialog('请稍候', message, { wait: true });
    }
    function legacyRequestApi() {
        return typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null;
    }
    function modernRequestApi() {
        return (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function')
            ? GM.xmlHttpRequest.bind(GM) : null;
    }
    function hasPrivilegedRequest() { return !!(legacyRequestApi() || modernRequestApi()); }
    function redactUrl(value) {
        try {
            var parsed = new URL(String(value));
            return parsed.origin + parsed.pathname;
        } catch (e) { return '[invalid-url]'; }
    }
    function permissionError() {
        var err = new Error('Stay 未提供跨域请求权限，请允许 Stay 访问 Steam 商店与 Steam API。');
        err.code = 'PERMISSION';
        return err;
    }
    function sameOriginFetch(details) {
        var currentHref = window && window.location ? window.location.href : '';
        var currentOrigin = window && window.location ? window.location.origin : '';
        var target;
        try { target = new URL(details.url, currentHref || undefined); } catch (e) { throw permissionError(); }
        if (!currentOrigin || target.origin !== currentOrigin || typeof fetch !== 'function') throw permissionError();
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var timeoutId = null;
        if (controller && details.timeout) {
            timeoutId = setTimeout(function () {
                controller.abort();
                if (typeof details.ontimeout === 'function') details.ontimeout();
            }, details.timeout);
        }
        fetch(target.href, {
            method: details.method || 'GET',
            headers: details.headers,
            body: details.data,
            credentials: 'include',
            signal: controller ? controller.signal : undefined
        }).then(function (response) {
            return response.text().then(function (responseText) {
                if (timeoutId) clearTimeout(timeoutId);
                if (typeof details.onload === 'function') details.onload({
                    status: response.status,
                    statusText: response.statusText,
                    responseText: responseText,
                    responseURL: response.url
                });
            });
        }).catch(function (error) {
            if (timeoutId) clearTimeout(timeoutId);
            if (error && error.name === 'AbortError') return;
            if (typeof details.onerror === 'function') details.onerror(error);
        });
        return { abort: function () { if (controller) controller.abort(); } };
    }
    function gmRequest(details) {
        var request = legacyRequestApi() || modernRequestApi();
        if (request) return request(details);
        return sameOriginFetch(details);
    }
    function optionalRequest(details) {
        try {
            return gmRequest(details);
        } catch (error) {
            if (details && typeof details.onerror === 'function') details.onerror(error);
            return null;
        }
    }
    function safeGmGet(key, fallback) {
        try {
            if (typeof GM_getValue === 'function') {
                var value = GM_getValue(key);
                return value === undefined ? fallback : value;
            }
            if (typeof GM !== 'undefined' && GM && typeof GM.getValue === 'function') {
                var modernValue = GM.getValue(key, fallback);
                return modernValue && typeof modernValue.then === 'function' ? fallback : modernValue;
            }
        } catch (e) {}
        return fallback;
    }
    function safeGmSet(key, value) {
        try {
            if (typeof GM_setValue === 'function') { GM_setValue(key, value); return true; }
            if (typeof GM !== 'undefined' && GM && typeof GM.setValue === 'function') {
                var result = GM.setValue(key, value);
                if (result && typeof result.catch === 'function') result.catch(function () {});
                return true;
            }
        } catch (e) {}
        return false;
    }
    function safeGmDelete(key) {
        try {
            if (typeof GM_deleteValue === 'function') { GM_deleteValue(key); return true; }
            if (typeof GM !== 'undefined' && GM && typeof GM.deleteValue === 'function') {
                var result = GM.deleteValue(key);
                if (result && typeof result.catch === 'function') result.catch(function () {});
                return true;
            }
        } catch (e) {}
        return false;
    }
    function storageStatus() {
        var gmAvailable = typeof GM_getValue === 'function'
            || (typeof GM !== 'undefined' && GM && typeof GM.getValue === 'function');
        var idbAvailable = !!((window && window.indexedDB) || (pageWindow && pageWindow.indexedDB));
        return { gm: gmAvailable, indexedDB: idbAvailable, durable: gmAvailable || idbAvailable };
    }
    function isLoggedIn() { var s = getSession(); return s.accountId > 0 && !!s.accessToken; }
    return { pageWindow: pageWindow, getSession: getSession, accountId: accountId,
        serverTime: serverTime, storeCountryCode: storeCountryCode, resolveGlobal: resolveGlobal,
        isLoggedIn: isLoggedIn, alert: alertDialog, confirm: confirmDialog, wait: waitDialog,
        gmRequest: gmRequest, optionalRequest: optionalRequest,
        hasPrivilegedRequest: hasPrivilegedRequest, redactUrl: redactUrl,
        safeGmGet: safeGmGet, safeGmSet: safeGmSet, safeGmDelete: safeGmDelete,
        storageStatus: storageStatus };
})();
// </FA_COMPAT>

var dialog,appid,observer
var isNewUser = false
var isupdate = false
var saves
const MAX_FAMILY = 6; // Steam 家庭组最多支持6人

// ==================== v1.81: 基础设施 —— faIDB / faPCC / faComputedCache ====================
// 解决问题:
//   1) saves/faGameNameCache/faCooldownRegistry 大对象之前用 GM_setValue 同步写,有 5MB 上限 + 主线程卡顿
//   2) computeAllHeatmaps / computeMemberActivity 等大数据计算每次切 tab 都重算
//   3) 切 tab 体验差,需要"立即显示缓存 + 后台异步 patch"
// 提供:
//   - faIDB: IDB KV 存储(容量无 5MB 限制,内存镜像 + 异步落盘)
//   - faPCC: PersistentComputeCache 持久化计算缓存(输入签名 + schema 版本,跨 session 复用)
//   - faComputedCache: 通用会话内计算缓存(快速路径,同步读写)
//   - faBizCached: 业务级持久化包装(签名+schema+IDB 落盘,跨 session)
//   - faRenderedTabs: tab 渲染结果缓存(切 tab 渐进式更新,立即显示旧 DOM)
var faIDB = (function () {
    var DB_NAME = 'sffa_kv', STORE = 'kv', VERSION = 1;
    var _db = null;
    var _mem = {};
    var _loaded = false;
    var _writing = new Set();
    function open() {
        return new Promise(function (resolve, reject) {
            var idb = (typeof window !== 'undefined' ? window.indexedDB : null) || (typeof unsafeWindow !== 'undefined' ? unsafeWindow.indexedDB : null);
            if (!idb) { reject(new Error('indexedDB unavailable')); return; }
            var req = idb.open(DB_NAME, VERSION);
            req.onerror = function () { reject(req.error); };
            req.onsuccess = function () { _db = req.result; resolve(_db); };
            req.onupgradeneeded = function (e) {
                if (!e.target.result.objectStoreNames.contains(STORE)) {
                    e.target.result.createObjectStore(STORE);
                }
            };
        });
    }
    function loadAll() {
        if (_loaded) return Promise.resolve(_mem);
        return open().then(function () { return new Promise(function (resolve) {
            var tx = _db.transaction(STORE, 'readonly');
            var req = tx.objectStore(STORE).openCursor();
            req.onsuccess = function () {
                var c = req.result;
                if (c) { _mem[c.key] = c.value; c.continue(); }
                else { _loaded = true; resolve(_mem); }
            };
            req.onerror = function () { _loaded = true; resolve(_mem); };
        }); });
    }
    function get(key, fallback) {
        return _mem[key] !== undefined ? _mem[key] : fallback;
    }
    function set(key, val) {
        _mem[key] = val;
        if (!_db) return;
        if (_writing.has(key)) return;
        _writing.add(key);
        try {
            var tx = _db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(val, key);
            tx.oncomplete = function () { _writing.delete(key); };
            tx.onerror = function () { _writing.delete(key); };
        } catch (e) { _writing.delete(key); }
    }
    function remove(key) {
        delete _mem[key];
        if (!_db) return;
        try {
            var tx = _db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(key);
        } catch (e) {}
    }
    function has(key) { return _mem[key] !== undefined; }
    function keys() { return Object.keys(_mem); }
    return { loadAll: loadAll, get: get, set: set, remove: remove, has: has, keys: keys };
})();

// v1.81: faPCC - PersistentComputeCache 持久化计算缓存
//   key: 业务 key,如 'fa_value_insights_kpi'
//   schemaVer: schema 版本号,升级时强制全量重算
//   inputSig: 输入签名(库存指纹 + 价格数据时间戳等)
//   computeFn: 同步重算函数
//   命中(内存+签名+schema 匹配): 立即返回
//   未命中: 同步重算 + 100ms 防抖落 IDB
var faPCC = (function () {
    var STORE_KEY_PREFIX = 'fpcc_';
    var _mem = {};
    var _writeTimers = {};
    function _strip(key) { return key.indexOf(STORE_KEY_PREFIX) === 0 ? key.slice(STORE_KEY_PREFIX.length) : key; }
    function getSyncWithMeta(key) {
        var entry = _mem[key];
        if (!entry) return null;
        return { value: entry.value, _sig: entry._sig, _ver: entry._ver, _ts: entry._ts };
    }
    function getSync(key) {
        var entry = _mem[key];
        if (!entry) return null;
        return entry.value;
    }
    function set(key, schemaVer, inputSig, value) {
        _mem[key] = { _sig: inputSig, _ver: schemaVer, value: value, _ts: Date.now() };
        if (_writeTimers[key]) clearTimeout(_writeTimers[key]);
        _writeTimers[key] = setTimeout(function () {
            delete _writeTimers[key];
            faIDB.set(STORE_KEY_PREFIX + key, { _sig: inputSig, _ver: schemaVer, value: value, _ts: _mem[key]._ts });
        }, 100);
    }
    function getOrComputeSync(key, schemaVer, inputSig, computeFn) {
        var meta = getSyncWithMeta(key);
        if (meta && meta._ver === schemaVer && meta._sig === inputSig) return meta.value;
        // 尝试 IDB 兜底
        var persisted = faIDB.get(STORE_KEY_PREFIX + key, null);
        if (persisted && persisted._ver === schemaVer && persisted._sig === inputSig) {
            _mem[key] = { _sig: inputSig, _ver: schemaVer, value: persisted.value, _ts: persisted._ts || Date.now() };
            return persisted.value;
        }
        var v = computeFn();
        set(key, schemaVer, inputSig, v);
        return v;
    }
    function invalidate(key) {
        delete _mem[key];
        faIDB.remove(STORE_KEY_PREFIX + key);
    }
    function clear() {
        for (var k in _mem) faIDB.remove(STORE_KEY_PREFIX + k);
        _mem = {};
    }
    // 启动时从 IDB hydrate 全部 pcc 到内存
    function hydrate() {
        try {
            var ks = faIDB.keys();
            var count = 0;
            for (var i = 0; i < ks.length; i++) {
                var k = ks[i];
                if (typeof k === 'string' && k.indexOf(STORE_KEY_PREFIX) === 0) {
                    var v = faIDB.get(k, null);
                    if (v && v._sig != null && v._ver != null && v.value !== undefined) {
                        _mem[_strip(k)] = { _sig: v._sig, _ver: v._ver, value: v.value, _ts: v._ts || Date.now() };
                        count++;
                    }
                }
            }
            return count;
        } catch (e) { return 0; }
    }
    return { getSync: getSync, getSyncWithMeta: getSyncWithMeta, set: set, getOrComputeSync: getOrComputeSync, invalidate: invalidate, clear: clear, hydrate: hydrate, _mem: _mem };
})();

// v1.81: faComputedCache - 通用会话内计算缓存(快速路径,同步读写)
//   用于"同 session 内同一签名复用"的场景,不跨 session(比 faPCC 轻)
//   cacheKey: 业务 key
//   computeFn: 同步重算
var faComputedCache = (function () {
    var _cache = {};
    return {
        getOrCompute: function (key, computeFn) {
            if (_cache.hasOwnProperty(key)) return _cache[key];
            var v = computeFn();
            _cache[key] = v;
            return v;
        },
        has: function (key) { return _cache.hasOwnProperty(key); },
        get: function (key) { return _cache[key]; },
        set: function (key, v) { _cache[key] = v; },
        invalidate: function (key) { delete _cache[key]; },
        clear: function () { _cache = {}; }
    };
})();

// v1.81: faBizCached - 业务级持久化包装(签名+schema+IDB 落盘,跨 session 复用)
//   与 faComputedCache 区别:本函数 IDB 落盘,跨 session 命中
//   与 faPCC.getOrComputeSync 区别:本函数提供详细注释 + 缺省 schemaVer 默认 1
function faBizCached(key, schemaVer, inputSig, computeFn) {
    if (typeof schemaVer !== 'number') schemaVer = 1;
    return faPCC.getOrComputeSync(key, schemaVer, inputSig, computeFn);
}

// v1.81: faRenderedTabs - tab 渲染结果缓存(切 tab 渐进式更新,立即显示旧 DOM)
//   旧:每次切 tab 都重跑 render 函数,重计算 + 重 DOM 构造
//   新:首次切 tab 时正常渲染 + 缓存 HTML 字符串;二次切 tab 时直接恢复 HTML,后台异步 patch 新数据
var faRenderedTabs = (function () {
    var _tabHtml = {};   // { [tabId]: { html: string, signature: string, ts: number } }
    return {
        save: function (tabId, html, signature) {
            _tabHtml[tabId] = { html: html, signature: signature, ts: Date.now() };
        },
        get: function (tabId) { return _tabHtml[tabId]; },
        has: function (tabId) { return _tabHtml.hasOwnProperty(tabId); },
        clear: function (tabId) { if (tabId) delete _tabHtml[tabId]; else _tabHtml = {}; }
    };
})();

readstorage()
var faStorageCapabilities = faCompat.storageStatus();
if (!faStorageCapabilities.durable && window.location.host == 'store.steampowered.com') {
    setTimeout(function () {
        faCompat.alert('存储受限', 'Safari 当前未提供可持久化存储。脚本本页仍可使用，但关闭 Safari 后扫描结果可能丢失；请退出私密浏览后重试。', '知道了');
    }, 0);
}
var faInterruptedScan = faCompat.safeGmGet('fa_scan_checkpoint_v1', null);
if (faInterruptedScan && faInterruptedScan.stage) {
    console.warn('[FA] 检测到上次扫描在阶段 ' + faInterruptedScan.stage + ' 中断；旧库存已保留，可手动重新扫描。');
}
//console.log(saves)
const url = window.location.host + window.location.pathname;
var access_token,steamid
var faSession = faCompat.getSession();
if(window.location.host == "store.steampowered.com" && faSession.accountId != 0){
    access_token = faSession.accessToken
    steamid = faSession.steamId
    if(saves.steamid ==""){
        saves.steamid = steamid
    }
    if(saves.steamid != steamid){
        console.log(saves.noPrompt)
        if (saves.noPrompt == null || saves.noPrompt == false){
            faCompat.confirm('脚本提示','当前页面登录的账号与缓存账号不对应，脚本可能会出现一些未知的错误，是否需要重新扫描？','扫描家庭库','取消').done(()=>{scan(true)}).fail(()=>{
                faCompat.alert('脚本提示','如果需要手动扫描，可以在Steam主页右上角进入进行扫描','好的')
                saves.noPrompt = true
                savestorage()
            })
        }
    }
}

// v1.90: 注入 ds_flag 系列标记的 CSS 样式 — 新版 Steam React 布局(愿望单/搜索等)不再提供
// 原生 ds_flag CSS 类(position:absolute 等),导致脚本创建的标记 div 因缺少定位样式而被
// 父容器 overflow:hidden 裁剪,不可见。此处在 Steam 商店页面全局注入样式,兼容新旧布局。
if (window.location.host == "store.steampowered.com") {
    var faFlagCss = ''
        // v1.93: z-index 从 5 提升至 20,确保标记层级高于 Steam 新版 React 布局中的
        //   覆盖元素(折扣徽章/平台图标/渐变遮罩等),避免家庭共享标记被盖住不可见
        + '.ds_flag{position:absolute!important;right:0!important;top:0!important;z-index:20!important;'
        + 'padding:2px 6px!important;font-size:11px!important;line-height:16px!important;'
        + 'border-radius:0 0 0 3px!important;white-space:nowrap!important;text-align:right!important;'
        + 'pointer-events:auto!important;display:block!important;}'
        + '.ds_flagged{position:relative!important;}'
        // v1.92: 横版条目(捆绑包/搜索结果/愿望单/标签页)紧凑家庭共享徽章
        //   覆盖 .ds_flag 的 right:0 + 原生 width:100%,改为左上角固定尺寸图标
        // v1.93: 显式设置 z-index:20,避免在部分布局中被 capsule 图片容器遮挡
        + '.fa-fs-compact{left:0!important;right:auto!important;width:20px!important;height:20px!important;'
        + 'padding:0!important;font-size:0!important;line-height:0!important;'
        + 'border-radius:0 0 3px 0!important;text-align:center!important;z-index:20!important;}'
        // v1.96: 修复搜索页(热销榜/热门推荐等)家庭共享紫色标记不可见问题
        //   根因: Steam 原生 CSS(shared_global.css)中 .ds_collapse_flag.ds_flagged .ds_flag
        //   设置了 max-width:0;overflow:hidden;,使标记默认折叠不可见,仅 hover 时展开(max-width:120px)。
        //   搜索结果行(a.search_result_row.ds_collapse_flag)被脚本添加 ds_flagged 类后,
        //   家庭共享标记被 max-width:0 裁剪为 0 宽度 → 紫色标记完全不可见。
        //   注意: max-width 优先级高于 width(即使 width 带 !important),因为它们是不同属性,
        //   CSS 盒模型约束 max-width >= width 在级联之后应用,故必须显式覆盖 max-width。
        //   仅针对 .ds_family_share_flag 覆盖,不影响 Steam 原生 owned/wishlist 标记的折叠交互。
        + '.ds_family_share_flag{max-width:none!important;overflow:visible!important;transition:none!important;}'
    if (typeof GM_addStyle === 'function') {
        GM_addStyle(faFlagCss);
    } else {
        var faFlagStyleEl = document.createElement('style');
        faFlagStyleEl.textContent = faFlagCss;
        (document.head || document.documentElement).appendChild(faFlagStyleEl);
    }
}

// ==================== v1.70: Barter.vg Bundle 数据获取与缓存模块 ====================
// 数据源：https://bartervg.com/browse/bundles/json/
// 返回格式：{"18500":{"bundles":5,"bundles_packages":3},"232810":{"bundles":1},...}（Key 是 appID 字符串）
var faBundleData = null;
var faBundleLoading = false;
const FA_BUNDLE_CACHE_KEY = 'fa_bundle_cache';
const FA_BUNDLE_CACHE_TTL = 48 * 60 * 60 * 1000; // 48h，与 SWI 一致

// 返回该游戏进过的包数量（0 表示未进包）
function getBundleCount(appId) {
    if (!faBundleData || !appId) return 0;
    var entry = faBundleData[String(appId)];
    return entry ? (entry.bundles || 0) : 0;
}

function faLoadBundleData() {
    if (faBundleData || faBundleLoading) return;
    faBundleLoading = true;
    // v1.81: 优先 IDB(快速),GM 兜底
    var cached = faIDB.get(FA_BUNDLE_CACHE_KEY, null);
    var cachedTime = faIDB.get(FA_BUNDLE_CACHE_KEY + '_time', 0);
    if (!cached) {
        try {
            cached = GM_getValue(FA_BUNDLE_CACHE_KEY, null);
            cachedTime = GM_getValue(FA_BUNDLE_CACHE_KEY + '_time', 0);
        } catch (e) {}
    }
    if (cached && (Date.now() - cachedTime < FA_BUNDLE_CACHE_TTL)) {
        faBundleData = cached;
        faBundleLoading = false;
        console.log('[FA] Bundle 缓存命中: ' + Object.keys(cached).length + ' 条记录');
        return;
    }
    faCompat.optionalRequest({
        method: 'GET',
        url: 'https://bartervg.com/browse/bundles/json/',
        timeout: 30000,
        onload: function(r) {
            try {
                var json = JSON.parse(r.responseText);
                if (Object.keys(json).length < 7000) {
                    console.warn('[FA] Barter.vg bundles 数据 sanity check 失败（记录数: ' + Object.keys(json).length + '）');
                    return;
                }
                faBundleData = json;
                // v1.81: IDB 优先,GM 兜底
                try { faIDB.set(FA_BUNDLE_CACHE_KEY, json); faIDB.set(FA_BUNDLE_CACHE_KEY + '_time', Date.now()); } catch (e) {}
                try { GM_setValue(FA_BUNDLE_CACHE_KEY, json); GM_setValue(FA_BUNDLE_CACHE_KEY + '_time', Date.now()); } catch (e) {}
                console.log('[FA] Bundle 数据加载完成: ' + Object.keys(json).length + ' 条记录');
            } catch(e) {
                console.warn('[FA] Bundle 数据解析失败:', e);
            } finally {
                faBundleLoading = false;
            }
        },
        onerror: function() {
            console.warn('[FA] Bundle 数据获取失败（网络错误）');
            faBundleLoading = false;
        },
        ontimeout: function() {
            console.warn('[FA] Bundle 数据获取超时');
            faBundleLoading = false;
        }
    });
}

// ==================== v1.76: 年度大作(GOTY) 数据获取与缓存模块 ====================
// 参考 sglv-game-collection.lib.js 的年度大作标签页实现
// 数据源：https://raw.githubusercontent.com/SmallRob/steam-namespace/refs/heads/main/data/YYYYMMDD.json
// JSON 格式：[{ name: "游戏名", date: "2026年01月30日", appid: 2362060 }, ...]
// URL 含日期，每日可能更新；按当天日期回退最多 30 天查找最新可用文件
var faGotyData = null;           // [{ appid, name, date }, ...]
var faGotyLoading = false;
var faGotyAppIdSet = null;       // Set<number>，快速查找
const FA_GOTY_CACHE_KEY = 'fa_goty_cache';
const FA_GOTY_CACHE_TTL = 12 * 60 * 60 * 1000; // 12h
const FA_GOTY_DATA_BASE = 'https://raw.githubusercontent.com/SmallRob/steam-namespace/refs/heads/main/data/';

// 日期 → "YYYYMMDD" 字符串
function _faGotyDateKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + m + day;
}
function _faGotyUrlForDate(d) { return FA_GOTY_DATA_BASE + _faGotyDateKey(d) + '.json'; }

// 同步从缓存加载 GOTY 数据（GM_getValue 同步读取），构建 appId Set
// v1.81: 优先 IDB 读,GM 兜底 + 自动迁移
function _faGotyCacheRead() {
    var cached = faIDB.get(FA_GOTY_CACHE_KEY, null);
    if (!cached) {
        try { cached = GM_getValue(FA_GOTY_CACHE_KEY, null); } catch (e) {}
        if (cached) { try { faIDB.set(FA_GOTY_CACHE_KEY, cached); } catch (e) {} }
    }
    return cached;
}
function _faGotyCacheWrite(obj) {
    try { faIDB.set(FA_GOTY_CACHE_KEY, obj); } catch (e) {}
    try { GM_setValue(FA_GOTY_CACHE_KEY, obj); } catch (e) {}
}
function faLoadGotyFromCacheSync() {
    if (faGotyData) return;
    try {
        var cached = _faGotyCacheRead();
        if (cached && cached.timestamp && (Date.now() - cached.timestamp < FA_GOTY_CACHE_TTL) && Array.isArray(cached.data)) {
            faGotyData = cached.data;
            faGotyAppIdSet = new Set(faGotyData.map(function(g) { return g.appid; }));
            console.log('[FA] GOTY 缓存命中(sync): ' + faGotyData.length + ' 条记录');
        }
    } catch(e) { console.warn('[FA] GOTY 缓存读取失败:', e); }
}

// 异步加载 GOTY 数据（带缓存 + 30 天日期回退）
function faLoadGotyData(force) {
    if (faGotyData && !force) return Promise.resolve(faGotyData);
    if (faGotyLoading) return Promise.resolve(null);
    faGotyLoading = true;
    // 先读缓存
    if (!force) {
        try {
            var cached = _faGotyCacheRead();
            if (cached && cached.timestamp && (Date.now() - cached.timestamp < FA_GOTY_CACHE_TTL) && Array.isArray(cached.data)) {
                faGotyData = cached.data;
                faGotyAppIdSet = new Set(faGotyData.map(function(g) { return g.appid; }));
                faGotyLoading = false;
                console.log('[FA] GOTY 缓存命中: ' + faGotyData.length + ' 条记录');
                // 后台静默刷新
                _faRefreshGotyFromRemote(false);
                return Promise.resolve(faGotyData);
            }
        } catch(e) { console.warn('[FA] GOTY 缓存读取失败:', e); }
    }
    return _faRefreshGotyFromRemote(true).then(function() {
        faGotyLoading = false;
        return faGotyData;
    }).catch(function() {
        faGotyLoading = false;
        return null;
    });
}

// 远程获取：按当天日期回退最多 30 天，找到第一个有效文件
function _faRefreshGotyFromRemote(showLoading) {
    return new Promise(function(resolve) {
        if (!faCompat.hasPrivilegedRequest()) { resolve(null); return; }
        var tryDates = [];
        var today = new Date();
        for (var i = 0; i < 30; i++) {
            var d = new Date(today);
            d.setDate(d.getDate() - i);
            tryDates.push(d);
        }
        var attemptIdx = 0;
        function tryNext() {
            if (attemptIdx >= tryDates.length) {
                if (showLoading) console.warn('[FA] GOTY 数据获取失败：30 天内无可用文件');
                resolve(null);
                return;
            }
            var url = _faGotyUrlForDate(tryDates[attemptIdx]);
            attemptIdx++;
            faCompat.optionalRequest({
                method: 'GET',
                url: url,
                timeout: 15000,
                onload: function(r) {
                    try {
                        if (r.status === 404 || !r.responseText) { tryNext(); return; }
                        var data = JSON.parse(r.responseText);
                        if (!Array.isArray(data) || data.length === 0) { tryNext(); return; }
                        var games = data
                            .filter(function(g) { return g && g.appid && Number(g.appid) > 0; })
                            .map(function(g) { return { appid: Number(g.appid), name: g.name || ('App ' + g.appid), date: g.date || '' }; });
                        if (games.length === 0) { tryNext(); return; }
                        faGotyData = games;
                        faGotyAppIdSet = new Set(games.map(function(g) { return g.appid; }));
                        try {
                            _faGotyCacheWrite({ data: games, timestamp: Date.now() });
                        } catch(e) { /* 忽略 */ }
                        console.log('[FA] GOTY 数据加载完成: ' + games.length + ' 条记录');
                        resolve(faGotyData);
                    } catch(e) { tryNext(); }
                },
                onerror: function() { tryNext(); },
                ontimeout: function() { tryNext(); }
            });
        }
        tryNext();
    });
}

// 判断某 appid 是否为年度大作
function faIsGoty(appId) {
    if (!appId || !faGotyAppIdSet) return false;
    return faGotyAppIdSet.has(Number(appId));
}

// 获取 GOTY 游戏的发售日期字符串（如 "01/30"），无则返回空
function faGotyDateShort(appId) {
    if (!faGotyData || !appId) return '';
    for (var i = 0; i < faGotyData.length; i++) {
        if (faGotyData[i].appid === Number(appId)) {
            var dateStr = faGotyData[i].date;
            if (!dateStr) return '';
            var m = String(dateStr).match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
            if (!m) return '';
            return m[2].padStart(2, '0') + '/' + m[3].padStart(2, '0');
        }
    }
    return '';
}

// ==================== v1.75: DLC 识别模块（双源检测，参考 steam-game-library-viewer v2.9.6） ====================
// 数据源1: Barter.vg DLC 数据库 https://bartervg.com/browse/dlc/json/
//   返回格式: {"239550":{"base_appID":221380,"base_item_id":125},...}（Key 是 DLC 的 appID）
// 数据源2: Steam IStoreBrowseService/GetItems 的 type 字段（type=1 为 dlc, type=6 为 music）
//   对 Barter.vg 未收录的新 DLC/冷门 DLC 进行补充识别
var faDlcDbData = null;       // { "dlcAppId": { base_appID: 123, base_item_id: 45 } }
var faDlcDbLoading = false;
var faDlcDbPromise = null;    // v1.75: 存储 in-flight Promise，避免并发调用返回 null
const FA_DLC_DB_CACHE_KEY = 'fa_dlc_db_cache';
const FA_DLC_DB_CACHE_TTL = 48 * 60 * 60 * 1000; // 48h，与 bundle 数据一致

// v1.75: 全库存应用类型映射（补充 Barter.vg 未覆盖的 DLC/music）
var faAppTypeMap = null;       // { "appId": "dlc" | "music" | "game" | ... }
var faAppTypePromise = null;
const FA_APP_TYPES_CACHE_KEY = 'fa_app_types_cache';
const FA_APP_TYPES_CACHE_TTL = 48 * 60 * 60 * 1000; // 48h

// 双源 DLC 检测：Barter.vg DLC 数据库 OR Steam type=dlc/music
function faIsDlc(appId) {
    if (!appId) return false;
    var id = String(appId);
    if (faDlcDbData && faDlcDbData[id]) return true;
    if (faAppTypeMap) {
        var t = faAppTypeMap[id];
        if (t === 'dlc' || t === 'music') return true;
    }
    return false;
}

// v1.81: 优先 IDB 读,GM 兜底 + 自动迁移(用于 DLC DB / App Types 这类大对象缓存)
function _faDlcCacheRead(key) {
    var cached = faIDB.get(key, null);
    if (!cached) {
        try { cached = GM_getValue(key, null); } catch (e) {}
        if (cached) { try { faIDB.set(key, cached); } catch (e) {} }
    }
    return cached;
}
function _faDlcCacheWrite(key, obj) {
    try { faIDB.set(key, obj); } catch (e) {}
    try { GM_setValue(key, obj); } catch (e) {}
}

// v1.75: 同步从缓存加载 DLC 数据库和应用类型映射（IDB 优先,GM 兜底）
// 在面板首次渲染前调用，确保 faIsDlc() 可用，避免 DLC 计数初始为 0
function faLoadDlcDataFromCacheSync() {
    if (!faDlcDbData) {
        try {
            var cached = _faDlcCacheRead(FA_DLC_DB_CACHE_KEY);
            if (cached && cached.timestamp && (Date.now() - cached.timestamp < FA_DLC_DB_CACHE_TTL)) {
                faDlcDbData = cached.data;
                console.log('[FA] DLC 数据库缓存命中(sync): ' + Object.keys(faDlcDbData).length + ' 条记录');
            }
        } catch(e) { console.warn('[FA] DLC 数据库缓存读取失败:', e); }
    }
    if (!faAppTypeMap) {
        try {
            var cached2 = _faDlcCacheRead(FA_APP_TYPES_CACHE_KEY);
            if (cached2 && cached2.timestamp && (Date.now() - cached2.timestamp < FA_APP_TYPES_CACHE_TTL)) {
                faAppTypeMap = cached2.data;
                console.log('[FA] 应用类型缓存命中(sync): ' + Object.keys(faAppTypeMap).length + ' 条');
            }
        } catch(e) { console.warn('[FA] 应用类型缓存读取失败:', e); }
    }
}

// v1.75: 异步加载 Barter.vg DLC 数据库（带缓存 + in-flight 去重）
function faLoadDlcDatabase() {
    if (faDlcDbData) return Promise.resolve(faDlcDbData);
    if (faDlcDbPromise) return faDlcDbPromise;
    faDlcDbPromise = new Promise(function(resolve) {
        // v1.81: IDB 优先,GM 兜底
        var cached = _faDlcCacheRead(FA_DLC_DB_CACHE_KEY);
        if (cached && cached.timestamp && (Date.now() - cached.timestamp < FA_DLC_DB_CACHE_TTL)) {
            faDlcDbData = cached.data;
            console.log('[FA] DLC 数据库缓存命中: ' + Object.keys(faDlcDbData).length + ' 条记录');
            resolve(faDlcDbData);
            return;
        }
        console.log('[FA] 正在从 Barter.vg 获取 DLC 数据库...');
        faCompat.optionalRequest({
            method: 'GET',
            url: 'https://bartervg.com/browse/dlc/json/',
            timeout: 30000,
            onload: function(r) {
                try {
                    var json = JSON.parse(r.responseText);
                    if (!json || Object.keys(json).length < 7000) {
                        console.warn('[FA] Barter.vg DLC 数据 sanity check 失败（记录数: ' + (json ? Object.keys(json).length : 0) + '）');
                        resolve(null);
                        return;
                    }
                    faDlcDbData = json;
                    GM_setValue(FA_DLC_DB_CACHE_KEY, { data: json, timestamp: Date.now() });
                    // v1.81: 同步写 IDB
                    try { faIDB.set(FA_DLC_DB_CACHE_KEY, { data: json, timestamp: Date.now() }); } catch (e) {}
                    console.log('[FA] DLC 数据库加载完成: ' + Object.keys(json).length + ' 条记录');
                    resolve(faDlcDbData);
                } catch(e) {
                    console.warn('[FA] DLC 数据库解析失败:', e);
                    resolve(null);
                }
            },
            onerror: function() { console.warn('[FA] DLC 数据库获取失败（网络错误）'); resolve(null); },
            ontimeout: function() { console.warn('[FA] DLC 数据库获取超时'); resolve(null); }
        });
    });
    faDlcDbPromise.then(function() { faDlcDbPromise = null; });
    return faDlcDbPromise;
}

// v1.75: 通过 Steam GetItems 批量获取指定 appIds 的类型，补充 Barter.vg 未覆盖的 DLC
// 增量更新：仅获取 faAppTypeMap 中缺失的 appIds，已有数据不重复请求
function faEnrichAppTypes(appIds) {
    if (!appIds || appIds.length === 0) return Promise.resolve(faAppTypeMap);
    // 筛选出类型未知的 appIds（增量更新）
    var needFetch = appIds.filter(function(id) { return !faAppTypeMap || !faAppTypeMap[String(id)]; });
    if (needFetch.length === 0) return Promise.resolve(faAppTypeMap);
    if (faAppTypePromise) return faAppTypePromise;

    faAppTypePromise = new Promise(function(resolve) {
        // 检查缓存
        if (!faAppTypeMap) {
            // v1.81: IDB 优先,GM 兜底
            var cached = _faDlcCacheRead(FA_APP_TYPES_CACHE_KEY);
            if (cached && cached.timestamp && (Date.now() - cached.timestamp < FA_APP_TYPES_CACHE_TTL)) {
                faAppTypeMap = cached.data;
                // 缓存命中后重新筛选增量
                needFetch = appIds.filter(function(id) { return !faAppTypeMap[String(id)]; });
                if (needFetch.length === 0) { resolve(faAppTypeMap); faAppTypePromise = null; return; }
            }
        }
        console.log('[FA] 正在获取 ' + needFetch.length + ' 个应用的类型信息...');
        var CHUNK = 200, CONCURRENCY = 3;
        var chunks = [];
        for (var i = 0; i < needFetch.length; i += CHUNK) chunks.push(needFetch.slice(i, i + CHUNK));
        var typeMap = faAppTypeMap ? Object.assign({}, faAppTypeMap) : {};
        var qIdx = 0;
        function worker() {
            if (qIdx >= chunks.length) return Promise.resolve();
            var chunk = chunks[qIdx++];
            var input = {
                ids: chunk.map(function(id) { return { appid: Number(id) }; }),
                context: { language: 'schinese', country_code: faCurrency.cc || 'cn', steam_realm: 1 },
                data_request: { include_release: false }
            };
            var reqUrl = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=' + encodeURIComponent(JSON.stringify(input));
            return faGmGetJson(reqUrl, 20000).then(function(resp) {
                var storeItems = (resp && resp.response && resp.response.store_items) || [];
                storeItems.forEach(function(si) {
                    if (si && si.appid) {
                        var typeStr = 'game';
                        if (typeof si.type === 'number') {
                            typeStr = ({ 0: 'game', 1: 'dlc', 2: 'software', 3: 'video', 4: 'series', 6: 'music', 7: 'tool', 8: 'video_series' })[si.type] || 'other';
                        } else if (si.type) {
                            typeStr = String(si.type).toLowerCase();
                        }
                        typeMap[String(si.appid)] = typeStr;
                    }
                });
                return new Promise(function(r) { setTimeout(r, 150); }).then(worker);
            }).catch(function() { return worker(); });
        }
        var workers = [];
        for (var w = 0; w < CONCURRENCY; w++) workers.push(worker());
        Promise.all(workers).then(function() {
            faAppTypeMap = typeMap;
            GM_setValue(FA_APP_TYPES_CACHE_KEY, { data: typeMap, timestamp: Date.now() });
            // v1.81: 同步写 IDB
            try { faIDB.set(FA_APP_TYPES_CACHE_KEY, { data: typeMap, timestamp: Date.now() }); } catch (e) {}
            console.log('[FA] 应用类型获取完成: ' + Object.keys(typeMap).length + ' 条');
            resolve(faAppTypeMap);
            faAppTypePromise = null;
        });
    });
    return faAppTypePromise;
}

(function() {
    'use strict';
    // v1.97: 全局 try-catch 兜底 — 修复油猴 beta 版中"我的贡献/面板无法打开"问题。
    //   之前整个 IIFE 无异常保护，任何单点错误(如 application_config 不可见、Chart.js 未加载、
    //   saves 结构异常)都会向上冒泡杀死整个脚本，导致 init() 不执行、按钮不渲染、面板打不开。
    //   此处捕获异常后降级重试 init()，保证单点失败不再阻断全部功能。
    //   注意: IIFE 内的顶层 return(如非 store 页、未登录)是正常退出，不触发 catch。
    try {
    // v1.70: 异步加载 Barter.vg bundle 数据（不阻塞页面渲染，加载失败静默降级）
    faLoadBundleData();
    // v1.75: 同步加载 DLC 数据库和应用类型缓存（确保面板首次渲染时 faIsDlc 可用）
    faLoadDlcDataFromCacheSync();
    // v1.76: 同步加载年度大作(GOTY)缓存（确保愿望单/共享冷却筛选可用）
    faLoadGotyFromCacheSync();
    if(window.location.host == "keylol.com") {
        // v1.58: 注入紫色家庭共享标记样式（参考 Keylol-Steam-Key-Tracker badge 设计）
        faKeylolInjectStyles();
        keyloladHover()

        observer = new MutationObserver((mutations, obs) => {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(function(node) {
                        // 确保是元素节点
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            keyloladHover(node)

                        }
                    })
                }
            })
        })
        observer.observe(document, {childList: true, subtree: true});

    }
    if(url.startsWith("steamdb.keylol.com/tooltip")){
        let id = Number(document.baseURI.split('#')[1].split("/")[1])

        if (saves.familyGameList.GameList.includes(id) && !saves.familyGameList.GameInfo[id].owners.includes(saves.steamid)) {
            (function wait_block(){
                let block = document.querySelector('div#game_score')
                if(block){

                    let plugging = document.createElement('div');
                    let innerHTML = `由 ${saves.familyGameList.GameInfo[id].owners.length} 位成员共享（`
                                            saves.familyGameList.GameInfo[id].owners.forEach((steamid)=>{
                                                innerHTML+= `【${saves.familyInfo.steamIdtoName[steamid]}】`
                                            })
                    innerHTML+= `）。最早由【${saves.familyInfo.steamIdtoName[saves.familyGameList.GameInfo[id].owners[0]]}】于 ${timestampToTime(saves.familyGameList.GameInfo[id].time)} 购入。`

                                            plugging.innerHTML = `<b>家庭组: </b>${innerHTML}`
                block.parentNode.insertBefore(plugging, block.nextSibling);

                }else{
                    setTimeout(wait_block,100)
                }
            })();

        }
    }

    // v1.58: 紫色家庭共享标记样式注入（参考 Keylol-Steam-Key-Tracker 的 GM_addStyle + badge 方案）
    function faKeylolInjectStyles() {
        var css = ''
            + '.fa-keylol-link{padding:0 2px;border-radius:3px;text-decoration:none;}'
            // 家庭共享：紫色主题 #a855f7
            + '.fa-keylol-link-family{box-shadow:inset 0 -2px 0 #a855f7;background-color:rgba(168,85,247,0.85)!important;color:#fff!important;font-weight:700!important;}'
            // badge 通用样式
            + '.fa-keylol-badge{display:inline-block;margin-left:4px;padding:1px 6px;font-size:11px;font-weight:700;line-height:1.4;border-radius:3px;vertical-align:baseline;font-family:-apple-system,system-ui,"Segoe UI",sans-serif;letter-spacing:0.3px;}'
            + '.fa-keylol-badge-family{background:#a855f7;color:#fff;}'
            // v1.70: 进包标记 badge（橙色主题 #f59e0b）
            + '.fa-keylol-badge-bundle{background:#f59e0b;color:#fff;}'
            // v1.70: Steam 商店页进包标记旗帜
            // v1.94: 移除 display/margin-top/position/z-index(改由内联 style 设置绝对定位),
            //   避免与内联 position:absolute 冲突;保留视觉样式作为基础
            + '.fa-bundle-flag{padding:1px 6px;font-size:11px;font-weight:700;line-height:1.4;border-radius:3px;background:#f59e0b;color:#fff;white-space:nowrap;}'
            // v1.82/v1.89: 按钮行 flex 布局,保持"查看贡献者"等按钮间距统一且不换行
            + '.fa-owned-actions{display:flex!important;flex-wrap:nowrap!important;align-items:center;gap:8px;}'
            + '.fa-owned-actions .game_area_already_owned_btn{float:none!important;flex-shrink:0!important;}';
        if (typeof GM_addStyle === 'function') {
            GM_addStyle(css);
        } else {
            var style = document.createElement('style');
            style.textContent = css;
            (document.head || document.documentElement).appendChild(style);
        }
    }

    // v1.58: 重构 keyloladHover，使用 CSS 类 + badge 替代内联样式
    // 参考 Keylol-Steam-Key-Tracker.js 的 decorateLink 设计：
    //   1. data 属性去重（避免 MutationObserver 重复处理）
    //   2. CSS 类控制样式（!important 覆盖 Keylol 页面样式）
    //   3. 链接后插入 badge 元素，显示"家庭共享"标签
    function keyloladHover(mutationnode) {
        let node = document
        if(mutationnode) { node = mutationnode}
        node.querySelectorAll('a').forEach(function (link) {
            var href = String(link.getAttribute('href') || '');
            var match;
            if (match = href.match(/\/(store\.steampowered|steamcommunity)\.com\/(app|sub)\/(\d+)/)) {
                var type = match[2];
                var id = parseInt(match[3]);
                if (type === 'app') {
                    // v1.58: 使用 data 属性去重，替代旧的 classList.contains 检查
                    if (saves.familyGameList.GameList.includes(id) && !link.dataset.faKeylolDone) {
                        link.dataset.faKeylolDone = '1';
                        var gi = saves.familyGameList.GameInfo[id];
                        if (gi && gi.owners && !gi.owners.includes(saves.steamid)) {
                            // 家庭组共享游戏 — 紫色标记
                            link.classList.add('fa-keylol-link', 'fa-keylol-link-family');
                            // 构建 tooltip：显示家庭库拥有者信息
                            var idMap = saves.familyInfo.steamIdtoName || {};
                            var ownerNames = gi.owners.map(function(sid) {
                                return idMap[sid] || sid;
                            }).join('、');
                            link.title = '家庭组共享 · 由 ' + ownerNames + ' 拥有';
                            // 插入紫色 badge
                            var badge = document.createElement('span');
                            badge.className = 'fa-keylol-badge fa-keylol-badge-family';
                            badge.textContent = '家庭共享';
                            badge.title = '此游戏在家庭库中，由其他成员共享';
                            link.insertAdjacentElement('afterend', badge);
                        }
                    }
                    // v1.70: 进包标记 — 独立于家庭库检查，对所有 Steam app 链接检查进包状态
                    var bundleCount = getBundleCount(id);
                    if (bundleCount > 0 && !link.dataset.faBundleDone) {
                        link.dataset.faBundleDone = '1';
                        var bundleBadge = document.createElement('span');
                        bundleBadge.className = 'fa-keylol-badge fa-keylol-badge-bundle';
                        bundleBadge.textContent = '进过' + bundleCount + '包';
                        bundleBadge.title = '此游戏曾出现在 ' + bundleCount + ' 个 bundle 中（数据来源: Barter.vg）';
                        bundleBadge.style.marginLeft = '2px';
                        // 插入在家庭共享 badge 之后（如果存在），否则插入在 link 之后，确保不重合
                        if (badge && badge.parentNode) {
                            badge.insertAdjacentElement('afterend', bundleBadge);
                        } else {
                            link.insertAdjacentElement('afterend', bundleBadge);
                        }
                    }
                }
            }
        });
    }

    if(window.location.host != "store.steampowered.com") {return ;}

    init()
    window.faRestoreAfterPageShow = function () {
        try {
            init();
            if (window.faUpdateMenuBadge) window.faUpdateMenuBadge();
        } catch (e) { console.warn('[FA] Safari 页面恢复失败:', e); }
    };
    if(faCompat.accountId() == 0){return;}

    if(!isNewUser && saves.settings.isAutoScan && faCompat.serverTime()-saves.lastupDateTime>86400){
        scan(false)
    }else if(!isupdate && faCompat.serverTime()-saves.lastupDateTime>604800){
        let innerText
        if (saves.noPrompt == null || saves.noPrompt == false){
            if(saves.familyGameList.GameList.length == 0){
                innerText="您似乎没有家庭库的游戏记录，是否现在扫描家庭库游戏并记录呢？"
            }else{
                innerText="您已经超过1周没有更新家庭库的游戏列表了，是否现在去扫描?"
            }
            faCompat.confirm('脚本提示',innerText,'扫描家庭库','取消').done(()=>{scan(true)}).fail(()=>{
                saves.settings.isAutoScan = false
                saves.noPrompt = true
                savestorage()
                faCompat.alert('脚本提示','如果需要手动扫描，可以在Steam主页右上角进入进行扫描','好的')
            })
        }
    }

    var search_suggestion = document.getElementById('search_suggestion_contents')
    if(search_suggestion){
        var observer_search = new MutationObserver((mutations, obs) => {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {

                    mutation.addedNodes.forEach(function(node) {
                        // 确保是元素节点
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 检查新节点是否有指定的类
                            if (node.classList.contains('match_app')) {
                                addflag(node)
                            }
                        }
                    });
                }
            })
        });
        observer_search.observe(search_suggestion, {childList: true, subtree: true});
    }



    if(url == "store.steampowered.com/" ){
        observer_3()
        observer = new MutationObserver((mutations, obs) => {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(function(node) {
                        // 确保是元素节点
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // v1.67：跳过家庭分析浮窗内的节点 — 浮窗自身的游戏卡片不需要 Steam 原生共享标记
                            // 这是首页 observer 的第一道防线（与 fa_observer 的 panel 过滤保持一致）
                            if(node.closest && node.closest('#familyAnalysisPanel')) return;
                            // v1.68：扩展排除 steam-game-library-viewer 浮窗
                            // 个人信息面板（#sgis-panel，含最近游玩/个人入库/相似推荐等）以及游戏库侧边栏（.sglv-panel），
                            // 它们的游戏卡片已由各自脚本负责标记，不需要本脚本再追加 Steam 原生"在家庭库中"旗帜
                            if(node.closest && (node.closest('#sgis-panel') || node.closest('.sglv-panel'))) return;
                            if(node.classList.contains('live_streams_ctn')){return;}

                            node.querySelectorAll("div").forEach((node)=>{
                                addflag(node)
                            })
                            node.querySelectorAll("a").forEach((node)=>{
                                if(node.classList.contains('screenshot')){return;}
                                if(node.querySelector('div.broadcast_live_stream_icon')){return;}
                                // v1.67：再次防御 — 浮窗内 <a> 直接跳过（即使父节点未被上述 closest 命中）
                                if(node.closest && node.closest('#familyAnalysisPanel')) return;
                                // v1.68：同上 — 防御 <a> 直接处于 steam-game-library-viewer 浮窗内的边缘场景
                                if(node.closest && (node.closest('#sgis-panel') || node.closest('.sglv-panel'))) return;
                                addflag(node)
                            })

                        }
                    })
                }
            })
        })
        observer.observe(document, {childList: true, subtree: true});

    }
    if(url.startsWith('store.steampowered.com/app/')&&faCompat.accountId() != 0){
        //addBanner(document.querySelector('div.block.game_media_and_summary_ctn'))
        observer_2();
        // v1.62 新增：DLC 拥有状态检查与标记
        faCheckDlcOwnership();
    }
    if(url.startsWith('store.steampowered.com/search/')&&faCompat.accountId() != 0){
        observer_4()
        var search_results = document.getElementById('search_results')
        // v1.96: 添加 null 守卫,防止 #search_results 元素不存在时 observer.observe(null) 抛出
        //   TypeError 导致后续代码(faScanCards 定义/init 调用等)全部不执行
        if(search_results){
            observer = new MutationObserver((mutations, obs) => {
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes && mutation.addedNodes.length > 0) {

                        mutation.addedNodes.forEach(function(node) {
                            // 确保是元素节点
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.classList.contains('search_result_row') && node.classList.contains('ds_collapse_flag')) {
                                    addflag(node,"clear: left;")
                                }else{
                                    let lists = node.querySelectorAll("a.search_result_row.ds_collapse_flag")
                                    lists.forEach(function(bar){
                                        addflag(bar,"clear: left;")
                                    })
                                }
                            }
                        });
                    }
                })
            });

            observer.observe(search_results, {childList: true, subtree: true});
        }


    }
    if(url.startsWith('store.steampowered.com/wishlist/')&&faCompat.accountId() != 0){
        observer_6()
        var wishlist_results = document.getElementById('wishlist_ctn')
        if(wishlist_results){
            // 旧版愿望单布局(wishlist_ctn + wishlist_row)
            let observer_wishlist = new MutationObserver((mutations, obs) => {
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes && mutation.addedNodes.length > 0) {

                        mutation.addedNodes.forEach(function(node) {
                            // 确保是元素节点
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.classList.contains('wishlist_row')) {
                                    addflag(node)
                                }
                            }
                        });
                    }
                })
            });
            observer_wishlist.observe(wishlist_results, {childList: true, subtree: true});
        }
        // v1.90: 新版 Steam React 愿望单布局兼容 — 无 wishlist_ctn/wishlist_row,改扫 a[href*="/app/"]
        // v1.90 修复:React 水合(error #418)会清除脚本注入的 DOM 元素,导致标记"一闪即逝"
        //   根因:脚本 @run-at document-end 在 React 水合完成前修改 DOM,React 检测到不匹配后重渲染
        //   修复策略:
        //     1. 观察器立即挂载(不等 1.5s),确保能捕获 React 重渲染事件
        //     2. 首次扫描延迟到 3s(等 React 水合完成)
        //     3. 观察器同时检测 addedNodes(新节点)和 removedNodes(标记被清除),均触发重扫
        //     4. 重扫前清除 data-fa-wl-scanned 属性,允许重新标记 React 新建的节点
        function _faScanNewWishlist(){
            var gameLinks = document.querySelectorAll('a[href*="/app/"]');
            gameLinks.forEach(function(link){
                // 排除 header 区域的链接(导航栏、语言切换等)
                if(link.closest('header')) return;
                // 排除已处理的链接
                if(link.dataset.faWlScanned) return;
                // 仅处理包含图片的链接(胶囊封面),避免同一游戏的多个链接重复标记
                if(!link.querySelector('img')) return;
                // v1.90 修复:仅在确认有图片后才标记为已处理,避免 React 异步渲染图片前误标记
                link.dataset.faWlScanned = '1';
                // 确保 flag 绝对定位锚点正确
                if(!link.style.position || link.style.position === 'static'){
                    link.style.position = 'relative';
                }
                addflag(link);
            });
        }
        // v1.90 修复:立即挂载观察器(不等延迟),确保能捕获 React 水合重渲染事件
        var _faWlScanTimer = null;
        var _faWlRetries = 0;
        var observer_new_wishlist = new MutationObserver(function(mutations){
            var needRescan = false;
            for(var i = 0; i < mutations.length; i++){
                // 检测新节点(React 重渲染创建的新元素)
                if(mutations[i].addedNodes && mutations[i].addedNodes.length > 0){
                    needRescan = true;
                    break;
                }
                // v1.90 修复:也检测被移除的标记元素(React 重渲染清除脚本注入的 flag)
                if(mutations[i].removedNodes && mutations[i].removedNodes.length > 0){
                    for(var j = 0; j < mutations[i].removedNodes.length; j++){
                        var removed = mutations[i].removedNodes[j];
                        if(removed.nodeType === Node.ELEMENT_NODE &&
                           (removed.id === 'fa-wl-sibling' ||
                            (removed.querySelector && removed.querySelector('.ds_family_share_flag, .ds_owned_flag')))){
                            needRescan = true;
                            break;
                        }
                    }
                }
            }
            if(needRescan){
                clearTimeout(_faWlScanTimer);
                _faWlScanTimer = setTimeout(_faScanNewWishlist, 300);
            }
        });
        // 立即挂载观察器到 body(不等 section/main 渲染,body 一定存在)
        observer_new_wishlist.observe(document.body, {childList: true, subtree: true});
        // v1.90 修复:首次扫描延迟到 3s,确保 React 水合完成后再生效
        //   水合期间(0-2s)修改 DOM 会被 React 清除,3s 后水合已完成,标记可持久
        setTimeout(_faScanNewWishlist, 3000);
        // 额外保险:5s 再扫一次(防止 3s 时 React 仍在渲染)
        setTimeout(_faScanNewWishlist, 5000);
    }

    if(url.startsWith('store.steampowered.com/category/')&&faCompat.accountId() != 0){
        let lists = document.body.querySelectorAll("div.ImpressionTrackedElement")
            lists.forEach(function(bar){
                // v1.59：添加 null 守卫，防止 querySelector('a') 返回 null 传入 addflag
                let node_a = bar.querySelector('a')
                if(node_a){ addflag(node_a) }
            })

        let observer_sale_item = new MutationObserver((mutations, obs) => {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(function(node) {
                        // 确保是元素节点
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.querySelector('div.ImpressionTrackedElement')) {
                                node.querySelectorAll('div.ImpressionTrackedElement').forEach(node=>{
                                    // v1.59：添加 null 守卫
                                    let node_a = node.querySelector('a')
                                    if(node_a){ addflag(node_a) }
                                })
                            }else if( node.classList.contains('Panel')&&node.classList.contains('Focusable')){
                                    let node_a = node.querySelector('a')
                                    if(node_a){
                                        addflag(node_a)
                                    }
                            }else if( node.querySelector('div.Panel.Focusable')){
                                    let node_a = node.querySelector('div.Panel.Focusable').querySelector('a')
                                    if(node_a){
                                        addflag(node_a)
                                    }
                            }

                        }
                    });
                }
            })
        });
        observer_sale_item.observe(document.body, {childList: true, subtree: true});
    }

    // v1.53：发行商/开发商/系列/相似推荐页适配
    // 实测卡片结构（data-ds-appid + position:relative，复用 addflag 标准路径与 ds_flag 原生样式）：
    //   publisher/developer/franchise → a.store_capsule[data-ds-appid]
    //   recommended/morelike          → a.similar_grid_capsule[data-ds-appid]
    // 无 data-ds-appid 的锚点（评测链接 recommendation_link / recommendation_btn 等）由 addflag 自动跳过
    if((url.startsWith('store.steampowered.com/publisher/')
        || url.startsWith('store.steampowered.com/developer/')
        || url.startsWith('store.steampowered.com/franchise/')
        || url.startsWith('store.steampowered.com/recommended/morelike/')) && faCompat.accountId() != 0){
        observer_capsule_pages();
        let observer_capsule = new MutationObserver((mutations, obs) => {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(function(node) {
                        // 确保是元素节点
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // v1.55：选择器追加 a.tab_item[data-ds-appid]
                            if(node.matches && node.matches('a.store_capsule[data-ds-appid], a.similar_grid_capsule[data-ds-appid], a.tab_item[data-ds-appid]')){
                                addflag(node);
                            }else if(node.querySelectorAll){
                                node.querySelectorAll('a.store_capsule[data-ds-appid], a.similar_grid_capsule[data-ds-appid], a.tab_item[data-ds-appid]').forEach(function(bar){
                                    addflag(bar);
                                });
                            }
                        }
                    });
                }
            });
        });
        observer_capsule.observe(document.body, {childList: true, subtree: true});
    }

    // v1.59：统一兜底扫描 + 防抖观察器（参考 Steam-PSPlus-mark.js 的 scanCards + scheduleScan + observe 设计）
    // 使用统一选择器扫描全页游戏卡片，捕获各页面 observer 遗漏的异步加载元素
    // （如 home_marketing_message 仅含 href 无 data-ds-appid、React 延迟渲染的 capsule 等）
    // addflag 内部有防重复检测（ds_owned_flag / ds_family_share_flag），与各页面 observer 共存安全
    var FA_CARD_SELECTOR = [
        '[data-ds-appid]:not([data-fa-scanned])',           // 所有带 data-ds-appid 的游戏卡片
        'a.home_marketing_message:not([data-fa-scanned])',   // 首页营销消息（仅有 href）
        'a.store_capsule:not([data-fa-scanned])',            // 商店 capsule
        'a.tab_item:not([data-fa-scanned])',                 // 标签页游戏条目
        'a.similar_grid_capsule:not([data-fa-scanned])',     // 相似推荐网格
        'a.search_result_row:not([data-fa-scanned])',        // 搜索结果行
        'div.wishlist_row:not([data-fa-scanned])',           // 愿望单行
        'a.match:not([data-fa-scanned])',                    // 搜索建议
    ].join(', ');
    function faScanCards() {
        document.querySelectorAll(FA_CARD_SELECTOR).forEach(function(node) {
            // v1.94: 跳过在本轮扫描中被父元素标记为已扫描的子元素
            // (querySelectorAll 返回静态 NodeList,循环中标记的子元素仍在列表中,需运行时检查)
            if (node.hasAttribute('data-fa-scanned')) return;
            // v1.65：跳过家庭分析浮窗内的元素，避免浮窗游戏封面被添加 Steam 原生共享标记
            if (node.closest && node.closest('#familyAnalysisPanel')) return;
            // v1.68：扩展排除 steam-game-library-viewer 浮窗
            if (node.closest && (node.closest('#sgis-panel') || node.closest('.sglv-panel'))) return;
            node.setAttribute('data-fa-scanned', '1');
            // v1.94: 标记后代带 data-ds-appid 的元素为已扫描,防止推荐卡片内按钮链接等
            //   子元素在同一轮扫描中被重复标记(addflag 内也有祖先 appid 检查作为双重保险)
            var _descendants = node.querySelectorAll('[data-ds-appid]');
            for (var _d = 0; _d < _descendants.length; _d++) {
                _descendants[_d].setAttribute('data-fa-scanned', '1');
            }
            // v1.59：部分卡片类型需要 insertBeforeStyle 参数以保证旗帜插入位置正确
            // （搜索结果行 clear:left、首页 tab_item clear:both），与各页面 observer 保持一致
            if (node.classList && node.classList.contains('search_result_row')) {
                addflag(node, 'clear: left;');
            } else if (node.classList && node.classList.contains('tab_item')) {
                addflag(node, 'clear: both;');
            } else {
                addflag(node);
            }
        });
    }
    function faScheduleScan() {
        if (faScheduleScan._timer) clearTimeout(faScheduleScan._timer);
        faScheduleScan._timer = setTimeout(faScanCards, 250);
    }
    // v1.59 修复：初始扫描必须延迟执行（setTimeout 0），不能同步调用！
    // 原因：faScanCards → addflag 内部访问 const FAMILY_SHARE_FLAG_ICON（定义在文件后方 ~行2972），
    // 同步调用时该 const 尚处于暂时性死区（TDZ），访问会抛 ReferenceError 导致整个 IIFE 中断，
    // 后续 init()、所有页面 observer 全部不执行 → 看不到任何标记。
    // 原始 observer_3/4/6 等不受影响是因为 DOM 未就绪时走 setTimeout 延迟分支，等 IIFE 执行完才调用 addflag。
    setTimeout(faScanCards, 0);
    setTimeout(faScanCards, 1500);
    setTimeout(faScanCards, 3000);
    // 统一 MutationObserver：监听全页 DOM 变化，防抖扫描（回调是异步的，不受 TDZ 影响）
    // v1.65：忽略家庭分析浮窗内部的 DOM 变化，避免浮窗渲染触发全页重扫（性能优化 + 防止误标记）
    // v1.68：扩展忽略 steam-game-library-viewer 浮窗（#sgis-panel / .sglv-panel）内部的 DOM 变化
    if (window.MutationObserver) {
        var fa_observer = new MutationObserver(function(mutations) {
            // 过滤掉源自浮窗的变更，仅当存在非浮窗变更时才触发扫描
            for (var i = 0; i < mutations.length; i++) {
                var target = mutations[i].target;
                if (!target || !target.closest || !target.closest('#familyAnalysisPanel')) {
                    // v1.68：额外跳过 steam-game-library-viewer 浮窗内部变更
                    if (target && target.closest && (target.closest('#sgis-panel') || target.closest('.sglv-panel'))) {
                        continue;
                    }
                    faScheduleScan();
                    return;
                }
            }
        });
        fa_observer.observe(document.body, { childList: true, subtree: true });
    }

    function init(){

        let setting_btn = document.createElement('a');
        setting_btn.className = "Focusable"
        setting_btn.id = "setting_btn"
        setting_btn.style = "font-size:13px;font-weight:400;flex-direction:row;display:flex;align-items:center;cursor:pointer;gap:5px;padding: 0 10px;"

        // v1.39 新增：更新菜单入口游戏数量的函数，扫描完成后动态刷新
        function updateMenuBadge() {
            var count = saves && saves.familyGameList && saves.familyGameList.GameList ? saves.familyGameList.GameList.length : 0;
            var btn = document.getElementById('setting_btn');
            if (btn) {
                var badge = btn.querySelector('.fa-menu-count');
                if (badge) {
                    badge.textContent = count;
                }
            }
        }
        window.faUpdateMenuBadge = updateMenuBadge;

        setting_btn.innerHTML = `<span style="display:flex; width:16px;margin-top:3px"><svg viewBox="0 0 24 24" fill="none"><path d="M7.81998 15.3333C6.2349 16.4298 5.14521 18.1062 4.78665 20H1.33331V15.3333C1.33331 14.0956 1.82498 12.9086 2.70015 12.0335C3.57532 11.1583 4.7623 10.6666 5.99998 10.6666C6.27492 10.6673 6.54929 10.6918 6.81998 10.74C6.71508 11.163 6.66357 11.5975 6.66665 12.0333C6.66944 13.2316 7.07572 14.3941 7.81998 15.3333ZM5.99998 8.69995C6.59332 8.69995 7.17334 8.52401 7.66669 8.19436C8.16004 7.86472 8.54456 7.39618 8.77162 6.848C8.99868 6.29982 9.05809 5.69662 8.94234 5.11468C8.82658 4.53274 8.54086 3.99819 8.1213 3.57863C7.70174 3.15907 7.16719 2.87335 6.58525 2.7576C6.00331 2.64184 5.40011 2.70125 4.85193 2.92831C4.30375 3.15538 3.83522 3.53989 3.50557 4.03324C3.17593 4.52659 2.99998 5.10661 2.99998 5.69995C2.9991 6.09416 3.0761 6.48467 3.22655 6.84904C3.377 7.21342 3.59795 7.54448 3.8767 7.82323C4.15545 8.10198 4.48652 8.32293 4.85089 8.47338C5.21526 8.62383 5.60577 8.70083 5.99998 8.69995ZM18 8.69995C18.5933 8.69995 19.1733 8.52401 19.6667 8.19436C20.16 7.86472 20.5446 7.39618 20.7716 6.848C20.9987 6.29982 21.0581 5.69662 20.9423 5.11468C20.8266 4.53274 20.5409 3.99819 20.1213 3.57863C19.7017 3.15907 19.1672 2.87335 18.5853 2.7576C18.0033 2.64184 17.4001 2.70125 16.8519 2.92831C16.3038 3.15538 15.8352 3.53989 15.5056 4.03324C15.1759 4.52659 15 5.10661 15 5.69995C14.9991 6.09416 15.0761 6.48467 15.2266 6.84904C15.377 7.21342 15.5979 7.54448 15.8767 7.82323C16.1554 8.10198 16.4865 8.32293 16.8509 8.47338C17.2153 8.62383 17.6058 8.70083 18 8.69995ZM21.3333 12.0666C20.896 11.6293 20.3761 11.2833 19.8038 11.0487C19.2316 10.814 18.6184 10.6955 18 10.7C17.725 10.7006 17.4507 10.7251 17.18 10.7733C17.2822 11.1855 17.3336 11.6086 17.3333 12.0333C17.338 13.243 16.9313 14.4185 16.18 15.3666C17.7651 16.4631 18.8547 18.1396 19.2133 20.0333H22.6666V15.3666C22.6756 14.1337 22.1963 12.9473 21.3333 12.0666Z" fill="currentColor"></path><path d="M12 14.7C12.5274 14.7 13.043 14.5436 13.4815 14.2506C13.92 13.9576 14.2618 13.5411 14.4637 13.0539C14.6655 12.5666 14.7183 12.0304 14.6154 11.5131C14.5125 10.9958 14.2585 10.5207 13.8856 10.1477C13.5127 9.77481 13.0375 9.52083 12.5202 9.41794C12.0029 9.31505 11.4668 9.36785 10.9795 9.56969C10.4922 9.77152 10.0757 10.1133 9.78273 10.5518C9.48971 10.9904 9.33331 11.5059 9.33331 12.0334C9.33331 12.7406 9.61426 13.4189 10.1144 13.919C10.6145 14.4191 11.2927 14.7 12 14.7ZM12 16.7C10.7623 16.7 9.57532 17.1917 8.70015 18.0669C7.82498 18.942 7.33331 20.129 7.33331 21.3667H16.6666C16.6666 20.129 16.175 18.942 15.2998 18.0669C14.4246 17.1917 13.2377 16.7 12 16.7Z" fill="currentColor"></path></svg>
        </span>我的家庭库<span class="fa-menu-count" style="color: #dcdedf;font-size: 10px;">${saves.familyGameList.GameList.length}</span>`
        setting_btn.onclick = btnonclick
        // v1.90 修复:愿望单页面延迟 2s 注入所有 header DOM 修改,避免 React 水合冲突(error #418)
        //   水合期间修改 DOM → React 检测不匹配 → 整页重渲染 → 脚本注入的元素(含标记)被清除
        // v1.97: 统一所有商店页延迟 2s 注入。之前仅愿望单页延迟,主页立即 plug(),
        //   在油猴 beta 版更早的执行时机下主页按钮会被 React 水合清除,导致"我的家庭库"
        //   入口消失、面板无法打开。plug 内部已有 setTimeout(plug,200) 重试兜底,延迟安全。
        setTimeout(plug, 2000);
        setTimeout(plugDropdown, 2000);
        // v1.90: 在愿望单链接左侧增加"我的家庭库"入口
        // v1.90 修复:延迟 2s 注入,避免在 React 水合完成前修改 header DOM 导致 error #418
        // (React 水合检测到 DOM 不匹配会重新渲染,清除脚本注入的元素)
        setTimeout(plugWishlistSibling, 2000);

        function plug(){
            // v1.90 修复:去重检查,防止 React 重渲染后重复插入
            if(document.getElementById('setting_btn')) return;
            let headding = document.querySelector('div[aria-label="商店菜单"], div[aria-label="Store menu"]')
            if(headding){
                headding.insertBefore(setting_btn, headding.lastChild);
            }else{
                setTimeout(plug,200)
            }
        }

        // v1.90: 在顶部导航栏愿望单链接左侧插入"我的家庭库"入口
        // 新版 Steam React 布局中,愿望单链接位于 header 内 a[href*="wishlist"],文本含"愿望单"/"Wishlist"
        var faWlSiblingObserver = null;
        function plugWishlistSibling(){
            if(document.getElementById('fa-wl-sibling')) return; // 已注入
            var wlLink = null;
            var allLinks = document.querySelectorAll('a[href*="wishlist"]');
            for(var i = 0; i < allLinks.length; i++){
                var txt = allLinks[i].textContent.trim();
                // 匹配"愿望单"或"Wishlist",且在 header 区域(排除语言切换等)
                if((txt.indexOf('愿望单') !== -1 || txt.toLowerCase().indexOf('wishlist') !== -1)
                   && allLinks[i].closest('header')){
                    wlLink = allLinks[i];
                    break;
                }
            }
            if(!wlLink){
                setTimeout(plugWishlistSibling, 500);
                return;
            }
            // 复用愿望单链接的 CSS 类名,确保样式一致
            var faLink = document.createElement('a');
            faLink.id = 'fa-wl-sibling';
            faLink.className = wlLink.className;
            faLink.setAttribute('tabindex', '0');
            faLink.setAttribute('role', 'button');
            faLink.style.cursor = 'pointer';
            // 获取愿望单链接中 badge span 的类名,用于样式一致
            var wlSpan = wlLink.querySelector('span');
            var spanClass = wlSpan ? wlSpan.className : '';
            faLink.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" role="presentation" style="width:14px;height:14px;">'
                + '<path d="M7.81998 15.3333C6.2349 16.4298 5.14521 18.1062 4.78665 20H1.33331V15.3333C1.33331 14.0956 1.82498 12.9086 2.70015 12.0335C3.57532 11.1583 4.7623 10.6666 5.99998 10.6666C6.27492 10.6673 6.54929 10.6918 6.81998 10.74C6.71508 11.163 6.66357 11.5975 6.66665 12.0333C6.66944 13.2316 7.07572 14.3941 7.81998 15.3333ZM5.99998 8.69995C6.59332 8.69995 7.17334 8.52401 7.66669 8.19436C8.16004 7.86472 8.54456 7.39618 8.77162 6.848C8.99868 6.29982 9.05809 5.69662 8.94234 5.11468C8.82658 4.53274 8.54086 3.99819 8.1213 3.57863C7.70174 3.15907 7.16719 2.87335 6.58525 2.7576C6.00331 2.64184 5.40011 2.70125 4.85193 2.92831C4.30375 3.15538 3.83522 3.53989 3.50557 4.03324C3.17593 4.52659 2.99998 5.10661 2.99998 5.69995C2.9991 6.09416 3.0761 6.48467 3.22655 6.84904C3.377 7.21342 3.59795 7.54448 3.8767 7.82323C4.15545 8.10198 4.48652 8.32293 4.85089 8.47338C5.21526 8.62383 5.60577 8.70083 5.99998 8.69995ZM18 8.69995C18.5933 8.69995 19.1733 8.52401 19.6667 8.19436C20.16 7.86472 20.5446 7.39618 20.7716 6.848C20.9987 6.29982 21.0581 5.69662 20.9423 5.11468C20.8266 4.53274 20.5409 3.99819 20.1213 3.57863C19.7017 3.15907 19.1672 2.87335 18.5853 2.7576C18.0033 2.64184 17.4001 2.70125 16.8519 2.92831C16.3038 3.15538 15.8352 3.53989 15.5056 4.03324C15.1759 4.52659 15 5.10661 15 5.69995C14.9991 6.09416 15.0761 6.48467 15.2266 6.84904C15.377 7.21342 15.5979 7.54448 15.8767 7.82323C16.1554 8.10198 16.4865 8.32293 16.8509 8.47338C17.2153 8.62383 17.6058 8.70083 18 8.69995ZM21.3333 12.0666C20.896 11.6293 20.3761 11.2833 19.8038 11.0487C19.2316 10.814 18.6184 10.6955 18 10.7C17.725 10.7006 17.4507 10.7251 17.18 10.7733C17.2822 11.1855 17.3336 11.6086 17.3333 12.0333C17.338 13.243 16.9313 14.4185 16.18 15.3666C17.7651 16.4631 18.8547 18.1396 19.2133 20.0333H22.6666V15.3666C22.6756 14.1337 22.1963 12.9473 21.3333 12.0666Z" fill="currentColor"></path>'
                + '<path d="M12 14.7C12.5274 14.7 13.043 14.5436 13.4815 14.2506C13.92 13.9576 14.2618 13.5411 14.4637 13.0539C14.6655 12.5666 14.7183 12.0304 14.6154 11.5131C14.5125 10.9958 14.2585 10.5207 13.8856 10.1477C13.5127 9.77481 13.0375 9.52083 12.5202 9.41794C12.0029 9.31505 11.4668 9.36785 10.9795 9.56969C10.4922 9.77152 10.0757 10.1133 9.78273 10.5518C9.48971 10.9904 9.33331 11.5059 9.33331 12.0334C9.33331 12.7406 9.61426 13.4189 10.1144 13.919C10.6145 14.4191 11.2927 14.7 12 14.7ZM12 16.7C10.7623 16.7 9.57532 17.1917 8.70015 18.0669C7.82498 18.942 7.33331 20.129 7.33331 21.3667H16.6666C16.6666 20.129 16.175 18.942 15.2998 18.0669C14.4246 17.1917 13.2377 16.7 12 16.7Z" fill="currentColor"></path>'
                + '</svg>我的家庭库<span class="' + spanClass + '">' + saves.familyGameList.GameList.length + '</span>';
            faLink.addEventListener('click', function(e){
                e.preventDefault();
                e.stopPropagation();
                btnonclick();
            });
            // 插入到愿望单链接之前(同一父容器内)
            wlLink.parentNode.insertBefore(faLink, wlLink);
            // v1.90: 监听 header 变化,React 重渲染后重新注入
            if(!faWlSiblingObserver){
                faWlSiblingObserver = new MutationObserver(function(){
                    // 检查"我的家庭库"侧边入口是否被 React 重渲染清除
                    if(!document.getElementById('fa-wl-sibling')){
                        plugWishlistSibling();
                    }
                    // v1.90 修复:同时检查 setting_btn(商店菜单中的"我的家庭库"按钮)
                    if(!document.getElementById('setting_btn')){
                        plug();
                    }
                });
                var headerEl = document.querySelector('header');
                if(headerEl){
                    faWlSiblingObserver.observe(headerEl, {childList: true, subtree: true});
                }
            }
        }

        // 降级入口：在账户下拉菜单（#account_dropdown）中添加"我的家庭库"
        // 当顶部导航栏入口因布局/浏览器差异找不到时，用户仍可通过账户下拉菜单访问
        var faDdObserver = null;
        var faDdRetries = 0;
        function plugDropdown(){
            var dropdown = document.querySelector('#account_dropdown');
            if(!dropdown){
                // 未登录时 #account_dropdown 不存在，最多轮询 150 次（约 30 秒）
                if (faDdRetries++ < 150) setTimeout(plugDropdown, 200);
                return;
            }
            injectDropdownItem(dropdown);
            // 监听 dropdown 内容变化（部分浏览器/React 重渲染时重新注入）
            if (!faDdObserver) {
                faDdObserver = new MutationObserver(function(){
                    var dd = document.querySelector('#account_dropdown');
                    if (dd) injectDropdownItem(dd);
                });
                faDdObserver.observe(dropdown, { childList: true, subtree: true });
            }
        }
        function injectDropdownItem(dropdown){
            var menuBody = dropdown.querySelector('.popup_body.popup_menu') || dropdown;
            if (menuBody.querySelector('#fa_dd_item')) return; // 避免重复注入
            var ddItem = document.createElement('a');
            ddItem.className = 'popup_menu_item';
            ddItem.id = 'fa_dd_item';
            ddItem.setAttribute('role', 'button');
            ddItem.style.cursor = 'pointer';
            ddItem.innerHTML = '<span style="display:inline-flex;width:14px;margin-right:6px;vertical-align:middle;">'
                + '<svg viewBox="0 0 24 24" fill="none" style="width:14px;height:14px;">'
                + '<path d="M7.81998 15.3333C6.2349 16.4298 5.14521 18.1062 4.78665 20H1.33331V15.3333C1.33331 14.0956 1.82498 12.9086 2.70015 12.0335C3.57532 11.1583 4.7623 10.6666 5.99998 10.6666C6.27492 10.6673 6.54929 10.6918 6.81998 10.74C6.71508 11.163 6.66357 11.5975 6.66665 12.0333C6.66944 13.2316 7.07572 14.3941 7.81998 15.3333ZM5.99998 8.69995C6.59332 8.69995 7.17334 8.52401 7.66669 8.19436C8.16004 7.86472 8.54456 7.39618 8.77162 6.848C8.99868 6.29982 9.05809 5.69662 8.94234 5.11468C8.82658 4.53274 8.54086 3.99819 8.1213 3.57863C7.70174 3.15907 7.16719 2.87335 6.58525 2.7576C6.00331 2.64184 5.40011 2.70125 4.85193 2.92831C4.30375 3.15538 3.83522 3.53989 3.50557 4.03324C3.17593 4.52659 2.99998 5.10661 2.99998 5.69995C2.9991 6.09416 3.0761 6.48467 3.22655 6.84904C3.377 7.21342 3.59795 7.54448 3.8767 7.82323C4.15545 8.10198 4.48652 8.32293 4.85089 8.47338C5.21526 8.62383 5.60577 8.70083 5.99998 8.69995ZM18 8.69995C18.5933 8.69995 19.1733 8.52401 19.6667 8.19436C20.16 7.86472 20.5446 7.39618 20.7716 6.848C20.9987 6.29982 21.0581 5.69662 20.9423 5.11468C20.8266 4.53274 20.5409 3.99819 20.1213 3.57863C19.7017 3.15907 19.1672 2.87335 18.5853 2.7576C18.0033 2.64184 17.4001 2.70125 16.8519 2.92831C16.3038 3.15538 15.8352 3.53989 15.5056 4.03324C15.1759 4.52659 15 5.10661 15 5.69995C14.9991 6.09416 15.0761 6.48467 15.2266 6.84904C15.377 7.21342 15.5979 7.54448 15.8767 7.82323C16.1554 8.10198 16.4865 8.32293 16.8509 8.47338C17.2153 8.62383 17.6058 8.70083 18 8.69995ZM21.3333 12.0666C20.896 11.6293 20.3761 11.2833 19.8038 11.0487C19.2316 10.814 18.6184 10.6955 18 10.7C17.725 10.7006 17.4507 10.7251 17.18 10.7733C17.2822 11.1855 17.3336 11.6086 17.3333 12.0333C17.338 13.243 16.9313 14.4185 16.18 15.3666C17.7651 16.4631 18.8547 18.1396 19.2133 20.0333H22.6666V15.3666C22.6756 14.1337 22.1963 12.9473 21.3333 12.0666Z" fill="currentColor"></path>'
                + '<path d="M12 14.7C12.5274 14.7 13.043 14.5436 13.4815 14.2506C13.92 13.9576 14.2618 13.5411 14.4637 13.0539C14.6655 12.5666 14.7183 12.0304 14.6154 11.5131C14.5125 10.9958 14.2585 10.5207 13.8856 10.1477C13.5127 9.77481 13.0375 9.52083 12.5202 9.41794C12.0029 9.31505 11.4668 9.36785 10.9795 9.56969C10.4922 9.77152 10.0757 10.1133 9.78273 10.5518C9.48971 10.9904 9.33331 11.5059 9.33331 12.0334C9.33331 12.7406 9.61426 13.4189 10.1144 13.919C10.6145 14.4191 11.2927 14.7 12 14.7ZM12 16.7C10.7623 16.7 9.57532 17.1917 8.70015 18.0669C7.82498 18.942 7.33331 20.129 7.33331 21.3667H16.6666C16.6666 20.129 16.175 18.942 15.2998 18.0669C14.4246 17.1917 13.2377 16.7 12 16.7Z" fill="currentColor"></path>'
                + '</svg></span>我的家庭库';
            ddItem.addEventListener('click', function(e){
                e.preventDefault();
                e.stopPropagation();
                var dd = document.getElementById('account_dropdown');
                if (dd) dd.style.display = 'none'; // 关闭下拉菜单
                btnonclick();
            });
            // 插入到"退出帐户"之前（多语言匹配：退出/退出帐户/log out/Sign out/Abmelden）
            var logoutLink = null;
            menuBody.querySelectorAll('a.popup_menu_item').forEach(function(a){
                if (!logoutLink) {
                    var href = a.getAttribute('href') || '';
                    var text = a.textContent || '';
                    if (href.indexOf('Logout') >= 0 || text.indexOf('退出') >= 0
                        || /log\s*out/i.test(text) || /sign\s*out/i.test(text)
                        || text.indexOf('Log off') >= 0) {
                        logoutLink = a;
                    }
                }
            });
            if (logoutLink) menuBody.insertBefore(ddItem, logoutLink);
            else menuBody.appendChild(ddItem);
        }
        function btnonclick(){
            let totalGames = saves.familyGameList.GameList.length;
            let memberCount = saves.familyInfo.family_member.length;
            let avgGames = totalGames > 0 && memberCount > 0 ? Math.round(totalGames / memberCount) : 0;
            let singleOwnerCount = 0;
            for (let key in saves.familyGameList.GameInfo) {
                if (saves.familyGameList.GameInfo[key].owners.length === 1) singleOwnerCount++;
            }
            // v1.38 新增统计指标
            let recent30Count = 0, multiOwnerCount = 0;
            let nowSec = Date.now() / 1000;
            for (let key in saves.familyGameList.GameInfo) {
                let gi = saves.familyGameList.GameInfo[key];
                if (gi.owners && gi.owners.length > 1) multiOwnerCount++;
                if (gi.time && (nowSec - gi.time) < 2592000) recent30Count++;
            }
            let familyGroupId = saves.familyInfo.family_groupid || 'unknown';
            let familyName = saves.familyInfo.family_name || '未知家庭';

            // ===================== 自定义浮窗面板 =====================
            if (document.getElementById('familyAnalysisPanel')) {
                document.getElementById('familyAnalysisPanel').remove();
            }

            const panel = document.createElement('div');
            panel.id = 'familyAnalysisPanel';
            panel.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;display:flex;align-items:center;justify-content:center;';
            const activeTabKey = '__familyActiveTab';
            window[activeTabKey] = window[activeTabKey] || 'contribution';

            const showTab = (tabId) => {
                window[activeTabKey] = tabId;
                panel.querySelectorAll('[data-fa-tab]').forEach(t => { t.style.display = t.getAttribute('data-fa-tab') === tabId ? '' : 'none'; });
                panel.querySelectorAll('[data-fa-nav]').forEach(b => {
                    const isActive = b.getAttribute('data-fa-nav') === tabId;
                    b.style.background = isActive ? 'rgba(6,207,190,0.2)' : 'transparent';
                    b.style.color = isActive ? '#06cfbe' : '#8097a8';
                });
                if (tabId === 'contribution') {
                    // v1.75：切换到贡献分布标签页时，重置"我的贡献"覆盖层（隐藏覆盖层、恢复默认视图）
                    var mcOverlay = panel.querySelector('[data-my-contrib-overlay]');
                    var mcDefault = panel.querySelector('[data-contrib-default]');
                    if (mcOverlay) { mcOverlay.style.display = 'none'; mcOverlay.innerHTML = ''; }
                    // v1.78：同步重置"共享分布详情"覆盖层
                    var sdOverlay = panel.querySelector('[data-share-detail-overlay]');
                    if (sdOverlay) { sdOverlay.style.display = 'none'; sdOverlay.innerHTML = ''; }
                    if (mcDefault) { mcDefault.style.display = ''; }
                    if (!document.getElementById('Family_countChart')) {
                        const chartWrap = panel.querySelector('[data-chart-bar-card]');
                        if (chartWrap) { const cv = document.createElement('canvas'); cv.id = 'Family_countChart'; cv.width = 560; cv.height = 460; cv.style.cssText = 'display:block;box-sizing:border-box;height:460px;width:560px;max-width:100%;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.2))'; chartWrap.appendChild(cv); }
                    }
                    observer_5();
                    renderContributionExtras();
                }
                // v1.71：价值洞察标签页渲染
                // v1.81: 渐进式渲染 — 已有缓存先恢复 innerHTML,后台异步调用原始 render(可能命中缓存无重算)
                if (tabId === 'value') { _faProgressiveRender('value', panel, '[data-value-content]', renderValueInsightsTab); }
                if (tabId === 'growth') { _faProgressiveRender('growth', panel, '[data-growth-content]', renderGrowthTab); }
                if (tabId === 'playactivity') { _faProgressiveRender('playactivity', panel, '[data-play-content]', renderPlayActivityTab); }
                if (tabId === 'heatmap') { _faProgressiveRender('heatmap', panel, '[data-heatmap-content]', renderHeatmapTab); }
                if (tabId === 'insights') { _faProgressiveRender('insights', panel, '[data-insights-content]', renderMemberInsightsTab); }
                if (tabId === 'wishlist') { _faProgressiveRender('wishlist', panel, '[data-wishlist-content]', renderWishlistTab); }
                // v1.62 新增：共享冷却标签页渲染
                if (tabId === 'cooldown') { renderCooldownTab(); }
            };

            // v1.81: 渐进式渲染包装 —— 已有缓存直接恢复 HTML,后台异步调用原始 render(可能命中 faPCC/faComputedCache 0 ms)
            // 切 tab 不再等"重计算 + 重 DOM 构造",旧 HTML 立即显示,新数据后到时再 patch
            function _faProgressiveRender(tabId, panel, contentSelector, renderFn) {
                var content = panel && panel.querySelector ? panel.querySelector(contentSelector) : null;
                var cached = faRenderedTabs.get(tabId);
                if (cached && content && cached.html) {
                    // 命中:立即恢复 HTML(用户 0 ms 看到)
                    try { content.innerHTML = cached.html; } catch (e) {}
                    // 后台异步调原始 render(走 IDB 缓存,通常 0 ms 完成,触发 DOM 事件重绑)
                    // setTimeout 0 让出主线程,避免阻塞 tab 切换
                    setTimeout(function() { try { renderFn(); } catch (e) { console.warn('[FA] progressive render failed:', tabId, e); } }, 0);
                } else {
                    // 首次访问:正常 render
                    try { renderFn(); } catch (e) { console.warn('[FA] render failed:', tabId, e); }
                }
                // 拦截下次:在原始 render 后保存 innerHTML — 这里没法直接 hook,所以用 MutationObserver 兜底
                if (content && typeof MutationObserver !== 'undefined' && !content._faRenderObs) {
                    var _obs = new MutationObserver(function() {
                        faRenderedTabs.save(tabId, content.innerHTML, String(Date.now()));
                    });
                    _obs.observe(content, { childList: true, subtree: true, characterData: true });
                    content._faRenderObs = _obs;
                }
            }

            // v1.66：集中管理 SVG 图标（参考 steam-friend-manager ICONS 模式）
            const FA_ICONS = {
                barChart: '<svg viewBox="0 0 24 24" width="14" height="14" fill="#8097a8"><rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>',
                trending: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#8097a8" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
                insights: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#8097a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M19 9a5 5 0 0 0-9-3"/><circle cx="9" cy="14" r="1.5" fill="#8097a8"/></svg>',
                activity: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#8097a8" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
                gamepad: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#8097a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="6"/></svg>',
                grid: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#8097a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
                heart: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#8097a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
                clock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#8097a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 15 15"/><path d="M9 2h6"/></svg>',
                spinner: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#06cfbe" stroke-width="2" style="animation:fa-spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
                refresh: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
                // v1.71：价值洞察图标（¥ 符号在圆形底盘中）
                coin: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#8097a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 7l4 5 4-5M9 12h6M9 15h6M12 12v6"/></svg>'
            };
            const tabDefs = [
                { id: 'contribution', icon: FA_ICONS.barChart, label: '贡献分布' },
                { id: 'growth', icon: FA_ICONS.trending, label: '增长趋势' },
                // v1.71：价值洞察标签页（参考 html-demo/family-price-value 原型设计）
                // v1.74：移至增长趋势之后、成员洞察之前（数量维度→价值维度→成员维度）
                { id: 'value', icon: FA_ICONS.coin, label: '价值洞察' },
                { id: 'insights', icon: FA_ICONS.insights, label: '成员洞察' },
                { id: 'activity', icon: FA_ICONS.activity, label: '购买动态' },
                { id: 'playactivity', icon: FA_ICONS.gamepad, label: '游玩动态' },
                { id: 'heatmap', icon: FA_ICONS.grid, label: '入库热力图' },
                { id: 'wishlist', icon: FA_ICONS.heart, label: '家庭愿望单' },
                // v1.62 新增：共享冷却标签页（参考 sffxzzp Family Sharing Cooldown 追踪模式）
                { id: 'cooldown', icon: FA_ICONS.clock, label: '共享冷却' }
            ];

            // 按月聚合数据（增长趋势用）
            const growthGames = Object.entries(saves.familyGameList.GameInfo)
                .map(([appid, info]) => ({ appid: Number(appid), time: info.time, owners: info.owners }))
                .filter(g => g.time > 0)
                .sort((a, b) => a.time - b.time);
            const monthlyMap = new Map();
            growthGames.forEach(g => {
                const d = new Date(g.time * 1000);
                const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                if (!monthlyMap.has(key)) monthlyMap.set(key, { all: 0, members: {} });
                const entry = monthlyMap.get(key);
                entry.all++;
                g.owners.forEach(sid => { entry.members[sid] = (entry.members[sid] || 0) + 1; });
            });
            const growthSorted = [...monthlyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

            // 分页游戏列表
            const pageSize = 30;
            let totalPages = Math.ceil(totalGames / pageSize);
            let currentPage = 1;
            // v1.56：购买动态视图模式（'table' | 'cover'），持久化到 GM 存储
            const FA_ACT_VIEW_KEY = 'faActViewMode';
            let actViewMode = GM_getValue(FA_ACT_VIEW_KEY, 'table');
            if (actViewMode !== 'cover') actViewMode = 'table'; // 白名单校验
            // v1.64：购买动态成员筛选（空=全部）
            let actFilterSid = '';
            // v1.77：贡献分布图统计范围（'all'=累计总量（默认） | 'halfyear'=近半年入库量）
            // 每次打开面板默认展示累计总量，不做持久化
            let contribRangeMode = 'all';
            // v1.79：共享分布详情游戏列表分页（每页13条）
            let shareDetailPage = 1;
            // v1.99：我的独占贡献列表分页（每页20条）
            let myExclusivePage = 1;
            // v1.77：累计总量/近半年切换按钮 HTML（位于贡献分布仪表卡片右上角）
            const contribRangeBtnHtml = function() {
                const btn = (mode, label, title) => {
                    const on = contribRangeMode === mode;
                    return '<button data-contrib-range="' + mode + '" title="' + title + '" style="border:none;border-radius:5px;padding:3px 10px;font-size:11px;font-weight:600;line-height:1.5;cursor:pointer;white-space:nowrap;transition:color 0.2s,background 0.2s;'
                        + (on ? 'background:rgba(6,207,190,0.2);color:#06cfbe;' : 'background:transparent;color:#8097a8;') + '">' + label + '</button>';
                };
                return btn('all', '累计总量', '统计全部历史入库游戏的成员贡献') + btn('halfyear', '近半年', '仅统计近6个月入库游戏的成员贡献');
            };
            // 获取筛选后的游戏列表（按购买者=owners末位筛选）
            function getActivityFilteredGames() {
                var all = saves.familyGameList.GameList;
                if (!actFilterSid) return all;
                return all.filter(function(appid) {
                    var gi = saves.familyGameList.GameInfo[appid];
                    return gi && gi.owners && gi.owners.length > 0 && gi.owners[gi.owners.length - 1] == actFilterSid;
                });
            }
            // v1.64：成员筛选下拉框 HTML
            function actFilterHtml() {
                var members = saves.familyInfo.family_member || [];
                var opts = '<option value=""' + (!actFilterSid ? ' selected' : '') + '>全部成员</option>';
                members.forEach(function(m) {
                    var name = m.userName || (saves.familyInfo.steamIdtoName ? saves.familyInfo.steamIdtoName[m.steamid] : '') || ('ID:' + String(m.steamid).slice(-4));
                    var sel = (actFilterSid == m.steamid) ? ' selected' : '';
                    opts += '<option value="' + m.steamid + '"' + sel + '>' + faEsc(name) + '</option>';
                });
                return '<div class="fa-act-filter"><span style="font-size:11px;color:#8097a8;white-space:nowrap;">购买者</span><select data-act-filter>' + opts + '</select></div>';
            }

            // v1.56：视图切换工具栏 HTML（列表视图 / 封面视图）
            const actViewToggleHtml = function() {
                var isTable = actViewMode === 'table';
                return '<div class="fa-act-view-toggle">'
                    + '<button class="fa-act-view-btn' + (isTable ? ' active' : '') + '" data-act-view="table" title="列表视图">'
                    +   '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>'
                    +   '<span>列表</span>'
                    + '</button>'
                    + '<button class="fa-act-view-btn' + (!isTable ? ' active' : '') + '" data-act-view="cover" title="封面视图">'
                    +   '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'
                    +   '<span>封面</span>'
                    + '</button>'
                    + '</div>';
            };

            // 分页按钮 HTML（复用全局 fa-wl-pgbtn 类 + fa-btn-md 尺寸变体）
            const pageNavHtml = (pg, tp) => {
                const pb = (page, label, disabled) => '<button class="fa-wl-pgbtn fa-btn-md" data-page="' + page + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
                return '<div style="display:flex;gap:4px;">'
                    + pb(1, '首页', pg === 1)
                    + pb(pg - 1, '上一页', pg <= 1)
                    + pb(pg + 1, '下一页', pg >= tp)
                    + pb(tp, '末页', pg === tp)
                    + '</div>';
            };

            // v1.56：封面视图渲染（参考 steam-friend-manager buildRecentGameCard + sfd-pl-recent-grid）
            // v1.64：精简封面卡片信息，仅保留游戏名称、购买时间和购买人名称
            function renderActivityCoverPage(pageGames, start, end, page) {
                var cards = '';
                pageGames.forEach((appid, index) => {
                    var gameInfo = saves.familyGameList.GameInfo[appid];
                    var isNew = saves.lastupDateTime - gameInfo.time < 2592000 && gameInfo.owners.length == 1;
                    var buyerName = saves.familyInfo.steamIdtoName[gameInfo.owners.at(-1)] || '';
                    // v1.56：封面视图统一使用 faLoadCover 多 CDN fallback 加载大封面图，保证清晰度
                    var capImgHtml = '<img data-fa-cover="' + appid + '" loading="lazy" src="' + FA_COVER_SVG + '" class="fa-act-cover-cap">';
                    cards += '<div class="fa-act-cover-card' + (isNew ? ' is-new' : '') + '">'
                        + '<div class="fa-act-cover-cap-wrap" onclick="window.open(\'https://store.steampowered.com/app/' + appid + '\',\'_blank\')">'
                        + capImgHtml
                        + (isNew ? '<span class="fa-act-cover-new-badge">NEW</span>' : '')
                        + '</div>'
                        + '<div class="fa-act-cover-info">'
                        + '<a data-fa-appid="' + appid + '" href="https://store.steampowered.com/app/' + appid + '" target="_blank" class="fa-act-cover-name">' + faEsc(gameInfo.name) + '</a>'
                        + '<div class="fa-act-cover-meta">'
                        + '<span>' + timestampToTime(gameInfo.time) + '</span>'
                        + '<span class="fa-act-cover-buyer">' + faEsc(buyerName) + '</span>'
                        + '</div>'
                        + '</div>'
                        + '</div>';
                });
                return '<div class="fa-act-cover-grid">' + cards + '</div>';
            }

            // v1.56：列表视图渲染（原 renderActivityPage 表格逻辑）
            function renderActivityTablePage(pageGames, start) {
                let rows = '';
                pageGames.forEach((appid, index) => {
                    let gameInfo = saves.familyGameList.GameInfo[appid];
                    let isNew = saves.lastupDateTime - gameInfo.time < 2592000 && gameInfo.owners.length == 1;
                    let actualIndex = start + index;
                    let rowBg = isNew ? 'rgba(6,207,190,0.08)' : (actualIndex % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent');
                    let ownerList = gameInfo.owners.map(sid => saves.familyInfo.steamIdtoName[sid] || sid).join(', ');
                    rows += '<tr style="background:' + rowBg + ';border-bottom:1px solid rgba(255,255,255,0.04);">'
                        + '<td style="padding:6px 12px;text-align:center;vertical-align:middle;">' + (gameInfo.icon_hash
                            ? '<img loading="lazy" src="https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/' + appid + '/' + gameInfo.icon_hash + '.jpg" style="width:36px;height:36px;border-radius:4px;" onerror="this.onerror=null;faLoadCover(this,\'' + appid + '\')">'
                            : '<img data-fa-cover="' + appid + '" loading="lazy" src="' + FA_COVER_SVG + '" style="width:36px;height:36px;border-radius:4px;">'
                        ) + '</td>'
                        + '<td style="padding:8px 12px;vertical-align:middle;"><a data-fa-appid="' + appid + '" href="https://store.steampowered.com/app/' + appid + '" target="_blank" style="color:#c6d4df;text-decoration:none;" onmouseover="this.style.color=\'#06cfbe\'" onmouseout="this.style.color=\'#c6d4df\'">' + faEsc(gameInfo.name) + '</a>'
                        + (isNew ? '<span style="display:inline-block;background:#06cfbe30;color:#06cfbe;font-size:10px;padding:1px 6px;border-radius:3px;margin-left:6px;">NEW</span>' : '')
                        + '</td>'
                        + '<td style="padding:8px 12px;text-align:center;vertical-align:middle;color:#8097a8;">' + timestampToTime(gameInfo.time) + '</td>'
                        + '<td style="padding:8px 12px;text-align:center;vertical-align:middle;color:#c6d4df;">' + saves.familyInfo.steamIdtoName[gameInfo.owners.at(-1)] + '</td>'
                        + '<td style="padding:8px 12px;text-align:center;vertical-align:middle;color:#8097a8;font-size:11px;" title="' + ownerList + '">' + gameInfo.owners.length + '</td>'
                        + '</tr>';
                });
                return '<table style="width:100%;border-collapse:collapse;font-size:13px;background:#0e1824;border-radius:6px;overflow:hidden;">'
                    + '<thead><tr style="background:linear-gradient(180deg, #1a3a4a 0%, #132738 100%);">'
                    + '<th style="padding:10px 12px;text-align:left;color:#c6d4df;font-weight:500;width:54px;"></th>'
                    + '<th style="padding:10px 12px;text-align:left;color:#c6d4df;font-weight:500;">游戏名称</th>'
                    + '<th style="padding:10px 12px;text-align:center;color:#c6d4df;font-weight:500;width:180px;">购入时间</th>'
                    + '<th style="padding:10px 12px;text-align:center;color:#c6d4df;font-weight:500;width:120px;">购买者</th>'
                    + '<th style="padding:10px 12px;text-align:center;color:#c6d4df;font-weight:500;width:70px;">拥有者</th>'
                    + '</tr></thead><tbody>' + rows + '</tbody></table>';
            }

            function renderActivityPage(page) {
                if (page < 1) page = 1;
                // v1.64：使用筛选后的游戏列表计算分页
                var filteredGames = getActivityFilteredGames();
                var filteredTotal = filteredGames.length;
                var filteredPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
                if (page > filteredPages) page = filteredPages;
                currentPage = page;
                const start = (page - 1) * pageSize;
                const end = Math.min(start + pageSize, filteredTotal);
                const pageGames = filteredGames.slice(start, end);

                // v1.56：根据视图模式选择渲染器
                var contentHtml = actViewMode === 'cover'
                    ? renderActivityCoverPage(pageGames, start, end, page)
                    : renderActivityTablePage(pageGames, start);

                const actContent = panel.querySelector('[data-activity-content]');
                if (actContent) {
                    // v1.67：渲染前清理活动内容区内残留的 ds_flag（防御性兜底）
                    // 防止未来 addflag 排除逻辑被绕过时，"在家庭库中"/"家庭共享"标记泄漏到浮窗内
                    actContent.querySelectorAll('div.ds_flag.ds_owned_flag, div.ds_flag.ds_family_share_flag').forEach(function(el){ el.remove(); });
                    actContent.innerHTML = '<div class="fa-act-toolbar">'
                        + '<span style="font-size:13px;color:#8097a8;">共 <b style="color:#c6d4df;">' + filteredTotal + '</b> 个游戏 | 第 <b style="color:#06cfbe;">' + page + '/' + filteredPages + '</b> 页 (' + (start + 1) + '-' + end + ')</span>'
                        + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
                        + actFilterHtml()
                        + actViewToggleHtml()
                        + pageNavHtml(page, filteredPages)
                        + '</div>'
                        + '</div>'
                        + contentHtml
                        + '<div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">'
                        + '<span style="font-size:11px;color:#64748b;">绿色高亮 + NEW = 近30日新入库的独占贡献</span>'
                        + pageNavHtml(page, filteredPages)
                        + '</div>';
                    // v1.64：成员筛选下拉框事件
                    actContent.querySelectorAll('select[data-act-filter]').forEach(function(sel) {
                        sel.addEventListener('change', function() {
                            actFilterSid = this.value;
                            renderActivityPage(1);
                        });
                    });
                    // 分页按钮事件
                    actContent.querySelectorAll('button[data-page]').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            var newPage = parseInt(this.getAttribute('data-page'));
                            if (newPage >= 1 && newPage <= filteredPages) renderActivityPage(newPage);
                        });
                    });
                    // v1.56：视图切换按钮事件
                    actContent.querySelectorAll('button[data-act-view]').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            var newMode = this.getAttribute('data-act-view');
                            if (newMode === actViewMode) return;
                            actViewMode = newMode;
                            GM_setValue(FA_ACT_VIEW_KEY, newMode);
                            renderActivityPage(currentPage);
                        });
                    });
                    // 异步加载游戏中文名（参考 steam-friend-manager loadGameZhName）
                    actContent.querySelectorAll('a[data-fa-appid]').forEach(function(el) {
                        var aid = el.getAttribute('data-fa-appid');
                        var gi = saves.familyGameList.GameInfo[aid];
                        if (gi && gi.name) faLoadGameZhName(el, aid, gi.name);
                    });
                    // v1.55：无 icon_hash 的游戏使用多 CDN 封面 fallback
                    actContent.querySelectorAll('img[data-fa-cover]').forEach(function(img) {
                        faLoadCover(img, img.getAttribute('data-fa-cover'));
                    });
                }
            }

            // ===================== 增长趋势渲染 =====================
            const growthColors = ['#06cfbe', '#54a0ff', '#ff9f43', '#2ed573', '#ff6b6b', '#a29bfe', '#ffcd56'];
            function renderGrowthTab() {
                const gWrap = panel.querySelector('[data-growth-content]');
                if (!gWrap || growthGames.length === 0) {
                    if (gWrap) gWrap.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#8097a8;font-size:13px;">暂无增长趋势数据</div>';
                    return;
                }
                const months = growthSorted.map(x => x[0]);
                const members = saves.familyInfo.family_member;
                const cumAll = [], cumMembers = {};
                members.forEach(m => { cumMembers[m.steamid] = []; });
                let totalAll = 0;
                const totalMembers = {};
                members.forEach(m => { totalMembers[m.steamid] = 0; });
                growthSorted.forEach(([_, entry]) => {
                    totalAll += entry.all;
                    cumAll.push(totalAll);
                    members.forEach(m => {
                        totalMembers[m.steamid] += (entry.members[m.steamid] || 0);
                        cumMembers[m.steamid].push(totalMembers[m.steamid]);
                    });
                });
                let maxVal = cumAll[cumAll.length - 1] || 1;
                members.forEach(m => {
                    const last = cumMembers[m.steamid][cumMembers[m.steamid].length - 1] || 0;
                    if (last > maxVal) maxVal = last;
                });
                const svgW = 600, svgH = 360, pL = 50, pR = 20, pT = 20, pB = 50;
                const cW = svgW - pL - pR, cH = svgH - pT - pB;
                const step = cW / (months.length - 1 || 1);
                let grid = '';
                for (let i = 0; i <= 5; i++) {
                    const v = Math.round(maxVal / 5 * i), y = pT + cH - (cH * i / 5);
                    grid += '<line x1="' + pL + '" y1="' + y + '" x2="' + (svgW - pR) + '" y2="' + y + '" stroke="rgba(255,255,255,.08)"/>';
                    grid += '<text x="' + (pL - 8) + '" y="' + (y + 4) + '" text-anchor="end" fill="#8a9ba8" font-size="11">' + v + '</text>';
                }
                const totalPoints = cumAll.map((val, i) => (pL + i * step) + ',' + (pT + cH - (val / maxVal) * cH)).join(' ');
                let lines = '<polyline points="' + totalPoints + '" fill="none" stroke="#8a9ba8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6 3"/>';
                // v1.66：成员对比线增加数据点标记 + 唯一 class 便于交互高亮
                members.forEach((m, mi) => {
                    const c = growthColors[mi % growthColors.length];
                    const pts = cumMembers[m.steamid].map((val, i) => (pL + i * step) + ',' + (pT + cH - (val / maxVal) * cH)).join(' ');
                    lines += '<polyline class="fa-growth-line" data-mi="' + mi + '" points="' + pts + '" fill="none" stroke="' + c + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".7" style="transition:opacity .2s,stroke-width .2s"/>';
                    // 数据点圆点
                    cumMembers[m.steamid].forEach((val, i) => {
                        if (val > 0) {
                            const cx = pL + i * step, cy = pT + cH - (val / maxVal) * cH;
                            lines += '<circle class="fa-growth-dot" data-mi="' + mi + '" cx="' + cx + '" cy="' + cy + '" r="2.5" fill="' + c + '" opacity=".7" style="transition:opacity .2s,r .2s"/>';
                        }
                    });
                });
                let xLabels = '', lastYear = '';
                months.forEach((m, i) => {
                    const year = m.split('-')[0];
                    if (year !== lastYear) {
                        xLabels += '<text x="' + (pL + i * step) + '" y="' + (pT + cH + 18) + '" text-anchor="middle" fill="#8a9ba8" font-size="11">' + year + '</text>';
                        lastYear = year;
                    }
                });
                const svgStr = '<svg width="100%" height="100%" viewBox="0 0 ' + svgW + ' ' + svgH + '" preserveAspectRatio="xMidYMid meet">' + grid + lines + xLabels + '<line x1="' + pL + '" y1="' + (pT + cH) + '" x2="' + (svgW - pR) + '" y2="' + (pT + cH) + '" stroke="rgba(255,255,255,.15)"/></svg>';
                let legendItems = ['<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#8a9ba8"><span style="width:18px;height:1.5px;border-top:1.5px dashed #8a9ba8;display:inline-block"></span>总计</span>'];
                members.forEach((m, mi) => {
                    const c = growthColors[mi % growthColors.length];
                    legendItems.push('<span class="fa-growth-legend" data-mi="' + mi + '" style="display:flex;align-items:center;gap:5px;font-size:11px;color:#94a3b8;cursor:pointer;padding:2px 6px;border-radius:4px;transition:background .2s" onmouseover="this.style.background=\'rgba(255,255,255,.06)\'" onmouseout="this.style.background=\'transparent\'"><span style="width:18px;height:2px;border-radius:2px;background:' + c + ';display:inline-block;opacity:.7"></span>' + m.userName + '</span>');
                });
                const legendHtml = '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(102,192,244,0.12)">' + legendItems.join('') + '</div>';
                // v1.66：成员对比摘要 — 贡献最多 / 最少 / 平均
                var memberTotals = members.map(function(m) {
                    var last = cumMembers[m.steamid][cumMembers[m.steamid].length - 1] || 0;
                    return { name: m.userName, count: last };
                }).sort(function(a, b) { return b.count - a.count; });
                var topM = memberTotals[0] || { name: '-', count: 0 };
                var lowM = memberTotals[memberTotals.length - 1] || { name: '-', count: 0 };
                var avgCnt = memberTotals.length > 0 ? Math.round(memberTotals.reduce(function(s, x) { return s + x.count; }, 0) / memberTotals.length) : 0;
                var compareSummary = '<div style="display:flex;justify-content:center;gap:16px;margin-top:6px;font-size:10px;color:#64748b">'
                    + '<span>贡献最多: <b style="color:#06cfbe">' + faEsc(topM.name) + '</b> (' + topM.count + ')</span>'
                    + '<span>平均: <b style="color:#94a3b8">' + avgCnt + '</b></span>'
                    + '<span>贡献最少: <b style="color:#ff9f43">' + faEsc(lowM.name) + '</b> (' + lowM.count + ')</span>'
                    + '</div>';
                const firstDate = new Date(growthGames[0].time * 1000);
                const lastDate = new Date(growthGames[growthGames.length - 1].time * 1000);
                const fmtD = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                const summary = '<div style="display:flex;justify-content:space-around;margin-top:8px;font-size:11px;color:#94a3b8">'
                    + '<span>总计: ' + growthGames.length + '</span>'
                    + '<span>首条: ' + fmtD(firstDate) + '</span>'
                    + '<span>最新: ' + fmtD(lastDate) + '</span>'
                    + '<span>月份数: ' + months.length + '</span>'
                    + '</div>';
                // v1.45：近90天入库对比（右栏）。成员入库数按 owners 归属统计（多人共有的游戏计入各拥有者）
                const nowSec = Date.now() / 1000;
                const D90 = 90 * 86400;
                const cur90Cnt = {};
                members.forEach(m => { cur90Cnt[m.steamid] = 0; });
                let cur90Total = 0, prev90Total = 0;
                growthGames.forEach(g => {
                    if (g.time >= nowSec - D90) {
                        cur90Total++;
                        g.owners.forEach(sid => { if (cur90Cnt[sid] !== undefined) cur90Cnt[sid]++; });
                    } else if (g.time >= nowSec - 2 * D90) {
                        prev90Total++;
                    }
                });
                const max90 = Math.max(1, ...members.map(m => cur90Cnt[m.steamid]));
                let bars90 = '';
                members.forEach((m, mi) => {
                    const c = growthColors[mi % growthColors.length];
                    const v = cur90Cnt[m.steamid];
                    const wPct = Math.round(v / max90 * 100);
                    // v1.58：成员名称前增加首字头像（唯一背景色区分用户）
                    var avatarHtml = faNameAvatarHtml(m.userName, 16, 'margin-right:5px;');
                    // v1.69：数值颜色与饼状图扇区保持一致，零贡献使用灰色
                    bars90 += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:6px;" title="' + faEsc(m.userName) + ' 近90天入库 ' + v + ' 个">'
                        + avatarHtml
                        + '<span style="width:42px;font-size:11px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;">' + faEsc(m.userName) + '</span>'
                        + '<div style="flex:1;height:13px;background:rgba(255,255,255,0.04);border-radius:3px;overflow:hidden;min-width:30px;">'
                        + '<div style="width:' + (v > 0 ? Math.max(wPct, 5) : 0) + '%;height:100%;background:linear-gradient(90deg,' + c + '80,' + c + ');border-radius:3px;transition:width 0.4s;"></div></div>'
                        + '<span style="width:22px;text-align:right;font-size:11px;color:' + (v > 0 ? c : '#64748b') + ';font-weight:600;flex-shrink:0;">' + v + '</span>'
                        + '</div>';
                });
                const diff90 = cur90Total - prev90Total;
                const diff90Text = diff90 > 0 ? '+' + diff90 : String(diff90);
                const diff90Color = diff90 > 0 ? '#2ed573' : (diff90 < 0 ? '#ff6b6b' : '#8a9ba8');
                // v1.69：近90天成员入库对比饼状图（环形图，中心显示总数，置于 KPI 卡片上方）
                const d90R = 50, d90SW = 18, d90Circ = 2 * Math.PI * d90R;
                let d90Acc = 0, d90Arcs = '';
                const d90Sum = cur90Total || 1;
                members.forEach((m, mi) => {
                    const c = growthColors[mi % growthColors.length];
                    const v = cur90Cnt[m.steamid];
                    const frac = v / d90Sum;
                    const len = frac * d90Circ;
                    if (len > 0.01) {
                        d90Arcs += '<circle cx="70" cy="70" r="' + d90R + '" fill="none" stroke="' + c + '" stroke-width="' + d90SW + '"'
                            + ' stroke-dasharray="' + len.toFixed(2) + ' ' + (d90Circ - len).toFixed(2) + '" stroke-dashoffset="' + (-d90Acc).toFixed(2) + '"'
                            + ' transform="rotate(-90 70 70)" opacity="0.92">'
                            + '<title>' + faEsc(m.userName) + ': ' + v + ' 个 (' + (frac * 100).toFixed(1) + '%)</title></circle>';
                    }
                    d90Acc += len;
                });
                const donut90Html = '<div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.06);">'
                    + '<div style="font-size:10px;color:#64748b;margin-bottom:6px;text-align:center;">成员入库占比</div>'
                    + '<svg width="140" height="140" viewBox="0 0 140 140" style="display:block;margin:0 auto;">'
                    + '<circle cx="70" cy="70" r="' + d90R + '" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="' + d90SW + '"/>'
                    + d90Arcs
                    + '<text x="70" y="66" text-anchor="middle" fill="#c7d5e0" font-size="24" font-weight="700">' + cur90Total + '</text>'
                    + '<text x="70" y="84" text-anchor="middle" fill="#8097a8" font-size="9">总入库</text>'
                    + '</svg></div>';
                const d90Html = '<div style="font-size:13px;font-weight:600;color:#c7d5e0;margin-bottom:10px;display:flex;align-items:center;gap:6px;">'
                    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#06cfbe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>'
                    + '近90天入库对比</div>'
                    + donut90Html
                    + '<div style="display:flex;gap:6px;margin-bottom:12px;">'
                    + '<div style="flex:1;background:rgba(6,207,190,0.08);border:1px solid rgba(6,207,190,0.18);border-radius:8px;padding:6px 4px;text-align:center;"><div style="font-size:18px;font-weight:700;color:#06cfbe;line-height:1.2;">' + cur90Total + '</div><div style="font-size:9px;color:#8097a8;margin-top:2px;">近90天</div></div>'
                    + '<div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:6px 4px;text-align:center;"><div style="font-size:18px;font-weight:700;color:#8a9ba8;line-height:1.2;">' + prev90Total + '</div><div style="font-size:9px;color:#8097a8;margin-top:2px;">前90天</div></div>'
                    + '<div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:6px 4px;text-align:center;"><div style="font-size:18px;font-weight:700;color:' + diff90Color + ';line-height:1.2;">' + diff90Text + '</div><div style="font-size:9px;color:#8097a8;margin-top:2px;">环比</div></div>'
                    + '</div>'
                    + '<div style="font-size:10px;color:#64748b;margin-bottom:8px;">各成员近90天入库数</div>'
                    + bars90;
                // v1.58：左侧累计增长曲线（加宽），右侧90天入库对比（收窄给左侧更多空间）
                gWrap.innerHTML = '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;">'
                    + '<div class="fa-card" style="flex:1 1 520px;min-width:0;min-height:200px;">'
                    + '<div style="font-size:14px;font-weight:600;color:#c7d5e0;text-align:center;margin-bottom:8px;">家庭成员游戏累计增长趋势</div>'
                    + svgStr + legendHtml + compareSummary + summary + '</div>'
                    + '<div class="fa-card" style="flex:0 0 200px;min-width:180px;padding:12px 14px;">'
                    + d90Html + '</div>'
                    + '</div>';
                // v1.66：图例交互 — hover 高亮对应成员线，其余变暗
                var legendEls = gWrap.querySelectorAll('.fa-growth-legend');
                legendEls.forEach(function(el) {
                    el.addEventListener('mouseenter', function() {
                        var mi = this.getAttribute('data-mi');
                        gWrap.querySelectorAll('.fa-growth-line, .fa-growth-dot').forEach(function(l) {
                            if (l.getAttribute('data-mi') === mi) {
                                l.style.opacity = '1';
                                if (l.tagName === 'polyline') l.style.strokeWidth = '2.5';
                                if (l.tagName === 'circle') l.setAttribute('r', '3.5');
                            } else {
                                l.style.opacity = '.15';
                            }
                        });
                    });
                    el.addEventListener('mouseleave', function() {
                        gWrap.querySelectorAll('.fa-growth-line').forEach(function(l) { l.style.opacity = '.7'; l.style.strokeWidth = '1.5'; });
                        gWrap.querySelectorAll('.fa-growth-dot').forEach(function(l) { l.style.opacity = '.7'; l.setAttribute('r', '2.5'); });
                    });
                });
            }

            // ===================== 贡献分布右栏渲染（v1.45 新增） =====================
            // 成员贡献占比环形图（SVG donut）+ 近半年入库增量（月度柱状图）
            function renderContributionExtras() {
                const donutWrap = panel.querySelector('[data-member-donut]');
                const hyWrap = panel.querySelector('[data-halfyear-chart]');
                if (!donutWrap && !hyWrap) return;
                const members = saves.familyInfo.family_member || [];
                if (members.length === 0) {
                    const emptyHtml = '<div style="text-align:center;padding:20px;color:#64748b;font-size:12px;">暂无成员数据</div>';
                    if (donutWrap) donutWrap.innerHTML = emptyHtml;
                    if (hyWrap) hyWrap.innerHTML = emptyHtml;
                    return;
                }
                // ---- 成员贡献占比环形图 ----
                if (donutWrap) {
                    const counts = members.map(m => ({ name: m.userName, count: 0 }));
                    const midx = {};
                    members.forEach((m, i) => { midx[m.steamid] = i; });
                    for (let key in saves.familyGameList.GameInfo) {
                        saves.familyGameList.GameInfo[key].owners.forEach(sid => {
                            if (midx[sid] !== undefined) counts[midx[sid]].count++;
                        });
                    }
                    const sum = counts.reduce((a, c) => a + c.count, 0) || 1;
                    const R = 52, SW = 20, CIRC = 2 * Math.PI * R;
                    let acc = 0, arcs = '';
                    counts.forEach((c, i) => {
                        const frac = c.count / sum;
                        const len = frac * CIRC;
                        const col = growthColors[i % growthColors.length];
                        if (len > 0.01) {
                            arcs += '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="' + col + '" stroke-width="' + SW + '"'
                                + ' stroke-dasharray="' + len.toFixed(2) + ' ' + (CIRC - len).toFixed(2) + '" stroke-dashoffset="' + (-acc).toFixed(2) + '"'
                                + ' transform="rotate(-90 70 70)" opacity="0.92">'
                                + '<title>' + faEsc(c.name) + ': ' + c.count + ' 个 (' + (frac * 100).toFixed(1) + '%)</title></circle>';
                        }
                        acc += len;
                    });
                    let legendRows = '';
                    counts.forEach((c, i) => {
                        const col = growthColors[i % growthColors.length];
                        const pct = (c.count / sum * 100).toFixed(1);
                        legendRows += '<div style="display:flex;align-items:center;gap:5px;font-size:10px;padding:1px 0;" title="' + faEsc(c.name) + ' 持有 ' + c.count + ' 个游戏">'
                            + '<span style="width:8px;height:8px;border-radius:50%;background:' + col + ';flex-shrink:0;box-shadow:0 0 4px ' + col + '60;"></span>'
                            + '<span style="color:#94a3b8;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + faEsc(c.name) + '</span>'
                            + '<span style="color:#c7d5e0;font-weight:600;">' + c.count + '</span>'
                            + '<span style="color:#64748b;width:40px;text-align:right;flex-shrink:0;">' + pct + '%</span>'
                            + '</div>';
                    });
                    // v1.49：环形图左右居中，图例移至图形底部
                    // v1.58：flex 布局上顶均匀分布，图例区可滚动适配 6+ 成员
                    donutWrap.innerHTML = '<div style="font-size:13px;font-weight:600;color:#c7d5e0;margin-bottom:6px;display:flex;align-items:center;gap:6px;flex-shrink:0;">'
                        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#06cfbe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>'
                        + '成员贡献占比</div>'
                        + '<div style="display:flex;justify-content:center;margin-bottom:6px;flex-shrink:0;">'
                        + '<svg width="100" height="100" viewBox="0 0 140 140">' + arcs
                        + '<text x="70" y="66" text-anchor="middle" fill="#c7d5e0" font-size="20" font-weight="700">' + members.length + '</text>'
                        + '<text x="70" y="85" text-anchor="middle" fill="#64748b" font-size="10">名成员</text></svg>'
                        + '</div>'
                        + '<div class="fa-contrib-member-legend" style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;">' + legendRows + '</div>';
                }
                // ---- 近半年入库增量（最近 6 个自然月，含当月） ----
                if (hyWrap) {
                    const now = new Date();
                    const halfData = [];
                    for (let i = 5; i >= 0; i--) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                        const entry = monthlyMap.get(key);
                        halfData.push({ label: String(d.getMonth() + 1) + '月', count: entry ? entry.all : 0, isCur: i === 0 });
                    }
                    const hyTotal = halfData.reduce((a, b) => a + b.count, 0);
                    const hyMax = Math.max(1, ...halfData.map(h => h.count));
                    let bars = '';
                    halfData.forEach(h => {
                        const hPct = Math.round(h.count / hyMax * 100);
                        const col = h.isCur ? '#06cfbe' : '#54a0ff';
                        bars += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;height:100%;" title="' + h.label + '入库 ' + h.count + ' 个">'
                            + '<span style="font-size:10px;color:' + (h.isCur ? '#06cfbe' : '#8a9ba8') + ';font-weight:' + (h.isCur ? '700' : '500') + ';">' + h.count + '</span>'
                            + '<div style="width:62%;max-width:26px;min-height:2px;height:' + Math.max(hPct, 2) + '%;background:linear-gradient(180deg,' + col + ' 0%,' + col + '50 100%);border-radius:3px 3px 0 0;' + (h.isCur ? 'box-shadow:0 0 8px rgba(6,207,190,0.35);' : '') + '"></div>'
                            + '</div>';
                    });
                    let monthLabels = '';
                    halfData.forEach(h => {
                        monthLabels += '<span style="flex:1;text-align:center;font-size:10px;color:' + (h.isCur ? '#06cfbe' : '#64748b') + ';">' + h.label + '</span>';
                    });
                    // v1.58：flex 布局上顶均匀分布，柱状图区域自适应高度
                    hyWrap.innerHTML = '<div style="font-size:13px;font-weight:600;color:#c7d5e0;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">'
                        + '<span style="display:flex;align-items:center;gap:6px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#54a0ff" stroke-width="2" stroke-linecap="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>近半年入库增量</span>'
                        + '<span style="font-size:10px;color:#06cfbe;background:rgba(6,207,190,0.1);padding:1px 8px;border-radius:8px;font-weight:600;">+' + hyTotal + '</span>'
                        + '</div>'
                        + '<div style="display:flex;align-items:flex-end;gap:6px;flex:1;min-height:40px;">' + bars + '</div>'
                        + '<div style="display:flex;gap:6px;margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.08);flex-shrink:0;">' + monthLabels + '</div>';
                }
            }

            var faContributionScrollTop = 0;
            function faRememberContributionScroll() {
                var scroller = panel.querySelector('.fa-panel-content');
                var defaultView = panel.querySelector('[data-contrib-default]');
                if (scroller && defaultView && defaultView.style.display !== 'none') {
                    faContributionScrollTop = scroller.scrollTop || 0;
                }
            }
            function faRestoreContributionScroll() {
                var scroller = panel.querySelector('.fa-panel-content');
                if (!scroller) return;
                requestAnimationFrame(function () { scroller.scrollTop = faContributionScrollTop; });
            }
            function faResetContributionScroll() {
                var scroller = panel.querySelector('.fa-panel-content');
                if (!scroller) return;
                scroller.scrollTop = 0;
                requestAnimationFrame(function () { scroller.scrollTop = 0; });
            }

            // ===================== v1.75：我的贡献覆盖层渲染 =====================
            // 点击左侧"查看我的贡献"按钮后，覆盖贡献分布默认视图，展示个人贡献 KPI + 最近贡献 + 最近游玩
            function renderMyContributionOverlay() {
                var overlay = panel.querySelector('[data-my-contrib-overlay]');
                if (!overlay) return;
                overlay.className = 'fa-contrib-overlay fa-my-contrib-view';
                var defaultView = panel.querySelector('[data-contrib-default]');
                // 显示覆盖层，隐藏默认视图
                faRememberContributionScroll();
                if (defaultView) defaultView.style.display = 'none';
                overlay.style.display = 'flex';
                overlay.style.flexDirection = 'column';
                overlay.style.gap = '12px';

                var mySid = saves.steamid || '';
                var gi = saves.familyGameList.GameInfo;
                var gameList = saves.familyGameList.GameList;
                var members = saves.familyInfo.family_member || [];
                var myGames = [];
                var myExclusive = 0, myShared = 0, myRecent30 = 0;
                var nowSec = Date.now() / 1000, D30 = 30 * 86400;

                // v1.75：DLC 检测——双源（Barter.vg DLC 数据库 + Steam GetItems 类型映射）
                // faIsDlc() 同步检查 faDlcDbData 和 faAppTypeMap，两者均在面板初始化时从缓存同步加载
                var dlcSourceReady = !!(faDlcDbData || faAppTypeMap);
                var myDlcCount = 0;

                for (var i = 0; i < gameList.length; i++) {
                    var aid = gameList[i];
                    var info = gi[aid];
                    if (!info || !info.owners || info.owners.indexOf(mySid) === -1) continue;
                    var isExclusive = info.owners.length === 1;
                    var isRecent = info.time && (nowSec - info.time) < D30;
                    myGames.push({ appid: aid, name: info.name || ('App ' + aid), time: info.time || 0, owners: info.owners, isExclusive: isExclusive });
                    if (isExclusive) myExclusive++; else myShared++;
                    if (isRecent) myRecent30++;
                    // DLC 检测：双源数据就绪时精确检测，未就绪时回退名称启发式
                    if (dlcSourceReady) {
                        if (faIsDlc(aid)) myDlcCount++;
                    } else {
                        var lowerName = (info.name || '').toLowerCase();
                        if (/\b(dlc|soundtrack|season pass|ost|demo|bundle)\b/.test(lowerName)) myDlcCount++;
                    }
                }
                myGames.sort(function(a, b) { return b.time - a.time; });
                var myTotal = myGames.length;
                var myPct = totalGames > 0 ? (myTotal / totalGames * 100).toFixed(1) : '0';

                // 成员贡献排名
                var memberCounts = {};
                members.forEach(function(m) { memberCounts[m.steamid] = 0; });
                for (var mk in gi) {
                    if (gi[mk].owners) {
                        gi[mk].owners.forEach(function(sid) {
                            if (memberCounts[sid] !== undefined) memberCounts[sid]++;
                        });
                    }
                }
                var ranked = members.map(function(m) {
                    return { sid: m.steamid, name: m.userName || (saves.familyInfo.steamIdtoName || {})[m.steamid] || '成员', count: memberCounts[m.steamid] || 0 };
                }).sort(function(a, b) { return b.count - a.count; });
                var myRank = 0;
                for (var ri = 0; ri < ranked.length; ri++) { if (ranked[ri].sid == mySid) { myRank = ri + 1; break; } }

                // ---- 构建 KPI 卡片（参考截图：彩色圆形图标 + 数值 + 标签 + 副标题） ----
                var kpiCards = [
                    { iconType: 'game', label: '贡献游戏总数', value: myTotal, color: '#06cfbe', sub: '占家庭库 ' + myPct + '% · 排名第' + (myRank || '-') + '名' },
                    { iconType: 'exclusive', label: '独占贡献', value: myExclusive, color: '#ff9f43', sub: '仅我拥有' },
                    { iconType: 'shared', label: '共享贡献', value: myShared, color: '#a78bfa', sub: '与他人共有' },
                    { iconType: 'recent', label: '近30日新增', value: myRecent30, color: '#2ed573', sub: myTotal > 0 ? (myRecent30 / myTotal * 100).toFixed(0) + '% 增量' : '暂无新增' },
                    { iconType: 'dlc', label: 'DLC 数量', value: myDlcCount, color: '#ff6b6b', sub: dlcSourceReady ? '双源数据精确' : '名称估算·加载中' }
                ];
                function buildContribKpiIcon(type, color) {
                    var s = ' viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
                    if (type === 'game') return '<svg' + s + '><rect x="2" y="6" width="20" height="12" rx="6"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/></svg>';
                    if (type === 'exclusive') return '<svg' + s + '><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>';
                    if (type === 'shared') return '<svg' + s + '><circle cx="9" cy="7" r="4"/><circle cx="17" cy="9" r="3"/><path d="M3 21a6 6 0 0 1 12 0M14 14a5 5 0 0 1 7 5"/></svg>';
                    if (type === 'recent') return '<svg' + s + '><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';
                    if (type === 'dlc') return '<svg' + s + '><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
                    return '';
                }

                var html = '';
                // 顶部栏：返回按钮 + 标题
                html += '<div class="fa-contrib-overlay-header" style="display:flex;align-items:center;gap:10px;flex-shrink:0;">'
                    + '<button id="faContribBack" style="display:flex;align-items:center;gap:4px;background:rgba(15,23,42,0.6);border:1px solid rgba(6,207,190,0.25);color:#06cfbe;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor=\'rgba(6,207,190,0.5)\';this.style.background=\'rgba(6,207,190,0.1)\'" onmouseout="this.style.borderColor=\'rgba(6,207,190,0.25)\';this.style.background=\'rgba(15,23,42,0.6)\'">'
                    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
                    + '返回</button>'
                    + '<div style="font-size:14px;font-weight:700;color:#c7d5e0;display:flex;align-items:center;gap:6px;">'
                    + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#06cfbe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
                    + '我的贡献概览</div>'
                    + '</div>';

                // KPI 卡片行（5 列，3行布局：图标+数值同行，描述占两行）
                html += '<div class="fa-contrib-overlay-kpis" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;flex-shrink:0;">';
                kpiCards.forEach(function(k) {
                    html += '<div style="background:linear-gradient(135deg,' + k.color + '18 0%,' + k.color + '06 100%);border:1px solid ' + k.color + '25;border-radius:10px;padding:8px 6px;text-align:center;position:relative;overflow:hidden;">'
                        + '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,' + k.color + ',transparent);"></div>'
                        + '<div style="display:flex;align-items:center;justify-content:center;gap:5px;margin-bottom:3px;">' + buildContribKpiIcon(k.iconType, k.color)
                        + '<span style="font-size:18px;font-weight:700;color:' + k.color + ';line-height:1.1;">' + k.value + '</span></div>'
                        + '<div style="font-size:10px;color:#8097a8;">' + k.label + '</div>'
                        + '<div style="font-size:9px;color:#64748b;margin-top:1px;line-height:1.3;">' + k.sub + '</div>'
                        + '</div>';
                });
                html += '</div>';

                // 双列面板：左（最近贡献 + 最近游玩）| 右（我的独占贡献）
                html += '<div class="fa-my-contrib-columns" style="display:flex;gap:12px;flex-wrap:wrap;flex:1;min-height:0;">';

                // ---- 左列容器：最近贡献 + 最近游玩（垂直堆叠）----
                html += '<div class="fa-my-contrib-primary" style="flex:1 1 300px;min-width:260px;display:flex;flex-direction:column;gap:12px;">';

                // ---- 左上：最近贡献 ----
                var recentContrib = myGames.slice(0, 10);
                html += '<div style="flex:0 1 auto;background:rgba(30,41,59,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;box-shadow:0 4px 24px rgba(0,0,0,0.35);display:flex;flex-direction:column;min-height:0;overflow:hidden;">';
                html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-shrink:0;">'
                    + '<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#c7d5e0;">'
                    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#06cfbe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
                    + '最近贡献</div>'
                    + '<span style="font-size:10px;color:#06cfbe;background:rgba(6,207,190,0.1);padding:2px 8px;border-radius:8px;font-weight:600;">' + myTotal + '</span>'
                    + '</div>';
                if (recentContrib.length > 0) {
                    html += '<div class="fa-my-contrib-list" style="flex:1;min-height:0;overflow-y:auto;">';
                    recentContrib.forEach(function(g) {
                        var dateStr = g.time > 0 ? new Date(g.time * 1000).toLocaleDateString('zh-CN') : '未知';
                        var tagColor = g.isExclusive ? '#ff9f43' : '#a78bfa';
                        var tagText = g.isExclusive ? '独占' : g.owners.length + '人共享';
                        html += '<div class="fa-contrib-game-row" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">'
                            + '<a class="fa-contrib-game-link" data-fa-appid="' + g.appid + '" href="https://store.steampowered.com/app/' + g.appid + '" target="_blank" style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;color:inherit;text-decoration:none;" onmouseover="this.querySelector(\'[data-fa-game-name]\').style.color=\'#06cfbe\'" onmouseout="this.querySelector(\'[data-fa-game-name]\').style.color=\'#e2e8f0\'">'
                            + '<img data-fa-cover="' + g.appid + '" loading="lazy" src="' + FA_COVER_SVG + '" style="width:32px;height:32px;border-radius:5px;flex-shrink:0;object-fit:cover;background:#1b2838;">'
                            + '<span style="flex:1;min-width:0;">'
                            + '<span class="fa-contrib-game-title" data-fa-game-name data-fa-appid="' + g.appid + '" style="font-size:11px;font-weight:600;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;">' + faEsc(g.name) + '</span>'
                            + '<span style="font-size:9px;color:#64748b;margin-top:2px;display:block;">购入于 ' + dateStr + '</span>'
                            + '</span>'
                            + '</a>'
                            + '<span style="font-size:9px;padding:2px 6px;border-radius:3px;background:' + tagColor + '20;color:' + tagColor + ';font-weight:600;flex-shrink:0;">' + tagText + '</span>'
                            + '</div>';
                    });
                    html += '</div>';
                } else {
                    html += '<div style="text-align:center;font-size:11px;color:#64748b;padding:20px;flex:1;display:flex;align-items:center;justify-content:center;">暂无贡献记录</div>';
                }
                html += '</div>';

                // ---- 左下：最近游玩（v1.99：从右侧移至左侧最近贡献下方）----
                var paData = (paCache.data && paCache.data[mySid]) ? paCache.data[mySid] : null;
                var playGames = paData && paData.result && paData.result.games ? paData.result.games : [];
                playGames = playGames.slice().sort(function(a, b) {
                    return (b.playtime_2weeks || 0) - (a.playtime_2weeks || 0) || (b.playtime_forever || 0) - (a.playtime_forever || 0);
                }).slice(0, 10);
                var playCount = paData && paData.result ? paData.result.total_count : playGames.length;
                html += '<div style="flex:1 1 0;background:rgba(30,41,59,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;box-shadow:0 4px 24px rgba(0,0,0,0.35);display:flex;flex-direction:column;min-height:0;overflow:hidden;">';
                html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-shrink:0;">'
                    + '<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#c7d5e0;">'
                    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#54a0ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="6"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/></svg>'
                    + '最近游玩</div>'
                    + '<span style="font-size:10px;color:#54a0ff;background:rgba(84,160,255,0.1);padding:2px 8px;border-radius:8px;font-weight:600;">' + playCount + '</span>'
                    + '</div>';
                if (playGames.length > 0) {
                    html += '<div class="fa-my-contrib-list" style="flex:1;min-height:0;overflow-y:auto;">';
                    playGames.forEach(function(g) {
                        var gRecent = faFmtHours(g.playtime_2weeks || 0);
                        var gTotal = faFmtHours(g.playtime_forever || 0);
                        html += '<div class="fa-contrib-game-row" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">'
                            + '<a class="fa-contrib-game-link" data-fa-appid="' + g.appid + '" href="https://store.steampowered.com/app/' + g.appid + '" target="_blank" style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;color:inherit;text-decoration:none;" onmouseover="this.querySelector(\'[data-fa-game-name]\').style.color=\'#06cfbe\'" onmouseout="this.querySelector(\'[data-fa-game-name]\').style.color=\'#e2e8f0\'">'
                            + '<img data-fa-cover="' + g.appid + '" loading="lazy" src="' + FA_COVER_SVG + '" style="width:32px;height:32px;border-radius:5px;flex-shrink:0;object-fit:cover;background:#1b2838;">'
                            + '<span style="flex:1;min-width:0;">'
                            + '<span class="fa-contrib-game-title" data-fa-game-name data-fa-appid="' + g.appid + '" style="font-size:11px;font-weight:600;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;">' + faEsc(g.name) + '</span>'
                            + '<span style="font-size:9px;color:#64748b;margin-top:2px;display:block;">近2周 <span style="color:#06cfbe;font-weight:600;">' + gRecent + '</span> / 总计 <span style="color:#fbbf24;">' + gTotal + '</span></span>'
                            + '</span>'
                            + '</a>'
                            + '</div>';
                    });
                    html += '</div>';
                } else {
                    html += '<div style="text-align:center;font-size:11px;color:#64748b;padding:20px;flex:1;display:flex;align-items:center;justify-content:center;">游玩数据加载中…<br>若长时间无数据，请先在"游玩动态"标签页加载</div>';
                }
                html += '</div>';

                html += '</div>'; // end 左列容器

                // ---- 右：我的独占贡献（v1.99：分页展示独占游戏，每页20条）----
                var myExclusiveGames = myGames.filter(function(g) { return g.isExclusive; });
                var exclusivePerPage = 20;
                var exclusiveTotalPages = Math.max(1, Math.ceil(myExclusiveGames.length / exclusivePerPage));
                if (myExclusivePage > exclusiveTotalPages) myExclusivePage = 1;
                var exclusiveDisplay = myExclusiveGames.slice((myExclusivePage - 1) * exclusivePerPage, myExclusivePage * exclusivePerPage);
                html += '<div class="fa-my-contrib-exclusive" style="flex:1 1 300px;min-width:260px;background:rgba(30,41,59,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;box-shadow:0 4px 24px rgba(0,0,0,0.35);display:flex;flex-direction:column;">';
                // 标题栏：标题左侧 + 分页按钮右侧
                html += '<div class="fa-my-contrib-exclusive-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-shrink:0;gap:8px;">'
                    + '<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#c7d5e0;flex-shrink:0;">'
                    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ff9f43" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>'
                    + '我的独占贡献</div>'
                    + (exclusiveTotalPages > 1
                        ? '<div class="fa-my-contrib-exclusive-pager" style="display:flex;align-items:center;gap:6px;">'
                          + '<span style="font-size:10px;color:#ff9f43;background:rgba(255,159,67,0.1);padding:2px 8px;border-radius:8px;font-weight:600;white-space:nowrap;">共' + myExclusiveGames.length + '款</span>'
                          + '<button id="faExcPrevPage" style="background:rgba(15,23,42,0.6);border:1px solid rgba(255,159,67,0.25);color:#ff9f43;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s;' + (myExclusivePage <= 1 ? 'opacity:0.4;cursor:not-allowed;' : '') + '" ' + (myExclusivePage <= 1 ? 'disabled' : '') + '>'
                          + '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:2px;"><polyline points="15 18 9 12 15 6"/></svg>上一页</button>'
                          + '<span style="font-size:11px;color:#94a3b8;font-weight:600;white-space:nowrap;">' + myExclusivePage + ' / ' + exclusiveTotalPages + '</span>'
                          + '<button id="faExcNextPage" style="background:rgba(15,23,42,0.6);border:1px solid rgba(255,159,67,0.25);color:#ff9f43;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s;' + (myExclusivePage >= exclusiveTotalPages ? 'opacity:0.4;cursor:not-allowed;' : '') + '" ' + (myExclusivePage >= exclusiveTotalPages ? 'disabled' : '') + '>'
                          + '下一页<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:2px;"><polyline points="9 18 15 12 9 6"/></svg></button>'
                          + '</div>'
                        : '<span style="font-size:10px;color:#ff9f43;background:rgba(255,159,67,0.1);padding:2px 8px;border-radius:8px;font-weight:600;">' + myExclusiveGames.length + '</span>')
                    + '</div>';
                if (exclusiveDisplay.length > 0) {
                    html += '<div class="fa-my-contrib-list" style="flex:1;min-height:0;overflow-y:auto;">';
                    exclusiveDisplay.forEach(function(g) {
                        var dateStr = g.time > 0 ? new Date(g.time * 1000).toLocaleDateString('zh-CN') : '未知';
                        html += '<div class="fa-contrib-game-row" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">'
                            + '<a class="fa-contrib-game-link" data-fa-appid="' + g.appid + '" href="https://store.steampowered.com/app/' + g.appid + '" target="_blank" style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;color:inherit;text-decoration:none;" onmouseover="this.querySelector(\'[data-fa-game-name]\').style.color=\'#06cfbe\'" onmouseout="this.querySelector(\'[data-fa-game-name]\').style.color=\'#e2e8f0\'">'
                            + '<img data-fa-cover="' + g.appid + '" loading="lazy" src="' + FA_COVER_SVG + '" style="width:32px;height:32px;border-radius:5px;flex-shrink:0;object-fit:cover;background:#1b2838;">'
                            + '<span style="flex:1;min-width:0;">'
                            + '<span class="fa-contrib-game-title" data-fa-game-name data-fa-appid="' + g.appid + '" style="font-size:11px;font-weight:600;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;">' + faEsc(g.name) + '</span>'
                            + '<span style="font-size:9px;color:#64748b;margin-top:2px;display:block;">购入于 ' + dateStr + '</span>'
                            + '</span>'
                            + '</a>'
                            + '<span style="font-size:9px;padding:2px 6px;border-radius:3px;background:#ff9f4320;color:#ff9f43;font-weight:600;flex-shrink:0;">独占</span>'
                            + '</div>';
                    });
                    html += '</div>';
                } else {
                    html += '<div style="text-align:center;font-size:11px;color:#64748b;padding:20px;flex:1;display:flex;align-items:center;justify-content:center;">暂无独占贡献游戏</div>';
                }
                html += '</div>';

                html += '</div>'; // end 双列面板

                overlay.innerHTML = html;
                faResetContributionScroll();

                // 绑定返回按钮
                var backBtn = overlay.querySelector('#faContribBack');
                if (backBtn) {
                    backBtn.addEventListener('click', function() {
                        overlay.style.display = 'none';
                        overlay.innerHTML = '';
                        myExclusivePage = 1; // v1.99：重置独占贡献分页
                        if (defaultView) defaultView.style.display = '';
                        faRestoreContributionScroll();
                        // 恢复 Chart.js 图表（canvas 可能被覆盖层移除）
                        if (!document.getElementById('Family_countChart')) {
                            var chartWrap = panel.querySelector('[data-chart-bar-card]');
                            if (chartWrap) {
                                var cv = document.createElement('canvas');
                                cv.id = 'Family_countChart';
                                cv.width = 560; cv.height = 460;
                                cv.style.cssText = 'display:block;box-sizing:border-box;height:460px;width:560px;max-width:100%;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.2))';
                                chartWrap.appendChild(cv);
                            }
                        }
                        observer_5();
                        renderContributionExtras();
                    });
                }

                // 异步加载封面图与中文名
                overlay.querySelectorAll('img[data-fa-cover]').forEach(function(img) {
                    faLoadCover(img, img.getAttribute('data-fa-cover'));
                });
                overlay.querySelectorAll('[data-fa-game-name]').forEach(function(el) {
                    var aid = el.getAttribute('data-fa-appid');
                    var info = saves.familyGameList.GameInfo[aid];
                    faLoadGameZhName(el, aid, info ? (info.name || el.textContent) : el.textContent);
                });

                // v1.99：独占贡献分页按钮事件
                var excPrevBtn = overlay.querySelector('#faExcPrevPage');
                var excNextBtn = overlay.querySelector('#faExcNextPage');
                if (excPrevBtn) {
                    excPrevBtn.addEventListener('click', function() {
                        if (myExclusivePage > 1) {
                            myExclusivePage--;
                            renderMyContributionOverlay();
                        }
                    });
                }
                if (excNextBtn) {
                    excNextBtn.addEventListener('click', function() {
                        myExclusivePage++;
                        renderMyContributionOverlay();
                    });
                }

                // 若游玩数据未缓存，后台拉取并自动刷新覆盖层（v1.99：最近游玩移至左侧后恢复此逻辑）
                if ((!paCache.data || !paCache.data[mySid]) && access_token && members.length > 0 && !playActivityLoading) {
                    refreshPlayActivityData(members);
                    var pollCount = 0;
                    var pollTimer = setInterval(function() {
                        pollCount++;
                        var curPanel = document.getElementById('familyAnalysisPanel');
                        if (!curPanel || pollCount > 15) { clearInterval(pollTimer); return; }
                        var curOverlay = curPanel.querySelector('[data-my-contrib-overlay]');
                        if (curOverlay && curOverlay.style.display !== 'none' && paCache.data && paCache.data[mySid]) {
                            clearInterval(pollTimer);
                            renderMyContributionOverlay();
                        }
                    }, 2000);
                }

                // v1.75：DLC 数据未就绪时后台加载并自动刷新覆盖层（双源并发：Barter.vg + Steam GetItems）
                if (!dlcSourceReady) {
                    var dlcAppIds = (saves && saves.familyGameList && saves.familyGameList.GameList) ? saves.familyGameList.GameList.slice() : [];
                    Promise.all([faLoadDlcDatabase(), faEnrichAppTypes(dlcAppIds)]).then(function() {
                        var curPanel = document.getElementById('familyAnalysisPanel');
                        if (curPanel) {
                            var curOverlay = curPanel.querySelector('[data-my-contrib-overlay]');
                            if (curOverlay && curOverlay.style.display !== 'none') {
                                renderMyContributionOverlay();
                            }
                        }
                    }).catch(function(e) { console.warn('[FA] DLC 数据后台加载失败:', e); });
                }
            }

            // ===================== v1.78：共享分布详情覆盖层渲染 =====================
            // 参考好友管理插件家庭组浮窗的覆盖层模式与 renderMyContributionOverlay 的返回按钮设计
            // 点击贡献分布柱状图的"查看详情"按钮后，覆盖默认视图，展示共享分布详细数据
            function renderShareDetailOverlay() {
                var overlay = panel.querySelector('[data-share-detail-overlay]');
                if (!overlay) return;
                overlay.className = 'fa-contrib-overlay fa-share-detail-view';
                var defaultView = panel.querySelector('[data-contrib-default]');
                // 显示覆盖层，隐藏默认视图
                faRememberContributionScroll();
                if (defaultView) defaultView.style.display = 'none';
                overlay.style.display = 'flex';
                overlay.style.flexDirection = 'column';
                overlay.style.gap = '12px';

                var gi = saves.familyGameList.GameInfo;
                var gameList = saves.familyGameList.GameList;
                var members = saves.familyInfo.family_member || [];
                var idMap = saves.familyInfo.steamIdtoName || {};
                var nowSec = Date.now() / 1000;

                // 统计数据
                var totalGames = gameList.length;
                var exclusiveCount = 0, sharedCount = 0, multiOwnerCount = 0;
                var ownerDist = {}; // 拥有者数量分布：{1: count, 2: count, ...}
                var maxOwners = 0;
                var memberContrib = {}; // 每个成员的独占/共享计数
                members.forEach(function(m) { memberContrib[m.steamid] = { exclusive: 0, shared: 0, total: 0 }; });

                // 收集所有共享游戏（2+拥有者）并按共享人数排序
                var sharedGames = [];

                for (var i = 0; i < gameList.length; i++) {
                    var aid = gameList[i];
                    var info = gi[aid];
                    if (!info || !info.owners) continue;
                    var oc = info.owners.length;
                    ownerDist[oc] = (ownerDist[oc] || 0) + 1;
                    if (oc > maxOwners) maxOwners = oc;
                    if (oc === 1) {
                        exclusiveCount++;
                    } else {
                        sharedCount++;
                        if (oc >= 3) multiOwnerCount++;
                        sharedGames.push({ appid: aid, name: info.name || ('App ' + aid), owners: info.owners, ownerCount: oc, time: info.time || 0 });
                    }
                    info.owners.forEach(function(sid) {
                        if (memberContrib[sid]) {
                            memberContrib[sid].total++;
                            if (oc === 1) memberContrib[sid].exclusive++;
                            else memberContrib[sid].shared++;
                        }
                    });
                }
                sharedGames.sort(function(a, b) { return b.ownerCount - a.ownerCount || a.name.localeCompare(b.name, 'zh-CN'); });

                // KPI 卡片
                var avgOwners = totalGames > 0 ? (Object.keys(ownerDist).reduce(function(sum, k) { return sum + parseInt(k) * ownerDist[k]; }, 0) / totalGames).toFixed(2) : '0';
                var shareRate = totalGames > 0 ? (sharedCount / totalGames * 100).toFixed(1) : '0';

                var html = '';
                // 顶部栏：返回按钮 + 标题
                html += '<div class="fa-contrib-overlay-header" style="display:flex;align-items:center;gap:10px;flex-shrink:0;">'
                    + '<button id="faShareDetailBack" style="display:flex;align-items:center;gap:4px;background:rgba(15,23,42,0.6);border:1px solid rgba(6,207,190,0.25);color:#06cfbe;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor=\'rgba(6,207,190,0.5)\';this.style.background=\'rgba(6,207,190,0.1)\'" onmouseout="this.style.borderColor=\'rgba(6,207,190,0.25)\';this.style.background=\'rgba(15,23,42,0.6)\'">'
                    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
                    + '返回</button>'
                    + '<div style="font-size:14px;font-weight:700;color:#c7d5e0;display:flex;align-items:center;gap:6px;">'
                    + '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#06cfbe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>'
                    + '共享分布详情</div>'
                    + '<span style="font-size:11px;color:#64748b;margin-left:auto;">共 ' + sharedGames.length + ' 款共享游戏</span>'
                    + '</div>';

                // KPI 卡片行
                var sdKpiCards = [
                    { label: '共享游戏总数', value: sharedCount, color: '#06cfbe', sub: '占家庭库 ' + shareRate + '%' },
                    { label: '独占游戏数', value: exclusiveCount, color: '#ff9f43', sub: '仅1人拥有' },
                    { label: '多人共有', value: multiOwnerCount, color: '#a78bfa', sub: '≥3人共享' },
                    { label: '平均拥有者数', value: avgOwners, color: '#54a0ff', sub: '每款游戏平均' },
                    { label: '最大共享数', value: maxOwners + '人', color: '#2ed573', sub: '单款游戏最多拥有者' }
                ];
                html += '<div class="fa-contrib-overlay-kpis" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;flex-shrink:0;">';
                sdKpiCards.forEach(function(k) {
                    html += '<div style="background:linear-gradient(135deg,' + k.color + '18 0%,' + k.color + '06 100%);border:1px solid ' + k.color + '25;border-radius:10px;padding:12px 8px;text-align:center;position:relative;overflow:hidden;">'
                        + '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,' + k.color + ',transparent);"></div>'
                        + '<div style="font-size:22px;font-weight:700;color:' + k.color + ';line-height:1.1;">' + k.value + '</div>'
                        + '<div style="font-size:10px;color:#8097a8;margin-top:4px;">' + k.label + '</div>'
                        + '<div style="font-size:9px;color:#64748b;margin-top:2px;line-height:1.3;">' + k.sub + '</div>'
                        + '</div>';
                });
                html += '</div>';

                // 双列：左侧成员贡献分布 | 右侧共享游戏列表
                html += '<div class="fa-share-detail-columns" style="display:flex;gap:12px;flex-wrap:wrap;flex:1;min-height:0;">';

                // ---- 左：成员共享贡献对比 ----
                // v1.79：overflow-y:auto 防止内容溢出被裁剪
                html += '<div class="fa-share-detail-analysis" style="flex:1 1 280px;min-width:260px;background:rgba(30,41,59,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;box-shadow:0 4px 24px rgba(0,0,0,0.35);display:flex;flex-direction:column;overflow-y:auto;min-height:0;">';
                html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-shrink:0;">'
                    + '<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#c7d5e0;">'
                    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#06cfbe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
                    + '成员共享贡献</div>'
                    + '</div>';
                // 成员贡献柱状图（独占 vs 共享对比）
                // v1.79：紧凑布局，不撑开空间让拥有者分布紧贴下方
                var ranked = members.map(function(m) {
                    var c = memberContrib[m.steamid] || { exclusive: 0, shared: 0, total: 0 };
                    return { sid: m.steamid, name: m.userName || idMap[m.steamid] || '成员', exclusive: c.exclusive, shared: c.shared, total: c.total };
                }).sort(function(a, b) { return b.total - a.total; });
                var maxTotal = 1;
                ranked.forEach(function(r) { if (r.total > maxTotal) maxTotal = r.total; });
                html += '<div style="flex-shrink:0;">';
                ranked.forEach(function(r, idx) {
                    var exPct = maxTotal > 0 ? (r.exclusive / maxTotal * 100) : 0;
                    var shPct = maxTotal > 0 ? (r.shared / maxTotal * 100) : 0;
                    var exBarPct = r.exclusive > 0 ? Math.max(3, exPct) : 0;
                    var shBarPct = r.shared > 0 ? Math.max(3, shPct) : 0;
                    var avatarHtml = faNameAvatarHtml(r.name, 20, 'margin-right:6px;flex-shrink:0;');
                    html += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:10px;">'
                        + avatarHtml
                        + '<span style="flex-shrink:0;width:56px;font-size:11px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + faEscAttr(r.name) + '">' + faEsc(r.name) + '</span>'
                        + '<div style="flex:1;height:10px;background:rgba(255,255,255,0.05);border-radius:5px;overflow:hidden;display:flex;min-width:40px;">'
                        + '<div style="height:100%;width:' + exBarPct.toFixed(1) + '%;background:#ff9f43;border-radius:5px 0 0 5px;transition:width 0.4s ease;" title="独占: ' + r.exclusive + '"></div>'
                        + '<div style="height:100%;width:' + shBarPct.toFixed(1) + '%;background:#06cfbe;border-radius:0 5px 5px 0;transition:width 0.4s ease;" title="共享: ' + r.shared + '"></div>'
                        + '</div>'
                        + '<span style="flex-shrink:0;min-width:32px;text-align:right;font-size:11px;font-weight:600;color:#c6d4df;">' + r.total + '</span>'
                        + '</div>';
                });
                html += '</div>';
                // 图例
                html += '<div style="display:flex;gap:16px;justify-content:center;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;">'
                    + '<span style="display:flex;align-items:center;gap:6px;font-size:11px;color:#94a3b8;"><span style="width:12px;height:12px;border-radius:3px;background:#ff9f43;"></span>独占贡献</span>'
                    + '<span style="display:flex;align-items:center;gap:6px;font-size:11px;color:#94a3b8;"><span style="width:12px;height:12px;border-radius:3px;background:#06cfbe;"></span>共享贡献</span>'
                    + '</div>';
                // v1.79：拥有者数量分布移至左侧成员共享贡献下方（优化纵向柱状图）
                // v1.79：修复高度不生效问题（改用像素高度）+ 预留最多6人显示位置
                var distLabels = Object.keys(ownerDist).sort(function(a, b) { return parseInt(a) - parseInt(b); });
                if (distLabels.length > 0) {
                    var distMax = 1;
                    distLabels.forEach(function(k) { if (ownerDist[k] > distMax) distMax = ownerDist[k]; });
                    var distTotal = distLabels.reduce(function(sum, k) { return sum + ownerDist[k]; }, 0) || 1;
                    // v1.79：固定柱状图区域高度，柱子用像素值确保比例正确
                    // v1.79：容器高度需包含数值标签(顶部) + 柱子 + 底部标签，避免最高柱数值溢出遮挡标题
                    var barMaxH = 70; // 最高柱子的像素高度
                    var chartH = barMaxH + 32; // 容器总高度 = 柱子70 + 数值标签14 + 底标签12 + 间距6
                    var maxOwnersSlot = 6; // 最多展示6人拥有
                    html += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);flex-shrink:0;">'
                        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-shrink:0;">'
                        + '<div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#c7d5e0;">'
                        + '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 16V8M12 16V4M17 16v-6"/></svg>'
                        + '拥有者数量分布</div>'
                        + '<span style="font-size:10px;color:#64748b;">共 ' + distTotal + ' 款</span>'
                        + '</div>'
                        + '<div style="display:flex;align-items:flex-end;gap:4px;height:' + chartH + 'px;padding:0 2px;overflow:visible;">';
                    for (var oi = 1; oi <= maxOwnersSlot; oi++) {
                        var ok = String(oi);
                        var cnt = ownerDist[ok] || 0;
                        var barH = cnt > 0 ? Math.max(2, Math.round(cnt / distMax * barMaxH)) : 0;
                        var pct = cnt > 0 ? (cnt / distTotal * 100).toFixed(1) : '0.0';
                        var col = oi === 1 ? '#ff9f43' : (oi >= 3 ? '#2ed573' : '#a78bfa');
                        var opacity = cnt > 0 ? '1' : '0.25';
                        html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px;" title="' + ok + '人拥有: ' + cnt + ' 款 (' + pct + '%)">'
                            + '<span style="font-size:9px;color:' + (cnt > 0 ? col : '#475569') + ';font-weight:600;opacity:' + opacity + ';">' + (cnt > 0 ? cnt : '—') + '</span>'
                            + '<div style="width:70%;max-width:30px;' + (cnt > 0 ? 'min-height:2px;height:' + barH + 'px;background:linear-gradient(180deg,' + col + ' 0%,' + col + '40 100%);border-radius:3px 3px 0 0;box-shadow:0 0 6px ' + col + '30;transition:height 0.4s ease;' : 'height:2px;background:rgba(255,255,255,0.06);border-radius:3px 3px 0 0;') + '"></div>'
                            + '<span style="font-size:9px;color:' + (cnt > 0 ? '#64748b' : '#475569') + ';">' + ok + '人</span>'
                            + '</div>';
                    }
                    html += '</div></div>';
                }
                html += '</div>'; // end left column

                // ---- 右：共享游戏列表 ----
                // v1.79：分页展示，每页12条（避免页面高度内出现滚动条）
                var perPage = 12;
                var totalPages = Math.max(1, Math.ceil(sharedGames.length / perPage));
                if (shareDetailPage > totalPages) shareDetailPage = 1;
                var displayGames = sharedGames.slice((shareDetailPage - 1) * perPage, shareDetailPage * perPage);
                html += '<div class="fa-share-detail-games" style="flex:1 1 380px;min-width:320px;background:rgba(30,41,59,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;box-shadow:0 4px 24px rgba(0,0,0,0.35);display:flex;flex-direction:column;">';
                html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-shrink:0;">'
                    + '<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#c7d5e0;">'
                    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#54a0ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>'
                    + '共享游戏列表</div>'
                    + '<span style="font-size:10px;color:#54a0ff;background:rgba(84,160,255,0.1);padding:2px 8px;border-radius:8px;font-weight:600;">' + sharedGames.length + '</span>'
                    + '</div>';
                if (displayGames.length > 0) {
                    html += '<div class="fa-share-detail-games-list" style="flex:1;min-height:0;overflow-y:auto;">';
                    displayGames.forEach(function(g) {
                        var ownerNames = g.owners.map(function(sid) { return idMap[sid] || ('ID:' + String(sid).slice(-4)); });
                        var ownerAvatars = g.owners.slice(0, 4).map(function(sid) {
                            var name = idMap[sid] || 'ID';
                            return faNameAvatarHtml(name, 16, 'margin-left:-4px;border:1.5px solid #1b2838;');
                        }).join('');
                        var overflow = g.owners.length - 4;
                        var tagColor = g.ownerCount >= 4 ? '#2ed573' : (g.ownerCount >= 3 ? '#54a0ff' : '#a78bfa');
                        var dateStr = g.time > 0 ? new Date(g.time * 1000).toLocaleDateString('zh-CN') : '';
                        html += '<div class="fa-contrib-game-row" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">'
                            + '<a class="fa-contrib-game-link" data-fa-appid="' + g.appid + '" href="https://store.steampowered.com/app/' + g.appid + '" target="_blank" style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;color:inherit;text-decoration:none;" onmouseover="this.querySelector(\'[data-fa-game-name]\').style.color=\'#06cfbe\'" onmouseout="this.querySelector(\'[data-fa-game-name]\').style.color=\'#e2e8f0\'">'
                            + '<img data-fa-cover="' + g.appid + '" loading="lazy" src="' + FA_COVER_SVG + '" style="width:32px;height:32px;border-radius:5px;flex-shrink:0;object-fit:cover;background:#1b2838;">'
                            + '<span style="flex:1;min-width:0;">'
                            + '<span class="fa-contrib-game-title" data-fa-game-name data-fa-appid="' + g.appid + '" style="font-size:11px;font-weight:600;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;">' + faEsc(g.name) + '</span>'
                            + '<span style="font-size:9px;color:#64748b;margin-top:2px;display:flex;align-items:center;gap:4px;">'
                            + '<span style="display:flex;">' + ownerAvatars + (overflow > 0 ? '<span style="font-size:9px;color:#8097a8;margin-left:2px;">+' + overflow + '</span>' : '') + '</span>'
                            + (dateStr ? '<span>· ' + dateStr + '</span>' : '')
                            + '</span>'
                            + '</span>'
                            + '</a>'
                            + '<span style="font-size:9px;padding:2px 6px;border-radius:3px;background:' + tagColor + '20;color:' + tagColor + ';font-weight:600;flex-shrink:0;">' + g.ownerCount + '人共享</span>'
                            + '</div>';
                    });
                    // v1.79：分页按钮（底部居中）
                    if (totalPages > 1) {
                        html += '<div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 0 4px;flex-shrink:0;border-top:1px solid rgba(255,255,255,0.06);">'
                            + '<button id="faSdPrevPage" style="background:rgba(15,23,42,0.6);border:1px solid rgba(6,207,190,0.25);color:#06cfbe;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s;' + (shareDetailPage <= 1 ? 'opacity:0.4;cursor:not-allowed;' : '') + '" ' + (shareDetailPage <= 1 ? 'disabled' : '') + '>'
                            + '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:2px;"><polyline points="15 18 9 12 15 6"/></svg>上一页</button>'
                            + '<span style="font-size:11px;color:#94a3b8;font-weight:600;">' + shareDetailPage + ' / ' + totalPages + '</span>'
                            + '<button id="faSdNextPage" style="background:rgba(15,23,42,0.6);border:1px solid rgba(6,207,190,0.25);color:#06cfbe;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s;' + (shareDetailPage >= totalPages ? 'opacity:0.4;cursor:not-allowed;' : '') + '" ' + (shareDetailPage >= totalPages ? 'disabled' : '') + '>'
                            + '下一页<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:2px;"><polyline points="9 18 15 12 9 6"/></svg></button>'
                            + '</div>';
                    }
                    html += '</div>';
                } else {
                    html += '<div style="text-align:center;font-size:11px;color:#64748b;padding:20px;flex:1;display:flex;align-items:center;justify-content:center;">暂无共享游戏数据</div>';
                }
                html += '</div>';

                html += '</div>'; // end 双列面板

                overlay.innerHTML = html;
                faResetContributionScroll();

                // 绑定返回按钮
                var backBtn = overlay.querySelector('#faShareDetailBack');
                if (backBtn) {
                    backBtn.addEventListener('click', function() {
                        shareDetailPage = 1; // v1.79：重置分页
                        overlay.style.display = 'none';
                        overlay.innerHTML = '';
                        if (defaultView) defaultView.style.display = '';
                        faRestoreContributionScroll();
                        // 恢复 Chart.js 图表（canvas 可能被覆盖层移除）
                        if (!document.getElementById('Family_countChart')) {
                            var chartWrap = panel.querySelector('[data-chart-bar-card]');
                            if (chartWrap) {
                                var cv = document.createElement('canvas');
                                cv.id = 'Family_countChart';
                                cv.width = 560; cv.height = 460;
                                cv.style.cssText = 'display:block;box-sizing:border-box;height:460px;width:560px;max-width:100%;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.2))';
                                chartWrap.appendChild(cv);
                            }
                        }
                        observer_5();
                        renderContributionExtras();
                    });
                }

                // 异步加载封面图与中文名
                overlay.querySelectorAll('img[data-fa-cover]').forEach(function(img) {
                    faLoadCover(img, img.getAttribute('data-fa-cover'));
                });
                overlay.querySelectorAll('[data-fa-game-name]').forEach(function(el) {
                    var aid = el.getAttribute('data-fa-appid');
                    var info = saves.familyGameList.GameInfo[aid];
                    faLoadGameZhName(el, aid, info ? (info.name || el.textContent) : el.textContent);
                });

                // v1.79：分页按钮事件
                var prevPageBtn = overlay.querySelector('#faSdPrevPage');
                var nextPageBtn = overlay.querySelector('#faSdNextPage');
                if (prevPageBtn) {
                    prevPageBtn.addEventListener('click', function() {
                        if (shareDetailPage > 1) {
                            shareDetailPage--;
                            renderShareDetailOverlay();
                        }
                    });
                }
                if (nextPageBtn) {
                    nextPageBtn.addEventListener('click', function() {
                        shareDetailPage++;
                        renderShareDetailOverlay();
                    });
                }
            }

            // ===================== 游玩动态渲染 =====================
            // v1.40：游玩数据缓存提升到 window 级，面板关闭后重开可直接复用（10 分钟 TTL），
            // 过期时先渲染旧缓存、再后台静默刷新，避免每次重开面板都全量重新加载
            const PA_CACHE_KEY = '__faPlayActivityCache';
            const PA_CACHE_TTL = 10 * 60 * 1000; // 10 分钟
            if (!window[PA_CACHE_KEY]) window[PA_CACHE_KEY] = { data: null, updatedAt: 0 };
            const paCache = window[PA_CACHE_KEY];
            let playActivityLoading = false;

            // v1.41：家庭愿望单缓存（window 级，30 分钟 TTL，与游玩动态同样跨面板复用）
            // v1.78：TTL 从 30 分钟提升至 8 小时，并新增 GM_setValue 持久化缓存层（跨页面刷新）
            const WL_CACHE_KEY = '__faWishlistCache';
            const WL_CACHE_TTL = 8 * 60 * 60 * 1000; // v1.78: 30min → 8h（配合 GM_setValue 持久化缓存）
            if (!window[WL_CACHE_KEY]) {
                // v1.78：启动时从 GM_setValue 持久化缓存恢复 L1 缓存（跨页面刷新）
                window[WL_CACHE_KEY] = { data: null, updatedAt: 0 };
                var persistentWl = faWlDataLoad();
                if (persistentWl && persistentWl.data && (Date.now() - persistentWl.updatedAt < FA_WL_DATA_TTL)) {
                    window[WL_CACHE_KEY].data = persistentWl.data;
                    window[WL_CACHE_KEY].updatedAt = persistentWl.updatedAt;
                    console.log('[FA] 愿望单持久化缓存恢复成功，更新于', new Date(persistentWl.updatedAt).toLocaleTimeString('zh-CN', { hour12: false }));
                }
            }
            const wlCache = window[WL_CACHE_KEY];
            let wlState = { loading: false, search: '', filter: 'all', page: 1, enriching: false, viewMode: GM_getValue('faWlViewMode', 'list'), subFilter: 0 };

            function faFmtHours(minutes) {
                if (!minutes || minutes <= 0) return '0h';
                // v1.57: 整数化，修复浮点误差导致 "215h 29.33333333333394m" 显示问题
                minutes = Math.round(minutes);
                var h = Math.floor(minutes / 60);
                var m = minutes % 60;
                if (h >= 1000) return (h / 1000).toFixed(1) + 'kh';
                if (h > 0) return h + 'h' + (m > 0 ? ' ' + m + 'm' : '');
                return m + 'm';
            }
            function faEsc(s) {
                return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
            function faEscAttr(s) {
                return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
            // v1.66：统一加载动画 HTML（参考 steam-friend-manager createLoadingEl）
            function createLoadingHtml(text, size) {
                size = size || 34;
                return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:50px 20px;gap:12px;color:#8097a8;">'
                    + '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="#06cfbe" stroke-width="2" style="animation:fa-spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>'
                    + '<span style="font-size:13px;">' + text + '</span></div>';
            }
            // ===================== 价值洞察（v1.71 新增） =====================
            // 参考 html-demo/family-price-value 原型设计，展示家庭库货币价值维度
            // 数据来源：IStoreBrowseService/GetItems（价格）+ IPlayerService/GetOwnedGames（per-game 游玩时长）
            const VI_CACHE_KEY = '__faValueInsightsCache';
            const VI_CACHE_TTL = 24 * 60 * 60 * 1000; // v1.74: 30分钟 → 24小时（数据变化频率低，价格/游玩时长无需频繁刷新）
            if (!window[VI_CACHE_KEY]) window[VI_CACHE_KEY] = { priceData: null, playtimeData: null, updatedAt: 0, preheated: false };
            const viCache = window[VI_CACHE_KEY];
            let viLoading = false;
            let viPreheatTimer = null;
            let viTrendMode = 'monthly'; // 'monthly' | 'cumulative'

            function fmtViMoney(v) {
                if (v >= 10000) return (v / 1000).toFixed(1) + 'k';
                return Math.round(v).toString();
            }
            function buildViKpiCard(label, value, color, sub) {
                return '<div style="background:linear-gradient(135deg,' + color + '20 0%,' + color + '08 100%);border:1px solid ' + color + '30;border-radius:8px;padding:12px 10px;text-align:center;position:relative;overflow:hidden;">'
                    + '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,' + color + ',transparent);"></div>'
                    + '<div style="font-size:22px;font-weight:700;color:' + color + ';line-height:1.2;">' + value + '</div>'
                    + '<div style="font-size:10px;color:#8097a8;margin-top:3px;">' + label + '</div>'
                    + '<div style="font-size:9px;color:#64748b;margin-top:3px;line-height:1.4;">' + sub + '</div>'
                    + '</div>';
            }

            // v1.74：预热——面板打开后延迟 3s 后台静默拉取价值洞察数据，用户切到标签页时秒开
            function preheatValueInsightsData() {
                if (viPreheatTimer) clearTimeout(viPreheatTimer);
                viPreheatTimer = setTimeout(function() {
                    viPreheatTimer = null;
                    // 已有新鲜缓存或正在加载则跳过
                    if (viLoading) return;
                    if (viCache.priceData && Object.keys(viCache.priceData).length > 0 && (Date.now() - viCache.updatedAt < VI_CACHE_TTL)) return;
                    var members = (saves && saves.familyInfo && Array.isArray(saves.familyInfo.family_member)) ? saves.familyInfo.family_member : [];
                    if (members.length === 0 || !access_token) return;
                    viCache.preheated = true;
                    refreshValueInsightsData(members, true);
                }, 3000);
            }

            // v1.75：DLC 数据预热——面板打开后延迟 2s 后台加载 DLC 数据库 + 应用类型映射
            // 用户查看"我的贡献"时 faIsDlc() 可直接使用缓存数据，无需等待
            var faDlcPreheatTimer = null;
            function preheatDlcData() {
                if (faDlcPreheatTimer) clearTimeout(faDlcPreheatTimer);
                faDlcPreheatTimer = setTimeout(function() {
                    faDlcPreheatTimer = null;
                    // 两源数据均已就绪则跳过
                    if (faDlcDbData && faAppTypeMap) return;
                    var allAppIds = (saves && saves.familyGameList && saves.familyGameList.GameList) ? saves.familyGameList.GameList.slice() : [];
                    if (allAppIds.length === 0) return;
                    // 双源并发：Barter.vg DLC 数据库 + Steam GetItems 应用类型
                    Promise.all([faLoadDlcDatabase(), faEnrichAppTypes(allAppIds)]).then(function() {
                        console.log('[FA] DLC 数据预热完成（双源）');
                        // 若"我的贡献"覆盖层可见则自动刷新以更新 DLC 计数
                        var curPanel = document.getElementById('familyAnalysisPanel');
                        if (curPanel) {
                            var curOverlay = curPanel.querySelector('[data-my-contrib-overlay]');
                            if (curOverlay && curOverlay.style.display !== 'none') {
                                renderMyContributionOverlay();
                            }
                        }
                    }).catch(function(e) { console.warn('[FA] DLC 数据预热失败:', e); });
                }, 2000);
            }

            function renderValueInsightsTab(forceRefresh) {
                var viWrap = panel.querySelector('[data-value-content]');
                if (!viWrap) return;
                var members = (saves && saves.familyInfo && Array.isArray(saves.familyInfo.family_member)) ? saves.familyInfo.family_member : [];
                if (members.length === 0) {
                    viWrap.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#8097a8;font-size:13px;">暂无家庭成员数据，请先扫描家庭库</div>';
                    return;
                }
                if (!access_token) {
                    viWrap.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#8097a8;font-size:13px;">访问令牌不可用，请在 Steam 商店页面打开此面板</div>';
                    return;
                }
                if (forceRefresh) { viCache.priceData = null; viCache.playtimeData = null; viCache.updatedAt = 0; viCache.preheated = false; faToast.info('正在刷新价值洞察数据…'); }
                var hasCache = viCache.priceData && Object.keys(viCache.priceData).length > 0;
                if (hasCache) {
                    renderValueInsightsContent(viWrap, viCache.priceData, viCache.playtimeData, members);
                    if (Date.now() - viCache.updatedAt < VI_CACHE_TTL) return;
                    refreshValueInsightsData(members);
                    return;
                }
                // v1.74：预热数据已开始加载则显示轻量加载态，否则全量加载
                viWrap.innerHTML = createLoadingHtml(viCache.preheated ? '价值数据预热中，即将完成…' : '正在加载家庭库价值数据（价格 + 游玩时长，可能需要数秒）…');
                refreshValueInsightsData(members);
            }

            function refreshValueInsightsData(members, isPreheat) {
                if (viLoading) return;
                viLoading = true;
                // v1.74：价格 + 游玩时长并发获取（两者无依赖关系），预热模式下静默
                var appids = saves.familyGameList.GameList.slice();
                // Step 1: 批量获取价格（GetItems 100个/批 3路并发 → appdetails 兜底残余）
                var pricePromise = faWlEnrichFromStoreBrowse(appids).then(function(priceData) {
                    // Step 1b: appdetails 兜底——GetItems 未返回价格的游戏（下架/锁区等）
                    var leftovers = appids.filter(function(aid) {
                        var r = priceData[aid];
                        if (!r) return true;
                        if (!r.isFree && !r.isComingSoon && !(Number(r.finalPrice) > 0)) return true;
                        return false;
                    });
                    if (leftovers.length === 0) return priceData;
                    console.log('[FA] 价值洞察: ' + leftovers.length + ' 个游戏 GetItems 未覆盖，appdetails 兜底');
                    return enrichWishlistMeta(leftovers).then(function(detailData) {
                        for (var aid in detailData) {
                            if (!priceData[aid]) priceData[aid] = detailData[aid];
                        }
                        return priceData;
                    });
                });
                // Step 2: 并发获取每个成员的 per-game 游玩时长，聚合为 { appid: { total, recent, members } }
                var playtimePromise = Promise.all(members.map(function(m) {
                    return faFetchMemberPlaytimeGames(access_token, m.steamid);
                })).then(function(results) {
                    var pm = {};
                    members.forEach(function(m, i) {
                        (results[i] || []).forEach(function(g) {
                            if (!pm[g.appid]) pm[g.appid] = { total: 0, recent: 0, members: {} };
                            pm[g.appid].total += g.playtime;
                            pm[g.appid].recent += g.recent;
                            pm[g.appid].members[m.steamid] = g.playtime;
                        });
                    });
                    return pm;
                });
                // v1.74：渐进式动态渲染——价格先到先渲染（时长区块显示占位），时长到达后自动刷新为完整视图；
                // 任一数据流失败不阻塞另一路渲染（降级展示），面板未切到价值洞察/预热模式时仅写缓存
                var playtimeReady = false;
                function maybeRender(playtimePending) {
                    if (isPreheat) return;
                    var cur = document.getElementById('familyAnalysisPanel');
                    if (!cur) return;
                    var w = cur.querySelector('[data-value-content]');
                    if (!w) return;
                    renderValueInsightsContent(w, viCache.priceData || {}, viCache.playtimeData || {}, members, { playtimePending: !!playtimePending });
                }
                var priceSafe = pricePromise.then(function(pd) {
                    viCache.priceData = pd || {};
                    if (Object.keys(viCache.priceData).length > 0) maybeRender(!playtimeReady);
                    return true;
                }, function(err) {
                    console.warn('[FA] 价值洞察价格数据加载失败:', err);
                    return false;
                });
                var playtimeSafe = playtimePromise.then(function(pm) {
                    playtimeReady = true;
                    viCache.playtimeData = pm || {};
                    // 时长就绪：价格已渲染则动态刷新为完整视图（不阻塞页面，原地更新）
                    if (viCache.priceData && Object.keys(viCache.priceData).length > 0) {
                        maybeRender(false);
                        if (!isPreheat) faToast.success('游玩时长数据已更新');
                    }
                    return true;
                }, function(err) {
                    playtimeReady = true;
                    console.warn('[FA] 价值洞察游玩时长加载失败:', err);
                    // 时长失败：价格视图保留，时长区块显示失败占位而非一直转圈
                    if (viCache.priceData && Object.keys(viCache.priceData).length > 0) maybeRender(false);
                    return false;
                });
                Promise.all([priceSafe, playtimeSafe]).then(function(results) {
                    viLoading = false;
                    viCache.preheated = false;
                    if (results[0] && results[1]) viCache.updatedAt = Date.now();
                    if (isPreheat) {
                        console.log('[FA] 价值洞察数据预热完成');
                        return;
                    }
                    var hasPrice = viCache.priceData && Object.keys(viCache.priceData).length > 0;
                    if (hasPrice) {
                        faToast.success('价值洞察数据已更新');
                    } else {
                        // 价格完全失败：给出可操作的错误提示（时长数据无价格对照无意义）
                        var cur = document.getElementById('familyAnalysisPanel');
                        var w = cur && cur.querySelector('[data-value-content]');
                        if (w) w.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#8097a8;font-size:13px;">价格数据加载失败，请检查网络后点击下方"刷新价值数据"重试</div>'
                            + '<div style="text-align:center;"><button class="fa-btn-green" onclick="return false;" id="btn_refresh_value_err">刷新价值数据</button></div>';
                        var errBtn = w && w.querySelector('#btn_refresh_value_err');
                        if (errBtn) errBtn.addEventListener('click', function() { renderValueInsightsTab(true); });
                        faToast.error('价值洞察数据加载失败');
                    }
                });
            }

            // v1.81: 价值洞察内容缓存键 — 库存指纹 + 价格数据时间戳 + 长度 + 是否 pending
            // 命中条件:相同库存 + 相同价格数据 → 直接复用 innerHTML,无重算无 DOM 构造
            function _faViContentCacheKey(priceData, playtimeData, opts) {
                var pCount = priceData ? Object.keys(priceData).length : 0;
                var ptCount = playtimeData ? Object.keys(playtimeData).length : 0;
                var pending = !!(opts && opts.playtimePending);
                var updatedAt = (typeof viCache !== 'undefined' && viCache) ? (viCache.updatedAt || 0) : 0;
                var lastup = (typeof saves !== 'undefined' && saves) ? (saves.lastupDateTime || 0) : 0;
                return lastup + '|' + updatedAt + '|' + pCount + '|' + ptCount + '|' + (pending ? '1' : '0');
            }

            function renderValueInsightsContent(viWrap, priceData, playtimeData, members, opts) {
                // v1.74：opts.playtimePending=true 时先渲染价格维度内容，游玩时长相关区块显示加载占位，时长到达后自动重渲染
                var playtimePending = !!(opts && opts.playtimePending);
                var gi = saves.familyGameList.GameInfo;
                var gameList = saves.familyGameList.GameList;
                var idMap = saves.familyInfo.steamIdtoName || {};
                var curSym = faCurrency.symbol;
                // v1.81: 命中缓存(切 tab 不重算 + 跨 session 复用)— 库存/价格数据时间戳一致
                var _viCacheKey = _faViContentCacheKey(priceData, playtimeData, opts);
                var _viCachedHtml = faComputedCache.get('viContent_' + _viCacheKey);
                if (_viCachedHtml) {
                    // 命中:直接恢复 innerHTML + 重绑事件(无重计算)
                    viWrap.innerHTML = _viCachedHtml.html;
                    _viRebindValueInsightsEvents(viWrap);
                    return;
                }
                var nowSec = Date.now() / 1000, D90 = 90 * 86400;
                var totalOriginal = 0, totalActual = 0, totalPlaytimeMin = 0, new90Original = 0;
                var memberStats = {};
                members.forEach(function(m) { memberStats[m.steamid] = { original: 0, actual: 0, games: 0, playtime: 0, discountSum: 0, discountCount: 0 }; });
                var monthlyMap = {};
                var priceTiers = [
                    { name: '免费', min: 0, max: 0.01 },
                    { name: '<' + curSym + '50', min: 0.01, max: 50 },
                    { name: curSym + '50-100', min: 50, max: 100 },
                    { name: curSym + '100-200', min: 100, max: 200 },
                    { name: curSym + '200-500', min: 200, max: 500 },
                    { name: '≥' + curSym + '500', min: 500, max: Infinity }
                ];
                var scatterPoints = [];

                gameList.forEach(function(appid) {
                    var info = gi[appid];
                    if (!info) return;
                    var pr = priceData[appid], pt = playtimeData[appid];
                    var op = 0, fp = 0, dp = 0, isFree = false;
                    if (pr) { op = pr.originalPrice || 0; fp = pr.finalPrice || 0; dp = pr.discountPct || 0; isFree = pr.isFree; }
                    var actualPaid = fp > 0 ? fp : op;
                    if (!isFree && op > 0) { totalOriginal += op; totalActual += actualPaid; }
                    var playtimeMin = pt ? pt.total : 0, recentMin = pt ? pt.recent : 0;
                    totalPlaytimeMin += playtimeMin;
                    if (info.time && (nowSec - info.time) < D90 && !isFree && op > 0) new90Original += op;
                    if (info.owners) {
                        info.owners.forEach(function(sid) {
                            if (memberStats[sid]) {
                                if (!isFree && op > 0) { memberStats[sid].original += op; memberStats[sid].actual += actualPaid; }
                                memberStats[sid].games++;
                                memberStats[sid].playtime += playtimeMin;
                                if (dp > 0) { memberStats[sid].discountSum += dp; memberStats[sid].discountCount++; }
                            }
                        });
                    }
                    if (info.time > 0) {
                        var d = new Date(info.time * 1000);
                        var mk = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                        if (!monthlyMap[mk]) monthlyMap[mk] = { original: 0, actual: 0, count: 0, tiers: [0,0,0,0,0,0], members: {} };
                        monthlyMap[mk].original += op;
                        monthlyMap[mk].actual += actualPaid;
                        monthlyMap[mk].count++;
                        for (var ti = 0; ti < priceTiers.length; ti++) {
                            if (actualPaid >= priceTiers[ti].min && actualPaid < priceTiers[ti].max) { monthlyMap[mk].tiers[ti] += actualPaid; break; }
                        }
                        if (info.owners) {
                            info.owners.forEach(function(sid) {
                                if (!monthlyMap[mk].members[sid]) monthlyMap[mk].members[sid] = 0;
                                if (!isFree && op > 0) monthlyMap[mk].members[sid] += op;
                            });
                        }
                    }
                    if (!isFree && op > 0 && playtimeMin > 0) {
                        var po = info.owners && info.owners.length > 0 ? info.owners[0] : '';
                        var oi = -1;
                        for (var mi2 = 0; mi2 < members.length; mi2++) { if (members[mi2].steamid === po) { oi = mi2; break; } }
                        scatterPoints.push({ name: info.name, price: op, playtime: playtimeMin / 60, recent: recentMin / 60, ownerIdx: oi });
                    }
                });

                var totalSavings = totalOriginal - totalActual;
                var savingsPct = totalOriginal > 0 ? Math.round(totalSavings / totalOriginal * 100) : 0;
                var perCapita = members.length > 0 ? totalOriginal / members.length : 0;
                var totalPlaytimeH = totalPlaytimeMin / 60;
                var costPerHour = totalPlaytimeH > 0 ? totalActual / totalPlaytimeH : 0;
                var monthlySorted = Object.entries(monthlyMap).sort(function(a, b) { return a[0].localeCompare(b[0]); });

                // KPI 卡片行
                var kpiHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">'
                    + buildViKpiCard('共享库总价值', curSym + fmtViMoney(totalOriginal), '#06cfbe', '实际支付 ' + curSym + fmtViMoney(totalActual) + '（省 <span style="color:#2ed573">' + savingsPct + '%</span>）')
                    + buildViKpiCard('人均贡献价值', curSym + fmtViMoney(perCapita), '#54a0ff', '按原价计算，共 ' + members.length + ' 人')
                    + buildViKpiCard('近90天新增价值', curSym + fmtViMoney(new90Original), '#ff9f43', '最近 90 天入库原价合计')
                    + (playtimePending
                        ? buildViKpiCard('平均性价比', '<span style="font-size:15px;">统计中…</span>', '#a78bfa', '游玩时长加载中，完成后自动更新')
                        : buildViKpiCard('平均性价比', curSym + costPerHour.toFixed(2) + '/h', '#a78bfa', '实际支付 ÷ 总游玩时长'))
                    + '</div>';

                viWrap.innerHTML = kpiHtml
                    + '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;align-items:flex-start;">'
                    + '<div class="fa-card" style="flex:1 1 480px;min-width:0;padding:10px;">' + buildViTrendChart(monthlySorted, members) + '</div>'
                    + '<div class="fa-card" style="flex:1 1 340px;min-width:300px;padding:10px;">' + buildViScatter(scatterPoints, curSym, playtimePending) + '</div>'
                    + '</div>'
                    + '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;">'
                    + '<div class="fa-card" style="flex:1 1 480px;min-width:0;padding:10px;">' + buildViHeatmap(monthlySorted, priceTiers, curSym) + '</div>'
                    + '<div class="fa-card" style="flex:1 1 340px;min-width:300px;padding:10px;">' + buildViMemberContribution(memberStats, members, totalOriginal, idMap, curSym, playtimePending) + '</div>'
                    + '</div>'
                    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:8px;">'
                    + '<div style="font-size:12px;color:#8097a8;">' + (playtimePending
                        ? '<span style="display:inline-flex;align-items:center;gap:6px;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#a78bfa" stroke-width="2" style="animation:fa-spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>价格数据已就绪，游玩时长统计中…</span>'
                        : '数据更新于 ' + (viCache.updatedAt ? new Date(viCache.updatedAt).toLocaleString('zh-CN') : '-')) + '</div>'
                    + '<button class="fa-btn-green" id="btn_refresh_value">刷新价值数据</button>'
                    + '</div>';

                // 刷新按钮
                var refreshBtn = viWrap.querySelector('#btn_refresh_value');
                if (refreshBtn) refreshBtn.addEventListener('click', function() { renderValueInsightsTab(true); });
                // 趋势图月度增量/累积价值切换
                var trendToggle = viWrap.querySelector('[data-vi-trend-toggle]');
                if (trendToggle) {
                    trendToggle.querySelectorAll('button').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            viTrendMode = this.getAttribute('data-mode');
                            trendToggle.querySelectorAll('button').forEach(function(b) {
                                b.classList.remove('active');
                                b.style.background = 'transparent'; b.style.color = '#8097a8';
                            });
                            this.classList.add('active');
                            this.style.background = 'rgba(6,207,190,.2)'; this.style.color = '#06cfbe';
                            var chartWrap = viWrap.querySelector('[data-vi-trend-svg]');
                            if (chartWrap) chartWrap.innerHTML = buildViTrendSvg(monthlySorted, members);
                        });
                    });
                }
                // v1.81: 缓存渲染结果(切 tab / 跨 session 0 ms 命中)
                faComputedCache.set('viContent_' + _viCacheKey, { html: viWrap.innerHTML, ts: Date.now() });
            }

            // v1.81: 价值洞察事件重绑(用于缓存命中时,innerHTML 替换后重新附加事件)
            function _viRebindValueInsightsEvents(viWrap) {
                var refreshBtn = viWrap.querySelector('#btn_refresh_value');
                if (refreshBtn) refreshBtn.addEventListener('click', function() { renderValueInsightsTab(true); });
                // 趋势图月度增量/累积价值切换 — 需要重新计算 monthlySorted(从 saves 重建)
                var trendToggle = viWrap.querySelector('[data-vi-trend-toggle]');
                if (trendToggle) {
                    trendToggle.querySelectorAll('button').forEach(function(btn) {
                        btn.addEventListener('click', function() {
                            viTrendMode = this.getAttribute('data-mode');
                            trendToggle.querySelectorAll('button').forEach(function(b) {
                                b.classList.remove('active');
                                b.style.background = 'transparent'; b.style.color = '#8097a8';
                            });
                            this.classList.add('active');
                            this.style.background = 'rgba(6,207,190,.2)'; this.style.color = '#06cfbe';
                            // 缓存命中时:简化处理 — 直接重新跑一遍 renderValueInsightsContent(无缓存)
                            // 切换模式比较少见,直接重算可接受
                            var viData = (typeof viCache !== 'undefined' && viCache) ? viCache : { priceData: {}, playtimeData: {}, updatedAt: 0 };
                            var members = (saves && saves.familyInfo && saves.familyInfo.family_member) ? saves.familyInfo.family_member : [];
                            if (members.length > 0 && viData.priceData) {
                                // 临时清缓存(避免递归)
                                var k = _faViContentCacheKey(viData.priceData, viData.playtimeData, {});
                                faComputedCache.invalidate('viContent_' + k);
                                renderValueInsightsContent(viWrap, viData.priceData, viData.playtimeData, members, {});
                            }
                        });
                    });
                }
            }

            // ---- 入库价值趋势（SVG 折线图，支持月度增量/累积价值切换）----
            function buildViTrendChart(monthlySorted, members) {
                var toggleHtml = '<div data-vi-trend-toggle style="display:flex;gap:2px;background:rgba(15,23,42,.6);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:2px;margin-left:auto;">'
                    + '<button data-mode="monthly" class="active" style="background:rgba(6,207,190,.2);color:#06cfbe;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;">月度增量</button>'
                    + '<button data-mode="cumulative" style="background:transparent;color:#8097a8;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;">累积价值</button>'
                    + '</div>';
                var titleHtml = '<div style="font-size:14px;font-weight:600;color:#c7d5e0;margin-bottom:10px;display:flex;align-items:center;gap:6px;">'
                    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#06cfbe" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>'
                    + '<span>入库价值趋势</span>' + toggleHtml + '</div>';
                return titleHtml + '<div data-vi-trend-svg>' + buildViTrendSvg(monthlySorted, members) + '</div>';
            }
            function buildViTrendSvg(monthlySorted, members) {
                if (monthlySorted.length === 0) return '<div style="text-align:center;padding:40px 20px;color:#8097a8;font-size:13px;">暂无入库时间数据</div>';
                var months = monthlySorted.map(function(x) { return x[0]; });
                var curSym = (typeof faCurrency !== 'undefined' && faCurrency.symbol) || '¥';
                var fmtY = function(v) { return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v); };
                // 自适应横轴标签稀疏化：年份标记(首行) + 月份间隔标签(次行)，避免压缩看不清
                function buildXLabels(pL, step, pT, cH) {
                    var cW = (months.length - 1) * step || 1;
                    var maxLabels = Math.floor(cW / 40); // 每个 label 至少约 40px
                    var interval = Math.max(1, Math.ceil(months.length / maxLabels));
                    var xLabels = '', lastYear = '';
                    months.forEach(function(m, i) {
                        var parts = m.split('-'), year = parts[0], mon = parts[1];
                        var cx = pL + i * step;
                        if (year !== lastYear) {
                            xLabels += '<text x="' + cx.toFixed(1) + '" y="' + (pT + cH + 16) + '" text-anchor="middle" fill="#06cfbe" font-size="10" font-weight="600">' + year + '</text>';
                            lastYear = year;
                        }
                        if (i % interval === 0) {
                            xLabels += '<text x="' + cx.toFixed(1) + '" y="' + (pT + cH + 30) + '" text-anchor="middle" fill="#8a9ba8" font-size="9">' + mon + '月</text>';
                        }
                    });
                    return xLabels;
                }

                if (viTrendMode === 'monthly') {
                    // 月度增量柱状图：每月原价(浅) + 实付(深) 双层柱，展示价值入库节奏
                    var vals = monthlySorted.map(function(x) { return x[1].original; });
                    var actVals = monthlySorted.map(function(x) { return x[1].actual; });
                    var maxV = Math.max.apply(null, vals.concat([1]));
                    var svgW = 540, svgH = 250, pL = 52, pR = 20, pT = 16, pB = 48;
                    var cW = svgW - pL - pR, cH = svgH - pT - pB;
                    var step = cW / (months.length > 1 ? months.length - 1 : 1);
                    var grid = '';
                    for (var i = 0; i <= 4; i++) {
                        var v = Math.round(maxV / 4 * i), y = pT + cH - (cH * i / 4);
                        grid += '<line x1="' + pL + '" y1="' + y.toFixed(1) + '" x2="' + (svgW - pR) + '" y2="' + y.toFixed(1) + '" stroke="rgba(255,255,255,.06)"/>';
                        grid += '<text x="' + (pL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" fill="#8a9ba8" font-size="10">' + fmtY(v) + '</text>';
                    }
                    var bars = '', barW = Math.min(step * 0.65, 22);
                    vals.forEach(function(val, i) {
                        var cx = pL + i * step, bh = (val / maxV) * cH, y = pT + cH - bh;
                        var av = actVals[i], ah = (av / maxV) * cH, ay = pT + cH - ah;
                        bars += '<rect x="' + (cx - barW / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="rgba(6,207,190,.35)" rx="2"><title>' + months[i] + ' · 原价 ' + curSym + fmtViMoney(val) + ' / 实付 ' + curSym + fmtViMoney(av) + '</title></rect>';
                        if (av > 0) bars += '<rect x="' + (cx - barW / 2).toFixed(1) + '" y="' + ay.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + ah.toFixed(1) + '" fill="rgba(6,207,190,.9)" rx="2"/>';
                    });
                    var xLabels = buildXLabels(pL, step, pT, cH);
                    var legendItems = [
                        '<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#94a3b8"><span style="width:12px;height:10px;border-radius:2px;background:rgba(6,207,190,.35);display:inline-block"></span>原价</span>',
                        '<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#94a3b8"><span style="width:12px;height:10px;border-radius:2px;background:#06cfbe;display:inline-block"></span>实付</span>'
                    ];
                    var legendHtml = '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(102,192,244,.12)">' + legendItems.join('') + '</div>';
                    return '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block;">' + grid + bars + xLabels + '<line x1="' + pL + '" y1="' + (pT + cH) + '" x2="' + (svgW - pR) + '" y2="' + (pT + cH) + '" stroke="rgba(255,255,255,.12)"/></svg>' + legendHtml;
                }

                // 累计模式：原价累计(虚线) + 实付累计(实线+面积) + 节省面积(绿) + 成员价值线
                var cumOrig = [], cumAct = [], cumMembers = {};
                var tO = 0, tA = 0, tM = {};
                members.forEach(function(m) { tM[m.steamid] = 0; cumMembers[m.steamid] = []; });
                monthlySorted.forEach(function(entry) {
                    var d = entry[1];
                    tO += d.original; tA += d.actual;
                    members.forEach(function(m) { tM[m.steamid] += (d.members[m.steamid] || 0); });
                    cumOrig.push(tO); cumAct.push(tA);
                    members.forEach(function(m) { cumMembers[m.steamid].push(tM[m.steamid]); });
                });
                var maxVal = cumOrig[cumOrig.length - 1] || 1;
                var svgW = 540, svgH = 250, pL = 52, pR = 20, pT = 16, pB = 48;
                var cW = svgW - pL - pR, cH = svgH - pT - pB;
                var step = cW / (months.length > 1 ? months.length - 1 : 1);
                var grid = '';
                for (var i = 0; i <= 5; i++) {
                    var v = Math.round(maxVal / 5 * i), y = pT + cH - (cH * i / 5);
                    grid += '<line x1="' + pL + '" y1="' + y.toFixed(1) + '" x2="' + (svgW - pR) + '" y2="' + y.toFixed(1) + '" stroke="rgba(255,255,255,.06)"/>';
                    grid += '<text x="' + (pL - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" fill="#8a9ba8" font-size="10">' + fmtY(v) + '</text>';
                }
                var origPts = cumOrig.map(function(val, i) { return (pL + i * step).toFixed(1) + ',' + (pT + cH - (val / maxVal) * cH).toFixed(1); });
                var actPts = cumAct.map(function(val, i) { return (pL + i * step).toFixed(1) + ',' + (pT + cH - (val / maxVal) * cH).toFixed(1); });
                // 节省面积：原价线正向 + 实付线逆向闭合
                var savePoly = origPts.slice();
                for (var j = cumAct.length - 1; j >= 0; j--) savePoly.push(actPts[j]);
                var saveArea = '<polygon points="' + savePoly.join(' ') + '" fill="rgba(46,213,115,.12)"><title>累计节省 ' + curSym + fmtViMoney(tO - tA) + '</title></polygon>';
                // 实付面积
                var actArea = '<polygon points="' + pL + ',' + (pT + cH) + ' ' + actPts.join(' ') + ' ' + (pL + (months.length - 1) * step).toFixed(1) + ',' + (pT + cH) + '" fill="rgba(6,207,190,.08)"/>';
                var actLine = '<polyline points="' + actPts.join(' ') + '" fill="none" stroke="#06cfbe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
                var origLine = '<polyline points="' + origPts.join(' ') + '" fill="none" stroke="#8a9ba8" stroke-width="1.5" stroke-dasharray="6 3" opacity=".7"/>';
                var memLines = '';
                members.forEach(function(m, mi) {
                    var c = growthColors[mi % growthColors.length];
                    var pts = cumMembers[m.steamid].map(function(val, i) { return (pL + i * step).toFixed(1) + ',' + (pT + cH - (val / maxVal) * cH).toFixed(1); }).join(' ');
                    memLines += '<polyline points="' + pts + '" fill="none" stroke="' + c + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".65"/>';
                });
                var xLabels = buildXLabels(pL, step, pT, cH);
                var legendItems = [
                    '<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#8a9ba8"><span style="width:18px;height:1.5px;border-top:1.5px dashed #8a9ba8;display:inline-block"></span>原价累计</span>',
                    '<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#06cfbe"><span style="width:12px;height:2px;border-radius:2px;background:#06cfbe;display:inline-block"></span>实付累计</span>',
                    '<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#2ed573"><span style="width:12px;height:10px;border-radius:2px;background:rgba(46,213,115,.25);display:inline-block"></span>节省</span>'
                ];
                members.forEach(function(m, mi) {
                    var c = growthColors[mi % growthColors.length];
                    legendItems.push('<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#94a3b8;"><span style="width:12px;height:2px;border-radius:2px;background:' + c + ';display:inline-block;opacity:.8;"></span>' + faEsc(m.userName || m.steamid) + '</span>');
                });
                var legendHtml = '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(102,192,244,.12)">' + legendItems.join('') + '</div>';
                return '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block;">' + grid + saveArea + actArea + actLine + origLine + memLines + xLabels + '<line x1="' + pL + '" y1="' + (pT + cH) + '" x2="' + (svgW - pR) + '" y2="' + (pT + cH) + '" stroke="rgba(255,255,255,.12)"/></svg>' + legendHtml;
            }

            // ---- 价格-时长散点图（X 对数刻度，Y 游玩时长，气泡=近两周，红框=踩雷区）----
            // v1.74：pending=true 时显示时长加载占位（价格先行渲染阶段）
            function buildViScatter(points, curSym, pending) {
                var titleHtml = '<div style="font-size:14px;font-weight:600;color:#c7d5e0;margin-bottom:10px;display:flex;align-items:center;gap:6px;">'
                    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#54a0ff" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="14" cy="14" r="1.5"/></svg>'
                    + '<span>价格-时长散点图</span></div>';
                if (pending) {
                    return titleHtml + '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:42px 20px;gap:10px;color:#8097a8;font-size:13px;">'
                        + '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#54a0ff" stroke-width="2" style="animation:fa-spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>'
                        + '<span>游玩时长统计中，完成后自动绘制…</span></div>';
                }
                if (points.length === 0) return titleHtml + '<div style="text-align:center;padding:30px 20px;color:#8097a8;font-size:13px;">暂无价格+游玩时长数据</div>';
                // 自适应 Y 轴上限：取游玩时长 90 分位后上浮 15% 再取整到 50 的倍数，避免上方大面积空白
                var sortedPt = points.map(function(d) { return d.playtime; }).sort(function(a, b) { return a - b; });
                var p90 = sortedPt.length > 0 ? sortedPt[Math.floor(sortedPt.length * 0.9)] : 50;
                var yMax = Math.max(50, Math.ceil((p90 * 1.15) / 50) * 50);
                if (yMax > 400) yMax = 400;
                var svgW = 380, svgH = 210, pL = 42, pR = 14, pT = 12, pB = 34;
                var cW = svgW - pL - pR, cH = svgH - pT - pB;
                var xMin = 0.5, xMax = 400;
                function p2x(p) { if (p <= 0) p = 0.5; return pL + (Math.log10(p) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin)) * cW; }
                function t2y(t) { return pT + cH - (Math.min(t, yMax) / yMax) * cH; }
                function r2r(r) { return 2.5 + Math.min(r / 80, 1) * 5; }
                var grid = '';
                var yStep = yMax / 5;
                for (var yi = 0; yi <= 5; yi++) {
                    var vv = Math.round(yStep * yi), yy = pT + cH - (vv / yMax) * cH;
                    grid += '<line x1="' + pL + '" y1="' + yy.toFixed(1) + '" x2="' + (svgW - pR) + '" y2="' + yy.toFixed(1) + '" stroke="rgba(255,255,255,.06)"/>';
                    grid += '<text x="' + (pL - 6) + '" y="' + (yy + 3).toFixed(1) + '" text-anchor="end" fill="#8a9ba8" font-size="9">' + vv + 'h</text>';
                }
                [1, 5, 10, 50, 100, 200, 400].forEach(function(v) {
                    var x = p2x(v); if (x < pL || x > svgW - pR) return;
                    grid += '<line x1="' + x.toFixed(1) + '" y1="' + pT + '" x2="' + x.toFixed(1) + '" y2="' + (pT + cH) + '" stroke="rgba(255,255,255,.04)"/>';
                    grid += '<text x="' + x.toFixed(1) + '" y="' + (pT + cH + 15) + '" text-anchor="middle" fill="#8a9ba8" font-size="9">' + curSym + v + '</text>';
                });
                // 踩雷警戒区（¥100+ 且 <10h）
                var rx = p2x(100), ry = t2y(10);
                var zone = '<rect x="' + rx.toFixed(1) + '" y="' + ry.toFixed(1) + '" width="' + (svgW - pR - rx).toFixed(1) + '" height="' + (pT + cH - ry).toFixed(1) + '" fill="rgba(255,107,107,.06)" stroke="rgba(255,107,107,.2)" stroke-dasharray="4 3" rx="4"/>';
                zone += '<line x1="' + rx.toFixed(1) + '" y1="' + pT + '" x2="' + rx.toFixed(1) + '" y2="' + (pT + cH) + '" stroke="rgba(255,107,107,.2)" stroke-dasharray="4 3"/>';
                zone += '<line x1="' + pL + '" y1="' + ry.toFixed(1) + '" x2="' + (svgW - pR) + '" y2="' + ry.toFixed(1) + '" stroke="rgba(255,107,107,.2)" stroke-dasharray="4 3"/>';
                var dots = '';
                points.forEach(function(d) {
                    var x = p2x(d.price), y = t2y(d.playtime), r = r2r(d.recent);
                    var c = d.ownerIdx >= 0 ? growthColors[d.ownerIdx % growthColors.length] : '#64748b';
                    var isRegret = d.price >= 100 && d.playtime < 10;
                    dots += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r.toFixed(1) + '" fill="' + c + '" fill-opacity="' + (isRegret ? 0.7 : 0.45) + '" stroke="' + (isRegret ? '#ff6b6b' : c) + '" stroke-width="' + (isRegret ? 1.5 : 0.5) + '" opacity="' + (isRegret ? 1 : 0.8) + '"><title>' + faEsc(d.name) + ' | ' + curSym + d.price + ' | ' + d.playtime.toFixed(1) + 'h | 近两周 ' + d.recent.toFixed(1) + 'h</title></circle>';
                });
                var svg = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block;">' + grid + zone + dots + '<line x1="' + pL + '" y1="' + (pT + cH) + '" x2="' + (svgW - pR) + '" y2="' + (pT + cH) + '" stroke="rgba(255,255,255,.12)"/><line x1="' + pL + '" y1="' + pT + '" x2="' + pL + '" y2="' + (pT + cH) + '" stroke="rgba(255,255,255,.12)"/></svg>';
                var desc = '<div style="font-size:10px;color:#64748b;margin-top:6px;text-align:center;">X轴：价格（对数刻度） · Y轴：总游玩时长 · 气泡大小：近两周时长 · <span style="color:#ff6b6b">红框=踩雷区（' + curSym + '100+ 且 &lt;10h）</span></div>';
                return titleHtml + svg + desc;
            }

            // ---- 价格档位热力图（月份 × 价格档位矩阵，近6个月）----
            function buildViHeatmap(monthlySorted, priceTiers, curSym) {
                var titleHtml = '<div style="font-size:14px;font-weight:600;color:#c7d5e0;margin-bottom:10px;display:flex;align-items:center;gap:6px;">'
                    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ff9f43" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'
                    + '<span>价格档位热力图（近 6 个月）</span></div>';
                if (monthlySorted.length === 0) return titleHtml + '<div style="text-align:center;padding:30px 20px;color:#8097a8;font-size:13px;">暂无入库时间数据</div>';
                var recentMonths = monthlySorted.slice(-6);
                var maxVal = 1;
                recentMonths.forEach(function(entry) { entry[1].tiers.forEach(function(v) { if (v > maxVal) maxVal = v; }); });
                function hColor(v) {
                    if (v === 0) return 'rgba(255,255,255,.02)';
                    var t = v / maxVal;
                    if (t < 0.25) return 'rgba(84,160,255,' + (0.1 + t * 1.2).toFixed(2) + ')';
                    if (t < 0.5) return 'rgba(6,207,190,' + (0.15 + t * 0.8).toFixed(2) + ')';
                    if (t < 0.75) return 'rgba(255,159,67,' + (0.2 + t * 0.7).toFixed(2) + ')';
                    return 'rgba(255,107,107,' + (0.25 + t * 0.6).toFixed(2) + ')';
                }
                function fmtV(v) { return v > 0 ? (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v) : '-'; }
                var html = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:separate;border-spacing:3px;font-size:11px;"><thead><tr><th></th>';
                priceTiers.forEach(function(t) { html += '<th style="text-align:center;color:#64748b;font-size:10px;font-weight:500;padding:4px 2px;white-space:nowrap;">' + t.name + '</th>'; });
                html += '</tr></thead><tbody>';
                recentMonths.forEach(function(entry) {
                    var mk = entry[0], parts = mk.split('-');
                    html += '<tr><td style="text-align:right;color:#94a3b8;font-size:10px;font-weight:500;padding:4px;">' + parts[0] + '-' + parts[1] + '</td>';
                    entry[1].tiers.forEach(function(v) {
                        html += '<td style="text-align:center;padding:8px 4px;border-radius:4px;font-weight:600;font-variant-numeric:tabular-nums;background:' + hColor(v) + ';color:' + (v === 0 ? '#475569' : (v >= 1000 ? '#fff' : '#c6d4df')) + ';" title="' + mk + ' · ' + curSym + v + '">' + fmtV(v) + '</td>';
                    });
                    html += '</tr>';
                });
                html += '</tbody></table></div>';
                return titleHtml + html;
            }

            // ---- 成员价值贡献（头像 + 价值/游戏/均时/折扣 + 贡献占比条）----
            // v1.74：pending=true 时"均时"列显示统计占位（时长数据未就绪）
            function buildViMemberContribution(memberStats, members, totalOriginal, idMap, curSym, pending) {
                var titleHtml = '<div style="font-size:14px;font-weight:600;color:#c7d5e0;margin-bottom:10px;display:flex;align-items:center;gap:6px;">'
                    + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M19 9a5 5 0 0 0-9-3"/><circle cx="9" cy="14" r="1.5" fill="#a78bfa"/></svg>'
                    + '<span>成员价值贡献</span></div>';
                var html = '';
                members.forEach(function(m, mi) {
                    var s = memberStats[m.steamid] || { original: 0, actual: 0, games: 0, playtime: 0, discountSum: 0, discountCount: 0 };
                    var c = growthColors[mi % growthColors.length];
                    var pct = totalOriginal > 0 ? (s.original / totalOriginal * 100).toFixed(1) : '0.0';
                    var avgDisc = s.discountCount > 0 ? Math.round(s.discountSum / s.discountCount) : 0;
                    var cph = s.playtime > 0 ? (s.actual / (s.playtime / 60)).toFixed(2) : '-';
                    var name = m.userName || idMap[m.steamid] || ('ID:' + String(m.steamid).slice(-4));
                    var ch = name.charAt(0).toUpperCase();
                    html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:8px;margin-bottom:8px;transition:border-color .2s,background .2s;" onmouseover="this.style.borderColor=\'rgba(6,207,190,.35)\';this.style.background=\'rgba(6,207,190,.04)\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,.08)\';this.style.background=\'rgba(255,255,255,.02)\'">'
                        + '<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:' + c + ';color:#fff;font-size:13px;font-weight:700;flex-shrink:0;">' + ch + '</span>'
                        + '<div style="flex:1;min-width:0;">'
                        + '<div style="font-size:13px;font-weight:600;color:#c6d4df;">' + faEsc(name) + '</div>'
                        + '<div style="display:flex;gap:10px;margin-top:3px;font-size:10px;color:#8097a8;flex-wrap:wrap;">'
                        + '<span>游戏 <b style="color:#c6d4df;">' + s.games + '</b></span>'
                        + '<span>价值 <b style="color:#c6d4df;">' + curSym + fmtViMoney(s.original) + '</b></span>'
                        + '<span>均时 <b style="color:#c6d4df;">' + (pending ? '…' : curSym + cph + '/h') + '</b></span>'
                        + '<span>折扣 <b style="color:#c6d4df;">' + avgDisc + '%</b></span>'
                        + '</div></div>'
                        + '<div style="width:80px;height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;flex-shrink:0;"><div style="height:100%;width:' + pct + '%;background:' + c + ';border-radius:3px;transition:width .4s;"></div></div>'
                        + '<span style="font-size:12px;font-weight:700;color:' + c + ';flex-shrink:0;min-width:40px;text-align:right;">' + pct + '%</span>'
                        + '</div>';
                });
                return titleHtml + html;
            }

            function renderPlayActivityTab(forceRefresh) {
                var paWrap = panel.querySelector('[data-playactivity-content]');
                if (!paWrap) return;
                var members = (saves && saves.familyInfo && Array.isArray(saves.familyInfo.family_member)) ? saves.familyInfo.family_member : [];
                if (members.length === 0) {
                    paWrap.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#8097a8;font-size:13px;">暂无家庭成员数据，请先扫描家庭库</div>';
                    return;
                }
                if (!access_token) {
                    paWrap.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#8097a8;font-size:13px;">访问令牌不可用，请在 Steam 商店页面打开此面板</div>';
                    return;
                }
                // 手动点击"刷新动态"：清空缓存，走全量加载
                if (forceRefresh) { paCache.data = null; paCache.updatedAt = 0; faToast.info('正在刷新游玩动态…'); }
                var hasCache = paCache.data && Object.keys(paCache.data).length > 0;
                if (hasCache) {
                    // 先渲染缓存内容，重开面板秒开
                    renderPlayActivityContent(paWrap, paCache.data, members);
                    // 缓存新鲜则直接返回，不发任何请求
                    if (Date.now() - paCache.updatedAt < PA_CACHE_TTL) return;
                    // 缓存过期：后台静默刷新，完成后自动更新界面
                    refreshPlayActivityData(members);
                    return;
                }
                // 无缓存：显示加载动画并全量加载
                paWrap.innerHTML = createLoadingHtml('正在加载家庭成员游玩动态与总时长…');
                refreshPlayActivityData(members);
            }
            // 拉取全部成员的游玩数据并写入缓存；完成后仅在面板仍打开时刷新界面
            function refreshPlayActivityData(members) {
                if (playActivityLoading) return;
                playActivityLoading = true;
                Promise.all(members.map(function(m) { return fetchMemberRecentlyPlayed(access_token, m.steamid); })).then(function(results) {
                    // 同时获取每个成员的完整总游玩时长（GetOwnedGames）
                    return Promise.all(members.map(function(m) { return fetchMemberOwnedGamesTotal(access_token, m.steamid); })).then(function(totalResults) {
                        playActivityLoading = false;
                        var data = {};
                        members.forEach(function(m, i) {
                            data[m.steamid] = {
                                steamid: m.steamid,
                                memberName: m.userName || (saves.familyInfo.steamIdtoName ? saves.familyInfo.steamIdtoName[m.steamid] : '') || ('ID:' + String(m.steamid).slice(-4)),
                                result: results[i],
                                ownedTotal: totalResults[i] ? totalResults[i].totalMinutes : -1,
                                ownedGameCount: totalResults[i] ? totalResults[i].gameCount : 0
                            };
                        });
                        paCache.data = data;
                        paCache.updatedAt = Date.now();
                        // 后台静默刷新场景下面板可能已被关闭，避免写入已移除的 DOM
                        var currentPanel = document.getElementById('familyAnalysisPanel');
                        if (!currentPanel) return;
                        var currentWrap = currentPanel.querySelector('[data-playactivity-content]');
                        if (currentWrap) renderPlayActivityContent(currentWrap, paCache.data, members);
                        faToast.success('游玩动态已更新');
                    });
                }).catch(function(err) {
                    playActivityLoading = false;
                    console.warn('[FA] 游玩动态刷新失败:', err);
                    faToast.error('游玩动态刷新失败');
                });
            }
            function renderPlayActivityContent(paWrap, data, members) {
                // v1.57: 统一使用家庭库贡献数（GameInfo.owners 统计），与贡献分布/雷达图等标签页保持一致
                // 不再使用 GetOwnedGames 的个人游戏总数，避免不同标签页统计逻辑不一致
                var libContribution = {};
                members.forEach(function(m) { libContribution[m.steamid] = 0; });
                var _gameInfo = saves.familyGameList.GameInfo;
                for (var _aid in _gameInfo) {
                    var _owners = _gameInfo[_aid].owners;
                    if (_owners) {
                        for (var _oi = 0; _oi < _owners.length; _oi++) {
                            if (libContribution[_owners[_oi]] !== undefined) libContribution[_owners[_oi]]++;
                        }
                    }
                }
                var stats = members.map(function(m, i) {
                    var d = data[m.steamid];
                    var games = (d && d.result && d.result.games) ? d.result.games : [];
                    var recent = 0, recentTotal = 0;
                    games.forEach(function(g) { recent += (g.playtime_2weeks || 0); recentTotal += (g.playtime_forever || 0); });
                    // 使用 GetOwnedGames 获取的真实总游玩时长（含所有拥有游戏），而非仅最近2周游玩的游戏
                    var trueTotal = (d && d.ownedTotal !== undefined && d.ownedTotal >= 0) ? d.ownedTotal : recentTotal;
                    return {
                        steamid: m.steamid,
                        name: d ? d.memberName : (m.userName || 'ID:' + String(m.steamid).slice(-4)),
                        recent: recent, total: trueTotal, recentTotal: recentTotal, games: games,
                        libCount: libContribution[m.steamid] || 0, // v1.57: 家庭库贡献数
                        personalCount: d ? d.ownedGameCount : 0,   // v1.57: 个人拥有游戏数（保留用于 tooltip）
                        count: (d && d.result) ? d.result.total_count : games.length,
                        color: growthColors[i % growthColors.length]
                    };
                });
                var maxRecent = 1, maxTotal = 1, sumRecent = 0, sumTotal = 0;
                stats.forEach(function(s) {
                    if (s.recent > maxRecent) maxRecent = s.recent;
                    if (s.total > maxTotal) maxTotal = s.total;
                    sumRecent += s.recent; sumTotal += s.total;
                });
                // 找出最活跃成员
                var mostActive = stats.slice().sort(function(a, b) { return b.recent - a.recent; })[0];
                var avgRecent = stats.length > 0 ? sumRecent / stats.length : 0;

                // v1.40：展示缓存更新时间，便于感知数据新鲜度
                var paUpdatedText = paCache.updatedAt ? new Date(paCache.updatedAt).toLocaleTimeString('zh-CN', { hour12: false }) : '未知';
                var html = '';

                // ===== 置顶 KPI 仪表盘 =====
                html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">';
                // 总游玩时长
                html += '<div style="background:linear-gradient(135deg,#06cfbe18 0%,#06cfbe06 100%);border:1px solid #06cfbe25;border-radius:10px;padding:12px 8px;text-align:center;position:relative;overflow:hidden;">'
                    + '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#06cfbe,transparent);"></div>'
                    + '<div style="font-size:26px;font-weight:800;color:#06cfbe;line-height:1.1;letter-spacing:-0.5px;">' + faFmtHours(sumTotal) + '</div>'
                    + '<div style="font-size:11px;color:#8097a8;margin-top:4px;">家庭总游玩时长</div>'
                    + '<div style="font-size:9px;color:#475569;margin-top:2px;">全体成员累计</div>'
                    + '</div>';
                // 近2周游玩时长
                html += '<div style="background:linear-gradient(135deg,#fbbf2418 0%,#fbbf2406 100%);border:1px solid #fbbf2425;border-radius:10px;padding:12px 8px;text-align:center;position:relative;overflow:hidden;">'
                    + '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#fbbf24,transparent);"></div>'
                    + '<div style="font-size:26px;font-weight:800;color:#fbbf24;line-height:1.1;letter-spacing:-0.5px;">' + faFmtHours(sumRecent) + '</div>'
                    + '<div style="font-size:11px;color:#8097a8;margin-top:4px;">近2周游玩时长</div>'
                    + '<div style="font-size:9px;color:#475569;margin-top:2px;">全体成员合计</div>'
                    + '</div>';
                // 人均近2周
                html += '<div style="background:linear-gradient(135deg,#54a0ff18 0%,#54a0ff06 100%);border:1px solid #54a0ff25;border-radius:10px;padding:12px 8px;text-align:center;position:relative;overflow:hidden;">'
                    + '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#54a0ff,transparent);"></div>'
                    + '<div style="font-size:26px;font-weight:800;color:#54a0ff;line-height:1.1;letter-spacing:-0.5px;">' + faFmtHours(avgRecent) + '</div>'
                    + '<div style="font-size:11px;color:#8097a8;margin-top:4px;">人均近2周</div>'
                    + '<div style="font-size:9px;color:#475569;margin-top:2px;">' + members.length + ' 名成员</div>'
                    + '</div>';
                // 最活跃成员
                var maColor = mostActive ? mostActive.color : '#2ed573';
                html += '<div style="background:linear-gradient(135deg,' + maColor + '18 0%,' + maColor + '06 100%);border:1px solid ' + maColor + '25;border-radius:10px;padding:12px 8px;text-align:center;position:relative;overflow:hidden;">'
                    + '<div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,' + maColor + ',transparent);"></div>'
                    + '<div style="font-size:16px;font-weight:700;color:' + maColor + ';line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (mostActive ? faEsc(mostActive.name) : '-') + '</div>'
                    + '<div style="font-size:11px;color:#8097a8;margin-top:4px;">近2周最活跃</div>'
                    + '<div style="font-size:9px;color:#475569;margin-top:2px;">' + (mostActive ? faFmtHours(mostActive.recent) : '') + '</div>'
                    + '</div>';
                html += '</div>';

                // ===== 工具栏 =====
                html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;flex-wrap:wrap;">'
                    + '<div style="font-size:11px;color:#64748b;">数据来源：Steam Web API · 更新于 ' + paUpdatedText + '</div>'
                    + '<button id="btn_refresh_playactivity" class="fa-btn-green">刷新动态</button>'
                    + '</div>';

                // ===== 成员游玩卡片（参考参考图：双进度条 + 游戏封面网格） =====
                html += '<div style="font-size:13px;font-weight:600;color:#c7d5e0;margin:4px 2px 8px;">成员游玩详情</div>';
                var sorted = stats.slice().sort(function(a, b) { return b.recent - a.recent; });
                sorted.forEach(function(s, idx) {
                    var gamesSorted = s.games.slice().sort(function(a, b) { return (b.playtime_2weeks || 0) - (a.playtime_2weeks || 0) || (b.playtime_forever || 0) - (a.playtime_forever || 0); });
                    var recentPct = maxRecent > 0 ? (s.recent / maxRecent * 100) : 0;
                    var totalPct = maxTotal > 0 ? (s.total / maxTotal * 100) : 0;
                    var recentBarPct = s.recent > 0 ? Math.max(2, recentPct) : 0;
                    var totalBarPct = s.total > 0 ? Math.max(2, totalPct) : 0;
                    var initial = (s.name || '?').charAt(0).toUpperCase() || '?';

                    // 成员卡片头部
                    html += '<div class="fa-member-card" style="background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.08);border-left:3px solid ' + s.color + ';border-radius:10px;padding:10px 12px;margin-bottom:8px;">';
                    // 头部行：头像 + 名称 + 统计摘要 + 折叠箭头
                    html += '<div class="fa-member-header" data-fa-member-idx="' + idx + '" style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;border-radius:6px;padding:4px 6px;margin:-4px -6px;transition:background 0.15s ease;" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'transparent\'">'
                        + '<span style="width:28px;height:28px;border-radius:50%;background:' + s.color + '22;color:' + s.color + ';display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;">' + faEsc(initial) + '</span>'
                        + '<div style="flex:1;min-width:0;">'
                        + '<div style="font-size:13px;font-weight:700;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + faEsc(s.name) + '</div>'
                        + '<div style="font-size:10px;color:#64748b;margin-top:1px;" title="家庭库贡献: ' + s.libCount + ' 款 · 个人库拥有: ' + s.personalCount + ' 款">库内贡献 <b style="color:#c6d4df;">' + s.libCount + '</b> 款 · 近2周游玩 <b style="color:#fbbf24;">' + s.count + '</b> 款</div>'
                        + '</div>'
                        + '<svg class="fa-member-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#8097a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:transform 0.2s ease;"><polyline points="6 9 12 15 18 9"/></svg>'
                        + '</div>';

                    // 双进度条区域（参考参考图：绿色=近2周，黄色=总计）
                    html += '<div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">';
                    // 近2周进度条
                    html += '<div style="display:flex;align-items:center;gap:8px;">'
                        + '<span style="flex-shrink:0;width:52px;font-size:10px;color:#8097a8;">近2周</span>'
                        + '<div style="flex:1;height:7px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;">'
                        + '<div style="height:100%;width:' + recentBarPct.toFixed(1) + '%;background:linear-gradient(90deg,' + s.color + ',' + s.color + 'aa);border-radius:4px;transition:width 0.5s ease;"></div>'
                        + '</div>'
                        + '<span style="flex-shrink:0;min-width:56px;text-align:right;font-size:11px;font-weight:700;color:' + s.color + ';">' + faFmtHours(s.recent) + '</span>'
                        + '</div>';
                    // 总计进度条
                    html += '<div style="display:flex;align-items:center;gap:8px;">'
                        + '<span style="flex-shrink:0;width:52px;font-size:10px;color:#8097a8;">总计</span>'
                        + '<div style="flex:1;height:7px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;">'
                        + '<div style="height:100%;width:' + totalBarPct.toFixed(1) + '%;background:linear-gradient(90deg,#fbbf24,#fbbf2499);border-radius:4px;transition:width 0.5s ease;"></div>'
                        + '</div>'
                        + '<span style="flex-shrink:0;min-width:56px;text-align:right;font-size:11px;font-weight:600;color:#fbbf24;">' + faFmtHours(s.total) + '</span>'
                        + '</div>';
                    html += '</div>';

                    // 游戏封面网格（可折叠）
                    html += '<div class="fa-member-body" style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">';
                    if (gamesSorted.length > 0) {
                        html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">';
                        gamesSorted.forEach(function(g) {
                            var gRecent = faFmtHours(g.playtime_2weeks || 0);
                            var gTotal = faFmtHours(g.playtime_forever || 0);
                            html += '<div style="display:flex;gap:6px;padding:5px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.04);border-radius:6px;min-width:0;">'
                                + '<img data-fa-cover="' + g.appid + '" loading="lazy" src="' + FA_COVER_SVG + '" style="width:36px;height:36px;border-radius:5px;flex-shrink:0;object-fit:cover;background:#1b2838;">'
                                + '<div style="flex:1;min-width:0;">'
                                + '<a data-fa-appid="' + g.appid + '" href="https://store.steampowered.com/app/' + g.appid + '" target="_blank" style="font-size:10px;font-weight:600;color:#e2e8f0;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;" onmouseover="this.style.color=\'#06cfbe\'" onmouseout="this.style.color=\'#e2e8f0\'">' + faEsc(g.name) + '</a>'
                                + '<div style="font-size:9px;color:#64748b;margin-top:2px;white-space:nowrap;">'
                                + '<span style="color:' + s.color + ';font-weight:600;">' + gRecent + '</span>'
                                + ' / <span style="color:#fbbf24;">' + gTotal + '</span>'
                                + '</div>'
                                + '</div></div>';
                        });
                        html += '</div>';
                    } else {
                        html += '<div style="text-align:center;font-size:11px;color:#64748b;padding:12px;">最近 2 周暂无游玩记录</div>';
                    }
                    html += '</div>'; // fa-member-body
                    html += '</div>'; // fa-member-card
                });

                paWrap.innerHTML = html;
                var refreshBtn = paWrap.querySelector('#btn_refresh_playactivity');
                if (refreshBtn) refreshBtn.addEventListener('click', function() { renderPlayActivityTab(true); });
                // 异步加载游戏中文名（参考 steam-friend-manager loadGameZhName）
                paWrap.querySelectorAll('a[data-fa-appid]').forEach(function(el) {
                    var aid = el.getAttribute('data-fa-appid');
                    faLoadGameZhName(el, aid, el.textContent);
                });
                // v1.55：多 CDN 封面图 fallback（参考 steam-friend-manager dashLoadCapsule）
                paWrap.querySelectorAll('img[data-fa-cover]').forEach(function(img) {
                    faLoadCover(img, img.getAttribute('data-fa-cover'));
                });
                // 按好友折叠/展开：点击成员卡片头部切换游戏列表显隐（默认全部展开）
                paWrap.querySelectorAll('.fa-member-header').forEach(function(hdr) {
                    hdr.addEventListener('click', function(e) {
                        // 点击成员名链接时不触发折叠
                        if (e.target.tagName === 'A') return;
                        var card = hdr.closest('.fa-member-card');
                        if (!card) return;
                        var body = card.querySelector('.fa-member-body');
                        var chevron = hdr.querySelector('.fa-member-chevron');
                        if (!body) return;
                        var isHidden = body.style.display === 'none';
                        body.style.display = isHidden ? 'block' : 'none';
                        if (chevron) chevron.style.transform = isHidden ? '' : 'rotate(-90deg)';
                    });
                });
            }

            // ===================== 入库热力图渲染（v1.38 新增, v1.41 性能优化） =====================
            var hmCache = { gridKeys: null, gridMeta: null };
            function renderHeatmapTab() {
                var hmWrap = panel.querySelector('[data-heatmap-content]');
                if (!hmWrap) return;
                var gameInfo = saves.familyGameList.GameInfo;
                var members = (saves && saves.familyInfo && Array.isArray(saves.familyInfo.family_member)) ? saves.familyInfo.family_member : [];

                // v1.41 优化：单次遍历计算所有热力图数据
                var allHm = computeAllHeatmaps(gameInfo, members);
                var hm = allHm.family;
                if (!hm) {
                    hmWrap.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#8097a8;font-size:13px;">暂无入库时间数据，无法生成热力图</div>';
                    return;
                }

                // v1.41 优化：预计算日期网格（所有热力图共享），避免每个 cell 创建 Date 对象
                if (!hmCache.gridKeys || hmCache.gridMeta.firstTs !== hm.firstTs) {
                    var globalStart = new Date(hm.firstTs * 1000);
                    globalStart.setHours(0, 0, 0, 0);
                    var globalStartDay = globalStart.getDay();
                    var gridStart = new Date(globalStart);
                    gridStart.setDate(gridStart.getDate() - globalStartDay);
                    var endDate = new Date();
                    endDate.setHours(0, 0, 0, 0);
                    var totalDays = Math.floor((endDate - gridStart) / 86400000) + 1;
                    var totalWeeks = Math.ceil(totalDays / 7);
                    // v1.57: 预计算所有 cell 的 date key、月份/年份标签位置
                    var gridKeys = [];
                    var monthLabelPositions = [];
                    var yearBoundaries = [];
                    var lastMonthKey = -1, lastYear = -1;
                    var _ms = gridStart.getTime();
                    for (var w = 0; w < totalWeeks; w++) {
                        for (var d = 0; d < 7; d++) {
                            var cellTs = _ms + (w * 7 + d) * 86400000;
                            var cellDate = new Date(cellTs);
                            var cellYear = cellDate.getFullYear();
                            var cellMonth = cellDate.getMonth();
                            var key = cellYear + '-' + String(cellMonth + 1).padStart(2, '0') + '-' + String(cellDate.getDate()).padStart(2, '0');
                            gridKeys.push({ key: key, w: w, d: d, ts: cellTs, month: cellMonth, year: cellYear, inRange: cellTs >= globalStart.getTime() && cellTs <= endDate.getTime() });
                            if (d === 0 && cellTs >= globalStart.getTime() && cellTs <= endDate.getTime()) {
                                var mk = cellYear * 12 + cellMonth;
                                if (mk !== lastMonthKey) {
                                    lastMonthKey = mk;
                                    monthLabelPositions.push({ w: w, month: cellMonth, year: cellYear });
                                }
                                if (cellYear !== lastYear) {
                                    lastYear = cellYear;
                                    yearBoundaries.push({ w: w, year: cellYear });
                                }
                            }
                        }
                    }
                    hmCache.gridKeys = gridKeys;
                    hmCache.gridMeta = { firstTs: hm.firstTs, totalWeeks: totalWeeks, monthLabelPositions: monthLabelPositions, yearBoundaries: yearBoundaries };
                }

                var gridKeys = hmCache.gridKeys;
                var totalWeeks = hmCache.gridMeta.totalWeeks;
                var monthLabelPositions = hmCache.gridMeta.monthLabelPositions;
                var yearBoundaries = hmCache.gridMeta.yearBoundaries;
                var cellSize = 13, cellGap = 3, cellStep = cellSize + cellGap;
                var labelW = 28, yearH = 14, monthH = 16;
                var topH = yearH + monthH;
                var svgW = labelW + totalWeeks * cellStep + 10;
                var svgH = topH + 7 * cellStep + 10;
                var monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
                var dayNames = ['', '一', '', '三', '', '五', ''];

                // v1.57: 动态生成 6 级色阶（从暗到亮），替代固定 5 级方案
                function faHexLerp(c1, c2, t) {
                    var r1 = parseInt(c1.slice(1,3),16), g1 = parseInt(c1.slice(3,5),16), b1 = parseInt(c1.slice(5,7),16);
                    var r2 = parseInt(c2.slice(1,3),16), g2 = parseInt(c2.slice(3,5),16), b2 = parseInt(c2.slice(5,7),16);
                    var r = Math.round(r1+(r2-r1)*t), g = Math.round(g1+(g2-g1)*t), b = Math.round(b1+(b2-b1)*t);
                    return '#' + ('0'+r.toString(16)).slice(-2) + ('0'+g.toString(16)).slice(-2) + ('0'+b.toString(16)).slice(-2);
                }
                function makeColorScheme(baseColor) {
                    var darkBg = '#1a2a3a';
                    var levels = [darkBg];
                    for (var i = 1; i <= 5; i++) {
                        levels.push(faHexLerp(darkBg, baseColor, Math.pow(i/5, 0.7)));
                    }
                    return levels;
                }

                // v1.41 优化：使用预计算网格构建 SVG，避免逐 cell 创建 Date 对象
                function buildHeatmapBlock(hmData, colors, title, ownerLabel) {
                    if (!hmData) {
                        return '<div style="background:rgba(15,23,42,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px;margin-bottom:8px;">'
                            + '<div style="font-size:13px;font-weight:600;color:#c7d5e0;margin-bottom:4px;">' + faEsc(title) + '</div>'
                            + '<div style="text-align:center;padding:16px;color:#64748b;font-size:12px;">暂无入库时间数据</div></div>';
                    }
                    // v1.57: 动态颜色分级，基于 maxDaily 自适应阈值，5个和500个不再同色
                    function heatColor(count) {
                        if (count === 0) return colors[0];
                        var max = hmData.maxDaily;
                        if (max <= 5) {
                            if (count === 1) return colors[1];
                            if (count === 2) return colors[2];
                            if (count <= 3) return colors[3];
                            if (count <= 4) return colors[4];
                            return colors[5];
                        }
                        var ratio = count / max;
                        if (ratio <= 0.1) return colors[1];
                        if (ratio <= 0.25) return colors[2];
                        if (ratio <= 0.5) return colors[3];
                        if (ratio <= 0.75) return colors[4];
                        return colors[5];
                    }
                    // v1.57: 生成图例阈值标签
                    function getThresholdLabels(max) {
                        if (max <= 5) return ['1', '2', '3', '4', '5+'];
                        return ['≤' + Math.ceil(max * 0.1), '≤' + Math.ceil(max * 0.25), '≤' + Math.ceil(max * 0.5), '≤' + Math.ceil(max * 0.75), '>' + Math.ceil(max * 0.75)];
                    }
                    // v1.41 优化：用数组 join 替代字符串拼接，减少 GC 压力
                    var cellParts = [];
                    var dayMap = hmData.dayMap;
                    for (var i = 0; i < gridKeys.length; i++) {
                        var gk = gridKeys[i];
                        if (!gk.inRange) continue;
                        var cnt = dayMap[gk.key] || 0;
                        var x = labelW + gk.w * cellStep, y = topH + gk.d * cellStep;
                        // v1.41 优化：仅在有数据时才加 title（大部分 cell 为 0，省掉大量 title 解析）
                        if (cnt > 0) {
                            cellParts.push('<rect x="' + x + '" y="' + y + '" width="' + cellSize + '" height="' + cellSize + '" rx="2" fill="' + heatColor(cnt) + '"><title>' + ownerLabel + '：' + gk.key + ' · ' + cnt + ' 个游戏入库</title></rect>');
                        } else {
                            cellParts.push('<rect x="' + x + '" y="' + y + '" width="' + cellSize + '" height="' + cellSize + '" rx="2" fill="' + colors[0] + '"/>');
                        }
                    }
                    // v1.57: 年份分隔线 + 年份标签
                    var yearParts = [];
                    for (var yi = 0; yi < yearBoundaries.length; yi++) {
                        var yb = yearBoundaries[yi];
                        var lineX = labelW + yb.w * cellStep - cellGap / 2;
                        yearParts.push('<line x1="' + lineX + '" y1="' + yearH + '" x2="' + lineX + '" y2="' + (topH + 7 * cellStep) + '" stroke="rgba(255,255,255,0.12)" stroke-width="1" stroke-dasharray="2,2"/>');
                        yearParts.push('<text x="' + (labelW + yb.w * cellStep) + '" y="' + (yearH - 3) + '" fill="#c6d4df" font-size="10" font-weight="600">' + yb.year + '</text>');
                    }
                    var monthParts = [];
                    for (var mi = 0; mi < monthLabelPositions.length; mi++) {
                        var ml = monthLabelPositions[mi];
                        monthParts.push('<text x="' + (labelW + ml.w * cellStep) + '" y="' + (yearH + monthH - 5) + '" fill="#8a9ba8" font-size="10">' + monthNames[ml.month] + '</text>');
                    }
                    var dayParts = [];
                    for (var di = 0; di < 7; di++) {
                        if (dayNames[di]) dayParts.push('<text x="0" y="' + (topH + di * cellStep + 10) + '" fill="#64748b" font-size="10">' + dayNames[di] + '</text>');
                    }
                    var svgStr = '<svg width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '" style="display:block;">' + yearParts.join('') + monthParts.join('') + dayParts.join('') + cellParts.join('') + '</svg>';
                    // v1.57: 图例显示阈值范围，让用户一眼看出颜色对应的入库数量
                    var thresholds = getThresholdLabels(hmData.maxDaily);
                    var legendSquares = '';
                    for (var li = 1; li <= 5; li++) {
                        legendSquares += '<span style="display:inline-flex;flex-direction:column;align-items:center;gap:1px;"><span style="width:10px;height:10px;border-radius:2px;background:' + colors[li] + ';display:inline-block"></span><span style="font-size:8px;color:#64748b;">' + thresholds[li-1] + '</span></span>';
                    }
                    var legend = '<div style="display:flex;align-items:flex-end;gap:4px;font-size:10px;color:#8a9ba8;margin-top:6px;justify-content:flex-end;">'
                        + '<span>少</span>' + legendSquares + '<span>多</span></div>';
                    var firstDate = new Date(hmData.firstTs * 1000), lastDate = new Date(hmData.lastTs * 1000);
                    var fmtD = function(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
                    var summary = '<div style="display:flex;gap:10px;font-size:10px;color:#94a3b8;flex-wrap:wrap;margin-top:4px;">'
                        + '<span>总: <b style="color:#c6d4df;">' + hmData.total + '</b></span>'
                        + '<span>峰值: <b style="color:#fbbf24;">' + hmData.maxDaily + '</b></span>'
                        + '<span>日均: <b style="color:#94a3b8;">' + hmData.avgDaily.toFixed(2) + '</b></span>'
                        + '<span>' + fmtD(firstDate) + ' ~ ' + fmtD(lastDate) + '</span>'
                        + '</div>';
                    return '<div style="background:rgba(15,23,42,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:10px;margin-bottom:8px;">'
                        + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">'
                        + '<span style="font-size:13px;font-weight:600;color:#c7d5e0;">' + faEsc(title) + '</span>'
                        + '<span style="font-size:10px;color:#64748b;">共 ' + hmData.total + ' 款入库</span></div>'
                        + '<div class="fa-hm-scroll" style="overflow-x:auto;overflow-y:hidden;border-radius:6px;">' + svgStr + '</div>'
                        + legend + summary + '</div>';
                }

                // v1.41 优化：先渲染加载占位 + 家庭整体热力图，然后异步渲染各成员
                var familyColors = ['#1a2a3a', '#0e4429', '#006832', '#26a641', '#39d353'];
                var familyBlock = buildHeatmapBlock(hm, familyColors, '家庭库入库动态热力图', '家庭库');
                var idMap = (saves.familyInfo && saves.familyInfo.steamIdtoName) ? saves.familyInfo.steamIdtoName : {};
                var memberCount = members.length;

                // 先渲染家庭整体 + 成员占位
                var placeholderHtml = familyBlock;
                var placeholders = [];
                members.forEach(function(m, mi) {
                    var memberName = m.userName || idMap[m.steamid] || ('ID:' + String(m.steamid).slice(-4));
                    var phId = 'hm_ph_' + mi;
                    placeholders.push({ id: phId, idx: mi, name: memberName, steamid: m.steamid });
                    placeholderHtml += '<div id="' + phId + '" style="background:rgba(15,23,42,0.2);border:1px solid rgba(255,255,255,0.04);border-radius:10px;padding:10px;margin-bottom:8px;">'
                        + '<div style="font-size:13px;font-weight:600;color:#c7d5e0;margin-bottom:6px;">' + faEsc(memberName) + '</div>'
                        + '<div style="text-align:center;padding:20px;color:#475569;font-size:11px;">渲染中…</div></div>';
                });
                hmWrap.innerHTML = placeholderHtml;

                // v1.57: 热力图默认滚动到最右侧（最新数据）
                function scrollHeatmapsToRight() {
                    hmWrap.querySelectorAll('.fa-hm-scroll').forEach(function(s) {
                        s.scrollLeft = s.scrollWidth;
                    });
                }
                requestAnimationFrame(scrollHeatmapsToRight);

                // v1.41 优化：异步分块渲染各成员热力图，避免阻塞主线程
                var phIdx = 0;
                function renderNextMember() {
                    if (phIdx >= placeholders.length) return;
                    var ph = placeholders[phIdx++];
                    var baseColor = growthColors[ph.idx % growthColors.length];
                    var memberColors = makeColorScheme(baseColor);
                    var memberHm = allHm.members[ph.steamid];
                    var blockHtml = buildHeatmapBlock(memberHm, memberColors, ph.name, ph.name);
                    var el = document.getElementById(ph.id);
                    if (el) {
                        el.outerHTML = blockHtml;
                        // v1.57: 新渲染的成员热力图也滚动到最右侧
                        requestAnimationFrame(scrollHeatmapsToRight);
                    }
                    // 用 requestAnimationFrame 让浏览器有机会重绘，避免连续 DOM 操作卡顿
                    if (phIdx < placeholders.length) {
                        requestAnimationFrame(renderNextMember);
                    }
                }
                if (placeholders.length > 0) {
                    requestAnimationFrame(renderNextMember);
                }
            }

            // ===================== 成员洞察渲染（v1.38 新增） =====================
            function renderMemberInsightsTab() {
                var insWrap = panel.querySelector('[data-insights-content]');
                if (!insWrap) return;
                var members = (saves && saves.familyInfo && Array.isArray(saves.familyInfo.family_member)) ? saves.familyInfo.family_member : [];
                if (members.length === 0) {
                    insWrap.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#8097a8;font-size:13px;">暂无家庭成员数据，请先扫描家庭库</div>';
                    return;
                }
                var gameInfo = saves.familyGameList.GameInfo;
                var idMap = saves.familyInfo.steamIdtoName || {};
                var nameOf = function(m){ return m.userName || idMap[m.steamid] || ('ID:' + String(m.steamid).slice(-4)); };
                var html = '';

                // ===== 成员活跃度 + 家庭组健康分（v1.58：左右分栏，右侧炫彩能量环）=====
                var activity = computeMemberActivity(saves.familyInfo, gameInfo);
                var actColors = { active: '#10b981', warm: '#3b82f6', cold: '#f59e0b', dormant: '#ef4444', never: '#6b7280' };
                var healthPct = activity.healthScore;
                var healthColor = healthPct >= 70 ? '#10b981' : (healthPct >= 40 ? '#f59e0b' : '#ef4444');
                // v1.58：能量环颜色——淡紫色(#a78bfa) → 亮绿色(#22c55e)，分数越高越绿越健康
                // 插值：0分=淡紫，100分=亮绿，中间渐变
                var ringHue = 250 - (healthPct / 100) * 143;  // 250(紫) → 107(绿)
                var ringSat = 55 + (healthPct / 100) * 30;     // 55% → 85%
                var ringLight = 45 + (healthPct / 100) * 15;   // 45% → 60%
                var ringColor = 'hsl(' + ringHue.toFixed(0) + ',' + ringSat.toFixed(0) + '%,' + ringLight.toFixed(0) + '%)';
                // v1.58：能量环 SVG（圆弧按分数填充，发光效果）
                var ringSize = 130, ringStroke = 10, ringR = (ringSize - ringStroke) / 2;
                var ringCx = ringSize / 2, ringCy = ringSize / 2;
                var ringCircum = 2 * Math.PI * ringR;
                var ringDashOffset = ringCircum * (1 - healthPct / 100);
                var ringSvg = '<svg width="' + ringSize + '" height="' + ringSize + '" viewBox="0 0 ' + ringSize + ' ' + ringSize + '">'
                    + '<defs><filter id="faRingGlow" x="-50%" y="-50%" width="200%" height="200%">'
                    + '<feGaussianBlur stdDeviation="3" result="blur"/>'
                    + '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>'
                    + '</filter><linearGradient id="faRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">'
                    + '<stop offset="0%" stop-color="#a78bfa"/>'
                    + '<stop offset="' + healthPct + '%" stop-color="' + ringColor + '"/>'
                    + '<stop offset="100%" stop-color="#22c55e"/>'
                    + '</linearGradient></defs>'
                    // 底环
                    + '<circle cx="' + ringCx + '" cy="' + ringCy + '" r="' + ringR + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="' + ringStroke + '"/>'
                    // 能量弧（旋转 -90° 从顶部开始）
                    + '<circle cx="' + ringCx + '" cy="' + ringCy + '" r="' + ringR + '" fill="none" stroke="url(#faRingGrad)" stroke-width="' + ringStroke + '" stroke-linecap="round" stroke-dasharray="' + ringCircum.toFixed(2) + '" stroke-dashoffset="' + ringDashOffset.toFixed(2) + '" transform="rotate(-90 ' + ringCx + ' ' + ringCy + ')" filter="url(#faRingGlow)"/>'
                    // 中心分数
                    + '<text x="' + ringCx + '" y="' + (ringCy - 2) + '" text-anchor="middle" dominant-baseline="middle" fill="' + ringColor + '" font-size="34" font-weight="700">' + healthPct + '</text>'
                    + '<text x="' + ringCx + '" y="' + (ringCy + 20) + '" text-anchor="middle" dominant-baseline="middle" fill="#8097a8" font-size="10">健康分</text>'
                    + '</svg>';
                html += '<div class="fa-card" style="margin-bottom:12px;">'
                    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
                    + '<div style="font-size:14px;font-weight:600;color:#c7d5e0;">成员活跃度 & 家庭组健康分</div></div>'
                    // 左右两栏：左侧活跃度详情，右侧能量环
                    + '<div style="display:flex;gap:14px;align-items:flex-start;">'
                    // 左栏：活跃度
                    + '<div style="flex:1;min-width:0;">';
                var statusCounts = { active: activity.activeCount, warm: activity.warmCount, cold: activity.coldCount, dormant: activity.dormantCount };
                var statusBadges = ['active','warm','cold','dormant'].map(function(s){
                    return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#94a3b8;"><span style="width:8px;height:8px;border-radius:50%;background:' + actColors[s] + ';display:inline-block;"></span>' + activity.statusLabels[s] + ' <b style="color:#c6d4df;">' + statusCounts[s] + '</b></span>';
                }).join('');
                html += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">' + statusBadges + '</div>';
                activity.members.forEach(function(m, i){
                    var daysText = m.daysSinceLatest >= 0 ? (m.daysSinceLatest + ' 天前') : '从未';
                    var avatarHtml = faNameAvatarHtml(m.name, 16, 'margin-right:6px;');
                    html += '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-left:3px solid ' + actColors[m.status] + ';border-radius:8px;margin-bottom:4px;">'
                        + avatarHtml
                        + '<span style="flex-shrink:0;width:64px;font-size:11px;color:#c6d4df;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + faEscAttr(m.name) + '">' + faEsc(m.name) + '</span>'
                        + '<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:' + actColors[m.status] + '22;color:' + actColors[m.status] + ';">' + m.statusLabel + '</span>'
                        + '<div style="flex:1;display:flex;gap:10px;font-size:10px;color:#8097a8;justify-content:flex-end;flex-wrap:wrap;">'
                        + '<span>库内: <b style="color:#c6d4df;">' + m.total + '</b></span>'
                        + '<span>月均: <b style="color:#fbbf24;">' + m.monthlyAvg + '</b></span>'
                        + '<span>最近: <b style="color:#94a3b8;">' + daysText + '</b></span></div></div>';
                });
                html += '</div>'
                    // 右栏：能量环（v1.58：宽度与底部加入时间容器对齐，均 240px）
                    + '<div style="flex:0 0 240px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:10px;">'
                    + ringSvg
                    + '<div style="font-size:10px;color:#64748b;margin-top:6px;text-align:center;">分数越高越健康<br>紫→绿渐变</div>'
                    + '</div>'
                    + '</div>'
                    + '</div>';

                // ===== 共同游戏矩阵 =====
                var n = members.length;
                if (n > 1) {
                    var overlap = computeMemberOverlapMatrix(gameInfo, members, idMap);
                    html += '<div class="fa-card" style="margin-bottom:12px;">'
                        + '<div style="font-size:14px;font-weight:600;color:#c7d5e0;margin-bottom:4px;">共同游戏矩阵</div>'
                        + '<div style="font-size:11px;color:#64748b;margin-bottom:10px;">成员之间共同拥有的游戏数量</div>';
                    var maxShared = 1;
                    overlap.pairs.forEach(function(p){ if (p.sharedGames > maxShared) maxShared = p.sharedGames; });
                    var gridHtml = '<div style="display:grid;grid-template-columns:70px repeat(' + n + ',1fr);gap:3px;font-size:11px;">';
                    gridHtml += '<div></div>';
                    members.forEach(function(m){
                        var nm = nameOf(m);
                        gridHtml += '<div style="text-align:center;color:#8a9ba8;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + faEscAttr(nm) + '">' + faEsc(nm.slice(0, 4)) + '</div>';
                    });
                    for (var i = 0; i < n; i++) {
                        var nmi = nameOf(members[i]);
                        gridHtml += '<div style="color:#8a9ba8;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + faEscAttr(nmi) + '">' + faEsc(nmi.slice(0, 6)) + '</div>';
                        for (var j = 0; j < n; j++) {
                            if (i === j) {
                                gridHtml += '<div style="text-align:center;padding:4px;background:rgba(6,207,190,0.1);border-radius:3px;color:#06cfbe;font-size:10px;">-</div>';
                            } else {
                                var val = overlap.matrix[i][j];
                                var intensity = val / maxShared;
                                var bg = val === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(84,160,255,' + (0.15 + intensity * 0.5).toFixed(2) + ')';
                                gridHtml += '<div style="text-align:center;padding:4px;background:' + bg + ';border-radius:3px;color:' + (val > 0 ? '#c6d4df' : '#475569') + ';font-weight:' + (val > 0 ? '600' : '400') + ';" title="' + faEsc(nmi) + ' 与 ' + faEsc(nameOf(members[j])) + ' 共同: ' + val + '">' + val + '</div>';
                            }
                        }
                    }
                    gridHtml += '</div>';
                    html += gridHtml;
                    if (overlap.pairs.length > 0) {
                        html += '<div style="margin-top:10px;font-size:11px;color:#64748b;margin-bottom:4px;">共同游戏最多的组合：</div>';
                        overlap.pairs.slice(0, 3).forEach(function(p){
                            html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:rgba(84,160,255,0.06);border-radius:6px;margin-bottom:4px;">'
                                + '<span style="font-size:12px;color:#c6d4df;">' + faEsc(p.aName) + ' ↔ ' + faEsc(p.bName) + '</span>'
                                + '<span style="margin-left:auto;font-size:12px;font-weight:700;color:#54a0ff;">' + p.sharedGames + ' 个共同游戏</span></div>';
                        });
                    }
                    html += '</div>';
                }

                // ===== 成员多维度雷达 + 加入时间维度对比（v1.58：左右分栏）=====
                var radar = computeMemberRadar(gameInfo, members, idMap);
                // v1.58：左右两栏容器
                html += '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;">';
                // 左栏：雷达图
                html += '<div class="fa-card" style="flex:1 1 340px;min-width:0;">';
                if (radar.length > 0) {
                    var axes = ['总游戏', '独占', '共享', '月均', '共享率', '库龄'];
                    var cx = 150, cy = 140, R = 95, levels = 4;
                    var radarSvg = '';
                    for (var l = 1; l <= levels; l++) {
                        var r = R * l / levels;
                        var gpts = [];
                        for (var a = 0; a < axes.length; a++) {
                            var gang = -Math.PI / 2 + a * 2 * Math.PI / axes.length;
                            gpts.push((cx + r * Math.cos(gang)).toFixed(1) + ',' + (cy + r * Math.sin(gang)).toFixed(1));
                        }
                        radarSvg += '<polygon points="' + gpts.join(' ') + '" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>';
                    }
                    for (var a = 0; a < axes.length; a++) {
                        var aang = -Math.PI / 2 + a * 2 * Math.PI / axes.length;
                        radarSvg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + R * Math.cos(aang)).toFixed(1) + '" y2="' + (cy + R * Math.sin(aang)).toFixed(1) + '" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>';
                        radarSvg += '<text x="' + (cx + (R + 16) * Math.cos(aang)).toFixed(1) + '" y="' + (cy + (R + 16) * Math.sin(aang)).toFixed(1) + '" text-anchor="middle" fill="#8a9ba8" font-size="10" dominant-baseline="middle">' + axes[a] + '</text>';
                    }
                    radar.forEach(function(m, mi){
                        var c = growthColors[mi % growthColors.length];
                        var vals = [m.totalGames, m.soloCount, m.sharedCount, m.monthlyAvg, m.shareRate, m.libraryAge];
                        var mpts = [];
                        for (var a = 0; a < axes.length; a++) {
                            var mang = -Math.PI / 2 + a * 2 * Math.PI / axes.length;
                            var mr = R * vals[a];
                            mpts.push((cx + mr * Math.cos(mang)).toFixed(1) + ',' + (cy + mr * Math.sin(mang)).toFixed(1));
                        }
                        radarSvg += '<polygon points="' + mpts.join(' ') + '" fill="' + c + '33" stroke="' + c + '" stroke-width="1.5"/>';
                    });
                    var radarLegend = radar.map(function(m, mi){
                        var c = growthColors[mi % growthColors.length];
                        return '<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#94a3b8;"><span style="width:12px;height:12px;border-radius:3px;background:' + c + ';opacity:.7;display:inline-block;"></span>' + faEsc(m.name) + '</span>';
                    }).join('');
                    html += '<div style="font-size:14px;font-weight:600;color:#c7d5e0;margin-bottom:4px;">成员多维度雷达对比</div>'
                        + '<div style="font-size:11px;color:#64748b;margin-bottom:8px;">各维度按最大值归一化（0-1）</div>'
                        + '<svg width="100%" style="max-width:340px;margin:0 auto;display:block;" viewBox="0 0 300 280">' + radarSvg + '</svg>'
                        + '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:6px;">' + radarLegend + '</div>';
                } else {
                    html += '<div style="text-align:center;padding:30px;color:#64748b;font-size:12px;">暂无雷达数据</div>';
                }
                html += '</div>';
                // 右栏：加入时间 + 加入天数对比（v1.58：宽度与顶部能量环对齐，均 240px）
                html += '<div class="fa-card" style="flex:0 0 240px;min-width:200px;">'
                    + '<div style="font-size:14px;font-weight:600;color:#c7d5e0;margin-bottom:4px;">加入时间</div>'
                    + '<div style="font-size:11px;color:#64748b;margin-bottom:10px;">成员加入家庭组的时间与天数对比</div>';
                // v1.58：按加入天数降序排列（早加入的排前面）
                var sortedMembers = members.slice().sort(function(a, b) {
                    var ta = a.time_joined || 0, tb = b.time_joined || 0;
                    return ta - tb;
                });
                sortedMembers.forEach(function(m){
                    var nm = nameOf(m);
                    var origIdx = members.indexOf(m);
                    var c = growthColors[origIdx % growthColors.length];
                    var joinTime = m.time_joined || 0;
                    // v1.58：修复字段名——API 返回 cooldown_seconds_remaining，非 cooldown_remaining
                    var cooldown = m.cooldown_seconds_remaining || m.cooldown_remaining || 0;
                    var joinText = joinTime > 0
                        ? new Date(joinTime * 1000).toLocaleDateString('zh-CN')
                        : '未知';
                    // v1.58：加入天数对比
                    var joinDays = joinTime > 0
                        ? Math.floor((Date.now() - joinTime * 1000) / 86400000)
                        : 0;
                    var cooldownText = cooldown > 0
                        ? '冷却: ' + Math.ceil(cooldown / 86400) + ' 天'
                        : '无冷却';
                    html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 6px;border-bottom:1px solid rgba(255,255,255,0.04);">'
                        + faNameAvatarHtml(nm, 28, 'border:2px solid ' + c + ';')
                        + '<div style="flex:1;min-width:0;">'
                        + '<div style="font-size:12px;color:#c6d4df;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + faEscAttr(nm) + '">' + faEsc(nm) + '</div>'
                        + '<div style="display:flex;align-items:center;gap:8px;margin-top:2px;">'
                        + '<span style="font-size:10px;color:#8097a8;">' + joinText + '</span>'
                        + '<span style="font-size:10px;color:#06cfbe;font-weight:600;">' + joinDays + ' 天</span>'
                        + '</div>'
                        + '<div style="font-size:10px;color:' + (cooldown > 0 ? '#f59e0b' : '#06cfbe') + ';">' + cooldownText + '</div>'
                        + '</div></div>';
                });
                html += '</div>';
                html += '</div>';  // 关闭左右分栏容器

                insWrap.innerHTML = html;
            }

            // ===================== 家庭愿望单渲染（v1.41 新增） =====================
            function renderWishlistTab() {
                // v1.43：渲染前确保当前用户主货币已识别（函数幂等，可重复调用）
                faDetectUserCurrency();
                // v1.76：确保年度大作(GOTY)数据已加载（用于筛选与徽章展示）
                if (!faGotyData) faLoadGotyData(false).then(function() {
                    // GOTY 数据加载完成后刷新愿望单内容（KPI 计数/徽章需更新）
                    var p = document.getElementById('familyAnalysisPanel');
                    if (p && window[activeTabKey] === 'wishlist') {
                        var w = p.querySelector('[data-wishlist-content]');
                        if (w && wlCache.data) renderWishlistContent(w, wlCache.data);
                    }
                });
                var wlWrap = panel.querySelector('[data-wishlist-content]');
                if (!wlWrap) return;
                var members = (saves && saves.familyInfo && Array.isArray(saves.familyInfo.family_member)) ? saves.familyInfo.family_member : [];
                if (members.length === 0) {
                    wlWrap.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#8097a8;font-size:13px;">暂无家庭成员数据，请先扫描家庭库</div>';
                    return;
                }
                var hasCache = wlCache.data && wlCache.data.GameList && wlCache.data.GameList.length > 0;
                if (hasCache) {
                    renderWishlistContent(wlWrap, wlCache.data);
                    if (Date.now() - wlCache.updatedAt < WL_CACHE_TTL) {
                        // v1.42：缓存新鲜但仍可能存在占位名称/缺失价格，继续后台静默补全
                        backgroundEnrichWishlist(wlCache.data);
                        return;
                    }
                    refreshWishlistData(members);
                    return;
                }
                wlWrap.innerHTML = '<div class="fa-wl-loading-wrap" data-wishlist-loading-wrap>'
                    + '<div class="fa-wl-loading-ring" data-wishlist-loading-ring>'
                    + '<div class="fa-wl-loading-ring-inner">' + faNameAvatarHtml('?', 54, 'width:54px;height:54px;') + '</div>'
                    + '</div>'
                    + '<div class="fa-wl-loading-name" data-wishlist-loading-name>准备加载…</div>'
                    + '<div class="fa-wl-loading-progress" data-wishlist-loading>正在加载家庭成员愿望单…<span class="fa-wl-loading-dots"><span></span><span></span><span></span></span></div>'
                    + '</div>';
                refreshWishlistData(members);
            }

            function refreshWishlistData(members) {
                if (wlState.loading) return;
                wlState.loading = true;
                var merged = {};
                var memberIdx = 0;
                // v1.44：成员抓取由逐个串行改为 2 并发，多名成员时等待时间约减半
                var FETCH_CONCURRENCY = 2;
                var running = 0;
                var completed = 0;

                function updateLoadingText(text) {
                    var currentPanel = document.getElementById('familyAnalysisPanel');
                    if (!currentPanel) return;
                    var el = currentPanel.querySelector('[data-wishlist-loading]');
                    if (el) el.textContent = text;
                }

                // v1.64：更新加载进度——展示正在加载的成员头像（旋转光圈特效）与昵称
                function updateLoadingMember(member, completed, total) {
                    var currentPanel = document.getElementById('familyAnalysisPanel');
                    if (!currentPanel) return;
                    var ringEl = currentPanel.querySelector('[data-wishlist-loading-ring]');
                    var nameEl = currentPanel.querySelector('[data-wishlist-loading-name]');
                    var textEl = currentPanel.querySelector('[data-wishlist-loading]');
                    var name = member.userName || (saves.familyInfo.steamIdtoName ? saves.familyInfo.steamIdtoName[member.steamid] : '') || ('ID:' + String(member.steamid).slice(-4));
                    var avatarUrl = member.avatar || (saves.familyInfo.steamIdtoAvatar ? saves.familyInfo.steamIdtoAvatar[member.steamid] : '');
                    // 更新头像：优先使用真实头像 URL，无则回退首字头像
                    if (ringEl) {
                        var inner = ringEl.querySelector('.fa-wl-loading-ring-inner');
                        if (inner) {
                            if (avatarUrl) {
                                inner.innerHTML = '<img class="fa-wl-loading-avatar-img" src="' + faEscAttr(avatarUrl) + '" alt="" onerror="this.style.display=\'none\'">';
                            } else {
                                inner.innerHTML = faNameAvatarHtml(name, 54, 'width:54px;height:54px;');
                            }
                        }
                    }
                    if (nameEl) nameEl.textContent = name;
                    if (textEl) {
                        textEl.innerHTML = '正在获取 <b style="color:#06cfbe;">' + faEsc(name) + '</b> 的愿望单 (' + completed + '/' + total + ')'
                            + '<span class="fa-wl-loading-dots"><span></span><span></span><span></span></span>';
                    }
                }

                function mergeEntries(m, entries) {
                    entries.forEach(function(e) {
                        if (!merged[e.appid]) {
                            merged[e.appid] = {
                                appid: e.appid, name: e.name, wishers: [],
                                finalPrice: e.finalPrice || 0, originalPrice: e.originalPrice || 0,
                                discountPct: e.discountPct || 0, onSale: !!e.onSale, isFree: e.isFree || false,
                                isComingSoon: !!e.isComingSoon, releaseDate: e.releaseDate || '',
                                _releaseKnown: !!e._releaseKnown,
                                type: e.type || '', tags: e.tags || [],
                                addedDate: e.addedDate || 0, priority: e.priority || 0,
                                inLibrary: false, _metaDone: !!e._metaDone
                            };
                        }
                        merged[e.appid].wishers.push(m.steamid);
                    });
                }

                function launchNext() {
                    while (running < FETCH_CONCURRENCY && memberIdx < members.length) {
                        (function(m) {
                            running++;
                            // v1.64：展示正在加载的成员头像与昵称（旋转光圈特效）
                            updateLoadingMember(m, completed, members.length);
                            fetchMemberWishlist(m.steamid).then(function(entries) {
                                mergeEntries(m, entries);
                                running--;
                                completed++;
                                // 更新进度计数（未启动新成员时显示已完成数）
                                if (completed < members.length && running > 0 && memberIdx >= members.length) {
                                    updateLoadingText('已完成 ' + completed + '/' + members.length + ' 位成员，继续加载中…');
                                }
                                if (completed >= members.length) { finishLoading(); return; }
                                launchNext();
                            });
                        })(members[memberIdx++]);
                    }
                }

                function finishLoading() {
                    // v1.64：所有成员愿望单加载完成，显示整理数据提示
                    var pp = document.getElementById('familyAnalysisPanel');
                    if (pp) {
                        var nameEl = pp.querySelector('[data-wishlist-loading-name]');
                        var textEl = pp.querySelector('[data-wishlist-loading]');
                        if (nameEl) nameEl.textContent = '愿望单加载完成';
                        if (textEl) textEl.innerHTML = '正在整理 ' + members.length + ' 位成员的愿望单数据…';
                    }
                    var GameList = Object.keys(merged).map(Number);
                    var libSet = {};
                    if (saves.familyGameList && saves.familyGameList.GameList) {
                        saves.familyGameList.GameList.forEach(function(a) { libSet[a] = true; });
                    }
                    GameList.forEach(function(a) { merged[a].inLibrary = !!libSet[a]; });
                    // v1.44：先用跨会话元数据缓存补齐缺失条目；数据完整的条目回写缓存保温
                    var metaChanged = false;
                    GameList.forEach(function(a) {
                        var gi = merged[a];
                        // v1.60 修复（参考 1.0.8 refreshDynamicFields）：元数据缓存命中仅证明字段齐备，
                        // 价格/折扣/发售状态可能已过期（TTL 最长24h），标记 _fromMetaCache
                        // 供后台 GetItems 批量刷新校正，修复"缓存期内折扣变化不触发重取"问题
                        if (!gi._metaDone && faWlMetaApply(a, gi)) { gi._fromMetaCache = true; return; }
                        if (gi._metaDone && gi.name && gi.name !== ('App ' + a) && faWlMetaUpdate(a, gi)) metaChanged = true;
                    });
                    if (metaChanged) faWlMetaSave();
                    // 排序：多人想要优先 → 家庭库已有 → 折扣 → 名称
                    GameList.sort(function(a, b) {
                        var wDiff = merged[b].wishers.length - merged[a].wishers.length;
                        if (wDiff !== 0) return wDiff;
                        if (merged[a].inLibrary !== merged[b].inLibrary) return merged[a].inLibrary ? 1 : -1;
                        var dDiff = (merged[b].discountPct || 0) - (merged[a].discountPct || 0);
                        if (dDiff !== 0) return dDiff;
                        return (merged[a].name || '').localeCompare(merged[b].name || '', 'zh-CN');
                    });
                    var wlData = { GameList: GameList, GameInfo: merged };
                    wlCache.data = wlData;
                    wlCache.updatedAt = Date.now();
                    // P2-2: 愿望单数据加载完成后标记搜索索引需重建，下次搜索时自动重建
                    _faSearchIndexBuilt = false;
                    // v1.78：写入 GM_setValue 持久化缓存（跨页面刷新复用，8小时 TTL）
                    faWlDataSave(wlData, familyGroupId);
                    wlState.loading = false;
                    var p = document.getElementById('familyAnalysisPanel');
                    if (!p) return;
                    var w = p.querySelector('[data-wishlist-content]');
                    if (w) renderWishlistContent(w, wlData);
                    // 后台静默补全缺失的价格/标签
                    backgroundEnrichWishlist(wlData);
                }

                launchNext();
            }

            function backgroundEnrichWishlist(wlData) {
                if (wlState.enriching) return;
                // v1.60：补全判定对齐参考脚本 1.0.8/1.0.9——名称占位、发售状态未知（!_releaseKnown）、
                // 价格缺失（免费/确认未发售除外）、标签缺失的条目均需补全
                var needEnrich = wlData.GameList.filter(function(a) {
                    var gi = wlData.GameInfo[a];
                    if (!gi || gi._metaDone) return false;
                    // 名称仍为占位符 → 必须补全（免费游戏也需要补全名称）
                    if (!gi.name || gi.name === ('App ' + a)) return true;
                    // 发售状态未知 → 需补全（否则"即将推出"统计不准确）
                    if (gi._releaseKnown !== true) return true;
                    if (gi.isFree) return false;
                    // 已发售非免费但缺价格 → 需补全（未发售无价格为合法状态，不再重复补全）
                    if (!gi.isComingSoon && (!gi.finalPrice || gi.finalPrice === 0)) return true;
                    // 缺少标签 → 需补全
                    if (!gi.tags || gi.tags.length === 0) return true;
                    return false;
                });
                // v1.60 修复（参考 1.0.8 refreshDynamicFields）：元数据缓存命中且字段完备的条目，
                // 价格/折扣/发售状态可能陈旧（TTL 最长24h），一并纳入 GetItems 批量动态刷新（权威覆盖），
                // 但不进 appdetails 兜底阶段
                var needSet = {};
                needEnrich.forEach(function(a) { needSet[a] = true; });
                var dynamicOnly = wlData.GameList.filter(function(a) {
                    var gi = wlData.GameInfo[a];
                    return gi && gi._fromMetaCache && !needSet[a];
                });
                var browseQueue = needEnrich.concat(dynamicOnly);
                if (browseQueue.length === 0) return;
                wlState.enriching = true;
                // v1.44：批次刷新节流（最多 1 次/秒），避免批次连续全量重绘造成卡顿/闪烁
                var lastListRender = 0;
                var listRenderTimer = null;
                var metaDirty = false;
                function scheduleListRender() {
                    if (window[activeTabKey] !== 'wishlist') return;
                    var p = document.getElementById('familyAnalysisPanel');
                    if (!p || !p.querySelector('#wl_game_list')) return;
                    var now = Date.now();
                    var doRender = function() {
                        listRenderTimer = null;
                        lastListRender = Date.now();
                        var pp = document.getElementById('familyAnalysisPanel');
                        if (pp && pp.querySelector('#wl_game_list') && window[activeTabKey] === 'wishlist') {
                            renderWishlistGamesList(wlData);
                        }
                    };
                    if (now - lastListRender >= 1000) doRender();
                    else if (!listRenderTimer) listRenderTimer = setTimeout(doRender, 1000 - (now - lastListRender));
                }
                function updateProgressText(done, total) {
                    var p = document.getElementById('familyAnalysisPanel');
                    if (!p) return;
                    var progEl = p.querySelector('[data-wl-enrich-progress]');
                    // v1.52：补全完成后立即清空进度文本（原为残留至面板重建）
                    if (progEl) progEl.textContent = (done >= total) ? '' : '补全名称价格中… ' + done + '/' + total;
                }
                // v1.60：GetItems 阶段应用——价格/折扣/发售状态为权威覆盖（可纠正陈旧缓存与已结束的折扣），
                // 名称在中文界面下始终覆盖（与 v1.54 appdetails 中文名策略一致）
                function applyBrowseResult(aid, r) {
                    var gi = wlData.GameInfo[aid];
                    if (!gi) return;
                    if (r.name) gi.name = r.name;
                    if (r.type) gi.type = r.type;
                    if (typeof r.isFree !== 'undefined') gi.isFree = !!r.isFree;
                    if (r._priceKnown) {
                        gi.finalPrice = r.finalPrice;
                        gi.originalPrice = r.originalPrice;
                        gi.discountPct = r.discountPct;
                        gi.onSale = !!r.onSale;
                    }
                    if (r._releaseKnown) {
                        gi.isComingSoon = !!r.isComingSoon;
                        gi._releaseKnown = true;
                        if (r.releaseDate) gi.releaseDate = r.releaseDate;
                    }
                    gi._fromMetaCache = false;
                    faWlMetaJudgeDone(gi);
                    if (r.name && faWlMetaUpdate(aid, gi)) metaDirty = true;
                }
                // v1.60：appdetails 阶段应用——沿用原"有值才覆盖"语义，新增发售状态权威写入
                function applyAppDetailsResult(aid, r) {
                    var gi = wlData.GameInfo[aid];
                    if (!gi) return;
                    // v1.54 修复：appdetails 使用 l=schinese 请求，返回的为中文名，
                    // 应始终覆盖 SSR/API 返回的英文名，而非仅覆盖占位符。
                    if (r.name) gi.name = r.name;
                    if (r.finalPrice) gi.finalPrice = r.finalPrice;
                    if (r.originalPrice) gi.originalPrice = r.originalPrice;
                    if (r.discountPct) gi.discountPct = r.discountPct;
                    if (r.onSale) gi.onSale = true;
                    if (r.isFree) gi.isFree = true;
                    if (r.type) gi.type = r.type;
                    if (r.tags && r.tags.length > 0) gi.tags = r.tags;
                    // v1.60（参考 1.0.8）：release_date.coming_soon 为权威判定，可回退 true→false
                    if (r._releaseKnown) {
                        gi.isComingSoon = !!r.isComingSoon;
                        gi._releaseKnown = true;
                        if (r.releaseDate) gi.releaseDate = r.releaseDate;
                    }
                    faWlMetaJudgeDone(gi);
                    // v1.44：补全成功的条目写入跨会话元数据缓存
                    if (r.name && faWlMetaUpdate(aid, gi)) metaDirty = true;
                }
                function finishEnrich() {
                    wlState.enriching = false;
                    // v1.44：补全完成后一次性落盘元数据缓存
                    if (metaDirty) faWlMetaSave();
                    // v1.78：补全后同步更新 GM_setValue 持久化缓存（价格/标签/名称等已刷新）
                    if (wlData && wlData.GameList && wlData.GameList.length > 0) {
                        faWlDataSave(wlData, familyGroupId);
                    }
                    updateProgressText(1, 1);
                    // 全部完成：重建整个愿望单面板（刷新KPI和图表）
                    var p = document.getElementById('familyAnalysisPanel');
                    if (!p) return;
                    var w = p.querySelector('[data-wishlist-content]');
                    if (w && window[activeTabKey] === 'wishlist') renderWishlistContent(w, wlData);
                }
                // v1.60 三段式（参考 1.0.9 enrichItemsFromAPI）：
                // ① GetItems 批量补全（100个/批、3路并发，含元数据缓存条目的动态刷新）→
                // ② appdetails 仅兜底 GetItems 后仍不完备的少量残余（下架/锁区/缺标签等）
                faWlEnrichFromStoreBrowse(browseQueue,
                    function(processed, total) { updateProgressText(processed, total); },
                    function(batchNew) {
                        for (var aid in batchNew) applyBrowseResult(aid, batchNew[aid]);
                        scheduleListRender();
                    }
                ).then(function() {
                    var leftovers = needEnrich.filter(function(a) {
                        var gi = wlData.GameInfo[a];
                        if (!gi) return false;
                        if (!gi.name || gi.name === ('App ' + a)) return true;
                        if (gi._releaseKnown !== true) return true;
                        if (!gi.isFree && !gi.isComingSoon && !(Number(gi.finalPrice) > 0)) return true;
                        if (!gi.tags || gi.tags.length === 0) return true;
                        return false;
                    });
                    if (leftovers.length === 0) { finishEnrich(); return; }
                    enrichWishlistMeta(leftovers,
                        function(completed, total) { updateProgressText(completed, total); },
                        function(batchNew) {
                            for (var aid in batchNew) applyAppDetailsResult(aid, batchNew[aid]);
                            scheduleListRender();
                        }
                    ).then(finishEnrich);
                });
            }

            // v1.81: 接入 faComputedCache — wishlist 数据(wlCache.updatedAt)未变直接命中
            function _faWishlistStatsCacheKey(wlData) {
                if (!wlData) return null;
                // wlData 中 GameList 长度 + 价格字段总和 + 类别名作为签名
                var finalSum = 0, discSum = 0, updatedAt = (typeof wlCache !== 'undefined' && wlCache) ? (wlCache.updatedAt || 0) : 0;
                if (wlData.GameList) {
                    for (var i = 0; i < wlData.GameList.length; i++) {
                        var gi = wlData.GameInfo[wlData.GameList[i]];
                        if (gi) {
                            finalSum += Number(gi.finalPrice) || 0;
                            discSum += Number(gi.discountPct) || 0;
                        }
                    }
                }
                return (wlData.GameList ? wlData.GameList.length : 0) + '|' + finalSum + '|' + discSum + '|' + updatedAt;
            }
            function computeWishlistStats(wlData) {
                var key = _faWishlistStatsCacheKey(wlData);
                if (key) {
                    var cached = faComputedCache.get('wlstats_' + key);
                    if (cached) return cached;
                    var v = _computeWishlistStatsRaw(wlData);
                    faComputedCache.set('wlstats_' + key, v);
                    return v;
                }
                return _computeWishlistStatsRaw(wlData);
            }
            function _computeWishlistStatsRaw(wlData) {
                var stats = { total: 0, inLibrary: 0, multiWant: 0, discounted: 0, comingSoon: 0, goty: 0, totalValue: 0, avgPrice: 0, maxDiscount: 0, memberDist: [], tagDist: [], priceBuckets: [], typeDist: [] };
                if (!wlData || !wlData.GameList) return stats;
                var members = saves.familyInfo.family_member || [];
                var idMap = saves.familyInfo.steamIdtoName || {};
                var tagMap = {};
                var typeMap = {};
                var memberCounts = {};
                members.forEach(function(m) { memberCounts[m.steamid] = 0; });
                var paidItems = [];
                stats.total = wlData.GameList.length;
                wlData.GameList.forEach(function(a) {
                    var gi = wlData.GameInfo[a];
                    if (!gi) return;
                    if (gi.inLibrary) stats.inLibrary++;
                    if (gi.wishers && gi.wishers.length > 1) stats.multiWant++;
                    // v1.60 修复（参考 1.0.8）：onSale 计入打折（active_discounts 无 pct 的促销此前被漏统）
                    if (gi.discountPct > 0 || gi.onSale) { stats.discounted++; if (gi.discountPct > stats.maxDiscount) stats.maxDiscount = gi.discountPct; }
                    // v1.60：即将推出（未发售）统计
                    if (gi.isComingSoon) stats.comingSoon++;
                    // v1.76：年度大作命中统计
                    if (faIsGoty(a)) stats.goty++;
                    var p = Number(gi.finalPrice) || 0;
                    if (!gi.isFree && p > 0) { stats.totalValue += p; paidItems.push(p); }
                    if (gi.wishers) gi.wishers.forEach(function(sid) { if (memberCounts[sid] !== undefined) memberCounts[sid]++; });
                    (gi.tags || []).forEach(function(t) { tagMap[t] = (tagMap[t] || 0) + 1; });
                    var tk = wlGetTypeKey(gi.type);
                    typeMap[tk] = (typeMap[tk] || 0) + 1;
                });
                stats.avgPrice = paidItems.length > 0 ? stats.totalValue / paidItems.length : 0;
                stats.memberDist = members.map(function(m) {
                    return { name: m.userName || idMap[m.steamid] || ('ID:' + String(m.steamid).slice(-4)), count: memberCounts[m.steamid] || 0 };
                }).sort(function(a, b) { return b.count - a.count; });
                stats.tagDist = Object.entries(tagMap).map(function(e) { return { name: e[0], count: e[1] }; }).sort(function(a, b) { return b.count - a.count; }).slice(0, 15);
                stats.typeDist = Object.entries(typeMap).map(function(e) { return { key: e[0], count: e[1] }; }).sort(function(a, b) { return b.count - a.count; });
                // 价格区间分布（v1.58 修复：区分"免费"与"价格未知"——
                // isFree=真免费；!isFree 且 price=0 是价格未获取到，二者不能混为一谈）
                // v1.60：再区分"未发售"（确认即将推出的无价格游戏不再计入"未知"）
                var buckets = [
                    { label: '免费', count: 0, color: '#6366f1' },
                    { label: '<50', count: 0, color: '#10b981' },
                    { label: '50-100', count: 0, color: '#22c55e' },
                    { label: '100-200', count: 0, color: '#84cc16' },
                    { label: '200-500', count: 0, color: '#f59e0b' },
                    { label: '≥500', count: 0, color: '#ef4444' },
                    { label: '未发售', count: 0, color: '#38bdf8' },
                    { label: '未知', count: 0, color: '#64748b' }
                ];
                wlData.GameList.forEach(function(a) {
                    var gi = wlData.GameInfo[a];
                    if (!gi) return;
                    if (gi.isFree) { buckets[0].count++; return; }
                    var p = Number(gi.finalPrice) || 0;
                    if (p === 0) { if (gi.isComingSoon) buckets[6].count++; else buckets[7].count++; return; }   // 无价格：未发售 vs 未获取到
                    if (p < 50) buckets[1].count++;
                    else if (p < 100) buckets[2].count++;
                    else if (p < 200) buckets[3].count++;
                    else if (p < 500) buckets[4].count++;
                    else buckets[5].count++;
                });
                stats.priceBuckets = buckets;
                return stats;
            }

            function wlGetTypeKey(type) {
                if (!type) return 'other';
                var t = String(type).toLowerCase();
                if (t === 'game' || t === '0') return 'game';
                if (t === 'dlc' || t === '1') return 'dlc';
                if (t === 'software' || t === '2') return 'software';
                return 'other';
            }

            function wlFmtPrice(v) {
                var n = Number(v) || 0;
                if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
                return n.toFixed(2);
            }

            function renderWishlistContent(wlWrap, wlData) {
                var stats = computeWishlistStats(wlData);
                var members = saves.familyInfo.family_member || [];
                var idMap = saves.familyInfo.steamIdtoName || {};
                var wlUpdatedText = wlCache.updatedAt ? new Date(wlCache.updatedAt).toLocaleTimeString('zh-CN', { hour12: false }) : '未知';
                var html = '';
                // KPI 行（v1.60：新增"即将推出"卡片；v1.76：新增"年度大作"卡片，7 列布局）
                html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:10px;">';
                html += buildKpiCard('愿望单总数', stats.total, '#06cfbe', '去重后游戏数');
                html += buildKpiCard('家庭已有', stats.inLibrary, '#f59e0b', stats.total > 0 ? (stats.inLibrary / stats.total * 100).toFixed(0) + '% 命中' : '');
                html += buildKpiCard('多人想要', stats.multiWant, '#54a0ff', '≥2人共同想要');
                html += buildKpiCard('折扣中', stats.discounted, '#2ed573', '最大折扣 ' + stats.maxDiscount + '%');
                html += buildKpiCard('即将推出', stats.comingSoon, '#38bdf8', '未发售游戏');
                html += buildKpiCard('年度大作', stats.goty, '#f59e0b', '命中年度大作');
                html += buildKpiCard('总价值', faCurrency.symbol + wlFmtPrice(stats.totalValue), '#ff6b6b', '均价 ' + faCurrency.symbol + wlFmtPrice(stats.avgPrice));
                html += '</div>';
                // 工具栏
                html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">';
                html += '<span style="font-size:11px;color:#64748b;">更新于 ' + wlUpdatedText + '</span>';
                html += '<button id="btn_refresh_wishlist" class="fa-btn-green fa-btn-sm">刷新愿望单</button>';
                html += '<span data-wl-enrich-progress style="font-size:11px;color:#06cfbe;"></span>';
                html += '<div style="flex:1;"></div>';
                // 筛选按钮（v1.60：新增"即将推出"筛选项；v1.76：新增"年度大作"筛选项）
                var filters = [['all','全部'],['inLibrary','家庭已有'],['multiWant','多人想要'],['discount','折扣中'],['soon','即将推出'],['goty','年度大作']];
                filters.forEach(function(f) {
                    var active = wlState.filter === f[0];
                    html += '<button data-wl-filter="' + f[0] + '" style="background:' + (active ? 'rgba(6,207,190,0.2)' : 'rgba(255,255,255,0.04)') + ';border:1px solid ' + (active ? '#06cfbe40' : 'rgba(255,255,255,0.08)') + ';color:' + (active ? '#06cfbe' : '#8097a8') + ';padding:3px 10px;border-radius:4px;cursor:pointer;font-size:11px;">' + f[1] + '</button>';
                });
                html += '</div>';
                // v1.58：多人想要二级筛选所需——统计各愿望人数（2~6）对应的游戏数
                var isMultiWant = wlState.filter === 'multiWant';
                var wisherCounts = {};
                if (isMultiWant) {
                    wlData.GameList.forEach(function(a) {
                        var gi = wlData.GameInfo[a];
                        if (!gi || !gi.wishers) return;
                        var n = gi.wishers.length;
                        if (n >= 2 && n <= 6) wisherCounts[n] = (wisherCounts[n] || 0) + 1;
                    });
                }
                // 主体两栏
                html += '<div style="display:flex;gap:10px;align-items:flex-start;">';
                // 左侧仪表盘 — 宽度对齐第二个KPI卡片右边框（2*cardWidth + 1*gap ≈ 274px）
                html += '<div style="width:274px;flex-shrink:0;display:flex;flex-direction:column;gap:12px;">';
                // 成员愿望单分布（v1.58：名称前增加首字头像；v1.66：改用 buildBarChart({avatar:true})）
                html += buildBarChart('成员愿望单分布', stats.memberDist.map(function(m) { return { name: m.name, value: m.count }; }), '#06cfbe', { avatar: true });
                // 热门标签 TOP 10
                var tagItems = stats.tagDist.slice(0, 10).map(function(t) { return { name: t.name, value: t.count }; });
                if (tagItems.length > 0) html += buildBarChart('热门标签 TOP 10', tagItems, '#54a0ff');
                // 价格区间分布（环形图）
                html += buildDonutChart('价格区间分布', stats.priceBuckets);
                // v1.58：移除类型分布横向图（基本都是游戏，意义不大）
                html += '</div>';
                // 右侧游戏列表
                html += '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;">';
                // v1.58：搜索框 + 二级筛选标签 + 视图切换同一行
                // 多人想要时搜索框缩短给二级标签让位；切换到其他筛选项时二级标签隐藏、搜索框恢复默认长度
                var searchFlex = isMultiWant ? '0 0 150px' : '1 1 auto';
                html += '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">';
                html += '<input id="wl_search" type="text" placeholder="搜索游戏名称或 AppID…" value="' + faEscAttr(wlState.search) + '" style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);color:#c6d4df;padding:6px 12px;border-radius:6px;font-size:12px;flex:' + searchFlex + ';min-width:0;box-sizing:border-box;" onfocus="this.style.borderColor=\'#06cfbe60\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.1)\'">';
                // 二级筛选标签（仅多人想要时显示）
                if (isMultiWant) {
                    var subTags = [['0','全部'],['2','2人'],['3','3人'],['4','4人'],['5','5人'],['6','6人']];
                    var subTagsHtml = subTags.map(function(t) {
                        var val = parseInt(t[0]);
                        var enabled = val === 0 ? stats.multiWant > 0 : (wisherCounts[val] || 0) > 0;
                        var active = wlState.subFilter === val;
                        var cls = 'fa-wl-subtag' + (active ? ' active' : '') + (enabled ? '' : ' disabled');
                        return '<button class="' + cls + '" data-wl-sub="' + val + '"' + (enabled ? '' : ' disabled') + '>' + t[1] + '</button>';
                    }).join('');
                    html += '<div class="fa-wl-subtags" id="wl_subtags">' + subTagsHtml + '</div>';
                }
                // 视图切换（列表 / 封面）
                var isList = wlState.viewMode !== 'cover';
                html += '<div class="fa-wl-view-toggle" style="flex-shrink:0;">'
                    + '<button class="fa-wl-view-btn' + (isList ? ' active' : '') + '" data-wl-view="list" title="列表视图">'
                    + '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>'
                    + '<span>列表</span></button>'
                    + '<button class="fa-wl-view-btn' + (!isList ? ' active' : '') + '" data-wl-view="cover" title="封面视图">'
                    + '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'
                    + '<span>封面</span></button>'
                    + '</div>';
                html += '</div>';
                // 游戏列表容器
                html += '<div id="wl_game_list"></div>';
                html += '</div>';
                html += '</div>';
                wlWrap.innerHTML = html;
                // 绑定事件
                var refreshBtn = wlWrap.querySelector('#btn_refresh_wishlist');
                if (refreshBtn) refreshBtn.addEventListener('click', function() {
                    wlCache.data = null; wlCache.updatedAt = 0;
                    // v1.78：同步清除 GM_setValue 持久化缓存
                    faWlDataClear();
                    faToast.info('正在刷新家庭愿望单…');
                    renderWishlistTab();
                });
                var searchInput = wlWrap.querySelector('#wl_search');
                if (searchInput) {
                    var searchTimer = null;
                    searchInput.addEventListener('input', function(e) {
                        clearTimeout(searchTimer);
                        var val = e.target.value;
                        searchTimer = setTimeout(function() {
                            wlState.search = val;
                            wlState.page = 1;
                            renderWishlistGamesList(wlData);
                        }, 200);
                    });
                }
                wlWrap.querySelectorAll('[data-wl-filter]').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        wlState.filter = btn.getAttribute('data-wl-filter');
                        wlState.page = 1;
                        wlState.subFilter = 0;   // 切换主筛选项时重置二级筛选
                        renderWishlistContent(wlWrap, wlData);
                    });
                });
                // v1.58：二级筛选标签——仅刷新游戏列表（轻量，不重建仪表盘）
                wlWrap.querySelectorAll('.fa-wl-subtag').forEach(function(btn) {
                    if (btn.disabled) return;
                    btn.addEventListener('click', function() {
                        wlState.subFilter = parseInt(btn.getAttribute('data-wl-sub')) || 0;
                        wlState.page = 1;
                        wlWrap.querySelectorAll('.fa-wl-subtag').forEach(function(t) {
                            t.classList.toggle('active', parseInt(t.getAttribute('data-wl-sub')) === wlState.subFilter);
                        });
                        renderWishlistGamesList(wlData);
                    });
                });
                // v1.58：视图切换——仅刷新游戏列表
                wlWrap.querySelectorAll('[data-wl-view]').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var mode = btn.getAttribute('data-wl-view');
                        if (mode === wlState.viewMode) return;
                        wlState.viewMode = mode;
                        GM_setValue('faWlViewMode', mode);
                        wlState.page = 1;
                        wlWrap.querySelectorAll('[data-wl-view]').forEach(function(b) {
                            b.classList.toggle('active', b.getAttribute('data-wl-view') === mode);
                        });
                        renderWishlistGamesList(wlData);
                    });
                });
                renderWishlistGamesList(wlData);
            }

            function buildKpiCard(label, value, color, sub) {
                return '<div style="background:linear-gradient(135deg,' + color + '20 0%,' + color + '08 100%);border:1px solid ' + color + '30;border-radius:8px;padding:8px 6px;text-align:center;">'
                    + '<div style="font-size:20px;font-weight:700;color:' + color + ';line-height:1.2;">' + value + '</div>'
                    + '<div style="font-size:10px;color:#8097a8;">' + label + '</div>'
                    + (sub ? '<div style="font-size:9px;color:#64748b;margin-top:2px;">' + sub + '</div>' : '')
                    + '</div>';
            }

            // v1.66：合并 buildBarChart 与 buildMemberBarChart，通过 opts.avatar 控制头像显示
            function buildBarChart(title, items, color, opts) {
                opts = opts || {};
                var showAvatar = opts.avatar || false;
                if (!items || items.length === 0) return '';
                var max = 1;
                items.forEach(function(i) { if (i.value > max) max = i.value; });
                var gap = showAvatar ? '3px' : '6px';
                var nameW = showAvatar ? '64px' : '76px';
                var minW = showAvatar ? '30px' : '40px';
                var rows = '';
                items.forEach(function(i) {
                    var pct = max > 0 ? (i.value / max * 100) : 0;
                    var barPct = i.value > 0 ? Math.max(3, pct) : 0;
                    var avatarHtml = showAvatar ? faNameAvatarHtml(i.name, 18, 'margin-right:5px;') : '';
                    rows += '<div style="display:flex;align-items:center;gap:' + gap + ';margin-bottom:8px;">'
                        + avatarHtml
                        + '<span style="flex-shrink:0;width:' + nameW + ';font-size:11px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + faEscAttr(i.name) + '">' + faEsc(i.name) + '</span>'
                        + '<div style="flex:1;height:9px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;min-width:' + minW + ';">'
                        + '<div style="height:100%;width:' + barPct.toFixed(1) + '%;background:' + color + ';border-radius:4px;transition:width 0.4s ease;"></div></div>'
                        + '<span style="flex-shrink:0;min-width:28px;text-align:right;font-size:11px;font-weight:600;color:#c6d4df;">' + i.value + '</span>'
                        + '</div>';
                });
                return '<div style="background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px 12px 4px;">'
                    + '<div style="font-size:13px;font-weight:600;color:#c7d5e0;margin-bottom:10px;">' + title + '</div>'
                    + rows + '</div>';
            }

            // v1.58：成员愿望单分布专用横向柱状图——名称前增加首字头像（唯一背景色区分用户）
            // v1.66：薄封装，委托给 buildBarChart({avatar:true})，保留以兼容旧调用
            function buildMemberBarChart(title, items, color) {
                return buildBarChart(title, items, color, { avatar: true });
            }

            function buildDonutChart(title, buckets) {
                if (!buckets || buckets.length === 0) return '';
                var total = 0;
                buckets.forEach(function(b) { total += b.count; });
                if (total === 0) return '';
                var size = 100, cx = size / 2, cy = size / 2;
                var outerR = 42, innerR = 26;
                var startAngle = -Math.PI / 2;
                var activeBuckets = buckets.filter(function(b) { return b.count > 0; });
                var isSingle = activeBuckets.length === 1;
                var arcs = '';
                var legend = '';
                buckets.forEach(function(b) {
                    if (b.count === 0) {
                        legend += '<div style="display:flex;align-items:center;gap:5px;font-size:10px;opacity:0.4;">'
                            + '<span style="width:9px;height:9px;border-radius:2px;background:' + b.color + ';flex-shrink:0;"></span>'
                            + '<span style="color:#64748b;flex:1;white-space:nowrap;">' + b.label + '</span>'
                            + '<span style="color:#475569;font-weight:600;">0</span>'
                            + '</div>';
                        return;
                    }
                    var pct = b.count / total;
                    if (isSingle) {
                        arcs += '<path d="M' + cx + ',' + (cy - outerR) + ' A' + outerR + ',' + outerR + ' 0 1 1 ' + (cx - 0.01) + ',' + (cy - outerR) + ' Z" fill="' + b.color + '"/>'
                            + '<path d="M' + cx + ',' + (cy - innerR) + ' A' + innerR + ',' + innerR + ' 0 1 0 ' + (cx - 0.01) + ',' + (cy - innerR) + ' Z" fill="#1b2838"/>';
                    } else {
                        var endAngle = startAngle + pct * 2 * Math.PI;
                        var x1 = cx + outerR * Math.cos(startAngle);
                        var y1 = cy + outerR * Math.sin(startAngle);
                        var x2 = cx + outerR * Math.cos(endAngle);
                        var y2 = cy + outerR * Math.sin(endAngle);
                        var x3 = cx + innerR * Math.cos(endAngle);
                        var y3 = cy + innerR * Math.sin(endAngle);
                        var x4 = cx + innerR * Math.cos(startAngle);
                        var y4 = cy + innerR * Math.sin(startAngle);
                        var largeArc = pct > 0.5 ? 1 : 0;
                        arcs += '<path d="M' + x1.toFixed(2) + ',' + y1.toFixed(2)
                            + ' A' + outerR + ',' + outerR + ' 0 ' + largeArc + ' 1 ' + x2.toFixed(2) + ',' + y2.toFixed(2)
                            + ' L' + x3.toFixed(2) + ',' + y3.toFixed(2)
                            + ' A' + innerR + ',' + innerR + ' 0 ' + largeArc + ' 0 ' + x4.toFixed(2) + ',' + y4.toFixed(2)
                            + ' Z" fill="' + b.color + '" stroke="#1b2838" stroke-width="1"/>';
                        startAngle = endAngle;
                    }
                    legend += '<div style="display:flex;align-items:center;gap:5px;font-size:10px;">'
                        + '<span style="width:9px;height:9px;border-radius:2px;background:' + b.color + ';flex-shrink:0;"></span>'
                        + '<span style="color:#94a3b8;flex:1;white-space:nowrap;">' + b.label + '</span>'
                        + '<span style="color:#c6d4df;font-weight:600;">' + b.count + '</span>'
                        + '</div>';
                });
                return '<div style="background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:12px;">'
                    + '<div style="font-size:13px;font-weight:600;color:#c7d5e0;margin-bottom:10px;">' + title + '</div>'
                    + '<div style="display:flex;gap:10px;align-items:center;">'
                    + '<div style="flex-shrink:0;">'
                    + '<svg viewBox="0 0 ' + size + ' ' + size + '" width="88" height="88" style="display:block;">'
                    + arcs
                    + '<text x="' + cx + '" y="' + (cy + 1) + '" text-anchor="middle" fill="#c6d4df" font-size="16" font-weight="700">' + total + '</text>'
                    + '<text x="' + cx + '" y="' + (cy + 12) + '" text-anchor="middle" fill="#64748b" font-size="7">总数</text>'
                    + '</svg>'
                    + '</div>'
                    + '<div style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0;">' + legend + '</div>'
                    + '</div></div>';
            }

            function getFilteredWishlist(wlData) {
                if (!wlData || !wlData.GameList || !wlData.GameInfo) return [];
                var q = wlState.search.trim().toLowerCase();
                var libSet = {};
                if (saves.familyGameList && saves.familyGameList.GameList) {
                    saves.familyGameList.GameList.forEach(function(a) { libSet[a] = true; });
                }
                return wlData.GameList.filter(function(a) {
                    var gi = wlData.GameInfo[a];
                    if (!gi) return false;
                    if (q && !String(gi.name || '').toLowerCase().includes(q) && !String(a).includes(q)) return false;
                    if (wlState.filter === 'inLibrary' && !gi.inLibrary) return false;
                    if (wlState.filter === 'multiWant') {
                        var wc = (gi.wishers && gi.wishers.length) || 0;
                        if (wc < 2) return false;
                        // v1.58：二级筛选——subFilter=0 表示全部（≥2），否则精确匹配人数
                        if (wlState.subFilter > 0 && wc !== wlState.subFilter) return false;
                    }
                    // v1.60 修复（参考 1.0.8）：onSale 计入折扣中筛选（与统计口径一致）
                    if (wlState.filter === 'discount' && !(gi.discountPct > 0 || gi.onSale)) return false;
                    // v1.60：即将推出（未发售）筛选
                    if (wlState.filter === 'soon' && !gi.isComingSoon) return false;
                    // v1.76：年度大作筛选——仅显示命中年度大作数据的愿望单游戏
                    if (wlState.filter === 'goty' && !faIsGoty(a)) return false;
                    return true;
                });
            }

            // v1.58：价格 HTML（列表/封面视图共用）
            function wlPriceHtml(gi) {
                var curSym = faCurrency.symbol;
                // v1.60：确认未发售且无价格的游戏显示"即将推出"（原为空白，与价格未获取到无法区分）；
                // 未发售免费游戏同属此类（"免费"标签留给已发售免费游戏）
                if (gi.isComingSoon && !(gi.finalPrice > 0)) return '<span style="color:#38bdf8;font-size:10px;font-weight:600;white-space:nowrap;">即将推出</span>';
                if (gi.isFree) return '<span style="color:#a78bfa;font-size:10px;font-weight:600;white-space:nowrap;">免费</span>';
                if (gi.finalPrice > 0) {
                    var fp = Number(gi.finalPrice) || 0;
                    if (gi.discountPct > 0) {
                        // v1.43：有折扣时仅显示折扣价 + 折扣徽章，不再展示划线原价，节省空间
                        return '<span style="color:#fbbf24;font-size:10px;font-weight:600;white-space:nowrap;">' + curSym + (isNaN(fp) ? '0.00' : fp.toFixed(2)) + '</span>'
                            + '<span style="color:#2ed573;font-size:9px;font-weight:600;white-space:nowrap;">-' + gi.discountPct + '%</span>';
                    }
                    // v1.60：onSale 但无折扣百分比（active_discounts 类促销）显示"促销"标记
                    var saleTag = (gi.onSale && !(gi.discountPct > 0))
                        ? '<span style="color:#2ed573;font-size:9px;font-weight:600;white-space:nowrap;">促销</span>' : '';
                    return '<span style="color:#c6d4df;font-size:10px;font-weight:600;white-space:nowrap;">' + curSym + (isNaN(fp) ? '0.00' : fp.toFixed(2)) + '</span>' + saleTag;
                }
                return '';
            }

            // v1.58：封面视图成员头像 HTML——名称首字头像 + 堆叠效果
            // 最多展示 3 个头像，超出显示 +N；价格/折扣占用空间时自动收窄
            function wlWisherAvatarsHtml(gi, idMap) {
                var wishers = gi.wishers || [];
                if (wishers.length === 0) return '';
                var maxShow = 3;
                var shown = wishers.slice(0, maxShow);
                var overflow = wishers.length - maxShow;
                var html = '<div class="fa-wl-cover-avatars" style="display:flex;align-items:center;">';
                shown.forEach(function(sid, idx) {
                    var nm = idMap[sid] || ('ID:' + String(sid).slice(-4));
                    // 堆叠：后面的头像向左偏移，形成重叠效果
                    var ml = idx === 0 ? '' : 'margin-left:-6px;border:1.5px solid #0f172a;';
                    html += faNameAvatarHtml(nm, 16, ml + 'z-index:' + (10 - idx) + ';');
                });
                if (overflow > 0) {
                    html += '<span style="margin-left:-4px;z-index:5;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:rgba(255,255,255,0.15);color:#c6d4df;font-size:8px;font-weight:700;flex-shrink:0;border:1.5px solid #0f172a;">+' + overflow + '</span>';
                }
                html += '</div>';
                return html;
            }

            function renderWishlistGamesList(wlData) {
                var listEl = panel.querySelector('#wl_game_list');
                if (!listEl || !wlData) return;
                var filtered = getFilteredWishlist(wlData);
                var total = filtered.length;
                // v1.58：列表视图每页 30，封面视图每页 24（6 行×4 列）
                var pageSize = wlState.viewMode === 'cover' ? 24 : 30;
                var totalPages = Math.max(1, Math.ceil(total / pageSize));
                if (wlState.page > totalPages) wlState.page = totalPages;
                if (wlState.page < 1) wlState.page = 1;
                var start = (wlState.page - 1) * pageSize;
                var end = Math.min(start + pageSize, total);
                var pageItems = filtered.slice(start, end);
                var idMap = saves.familyInfo.steamIdtoName || {};
                var growthColors = ['#06cfbe', '#54a0ff', '#ff9f43', '#2ed573', '#ff6b6b', '#a29bfe'];
                var isCover = wlState.viewMode === 'cover';
                // v1.46：分页按钮/徽章/卡片/游戏名链接改用 fa-global-style 中的 CSS 类，仅保留动态颜色内联
                var pgBtn = function(page, label, disabled) {
                    return '<button class="fa-wl-pgbtn" data-wl-page="' + page + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
                };
                // 分页信息
                var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:4px;">'
                    + '<span style="font-size:11px;color:#8097a8;">共 <b style="color:#c6d4df;">' + total + '</b> 个 · 第 <b style="color:#06cfbe;">' + wlState.page + '/' + totalPages + '</b> 页</span>'
                    + '<div style="display:flex;gap:3px;">'
                    + pgBtn(wlState.page - 1, '上一页', wlState.page <= 1)
                    + pgBtn(wlState.page + 1, '下一页', wlState.page >= totalPages)
                    + '</div></div>';
                if (pageItems.length === 0) {
                    html += '<div style="text-align:center;padding:30px 20px;color:#64748b;font-size:12px;">没有符合条件的游戏</div>';
                } else if (isCover) {
                    // ---- v1.58 封面视图：4 列精简卡片，含成员头像 ----
                    html += '<div class="fa-wl-cover-grid">';
                    pageItems.forEach(function(aid) {
                        var gi = wlData.GameInfo[aid];
                        if (!gi) return;
                        var wantCount = (gi.wishers && gi.wishers.length) || 0;
                        var nameStyle = (!gi.name || gi.name === ('App ' + aid)) ? ' style="color:#64748b;font-style:italic;font-weight:400;"' : '';
                        html += '<div class="fa-wl-cover-card"' + (gi.inLibrary ? ' style="opacity:0.7;"' : '') + '>'
                            + '<div class="fa-wl-cover-cap-wrap" onclick="window.open(\'https://store.steampowered.com/app/' + aid + '\',\'_blank\')">'
                            + '<img data-fa-cover="' + aid + '" loading="lazy" decoding="async" src="' + FA_COVER_SVG + '" class="fa-wl-cover-cap">'
                            + (wantCount > 0 ? '<span class="fa-wl-cover-want-badge">' + wantCount + '人想要</span>' : '')
                            + (gi.inLibrary ? '<span class="fa-wl-cover-lib-badge">已有</span>' : '')
                            + (gi.isComingSoon ? '<span class="fa-wl-cover-soon-badge">即将推出</span>' : '')
                            + (faIsGoty(aid) ? '<span class="fa-wl-cover-goty-badge">年度大作</span>' : '')
                            + '</div>'
                            + '<div class="fa-wl-cover-info">'
                            + '<a class="fa-wl-cover-name" href="https://store.steampowered.com/app/' + aid + '" target="_blank"' + nameStyle + '>' + faEsc(gi.name) + '</a>'
                            + '<div class="fa-wl-cover-bottom">'
                            + '<span style="display:flex;align-items:center;gap:3px;min-width:0;overflow:hidden;">' + wlPriceHtml(gi) + '</span>'
                            + wlWisherAvatarsHtml(gi, idMap)
                            + '</div>'
                            + '</div>'
                            + '</div>';
                    });
                    html += '</div>';
                    if (totalPages > 1) {
                        html += '<div style="display:flex;align-items:center;justify-content:center;gap:3px;margin-top:6px;">'
                            + pgBtn(1, '首页', wlState.page <= 1)
                            + pgBtn(wlState.page - 1, '上一页', wlState.page <= 1)
                            + pgBtn(wlState.page + 1, '下一页', wlState.page >= totalPages)
                            + pgBtn(totalPages, '末页', wlState.page >= totalPages)
                            + '</div>';
                    }
                } else {
                    // ---- 列表视图（2 列紧凑卡片）----
                    html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:5px;">';
                    pageItems.forEach(function(aid) {
                        var gi = wlData.GameInfo[aid];
                        if (!gi) return;
                        var wisherBadges = (gi.wishers || []).map(function(sid, idx) {
                            var c = growthColors[idx % growthColors.length];
                            var nm = idMap[sid] || ('ID:' + String(sid).slice(-4));
                            return '<span class="fa-wl-badge" style="color:' + c + ';background:' + c + '12;">' + faEsc(nm) + '</span>';
                        }).join('');
                        var libBadge = gi.inLibrary ? '<span class="fa-wl-badge" style="color:#06cfbe;background:#06cfbe15;">已有</span>' : '';
                        var wantBadge = (gi.wishers && gi.wishers.length > 0)
                            ? '<span class="fa-wl-badge" style="color:#54a0ff;background:#54a0ff15;">' + gi.wishers.length + '人想要</span>'
                            : '';
                        // v1.60：预购（未发售但有价格）游戏显示"即将推出"徽章（无价格的已由 wlPriceHtml 展示）
                        var soonBadge = (gi.isComingSoon && gi.finalPrice > 0) ? '<span class="fa-wl-badge" style="color:#38bdf8;background:#38bdf815;">即将推出</span>' : '';
                        // v1.76：年度大作徽章
                        var gotyBadge = faIsGoty(aid) ? '<span class="fa-wl-badge" style="color:#f59e0b;background:linear-gradient(135deg,#f59e0b20,#ef444420);font-weight:600;">年度大作</span>' : '';
                        var tagsHtml = (gi.tags || []).slice(0, 2).map(function(t) {
                            return '<span class="fa-wl-badge" style="color:#64748b;background:rgba(255,255,255,0.04);">' + faEsc(t) + '</span>';
                        }).join('');
                        html += '<div class="fa-wl-card"' + (gi.inLibrary ? ' style="opacity:0.6;"' : '') + '>'
                            + '<img data-fa-cover="' + aid + '" loading="lazy" decoding="async" src="' + FA_COVER_SVG + '" style="width:28px;height:28px;border-radius:4px;flex-shrink:0;object-fit:cover;background:#1b2838;">'
                            + '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;">'
                            // 第一行：游戏名称（左）+ 价格/已有/N人想要（右侧对齐）
                            + '<div style="display:flex;align-items:center;gap:4px;min-width:0;">'
                            // v1.52：占位名称（App xxxxxx）以暗色斜体显示，与已获取的真实名称明确区分
                            + '<a class="fa-wl-name" href="https://store.steampowered.com/app/' + aid + '" target="_blank"' + ((!gi.name || gi.name === ('App ' + aid)) ? ' style="color:#64748b;font-style:italic;font-weight:400;"' : '') + '>' + faEsc(gi.name) + '</a>'
                            + '<span style="margin-left:auto;display:flex;align-items:center;gap:3px;flex-shrink:0;">' + wlPriceHtml(gi) + soonBadge + gotyBadge + libBadge + wantBadge + '</span>'
                            + '</div>'
                            // 第二行：成员名 + 标签
                            + '<div style="display:flex;align-items:center;gap:2px;flex-wrap:wrap;min-width:0;overflow:hidden;">' + wisherBadges + tagsHtml + '</div>'
                            + '</div>'
                            + '</div>';
                    });
                    html += '</div>';
                    // 底部分页
                    if (totalPages > 1) {
                        html += '<div style="display:flex;align-items:center;justify-content:center;gap:3px;margin-top:6px;">'
                            + pgBtn(1, '首页', wlState.page <= 1)
                            + pgBtn(wlState.page - 1, '上一页', wlState.page <= 1)
                            + pgBtn(wlState.page + 1, '下一页', wlState.page >= totalPages)
                            + pgBtn(totalPages, '末页', wlState.page >= totalPages)
                            + '</div>';
                    }
                }
                listEl.innerHTML = html;
                // 绑定分页
                listEl.querySelectorAll('[data-wl-page]').forEach(function(btn) {
                    if (btn.disabled) return;
                    btn.addEventListener('click', function() {
                        var np = parseInt(btn.getAttribute('data-wl-page'));
                        if (np >= 1) { wlState.page = np; renderWishlistGamesList(wlData); }
                    });
                });
                // v1.54：异步加载游戏中文名，覆盖 SSR/API 返回的英文名（列表 + 封面视图名称链接）
                listEl.querySelectorAll('.fa-wl-name, .fa-wl-cover-name').forEach(function(el) {
                    var href = el.getAttribute('href') || '';
                    var m = href.match(/\/app\/(\d+)/);
                    if (!m) return;
                    var aid = m[1];
                    var gi = wlData.GameInfo[aid];
                    faLoadGameZhName(el, aid, gi ? (gi.name || '') : '');
                });
                // v1.55：多 CDN 封面图 fallback（参考 steam-friend-manager dashLoadCapsule）
                listEl.querySelectorAll('img[data-fa-cover]').forEach(function(img) {
                    faLoadCover(img, img.getAttribute('data-fa-cover'));
                });
                // v1.58：封面视图成员头像已改为名称首字头像（纯 CSS 渲染，无需异步加载）
            }

            // v1.48：6 张 KPI 卡片紧凑为左侧一列（含原次级 KPI 行的多人共享/独占率），
            // 子标题收进 title 悬浮提示，腾出纵向空间给柱状图
            const kpiDefs = [
                { label: '共享游戏总数', value: totalGames, color: '#06cfbe', sub: '全家庭去重后' },
                { label: '独占贡献游戏', value: singleOwnerCount, color: '#ff9f43', sub: '仅 1 人拥有' },
                { label: '人均贡献约', value: avgGames, color: '#54a0ff', sub: memberCount + ' 名成员均摊' },
                { label: '近30日新增', value: recent30Count, color: '#2ed573', sub: totalGames > 0 ? (recent30Count / totalGames * 100).toFixed(1) + '% 增量' : '暂无新增' },
                { label: '多人共享游戏', value: multiOwnerCount, color: '#a78bfa', sub: totalGames > 0 ? (multiOwnerCount / totalGames * 100).toFixed(0) + '% 共享率' : '' },
                { label: '独占率', value: (totalGames > 0 ? (singleOwnerCount / totalGames * 100).toFixed(0) : 0) + '%', color: '#ffcd56', sub: '独占/总数' }
            ];
            const kpiColHtml = kpiDefs.map(k =>
                '<div style="background:rgba(15,23,42,0.6);border:1px solid ' + k.color + '30;border-radius:8px;padding:6px 10px;" title="' + k.sub + '">'
                + '<div style="font-size:16px;font-weight:700;color:' + k.color + ';line-height:1.2;">' + k.value + '</div>'
                + '<div style="font-size:10px;color:#8097a8;">' + k.label + '</div>'
                + '</div>'
            ).join('');

            // v1.58：首页增加"我加入家庭组的时间"卡片（参考截图设计：心形图标 + 加入日期 + 已加入天数）
            // v1.75：调整文案为"我于 XXXX 加入家庭组"，底部增加"查看我的贡献"按钮
            var myJoinHtml = '';
            var mySidForJoin = saves.steamid || '';
            try {
                var myMember = (saves.familyInfo.family_member || []).find(function(m) { return m.steamid == mySidForJoin; });
                if (myMember) {
                    var myJoinTs = myMember.time_joined || 0;
                    var myJoinDateStr = myJoinTs > 0
                        ? new Date(myJoinTs * 1000).toLocaleDateString('zh-CN')
                        : '未知';
                    var myJoinDays = myJoinTs > 0
                        ? Math.floor((Date.now() - myJoinTs * 1000) / 86400000)
                        : 0;
                    var myName = myMember.userName || (saves.familyInfo.steamIdtoName || {})[mySidForJoin] || '我';
                    // v1.75：紧凑垂直卡片，文案精简为"我于 XXXX 加入"，底部增加"查看我的贡献"按钮
                    myJoinHtml = '<div style="text-align:center;background:linear-gradient(135deg,rgba(168,85,247,0.12) 0%,rgba(59,130,246,0.08) 100%);border:1px solid rgba(168,85,247,0.2);border-radius:10px;padding:8px 6px;margin-bottom:6px;">'
                        + '<div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:4px;white-space:nowrap;">'
                        + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
                        + '<span style="font-size:10px;color:#c6d4df;white-space:nowrap;">我于 <span style="color:#06cfbe;font-weight:600;">' + myJoinDateStr + '</span> 加入</span>'
                        + '</div>'
                        + '<div style="font-size:20px;color:#06cfbe;font-weight:700;line-height:1.2;">' + myJoinDays + '<span style="font-size:10px;color:#8097a8;font-weight:400;"> 天</span></div>'
                        + '<div style="margin-top:4px;display:flex;justify-content:center;">' + faNameAvatarHtml(myName, 24, 'border:2px solid rgba(168,85,247,0.4);') + '</div>'
                        // v1.75：查看我的贡献按钮
                        + '<button id="faViewMyContrib" style="margin-top:6px;width:100%;background:linear-gradient(135deg,rgba(6,207,190,0.25) 0%,rgba(168,85,247,0.15) 100%);border:1px solid rgba(6,207,190,0.35);color:#06cfbe;padding:5px 8px;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:3px;" onmouseover="this.style.borderColor=\'rgba(6,207,190,0.6)\';this.style.background=\'linear-gradient(135deg,rgba(6,207,190,0.35) 0%,rgba(168,85,247,0.2) 100%)\'" onmouseout="this.style.borderColor=\'rgba(6,207,190,0.35)\';this.style.background=\'linear-gradient(135deg,rgba(6,207,190,0.25) 0%,rgba(168,85,247,0.15) 100%)\'">'
                        + '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'
                        + '查看我的贡献</button>'
                        + '</div>';
                }
            } catch(e){console.warn('[FA]', e)}

            // ===================== v1.62 共享冷却标签页渲染（参考 sffxzzp Family Sharing Cooldown 追踪模式） =====================
            // v1.63：搜索 + 分页 + 紧凑两列卡片 + 拥有者头像堆叠 + 移除封面图（性能优化）
            // 冷却记录持久化到 GM_setValue（faCooldownRegistry），过期自动移至"可借用"列表
            // 拆分为 renderCooldownTab（渲染骨架+工具栏）与 renderCdContent（渲染列表内容），
            // 搜索/分页仅刷新内容区，不重建搜索框，保持输入焦点
            let cdState = { search: '', page: 1, gotyFilter: false };
            function renderCooldownTab() {
                var cdWrap = panel.querySelector('[data-cooldown-content]');
                if (!cdWrap) return;
                // v1.76：确保年度大作(GOTY)数据已加载（用于筛选与徽章展示）
                if (!faGotyData) faLoadGotyData(false).then(function() {
                    var p = document.getElementById('familyAnalysisPanel');
                    if (p && window[activeTabKey] === 'cooldown') renderCdContent();
                });
                // 清理旧定时器（避免面板重开后残留）
                if (window.__faCooldownTimer) { clearInterval(window.__faCooldownTimer); window.__faCooldownTimer = null; }
                // 渲染骨架：工具栏 + 说明 + 内容容器
                var html = '';
                // v1.76：新增"年度大作"筛选按钮（toggle，激活时仅显示年度大作游戏）
                var gotyBtnStyle = cdState.gotyFilter
                    ? 'background:linear-gradient(135deg,#f59e0b20,#ef444420);border:1px solid #f59e0b60;color:#f59e0b;'
                    : 'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#8097a8;';
                html += '<div class="fa-cd-toolbar">'
                    + '<input id="fa_cd_search" type="text" placeholder="搜索游戏名称或 AppID…" value="' + faEscAttr(cdState.search) + '" style="background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.1);color:#c6d4df;padding:5px 10px;border-radius:6px;font-size:12px;flex:1 1 auto;min-width:0;box-sizing:border-box;" onfocus="this.style.borderColor=\'#06cfbe60\'" onblur="this.style.borderColor=\'rgba(255,255,255,.1)\'">'
                    + '<button id="fa_cd_goty_filter" style="' + gotyBtnStyle + 'padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;flex-shrink:0;white-space:nowrap;">年度大作</button>'
                    + '<div id="fa_cd_stats" style="font-size:12px;color:#8097a8;flex-shrink:0;"></div>'
                    + '<button id="fa_cd_refresh" class="fa-btn-green fa-btn-sm">刷新共享库</button>'
                    + '</div>';
                html += '<div style="font-size:11px;color:#64748b;margin:6px 0 10px;line-height:1.6;">'
                    + 'Steam 家庭共享机制：借用人停止游玩借来的游戏后，该游戏会有 24 小时冷却期，期间其他借用人无法游玩。点击"标记借出"记录借出时间并启动冷却倒计时，过期后自动移至"可借用"列表。'
                    + '</div>';
                html += '<div id="fa_cd_content"></div>';
                cdWrap.innerHTML = html;
                // 绑定搜索框（防抖 200ms，仅刷新内容区，保持输入焦点）
                var searchInput = cdWrap.querySelector('#fa_cd_search');
                if (searchInput) {
                    var searchTimer = null;
                    searchInput.addEventListener('input', function(e) {
                        clearTimeout(searchTimer);
                        var val = e.target.value;
                        searchTimer = setTimeout(function() {
                            cdState.search = val;
                            cdState.page = 1;
                            renderCdContent();
                        }, 200);
                    });
                }
                // v1.76：年度大作筛选按钮（toggle 切换，仅刷新内容区）
                var gotyBtn = cdWrap.querySelector('#fa_cd_goty_filter');
                if (gotyBtn) {
                    gotyBtn.addEventListener('click', function() {
                        cdState.gotyFilter = !cdState.gotyFilter;
                        cdState.page = 1;
                        // 更新按钮样式
                        if (cdState.gotyFilter) {
                            gotyBtn.style.cssText = 'background:linear-gradient(135deg,#f59e0b20,#ef444420);border:1px solid #f59e0b60;color:#f59e0b;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;flex-shrink:0;white-space:nowrap;';
                        } else {
                            gotyBtn.style.cssText = 'background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#8097a8;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;flex-shrink:0;white-space:nowrap;';
                        }
                        renderCdContent();
                    });
                }
                // 刷新共享库按钮：重新拉取 GetSharedLibraryApps 并更新本地缓存
                var refreshBtn = cdWrap.querySelector('#fa_cd_refresh');
                if (refreshBtn) {
                    refreshBtn.addEventListener('click', function() {
                        if (!access_token || !(saves.familyInfo && saves.familyInfo.family_groupid)) {
                            refreshBtn.textContent = '缺少家庭组信息';
                            return;
                        }
                        refreshBtn.disabled = true;
                        refreshBtn.textContent = '刷新中…';
                        getfamilyGameList(access_token, saves.familyInfo.family_groupid).then(function(ret) {
                            saves.familyGameList = ret;
                            saves.lastupDateTime = faCompat.serverTime();
                            savestorage();
                            if (window.faUpdateMenuBadge) window.faUpdateMenuBadge();
                            renderCdContent();
                        }).catch(function() {
                            refreshBtn.disabled = false;
                            refreshBtn.textContent = '刷新共享库';
                        });
                    });
                }
                // 渲染内容区
                renderCdContent();
            }
            // v1.63：仅渲染列表内容（冷却中 + 可借用分页），搜索/分页/借出/结束均调用此函数
            function renderCdContent() {
                var cdWrap = panel.querySelector('[data-cooldown-content]');
                if (!cdWrap) return;
                var content = cdWrap.querySelector('#fa_cd_content');
                if (!content) return;
                // 渲染前清理已过期的冷却记录
                faCooldownPrune();
                var reg = faCooldownLoad();
                var now = Math.floor(Date.now() / 1000);
                var idMap = (saves.familyInfo && saves.familyInfo.steamIdtoName) ? saves.familyInfo.steamIdtoName : {};
                var gameInfo = (saves.familyGameList && saves.familyGameList.GameInfo) ? saves.familyGameList.GameInfo : {};
                var gameList = (saves.familyGameList && saves.familyGameList.GameList) ? saves.familyGameList.GameList : [];
                // 当前用户可借用的家庭共享游戏 = 家庭库中 owners 不包含自己的游戏
                var sharedGames = gameList.filter(function(id) {
                    var gi = gameInfo[id];
                    return gi && Array.isArray(gi.owners) && gi.owners.length > 0 && !gi.owners.includes(saves.steamid);
                });
                // v1.63：搜索过滤（游戏名称或 AppID）
                var q = cdState.search.trim().toLowerCase();
                if (q) {
                    sharedGames = sharedGames.filter(function(id) {
                        var gi = gameInfo[id];
                        var nm = (gi && gi.name) ? String(gi.name).toLowerCase() : '';
                        return nm.indexOf(q) !== -1 || String(id).indexOf(q) !== -1;
                    });
                }
                // v1.76：年度大作筛选——仅保留命中年度大作数据的共享游戏
                if (cdState.gotyFilter) {
                    sharedGames = sharedGames.filter(function(id) { return faIsGoty(id); });
                }
                var cooling = [], borrowable = [];
                sharedGames.forEach(function(id) {
                    var r = reg[id];
                    if (r && r.cooldownEndsAt && r.cooldownEndsAt > now) {
                        cooling.push({ appid: id, info: gameInfo[id], record: r });
                    } else {
                        borrowable.push({ appid: id, info: gameInfo[id] });
                    }
                });
                // 冷却中按剩余时间升序
                cooling.sort(function(a, b) { return a.record.cooldownEndsAt - b.record.cooldownEndsAt; });

                // v1.63：拥有者头像堆叠 HTML（参考 wlWisherAvatarsHtml 实现）
                function cdOwnerAvatarsHtml(owners) {
                    if (!owners || owners.length === 0) return '';
                    var maxShow = 3;
                    var shown = owners.slice(0, maxShow);
                    var overflow = owners.length - maxShow;
                    var avHtml = '<div class="fa-cd-avatars">';
                    shown.forEach(function(sid, idx) {
                        var nm = idMap[sid] || ('ID:' + String(sid).slice(-4));
                        var ml = idx === 0 ? '' : 'margin-left:-6px;border:1.5px solid #1b2838;';
                        avHtml += faNameAvatarHtml(nm, 18, ml + 'z-index:' + (10 - idx) + ';');
                    });
                    if (overflow > 0) {
                        avHtml += '<span style="margin-left:-4px;z-index:5;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,.15);color:#c6d4df;font-size:9px;font-weight:700;flex-shrink:0;border:1.5px solid #1b2838;">+' + overflow + '</span>';
                    }
                    avHtml += '</div>';
                    return avHtml;
                }

                // v1.63：构建封面卡片 HTML（保留封面图，优化下方信息为两列布局）
                // 封面图 + 下方信息：第一列游戏名称（冷却中附倒计时+借用人），第二列左侧头像堆叠+右侧按钮
                function buildCard(appid, gi, opt) {
                    opt = opt || {};
                    var name = (gi && gi.name) ? faEsc(gi.name) : ('App ' + appid);
                    var nameStyle = (!gi || !gi.name || gi.name === ('App ' + appid)) ? ' style="color:#64748b;font-style:italic;font-weight:400;"' : '';
                    var capImg = '<img data-fa-cover="' + appid + '" loading="lazy" decoding="async" src="' + FA_COVER_SVG + '" class="fa-cd-cap">';
                    // v1.76：年度大作徽章（封面右上角，渐变橙红色）
                    var gotyBadgeHtml = faIsGoty(appid)
                        ? '<span style="position:absolute;top:4px;right:4px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px;z-index:2;">年度大作</span>'
                        : '';
                    var card = '<div class="fa-cd-card">'
                        + '<div class="fa-cd-cap-wrap" onclick="window.open(\'https://store.steampowered.com/app/' + appid + '\',\'_blank\')">'
                        + capImg + gotyBadgeHtml + '</div>'
                        + '<div class="fa-cd-info">'
                        + '<div class="fa-cd-col-name">'
                        + '<a class="fa-cd-name" href="https://store.steampowered.com/app/' + appid + '" target="_blank"' + nameStyle + '>' + name + '</a>';
                    if (opt.status === 'cooling') {
                        var borrowerName = idMap[opt.borrower] || ('ID:' + String(opt.borrower).slice(-4));
                        card += '<div class="fa-cd-countdown" data-fa-cd-remaining="' + opt.cooldownEndsAt + '">剩余 ' + faCooldownFormat(opt.cooldownEndsAt - now) + '</div>'
                            + '<div class="fa-cd-borrower-name">借用人 ' + faEsc(borrowerName) + '</div>';
                    }
                    card += '</div>'
                        + '<div class="fa-cd-col-actions">';
                    if (opt.status === 'cooling') {
                        var borrowerNm = idMap[opt.borrower] || ('ID:' + String(opt.borrower).slice(-4));
                        card += cdOwnerAvatarsHtml([opt.borrower])
                            + '<button class="fa-btn-green fa-btn-sm" data-fa-cd-end="' + appid + '">结束</button>';
                    } else {
                        var owners = (gi && gi.owners) ? gi.owners : [];
                        card += cdOwnerAvatarsHtml(owners)
                            + '<button class="fa-btn-green fa-btn-sm" data-fa-cd-borrow="' + appid + '">标记借出</button>';
                    }
                    card += '</div></div></div>';
                    return card;
                }

                var html = '';
                // 更新工具栏统计数字
                var statsEl = cdWrap.querySelector('#fa_cd_stats');
                if (statsEl) {
                    // v1.76：年度大作筛选激活时显示筛选标识
                    var gotyTag = cdState.gotyFilter ? '<span style="color:#f59e0b;font-weight:600;">★年度大作 </span>· ' : '';
                    statsEl.innerHTML = gotyTag
                        + '<span style="color:#ff6b6b;font-weight:600;">冷却中 ' + cooling.length + '</span> · '
                        + '<span style="color:#06cfbe;font-weight:600;">可借用 ' + borrowable.length + '</span>';
                }
                // 冷却中（通常较少，不分页）
                html += '<div class="fa-cd-section"><div class="fa-cd-section-title" style="color:#ff6b6b;">冷却中（' + cooling.length + '）</div>';
                if (cooling.length === 0) {
                    html += '<div class="fa-cd-empty">当前无冷却中的游戏</div>';
                } else {
                    html += '<div class="fa-cd-list">';
                    cooling.forEach(function(item) {
                        html += buildCard(item.appid, item.info, {
                            status: 'cooling',
                            borrower: item.record.borrower,
                            borrowTime: item.record.borrowTime,
                            cooldownEndsAt: item.record.cooldownEndsAt
                        });
                    });
                    html += '</div>';
                }
                html += '</div>';
                // 可借用（v1.63：分页，每页 15 个，降低渲染卡顿）
                html += '<div class="fa-cd-section"><div class="fa-cd-section-title" style="color:#06cfbe;">可借用（' + borrowable.length + '）</div>';
                if (borrowable.length === 0) {
                    html += '<div class="fa-cd-empty">' + (q ? '没有匹配的游戏' : (cdState.gotyFilter ? '共享库中无年度大作游戏' : '无可借用游戏')) + '</div>';
                } else {
                    var cdPageSize = 15;
                    var cdTotalPages = Math.max(1, Math.ceil(borrowable.length / cdPageSize));
                    if (cdState.page > cdTotalPages) cdState.page = cdTotalPages;
                    if (cdState.page < 1) cdState.page = 1;
                    var cdStart = (cdState.page - 1) * cdPageSize;
                    var cdEnd = Math.min(cdStart + cdPageSize, borrowable.length);
                    var cdPageItems = borrowable.slice(cdStart, cdEnd);
                    var pgBtn = function(page, label, disabled) {
                        return '<button class="fa-wl-pgbtn" data-cd-page="' + page + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>';
                    };
                    // 分页信息
                    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:4px;">'
                        + '<span style="font-size:11px;color:#8097a8;">第 <b style="color:#06cfbe;">' + cdState.page + '/' + cdTotalPages + '</b> 页 · 每页 ' + cdPageSize + ' 个</span>'
                        + '<div style="display:flex;gap:3px;">'
                        + pgBtn(cdState.page - 1, '上一页', cdState.page <= 1)
                        + pgBtn(cdState.page + 1, '下一页', cdState.page >= cdTotalPages)
                        + '</div></div>';
                    html += '<div class="fa-cd-list">';
                    cdPageItems.forEach(function(item) {
                        html += buildCard(item.appid, item.info, { status: 'borrowable' });
                    });
                    html += '</div>';
                    if (cdTotalPages > 1) {
                        html += '<div class="fa-cd-pgbar">'
                            + pgBtn(1, '首页', cdState.page <= 1)
                            + pgBtn(cdState.page - 1, '上一页', cdState.page <= 1)
                            + pgBtn(cdState.page + 1, '下一页', cdState.page >= cdTotalPages)
                            + pgBtn(cdTotalPages, '末页', cdState.page >= cdTotalPages)
                            + '</div>';
                    }
                }
                html += '</div>';
                content.innerHTML = html;

                // 异步加载封面图（多 CDN fallback）
                content.querySelectorAll('img[data-fa-cover]').forEach(function(img) {
                    faLoadCover(img, img.getAttribute('data-fa-cover'));
                });
                // 标记借出
                content.querySelectorAll('[data-fa-cd-borrow]').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var aid = Number(btn.getAttribute('data-fa-cd-borrow'));
                        var gi = gameInfo[aid];
                        faCooldownMarkBorrow(aid, gi ? gi.name : '', saves.steamid, gi ? gi.owners : []);
                        renderCdContent();
                    });
                });
                // 结束冷却
                content.querySelectorAll('[data-fa-cd-end]').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var aid = Number(btn.getAttribute('data-fa-cd-end'));
                        faCooldownRemove(aid);
                        renderCdContent();
                    });
                });
                // 分页按钮
                content.querySelectorAll('[data-cd-page]').forEach(function(btn) {
                    if (btn.disabled) return;
                    btn.addEventListener('click', function() {
                        var np = parseInt(btn.getAttribute('data-cd-page'));
                        if (np >= 1) { cdState.page = np; renderCdContent(); }
                    });
                });
                // 倒计时定时器（每秒更新，面板关闭或全部过期时自动停止/重渲染）
                if (window.__faCooldownTimer) { clearInterval(window.__faCooldownTimer); window.__faCooldownTimer = null; }
                if (cooling.length > 0) {
                    window.__faCooldownTimer = setInterval(function() {
                        if (!document.getElementById('familyAnalysisPanel')) {
                            clearInterval(window.__faCooldownTimer); window.__faCooldownTimer = null; return;
                        }
                        var stillCooling = false;
                        content.querySelectorAll('[data-fa-cd-remaining]').forEach(function(el) {
                            var endsAt = Number(el.getAttribute('data-fa-cd-remaining'));
                            var rem = endsAt - Math.floor(Date.now() / 1000);
                            if (rem > 0) { stillCooling = true; el.textContent = '剩余 ' + faCooldownFormat(rem); }
                            else { el.textContent = '已结束'; }
                        });
                        if (!stillCooling) {
                            clearInterval(window.__faCooldownTimer); window.__faCooldownTimer = null;
                            faCooldownPrune();
                            renderCdContent();
                        }
                    }, 1000);
                }
            }

            panel.innerHTML = ''
                + '<div id="familyAnalysisBackdrop" style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.62);"></div>'
                + '<div id="familyAnalysisDialog" style="position:relative;width:860px;max-width:96vw;max-height:85vh;background:linear-gradient(180deg,#1b2838 0%,#171a21 100%);border:1px solid rgba(255,255,255,0.1);border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,0.65);display:flex;flex-direction:column;overflow:hidden;">'
                // 头部
                + '  <div id="familyAnalysisDragHandle" style="background:linear-gradient(135deg,#1a3a4a 0%,#0e2430 100%);border-radius:14px 14px 0 0;padding:14px 18px;display:flex;align-items:center;gap:14px;cursor:move;user-select:none;flex-shrink:0;">'
                + '    <div style="background:linear-gradient(135deg,#a855f7 0%,#7c3aed 50%,#6d28d9 100%);width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 12px rgba(168,85,247,0.35),inset 0 1px 0 rgba(255,255,255,0.2);">'
                + '      <svg viewBox="0 0 24 24" width="26" height="26" fill="none">'
                + '        <circle cx="12" cy="7" r="3" fill="#e9d5ff"/>'
                + '        <circle cx="5.5" cy="9.5" r="2.3" fill="#c4b5fd"/>'
                + '        <circle cx="18.5" cy="9.5" r="2.3" fill="#c4b5fd"/>'
                + '        <path d="M2.5 21c0-3.8 4.2-6.5 9.5-6.5s9.5 2.7 9.5 6.5v0.5h-19z" fill="#e9d5ff"/>'
                + '        <path d="M2.5 21c0-2.5 1.8-4.5 4.3-5.5C5.7 16.4 4.8 18 4.8 19.8v1.7H2.5z" fill="#c4b5fd"/>'
                + '        <path d="M19.2 21v-1.2c0-1.8-0.9-3.4-2-4.3 2.5 1 4.3 3 4.3 5.5v0.5z" fill="#c4b5fd"/>'
                + '      </svg>'
                + '    </div>'
                + '    <div style="flex:1;min-width:0;">'
                + '      <div style="font-size:15px;font-weight:600;color:#c6d4df;">' + familyName + '</div>'
                + '      <div style="font-size:12px;color:#8097a8;">Steam 家庭组 · ' + memberCount + ' 名成员 · ' + totalGames + ' 个共享游戏</div>'
                + '    </div>'
                // v1.83：全局搜索框（中文/拼音/英文）——位于标题栏"现在扫描家庭库"按钮左侧
                + '    <div class="fa-global-search" id="fa-global-search">'
                + '      <span class="fa-global-search-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>'
                + '      <input type="text" id="fa-global-search-input" placeholder="搜索游戏（中文/拼音/英文）" autocomplete="off" spellcheck="false" maxlength="64">'
                + '      <button class="fa-global-search-clear" id="fa-global-search-clear" title="清除"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
                + '      <div class="fa-global-search-pop" id="fa-global-search-pop"></div>'
                + '    </div>'
                + '    <button id="btn_scan_now" class="fa-btn-green" style="flex-shrink:0;">现在扫描家庭库</button>'
                + '    <button id="btnClosePanel" style="width:30px;height:30px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#8097a8;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;flex-shrink:0;" onmouseover="this.style.background=\'rgba(255,100,100,0.2)\';this.style.color=\'#ff6b6b\'" onmouseout="this.style.background=\'rgba(255,255,255,0.06)\';this.style.color=\'#8097a8\'">&times;</button>'
                + '  </div>'
                // 标签导航
                + '  <div class="fa-mobile-nav" style="display:flex;background:rgba(15,23,42,0.6);padding:3px;margin:10px 14px 0;border-radius:8px;border:1px solid rgba(255,255,255,0.08);flex-shrink:0;overflow-x:auto;flex-wrap:nowrap;">'
                + tabDefs.map(t => '<button data-fa-nav="' + t.id + '" style="border:none;background:' + (window[activeTabKey] === t.id ? 'rgba(6,207,190,0.2)' : 'transparent') + ';color:' + (window[activeTabKey] === t.id ? '#06cfbe' : '#8097a8') + ';padding:6px 10px;font-size:11px;font-weight:600;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:4px;flex:1;justify-content:center;transition:color 0.2s,background 0.2s;white-space:nowrap;flex-shrink:0;" onmouseover="if(this.getAttribute(\'data-fa-nav\')!==\'' + window[activeTabKey] + '\'){this.style.color=\'#fff\'}" onmouseout="if(this.getAttribute(\'data-fa-nav\')!==\'' + window[activeTabKey] + '\'){this.style.color=\'#8097a8\'}">' + t.icon + '<span>' + t.label + '</span></button>').join('')
                + '  </div>'
                // 内容区
                + '  <div class="fa-panel-content" style="flex:1;overflow:hidden;position:relative;">'
                // -- 贡献分布 --
                + '    <div data-fa-tab="contribution" style="' + (window[activeTabKey] !== 'contribution' ? 'display:none;' : '') + '" class="fa-tab-pane">'
                // v1.75：默认视图容器（可被"我的贡献"覆盖层替换）
                + '      <div data-contrib-default class="fa-contrib-default">'
                // v1.58：三列布局——左侧（加入时间卡片 + KPI 列） | 中间贡献分布柱状图 | 右侧成员占比环形图 + 近半年入库增量（上顶均匀分布）
                + '      <div class="fa-contrib-layout" style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap;align-items:stretch;">'
                + '        <div class="fa-contrib-summary" style="flex:0 0 148px;min-width:130px;display:flex;flex-direction:column;gap:6px;">'
                + '          <div class="fa-contrib-join" style="display:contents;">' + myJoinHtml + '</div>'
                + '          <div class="fa-contrib-kpis" style="display:contents;">' + kpiColHtml + '</div>'
                + '        </div>'
                + '        <div data-chart-bar-card class="fa-contrib-chart-card" style="flex:1 1 380px;min-width:0;position:relative;background:rgba(30,41,59,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;box-shadow:0 4px 24px rgba(0,0,0,0.35);">'
                // v1.77：累计总量/近半年切换按钮（仪表卡片右上角，默认累计总量）
                + '          <div data-contrib-range-toggle class="fa-contrib-range-toggle" style="position:absolute;top:10px;right:12px;display:flex;gap:2px;background:rgba(15,23,42,0.85);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:2px;z-index:5;">' + contribRangeBtnHtml() + '</div>'
                + '          <canvas id="Family_countChart" width="560" height="460" style="display:block;box-sizing:border-box;height:460px;width:560px;max-width:100%;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.2));"></canvas>'
                + '          <div class="fa-contrib-tap-hint">轻触柱状图查看共享分布详情</div>'
                // v1.79：隐藏"查看详情"按钮（改为鼠标悬浮柱状图时提示"点击查看详情"）
                + '          <button id="faViewShareDetail" style="display:none;">查看详情</button>'
                + '        </div>'
                + '        <div class="fa-contrib-side" style="flex:1 1 230px;min-width:210px;display:flex;flex-direction:column;gap:10px;">'
                + '          <div data-member-donut style="flex:1;min-height:0;display:flex;flex-direction:column;background:rgba(30,41,59,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 14px;box-shadow:0 4px 24px rgba(0,0,0,0.35);"></div>'
                + '          <div data-halfyear-chart style="flex:1;min-height:0;display:flex;flex-direction:column;background:rgba(30,41,59,0.95);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 14px;box-shadow:0 4px 24px rgba(0,0,0,0.35);"></div>'
                + '        </div>'
                + '      </div>'
                + '      <div class="fa-contrib-footer" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">'
                + '        <div style="font-size:12px;color:#8097a8;">上次扫描：' + timestampToTime(saves.lastupDateTime) + '</div>'
                + '        <div class="fa-contrib-actions" style="display:flex;align-items:center;gap:8px;">'
                // v1.98: 商店页面标记开关 — 仅控制 Steam 商店页面的家庭共享/进包标记，Keylol 始终保持开启
                + '          <label id="fa_toggle_store_marking" class="fa-toggle-switch" title="Steam商店页面游戏标记开关（Keylol页面不受影响）">'
                + '            <input type="checkbox" id="fa_cb_store_marking" ' + (saves.settings.enableStoreMarking ? 'checked' : '') + '>'
                + '            <span class="fa-toggle-slider"></span>'
                + '            <span class="fa-toggle-label">商店标记</span>'
                + '          </label>'
                + '          <button id="btn_export_csv" class="fa-btn-green">导出 CSV</button>'
                + '          <button id="btn_export_json" class="fa-btn-green">导出 JSON</button>'
                + '        </div>'
                + '      </div>'
                + '      </div>'
                // v1.75：我的贡献覆盖层（默认隐藏，点击"查看我的贡献"后显示）
                + '      <div data-my-contrib-overlay style="display:none;"></div>'
                // v1.78：共享分布详情覆盖层（默认隐藏，点击柱状图或"查看详情"按钮后显示）
                + '      <div data-share-detail-overlay style="display:none;"></div>'
                + '    </div>'
                // -- 增长趋势 --
                + '    <div data-fa-tab="growth" style="' + (window[activeTabKey] !== 'growth' ? 'display:none;' : '') + '" class="fa-tab-pane">'
                + '      <div data-growth-content></div>'
                + '    </div>'
                // -- 价值洞察（v1.71 新增，v1.74 移至增长趋势之后） --
                + '    <div data-fa-tab="value" style="' + (window[activeTabKey] !== 'value' ? 'display:none;' : '') + '" class="fa-tab-pane">'
                + '      <div data-value-content></div>'
                + '    </div>'
                // -- 成员洞察（v1.58：移至购买动态之前） --
                + '    <div data-fa-tab="insights" style="' + (window[activeTabKey] !== 'insights' ? 'display:none;' : '') + '" class="fa-tab-pane">'
                + '      <div data-insights-content></div>'
                + '    </div>'
                // -- 购买动态 --
                + '    <div data-fa-tab="activity" style="' + (window[activeTabKey] !== 'activity' ? 'display:none;' : '') + '" class="fa-tab-pane">'
                + '      <div data-activity-content></div>'
                + '    </div>'
                // -- 游玩动态 --
                + '    <div data-fa-tab="playactivity" style="' + (window[activeTabKey] !== 'playactivity' ? 'display:none;' : '') + '" class="fa-tab-pane">'
                + '      <div data-playactivity-content></div>'
                + '    </div>'
                // -- 入库热力图（v1.38 新增） --
                + '    <div data-fa-tab="heatmap" style="' + (window[activeTabKey] !== 'heatmap' ? 'display:none;' : '') + '" class="fa-tab-pane">'
                + '      <div data-heatmap-content></div>'
                + '    </div>'
                // -- 家庭愿望单（v1.41 新增） --
                + '    <div data-fa-tab="wishlist" style="' + (window[activeTabKey] !== 'wishlist' ? 'display:none;' : '') + '" class="fa-tab-pane">'
                + '      <div data-wishlist-content></div>'
                + '    </div>'
                // -- 共享冷却（v1.62 新增） --
                + '    <div data-fa-tab="cooldown" style="' + (window[activeTabKey] !== 'cooldown' ? 'display:none;' : '') + '" class="fa-tab-pane">'
                + '      <div data-cooldown-content></div>'
                + '    </div>'
                + '  </div>'
                // v1.83：游戏详情浮窗容器
                + '  <div class="fa-detail-overlay" id="fa-detail-overlay"></div>'
                + '  <div class="fa-detail-pop" id="fa-detail-pop"></div>'
                + '</div>';

            document.body.appendChild(panel);
            // 注入全局样式（幂等）：fa-spin 动画、fa-tab-pane 标签页容器、fa-card 卡片、fa-btn-green 绿按钮、fa-wl-* 愿望单类
            faInjectGlobalStyle();

            // ===================== 事件绑定 =====================
            // v1.40：统一关闭入口，关闭前销毁 Chart 实例，避免重复打开时 Canvas is already in use 及实例泄漏
            const destroyFaChart = () => {
                if (window.__faChartInstance) {
                    try { window.__faChartInstance.destroy(); } catch(e){console.warn('[FA]', e)}
                    window.__faChartInstance = null;
                }
            };
            const closePanel = () => {
                destroyFaChart();
                // P1-1: 清理搜索/详情浮窗状态，防止内存泄漏和幽灵回调
                try {
                    if (typeof faCloseDetailPopup === 'function') faCloseDetailPopup();
                    if (_faGsDebounceTimer) { clearTimeout(_faGsDebounceTimer); _faGsDebounceTimer = null; }
                    if (_faGsDocMousedownHandler) {
                        document.removeEventListener('mousedown', _faGsDocMousedownHandler, true);
                        _faGsDocMousedownHandler = null;
                    }
                    _faGsInputEl = null; _faGsPopEl = null; _faGsSearchWrap = null; _faGsClearBtn = null;
                    _faGsLastResults = []; _faGsFocusIdx = -1; _faSearchIndexBuilt = false;
                    _faDetailToken++; // 使任何在途的详情请求失效
                } catch (e) { /* ignore cleanup errors */ }
                panel.remove();
            };
            // 关闭浮窗
            document.getElementById('btnClosePanel').addEventListener('click', closePanel);
            document.getElementById('familyAnalysisBackdrop').addEventListener('click', (e) => {
                if (e.target === e.currentTarget) closePanel();
            });
            // 拖动
            const dialogEl = document.getElementById('familyAnalysisDialog');
            const handle = document.getElementById('familyAnalysisDragHandle');
            let isDragging = false, startX, startY, startLeft, startTop;
            handle.addEventListener('mousedown', (e) => {
                if (window.innerWidth <= 600) return;
                // v1.83: 排除搜索框及其子元素（input/button/div），否则 preventDefault 会阻止 input 获取焦点
                if (e.target.closest('button, .fa-global-search, input, .fa-global-search-pop')) return;
                isDragging = true;
                const rect = dialogEl.getBoundingClientRect();
                startX = e.clientX; startY = e.clientY;
                startLeft = rect.left; startTop = rect.top;
                dialogEl.style.position = 'fixed';
                dialogEl.style.left = startLeft + 'px';
                dialogEl.style.top = startTop + 'px';
                dialogEl.style.margin = '0';
                e.preventDefault();
            });
            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                dialogEl.style.left = (startLeft + e.clientX - startX) + 'px';
                dialogEl.style.top = (startTop + e.clientY - startY) + 'px';
            });
            document.addEventListener('mouseup', () => { isDragging = false; });
            // 滚动拦截
            panel.addEventListener('wheel', (e) => {
                const scrollable = e.target.closest('[data-fa-tab]');
                if (scrollable) {
                    const { scrollTop, scrollHeight, clientHeight } = scrollable;
                    const atTop = e.deltaY < 0 && scrollTop <= 0;
                    const atBottom = e.deltaY > 0 && scrollTop + clientHeight >= scrollHeight;
                    if (!atTop && !atBottom) { e.preventDefault(); e.stopPropagation(); scrollable.scrollTop += e.deltaY; }
                }
            }, { passive: false });
            // ESC 关闭
            const escHandler = (e) => { if (e.key === 'Escape') { closePanel(); document.removeEventListener('keydown', escHandler); } };
            document.addEventListener('keydown', escHandler);
            // 标签切换
            panel.querySelectorAll('[data-fa-nav]').forEach(btn => {
                btn.addEventListener('click', () => { showTab(btn.getAttribute('data-fa-nav')); });
            });
            // v1.75：查看我的贡献按钮——点击后覆盖贡献分布默认视图，展示个人贡献 KPI + 最近贡献 + 最近游玩
            var viewMyContribBtn = document.getElementById('faViewMyContrib');
            if (viewMyContribBtn) {
                viewMyContribBtn.addEventListener('click', function() {
                    renderMyContributionOverlay();
                });
            }
            // v1.78：查看共享分布详情按钮——点击后覆盖贡献分布默认视图，展示共享分布详情
            var viewShareDetailBtn = document.getElementById('faViewShareDetail');
            if (viewShareDetailBtn) {
                viewShareDetailBtn.addEventListener('click', function() {
                    shareDetailPage = 1; // v1.79：重置分页
                    renderShareDetailOverlay();
                });
            }
            // v1.77：累计总量/近半年切换——切换后重建贡献分布图（成员位置不变，仅统计范围变化）
            panel.querySelectorAll('button[data-contrib-range]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var m = this.getAttribute('data-contrib-range');
                    if (m === contribRangeMode) return;
                    contribRangeMode = m;
                    panel.querySelectorAll('button[data-contrib-range]').forEach(function(b) {
                        var on = b.getAttribute('data-contrib-range') === m;
                        b.style.background = on ? 'rgba(6,207,190,0.2)' : 'transparent';
                        b.style.color = on ? '#06cfbe' : '#8097a8';
                    });
                    observer_5();
                });
            });

            // ==================== v1.83: 全局游戏搜索（中文/拼音/英文）+ 游戏详情浮窗 ====================
            // 参考 steam-game-library-viewer-2.9.56 的 buildSearchIndex / searchGames / _gsJumpToGame / showGameDetailPopup
            // 适配家庭组数据模型：saves.familyGameList.GameInfo + wlCache.data.GameInfo

            // P1-2: 拼音库实时求值函数——@require 脚本可能因网络延迟晚于主脚本执行，
            // 一次性求值会导致 _faPinyinLib 永久为 null。改为函数每次实时读取。
            function _faGetPinyinLib() {
                return faCompat.resolveGlobal('SGLVPinyin') || null;
            }
            if (!_faGetPinyinLib()) {
                console.warn('[FA] 拼音库 SGLVPinyin 尚未加载，将在搜索时重试');
            }

            // 标点/空格剥离正则（与 sglv-pinyin.lib.js 保持一致）
            var _FA_PUNCT_STRIP_RE = /[\s\-_:：·、，,.\/\\()（）\[\]【】''""]/g;
            var _FA_PUNCT_TEST_RE = /[\s\-_:：·、，,.\/\\()（）\[\]【】''""]/;

            // 搜索索引
            var _faSearchIndex = [];
            var _faSearchIndexByAppid = new Map();
            var _faSearchIndexBuilt = false;

            // 搜索 UI 状态
            var _faGsFocusIdx = -1;
            var _faGsLastResults = [];
            var _faGsInputEl = null;
            var _faGsPopEl = null;
            var _faGsSearchWrap = null;
            var _faGsClearBtn = null;
            var _faDetailEscHandler = null;
            var _faDetailToken = 0;  // P0-2: 详情浮窗请求 token，防竞态
            var _faGsDocMousedownHandler = null;  // P1-3: 保存 mousedown 监听引用，closePanel 时移除

            // 构建搜索索引：家庭库游戏 + 家庭愿望单
            function faBuildSearchIndex() {
                _faSearchIndex.length = 0;
                _faSearchIndexByAppid.clear();
                var familySet = new Set();
                // 1) 家庭库游戏（优先级最高）
                if (saves && saves.familyGameList && saves.familyGameList.GameInfo) {
                    for (var i = 0; i < saves.familyGameList.GameList.length; i++) {
                        var appid = saves.familyGameList.GameList[i];
                        var gi = saves.familyGameList.GameInfo[appid];
                        if (!gi || !gi.name) continue;
                        var aid = Number(appid);
                        if (familySet.has(aid)) continue;
                        familySet.add(aid);
                        _faSearchIndexByAppid.set(aid, {
                            appid: aid, name: gi.name, type: 'family',
                            owned: true, wishlist: false,
                            _gameObj: gi,
                        });
                    }
                }
                // 2) 家庭愿望单
                var wlData = (wlCache && wlCache.data) ? wlCache.data : null;
                if (wlData && wlData.GameList && wlData.GameInfo) {
                    for (var j = 0; j < wlData.GameList.length; j++) {
                        var wAppid = wlData.GameList[j];
                        var wGi = wlData.GameInfo[wAppid];
                        if (!wGi || !wGi.name) continue;
                        var wAid = Number(wAppid);
                        if (familySet.has(wAid)) {
                            var ex = _faSearchIndexByAppid.get(wAid);
                            if (ex) { ex.wishlist = true; }
                            continue;
                        }
                        if (_faSearchIndexByAppid.has(wAid)) continue;
                        _faSearchIndexByAppid.set(wAid, {
                            appid: wAid, name: wGi.name, type: 'wishlist',
                            owned: false, wishlist: true,
                        });
                    }
                }
                // 转数组
                _faSearchIndexByAppid.forEach(function(entry) {
                    entry._scoreBias = entry.owned ? 30 : entry.wishlist ? 20 : 0;
                    _faSearchIndex.push(entry);
                });
                _faSearchIndexBuilt = true;
                console.log('[FA] 全局搜索索引已构建: ' + _faSearchIndex.length + ' 条 (family=' + familySet.size + ')');
            }

            // 搜索：委托 SGLVPinyin.searchByPinyin
            function faSearchGames(query, limit) {
                if (!_faSearchIndexBuilt) faBuildSearchIndex();
                var pinyinLib = _faGetPinyinLib();
                if (!pinyinLib) { console.warn('[FA] 拼音库未加载，搜索不可用'); return []; }
                return pinyinLib.searchByPinyin(query, _faSearchIndex, {
                    limit: limit || 30,
                    getName: function(e) { return e.name; },
                });
            }

            // 高亮匹配片段
            function faHighlightMatch(name, query) {
                if (!name || !query) return faEsc(name || '');
                var escaped = faEsc(name);
                var q = String(query).trim();
                if (!q) return escaped;
                var lowerName = name.toLowerCase();
                var lowerQ = q.toLowerCase();
                var idx = lowerName.indexOf(lowerQ);
                if (idx >= 0) {
                    return faEsc(name.slice(0, idx)) + '<mark>' + faEsc(name.slice(idx, idx + q.length)) + '</mark>' + faEsc(name.slice(idx + q.length));
                }
                var nameNoSpace = lowerName.replace(_FA_PUNCT_STRIP_RE, '');
                var qNoSpace = lowerQ.replace(_FA_PUNCT_STRIP_RE, '');
                var idx2 = nameNoSpace.indexOf(qNoSpace);
                if (idx2 >= 0) {
                    var count = 0, startOrig = -1, endOrig = -1;
                    for (var i = 0; i < name.length; i++) {
                        var c = name[i].toLowerCase();
                        if (!_FA_PUNCT_TEST_RE.test(c)) {
                            if (count === idx2) startOrig = i;
                            if (count === idx2 + qNoSpace.length - 1) { endOrig = i + 1; break; }
                            count++;
                        }
                    }
                    if (startOrig >= 0 && endOrig > startOrig) {
                        return faEsc(name.slice(0, startOrig)) + '<mark>' + faEsc(name.slice(startOrig, endOrig)) + '</mark>' + faEsc(name.slice(endOrig));
                    }
                }
                return escaped;
            }

            // 切换搜索下拉浮层显隐
            function _faGsShowPop(show) {
                if (_faGsPopEl) _faGsPopEl.classList.toggle('show', show);
            }
            function faCloseSearchPop() {
                _faGsShowPop(false);
                _faGsFocusIdx = -1;
            }

            // 获取游戏封面缩略图 URL
            function _faGsGetThumbUrl(appid) {
                if (!appid) return '';
                var id = String(appid);
                // 优先使用已验证可用的 URL
                if (typeof _faCoverGood !== 'undefined' && _faCoverGood.has(id)) return _faCoverGood.get(id);
                // 默认使用 cloudflare CDN capsule_184x69
                return FA_COVER_CF + id + '/capsule_184x69.jpg';
            }

            // 渲染搜索结果下拉
            function faRenderSearchResults(query) {
                if (!_faGsPopEl) return;
                var q = String(query || '').trim();
                if (!q) { _faGsShowPop(false); _faGsLastResults = []; return; }
                var results = faSearchGames(q, 30);
                _faGsLastResults = results;
                _faGsFocusIdx = -1;
                if (results.length === 0) {
                    _faGsPopEl.innerHTML = '<div class="fa-gs-empty">'
                        + '<div class="fa-gs-empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>'
                        + '<span>未找到匹配的游戏</span></div>';
                    _faGsShowPop(true);
                    return;
                }
                var header = '<div class="fa-gs-header"><span>搜索结果</span><span class="fa-gs-header-count">' + results.length + '</span></div>';
                var items = results.map(function(entry, idx) {
                    var typeKey = entry.owned ? 'family' : 'wishlist';
                    var typeText = entry.owned ? '家庭库' : '愿望单';
                    // P2-1: 两个分支文案相同，删除无意义三元
                    var subText = '点击查看详情 · AppID ' + entry.appid;
                    var htmlName = faHighlightMatch(entry.name, q);
                    var capSrc = _faGsGetThumbUrl(entry.appid);
                    // P2-3: onerror 接入 faLoadCover 多 CDN fallback 链，而非直接隐藏
                    var thumbHtml = capSrc ? '<img src="' + faEscAttr(capSrc) + '" alt="" loading="lazy" data-fa-appid="' + entry.appid + '" onerror="if(this.dataset.faCoverTried!==\'1\'){this.dataset.faCoverTried=\'1\';faLoadCover(this,' + entry.appid + ')}else{this.style.display=\'none\'}">' : '';
                    // 家庭共享徽章
                    var sharedBadge = '';
                    if (entry.owned && entry._gameObj && entry._gameObj.owners) {
                        var ownerCount = entry._gameObj.owners.length;
                        if (ownerCount > 1) {
                            sharedBadge = '<span class="fa-gs-item-shared" title="' + faEscAttr(ownerCount + ' 位成员共享') + '">' + ownerCount + '人共享</span>';
                        }
                    }
                    return '<div class="fa-gs-item" data-idx="' + idx + '" data-appid="' + entry.appid + '" data-type="' + typeKey + '">'
                        + '<div class="fa-gs-item-thumb">' + thumbHtml + '</div>'
                        + '<div class="fa-gs-item-body">'
                        + '<div class="fa-gs-item-name">' + htmlName + '</div>'
                        + '<div class="fa-gs-item-sub">' + faEsc(subText) + '</div>'
                        + '</div>'
                        + '<div class="fa-gs-item-right">'
                        + '<span class="fa-gs-item-type ' + typeKey + '">' + typeText + '</span>'
                        + sharedBadge
                        + '</div>'
                        + '</div>';
                }).join('');
                var footer = '<div class="fa-gs-footer">'
                    + '<span class="fa-gs-footer-hint"><kbd>↑</kbd><kbd>↓</kbd> 选择</span>'
                    + '<span class="fa-gs-footer-hint"><kbd>Enter</kbd> 查看</span>'
                    + '<span class="fa-gs-footer-hint"><kbd>Esc</kbd> 关闭</span>'
                    + '</div>';
                _faGsPopEl.innerHTML = header + items + footer;
                _faGsShowPop(true);
                // 绑定每项点击
                _faGsPopEl.querySelectorAll('.fa-gs-item').forEach(function(itemEl) {
                    var idx = Number(itemEl.dataset.idx);
                    itemEl.addEventListener('mouseenter', function() {
                        _faGsFocusIdx = idx;
                        _faGsUpdateFocusClass();
                    });
                    itemEl.addEventListener('click', function(ev) {
                        ev.preventDefault(); ev.stopPropagation();
                        var target = _faGsLastResults[idx];
                        if (target) _faGsJumpToGame(target);
                    });
                });
            }

            // 更新键盘聚焦项高亮
            function _faGsUpdateFocusClass() {
                if (!_faGsPopEl) return;
                var items = _faGsPopEl.querySelectorAll('.fa-gs-item');
                items.forEach(function(el, i) {
                    if (i === _faGsFocusIdx) el.classList.add('focus');
                    else el.classList.remove('focus');
                });
                if (_faGsFocusIdx >= 0 && items[_faGsFocusIdx]) {
                    items[_faGsFocusIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }

            // ==================== v1.83: 游戏详情浮窗 ====================
            function faCloseDetailPopup() {
                var overlay = document.getElementById('fa-detail-overlay');
                var pop = document.getElementById('fa-detail-pop');
                if (overlay) overlay.classList.remove('show');
                if (pop) { pop.classList.remove('show'); pop.innerHTML = ''; }
                if (_faDetailEscHandler) {
                    document.removeEventListener('keydown', _faDetailEscHandler);
                    _faDetailEscHandler = null;
                }
            }

            function _faBindDetailClose(pop) {
                var overlay = document.getElementById('fa-detail-overlay');
                var closeBtn = pop.querySelector('#fa-detail-close-btn');
                if (closeBtn) closeBtn.addEventListener('click', faCloseDetailPopup);
                if (overlay) overlay.onclick = faCloseDetailPopup;
                if (_faDetailEscHandler) document.removeEventListener('keydown', _faDetailEscHandler);
                // P0-1: stopImmediatePropagation 阻止 ESC 冒泡到面板级 escHandler，避免详情浮窗和面板同时关闭
                _faDetailEscHandler = function(e) {
                    if (e.key === 'Escape') {
                        e.stopImmediatePropagation();
                        faCloseDetailPopup();
                    }
                };
                document.addEventListener('keydown', _faDetailEscHandler, true);
            }

            function faShowGameDetailPopup(appid, entry) {
                var overlay = document.getElementById('fa-detail-overlay');
                var pop = document.getElementById('fa-detail-pop');
                if (!overlay || !pop) { console.warn('[FA] 详情浮窗容器未找到'); return; }
                pop.innerHTML = '<button class="fa-detail-close" id="fa-detail-close-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
                    + '<div class="fa-detail-scroll"><div class="fa-detail-loading">'
                    + '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#06cfbe" stroke-width="2" style="animation:fa-spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>'
                    + '<span>正在获取游戏详情…</span></div></div>';
                overlay.classList.add('show');
                pop.classList.add('show');
                _faBindDetailClose(pop);
                _faLoadAndRenderDetail(appid, entry, pop);
            }

            async function _faLoadAndRenderDetail(appid, entry, pop) {
                // P0-2: 请求 token 防竞态——快速连续点击不同搜索结果时，旧请求完成后不覆盖新请求渲染的内容
                var token = ++_faDetailToken;
                var A = faCompat.resolveGlobal('SGLVAppDetail');
                if (!A || typeof A.loadDetail !== 'function') {
                    if (token === _faDetailToken) _faRenderDetailError(pop, appid, entry, 'SGLVAppDetail 库未加载');
                    return;
                }
                try {
                    var d = await A.loadDetail(appid, { useCache: true });
                    if (token !== _faDetailToken) return; // 已被新请求取代，丢弃旧结果
                    if (!d) { _faRenderDetailError(pop, appid, entry, 'API 无数据返回'); return; }
                    _faRenderDetailContent(pop, appid, entry, d);
                } catch (e) {
                    _faRenderDetailError(pop, appid, entry, e.message || String(e));
                }
            }

            function _faRenderDetailError(pop, appid, entry, msg) {
                pop.innerHTML = '<button class="fa-detail-close" id="fa-detail-close-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
                    + '<div class="fa-detail-scroll"><div class="fa-detail-error">'
                    + '<span>加载失败</span>'
                    + '<span style="font-size:10px;color:#6e7681">' + faEsc(msg) + '</span>'
                    + '<button class="fa-detail-btn fa-detail-btn-secondary" id="fa-detail-retry">重试</button>'
                    + '</div></div>';
                _faBindDetailClose(pop);
                var retry = pop.querySelector('#fa-detail-retry');
                if (retry) retry.addEventListener('click', function() { faShowGameDetailPopup(appid, entry); });
            }

            function _faRenderDetailContent(pop, appid, entry, d) {
                var platforms = [];
                if (d.platforms) {
                    if (d.platforms.win) platforms.push('Windows');
                    if (d.platforms.mac) platforms.push('macOS');
                    if (d.platforms.linux) platforms.push('SteamOS+Linux');
                }
                var priceHtml = '';
                if (d.isFree) {
                    priceHtml = '<span class="fa-detail-price-free">免费</span>';
                } else {
                    // v1.92: 修复货币符号 — 优先使用 entry._gameObj 中的用户地区价格(faCurrency.cc 获取),
                    //   其次根据 d.cnPrice.currency 选择正确符号(Steam 可能对登录用户忽略 cc=cn,
                    //   返回用户实际所在地区价格如 INR,但旧代码硬编码 ¥ 导致符号错误)
                    faDetectUserCurrency();
                    var gi = (entry && entry._gameObj) ? entry._gameObj : null;
                    if (gi && Number(gi.finalPrice) > 0) {
                        priceHtml = '<span class="fa-detail-price-val">' + faCurrency.symbol + gi.finalPrice + '</span>';
                        if (gi.discountPct > 0) priceHtml += '<span class="fa-detail-price-discount">-' + gi.discountPct + '%</span>';
                    } else if (d.cnPrice) {
                        var curSym = faCurrencySymbol(d.cnPrice.currency);
                        priceHtml = '<span class="fa-detail-price-val">' + curSym + d.cnPrice.price + '</span>';
                        if (d.cnPrice.discount > 0) priceHtml += '<span class="fa-detail-price-discount">-' + d.cnPrice.discount + '%</span>';
                    }
                }
                var metaHtml = '';
                if (d.metacritic && d.metacritic.score) {
                    var s = d.metacritic.score;
                    var c = s >= 75 ? '#4ade80' : s >= 50 ? '#fbbf24' : '#f87171';
                    metaHtml = '<a class="fa-detail-metacritic" href="' + faEscAttr(d.metacritic.url || '#') + '" target="_blank" rel="noopener" style="background:' + c + '22;color:' + c + ';border:1px solid ' + c + '55">Metacritic ' + s + '</a>';
                }
                var reviewHtml = '';
                if (d.reviews && d.reviews.summary) {
                    reviewHtml = '<div style="font-size:11px;color:#8b949e;margin:6px 0">' + faEsc(d.reviews.summary) + (d.reviews.count ? ' (' + faEsc(d.reviews.count) + ')' : '') + '</div>';
                }
                var genresHtml = (d.genres && d.genres.length)
                    ? '<div class="fa-detail-tags">' + d.genres.map(function(g) { return '<span class="fa-detail-tag">' + faEsc(g) + '</span>'; }).join('') + '</div>' : '';
                var shotsHtml = (d.screenshots && d.screenshots.length)
                    ? '<div class="fa-detail-shots">' + d.screenshots.slice(0, 6).map(function(s) {
                        return '<div class="fa-detail-shot"><img src="' + faEscAttr(s.thumbnail || s.full) + '" alt="" loading="lazy" onerror="this.parentElement.style.display=\'none\'"></div>';
                      }).join('') + '</div>' : '';
                var storeUrl = 'https://store.steampowered.com/app/' + appid;
                var actionsHtml = '<a class="fa-detail-btn fa-detail-btn-primary" href="' + storeUrl + '" target="_blank" rel="noopener">商店页面</a>';
                // 家庭库游戏显示共享者信息
                if (entry && entry.owned && entry._gameObj && entry._gameObj.owners && entry._gameObj.owners.length > 0) {
                    var ownerNames = entry._gameObj.owners.map(function(sid) {
                        return (saves.familyInfo && saves.familyInfo.steamIdtoName && saves.familyInfo.steamIdtoName[sid]) ? saves.familyInfo.steamIdtoName[sid] : sid;
                    }).join('、');
                    // P2-4: 贡献者信息改为 span 展示（无点击交互，避免 button 误导用户）
                    actionsHtml += '<span class="fa-detail-btn fa-detail-btn-secondary" style="cursor:default">贡献者: ' + faEsc(ownerNames) + '</span>';
                }

                pop.innerHTML = '<button class="fa-detail-close" id="fa-detail-close-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'
                    + '<div class="fa-detail-scroll">'
                    + (d.cover ? '<div class="fa-detail-hero"><img src="' + faEscAttr(d.cover) + '" alt="" onerror="this.parentElement.style.display=\'none\'"></div>' : '')
                    + '<div class="fa-detail-body">'
                    + '<div class="fa-detail-name">' + faEsc(d.name || (entry && entry.name) || '') + '</div>'
                    + metaHtml
                    + reviewHtml
                    + (d.shortDesc ? '<div class="fa-detail-desc">' + faEsc(d.shortDesc) + '</div>' : '')
                    + '<dl class="fa-detail-meta">'
                    + (d.developers && d.developers.length ? '<dt>开发商</dt><dd>' + faEsc(d.developers.join(', ')) + '</dd>' : '')
                    + (d.publishers && d.publishers.length ? '<dt>发行商</dt><dd>' + faEsc(d.publishers.join(', ')) + '</dd>' : '')
                    + (d.releaseDate ? '<dt>发售日期</dt><dd>' + faEsc(d.releaseDate) + '</dd>' : '')
                    + (platforms.length ? '<dt>平台</dt><dd>' + faEsc(platforms.join(', ')) + '</dd>' : '')
                    + (priceHtml ? '<dt>价格</dt><dd>' + priceHtml + '</dd>' : '')
                    + '</dl>'
                    + genresHtml
                    + shotsHtml
                    + '<div class="fa-detail-actions">' + actionsHtml + '</div>'
                    + '</div></div>';
                _faBindDetailClose(pop);
            }

            // 跳转游戏核心逻辑：统一弹出游戏详情浮窗
            function _faGsJumpToGame(entry) {
                if (!entry) return;
                faCloseSearchPop();
                if (_faGsInputEl) {
                    _faGsInputEl.value = '';
                    _faGsInputEl.dispatchEvent(new Event('input'));
                }
                faShowGameDetailPopup(entry.appid, entry);
            }

            // 输入防抖
            var _faGsDebounceTimer = null;
            function _faGsDebouncedRender(q) {
                if (_faGsDebounceTimer) clearTimeout(_faGsDebounceTimer);
                _faGsDebounceTimer = setTimeout(function() { faRenderSearchResults(q); }, 150);
            }

            // 绑定全局搜索框事件
            function faBindGlobalSearchEvents() {
                _faGsInputEl = panel.querySelector('#fa-global-search-input');
                _faGsPopEl = panel.querySelector('#fa-global-search-pop');
                _faGsSearchWrap = panel.querySelector('#fa-global-search');
                _faGsClearBtn = panel.querySelector('#fa-global-search-clear');
                if (!_faGsInputEl || !_faGsPopEl) return;
                // 输入事件
                _faGsInputEl.addEventListener('input', function() {
                    var v = _faGsInputEl.value;
                    if (v) _faGsSearchWrap.classList.add('has-text');
                    else _faGsSearchWrap.classList.remove('has-text');
                    if (!v.trim()) {
                        _faGsShowPop(false);
                        _faGsLastResults = [];
                        _faGsFocusIdx = -1;
                        return;
                    }
                    _faGsDebouncedRender(v);
                });
                // 焦点聚焦 → 如有内容则打开下拉
                _faGsInputEl.addEventListener('focus', function() {
                    if (_faGsInputEl.value.trim() && _faGsLastResults.length) _faGsShowPop(true);
                });
                // 键盘事件
                _faGsInputEl.addEventListener('keydown', function(e) {
                    var key = e.key;
                    if (key === 'ArrowDown') {
                        e.preventDefault();
                        if (!_faGsLastResults.length) return;
                        _faGsShowPop(true);
                        _faGsFocusIdx = (_faGsFocusIdx + 1) % _faGsLastResults.length;
                        _faGsUpdateFocusClass();
                    } else if (key === 'ArrowUp') {
                        e.preventDefault();
                        if (!_faGsLastResults.length) return;
                        _faGsShowPop(true);
                        _faGsFocusIdx = _faGsFocusIdx <= 0 ? _faGsLastResults.length - 1 : _faGsFocusIdx - 1;
                        _faGsUpdateFocusClass();
                    } else if (key === 'Enter') {
                        e.preventDefault();
                        if (_faGsFocusIdx >= 0 && _faGsLastResults[_faGsFocusIdx]) {
                            _faGsJumpToGame(_faGsLastResults[_faGsFocusIdx]);
                        } else if (_faGsLastResults.length > 0) {
                            _faGsJumpToGame(_faGsLastResults[0]);
                        }
                    } else if (key === 'Escape') {
                        e.preventDefault();
                        if (_faGsPopEl.classList.contains('show')) {
                            faCloseSearchPop();
                        } else {
                            _faGsInputEl.value = '';
                            _faGsInputEl.dispatchEvent(new Event('input'));
                            _faGsInputEl.blur();
                        }
                    }
                });
                // 清除按钮
                if (_faGsClearBtn) {
                    _faGsClearBtn.addEventListener('click', function(e) {
                        e.preventDefault(); e.stopPropagation();
                        _faGsInputEl.value = '';
                        _faGsInputEl.dispatchEvent(new Event('input'));
                        _faGsInputEl.focus();
                    });
                }
                // 点击外部关闭下拉
                // P1-3: 保存监听器引用，closePanel 时移除，避免多次开关面板后监听器堆积
                _faGsDocMousedownHandler = function(e) {
                    if (!_faGsSearchWrap) return;
                    if (_faGsSearchWrap.contains(e.target)) return;
                    faCloseSearchPop();
                };
                document.addEventListener('mousedown', _faGsDocMousedownHandler, true);
                // 切换 tab 时关闭下拉
                panel.addEventListener('click', function(e) {
                    if (e.target.closest('[data-fa-nav]')) faCloseSearchPop();
                });
            }

            // 注入 SGLVAppDetail 宿主 API
            (function faInjectSGLVAppDetailHost() {
                try {
                    var A = faCompat.resolveGlobal('SGLVAppDetail');
                    if (!A || typeof A.setHostApi !== 'function') return;
                    A.setHostApi({
                        getOwnedGames: function() {
                            var arr = [];
                            if (saves && saves.familyGameList && saves.familyGameList.GameInfo) {
                                saves.familyGameList.GameList.forEach(function(appid) {
                                    var gi = saves.familyGameList.GameInfo[appid];
                                    if (gi) arr.push({ appid: Number(appid), name: gi.name, owners: gi.owners || [] });
                                });
                            }
                            return arr;
                        },
                        isGameOwnedByMe: function(g) {
                            if (!g || !g.owners || !saves.steamid) return false;
                            return g.owners.indexOf(saves.steamid) >= 0;
                        },
                        getGameOwnerNames: function(g) {
                            if (!g || !g.owners) return '';
                            return g.owners.map(function(sid) {
                                return (saves.familyInfo && saves.familyInfo.steamIdtoName && saves.familyInfo.steamIdtoName[sid]) ? saves.familyInfo.steamIdtoName[sid] : sid;
                            }).join(', ');
                        },
                        getActiveSteamId: function() { return saves.steamid || ''; },
                    });
                } catch (e) { /* ignore */ }
            })();

            // 绑定搜索事件 + 预构建索引
            faBindGlobalSearchEvents();
            try { faBuildSearchIndex(); } catch (e) { console.warn('[FA] 搜索索引预构建失败:', e); }

            // 初始化当前标签
            showTab(window[activeTabKey]);
            // 初始化购买动态
            renderActivityPage(1);
            // v1.74：面板打开后预热价值洞察数据（延迟3s后台静默拉取，切到标签页时秒开）
            preheatValueInsightsData();
            // v1.75：面板打开后预热 DLC 数据库 + 应用类型映射（延迟2s双源并发加载）
            preheatDlcData();
            // v1.76：面板打开后预热年度大作(GOTY)数据（延迟2s后台加载，愿望单/共享冷却筛选可用）
            faLoadGotyData(false);

            // ===================== observer_5: Chart.js 图表 =====================
            function observer_5(){
                let ctx = document.getElementById('Family_countChart')
                if(ctx){
                    var ChartCtor = faCompat.resolveGlobal('Chart');
                    ctx.style.display = 'block';
                    if (ctx.parentNode) ctx.parentNode.removeAttribute('data-fa-chart-unavailable');
                    // v1.40 修复：重复打开面板或切换标签回到贡献分布时，同一 canvas 上会残留旧 Chart 实例，
                    // 直接 new Chart 会抛 "Canvas is already in use"，此处先销毁再重建
                    destroyFaChart();
                    if (ChartCtor && typeof ChartCtor.getChart === 'function') {
                        var existingChart = ChartCtor.getChart(ctx);
                        if (existingChart) { try { existingChart.destroy(); } catch(e){console.warn('[FA]', e)} }
                    }
                    // v1.40 修复：observer_5 会被 showTab 与面板初始化重复调用，事件监听只允许绑定一次，
                    // 否则"现在扫描"/导出按钮会重复触发
                    if (!ctx.dataset.faEventsBound) {
                        ctx.dataset.faEventsBound = '1';
                        btn_scan_now.addEventListener('click', () => {
                            scan(true)
                            closePanel()
                        })
                        // Export button handlers
                        let btnExportCSV = document.getElementById('btn_export_csv');
                        let btnExportJSON = document.getElementById('btn_export_json');
                        if(btnExportCSV) btnExportCSV.addEventListener('click', exportCSV);
                        if(btnExportJSON) btnExportJSON.addEventListener('click', exportJSON);
                        // v1.98: 商店标记开关事件
                        let cbStoreMarking = document.getElementById('fa_cb_store_marking');
                        if (cbStoreMarking) {
                            cbStoreMarking.addEventListener('change', function() {
                                saves.settings.enableStoreMarking = this.checked;
                                savestorage();
                                // 提示用户：开关已变更，刷新页面后生效
                                var msg = this.checked ? '商店页面游戏标记已开启' : '商店页面游戏标记已关闭（Keylol 不受影响）';
                                faToast.success(msg);
                            });
                        }
                    }

                    // Color palette
                    let palette = [
                        ['rgba(6,207,190,0.95)', 'rgba(6,207,190,0.45)'],
                        ['rgba(84,160,255,0.90)', 'rgba(84,160,255,0.40)'],
                        ['rgba(255,159,67,0.90)', 'rgba(255,159,67,0.40)'],
                        ['rgba(46,213,115,0.90)', 'rgba(46,213,115,0.40)'],
                        ['rgba(255,107,107,0.90)', 'rgba(255,107,107,0.40)'],
                        ['rgba(162,155,254,0.90)', 'rgba(162,155,254,0.40)'],
                        ['rgba(255,205,86,0.90)', 'rgba(255,205,86,0.40)']
                    ];
                    let borderColors = [
                        '#06cfbe', '#54a0ff', '#ff9f43', '#2ed573',
                        '#ff6b6b', '#a29bfe', '#ffcd56'
                    ];

                    let labels = []
                    let datasets = []
                    let membermap = {}
                    let i = 0
                    let maxOwners = Math.min(saves.familyInfo.family_member.length, MAX_FAMILY);
                    saves.familyInfo.family_member.slice(0, MAX_FAMILY).forEach((member) => {
                        labels.push(member.userName)
                        membermap[member.steamid] = i
                        let ci = maxOwners - i - 1;
                        datasets.push({
                            // v1.47：图例精简（N人共同贡献 → N人贡献，单独贡献 → 1人贡献）
                            label: `${maxOwners - i}人贡献`,
                            data: [],
                            borderWidth: 1.5,
                            backgroundColor: palette[ci % palette.length][0],
                            borderColor: borderColors[ci % borderColors.length],
                            borderRadius: 5,
                            borderSkipped: false,
                            hoverBorderWidth: 2,
                            hoverBorderColor: '#ffffff',
                            // v1.47：限制最大柱宽，避免柱子过宽显扁平
                            maxBarThickness: 56,
                        })
                        // v1.47：数据位固定为 MAX_FAMILY（6），为待加入成员预留位置（补 0）
                        for (let k = 0; k < MAX_FAMILY; k++) datasets[i].data.push(0)
                        if(i == maxOwners - 1){
                            datasets[i].label = "1人贡献"
                        }
                        i++
                    })
                    // v1.47：x 轴预留待加入成员位置（如当前 4 人则补 2 个占位）
                    for (let k = maxOwners; k < MAX_FAMILY; k++) labels.push('待加入')

                    // v1.77：统计范围——近半年模式仅统计入库时间(time)在近 6 个月内的游戏，成员位置与堆叠档位保持不变
                    let rangeTotal = 0;
                    const halfYearCutoff = (function(){ const d = new Date(); d.setMonth(d.getMonth() - 6); return Math.floor(d.getTime() / 1000); })();
                    for (let key in saves.familyGameList.GameInfo){
                        let game = saves.familyGameList.GameInfo[key]
                        if (contribRangeMode === 'halfyear' && (!(game.time > 0) || game.time < halfYearCutoff)) continue;
                        rangeTotal++;
                        game.owners.forEach((owner) => {
                            if(membermap[owner] !== undefined) {
                                // 注意：数据集索引基于 datasets.length（实际成员数档位数），而非 labels.length（已含占位）
                                datasets[datasets.length - game.owners.length].data[membermap[owner]] += 1
                            }
                        })
                    }

                    // 创建渐变填充
                    let gradCtx = ctx.getContext('2d');
                    datasets.forEach((ds, idx) => {
                        let ci = maxOwners - idx - 1;
                        if (ci < 0) ci = 0;
                        let grad = gradCtx.createLinearGradient(0, 0, 0, ctx.height);
                        grad.addColorStop(0, palette[ci % palette.length][0]);
                        grad.addColorStop(1, palette[ci % palette.length][1]);
                        ds.backgroundColor = grad;
                    });

                    // 创建图表（隐藏默认图例）
                    // v1.78：点击柱状图任意柱条可打开共享分布详情覆盖层
                    // v1.97：加 Chart.js 守卫 — @require 的 chart.js 若在油猴 beta 版加载失败或
                    //   时序延迟，直接 new Chart 会抛 ReferenceError 中断 observer_5，导致贡献分布
                    //   默认视图渲染失败、"我的贡献"覆盖层无法打开。此处提前判断并安全降级。
                    if (!ChartCtor) {
                        console.warn('[FA] Chart.js 未加载，贡献分布图暂不可用');
                        ctx.style.display = 'none';
                        if (ctx.parentNode) ctx.parentNode.setAttribute('data-fa-chart-unavailable', 'Chart.js 未加载，请检查 Stay 的 @require 下载状态后刷新页面。');
                        return;
                    }
                    let chartInstance = new ChartCtor(ctx, {
                        type: 'bar',
                        data: { labels: labels, datasets: datasets },
                        options: {
                            animation: { duration: 800, easing: 'easeOutQuart' },
                            // v1.78：点击柱状图触发共享分布详情
                            onClick: function(evt, elements) {
                                if (elements && elements.length > 0) {
                                    shareDetailPage = 1; // v1.79：重置分页
                                    renderShareDetailOverlay();
                                }
                            },
                            onHover: (evt, elements) => {
                                evt.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
                            },
                            layout: { padding: { top: 8 } },
                            plugins: {
                                legend: { display: false },
                                title: {
                                    display: true,
                                    // v1.79：近半年模式不再在标题追加范围标识（切换按钮已表明统计范围）
                                    text: '家庭库贡献分布图',
                                    color: '#c7d5e0',
                                    font: { size: 15, weight: '600', family: "'Motiva Sans',Arial,sans-serif" },
                                    padding: { bottom: 18 }
                                },
                                tooltip: {
                                    backgroundColor: 'rgba(15,23,42,0.96)',
                                    titleColor: '#06cfbe',
                                    bodyColor: '#c7d5e0',
                                    borderColor: 'rgba(6,207,190,0.25)',
                                    borderWidth: 1,
                                    padding: 12,
                                    cornerRadius: 8,
                                    titleFont: { weight: 'bold', size: 13 },
                                    bodyFont: { size: 12 },
                                    // v1.79：tooltip 底部增加"点击查看详情"提示
                                    footerColor: '#06cfbe',
                                    footerFont: { size: 11, weight: 'normal' },
                                    footerSpacing: 6,
                                    callbacks: {
                                        label: function(ctx) {
                                            return ' ' + ctx.dataset.label + ': ' + ctx.raw + ' 个游戏';
                                        },
                                        footer: function() {
                                            return '点击查看详情';
                                        }
                                    }
                                }
                            },
                            responsive: true,
                            maintainAspectRatio: true,
                            interaction: { mode: 'index', intersect: false },
                            scales: {
                                x: {
                                    stacked: true,
                                    // v1.47：待加入占位成员标签置灰，与真实成员区分
                                    ticks: { color: function(c) { return c.index >= maxOwners ? '#475569' : '#8a9ba8'; }, font: { size: 11, weight: '500' }, padding: 6 },
                                    grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false }
                                },
                                y: {
                                    beginAtZero: true,
                                    stacked: true,
                                    ticks: {
                                        color: '#8a9ba8',
                                        font: { size: 11 },
                                        callback: function(v) { return v + ' 个' },
                                        padding: 8,
                                        stepSize: Math.max(1, Math.ceil(Math.max(rangeTotal, 1) / 8))
                                    },
                                    grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false }
                                }
                            }
                        },
                        plugins: [{
                            id: 'barShadow',
                            afterDatasetsDraw: function(chart) {
                                let ctx2 = chart.ctx;
                                ctx2.save();
                                ctx2.globalCompositeOperation = 'destination-over';
                                chart.data.datasets.forEach((_ds, di) => {
                                    let meta = chart.getDatasetMeta(di);
                                    if (!meta || !meta.data) return;
                                    meta.data.forEach((bar) => {
                                        let x = bar.x, y = bar.y, w = bar.width;
                                        let base = bar.base;
                                        if (base === undefined || bar.hidden) return;
                                        ctx2.fillStyle = 'rgba(0,0,0,0.12)';
                                        ctx2.beginPath();
                                        ctx2.moveTo(x - w/2, (y + base) / 2 + 2);
                                        ctx2.lineTo(x + w/2, (y + base) / 2 + 2);
                                        ctx2.lineTo(x + w/2, base);
                                        ctx2.lineTo(x - w/2, base);
                                        ctx2.closePath();
                                        ctx2.fill();
                                    });
                                });
                                ctx2.restore();
                            }
                        }]
                    });

                    // v1.40：保存实例引用，供关闭面板/重建前销毁
                    window.__faChartInstance = chartInstance;

                    // ===================== 自定义 HTML 图例 =====================
                    let chartContainer = ctx.parentElement;
                    let oldLegend = chartContainer.querySelector('#customChartLegend');
                    if (oldLegend) oldLegend.remove();
                    let legendHtml = '<div id="customChartLegend" style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px;margin-top:14px;padding:12px 16px;'
                        + 'background:linear-gradient(135deg,rgba(6,207,190,0.06) 0%,rgba(84,160,255,0.04) 50%,rgba(255,159,67,0.06) 100%);'
                        + 'border:1px solid rgba(255,255,255,0.06);border-radius:10px;">';
                    datasets.forEach((ds, idx) => {
                        let ci = maxOwners - idx - 1;
                        if (ci < 0) ci = 0;
                        let solidColor = borderColors[ci % borderColors.length];
                        legendHtml += '<span style="display:flex;align-items:center;gap:7px;font-size:12px;color:#94a3b8;cursor:default;transition:color 0.2s;" '
                            + 'onmouseover="this.style.color=\'#e2e8f0\'" onmouseout="this.style.color=\'#94a3b8\'">'
                            + '<span style="width:14px;height:14px;border-radius:8px;background:' + solidColor + ';flex-shrink:0;box-shadow:0 0 6px ' + solidColor + '40;"></span>'
                            + '<span>' + ds.label + ': <b style="color:#c7d5e0">' + ds.data.reduce((a, b) => a + b, 0) + '</b></span></span>';
                    });
                    legendHtml += '</div>';
                    chartContainer.insertAdjacentHTML('beforeend', legendHtml);

                }else{
                    setTimeout(observer_5, 200)
                }
            }

            // ===================== escapeCSV / exportCSV / exportJSON =====================
            function escapeCSV(str) {
                if (str == null) return '';
                str = String(str);
                if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                    return '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
            }

            function exportCSV() {
                let now = new Date();
                let dateStr = now.getFullYear() + ('0'+(now.getMonth()+1)).slice(-2) + ('0'+now.getDate()).slice(-2);
                let filename = 'steam-family-' + familyGroupId + '-' + dateStr + '.csv';
                let csvRows = [];
                csvRows.push('# Steam家庭库游戏数据');
                csvRows.push('# 家庭组: ' + escapeCSV(familyName) + ' (ID: ' + familyGroupId + ')');
                csvRows.push('# 成员数: ' + memberCount + ' | 游戏总数: ' + totalGames + ' | 独占贡献: ' + singleOwnerCount + ' | 人均: ' + avgGames);
                csvRows.push('# 导出时间: ' + timestampToTime(Math.floor(Date.now()/1000)));
                csvRows.push('# 上次扫描: ' + timestampToTime(saves.lastupDateTime));
                csvRows.push('');
                csvRows.push(['游戏名称', 'AppID', '购入时间', '购买者', '拥有者数', '拥有者名单'].map(escapeCSV).join(','));
                saves.familyGameList.GameList.forEach(appid => {
                    let g = saves.familyGameList.GameInfo[appid];
                    let lastOwner = saves.familyInfo.steamIdtoName[g.owners.at(-1)] || '';
                    let ownerList = g.owners.map(sid => saves.familyInfo.steamIdtoName[sid] || sid).join('; ');
                    csvRows.push([
                        g.name,
                        appid,
                        timestampToTime(g.time),
                        lastOwner,
                        g.owners.length,
                        ownerList
                    ].map(escapeCSV).join(','));
                });
                let bom = '\uFEFF';
                let blob = new Blob([bom + csvRows.join('\n')], {type: 'text/csv;charset=utf-8;'});
                let url = URL.createObjectURL(blob);
                let a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                faToast.success('CSV 导出成功');
            }

            function exportJSON() {
                let now = new Date();
                let dateStr = now.getFullYear() + ('0'+(now.getMonth()+1)).slice(-2) + ('0'+now.getDate()).slice(-2);
                let filename = 'steam-family-' + familyGroupId + '-' + dateStr + '.json';
                let exportData = {
                    export_time: timestampToTime(Math.floor(Date.now()/1000)),
                    family_groupid: familyGroupId,
                    family_name: familyName,
                    member_count: memberCount,
                    total_games: totalGames,
                    single_owner_count: singleOwnerCount,
                    avg_games_per_member: avgGames,
                    last_scan_time: timestampToTime(saves.lastupDateTime),
                    family_members: saves.familyInfo.family_member.map(m => ({steamid: m.steamid, userName: m.userName})),
                    games: saves.familyGameList.GameList.map(appid => ({
                        appid: appid,
                        name: saves.familyGameList.GameInfo[appid].name,
                        owners: saves.familyGameList.GameInfo[appid].owners.map(sid => saves.familyInfo.steamIdtoName[sid] || sid),
                        owner_steamids: saves.familyGameList.GameInfo[appid].owners,
                        time_acquired: saves.familyGameList.GameInfo[appid].time,
                        time_readable: timestampToTime(saves.familyGameList.GameInfo[appid].time),
                        icon_hash: saves.familyGameList.GameInfo[appid].icon_hash
                    }))
                };
                let blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
                let url = URL.createObjectURL(blob);
                let a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                faToast.success('JSON 导出成功');
            }

            // ===================== 动态加载自动更新 =====================
            observer_5();
            const refreshObserver = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        if (document.getElementById('familyAnalysisPanel')) {
                            const el = mutation.addedNodes[0];
                            if (el.nodeType === 1 && (el.closest && el.closest('.family_updater'))) {
                                renderActivityPage(currentPage);
                                if (window[activeTabKey] === 'growth') renderGrowthTab();
                                if (window[activeTabKey] === 'heatmap') renderHeatmapTab();
                                if (window[activeTabKey] === 'insights') renderMemberInsightsTab();
                            }
                        }
                    }
                }
            });
            refreshObserver.observe(document.body, { childList: true, subtree: true });
        }
    }
    function observer_6(retry){
        retry = retry || 0;
        let block = document.getElementById('wishlist_ctn')
        if(block){
            let lists = block.querySelectorAll("div.wishlist_row")
            lists.forEach(function(bar){
                addflag(bar)
            })
        }else if(retry < 50){
            // v1.90: 限制重试次数(50次=10秒),新版 React 布局无 wishlist_ctn,由 _faScanNewWishlist 处理
            setTimeout(function(){ observer_6(retry + 1); }, 200)
        }
    }

    function observer_4(){
        let block = document.getElementById('search_result_container')
        if(block){
            let lists = block.querySelectorAll("a.search_result_row.ds_collapse_flag")
            lists.forEach(function(bar){
                addflag(bar,"clear: left;")
            })

        }else{
            setTimeout(observer_4,200)
        }

    }
    function observer_3(){
        let block = document.querySelector('div.home_tabs_content')
        if(block){
            let lists = block.querySelectorAll("a.tab_item")
            lists.forEach(function(bar){
                addflag(bar,"clear: both;")
            })

            block = document.querySelector('div.carousel_container.maincap')
            lists = block.querySelectorAll("a.store_main_capsule")
            lists.forEach(function(bar){
                addflag(bar)
            })

            block = document.querySelector('div.carousel_container.spotlight')
            lists = block.querySelectorAll("div.home_area_spotlight")
            lists.forEach(function(bar){
                addflag(bar)
            })
            lists = block.querySelectorAll("a.store_capsule")
            lists.forEach(function(bar){
                addflag(bar)
            })


            block = document.getElementById('module_deep_dive')
            lists = block.querySelectorAll("a.store_capsule")
            lists.forEach(function(bar){
                addflag(bar)
            })

            block = document.getElementById('module_recommender')
            lists = block.querySelectorAll("a.store_capsule")
            lists.forEach(function(bar){
                addflag(bar)
            })


            block = document.getElementById('recommended_creators_carousel')
            lists = block.querySelectorAll("a.store_capsule")
            lists.forEach(function(bar){
                addflag(bar)
            })

            block = document.querySelector('div.specials_under10_content')
            lists = block.querySelectorAll("a.store_capsule")
            lists.forEach(function(bar){
                addflag(bar)
            })

            block = document.querySelector('div.marketingmessage_area')
            lists = block.querySelectorAll("a.home_marketing_message")
            lists.forEach(function(bar){
                addflag(bar)
            })

        }else{
            setTimeout(observer_3,200)
        }
    }

    // v1.53：发行商/开发商/系列/相似推荐页初始扫描（React 异步渲染，2s 后兜底重扫一次，
    // 后续新增/懒加载卡片由 MutationObserver 接管；addflag 内部有防重复检测）
    // v1.55：增加 1s/3s/5s 多次重扫以覆盖懒加载，选择器追加 a.tab_item[data-ds-appid]
    function observer_capsule_pages(){
        const capsuleSelector = 'a.store_capsule[data-ds-appid], a.similar_grid_capsule[data-ds-appid], a.tab_item[data-ds-appid]';
        function scan(){
            document.body.querySelectorAll(capsuleSelector).forEach(function(bar){
                addflag(bar);
            });
        }
        scan();
        setTimeout(scan, 1000);
        setTimeout(scan, 3000);
        setTimeout(scan, 5000);
    }

    function observer_2(){
        let block = document.querySelector('div.queue_and_playtime')
        if(block){
            appid = Number(url.split('/')[2])
            if(saves.familyGameList.GameList.includes(appid)){
                addBanner(block,appid)
            }
        }else{
            setTimeout(observer_2,200)
        }
    }
    // v1.59：统一 appId 提取函数（参考 Steam-PSPlus-mark.js 的 appIdFromNode 设计）
    // 优先从 data-ds-appid / data-app-id 属性获取，回退到 href URL 解析 /app/{appid}
    // 解决部分列表标签（如 home_marketing_message、部分 capsule）仅有 URL 无 data-ds-appid 导致匹配不到的问题
    function getAppIdFromNode(node) {
        if (!node || !node.getAttribute) return null;
        // 1. data-ds-appid（支持逗号分隔的捆绑包，取首个）
        var ds = node.getAttribute('data-ds-appid');
        if (ds) return ds.split(',')[0].trim();
        // 2. data-app-id
        var dai = node.getAttribute('data-app-id');
        if (dai) return dai.split(',')[0].trim();
        // 3. 从 href 解析 /app/{appid}（参考 PS Plus appIdFromNode 回退逻辑）
        var href = node.href || node.getAttribute('href') || '';
        var m = /\/app\/(\d+)/.exec(href);
        return m ? m[1] : null;
    }
    // v1.50：家庭共享标记图标（紫色三人家庭组 SVG 图标，白色三头一身剪影）
    const FAMILY_SHARE_FLAG_ICON = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Ccircle cx='12' cy='6.6' r='3.4'/%3E%3Ccircle cx='4.6' cy='9.2' r='2.6'/%3E%3Ccircle cx='19.4' cy='9.2' r='2.6'/%3E%3Cpath d='M3 22.5c0-5 4-8.6 9-8.6s9 3.6 9 8.6v.5H3z'/%3E%3C/svg%3E";
    // v1.92: 检测横版游戏条目 — 捆绑包/搜索结果/愿望单/标签页等宽条目布局
    // 这类条目宽远大于高,Steam 原生 .ds_flag 的 width:100% 会使家庭共享标记横跨整行,
    // 造成大面积紫色横幅。需改用紧凑图标徽章(.fa-fs-compact)定位在封面左上角。
    // v1.93: 修复标准 capsule 小矩形卡片(184x69/231x87 等,宽高比>2.5)被误判为横版条目
    //   的问题。增加 capsule 类名排除 + 最小宽度阈值(>500px),确保只有真正的全宽横版条目
    //   才使用紧凑徽章。标准 capsule 卡片继续使用右上角文字旗帜(right:0;top:0)。
    function isHorizontalGameEntry(node) {
        if (!node) return false;
        // 1. 类名检测:已知的横版条目类型
        if (node.classList) {
            if (node.classList.contains('tab_item')
                || node.classList.contains('search_result_row')
                || node.classList.contains('wishlist_row')
                || node.classList.contains('bundle_package_item')) {
                return true;
            }
            // v1.93: 排除标准 capsule 卡片类型 — 这些是封面网格卡片,不是横版条目
            //   store_capsule: 商店首页/分类页/推荐页等 capsule 网格
            //   store_main_capsule: 首页主轮播 capsule
            //   similar_grid_capsule: 相似推荐网格
            //   ds_collapse_flag: 带 Steam 折叠标记的通用 capsule(含搜索结果行,但搜索行已由上方规则1匹配)
            //   home_marketing_message: 首页营销消息卡片
            if (node.classList.contains('store_capsule')
                || node.classList.contains('store_main_capsule')
                || node.classList.contains('similar_grid_capsule')
                || node.classList.contains('home_marketing_message')) {
                return false;
            }
        }
        // 2. 捆绑包页面内的游戏条目(URL 含 /bundle/)
        if (url.indexOf('/bundle/') !== -1) {
            return true;
        }
        // 3. 宽高比检测:宽度明显大于高度(横版布局),覆盖未知类型的宽条目
        // v1.93: 增加最小宽度阈值(>500px),避免将标准 capsule 卡片(184~352px宽)
        //   误判为横版条目。真正的横版条目(tab_item/search_result_row/wishlist_row)
        //   宽度通常>600px,capsule 卡片宽度通常<400px。
        try {
            var rect = node.getBoundingClientRect();
            if (rect.width > 500 && rect.height > 0 && rect.width > rect.height * 2.5) {
                return true;
            }
        } catch(e) {}
        return false;
    }
    function addflag(node,insertBeforeStyle){
        // v1.98: 商店标记开关 — 关闭时跳过所有 Steam 商店页面标记（家庭共享/进包标记），Keylol 不受影响
        if (saves.settings.enableStoreMarking === false) return;
        // v1.59：防止 null 节点崩溃（category 页 querySelector('a') 可能返回 null）
        if(!node || !node.querySelector) return;
        // v1.65：排除家庭分析浮窗内的元素 — 浮窗自身的游戏封面不需要 Steam 原生共享标记
        // （"家庭共享"/"在家庭库中"旗帜仅用于 Steam 原生页面游戏卡片匹配）
        if(node.closest && node.closest('#familyAnalysisPanel')) return;
        // v1.67：额外排除浮窗内活动视图的元素（按 class/属性特征识别，覆盖节点在回调时尚未挂载到 panel 的边缘情况）
        if(node.closest && (
            node.closest('.fa-act-cover-grid')
            || node.closest('.fa-act-cover-card')
            || node.closest('.fa-act-cover-name')
            || node.closest('[data-activity-content]')
            || node.closest('[data-fa-tab="activity"]')
            || node.closest('[data-fa-tab="value"]')
            || node.closest('[data-value-content]')
        )) return;
        // v1.81: 排除游戏详情页大标题详情展示区 — Steam 自己在 appHubAppName 旁边会显示
        //   紫色"家庭共享"原生标志(无需脚本再添加),且大标题区不应被脚本标记打扰
        if(node.closest && (
            node.closest('#appHubAppName')
            || node.closest('.apphub_AppName')
            || node.closest('.apphub_HomeHeaderContent')
            || node.closest('.apphub_HeaderStandardLeft')
            || node.closest('.game_title_holder')
            || node.closest('.game_area_purchase_game')
        )) return;
        // v1.68：排除 steam-game-library-viewer 浮窗
        // 个人信息面板（#sgis-panel，含最近游玩/个人入库/相似推荐等）以及游戏库侧边栏（.sglv-panel），
        // 它们的游戏卡片已由各自脚本负责标记，不需要本脚本再追加 Steam 原生"在家庭库中"旗帜
        if(node.closest && (node.closest('#sgis-panel') || node.closest('.sglv-panel'))) return;
        // v1.94: 排除操作按钮栏内的元素 — "访问产品页面"/"添加至愿望单"/"忽略"/"寻找更多类似产品"
        // 等按钮可能通过 href(/app/{appid}) 被 getAppIdFromNode 识别为游戏卡片,但它们是操作按钮,
        // 不应在按钮上或旁边添加家庭共享/进包标记
        if(node.closest && node.closest('.single_buttonbar')) return;
        // v1.95: 跳过纯文字推荐容器 — "因为您想要 xxx"/"因为您最近玩过 xxx"等推荐理由文字容器
        //   这类容器有 data-ds-appid 但不含图片,标记会被绝对定位在文字右上角,覆盖游戏名称链接。
        //   检测条件: 节点自身不含图片元素(img/.store_capsule/canvas) 且包含推荐理由文字容器
        if(node.querySelector){
            var _hasImgs = node.querySelector('img, .store_capsule, .ds_capsule, canvas');
            if(!_hasImgs){
                var _reasonEl = node.querySelector('.recommendation_reason, .recommendation_reason_text, .recommendation, .recommendation_app');
                if(_reasonEl || (node.classList && (node.classList.contains('recommendation_reason') || node.classList.contains('recommendation_reason_text') || node.classList.contains('recommendation')))){
                    return; // 纯文字推荐容器,跳过
                }
            }
        }
        // v1.50：同时检测家庭共享旗帜，防止重复标记
        if(node.querySelector("div.ds_owned_flag, div.ds_family_share_flag")) return;
        // v1.59：category 页特殊处理 — 已有 CapsuleDecorators 装饰器则跳过
        if(url.startsWith('store.steampowered.com/category/')){
            if(node.querySelector("div.CapsuleDecorators")&&node.querySelector("div.CapsuleDecorators").childElementCount>0) return;
        }
        // v1.59：统一使用 getAppIdFromNode 提取 appId（参考 Steam-PSPlus-mark.js appIdFromNode）
        // 替代旧的 data-ds-appid + category href 解析分支，修复仅有 URL 无属性的游戏卡片匹配不到的问题
        let thisappid = getAppIdFromNode(node);
        if(!thisappid) return;
        // v1.94: 防止推荐卡片内子元素(按钮链接等)被重复添加标记
        // 推荐卡片等复杂卡片结构中,卡片本身和内部链接(如"访问产品页面"按钮)可能都有
        // data-ds-appid,导致按钮上出现多余的紫色标记图标和进包标记,造成按钮变形。
        // 检查祖先元素(最多5层)是否有相同的 data-ds-appid,如有则跳过(父卡片已处理)。
        var _firstAppid = thisappid.split(',')[0].trim();
        var _ancestor = node.parentElement;
        var _depth = 0;
        while (_ancestor && _depth < 5) {
            var _ancestorDs = _ancestor.getAttribute && _ancestor.getAttribute('data-ds-appid');
            if (_ancestorDs && _ancestorDs.split(',')[0].trim() === _firstAppid) {
                return; // 祖先元素已有相同 appid,跳过子元素标记
            }
            _ancestor = _ancestor.parentElement;
            _depth++;
        }
        // v1.55：处理逗号分隔的 data-ds-appid（捆绑包含多个 appid），取首个在家庭库中的 appid
        let appidCandidates = thisappid.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
        let matchedAppid = appidCandidates.find(id => saves.familyGameList.GameList.includes(id));
        // v1.94: 标记宿主元素(默认为 node)。推荐卡片含操作按钮栏(.single_buttonbar)时,
        // 改为媒体区域(.home_content 非 .single_buttonbar),避免标记出现在按钮旁边
        var flagHost = node;
        if(matchedAppid){
            thisappid = matchedAppid;
            let thisurl = node.getAttribute('href');
            if(thisurl && thisurl.startsWith('/app/')){
                node.classList.add('ds_owned');
            }
            node.classList.add('ds_flagged');
            node.classList.remove('ds_wishlist')
            // v1.95: 推荐卡片含操作按钮栏时,将标记宿主改为封面图区域(含图片的 .home_content)
            // v1.94 旧逻辑选择第一个非 .single_buttonbar 的 .home_content,可能选中推荐文字容器
            //   ("因为您想要 xxx"),导致标记覆盖游戏名称。
            // v1.95 新逻辑: 优先选择包含图片元素的 .home_content;其次选择不含推荐理由文字的;
            //   最后回退到 a.store_capsule 的父元素;均无合适目标则回退到 node 本身。
            var _btnBar = node.querySelector && node.querySelector('.single_buttonbar');
            if (_btnBar) {
                var _mediaAreas = node.querySelectorAll('.home_content');
                var _bestHost = null;
                var _fallbackHost = null;
                for (var _mi = 0; _mi < _mediaAreas.length; _mi++) {
                    var _area = _mediaAreas[_mi];
                    if (_area.classList.contains('single_buttonbar')) continue;
                    // v1.95: 优先选择包含图片元素的 .home_content(封面图区域)
                    if (_area.querySelector('img, .store_capsule, .ds_capsule, canvas')) {
                        _bestHost = _area;
                        break;
                    }
                    // v1.95: 跳过包含推荐理由文字的 .home_content
                    if (_area.querySelector('.recommendation_reason, .recommendation_reason_text, .recommendation, .recommendation_app')) {
                        continue;
                    }
                    // 备选: 第一个非按钮栏且非推荐文字的 .home_content
                    if (!_fallbackHost) _fallbackHost = _area;
                }
                // v1.95: 无 .home_content 含图片时,尝试 a.store_capsule 父元素作为回退
                if (!_bestHost && !_fallbackHost) {
                    var _cap = node.querySelector('a.store_capsule, .store_capsule');
                    if (_cap && _cap.parentElement) {
                        _fallbackHost = _cap.parentElement;
                    }
                }
                flagHost = _bestHost || _fallbackHost || node;
                if (flagHost !== node) {
                    flagHost.classList.add('ds_flagged');
                }
            }
            // v1.95: 无 .single_buttonbar 但含推荐理由文字的卡片(如简化推荐卡片),
            //   也将标记宿主重定向到封面图区域,避免标记覆盖"因为您想要 xxx"等文字
            if (!_btnBar && flagHost === node) {
                var _reasonInNode = node.querySelector && node.querySelector('.recommendation_reason, .recommendation_reason_text, .recommendation, .recommendation_app');
                if (_reasonInNode) {
                    // 查找含图片的子容器作为标记宿主
                    var _imgHost = node.querySelector('.home_content:not(.single_buttonbar)');
                    while (_imgHost) {
                        if (_imgHost.querySelector('img, .store_capsule, .ds_capsule, canvas')) break;
                        _imgHost = _imgHost.nextElementSibling;
                        if (_imgHost && !_imgHost.classList.contains('home_content')) _imgHost = null;
                    }
                    if (!_imgHost) {
                        var _cap2 = node.querySelector('a.store_capsule, .store_capsule');
                        if (_cap2) _imgHost = _cap2.parentElement !== node ? _cap2.parentElement : _cap2;
                    }
                    if (_imgHost) {
                        flagHost = _imgHost;
                        flagHost.classList.add('ds_flagged');
                    }
                }
            }
            // v1.50：购买人不包含自己 → 认定为家庭共享，使用紫色家庭组图标旗帜
            const thisGameInfo = saves.familyGameList.GameInfo[Number(thisappid)];
            const isFamilyShare = thisGameInfo && Array.isArray(thisGameInfo.owners) && thisGameInfo.owners.length > 0 && !thisGameInfo.owners.includes(saves.steamid);
            var flag = document.createElement('div');
            // v1.92: 横版条目使用紧凑图标徽章,避免全宽横幅覆盖游戏条目内容
            var isHorizEntry = isHorizontalGameEntry(node);
            if(isFamilyShare){
                if(isHorizEntry){
                    // v1.92: 横版条目(捆绑包/搜索/愿望单/标签页)— 仅图标,无文字,左上角 20×20px
                    flag.className = "ds_flag ds_family_share_flag fa-fs-compact"
                    flag.innerHTML = ''
                    flag.title = '家庭共享：由 ' + thisGameInfo.owners.map(function(sid){ return saves.familyInfo.steamIdtoName[sid] || sid }).join('、') + ' 共享'
                    flag.style = "background:url(\"" + FAMILY_SHARE_FLAG_ICON + "\") no-repeat center / 12px 12px #7c3aed"
                }else{
                    flag.className = "ds_flag ds_family_share_flag"
                    flag.innerHTML = '家庭共享&nbsp;&nbsp;'
                    flag.title = '家庭共享：由 ' + thisGameInfo.owners.map(function(sid){ return saves.familyInfo.steamIdtoName[sid] || sid }).join('、') + ' 共享'
                    flag.style = "background:url(\"" + FAMILY_SHARE_FLAG_ICON + "\") no-repeat 4px 3px / 11px 11px #7c3aed;color:#fff;font-weight:bold"
                }
            }else{
                flag.className = "ds_flag ds_owned_flag"
                flag.innerHTML = '在家庭库中&nbsp;&nbsp;'
            flag.style = "background:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAKCAYAAABi8KSDAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OUNDNzBFNTUyMUM0MTFFNDk1REVFODRBNUU5RjA2MUYiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OUNDNzBFNTYyMUM0MTFFNDk1REVFODRBNUU5RjA2MUYiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo5Q0M3MEU1MzIxQzQxMUU0OTVERUU4NEE1RTlGMDYxRiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo5Q0M3MEU1NDIxQzQxMUU0OTVERUU4NEE1RTlGMDYxRiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pv3vUKAAAAAlSURBVHjaYvz//z8DsYARpFhISAivjnfv3jGSp3jUGeQ4AyDAADZHNe2nyOBrAAAAAElFTkSuQmCC') no-repeat 4px 4px #06cfbe"
            }
            // v1.54：Steam 搜索结果行新结构已移除 style="clear: left;" 锚点（旧逻辑 querySelector
            // 返回 null 导致 .nextSibling 抛 TypeError，旗帜创建失败且中断整页 forEach 标记）。
            // 插入点三级降级：旧锚点 → div.ds_options 之前（与原生 ds_owned_flag 位置一致）→ 末尾追加
            // v1.91 修复:个人拥有的游戏(isFamilyShare=false)Steam 原生卡片已展示"在库中"拥有信息,
            //   脚本不再插入绿色"在家庭库中"标记,避免重复标记盖住原生信息。
            //   仅对家庭共享游戏(isFamilyShare=true)保留紫色"家庭共享"标记的插入。
            if(isFamilyShare){
                if(insertBeforeStyle){
                    var styleAnchor = flagHost.querySelector(`[style*="${insertBeforeStyle}"]`);
                    if(styleAnchor){
                        flagHost.insertBefore(flag, styleAnchor.nextSibling);
                    }else{
                        var dsOptions = flagHost.querySelector('div.ds_options');
                        if(dsOptions){
                            flagHost.insertBefore(flag, dsOptions);
                        }else{
                            flagHost.appendChild(flag);
                        }
                    }
                }else{
                    // v1.94: 使用 flagHost(推荐卡片为媒体区域,其他卡片为 node 本身)
                    flagHost.appendChild(flag);
                }
            }
            node.querySelectorAll("div.ds_flag.ds_wishlist_flag").forEach((wishlist_flag)=>{wishlist_flag.remove()})

        }

        // v1.70: 进包标记 — 独立于家庭库检查，对所有游戏卡片检查进包状态
        // v1.94: 改为绝对定位(position:absolute),避免 display:block + clear:both 在推荐卡片等
        //   复杂布局(flexbox/grid)中占据文档流空间,导致页面元素错位、按钮变形、截图被覆盖。
        //   定位于右上角家庭共享旗帜下方(top:22px),无家庭共享旗帜时紧贴右上角。
        // v1.98: 统一优化进包标记位置 — 根据家庭共享标记是否存在动态调整 top 值:
        //   有家庭共享标记(标准/紧凑) → top:22px(位于标记下方); 无家庭共享标记 → top:0px(紧贴右上角)
        var bundleCount = getBundleCount(Number(thisappid));
        if (bundleCount > 0 && !node.querySelector('div.fa-bundle-flag')) {
            var bundleFlag = document.createElement('div');
            bundleFlag.className = 'fa-bundle-flag';
            bundleFlag.innerHTML = '进过' + bundleCount + '包&nbsp;';
            bundleFlag.title = '此游戏曾出现在 ' + bundleCount + ' 个 bundle 中（数据来源: Barter.vg）';
            // v1.98: 根据是否有家庭共享标记动态设置 top 值
            var bundleTop = (isFamilyShare && flag && flag.parentNode) ? '22px' : '0px';
            bundleFlag.style.cssText = 'position:absolute;right:0;top:' + bundleTop + ';padding:1px 6px;font-size:11px;font-weight:700;border-radius:0 0 0 3px;background:#f59e0b;color:#fff;z-index:10;white-space:nowrap;';
            // v1.94: 使用 flagHost 作为插入目标(推荐卡片为媒体区域,其他卡片为 node)
            if (flag && flag.parentNode) {
                flag.insertAdjacentElement('afterend', bundleFlag);
            } else {
                flagHost.appendChild(bundleFlag);
            }
        }

    }

    // v1.89: 恢复"查看贡献者"按钮,修复贡献者标记无法查看具体贡献者信息问题
    // v1.88 的纯 tooltip 方案不够直观,恢复 v1.82 的按钮+弹窗方案,同时保留 tooltip 作为补充

    // v1.82: 将原生"获取帮助"按钮移入脚本按钮行,确保"查看贡献者"始终在最后且不换行
    function _faRelocateHelpBtn(block, endplug, retries){
        retries = retries === undefined ? 6 : retries;
        var actionsDiv = endplug.querySelector('.already_owned_actions');
        var seeBtn = endplug.querySelector('#see_family_benefactor');
        if(!actionsDiv || !seeBtn) return;
        var searchRoots = [block, document];
        for(var r = 0; r < searchRoots.length; r++){
            var allLinks = searchRoots[r].querySelectorAll('a');
            for(var i = 0; i < allLinks.length; i++){
                if(endplug.contains(allLinks[i])) continue;
                if(allLinks[i].textContent.trim() === '获取帮助'){
                    var helpWrapper = allLinks[i].closest('.game_area_already_owned_btn');
                    if(helpWrapper){
                        actionsDiv.insertBefore(helpWrapper, seeBtn);
                    }else{
                        helpWrapper = document.createElement('div');
                        helpWrapper.className = 'game_area_already_owned_btn';
                        helpWrapper.style.cssText = 'float:none;flex-shrink:0;';
                        helpWrapper.appendChild(allLinks[i]);
                        actionsDiv.insertBefore(helpWrapper, seeBtn);
                    }
                    return;
                }
            }
        }
        if(retries > 0){
            setTimeout(function(){ _faRelocateHelpBtn(block, endplug, retries - 1); }, 500);
        }
    }

    // v1.82: 确保 #see_family_benefactor 始终为 already_owned_actions 的最后一个子元素
    function _faEnsureBenefactorLast(actionsDiv, retries){
        retries = retries === undefined ? 6 : retries;
        if(!actionsDiv) return;
        var seeBtn = actionsDiv.querySelector('#see_family_benefactor');
        if(!seeBtn) return;
        if(actionsDiv.lastElementChild !== seeBtn){
            actionsDiv.appendChild(seeBtn);
        }
        if(retries > 0){
            setTimeout(function(){ _faEnsureBenefactorLast(actionsDiv, retries - 1); }, 500);
        }
    }

    function addBanner(block,appid){
        // v1.98: 商店标记开关 — 关闭时跳过游戏详情页标记，Keylol 不受影响
        if (saves.settings.enableStoreMarking === false) return;
        let appname = appHubAppName.innerText
        let owned = false
        let thisgameInfo = saves.familyGameList.GameInfo[appid]
        var _sharedTime = (thisgameInfo && thisgameInfo.time) || 0;
        var _sharedText = _sharedTime > 0 ? timestampToTime(_sharedTime) : '未知';
        var _daysSince = _sharedTime > 0 ? Math.floor((Date.now() / 1000 - _sharedTime) / 86400) : -1;
        var _daysSinceText = _daysSince === 0 ? '今天' : _daysSince === 1 ? '昨天' : _daysSince > 0 ? (_daysSince + ' 天前') : '';
        // v1.89: 恢复按钮 tooltip — 贡献者数 + 入库时间
        var _btnTip = '贡献者：' + (thisgameInfo ? thisgameInfo.owners.length : 0) + ' 人\n入库时间：' + _sharedText + (_daysSinceText ? ' (' + _daysSinceText + ')' : '');
        // v1.88: 贡献者名称列表,附加到"查看购买日期"tooltip（保留作为补充信息）
        var _ownerNames = (thisgameInfo && thisgameInfo.owners) ? thisgameInfo.owners.map(function(sid){
            return (saves.familyInfo && saves.familyInfo.steamIdtoName && saves.familyInfo.steamIdtoName[sid]) ? saves.familyInfo.steamIdtoName[sid] : sid;
        }).join('、') : '';
        var _contributorTip = '家庭贡献者（' + (thisgameInfo ? thisgameInfo.owners.length : 0) + ' 人）：' + _ownerNames
            + '\n共享入库时间：' + _sharedText + (_daysSinceText ? ' (' + _daysSinceText + ')' : '');
        // v1.88: 将贡献者信息附加到"查看购买日期"链接的 tooltip（含重试覆盖 Steam 异步加载）
        function _faAttachContributorTip(retries){
            retries = retries === undefined ? 6 : retries;
            var ownedBanner = block.querySelector('div.game_area_already_owned.page_content');
            if(ownedBanner){
                var _links = ownedBanner.querySelectorAll('a');
                for(var _li = 0; _li < _links.length; _li++){
                    var _txt = _links[_li].textContent.trim();
                    if(_txt.indexOf('查看购买日期') !== -1 || _txt.toLowerCase().indexOf('purchase date') !== -1){
                        _links[_li].setAttribute('data-tooltip-text', _contributorTip);
                        return;
                    }
                }
            }
            if(retries > 0){
                setTimeout(function(){ _faAttachContributorTip(retries - 1); }, 500);
            }
        }
        if(block.querySelector('div.game_area_already_owned.page_content')|| thisgameInfo.owners.includes(steamid)){
            owned = true
            // v1.88: 保留 tooltip 附加作为补充信息
            _faAttachContributorTip();
            // v1.89: 恢复"查看贡献者"按钮
            let endplug = document.createElement('div');
            endplug.id = 'see_family_benefactor';
            endplug.style.position = 'relative';
            endplug.style.display = 'inline-block';
            endplug.setAttribute('data-tooltip-text', _btnTip + '\n点击查看贡献者详情');
            endplug.innerHTML = `<div class="game_area_already_owned_btn">
                             <a class="btnv6_lightblue_blue btnv6_border_2px btn_medium">
                                 <span>查看贡献者</span>
                             </a>
                             <div style="position: absolute; top: -5px; right: -8px; background-color: red; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; justify-content: center; align-items: center;">
                                 <span style="font-size: 14px;">${thisgameInfo.owners.length}</span>
                             </div>
                         </div>`
            let targetElement = block.querySelector('div.already_owned_actions');
            targetElement.classList.add('fa-owned-actions');
            targetElement.appendChild(endplug);
            _faEnsureBenefactorLast(targetElement);
        }
        if(owned == false){

            let headplug = document.createElement('div');
            let targetElement = block.querySelector('div.queue_overflow_ctn');
            headplug.style = "background:linear-gradient(to right, rgb(6 207 199 / 60%) 0%, rgb(33 105 106 / 60%) 100%);color:#06cfb5"
            headplug.className = "game_area_already_owned page_content"
            headplug.innerHTML =`<div class="game_area_already_owned_ctn" >
				                   <div class="ds_owned_flag ds_flag" style="background:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAKCAYAAABi8KSDAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OUNDNzBFNTUyMUM0MTFFNDk1REVFODRBNUU5RjA2MUYiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OUNDNzBFNTYyMUM0MTFFNDk1REVFODRBNUU5RjA2MUYiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo5Q0M3MEU1MzIxQzQxMUU0OTVERUU4NEE1RTlGMDYxRiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo5Q0M3MEU1NDIxQzQxMUU0OTVERUU4NEE1RTlGMDYxRiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pv3vUKAAAAAlSURBVHjaYvz//z8DsYARpFhISAivjnfv3jGSp3jUGeQ4AyDAADZHNe2nyOBrAAAAAElFTkSuQmCC) no-repeat 4px 4px #06cfbe">在家庭库中&nbsp;&nbsp;</div>
				                   <div class="already_in_library">已在家庭库中${_sharedTime > 0 ? '<span style="color:#94a3b8;font-size:11px;margin-left:6px;" title="' + _contributorTip + '">· ' + _daysSinceText + '</span>' : ''}</div>
		                     </div>`

            // v1.91 修复: Steam 原生页面已展示"在家庭库中"拥有信息,移除脚本绿色标记插入,
            //   避免重复标记盖住原生信息。headplug 已创建但不再插入 DOM;保留按钮(endplug)不受影响。


            let endplug = document.createElement('div');
            targetElement = block.querySelector('div.purchase_options_content');
            endplug.className = "game_area_play_stats"
            endplug.innerHTML = `<div class="already_owned_actions fa-owned-actions">
									   <div class="game_area_already_owned_btn">
										     <a class="btnv6_lightblue_blue btnv6_border_2px btn_medium" href="steam://launch/${appid}/Dialog">
										        <span>马上开玩</span>
									         </a>
								       </div>
                                       <div id ="see_family_benefactor" style="position: relative; display: inline-block;" data-tooltip-text="${_btnTip}\n点击查看贡献者详情"><div class="game_area_already_owned_btn">
								             <a class="btnv6_lightblue_blue btnv6_border_2px btn_medium">
										        <span>查看贡献者</span>
									         </a>
                                             <div style="position: absolute; top: -5px; right: -8px; background-color: red; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; justify-content: center; align-items: center;">
                                                 <span style="font-size: 14px;">${thisgameInfo.owners.length}</span>
                                             </div>
                                       </div></div>
							     </div>
					             <div style="clear:left;"></div>`
            targetElement.parentNode.insertBefore(endplug, targetElement);
            // v1.82: 将原生"获取帮助"按钮移入按钮行,确保"查看贡献者"始终在最后
            _faRelocateHelpBtn(block, endplug);

        }

        // v1.89: 恢复贡献者弹窗点击事件
        (function observer_1(){
            let btn = document.getElementById('see_family_benefactor')
            if(btn){
                // v1.81: 优化弹窗内容 — 增加共享入库时间 + 可读格式 + 距今天数
                var sharedTime = thisgameInfo.time || 0;
                var sharedDateText = sharedTime > 0 ? timestampToTime(sharedTime) : '未知';
                var daysSince = sharedTime > 0 ? Math.floor((Date.now() / 1000 - sharedTime) / 86400) : -1;
                var daysSinceText = daysSince === 0 ? '今天'
                    : daysSince === 1 ? '昨天'
                    : daysSince > 0 ? (daysSince + ' 天前')
                    : '';
                var ownedList = thisgameInfo.owners || [];
                var idMap = (saves.familyInfo && saves.familyInfo.steamIdtoName) || {};
                // 按入账时间排序(库内 API 只给游戏级 time,所以 owners 顺序无实质意义;按名字 fallback)
                var ownerItemsHtml = ownedList.map(function(sid, idx){
                    var name = idMap[sid] || sid;
                    var mark = idx === 0 ? ' <span style="color:#06cfbe;font-size:10px;">[最早]</span>' : '';
                    return '<div style="margin-bottom:4px;display:flex;align-items:center;gap:6px;">'
                        + '<span style="background:rgba(102,192,244,.15);color:#66c0f4;border-radius:50%;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;">' + (idx + 1) + '</span>'
                        + '<span style="flex:1;">' + faEsc(name) + mark + '</span>'
                        + '</div>';
                }).join('');
                // 弹窗 HTML — 含游戏名 / 家庭组 / 共享入库时间 / 距今 / 贡献者列表
                var innerHTML = ''
                    + '<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(102,192,244,.18);">'
                    +   '<div style="font-size:13px;font-weight:700;color:#c7d5e0;margin-bottom:4px;">《' + faEsc(appname) + '》</div>'
                    +   '<div style="font-size:11px;color:#8097a8;">家庭组：<span style="color:#a78bfa;">' + faEsc(saves.familyInfo.family_name || '未命名') + '</span></div>'
                    + '</div>'
                    + '<div style="margin-bottom:6px;display:flex;align-items:center;gap:6px;">'
                    +   '<span style="color:#8097a8;font-size:11px;min-width:84px;">共享入库时间：</span>'
                    +   '<span style="color:#06cfbe;font-size:12px;font-weight:600;">' + sharedDateText + '</span>'
                    +   (daysSinceText ? '<span style="color:#64748b;font-size:10px;margin-left:4px;">(' + daysSinceText + ')</span>' : '')
                    + '</div>'
                    + '<div style="margin-bottom:10px;">'
                    +   '<div style="color:#8097a8;font-size:11px;margin-bottom:6px;">贡献者（' + ownedList.length + ' 人）：</div>'
                    +   '<div style="background:rgba(0,0,0,.18);border-radius:4px;padding:8px 10px;">' + ownerItemsHtml + '</div>'
                    + '</div>'
                    + '<div style="padding-top:8px;border-top:1px solid rgba(102,192,244,.18);font-size:10px;color:#64748b;line-height:1.5;">'
                    +   '家庭共享机制：每位成员游玩后，Steam 会启动 24 小时共享冷却，期间其他成员可正常游玩但不可借出。'
                    + '</div>';
                btn.onclick = function(){
                    faCompat.alert('【' + (saves.familyInfo.family_name || '') + '】游戏贡献者', innerHTML, '好的')
                }
            }else{
                setTimeout(observer_1,200)
            }
        })();

    }

    function getGameAppid(element){
        return Number(element.firstChild.firstChild.getAttribute('src').split('/')[5])
    }
    function getGameCounts(containGames_panel){
        return Number(containGames_panel.querySelector('div.LP9H7bBiPB8N8jFzCQumL').lastChild.innerText.match(/\d*/)[0])
    }

    // v1.79：GM_registerMenuCommand — 提供油猴菜单快捷入口（符合 Tampermonkey 最佳实践）
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('打开家庭库分析面板', function() {
            if (typeof btnonclick === 'function') {
                btnonclick();
            } else if (typeof init === 'function') {
                init();
            }
        }, 'a');
        GM_registerMenuCommand('重新扫描家庭库', function() {
            if (typeof scan === 'function') {
                scan(true);
            }
        }, 's');
        // v1.98: 商店页面标记开关快捷入口
        GM_registerMenuCommand('切换商店页面标记' + (saves.settings.enableStoreMarking ? ' (当前: 开)' : ' (当前: 关)'), function() {
            saves.settings.enableStoreMarking = !saves.settings.enableStoreMarking;
            savestorage();
            var msg = saves.settings.enableStoreMarking ? '商店页面游戏标记已开启（刷新页面后生效）' : '商店页面游戏标记已关闭（Keylol 不受影响，刷新页面后生效）';
            if (typeof faToast !== 'undefined' && faToast && faToast.success) {
                faToast.success(msg);
            } else {
                faCompat.alert('脚本提示', msg, '好的');
            }
        }, 'm');
    }
    // v1.97: 全局 try-catch 兜底的 catch 块（对应 IIFE 开头 line 695 的 try）
    } catch (e) {
        // 尽力降级恢复：单点错误不再杀死整个脚本，尝试重新初始化面板入口
        console.error('[FA] 脚本初始化异常，尝试降级恢复:', e);
        try {
            if (window.location.host == "store.steampowered.com" && typeof init === 'function') {
                init();
            }
        } catch (e2) {
            console.error('[FA] 降级恢复 init() 失败:', e2);
        }
    }
})();

if (!window.__faLifecycleBound) {
    window.__faLifecycleBound = true;
    window.addEventListener('pageshow', function (event) {
        if (event.persisted && typeof window.faRestoreAfterPageShow === 'function') {
            window.faRestoreAfterPageShow();
        }
    });
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden' && typeof saves !== 'undefined' && saves) {
            savestorage();
        }
    });
    window.addEventListener('orientationchange', function () {
        setTimeout(function () {
            if (window.__faChartInstance && typeof window.__faChartInstance.resize === 'function') {
                window.__faChartInstance.resize();
            }
        }, 150);
    });
}

var FA_SCAN_CHECKPOINT_KEY = 'fa_scan_checkpoint_v1';
function scan(isdialog){
    saves.noPrompt = false
    var currentSession = faCompat.getSession();
    if (!currentSession.accountId || !currentSession.accessToken) {
        var authMessage = '未能读取 Steam 登录令牌。请确认已在 Safari 登录 Steam，并允许 Stay 访问 store.steampowered.com 与 api.steampowered.com，然后刷新页面重试。';
        if (isdialog) faCompat.alert('需要重新登录', authMessage, '好的');
        else console.warn('[家庭库脚本] ' + authMessage);
        return;
    }
    access_token = currentSession.accessToken;
    steamid = currentSession.steamId;
    if(isdialog){
        let confirmDlg = faCompat.confirm('提示','即将开始扫描，请确认已加入一个有效的家庭组，否则脚本可能会出错，扫描期间不要关闭浏览器，耐心等待！','好的，开始扫描')
        confirmDlg.done(()=>{
            confirmDlg.Dismiss()
            dialog = faCompat.wait('正在扫描家庭组库存...')
            start()
        })
    }else{
        start()
    }


    function start(){
        getfamilyInfo(access_token).then((returnjson) => {
            var candidateFamilyInfo = returnjson;
            faCompat.safeGmSet(FA_SCAN_CHECKPOINT_KEY, {
                stage: 'familyInfo',
                familyInfo: candidateFamilyInfo,
                updatedAt: Date.now()
            });
            getfamilyGameList(access_token,candidateFamilyInfo.family_groupid).then((returnjson) => {
                var candidateGameList = returnjson;
                saves.familyInfo = candidateFamilyInfo;
                saves.familyGameList = candidateGameList;
                if (steamid) saves.steamid = steamid;
                saves.lastupDateTime = faCompat.serverTime()
                // v1.81: 扫描完成 — 失效所有依赖库存指纹的计算缓存 + 清空 tab 渲染缓存
                // 库存变了,旧缓存(heatmap/activity/radar/overlap/wishlist stats/vi content)全部失效
                faComputedCache.clear();
                faRenderedTabs.clear();
                if (typeof faPCC !== 'undefined' && faPCC && faPCC.clear) faPCC.clear();
                savestorage()
                faCompat.safeGmDelete(FA_SCAN_CHECKPOINT_KEY);
                // v1.39 修复：扫描完成后刷新菜单入口的游戏数量
                if (window.faUpdateMenuBadge) { window.faUpdateMenuBadge(); }
                if(isdialog){
                    dialog.Dismiss()
                    faCompat.alert('完成',`已将${saves.familyGameList.GameList.length}个家庭库游戏记录到本地缓存。`,'好的')
                }
            }).catch((err) => {
                console.error('[家庭库脚本] 获取家庭库游戏列表失败：', err);
                if(isdialog && dialog){ dialog.Dismiss(); }
                if(isdialog){
                    faCompat.alert('错误',faScanErrorMessage(err, '获取家庭库游戏列表失败，请稍后重试。'),'好的')
                }
            })
        }).catch((err) => {
            console.error('[家庭库脚本] 获取家庭组信息失败：', err);
            if(isdialog && dialog){ dialog.Dismiss(); }
            if(isdialog){
                // v1.74：按错误类型给出准确提示——未加入家庭组 vs 网络/接口异常（已自动重试 3 次仍失败）
                if(err && err.code === 'NO_FAMILY'){
                    faCompat.alert('提示','未检测到您加入的 Steam 家庭组。\n请先在 Steam 客户端中创建或加入一个家庭组，然后再使用本脚本扫描。','好的')
                }else{
                    faCompat.alert('错误',faScanErrorMessage(err, '获取家庭组信息失败（已自动重试 3 次）。\n请检查网络、Stay 网站权限与 Steam 登录状态后重试。'),'好的')
                }
            }
        })
    }
}

function faScanErrorMessage(err, fallback) {
    var messages = {
        AUTH: 'Steam 登录状态或访问令牌已失效，请刷新页面并重新登录 Steam。',
        PERMISSION: 'Stay 缺少跨域访问权限，请允许访问 store.steampowered.com 与 api.steampowered.com。',
        RATE_LIMIT: 'Steam API 请求过于频繁，请稍后再试。',
        SERVER: 'Steam API 当前不可用，请稍后再试。',
        TIMEOUT: '连接 Steam API 超时，请检查网络后重试。',
        INVALID_JSON: 'Steam API 返回了无法识别的数据，请刷新页面后重试。',
        NETWORK: '无法连接 Steam API，请检查网络和 Stay 网站权限。'
    };
    return (err && messages[err.code]) || fallback;
}


function getfamilyGameList(access_token,family_groupid){

    return new Promise((resolve, reject) => {
        var url = `https://api.steampowered.com/IFamilyGroupsService/GetSharedLibraryApps/v1/?access_token=${access_token}&family_groupid=${family_groupid}&include_own=true&include_excluded=false&include_non_games=false`;
        faGmFetchRetry(url, {timeout: 25000}).then(function(resp) {
            var json = resp && resp.response;
            if(json){
                var returnjson = {"GameList":[],"GameInfo":{}}
                json.apps.forEach((app)=>{
                    if(app.exclude_reason == 0){
                        returnjson.GameList.push(app.appid)
                        returnjson.GameInfo[app.appid] = {
                            "name":app.name,
                            "owners":app.owner_steamids,
                            "time":app.rt_time_acquired,
                            "icon_hash":app.img_icon_hash}
                    }
                })
                returnjson.GameList.sort(function(a, b) {

                    if (returnjson.GameInfo[a].time > returnjson.GameInfo[b].time) {
                        return -1; // a 应在 b 前面
                    }else{
                        return 1; // b 应在 a 前面
                    }
                });

                resolve(returnjson)
            } else {
                reject(new Error('家庭库游戏列表响应为空'));
            }
        }).catch(function(err) {
            reject(err);
        });
    });
}

// v1.74：单次获取家庭组信息（带响应校验，错误分类：NO_FAMILY=未加入家庭组，其余=可重试的网络/接口异常）
function fetchFamilyInfoOnce(access_token){
    return new Promise((resolve, reject) => {
        var url = `https://api.steampowered.com/IFamilyGroupsService/GetFamilyGroupForUser/v1/?access_token=${access_token}&include_family_group_response=true`;
        faGmFetchRetry(url, {timeout: 25000}).then(function(resp) {
            var json = resp && resp.response;
            if(!json || Object.keys(json).length === 0){
                // Steam 偶发返回空 response，属于可重试异常而非"未加入家庭组"
                return reject(new Error('家庭组信息响应为空'));
            }
            if(!json.family_groupid){
                // 明确无 family_groupid 才判定未加入家庭组
                var nf = new Error('当前账号未加入家庭组');
                nf.code = 'NO_FAMILY';
                return reject(nf);
            }
            if(!json.family_group || !Array.isArray(json.family_group.members)){
                // 有 groupid 但详情缺失：接口抖动，可重试
                return reject(new Error('家庭组详情响应不完整'));
            }
            var returnjson = {
                "family_groupid":json.family_groupid,
                "family_name":json.family_group.name,
                "family_member":json.family_group.members,
                "steamIdtoName":{},
                "steamIdtoAvatar":{}
            }
            getUserNameBySteamId(access_token,json.family_group.members).then((ret)=>{
                returnjson.family_member = ret.family_member
                returnjson.steamIdtoName = ret.steamIdtoName
                returnjson.steamIdtoAvatar = ret.steamIdtoAvatar || {}
                resolve(returnjson)
            }).catch((err) => {
                reject(err);
            })
        }).catch(function(err) {
            reject(err);
        });
    })
}

// v1.74：家庭组信息获取入口——网络/接口异常自动重试（最多 3 次，2s/4s 退避），
// 仅在明确无家庭组（NO_FAMILY）时立即失败，避免已有家庭组的用户被误提示
function getfamilyInfo(access_token){
    var MAX_ATTEMPTS = 3;
    var attempt = 0;
    function tryOnce(){
        attempt++;
        return fetchFamilyInfoOnce(access_token).catch(function(err){
            var isNoFamily = err && err.code === 'NO_FAMILY';
            if(!isNoFamily && attempt < MAX_ATTEMPTS){
                var waitMs = attempt * 2000;
                console.warn(`[家庭库脚本] 获取家庭组信息第 ${attempt} 次失败（${err && err.message}），${waitMs/1000}s 后自动重试…`);
                return new Promise(function(r){ setTimeout(r, waitMs); }).then(tryOnce);
            }
            throw err;
        });
    }
    return tryOnce();
}


//该函数弃用
function getMyGame(access_token){
    return new Promise((resolve, reject) => {
        var xhr = new XMLHttpRequest();
        var json
        xhr.open("GET", `https://store.steampowered.com/dynamicstore/userdata/`, true);
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                json = JSON.parse(xhr.responseText);
                if(json){
                    if(Object.keys(json).length == 0){

                        reject("请求自身拥有游戏返回空白。");
                    }else{
                        var returnjson = json.rgOwnedApps
                        resolve(returnjson)
                    }
                }

            } else {
                reject("请求出错:", xhr.statusText);
            }
        };
        xhr.send();
    })
}
function getUserNameBySteamId(access_token,family_member) {
    // v1.74：改用 faGmFetchRetry（带超时/重试/429处理），失败时使用兜底昵称降级返回，
    // 不再因昵称接口异常导致整个家庭组信息获取失败（原裸 XHR 无 onerror，网络异常时 Promise 永不 settle）
    var url = `https://api.steampowered.com/IPlayerService/GetPlayerLinkDetails/v1/?access_token=${access_token}`
    family_member.forEach((member, i)=>{
        url+=`&steamids[${i}]=${member.steamid}`
    })
    function fallbackResult(reason){
        console.warn('[家庭库脚本] 成员昵称获取失败，使用兜底昵称:', reason);
        var steamIdtoName = {}, steamIdtoAvatar = {};
        family_member.forEach((member)=>{
            if(!member.userName) member.userName = '成员' + String(member.steamid).slice(-4);
            steamIdtoName[member.steamid] = member.userName;
        });
        return { family_member, steamIdtoName, steamIdtoAvatar };
    }
    return faGmFetchRetry(url, { timeout: 20000, retries: 2 }).then(function(resp) {
        var json = resp && resp.response;
        if(!json || !Array.isArray(json.accounts)) return fallbackResult('响应格式异常');
        var steamIdtoName = {}, steamIdtoAvatar = {};
        json.accounts.forEach((user)=>{
            var pd = user.public_data || {}
            family_member.forEach((member)=>{
                if(member.steamid == pd.steamid){
                    member.userName = pd.persona_name
                    if (pd.avatar) member.avatar = pd.avatar
                }
            })
            if (pd.steamid) {
                steamIdtoName[pd.steamid]=pd.persona_name
                if (pd.avatar) steamIdtoAvatar[pd.steamid] = pd.avatar
            }
        })
        // 个别成员昵称缺失时兜底
        family_member.forEach((member)=>{
            if(!member.userName){
                member.userName = '成员' + String(member.steamid).slice(-4);
                steamIdtoName[member.steamid] = member.userName;
            }
        });
        return { family_member, steamIdtoName, steamIdtoAvatar };
    }).catch(function(err) {
        return fallbackResult(err && err.message);
    });
}

// 获取家庭成员最近游玩游戏（用于"游玩动态"标签页）
// token: 当前登录用户的 webapi_token；sid: 家庭成员 steamid
// 返回 { total_count, games: [{appid,name,playtime_2weeks,playtime_forever,img_icon_url}] }
function fetchMemberRecentlyPlayed(token, sid) {
    return new Promise((resolve) => {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?access_token=${token}&steamid=${sid}`, true);
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    var json = JSON.parse(xhr.responseText).response;
                    resolve({
                        total_count: json.total_count || 0,
                        games: (json.games || []).map(function(g) {
                            return {
                                appid: g.appid,
                                name: g.name,
                                playtime_2weeks: g.playtime_2weeks || 0,
                                playtime_forever: g.playtime_forever || 0,
                                img_icon_url: g.img_icon_url || ''
                            };
                        })
                    });
                    return;
                } catch(e){console.warn('[FA]', e)}
            }
            resolve(null);
        };
        xhr.onerror = function() { resolve(null); };
        xhr.send();
    });
}

// 获取成员所有拥有游戏的总游玩时长（v1.38 修复：GetOwnedGames 含全部游戏，而非仅最近2周游玩的）
function fetchMemberOwnedGamesTotal(token, sid) {
    return new Promise((resolve) => {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?access_token=${token}&steamid=${sid}&include_played_free_games=1`, true);
        xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    var json = JSON.parse(xhr.responseText).response;
                    var games = json.games || [];
                    var totalMinutes = 0;
                    games.forEach(function(g) { totalMinutes += (g.playtime_forever || 0); });
                    resolve({ totalMinutes: totalMinutes, gameCount: json.game_count || games.length });
                    return;
                } catch(e){console.warn('[FA]', e)}
            }
            resolve(null);
        };
        xhr.onerror = function() { resolve(null); };
        xhr.send();
    });
}

// v1.72：获取成员拥有游戏的 per-game 游玩时长（用于价值洞察散点图）
// 改用 GM_xmlhttpRequest（via faGmGetJson）替代 XMLHttpRequest，参考 steam-game-library-viewer
// 的 requestSteamAPI 模式——GM_xmlhttpRequest 不受 CORS 限制且依赖 @connect api.steampowered.com，
// 比 XHR 更可靠。返回 [{appid, playtime, recent}]，playtime=总分钟数，recent=近2周分钟数
function faFetchMemberPlaytimeGames(token, sid) {
    var reqUrl = 'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?access_token=' + token + '&steamid=' + sid + '&include_appinfo=1&include_played_free_games=1';
    return faGmGetJson(reqUrl, 20000).then(function(resp) {
        if (!resp || !resp.response || !resp.response.games) {
            console.warn('[FA] GetOwnedGames per-game: 响应为空或无 games 字段, sid=' + sid);
            return [];
        }
        return resp.response.games.map(function(g) {
            return { appid: g.appid, playtime: g.playtime_forever || 0, recent: g.playtime_2weeks || 0 };
        });
    });
}

    // v1.66：Toast 非阻塞通知系统（参考 steam-friend-manager toast 单例模式）
    var faToast = {
        _el: null,
        _timer: null,
        _show: function(msg, type) {
            if (!this._el) {
                this._el = document.createElement('div');
                this._el.id = 'fa-toast';
                document.body.appendChild(this._el);
            }
            this._el.textContent = msg;
            this._el.className = 'fa-toast' + (type ? ' fa-toast-' + type : '');
            requestAnimationFrame(function() { this._el.classList.add('fa-toast-show'); }.bind(this));
            if (this._timer) clearTimeout(this._timer);
            this._timer = setTimeout(function() {
                this._el.classList.remove('fa-toast-show');
            }.bind(this), 2500);
        },
        success: function(msg) { this._show(msg, 'success'); },
        error: function(msg) { this._show(msg, 'error'); },
        warning: function(msg) { this._show(msg, 'warning'); },
        info: function(msg) { this._show(msg, 'info'); }
    };

// ===================== 全局样式注入（v1.46 合并精简） =====================
// 原先分散在 renderPlayActivityTab / renderWishlistTab 的 fa-spin 与 fa-wl-* 注入块，
// 以及面板 HTML 中重复的内联样式（7 处标签页容器 / 4 处绿按钮 / 5 处卡片），统一收敛到此。
function faInjectGlobalStyle() {
    if (document.getElementById('fa-global-style')) return;
    var st = document.createElement('style');
    st.id = 'fa-global-style';
    st.textContent = '@keyframes fa-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}'
        + '.fa-tab-pane{padding:12px 14px;overflow-y:auto;max-height:calc(85vh - 160px)}'
        + '.fa-card{background:rgba(15,23,42,.4);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px}'
        + '.fa-btn-green{background:linear-gradient(180deg,#4c7a34 0%,#3a5f28 100%);border:1px solid #5a8f3a;color:#d2e9c0;padding:4px 14px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500}'
        + '.fa-btn-green:hover{background:linear-gradient(180deg,#5a8f3a 0%,#4c7a34 100%)}'
        + '.fa-btn-green.fa-btn-sm{padding:3px 10px;font-size:11px}'
        + '.fa-wl-pgbtn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#8097a8;padding:3px 8px;border-radius:3px;cursor:pointer;font-size:11px}'
        + '.fa-wl-pgbtn:disabled{opacity:.4;cursor:default}'
        + '.fa-wl-pgbtn:not(:disabled):hover{background:rgba(255,255,255,.12);color:#c6d4df}'
        + '.fa-wl-pgbtn.fa-btn-md{padding:4px 10px;border-radius:4px;font-size:12px}'
        + '.fa-wl-badge{font-size:8px;padding:1px 4px;border-radius:2px;white-space:nowrap}'
        + '.fa-wl-card{display:flex;align-items:center;gap:5px;padding:4px 6px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:5px;overflow:hidden;min-width:0}'
        + '.fa-wl-name{font-size:11px;font-weight:600;color:#e2e8f0;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1 1 auto}'
        + '.fa-wl-name:hover{color:#06cfbe}'
        // v1.58：愿望单视图切换 / 二级筛选 / 封面视图 / 成员头像
        + '.fa-wl-view-toggle{display:flex;gap:2px;background:rgba(15,23,42,.6);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:2px}'
        + '.fa-wl-view-btn{background:transparent;border:none;color:#8097a8;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;display:flex;align-items:center;gap:3px;transition:all .2s}'
        + '.fa-wl-view-btn:hover{color:#c6d4df}'
        + '.fa-wl-view-btn.active{background:rgba(6,207,190,.2);color:#06cfbe}'
        + '.fa-wl-subtags{display:flex;gap:4px;flex-wrap:wrap;flex:1 1 auto;min-width:0;align-items:center}'
        + '.fa-wl-subtag{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#8097a8;padding:3px 9px;border-radius:4px;cursor:pointer;font-size:11px;white-space:nowrap}'
        + '.fa-wl-subtag:hover:not(.disabled){background:rgba(255,255,255,.1);color:#c6d4df}'
        + '.fa-wl-subtag.active{background:rgba(84,160,255,.2);border-color:rgba(84,160,255,.4);color:#54a0ff}'
        + '.fa-wl-subtag.disabled{opacity:.35;cursor:not-allowed}'
        + '.fa-wl-cover-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}'
        + '.fa-wl-cover-card{background:rgba(15,23,42,.4);border:1px solid rgba(255,255,255,.08);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .2s,background .2s}'
        + '.fa-wl-cover-card:hover{border-color:rgba(6,207,190,.35);background:rgba(6,207,190,.04)}'
        + '.fa-wl-cover-cap-wrap{position:relative;aspect-ratio:184/69;overflow:hidden;background:#0f172a;cursor:pointer}'
        + '.fa-wl-cover-cap{width:100%;height:100%;object-fit:cover;display:block}'
        + '.fa-wl-cover-want-badge{position:absolute;top:4px;right:4px;background:rgba(84,160,255,.85);color:#0f172a;font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px}'
        + '.fa-wl-cover-lib-badge{position:absolute;top:4px;left:4px;background:rgba(6,207,190,.85);color:#0f172a;font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px}'
        + '.fa-wl-cover-soon-badge{position:absolute;bottom:4px;left:4px;background:rgba(56,189,248,.85);color:#0f172a;font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px}'
        + '.fa-wl-cover-goty-badge{position:absolute;bottom:4px;right:4px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px}'
        + '.fa-wl-cover-info{padding:6px 8px;display:flex;flex-direction:column;gap:4px;min-width:0}'
        + '.fa-wl-cover-name{font-size:12px;font-weight:600;color:#e2e8f0;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.fa-wl-cover-name:hover{color:#06cfbe}'
        + '.fa-wl-cover-bottom{display:flex;align-items:center;justify-content:space-between;gap:4px;min-width:0}'
        + '.fa-wl-cover-avatars{display:flex;align-items:center;flex-shrink:0}'
        + '@media(max-width:900px){.fa-wl-cover-grid{grid-template-columns:repeat(3,1fr)}}'
        + '@media(max-width:600px){.fa-wl-cover-grid{grid-template-columns:repeat(2,1fr)}}'
        // v1.56：购买动态封面视图样式（参考 steam-friend-manager sfd-pl-recent-* 系列）
        + '.fa-act-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:space-between;margin-bottom:10px}'
        + '.fa-act-view-toggle{display:flex;gap:2px;background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:2px}'
        + '.fa-act-view-btn{background:transparent;border:none;color:#8097a8;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;display:flex;align-items:center;gap:3px;transition:all 0.2s}'
        + '.fa-act-view-btn:hover{color:#c6d4df}'
        + '.fa-act-view-btn.active{background:rgba(6,207,190,0.2);color:#06cfbe}'
        + '.fa-act-cover-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}'
        + '.fa-act-cover-card{background:rgba(15,23,42,0.4);border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;transition:border-color 0.2s,background 0.2s;position:relative}'
        + '.fa-act-cover-card:hover{border-color:rgba(6,207,190,0.35);background:rgba(6,207,190,0.04)}'
        + '.fa-act-cover-card.is-new{border-color:rgba(6,207,190,0.3)}'
        + '.fa-act-cover-cap-wrap{position:relative;aspect-ratio:184/69;overflow:hidden;background:#0f172a;cursor:pointer}'
        + '.fa-act-cover-cap{width:100%;height:100%;object-fit:cover;display:block}'
        + '.fa-act-cover-new-badge{position:absolute;top:4px;right:4px;background:rgba(6,207,190,0.85);color:#0f172a;font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px;letter-spacing:0.5px}'
        + '.fa-act-cover-info{padding:7px 9px;display:flex;flex-direction:column;gap:3px}'
        + '.fa-act-cover-name{font-size:12px;font-weight:600;color:#e2e8f0;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.fa-act-cover-name:hover{color:#06cfbe}'
        + '.fa-act-cover-meta{display:flex;gap:8px;font-size:10px;color:#8097a8;flex-wrap:wrap;align-items:center}'
        + '.fa-act-cover-buyer{color:#54a0ff;font-weight:500}'
        + '@media(max-width:900px){.fa-act-cover-grid{grid-template-columns:repeat(3,1fr)}}'
        + '@media(max-width:600px){.fa-act-cover-grid{grid-template-columns:repeat(2,1fr)}}'
        // v1.62：共享冷却标签页样式（v1.63：保留封面图，优化下方信息为两列布局）
        + '.fa-cd-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px}'
        + '.fa-cd-section{margin-top:10px}'
        + '.fa-cd-section-title{font-size:13px;font-weight:600;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.08)}'
        + '.fa-cd-empty{font-size:12px;color:#64748b;padding:10px 4px}'
        + '.fa-cd-list{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}'
        + '.fa-cd-card{background:rgba(15,23,42,.4);border:1px solid rgba(255,255,255,.08);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .2s,background .2s}'
        + '.fa-cd-card:hover{border-color:rgba(6,207,190,.3);background:rgba(6,207,190,.04)}'
        + '.fa-cd-cap-wrap{position:relative;aspect-ratio:184/69;overflow:hidden;background:#0f172a;cursor:pointer}'
        + '.fa-cd-cap{width:100%;height:100%;object-fit:cover;display:block}'
        + '.fa-cd-info{padding:6px 8px;display:flex;align-items:center;gap:6px;min-width:0}'
        + '.fa-cd-col-name{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}'
        + '.fa-cd-name{font-size:12px;font-weight:600;color:#e2e8f0;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.fa-cd-name:hover{color:#06cfbe}'
        + '.fa-cd-countdown{font-size:11px;font-weight:700;color:#ff6b6b;font-variant-numeric:tabular-nums}'
        + '.fa-cd-borrower-name{font-size:9px;color:#54a0ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.fa-cd-col-actions{display:flex;align-items:center;gap:5px;flex-shrink:0}'
        + '.fa-cd-avatars{display:flex;align-items:center;flex-shrink:0}'
        + '.fa-cd-pgbar{display:flex;align-items:center;justify-content:center;gap:3px;margin-top:6px}'
        + '@media(max-width:900px){.fa-cd-list{grid-template-columns:repeat(2,1fr)}}'
        + '@media(max-width:600px){.fa-cd-list{grid-template-columns:1fr}}'
        // v1.62：DLC 拥有状态标记与按钮激活态
        + '.fa-btn-green.active{box-shadow:0 0 0 2px rgba(6,207,190,.4)}'
        + '.fa-dlc-owned-mark{display:inline-flex;align-items:center;gap:2px}'
        // v1.64：愿望单加载进度——成员头像旋转光圈特效
        + '@keyframes fa-wl-ring-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}'
        + '@keyframes fa-wl-dot-pulse{0%,80%,100%{opacity:.3;transform:scale(.7)}40%{opacity:1;transform:scale(1.3)}}'
        + '.fa-wl-loading-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:50px 20px;gap:16px;color:#8097a8}'
        + '.fa-wl-loading-ring{position:relative;width:64px;height:64px;border-radius:50%;padding:3px;background:conic-gradient(from 0deg,transparent 0%,#06cfbe 30%,#54a0ff 60%,transparent 90%);animation:fa-wl-ring-spin 1.2s linear infinite;flex-shrink:0}'
        + '.fa-wl-loading-ring-inner{width:100%;height:100%;border-radius:50%;background:#0e1824;display:flex;align-items:center;justify-content:center;overflow:hidden}'
        + '.fa-wl-loading-avatar-img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}'
        + '.fa-wl-loading-name{font-size:15px;font-weight:600;color:#c6d4df;text-align:center;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.fa-wl-loading-progress{font-size:12px;color:#8097a8;text-align:center;line-height:1.6}'
        + '.fa-wl-loading-dots{display:inline-flex;gap:3px;margin-left:4px;vertical-align:middle}'
        + '.fa-wl-loading-dots span{width:4px;height:4px;border-radius:50%;background:#06cfbe;animation:fa-wl-dot-pulse 1.4s ease-in-out infinite}'
        + '.fa-toast{position:fixed;bottom:50px;left:50%;transform:translateX(-50%) translateY(20px);background:rgba(15,23,42,0.95);color:#fff;border:1px solid rgba(6,207,190,0.5);padding:10px 24px;border-radius:20px;font-size:13px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,0.3);z-index:999999;opacity:0;pointer-events:none;transition:opacity 0.3s,transform 0.3s}'
        + '.fa-toast.fa-toast-show{opacity:1;transform:translateX(-50%) translateY(0)}'
        + '.fa-toast.fa-toast-success{border-color:#2ed573}'
        + '.fa-toast.fa-toast-error{border-color:#ff6b6b}'
        + '.fa-toast.fa-toast-warning{border-color:#f59e0b}'
        + '.fa-toast.fa-toast-info{border-color:#54a0ff}'
        + '.fa-wl-loading-dots span:nth-child(2){animation-delay:.2s}'
        + '.fa-wl-loading-dots span:nth-child(3){animation-delay:.4s}'
        // v1.64：购买动态成员筛选下拉框样式（v1.75：修复"购买者"文本竖排换行——flex-shrink:0 + white-space:nowrap）
        + '.fa-act-filter{display:flex;align-items:center;gap:4px;flex-shrink:0;white-space:nowrap}'
        + '.fa-act-filter select{background:rgba(15,23,42,.6);border:1px solid rgba(255,255,255,.1);color:#c6d4df;padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;outline:none;max-width:140px;flex-shrink:0}'
        + '.fa-act-filter select:hover{border-color:rgba(6,207,190,.4)}'
        + '.fa-act-filter select:focus{border-color:#06cfbe60}'
        // v1.83：全局游戏搜索框 + 下拉结果浮层 + 游戏详情浮窗
        + '.fa-global-search{flex:0 0 200px;position:relative;display:flex;align-items:center;gap:4px;height:26px;padding:0 6px 0 8px;margin-left:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#c7d5e0;transition:border-color .15s,background .15s,box-shadow .15s;min-width:120px;max-width:240px}'
        + '.fa-global-search:hover{background:rgba(255,255,255,.09)}'
        + '.fa-global-search:focus-within{border-color:rgba(6,207,190,.55);background:rgba(255,255,255,.1);box-shadow:0 0 0 1px rgba(6,207,190,.25)}'
        + '.fa-global-search-icon{display:inline-flex;align-items:center;color:#8097a8;flex-shrink:0}'
        + '.fa-global-search-icon svg{width:12px;height:12px}'
        + '.fa-global-search input{flex:1 1 auto;min-width:0;border:none;background:transparent;color:#fff;font-size:11.5px;line-height:1;outline:none;padding:0;height:100%}'
        + '.fa-global-search input::placeholder{color:#6b7c8c;font-size:11px}'
        + '.fa-global-search-clear{flex:0 0 auto;display:none;align-items:center;justify-content:center;width:16px;height:16px;padding:0;border:none;border-radius:4px;background:rgba(255,255,255,.1);color:#c7d5e0;cursor:pointer;transition:background .15s,color .15s}'
        + '.fa-global-search-clear:hover{background:rgba(255,255,255,.2);color:#fff}'
        + '.fa-global-search-clear svg{width:9px;height:9px}'
        + '.fa-global-search.has-text .fa-global-search-clear{display:inline-flex}'
        + '.fa-global-search-pop{position:absolute;top:calc(100% + 6px);right:0;left:auto;min-width:300px;max-width:400px;max-height:calc(80vh - 80px);overflow-y:auto;background:rgba(15,23,42,.98);border:1px solid rgba(6,207,190,.35);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.7),0 0 0 1px rgba(0,0,0,.3);z-index:1000001;padding:4px 0;backdrop-filter:blur(12px);display:block;opacity:0;transform:translateY(-6px) scale(.98);visibility:hidden;transition:opacity .16s ease,transform .16s ease,visibility 0s linear .16s;transform-origin:top right}'
        + '.fa-global-search-pop::-webkit-scrollbar{width:6px}'
        + '.fa-global-search-pop::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}'
        + '.fa-global-search-pop.show{opacity:1;transform:translateY(0) scale(1);visibility:visible;transition:opacity .16s ease,transform .16s ease,visibility 0s}'
        + '.fa-gs-header{padding:8px 12px 5px;font-size:10px;font-weight:700;color:#6e7681;text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.04)}'
        + '.fa-gs-header-count{background:rgba(6,207,190,.12);color:#06cfbe;font-weight:700;text-transform:none;letter-spacing:0;padding:1px 7px;border-radius:10px;font-size:10px}'
        + '.fa-gs-item{display:flex;align-items:center;gap:10px;padding:7px 12px;cursor:pointer;color:#c7d5e0;font-size:12px;transition:background .12s,color .12s;border-left:2px solid transparent}'
        + '.fa-gs-item:hover,.fa-gs-item.focus{background:rgba(6,207,190,.12);color:#fff;border-left-color:rgba(6,207,190,.6)}'
        + '.fa-gs-item-thumb{width:48px;height:18px;flex-shrink:0;background:rgba(255,255,255,.04);border-radius:3px;overflow:hidden;display:flex;align-items:center;justify-content:center;transition:transform .15s ease}'
        + '.fa-gs-item:hover .fa-gs-item-thumb,.fa-gs-item.focus .fa-gs-item-thumb{transform:scale(1.08)}'
        + '.fa-gs-item-thumb img{width:100%;height:100%;object-fit:cover}'
        + '.fa-gs-item-body{flex:1 1 auto;min-width:0}'
        + '.fa-gs-item-name{font-size:12px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '.fa-gs-item.focus .fa-gs-item-name{color:#fff}'
        + '.fa-gs-item-name mark{background:rgba(6,207,190,.35);color:#fff;padding:0 1px;border-radius:2px}'
        + '.fa-gs-item-sub{font-size:10px;color:#8a9ba8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}'
        + '.fa-gs-item-right{display:flex;align-items:center;gap:4px;flex-shrink:0}'
        + '.fa-gs-item-type{flex-shrink:0;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;text-transform:uppercase;letter-spacing:.04em}'
        + '.fa-gs-item-type.family{background:rgba(6,207,190,.15);color:#06cfbe}'
        + '.fa-gs-item-type.wishlist{background:rgba(245,158,11,.15);color:#f59e0b}'
        + '.fa-gs-item-shared{background:rgba(168,85,247,.15);color:#c4b5fd;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;white-space:nowrap}'
        + '.fa-gs-item-ext{display:inline-flex;align-items:center;color:#6e7681}'
        + '.fa-gs-item-ext svg{width:10px;height:10px}'
        + '.fa-gs-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 20px;gap:10px;color:#6e7681;font-size:12px}'
        + '.fa-gs-empty-icon svg{width:28px;height:28px;opacity:.4}'
        + '.fa-gs-footer{display:flex;justify-content:space-between;padding:6px 12px;border-top:1px solid rgba(255,255,255,.04);font-size:10px;color:#6e7681}'
        + '.fa-gs-footer-hint{display:inline-flex;align-items:center;gap:3px}'
        + '.fa-gs-footer-hint kbd{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:3px;padding:0 4px;font-size:9px;font-family:monospace;color:#c7d5e0}'
        // 游戏详情浮窗
        + '.fa-detail-overlay{position:absolute;inset:0;background:rgba(0,0,0,.5);z-index:1000002;border-radius:inherit;opacity:0;visibility:hidden;transition:opacity .16s ease,visibility 0s linear .16s}'
        + '.fa-detail-overlay.show{opacity:1;visibility:visible;transition:opacity .16s ease,visibility 0s}'
        + '.fa-detail-pop{position:absolute;top:50%;left:50%;transform:translate(-50%,-48%) scale(.96);width:calc(100% - 48px);max-width:560px;max-height:calc(85vh - 60px);background:linear-gradient(160deg,rgba(23,33,45,.99),rgba(15,23,42,.99));border:1px solid rgba(6,207,190,.25);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.3);z-index:1000003;overflow:hidden;display:flex;flex-direction:column;opacity:0;visibility:hidden;transition:opacity .2s ease,transform .2s ease,visibility 0s linear .2s}'
        + '.fa-detail-pop.show{opacity:1;visibility:visible;transform:translate(-50%,-50%) scale(1);transition:opacity .2s ease,transform .2s ease,visibility 0s}'
        + '.fa-detail-close{position:absolute;top:10px;right:10px;z-index:5;width:30px;height:30px;border-radius:50%;border:none;background:rgba(0,0,0,.4);color:#c7d5e0;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .16s,color .16s}'
        + '.fa-detail-close:hover{background:rgba(244,67,54,.5);color:#fff}'
        + '.fa-detail-close svg{width:16px;height:16px}'
        + '.fa-detail-scroll{overflow-y:auto;overflow-x:hidden}'
        + '.fa-detail-scroll::-webkit-scrollbar{width:6px}'
        + '.fa-detail-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:3px}'
        + '.fa-detail-hero{position:relative;width:100%;aspect-ratio:231/87;overflow:hidden;background:#1a2332}'
        + '.fa-detail-hero img{width:100%;height:100%;object-fit:cover;display:block}'
        + '.fa-detail-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(15,23,42,.95))}'
        + '.fa-detail-body{padding:0 18px 18px}'
        + '.fa-detail-name{font-size:18px;font-weight:700;color:#e2e8f0;margin:-20px 0 4px;position:relative;z-index:1;text-shadow:0 2px 8px rgba(0,0,0,.8)}'
        + '.fa-detail-desc{font-size:12px;color:#8b949e;line-height:1.6;margin:10px 0}'
        + '.fa-detail-meta{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:11px;margin:10px 0}'
        + '.fa-detail-meta dt{color:#6e7681;font-weight:600}'
        + '.fa-detail-meta dd{color:#c7d5e0;margin:0}'
        + '.fa-detail-tags{display:flex;flex-wrap:wrap;gap:4px;margin:10px 0}'
        + '.fa-detail-tag{font-size:10px;padding:2px 8px;border-radius:4px;background:rgba(6,207,190,.1);color:#06cfbe;border:1px solid rgba(6,207,190,.15)}'
        + '.fa-detail-price-val{font-size:16px;font-weight:700;color:#4ade80}'
        + '.fa-detail-price-discount{font-size:12px;color:#fbbf24}'
        + '.fa-detail-price-free{font-size:16px;font-weight:700;color:#4ade80}'
        + '.fa-detail-shots{display:flex;gap:6px;overflow-x:auto;margin:10px 0;padding-bottom:4px}'
        + '.fa-detail-shots::-webkit-scrollbar{height:4px}'
        + '.fa-detail-shots::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:2px}'
        + '.fa-detail-shot{flex-shrink:0;width:200px;height:113px;border-radius:6px;overflow:hidden;background:#1a2332}'
        + '.fa-detail-shot img{width:100%;height:100%;object-fit:cover;display:block}'
        + '.fa-detail-actions{display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06)}'
        + '.fa-detail-btn{display:inline-flex;align-items:center;gap:5px;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:none;transition:all .16s;text-decoration:none}'
        + '.fa-detail-btn-primary{background:linear-gradient(135deg,#06cfbe,#0e9e8e);color:#fff}'
        + '.fa-detail-btn-primary:hover{filter:brightness(1.1)}'
        + '.fa-detail-btn-secondary{background:rgba(255,255,255,.08);color:#c7d5e0}'
        + '.fa-detail-btn-secondary:hover{background:rgba(255,255,255,.14)}'
        + '.fa-detail-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px;gap:12px;color:#6e7681;font-size:12px}'
        + '.fa-detail-error{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px;gap:8px;color:#f87171;font-size:12px}'
        + '.fa-detail-metacritic{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 8px;border-radius:4px;font-weight:700}'
        // v1.98: 商店标记开关 toggle 样式
        + '.fa-toggle-switch{display:inline-flex;align-items:center;gap:5px;cursor:pointer;user-select:none;flex-shrink:0}'
        + '.fa-toggle-switch input{display:none}'
        + '.fa-toggle-slider{position:relative;width:32px;height:18px;background:rgba(255,255,255,.12);border-radius:10px;transition:background .2s;flex-shrink:0}'
        + '.fa-toggle-slider::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;background:#8097a8;border-radius:50%;transition:transform .2s,background .2s}'
        + '.fa-toggle-switch input:checked+.fa-toggle-slider{background:rgba(6,207,190,.35)}'
        + '.fa-toggle-switch input:checked+.fa-toggle-slider::after{transform:translateX(14px);background:#06cfbe}'
        + '.fa-toggle-label{font-size:11px;color:#8097a8;white-space:nowrap;transition:color .2s}'
        + '.fa-toggle-switch input:checked~.fa-toggle-label{color:#06cfbe}'
        + '#familyAnalysisPanel{height:100vh!important;height:100dvh!important;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);box-sizing:border-box}'
        + '#familyAnalysisDialog{max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))}'
        + '.fa-mobile-nav{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}'
        + '#familyAnalysisPanel [data-fa-nav],#familyAnalysisPanel .fa-btn-green,#familyAnalysisPanel #btnClosePanel{min-height:44px}'
        + '#familyAnalysisPanel [data-fa-chart-unavailable]::after{content:attr(data-fa-chart-unavailable);display:block;padding:24px;color:#f59e0b;text-align:center;font-size:12px}'
        + '.fa-contrib-tap-hint{display:none}'
        + '@media(max-width:600px){'
        + '#familyAnalysisPanel{align-items:stretch!important;justify-content:stretch!important}'
        + '#familyAnalysisDialog{width:100%!important;max-width:none!important;max-height:none!important;border-radius:0!important}'
        + '#familyAnalysisDragHandle{cursor:default!important;flex-wrap:wrap;padding:10px!important;border-radius:0!important}'
        + '#familyAnalysisDragHandle .fa-global-search{order:4;flex:1 0 100%;max-width:none;height:44px;margin:0}'
        + '#familyAnalysisPanel .fa-tab-pane{max-height:none;padding:10px;overscroll-behavior:contain}'
        + '#familyAnalysisPanel .fa-panel-content{overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch}'
        + '#familyAnalysisPanel [data-fa-tab="contribution"]{overflow:visible!important}'
        + '#familyAnalysisPanel [data-fa-tab="contribution"],#familyAnalysisPanel [data-fa-tab="contribution"] *{box-sizing:border-box!important}'
        + '#familyAnalysisPanel .fa-contrib-member-legend,#familyAnalysisPanel .fa-my-contrib-list,#familyAnalysisPanel .fa-share-detail-analysis,#familyAnalysisPanel .fa-share-detail-games-list{overflow:visible!important}'
        + '#familyAnalysisPanel [style*="grid-template-columns:repeat("]{grid-template-columns:1fr!important}'
        + '#familyAnalysisPanel [style*="min-width:300px"],#familyAnalysisPanel [style*="min-width:320px"]{min-width:0!important}'
        + '#Family_countChart{width:100%!important;height:auto!important;max-height:55dvh}'
        + '#familyAnalysisPanel .fa-contrib-layout{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}'
        + '#familyAnalysisPanel .fa-contrib-summary{display:grid!important;grid-template-columns:1fr!important;gap:8px!important;width:100%!important;min-width:0!important;flex:none!important}'
        + '#familyAnalysisPanel .fa-contrib-join{display:block!important;grid-column:1/-1}'
        + '#familyAnalysisPanel .fa-contrib-join>div{margin-bottom:0!important}'
        + '#familyAnalysisPanel .fa-contrib-kpis{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}'
        + '#familyAnalysisPanel .fa-contrib-chart-card,#familyAnalysisPanel .fa-contrib-side{width:100%!important;min-width:0!important;flex:none!important}'
        + '#familyAnalysisPanel .fa-contrib-chart-card{width:100%!important;padding:12px!important;display:flex!important;flex-direction:column!important;gap:8px!important}'
        + '#familyAnalysisPanel .fa-contrib-chart-card [data-contrib-range-toggle]{position:static!important;align-self:stretch!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;background:transparent!important;border:0!important;padding:0!important}'
        + '#familyAnalysisPanel .fa-contrib-chart-card [data-contrib-range]{min-height:44px!important}'
        + '#familyAnalysisPanel .fa-contrib-side{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}'
        + '#familyAnalysisPanel .fa-contrib-footer{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}'
        + '#familyAnalysisPanel .fa-contrib-actions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;width:100%!important}'
        + '#familyAnalysisPanel .fa-contrib-actions .fa-toggle-switch{grid-column:1/-1;min-height:44px}'
        + '#familyAnalysisPanel .fa-contrib-actions .fa-btn-green{width:100%!important}'
        + '#familyAnalysisPanel #faViewMyContrib{min-height:44px!important;min-width:44px!important}'
        + '#familyAnalysisPanel .fa-contrib-tap-hint{display:block;text-align:center;color:#8097a8;font-size:11px;line-height:1.4}'
        + '#familyAnalysisPanel .fa-contrib-overlay{min-width:0!important;overflow:visible!important}'
        + '#familyAnalysisPanel .fa-contrib-overlay-header{position:sticky!important;top:0;z-index:8;min-height:52px;padding:4px 0;background:rgba(15,23,42,.96);backdrop-filter:blur(10px)}'
        + '#familyAnalysisPanel .fa-contrib-overlay-header button{min-height:44px!important}'
        + '#familyAnalysisPanel .fa-contrib-overlay-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}'
        + '#familyAnalysisPanel .fa-contrib-overlay-kpis>div:last-child:nth-child(odd){grid-column:1/-1}'
        + '#familyAnalysisPanel .fa-my-contrib-columns{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;min-width:0!important}'
        + '#familyAnalysisPanel .fa-my-contrib-primary,#familyAnalysisPanel .fa-my-contrib-exclusive{min-width:0!important;width:100%!important;flex:none!important}'
        + '#familyAnalysisPanel .fa-my-contrib-exclusive-header{flex-wrap:wrap!important;min-width:0!important;overflow:visible!important}'
        + '#familyAnalysisPanel .fa-my-contrib-exclusive-pager{gap:8px!important;flex-wrap:wrap!important;min-width:0!important;max-width:100%!important;overflow:visible!important}'
        + '#familyAnalysisPanel .fa-my-contrib-exclusive-pager button{min-height:44px!important;flex:0 1 auto;white-space:nowrap}'
        + '#familyAnalysisPanel .fa-my-contrib-view a[data-fa-appid]{white-space:normal!important;overflow-wrap:anywhere}'
        + '#familyAnalysisPanel .fa-contrib-game-row{min-height:44px!important;gap:8px!important;padding-top:0!important;padding-bottom:0!important}'
        + '#familyAnalysisPanel .fa-contrib-game-link{min-height:44px!important;min-width:44px!important;white-space:normal!important;overflow-wrap:anywhere}'
        + '#familyAnalysisPanel .fa-contrib-game-title{white-space:normal!important;overflow-wrap:anywhere}'
        + '#familyAnalysisPanel #faContribBack{min-height:44px!important}'
        + '#familyAnalysisPanel #faExcPrevPage,#familyAnalysisPanel #faExcNextPage{min-height:44px!important}'
        + '#familyAnalysisPanel .fa-share-detail-columns{display:grid!important;grid-template-columns:1fr!important;gap:10px!important;min-width:0!important}'
        + '#familyAnalysisPanel .fa-share-detail-analysis,#familyAnalysisPanel .fa-share-detail-games{min-width:0!important;width:100%!important;flex:none!important;overflow:visible!important}'
        + '#familyAnalysisPanel .fa-share-detail-games-list{overflow:visible!important}'
        + '#familyAnalysisPanel .fa-share-detail-games a[data-fa-appid]{white-space:normal!important;overflow-wrap:anywhere}'
        + '#familyAnalysisPanel #faShareDetailBack,#familyAnalysisPanel #faSdPrevPage,#familyAnalysisPanel #faSdNextPage{min-height:44px!important}'
        + '.fa-global-search-pop{left:0;right:0;min-width:0;max-width:none}'
        + '}';
    document.head.appendChild(st);
}

// ===================== v1.41 家庭愿望单 API =====================
// 参考 steam-wishlist-exporter-2.1.3 和 steam-game-library-viewer-2.3.25 的多源降级策略：
// 来源1（主）：愿望单页面 SSR 提取（最可靠，利用登录会话 Cookie 渲染的 React Query 数据）
// 来源2（补/降级）：wishlistdata JSON API 分页（补充名称/价格/标签）
// 合并策略：SSR 提供 date_added/priority + StoreItem 详情（首批），API 补充缺失的名称/价格/标签

// ---- SSR 辅助函数 ----

// 从愿望单页面 HTML 中提取 React Query SSR queries 数组
// 参考 steam-game-library-viewer 的 wlExtractQueryDataFromText
function faWlExtractQueryDataFromText(text) {
    try {
        var idx = 0;
        while ((idx = text.indexOf('JSON.parse(', idx)) !== -1) {
            var start = text.indexOf('"', idx + 11);
            if (start === -1) { idx++; continue; }
            var i = start + 1, inEsc = false;
            while (i < text.length) {
                var c = text[i];
                if (inEsc) inEsc = false;
                else if (c === '\\') inEsc = true;
                else if (c === '"') break;
                i++;
            }
            var escaped = text.substring(start + 1, i).replace(/[\n\r]/g, '');
            var decoded = '';
            try { decoded = JSON.parse('"' + escaped + '"'); } catch (_) { idx = i + 1; continue; }
            if (typeof decoded === 'string' && decoded.indexOf('queryData') !== -1) {
                try {
                    var outer = JSON.parse(decoded);
                    if (outer && typeof outer.queryData === 'string') {
                        var qd = JSON.parse(outer.queryData);
                        if (qd && Array.isArray(qd.queries)) return qd.queries;
                    }
                } catch (_) {}
            }
            idx = i + 1;
        }
    } catch (e) { console.warn('[FA-WL] SSR extract failed:', e); }
    return null;
}

// 从 queries 数组提取愿望单条目 / StoreItem 缓存 / 标签名映射
function faWlExtractFromQueries(queries) {
    var entries = [];
    var tagNameMap = {};
    var storeItemCache = {};
    for (var qi = 0; qi < queries.length; qi++) {
        var query = queries[qi];
        if (!query || !query.state || !query.state.data) continue;
        var data = query.state.data;
        var qKey = query.queryKey || [];
        // 愿望单条目（含 appid/priority/date_added/category_ids）
        if (qKey[0] === 'WishlistSortedFiltered') {
            var payload = Array.isArray(data) ? { items: data } : data;
            if (payload && Array.isArray(payload.items)) {
                for (var ii = 0; ii < payload.items.length; ii++) entries.push(payload.items[ii]);
            }
        }
        // 标签名映射（tagid -> name）
        if (qKey[0] === 'LocalizedTagNames' && typeof data === 'object' && !Array.isArray(data)) {
            for (var tk in data) tagNameMap[tk] = data[tk];
        }
        // StoreItem 详情（按 appid 聚合各子查询）
        if (qKey.length >= 3 && qKey[0] === 'StoreItem') {
            var appId = parseInt(String(qKey[1]).replace(/^app_/, ''), 10);
            if (!appId || isNaN(appId)) continue;
            if (!storeItemCache[appId]) storeItemCache[appId] = { _appId: appId };
            storeItemCache[appId][qKey[2]] = data;
        }
    }
    // 去重（按 appid）
    var seen = {};
    var unique = [];
    for (var ei = 0; ei < entries.length; ei++) {
        var e = entries[ei];
        if (e && e.appid && !seen[e.appid]) { seen[e.appid] = true; unique.push(e); }
    }
    return { entries: unique, storeItemCache: storeItemCache, tagNameMap: tagNameMap };
}

// 统一的条目完整度判定：名称非占位 +（免费或有价格）+ 有标签（v1.52 抽取为公共函数）
function faWlMetaJudgeDone(entry) {
    var nameOk = !!(entry.name && entry.name !== ('App ' + entry.appid));
    // v1.60：已确认未发售（isComingSoon）的游戏可以合法无价格，视为价格已知，
    // 否则未发售无价格游戏永远 _metaDone=false，每次打开面板都会重复补全
    var priceOk = entry.isFree === true || (Number(entry.finalPrice) > 0) || entry.isComingSoon === true;
    var tagsOk = Array.isArray(entry.tags) && entry.tags.length > 0;
    entry._metaDone = nameOk && priceOk && tagsOk;
}

// 将 StoreItem 缓存数据应用到条目（补全名称/价格/标签/类型）
function faWlApplyStoreItem(entry, storeData, tagNameMap) {
    if (!entry || !storeData) return;
    var di = storeData.default_info;
    if (di) {
        if (di.name && (!entry.name || entry.name === ('App ' + entry.appid))) entry.name = String(di.name);
        if (typeof di.type === 'number') {
            var typeMap = { 0: 'game', 1: 'dlc', 2: 'software', 3: 'video', 4: 'series', 6: 'music', 7: 'tool', 8: 'video_series' };
            entry.type = typeMap[di.type] || 'other';
        } else if (di.type) {
            entry.type = String(di.type).toLowerCase();
        }
        if (di.is_free === true) entry.isFree = true;
        var bpo = di.best_purchase_option;
        if (bpo) {
            var finalCents = Number(bpo.final_price_in_cents) || 0;
            var originalCents = Number(bpo.original_price_in_cents) || 0;
            entry.finalPrice = finalCents / 100;
            entry.originalPrice = (originalCents > 0 ? originalCents : finalCents) / 100;
            entry.discountPct = Number(bpo.discount_pct || bpo.bundle_discount_pct || 0);
            // v1.43：有折扣但原价缺失/不合法时，由折扣价反推原价
            if (entry.discountPct > 0 && entry.discountPct < 100 && entry.originalPrice <= entry.finalPrice) {
                entry.originalPrice = entry.finalPrice / (1 - entry.discountPct / 100);
            }
            if (finalCents === 0 && entry.discountPct === 0) entry.isFree = true;
            // v1.60 修复（参考 1.0.8）：active_discounts 无 pct 字段但代表折扣事实，纳入 onSale，
            // 否则仅按 discountPct>0 统计会漏掉此类促销游戏
            entry.onSale = entry.discountPct > 0 || !!(bpo.active_discounts && bpo.active_discounts.length);
        }
    }
    // v1.60 修复（参考 1.0.8 buildItemFromStoreCache）：发售状态权威判定——
    // default_info.is_coming_soon 是权威字段（实测：未发售=true，已发售无此键），
    // 其次 include_release 的 is_coming_soon / steam_release_date 未来时间戳；
    // default_info 或 include_release 任一存在即代表发售状态已知（可回退 true→false，纠正旧缓存）
    var rel = storeData.include_release || null;
    var rdTs = rel ? (Number(rel.steam_release_date) || 0) : 0;
    var soon = (di && di.is_coming_soon === true) || (rel && rel.is_coming_soon === true);
    if (!soon && rdTs * 1000 > Date.now()) soon = true;
    if (di || rel) {
        entry.isComingSoon = !!soon;
        entry._releaseKnown = true;
        if (rdTs > 0) entry.releaseDate = new Date(rdTs * 1000).toISOString().slice(0, 10);
    }
    // top_tags -> 标签名列表
    var tt = storeData.top_tags;
    if (Array.isArray(tt) && tt.length > 0) {
        var tags = [];
        for (var ti = 0; ti < tt.length; ti++) {
            var t = tt[ti];
            if (!t) continue;
            if (t.name) tags.push(t.name);
            else if (t.tagid != null && tagNameMap[t.tagid]) tags.push(tagNameMap[t.tagid]);
        }
        if (tags.length > 0) entry.tags = tags.filter(Boolean).slice(0, 20);
    }
    // v1.42 修复：仅当名称/价格/标签均齐备时才标记完成。
    // SSR StoreItem 缓存可能只有部分子查询（如仅有 top_tags 而无 default_info），
    // 之前无条件标记 _metaDone 会导致后台 appdetails 补全被跳过，名称永远停留在占位符。
    faWlMetaJudgeDone(entry);
}

// 来源1：从愿望单页面 HTML 抓取 SSR 数据（主来源，最可靠）
function faWlFetchFromPage(steamid) {
    return new Promise(function(resolve) {
        var isProfileId = /^\d{17}$/.test(String(steamid));
        var url = isProfileId
            ? 'https://store.steampowered.com/wishlist/profiles/' + steamid + '/'
            : 'https://store.steampowered.com/wishlist/id/' + steamid + '/';
        faCompat.optionalRequest({
            method: 'GET',
            url: url,
            timeout: 30000,
            onload: function(resp) {
                if (resp.status < 200 || resp.status >= 300 || !resp.responseText) {
                    console.warn('[FA-WL] 页面抓取失败: HTTP', resp.status);
                    resolve(null);
                    return;
                }
                var queries = faWlExtractQueryDataFromText(resp.responseText);
                if (!queries) {
                    console.warn('[FA-WL] 页面未找到 SSR queryData');
                    resolve(null);
                    return;
                }
                var data = faWlExtractFromQueries(queries);
                console.log('[FA-WL] SSR: ' + data.entries.length + ' 条目, ' + Object.keys(data.storeItemCache).length + ' 详情');
                if (data.entries.length === 0) { resolve(null); return; }
                resolve(data);
            },
            onerror: function() { console.warn('[FA-WL] 页面网络错误'); resolve(null); },
            ontimeout: function() { console.warn('[FA-WL] 页面请求超时'); resolve(null); }
        });
    });
}

// v1.66：统一 API 调用层 — 封装 GM_xmlhttpRequest 带重试机制（参考 steam-friend-manager requestSteamAPI）
function faGmFetchRetry(url, options) {
    options = options || {};
    var timeout = options.timeout || 20000;
    var maxRetries = options.retries || 2;
    var method = options.method || 'GET';
    return new Promise(function(resolve, reject) {
        var attempt = 0;
        var safeUrl = faCompat.redactUrl(url);
        function requestError(code, message, status) {
            var error = new Error(message);
            error.code = code;
            if (status != null) error.status = status;
            return error;
        }
        function doRequest() {
            try {
                faCompat.gmRequest({
                    method: method,
                    url: url,
                    timeout: timeout,
                    onload: function(resp) {
                    if (resp.status === 401 || resp.status === 403) {
                        reject(requestError('AUTH', 'Steam 登录状态或访问令牌已失效', resp.status));
                        return;
                    }
                    if (resp.status === 429 || resp.status >= 500) {
                        attempt++;
                        if (attempt <= maxRetries) {
                            console.warn('[FA] HTTP ' + resp.status + '，第 ' + attempt + ' 次重试:', safeUrl);
                            setTimeout(doRequest, attempt * 1500);
                            return;
                        }
                        reject(requestError(resp.status === 429 ? 'RATE_LIMIT' : 'SERVER', 'HTTP ' + resp.status, resp.status));
                        return;
                    }
                    if (resp.status < 200 || resp.status >= 300) {
                        reject(requestError('NETWORK', 'HTTP ' + resp.status, resp.status));
                        return;
                    }
                    try {
                        resolve(JSON.parse(resp.responseText));
                    } catch (e) {
                        console.warn('[FA] JSON 解析失败:', safeUrl, e);
                        reject(requestError('INVALID_JSON', 'JSON parse failed'));
                    }
                },
                onerror: function(err) {
                    if (err && err.code === 'PERMISSION') { reject(err); return; }
                    attempt++;
                    if (attempt <= maxRetries) {
                        console.warn('[FA] 请求失败，第 ' + attempt + ' 次重试:', safeUrl);
                        setTimeout(doRequest, attempt * 1000);
                    } else {
                        var networkError = requestError('NETWORK', (err && err.message) || 'network error');
                        reject(networkError);
                    }
                },
                ontimeout: function() {
                    attempt++;
                    if (attempt <= maxRetries) {
                        console.warn('[FA] 请求超时，第 ' + attempt + ' 次重试:', safeUrl);
                        setTimeout(doRequest, attempt * 1000);
                    } else {
                        reject(requestError('TIMEOUT', 'timeout'));
                    }
                }
                });
            } catch (error) {
                reject(error && error.code ? error : requestError('NETWORK', (error && error.message) || 'request failed'));
            }
        }
        doRequest();
    });
}

// v1.60：GM_xmlhttpRequest 的 Promise 封装（JSON），失败/超时/解析错误一律 resolve(null)
function faGmGetJson(reqUrl, timeoutMs) {
    return new Promise(function(resolve) {
        faCompat.optionalRequest({
            method: 'GET',
            url: reqUrl,
            timeout: timeoutMs || 20000,
            onload: function(resp) {
                if (resp.status < 200 || resp.status >= 300) { resolve(null); return; }
                try { resolve(JSON.parse(resp.responseText)); } catch (e) { resolve(null); }
            },
            onerror: function() { resolve(null); },
            ontimeout: function() { resolve(null); }
        });
    });
}

// v1.60 提速（参考 Steam-Wishlist-Sidebar 1.0.9 fetchAllWishlistDataPages）：
// 并发波次拉取 wishlistdata 全部分页（每波 4 页并行），替代串行逐页 + 300ms 等待。
// 单页失败/为空即视为已到末页（与原逻辑一致）；返回按 appid 去重的原始 {appid, info} 列表。
function faWlFetchAllApiPages(base, maxPages) {
    var WAVE = 4;
    var all = [];
    var seen = {};
    function fetchOne(p) {
        return faGmGetJson(base + '?p=' + p, 20000).then(function(data) { return { p: p, d: data }; });
    }
    function wave(page) {
        if (page >= maxPages) return Promise.resolve(all);
        var batch = [];
        for (var i = 0; i < WAVE && page + i < maxPages; i++) batch.push(page + i);
        return Promise.all(batch.map(fetchOne)).then(function(results) {
            results.sort(function(a, b) { return a.p - b.p; });
            var done = false;
            for (var ri = 0; ri < results.length; ri++) {
                if (done) break;
                var d = results[ri].d;
                if (!d || (typeof d === 'object' && Object.keys(d).length === 0)) { done = true; break; }
                var items = Array.isArray(d) ? d : Object.entries(d);
                if (items.length === 0) { done = true; break; }
                items.forEach(function(item) {
                    var appid, info;
                    if (Array.isArray(item)) {
                        appid = Number(item[0]);
                        info = item[1];
                    } else {
                        appid = Number(item.appid);
                        info = item;
                    }
                    if (!appid || isNaN(appid) || !info || seen[appid]) return;
                    seen[appid] = true;
                    all.push({ appid: appid, info: info });
                });
            }
            if (done) return all;
            return wave(page + WAVE);
        });
    }
    return wave(0);
}

// 来源2：wishlistdata JSON API 分页（补充名称/价格/标签/类型）
// v1.52：① 兼容新版 best_purchase_option 价格格式（旧版 subs 仍保留解析，与参考脚本 normalizeWishlistEntry 对齐）
//        ② profiles/id 路径按 steamid 形态自适应（17位 SteamID64 用 profiles，自定义 ID 用 id）
function faWlFetchFromApi(steamid) {
    var maxPages = 60;
    var isProfileId = /^\d{17}$/.test(String(steamid));
    var base = isProfileId
        ? 'https://store.steampowered.com/wishlist/profiles/' + steamid + '/wishlistdata/'
        : 'https://store.steampowered.com/wishlist/id/' + steamid + '/wishlistdata/';
    // v1.60：并发波次拉页（原串行 300ms/页是多成员愿望单加载慢的主因之一）
    return faWlFetchAllApiPages(base, maxPages).then(function(raws) {
        return raws.map(function(r) { return faWlParseApiEntry(r.appid, r.info); });
    });
}

// v1.60：从 faWlFetchFromApi 抽出的单条解析（价格/折扣/发售状态权威判定，便于复用与测试）
function faWlParseApiEntry(appid, info) {
    var finalPrice = 0, originalPrice = 0, discountPct = 0, isFree = false, onSale = false;
    // v1.60 修复（参考 1.0.8）：旧格式只读 subs[0] 会漏掉折扣在非首个购买选项的游戏，改取折扣最大的 sub
    if (info.subs && info.subs.length > 0) {
        var sub = info.subs[0];
        for (var si = 0; si < info.subs.length; si++) {
            if ((Number(info.subs[si].discount_pct) || 0) > (Number(sub.discount_pct) || 0)) sub = info.subs[si];
        }
        finalPrice = (Number(sub.price) || 0) / 100;
        discountPct = Number(sub.discount_pct) || 0;
        originalPrice = (discountPct > 0 && discountPct < 100) ? finalPrice / (1 - discountPct / 100) : finalPrice;
        isFree = Number(sub.price) === 0;
    }
    // 新格式：best_purchase_option（单位：分）
    var bpo = info.best_purchase_option;
    if (bpo) {
        finalPrice = (Number(bpo.final_price_in_cents) || 0) / 100;
        originalPrice = (Number(bpo.original_price_in_cents) || 0) / 100;
        if (originalPrice <= 0) originalPrice = finalPrice;
        discountPct = Number(bpo.discount_pct || bpo.bundle_discount_pct || 0);
        if (discountPct > 0 && discountPct < 100 && originalPrice <= finalPrice) {
            originalPrice = finalPrice / (1 - discountPct / 100);
        }
        if (finalPrice === 0 && discountPct === 0) isFree = true;
        // v1.60 修复（参考 1.0.8）：active_discounts 无 pct 字段但代表折扣事实
        onSale = discountPct > 0 || !!(bpo.active_discounts && bpo.active_discounts.length);
    }
    if (!isFinite(finalPrice) || finalPrice < 0) finalPrice = 0;
    if (!isFinite(originalPrice) || originalPrice < 0) originalPrice = finalPrice;
    if (!isFinite(discountPct) || discountPct < 0 || discountPct > 100) discountPct = 0;
    if (discountPct > 0) onSale = true;
    // v1.60 修复（参考 1.0.8 applyApiInfoToItem）：发售状态多源权威判定——
    // is_coming_soon 字段 / release_date 未来时间戳 / release_string 未发售措辞
    //（即将推出/Coming Soon/TBA/Q3 等），且可回退 true→false（游戏已发售时纠正旧缓存）
    var rdTs = Number(info.release_date) || 0;
    var relStr = (typeof info.release_string === 'string') ? info.release_string : '';
    var soon = info.is_coming_soon === true;
    if (!soon && rdTs * 1000 > Date.now()) soon = true;
    if (!soon && relStr && /即将推出|即将宣布|coming soon|to be announced|\btba\b|\btbd\b|\bq[1-4]\b|summer|winter|spring|fall|autumn|^\s*\d{4}\s*$|年第[一二三四1-4]季度|[春夏秋冬]季/i.test(relStr)) soon = true;
    var relKnown = (typeof info.is_coming_soon !== 'undefined') || rdTs > 0 || soon;
    var entry = {
        appid: appid,
        name: (info.name && String(info.name).trim()) || ('App ' + appid),
        priority: Number(info.priority) || 0,
        addedDate: Number(info.date_added) || 0,
        finalPrice: finalPrice,
        originalPrice: originalPrice,
        discountPct: discountPct,
        onSale: onSale,
        isFree: !!info.is_free || isFree,
        isComingSoon: false,
        releaseDate: '',
        _releaseKnown: false,
        type: String(info.type || '').toLowerCase(),
        tags: (info.tags || []).map(function(t) {
            return typeof t === 'string' ? t : (t.name || '');
        }).filter(Boolean).slice(0, 20),
        _metaDone: false
    };
    if (relKnown) {
        entry.isComingSoon = !!soon;
        entry._releaseKnown = true;
        if (rdTs > 0) entry.releaseDate = new Date(rdTs * 1000).toISOString().slice(0, 10);
    }
    return entry;
}

// ===================== 用户主货币检测（v1.43） =====================
// 参考 Steam-Spending-History-Classifier 的主货币思路：
// 优先读取 g_rgWalletInfo.wallet_currency（Steam 钱包货币数字代码），
// 其次读取 application_config 的 country_code 推断，默认 CNY。
var faCurrency = { id: 'CNY', symbol: '¥', cc: 'cn' };
// v1.92: Steam appdetails 返回的 currency 代码→符号映射
// SGLVAppDetail.loadDetail 用 cc=cn 请求,但 Steam 可能对登录用户忽略 cc= 参数,
// 返回用户实际所在地区的价格(如 INR),需根据 currency 字段选择正确符号
function faCurrencySymbol(code) {
    var map = {
        'CNY':'¥','USD':'$','EUR':'€','GBP':'£','JPY':'¥','KRW':'₩',
        'INR':'₹','RUB':'₽','BRL':'R$','TRY':'₺','AUD':'A$','CAD':'C$',
        'HKD':'HK$','TWD':'NT$','SGD':'S$','THB':'฿','MYR':'RM','PHP':'₱',
        'IDR':'Rp','VND':'₫','MXN':'Mex$','ARS':'ARS$','CLP':'CLP$','COP':'COL$',
        'PEN':'S/','ZAR':'R','UAH':'₴','PLN':'zł','NOK':'kr','CHF':'CHF ',
        'NZD':'NZ$','SAR':'SR','AED':'AED ','ILS':'₪','KZT':'₸','QAR':'QR',
        'KWD':'KD','CRC':'₡','UYU':'$U'
    };
    return map[String(code || '').toUpperCase()] || '¥';
}
function faDetectUserCurrency() {
    // Steam ECurrencyCode → [货币代码, 符号, 国家代码]
    var codeMap = {
        1: ['USD', '$', 'us'], 2: ['GBP', '£', 'gb'], 3: ['EUR', '€', 'eu'], 4: ['CHF', 'CHF ', 'ch'],
        5: ['RUB', '₽', 'ru'], 6: ['PLN', 'zł', 'pl'], 7: ['BRL', 'R$', 'br'], 8: ['JPY', '¥', 'jp'],
        9: ['NOK', 'kr', 'no'], 10: ['IDR', 'Rp', 'id'], 11: ['MYR', 'RM', 'my'], 12: ['PHP', '₱', 'ph'],
        13: ['SGD', 'S$', 'sg'], 14: ['THB', '฿', 'th'], 15: ['VND', '₫', 'vn'], 16: ['KRW', '₩', 'kr'],
        17: ['TRY', '₺', 'tr'], 18: ['UAH', '₴', 'ua'], 19: ['MXN', 'Mex$', 'mx'], 20: ['CAD', 'C$', 'ca'],
        21: ['AUD', 'A$', 'au'], 22: ['NZD', 'NZ$', 'nz'], 23: ['CNY', '¥', 'cn'], 24: ['INR', '₹', 'in'],
        25: ['CLP', 'CLP$', 'cl'], 26: ['PEN', 'S/', 'pe'], 27: ['COP', 'COL$', 'co'], 28: ['ZAR', 'R', 'za'],
        29: ['HKD', 'HK$', 'hk'], 30: ['TWD', 'NT$', 'tw'], 31: ['SAR', 'SR', 'sa'], 32: ['AED', 'AED ', 'ae'],
        34: ['ARS', 'ARS$', 'ar'], 35: ['ILS', '₪', 'il'], 37: ['KZT', '₸', 'kz'], 38: ['KWD', 'KD', 'kw'],
        39: ['QAR', 'QR', 'qa'], 40: ['CRC', '₡', 'cr'], 41: ['UYU', '$U', 'uy']
    };
    try {
        var walletInfo = faCompat.resolveGlobal('g_rgWalletInfo');
        if (walletInfo && walletInfo.wallet_currency) {
            var hit = codeMap[Number(walletInfo.wallet_currency)];
            if (hit) { faCurrency = { id: hit[0], symbol: hit[1], cc: hit[2] }; return; }
        }
    } catch (e) {}
    // 国家代码 → [货币代码, 符号]
    var ccMap = {
        cn: ['CNY', '¥'], hk: ['HKD', 'HK$'], tw: ['TWD', 'NT$'], jp: ['JPY', '¥'], kr: ['KRW', '₩'],
        us: ['USD', '$'], gb: ['GBP', '£'], uk: ['GBP', '£'], eu: ['EUR', '€'], de: ['EUR', '€'], fr: ['EUR', '€'],
        ru: ['RUB', '₽'], br: ['BRL', 'R$'], in: ['INR', '₹'], ca: ['CAD', 'C$'], au: ['AUD', 'A$'],
        nz: ['NZD', 'NZ$'], tr: ['TRY', '₺'], mx: ['MXN', 'Mex$'], ar: ['ARS', 'ARS$'], cl: ['CLP', 'CLP$'],
        th: ['THB', '฿'], sg: ['SGD', 'S$'], my: ['MYR', 'RM'], id: ['IDR', 'Rp'], ph: ['PHP', '₱'],
        vn: ['VND', '₫'], za: ['ZAR', 'R'], ua: ['UAH', '₴'], pl: ['PLN', 'zł'], no: ['NOK', 'kr'],
        ch: ['CHF', 'CHF '], sa: ['SAR', 'SR'], ae: ['AED', 'AED '], il: ['ILS', '₪'], co: ['COP', 'COL$'],
        pe: ['PEN', 'S/'], kz: ['KZT', '₸']
    };
    var cc = faCompat.storeCountryCode();
    if (cc && ccMap[cc]) { faCurrency = { id: ccMap[cc][0], symbol: ccMap[cc][1], cc: cc }; }
}

// ===================== 游戏中文名获取（参考 steam-friend-manager-1.1.2 fetchGameZhName） =====================
// 通过 store.steampowered.com/api/appdetails?l=schinese 获取简体中文名称，
// 带跨会话持久缓存（30天 TTL）和内存级防重复请求（pending Map），
// 供家庭库游戏列表、游玩动态、家庭愿望单等面板异步替换英文名。
var FA_GAME_NAME_KEY = 'faGameNameCache';
var FA_NAME_CACHE_TTL = 30 * 864e5; // 30天过期
var _faGameNameCache = null;
var _faGameNamePending = new Map();
// v1.81: faGameNameCache 迁移 IDB(避免 GM_setValue 大对象全量序列化卡顿)
function faGameNameCacheLoad() {
    if (_faGameNameCache !== null) return _faGameNameCache;
    _faGameNameCache = {};
    // 优先从 IDB 读(快速 + 容量无限制)
    try {
        var idbVal = faIDB.get(FA_GAME_NAME_KEY, null);
        if (idbVal && typeof idbVal === 'object') {
            _faGameNameCache = idbVal;
            return _faGameNameCache;
        }
    } catch (e) {}
    // 兜底从 GM 读(旧版本),读后迁移到 IDB
    try {
        var raw = GM_getValue(FA_GAME_NAME_KEY);
        if (raw && typeof raw === 'object') {
            _faGameNameCache = raw;
            // 一次性迁移到 IDB
            try { faIDB.set(FA_GAME_NAME_KEY, _faGameNameCache); } catch (e) {}
        }
    } catch (e) {}
    return _faGameNameCache;
}
var _faGameNameSaveTimer = null;
function faGameNameCacheSave() {
    // v1.81: 防抖 200ms 批量写(避免短时间内多次 GM_setValue 全量序列化大对象)
    // IDB 写入仍是异步非阻塞,GM 写保留作冷备但已防抖
    if (_faGameNameSaveTimer) clearTimeout(_faGameNameSaveTimer);
    _faGameNameSaveTimer = setTimeout(function() {
        _faGameNameSaveTimer = null;
        try { faIDB.set(FA_GAME_NAME_KEY, _faGameNameCache || {}); } catch (e) {}
        try { GM_setValue(FA_GAME_NAME_KEY, _faGameNameCache || {}); } catch (e) {}
    }, 200);
}
// 获取游戏中文名（异步，返回 Promise<string>，空字符串表示获取失败）
function faFetchGameZhName(appid) {
    var id = String(appid);
    var cache = faGameNameCacheLoad();
    var cached = cache[id];
    if (cached && cached.name && Date.now() - (cached.ts || 0) < FA_NAME_CACHE_TTL) {
        return Promise.resolve(cached.name);
    }
    if (_faGameNamePending.has(id)) return _faGameNamePending.get(id);
    var p = new Promise(function(resolve) {
        faCompat.optionalRequest({
            method: 'GET',
            url: 'https://store.steampowered.com/api/appdetails?appids=' + id + '&l=schinese',
            timeout: 10000,
            onload: function(resp) {
                var name = '';
                try {
                    var json = JSON.parse(resp.responseText);
                    var d = json && json[id];
                    if (d && d.success && d.data && d.data.name) name = d.data.name;
                } catch (e) { console.warn('[FA] 游戏名称解析失败:', id, e); }
                if (name) {
                    cache[id] = { name: name, ts: Date.now() };
                    faGameNameCacheSave();
                }
                _faGameNamePending.delete(id);
                resolve(name);
            },
            onerror: function() { _faGameNamePending.delete(id); resolve(''); },
            ontimeout: function() { _faGameNamePending.delete(id); resolve(''); }
        });
    });
    _faGameNamePending.set(id, p);
    return p;
}
// 异步加载中文名并更新 DOM 元素（参考 steam-friend-manager loadGameZhName）
// el: 显示游戏名的元素；appid: 游戏ID；originalName: 当前显示的名称
function faLoadGameZhName(el, appid, originalName) {
    if (!el || !appid) return;
    faFetchGameZhName(appid).then(function(zhName) {
        if (zhName && zhName !== originalName) {
            el.textContent = zhName;
            el.title = zhName + ' (' + originalName + ')';
            // v1.55 修复：占位名称（App xxxxxx / 空）异步加载到真实中文名后，
            // 清除占位内联样式（灰色斜体 #64748b），让 .fa-wl-name 等类的正式样式生效。
            // 仅对占位名称精确匹配生效，不影响购买动态/游玩动态等已具备真实名称的元素。
            if (!originalName || originalName === ('App ' + appid)) {
                el.style.color = '';
                el.style.fontStyle = '';
                el.style.fontWeight = '';
            }
        }
    });
}

// ===================== 游戏封面图多 CDN fallback（参考 steam-friend-manager dashLoadCapsule） =====================
// v1.57: 封面图 fallback 链（依次尝试，任一成功即停止）：
//   1. capsule_467x181.jpg  (cloudflare steam/apps) — 大横幅，最清晰
//   2. capsule_231x87.jpg   (cloudflare steam/apps) — 中等横幅
//   3. capsule_231x87.png   (cloudflare steam/apps) — PNG 版本
//   4. capsule_184x69.jpg   (cloudflare steam/apps) — 标准横幅，最通用
//   5. capsule_184x69.png   (cloudflare steam/apps) — PNG 版本
//   6. header.jpg           (cloudflare steam/apps) — 头图兜底
//   7. capsule_184x69.jpg   (akamai store_item_assets) — Akamai 兜底
//   8. header.jpg           (akamai store_item_assets) — Akamai 兜底
//   9. Steam API appdetails capsule_image / header_image
//  10. SVG placeholder（淡紫色 Steam 图标）
var _faCoverGood = new Map();   // appid → 已验证可用的封面 URL（跨标签页共享）
var _faCoverApiCache = new Map(); // appid → API 返回的 capsule_image URL
var _faCoverApiPending = new Map();
var FA_COVER_SVG = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">'
    + '<rect width="28" height="28" fill="#1b2838" rx="4"/>'
    + '<circle cx="14" cy="11" r="5" fill="none" stroke="#7c3aed" stroke-width="1.5"/>'
    + '<path d="M6 24c0-4 3.6-7 8-7s8 3 8 7" fill="none" stroke="#7c3aed" stroke-width="1.5"/>'
    + '</svg>'
);
// v1.58：成员头像占位图（圆形剪影，参考 steam-friend-manager 默认头像风格）
var FA_AVATAR_SVG = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">'
    + '<rect width="36" height="36" fill="#1b2838"/>'
    + '<circle cx="18" cy="14" r="6" fill="none" stroke="#475569" stroke-width="1.5"/>'
    + '<path d="M7 33c0-5 4.5-9 11-9s11 4 11 9" fill="none" stroke="#475569" stroke-width="1.5"/>'
    + '</svg>'
);
// v1.58：根据名称生成唯一不变的背景色（基于字符串 hash → HSL 色相）
// 同名用户始终得到相同颜色；首字相同但全名不同的用户也能通过全名 hash 区分
function faNameAvatarColor(str) {
    var s = String(str || '?');
    var hash = 0;
    for (var i = 0; i < s.length; i++) {
        hash = s.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash; // 转 32 位整数
    }
    var hue = Math.abs(hash) % 360;
    return 'hsl(' + hue + ',55%,45%)';
}
// v1.58：根据名称生成圆形头像 HTML（首字 + 唯一背景色）
// name: 成员名称  size: 直径 px  extra: 额外 style/属性
// 注意：此函数在 IIFE 外层定义，不能调用内部的 faEsc，内联转义
function faNameAvatarHtml(name, size, extra) {
    var s = String(name || '?');
    var ch = s.charAt(0).toUpperCase().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    var bg = faNameAvatarColor(s);
    var fs = Math.max(9, Math.floor(size * 0.5));
    var ex = extra || '';
    return '<span class="fa-name-avatar" style="display:inline-flex;align-items:center;justify-content:center;width:'
        + size + 'px;height:' + size + 'px;border-radius:50%;background:' + bg + ';color:#fff;font-size:'
        + fs + 'px;font-weight:700;flex-shrink:0;overflow:hidden;' + ex + '">' + ch + '</span>';
}
function faFetchCoverFromApi(appid) {
    var id = String(appid);
    if (_faCoverApiCache.has(id)) return Promise.resolve(_faCoverApiCache.get(id));
    if (_faCoverApiPending.has(id)) return _faCoverApiPending.get(id);
    var p = new Promise(function(resolve) {
        faCompat.optionalRequest({
            method: 'GET',
            url: 'https://store.steampowered.com/api/appdetails?appids=' + id,
            timeout: 10000,
            onload: function(resp) {
                var url = '';
                try {
                    var json = JSON.parse(resp.responseText);
                    var d = json && json[id];
                    if (d && d.success && d.data) {
                        if (d.data.capsule_image) url = d.data.capsule_image;
                        else if (d.data.header_image) url = d.data.header_image;
                    }
                } catch (e) { console.warn('[FA] 封面图解析失败:', id, e); }
                _faCoverApiCache.set(id, url);
                _faCoverApiPending.delete(id);
                resolve(url);
            },
            onerror: function() { _faCoverApiPending.delete(id); resolve(''); },
            ontimeout: function() { _faCoverApiPending.delete(id); resolve(''); }
        });
    });
    _faCoverApiPending.set(id, p);
    return p;
}
// v1.57: 封面图 CDN 路径列表（参考 steam-friend-manager DASH_CAPSULE_PATHS）
// 使用更通用的封面尺寸，解决大面积封面无法获取问题
var FA_COVER_CF = 'https://cdn.cloudflare.steamstatic.com/steam/apps/';
var FA_COVER_AKAMAI = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/';
var FA_COVER_PATHS = [
    'capsule_467x181.jpg',   // 大横幅封面（最清晰）
    'capsule_231x87.jpg',    // 中等横幅
    'capsule_231x87.png',    // PNG 版本
    'capsule_184x69.jpg',    // 标准横幅（最通用）
    'capsule_184x69.png',    // PNG 版本
    'header.jpg'             // 头图兜底
];
// 为 <img> 元素加载封面图，自动遍历多 CDN fallback 链
// img: <img> 元素；appid: 游戏ID
function faLoadCover(img, appid) {
    if (!img || !appid) return;
    var id = String(appid);
    var chain = [];
    // 优先使用已验证可用的 URL
    if (_faCoverGood.has(id)) chain.push(_faCoverGood.get(id));
    // v1.57: 参考 steam-friend-manager，先用 cloudflare CDN 遍历所有封面路径
    FA_COVER_PATHS.forEach(function(p) { chain.push(FA_COVER_CF + id + '/' + p); });
    // 再用 akamai CDN 兜底（store_item_assets 路径）
    chain.push(FA_COVER_AKAMAI + id + '/capsule_184x69.jpg');
    chain.push(FA_COVER_AKAMAI + id + '/header.jpg');
    var idx = 0;
    img.onload = function() {
        // 记录成功 URL，下次直接用
        if (img.src && img.src.indexOf('data:image') !== 0) _faCoverGood.set(id, img.src);
    };
    function toPlaceholder() {
        img.onload = null;
        img.onerror = null;
        img.src = FA_COVER_SVG;
    }
    function tryNext() {
        if (idx >= chain.length) {
            // 所有 CDN 路径都失败，尝试 Steam API
            faFetchCoverFromApi(id).then(function(url) {
                if (url) { img.onerror = toPlaceholder; img.src = url; }
                else toPlaceholder();
            }).catch(toPlaceholder);
            return;
        }
        img.onerror = function() { idx++; tryNext(); };
        img.src = chain[idx];
    }
    tryNext();
}


// v1.78：家庭愿望单持久化缓存（GM_setValue），TTL 8小时。
// 参考 GM_Docs 最佳实践：GM_setValue/GM_getValue 可跨页面刷新持久化存储。
// 双层缓存架构：L1=window 级（wlCache，同页面秒级访问），L2=GM_setValue 级（跨刷新持久化）。
// 首次打开面板：L1 未命中 → 检查 L2 → L2 命中且未过期则直接渲染（后台静默刷新补全元数据）→ 否则全量抓取。
var FA_WL_DATA_KEY = 'faWishlistDataCache';
var FA_WL_DATA_TTL = 8 * 60 * 60 * 1000; // 8小时
function faWlDataLoad() {
    try {
        var raw = GM_getValue(FA_WL_DATA_KEY);
        if (raw && typeof raw === 'object' && raw.data && raw.updatedAt) {
            return raw;
        }
    } catch (e) {}
    return null;
}
function faWlDataSave(data, familyGroupId) {
    try {
        // 精简存储：仅保留 GameList（appid 数组）与 GameInfo 的必要字段，避免超出 GM 存储限制
        var slim = { GameList: data.GameList, GameInfo: {} };
        if (data.GameInfo) {
            for (var k in data.GameInfo) {
                var gi = data.GameInfo[k];
                if (!gi) continue;
                slim.GameInfo[k] = {
                    appid: gi.appid, name: gi.name, wishers: gi.wishers || [],
                    finalPrice: gi.finalPrice || 0, originalPrice: gi.originalPrice || 0,
                    discountPct: gi.discountPct || 0, onSale: !!gi.onSale, isFree: !!gi.isFree,
                    isComingSoon: !!gi.isComingSoon, releaseDate: gi.releaseDate || '',
                    _releaseKnown: !!gi._releaseKnown, type: gi.type || '', tags: gi.tags || [],
                    addedDate: gi.addedDate || 0, priority: gi.priority || 0,
                    inLibrary: !!gi.inLibrary, _metaDone: !!gi._metaDone
                };
            }
        }
        GM_setValue(FA_WL_DATA_KEY, { data: slim, updatedAt: Date.now(), gid: familyGroupId || '' });
    } catch (e) { console.warn('[FA] 愿望单持久化缓存写入失败:', e); }
}
function faWlDataClear() {
    try { GM_deleteValue(FA_WL_DATA_KEY); } catch (e) {}
}

// 缓存 appid → {n,fp,op,dp,f,t,g,ts}，TTL 24h；
// 避免每次打开页面都重新跑 80+ 批 appdetails 补全，是加载提速的主要来源。
var FA_WL_META_KEY = 'faWlMetaCache';
var FA_WL_META_TTL = 24 * 60 * 60 * 1000;
var faWlMetaCache = null; // 懒加载，避免影响脚本启动
function faWlMetaLoad() {
    if (faWlMetaCache !== null) return faWlMetaCache;
    faWlMetaCache = {};
    try {
        var raw = GM_getValue(FA_WL_META_KEY);
        if (raw && typeof raw === 'object') faWlMetaCache = raw;
    } catch (e) {}
    return faWlMetaCache;
}
function faWlMetaSave() {
    if (!faWlMetaCache) return;
    try {
        var now = Date.now();
        var pruned = {};
        for (var k in faWlMetaCache) {
            var r = faWlMetaCache[k];
            if (r && r.ts && (now - r.ts < FA_WL_META_TTL * 2)) pruned[k] = r; // 顺带清理过期条目
        }
        faWlMetaCache = pruned;
        GM_setValue(FA_WL_META_KEY, faWlMetaCache);
    } catch (e) {}
}
// 将缓存元数据应用到条目；返回 true 表示条目已具备完整名称
function faWlMetaApply(appid, entry) {
    var mc = faWlMetaLoad();
    var r = mc[appid];
    if (!r || !r.ts || (Date.now() - r.ts > FA_WL_META_TTL)) return false;
    if (r.n) entry.name = r.n;
    entry.finalPrice = r.fp || 0;
    entry.originalPrice = r.op || 0;
    entry.discountPct = r.dp || 0;
    entry.onSale = !!r.os;
    entry.isFree = !!r.f;
    if (r.t) entry.type = r.t;
    if (Array.isArray(r.g)) entry.tags = r.g;
    // v1.60：发售状态字段（旧版缓存无此字段 → _releaseKnown=false → 触发一次后台补全迁移，
    // 与 1.0.8 "旧缓存缺 _releaseKnown 强制重建一次" 同理）
    entry.isComingSoon = !!r.cs;
    entry.releaseDate = r.rd || '';
    entry._releaseKnown = (r.rk === 1 || r.rk === true);
    faWlMetaJudgeDone(entry);
    return !!r.n;
}
// 将最新数据写入缓存；返回 true 表示发生了变更（用于决定是否落盘）
function faWlMetaUpdate(appid, src) {
    var mc = faWlMetaLoad();
    var old = mc[appid];
    if (old && old.ts && (Date.now() - old.ts < FA_WL_META_TTL)
        && old.n === (src.name || '') && old.fp === (src.finalPrice || 0) && old.dp === (src.discountPct || 0)) {
        return false; // 新鲜且关键字段一致，无需写入
    }
    mc[appid] = { n: src.name || '', fp: src.finalPrice || 0, op: src.originalPrice || 0, dp: src.discountPct || 0, os: src.onSale ? 1 : 0, f: !!src.isFree, t: src.type || '', g: Array.isArray(src.tags) ? src.tags.slice(0, 20) : [], cs: src.isComingSoon ? 1 : 0, rd: src.releaseDate || '', rk: src._releaseKnown ? 1 : 0, ts: Date.now() };
    return true;
}

// 主入口：多源合并拉取成员愿望单
// 返回 [{appid, name, priority, addedDate, finalPrice, originalPrice, discountPct, isFree, type, tags, _metaDone}]
function fetchMemberWishlist(steamid) {
    return new Promise(function(resolve) {
        // v1.52 修复（参考 steam-game-library-viewer 2.3.29 loadWishlistGames）：
        // SSR 与 wishlistdata API 由"二选一"改为"并行抓取 + 字段级合并"。
        // 根因：SSR 的 StoreItem 缓存只覆盖首批可见条目（约60个），此前 SSR 成功即丢弃 API，
        // 其余条目没有任何名称来源，只能排队等后台 appdetails 补全 → 大量名称停留在占位符。
        // 合并后：API 全量名称/价格先打底，SSR 提供 priority/date_added，StoreItem 详情最后覆盖（最准）。
        Promise.all([faWlFetchFromPage(steamid), faWlFetchFromApi(steamid)]).then(function(results) {
            var ssrData = results[0];
            var apiEntries = results[1] || [];
            var ssrEntries = (ssrData && ssrData.entries) ? ssrData.entries : [];
            var storeItemCache = ssrData ? (ssrData.storeItemCache || {}) : {};
            var tagNameMap = ssrData ? (ssrData.tagNameMap || {}) : {};
            // API 条目索引（名称/价格/标签的全量来源）
            var apiMap = {};
            apiEntries.forEach(function(e) { if (e && e.appid) apiMap[e.appid] = e; });
            var result = [];
            if (ssrEntries.length > 0) {
                // 以 SSR 条目为基底（priority/date_added 最可靠）
                ssrEntries.forEach(function(ssrEntry) {
                    var appid = Number(ssrEntry.appid);
                    var entry = {
                        appid: appid,
                        name: ('App ' + appid),
                        priority: Number(ssrEntry.priority) || 0,
                        addedDate: Number(ssrEntry.added || ssrEntry.date_added) || 0,
                        finalPrice: 0, originalPrice: 0, discountPct: 0,
                        onSale: false, isFree: false,
                        isComingSoon: false, releaseDate: '', _releaseKnown: false,
                        type: 'game', tags: [], _metaDone: false
                    };
                    // ① API 填补名称/价格/标签（StoreItem 未覆盖的条目主要靠这里）
                    var api = apiMap[appid];
                    if (api) {
                        if (api.name && api.name !== ('App ' + appid)) entry.name = api.name;
                        entry.finalPrice = api.finalPrice || 0;
                        entry.originalPrice = api.originalPrice || 0;
                        entry.discountPct = api.discountPct || 0;
                        entry.onSale = !!api.onSale;
                        entry.isFree = !!api.isFree;
                        // v1.60：发售状态仅在 API 已权威判定时采纳（_releaseKnown 标记）
                        if (api._releaseKnown) {
                            entry.isComingSoon = !!api.isComingSoon;
                            entry._releaseKnown = true;
                            if (api.releaseDate) entry.releaseDate = api.releaseDate;
                        }
                        if (api.type) entry.type = api.type;
                        if (api.tags && api.tags.length > 0) entry.tags = api.tags;
                        delete apiMap[appid];
                    }
                    // ② SSR StoreItem 详情覆盖（default_info / best_purchase_option / top_tags，最准）
                    var si = storeItemCache[appid];
                    if (si) faWlApplyStoreItem(entry, si, tagNameMap);
                    faWlMetaJudgeDone(entry);
                    result.push(entry);
                });
                // ③ 防御性并入：SSR 遗漏但 API 存在的条目（罕见）
                for (var restId in apiMap) {
                    var rest = apiMap[restId];
                    faWlMetaJudgeDone(rest);
                    result.push(rest);
                }
                console.log('[FA-WL] ' + steamid + ' SSR+API 合并: ' + result.length + ' 条目（SSR ' + ssrEntries.length + ' / API ' + apiEntries.length + ' / StoreItem ' + Object.keys(storeItemCache).length + '）');
            } else if (apiEntries.length > 0) {
                apiEntries.forEach(function(e) { faWlMetaJudgeDone(e); });
                result = apiEntries;
                console.log('[FA-WL] ' + steamid + ' SSR 无数据，API 兜底: ' + result.length + ' 条目');
            } else {
                console.warn('[FA-WL] ' + steamid + ' SSR/API 均无数据');
            }
            resolve(result);
        });
    });
}

// 批量补全愿望单游戏的详情（名称、价格、标签、类型）via appdetails
// 参考 steam-game-library-viewer: 批量逗号分隔 appid 请求（25个/批），250ms间隔
// 批量请求大幅减少请求数（2000游戏：80批次 vs 2000个单独请求）
// onBatchDone(batchNew): v1.52 改为仅回传"本批新增"结果（原为累积全量，O(n²) 重复应用）
// v1.52：网络级失败（超时/错误/JSON解析失败）的条目在主流程结束后以小批量（5个/批）重试一轮，
//        修复整批失败导致 25 个游戏名称全部停留在占位符的问题；
//        HTTP 成功但 success:false 的条目为下架/锁区等真实不可用，不重试。
function enrichWishlistMeta(appids, onProgress, onBatchDone) {
    return new Promise(function(resolve) {
        var results = {};
        if (!appids || appids.length === 0) { resolve(results); return; }
        var BATCH_SIZE = 25;
        var BATCH_INTERVAL = 250;
        var completed = 0;
        var total = appids.length;
        var netFailed = {}; // aid -> true（网络级失败，值得重试）

        // 单批请求：解析响应 → 写入 results/batchNew → 回调
        function requestBatch(batch, markNetFail, doneCb) {
            var reqUrl = 'https://store.steampowered.com/api/appdetails?appids=' + batch.join(',') + '&l=schinese&cc=' + (faCurrency.cc || 'cn');
            faCompat.optionalRequest({
                method: 'GET',
                url: reqUrl,
                timeout: 30000,
                onload: function(resp) {
                    var batchNew = {};
                    var parseOk = false;
                    try {
                        var data = JSON.parse(resp.responseText);
                        parseOk = true;
                        batch.forEach(function(aid) {
                            var appData = data[String(aid)] || data[aid];
                            if (appData && appData.success && appData.data) {
                                var d = appData.data;
                                var po = d.price_overview;
                                var fPrice = po ? (Number(po.final) || 0) / 100 : 0;
                                var oPrice = po ? (Number(po.initial) || 0) / 100 : 0;
                                var discPct = po ? (Number(po.discount_percent) || 0) : 0;
                                // v1.43：有折扣但原价缺失/不合法时，由折扣价反推原价
                                if (discPct > 0 && discPct < 100 && (!oPrice || oPrice <= fPrice)) {
                                    oPrice = fPrice / (1 - discPct / 100);
                                }
                                results[aid] = {
                                    name: d.name || '',
                                    finalPrice: isNaN(fPrice) ? 0 : fPrice,
                                    originalPrice: isNaN(oPrice) ? 0 : oPrice,
                                    discountPct: discPct,
                                    onSale: discPct > 0,
                                    isFree: d.is_free || false,
                                    type: d.type || '',
                                    tags: (d.genres || []).map(function(g) { return g.description; }).filter(Boolean),
                                    // v1.60（参考 1.0.8）：release_date.coming_soon 为权威判定（可回退 true→false）
                                    isComingSoon: (d.release_date && typeof d.release_date.coming_soon !== 'undefined') ? !!d.release_date.coming_soon : false,
                                    releaseDate: (d.release_date && d.release_date.date) || '',
                                    _releaseKnown: !!(d.release_date && typeof d.release_date.coming_soon !== 'undefined')
                                };
                                batchNew[aid] = results[aid];
                                // v1.54：同步写入中文名缓存，避免 faLoadGameZhName 对已补全的游戏重复请求 appdetails
                                if (d.name) {
                                    var nc = faGameNameCacheLoad();
                                    nc[String(aid)] = { name: d.name, ts: Date.now() };
                                }
                            }
                        });
                    } catch(e){console.warn('[FA]', e)}
                    // v1.54：批量写入后统一落盘一次，避免 forEach 内每条都调 GM_setValue
                    try { faGameNameCacheSave(); } catch(e2){console.warn('[FA]', e2)}
                    if (!parseOk && markNetFail) batch.forEach(function(aid) { netFailed[aid] = true; });
                    if (onBatchDone) onBatchDone(batchNew);
                    doneCb();
                },
                onerror: function() {
                    if (markNetFail) batch.forEach(function(aid) { netFailed[aid] = true; });
                    if (onBatchDone) onBatchDone({});
                    doneCb();
                },
                ontimeout: function() {
                    if (markNetFail) batch.forEach(function(aid) { netFailed[aid] = true; });
                    if (onBatchDone) onBatchDone({});
                    doneCb();
                }
            });
        }

        // 主批量流程
        var batchIdx = 0;
        var batches = [];
        for (var i = 0; i < appids.length; i += BATCH_SIZE) {
            batches.push(appids.slice(i, i + BATCH_SIZE));
        }
        function processNextBatch() {
            if (batchIdx >= batches.length) { retryNetFailed(); return; }
            var batch = batches[batchIdx++];
            requestBatch(batch, true, function() {
                completed += batch.length;
                if (onProgress) onProgress(completed, total);
                setTimeout(processNextBatch, BATCH_INTERVAL);
            });
        }

        // v1.52：网络失败条目重试一轮（5个/批，400ms间隔）
        function retryNetFailed() {
            var failed = Object.keys(netFailed).map(Number).filter(function(aid) { return !results[aid]; });
            if (failed.length === 0) { resolve(results); return; }
            console.log('[FA-WL] appdetails 重试 ' + failed.length + ' 个网络失败条目');
            var rIdx = 0;
            var retryBatches = [];
            for (var j = 0; j < failed.length; j += 5) retryBatches.push(failed.slice(j, j + 5));
            function processNextRetry() {
                if (rIdx >= retryBatches.length) { resolve(results); return; }
                var batch = retryBatches[rIdx++];
                requestBatch(batch, false, function() {
                    setTimeout(processNextRetry, 400);
                });
            }
            processNextRetry();
        }

        processNextBatch();
    });
}

// v1.60 新增（参考 Steam-Wishlist-Sidebar 1.0.9 enrichFromStoreBrowse）：
// IStoreBrowseService/GetItems 批量补全（实测匿名可用，100 个 appid/批、3 路并发），
// 一次请求即可拿到名称/价格/折扣/发售状态，替代绝大多数 appdetails 批量请求，大幅缩短补全时间。
// onBatchDone(batchNew) 回传本批增量（与 enrichWishlistMeta 语义一致）。
function faWlEnrichFromStoreBrowse(appids, onProgress, onBatchDone) {
    return new Promise(function(resolve) {
        var results = {};
        if (!appids || appids.length === 0) { resolve(results); return; }
        var CHUNK = 100, CONCURRENCY = 3;
        var chunks = [];
        for (var i = 0; i < appids.length; i += CHUNK) chunks.push(appids.slice(i, i + CHUNK));
        var qIdx = 0, processed = 0, total = appids.length;
        var cc = faCurrency.cc || 'cn';
        function worker() {
            if (qIdx >= chunks.length) return Promise.resolve();
            var chunk = chunks[qIdx++];
            var input = {
                ids: chunk.map(function(a) { return { appid: Number(a) }; }),
                context: { language: 'schinese', country_code: cc, steam_realm: 1 },
                data_request: { include_release: true, include_all_purchase_options: true }
            };
            var reqUrl = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=' + encodeURIComponent(JSON.stringify(input));
            return faGmGetJson(reqUrl, 20000).then(function(resp) {
                var batchNew = {};
                var storeItems = (resp && resp.response && resp.response.store_items) || [];
                var byId = {};
                storeItems.forEach(function(si) { if (si && si.appid) byId[si.appid] = si; });
                chunk.forEach(function(aid) {
                    var si = byId[aid];
                    // 注意：success===1 才应用（参考 1.0.9）；下架/锁区条目静默跳过，留给 appdetails 兜底
                    if (si && (si.success === 1 || si.success === true)) {
                        var r = faWlParseStoreBrowseItem(si);
                        results[aid] = r;
                        batchNew[aid] = r;
                        // 同步写入中文名缓存（与 enrichWishlistMeta 一致），避免重复请求 appdetails
                        if (r.name) {
                            var nc = faGameNameCacheLoad();
                            nc[String(aid)] = { name: r.name, ts: Date.now() };
                        }
                    }
                    processed++;
                });
                try { faGameNameCacheSave(); } catch (e2) {}
                if (onBatchDone) onBatchDone(batchNew);
                if (onProgress) onProgress(processed, total);
                // 小间隔保护（GetItems 为正式 WebAPI，容忍度高于 appdetails，150ms 即可）
                return new Promise(function(r2) { setTimeout(r2, 150); }).then(worker);
            });
        }
        var workers = [];
        for (var w = 0; w < CONCURRENCY; w++) workers.push(worker());
        Promise.all(workers).then(function() { resolve(results); });
    });
}

// v1.60：解析 GetItems 单个 StoreItem → 统一结果结构
//（_priceKnown/_releaseKnown 为权威覆盖标记，应用方据此可纠正陈旧缓存）
function faWlParseStoreBrowseItem(si) {
    var r = { name: '', type: '', isFree: undefined,
        _priceKnown: false, finalPrice: 0, originalPrice: 0, discountPct: 0, onSale: false,
        _releaseKnown: false, isComingSoon: false, releaseDate: '' };
    if (!si) return r;
    if (si.name) r.name = String(si.name);
    // 注意：GetItems 的 type 是数值枚举（0=game），需映射为字符串（参考 1.0.9，不可直接覆盖字符串字段）
    if (typeof si.type === 'number') {
        var typeMap = { 0: 'game', 1: 'dlc', 2: 'software', 3: 'video', 4: 'series', 6: 'music', 7: 'tool', 8: 'video_series' };
        r.type = typeMap[si.type] || 'other';
    }
    if (typeof si.is_free !== 'undefined') r.isFree = !!si.is_free;
    // 价格与折扣（best_purchase_option 结构与页面 SSR default_info 一致）
    var bpo = si.best_purchase_option;
    if (bpo) {
        var fp = (Number(bpo.final_price_in_cents) || 0) / 100;
        var op = (Number(bpo.original_price_in_cents) || 0) / 100;
        if (op <= 0) op = fp;
        var dp = Number(bpo.discount_pct || bpo.bundle_discount_pct || 0);
        if (!isFinite(fp) || fp < 0) fp = 0;
        if (!isFinite(op) || op < 0) op = fp;
        if (!isFinite(dp) || dp < 0 || dp > 100) dp = 0;
        if (dp > 0 && dp < 100 && op <= fp) op = fp / (1 - dp / 100);
        r.finalPrice = Math.round(fp * 100) / 100;
        r.originalPrice = Math.round(op * 100) / 100;
        r.discountPct = dp;
        r.onSale = dp > 0 || !!(bpo.active_discounts && bpo.active_discounts.length);
        if (fp === 0 && dp === 0) r.isFree = true;
        r._priceKnown = true;
    }
    // 发售状态：release 子对象与顶层 is_coming_soon 互为冗余（实测：未发售=true，已发售无此键）
    var rel = si.release || null;
    var soon = (si.is_coming_soon === true) || (rel && rel.is_coming_soon === true);
    var rdTs = rel ? (Number(rel.steam_release_date) || 0) : 0;
    if (!soon && rdTs * 1000 > Date.now()) soon = true;
    if (rel || typeof si.is_coming_soon !== 'undefined') {
        r.isComingSoon = !!soon;
        r._releaseKnown = true;
        if (rdTs > 0) r.releaseDate = new Date(rdTs * 1000).toISOString().slice(0, 10);
    }
    return r;
}

// ===================== v1.62 共享冷却追踪（参考 sffxzzp Family Sharing Cooldown 追踪模式） =====================
// 冷却记录持久化到 GM_setValue，记录每次借出/归还时间戳，计算剩余冷却时间并以倒计时展示
var FA_COOLDOWN_KEY = 'faCooldownRegistry';
var FA_COOLDOWN_DURATION = 24 * 60 * 60; // 24 小时冷却期（秒）
function faCooldownLoad() {
    var cache = {};
    // v1.81: 优先 IDB,GM 兜底
    try {
        var idbVal = faIDB.get(FA_COOLDOWN_KEY, null);
        if (idbVal && typeof idbVal === 'object') {
            cache = idbVal;
            return cache;
        }
    } catch (e) {}
    try {
        var raw = GM_getValue(FA_COOLDOWN_KEY);
        if (raw && typeof raw === 'object') {
            cache = raw;
            try { faIDB.set(FA_COOLDOWN_KEY, cache); } catch (e) {}
        }
    } catch (e) {}
    return cache;
}
function faCooldownSave(cache) {
    // v1.81: IDB 优先 + GM 兜底
    try { faIDB.set(FA_COOLDOWN_KEY, cache || {}); } catch (e) {}
    try { GM_setValue(FA_COOLDOWN_KEY, cache || {}); } catch (e) {}
}
// 清理已过期的冷却记录（冷却结束时间 <= 当前时间 → 移除，自动移至"可借用"列表）
function faCooldownPrune() {
    var reg = faCooldownLoad();
    var now = Math.floor(Date.now() / 1000);
    var changed = false;
    for (var k in reg) {
        var r = reg[k];
        if (r && r.cooldownEndsAt && r.cooldownEndsAt <= now) {
            r.returnTime = r.cooldownEndsAt; // 记录归还时间戳
            delete reg[k];
            changed = true;
        }
    }
    if (changed) faCooldownSave(reg);
    return changed;
}
// 标记某游戏借出（启动 24h 冷却倒计时）
function faCooldownMarkBorrow(appid, name, borrower, owners) {
    var reg = faCooldownLoad();
    var now = Math.floor(Date.now() / 1000);
    reg[appid] = {
        appid: Number(appid),
        name: name || ('App ' + appid),
        borrower: borrower || '',
        borrowTime: now,            // 借出时间戳
        returnTime: 0,              // 归还时间戳（0 表示尚未归还）
        cooldownEndsAt: now + FA_COOLDOWN_DURATION, // 冷却结束时间
        owners: owners || [],
        lastUpdated: Date.now()
    };
    faCooldownSave(reg);
}
// 结束冷却（手动移除记录）
function faCooldownRemove(appid) {
    var reg = faCooldownLoad();
    if (reg[appid]) {
        reg[appid].returnTime = Math.floor(Date.now() / 1000);
        delete reg[appid];
        faCooldownSave(reg);
    }
}
// 格式化剩余冷却时间为 HH:MM:SS
function faCooldownFormat(sec) {
    if (sec <= 0) return '已结束';
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

// ===================== v1.62 DLC 拥有状态检查（参考 sffxzzp Store DLC Checker 折叠/筛选模式） =====================
// 在 store.steampowered.com/app/* 页面检测 DLC 列表，逐个调用 appuserdetails 检查拥有状态，
// 为已拥有 DLC 添加绿色勾选标记，默认折叠隐藏，提供"显示已拥有 DLC"/"仅显示未拥有"切换。
// 缓存到 GM_setValue（key: dlc_owned_{appid}，TTL 24 小时）
var FA_DLC_OWNED_TTL = 24 * 60 * 60 * 1000; // 24 小时
var _faDlcLastReq = 0;            // 上次请求时间戳（预留位限速）
var FA_DLC_REQ_INTERVAL = 1000;   // 请求间隔 1 秒
var _faDlcFilterSet = new Set();  // 共享默认 filter set，必须 new Set 实例，防止跨组件引用共享
// 读取单个 DLC 拥有状态缓存（key: dlc_owned_{appid}），返回 true/false/null
function faDlcOwnedGet(dlcAppid) {
    try {
        var rec = GM_getValue('dlc_owned_' + dlcAppid);
        if (rec && typeof rec === 'object' && rec.ts && (Date.now() - rec.ts < FA_DLC_OWNED_TTL)) {
            return rec.owned === true;
        }
    } catch (e) {}
    return null;
}
// 写入单个 DLC 拥有状态缓存
function faDlcOwnedSet(dlcAppid, owned) {
    try { GM_setValue('dlc_owned_' + dlcAppid, { owned: !!owned, ts: Date.now() }); } catch (e) {}
}
// 预留位限速：在 sleep 前更新 _faDlcLastReq，防止并发 worker 竞态同时触发请求
function faDlcThrottle() {
    var now = Date.now();
    var earliest = _faDlcLastReq + FA_DLC_REQ_INTERVAL;
    if (now >= earliest) {
        _faDlcLastReq = now; // 立即触发，占用当前槽位
        return Promise.resolve();
    }
    _faDlcLastReq = earliest; // 预留下一个槽位，再 sleep
    var wait = earliest - now;
    return new Promise(function(r) { setTimeout(r, wait); });
}
// 通过 appuserdetails 检查单个 DLC 拥有状态（不支持逗号分隔批量，必须逐个请求）
// URL 使用字符串拼接（不使用 new URL() 处理相对路径）
function faDlcCheckOwned(dlcAppid) {
    var cached = faDlcOwnedGet(dlcAppid);
    if (cached !== null) return Promise.resolve(cached);
    var reqUrl = 'https://store.steampowered.com/api/appuserdetails?appids=' + dlcAppid;
    return faDlcThrottle().then(function() {
        return faGmGetJson(reqUrl, 10000);
    }).then(function(resp) {
        var owned = false;
        try {
            var d = resp && resp[String(dlcAppid)];
            if (d && d.success && d.data) {
                // appuserdetails 返回 ownership/purchased 字段标识拥有状态
                owned = !!(d.data.owned === true || d.data.purchased || (d.data.ownership && d.data.ownership.owned));
            }
        } catch (e) { console.warn('[FA] DLC 拥有状态解析失败:', dlcAppid, e); }
        faDlcOwnedSet(dlcAppid, owned);
        return owned;
    });
}
// 应用拥有状态到 DLC 行（标记 + 可见性）
function faDlcApplyOwned(row, owned) {
    if (!row) return;
    row.setAttribute('data-fa-dlc-owned', owned ? '1' : '0');
    var mark = row.querySelector('.fa-dlc-owned-mark');
    if (mark) mark.style.display = owned ? 'inline' : 'none';
    faDlcApplyDlcVisibility();
}
// 根据 filter set 应用 DLC 行可见性（默认折叠已拥有）
function faDlcApplyDlcVisibility() {
    var showOwned = _faDlcFilterSet.has('show_owned');
    var onlyUnowned = _faDlcFilterSet.has('only_unowned');
    document.querySelectorAll('[data-fa-dlc-appid]').forEach(function(row) {
        var owned = row.getAttribute('data-fa-dlc-owned') === '1';
        var hide = false;
        if (owned && !showOwned) hide = true;   // 默认折叠已拥有 DLC
        if (owned && onlyUnowned) hide = true;   // "仅显示未拥有"时隐藏已拥有
        row.style.display = hide ? 'none' : '';
    });
}
// 更新 DLC 拥有状态汇总
function faDlcUpdateSummary() {
    var rows = document.querySelectorAll('[data-fa-dlc-appid]');
    var owned = 0, total = 0;
    rows.forEach(function(r) { total++; if (r.getAttribute('data-fa-dlc-owned') === '1') owned++; });
    var el = document.getElementById('fa_dlc_summary');
    if (el) el.textContent = '已拥有 ' + owned + ' / ' + total + ' 个 DLC';
}
// 绑定工具栏按钮（幂等）
function faDlcBindToolbar() {
    var toggleBtn = document.getElementById('fa_dlc_toggle_owned');
    var filterBtn = document.getElementById('fa_dlc_filter_unowned');
    if (toggleBtn && !toggleBtn.getAttribute('data-fa-bound')) {
        toggleBtn.setAttribute('data-fa-bound', '1');
        toggleBtn.addEventListener('click', function() {
            if (_faDlcFilterSet.has('show_owned')) { _faDlcFilterSet.delete('show_owned'); toggleBtn.classList.remove('active'); }
            else { _faDlcFilterSet.add('show_owned'); toggleBtn.classList.add('active'); }
            faDlcApplyDlcVisibility();
        });
    }
    if (filterBtn && !filterBtn.getAttribute('data-fa-bound')) {
        filterBtn.setAttribute('data-fa-bound', '1');
        filterBtn.addEventListener('click', function() {
            if (_faDlcFilterSet.has('only_unowned')) { _faDlcFilterSet.delete('only_unowned'); filterBtn.classList.remove('active'); }
            else { _faDlcFilterSet.add('only_unowned'); filterBtn.classList.add('active'); }
            faDlcApplyDlcVisibility();
        });
    }
}
// 处理 DLC 行列表：注入工具栏、DOM 预标记、3 并发 worker 逐个 API 检查
function faDlcProcessRows(dlcItems) {
    var dlcList = document.querySelector('#game_area_dlc_list, .game_area_dlc_list');
    if (!dlcList) return;
    // 注入工具栏（幂等）
    if (!document.getElementById('fa_dlc_toolbar')) {
        var toolbar = document.createElement('div');
        toolbar.id = 'fa_dlc_toolbar';
        toolbar.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 10px;margin-bottom:8px;background:rgba(15,23,42,.6);border:1px solid rgba(255,255,255,.08);border-radius:8px;';
        toolbar.innerHTML = '<span style="font-size:12px;color:#8097a8;font-weight:600;">DLC 拥有状态</span>'
            + '<button id="fa_dlc_toggle_owned" class="fa-btn-green fa-btn-sm">显示已拥有 DLC</button>'
            + '<button id="fa_dlc_filter_unowned" class="fa-btn-green fa-btn-sm">仅显示未拥有</button>'
            + '<span id="fa_dlc_summary" style="font-size:11px;color:#64748b;margin-left:auto;"></span>';
        dlcList.parentNode.insertBefore(toolbar, dlcList);
    }
    // 初始化每行：添加"✓ 已拥有"标记容器
    dlcItems.forEach(function(item) {
        if (item.row.querySelector('.fa-dlc-owned-mark')) return;
        var mark = document.createElement('span');
        mark.className = 'fa-dlc-owned-mark';
        mark.style.cssText = 'display:none;margin-left:6px;font-size:11px;color:#5a8f3a;font-weight:600;vertical-align:middle;';
        mark.innerHTML = '✓ 已拥有';
        var label = item.row.querySelector('.game_area_dlc_name, .ds_flag, a') || item.row;
        label.appendChild(mark);
        item.row.setAttribute('data-fa-dlc-appid', item.appid);
        item.row.setAttribute('data-fa-dlc-owned', '0');
    });
    // DOM 快速预标记：Steam 原生 ds_owned 标识已拥有，直接写入缓存并应用
    dlcItems.forEach(function(item) {
        if (item.row.classList.contains('ds_owned') || item.row.querySelector('.ds_owned_flag')) {
            faDlcOwnedSet(item.appid, true);
            faDlcApplyOwned(item.row, true);
        }
    });
    // 3 个并发 worker 逐个请求 appuserdetails（请求间隔 1 秒，预留位限速）
    var idx = 0;
    var total = dlcItems.length;
    function worker() {
        if (idx >= total) return Promise.resolve();
        var item = dlcItems[idx++];
        // 已由 DOM 确认拥有的跳过 API 请求
        if (item.row.getAttribute('data-fa-dlc-owned') === '1') { return worker(); }
        return faDlcCheckOwned(item.appid).then(function(owned) {
            faDlcOwnedSet(item.appid, owned);
            faDlcApplyOwned(item.row, owned);
            faDlcUpdateSummary();
            return worker();
        });
    }
    var workers = [];
    for (var w = 0; w < 3; w++) workers.push(worker());
    Promise.all(workers).then(function() { faDlcUpdateSummary(); faDlcApplyDlcVisibility(); });
    faDlcBindToolbar();
    faDlcUpdateSummary();
    faDlcApplyDlcVisibility();
}
// DLC 拥有状态检查入口：在 app 页面检测 DLC 列表并启动检查
function faCheckDlcOwnership() {
    if (!url || !url.startsWith('store.steampowered.com/app/')) return;
    if (faCompat.accountId() == 0) return;
    _faDlcFilterSet = new Set(); // 每次进入页面重置 filter set 为新 Set 实例
    var started = false;
    function run() {
        var dlcList = document.querySelector('#game_area_dlc_list, .game_area_dlc_list');
        if (!dlcList) return;
        var rows = dlcList.querySelectorAll('.game_area_dlc_row');
        if (rows.length === 0) return;
        var dlcItems = [];
        rows.forEach(function(row) {
            var dsAppid = row.getAttribute('data-ds-appid');
            if (!dsAppid) return;
            var aid = Number(dsAppid.split(',')[0].trim());
            if (!aid || isNaN(aid)) return;
            dlcItems.push({ row: row, appid: aid });
        });
        if (dlcItems.length === 0) return;
        started = true;
        faDlcProcessRows(dlcItems);
    }
    run();
    // 覆盖懒加载：多次重试
    if (!started) {
        setTimeout(run, 1500);
        setTimeout(run, 3000);
        setTimeout(run, 5000);
    }
}

// v1.81: readstorage —— 同步从 GM 读保证向后兼容,异步从 IDB 升级到最新数据
//   启动时序:
//     1) readstorage() 同步从 GM_getValue('saves') 读
//     2) faIDB.loadAll() 异步加载 IDB → 完成后覆盖 saves(取 IDB/GM 中 lastupDateTime 较新的)
//     3) faPCC.hydrate() 同步预热所有 fpcc_* 计算缓存到内存
//   设计原则:首次同步从 GM 读确保兼容(用户旧缓存立即可用),IDB 升级在后台进行,完成后内存切换引用
function readstorage(){
    let newsaves = {
        version : 20240501,
        familyGameList:{"GameList":[],"GameInfo":{}},
        familyInfo:{"family_groupid":null,
                    "family_name":null,
                    "family_member":[],
                    "steamIdtoName":{}},
        familyWishlist:{"GameList":[],"GameInfo":{}, "lastUpdated":0},
        lastupDateTime:0,
        steamid:"",
        settings:{isAutoScan:true, enableStoreMarking:true}
    }
    try{
        var save = faCompat.safeGmGet('saves', undefined)
        if(save !== undefined){
            if(save.version == newsaves.version){
                saves = save
                // v1.98: 向后兼容 — 已有用户可能没有 enableStoreMarking 字段，默认开启
                if (saves.settings && saves.settings.enableStoreMarking === undefined) {
                    saves.settings.enableStoreMarking = true;
                }
            }else{
                // v1.39 修复：版本不匹配时清除旧缓存并写入新空存档，避免下次读取仍报错
                isupdate=true
                faCompat.safeGmDelete('saves');
                saves = newsaves;
                faCompat.safeGmSet('saves', newsaves);
                if(window.location.host == "store.steampowered.com"){
                    faCompat.confirm('脚本提示','脚本缓存列表结构升级，缓存的家庭库列表需要重新扫描！','扫描家庭库','稍后').done(()=>{scan(true)}).fail(()=>{
                        faCompat.alert('脚本提示','稍后可在Steam主页右上角「我的家庭库」入口手动扫描','好的')
                    })
                }else if(window.location.host == "keylol.com"){
                    if (save?.noPrompt == null || save?.noPrompt == false){
                        faCompat.alert('脚本提示', '脚本缓存列表结构升级，缓存的家庭库列表需要重新扫描，请进入 Steam 商店页面按提示扫描！', '好的')
                        saves.noPrompt = true
                        savestorage()
                    }
                }
            }
        }else{
            if(window.location.host == "keylol.com"){
                faCompat.alert('脚本提示', '您好像是第一次启动脚本，请进入 Steam 商店页面按提示扫描家庭库！', '好的')
            }
            isNewUser = true
            faCompat.safeGmSet('saves',newsaves)
            saves = newsaves
        }
    }catch(e){
        // v1.39 修复：缓存数据损坏时，清除旧缓存并写入新的空存档，避免反复触发读取错误
        console.error('[家庭库脚本] 缓存读取异常，已清除旧缓存：', e);
        faCompat.safeGmDelete('saves');
        saves = newsaves;
        faCompat.safeGmSet('saves', newsaves);
        isupdate = true;
        if(window.location.host == "store.steampowered.com"){
            faCompat.confirm('脚本提示','缓存数据异常已自动清除，需要重新扫描家庭库！','扫描家庭库','稍后').done(()=>{scan(true)}).fail(()=>{
                faCompat.alert('脚本提示','稍后可在Steam主页右上角「我的家庭库」入口手动扫描','好的')
            })
        }
    }
    // v1.81: 启动 IDB 异步升级 — IDB 数据较新时覆盖 saves(不阻塞启动)
    faIDB.loadAll().then(function() {
        try {
            var idbSaves = faIDB.get('saves', null);
            if (idbSaves && idbSaves.version === saves.version && (idbSaves.lastupDateTime || 0) > (saves.lastupDateTime || 0)) {
                // IDB 数据更新,升级内存 saves
                saves = idbSaves;
                console.log('[FA] IDB saves 升级成功: ' + Object.keys(saves.familyGameList.GameInfo || {}).length + ' 款游戏, lastupDateTime=' + saves.lastupDateTime);
            } else if (idbSaves && idbSaves.version === saves.version && !saves.lastupDateTime) {
                // IDB 有但 GM 空(可能 IDB 在某次启动中写过)— 取 IDB
                saves = idbSaves;
            }
            // 同步预热所有 fpcc_* 计算缓存(0 延迟,首次切 tab 即命中)
            var pccCount = faPCC.hydrate();
            if (pccCount > 0) console.log('[FA] PCC hydrate 完成: ' + pccCount + ' 项已就绪');
            // 触发 IDB 升级完成事件(用于切 tab 时判断是否需要 patch)
            document.dispatchEvent(new CustomEvent('sffa:idb-ready', { detail: { pccCount: pccCount, savesUpdated: !!(idbSaves && idbSaves.lastupDateTime) } }));
        } catch (e) { console.warn('[FA] IDB 升级失败,继续使用 GM 数据:', e); }
    }).catch(function(e) { console.warn('[FA] IDB 加载失败,降级到纯 GM 模式:', e); });
}
// v1.81: savestorage —— IDB + GM 双写,IDB 写入是异步非阻塞,GM 仍保留作为冷备
//   关键差异:之前每次 savestorage() 都会同步阻塞主线程(序列化整个 saves 写 GM)
//           新版 IDB 写入是异步,GM 兜底(若 IDB 写失败,GM 仍能恢复)
//   兼容性:旧版/跨版本仍能从 GM 读(降级)
function savestorage(isdelete){
    if(isdelete) {
        faCompat.safeGmDelete('saves');
        faIDB.remove('saves');
        saves = null;
        return;
    }
    // v1.81: 优先写 IDB(异步,非阻塞),GM 同步写兜底
    // 注意:这里同步保留 GM_setValue 是为了兼容性 — 旧版用户/异常环境下仍能从 GM 读
    faCompat.safeGmSet('saves', saves);
    // IDB 写入是异步(防 quota 错误同步阻塞)
    try { faIDB.set('saves', saves); } catch (e) { /* IDB 暂时不可用 */ }
}
function timestampToTime(timestamp) {
    if(timestamp == 0){return '无记录'}
    timestamp = timestamp ? timestamp : null;
    timestamp *= 1000
    let date = new Date(timestamp);//时间戳为10位需*1000，时间戳为13位的话不需乘1000
    let Y = date.getFullYear() + '-';
    let M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '-';
    let D = (date.getDate() < 10 ? '0' + date.getDate() : date.getDate()) + ' ';
    let h = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + ':';
    let m = (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()) + ':';
    let s = date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds();
    return Y + M + D + h + m + s;
}

// ===================== v1.38 高级分析函数 =====================

// v1.41 性能优化：单次遍历 gameInfo，同时计算家庭整体 + 各成员热力图数据
// 避免对每个成员都遍历全部 gameInfo（N成员 × M游戏 → 1 × M）
// v1.81: 接入 faComputedCache + faPCC — 切 heatmap tab 不重算,跨 session 复用
function _faHeatmapCacheKey(gameInfo, members) {
    // 库存指纹(扫描时间 + 游戏数 + 成员列表)— 库存未变直接命中缓存
    if (typeof saves !== 'undefined' && saves && saves.lastupDateTime) {
        var sids = [];
        for (var i = 0; i < members.length; i++) sids.push(String(members[i].steamid));
        var gameCount = 0;
        for (var k in gameInfo) gameCount++;
        return saves.lastupDateTime + '|' + gameCount + '|' + sids.join(',');
    }
    return null;
}
function computeAllHeatmaps(gameInfo, members) {
    var key = _faHeatmapCacheKey(gameInfo, members);
    if (key) {
        // 先查会话内缓存(快速路径,同步)
        var cached = faComputedCache.get('heatmap_' + key);
        if (cached) return cached;
        // 跨 session:faPCC 持久化层(IDB 落盘)
        return faPCC.getOrComputeSync('fa_heatmap', 1, key, function() {
            return _computeAllHeatmapsRaw(gameInfo, members);
        });
    }
    return _computeAllHeatmapsRaw(gameInfo, members);
}
function _computeAllHeatmapsRaw(gameInfo, members) {
    var familyDayMap = {};
    var memberDayMaps = {};
    var familyValid = [];
    var memberValid = {};
    members.forEach(function(m) {
        memberDayMaps[m.steamid] = {};
        memberValid[m.steamid] = [];
    });
    for (var appid in gameInfo) {
        var gi = gameInfo[appid];
        var t = gi.time;
        if (!t || t <= 0) continue;
        // 日期 key 只计算一次
        var d = new Date(t * 1000);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        // 家庭整体
        familyDayMap[key] = (familyDayMap[key] || 0) + 1;
        familyValid.push(t);
        // 各成员
        if (gi.owners) {
            for (var oi = 0; oi < gi.owners.length; oi++) {
                var sid = gi.owners[oi];
                if (memberDayMaps[sid]) {
                    memberDayMaps[sid][key] = (memberDayMaps[sid][key] || 0) + 1;
                    memberValid[sid].push(t);
                }
            }
        }
    }
    function buildResult(dayMap, valid) {
        if (valid.length === 0) return null;
        valid.sort(function(a, b) { return a - b; });
        var maxDaily = 0, total = 0;
        for (var k in dayMap) { if (dayMap[k] > maxDaily) maxDaily = dayMap[k]; total += dayMap[k]; }
        var firstTs = valid[0], lastTs = valid[valid.length - 1];
        var spanDays = Math.max(1, Math.ceil((lastTs - firstTs) / 86400) + 1);
        return { dayMap: dayMap, maxDaily: maxDaily, total: total, avgDaily: total / spanDays, firstTs: firstTs, lastTs: lastTs };
    }
    var familyHm = buildResult(familyDayMap, familyValid);
    var memberHms = {};
    members.forEach(function(m) {
        memberHms[m.steamid] = buildResult(memberDayMaps[m.steamid], memberValid[m.steamid]);
    });
    var result = { family: familyHm, members: memberHms };
    // v1.81: 同时写入会话内缓存(快速路径),供同 session 二次访问直接命中
    var cacheKey = _faHeatmapCacheKey(gameInfo, members);
    if (cacheKey) faComputedCache.set('heatmap_' + cacheKey, result);
    return result;
}

// 计算每日入库热力图数据（保留兼容，内部委托给 computeAllHeatmaps）
function computeFamilyDailyHeatmap(gameInfo) {
    var dayMap = {}, valid = [];
    for (var appid in gameInfo) {
        var t = gameInfo[appid].time;
        if (t && t > 0) {
            valid.push(t);
            var d = new Date(t * 1000);
            var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            dayMap[key] = (dayMap[key] || 0) + 1;
        }
    }
    if (valid.length === 0) return null;
    valid.sort(function(a, b) { return a - b; });
    var maxDaily = 0, total = 0;
    for (var k in dayMap) { if (dayMap[k] > maxDaily) maxDaily = dayMap[k]; total += dayMap[k]; }
    var firstTs = valid[0], lastTs = valid[valid.length - 1];
    var spanDays = Math.max(1, Math.ceil((lastTs - firstTs) / 86400) + 1);
    return { dayMap: dayMap, maxDaily: maxDaily, total: total, avgDaily: total / spanDays, firstTs: firstTs, lastTs: lastTs };
}

// 计算单个成员的每日入库热力图数据（保留兼容）
function computeMemberDailyHeatmap(gameInfo, steamid) {
    var dayMap = {}, valid = [];
    for (var appid in gameInfo) {
        var gi = gameInfo[appid];
        if (gi.owners && gi.owners.indexOf(steamid) !== -1 && gi.time && gi.time > 0) {
            valid.push(gi.time);
            var d = new Date(gi.time * 1000);
            var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            dayMap[key] = (dayMap[key] || 0) + 1;
        }
    }
    if (valid.length === 0) return null;
    valid.sort(function(a, b) { return a - b; });
    var maxDaily = 0, total = 0;
    for (var k in dayMap) { if (dayMap[k] > maxDaily) maxDaily = dayMap[k]; total += dayMap[k]; }
    var firstTs = valid[0], lastTs = valid[valid.length - 1];
    var spanDays = Math.max(1, Math.ceil((lastTs - firstTs) / 86400) + 1);
    return { dayMap: dayMap, maxDaily: maxDaily, total: total, avgDaily: total / spanDays, firstTs: firstTs, lastTs: lastTs };
}

// v1.81: 活跃度缓存键 — 库存指纹 + 一天时间戳(每天需要重算 daysSinceLatest)
// 跨 session 复用:相同库存指纹+同一天 → 命中(避免重复遍历 gameInfo)
// schemaVer=1 时基线
function _faActivityCacheKey(familyInfo, gameInfo) {
    if (typeof saves !== 'undefined' && saves && saves.lastupDateTime) {
        var sids = [];
        var members = (familyInfo && Array.isArray(familyInfo.family_member)) ? familyInfo.family_member : [];
        for (var i = 0; i < members.length; i++) sids.push(String(members[i].steamid));
        var gameCount = 0;
        for (var k in gameInfo) gameCount++;
        // 用日期作为签名一部分 — daysSinceLatest 每天都在变,缓存按天刷新
        var day = new Date().toISOString().slice(0, 10);
        return saves.lastupDateTime + '|' + gameCount + '|' + sids.join(',') + '|' + day;
    }
    return null;
}

// 计算成员活跃度与健康分
// v1.81: 接入 faComputedCache + faPCC — 切 member tab 不重算
function computeMemberActivity(familyInfo, gameInfo) {
    var key = _faActivityCacheKey(familyInfo, gameInfo);
    if (key) {
        var cached = faComputedCache.get('activity_' + key);
        if (cached) return cached;
        return faPCC.getOrComputeSync('fa_member_activity', 1, key, function() {
            return _computeMemberActivityRaw(familyInfo, gameInfo);
        });
    }
    return _computeMemberActivityRaw(familyInfo, gameInfo);
}
function _computeMemberActivityRaw(familyInfo, gameInfo) {
    var members = (familyInfo && Array.isArray(familyInfo.family_member)) ? familyInfo.family_member : [];
    var idMap = (familyInfo && familyInfo.steamIdtoName) ? familyInfo.steamIdtoName : {};
    var nowSec = Date.now() / 1000;
    var result = { members: [], activeCount: 0, warmCount: 0, coldCount: 0, dormantCount: 0, healthScore: 0, statusLabels: { active: '活跃', warm: '温热', cold: '冷淡', dormant: '沉睡' } };
    var nameOf = function(m) { return m.userName || idMap[m.steamid] || ('ID:' + String(m.steamid).slice(-4)); };
    members.forEach(function(m) {
        var sid = m.steamid, games = 0, times = [];
        for (var appid in gameInfo) {
            if (gameInfo[appid].owners && gameInfo[appid].owners.indexOf(sid) !== -1) {
                games++;
                if (gameInfo[appid].time > 0) times.push(gameInfo[appid].time);
            }
        }
        var latestTime = times.length > 0 ? Math.max.apply(null, times) : -1;
        var firstTime = times.length > 0 ? Math.min.apply(null, times) : -1;
        var daysSinceLatest = latestTime > 0 ? Math.floor((nowSec - latestTime) / 86400) : -1;
        var status, statusLabel;
        if (daysSinceLatest < 0) { status = 'dormant'; statusLabel = '从未入库'; result.dormantCount++; }
        else if (daysSinceLatest < 14) { status = 'active'; statusLabel = '活跃'; result.activeCount++; }
        else if (daysSinceLatest < 60) { status = 'warm'; statusLabel = '温热'; result.warmCount++; }
        else if (daysSinceLatest < 180) { status = 'cold'; statusLabel = '冷淡'; result.coldCount++; }
        else { status = 'dormant'; statusLabel = '沉睡'; result.dormantCount++; }
        var libMonths = firstTime > 0 ? Math.max(1, (nowSec - firstTime) / 2592000) : 1;
        result.members.push({ steamid: sid, name: nameOf(m), total: games, latestTime: latestTime, daysSinceLatest: daysSinceLatest, status: status, statusLabel: statusLabel, monthlyAvg: (games / libMonths).toFixed(1) });
    });
    var scoreMap = { active: 100, warm: 75, cold: 50, dormant: 25 };
    var totalScore = 0, cnt = 0;
    result.members.forEach(function(m) { totalScore += scoreMap[m.status]; cnt++; });
    result.healthScore = cnt > 0 ? Math.round(totalScore / cnt) : 0;
    var order = { active: 0, warm: 1, cold: 2, dormant: 3 };
    result.members.sort(function(a, b) { return order[a.status] - order[b.status] || b.total - a.total; });
    // v1.81: 写入会话内缓存
    var cacheKey = _faActivityCacheKey(familyInfo, gameInfo);
    if (cacheKey) faComputedCache.set('activity_' + cacheKey, result);
    return result;
}

// v1.80：共同游戏矩阵结果缓存 —— 库存未变化（扫描时间+游戏数+成员列表指纹一致）时直接复用，无需重复计算
// v1.81: 升级为 faComputedCache + faPCC 双层缓存(会话内 + 跨 session)
var faOverlapMatrixCache = { key: null, result: null };

// v1.80：生成库存指纹作为缓存键（扫描时间 + 游戏总数 + 成员 steamid 列表）
function faOverlapCacheKey(gameInfo, members) {
    var gameCount = 0;
    for (var appid in gameInfo) gameCount++;
    var sids = [];
    members.forEach(function(m) { sids.push(String(m.steamid)); });
    return saves.lastupDateTime + '|' + gameCount + '|' + sids.join(',');
}

// 计算成员共同游戏矩阵
// v1.80：参考 steam-friend-manager 优化算法，改用反向索引法重写：
//   仅遍历一次全部游戏的 owners，对每对共拥成员递增计数，独占游戏自动跳过；
//   复杂度由原 O(n × G + n² × k)（k 为成员人均游戏数）降为 O(G × avg_owners²)，
//   家庭组最多 6 人（owners² ≤ 36），成员游戏数量再多也不会导致计算次数几何式增长。
// v1.81：双层缓存 — faComputedCache 会话内快速路径 + faPCC 跨 session 持久化
// 返回结构保持不变：{ matrix, pairs }
function computeMemberOverlapMatrix(gameInfo, members, idMap) {
    var key = faOverlapCacheKey(gameInfo, members);
    // v1.80 旧 session 内缓存(保留,快速路径)
    if (faOverlapMatrixCache.key === key && faOverlapMatrixCache.result) {
        return faOverlapMatrixCache.result;
    }
    // v1.81: 会话内缓存(快速路径)
    var cached = faComputedCache.get('overlap_' + key);
    if (cached) {
        faOverlapMatrixCache.key = key;
        faOverlapMatrixCache.result = cached;
        return cached;
    }
    // v1.81: 跨 session 持久化(签名匹配直接命中,无需遍历 gameInfo)
    var result = faPCC.getOrComputeSync('fa_overlap_matrix', 1, key, function() {
        return _computeMemberOverlapMatrixRaw(gameInfo, members, idMap);
    });
    faOverlapMatrixCache.key = key;
    faOverlapMatrixCache.result = result;
    faComputedCache.set('overlap_' + key, result);
    return result;
}
function _computeMemberOverlapMatrixRaw(gameInfo, members, idMap) {
    var n = members.length;
    var matrix = [];
    for (var i = 0; i < n; i++) matrix.push(new Array(n).fill(0));
    // steamid → 成员索引
    var memberIdx = {};
    members.forEach(function(m, i) { memberIdx[m.steamid] = i; });
    // 遍历游戏，仅处理共拥游戏（owners.length >= 2）
    for (var appid in gameInfo) {
        var owners = gameInfo[appid].owners;
        if (!owners || owners.length < 2) continue;
        // 映射 owner steamid → 成员索引
        var idxs = [];
        for (var o = 0; o < owners.length; o++) {
            var idx = memberIdx[owners[o]];
            if (idx !== undefined) idxs.push(idx);
        }
        // 对每对共拥成员递增矩阵
        for (var i = 0; i < idxs.length; i++) {
            for (var j = i + 1; j < idxs.length; j++) {
                matrix[idxs[i]][idxs[j]]++;
                matrix[idxs[j]][idxs[i]]++;
            }
        }
    }
    var nameOf = function(m) { return m.userName || (idMap && idMap[m.steamid]) || ('ID:' + String(m.steamid).slice(-4)); };
    var pairs = [];
    for (var i = 0; i < n; i++) {
        for (var j = i + 1; j < n; j++) {
            pairs.push({ a: i, b: j, aName: nameOf(members[i]), bName: nameOf(members[j]), sharedGames: matrix[i][j] });
        }
    }
    pairs.sort(function(a, b) { return b.sharedGames - a.sharedGames; });
    return { matrix: matrix, pairs: pairs };
}

// 计算成员雷达数据（归一化 0-1）
// v1.81: 接入 faComputedCache + faPCC — 切 member tab 不重算
function _faRadarCacheKey(gameInfo, members) {
    if (typeof saves !== 'undefined' && saves && saves.lastupDateTime) {
        var sids = [];
        for (var i = 0; i < members.length; i++) sids.push(String(members[i].steamid));
        var gameCount = 0;
        for (var k in gameInfo) gameCount++;
        return saves.lastupDateTime + '|' + gameCount + '|' + sids.join(',');
    }
    return null;
}
function computeMemberRadar(gameInfo, members, idMap) {
    var key = _faRadarCacheKey(gameInfo, members);
    if (key) {
        var cached = faComputedCache.get('radar_' + key);
        if (cached) return cached;
        return faPCC.getOrComputeSync('fa_member_radar', 1, key, function() {
            return _computeMemberRadarRaw(gameInfo, members, idMap);
        });
    }
    return _computeMemberRadarRaw(gameInfo, members, idMap);
}
function _computeMemberRadarRaw(gameInfo, members, idMap) {
    var nowSec = Date.now() / 1000;
    var nameOf = function(m) { return m.userName || (idMap && idMap[m.steamid]) || ('ID:' + String(m.steamid).slice(-4)); };
    var raw = members.map(function(m) {
        var sid = m.steamid, total = 0, solo = 0, shared = 0, times = [];
        for (var appid in gameInfo) {
            var g = gameInfo[appid];
            if (g.owners && g.owners.indexOf(sid) !== -1) {
                total++;
                if (g.owners.length === 1) solo++; else shared++;
                if (g.time > 0) times.push(g.time);
            }
        }
        var firstTime = times.length > 0 ? Math.min.apply(null, times) : nowSec;
        var libMonths = Math.max(1, (nowSec - firstTime) / 2592000);
        return { name: nameOf(m), total: total, solo: solo, shared: shared, monthlyAvg: total / libMonths, shareRate: total > 0 ? shared / total : 0, libAge: (nowSec - firstTime) / 2592000 };
    });
    var maxT = 1, maxS = 1, maxSh = 1, maxM = 0.0001, maxA = 0.0001;
    raw.forEach(function(r) { if (r.total > maxT) maxT = r.total; if (r.solo > maxS) maxS = r.solo; if (r.shared > maxSh) maxSh = r.shared; if (r.monthlyAvg > maxM) maxM = r.monthlyAvg; if (r.libAge > maxA) maxA = r.libAge; });
    var result = raw.map(function(r) {
        return { name: r.name, totalGames: r.total / maxT, soloCount: r.solo / maxS, sharedCount: r.shared / maxSh, monthlyAvg: r.monthlyAvg / maxM, shareRate: r.shareRate, libraryAge: r.libAge / maxA };
    });
    var cacheKey = _faRadarCacheKey(gameInfo, members);
    if (cacheKey) faComputedCache.set('radar_' + cacheKey, result);
    return result;
}
