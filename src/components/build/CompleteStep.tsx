import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Copy, FolderOpen, RotateCcw, LayoutList } from 'lucide-react'
import { api } from '../../lib/ipc'
import { useBuildSetup } from '../../state/buildSetup'
import { formatBytes } from '../../lib/format'
import { notify } from '../../state/notifications'

export function CompleteStep() {
  const navigate = useNavigate()
  const { runState, reset } = useBuildSetup()
  if (!runState) return null

  async function copyPath(p: string) {
    await api.buildCopySummary(p)
    notify('info', 'Copied', 'File path copied to clipboard.')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-300">
        <CheckCircle2 size={20} className="shrink-0" />
        <div>
          <p className="font-semibold">Build completed successfully</p>
          <p className="text-sm text-emerald-400/80">Your application and distribution files are ready.</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">Generated Files</p>
        <div className="flex flex-col gap-1.5">
          {(runState.files ?? []).map((f) => (
            <div key={f.path} className="flex items-center gap-3 rounded-lg border border-edge bg-panel px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{f.name}</p>
                <p className="truncate font-mono text-xs text-slate-500" title={f.sha256}>
                  {formatBytes(f.sizeBytes)} · sha256:{f.sha256.slice(0, 12)}…
                </p>
              </div>
              <button
                onClick={() => void copyPath(f.path)}
                title="Copy file path"
                className="shrink-0 rounded-lg border border-edge p-1.5 text-slate-400 hover:border-accent/50 hover:text-slate-200"
              >
                <Copy size={13} />
              </button>
            </div>
          ))}
          {(!runState.files || runState.files.length === 0) && (
            <p className="text-sm text-slate-500">
              build-manifest.json, build-log.txt and checksums.txt were written to the export folder.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-edge pt-4">
        <button
          onClick={() => runState.outputDir && void api.buildOpenOutput(runState.outputDir)}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-cyan-300"
        >
          <FolderOpen size={14} /> Open Output Folder
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50"
        >
          <RotateCcw size={14} /> Create Another Build
        </button>
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50"
        >
          <LayoutList size={14} /> Return to Projects
        </button>
      </div>
    </div>
  )
}
