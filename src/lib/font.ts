export interface FontDef {
  id: string
  name: string
  /** short descriptor shown under the name in the picker */
  hint: string
  /** the CSS font-family stack applied to --app-font */
  stack: string
}

const SYSTEM_FALLBACK = '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif'

export const FONTS: FontDef[] = [
  { id: 'poppins', name: 'Poppins', hint: 'Rounded & friendly', stack: `"Poppins", ${SYSTEM_FALLBACK}` },
  { id: 'system', name: 'System', hint: 'Segoe UI · native', stack: SYSTEM_FALLBACK },
  { id: 'inter', name: 'Inter', hint: 'Clean & neutral', stack: `"Inter Variable", ${SYSTEM_FALLBACK}` },
  { id: 'geist', name: 'Geist', hint: 'Modern geometric', stack: `"Geist Variable", ${SYSTEM_FALLBACK}` },
]

const STORAGE_KEY = 'devflow-font'
const DEFAULT_FONT = 'poppins'

export function getFontId(): string {
  try {
    const id = localStorage.getItem(STORAGE_KEY)
    if (id && FONTS.some((f) => f.id === id)) return id
  } catch {
    /* ignore */
  }
  return DEFAULT_FONT
}

export function applyFont(id: string): void {
  const font = FONTS.find((f) => f.id === id) ?? FONTS[0]
  const root = document.documentElement
  root.style.setProperty('--app-font', font.stack)
  root.dataset.font = font.id
  try {
    localStorage.setItem(STORAGE_KEY, font.id)
  } catch {
    /* ignore */
  }
}

export function initFont(): void {
  applyFont(getFontId())
}
