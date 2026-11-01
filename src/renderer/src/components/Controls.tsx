import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDownIcon } from './Icons'

export function Field({
  label,
  hint,
  children,
  inline
}: {
  label: string
  hint?: string
  children: ReactNode
  inline?: boolean
}) {
  return (
    <div className="field">
      <div className="field__label">
        <span>{label}</span>
        {hint && <span className="mono">{hint}</span>}
      </div>
      <div className={inline ? 'field__row' : undefined}>{children}</div>
    </div>
  )
}

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  onFocus?: () => void
  onBlur?: () => void
  disabled?: boolean
  suffix?: string
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  onFocus,
  onBlur,
  disabled,
  suffix
}: NumberInputProps) {
  const [draft, setDraft] = useState(String(round(value)))

  useEffect(() => {
    setDraft(String(round(value)))
  }, [value])

  const commit = (raw: string) => {
    const parsed = Number.parseFloat(raw)
    if (!Number.isFinite(parsed)) {
      setDraft(String(round(value)))
      return
    }
    const clamped = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, parsed))
    onChange(clamped)
    setDraft(String(round(clamped)))
  }

  return (
    <div className="field__row">
      <input
        className="input input--num"
        value={draft}
        disabled={disabled}
        inputMode="decimal"
        onChange={(event) => setDraft(event.target.value)}
        onFocus={onFocus}
        onBlur={(event) => {
          commit(event.target.value)
          onBlur?.()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit((event.target as HTMLInputElement).value)
            ;(event.target as HTMLInputElement).blur()
          }
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            const delta = (event.key === 'ArrowUp' ? 1 : -1) * step * (event.shiftKey ? 10 : 1)
            const next = round(value + delta)
            onChange(next)
            setDraft(String(next))
          }
        }}
      />
      {suffix && <span className="hint">{suffix}</span>}
    </div>
  )
}

const round = (value: number): number => Math.round(value * 100) / 100

export function RangeInput({
  value,
  onChange,
  min,
  max,
  step = 0.05,
  onCommit
}: {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  onCommit?: () => void
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ width: '100%' }}
      onChange={(event) => onChange(Number.parseFloat(event.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
    />
  )
}

export function ColorField({
  value,
  onChange,
  onCommit
}: {
  value: string
  onChange: (value: string) => void
  onCommit?: () => void
}) {
  return (
    <div className="field__row">
      <span className="swatch" style={{ background: value }}>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onCommit}
        />
      </span>
      <input
        className="input mono"
        value={value}
        onChange={(event) => {
          const next = event.target.value
          if (/^#[0-9a-fA-F]{0,6}$/.test(next)) onChange(next)
        }}
        onBlur={onCommit}
      />
    </div>
  )
}

export function SelectField({
  value,
  onChange,
  children
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <div className="field__row">
      <select className="select" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
      <ChevronDownIcon size={14} style={{ marginLeft: -22, pointerEvents: 'none', opacity: 0.6 }} />
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: Array<{ value: T; label?: string; icon?: ReactNode; title?: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title ?? option.value}
          className={option.value === value ? 'is-active' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.icon ?? option.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      className="field__row"
      style={{ background: 'none', gap: 8, width: '100%' }}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span className={`switch${checked ? ' is-on' : ''}`} />
      <span className="hint" style={{ color: 'var(--text)' }}>
        {label}
      </span>
    </button>
  )
}

export function IconToggle({
  active,
  onClick,
  title,
  children
}: {
  active: boolean
  onClick: () => void
  title: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      className={`iconbtn${active ? ' is-active' : ''}`}
      onClick={onClick}
      style={{ width: 28, height: 28 }}
    >
      {children}
    </button>
  )
}
