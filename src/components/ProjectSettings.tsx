import { useEffect, useState } from 'react'
import { Save, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { Project, PortCheck, PortOwner, NodeManager, ProxySetupStatus } from '../shared/types'
import { api, isElectron } from '../lib/ipc'
import { useApp } from '../state/store'
import { PortConflict } from './PortConflict'
import { useEntitlements } from '../lib/entitlements'
import { Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Switch } from './Switch'

export function ProjectSettings({ project }: { project: Project }) {
  const refreshProjects = useApp((s) => s.refreshProjects)
  const settings = useApp((s) => s.settings)
  const [runCommand, setRunCommand] = useState(project.runCommand)
  const [buildCommand, setBuildCommand] = useState(project.buildCommand)
  const [port, setPort] = useState(project.preferredPort ? String(project.preferredPort) : '')
  const [portCheck, setPortCheck] = useState<PortCheck | null>(null)
  const [portOwner, setPortOwner] = useState<PortOwner | null>(null)
  const [env, setEnv] = useState<[string, string][]>(Object.entries(project.env))
  const [autoStart, setAutoStart] = useState(!!project.autoStart)
  const [nodeVersion, setNodeVersion] = useState(project.nodeVersion ?? '')
  const [nodeManager, setNodeManager] = useState<NodeManager>(project.nodeManager ?? 'system')
  const [localSlug, setLocalSlug] = useState(project.localSlug ?? '')
  const [composeFile, setComposeFile] = useState(project.composeFile ?? '')
  const [composeAutoStart, setComposeAutoStart] = useState(!!project.composeAutoStart)
  const [pinnedScripts, setPinnedScripts] = useState((project.pinnedScripts ?? []).join(', '))
  const [slugError, setSlugError] = useState('')
  const [proxyStatus, setProxyStatus] = useState<ProxySetupStatus | null>(null)
  const [saved, setSaved] = useState(false)
  const entitlements = useEntitlements()

  useEffect(() => {
    setRunCommand(project.runCommand)
    setBuildCommand(project.buildCommand)
    setPort(project.preferredPort ? String(project.preferredPort) : '')
    setEnv(Object.entries(project.env))
    setAutoStart(!!project.autoStart)
    setNodeVersion(project.nodeVersion ?? '')
    setNodeManager(project.nodeManager ?? 'system')
    setLocalSlug(project.localSlug ?? '')
    setComposeFile(project.composeFile ?? '')
    setComposeAutoStart(!!project.composeAutoStart)
    setPinnedScripts((project.pinnedScripts ?? []).join(', '))
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
      if (cancelled) return
      setPortCheck(res)
      // occupied by a live process → resolve who owns it (heavier, so only on demand)
      if (!res.free) {
        const owner = await api.getPortOwner(n)
        if (!cancelled) setPortOwner(owner)
      } else {
        setPortOwner(null)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [port, project.id])

  useEffect(() => {
    if (isElectron) void api.proxyStatus().then(setProxyStatus)
  }, [])

  function previewSlug() {
    const raw = localSlug.trim() || project.name
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'app'
  }

  const domainSuffix = settings?.localDomainSuffix ?? 'test'
  const httpsPort = proxyStatus?.httpsPort ?? 443
  const previewDomain = `${previewSlug()}.${domainSuffix}`
  const previewUrl =
    httpsPort === 443 ? `https://${previewDomain}/` : `https://${previewDomain}:${httpsPort}/`

  async function save() {
    const envObj: Record<string, string> = {}
    for (const [k, v] of env) if (k.trim()) envObj[k.trim()] = v
    if (localSlug.trim()) {
      const err = await api.proxyValidateSlug(localSlug.trim(), project.id)
      if (err) {
        setSlugError(err)
        return
      }
    }
    setSlugError('')
    const pins = pinnedScripts
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3)
    await api.updateProject(project.id, {
      runCommand,
      buildCommand,
      preferredPort: port ? Number(port) : undefined,
      env: envObj,
      autoStart,
      nodeVersion: nodeVersion.trim() || undefined,
      nodeManager,
      localSlug: localSlug.trim() || undefined,
      composeFile: composeFile.trim() || undefined,
      composeAutoStart,
      pinnedScripts: pins.length ? pins : undefined,
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
        {portCheck && !portCheck.free && portOwner && (
          <div className="mt-3">
            <PortConflict
              owner={portOwner}
              onResolved={async () => {
                setPortOwner(null)
                setPortCheck(await api.checkPort(Number(port), project.id))
              }}
              onDismiss={() => setPortOwner(null)}
            />
          </div>
        )}
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
        <div
          className={`mt-3 flex items-center gap-2.5 text-sm text-slate-300 ${
            entitlements.autoStartProjects ? '' : 'opacity-60'
          }`}
        >
          <Switch
            checked={autoStart && entitlements.autoStartProjects}
            disabled={!entitlements.autoStartProjects}
            onChange={setAutoStart}
            size="sm"
          />
          Auto-start dev server when DevFlow launches
          {!entitlements.autoStartProjects && (
            <Link
              to="/account"
              className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300"
            >
              <Lock size={9} /> PRO
            </Link>
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold tracking-wider text-slate-400 uppercase">Node.js</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Node version</label>
            <input
              value={nodeVersion}
              onChange={(e) => setNodeVersion(e.target.value)}
              placeholder="20"
              className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Version manager</label>
            <select
              value={nodeManager}
              onChange={(e) => setNodeManager(e.target.value as NodeManager)}
              className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
            >
              <option value="system">System default</option>
              <option value="fnm">fnm</option>
              <option value="nvm">nvm</option>
              <option value="volta">volta</option>
            </select>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold tracking-wider text-slate-400 uppercase">Local HTTPS</h3>
        {!settings?.localDomainsEnabled ? (
          <p className="mb-3 text-sm text-amber-300/90">
            Local HTTPS is off.{' '}
            <Link to="/settings" className="text-accent underline-offset-2 hover:underline">
              Enable it in Settings
            </Link>{' '}
            and run setup, then restart the dev server.
          </p>
        ) : !proxyStatus?.ready ? (
          <p className="mb-3 text-sm text-amber-300/90">
            Setup is incomplete (mkcert, Caddy, or hosts file).{' '}
            <Link to="/settings" className="text-accent underline-offset-2 hover:underline">
              Run Local HTTPS setup
            </Link>{' '}
            as Administrator once.
          </p>
        ) : null}
        <label className="mb-1 block text-xs text-slate-500">Domain slug</label>
        <input
          value={localSlug}
          onChange={(e) => setLocalSlug(e.target.value)}
          placeholder="my-app"
          className="w-full max-w-xs rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
        />
        <p className="mt-2 text-xs text-slate-500">
          URL after save + dev server restart:{' '}
          <span className="font-mono text-slate-300">{previewUrl}</span>
        </p>
        {slugError && <p className="mt-1 text-xs text-rose-400">{slugError}</p>}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold tracking-wider text-slate-400 uppercase">Docker Compose</h3>
        <label className="mb-1 block text-xs text-slate-500">Compose file (relative path)</label>
        <input
          value={composeFile}
          onChange={(e) => setComposeFile(e.target.value)}
          placeholder="docker-compose.yml"
          className="mb-3 w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
        />
        <div className="flex items-center gap-2.5 text-sm text-slate-300">
          <Switch checked={composeAutoStart} onChange={setComposeAutoStart} size="sm" />
          Start stack before dev server
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold tracking-wider text-slate-400 uppercase">Pinned scripts</h3>
        <input
          value={pinnedScripts}
          onChange={(e) => setPinnedScripts(e.target.value)}
          placeholder="lint, test, format"
          className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
        />
        <p className="mt-1 text-xs text-slate-500">Comma-separated script names (max 3) shown first in Scripts tab.</p>
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
