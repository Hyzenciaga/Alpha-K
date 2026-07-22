export type PageId =
  | 'today'
  | 'inbox'
  | 'library'
  | 'sources'
  | 'query'
  | 'reports'
  | 'agents'
  | 'settings'

export type KnowledgeItem = {
  id: string
  title: string
  source: string
  sourceType: 'arxiv' | 'rss' | 'external'
  author: string
  time: string
  summary: string
  labels: string[]
  importance: 1 | 2 | 3 | 4 | 5
  confidence: number
  state: '待确认' | '已收录' | '高价值' | '稍后阅读'
  readingMinutes: number
  selected?: boolean
}

export type ReportItem = {
  id: string
  title: string
  period: string
  status: '已生成' | '草稿'
  items: number
  updatedAt: string
  excerpt: string
}

export const libraryItems: KnowledgeItem[] = [
  {
    id: 'lib-01',
    title: 'Files Are the API: Local-first systems that outlive their apps',
    source: 'Ink & Switch',
    sourceType: 'rss',
    author: 'Maggie Appleton',
    time: '7 月 20 日',
    summary: '普通文件作为长期数据协议时，在应用替换、版本控制与用户所有权方面的优势。',
    labels: ['Local-first', 'File Contract'],
    importance: 5,
    confidence: 1,
    state: '已收录',
    readingMinutes: 11,
  },
  {
    id: 'lib-02',
    title: 'Retrieval snapshots for reproducible AI answers',
    source: 'Research Notes',
    sourceType: 'external',
    author: 'Steve',
    time: '7 月 19 日',
    summary: '定义不可变检索快照，以及它如何支持引用验证、重生成和 Provider 对比。',
    labels: ['RAG', 'Citations', 'Alpha-K'],
    importance: 5,
    confidence: 1,
    state: '已收录',
    readingMinutes: 5,
  },
  {
    id: 'lib-03',
    title: 'Durable execution patterns inside desktop applications',
    source: 'Temporal Blog',
    sourceType: 'rss',
    author: 'Nina Chen',
    time: '7 月 18 日',
    summary: '从幂等键、租约、心跳和补偿角度解释桌面端持久化任务的实现策略。',
    labels: ['Job Queue', 'Reliability'],
    importance: 4,
    confidence: 1,
    state: '已收录',
    readingMinutes: 9,
  },
  {
    id: 'lib-04',
    title: 'Human review as a product boundary for agentic systems',
    source: 'arXiv · HCI',
    sourceType: 'arxiv',
    author: 'Claire Lee 等',
    time: '7 月 17 日',
    summary: '研究建议值、确认值和系统字段分离对用户信任、纠错成本和长期数据质量的影响。',
    labels: ['Human-in-loop', 'Review'],
    importance: 4,
    confidence: 1,
    state: '已收录',
    readingMinutes: 13,
  },
  {
    id: 'lib-05',
    title: 'Building calm software for information-heavy work',
    source: 'Dense Discovery',
    sourceType: 'rss',
    author: 'Kai Brach',
    time: '7 月 16 日',
    summary: '关于信息密集工具如何通过节奏、渐进披露和有限提醒降低注意力负担。',
    labels: ['Product Design', 'Calm Tech'],
    importance: 3,
    confidence: 1,
    state: '已收录',
    readingMinutes: 7,
  },
  {
    id: 'lib-06',
    title: 'FTS5 tokenizers for multilingual personal archives',
    source: 'SQLite Forum',
    sourceType: 'rss',
    author: 'Community Notes',
    time: '7 月 15 日',
    summary: '比较 unicode61、trigram 和自定义 tokenizer 在中英文混合资料检索上的行为。',
    labels: ['SQLite', 'Search'],
    importance: 4,
    confidence: 1,
    state: '已收录',
    readingMinutes: 8,
  },
]

export const reports: ReportItem[] = [
  {
    id: 'report-30',
    title: '2026 W30 · 本地 Agent 与知识工作流',
    period: '7 月 20 日—7 月 26 日',
    status: '草稿',
    items: 18,
    updatedAt: '今天 10:42',
    excerpt: '本周的共同趋势，是 Agent 产品开始把可恢复性和用户数据所有权放到模型能力之前。',
  },
  {
    id: 'report-29',
    title: '2026 W29 · Memory、Context 与 Runtime',
    period: '7 月 13 日—7 月 19 日',
    status: '已生成',
    items: 31,
    updatedAt: '7 月 19 日 20:06',
    excerpt: 'Memory 正从应用层技巧走向运行时抽象，检索快照与显式遗忘成为两个关键方向。',
  },
  {
    id: 'report-28',
    title: '2026 W28 · 可验证的生成式知识',
    period: '7 月 6 日—7 月 12 日',
    status: '已生成',
    items: 24,
    updatedAt: '7 月 12 日 20:02',
    excerpt: '引用协议不能只是模型输出格式，它需要与应用拥有的检索范围和稳定标识绑定。',
  },
]

export const activity = [
  { time: '10:42', text: 'Codex 完成 3 条预标注', tone: 'success' },
  { time: '10:38', text: 'arXiv 同步新增 3 条内容', tone: 'neutral' },
  { time: '09:57', text: '外部目录发现 1 份新文档', tone: 'neutral' },
  { time: '09:18', text: 'Simon Willison RSS 同步完成', tone: 'neutral' },
  { time: '08:31', text: '一项后台任务等待重试', tone: 'warning' },
] as const

export const weeklyBars = [9, 14, 8, 21, 17, 26, 18]
