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

export type SourceItem = {
  id: string
  name: string
  kind: 'RSS' | 'arXiv' | '目录'
  description: string
  schedule: string
  lastSync: string
  nextSync: string
  newItems: number
  enabled: boolean
  health: 'healthy' | 'warning'
  labels: string[]
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

export const inboxItems: KnowledgeItem[] = [
  {
    id: 'arxiv-2607-18421',
    title: 'Agent Memory as a First-Class Runtime Primitive',
    source: 'arXiv · cs.AI',
    sourceType: 'arxiv',
    author: 'Mina Park, Leon Zhou 等',
    time: '18 分钟前',
    summary:
      '提出一种将短期轨迹、长期语义记忆和用户偏好统一为运行时原语的方法，并给出跨任务遗忘与检索评估基准。',
    labels: ['Agent Memory', 'Runtime', '值得精读'],
    importance: 5,
    confidence: 0.94,
    state: '高价值',
    readingMinutes: 14,
    selected: true,
  },
  {
    id: 'rss-latent-space-0719',
    title: 'Why Local-First AI Products Need a File Contract',
    source: 'Latent Space',
    sourceType: 'rss',
    author: 'Swyx',
    time: '42 分钟前',
    summary:
      '从可迁移性、可观察性和失败恢复三个角度讨论本地 AI 产品为什么应把文件协议放在数据库与模型之前。',
    labels: ['Local-first', 'Architecture'],
    importance: 4,
    confidence: 0.89,
    state: '待确认',
    readingMinutes: 8,
  },
  {
    id: 'external-codex-notes',
    title: 'Codex CLI capability probe notes',
    source: '外部目录 · Codex',
    sourceType: 'external',
    author: '本机 Agent 产物',
    time: '1 小时前',
    summary: '记录非交互运行、JSONL 事件、Schema 输出和 app bundle fallback 的验证结论。',
    labels: ['Alpha-K', 'ADR'],
    importance: 4,
    confidence: 0.98,
    state: '待确认',
    readingMinutes: 4,
  },
  {
    id: 'rss-simon-willison-0718',
    title: 'Designing citations for generated knowledge',
    source: 'Simon Willison’s Weblog',
    sourceType: 'rss',
    author: 'Simon Willison',
    time: '今天 09:18',
    summary: '梳理生成式知识产品中引用的稳定标识、检索快照和可验证呈现方式。',
    labels: ['Citations', 'RAG'],
    importance: 4,
    confidence: 0.86,
    state: '待确认',
    readingMinutes: 6,
  },
  {
    id: 'arxiv-2607-17003',
    title: 'Reliable Scheduling for Offline-Capable Desktop Agents',
    source: 'arXiv · cs.DC',
    sourceType: 'arxiv',
    author: 'Ana Ribeiro 等',
    time: '今天 08:31',
    summary: '研究桌面休眠、网络间歇和单进程崩溃条件下的任务租约与 missed schedule 补偿。',
    labels: ['Scheduler', 'Reliability'],
    importance: 3,
    confidence: 0.82,
    state: '待确认',
    readingMinutes: 12,
  },
  {
    id: 'rss-pragmatic-engineer-0717',
    title: 'SQLite beyond a cache: pragmatic desktop persistence',
    source: 'The Pragmatic Engineer',
    sourceType: 'rss',
    author: 'Gergely Orosz',
    time: '昨天 22:14',
    summary: '以桌面工具为例分析 SQLite 在索引、任务状态和离线恢复中的工程边界。',
    labels: ['SQLite', 'Desktop'],
    importance: 3,
    confidence: 0.84,
    state: '稍后阅读',
    readingMinutes: 10,
  },
]

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

export const sourceItems: SourceItem[] = [
  {
    id: 'source-01',
    name: 'Agent Memory / arXiv',
    kind: 'arXiv',
    description: 'cat:cs.AI AND (memory OR context engineering)',
    schedule: '每 6 小时',
    lastSync: '18 分钟前',
    nextSync: '5 小时后',
    newItems: 3,
    enabled: true,
    health: 'healthy',
    labels: ['Research', 'Agent Memory'],
  },
  {
    id: 'source-02',
    name: 'Latent Space',
    kind: 'RSS',
    description: 'AI engineering、agents 与开发者工具',
    schedule: '每 2 小时',
    lastSync: '42 分钟前',
    nextSync: '1 小时后',
    newItems: 1,
    enabled: true,
    health: 'healthy',
    labels: ['AI Engineering'],
  },
  {
    id: 'source-03',
    name: 'Simon Willison’s Weblog',
    kind: 'RSS',
    description: 'LLM tools、数据与开放生态',
    schedule: '每 4 小时',
    lastSync: '今天 09:18',
    nextSync: '37 分钟后',
    newItems: 1,
    enabled: true,
    health: 'healthy',
    labels: ['LLM', 'Tools'],
  },
  {
    id: 'source-04',
    name: 'Codex 输出目录',
    kind: '目录',
    description: '~/CodeLib/Codex/Explore · reference 模式',
    schedule: '实时 + 每 30 分钟校准',
    lastSync: '1 小时前',
    nextSync: '12 分钟后',
    newItems: 1,
    enabled: true,
    health: 'warning',
    labels: ['Local Artifact'],
  },
  {
    id: 'source-05',
    name: 'The Pragmatic Engineer',
    kind: 'RSS',
    description: '工程管理与软件架构',
    schedule: '每天 08:00',
    lastSync: '昨天 22:14',
    nextSync: '明天 08:00',
    newItems: 0,
    enabled: false,
    health: 'healthy',
    labels: ['Engineering'],
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
