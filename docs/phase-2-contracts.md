# Phase 2 Contracts

## Status and authority

This document and the schemas under `src/shared/domain/**` and `src/shared/ipc/**` are the Phase 2 contract baseline. Frontend and backend branches must start from the same `codex/phase-2-contracts` commit.

If prose and code disagree, the Zod schema is authoritative. A contract change requires updating this document and `tests/unit/phase-two-contracts.test.ts`; neither implementation branch may silently add or rename fields.

## Delivery boundary

Phase 2 completes the deterministic `Source → Inbox` path and does not invoke Codex or Qoder.

Batch 1 is deliberately limited to one vertical slice:

```text
create RSS Source
→ preview without persistence
→ request manual sync
→ create SyncRun and source.sync Job
→ worker claims Job
→ fetch, normalize, and deduplicate feed items
→ persist KnowledgeItem and basic Artifact
→ list real Inbox items
→ complete or fail SyncRun and Job
```

Batch 1 excludes scheduled execution, missed schedules, arXiv execution, directory watching, Agent preannotation, review actions, reports, and queries. The contracts retain arXiv and directory config shapes so later batches do not need to redefine Source.

## Domain contracts

### ScheduleDefinition

- `interval`: 5 to 10,080 minutes.
- `daily`: local `HH:mm`.
- `weekly`: weekday `0..6` plus local `HH:mm`; `0` is Sunday.
- Scheduling uses the user's local timezone. Persisted run timestamps remain UTC ISO 8601.

### Source

Source is a discriminated union. `type` and `config` must match.

RSS config:

- `feedUrl`
- `includeKeywords`, default `[]`
- `excludeKeywords`, default `[]`
- `historyWindowDays`, default `30`
- `maxItemsPerSync`, default `100`

arXiv config is frozen for Batch 2: `query`, `categories`, `authors`, `maxResultsPerSync`, and `downloadPdf`.

Directory config is frozen for a later batch: `path`, glob lists, `importMode`, `settleTimeMs`, `recursive`, and `autoAnalyze`.

`enabled=false` prevents automatic scheduling. It does not prevent explicit preview or manual sync.

### DiscoveredItem and SourcePreview

Connector output is application-neutral. It contains stable external identity, canonical URL, title, authors, publication time, raw metadata, optional content, and attachments. Connectors do not create database records and do not call an Agent.

Preview is read-only: it performs validation/fetching, returns at most 50 summaries, and creates no Source, Job, SyncRun, KnowledgeItem, or file.

### SyncRun

A manual sync creates one `SyncRun` and one `source.sync` Job in the same database transaction. The Job payload is owned by the backend and must contain stable `sourceId`, `syncRunId`, and trigger fields validated by the shared schema.

SyncRun statuses:

```text
queued → running → succeeded
                 ↘ failed
queued/running → cancelled or interrupted
```

Only one active SyncRun (`queued`, `running`, or `interrupted`) may exist for a Source. A concurrent request returns `SYNC_CONFLICT`.

On success:

```text
discoveredCount = createdCount + updatedCount + skippedCount
error = null
```

### InboxItemSummary

Phase 2 Inbox includes KnowledgeItems in `discovered`, `fetched`, `extracted`, or `failed`. It is a backend projection joining Source, KnowledgeItem, primary Artifact, deterministic excerpt, and Source default labels. It is not a second persistence model.

Phase 2 does not expose importance, confidence, suggested labels, or Agent summary fields.

## Deduplication rules

RSS identity priority:

1. normalized GUID as `(sourceId, externalId)`;
2. normalized canonical URL;
3. deterministic content hash when neither stable value exists.

Repeated sync must update or skip the existing item rather than create a duplicate. The Connector discovers data; the host normalization/persistence layer owns identity and deduplication.

## IPC API

All methods return `IpcResult<T>` and all requests are validated in Main.

| Method | Request | Response | Side effects |
| --- | --- | --- | --- |
| `listSources` | `SourceListFilter` | `Source[]` | none |
| `createSource` | `CreateSourceInput` | `Source` | persists Source |
| `updateSource` | `sourceId`, `UpdateSourceInput` | `Source` | updates same Source type |
| `deleteSource` | `sourceId` | `{ sourceId }` | deletes Source if allowed |
| `previewSource` | `CreateSourceInput` | `SourcePreview` | network only; no persistence |
| `syncSource` | `sourceId` | `{ job, syncRun }` | transactional Job + SyncRun |
| `listSyncRuns` | `SyncRunListFilter` | `SyncRun[]` | none |
| `listInboxItems` | `InboxItemListFilter` | `InboxItemSummary[]` | none |

Stable Phase 2 errors:

- `SOURCE_NOT_FOUND`
- `SOURCE_INVALID_CONFIG`
- `SOURCE_FETCH_FAILED`
- `SOURCE_UNSUPPORTED`
- `SYNC_CONFLICT`

Hard deletion is allowed only before a Source owns KnowledgeItems or retained SyncRuns. Otherwise the backend returns `CONFLICT`; users disable the Source to stop future scheduling while preserving history.

The preload runtime imports constants from `phase-two-contract.ts`, not from Zod validator modules.

## Push events

The existing `app:event` channel is extended with:

- `source.updated`
- `source.deleted`
- `source.sync.updated`
- `inbox.changed`

Events are invalidation/update hints. Renderer state must remain reconstructable through list IPC calls and must not depend on event ordering.

## Branch ownership

- Shared DTO and IPC contract files are frozen after branching.
- Backend owns `src/main/**`, migrations, repositories, runtime preload methods, tests for persistence/network behavior, and `package.json`/`pnpm-lock.yaml`.
- Frontend owns `src/renderer/**` and typed renderer fixtures/view models.
- Frontend must not define alternative Source, SyncRun, or Inbox interfaces.
- Neither branch expands into Agent Runtime or consumes Provider quota.
