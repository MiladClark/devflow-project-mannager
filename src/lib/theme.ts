export type ThemeMode = 'dark' | 'light'

export interface ThemeDef {
  id: string
  name: string
  /** swatch colors for the picker */
  accent: { dark: string; light: string }
  surface: { dark: string; light: string }
}

export const THEMES: ThemeDef[] = [
  { id: 'ocean', name: 'Ocean', accent: { dark: '#22d3ee', light: '#0891b2' }, surface: { dark: '#0b1120', light: '#eef3f8' } },
  { id: 'violet', name: 'Violet', accent: { dark: '#a78bfa', light: '#7c3aed' }, surface: { dark: '#100b20', light: '#f3f0fa' } },
  { id: 'emerald', name: 'Emerald', accent: { dark: '#34d399', light: '#059669' }, surface: { dark: '#0a1712', light: '#eef6f1' } },
  { id: 'sunset', name: 'Sunset', accent: { dark: '#fb923c', light: '#ea580c' }, surface: { dark: '#171007', light: '#faf4ec' } },
  { id: 'rose', name: 'Rose', accent: { dark: '#fb7185', light: '#e11d48' }, surface: { dark: '#170b10', light: '#faf0f3' } },
  { id: 'granite', name: 'Granite', accent: { dark: '#c4c4cc', light: '#52525b' }, surface: { dark: '#0c0c0e', light: '#e8e8ea' } },
]

const STORAGE_KEY = 'devflow-theme'

export interface ThemeChoice {
  theme: string
  mode: ThemeMode
}

const DEFAULT: ThemeChoice = { theme: 'ocean', mode: 'dark' }

export function getThemeChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT
    const parsed = JSON.parse(raw)
    if (THEMES.some((t) => t.id === parsed.theme) && (parsed.mode === 'dark' || parsed.mode === 'light')) {
      return parsed
    }
  } catch {
    /* fall through */
  }
  return DEFAULT
}

export function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.theme = choice.theme
  document.documentElement.dataset.mode = choice.mode
  localStorage.setItem(STORAGE_KEY, JSON.stringify(choice))
}

export function initTheme() {
  applyTheme(getThemeChoice())
}
