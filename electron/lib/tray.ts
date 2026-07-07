import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron'
import { loadBrandIcon } from './icon'
import { store } from './store'
import { getRuntimeSnapshot, startProject, stopProjectById, stopAll, stopAllRunning } from '../ipc/runner'

let tray: Tray | null = null
let getWin: () => BrowserWindow | null = () => null

export function refreshTrayMenu() {
  if (!tray) return
  const projects = store.getProjects().slice(0, store.getSettings().trayProjectCount)
  const runtime = getRuntimeSnapshot()

  const projectItems = projects.map((p) => {
    const rt = runtime[p.id]
    const running = rt?.status === 'running' || rt?.status === 'starting'
    return {
      label: `${running ? '● ' : '○ '}${p.name}`,
      submenu: [
        running
          ? { label: 'Stop', click: () => void stopProjectById(p.id) }
          : { label: 'Start', click: () => void startProject(p.id) },
        {
          label: 'Open in DevFlow',
          click: () => {
            const win = getWin()
            if (win) {
              win.show()
              win.focus()
              win.webContents.send('app:navigate', `/projects/${p.id}`)
            }
          },
        },
      ],
    }
  })

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show DevFlow',
      click: () => {
        const win = getWin()
        if (win) {
          win.show()
          win.focus()
        }
      },
    },
    { type: 'separator' },
    ...projectItems,
    ...(projectItems.length > 0 ? [{ type: 'separator' as const }] : []),
    {
      label: 'Stop all projects',
      click: () => void stopAllRunning(),
    },
    { type: 'separator' },
    {
      label: 'Quit DevFlow',
      click: async () => {
        await stopAll()
        app.quit()
      },
    },
  ])
  tray.setContextMenu(menu)
}

export async function createTray(winGetter: () => BrowserWindow | null) {
  if (tray) return
  getWin = winGetter
  const icon = loadBrandIcon()
  const trayIcon =
    icon && !icon.isEmpty() ? icon.resize({ width: 16, height: 16 }) : nativeImage.createEmpty()
  tray = new Tray(trayIcon)
  tray.setToolTip('DevFlow Manager')
  tray.on('click', () => {
    const win = getWin()
    if (win) {
      win.show()
      win.focus()
    }
  })
  refreshTrayMenu()
}

export function destroyTray() {
  tray?.destroy()
  tray = null
}
