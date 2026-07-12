import fs from 'node:fs'
import path from 'node:path'
import type { BuildDetection } from '../../src/shared/types'
import { resolvePackageManager, pmRun } from './pkgmanager'
import { parseEnginesNode } from './nodeVersion'
import { sniffFramework, type PackageJsonLike } from './frameworkSniff'

export type RawBuildDetection = Omit<BuildDetection, 'health' | 'exclusions' | 'supportedTargets' | 'disabledTargets'>

const ICON_CANDIDATES = [
  'build/icon.ico',
  'build/icon.png',
  'public/icon.png',
  'public/icon.ico',
  'assets/icon.png',
  'assets/icon.ico',
  'icons/icon.png',
  'resources/icon.ico',
  'resources/icon.png',
]

function findIcon(dir: string): string | undefined {
  for (const rel of ICON_CANDIDATES) {
    const abs = path.join(dir, rel)
    if (fs.existsSync(abs)) return abs
  }
  return undefined
}

function detectExistingBuilderConfig(dir: string, pkg: PackageJsonLike & { build?: unknown }): BuildDetection['existingBuilderConfig'] {
  if (fs.existsSync(path.join(dir, 'electron-builder.yml')) || fs.existsSync(path.join(dir, 'electron-builder.yaml'))) {
    return 'yaml'
  }
  if (fs.existsSync(path.join(dir, 'electron-builder.json')) || fs.existsSync(path.join(dir, 'electron-builder.json5'))) {
    return 'json'
  }
  if (pkg.build) return 'package-json'
  return null
}

function parseElectronVersion(pkg: PackageJsonLike): string | undefined {
  const raw = pkg.dependencies?.electron ?? pkg.devDependencies?.electron
  if (!raw) return undefined
  const m = raw.match(/\d+(\.\d+)?(\.\d+)?/)
  return m ? m[0] : raw
}

function resolveOutputDir(dir: string, isElectron: boolean, sniffedOutputDir: string, pkg: PackageJsonLike & { build?: { directories?: { output?: string } } }): string {
  if (isElectron && pkg.build?.directories?.output) return pkg.build.directories.output
  // prefer a directory that already exists from a prior build, else the sniffed guess
  const candidates = isElectron ? [sniffedOutputDir, 'release', 'out', 'dist'] : [sniffedOutputDir, 'dist', 'build', '.next', 'out']
  for (const c of candidates) {
    if (fs.existsSync(path.join(dir, c))) return c
  }
  return sniffedOutputDir
}

export function detectBuildProject(dir: string): RawBuildDetection | { error: string } {
  if (!fs.existsSync(dir)) {
    return { error: `Folder not found: ${dir}` }
  }
  const pkgPath = path.join(dir, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    return { error: 'No package.json found in the selected folder. Build & Setup needs a Node-based project.' }
  }
  let pkg: PackageJsonLike & { build?: { directories?: { output?: string } } }
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  } catch {
    return { error: 'package.json could not be parsed.' }
  }

  const { framework, frameworks, outputDir: sniffedOutputDir } = sniffFramework(pkg)
  const isElectron = framework === 'electron'
  const pm = resolvePackageManager(dir)
  const scripts = pkg.scripts ?? {}
  const devCommand = scripts.dev
    ? pmRun(pm, 'dev')
    : scripts.develop
      ? pmRun(pm, 'develop')
      : scripts.start
        ? pmRun(pm, 'start')
        : ''
  const buildCommand = scripts.build ? pmRun(pm, 'build') : ''
  const outputDir = resolveOutputDir(dir, isElectron, sniffedOutputDir, pkg)
  const iconPath = findIcon(dir)

  return {
    projectPath: dir,
    appName: pkg.name || path.basename(dir),
    packageName: pkg.name || path.basename(dir).toLowerCase().replace(/[^a-z0-9._-]/g, '-'),
    version: (pkg as { version?: string }).version || '0.1.0',
    framework,
    frameworks,
    packageManager: pm,
    nodeVersion: parseEnginesNode(dir),
    buildCommand,
    devCommand,
    outputDir,
    isElectron,
    electronVersion: isElectron ? parseElectronVersion(pkg) : undefined,
    hasIconAsset: !!iconPath,
    iconPath,
    existingBuilderConfig: detectExistingBuilderConfig(dir, pkg),
  }
}
