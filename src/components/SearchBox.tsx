import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Wrench, CornerDownLeft, X } from 'lucide-react'
import { useApp } from '../state/store'
import { TOOLS } from '../shared/tools'
import { PAGES } from '../lib/nav'
import { useGuestLock } from '../lib/guest'
import { FrameworkIcon } from './FrameworkIcon'

interface Hit {
  key: string
  group: 'Projects' | 'Pages' | 'Tools'
  label: string
  hint?: string
  to: string
  icon: React.ReactNode
}

function highlightMatch(text: string, query: string) {
  if (!query) return text
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-accent/15 px-0.5 text-accent">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function SearchBox({ className }: { className?: string }) {
  const navigate = useNavigate()
  const { guardGuest } = useGuestLock()
  const { search, setSearch, projects } = useApp()
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const q = search.trim().toLowerCase()

  const suggestions = useMemo<Hit[]>(() => {
    const out: Hit[] = []
    for (const p of projects.slice(0, 4)) {
      out.push({
        key: `p-${p.id}`,
        group: 'Projects',
        label: p.name,
        hint: p.path,
        to: `/projects/${p.id}`,
        icon: <FrameworkIcon framework={p.framework} size={5} />,
      })
    }
    for (const pg of PAGES.slice(0, 5)) {
      const Icon = pg.icon
      out.push({ key: `pg-${pg.to}`, group: 'Pages', label: pg.label, to: pg.to, icon: <Icon size={15} /> })
    }
    return out
  }, [projects])

  const hits = useMemo<Hit[]>(() => {
    if (!q) return suggestions
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
  }, [q, projects, suggestions])

  useEffect(() => setActive(0), [q])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.closest('.xterm')) return
      e.preventDefault()
      if (guardGuest()) return
      inputRef.current?.focus()
      setOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function go(hit: Hit) {
    if (guardGuest()) return
    setOpen(false)
    setSearch('')
    inputRef.current?.blur()
    navigate(hit.to)
  }

  function clearSearch() {
    setSearch('')
    setActive(0)
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      if (search) {
        e.preventDefault()
        clearSearch()
      } else {
        setOpen(false)
        inputRef.current?.blur()
      }
      return
    }
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
    }
  }

  const showPanel = open && (focused || q.length > 0)
  let lastGroup = ''

  return (
    <div ref={ref} className={`relative mx-auto w-full max-w-sm ${className ?? ''}`}>
      <div
        className={`app-frost-control group flex h-9 items-center gap-2 rounded-xl border px-2.5 transition-all ${
          focused
            ? 'border-accent/50 ring-2 ring-accent/15'
            : 'border-edge hover:border-accent/35'
        }`}
      >
        <Search
          size={15}
          strokeWidth={2}
          className={`shrink-0 transition-colors ${focused ? 'text-accent' : 'text-slate-500 group-hover:text-slate-400'}`}
        />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (guardGuest()) return
            setFocused(true)
            setOpen(true)
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder="Search projects, pages, tools…"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
        />
        {search ? (
          <button
            type="button"
            onClick={clearSearch}
            title="Clear search"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
          >
            <X size={14} />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded-md border border-edge bg-bg/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:inline">
            /
          </kbd>
        )}
      </div>

      {showPanel && (
        <div className="app-frost-popover animate-pop-in absolute top-[calc(100%+6px)] right-0 left-0 z-50 overflow-hidden rounded-xl border border-edge shadow-2xl">
          <div className="max-h-80 overflow-y-auto p-1.5">
            {!q && (
              <p className="px-3 pt-1.5 pb-2 text-[11px] text-slate-500">Quick access — or type to filter</p>
            )}
            {q && hits.length === 0 && (
              <p className="px-3 py-3 text-sm text-slate-500">No results for &ldquo;{search.trim()}&rdquo;</p>
            )}
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
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(h)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      i === active ? 'bg-accent/10 text-white' : 'text-slate-300 hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="shrink-0 text-slate-400">{h.icon}</span>
                    <span className="min-w-0 flex-1 truncate">{q ? highlightMatch(h.label, search.trim()) : h.label}</span>
                    {h.hint && (
                      <span className="max-w-[9rem] truncate text-xs text-slate-500">
                        {q ? highlightMatch(h.hint, search.trim()) : h.hint}
                      </span>
                    )}
                    {i === active && <CornerDownLeft size={13} className="shrink-0 text-slate-500" />}
                  </button>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-3 border-t border-edge px-3 py-2 text-[10px] text-slate-500">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>Esc clear</span>
            {!q && <span className="ml-auto text-slate-600">Ctrl+K commands</span>}
          </div>
        </div>
      )}
    </div>
  )
}
