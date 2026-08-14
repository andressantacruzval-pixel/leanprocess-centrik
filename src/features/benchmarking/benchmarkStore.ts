import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { identityMigration } from '@/utils/storeUtils'

interface ScoreEntry {
  date: string
  score: number
}

interface BenchmarkState {
  scoreHistory: ScoreEntry[]
  recordScore: (score: number) => void
}

/** Returns ISO week string "YYYY-Www" for a given date */
function getISOWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export const useBenchmarkStore = create<BenchmarkState>()(
  persist(
    (set, get) => ({
      scoreHistory: [],

      recordScore: (score: number) => {
        const now = new Date()
        const currentWeek = getISOWeek(now)
        const history = get().scoreHistory

        // Check if we already have an entry for this week
        const lastEntry = history.length > 0 ? history[history.length - 1] : null
        if (lastEntry && getISOWeek(new Date(lastEntry.date)) === currentWeek) {
          // Update existing entry for this week with latest score
          set({
            scoreHistory: history.map((e, i) =>
              i === history.length - 1 ? { ...e, score } : e
            ),
          })
          return
        }

        // Add new entry, keep last 12
        const newHistory = [
          ...history,
          { date: now.toISOString(), score },
        ].slice(-12)

        set({ scoreHistory: newHistory })
      },
    }),
    {
      name: 'lean-process-benchmark',
      version: 1,
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
