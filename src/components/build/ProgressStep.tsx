import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Circle, Loader2, MinusCircle, OctagonX, RotateCcw, XCircle } from 'lucide-react'
import type { BuildStageStatus } from '../../shared/types'
import { useBuildSetup } from '../../state/buildSetup'
import { LogViewer } from '../LogViewer'

const STATUS_ICON: Record<BuildStageStatus, typeof Circle> = {
  pending: Circle,
  running: Loader2,
  complete: CheckCircle2,
  warning: AlertTriangle,
  failed: XCircle,
  skipped: MinusCircle,
}

const STATUS_CLS: Record<BuildStageStatus, string> = {
  pending: 'text-slate-600',
  running: 'text-accent animate-spin',
  complete: 'text-emerald-400',
  warning: 'text-amber-400',
  failed: 'text-rose-400',
  skipped: 'text-slate-600',
}

function elapsed(startedAt?: number, finishedAt?: number, tick?: number): string {
  if (!startedAt) return ''
  const end = finishedAt ?? tick ?? Date.now()
  const s = Math.max(0, Math.round((end - startedAt) / 1000))
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : `00:${String(s).padStart(2, '0')}`
}

export function ProgressStep() {
  const { runState, logs, next, cancelBuild, retryBuild } = useBuildSetup()
  const [tick, setTick] = useState(Date.now())

  useEffect(() => {
    if (runState?.phase !== 'running') return
    const t = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [runState?.phase])

  useEffect(() => {
    if (runState?.phase === 'done') next()
  }, [runState?.phase, next])

  if (!runState) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Starting build…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        {runState.stages.map((stage) => {
          const Icon = STATUS_ICON[stage.status]
          return (
            <div key={stage.id} className="flex items-center gap-3 rounded-lg border border-edge bg-panel px-3 py-2.5">
              <Icon size={16} className={`shrink-0 ${STATUS_CLS[stage.status]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">{stage.label}</p>
                {stage.status === 'running' && stage.command && (
                  <p className="truncate font-mono text-xs text-slate-500">{stage.command}</p>
                )}
              </div>
              {(stage.status === 'running' || stage.durationMs != null) && (
                <span className="shrink-0 font-mono text-xs text-slate-500">
                  {stage.status === 'running' ? elapsed(stage.startedAt, undefined, tick) : elapsed(stage.startedAt, stage.finishedAt)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {runState.phase === 'error' && (
        <div className="flex items-center gap-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <OctagonX size={16} className="shrink-0" />
          <span className="flex-1">{runState.error ?? 'The build failed.'}</span>
          <button
            onClick={() => void retryBuild()}
            className="flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-semibold hover:bg-rose-500/30"
          >
            <RotateCcw size={12} /> Retry Build
          </button>
        </div>
      )}

      <LogViewer lines={logs} height="h-72" />

      {runState.phase === 'running' && (
        <div className="flex justify-end border-t border-edge pt-4">
          <button
            onClick={cancelBuild}
            className="rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-rose-500/40 hover:text-rose-300"
          >
            Cancel Build
          </button>
        </div>
      )}
    </div>
  )
}
