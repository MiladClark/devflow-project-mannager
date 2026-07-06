import { createHash } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const devflowDir = path.join(root, 'devflow')

const args = process.argv.slice(2)
function arg(name, fallback) {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const defaultOutDir = path.resolve(root, '..', 'devflow-app-updates', 'devflow-app-updates', '.staging')
const outDir = path.resolve(
  arg('--out-dir', process.env.UPDATES_REPO ? path.join(process.env.UPDATES_REPO, '.staging') : defaultOutDir),
)

if (!existsSync(devflowDir)) {
  console.error('Missing devflow/ — run npm run package first.')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = pkg.version
const outName = `devflow-${version}-win-x64.zip`
const outPath = path.join(outDir, outName)

const ps = spawnSync(
  'powershell',
  [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${devflowDir.replace(/'/g, "''")}\\*' -DestinationPath '${outPath.replace(/'/g, "''")}' -Force`,
  ],
  { stdio: 'inherit', shell: true },
)

if (ps.status !== 0) process.exit(ps.status ?? 1)

const hash = createHash('sha256')
await new Promise((resolve, reject) => {
  createReadStream(outPath)
    .on('data', (c) => hash.update(c))
    .on('end', () => resolve())
    .on('error', reject)
})

const size = statSync(outPath).size
const sha256 = hash.digest('hex')
const manifest = {
  version,
  fileName: outName,
  sha256,
  sizeBytes: size,
  releasedAt: new Date().toISOString(),
  zipPath: outPath,
}

writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

console.log('')
console.log('Release zip ready:')
console.log(`  file:     ${outPath}`)
console.log(`  size:     ${(size / 1024 / 1024).toFixed(2)} MB (${size} bytes)`)
console.log(`  sha256:   ${sha256}`)
console.log(JSON.stringify(manifest))
