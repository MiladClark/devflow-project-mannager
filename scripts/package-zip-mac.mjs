/**
 * Locate the .zip electron-builder produced for the current mac build
 * (`electron-builder --mac --x64` or `--arm64`, per electron-builder.yml's
 * `mac.target: zip` + `artifactName`) and write a manifest.json alongside it
 * in the same shape as package-zip.mjs, so the release pipeline can treat
 * both platforms uniformly (version, fileName, sha256, sizeBytes, releasedAt, zipPath).
 *
 * Usage:
 *   node scripts/package-zip-mac.mjs [--arch x64|arm64] [--out-dir path]
 */
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = path.join(root, 'release')

const args = process.argv.slice(2)
function arg(name, fallback) {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const arch = arg('--arch', process.arch)
const outDir = path.resolve(arg('--out-dir', releaseDir))

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = pkg.version
const fileName = `${pkg.name}-${version}-${arch}.zip`
const zipPath = path.join(releaseDir, fileName)

if (!existsSync(zipPath)) {
  console.error(`Missing built zip: ${zipPath} — run electron-builder --mac --${arch} first.`)
  process.exit(1)
}

const hash = createHash('sha256')
await new Promise((resolve, reject) => {
  createReadStream(zipPath)
    .on('data', (c) => hash.update(c))
    .on('end', () => resolve())
    .on('error', reject)
})

const size = statSync(zipPath).size
const sha256 = hash.digest('hex')
const manifest = {
  version,
  fileName,
  sha256,
  sizeBytes: size,
  releasedAt: new Date().toISOString(),
  zipPath,
  platform: 'macos',
  arch,
}

writeFileSync(path.join(outDir, `manifest-mac-${arch}.json`), JSON.stringify(manifest, null, 2))

console.log('')
console.log('macOS release zip ready:')
console.log(`  file:     ${zipPath}`)
console.log(`  size:     ${(size / 1024 / 1024).toFixed(2)} MB (${size} bytes)`)
console.log(`  sha256:   ${sha256}`)
console.log(JSON.stringify(manifest))
