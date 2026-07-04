import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { ScaffoldOptions, ScaffoldResult } from '../../src/shared/types'
import { store } from '../lib/store'
import { importProjectFromPath } from './projects'

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

function addTailwindToVite(projectDir: string) {
  // patch vite config
  for (const name of ['vite.config.ts', 'vite.config.js']) {
    const cfgPath = path.join(projectDir, name)
    if (!fs.existsSync(cfgPath)) continue
    let cfg = fs.readFileSync(cfgPath, 'utf-8')
    if (!cfg.includes('@tailwindcss/vite')) {
      cfg = `import tailwindcss from '@tailwindcss/vite'\n` + cfg
      cfg = cfg.replace(/plugins:\s*\[/, 'plugins: [tailwindcss(), ')
      fs.writeFileSync(cfgPath, cfg, 'utf-8')
      log(`Patched ${name} with Tailwind plugin`, 'sys')
    }
    break
  }
  // prepend tailwind import to the main stylesheet
  for (const rel of ['src/index.css', 'src/style.css', 'src/assets/main.css']) {
    const cssPath = path.join(projectDir, rel)
    if (!fs.existsSync(cssPath)) continue
    const css = fs.readFileSync(cssPath, 'utf-8')
    if (!css.includes('@import "tailwindcss"')) {
      fs.writeFileSync(cssPath, `@import "tailwindcss";\n\n` + css, 'utf-8')
      log(`Added Tailwind import to ${rel}`, 'sys')
    }
    break
  }
}

function addDecapCms(projectDir: string, framework: ScaffoldOptions['framework']) {
  // Decap CMS is a static admin page committed with the site; works with any framework
  const adminDir = path.join(projectDir, 'public', 'admin')
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

async function scaffold(opts: ScaffoldOptions): Promise<ScaffoldResult> {
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
