import { api } from '../lib/ipc'
import { WindowControls } from './WindowControls'
import logoBlue from '../assets/logo-blue.svg'

type FramelessChromeProps = {
  children: React.ReactNode
  /** Show small logo in title bar */
  showLogo?: boolean
}

/** Frameless window shell with drag region + native-style controls. */
export function FramelessChrome({ children, showLogo = false }: FramelessChromeProps) {
  const frameless = !!api.frameless

  if (!frameless) {
    return <>{children}</>
  }

  async function onTitleBarDoubleClick() {
    if (!api.windowToggleMaximize) return
    await api.windowToggleMaximize()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="relative flex h-10 shrink-0 items-center border-b border-edge bg-panel2/95 pl-3 pr-1 select-none">
        <div className="app-drag absolute inset-0 z-0" onDoubleClick={onTitleBarDoubleClick} aria-hidden />
        {showLogo && (
          <div className="relative z-10 flex items-center gap-2 pointer-events-none">
            <img src={logoBlue} alt="" className="h-5 w-5" draggable={false} aria-hidden />
            <span className="text-xs font-semibold text-slate-300">DevFlow Manager</span>
          </div>
        )}
        <div className="relative z-10 ml-auto">
          <WindowControls />
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}
