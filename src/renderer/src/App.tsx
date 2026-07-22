import { useEffect, useState } from 'react'
import {
  Bell,
  Bot,
  ChevronLeft,
  FileText,
  Home,
  Inbox,
  Library,
  MessageSquareText,
  PanelLeft,
  Plus,
  Rss,
  Settings,
  Sparkles,
} from 'lucide-react'
import type { PhaseZeroStatus } from '@shared/contracts'
import type { EnqueueJobInput, Job } from '@shared/domain/job'
import type { IpcError } from '@shared/ipc/phase-one-contract'
import type { VaultConnection } from '@shared/domain/vault'
import { Button, IconButton, Modal, SearchField, SegmentedControl, Toast } from './components'
import { InboxPage } from './InboxPage'
import type { PageId } from './mock-data'
import { getProductionPhaseTwoClient } from './phase-two-client'
import { SourcesPage } from './SourcesPage'
import {
  AgentsPage,
  LibraryPage,
  QueryPage,
  ReportsPage,
  SettingsPage,
  TodayPage,
} from './pages'

const primaryNavigation: Array<{ id: PageId; label: string; icon: React.ReactNode; badge?: string }> = [
  { id: 'today', label: '今天', icon: <Home size={18} /> },
  { id: 'inbox', label: '收件箱', icon: <Inbox size={18} /> },
  { id: 'library', label: '知识库', icon: <Library size={18} /> },
  { id: 'sources', label: '订阅源', icon: <Rss size={18} /> },
  { id: 'query', label: '问答', icon: <MessageSquareText size={18} /> },
  { id: 'reports', label: '报告', icon: <FileText size={18} /> },
]

const utilityNavigation: Array<{ id: PageId; label: string; icon: React.ReactNode }> = [
  { id: 'agents', label: 'Agent', icon: <Bot size={18} /> },
  { id: 'settings', label: '设置', icon: <Settings size={18} /> },
]

export function App(): React.JSX.Element {
  const phaseTwoClient = getProductionPhaseTwoClient()
  const [activePage, setActivePage] = useState<PageId>('today')
  const [status, setStatus] = useState<PhaseZeroStatus | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [captureKind, setCaptureKind] = useState<'note' | 'link'>('note')
  const [captureTitle, setCaptureTitle] = useState('')
  const [captureContent, setCaptureContent] = useState('')
  const [vaultConnection, setVaultConnection] = useState<VaultConnection | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [phaseOneLoading, setPhaseOneLoading] = useState(true)
  const [vaultBusy, setVaultBusy] = useState(false)

  useEffect(() => {
    void window.alphaK.getPhaseZeroStatus().then(setStatus)
    return window.alphaK.onPhaseZeroStatus(setStatus)
  }, [])

  useEffect(() => {
    let mounted = true
    void Promise.all([window.alphaK.getVault(), window.alphaK.listJobs()])
      .then(([vaultResult, jobsResult]) => {
        if (!mounted) return
        if (vaultResult.ok) setVaultConnection(vaultResult.data)
        else setToast(formatIpcError('Vault 状态读取失败', vaultResult.error))
        if (jobsResult.ok) setJobs(jobsResult.data)
        else setToast(formatIpcError('Job 列表读取失败', jobsResult.error))
      })
      .catch((error: unknown) => {
        if (mounted) setToast(`Phase 1 服务连接失败：${errorMessage(error)}`)
      })
      .finally(() => {
        if (mounted) setPhaseOneLoading(false)
      })

    const unsubscribe = window.alphaK.onAppEvent((event) => {
      if (event.type === 'job.updated') setJobs((current) => upsertJob(current, event.job))
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('.global-search input')?.focus()
      }
      if (event.key === 'Escape') setCaptureOpen(false)
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  function navigate(page: PageId): void {
    setActivePage(page)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.querySelector('.page-scroll')?.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  function notify(message: string): void {
    setToast(message)
  }

  async function refreshProviders(): Promise<void> {
    setRefreshing(true)
    try {
      await window.alphaK.refreshProviders()
      notify('本机 Agent 状态已更新')
    } finally {
      setRefreshing(false)
    }
  }

  async function selectVault(): Promise<void> {
    setVaultBusy(true)
    try {
      const result = await window.alphaK.selectVault()
      if (!result.ok) {
        notify(formatIpcError('Vault 初始化或恢复失败', result.error))
        return
      }
      setVaultConnection(result.data)
      notify(result.data.state === 'ready' ? 'Vault 已就绪' : '未更改 Vault 设置')
    } catch (error) {
      notify(`Vault 选择失败：${errorMessage(error)}`)
    } finally {
      setVaultBusy(false)
    }
  }

  async function rebuildVaultIndex(): Promise<void> {
    setVaultBusy(true)
    try {
      const result = await window.alphaK.rebuildVaultIndex()
      if (!result.ok) {
        notify(formatIpcError('索引重建失败', result.error))
        return
      }
      notify(`索引重建完成：${result.data.indexed} 条，跳过 ${result.data.skipped} 条`)
    } catch (error) {
      notify(`索引重建失败：${errorMessage(error)}`)
    } finally {
      setVaultBusy(false)
    }
  }

  async function createJob(input: EnqueueJobInput): Promise<void> {
    try {
      const result = await window.alphaK.createJob({
        ...input,
        vaultId: input.vaultId ?? vaultConnection?.vault?.id ?? null,
      })
      if (!result.ok) {
        notify(formatIpcError('Job 创建失败', result.error))
        return
      }
      setJobs((current) => upsertJob(current, result.data))
      notify(`Job 已创建：${result.data.type}`)
    } catch (error) {
      notify(`Job 创建失败：${errorMessage(error)}`)
    }
  }

  async function cancelJob(jobId: string): Promise<void> {
    try {
      const result = await window.alphaK.cancelJob(jobId)
      if (!result.ok) {
        notify(formatIpcError('Job 取消失败', result.error))
        return
      }
      setJobs((current) => upsertJob(current, result.data))
      notify('Job 已取消')
    } catch (error) {
      notify(`Job 取消失败：${errorMessage(error)}`)
    }
  }

  async function retryJob(jobId: string): Promise<void> {
    try {
      const result = await window.alphaK.retryJob(jobId)
      if (!result.ok) {
        notify(formatIpcError('Job 恢复失败', result.error))
        return
      }
      setJobs((current) => upsertJob(current, result.data))
      notify('Job 已重新排队')
    } catch (error) {
      notify(`Job 恢复失败：${errorMessage(error)}`)
    }
  }

  function submitGlobalSearch(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (!search.trim()) return
    navigate('library')
    notify(`正在知识库中查找“${search.trim()}”`)
  }

  function saveCapture(): void {
    if (!captureTitle.trim() && !captureContent.trim()) return
    setCaptureOpen(false)
    setCaptureTitle('')
    setCaptureContent('')
    notify(captureKind === 'note' ? '笔记已保存到收件箱' : '链接已加入待分析队列')
  }

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <button type="button" onClick={() => navigate('today')} aria-label="前往今天">
            <span className="brand-mark">K</span>
            <span className="brand-copy"><strong>Alpha-K</strong><small>Local knowledge</small></span>
          </button>
          <IconButton
            label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            {sidebarCollapsed ? <PanelLeft size={17} /> : <ChevronLeft size={17} />}
          </IconButton>
        </div>

        <nav className="sidebar-nav" aria-label="主要导航">
          <span className="nav-label">工作区</span>
          {primaryNavigation.map((item) => (
            <NavItem key={item.id} item={item} active={activePage === item.id} onSelect={navigate} />
          ))}
          <span className="nav-label utility-label">系统</span>
          {utilityNavigation.map((item) => (
            <NavItem key={item.id} item={item} active={activePage === item.id} onSelect={navigate} />
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" onClick={() => navigate('settings')}>
            <span className="vault-status"><i className={vaultConnection?.state === 'ready' ? undefined : 'is-warning'} /><Sparkles size={16} /></span>
            <span>
              <strong>{vaultConnection?.state === 'ready' ? 'Vault 已就绪' : vaultConnection ? 'Vault 需要设置' : '正在读取 Vault'}</strong>
              <small>{vaultConnection?.vault?.path ?? '选择本地目录以初始化或恢复'}</small>
            </span>
          </button>
        </div>
      </aside>

      <main className="app-main">
        <header className="topbar">
          <form className="global-search" onSubmit={submitGlobalSearch}>
            <SearchField value={search} onChange={setSearch} placeholder="搜索知识、标签或来源…" />
          </form>
          <div className="topbar-status" aria-label="应用状态">
            <span><i />本地运行中</span>
            <small>{phaseOneLoading ? 'Phase 1 正在连接' : `${jobs.length} Jobs · 后台 ${status?.backgroundTicks ?? '—'}`}</small>
          </div>
          <div className="topbar-actions">
            <IconButton label="通知" onClick={() => notify('没有需要处理的新通知')}><Bell size={18} /></IconButton>
            <Button icon={<Plus size={16} />} onClick={() => setCaptureOpen(true)}>快速收集</Button>
          </div>
        </header>

        <div className="page-scroll">
          {activePage === 'today' && <TodayPage onNavigate={navigate} jobs={jobs} onCreateJob={createJob} notify={notify} />}
          {activePage === 'inbox' && <InboxPage client={phaseTwoClient} vaultId={vaultConnection?.vault?.id ?? null} />}
          {activePage === 'library' && <LibraryPage notify={notify} />}
          {activePage === 'sources' && <SourcesPage client={phaseTwoClient} vaultId={vaultConnection?.vault?.id ?? null} notify={notify} />}
          {activePage === 'query' && <QueryPage notify={notify} />}
          {activePage === 'reports' && <ReportsPage notify={notify} />}
          {activePage === 'agents' && (
            <AgentsPage
              status={status}
              jobs={jobs}
              refreshing={refreshing}
              onRefresh={() => void refreshProviders()}
              onCreateJob={createJob}
              onCancelJob={cancelJob}
              onRetryJob={retryJob}
              notify={notify}
            />
          )}
          {activePage === 'settings' && (
            <SettingsPage
              vaultConnection={vaultConnection}
              vaultBusy={vaultBusy}
              onSelectVault={selectVault}
              onRebuildVaultIndex={rebuildVaultIndex}
              notify={notify}
            />
          )}
        </div>
      </main>

      {captureOpen && (
        <Modal
          title="快速收集"
          description="先放进收件箱，稍后再让 Agent 整理。"
          onClose={() => setCaptureOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setCaptureOpen(false)}>取消</Button>
              <Button onClick={saveCapture}>保存到收件箱</Button>
            </>
          }
        >
          <SegmentedControl
            label="收集类型"
            value={captureKind}
            onChange={setCaptureKind}
            options={[{ value: 'note', label: '随手记' }, { value: 'link', label: '网页链接' }]}
          />
          <label className="field-label">
            <span>{captureKind === 'note' ? '标题' : '网页标题（可选）'}</span>
            <input value={captureTitle} onChange={(event) => setCaptureTitle(event.target.value)} placeholder="给它一个容易找回的名字" autoFocus />
          </label>
          <label className="field-label">
            <span>{captureKind === 'note' ? '内容' : 'URL'}</span>
            {captureKind === 'note' ? (
              <textarea value={captureContent} onChange={(event) => setCaptureContent(event.target.value)} placeholder="写下想法、摘录或待研究的问题…" />
            ) : (
              <input value={captureContent} onChange={(event) => setCaptureContent(event.target.value)} placeholder="https://" inputMode="url" />
            )}
          </label>
        </Modal>
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}

function upsertJob(current: Job[], updated: Job): Job[] {
  return [updated, ...current.filter((job) => job.id !== updated.id)].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  )
}

function formatIpcError(context: string, error: IpcError): string {
  return `${context}（${error.code}）：${error.message}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function NavItem({
  item,
  active,
  onSelect,
}: {
  item: { id: PageId; label: string; icon: React.ReactNode; badge?: string }
  active: boolean
  onSelect: (page: PageId) => void
}): React.JSX.Element {
  return (
    <button
      className={`nav-item${active ? ' is-active' : ''}`}
      type="button"
      aria-current={active ? 'page' : undefined}
      title={item.label}
      onClick={() => onSelect(item.id)}
    >
      <span className="nav-icon">{item.icon}</span>
      <span className="nav-text">{item.label}</span>
      {item.badge && <span className="nav-badge">{item.badge}</span>}
    </button>
  )
}
