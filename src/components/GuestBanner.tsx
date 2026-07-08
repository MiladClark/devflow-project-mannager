import { useEffect, useState } from 'react'
import { LogIn, Lock } from 'lucide-react'
import { api, isElectron } from '../lib/ipc'
import { isGuestLicense } from '../lib/entitlements'
import type { LicenseState } from '../shared/types'

export function GuestBanner() {
  const [guest, setGuest] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = () => api.getLicenseState().then((s) => !cancelled && setGuest(isGuestLicense(s)))
    load()
    const off = api.onLicenseChanged((s) => !cancelled && setGuest(isGuestLicense(s as LicenseState)))
    return () => {
      cancelled = true
      off()
    }
  }, [])

  if (!guest) return null

  async function signIn() {
    if (!isElectron) return
    setBusy(true)
    await api.startAuth()
    setBusy(false)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-sm text-slate-200">
      <div className="flex min-w-0 items-center gap-2">
        <Lock size={16} className="shrink-0 text-amber-300" />
        <p className="min-w-0">
          <span className="font-medium text-amber-200">Guest mode</span>
          <span className="text-slate-400"> — dashboard preview only. Any menu or action opens the sign-in screen.</span>
        </p>
      </div>
      <button
        type="button"
        onClick={signIn}
        disabled={busy || !isElectron}
        className="press flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-400/20 disabled:opacity-50"
      >
        <LogIn size={14} />
        {busy ? 'Opening…' : 'Sign in with DevTune'}
      </button>
    </div>
  )
}
