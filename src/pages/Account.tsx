import { useEffect, useState } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  LogOut,
  ExternalLink,
  Loader2,
  Download,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Globe,
} from 'lucide-react'
import { SkeletonAccountPage } from '../components/Skeleton'
import { api, isElectron } from '../lib/ipc'
import { isGuestLicense } from '../lib/entitlements'
import { notify } from '../state/notifications'
import type { LicenseState, UpdateCheckResult } from '../shared/types'

function fmtTs(sec?: number) {
  if (!sec) return '—'
  return new Date(sec * 1000).toLocaleString()
}

function StatusPill({ state }: { state: LicenseState }) {
  if (isGuestLicense(state)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm text-amber-300">
        <ShieldAlert size={14} /> Guest mode
      </span>
    )
  }
  if (!state.signedIn) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/60 bg-slate-700/20 px-3 py-1 text-sm text-slate-400">
        <ShieldAlert size={14} /> Not signed in
      </span>
    )
  }
  if (state.inGrace) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm text-amber-300">
        <ShieldAlert size={14} /> Offline grace — reconnect to revalidate
      </span>
    )
  }
  if (!state.valid) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/60 bg-slate-700/20 px-3 py-1 text-sm text-slate-400">
        <ShieldAlert size={14} /> Free limits
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
      <ShieldCheck size={14} />{' '}
      {state.tier === 'freeapp' ? 'Desktop trial' : state.tier === 'trial' ? 'Trial active' : `${(state.plan ?? 'Pro').toUpperCase()} active`}
    </span>
  )
}

function UpdateSection({ serverUrl }: { serverUrl: string }) {
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [result, setResult] = useState<UpdateCheckResult | null>(null)

  async function check() {
    setChecking(true)
    setResult(await api.checkUpdates())
    setChecking(false)
  }

  async function updateNow() {
    if (!result?.latest?.version) return
    setUpdating(true)
    await api.fetchPendingUpdate()
    const res = await api.startUpdate(result.latest.version)
    setUpdating(false)
    if (!res.ok) notify('error', 'Update failed', res.error)
  }

  useEffect(() => {
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-edge bg-panel p-5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">App Updates</h4>
        <button
          onClick={check}
          disabled={checking}
          className="flex items-center gap-2 rounded-lg border border-edge px-3 py-1.5 text-xs text-slate-300 hover:border-accent/50 disabled:opacity-50"
        >
          <RefreshCw size={13} className={checking ? 'animate-spin' : ''} /> Check now
        </button>
      </div>

      {!result ? (
        <p className="text-sm text-slate-500">Checking for updates...</p>
      ) : !result.ok ? (
        <p className="flex items-center gap-2 text-sm text-amber-300">
          <AlertTriangle size={14} /> {result.error}
        </p>
      ) : result.updateAvailable && result.latest ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-sm text-white">
            <Download size={15} className="text-accent" />
            Version <b>{result.latest.version}</b> is available (you have {result.currentVersion})
            {result.required && (
              <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-300">
                Required update
              </span>
            )}
          </p>
          {result.latest.releaseNotes && (
            <pre className="rounded-lg border border-edge bg-bg p-3 text-xs whitespace-pre-wrap text-slate-400">
              {result.latest.releaseNotes}
            </pre>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={updateNow}
              disabled={updating || !result.latest.downloadUrl}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-40"
            >
              {updating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Update now
            </button>
            {result.latest.sizeBytes != null && (
              <span className="text-xs text-slate-500">{(result.latest.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
            )}
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 size={15} /> You are up to date (v{result.currentVersion}).
        </p>
      )}
      <p className="text-xs text-slate-600">Updates are delivered from {serverUrl}</p>
    </div>
  )
}

export function Account() {
  const [state, setState] = useState<LicenseState | null>(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [serverUrl, setServerUrl] = useState('')

  async function loadState() {
    const st = await api.getLicenseState()
    setState(st)
    setServerUrl(st.serverUrl)
  }

  useEffect(() => {
    loadState()
    const off = api.onLicenseChanged((s) => {
      setState(s as LicenseState)
      setServerUrl((s as LicenseState).serverUrl)
    })
    return off
  }, [])

  async function refreshNow() {
    setBusy('refresh')
    setNotice('')
    const res = await api.refreshLicense()
    setBusy('')
    if (res.state) {
      setState(res.state)
      setServerUrl(res.state.serverUrl)
    }
    setNotice(res.ok ? 'License revalidated with the server.' : (res.error ?? ''))
    if (res.ok) notify('success', 'License revalidated')
    else notify('warn', 'Could not revalidate license', res.error)
  }

  async function signOut() {
    setBusy('clear')
    setNotice('')
    const res = await api.signOutAuth()
    setBusy('')
    if (res.ok && res.state) {
      setState(res.state)
      setNotice('Signed out. This device seat has been freed on the server.')
      notify('info', 'Signed out', 'Return to Sign in with DevTune to use DevFlow again.')
    } else {
      setNotice(res.error ?? 'Sign out failed')
      notify('error', 'Sign out failed', res.error)
    }
  }

  async function exitGuest() {
    setBusy('clear')
    const st = await api.clearLicense()
    setBusy('')
    setState(st)
    setNotice('Returned to the sign-in screen.')
  }

  async function signInFromGuest() {
    if (!isElectron) return
    setBusy('auth')
    const res = await api.startAuth()
    setBusy('')
    if (res.ok && res.state) setState(res.state)
    else setNotice(res.error ?? 'Sign in failed')
  }

  async function saveServerUrl() {
    const st = await api.setLicenseServerUrl(serverUrl.trim())
    setState(st)
    setServerUrl(st.serverUrl)
    setNotice(`Server URL set to ${st.serverUrl}`)
  }

  if (!state) {
    return <SkeletonAccountPage />
  }

  return (
    <div className="flex max-w-3xl flex-col gap-5 p-6 animate-content-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Account</h2>
        <StatusPill state={state} />
      </div>

      {notice && <p className="rounded-lg border border-edge bg-panel px-4 py-2.5 text-sm text-slate-300">{notice}</p>}

      {state.signedIn ? (
        <div className="rounded-xl border border-edge bg-panel p-5">
          <h4 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">Signed in</h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <span className="text-slate-500">Name</span>
            <span className="text-white">{state.userName ?? '—'}</span>
            <span className="text-slate-500">Email</span>
            <span className="text-white">{state.email ?? '—'}</span>
            <span className="text-slate-500">Plan</span>
            <span className="text-white capitalize">
              {state.valid ? (state.plan ?? '—') : 'Free'}
              {state.tier === 'trial' && ' (trial)'}
              {state.tier === 'freeapp' && state.daysRemaining != null && ` · ${state.daysRemaining} days left`}
            </span>
            <span className="text-slate-500">Device</span>
            <span className="flex items-center gap-1.5 text-white">
              <Monitor size={13} className="text-slate-500" /> {state.deviceLabel}
            </span>
            {state.seatLimit != null && (
              <>
                <span className="text-slate-500">Seats</span>
                <span className="text-white">
                  {state.seatsUsed ?? '—'} / {state.seatLimit}
                </span>
              </>
            )}
            {state.valid && (
              <>
                <span className="text-slate-500">Token valid until</span>
                <span className="text-white">{fmtTs(state.tokenExpiresAt)}</span>
                <span className="text-slate-500">Last validated</span>
                <span className="text-white">
                  {state.lastValidatedAt ? new Date(state.lastValidatedAt).toLocaleString() : '—'}
                </span>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {state.valid && (
              <button
                onClick={refreshNow}
                disabled={busy === 'refresh'}
                className="flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50 disabled:opacity-50"
              >
                {busy === 'refresh' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Revalidate
              </button>
            )}
            <button
              onClick={() => api.openExternal(`${state.serverUrl}/account/devices`)}
              className="flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50"
            >
              <ExternalLink size={14} /> Manage devices on DevTune
            </button>
            <button
              onClick={signOut}
              disabled={busy === 'clear' || !isElectron}
              title={isElectron ? undefined : 'Sign out only works in the desktop app'}
              className="flex items-center gap-2 rounded-lg border border-rose-500/30 px-4 py-2 text-sm text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
            >
              <LogOut size={14} /> Sign out this device
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Sign out requires an internet connection and frees this device seat immediately.</p>
        </div>
      ) : isGuestLicense(state) ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5">
          <h4 className="mb-2 text-xs font-semibold tracking-wider text-amber-300/80 uppercase">Guest mode</h4>
          <p className="mb-4 text-sm text-slate-400">
            You are browsing without a DevTune account. Sign in to unlock projects, terminals, imports, and licensing.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={signInFromGuest}
              disabled={busy === 'auth' || !isElectron}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-50"
            >
              {busy === 'auth' ? <Loader2 size={14} className="animate-spin" /> : null}
              Sign in with DevTune
            </button>
            <button
              onClick={exitGuest}
              disabled={busy === 'clear'}
              className="rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50 disabled:opacity-50"
            >
              Back to sign-in screen
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Use Sign in with DevTune from the app welcome screen.</p>
      )}

      <UpdateSection serverUrl={state.serverUrl} />

      <div className="rounded-xl border border-edge bg-panel p-5">
        <h4 className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">DevTune Server</h4>
        <p className="mb-2 text-xs text-slate-500">Licensing and updates are served from this address.</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe size={14} className="pointer-events-none absolute top-2.5 left-3 text-slate-500" />
            <input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="w-full rounded-lg border border-edge bg-bg py-2 pr-3 pl-9 text-sm text-slate-200 outline-none focus:border-accent/60"
            />
          </div>
          <button
            onClick={saveServerUrl}
            className="rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
