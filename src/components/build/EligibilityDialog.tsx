import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, FileSearch, X } from 'lucide-react'
import type { BuildEligibility, Project } from '../../shared/types'

export function EligibilityDialog({
  project,
  eligibility,
  onClose,
}: {
  project: Project
  eligibility: BuildEligibility
  onClose: () => void
}) {
  const navigate = useNavigate()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="eligibility-title"
        className="app-frost-popover w-full max-w-md animate-scale-in rounded-xl border border-rose-500/30 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-panel2 text-rose-400">
            <Ban size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="eligibility-title" className="text-base font-semibold text-white">
              {project.name} cannot be built yet
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{eligibility.reason}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-panel2 hover:text-slate-300"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {eligibility.detail && (
          <div className="mb-3 rounded-lg border border-edge bg-panel2/50 p-3">
            <p className="mb-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">What we found</p>
            <p className="text-sm leading-relaxed text-slate-300">{eligibility.detail}</p>
          </div>
        )}

        {eligibility.fix && (
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-3">
            <p className="mb-1 text-xs font-semibold tracking-wider text-accent uppercase">How to fix it</p>
            <p className="text-sm leading-relaxed text-slate-300">{eligibility.fix}</p>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-edge px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-panel2"
          >
            Close
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              onClose()
              navigate(`/projects/${project.id}`)
            }}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg hover:bg-cyan-300"
          >
            <FileSearch size={14} /> View Detected Project Details
          </button>
        </div>
      </div>
    </div>
  )
}
