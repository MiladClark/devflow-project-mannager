import { useEffect, useState } from 'react'
import { useApp } from '../state/store'
import { api } from '../lib/ipc'
import { LogViewer } from '../components/LogViewer'
import { FrameworkIcon } from '../components/FrameworkIcon'
import { StatusBadge } from '../components/StatusBadge'

export function Logs() {
  const { projects, runtime, logs, loadLogs } = useApp()
  const [selected, setSelected] = useState<string>('')

  useEffect(() => {
    if (!selected && projects.length > 0) setSelected(projects[0].id)
  }, [projects, selected])

  useEffect(() => {
    if (selected) loadLogs(selected)
  }, [selected, loadLogs])

  return (
    <div className="flex h-full gap-4 p-6">
      <div className="flex w-64 shrink-0 flex-col gap-2">
        <h2 className="mb-1 text-2xl font-bold text-white">Logs</h2>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
              selected === p.id ? 'border-accent/60 bg-panel text-white' : 'border-edge bg-panel2 text-slate-400 hover:text-slate-200'
            }`}
          >
            <FrameworkIcon framework={p.framework} size={6} />
            <span className="flex-1 truncate">{p.name}</span>
            <StatusBadge status={runtime[p.id]?.status ?? 'stopped'} />
          </button>
        ))}
        {projects.length === 0 && <p className="text-sm text-slate-600">No projects.</p>}
      </div>
      <div className="min-w-0 flex-1 pt-11">
        {selected ? (
          <LogViewer
            lines={logs[selected] ?? []}
            onClear={() => api.clearLogs(selected).then(() => loadLogs(selected))}
            height="h-[calc(100vh-14rem)]"
          />
        ) : (
          <p className="text-sm text-slate-500">Select a project to view its logs.</p>
        )}
      </div>
    </div>
  )
}
