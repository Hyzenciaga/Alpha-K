import { useEffect, useMemo, useState } from 'react'
import {
  Atom,
  CheckCircle2,
  Clock3,
  Edit3,
  Folder,
  Plus,
  RefreshCw,
  Rss,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import type { SourcePreview } from '../../shared/domain/source-ingestion.js'
import type { CreateSourceInput, ScheduleDefinition, Source, UpdateSourceInput } from '../../shared/domain/source.js'
import { Button, Modal, PageHeader, SegmentedControl, StatusDot, Tag, Toggle } from './components.js'
import type { PhaseTwoRendererClient } from './phase-two-client.js'
import {
  SourcesViewModel,
  latestSyncRunsBySource,
  type SourcesViewState,
} from './phase-two-view-models.js'

type Notify = (message: string) => void
type SourceFilter = 'all' | Source['type']
type CreateRssSourceInput = Extract<CreateSourceInput, { type: 'rss' }>

type RssFormState = {
  name: string
  feedUrl: string
  enabled: boolean
  scheduleKind: ScheduleDefinition['kind']
  intervalMinutes: string
  localTime: string
  weekday: string
  includeKeywords: string
  excludeKeywords: string
  historyWindowDays: string
  maxItemsPerSync: string
  defaultLabels: string
}

const EMPTY_SOURCES_STATE: SourcesViewState = {
  status: 'idle',
  sources: [],
  syncRuns: [],
  error: null,
  actionError: null,
  lastSyncRequest: null,
}

export function SourcesPage({
  client,
  vaultId,
  notify,
  onBack,
}: {
  client: PhaseTwoRendererClient
  vaultId: string | null
  notify: Notify
  onBack?: () => void
}): React.JSX.Element {
  const model = useMemo(() => (vaultId ? new SourcesViewModel(client, vaultId) : null), [client, vaultId])
  const [view, setView] = useState<SourcesViewState>(EMPTY_SOURCES_STATE)
  const [kind, setKind] = useState<SourceFilter>('all')
  const [editor, setEditor] = useState<{ source: Extract<Source, { type: 'rss' }> | null; form: RssFormState } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Source | null>(null)
  const [preview, setPreview] = useState<SourcePreview | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  useEffect(() => {
    if (!model) {
      setView(EMPTY_SOURCES_STATE)
      return undefined
    }
    setView(model.state)
    const unsubscribe = model.subscribe(() => setView(model.state))
    void model.refresh()
    return unsubscribe
  }, [model])

  const filtered = kind === 'all' ? view.sources : view.sources.filter((source) => source.type === kind)
  const latestRuns = useMemo(() => latestSyncRunsBySource(view.syncRuns), [view.syncRuns])
  const healthyCount = view.sources.filter((source) => source.enabled && source.lastError === null).length
  const failedRunCount = view.syncRuns.filter((run) => run.status === 'failed').length
  const nextSync = view.sources
    .map((source) => source.nextSyncAt)
    .filter((value): value is string => value !== null)
    .sort()[0]

  function openCreate(): void {
    setPreview(null)
    setEditorError(null)
    setEditor({ source: null, form: emptyRssForm() })
  }

  function openEdit(source: Extract<Source, { type: 'rss' }>): void {
    setPreview(null)
    setEditorError(null)
    setEditor({ source, form: rssFormFromSource(source) })
  }

  function updateForm(patch: Partial<RssFormState>): void {
    setEditor((current) => (current ? { ...current, form: { ...current.form, ...patch } } : current))
    setPreview(null)
    setEditorError(null)
  }

  async function previewSource(): Promise<void> {
    if (!model || !vaultId || !editor) return
    setBusyAction('preview')
    setEditorError(null)
    try {
      const input = rssInputFromForm(editor.form, vaultId)
      setPreview(await model.preview(input))
    } catch (error) {
      setEditorError(errorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function saveSource(): Promise<void> {
    if (!model || !vaultId || !editor) return
    if (!preview) {
      setEditorError('请先完成只读预览；任何字段变化后都需要重新预览。')
      return
    }
    setBusyAction('save')
    setEditorError(null)
    try {
      const input = rssInputFromForm(editor.form, vaultId)
      if (editor.source) {
        const update = {
          type: input.type,
          name: input.name,
          enabled: input.enabled,
          schedule: input.schedule,
          defaultLabels: input.defaultLabels,
          workflowId: input.workflowId,
          config: input.config,
        } satisfies UpdateSourceInput
        await model.update(editor.source.id, update)
        notify(`已更新「${input.name}」`)
      } else {
        await model.create(input)
        notify(`已创建「${input.name}」`)
      }
      setEditor(null)
      setPreview(null)
    } catch (error) {
      setEditorError(errorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function toggleSource(source: Source, enabled: boolean): Promise<void> {
    if (!model) return
    setBusyAction(`toggle:${source.id}`)
    try {
      await model.update(source.id, { type: source.type, enabled })
      notify(enabled ? `已启用「${source.name}」` : `已停用「${source.name}」`)
    } catch {
      // The view model exposes the IPC error in the persistent page error banner.
    } finally {
      setBusyAction(null)
    }
  }

  async function syncSource(source: Source): Promise<void> {
    if (!model) return
    setBusyAction(`sync:${source.id}`)
    try {
      const result = await model.sync(source.id)
      notify(`已创建 Job ${shortId(result.job.id)}，SyncRun 状态：${syncStatusLabel(result.syncRun.status)}`)
    } catch {
      // The view model exposes the IPC error in the persistent page error banner.
    } finally {
      setBusyAction(null)
    }
  }

  async function deleteSource(): Promise<void> {
    if (!model || !deleteTarget) return
    setBusyAction(`delete:${deleteTarget.id}`)
    try {
      await model.delete(deleteTarget.id)
      notify(`已删除「${deleteTarget.name}」`)
      setDeleteTarget(null)
    } catch {
      // Keep the confirmation open so the backend conflict remains visible.
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="page page-sources">
      <PageHeader
        eyebrow="INGESTION · PHASE 2"
        title="订阅源"
        description="管理持久化来源、只读预览和手动同步；当前执行批次仅接通 RSS。"
        backLabel="返回设置"
        onBack={onBack}
        actions={<Button icon={<Plus size={16} />} disabled={!vaultId} onClick={openCreate}>新建 RSS 来源</Button>}
      />

      {!vaultId ? (
        <PageState icon={<Folder size={28} />} title="请先配置 Vault" description="Phase 2 的来源和同步记录都属于一个已就绪的本地 Vault。" />
      ) : (
        <>
          <section className="source-overview" aria-label="来源概览">
            <div><span className="overview-icon"><Rss size={19} /></span><div><strong>{view.sources.length}</strong><span>持久化来源</span></div></div>
            <div><span className="overview-icon"><CheckCircle2 size={19} /></span><div><strong>{healthyCount}</strong><span>已启用且无错误</span></div></div>
            <div><span className="overview-icon"><TriangleAlert size={19} /></span><div><strong>{failedRunCount}</strong><span>失败 SyncRun</span></div></div>
            <div><span className="overview-icon"><Clock3 size={19} /></span><div><strong>{nextSync ? formatCompactDate(nextSync) : '—'}</strong><span>最近计划时间</span></div></div>
          </section>

          {view.actionError && (
            <div className="phase-two-error" role="alert"><TriangleAlert size={17} /><span><strong>操作失败</strong>{view.actionError}</span><button type="button" onClick={() => model?.clearActionError()}>关闭</button></div>
          )}

          {view.lastSyncRequest && (
            <div className="sync-request-result" role="status">
              <RefreshCw size={16} />
              <span>手动同步已提交：Job <code>{shortId(view.lastSyncRequest.job.id)}</code> · SyncRun <code>{shortId(view.lastSyncRequest.syncRun.id)}</code> · {syncStatusLabel(view.lastSyncRequest.syncRun.status)}</span>
            </div>
          )}

          <div className="toolbar">
            <SegmentedControl
              label="来源类型"
              value={kind}
              onChange={setKind}
              options={[
                { value: 'all', label: '全部' },
                { value: 'rss', label: 'RSS' },
                { value: 'arxiv', label: 'arXiv · 后续批次' },
                { value: 'directory', label: '目录 · 后续批次' },
              ]}
            />
            <Button variant="secondary" icon={<RefreshCw size={16} />} disabled={view.status === 'loading'} onClick={() => void model?.refresh()}>刷新</Button>
          </div>

          {view.status === 'idle' || view.status === 'loading' ? (
            <PageState loading title="正在读取来源" description="同时获取持久化 Source 和最近的 SyncRun。" />
          ) : view.status === 'error' ? (
            <PageState icon={<TriangleAlert size={28} />} title="来源读取失败" description={view.error ?? '无法连接 Phase 2 IPC。'} action={<Button variant="secondary" onClick={() => void model?.refresh()}>重试</Button>} />
          ) : view.status === 'empty' ? (
            <PageState icon={<Rss size={28} />} title="还没有来源" description="创建第一个 RSS 来源，可以先预览 Feed 内容，再决定是否保存。" action={<Button icon={<Plus size={16} />} onClick={openCreate}>创建 RSS 来源</Button>} />
          ) : filtered.length === 0 ? (
            <PageState icon={kind === 'arxiv' ? <Atom size={28} /> : <Folder size={28} />} title="此类型暂无来源" description={kind === 'rss' ? '切换到全部来源，或创建一个 RSS 来源。' : '该连接器保留了共享契约，但执行能力属于后续批次。'} />
          ) : (
            <section className="source-table-wrap phase-two-source-table-wrap">
              <table className="source-table phase-two-source-table">
                <thead><tr><th>来源与配置</th><th>健康状态</th><th>最近 SyncRun</th><th>操作</th></tr></thead>
                <tbody>
                  {filtered.map((source) => {
                    const run = latestRuns.get(source.id)
                    const laterBatch = source.type !== 'rss'
                    return (
                      <tr key={source.id}>
                        <td>
                          <div className={`source-type-icon type-${source.type}`}>{sourceIcon(source.type)}</div>
                          <div className="source-cell-copy">
                            <strong>{source.name}</strong>
                            <span>{sourceDescription(source)}</span>
                            <div className="tag-row">
                              <Tag>{source.type.toUpperCase()}</Tag>
                              {laterBatch && <Tag tone="warning">后续批次</Tag>}
                              {source.defaultLabels.map((label) => <Tag key={label}>{label}</Tag>)}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="health-label"><StatusDot status={!source.enabled ? 'muted' : source.lastError ? 'danger' : 'success'} />{!source.enabled ? '已停用' : source.lastError ? '需关注' : '正常'}</span>
                          <span>上次：{formatDate(source.lastSyncAt)}</span>
                          <span>下次：{formatDate(source.nextSyncAt)}</span>
                          {source.lastError && <span className="source-error-text">{source.lastError}</span>}
                        </td>
                        <td>
                          {run ? (
                            <div className="sync-run-cell">
                              <strong><StatusDot status={syncTone(run.status)} />{syncStatusLabel(run.status)}</strong>
                              <span>发现 {run.discoveredCount} · 新增 {run.createdCount} · 更新 {run.updatedCount} · 跳过 {run.skippedCount}</span>
                              <span>{formatDate(run.finishedAt ?? run.startedAt ?? run.createdAt)}</span>
                              {run.error && <span className="source-error-text">{run.error}</span>}
                            </div>
                          ) : <span>暂无同步记录</span>}
                        </td>
                        <td>
                          <div className="source-row-actions">
                            <Toggle checked={source.enabled} onChange={(enabled) => void toggleSource(source, enabled)} label={`${source.enabled ? '停用' : '启用'} ${source.name}`} />
                            <button type="button" disabled={laterBatch || busyAction !== null} onClick={() => void syncSource(source)} aria-label={`立即同步 ${source.name}`} title={laterBatch ? '后续批次' : '立即同步'}><RefreshCw size={15} /></button>
                            <button type="button" disabled={laterBatch || busyAction !== null} onClick={() => source.type === 'rss' && openEdit(source)} aria-label={`编辑 ${source.name}`} title={laterBatch ? '后续批次' : '编辑'}><Edit3 size={15} /></button>
                            <button type="button" disabled={busyAction !== null} onClick={() => setDeleteTarget(source)} aria-label={`删除 ${source.name}`} title="删除"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {editor && (
        <Modal
          title={editor.source ? '编辑 RSS 来源' : '新建 RSS 来源'}
          description="预览只读取 Feed，不会保存 Source、创建 Job 或写入收件箱。"
          onClose={() => busyAction === null && setEditor(null)}
          footer={
            <>
              <Button variant="ghost" disabled={busyAction !== null} onClick={() => setEditor(null)}>取消</Button>
              <Button variant="secondary" disabled={busyAction !== null} onClick={() => void previewSource()}>{busyAction === 'preview' ? '预览中…' : '只读预览'}</Button>
              <Button disabled={busyAction !== null || preview === null} onClick={() => void saveSource()}>{busyAction === 'save' ? '保存中…' : preview === null ? '先预览，再保存' : editor.source ? '保存修改' : '创建来源'}</Button>
            </>
          }
        >
          <RssSourceForm form={editor.form} onChange={updateForm} />
          {editorError && <p className="form-error" role="alert">{editorError}</p>}
          {preview && <SourcePreviewPanel preview={preview} />}
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="确认删除来源"
          description="只允许删除尚未拥有 KnowledgeItem 或保留 SyncRun 的来源；否则后端会拒绝并建议停用。"
          onClose={() => busyAction === null && setDeleteTarget(null)}
          footer={
            <>
              <Button variant="ghost" disabled={busyAction !== null} onClick={() => setDeleteTarget(null)}>取消</Button>
              <Button variant="danger" disabled={busyAction !== null} onClick={() => void deleteSource()}>{busyAction?.startsWith('delete:') ? '删除中…' : `删除「${deleteTarget.name}」`}</Button>
            </>
          }
        >
          <div className="delete-confirmation"><TriangleAlert size={21} /><p>此操作会永久删除 Source 配置。若你只想停止未来调度，请改为停用。</p></div>
          {view.actionError && <p className="form-error" role="alert">{view.actionError}</p>}
        </Modal>
      )}
    </div>
  )
}

function RssSourceForm({ form, onChange }: { form: RssFormState; onChange: (patch: Partial<RssFormState>) => void }): React.JSX.Element {
  return (
    <div className="source-form">
      <label className="field-label"><span>名称</span><input value={form.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="例如：Example Engineering" autoFocus /></label>
      <label className="field-label"><span>Feed URL</span><input type="url" value={form.feedUrl} onChange={(event) => onChange({ feedUrl: event.target.value })} placeholder="https://example.com/feed.xml" /></label>
      <label className="check-row source-enabled-field"><input type="checkbox" checked={form.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} /><span className="custom-check" />创建后启用</label>
      <div className="form-grid three-columns">
        <label className="field-label"><span>计划类型</span><select value={form.scheduleKind} onChange={(event) => onChange({ scheduleKind: event.target.value as ScheduleDefinition['kind'] })}><option value="interval">间隔</option><option value="daily">每天</option><option value="weekly">每周</option></select></label>
        {form.scheduleKind === 'interval' ? (
          <label className="field-label"><span>间隔分钟（5–10080）</span><input type="number" min="5" max="10080" value={form.intervalMinutes} onChange={(event) => onChange({ intervalMinutes: event.target.value })} /></label>
        ) : (
          <label className="field-label"><span>本地时间</span><input type="time" value={form.localTime} onChange={(event) => onChange({ localTime: event.target.value })} /></label>
        )}
        {form.scheduleKind === 'weekly' && <label className="field-label"><span>星期</span><select value={form.weekday} onChange={(event) => onChange({ weekday: event.target.value })}>{['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((label, index) => <option key={label} value={index}>{label}</option>)}</select></label>}
      </div>
      <div className="form-grid">
        <label className="field-label"><span>包含关键词（逗号分隔）</span><input value={form.includeKeywords} onChange={(event) => onChange({ includeKeywords: event.target.value })} /></label>
        <label className="field-label"><span>排除关键词（逗号分隔）</span><input value={form.excludeKeywords} onChange={(event) => onChange({ excludeKeywords: event.target.value })} /></label>
        <label className="field-label"><span>历史窗口（天）</span><input type="number" min="1" max="3650" value={form.historyWindowDays} onChange={(event) => onChange({ historyWindowDays: event.target.value })} /></label>
        <label className="field-label"><span>每次最多条目</span><input type="number" min="1" max="500" value={form.maxItemsPerSync} onChange={(event) => onChange({ maxItemsPerSync: event.target.value })} /></label>
      </div>
      <label className="field-label"><span>默认标签（逗号分隔）</span><input value={form.defaultLabels} onChange={(event) => onChange({ defaultLabels: event.target.value })} /></label>
    </div>
  )
}

function SourcePreviewPanel({ preview }: { preview: SourcePreview }): React.JSX.Element {
  return (
    <section className="source-preview" aria-label="来源预览">
      <header><div><strong>只读预览 · 尚未保存</strong><span>{preview.title ?? '未提供 Feed 标题'} · {preview.items.length} 条</span></div><Tag tone="warning">无持久化</Tag></header>
      {preview.description && <p>{preview.description}</p>}
      {preview.warnings.map((warning) => <p className="preview-warning" key={warning}>{warning}</p>)}
      <ol>{preview.items.slice(0, 5).map((item) => <li key={item.externalId ?? item.canonicalUrl ?? item.contentHash ?? item.title}><strong>{item.title}</strong><span>{item.authors.join('、') || '未知作者'} · {formatDate(item.publishedAt)}</span>{item.excerpt && <p>{item.excerpt}</p>}</li>)}</ol>
    </section>
  )
}

function PageState({ loading = false, icon, title, description, action }: { loading?: boolean; icon?: React.ReactNode; title: string; description: string; action?: React.ReactNode }): React.JSX.Element {
  return <div className="empty-state phase-two-page-state">{loading ? <RefreshCw size={28} className="spin" /> : icon}<h3>{title}</h3><p>{description}</p>{action}</div>
}

function emptyRssForm(): RssFormState {
  return { name: '', feedUrl: '', enabled: true, scheduleKind: 'interval', intervalMinutes: '60', localTime: '08:00', weekday: '1', includeKeywords: '', excludeKeywords: '', historyWindowDays: '30', maxItemsPerSync: '100', defaultLabels: '' }
}

function rssFormFromSource(source: Extract<Source, { type: 'rss' }>): RssFormState {
  return {
    name: source.name,
    feedUrl: source.config.feedUrl,
    enabled: source.enabled,
    scheduleKind: source.schedule.kind,
    intervalMinutes: String(source.schedule.kind === 'interval' ? source.schedule.minutes : 60),
    localTime: source.schedule.kind === 'daily' || source.schedule.kind === 'weekly' ? source.schedule.localTime : '08:00',
    weekday: String(source.schedule.kind === 'weekly' ? source.schedule.weekday : 1),
    includeKeywords: source.config.includeKeywords.join(', '),
    excludeKeywords: source.config.excludeKeywords.join(', '),
    historyWindowDays: String(source.config.historyWindowDays),
    maxItemsPerSync: String(source.config.maxItemsPerSync),
    defaultLabels: source.defaultLabels.join(', '),
  }
}

function rssInputFromForm(form: RssFormState, vaultId: string): CreateRssSourceInput {
  const name = form.name.trim()
  if (!name) throw new Error('来源名称不能为空。')
  try {
    new URL(form.feedUrl)
  } catch {
    throw new Error('请输入有效的 Feed URL。')
  }
  const historyWindowDays = boundedInteger(form.historyWindowDays, 1, 3650, '历史窗口')
  const maxItemsPerSync = boundedInteger(form.maxItemsPerSync, 1, 500, '每次最多条目')
  let schedule: ScheduleDefinition
  if (form.scheduleKind === 'interval') {
    schedule = { kind: 'interval', minutes: boundedInteger(form.intervalMinutes, 5, 10_080, '同步间隔') }
  } else if (form.scheduleKind === 'daily') {
    schedule = { kind: 'daily', localTime: form.localTime }
  } else {
    schedule = { kind: 'weekly', weekday: boundedInteger(form.weekday, 0, 6, '星期'), localTime: form.localTime }
  }
  return {
    vaultId,
    type: 'rss',
    name,
    enabled: form.enabled,
    schedule,
    defaultLabels: splitList(form.defaultLabels),
    workflowId: null,
    config: {
      feedUrl: form.feedUrl.trim(),
      includeKeywords: splitList(form.includeKeywords),
      excludeKeywords: splitList(form.excludeKeywords),
      historyWindowDays,
      maxItemsPerSync,
    },
  }
}

function splitList(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
}

function boundedInteger(value: string, min: number, max: number, label: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${label}必须是 ${min}–${max} 之间的整数。`)
  return parsed
}

function sourceDescription(source: Source): string {
  if (source.type === 'rss') return source.config.feedUrl
  if (source.type === 'arxiv') return source.config.query
  return source.config.path
}

function sourceIcon(type: Source['type']): React.JSX.Element {
  if (type === 'rss') return <Rss size={17} />
  if (type === 'arxiv') return <Atom size={18} />
  return <Folder size={18} />
}

function syncTone(status: string): 'success' | 'warning' | 'danger' | 'muted' {
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'cancelled') return 'muted'
  return 'warning'
}

function syncStatusLabel(status: string): string {
  return ({ queued: '等待中', running: '运行中', succeeded: '成功', failed: '失败', interrupted: '已中断', cancelled: '已取消' } as Record<string, string>)[status] ?? status
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function formatCompactDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function shortId(id: string): string {
  return id.slice(0, 8)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
