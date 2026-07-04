import { useNavigate } from 'react-router-dom'
import { Play, Square, RotateCcw, ScrollText, Hammer, FolderOpen, Trash2 } from 'lucide-react'
import { useApp } from '../state/store'
import { api } from '../lib/ipc'
import { FrameworkIcon } from './FrameworkIcon'
import { StatusBadge } from './StatusBadge'
import type { Project } from '../shared/types'

function ActionBtn({
  title,
  onClick,
  children,
  danger,
  disabled,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`rounded-md p-1.5 transition-colors disabled:opacity-30 ${
        danger ? 'text-slate-500 hover:bg-rose-500/10 hover:text-rose-400' : 'text-slate-400 hover:bg-accent/10 hover:text-accent'
      }`}
    >
      {children}
    </button>
  )
}

export function ProjectTable({ projects }: { projects: Project[] }) {
  const navigate = useNavigate()
  const runtime = useApp((s) => s.runtime)

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-edge p-10 text-center text-sm text-slate-500">
        No projects yet. Create a new one or import an existing folder.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-edge">
      <table className="w-full text-left text-sm">
        <thead className="bg-panel2 text-xs tracking-wider text-slate-500 uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">Project Name</th>
            <th className="px-4 py-3 font-semibold">Framework</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Port</th>
            <th className="px-4 py-3 font-semibold">Localhost URL</th>
            <th className="px-4 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const rt = runtime[p.id] ?? { status: 'stopped' as const }
            const busy = rt.status === 'running' || rt.status === 'starting' || rt.status === 'building'
            return (
              <tr
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="cursor-pointer border-t border-edge bg-panel transition-colors hover:bg-slate-800/40"
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <FrameworkIcon framework={p.framework} />
                    <div>
                      <p className="font-semibold text-white">{p.name}</p>
                      <p className="max-w-56 truncate text-xs text-slate-500">{p.path}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-slate-300">{p.frameworks.join(' · ')}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={rt.status} />
                </td>
                <td className="px-4 py-3.5 text-slate-300">{rt.port ?? (busy ? '...' : 'N/A')}</td>
                <td className="px-4 py-3.5">
                  {rt.url ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        api.openExternal(rt.url!)
                      }}
                      className="text-accent hover:underline"
                    >
                      {rt.url}
                    </button>
                  ) : (
                    <span className="text-slate-600">N/A</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex justify-end gap-1">
                    {busy ? (
                      <>
                        <ActionBtn title="Stop" onClick={() => api.stopProject(p.id)}>
                          <Square size={15} />
                        </ActionBtn>
                        <ActionBtn title="Restart" onClick={() => api.restartProject(p.id)} disabled={rt.status === 'building'}>
                          <RotateCcw size={15} />
                        </ActionBtn>
                      </>
                    ) : (
                      <>
                        <ActionBtn title="Start" onClick={() => api.startProject(p.id)} disabled={!p.runCommand}>
                          <Play size={15} />
                        </ActionBtn>
                        <ActionBtn title="Build" onClick={() => api.buildProject(p.id)} disabled={!p.buildCommand}>
                          <Hammer size={15} />
                        </ActionBtn>
                      </>
                    )}
                    <ActionBtn title="Logs" onClick={() => navigate(`/projects/${p.id}`)}>
                      <ScrollText size={15} />
                    </ActionBtn>
                    <ActionBtn title="Open folder" onClick={() => api.openFolder(p.id)}>
                      <FolderOpen size={15} />
                    </ActionBtn>
                    <ActionBtn
                      title="Remove from list"
                      danger
                      onClick={() => {
                        if (confirm(`Remove "${p.name}" from DevFlow? Files on disk are not deleted.`)) {
                          api.removeProject(p.id)
                        }
                      }}
                    >
                      <Trash2 size={15} />
                    </ActionBtn>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
