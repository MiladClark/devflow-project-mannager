import { Loader2 } from 'lucide-react'
import type { UpdateProgress } from '../shared/types'
import { FramelessChrome } from './FramelessChrome'

const PHASE_LABEL: Record<UpdateProgress['phase'], string> = {
  idle: 'Preparing…',
  downloading: 'Downloading update…',
  verifying: 'Verifying update…',
  applying: 'Applying update…',
  restarting: 'Restarting DevFlow…',
  error: 'Update failed',
  cancelled: 'Update cancelled',
}

export function UpdateModal({
  progress,
  required,
  canCancel,
  onCancel,
  onDismiss,
}: {
  progress: UpdateProgress
  required?: boolean
  canCancel?: boolean
  onCancel?: () => void
  onDismiss?: () => void
}) {
  const busy = progress.phase !== 'idle' && progress.phase !== 'error' && progress.phase !== 'cancelled'
  const indeterminate =
    progress.phase === 'applying' ||
    progress.phase === 'restarting' ||
    progress.phase === 'verifying' ||
    (progress.phase === 'downloading' && progress.percent === 0 && busy)

  const body = (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-10">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white">
          {progress.phase === 'error'
            ? 'Update failed'
            : progress.phase === 'cancelled'
              ? 'Update cancelled'
              : 'Updating DevFlow'}
        </h2>
        {progress.version && <p className="mt-1 text-sm text-slate-400">Version {progress.version}</p>}
        {required && progress.phase !== 'error' && progress.phase !== 'cancelled' && (
          <p className="mt-2 text-xs text-rose-300">This update is required to continue.</p>
        )}
      </div>

      <div className="w-full max-w-sm">
        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
          {indeterminate ? (
            <div className="h-full w-1/3 animate-pulse rounded-full bg-[#22d3ee]" />
          ) : (
            <div
              className="h-full rounded-full bg-[#22d3ee] transition-[width] duration-150"
              style={{ width: `${Math.max(2, progress.percent)}%` }}
            />
          )}
        </div>
        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-300">
          {busy && <Loader2 size={14} className="animate-spin text-[#22d3ee]" />}
          {progress.message || PHASE_LABEL[progress.phase]}
        </p>
        {progress.error && <p className="mt-2 text-center text-sm text-rose-400">{progress.error}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {canCancel && onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary px-5 py-2 text-sm">
            Cancel update
          </button>
        )}
        {(progress.phase === 'error' || progress.phase === 'cancelled') && onDismiss && !required && (
          <button type="button" onClick={onDismiss} className="btn-ghost px-5 py-2 text-sm">
            Continue
          </button>
        )}
      </div>

      {busy && (
        <p className="max-w-md text-center text-xs text-slate-600">
          Do not close DevFlow while the update is in progress.
        </p>
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[200] bg-[#0b1120]">
      <FramelessChrome showLogo>{body}</FramelessChrome>
    </div>
  )
}
