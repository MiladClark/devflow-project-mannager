import { HeartPulse } from 'lucide-react'
import type { HealthSummary } from '../shared/types'

export function healthColor(s?: HealthSummary): 'red' | 'amber' | 'green' | 'gray' {
  if (!s) return 'gray'
  if (s.vulnHighPlus > 0 || s.enginesOk === false) return 'red'
  if (s.outdatedCount > 0 || s.vulnTotal > 0) return 'amber'
  return 'green'
}

const COLORS = {
  red: 'text-rose-400',
  amber: 'text-amber-400',
  green: 'text-emerald-400',
  gray: 'text-slate-600',
}

export function HealthBadge({ summary }: { summary?: HealthSummary }) {
  const color = healthColor(summary)
  const title = !summary
    ? 'Not scanned yet'
    : [
        summary.outdatedCount > 0 ? `${summary.outdatedCount} outdated` : 'deps up to date',
        summary.vulnTotal > 0 ? `${summary.vulnTotal} vulnerabilities (${summary.vulnHighPlus} high+)` : 'no known vulns',
        summary.enginesOk === false ? 'Node version mismatch' : '',
      ]
        .filter(Boolean)
        .join(' · ')
  return <HeartPulse size={14} className={COLORS[color]} aria-label={title} data-title={title} />
}
