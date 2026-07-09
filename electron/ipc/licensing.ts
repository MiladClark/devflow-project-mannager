import { ipcMain, BrowserWindow } from 'electron'
import {
  getLicenseState,
  activate,
  refresh,
  refreshIfDue,
  clearLicense,
  setServerUrl,
  startOAuthSignIn,
  enterGuestMode,
  exitGuestMode,
  signOutDevice,
  pollValidateIfLicensed,
  startLicensePolling,
} from '../lib/licensing'
import type { ActivateOptions } from '../../src/shared/types'

export function registerLicensingHandlers() {
  ipcMain.handle('license:state', () => getLicenseState())
  ipcMain.handle('license:activate', (_e, opts: ActivateOptions) => activate(opts))
  ipcMain.handle('license:refresh', () => refresh())
  ipcMain.handle('license:clear', () => clearLicense())
  ipcMain.handle('license:setServerUrl', (_e, url: string) => setServerUrl(url))
  ipcMain.handle('auth:start', () => startOAuthSignIn())
  ipcMain.handle('auth:guest', () => enterGuestMode())
  ipcMain.handle('auth:exitGuest', () => exitGuestMode())
  ipcMain.handle('auth:signOut', () => signOutDevice())
  ipcMain.handle('auth:status', () => getLicenseState())
  ipcMain.handle('license:poll', () => pollValidateIfLicensed())

  startLicensePolling()

  void refreshIfDue()
}

/** Attach focus listener for license revalidation on a new window. */
export function attachLicenseFocusHandler(win: BrowserWindow) {
  win.on('focus', () => void pollValidateIfLicensed())
}
