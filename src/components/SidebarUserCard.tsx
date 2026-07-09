import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Crown,
  ChevronDown,
  Loader2,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  ExternalLink,
  Settings,
} from 'lucide-react'
import { api, isElectron } from '../lib/ipc'
import { useGuestLock } from '../lib/guest'
import { notify } from '../state/notifications'
import { Skeleton } from './Skeleton'
import type { LicenseState } from '../shared/types'

type ChipVisual = {
  title: string
  subtitle: string
  icon: typeof Crown
  iconWrap: string
}

function chipVisual(state: LicenseState | null): ChipVisual {
  if (state?.guestMode && !state.signedIn) {
    return {
      title: 'Guest',
      subtitle: 'Sign in to unlock',
      icon: User,
      iconWrap: 'bg-amber-500/15 text-amber-300',
    }
  }
  if (!state?.signedIn) {
    return {
      title: 'Sign in',
      subtitle: 'DevTune account',
      icon: User,
      iconWrap: 'bg-slate-700/50 text-slate-300',
    }
  }
  if (state.valid && state.inGrace) {
    return {
      title: state.userName?.split(' ')[0] ?? state.plan ?? 'Pro',
      subtitle: 'Offline grace',
      icon: ShieldAlert,
      iconWrap: 'bg-amber-500/15 text-amber-400',
    }
  }
  if (state.valid && state.tier === 'freeapp') {
    const days = state.daysRemaining ?? 0
    return {
      title: state.userName?.split(' ')[0] ?? 'Trial',
      subtitle: days > 0 ? `Trial · ${days} day${days === 1 ? '' : 's'}` : 'Trial expired',
      icon: Sparkles,
      iconWrap: days > 0 ? 'bg-sky-500/15 text-sky-400' : 'bg-slate-700/50 text-slate-400',
    }
  }
  if (state.valid && state.tier === 'trial') {
    return {
      title: state.userName?.split(' ')[0] ?? 'Trial',
      subtitle: 'Trial · Pro features',
      icon: ShieldCheck,
      iconWrap: 'bg-sky-500/15 text-sky-400',
    }
  }
  if (state.valid) {
    const plan = (state.plan ?? 'Pro').charAt(0).toUpperCase() + (state.plan ?? 'pro').slice(1)
    return {
      title: state.userName?.split(' ')[0] ?? plan,
      subtitle: `${plan} · Licensed`,
      icon: Crown,
      iconWrap: 'bg-emerald-500/15 text-emerald-400',
    }
  }
  return {
    title: state.userName?.split(' ')[0] ?? 'Account',
    subtitle: 'Free',
    icon: Sparkles,
    iconWrap: 'bg-slate-700/50 text-slate-300',
  }
}

function fmtTokenExpiry(sec?: number) {
  if (!sec) return '—'
  return new Date(sec * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function planLabel(state: LicenseState) {
  if (!state.valid) return 'Free'
  if (state.tier === 'freeapp') {
    const days = state.daysRemaining
    return days != null ? `Desktop trial · ${days} day${days === 1 ? '' : 's'} left` : 'Desktop trial'
  }
  if (state.tier === 'trial') return `${state.plan ?? 'Pro'} trial`
  return (state.plan ?? 'Pro').charAt(0).toUpperCase() + (state.plan ?? 'pro').slice(1)
}

export function SidebarUserCard({
  expanded,
  onHoverStart,
}: {
  expanded: boolean
  onHoverStart?: () => void
}) {
  const [state, setState] = useState<LicenseState | null>(null)
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()
  const { guardGuest } = useGuestLock()

  useEffect(() => {
    let cancelled = false
    api.getLicenseState().then((s) => {
      if (!cancelled) {
        setState(s)
        setReady(true)
      }
    })
    const off = api.onLicenseChanged((s) => {
      if (!cancelled) setState(s as LicenseState)
    })
    return () => {
      cancelled = true
      off()
    }
  }, [])

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  const openCard = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    onHoverStart?.()
    setOpen(true)
  }

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 200)
  }

  async function signIn() {
    if (!isElectron) {
      navigate('/account')
      return
    }
    setBusy(true)
    const res = await api.startAuth()
    setBusy(false)
    if (res.ok && res.state) setState(res.state)
    else notify('warn', 'Sign in failed', res.error)
  }

  async function signOut() {
    setBusy(true)
    const res = await api.signOutAuth()
    setBusy(false)
    if (res.ok && res.state) {
      setState(res.state)
      setOpen(false)
      notify('info', 'Signed out', 'This device seat has been freed.')
    } else {
      notify('error', 'Sign out failed', res.error)
    }
  }

  if (!ready) {
    return (
      <div className="app-sidebar-rail-btn app-sidebar-rail-btn-skeleton" aria-hidden>
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    )
  }

  const v = chipVisual(state)
  const Icon = v.icon
  const avatar = state?.avatarUrl
  const signedIn = !!state?.signedIn && !state?.guestMode
  const isOpen = expanded && open

  if (!expanded) {
    return (
      <button
        type="button"
        className={`app-sidebar-rail-btn app-sidebar-rail-btn-profile ${v.iconWrap}`}
        title={v.subtitle}
        aria-label={v.title}
      >
        {avatar ? (
          <img src={avatar} alt="" className="app-sidebar-rail-avatar" draggable={false} />
        ) : (
          <Icon size={15} strokeWidth={1.75} />
        )}
      </button>
    )
  }

  return (
    <div
      className="app-sidebar-user-wrap"
      onMouseEnter={() => expanded && openCard()}
      onMouseLeave={scheduleClose}
    >
      <div className={`app-sidebar-user-card${isOpen ? ' app-sidebar-user-card-open' : ''}`}>
        <button
          type="button"
          className={`app-sidebar-user-header${expanded ? ' app-sidebar-user-header-expanded' : ''}`}
          onClick={() => {
            if (!expanded) return
            if (!signedIn) {
              void signIn()
              return
            }
            if (guardGuest()) return
            setOpen((o) => !o)
          }}
          title={v.subtitle}
        >
          {avatar ? (
            <img src={avatar} alt="" className="app-sidebar-user-avatar" draggable={false} />
          ) : (
            <span className={`app-sidebar-user-avatar ${v.iconWrap}`}>
              <Icon size={16} />
            </span>
          )}
          <span className="app-sidebar-user-text">
            <span className="app-sidebar-user-name">{v.title}</span>
            <span className="app-sidebar-user-sub">{state?.email ?? v.subtitle}</span>
          </span>
          {expanded && (
            <ChevronDown size={14} className={`app-sidebar-user-chevron${isOpen ? ' app-sidebar-user-chevron-open' : ''}`} />
          )}
        </button>

        {state && (
          <div className="app-sidebar-user-body">
            <div className="app-sidebar-user-body-inner">
              <dl className="app-sidebar-user-meta">
                <div>
                  <dt>Plan</dt>
                  <dd>{planLabel(state)}</dd>
                </div>
                {state.inGrace && (
                  <div>
                    <dt>Status</dt>
                    <dd className="text-amber-300">Offline grace</dd>
                  </div>
                )}
                {state.valid && state.tokenExpiresAt ? (
                  <div>
                    <dt>Token expires</dt>
                    <dd>{fmtTokenExpiry(state.tokenExpiresAt)}</dd>
                  </div>
                ) : null}
                {state.expiresAt ? (
                  <div>
                    <dt>License expires</dt>
                    <dd>{new Date(state.expiresAt).toLocaleDateString()}</dd>
                  </div>
                ) : null}
                {state.seatLimit != null ? (
                  <div>
                    <dt>Seats</dt>
                    <dd>
                      {state.seatsUsed ?? '—'} / {state.seatLimit}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <div className="app-sidebar-user-actions">
                {signedIn ? (
                  <>
                    <button
                      type="button"
                      className="app-sidebar-user-btn app-sidebar-user-btn-icon"
                      title="Account"
                      aria-label="Account"
                      onClick={() => {
                        if (guardGuest()) return
                        navigate('/account')
                      }}
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      type="button"
                      className="app-sidebar-user-btn app-sidebar-user-btn-icon app-sidebar-user-btn-danger"
                      title="Sign out"
                      aria-label="Sign out"
                      disabled={busy || !isElectron}
                      onClick={signOut}
                    >
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="app-sidebar-user-btn app-sidebar-user-btn-icon app-sidebar-user-btn-primary app-sidebar-user-btn-icon-solo"
                    title="Sign in with DevTune"
                    aria-label="Sign in with DevTune"
                    disabled={busy}
                    onClick={signIn}
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
