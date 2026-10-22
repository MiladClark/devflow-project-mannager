import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import {
  autoUpdater,
  CancellationToken,
  type Logger,
  type ProgressInfo,
  type UpdateInfo,
} from 'electron-updater'
import { checkForUpdates, getUpdateChannel } from './updates'
import { getLicenseState } from './licensing'
import { stopAll } from '../ipc/runner'

export type UpdatePhase =
  | 'idle'
  | 'downloading'
  | 'paused'
  | 'verifying'
  | 'ready'
  | 'applying'
  | 'restarting'
  | 'error'
  | 'cancelled'

export interface UpdateProgress {
  phase: UpdatePhase
  percent: number
  message: string
  version?: string
  error?: string
  bytesReceived?: number
  bytesTotal?: number
  bytesPerSec?: number
}

interface PendingUpdate {
  version: string
  required: boolean
  releaseNotes?: string | null
}

interface InstallAttempt {
  fromVersion: string
  targetVersion: string
  attemptedAt: string
}

let pendingUpdate: PendingUpdate | null = null
let updaterInfo: UpdateInfo | null = null
let onProgress: ((progress: UpdateProgress) => void) | null = null
let downloadCancellation: CancellationToken | null = null
let abortReason: 'pause' | 'cancel' | null = null
let updateActive = false
let activeUpdateRequired = false
let readyToInstall = false
let updaterConfigured = false
let quittingForUpdate = false
let lastDownloadProgress: ProgressInfo | null = null

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function updaterLogPath(): string {
  return path.join(app.getPath('userData'), 'logs', 'updater.log')
}

function appendUpdaterLog(level: string, message: unknown) {
  try {
    const logPath = updaterLogPath()
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    const text = typeof message === 'string' ? message : JSON.stringify(message)
    fs.appendFileSync(logPath, `${new Date().toISOString()} [${level}] ${text}\n`, 'utf8')
  } catch {
    // Updating must never fail just because diagnostics could not be written.
  }
}

const updaterLogger: Logger = {
  info: (message) => appendUpdaterLog('INFO', message),
  warn: (message) => appendUpdaterLog('WARN', message),
  error: (message) => appendUpdaterLog('ERROR', message),
  debug: (message) => appendUpdaterLog('DEBUG', message),
}

function emit(progress: UpdateProgress) {
  onProgress?.(progress)
}

// Event callbacks mutate this while downloadUpdate awaits; a getter prevents
// TypeScript from incorrectly treating the local snapshot as permanently null.
function getLastDownloadProgress(): ProgressInfo | null {
  return lastDownloadProgress
}

function installAttemptPath(): string {
  return path.join(app.getPath('userData'), 'pending-update-install.json')
}

function writeInstallAttempt(targetVersion: string) {
  const attempt: InstallAttempt = {
    fromVersion: app.getVersion(),
    targetVersion,
    attemptedAt: new Date().toISOString(),
  }
  fs.writeFileSync(installAttemptPath(), JSON.stringify(attempt, null, 2), 'utf8')
}

/**
 * The installer cannot report back after this process exits. Persisting the
 * target version lets the next launch prove that installation completed. If
 * the old version starts again, surface an actionable failure instead of
 * silently claiming success.
 */
function consumePreviousInstallAttempt(): UpdateProgress | null {
  const marker = installAttemptPath()
  if (!fs.existsSync(marker)) return null

  try {
    const attempt = JSON.parse(fs.readFileSync(marker, 'utf8')) as InstallAttempt
    fs.unlinkSync(marker)
    if (normalizeVersion(attempt.targetVersion) === normalizeVersion(app.getVersion())) {
      appendUpdaterLog('INFO', `Update completed: ${attempt.fromVersion} -> ${attempt.targetVersion}`)
      return null
    }

    const error =
      `The previous update to ${attempt.targetVersion} did not finish. ` +
      `DevFlow is still running ${app.getVersion()}. Try again or run the latest Setup installer manually.`
    appendUpdaterLog('ERROR', error)
    return {
      phase: 'error',
      percent: 0,
      message: 'Previous update did not complete',
      version: attempt.targetVersion,
      error,
    }
  } catch (error) {
    try {
      fs.unlinkSync(marker)
    } catch {
      // Best-effort cleanup of a corrupt marker.
    }
    appendUpdaterLog('WARN', `Could not read install attempt marker: ${errorMessage(error)}`)
    return null
  }
}

function configureUpdater() {
  if (updaterConfigured) return
  updaterConfigured = true

  autoUpdater.logger = updaterLogger
  autoUpdater.autoDownload = false
  // Installation only happens after the user presses Install (or for an
  // explicitly mandatory update). A normal app quit must never install.
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.autoRunAppAfterInstall = true
  autoUpdater.allowDowngrade = false
  autoUpdater.disableWebInstaller = true

  autoUpdater.on('update-available', (info) => {
    updaterInfo = info
    appendUpdaterLog('INFO', `Update metadata available for ${info.version}`)
  })

  autoUpdater.on('download-progress', (progress) => {
    lastDownloadProgress = progress
    emit({
      phase: 'downloading',
      percent: Math.max(0, Math.min(100, Math.round(progress.percent || 0))),
      message: 'Downloading verified installer…',
      version: pendingUpdate?.version ?? updaterInfo?.version,
      bytesReceived: progress.transferred,
      bytesTotal: progress.total,
      bytesPerSec: progress.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    updateActive = false
    downloadCancellation = null
    updaterInfo = info
    readyToInstall = true
    emit({
      phase: 'ready',
      percent: 100,
      message: 'Installer verified and ready',
      version: pendingUpdate?.version ?? info.version,
      bytesReceived: lastDownloadProgress?.total,
      bytesTotal: lastDownloadProgress?.total,
    })
  })

  autoUpdater.on('update-cancelled', () => {
    updateActive = false
    downloadCancellation = null
  })

  autoUpdater.on('error', (error) => {
    appendUpdaterLog('ERROR', error.stack || error.message)
    if (abortReason) return
    updateActive = false
    downloadCancellation = null
    readyToInstall = false
    emit({
      phase: 'error',
      percent: 0,
      message: 'Update failed',
      version: pendingUpdate?.version ?? updaterInfo?.version,
      error: error.message,
    })
  })
}

export function setUpdateProgressHandler(handler: ((progress: UpdateProgress) => void) | null) {
  onProgress = handler
  configureUpdater()
}

export function getPendingUpdate() {
  return pendingUpdate
}

export function isUpdateActive() {
  return updateActive || readyToInstall
}

export function isRequiredUpdateActive() {
  return (updateActive || readyToInstall) && activeUpdateRequired
}

export function isQuittingForUpdate() {
  return quittingForUpdate
}

/** Portable builds are immutable folders by design; only Setup installs auto-update. */
export function isAutomaticUpdateSupported() {
  return !fs.existsSync(path.join(process.resourcesPath, 'portable-build'))
}

/**
 * Resolve policy (required flag/release notes) through DevTune, then resolve the
 * actual NSIS artifact and SHA-512 metadata through electron-updater's GitHub
 * provider. The two sources must agree on the target version.
 */
export async function fetchLatestUpdate() {
  if (!app.isPackaged) {
    return { ok: false as const, error: 'Updates are only available in the packaged app.', result: null }
  }
  if (!isAutomaticUpdateSupported()) {
    return {
      ok: false as const,
      error: 'Automatic updates require the Setup edition. Replace this portable folder manually.',
      result: null,
    }
  }
  configureUpdater()

  const previousFailure = consumePreviousInstallAttempt()
  if (previousFailure) {
    emit(previousFailure)
    return { ok: false as const, error: previousFailure.error, result: null }
  }

  const result = await checkForUpdates(getLicenseState().serverUrl)
  if (!result.ok || !result.updateAvailable || !result.latest?.version) {
    return { ok: false as const, error: result.error ?? 'No update available', result }
  }

  const channel = getUpdateChannel()
  autoUpdater.channel = channel === 'beta' ? 'beta' : 'latest'
  autoUpdater.allowPrerelease = channel === 'beta'
  // Setting channel enables downgrades internally; this app never permits them.
  autoUpdater.allowDowngrade = false

  try {
    const resolved = await autoUpdater.checkForUpdates()
    if (!resolved?.isUpdateAvailable) {
      throw new Error(`GitHub does not advertise an installable update for ${result.latest.version}.`)
    }
    if (normalizeVersion(resolved.updateInfo.version) !== normalizeVersion(result.latest.version)) {
      throw new Error(
        `Release metadata mismatch: DevTune reports ${result.latest.version}, ` +
          `but GitHub advertises ${resolved.updateInfo.version}.`,
      )
    }

    updaterInfo = resolved.updateInfo
    pendingUpdate = {
      version: result.latest.version,
      required: !!result.required,
      releaseNotes: result.latest.releaseNotes,
    }
    readyToInstall = false
    return { ok: true as const, result, pending: pendingUpdate }
  } catch (error) {
    const message = errorMessage(error)
    appendUpdaterLog('ERROR', `Update metadata check failed: ${message}`)
    return { ok: false as const, error: message, result }
  }
}

async function downloadPendingUpdate() {
  const info = pendingUpdate!
  updateActive = true
  readyToInstall = false
  abortReason = null
  lastDownloadProgress = null
  downloadCancellation = new CancellationToken()

  emit({
    phase: 'downloading',
    percent: 0,
    message: 'Starting installer download…',
    version: info.version,
  })

  try {
    await autoUpdater.downloadUpdate(downloadCancellation)
    // `update-downloaded` normally owns this transition. Keep a guarded
    // fallback for providers that resolve the promise before dispatching it.
    if (!readyToInstall) {
      updateActive = false
      downloadCancellation = null
      readyToInstall = true
      emit({ phase: 'ready', percent: 100, message: 'Installer verified and ready', version: info.version })
    }
    return { ok: true }
  } catch (error) {
    updateActive = false
    downloadCancellation = null
    const reason = abortReason
    abortReason = null

    if (reason === 'pause') {
      const progress = getLastDownloadProgress()
      emit({
        phase: 'paused',
        percent: Math.max(0, Math.min(100, Math.round(progress?.percent ?? 0))),
        message: 'Update paused',
        version: info.version,
        bytesReceived: progress?.transferred,
        bytesTotal: progress?.total,
      })
      return { ok: false, error: 'paused' }
    }

    if (reason === 'cancel') {
      pendingUpdate = null
      activeUpdateRequired = false
      readyToInstall = false
      emit({ phase: 'cancelled', percent: 0, message: 'Update cancelled', version: info.version })
      return { ok: false, error: 'Update cancelled' }
    }

    readyToInstall = false
    const message = errorMessage(error)
    emit({ phase: 'error', percent: 0, message: 'Update failed', error: message, version: info.version })
    return { ok: false, error: message }
  }
}

export async function startUpdate(version?: string, required?: boolean) {
  if (!app.isPackaged) {
    const error = 'Updates are only available in the packaged app.'
    emit({ phase: 'error', percent: 0, message: 'Update failed', error })
    return { ok: false, error }
  }
  if (updateActive) return { ok: false, error: 'Update already in progress' }
  if (readyToInstall && pendingUpdate) {
    emit({ phase: 'ready', percent: 100, message: 'Installer verified and ready', version: pendingUpdate.version })
    return { ok: true }
  }

  if (!pendingUpdate || !updaterInfo) {
    const fetched = await fetchLatestUpdate()
    if (!fetched.ok || !fetched.pending) {
      const error = fetched.error ?? 'No update available'
      emit({ phase: 'error', percent: 0, message: 'Update failed', error })
      return { ok: false, error }
    }
  }

  if (version && normalizeVersion(pendingUpdate!.version) !== normalizeVersion(version)) {
    const error = `Update version mismatch: expected ${version}, got ${pendingUpdate!.version}.`
    emit({ phase: 'error', percent: 0, message: 'Update failed', error, version: pendingUpdate!.version })
    return { ok: false, error }
  }

  activeUpdateRequired = required ?? pendingUpdate!.required
  return downloadPendingUpdate()
}

/** electron-updater safely cancels the request; resume reuses its verified cache when possible. */
export function pauseUpdate(): { ok: boolean; error?: string } {
  if (!updateActive || !downloadCancellation) return { ok: false, error: 'No active download' }
  abortReason = 'pause'
  downloadCancellation.cancel()
  return { ok: true }
}

export async function resumeUpdate() {
  if (!app.isPackaged) return { ok: false, error: 'Updates are only available in the packaged app.' }
  if (updateActive) return { ok: false, error: 'Update already in progress' }
  if (!pendingUpdate || !updaterInfo) return { ok: false, error: 'Nothing to resume' }
  return downloadPendingUpdate()
}

export function cancelUpdate(): { ok: boolean; error?: string } {
  if (updateActive && downloadCancellation) {
    abortReason = 'cancel'
    downloadCancellation.cancel()
    return { ok: true }
  }

  pendingUpdate = null
  updaterInfo = null
  readyToInstall = false
  activeUpdateRequired = false
  abortReason = null
  emit({ phase: 'cancelled', percent: 0, message: 'Update cancelled' })
  return { ok: true }
}

/** Stop managed child processes, then let NSIS replace and relaunch the app. */
export async function installPendingUpdate(): Promise<{ ok: boolean; error?: string }> {
  if (!app.isPackaged) return { ok: false, error: 'Updates are only available in the packaged app.' }
  if (!readyToInstall || !pendingUpdate) return { ok: false, error: 'No update is ready to install' }

  const version = pendingUpdate.version
  emit({ phase: 'applying', percent: 100, message: 'Preparing installation…', version })

  try {
    await stopAll()
    writeInstallAttempt(version)
    quittingForUpdate = true
    emit({ phase: 'restarting', percent: 100, message: 'Installing and restarting DevFlow…', version })
    appendUpdaterLog('INFO', `Launching NSIS updater for ${app.getVersion()} -> ${version}`)
    // Silent one-click NSIS update, then force-run the newly installed version.
    autoUpdater.quitAndInstall(true, true)
    return { ok: true }
  } catch (error) {
    quittingForUpdate = false
    try {
      fs.unlinkSync(installAttemptPath())
    } catch {
      // Marker may not have been created yet.
    }
    const message = errorMessage(error)
    appendUpdaterLog('ERROR', `Could not start installer: ${message}`)
    emit({ phase: 'error', percent: 0, message: 'Could not start installer', error: message, version })
    return { ok: false, error: message }
  }
}

export function resetUpdateState() {
  if (downloadCancellation) downloadCancellation.cancel()
  pendingUpdate = null
  updaterInfo = null
  downloadCancellation = null
  abortReason = null
  updateActive = false
  activeUpdateRequired = false
  readyToInstall = false
  lastDownloadProgress = null
}
