import fs from 'node:fs'
import path from 'node:path'
import type { PackageManager, Project, BuildIssue } from '../../src/shared/types'
import { run } from './tools'

/** Resolve the package manager a project uses, from its lockfile / packageManager field. */
export function resolvePackageManager(dir: string): PackageManager {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'))
    const pm: unknown = pkg.packageManager
    if (typeof pm === 'string') {
      // corepack field is authoritative, e.g. "pnpm@9.1.0"
      if (pm.startsWith('pnpm')) return 'pnpm'
      if (pm.startsWith('yarn')) return 'yarn'
      if (pm.startsWith('bun')) return 'bun'
      if (pm.startsWith('npm')) return 'npm'
    }
  } catch {
    /* no/invalid package.json */
  }
  if (fs.existsSync(path.join(dir, 'bun.lockb')) || fs.existsSync(path.join(dir, 'bun.lock'))) return 'bun'
  if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn'
  return 'npm'
}

/** The command to run a package.json script with the given manager. */
export function pmRun(pm: PackageManager, script: string): string {
  switch (pm) {
    case 'npm':
      return `npm run ${script}`
    case 'pnpm':
      return `pnpm run ${script}`
    case 'yarn':
      return `yarn ${script}`
    case 'bun':
      return `bun run ${script}`
  }
}

export function pmInstall(pm: PackageManager): string {
  return pm === 'yarn' ? 'yarn install' : `${pm} install`
}

/** Apps & Tools id for installing a package manager, if it isn't bundled with Node. */
function pmToolId(pm: PackageManager): string | undefined {
  return pm === 'npm' ? undefined : pm // pnpm/yarn/bun exist as tools; npm ships with Node
}

async function commandExists(cmd: string): Promise<boolean> {
  const res = await run(cmd, ['--version'])
  return res.code === 0
}

/**
 * Check everything needed before running a build/dev command. Returns the first
 * blocking issue with a suggested fix, or null if the project is ready.
 */
export async function preflight(project: Project, needBuildScript: boolean): Promise<BuildIssue | null> {
  if (!fs.existsSync(project.path)) {
    return {
      kind: 'path-missing',
      message: `Project folder not found: ${project.path}. Re-import the project or choose its new location in DevFlow.`,
    }
  }

  // 1. Node must be present for any JS project
  if (!(await commandExists('node'))) {
    return {
      kind: 'node-missing',
      message: 'Node.js is not installed. Install it to run or build JavaScript projects.',
      toolId: 'node',
    }
  }

  const pm = resolvePackageManager(project.path)

  // 2. The required package manager must be available
  if (pm !== 'npm' && !(await commandExists(pm))) {
    return {
      kind: 'pm-missing',
      message: `This project uses ${pm}, but ${pm} is not installed.`,
      packageManager: pm,
      toolId: pmToolId(pm),
    }
  }

  // 3. Dependencies must be installed
  if (!fs.existsSync(path.join(project.path, 'node_modules'))) {
    return {
      kind: 'deps-missing',
      message: `Dependencies are not installed. Run "${pmInstall(pm)}" first.`,
      packageManager: pm,
      canInstallDeps: true,
    }
  }

  // 4. A build script must exist when building
  if (needBuildScript && !project.buildCommand) {
    return {
      kind: 'no-build-script',
      message: 'This project has no build script in package.json.',
    }
  }

  return null
}
