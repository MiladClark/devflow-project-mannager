import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import path from 'node:path'
import type { Project } from '../../src/shared/types'
import { store } from '../lib/store'
import { detectProject } from '../lib/detect'
import { checkPort, getPortStatusOverview } from '../lib/ports'
import { getPortOwner, takeoverPort } from '../lib/portOwner'
import { getEnforcedEntitlements, isGuestAccess, GUEST_ACTION_ERROR } from '../lib/licensing'
import { applyLoginItemSettings } from '../lib/autostart'
import { openInEditor, detectEditors } from '../lib/editor'
import { scanForProjects } from '../lib/scanProjects'
import { validateLocalSlug } from '../lib/proxy'

function broadcast(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, ...args)
}

function notifyChanged() {
  broadcast('projects:changed', store.getProjects())
  void import('../lib/tray').then((t) => t.refreshTrayMenu())
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
    if (isGuestAccess()) return { ok: false, error: GUEST_ACTION_ERROR }
    const limits = getEnforcedEntitlements()
    if (store.getProjects().length >= limits.maxProjects) {
      return {
        ok: false,
        error: `Free plan is limited to ${limits.maxProjects} projects. Upgrade on the DevTune website to add more.`,
      }
    }
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
    const { id: _id, path: _path, createdAt: _c, ...safe } = patch as Project
    if (safe.autoStart === true && !getEnforcedEntitlements().autoStartProjects) {
      return undefined
    }
    if (safe.localSlug !== undefined) {
      const err = validateLocalSlug(safe.localSlug, id)
      if (err) return undefined
    }
    const updated = store.updateProject(id, safe)
    notifyChanged()
    return updated
  })

  ipcMain.handle('projects:openInEditor', async (_e, id: string, editor?: string) => {
    const p = store.getProject(id)
    if (!p) return { ok: false, error: 'Project not found' }
    return openInEditor(p.path, editor as import('../../src/shared/types').PreferredEditor | undefined)
  })

  ipcMain.handle('projects:detectEditors', () => detectEditors())

  ipcMain.handle('projects:scan', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const settings = store.getSettings()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Scan folder for projects',
      defaultPath: settings.defaultProjectsDir,
      properties: ['openDirectory'],
    })
    if (res.canceled || res.filePaths.length === 0) {
      return { ok: false, cancelled: true, candidates: [], skipped: [] }
    }
    const { candidates, skipped } = scanForProjects(res.filePaths[0])
    return { ok: true, candidates, skipped }
  })

  ipcMain.handle('projects:importMany', (_e, paths: string[]) => {
    if (isGuestAccess()) return { ok: false, added: 0, errors: [GUEST_ACTION_ERROR] }
    const limits = getEnforcedEntitlements()
    let added = 0
    const errors: string[] = []
    for (const dir of paths) {
      if (store.getProjects().length >= limits.maxProjects) {
        errors.push(`Project limit reached (${limits.maxProjects}).`)
        break
      }
      const res = importProjectFromPath(dir)
      if (res.ok) added++
      else if (res.error && res.error !== 'This folder is already imported.') errors.push(res.error)
    }
    return { ok: added > 0, added, errors }
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
  ipcMain.handle('ports:status', () => getPortStatusOverview())
  ipcMain.handle('ports:owner', (_e, port: number) => getPortOwner(port))
  ipcMain.handle('ports:takeover', (_e, port: number, opts?: { skipConfirm?: boolean }) => takeoverPort(port, opts))

  ipcMain.handle('activity:list', () => store.getActivity())
  ipcMain.handle('settings:get', () => store.getSettings())
  ipcMain.handle('settings:update', (_e, patch) => {
    const updated = store.updateSettings(patch)
    applyLoginItemSettings()
    return updated
  })
}
