import { useEffect, useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Zap, Play, Square, Loader2 } from 'lucide-react'
import { NAV_GROUPS } from '../lib/nav'
import { api, isElectron } from '../lib/ipc'
import type { DbService } from '../shared/types'
import { APP_VERSION } from '../version'

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
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-edge bg-panel2">
      <nav className="flex flex-col gap-4 p-3">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.title} className="flex flex-col gap-1">
            {gi > 0 && <div className="mb-1 border-t border-edge/60" role="separator" />}
            <p className="px-2 pb-0.5 text-[10px] font-semibold tracking-wider text-slate-600 uppercase">{group.title}</p>
            {group.pages.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
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
          </div>
        ))}
      </nav>

      <div className="flex-1" />

      <SidebarServices />

      <div className="flex items-center gap-2 border-t border-edge p-4 text-xs text-slate-500">
        <Zap size={14} className="text-accent" />
        DevFlow Manager v{APP_VERSION}
      </div>
    </aside>
  )
}
