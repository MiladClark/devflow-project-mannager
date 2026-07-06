import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Crown, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react'
import { api } from '../lib/ipc'
import { Skeleton } from './Skeleton'
import type { LicenseState } from '../shared/types'

type LicenseVisual = {
  title: string
  subtitle: string
  icon: typeof Crown
  iconWrap: string
  border: string
  hover: string
}

function licenseVisual(state: LicenseState | null): LicenseVisual {
  if (!state?.activated) {
    return {
      title: 'Free plan',
      subtitle: 'Activate license',
      icon: Sparkles,
      iconWrap: 'bg-slate-700/50 text-slate-300',
      border: 'border-edge hover:border-accent/40',
      hover: 'hover:bg-panel',
    }
  }

  if (!state.valid) {
    return {
      title: 'License issue',
      subtitle: 'Needs attention',
      icon: ShieldAlert,
      iconWrap: 'bg-rose-500/15 text-rose-400',
      border: 'border-rose-500/35 hover:border-rose-500/50',
      hover: 'hover:bg-rose-500/5',
    }
  }

  if (state.inGrace) {
    return {
      title: (state.plan ?? 'Pro').toUpperCase(),
      subtitle: 'Offline grace',
      icon: ShieldAlert,
      iconWrap: 'bg-amber-500/15 text-amber-400',
      border: 'border-amber-500/35 hover:border-amber-500/50',
      hover: 'hover:bg-amber-500/5',
    }
  }

  if (state.tier === 'freeapp') {
    const days = state.daysRemaining ?? 0
    return {
      title: 'Free',
      subtitle: days > 0 ? `${days} day${days === 1 ? '' : 's'} left` : 'Expired',
      icon: Sparkles,
      iconWrap: days > 0 ? 'bg-sky-500/15 text-sky-400' : 'bg-slate-700/50 text-slate-400',
      border: days > 0 ? 'border-sky-500/35 hover:border-sky-500/50' : 'border-edge hover:border-accent/40',
      hover: days > 0 ? 'hover:bg-sky-500/5' : 'hover:bg-panel',
    }
  }

  if (state.tier === 'trial') {
    return {
      title: 'Trial',
      subtitle: 'Explore Pro features',
      icon: ShieldCheck,
      iconWrap: 'bg-sky-500/15 text-sky-400',
      border: 'border-sky-500/35 hover:border-sky-500/50',
      hover: 'hover:bg-sky-500/5',
    }
  }

  return {
    title: (state.plan ?? 'Pro').toUpperCase(),
    subtitle: 'Licensed',
    icon: Crown,
    iconWrap: 'bg-emerald-500/15 text-emerald-400',
    border: 'border-emerald-500/35 hover:border-emerald-500/50',
    hover: 'hover:bg-emerald-500/5',
  }
}

/** Top-bar license chip — opens Account & License. */
export function SubscriptionButton() {
  const [state, setState] = useState<LicenseState | null>(null)
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    const load = () =>
      api.getLicenseState().then((s) => {
        if (!cancelled) {
          setState(s)
          setReady(true)
        }
      })
    load()
    const off = api.onLicenseChanged((s) => {
      if (!cancelled) {
        setState(s as LicenseState)
        setReady(true)
      }
    })
    const t = setInterval(load, 60000)
    return () => {
      cancelled = true
      off()
      clearInterval(t)
    }
  }, [])

  if (!ready) {
    return <Skeleton className="h-9 w-[7.5rem] rounded-xl" />
  }

  const v = licenseVisual(state)
  const Icon = v.icon

  return (
    <button
      type="button"
      onClick={() => navigate('/account')}
      title="Account & License"
      className={`press group flex items-center gap-2 rounded-xl border bg-panel2/60 py-1 pl-1.5 pr-2.5 transition-all ${v.border} ${v.hover}`}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${v.iconWrap}`}>
        <Icon size={14} strokeWidth={2.25} />
      </span>
      <span className="flex min-w-0 flex-col items-start leading-tight">
        <span className="text-xs font-semibold tracking-wide text-slate-100">{v.title}</span>
        <span className="text-[10px] text-slate-500 group-hover:text-slate-400">{v.subtitle}</span>
      </span>
      <ChevronRight
        size={14}
        className="shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400"
      />
    </button>
  )
}
