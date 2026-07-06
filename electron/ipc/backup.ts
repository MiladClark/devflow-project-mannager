import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import type { Project, DbConnection, AppSettings, BackupImportResult } from '../../src/shared/types'
import { store } from '../lib/store'
import { broadcast, activity } from '../lib/broadcast'
import { getEnforcedEntitlements } from '../lib/licensing'

interface BackupFile {
  formatVersion: 1
  appVersion: string
  exportedAt: string
  projects: Project[]
  settings: AppSettings
  connections: DbConnection[]
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

async function exportBackup(e: Electron.IpcMainInvokeEvent, opts: { includePasswords: boolean }) {
  const win = BrowserWindow.fromWebContents(e.sender)
  const res = await dialog.showSaveDialog(win!, {
    title: 'Export DevFlow backup',
    defaultPath: `devflow-backup-${today()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (res.canceled || !res.filePath) return { ok: false, error: 'cancelled' }

  const payload: BackupFile = {
    formatVersion: 1,
    appVersion: app.getVersion(),
    exportedAt: new Date().toISOString(),
    projects: store.getProjects(),
    settings: store.getSettings(),
    connections: store.getConnections().map((c) => ({
      ...c,
      password: opts.includePasswords ? c.password : '',
    })),
  }
  try {
    fs.writeFileSync(res.filePath, JSON.stringify(payload, null, 2), 'utf-8')
    activity('ok', 'Backup Exported', res.filePath)
    return { ok: true, file: res.filePath }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function validProject(p: unknown): p is Project {
  const x = p as Project
  return !!x && typeof x.id === 'string' && typeof x.name === 'string' && typeof x.path === 'string'
}

async function importBackup(e: Electron.IpcMainInvokeEvent, opts: { mode: 'merge' | 'replace' }): Promise<BackupImportResult> {
  const fail = (error: string): BackupImportResult => ({
    ok: false,
    error,
    projectsAdded: 0,
    projectsSkipped: 0,
    connectionsAdded: 0,
    warnings: [],
  })

  const win = BrowserWindow.fromWebContents(e.sender)
  const res = await dialog.showOpenDialog(win!, {
    title: 'Import DevFlow backup',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (res.canceled || res.filePaths.length === 0) return fail('cancelled')

  let parsed: BackupFile
  try {
    parsed = JSON.parse(fs.readFileSync(res.filePaths[0], 'utf-8'))
  } catch {
    return fail('The selected file is not valid JSON.')
  }
  if (parsed.formatVersion !== 1 || !Array.isArray(parsed.projects) || !Array.isArray(parsed.connections)) {
    return fail('This file is not a DevFlow backup (unsupported format).')
  }

  const limits = getEnforcedEntitlements()
  if (!limits.cloudBackup) {
    return fail('Cloud backup import requires a Pro plan with cloud backup enabled.')
  }

  const warnings: string[] = []

  if (opts.mode === 'replace') {
    for (const p of store.getProjects()) store.removeProject(p.id)
    for (const c of store.getConnections()) store.removeConnection(c.id)
  }

  const existing = store.getProjects()
  const existingIds = new Set(existing.map((p) => p.id))
  const existingPaths = new Set(existing.map((p) => p.path.toLowerCase()))

  let projectsAdded = 0
  let projectsSkipped = 0
  for (const p of parsed.projects) {
    if (!validProject(p)) {
      projectsSkipped++
      warnings.push(`Skipped an invalid project entry.`)
      continue
    }
    if (existingIds.has(p.id) || existingPaths.has(p.path.toLowerCase())) {
      projectsSkipped++
      continue
    }
    if (store.getProjects().length >= limits.maxProjects) {
      warnings.push(`Free plan limit of ${limits.maxProjects} projects reached — remaining projects were skipped.`)
      projectsSkipped += 1
      continue
    }
    if (!fs.existsSync(p.path)) warnings.push(`Project folder missing on disk: ${p.path}`)
    store.addProject(p)
    existingIds.add(p.id)
    existingPaths.add(p.path.toLowerCase())
    projectsAdded++
  }

  const existingConnIds = new Set(store.getConnections().map((c) => c.id))
  let connectionsAdded = 0
  for (const c of parsed.connections) {
    if (!c || typeof c.id !== 'string' || existingConnIds.has(c.id)) continue
    store.saveConnection(c)
    connectionsAdded++
  }

  if (parsed.settings && typeof parsed.settings === 'object') {
    const { reservedPorts, defaultProjectsDir, ...rest } = parsed.settings
    store.updateSettings({
      ...(Array.isArray(reservedPorts) ? { reservedPorts } : {}),
      ...(typeof defaultProjectsDir === 'string' ? { defaultProjectsDir } : {}),
      ...rest,
    })
  }

  broadcast('projects:changed', store.getProjects())
  broadcast('connections:changed', store.getConnections())
  activity('ok', 'Backup Imported', `${projectsAdded} projects, ${connectionsAdded} connections`)
  return { ok: true, projectsAdded, projectsSkipped, connectionsAdded, warnings }
}

export function registerBackupHandlers() {
  ipcMain.handle('backup:export', (e, opts: { includePasswords: boolean }) => exportBackup(e, opts))
  ipcMain.handle('backup:import', (e, opts: { mode: 'merge' | 'replace' }) => importBackup(e, opts))
}
