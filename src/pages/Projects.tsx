import { useState } from 'react'
import { FolderInput, Plus, FolderSearch } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/store'
import { api } from '../lib/ipc'
import { useEntitlements } from '../lib/entitlements'
import { ProjectTable } from '../components/ProjectTable'
import { UpgradePrompt } from '../components/UpgradePrompt'
import { ScanProjectsDialog } from '../components/ScanProjectsDialog'
import { ProjectBulkToolbar } from '../components/ProjectBulkToolbar'
import { ContentReveal, Skeleton, SkeletonProjectTable } from '../components/Skeleton'

export function Projects() {
  const { projects, search, refreshProjects, loaded } = useApp()
  const navigate = useNavigate()
  const entitlements = useEntitlements()
  const [error, setError] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const filtered = search
    ? projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects

  const limited = Number.isFinite(entitlements.maxProjects)
  const limitReached = entitlements.loaded && projects.length >= entitlements.maxProjects

  async function importProject() {
    setError('')
    const res = await api.importProject()
    if (!res.ok && res.error && res.error !== 'cancelled') setError(res.error)
    await refreshProjects()
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <ContentReveal
        loading={!loaded}
        skeleton={
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-36 rounded-lg" />
                <Skeleton className="h-10 w-32 rounded-lg" />
              </div>
            </div>
            <SkeletonProjectTable />
          </div>
        }
      >
      <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-white">Projects</h2>
          {entitlements.loaded && limited && (
            <span className={`text-sm ${limitReached ? 'text-amber-300' : 'text-slate-500'}`}>
              {projects.length}/{entitlements.maxProjects} on Free plan
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setScanOpen(true)}
            disabled={limitReached}
            className="flex items-center gap-2 rounded-lg border border-edge bg-panel px-4 py-2 text-sm font-medium text-slate-200 hover:border-accent/50 disabled:opacity-40"
          >
            <FolderSearch size={15} /> Scan folder
          </button>
          <button
            onClick={importProject}
            disabled={limitReached}
            title={limitReached ? 'Free plan project limit reached — upgrade to import more' : undefined}
            className="flex items-center gap-2 rounded-lg border border-edge bg-panel px-4 py-2 text-sm font-medium text-slate-200 hover:border-accent/50 disabled:opacity-40"
          >
            <FolderInput size={15} /> Import Existing
          </button>
          <button
            onClick={() => navigate('/new')}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300"
          >
            <Plus size={15} /> New Project
          </button>
        </div>
      </div>

      {limitReached && (
        <UpgradePrompt message="You have reached the Free plan limit of 3 projects. Upgrade to Pro for unlimited projects, CMS templates and more." />
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">{error}</div>
      )}

      <ProjectBulkToolbar projects={filtered} />

      <ProjectTable projects={filtered} />
      </div>
      </ContentReveal>
      <ScanProjectsDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onImported={() => void refreshProjects()}
      />
    </div>
  )
}
