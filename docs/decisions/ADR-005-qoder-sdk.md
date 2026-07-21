# ADR-005：Qoder 使用 Agent SDK

- 状态：Accepted
- 日期：2026-07-21

## 候选决策

使用 Qoder Agent SDK，通过 `auth: { type: 'qodercli' }` 复用本机登录，并限制 cwd、tools 和权限模式。

## Phase 0 验证

验证 SDK bundled CLI 定位、登录复用、事件流、AbortController 和非交互权限拒绝。Qoder.app 内部服务二进制不等同于 `qodercli`，不能据此判定 Provider 可用。

2026-07-22 中间结果：

- `@qoder-ai/qoder-agent-sdk` 1.0.15 成功安装 bundled qodercli 1.0.47。
- 应用可以解析 bundled executable、执行 version 和模型列表认证探测。
- 认证探测使用 `--list-models`；`auth status` 不是 Qoder CLI 子命令，登录后会被误解析为自然语言查询，不能用于 health-check。
- 未登录时 Provider 被分类为 `unauthenticated`，不会阻止 Electron 启动。
- bundled qodercli 必须通过 electron-builder `asarUnpack` 发布；运行时需把解析到的 `app.asar` 路径映射到 `app.asar.unpacked`。
- SDK smoke helper 已加入，使用 `qodercliAuth()`、`dontAsk`、空 tools、空 setting sources 和 AbortController。
- 本机登录复用成功，SDK 单轮真实任务返回预期结果。
- AbortController 取消 smoke test 在 771ms 内结束会话。
- 最终打包态 probe 将 Qoder 识别为 `available`，版本 1.0.47。
