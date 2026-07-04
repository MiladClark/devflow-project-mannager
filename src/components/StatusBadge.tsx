import type { ProjectStatus } from '../shared/types'

const styles: Record<ProjectStatus, { dot: string; text: string; label: string }> = {
  running: { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Running' },
  starting: { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400', label: 'Starting' },
  building: { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400', label: 'Building' },
  stopped: { dot: 'bg-slate-500', text: 'text-slate-400', label: 'Stopped' },
  error: { dot: 'bg-rose-500', text: 'text-rose-400', label: 'Error' },
}

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const s = styles[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}
