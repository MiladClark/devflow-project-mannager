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

export type UpdatePhase = 'idle' | 'downloading' | 'verifying' | 'applying' | 'restarting' | 'error' | 'cancelled'

export interface UpdateProgress {
  phase: UpdatePhase
  percent: number
  message: string
  version?: string
  error?: string
}

let pendingUpdate: { version: string; downloadUrl: string; checksum: string | null } | null = null
let onProgress: ((p: UpdateProgress) => void) | null = null
let downloadAbort: AbortController | null = null
let updateActive = false
let activeUpdateRequired = false

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
  return updateActive
}

/** Whether the in-flight update is required — used to block the window from
 * closing mid-update instead of silently abandoning a mandatory update. */
export function isRequiredUpdateActive() {
  return updateActive && activeUpdateRequired
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

async function downloadUpdate(url: string, dest: string, signal: AbortSignal, onPct: (n: number, indeterminate: boolean) => void) {
  const res = await fetch(url, { signal })
  if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status})`)

  const total = Number(res.headers.get('content-length') ?? 0)
  const indeterminate = total <= 0
  let received = 0
  const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream)

  await pipeline(
    nodeStream,
    async function* (source) {
      for await (const chunk of source) {
        if (signal.aborted) throw new Error('Download cancelled')
        received += chunk.length
        if (total > 0) {
          onPct(Math.min(99, Math.round((received / total) * 100)), false)
        } else {
          onPct(0, true)
        }
        yield chunk
      }
    },
    fs.createWriteStream(dest),
  )
  onPct(100, false)
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

Get-Process -Name '${processBaseName.replace(/'/g, "''")}' -ErrorAction SilentlyContinue |
  Where-Object { $_.Id -ne $PID } |
  ForEach-Object { Log "Stopping other instance PID $($_.Id)"; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $staging -Force | Out-Null
Expand-Archive -Path $zip -DestinationPath $staging -Force
Log "Expanded archive to staging"

$inner = Get-ChildItem $staging
if ($inner.Count -eq 1 -and $inner[0].PSIsContainer) { $staging = $inner[0].FullName }

robocopy $staging $dest /MIR /R:3 /W:2 /NFL /NDL /NJH /NJS /NC /NS /NP 2>&1 | Out-File -Append -FilePath $log -Encoding utf8
$rc = $LASTEXITCODE
Log "robocopy exit code $rc"
if ($rc -ge 8) {
  Log "ERROR robocopy failed with code $rc"
  exit 1
}

$exePath = Join-Path $dest $exe
Log "Starting $exePath"
Start-Process -FilePath $exePath
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

export function cancelUpdate(): { ok: boolean; error?: string } {
  if (!updateActive) return { ok: false, error: 'No update in progress' }
  if (downloadAbort) {
    downloadAbort.abort()
    downloadAbort = null
  }
  updateActive = false
  activeUpdateRequired = false
  emit({ phase: 'cancelled', percent: 0, message: 'Update cancelled' })
  return { ok: true }
}

export async function startUpdate(version?: string, required?: boolean) {
  if (!app.isPackaged) {
    const err = 'Updates are only available in the packaged app.'
    emit({ phase: 'error', percent: 0, message: 'Update failed', error: err })
    return { ok: false, error: err }
  }

  if (updateActive) {
    return { ok: false, error: 'Update already in progress' }
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

  const zipPath = path.join(os.tmpdir(), `devflow-update-${info.version}.zip`)
  const installDir = getInstallDir()
  const exeName = path.basename(process.execPath)

  updateActive = true
  activeUpdateRequired = !!required
  downloadAbort = new AbortController()

  try {
    emit({ phase: 'downloading', percent: 0, message: 'Downloading update…', version: info.version })
    await downloadUpdate(info.downloadUrl, zipPath, downloadAbort.signal, (percent, indeterminate) => {
      emit({
        phase: 'downloading',
        percent: indeterminate ? 0 : percent,
        message: indeterminate ? 'Downloading update…' : 'Downloading update…',
        version: info.version,
      })
    })
    downloadAbort = null

    if (!info.checksum) {
      throw new Error('Update rejected: server did not provide a SHA-256 checksum.')
    }
    emit({ phase: 'verifying', percent: 100, message: 'Verifying update…', version: info.version })
    await verifyChecksum(zipPath, info.checksum)

    emit({ phase: 'applying', percent: 100, message: 'Applying update…', version: info.version })
    spawnApplyScript(zipPath, installDir, exeName)

    emit({ phase: 'restarting', percent: 100, message: 'Restarting DevFlow…', version: info.version })
    pendingUpdate = null

    quittingForUpdate = true
    await stopAll()
    setTimeout(() => app.quit(), 400)
    return { ok: true }
  } catch (err) {
    downloadAbort = null
    updateActive = false
    activeUpdateRequired = false
    if (
      err instanceof Error &&
      (err.name === 'AbortError' || err.message === 'Download cancelled')
    ) {
      emit({ phase: 'cancelled', percent: 0, message: 'Update cancelled', version: info.version })
      try {
        fs.unlinkSync(zipPath)
      } catch {
        /* ignore */
      }
      return { ok: false, error: 'Update cancelled' }
    }
    const error = err instanceof Error ? err.message : String(err)
    emit({ phase: 'error', percent: 0, message: 'Update failed', error, version: info.version })
    try {
      fs.unlinkSync(zipPath)
    } catch {
      /* ignore */
    }
    return { ok: false, error }
  }
}

/** Set by updater before quit so before-quit handlers skip tray hide. */
let quittingForUpdate = false
export function isQuittingForUpdate() {
  return quittingForUpdate
}

export function resetUpdateState() {
  updateActive = false
  downloadAbort = null
}
