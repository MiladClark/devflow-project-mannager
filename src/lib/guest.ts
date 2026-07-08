import { useCallback, useEffect, useState } from 'react'
import { api } from './ipc'
import { isGuestLicense } from './entitlements'
import type { LicenseState } from '../shared/types'

/** Guest browse mode: any navigation / feature click returns to the sign-in screen. */
export function useGuestLock() {
  const [isGuest, setIsGuest] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = () => api.getLicenseState().then((s) => !cancelled && setIsGuest(isGuestLicense(s)))
    load()
    const off = api.onLicenseChanged((s) => !cancelled && setIsGuest(isGuestLicense(s as LicenseState)))
    return () => {
      cancelled = true
      off()
    }
  }, [])

  const returnToSignIn = useCallback(async () => {
    await api.clearLicense()
  }, [])

  /** Returns true when the action was blocked and the user was sent to sign-in. */
  const guardGuest = useCallback(
    (e?: { preventDefault?: () => void }) => {
      if (!isGuest) return false
      e?.preventDefault?.()
      void returnToSignIn()
      return true
    },
    [isGuest, returnToSignIn],
  )

  return { isGuest, returnToSignIn, guardGuest }
}
