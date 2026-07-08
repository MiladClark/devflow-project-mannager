import { useEffect, useState } from 'react'
import { api } from './ipc'
import type { LicenseState } from '../shared/types'
import { FREE_LIMITS, GUEST_LIMITS, mapEntitlements } from '../shared/entitlements-map'

export interface Entitlements {
  loaded: boolean
  licensed: boolean
  guest: boolean
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

export const GUEST_ENTITLEMENTS: Entitlements = {
  loaded: true,
  licensed: false,
  guest: true,
  plan: GUEST_LIMITS.plan,
  maxProjects: GUEST_LIMITS.maxProjects,
  premiumTemplates: GUEST_LIMITS.premiumTemplates,
  healthAudit: GUEST_LIMITS.healthAudit,
  unlimitedTerminals: GUEST_LIMITS.unlimitedTerminals,
  maxTerminalSessions: GUEST_LIMITS.maxTerminalSessions,
  autoStartProjects: GUEST_LIMITS.autoStartProjects,
  cloudBackup: GUEST_LIMITS.cloudBackup,
  betaChannel: GUEST_LIMITS.betaChannel,
}

export const FREE_ENTITLEMENTS: Entitlements = {
  loaded: true,
  licensed: false,
  guest: false,
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

export function isGuestLicense(state: LicenseState | null | undefined): boolean {
  return !!(state?.guestMode && !state.signedIn)
}

export function deriveEntitlements(state: LicenseState | null): Entitlements {
  if (isGuestLicense(state)) return GUEST_ENTITLEMENTS
  if (!state || !state.activated || !state.valid) return FREE_ENTITLEMENTS
  const mapped = mapEntitlements(state.entitlements, state.plan ?? state.tier ?? 'pro')
  return {
    loaded: true,
    licensed: true,
    guest: false,
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
    const load = () => api.getLicenseState().then((s) => !cancelled && setEnt(deriveEntitlements(s)))
    load()
    const off = api.onLicenseChanged((s) => !cancelled && setEnt(deriveEntitlements(s as LicenseState)))
    return () => {
      cancelled = true
      off()
    }
  }, [])
  return ent
}
