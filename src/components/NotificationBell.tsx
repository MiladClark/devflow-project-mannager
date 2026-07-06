import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCircle2, XCircle, AlertTriangle, Info, Check, Trash2 } from 'lucide-react'
import { useNotifications, type NotifyLevel } from '../state/notifications'
import { timeAgo } from '../lib/format'

const ICON: Record<NotifyLevel, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warn: AlertTriangle,
  info: Info,
}

const COLOR: Record<NotifyLevel, string> = {
  success: 'text-emerald-400',
  error: 'text-rose-400',
  warn: 'text-amber-400',
  info: 'text-sky-400',
}

export function NotificationBell() {
  const navigate = useNavigate()
  const items = useNotifications((s) => s.items)
  const markAllRead = useNotifications((s) => s.markAllRead)
  const remove = useNotifications((s) => s.remove)
  const clear = useNotifications((s) => s.clear)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = items.filter((i) => !i.read).length

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  function toggle() {
    setOpen((o) => {
      if (!o && unread > 0) setTimeout(markAllRead, 800)
      return !o
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        title="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-edge text-slate-400 hover:border-accent/50 hover:text-slate-200"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-pop-in absolute top-11 right-0 z-50 w-80 overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
          <div className="flex items-center justify-between border-b border-edge px-4 py-2.5">
            <h4 className="text-sm font-semibold text-white">Notifications</h4>
            {items.length > 0 && (
              <button onClick={clear} className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-400">
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet.</p>
            ) : (
              items.map((item) => {
                const Icon = ICON[item.level]
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.route) {
                        navigate(item.route)
                        setOpen(false)
                      }
                    }}
                    className={`group flex items-start gap-2.5 border-b border-edge/50 px-4 py-2.5 ${
                      item.route ? 'cursor-pointer hover:bg-slate-800/40' : ''
                    }`}
                  >
                    <Icon size={15} className={`mt-0.5 shrink-0 ${COLOR[item.level]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200">{item.title}</p>
                      {item.message && <p className="mt-0.5 truncate text-xs text-slate-500">{item.message}</p>}
                      <p className="mt-0.5 text-[10px] text-slate-600">{timeAgo(item.ts)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        remove(item.id)
                      }}
                      className="shrink-0 text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-300"
                    >
                      <Check size={13} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
