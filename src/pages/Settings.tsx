import { useEffect, useState } from 'react'
import { Save, Plus, X, Moon, Sun, Check, Download, Upload, Loader2, Shield } from 'lucide-react'
import { useApp } from '../state/store'
import { notify } from '../state/notifications'
import { confirmAction } from '../state/confirm'
import { api, isElectron } from '../lib/ipc'
import { THEMES, applyTheme, getThemeChoice, type ThemeMode } from '../lib/theme'
import { Switch, SwitchField } from '../components/Switch'
import type { PreferredEditor, PreferredNodeManager, ProxySetupStatus } from '../shared/types'

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-edge bg-panel p-5 sm:p-6">
      <header className="mb-5 border-b border-edge pb-4">
        <h3 className="text-sm font-semibold tracking-wider text-slate-300 uppercase">{title}</h3>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>}
      </header>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  )
}

function SettingsSubsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">{title}</h4>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function SettingsDivider() {
  return <div className="border-t border-edge" role="separator" />
}

function BehaviorSection() {
  const settings = useApp((s) => s.settings)
  const [local, setLocal] = useState(settings)

  useEffect(() => {
    setLocal(settings)
  }, [settings])

  if (!local) return null

  async function patch(p: Partial<NonNullable<typeof settings>>) {
    setLocal((cur) => (cur ? { ...cur, ...p } : cur))
    const updated = await api.updateSettings(p)
    useApp.setState({ settings: updated })
  }

  return (
    <SettingsSection
      title="App behavior"
      description="Startup, builds, tray icon and notifications — changes apply immediately."
    >
      <SettingsSubsection title="Startup">
        <SwitchField
          label="Launch DevFlow when Windows starts"
          hint={isElectron ? undefined : 'Applies to the installed desktop app only.'}
          checked={local.launchAtLogin}
          onChange={(v) => patch({ launchAtLogin: v })}
        />
        <SwitchField
          label="Start minimized"
          hint="When launched at login, keep DevFlow out of the way."
          checked={local.startMinimized}
          onChange={(v) => patch({ startMinimized: v })}
          disabled={!local.launchAtLogin}
        />
      </SettingsSubsection>

      <SettingsDivider />

      <SettingsSubsection title="Build">
        <SwitchField
          label="Open the output folder after a successful build"
          hint="Reveals the compiled files (dist, .next, build…) in File Explorer when a build finishes."
          checked={local.openOutputAfterBuild}
          onChange={(v) => patch({ openOutputAfterBuild: v })}
        />
      </SettingsSubsection>

      <SettingsDivider />

      <SettingsSubsection title="Tray & notifications">
        <SwitchField
          label="Close to tray"
          hint="Closing the window keeps DevFlow (and your dev servers) running in the system tray."
          checked={local.closeToTray}
          onChange={(v) => patch({ closeToTray: v })}
        />
        <SwitchField
          label="Notify when a dev server crashes"
          checked={local.notifyCrash}
          onChange={(v) => patch({ notifyCrash: v })}
        />
        <SwitchField
          label="Notify when a build finishes"
          checked={local.notifyBuild}
          onChange={(v) => patch({ notifyBuild: v })}
        />
        <SwitchField
          label="Notify when an app update is available"
          checked={local.notifyUpdates}
          onChange={(v) => patch({ notifyUpdates: v })}
        />
      </SettingsSubsection>
    </SettingsSection>
  )
}

function EditorSection() {
  const settings = useApp((s) => s.settings)
  const [local, setLocal] = useState(settings)

  useEffect(() => setLocal(settings), [settings])
  if (!local) return null

  async function patch(p: Partial<NonNullable<typeof settings>>) {
    setLocal((cur) => (cur ? { ...cur, ...p } : cur))
    const updated = await api.updateSettings(p)
    useApp.setState({ settings: updated })
  }

  return (
    <SettingsSection title="Editor" description="Choose which code editor opens when you click Open in Editor.">
      <SettingsSubsection title="Preferred editor">
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
              onClick={() => patch({ preferredEditor: e.id })}
              className={`rounded-lg border px-4 py-2 text-sm ${
                local.preferredEditor === e.id ? 'border-accent bg-accent/10 text-accent' : 'border-edge text-slate-400'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
        {local.preferredEditor === 'custom' && (
          <input
            value={local.customEditorCmd ?? ''}
            onChange={(e) => patch({ customEditorCmd: e.target.value })}
            placeholder="e.g. idea64 or code"
            className="mt-2 w-full max-w-md rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
          />
        )}
      </SettingsSubsection>
      <SettingsSubsection title="Node version manager">
        <select
          value={local.preferredNodeManager ?? 'auto'}
          onChange={(e) => patch({ preferredNodeManager: e.target.value as PreferredNodeManager })}
          className="w-full max-w-xs rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
        >
          <option value="auto">Auto-detect (fnm → nvm → volta)</option>
          <option value="fnm">fnm</option>
          <option value="nvm">nvm</option>
          <option value="volta">volta</option>
          <option value="system">System Node only</option>
        </select>
      </SettingsSubsection>
    </SettingsSection>
  )
}

function LocalHttpsSection() {
  const settings = useApp((s) => s.settings)
  const [local, setLocal] = useState(settings)
  const [status, setStatus] = useState<ProxySetupStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => setLocal(settings), [settings])
  useEffect(() => {
    if (isElectron) api.proxyStatus().then(setStatus)
  }, [])

  if (!local) return null

  async function patch(p: Partial<NonNullable<typeof settings>>) {
    setLocal((cur) => (cur ? { ...cur, ...p } : cur))
    const updated = await api.updateSettings(p)
    useApp.setState({ settings: updated })
  }

  async function runSetup() {
    setBusy(true)
    setMsg('')
    const res = await api.proxySetup()
    setStatus(await api.proxyStatus())
    setBusy(false)
    setMsg(res.ok ? 'Local HTTPS setup complete.' : res.error ?? 'Setup failed')
  }

  return (
    <SettingsSection
      title="Local HTTPS"
      description="Serve projects at https://your-app.test via Caddy + mkcert. Requires administrator approval once for hosts and certificates."
    >
      <SwitchField
        label="Enable local HTTPS domains"
        hint="When a dev server starts, DevFlow registers https://slug.test instead of localhost."
        checked={local.localDomainsEnabled ?? false}
        onChange={(v) => patch({ localDomainsEnabled: v })}
      />
      <SettingsSubsection title="Domain suffix">
        <input
          value={local.localDomainSuffix ?? 'test'}
          onChange={(e) => patch({ localDomainSuffix: e.target.value.replace(/[^a-z0-9.-]/gi, '').slice(0, 20) })}
          className="w-32 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
        />
        <p className="text-xs text-slate-500">
          Projects use https://slug.{local.localDomainSuffix ?? 'test'}
          {status?.httpsPort && status.httpsPort !== 443 ? `:${status.httpsPort}` : ''}
        </p>
      </SettingsSubsection>
      <SwitchField
        label="Start Caddy with DevFlow"
        checked={local.proxyAutoStart ?? true}
        onChange={(v) => patch({ proxyAutoStart: v })}
      />
      {status && (
        <ul className="grid gap-1 text-sm text-slate-400 sm:grid-cols-2">
          <li className="flex items-center gap-2">{status.mkcertInstalled ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-rose-400" />} mkcert installed</li>
          <li className="flex items-center gap-2">{status.caddyInstalled ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-rose-400" />} Caddy installed</li>
          <li className="flex items-center gap-2">{status.hostsConfigured ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-rose-400" />} hosts file configured</li>
          <li className="flex items-center gap-2">{status.caddyRunning ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-slate-500" />} Caddy running</li>
        </ul>
      )}
      <button
        type="button"
        disabled={busy || !isElectron}
        onClick={() => void runSetup()}
        className="flex w-fit items-center gap-2 rounded-lg border border-edge px-4 py-2.5 text-sm text-slate-300 hover:border-accent/50 disabled:opacity-40"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />} Run setup wizard
      </button>
      {msg && <p className={`text-sm ${msg.includes('complete') ? 'text-emerald-400' : 'text-rose-300'}`}>{msg}</p>}
    </SettingsSection>
  )
}

function BackupSection() {
  const refreshProjects = useApp((s) => s.refreshProjects)
  const [includePasswords, setIncludePasswords] = useState(false)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function doExport() {
    setBusy('export')
    setMessage(null)
    const res = await api.exportBackup({ includePasswords })
    setBusy('')
    if (res.ok) {
      setMessage({ ok: true, text: `Backup saved to ${res.file}` })
      notify('success', 'Backup exported', res.file)
    } else if (res.error !== 'cancelled') {
      setMessage({ ok: false, text: res.error ?? 'Export failed' })
      notify('error', 'Backup export failed', res.error)
    }
  }

  async function doImport() {
    if (
      importMode === 'replace' &&
      !(await confirmAction({
        title: 'Replace all data?',
        message: 'All current projects, connections and settings will be replaced with the backup. This cannot be undone.',
        confirmLabel: 'Replace all',
        variant: 'warning',
      }))
    ) {
      return
    }
    setBusy('import')
    setMessage(null)
    const res = await api.importBackup({ mode: importMode })
    setBusy('')
    if (res.ok) {
      await refreshProjects()
      const extra = res.warnings.length > 0 ? ` — ${res.warnings.join(' ')}` : ''
      setMessage({
        ok: true,
        text: `Imported ${res.projectsAdded} projects and ${res.connectionsAdded} connections (${res.projectsSkipped} skipped)${extra}`,
      })
      notify('success', 'Backup imported', `${res.projectsAdded} projects, ${res.connectionsAdded} connections`)
    } else if (res.error !== 'cancelled') {
      setMessage({ ok: false, text: res.error ?? 'Import failed' })
      notify('error', 'Backup import failed', res.error)
    }
  }

  return (
    <SettingsSection
      title="Backup & restore"
      description="Export your projects list, settings and database connections to a JSON file, or restore from a previous backup. Your license is never included."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={doExport}
            disabled={busy !== '' || !isElectron}
            className="flex items-center gap-2 rounded-lg border border-edge px-4 py-2.5 text-sm text-slate-300 hover:border-accent/50 disabled:opacity-40"
          >
            {busy === 'export' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Export backup
          </button>
          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            <Switch size="sm" checked={includePasswords} onChange={setIncludePasswords} />
            Include connection passwords
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={doImport}
            disabled={busy !== '' || !isElectron}
            className="flex items-center gap-2 rounded-lg border border-edge px-4 py-2.5 text-sm text-slate-300 hover:border-accent/50 disabled:opacity-40"
          >
            {busy === 'import' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Import backup
          </button>
          <div className="flex gap-1 rounded-lg border border-edge p-0.5">
            {(['merge', 'replace'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setImportMode(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                  importMode === m ? 'bg-accent/15 text-accent' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {message && (
          <p className={`text-sm leading-relaxed ${message.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{message.text}</p>
        )}
      </div>
    </SettingsSection>
  )
}

function AppearanceSection() {
  const [choice, setChoice] = useState(getThemeChoice)

  useEffect(() => {
    applyTheme(choice)
  }, [choice])

  function update(patch: Partial<typeof choice>) {
    setChoice((prev) => ({ ...prev, ...patch }))
  }

  return (
    <SettingsSection
      title="Appearance"
      description="Pick a color theme and mode — applied instantly across the whole app."
    >
      <SettingsSubsection title="Mode">
        <div className="flex items-center gap-2">
          {(['dark', 'light'] as ThemeMode[]).map((m) => (
            <button
              key={m}
              onClick={() => update({ mode: m })}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium capitalize ${
                choice.mode === m
                  ? 'border-accent bg-accent/10 text-white'
                  : 'border-edge text-slate-400 hover:text-slate-200'
              }`}
            >
              {m === 'dark' ? <Moon size={14} /> : <Sun size={14} />} {m}
            </button>
          ))}
        </div>
      </SettingsSubsection>

      <SettingsDivider />

      <SettingsSubsection title="Color theme">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {THEMES.map((t) => {
            const active = choice.theme === t.id
            const mode = choice.mode
            return (
              <button
                key={t.id}
                onClick={() => update({ theme: t.id })}
                className={`flex flex-col items-center gap-2.5 rounded-xl border p-3.5 transition-colors ${
                  active ? 'border-accent bg-accent/5' : 'border-edge bg-bg hover:border-slate-600'
                }`}
              >
                <span
                  className="relative h-10 w-10 rounded-full border border-edge"
                  style={{ background: t.surface[mode] }}
                >
                  <span className="absolute inset-2 rounded-full" style={{ background: t.accent[mode] }} />
                  {active && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-fg">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className={`text-xs font-medium ${active ? 'text-white' : 'text-slate-400'}`}>{t.name}</span>
              </button>
            )
          })}
        </div>
      </SettingsSubsection>
    </SettingsSection>
  )
}

export function Settings() {
  const settings = useApp((s) => s.settings)
  const [dir, setDir] = useState(settings?.defaultProjectsDir ?? '')
  const [reserved, setReserved] = useState<number[]>(settings?.reservedPorts ?? [])
  const [newPort, setNewPort] = useState('')
  const [saved, setSaved] = useState(false)

  async function save() {
    const updated = await api.updateSettings({ defaultProjectsDir: dir, reservedPorts: reserved })
    useApp.setState({ settings: updated })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function addPort() {
    const n = Number(newPort)
    if (Number.isInteger(n) && n >= 1 && n <= 65535 && !reserved.includes(n)) {
      setReserved([...reserved, n].sort((a, b) => a - b))
    }
    setNewPort('')
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6 pb-12">
      <header className="space-y-1">
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-sm text-slate-500">Customize appearance, defaults and how DevFlow behaves on your machine.</p>
      </header>

      <AppearanceSection />

      <SettingsSection
        title="Projects & ports"
        description="Where new projects are created and which ports should trigger a conflict warning."
      >
        <SettingsSubsection title="Default projects directory">
          <p className="text-xs leading-relaxed text-slate-500">
            New projects are created here unless you choose another folder in the wizard.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={dir}
              onChange={(e) => setDir(e.target.value)}
              className="flex-1 rounded-lg border border-edge bg-bg px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-accent/60"
            />
            <button
              onClick={async () => {
                const picked = await api.pickFolder('Choose default projects directory')
                if (picked) setDir(picked)
              }}
              className="shrink-0 rounded-lg border border-edge px-4 py-2.5 text-sm text-slate-300 hover:border-accent/50"
            >
              Browse…
            </button>
          </div>
        </SettingsSubsection>

        <SettingsDivider />

        <SettingsSubsection title="Port rules">
          <p className="text-xs leading-relaxed text-slate-500">
            Reserved ports trigger a conflict warning when assigned to a project.
          </p>
          <div className="flex min-h-10 flex-wrap gap-2">
            {reserved.map((p) => (
              <span
                key={p}
                className="flex items-center gap-1.5 rounded-full border border-edge bg-bg px-3 py-1.5 text-sm text-slate-200"
              >
                {p}
                <button
                  onClick={() => setReserved(reserved.filter((x) => x !== p))}
                  className="text-slate-500 hover:text-rose-400"
                  aria-label={`Remove port ${p}`}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
            {reserved.length === 0 && <span className="text-sm text-slate-600">No reserved ports.</span>}
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
              onClick={addPort}
              className="flex items-center justify-center gap-2 rounded-lg border border-edge px-4 py-2.5 text-sm text-slate-300 hover:border-accent/50 sm:w-auto"
            >
              <Plus size={14} /> Add rule
            </button>
          </div>
        </SettingsSubsection>

        <SettingsDivider />

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={save}
            className="flex w-fit items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg hover:bg-cyan-300"
          >
            <Save size={15} /> Save settings
          </button>
          {saved && <span className="text-sm text-emerald-400">Saved.</span>}
        </div>
      </SettingsSection>

      <BehaviorSection />

      <EditorSection />

      <LocalHttpsSection />

      <BackupSection />
    </div>
  )
}
