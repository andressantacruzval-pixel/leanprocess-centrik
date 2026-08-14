

import { useMemo } from 'react'
import { useProcessStore } from '@/stores/processStore'
import { useRiskStore } from '@/stores/riskStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { useProcedureStore } from '@/stores/procedureStore'
import { useAuditStore } from '@/stores/auditStore'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'
import { useOnboardingStore } from '@/features/onboarding/onboardingStore'
import { useStreakStore } from '@/features/gamification/streakStore'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import { useAchievementStore } from '@/features/gamification/achievementStore'
import { useBillingStore } from '@/stores/billingStore'

export interface AchievementProgress {
  current: number
  target: number
}

export function useAchievementProgress(): Record<string, AchievementProgress> {
  // Select primitives / stable references to avoid getSnapshot loops
  const processes = useProcessStore((s) => s.processes)
  const risks = useRiskStore((s) => s.risks)
  const indicators = useIndicatorStore((s) => s.indicators)
  const procedures = useProcedureStore((s) => s.procedures)
  const audits = useAuditStore((s) => s.audits)
  const analyses = useValueAnalysisStore((s) => s.analyses)
  const milestones = useOnboardingStore((s) => s.milestones)
  const currentStreak = useStreakStore((s) => s.currentStreak)
  const events = useAnalyticsStore((s) => s.events)
  const communityPosts = useAchievementStore((s) => s.communityPosts)
  const recentTransactions = useBillingStore((s) => s.recentTransactions)

  return useMemo(() => {
    const processCount = processes.length
    const riskCount = risks.length
    const controlCount = risks.reduce((s, r) => s + (r.controls?.length ?? 0), 0)
    const procedureCount = procedures.length
    const kpiCount = indicators.length

    // BPMN-related: processes that have procedures, audits, or analyses
    const processesWithBpmn = processes.filter((p) => {
      const hasProc = procedures.some((pr) => pr.process_id === p.id)
      return hasProc || (audits[p.id]?.length > 0) || Object.keys(analyses).includes(p.id)
    }).length

    // Value analysis: any classified activity
    const hasValueAnalysis = Object.values(analyses).some(
      (acts) => acts.some((a) => a.classification !== null)
    ) ? 1 : 0

    // Audit: any items
    const hasAudit = Object.values(audits).some((items) => items.length > 0) ? 1 : 0

    // Report: export events
    const hasExport = events.some((e) => e.type === 'export') ? 1 : 0

    // Heat map visit
    const hasHeatMap = events.some((e) => e.type === 'page_view' && e.feature.includes('heat-map')) ? 1 : 0

    // AI features used — fuente autoritativa: token_transactions, fallback a analytics events
    const aiOpsFromTx = new Set(
      recentTransactions
        .filter((t) => t.type === 'consume' && t.operationKey)
        .map((t) => t.operationKey!)
    )
    const aiFeatures = aiOpsFromTx.size > 0
      ? aiOpsFromTx
      : new Set(events.filter((e) => e.type === 'ai_use').map((e) => e.feature))

    // Full process: any process with procedure + KPI + risk
    const hasFullProcess = processes.some((p) => {
      const hasProc = procedures.some((pr) => pr.process_id === p.id)
      const hasKpis = indicators.some((i) => i.process_id === p.id)
      const hasRisks = risks.some((r) => r.process_id === p.id)
      return hasProc && hasKpis && hasRisks
    }) ? 1 : 0

    // Lean master: milestones completed
    const completedMilestones = milestones.filter((m) => m.completed).length
    const totalMilestones = milestones.length

    const communityCount = communityPosts.length

    return {
      'first-process':       { current: Math.min(processCount, 1),  target: 1 },
      'five-processes':      { current: Math.min(processCount, 5),  target: 5 },
      'ten-processes':       { current: Math.min(processCount, 10), target: 10 },
      'twenty-processes':    { current: Math.min(processCount, 20), target: 20 },
      'first-bpmn':          { current: Math.min(processesWithBpmn, 1), target: 1 },
      'five-bpmn':           { current: Math.min(processesWithBpmn, 5), target: 5 },
      'first-risk':          { current: Math.min(riskCount, 1),     target: 1 },
      'ten-risks':           { current: Math.min(riskCount, 10),    target: 10 },
      'first-control':       { current: Math.min(controlCount, 1),  target: 1 },
      'ten-controls':        { current: Math.min(controlCount, 10), target: 10 },
      'first-procedure':     { current: Math.min(procedureCount, 1), target: 1 },
      'five-procedures':     { current: Math.min(procedureCount, 5), target: 5 },
      'first-kpi':           { current: Math.min(kpiCount, 1),      target: 1 },
      'ten-kpis':            { current: Math.min(kpiCount, 10),     target: 10 },
      'first-value-analysis': { current: hasValueAnalysis,           target: 1 },
      'first-audit':         { current: hasAudit,                    target: 1 },
      'first-report':        { current: hasExport,                   target: 1 },
      'heat-map-user':       { current: hasHeatMap,                  target: 1 },
      'ai-power-user':       { current: Math.min(aiFeatures.size, 5), target: 5 },
      'streak-7':            { current: Math.min(currentStreak, 7),  target: 7 },
      'streak-30':           { current: Math.min(currentStreak, 30), target: 30 },
      'full-process':        { current: hasFullProcess,              target: 1 },
      'lean-master':         { current: completedMilestones,         target: totalMilestones || 10 },
      'first-share':         { current: Math.min(communityCount, 1), target: 1 },
      'five-shares':         { current: Math.min(communityCount, 5), target: 5 },
    }
  }, [
    // Arrays completos: la función accede a items individuales para detectar
    // qué procesos tienen BPMN, KPIs, etc. Los .length sólo no son suficientes.
    processes, risks, indicators, procedures, audits, analyses, events, communityPosts,
    recentTransactions, milestones, currentStreak,
  ])
}
