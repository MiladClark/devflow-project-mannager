import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { UserProfileChip } from './UserProfileChip'
import { SearchBox } from './SearchBox'
import { NotificationBell } from './NotificationBell'
import { DevTuneWebsiteButton } from './DevTuneWebsiteButton'
import { WindowControls } from './WindowControls'
import { api } from '../lib/ipc'
import logoBlue from '../assets/logo-blue.svg'

export function TopBar() {
  const navigate = useNavigate()
  const frameless = !!api.frameless

  async function onTitleBarDoubleClick() {
    if (!frameless || !api.windowToggleMaximize) return
    await api.windowToggleMaximize()
  }

  const interactive = frameless ? 'pointer-events-auto app-no-drag' : ''

  return (
    <header
      className={`relative flex h-16 shrink-0 items-center gap-4 border-b border-edge bg-panel2 pl-5 ${frameless ? 'select-none pr-2' : 'px-5'}`}
    >
      {frameless && <div className="app-drag absolute inset-0 z-0" onDoubleClick={onTitleBarDoubleClick} aria-hidden />}

      <div className={`relative z-10 flex min-w-0 flex-1 items-center gap-4 ${frameless ? 'pointer-events-none' : ''}`}>
        <div className="flex shrink-0 items-center gap-2">
          <img src={logoBlue} alt="DevFlow" className="h-9 w-9" draggable={false} />
          <h1 className="text-lg font-bold text-white">
            DevFlow <span className="font-normal text-slate-400">Manager</span>
          </h1>
        </div>

        <div className={interactive}>
          <UserProfileChip />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center">
          <SearchBox className={interactive} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className={interactive}>
            <DevTuneWebsiteButton />
          </div>
          <div className={interactive}>
            <NotificationBell />
          </div>
          <button
            onClick={() => navigate('/new')}
            className={`press flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition-colors hover:bg-cyan-300 ${interactive}`}
          >
            New Project <Plus size={16} />
          </button>
        </div>
      </div>

      {frameless && (
        <div className="relative z-10 shrink-0 pointer-events-none">
          <WindowControls />
        </div>
      )}
    </header>
  )
}
