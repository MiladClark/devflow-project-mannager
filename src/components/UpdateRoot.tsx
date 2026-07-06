import { useCallback, useEffect, useState } from 'react'
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

  const beginUpdate = useCallback(async (version?: string) => {
    setUpdating(true)
    setProgress({ phase: 'downloading', percent: 0, message: 'Starting download…', version })
    const res = await api.startUpdate(version)
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
    setUpdating(false)
    setProgress(IDLE)
  }, [])

  useEffect(() => {
    const offAvailable = api.onUpdateAvailable((payload) => {
      const p = payload as UpdateAvailablePayload
      setAvailable(p)
      setBannerDismissed(false)
      if (p.required) void beginUpdate(p.version)
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
      }
    })
    void api.fetchPendingUpdate()
    return () => {
      offAvailable()
      offProgress()
    }
  }, [beginUpdate])

  const showBanner = available && !bannerDismissed && !updating && !available.required
  const canCancel = progress.phase === 'downloading' || progress.phase === 'verifying'

  return (
    <>
      {showBanner && (
        <UpdateBanner
          version={available.version}
          required={available.required}
          onUpdate={() => void beginUpdate(available.version)}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}
      {updating && (
        <UpdateModal
          progress={progress}
          required={available?.required}
          canCancel={canCancel}
          onCancel={() => void cancelUpdate()}
          onDismiss={() => {
            setUpdating(false)
            setProgress(IDLE)
          }}
        />
      )}
    </>
  )
}
