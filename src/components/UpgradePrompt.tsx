import { Link } from 'react-router-dom'
import { Crown } from 'lucide-react'

export function UpgradePrompt({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-slate-300">
      <Crown size={16} className="shrink-0 text-amber-300" />
      <p className="flex-1">{message}</p>
      <Link
        to="/account"
        className="shrink-0 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/20"
      >
        Upgrade
      </Link>
    </div>
  )
}
