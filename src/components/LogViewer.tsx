import { useEffect, useRef, useState } from 'react'
import { Trash2, ArrowDownToLine } from 'lucide-react'
import type { LogLine } from '../shared/types'
import { clockTime } from '../lib/format'

const streamClass: Record<LogLine['stream'], string> = {
  out: 'app-log-out',
  err: 'app-log-err',
  sys: 'app-log-sys',
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
    <div className="app-log-viewer">
      <div className="app-log-header">
        <span className="app-log-title">Live Terminal Logs</span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter..."
          className="app-log-filter"
        />
        <button
          title="Auto-scroll"
          onClick={() => setAutoScroll(!autoScroll)}
          className={`app-log-btn ${autoScroll ? 'app-log-btn-active' : ''}`}
        >
          <ArrowDownToLine size={14} />
        </button>
        {onClear && (
          <button title="Clear logs" onClick={onClear} className="app-log-btn app-log-btn-clear">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div ref={ref} className={`app-log-body ${height}`}>
        {visible.length === 0 && <p className="app-log-empty">No log output.</p>}
        {visible.map((l, i) => (
          <div key={i} className="app-log-line">
            <span className="app-log-time">{clockTime(l.ts)}</span>
            <span className={`min-w-0 flex-1 break-all whitespace-pre-wrap ${streamClass[l.stream]}`}>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
