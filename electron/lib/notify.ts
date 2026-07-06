import { Notification, BrowserWindow } from 'electron'
import type { AppSettings, RuntimeInfo } from '../../src/shared/types'
import { store } from './store'
import { onRuntimeChange } from '../ipc/runner'
import { checkForUpdates } from './updates'
import { getLicenseState } from './licensing'
import { notifyUpdateAvailable } from '../ipc/updates'

type NotifyKind = 'crash' | 'build' | 'update'

const SETTING_FOR_KIND: Record<NotifyKind, keyof AppSettings> = {
  crash: 'notifyCrash',
  build: 'notifyBuild',
  update: 'notifyUpdates',
}

let getWin: () => BrowserWindow | null = () => null

export function notify(kind: NotifyKind, title: string, body: string, route?: string) {
  const settings = store.getSettings()
  if (!settings[SETTING_FOR_KIND[kind]]) return
  const win = getWin()
  // in-app banner when focused; system toast when in background
  if (win && win.isVisible() && win.isFocused()) return
  if (!Notification.isSupported()) return

  const n = new Notification({ title, body })
  n.on('click', () => {
    const w = getWin()
    if (w) {
      w.show()
      w.focus()
      if (route) w.webContents.send('app:navigate', route)
    }
  })
  n.show()
}

const prevStatus = new Map<string, RuntimeInfo['status']>()

function watchRuntime() {
  onRuntimeChange((projectId, info, project) => {
    const prev = prevStatus.get(projectId)
    prevStatus.set(projectId, info.status)
    if (!project || prev === info.status) return

    if (info.kind === 'dev' && info.status === 'error') {
      notify('crash', 'Dev server crashed', `${project.name} exited with code ${info.exitCode ?? '?'}`, `/projects/${projectId}`)
    } else if (info.kind === 'build' && prev === 'building') {
      if (info.status === 'stopped' && info.exitCode === 0) {
        notify('build', 'Build finished', `${project.name} built successfully.`, `/projects/${projectId}`)
      } else if (info.status === 'error') {
        notify('build', 'Build failed', `${project.name} exited with code ${info.exitCode ?? '?'}`, `/projects/${projectId}`)
      }
    }
  })
}

let updateTimer: NodeJS.Timeout | null = null
let notifiedVersion = ''

async function pollUpdates() {
  if (!store.getSettings().notifyUpdates) return
  const res = await checkForUpdates(getLicenseState().serverUrl)
  if (res.ok && res.updateAvailable && res.latest && res.latest.version !== notifiedVersion) {
    notifiedVersion = res.latest.version
    notifyUpdateAvailable({
      version: res.latest.version,
      required: !!res.required,
      releaseNotes: res.latest.releaseNotes,
    })
    notify('update', 'DevFlow update available', `Version ${res.latest.version} is ready.`, '/account')
  }
}

export function startNotifications(winGetter: () => BrowserWindow | null) {
  getWin = winGetter
  watchRuntime()
  // first check shortly after launch, then every 4 hours
  setTimeout(() => void pollUpdates(), 30_000)
  updateTimer = setInterval(() => void pollUpdates(), 4 * 60 * 60 * 1000)
}

export function stopNotifications() {
  if (updateTimer) clearInterval(updateTimer)
  updateTimer = null
}
