export type Plan = {
  id: string
  name: string
  display_name: string
  description?: string
  price_monthly: number
  price_yearly: number
  stripe_price_id_monthly?: string
  stripe_price_id_yearly?: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  limits?: PlanLimit[]
}

export type PlanLimit = {
  id: string
  plan_id: string
  feature_key: FeatureKey
  limit_value: string
  created_at: string
}

export type FeatureKey =
  | 'max_processes'
  | 'max_sipoc_per_process'
  | 'ai_tokens_monthly'
  | 'export_bpmn'
  | 'export_pdf'
  | 'export_image'
  | 'process_map'
  | 'process_characterization'
