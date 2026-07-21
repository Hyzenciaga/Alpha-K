import { useEffect, useState } from 'react'
import type { PhaseZeroStatus, ProviderProbe, ProviderProbeStatus } from '@shared/contracts'

const providerLabels: Record<ProviderProbeStatus, string> = {
  available: '可用',
  not_installed: '未安装',
  broken_installation: '安装损坏',
  unauthenticated: '未登录',
  unsupported_version: '版本不支持',
}

export function App(): React.JSX.Element {
  const [status, setStatus] = useState<PhaseZeroStatus | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    void window.alphaK.getPhaseZeroStatus().then(setStatus)
    return window.alphaK.onPhaseZeroStatus(setStatus)
  }, [])

  async function refreshProviders(): Promise<void> {
    setRefreshing(true)
    try {
      await window.alphaK.refreshProviders()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">ALPHA-K / PHASE 0</p>
          <h1>先验证地基，再建知识系统。</h1>
          <p className="lede">
            这个窗口展示 Electron Main 的实时状态。关闭红色按钮后等待几秒，再从 Dock
            恢复；后台计数应持续增长。
          </p>
        </div>
        <div className="counter" aria-live="polite">
          <span>后台计数</span>
          <strong>{status?.backgroundTicks ?? '—'}</strong>
          <small>{status?.lastLifecycleEvent ?? '正在启动'}</small>
        </div>
      </header>

      <section className="section-heading">
        <div>
          <p className="eyebrow">LOCAL FOUNDATION</p>
          <h2>本地运行基础</h2>
        </div>
      </section>

      <section className="grid two-column">
        <article className="card">
          <div className="card-title">
            <h3>SQLite / FTS5</h3>
            <StatusPill ok={status?.database.trigramChinese === true} />
          </div>
          <dl>
            <Detail label="Migration" value={`v${status?.database.migrationVersion ?? 0}`} />
            <Detail label="FTS5" value={yesNo(status?.database.fts5)} />
            <Detail label="中文 trigram" value={yesNo(status?.database.trigramChinese)} />
            <Detail label="Database" value={status?.database.path || '正在初始化'} mono />
          </dl>
          {status?.database.error && <p className="error-copy">{status.database.error}</p>}
        </article>

        <article className="card lifecycle-card">
          <div className="card-title">
            <h3>窗口生命周期</h3>
            <StatusPill ok={status !== null} />
          </div>
          <dl>
            <Detail label="窗口可见" value={yesNo(status?.windowVisible)} />
            <Detail label="最近事件" value={status?.lastLifecycleEvent ?? '正在启动'} />
            <Detail label="Main 启动" value={formatDate(status?.startedAt)} />
          </dl>
          <p className="hint">红叉只隐藏窗口；Command + Q 才真正退出。</p>
        </article>
      </section>

      <section className="section-heading provider-heading">
        <div>
          <p className="eyebrow">CAPABILITY PROBES</p>
          <h2>本机 Agent</h2>
        </div>
        <button type="button" onClick={() => void refreshProviders()} disabled={refreshing}>
          {refreshing ? '探测中…' : '重新探测'}
        </button>
      </section>

      <section className="grid two-column">
        {(['codex', 'qoder'] as const).map((provider) => (
          <ProviderCard
            key={provider}
            name={provider === 'codex' ? 'Codex' : 'Qoder'}
            probe={status?.providers.find((item) => item.provider === provider)}
          />
        ))}
      </section>
    </main>
  )
}

function ProviderCard({ name, probe }: { name: string; probe?: ProviderProbe }): React.JSX.Element {
  return (
    <article className="card provider-card">
      <div className="card-title">
        <h3>{name}</h3>
        <span className={`provider-status status-${probe?.status ?? 'loading'}`}>
          {probe ? providerLabels[probe.status] : '探测中'}
        </span>
      </div>
      <p className="provider-detail">{probe?.detail ?? '正在执行本机 capability probe…'}</p>
      <dl>
        <Detail label="版本" value={probe?.version ?? '—'} />
        <Detail label="Executable" value={probe?.selectedExecutable ?? '—'} mono />
        <Detail label="候选数" value={String(probe?.attempts.length ?? 0)} />
      </dl>
      {probe && probe.attempts.length > 0 && (
        <details>
          <summary>查看探测过程</summary>
          <ul className="attempts">
            {probe.attempts.map((attempt) => (
              <li key={attempt.executable}>
                <code>{attempt.executable}</code>
                <span>{providerLabels[attempt.status]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }): React.JSX.Element {
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value}</dd>
    </div>
  )
}

function StatusPill({ ok }: { ok: boolean }): React.JSX.Element {
  return <span className={ok ? 'pill success' : 'pill pending'}>{ok ? '通过' : '待验证'}</span>
}

function yesNo(value: boolean | undefined): string {
  if (value === undefined) return '—'
  return value ? '是' : '否'
}

function formatDate(value: string | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))
}
