# Alpha-K

Alpha-K 是一个本地文件优先、由本机 Agent 驱动的桌面知识管理客户端。Phase 1 已完成领域模型、Vault、持久化 Job Queue、typed IPC 和首轮前后端联调；当前正在准备 Phase 2 的 Scheduler 与 Source Ingestion 合约。

项目主规范见 [项目 handoff](docs/local-knowledge-client-handoff.md)，已完成验证见 [Phase 0 checklist](docs/phase-0-checklist.md) 和 [Phase 1 checklist](docs/phase-1-checklist.md)，下一阶段的规范入口见 [Phase 2 contracts](docs/phase-2-contracts.md)。

## 开发命令

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package:dir
```

Provider 非生成式探测：

```bash
pnpm qoder:status
```

真实 Provider smoke 只在 Driver 变更或发布门禁时手动运行，不属于日常测试。尤其不要在 Phase 2 的 Source Ingestion 开发中消耗 Qoder 额度。

## 当前边界

- Knowledge Vault 中的普通文件是知识真源。
- SQLite 只保存可重建索引和运行状态。
- Renderer 不直接访问文件、数据库、网络 Connector 或子进程。
- Main 通过类型化 preload API 暴露最小能力。
- Agent 只能访问隔离的 staging workspace，不能直接写 Vault。
- Phase 2 Batch 1 只实现手动 RSS 同步闭环；Scheduler、arXiv 和 Agent 分别属于后续批次。
