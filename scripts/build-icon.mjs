/**
 * Build a multi-resolution Windows .ico for electron-builder exe embed + runtime tray.
 * Prefers roadmap-and-design/icon.png (512px); falls back to build/icon.png.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import toIco from 'to-ico'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const buildDir = path.join(root, 'build')
const outPath = path.join(buildDir, 'icon.ico')

const pngCandidates = [
  path.join(root, 'roadmap-and-design', 'icon.png'),
  path.join(root, 'build', 'icon.png'),
]

const srcPng = pngCandidates.find((p) => existsSync(p))
if (!srcPng) {
  const fallbackIco = path.join(root, 'roadmap-and-design', 'icon.ico')
  if (!existsSync(fallbackIco)) {
    console.error('Missing icon source: add roadmap-and-design/icon.png or icon.ico')
    process.exit(1)
  }
  mkdirSync(buildDir, { recursive: true })
  writeFileSync(outPath, readFileSync(fallbackIco))
  console.warn('Warning: using single-size icon.ico — add icon.png for best taskbar/exe icons')
  process.exit(0)
}

const sizes = [16, 32, 48, 256]
const source = readFileSync(srcPng)
const pngBuffers = await Promise.all(
  sizes.map((size) => sharp(source).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()),
)

mkdirSync(buildDir, { recursive: true })
writeFileSync(outPath, await toIco(pngBuffers))

const meta = await sharp(srcPng).metadata()
console.log(`Built ${outPath} (${sizes.join(', ')}px) from ${path.relative(root, srcPng)} (${meta.width}x${meta.height})`)
