# Design QA — independent window toolbar and collapsible sidebar

## Evidence

- Source visual truth (Codex toolbar): `/var/folders/dd/wp7fh49j6s7gjk1wg8hm0rsr0000gn/T/codex-clipboard-5ec1f436-c50d-4340-8536-ce12c16b200e.png`
- Problem-state reference: `/var/folders/dd/wp7fh49j6s7gjk1wg8hm0rsr0000gn/T/codex-clipboard-640570b9-ea79-4e30-8cb2-e822f0329c65.png`
- Expanded implementation: `/private/tmp/alpha-k-toolbar-expanded.jpeg`
- Collapsed implementation: `/private/tmp/alpha-k-toolbar-collapsed.jpeg`
- Source/expanded/collapsed comparison: `/private/tmp/alpha-k-toolbar-comparison.png`
- App viewport: 1120 × 760 CSS px on macOS.
- State: packaged Electron app, verified in both expanded and collapsed sidebar states.

## Layout verdict

The macOS window controls and sidebar toggle now belong to one independent, full-width 58 px toolbar. The navigation sidebar starts on the second grid row below that toolbar. Collapsing the sidebar only changes the second-row navigation width; it does not move, stack, or resize the toolbar controls.

The screen-control harness places a purple control indicator over the traffic-light area in the saved screenshots. The Electron accessibility tree independently exposes the native close, minimize, and fullscreen controls; the packaged app uses Electron's native `hiddenInset` title bar and configured traffic-light position.

## Findings

- Initial P1: the traffic lights, branding, and collapse button were vertically coupled inside the sidebar, producing an awkward control stack when collapsed.
- Fix: move the collapse button into a dedicated toolbar-leading group beside the reserved native-control area; place the sidebar and page content on the row below.
- No actionable P0/P1/P2 mismatch remains in the corrected expanded and collapsed captures.
- Typography, content cards, colors, and navigation visuals remain unchanged outside the requested window-chrome area.
- No new raster assets were needed; the toggle continues to use the existing Lucide `PanelLeft` icon.

## Interaction verification

- In expanded state, the fixed top-row button is announced as `收起侧边栏`.
- After activation, the same top-row button stays in place and is announced as `展开侧边栏`.
- The collapsed sidebar retains its brand mark and navigation icons below the toolbar.
- Activating `展开侧边栏` restores the complete navigation without changing the toolbar layout.
- The toolbar remains the draggable native window region, while buttons and the search input remain interactive no-drag regions.

## Comparison history

1. Reference: Codex keeps traffic lights and the sidebar toggle horizontally in a separate first row.
2. Rejected implementation: Alpha-K placed those controls inside the sidebar and stacked them when collapsed.
3. Corrected implementation: a stable first-row toolbar spans the entire window; only the second-row sidebar collapses.

final result: passed
