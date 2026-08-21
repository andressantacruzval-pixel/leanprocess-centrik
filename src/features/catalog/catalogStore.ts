import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { generateId } from '@/utils/id'
import { dbWrite } from '@/lib/dbWrite'

function currentCompanyId(): string | null {
  return useWorkspaceStore.getState().activeCompanyId
}

export interface SipocSupplier {
  id: string
  name: string
  created_at: string
}

export interface SipocCustomer {
  id: string
  name: string
  created_at: string
}

export interface SipocEntry {
  id: string
  process_id: string
  /** Empresa a la que pertenece. Opcional para legacy. */
  company_id?: string | null
  supplier_id: string
  supplier_name: string
  input_description: string
  output_description: string
  customer_id: string
  customer_name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CatalogItem {
  id: string
  catalog_type: string
  value: string
  sort_order: number
  is_active: boolean
}

interface CatalogState {
  suppliers: SipocSupplier[]
  customers: SipocCustomer[]
  sipocEntries: SipocEntry[]
  catalogItems: CatalogItem[]

  // Suppliers
  addSupplier: (name: string) => SipocSupplier
  deleteSupplier: (id: string) => void

  // Customers
  addCustomer: (name: string) => SipocCustomer
  deleteCustomer: (id: string) => void

  // SIPOC entries
  addSipocEntry: (
    processId: string,
    supplierId: string,
    supplierName: string,
    inputDesc: string,
    outputDesc: string,
    customerId: string,
    customerName: string
  ) => SipocEntry
  updateSipocEntry: (id: string, updates: Partial<SipocEntry>) => void
  deleteSipocEntry: (id: string) => void
  getSipocByProcess: (processId: string) => SipocEntry[]

  // Catalog items
  addCatalogItem: (type: string, value: string) => CatalogItem
  updateCatalogItem: (id: string, updates: Partial<CatalogItem>) => void
  deleteCatalogItem: (id: string) => void
  getCatalogByType: (type: string) => CatalogItem[]

  // Limpieza local al reiniciar empresa
  clearCompanyData: (companyId: string) => void

  // DB sync
  loadFromDB: (companyId: string) => Promise<void>
}

const SEED_CATALOGS: Omit<CatalogItem, 'id'>[] = [
  // execution_frequency
  { catalog_type: 'execution_frequency', value: 'Diario', sort_order: 0, is_active: true },
  { catalog_type: 'execution_frequency', value: 'Semanal', sort_order: 1, is_active: true },
  { catalog_type: 'execution_frequency', value: 'Quincenal', sort_order: 2, is_active: true },
  { catalog_type: 'execution_frequency', value: 'Mensual', sort_order: 3, is_active: true },
  { catalog_type: 'execution_frequency', value: 'Trimestral', sort_order: 4, is_active: true },
  { catalog_type: 'execution_frequency', value: 'Semestral', sort_order: 5, is_active: true },
  { catalog_type: 'execution_frequency', value: 'Anual', sort_order: 6, is_active: true },
  { catalog_type: 'execution_frequency', value: 'Por requerimiento', sort_order: 7, is_active: true },
  // execution_level (cargo/nivel organizacional que ejecuta el proceso)
  { catalog_type: 'execution_level', value: 'Analista', sort_order: 0, is_active: true },
  { catalog_type: 'execution_level', value: 'Jefe', sort_order: 1, is_active: true },
  { catalog_type: 'execution_level', value: 'Coordinador', sort_order: 2, is_active: true },
  { catalog_type: 'execution_level', value: 'Supervisor', sort_order: 3, is_active: true },
  { catalog_type: 'execution_level', value: 'Gerencia', sort_order: 4, is_active: true },
  // execution_type
  { catalog_type: 'execution_type', value: 'Manual', sort_order: 0, is_active: true },
  { catalog_type: 'execution_type', value: 'Automatizada', sort_order: 1, is_active: true },
  { catalog_type: 'execution_type', value: 'Mixta (Manual y Automatizada)', sort_order: 2, is_active: true },
  // delivery_method
  { catalog_type: 'delivery_method', value: 'Correo', sort_order: 0, is_active: true },
  { catalog_type: 'delivery_method', value: 'Sistema', sort_order: 1, is_active: true },
  { catalog_type: 'delivery_method', value: 'Fisico', sort_order: 2, is_active: true },
  { catalog_type: 'delivery_method', value: 'Portal Web', sort_order: 3, is_active: true },
  // process_type
  { catalog_type: 'process_type', value: 'Estrategico', sort_order: 0, is_active: true },
  { catalog_type: 'process_type', value: 'Productivo', sort_order: 1, is_active: true },
  { catalog_type: 'process_type', value: 'Apoyo', sort_order: 2, is_active: true },
  // business_line — vacio por defecto, el usuario lo puebla desde el catalogo
  // supervision_level — cargos jerárquicos
  { catalog_type: 'supervision_level', value: 'Analista', sort_order: 0, is_active: true },
  { catalog_type: 'supervision_level', value: 'Jefatura', sort_order: 1, is_active: true },
  { catalog_type: 'supervision_level', value: 'Gerencia', sort_order: 2, is_active: true },
  { catalog_type: 'supervision_level', value: 'Gerencia General', sort_order: 3, is_active: true },
]

/**
 * Definicion de los catalogos administrables desde "Catalogo General".
 * Cada entrada describe el tipo, etiqueta visible y placeholder.
 */
export const MANAGED_CATALOGS: { type: string; label: string; description: string }[] = [
  { type: 'execution_frequency', label: 'Frecuencia de ejecucion', description: 'Cada cuanto se ejecuta el proceso (diario, mensual, por requerimiento, etc.)' },
  { type: 'execution_level', label: 'Nivel de ejecucion', description: 'Cargo organizacional que ejecuta el proceso: analista, jefe, coordinador, supervisor, gerencia, etc.' },
  { type: 'execution_type', label: 'Tipo de ejecucion', description: 'Modalidad operativa de la ejecucion del proceso' },
  { type: 'process_type', label: 'Tipo de proceso', description: 'Categoria estrategica: estrategico, productivo, apoyo' },
  { type: 'business_line', label: 'Linea de negocio', description: 'Lineas de negocio o unidades comerciales de la empresa' },
  { type: 'delivery_method', label: 'Medio de entrega', description: 'Canal por el cual se entrega el resultado del proceso' },
  { type: 'supervision_level', label: 'Nivel de supervision', description: 'Intensidad del control jerarquico requerido por el proceso' },
  { type: 'cargo', label: 'Cargos', description: 'Cargos que ejecutan actividades en los diagramas (lanes). Se usa para la analitica por cargo y para que la IA nombre los roles con cargos existentes.' },
]

function seedCatalogs(): CatalogItem[] {
  return SEED_CATALOGS.map((item) => ({
    ...item,
    id: generateId(),
  }))
}

export const useCatalogStore = create<CatalogState>()(
  persist(
    (set, get) => ({
      suppliers: [],
      customers: [],
      sipocEntries: [],
      catalogItems: seedCatalogs(),

      // Suppliers
      addSupplier: (name: string) => {
        const companyId = currentCompanyId()
        const supplier: SipocSupplier = { id: generateId(), name, created_at: new Date().toISOString() }
        const prev = get().suppliers
        set((s) => ({ suppliers: [...s.suppliers, supplier] }))
        if (companyId) {
          void (async () => {
            const { createSipocSupplier } = await import('@/services/catalog.service')
            await dbWrite(
              'catalog:addSupplier',
              createSipocSupplier(companyId, name, supplier.id),
              {
                successMessage: 'Proveedor guardado.',
                errorMessage: 'No se pudo guardar el proveedor.',
                rollback: () => set({ suppliers: prev }),
              }
            )
          })()
        }
        return supplier
      },

      deleteSupplier: (id: string) => {
        const prev = get().suppliers
        set((s) => ({ suppliers: s.suppliers.filter((sup) => sup.id !== id) }))
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          await dbWrite(
            'catalog:deleteSupplier',
            supabase.from('sipoc_suppliers').delete().eq('id', id),
            {
              successMessage: 'Proveedor eliminado.',
              errorMessage: 'No se pudo eliminar el proveedor.',
              rollback: () => set({ suppliers: prev }),
            }
          )
        })()
      },

      // Customers
      addCustomer: (name: string) => {
        const companyId = currentCompanyId()
        const customer: SipocCustomer = { id: generateId(), name, created_at: new Date().toISOString() }
        const prev = get().customers
        set((s) => ({ customers: [...s.customers, customer] }))
        if (companyId) {
          void (async () => {
            const { createSipocCustomer } = await import('@/services/catalog.service')
            await dbWrite(
              'catalog:addCustomer',
              createSipocCustomer(companyId, name, customer.id),
              {
                successMessage: 'Cliente guardado.',
                errorMessage: 'No se pudo guardar el cliente.',
                rollback: () => set({ customers: prev }),
              }
            )
          })()
        }
        return customer
      },

      deleteCustomer: (id: string) => {
        const prev = get().customers
        set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }))
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          await dbWrite(
            'catalog:deleteCustomer',
            supabase.from('sipoc_customers').delete().eq('id', id),
            {
              successMessage: 'Cliente eliminado.',
              errorMessage: 'No se pudo eliminar el cliente.',
              rollback: () => set({ customers: prev }),
            }
          )
        })()
      },

      // SIPOC entries
      addSipocEntry: (processId, supplierId, supplierName, inputDesc, outputDesc, customerId, customerName) => {
        const companyId = currentCompanyId()
        if (!companyId) {
          console.warn('[catalogStore:addSipocEntry] No hay empresa activa, abortando')
          return { id: '', process_id: processId, company_id: null, supplier_id: '', supplier_name: '', input_description: '', output_description: '', customer_id: '', customer_name: '', sort_order: 0, created_at: '', updated_at: '' }
        }
        const now = new Date().toISOString()
        const existing = get().sipocEntries.filter((e) => e.process_id === processId)
        const entry: SipocEntry = {
          id: generateId(),
          process_id: processId,
          company_id: companyId,
          supplier_id: supplierId,
          supplier_name: supplierName,
          input_description: inputDesc,
          output_description: outputDesc,
          customer_id: customerId,
          customer_name: customerName,
          sort_order: existing.length,
          created_at: now,
          updated_at: now,
        }
        const prev = get().sipocEntries
        set((s) => ({ sipocEntries: [...s.sipocEntries, entry] }))
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          await dbWrite(
            'catalog:addSipocEntry',
            supabase.from('sipoc_entries').insert({
              ...entry,
              supplier_id: entry.supplier_id || null,
              customer_id: entry.customer_id || null,
            } as never),
            {
              successMessage: 'Entrada SIPOC guardada correctamente.',
              errorMessage: 'No se pudo guardar la entrada SIPOC.',
              rollback: () => set({ sipocEntries: prev }),
            }
          )
        })()
        return entry
      },

      updateSipocEntry: (id, updates) => {
        const prev = get().sipocEntries
        set((s) => ({
          sipocEntries: s.sipocEntries.map((e) =>
            e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e
          ),
        }))
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          await dbWrite(
            'catalog:updateSipocEntry',
            supabase.from('sipoc_entries').update({
              ...updates,
              supplier_id: 'supplier_id' in updates ? (updates.supplier_id || null) : undefined,
              customer_id: 'customer_id' in updates ? (updates.customer_id || null) : undefined,
              updated_at: new Date().toISOString(),
            } as never).eq('id', id),
            {
              successMessage: 'Entrada SIPOC actualizada correctamente.',
              errorMessage: 'No se pudo actualizar la entrada SIPOC.',
              rollback: () => set({ sipocEntries: prev }),
            }
          )
        })()
      },

      deleteSipocEntry: (id) => {
        const prev = get().sipocEntries
        set((s) => ({ sipocEntries: s.sipocEntries.filter((e) => e.id !== id) }))
        void (async () => {
          const { supabase } = await import('@/lib/supabase')
          await dbWrite(
            'catalog:deleteSipocEntry',
            supabase.from('sipoc_entries').delete().eq('id', id),
            {
              successMessage: 'Entrada SIPOC eliminada.',
              errorMessage: 'No se pudo eliminar la entrada SIPOC.',
              rollback: () => set({ sipocEntries: prev }),
            }
          )
        })()
      },

      getSipocByProcess: (processId) => {
        return get()
          .sipocEntries.filter((e) => e.process_id === processId)
          .sort((a, b) => a.sort_order - b.sort_order)
      },

      // Catalog items
      addCatalogItem: (type, value) => {
        const companyId = currentCompanyId()
        const existing = get().catalogItems.filter((c) => c.catalog_type === type)
        const item: CatalogItem = { id: generateId(), catalog_type: type, value, sort_order: existing.length, is_active: true }
        const prev = get().catalogItems
        set((s) => ({ catalogItems: [...s.catalogItems, item] }))
        void (async () => {
          const { createCatalogItem } = await import('@/services/catalog.service')
          await dbWrite(
            'catalog:addCatalogItem',
            createCatalogItem({ ...item, company_id: companyId } as never),
            {
              successMessage: 'Opción de catálogo guardada.',
              errorMessage: 'No se pudo guardar el item del catálogo.',
              rollback: () => set({ catalogItems: prev }),
            }
          )
        })()
        return item
      },

      updateCatalogItem: (id, updates) => {
        const prev = get().catalogItems
        set((s) => ({
          catalogItems: s.catalogItems.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }))
        void (async () => {
          const { updateCatalogItem: updateInDB } = await import('@/services/catalog.service')
          await dbWrite(
            'catalog:updateCatalogItem',
            updateInDB(id, updates as never),
            {
              successMessage: 'Opción de catálogo actualizada.',
              errorMessage: 'No se pudo actualizar el item del catálogo.',
              rollback: () => set({ catalogItems: prev }),
            }
          )
        })()
      },

      deleteCatalogItem: (id) => {
        const prev = get().catalogItems
        set((s) => ({ catalogItems: s.catalogItems.filter((c) => c.id !== id) }))
        void (async () => {
          const { deleteCatalogItem: deleteInDB } = await import('@/services/catalog.service')
          await dbWrite(
            'catalog:deleteCatalogItem',
            deleteInDB(id),
            {
              successMessage: 'Opción de catálogo eliminada.',
              errorMessage: 'No se pudo eliminar el item del catálogo.',
              rollback: () => set({ catalogItems: prev }),
            }
          )
        })()
      },

      getCatalogByType: (type) => {
        return get()
          .catalogItems.filter((c) => c.catalog_type === type && c.is_active)
          .sort((a, b) => a.sort_order - b.sort_order)
      },

      clearCompanyData: (companyId) =>
        set((s) => ({
          sipocEntries: s.sipocEntries.filter((e) => e.company_id !== companyId),
          suppliers: [],
          customers: [],
          catalogItems: seedCatalogs(),
        })),

      // ─── DB sync ───────────────────────────────────────────────────────────
      loadFromDB: async (companyId) => {
        try {
          const { supabase } = await import('@/lib/supabase')
          const [suppliersRes, customersRes, entriesRes, itemsRes] = await Promise.all([
            supabase.from('sipoc_suppliers').select('*').eq('company_id', companyId).order('created_at'),
            supabase.from('sipoc_customers').select('*').eq('company_id', companyId).order('created_at'),
            supabase.from('sipoc_entries').select('*').eq('company_id', companyId).order('sort_order'),
            supabase.from('catalog_items').select('*').eq('company_id', companyId).order('sort_order'),
          ])

          // Cada query se maneja independiente — si alguna falla, el resto se aplica.
          const suppliers: SipocSupplier[] = suppliersRes.error
            ? get().suppliers
            : ((suppliersRes.data ?? []) as Array<{ id: string; name: string; created_at: string }>)
                .map((r) => ({ id: r.id, name: r.name, created_at: r.created_at }))

          const customers: SipocCustomer[] = customersRes.error
            ? get().customers
            : ((customersRes.data ?? []) as Array<{ id: string; name: string; created_at: string }>)
                .map((r) => ({ id: r.id, name: r.name, created_at: r.created_at }))

          const sipocEntries: SipocEntry[] = entriesRes.error
            ? get().sipocEntries
            : ((entriesRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
                id: r.id as string,
                process_id: r.process_id as string,
                company_id: (r.company_id as string) ?? companyId,
                supplier_id: (r.supplier_id as string) ?? '',
                supplier_name: (r.supplier_name as string) ?? '',
                input_description: (r.input_description as string) ?? '',
                output_description: (r.output_description as string) ?? '',
                customer_id: (r.customer_id as string) ?? '',
                customer_name: (r.customer_name as string) ?? '',
                sort_order: (r.sort_order as number) ?? 0,
                created_at: (r.created_at as string) ?? new Date().toISOString(),
                updated_at: (r.updated_at as string) ?? new Date().toISOString(),
              }))

          const dbItems: CatalogItem[] = itemsRes.error
            ? []
            : ((itemsRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
                id: r.id as string,
                catalog_type: (r.catalog_type as string) ?? '',
                value: (r.value as string) ?? '',
                sort_order: (r.sort_order as number) ?? 0,
                is_active: (r.is_active as boolean) ?? true,
              }))

          // Bootstrap: insertar a DB los tipos que aún no existen (seeds solo estaban en localStorage).
          // Garantiza que edits/deletes desde CatalogsPage siempre tengan fila en DB.
          const SEEDED_TYPES = [
            'execution_frequency', 'execution_level', 'execution_type',
            'delivery_method', 'process_type', 'supervision_level',
          ]
          const dbTypeSet = new Set(dbItems.map((i) => i.catalog_type))
          const missingTypes = SEEDED_TYPES.filter((t) => !dbTypeSet.has(t))
          let catalogItems: CatalogItem[] = dbItems
          if (missingTypes.length > 0) {
            const seedItems = seedCatalogs().filter((s) => missingTypes.includes(s.catalog_type))
            await supabase
              .from('catalog_items')
              .insert(seedItems.map((s) => ({ ...s, company_id: companyId })) as never)
            catalogItems = [...dbItems, ...seedItems]
          }
          if (catalogItems.length === 0) catalogItems = get().catalogItems

          set({ suppliers, customers, sipocEntries, catalogItems })

          if (suppliersRes.error) console.error('[catalogStore] loadFromDB suppliers:', suppliersRes.error.message)
          if (customersRes.error) console.error('[catalogStore] loadFromDB customers:', customersRes.error.message)
          if (entriesRes.error) console.error('[catalogStore] loadFromDB entries:', entriesRes.error.message)
          if (itemsRes.error) console.error('[catalogStore] loadFromDB items:', itemsRes.error.message)
        } catch (err) {
          console.error('[catalogStore] loadFromDB exception:', err)
        }
      },
    }),
    {
      name: 'lean-process-catalogs',
      version: 2,
      migrate: (state: unknown, fromVersion: number) => {
        const s = state as CatalogState
        if (fromVersion < 2) {
          const newLevels: CatalogItem[] = [
            { id: generateId(), catalog_type: 'execution_level', value: 'Analista', sort_order: 0, is_active: true },
            { id: generateId(), catalog_type: 'execution_level', value: 'Jefe', sort_order: 1, is_active: true },
            { id: generateId(), catalog_type: 'execution_level', value: 'Coordinador', sort_order: 2, is_active: true },
            { id: generateId(), catalog_type: 'execution_level', value: 'Supervisor', sort_order: 3, is_active: true },
            { id: generateId(), catalog_type: 'execution_level', value: 'Gerencia', sort_order: 4, is_active: true },
          ]
          const others = (s.catalogItems ?? []).filter((c) => c.catalog_type !== 'execution_level')
          return { ...s, catalogItems: [...others, ...newLevels] }
        }
        return s
      },
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as object) }
        const persistedItems: CatalogItem[] = ((persisted as { catalogItems?: CatalogItem[] } | null)?.catalogItems ?? [])

        if (persistedItems.length === 0) {
          // Empresa nueva: poblamos con todos los seeds.
          ;(merged as CatalogState).catalogItems = seedCatalogs()
        } else {
          // Empresa existente: solo inyectamos seeds de catalog_types
          // que el usuario AUN no tiene. Asi nuevos catalogos como
          // execution_level / supervision_level aparecen sin pisar
          // valores que el usuario ya pudo haber editado.
          const existingTypes = new Set(persistedItems.map((c) => c.catalog_type))
          const missingSeeds = SEED_CATALOGS
            .filter((s) => !existingTypes.has(s.catalog_type))
            .map((item) => ({ ...item, id: generateId() }))

          if (missingSeeds.length > 0) {
            ;(merged as CatalogState).catalogItems = [...persistedItems, ...missingSeeds]
          }
        }
        return merged as CatalogState
      },
    }
  )
)
