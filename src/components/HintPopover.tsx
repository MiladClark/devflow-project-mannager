import { useEffect, useRef, useState } from 'react'
import { CircleHelp, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react'
import { hints } from '../lib/hints'

export function HintPopover({ hintKey }: { hintKey: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const hint = hints[hintKey]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!hint) return null

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        title={`About ${hint.title}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(!open)
        }}
        className={`rounded-full p-0.5 transition-colors ${open ? 'text-accent' : 'text-slate-500 hover:text-accent'}`}
      >
        <CircleHelp size={15} />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-7 right-0 z-30 w-80 cursor-default rounded-xl border border-edge bg-panel2 p-4 text-left shadow-2xl shadow-black/50"
        >
          <p className="mb-3 text-sm font-bold text-white">{hint.title}</p>

          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <CheckCircle2 size={13} /> Use cases
          </p>
          <ul className="mb-3 list-disc pl-5 text-xs leading-5 text-slate-300">
            {hint.useCases.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>

          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <AlertTriangle size={13} /> Limitations
          </p>
          <ul className="mb-3 list-disc pl-5 text-xs leading-5 text-slate-300">
            {hint.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>

          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
            <Lightbulb size={13} /> Recommendation
          </p>
          <p className="text-xs leading-5 text-slate-300">{hint.recommendation}</p>
        </div>
      )}
    </div>
  )
}
