import fs from 'node:fs'
import path from 'node:path'
import type { Project } from '../../src/shared/types'
import { newId } from './store'
import { resolvePackageManager, pmRun } from './pkgmanager'
import { parseEnginesNode } from './nodeVersion'
import { sanitizeSlug } from './proxy'
import { sniffFramework, type PackageJsonLike } from './frameworkSniff'

export function detectProject(dir: string): Project | { error: string } {
  const pkgPath = path.join(dir, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    return { error: 'No package.json found in the selected folder.' }
  }
  let pkg: PackageJsonLike
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  } catch {
    return { error: 'package.json could not be parsed.' }
  }

  const { framework, frameworks, defaultPort, outputDir } = sniffFramework(pkg)

  const scripts = pkg.scripts ?? {}
  const pm = resolvePackageManager(dir)
  // Strapi uses `develop` as its dev script
  const runCommand = scripts.dev
    ? pmRun(pm, 'dev')
    : scripts.develop
      ? pmRun(pm, 'develop')
      : scripts.start
        ? pmRun(pm, 'start')
        : ''
  const buildCommand = scripts.build ? pmRun(pm, 'build') : ''
  const nodeVersion = parseEnginesNode(dir)

  return {
    id: newId(),
    name: pkg.name || path.basename(dir),
    path: dir,
    framework,
    frameworks,
    runCommand,
    buildCommand,
    outputDir,
    defaultPort,
    packageManager: pm,
    nodeVersion,
    localSlug: sanitizeSlug(pkg.name || path.basename(dir)),
    env: {},
    createdAt: Date.now(),
  }
}
