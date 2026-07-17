import { CircleCheck, CircleAlert, CirclePause, Loader2 } from 'lucide-react'
import type { ProjectStatus } from '../shared/types'

const styles: Record<ProjectStatus, { icon: typeof CircleCheck; bg: string; text: string; label: string; spin?: boolean }> = {
  running: { icon: CircleCheck, bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Running' },
  starting: { icon: Loader2, bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Starting', spin: true },
  building: { icon: Loader2, bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Building', spin: true },
  stopped: { icon: CirclePause, bg: 'bg-slate-700/40', text: 'text-slate-400', label: 'Stopped' },
  error: { icon: CircleAlert, bg: 'bg-rose-500/15', text: 'text-rose-400', label: 'Error' },
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const s = styles[status]
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${s.bg} ${s.text}`}>
      <Icon size={12} className={s.spin ? 'animate-spin' : ''} />
      {s.label}
    </span>
  )
}
