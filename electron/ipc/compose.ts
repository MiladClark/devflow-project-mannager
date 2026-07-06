import { ipcMain } from 'electron'
import { composeUp, composeDown, composePs, composeLogs, detectComposeFile } from '../lib/compose'
import { store } from '../lib/store'

export function registerComposeHandlers() {
  ipcMain.handle('compose:detect', (_e, projectId: string) => {
    const p = store.getProject(projectId)
    if (!p) return null
    return p.composeFile ?? detectComposeFile(p.path) ?? null
  })
  ipcMain.handle('compose:ps', (_e, projectId: string) => composePs(projectId))
  ipcMain.handle('compose:up', (_e, projectId: string) => composeUp(projectId))
  ipcMain.handle('compose:down', (_e, projectId: string) => composeDown(projectId))
  ipcMain.handle('compose:logs', (_e, projectId: string, service?: string) => composeLogs(projectId, service))
}
