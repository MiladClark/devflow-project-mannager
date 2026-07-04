import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SubscriptionButton } from './SubscriptionButton'
import { SearchBox } from './SearchBox'
import logoUrl from '../assets/logo.svg'

export function TopBar() {
  const navigate = useNavigate()

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-edge bg-panel2 px-5">
      <div className="flex items-center gap-2">
        <img src={logoUrl} alt="DevFlow" className="h-9 w-9" />
        <h1 className="text-lg font-bold text-white">
          DevFlow <span className="font-normal text-slate-400">Manager</span>
        </h1>
      </div>

      <SubscriptionButton />

      <SearchBox />

      <button
        onClick={() => navigate('/new')}
        className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition-colors hover:bg-cyan-300"
      >
        New Project <Plus size={16} />
      </button>
    </header>
  )
}
