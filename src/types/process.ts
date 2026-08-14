export type Macroprocess = {
  id: string
  company_id: string
  name: string
  category: 'estrategico' | 'productivo' | 'apoyo'
  sort_order: number
  color?: string
  icon?: string
  created_at: string
  updated_at: string
}

export type ProcessLevelDefinition = {
  id: string
  level_number: number
  level_name: string
  created_at: string
}

export type Process = {
  id: string
  company_id: string
  macroprocess_id: string
  parent_process_id?: string | null
  level_definition_id?: string | null
  name: string
  code?: string
  description?: string
  entity?: string
  process_type?: string
  execution_frequency?: string
  version?: string
  execution_level?: string
  management?: string
  coordination?: string
  operative?: string
  business_line?: string
  supervision_level?: string
  responsible?: string
  delivery_method?: string
  execution_type?: string
  is_critical: boolean
  has_contingency_plan: boolean
  involves_cash_movement: boolean
  has_tax_operations: boolean
  affects_accounting: boolean
  handles_personal_data: boolean
  provided_by_third_party: boolean
  /** @deprecated La herramienta no maneja flujos de aprobacion. Mantenido como opcional para data legacy. */
  approval_date?: string
  /** Fecha de la ultima publicacion. NULL = borrador. Solo la mueve usePublishProcess. */
  published_at?: string | null
  update_date?: string
  org_unit_id?: string | null
  bpmn_xml?: string
  sort_order: number
  created_at: string
  updated_at: string
}

export type CatalogType =
  | 'execution_level'
  | 'management'
  | 'coordination'
  | 'business_line'
  | 'supervision_level'
  | 'delivery_method'
  | 'execution_type'
  | 'process_type'
  | 'execution_frequency'

export type CatalogItem = {
  id: string
  catalog_type: CatalogType
  value: string
  sort_order: number
  is_active: boolean
  created_at: string
}
