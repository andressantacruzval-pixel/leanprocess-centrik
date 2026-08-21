/**
 * useProcessHealth
 * ────────────────
 * Calcula el % de MADUREZ (antes «salud») de cada proceso.
 * 7 hitos, cada uno vale ~14,3%.
 */

import { useMemo } from 'react'
import { useProcessStore } from '@/stores/processStore'
import { useRiskStore } from '@/stores/riskStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { useProcedureStore } from '@/stores/procedureStore'
import { useAuditStore } from '@/stores/auditStore'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'
import { useImprovementStore } from '@/stores/improvementStore'
import { useCompanyStore } from '@/stores/companyStore'
import { isDocumentable } from '@/lib/processLevels'

export interface ProcessHealthChecks {
  bpmn: boolean
  procedure: boolean
  kpis: boolean
  risks: boolean
  audit: boolean
  valueAnalysis: boolean
  improvements: boolean
}

export interface ProcessHealthEntry {
  score: number
  checks: ProcessHealthChecks
}

export type ProcessHealthMap = Record<string, ProcessHealthEntry>

export function useProcessHealth(): ProcessHealthMap {
  const processes = useProcessStore((s) => s.processes)
  const risks = useRiskStore((s) => s.risks)
  const indicators = useIndicatorStore((s) => s.indicators)
  const procedures = useProcedureStore((s) => s.procedures)
  const audits = useAuditStore((s) => s.audits)
  const analyses = useValueAnalysisStore((s) => s.analyses)
  const improvements = useImprovementStore((s) => s.opportunities)
  const processLevelCount = useCompanyStore((s) => s.company?.process_level_count ?? 3)

  return useMemo(() => {
    const result: ProcessHealthMap = {}

    // Pasada 1: procesos del nivel más bajo declarado → score sobre 6 checks.
    // NO "los que no tienen hijos": un proceso agrupador todavía vacío puntuaría
    // 0% en documentación que no le corresponde, y esa alerta roja es
    // precisamente lo que invitaba a documentar en el nivel equivocado.
    // Ver @/lib/processLevels.
    for (const process of processes) {
      if (!isDocumentable(process, processLevelCount)) continue

      const bpmn = !!process.bpmn_xml
      const procedure = procedures.some((pr) => pr.process_id === process.id)
      const kpis = indicators.filter((i) => i.process_id === process.id).length > 0
      const risksCheck = risks.filter((r) => r.process_id === process.id).length > 0
      const audit = (audits[process.id]?.length ?? 0) > 0
      const valueAnalysis = (analyses[process.id]?.length ?? 0) > 0
      const improvementsCheck = improvements.some((o) => o.processId === process.id)

      const checks: ProcessHealthChecks = { bpmn, procedure, kpis, risks: risksCheck, audit, valueAnalysis, improvements: improvementsCheck }
      const passed = Object.values(checks).filter(Boolean).length
      result[process.id] = { score: Math.round((passed / 7) * 100), checks }
    }

    // Pasada 2: procesos agrupadores → score = promedio de sus hijos. Sin hijos
    // aún, 0% es honesto: lo que falta es crear los subprocesos, no documentar aquí.
    const noChecks: ProcessHealthChecks = { bpmn: false, procedure: false, kpis: false, risks: false, audit: false, valueAnalysis: false, improvements: false }
    for (const process of processes) {
      if (isDocumentable(process, processLevelCount)) continue

      const children = processes.filter((p) => p.parent_process_id === process.id)
      const avg = children.length > 0
        ? Math.round(children.reduce((s, c) => s + (result[c.id]?.score ?? 0), 0) / children.length)
        : 0
      result[process.id] = { score: avg, checks: noChecks }
    }

    return result
  }, [processes, risks, indicators, procedures, audits, analyses, improvements, processLevelCount])
}
