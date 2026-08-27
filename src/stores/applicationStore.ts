import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useWorkspaceStore } from './workspaceStore'
import { toast } from './toastStore'
import { generateId } from '@/utils/id'
import { dbWrite } from '@/lib/dbWrite'
import type { Application, ApplicationUsage } from '@/types/application'
import {
  createApplication, updateApplication, deleteApplication, getApplicationsByCompany,
  createUsage, updateUsage as updateUsageDB, deleteUsageById, deleteUsagesForApplication,
  getUsagesByCompany,
} from '@/services/applications.service'

function currentCompanyId(): string | null {
  return useWorkspaceStore.getState().activeCompanyId
}

interface AppState {
  applications: Application[]
  usages: ApplicationUsage[]
  getUsagesByProcess: (processId: string) => ApplicationUsage[]
  addApplication: (data: Partial<Application>) => Application | null
  updateApplication: (id: string, updates: Partial<Application>) => void
  deleteApplication: (id: string) => void
  addUsage: (applicationId: string, processId: string | null, bpmnElementId: string | null, activityName: string) => ApplicationUsage | null
  updateUsage: (id: string, updates: Partial<ApplicationUsage>) => void
  deleteUsage: (id: string) => void
  clearCompanyData: (companyId: string) => void
  loadFromDB: (companyId: string) => Promise<void>
}

export const useApplicationStore = create<AppState>()(
  persist(
    (set, get) => ({
      applications: [],
      usages: [],

      getUsagesByProcess: (processId) => get().usages.filter((u) => u.process_id === processId),

      addApplication: (data) => {
        const companyId = currentCompanyId()
        if (!companyId) { toast.error('No hay empresa activa.'); return null }
        const now = new Date().toISOString()
        const app: Application = {
          id: generateId(), company_id: companyId,
          code: data.code ?? '', name: data.name ?? 'Nueva aplicación', description: data.description ?? '',
          category: data.category ?? '', ownership: data.ownership ?? '', vendor: data.vendor ?? '',
          deployment: data.deployment ?? '', url: data.url ?? '',
          criticality: data.criticality ?? null, business_owner: data.business_owner ?? '',
          technical_custodian: data.technical_custodian ?? '', status: data.status ?? 'activo',
          has_api: data.has_api ?? false, integration_type: data.integration_type ?? '',
          automatable: data.automatable ?? false, handles_personal_data: data.handles_personal_data ?? false,
          auth_method: data.auth_method ?? '', license_model: data.license_model ?? '',
          cost_estimate: data.cost_estimate ?? null, cost_period: data.cost_period ?? '',
          version: data.version ?? '', created_at: now, updated_at: now,
        }
        set((s) => ({ applications: [...s.applications, app] }))
        void dbWrite('application:create', createApplication(app), { silent: true })
        return app
      },

      updateApplication: (id, updates) => {
        set((s) => ({ applications: s.applications.map((a) => (a.id === id ? { ...a, ...updates, updated_at: new Date().toISOString() } : a)) }))
        const merged = get().applications.find((a) => a.id === id)
        if (!merged) return
        const { id: _i, company_id: _c, created_at: _ca, ...payload } = merged
        void dbWrite('application:update', updateApplication(id, payload), { silent: true })
      },

      deleteApplication: (id) => {
        set((s) => ({ applications: s.applications.filter((a) => a.id !== id), usages: s.usages.filter((u) => u.application_id !== id) }))
        void (async () => {
          await deleteUsagesForApplication(id)
          await dbWrite('application:delete', deleteApplication(id), { silent: true })
        })()
      },

      addUsage: (applicationId, processId, bpmnElementId, activityName) => {
        const companyId = currentCompanyId()
        if (!companyId) { toast.error('No hay empresa activa.'); return null }
        // Evita duplicar el mismo uso (misma app + mismo nodo/proceso).
        const dup = get().usages.find((u) => u.application_id === applicationId && u.process_id === (processId ?? null) && u.bpmn_element_id === (bpmnElementId ?? null))
        if (dup) return dup
        const now = new Date().toISOString()
        const usage: ApplicationUsage = {
          id: generateId(), company_id: companyId, application_id: applicationId,
          process_id: processId ?? null, bpmn_element_id: bpmnElementId ?? null,
          activity_name: activityName ?? '', note: '', sort_order: 0, created_at: now, updated_at: now,
        }
        set((s) => ({ usages: [...s.usages, usage] }))
        void dbWrite('application:usage:create', createUsage(usage), { silent: true })
        return usage
      },

      updateUsage: (id, updates) => {
        set((s) => ({ usages: s.usages.map((u) => (u.id === id ? { ...u, ...updates, updated_at: new Date().toISOString() } : u)) }))
        void dbWrite('application:usage:update', updateUsageDB(id, updates), { silent: true })
      },

      deleteUsage: (id) => {
        set((s) => ({ usages: s.usages.filter((u) => u.id !== id) }))
        void dbWrite('application:usage:delete', deleteUsageById(id), { silent: true })
      },

      clearCompanyData: (companyId) =>
        set((s) => ({
          applications: s.applications.filter((a) => a.company_id !== companyId),
          usages: s.usages.filter((u) => u.company_id !== companyId),
        })),

      loadFromDB: async (companyId) => {
        const [appsRes, usagesRes] = await Promise.all([
          getApplicationsByCompany(companyId),
          getUsagesByCompany(companyId),
        ])
        set((s) => ({
          applications: appsRes.data ? [...s.applications.filter((a) => a.company_id !== companyId), ...(appsRes.data as Application[])] : s.applications,
          usages: usagesRes.data ? [...s.usages.filter((u) => u.company_id !== companyId), ...(usagesRes.data as ApplicationUsage[])] : s.usages,
        }))
      },
    }),
    { name: 'lean-process-applications', version: 1 }
  )
)
