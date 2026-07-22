# Phase 2 Backend Brief — Batch 1 Manual RSS

## Branch

Create `agent/phase-2-backend` from the frozen `codex/phase-2-contracts` commit. Do not start from `master` unless that exact contracts commit has already been merged there.

## Read first

1. `docs/phase-2-contracts.md`
2. `docs/local-knowledge-client-handoff.md`, sections 9, 16, and 17
3. `src/shared/domain/**`
4. `src/shared/ipc/phase-two*.ts`

## Ownership

This branch owns:

- `src/main/**`
- database migrations and backend repositories
- runtime methods in `src/preload/index.ts`
- backend/unit/integration tests
- dependency changes in `package.json` and `pnpm-lock.yaml`

Do not modify renderer files. Do not change shared contracts without stopping and coordinating.

## Required implementation

1. Add a versioned migration for `source_sync_runs` and required indexes.
   Normalize any legacy RSS config key `url` to the frozen `feedUrl` shape during migration before strict Source parsing.
2. Implement `SyncRunRepository` with transactional lifecycle changes and list filters.
3. Add missing Knowledge repository lookup/update methods for GUID, canonical URL, and content hash deduplication.
4. Define a `SourceConnector` interface and implement RSS validation, preview, and sync.
5. Normalize RSS/Atom dates, URLs, authors, GUIDs, metadata, optional feed content, and deterministic excerpts.
6. Implement `SourceService` for CRUD, preview, manual sync, and list operations.
7. Create SyncRun and `source.sync` Job atomically; reject concurrent active runs with `SYNC_CONFLICT`.
8. Implement a single-process worker loop that claims `source.sync`, heartbeats, dispatches RSS, and completes/fails both records consistently.
9. Register Phase 2 IPC handlers and preload runtime methods using the frozen channels.
10. Broadcast Source, SyncRun, Inbox, and existing Job events.

## Failure rules

- One bad Source must not stop the worker loop.
- HTTP, parse, timeout, invalid config, and unsupported type errors map to stable codes or failed SyncRuns.
- Retriable network failures use bounded Job retry; invalid config does not retry automatically.
- Partial data must not appear successful.
- Preview never persists data.
- Do not invoke Codex or Qoder.

## Tests

At minimum cover:

- RSS and Atom fixtures without live network dependency.
- GUID, canonical URL, and content-hash deduplication.
- repeated sync creates no duplicate item.
- Source config/type validation.
- SyncRun counters and error transitions.
- active-run conflict.
- IPC validation and result envelopes.
- worker claim, heartbeat, completion, failure, and cancellation.

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before handoff.

## Explicitly out of scope

Scheduler timers, missed schedules, arXiv execution, directory watcher, Agent Runtime, preannotation, review actions, reports, and query.
