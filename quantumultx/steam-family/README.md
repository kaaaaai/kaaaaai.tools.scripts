# Steam Family Sharing for Quantumult X

This is the Phase 1 Steam Family runtime for Quantumult X. It installs a
small page runtime and a strictly allowlisted local bridge; it does **not** yet
scan or import a Steam Family library.

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
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/boxjs.json
```

## Runtime status and diagnostics

The diagnostic badge is hidden by default. After enabling **调试角标** in BoxJS
and refreshing the affected page, these states have exact meanings:

- **No runtime:** no `FA QX` badge means the page bootstrap or runtime asset did
  not load; first check the remote resource, HTTPS decryption, and tunnel.
- **`runtime ✓`:** the external page runtime loaded and began its startup
  health check.
- **`bridge ✓`:** the local bridge accepted the matching release and build and
  returned the health/configuration data. A successful diagnostic reads
  `FA QX 0.1.0 · runtime ✓ · bridge ✓`.
- **Version mismatch:** `FA_QX_VERSION_MISMATCH` means the runtime and bridge
  release/build are from different versions; refresh the remote resource so
  both assets come from the same release directory.
- **Redacted error:** the badge displays only a safe `FA_QX_*` code (or
  `FA_QX_UNKNOWN`), never the upstream response body, preference values, or
  private configuration details.

## Current release

| Component | Value |
| --- | --- |
| Runtime | `0.1.0` |
| Core | `not installed` |
| Schema | `1` |
| Index schema | `1` |

## Rollback or remove

To roll back, change only the snippet's release asset references from
`releases/0.1.0/` to a prior versioned directory, then refresh Quantumult X.
Do not replace or publish the complete profile.

To remove the module, delete only the single Steam family remote-resource line
from the profile and refresh Quantumult X. Leave every other remote resource
and profile section unchanged.
