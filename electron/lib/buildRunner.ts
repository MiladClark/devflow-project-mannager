import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type {
  BuildConfig,
  BuildRunState,
  BuildStageId,
  BuildStageState,
  BuildOutputFile,
  BuildPreflightResult,
  BuildPreflightIssue,
  LogLine,
} from '../../src/shared/types'
import { broadcast } from './broadcast'
import { store, newId } from './store'
import { pmInstall, pmRun } from './pkgmanager'
import { sha256File } from './buildChecksum'
import { writeManifestFiles } from './buildManifestGen'
import { applyNamingTemplate, isValidVersion } from './buildVersion'
import { startElectronBuilderWorker } from './buildElectronBuilder'

const STAGE_ORDER: BuildStageId[] = [
  'validating',
  'cleaning',
  'installing',
  'checks',
  'building',
  'packaging',
  'installer',
  'compressing',
  'manifest',
  'finalizing',
]

const STAGE_LABELS: Record<BuildStageId, string> = {
  validating: 'Validating project',
  cleaning: 'Cleaning previous artifacts',
  installing: 'Installing dependencies',
  checks: 'Running checks',
  building: 'Building application',
  packaging: 'Packaging application',
  installer: 'Creating installer',
  compressing: 'Compressing export files',
  manifest: 'Writing build manifest',
  finalizing: 'Finalizing output',
}

interface RunnerState {
  buildId: string
  config: BuildConfig
  stages: BuildStageState[]
  phase: BuildRunState['phase']
  error?: string
  logs: LogLine[]
  outputDir?: string
  files?: BuildOutputFile[]
  manifestPath?: string
  cancelRequested: boolean
  currentChild?: ChildProcess
}

const runs = new Map<string, RunnerState>()
const ARTIFACT_EXT = new Set(['.exe', '.zip', '.msi'])

function toPublicState(state: RunnerState): BuildRunState {
  return {
    buildId: state.buildId,
    projectPath: state.config.projectPath,
    stages: state.stages,
    phase: state.phase,
    error: state.error,
    outputDir: state.outputDir,
    files: state.files,
    manifestPath: state.manifestPath,
  }
}

function broadcastState(state: RunnerState) {
  broadcast('build:state', toPublicState(state))
}

function log(state: RunnerState, text: string, stream: LogLine['stream'] = 'out') {
  const line: LogLine = { ts: Date.now(), stream, text }
  state.logs.push(line)
  if (state.logs.length > 5000) state.logs.splice(0, state.logs.length - 5000)
  broadcast('build:log', state.buildId, line)
}

function setStage(state: RunnerState, id: BuildStageId, patch: Partial<BuildStageState>) {
  const stage = state.stages.find((s) => s.id === id)
  if (!stage) return
  if (patch.status === 'running') stage.startedAt = Date.now()
  Object.assign(stage, patch)
  if (patch.status && patch.status !== 'running' && patch.status !== 'pending' && stage.startedAt) {
    stage.finishedAt = Date.now()
    stage.durationMs = stage.finishedAt - stage.startedAt
  }
  broadcast('build:stage', state.buildId, stage)
  broadcastState(state)
}

function killTree(pid: number) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
  } else {
    try {
      process.kill(-pid)
    } catch {
      /* already exited */
    }
  }
}

function spawnCmd(state: RunnerState, cmd: string, cwd: string): Promise<number> {
  return new Promise((resolve) => {
    if (state.cancelRequested) return resolve(1)
    log(state, `$ ${cmd}`, 'sys')
    const child = spawn(cmd, {
      cwd,
      shell: true,
      windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', CI: 'true' },
    })
    state.currentChild = child
    child.stdout?.on('data', (c: Buffer) => log(state, c.toString().trimEnd()))
    child.stderr?.on('data', (c: Buffer) => log(state, c.toString().trimEnd(), 'err'))
    child.on('error', (err) => {
      log(state, String(err), 'err')
      state.currentChild = undefined
      resolve(1)
    })
    child.on('exit', (code) => {
      state.currentChild = undefined
      resolve(code ?? 1)
    })
  })
}

function readScripts(projectPath: string): Record<string, string> {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'))
    return pkg.scripts ?? {}
  } catch {
    return {}
  }
}

type StageOutcome = 'ok' | 'skip' | 'warn'

async function runStage(
  state: RunnerState,
  id: BuildStageId,
  command: string | undefined,
  fn: () => Promise<StageOutcome>,
): Promise<boolean> {
  if (state.cancelRequested) {
    setStage(state, id, { status: 'skipped' })
    return false
  }
  setStage(state, id, { status: 'running', command })
  try {
    const result = await fn()
    if (state.cancelRequested) {
      setStage(state, id, { status: 'skipped' })
      return false
    }
    setStage(state, id, { status: result === 'skip' ? 'skipped' : result === 'warn' ? 'warning' : 'complete' })
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(state, msg, 'err')
    setStage(state, id, { status: 'failed' })
    state.error = msg
    return false
  }
}

function finish(state: RunnerState, phase: BuildRunState['phase']) {
  state.phase = phase
  broadcastState(state)
}

function windowsTargetName(id: BuildConfig['targets'][number]): string | null {
  if (id === 'win-portable') return 'portable'
  if (id === 'win-nsis') return 'nsis'
  if (id === 'win-zip') return 'zip'
  return null
}

async function runElectronAdapter(state: RunnerState): Promise<boolean> {
  const { config } = state
  const winTargets = config.targets.map(windowsTargetName).filter((t): t is string => !!t)

  const okPack = await runStage(state, 'packaging', 'electron-builder', async () => {
    if (winTargets.length === 0) throw new Error('No Windows build target selected.')
    fs.mkdirSync(state.outputDir!, { recursive: true })
    const builderConfig: Record<string, unknown> = {
      productName: config.appName,
      ...(config.appId ? { appId: config.appId } : {}),
      directories: { output: state.outputDir },
      npmRebuild: false,
      publish: null,
      compression: 'maximum',
      win: {
        target: winTargets,
        ...(config.iconPath ? { icon: config.iconPath } : {}),
      },
      // only synthesize a files whitelist when the project has no electron-builder
      // config of its own — otherwise trust its own files/asar settings entirely
      ...(config.excludedPaths.length > 0
        ? { files: ['**/*', ...config.excludedPaths.flatMap((p) => [`!${p}`, `!${p}/**`])] }
        : {}),
    }
    const { promise } = startElectronBuilderWorker(
      { projectDir: config.projectPath, config: builderConfig },
      (text, stream) => log(state, text, stream === 'err' ? 'err' : 'out'),
    )
    const code = await promise
    if (code !== 0) throw new Error(`electron-builder exited with code ${code}`)
    return 'ok'
  })
  if (!okPack) return false

  setStage(state, 'installer', { status: config.targets.includes('win-nsis') ? 'complete' : 'skipped' })
  setStage(state, 'compressing', { status: 'skipped' })
  return true
}

function shQuote(p: string): string {
  return `'${p.replace(/'/g, "'\\''")}'`
}

function hostPlatformToken(): 'win' | 'mac' | 'linux' {
  return process.platform === 'darwin' ? 'mac' : process.platform === 'linux' ? 'linux' : 'win'
}

async function compressStaticOutput(state: RunnerState, zipPath: string) {
  const { config } = state
  const source = path.join(config.projectPath, config.outputDir)
  if (!fs.existsSync(source)) throw new Error(`Build output directory not found: ${config.outputDir}`)

  let cmd: string
  if (process.platform === 'darwin') {
    // ditto is Apple's recommended zip tool (preserves resource forks/metadata).
    cmd = `ditto -c -k --sequesterRsrc --keepParent ${shQuote(source)} ${shQuote(zipPath)}`
  } else {
    const escSource = source.replace(/'/g, "''")
    const escDest = zipPath.replace(/'/g, "''")
    cmd = `powershell -NoProfile -Command "Compress-Archive -Path '${escSource}\\*' -DestinationPath '${escDest}' -Force"`
  }
  const code = await spawnCmd(state, cmd, config.projectPath)
  if (code !== 0) throw new Error(`Compression failed with exit code ${code}`)
}

async function runStaticAdapter(state: RunnerState): Promise<boolean> {
  setStage(state, 'packaging', { status: 'skipped' })
  setStage(state, 'installer', { status: 'skipped' })

  const okCompress = await runStage(state, 'compressing', undefined, async () => {
    if (!state.config.targets.includes('zip-archive')) return 'skip'
    const name = applyNamingTemplate(state.config.namingTemplate, {
      appName: state.config.appName,
      version: state.config.version,
      platform: hostPlatformToken(),
      arch: process.arch,
    })
    fs.mkdirSync(state.outputDir!, { recursive: true })
    await compressStaticOutput(state, path.join(state.outputDir!, `${name}.zip`))
    return 'ok'
  })
  return okCompress
}

/** Copies the raw build output folder into the export dir (the "Static Build" target). */
function copyStaticFolder(state: RunnerState) {
  const { config } = state
  const source = path.join(config.projectPath, config.outputDir)
  if (!fs.existsSync(source)) throw new Error(`Build output directory not found: ${config.outputDir}`)
  const name = applyNamingTemplate(config.namingTemplate, {
    appName: config.appName,
    version: config.version,
    platform: hostPlatformToken(),
    arch: process.arch,
  })
  const dest = path.join(state.outputDir!, name)
  fs.rmSync(dest, { recursive: true, force: true })
  fs.cpSync(source, dest, { recursive: true })
}

/** Removes electron-builder's incidental non-artifact output (unpacked app dir, blockmaps, effective config). */
function cleanupElectronExtras(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && /^win-(unpacked|ia32-unpacked|arm64-unpacked)$/.test(entry.name)) {
      fs.rmSync(path.join(dir, entry.name), { recursive: true, force: true })
    } else if (entry.isFile() && (entry.name.endsWith('.blockmap') || entry.name === 'builder-effective-config.yaml')) {
      fs.rmSync(path.join(dir, entry.name), { force: true })
    }
  }
}

async function collectArtifacts(dir: string): Promise<BuildOutputFile[]> {
  if (!fs.existsSync(dir)) return []
  const out: BuildOutputFile[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    if (!ARTIFACT_EXT.has(path.extname(entry.name).toLowerCase())) continue
    const full = path.join(dir, entry.name)
    const sizeBytes = fs.statSync(full).size
    const sha256 = await sha256File(full)
    out.push({ name: entry.name, path: full, sizeBytes, sha256 })
  }
  return out
}

async function runPipeline(state: RunnerState) {
  const { config } = state
  state.outputDir = config.exportDir

  const okValidate = await runStage(state, 'validating', undefined, async () => {
    if (!fs.existsSync(config.projectPath)) throw new Error(`Project folder not found: ${config.projectPath}`)
    if (!config.buildCommand) throw new Error('No build command configured.')
    return 'ok'
  })
  if (!okValidate) return finish(state, 'error')

  const okClean = await runStage(state, 'cleaning', undefined, async () => {
    if (!config.cleanOutputDir) return 'skip'
    const abs = path.join(config.projectPath, config.outputDir)
    if (fs.existsSync(abs)) fs.rmSync(abs, { recursive: true, force: true })
    return 'ok'
  })
  if (!okClean) return finish(state, 'error')

  const okInstall = await runStage(state, 'installing', pmInstall(config.packageManager), async () => {
    if (!config.installDepsBeforeBuild) return 'skip'
    const code = await spawnCmd(state, pmInstall(config.packageManager), config.projectPath)
    if (code !== 0) throw new Error(`Dependency install failed with exit code ${code}`)
    return 'ok'
  })
  if (!okInstall) return finish(state, 'error')

  const okChecks = await runStage(state, 'checks', undefined, async () => {
    const scripts = readScripts(config.projectPath)
    const requested: [boolean, string][] = [
      [config.runTypeCheck, 'typecheck'],
      [config.runLint, 'lint'],
      [config.runTests, 'test'],
    ]
    let ran = false
    let warned = false
    for (const [enabled, script] of requested) {
      if (!enabled) continue
      if (!scripts[script]) {
        log(state, `No "${script}" script found in package.json — skipping.`, 'sys')
        warned = true
        continue
      }
      ran = true
      const code = await spawnCmd(state, pmRun(config.packageManager, script), config.projectPath)
      if (code !== 0) throw new Error(`"${script}" failed with exit code ${code}`)
    }
    if (!ran) return warned ? 'warn' : 'skip'
    return warned ? 'warn' : 'ok'
  })
  if (!okChecks) return finish(state, 'error')

  const okBuild = await runStage(state, 'building', config.buildCommand, async () => {
    if (config.preBuildCommand) {
      const code = await spawnCmd(state, config.preBuildCommand, config.projectPath)
      if (code !== 0) throw new Error(`Pre-build command failed with exit code ${code}`)
    }
    const code = await spawnCmd(state, config.buildCommand, config.projectPath)
    if (code !== 0) throw new Error(`Build failed with exit code ${code}`)
    if (config.postBuildCommand) {
      const postCode = await spawnCmd(state, config.postBuildCommand, config.projectPath)
      if (postCode !== 0) throw new Error(`Post-build command failed with exit code ${postCode}`)
    }
    return 'ok'
  })
  if (!okBuild) return finish(state, 'error')

  const adapterOk = config.isElectron ? await runElectronAdapter(state) : await runStaticAdapter(state)
  if (!adapterOk) return finish(state, 'error')

  // "manifest" runs the artifact copy/collection first — files must exist on disk
  // before they can be checksummed and listed, even though the spec lists this
  // stage before "finalizing".
  const okManifest = await runStage(state, 'manifest', undefined, async () => {
    fs.mkdirSync(state.outputDir!, { recursive: true })
    if (!config.isElectron && config.targets.includes('static-build')) {
      copyStaticFolder(state)
    }
    if (config.isElectron) {
      cleanupElectronExtras(state.outputDir!)
    }
    const files = await collectArtifacts(state.outputDir!)
    state.files = files
    const { manifestPath } = writeManifestFiles({
      exportDir: state.outputDir!,
      appName: config.appName,
      packageName: config.packageName,
      version: config.version,
      framework: config.framework,
      buildCommand: config.buildCommand,
      installerType: config.isElectron ? config.targets.filter((t) => t.startsWith('win-')) : config.targets,
      outputFiles: files,
      logs: state.logs,
    })
    state.manifestPath = manifestPath
    return 'ok'
  })
  if (!okManifest) return finish(state, 'error')

  const okFinal = await runStage(state, 'finalizing', undefined, async () => {
    store.saveBuildConfig(config)
    store.addRecentBuildPath(config.projectPath)
    store.setLastBuildAt(config.projectPath, Date.now())
    return 'ok'
  })
  return finish(state, okFinal ? 'done' : 'error')
}

export function startBuild(config: BuildConfig): string {
  const buildId = newId()
  const stages: BuildStageState[] = STAGE_ORDER.map((id) => ({ id, label: STAGE_LABELS[id], status: 'pending' }))
  const state: RunnerState = { buildId, config, stages, phase: 'running', logs: [], cancelRequested: false }
  runs.set(buildId, state)
  void runPipeline(state).catch((err) => {
    state.error = err instanceof Error ? err.message : String(err)
    finish(state, 'error')
  })
  return buildId
}

export function cancelBuild(buildId: string): boolean {
  const state = runs.get(buildId)
  if (!state) return false
  state.cancelRequested = true
  if (state.currentChild?.pid) killTree(state.currentChild.pid)
  return true
}

/** Phase 1 retries the whole build with the same config (true per-stage checkpointed retry is Phase 2). */
export function retryBuild(buildId: string): string | null {
  const state = runs.get(buildId)
  if (!state) return null
  return startBuild(state.config)
}

export function getRunState(buildId: string): BuildRunState | null {
  const state = runs.get(buildId)
  return state ? toPublicState(state) : null
}

export function getRunLogs(buildId: string): LogLine[] {
  return runs.get(buildId)?.logs ?? []
}

export function runPreflight(config: BuildConfig): BuildPreflightResult {
  const errors: BuildPreflightIssue[] = []
  const warnings: BuildPreflightIssue[] = []

  if (!fs.existsSync(config.projectPath)) {
    errors.push({ id: 'path-missing', message: `Project folder not found: ${config.projectPath}` })
  }
  if (!config.buildCommand) {
    errors.push({ id: 'no-build-command', message: 'No build command is configured.', fix: 'Set a build command in Build Configuration.' })
  }
  if (!isValidVersion(config.version)) {
    errors.push({ id: 'invalid-version', message: `"${config.version}" is not a valid version.`, fix: 'Use a semantic version like 1.0.0.' })
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 ._-]*$/.test(config.appName)) {
    errors.push({ id: 'invalid-app-name', message: 'Application name contains unsupported characters.' })
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(config.packageName)) {
    errors.push({ id: 'invalid-package-name', message: 'Package name must be lowercase letters, numbers, dots, dashes and underscores.' })
  }
  if (config.targets.length === 0) {
    errors.push({ id: 'no-targets', message: 'Select at least one build target.' })
  }
  if (config.isElectron && !config.electronVersion) {
    warnings.push({
      id: 'electron-version-unknown',
      message: 'Could not determine the Electron version from package.json.',
      why: 'electron-builder downloads prebuilt binaries matching the project\'s own Electron version.',
    })
  }
  if (!config.iconPath) {
    warnings.push({
      id: 'no-icon',
      message: 'No custom app icon was found; a default icon will be used.',
      why: 'A distinct icon helps users recognize the installed app.',
      fix: 'Add build/icon.ico, public/icon.png, or assets/icon.png to the project.',
    })
  }
  warnings.push({
    id: 'no-code-signing',
    message: 'No code-signing certificate configured. Windows SmartScreen warnings may appear.',
    why: 'Unsigned executables trigger a SmartScreen warning on first run.',
    fix: 'Code-signing configuration is not yet available in Build & Setup.',
  })

  if (fs.existsSync(config.exportDir)) {
    try {
      const hasEntries = fs.readdirSync(config.exportDir).length > 0
      if (hasEntries) {
        warnings.push({
          id: 'export-dir-not-empty',
          message: `Export folder already has content: ${config.exportDir}`,
          why: 'Files with the same name will be overwritten.',
        })
      }
    } catch {
      /* unreadable — surfaced by the writable check below */
    }
  }
  try {
    fs.mkdirSync(config.exportDir, { recursive: true })
    fs.accessSync(config.exportDir, fs.constants.W_OK)
  } catch {
    errors.push({ id: 'export-dir-not-writable', message: `Export folder is not writable: ${config.exportDir}` })
  }

  return { ok: errors.length === 0, errors, warnings }
}
