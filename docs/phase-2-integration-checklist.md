# Phase 2 Batch 1 Integration Checklist

## Merge base

Both implementation branches must contain the same frozen `codex/phase-2-contracts` commit. Verify this before merging.

## Merge order

1. Create `codex/phase-2-integration` from the approved common base.
2. Review and merge `agent/phase-2-backend` first.
3. Run backend tests and inspect dependency/lockfile changes.
4. Merge `codex/phase-2-frontend` second.
5. Resolve renderer integration without weakening shared DTOs.

Do not merge the integration branch into `master` without explicit user approval.

## Conflict ownership

- Backend wins for `src/main/**`, preload runtime, migrations, and dependency files.
- Frontend wins for renderer layout and styling.
- Shared contracts are not resolved by choosing either side; both sides must match the frozen base.
- If a contract change is unavoidable, stop integration, update schema/docs/tests in one explicit commit, and adapt both sides.

## Scope acceptance

- [ ] Create and persist an RSS Source.
- [ ] Preview RSS without database or Vault writes.
- [ ] Trigger manual sync and receive Job + SyncRun.
- [ ] Worker claims, heartbeats, and completes/fails the sync.
- [ ] Repeating the same feed does not duplicate items.
- [ ] Inbox renders real persisted items.
- [ ] Source failure does not block other Sources or Electron startup.
- [ ] Red-cross window hiding leaves an active manual sync running.
- [ ] arXiv, Directory, Agent, Query, Reports, and Review remain out of Batch 1.
- [ ] No Codex/Qoder generation was used for Phase 2 validation.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package:dir
```

## Electron verification

Use a local fixture HTTP server and an isolated test Vault/user-data directory where possible.

1. Launch the packaged Electron app.
2. Create an RSS Source pointing at the fixture feed.
3. Preview and confirm no Inbox item was persisted.
4. Save and manually sync.
5. Observe queued/running/succeeded Job and SyncRun states.
6. Confirm Inbox items and Source counters.
7. Sync again and confirm no duplicates.
8. Test malformed feed and network failure states.
9. Restart and confirm Source, SyncRun, Job, and Inbox recovery.
