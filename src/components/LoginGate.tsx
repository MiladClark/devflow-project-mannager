import { useEffect, useState } from 'react'
import { Loader2, LogIn } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api, isElectron } from '../lib/ipc'
import { notify } from '../state/notifications'
import logoBlue from '../assets/logo-blue.svg'
import { FramelessChrome } from './FramelessChrome'
import type { LicenseState } from '../shared/types'

function hasAppAccess(state: LicenseState): boolean {
  return !!state.signedIn || !!state.guestMode
}

export function LoginGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [access, setAccess] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const st = await api.getLicenseState()
    setAccess(hasAppAccess(st))
  }

  useEffect(() => {
    load()
    const off = api.onLicenseChanged((s) => setAccess(hasAppAccess(s as LicenseState)))
    return off
  }, [])

  async function signIn() {
    if (!isElectron) {
      setError('Sign in is only available in the DevFlow desktop app.')
      return
    }
    setBusy(true)
    setError('')
    const res = await api.startAuth()
    setBusy(false)
    if (res.ok && res.state) {
      setAccess(hasAppAccess(res.state))
      notify('success', 'Signed in', res.state.userName ?? res.state.email)
    } else {
      setError(res.error ?? 'Sign in failed')
      notify('error', 'Sign in failed', res.error)
    }
  }

  async function continueAsGuest() {
    setBusy(true)
    setError('')
    const st = await api.enterGuestMode()
    setBusy(false)
    setAccess(hasAppAccess(st))
    navigate('/', { replace: true })
  }

  if (access === null) {
    return (
      <FramelessChrome>
        <div className="flex h-full items-center justify-center bg-bg">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      </FramelessChrome>
    )
  }

  if (!access) {
    return (
      <FramelessChrome>
        <div className="flex h-full flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
          <img src={logoBlue} alt="DevFlow" className="h-16 w-16" draggable={false} />
          <div>
            <h1 className="text-2xl font-bold text-white">DevFlow Manager</h1>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              Sign in with your DevTune account to activate this device, start your one-time desktop trial, or continue
              with free limits.
            </p>
          </div>
          {error && <p className="max-w-md text-sm text-rose-400">{error}</p>}
          <button
            onClick={signIn}
            disabled={busy}
            className="press flex items-center gap-2 rounded-xl bg-accent px-8 py-3 text-base font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-50"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            Sign in with DevTune
          </button>
          <p className="text-xs text-slate-600">Your browser will open to authorize this device.</p>
          <button
            type="button"
            onClick={continueAsGuest}
            disabled={busy}
            className="text-sm text-slate-500 underline decoration-slate-600 underline-offset-4 transition-colors hover:text-slate-300"
          >
            Continue without signing in
          </button>
          <p className="max-w-sm text-[11px] leading-relaxed text-slate-600">
            Guest mode shows the dashboard only. Choose any menu item to return here and sign in.
          </p>
        </div>
      </FramelessChrome>
    )
  }

  return <>{children}</>
}
