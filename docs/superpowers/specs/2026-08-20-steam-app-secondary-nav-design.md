# Steam App Secondary Family Navigation Design

## Goal

Replace the rounded fallback family-library pill with a flat Steam-style secondary navigation bar. The result should look intentional beside Steam's mobile header while preserving the existing same-row placement when that placement can be identified safely.

## Context

QX 0.2.3 / core 2.07 inserts a working `家庭库 <count>` entry and reports `nav ✓`. On the observed Steam App page, the native row resolver cannot identify a safe common container, so the fallback is used. The fallback's outlined capsule, large radius, and isolated left-side shape do not match Steam's flat dark navigation language.

## Selected Approach

Use a full-width, flat secondary navigation bar for fallback placement. This is more stable than forcing generated React DOM into a same-row structure and more cohesive than a floating or outlined control.

The existing placement priority remains:

1. Insert into the native navigation row when a safe row is found.
2. Otherwise render the flat secondary navigation bar at the current functional fallback insertion point.

## Visual Specification

- Width: fill the available parent width.
- Minimum height: `48px`, with the entire row tappable.
- Layout: horizontal flex, vertically centered, left aligned.
- Horizontal padding: `20px`, respecting the mobile content edge.
- Background: Steam header dark `#171d25`.
- Dividers: subtle one-pixel top and bottom lines using low-opacity white.
- Border radius: none.
- Outer border: none beyond the top and bottom dividers.
- Shadow: none.
- Icon: `16px`, Steam blue `#66c0f4`, vertically centered without the previous top offset.
- Label: `家庭库`, `14px`, weight `400`, color `#dcdedf`.
- Count: live value, `12px`, color `#8f98a0`.
- Spacing: `6px` between icon, label, and count.
- Text: single line with no wrapping.
- Press feedback: label/icon color changes to `#1a9fff` while activated; no persistent active underline because opening an overlay does not change the current Steam route.

## DOM and Behavior

The existing `setting_btn` element, click handler, live `.fa-menu-count` update, hydration delay, duplicate guards, and `nav ✓` reporting remain unchanged. Only fallback presentation changes. Native same-row styling remains compact and untouched.

The fallback element receives the existing `fa-family-nav-fallback` class plus an explicit `data-fa-nav-mode="fallback"` hook. Interaction feedback uses pointer/touch events or CSS injected by the userscript without relying on generated Steam class names.

## Accessibility and Resilience

- Preserve the anchor/button semantics and full-row cursor behavior.
- Keep a minimum 48px touch target.
- Do not add a floating launcher or duplicate entry.
- If Steam supplies inherited styles with higher specificity, fallback-critical geometry and colors are set directly by the style helper.
- The bar remains functional even if press feedback cannot be applied.

## Testing

Regression coverage will verify:

- Fallback mode uses full width, `48px` minimum height, flat corners, Steam dark background, and `20px` horizontal padding.
- Fallback mode has only subtle top/bottom dividers and no capsule outline.
- The icon no longer has a positive top offset in fallback mode.
- Same-row mode retains its existing compact geometry.
- The live count and click handler remain present.
- Only one family navigation entry is inserted.
- The userscript and standalone `s-f.js` remain byte-identical.
- Existing QX, security, storage, bridge, and mobile-layout suites remain green.

## Release

Publish as a new immutable QX runtime and userscript core version. Keep all previous release directories byte-identical, retain the stable subscription URLs, and verify every new GitHub Raw artifact byte-for-byte after pushing.
