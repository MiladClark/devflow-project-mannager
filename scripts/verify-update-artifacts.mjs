/**
 * Fail a release before publication unless electron-builder produced a complete
 * NSIS auto-update bundle: channel manifest, installer, and differential blockmap.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)

function arg(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

function fail(message) {
  console.error(`Auto-update artifact verification failed: ${message}`)
  process.exit(1)
}

function unquote(value) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

const releaseDir = path.resolve(root, arg('--dir', 'release'))
const expectedVersion = String(arg('--version', '')).replace(/^v/i, '')
const packageVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
const version = expectedVersion || packageVersion
const channel = version.includes('-') ? version.split('-', 2)[1].split('.', 1)[0] : 'latest'
const manifestPath = path.join(releaseDir, `${channel}.yml`)

if (!existsSync(manifestPath)) fail(`missing ${path.basename(manifestPath)}`)
const manifest = readFileSync(manifestPath, 'utf8')
const manifestVersion = /^version:\s*([^\r\n]+)$/m.exec(manifest)?.[1]?.trim()
if (manifestVersion !== version) {
  fail(`manifest version ${manifestVersion || '(missing)'} does not match ${version}`)
}

const urlValue = /^\s*-?\s*url:\s*(.+)$/m.exec(manifest)?.[1]
if (!urlValue) fail('manifest does not contain files[].url')
const installerName = decodeURIComponent(unquote(urlValue))
if (!/\.exe$/i.test(installerName)) fail(`update target is not an NSIS installer: ${installerName}`)

const installerPath = path.join(releaseDir, installerName)
if (!existsSync(installerPath)) fail(`manifest target does not exist: ${installerName}`)
if (statSync(installerPath).size <= 0) fail(`installer is empty: ${installerName}`)

const sha512 = /^\s*sha512:\s*([^\r\n]+)$/m.exec(manifest)?.[1]?.trim()
if (!sha512 || !/^[A-Za-z0-9+/]{80,}={0,2}$/.test(sha512)) {
  fail('manifest is missing a base64 SHA-512 checksum')
}

const blockmapPath = `${installerPath}.blockmap`
if (!existsSync(blockmapPath)) fail(`missing differential blockmap: ${path.basename(blockmapPath)}`)
if (statSync(blockmapPath).size <= 0) fail(`blockmap is empty: ${path.basename(blockmapPath)}`)

console.log(`Verified ${path.basename(manifestPath)} -> ${installerName}`)
console.log(`Verified ${path.basename(blockmapPath)}`)
