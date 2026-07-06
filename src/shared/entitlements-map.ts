/** Maps server entitlement keys to enforced client limits. Keep in sync with devtune-website/lib/entitlements.ts */

export interface EnforcedEntitlements {
  plan: string
  maxProjects: number
  premiumTemplates: boolean
  healthAudit: boolean
  maxTerminalSessions: number
  unlimitedTerminals: boolean
  autoStartProjects: boolean
  cloudBackup: boolean
  betaChannel: boolean
}

export const FREE_LIMITS: EnforcedEntitlements = {
  plan: 'free',
  maxProjects: 3,
  premiumTemplates: false,
  healthAudit: false,
  maxTerminalSessions: 1,
  unlimitedTerminals: false,
  autoStartProjects: false,
  cloudBackup: false,
  betaChannel: false,
}

function parseTerminalSessions(raw: string | undefined): { max: number; unlimited: boolean } {
  if (!raw || raw === 'false' || raw === '0') return { max: 1, unlimited: false }
  if (raw === 'unlimited') return { max: Number.POSITIVE_INFINITY, unlimited: true }
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0) return { max: n, unlimited: false }
  return { max: 1, unlimited: false }
}

/** All bool entitlements use opt-in semantics (must be exactly 'true'). */
export function mapEntitlements(
  entitlements: Record<string, string> | undefined,
  plan = 'pro',
): EnforcedEntitlements {
  const e = entitlements ?? {}
  const rawProjects = e.max_projects ?? '3'
  const terminals = parseTerminalSessions(e.terminal_sessions)
  return {
    plan,
    maxProjects:
      rawProjects === 'unlimited'
        ? Number.POSITIVE_INFINITY
        : Number(rawProjects) || FREE_LIMITS.maxProjects,
    premiumTemplates: e.premium_templates === 'true',
    healthAudit: e.health_audit === 'true',
    maxTerminalSessions: terminals.max,
    unlimitedTerminals: terminals.unlimited,
    autoStartProjects: e.auto_start_projects === 'true',
    cloudBackup: e.cloud_backup === 'true',
    betaChannel: e.beta_channel === 'true',
  }
}
