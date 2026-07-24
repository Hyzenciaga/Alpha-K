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

- Inbox: real Phase 2 RSS projection with three persisted items, first item selected, source/status filters at `全部`, search empty.
- All Knowledge: Mock fixture data, horizontal range and label filters visible, card view selected.
- Research Reports: Mock fixture data, three weekly reports in the horizontal selector, first report selected.
- Settings: lower `设置与连接` region showing on/off application and Agent switches.

## Required fidelity surfaces

- Fonts and typography: all four surfaces use the shared system sans-serif stack. Inbox title, list titles, provenance, status, detail heading, and metadata preserve the source hierarchy while fitting the smaller production viewport. Long real source names and UUIDs truncate or wrap within their own columns.
- Spacing and layout rhythm: Inbox preserves the source's candidate-list/detail split, selected-row fill, source column, stacked decision controls, and full-width detail decisions. All Knowledge and Research Reports remove their nested left rails and place local navigation in one horizontal plane. No control escapes the `1120 × 760` frame.
- Colors and visual tokens: the current blue/navy and neutral production tokens replace the older multicolor prototype accents. Blue marks selection and the primary `入库` target; warning colors remain limited to ingestion status and error semantics.
- Image quality and asset fidelity: the target contains no photographic or illustrative assets. Production uses the existing Lucide icon family; no custom SVG, emoji, CSS illustration, or placeholder raster was introduced.
- Copy and content: production does not fabricate the source mock's Agent recommendation reason, core points, or suggested field. It shows the real deterministic excerpt and persisted provenance instead. `入库 / 不喜欢` is visible in the requested order and explicitly disabled as `尚未接入`; the page states that it will not download, write to Vault, or modify preferences.
- States and interaction: Inbox source/status/search remain connected to the real backend query. Candidate selection updates the detail pane. All Knowledge range tabs reduce the visible Mock fixture set, label chips toggle independently, and report selection updates the preview. Switches were exercised in both states and restored.
- Accessibility: Inbox rows are keyboard-selectable with `Enter` and `Space`; selected state uses `aria-pressed`. Range tabs expose tab semantics, label chips expose pressed state, and switches keep `role="switch"` with `aria-checked`.

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

final result: passed
