# Alpha-K

Alpha-K 是一个本地文件优先、由本机 Agent 驱动的桌面知识管理客户端。目前处于 Phase 0：验证 Electron 生命周期、SQLite/FTS，以及 Codex/Qoder 的本地接入能力。

项目主规范见 [项目 handoff](docs/local-knowledge-client-handoff.md)，当前验证状态见 [Phase 0 checklist](docs/phase-0-checklist.md)。

## 开发命令

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

Provider 验证：

```bash
pnpm phase0:codex-smoke
pnpm qoder:status
pnpm qoder:login
pnpm phase0:qoder-smoke
```

`qoder:login` 会启动 Qoder 官方 CLI 登录流程，需要用户本人完成认证。

## 当前边界

- Knowledge Vault 中的普通文件是知识真源。
- SQLite 只保存可重建索引和运行状态。
- Renderer 不直接访问文件、数据库或子进程。
- Agent 只能访问隔离的 staging workspace，不能直接写 Vault。
- Phase 0 不实现完整知识管理功能。
