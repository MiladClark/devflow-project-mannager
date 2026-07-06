import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useNotifications, type AppNotification, type NotifyLevel } from '../state/notifications'

const ICON: Record<NotifyLevel, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warn: AlertTriangle,
  info: Info,
}

const ACCENT: Record<NotifyLevel, string> = {
  success: 'border-emerald-500/40 text-emerald-300',
  error: 'border-rose-500/40 text-rose-300',
  warn: 'border-amber-500/40 text-amber-300',
  info: 'border-sky-500/40 text-sky-300',
}

// errors linger; the rest auto-dismiss
const TTL: Record<NotifyLevel, number> = {
  success: 5000,
  info: 5000,
  warn: 8000,
  error: 12000,
}

function Toast({ item }: { item: AppNotification }) {
  const navigate = useNavigate()
  const dismissToast = useNotifications((s) => s.dismissToast)
  const Icon = ICON[item.level]

  useEffect(() => {
    const t = setTimeout(() => dismissToast(item.id), TTL[item.level])
    return () => clearTimeout(t)
  }, [item.id, item.level, dismissToast])

  return (
    <div
      onClick={() => {
        if (item.route) {
          navigate(item.route)
          dismissToast(item.id)
        }
      }}
      className={`animate-slide-in-right pointer-events-auto flex w-80 items-start gap-3 rounded-xl border bg-panel/95 p-3.5 shadow-2xl backdrop-blur ${ACCENT[item.level]} ${
        item.route ? 'cursor-pointer hover:bg-panel' : ''
      }`}
    >
      <Icon size={17} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{item.title}</p>
        {item.message && <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{item.message}</p>}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          dismissToast(item.id)
        }}
        className="shrink-0 text-slate-500 hover:text-slate-300"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function Toaster() {
  const items = useNotifications((s) => s.items)
  const active = items.filter((i) => !i.toastDismissed).slice(0, 4)

  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-[95] flex flex-col-reverse gap-2.5">
      {active.map((item) => (
        <Toast key={item.id} item={item} />
      ))}
    </div>
  )
}
