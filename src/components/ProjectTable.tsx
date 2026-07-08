import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Square, RotateCcw, ScrollText, Hammer, FolderOpen, Trash2, GitBranch } from 'lucide-react'
import { useApp } from '../state/store'
import { api } from '../lib/ipc'
import { useGuestLock } from '../lib/guest'
import { confirmAction } from '../state/confirm'
import { FrameworkIcon } from './FrameworkIcon'
import { StatusBadge } from './StatusBadge'
import { PortConflict } from './PortConflict'
import { HealthBadge } from './HealthBadge'
import { OpenInEditorButton } from './OpenInEditorButton'
import type { Project, PortOwner } from '../shared/types'

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
      className={`press rounded-md p-1.5 transition-colors disabled:opacity-30 ${
        danger ? 'text-slate-500 hover:bg-rose-500/10 hover:text-rose-400' : 'text-slate-400 hover:bg-accent/10 hover:text-accent'
      }`}
    >
      {children}
    </button>
  )
}

export function ProjectTable({ projects }: { projects: Project[] }) {
  const navigate = useNavigate()
  const { guardGuest } = useGuestLock()
  const runtime = useApp((s) => s.runtime)
  const gitStatus = useApp((s) => s.gitStatus)
  const health = useApp((s) => s.health)
  const [conflicts, setConflicts] = useState<Record<string, PortOwner>>({})
  const [startErrors, setStartErrors] = useState<Record<string, string>>({})

  async function start(id: string) {
    setConflicts(({ [id]: _, ...rest }) => rest)
    setStartErrors(({ [id]: _, ...rest }) => rest)
    const res = await api.startProject(id)
    if (!res.ok) {
      if (res.portConflict) setConflicts((c) => ({ ...c, [id]: res.portConflict! }))
      else if (res.error) setStartErrors((e) => ({ ...e, [id]: res.error! }))
    }
  }

  async function build(id: string) {
    const res = await api.buildProject(id)
    // detailed issue resolution lives on the project detail page — nudge the user there
    if (!res.ok && res.error) {
      setStartErrors((e) => ({ ...e, [id]: res.issue ? `${res.error} Open the project to fix it.` : res.error! }))
    }
  }

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
            <th className="px-4 py-3 font-semibold">URL</th>
            <th className="px-4 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const rt = runtime[p.id] ?? { status: 'stopped' as const }
            const busy = rt.status === 'running' || rt.status === 'starting' || rt.status === 'building'
            const conflict = conflicts[p.id]
            const startError = startErrors[p.id]
            return (
              <FragmentRow
                key={p.id}
                conflict={conflict}
                projectName={p.name}
                startError={startError}
                onResolved={() => start(p.id)}
                onDismiss={() => {
                  setConflicts(({ [p.id]: _, ...rest }) => rest)
                  setStartErrors(({ [p.id]: _, ...rest }) => rest)
                }}
              >
              <tr
                onClick={() => {
                  if (guardGuest()) return
                  navigate(`/projects/${p.id}`)
                }}
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
                <td className="px-4 py-3.5 text-slate-300">
                  {p.frameworks.join(' · ')}
                  {gitStatus[p.id]?.isRepo && (
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <GitBranch size={11} />
                      {gitStatus[p.id].branch}
                      {gitStatus[p.id].dirtyCount > 0 && (
                        <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-300">
                          {gitStatus[p.id].dirtyCount}
                        </span>
                      )}
                      {gitStatus[p.id].ahead > 0 && <span className="text-emerald-400">↑{gitStatus[p.id].ahead}</span>}
                      {gitStatus[p.id].behind > 0 && <span className="text-amber-400">↓{gitStatus[p.id].behind}</span>}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <span className="flex items-center gap-2">
                    <StatusBadge status={rt.status} />
                    <HealthBadge summary={health[p.id]} />
                  </span>
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
                        <ActionBtn title="Start" onClick={() => start(p.id)} disabled={!p.runCommand}>
                          <Play size={15} />
                        </ActionBtn>
                        <ActionBtn title="Build" onClick={() => build(p.id)} disabled={!p.buildCommand}>
                          <Hammer size={15} />
                        </ActionBtn>
                      </>
                    )}
                    <ActionBtn
                      title="Logs"
                      onClick={() => {
                        if (guardGuest()) return
                        navigate(`/projects/${p.id}`)
                      }}
                    >
                      <ScrollText size={15} />
                    </ActionBtn>
                    <ActionBtn title="Open folder" onClick={() => api.openFolder(p.id)}>
                      <FolderOpen size={15} />
                    </ActionBtn>
                    <OpenInEditorButton projectId={p.id} />
                    <ActionBtn
                      title="Remove from list"
                      danger
                      onClick={async () => {
                        const ok = await confirmAction({
                          title: 'Remove project?',
                          message: `"${p.name}" will be removed from DevFlow. Files on disk are not deleted.`,
                          confirmLabel: 'Remove',
                          variant: 'danger',
                        })
                        if (ok) api.removeProject(p.id)
                      }}
                    >
                      <Trash2 size={15} />
                    </ActionBtn>
                  </div>
                </td>
              </tr>
              </FragmentRow>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FragmentRow({
  conflict,
  projectName,
  startError,
  onResolved,
  onDismiss,
  children,
}: {
  conflict?: PortOwner
  projectName?: string
  startError?: string
  onResolved: () => void
  onDismiss: () => void
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      {(conflict || startError) && (
        <tr className="bg-panel">
          <td colSpan={6} className="px-4 pb-3">
            {conflict ? (
              <PortConflict
                owner={conflict}
                projectName={projectName}
                onResolved={onResolved}
                onDismiss={onDismiss}
                onError={onDismiss}
              />
            ) : (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {startError}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
