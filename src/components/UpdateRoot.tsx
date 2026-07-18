import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/ipc'
import type { UpdateAvailablePayload, UpdateProgress } from '../shared/types'
import { UpdateBanner } from './UpdateBanner'
import { UpdateModal } from './UpdateModal'

const IDLE: UpdateProgress = { phase: 'idle', percent: 0, message: '' }

export function UpdateRoot() {
  const [available, setAvailable] = useState<UpdateAvailablePayload | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [progress, setProgress] = useState<UpdateProgress>(IDLE)
  const [updating, setUpdating] = useState(false)
  // Ref, not state: the main process can broadcast `updates:available` more than
  // once for the same update (startup timer + a manual "Check for updates"
  // click racing each other) — state updates from the first call haven't
  // committed yet when the second event arrives, so a state-only guard misses
  // the race. Without this, a required update's second beginUpdate() call hits
  // updater.ts's "already in progress" guard, which used to surface as a false
  // failure with no way to dismiss it (required updates hide Continue).
  const updatingRef = useRef(false)

  const beginUpdate = useCallback(async (version?: string, required?: boolean) => {
    if (updatingRef.current) return
    updatingRef.current = true
    setUpdating(true)
    setProgress({ phase: 'downloading', percent: 0, message: 'Starting download…', version })
    const res = await api.startUpdate(version, required)
    if (!res.ok) {
      setProgress((p) => ({
        phase: 'error',
        percent: 0,
        message: 'Update failed',
        error: res.error ?? 'Update failed',
        version: p.version ?? version,
      }))
      setUpdating(true)
    }
  }, [])

  const cancelUpdate = useCallback(async () => {
    await api.cancelUpdate?.()
    updatingRef.current = false
    setUpdating(false)
    setProgress(IDLE)
  }, [])

  useEffect(() => {
    const offAvailable = api.onUpdateAvailable((payload) => {
      const p = payload as UpdateAvailablePayload
      setAvailable(p)
      setBannerDismissed(false)
      if (p.required) void beginUpdate(p.version, true)
    })
    const offProgress = api.onUpdateProgress((p) => {
      const prog = p as UpdateProgress
      setProgress(prog)
      if (
        prog.phase === 'downloading' ||
        prog.phase === 'verifying' ||
        prog.phase === 'applying' ||
        prog.phase === 'restarting'
      ) {
        setUpdating(true)
      }
      if (prog.phase === 'error' || prog.phase === 'cancelled') {
        setUpdating(prog.phase === 'error')
        updatingRef.current = prog.phase === 'error'
      }
    })
    void api.fetchPendingUpdate()
    return () => {
      offAvailable()
      offProgress()
    }
  }, [beginUpdate])

  const showBanner = available && !bannerDismissed && !updating && !available.required
  // Cancel only while the download itself is in flight and abortable — once
  // verify/apply starts the file is already on disk, so "cancelling" there
  // used to just fake a "cancelled" UI state while the update proceeded (and
  // restarted the app) anyway. Required updates can't be cancelled at all.
  const canCancel = !available?.required && progress.phase === 'downloading'

  return (
    <>
      {showBanner && (
        <UpdateBanner
          version={available.version}
          required={available.required}
          onUpdate={() => void beginUpdate(available.version, available.required)}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}
      {updating && (
        <UpdateModal
          progress={progress}
          required={available?.required}
          canCancel={canCancel}
          onCancel={() => void cancelUpdate()}
          onRetry={
            progress.phase === 'error'
              ? () => void beginUpdate(progress.version, available?.required)
              : undefined
          }
          onDismiss={() => {
            updatingRef.current = false
            setUpdating(false)
            setProgress(IDLE)
          }}
        />
      )}
    </>
  )
}
