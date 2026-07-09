/**
 * Authenticode signing for Windows release artifacts.
 *
 * Supports:
 *   1) Azure Trusted Signing  (recommended — no .pfx on disk)
 *   2) Classic PFX / P12 certificate file
 *
 * Returns:
 *   { mode: 'azure'|'pfx'|'skipped', signed: boolean, reason?: string }
 *
 * Env — Azure Trusted Signing:
 *   AZURE_TRUSTED_SIGNING_ENDPOINT          e.g. https://eus.codesigning.azure.net
 *   AZURE_TRUSTED_SIGNING_ACCOUNT           Code Signing account name
 *   AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE
 *   AZURE_CODE_SIGNING_DLIB                 optional full path to Azure.CodeSigning.Dlib.dll
 *   (Azure CLI / DefaultAzureCredential must be able to auth — az login or SP env vars)
 *
 * Env — PFX:
 *   WIN_CSC_LINK | CSC_LINK                 path to .pfx/.p12 (or base64 of the file)
 *   WIN_CSC_KEY_PASSWORD | CSC_KEY_PASSWORD
 *
 * Env — policy:
 *   SIGNING_REQUIRED=1                      fail the build if signing cannot run
 *   SIGNING_SKIP=1                          force skip (local/dev)
 */
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  writeFileSync,
  rmSync,
  unlinkSync,
} from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_TIMESTAMP = 'http://timestamp.acs.microsoft.com'
const FALLBACK_TIMESTAMP = 'http://timestamp.digicert.com'

function env(name, fallback = '') {
  const v = process.env[name]
  return v == null || v === '' ? fallback : v
}

function which(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
    encoding: 'utf8',
    shell: true,
  })
  if (r.status !== 0) return null
  return (r.stdout || '').split(/\r?\n/).map((s) => s.trim()).find(Boolean) || null
}

function findSigntool() {
  const fromEnv = env('SIGNTOOL_PATH')
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  const onPath = which('signtool')
  if (onPath) return onPath

  const kits = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Windows Kits', '10', 'bin')
  if (!existsSync(kits)) return null
  try {
    const versions = readdirSync(kits)
      .filter((d) => /^\d+\./.test(d))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    for (const ver of versions) {
      const candidate = path.join(kits, ver, 'x64', 'signtool.exe')
      if (existsSync(candidate)) return candidate
    }
  } catch {
    /* ignore */
  }
  return null
}

function findAzureDlib() {
  const fromEnv = env('AZURE_CODE_SIGNING_DLIB')
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const localAppData = process.env.LOCALAPPDATA || ''
  const candidates = [
    path.join(localAppData, 'Microsoft', 'MicrosoftTrustedSigningClientTools', 'Azure.CodeSigning.Dlib.dll'),
    path.join(root, 'tools', 'Azure.CodeSigning.Dlib.dll'),
    path.join(root, 'build', 'Azure.CodeSigning.Dlib.dll'),
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return null
}

function azureConfigured() {
  return !!(
    env('AZURE_TRUSTED_SIGNING_ENDPOINT') &&
    env('AZURE_TRUSTED_SIGNING_ACCOUNT') &&
    env('AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE')
  )
}

function pfxConfigured() {
  return !!(env('WIN_CSC_LINK') || env('CSC_LINK'))
}

function resolvePfxFile() {
  const link = env('WIN_CSC_LINK') || env('CSC_LINK')
  if (!link) return null
  if (existsSync(link)) return { path: link, cleanup: null }

  // electron-builder style: base64-encoded cert contents
  try {
    const buf = Buffer.from(link, 'base64')
    if (buf.length < 64) return null
    const dir = mkdtempSync(path.join(os.tmpdir(), 'devflow-csc-'))
    const pfxPath = path.join(dir, 'cert.pfx')
    writeFileSync(pfxPath, buf)
    return {
      path: pfxPath,
      cleanup: () => {
        try {
          unlinkSync(pfxPath)
          rmSync(dir, { recursive: true, force: true })
        } catch {
          /* ignore */
        }
      },
    }
  } catch {
    return null
  }
}

function runSigntool(signtool, args) {
  const r = spawnSync(signtool, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  })
  return r.status === 0
}

/**
 * Sign one or more Windows PE files in place.
 * @param {string|string[]} files
 * @param {{ required?: boolean }} [opts]
 */
export function signWindowsFiles(files, opts = {}) {
  const list = (Array.isArray(files) ? files : [files]).filter(Boolean)
  const required = opts.required ?? (env('SIGNING_REQUIRED') === '1' || env('SIGNING_REQUIRED') === 'true')

  if (env('SIGNING_SKIP') === '1' || env('SIGNING_SKIP') === 'true') {
    const msg = 'SIGNING_SKIP set — leaving artifacts unsigned'
    if (required) throw new Error(msg)
    console.warn(`⚠ ${msg}`)
    return { mode: 'skipped', signed: false, reason: msg }
  }

  if (list.length === 0) {
    return { mode: 'skipped', signed: false, reason: 'no files' }
  }
  for (const f of list) {
    if (!existsSync(f)) throw new Error(`Cannot sign missing file: ${f}`)
  }

  if (process.platform !== 'win32') {
    const msg = 'Code signing is only supported on Windows hosts'
    if (required) throw new Error(msg)
    console.warn(`⚠ ${msg}`)
    return { mode: 'skipped', signed: false, reason: msg }
  }

  const signtool = findSigntool()
  if (!signtool) {
    const msg =
      'signtool.exe not found. Install Windows SDK (Signing Tools) or set SIGNTOOL_PATH.'
    if (required) throw new Error(msg)
    console.warn(`⚠ ${msg}`)
    return { mode: 'skipped', signed: false, reason: msg }
  }

  const timestampUrl = env('SIGNING_TIMESTAMP_URL', DEFAULT_TIMESTAMP)

  if (azureConfigured()) {
    const dlib = findAzureDlib()
    if (!dlib) {
      const msg =
        'Azure Trusted Signing configured but Azure.CodeSigning.Dlib.dll not found. ' +
        'Install "Trusted Signing Client Tools" or set AZURE_CODE_SIGNING_DLIB.'
      if (required) throw new Error(msg)
      console.warn(`⚠ ${msg}`)
      return { mode: 'skipped', signed: false, reason: msg }
    }

    const metaDir = mkdtempSync(path.join(os.tmpdir(), 'devflow-ats-'))
    const metaPath = path.join(metaDir, 'trusted-signing.json')
    writeFileSync(
      metaPath,
      JSON.stringify(
        {
          Endpoint: env('AZURE_TRUSTED_SIGNING_ENDPOINT'),
          CodeSigningAccountName: env('AZURE_TRUSTED_SIGNING_ACCOUNT'),
          CertificateProfileName: env('AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE'),
        },
        null,
        2,
      ),
    )

    console.log(`→ Signing with Azure Trusted Signing (${list.length} file(s))`)
    console.log(`  account: ${env('AZURE_TRUSTED_SIGNING_ACCOUNT')}`)
    console.log(`  profile: ${env('AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE')}`)

    let ok = true
    for (const file of list) {
      const args = [
        'sign',
        '/v',
        '/fd',
        'SHA256',
        '/tr',
        timestampUrl,
        '/td',
        'SHA256',
        '/dlib',
        dlib,
        '/dmdf',
        metaPath,
        file,
      ]
      if (!runSigntool(signtool, args)) {
        if (timestampUrl !== FALLBACK_TIMESTAMP) {
          console.warn('  retrying with DigiCert timestamp…')
          const retry = [
            'sign',
            '/v',
            '/fd',
            'SHA256',
            '/tr',
            FALLBACK_TIMESTAMP,
            '/td',
            'SHA256',
            '/dlib',
            dlib,
            '/dmdf',
            metaPath,
            file,
          ]
          if (!runSigntool(signtool, retry)) ok = false
        } else {
          ok = false
        }
      }
    }

    try {
      rmSync(metaDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }

    if (!ok) {
      const msg = 'Azure Trusted Signing failed (signtool returned non-zero)'
      if (required) throw new Error(msg)
      console.warn(`⚠ ${msg}`)
      return { mode: 'azure', signed: false, reason: msg }
    }
    console.log('✓ Azure Trusted Signing complete')
    return { mode: 'azure', signed: true }
  }

  if (pfxConfigured()) {
    const pfx = resolvePfxFile()
    if (!pfx) {
      const msg = 'WIN_CSC_LINK / CSC_LINK set but file/base64 could not be resolved'
      if (required) throw new Error(msg)
      console.warn(`⚠ ${msg}`)
      return { mode: 'skipped', signed: false, reason: msg }
    }
    const password = env('WIN_CSC_KEY_PASSWORD') || env('CSC_KEY_PASSWORD')
    console.log(`→ Signing with PFX certificate (${list.length} file(s))`)

    let ok = true
    for (const file of list) {
      const args = [
        'sign',
        '/v',
        '/fd',
        'SHA256',
        '/tr',
        timestampUrl === DEFAULT_TIMESTAMP ? FALLBACK_TIMESTAMP : timestampUrl,
        '/td',
        'SHA256',
        '/f',
        pfx.path,
      ]
      if (password) {
        args.push('/p', password)
      }
      args.push(file)
      if (!runSigntool(signtool, args)) ok = false
    }
    pfx.cleanup?.()

    if (!ok) {
      const msg = 'PFX signing failed (signtool returned non-zero)'
      if (required) throw new Error(msg)
      console.warn(`⚠ ${msg}`)
      return { mode: 'pfx', signed: false, reason: msg }
    }
    console.log('✓ PFX signing complete')
    return { mode: 'pfx', signed: true }
  }

  const msg =
    'No signing credentials configured. Set Azure Trusted Signing env vars ' +
    '(AZURE_TRUSTED_SIGNING_*) or WIN_CSC_LINK + WIN_CSC_KEY_PASSWORD. See SIGNING.md.'
  if (required) throw new Error(msg)
  console.warn(`⚠ ${msg}`)
  return { mode: 'skipped', signed: false, reason: msg }
}

/** CLI: node scripts/sign-windows.mjs <file> [file...] */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const required = process.argv.includes('--require') || env('SIGNING_REQUIRED') === '1'
  if (files.length === 0) {
    console.error('Usage: node scripts/sign-windows.mjs [--require] <file.exe> [more...]')
    process.exit(1)
  }
  try {
    const result = signWindowsFiles(files, { required })
    process.exit(result.signed || !required ? 0 : 1)
  } catch (err) {
    console.error('✗', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
