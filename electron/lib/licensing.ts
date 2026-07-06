import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import type { LicenseState, ActivateOptions, LicenseActionResult } from '../../src/shared/types'
import { FREE_LIMITS, mapEntitlements, type EnforcedEntitlements } from '../../src/shared/entitlements-map'
import { runOAuthLoopback } from './oauth-loopback'

export { FREE_LIMITS, type EnforcedEntitlements }

export const DEFAULT_SERVER_URL = process.env.DEVTUNE_URL ?? 'https://devtune-website.vercel.app'

// Ed25519 public key matching the DevTune licensing service (LICENSE_PUBLIC_KEY)
const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAC7is86fZgO4RXRnC4YzTHcx+QYM+8hzDmMvYK89mB6c=
-----END PUBLIC KEY-----`

interface PersistedLicense {
  serverUrl: string
  installId: string
  licenseKey?: string
  email?: string
  userName?: string
  avatarUrl?: string
  deviceId?: string
  signedIn?: boolean
  seatsUsed?: number
  token?: string
  lastValidatedAt?: number
}

interface TokenPayload {
  sub: string
  lic: string
  plan: string
  tier: string
  entitlements?: Record<string, string>
  device_id: string
  seats?: number
  grace_until?: number
  expires_at?: string
  display_key?: string
  iat: number
  exp: number
  iss: string
}

let cache: PersistedLicense | null = null

function filePath() {
  return path.join(app.getPath('userData'), 'devflow-license.json')
}

function load(): PersistedLicense {
  if (cache) return cache
  try {
    cache = JSON.parse(fs.readFileSync(filePath(), 'utf-8'))
  } catch {
    cache = { serverUrl: DEFAULT_SERVER_URL, installId: crypto.randomUUID() }
    save()
  }
  if (!cache!.serverUrl) cache!.serverUrl = DEFAULT_SERVER_URL
  return cache!
}

function save() {
  fs.writeFileSync(filePath(), JSON.stringify(cache, null, 2), 'utf-8')
}

// ---- device identity ----

let machineGuid: string | null = null

function getMachineGuid(): Promise<string> {
  if (machineGuid) return Promise.resolve(machineGuid)
  return new Promise((resolve) => {
    execFile(
      'reg',
      ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
      { windowsHide: true, timeout: 5000 },
      (_err, stdout) => {
        const m = (stdout ?? '').match(/MachineGuid\s+REG_SZ\s+(\S+)/)
        machineGuid = m?.[1] ?? os.hostname()
        resolve(machineGuid)
      },
    )
  })
}

export async function getFingerprint(): Promise<string> {
  const guid = await getMachineGuid()
  return `${guid}|${os.hostname()}`
}

// ---- token verification (offline) ----

function verifyToken(token: string): TokenPayload | null {
  try {
    const [h, p, s] = token.split('.')
    if (!h || !p || !s) return null
    const ok = crypto.verify(
      null,
      Buffer.from(`${h}.${p}`),
      crypto.createPublicKey(LICENSE_PUBLIC_KEY),
      Buffer.from(s, 'base64url'),
    )
    if (!ok) return null
    return JSON.parse(Buffer.from(p, 'base64url').toString('utf-8')) as TokenPayload
  } catch {
    return null
  }
}

function maskKey(key?: string): string | undefined {
  if (!key) return undefined
  if (key === 'freeappdevflow2026') return key
  const parts = key.split('-')
  if (parts.length < 3) return '****'
  return [parts[0], '****', '****', '****', parts[parts.length - 1]].join('-')
}

export function broadcastLicenseChanged() {
  const state = getLicenseState()
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('license:changed', state)
  }
  return state
}

function daysRemaining(expiresAt?: string | null): number | undefined {
  if (!expiresAt) return undefined
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

// ---- state ----

export function getLicenseState(): LicenseState {
  const st = load()
  const base: LicenseState = {
    activated: false,
    valid: false,
    inGrace: false,
    signedIn: !!st.signedIn,
    serverUrl: st.serverUrl,
    appVersion: app.getVersion(),
    deviceLabel: os.hostname(),
    licenseKey: maskKey(st.licenseKey),
    email: st.email,
    userName: st.userName,
    avatarUrl: st.avatarUrl,
    seatsUsed: st.seatsUsed,
    lastValidatedAt: st.lastValidatedAt,
  }
  if (!st.token) return base

  const payload = verifyToken(st.token)
  if (!payload) return base

  const now = Math.floor(Date.now() / 1000)
  const expired = payload.exp < now
  const inGrace = expired && (payload.grace_until ?? 0) > now
  const planExpired =
    payload.expires_at != null && new Date(payload.expires_at).getTime() < Date.now()

  return {
    ...base,
    activated: true,
    valid: (!expired || inGrace) && !planExpired,
    inGrace,
    plan: payload.plan,
    tier: payload.tier,
    entitlements: payload.entitlements,
    seatLimit: payload.seats,
    tokenExpiresAt: payload.exp,
    graceUntil: payload.grace_until,
    displayKey: payload.display_key,
    expiresAt: payload.expires_at ?? null,
    daysRemaining: daysRemaining(payload.expires_at),
    licenseKey: maskKey(st.licenseKey ?? payload.display_key),
  }
}

// ---- server calls ----

async function post(pathname: string, body: unknown): Promise<{ status: number; json: any }> {
  const st = load()
  const res = await fetch(new URL(pathname, st.serverUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

export async function activate(opts: ActivateOptions): Promise<LicenseActionResult> {
  const st = load()
  try {
    const fingerprint = await getFingerprint()
    const { status, json } = await post('/api/licensing/activate', {
      email: opts.email || undefined,
      password: opts.password || undefined,
      license_key: opts.licenseKey || undefined,
      app_version: app.getVersion(),
      device: {
        fingerprint,
        install_id: st.installId,
        label: os.hostname(),
        os_name: 'Windows',
        os_version: os.release(),
      },
    })
    if (status !== 200 || !json.ok) {
      return { ok: false, error: friendlyError(json.error, status), state: getLicenseState() }
    }
    st.token = json.token
    st.licenseKey = json.license_key ?? opts.licenseKey ?? st.licenseKey
    if (opts.email) st.email = opts.email
    st.lastValidatedAt = Date.now()
    save()
    broadcastLicenseChanged()
    return { ok: true, state: getLicenseState() }
  } catch (err) {
    return { ok: false, error: connectError(err), state: getLicenseState() }
  }
}

export async function refresh(): Promise<LicenseActionResult> {
  const st = load()
  if (!st.licenseKey) {
    if (st.signedIn) return { ok: true, state: getLicenseState() }
    return { ok: false, error: 'Not signed in — use Sign in with DevTune.', state: getLicenseState() }
  }
  try {
    const fingerprint = await getFingerprint()
    const { status, json } = await post('/api/licensing/validate', {
      license_key: st.licenseKey,
      device_fingerprint: fingerprint,
    })
    if (status !== 200 || !json.valid) {
      if (status === 403 || status === 404) {
        clearLicense()
      }
      return { ok: false, error: friendlyError(json.error, status), state: getLicenseState() }
    }
    st.token = json.token
    st.lastValidatedAt = Date.now()
    save()
    broadcastLicenseChanged()
    return { ok: true, state: getLicenseState() }
  } catch (err) {
    return { ok: false, error: connectError(err), state: getLicenseState() }
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

export function startLicensePolling() {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    void pollValidateIfLicensed()
  }, 60_000)
}

export function stopLicensePolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export async function pollValidateIfLicensed(): Promise<void> {
  const st = load()
  if (!st.token || !st.licenseKey) return
  const before = getLicenseState()
  await refresh().catch(() => {})
  const after = getLicenseState()
  if (before.valid && !after.valid && !after.signedIn) {
    broadcastLicenseChanged()
  }
}

export async function startOAuthSignIn(): Promise<LicenseActionResult> {
  const st = load()
  try {
    const { code, state } = await runOAuthLoopback(st.serverUrl)
    return completeOAuthExchange(code, state)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      state: getLicenseState(),
    }
  }
}

export async function completeOAuthExchange(code: string, state: string): Promise<LicenseActionResult> {
  const st = load()
  try {
    const fingerprint = await getFingerprint()
    const { status, json } = await post('/api/oauth/device/exchange', {
      code,
      state,
      app_version: app.getVersion(),
      device: {
        fingerprint,
        install_id: st.installId,
        label: os.hostname(),
        os_name: 'Windows',
        os_version: os.release(),
      },
    })

    if (status === 409 && json.error === 'seat_limit_reached') {
      return {
        ok: false,
        error: friendlyError(json.error, status),
        state: getLicenseState(),
      }
    }

    if (status !== 200 || !json.ok) {
      return { ok: false, error: friendlyError(json.error, status), state: getLicenseState() }
    }

    st.signedIn = true
    st.userName = json.user?.name
    st.email = json.user?.email
    st.avatarUrl = json.user?.avatar_url ?? undefined
    st.lastValidatedAt = Date.now()

    if (json.token) {
      st.token = json.token
      st.licenseKey = json.license_key
      st.deviceId = json.device_id
      st.seatsUsed = json.seats?.used
    } else {
      st.token = undefined
      st.licenseKey = undefined
      st.deviceId = undefined
      st.seatsUsed = undefined
    }
    save()
    broadcastLicenseChanged()
    return { ok: true, state: getLicenseState() }
  } catch (err) {
    return { ok: false, error: connectError(err), state: getLicenseState() }
  }
}

export async function signOutDevice(): Promise<LicenseActionResult> {
  const st = load()
  if (!st.licenseKey) {
    clearLicense()
    return { ok: true, state: getLicenseState() }
  }
  try {
    const fingerprint = await getFingerprint()
    const { status, json } = await post('/api/licensing/deactivate-device', {
      license_key: st.licenseKey,
      device_fingerprint: fingerprint,
      device_id: st.deviceId,
    })
    if (status !== 200 || !json.ok) {
      return {
        ok: false,
        error: friendlyError(json.error, status) || 'Could not deactivate device online.',
        state: getLicenseState(),
      }
    }
    return { ok: true, state: clearLicense() }
  } catch (err) {
    return {
      ok: false,
      error: 'Sign out requires an internet connection. Connect and try again.',
      state: getLicenseState(),
    }
  }
}

export function clearLicense(): LicenseState {
  const st = load()
  st.token = undefined
  st.licenseKey = undefined
  st.email = undefined
  st.userName = undefined
  st.avatarUrl = undefined
  st.deviceId = undefined
  st.signedIn = undefined
  st.seatsUsed = undefined
  st.lastValidatedAt = undefined
  save()
  broadcastLicenseChanged()
  return getLicenseState()
}

/** @deprecated Anonymous activation removed — use startOAuthSignIn */
export async function activateFreeApp(): Promise<LicenseActionResult> {
  return { ok: false, error: 'Anonymous activation is no longer supported. Sign in with DevTune.', state: getLicenseState() }
}

/** @deprecated Use OAuth sign-in instead */
export async function ensureFreeAppLicense(): Promise<void> {
  /* no-op */
}

export function setServerUrl(url: string): LicenseState {
  const st = load()
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad protocol')
    st.serverUrl = u.origin
    save()
  } catch {
    /* keep previous URL on invalid input */
  }
  return getLicenseState()
}

/** Revalidate silently at startup when a refresh is due (token older than 24h). */
export async function refreshIfDue(): Promise<void> {
  const st = load()
  if (!st.token || !st.licenseKey) return
  const dayMs = 24 * 60 * 60 * 1000
  if (st.lastValidatedAt && Date.now() - st.lastValidatedAt < dayMs) return
  await refresh().catch(() => {})
}

export function getEnforcedEntitlements(): EnforcedEntitlements {
  const s = getLicenseState()
  if (!s.valid) return FREE_LIMITS
  return mapEntitlements(s.entitlements, s.plan ?? s.tier ?? 'pro')
}

function friendlyError(code: string | undefined, status: number): string {
  const map: Record<string, string> = {
    invalid_credentials: 'Email or password is incorrect.',
    license_not_found: 'License key not found.',
    no_active_license: 'This account has no active license. Start a trial or purchase a plan on the website.',
    seat_limit_reached: 'All device seats are in use. Free a device from your account page on the website.',
    license_expired: 'This license has expired.',
    device_not_activated: 'This device is not activated for the license.',
    device_fingerprint_required: 'Device fingerprint missing.',
    freeapp_provision_failed:
      'Could not activate your free app license. Contact support or try again after the site admin re-enables the Free App plan.',
    freeapp_plan_missing: 'Free App plan is not configured on the server.',
  }
  if (code && map[code]) return map[code]
  if (code?.startsWith('license_')) return `License is ${code.replace('license_', '')}.`
  return code ?? `Server error (HTTP ${status})`
}

function connectError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/fetch failed|ECONNREFUSED|timeout|abort/i.test(msg)) {
    return 'Could not reach the DevTune server. Check the server URL or your connection.'
  }
  return msg
}
