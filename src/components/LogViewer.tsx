import { useEffect, useRef, useState } from 'react'
import { Trash2, ArrowDownToLine, Copy, Check, CornerDownLeft } from 'lucide-react'
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
  onInput,
  inputPlaceholder = 'Type here to answer the installer…',
  height = 'h-96',
}: {
  lines: LogLine[]
  onClear?: () => void
  /** When provided, an input line is shown and what the user types is sent to the running process. */
  onInput?: (data: string) => void
  inputPlaceholder?: string
  height?: string
}) {
  const [filter, setFilter] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [copied, setCopied] = useState(false)
  const [input, setInput] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const visible = filter ? lines.filter((l) => l.text.toLowerCase().includes(filter.toLowerCase())) : lines

  useEffect(() => {
    if (autoScroll && ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [visible.length, autoScroll])

  const copyAll = async () => {
    // Copy the selection if there is one, otherwise the whole (filtered) log.
    const selection = window.getSelection()?.toString()
    const text = selection?.trim()
      ? selection
      : visible.map((l) => `${clockTime(l.ts)}  ${l.text}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard unavailable */
    }
  }

  const submit = () => {
    if (!onInput) return
    onInput(input + '\r')
    setInput('')
  }

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
          title={copied ? 'Copied' : 'Copy selection or all output'}
          onClick={copyAll}
          className={`app-log-btn ${copied ? 'app-log-btn-active' : ''}`}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
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
      {onInput && (
        <div className="app-log-input-row">
          <span className="app-log-prompt">$</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
            placeholder={inputPlaceholder}
            spellCheck={false}
            autoComplete="off"
            className="app-log-input"
          />
          <button title="Send (Enter)" onClick={submit} className="app-log-btn">
            <CornerDownLeft size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
