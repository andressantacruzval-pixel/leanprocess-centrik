import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProcedureData } from '@/lib/claude'
import { useChangeLogStore } from './changeLogStore'
import { useAuthStore } from './authStore'
import { useWorkspaceStore } from './workspaceStore'
import { generateId } from '@/utils/id'
import { identityMigration } from '@/utils/storeUtils'
import { dbWrite } from '@/lib/dbWrite'
import { useProcessStore } from './processStore'
import { useCompanyStore } from './companyStore'
import { buildDocCode, nextDocSeq } from '@/utils/docCode'

export interface StoredProcedure {
  id: string
  process_id: string
  data: ProcedureData
  created_at: string
  updated_at: string
}

/**
 * El codigo del documento al crearlo. Hasta el 2026-08-11 aqui habia un literal
 * `LP-PRO-001`, y por eso **70 de los 75 procedimientos en produccion comparten
 * identificador** (una sola empresa tiene 23 iguales).
 *
 * Se arma con lo que la empresa eligio en el onboarding + el area del proceso + un
 * correlativo propio. Los 70 viejos no se tocan: reciben el suyo al publicarse
 * (ver `usePublishProcess`), asi que no hace falta reescribir ni una fila.
 */
function buildCodigoParaProceso(processId: string, existentes: StoredProcedure[]): string {
  const companyId = useWorkspaceStore.getState().activeCompanyId
  const company = useWorkspaceStore.getState().companies.find((c) => c.id === companyId)
  const { processes } = useProcessStore.getState()
  const proceso = processes.find((p) => p.id === processId)
  const area = proceso?.org_unit_id
    ? useCompanyStore.getState().orgUnits.find((u) => u.id === proceso.org_unit_id)?.name
    : null

  // Solo los documentos de ESTA empresa cuentan para el correlativo.
  const idsDeLaEmpresa = new Set(processes.filter((p) => p.company_id === companyId).map((p) => p.id))
  const seq = nextDocSeq(
    existentes.filter((p) => idsDeLaEmpresa.has(p.process_id)).map((p) => p.data?.codigo)
  )

  return buildDocCode({
    pattern: company?.doc_code_pattern ?? null,
    prefix: company?.doc_code_prefix ?? null,
    areaName: area,
    seq,
  })
}

interface ProcedureState {
  procedures: StoredProcedure[]

  getProcedureByProcess: (processId: string) => StoredProcedure | null
  saveProcedure: (processId: string, data: Partial<ProcedureData>) => void
  updateProcedureData: (processId: string, updates: Partial<ProcedureData>) => void
  deleteProcedure: (processId: string) => void
  clearProcesses: (processIds: string[]) => void
  loadFromDB: (companyId: string) => Promise<void>
}

export const useProcedureStore = create<ProcedureState>()(
  persist(
    (set, get) => ({
      procedures: [],

      getProcedureByProcess: (processId: string) => {
        return get().procedures.find(p => p.process_id === processId) || null
      },

      saveProcedure: (processId: string, data: Partial<ProcedureData>) => {
        const now = new Date().toISOString()
        const existing = get().procedures.find(p => p.process_id === processId)
        const prev = get().procedures

        if (existing) {
          set(s => ({
            procedures: s.procedures.map(p =>
              p.process_id === processId
                ? { ...p, data: { ...p.data, ...data } as ProcedureData, updated_at: now }
                : p
            )
          }))
        } else {
          const defaultData: ProcedureData = {
            titulo: '',
            codigo: buildCodigoParaProceso(processId, get().procedures),
            // La version que se muestra e imprime es la del PROCESO (usePublishProcess).
            // Este campo queda por compatibilidad del jsonb; ya nadie lo lee.
            version: '1.0',
            fecha: now.split('T')[0],
            introduccion: '',
            objetivoGeneral: '',
            objetivosEspecificos: [],
            alcance: '',
            sipocEntradas: [],
            sipocSalidas: [],
            actividades: [],
            glosario: [],
            riesgos: [],
          }

          set(s => ({
            procedures: [...s.procedures, {
              id: generateId(),
              process_id: processId,
              data: { ...defaultData, ...data } as ProcedureData,
              created_at: now,
              updated_at: now,
            }]
          }))
        }
        const author = useAuthStore.getState().profile?.full_name || 'Usuario'
        useChangeLogStore.getState().addEntry({
          process_id: processId,
          action: 'procedure_generated',
          description: existing ? 'Procedimiento actualizado' : 'Procedimiento generado',
          author,
        })
        void (async () => {
          const { upsertProcedure } = await import('@/services/procedures.service')
          const proc = get().procedures.find(p => p.process_id === processId)
          if (!proc) return
          await dbWrite(
            'procedure:saveProcedure',
            upsertProcedure(processId, useWorkspaceStore.getState().activeCompanyId ?? '', proc.data as unknown as Record<string, unknown>),
            {
              successMessage: 'Procedimiento guardado.',
              errorMessage: 'No se pudo guardar el procedimiento en la nube.',
              rollback: () => set({ procedures: prev }),
            }
          )
        })()
      },

      updateProcedureData: (processId: string, updates: Partial<ProcedureData>) => {
        const prev = get().procedures
        set(s => ({
          procedures: s.procedures.map(p =>
            p.process_id === processId
              ? { ...p, data: { ...p.data, ...updates } as ProcedureData, updated_at: new Date().toISOString() }
              : p
          )
        }))
        void (async () => {
          const { upsertProcedure } = await import('@/services/procedures.service')
          const proc = get().procedures.find(p => p.process_id === processId)
          if (!proc) return
          // silent: actualizaciones pueden venir de auto-save del editor del procedimiento.
          await dbWrite(
            'procedure:updateProcedureData',
            upsertProcedure(processId, useWorkspaceStore.getState().activeCompanyId ?? '', proc.data as unknown as Record<string, unknown>),
            {
              silent: true,
              rollback: () => set({ procedures: prev }),
            }
          )
        })()
      },

      deleteProcedure: (processId: string) => {
        const prev = get().procedures
        set(s => ({
          procedures: s.procedures.filter(p => p.process_id !== processId)
        }))
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          await dbWrite(
            'procedure:deleteProcedure',
            supabase.from('procedures').delete().eq('process_id', processId),
            {
              successMessage: 'Procedimiento eliminado.',
              errorMessage: 'No se pudo eliminar el procedimiento.',
              rollback: () => set({ procedures: prev }),
            }
          )
        })()
      },

      clearProcesses: (processIds) => {
        const idSet = new Set(processIds)
        set((s) => ({ procedures: s.procedures.filter((p) => !idSet.has(p.process_id)) }))
      },

      loadFromDB: async (companyId: string) => {
        try {
          const { supabase } = await import('@/lib/supabase')
          const { data, error } = await supabase
            .from('procedures')
            .select('id, process_id, data, created_at, updated_at')
            .eq('company_id', companyId)
          if (error || !data) return
          const mapped: StoredProcedure[] = data
            .filter((row) => row.process_id != null && row.data != null)
            .map((row) => ({
              id: row.id,
              process_id: row.process_id as string,
              data: row.data as unknown as ProcedureData,
              created_at: row.created_at,
              updated_at: row.updated_at,
            }))
          set({ procedures: mapped })
        } catch (err) {
          console.warn('[procedureStore] Error cargando procedimientos desde DB:', err)
        }
      },
    }),
    {
      name: 'lean-process-procedures',
      version: 2,
      partialize: (state) => ({ procedures: state.procedures }),
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
