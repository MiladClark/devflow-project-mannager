import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { BuildHealthIssue } from '../../src/shared/types'
import type { RawBuildDetection } from './buildDetect'

function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(cmd, ['--version'], { windowsHide: true, shell: true, timeout: 8000 }, (err) => resolve(!err))
  })
}

/** Computes the spec's Ready/Warning/Needs Attention/Blocked health report for a detected project. */
export async function computeHealth(detection: RawBuildDetection): Promise<BuildHealthIssue[]> {
  const issues: BuildHealthIssue[] = []
  const dir = detection.projectPath

  if (!detection.buildCommand) {
    issues.push({
      id: 'no-build-script',
      status: 'blocked',
      title: 'No build script detected',
      detail: 'This project has no "build" script in package.json.',
      fixHint: 'Add a build script to package.json, e.g. "build": "vite build".',
    })
  }

  const nodeOk = await commandExists('node')
  if (!nodeOk) {
    issues.push({
      id: 'node-missing',
      status: 'blocked',
      title: 'Node.js is not installed',
      detail: 'Node.js is required to install dependencies and run the build command.',
      fixHint: 'Install Node.js from App and Tools, then retry.',
    })
  }

  if (detection.packageManager !== 'npm') {
    const pmOk = await commandExists(detection.packageManager)
    if (!pmOk) {
      issues.push({
        id: 'pm-missing',
        status: 'blocked',
        title: `${detection.packageManager} is not installed`,
        detail: `This project uses ${detection.packageManager}, but it isn't installed.`,
        fixHint: `Install ${detection.packageManager} from App and Tools, then retry.`,
      })
    }
  }

  const depsInstalled = fs.existsSync(path.join(dir, 'node_modules'))
  if (!depsInstalled) {
    issues.push({
      id: 'deps-missing',
      status: 'warning',
      title: 'Dependencies are not installed',
      detail: 'node_modules was not found. Build & Setup can install them automatically before building.',
      fixHint: 'Enable "Install dependencies before build" in Build Configuration.',
    })
  }

  if (!detection.hasIconAsset) {
    issues.push({
      id: 'no-icon',
      status: 'warning',
      title: 'No custom app icon was found',
      detail: 'A default icon will be used for the packaged application and installer.',
      fixHint: 'Add an icon under build/icon.ico, public/icon.png, or assets/icon.png.',
    })
  }

  const outputAbs = path.join(dir, detection.outputDir)
  if (!fs.existsSync(outputAbs)) {
    issues.push({
      id: 'output-missing',
      status: 'warning',
      title: 'Build output directory is missing',
      detail: `"${detection.outputDir}" does not exist yet — it will be created by the build.`,
    })
  }

  if (detection.isElectron && !detection.electronVersion) {
    issues.push({
      id: 'electron-version-unknown',
      status: 'needs-attention',
      title: 'Could not determine the Electron version',
      detail: 'Electron was detected but no version could be read from package.json dependencies.',
      fixHint: 'Ensure "electron" is listed in dependencies or devDependencies with a version.',
    })
  }

  if (issues.length === 0) {
    issues.push({
      id: 'ready',
      status: 'ready',
      title: 'Build scripts and dependencies are correctly configured',
      detail: 'This project looks ready to build.',
    })
  }

  return issues
}

/** Worst status across a health report, for the summary badge. */
export function worstHealthStatus(issues: BuildHealthIssue[]): BuildHealthIssue['status'] {
  const order: BuildHealthIssue['status'][] = ['blocked', 'needs-attention', 'warning', 'ready']
  for (const s of order) {
    if (issues.some((i) => i.status === s)) return s
  }
  return 'ready'
}
