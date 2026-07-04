import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, FolderOpen, Loader2 } from 'lucide-react'
import { api } from '../lib/ipc'
import { useApp } from '../state/store'
import type { CmsChoice, LogLine, ScaffoldOptions } from '../shared/types'
import { LogViewer } from '../components/LogViewer'
import { HintPopover } from '../components/HintPopover'

type FrameworkChoice = ScaffoldOptions['framework']

const frameworks: { id: FrameworkChoice; name: string; desc: string; badge: string; badgeCls: string }[] = [
  { id: 'next', name: 'Next.js 15', desc: 'Full-stack React framework with App Router', badge: 'N', badgeCls: 'bg-white text-black' },
  { id: 'vite-react', name: 'Vite + React', desc: 'Fast SPA development with React', badge: 'V', badgeCls: 'bg-gradient-to-br from-violet-500 to-amber-400 text-white' },
  { id: 'vite-vue', name: 'Vite + Vue', desc: 'Fast SPA development with Vue 3', badge: 'V', badgeCls: 'bg-emerald-900 text-emerald-300' },
  { id: 'vite-vanilla', name: 'Vite Vanilla', desc: 'Plain TypeScript/JavaScript with Vite', badge: 'V', badgeCls: 'bg-slate-700 text-slate-200' },
]

const cmsOptions: { id: CmsChoice; name: string; desc: string; badge: string; badgeCls: string; hintKey: string }[] = [
  { id: 'none', name: 'No CMS', desc: 'Content in code, database or external API', badge: '—', badgeCls: 'bg-slate-800 text-slate-400', hintKey: 'cms-none' },
  { id: 'payload', name: 'Payload CMS', desc: 'Code-first CMS inside your Next.js app', badge: 'P', badgeCls: 'bg-slate-950 text-white border border-slate-600', hintKey: 'cms-payload' },
  { id: 'strapi', name: 'Strapi', desc: 'Standalone headless CMS with admin panel', badge: 'S', badgeCls: 'bg-indigo-900 text-indigo-300', hintKey: 'cms-strapi' },
  { id: 'decap', name: 'Decap CMS', desc: 'Git-based CMS, content as Markdown in repo', badge: 'D', badgeCls: 'bg-teal-900 text-teal-300', hintKey: 'cms-decap' },
]

const steps = ['Framework', 'Configuration', 'Summary & Install']

export function NewProject() {
  const navigate = useNavigate()
  const { settings, refreshProjects } = useApp()
  const [step, setStep] = useState(0)

  const [framework, setFramework] = useState<FrameworkChoice>('next')
  const [cms, setCms] = useState<CmsChoice>('none')
  const [typescript, setTypescript] = useState(true)
  const [tailwind, setTailwind] = useState(true)

  // Payload is TypeScript-only and ships its own Next.js app; Strapi ships its own stack
  const frameworkLocked = cms === 'payload' || cms === 'strapi'
  const effectiveTs = cms === 'payload' ? true : typescript

  function pickCms(c: CmsChoice) {
    setCms(c)
    if (c === 'payload') setFramework('next')
  }
  const [name, setName] = useState('my-app')
  const [parentDir, setParentDir] = useState('')
  const [port, setPort] = useState('')

  const [installing, setInstalling] = useState(false)
  const [installLog, setInstallLog] = useState<LogLine[]>([])
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const doneProjectId = useRef('')

  useEffect(() => {
    if (settings && !parentDir) setParentDir(settings.defaultProjectsDir)
  }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => api.onScaffoldLog((line) => setInstallLog((l) => [...l, line])), [])

  const nameValid = /^[a-z0-9][a-z0-9._-]*$/.test(name)
  const canNext = step === 0 || (step === 1 && nameValid && parentDir.trim().length > 0)

  async function install() {
    setInstalling(true)
    setError('')
    setInstallLog([])
    const res = await api.createProject({
      framework,
      cms,
      typescript: effectiveTs,
      tailwind,
      name,
      parentDir,
      preferredPort: port ? Number(port) : undefined,
    })
    setInstalling(false)
    if (res.ok && res.project) {
      doneProjectId.current = res.project.id
      setDone(true)
      await refreshProjects()
    } else {
      setError(res.error ?? 'Unknown error')
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300">
          <ArrowLeft size={14} /> Back
        </button>
        <h2 className="mt-2 text-2xl font-bold text-white">Create New Project</h2>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                i < step ? 'bg-emerald-500/20 text-emerald-400' : i === step ? 'bg-accent text-accent-fg' : 'bg-slate-800 text-slate-500'
              }`}
            >
              {i < step ? <Check size={13} /> : i + 1}
            </span>
            <span className={i === step ? 'font-semibold text-white' : 'text-slate-500'}>{s}</span>
            {i < steps.length - 1 && <span className="mx-1 text-slate-700">›</span>}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Core Framework</p>
            {frameworkLocked && (
              <p className="mb-2 text-xs text-amber-400">
                {cms === 'payload'
                  ? 'Payload CMS ships its own Next.js app — framework is fixed to Next.js.'
                  : 'Strapi is a standalone service with its own stack — the framework selection is not used.'}
              </p>
            )}
            <div className={`grid grid-cols-2 gap-3 ${cms === 'strapi' ? 'pointer-events-none opacity-40' : ''}`}>
              {frameworks.map((f) => {
                const disabled = cms === 'payload' && f.id !== 'next'
                return (
                  <div
                    key={f.id}
                    role="button"
                    onClick={() => !disabled && setFramework(f.id)}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      framework === f.id
                        ? 'border-accent bg-accent/5'
                        : disabled
                          ? 'border-edge bg-panel opacity-40'
                          : 'cursor-pointer border-edge bg-panel hover:border-slate-600'
                    }`}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${f.badgeCls}`}>
                      {f.badge}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-white">{f.name}</span>
                      <span className="block text-xs text-slate-500">{f.desc}</span>
                    </span>
                    <HintPopover hintKey={f.id} />
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Headless CMS</p>
            <div className="grid grid-cols-2 gap-3">
              {cmsOptions.map((c) => (
                <div
                  key={c.id}
                  role="button"
                  onClick={() => pickCms(c.id)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                    cms === c.id ? 'border-accent bg-accent/5' : 'border-edge bg-panel hover:border-slate-600'
                  }`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${c.badgeCls}`}>
                    {c.badge}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-white">{c.name}</span>
                    <span className="block text-xs text-slate-500">{c.desc}</span>
                  </span>
                  <HintPopover hintKey={c.hintKey} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-6">
            <label className={`flex items-center gap-2 text-sm text-slate-300 ${cms === 'payload' ? 'opacity-60' : ''}`}>
              <input
                type="checkbox"
                checked={effectiveTs}
                disabled={cms === 'payload'}
                onChange={(e) => setTypescript(e.target.checked)}
                className="accent-cyan-400"
              />
              TypeScript {cms === 'payload' && <span className="text-xs text-amber-400">(required by Payload)</span>}
              <HintPopover hintKey="typescript" />
            </label>
            <label className={`flex items-center gap-2 text-sm text-slate-300 ${cms === 'strapi' ? 'opacity-60' : ''}`}>
              <input
                type="checkbox"
                checked={tailwind}
                disabled={cms === 'strapi'}
                onChange={(e) => setTailwind(e.target.checked)}
                className="accent-cyan-400"
              />
              Tailwind CSS {cms === 'strapi' && <span className="text-xs text-amber-400">(n/a for Strapi)</span>}
              <HintPopover hintKey="tailwind" />
            </label>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Project Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-lg border bg-bg px-3 py-2 text-sm text-slate-200 outline-none ${
                name && !nameValid ? 'border-rose-500/60' : 'border-edge focus:border-accent/60'
              }`}
            />
            {name && !nameValid && (
              <p className="mt-1 text-xs text-rose-400">Use lowercase letters, numbers, dots, dashes and underscores.</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Location</label>
            <div className="flex gap-2">
              <input
                value={parentDir}
                onChange={(e) => setParentDir(e.target.value)}
                className="flex-1 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
              />
              <button
                onClick={async () => {
                  const picked = await api.pickFolder('Choose parent folder for the new project')
                  if (picked) setParentDir(picked)
                }}
                className="flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50"
              >
                <FolderOpen size={14} /> Browse
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Project path: {parentDir ? `${parentDir}\\${name}` : '—'}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Preferred Port (optional)</label>
            <input
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
              placeholder={cms === 'strapi' ? '1337 (Strapi default)' : 'framework default'}
              className="w-48 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-edge bg-panel p-4 text-sm">
            <table className="w-full">
              <tbody className="[&_td]:py-1">
                <tr><td className="w-40 text-slate-500">Framework</td><td className="text-white">{cms === 'strapi' ? 'Strapi (standalone)' : frameworks.find((f) => f.id === framework)?.name}</td></tr>
                <tr><td className="text-slate-500">Headless CMS</td><td className="text-white">{cmsOptions.find((c) => c.id === cms)?.name}</td></tr>
                <tr><td className="text-slate-500">Language</td><td className="text-white">{effectiveTs ? 'TypeScript' : 'JavaScript'}</td></tr>
                <tr><td className="text-slate-500">Styling</td><td className="text-white">{cms !== 'strapi' && tailwind ? 'Tailwind CSS' : 'None'}</td></tr>
                <tr><td className="text-slate-500">Name</td><td className="text-white">{name}</td></tr>
                <tr><td className="text-slate-500">Path</td><td className="text-white">{parentDir}\{name}</td></tr>
                <tr><td className="text-slate-500">Port</td><td className="text-white">{port || 'framework default'}</td></tr>
              </tbody>
            </table>
          </div>

          {(installing || installLog.length > 0) && <LogViewer lines={installLog} height="h-64" />}

          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">{error}</div>
          )}

          {done && (
            <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              Project created and imported successfully.
              <button
                onClick={() => navigate(`/projects/${doneProjectId.current}`)}
                className="rounded-lg bg-emerald-500/20 px-3 py-1.5 font-semibold hover:bg-emerald-500/30"
              >
                Open Project
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between border-t border-edge pt-4">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0 || installing}
          className="rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50 disabled:opacity-30"
        >
          ‹ Back
        </button>
        {step < 2 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canNext}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-40"
          >
            Next: {steps[step + 1]} <ArrowRight size={15} />
          </button>
        ) : (
          <button
            onClick={install}
            disabled={installing || done}
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300 disabled:opacity-40"
          >
            {installing ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Installing...
              </>
            ) : (
              'Create & Install'
            )}
          </button>
        )}
      </div>
    </div>
  )
}
