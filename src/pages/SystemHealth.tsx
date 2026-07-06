import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Cpu,
  HardDrive,
  RefreshCw,
  Skull,
  Loader2,
  Search,
  AlertTriangle,
  FolderKanban,
} from 'lucide-react'
import { useApp } from '../state/store'
import { api, isElectron } from '../lib/ipc'
import { formatBytes } from '../lib/format'
import { notify } from '../state/notifications'
import { confirmAction } from '../state/confirm'
import { PageSection } from '../components/PageSection'
import { ContentReveal, SkeletonProcessTable, SkeletonStatCards } from '../components/Skeleton'
import type { DevProcess, DevProcessCategory, DevProcessSnapshot } from '../shared/types'

const CATEGORY_LABEL: Record<DevProcessCategory, string> = {
  runtime: 'Runtime',
  'package-manager': 'Package manager',
  editor: 'Editor',
  database: 'Database',
  container: 'Container',
  devflow: 'DevFlow project',
  shell: 'Dev shell',
  'other-dev': 'Dev tool',
}

const CATEGORY_CLS: Record<DevProcessCategory, string> = {
  runtime: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  'package-manager': 'text-violet-300 bg-violet-500/10 border-violet-500/30',
  editor: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
  database: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  container: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  devflow: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  shell: 'text-slate-300 bg-slate-500/10 border-slate-500/30',
  'other-dev': 'text-slate-300 bg-slate-600/20 border-slate-500/30',
}

type Filter = 'all' | DevProcessCategory

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'runtime', label: 'Runtimes' },
  { id: 'database', label: 'Databases' },
  { id: 'container', label: 'Docker' },
  { id: 'editor', label: 'Editors' },
  { id: 'devflow', label: 'DevFlow' },
  { id: 'shell', label: 'Shells' },
  { id: 'other-dev', label: 'Other' },
]

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Cpu; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-edge bg-panel p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
        <Icon size={14} className="text-accent" /> {label}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

export function SystemHealth() {
  const systemStats = useApp((s) => s.systemStats)
  const [snapshot, setSnapshot] = useState<DevProcessSnapshot | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [busyPid, setBusyPid] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    const snap = await api.getDevProcesses()
    setSnapshot(snap)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 2500)
    return () => clearInterval(t)
  }, [refresh])

  const filtered = useMemo(() => {
    if (!snapshot) return []
    const q = query.trim().toLowerCase()
    return snapshot.processes.filter((p) => {
      if (filter !== 'all' && p.category !== filter) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.commandLine.toLowerCase().includes(q) ||
        String(p.pid).includes(q) ||
        p.managedProjectName?.toLowerCase().includes(q)
      )
    })
  }, [snapshot, filter, query])

  async function killProcess(p: DevProcess) {
    const label = p.managedProjectName ? `${p.managedProjectName} (${p.name})` : `${p.name} (PID ${p.pid})`
    const ok = await confirmAction({
      title: 'End process?',
      message: `${label} will be terminated. Unsaved work may be lost.`,
      confirmLabel: 'End process',
      variant: 'danger',
    })
    if (!ok) return
    setBusyPid(p.pid)
    const res = await api.killDevProcess(p.pid)
    setBusyPid(0)
    if (res.ok) {
      notify('success', 'Process ended', label)
      await refresh()
    } else {
      notify('error', 'Could not end process', res.error)
    }
  }

  const memPct = systemStats ? (systemStats.memUsed / systemStats.memTotal) * 100 : 0

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 pb-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2.5 text-2xl font-bold text-white">
            <Activity size={22} className="text-accent" /> System Health
          </h2>
          <p className="max-w-2xl text-sm text-slate-500">
            Dev-related processes on your machine — runtimes, databases, Docker, editors and DevFlow projects. Like Task
            Manager, but filtered to what matters for programming.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg border border-edge px-3 py-2 text-sm text-slate-300 hover:border-accent/50 disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </header>

      {!isElectron && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          Preview mode — sample process data. Real monitoring runs in the desktop app.
        </div>
      )}

      <ContentReveal
        loading={!snapshot}
        skeleton={<SkeletonStatCards count={4} />}
      >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Cpu}
          label="System CPU"
          value={systemStats ? `${systemStats.cpu.toFixed(0)}%` : '--'}
          sub="Whole machine"
        />
        <StatCard
          icon={HardDrive}
          label="System memory"
          value={systemStats ? `${memPct.toFixed(0)}%` : '--'}
          sub={systemStats ? `${formatBytes(systemStats.memUsed)} / ${formatBytes(systemStats.memTotal)}` : undefined}
        />
        <StatCard
          icon={Activity}
          label="Dev processes"
          value={snapshot ? String(snapshot.totals.count) : '--'}
          sub={snapshot ? `${formatBytes(snapshot.totals.mem)} combined RAM` : undefined}
        />
        <StatCard
          icon={Cpu}
          label="Dev CPU (sum)"
          value={snapshot ? `${Math.min(100, snapshot.totals.cpu).toFixed(1)}%` : '--'}
          sub="Approximate across listed processes"
        />
      </div>
      </ContentReveal>

      <PageSection
        title="Dev process monitor"
        description="Only programming-related processes are shown — Node.js, Python, databases, Docker, editors, dev shells and DevFlow-managed servers."
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  filter === f.id ? 'border-accent bg-accent/10 text-accent' : 'border-edge text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[14rem] flex-1 lg:max-w-xs">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, PID, command…"
              className="w-full rounded-lg border border-edge bg-bg py-2 pr-3 pl-9 text-sm text-slate-200 outline-none focus:border-accent/60"
            />
          </div>
        </div>

        <ContentReveal loading={!snapshot} skeleton={<SkeletonProcessTable rows={10} />}>
        <div className="overflow-hidden rounded-xl border border-edge">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel2 text-xs tracking-wider text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Process</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">CPU</th>
                <th className="px-4 py-3 font-semibold">Memory</th>
                <th className="px-4 py-3 font-semibold">Command</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.pid} className="border-t border-edge bg-panel transition-colors hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="text-xs text-slate-500">PID {p.pid}</p>
                    {p.managedProjectName && (
                      <Link
                        to={`/projects/${p.managedProjectId}`}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                      >
                        <FolderKanban size={11} /> {p.managedProjectName}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${CATEGORY_CLS[p.category]}`}>
                      {CATEGORY_LABEL[p.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{p.cpu.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-slate-300">{formatBytes(p.mem)}</td>
                  <td className="max-w-md px-4 py-3">
                    <p className="select-text truncate font-mono text-xs text-slate-500" title={p.commandLine}>
                      {p.commandLine || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {p.killable ? (
                        <button
                          onClick={() => killProcess(p)}
                          disabled={busyPid === p.pid || !isElectron}
                          title={p.reason ?? 'End process tree'}
                          className="flex items-center gap-1 rounded-md bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20 disabled:opacity-40"
                        >
                          {busyPid === p.pid ? <Loader2 size={12} className="animate-spin" /> : <Skull size={12} />}
                          End
                        </button>
                      ) : (
                        <span className="flex max-w-40 items-start gap-1 text-xs text-slate-500" title={p.reason}>
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          {p.reason ?? 'Protected'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    {snapshot ? 'No matching dev processes right now.' : 'Loading processes…'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </ContentReveal>

        <p className="text-xs leading-relaxed text-slate-600">
          Tip: For DevFlow-managed dev servers, prefer <Link to="/projects" className="text-accent hover:underline">Stop</Link> on
          the Projects page. Ending a process here force-kills its entire tree (same as Task Manager).
        </p>
      </PageSection>
    </div>
  )
}
