import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  ScrollText,
  Settings,
  Zap,
  Database,
  Plug,
  Wrench,
  Play,
  Square,
  Loader2,
} from 'lucide-react'
import { useApp } from '../state/store'
import { api, isElectron } from '../lib/ipc'
import type { DbService } from '../shared/types'
import { APP_VERSION } from '../version'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/logs', label: 'Logs', icon: ScrollText },
  { to: '/database', label: 'Database', icon: Database },
  { to: '/connections', label: 'Connections', icon: Plug },
  { to: '/tools', label: 'App and Tools', icon: Wrench },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function SidebarServices() {
  const [services, setServices] = useState<DbService[]>([])
  const [busy, setBusy] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const list = await api.listDbServices()
      if (!cancelled) setServices(list)
    }
    load()
    const t = setInterval(load, 15000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  async function toggle(s: DbService) {
    const action = s.state === 'running' ? 'stop' : 'start'
    setBusy(s.name)
    await api.dbServiceAction(s.name, action)
    setServices(await api.listDbServices())
    setBusy('')
  }

  if (services.length === 0) return null

  return (
    <div className="px-3 pb-2">
      <p className="px-2 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">DB Services</p>
      {services.map((s) => {
        const running = s.state === 'running'
        return (
          <div key={s.name} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-400">
            <span className={`h-2 w-2 shrink-0 rounded-full ${running ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            <Link to="/database" className="min-w-0 flex-1 truncate hover:text-slate-200" title={s.name}>
              {s.kind === 'postgres' ? 'PostgreSQL' : 'MySQL'}
              {s.version ? ` ${s.version}` : ''}
            </Link>
            <button
              onClick={() => toggle(s)}
              disabled={busy === s.name || s.state === 'pending' || !isElectron}
              title={
                !isElectron
                  ? 'Service control only works in the desktop app'
                  : running
                    ? `Stop ${s.name}`
                    : `Start ${s.name}`
              }
              className={`rounded-md p-1 disabled:opacity-40 ${
                running ? 'text-rose-400 hover:bg-rose-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'
              }`}
            >
              {busy === s.name ? (
                <Loader2 size={13} className="animate-spin" />
              ) : running ? (
                <Square size={13} />
              ) : (
                <Play size={13} />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function Sidebar() {
  const projects = useApp((s) => s.projects)
  const counts = new Map<string, number>()
  for (const p of projects) {
    for (const f of p.frameworks) counts.set(f, (counts.get(f) ?? 0) + 1)
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-edge bg-panel2">
      <nav className="flex flex-col gap-1 p-3">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-slate-700/60 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mx-3 my-2 border-t border-edge" />

      <div className="flex-1 overflow-y-auto px-3">
        <p className="px-2 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Frameworks</p>
        {[...counts.entries()].map(([name, count]) => (
          <div key={name} className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm text-slate-400">
            <span>{name}</span>
            <span className="rounded-full bg-slate-800 px-2 text-xs text-slate-300">{count}</span>
          </div>
        ))}
        {counts.size === 0 && <p className="px-3 text-xs text-slate-600">No projects yet</p>}
      </div>

      <div className="mx-3 my-2 border-t border-edge" />

      <SidebarServices />

      <div className="flex items-center gap-2 border-t border-edge p-4 text-xs text-slate-500">
        <Zap size={14} className="text-accent" />
        DevFlow Manager v{APP_VERSION}
      </div>
    </aside>
  )
}
