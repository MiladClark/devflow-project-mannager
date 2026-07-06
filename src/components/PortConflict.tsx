import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { api } from '../lib/ipc'
import { notify } from '../state/notifications'
import type { PortOwner } from '../shared/types'

/**
 * Shown when a port a project needs is held by another process.
 * Offers Yes/No to close the external process and start from DevFlow,
 * or stop a DevFlow-managed project that owns the port.
 */
export function PortConflict({
  owner,
  projectName,
  onResolved,
  onDismiss,
  onError,
}: {
  owner: PortOwner
  projectName?: string
  onResolved: () => void
  onDismiss: () => void
  onError?: (msg: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const url = `http://localhost:${owner.port}/`

  async function closeAndStart() {
    setBusy(true)
    const res = await api.takeoverPort(owner.port, { skipConfirm: true })
    setBusy(false)
    if (res.ok) {
      notify('success', `Port ${owner.port} freed`, `Closed ${owner.processName} (PID ${owner.pid})`)
      onResolved()
    } else if (res.error && res.error !== 'Cancelled.') {
      notify('error', `Could not free port ${owner.port}`, res.error)
      onError?.(res.error)
    }
  }

  async function stopManaged() {
    if (!owner.managedProjectId) return
    setBusy(true)
    await api.stopProject(owner.managedProjectId)
    setBusy(false)
    onResolved()
  }

  const externalMessage = projectName ? (
    <>
      <b>{projectName}</b> appears to be running outside DevFlow at{' '}
      <button
        type="button"
        onClick={() => api.openExternal(url)}
        className="font-medium text-accent underline-offset-2 hover:underline"
      >
        {url}
      </button>
      . Close it and start from DevFlow?
    </>
  ) : (
    <>
      Port <b>{owner.port}</b> is in use at{' '}
      <button
        type="button"
        onClick={() => api.openExternal(url)}
        className="font-medium text-accent underline-offset-2 hover:underline"
      >
        {url}
      </button>{' '}
      by <b>{owner.processName}</b> (PID {owner.pid}). Close it and start from DevFlow?
    </>
  )

  const managedMessage = (
    <>
      <b>{owner.managedProjectName}</b> is already running on port <b>{owner.port}</b> at{' '}
      <button
        type="button"
        onClick={() => api.openExternal(url)}
        className="font-medium text-accent underline-offset-2 hover:underline"
      >
        {url}
      </button>
      . Stop it and start {projectName ? <b>{projectName}</b> : 'this project'} here?
    </>
  )

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
      <AlertTriangle size={15} className="shrink-0 text-amber-300" />
      <span className="min-w-0 flex-1">{owner.managedProjectId ? managedMessage : externalMessage}</span>
      {owner.managedProjectId ? (
        <>
          <button
            onClick={stopManaged}
            disabled={busy}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/25 disabled:opacity-40"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : null}
            Yes, stop and start here
          </button>
          <button
            onClick={onDismiss}
            disabled={busy}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-edge px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800/60 disabled:opacity-40"
          >
            No, keep running
          </button>
        </>
      ) : owner.killable ? (
        <>
          <button
            onClick={closeAndStart}
            disabled={busy}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/25 disabled:opacity-40"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : null}
            Yes, close and start here
          </button>
          <button
            onClick={onDismiss}
            disabled={busy}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-edge px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800/60 disabled:opacity-40"
          >
            No, keep running
          </button>
        </>
      ) : (
        <span className="text-xs text-amber-300/80">{owner.reason}</span>
      )}
    </div>
  )
}
