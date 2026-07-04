import { useEffect, useState } from 'react'
import { Save, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Project, PortCheck } from '../shared/types'
import { api } from '../lib/ipc'
import { useApp } from '../state/store'

export function ProjectSettings({ project }: { project: Project }) {
  const refreshProjects = useApp((s) => s.refreshProjects)
  const [runCommand, setRunCommand] = useState(project.runCommand)
  const [buildCommand, setBuildCommand] = useState(project.buildCommand)
  const [port, setPort] = useState(project.preferredPort ? String(project.preferredPort) : '')
  const [portCheck, setPortCheck] = useState<PortCheck | null>(null)
  const [env, setEnv] = useState<[string, string][]>(Object.entries(project.env))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setRunCommand(project.runCommand)
    setBuildCommand(project.buildCommand)
    setPort(project.preferredPort ? String(project.preferredPort) : '')
    setEnv(Object.entries(project.env))
  }, [project.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const n = Number(port)
    if (!port || !Number.isInteger(n) || n < 1 || n > 65535) {
      setPortCheck(null)
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      const res = await api.checkPort(n, project.id)
      if (!cancelled) setPortCheck(res)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [port, project.id])

  async function save() {
    const envObj: Record<string, string> = {}
    for (const [k, v] of env) if (k.trim()) envObj[k.trim()] = v
    await api.updateProject(project.id, {
      runCommand,
      buildCommand,
      preferredPort: port ? Number(port) : undefined,
      env: envObj,
    })
    await refreshProjects()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const portWarning = portCheck && (!portCheck.free || portCheck.reserved || portCheck.usedByProject)

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold tracking-wider text-slate-400 uppercase">Server &amp; Ports</h3>
        <div className="flex items-start gap-4">
          <div className="w-48">
            <label className="mb-1 block text-xs text-slate-500">Preferred Port</label>
            <input
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
              placeholder={String(project.defaultPort)}
              className={`w-full rounded-lg border bg-bg px-3 py-2 text-sm text-slate-200 outline-none ${
                portWarning ? 'border-rose-500/60' : 'border-edge focus:border-accent/60'
              }`}
            />
          </div>
          <div className="flex-1 pt-6">
            {portCheck &&
              (portWarning ? (
                <p className="flex items-center gap-2 text-sm text-rose-400">
                  <AlertTriangle size={15} />
                  {!portCheck.free
                    ? `Port ${portCheck.port} is currently in use.`
                    : portCheck.reserved
                      ? `Port ${portCheck.port} is reserved by your port rules.`
                      : `Port ${portCheck.port} is assigned to project "${portCheck.usedByProject}".`}
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle2 size={15} /> Available
                </p>
              ))}
            {port && !portWarning && (
              <p className="mt-1 text-xs text-slate-500">Localhost URL preview: http://localhost:{port}/</p>
            )}
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold tracking-wider text-slate-400 uppercase">Project Execution</h3>
        <label className="mb-1 block text-xs text-slate-500">Run Command</label>
        <input
          value={runCommand}
          onChange={(e) => setRunCommand(e.target.value)}
          placeholder="npm run dev"
          className="mb-3 w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
        />
        <label className="mb-1 block text-xs text-slate-500">Build Command</label>
        <input
          value={buildCommand}
          onChange={(e) => setBuildCommand(e.target.value)}
          placeholder="npm run build"
          className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold tracking-wider text-slate-400 uppercase">Environment Variables</h3>
        <div className="flex flex-col gap-2">
          {env.map(([k, v], i) => (
            <div key={i} className="flex gap-2">
              <input
                value={k}
                onChange={(e) => setEnv(env.map((kv, j) => (j === i ? [e.target.value, kv[1]] : kv)))}
                placeholder="KEY"
                className="w-48 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
              />
              <input
                value={v}
                onChange={(e) => setEnv(env.map((kv, j) => (j === i ? [kv[0], e.target.value] : kv)))}
                placeholder="value"
                className="flex-1 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
              />
              <button
                onClick={() => setEnv(env.filter((_, j) => j !== i))}
                className="rounded-lg p-2 text-slate-500 hover:text-rose-400"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setEnv([...env, ['', '']])}
            className="flex w-fit items-center gap-2 rounded-lg border border-edge px-3 py-1.5 text-sm text-slate-300 hover:border-accent/50"
          >
            <Plus size={14} /> Add Variable
          </button>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300"
        >
          <Save size={15} /> Apply Changes
        </button>
        {saved && <span className="text-sm text-emerald-400">Saved. Restart the project to apply.</span>}
      </div>
    </div>
  )
}
