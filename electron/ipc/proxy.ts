import { ipcMain } from 'electron'
import { getProxySetupStatus, setupProxy, projectDomain, validateLocalSlug } from '../lib/proxy'

export function registerProxyHandlers() {
  ipcMain.handle('proxy:status', () => getProxySetupStatus())
  ipcMain.handle('proxy:setup', () => setupProxy())
  ipcMain.handle('proxy:domain', (_e, projectId: string) => projectDomain(projectId))
  ipcMain.handle('proxy:validateSlug', (_e, slug: string, excludeProjectId?: string) => validateLocalSlug(slug, excludeProjectId))
}
