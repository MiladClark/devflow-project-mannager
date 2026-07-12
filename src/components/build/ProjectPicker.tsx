import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { useApp } from '../../state/store'
import { api } from '../../lib/ipc'
import { FrameworkIcon } from '../FrameworkIcon'
import { EligibilityBadge } from './EligibilityBadge'
import { EligibilityDialog } from './EligibilityDialog'
import { timeAgo } from '../../lib/format'
import type { BuildEligibility, Project } from '../../shared/types'

const BUILDABLE = new Set<BuildEligibility['status']>(['ready', 'needs-attention'])

export function ProjectPicker({ onSelect }: { onSelect: (path: string) => void }) {
  const projects = useApp((s) => s.projects)
  const [query, setQuery] = useState('')
  const [eligibility, setEligibility] = useState<Record<string, BuildEligibility>>({})
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState<{ project: Project; eligibility: BuildEligibility } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.buildEligibilityMany(projects.map((p) => p.path)).then((res) => {
      if (!cancelled) {
        setEligibility(res)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.map((p) => p.path).join('|')])

  const filtered = projects.filter((p) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q) || p.frameworks.join(' ').toLowerCase().includes(q)
  })

  function pick(p: Project) {
    const e = eligibility[p.path]
    if (e && BUILDABLE.has(e.status)) {
      onSelect(p.path)
    } else if (e) {
      setDialog({ project: p, eligibility: e })
    }
  }

  if (projects.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">No projects have been added to DevFlow yet.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects…"
          className="w-full rounded-lg border border-edge bg-bg py-2 pr-3 pl-9 text-sm text-slate-200 outline-none focus:border-accent/60"
        />
      </div>

      <div className="grid max-h-96 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        {filtered.map((p) => {
          const e = eligibility[p.path]
          const buildable = e ? BUILDABLE.has(e.status) : false
          return (
            <div
              key={p.id}
              role="button"
              onClick={() => pick(p)}
              className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${
                buildable ? 'cursor-pointer border-edge bg-panel hover:border-accent/50' : 'cursor-pointer border-edge bg-panel opacity-70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FrameworkIcon framework={p.framework} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{p.name}</p>
                  <p className="truncate text-xs text-slate-500">{p.path}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs text-slate-500">
                <span>{p.frameworks.join(' · ') || 'Unknown'}</span>
                {e?.version && <span>v{e.version}</span>}
              </div>
              <div className="flex items-center justify-between gap-2">
                {loading || !e ? (
                  <span className="text-xs text-slate-600">Checking…</span>
                ) : (
                  <EligibilityBadge status={e.status} label={e.statusLabel} size="sm" />
                )}
                {e?.lastBuildAt && <span className="text-[11px] text-slate-600">Last built {timeAgo(e.lastBuildAt)}</span>}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && <p className="col-span-full py-6 text-center text-sm text-slate-500">No projects match "{query}".</p>}
      </div>

      {dialog && <EligibilityDialog project={dialog.project} eligibility={dialog.eligibility} onClose={() => setDialog(null)} />}
    </div>
  )
}
