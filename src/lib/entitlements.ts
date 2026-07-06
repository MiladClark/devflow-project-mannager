import { useEffect, useState } from 'react'
import { api } from './ipc'
import type { LicenseState } from '../shared/types'
import { FREE_LIMITS, mapEntitlements } from '../shared/entitlements-map'

export interface Entitlements {
  loaded: boolean
  licensed: boolean
  plan: string
  maxProjects: number
  premiumTemplates: boolean
  healthAudit: boolean
  unlimitedTerminals: boolean
  maxTerminalSessions: number
  autoStartProjects: boolean
  cloudBackup: boolean
  betaChannel: boolean
}

export const FREE_ENTITLEMENTS: Entitlements = {
  loaded: true,
  licensed: false,
  plan: FREE_LIMITS.plan,
  maxProjects: FREE_LIMITS.maxProjects,
  premiumTemplates: FREE_LIMITS.premiumTemplates,
  healthAudit: FREE_LIMITS.healthAudit,
  unlimitedTerminals: FREE_LIMITS.unlimitedTerminals,
  maxTerminalSessions: FREE_LIMITS.maxTerminalSessions,
  autoStartProjects: FREE_LIMITS.autoStartProjects,
  cloudBackup: FREE_LIMITS.cloudBackup,
  betaChannel: FREE_LIMITS.betaChannel,
}

export function deriveEntitlements(state: LicenseState | null): Entitlements {
  if (!state || !state.activated || !state.valid) return FREE_ENTITLEMENTS
  const mapped = mapEntitlements(state.entitlements, state.plan ?? state.tier ?? 'pro')
  return {
    loaded: true,
    licensed: true,
    plan: mapped.plan,
    maxProjects: mapped.maxProjects,
    premiumTemplates: mapped.premiumTemplates,
    healthAudit: mapped.healthAudit,
    unlimitedTerminals: mapped.unlimitedTerminals,
    maxTerminalSessions: mapped.maxTerminalSessions,
    autoStartProjects: mapped.autoStartProjects,
    cloudBackup: mapped.cloudBackup,
    betaChannel: mapped.betaChannel,
  }
}

export function useEntitlements(): Entitlements {
  const [ent, setEnt] = useState<Entitlements>({ ...FREE_ENTITLEMENTS, loaded: false })
  useEffect(() => {
    let cancelled = false
    api.getLicenseState().then((s) => !cancelled && setEnt(deriveEntitlements(s)))
    return () => {
      cancelled = true
    }
  }, [])
  return ent
}
