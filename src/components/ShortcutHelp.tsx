import { X, Keyboard } from 'lucide-react'
import { PAGES } from '../lib/nav'

const GENERAL: [string, string][] = [
  ['/', 'Focus search bar'],
  ['Ctrl + K', 'Open command palette'],
  ['Ctrl + Shift + P', 'Open command palette'],
  ['Ctrl + /', 'Show this shortcut list'],
  ['Esc', 'Close dialogs'],
]

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl border border-edge bg-panel p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <Keyboard size={16} className="text-accent" /> Keyboard Shortcuts
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {GENERAL.map(([keys, desc]) => (
            <div key={keys} className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{desc}</span>
              <kbd className="rounded-md border border-edge bg-bg px-2 py-0.5 font-mono text-xs text-slate-300">{keys}</kbd>
            </div>
          ))}
          <div className="my-2 border-t border-edge" />
          {PAGES.map((p, i) => (
            <div key={p.to} className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Go to {p.label}</span>
              <kbd className="rounded-md border border-edge bg-bg px-2 py-0.5 font-mono text-xs text-slate-300">
                Ctrl + {i + 1}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
