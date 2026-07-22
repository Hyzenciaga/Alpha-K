# Phase 3 Auth and State Sync Contracts

## Scope

Phase 3 adds an optional Supabase account layer to the local-first Alpha-K client. The local Vault,
SQLite database, artifacts, PDFs, Markdown files, paths, and Agent logs remain local. Signing out or
losing network access must not prevent local capture, ingestion, search, or Agent work.

The configured development project is:

- Project ref: `nuqdxhkwxlzutpdctmtb`
- Region: Singapore
- OAuth provider: GitHub
- Packaged callback: `alpha-k://auth/callback`

## Synchronized data

Only metadata needed to reconcile knowledge identity and per-user state is synchronized:

- stable knowledge reference key;
- source kind and stable external identifier;
- canonical URL, title, authors, and publication timestamp;
- read, starred, accepted, and ignored state;
- device registration and an incremental change cursor.

The stable reference key is deterministic:

- RSS: normalized feed identity plus GUID, falling back to canonical URL or content hash;
- arXiv: normalized arXiv identifier and version;
- URL: hash of the normalized canonical URL;
- local-only file: content hash, never a path or filename.

## Ownership and security

- Electron Main owns Supabase Auth, session storage, and all network calls.
- Renderer receives only typed account/status DTOs through preload IPC.
- The desktop binary contains only a publishable key. Secret and `service_role` keys are forbidden.
- Every remote row has `owner_id`; RLS compares it with `auth.uid()`.
- OAuth uses the system browser and PKCE. Tokens are encrypted with Electron `safeStorage`.
- An installation does not upload pre-login state automatically to a different account.

## Conflict rule for the first vertical slice

Cloud writes are appended to `sync_changes` in server commit order. A client pulls changes after its
stored sequence. For simultaneous edits of the same field, the last change committed by Supabase
wins. This is intentionally simple for the first two-client slice and can later be replaced by
field-level revisions without changing the public IPC contract.

## Parallel delivery plan

1. Contract baseline: this document, shared DTOs, IPC channels, local migration, and Supabase SQL.
2. Backend branch: GitHub OAuth, encrypted session persistence, outbox/pull cursor, Supabase adapter.
3. Frontend branch: account controls and sync status using typed fixtures only.
4. Integration branch: backend first, frontend second, then packaged macOS OAuth and two-client tests.

`master` is not part of this merge sequence without explicit approval.
