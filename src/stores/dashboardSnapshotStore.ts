import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { identityMigration } from '@/utils/storeUtils'

export interface DashboardSnapshot {
  date: string
  macroCount: number
  processCount: number
  depth1Count?: number
  depth2Count?: number
  bpmnCount: number
  procedureCount: number
  totalRisks: number
  totalControls: number
  totalKpis: number
  totalAuditItems: number
  vaEfficiency: number
}

interface DashboardSnapshotState {
  snapshots: DashboardSnapshot[]
  recordSnapshot: (stats: Omit<DashboardSnapshot, 'date'>, companyId: string) => void
  getLastSnapshot: () => DashboardSnapshot | null
  loadFromDB: (companyId: string) => Promise<void>
}

/** Returns ISO week string "YYYY-Www" for a given date */
function getISOWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function toDbRow(snap: DashboardSnapshot, companyId: string) {
  return {
    company_id: companyId,
    date: snap.date,
    macro_count: snap.macroCount,
    process_count: snap.processCount,
    bpmn_count: snap.bpmnCount,
    procedure_count: snap.procedureCount,
    total_risks: snap.totalRisks,
    total_controls: snap.totalControls,
    total_kpis: snap.totalKpis,
    total_audit_items: snap.totalAuditItems,
    va_efficiency: snap.vaEfficiency,
  }
}

export const useDashboardSnapshotStore = create<DashboardSnapshotState>()(
  persist(
    (set, get) => ({
      snapshots: [],

      recordSnapshot: (stats, companyId) => {
        const now = new Date()
        const currentWeek = getISOWeek(now)
        const existing = get().snapshots
        let newSnap: DashboardSnapshot

        const lastEntry = existing.length > 0 ? existing[existing.length - 1] : null
        if (lastEntry && getISOWeek(new Date(lastEntry.date)) === currentWeek) {
          newSnap = { ...stats, date: now.toISOString() }
          set({
            snapshots: existing.map((s, i) =>
              i === existing.length - 1 ? newSnap : s
            ),
          })
        } else {
          newSnap = { ...stats, date: now.toISOString() }
          set({
            snapshots: [...existing, newSnap].slice(-12),
          })
        }

        // Persiste en DB (fire-and-forget) — usa upsert por (company_id, semana)
        void (async () => {
          try {
            const { supabase } = await import('@/lib/supabase')
            // Buscar si ya existe un snapshot de esta semana para la empresa
            const weekStart = new Date(now)
            weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7))
            weekStart.setUTCHours(0, 0, 0, 0)
            const weekEnd = new Date(weekStart)
            weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

            const { data: existing } = await supabase
              .from('dashboard_snapshots')
              .select('id')
              .eq('company_id', companyId)
              .gte('date', weekStart.toISOString())
              .lt('date', weekEnd.toISOString())
              .limit(1)

            const row = toDbRow(newSnap, companyId)
            if (existing && existing.length > 0) {
              await supabase
                .from('dashboard_snapshots')
                .update(row)
                .eq('id', existing[0].id)
            } else {
              await supabase.from('dashboard_snapshots').insert(row)
            }
          } catch { /* silent */ }
        })()
      },

      getLastSnapshot: () => {
        const snaps = get().snapshots
        if (snaps.length < 2) return null
        return snaps[snaps.length - 2]
      },

      loadFromDB: async (companyId: string) => {
        try {
          const { supabase } = await import('@/lib/supabase')
          const { data, error } = await supabase
            .from('dashboard_snapshots')
            .select('*')
            .eq('company_id', companyId)
            .order('date', { ascending: true })
            .limit(12)
          if (error || !data) return
          const snapshots: DashboardSnapshot[] = data.map((r) => ({
            date: r.date,
            macroCount: r.macro_count,
            processCount: r.process_count,
            bpmnCount: r.bpmn_count,
            procedureCount: r.procedure_count,
            totalRisks: r.total_risks,
            totalControls: r.total_controls,
            totalKpis: r.total_kpis,
            totalAuditItems: r.total_audit_items,
            vaEfficiency: Number(r.va_efficiency),
          }))
          set({ snapshots })
        } catch { /* silent */ }
      },
    }),
    {
      name: 'lean-process-dashboard-snapshots',
      version: 2,
      partialize: (state) => ({ snapshots: state.snapshots }),
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
