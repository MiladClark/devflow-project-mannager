import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { CheckCircle2, Info, AlertTriangle, XCircle } from 'lucide-react'
import { useApp } from '../state/store'
import { formatBytes, timeAgo } from '../lib/format'
import type { ActivityEvent } from '../shared/types'

const levelIcon: Record<ActivityEvent['level'], { icon: typeof Info; cls: string }> = {
  ok: { icon: CheckCircle2, cls: 'text-emerald-400' },
  info: { icon: Info, cls: 'text-cyan-400' },
  warn: { icon: AlertTriangle, cls: 'text-amber-400' },
  err: { icon: XCircle, cls: 'text-rose-400' },
}

export function RightRail() {
  const { activity, systemStats, systemHistory } = useApp()
  const memPct = systemStats ? (systemStats.memUsed / systemStats.memTotal) * 100 : 0

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-edge bg-panel2 p-4 xl:flex">
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
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">System Health</h3>

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
    </aside>
  )
}
