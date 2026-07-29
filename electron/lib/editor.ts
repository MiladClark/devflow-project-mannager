import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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
      '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code',
      path.join(os.homedir(), 'Applications/Visual Studio Code.app/Contents/Resources/app/bin/code'),
    ],
  },
  cursor: {
    cmd: 'cursor',
    label: 'Cursor',
    paths: [
      '%LOCALAPPDATA%\\Programs\\cursor\\resources\\app\\bin\\cursor.cmd',
      '%LOCALAPPDATA%\\Programs\\cursor\\resources\\app\\bin\\cursor',
      '/Applications/Cursor.app/Contents/Resources/app/bin/cursor',
      path.join(os.homedir(), 'Applications/Cursor.app/Contents/Resources/app/bin/cursor'),
    ],
  },
} as const

// Under `shell: true` the executable and args are concatenated into one command
// string, so a resolved path with spaces ("...\Microsoft VS Code\bin\code.cmd",
// "/Applications/Visual Studio Code.app/...") must be quoted or the shell splits
// it at the first space.
function quoteForShell(p: string): string {
  return /\s/.test(p) ? `"${p}"` : p
}

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
    const quoted = quoteForShell(expanded)
    if (await run(quoted, ['--version'], env)) return quoted
  }

  if (editor === 'vscode' && process.platform === 'win32') {
    // Default install dir is "Microsoft VS Code" (with spaces).
    const hit = await findOnPath('code', env, (p) => /microsoft vs ?code/i.test(p))
    if (hit) {
      const quoted = quoteForShell(hit)
      if (await run(quoted, ['--version'], env)) return quoted
    }
    return null
  }

  if (editor === 'vscode' && process.platform === 'darwin') {
    // Cursor's own CLI is named `cursor`, but guard against a `code` shim
    // that resolves into a Cursor.app bundle rather than VS Code's.
    const hit = await findOnPath('code', env, (p) => !/cursor/i.test(p))
    if (hit) {
      const quoted = quoteForShell(hit)
      if (await run(quoted, ['--version'], env)) return quoted
    }
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
  const isWin = process.platform === 'win32'
  const bin = isWin ? 'where' : 'which'
  const args = isWin ? [cmd] : ['-a', cmd]
  return new Promise((resolve) => {
    execFile(bin, args, { shell: true, env, windowsHide: true, cwd: os.homedir() }, (err, stdout) => {
      if (err || !stdout) return resolve(null)
      const hit = stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
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
    // NO `detached` on Windows: DETACHED_PROCESS is unreliable for console hosts
    // spawned from the packaged GUI app (see spawnApplyScript in updater.ts).
    // windowsHide gives cmd.exe a hidden console instead, and unref() below is
    // enough for the editor to outlive us.
    const child = spawn(executable, ['.'], {
      cwd: projectPath,
      shell: true,
      env,
      windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    })
    child.unref()
    child.on('error', (err) => resolve({ ok: false, error: err.message }))
    child.on('spawn', () => resolve({ ok: true }))
  })
}
