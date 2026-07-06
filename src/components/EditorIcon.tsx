import vscodeIcon from '../assets/editors/vscode.png'
import cursorIcon from '../assets/editors/cursor.png'

const ICONS = {
  vscode: vscodeIcon,
  cursor: cursorIcon,
} as const

export function EditorIcon({
  editor,
  size = 15,
  className = '',
}: {
  editor: 'vscode' | 'cursor'
  size?: number
  className?: string
}) {
  return (
    <img
      src={ICONS[editor]}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={`inline-block shrink-0 rounded-[3px] object-contain ${className}`}
    />
  )
}
