import { AlertCircle, AlertTriangle, Ban, CheckCircle2 } from 'lucide-react'
import type { BuildHealthStatus } from '../../shared/types'
import { useBuildSetup } from '../../state/buildSetup'
import { formatBytes } from '../../lib/format'

const STATUS_META: Record<BuildHealthStatus, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  ready: { label: 'Ready', icon: CheckCircle2, cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  warning: { label: 'Warning', icon: AlertTriangle, cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  'needs-attention': { label: 'Needs Attention', icon: AlertCircle, cls: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
  blocked: { label: 'Blocked', icon: Ban, cls: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
}

export function DetectionStep() {
  const { detection, config, toggleExclusion } = useBuildSetup()
  if (!detection || !config) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Detected Project</p>
        <div className="rounded-xl border border-edge bg-panel p-4 text-sm">
          <table className="w-full">
            <tbody className="[&_td]:py-1">
              <tr><td className="w-40 text-slate-500">Name</td><td className="text-white">{detection.appName}</td></tr>
              <tr><td className="text-slate-500">Path</td><td className="break-all text-white">{detection.projectPath}</td></tr>
              <tr><td className="text-slate-500">Framework</td><td className="text-white">{detection.frameworks.join(', ') || 'Unknown'}</td></tr>
              <tr><td className="text-slate-500">Package Manager</td><td className="text-white">{detection.packageManager}</td></tr>
              <tr><td className="text-slate-500">Build Command</td><td className="text-white">{detection.buildCommand || '—'}</td></tr>
              <tr><td className="text-slate-500">Output Directory</td><td className="text-white">{detection.outputDir}</td></tr>
              {detection.isElectron && (
                <tr><td className="text-slate-500">Electron Version</td><td className="text-white">{detection.electronVersion ?? 'unknown'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Project Health</p>
        <div className="flex flex-col gap-2">
          {detection.health.map((issue) => {
            const meta = STATUS_META[issue.status]
            const Icon = meta.icon
            return (
              <div key={issue.id} className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${meta.cls}`}>
                <Icon size={16} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-white">
                    {issue.title}
                    <span className="rounded-full border border-current/40 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                      {meta.label}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{issue.detail}</p>
                  {issue.fixHint && <p className="mt-0.5 text-xs italic text-slate-500">{issue.fixHint}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {detection.exclusions.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">Recommended exclusions detected</p>
          <p className="mb-3 text-xs text-slate-600">
            These files are usually not needed in the final installer or export package. Review the list before continuing.
          </p>
          <div className="flex flex-col gap-1.5">
            {detection.exclusions.map((ex) => {
              const checked = config.excludedPaths.includes(ex.path)
              return (
                <label
                  key={ex.path}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-edge bg-panel px-3 py-2 text-sm hover:border-slate-600"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleExclusion(ex.path)}
                    className="h-4 w-4 shrink-0 accent-cyan-400"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs text-white">{ex.path}{ex.isDir ? '/' : ''}</span>
                    <span className="block text-xs text-slate-500">{ex.reason}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {ex.approxSize ? '≈' : ''}
                    {formatBytes(ex.approxBytes)}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
