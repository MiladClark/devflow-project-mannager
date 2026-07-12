import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Runs electron-builder in a separate Node process (spawned via the app's own
 * Electron binary with ELECTRON_RUN_AS_NODE=1) instead of requiring it in the main
 * process — matches this codebase's convention of never doing heavy/blocking work
 * in-process (see electron/ipc/scaffold.ts), and avoids freezing the whole UI during
 * a multi-minute asar-pack + compression run.
 */
const WORKER_SOURCE = `
const fs = require('fs')
const [, , builderEntryPath, configPath] = process.argv
try {
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  const { build } = require(builderEntryPath)
  build({ projectDir: raw.projectDir, config: raw.config })
    .then((files) => {
      console.log('[electron-builder] produced: ' + JSON.stringify(files))
      process.exit(0)
    })
    .catch((err) => {
      console.error('[electron-builder] failed: ' + (err && err.stack ? err.stack : String(err)))
      process.exit(1)
    })
} catch (err) {
  console.error('[electron-builder] fatal: ' + (err && err.stack ? err.stack : String(err)))
  process.exit(1)
}
`

export interface ElectronBuilderJob {
  projectDir: string
  config: Record<string, unknown>
}

export interface WorkerHandle {
  promise: Promise<number>
  child: ChildProcess
}

/** Resolves electron-builder's own package entry from DevFlow's node_modules (not the target project's). */
function resolveBuilderEntry(): string {
  return require.resolve('electron-builder')
}

export function startElectronBuilderWorker(
  job: ElectronBuilderJob,
  onLine: (text: string, stream: 'out' | 'err') => void,
): WorkerHandle {
  const tmpDir = app.getPath('temp')
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const workerPath = path.join(tmpDir, `devflow-eb-worker-${runId}.cjs`)
  const configPath = path.join(tmpDir, `devflow-eb-config-${runId}.json`)
  fs.writeFileSync(workerPath, WORKER_SOURCE, 'utf-8')
  fs.writeFileSync(configPath, JSON.stringify(job), 'utf-8')

  const builderEntry = resolveBuilderEntry()
  const child = spawn(process.execPath, [workerPath, builderEntry, configPath], {
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NO_COLOR: '1', FORCE_COLOR: '0', CI: 'true' },
  })

  const cleanup = () => {
    try {
      fs.rmSync(workerPath, { force: true })
      fs.rmSync(configPath, { force: true })
    } catch {
      /* best-effort temp cleanup */
    }
  }

  child.stdout?.on('data', (c: Buffer) => onLine(c.toString().trimEnd(), 'out'))
  child.stderr?.on('data', (c: Buffer) => onLine(c.toString().trimEnd(), 'err'))

  const promise = new Promise<number>((resolve) => {
    child.on('error', (err) => {
      onLine(String(err), 'err')
      cleanup()
      resolve(1)
    })
    child.on('exit', (code) => {
      cleanup()
      resolve(code ?? 1)
    })
  })

  return { promise, child }
}
