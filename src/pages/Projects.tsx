import { useState } from 'react'
import { FolderInput, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/store'
import { api } from '../lib/ipc'
import { ProjectTable } from '../components/ProjectTable'

export function Projects() {
  const { projects, search, refreshProjects } = useApp()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const filtered = search
    ? projects.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : projects

  async function importProject() {
    setError('')
    const res = await api.importProject()
    if (!res.ok && res.error && res.error !== 'cancelled') setError(res.error)
    await refreshProjects()
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Projects</h2>
        <div className="flex gap-2">
          <button
            onClick={importProject}
            className="flex items-center gap-2 rounded-lg border border-edge bg-panel px-4 py-2 text-sm font-medium text-slate-200 hover:border-accent/50"
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

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">{error}</div>
      )}

      <ProjectTable projects={filtered} />
    </div>
  )
}
