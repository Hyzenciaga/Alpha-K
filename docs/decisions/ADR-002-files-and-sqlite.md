# ADR-002：文件为知识真源，SQLite 为索引和运行状态

- 状态：Accepted
- 日期：2026-07-21

## 决策

用户选择的 Knowledge Vault 保存知识内容、确认后的 metadata、annotation 和报告。SQLite 位于 Electron userData，用于可重建索引、来源配置、Job 和 Agent 运行状态。

## 原因

普通文件易迁移、备份和人工阅读；数据库更适合事务、检索和任务恢复。数据库不放入 Vault，避免同步 WAL 和锁文件。
