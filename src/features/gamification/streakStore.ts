/**
 * streakStore
 * ───────────
 * Duolingo-style activity streak tracking.
 * Records daily activity and calculates current/longest streaks.
 * Estado sincronizado con Supabase via loadFromDB + writes en cada mutación.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { identityMigration } from '@/utils/storeUtils'
import { supabase } from '@/lib/supabase'
import { dbWrite } from '@/lib/dbWrite'

interface StreakState {
  /** Current consecutive days streak */
  currentStreak: number
  /** All-time longest streak */
  longestStreak: number
  /** ISO date string of last recorded activity */
  lastActivityDate: string | null
  /** Map of date → active (last 90 days max) */
  activityHistory: Record<string, boolean>
  /** Whether the streak fire animation was shown today */
  shownToday: boolean

  /** Streak freeze: available freezes (resets monthly, starts at 2) */
  freezesAvailable: number
  /** Month string when freezes were last reset (YYYY-MM) */
  freezesResetMonth: string | null
  /** Map of date → true for frozen days */
  freezesUsed: Record<string, boolean>

  recordActivity: () => void
  useFreeze: () => boolean
  getStreakData: () => {
    current: number
    longest: number
    todayDone: boolean
    lastSevenDays: { date: string; active: boolean; frozen: boolean }[]
  }
  loadFromDB: (userId: string) => Promise<void>
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function calcStreak(history: Record<string, boolean>, freezes: Record<string, boolean> = {}): number {
  let streak = 0
  const d = new Date()
  const today = d.toISOString().slice(0, 10)
  if (!history[today] && !freezes[today]) {
    d.setDate(d.getDate() - 1)
    const yesterday = d.toISOString().slice(0, 10)
    if (!history[yesterday] && !freezes[yesterday]) return 0
    if (history[yesterday]) streak = 1
    d.setDate(d.getDate() - 1)
  } else {
    if (history[today]) streak = 1
    d.setDate(d.getDate() - 1)
  }

  while (true) {
    const dateStr = d.toISOString().slice(0, 10)
    if (history[dateStr]) {
      streak++
    } else if (freezes[dateStr]) {
      // Frozen: no incrementa pero no rompe
    } else {
      break
    }
    d.setDate(d.getDate() - 1)
    if (streak > 365) break
  }
  return streak
}

function buildUpsertPayload(userId: string, state: Omit<StreakState, 'recordActivity' | 'useFreeze' | 'getStreakData' | 'loadFromDB'>) {
  return {
    user_id: userId,
    current_streak: state.currentStreak,
    longest_streak: state.longestStreak,
    last_activity_date: state.lastActivityDate,
    activity_history: state.activityHistory,
    freezes_available: state.freezesAvailable,
    freezes_reset_month: state.freezesResetMonth,
    freezes_used: state.freezesUsed,
    updated_at: new Date().toISOString(),
  }
}

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: null,
      activityHistory: {},
      shownToday: false,
      freezesAvailable: 2,
      freezesResetMonth: null,
      freezesUsed: {},

      loadFromDB: async (userId: string) => {
        const { data, error } = await supabase
          .from('user_streaks')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()

        if (error) {
          console.warn('[streakStore] Error cargando streak desde DB:', error.message)
          return
        }

        if (!data) {
          // Primera vez: upsert en lugar de insert para tolerar reinicios de onboarding
          const state = get()
          await supabase.from('user_streaks').upsert(buildUpsertPayload(userId, state), { onConflict: 'user_id' })
          return
        }

        set({
          currentStreak: data.current_streak ?? 0,
          longestStreak: data.longest_streak ?? 0,
          lastActivityDate: data.last_activity_date ?? null,
          activityHistory: (data.activity_history as Record<string, boolean>) ?? {},
          freezesAvailable: data.freezes_available ?? 2,
          freezesResetMonth: data.freezes_reset_month ?? null,
          freezesUsed: (data.freezes_used as Record<string, boolean>) ?? {},
        })
      },

      recordActivity: () => {
        const today = todayStr()
        const state = get()

        const currentMonth = today.slice(0, 7)
        let freezesAvailable = state.freezesAvailable
        let freezesResetMonth = state.freezesResetMonth
        if (freezesResetMonth !== currentMonth) {
          freezesAvailable = 2
          freezesResetMonth = currentMonth
        }

        if (state.lastActivityDate === today) return

        const newHistory = { ...state.activityHistory, [today]: true }

        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 90)
        const cutoffStr = cutoff.toISOString().slice(0, 10)
        for (const key of Object.keys(newHistory)) {
          if (key < cutoffStr) delete newHistory[key]
        }

        const newStreak = calcStreak(newHistory, state.freezesUsed)
        const newLongest = Math.max(state.longestStreak, newStreak)

        const nextState = {
          activityHistory: newHistory,
          lastActivityDate: today,
          currentStreak: newStreak,
          longestStreak: newLongest,
          shownToday: false,
          freezesAvailable,
          freezesResetMonth,
        }

        set(nextState)

        // Persistir en Supabase de forma async (fire-and-forget silencioso)
        const userId = supabase.auth.getSession().then(({ data: s }) => s.session?.user.id)
        void userId.then((uid) => {
          if (!uid) return
          void dbWrite(
            'streak:recordActivity',
            supabase.from('user_streaks').upsert(buildUpsertPayload(uid, { ...state, ...nextState }), { onConflict: 'user_id' }),
            { silent: true }
          )
        })
      },

      useFreeze: () => {
        const state = get()
        const today = todayStr()
        const currentMonth = today.slice(0, 7)

        let freezesAvailable = state.freezesAvailable
        let freezesResetMonth = state.freezesResetMonth
        if (freezesResetMonth !== currentMonth) {
          freezesAvailable = 2
          freezesResetMonth = currentMonth
        }

        if (state.activityHistory[today] || state.freezesUsed[today] || freezesAvailable <= 0) {
          return false
        }

        const newFreezes = { ...state.freezesUsed, [today]: true }
        const newStreak = calcStreak(state.activityHistory, newFreezes)
        const newLongest = Math.max(state.longestStreak, newStreak)

        const nextState = {
          freezesUsed: newFreezes,
          freezesAvailable: freezesAvailable - 1,
          freezesResetMonth,
          currentStreak: newStreak,
          longestStreak: newLongest,
        }

        set(nextState)

        void supabase.auth.getSession().then(({ data: s }) => {
          const uid = s.session?.user.id
          if (!uid) return
          void dbWrite(
            'streak:useFreeze',
            supabase.from('user_streaks').upsert(buildUpsertPayload(uid, { ...state, ...nextState }), { onConflict: 'user_id' }),
            { silent: true }
          )
        })

        return true
      },

      getStreakData: () => {
        const state = get()
        const history = state.activityHistory
        const freezes = state.freezesUsed
        const current = calcStreak(history, freezes)
        const todayDone = !!history[todayStr()]

        const lastSevenDays: { date: string; active: boolean; frozen: boolean }[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const dateStr = d.toISOString().slice(0, 10)
          lastSevenDays.push({ date: dateStr, active: !!history[dateStr], frozen: !!freezes[dateStr] })
        }

        return { current, longest: state.longestStreak, todayDone, lastSevenDays }
      },
    }),
    {
      name: 'lean-process-streak',
      version: 1,
      partialize: (state) => ({
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
        lastActivityDate: state.lastActivityDate,
        activityHistory: state.activityHistory,
        freezesAvailable: state.freezesAvailable,
        freezesResetMonth: state.freezesResetMonth,
        freezesUsed: state.freezesUsed,
      }),
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
