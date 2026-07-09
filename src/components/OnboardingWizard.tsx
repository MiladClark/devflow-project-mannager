import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Moon, Plus, Sun, X } from 'lucide-react'
import logoBlue from '../assets/logo-blue.svg'
import { api, isElectron } from '../lib/ipc'
import { FONTS, applyFont, getFontId } from '../lib/font'
import { THEMES, applyTheme, getThemeChoice, type ThemeMode } from '../lib/theme'
import { useApp } from '../state/store'
import type { AppSettings, PreferredEditor, PreferredNodeManager } from '../shared/types'
import { FramelessChrome } from './FramelessChrome'
import { SwitchField } from './Switch'

const STEPS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'projects', label: 'Projects' },
  { id: 'behavior', label: 'Behavior' },
  { id: 'editor', label: 'Editor' },
] as const

type DraftSettings = Pick<
  AppSettings,
  | 'defaultProjectsDir'
  | 'reservedPorts'
  | 'launchAtLogin'
  | 'startMinimized'
  | 'openOutputAfterBuild'
  | 'closeToTray'
  | 'notifyCrash'
  | 'notifyBuild'
  | 'notifyUpdates'
  | 'preferredEditor'
  | 'customEditorCmd'
  | 'preferredNodeManager'
>

type OnboardingWizardProps = {
  settings: AppSettings
  onDone: (updated: AppSettings) => void
}

export function OnboardingWizard({ settings, onDone }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [themeChoice, setThemeChoice] = useState(getThemeChoice)
  const [fontId, setFontId] = useState(getFontId)
  const [newPort, setNewPort] = useState('')
  const [draft, setDraft] = useState<DraftSettings>(() => ({
    defaultProjectsDir: settings.defaultProjectsDir,
    reservedPorts: [...settings.reservedPorts],
    launchAtLogin: settings.launchAtLogin,
    startMinimized: settings.startMinimized,
    openOutputAfterBuild: settings.openOutputAfterBuild,
    closeToTray: settings.closeToTray,
    notifyCrash: settings.notifyCrash,
    notifyBuild: settings.notifyBuild,
    notifyUpdates: settings.notifyUpdates,
    preferredEditor: settings.preferredEditor,
    customEditorCmd: settings.customEditorCmd ?? '',
    preferredNodeManager: settings.preferredNodeManager,
  }))

  useEffect(() => {
    applyTheme(themeChoice)
  }, [themeChoice])

  useEffect(() => {
    applyFont(fontId)
  }, [fontId])

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step])
  const isLast = step === STEPS.length - 1

  function patchDraft(p: Partial<DraftSettings>) {
    setDraft((cur) => ({ ...cur, ...p }))
  }

  function addPort() {
    const n = Number(newPort)
    if (Number.isInteger(n) && n >= 1 && n <= 65535 && !draft.reservedPorts.includes(n)) {
      patchDraft({ reservedPorts: [...draft.reservedPorts, n].sort((a, b) => a - b) })
    }
    setNewPort('')
  }

  async function finish(skip: boolean) {
    setBusy(true)
    try {
      const patch: Partial<AppSettings> = skip
        ? { onboardingComplete: true }
        : {
            onboardingComplete: true,
            defaultProjectsDir: draft.defaultProjectsDir,
            reservedPorts: draft.reservedPorts,
            launchAtLogin: draft.launchAtLogin,
            startMinimized: draft.startMinimized,
            openOutputAfterBuild: draft.openOutputAfterBuild,
            closeToTray: draft.closeToTray,
            notifyCrash: draft.notifyCrash,
            notifyBuild: draft.notifyBuild,
            notifyUpdates: draft.notifyUpdates,
            preferredEditor: draft.preferredEditor,
            customEditorCmd: draft.customEditorCmd,
            preferredNodeManager: draft.preferredNodeManager,
          }
      // Appearance already applied live; keep current theme/font on skip too
      const updated = await api.updateSettings(patch)
      useApp.setState({ settings: updated })
      // Never carry a prior guest session past first-run setup — LoginGate must ask next
      await api.exitGuestMode()
      onDone(updated)
    } finally {
      setBusy(false)
    }
  }

  return (
    <FramelessChrome>
      <div className="flex h-full flex-col bg-bg">
        <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-6 py-8 sm:px-10">
          <header className="mb-8 flex items-start gap-4">
            <img src={logoBlue} alt="" className="h-12 w-12 shrink-0" draggable={false} />
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wider text-accent uppercase">Welcome</p>
              <h1 className="text-2xl font-bold text-white">Set up DevFlow</h1>
              <p className="mt-1 text-sm text-slate-400">
                A few preferences to match how you work. You can change these anytime in Settings.
              </p>
            </div>
          </header>

          <div className="mb-6">
            <div className="mb-3 flex flex-wrap gap-2">
              {STEPS.map((s, i) => {
                const active = i === step
                const done = i < step
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => i <= step && setStep(i)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-accent/15 text-accent'
                        : done
                          ? 'bg-edge/60 text-slate-300'
                          : 'bg-transparent text-slate-600'
                    }`}
                  >
                    {i + 1}. {s.label}
                  </button>
                )
              })}
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-edge/70">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="app-frost-control min-h-0 flex-1 overflow-y-auto rounded-2xl border border-edge/70 p-5 sm:p-6">
            {step === 0 && (
              <StepShell
                title="Appearance"
                description="Theme, mode, and font — preview updates instantly."
              >
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Mode</p>
                    <div className="flex items-center gap-2">
                      {(['dark', 'light'] as ThemeMode[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setThemeChoice((c) => ({ ...c, mode: m }))}
                          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium capitalize ${
                            themeChoice.mode === m
                              ? 'border-accent bg-accent/10 text-white'
                              : 'border-edge text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {m === 'dark' ? <Moon size={14} /> : <Sun size={14} />} {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Color theme</p>
                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                      {THEMES.map((t) => {
                        const active = themeChoice.theme === t.id
                        const mode = themeChoice.mode
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setThemeChoice((c) => ({ ...c, theme: t.id }))}
                            className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
                              active ? 'border-accent bg-accent/5' : 'border-edge bg-bg/40 hover:border-slate-600'
                            }`}
                          >
                            <span
                              className="relative h-9 w-9 rounded-full border border-edge"
                              style={{ background: t.surface[mode] }}
                            >
                              <span
                                className="absolute inset-2 rounded-full"
                                style={{ background: t.accent[mode] }}
                              />
                              {active && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-fg">
                                  <Check size={11} strokeWidth={3} />
                                </span>
                              )}
                            </span>
                            <span className={`text-[11px] font-medium ${active ? 'text-white' : 'text-slate-400'}`}>
                              {t.name}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Font</p>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {FONTS.map((f) => {
                        const active = fontId === f.id
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setFontId(f.id)}
                            className={`relative flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors ${
                              active ? 'border-accent bg-accent/5' : 'border-edge bg-bg/40 hover:border-slate-600'
                            }`}
                          >
                            <span className="text-xl leading-none text-white" style={{ fontFamily: f.stack }}>
                              Ag
                            </span>
                            <span
                              className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-300'}`}
                              style={{ fontFamily: f.stack }}
                            >
                              {f.name}
                            </span>
                            <span className="text-[10px] text-slate-500">{f.hint}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </StepShell>
            )}

            {step === 1 && (
              <StepShell
                title="Projects & ports"
                description="Where new projects land and which ports should warn on conflict."
              >
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Default projects directory
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={draft.defaultProjectsDir}
                        onChange={(e) => patchDraft({ defaultProjectsDir: e.target.value })}
                        className="flex-1 rounded-lg border border-edge bg-bg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-accent/60"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const picked = await api.pickFolder('Choose default projects directory')
                          if (picked) patchDraft({ defaultProjectsDir: picked })
                        }}
                        className="shrink-0 rounded-lg border border-edge px-4 py-2.5 text-sm text-slate-300 hover:border-accent/50"
                      >
                        Browse…
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Reserved ports</p>
                    <div className="mb-2 flex min-h-10 flex-wrap gap-2">
                      {draft.reservedPorts.map((p) => (
                        <span
                          key={p}
                          className="flex items-center gap-1.5 rounded-full border border-edge bg-bg px-3 py-1.5 text-sm text-slate-200"
                        >
                          {p}
                          <button
                            type="button"
                            onClick={() =>
                              patchDraft({ reservedPorts: draft.reservedPorts.filter((x) => x !== p) })
                            }
                            className="text-slate-500 hover:text-rose-400"
                            aria-label={`Remove port ${p}`}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                      {draft.reservedPorts.length === 0 && (
                        <span className="text-sm text-slate-600">No reserved ports.</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={newPort}
                        onChange={(e) => setNewPort(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => e.key === 'Enter' && addPort()}
                        placeholder="e.g. 3000"
                        className="w-full rounded-lg border border-edge bg-bg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-accent/60 sm:w-40"
                      />
                      <button
                        type="button"
                        onClick={addPort}
                        className="flex items-center justify-center gap-2 rounded-lg border border-edge px-4 py-2.5 text-sm text-slate-300 hover:border-accent/50"
                      >
                        <Plus size={14} /> Add rule
                      </button>
                    </div>
                  </div>
                </div>
              </StepShell>
            )}

            {step === 2 && (
              <StepShell
                title="App behavior"
                description="Startup, tray, and notifications for day-to-day use."
              >
                <div className="space-y-4">
                  <SwitchField
                    label="Launch DevFlow when Windows starts"
                    hint={isElectron ? undefined : 'Applies to the installed desktop app only.'}
                    checked={draft.launchAtLogin}
                    onChange={(v) => patchDraft({ launchAtLogin: v, startMinimized: v ? draft.startMinimized : false })}
                  />
                  <SwitchField
                    label="Start minimized"
                    hint="When launched at login, keep DevFlow out of the way."
                    checked={draft.startMinimized}
                    onChange={(v) => patchDraft({ startMinimized: v })}
                    disabled={!draft.launchAtLogin}
                  />
                  <SwitchField
                    label="Open the output folder after a successful build"
                    checked={draft.openOutputAfterBuild}
                    onChange={(v) => patchDraft({ openOutputAfterBuild: v })}
                  />
                  <SwitchField
                    label="Close to tray"
                    hint="Closing the window keeps DevFlow running in the system tray."
                    checked={draft.closeToTray}
                    onChange={(v) => patchDraft({ closeToTray: v })}
                  />
                  <SwitchField
                    label="Notify when a dev server crashes"
                    checked={draft.notifyCrash}
                    onChange={(v) => patchDraft({ notifyCrash: v })}
                  />
                  <SwitchField
                    label="Notify when a build finishes"
                    checked={draft.notifyBuild}
                    onChange={(v) => patchDraft({ notifyBuild: v })}
                  />
                  <SwitchField
                    label="Notify when an app update is available"
                    checked={draft.notifyUpdates}
                    onChange={(v) => patchDraft({ notifyUpdates: v })}
                  />
                </div>
              </StepShell>
            )}

            {step === 3 && (
              <StepShell
                title="Editor"
                description="Which editor opens from DevFlow, and how Node versions are resolved."
              >
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Preferred editor
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: 'vscode' as PreferredEditor, label: 'VS Code' },
                          { id: 'cursor' as PreferredEditor, label: 'Cursor' },
                          { id: 'custom' as PreferredEditor, label: 'Custom command' },
                        ] as const
                      ).map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => patchDraft({ preferredEditor: e.id })}
                          className={`rounded-lg border px-4 py-2 text-sm ${
                            draft.preferredEditor === e.id
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-edge text-slate-400'
                          }`}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                    {draft.preferredEditor === 'custom' && (
                      <input
                        value={draft.customEditorCmd ?? ''}
                        onChange={(e) => patchDraft({ customEditorCmd: e.target.value })}
                        placeholder="e.g. idea64 or code"
                        className="mt-2 w-full max-w-md rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
                      />
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Node version manager
                    </p>
                    <select
                      value={draft.preferredNodeManager ?? 'auto'}
                      onChange={(e) =>
                        patchDraft({ preferredNodeManager: e.target.value as PreferredNodeManager })
                      }
                      className="w-full max-w-xs rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
                    >
                      <option value="auto">Auto-detect (fnm → nvm → volta)</option>
                      <option value="fnm">fnm</option>
                      <option value="nvm">nvm</option>
                      <option value="volta">volta</option>
                      <option value="system">System Node only</option>
                    </select>
                  </div>
                </div>
              </StepShell>
            )}
          </div>

          <footer className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => finish(true)}
              className="text-sm text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-50"
            >
              Skip setup
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                disabled={busy || step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="flex items-center gap-1 rounded-lg border border-edge px-3 py-2 text-sm text-slate-300 hover:border-accent/45 disabled:opacity-40"
              >
                <ChevronLeft size={16} /> Back
              </button>
              {isLast ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => finish(false)}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90 disabled:opacity-50"
                >
                  Get started
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90 disabled:opacity-50"
                >
                  Continue
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </footer>
        </div>
      </div>
    </FramelessChrome>
  )
}

function StepShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      {children}
    </div>
  )
}
