import { useEffect } from 'react'
import { AlertTriangle, FolderOpen, FolderSearch, Loader2, RotateCcw, XCircle } from 'lucide-react'
import { api } from '../../lib/ipc'
import { useBuildSetup } from '../../state/buildSetup'

function parentDir(p: string): string {
  return p.replace(/[/\\][^/\\]*$/, '') || p
}

export function ReviewStep() {
  const { detection, config, setConfig, preflight, preflighting, runPreflightCheck } = useBuildSetup()

  useEffect(() => {
    void runPreflightCheck()
    // re-run only when the step is entered; individual field edits use the manual "Recheck" button
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!detection || !config) return null

  const recommendedExportDir = `${detection.projectPath}\\release\\${config.appName}\\${config.version}`

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Build Summary</p>
        <div className="rounded-xl border border-edge bg-panel p-4 text-sm">
          <table className="w-full">
            <tbody className="[&_td]:py-1">
              <tr><td className="w-48 text-slate-500">Project</td><td className="text-white">{config.appName}</td></tr>
              <tr><td className="text-slate-500">Framework</td><td className="text-white">{detection.frameworks.join(', ') || 'Unknown'}</td></tr>
              <tr><td className="text-slate-500">Package Manager</td><td className="text-white">{config.packageManager}</td></tr>
              <tr><td className="text-slate-500">Build Command</td><td className="text-white">{config.buildCommand || '—'}</td></tr>
              <tr><td className="text-slate-500">Output Folder</td><td className="text-white">{config.outputDir}</td></tr>
              <tr><td className="text-slate-500">Application Version</td><td className="text-white">{config.version}</td></tr>
              <tr><td className="text-slate-500">Selected Build Targets</td><td className="text-white">{config.targets.join(', ') || 'None'}</td></tr>
              <tr><td className="text-slate-500">Icon Status</td><td className="text-white">{detection.hasIconAsset ? 'Custom icon detected' : 'Default icon will be used'}</td></tr>
              <tr><td className="text-slate-500">Excluded Files</td><td className="text-white">{config.excludedPaths.length} item(s)</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Export Location</p>
        <div className="flex gap-2">
          <input
            value={config.exportDir}
            onChange={(e) => setConfig({ exportDir: e.target.value })}
            className="flex-1 rounded-lg border border-edge bg-bg px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/60"
          />
          <button
            onClick={async () => {
              const picked = await api.pickFolder('Choose export location')
              if (picked) setConfig({ exportDir: picked })
            }}
            className="flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50"
          >
            <FolderOpen size={14} /> Browse
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setConfig({ exportDir: recommendedExportDir })}
            className="rounded-lg border border-edge px-3 py-1.5 text-slate-400 hover:border-accent/50"
          >
            Use Recommended Location
          </button>
          <button
            onClick={() => void api.buildOpenOutput(parentDir(config.exportDir))}
            className="flex items-center gap-1.5 rounded-lg border border-edge px-3 py-1.5 text-slate-400 hover:border-accent/50"
          >
            <FolderSearch size={12} /> Open Parent Folder
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Build Preflight Check</p>
          <button
            onClick={() => void runPreflightCheck()}
            disabled={preflighting}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            {preflighting ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Recheck
          </button>
        </div>
        {!preflight ? (
          <p className="text-sm text-slate-500">Running preflight check…</p>
        ) : (
          <div className="flex flex-col gap-2">
            {preflight.ok && preflight.warnings.length === 0 && (
              <p className="text-sm text-emerald-400">Build is ready — no issues found.</p>
            )}
            {preflight.errors.map((e) => (
              <div key={e.id} className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                <XCircle size={15} className="mt-0.5 shrink-0" />
                <div>
                  <p>{e.message}</p>
                  {e.fix && <p className="mt-0.5 text-xs text-rose-400/80">{e.fix}</p>}
                </div>
              </div>
            ))}
            {preflight.warnings.map((w) => (
              <div key={w.id} className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <div>
                  <p>{w.message}</p>
                  {w.why && <p className="mt-0.5 text-xs text-amber-400/80">{w.why}</p>}
                  {w.fix && <p className="mt-0.5 text-xs text-amber-400/80">{w.fix}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
