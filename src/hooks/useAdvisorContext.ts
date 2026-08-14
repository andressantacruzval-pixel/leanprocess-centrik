import { useMemo } from 'react'
import { useCompanyScopedData } from './useCompanyScopedData'

export interface AdvisorContextSummary {
  totalProcesses: number
  processesWithBpmn: number
  processesWithProcedures: number
  processesWithKpis: number
  processesWithRisks: number
  processesWithoutRisks: string[]
  processesWithoutKpis: string[]
  highRisks: { process: string; risk: string; score: number }[]
  controlEffectiveness: Record<string, number>
  vaEfficiency: { processName: string; vaPercent: number }[] | null
  totalRisks: number
  totalIndicators: number
}

/**
 * Reads company-scoped store data and returns a structured summary for the AI advisor.
 */
export function useAdvisorContext(): AdvisorContextSummary {
  const { processes, risks, indicators, procedures, analyses } = useCompanyScopedData()

  return useMemo(() => {
    const processMap = new Map(processes.map((p) => [p.id, p.name]))

    // Processes with BPMN
    const processesWithBpmn = processes.filter((p) => !!p.bpmn_xml).length

    // Processes with procedures
    const procProcessIds = new Set(procedures.map((p) => p.process_id))
    const processesWithProcedures = processes.filter((p) => procProcessIds.has(p.id)).length

    // Processes with KPIs
    const kpiProcessIds = new Set(indicators.map((i) => i.process_id))
    const processesWithKpis = processes.filter((p) => kpiProcessIds.has(p.id)).length

    // Processes with risks
    const riskProcessIds = new Set(risks.map((r) => r.process_id))
    const processesWithRisks = processes.filter((p) => riskProcessIds.has(p.id)).length

    // Without risks
    const processesWithoutRisks = processes
      .filter((p) => !riskProcessIds.has(p.id))
      .map((p) => p.name)

    // Without KPIs
    const processesWithoutKpis = processes
      .filter((p) => !kpiProcessIds.has(p.id))
      .map((p) => p.name)

    // High risks (inherent probability * impact >= 16)
    const highRisks = risks
      .filter((r) => r.inherentProbability * r.inherentImpact >= 16)
      .map((r) => ({
        process: processMap.get(r.process_id) ?? 'Desconocido',
        risk: r.title,
        score: r.inherentProbability * r.inherentImpact,
      }))

    // Control effectiveness summary
    const effectivenessCount: Record<string, number> = {}
    for (const risk of risks) {
      for (const ctrl of risk.controls) {
        effectivenessCount[ctrl.effectiveness] = (effectivenessCount[ctrl.effectiveness] ?? 0) + 1
      }
    }

    // VA efficiency
    let vaEfficiency: { processName: string; vaPercent: number }[] | null = null
    const vaEntries = Object.entries(analyses)
    if (vaEntries.length > 0) {
      vaEfficiency = vaEntries
        .map(([pid, activities]) => {
          const total = activities.reduce((sum, a) => sum + a.dailyMinutes, 0)
          const va = activities
            .filter((a) => a.classification === 'VA')
            .reduce((sum, a) => sum + a.dailyMinutes, 0)
          return {
            processName: processMap.get(pid) ?? 'Desconocido',
            vaPercent: total > 0 ? Math.round((va / total) * 100) : 0,
          }
        })
        .filter((e) => e.vaPercent > 0 || true) // include all
    }

    return {
      totalProcesses: processes.length,
      processesWithBpmn,
      processesWithProcedures,
      processesWithKpis,
      processesWithRisks,
      processesWithoutRisks,
      processesWithoutKpis,
      highRisks,
      controlEffectiveness: effectivenessCount,
      vaEfficiency,
      totalRisks: risks.length,
      totalIndicators: indicators.length,
    }
  }, [processes, risks, indicators, procedures, analyses])
}
