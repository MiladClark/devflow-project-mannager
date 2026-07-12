import fs from 'node:fs'
import path from 'node:path'
import type { BuildEligibility } from '../../src/shared/types'
import { detectBuildProject } from './buildDetect'
import { resolveTargets } from './buildTargets'
import { store } from './store'

/**
 * Fast, synchronous buildability check for a project — no spawned processes (unlike
 * computeHealth's node/pm --version checks) and no disk-walking exclusion scan, so it's
 * cheap enough to call for every row of the Projects table.
 */
export function checkEligibility(projectPath: string): BuildEligibility {
  const raw = detectBuildProject(projectPath)
  if ('error' in raw) {
    return {
      status: 'not-buildable',
      statusLabel: 'Not Buildable',
      framework: 'unknown',
      supportedTargets: [],
      reason: raw.error,
    }
  }

  const { supported } = resolveTargets(raw)
  const lastBuildAt = store.getLastBuildAt(projectPath)
  const base = {
    framework: raw.framework,
    version: raw.version,
    packageManager: raw.packageManager,
    supportedTargets: supported,
    lastBuildAt,
  }

  if (!raw.buildCommand) {
    return {
      ...base,
      status: 'config-missing',
      statusLabel: 'Build Configuration Missing',
      reason: 'No supported build command was found in package.json.',
      detail: `The project contains a package.json file, but it does not include a "build" script and no supported framework configuration could be detected.`,
      fix: `Add a valid build script, such as "build": "vite build", or select/configure a supported framework in DevFlow.`,
    }
  }

  if (supported.length === 0) {
    return {
      ...base,
      status: 'not-buildable',
      statusLabel: 'Not Buildable',
      reason: 'No supported build target was detected for this project.',
      detail: 'This project does not match any framework or packaging configuration Build & Setup currently supports.',
      fix: 'Open Build & Setup for details on what was detected, or add a recognized framework configuration.',
    }
  }

  const depsInstalled = fs.existsSync(path.join(projectPath, 'node_modules'))
  if (!depsInstalled) {
    return {
      ...base,
      status: 'needs-attention',
      statusLabel: 'Needs Attention',
      reason: 'Dependencies are not installed.',
      detail: 'node_modules was not found. Build & Setup can install them automatically before building.',
      fix: 'Enable "Install dependencies before build" in Build Configuration, or run install first.',
    }
  }

  return { ...base, status: 'ready', statusLabel: 'Ready to Build' }
}

export function checkEligibilityMany(projectPaths: string[]): Record<string, BuildEligibility> {
  const out: Record<string, BuildEligibility> = {}
  for (const p of projectPaths) out[p] = checkEligibility(p)
  return out
}
