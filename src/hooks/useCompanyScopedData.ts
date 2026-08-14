/**
 * useCompanyScopedData
 * ────────────────────
 * Central hook that filters ALL store data by the active company.
 * Every page/component that needs company-isolated data should use this
 * instead of reading stores directly.
 *
 * B2C model: each user sees only their company's data.
 */

import { useMemo } from 'react'
import { useProcessStore } from '@/stores/processStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useRiskStore } from '@/stores/riskStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { useProcedureStore } from '@/stores/procedureStore'
import { useAuditStore } from '@/stores/auditStore'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'

export function useCompanyScopedData() {
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId)

  // Raw store data
  const allProcesses = useProcessStore((s) => s.processes)
  const allMacroprocesses = useProcessStore((s) => s.macroprocesses)
  const allRisks = useRiskStore((s) => s.risks)
  const allIndicators = useIndicatorStore((s) => s.indicators)
  const allProcedures = useProcedureStore((s) => s.procedures)
  const allAudits = useAuditStore((s) => s.audits)
  const allAnalyses = useValueAnalysisStore((s) => s.analyses)

  // Company-scoped processes and macroprocesses
  const macroprocesses = useMemo(
    () => allMacroprocesses.filter((m) => !m.company_id || m.company_id === activeCompanyId),
    [allMacroprocesses, activeCompanyId]
  )

  const processes = useMemo(
    () => allProcesses.filter((p) => !p.company_id || p.company_id === activeCompanyId),
    [allProcesses, activeCompanyId]
  )

  // Set of valid process IDs for this company
  const processIds = useMemo(
    () => new Set(processes.map((p) => p.id)),
    [processes]
  )

  // Risks scoped by process ownership
  const risks = useMemo(
    () => allRisks.filter((r) => processIds.has(r.process_id)),
    [allRisks, processIds]
  )

  // Indicators — filter by company_id if present, else by process ownership
  const indicators = useMemo(
    () => allIndicators.filter((i) =>
      i.company_id ? i.company_id === activeCompanyId : processIds.has(i.process_id)
    ),
    [allIndicators, activeCompanyId, processIds]
  )

  // Procedures scoped by process ownership
  const procedures = useMemo(
    () => allProcedures.filter((p) => processIds.has(p.process_id)),
    [allProcedures, processIds]
  )

  // Audits scoped by process ownership (Record<processId, AuditItem[]>)
  const audits = useMemo(() => {
    const scoped: typeof allAudits = {}
    for (const [pid, items] of Object.entries(allAudits)) {
      if (processIds.has(pid)) scoped[pid] = items
    }
    return scoped
  }, [allAudits, processIds])

  // Value analyses scoped by process ownership
  const analyses = useMemo(() => {
    const scoped: typeof allAnalyses = {}
    for (const [pid, activities] of Object.entries(allAnalyses)) {
      if (processIds.has(pid)) scoped[pid] = activities
    }
    return scoped
  }, [allAnalyses, processIds])

  return {
    activeCompanyId,
    macroprocesses,
    processes,
    processIds,
    risks,
    indicators,
    procedures,
    audits,
    analyses,
  }
}
