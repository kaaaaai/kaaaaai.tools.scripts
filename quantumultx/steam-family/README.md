# Steam Family Sharing for Quantumult X

This release installs the complete Steam Family v2.04 core in Quantumult X.
It provides the top Steam navigation entry, family-library scanning and
persistence, Steam/Keylol markers, and the complete analysis interface while
using strictly allowlisted local bridges.

## Prerequisites

- Install and trust the Quantumult X CA certificate, enable HTTPS decryption
  for `store.steampowered.com`, and run the Quantumult X tunnel while loading
  Steam.
- Your existing profile must already enable the BoxJS Quantumult X rewrite
  resource. This module's BoxJS subscription supplies application settings; it
  does not add the BoxJS rewrite resource itself.
- Keep the full QX profile private; it must never be published. Its certificate
  and subscription material must never be published either. A private profile
  path may be mentioned in internal operational notes only, never copied into
  public artifacts.

## Install or refresh

For a new installation, add this canonical resource line under your existing
`[rewrite_remote]` section:

```text
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family.snippet, tag=Steam家庭库, update-interval=86400, opt-parser=false, enabled=true
```

Existing installations using the compatibility URL must keep this unchanged
installed resource line; it is byte-identical to the canonical snippet:

```text
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family-poc.snippet, tag=Steam家庭库POC, update-interval=86400, opt-parser=false, enabled=true
```

Refresh the remote rewrite resources (or reload the profile) and confirm the
resource is enabled. The runtime applies to the configured Steam and community
hosts; it does not modify unrelated profile sections.

Add this BoxJS application subscription, then use its **调试角标** setting to
enable the diagnostic badge when needed:

```text
https://cdn.jsdelivr.net/gh/kaaaaai/kaaaaai.tools.scripts@main/quantumultx/steam-family/boxjs.json
```

## Runtime status and diagnostics

The successful health badge is hidden unless debug is enabled. Enable
**调试角标** in BoxJS and refresh the affected page to show successful status.
A redacted failure badge may appear automatically even with debug off. With
debug off, no badge is ambiguous: it is both the normal successful state and a
possible sign that bootstrap never loaded. Enable **调试角标** before using the
badge as a health check. With debug enabled, these states have exact meanings:

- **No badge after debug was enabled and the page refreshed:** the page
  bootstrap or runtime asset did not load; first check the remote resource,
  HTTPS decryption, and tunnel.
- **`runtime ✓`:** the external page runtime loaded and began its startup
  health check.
- **`bridge ✓`:** the local bridge accepted the matching release and build and
  returned the health/configuration data. A successful diagnostic reads
  `FA QX 0.2.0 · runtime ✓ · bridge ✓ · core 2.04 ✓`.
- **`core 2.04 ✓`:** the compatibility adapter, pinned dependencies, and the
  full family-library core all loaded. The top “我的家庭库” entry is then
  installed by the same v2.04 UI source as the userscript edition.
- **Version mismatch:** `FA_QX_VERSION_MISMATCH` means the runtime and bridge
  release/build are from different versions; refresh the remote resource so
  both assets come from the same release directory.
- **Redacted error:** the badge displays only a safe `FA_QX_*` code (or
  `FA_QX_UNKNOWN`), never the upstream response body, preference values, or
  private configuration details.

## Current release

| Component | Value |
| --- | --- |
| Runtime | `0.2.0` |
| Core | `2.04` |
| Schema | `1` |
| Index schema | `1` |

## Emergency rollback or remove

To roll back to the bridge-only `0.1.1` release, replace only this module's remote-resource URL
with the immutable resource below, then refresh Quantumult X:

```text
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/72b0a4dd70be042456071d0dd47cf6b761608560/quantumultx/steam-family/steam-family.snippet
```

For the earlier injection-only diagnostic, use:

```text
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/c16b1c22b430088609f027edbbb9be32755d4cff/quantumultx/steam-family/rollback/poc-7425947.snippet
```

You can restore the main compatibility URL later by replacing only this
module's remote-resource URL again and refreshing Quantumult X. Never restore,
edit, replace, or publish the full private profile.

To remove the module, delete only the single Steam family remote-resource line
from the profile and refresh Quantumult X. Leave every other remote resource
and profile section unchanged.
