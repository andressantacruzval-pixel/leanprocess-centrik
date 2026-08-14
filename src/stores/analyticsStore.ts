/**
 * analyticsStore
 * ──────────────
 * Event tracking + simulated admin metrics for B2C analytics.
 *
 * In demo/localStorage mode, tracks real events for the current user
 * and provides simulated multi-user data for the admin dashboard.
 * When Supabase is integrated, real aggregates replace the simulated ones.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { identityMigration } from '@/utils/storeUtils'

// ── Types ────────────────────────────────────────────────────────────────

export type EventType =
  | 'page_view' | 'feature_use' | 'ai_use' | 'export'
  | 'create' | 'delete' | 'edit' | 'login' | 'session_start' | 'session_end'

export interface AnalyticsEvent {
  id: string
  type: EventType
  feature: string
  metadata?: Record<string, unknown>
  timestamp: number
}

export interface SessionData {
  id: string
  startTime: number
  endTime?: number
  pagesVisited: string[]
}

export interface FeatureUsageStat {
  feature: string
  usersCount: number
  percentage: number
}

export interface CohortRow {
  month: string
  registered: number
  retained: number[]
}

export interface FunnelStep {
  step: string
  count: number
  percentage: number
}

export interface RevenueMonth {
  month: string
  mrr: number
  newMrr: number
  churnedMrr: number
}

export interface AdminMetrics {
  totalUsers: number
  activeToday: number
  activeThisWeek: number
  activeThisMonth: number
  byPlan: { free: number; community: number; pro: number; max: number }
  byStatus: { trial: number; active: number; pastDue: number; canceled: number; paused: number }
  trialConversion: number
  monthlyChurn: number
  mrr: number
  arpu: number
  ltv: number
  featureUsage: FeatureUsageStat[]
  retentionCohorts: CohortRow[]
  conversionFunnel: FunnelStep[]
  revenueByMonth: RevenueMonth[]
  addOnsSold: { name: string; count: number; revenue: number }[]
  aiUsage: { feature: string; totalTokens: number; avgPerUser: number }[]
  avgSessionsPerWeek: number
  avgSessionDuration: number
  processesPerUser: { bucket: string; count: number }[]
  onboardingCompletion: { step: string; completed: number; percentage: number }[]
  dailyActiveUsers: { date: string; count: number }[]
  activityHeatmap: { hour: number; day: number; value: number }[]  // day 0=Mon..6=Sun, hour 0..23
  featureUsageByPlan: { feature: string; free: number; community: number; pro: number; max: number }[]
  registrationsByDay: { date: string; count: number }[]
  onboardingStateDistribution: { state: 'completed' | 'in_progress' | 'not_started'; count: number }[]
  totalAiCostUsd: number
  avgFeaturesPerUser: number
  featureUsageByDay: { date: string; feature: string; count: number }[]
  avgProcessesPerCompany: number
  usersWithOnboarding: OnboardingUserSummary[]
}

// ── Helpers ──────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export type DateRange = '7d' | '30d' | '90d' | 'all' | 'custom'

export interface OnboardingUserSummary {
  id: string
  name: string
  email: string
  companyId: string
  companyName: string
  plan: string
  createdAt: string
  // IA
  totalAiCostUsd: number
  totalTokens: number
  // Estructura empresa
  processLevelCount: number
  macroprocessCount: number
  topLevelProcessCount: number
  subprocessCount: number
  // Documentación generada
  bpmnCount: number
  procedureCount: number
  riskCount: number
  indicatorCount: number
  auditCount: number
  valueActivityCount: number
}


// ── Store ────────────────────────────────────────────────────────────────

interface AnalyticsState {
  events: AnalyticsEvent[]
  sessions: SessionData[]
  currentSessionId: string | null
  adminMetrics: AdminMetrics | null
  isLoadingMetrics: boolean

  trackEvent: (type: EventType, feature: string, metadata?: Record<string, unknown>) => void
  startSession: () => void
  endSession: () => void
  trackPageView: (path: string) => void
  fetchAdminMetrics: (range?: DateRange, customFrom?: string, customTo?: string) => Promise<void>
  getUserEventsByFeature: () => { feature: string; count: number }[]
  getEventsToday: () => number
  /** Elimina eventos con más de 90 días de antigüedad */
  purgeOldEvents: () => number
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      events: [],
      sessions: [],
      currentSessionId: null,
      adminMetrics: null,
      isLoadingMetrics: false,

      trackEvent: (type, feature, metadata) => {
        const event: AnalyticsEvent = { id: uid(), type, feature, metadata, timestamp: Date.now() }
        set((s) => ({ events: [...s.events.slice(-500), event] })) // keep last 500
      },

      startSession: () => {
        const id = uid()
        const session: SessionData = { id, startTime: Date.now(), pagesVisited: [] }
        set((s) => ({ sessions: [...s.sessions.slice(-50), session], currentSessionId: id }))
        get().trackEvent('session_start', 'app')
      },

      endSession: () => {
        const { currentSessionId } = get()
        if (!currentSessionId) return
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === currentSessionId ? { ...sess, endTime: Date.now() } : sess
          ),
          currentSessionId: null,
        }))
        get().trackEvent('session_end', 'app')
      },

      trackPageView: (path) => {
        const { currentSessionId, trackEvent } = get()
        trackEvent('page_view', path)
        if (currentSessionId) {
          set((s) => ({
            sessions: s.sessions.map((sess) =>
              sess.id === currentSessionId
                ? { ...sess, pagesVisited: [...sess.pagesVisited, path] }
                : sess
            ),
          }))
        }
      },

      fetchAdminMetrics: async (range: DateRange = '30d', customFrom?: string, customTo?: string) => {
        set({ isLoadingMetrics: true })
        try {
          const { fetchRealAdminMetrics } = await import('@/features/analytics/adminMetrics.service')
          const metrics = await fetchRealAdminMetrics(range, customFrom, customTo)
          set({ adminMetrics: metrics })
        } catch (err) {
          console.warn('[analyticsStore] fetchAdminMetrics error:', err)
        } finally {
          set({ isLoadingMetrics: false })
        }
      },

      getUserEventsByFeature: () => {
        const { events } = get()
        const counts: Record<string, number> = {}
        for (const e of events) {
          if (e.type === 'feature_use' || e.type === 'ai_use') {
            counts[e.feature] = (counts[e.feature] || 0) + 1
          }
        }
        return Object.entries(counts)
          .map(([feature, count]) => ({ feature, count }))
          .sort((a, b) => b.count - a.count)
      },

      getEventsToday: () => {
        const today = todayStr()
        return get().events.filter((e) => new Date(e.timestamp).toISOString().slice(0, 10) === today).length
      },

      purgeOldEvents: () => {
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
        const before = get().events.length
        set((s) => ({
          events: s.events.filter((e) => e.timestamp >= cutoff),
          sessions: s.sessions.filter((sess) => sess.startTime >= cutoff),
        }))
        return before - get().events.length
      },
    }),
    {
      name: 'lean-process-analytics',
      version: 1,
      partialize: (state) => ({
        events: state.events.slice(-500),
        sessions: state.sessions.slice(-50),
      }),
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
