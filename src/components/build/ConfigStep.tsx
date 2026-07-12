import { useState } from 'react'
import { AppWindow, Archive, ChevronDown, ChevronRight, FileArchive, Folder, PackagePlus } from 'lucide-react'
import type { BuildTargetId } from '../../shared/types'
import { useBuildSetup } from '../../state/buildSetup'
import { SwitchField } from '../Switch'

const TARGET_META: Record<BuildTargetId, { name: string; desc: string; icon: typeof Folder }> = {
  'static-build': { name: 'Static Build', desc: 'Copy the production build output to a folder.', icon: Folder },
  'zip-archive': { name: 'ZIP Archive', desc: 'Compress the production build output into a ZIP file.', icon: Archive },
  'win-portable': { name: 'Windows Portable EXE', desc: 'Single portable .exe — no installation required.', icon: AppWindow },
  'win-nsis': { name: 'Windows Installer (.exe)', desc: 'Guided installation wizard with shortcuts and uninstall support.', icon: PackagePlus },
  'win-zip': { name: 'Windows ZIP', desc: 'Compressed archive of the packaged desktop app.', icon: FileArchive },
}

const ALL_TARGETS: BuildTargetId[] = ['static-build', 'zip-archive', 'win-portable', 'win-nsis', 'win-zip']

export function ConfigStep() {
  const { detection, config, setConfig } = useBuildSetup()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  if (!detection || !config) return null

  const disabledReason = new Map(detection.disabledTargets.map((d) => [d.id, d.reason]))
  const relevantTargets = ALL_TARGETS.filter((t) => detection.supportedTargets.includes(t) || disabledReason.has(t))

  function toggleTarget(id: BuildTargetId) {
    if (!config) return
    const has = config.targets.includes(id)
    setConfig({ targets: has ? config.targets.filter((t) => t !== id) : [...config.targets, id] })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">General Project Information</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500">Application Name</label>
            <input
              value={config.appName}
              onChange={(e) => setConfig({ appName: e.target.value })}
              className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Package Name</label>
            <input
              value={config.packageName}
              onChange={(e) => setConfig({ packageName: e.target.value })}
              className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Publisher</label>
            <input
              value={config.publisher ?? ''}
              onChange={(e) => setConfig({ publisher: e.target.value })}
              className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
            />
          </div>
          {config.isElectron && (
            <div>
              <label className="mb-1 block text-xs text-slate-500">Application ID</label>
              <input
                value={config.appId ?? ''}
                onChange={(e) => setConfig({ appId: e.target.value })}
                className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Build Versioning</p>
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-edge bg-panel2/40 p-4">
          <select
            value={config.versionSource}
            onChange={(e) => setConfig({ versionSource: e.target.value as typeof config.versionSource })}
            className="rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
          >
            <option value="package">Use package.json version</option>
            <option value="manual">Enter manually</option>
            <option value="increment">Automatically increment version</option>
          </select>
          {config.versionSource === 'manual' && (
            <input
              value={config.version}
              onChange={(e) => setConfig({ version: e.target.value })}
              placeholder="1.0.0"
              className="w-32 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
            />
          )}
          {config.versionSource === 'increment' && (
            <select
              value={config.incrementType}
              onChange={(e) => setConfig({ incrementType: e.target.value as typeof config.incrementType })}
              className="rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
            >
              <option value="patch">Patch (1.0.0 → 1.0.1)</option>
              <option value="minor">Minor (1.0.0 → 1.1.0)</option>
              <option value="major">Major (1.0.0 → 2.0.0)</option>
              <option value="prerelease">Prerelease (1.0.0 → 1.0.1-beta.1)</option>
            </select>
          )}
          {config.versionSource === 'package' && <span className="text-sm text-slate-400">Current: {config.version}</span>}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Build Targets</p>
        <div className="grid grid-cols-2 gap-3">
          {relevantTargets.map((id) => {
            const meta = TARGET_META[id]
            const Icon = meta.icon
            const disabled = !detection.supportedTargets.includes(id)
            const selected = config.targets.includes(id)
            return (
              <div
                key={id}
                role="button"
                title={disabled ? disabledReason.get(id) : undefined}
                onClick={() => !disabled && toggleTarget(id)}
                className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                  disabled
                    ? 'cursor-not-allowed border-edge bg-panel opacity-40'
                    : selected
                      ? 'cursor-pointer border-accent bg-accent/5'
                      : 'cursor-pointer border-edge bg-panel hover:border-slate-600'
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-edge bg-slate-800">
                  <Icon size={18} className="text-slate-300" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-white">{meta.name}</span>
                  <span className="block text-xs text-slate-500">{disabled ? disabledReason.get(id) : meta.desc}</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <button
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-500 uppercase hover:text-slate-300"
        >
          {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Advanced Build Configuration
        </button>
        {advancedOpen && (
          <div className="mt-3 flex flex-col gap-4 rounded-xl border border-edge bg-panel2/40 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Build Command</label>
                <input
                  value={config.buildCommand}
                  onChange={(e) => setConfig({ buildCommand: e.target.value })}
                  className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Output Directory</label>
                <input
                  value={config.outputDir}
                  onChange={(e) => setConfig({ outputDir: e.target.value })}
                  className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Pre-build Command</label>
                <input
                  value={config.preBuildCommand ?? ''}
                  onChange={(e) => setConfig({ preBuildCommand: e.target.value })}
                  className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Post-build Command</label>
                <input
                  value={config.postBuildCommand ?? ''}
                  onChange={(e) => setConfig({ postBuildCommand: e.target.value })}
                  className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <SwitchField
                label="Clean output directory before build"
                checked={config.cleanOutputDir}
                onChange={(v) => setConfig({ cleanOutputDir: v })}
              />
              <SwitchField
                label="Install dependencies before build"
                checked={config.installDepsBeforeBuild}
                onChange={(v) => setConfig({ installDepsBeforeBuild: v })}
              />
              <SwitchField label="Run type checking before build" checked={config.runTypeCheck} onChange={(v) => setConfig({ runTypeCheck: v })} />
              <SwitchField label="Run linting before build" checked={config.runLint} onChange={(v) => setConfig({ runLint: v })} />
              <SwitchField label="Run tests before build" checked={config.runTests} onChange={(v) => setConfig({ runTests: v })} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
