/**
 * Create GitHub Release + upload asset (fallback when gh CLI unavailable).
 * Uses git credential for token; curl for large binary upload on Windows.
 */
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
function getArg(name) {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : ''
}

const repo = getArg('--repo') || 'MiladClark/devflow-app-updates'
const tag = getArg('--tag')
const title = getArg('--title') || tag
const notes = getArg('--notes') || ''
const assetPath = getArg('--asset')

function tokenFromGitCredential() {
  const r = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    shell: false,
    timeout: 15000,
  })
  if (r.status !== 0) return null
  const passLine = r.stdout.split('\n').find((l) => l.startsWith('password='))
  return passLine ? passLine.slice('password='.length).trim() : null
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || tokenFromGitCredential()
if (!token) {
  console.error('GITHUB_TOKEN, GH_TOKEN, or git credential for github.com required')
  process.exit(1)
}
if (!tag || !assetPath) {
  console.error('Usage: --tag v0.1.0 --asset path/to.zip [--notes "..."] [--repo owner/repo]')
  process.exit(1)
}

const [owner, repoName] = repo.split('/')
const fileName = path.basename(assetPath)
const size = statSync(assetPath).size

async function api(method, urlPath, body) {
  const res = await fetch(`https://api.github.com${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    if (res.status === 404) return null
    console.error('GitHub API error', res.status, json)
    process.exit(1)
  }
  return json
}

let release = await api('GET', `/repos/${owner}/${repoName}/releases/tags/${tag}`)
if (!release) {
  release = await api('POST', `/repos/${owner}/${repoName}/releases`, {
    tag_name: tag,
    name: title,
    body: notes,
    draft: false,
  })
} else {
  console.log('Release exists, uploading asset')
}

const uploadUrl = `${release.upload_url.replace('{?name,label}', '')}?name=${encodeURIComponent(fileName)}`

const curl = spawnSync(
  'curl',
  [
    '-sS',
    '-X',
    'POST',
    '-H',
    `Authorization: Bearer ${token}`,
    '-H',
    'Accept: application/vnd.github+json',
    '-H',
    'Content-Type: application/octet-stream',
    '--data-binary',
    `@${assetPath}`,
    uploadUrl,
  ],
  { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 600000, shell: false },
)

if (curl.status !== 0) {
  console.error('curl upload failed', curl.stderr || curl.stdout)
  process.exit(1)
}

let assetJson
try {
  assetJson = JSON.parse(curl.stdout)
} catch {
  console.error('Invalid upload response', curl.stdout.slice(0, 500))
  process.exit(1)
}

if (assetJson.message) {
  console.error('Upload error', assetJson)
  process.exit(1)
}

console.log('GitHub release asset uploaded:')
console.log(JSON.stringify({ tag, browser_download_url: assetJson.browser_download_url, size }, null, 2))
