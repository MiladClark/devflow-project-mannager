import { useEffect, useState } from 'react'
import { Minus, Square, X } from 'lucide-react'
import { api } from '../lib/ipc'
import { confirmAction } from '../state/confirm'

function ControlBtn({
  title,
  onClick,
  children,
  danger = false,
  plain = false,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
  plain?: boolean
}) {
  if (plain) {
    // Same square hover as the dashboard toolbar buttons, but with no header
    // bar / container background — just floating controls (login + update pages).
    return (
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={`app-no-drag flex h-9 w-9 items-center justify-center text-slate-400 transition-colors duration-200 ${
          danger ? 'hover:bg-rose-600 hover:text-white' : 'hover:bg-slate-800/60 hover:text-slate-200'
        }`}
      >
        {children}
      </button>
    )
  }

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`app-no-drag app-toolbar-btn ${danger ? 'app-toolbar-btn-danger' : ''}`}
    >
      {children}
    </button>
  )
}

/** Native-style minimize / maximize / close — shown when running frameless on Windows/Linux. */
export function WindowControls({
  className = '',
  variant = 'toolbar',
}: {
  className?: string
  variant?: 'toolbar' | 'plain'
}) {
  const [maximized, setMaximized] = useState(false)
  const plain = variant === 'plain'

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

  const minimizeBtn = (
    <ControlBtn plain={plain} title="Minimize" onClick={() => api.windowMinimize!()}>
      <Minus size={15} strokeWidth={2} />
    </ControlBtn>
  )

  const maximizeBtn = (
    <ControlBtn
      plain={plain}
      title={maximized ? 'Restore' : 'Maximize'}
      onClick={async () => {
        const next = await api.windowToggleMaximize!()
        setMaximized(next)
      }}
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
  )

  const closeBtn = (
    <ControlBtn plain={plain} title="Close" onClick={onClose} danger>
      <X size={15} strokeWidth={2} />
    </ControlBtn>
  )

  if (plain) {
    return (
      <div
        className={`app-no-drag pointer-events-auto flex shrink-0 items-center gap-0 ${className}`}
        role="group"
        aria-label="Window controls"
      >
        {minimizeBtn}
        {maximizeBtn}
        {closeBtn}
      </div>
    )
  }

  return (
    <div
      className={`app-toolbar app-no-drag pointer-events-auto shrink-0 ${className}`}
      role="group"
      aria-label="Window controls"
    >
      <div className="app-toolbar-item">{minimizeBtn}</div>
      <div className="app-toolbar-item">{maximizeBtn}</div>
      <div className="app-toolbar-item">{closeBtn}</div>
    </div>
  )
}
