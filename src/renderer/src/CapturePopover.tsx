import { useEffect, useRef } from 'react'
import { CornerDownLeft, Link2, LockKeyhole, Plus, Sparkles, StickyNote, X } from 'lucide-react'

type CaptureKind = 'link' | 'note'

export function CapturePopover({
  open,
  kind,
  title,
  content,
  placement = 'below',
  onOpenChange,
  onKindChange,
  onTitleChange,
  onContentChange,
  signedIn,
  saving,
  onRequireSignIn,
  onSubmit,
}: {
  open: boolean
  kind: CaptureKind
  title: string
  content: string
  placement?: 'below' | 'right'
  onOpenChange: (open: boolean) => void
  onKindChange: (kind: CaptureKind) => void
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  signedIn: boolean
  saving: boolean
  onRequireSignIn: () => void
  onSubmit: () => void
}): React.JSX.Element {
  const shellRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const canSubmit = Boolean(content.trim())

  useEffect(() => {
    if (!open) return undefined

    if (signedIn) contentRef.current?.focus()
    function handleOutsidePointer(event: PointerEvent): void {
      if (!shellRef.current?.contains(event.target as Node)) onOpenChange(false)
    }

    document.addEventListener('pointerdown', handleOutsidePointer)
    return () => document.removeEventListener('pointerdown', handleOutsidePointer)
  }, [open, onOpenChange, signedIn])

  function handleKeyDown(event: React.KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && signedIn && canSubmit && !saving) {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className={`capture-shell capture-placement-${placement}`} ref={shellRef}>
      <button
        className={`quick-capture-trigger${open ? ' is-open' : ''}`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="快速录入"
        onClick={() => onOpenChange(!open)}
      >
        <span className="quick-capture-icon"><Plus size={14} /></span>
        <span>录入</span>
        <kbd>⇧⌘K</kbd>
      </button>

      {open && (
        <section
          className="capture-popover"
          role="dialog"
          aria-modal="false"
          aria-labelledby="capture-popover-title"
          onKeyDown={handleKeyDown}
        >
          <header className="capture-popover-header">
            <span className="capture-popover-mark"><Sparkles size={16} /></span>
            <div>
              <strong id="capture-popover-title">随手收下</strong>
              <small>先放进待整理，稍后再决定是否入库</small>
            </div>
            <button type="button" aria-label="关闭快速录入" onClick={() => onOpenChange(false)}>
              <X size={16} />
            </button>
          </header>

          {!signedIn ? (
            <div className="capture-popover-auth-gate">
              <span><LockKeyhole size={17} /></span>
              <strong>登录后收下待学习内容</strong>
              <p>链接和想法会安全保存到你的账户中。</p>
              <button type="button" onClick={onRequireSignIn}>使用 GitHub 登录</button>
            </div>
          ) : <>
          <div className="capture-kind-switch" role="group" aria-label="录入类型">
            <button
              type="button"
              className={kind === 'link' ? 'is-active' : undefined}
              aria-pressed={kind === 'link'}
              onClick={() => onKindChange('link')}
            >
              <Link2 size={14} />
              链接
            </button>
            <button
              type="button"
              className={kind === 'note' ? 'is-active' : undefined}
              aria-pressed={kind === 'note'}
              onClick={() => onKindChange('note')}
            >
              <StickyNote size={14} />
              想法
            </button>
          </div>

          <div className="capture-composer">
            {kind === 'link' ? (
              <input
                ref={contentRef as React.RefObject<HTMLInputElement>}
                value={content}
                inputMode="url"
                aria-label="要录入的链接"
                placeholder="粘贴论文、文章、博客或推文链接…"
                onChange={(event) => onContentChange(event.target.value)}
              />
            ) : (
              <textarea
                ref={contentRef as React.RefObject<HTMLTextAreaElement>}
                value={content}
                aria-label="要记录的想法"
                placeholder="记下一个问题、想法或摘录…"
                rows={4}
                onChange={(event) => onContentChange(event.target.value)}
              />
            )}
            <input
              className="capture-note-input"
              value={title}
              aria-label={kind === 'link' ? '链接备注（可选）' : '想法标题（可选）'}
              placeholder={kind === 'link' ? '补一句为什么值得稍后看（可选）' : '给它一个容易找回的标题（可选）'}
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </div>

          <div className="capture-popover-boundary">
            <span>先保存原始内容，不下载网页或写入 Vault。</span>
          </div>

          <footer className="capture-popover-footer">
            <span><CornerDownLeft size={13} />⌘ Enter</span>
            <button
              className="capture-submit"
              type="button"
              disabled={!canSubmit || saving}
              onClick={onSubmit}
            >
              {saving ? '正在收下…' : '收下到待学习'}
            </button>
          </footer>
          </>}
        </section>
      )}
    </div>
  )
}
