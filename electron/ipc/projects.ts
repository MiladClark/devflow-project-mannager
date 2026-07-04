import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import path from 'node:path'
import type { Project } from '../../src/shared/types'
import { store } from '../lib/store'
import { detectProject } from '../lib/detect'
import { checkPort } from '../lib/ports'

function broadcast(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, ...args)
}

function notifyChanged() {
  broadcast('projects:changed', store.getProjects())
}

export function importProjectFromPath(dir: string): { ok: boolean; project?: Project; error?: string } {
  if (store.getProjects().some((p) => p.path.toLowerCase() === dir.toLowerCase())) {
    return { ok: false, error: 'This folder is already imported.' }
  }
  const result = detectProject(dir)
  if ('error' in result) return { ok: false, error: result.error }
  store.addProject(result)
  const ev = store.addActivity({ level: 'ok', title: 'Project Imported', message: result.name })
  broadcast('activity:event', ev)
  notifyChanged()
  return { ok: true, project: result }
}

export function registerProjectHandlers() {
  ipcMain.handle('projects:list', () => store.getProjects())

  ipcMain.handle('projects:import', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const res = await dialog.showOpenDialog(win!, {
      title: 'Select a project folder',
      properties: ['openDirectory'],
    })
    if (res.canceled || res.filePaths.length === 0) return { ok: false, error: 'cancelled' }
    return importProjectFromPath(res.filePaths[0])
  })

  ipcMain.handle('projects:remove', (_e, id: string) => {
    const p = store.getProject(id)
    store.removeProject(id)
    if (p) {
      const ev = store.addActivity({ level: 'info', title: 'Project Removed', message: p.name })
      broadcast('activity:event', ev)
    }
    notifyChanged()
    return true
  })

  ipcMain.handle('projects:update', (_e, id: string, patch: Partial<Project>) => {
    // never allow identity fields to be patched
    const { id: _id, path: _path, createdAt: _c, ...safe } = patch as Project
    const updated = store.updateProject(id, safe)
    notifyChanged()
    return updated
  })

  ipcMain.handle('projects:openFolder', (_e, id: string) => {
    const p = store.getProject(id)
    if (p) shell.openPath(p.path)
  })

  ipcMain.handle('projects:openOutput', (_e, id: string) => {
    const p = store.getProject(id)
    if (p) shell.openPath(path.join(p.path, p.outputDir))
  })

  ipcMain.handle('ports:check', (_e, port: number, excludeProjectId?: string) => checkPort(port, excludeProjectId))

  ipcMain.handle('activity:list', () => store.getActivity())
  ipcMain.handle('settings:get', () => store.getSettings())
  ipcMain.handle('settings:update', (_e, patch) => store.updateSettings(patch))
}
