(function () {
  var NS = '__FA_PREFERENCE_NAMESPACE__.';
  var SCHEMA = __FA_SCHEMA__;
  var INDEX_SCHEMA = __FA_INDEX_SCHEMA__;
  var HOSTS = __FA_HOSTS__;
  var BRIDGE_ROUTE = '__FA_ROUTE_PREFIX__/bridge';
  var MUTATION_HOST = '__FA_MUTATION_HOST__';
  var OPERATIONS = __FA_OPERATION_DISPATCH__;
  var DEFAULTS = {
    autoScan: true,
    storeMarking: true,
    debug: false,
    logLevel: 'warn',
    commands: { rescan: 0, refreshExternal: 0, clearCache: 0 },
    acknowledgements: { rescan: 0, refreshExternal: 0, clearCache: 0 }
  };
  var COMMANDS = { rescan: true, refreshExternal: true, clearCache: true };
  var INVALID = {};

  function utf8ByteLength(text) {
    var length = 0;
    for (var index = 0; index < text.length; index += 1) {
      var code = text.charCodeAt(index);
      if (code < 128) {
        length += 1;
      } else if (code < 2048) {
        length += 2;
      } else if (code >= 55296 && code <= 56319 && index + 1 < text.length) {
        var next = text.charCodeAt(index + 1);
        if (next >= 56320 && next <= 57343) {
          length += 4;
          index += 1;
        } else {
          length += 3;
        }
      } else {
        length += 3;
      }
    }
    return length;
  }

  function readJson(key, fallback) {
    var raw = $prefs.valueForKey(NS + key);
    if (typeof raw !== 'string' || raw === '') return fallback;
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    if ($prefs.setValueForKey(JSON.stringify(value), NS + key) !== true) throw new Error('FA_QX_PREF_WRITE_FAILED');
  }

  function fnv1a(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function isSafeInteger(value) {
    return typeof value === 'number' && Number.isSafeInteger(value);
  }

  function publicErrorCode(error) {
    var code = error && error.message;
    return typeof code === 'string' && /^FA_QX_[A-Z0-9_]+$/.test(code) ? code : 'FA_QX_UNKNOWN';
  }

  function preference(key) {
    return $prefs.valueForKey(NS + key);
  }

  function readBoolean(key, fallback) {
    var raw = preference(key);
    if (raw === true || raw === 'true') return true;
    if (raw === false || raw === 'false') return false;
    return fallback;
  }

  function readCounter(key, fallback) {
    var raw = preference(key);
    if (isSafeInteger(raw) && raw >= 0) return raw;
    if (typeof raw === 'string' && /^(?:0|[1-9][0-9]*)$/.test(raw)) {
      var parsed = Number(raw);
      if (Number.isSafeInteger(parsed)) return parsed;
    }
    return fallback;
  }

  function readLogLevel(key, fallback) {
    var raw = preference(key);
    return raw === 'error' || raw === 'warn' || raw === 'info' || raw === 'debug' ? raw : fallback;
  }

  function requireEmptyPayload(payload) {
    if (!hasOnlyKeys(payload, [])) throw new Error('FA_QX_PAYLOAD_INVALID');
  }

  function configGet(payload) {
    requireEmptyPayload(payload);
    return {
      autoScan: readBoolean('settings.autoScan', DEFAULTS.autoScan),
      storeMarking: readBoolean('settings.storeMarking', DEFAULTS.storeMarking),
      debug: readBoolean('settings.debug', DEFAULTS.debug),
      logLevel: readLogLevel('settings.logLevel', DEFAULTS.logLevel),
      commands: {
        rescan: readCounter('commands.rescan', DEFAULTS.commands.rescan),
        refreshExternal: readCounter('commands.refreshExternal', DEFAULTS.commands.refreshExternal),
        clearCache: readCounter('commands.clearCache', DEFAULTS.commands.clearCache)
      },
      acknowledgements: {
        rescan: readCounter('acknowledgements.rescan', DEFAULTS.acknowledgements.rescan),
        refreshExternal: readCounter('acknowledgements.refreshExternal', DEFAULTS.acknowledgements.refreshExternal),
        clearCache: readCounter('acknowledgements.clearCache', DEFAULTS.acknowledgements.clearCache)
      }
    };
  }

  function manifestKey() {
    return 'index.manifest';
  }

  function stagingKey(generation, chunkIndex) {
    return 'index.staging.' + generation + '.' + chunkIndex;
  }

  function chunkKey(generation, chunkIndex) {
    return 'index.chunk.' + generation + '.' + chunkIndex;
  }

  function validateManifest(value) {
    if (!hasOnlyKeys(value, ['schema', 'generation', 'sourceUpdatedAt', 'chunks', 'checksum']) || value.schema !== INDEX_SCHEMA || !isSafeInteger(value.generation) || value.generation <= 0 ||
      !isSafeInteger(value.sourceUpdatedAt) || value.sourceUpdatedAt < 0 || !isSafeInteger(value.chunks) ||
      value.chunks < 1 || value.chunks > 32 || typeof value.checksum !== 'string' || !/^[0-9a-f]{8}$/.test(value.checksum)) {
      throw new Error('FA_QX_INDEX_INVALID');
    }
    return value;
  }

  function installedManifest() {
    var raw = preference(manifestKey());
    if (typeof raw !== 'string' || raw === '') return null;
    var value = readJson(manifestKey(), INVALID);
    if (value === INVALID) throw new Error('FA_QX_INDEX_CORRUPT');
    try {
      return validateManifest(value);
    } catch (_) {
      throw new Error('FA_QX_INDEX_CORRUPT');
    }
  }

  function readInstalledChunks(manifest) {
    var chunks = [];
    for (var index = 0; index < manifest.chunks; index += 1) {
      var chunk = preference(chunkKey(manifest.generation, index));
      if (typeof chunk !== 'string') throw new Error('FA_QX_INDEX_CORRUPT');
      chunks.push(chunk);
    }
    if (fnv1a(chunks.join('')) !== manifest.checksum) throw new Error('FA_QX_INDEX_CORRUPT');
    return chunks;
  }

  function validatedInstalled() {
    var manifest = installedManifest();
    if (manifest !== null) readInstalledChunks(manifest);
    return manifest;
  }

  function hasOnlyKeys(value, keys) {
    if (!isObject(value)) return false;
    var found = Object.keys(value);
    if (found.length !== keys.length) return false;
    for (var index = 0; index < keys.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(value, keys[index])) return false;
    }
    return true;
  }

  function removeGeneration(generation, count, includeChunks, includeStaging) {
    for (var index = 0; index < count; index += 1) {
      if (includeChunks) {
        try { $prefs.removeValueForKey(NS + chunkKey(generation, index)); } catch (_) {}
      }
      if (includeStaging) {
        try { $prefs.removeValueForKey(NS + stagingKey(generation, index)); } catch (_) {}
      }
    }
  }

  function stageIndex(payload) {
    if (!hasOnlyKeys(payload, ['phase', 'manifest', 'chunkIndex', 'chunk']) || payload.phase !== 'stage') throw new Error('FA_QX_INDEX_INVALID');
    var manifest = validateManifest(payload.manifest);
    var current = validatedInstalled();
    if (current !== null && manifest.generation <= current.generation) throw new Error('FA_QX_INDEX_ROLLBACK');
    if (!isSafeInteger(payload.chunkIndex) || payload.chunkIndex < 0 || payload.chunkIndex >= manifest.chunks ||
      typeof payload.chunk !== 'string' || utf8ByteLength(payload.chunk) > 98304) throw new Error('FA_QX_INDEX_INVALID');
    var key = stagingKey(manifest.generation, payload.chunkIndex);
    if (preference(key) !== null && preference(key) !== undefined) throw new Error('FA_QX_INDEX_DUPLICATE_CHUNK');
    try {
      if ($prefs.setValueForKey(payload.chunk, NS + key) !== true) throw new Error('FA_QX_PREF_WRITE_FAILED');
      if (preference(key) !== payload.chunk) throw new Error('FA_QX_PREF_WRITE_FAILED');
    } catch (error) {
      removeGeneration(manifest.generation, manifest.chunks, false, true);
      throw error;
    }
    return { staged: payload.chunkIndex };
  }

  function commitIndex(payload) {
    if (!hasOnlyKeys(payload, ['phase', 'manifest']) || payload.phase !== 'commit') throw new Error('FA_QX_INDEX_INVALID');
    var manifest = validateManifest(payload.manifest);
    var current = validatedInstalled();
    if (current !== null && manifest.generation <= current.generation) throw new Error('FA_QX_INDEX_ROLLBACK');
    var chunks = [];
    try {
      for (var index = 0; index < manifest.chunks; index += 1) {
        var chunk = preference(stagingKey(manifest.generation, index));
        if (typeof chunk !== 'string') throw new Error('FA_QX_INDEX_CORRUPT');
        chunks.push(chunk);
      }
      if (fnv1a(chunks.join('')) !== manifest.checksum) throw new Error('FA_QX_INDEX_CORRUPT');
      for (var chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        if ($prefs.setValueForKey(chunks[chunkIndex], NS + chunkKey(manifest.generation, chunkIndex)) !== true) throw new Error('FA_QX_PREF_WRITE_FAILED');
        if (preference(chunkKey(manifest.generation, chunkIndex)) !== chunks[chunkIndex]) throw new Error('FA_QX_PREF_WRITE_FAILED');
      }
      writeJson(manifestKey(), manifest);
    } catch (error) {
      removeGeneration(manifest.generation, manifest.chunks, true, true);
      throw error;
    }
    if (current !== null) removeGeneration(current.generation, current.chunks, true, true);
    removeGeneration(manifest.generation, manifest.chunks, false, true);
    return { generation: manifest.generation };
  }

  function indexPublish(payload) {
    if (!isObject(payload)) throw new Error('FA_QX_INDEX_INVALID');
    if (payload.phase === 'stage') return stageIndex(payload);
    if (payload.phase === 'commit') return commitIndex(payload);
    throw new Error('FA_QX_INDEX_INVALID');
  }

  function indexRead(payload) {
    if (!isObject(payload)) throw new Error('FA_QX_INDEX_INVALID');
    var manifest = installedManifest();
    if (payload.part === 'manifest') {
      if (!hasOnlyKeys(payload, ['part'])) throw new Error('FA_QX_INDEX_INVALID');
      if (manifest === null) return null;
      readInstalledChunks(manifest);
      return manifest;
    }
    if (!hasOnlyKeys(payload, ['part', 'generation', 'chunkIndex']) || payload.part !== 'chunk' || manifest === null || payload.generation !== manifest.generation ||
      !isSafeInteger(payload.chunkIndex) || payload.chunkIndex < 0 || payload.chunkIndex >= manifest.chunks) {
      throw new Error('FA_QX_INDEX_INVALID');
    }
    var chunks = readInstalledChunks(manifest);
    return { chunk: chunks[payload.chunkIndex], checksum: fnv1a(chunks[payload.chunkIndex]) };
  }

  function indexClear(payload) {
    requireEmptyPayload(payload);
    var manifest = installedManifest();
    if (manifest === null) return { cleared: true };
    removeGeneration(manifest.generation, manifest.chunks, true, true);
    $prefs.removeValueForKey(NS + manifestKey());
    return { cleared: true };
  }

  function commandAck(payload) {
    if (!hasOnlyKeys(payload, ['command', 'id']) || !Object.prototype.hasOwnProperty.call(COMMANDS, payload.command) || !isSafeInteger(payload.id)) throw new Error('FA_QX_COMMAND_INVALID');
    var name = payload.command;
    var acknowledgement = readCounter('acknowledgements.' + name, DEFAULTS.acknowledgements[name]);
    var command = readCounter('commands.' + name, DEFAULTS.commands[name]);
    if (payload.id < acknowledgement || payload.id > command) throw new Error('FA_QX_COMMAND_INVALID');
    if ($prefs.setValueForKey(String(payload.id), NS + 'acknowledgements.' + name) !== true) throw new Error('FA_QX_PREF_WRITE_FAILED');
    return { acknowledged: payload.id };
  }

  function runtimeHealth(payload) {
    requireEmptyPayload(payload);
    var record = {
      release: '__FA_RELEASE__',
      buildId: '__FA_BUILD_ID__',
      coreVersion: null,
      schema: SCHEMA,
      timestamp: Date.now()
    };
    writeJson('health', record);
    return { release: record.release, buildId: record.buildId, coreVersion: record.coreVersion, schema: record.schema };
  }

  var request = typeof $request !== 'undefined' && $request ? $request : {};
  var raw = typeof request.body === 'string' ? request.body : '';
  var status = 200;
  var result;
  try {
    if (request.method !== 'POST') throw new Error('FA_QX_METHOD_DENIED');
    var route = typeof request.url === 'string' ? request.url.match(/^https:\/\/([^/?#]+)(\/[^?#]*)$/) : null;
    if (!route || route[2] !== BRIDGE_ROUTE) throw new Error('FA_QX_ROUTE_DENIED');
    var requestHost = route[1].toLowerCase();
    if (HOSTS.indexOf(requestHost) === -1) throw new Error('FA_QX_HOST_DENIED');
    if (utf8ByteLength(raw) > 524288) throw new Error('FA_QX_BODY_TOO_LARGE');
    var input = JSON.parse(raw || '{}');
    if (!hasOnlyKeys(input, ['operation', 'payload', 'release', 'buildId'])) throw new Error('FA_QX_REQUEST_INVALID');
    if (!Object.prototype.hasOwnProperty.call(OPERATIONS, input.operation)) throw new Error('FA_QX_OPERATION_DENIED');
    if (input.release !== '__FA_RELEASE__' || input.buildId !== '__FA_BUILD_ID__') throw new Error('FA_QX_VERSION_MISMATCH');
    var operation = OPERATIONS[input.operation];
    if (operation.storeOnly && requestHost !== MUTATION_HOST) throw new Error('FA_QX_HOST_DENIED');
    var data = operation.handler(input.payload);
    result = { ok: true, data: data };
  } catch (error) {
    var errorCode = publicErrorCode(error);
    status = /DENIED/.test(errorCode) ? 403 : 400;
    result = { ok: false, error: errorCode };
  }
  $done({
    status: 'HTTP/1.1 ' + status + (status === 200 ? ' OK' : status === 403 ? ' Forbidden' : ' Bad Request'),
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(result)
  });
})();
