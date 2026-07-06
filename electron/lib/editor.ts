import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import type { EditorStatus, PreferredEditor } from '../../src/shared/types'
import { detectEnv, expandEnv } from './tools'
import { store } from './store'

const EDITOR_BINARIES = {
  vscode: {
    cmd: 'code',
    label: 'VS Code',
    paths: [
      '%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\bin\\code.cmd',
      '%LOCALAPPDATA%\\Programs\\Microsoft VS Code\\bin\\code',
    ],
  },
  cursor: {
    cmd: 'cursor',
    label: 'Cursor',
    paths: [
      '%LOCALAPPDATA%\\Programs\\cursor\\resources\\app\\bin\\cursor.cmd',
      '%LOCALAPPDATA%\\Programs\\cursor\\resources\\app\\bin\\cursor',
    ],
  },
} as const

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { windowsHide: true, timeout: 8000, shell: true, env, cwd: os.homedir() },
      (err) => resolve(!err),
    )
  })
}

async function resolveExecutable(editor: keyof typeof EDITOR_BINARIES): Promise<string | null> {
  const env = detectEnv()
  const def = EDITOR_BINARIES[editor]

  // Prefer explicit install paths — Cursor registers its own `code` shim ahead of VS Code on PATH.
  for (const p of def.paths) {
    const expanded = expandEnv(p, env)
    if (!existsSync(expanded)) continue
    if (await run(expanded, ['--version'], env)) return expanded
  }

  if (editor === 'vscode' && process.platform === 'win32') {
    const hit = await findOnPath('code', env, (p) => /microsoft vscode/i.test(p))
    if (hit && (await run(hit, ['--version'], env))) return hit
    return null
  }

  if (await run(def.cmd, ['--version'], env)) return def.cmd
  return null
}

function findOnPath(
  cmd: string,
  env: NodeJS.ProcessEnv,
  match: (resolvedPath: string) => boolean,
): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('where', [cmd], { shell: true, env, windowsHide: true, cwd: os.homedir() }, (err, stdout) => {
      if (err || !stdout) return resolve(null)
      const hit = stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find(match)
      resolve(hit ?? null)
    })
  })
}

export async function detectEditors(): Promise<EditorStatus> {
  const [vscode, cursor] = await Promise.all([
    resolveExecutable('vscode').then(Boolean),
    resolveExecutable('cursor').then(Boolean),
  ])
  return { vscode, cursor }
}

function resolveEditorChoice(override?: PreferredEditor): PreferredEditor {
  const settings = store.getSettings()
  return override ?? settings.preferredEditor ?? 'vscode'
}

export async function openInEditor(
  projectPath: string,
  override?: PreferredEditor,
): Promise<{ ok: boolean; error?: string }> {
  const choice = resolveEditorChoice(override)
  const env = detectEnv()

  let executable: string
  let label: string

  if (choice === 'custom') {
    const cmd = store.getSettings().customEditorCmd?.trim()
    if (!cmd) return { ok: false, error: 'Set a custom editor command in Settings.' }
    executable = cmd
    label = cmd
    if (!(await run(executable, ['--version'], env))) {
      return { ok: false, error: `${label} is not installed or not on PATH.` }
    }
  } else {
    const def = EDITOR_BINARIES[choice]
    label = def.label
    const resolved = await resolveExecutable(choice)
    if (!resolved) {
      return { ok: false, error: `${label} is not installed or not on PATH.` }
    }
    executable = resolved
  }

  return new Promise((resolve) => {
    const child = spawn(executable, ['.'], {
      cwd: projectPath,
      shell: true,
      env,
      windowsHide: true,
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
    child.on('error', (err) => resolve({ ok: false, error: err.message }))
    child.on('spawn', () => resolve({ ok: true }))
  })
}
