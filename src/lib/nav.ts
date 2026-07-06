import {
  LayoutDashboard,
  FolderKanban,
  ScrollText,
  Database,
  Plug,
  Wrench,
  KeyRound,
  Settings as SettingsIcon,
  Activity,
  type LucideIcon,
} from 'lucide-react'

export interface NavPage {
  label: string
  to: string
  icon: LucideIcon
}

export interface NavGroup {
  title: string
  pages: NavPage[]
}

/** Sidebar groups — ordered by daily-use priority (workspace → system → data → app). */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Workspace',
    pages: [
      { label: 'Dashboard', to: '/', icon: LayoutDashboard },
      { label: 'Projects', to: '/projects', icon: FolderKanban },
      { label: 'Logs', to: '/logs', icon: ScrollText },
    ],
  },
  {
    title: 'System',
    pages: [
      { label: 'System Health', to: '/system', icon: Activity },
      { label: 'App and Tools', to: '/tools', icon: Wrench },
    ],
  },
  {
    title: 'Data',
    pages: [
      { label: 'Database', to: '/database', icon: Database },
      { label: 'Connections', to: '/connections', icon: Plug },
    ],
  },
  {
    title: 'App',
    pages: [
      { label: 'Account', to: '/account', icon: KeyRound },
      { label: 'Settings', to: '/settings', icon: SettingsIcon },
    ],
  },
]

/** Flat page list — SearchBox, command palette, Ctrl+1–9 shortcuts. */
export const PAGES: NavPage[] = NAV_GROUPS.flatMap((g) => g.pages)
