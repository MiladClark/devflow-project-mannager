import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp, Download, Loader2, Pause, Play, RefreshCw, Rocket, X } from 'lucide-react'
import type { UpdateAvailablePayload, UpdateProgress } from '../shared/types'
import { formatBytes } from '../lib/format'

interface Props {
  progress: UpdateProgress
  available: UpdateAvailablePayload | null
  onDownload: () => void
  onPause: () => void
  onResume: () => void
  onInstall: () => void
  onCancel: () => void
  onRetry: () => void
}

const TITLE: Record<UpdateProgress['phase'], string> = {
  idle: 'New update available',
  downloading: 'Downloading update…',
  paused: 'Update paused',
  verifying: 'Verifying update…',
  ready: 'Ready to install',
  applying: 'Installing update…',
  restarting: 'Restarting DevFlow…',
  error: 'Update failed',
  cancelled: 'Update cancelled',
}

/** Small fixed card in the bottom-right corner that drives the whole update
 * flow (download → pause/resume → install) without taking over the screen.
 * Collapses to a pill the user can reopen. */
export function UpdateWidget({
  progress,
  available,
  onDownload,
  onPause,
  onResume,
  onInstall,
  onCancel,
  onRetry,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const phase = progress.phase
  const version = progress.version ?? available?.version
  const required = !!available?.required

  const indeterminate = phase === 'verifying' || phase === 'applying' || phase === 'restarting'
  const showBar = phase === 'downloading' || phase === 'paused' || indeterminate
  const percent = Math.max(2, Math.min(100, progress.percent || 0))

  if (collapsed) {
    return createPortal(
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="fixed bottom-4 right-4 z-[200] flex items-center gap-2 rounded-full border border-edge bg-panel px-3.5 py-2 text-xs font-medium text-slate-200 shadow-lg shadow-black/40 hover:border-accent/50"
      >
        {phase === 'downloading' && <Loader2 size={13} className="animate-spin text-accent" />}
        <span>
          {phase === 'downloading'
            ? `Updating… ${progress.percent || 0}%`
            : phase === 'ready'
              ? 'Update ready'
              : phase === 'paused'
                ? 'Update paused'
                : 'Update'}
        </span>
        <ChevronUp size={14} className="text-slate-400" />
      </button>,
      document.body,
    )
  }

  const card = (
    <div className="fixed bottom-4 right-4 z-[200] w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-edge bg-panel shadow-xl shadow-black/50">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {TITLE[phase]}
            {version && phase === 'idle' && <span className="ml-2 font-normal text-slate-400">{version}</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"
          aria-label="Collapse"
        >
          <ChevronDown size={18} />
        </button>
      </div>

      <div className="px-4 pb-4 pt-2">
        {/* Available — not started yet */}
        {phase === 'idle' && (
          <>
            <p className="text-xs leading-relaxed text-slate-400">
              A new version is available. With your approval, it downloads in the background.
            </p>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={onDownload}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-[#0b1120] hover:brightness-110"
              >
                <Download size={14} /> Download
              </button>
            </div>
          </>
        )}

        {/* Downloading / paused / verifying / applying / restarting */}
        {showBar && (
          <>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              {indeterminate ? (
                <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
              ) : (
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-150"
                  style={{ width: `${percent}%` }}
                />
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs tabular-nums text-slate-400">
                {phase === 'downloading' && !!progress.bytesTotal ? (
                  <>
                    <span>
                      {formatBytes(progress.bytesReceived ?? 0)} / {formatBytes(progress.bytesTotal)}
                    </span>
                    {!!progress.bytesPerSec && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span>{formatBytes(progress.bytesPerSec)}/s</span>
                      </>
                    )}
                  </>
                ) : (
                  <span>{progress.message || TITLE[phase]}</span>
                )}
              </p>

              {/* Controls: pause/resume + cancel (only while download is stoppable) */}
              {(phase === 'downloading' || phase === 'paused') && (
                <div className="flex shrink-0 items-center gap-1">
                  {phase === 'downloading' ? (
                    <button
                      type="button"
                      onClick={onPause}
                      className="rounded-lg p-1.5 text-slate-300 hover:bg-white/5 hover:text-white"
                      aria-label="Pause"
                      title="Pause"
                    >
                      <Pause size={15} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onResume}
                      className="rounded-lg p-1.5 text-accent hover:bg-white/5"
                      aria-label="Resume"
                      title="Resume"
                    >
                      <Play size={15} />
                    </button>
                  )}
                  {!required && (
                    <button
                      type="button"
                      onClick={onCancel}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-rose-300"
                      aria-label="Cancel update"
                      title="Cancel"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Ready to install */}
        {phase === 'ready' && (
          <>
            <p className="text-xs leading-relaxed text-slate-400">
              Update{version ? ` ${version}` : ''} downloaded. DevFlow needs to close to install it, then it
              reopens automatically.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              {!required && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={onInstall}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-[#0b1120] hover:brightness-110"
              >
                <Rocket size={14} /> Install &amp; restart
              </button>
            </div>
          </>
        )}

        {/* Error */}
        {phase === 'error' && (
          <>
            <p className="text-xs leading-relaxed text-rose-300">{progress.error || 'Something went wrong.'}</p>
            <div className="mt-3 flex justify-end gap-2">
              {!required && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
                >
                  Dismiss
                </button>
              )}
              <button
                type="button"
                onClick={onRetry}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-[#0b1120] hover:brightness-110"
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          </>
        )}

        {required && phase !== 'idle' && phase !== 'error' && (
          <p className="mt-2 text-[11px] text-rose-300/80">This update is required.</p>
        )}
      </div>
    </div>
  )

  return createPortal(card, document.body)
}
