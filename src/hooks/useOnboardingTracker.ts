import { useEffect } from 'react'
import { useOnboardingStore } from '@/features/onboarding/onboardingStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useProcessStore } from '@/stores/processStore'
import { useRiskStore } from '@/stores/riskStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { useProcedureStore } from '@/stores/procedureStore'
import { useAuditStore } from '@/stores/auditStore'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'
import { useAnalyticsStore } from '@/stores/analyticsStore'

export function useOnboardingTracker() {
  const requestConfirmation = useOnboardingStore((s) => s.requestConfirmation)
  const milestones = useOnboardingStore((s) => s.milestones)

  const company = useCompanyStore((s) => s.company)
  const orgUnits = useCompanyStore((s) => s.orgUnits)
  const macroprocesses = useProcessStore((s) => s.macroprocesses)
  const processes = useProcessStore((s) => s.processes)
  const risks = useRiskStore((s) => s.risks)
  const indicators = useIndicatorStore((s) => s.indicators)
  const procedures = useProcedureStore((s) => s.procedures)
  const audits = useAuditStore((s) => s.audits)
  const analyses = useValueAnalysisStore((s) => s.analyses)
  const events = useAnalyticsStore((s) => s.events)

  useEffect(() => {
    const isIncomplete = (id: string) => !milestones.find(m => m.id === id)?.completed

    // Company configured
    if (isIncomplete('company') && company?.name && company?.industry) {
      requestConfirmation('company')
    }

    // Org structure
    if (isIncomplete('org-structure') && orgUnits.length > 0) {
      requestConfirmation('org-structure')
    }

    // Process map (at least 1 macro + 1 process)
    if (isIncomplete('process-map') && macroprocesses.length > 0 && processes.length > 0) {
      requestConfirmation('process-map')
    }

    // BPMN diagram
    if (isIncomplete('bpmn') && processes.some(p => p.bpmn_xml)) {
      requestConfirmation('bpmn')
    }

    // Procedure
    if (isIncomplete('procedure') && procedures.length > 0) {
      requestConfirmation('procedure')
    }

    // KPIs
    if (isIncomplete('kpi') && indicators.length > 0) {
      requestConfirmation('kpi')
    }

    // Risks
    if (isIncomplete('risk') && risks.length > 0) {
      requestConfirmation('risk')
    }

    // Audit
    if (isIncomplete('audit') && Object.values(audits).some(items => items.length > 0)) {
      requestConfirmation('audit')
    }

    // Value Analysis
    if (isIncomplete('value-analysis') && Object.values(analyses).some(acts => acts.some(a => a.classification !== null))) {
      requestConfirmation('value-analysis')
    }

    // Report — user has exported at least once
    if (isIncomplete('report') && events.some(e => e.type === 'export')) {
      requestConfirmation('report')
    }
  }, [company, orgUnits, macroprocesses, processes, risks, indicators, procedures, audits, analyses, milestones, events, requestConfirmation])
}
