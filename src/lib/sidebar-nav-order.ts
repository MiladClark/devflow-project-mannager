import { NAV_GROUPS, type NavGroup } from './nav'

const STORAGE_KEY = 'devflow-sidebar-nav-order'

export function getNavGroupOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) return null
    return parsed
  } catch {
    return null
  }
}

export function setNavGroupOrder(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

export function resetNavGroupOrder() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Merge saved order with defaults — drops unknown ids, appends new groups. */
export function getOrderedNavGroups(): NavGroup[] {
  const saved = getNavGroupOrder()
  if (!saved?.length) return [...NAV_GROUPS]

  const byId = new Map(NAV_GROUPS.map((g) => [g.id, g]))
  const ordered: NavGroup[] = []

  for (const id of saved) {
    const group = byId.get(id)
    if (group) {
      ordered.push(group)
      byId.delete(id)
    }
  }

  for (const group of NAV_GROUPS) {
    if (byId.has(group.id)) ordered.push(group)
  }

  return ordered
}
