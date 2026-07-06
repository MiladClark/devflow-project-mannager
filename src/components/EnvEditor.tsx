import { useCallback, useEffect, useState } from 'react'
import { Eye, EyeOff, Plus, Trash2, Save, RefreshCw, AlertTriangle, FileText, Loader2 } from 'lucide-react'
import { api, isElectron } from '../lib/ipc'
import { SkeletonEnvEditor } from './Skeleton'
import type { EnvFileInfo, EnvLine } from '../shared/types'

export function EnvEditor({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<EnvFileInfo[]>([])
  const [selected, setSelected] = useState('')
  const [lines, setLines] = useState<EnvLine[]>([])
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [revealAll, setRevealAll] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const loadFiles = useCallback(async () => {
    const list = await api.listEnvFiles(projectId)
    setFiles(list)
    if (list.length > 0 && !list.some((f) => f.name === selected)) {
      setSelected(list[0].name)
    }
    if (list.length === 0) setSelected('')
  }, [projectId, selected])

  useEffect(() => {
    loadFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const loadContent = useCallback(async () => {
    if (!selected) {
      setLines([])
      return
    }
    setLoading(true)
    setMessage(null)
    const res = await api.readEnvFile(projectId, selected)
    setLoading(false)
    setDirty(false)
    setRevealed(new Set())
    setRevealAll(false)
    if (res.ok && res.lines) setLines(res.lines)
    else {
      setLines([])
      setMessage({ ok: false, text: res.error ?? 'Could not read file' })
    }
  }, [projectId, selected])

  useEffect(() => {
    loadContent()
  }, [loadContent])

  function updatePair(i: number, patch: Partial<EnvLine>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
    setDirty(true)
  }

  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, j) => j !== i))
    setDirty(true)
  }

  function addPair() {
    setLines((ls) => [...ls, { type: 'pair', key: '', value: '', raw: '' }])
    setDirty(true)
  }

  async function save() {
    const cleaned = lines.filter((l) => l.type !== 'pair' || (l.key ?? '').trim() !== '')
    const res = await api.writeEnvFile(projectId, selected, cleaned)
    if (res.ok) {
      setMessage({ ok: true, text: `Saved${res.backupPath ? ` — previous version kept as ${res.backupPath.split('\\').pop()}` : ''}` })
      setDirty(false)
      loadFiles()
    } else {
      setMessage({ ok: false, text: res.error ?? 'Save failed' })
    }
  }

  async function createEnvFile() {
    const res = await api.writeEnvFile(projectId, '.env', [
      { type: 'comment', raw: '# Environment variables' },
    ])
    if (res.ok) {
      await loadFiles()
      setSelected('.env')
    } else {
      setMessage({ ok: false, text: res.error ?? 'Could not create .env' })
    }
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-edge p-8">
        <p className="text-sm text-slate-500">No .env files found in the project root.</p>
        <button
          onClick={createEnvFile}
          disabled={!isElectron}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-40"
        >
          <Plus size={14} /> Create .env
        </button>
      </div>
    )
  }

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <div className="flex items-center gap-2">
        <FileText size={15} className="text-slate-500" />
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-lg border border-edge bg-bg px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-accent/60"
        >
          {files.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
        <button
          onClick={loadContent}
          title="Reload from disk"
          className="rounded-lg border border-edge p-1.5 text-slate-400 hover:text-accent"
        >
          <RefreshCw size={14} />
        </button>
        <button
          onClick={() => {
            setRevealAll(!revealAll)
            setRevealed(new Set())
          }}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs text-slate-300 hover:border-accent/50"
        >
          {revealAll ? <EyeOff size={13} /> : <Eye size={13} />} {revealAll ? 'Mask values' : 'Reveal all'}
        </button>
      </div>

      {loading ? (
        <SkeletonEnvEditor />
      ) : (
        <div className="animate-content-in flex flex-col gap-1.5 rounded-xl border border-edge bg-panel p-3">
          {lines.map((l, i) => {
            if (l.type === 'pair') {
              const show = revealAll || revealed.has(i)
              return (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={l.key ?? ''}
                    onChange={(e) => updatePair(i, { key: e.target.value.replace(/[^A-Za-z0-9_.]/g, '') })}
                    placeholder="KEY"
                    className="w-56 rounded-lg border border-edge bg-bg px-3 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-accent/60"
                  />
                  <input
                    type={show ? 'text' : 'password'}
                    value={l.value ?? ''}
                    onChange={(e) => updatePair(i, { value: e.target.value })}
                    placeholder="value"
                    className="min-w-0 flex-1 rounded-lg border border-edge bg-bg px-3 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-accent/60"
                  />
                  <button
                    onClick={() =>
                      setRevealed((s) => {
                        const n = new Set(s)
                        if (n.has(i)) n.delete(i)
                        else n.add(i)
                        return n
                      })
                    }
                    className="text-slate-500 hover:text-slate-300"
                  >
                    {show ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => removeLine(i)} className="text-slate-500 hover:text-rose-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            }
            if (l.type === 'comment') {
              return (
                <p key={i} className="px-1 font-mono text-xs text-emerald-600/70">
                  {l.raw}
                </p>
              )
            }
            if (l.type === 'raw') {
              return (
                <p key={i} className="px-1 font-mono text-xs text-slate-500">
                  {l.raw}
                </p>
              )
            }
            return <div key={i} className="h-1.5" />
          })}

          <button
            onClick={addPair}
            className="mt-1 flex w-fit items-center gap-2 rounded-lg border border-edge px-3 py-1.5 text-xs text-slate-300 hover:border-accent/50"
          >
            <Plus size={13} /> Add variable
          </button>
        </div>
      )}

      {message && (
        <p className={`flex items-center gap-2 text-sm ${message.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
          {!message.ok && <AlertTriangle size={14} />}
          {message.text}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || !isElectron}
          className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-40"
        >
          <Save size={14} /> Save {selected}
        </button>
        {dirty && <span className="text-xs text-amber-300">Unsaved changes</span>}
      </div>
    </div>
  )
}
