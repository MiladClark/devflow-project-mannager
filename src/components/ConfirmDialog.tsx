import { useEffect } from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { useConfirmStore } from '../state/confirm'

const variantStyles = {
  default: {
    icon: AlertTriangle,
    iconCls: 'text-accent',
    ring: 'border-edge',
    confirm: 'bg-accent text-accent-fg hover:bg-cyan-300',
  },
  danger: {
    icon: Trash2,
    iconCls: 'text-rose-400',
    ring: 'border-rose-500/30',
    confirm: 'bg-rose-500/90 text-white hover:bg-rose-500',
  },
  warning: {
    icon: AlertTriangle,
    iconCls: 'text-amber-400',
    ring: 'border-amber-500/30',
    confirm: 'bg-amber-500/90 text-white hover:bg-amber-500',
  },
} as const

export function ConfirmDialog() {
  const open = useConfirmStore((s) => s.open)
  const request = useConfirmStore((s) => s.request)
  const answer = useConfirmStore((s) => s.answer)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        answer(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, answer])

  if (!open || !request) return null

  const variant = request.variant ?? 'default'
  const styles = variantStyles[variant]
  const Icon = styles.icon

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && answer(false)}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className={`w-full max-w-md animate-scale-in rounded-xl border bg-panel p-5 shadow-2xl ${styles.ring}`}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel2 ${styles.iconCls}`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-title" className="text-base font-semibold text-white">
              {request.title}
            </h3>
            <p id="confirm-message" className="mt-1.5 text-sm leading-relaxed text-slate-400">
              {request.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => answer(false)}
            className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => answer(false)}
            className="rounded-lg border border-edge px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800/60"
          >
            {request.cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => answer(true)}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${styles.confirm}`}
          >
            {request.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
