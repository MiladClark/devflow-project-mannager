type SwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  size?: 'sm' | 'md'
  className?: string
}

export function Switch({ checked, onChange, disabled, id, size = 'md', className = '' }: SwitchProps) {
  const track = size === 'sm' ? 'h-4 w-7' : 'h-5 w-9'
  const knob = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  const on = size === 'sm' ? 'translate-x-3' : 'translate-x-4'

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 rounded-full border transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${track} ${
        checked ? 'border-accent bg-accent' : 'border-edge bg-slate-700'
      } ${className}`}
    >
      <span
        aria-hidden
        className={`absolute top-1/2 left-0.5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-200 ${knob} ${
          checked ? on : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export function SwitchField({
  label,
  hint,
  checked,
  onChange,
  disabled,
  children,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className={`flex items-center gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <Switch checked={checked} onChange={onChange} disabled={disabled} size="sm" />
      <div className="min-w-0 flex-1 text-sm text-slate-300">
        <span>
          {label}
          {children}
        </span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{hint}</span>}
      </div>
    </div>
  )
}
