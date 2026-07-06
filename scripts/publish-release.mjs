/**
 * Build, zip, update README, push to devflow-app-updates, create GitHub Release, register in DevTune.
 *
 * Usage:
 *   node scripts/publish-release.mjs --notes "Release notes"
 *   node scripts/publish-release.mjs --skip-build --skip-gh --skip-devtune
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const updatesRepo = path.resolve(root, '..', 'devflow-app-updates', 'devflow-app-updates')
const devtuneRoot = path.resolve(root, '..', 'devtune-website')
const ghRepo = 'MiladClark/devflow-app-updates'

const args = process.argv.slice(2)
const skipBuild = args.includes('--skip-build')
const skipGh = args.includes('--skip-gh')
const skipDevtune = args.includes('--skip-devtune')
const notesIdx = args.indexOf('--notes')
const releaseNotes =
  notesIdx >= 0 && args[notesIdx + 1]
    ? args[notesIdx + 1]
    : 'DevFlow Manager release'

function run(cmd, cmdArgs, opts = {}) {
  const useShell = opts.shell ?? process.platform === 'win32'
  const r = spawnSync(cmd, cmdArgs, {
    stdio: 'inherit',
    shell: useShell,
    cwd: opts.cwd ?? root,
    env: process.env,
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'))
}

const pkg = readJson(path.join(root, 'package.json'))
const version = pkg.version
const tag = `v${version}`

// sync version.ts
writeFileSync(path.join(root, 'src', 'version.ts'), `export const APP_VERSION = '${version}'\n`)

if (!skipBuild) {
  console.log('=== Building portable app ===')
  run('npm', ['run', 'package'])
}

console.log('=== Creating zip ===')
run('node', ['scripts/package-zip.mjs', '--out-dir', path.join(updatesRepo, '.staging')])

const manifest = readJson(path.join(updatesRepo, '.staging', 'manifest.json'))
const zipPath = manifest.zipPath
const downloadFileName = manifest.fileName
const ghUrl = `https://github.com/${ghRepo}/releases/download/${tag}/${downloadFileName}`

// Update README table
const readmePath = path.join(updatesRepo, 'README.md')
let readme = readFileSync(readmePath, 'utf8')
const dateStr = new Date().toISOString().slice(0, 10)
const row = `| ${version} | ${dateStr} | \`${manifest.sha256.slice(0, 16)}…\` | [zip](${ghUrl}) |`
readme = readme.replace('| _No releases yet_ | | | |', row)
if (!readme.includes(row)) {
  readme = readme.replace(
    /(\| Version \| Date \| SHA256 \| Download \|\n\|[-| ]+\|\n)/,
    `$1${row}\n`,
  )
}
writeFileSync(readmePath, readme)

if (!skipGh) {
  console.log('=== Git commit + push (devflow-app-updates only) ===')
  run('git', ['add', 'README.md', '.gitignore'], { cwd: updatesRepo, shell: false })
  run('git', ['commit', '-m', `docs: release ${tag} README`], { cwd: updatesRepo, shell: false })
  run('git', ['push', 'origin', 'main'], { cwd: updatesRepo, shell: false })

  console.log('=== GitHub Release ===')
  const ghCmd = spawnSync('gh', ['--version'], { shell: true, encoding: 'utf8' })
  if (ghCmd.status === 0) {
    run(
      'gh',
      ['release', 'create', tag, zipPath, '--repo', ghRepo, '--title', `DevFlow Manager ${tag}`, '--notes', releaseNotes],
      { cwd: updatesRepo, shell: false },
    )
  } else {
    run(
      'node',
      [
        'scripts/upload-github-release.mjs',
        '--repo',
        ghRepo,
        '--tag',
        tag,
        '--title',
        `DevFlow Manager ${tag}`,
        '--notes',
        releaseNotes,
        '--asset',
        zipPath,
      ],
      { cwd: root },
    )
  }
}

if (!skipDevtune) {
  console.log('=== Register in DevTune ===')
  run(
    'node',
    [
      'scripts/register-release.mjs',
      '--version',
      version,
      '--url',
      ghUrl,
      '--checksum',
      manifest.sha256,
      '--size',
      String(manifest.sizeBytes),
      '--notes',
      releaseNotes,
    ],
    { cwd: devtuneRoot },
  )
}

console.log('')
console.log('=== Release complete ===')
console.log(`  version:  ${version}`)
console.log(`  tag:      ${tag}`)
console.log(`  url:      ${ghUrl}`)
console.log(`  sha256:   ${manifest.sha256}`)
console.log(`  size:     ${manifest.sizeBytes} bytes`)
