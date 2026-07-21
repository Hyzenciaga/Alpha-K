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
import { Button, IconButton, Modal, SearchField, SegmentedControl, Toast } from './components'
import type { PageId } from './mock-data'
import {
  AgentsPage,
  InboxPage,
  LibraryPage,
  QueryPage,
  ReportsPage,
  SettingsPage,
  SourcesPage,
  TodayPage,
} from './pages'

const primaryNavigation: Array<{ id: PageId; label: string; icon: React.ReactNode; badge?: string }> = [
  { id: 'today', label: '今天', icon: <Home size={18} /> },
  { id: 'inbox', label: '收件箱', icon: <Inbox size={18} />, badge: '7' },
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

  useEffect(() => {
    void window.alphaK.getPhaseZeroStatus().then(setStatus)
    return window.alphaK.onPhaseZeroStatus(setStatus)
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
          <IconButton label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
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
            <span className="vault-status"><i /><Sparkles size={16} /></span>
            <span><strong>Vault 已同步</strong><small>2 分钟前 · 128 items</small></span>
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
            <small>{status ? `后台 ${status.backgroundTicks}` : '正在连接'}</small>
          </div>
          <div className="topbar-actions">
            <IconButton label="通知" onClick={() => notify('没有需要处理的新通知')}><Bell size={18} /></IconButton>
            <Button icon={<Plus size={16} />} onClick={() => setCaptureOpen(true)}>快速收集</Button>
          </div>
        </header>

        <div className="page-scroll">
          {activePage === 'today' && <TodayPage onNavigate={navigate} notify={notify} />}
          {activePage === 'inbox' && <InboxPage notify={notify} />}
          {activePage === 'library' && <LibraryPage notify={notify} />}
          {activePage === 'sources' && <SourcesPage notify={notify} />}
          {activePage === 'query' && <QueryPage notify={notify} />}
          {activePage === 'reports' && <ReportsPage notify={notify} />}
          {activePage === 'agents' && (
            <AgentsPage status={status} refreshing={refreshing} onRefresh={() => void refreshProviders()} notify={notify} />
          )}
          {activePage === 'settings' && <SettingsPage notify={notify} />}
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
