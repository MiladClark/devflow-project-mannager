/** Maps server entitlement keys to enforced client limits. Keep in sync with devtune-website/lib/entitlements.ts */

export interface EnforcedEntitlements {
  plan: string
  maxProjects: number
  maxDevices: number
  unlimitedDevices: boolean
  premiumTemplates: boolean
  customThemes: boolean
  healthAudit: boolean
  maxTerminalSessions: number
  unlimitedTerminals: boolean
  autoStartProjects: boolean
  cloudBackup: boolean
  exportImport: boolean
  analytics: boolean
  teamMode: boolean
  sharedTemplates: boolean
  apiAccess: boolean
  webhooks: boolean
  betaChannel: boolean
}

export const FREE_LIMITS: EnforcedEntitlements = {
  plan: 'free',
  maxProjects: 3,
  maxDevices: 1,
  unlimitedDevices: false,
  premiumTemplates: false,
  customThemes: false,
  healthAudit: false,
  maxTerminalSessions: 1,
  unlimitedTerminals: false,
  autoStartProjects: false,
  cloudBackup: false,
  exportImport: false,
  analytics: false,
  teamMode: false,
  sharedTemplates: false,
  apiAccess: false,
  webhooks: false,
  betaChannel: false,
}

/** Signed-out browse mode — UI visible, all actions blocked until sign-in. */
export const GUEST_LIMITS: EnforcedEntitlements = {
  plan: 'guest',
  maxProjects: 0,
  maxDevices: 0,
  unlimitedDevices: false,
  premiumTemplates: false,
  customThemes: false,
  healthAudit: false,
  maxTerminalSessions: 0,
  unlimitedTerminals: false,
  autoStartProjects: false,
  cloudBackup: false,
  exportImport: false,
  analytics: false,
  teamMode: false,
  sharedTemplates: false,
  apiAccess: false,
  webhooks: false,
  betaChannel: false,
}

function parseCount(
  raw: string | undefined,
  fallback: number,
): { max: number; unlimited: boolean } {
  if (!raw || raw === 'false' || raw === '0') return { max: fallback, unlimited: false }
  if (raw === 'unlimited') return { max: Number.POSITIVE_INFINITY, unlimited: true }
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0) return { max: n, unlimited: false }
  return { max: fallback, unlimited: false }
}

/** All bool entitlements use opt-in semantics (must be exactly 'true'). */
export function mapEntitlements(
  entitlements: Record<string, string> | undefined,
  plan = 'pro',
): EnforcedEntitlements {
  const e = entitlements ?? {}
  const rawProjects = e.max_projects ?? '3'
  const terminals = parseCount(e.terminal_sessions, 1)
  const devices = parseCount(e.max_devices, 1)
  return {
    plan,
    maxProjects:
      rawProjects === 'unlimited'
        ? Number.POSITIVE_INFINITY
        : Number(rawProjects) || FREE_LIMITS.maxProjects,
    maxDevices: devices.max,
    unlimitedDevices: devices.unlimited,
    premiumTemplates: e.premium_templates === 'true',
    customThemes: e.custom_themes === 'true',
    healthAudit: e.health_audit === 'true',
    maxTerminalSessions: terminals.max,
    unlimitedTerminals: terminals.unlimited,
    autoStartProjects: e.auto_start_projects === 'true',
    cloudBackup: e.cloud_backup === 'true',
    exportImport: e.export_import === 'true',
    analytics: e.analytics === 'true',
    teamMode: e.team_mode === 'true',
    sharedTemplates: e.shared_templates === 'true',
    apiAccess: e.api_access === 'true',
    webhooks: e.webhooks === 'true',
    betaChannel: e.beta_channel === 'true',
  }
}
