import type { Framework } from '../../src/shared/types'

export interface PackageJsonLike {
  name?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  engines?: { node?: string }
}

export interface FrameworkSniffResult {
  framework: Framework
  frameworks: string[]
  defaultPort: number
  outputDir: string
}

/** Dependency-based framework detection shared by project import (detect.ts) and Build & Setup (buildDetect.ts). */
export function sniffFramework(pkg: PackageJsonLike): FrameworkSniffResult {
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
  } else if (deps['electron']) {
    framework = 'electron'
    frameworks.push('Electron')
    defaultPort = 5173
    outputDir = 'out'
    if (deps['react']) frameworks.push('React')
    if (deps['vite']) frameworks.push('Vite')
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

  return { framework, frameworks: [...new Set(frameworks)], defaultPort, outputDir }
}
