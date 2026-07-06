import { useState } from 'react'
import { X, FolderSearch, Loader2 } from 'lucide-react'
import { api } from '../lib/ipc'
import { FrameworkIcon } from './FrameworkIcon'
import type { ScanCandidate } from '../shared/types'

export function ScanProjectsDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<ScanCandidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  if (!open) return null

  async function scan() {
    setLoading(true)
    setError('')
    const res = await api.scanProjects()
    setLoading(false)
    if (res.cancelled) {
      onClose()
      return
    }
    if (!res.ok) {
      setError(res.error ?? 'Scan failed')
      return
    }
    setCandidates(res.candidates)
    setSelected(new Set(res.candidates.filter((c) => !c.alreadyImported).map((c) => c.project.path)))
  }

  function toggle(path: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  async function importSelected() {
    setImporting(true)
    const paths = [...selected]
    const res = await api.importManyProjects(paths)
    setImporting(false)
    if (res.errors.length) setError(res.errors.join(' · '))
    if (res.added > 0) {
      onImported()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-edge px-5 py-4">
          <h3 className="font-semibold text-white">Scan folder for projects</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          {candidates.length === 0 && !loading && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-slate-500">Choose a folder to scan for package.json projects (up to 4 levels deep).</p>
              <button
                type="button"
                onClick={() => void scan()}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300"
              >
                <FolderSearch size={16} /> Choose folder & scan
              </button>
            </div>
          )}

          {loading && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Scanning…
            </p>
          )}

          {error && <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}

          {candidates.length > 0 && (
            <div className="flex flex-col gap-2">
              {candidates.map(({ project, alreadyImported }) => (
                <label
                  key={project.path}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 ${
                    alreadyImported ? 'border-edge/50 opacity-50' : selected.has(project.path) ? 'border-accent/50 bg-accent/5' : 'border-edge bg-panel2'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={alreadyImported}
                    checked={selected.has(project.path)}
                    onChange={() => toggle(project.path)}
                    className="rounded border-edge"
                  />
                  <FrameworkIcon framework={project.framework} size={6} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{project.name}</p>
                    <p className="truncate text-xs text-slate-500">{project.path}</p>
                  </div>
                  {alreadyImported && <span className="text-xs text-slate-500">Imported</span>}
                </label>
              ))}
            </div>
          )}
        </div>

        {candidates.length > 0 && (
          <div className="flex justify-end gap-2 border-t border-edge px-5 py-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-edge px-4 py-2 text-sm text-slate-300">
              Cancel
            </button>
            <button
              type="button"
              disabled={importing || selected.size === 0}
              onClick={() => void importSelected()}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-40"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : null}
              Import {selected.size} selected
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
