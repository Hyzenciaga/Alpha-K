# Alpha-K packaged UI and brand asset design QA

## Comparison target

- Source visual truth:
  - Inbox direction 04: `/Users/xuhaixiang/.codex/generated_images/019f87d2-5dab-7000-9252-89a9a803c2c7/call_jqejeHpjKSGrC0sA3kahYkUz.png`
  - User-reported switch containment defect: `/var/folders/dd/wp7fh49j6s7gjk1wg8hm0rsr0000gn/T/codex-clipboard-1aad471a-7504-4bef-bf68-ae63103d6b68.png`
- Packaged Electron implementation:
  - Inbox: `/private/tmp/alpha-k-ui-qa-04/inbox-packaged.jpg`
  - All Knowledge: `/private/tmp/alpha-k-ui-qa-04/library-packaged.jpg`
  - Research Reports: `/private/tmp/alpha-k-ui-qa-04/reports-packaged.jpg`
  - Settings switches: `/private/tmp/alpha-k-ui-qa-04/settings-switches-packaged.jpg`
- Full-view comparison evidence:
  - `/private/tmp/alpha-k-ui-qa-04/inbox-source-packaged-comparison.png`

## Viewport and normalization

- Packaged Electron CSS viewport and implementation pixels: `1120 × 760`, light theme, density `1`.
- Inbox source pixels: `1487 × 1058`.
- The source was aspect-preserved inside a white `1120 × 760` cell. The packaged implementation was captured at its native `1120 × 760` size. Both cells were placed into one `2240 × 760` comparison input.
- The source and production shell have different aspect ratios and navigation constraints. The comparison therefore judges layout anatomy, hierarchy, rhythm, action order, type scale, and token use rather than false pixel-level equality.

## State

- Inbox: real Phase 2 RSS projection with three persisted items, no item selected by default, source/status filters at `全部`, search empty. The first item is selected only after explicit activation.
- All Knowledge: Mock fixture data, horizontal range and label filters visible, card view selected.
- Research Reports: Mock fixture data, three weekly reports in the horizontal selector, first report selected.
- Settings: lower `设置与连接` region showing on/off application and Agent switches.

## Required fidelity surfaces

- Fonts and typography: all four surfaces use the shared system sans-serif stack. Inbox title, list titles, provenance, status, detail heading, and metadata preserve the source hierarchy while fitting the smaller production viewport. Long real source names and UUIDs truncate or wrap within their own columns.
- Spacing and layout rhythm: Inbox preserves the source's candidate-list/detail split, selected-row fill, source column, stacked decision controls, and full-width detail decisions. All Knowledge and Research Reports remove their nested left rails and place local navigation in one horizontal plane. No control escapes the `1120 × 760` frame.
- Colors and visual tokens: the current blue/navy and neutral production tokens replace the older multicolor prototype accents. Blue marks selection and the primary `入库` target; warning colors remain limited to ingestion status and error semantics.
- Image quality and asset fidelity: the target contains no photographic or illustrative assets. Production uses the existing Lucide icon family; no custom SVG, emoji, CSS illustration, or placeholder raster was introduced.
- Copy and content: production does not fabricate the source mock's Agent recommendation reason, core points, or suggested field. It shows the real deterministic excerpt and persisted provenance instead. `入库 / 不喜欢` is visible in the requested order and explicitly disabled as `尚未接入`; the page states that it will not download, write to Vault, or modify preferences.
- States and interaction: Inbox source/status/search remain connected to the real backend query. The list starts full-width; candidate activation opens the detail pane, while its close button or `Escape` returns to the full-width list. All Knowledge range tabs reduce the visible Mock fixture set, label chips toggle independently, and report selection updates the preview. Switches were exercised in both states and restored.
- Accessibility: Inbox rows expose `aria-expanded` and `aria-controls`, open with `Enter` or `Space`, and regain focus after the detail closes. The detail is labelled by its heading. Range tabs expose tab semantics, label chips expose pressed state, and switches keep `role="switch"` with `aria-checked`.

## Findings

No actionable P0, P1, or P2 findings remain.

- [P3] The direction 04 source shows denser recommendation metadata than the current real Phase 2 DTO can supply.
  - Location: Inbox list and detail.
  - Evidence: the source includes Agent recommendation reasons, suggested fields, authors, and core points; production has only deterministic excerpt, labels, authors when present, source IDs, artifact IDs, and timestamps.
  - Classification: expected contract boundary. Inventing those fields would create false backend capability.

## Focused-region evidence

- Switch containment: `settings-switches-packaged.jpg` shows `40 × 24` tracks with `18 × 18` thumbs fully clipped inside the pill in both on and off states. The former detached white circles are absent.
- All Knowledge: `library-packaged.jpg` shows `全部知识 / 收藏 / 稍后阅读`, sort, view controls, and labels as horizontal controls above the content grid; there is no nested left filter rail.
- Research Reports: `reports-packaged.jpg` shows the report list as a horizontal strip above a full-width reading surface; there is no second left-side menu.
- A separate Inbox crop was unnecessary because the full comparison renders row actions, selected state, list/detail divider, detail metadata, and bottom decisions legibly at original resolution.

## Comparison history

1. User evidence identified:
   - [P1] switch thumbs visually escaped the track;
   - [P1] All Knowledge and Research Reports added a second left-navigation layer;
   - [P1] Inbox did not use the selected direction 04 review anatomy.
2. First implementation comparison identified:
   - [P2] Inbox decision actions appeared as `不喜欢` above `入库`, reversing the source and requested `入库 / 不喜欢` sequence.
3. Fixes applied:
   - rebuilt the switch as a contained `40 × 24` border-box track with explicit padding, thumb size, travel distance, and `overflow: hidden`;
   - moved knowledge scope, labels, report selection, sort, and view controls to horizontal command bars;
   - adapted direction 04's list/detail layout to the real Phase 2 projection without mock fallback;
   - reordered every Inbox decision pair to `入库` then `不喜欢`.
4. Post-fix evidence:
   - `/private/tmp/alpha-k-ui-qa-04/inbox-source-packaged-comparison.png`
   - `/private/tmp/alpha-k-ui-qa-04/settings-switches-packaged.jpg`
   - `/private/tmp/alpha-k-ui-qa-04/library-packaged.jpg`
   - `/private/tmp/alpha-k-ui-qa-04/reports-packaged.jpg`

## Primary interactions tested

- Open Inbox and confirm no detail pane or selected row appears before user action.
- Activate the first row with pointer and keyboard, confirming the right detail pane opens and the row becomes selected.
- Close with both the explicit close button and `Escape`, confirming focus returns to the originating row and the list becomes full-width again.
- Select another real Inbox row and confirm the detail pane follows selection.
- Inspect disabled `入库 / 不喜欢` actions without mutating persisted Inbox state.
- Switch All Knowledge from `全部知识` to `收藏`, observe six visible Mock fixtures reduce to two, then restore `全部知识`.
- Select the second weekly report and confirm the report title and excerpt update.
- Toggle `登录时启动 Alpha-K` on and off, confirming the thumb remains contained in both states and restoring the original off value.
- Open and scroll `设置与连接` at `1120 × 760`.

## Runtime and errors

- Verified in Electron development runtime and in `/Users/xuhaixiang/CodeFiles/Github/Alpha-K/release/mac-arm64/Alpha-K.app`.
- Lint, typecheck, 15 test files / 49 tests, production build, directory packaging, and whitespace checks passed.
- Packaging required leaving the filesystem sandbox because its local proxy connection was blocked with `EPERM`; the retry completed successfully.
- No renderer crash, preload error, horizontal escape, clipped persistent control, or detached switch thumb appeared.
- No Qoder generation or smoke job was started.

## Brand asset integration

### Comparison target

- Source visual truth: `/Users/xuhaixiang/Documents/Design/alpha-k/图片高清生成.png`
- Derived production framing: `/private/tmp/alpha-k-logo-qa/logo-crop-1700.png`
- Packaged Electron implementation: `/private/tmp/alpha-k-logo-qa/implementation-full.jpg`
- Focused sidebar implementation: `/private/tmp/alpha-k-logo-qa/implementation-brand-focus.jpg`
- Extracted packaged application icon: `/private/tmp/alpha-k-logo-qa/packaged-icon.png`
- Full-view comparison evidence: `/private/tmp/alpha-k-logo-qa/full-comparison.png`
- Focused comparison evidence: `/private/tmp/alpha-k-logo-qa/focused-comparison.png`

### Viewport and normalization

- Source pixels: `2048 × 2048`, RGB PNG.
- Renderer derivative: a deterministic `1700 × 1700` crop, offset `y=220`, `x=174`, downsampled to `512 × 512`. The crop removes unused outer canvas without clipping the cloud silhouette or its glow.
- Packaged app capture: `1120 × 760` pixels at the default `1120 × 760` CSS window and density `1`.
- Sidebar slot: `31 × 31` CSS pixels, shown inside the existing compact brand row without changing shell height.
- Packaged icon: electron-builder converted the `1024 × 1024` derivative into `Contents/Resources/icon.icns`; extraction returns a `1024 × 1024` PNG.
- Full comparison scales the uncropped source to a `760 × 760` cell beside the native `1120 × 760` packaged capture. The focused comparison places the `512 × 512` renderer derivative beside an enlarged crop of the actual `31 × 31` sidebar rendering.

### State

- Packaged Alpha-K running on the `研究空间 / AI 系统` workspace.
- Real cloud status and account identity loaded; research content remains visibly marked `Mock`.
- No login, sync mutation, Job creation, provider generation, or Qoder call was triggered for this QA pass.

### Required fidelity surfaces

- Fonts and typography: unchanged. The new raster mark sits beside the existing `Alpha-K / 你的本地学习空间` hierarchy without shifting weight, line height, truncation, or toolbar density.
- Spacing and layout rhythm: the mark remains within the `31 × 31` brand slot and the `51px` sidebar-intro row. The tighter crop improves subject scale without expanding persistent chrome.
- Colors and visual tokens: the supplied cyan/blue glass mark fits the current blue/navy token family. A neutral blue-gray border and very light shadow separate its pale source background from the sidebar without introducing a new semantic color.
- Image quality and asset fidelity: the exact user-supplied raster is used as the source. No SVG redraw, CSS art, gradient substitute, emoji, or generated approximation was introduced. The renderer uses a `512px` derivative and the packaged icon uses a `1024px` derivative.
- Copy and content: no product copy changed.

### Findings

No actionable P0, P1, or P2 findings remain.

- [P3] The source is a detailed glossy raster, so very fine highlights naturally simplify at the compact `31px` sidebar size.
  - Location: sidebar `.brand-mark`.
  - Evidence: the focused comparison preserves the blue cloud silhouette and highlight direction, while the smallest internal reflections merge after downsampling.
  - Classification: acceptable scale behavior. The full-resolution artwork remains in the packaged application icon, where those details are visible.

### Comparison history

1. The first placement used the full `2048 × 2048` canvas directly and left too much pale margin around the subject at sidebar scale.
2. The source was reframed to `1700 × 1700` around the complete cloud silhouette, then regenerated at `512px` for the renderer and `1024px` for packaging.
3. The revised packaged capture and focused comparison show a larger, centered mark with no clipping, distortion, halo seam, or layout shift.
4. `Info.plist` declares `CFBundleIconFile = icon.icns`, and the packaged `icon.icns` extracts successfully at `1024 × 1024`; the Electron default icon is no longer used.

## Logo-derived semantic blue theme

### Comparison target and evidence

- The logo source, packaged light and forced-dark captures, Inbox states, and keyboard-focus comparisons were inspected locally. Their raw screenshots are not stored in the repository.

### Viewport and normalization

- Source pixels: `2048 × 2048`.
- Both Electron implementations were captured at the default `1120 × 760` window and density `1`.
- The source was aspect-preserved in a `760 × 760` white cell. The native light and dark captures were placed alongside it in a single `3000 × 760` comparison input.
- The focused state comparison places native `1120 × 760` light and dark Inbox captures side by side without scaling or cropping.

### Required fidelity surfaces

- Theme ownership: the exact requested spectrum and interaction values live in `src/renderer/src/theme.css`, imported once after the existing renderer styles. Component anatomy and page layout are unchanged.
- Interaction semantics: hover, selected, active, border, focus, primary action, lightweight emphasis, progress, and disabled states resolve through semantic variables in the final cascade. Translucency is confined to background layers.
- Gradient restraint: the supplied logo gradient is limited to progress tracks; ordinary navigation, cards, controls, and text remain flat.
- Light mode: the clear cyan `--accent` carries icons and lightweight status, the deeper `--accent-strong` carries primary actions and selected indicators, and low-opacity fills distinguish hover and selection without washing out text.
- Dark mode: neutral surfaces, controls, selected rows, tags, notices, source glyphs, and disabled actions use dark semantic surfaces. `--accent-deep` is not used as a large background.
- Disabled state: backgrounds, borders, and text use independent disabled variables at full component opacity. The Inbox comparisons show the children remain crisp while actions remain visibly unavailable.
- Keyboard focus: the sidebar toggle and capture input were traversed with the keyboard in packaged Electron. Both themes show the requested `2px` ice-blue outline plus the low-opacity outer ring.
- Text contrast: white text on primary `#066bd1` is `5.21:1`, on the computed primary hover color is `4.86:1`, and on pressed `#0556a7` is `7.25:1`. Strong-blue interactive text on the light selected layer is `4.53:1`. Deep-blue text on the soft brand surface is `7.50:1`.
- Non-text accent: `#1ea1e6` is used for icons and progress rather than body copy. It reaches `5.99:1` on the dark surface; light-surface interactive text uses `--accent-strong` instead.

### Findings and history

No actionable P0, P1, or P2 findings remain.

1. The first forced-dark comparison found [P2] light-only backgrounds surviving on quick capture, source filters, Inbox provenance/tags, the Phase 4 notice, bottom decisions, and source glyphs.
2. Those surfaces were moved behind dark neutral and disabled semantic variables, with specificity matched at the theme layer.
3. The final full and focused comparison inputs were opened together and inspected. The light implementation reflects the logo's ice-to-deep-blue hierarchy without spreading gradients or glow, while the dark implementation preserves the same state meaning with readable text and visible boundaries.
4. The purple capsule occasionally visible over the macOS traffic-light area is the Computer Use screen-sharing privacy overlay, not renderer UI.

### Runtime and automated checks

- A local directory package was validated; its generated application bundle is not stored in the repository.
- `git diff --check`, lint, typecheck, 15 test files / 49 tests, production build, and directory packaging passed.
- The packaged app was launched normally and with `--force-dark-mode`; research, Inbox selection, disabled decisions, primary actions, and keyboard focus were inspected.
- No Qoder generation or smoke job was started.
- Packaging remains unsigned because the only installed Apple Development identity is expired; the local directory package runs successfully.

## Inbox disclosure interaction

- Default, expanded, and forced-dark states were inspected locally; their raw screenshots are not stored in the repository.
- Viewport: packaged Electron at `1120 × 760`, density `1`, with three real persisted Phase 2 Inbox items.
- Default state uses the full content width and renders no active row or detail landmark.
- Pointer click, `Enter`, and `Space` open the selected item in the existing right-side detail treatment.
- The explicit close button and `Escape` close the detail and restore focus to the originating row.
- At widths below `980px`, the open detail replaces the list instead of being hidden; closing returns to the list.
- The 160ms entry motion is disabled under `prefers-reduced-motion: reduce`.
- Source/status filters, server search, refresh, disabled Phase 4 decisions, and the real Phase 2 projection remain unchanged.
- No actionable P0, P1, or P2 finding remains after the side-by-side inspection.

final result: passed
