import { useEffect, useRef, useState } from 'react'
import { Trash2, ArrowDownToLine } from 'lucide-react'
import type { LogLine } from '../shared/types'
import { clockTime } from '../lib/format'

const streamColor: Record<LogLine['stream'], string> = {
  out: 'text-slate-300',
  err: 'text-rose-400',
  sys: 'text-cyan-400',
}

export function LogViewer({
  lines,
  onClear,
  height = 'h-96',
}: {
  lines: LogLine[]
  onClear?: () => void
  height?: string
}) {
  const [filter, setFilter] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  const visible = filter ? lines.filter((l) => l.text.toLowerCase().includes(filter.toLowerCase())) : lines

  useEffect(() => {
    if (autoScroll && ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [visible.length, autoScroll])

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-edge bg-black/40">
      <div className="flex items-center gap-2 border-b border-edge bg-panel2 px-3 py-2">
        <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Live Terminal Logs</span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter..."
          className="ml-auto w-40 rounded-md border border-edge bg-bg px-2 py-1 text-xs text-slate-300 outline-none focus:border-accent/60"
        />
        <button
          title="Auto-scroll"
          onClick={() => setAutoScroll(!autoScroll)}
          className={`rounded-md p-1.5 ${autoScroll ? 'bg-accent/20 text-accent' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <ArrowDownToLine size={14} />
        </button>
        {onClear && (
          <button title="Clear logs" onClick={onClear} className="rounded-md p-1.5 text-slate-500 hover:text-rose-400">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div ref={ref} className={`log-font overflow-y-auto p-3 text-xs leading-5 ${height}`}>
        {visible.length === 0 && <p className="text-slate-600">No log output.</p>}
        {visible.map((l, i) => (
          <div key={i} className="flex gap-3">
            <span className="shrink-0 text-slate-600 select-none">{clockTime(l.ts)}</span>
            <span className={`break-all whitespace-pre-wrap ${streamColor[l.stream]}`}>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
