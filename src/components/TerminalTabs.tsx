import { useCallback, useEffect, useState } from 'react'
import { Plus, X, TerminalSquare, Loader2, ChevronDown } from 'lucide-react'
import { api, isElectron } from '../lib/ipc'
import { useEntitlements } from '../lib/entitlements'
import { UpgradePrompt } from './UpgradePrompt'
import { TerminalView } from './Terminal'
import type { TermSessionInfo, TermShell } from '../shared/types'

const SHELL_LABEL: Record<TermShell, string> = {
  pwsh: 'PowerShell 7',
  powershell: 'PowerShell',
  gitbash: 'Git Bash',
  cmd: 'CMD',
  zsh: 'zsh',
  bash: 'bash',
  sh: 'sh',
}

export function TerminalTabs({ projectId, cwd }: { projectId: string; cwd: string }) {
  const [sessions, setSessions] = useState<TermSessionInfo[]>([])
  const [active, setActive] = useState('')
  const [shells, setShells] = useState<TermShell[]>([])
  const [shellMenu, setShellMenu] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const entitlements = useEntitlements()

  const refresh = useCallback(async () => {
    const list = await api.termList(projectId)
    setSessions(list)
    setActive((cur) => (list.some((s) => s.sessionId === cur) ? cur : (list[0]?.sessionId ?? '')))
  }, [projectId])

  useEffect(() => {
    refresh()
    api.termShells().then(setShells)
  }, [refresh])

  async function create(shell: TermShell) {
    setShellMenu(false)
    setCreating(true)
    setError('')
    const res = await api.termCreate({ projectId, cwd, shell, cols: 100, rows: 28 })
    setCreating(false)
    if (res.ok && res.sessionId) {
      await refresh()
      setActive(res.sessionId)
    } else if (res.error === 'free_limit') {
      setError('free_limit')
    } else {
      setError(res.error ?? 'Could not start terminal')
    }
  }

  async function close(sessionId: string) {
    await api.termDispose(sessionId)
    await refresh()
  }

  const onExit = useCallback(() => {
    refresh()
  }, [refresh])

  if (!isElectron) {
    return (
      <div className="rounded-xl border border-dashed border-edge p-8 text-sm text-slate-500">
        The integrated terminal is only available in the desktop app.
      </div>
    )
  }

  return (
    <div className="flex h-[30rem] flex-col gap-2">
      <div className="flex items-center gap-1">
        {sessions.map((s) => (
          <div
            key={s.sessionId}
            className={`flex items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-1.5 text-xs ${
              active === s.sessionId
                ? 'border-edge bg-panel text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <button onClick={() => setActive(s.sessionId)} className="flex items-center gap-1.5">
              <TerminalSquare size={12} /> {SHELL_LABEL[s.shell]}
            </button>
            <button onClick={() => close(s.sessionId)} className="text-slate-600 hover:text-rose-400">
              <X size={12} />
            </button>
          </div>
        ))}
        <div className="relative">
          <button
            onClick={() => setShellMenu(!shellMenu)}
            disabled={creating}
            className="flex items-center gap-1 rounded-lg border border-edge px-2.5 py-1.5 text-xs text-slate-300 hover:border-accent/50 disabled:opacity-40"
          >
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} New
            <ChevronDown size={11} />
          </button>
          {shellMenu && (
            <div className="animate-pop-in absolute top-8 left-0 z-20 w-40 rounded-lg border border-edge bg-panel p-1 shadow-xl">
              {shells.map((sh) => (
                <button
                  key={sh}
                  onClick={() => create(sh)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-slate-300 hover:bg-accent/10 hover:text-white"
                >
                  <TerminalSquare size={12} /> {SHELL_LABEL[sh]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error === 'free_limit' ? (
        <UpgradePrompt message="The Free plan includes one terminal session at a time. Upgrade to Pro for unlimited sessions." />
      ) : error ? (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
      ) : null}

      <div className="min-h-0 flex-1">
        {active ? (
          <TerminalView key={active} sessionId={active} onExit={onExit} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-edge text-sm text-slate-500">
            {entitlements.loaded && (
              <span>
                No terminal session. Click <b>New</b> to open {SHELL_LABEL[shells[0] ?? 'powershell']} in the project
                folder.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
