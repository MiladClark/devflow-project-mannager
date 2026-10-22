/**
 * Start the one canonical release pipeline.
 *
 * The GitHub Actions tag workflow is the only publisher because it builds the
 * Setup installer, latest.yml, blockmap, portable ZIP, and DevTune records as
 * one release. Local ad-hoc uploads previously produced ZIP-only releases that
 * electron-updater could not install.
 *
 * Usage:
 *   npm run release:publish
 *   npm run release:publish -- --dry-run
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const tag = `v${pkg.version}`

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    if (options.capture) process.stderr.write(result.stderr || result.stdout || '')
    process.exit(result.status ?? 1)
  }
  return (result.stdout || '').trim()
}

const status = run('git', ['status', '--short'], { capture: true })
if (status) {
  console.error('Release aborted: commit all changes before publishing a version tag.')
  console.error(status)
  process.exit(1)
}

const existingTag = run('git', ['tag', '--list', tag], { capture: true })
if (existingTag) {
  console.error(`Release aborted: tag ${tag} already exists locally.`)
  process.exit(1)
}

console.log(`Release ${tag} will be built by .github/workflows/release.yml.`)
console.log('The workflow validates and publishes Setup, latest.yml, blockmap, and portable ZIP atomically.')
if (dryRun) {
  console.log('Dry run complete; no tag was created or pushed.')
  process.exit(0)
}

run('git', ['tag', '-a', tag, '-m', `DevFlow Manager ${tag}`])
run('git', ['push', 'origin', tag])
console.log(`Pushed ${tag}. Follow the Release workflow in GitHub Actions.`)
