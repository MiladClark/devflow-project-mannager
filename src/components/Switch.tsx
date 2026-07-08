type SwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  size?: 'sm' | 'md'
  className?: string
}

export function Switch({ checked, onChange, disabled, id, size = 'md', className = '' }: SwitchProps) {
  const track = size === 'sm' ? 'app-switch-sm' : 'app-switch-md'
  const knob = size === 'sm' ? 'app-switch-knob-sm' : 'app-switch-knob-md'

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`app-switch ${track} ${checked ? 'app-switch-on' : ''} ${className}`}
    >
      <span aria-hidden className={`app-switch-knob ${knob}`} />
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
