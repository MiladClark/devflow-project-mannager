const STORAGE_KEY = 'devflow-sidebar-pinned'

export function getSidebarPinned(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setSidebarPinned(pinned: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, pinned ? '1' : '0')
  } catch {
    /* ignore */
  }
}
