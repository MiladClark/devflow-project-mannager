import { useEffect, useRef, useState } from 'react'
import { Code2, ChevronDown } from 'lucide-react'
import { api } from '../lib/ipc'
import { useApp } from '../state/store'
import type { PreferredEditor } from '../shared/types'
import { EditorIcon } from './EditorIcon'

const LABEL: Record<'vscode' | 'cursor', string> = { vscode: 'VS Code', cursor: 'Cursor' }

export function OpenInEditorButton({ projectId, className = '' }: { projectId: string; className?: string }) {
  const preferredEditor = useApp((s) => s.settings?.preferredEditor)
  const [editors, setEditors] = useState({ vscode: false, cursor: false })
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.detectEditors().then(setEditors)
  }, [])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  async function launch(editor: 'vscode' | 'cursor') {
    setOpen(false)
    if (editor !== preferredEditor) void api.updateSettings({ preferredEditor: editor }).then((s) => useApp.setState({ settings: s }))
    const res = await api.openInEditor(projectId, editor)
    if (!res.ok && res.error) {
      const { notify } = await import('../state/notifications')
      notify('error', 'Open in editor failed', res.error)
    }
  }

  const anyInstalled = editors.vscode || editors.cursor
  const bothInstalled = editors.vscode && editors.cursor
  const selected: 'vscode' | 'cursor' =
    preferredEditor === 'vscode' || preferredEditor === 'cursor'
      ? preferredEditor
      : editors.vscode
        ? 'vscode'
        : 'cursor'
  const other: 'vscode' | 'cursor' = selected === 'vscode' ? 'cursor' : 'vscode'

  if (!anyInstalled) {
    return (
      <button
        type="button"
        title="Open in editor (install VS Code or Cursor)"
        onClick={() => void launch('vscode')}
        className={`flex items-center gap-2 rounded-lg border border-edge px-4 py-2 text-sm text-slate-300 hover:border-accent/50 ${className}`}
      >
        <Code2 size={15} /> Open in Editor
      </button>
    )
  }

  return (
    <div ref={rootRef} className={`relative flex items-stretch rounded-lg border border-edge ${className}`}>
      <button
        type="button"
        title={`Open in ${LABEL[selected]}`}
        onClick={() => void launch(selected)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-accent/5 hover:text-white"
      >
        <EditorIcon editor={selected} size={15} />
        Open in {LABEL[selected]}
      </button>
      {bothInstalled && (
        <>
          <button
            type="button"
            title="Switch editor"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center justify-center border-l border-edge px-2 text-slate-400 hover:bg-accent/5 hover:text-accent"
          >
            <ChevronDown size={13} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
          </button>
          {open && (
            <div className="animate-pop-in app-frost-popover absolute top-full right-0 z-50 mt-1 min-w-40 rounded-lg border border-edge p-1 shadow-xl">
              <button
                type="button"
                onClick={() => void launch(other)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white"
              >
                <EditorIcon editor={other} size={14} />
                Open in {LABEL[other]}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
