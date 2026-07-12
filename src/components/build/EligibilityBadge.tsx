import type { BuildEligibilityStatus } from '../../shared/types'

const styles: Record<BuildEligibilityStatus, { dot: string; text: string }> = {
  ready: { dot: 'bg-emerald-400', text: 'text-emerald-400' },
  'needs-attention': { dot: 'bg-amber-400', text: 'text-amber-400' },
  'not-buildable': { dot: 'bg-rose-500', text: 'text-rose-400' },
  'config-missing': { dot: 'bg-orange-400', text: 'text-orange-400' },
}

export function EligibilityBadge({ status, label, size = 'md' }: { status: BuildEligibilityStatus; label: string; size?: 'sm' | 'md' }) {
  const s = styles[status]
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${s.text} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
      {label}
    </span>
  )
}
