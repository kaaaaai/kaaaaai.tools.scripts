# Quantumult X Steam Family Full-Parity Design

## Objective

Port `steam-family-game-analysis.user.js` to Quantumult X and BoxJS while
keeping the userscript and Quantumult X editions functionally aligned.

The Quantumult X edition covers all three existing target origins:

- `https://store.steampowered.com/*`
- `https://keylol.com/*`
- `https://steamdb.keylol.com/tooltip*`

It must run inside the iOS Steam App embedded store view and in iOS browsers
whose traffic passes through Quantumult X. Functional behavior, calculations,
and available results must match the current userscript. The mobile UI may be
reflowed for touch and narrow screens; pixel-for-pixel desktop parity is not a
requirement.

Quantumult X data starts independently from Stay or Tampermonkey data. The user
will perform a fresh family-library scan instead of migrating existing caches.

## Confirmed Constraints

- Keep only the top Steam navigation entry. Do not add a bottom-right floating
  entry.
- Preserve every current analysis and marking feature, including Steam,
  Keylol, and SteamDB Keylol tooltip behavior.
- Use BoxJS as the Quantumult X settings and maintenance center in place of
  userscript menu commands.
- Keep full analysis data in browser storage and use Quantumult X preferences
  only for configuration and the compact cross-origin index.
- Keep the existing POC rewrite URL working so the installed Quantumult X
  profile does not require replacement.
- Never publish the user's full Quantumult X configuration.

## Selected Architecture

Use shared business and UI source code with separate runtime adapters and
generated distribution artifacts.

This is preferred over wrapping the existing monolithic userscript with a GM
polyfill because the current script and its dependencies are too large and too
tightly coupled to privileged userscript APIs for reliable response-body
injection. It is preferred over an independent Quantumult X fork because two
separate implementations would drift and could not sustainably satisfy parity.

The implementation is divided into five layers:

1. **Core** — family scanning, ownership models, wishlist aggregation,
   contribution calculations, activity, value, cooldown, DLC, GOTY, and bundle
   logic without direct browser-extension or Quantumult X calls.
2. **UI** — Steam entry and markers, the analysis panel, Keylol decorations,
   tooltip content, and responsive layouts.
3. **Userscript adapter** — GM storage, privileged requests, menu commands,
   style injection, and `unsafeWindow` integration.
4. **Quantumult X adapter** — response injection, virtual assets, the network
   bridge, preference synchronization, and BoxJS commands.
5. **Distribution** — generated userscript, Quantumult X bundles and snippet,
   manifest, checksums, and BoxJS application metadata.

Chart.js, the pinyin library, and the App Detail Library are bundled into
versioned distribution assets instead of being loaded through userscript
`@require` directives in the Quantumult X edition.

### Executable shared-source transition

The first full-parity QX release uses the tracked
`steam-family-game-analysis.user.js` body as the generated shared core instead
of maintaining a copied QX fork. A QX browser adapter supplies the userscript
capabilities (`GM_*`, `unsafeWindow`, style injection, and privileged request
callbacks) before that core is loaded. This preserves the exact v2.04 feature
surface immediately while keeping one authoritative UI/business source. Later
extraction into smaller core/UI modules may be mechanical and must not change
the adapter contract or visible behavior.

Privileged page requests use a dedicated `script-analyze-echo-response` route,
because Quantumult X documents that this variant waits for the request body.
Sensitive Steam request data is carried only in the POST body and is never
placed in the virtual bridge URL. The existing health/configuration bridge
remains a body-free `script-echo-response` GET route.

## Runtime and Asset Loading

Quantumult X response rules inject a small, idempotent bootstrap into eligible
HTML responses. The bootstrap loads versioned JavaScript bundles through
same-origin virtual paths handled by Quantumult X. This avoids embedding the
entire application in every HTML response and avoids relying on cross-origin
script loading that a page CSP may reject.

The runtime is split into focused assets:

- bootstrap and version handshake;
- runtime adapter and network client;
- shared core and UI;
- bundled third-party dependencies loaded only when required.

Every asset carries a release version and build identifier. The bootstrap
starts the application only when the manifest and required assets report the
same release. A mismatch leaves the host page untouched and exposes a refresh
instruction through the optional diagnostic badge.

Injection is idempotent across page restores, React hydration, and repeated
response processing. The existing POC diagnostic remains available behind a
BoxJS debug switch but is hidden by default.

## Network Bridge

Page code calls a same-origin virtual bridge using named operations rather than
arbitrary URLs. Examples include:

- `family.getMembers`
- `family.getApps`
- `wishlist.get`
- `store.getItems`
- `store.getAppDetails`
- `playtime.get`
- `external.getBundleData`
- `external.getGotyData`
- `external.getExchangeRates`

The Quantumult X bridge validates the operation name, method, expected fields,
numeric identifiers, payload size, destination host, and response size. It then
constructs the upstream request from a fixed allowlist and executes it with
`$task.fetch`. Page code cannot supply an arbitrary upstream URL.

Steam access tokens and session-derived request values are used only for the
active request. They are never written to IndexedDB, Quantumult X `$prefs`,
BoxJS metadata, URLs used for bridge routing, or logs. Error reports use
operation names and redacted error codes instead of request bodies, cookies,
tokens, or full URLs.

All operations have explicit timeouts, bounded retries, concurrency limits,
and retryable/non-retryable error classification. Optional external data
failures degrade only the corresponding badge or analysis block.

## Storage and Cross-Origin Synchronization

### Full Steam data

The Steam origin IndexedDB is the authoritative store for:

- the complete family library and member model;
- wishlist data and metadata;
- price, playtime, DLC, GOTY, and bundle caches;
- computed analysis caches and UI state.

Updates are transactional. A scan writes a newly validated snapshot and swaps
it into place only after completion, so interruption or partial API failure
does not destroy the previous valid scan.

### Compact Quantumult X index

Keylol cannot access the Steam origin IndexedDB. After a successful Steam
scan, the page builds a compact cross-origin index containing only the fields
needed for Keylol and tooltip parity:

- application ID;
- owner member indexes;
- current member index;
- member display-name table;
- earliest recorded acquisition timestamp;
- schema version, source scan timestamp, chunk count, and checksum.

The index uses compact tuples and is split across versioned `$prefs` keys. A
manifest is committed last so readers never observe a partially written
version. Old chunks are removed only after the new manifest is valid.

If synchronization fails, the full Steam dataset remains valid. Keylol skips
family decorations, shows a non-blocking instruction to open Steam and resync,
and never attempts to infer incomplete ownership data. Bundle markers continue
to use their independent public-data cache.

### BoxJS preferences and commands

BoxJS stores only settings and maintenance state:

- automatic scanning;
- Steam store marking;
- debug badge and log level;
- cache status and last successful scan time;
- monotonically increasing command IDs for rescan, external-data refresh, and
  cache clearing;
- installed runtime, core, and build versions.

Commands are idempotent: a page remembers the last processed command ID and
executes a newer command once. Destructive commands require confirmation in
BoxJS or in the page UI. No secret or access-token input is offered.

## User Interface and Behavior

### Steam

- Add only the top-navigation “我的家庭库” entry.
- Preserve family-sharing, bundle-history, ownership, and DLC markers on the
  home, search, wishlist, app, and applicable dynamic Steam layouts.
- Open the complete analysis experience from the top entry.
- Preserve the current feature set: overview, sharing distribution, personal
  contribution, play activity, acquisition heatmaps, member insights, family
  wishlist, value insights, GOTY, DLC, bundle history, sharing cooldown,
  searches, filters, pagination, and cache controls.
- Preserve tab selection and detail-page scroll position when overlays close or
  the app view is restored.

Desktop layouts retain the current structure. Narrow Steam App and iPhone
layouts use single-column KPI cards, horizontally scrollable tabs and charts,
full-width detail views, touch-sized controls, natural text wrapping, and safe
area padding. Charts may scroll horizontally instead of being compressed below
legibility.

### Keylol and SteamDB Keylol tooltip

- Decorate Steam app links with the purple family-sharing badge when the game
  is supplied by another family member.
- Show owner names in the link tooltip.
- Decorate applicable games with the orange “进过 N 包” badge.
- Add owner count, owner names, earliest owner, and acquisition time to the
  SteamDB Keylol tooltip.
- Use compact mobile badges and natural wrapping so decorations do not obscure
  post content.

## Failure Handling

- Missing or invalid HTML, absent insertion points, and duplicate injection
  return or retain the original page safely.
- A bundle or version-handshake failure does not alter host navigation or core
  page content.
- A failed scan preserves the previous valid family snapshot.
- Corrupt IndexedDB records are quarantined by schema/version checks and prompt
  a rescan without repeated crash loops.
- Corrupt or incomplete compact-index chunks are ignored as a unit.
- Bridge failures produce bounded, user-readable status in the affected view;
  optional data blocks may retry without rebuilding the whole panel.
- React or dynamically inserted content is handled by idempotent observers with
  debounced rescans and explicit exclusions for the analysis UI itself.
- Debug logging is off by default and always redacts session information.

## Delivery Phases

One stable Quantumult X remote resource is upgraded through six independently
testable phases:

1. **Production runtime** — replace the visible POC with bootstrap, asset,
   storage, network, version, and BoxJS bridges.
2. **Family-library foundation** — top entry, scanning, persistence, and Steam
   family markers.
3. **Primary analysis** — overview, sharing distribution, personal
   contribution, and complete mobile layout.
4. **Deep analysis** — play activity, acquisition heatmaps, member insights,
   and value insights.
5. **Wishlist and cooldown** — wishlist enrichment and filters, prices, GOTY,
   DLC, bundle data, and sharing cooldown.
6. **Cross-site and parity closure** — Keylol, SteamDB tooltip, remaining Steam
   edge layouts, full parity matrix, and regression closure.

Each phase must be usable, versioned, testable on a real device, and reversible
to the preceding release. Phasing is an implementation and validation strategy;
the final acceptance target remains full v2.04 feature parity.

## Testing Strategy

### Shared-core tests

Fixed fixtures run through both build targets. Ownership, contribution,
wishlist, activity, value, heatmap, cooldown, DLC, GOTY, and bundle results must
match exactly for the same input.

### Adapter contract tests

Tests simulate:

- legacy and modern GM APIs;
- IndexedDB initialization, upgrades, quotas, and corruption;
- Quantumult X `$prefs`, `$task.fetch`, bridge validation, timeouts, and partial
  failures;
- compact-index chunk publication, checksum rejection, and rollback;
- BoxJS command deduplication and preference defaults.

### Page and layout tests

DOM fixtures cover Steam home, search, wishlist, app, DLC, React hydration,
Keylol dynamic posts, and SteamDB tooltip pages. Viewport checks cover desktop
and representative iPhone widths, including safe areas, overflow, tap target
sizes, top-entry presence, and bottom-right-entry absence.

### Security and release tests

- Scan tracked files for certificate material, passphrases, subscriptions,
  tokens, cookies, and exported Quantumult X profiles.
- Prove that every bridge request maps to a declared operation and allowlisted
  destination.
- Verify build versions, manifests, and checksums.
- Run all existing userscript regression tests for every shared-core change.
- Verify raw GitHub distribution files are reachable after publication.

Each phase also requires a real-device Steam App acceptance check because a
desktop DOM simulator cannot prove embedded-web-view routing, certificate
interception, CSP behavior, or app-specific lifecycle restoration.

## Publication and Compatibility

The currently installed
`quantumultx/steam-family/steam-family-poc.snippet` remains a supported stable
installer path and is generated with the production rules. A canonical
`quantumultx/steam-family/steam-family.snippet` is published for new installs;
both are generated from the same source and must be byte-equivalent.

The userscript and Quantumult X distributions may have different wrapper
version numbers, but both expose the same shared-core version and source commit.
Versioned build artifacts allow rollback without restoring or republishing the
user's private Quantumult X profile.

Before any GitHub mutation, the active GitHub CLI identity must be switched to
and verified as exactly `kaaaaai`. Pushes use the repository's
`kaaaaai.github.com` SSH profile and never force-push as part of normal release.

## Security Boundary

The private profile at
`/Users/kaaaaai/Downloads/quantumult_20260819170610.conf` and its backups must
never be committed, copied into documentation, or uploaded. They contain
private MITM and subscription material.

Only public Steam-specific snippets, source code, generated assets, tests,
checksums, and credential-free BoxJS metadata belong in this repository. The
repository must not contain certificates, P12 data, passphrases, proxy nodes,
subscription URLs from the private profile, cookies, account tokens, captured
response bodies, or device-specific secrets.

## Acceptance Criteria

The port is complete when:

1. The Steam App displays only the top family-library entry and every analysis
   view is usable at representative iPhone widths.
2. Steam, Keylol, and SteamDB tooltip functionality passes the parity matrix.
3. Shared calculations produce identical results in userscript and Quantumult
   X builds for the same fixtures.
4. Scans, app restarts, page restores, and network changes preserve or safely
   recover the last valid data.
5. BoxJS exposes equivalent settings and maintenance actions for userscript
   menu functionality.
6. Bridge allowlisting, log redaction, secret scanning, and private-profile
   isolation tests pass.
7. All existing and new automated tests pass, raw release assets are reachable,
   and real-device checks succeed for all six phases.

## Reference Capabilities

- Quantumult X JavaScript response rewriting:
  <https://github.com/crossutility/Quantumult-X/blob/master/rewrite.md>
- Quantumult X `$task.fetch` example:
  <https://github.com/crossutility/Quantumult-X/blob/master/sample-task.js>
- BoxJS Quantumult X integration:
  <https://github.com/chavyleung/scripts>
