import { create } from 'zustand'

export type NotifyLevel = 'success' | 'error' | 'warn' | 'info'

export interface AppNotification {
  id: string
  level: NotifyLevel
  title: string
  message?: string
  ts: number
  read: boolean
  /** optional in-app route opened when the notification is clicked */
  route?: string
  /** whether the toast has been dismissed from the on-screen stack */
  toastDismissed: boolean
}

interface NotifyInput {
  level: NotifyLevel
  title: string
  message?: string
  route?: string
}

interface NotificationState {
  items: AppNotification[]
  add: (n: NotifyInput) => string
  dismissToast: (id: string) => void
  markAllRead: () => void
  remove: (id: string) => void
  clear: () => void
}

const MAX_ITEMS = 100
// collapse identical notifications raised within this window into one — the same
// event often arrives from both a direct notify() call and the activity bridge
const DEDUPE_MS = 2500
let seq = 0

export const useNotifications = create<NotificationState>((set, get) => ({
  items: [],
  add: (n) => {
    const now = Date.now()
    const sig = `${n.level}|${n.title}|${n.message ?? ''}`
    const dup = get().items.find(
      (i) => now - i.ts < DEDUPE_MS && `${i.level}|${i.title}|${i.message ?? ''}` === sig,
    )
    if (dup) return dup.id

    const id = `n${now.toString(36)}-${seq++}`
    const item: AppNotification = {
      id,
      level: n.level,
      title: n.title,
      message: n.message,
      route: n.route,
      ts: now,
      read: false,
      toastDismissed: false,
    }
    set((s) => ({ items: [item, ...s.items].slice(0, MAX_ITEMS) }))
    return id
  },
  dismissToast: (id) =>
    set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, toastDismissed: true } : i)) })),
  markAllRead: () => set((s) => ({ items: s.items.map((i) => ({ ...i, read: true })) })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [] }),
}))

/** Imperative helper so non-React code (event bridges) can raise notifications. */
export function notify(level: NotifyLevel, title: string, message?: string, route?: string): string {
  return useNotifications.getState().add({ level, title, message, route })
}
