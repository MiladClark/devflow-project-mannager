import { useEffect, useState } from 'react'
import { Minus, Square, X } from 'lucide-react'
import { api } from '../lib/ipc'
import { confirmAction } from '../state/confirm'

function ControlBtn({
  title,
  onClick,
  children,
  hover,
  className = '',
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
  hover: string
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`app-no-drag pointer-events-auto flex h-8 w-9 items-center justify-center rounded-md text-slate-400 transition-colors ${hover} ${className}`}
    >
      {children}
    </button>
  )
}

/** Native-style minimize / maximize / close — shown when running frameless on Windows/Linux. */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!api.windowIsMaximized || !api.onWindowMaximized) return
    api.windowIsMaximized().then(setMaximized)
    return api.onWindowMaximized((maximized) => setMaximized(!!maximized))
  }, [])

  async function onClose() {
    const settings = await api.getSettings()
    const toTray = settings?.closeToTray ?? false
    const ok = await confirmAction({
      title: toTray ? 'Hide DevFlow?' : 'Close DevFlow?',
      message: toTray
        ? 'DevFlow will keep running in the system tray. Your dev servers stay active.'
        : 'Are you sure you want to close DevFlow? Unsaved work in other apps is not affected.',
      confirmLabel: toTray ? 'Hide to tray' : 'Close',
      cancelLabel: 'Cancel',
      variant: toTray ? 'default' : 'warning',
    })
    if (ok) await api.windowClose!()
  }

  if (!api.windowMinimize) return null

  return (
    <div className="ml-2 flex shrink-0 items-center gap-1 border-l border-edge py-1 pl-3 pr-1">
      <ControlBtn title="Minimize" onClick={() => api.windowMinimize!()} hover="hover:bg-slate-800/80 hover:text-slate-200">
        <Minus size={15} strokeWidth={2} />
      </ControlBtn>
      <ControlBtn
        title={maximized ? 'Restore' : 'Maximize'}
        onClick={async () => {
          const next = await api.windowToggleMaximize!()
          setMaximized(next)
        }}
        hover="hover:bg-slate-800/80 hover:text-slate-200"
      >
        {maximized ? (
          <span className="relative block h-3.5 w-3.5">
            <Square size={11} strokeWidth={2} className="absolute top-0 right-0" />
            <Square size={11} strokeWidth={2} className="absolute bottom-0 left-0" />
          </span>
        ) : (
          <Square size={12} strokeWidth={2} />
        )}
      </ControlBtn>
      <ControlBtn title="Close" onClick={onClose} hover="hover:bg-rose-600 hover:text-white">
        <X size={15} strokeWidth={2} />
      </ControlBtn>
    </div>
  )
}
