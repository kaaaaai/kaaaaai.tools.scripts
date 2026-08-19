# Steam Family Sharing POC

This public Quantumult X module adds a small diagnostic badge to Steam HTML
responses. It is a rewrite proof of concept, not the full Steam Family Sharing
interface.

## Remote resource

Add this exact line under your existing `[rewrite_remote]` section of the
Quantumult X profile:

```text
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family-poc.snippet, tag=Steam家庭库POC, update-interval=86400, opt-parser=false, enabled=true
```

The module matches only `https://store.steampowered.com/`, the root homepage,
optionally followed only by a query string. App, login, checkout, API, and
static paths are excluded. It uses exactly `store.steampowered.com` as the
hostname for HTTPS interception.

## Prerequisites

- Install the Quantumult X CA certificate on the device and enable trust for
  the certificate in the operating system's certificate-trust settings.
- Enable the Quantumult X HTTPS tunnel and ensure the tunnel is active while
  opening Steam. HTTPS decryption must be enabled for
  `store.steampowered.com`.
- Open exactly `https://store.steampowered.com/`, the root homepage with an
  optional query string only. App, login, checkout, API, and static paths are
  excluded.

## Install or refresh

1. Add the exact remote resource line above under your existing
   `[rewrite_remote]` section.
2. In Quantumult X, refresh the remote rewrite resources (or reload the
   profile) and confirm that the resource is enabled.
3. Open or reload exactly `https://store.steampowered.com/` while the
   Quantumult X tunnel is running; only an optional query string may follow
   the root slash.

## Diagnostic badge

- No badge: the response was not intercepted as eligible HTML, or the module
  was not enabled.
- `FA QX · HTML ✓ · JS …`: the HTML rewrite ran, but Content Security Policy
  (CSP) or the embedded web-view policy may have blocked inline JavaScript.
- `FA QX · HTML ✓ · JS ✓`: the HTML rewrite ran and the page executed the
  diagnostic JavaScript.

The badge is diagnostic-only and does not capture pointer input.

## Remove the module

Delete only the single remote resource line below from the Quantumult X
profile, leave all other profile sections unchanged, and refresh the remote
rewrite resources:

```text
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family-poc.snippet, tag=Steam家庭库POC, update-interval=86400, opt-parser=false, enabled=true
```

Never publish an exported complete Quantumult X profile. Keep private
certificates, credentials, proxies, subscriptions, cookies, headers, and
account-specific settings out of public files.
