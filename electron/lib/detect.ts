import fs from 'node:fs'
import path from 'node:path'
import type { Framework, Project } from '../../src/shared/types'
import { newId } from './store'

interface PackageJson {
  name?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

export function detectProject(dir: string): Project | { error: string } {
  const pkgPath = path.join(dir, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    return { error: 'No package.json found in the selected folder.' }
  }
  let pkg: PackageJson
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  } catch {
    return { error: 'package.json could not be parsed.' }
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  const frameworks: string[] = []
  let framework: Framework = 'unknown'
  let defaultPort = 3000
  let outputDir = 'dist'

  if (deps['payload']) {
    framework = 'next'
    frameworks.push('Next.js', 'Payload CMS')
    defaultPort = 3000
    outputDir = '.next'
  } else if (deps['@strapi/strapi']) {
    framework = 'node'
    frameworks.push('Strapi')
    defaultPort = 1337
    outputDir = 'dist'
  } else if (deps['next']) {
    framework = 'next'
    frameworks.push('Next.js')
    defaultPort = 3000
    outputDir = '.next'
  } else if (deps['vite']) {
    framework = 'vite'
    frameworks.push('Vite')
    defaultPort = 5173
    outputDir = 'dist'
  } else if (deps['react-scripts']) {
    framework = 'react'
    frameworks.push('React (CRA)')
    defaultPort = 3000
    outputDir = 'build'
  } else if (deps['react']) {
    framework = 'react'
    frameworks.push('React')
  } else if (deps['vue']) {
    framework = 'vue'
    frameworks.push('Vue.js')
  } else if (pkg.scripts?.dev || pkg.scripts?.start) {
    framework = 'node'
    frameworks.push('Node')
  }

  if (deps['react'] && framework !== 'react') frameworks.push('React')
  if (deps['vue'] && framework !== 'vue') frameworks.push('Vue.js')
  if (deps['tailwindcss']) {
    frameworks.push('Tailwind')
    if (framework === 'unknown') framework = 'tailwind'
  }
  if (framework === 'unknown' && frameworks.length === 0) frameworks.push('Unknown')

  const scripts = pkg.scripts ?? {}
  // Strapi uses `develop` as its dev script
  const runCommand = scripts.dev
    ? 'npm run dev'
    : scripts.develop
      ? 'npm run develop'
      : scripts.start
        ? 'npm start'
        : ''
  const buildCommand = scripts.build ? 'npm run build' : ''

  return {
    id: newId(),
    name: pkg.name || path.basename(dir),
    path: dir,
    framework,
    frameworks,
    runCommand,
    buildCommand,
    outputDir,
    defaultPort,
    env: {},
    createdAt: Date.now(),
  }
}
