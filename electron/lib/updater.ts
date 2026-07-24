import { app } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { checkForUpdates } from './updates'
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
  /** Download progress detail (downloading phase only). */
  bytesReceived?: number
  bytesTotal?: number
  bytesPerSec?: number
}

let pendingUpdate: { version: string; downloadUrl: string; checksum: string | null } | null = null
let onProgress: ((p: UpdateProgress) => void) | null = null
let downloadAbort: AbortController | null = null
let updateActive = false // a download is in flight right now
let activeUpdateRequired = false
let readyToInstall = false // downloaded + verified, waiting for the user to install
let currentZipPath: string | null = null // partial/complete download on disk
let currentTotalBytes = 0 // total download size, retained across pause/resume
let abortReason: 'pause' | 'cancel' | null = null

export function setUpdateProgressHandler(fn: ((p: UpdateProgress) => void) | null) {
  onProgress = fn
}

function emit(p: UpdateProgress) {
  onProgress?.(p)
}

export function getInstallDir(): string {
  return path.dirname(process.execPath)
}

export function getPendingUpdate() {
  return pendingUpdate
}

export function setPendingUpdate(info: typeof pendingUpdate) {
  pendingUpdate = info
}

export function isUpdateActive() {
  return updateActive || readyToInstall
}

/** Whether a required update is downloading or waiting to be installed — used to
 * block the window from closing mid-update instead of silently abandoning a
 * mandatory update. */
export function isRequiredUpdateActive() {
  return (updateActive || readyToInstall) && activeUpdateRequired
}

export async function fetchLatestUpdate() {
  if (!app.isPackaged) {
    return { ok: false as const, error: 'Updates are only available in the packaged app.', result: null }
  }
  const res = await checkForUpdates(getLicenseState().serverUrl)
  if (!res.ok || !res.updateAvailable || !res.latest?.downloadUrl) {
    return { ok: false as const, error: res.error ?? 'No update available', result: res }
  }
  const downloadUrl = res.latest.downloadUrl
  if (!/^https?:\/\//i.test(downloadUrl) || !/\.zip(\?|$)/i.test(downloadUrl)) {
    return {
      ok: false as const,
      error: 'Invalid update URL from server — expected a GitHub zip release.',
      result: res,
    }
  }
  pendingUpdate = {
    version: res.latest.version,
    downloadUrl,
    checksum: res.latest.checksum ?? null,
  }
  return { ok: true as const, result: res, pending: pendingUpdate }
}

interface DownloadTick {
  percent: number
  indeterminate: boolean
  received: number
  total: number
  bytesPerSec: number
}

/**
 * Download `url` to `dest`, resuming from `startByte` when > 0 via an HTTP Range
 * request (append to the existing partial file). If the server ignores the
 * Range (responds 200 instead of 206) it falls back to a full download that
 * overwrites the file. Returns the final total size.
 */
async function downloadUpdate(
  url: string,
  dest: string,
  signal: AbortSignal,
  onTick: (t: DownloadTick) => void,
  startByte = 0,
  knownTotal = 0,
): Promise<{ total: number }> {
  const headers: Record<string, string> = {}
  if (startByte > 0) headers.Range = `bytes=${startByte}-`
  const res = await fetch(url, { signal, headers })
  if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status})`)

  let append = false
  let total = knownTotal
  if (startByte > 0 && res.status === 206) {
    // Partial content — resume: append and read the true total from Content-Range.
    append = true
    const cr = res.headers.get('content-range')
    const m = cr ? /\/(\d+)\s*$/.exec(cr) : null
    if (m) total = Number(m[1])
    else if (!total) total = startByte + Number(res.headers.get('content-length') ?? 0)
  } else {
    // Fresh download (or server ignored Range) — overwrite from the start.
    startByte = 0
    total = Number(res.headers.get('content-length') ?? 0)
  }

  const indeterminate = total <= 0
  let received = startByte
  // Throttle UI updates to ~5/s and derive speed from the delta between ticks.
  let lastEmitAt = Date.now()
  let lastEmitBytes = received
  const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream)

  await pipeline(
    nodeStream,
    async function* (source) {
      for await (const chunk of source) {
        if (signal.aborted) throw new Error('Download aborted')
        received += chunk.length
        const now = Date.now()
        if (now - lastEmitAt >= 200) {
          const secs = (now - lastEmitAt) / 1000
          const bytesPerSec = secs > 0 ? Math.round((received - lastEmitBytes) / secs) : 0
          onTick({
            percent: total > 0 ? Math.min(99, Math.round((received / total) * 100)) : 0,
            indeterminate,
            received,
            total,
            bytesPerSec,
          })
          lastEmitAt = now
          lastEmitBytes = received
        }
        yield chunk
      }
    },
    fs.createWriteStream(dest, append ? { flags: 'a' } : {}),
  )
  onTick({ percent: 100, indeterminate: false, received, total: total || received, bytesPerSec: 0 })
  return { total: total || received }
}

async function verifyChecksum(file: string, expected: string) {
  const hash = crypto.createHash('sha256')
  const data = fs.readFileSync(file)
  hash.update(data)
  const got = hash.digest('hex').toLowerCase()
  if (got !== expected.toLowerCase().replace(/^sha256:/i, '')) {
    throw new Error('Checksum mismatch — update file may be corrupted.')
  }
}

/** DevFlow Manager.app/Contents/MacOS/DevFlow Manager -> DevFlow Manager.app */
function getAppBundlePath(): string {
  return path.resolve(path.dirname(process.execPath), '..', '..')
}

function spawnApplyScriptDarwin(zipPath: string) {
  const bundlePath = getAppBundlePath()
  const logPath = path.join(os.tmpdir(), 'devflow-update.log')
  const scriptPath = path.join(os.tmpdir(), `devflow-apply-${Date.now()}.sh`)
  const pid = process.pid

  const esc = (s: string) => s.replace(/'/g, "'\\''")

  const script = `#!/bin/bash
LOG='${esc(logPath)}'
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $1" >> "$LOG"; }

log "=== DevFlow update apply started ==="
ZIP='${esc(zipPath)}'
BUNDLE='${esc(bundlePath)}'
PARENT_PID=${pid}
STAGING="$(mktemp -d "\${TMPDIR:-/tmp}/devflow-update-staging.XXXXXX")"

log "zip=$ZIP bundle=$BUNDLE parentPid=$PARENT_PID staging=$STAGING"

for i in $(seq 1 120); do
  kill -0 "$PARENT_PID" 2>/dev/null || break
  sleep 0.5
done
kill -0 "$PARENT_PID" 2>/dev/null && log "WARN parent process $PARENT_PID still running after wait"

ditto -x -k "$ZIP" "$STAGING"
if [ $? -ne 0 ]; then
  log "ERROR failed to expand archive"
  exit 1
fi
log "Expanded archive to staging"

NEW_APP="$(find "$STAGING" -maxdepth 1 -name '*.app' | head -n 1)"
if [ -z "$NEW_APP" ]; then
  log "ERROR no .app bundle found in staging"
  exit 1
fi

rsync -a --delete "$NEW_APP/" "$BUNDLE/"
if [ $? -ne 0 ]; then
  log "ERROR rsync into $BUNDLE failed"
  exit 1
fi
log "Synced new bundle into $BUNDLE"

xattr -dr com.apple.quarantine "$BUNDLE" 2>/dev/null
chmod +x "$BUNDLE/Contents/MacOS/"* 2>/dev/null

log "Relaunching $BUNDLE"
open "$BUNDLE"

rm -rf "$ZIP" "$STAGING" "$0"
log "=== DevFlow update apply finished ==="
`
  fs.writeFileSync(scriptPath, script, { mode: 0o755 })
  fs.appendFileSync(logPath, `\n--- apply script ${new Date().toISOString()} ---\n`, 'utf-8')

  const child = spawn('/bin/bash', [scriptPath], { detached: true, stdio: 'ignore' })
  child.unref()
}

function spawnApplyScript(zipPath: string, installDir: string, exeName: string) {
  if (process.platform === 'darwin') {
    spawnApplyScriptDarwin(zipPath)
    return
  }

  const logPath = path.join(os.tmpdir(), 'devflow-update.log')
  const scriptPath = path.join(os.tmpdir(), `devflow-apply-${Date.now()}.ps1`)
  const pid = process.pid
  const processBaseName = exeName.replace(/\.exe$/i, '')

  const script = `# DevFlow auto-update apply script
$ErrorActionPreference = 'Stop'
$log = '${logPath.replace(/'/g, "''")}'
function Log([string]$msg) { Add-Content -Path $log -Value ("$(Get-Date -Format o) " + $msg) }

Log "=== DevFlow update apply started ==="
$zip = '${zipPath.replace(/'/g, "''")}'
$dest = '${installDir.replace(/'/g, "''")}'
$exe = '${exeName.replace(/'/g, "''")}'
$parentPid = ${pid}
$staging = Join-Path $env:TEMP "devflow-update-staging"

Log "zip=$zip dest=$dest exe=$exe parentPid=$parentPid"

for ($i = 0; $i -lt 120; $i++) {
  if (-not (Get-Process -Id $parentPid -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Milliseconds 500
}
if (Get-Process -Id $parentPid -ErrorAction SilentlyContinue) {
  Log "WARN parent process $parentPid still running after wait"
}

# Stop every process still running from the install dir so no file stays locked
# (the app's own children, and node-pty helpers under resources\\...). A leftover
# lock is the usual reason the mirror below fails and the app never relaunches.
Get-Process -Name '${processBaseName.replace(/'/g, "''")}' -ErrorAction SilentlyContinue |
  Where-Object { $_.Id -ne $PID } |
  ForEach-Object { Log "Stopping instance PID $($_.Id)"; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.Id -ne $PID -and $(try { $_.Path -and $_.Path.StartsWith($dest, [System.StringComparison]::OrdinalIgnoreCase) } catch { $false }) } |
  ForEach-Object { Log "Stopping install-dir process $($_.Id) ($($_.ProcessName))"; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 1500

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $staging -Force | Out-Null
Expand-Archive -Path $zip -DestinationPath $staging -Force
Log "Expanded archive to staging"

$inner = Get-ChildItem $staging
if ($inner.Count -eq 1 -and $inner[0].PSIsContainer) { $staging = $inner[0].FullName }

# Mirror with retries — a lingering file lock is the usual transient failure.
$rc = 16
for ($attempt = 1; $attempt -le 3; $attempt++) {
  robocopy $staging $dest /MIR /R:5 /W:3 /NFL /NDL /NJH /NJS /NC /NS /NP 2>&1 | Out-File -Append -FilePath $log -Encoding utf8
  $rc = $LASTEXITCODE
  Log "robocopy attempt $attempt exit code $rc"
  if ($rc -lt 8) { break }
  Start-Sleep -Seconds 2
}
if ($rc -ge 8) {
  Log "ERROR robocopy failed after retries with code $rc"
  exit 1
}

# Relaunch the freshly-installed app so the user always lands back in DevFlow.
$exePath = Join-Path $dest $exe
Log "Starting $exePath"
try {
  Start-Process -FilePath $exePath -WorkingDirectory $dest
  Log "Relaunch issued"
} catch {
  Log "ERROR relaunch failed: $($_.Exception.Message)"
}
Remove-Item $zip -Force -ErrorAction SilentlyContinue
Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $PSCommandPath -Force -ErrorAction SilentlyContinue
Log "=== DevFlow update apply finished ==="
`
  fs.writeFileSync(scriptPath, script, 'utf-8')
  fs.appendFileSync(logPath, `\n--- apply script ${new Date().toISOString()} ---\n`, 'utf-8')

  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptPath],
    { detached: true, stdio: 'ignore', windowsHide: true },
  )
  child.unref()
}

function cleanupDownload() {
  if (currentZipPath) {
    try {
      fs.unlinkSync(currentZipPath)
    } catch {
      /* ignore */
    }
  }
  currentZipPath = null
  currentTotalBytes = 0
  readyToInstall = false
}

/**
 * Download (or resume) the pending update and verify it, then stop at the
 * `ready` phase — the actual install is a separate, user-confirmed step
 * (installPendingUpdate). Pausing keeps the partial file for a later resume;
 * cancelling deletes it.
 */
async function runDownloadAndVerify(resume: boolean) {
  const info = pendingUpdate!
  const zipPath = currentZipPath!

  updateActive = true
  abortReason = null
  downloadAbort = new AbortController()

  let startByte = 0
  if (resume) {
    try {
      startByte = fs.statSync(zipPath).size
    } catch {
      startByte = 0
    }
  }

  try {
    emit({
      phase: 'downloading',
      percent: startByte && currentTotalBytes ? Math.round((startByte / currentTotalBytes) * 100) : 0,
      message: 'Downloading update…',
      version: info.version,
      bytesReceived: startByte,
      bytesTotal: currentTotalBytes || undefined,
    })
    const { total } = await downloadUpdate(
      info.downloadUrl,
      zipPath,
      downloadAbort.signal,
      (t) => {
        currentTotalBytes = t.total || currentTotalBytes
        emit({
          phase: 'downloading',
          percent: t.indeterminate ? 0 : t.percent,
          message: 'Downloading update…',
          version: info.version,
          bytesReceived: t.received,
          bytesTotal: t.total || undefined,
          bytesPerSec: t.bytesPerSec,
        })
      },
      startByte,
      currentTotalBytes,
    )
    currentTotalBytes = total || currentTotalBytes
    downloadAbort = null

    if (!info.checksum) {
      throw new Error('Update rejected: server did not provide a SHA-256 checksum.')
    }
    emit({ phase: 'verifying', percent: 100, message: 'Verifying update…', version: info.version })
    await verifyChecksum(zipPath, info.checksum)

    updateActive = false
    readyToInstall = true
    emit({
      phase: 'ready',
      percent: 100,
      message: 'Update ready to install',
      version: info.version,
      bytesReceived: currentTotalBytes || undefined,
      bytesTotal: currentTotalBytes || undefined,
    })
    return { ok: true }
  } catch (err) {
    downloadAbort = null
    updateActive = false
    const aborted =
      err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message))

    if (aborted && abortReason === 'pause') {
      let received = 0
      try {
        received = fs.statSync(zipPath).size
      } catch {
        /* ignore */
      }
      emit({
        phase: 'paused',
        percent: currentTotalBytes ? Math.round((received / currentTotalBytes) * 100) : 0,
        message: 'Update paused',
        version: info.version,
        bytesReceived: received,
        bytesTotal: currentTotalBytes || undefined,
      })
      return { ok: false, error: 'paused' }
    }

    if (aborted) {
      cleanupDownload()
      activeUpdateRequired = false
      emit({ phase: 'cancelled', percent: 0, message: 'Update cancelled', version: info.version })
      return { ok: false, error: 'Update cancelled' }
    }

    cleanupDownload()
    const error = err instanceof Error ? err.message : String(err)
    emit({ phase: 'error', percent: 0, message: 'Update failed', error, version: info.version })
    return { ok: false, error }
  }
}

/** Begin (or restart) a download of the pending update. */
export async function startUpdate(version?: string, required?: boolean) {
  if (!app.isPackaged) {
    const err = 'Updates are only available in the packaged app.'
    emit({ phase: 'error', percent: 0, message: 'Update failed', error: err })
    return { ok: false, error: err }
  }
  if (updateActive) return { ok: false, error: 'Update already in progress' }

  // Already downloaded and verified — just re-announce the ready state.
  if (readyToInstall && pendingUpdate) {
    emit({ phase: 'ready', percent: 100, message: 'Update ready to install', version: pendingUpdate.version })
    return { ok: true }
  }

  if (!pendingUpdate) {
    const fetched = await fetchLatestUpdate()
    if (!fetched.ok || !fetched.pending) {
      emit({ phase: 'error', percent: 0, message: 'No update', error: fetched.error })
      return { ok: false, error: fetched.error ?? 'No update available' }
    }
  }

  const info = pendingUpdate!
  if (version && info.version !== version) {
    const err = 'Update version mismatch'
    emit({ phase: 'error', percent: 0, message: 'Update failed', error: err, version: info.version })
    return { ok: false, error: err }
  }

  activeUpdateRequired = !!required
  currentZipPath = path.join(os.tmpdir(), `devflow-update-${info.version}.zip`)
  currentTotalBytes = 0
  readyToInstall = false
  // Fresh start — drop any stale partial from a previous attempt.
  try {
    fs.unlinkSync(currentZipPath)
  } catch {
    /* ignore */
  }
  return runDownloadAndVerify(false)
}

/** Resume a paused download from where it left off. */
export async function resumeUpdate() {
  if (!app.isPackaged) return { ok: false, error: 'Updates are only available in the packaged app.' }
  if (updateActive) return { ok: false, error: 'Update already in progress' }
  if (!pendingUpdate || !currentZipPath) return { ok: false, error: 'Nothing to resume' }
  return runDownloadAndVerify(true)
}

/** Pause the in-flight download, keeping the partial file for a later resume. */
export function pauseUpdate(): { ok: boolean; error?: string } {
  if (!updateActive || !downloadAbort) return { ok: false, error: 'No active download' }
  abortReason = 'pause'
  downloadAbort.abort()
  downloadAbort = null
  return { ok: true }
}

/** Cancel the update entirely (works while downloading, paused, or ready). */
export function cancelUpdate(): { ok: boolean; error?: string } {
  if (updateActive && downloadAbort) {
    // The runDownloadAndVerify catch handles cleanup + the 'cancelled' emit.
    abortReason = 'cancel'
    downloadAbort.abort()
    downloadAbort = null
    return { ok: true }
  }
  // Paused or ready: no in-flight request, so tear down directly.
  cleanupDownload()
  updateActive = false
  activeUpdateRequired = false
  emit({ phase: 'cancelled', percent: 0, message: 'Update cancelled' })
  return { ok: true }
}

/** Apply the already-downloaded update: stop projects, launch the apply script,
 * and quit so the script can replace files and relaunch. */
export async function installPendingUpdate(): Promise<{ ok: boolean; error?: string }> {
  if (!app.isPackaged) return { ok: false, error: 'Updates are only available in the packaged app.' }
  if (!readyToInstall || !currentZipPath || !pendingUpdate) {
    return { ok: false, error: 'No update is ready to install' }
  }
  const installDir = getInstallDir()
  const exeName = path.basename(process.execPath)
  const version = pendingUpdate.version

  emit({ phase: 'applying', percent: 100, message: 'Applying update…', version })
  spawnApplyScript(currentZipPath, installDir, exeName)

  emit({ phase: 'restarting', percent: 100, message: 'Restarting DevFlow…', version })
  pendingUpdate = null
  readyToInstall = false

  quittingForUpdate = true
  await stopAll()
  setTimeout(() => app.quit(), 400)
  return { ok: true }
}

/** Set by updater before quit so before-quit handlers skip tray hide. */
let quittingForUpdate = false
export function isQuittingForUpdate() {
  return quittingForUpdate
}

export function resetUpdateState() {
  updateActive = false
  readyToInstall = false
  activeUpdateRequired = false
  abortReason = null
  downloadAbort = null
  cleanupDownload()
}
