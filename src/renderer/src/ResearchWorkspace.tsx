import { useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  FileText,
  Link2,
  MoreHorizontal,
  Sparkles,
  Star,
  ThumbsDown,
} from 'lucide-react'

export type LearningFieldId = 'ai-systems' | 'product-design' | 'business' | 'knowledge-system'

type FieldCopy = {
  label: string
  title: string
  description: string
  ongoingTitle: string
}

const fieldCopy: Record<LearningFieldId, FieldCopy> = {
  'ai-systems': {
    label: 'AI 系统',
    title: 'Agent 记忆如何设计',
    description: '理解并验证 Agent 记忆系统的结构、分层与检索策略，形成可落地的本地方案。',
    ongoingTitle: 'Planning 能力的边界与评测',
  },
  'product-design': {
    label: '产品与交互',
    title: 'AI 产品的渐进式交互',
    description: '研究用户如何理解 Agent 的行为、边界与进度，形成一致且可控的交互语言。',
    ongoingTitle: '复杂任务中的信任反馈',
  },
  business: {
    label: '经济与商业',
    title: 'AI 基础设施的价值迁移',
    description: '跟踪模型、数据和工作流之间的价值分配，识别值得长期关注的结构性变化。',
    ongoingTitle: '推理成本与产品定价',
  },
  'knowledge-system': {
    label: '个人知识系统',
    title: 'Local-first 知识工作流',
    description: '探索采集、判断、入库和再发现之间的边界，让个人知识能够长期迁移和复用。',
    ongoingTitle: '知识库的同步边界',
  },
}

const materials = [
  {
    id: 'memgpt',
    type: '论文',
    title: 'MemGPT: Towards LLMs as Operating Systems',
    source: 'arXiv · 7 月 22 日',
    state: '已读',
    why: '分层内存与操作系统隐喻，对本地 Agent 记忆架构有直接启发。',
  },
  {
    id: 'long-term-memory',
    type: '博客',
    title: 'Building Agents with Long-Term Memory',
    source: 'LangChain Blog · 7 月 21 日',
    state: '阅读中',
    why: '从工程视角拆解长期记忆的检索、压缩与评估路径。',
  },
  {
    id: 'memory-thread',
    type: '推文',
    title: '关于 Agent 记忆边界的实践讨论',
    source: 'X · 7 月 20 日',
    state: '未读',
    why: '高密度梳理行业实践，有助于建立产品权衡与失败边界。',
  },
]

const recommendations = [
  { id: 'rec-1', type: '论文', title: 'Memory Layers for Autonomous Agents', meta: 'arXiv · AI 系统' },
  { id: 'rec-2', type: '博客', title: 'Designing Durable Agent Workflows', meta: 'Personal Blog · 产品与交互' },
  { id: 'rec-3', type: '文章', title: 'Why Local-first Still Matters', meta: 'Ink & Switch · 个人知识系统' },
]

export function ResearchWorkspace({
  field,
  onNavigateInbox,
  onNotify,
}: {
  field: LearningFieldId
  onNavigateInbox: () => void
  onNotify: (message: string) => void
}): React.JSX.Element {
  const copy = fieldCopy[field]
  const [decisions, setDecisions] = useState<Record<string, 'archive' | 'dislike'>>({})
  const visibleRecommendations = useMemo(
    () => recommendations.filter((item) => decisions[item.id] === undefined),
    [decisions],
  )

  function decide(id: string, decision: 'archive' | 'dislike'): void {
    setDecisions((current) => ({ ...current, [id]: decision }))
    onNotify(decision === 'archive'
      ? '已创建入库意图；下载与整理工作流仍为后续能力'
      : '已减少此类推荐（当前仅为界面预览）')
  }

  return (
    <div className="research-workspace">
      <main className="research-thread" aria-labelledby="research-thread-title">
        <div className="research-breadcrumb">研究线程 <span>/</span> {copy.label}</div>
        <section className="research-hero">
          <div className="research-hero-icon"><BookOpen size={27} /></div>
          <div>
            <span className="mock-label">界面数据 · Mock</span>
            <h1 id="research-thread-title">{copy.title}</h1>
            <p>{copy.description}</p>
          </div>
          <button type="button" aria-label="收藏研究线程" onClick={() => onNotify('已标记为重点研究主题（Mock）')}>
            <Star size={18} />
          </button>
          <button type="button" aria-label="更多研究线程操作">
            <MoreHorizontal size={19} />
          </button>
        </section>

        <section className="research-resume">
          <div><Clock3 size={16} /><span>上次研究：昨天 21:42</span></div>
          <i />
          <span>46 条材料 · 7 条笔记 · 5 个判断</span>
          <button type="button" onClick={() => onNotify('研究编辑器将在后续版本接入')}>
            继续研究 <ArrowRight size={15} />
          </button>
        </section>

        <section className="research-materials">
          <header>
            <div><span className="section-kicker">RECENT MATERIALS</span><h2>最近材料</h2></div>
            <button type="button" onClick={() => onNotify('已切换到当前领域的全部材料（Mock）')}>
              查看全部 <ArrowRight size={14} />
            </button>
          </header>
          <div className="material-columns" aria-hidden="true">
            <span>来源</span><span>状态</span><span>为什么重要</span><span />
          </div>
          <div className="material-list">
            {materials.map((item) => (
              <article className="material-entry" key={item.id}>
                <div className="material-source">
                  <span className={`material-type type-${item.type}`}>
                    {item.type === '论文' ? <FileText size={17} /> : <Link2 size={17} />}
                  </span>
                  <span><small>{item.type}</small><strong>{item.title}</strong><em>{item.source}</em></span>
                </div>
                <span className="material-state"><i className={item.state === '已读' ? 'is-read' : undefined} />{item.state}</span>
                <p>{item.why}</p>
                <button type="button" aria-label={`更多：${item.title}`}><MoreHorizontal size={18} /></button>
              </article>
            ))}
          </div>
        </section>
      </main>

      <aside className="learning-rail" aria-label="学习辅助信息">
        <section className="learning-rail-card continue-learning-card">
          <header><h2>继续学习</h2><span>进行中</span></header>
          <small>{copy.label}</small>
          <h3>{copy.ongoingTitle}</h3>
          <p>对比最近收集的材料，继续梳理核心判断、反例与下一步验证方法。</p>
          <div className="learning-progress" aria-label="学习进度 62%"><i style={{ width: '62%' }} /></div>
          <button type="button" onClick={() => onNotify('已恢复上一次学习位置（Mock）')}>
            继续整理 <ArrowRight size={15} />
          </button>
        </section>

        <section className="learning-rail-card recommendation-card">
          <header><h2>推荐入库</h2><span>{visibleRecommendations.length}</span></header>
          <p className="rail-description">尚未进入知识库，先由你判断。</p>
          <div className="rail-recommendations">
            {visibleRecommendations.length === 0 ? (
              <div className="recommendation-empty"><Check size={17} /><span>这一批已处理完</span></div>
            ) : visibleRecommendations.map((item) => (
              <article key={item.id}>
                <span className="recommendation-icon"><Sparkles size={15} /></span>
                <div><strong>{item.title}</strong><small>{item.type} · {item.meta}</small></div>
                <div className="recommendation-actions">
                  <button type="button" onClick={() => decide(item.id, 'archive')}>入库</button>
                  <button type="button" aria-label={`不喜欢：${item.title}`} onClick={() => decide(item.id, 'dislike')}>
                    <ThumbsDown size={13} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          <button className="rail-link" type="button" onClick={onNavigateInbox}>
            查看全部收件箱 <ArrowRight size={14} />
          </button>
        </section>
      </aside>
    </div>
  )
}
