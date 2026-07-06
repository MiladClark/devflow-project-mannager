import { ipcMain, BrowserWindow } from 'electron'
import { broadcast } from '../lib/broadcast'

function senderWindow(e: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(e.sender)
}

export function registerWindowHandlers() {
  ipcMain.handle('window:minimize', (e) => {
    senderWindow(e)?.minimize()
  })

  ipcMain.handle('window:toggleMaximize', (e) => {
    const win = senderWindow(e)
    if (!win) return false
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  })

  ipcMain.handle('window:isMaximized', (e) => senderWindow(e)?.isMaximized() ?? false)

  ipcMain.handle('window:close', (e) => {
    senderWindow(e)?.close()
  })
}

export function attachWindowStateEvents(win: BrowserWindow) {
  const send = (maximized: boolean) => broadcast('window:maximized', maximized)
  win.on('maximize', () => send(true))
  win.on('unmaximize', () => send(false))
}
