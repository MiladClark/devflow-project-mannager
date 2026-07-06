import { execFile, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import semver from 'semver'
import type { NodeManager, PreferredNodeManager, Project } from '../../src/shared/types'
import { store } from './store'

function run(cmd: string, args: string[], env?: NodeJS.ProcessEnv): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: 15000, shell: true, env: { ...process.env, ...env } }, (err, stdout) => {
      resolve({ ok: !err, stdout: (stdout ?? '').trim() })
    })
  })
}

export function parseEnginesNode(projectPath: string): string | undefined {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'))
    const raw = pkg.engines?.node
    if (typeof raw !== 'string' || !raw.trim()) return undefined
    const coerced = semver.coerce(raw)
    return coerced ? String(coerced.major) : raw.trim()
  } catch {
    return undefined
  }
}

async function which(cmd: string): Promise<boolean> {
  if (process.platform === 'win32') {
    try {
      execSync(`where ${cmd}`, { windowsHide: true, stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }
  const res = await run('which', [cmd])
  return res.ok
}

export async function detectNodeManagers(): Promise<Record<NodeManager, boolean>> {
  const [fnm, nvm, volta] = await Promise.all([which('fnm'), which('nvm'), which('volta')])
  return { system: true, fnm, nvm, volta }
}

function pickManager(project: Project, detected: Record<NodeManager, boolean>): NodeManager {
  if (project.nodeManager && project.nodeManager !== 'system' && detected[project.nodeManager]) {
    return project.nodeManager
  }
  const pref = store.getSettings().preferredNodeManager ?? 'auto'
  if (pref !== 'auto' && pref !== 'system' && detected[pref]) return pref
  if (detected.fnm) return 'fnm'
  if (detected.nvm) return 'nvm'
  if (detected.volta) return 'volta'
  return 'system'
}

/** Build env overrides for spawning project commands with the right Node version. */
export async function resolveNodeEnv(project: Project): Promise<{ env: Record<string, string>; prefix: string; warning?: string }> {
  const version = project.nodeVersion ?? parseEnginesNode(project.path)
  if (!version) return { env: {}, prefix: '' }

  const detected = await detectNodeManagers()
  const manager = pickManager(project, detected)

  if (manager === 'system') {
    const sys = await run('node', ['--version'])
    const installed = sys.stdout.replace(/^v/, '')
    const satisfied = semver.satisfies(installed, version) || semver.satisfies(installed, `^${version}`)
    return {
      env: {},
      prefix: '',
      warning: satisfied ? undefined : `System Node v${installed} may not satisfy engines.node (${version}). Install fnm or set a version manager.`,
    }
  }

  if (manager === 'fnm') {
    return { env: { FNM_VERSION: version }, prefix: `fnm exec --using ${version} -- ` }
  }
  if (manager === 'nvm') {
    return { env: { NVM_VERSION: version }, prefix: `nvm use ${version} && ` }
  }
  if (manager === 'volta') {
    return { env: { VOLTA_NODE: version }, prefix: '' }
  }

  return { env: {}, prefix: '' }
}

export function wrapCommand(prefix: string, cmd: string): string {
  return prefix ? `${prefix}${cmd}` : cmd
}
