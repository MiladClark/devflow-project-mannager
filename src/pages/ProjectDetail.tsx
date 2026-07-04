import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Play, Square, RotateCcw, Hammer, FolderOpen, ArrowLeft, ExternalLink, PackageOpen } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts'
import { useApp } from '../state/store'
import { api } from '../lib/ipc'
import { FrameworkIcon } from '../components/FrameworkIcon'
import { StatusBadge } from '../components/StatusBadge'
import { LogViewer } from '../components/LogViewer'
import { formatBytes } from '../lib/format'
import { ProjectSettings } from '../components/ProjectSettings'

type Tab = 'logs' | 'monitor' | 'settings'

export function ProjectDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { projects, runtime, logs, projectStats, projectHistory, loadLogs } = useApp()
  const [tab, setTab] = useState<Tab>('logs')
  const [actionError, setActionError] = useState('')

  const project = projects.find((p) => p.id === id)
  const rt = runtime[id] ?? { status: 'stopped' as const }
  const busy = rt.status === 'running' || rt.status === 'starting' || rt.status === 'building'
  const stats = projectStats[id]
  const history = projectHistory[id] ?? []

  useEffect(() => {
    if (id) loadLogs(id)
  }, [id, loadLogs])

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Project not found.</p>
      </div>
    )
  }

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setActionError('')
    const res = await fn()
    if (!res.ok && res.error) setActionError(res.error)
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <button onClick={() => navigate(-1)} className="flex w-fit items-center gap-1 text-sm text-slate-500 hover:text-slate-300">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="flex items-center gap-4">
        <FrameworkIcon framework={project.framework} size={11} />
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-white">{project.name}</h2>
          <p className="truncate text-sm text-slate-500">
            {project.path} · {project.frameworks.join(' + ')}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <StatusBadge status={rt.status} />
          {rt.url && (
            <button onClick={() => api.openExternal(rt.url!)} className="flex items-center gap-1 text-sm text-accent hover:underline">
              {rt.url} <ExternalLink size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {busy ? (
          <>
            <button
              onClick={() => act(() => api.stopProject(id))}
              className="flex items-center gap-2 rounded-lg bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-400 hover:bg-rose-500/25"
            >
              <Square size={15} /> Stop
            </button>
            {rt.status !== 'building' && (
              <button
                onClick={() => act(() => api.restartProject(id))}
                className="flex items-center gap-2 rounded-lg bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/25"
              >
                <RotateCcw size={15} /> Restart
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => act(() => api.startProject(id))}
              disabled={!project.runCommand}
              className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-40"
            >
              <Play size={15} /> Start
            </button>
            <button
              onClick={() => act(() => api.buildProject(id))}
              disabled={!project.buildCommand}
              className="flex items-center gap-2 rounded-lg bg-accent/15 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/25 disabled:opacity-40"
            >
              <Hammer size={15} /> Build
            </button>
          </>
        )}
        <button
          onClick={() => api.openFolder(id)}
          className="flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50"
        >
          <FolderOpen size={15} /> Open Folder
        </button>
        <button
          onClick={() => api.openOutput(id)}
          className="flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50"
        >
          <PackageOpen size={15} /> Output Folder
        </button>
      </div>

      {actionError && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">{actionError}</div>
      )}

      <div className="flex gap-1 border-b border-edge">
        {(['logs', 'monitor', 'settings'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? 'border-b-2 border-accent text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'logs' && (
        <LogViewer lines={logs[id] ?? []} onClear={() => api.clearLogs(id).then(() => loadLogs(id))} height="h-[28rem]" />
      )}

      {tab === 'monitor' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-edge bg-panel p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">CPU Usage</span>
              <span className="font-semibold text-white">{stats ? `${stats.cpu.toFixed(1)}%` : '--'}</span>
            </div>
            <div className="mt-2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: '#101a2e', border: '1px solid #1d2a44', borderRadius: 8 }}
                    labelFormatter={() => ''}
                    formatter={(v: number) => [`${v.toFixed(1)}%`, 'CPU']}
                  />
                  <Area type="monotone" dataKey="cpu" stroke="#22d3ee" fill="#22d3ee22" strokeWidth={2} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-edge bg-panel p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Memory Usage</span>
              <span className="font-semibold text-white">{stats ? formatBytes(stats.mem) : '--'}</span>
            </div>
            <div className="mt-2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: '#101a2e', border: '1px solid #1d2a44', borderRadius: 8 }}
                    labelFormatter={() => ''}
                    formatter={(v: number) => [formatBytes(v), 'Memory']}
                  />
                  <Area type="monotone" dataKey="mem" stroke="#34d399" fill="#34d39922" strokeWidth={2} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          {!busy && (
            <p className="col-span-2 text-center text-sm text-slate-500">
              Start the project to see live CPU and memory usage of its process tree.
            </p>
          )}
        </div>
      )}

      {tab === 'settings' && <ProjectSettings project={project} />}
    </div>
  )
}
