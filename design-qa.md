# Design QA — rewritten macOS window toolbar

## Evidence

- Structural target (Codex): `/var/folders/dd/wp7fh49j6s7gjk1wg8hm0rsr0000gn/T/codex-clipboard-5ec1f436-c50d-4340-8536-ce12c16b200e.png`
- Reported regression: `/var/folders/dd/wp7fh49j6s7gjk1wg8hm0rsr0000gn/T/codex-clipboard-4f0bdca4-3427-4b9b-b294-3c1f6f7644f8.png`
- Rewritten expanded state: `/private/tmp/alpha-k-toolbar-rewrite-expanded.jpeg`
- Rewritten collapsed state: `/private/tmp/alpha-k-toolbar-rewrite-collapsed-stable.jpeg`
- Regression/expanded/collapsed comparison: `/private/tmp/alpha-k-toolbar-rewrite-comparison.png`
- Source pixels: Codex crop 554 × 166; regression crop 620 × 294. Both are Retina crops and are treated as structural references rather than full-viewport measurements.
- Implementation pixels and CSS viewport: 1120 × 760 at 1× capture.
- State: packaged Electron app on macOS, expanded and collapsed sidebar states.

## Findings

No actionable P0/P1/P2 finding remains after the rewrite.

- Fonts and typography: no type styles were changed; the window toolbar uses the existing UI type and the sidebar retains its existing brand type.
- Spacing and layout rhythm: the first row is one uninterrupted 58 px toolbar. Native traffic lights, sidebar toggle, search, status, and actions now follow one horizontal flow. The sidebar begins on the second row, so its right edge terminates at the toolbar baseline instead of continuing into it.
- Colors and visual tokens: the toolbar keeps the existing light canvas and bottom border; no artificial vertical divider or sidebar-colored title area remains.
- Image quality and asset fidelity: no new raster assets are required. Electron renders the three native macOS controls, and the existing icon library renders the sidebar toggle.
- Copy and content: unchanged.

## Interaction verification

- Expanded state exposes `收起侧边栏`; collapsed state exposes `展开侧边栏`.
- Activating the toggle changes only the second-row sidebar width. The toolbar controls and search position do not move.
- The collapsed sidebar keeps its brand mark and navigation icons, and the expanded state restores labels.
- The accessibility tree exposes native close, minimize, and fullscreen controls in the packaged app.
- The toolbar is the draggable window region; its buttons and search input remain no-drag interactive regions.

The Computer Use harness displays a purple control badge over the traffic-light area immediately after an automated click. The clean expanded capture shows the actual native controls; accessibility-tree verification covers both interaction states.

## Comparison history

1. P1 regression: the earlier implementation created a fixed 190 px `.window-toolbar-leading` box with a right border while the responsive sidebar measured 210 or 236 px. The two unrelated edges produced the visible offset highlighted by the user.
2. Structural fix: the toolbar was moved out of `<main>` and made a direct grid-area sibling of the sidebar and content. The artificial leading box and its border were deleted. Toolbar controls now use normal horizontal flow after the native-control inset.
3. Post-fix evidence: expanded and collapsed captures show one continuous first row with no vertical seam. The sidebar width changes entirely below that row.

## Follow-up polish

- None in the requested window-chrome scope.

final result: passed
