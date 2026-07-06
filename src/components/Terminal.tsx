import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { api } from '../lib/ipc'
import '@xterm/xterm/css/xterm.css'

/** Mounts an xterm view attached to an existing main-process PTY session. */
export function TerminalView({ sessionId, onExit }: { sessionId: string; onExit: (code: number) => void }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new XTerm({
      fontFamily: '"Cascadia Mono", Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      theme: {
        background: '#0a0f1d',
        foreground: '#cbd5e1',
        cursor: '#22d3ee',
        selectionBackground: '#334155',
      },
      scrollback: 4000,
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    fit.fit()

    // replay scrollback kept in main, then live-stream
    let disposed = false
    api.termGetBuffer(sessionId).then((buf) => {
      if (!disposed && buf) term.write(buf)
    })

    const unData = api.onTermData((id, data) => {
      if (id === sessionId) term.write(data)
    })
    const unExit = api.onTermExit((id, code) => {
      if (id === sessionId) {
        term.write(`\r\n\x1b[90m[process exited with code ${code}]\x1b[0m\r\n`)
        onExit(code)
      }
    })

    const onData = term.onData((data) => api.termWrite(sessionId, data))
    const onResize = term.onResize(({ cols, rows }) => api.termResize(sessionId, cols, rows))

    const observer = new ResizeObserver(() => {
      try {
        fit.fit()
      } catch {
        /* container hidden */
      }
    })
    observer.observe(host)

    // initial size sync
    api.termResize(sessionId, term.cols, term.rows)
    term.focus()

    return () => {
      disposed = true
      observer.disconnect()
      unData()
      unExit()
      onData.dispose()
      onResize.dispose()
      term.dispose()
    }
  }, [sessionId, onExit])

  return <div ref={hostRef} className="h-full w-full overflow-hidden rounded-lg bg-[#0a0f1d] p-1.5" />
}
