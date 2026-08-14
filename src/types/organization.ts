import type { DocCodePattern } from '@/utils/docCode'

export type Company = {
  id: string
  user_id: string
  name: string
  industry?: string
  company_size?: string
  country?: string
  description?: string
  logo_url?: string
  onboarding_completed: boolean
  process_level_count: number
  /** Orden de los segmentos del codigo de documento. NULL = sin elegir -> 'tipo-num'. */
  doc_code_pattern?: DocCodePattern | null
  /** Prefijo del tipo de documento (ej. PRO). NULL = sin elegir -> 'PRO'. */
  doc_code_prefix?: string | null
  created_at: string
  updated_at: string
}

export type ProcessLevelName = {
  level_number: number
  name: string
}

export type OrgLevelDefinition = {
  id: string
  company_id: string
  level_number: number
  level_name: string
  created_at: string
}

export type OrgUnit = {
  id: string
  company_id: string
  org_level_definition_id: string | null
  parent_id: string | null
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}
