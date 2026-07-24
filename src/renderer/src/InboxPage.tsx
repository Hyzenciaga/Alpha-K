import { useEffect, useMemo, useState } from 'react'
import { Atom, CheckCircle2, ExternalLink, FileText, RefreshCw, Rss, TriangleAlert } from 'lucide-react'
import type { InboxItemStatus, InboxItemSummary } from '../../shared/domain/inbox.js'
import { Button, SearchField, StatusDot, Tag } from './components.js'
import type { PhaseTwoRendererClient } from './phase-two-client.js'
import {
  buildInboxFilter,
  InboxViewModel,
  INBOX_PHASE_FOUR_ACTIONS,
  type InboxViewState,
} from './phase-two-view-models.js'

type StatusFilter = 'all' | InboxItemStatus

const EMPTY_INBOX_STATE: InboxViewState = {
  status: 'idle',
  items: [],
  sources: [],
  error: null,
  filter: { vaultId: '00000000-0000-4000-8000-000000000000', limit: 100, offset: 0 },
}

export function InboxPage({
  client,
  vaultId,
}: {
  client: PhaseTwoRendererClient
  vaultId: string | null
}): React.JSX.Element {
  const model = useMemo(() => (vaultId ? new InboxViewModel(client, vaultId) : null), [client, vaultId])
  const [view, setView] = useState<InboxViewState>(EMPTY_INBOX_STATE)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sourceId, setSourceId] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!model) {
      setView(EMPTY_INBOX_STATE)
      return undefined
    }
    setView(model.state)
    return model.subscribe(() => setView(model.state))
  }, [model])

  useEffect(() => {
    if (!model || !vaultId) return undefined
    const timer = window.setTimeout(() => {
      void model.refresh(buildInboxFilter(vaultId, {
        ...(sourceId === 'all' ? {} : { sourceId }),
        ...(status === 'all' ? {} : { status }),
        search,
      }))
    }, search ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [model, search, sourceId, status, vaultId])

  useEffect(() => {
    if (view.items.length === 0) {
      setActiveId(null)
      return
    }
    if (!view.items.some((item) => item.id === activeId)) setActiveId(view.items[0].id)
  }, [activeId, view.items])

  const activeItem = view.items.find((item) => item.id === activeId) ?? view.items[0]
  const failedCount = view.items.filter((item) => item.status === 'failed').length

  return (
    <div className="page page-inbox page-inbox-review">
      <header className="inbox-page-heading">
        <div>
          <div className="inbox-title-line">
            <h1>收件箱</h1>
            <label className="inbox-source-filter">
              <span className="sr-only">来源</span>
              <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                <option value="all">全部来源</option>
                {view.sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}{source.type === 'rss' ? '' : ' · 后续批次'}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p>采集内容先在这里等待判断，不会自动进入知识库。</p>
        </div>
        <span className="inbox-phase-badge">真实采集 · 判断操作尚未接入</span>
      </header>

      {!vaultId ? (
        <PageState icon={<FileText size={28} />} title="请先配置 Vault" description="收件箱查询必须绑定到一个已就绪的本地 Vault。" />
      ) : (
        <>
          <div className="inbox-review-toolbar">
            <label className="inbox-status-filter">
              <span>采集状态</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
                <option value="all">全部状态</option>
                <option value="discovered">已发现</option>
                <option value="fetched">已抓取</option>
                <option value="extracted">已提取</option>
                <option value="failed">失败</option>
              </select>
            </label>
            <div className="toolbar-actions">
              <SearchField value={search} onChange={setSearch} placeholder="服务端搜索标题、摘录或来源" compact />
              <Button variant="secondary" icon={<RefreshCw size={16} />} disabled={view.status === 'loading'} onClick={() => void model?.refresh()}>刷新</Button>
            </div>
          </div>

          <div className="inbox-result-summary inbox-review-summary" aria-live="polite">
            <span>{view.items.length} 条待查看内容</span>
            {failedCount > 0 && <span className="failed-summary"><StatusDot status="danger" />{failedCount} 条失败</span>}
            <span>按抓取时间排列 · 搜索与筛选由后端执行</span>
          </div>

          {view.status === 'idle' || view.status === 'loading' ? (
            <PageState loading title="正在读取收件箱" description="查询持久化 InboxItemSummary 投影。" />
          ) : view.status === 'error' ? (
            <PageState icon={<TriangleAlert size={28} />} title="收件箱读取失败" description={view.error ?? '无法连接 Phase 2 IPC。'} action={<Button variant="secondary" onClick={() => void model?.refresh()}>重试</Button>} />
          ) : view.status === 'empty' ? (
            <PageState icon={<CheckCircle2 size={28} />} title="没有匹配的采集结果" description={search || sourceId !== 'all' || status !== 'all' ? '调整来源、状态或搜索条件后重试。' : '同步 RSS 来源后，确定性的采集结果会出现在这里。'} />
          ) : (
            <div className="review-layout phase-two-inbox-layout">
              <section className="review-list" aria-label="采集结果">
                {view.items.map((item) => (
                  <article
                    className={`review-row${item.id === activeItem?.id ? ' is-active' : ''}`}
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={item.id === activeItem?.id}
                    onClick={() => setActiveId(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setActiveId(item.id)
                      }
                    }}
                  >
                    <div className={`source-glyph inbox-status-${item.status}`}>{sourceGlyph(item.sourceType)}</div>
                    <div className="review-row-copy">
                      <span className="review-item-kind">{sourceTypeLabel(item.sourceType)}</span>
                      <h3>{item.title}</h3>
                      <p>{item.excerpt ?? (item.status === 'failed' ? '采集失败，当前没有可用摘录。' : '当前条目没有摘录。')}</p>
                      <div className="tag-row">{item.labels.slice(0, 2).map((label) => <Tag key={label}>{label}</Tag>)}</div>
                    </div>
                    <div className="review-row-source">
                      <strong>{item.sourceName}</strong>
                      <time dateTime={item.fetchedAt}>{formatShortDate(item.fetchedAt)}</time>
                      <IngestionStatus status={item.status} />
                    </div>
                    <div className="review-row-decisions" aria-label="判断操作尚未接入">
                      {INBOX_PHASE_FOUR_ACTIONS.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          className={action.id === 'accept' ? 'is-primary' : undefined}
                          disabled={action.disabled}
                          title="等待后端判断协议"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {action.id === 'accept' ? '入库' : '不喜欢'}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </section>

              {activeItem && <InboxDetail item={activeItem} />}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function InboxDetail({ item }: { item: InboxItemSummary }): React.JSX.Element {
  return (
    <aside className="review-detail phase-two-inbox-detail">
      <header className="detail-header">
        <div className="detail-provenance">
          <span>{sourceTypeLabel(item.sourceType)}</span>
          <span>来自 {item.sourceName}</span>
          <span>抓取于 {formatShortDate(item.fetchedAt)}</span>
        </div>
        {item.canonicalUrl && <a className="icon-button" href={item.canonicalUrl} target="_blank" rel="noreferrer" aria-label="打开原文" title="打开原文"><ExternalLink size={17} /></a>}
      </header>
      <h2>{item.title}</h2>
      <p className="detail-byline">{item.authors.length > 0 ? item.authors.join('、') : '未知作者'}</p>

      <section className={`deterministic-excerpt${item.status === 'failed' ? ' is-failed' : ''}`}>
        <div><strong>内容摘录</strong><IngestionStatus status={item.status} /></div>
        <p>{item.excerpt ?? (item.status === 'failed' ? '该条目采集失败，后端没有返回可展示的摘录。' : '该条目暂时没有可展示的摘录。')}</p>
      </section>

      <section className="detail-section detail-grid phase-two-detail-grid" aria-label="来源信息">
        <div><span>来源</span><strong>{item.sourceName}</strong></div>
        <div><span>发布时间</span><strong>{formatDate(item.publishedAt)}</strong></div>
        <div><span>抓取时间</span><strong>{formatDate(item.fetchedAt)}</strong></div>
        <div><span>Source ID</span><strong className="mono-value">{item.sourceId}</strong></div>
        <div><span>外部 ID</span><strong className="mono-value">{item.externalId ?? '—'}</strong></div>
        <div><span>Artifact</span><strong className="mono-value">{item.primaryArtifactId ?? '—'}</strong></div>
      </section>

      <section className="detail-section">
        <div className="section-label"><span>来源默认标签</span></div>
        <div className="tag-row">{item.labels.length > 0 ? item.labels.map((label) => <Tag key={label}>{label}</Tag>) : <span className="muted-copy">无</span>}</div>
      </section>

      <div className="phase-four-notice"><strong>判断工作流</strong><span>“入库 / 不喜欢”仅展示目标交互；后端协议尚未实现，当前不会下载、写入 Vault 或修改偏好。</span></div>
      <footer className="review-actions">
        {INBOX_PHASE_FOUR_ACTIONS.map((action) => <Button key={action.id} variant={action.id === 'accept' ? 'primary' : 'secondary'} disabled={action.disabled}>{action.label}</Button>)}
      </footer>
    </aside>
  )
}

function IngestionStatus({ status }: { status: InboxItemStatus }): React.JSX.Element {
  const tone = status === 'failed' ? 'danger' : status === 'extracted' ? 'success' : 'warning'
  return <span className="ingestion-status"><StatusDot status={tone} />{statusLabel(status)}</span>
}

function PageState({ loading = false, icon, title, description, action }: { loading?: boolean; icon?: React.ReactNode; title: string; description: string; action?: React.ReactNode }): React.JSX.Element {
  return <div className="empty-state phase-two-page-state">{loading ? <RefreshCw size={28} className="spin" /> : icon}<h3>{title}</h3><p>{description}</p>{action}</div>
}

function sourceGlyph(type: InboxItemSummary['sourceType']): React.JSX.Element {
  if (type === 'rss') return <Rss size={17} />
  if (type === 'arxiv') return <Atom size={18} />
  return <FileText size={17} />
}

function sourceTypeLabel(type: InboxItemSummary['sourceType']): string {
  return type === 'rss' ? 'RSS' : type === 'arxiv' ? 'arXiv · 后续批次' : '目录 · 后续批次'
}

function statusLabel(status: InboxItemStatus): string {
  return ({ discovered: '已发现', fetched: '已抓取', extracted: '已提取', failed: '失败' } as const)[status]
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatShortDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(value))
}
