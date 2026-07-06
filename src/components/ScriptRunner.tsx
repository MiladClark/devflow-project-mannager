import { useEffect, useState } from 'react'
import { Play, Loader2, Pin } from 'lucide-react'
import { api } from '../lib/ipc'
import { notify } from '../state/notifications'
import type { Project, ProjectScript } from '../shared/types'

export function ScriptRunner({ project }: { project: Project }) {
  const [scripts, setScripts] = useState<ProjectScript[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const pinned = new Set(project.pinnedScripts ?? [])

  useEffect(() => {
    api.listScripts(project.id).then(setScripts)
  }, [project.id, project.path])

  async function run(name: string) {
    setBusy(name)
    const res = await api.runScript(project.id, name)
    setBusy(null)
    if (!res.ok && res.error) notify('error', `Script: ${name}`, res.error)
    else notify('info', `Running ${name}`, 'See Logs tab for output.')
  }

  const sorted = [...scripts].sort((a, b) => {
    const ap = pinned.has(a.name) ? 0 : 1
    const bp = pinned.has(b.name) ? 0 : 1
    if (ap !== bp) return ap - bp
    return a.name.localeCompare(b.name)
  })

  if (sorted.length === 0) {
    return <p className="text-sm text-slate-500">No additional npm scripts found in package.json.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-slate-500">Run npm scripts from package.json. Output appears in the Logs tab.</p>
      <div className="overflow-hidden rounded-xl border border-edge">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel2 text-xs tracking-wider text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Script</th>
              <th className="px-4 py-2.5 font-semibold">Command</th>
              <th className="px-4 py-2.5 text-right font-semibold">Run</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.name} className="border-t border-edge bg-panel">
                <td className="px-4 py-3 font-medium text-white">
                  <span className="flex items-center gap-2">
                    {pinned.has(s.name) && <Pin size={12} className="text-accent" />}
                    {s.name}
                  </span>
                </td>
                <td className="select-text px-4 py-3 font-mono text-xs text-slate-400">{s.command}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void run(s.name)}
                    className="press inline-flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-accent/50 disabled:opacity-40"
                  >
                    {busy === s.name ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                    Run
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
