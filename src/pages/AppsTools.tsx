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
} from 'lucide-react'
import { api, isElectron } from '../lib/ipc'
import { TOOLS, TOOL_CATEGORIES, installCommandFor, type ToolDef } from '../shared/tools'
import type { ToolStatus, LogLine } from '../shared/types'
import { LogViewer } from '../components/LogViewer'

function InstallBadge({ status }: { status?: ToolStatus }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-edge px-2.5 py-0.5 text-xs text-slate-500">
        <Loader2 size={12} className="animate-spin" /> checking
      </span>
    )
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

function ToolCard({ tool, status, onInstalled }: { tool: ToolDef; status?: ToolStatus; onInstalled: () => void }) {
  const [copied, setCopied] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [lines, setLines] = useState<LogLine[]>([])
  const [error, setError] = useState('')
  const cmd = installCommandFor(tool)
  const canInstall = isElectron && !!cmd && status !== undefined && !status.installed

  useEffect(() => {
    if (!installing) return
    return api.onToolInstallLog((toolId, line) => {
      if (toolId === tool.id) setLines((l) => [...l, line])
    })
  }, [installing, tool.id])

  async function install() {
    setInstalling(true)
    setError('')
    setLines([])
    const res = await api.installTool(tool.id)
    setInstalling(false)
    if (res.ok) {
      setLines([])
      onInstalled()
    } else {
      setError(res.error ?? 'Install failed')
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-edge bg-panel p-4">
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
        <InstallBadge status={status} />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {canInstall && (
          <button
            onClick={install}
            disabled={installing}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-50"
          >
            {installing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {installing ? 'Installing...' : 'Install'}
          </button>
        )}
        <button
          onClick={() => api.openExternal(tool.url)}
          className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-accent/50 hover:text-white"
        >
          <Download size={13} /> Download page
        </button>
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

      {error && <p className="text-xs text-rose-400">{error}</p>}
      {installing && lines.length > 0 && <LogViewer lines={lines} height="h-28" />}
    </div>
  )
}

export function AppsTools() {
  const [statuses, setStatuses] = useState<Map<string, ToolStatus> | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function detect() {
    setRefreshing(true)
    const list = await api.detectTools()
    setStatuses(new Map(list.map((s) => [s.id, s])))
    setRefreshing(false)
  }

  useEffect(() => {
    detect()
  }, [])

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
          Most tools install with a single <b>winget</b> command — copy it from the card and paste it into a terminal.
          winget ships with Windows 11, so no setup is needed.
        </p>
      </div>

      {TOOL_CATEGORIES.map((cat) => {
        const tools = TOOLS.filter((t) => t.category === cat.key)
        if (tools.length === 0) return null
        return (
          <section key={cat.key}>
            <h3 className="text-sm font-semibold tracking-wider text-slate-400 uppercase">{cat.label}</h3>
            <p className="mb-3 text-xs text-slate-600">{cat.blurb}</p>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
              {tools.map((t) => (
                <ToolCard key={t.id} tool={t} status={statuses?.get(t.id)} onInstalled={detect} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
