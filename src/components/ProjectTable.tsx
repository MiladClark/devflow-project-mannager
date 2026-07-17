import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Play,
  Square,
  RotateCcw,
  ScrollText,
  Package,
  FolderOpen,
  Trash2,
  GitBranch,
  ChevronDown,
  MoreVertical,
  Link2,
} from 'lucide-react'
import { useApp } from '../state/store'
import { api } from '../lib/ipc'
import { useGuestLock } from '../lib/guest'
import { useBuildNavigation } from '../lib/buildNav'
import { confirmAction } from '../state/confirm'
import { StatusBadge } from './StatusBadge'
import { PortConflict } from './PortConflict'
import { HealthBadge } from './HealthBadge'
import { EditorIcon } from './EditorIcon'
import { EligibilityBadge } from './build/EligibilityBadge'
import { EligibilityDialog } from './build/EligibilityDialog'
import type { Project, PortOwner, BuildEligibility, GitStatus } from '../shared/types'

/** Positions a dropdown panel via a body portal, fixed to its trigger, so it
 * can escape the project table's `overflow-hidden` (needed for rounded corners).
 * `rightWidth` (for align:'right') must match the panel's rendered width — we can't
 * use `transform: translateX(-100%)` to align the right edge because the panel's
 * `animate-pop-in` entrance animation also drives `transform` and would clobber it. */
function usePortalMenu(align: 'left' | 'right', rightWidth = 0) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function place() {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      setStyle(
        align === 'left'
          ? { position: 'fixed', top: r.bottom + 4, left: r.left }
          : { position: 'fixed', top: r.bottom + 4, left: r.right - rightWidth },
      )
    }
    place()
    function onDown(e: PointerEvent) {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    function onClose() {
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [open, align, rightWidth])

  return { open, setOpen, triggerRef, menuRef, style }
}

function FrameworkCell({ project, git }: { project: Project; git?: GitStatus }) {
  const { open, setOpen, triggerRef, menuRef, style } = usePortalMenu('left')
  const stack = Array.from(new Set(project.frameworks))
  const extra = stack.length - 1

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="press -mx-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-slate-300 transition-colors hover:bg-slate-800/60"
      >
        <span className="truncate">{stack[0]}</span>
        {extra > 0 && (
          <span className="rounded-full bg-slate-700/60 px-1.5 py-px text-[10px] font-semibold text-slate-300">+{extra}</span>
        )}
        {git?.isRepo && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <GitBranch size={11} />
            {git.dirtyCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
          </span>
        )}
        <ChevronDown size={12} className={`shrink-0 text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={style}
            onClick={(e) => e.stopPropagation()}
            className="app-frost-popover animate-pop-in z-50 min-w-52 rounded-lg border border-edge p-2.5 shadow-2xl shadow-black/50"
          >
            <p className="mb-1.5 px-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Stack</p>
            <div className="mb-1 flex flex-wrap gap-1 px-1">
              {stack.map((f) => (
                <span key={f} className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  {f}
                </span>
              ))}
            </div>
            {git?.isRepo && (
              <>
                <p className="mt-2 mb-1 px-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Git</p>
                <div className="flex flex-wrap items-center gap-1.5 px-1 text-xs text-slate-300">
                  <span className="flex items-center gap-1">
                    <GitBranch size={12} /> {git.branch}
                  </span>
                  {git.dirtyCount > 0 && (
                    <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-300">
                      {git.dirtyCount} changed
                    </span>
                  )}
                  {git.ahead > 0 && <span className="text-emerald-400">↑{git.ahead}</span>}
                  {git.behind > 0 && <span className="text-amber-400">↓{git.behind}</span>}
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors disabled:opacity-30 ${
        danger ? 'text-rose-400 hover:bg-rose-500/10' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function RowActionsMenu({
  project,
  busy,
  building,
  onStart,
  onStop,
  onRestart,
  onBuildSetup,
  buildChecking,
  onLogs,
  onOpenFolder,
  onRemove,
}: {
  project: Project
  busy: boolean
  building: boolean
  onStart: () => void
  onStop: () => void
  onRestart: () => void
  onBuildSetup: () => void
  buildChecking: boolean
  onLogs: () => void
  onOpenFolder: () => void
  onRemove: () => void
}) {
  const { open, setOpen, triggerRef, menuRef, style } = usePortalMenu('right', 192)
  const [editors, setEditors] = useState({ vscode: false, cursor: false })

  useEffect(() => {
    api.detectEditors().then(setEditors)
  }, [])

  function run(fn: () => void) {
    setOpen(false)
    fn()
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        title="Actions"
        onClick={() => setOpen((o) => !o)}
        className={`press rounded-md p-1.5 transition-colors ${
          open ? 'bg-slate-800/60 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
        }`}
      >
        <MoreVertical size={16} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={style}
            onClick={(e) => e.stopPropagation()}
            className="app-frost-popover animate-pop-in z-50 min-w-48 rounded-lg border border-edge p-1 shadow-2xl shadow-black/50"
          >
            {busy ? (
              <>
                <MenuItem icon={<Square size={14} />} label="Stop" onClick={() => run(onStop)} />
                <MenuItem icon={<RotateCcw size={14} />} label="Restart" disabled={building} onClick={() => run(onRestart)} />
              </>
            ) : (
              <MenuItem icon={<Play size={14} />} label="Start" disabled={!project.runCommand} onClick={() => run(onStart)} />
            )}
            <MenuItem icon={<Package size={14} />} label="Build & Setup" disabled={buildChecking} onClick={() => run(onBuildSetup)} />
            <MenuItem icon={<ScrollText size={14} />} label="View Logs" onClick={() => run(onLogs)} />
            <MenuItem icon={<FolderOpen size={14} />} label="Open Folder" onClick={() => run(onOpenFolder)} />
            {editors.vscode && (
              <MenuItem
                icon={<EditorIcon editor="vscode" size={14} />}
                label="Open in VS Code"
                onClick={() => run(() => void api.openInEditor(project.id, 'vscode'))}
              />
            )}
            {editors.cursor && (
              <MenuItem
                icon={<EditorIcon editor="cursor" size={14} />}
                label="Open in Cursor"
                onClick={() => run(() => void api.openInEditor(project.id, 'cursor'))}
              />
            )}
            <div className="my-1 h-px bg-edge" />
            <MenuItem icon={<Trash2 size={14} />} label="Remove" danger onClick={() => run(onRemove)} />
          </div>,
          document.body,
        )}
    </div>
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
  const [eligibility, setEligibility] = useState<Record<string, BuildEligibility>>({})
  const { openBuild, checkingId, dialog, closeDialog } = useBuildNavigation()

  useEffect(() => {
    let cancelled = false
    if (projects.length === 0) return
    api.buildEligibilityMany(projects.map((p) => p.path)).then((res) => {
      if (!cancelled) setEligibility(res)
    })
    return () => {
      cancelled = true
    }
    // re-check whenever the visible project set changes (paths are a stable proxy for identity here)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.map((p) => p.path).join('|')])

  async function start(id: string) {
    setConflicts(({ [id]: _, ...rest }) => rest)
    setStartErrors(({ [id]: _, ...rest }) => rest)
    const res = await api.startProject(id)
    if (!res.ok) {
      if (res.portConflict) setConflicts((c) => ({ ...c, [id]: res.portConflict! }))
      else if (res.error) setStartErrors((e) => ({ ...e, [id]: res.error! }))
    }
  }

  async function remove(p: Project) {
    const ok = await confirmAction({
      title: 'Remove project?',
      message: `"${p.name}" will be removed from DevFlow. Files on disk are not deleted.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    })
    if (ok) api.removeProject(p.id)
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
            <th className="px-4 py-2.5 font-semibold">Project</th>
            <th className="px-4 py-2.5 font-semibold">Stack</th>
            <th className="px-4 py-2.5 font-semibold">Status</th>
            <th className="px-4 py-2.5 font-semibold">Port</th>
            <th className="px-4 py-2.5 text-center font-semibold">URL</th>
            <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
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
                <td className="px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{p.name}</p>
                    <p className="max-w-56 truncate text-xs text-slate-500">{p.path}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <FrameworkCell project={p} git={gitStatus[p.id]} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={rt.status} />
                    <HealthBadge summary={health[p.id]} />
                  </div>
                  {eligibility[p.path] && (
                    <EligibilityBadge status={eligibility[p.path].status} label={eligibility[p.path].statusLabel} size="sm" />
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{rt.port ?? (busy ? '…' : '—')}</td>
                <td className="px-4 py-3 text-center">
                  {rt.url ? (
                    <button
                      type="button"
                      title={rt.url}
                      onClick={(e) => {
                        e.stopPropagation()
                        api.openExternal(rt.url!)
                      }}
                      className="press inline-flex items-center justify-center rounded-md p-1.5 text-accent transition-colors hover:bg-accent/10"
                    >
                      <Link2 size={15} />
                    </button>
                  ) : (
                    <span className="inline-flex items-center justify-center p-1.5 text-slate-700">
                      <Link2 size={15} />
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <RowActionsMenu
                      project={p}
                      busy={busy}
                      building={rt.status === 'building'}
                      onStart={() => start(p.id)}
                      onStop={() => api.stopProject(p.id)}
                      onRestart={() => api.restartProject(p.id)}
                      onBuildSetup={() => {
                        if (guardGuest()) return
                        void openBuild(p)
                      }}
                      buildChecking={checkingId === p.id}
                      onLogs={() => {
                        if (guardGuest()) return
                        navigate(`/projects/${p.id}`)
                      }}
                      onOpenFolder={() => api.openFolder(p.id)}
                      onRemove={() => void remove(p)}
                    />
                  </div>
                </td>
              </tr>
              </FragmentRow>
            )
          })}
        </tbody>
      </table>
      {dialog && <EligibilityDialog project={dialog.project} eligibility={dialog.eligibility} onClose={closeDialog} />}
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
