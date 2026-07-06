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
  FolderKanban,
  Link2,
} from 'lucide-react'
import { api } from '../lib/ipc'
import { useApp } from '../state/store'
import { notify } from '../state/notifications'
import { confirmAction } from '../state/confirm'
import { timeAgo } from '../lib/format'
import { PageSection, PageSubsection, PageDivider } from '../components/PageSection'
import { ContentReveal, Skeleton } from '../components/Skeleton'
import type { DbConnection, DbKind, SslMode, ConnectionTestResult, ApplyEnvResult, DbContainer, Project } from '../shared/types'

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

function engineLabel(kind: DbKind) {
  return kind === 'postgres' ? 'PostgreSQL' : 'MySQL'
}

const inputCls =
  'w-full rounded-lg border border-edge bg-bg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-accent/60'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">{hint}</p>}
    </div>
  )
}

function EngineBadge({ kind }: { kind: DbKind }) {
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
        kind === 'postgres' ? 'bg-sky-500/15 text-sky-400' : 'bg-amber-500/15 text-amber-400'
      }`}
    >
      {kind === 'postgres' ? 'PG' : 'SQL'}
    </span>
  )
}

function ConnectionListItem({
  connection: c,
  selected,
  projectName,
  onSelect,
}: {
  connection: DbConnection
  selected: boolean
  projectName?: string
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        selected
          ? 'border-accent/50 bg-panel shadow-sm shadow-accent/5'
          : 'border-edge bg-panel2 hover:border-slate-600 hover:bg-panel'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <EngineBadge kind={c.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">{c.name}</span>
            {c.lastTest && (
              <span
                title={`${c.lastTest.message} · ${timeAgo(c.lastTest.testedAt)}`}
                className={`h-2 w-2 shrink-0 rounded-full ${c.lastTest.ok ? 'bg-emerald-400' : 'bg-rose-500'}`}
              />
            )}
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">
            {c.host}:{c.port}/{c.database || '—'}
          </p>
          {projectName ? (
            <span className="mt-2 inline-flex max-w-full items-center gap-1 truncate rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
              <FolderKanban size={11} className="shrink-0" />
              {projectName}
            </span>
          ) : (
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-600">Not attached</span>
          )}
        </div>
      </div>
    </button>
  )
}

function ConnectionListGroup({
  title,
  connections,
  projects,
  selectedId,
  onSelect,
}: {
  title: string
  connections: DbConnection[]
  projects: Project[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  if (connections.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{title}</p>
      {connections.map((c) => (
        <ConnectionListItem
          key={c.id}
          connection={c}
          selected={selectedId === c.id}
          projectName={projects.find((p) => p.id === c.projectId)?.name}
          onSelect={() => onSelect(c.id)}
        />
      ))}
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
  const [listReady, setListReady] = useState(false)

  useEffect(() => {
    api.listConnections().then((list) => {
      setConnections(list)
      if (list.length > 0) setSelectedId(list[0].id)
    }).finally(() => setListReady(true))
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
    notify('success', 'Connection saved', draft.name)
  }

  async function test() {
    if (!draft) return
    setTesting(true)
    setTestResult(null)
    const res = await api.testConnection(draft)
    setTesting(false)
    setTestResult(res)
    if (res.ok) notify('success', 'Connection test passed', `${draft.name} · ${res.latencyMs}ms`)
    else notify('error', 'Connection test failed', res.message)
  }

  async function apply() {
    if (!draft) return
    await save()
    const res = await api.applyConnection(draft)
    setApplyResult(res)
    if (res.ok) notify('success', 'Applied to project', `${draft.envVarName} written to ${res.file ?? draft.envFile}`)
    else notify('error', 'Could not apply connection', res.error)
  }

  async function remove() {
    if (!draft) return
    const ok = await confirmAction({
      title: 'Delete connection?',
      message: `"${draft.name}" will be removed from DevFlow. This does not affect your database server.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    const name = draft.name
    const list = await api.removeConnection(draft.id)
    setConnections(list)
    setSelectedId(list[0]?.id ?? '')
    notify('info', 'Connection deleted', name)
  }

  const attachedProject = projects.find((p) => p.id === draft?.projectId)
  const attachedConnections = connections.filter((c) => c.projectId)
  const standaloneConnections = connections.filter((c) => !c.projectId)

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-edge px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white">Connections</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
              Store database credentials, verify connectivity, and write a connection string into a project env file.
            </p>
          </div>
          <button
            onClick={addNew}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg hover:bg-cyan-300"
          >
            <Plus size={15} /> New connection
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-edge bg-panel2/40 p-4">
          <ContentReveal
            loading={!listReady}
            skeleton={
              <div className="flex flex-col gap-3">
                <Skeleton className="h-3 w-32" />
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="rounded-xl border border-edge bg-panel2 p-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="mt-2 h-3 w-full" />
                    <Skeleton className="mt-3 h-5 w-20 rounded-md" />
                  </div>
                ))}
              </div>
            }
          >
          {connections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-edge bg-panel2 p-5 text-center">
              <Plug size={28} className="mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-medium text-slate-300">No connections yet</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Create one manually or import credentials from a running Docker container.
              </p>
              <button
                onClick={addNew}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-xs font-medium text-slate-300 hover:border-accent/50"
              >
                <Plus size={13} /> Create connection
              </button>
            </div>
          ) : (
            <>
              <ConnectionListGroup
                title="Attached to projects"
                connections={attachedConnections}
                projects={projects}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              <ConnectionListGroup
                title="Saved connections"
                connections={standaloneConnections}
                projects={projects}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </>
          )}
          </ContentReveal>

          {containers.length > 0 && (
            <div className="mt-auto rounded-xl border border-edge bg-panel p-4">
              <div className="mb-3 flex items-center gap-2">
                <Container size={15} className="text-slate-500" />
                <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Import from Docker</h3>
              </div>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-600">
                Pull host, port and credentials from a running database container.
              </p>
              <div className="flex flex-col gap-2">
                {containers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => importFromContainer(c)}
                    className="flex items-center gap-2 rounded-lg border border-edge bg-panel2 px-3 py-2.5 text-left text-sm transition-colors hover:border-accent/40 hover:bg-panel"
                  >
                    <EngineBadge kind={c.kind} />
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-200">{c.name}</span>
                    <span className="shrink-0 text-xs text-slate-500">:{c.hostPort ?? '—'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="relative min-w-0 flex-1 overflow-y-auto">
          {!listReady ? (
            <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
              <Skeleton className="h-12 w-full rounded-xl" />
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="rounded-xl border border-edge bg-panel p-6">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-4 h-3 w-full max-w-md" />
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <Skeleton className="h-10 w-full rounded-lg" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : draft ? (
            <>
              <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 pb-24 animate-content-in">
              <div className="rounded-xl border border-edge bg-panel2/50 px-4 py-3">
                <p className="text-xs leading-relaxed text-slate-500">
                  <span className="font-medium text-slate-400">Workflow:</span> configure server details →{' '}
                  <span className="text-slate-400">Test connection</span> → <span className="text-slate-400">Save</span> → attach a
                  project and <span className="text-slate-400">Apply to project</span> to write the env variable.
                </p>
              </div>

              <PageSection
                title="Overview"
                description="Give the connection a name and optionally link it to a project before applying."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Connection name">
                    <input value={draft.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Attach to project" hint="Required to write DATABASE_URL (or your chosen variable) into the project.">
                    <select
                      value={draft.projectId ?? ''}
                      onChange={(e) => set('projectId', e.target.value || undefined)}
                      className={inputCls}
                    >
                      <option value="">Not attached</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {attachedProject && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-sm text-emerald-300">
                    <Link2 size={15} className="shrink-0" />
                    Will apply to <span className="font-medium">{attachedProject.name}</span>
                  </div>
                )}
              </PageSection>

              <PageSection title="Server" description="Host, port and database name used to reach your database.">
                <PageSubsection title="Connection details">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                        placeholder={draft.kind === 'postgres' ? 'postgres' : '(optional)'}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </PageSubsection>

                <PageDivider />

                <PageSubsection title="Credentials">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Username">
                      <input value={draft.user} onChange={(e) => set('user', e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Password">
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={draft.password}
                          onChange={(e) => set('password', e.target.value)}
                          className={inputCls + ' pr-10'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(!showPw)}
                          className="absolute top-2.5 right-3 text-slate-500 hover:text-slate-300"
                          aria-label={showPw ? 'Hide password' : 'Show password'}
                        >
                          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </Field>
                  </div>
                </PageSubsection>

                {testResult && (
                  <>
                    <PageDivider />
                    <div
                      className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${
                        testResult.ok
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                      }`}
                    >
                      {testResult.ok ? (
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                      ) : (
                        <XCircle size={16} className="mt-0.5 shrink-0" />
                      )}
                      <span>
                        <span className="font-semibold">{testResult.method === 'auth' ? 'Credential check' : 'TCP check'}:</span>{' '}
                        {testResult.message}
                        {testResult.ok && ` · ${testResult.latencyMs}ms`}
                        {testResult.ok && (
                          <span className="block text-xs opacity-75">Last tested {timeAgo(testResult.testedAt)}</span>
                        )}
                      </span>
                    </div>
                  </>
                )}
              </PageSection>

              <PageSection title="Advanced" description="SSL, timeouts and extra parameters appended to the connection URL.">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="SSL mode" hint="require = encrypted only">
                    <select value={draft.sslMode} onChange={(e) => set('sslMode', e.target.value as SslMode)} className={inputCls}>
                      <option value="disable">disable</option>
                      <option value="prefer">prefer</option>
                      <option value="require">require</option>
                    </select>
                  </Field>
                  <Field label="Connect timeout (seconds)">
                    <input
                      value={draft.connectTimeout}
                      onChange={(e) => set('connectTimeout', Number(e.target.value.replace(/\D/g, '')) || 0)}
                      className={inputCls}
                    />
                  </Field>
                  <div className="sm:col-span-2 lg:col-span-2">
                    <Field
                      label="Extra URL parameters"
                      hint="Appended to the connection string, e.g. schema=public&application_name=devflow"
                    >
                      <input value={draft.extraParams} onChange={(e) => set('extraParams', e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                </div>
              </PageSection>

              <PageSection
                title="Project integration"
                description="Choose which env file and variable name receive the connection string when you apply."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Environment variable" hint="Written into the project env file on Apply.">
                    <input value={draft.envVarName} onChange={(e) => set('envVarName', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Env file">
                    <select
                      value={draft.envFile}
                      onChange={(e) => set('envFile', e.target.value as DbConnection['envFile'])}
                      className={inputCls}
                    >
                      <option value=".env">.env</option>
                      <option value=".env.local">.env.local</option>
                      <option value=".env.development">.env.development</option>
                    </select>
                  </Field>
                </div>

                <PageDivider />

                <PageSubsection title="Connection string preview">
                  <div className="rounded-xl border border-edge bg-bg p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">{engineLabel(draft.kind)} URL</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(buildConnString(draft, false))
                          setCopied(true)
                          setTimeout(() => setCopied(false), 1500)
                        }}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-accent"
                      >
                        <Copy size={12} /> {copied ? 'Copied!' : 'Copy with password'}
                      </button>
                    </div>
                    <p className="log-font text-xs leading-relaxed break-all text-cyan-300">{buildConnString(draft, !showPw)}</p>
                  </div>
                </PageSubsection>

                {applyResult && (
                  <>
                    <PageDivider />
                    <div
                      className={`rounded-lg border px-4 py-3 text-sm ${
                        applyResult.ok
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                      }`}
                    >
                      {applyResult.ok ? (
                        <>
                          Wrote <span className="font-semibold">{draft.envVarName}</span> to{' '}
                          <span className="log-font">{applyResult.file}</span>
                          {applyResult.previous !== undefined && (
                            <span className="mt-1 block text-xs opacity-75">
                              Previous value was replaced. Restart the project to pick up the change.
                            </span>
                          )}
                        </>
                      ) : (
                        applyResult.error
                      )}
                    </div>
                  </>
                )}
              </PageSection>
              </div>

              <div className="sticky bottom-0 w-full border-t border-edge bg-panel2/95 py-4 backdrop-blur-sm">
                <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 px-6">
                  <button
                    onClick={test}
                    disabled={testing || !draft.host || !draft.port}
                    className="flex items-center gap-2 rounded-lg border border-edge px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-accent/50 disabled:opacity-40"
                  >
                    {testing ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                    Test connection
                  </button>
                  <button
                    onClick={save}
                    className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg hover:bg-cyan-300"
                  >
                    <Save size={15} /> Save
                  </button>
                  <button
                    onClick={apply}
                    disabled={!draft.projectId}
                    title={
                      draft.projectId
                        ? `Write ${draft.envVarName} to ${attachedProject?.name}/${draft.envFile}`
                        : 'Attach a project first'
                    }
                    className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-40"
                  >
                    <FileCog size={15} /> Apply to project
                  </button>
                  {savedMsg && <span className="text-sm text-emerald-400">Saved.</span>}
                  <button
                    onClick={remove}
                    className="ml-auto flex items-center gap-2 rounded-lg border border-edge px-3 py-2.5 text-sm text-slate-500 hover:border-rose-500/50 hover:text-rose-400"
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <Plug size={36} className="text-slate-700" />
              <p className="text-sm font-medium text-slate-400">Select a connection</p>
              <p className="max-w-sm text-xs leading-relaxed text-slate-600">
                Choose one from the list on the left, or create a new connection to get started.
              </p>
              <button
                onClick={addNew}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50"
              >
                <Plus size={14} /> New connection
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
