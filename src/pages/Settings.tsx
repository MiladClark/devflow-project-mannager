import { useEffect, useState } from 'react'
import { Save, Plus, X, Moon, Sun, Check } from 'lucide-react'
import { useApp } from '../state/store'
import { api } from '../lib/ipc'
import { THEMES, applyTheme, getThemeChoice, type ThemeMode } from '../lib/theme'

function AppearanceSection() {
  const [choice, setChoice] = useState(getThemeChoice)

  useEffect(() => {
    applyTheme(choice)
  }, [choice])

  function update(patch: Partial<typeof choice>) {
    setChoice((prev) => ({ ...prev, ...patch }))
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold tracking-wider text-slate-400 uppercase">Appearance</h3>
      <p className="mb-3 text-xs text-slate-500">Pick a color theme and mode — applied instantly across the whole app.</p>

      <div className="mb-4 flex items-center gap-2">
        {(['dark', 'light'] as ThemeMode[]).map((m) => (
          <button
            key={m}
            onClick={() => update({ mode: m })}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium capitalize ${
              choice.mode === m
                ? 'border-accent bg-accent/10 text-white'
                : 'border-edge text-slate-400 hover:text-slate-200'
            }`}
          >
            {m === 'dark' ? <Moon size={14} /> : <Sun size={14} />} {m}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-3">
        {THEMES.map((t) => {
          const active = choice.theme === t.id
          const mode = choice.mode
          return (
            <button
              key={t.id}
              onClick={() => update({ theme: t.id })}
              className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
                active ? 'border-accent bg-accent/5' : 'border-edge bg-panel hover:border-slate-600'
              }`}
            >
              <span
                className="relative h-10 w-10 rounded-full border border-edge"
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
              <span className={`text-xs font-medium ${active ? 'text-white' : 'text-slate-400'}`}>{t.name}</span>
            </button>
          )
        })}
      </div>
    </section>
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
    <div className="flex max-w-2xl flex-col gap-6 p-6">
      <h2 className="text-2xl font-bold text-white">Settings</h2>

      <AppearanceSection />

      <section>
        <h3 className="mb-2 text-sm font-semibold tracking-wider text-slate-400 uppercase">Default Projects Directory</h3>
        <p className="mb-2 text-xs text-slate-500">New projects are created here unless you choose another folder in the wizard.</p>
        <div className="flex gap-2">
          <input
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            className="flex-1 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
          />
          <button
            onClick={async () => {
              const picked = await api.pickFolder('Choose default projects directory')
              if (picked) setDir(picked)
            }}
            className="rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50"
          >
            Browse...
          </button>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold tracking-wider text-slate-400 uppercase">Port Rules</h3>
        <p className="mb-2 text-xs text-slate-500">
          Reserved ports trigger a conflict warning when assigned to a project.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {reserved.map((p) => (
            <span key={p} className="flex items-center gap-1.5 rounded-full border border-edge bg-panel px-3 py-1 text-sm text-slate-200">
              {p}
              <button onClick={() => setReserved(reserved.filter((x) => x !== p))} className="text-slate-500 hover:text-rose-400">
                <X size={13} />
              </button>
            </span>
          ))}
          {reserved.length === 0 && <span className="text-sm text-slate-600">No reserved ports.</span>}
        </div>
        <div className="flex gap-2">
          <input
            value={newPort}
            onChange={(e) => setNewPort(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && addPort()}
            placeholder="e.g. 3000"
            className="w-40 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
          />
          <button
            onClick={addPort}
            className="flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50"
          >
            <Plus size={14} /> Add Rule
          </button>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="flex w-fit items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300"
        >
          <Save size={15} /> Save Settings
        </button>
        {saved && <span className="text-sm text-emerald-400">Saved.</span>}
      </div>
    </div>
  )
}
