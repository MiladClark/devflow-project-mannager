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

export type UpdatePhase = 'idle' | 'downloading' | 'verifying' | 'applying' | 'restarting' | 'error'

export interface UpdateProgress {
  phase: UpdatePhase
  percent: number
  message: string
  version?: string
  error?: string
}

let pendingUpdate: { version: string; downloadUrl: string; checksum: string | null } | null = null
let onProgress: ((p: UpdateProgress) => void) | null = null

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

export async function fetchLatestUpdate() {
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

async function downloadUpdate(url: string, dest: string, onPct: (n: number) => void) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30 * 60 * 1000) })
  if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status})`)

  const total = Number(res.headers.get('content-length') ?? 0)
  let received = 0
  const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream)

  await pipeline(
    nodeStream,
    async function* (source) {
      for await (const chunk of source) {
        received += chunk.length
        if (total > 0) onPct(Math.min(99, Math.round((received / total) * 100)))
        yield chunk
      }
    },
    fs.createWriteStream(dest),
  )
  onPct(100)
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

function spawnApplyScript(zipPath: string, installDir: string, exeName: string) {
  const scriptPath = path.join(os.tmpdir(), `devflow-apply-${Date.now()}.ps1`)
  const pid = process.pid
  const script = `# DevFlow auto-update apply script
$ErrorActionPreference = 'Stop'
$zip = '${zipPath.replace(/'/g, "''")}'
$dest = '${installDir.replace(/'/g, "''")}'
$exe = '${exeName.replace(/'/g, "''")}'
$pid = ${pid}
$staging = Join-Path $env:TEMP "devflow-update-staging"

# Wait for app to exit
for ($i = 0; $i -lt 120; $i++) {
  if (-not (Get-Process -Id $pid -ErrorAction SilentlyContinue)) { break }
  Start-Sleep -Milliseconds 500
}

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $staging -Force | Out-Null
Expand-Archive -Path $zip -DestinationPath $staging -Force

$inner = Get-ChildItem $staging
if ($inner.Count -eq 1 -and $inner[0].PSIsContainer) { $staging = $inner[0].FullName }

robocopy $staging $dest /MIR /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { exit 1 }

Start-Process -FilePath (Join-Path $dest $exe)
Remove-Item $zip -Force -ErrorAction SilentlyContinue
Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $PSCommandPath -Force -ErrorAction SilentlyContinue
`
  fs.writeFileSync(scriptPath, script, 'utf-8')

  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', scriptPath],
    { detached: true, stdio: 'ignore', windowsHide: true },
  )
  child.unref()
}

export async function startUpdate(version?: string) {
  if (!pendingUpdate) {
    const fetched = await fetchLatestUpdate()
    if (!fetched.ok || !fetched.pending) {
      emit({ phase: 'error', percent: 0, message: 'No update', error: fetched.error })
      return { ok: false, error: fetched.error ?? 'No update available' }
    }
  }
  const info = pendingUpdate!
  if (version && info.version !== version) {
    return { ok: false, error: 'Update version mismatch' }
  }

  const zipPath = path.join(os.tmpdir(), `devflow-update-${info.version}.zip`)
  const installDir = getInstallDir()
  const exeName = path.basename(process.execPath)

  try {
    emit({ phase: 'downloading', percent: 0, message: 'Downloading update…', version: info.version })
    await downloadUpdate(info.downloadUrl, zipPath, (percent) => {
      emit({ phase: 'downloading', percent, message: 'Downloading update…', version: info.version })
    })

    if (info.checksum) {
      emit({ phase: 'verifying', percent: 100, message: 'Verifying update…', version: info.version })
      await verifyChecksum(zipPath, info.checksum)
    }

    emit({ phase: 'applying', percent: 100, message: 'Applying update…', version: info.version })
    spawnApplyScript(zipPath, installDir, exeName)

    emit({ phase: 'restarting', percent: 100, message: 'Restarting DevFlow…', version: info.version })
    pendingUpdate = null
    setTimeout(() => app.quit(), 400)
    return { ok: true }
  } catch (err) {
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
