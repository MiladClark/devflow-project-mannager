import { Download, X } from 'lucide-react'

export function UpdateBanner({
  version,
  required,
  onUpdate,
  onDismiss,
}: {
  version: string
  required?: boolean
  onUpdate: () => void
  onDismiss?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#22d3ee]/25 bg-[#22d3ee]/10 px-4 py-2.5">
      <p className="text-sm text-slate-200">
        <span className="font-semibold text-[#22d3ee]">Update available</span>
        {' — '}
        Version {version} is ready
        {required ? ' (required)' : ''}.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onUpdate}
          className="flex items-center gap-1.5 rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-[#0b1120] hover:bg-cyan-300"
        >
          <Download size={13} /> Update now
        </button>
        {!required && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-200"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
