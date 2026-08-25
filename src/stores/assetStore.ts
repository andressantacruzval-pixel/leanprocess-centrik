import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useWorkspaceStore } from './workspaceStore'
import { toast } from './toastStore'
import { generateId } from '@/utils/id'
import { dbWrite } from '@/lib/dbWrite'
import type { InformationAsset } from '@/types/asset'
import { assetCriticality, assetLabel } from '@/types/asset'
import type { AssetControl } from '@/types/assetRisk'
import { computeAssetControlScore, newAssetControlDefaults } from '@/types/assetRisk'
import { createAsset, updateAsset, deleteAsset, getAssetsByCompany,
  createOperation, replaceOperationForAssetProcess, replaceJourneyLinks, getOperationsByCompany,
  deleteOperationsForAsset, type AssetOperationRow,
  createAssetControl, updateAssetControl as updateAssetControlDB, deleteAssetControl as deleteAssetControlDB,
  deleteControlsForAsset, getAssetControlsByCompany } from '@/services/assets.service'

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
  assetControls: AssetControl[]
  getByProcess: (processId: string) => InformationAsset[]
  getAssetControls: (assetId: string) => AssetControl[]
  addAssetControl: (assetId: string, description?: string) => AssetControl | null
  updateAssetControl: (id: string, updates: Partial<AssetControl>) => void
  deleteAssetControl: (id: string) => void
  getOperation: (assetId: string, processId: string | null) => AssetOperationRow | undefined
  setOperation: (assetId: string, processId: string | null, operation: string) => void
  getTargets: (assetId: string, processId: string | null) => string[]
  getSources: (assetId: string, processId: string | null) => string[]
  setJourney: (assetId: string, processId: string | null, direction: 'to' | 'from', processIds: string[]) => void
  addAsset: (data: Partial<InformationAsset>) => InformationAsset | null
  updateAsset: (id: string, updates: Partial<InformationAsset>) => void
  linkAssetToNode: (assetId: string, bpmnElementId: string) => void
  unlinkAsset: (assetId: string) => void
  deleteAsset: (id: string) => void
  clearCompanyData: (companyId: string) => void
  loadFromDB: (companyId: string) => Promise<void>
}

export const useAssetStore = create<AssetState>()(
  persist(
    (set, get) => ({
      assets: [],
      operations: [],
      assetControls: [],

      getByProcess: (processId) => get().assets.filter((a) => a.process_id === processId),

      // ── Controles de seguridad del activo (Fase 2) ──────────────────────
      getAssetControls: (assetId) =>
        get().assetControls.filter((c) => c.asset_id === assetId).sort((a, b) => a.sort_order - b.sort_order),

      addAssetControl: (assetId, description) => {
        const companyId = currentCompanyId()
        if (!companyId) { toast.error('No hay empresa activa.'); return null }
        const now = new Date().toISOString()
        const existing = get().assetControls.filter((c) => c.asset_id === assetId)
        const control: AssetControl = {
          id: generateId(), asset_id: assetId, company_id: companyId,
          ...newAssetControlDefaults(), description: description ?? '',
          sort_order: existing.length, created_at: now, updated_at: now,
        }
        const prev = get().assetControls
        set({ assetControls: [...prev, control] })
        void dbWrite('asset:control:create', createAssetControl(control), {
          silent: true,
          rollback: () => set({ assetControls: prev }),
        })
        return control
      },

      updateAssetControl: (id, updates) => {
        const prev = get().assetControls
        set({
          assetControls: prev.map((c) => {
            if (c.id !== id) return c
            const merged = { ...c, ...updates, updated_at: new Date().toISOString() }
            const { score, effectiveness } = computeAssetControlScore(merged)
            return { ...merged, score, effectiveness }
          }),
        })
        const merged = get().assetControls.find((c) => c.id === id)
        if (!merged) return
        const { id: _i, asset_id: _a, company_id: _c, created_at: _ca, ...payload } = merged
        void dbWrite('asset:control:update', updateAssetControlDB(id, payload), {
          silent: true,
          rollback: () => set({ assetControls: prev }),
        })
      },

      deleteAssetControl: (id) => {
        const prev = get().assetControls
        // Borrado definitivo en la UI (no se revierte si la nube falla).
        set({ assetControls: prev.filter((c) => c.id !== id) })
        void dbWrite('asset:control:delete', deleteAssetControlDB(id), { silent: true })
      },

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
          probability: data.probability ?? null,
          threat: data.threat ?? '',
          vulnerability: data.vulnerability ?? '',
          columns: data.columns ?? [],
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

      // El activo (panel derecho) y el nodo del diagrama están DESACOPLADOS: son un
      // catálogo y sus vínculos. Vincular/desvincular solo cambia bpmn_element_id;
      // borrar un nodo no borra el activo (lo desvincula) y se puede re-vincular.
      linkAssetToNode: (assetId, bpmnElementId) => get().updateAsset(assetId, { bpmn_element_id: bpmnElementId }),
      unlinkAsset: (assetId) => get().updateAsset(assetId, { bpmn_element_id: null }),

      deleteAsset: (id) => {
        const prevAssets = get().assets
        const prevOps = get().operations
        const prevControls = get().assetControls
        // El borrado es DEFINITIVO en la UI: el estado local persistido es la fuente
        // de verdad. No se revierte si la nube falla (fila inexistente, RLS o tabla
        // sin migrar): reponer el activo era justo lo que impedía eliminarlo.
        set({
          assets: prevAssets.filter((a) => a.id !== id),
          operations: prevOps.filter((o) => o.asset_id !== id),
          assetControls: prevControls.filter((c) => c.asset_id !== id),
        })
        void (async () => {
          // Primero dependencias (por si el FK no está en cascada), luego el activo.
          await deleteOperationsForAsset(id)
          await deleteControlsForAsset(id)
          await dbWrite('asset:delete', deleteAsset(id), { silent: true })
        })()
      },

      clearCompanyData: (companyId) =>
        set((s) => ({
          assets: s.assets.filter((a) => a.company_id !== companyId),
          operations: s.operations.filter((o) => o.company_id !== companyId),
          assetControls: s.assetControls.filter((c) => c.company_id !== companyId),
        })),

      loadFromDB: async (companyId) => {
        const [assetsRes, opsRes, controlsRes] = await Promise.all([
          getAssetsByCompany(companyId),
          getOperationsByCompany(companyId),
          getAssetControlsByCompany(companyId),
        ])
        set((s) => ({
          assets: assetsRes.data
            ? [...s.assets.filter((a) => a.company_id !== companyId), ...(assetsRes.data as InformationAsset[]).map((a) => ({ ...a, columns: a.columns ?? [] }))]
            : s.assets,
          operations: opsRes.data
            ? [...s.operations.filter((o) => o.company_id !== companyId), ...(opsRes.data as AssetOperationRow[])]
            : s.operations,
          assetControls: controlsRes.data
            ? [...s.assetControls.filter((c) => c.company_id !== companyId), ...(controlsRes.data as AssetControl[])]
            : s.assetControls,
        }))
      },
    }),
    { name: 'lean-process-assets', version: 1 }
  )
)
