import { app } from 'electron'
import type { UpdateCheckResult } from '../../src/shared/types'
import { DEFAULT_SERVER_URL, getLicenseState } from './licensing'
import { FREE_LIMITS, mapEntitlements } from '../../src/shared/entitlements-map'

export async function checkForUpdates(serverUrl?: string): Promise<UpdateCheckResult> {
  const current = app.getVersion()
  const base = serverUrl || DEFAULT_SERVER_URL
  const license = getLicenseState()
  const entitlements =
    license.valid && license.activated
      ? mapEntitlements(license.entitlements, license.plan ?? license.tier ?? 'pro')
      : FREE_LIMITS
  const channel = entitlements.betaChannel ? 'beta' : 'stable'
  try {
    const url = new URL('/api/updates/check', base)
    url.searchParams.set('product', 'devflow')
    url.searchParams.set('channel', channel)
    url.searchParams.set('version', current)
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return { ok: false, error: `Server error (HTTP ${res.status})`, currentVersion: current }
    const json = await res.json()
    return {
      ok: true,
      currentVersion: current,
      updateAvailable: !!json.update_available,
      required: !!json.required,
      severity: json.severity,
      latest: json.latest
        ? {
            version: json.latest.version,
            downloadUrl: json.latest.download_url,
            checksum: json.latest.checksum,
            sizeBytes: json.latest.size_bytes,
            releaseNotes: json.latest.release_notes,
            releasedAt: json.latest.released_at,
          }
        : undefined,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      currentVersion: current,
      error: /fetch failed|ECONNREFUSED|timeout|abort/i.test(msg)
        ? 'Could not reach the DevTune server.'
        : msg,
    }
  }
}
