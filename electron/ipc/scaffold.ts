import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { ScaffoldOptions, ScaffoldResult } from '../../src/shared/types'
import { normalizePlugins, type ScaffoldPluginId } from '../../src/shared/scaffoldPlugins'
import { store } from '../lib/store'
import { importProjectFromPath } from './projects'
import { getEnforcedEntitlements } from '../lib/licensing'

function broadcast(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel, ...args)
}

function log(text: string, stream: 'out' | 'err' | 'sys' = 'out') {
  broadcast('scaffold:log', { ts: Date.now(), stream, text })
}

function run(cmd: string, cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    log(`$ ${cmd}`, 'sys')
    const child = spawn(cmd, {
      cwd,
      shell: true,
      windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', CI: 'true' },
    })
    child.stdout?.on('data', (c: Buffer) => log(c.toString().trim()))
    child.stderr?.on('data', (c: Buffer) => log(c.toString().trim(), 'err'))
    child.on('error', reject)
    child.on('exit', (code) => resolve(code ?? 1))
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

  try {
    if (opts.cms === 'payload') {
      // Payload is a code-first CMS embedded in its own Next.js app (TypeScript only)
      const code = await run(
        `npx --yes create-payload-app@latest -n "${opts.name}" -t blank --db sqlite --use-npm -y`,
        opts.parentDir,
      )
      if (code !== 0) return { ok: false, error: `create-payload-app exited with code ${code}` }
    } else if (opts.cms === 'strapi') {
      // Strapi is a standalone headless CMS service (default port 1337)
      const lang = opts.typescript ? '--typescript' : '--javascript'
      const code = await run(
        `npx --yes create-strapi-app@latest "${opts.name}" --quickstart --no-run --skip-cloud --use-npm ${lang}`,
        opts.parentDir,
      )
      if (code !== 0) return { ok: false, error: `create-strapi-app exited with code ${code}` }
    } else if (opts.framework === 'next') {
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
      if (code !== 0) return { ok: false, error: `create-next-app exited with code ${code}` }
    } else if (opts.framework === 'electron') {
      const template = opts.typescript ? 'react-ts' : 'react'
      let code = await run(
        `npx --yes @quick-start/create-electron@latest "${opts.name}" -- --template ${template}`,
        opts.parentDir,
      )
      if (code !== 0) return { ok: false, error: `create-electron exited with code ${code}` }
      if (opts.tailwind) {
        code = await run('npm install tailwindcss @tailwindcss/vite', projectDir)
        if (code !== 0) return { ok: false, error: `tailwind install exited with code ${code}` }
        addTailwindToElectron(projectDir)
      }
    } else {
      const template =
        opts.framework === 'vite-react'
          ? opts.typescript ? 'react-ts' : 'react'
          : opts.framework === 'vite-vue'
            ? opts.typescript ? 'vue-ts' : 'vue'
            : opts.typescript ? 'vanilla-ts' : 'vanilla'
      let code = await run(`npm create vite@latest "${opts.name}" -- --template ${template}`, opts.parentDir)
      if (code !== 0) return { ok: false, error: `create-vite exited with code ${code}` }
      code = await run('npm install', projectDir)
      if (code !== 0) return { ok: false, error: `npm install exited with code ${code}` }
      if (opts.tailwind) {
        code = await run('npm install tailwindcss @tailwindcss/vite', projectDir)
        if (code !== 0) return { ok: false, error: `tailwind install exited with code ${code}` }
        addTailwindToVite(projectDir)
      }
    }
    if (opts.cms === 'decap') {
      addDecapCms(projectDir, opts.framework)
    }

    const pluginErr = await applyPlugins(projectDir, opts)
    if (pluginErr) return { ok: false, error: pluginErr }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  log('Importing project...', 'sys')
  const imported = importProjectFromPath(projectDir)
  if (!imported.ok || !imported.project) return { ok: false, error: imported.error }
  if (opts.preferredPort) {
    store.updateProject(imported.project.id, { preferredPort: opts.preferredPort })
  }
  log('Done.', 'sys')
  return { ok: true, project: store.getProject(imported.project.id) }
}

export function registerScaffoldHandlers() {
  ipcMain.handle('scaffold:create', (_e, opts: ScaffoldOptions) => scaffold(opts))
}
