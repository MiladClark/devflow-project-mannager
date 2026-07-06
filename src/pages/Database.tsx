import { useCallback, useEffect, useState } from 'react'
import {
  Database as DbIcon,
  Play,
  Square,
  RotateCcw,
  Plus,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Wrench, FolderKanban } from 'lucide-react'
import { api, isElectron } from '../lib/ipc'
import { useApp } from '../state/store'
import { notify } from '../state/notifications'
import type { DockerStatus, DbContainer, LogLine, DbKind, DbService, DbConnection } from '../shared/types'
import { LogViewer } from '../components/LogViewer'
import { PageSection } from '../components/PageSection'
import { SkeletonServiceCards } from '../components/Skeleton'

function StateBadge({ state }: { state: DbContainer['state'] }) {
  const running = state === 'running'
  const busy = state === 'restarting' || state === 'created'
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${
        running ? 'text-emerald-400' : busy ? 'text-amber-400' : 'text-slate-400'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${running ? 'bg-emerald-400' : busy ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
      {state}
    </span>
  )
}

function ConnectionCard({ c }: { c: DbContainer }) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const connString =
    c.kind === 'postgres'
      ? `postgresql://${c.user}:${c.password ?? ''}@127.0.0.1:${c.hostPort ?? 5432}/postgres`
      : `mysql://${c.user}:${c.password ?? ''}@127.0.0.1:${c.hostPort ?? 3306}/`

  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <h4 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">Connection Settings</h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <span className="text-slate-500">Service</span>
        <span className="text-white">{c.kind === 'postgres' ? 'PostgreSQL' : 'MySQL'}</span>
        <span className="text-slate-500">Host</span>
        <span className="text-white">127.0.0.1</span>
        <span className="text-slate-500">Port</span>
        <span className="text-white">{c.hostPort ?? '—'}</span>
        <span className="text-slate-500">Username</span>
        <span className="text-white">{c.user}</span>
        <span className="text-slate-500">Password</span>
        <span className="flex items-center gap-2 text-white">
          {c.password ? (show ? c.password : '••••••••') : '—'}
          {c.password && (
            <button onClick={() => setShow(!show)} className="text-slate-500 hover:text-slate-300">
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
        </span>
      </div>
      <button
        onClick={() => {
          navigator.clipboard.writeText(connString)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="mt-3 flex items-center gap-2 rounded-lg border border-edge px-3 py-1.5 text-xs text-slate-300 hover:border-accent/50"
      >
        <Copy size={13} /> {copied ? 'Copied!' : 'Copy connection string'}
      </button>
    </div>
  )
}

function ServiceStateBadge({ state, raw }: { state: DbService['state']; raw: string }) {
  const running = state === 'running'
  const pending = state === 'pending'
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${
        running ? 'text-emerald-400' : pending ? 'text-amber-400' : 'text-slate-400'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${running ? 'bg-emerald-400' : pending ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`}
      />
      {raw}
    </span>
  )
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

function localConnectionsFor(kind: DbKind, connections: DbConnection[]): DbConnection[] {
  return connections.filter((c) => c.kind === kind && LOCAL_HOSTS.has(c.host.toLowerCase()))
}

function UsedByProjects({ connections }: { connections: DbConnection[] }) {
  const projects = useApp((s) => s.projects)
  if (connections.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-slate-500">Used by:</span>
      {connections.map((c) => {
        const project = projects.find((p) => p.id === c.projectId)
        const label = project ? project.name : c.name
        const chip = (
          <span className="inline-flex items-center gap-1 rounded-full border border-edge bg-bg px-2 py-0.5 text-xs text-slate-300">
            <FolderKanban size={11} className="text-accent" />
            {label}
            <span className="text-slate-500">· {c.database}</span>
          </span>
        )
        return project ? (
          <Link key={c.id} to={`/projects/${project.id}`} className="hover:opacity-80" title={`Open ${project.name}`}>
            {chip}
          </Link>
        ) : (
          <span key={c.id}>{chip}</span>
        )
      })}
    </div>
  )
}

function InstallHint({ missing }: { missing: string[] }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm text-slate-300">
      <Wrench size={16} className="mt-0.5 shrink-0 text-sky-400" />
      <p>
        {missing.join(' and ')} {missing.length > 1 ? 'are' : 'is'} not installed as a local Windows service.{' '}
        <Link to="/tools" className="font-semibold text-accent hover:underline">
          Open App and Tools
        </Link>{' '}
        to get the installer or the winget command — or run it in Docker below.
      </p>
    </div>
  )
}

function LocalServices({
  services,
  loaded,
  connections,
  onChanged,
}: {
  services: DbService[]
  loaded: boolean
  connections: DbConnection[]
  onChanged: () => void
}) {
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function act(name: string, action: 'start' | 'stop') {
    setBusy(name + action)
    setError('')
    const res = await api.dbServiceAction(name, action)
    setBusy('')
    if (!res.ok) {
      setError(res.error ?? `Could not ${action} ${name}`)
      notify('error', `Could not ${action} ${name}`, res.error)
    } else {
      notify('success', `${name} ${action === 'start' ? 'started' : 'stopped'}`)
    }
    onChanged()
  }

  const missing: string[] = []
  if (loaded && !services.some((s) => s.kind === 'mysql')) missing.push('MySQL')
  if (loaded && !services.some((s) => s.kind === 'postgres')) missing.push('PostgreSQL')

  return (
    <div className="flex flex-col gap-3">
      {!loaded ? (
        <SkeletonServiceCards count={2} />
      ) : (
        <>
      {services.length > 0 && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {services.map((s) => (
            <div key={s.name} className="rounded-xl border border-edge bg-panel p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DbIcon size={16} className={s.kind === 'postgres' ? 'text-sky-400' : 'text-amber-400'} />
                  <span className="font-semibold text-white">
                    {s.kind === 'postgres' ? 'PostgreSQL' : 'MySQL'}
                    {s.version && <span className="ml-1.5 font-normal text-slate-400">v{s.version}</span>}
                  </span>
                </div>
                <ServiceStateBadge state={s.state} raw={s.rawState} />
              </div>
              <p className="mt-1 truncate text-xs text-slate-500" title={s.binPath}>
                Service: {s.name}
                {s.binPath ? ` · ${s.binPath}` : ''}
              </p>
              <UsedByProjects connections={localConnectionsFor(s.kind, connections)} />
              <div className="mt-3 flex gap-1.5">
                {s.state === 'running' ? (
                  <button
                    onClick={() => act(s.name, 'stop')}
                    disabled={busy === s.name + 'stop' || !isElectron}
                    title={isElectron ? undefined : 'Service control only works in the desktop app'}
                    className="flex items-center gap-1 rounded-md bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/20 disabled:opacity-40"
                  >
                    {busy === s.name + 'stop' ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />} Stop
                  </button>
                ) : (
                  <button
                    onClick={() => act(s.name, 'start')}
                    disabled={busy === s.name + 'start' || s.state === 'pending' || !isElectron}
                    title={isElectron ? undefined : 'Service control only works in the desktop app'}
                    className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40"
                  >
                    {busy === s.name + 'start' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Start
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="flex items-center gap-2 text-sm text-rose-400">
          <AlertTriangle size={14} /> {error}
        </p>
      )}

      {missing.length > 0 && <InstallHint missing={missing} />}
        </>
      )}
    </div>
  )
}

function NewContainerForm({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<DbKind>('mysql')
  const [name, setName] = useState('mysql-dev')
  const [port, setPort] = useState('3306')
  const [password, setPassword] = useState('')
  const [portFree, setPortFree] = useState<boolean | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [lines, setLines] = useState<LogLine[]>([])

  useEffect(() => api.onDockerLog((line) => setLines((l) => [...l, line])), [])

  useEffect(() => {
    const n = Number(port)
    if (!Number.isInteger(n) || n < 1 || n > 65535) return setPortFree(null)
    let cancelled = false
    const t = setTimeout(async () => {
      const res = await api.checkPort(n)
      if (!cancelled) setPortFree(res.free)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [port])

  function switchKind(k: DbKind) {
    setKind(k)
    setName(k === 'postgres' ? 'postgres-dev' : 'mysql-dev')
    setPort(k === 'postgres' ? '5432' : '3306')
  }

  async function create() {
    setCreating(true)
    setError('')
    setLines([])
    const res = await api.dockerCreateContainer({ kind, name, hostPort: Number(port), password })
    setCreating(false)
    if (res.ok) onDone()
    else setError(res.error ?? 'Failed to create container')
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-edge bg-panel p-4">
      <h4 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">New Database Container</h4>
      <div className="flex gap-2">
        {(['mysql', 'postgres'] as DbKind[]).map((k) => (
          <button
            key={k}
            onClick={() => switchKind(k)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              kind === k ? 'border-accent bg-accent/10 text-white' : 'border-edge text-slate-400 hover:text-slate-200'
            }`}
          >
            {k === 'mysql' ? 'MySQL 8.4' : 'PostgreSQL 16'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Container Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Host Port</label>
          <input
            value={port}
            onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
            className={`w-full rounded-lg border bg-bg px-3 py-2 text-sm text-slate-200 outline-none ${
              portFree === false ? 'border-rose-500/60' : 'border-edge focus:border-accent/60'
            }`}
          />
          {portFree === false && <p className="mt-1 text-xs text-rose-400">Port is in use.</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Root Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
          />
        </div>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {(creating || lines.length > 0) && <LogViewer lines={lines} height="h-40" />}
      <button
        onClick={create}
        disabled={creating || !name || !password || portFree === false}
        className="flex w-fit items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-40"
      >
        {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
        {creating ? 'Creating (image pull may take a while)...' : 'Create Container'}
      </button>
    </div>
  )
}

export function Database() {
  const [status, setStatus] = useState<DockerStatus | null>(null)
  const [containers, setContainers] = useState<DbContainer[]>([])
  const [selected, setSelected] = useState<string>('')
  const [databases, setDatabases] = useState<string[]>([])
  const [dbError, setDbError] = useState('')
  const [dbLoading, setDbLoading] = useState(false)
  const [newDb, setNewDb] = useState('')
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showNewContainer, setShowNewContainer] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [services, setServices] = useState<DbService[]>([])
  const [servicesLoaded, setServicesLoaded] = useState(false)
  const [connections, setConnections] = useState<DbConnection[]>([])
  const [launchingDocker, setLaunchingDocker] = useState(false)

  useEffect(() => {
    api.listConnections().then(setConnections)
    return api.onConnectionsChanged(setConnections)
  }, [])

  const refreshServices = useCallback(async () => {
    const list = await api.listDbServices()
    setServices(list)
    setServicesLoaded(true)
  }, [])

  const refresh = useCallback(async () => {
    refreshServices()
    const st = await api.dockerStatus()
    setStatus(st)
    if (st.running) {
      const list = await api.dockerContainers()
      setContainers(list)
      if (!selected && list.length > 0) setSelected(list[0].id)
    } else {
      setContainers([])
    }
  }, [selected, refreshServices])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 8000)
    return () => clearInterval(t)
  }, [refresh])

  async function startDocker() {
    setLaunchingDocker(true)
    const res = await api.dockerLaunch()
    if (!res.ok) {
      setLaunchingDocker(false)
      notify('error', 'Could not start Docker Desktop', res.error)
      return
    }
    notify('info', 'Starting Docker Desktop', 'The engine can take up to a minute to become ready.')
    // Docker Desktop boots slowly — poll the engine until it answers (~90s max)
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      const st = await api.dockerStatus()
      if (st.running) {
        await refresh()
        notify('success', 'Docker is ready')
        setLaunchingDocker(false)
        return
      }
    }
    setLaunchingDocker(false)
    notify('warn', 'Docker is taking longer than expected', 'Hit refresh once Docker Desktop finishes starting.')
  }

  const container = containers.find((c) => c.id === selected)

  const loadDatabases = useCallback(async () => {
    if (!container || container.state !== 'running') {
      setDatabases([])
      return
    }
    setDbLoading(true)
    setDbError('')
    const res = await api.dockerListDatabases(container)
    setDbLoading(false)
    if (res.ok) setDatabases(res.databases ?? [])
    else {
      setDatabases([])
      setDbError(res.error ?? 'Could not list databases')
    }
  }, [container?.id, container?.state]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadDatabases()
  }, [loadDatabases])

  async function act(id: string, action: 'start' | 'stop' | 'restart') {
    setBusyAction(id + action)
    const c = containers.find((x) => x.id === id)
    const res = await api.dockerContainerAction(id, action)
    setBusyAction('')
    if (res && !res.ok) notify('error', `Could not ${action} container`, res.error)
    else notify('success', `Container ${action === 'stop' ? 'stopped' : action === 'start' ? 'started' : 'restarted'}`, c?.name)
    await refresh()
    await loadDatabases()
  }

  async function createDb() {
    if (!container || !newDb) return
    setCreateMsg(null)
    const name = newDb
    const res = await api.dockerCreateDatabase(container, newDb)
    if (res.ok) {
      setCreateMsg({ ok: true, text: `Database "${name}" created.` })
      setNewDb('')
      await loadDatabases()
      notify('success', 'Database created', `${name} in ${container.name}`)
    } else {
      setCreateMsg({ ok: false, text: res.error ?? 'Failed to create database' })
      notify('error', 'Could not create database', res.error)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white">Databases</h2>
          <p className="text-sm text-slate-500">
            Local MySQL/PostgreSQL Windows services and Docker containers for development.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status && (
            <span
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                status.running
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              }`}
            >
              {status.running ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {status.running
                ? `Docker ${status.version}`
                : status.installed
                  ? 'Docker installed, daemon not running'
                  : 'Docker not detected'}
            </span>
          )}
          <button onClick={refresh} title="Refresh" className="rounded-lg border border-edge p-2 text-slate-400 hover:text-accent">
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      <PageSection
        title="Local Windows services"
        description="MySQL and PostgreSQL installed as Windows services — start or stop them without Docker."
        action={
          !isElectron ? (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
              Preview mode
            </span>
          ) : undefined
        }
      >
        <LocalServices services={services} loaded={servicesLoaded} connections={connections} onChanged={refreshServices} />
      </PageSection>

      <PageSection
        title="Docker containers"
        description="Run MySQL or PostgreSQL in isolated containers when you prefer Docker over native installs."
      >
        {status && !status.running && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-slate-300">
            {status.installed ? (
              <>
                <span>
                  Docker CLI is installed but the engine is not reachable. Start <b>Docker Desktop</b> and hit refresh.
                </span>
                <button
                  onClick={startDocker}
                  disabled={launchingDocker || !isElectron}
                  className="flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-50"
                >
                  {launchingDocker ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                  {launchingDocker ? 'Starting Docker...' : 'Start Docker Desktop'}
                </button>
              </>
            ) : (
              <span>
                Docker was not found on this system. Install <b>Docker Desktop for Windows</b> from the{' '}
                <Link to="/tools" className="font-semibold text-accent hover:underline">
                  App and Tools
                </Link>{' '}
                page to manage MySQL and PostgreSQL containers from here.
              </span>
            )}
          </div>
        )}

      {status?.running && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="grid flex-1 grid-cols-2 gap-3">
              {containers.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                    selected === c.id ? 'border-accent bg-accent/5' : 'border-edge bg-panel hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DbIcon size={16} className={c.kind === 'postgres' ? 'text-sky-400' : 'text-amber-400'} />
                      <span className="font-semibold text-white">{c.name}</span>
                    </div>
                    <StateBadge state={c.state} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.image} · Port {c.hostPort ?? '—'}
                  </p>
                  <UsedByProjects
                    connections={localConnectionsFor(c.kind, connections).filter(
                      (conn) => c.hostPort !== undefined && conn.port === c.hostPort,
                    )}
                  />
                  <div className="mt-3 flex gap-1.5">
                    {c.state === 'running' ? (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); act(c.id, 'stop') }}
                          disabled={busyAction === c.id + 'stop'}
                          className="flex items-center gap-1 rounded-md bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/20 disabled:opacity-40"
                        >
                          <Square size={12} /> Stop
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); act(c.id, 'restart') }}
                          disabled={busyAction === c.id + 'restart'}
                          className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-40"
                        >
                          <RotateCcw size={12} /> Restart
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); act(c.id, 'start') }}
                        disabled={busyAction === c.id + 'start'}
                        className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40"
                      >
                        <Play size={12} /> Start
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {containers.length === 0 && (
                <div className="col-span-2 rounded-xl border border-dashed border-edge p-8 text-center text-sm text-slate-500">
                  No MySQL/MariaDB or PostgreSQL containers found in Docker.
                </div>
              )}
            </div>
            <button
              onClick={() => setShowNewContainer(!showNewContainer)}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300"
            >
              <Plus size={15} /> New Database Container
            </button>
          </div>

          {showNewContainer && (
            <NewContainerForm
              onDone={() => {
                setShowNewContainer(false)
                refresh()
              }}
            />
          )}

          {container && (
            <div className="grid grid-cols-[1fr_20rem] gap-4">
              <div className="rounded-xl border border-edge bg-panel p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Databases in {container.name}
                  </h4>
                  {dbLoading && <Loader2 size={14} className="animate-spin text-slate-500" />}
                </div>

                {container.state !== 'running' ? (
                  <p className="text-sm text-slate-500">Start the container to browse and create databases.</p>
                ) : dbError ? (
                  <p className="flex items-center gap-2 text-sm text-rose-400">
                    <AlertTriangle size={14} /> {dbError}
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-edge">
                    {databases.map((db) => (
                      <div key={db} className="flex items-center gap-2 py-2 text-sm text-slate-200">
                        <DbIcon size={14} className="text-slate-500" /> {db}
                        <CheckCircle2 size={13} className="ml-auto text-emerald-500" />
                      </div>
                    ))}
                    {databases.length === 0 && !dbLoading && (
                      <p className="py-2 text-sm text-slate-500">No user databases yet.</p>
                    )}
                  </div>
                )}

                {container.state === 'running' && (
                  <div className="mt-4 flex gap-2">
                    <input
                      value={newDb}
                      onChange={(e) => setNewDb(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && createDb()}
                      placeholder="new_database_name"
                      className="flex-1 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
                    />
                    <button
                      onClick={createDb}
                      disabled={!newDb}
                      className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-40"
                    >
                      <Plus size={14} /> Create New DB
                    </button>
                  </div>
                )}
                {createMsg && (
                  <p className={`mt-2 text-sm ${createMsg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{createMsg.text}</p>
                )}
              </div>

              <ConnectionCard c={container} />
            </div>
          )}
        </>
        )}
      </PageSection>
    </div>
  )
}
