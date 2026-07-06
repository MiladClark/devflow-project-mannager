import { useState } from 'react'
import { Play, Square, Loader2 } from 'lucide-react'
import { api } from '../lib/ipc'
import { notify } from '../state/notifications'
import type { Project } from '../shared/types'

export function ProjectBulkToolbar({
  projects,
  selectedIds,
  onSelectionChange,
}: {
  projects: Project[]
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
}) {
  const [busy, setBusy] = useState<'start' | 'stop' | null>(null)

  const ids =
    selectedIds && selectedIds.length > 0 ? selectedIds : projects.map((p) => p.id)

  async function startAll() {
    setBusy('start')
    const res = await api.startManyProjects(ids)
    setBusy(null)
    if (res.failed.length) {
      notify('warn', 'Bulk start', `${res.ok} started, ${res.failed.length} failed`)
    } else {
      notify('success', 'Bulk start', `${res.ok} project(s) started`)
    }
  }

  async function stopAll() {
    setBusy('stop')
    const res = await api.stopAllProjects()
    setBusy(null)
    notify('info', 'Stop all', `${res.ok} project(s) stopped`)
    onSelectionChange?.([])
  }

  if (projects.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={!!busy}
        onClick={() => void startAll()}
        className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-40"
      >
        {busy === 'start' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        {selectedIds?.length ? `Start selected (${ids.length})` : 'Start all'}
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => void stopAll()}
        className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-rose-500/50 hover:text-rose-300 disabled:opacity-40"
      >
        {busy === 'stop' ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} />}
        Stop all
      </button>
    </div>
  )
}
