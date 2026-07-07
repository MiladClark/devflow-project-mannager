import { useEffect, useState } from 'react'
import { Loader2, LogIn } from 'lucide-react'
import { api, isElectron } from '../lib/ipc'
import { notify } from '../state/notifications'
import logoBlue from '../assets/logo-blue.svg'
import { FramelessChrome } from './FramelessChrome'

export function LoginGate({ children }: { children: React.ReactNode }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const st = await api.getLicenseState()
    setSignedIn(!!st.signedIn)
  }

  useEffect(() => {
    load()
    const off = api.onLicenseChanged((s) => setSignedIn(!!(s as { signedIn?: boolean }).signedIn))
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
      setSignedIn(!!res.state.signedIn)
      notify('success', 'Signed in', res.state.userName ?? res.state.email)
    } else {
      setError(res.error ?? 'Sign in failed')
      notify('error', 'Sign in failed', res.error)
    }
  }

  if (signedIn === null) {
    return (
      <FramelessChrome>
        <div className="flex h-full items-center justify-center bg-bg">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      </FramelessChrome>
    )
  }

  if (!signedIn) {
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
        </div>
      </FramelessChrome>
    )
  }

  return <>{children}</>
}
