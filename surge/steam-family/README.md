# Steam Family for Surge

Surge adapter for this repository's Quantumult X Steam Family v0.2.4 release. It serves the same page runtime and assets through Surge `http-request` scripts, stores bridge state with `$persistentStore`, and makes allowlisted upstream requests with `$httpClient`.

Install this module in Surge:

`https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/surge/steam-family/Steam-Family.sgmodule`

Enable Surge HTTPS decryption for the module's three hostnames and trust its certificate on the device. The module does not include a subscription, profile certificate, or private account data.

`node --test surge/steam-family/test-surge.cjs` verifies the synthetic responses, storage, proxy allowlist, asset bridge, and page injection with mocked Surge APIs. Real Steam web pages and iOS Surge behavior still require on-device testing. The diagnostic namespace keeps its QX release label so its baked runtime and bridge can complete the version handshake.
