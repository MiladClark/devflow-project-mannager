import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/ipc'
import type { UpdateAvailablePayload, UpdateProgress } from '../shared/types'
import { UpdateWidget } from './UpdateWidget'

const IDLE: UpdateProgress = { phase: 'idle', percent: 0, message: '' }
const ACTIVE_PHASES: UpdateProgress['phase'][] = [
  'downloading',
  'paused',
  'verifying',
  'ready',
  'applying',
  'restarting',
  'error',
]

export function UpdateRoot() {
  const [available, setAvailable] = useState<UpdateAvailablePayload | null>(null)
  const [progress, setProgress] = useState<UpdateProgress>(IDLE)
  // Kept in a ref so the progress listener can auto-install required updates
  // without re-subscribing on every state change.
  const requiredRef = useRef(false)

  const startDownload = useCallback(async (version?: string, required?: boolean) => {
    setProgress({ phase: 'downloading', percent: 0, message: 'Starting download…', version })
    const res = await api.startUpdate(version, required)
    if (!res.ok && res.error && res.error !== 'Update cancelled') {
      setProgress((p) => ({
        phase: 'error',
        percent: 0,
        message: 'Update failed',
        error: res.error ?? 'Update failed',
        version: p.version ?? version,
      }))
    }
  }, [])

  const hide = useCallback(() => {
    requiredRef.current = false
    setAvailable(null)
    setProgress(IDLE)
  }, [])

  const cancel = useCallback(async () => {
    await api.cancelUpdate?.()
    hide()
  }, [hide])

  useEffect(() => {
    const offAvailable = api.onUpdateAvailable((payload) => {
      const p = payload as UpdateAvailablePayload
      requiredRef.current = !!p.required
      setAvailable(p)
      setProgress((prev) => (ACTIVE_PHASES.includes(prev.phase) ? prev : { ...IDLE, version: p.version }))
      if (p.required) void startDownload(p.version, true)
    })
    const offProgress = api.onUpdateProgress((raw) => {
      const prog = raw as UpdateProgress
      if (prog.phase === 'cancelled') {
        hide()
        return
      }
      setProgress(prog)
      // Required updates are mandatory — install as soon as they're verified.
      if (prog.phase === 'ready' && requiredRef.current) void api.installUpdate?.()
    })
    void api.fetchPendingUpdate()
    return () => {
      offAvailable()
      offProgress()
    }
  }, [startDownload, hide])

  const visible = !!available || ACTIVE_PHASES.includes(progress.phase)
  if (!visible) return null

  const version = progress.version ?? available?.version
  const required = requiredRef.current

  return (
    <UpdateWidget
      progress={progress}
      available={available}
      onDownload={() => void startDownload(version, required)}
      onPause={() => void api.pauseUpdate?.()}
      onResume={() => void api.resumeUpdate?.()}
      onInstall={() => void api.installUpdate?.()}
      onCancel={() => void cancel()}
      onRetry={() => void startDownload(version, required)}
    />
  )
}
