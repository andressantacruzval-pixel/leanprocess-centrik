/**
 * useAchievementTracker
 * ─────────────────────
 * Automatically detects and unlocks achievements based on store data.
 * Runs on mount and whenever relevant data changes.
 */

import { useEffect, useMemo } from 'react'
import { useCompanyScopedData } from './useCompanyScopedData'
import { useOnboardingStore } from '@/features/onboarding/onboardingStore'
import { useStreakStore } from '@/features/gamification/streakStore'
import { useAchievementStore } from '@/features/gamification/achievementStore'
import { useAnalyticsStore } from '@/stores/analyticsStore'
import { useBillingStore } from '@/stores/billingStore'

export function useAchievementTracker() {
  const { processes, risks, indicators, procedures, audits, analyses, improvements } = useCompanyScopedData()
  const milestones = useOnboardingStore((s) => s.milestones)
  const streak = useStreakStore((s) => s.currentStreak)
  const events = useAnalyticsStore((s) => s.events)
  const unlock = useAchievementStore((s) => s.unlockAchievement)
  const isUnlocked = useAchievementStore((s) => s.isUnlocked)
  const achievementsLoaded = useAchievementStore((s) => s.achievementsLoaded)
  const recentTransactions = useBillingStore((s) => s.recentTransactions)

  const auditKeyCount = useMemo(() => Object.keys(audits).length, [audits])
  const analysisKeyCount = useMemo(() => Object.keys(analyses).length, [analyses])

  useEffect(() => {
    // Esperar a que loadFromDB() complete — evita re-disparar toasts en dispositivo nuevo
    if (!achievementsLoaded) return

    // Process achievements
    const processCount = processes.length
    if (processCount >= 1 && !isUnlocked('first-process')) unlock('first-process')
    if (processCount >= 5 && !isUnlocked('five-processes')) unlock('five-processes')
    if (processCount >= 10 && !isUnlocked('ten-processes')) unlock('ten-processes')
    if (processCount >= 20 && !isUnlocked('twenty-processes')) unlock('twenty-processes')

    // BPMN achievements — count processes that have procedures, audits, or value analyses
    const processesWithBpmn = processes.filter(p => {
      const procData = procedures.find(pr => pr.process_id === p.id)
      return procData || audits[p.id]?.length > 0 || Object.keys(analyses).includes(p.id)
    }).length
    if (processesWithBpmn >= 1 && !isUnlocked('first-bpmn')) unlock('first-bpmn')
    if (processesWithBpmn >= 5 && !isUnlocked('five-bpmn')) unlock('five-bpmn')

    // Risk achievements
    const riskCount = risks.length
    if (riskCount >= 1 && !isUnlocked('first-risk')) unlock('first-risk')
    if (riskCount >= 10 && !isUnlocked('ten-risks')) unlock('ten-risks')

    // Control achievements
    const controlCount = risks.reduce((sum, r) => sum + (r.controls?.length ?? 0), 0)
    if (controlCount >= 1 && !isUnlocked('first-control')) unlock('first-control')
    if (controlCount >= 10 && !isUnlocked('ten-controls')) unlock('ten-controls')

    // Procedure achievements
    const procedureCount = procedures.length
    if (procedureCount >= 1 && !isUnlocked('first-procedure')) unlock('first-procedure')
    if (procedureCount >= 5 && !isUnlocked('five-procedures')) unlock('five-procedures')

    // KPI achievements
    const kpiCount = indicators.length
    if (kpiCount >= 1 && !isUnlocked('first-kpi')) unlock('first-kpi')
    if (kpiCount >= 10 && !isUnlocked('ten-kpis')) unlock('ten-kpis')

    // Value analysis
    const hasValueAnalysis = Object.values(analyses).some(
      (acts) => acts.some((a) => a.classification !== null)
    )
    if (hasValueAnalysis && !isUnlocked('first-value-analysis')) unlock('first-value-analysis')

    // Audit
    const hasAudit = Object.values(audits).some((items) => items.length > 0)
    if (hasAudit && !isUnlocked('first-audit')) unlock('first-audit')

    // Report (check analytics events)
    const hasExport = events.some((e) => e.type === 'export')
    if (hasExport && !isUnlocked('first-report')) unlock('first-report')

    // Heat map visit
    const hasHeatMap = events.some((e) => e.type === 'page_view' && e.feature.includes('heat-map'))
    if (hasHeatMap && !isUnlocked('heat-map-user')) unlock('heat-map-user')

    // AI power user (5 different AI operation types used)
    // Fuente autoritativa: token_transactions (consume events por operacion unica)
    const aiOpsFromTransactions = new Set(
      recentTransactions
        .filter((t) => t.type === 'consume' && t.operationKey)
        .map((t) => t.operationKey!)
    )
    // Fallback a analytics events si no hay transacciones (usuarios pre-billing)
    const aiOpsFromEvents = new Set(events.filter((e) => e.type === 'ai_use').map((e) => e.feature))
    const aiOps = aiOpsFromTransactions.size > 0 ? aiOpsFromTransactions : aiOpsFromEvents
    if (aiOps.size >= 5 && !isUnlocked('ai-power-user')) unlock('ai-power-user')

    // Streak achievements
    if (streak >= 7 && !isUnlocked('streak-7')) unlock('streak-7')
    if (streak >= 30 && !isUnlocked('streak-30')) unlock('streak-30')

    // Full process (one process with procedure + KPIs + risks)
    const hasFullProcess = processes.some((p) => {
      const hasProc = procedures.some((pr) => pr.process_id === p.id)
      const hasKpis = indicators.some((i) => i.process_id === p.id)
      const hasRisks = risks.some((r) => r.process_id === p.id)
      return hasProc && hasKpis && hasRisks
    })
    if (hasFullProcess && !isUnlocked('full-process')) unlock('full-process')

    // Lean master (all onboarding milestones)
    const allMilestonesComplete = milestones.every((m) => m.completed)
    if (allMilestonesComplete && !isUnlocked('lean-master')) unlock('lean-master')

    // Improvement achievements (identificadas vs cerradas/implementadas)
    const improvementCount = improvements.length
    if (improvementCount >= 1 && !isUnlocked('first-improvement')) unlock('first-improvement')
    if (improvementCount >= 5 && !isUnlocked('five-improvements')) unlock('five-improvements')
    const closedImprovements = improvements.filter((o) => o.status === 'cerrada').length
    if (closedImprovements >= 1 && !isUnlocked('first-improvement-closed')) unlock('first-improvement-closed')
    if (closedImprovements >= 5 && !isUnlocked('five-improvements-closed')) unlock('five-improvements-closed')

    // Community shares
    const { communityPosts } = useAchievementStore.getState()
    if (communityPosts.length >= 1 && !isUnlocked('first-share')) unlock('first-share')
    if (communityPosts.length >= 5 && !isUnlocked('five-shares')) unlock('five-shares')
    // Effect que dispara unlocks tras cualquier cambio de actividad. Las
    // dependencias largas son intencionales: aunque .length captura mucho,
    // el body inspecciona items individuales (procedures, indicators, risks).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processes.length, risks.length, indicators.length, procedures.length, improvements.length, auditKeyCount, analysisKeyCount, milestones, streak, events.length, achievementsLoaded])
}
