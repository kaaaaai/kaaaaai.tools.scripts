# Mobile Contribution Layout Design

## Goal

Optimize all three contribution views in the Steam Family Analysis userscript for iPhone Safari and other narrow mobile viewports while preserving the current desktop layout:

1. Contribution overview
2. My contribution
3. Shared-distribution detail

Remove the floating bottom-right mobile launcher. The injected Steam top-navigation entry remains the only visible page entry.

## Scope

### Included

- Mobile layout at viewport widths up to 600px.
- Portrait and landscape phone layouts.
- Touch-friendly contribution charts and controls.
- Stable vertical scrolling inside the existing analysis panel.
- Responsive layout hooks for the three contribution views.
- Regression tests for launcher removal and mobile contribution rules.
- Version bump and publication to the existing GitHub userscript repository.

### Excluded

- Redesigning non-contribution tabs.
- Changing contribution calculations or persisted data.
- Replacing Chart.js.
- Changing desktop layout above 600px.
- Adding a new navigation system or a separate mobile renderer.

## Chosen Direction

Use a single-column vertical information flow on mobile. This maximizes chart width, avoids nested horizontal gestures, and makes all information reachable through one predictable scroll axis.

Alternatives considered:

- Accordion cards reduce first-screen density but hide comparisons and add repeated taps.
- Horizontal paging shortens each page but conflicts with the panel's horizontally scrollable navigation and weakens discoverability.

## Entry Behavior

- Delete the `fa-mobile-launcher` element, its styles, bootstrap calls, and related tests.
- Preserve the existing top navigation injection and game-count badge.
- Preserve desktop fallback entries and userscript-manager menu commands.
- Do not replace the floating launcher with another fixed or sticky page-level control.

## Contribution Overview

Desktop keeps the current three-column layout. On mobile, the content order becomes:

1. Family membership summary and contribution KPI cards.
2. Main member-contribution bar chart.
3. Member-share summary.
4. Six-month library growth card.
5. Last-scan information, store-marking toggle, and export actions.

Mobile behavior:

- Use explicit semantic class/data hooks rather than CSS substring selectors.
- Convert the summary/KPI region into a full-width summary followed by a two-column KPI grid.
- Put the cumulative/six-month range switch in normal document flow above the chart instead of absolutely positioning it over the canvas.
- Give each range control a minimum 44px touch target and at least 8px separation.
- Keep the member bar chart full width and vertically sized for at most six family members.
- Show a visible tap hint below the chart; tapping a member bar opens shared-distribution detail exactly as the current click interaction does.
- Stack the member-share and six-month cards vertically at full width.
- Place the store-marking control on its own row and arrange CSV/JSON export buttons in a two-column action row.

## My Contribution

The overlay remains part of the contribution tab and continues to reuse existing calculations.

Mobile behavior:

- Add a sticky in-panel header with a clear back action and the current view title.
- Use a two-column KPI grid; a final odd card spans the remaining width when necessary.
- Stack recent contributions, contribution categories, and recent-play sections vertically.
- Allow names and secondary metadata to wrap instead of truncating or forcing horizontal overflow.
- Make tappable rows and return controls at least 44px tall.
- Preserve the scroll position of the underlying contribution tab when returning to the default view.

## Shared-Distribution Detail

Desktop retains the existing two-column comparison and game-list layout.

Mobile behavior:

- Add the same sticky in-panel header pattern used by My Contribution.
- Order content as member contribution comparison, owner-count distribution, then shared-game list.
- Convert all multi-column blocks to a single column.
- Render game rows full width, allow the name/metadata area to wrap, and keep touch actions separated from text.
- Preserve current sorting, contribution values, filtering, and back behavior.

## Shared Mobile Layout Rules

- Breakpoint: `max-width: 600px` only.
- Horizontal content gutter: 10–12px, following the existing mobile panel spacing.
- Vertical spacing follows a 4/8px rhythm with 12–16px section separation.
- Minimum interactive target: 44×44 CSS pixels.
- No contribution view may introduce horizontal page scrolling.
- Internal content uses a single vertical scroll container with `overscroll-behavior: contain` and iOS momentum scrolling.
- Respect existing safe-area padding on the full-screen panel.
- Text colors, surfaces, borders, and accent colors remain aligned with the existing Steam dark theme.
- Desktop inline styles remain authoritative above the mobile breakpoint.

## Chart Behavior

- Continue using Chart.js and the current contribution data.
- Preserve the existing member order and range-switch semantics.
- Keep bar selection behavior independent of hover so touch users can open detail.
- Keep exact values available through chart interaction and visible labels/hints where supported.
- Resize the chart after mobile tab activation and orientation changes using the existing lifecycle hooks.
- If Chart.js is unavailable, preserve the current scoped error state; layout changes must not block the rest of the contribution content.

## Accessibility

- All contribution buttons and back controls have descriptive text or `aria-label` values.
- Focus styles remain visible.
- Color is not the only indicator for selected range state; text and active styling are both present.
- Chart interaction has a visible text instruction and retains non-chart summaries.
- Long text wraps and remains readable at increased Safari text size.

## Error Handling

- Responsive styling must not alter stored data or contribution calculations.
- Missing optional chart dependencies affect only the chart card.
- Overlay rendering failures continue to use existing guarded render paths and must not remove the top navigation entry.
- Removing the mobile launcher must not remove desktop fallback menu entries.

## Testing and Acceptance

Automated regression tests must demonstrate failure before implementation and pass afterward.

Static/source assertions cover:

- No `FA_MOBILE_LAUNCHER`, `fa-mobile-launcher`, or `faEnsureMobileLauncher` production code remains.
- Stable hooks exist for overview, My Contribution, and shared-detail mobile layouts.
- Mobile CSS stacks all three views into one column.
- Range and navigation controls have 44px minimum touch targets.
- The contribution chart has mobile width/height rules and a visible touch instruction.
- The userscript version and GitHub update URLs are correct.

Verification commands:

```bash
node --check steam-family-game-analysis.user.js
node --test tests/s-f-stay-compat.test.cjs
```

Real-device acceptance on iPhone Safari with Stay:

1. Only the Steam top-navigation Family Library entry is visible.
2. Open the panel at a 375–430px portrait viewport.
3. Contribution overview reads top-to-bottom without horizontal scrolling.
4. Range controls are easy to tap and update the chart.
5. Tapping a member bar opens shared-distribution detail.
6. My Contribution and Shared Detail each use a single-column layout with a clear back action.
7. Return navigation restores the contribution overview without losing usable scroll state.
8. Rotate to landscape and back; charts remain within the content width.
9. Desktop layout remains visually unchanged.

## Release

- Bump the userscript version from 2.02 to 2.03.
- Apply the same production source to the working copy and `steam-family-game-analysis.user.js` in the GitHub repository.
- Commit and push to `LeonInNB/kaaaaai.tools.scripts` after all automated verification passes.
