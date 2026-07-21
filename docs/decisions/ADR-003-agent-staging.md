# ADR-003：Agent 只能写 staging

- 状态：Accepted
- 日期：2026-07-21

## 决策

每个 AgentRun 使用独立 staging workspace。Agent 只读取受控输入并写入 output；应用校验结果后再原子提交到 Vault。

## 后果

所有 Provider driver 都必须服从统一权限 profile，未经 Schema 校验的结果不得进入正式知识库。
