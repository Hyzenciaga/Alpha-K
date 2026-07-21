# Phase 0 Checklist

## 目标

建立可运行的 Electron + React + TypeScript 基线，并验证会影响后续架构的高风险假设。

## 验收项

- [x] Electron 开发模式可以启动。
- [x] macOS 红叉隐藏窗口，但 Main 进程和后台计数器继续运行。
- [x] 点击 Dock 图标可以恢复窗口。
- [x] Command + Q / `app.quit()` 可以真正退出。
- [x] Renderer 只能通过类型化 preload API 与 Main 通信。
- [x] SQLite migration 可以执行并重复打开。
- [x] Electron 运行时支持 FTS5 trigram 中文检索。
- [x] Codex probe 能区分缺失、损坏、未认证、不支持和可用。
- [x] Codex 最小真实任务可以输出 JSONL 和 Schema 校验后的结果。
- [x] Qoder SDK 能定位 CLI、复用本地登录并取消任务。
- [x] Provider 不可用不会阻止应用启动。
- [x] `pnpm lint`、`pnpm typecheck`、`pnpm test` 和 `pnpm build` 通过。
- [x] macOS unpacked app 可以打包并在 asar 环境中运行 SQLite 和 Provider probes。

## 当前本机事实（2026-07-21）

- Node.js 24.14.0、pnpm 10.33.0 可用。
- 系统 SQLite 3.51.0 启用了 FTS5，trigram 中文查询 smoke test 通过。
- PATH 中的 Codex pnpm wrapper 已损坏，指向缺失的平台二进制。
- ChatGPT.app 内含可运行且已登录的 Codex 0.145.0-alpha.27，只作为 capability spike 候选，不作为正式硬编码依赖。
- Qoder.app 1.15.1 已安装，但 `qodercli` 不在 PATH；需要通过 Qoder Agent SDK 验证 bundled CLI 与登录复用。

## 已验证结果（2026-07-22）

- Electron 43.1.1 可以实际启动；Preload、Renderer 和类型化 IPC 正常加载。
- Electron 内 `better-sqlite3` 可以打开数据库并执行 migration v2。
- Electron 内 FTS5 trigram 对“知识管理”的中文 smoke query 命中。
- 红叉后开发进程保持运行，Dock 恢复后后台计数继续增长。
- 打包态自动生命周期 smoke test 在 tick 2 隐藏窗口、tick 5 恢复窗口，随后触发 `before-quit` 并正常退出。
- Codex probe 会跳过损坏的 PATH wrapper，选择 ChatGPT.app bundled Codex 0.145.0-alpha.27。
- Codex `--ephemeral --json --output-schema -o --sandbox read-only` 真实 smoke test 成功；本次 WebSocket 多次超时后 CLI 自动回退 HTTPS 并完成任务。
- Qoder Agent SDK 1.0.15 已下载 bundled qodercli 1.0.47，应用可定位并执行该二进制。
- macOS unpacked app 打包成功；Qoder executable 从 `app.asar` 重写到 `app.asar.unpacked` 后可在打包态执行。
- Qoder 登录复用成功，SDK 单轮真实任务返回预期结果；AbortController 取消测试在 771ms 内结束会话。
- 最终打包态 Provider probe：Codex available；Qoder available，版本 1.0.47。

## 完成规则

Phase 0 已于 2026-07-22 完成，可以进入 Phase 1。后续仍应优先修复独立 Codex CLI，避免把 ChatGPT.app 内部 alpha binary 当作正式发布依赖。
