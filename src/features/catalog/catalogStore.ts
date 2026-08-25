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
  // ── Activos de información (ISO 27001) ──────────────────────────────────
  { catalog_type: 'asset_type', value: 'Información', sort_order: 0, is_active: true },
  { catalog_type: 'asset_type', value: 'Software', sort_order: 1, is_active: true },
  { catalog_type: 'asset_type', value: 'Hardware', sort_order: 2, is_active: true },
  { catalog_type: 'asset_type', value: 'Red', sort_order: 3, is_active: true },
  { catalog_type: 'asset_type', value: 'Servicio', sort_order: 4, is_active: true },
  { catalog_type: 'asset_type', value: 'Personas', sort_order: 5, is_active: true },
  { catalog_type: 'asset_type', value: 'Físico', sort_order: 6, is_active: true },
  { catalog_type: 'asset_type', value: 'Intangible', sort_order: 7, is_active: true },
  { catalog_type: 'asset_operation', value: 'Crea', sort_order: 0, is_active: true },
  { catalog_type: 'asset_operation', value: 'Usa / Consulta', sort_order: 1, is_active: true },
  { catalog_type: 'asset_operation', value: 'Almacena', sort_order: 2, is_active: true },
  { catalog_type: 'asset_operation', value: 'Transforma', sort_order: 3, is_active: true },
  { catalog_type: 'asset_operation', value: 'Transfiere', sort_order: 4, is_active: true },
  { catalog_type: 'asset_operation', value: 'Elimina', sort_order: 5, is_active: true },
  { catalog_type: 'asset_format', value: 'Digital', sort_order: 0, is_active: true },
  { catalog_type: 'asset_format', value: 'Físico', sort_order: 1, is_active: true },
  { catalog_type: 'asset_format', value: 'Verbal', sort_order: 2, is_active: true },
  { catalog_type: 'asset_format', value: 'Electrónico (correo)', sort_order: 3, is_active: true },
  { catalog_type: 'asset_format', value: 'Base de datos', sort_order: 4, is_active: true },
  { catalog_type: 'personal_data_category', value: 'Datos identificativos', sort_order: 0, is_active: true },
  { catalog_type: 'personal_data_category', value: 'Datos de contacto', sort_order: 1, is_active: true },
  { catalog_type: 'personal_data_category', value: 'Datos financieros', sort_order: 2, is_active: true },
  { catalog_type: 'personal_data_category', value: 'Datos sensibles', sort_order: 3, is_active: true },
  { catalog_type: 'personal_data_category', value: 'Datos de salud', sort_order: 4, is_active: true },
  { catalog_type: 'personal_data_category', value: 'Datos biométricos', sort_order: 5, is_active: true },
  { catalog_type: 'retention_period', value: 'Diario', sort_order: 0, is_active: true },
  { catalog_type: 'retention_period', value: 'Semanal', sort_order: 1, is_active: true },
  { catalog_type: 'retention_period', value: 'Quincenal', sort_order: 2, is_active: true },
  { catalog_type: 'retention_period', value: 'Mensual', sort_order: 3, is_active: true },
  { catalog_type: 'retention_period', value: 'Trimestral', sort_order: 4, is_active: true },
  { catalog_type: 'retention_period', value: 'Semestral', sort_order: 5, is_active: true },
  { catalog_type: 'retention_period', value: 'Anual', sort_order: 6, is_active: true },
  { catalog_type: 'retention_period', value: '2 años', sort_order: 7, is_active: true },
  { catalog_type: 'retention_period', value: '5 años', sort_order: 8, is_active: true },
  { catalog_type: 'retention_period', value: '10 años', sort_order: 9, is_active: true },
  { catalog_type: 'retention_period', value: 'Permanente', sort_order: 10, is_active: true },
  { catalog_type: 'retention_period', value: 'Según norma legal', sort_order: 11, is_active: true },
  { catalog_type: 'disposal_method', value: 'Eliminación segura (borrado)', sort_order: 0, is_active: true },
  { catalog_type: 'disposal_method', value: 'Borrado criptográfico', sort_order: 1, is_active: true },
  { catalog_type: 'disposal_method', value: 'Destrucción física', sort_order: 2, is_active: true },
  { catalog_type: 'disposal_method', value: 'Trituración', sort_order: 3, is_active: true },
  { catalog_type: 'disposal_method', value: 'Desmagnetización', sort_order: 4, is_active: true },
  { catalog_type: 'disposal_method', value: 'Anonimización', sort_order: 5, is_active: true },
  { catalog_type: 'disposal_method', value: 'Archivo histórico', sort_order: 6, is_active: true },
  // ── Riesgo de activos (ISO 27005 / Anexo A ISO 27001:2022) ──────────────
  // Base técnica pre-cargada: amenazas, vulnerabilidades y controles del Anexo A.
  { catalog_type: 'asset_threat', value: 'Acceso no autorizado', sort_order: 0, is_active: true },
  { catalog_type: 'asset_threat', value: 'Malware / ransomware', sort_order: 1, is_active: true },
  { catalog_type: 'asset_threat', value: 'Fuga o filtración de información', sort_order: 2, is_active: true },
  { catalog_type: 'asset_threat', value: 'Error humano', sort_order: 3, is_active: true },
  { catalog_type: 'asset_threat', value: 'Phishing / ingeniería social', sort_order: 4, is_active: true },
  { catalog_type: 'asset_threat', value: 'Fallo de hardware', sort_order: 5, is_active: true },
  { catalog_type: 'asset_threat', value: 'Fallo de software', sort_order: 6, is_active: true },
  { catalog_type: 'asset_threat', value: 'Robo o pérdida de equipo', sort_order: 7, is_active: true },
  { catalog_type: 'asset_threat', value: 'Denegación de servicio (DoS)', sort_order: 8, is_active: true },
  { catalog_type: 'asset_threat', value: 'Manipulación o alteración de datos', sort_order: 9, is_active: true },
  { catalog_type: 'asset_threat', value: 'Suplantación de identidad', sort_order: 10, is_active: true },
  { catalog_type: 'asset_threat', value: 'Fallo de proveedor o tercero', sort_order: 11, is_active: true },
  { catalog_type: 'asset_threat', value: 'Desastre natural', sort_order: 12, is_active: true },
  { catalog_type: 'asset_threat', value: 'Corte de energía o comunicaciones', sort_order: 13, is_active: true },
  { catalog_type: 'asset_vulnerability', value: 'Falta de cifrado', sort_order: 0, is_active: true },
  { catalog_type: 'asset_vulnerability', value: 'Contraseñas débiles o compartidas', sort_order: 1, is_active: true },
  { catalog_type: 'asset_vulnerability', value: 'Ausencia de copias de respaldo', sort_order: 2, is_active: true },
  { catalog_type: 'asset_vulnerability', value: 'Software desactualizado o sin parches', sort_order: 3, is_active: true },
  { catalog_type: 'asset_vulnerability', value: 'Permisos excesivos', sort_order: 4, is_active: true },
  { catalog_type: 'asset_vulnerability', value: 'Falta de control de acceso', sort_order: 5, is_active: true },
  { catalog_type: 'asset_vulnerability', value: 'Configuración insegura', sort_order: 6, is_active: true },
  { catalog_type: 'asset_vulnerability', value: 'Ausencia de registros / monitoreo', sort_order: 7, is_active: true },
  { catalog_type: 'asset_vulnerability', value: 'Personal sin capacitación', sort_order: 8, is_active: true },
  { catalog_type: 'asset_vulnerability', value: 'Sin acuerdos de confidencialidad', sort_order: 9, is_active: true },
  { catalog_type: 'asset_vulnerability', value: 'Sin plan de continuidad', sort_order: 10, is_active: true },
  { catalog_type: 'asset_vulnerability', value: 'Red sin segmentar', sort_order: 11, is_active: true },
  // Controles del Anexo A (ISO 27001:2022), curados por los 4 temas.
  { catalog_type: 'asset_control', value: 'Políticas de seguridad de la información', sort_order: 0, is_active: true },
  { catalog_type: 'asset_control', value: 'Gestión de control de accesos', sort_order: 1, is_active: true },
  { catalog_type: 'asset_control', value: 'Clasificación de la información', sort_order: 2, is_active: true },
  { catalog_type: 'asset_control', value: 'Acuerdos de confidencialidad (NDA)', sort_order: 3, is_active: true },
  { catalog_type: 'asset_control', value: 'Gestión de seguridad con proveedores', sort_order: 4, is_active: true },
  { catalog_type: 'asset_control', value: 'Concienciación y formación en seguridad', sort_order: 5, is_active: true },
  { catalog_type: 'asset_control', value: 'Verificación de antecedentes del personal', sort_order: 6, is_active: true },
  { catalog_type: 'asset_control', value: 'Control de acceso físico', sort_order: 7, is_active: true },
  { catalog_type: 'asset_control', value: 'Seguridad de equipos y escritorio limpio', sort_order: 8, is_active: true },
  { catalog_type: 'asset_control', value: 'Cifrado de la información', sort_order: 9, is_active: true },
  { catalog_type: 'asset_control', value: 'Copias de respaldo (backup)', sort_order: 10, is_active: true },
  { catalog_type: 'asset_control', value: 'Gestión de vulnerabilidades técnicas', sort_order: 11, is_active: true },
  { catalog_type: 'asset_control', value: 'Registro y monitoreo (logs)', sort_order: 12, is_active: true },
  { catalog_type: 'asset_control', value: 'Protección contra malware', sort_order: 13, is_active: true },
  { catalog_type: 'asset_control', value: 'Autenticación multifactor (MFA)', sort_order: 14, is_active: true },
  { catalog_type: 'asset_control', value: 'Gestión de privilegios de acceso', sort_order: 15, is_active: true },
  { catalog_type: 'asset_control', value: 'Seguridad de redes y segmentación', sort_order: 16, is_active: true },
  { catalog_type: 'asset_control', value: 'Borrado seguro de la información', sort_order: 17, is_active: true },
  { catalog_type: 'asset_control', value: 'Plan de continuidad del negocio', sort_order: 18, is_active: true },
  // Campos / columnas de los activos de información (para trazar por dónde viajan).
  { catalog_type: 'asset_field', value: 'Nombre', sort_order: 0, is_active: true },
  { catalog_type: 'asset_field', value: 'Apellido', sort_order: 1, is_active: true },
  { catalog_type: 'asset_field', value: 'Identificación / Cédula', sort_order: 2, is_active: true },
  { catalog_type: 'asset_field', value: 'Correo electrónico', sort_order: 3, is_active: true },
  { catalog_type: 'asset_field', value: 'Teléfono', sort_order: 4, is_active: true },
  { catalog_type: 'asset_field', value: 'Dirección', sort_order: 5, is_active: true },
  { catalog_type: 'asset_field', value: 'Fecha de nacimiento', sort_order: 6, is_active: true },
  { catalog_type: 'asset_field', value: 'Cargo', sort_order: 7, is_active: true },
  { catalog_type: 'asset_field', value: 'Empresa', sort_order: 8, is_active: true },
  { catalog_type: 'asset_field', value: 'RUC / NIT / RFC', sort_order: 9, is_active: true },
  { catalog_type: 'asset_field', value: 'Número de cuenta', sort_order: 10, is_active: true },
  { catalog_type: 'asset_field', value: 'Monto / Valor', sort_order: 11, is_active: true },
  { catalog_type: 'asset_field', value: 'Producto / Servicio', sort_order: 12, is_active: true },
  { catalog_type: 'asset_field', value: 'Fecha', sort_order: 13, is_active: true },
  { catalog_type: 'asset_field', value: 'Estado', sort_order: 14, is_active: true },
  // Medios de transferencia de datos entre procesos.
  { catalog_type: 'transfer_medium', value: 'Correo electrónico', sort_order: 0, is_active: true },
  { catalog_type: 'transfer_medium', value: 'SFTP', sort_order: 1, is_active: true },
  { catalog_type: 'transfer_medium', value: 'SharePoint', sort_order: 2, is_active: true },
  { catalog_type: 'transfer_medium', value: 'Carpeta compartida', sort_order: 3, is_active: true },
  { catalog_type: 'transfer_medium', value: 'Sistema / API', sort_order: 4, is_active: true },
  { catalog_type: 'transfer_medium', value: 'Base de datos', sort_order: 5, is_active: true },
  { catalog_type: 'transfer_medium', value: 'Físico (papel/USB)', sort_order: 6, is_active: true },
  { catalog_type: 'transfer_medium', value: 'Mensajería / Chat', sort_order: 7, is_active: true },
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
  { type: 'asset_type', label: 'Tipo de activo (ISO 27001)', description: 'Categoría del activo de información: Información, Software, Hardware, Red, Servicio, Personas, Físico, Intangible.' },
  { type: 'asset_operation', label: 'Operación sobre el activo', description: 'Qué le pasa al activo en el proceso: crea, usa, almacena, transforma, transfiere, elimina.' },
  { type: 'asset_format', label: 'Formato de activo', description: 'Soporte del activo de información: digital, físico, verbal, base de datos, etc.' },
  { type: 'asset_location', label: 'Ubicación / repositorio de activos', description: 'Sistemas, servidores, nubes o ubicaciones físicas donde residen los activos.' },
  { type: 'personal_data_category', label: 'Categoría de datos personales', description: 'Tipos de datos personales que puede contener un activo.' },
  { type: 'retention_period', label: 'Periodo de retención', description: 'Cuánto se conserva la información antes de su disposición (buenas prácticas ISO 27001).' },
  { type: 'disposal_method', label: 'Método de disposición', description: 'Cómo se elimina o destruye el activo al final de su ciclo de vida.' },
  { type: 'asset_threat', label: 'Amenazas (ISO 27005)', description: 'Amenazas típicas sobre activos de información. Base pre-cargada; puedes añadir las tuyas.' },
  { type: 'asset_vulnerability', label: 'Vulnerabilidades', description: 'Debilidades que una amenaza podría aprovechar. Base pre-cargada; puedes añadir las tuyas.' },
  { type: 'asset_control', label: 'Controles (Anexo A ISO 27001)', description: 'Controles de seguridad del Anexo A ISO 27001:2022 para mitigar el riesgo de los activos.' },
  { type: 'asset_field', label: 'Campos / columnas de activos', description: 'Campos que contienen los activos (nombre, cédula, correo…). Reutilizarlos permite trazar por dónde viaja cada columna.' },
  { type: 'transfer_medium', label: 'Medios de transferencia', description: 'Por qué medio viaja un activo entre procesos: correo, SFTP, SharePoint, carpeta compartida, físico, etc.' },
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
