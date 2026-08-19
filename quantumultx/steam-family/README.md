# Steam Family Sharing POC

This public Quantumult X module adds a small diagnostic badge to Steam HTML
responses. It is a rewrite proof of concept, not the full Steam Family Sharing
interface.

## Remote resource

Add this exact block to the `[rewrite_remote]` section of the Quantumult X
profile:

```text
[rewrite_remote]
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family-poc.snippet
```

The module matches only `store.steampowered.com` with an optional query string
and uses that same hostname for HTTPS interception.

## Prerequisites

- Install the Quantumult X CA certificate on the device and enable trust for
  the certificate in the operating system's certificate-trust settings.
- Enable the Quantumult X HTTPS tunnel and ensure the tunnel is active while
  opening Steam. HTTPS decryption must be enabled for
  `store.steampowered.com`.
- Use a normal Steam page that returns HTML; API responses and other response
  bodies are intentionally left unchanged.

## Install or refresh

1. Add the remote resource block above to `[rewrite_remote]`.
2. In Quantumult X, refresh the remote rewrite resources (or reload the
   profile) and confirm that the resource is enabled.
3. Open or reload the Steam store page while the Quantumult X tunnel is
   running.

## Diagnostic badge

- No badge: the response was not intercepted as eligible HTML, or the module
  was not enabled.
- `FA QX · HTML ✓ · JS …`: the HTML rewrite ran, but the page's JavaScript
  completion check is still pending or did not execute.
- `FA QX · HTML ✓ · JS ✓`: the HTML rewrite ran and the page executed the
  diagnostic JavaScript.

The badge is diagnostic-only and does not capture pointer input.

## Remove the module

Delete only the single remote resource line below from the Quantumult X
profile, leave all other profile sections unchanged, and refresh the remote
rewrite resources:

```text
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family-poc.snippet
```

Never publish an exported complete Quantumult X profile. Keep private
certificates, credentials, proxies, subscriptions, cookies, headers, and
account-specific settings out of public files.
