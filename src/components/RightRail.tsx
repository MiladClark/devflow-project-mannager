import { Link } from 'react-router-dom'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { CheckCircle2, Info, AlertTriangle, XCircle, ArrowUpRight } from 'lucide-react'
import { useApp } from '../state/store'
import { useGuestLock } from '../lib/guest'
import { formatBytes, timeAgo } from '../lib/format'
import { SkeletonRightRail } from './Skeleton'
import type { ActivityEvent } from '../shared/types'

const levelIcon: Record<ActivityEvent['level'], { icon: typeof Info; cls: string }> = {
  ok: { icon: CheckCircle2, cls: 'text-emerald-400' },
  info: { icon: Info, cls: 'text-cyan-400' },
  warn: { icon: AlertTriangle, cls: 'text-amber-400' },
  err: { icon: XCircle, cls: 'text-rose-400' },
}

export function RightRail() {
  const { guardGuest } = useGuestLock()
  const { activity, systemStats, systemHistory, projects, loaded } = useApp()
  const memPct = systemStats ? (systemStats.memUsed / systemStats.memTotal) * 100 : 0

  const frameworkCounts = new Map<string, number>()
  for (const p of projects) {
    for (const f of p.frameworks) frameworkCounts.set(f, (frameworkCounts.get(f) ?? 0) + 1)
  }

  return (
    <aside className="hidden h-full min-h-0 w-72 shrink-0 flex-col border-l border-edge bg-panel2 xl:flex">
      {!loaded ? (
        <SkeletonRightRail />
      ) : (
        <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 animate-content-in">
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Recent Activity</h3>
          <div className="flex flex-col gap-3">
            {activity.slice(0, 8).map((ev) => {
              const L = levelIcon[ev.level]
              return (
                <div key={ev.id} className="flex items-start gap-2.5">
                  <L.icon size={16} className={`mt-0.5 shrink-0 ${L.cls}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-200">{ev.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {ev.message} · {timeAgo(ev.ts)}
                    </p>
                  </div>
                </div>
              )
            })}
            {activity.length === 0 && <p className="text-xs text-slate-600">No activity yet.</p>}
          </div>
        </section>

        <div className="border-t border-edge" />

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">System Health</h3>
            <Link
              to="/system"
              onClick={(e) => guardGuest(e)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
            >
              View system <ArrowUpRight size={12} />
            </Link>
          </div>

          <div className="rounded-xl border border-edge bg-panel p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">CPU Usage</span>
              <span className="font-semibold text-white">{systemStats ? systemStats.cpu.toFixed(0) : '--'}%</span>
            </div>
            <div className="h-14">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={systemHistory}>
                  <Area type="monotone" dataKey="cpu" stroke="#22d3ee" fill="#22d3ee22" strokeWidth={1.5} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-edge bg-panel p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Memory</span>
              <span className="font-semibold text-white">
                {systemStats ? `${formatBytes(systemStats.memUsed)} / ${formatBytes(systemStats.memTotal)}` : '--'}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${memPct}%` }} />
            </div>
          </div>
        </section>
      </div>

      <div className="shrink-0 border-t border-edge p-4">
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Frameworks</h3>
        <div className="grid grid-cols-2 gap-0.5">
          {[...frameworkCounts.entries()].map(([name, count]) => (
            <div key={name} className="flex items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-400">
              <span className="truncate">{name}</span>
              <span className="shrink-0 rounded-full bg-slate-800 px-2 text-xs text-slate-300">{count}</span>
            </div>
          ))}
          {frameworkCounts.size === 0 && <p className="col-span-2 px-2 text-xs text-slate-600">No projects yet</p>}
        </div>
      </div>
        </>
      )}
    </aside>
  )
}
