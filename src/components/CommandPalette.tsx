import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play,
  Square,
  RotateCcw,
  Package,
  FolderOpen,
  Plus,
  RefreshCw,
  Download,
  Palette,
  Moon,
  Sun,
  CornerDownLeft,
  Search,
} from 'lucide-react'
import { useApp } from '../state/store'
import { useGuestLock } from '../lib/guest'
import { useBuildNavigation } from '../lib/buildNav'
import { api } from '../lib/ipc'
import { PAGES } from '../lib/nav'
import { THEMES, applyTheme, getThemeChoice } from '../lib/theme'

interface Command {
  key: string
  group: 'Actions' | 'Projects' | 'Pages' | 'Theme'
  label: string
  hint?: string
  icon: React.ReactNode
  perform: () => void | Promise<unknown>
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { guardGuest } = useGuestLock()
  const { openBuild } = useBuildNavigation()
  const { projects, runtime } = useApp()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = []
    for (const p of projects) {
      const rt = runtime[p.id] ?? { status: 'stopped' }
      const running = rt.status === 'running' || rt.status === 'starting'
      if (running) {
        cmds.push({
          key: `stop-${p.id}`,
          group: 'Actions',
          label: `Stop ${p.name}`,
          icon: <Square size={14} />,
          perform: () => api.stopProject(p.id),
        })
        cmds.push({
          key: `restart-${p.id}`,
          group: 'Actions',
          label: `Restart ${p.name}`,
          icon: <RotateCcw size={14} />,
          perform: () => api.restartProject(p.id),
        })
      } else if (rt.status !== 'building') {
        if (p.runCommand)
          cmds.push({
            key: `start-${p.id}`,
            group: 'Actions',
            label: `Start ${p.name}`,
            icon: <Play size={14} />,
            perform: () => api.startProject(p.id),
          })
        cmds.push({
          key: `build-setup-${p.id}`,
          group: 'Actions',
          label: `Build & Setup ${p.name}`,
          icon: <Package size={14} />,
          perform: () => {
            if (guardGuest()) return
            void openBuild(p)
          },
        })
      }
      cmds.push({
        key: `folder-${p.id}`,
        group: 'Actions',
        label: `Open folder of ${p.name}`,
        icon: <FolderOpen size={14} />,
        perform: () => api.openFolder(p.id),
      })
      cmds.push({
        key: `editor-${p.id}`,
        group: 'Actions',
        label: `Open ${p.name} in editor`,
        icon: <FolderOpen size={14} />,
        perform: () => api.openInEditor(p.id),
      })
    }
    cmds.push({
      key: 'start-all',
      group: 'Actions',
      label: 'Start all projects',
      icon: <Play size={14} />,
      perform: () => api.startManyProjects(projects.map((p) => p.id)),
    })
    cmds.push({
      key: 'stop-all',
      group: 'Actions',
      label: 'Stop all projects',
      icon: <Square size={14} />,
      perform: () => api.stopAllProjects(),
    })
    cmds.push({
      key: 'new-project',
      group: 'Actions',
      label: 'New project',
      icon: <Plus size={14} />,
      perform: () => navigate('/new'),
    })
    cmds.push({
      key: 'check-updates',
      group: 'Actions',
      label: 'Check for updates',
      icon: <RefreshCw size={14} />,
      perform: () => navigate('/account'),
    })
    cmds.push({
      key: 'export-backup',
      group: 'Actions',
      label: 'Export backup',
      icon: <Download size={14} />,
      perform: () => api.exportBackup({ includePasswords: false }),
    })

    for (const p of projects) {
      cmds.push({
        key: `open-${p.id}`,
        group: 'Projects',
        label: p.name,
        hint: p.path,
        icon: <FolderOpen size={14} />,
        perform: () => navigate(`/projects/${p.id}`),
      })
    }
    for (const pg of PAGES) {
      const Icon = pg.icon
      cmds.push({
        key: `page-${pg.to}`,
        group: 'Pages',
        label: `Go to ${pg.label}`,
        icon: <Icon size={14} />,
        perform: () => navigate(pg.to),
      })
    }
    const choice = getThemeChoice()
    for (const t of THEMES) {
      cmds.push({
        key: `theme-${t.id}`,
        group: 'Theme',
        label: `Theme: ${t.name}`,
        icon: <Palette size={14} />,
        perform: () => applyTheme({ ...getThemeChoice(), theme: t.id }),
      })
    }
    cmds.push({
      key: 'mode-toggle',
      group: 'Theme',
      label: choice.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
      icon: choice.mode === 'dark' ? <Sun size={14} /> : <Moon size={14} />,
      perform: () => applyTheme({ ...getThemeChoice(), mode: getThemeChoice().mode === 'dark' ? 'light' : 'dark' }),
    })
    return cmds
  }, [projects, runtime, navigate, open]) // eslint-disable-line react-hooks/exhaustive-deps

  const q = query.trim().toLowerCase()
  const hits = useMemo(() => {
    const list = q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands
    return list.slice(0, 14)
  }, [commands, q])

  useEffect(() => setActive(0), [q])

  if (!open) return null

  function run(cmd: Command) {
    onClose()
    if (guardGuest()) return
    cmd.perform()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % Math.max(1, hits.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + hits.length) % Math.max(1, hits.length))
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault()
      run(hits[active])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  let lastGroup = ''

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/50 pt-[15vh]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="animate-pop-in w-full max-w-xl overflow-hidden rounded-xl border border-edge bg-panel shadow-2xl">
        <div className="relative border-b border-edge">
          <Search size={15} className="pointer-events-none absolute top-3.5 left-4 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a command or search..."
            className="w-full bg-transparent py-3 pr-4 pl-11 text-sm text-slate-200 placeholder-slate-500 outline-none"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {hits.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">No matching commands.</p>}
          {hits.map((c, i) => {
            const header = c.group !== lastGroup
            lastGroup = c.group
            return (
              <div key={c.key}>
                {header && (
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                    {c.group}
                  </p>
                )}
                <button
                  onClick={() => run(c)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${
                    i === active ? 'bg-accent/10 text-white' : 'text-slate-300'
                  }`}
                >
                  <span className="shrink-0 text-slate-400">{c.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="max-w-44 truncate text-xs text-slate-500">{c.hint}</span>}
                  {i === active && <CornerDownLeft size={13} className="shrink-0 text-slate-500" />}
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-edge px-4 py-2 text-[11px] text-slate-500">
          <span>↑↓ navigate</span>
          <span>↵ run</span>
          <span>Esc close</span>
          <span className="ml-auto">Ctrl+/ shortcuts</span>
        </div>
      </div>
    </div>
  )
}
