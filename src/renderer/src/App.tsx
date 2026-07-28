import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  BookMarked,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  ChevronRight,
  Cloud,
  Compass,
  Download,
  FileText,
  Inbox,
  Library,
  MessageSquareText,
  PanelLeft,
  Rss,
  RefreshCw,
  Settings,
  Sparkles,
} from 'lucide-react'
import type { PhaseZeroStatus } from '@shared/contracts'
import type { EnqueueJobInput, Job } from '@shared/domain/job'
import type { IpcError } from '@shared/ipc/phase-one-contract'
import type { VaultConnection } from '@shared/domain/vault'
import type { CloudStatus } from '@shared/domain/cloud-sync'
import type { AppUpdateStatus } from '@shared/ipc/update-contract'
import { CapturePopover } from './CapturePopover'
import { LearningCapturesPage } from './LearningCapturesPage'
import { IconButton, SearchField, Toast } from './components'
import { InboxPage } from './InboxPage'
import type { PageId } from './mock-data'
import alphaKLogo from './assets/alpha-k-logo.png'
import { getProductionPhaseTwoClient } from './phase-two-client'
import { ResearchWorkspace, type LearningFieldId } from './ResearchWorkspace'
import { SourcesPage } from './SourcesPage'
import {
  AgentsPage,
  LibraryPage,
  QueryPage,
  ReportsPage,
  SettingsPage,
} from './pages'

const learningFields: Array<{ id: LearningFieldId; label: string; icon: React.ReactNode; tone: string }> = [
  { id: 'ai-systems', label: 'AI 系统', icon: <BrainCircuit size={16} />, tone: 'blue' },
  { id: 'product-design', label: '产品与交互', icon: <Sparkles size={16} />, tone: 'violet' },
  { id: 'business', label: '经济与商业', icon: <BriefcaseBusiness size={16} />, tone: 'amber' },
  { id: 'knowledge-system', label: '个人知识系统', icon: <Compass size={16} />, tone: 'slate' },
]

const pageLabels: Record<PageId, string> = {
  today: '研究空间',
  inbox: '收件箱',
  captures: '待学习',
  library: '全部知识',
  sources: '信息源订阅',
  query: '问 Alpha-K',
  reports: '研究报告',
  agents: 'Agent 与任务',
  settings: '设置与连接',
}

export function App(): React.JSX.Element {
  const phaseTwoClient = getProductionPhaseTwoClient()
  const [status, setStatus] = useState<PhaseZeroStatus | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [captureKind, setCaptureKind] = useState<'note' | 'link'>('link')
  const [captureTitle, setCaptureTitle] = useState('')
  const [captureContent, setCaptureContent] = useState('')
  const [captureSaving, setCaptureSaving] = useState(false)
  const [vaultConnection, setVaultConnection] = useState<VaultConnection | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [phaseOneLoading, setPhaseOneLoading] = useState(true)
  const [vaultBusy, setVaultBusy] = useState(false)
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null)
  const [cloudBusy, setCloudBusy] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null)
  const [activePage, setActivePage] = useState<PageId>('today')
  const [activeField, setActiveField] = useState<LearningFieldId>('ai-systems')
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const settingsMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.alphaK.getPhaseZeroStatus().then(setStatus)
    return window.alphaK.onPhaseZeroStatus(setStatus)
  }, [])

  useEffect(() => {
    let mounted = true
    void window.alphaK.getUpdateStatus()
      .then((nextStatus) => {
        if (mounted) setUpdateStatus(nextStatus)
      })
      .catch((error: unknown) => {
        if (mounted) console.error('更新状态读取失败', error)
      })
    const unsubscribe = window.alphaK.onUpdateStatus((nextStatus) => {
      if (mounted) setUpdateStatus(nextStatus)
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let mounted = true
    void Promise.all([window.alphaK.getVault(), window.alphaK.listJobs(), window.alphaK.getCloudStatus()])
      .then(([vaultResult, jobsResult, cloudResult]) => {
        if (!mounted) return
        if (vaultResult.ok) setVaultConnection(vaultResult.data)
        else setToast(formatIpcError('Vault 状态读取失败', vaultResult.error))
        if (jobsResult.ok) setJobs(jobsResult.data)
        else setToast(formatIpcError('Job 列表读取失败', jobsResult.error))
        if (cloudResult.ok) setCloudStatus(cloudResult.data)
        else setToast(formatIpcError('云端账户状态读取失败', cloudResult.error))
      })
      .catch((error: unknown) => {
        if (mounted) setToast(`Phase 1 服务连接失败：${errorMessage(error)}`)
      })
      .finally(() => {
        if (mounted) setPhaseOneLoading(false)
      })

    const unsubscribe = window.alphaK.onAppEvent((event) => {
      if (event.type === 'job.updated') setJobs((current) => upsertJob(current, event.job))
      if (event.type === 'cloud.status.changed') setCloudStatus(event.status)
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
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCaptureKind('link')
        setCaptureOpen(true)
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('.sidebar-search input')?.focus()
      }
      if (event.key === 'Escape') setCaptureOpen(false)
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    if (!settingsMenuOpen) return undefined
    function closeSettingsMenu(event: PointerEvent): void {
      if (!settingsMenuRef.current?.contains(event.target as Node)) setSettingsMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeSettingsMenu)
    return () => document.removeEventListener('pointerdown', closeSettingsMenu)
  }, [settingsMenuOpen])

  function navigate(page: PageId): void {
    setActivePage(page)
    setSettingsMenuOpen(false)
    resetPageScroll()
  }

  function openField(field: LearningFieldId): void {
    setActiveField(field)
    navigate('today')
  }

  function resetPageScroll(): void {
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

  async function signInWithGitHub(): Promise<void> {
    setCloudBusy(true)
    try {
      const result = await window.alphaK.signInWithGitHub()
      if (!result.ok) {
        notify(formatIpcError('GitHub 登录启动失败', result.error))
        return
      }
      setCloudStatus(result.data)
      notify('已在系统浏览器打开 GitHub，请完成授权后返回 Alpha-K')
    } catch (error) {
      notify(`GitHub 登录启动失败：${errorMessage(error)}`)
    } finally {
      setCloudBusy(false)
    }
  }

  async function signOutCloud(): Promise<void> {
    setCloudBusy(true)
    try {
      const result = await window.alphaK.signOutCloud()
      if (!result.ok) {
        notify(formatIpcError('退出云端账户失败', result.error))
        return
      }
      setCloudStatus(result.data)
      notify('已退出 Supabase 账户，本地 Vault 保持不变')
    } catch (error) {
      notify(`退出云端账户失败：${errorMessage(error)}`)
    } finally {
      setCloudBusy(false)
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

  async function handleUpdateAction(): Promise<void> {
    if (!updateStatus) return
    try {
      const nextStatus = updateStatus.phase === 'ready'
        ? await window.alphaK.restartAndInstallUpdate()
        : await window.alphaK.downloadUpdate()
      setUpdateStatus(nextStatus)
      if (nextStatus.phase === 'error') {
        notify(`应用更新失败：${nextStatus.error ?? '未知错误'}`)
      }
    } catch (error) {
      notify(`应用更新失败：${errorMessage(error)}`)
    }
  }

  function submitGlobalSearch(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (!search.trim()) return
    navigate('library')
    notify(`正在知识库中查找“${search.trim()}”`)
  }

  async function saveCapture(): Promise<void> {
    if (!captureTitle.trim() && !captureContent.trim()) return
    if (cloudStatus?.auth !== 'signed_in' || !cloudStatus.user) {
      notify('请先登录 GitHub 账户后再录入待学习内容')
      return
    }
    setCaptureSaving(true)
    try {
      const result = await window.alphaK.createLearningCapture({
        kind: captureKind,
        title: captureKind === 'note' ? captureTitle || undefined : undefined,
        note: captureKind === 'link' ? captureTitle || undefined : undefined,
        content: captureContent,
      })
      if (!result.ok) {
        notify(formatIpcError('录入失败', result.error))
        return
      }
      setCaptureOpen(false)
      setCaptureTitle('')
      setCaptureContent('')
      notify(captureKind === 'note' ? '想法已收下，留待整理' : '链接已收下，留待学习')
    } catch (error) {
      notify(`录入失败：${errorMessage(error)}`)
    } finally {
      setCaptureSaving(false)
    }
  }

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-hidden' : ''}`}>
      <header className="topbar">
        <div className="topbar-leading">
          <IconButton
            label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            onClick={() => {
              setSettingsMenuOpen(false)
              setSidebarCollapsed((collapsed) => !collapsed)
            }}
          >
            <PanelLeft size={18} />
          </IconButton>
        </div>
        <span className="topbar-page-label">{pageLabels[activePage]}</span>
        <span className="topbar-drag-space" />
        <div className={`topbar-status${isVisibleUpdate(updateStatus) ? ' has-update' : ''}`} aria-label="应用状态">
          <span><Cloud size={15} />{cloudStatus?.auth === 'signed_in' ? (cloudStatus.sync === 'syncing' ? '同步中' : '已同步') : '仅本地'}</span>
          {isVisibleUpdate(updateStatus) && (
            <button
              className={`topbar-update is-${updateStatus.phase}`}
              type="button"
              disabled={updateStatus.phase === 'downloading' || updateStatus.phase === 'installing'}
              onClick={() => void handleUpdateAction()}
              title={updateStatus.error ?? updateButtonLabel(updateStatus)}
              aria-live="polite"
            >
              {updateStatus.phase === 'ready'
                ? <RefreshCw size={13} />
                : <Download className={updateStatus.phase === 'downloading' ? 'is-pulsing' : undefined} size={13} />}
              <span>{updateButtonLabel(updateStatus)}</span>
            </button>
          )}
          <small>{phaseOneLoading ? '正在连接' : `${jobs.length} 个任务`}</small>
        </div>
        <div className="topbar-actions">
          <IconButton label="通知" onClick={() => notify('没有需要处理的新通知')}><Bell size={18} /></IconButton>
        </div>
      </header>

      <aside className="sidebar" aria-hidden={sidebarCollapsed} inert={sidebarCollapsed ? true : undefined}>
        <div className="sidebar-intro">
          <button type="button" onClick={() => navigate('today')} aria-label="前往今日简报">
            <span className="brand-mark"><img src={alphaKLogo} alt="" /></span>
            <span className="brand-copy"><strong>Alpha-K</strong><small>你的本地学习空间</small></span>
          </button>
        </div>

        <div className="sidebar-tools">
          <CapturePopover
            open={captureOpen}
            kind={captureKind}
            title={captureTitle}
            content={captureContent}
            placement="right"
            onOpenChange={setCaptureOpen}
            onKindChange={setCaptureKind}
            onTitleChange={setCaptureTitle}
            onContentChange={setCaptureContent}
            signedIn={cloudStatus?.auth === 'signed_in' && Boolean(cloudStatus.user)}
            saving={captureSaving}
            onRequireSignIn={() => void signInWithGitHub()}
            onSubmit={() => void saveCapture()}
          />
          <form className="sidebar-search" onSubmit={submitGlobalSearch}>
            <SearchField value={search} onChange={setSearch} placeholder="搜索知识…" compact />
          </form>
        </div>

        <nav className="sidebar-nav" aria-label="主要导航">
          <NavItem
            item={{ id: 'query', label: '问 Alpha-K', icon: <MessageSquareText size={18} /> }}
            active={activePage === 'query'}
            onSelect={navigate}
            shortcut="⌘ J"
          />
          <NavItem
            item={{ id: 'inbox', label: '收件箱', icon: <Inbox size={18} />, badge: '6' }}
            active={activePage === 'inbox'}
            onSelect={navigate}
          />
          <NavItem
            item={{ id: 'captures', label: '待学习', icon: <BookMarked size={18} /> }}
            active={activePage === 'captures'}
            onSelect={navigate}
          />

          <span className="nav-label nav-label-spaced">学习领域</span>
          {learningFields.map((field) => (
            <button
              className={`nav-item field-nav-item${activePage === 'today' && activeField === field.id ? ' is-active' : ''}`}
              type="button"
              key={field.id}
              aria-current={activePage === 'today' && activeField === field.id ? 'page' : undefined}
              onClick={() => openField(field.id)}
            >
              <span className={`field-nav-icon tone-${field.tone}`}>{field.icon}</span>
              <span className="nav-text">{field.label}</span>
              {activePage === 'today' && activeField === field.id && <i className="field-active-dot" />}
            </button>
          ))}

          <div className="nav-quiet-actions">
            <NavItem
              item={{ id: 'library', label: '全部知识', icon: <Library size={18} /> }}
              active={activePage === 'library'}
              onSelect={navigate}
            />
            <NavItem
              item={{ id: 'reports', label: '研究报告', icon: <FileText size={18} /> }}
              active={activePage === 'reports'}
              onSelect={navigate}
            />
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="account-button" type="button" onClick={() => navigate('settings')}>
            <span className="account-avatar">
              {cloudStatus?.user?.avatarUrl ? <img src={cloudStatus.user.avatarUrl} alt="" /> : (cloudStatus?.user?.displayName?.slice(0, 1) ?? 'K')}
              <i className={cloudStatus?.auth === 'signed_in' ? 'is-online' : undefined} />
            </span>
            <span className="account-copy">
              <strong>{cloudStatus?.user?.displayName ?? cloudStatus?.user?.email ?? '本地使用'}</strong>
              <small>{cloudStatus?.auth === 'signed_in' ? '账户与状态同步已连接' : '未登录 · 本地功能可用'}</small>
            </span>
          </button>
          <div className="settings-menu-shell" ref={settingsMenuRef}>
            <IconButton
              label={settingsMenuOpen ? '关闭设置菜单' : '打开设置菜单'}
              active={settingsMenuOpen || activePage === 'settings'}
              onClick={() => setSettingsMenuOpen((open) => !open)}
            >
              <Settings size={18} />
            </IconButton>
            {settingsMenuOpen && (
              <div className="settings-popover" role="menu" aria-label="设置菜单">
                <header><strong>设置</strong><span>连接与本地运行</span></header>
                <button type="button" role="menuitem" onClick={() => navigate('settings')}>
                  <span><Settings size={16} /></span><div><strong>设置与连接</strong><small>账户、Vault 与应用行为</small></div><ChevronRight size={14} />
                </button>
                <button type="button" role="menuitem" onClick={() => navigate('sources')}>
                  <span><Rss size={16} /></span><div><strong>信息源订阅</strong><small>RSS 与同步状态</small></div><ChevronRight size={14} />
                </button>
                <button type="button" role="menuitem" onClick={() => navigate('agents')}>
                  <span><Bot size={16} /></span><div><strong>Agent 与任务</strong><small>Codex、Qoder 与 Job</small></div><ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="app-main">
        <div className="page-scroll">
          {activePage === 'today' && (
            <ResearchWorkspace
              field={activeField}
              onNavigateInbox={() => navigate('inbox')}
              onNotify={notify}
            />
          )}
          {activePage === 'inbox' && <InboxPage client={phaseTwoClient} vaultId={vaultConnection?.vault?.id ?? null} />}
          {activePage === 'captures' && (
            <LearningCapturesPage
              cloudStatus={cloudStatus}
              signInBusy={cloudBusy}
              onSignIn={() => void signInWithGitHub()}
              onNotify={notify}
            />
          )}
          {activePage === 'library' && <LibraryPage notify={notify} search={search} />}
          {activePage === 'sources' && (
            <SourcesPage
              client={phaseTwoClient}
              vaultId={vaultConnection?.vault?.id ?? null}
              notify={notify}
              onBack={() => navigate('settings')}
            />
          )}
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
              onBack={() => navigate('settings')}
            />
          )}
          {activePage === 'settings' && (
            <SettingsPage
              vaultConnection={vaultConnection}
              vaultBusy={vaultBusy}
              cloudStatus={cloudStatus}
              cloudBusy={cloudBusy}
              onSelectVault={selectVault}
              onRebuildVaultIndex={rebuildVaultIndex}
              onSignInWithGitHub={signInWithGitHub}
              onSignOutCloud={signOutCloud}
              onNavigate={navigate}
              providerStatus={status}
              notify={notify}
            />
          )}
        </div>
      </main>

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

function isVisibleUpdate(status: AppUpdateStatus | null): status is AppUpdateStatus {
  return Boolean(
    status?.supported &&
    status.availableVersion &&
    ['available', 'downloading', 'ready', 'installing', 'error'].includes(status.phase),
  )
}

function updateButtonLabel(status: AppUpdateStatus): string {
  if (status.phase === 'downloading') return `下载 ${Math.round(status.percent ?? 0)}%`
  if (status.phase === 'ready') return '重启更新'
  if (status.phase === 'installing') return '正在重启'
  if (status.phase === 'error') return '重试更新'
  return `更新 ${status.availableVersion ?? ''}`.trim()
}

function NavItem({
  item,
  active,
  onSelect,
  shortcut,
}: {
  item: { id: PageId; label: string; icon: React.ReactNode; badge?: string }
  active: boolean
  onSelect: (page: PageId) => void
  shortcut?: string
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
      {shortcut && <kbd>{shortcut}</kbd>}
    </button>
  )
}
