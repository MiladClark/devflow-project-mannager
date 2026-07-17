/**
 * Build multi-size build/icon.ico + build/icon.png from company assets:
 *   roadmap-and-design/icon.ico                          (32×32)
 *   roadmap-and-design/devtune-logo-gradient-blue-bg-white.ico (256×256)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import decodeIco from 'decode-ico'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'
import png2icons from 'png2icons'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ico32 = path.join(root, 'build', 'icon.ico')
const ico256 = path.join(root, 'build', 'devtune-logo-gradient-blue-bg-white.ico')
const buildDir = path.join(root, 'build')
const outIco = path.join(buildDir, 'icon.ico')
const outPng = path.join(buildDir, 'icon.png')
const outIcns = path.join(buildDir, 'icon.icns')

if (!existsSync(ico32)) {
  console.error('Missing 32px icon:', ico32)
  process.exit(1)
}
if (!existsSync(ico256)) {
  console.error('Missing 256px icon:', ico256)
  process.exit(1)
}

/** @param {import('decode-ico').ImageData} img */
async function imageDataToPng(img) {
  if (img.type === 'png') {
    return Buffer.from(img.data)
  }
  return sharp(Buffer.from(img.data), {
    raw: { width: img.width, height: img.height, channels: 4 },
  })
    .png()
    .toBuffer()
}

function pickSize(images, size) {
  return images.find((img) => img.width === size) ?? images[0]
}

const png32src = await imageDataToPng(pickSize(decodeIco(readFileSync(ico32)), 32))
const png256src = await imageDataToPng(pickSize(decodeIco(readFileSync(ico256)), 256))

writeFileSync(outPng, png256src)

// Windows taskbar / shell DPI ladder (Electron nativeImage docs)
const sizes = [16, 20, 24, 32, 40, 48, 64, 256]
const pngBuffers = await Promise.all(
  sizes.map((size) => {
    if (size === 256) return png256src
    if (size === 32) return png32src
    return sharp(png32src)
      .resize(size, size, { kernel: size <= 32 ? 'nearest' : 'lanczos3' })
      .png()
      .toBuffer()
  }),
)

mkdirSync(buildDir, { recursive: true })
writeFileSync(outIco, await pngToIco(pngBuffers))

// .icns for the macOS build (electron-builder mac.icon). Pure-JS generator so
// this runs on the Windows dev machine too — no iconutil/macOS dependency.
// Source is only 256×256; png2icons upscales internally for the larger
// (512/1024) slots it embeds, so this is lower-fidelity than true 1024px art
// but keeps a single source-of-truth icon.
const icnsBuffer = png2icons.createICNS(png256src, png2icons.BICUBIC2, 0)
if (!icnsBuffer) {
  console.error('Failed to generate icon.icns from icon.png')
  process.exit(1)
}
writeFileSync(outIcns, icnsBuffer)

console.log(
  `Prepared ${outIco}, ${outIcns} (${sizes.join(', ')}) and ${outPng} from icon.ico + devtune-logo-gradient-blue-bg-white.ico`,
)
