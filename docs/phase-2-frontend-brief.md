# Phase 2 Frontend Brief — Batch 1 Manual RSS

## Branch

Create `codex/phase-2-frontend` from the frozen `codex/phase-2-contracts` commit. Do not start from the frontend mock branch or redefine its old mock types.

## Read first

1. `docs/phase-2-contracts.md`
2. `src/shared/domain/source.ts`
3. `src/shared/domain/source-ingestion.ts`
4. `src/shared/domain/sync-run.ts`
5. `src/shared/domain/inbox.ts`
6. `src/shared/ipc/phase-two-contract.ts`

## Ownership

This branch owns only `src/renderer/**` and renderer-focused tests/fixtures. Do not modify Main, preload runtime, shared contracts, database code, `package.json`, or `pnpm-lock.yaml`.

## Independent-development adapter

Build renderer state against a small client interface structurally compatible with `PhaseTwoApi`. Production uses `window.alphaK`; story/development fixtures use an in-memory typed client. Every fixture must use `satisfies Source`, `satisfies SyncRun`, `satisfies InboxItemSummary`, or the exact method return type.

Do not add fallback mock data inside the production client. Runtime IPC failures must render an error state rather than silently displaying demo content.

## Required implementation

### Sources page

- Remove the legacy renderer-only `SourceItem` type and Source fixtures as the real page is connected.
- Replace the page-level Mock marker only when real state is wired.
- Render loading, empty, ready, and error states.
- List persisted Sources and real health fields.
- Create/edit RSS Source using the frozen config fields.
- Preview before save without implying persistence.
- Trigger manual sync and show the returned Job/SyncRun.
- Show latest SyncRun counters and failure details.
- Allow enable/disable and deletion with clear confirmation.
- Label arXiv and Directory as “later batch” rather than pretending they work.

### Inbox page

- Remove the legacy Inbox fixture type from production rendering; test fixtures must satisfy `InboxItemSummary`.
- Replace mock items with `InboxItemSummary[]`.
- Render loading, empty, ready, and error states.
- Filter by Source/status and support server-backed search.
- Show deterministic excerpt, Source identity, timestamps, and ingestion status.
- Do not show Agent confidence, importance, suggested labels, or review actions as real functionality.
- If the retained design shows future controls, disable them and mark them “Phase 4”.

### Events

Use `onAppEvent` as an invalidation hint. Re-fetch affected lists after Source, SyncRun, or Inbox events; do not construct the only state from event order.

## Tests

Test renderer state/view-model behavior with the typed in-memory client:

- loading and empty Sources.
- create, preview, update, delete, and manual sync success/error.
- SyncRun failed and counters.
- Inbox empty, populated, filtered, and failed item.
- event-driven refresh.
- no Phase 4 fields presented as real.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before handoff.

## Explicitly out of scope

Scheduler UI, arXiv execution, directory watcher, Agent test runs, preannotation, review acceptance, question answering, and reports. Do not call Codex or Qoder.
