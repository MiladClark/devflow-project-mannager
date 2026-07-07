import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Crown, Loader2, ShieldAlert, ShieldCheck, Sparkles, User } from 'lucide-react'
import { api } from '../lib/ipc'
import { Skeleton } from './Skeleton'
import type { LicenseState } from '../shared/types'

type ChipVisual = {
  title: string
  subtitle: string
  icon: typeof Crown
  iconWrap: string
  hover: string
}

function chipVisual(state: LicenseState | null): ChipVisual {
  if (!state?.signedIn) {
    return {
      title: 'Sign in',
      subtitle: 'DevTune account',
      icon: User,
      iconWrap: 'bg-slate-700/50 text-slate-300',
      hover: 'hover:bg-panel/80',
    }
  }

  if (state.valid && state.inGrace) {
    return {
      title: state.userName?.split(' ')[0] ?? state.plan ?? 'Pro',
      subtitle: 'Offline grace',
      icon: ShieldAlert,
      iconWrap: 'bg-amber-500/15 text-amber-400',
      hover: 'hover:bg-amber-500/5',
    }
  }

  if (state.valid && state.tier === 'freeapp') {
    const days = state.daysRemaining ?? 0
    return {
      title: state.userName?.split(' ')[0] ?? 'Trial',
      subtitle: days > 0 ? `Trial · ${days} day${days === 1 ? '' : 's'}` : 'Trial expired',
      icon: Sparkles,
      iconWrap: days > 0 ? 'bg-sky-500/15 text-sky-400' : 'bg-slate-700/50 text-slate-400',
      hover: days > 0 ? 'hover:bg-sky-500/5' : 'hover:bg-panel/80',
    }
  }

  if (state.valid && state.tier === 'trial') {
    return {
      title: state.userName?.split(' ')[0] ?? 'Trial',
      subtitle: 'Trial · Pro features',
      icon: ShieldCheck,
      iconWrap: 'bg-sky-500/15 text-sky-400',
      hover: 'hover:bg-sky-500/5',
    }
  }

  if (state.valid) {
    const plan = (state.plan ?? 'Pro').charAt(0).toUpperCase() + (state.plan ?? 'pro').slice(1)
    return {
      title: state.userName?.split(' ')[0] ?? plan,
      subtitle: `${plan} · Licensed`,
      icon: Crown,
      iconWrap: 'bg-emerald-500/15 text-emerald-400',
      hover: 'hover:bg-emerald-500/5',
    }
  }

  return {
    title: state.userName?.split(' ')[0] ?? 'Account',
    subtitle: 'Free',
    icon: Sparkles,
    iconWrap: 'bg-slate-700/50 text-slate-300',
    hover: 'hover:bg-panel/80',
  }
}

export function UserProfileChip() {
  const [state, setState] = useState<LicenseState | null>(null)
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()

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

  if (!ready) return <Skeleton className="h-10 w-44 rounded-xl" />

  const v = chipVisual(state)
  const Icon = v.icon
  const avatar = state?.avatarUrl

  return (
    <button
      type="button"
      onClick={() => navigate('/account')}
      className={`press flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-colors ${v.hover}`}
      title="Account & license"
    >
      {avatar ? (
        <img src={avatar} alt="" className="h-8 w-8 rounded-lg object-cover" draggable={false} />
      ) : (
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${v.iconWrap}`}>
          <Icon size={16} />
        </span>
      )}
      <span className="hidden min-w-0 text-left sm:block">
        <span className="block truncate text-sm font-semibold text-white">{v.title}</span>
        <span className="block truncate text-[11px] text-slate-400">{v.subtitle}</span>
      </span>
      <ChevronRight size={14} className="hidden shrink-0 text-slate-500 sm:block" />
    </button>
  )
}
