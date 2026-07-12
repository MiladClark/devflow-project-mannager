import { ipcMain, shell, clipboard } from 'electron'
import type { BuildConfig, BuildDetection, BuildStageId } from '../../src/shared/types'
import { store } from '../lib/store'
import { detectBuildProject } from '../lib/buildDetect'
import { computeHealth } from '../lib/buildHealth'
import { scanExclusions } from '../lib/buildExclusions'
import { resolveTargets } from '../lib/buildTargets'
import { startBuild, cancelBuild, retryBuild, getRunState, runPreflight } from '../lib/buildRunner'
import { checkEligibility, checkEligibilityMany } from '../lib/buildEligibility'
import { getEnforcedEntitlements, isGuestAccess, GUEST_ACTION_ERROR } from '../lib/licensing'

function accessError(): string | null {
  if (isGuestAccess()) return GUEST_ACTION_ERROR
  if (!getEnforcedEntitlements().buildAndSetup) {
    return 'Build & Setup requires a Pro license. Upgrade on the DevTune website to unlock it.'
  }
  return null
}

async function detectFull(dir: string): Promise<BuildDetection | { error: string }> {
  const raw = detectBuildProject(dir)
  if ('error' in raw) return raw
  const health = await computeHealth(raw)
  const exclusions = scanExclusions(dir)
  const { supported, disabled } = resolveTargets(raw)
  return { ...raw, health, exclusions, supportedTargets: supported, disabledTargets: disabled }
}

export function registerBuildHandlers() {
  ipcMain.handle('build:detect', async (_e, dir: string) => {
    const err = accessError()
    if (err) return { error: err }
    return detectFull(dir)
  })

  ipcMain.handle('build:getConfig', (_e, projectPath: string) => store.getBuildConfig(projectPath) ?? null)

  ipcMain.handle('build:saveConfig', (_e, config: BuildConfig) => {
    store.saveBuildConfig(config)
    return true
  })

  ipcMain.handle('build:resetConfig', (_e, projectPath: string) => {
    store.resetBuildConfig(projectPath)
    return true
  })

  ipcMain.handle('build:computeExclusions', (_e, dir: string) => scanExclusions(dir))

  ipcMain.handle('build:preflight', (_e, config: BuildConfig) => runPreflight(config))

  ipcMain.handle('build:start', (_e, config: BuildConfig) => {
    const err = accessError()
    if (err) return { ok: false, error: err }
    const preflight = runPreflight(config)
    if (!preflight.ok) {
      return { ok: false, error: preflight.errors[0]?.message ?? 'Build cannot start — preflight failed.' }
    }
    const buildId = startBuild(config)
    return { ok: true, buildId }
  })

  ipcMain.handle('build:cancel', (_e, buildId: string) => cancelBuild(buildId))

  ipcMain.handle('build:retryStage', (_e, buildId: string, _stageId?: BuildStageId) => {
    const err = accessError()
    if (err) return { ok: false, error: err }
    const newBuildId = retryBuild(buildId)
    return newBuildId ? { ok: true, buildId: newBuildId } : { ok: false, error: 'Build not found.' }
  })

  ipcMain.handle('build:getState', (_e, buildId: string) => getRunState(buildId))

  ipcMain.handle('build:openOutput', (_e, dir: string) => shell.openPath(dir))

  ipcMain.handle('build:copySummary', (_e, text: string) => {
    clipboard.writeText(text)
    return true
  })

  ipcMain.handle('build:recentPaths', () => store.getRecentBuildPaths())

  // Eligibility is read-only project info (not gated) — matches health/git status,
  // which are also visible on the Free plan so users can see what Pro would unlock.
  ipcMain.handle('build:eligibility', (_e, projectPath: string) => checkEligibility(projectPath))
  ipcMain.handle('build:eligibilityMany', (_e, projectPaths: string[]) => checkEligibilityMany(projectPaths))
}
