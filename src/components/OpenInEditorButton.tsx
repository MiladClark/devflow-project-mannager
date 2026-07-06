import { useEffect, useRef, useState } from 'react'
import { Code2, ChevronDown } from 'lucide-react'
import { api } from '../lib/ipc'
import type { PreferredEditor } from '../shared/types'
import { EditorIcon } from './EditorIcon'

const MENU_OPTIONS = [
  { id: 'vscode' as const, label: 'VS Code' },
  { id: 'cursor' as const, label: 'Cursor' },
]

export function OpenInEditorButton({
  projectId,
  className = '',
  compact,
}: {
  projectId: string
  className?: string
  compact?: boolean
}) {
  const [editors, setEditors] = useState({ vscode: false, cursor: false })
  const [selected, setSelected] = useState<'vscode' | 'cursor'>('vscode')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.detectEditors().then(setEditors)
    api.getSettings().then((s) => {
      if (s.preferredEditor === 'vscode' || s.preferredEditor === 'cursor') {
        setSelected(s.preferredEditor)
      }
    })
  }, [])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  async function launch(editor: PreferredEditor) {
    setOpen(false)
    if (editor === 'vscode' || editor === 'cursor') {
      setSelected(editor)
      void api.updateSettings({ preferredEditor: editor })
    }
    const res = await api.openInEditor(projectId, editor)
    if (!res.ok && res.error) {
      const { notify } = await import('../state/notifications')
      notify('error', 'Open in editor failed', res.error)
    }
  }

  const anyInstalled = editors.vscode || editors.cursor
  const selectedLabel = selected === 'vscode' ? 'VS Code' : 'Cursor'

  if (!anyInstalled) {
    return (
      <button
        type="button"
        title="Open in editor (install VS Code or Cursor)"
        onClick={(e) => {
          e.stopPropagation()
          void launch('vscode')
        }}
        className={`press rounded-md p-1.5 text-slate-400 transition-colors hover:bg-accent/10 hover:text-accent ${className}`}
      >
        <Code2 size={15} />
      </button>
    )
  }

  const triggerClass = compact
    ? 'press flex items-center gap-0.5 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-accent/10 hover:text-accent'
    : 'press flex items-center gap-0.5 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-accent/10 hover:text-accent'

  return (
    <div ref={rootRef} className={`relative ${className}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title={`Open in ${selectedLabel}`}
        onClick={() => setOpen((o) => !o)}
        className={triggerClass}
      >
        <EditorIcon editor={selected} size={15} />
        <ChevronDown
          size={11}
          className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
        />
      </button>
      {open && (
        <div className="animate-pop-in absolute top-full right-0 z-50 mt-1 min-w-36 rounded-lg border border-edge bg-panel p-1 shadow-xl">
          {MENU_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => void launch(o.id)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-800/60 ${
                selected === o.id ? 'text-accent' : 'text-slate-300'
              }`}
            >
              <EditorIcon editor={o.id} size={14} />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
