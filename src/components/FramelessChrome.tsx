import { api } from '../lib/ipc'
import { WindowControls } from './WindowControls'

type FramelessChromeProps = {
  children: React.ReactNode
}

/** Frameless shell: floating window controls + top drag region (no title bar). */
export function FramelessChrome({ children }: FramelessChromeProps) {
  const frameless = !!api.frameless

  if (!frameless) {
    return <>{children}</>
  }

  async function onTitleBarDoubleClick() {
    if (!api.windowToggleMaximize) return
    await api.windowToggleMaximize()
  }

  return (
    <div className="relative h-full min-h-0">
      <div
        className="app-drag absolute inset-x-0 top-0 z-0 h-10 select-none"
        onDoubleClick={onTitleBarDoubleClick}
        aria-hidden
      />
      <div className="absolute right-2 top-2 z-30 app-no-drag pointer-events-auto">
        <WindowControls variant="plain" />
      </div>
      <div className="relative z-10 h-full min-h-0">{children}</div>
    </div>
  )
}
