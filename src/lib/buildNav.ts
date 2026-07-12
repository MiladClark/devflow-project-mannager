import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from './ipc'
import type { Project, BuildEligibility } from '../shared/types'

const BUILDABLE_STATUSES = new Set<BuildEligibility['status']>(['ready', 'needs-attention'])

/**
 * Shared "click Build & Setup" behavior for ProjectTable and ProjectDetail: run the
 * quick eligibility check, then either navigate to the project-scoped build page or
 * surface an explanation dialog — never route to a wizard that can't actually build.
 */
export function useBuildNavigation() {
  const navigate = useNavigate()
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ project: Project; eligibility: BuildEligibility } | null>(null)

  async function openBuild(project: Project) {
    setCheckingId(project.id)
    const eligibility = await api.buildEligibility(project.path)
    setCheckingId(null)
    if (BUILDABLE_STATUSES.has(eligibility.status)) {
      navigate(`/projects/${project.id}/build`)
    } else {
      setDialog({ project, eligibility })
    }
  }

  return {
    openBuild,
    checkingId,
    dialog,
    closeDialog: () => setDialog(null),
  }
}
