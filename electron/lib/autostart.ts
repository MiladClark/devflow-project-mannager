import { app } from 'electron'
import { store } from './store'
import { activity } from './broadcast'
import { getEnforcedEntitlements } from './licensing'

/** Register/unregister DevFlow in the Windows startup list based on settings. */
export function applyLoginItemSettings() {
  // in dev this would register electron.exe — only meaningful in packaged builds
  if (!app.isPackaged) return
  const s = store.getSettings()
  app.setLoginItemSettings({
    openAtLogin: s.launchAtLogin,
    args: s.startMinimized ? ['--hidden'] : [],
  })
}

/** Start all projects flagged autoStart, staggered so they don't fight over CPU. */
export async function autoStartProjects() {
  const flagged = store.getProjects().filter((p) => p.autoStart)
  if (flagged.length === 0) return
  if (!getEnforcedEntitlements().autoStartProjects) {
    activity('warn', 'Auto-start skipped', 'Project auto-start requires a Pro license.')
    return
  }
  const { startProject } = await import('../ipc/runner')
  for (const p of flagged) {
    const res = await startProject(p.id)
    if (!res.ok) {
      activity('warn', 'Auto-start failed', `${p.name}: ${res.error ?? 'unknown error'}`)
    }
    // stagger startups; never auto-terminate whatever holds a port
    await new Promise((r) => setTimeout(r, 3000))
  }
}
