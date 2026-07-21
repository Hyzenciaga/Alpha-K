# ADR-001：一期在 Electron Main 内运行调度

- 状态：Accepted
- 日期：2026-07-21

## 决策

一期由 Electron Main 承担 Scheduler、Job Queue、watcher 和 Agent 子进程管理。点击 macOS 红色关闭按钮只隐藏窗口；用户显式 Quit 时才结束 Main 进程。

## 原因

一期只要求窗口关闭后继续运行，并不要求用户 Quit 后继续运行。独立 daemon 会提前引入 IPC、安装、升级和权限复杂度。

## 后果

如果未来要求显式退出 UI 后仍持续执行任务，再评估 launchd helper 或独立 daemon。
