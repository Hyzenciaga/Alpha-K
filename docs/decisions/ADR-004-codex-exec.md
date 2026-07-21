# ADR-004：Codex 使用非交互 exec 接口

- 状态：Accepted
- 日期：2026-07-21

## 候选决策

使用 `codex exec`，要求支持 ephemeral 运行、JSONL 事件、output schema、最终消息文件和只读 sandbox。

## Phase 0 验证

实现 capability probe，不只检查 PATH。probe 必须真正执行版本、认证状态和 `exec --help`，并对损坏 wrapper 给出明确诊断。

2026-07-22 验证结果：

- PATH 中的 pnpm wrapper 损坏时，probe 能继续寻找其他候选。
- ChatGPT.app bundled Codex 0.145.0-alpha.27 能复用已有登录。
- 真实 ephemeral 任务产生 JSONL 事件和符合 JSON Schema 的最终文件。
- 本次 WebSocket 请求多次超时，但 CLI 自动回退 HTTPS 并成功完成；Driver 需要保留 transport retry 事件用于诊断。
- app bundle 路径仅作为 Phase 0 fallback。正式发布前仍应优先支持用户配置或 PATH 中的独立稳定 CLI。
