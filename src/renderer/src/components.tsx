import type { ReactNode } from 'react'
import { ArrowLeft, Check, ChevronDown, Search, X } from 'lucide-react'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backLabel,
  onBack,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
  backLabel?: string
  onBack?: () => void
}): React.JSX.Element {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        {onBack && (
          <button className="page-back-button" type="button" onClick={onBack}>
            <ArrowLeft size={14} /> {backLabel ?? '返回'}
          </button>
        )}
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function Button({
  children,
  variant = 'primary',
  icon,
  disabled,
  onClick,
  type = 'button',
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  icon?: ReactNode
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
}): React.JSX.Element {
  return (
    <button className={`button button-${variant}`} type={type} disabled={disabled} onClick={onClick}>
      {icon}
      <span>{children}</span>
    </button>
  )
}

export function IconButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string
  children: ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      className={`icon-button${active ? ' is-active' : ''}`}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder,
  compact = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  compact?: boolean
}): React.JSX.Element {
  return (
    <label className={`search-field${compact ? ' compact' : ''}`}>
      <Search size={17} aria-hidden="true" />
      <span className="sr-only">搜索</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      {value && (
        <button type="button" aria-label="清空搜索" onClick={() => onChange('')}>
          <X size={15} />
        </button>
      )}
      {!value && !compact && <kbd>⌘ K</kbd>}
    </label>
  )
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }): React.JSX.Element {
  return <span className={`tag tag-${tone}`}>{children}</span>
}

export function StatusDot({ status }: { status: 'success' | 'warning' | 'danger' | 'muted' }): React.JSX.Element {
  return <span className={`status-dot status-dot-${status}`} aria-hidden="true" />
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}): React.JSX.Element {
  return (
    <button
      className={`toggle${checked ? ' is-on' : ''}`}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  )
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  label: string
}): React.JSX.Element {
  return (
    <div className="segmented-control" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'is-active' : undefined}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function SelectButton({ children, onClick }: { children: ReactNode; onClick?: () => void }): React.JSX.Element {
  return (
    <button className="select-button" type="button" onClick={onClick}>
      <span>{children}</span>
      <ChevronDown size={15} />
    </button>
  )
}

export function ProgressRing({ value, label }: { value: number; label: string }): React.JSX.Element {
  return (
    <div className="progress-ring" style={{ '--progress': `${value * 360}deg` } as React.CSSProperties}>
      <div>
        <strong>{Math.round(value * 100)}%</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }): React.JSX.Element {
  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast-icon">
        <Check size={15} />
      </span>
      <span>{message}</span>
      <button type="button" aria-label="关闭通知" onClick={onDismiss}>
        <X size={15} />
      </button>
    </div>
  )
}

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string
  description: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}): React.JSX.Element {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2 id="modal-title">{title}</h2>
            <p>{description}</p>
          </div>
          <IconButton label="关闭" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="modal-body">{children}</div>
        <footer>{footer}</footer>
      </section>
    </div>
  )
}
