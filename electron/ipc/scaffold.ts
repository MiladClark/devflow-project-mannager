import { ipcMain, BrowserWindow } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { ScaffoldOptions, ScaffoldResult } from '../../src/shared/types'
import { normalizePlugins, type ScaffoldPluginId } from '../../src/shared/scaffoldPlugins'
import { store } from '../lib/store'
import { importProjectFromPath } from './projects'
import { getEnforcedEntitlements, isGuestAccess, GUEST_ACTION_ERROR } from '../lib/licensing'

function broadcast(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, ...args)
}

function log(text: string, stream: 'out' | 'err' | 'sys' = 'out') {
  broadcast('scaffold:log', { ts: Date.now(), stream, text })
}

const SCAFFOLD_TIMEOUT_MS = 20 * 60 * 1000

let activeScaffoldChild: ChildProcess | null = null
let scaffoldCancelled = false
let scaffoldInProgress = false

/** Matches common prompts from create-* CLIs (prompts, inquirer, etc.). */
const INTERACTIVE_PROMPT_RE =
  /\?\s+(?:Select|Add|Enable|Project name|Package name|Overwrite|Which|Choose|Pick)\b|Use arrow-keys|Return to submit/i

function scaffoldEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NO_COLOR: '1',
    FORCE_COLOR: '0',
    CI: 'true',
    npm_config_yes: 'true',
    npm_config_loglevel: 'info',
    npm_config_progress: 'false',
    npm_config_fund: 'false',
    npm_config_audit: 'false',
  }
}

function killScaffoldChild(child: ChildProcess) {
  if (process.platform === 'win32' && child.pid) {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { shell: true, windowsHide: true })
  } else {
    child.kill('SIGTERM')
  }
}

function cleanupPartialProject(projectDir: string) {
  if (!fs.existsSync(projectDir)) return
  try {
    fs.rmSync(projectDir, { recursive: true, force: true })
    log(`Removed incomplete project folder: ${projectDir}`, 'sys')
  } catch (err) {
    log(`Could not remove folder: ${err instanceof Error ? err.message : String(err)}`, 'err')
  }
}

function cancelActiveScaffold() {
  scaffoldCancelled = true
  if (activeScaffoldChild) killScaffoldChild(activeScaffoldChild)
}

function scaffoldWasCancelled(): boolean {
  return scaffoldCancelled
}

function cancelledResult(): ScaffoldResult {
  return { ok: false, error: 'Installation cancelled', cancelled: true }
}

function runFailure(code: number, interactiveError: string, exitError: string): ScaffoldResult | null {
  if (scaffoldWasCancelled()) return cancelledResult()
  if (code === 130) return { ok: false, error: interactiveError }
  if (code !== 0) return { ok: false, error: exitError }
  return null
}

function run(cmd: string, cwd: string, timeoutMs = SCAFFOLD_TIMEOUT_MS): Promise<number> {
  return new Promise((resolve, reject) => {
    if (scaffoldWasCancelled()) {
      resolve(130)
      return
    }
    log(`$ ${cmd}`, 'sys')
    const child = spawn(cmd, {
      cwd,
      shell: true,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: scaffoldEnv(),
    })

    activeScaffoldChild = child
    let settled = false
    let sawInteractivePrompt = false
    const finish = (code: number) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (activeScaffoldChild === child) activeScaffoldChild = null
      resolve(code)
    }

    const onChunk = (stream: 'out' | 'err') => (c: Buffer) => {
      const text = c.toString()
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').trim()
        if (!trimmed) continue
        log(trimmed, stream === 'err' ? 'err' : 'out')
        if (INTERACTIVE_PROMPT_RE.test(trimmed)) {
          sawInteractivePrompt = true
          log(
            'Interactive CLI prompt detected — aborting because DevFlow cannot answer terminal prompts.',
            'err',
          )
          killScaffoldChild(child)
          finish(130)
        }
      }
    }

    child.stdout?.on('data', onChunk('out'))
    child.stderr?.on('data', onChunk('err'))
    child.on('error', (err) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        if (activeScaffoldChild === child) activeScaffoldChild = null
        reject(err)
      }
    })
    child.on('exit', (code) => {
      if (scaffoldWasCancelled() || sawInteractivePrompt) finish(130)
      else finish(code ?? 1)
    })

    const timer = setTimeout(() => {
      log(`Command timed out after ${Math.round(timeoutMs / 60000)} minutes`, 'err')
      killScaffoldChild(child)
      finish(124)
    }, timeoutMs)
  })
}

function patchTailwindImport(cssPath: string) {
  const css = fs.readFileSync(cssPath, 'utf-8')
  if (!css.includes('@import "tailwindcss"')) {
    fs.writeFileSync(cssPath, `@import "tailwindcss";\n\n` + css, 'utf-8')
    log(`Added Tailwind import to ${path.relative(path.dirname(path.dirname(cssPath)), cssPath)}`, 'sys')
  }
}

function patchTailwindViteConfig(cfgPath: string, electronRenderer = false) {
  let cfg = fs.readFileSync(cfgPath, 'utf-8')
  if (cfg.includes('@tailwindcss/vite')) return
  cfg = `import tailwindcss from '@tailwindcss/vite'\n` + cfg
  if (electronRenderer && cfg.includes('renderer:')) {
    cfg = cfg.replace(/(renderer:\s*\{[\s\S]*?plugins:\s*)\[/, '$1[tailwindcss(), ')
  } else {
    cfg = cfg.replace(/plugins:\s*\[/, 'plugins: [tailwindcss(), ')
  }
  fs.writeFileSync(cfgPath, cfg, 'utf-8')
  log(`Patched ${path.basename(cfgPath)} with Tailwind plugin`, 'sys')
}

function addTailwindToVite(projectDir: string) {
  for (const name of ['vite.config.ts', 'vite.config.js']) {
    const cfgPath = path.join(projectDir, name)
    if (!fs.existsSync(cfgPath)) continue
    patchTailwindViteConfig(cfgPath)
    break
  }
  for (const rel of ['src/index.css', 'src/style.css', 'src/assets/main.css']) {
    const cssPath = path.join(projectDir, rel)
    if (!fs.existsSync(cssPath)) continue
    patchTailwindImport(cssPath)
    break
  }
}

function addTailwindToElectron(projectDir: string) {
  for (const name of ['electron.vite.config.ts', 'electron.vite.config.mjs', 'electron.vite.config.js']) {
    const cfgPath = path.join(projectDir, name)
    if (!fs.existsSync(cfgPath)) continue
    patchTailwindViteConfig(cfgPath, true)
    break
  }
  for (const rel of [
    'src/renderer/src/assets/main.css',
    'src/renderer/src/assets/base.css',
    'src/renderer/src/index.css',
    'src/renderer/index.css',
  ]) {
    const cssPath = path.join(projectDir, rel)
    if (!fs.existsSync(cssPath)) continue
    patchTailwindImport(cssPath)
    break
  }
}

function publicDirFor(projectDir: string, framework: ScaffoldOptions['framework']): string {
  if (framework === 'electron') {
    const rendererPublic = path.join(projectDir, 'src', 'renderer', 'public')
    fs.mkdirSync(rendererPublic, { recursive: true })
    return rendererPublic
  }
  const pub = path.join(projectDir, 'public')
  fs.mkdirSync(pub, { recursive: true })
  return pub
}

function addDecapCms(projectDir: string, framework: ScaffoldOptions['framework']) {
  // Decap CMS is a static admin page committed with the site; works with any framework
  const publicRoot = publicDirFor(projectDir, framework)
  const adminDir = path.join(publicRoot, 'admin')
  fs.mkdirSync(adminDir, { recursive: true })
  fs.writeFileSync(
    path.join(adminDir, 'index.html'),
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Content Manager</title>
  </head>
  <body>
    <script src="https://unpkg.com/decap-cms@^3.0.0/dist/decap-cms.js"></script>
  </body>
</html>
`,
    'utf-8',
  )
  fs.writeFileSync(
    path.join(adminDir, 'config.yml'),
    `backend:
  name: git-gateway
  branch: main

media_folder: "public/uploads"
public_folder: "/uploads"

collections:
  - name: "posts"
    label: "Posts"
    folder: "content/posts"
    create: true
    slug: "{{slug}}"
    fields:
      - { label: "Title", name: "title", widget: "string" }
      - { label: "Publish Date", name: "date", widget: "datetime" }
      - { label: "Body", name: "body", widget: "markdown" }
`,
    'utf-8',
  )
  fs.mkdirSync(path.join(projectDir, 'content', 'posts'), { recursive: true })
  log(`Added Decap CMS admin at /admin (public/admin) for ${framework}`, 'sys')
}

function patchPackageScripts(projectDir: string, scripts: Record<string, string>) {
  const pkgPath = path.join(projectDir, 'package.json')
  if (!fs.existsSync(pkgPath)) return
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  pkg.scripts = { ...(pkg.scripts ?? {}), ...scripts }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8')
}

async function applyPrettier(projectDir: string): Promise<number> {
  const code = await run('npm install -D prettier', projectDir)
  if (code !== 0) return code
  fs.writeFileSync(
    path.join(projectDir, '.prettierrc'),
    JSON.stringify({ semi: false, singleQuote: true, trailingComma: 'all' }, null, 2),
    'utf-8',
  )
  patchPackageScripts(projectDir, { format: 'prettier --write .' })
  return 0
}

async function applyEslint(projectDir: string, opts: ScaffoldOptions): Promise<number> {
  if (opts.framework === 'vite-vue') {
    const code = await run(
      'npm install -D eslint @eslint/js typescript-eslint eslint-plugin-vue vue-eslint-parser globals',
      projectDir,
    )
    if (code !== 0) return code
    fs.writeFileSync(
      path.join(projectDir, 'eslint.config.js'),
      `import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  ...tseslint.configs.recommended,
  { languageOptions: { globals: globals.browser } },
)
`,
      'utf-8',
    )
  } else {
    const code = await run(
      'npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals',
      projectDir,
    )
    if (code !== 0) return code
    fs.writeFileSync(
      path.join(projectDir, 'eslint.config.js'),
      `import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
)
`,
      'utf-8',
    )
  }
  patchPackageScripts(projectDir, { lint: 'eslint .' })
  return 0
}

async function applyVitest(projectDir: string, opts: ScaffoldOptions): Promise<number> {
  if (opts.framework === 'vite-vue') {
    const code = await run('npm install -D vitest @vue/test-utils jsdom', projectDir)
    if (code !== 0) return code
  } else if (opts.framework === 'vite-vanilla') {
    const code = await run('npm install -D vitest jsdom', projectDir)
    if (code !== 0) return code
  } else if (opts.framework === 'vite-react' || opts.framework === 'next' || opts.framework === 'electron') {
    const code = await run(
      'npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom',
      projectDir,
    )
    if (code !== 0) return code
  } else {
    return 0
  }

  fs.writeFileSync(
    path.join(projectDir, 'vitest.config.ts'),
    `import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
`,
    'utf-8',
  )
  patchPackageScripts(projectDir, { test: 'vitest', 'test:ui': 'vitest --ui' })
  return 0
}

async function applyPlugin(projectDir: string, id: ScaffoldPluginId, opts: ScaffoldOptions): Promise<number> {
  switch (id) {
    case 'prettier':
      return applyPrettier(projectDir)
    case 'eslint':
      return applyEslint(projectDir, opts)
    case 'vitest':
      return applyVitest(projectDir, opts)
    case 'react-router':
      return run('npm install react-router-dom', projectDir)
    case 'pinia':
      return run('npm install pinia', projectDir)
    case 'lucide':
      if (opts.framework === 'vite-vue') return run('npm install lucide-vue-next', projectDir)
      return run('npm install lucide-react', projectDir)
    case 'zustand':
      return run('npm install zustand', projectDir)
    case 'tanstack-query':
      return run('npm install @tanstack/react-query', projectDir)
    default:
      return 0
  }
}

async function applyPlugins(projectDir: string, opts: ScaffoldOptions): Promise<string | null> {
  const plugins = normalizePlugins(opts.plugins ?? [], opts)
  for (const id of plugins) {
    log(`Installing add-on: ${id}...`, 'sys')
    const code = await applyPlugin(projectDir, id, opts)
    if (code !== 0) return `Add-on "${id}" setup exited with code ${code}`
    log(`Add-on ready: ${id}`, 'sys')
  }
  return null
}

async function scaffold(opts: ScaffoldOptions): Promise<ScaffoldResult> {
  if (isGuestAccess()) return { ok: false, error: GUEST_ACTION_ERROR }
  const limits = getEnforcedEntitlements()
  if (store.getProjects().length >= limits.maxProjects) {
    return {
      ok: false,
      error: `Free plan is limited to ${limits.maxProjects} projects. Upgrade on the DevTune website to create more.`,
    }
  }
  if (opts.cms !== 'none' && !limits.premiumTemplates) {
    return {
      ok: false,
      error: 'CMS project templates (Payload, Strapi, Decap) require a Pro license or an active trial.',
    }
  }

  const projectDir = path.join(opts.parentDir, opts.name)
  if (fs.existsSync(projectDir)) {
    return { ok: false, error: `Folder already exists: ${projectDir}` }
  }
  fs.mkdirSync(opts.parentDir, { recursive: true })

  scaffoldCancelled = false
  scaffoldInProgress = true
  let imported = false

  try {
    if (opts.cms === 'payload') {
      log('Stage 1/4: Scaffolding Payload CMS project...', 'sys')
      // Payload is a code-first CMS embedded in its own Next.js app (TypeScript only)
      const code = await run(
        `npx --yes create-payload-app@latest -n "${opts.name}" -t blank --db sqlite --use-npm -y`,
        opts.parentDir,
      )
      {
        const fail = runFailure(
          code,
          'create-payload-app opened an interactive prompt. Update DevFlow or run the command manually.',
          `create-payload-app exited with code ${code}`,
        )
        if (fail) return fail
      }
    } else if (opts.cms === 'strapi') {
      log('Stage 1/4: Scaffolding Strapi CMS project...', 'sys')
      // Strapi is a standalone headless CMS service (default port 1337)
      const lang = opts.typescript ? '--typescript' : '--javascript'
      const code = await run(
        `npx --yes create-strapi-app@latest "${opts.name}" --quickstart --no-run --skip-cloud --use-npm ${lang}`,
        opts.parentDir,
      )
      {
        const fail = runFailure(
          code,
          'create-strapi-app opened an interactive prompt. Update DevFlow or run the command manually.',
          `create-strapi-app exited with code ${code}`,
        )
        if (fail) return fail
      }
    } else if (opts.framework === 'next') {
      log('Stage 1/4: Scaffolding Next.js project...', 'sys')
      const flags = [
        opts.typescript ? '--typescript' : '--javascript',
        opts.tailwind ? '--tailwind' : '--no-tailwind',
        '--eslint',
        '--app',
        '--no-src-dir',
        '--import-alias "@/*"',
        '--use-npm',
        '--yes',
      ].join(' ')
      const code = await run(`npx --yes create-next-app@latest "${opts.name}" ${flags}`, opts.parentDir)
      {
        const fail = runFailure(
          code,
          'create-next-app opened an interactive prompt. Update DevFlow or run the command manually.',
          `create-next-app exited with code ${code}`,
        )
        if (fail) return fail
      }
    } else if (opts.framework === 'electron') {
      log('Stage 1/4: Scaffolding Electron project...', 'sys')
      const template = opts.typescript ? 'react-ts' : 'react'
      // npm create passes flags reliably; --skip disables updater/mirror prompts.
      let code = await run(
        `npm create @quick-start/electron@latest "${opts.name}" -- --template ${template} --skip`,
        opts.parentDir,
      )
      {
        const fail = runFailure(
          code,
          'create-electron opened an interactive prompt (framework/updater/mirror). Update DevFlow or run: npm create @quick-start/electron@latest <name> -- --template react-ts --skip',
          `create-electron exited with code ${code}`,
        )
        if (fail) return fail
      }
      log('Stage 2/4: Installing dependencies...', 'sys')
      code = await run('npm install', projectDir)
      {
        const fail = runFailure(code, 'npm install was interrupted.', `npm install exited with code ${code}`)
        if (fail) return fail
      }
      if (opts.tailwind) {
        code = await run('npm install tailwindcss @tailwindcss/vite', projectDir)
        {
          const fail = runFailure(code, 'tailwind install was interrupted.', `tailwind install exited with code ${code}`)
          if (fail) return fail
        }
        addTailwindToElectron(projectDir)
      }
    } else {
      log('Stage 1/4: Scaffolding Vite project...', 'sys')
      const template =
        opts.framework === 'vite-react'
          ? opts.typescript ? 'react-ts' : 'react'
          : opts.framework === 'vite-vue'
            ? opts.typescript ? 'vue-ts' : 'vue'
            : opts.typescript ? 'vanilla-ts' : 'vanilla'
      let code = await run(`npm create vite@latest "${opts.name}" -- --template ${template}`, opts.parentDir)
      {
        const fail = runFailure(
          code,
          'create-vite opened an interactive prompt. Update DevFlow or run the command manually.',
          `create-vite exited with code ${code}`,
        )
        if (fail) return fail
      }
      log('Stage 2/4: Installing dependencies...', 'sys')
      code = await run('npm install', projectDir)
      {
        const fail = runFailure(code, 'npm install was interrupted.', `npm install exited with code ${code}`)
        if (fail) return fail
      }
      if (opts.tailwind) {
        code = await run('npm install tailwindcss @tailwindcss/vite', projectDir)
        {
          const fail = runFailure(code, 'tailwind install was interrupted.', `tailwind install exited with code ${code}`)
          if (fail) return fail
        }
        addTailwindToVite(projectDir)
      }
    }
    if (opts.cms === 'decap') {
      log('Stage 3/4: Adding Decap CMS files...', 'sys')
      addDecapCms(projectDir, opts.framework)
    }

    log('Stage 3/4: Installing add-ons...', 'sys')
    const pluginErr = await applyPlugins(projectDir, opts)
    if (pluginErr) return { ok: false, error: pluginErr }
    if (scaffoldWasCancelled()) return cancelledResult()
  } catch (err) {
    if (scaffoldWasCancelled()) return cancelledResult()
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    scaffoldInProgress = false
    activeScaffoldChild = null
    if (scaffoldWasCancelled() && !imported) cleanupPartialProject(projectDir)
  }

  log('Stage 4/4: Importing project into DevFlow...', 'sys')
  const importResult = importProjectFromPath(projectDir)
  if (!importResult.ok || !importResult.project) return { ok: false, error: importResult.error }
  imported = true
  if (opts.preferredPort) {
    store.updateProject(importResult.project.id, { preferredPort: opts.preferredPort })
  }
  log('Done.', 'sys')
  return { ok: true, project: store.getProject(importResult.project.id) }
}

export function registerScaffoldHandlers() {
  ipcMain.handle('scaffold:create', (_e, opts: ScaffoldOptions) => scaffold(opts))
  ipcMain.handle('scaffold:cancel', () => {
    if (!scaffoldInProgress) return { ok: false }
    log('Installation cancelled by user.', 'sys')
    cancelActiveScaffold()
    return { ok: true }
  })
}
