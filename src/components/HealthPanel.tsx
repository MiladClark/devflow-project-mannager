import { useCallback, useEffect, useState } from 'react'
import { HeartPulse, RefreshCw, Loader2, AlertTriangle, CheckCircle2, Lock, Copy } from 'lucide-react'
import { api, isElectron } from '../lib/ipc'
import { useEntitlements } from '../lib/entitlements'
import { UpgradePrompt } from './UpgradePrompt'
import { Skeleton, SkeletonText } from './Skeleton'
import type { HealthReport, HealthPhase } from '../shared/types'

const PHASE_LABEL: Record<HealthPhase, string> = {
  queued: 'Queued...',
  outdated: 'Checking outdated packages...',
  audit: 'Running security audit...',
  engines: 'Checking Node version...',
  done: '',
  error: '',
}

function CopyHint({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(cmd)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="flex items-center gap-1.5 rounded-lg border border-edge px-2.5 py-1 font-mono text-xs text-slate-400 hover:border-accent/50"
    >
      <Copy size={11} /> {copied ? 'Copied!' : cmd}
    </button>
  )
}

export function HealthPanel({ projectId }: { projectId: string }) {
  const [report, setReport] = useState<HealthReport | null>(null)
  const [phase, setPhase] = useState<HealthPhase | null>(null)
  const [initialLoad, setInitialLoad] = useState(true)
  const entitlements = useEntitlements()

  const load = useCallback(async () => {
    setReport(await api.healthGet(projectId))
    setInitialLoad(false)
  }, [projectId])

  useEffect(() => {
    setReport(null)
    setPhase(null)
    setInitialLoad(true)
    load()
  }, [load])

  useEffect(() => {
    const un1 = api.onHealthStatus((id, p) => {
      if (id === projectId) setPhase(p === 'done' || p === 'error' ? null : p)
    })
    const un2 = api.onHealthResult((id, r) => {
      if (id === projectId) {
        setReport(r)
        setPhase(null)
      }
    })
    return () => {
      un1()
      un2()
    }
  }, [projectId])

  const scanning = phase !== null
  const stale = report && Date.now() - report.scannedAt > 24 * 3600_000

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => api.healthScan(projectId)}
          disabled={scanning || !isElectron}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-40"
        >
          {scanning ? <Loader2 size={14} className="animate-spin" /> : <HeartPulse size={14} />}
          {scanning ? PHASE_LABEL[phase] : 'Scan project health'}
        </button>
        {report && (
          <span className={`text-xs ${stale ? 'text-amber-300' : 'text-slate-500'}`}>
            Last scan: {new Date(report.scannedAt).toLocaleString()}
            {stale && ' (stale)'}
          </span>
        )}
      </div>

      {initialLoad ? (
        <div className="rounded-xl border border-edge bg-panel p-5">
          <Skeleton className="h-4 w-36" />
          <SkeletonText lines={4} className="mt-4" />
        </div>
      ) : !report && !scanning ? (
        <p className="rounded-xl border border-dashed border-edge p-6 text-sm text-slate-500">
          No scan yet. Run a scan to check outdated packages, known vulnerabilities and Node compatibility.
        </p>
      ) : null}

      {report?.error && (
        <p className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          <AlertTriangle size={14} /> {report.error}
        </p>
      )}

      {report && (
        <>
          <div className="rounded-xl border border-edge bg-panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Outdated packages ({report.outdated.length})
              </h4>
              {report.outdated.length > 0 && <CopyHint cmd="npm update" />}
            </div>
            {report.outdated.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 size={14} /> All dependencies match their wanted ranges.
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-1 pr-4 font-medium">Package</th>
                    <th className="py-1 pr-4 font-medium">Current</th>
                    <th className="py-1 pr-4 font-medium">Wanted</th>
                    <th className="py-1 font-medium">Latest</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {report.outdated.slice(0, 30).map((d) => (
                    <tr key={d.name} className="border-t border-edge/50">
                      <td className="py-1.5 pr-4 text-slate-200">{d.name}</td>
                      <td className="py-1.5 pr-4 text-slate-400">{d.current ?? '—'}</td>
                      <td className="py-1.5 pr-4 text-amber-300">{d.wanted}</td>
                      <td className="py-1.5 text-emerald-400">{d.latest}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {report.outdated.length > 30 && (
              <p className="mt-2 text-xs text-slate-500">+{report.outdated.length - 30} more</p>
            )}
          </div>

          <div className="rounded-xl border border-edge bg-panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Security audit
                {!entitlements.healthAudit && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300 normal-case">
                    <Lock size={9} /> PRO
                  </span>
                )}
              </h4>
              {report.audit && report.audit.total > 0 && <CopyHint cmd="npm audit fix" />}
            </div>
            {!entitlements.healthAudit ? (
              <UpgradePrompt message="Vulnerability scanning (npm audit) is part of the Pro plan." />
            ) : report.auditError && report.auditError !== 'pro_required' ? (
              <p className="text-sm text-amber-300">{report.auditError}</p>
            ) : report.audit ? (
              report.audit.total === 0 ? (
                <p className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle2 size={14} /> No known vulnerabilities.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 text-xs">
                  {(
                    [
                      ['critical', report.audit.critical, 'border-rose-500/50 bg-rose-500/10 text-rose-300'],
                      ['high', report.audit.high, 'border-rose-400/40 bg-rose-400/10 text-rose-300'],
                      ['moderate', report.audit.moderate, 'border-amber-500/40 bg-amber-500/10 text-amber-300'],
                      ['low', report.audit.low, 'border-slate-600 bg-slate-700/20 text-slate-300'],
                      ['info', report.audit.info, 'border-slate-700 bg-slate-800/40 text-slate-400'],
                    ] as const
                  )
                    .filter(([, n]) => n > 0)
                    .map(([label, n, cls]) => (
                      <span key={label} className={`rounded-full border px-3 py-1 font-semibold capitalize ${cls}`}>
                        {n} {label}
                      </span>
                    ))}
                </div>
              )
            ) : (
              <p className="text-sm text-slate-500">Not scanned.</p>
            )}
          </div>

          <div className="rounded-xl border border-edge bg-panel p-4">
            <h4 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Node version</h4>
            {report.engines.required ? (
              report.engines.satisfied ? (
                <p className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle2 size={14} /> Installed Node v{report.engines.installed} satisfies "{report.engines.required}"
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm text-rose-400">
                  <AlertTriangle size={14} /> Installed Node v{report.engines.installed} does not satisfy "{report.engines.required}"
                </p>
              )
            ) : (
              <p className="text-sm text-slate-500">
                No engines.node requirement in package.json (installed: v{report.engines.installed}).
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
