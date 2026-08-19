# Quantumult X Steam App Injection POC Design

## Objective

Prove whether Quantumult X can modify the Steam Store homepage response used inside the iOS Steam App and whether JavaScript injected into that response executes in the embedded web view.

This phase is diagnostic only. It does not port the Steam Family Analysis userscript, access Steam APIs, scan the family library, or add BoxJS preferences.

## Security Boundary

The exported Quantumult X profile at `/Users/kaaaaai/Downloads/quantumult_20260819170610.conf` must never be committed or uploaded. It contains:

- an active MITM certificate passphrase;
- an embedded P12 certificate payload;
- remote proxy subscription URLs that must be treated as credentials.

The public repository contains only the Steam-specific rewrite snippet, response script, tests, and documentation. The local profile receives one public `[rewrite_remote]` URL after a timestamped local backup is created. No certificate, subscription, hostname list, proxy policy, or other profile content is copied into the repository.

## Selected Approach

Use a Quantumult X `script-response-body` rule to modify only the Steam Store homepage HTML response.

The imported rewrite snippet carries its own MITM hostname:

```text
hostname = store.steampowered.com
^https:\/\/store\.steampowered\.com\/(?:\?.*)?$ url script-response-body https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family-poc.js
```

The narrow URL pattern deliberately excludes app pages, authentication, checkout, APIs, images, scripts, and other static resources.

## Repository Layout

```text
quantumultx/steam-family/
├── README.md
├── steam-family-poc.js
└── steam-family-poc.snippet
tests/
└── qx-steam-family-poc.test.cjs
```

### `steam-family-poc.snippet`

- Declares only `store.steampowered.com` as its MITM hostname.
- Matches only `https://store.steampowered.com/` with an optional query string.
- Loads the response script from the existing public repository.
- Contains no credentials or device-specific values.

### `steam-family-poc.js`

- Runs in the Quantumult X response-script environment.
- Checks that `$response.body` looks like HTML before modifying it.
- Is idempotent: if `id="fa-qx-poc"` already exists, it returns the original response.
- Injects a small fixed diagnostic badge immediately before `</body>`; if no closing body exists, it returns the original response unchanged.
- Calls `$done({ body })` exactly once on every path.
- Does not log response bodies, cookies, headers, account identifiers, or URLs containing query data.

## Diagnostic Badge

The injected HTML initially displays:

```text
FA QX · HTML ✓ · JS …
```

An inline script changes the final state to:

```text
FA QX · HTML ✓ · JS ✓
```

Interpretation:

- No badge: the request did not match, MITM is inactive/untrusted, Steam did not use the target URL, or Steam uses certificate pinning.
- `HTML ✓ · JS …`: response rewriting worked, but the web view or Content Security Policy blocked inline JavaScript.
- `HTML ✓ · JS ✓`: the full proof-of-concept chain works and a page-side compatibility layer is feasible.

The badge is fixed above the bottom safe area, uses a very high stacking layer, stays within the viewport, and has `pointer-events:none` so it cannot intercept Steam controls.

## Local Profile Integration

Before editing the downloaded profile:

1. Create a timestamped backup next to the original file.
2. Insert exactly one enabled resource line under `[rewrite_remote]`:

```text
https://raw.githubusercontent.com/kaaaaai/kaaaaai.tools.scripts/main/quantumultx/steam-family/steam-family-poc.snippet, tag=Steam家庭库POC, update-interval=86400, opt-parser=false, enabled=true
```

3. Preserve every other byte of the profile, including its private MITM material and subscriptions.
4. Never commit either the original profile or its backup.

The user will import or refresh this local profile in Quantumult X, ensure the Quantumult X CA remains installed and trusted, enable the rewrite resource, start the Quantumult X tunnel, then open the Steam Store homepage inside the Steam App.

## Testing

Automated tests statically verify:

- the snippet has the exact homepage-only URL rule and MITM hostname;
- all remote URLs point to `kaaaaai/kaaaaai.tools.scripts`;
- the response script rejects non-HTML and missing-body responses;
- duplicate injection is prevented;
- the marker contains separate HTML and JavaScript states;
- the marker respects safe-area placement and does not capture pointer input;
- `$done` is reached exactly once per execution path;
- no credential-like fields or exported Quantumult X profile content enter the repository.

Local validation also runs the existing userscript suites to ensure the new standalone QX files do not affect v2.04.

## Publication and Acceptance

After review and tests:

1. Verify the active GitHub CLI identity is exactly `kaaaaai`.
2. Push `main` without force.
3. Verify both raw POC files return HTTP 200 and contain the expected rule/version marker.
4. Back up and patch the local Quantumult X profile.
5. Ask the user to report one of the three diagnostic outcomes from the Steam App.

Only a confirmed `HTML ✓ · JS ✓` result advances the project to the full userscript compatibility design. BoxJS preferences and the full Steam Family Analysis UI are explicitly deferred until that result.
