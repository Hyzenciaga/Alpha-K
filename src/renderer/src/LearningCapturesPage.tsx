import { useEffect, useState } from 'react'
import { Archive, BookMarked, Link2, LockKeyhole, RefreshCw, StickyNote } from 'lucide-react'
import type { CaptureKind, LearningCapture } from '../../shared/domain/capture.js'
import type { CloudStatus } from '../../shared/domain/cloud-sync.js'

type ViewState =
  | { phase: 'loading'; items: LearningCapture[]; error: null }
  | { phase: 'ready'; items: LearningCapture[]; error: null }
  | { phase: 'error'; items: LearningCapture[]; error: string }

const EMPTY_STATE: ViewState = { phase: 'loading', items: [], error: null }

export function LearningCapturesPage({
  cloudStatus,
  signInBusy,
  onSignIn,
  onNotify,
}: {
  cloudStatus: CloudStatus | null
  signInBusy: boolean
  onSignIn: () => void
  onNotify: (message: string) => void
}): React.JSX.Element {
  const [kind, setKind] = useState<CaptureKind>('link')
  const [view, setView] = useState<ViewState>(EMPTY_STATE)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const signedIn = cloudStatus?.auth === 'signed_in' && Boolean(cloudStatus.user)

  useEffect(() => {
    if (!signedIn) {
      setView({ phase: 'ready', items: [], error: null })
      return undefined
    }

    let mounted = true
    const refresh = async (): Promise<void> => {
      if (!mounted) return
      setView((current) => ({ phase: 'loading', items: current.items, error: null }))
      try {
        const result = await window.alphaK.listLearningCaptures({ kind })
        if (!mounted) return
        if (!result.ok) {
          setView((current) => ({ phase: 'error', items: current.items, error: result.error.message }))
          return
        }
        setView({ phase: 'ready', items: result.data, error: null })
      } catch (error) {
        if (mounted) {
          setView((current) => ({
            phase: 'error',
            items: current.items,
            error: error instanceof Error ? error.message : String(error),
          }))
        }
      }
    }

    void refresh()
    const unsubscribe = window.alphaK.onAppEvent((event) => {
      if (event.type === 'capture.changed' && event.kind === kind) void refresh()
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [kind, signedIn])

  async function archive(captureId: string): Promise<void> {
    setArchivingId(captureId)
    try {
      const result = await window.alphaK.archiveLearningCapture(captureId)
      if (!result.ok) {
        onNotify(`归档失败：${result.error.message}`)
        return
      }
      setView((current) => ({
        phase: 'ready',
        items: current.items.filter((item) => item.id !== captureId),
        error: null,
      }))
      onNotify('已从待学习中归档')
    } catch (error) {
      onNotify(`归档失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setArchivingId(null)
    }
  }

  return (
    <section className="learning-captures-page" aria-labelledby="learning-captures-title">
      <header className="learning-captures-header">
        <div>
          <span className="page-eyebrow"><BookMarked size={14} /> 收下，留待理解</span>
          <h1 id="learning-captures-title">待学习</h1>
          <p>这里保存你主动收下的链接与想法。后续 Agent 会从这里读取并整理。</p>
        </div>
      </header>

      {!signedIn ? (
        <section className="capture-auth-gate">
          <span><LockKeyhole size={19} /></span>
          <div>
            <strong>登录后开始收下</strong>
            <p>待学习内容会保存在你的私有云端账户中。</p>
          </div>
          <button type="button" onClick={onSignIn} disabled={signInBusy}>
            {signInBusy ? '正在打开登录…' : '使用 GitHub 登录'}
          </button>
        </section>
      ) : (
        <>
          <div className="capture-tabs" role="tablist" aria-label="待学习类型">
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'link'}
              className={kind === 'link' ? 'is-active' : undefined}
              onClick={() => setKind('link')}
            >
              <Link2 size={15} /> 链接
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'note'}
              className={kind === 'note' ? 'is-active' : undefined}
              onClick={() => setKind('note')}
            >
              <StickyNote size={15} /> 想法
            </button>
          </div>

          {view.phase === 'loading' && view.items.length === 0 ? (
            <div className="capture-page-state"><RefreshCw size={17} className="is-spinning" /> 正在读取待学习内容…</div>
          ) : view.phase === 'error' ? (
            <div className="capture-page-state is-error">读取失败：{view.error}</div>
          ) : view.items.length === 0 ? (
            <div className="capture-empty-state">
              {kind === 'link' ? <Link2 size={22} /> : <StickyNote size={22} />}
              <strong>{kind === 'link' ? '还没有待学习的链接' : '还没有收下的想法'}</strong>
              <span>随时从左上角「录入」收下，之后再慢慢整理。</span>
            </div>
          ) : (
            <div className="capture-list" role="tabpanel">
              {view.items.map((item) => (
                <article className="capture-item" key={item.id}>
                  <div className={`capture-item-icon ${item.kind}`}>
                    {item.kind === 'link' ? <Link2 size={17} /> : <StickyNote size={17} />}
                  </div>
                  <div className="capture-item-body">
                    <strong>{item.title ?? fallbackTitle(item)}</strong>
                    {item.kind === 'link' ? (
                      <a href={item.normalizedUrl ?? item.content} target="_blank" rel="noreferrer">
                        {item.sourceHost ?? item.content}
                      </a>
                    ) : (
                      <p>{item.content}</p>
                    )}
                    {item.kind === 'link' && item.note ? <p>{item.note}</p> : null}
                    <small>{formatCapturedAt(item.createdAt)}</small>
                  </div>
                  <button
                    className="capture-archive-button"
                    type="button"
                    aria-label="归档此条待学习内容"
                    disabled={archivingId === item.id}
                    onClick={() => void archive(item.id)}
                  >
                    <Archive size={16} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function fallbackTitle(item: LearningCapture): string {
  if (item.kind === 'note') return '未命名想法'
  return item.sourceHost ?? item.content
}

function formatCapturedAt(value: string): string {
  const date = new Date(value)
  return `收下于 ${new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)}`
}
