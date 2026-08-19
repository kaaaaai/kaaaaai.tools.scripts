# Family Share Badge v2.04 Design

## Problem

On Steam Store mobile capsule cards, the non-compact `家庭共享` flag can render as a narrow purple strip while its text overflows outside the background. Steam's native collapsible flag CSS still controls sizing and horizontal positioning; the userscript currently overrides `max-width` and `overflow`, but does not establish a complete box model for the non-compact badge.

## Approved Visual Design

- Non-compact family-share flags render as a stable purple pill attached to the top-left of the media host.
- The pill contains the existing family icon followed by the text `家庭共享`.
- Target height is 24 CSS pixels, with the background fully containing icon and text.
- The badge uses compact padding, a rounded lower-right corner, and a subtle shadow for contrast over bright cover art.
- The existing `.fa-fs-compact` 20×20 icon-only treatment remains unchanged for horizontal list rows.
- Owned-library flags, bundle badges, contribution views, and other Steam UI remain unchanged.

## Implementation

- Add an explicit semantic non-compact class when creating a text family-share flag.
- Style that class with explicit `left`, `right`, `width`, `min-width`, `height`, `box-sizing`, padding, line-height, overflow, and background-position declarations using `!important` where Steam native CSS must be defeated.
- Replace trailing non-breaking spaces in the label with plain `家庭共享`; spacing is controlled by CSS.
- Keep the existing SVG icon and purple theme.
- Avoid broad changes to `.ds_flag`, because Steam and other scripts may use it for unrelated markers.

## Compatibility and Accessibility

- The label must remain readable at narrow Mobile Safari widths and must not create horizontal page scrolling.
- The title tooltip continues to identify which family members share the game.
- The pill remains `pointer-events:auto` through the existing shared flag rule.
- Desktop receives the same deterministic non-compact badge box, preventing the native Steam collapse rules from regressing there as well.

## Testing and Release

- Add a source-level regression test that asserts the semantic class, explicit box-model safeguards, unchanged compact rule, and absence of the old `家庭共享&nbsp;&nbsp;` label.
- Demonstrate RED before implementation and GREEN after implementation.
- Run userscript syntax validation, focused badge tests, the full mobile contribution suite, and the Stay compatibility suite.
- Synchronize `/Users/kaaaaai/Documents/KaiLab/Tools/s-f.js` byte-for-byte.
- Release as exactly v2.04, push `main` to `kaaaaai/kaaaaai.tools.scripts`, and verify the raw install URL serves HTTP 200 with v2.04 metadata.
