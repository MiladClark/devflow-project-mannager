import { BrowserWindow } from 'electron'
import { store } from './store'
import type { ActivityEvent } from '../../src/shared/types'

export function broadcast(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args)
  }
}

export function activity(level: ActivityEvent['level'], title: string, message: string) {
  const ev = store.addActivity({ level, title, message })
  broadcast('activity:event', ev)
  return ev
}
