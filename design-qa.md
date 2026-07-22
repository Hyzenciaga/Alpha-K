# Design QA — macOS window chrome and sidebar toggle

## Evidence

- Source visual truth: `/var/folders/dd/wp7fh49j6s7gjk1wg8hm0rsr0000gn/T/codex-clipboard-230232ff-d5c3-4836-a452-16789be2cdfa.png`
- Before-state reference: `/var/folders/dd/wp7fh49j6s7gjk1wg8hm0rsr0000gn/T/codex-clipboard-67085eee-103c-4926-a9c1-2feed44f3cf4.png`
- Expanded implementation: `/private/tmp/alpha-k-window-chrome-expanded.jpeg`
- Collapsed implementation: `/var/folders/dd/wp7fh49j6s7gjk1wg8hm0rsr0000gn/T/com.openai.sky.CUAService/Alpha-K Screenshot 2026-07-22 at 22.50.22.jpeg`
- Focused comparison: `/private/tmp/alpha-k-window-chrome-comparison.png`
- App viewport: 1120 × 760 CSS px on macOS.
- Source pixels: 1208 × 100, inferred @2x crop and normalized to 604 × 50 CSS px.
- Implementation pixels: 1120 × 760 at 1x capture; the focused comparison uses its top 1120 × 102 px.
- State: packaged Electron app, expanded and collapsed sidebar states.

## Full-view comparison evidence

The implementation removes the separate white native title strip and its `Alpha-K` title. Native macOS traffic lights remain functional and sit over the app-owned sidebar surface. The existing application typography, colors, content, and component hierarchy are intentionally unchanged.

## Focused region comparison evidence

The focused comparison normalizes the supplied @2x title-bar crop before stacking it above the implementation. Traffic-light size and spacing remain system-native; their background now follows Alpha-K's dark sidebar rather than creating a separate white application-name bar.

## Findings

- No actionable P0/P1/P2 mismatch remains.
- Fonts and typography: unchanged inside the app; the unwanted native title text is absent.
- Spacing and layout rhythm: a 28 px draggable inset prevents traffic lights from overlapping the sidebar brand and topbar controls.
- Colors and visual tokens: window chrome inherits the existing sidebar/topbar tokens instead of adding a new title-bar color.
- Image quality and asset fidelity: no raster or generated assets were needed; Electron supplies native macOS controls and Lucide supplies the existing sidebar icon.
- Copy and content: application content is unchanged; `Alpha-K` remains only as the intentional in-app brand.

## Interaction verification

- Native close/minimize/zoom controls are visible in the packaged app.
- The custom title region drags the native window.
- `收起侧边栏` changes to a visible, keyboard-accessible `展开侧边栏` button.
- Clicking `展开侧边栏` restores the full navigation and brand.

## Comparison history

- Initial issue: native title bar created a separate white strip and displayed the application name; the collapsed CSS selector also hid the only sidebar toggle.
- Fix: use Electron `hiddenInset`, reserve a draggable inset in renderer chrome, and keep the toggle visible while hiding the brand in collapsed state.
- Post-fix evidence: expanded and collapsed packaged-app captures above; no further P0/P1/P2 correction was required.

## Follow-up polish

- P3: traffic-light colors appear muted when the window is inactive, which is native macOS behavior and should not be overridden.

final result: passed
