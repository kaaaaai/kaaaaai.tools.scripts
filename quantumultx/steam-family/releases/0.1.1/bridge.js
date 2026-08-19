(function () {
  var NS = 'kaaaaai.steam-family-qx.';
  var SCHEMA = 1;
  var INDEX_SCHEMA = 1;
  var HOSTS = ["store.steampowered.com","keylol.com","steamdb.keylol.com"];
  var BRIDGE_ROUTE = '/fa-qx/v1/bridge';
  var MUTATION_HOST = 'store.steampowered.com';
  var OPERATIONS = {
    'runtime.health': { handler: runtimeHealth, storeOnly: false },
    'config.get': { handler: configGet, storeOnly: false },
    'command.ack': { handler: commandAck, storeOnly: true },
    'index.publish': { handler: indexPublish, storeOnly: true },
    'index.read': { handler: indexRead, storeOnly: false },
    'index.clear': { handler: indexClear, storeOnly: true }
  };
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

  function manifestKey() { return 'index.manifest'; }
  function validationKey() { return 'index.validation'; }
  function stagingManifestKey() { return 'index.staging.manifest'; }
  function stagingKey(chunkIndex) { return 'index.staging.chunk.' + chunkIndex; }
  function chunkKey(generation, chunkIndex) { return 'index.chunk.' + generation + '.' + chunkIndex; }

  function validateManifest(value) {
    if (!hasOnlyKeys(value, ['schema', 'generation', 'sourceUpdatedAt', 'chunks', 'checksum']) || value.schema !== INDEX_SCHEMA || !isSafeInteger(value.generation) || value.generation <= 0 ||
      !isSafeInteger(value.sourceUpdatedAt) || value.sourceUpdatedAt < 0 || !isSafeInteger(value.chunks) ||
      value.chunks < 1 || value.chunks > 32 || typeof value.checksum !== 'string' || !/^[0-9a-f]{8}$/.test(value.checksum)) {
      throw new Error('FA_QX_INDEX_INVALID');
    }
    return value;
  }

  function parseManifest(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw !== 'string') return INVALID;
    try { return validateManifest(JSON.parse(raw)); } catch (_) { return INVALID; }
  }

  function installedRecord() {
    var raw = preference(manifestKey());
    return { raw: raw, manifest: parseManifest(raw) };
  }

  function manifestMatches(left, right) {
    return left !== null && left !== INVALID && right !== null && right !== INVALID &&
      left.schema === right.schema && left.generation === right.generation &&
      left.sourceUpdatedAt === right.sourceUpdatedAt && left.chunks === right.chunks && left.checksum === right.checksum;
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

  function removeAndVerify(key) {
    try {
      $prefs.removeValueForKey(NS + key);
      var remaining = preference(key);
      if (remaining !== null && remaining !== undefined) throw new Error('FA_QX_PREF_DELETE_FAILED');
    } catch (_) {
      throw new Error('FA_QX_PREF_DELETE_FAILED');
    }
  }

  function removeBestEffort(key) {
    try { $prefs.removeValueForKey(NS + key); } catch (_) {}
  }

  function writeTextVerified(key, value) {
    if ($prefs.setValueForKey(value, NS + key) !== true || preference(key) !== value) throw new Error('FA_QX_PREF_WRITE_FAILED');
  }

  function writeJsonVerified(key, value) {
    writeTextVerified(key, JSON.stringify(value));
  }

  function removeGenerationBestEffort(manifest) {
    if (manifest === null || manifest === INVALID) return;
    for (var index = 0; index < manifest.chunks; index += 1) removeBestEffort(chunkKey(manifest.generation, index));
  }

  function clearStagingSlotsBestEffort() {
    for (var index = 0; index < 32; index += 1) removeBestEffort(stagingKey(index));
  }

  function clearStagingBestEffort() {
    removeBestEffort(stagingManifestKey());
    clearStagingSlotsBestEffort();
  }

  function invalidateValidationRequired() { removeAndVerify(validationKey()); }
  function invalidateValidationBestEffort() { removeBestEffort(validationKey()); }

  function recoverInstalledForMutation() {
    var record = installedRecord();
    if (record.manifest !== INVALID) return record;
    removeAndVerify(manifestKey());
    invalidateValidationBestEffort();
    return { raw: null, manifest: null };
  }

  function replaceStaging(manifest) {
    removeAndVerify(stagingManifestKey());
    clearStagingSlotsBestEffort();
    writeJsonVerified(stagingManifestKey(), manifest);
  }

  function stagingManifest() {
    return parseManifest(preference(stagingManifestKey()));
  }

  function prepareStaging(manifest) {
    var staged = stagingManifest();
    if (staged === null || staged === INVALID) {
      replaceStaging(manifest);
      return;
    }
    if (manifestMatches(staged, manifest)) return;
    if (manifest.generation < staged.generation) throw new Error('FA_QX_INDEX_ROLLBACK');
    if (manifest.generation === staged.generation) throw new Error('FA_QX_INDEX_CONFLICT');
    replaceStaging(manifest);
  }

  function stageIndex(payload) {
    if (!hasOnlyKeys(payload, ['phase', 'manifest', 'chunkIndex', 'chunk']) || payload.phase !== 'stage') throw new Error('FA_QX_INDEX_INVALID');
    var manifest = validateManifest(payload.manifest);
    if (!isSafeInteger(payload.chunkIndex) || payload.chunkIndex < 0 || payload.chunkIndex >= manifest.chunks ||
      typeof payload.chunk !== 'string' || utf8ByteLength(payload.chunk) > 98304) throw new Error('FA_QX_INDEX_INVALID');
    var current = recoverInstalledForMutation();
    if (current.manifest !== null && manifest.generation <= current.manifest.generation) throw new Error('FA_QX_INDEX_ROLLBACK');
    prepareStaging(manifest);
    var key = stagingKey(payload.chunkIndex);
    var existing = preference(key);
    if (existing === payload.chunk) return { staged: payload.chunkIndex };
    if (existing !== null && existing !== undefined) throw new Error('FA_QX_INDEX_CONFLICT');
    try {
      writeTextVerified(key, payload.chunk);
    } catch (error) {
      removeBestEffort(key);
      throw error;
    }
    return { staged: payload.chunkIndex };
  }

  function readStagedChunks(manifest) {
    if (!manifestMatches(stagingManifest(), manifest)) throw new Error('FA_QX_INDEX_CONFLICT');
    var chunks = [];
    for (var index = 0; index < manifest.chunks; index += 1) {
      var chunk = preference(stagingKey(index));
      if (typeof chunk !== 'string') throw new Error('FA_QX_INDEX_CORRUPT');
      chunks.push(chunk);
    }
    if (fnv1a(chunks.join('')) !== manifest.checksum) throw new Error('FA_QX_INDEX_CORRUPT');
    return chunks;
  }

  function validationMarker(manifest) {
    return { generation: manifest.generation, checksum: manifest.checksum, chunks: manifest.chunks };
  }

  function restorePointer(raw) {
    try {
      if (typeof raw === 'string' && raw !== '') writeTextVerified(manifestKey(), raw);
      else removeAndVerify(manifestKey());
    } catch (_) {}
  }

  function commitIndex(payload) {
    if (!hasOnlyKeys(payload, ['phase', 'manifest']) || payload.phase !== 'commit') throw new Error('FA_QX_INDEX_INVALID');
    var manifest = validateManifest(payload.manifest);
    var current = recoverInstalledForMutation();
    if (current.manifest !== null && manifest.generation <= current.manifest.generation) throw new Error('FA_QX_INDEX_ROLLBACK');
    var chunks = readStagedChunks(manifest);
    try {
      for (var chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        writeTextVerified(chunkKey(manifest.generation, chunkIndex), chunks[chunkIndex]);
      }
      invalidateValidationRequired();
      writeJsonVerified(validationKey(), validationMarker(manifest));
      writeJsonVerified(manifestKey(), manifest);
    } catch (error) {
      restorePointer(current.raw);
      invalidateValidationBestEffort();
      removeGenerationBestEffort(manifest);
      throw error;
    }
    removeGenerationBestEffort(current.manifest);
    clearStagingBestEffort();
    return { generation: manifest.generation };
  }

  function indexPublish(payload) {
    if (!isObject(payload)) throw new Error('FA_QX_INDEX_INVALID');
    if (payload.phase === 'stage') return stageIndex(payload);
    if (payload.phase === 'commit') return commitIndex(payload);
    throw new Error('FA_QX_INDEX_INVALID');
  }

  function parsedValidationMarker(raw) {
    if (typeof raw !== 'string' || raw === '') return null;
    try {
      var marker = JSON.parse(raw);
      return hasOnlyKeys(marker, ['generation', 'checksum', 'chunks']) ? marker : null;
    } catch (_) {
      return null;
    }
  }

  function markerMatches(marker, manifest) {
    return marker !== null && marker.generation === manifest.generation && marker.checksum === manifest.checksum && marker.chunks === manifest.chunks;
  }

  function scanInstalledChunks(manifest) {
    var chunks = [];
    try {
      for (var index = 0; index < manifest.chunks; index += 1) {
        var chunk = preference(chunkKey(manifest.generation, index));
        if (typeof chunk !== 'string') throw new Error('FA_QX_INDEX_CORRUPT');
        chunks.push(chunk);
      }
      if (fnv1a(chunks.join('')) !== manifest.checksum) throw new Error('FA_QX_INDEX_CORRUPT');
    } catch (_) {
      invalidateValidationBestEffort();
      throw new Error('FA_QX_INDEX_CORRUPT');
    }
    writeJsonVerified(validationKey(), validationMarker(manifest));
    return chunks;
  }

  function readableInstalled() {
    var record = installedRecord();
    if (record.manifest === INVALID) {
      invalidateValidationBestEffort();
      throw new Error('FA_QX_INDEX_CORRUPT');
    }
    return record.manifest;
  }

  function indexRead(payload) {
    if (!isObject(payload)) throw new Error('FA_QX_INDEX_INVALID');
    if (payload.part === 'manifest') {
      if (!hasOnlyKeys(payload, ['part'])) throw new Error('FA_QX_INDEX_INVALID');
      var manifest = readableInstalled();
      if (manifest === null) return null;
      var marker = parsedValidationMarker(preference(validationKey()));
      if (!markerMatches(marker, manifest)) {
        invalidateValidationBestEffort();
        scanInstalledChunks(manifest);
      }
      return manifest;
    }
    if (!hasOnlyKeys(payload, ['part', 'generation', 'chunkIndex']) || payload.part !== 'chunk') throw new Error('FA_QX_INDEX_INVALID');
    var installed = readableInstalled();
    if (installed === null || payload.generation !== installed.generation || !isSafeInteger(payload.chunkIndex) ||
      payload.chunkIndex < 0 || payload.chunkIndex >= installed.chunks) throw new Error('FA_QX_INDEX_INVALID');
    var validation = parsedValidationMarker(preference(validationKey()));
    var chunks = markerMatches(validation, installed) ? null : scanInstalledChunks(installed);
    var requested = chunks === null ? preference(chunkKey(installed.generation, payload.chunkIndex)) : chunks[payload.chunkIndex];
    if (typeof requested !== 'string') {
      invalidateValidationBestEffort();
      throw new Error('FA_QX_INDEX_CORRUPT');
    }
    return { chunk: requested, checksum: fnv1a(requested) };
  }

  function indexClear(payload) {
    requireEmptyPayload(payload);
    var record = installedRecord();
    if (record.raw !== null && record.raw !== undefined && record.raw !== '') removeAndVerify(manifestKey());
    invalidateValidationBestEffort();
    removeGenerationBestEffort(record.manifest);
    clearStagingBestEffort();
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
      release: '0.1.1',
      buildId: '29751cc25d50',
      coreVersion: null,
      schema: SCHEMA,
      timestamp: Date.now()
    };
    writeJson('health', record);
    return { release: record.release, buildId: record.buildId, coreVersion: record.coreVersion, schema: record.schema };
  }

  var request = typeof $request !== 'undefined' && $request ? $request : {};
  var raw = '';
  var status = 200;
  var result;
  try {
    if (request.method !== 'GET') throw new Error('FA_QX_METHOD_DENIED');
    var route = typeof request.url === 'string' ? request.url.match(/^https:\/\/([^/?#]+)(\/[^?#]*)\?request=([^&#]+)$/) : null;
    if (!route || route[2] !== BRIDGE_ROUTE) throw new Error('FA_QX_ROUTE_DENIED');
    var requestHost = route[1].toLowerCase();
    if (HOSTS.indexOf(requestHost) === -1) throw new Error('FA_QX_HOST_DENIED');
    try { raw = decodeURIComponent(route[3]); } catch (_) { throw new Error('FA_QX_REQUEST_INVALID'); }
    if (utf8ByteLength(raw) > 524288) throw new Error('FA_QX_BODY_TOO_LARGE');
    var input = JSON.parse(raw || '{}');
    if (!hasOnlyKeys(input, ['operation', 'payload', 'release', 'buildId'])) throw new Error('FA_QX_REQUEST_INVALID');
    if (!Object.prototype.hasOwnProperty.call(OPERATIONS, input.operation)) throw new Error('FA_QX_OPERATION_DENIED');
    if (input.release !== '0.1.1' || input.buildId !== '29751cc25d50') throw new Error('FA_QX_VERSION_MISMATCH');
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
