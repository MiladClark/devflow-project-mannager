import { ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { EnvFileInfo, EnvLine } from '../../src/shared/types'
import { store } from '../lib/store'

const ENV_NAME_RE = /^\.env(\.[\w.-]+)?$/
const PAIR_RE = /^\s*(export\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*=(.*)$/

/** Resolve an env file path safely inside the project root. */
function resolveEnvPath(projectId: string, fileName: string): { ok: true; file: string; root: string } | { ok: false; error: string } {
  const project = store.getProject(projectId)
  if (!project) return { ok: false, error: 'Project not found' }
  if (!ENV_NAME_RE.test(fileName)) return { ok: false, error: 'Invalid env file name' }
  const root = path.resolve(project.path)
  const file = path.resolve(root, fileName)
  if (!file.startsWith(root + path.sep)) return { ok: false, error: 'Invalid path' }
  return { ok: true, file, root }
}

function parseEnv(content: string): EnvLine[] {
  return content.split(/\r?\n/).map((raw): EnvLine => {
    if (raw.trim() === '') return { type: 'blank', raw }
    if (raw.trim().startsWith('#')) return { type: 'comment', raw }
    const m = raw.match(PAIR_RE)
    if (m) return { type: 'pair', key: m[2], value: m[3], raw }
    return { type: 'raw', raw }
  })
}

function serializeEnv(lines: EnvLine[]): string {
  return lines
    .map((l) => {
      if (l.type === 'pair' && l.key !== undefined) {
        // untouched lines keep their exact original text
        const m = l.raw.match(PAIR_RE)
        if (m && m[2] === l.key && m[3] === l.value) return l.raw
        return `${l.key}=${l.value ?? ''}`
      }
      return l.raw
    })
    .join('\n')
}

export function registerEnvHandlers() {
  ipcMain.handle('env:listFiles', (_e, projectId: string): EnvFileInfo[] => {
    const project = store.getProject(projectId)
    if (!project) return []
    try {
      return fs
        .readdirSync(project.path)
        .filter((n) => ENV_NAME_RE.test(n))
        .map((n) => {
          const st = fs.statSync(path.join(project.path, n))
          return { name: n, size: st.size, mtime: st.mtimeMs }
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      return []
    }
  })

  ipcMain.handle('env:read', (_e, projectId: string, fileName: string) => {
    const r = resolveEnvPath(projectId, fileName)
    if (!r.ok) return { ok: false, error: r.error }
    try {
      const content = fs.readFileSync(r.file, 'utf-8')
      return { ok: true, lines: parseEnv(content) }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Read failed' }
    }
  })

  ipcMain.handle('env:write', (_e, projectId: string, fileName: string, lines: EnvLine[]) => {
    const r = resolveEnvPath(projectId, fileName)
    if (!r.ok) return { ok: false, error: r.error }
    if (!Array.isArray(lines)) return { ok: false, error: 'Invalid content' }
    try {
      let backupPath: string | undefined
      if (fs.existsSync(r.file)) {
        backupPath = `${r.file}.devflow.bak`
        fs.copyFileSync(r.file, backupPath)
      }
      fs.writeFileSync(r.file, serializeEnv(lines), 'utf-8')
      return { ok: true, backupPath }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Write failed' }
    }
  })
}
