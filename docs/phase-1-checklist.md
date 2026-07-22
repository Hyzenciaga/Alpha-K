# Phase 1 Checklist

## Status

Phase 1 was integrated on 2026-07-22 in `codex/phase-1-integration`.

## Acceptance

- [x] Select or initialize a local Vault.
- [x] Restore the active Vault after reopening the database.
- [x] Persist the versioned `.knowledge-vault.json` manifest.
- [x] Apply versioned SQLite migrations.
- [x] Persist Vault, Source, KnowledgeItem, Artifact, and Job domain records.
- [x] Write Vault-owned JSON atomically and hash files.
- [x] Enqueue, claim, heartbeat, complete, fail, cancel, and retry Jobs.
- [x] Interrupt running Jobs on shutdown and recover interrupted Jobs on startup.
- [x] Rebuild basic FTS metadata from Vault files after deleting SQLite.
- [x] Validate renderer requests and responses through typed IPC DTOs.
- [x] Build preload as CJS and load it with sandbox and context isolation enabled.
- [x] Connect real Vault, Job, Codex probe, and Qoder probe state to the renderer.
- [x] Mark features outside the Phase 1 slice as Mock.

## Verification

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm package:dir`
- Launch `release/mac-arm64/Alpha-K.app`
- Create and cancel a Job, restart Electron, and confirm the persisted status.
- Open the native Vault directory picker without changing the user's configured Vault.
- Confirm packaged Codex and Qoder probes do not block startup.

## Handoff to Phase 2

Phase 2 reuses the existing Source, KnowledgeItem, Artifact, and Job repositories. It must add Source ingestion behavior through new migrations, services, Connectors, workers, and IPC handlers without expanding into Agent execution.
