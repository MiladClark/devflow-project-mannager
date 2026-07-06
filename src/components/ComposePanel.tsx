import { useEffect, useState } from 'react'
import { Play, Square, RotateCcw, Loader2, Container } from 'lucide-react'
import { api } from '../lib/ipc'
import { notify } from '../state/notifications'
import { LogViewer } from './LogViewer'
import type { ComposeStatus, LogLine } from '../shared/types'

export function ComposePanel({ projectId }: { projectId: string }) {
  const [file, setFile] = useState<string | null>(null)
  const [status, setStatus] = useState<ComposeStatus | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogLine[]>([])

  async function refresh() {
    const f = await api.composeDetect(projectId)
    setFile(f)
    if (f) setStatus(await api.composePs(projectId))
    else setStatus(null)
  }

  useEffect(() => {
    void refresh()
    return api.onComposeLog((line) => {
      const l = line as LogLine
      setLogs((prev) => [...prev.slice(-500), l])
    })
  }, [projectId])

  async function act(kind: 'up' | 'down' | 'logs') {
    setBusy(kind)
    if (kind === 'up') {
      const res = await api.composeUp(projectId)
      if (!res.ok) notify('error', 'Compose up failed', res.error)
      else notify('success', 'Stack started', file ?? 'docker compose')
    } else if (kind === 'down') {
      const res = await api.composeDown(projectId)
      if (!res.ok) notify('error', 'Compose down failed', res.error)
    } else {
      await api.composeLogs(projectId)
    }
    setBusy(null)
    await refresh()
  }

  if (!file) {
    return (
      <p className="text-sm text-slate-500">
        No docker-compose.yml or compose.yml found in this project root.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-sm text-slate-400">
          <Container size={15} className="text-accent" />
          {file}
          {status?.running && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">running</span>}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void act('up')}
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-accent/50 disabled:opacity-40"
          >
            {busy === 'up' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Up
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void act('down')}
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-accent/50 disabled:opacity-40"
          >
            {busy === 'down' ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} />} Down
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void refresh()}
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs text-slate-400 hover:border-accent/50"
          >
            <RotateCcw size={13} /> Refresh
          </button>
        </div>
      </div>

      {status && status.services.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-edge">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel2 text-xs tracking-wider text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-2 font-semibold">Service</th>
                <th className="px-4 py-2 font-semibold">State</th>
                <th className="px-4 py-2 font-semibold">Ports</th>
              </tr>
            </thead>
            <tbody>
              {status.services.map((s) => (
                <tr key={s.name} className="border-t border-edge bg-panel">
                  <td className="px-4 py-2.5 text-white">{s.name}</td>
                  <td className="px-4 py-2.5 text-slate-400">{s.state}</td>
                  <td className="select-text px-4 py-2.5 font-mono text-xs text-slate-500">{s.ports || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logs.length > 0 && <LogViewer lines={logs} height="h-48" />}
    </div>
  )
}
