import fs from 'node:fs'
import path from 'node:path'
import type { ProjectScript } from '../../src/shared/types'
import { resolvePackageManager, pmRun } from './pkgmanager'

const HIDDEN = new Set(['dev', 'start', 'build', 'develop'])

export function listProjectScripts(projectPath: string, includeHidden = false): ProjectScript[] {
  const pkgPath = path.join(projectPath, 'package.json')
  if (!fs.existsSync(pkgPath)) return []
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    const scripts: Record<string, string> = pkg.scripts ?? {}
    const pm = resolvePackageManager(projectPath)
    return Object.entries(scripts)
      .filter(([name]) => includeHidden || !HIDDEN.has(name))
      .map(([name, script]) => ({
        name,
        command: pmRun(pm, name),
        hidden: HIDDEN.has(name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

export function scriptCommand(projectPath: string, scriptName: string): string | null {
  const pkgPath = path.join(projectPath, 'package.json')
  if (!fs.existsSync(pkgPath)) return null
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    if (!pkg.scripts?.[scriptName]) return null
    return pmRun(resolvePackageManager(projectPath), scriptName)
  } catch {
    return null
  }
}
