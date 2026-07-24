import { useState } from 'react'
import {
  Activity,
  Archive,
  ArrowRight,
  Atom,
  Bot,
  Check,
  ChevronRight,
  Clock3,
  Cloud,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileInput,
  FileText,
  Filter,
  Folder,
  FolderOpen,
  Gauge,
  GitFork,
  Grid2X2,
  Heart,
  Inbox,
  Library,
  List,
  LogOut,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Rss,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import type { PhaseZeroStatus, ProviderProbeStatus } from '../../shared/contracts'
import type { EnqueueJobInput, Job, JobStatus } from '../../shared/domain/job'
import type { VaultConnection } from '../../shared/domain/vault'
import type { CloudStatus } from '../../shared/domain/cloud-sync'
import {
  activity,
  libraryItems,
  reports,
  weeklyBars,
  type KnowledgeItem,
  type PageId,
} from './mock-data'
import {
  Button,
  IconButton,
  PageHeader,
  ProgressRing,
  SegmentedControl,
  SelectButton,
  StatusDot,
  Tag,
  Toggle,
} from './components'

type Navigate = (page: PageId) => void
type Notify = (message: string) => void
type CreateJob = (input: EnqueueJobInput) => Promise<void>
type JobAction = (jobId: string) => Promise<void>

export function TodayPage({
  onNavigate,
  jobs,
  onCreateJob,
}: {
  onNavigate: Navigate
  jobs: Job[]
  onCreateJob: CreateJob
  notify: Notify
}): React.JSX.Element {
  const runningJobs = jobs.filter((job) => job.status === 'running').length
  const pendingJobs = jobs.filter((job) => job.status === 'queued' || job.status === 'scheduled').length
  const attentionJobs = jobs.filter((job) => job.status === 'failed' || job.status === 'interrupted').length

  return (
    <div className="page page-today">
      <PageHeader
        eyebrow="WEDNESDAY · JULY 22"
        title="早上好，Steve"
        description="昨晚到现在，5 个来源带来了 18 条新内容。Agent 已经帮你挑出 4 条值得优先确认。"
        actions={
          <>
            <Button
              variant="secondary"
              icon={<RefreshCw size={16} />}
              onClick={() => void onCreateJob({ type: 'source.sync', priority: 'normal', payload: { scope: 'all' } })}
            >
              同步全部
            </Button>
            <Button icon={<Sparkles size={16} />} onClick={() => onNavigate('query')}>
              生成今日摘要
            </Button>
          </>
        }
      />

      <PhaseScopeNotice>Phase 1 已接通 Vault、Job 与 Provider；以下知识内容和统计仍为 Mock。</PhaseScopeNotice>

      <section className="metric-grid" aria-label="今日概览">
        <MetricCard label="今日新增" value="18" change="来自 5 个来源" icon={<FileInput size={18} />} />
        <MetricCard label="待确认" value="7" change="其中 4 条高价值" icon={<Inbox size={18} />} accent />
        <MetricCard label="本周已收录" value="46" change="比上周多 12%" icon={<Archive size={18} />} />
        <MetricCard
          label="后台任务"
          value={String(jobs.length)}
          change={`${runningJobs} 运行中 · ${pendingJobs} 等待${attentionJobs ? ` · ${attentionJobs} 需处理` : ''}`}
          icon={<Activity size={18} />}
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel focus-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">AGENT PICKS</p>
              <h2>今天值得先看</h2>
            </div>
            <button className="text-action" type="button" onClick={() => onNavigate('inbox')}>
              查看全部 <ArrowRight size={15} />
            </button>
          </div>
          <div className="focus-list">
            {libraryItems.slice(0, 3).map((item, index) => (
              <article className="focus-item" key={item.id}>
                <span className="focus-rank">0{index + 1}</span>
                <div className="focus-copy">
                  <div className="item-meta">
                    <span>{item.source}</span>
                    <span>{item.time}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  <div className="tag-row">
                    {item.labels.slice(0, 2).map((label) => (
                      <Tag key={label}>{label}</Tag>
                    ))}
                  </div>
                </div>
                <button className="round-arrow" type="button" aria-label={`打开 ${item.title}`} onClick={() => onNavigate('inbox')}>
                  <ChevronRight size={18} />
                </button>
              </article>
            ))}
          </div>
        </section>

        <aside className="side-stack">
          <section className="panel digest-card">
            <div className="digest-mark"><WandSparkles size={19} /></div>
            <p className="panel-kicker">TODAY’S BRIEF</p>
            <h2>信息正在向“可恢复的本地 Agent”聚拢</h2>
            <p>
              今天最明显的交叉主题是：文件协议、运行时记忆和持久化任务正在从工程细节变成产品边界。
            </p>
            <button type="button" onClick={() => onNavigate('query')}>
              阅读完整摘要 <ArrowRight size={15} />
            </button>
          </section>

          <section className="panel activity-panel">
            <div className="panel-heading compact-heading">
              <h2>最近活动</h2>
              <IconButton label="更多活动"><MoreHorizontal size={17} /></IconButton>
            </div>
            <ol className="activity-list">
              {activity.map((event) => (
                <li key={`${event.time}-${event.text}`}>
                  <StatusDot status={event.tone === 'neutral' ? 'muted' : event.tone} />
                  <span>{event.text}</span>
                  <time>{event.time}</time>
                </li>
              ))}
            </ol>
          </section>
        </aside>

        <section className="panel weekly-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">THIS WEEK</p>
              <h2>采集节奏</h2>
            </div>
            <span className="big-inline-number">113 <small>条内容</small></span>
          </div>
          <div className="bar-chart" role="img" aria-label="本周每天新增内容：周一 9，周二 14，周三 8，周四 21，周五 17，周六 26，周日 18">
            {weeklyBars.map((value, index) => (
              <div className="bar-column" key={`${value}-${index}`}>
                <span className="bar-value">{value}</span>
                <div className="bar-track"><span style={{ height: `${(value / 26) * 100}%` }} /></div>
                <small>{['一', '二', '三', '四', '五', '六', '日'][index]}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="panel source-health-panel">
          <div className="panel-heading compact-heading">
            <div>
              <p className="panel-kicker">SOURCE HEALTH</p>
              <h2>来源状态</h2>
            </div>
            <button className="text-action" type="button" onClick={() => onNavigate('sources')}>管理</button>
          </div>
          <div className="health-summary">
            <ProgressRing value={0.92} label="健康" />
            <div>
              <strong>5 个来源正常同步</strong>
              <p>Codex 输出目录需要重新确认文件访问范围。</p>
              <span><StatusDot status="warning" /> 1 个提醒</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  change,
  icon,
  accent = false,
}: {
  label: string
  value: string
  change: string
  icon: React.ReactNode
  accent?: boolean
}): React.JSX.Element {
  return (
    <article className={`metric-card${accent ? ' is-accent' : ''}`}>
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{change}</small>
    </article>
  )
}

export function LibraryPage({ notify, search = '' }: { notify: Notify; search?: string }): React.JSX.Element {
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [scope, setScope] = useState<'all' | 'favorite' | 'later'>('all')
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const labels = ['Local-first', 'Agent Memory', 'RAG', 'SQLite', 'Reliability', 'Product Design']
  const visibleItems = libraryItems.filter((item, index) => {
    const matchesSearch = `${item.title} ${item.summary} ${item.labels.join(' ')}`.toLowerCase().includes(search.toLowerCase())
    const matchesLabels = selectedLabels.length === 0 || selectedLabels.every((label) => item.labels.includes(label))
    const matchesScope = scope === 'all' || (scope === 'favorite' ? index < 2 : index >= 2 && index < 4)
    return matchesSearch && matchesLabels && matchesScope
  })

  function toggleLabel(label: string): void {
    setSelectedLabels((current) => current.includes(label) ? current.filter((item) => item !== label) : [...current, label])
  }

  return (
    <div className="page page-library">
      <PageHeader
        eyebrow="KNOWLEDGE VAULT · MOCK"
        title="知识库"
        description="已确认的内容、笔记与报告都保存在你的本地 Vault 中。"
        actions={<Button icon={<Plus size={16} />} onClick={() => notify('已打开导入文件选择器（Mock）')}>导入文件</Button>}
      />
      <MockNotice scope="知识库内容" />
      <section className="library-content library-content-horizontal">
        <div className="section-command-bar library-command-bar">
          <div className="horizontal-tabs" role="tablist" aria-label="知识范围">
            <button className={scope === 'all' ? 'is-active' : undefined} type="button" role="tab" aria-selected={scope === 'all'} onClick={() => setScope('all')}><Library size={15} />全部知识<span>128</span></button>
            <button className={scope === 'favorite' ? 'is-active' : undefined} type="button" role="tab" aria-selected={scope === 'favorite'} onClick={() => setScope('favorite')}><Heart size={15} />收藏<span>23</span></button>
            <button className={scope === 'later' ? 'is-active' : undefined} type="button" role="tab" aria-selected={scope === 'later'} onClick={() => setScope('later')}><Clock3 size={15} />稍后阅读<span>11</span></button>
          </div>
          <div className="command-actions">
            <button className="topic-shortcut" type="button" onClick={() => notify('已打开专题视图（Mock）')}><FolderOpen size={15} />3 个专题</button>
            <SelectButton>最近更新</SelectButton>
            <div className="view-toggle">
              <IconButton label="卡片视图" active={view === 'grid'} onClick={() => setView('grid')}><Grid2X2 size={17} /></IconButton>
              <IconButton label="列表视图" active={view === 'list'} onClick={() => setView('list')}><List size={18} /></IconButton>
            </div>
          </div>
        </div>
        <div className="library-label-bar" aria-label="标签筛选">
          <span>标签</span>
          {labels.map((label) => (
            <button className={selectedLabels.includes(label) ? 'is-active' : undefined} type="button" key={label} aria-pressed={selectedLabels.includes(label)} onClick={() => toggleLabel(label)}>
              {selectedLabels.includes(label) && <Check size={12} />}{label}
            </button>
          ))}
          {selectedLabels.length > 0 && <button className="clear-labels" type="button" onClick={() => setSelectedLabels([])}>清除</button>}
        </div>
        <div className="result-summary"><span>{scope === 'all' ? '全部知识' : scope === 'favorite' ? '收藏' : '稍后阅读'} · 显示 {visibleItems.length} 条内容</span><span>Vault 最后更新于 2 分钟前</span></div>
        <div className={`library-items is-${view}`}>
          {visibleItems.map((item) => <LibraryCard key={item.id} item={item} view={view} notify={notify} />)}
        </div>
      </section>
    </div>
  )
}

function LibraryCard({ item, view, notify }: { item: KnowledgeItem; view: 'grid' | 'list'; notify: Notify }): React.JSX.Element {
  return (
    <article className="library-card">
      <div className="library-card-top">
        <div className="source-glyph">{sourceGlyph(item.sourceType)}</div>
        <div className="card-quick-actions">
          <IconButton label="收藏" onClick={() => notify('已加入收藏')}><Heart size={16} /></IconButton>
          <IconButton label="更多"><MoreHorizontal size={17} /></IconButton>
        </div>
      </div>
      <div className="item-meta"><span>{item.source}</span><span>{item.time}</span></div>
      <h3>{item.title}</h3>
      <p>{item.summary}</p>
      <div className="tag-row">{item.labels.map((label) => <Tag key={label}>{label}</Tag>)}</div>
      <footer>
        <span>{item.author}</span>
        <button type="button" onClick={() => notify(`已打开「${item.title}」`)}>阅读 <ArrowRight size={14} /></button>
      </footer>
      {view === 'list' && <span className="list-reading-time">{item.readingMinutes} min</span>}
    </article>
  )
}

export function QueryPage({ notify }: { notify: Notify }): React.JSX.Element {
  const [question, setQuestion] = useState('本周 Agent Memory 方向有哪些值得关注的进展？')
  const [scope, setScope] = useState<'week' | 'all' | 'selected'>('week')
  const [provider, setProvider] = useState<'auto' | 'codex' | 'qoder'>('auto')
  const [answer, setAnswer] = useState(false)
  const [generating, setGenerating] = useState(false)

  function submitQuestion(): void {
    if (!question.trim() || generating) return
    setGenerating(true)
    setAnswer(false)
    window.setTimeout(() => {
      setGenerating(false)
      setAnswer(true)
      notify('回答已生成，并验证了 5 条本地引用')
    }, 850)
  }

  return (
    <div className="page page-query">
      <PageHeader
        eyebrow="ASK YOUR VAULT · MOCK"
        title="问答"
        description="应用先从本地知识库确定范围，再让 Agent 基于可验证的资料回答。"
      />
      <MockNotice scope="问答" />
      <div className="query-layout">
        <aside className="conversation-rail">
          <Button icon={<Plus size={16} />} onClick={() => { setQuestion(''); setAnswer(false) }}>新建问题</Button>
          <div className="conversation-group">
            <span>今天</span>
            <button className="is-active" type="button">Agent Memory 的最新进展</button>
            <button type="button">今天有什么值得看？</button>
          </div>
          <div className="conversation-group">
            <span>本周</span>
            <button type="button">比较三篇 Local-first 文章</button>
            <button type="button">SQLite 检索方案梳理</button>
          </div>
        </aside>

        <section className="query-main">
          <div className="query-composer">
            <div className="composer-topline"><Sparkles size={17} /><span>基于你的本地知识提问</span></div>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="问题" />
            <div className="composer-controls">
              <div>
                <SegmentedControl label="知识范围" value={scope} onChange={setScope} options={[
                  { value: 'week', label: '本周' },
                  { value: 'all', label: '全库' },
                  { value: 'selected', label: '已选择' },
                ]} />
                <SelectButton
                  onClick={() => setProvider(provider === 'auto' ? 'codex' : provider === 'codex' ? 'qoder' : 'auto')}
                >
                  {provider === 'auto' ? '自动选择 Agent' : provider === 'codex' ? 'Codex' : 'Qoder'}
                </SelectButton>
              </div>
              <button className="send-button" type="button" disabled={!question.trim() || generating} aria-label="发送问题" onClick={submitQuestion}>
                {generating ? <RefreshCw size={18} className="spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>

          {!answer && !generating && (
            <div className="query-suggestions">
              <p>你也可以这样问</p>
              <div>
                {['今天有什么值得看？', '对比选中的三篇材料', '有哪些高价值内容还没确认？', '基于本周内容提出研究问题'].map((prompt) => (
                  <button key={prompt} type="button" onClick={() => setQuestion(prompt)}>{prompt}<ArrowRight size={14} /></button>
                ))}
              </div>
            </div>
          )}

          {generating && <AnswerSkeleton />}

          {answer && (
            <article className="answer-card">
              <header><div className="answer-avatar"><Bot size={18} /></div><div><strong>Alpha-K Answer</strong><span>Qoder · 使用 5 条资料 · 8.4s</span></div><IconButton label="复制回答" onClick={() => notify('回答已复制')}><Copy size={16} /></IconButton></header>
              <div className="answer-body">
                <p>本周 Agent Memory 方向有三个值得关注的进展：</p>
                <h3>1. Memory 正在变成运行时原语</h3>
                <p>新的工作不再把记忆理解为“把聊天记录塞进向量库”，而是区分短期轨迹、长期语义记忆和用户偏好，并为写入、遗忘和冲突建立显式生命周期。<Citation id="K:arxiv-2607.18421" /></p>
                <h3>2. 可复现性依赖 Retrieval Snapshot</h3>
                <p>对知识型 Agent 来说，历史答案能否解释，不取决于保存外部 Session，而取决于是否保存了当时使用的资料范围与稳定引用 ID。<Citation id="K:research-retrieval-snapshot" /></p>
                <h3>3. 文件协议正在成为产品边界</h3>
                <p>Local-first 产品倾向于把知识内容保存在可迁移文件中，把数据库降为索引和运行状态。这让 Agent 可以被替换，而用户资产不随应用生命周期消失。<Citation id="K:ink-switch-files-api" /></p>
                <div className="answer-callout"><strong>值得继续追踪</strong><span>如何为长期 Memory 建立可解释的遗忘策略，以及怎样衡量跨任务记忆带来的真实收益。</span></div>
              </div>
              <footer><button type="button" onClick={() => notify('已保存为 Note')}>保存为笔记</button><button type="button" onClick={() => notify('已加入 Agent Memory 专题')}>加入专题</button><button type="button" onClick={submitQuestion}><RefreshCw size={14} /> 重新生成</button></footer>
            </article>
          )}
        </section>
      </div>
    </div>
  )
}

function Citation({ id }: { id: string }): React.JSX.Element {
  return <button className="citation" type="button">{id}</button>
}

function AnswerSkeleton(): React.JSX.Element {
  return (
    <div className="answer-skeleton" aria-label="正在生成回答">
      <div className="skeleton-header"><span /><div><i /><i /></div></div>
      <i /><i /><i className="short" /><i /><i className="medium" />
    </div>
  )
}

export function ReportsPage({ notify }: { notify: Notify }): React.JSX.Element {
  const [selectedId, setSelectedId] = useState(reports[0].id)
  const selected = reports.find((report) => report.id === selectedId) ?? reports[0]
  return (
    <div className="page page-reports">
      <PageHeader
        eyebrow="SYNTHESIS · MOCK"
        title="报告"
        description="把一周的阅读与收藏沉淀成可脱离应用阅读、带有本地引用的 Markdown 产物。"
        actions={<Button icon={<Sparkles size={16} />} onClick={() => notify('已创建本周报告生成任务')}>生成本周报告</Button>}
      />
      <MockNotice scope="报告" />
      <div className="reports-layout reports-layout-horizontal">
        <section className="report-list report-strip" aria-label="报告列表">
          <div className="report-list-heading"><span>周报</span><IconButton label="报告筛选"><Filter size={16} /></IconButton></div>
          <div className="report-strip-items">
            {reports.map((report) => (
              <button className={report.id === selectedId ? 'is-active' : undefined} type="button" key={report.id} onClick={() => setSelectedId(report.id)}>
                <span className="report-file-icon"><FileText size={18} /></span>
                <div><strong>{report.title}</strong><span>{report.period}</span><small>{report.items} 条引用 · {report.updatedAt}</small></div>
                {report.status === '草稿' && <Tag tone="warning">草稿</Tag>}
              </button>
            ))}
          </div>
        </section>

        <article className="report-preview">
          <header>
            <div><p className="page-eyebrow">WEEKLY DIGEST</p><h2>{selected.title}</h2><span>{selected.period} · {selected.items} 条资料</span></div>
            <div><IconButton label="打开 Markdown"><ExternalLink size={17} /></IconButton><IconButton label="下载报告"><Download size={17} /></IconButton><IconButton label="更多"><MoreHorizontal size={17} /></IconButton></div>
          </header>
          <div className="report-paper">
            <p className="report-lead">{selected.excerpt}</p>
            <hr />
            <h3>本周判断</h3>
            <p>Agent 基础设施的竞争焦点正在从“能调用多少工具”，转向任务是否可恢复、知识是否可验证，以及用户是否真正拥有产生的数据。</p>
            <blockquote>好的知识客户端不应该让模型成为唯一的入口。文件、索引和引用协议共同构成了更长寿的数据层。</blockquote>
            <h3>三个信号</h3>
            <ol>
              <li><strong>Memory Runtime：</strong>记忆的写入、遗忘和权限开始拥有独立协议。</li>
              <li><strong>Local-first：</strong>文件系统重新成为 AI 产品的数据交换层。</li>
              <li><strong>Durable Jobs：</strong>桌面端也需要租约、心跳和恢复，而不只是一个定时器。</li>
            </ol>
            <h3>下周继续关注</h3>
            <p>本地 Agent Provider 的稳定接入面，以及中文个人知识库在无远程 Embedding 条件下的召回质量。</p>
            <div className="report-citations"><span>引用资料</span><button type="button">[K:arxiv-memory-runtime]</button><button type="button">[K:files-are-api]</button><button type="button">[K:durable-desktop-jobs]</button></div>
          </div>
          <footer><span>Markdown 保存在 Vault/reports/weekly/</span><Button variant="secondary" icon={<RefreshCw size={15} />} onClick={() => notify('已创建报告重新生成任务')}>重新生成</Button></footer>
        </article>
      </div>
    </div>
  )
}

const providerLabels: Record<ProviderProbeStatus, string> = {
  available: '可用',
  not_installed: '未安装',
  broken_installation: '安装损坏',
  unauthenticated: '未登录',
  unsupported_version: '版本不支持',
}

export function AgentsPage({
  status,
  jobs,
  refreshing,
  onRefresh,
  onCreateJob,
  onCancelJob,
  onRetryJob,
  notify,
  onBack,
}: {
  status: PhaseZeroStatus | null
  jobs: Job[]
  refreshing: boolean
  onRefresh: () => void
  onCreateJob: CreateJob
  onCancelJob: JobAction
  onRetryJob: JobAction
  notify: Notify
  onBack?: () => void
}): React.JSX.Element {
  const [workflows, setWorkflows] = useState([
    { id: 'preannotate', name: '新内容预标注', description: '提取摘要、标签、重要度和置信度', provider: 'Codex', schedule: '新内容到达时', enabled: true, lastRun: '3 分钟前' },
    { id: 'weekly', name: '每周知识摘要', description: '总结本周确认、收藏和高价值内容', provider: 'Qoder', schedule: '周日 20:00', enabled: true, lastRun: '3 天前' },
    { id: 'external', name: '外部产物分析', description: '分析 Codex/Qoder 工作目录中的新文档', provider: 'Codex', schedule: '文件稳定后', enabled: true, lastRun: '1 小时前' },
  ])
  const codex = status?.providers.find((provider) => provider.provider === 'codex')
  const qoder = status?.providers.find((provider) => provider.provider === 'qoder')
  const runningJobs = jobs.filter((job) => job.status === 'running').length
  const pendingJobs = jobs.filter((job) => job.status === 'queued' || job.status === 'scheduled').length

  return (
    <div className="page page-agents">
      <PageHeader
        eyebrow="RUNTIME"
        title="Agent 与自动化"
        description="管理本机 Provider、后台工作流和每一次可追踪的 Agent 运行。"
        backLabel="返回设置"
        onBack={onBack}
        actions={<Button variant="secondary" icon={<RefreshCw size={16} className={refreshing ? 'spin' : undefined} />} onClick={onRefresh} disabled={refreshing}>重新检测</Button>}
      />
      <section className="provider-grid">
        <ProviderCard
          name="Codex"
          icon={<Code2 size={21} />}
          probe={codex}
          color="codex"
          onTest={() => void onCreateJob({ type: 'external.analyze', priority: 'interactive', payload: { provider: 'codex', purpose: 'probe-smoke' } })}
        />
        <ProviderCard
          name="Qoder"
          icon={<Bot size={21} />}
          probe={qoder}
          color="qoder"
          onTest={() => void onCreateJob({ type: 'external.analyze', priority: 'interactive', payload: { provider: 'qoder', purpose: 'probe-smoke' } })}
        />
      </section>

      <section className="runtime-strip">
        <div><span className="runtime-icon"><Gauge size={18} /></span><div><strong>任务队列</strong><span>{runningJobs} 运行中 · {pendingJobs} 等待</span></div></div>
        <div><span className="runtime-icon"><ShieldCheck size={18} /></span><div><strong>权限策略</strong><span>Staging only · dontAsk</span></div></div>
        <div><span className="runtime-icon"><Activity size={18} /></span><div><strong>后台计数</strong><span>{status?.backgroundTicks ?? '—'} · Main 保持运行</span></div></div>
        <button type="button" onClick={() => document.getElementById('job-queue')?.scrollIntoView({ behavior: 'smooth' })}>查看任务队列 <ArrowRight size={14} /></button>
      </section>

      <JobQueuePanel
        jobs={jobs}
        onCreateJob={onCreateJob}
        onCancelJob={onCancelJob}
        onRetryJob={onRetryJob}
      />

      <section className="workflow-section">
        <div className="panel-heading">
          <div><p className="panel-kicker">WORKFLOWS · MOCK</p><h2>自动化</h2></div>
          <Button variant="secondary" icon={<Plus size={15} />} onClick={() => notify('自定义 Workflow 将在后续版本开放')}>新建 Workflow</Button>
        </div>
        <div className="workflow-list">
          {workflows.map((workflow) => (
            <article key={workflow.id}>
              <span className="workflow-play">{workflow.enabled ? <Play size={16} fill="currentColor" /> : <Pause size={16} />}</span>
              <div className="workflow-copy"><strong>{workflow.name}</strong><span>{workflow.description}</span></div>
              <div className="workflow-meta"><span>Provider</span><strong>{workflow.provider}</strong></div>
              <div className="workflow-meta"><span>触发</span><strong>{workflow.schedule}</strong></div>
              <div className="workflow-meta"><span>最近运行</span><strong>{workflow.lastRun}</strong></div>
              <Toggle checked={workflow.enabled} label={`${workflow.enabled ? '暂停' : '启用'} ${workflow.name}`} onChange={(enabled) => setWorkflows((current) => current.map((item) => item.id === workflow.id ? { ...item, enabled } : item))} />
              <IconButton label="Workflow 设置"><MoreHorizontal size={17} /></IconButton>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

const jobStatusLabels: Record<JobStatus, string> = {
  scheduled: '已计划',
  queued: '等待中',
  running: '运行中',
  succeeded: '已完成',
  failed: '失败',
  interrupted: '已中断',
  cancelled: '已取消',
}

function JobQueuePanel({
  jobs,
  onCreateJob,
  onCancelJob,
  onRetryJob,
}: {
  jobs: Job[]
  onCreateJob: CreateJob
  onCancelJob: JobAction
  onRetryJob: JobAction
}): React.JSX.Element {
  return (
    <section className="workflow-section job-queue-section" id="job-queue">
      <div className="panel-heading">
        <div><p className="panel-kicker">DURABLE JOBS · LIVE</p><h2>任务队列</h2></div>
        <Button
          variant="secondary"
          icon={<Plus size={15} />}
          onClick={() => void onCreateJob({ type: 'external.scan', priority: 'normal', payload: { source: 'manual' } })}
        >
          创建测试 Job
        </Button>
      </div>
      {jobs.length === 0 ? (
        <div className="job-empty"><Activity size={22} /><strong>暂无 Job</strong><span>创建一个测试 Job 来验证持久化队列。</span></div>
      ) : (
        <div className="job-list">
          {jobs.slice(0, 20).map((job) => {
            const recovered = job.status === 'queued' && job.attempt > 0 && Boolean(job.lastError)
            const cancellable = ['scheduled', 'queued', 'interrupted'].includes(job.status)
            const retryable = ['failed', 'interrupted'].includes(job.status) && job.attempt < job.maxAttempts
            const tone = job.status === 'failed'
              ? 'danger'
              : job.status === 'succeeded'
                ? 'success'
                : job.status === 'running' || job.status === 'interrupted'
                  ? 'warning'
                  : 'neutral'
            return (
              <article className="job-row" key={job.id}>
                <span className={`job-state job-state-${job.status}`}><StatusDot status={job.status === 'failed' ? 'danger' : job.status === 'succeeded' ? 'success' : job.status === 'cancelled' ? 'muted' : 'warning'} /></span>
                <div className="job-copy">
                  <div><strong>{job.type}</strong><Tag tone={tone}>{jobStatusLabels[job.status]}</Tag>{recovered && <Tag tone="warning">interrupted 后已恢复</Tag>}</div>
                  <span>{job.id} · 第 {job.attempt}/{job.maxAttempts} 次 · {formatJobTime(job.updatedAt)}</span>
                  {job.lastError && <small>{job.lastError}</small>}
                </div>
                <div className="job-actions">
                  {retryable && <Button variant="secondary" onClick={() => void onRetryJob(job.id)}>重试</Button>}
                  {cancellable && <Button variant="ghost" onClick={() => void onCancelJob(job.id)}>取消</Button>}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function formatJobTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

function ProviderCard({
  name,
  icon,
  probe,
  color,
  onTest,
}: {
  name: string
  icon: React.ReactNode
  probe: PhaseZeroStatus['providers'][number] | undefined
  color: string
  onTest: () => void
}): React.JSX.Element {
  const available = probe?.status === 'available'
  return (
    <article className={`provider-card provider-${color}`}>
      <header><span className="provider-logo">{icon}</span><div><h2>{name}</h2><span><StatusDot status={available ? 'success' : probe ? 'warning' : 'muted'} /> {probe ? providerLabels[probe.status] : '检测中'}</span></div><IconButton label={`${name} 设置`}><Settings2 size={17} /></IconButton></header>
      <div className="provider-stats">
        <div><span>版本</span><strong>{probe?.version ?? '—'}</strong></div>
        <div><span>并发</span><strong>1 个任务</strong></div>
        <div><span>认证</span><strong>{available ? '本机登录' : '需处理'}</strong></div>
      </div>
      <p>{probe?.detail ?? '正在执行本机 capability probe…'}</p>
      <footer><code>{probe?.selectedExecutable ?? 'Waiting for executable…'}</code><button type="button" onClick={onTest}>创建测试 Job</button></footer>
    </article>
  )
}

export function SettingsPage({
  vaultConnection,
  vaultBusy,
  cloudStatus,
  cloudBusy,
  onSelectVault,
  onRebuildVaultIndex,
  onSignInWithGitHub,
  onSignOutCloud,
  onNavigate,
  providerStatus,
  notify,
}: {
  vaultConnection: VaultConnection | null
  vaultBusy: boolean
  cloudStatus: CloudStatus | null
  cloudBusy: boolean
  onSelectVault: () => Promise<void>
  onRebuildVaultIndex: () => Promise<void>
  onSignInWithGitHub: () => Promise<void>
  onSignOutCloud: () => Promise<void>
  onNavigate: Navigate
  providerStatus: PhaseZeroStatus | null
  notify: Notify
}): React.JSX.Element {
  const [launchAtLogin, setLaunchAtLogin] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [hideOnClose, setHideOnClose] = useState(true)
  const [networkTools, setNetworkTools] = useState(false)
  const vaultReady = vaultConnection?.state === 'ready'
  const vaultStateLabel = vaultConnection === null
    ? '读取中'
    : vaultConnection.state === 'ready'
      ? '已就绪'
      : vaultConnection.state === 'unconfigured'
        ? '未配置'
        : vaultConnection.state === 'missing'
          ? '目录缺失'
          : '配置无效'
  const cloudConfigured = cloudStatus?.configuration === 'ready'
  const cloudSignedIn = cloudStatus?.auth === 'signed_in'
  const cloudStateLabel = cloudStatus === null
    ? '读取中'
    : !cloudConfigured
      ? '待配置'
      : cloudSignedIn
        ? '已登录'
        : cloudStatus.auth === 'signing_in'
          ? '等待授权'
          : cloudStatus.auth === 'error'
            ? '需要处理'
            : '未登录'
  const availableProviders = providerStatus?.providers.filter((provider) => provider.status === 'available').length ?? 0
  return (
    <div className="page page-settings">
      <PageHeader eyebrow="SETTINGS" title="设置与连接" description="账户、本地 Vault、信息来源和 Agent 都从这里管理。" />
      <div className="settings-content settings-overview-content">
          <section className="settings-jump-grid" aria-label="连接设置">
            <button type="button" onClick={() => onNavigate('sources')}>
              <span className="settings-jump-icon source"><Rss size={20} /></span>
              <span><strong>信息源订阅</strong><small>管理 RSS，并查看每次同步状态</small></span>
              <ChevronRight size={17} />
            </button>
            <button type="button" onClick={() => onNavigate('agents')}>
              <span className="settings-jump-icon agent"><Bot size={20} /></span>
              <span><strong>Agent 与任务</strong><small>{availableProviders}/2 个 Provider 可用 · Codex / Qoder</small></span>
              <ChevronRight size={17} />
            </button>
          </section>
          <SettingsSection title="账户与状态同步" description="用 GitHub 登录，在多个 Alpha-K 客户端之间同步阅读与处理状态。">
            <div className="vault-path-card cloud-account-card">
              <span>{cloudSignedIn ? <GitFork size={20} /> : <Cloud size={20} />}</span>
              <div>
                <strong>
                  {cloudStatus?.user?.displayName ?? cloudStatus?.user?.email ?? 'Supabase Cloud'}
                  {' '}<Tag tone={cloudSignedIn ? 'success' : cloudStatus?.auth === 'error' ? 'warning' : undefined}>{cloudStateLabel}</Tag>
                </strong>
                <code>GitHub OAuth · Singapore · {cloudStatus?.projectRef ?? 'nuqdxhkwxlzutpdctmtb'}</code>
                <small className={cloudStatus?.lastError ? undefined : 'cloud-account-note'}>
                  {cloudStatus?.lastError ?? (cloudConfigured
                    ? '只同步知识引用、已读、收藏和处理状态；Vault 文件始终留在本机。'
                    : '请在项目根目录 .env.local 中填写 MAIN_VITE_SUPABASE_PUBLISHABLE_KEY。')}
                </small>
              </div>
              {cloudSignedIn ? (
                <Button variant="secondary" disabled={cloudBusy} icon={<LogOut size={15} />} onClick={() => void onSignOutCloud()}>
                  退出登录
                </Button>
              ) : (
                <Button disabled={cloudBusy || !cloudConfigured} icon={<GitFork size={15} />} onClick={() => void onSignInWithGitHub()}>
                  使用 GitHub 登录
                </Button>
              )}
            </div>
            <div className="setting-actions">
              <button type="button" onClick={() => notify('云端数据库由 migration 与 RLS 管理，不会上传本地文件')}><ShieldCheck size={16} />查看同步边界</button>
              <button type="button" disabled={!cloudSignedIn} onClick={() => notify('增量同步 Worker 将在后端批次接入')}><RefreshCw size={16} />同步状态：{cloudStatus?.sync ?? 'disabled'}</button>
            </div>
          </SettingsSection>
          <SettingsSection title="Knowledge Vault" description="所有正式知识资产都保存在这个普通文件目录中。">
            <div className="vault-path-card">
              <span><Folder size={20} /></span>
              <div>
                <strong>Alpha-K Vault <Tag tone={vaultReady ? 'success' : 'warning'}>{vaultStateLabel}</Tag></strong>
                <code>{vaultConnection?.vault?.path ?? '尚未选择本地 Vault 目录'}</code>
                {vaultConnection?.error && <small>{vaultConnection.error}</small>}
              </div>
              <Button variant="secondary" disabled={vaultBusy} onClick={() => void onSelectVault()}>
                {vaultReady ? '更改或恢复' : '选择并初始化'}
              </Button>
            </div>
            <div className="setting-actions">
              <button type="button" onClick={() => notify('在 Finder 中打开尚未接入（Mock）')}><FolderOpen size={16} />在 Finder 中打开（Mock）</button>
              <button type="button" disabled={!vaultReady || vaultBusy} onClick={() => void onRebuildVaultIndex()}><RefreshCw size={16} />重建索引</button>
            </div>
          </SettingsSection>
          <SettingsSection title="应用行为" description="控制 Alpha-K 在 macOS 上如何启动与退出。">
            <SettingRow title="点击红叉时隐藏窗口" description="Main 进程、同步和 Agent 任务继续运行。"><Toggle checked={hideOnClose} onChange={setHideOnClose} label="点击红叉时隐藏窗口" /></SettingRow>
            <SettingRow title="登录时启动 Alpha-K" description="开机后自动恢复错过的同步和计划任务。"><Toggle checked={launchAtLogin} onChange={setLaunchAtLogin} label="登录时启动" /></SettingRow>
            <SettingRow title="桌面通知" description="报告完成或后台任务需要关注时提醒我。"><Toggle checked={notifications} onChange={setNotifications} label="桌面通知" /></SettingRow>
          </SettingsSection>
          <SettingsSection title="Agent 默认设置" description="这些设置会成为新 Workflow 的默认值。">
            <SettingRow title="默认 Provider" description="当前推荐让应用根据 Workflow 自动选择。"><SelectButton>自动选择</SelectButton></SettingRow>
            <SettingRow title="允许网络工具" description="关闭时，Agent 只能使用应用提供的本地材料。"><Toggle checked={networkTools} onChange={setNetworkTools} label="允许网络工具" /></SettingRow>
            <SettingRow title="Staging 保留时间" description="成功任务的临时工作区会自动清理。"><SelectButton>保留 7 天</SelectButton></SettingRow>
          </SettingsSection>
          <div className="danger-zone"><div><strong>重置本地运行状态</strong><span>清理 Job、Agent 日志和缓存，不会删除 Vault 文件。</span></div><Button variant="danger" onClick={() => notify('这是 Mock，没有删除任何数据')}>清理运行数据</Button></div>
      </div>
    </div>
  )
}

function PhaseScopeNotice({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="phase-scope-notice"><ShieldCheck size={16} /><span>{children}</span></div>
}

function MockNotice({ scope }: { scope: string }): React.JSX.Element {
  return <PhaseScopeNotice><strong>Mock：</strong>{scope}在本次联调中仅保留交互预览，不会读写正式后端数据。</PhaseScopeNotice>
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }): React.JSX.Element {
  return <section className="settings-section"><header><h2>{title}</h2><p>{description}</p></header><div>{children}</div></section>
}

function SettingRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }): React.JSX.Element {
  return <div className="setting-row"><div><strong>{title}</strong><span>{description}</span></div>{children}</div>
}

function sourceGlyph(type: KnowledgeItem['sourceType']): React.JSX.Element {
  if (type === 'arxiv') return <Atom size={18} />
  if (type === 'rss') return <Rss size={17} />
  return <FileText size={17} />
}
