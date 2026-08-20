# Steam App Family Navigation Layout Design

## Goal

Place the Steam family-library entry in the Steam App's existing mobile navigation row instead of creating a full-width row below it. The entry should read `家庭库 <count>`, match the surrounding navigation, remain tappable on narrow screens, and retain a polished fallback when Steam's DOM cannot be identified safely.

## Context

QX runtime 0.2.2 / core 2.06 can find the Steam App's non-link React wishlist control and insert the entry. The current insertion uses the matched text node's immediate parent. In the observed Steam App DOM, that parent is a vertical layout container, so the entry becomes a separate row between the navigation and page content.

## Approaches Considered

1. **Discover and insert into the existing navigation row — selected.** Starting from the wishlist control, walk upward to the smallest container that also contains the visible menu and wallet controls. Insert the family entry beside the wishlist item. This best matches Steam's native layout while avoiding brittle generated class names.
2. **Use fixed positioning over the header.** This would produce predictable coordinates but could overlap localized labels, safe areas, and future Steam controls. It is rejected.
3. **Always use a second-row pill.** This is visually safe but consumes vertical space and does not meet the preferred same-row layout. It remains only as the fallback.

## Navigation-Row Discovery

The core will derive a placement object from the already validated top wishlist control:

- Walk through a bounded number of ancestors.
- Select the smallest ancestor whose normalized visible text contains the top-level menu, wishlist, and wallet labels.
- Reject candidates outside the top-header area or candidates broad enough to represent the page body.
- Resolve the wishlist control's direct child within that row and insert the family entry immediately before it.
- Avoid reliance on Steam's generated React class names.

If no safe row is found, the core will keep the functional second-row insertion and apply an explicit fallback class.

## Visual Treatment

### Same-row entry

- Text: `家庭库 <count>`; omit `我的` to preserve room.
- Inherit the neighboring navigation item's text styling where safe.
- Use inline-flex alignment, a single line, compact horizontal padding, and a minimum 44px touch height.
- Prevent the count from wrapping away from the label.
- Allow the item to shrink its horizontal padding before any label wraps.
- Do not add a floating launcher or another duplicate entry.

### Fallback entry

- Render as one centered, compact pill below the navigation row.
- Use the existing Steam dark surface and muted border/text colors.
- Keep consistent side margins and a 44px minimum touch height.
- Do not span edge-to-edge or appear as unstyled body text.

## Runtime Behavior

The existing click handler, live game-count update, delayed React hydration protection, and duplicate-entry checks remain unchanged. `nav ✓` continues to mean that one usable navigation entry was inserted, whether same-row or fallback.

## Testing

Automated regression coverage will verify:

- A non-link React wishlist control resolves to the smallest row containing menu, wishlist, and wallet.
- The placement target is a direct child of that row rather than a descendant text node.
- Same-row insertion receives the compact layout class and `家庭库 <count>` label.
- An unresolvable row receives the styled fallback class.
- Only one navigation entry is inserted.
- The userscript and generated QX core remain synchronized.
- Existing QX build, security, bridge, storage, and mobile-layout tests remain green.

## Release

Publish the change as a new immutable QX release and userscript core version. Keep earlier release directories byte-identical. After publishing, verify the stable snippets, BoxJS metadata, userscript, and all new release assets byte-for-byte through GitHub Raw.
