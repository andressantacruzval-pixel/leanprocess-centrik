import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useWorkspaceStore } from './workspaceStore'
import { toast } from './toastStore'
import { generateId } from '@/utils/id'
import { dbWrite } from '@/lib/dbWrite'
import type { InformationAsset } from '@/types/asset'
import { assetCriticality, assetLabel } from '@/types/asset'
import { createAsset, updateAsset, deleteAsset, getAssetsByCompany,
  createOperation, replaceOperationForAssetProcess, replaceJourneyLinks, getOperationsByCompany,
  type AssetOperationRow } from '@/services/assets.service'

function currentCompanyId(): string | null {
  return useWorkspaceStore.getState().activeCompanyId
}

// Deriva criticidad y etiqueta a partir de C·I·D antes de guardar.
function withDerived(a: InformationAsset): InformationAsset {
  return {
    ...a,
    criticality: assetCriticality(a.confidentiality, a.integrity, a.availability) || null,
    label: assetLabel(a.confidentiality),
  }
}

interface AssetState {
  assets: InformationAsset[]
  operations: AssetOperationRow[]
  getByProcess: (processId: string) => InformationAsset[]
  getOperation: (assetId: string, processId: string | null) => AssetOperationRow | undefined
  setOperation: (assetId: string, processId: string | null, operation: string) => void
  getTargets: (assetId: string, processId: string | null) => string[]
  getSources: (assetId: string, processId: string | null) => string[]
  setJourney: (assetId: string, processId: string | null, direction: 'to' | 'from', processIds: string[]) => void
  addAsset: (data: Partial<InformationAsset>) => InformationAsset | null
  updateAsset: (id: string, updates: Partial<InformationAsset>) => void
  deleteAsset: (id: string) => void
  clearCompanyData: (companyId: string) => void
  loadFromDB: (companyId: string) => Promise<void>
}

export const useAssetStore = create<AssetState>()(
  persist(
    (set, get) => ({
      assets: [],
      operations: [],

      getByProcess: (processId) => get().assets.filter((a) => a.process_id === processId),

      // Operación de ciclo de vida = fila sin origen/destino.
      getOperation: (assetId, processId) =>
        get().operations.find((o) => o.asset_id === assetId && o.process_id === (processId ?? null) && !o.source_process_id && !o.target_process_id),

      setOperation: (assetId, processId, operation) => {
        const companyId = currentCompanyId()
        if (!companyId) return
        const now = new Date().toISOString()
        const row: AssetOperationRow = {
          id: generateId(), company_id: companyId, asset_id: assetId, process_id: processId ?? null,
          operation, source_process_id: null, target_process_id: null, sort_order: 0,
          created_at: now, updated_at: now,
        }
        const prev = get().operations
        set({ operations: [...prev.filter((o) => !(o.asset_id === assetId && o.process_id === (processId ?? null) && !o.source_process_id && !o.target_process_id)), row] })
        void (async () => {
          await replaceOperationForAssetProcess(assetId, processId ?? null)
          await dbWrite('asset:operation', createOperation(row), { silent: true, rollback: () => set({ operations: prev }) })
        })()
      },

      // Trazabilidad (Data Journey): procesos a los que va / de los que viene.
      getTargets: (assetId, processId) =>
        get().operations.filter((o) => o.asset_id === assetId && o.process_id === (processId ?? null) && o.target_process_id).map((o) => o.target_process_id as string),
      getSources: (assetId, processId) =>
        get().operations.filter((o) => o.asset_id === assetId && o.process_id === (processId ?? null) && o.source_process_id).map((o) => o.source_process_id as string),

      setJourney: (assetId, processId, direction, processIds) => {
        const companyId = currentCompanyId()
        if (!companyId) return
        const now = new Date().toISOString()
        const key = direction === 'to' ? 'target_process_id' : 'source_process_id'
        const rows: AssetOperationRow[] = processIds.map((pid) => ({
          id: generateId(), company_id: companyId, asset_id: assetId, process_id: processId ?? null,
          operation: direction === 'to' ? 'transfiere' : 'recibe',
          source_process_id: direction === 'from' ? pid : null,
          target_process_id: direction === 'to' ? pid : null,
          sort_order: 0, created_at: now, updated_at: now,
        }))
        const prev = get().operations
        // Quita las filas de esta dirección para este activo+proceso y añade las nuevas.
        const kept = prev.filter((o) => !(o.asset_id === assetId && o.process_id === (processId ?? null) && o[key as 'target_process_id' | 'source_process_id']))
        set({ operations: [...kept, ...rows] })
        void (async () => {
          await replaceJourneyLinks(assetId, processId ?? null, direction)
          for (const r of rows) await dbWrite('asset:journey', createOperation(r), { silent: true, rollback: () => set({ operations: prev }) })
        })()
      },

      addAsset: (data) => {
        const companyId = currentCompanyId()
        if (!companyId) { toast.error('No hay empresa activa.'); return null }
        const now = new Date().toISOString()
        const asset = withDerived({
          id: generateId(),
          company_id: companyId,
          process_id: data.process_id ?? null,
          org_unit_id: data.org_unit_id ?? null,
          bpmn_element_id: data.bpmn_element_id ?? null,
          code: data.code ?? '',
          name: data.name ?? 'Nuevo activo',
          description: data.description ?? '',
          asset_type: data.asset_type ?? '',
          format: data.format ?? '',
          owner: data.owner ?? '',
          custodian: data.custodian ?? '',
          users: data.users ?? '',
          location: data.location ?? '',
          confidentiality: data.confidentiality ?? null,
          integrity: data.integrity ?? null,
          availability: data.availability ?? null,
          criticality: null,
          label: '',
          has_personal_data: data.has_personal_data ?? false,
          personal_data_category: data.personal_data_category ?? '',
          legal_requirements: data.legal_requirements ?? '',
          retention_period: data.retention_period ?? '',
          disposal_method: data.disposal_method ?? '',
          status: data.status ?? 'activo',
          review_date: data.review_date ?? null,
          next_review_date: data.next_review_date ?? null,
          version: data.version ?? '1.0',
          created_at: now,
          updated_at: now,
        })
        const prev = get().assets
        set({ assets: [...prev, asset] })
        void dbWrite('asset:create', createAsset(asset), {
          silent: true,
          rollback: () => set({ assets: prev }),
        })
        return asset
      },

      updateAsset: (id, updates) => {
        const prev = get().assets
        set({
          assets: prev.map((a) => (a.id === id ? withDerived({ ...a, ...updates, updated_at: new Date().toISOString() }) : a)),
        })
        const merged = get().assets.find((a) => a.id === id)
        if (!merged) return
        const { id: _i, company_id: _c, created_at: _ca, ...payload } = merged
        void dbWrite('asset:update', updateAsset(id, payload), {
          silent: true,
          rollback: () => set({ assets: prev }),
        })
      },

      deleteAsset: (id) => {
        const prev = get().assets
        set({ assets: prev.filter((a) => a.id !== id) })
        void dbWrite('asset:delete', deleteAsset(id), {
          silent: true,
          rollback: () => set({ assets: prev }),
        })
      },

      clearCompanyData: (companyId) =>
        set((s) => ({
          assets: s.assets.filter((a) => a.company_id !== companyId),
          operations: s.operations.filter((o) => o.company_id !== companyId),
        })),

      loadFromDB: async (companyId) => {
        const [assetsRes, opsRes] = await Promise.all([
          getAssetsByCompany(companyId),
          getOperationsByCompany(companyId),
        ])
        set((s) => ({
          assets: assetsRes.data
            ? [...s.assets.filter((a) => a.company_id !== companyId), ...(assetsRes.data as InformationAsset[])]
            : s.assets,
          operations: opsRes.data
            ? [...s.operations.filter((o) => o.company_id !== companyId), ...(opsRes.data as AssetOperationRow[])]
            : s.operations,
        }))
      },
    }),
    { name: 'lean-process-assets', version: 1 }
  )
)
