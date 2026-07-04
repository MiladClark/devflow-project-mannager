import { useEffect, useRef, useState } from 'react'
import { Crown, Sparkles, X } from 'lucide-react'

const PLANNED = [
  'Cloud sync for projects & connections',
  'One-click deploy integrations',
  'Team workspaces',
  'Priority support',
]

export function SubscriptionButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-400/20"
      >
        <Crown size={13} /> Subscription
      </button>

      {open && (
        <div className="absolute top-10 left-0 z-50 w-72 rounded-xl border border-edge bg-panel p-4 shadow-2xl">
          <div className="flex items-start justify-between">
            <h4 className="flex items-center gap-2 font-semibold text-white">
              <Sparkles size={15} className="text-amber-300" /> DevFlow Pro
            </h4>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
              <X size={14} />
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Paid plans are coming soon. Everything you use today stays free.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {PLANNED.map((f) => (
              <li key={f} className="flex items-center gap-2 text-xs text-slate-300">
                <span className="h-1 w-1 rounded-full bg-amber-300" /> {f}
              </li>
            ))}
          </ul>
          <button
            disabled
            className="mt-4 w-full cursor-not-allowed rounded-lg bg-amber-400/20 py-2 text-xs font-semibold text-amber-200/60"
          >
            Coming soon
          </button>
        </div>
      )}
    </div>
  )
}
