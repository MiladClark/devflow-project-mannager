import fs from 'node:fs'
import path from 'node:path'
import type { Project } from '../../src/shared/types'

function hasPackageJson(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'package.json'))
}

/** Try F:\DEV\foo → F:\DEV\dev-projects\foo when a project folder was moved. */
function tryDevProjectsInsert(storedPath: string): string | null {
  const normalized = path.normalize(storedPath)
  const match = normalized.match(/^([A-Za-z]:\\[^\\]+)\\(.+)$/i)
  if (!match) return null
  const candidate = path.join(match[1], 'dev-projects', match[2])
  return hasPackageJson(candidate) ? candidate : null
}

function readPackageName(dir: string): string | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'))
    return typeof pkg.name === 'string' ? pkg.name : null
  } catch {
    return null
  }
}

function findByPackageName(name: string, roots: string[], maxDepth: number): string | null {
  function scan(dir: string, depth: number): string | null {
    if (depth > maxDepth || !fs.existsSync(dir)) return null
    if (hasPackageJson(dir) && readPackageName(dir) === name) return dir
    if (depth === maxDepth) return null
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return null
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const found = scan(path.join(dir, entry.name), depth + 1)
      if (found) return found
    }
    return null
  }

  for (const root of roots) {
    const found = scan(root, 0)
    if (found) return found
  }
  return null
}

function searchRoots(storedPath: string): string[] {
  const roots = new Set<string>()
  roots.add(path.dirname(storedPath))

  const devMatch = path.normalize(storedPath).match(/^([A-Za-z]:\\[^\\]+)/i)
  if (devMatch) roots.add(path.join(devMatch[1], 'dev-projects'))

  return [...roots].filter((r) => fs.existsSync(r))
}

export function healProjectPath(project: Project): string {
  const storedPath = project.path
  if (fs.existsSync(storedPath) && hasPackageJson(storedPath)) return storedPath

  const inserted = tryDevProjectsInsert(storedPath)
  if (inserted) return inserted

  const byName = findByPackageName(project.name, searchRoots(storedPath), 3)
  if (byName) return byName

  return storedPath
}

export function healProjects(projects: Project[]): { projects: Project[]; changed: string[] } {
  const changed: string[] = []
  const healed = projects.map((p) => {
    const nextPath = healProjectPath(p)
    if (nextPath !== p.path) {
      changed.push(`${p.name}: ${p.path} → ${nextPath}`)
      return { ...p, path: nextPath }
    }
    return p
  })
  return { projects: healed, changed }
}
