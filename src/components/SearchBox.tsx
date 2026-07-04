import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  FolderKanban,
  Wrench,
  LayoutDashboard,
  ScrollText,
  Database,
  Plug,
  Settings as SettingsIcon,
  CornerDownLeft,
} from 'lucide-react'
import { useApp } from '../state/store'
import { TOOLS } from '../shared/tools'
import { FrameworkIcon } from './FrameworkIcon'

interface Hit {
  key: string
  group: 'Projects' | 'Pages' | 'Tools'
  label: string
  hint?: string
  to: string
  icon: React.ReactNode
}

const PAGES = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Projects', to: '/projects', icon: FolderKanban },
  { label: 'Logs', to: '/logs', icon: ScrollText },
  { label: 'Database', to: '/database', icon: Database },
  { label: 'Connections', to: '/connections', icon: Plug },
  { label: 'App and Tools', to: '/tools', icon: Wrench },
  { label: 'Settings', to: '/settings', icon: SettingsIcon },
]

export function SearchBox() {
  const navigate = useNavigate()
  const { search, setSearch, projects } = useApp()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const q = search.trim().toLowerCase()

  const hits = useMemo<Hit[]>(() => {
    if (!q) return []
    const out: Hit[] = []
    for (const p of projects) {
      if (p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q)) {
        out.push({
          key: `p-${p.id}`,
          group: 'Projects',
          label: p.name,
          hint: p.path,
          to: `/projects/${p.id}`,
          icon: <FrameworkIcon framework={p.framework} size={5} />,
        })
      }
    }
    for (const pg of PAGES) {
      if (pg.label.toLowerCase().includes(q)) {
        const Icon = pg.icon
        out.push({ key: `pg-${pg.to}`, group: 'Pages', label: pg.label, to: pg.to, icon: <Icon size={15} /> })
      }
    }
    for (const t of TOOLS) {
      if (t.name.toLowerCase().includes(q)) {
        out.push({
          key: `t-${t.id}`,
          group: 'Tools',
          label: t.name,
          hint: 'App and Tools',
          to: '/tools',
          icon: <Wrench size={15} />,
        })
      }
    }
    return out.slice(0, 12)
  }, [q, projects])

  useEffect(() => setActive(0), [q])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [])

  function go(hit: Hit) {
    setOpen(false)
    setSearch('')
    navigate(hit.to)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || hits.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % hits.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + hits.length) % hits.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(hits[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  let lastGroup = ''

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-md">
      <Search size={15} className="pointer-events-none absolute top-2.5 left-3 text-slate-500" />
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search projects, pages, tools..."
        className="w-full rounded-lg border border-edge bg-bg py-2 pr-3 pl-9 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-accent/60"
      />

      {open && q && (
        <div className="absolute top-11 right-0 left-0 z-50 max-h-96 overflow-y-auto rounded-xl border border-edge bg-panel p-1.5 shadow-2xl">
          {hits.length === 0 && <p className="px-3 py-2.5 text-sm text-slate-500">No results for "{search.trim()}"</p>}
          {hits.map((h, i) => {
            const header = h.group !== lastGroup
            lastGroup = h.group
            return (
              <div key={h.key}>
                {header && (
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                    {h.group}
                  </p>
                )}
                <button
                  onClick={() => go(h)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${
                    i === active ? 'bg-accent/10 text-white' : 'text-slate-300'
                  }`}
                >
                  <span className="shrink-0 text-slate-400">{h.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{h.label}</span>
                  {h.hint && <span className="max-w-40 truncate text-xs text-slate-500">{h.hint}</span>}
                  {i === active && <CornerDownLeft size={13} className="shrink-0 text-slate-500" />}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
