import { useEffect, useState } from 'react'
import {
  Wrench,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Download,
  Copy,
  Check,
  Terminal,
  Loader2,
  AlertTriangle,
  X,
  Trash2,
} from 'lucide-react'
import { api, isElectron } from '../lib/ipc'
import { TOOLS, TOOL_CATEGORIES, installCommandFor, uninstallCommandFor, type ToolDef } from '../shared/tools'
import type { ToolStatus, InstallState } from '../shared/types'
import { LogViewer } from '../components/LogViewer'
import { Skeleton, SkeletonToolCards } from '../components/Skeleton'
import { notify } from '../state/notifications'
import { confirmAction } from '../state/confirm'

function InstallBadge({
  status,
  installing,
  uninstalling,
}: {
  status?: ToolStatus
  installing?: boolean
  uninstalling?: boolean
}) {
  if (uninstalling) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-300">
        <Loader2 size={12} className="animate-spin" /> Uninstalling
      </span>
    )
  }
  if (installing) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
        <Loader2 size={12} className="animate-spin" /> Downloading
      </span>
    )
  }
  if (!status) {
    return <Skeleton className="inline-block h-5 w-24 rounded-full" />
  }
  return status.installed ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
      <CheckCircle2 size={12} /> Installed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-600/60 bg-slate-700/20 px-2.5 py-0.5 text-xs text-slate-400">
      <XCircle size={12} /> Not installed
    </span>
  )
}

function ToolCard({
  tool,
  status,
  install,
  onInstall,
  onUninstall,
  onCancel,
}: {
  tool: ToolDef
  status?: ToolStatus
  install?: InstallState
  onInstall: (id: string) => void
  onUninstall: (id: string) => void
  onCancel: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const cmd = installCommandFor(tool)
  const uninstallCmd = uninstallCommandFor(tool)
  const inProgress = install?.phase === 'installing'
  const installing = inProgress && install?.mode !== 'uninstall'
  const uninstalling = inProgress && install?.mode === 'uninstall'
  const canInstall = isElectron && !!cmd && status !== undefined && !status.installed && !inProgress
  const canUninstall = isElectron && !!uninstallCmd && status?.installed && !inProgress

  return (
    <div className="lift flex flex-col gap-3 rounded-xl border border-edge bg-panel p-4 hover:border-slate-600">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="flex items-baseline gap-2 font-semibold text-white">
            <span className="truncate">{tool.name}</span>
            {status?.installed && status.version && (
              <span className="shrink-0 text-xs font-normal text-slate-400">v{status.version}</span>
            )}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{tool.description}</p>
        </div>
        <InstallBadge status={status} installing={installing} uninstalling={uninstalling} />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {canInstall && (
          <button
            onClick={() => onInstall(tool.id)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-cyan-300"
          >
            <Download size={13} /> Download &amp; install
          </button>
        )}
        {canUninstall && (
          <button
            onClick={() => onUninstall(tool.id)}
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:border-rose-400 hover:bg-rose-500/20"
          >
            <Trash2 size={13} /> Uninstall
          </button>
        )}
        {installing && (
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent">
              <Loader2 size={13} className="animate-spin" /> Downloading…
            </span>
            <button
              onClick={() => onCancel(tool.id)}
              title="Cancel download & install"
              aria-label="Cancel download and install"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:border-rose-400 hover:bg-rose-500/20 hover:text-rose-200"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {uninstalling && (
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300">
              <Loader2 size={13} className="animate-spin" /> Uninstalling…
            </span>
            <button
              onClick={() => onCancel(tool.id)}
              title="Cancel uninstall"
              aria-label="Cancel uninstall"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:border-rose-400 hover:bg-rose-500/20 hover:text-rose-200"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {!canInstall && !inProgress && (
          <button
            onClick={() => api.openExternal(tool.url)}
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-accent/50 hover:text-white"
          >
            <Download size={13} /> Download page
          </button>
        )}
        {canInstall && (
          <button
            onClick={() => api.openExternal(tool.url)}
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-accent/50 hover:text-slate-200"
          >
            Manual download
          </button>
        )}
        {cmd && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(cmd)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            title={cmd}
            className="flex min-w-0 items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs text-slate-400 hover:border-accent/50 hover:text-slate-200"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <code className="truncate font-mono">{copied ? 'Copied!' : cmd}</code>
          </button>
        )}
      </div>

      {install?.phase === 'error' && install.error && (
        <p className="flex items-start gap-1.5 text-xs text-rose-400">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {install.error}
        </p>
      )}
      {install && (inProgress || install.phase === 'error') && install.lines.length > 0 && (
        <LogViewer lines={install.lines} height="h-28" />
      )}
    </div>
  )
}

export function AppsTools() {
  const [statuses, setStatuses] = useState<Map<string, ToolStatus> | null>(null)
  const [installs, setInstalls] = useState<Map<string, InstallState>>(new Map())
  const [refreshing, setRefreshing] = useState(false)

  async function detect() {
    setRefreshing(true)
    const list = await api.detectTools()
    setStatuses(new Map(list.map((s) => [s.id, s])))
    setRefreshing(false)
  }

  useEffect(() => {
    detect()
    // reattach to any installs already running in the main process
    api.getInstallStates().then((states) => {
      if (states.length) setInstalls(new Map(states.map((s) => [s.toolId, s])))
    })

    // live streaming: append log lines and apply phase transitions
    const unLog = api.onToolInstallLog((toolId, line) => {
      setInstalls((m) => {
        const cur = m.get(toolId)
        if (!cur) return m
        const next = new Map(m)
        next.set(toolId, { ...cur, lines: [...cur.lines, line] })
        return next
      })
    })
    const unState = api.onToolInstallState((state) => {
      setInstalls((m) => new Map(m).set(state.toolId, state))
      const tool = TOOLS.find((t) => t.id === state.toolId)
      const name = tool?.name ?? state.toolId
      if (state.phase === 'done') {
        if (state.mode === 'uninstall') {
          if (state.status) setStatuses((s) => (s ? new Map(s).set(state.toolId, state.status!) : s))
          notify('success', `${name} removed`, undefined, '/tools')
        } else if (state.status?.installed) {
          setStatuses((s) => (s ? new Map(s).set(state.toolId, state.status!) : s))
          notify('success', `${name} installed`, state.status.version ? `Version ${state.status.version}` : undefined, '/tools')
        }
        void detect()
      } else if (state.phase === 'error') {
        if (state.error?.endsWith('cancelled')) {
          notify('info', `${name} ${state.mode === 'uninstall' ? 'uninstall' : 'install'} cancelled`, undefined, '/tools')
        } else {
          notify('error', `${name} ${state.mode === 'uninstall' ? 'uninstall' : 'install'} failed`, state.error, '/tools')
        }
      }
    })
    return () => {
      unLog()
      unState()
    }
  }, [])

  async function onInstall(toolId: string) {
    const tool = TOOLS.find((t) => t.id === toolId)
    notify('info', `Downloading ${tool?.name ?? toolId}`, 'This can take a minute. You can keep using DevFlow.')
    // optimistic local state so the card reflects "installing" instantly
    setInstalls((m) =>
      new Map(m).set(toolId, { toolId, phase: 'installing', lines: [], startedAt: Date.now() }),
    )
    await api.installTool(toolId)
    // the final phase arrives via the onToolInstallState event
  }

  async function onUninstall(toolId: string) {
    const tool = TOOLS.find((t) => t.id === toolId)
    const ok = await confirmAction({
      title: 'Uninstall tool?',
      message: `${tool?.name ?? toolId} will be removed from this machine.`,
      confirmLabel: 'Uninstall',
      variant: 'danger',
    })
    if (!ok) return
    notify('info', `Removing ${tool?.name ?? toolId}`, 'This can take a minute.')
    setInstalls((m) =>
      new Map(m).set(toolId, { toolId, phase: 'installing', mode: 'uninstall', lines: [], startedAt: Date.now() }),
    )
    await api.uninstallTool(toolId)
  }

  async function onCancel(toolId: string) {
    await api.cancelInstallTool(toolId)
  }

  const installedCount = statuses ? [...statuses.values()].filter((s) => s.installed).length : 0

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2.5 text-2xl font-bold text-white">
            <Wrench size={22} className="text-accent" /> Apps &amp; Tools
            {!isElectron && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium tracking-normal text-amber-300">
                Preview mode — sample data, real detection runs in the desktop app
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            The essential software for a local web-development workflow on Windows.
            {statuses && (
              <span className="ml-2 text-slate-400">
                {installedCount}/{TOOLS.length} detected on this machine.
              </span>
            )}
          </p>
        </div>
        <button
          onClick={detect}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-edge px-3 py-2 text-sm text-slate-300 hover:border-accent/50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Re-scan
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm text-slate-300">
        <Terminal size={16} className="mt-0.5 shrink-0 text-sky-400" />
        <p>
          One-click <b>Download &amp; install</b> runs winget in the background — installs keep running even if you switch tabs, and a
          notification tells you when they finish. Use the <b>×</b> button to cancel an in-progress download. Some installers
          (databases) may prompt for Administrator rights.
        </p>
      </div>

      {TOOL_CATEGORIES.map((cat) => {
        const tools = TOOLS.filter((t) => t.category === cat.key)
        if (tools.length === 0) return null
        return (
          <section key={cat.key}>
            <h3 className="text-sm font-semibold tracking-wider text-slate-400 uppercase">{cat.label}</h3>
            <p className="mb-3 text-xs text-slate-600">{cat.blurb}</p>
            {!statuses ? (
              <SkeletonToolCards count={tools.length} />
            ) : (
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {tools.map((t) => (
                  <ToolCard
                    key={t.id}
                    tool={t}
                    status={statuses.get(t.id)}
                    install={installs.get(t.id)}
                    onInstall={onInstall}
                    onUninstall={onUninstall}
                    onCancel={onCancel}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
