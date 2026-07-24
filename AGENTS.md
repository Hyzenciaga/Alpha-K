# Alpha-K product guardrails

## Client shell

- Keep the macOS toolbar thin. It contains the native window controls, sidebar toggle, current location, sync state, and notifications; do not add browser-style back/forward controls.
- The sidebar toggle stays at one fixed toolbar coordinate beside the native traffic lights. Collapsing slides the complete sidebar card out of view; it must not turn into a separate icon rail.
- Quick capture is more frequent than search. Keep capture as the first sidebar action and keep search compact in the upper-left sidebar area.
- The sidebar middle follows the learning-field model: Ask Alpha-K, Inbox, then `AI 系统`、`产品与交互`、`经济与商业`、`个人知识系统`. Account identity and the settings trigger stay at the bottom.
- Clicking the settings trigger opens a compact secondary menu contained by the full sidebar for `设置与连接`、`信息源订阅`、`Agent 与任务`. The menu must never clip beyond the window edge. Child settings pages must provide a visible `返回设置` action.
- A learning-field workspace uses a research thread as the main canvas and reserves the right rail for `继续学习` and `推荐入库`.
- Recommendations are not knowledge-base entries. The first decision remains `入库` or `不喜欢`; do not imply that a UI-only decision has already downloaded or persisted content.

## Visual system

- Use the system sans-serif stack and the blue/navy plus neutral token system. Amber and red are reserved for warning and error semantics.
- Persistent chrome is compact; page titles, controls, card radii, spacing, and type sizes should reuse the shared shell scale instead of introducing page-specific visual systems.
- Every dense settings, Agent, and source surface must be checked at the default 1120 × 760 window. Text, code paths, toggles, action groups, and tables may wrap or scroll inside their own region, but must not escape the page.

## Scope

- Preserve existing real Vault, Job, provider-probe, source, inbox, and cloud-sync IPC flows.
- Research content, recommendations, reports, questions, and capture persistence remain explicitly marked as Mock until their typed backend contracts are implemented.
