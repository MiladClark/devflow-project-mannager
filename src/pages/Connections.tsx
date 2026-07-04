import { useEffect, useState } from 'react'
import {
  Plug,
  Plus,
  Trash2,
  Save,
  Eye,
  EyeOff,
  Copy,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  FileCog,
  Container,
} from 'lucide-react'
import { api } from '../lib/ipc'
import { useApp } from '../state/store'
import { timeAgo } from '../lib/format'
import type { DbConnection, DbKind, SslMode, ConnectionTestResult, ApplyEnvResult, DbContainer } from '../shared/types'

function newConnection(): DbConnection {
  return {
    id: crypto.randomUUID(),
    name: 'New connection',
    projectId: undefined,
    kind: 'postgres',
    host: '127.0.0.1',
    port: 5432,
    database: '',
    user: 'postgres',
    password: '',
    sslMode: 'prefer',
    connectTimeout: 5,
    extraParams: '',
    envVarName: 'DATABASE_URL',
    envFile: '.env',
    createdAt: Date.now(),
  }
}

function buildConnString(c: DbConnection, mask: boolean): string {
  const pw = mask ? '****' : encodeURIComponent(c.password)
  const db = c.database || (c.kind === 'postgres' ? 'postgres' : '')
  const params: string[] = []
  if (c.kind === 'postgres') {
    if (c.sslMode !== 'prefer') params.push(`sslmode=${c.sslMode}`)
    if (c.connectTimeout) params.push(`connect_timeout=${c.connectTimeout}`)
  } else {
    if (c.sslMode === 'require') params.push('ssl=true')
    if (c.connectTimeout) params.push(`connectTimeout=${c.connectTimeout * 1000}`)
  }
  if (c.extraParams.trim()) params.push(c.extraParams.trim())
  const scheme = c.kind === 'postgres' ? 'postgresql' : 'mysql'
  return `${scheme}://${encodeURIComponent(c.user)}:${pw}@${c.host}:${c.port}/${db}${params.length ? '?' + params.join('&') : ''}`
}

const inputCls =
  'w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-600">{hint}</p>}
    </div>
  )
}

export function Connections() {
  const projects = useApp((s) => s.projects)
  const [connections, setConnections] = useState<DbConnection[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<DbConnection | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)
  const [applyResult, setApplyResult] = useState<ApplyEnvResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [containers, setContainers] = useState<DbContainer[]>([])

  useEffect(() => {
    api.listConnections().then((list) => {
      setConnections(list)
      if (list.length > 0) setSelectedId(list[0].id)
    })
    api.dockerStatus().then((st) => {
      if (st.running) api.dockerContainers().then(setContainers)
    })
    return api.onConnectionsChanged(setConnections)
  }, [])

  useEffect(() => {
    const conn = connections.find((c) => c.id === selectedId)
    setDraft(conn ? { ...conn } : null)
    setTestResult(conn?.lastTest ?? null)
    setApplyResult(null)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof DbConnection>(key: K, value: DbConnection[K]) {
    if (draft) setDraft({ ...draft, [key]: value })
  }

  function addNew() {
    const c = newConnection()
    setConnections((l) => [...l, c])
    setSelectedId(c.id)
    setDraft(c)
    setTestResult(null)
  }

  function importFromContainer(container: DbContainer) {
    const c: DbConnection = {
      ...newConnection(),
      name: container.name,
      kind: container.kind,
      host: '127.0.0.1',
      port: container.hostPort ?? (container.kind === 'postgres' ? 5432 : 3306),
      user: container.user,
      password: container.password ?? '',
      database: container.kind === 'postgres' ? 'postgres' : '',
    }
    setConnections((l) => [...l, c])
    setSelectedId(c.id)
    setDraft(c)
    setTestResult(null)
  }

  async function save() {
    if (!draft) return
    const list = await api.saveConnection(draft)
    setConnections(list)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  async function test() {
    if (!draft) return
    setTesting(true)
    setTestResult(null)
    const res = await api.testConnection(draft)
    setTesting(false)
    setTestResult(res)
  }

  async function apply() {
    if (!draft) return
    await save()
    const res = await api.applyConnection(draft)
    setApplyResult(res)
  }

  async function remove() {
    if (!draft) return
    if (!confirm(`Delete connection "${draft.name}"?`)) return
    const list = await api.removeConnection(draft.id)
    setConnections(list)
    setSelectedId(list[0]?.id ?? '')
  }

  const attachedProject = projects.find((p) => p.id === draft?.projectId)

  return (
    <div className="flex h-full gap-5 p-6">
      {/* connection list */}
      <div className="flex w-72 shrink-0 flex-col gap-2">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Connections</h2>
          <button
            onClick={addNew}
            title="New connection"
            className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-cyan-300"
          >
            <Plus size={14} /> New
          </button>
        </div>

        {connections.map((c) => {
          const proj = projects.find((p) => p.id === c.projectId)
          return (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left ${
                selectedId === c.id ? 'border-accent/60 bg-panel' : 'border-edge bg-panel2 hover:border-slate-600'
              }`}
            >
              <Plug size={15} className={c.kind === 'postgres' ? 'text-sky-400' : 'text-amber-400'} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-white">{c.name}</span>
                <span className="block truncate text-xs text-slate-500">
                  {c.host}:{c.port}/{c.database || '—'} {proj ? `→ ${proj.name}` : ''}
                </span>
              </span>
              {c.lastTest && (
                <span
                  title={`${c.lastTest.message} (${timeAgo(c.lastTest.testedAt)})`}
                  className={`h-2 w-2 shrink-0 rounded-full ${c.lastTest.ok ? 'bg-emerald-400' : 'bg-rose-500'}`}
                />
              )}
            </button>
          )
        })}
        {connections.length === 0 && (
          <p className="rounded-lg border border-dashed border-edge p-4 text-xs text-slate-500">
            No connections yet. Create one or import from a Docker container below.
          </p>
        )}

        {containers.length > 0 && (
          <>
            <p className="mt-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">Import from Docker</p>
            {containers.map((c) => (
              <button
                key={c.id}
                onClick={() => importFromContainer(c)}
                className="flex items-center gap-2 rounded-lg border border-edge bg-panel2 px-3 py-2 text-left text-sm text-slate-300 hover:border-accent/50"
              >
                <Container size={14} className="text-slate-500" />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="text-xs text-slate-600">:{c.hostPort ?? '—'}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* detail form */}
      {draft ? (
        <div className="flex min-w-0 max-w-3xl flex-1 flex-col gap-5 overflow-y-auto pb-6">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Connection Name">
              <input value={draft.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Attach to Project" hint="Required for writing the env variable into the project.">
              <select
                value={draft.projectId ?? ''}
                onChange={(e) => set('projectId', e.target.value || undefined)}
                className={inputCls}
              >
                <option value="">— not attached —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Server</p>
            <div className="grid grid-cols-4 gap-3">
              <Field label="Engine">
                <select
                  value={draft.kind}
                  onChange={(e) => {
                    const kind = e.target.value as DbKind
                    setDraft({
                      ...draft,
                      kind,
                      port: kind === 'postgres' ? 5432 : 3306,
                      user: kind === 'postgres' ? 'postgres' : 'root',
                    })
                  }}
                  className={inputCls}
                >
                  <option value="postgres">PostgreSQL</option>
                  <option value="mysql">MySQL / MariaDB</option>
                </select>
              </Field>
              <Field label="Host">
                <input value={draft.host} onChange={(e) => set('host', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Port">
                <input
                  value={draft.port}
                  onChange={(e) => set('port', Number(e.target.value.replace(/\D/g, '')) || 0)}
                  className={inputCls}
                />
              </Field>
              <Field label="Database">
                <input
                  value={draft.database}
                  onChange={(e) => set('database', e.target.value)}
                  placeholder={draft.kind === 'postgres' ? 'postgres' : '(none)'}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Credentials</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Username">
                <input value={draft.user} onChange={(e) => set('user', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Password">
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={draft.password}
                    onChange={(e) => set('password', e.target.value)}
                    className={inputCls + ' pr-9'}
                  />
                  <button
                    onClick={() => setShowPw(!showPw)}
                    className="absolute top-2.5 right-3 text-slate-500 hover:text-slate-300"
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Advanced</p>
            <div className="grid grid-cols-4 gap-3">
              <Field label="SSL Mode" hint="require = encrypted only">
                <select value={draft.sslMode} onChange={(e) => set('sslMode', e.target.value as SslMode)} className={inputCls}>
                  <option value="disable">disable</option>
                  <option value="prefer">prefer</option>
                  <option value="require">require</option>
                </select>
              </Field>
              <Field label="Connect Timeout (s)">
                <input
                  value={draft.connectTimeout}
                  onChange={(e) => set('connectTimeout', Number(e.target.value.replace(/\D/g, '')) || 0)}
                  className={inputCls}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Extra URL Params" hint="appended to the connection string, e.g. schema=public&application_name=devflow">
                  <input value={draft.extraParams} onChange={(e) => set('extraParams', e.target.value)} className={inputCls} />
                </Field>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Project Integration</p>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <Field label="Environment Variable" hint="Written into the project env file on Apply.">
                  <input value={draft.envVarName} onChange={(e) => set('envVarName', e.target.value)} className={inputCls} />
                </Field>
              </div>
              <Field label="Env File">
                <select value={draft.envFile} onChange={(e) => set('envFile', e.target.value as DbConnection['envFile'])} className={inputCls}>
                  <option value=".env">.env</option>
                  <option value=".env.local">.env.local</option>
                  <option value=".env.development">.env.development</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-edge bg-panel p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Connection String Preview</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(buildConnString(draft, false))
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-accent"
              >
                <Copy size={12} /> {copied ? 'Copied!' : 'Copy (with password)'}
              </button>
            </div>
            <p className="log-font mt-2 text-xs break-all text-cyan-300">{buildConnString(draft, !showPw)}</p>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
                testResult.ok
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
              }`}
            >
              {testResult.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
              <span>
                <b>{testResult.method === 'auth' ? 'Credential check' : 'TCP check'}:</b> {testResult.message}
                {testResult.ok && ` · ${testResult.latencyMs}ms`}
              </span>
            </div>
          )}

          {applyResult && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                applyResult.ok
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
              }`}
            >
              {applyResult.ok ? (
                <>
                  Wrote <b>{draft.envVarName}</b> to <span className="log-font">{applyResult.file}</span>
                  {applyResult.previous !== undefined && (
                    <span className="block text-xs opacity-70">Previous value was replaced. Restart the project to apply.</span>
                  )}
                </>
              ) : (
                applyResult.error
              )}
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-edge pt-4">
            <button
              onClick={test}
              disabled={testing || !draft.host || !draft.port}
              className="flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm font-medium text-slate-200 hover:border-accent/50 disabled:opacity-40"
            >
              {testing ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />} Test Connection
            </button>
            <button
              onClick={save}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300"
            >
              <Save size={15} /> Save
            </button>
            <button
              onClick={apply}
              disabled={!draft.projectId}
              title={draft.projectId ? `Write ${draft.envVarName} to ${attachedProject?.name}/${draft.envFile}` : 'Attach a project first'}
              className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-40"
            >
              <FileCog size={15} /> Apply to Project
            </button>
            {savedMsg && <span className="text-sm text-emerald-400">Saved.</span>}
            <button
              onClick={remove}
              className="ml-auto flex items-center gap-2 rounded-lg border border-edge px-3 py-2 text-sm text-slate-500 hover:border-rose-500/50 hover:text-rose-400"
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          Select a connection or create a new one.
        </div>
      )}
    </div>
  )
}
