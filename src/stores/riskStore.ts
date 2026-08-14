import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RiskItem, ControlItem, RiskCategory, MitigationType } from '@/types/risk'
import { computeControlScore, calculateResidual } from '@/types/risk'
import { useChangeLogStore } from './changeLogStore'
import { useAuthStore } from './authStore'
import { useWorkspaceStore } from './workspaceStore'
import { toast } from './toastStore'
import { supabase } from '@/lib/supabase'
import { RiskRowSchema, ControlRowSchema } from '@/lib/schemas/risk.schema'
import { generateId } from '@/utils/id'
import { identityMigration } from '@/utils/storeUtils'
import { dbWrite } from '@/lib/dbWrite'

// ── State ─────────────────────────────────────────────────────────────

interface RiskState {
  risks: RiskItem[]

  // ── CRUD ────────────────────────────────────────────────────────────
  addRisk: (processId: string, partial?: Partial<RiskItem>) => RiskItem
  updateRisk: (riskId: string, updates: Partial<RiskItem>) => void
  deleteRisk: (riskId: string) => void
  getRisksByProcess: (processId: string) => RiskItem[]

  // ── Controls ────────────────────────────────────────────────────────
  addControl: (riskId: string, description?: string, bpmnElementId?: string) => void
  updateControl: (riskId: string, controlId: string, updates: Partial<ControlItem>) => void
  deleteControl: (riskId: string, controlId: string) => void

  // ── Bulk actions ────────────────────────────────────────────────────
  bulkDeleteRisks: (ids: string[]) => void
  bulkUpdateCategory: (ids: string[], category: string) => void

  // ── Bulk AI import ──────────────────────────────────────────────────
  importAiRisks: (processId: string, items: Partial<RiskItem>[]) => void

  // ── Recalculate residual for a risk ─────────────────────────────────
  recalcResidual: (riskId: string) => void

  // Limpieza local al reiniciar empresa
  clearCompanyData: (companyId: string) => void

  // ── DB sync ──────────────────────────────────────────────────────────
  loadFromDB: (companyId: string) => Promise<void>
  syncToDB: (companyId: string) => Promise<void>
}

// ── Helpers ───────────────────────────────────────────────────────────

function newControlDefaults(): Omit<ControlItem, 'id'> {
  return {
    description: '',
    type: 1, nature: 1, doc: 1, freq: 1,
    evidence: 1, segregation: 1, training: 1, monitoring: 1,
    mitigates: 'Ambos' as MitigationType,
    score: 8,
    effectiveness: 'Deficiente' as const,
  }
}

function recalc(risk: RiskItem): RiskItem {
  const { residualProbability, residualImpact } = calculateResidual(
    risk.inherentProbability,
    risk.inherentImpact,
    risk.controls,
  )
  return { ...risk, residualProbability, residualImpact }
}

function toDbRiskRow(r: RiskItem): Record<string, unknown> {
  return {
    title: r.title,
    description: r.description,
    category: r.category,
    process_step: r.processStep,
    risk_cause: r.riskCause,
    risk_event: r.riskEvent,
    risk_effect: r.riskEffect,
    inherent_probability: r.inherentProbability,
    inherent_impact: r.inherentImpact,
    residual_probability: r.residualProbability,
    residual_impact: r.residualImpact,
    bpmn_element_id: r.bpmnElementId ?? null,
  }
}

// ── Store ─────────────────────────────────────────────────────────────

export const useRiskStore = create<RiskState>()(
  persist(
    (set, get) => ({
      risks: [],

      addRisk: (processId, partial) => {
        const now = new Date().toISOString()
        const risk: RiskItem = {
          id: generateId(),
          process_id: processId,
          company_id: useWorkspaceStore.getState().activeCompanyId ?? '',
          processStep: partial?.processStep ?? '',
          title: partial?.title ?? 'Nuevo riesgo',
          riskCause: partial?.riskCause ?? '',
          riskEvent: partial?.riskEvent ?? '',
          riskEffect: partial?.riskEffect ?? '',
          description: partial?.description ?? '',
          category: partial?.category ?? 'Operacional',
          inherentProbability: partial?.inherentProbability ?? 3,
          inherentImpact: partial?.inherentImpact ?? 3,
          controls: [],
          residualProbability: partial?.inherentProbability ?? 3,
          residualImpact: partial?.inherentImpact ?? 3,
          bpmnElementId: partial?.bpmnElementId,
          created_at: now,
        }
        const prev = get().risks
        set((s) => ({ risks: [...s.risks, risk] }))
        toast.success('Riesgo creado exitosamente')
        const riskRow = RiskRowSchema.parse({
          id: risk.id,
          process_id: risk.process_id,
          company_id: risk.company_id ?? '',
          process_step: risk.processStep,
          title: risk.title,
          risk_cause: risk.riskCause,
          risk_event: risk.riskEvent,
          risk_effect: risk.riskEffect,
          description: risk.description,
          category: risk.category,
          inherent_probability: risk.inherentProbability,
          inherent_impact: risk.inherentImpact,
          residual_probability: risk.residualProbability,
          residual_impact: risk.residualImpact,
          bpmn_element_id: risk.bpmnElementId,
        })
        void dbWrite(
          'risk:addRisk',
          supabase.from('risks').insert(riskRow as never),
          {
            successMessage: 'Riesgo guardado.',
            errorMessage: 'No se pudo guardar el riesgo en la nube.',
            rollback: () => set({ risks: prev }),
          }
        )
        return risk
      },

      updateRisk: (riskId, updates) => {
        const prev = get().risks
        const current = prev.find((r) => r.id === riskId)
        if (!current) return
        const merged = { ...current, ...updates }
        const final = (updates.inherentProbability !== undefined || updates.inherentImpact !== undefined)
          ? recalc(merged) : merged
        set((s) => ({ risks: s.risks.map((r) => (r.id === riskId ? final : r)) }))
        void dbWrite(
          'risk:updateRisk',
          supabase.from('risks').update(toDbRiskRow(final) as never).eq('id', riskId),
          {
            errorMessage: 'No se pudo actualizar el riesgo.',
            rollback: () => set({ risks: prev }),
          }
        )
      },

      deleteRisk: (riskId) => {
        const prev = get().risks
        set((s) => ({ risks: s.risks.filter((r) => r.id !== riskId) }))
        void (async () => {
          const { deleteRisk: deleteInDB } = await import('@/services/risks.service')
          await dbWrite(
            'risk:deleteRisk',
            deleteInDB(riskId),
            {
              successMessage: 'Riesgo eliminado.',
              errorMessage: 'No se pudo eliminar el riesgo.',
              rollback: () => set({ risks: prev }),
            }
          )
        })()
      },

      bulkDeleteRisks: (ids) => {
        const prev = get().risks
        const idSet = new Set(ids)
        set((s) => ({ risks: s.risks.filter((r) => !idSet.has(r.id)) }))
        toast.success('Riesgos eliminados')
        void (async () => {
          const { bulkDeleteRisks: bulkDeleteInDB } = await import('@/services/risks.service')
          await dbWrite(
            'risk:bulkDelete',
            bulkDeleteInDB(ids),
            {
              errorMessage: 'No se pudieron eliminar los riesgos.',
              rollback: () => set({ risks: prev }),
            }
          )
        })()
      },

      bulkUpdateCategory: (ids, category) => {
        const prev = get().risks
        const idSet = new Set(ids)
        set((s) => ({
          risks: s.risks.map((r) =>
            idSet.has(r.id) ? { ...r, category: category as RiskCategory } : r
          ),
        }))
        toast.success('Categoria actualizada')
        void dbWrite(
          'risk:bulkUpdateCategory',
          supabase.from('risks').update({ category } as never).in('id', ids),
          {
            errorMessage: 'No se pudo actualizar la categoría de los riesgos.',
            rollback: () => set({ risks: prev }),
          }
        )
      },

      getRisksByProcess: (processId) => {
        return get().risks.filter((r) => r.process_id === processId)
      },

      addControl: (riskId, description, bpmnElementId) => {
        const control: ControlItem = { id: generateId(), ...newControlDefaults(), description: description ?? '', bpmnElementId }
        const prev = get().risks
        set((s) => ({
          risks: s.risks.map((r) => {
            if (r.id !== riskId) return r
            return recalc({ ...r, controls: [...r.controls, control] })
          }),
        }))
        const controlRow = ControlRowSchema.parse({
          id: control.id,
          risk_id: riskId,
          description: control.description,
          type: control.type,
          nature: control.nature,
          doc: control.doc,
          freq: control.freq,
          evidence: control.evidence,
          segregation: control.segregation,
          training: control.training,
          monitoring: control.monitoring,
          mitigates: control.mitigates,
          score: control.score,
          effectiveness: control.effectiveness,
        })
        void dbWrite(
          'risk:addControl',
          supabase.from('risk_controls').insert(controlRow as never),
          {
            successMessage: 'Control guardado.',
            errorMessage: 'No se pudo guardar el control.',
            rollback: () => set({ risks: prev }),
          }
        )
      },

      updateControl: (riskId, controlId, updates) => {
        const prev = get().risks
        set((s) => ({
          risks: s.risks.map((r) => {
            if (r.id !== riskId) return r
            const controls = r.controls.map((c) => {
              if (c.id !== controlId) return c
              const merged = { ...c, ...updates }
              const { score, effectiveness } = computeControlScore(merged)
              return { ...merged, score, effectiveness }
            })
            return recalc({ ...r, controls })
          }),
        }))
        const { bpmnElementId: _bpmn, id: _id, ...dbUpdates } = updates as Record<string, unknown>
        void dbWrite(
          'risk:updateControl',
          supabase.from('risk_controls').update(dbUpdates as never).eq('id', controlId),
          {
            successMessage: 'Control actualizado.',
            errorMessage: 'No se pudo actualizar el control.',
            rollback: () => set({ risks: prev }),
          }
        )
      },

      deleteControl: (riskId, controlId) => {
        const prev = get().risks
        set((s) => ({
          risks: s.risks.map((r) => {
            if (r.id !== riskId) return r
            return recalc({ ...r, controls: r.controls.filter((c) => c.id !== controlId) })
          }),
        }))
        void (async () => {
          const { deleteControl: deleteInDB } = await import('@/services/risks.service')
          await dbWrite(
            'risk:deleteControl',
            deleteInDB(controlId),
            {
              successMessage: 'Control eliminado.',
              errorMessage: 'No se pudo eliminar el control.',
              rollback: () => set({ risks: prev }),
            }
          )
        })()
      },

      importAiRisks: (processId, items) => {
        const now = new Date().toISOString()
        const newRisks: RiskItem[] = items.map((item) => ({
          id: generateId(),
          process_id: processId,
          company_id: useWorkspaceStore.getState().activeCompanyId ?? '',
          processStep: item.processStep ?? '',
          title: item.title ?? '',
          riskCause: '',
          riskEvent: '',
          riskEffect: '',
          description: item.description ?? '',
          category: item.category ?? 'Operacional',
          inherentProbability: item.inherentProbability ?? 3,
          inherentImpact: item.inherentImpact ?? 3,
          controls: (item.controls ?? []).map((c) => {
            const { score, effectiveness } = computeControlScore(c)
            return { ...c, id: c.id || generateId(), score, effectiveness }
          }),
          residualProbability: 3,
          residualImpact: 3,
          created_at: now,
        }))

        // Recalc residual for each
        const calculated = newRisks.map(recalc)

        set((s) => ({ risks: [...s.risks, ...calculated] }))
        toast.success('Riesgos generados con IA exitosamente')
        const author = useAuthStore.getState().profile?.full_name || 'Usuario'
        useChangeLogStore.getState().addEntry({
          process_id: processId,
          action: 'risks_identified',
          description: `${calculated.length} riesgo(s) identificados por IA`,
          author,
        })
        for (const risk of calculated) {
          const riskRow = RiskRowSchema.parse({
            id: risk.id,
            process_id: risk.process_id,
            company_id: risk.company_id ?? '',
            process_step: risk.processStep,
            title: risk.title,
            risk_cause: risk.riskCause,
            risk_event: risk.riskEvent,
            risk_effect: risk.riskEffect,
            description: risk.description,
            category: risk.category,
            inherent_probability: risk.inherentProbability,
            inherent_impact: risk.inherentImpact,
            residual_probability: risk.residualProbability,
            residual_impact: risk.residualImpact,
            bpmn_element_id: risk.bpmnElementId,
          })
          void (async () => {
            const result = await dbWrite(
              'risk:importAi:risk',
              supabase.from('risks').insert(riskRow as never),
              { silent: true }
            )
            if (!result.ok || risk.controls.length === 0) return
            const controlRows = risk.controls.map((c) =>
              ControlRowSchema.parse({
                id: c.id, risk_id: risk.id, description: c.description,
                type: c.type, nature: c.nature, doc: c.doc, freq: c.freq,
                evidence: c.evidence, segregation: c.segregation, training: c.training,
                monitoring: c.monitoring, mitigates: c.mitigates, score: c.score, effectiveness: c.effectiveness,
              })
            )
            await dbWrite(
              'risk:importAi:controls',
              supabase.from('risk_controls').insert(controlRows as never),
              { silent: true }
            )
          })()
        }
      },

      recalcResidual: (riskId) => {
        set((s) => ({
          risks: s.risks.map((r) => (r.id === riskId ? recalc(r) : r)),
        }))
      },

      clearCompanyData: (companyId) =>
        set((s) => ({ risks: s.risks.filter((r) => r.company_id !== companyId) })),

      // --- DB sync ---
      loadFromDB: async (companyId) => {
        try {
          const { data: risksData } = await supabase
            .from('risks')
            .select('*, controls:risk_controls(*)')
            .eq('company_id', companyId)
            .order('created_at')
          if (risksData != null && risksData.length > 0) {
            // Map DB rows to RiskItem shape
            const mapped: RiskItem[] = (risksData as Record<string, unknown>[]).map((r) => ({
              id: r.id as string,
              process_id: r.process_id as string,
              processStep: (r.process_step as string) ?? '',
              title: r.title as string,
              riskCause: (r.risk_cause as string) ?? '',
              riskEvent: (r.risk_event as string) ?? '',
              riskEffect: (r.risk_effect as string) ?? '',
              description: (r.description as string) ?? '',
              category: (r.category as RiskCategory) ?? 'Operacional',
              inherentProbability: (r.inherent_probability as number) ?? 3,
              inherentImpact: (r.inherent_impact as number) ?? 3,
              residualProbability: (r.residual_probability as number) ?? 3,
              residualImpact: (r.residual_impact as number) ?? 3,
              bpmnElementId: r.bpmn_element_id as string | undefined,
              controls: ((r.controls as Record<string, unknown>[]) ?? []).map((c) => ({
                id: c.id as string,
                description: (c.description as string) ?? '',
                type: (c.type as ControlItem['type']) ?? 1,
                nature: (c.nature as ControlItem['nature']) ?? 1,
                doc: (c.doc as ControlItem['doc']) ?? 1,
                freq: (c.freq as ControlItem['freq']) ?? 1,
                evidence: (c.evidence as ControlItem['evidence']) ?? 1,
                segregation: (c.segregation as ControlItem['segregation']) ?? 1,
                training: (c.training as ControlItem['training']) ?? 1,
                monitoring: (c.monitoring as ControlItem['monitoring']) ?? 1,
                mitigates: (c.mitigates as MitigationType) ?? 'Ambos',
                score: (c.score as number) ?? 8,
                effectiveness: (c.effectiveness as ControlItem['effectiveness']) ?? 'Deficiente',
              } as ControlItem)),
              created_at: r.created_at as string,
            }))
            set({ risks: mapped })
          }
        } catch { /* silent — localStorage remains source of truth on error */ }
      },

      syncToDB: async (companyId) => {
        const { risks } = get()
        if (risks.length === 0) return
        try {
          // Validar y mapear a filas snake_case antes de upsert
          const riskRows = risks.map((r) =>
            RiskRowSchema.parse({
              id: r.id,
              process_id: r.process_id,
              company_id: companyId,
              process_step: r.processStep,
              title: r.title,
              risk_cause: r.riskCause,
              risk_event: r.riskEvent,
              risk_effect: r.riskEffect,
              description: r.description,
              category: r.category,
              inherent_probability: r.inherentProbability,
              inherent_impact: r.inherentImpact,
              residual_probability: r.residualProbability,
              residual_impact: r.residualImpact,
              bpmn_element_id: r.bpmnElementId,
            })
          )
          await supabase.from('risks').upsert(riskRows)

          const controlRows = risks.flatMap((r) =>
            r.controls.map((c) =>
              ControlRowSchema.parse({
                id: c.id,
                risk_id: r.id,
                description: c.description,
                type: c.type,
                nature: c.nature,
                doc: c.doc,
                freq: c.freq,
                evidence: c.evidence,
                segregation: c.segregation,
                training: c.training,
                monitoring: c.monitoring,
                mitigates: c.mitigates,
                score: c.score,
                effectiveness: c.effectiveness,
              })
            )
          )
          if (controlRows.length > 0) {
            await supabase.from('risk_controls').upsert(controlRows)
          }
        } catch (err) {
          console.warn('[riskStore] syncToDB error:', err)
        }
      },
    }),
    {
      name: 'lean-process-risks',
      version: 1,
      partialize: (state) => ({ risks: state.risks }),
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
