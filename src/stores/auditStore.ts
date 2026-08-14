import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuditItem } from '@/lib/procedureAi'
import type { Database } from '@/types/database'
import { useChangeLogStore } from './changeLogStore'
import { useAuthStore } from './authStore'
import { useWorkspaceStore } from './workspaceStore'
import { identityMigration } from '@/utils/storeUtils'
import { dbWrite } from '@/lib/dbWrite'

type AuditItemInsert = Database['public']['Tables']['audit_items']['Insert']

// Mapea el AuditItem del dominio (español, como la UI y Gemini lo generan)
// a las columnas discretas EN introducidas en la migración
// 20260417000004_normalize_audit_items.
function toAuditItemRow(auditId: string, item: AuditItem): AuditItemInsert {
  return {
    audit_id: auditId,
    criterion: item.actividad || null,
    status: 'pendiente',
    what_to_audit: item.queAuditar || null,
    how_to_audit: item.criterio || null,
    frequency: item.frecuencia || null,
    responsible: item.responsable || null,
    evidence_type: item.evidencia || null,
  }
}

interface AuditState {
  audits: Record<string, AuditItem[]> // processId → items
  setAuditItems: (processId: string, items: AuditItem[]) => void
  addAuditItem: (processId: string, item: AuditItem) => void
  updateAuditItem: (processId: string, index: number, item: AuditItem) => void
  removeAuditItem: (processId: string, index: number) => void
  clearProcesses: (processIds: string[]) => void
  loadFromDB: (companyId: string) => Promise<void>
}

export const useAuditStore = create<AuditState>()(
  persist(
    (set, get) => ({
      audits: {},

      setAuditItems: (processId, items) => {
        const prev = get().audits
        set((s) => ({ audits: { ...s.audits, [processId]: items } }))
        const author = useAuthStore.getState().profile?.full_name || 'Usuario'
        useChangeLogStore.getState().addEntry({
          process_id: processId,
          action: 'audit_created',
          description: `Programa de auditoria con ${items.length} punto(s) creado`,
          author,
        })
        const companyId = useWorkspaceStore.getState().activeCompanyId
        if (!companyId) return
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          const auditResult = await dbWrite(
            'audit:upsertAudit',
            supabase.from('audits')
              .upsert({ process_id: processId, company_id: companyId, updated_at: new Date().toISOString() }, { onConflict: 'process_id' })
              .select('id').single(),
            {
              successMessage: 'Programa de auditoría guardado.',
              errorMessage: 'No se pudo guardar el programa de auditoría.',
              rollback: () => set({ audits: prev }),
            }
          )
          if (!auditResult.ok || !auditResult.data) return
          const auditId = (auditResult.data as { id: string }).id
          await dbWrite(
            'audit:deleteItems',
            supabase.from('audit_items').delete().eq('audit_id', auditId),
            { silent: true }
          )
          if (items.length === 0) return
          await dbWrite(
            'audit:insertItems',
            supabase.from('audit_items').insert(items.map((item) => toAuditItemRow(auditId, item))),
            {
              errorMessage: 'No se pudieron guardar los items de auditoría.',
              rollback: () => set({ audits: prev }),
            }
          )
        })()
      },

      addAuditItem: (processId, item) => {
        const prev = get().audits
        set((s) => ({
          audits: { ...s.audits, [processId]: [...(s.audits[processId] || []), item] },
        }))
        const updatedItems = useAuditStore.getState().audits[processId] ?? []
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          const companyId = useWorkspaceStore.getState().activeCompanyId
          if (!companyId) return
          const auditResult = await dbWrite(
            'audit:upsertForAdd',
            supabase.from('audits')
              .upsert({ process_id: processId, company_id: companyId, updated_at: new Date().toISOString() }, { onConflict: 'process_id' })
              .select('id').single(),
            { silent: true }
          )
          if (!auditResult.ok || !auditResult.data) return
          const auditId = (auditResult.data as { id: string }).id
          await dbWrite(
            'audit:clearForAdd',
            supabase.from('audit_items').delete().eq('audit_id', auditId),
            { silent: true }
          )
          if (updatedItems.length === 0) return
          await dbWrite(
            'audit:reinsertForAdd',
            supabase.from('audit_items').insert(updatedItems.map((i) => toAuditItemRow(auditId, i))),
            {
              errorMessage: 'No se pudo guardar el ítem de auditoría.',
              rollback: () => set({ audits: prev }),
            }
          )
        })()
      },

      updateAuditItem: (processId, index, item) => {
        const prev = get().audits
        set((s) => {
          const current = s.audits[processId] || []
          const updated = current.map((it, i) => (i === index ? item : it))
          return { audits: { ...s.audits, [processId]: updated } }
        })
        const updatedItems = useAuditStore.getState().audits[processId] ?? []
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          const auditResult = await dbWrite(
            'audit:fetchForUpdate',
            supabase.from('audits').select('id').eq('process_id', processId).single(),
            { silent: true }
          )
          if (!auditResult.ok || !auditResult.data) return
          const auditId = (auditResult.data as { id: string }).id
          await dbWrite(
            'audit:clearForUpdate',
            supabase.from('audit_items').delete().eq('audit_id', auditId),
            { silent: true }
          )
          if (updatedItems.length === 0) return
          await dbWrite(
            'audit:reinsertForUpdate',
            supabase.from('audit_items').insert(updatedItems.map((i) => toAuditItemRow(auditId, i))),
            {
              errorMessage: 'No se pudo actualizar el ítem de auditoría.',
              rollback: () => set({ audits: prev }),
            }
          )
        })()
      },

      removeAuditItem: (processId, index) => {
        const prev = get().audits
        set((s) => {
          const current = s.audits[processId] || []
          return { audits: { ...s.audits, [processId]: current.filter((_, i) => i !== index) } }
        })
        const updatedItems = (useAuditStore.getState().audits[processId] ?? [])
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          const auditResult = await dbWrite(
            'audit:fetchAuditId',
            supabase.from('audits').select('id').eq('process_id', processId).single(),
            { silent: true }
          )
          if (!auditResult.ok || !auditResult.data) return
          const auditId = (auditResult.data as { id: string }).id
          await dbWrite(
            'audit:clearItems',
            supabase.from('audit_items').delete().eq('audit_id', auditId),
            {
              errorMessage: 'No se pudo eliminar el item de auditoría.',
              rollback: () => set({ audits: prev }),
            }
          )
          if (updatedItems.length === 0) return
          await dbWrite(
            'audit:reinsertItems',
            supabase.from('audit_items').insert(updatedItems.map((item) => toAuditItemRow(auditId, item))),
            {
              errorMessage: 'No se pudo reinsertar los items restantes.',
              rollback: () => set({ audits: prev }),
            }
          )
        })()
      },

      clearProcesses: (processIds) => {
        const idSet = new Set(processIds)
        set((s) => {
          const updated = { ...s.audits }
          idSet.forEach((id) => { delete updated[id] })
          return { audits: updated }
        })
      },

      loadFromDB: async (companyId) => {
        try {
          const { supabase } = await import('@/lib/supabase')
          const { data, error } = await supabase
            .from('audits')
            .select('process_id, audit_items(criterion, what_to_audit, how_to_audit, frequency, responsible, evidence_type)')
            .eq('company_id', companyId)
          if (error || !data) return
          const next: Record<string, AuditItem[]> = {}
          for (const row of data) {
            if (!row.process_id) continue
            const items = (row.audit_items ?? []) as Array<{
              criterion: string | null
              what_to_audit: string | null
              how_to_audit: string | null
              frequency: string | null
              responsible: string | null
              evidence_type: string | null
            }>
            next[row.process_id] = items.map((it) => ({
              actividad: it.criterion ?? '',
              queAuditar: it.what_to_audit ?? '',
              criterio: it.how_to_audit ?? '',
              evidencia: it.evidence_type ?? '',
              frecuencia: it.frequency ?? '',
              responsable: it.responsible ?? '',
            }))
          }
          set({ audits: next })
        } catch (err) {
          console.warn('[auditStore] Error cargando auditorías desde DB:', err)
        }
      },
    }),
    {
      name: 'lean-process-audits',
      version: 1,
      partialize: (state) => ({ audits: state.audits }),
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
