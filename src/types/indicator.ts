export type ProcessIndicator = {
  id: string
  process_id: string
  user_id: string
  name: string
  objective?: string
  formula?: string
  data_source?: string
  unit_of_measure?: string
  frequency?: string
  target_value?: string
  threshold_green_min?: number | null
  threshold_green_max?: number | null
  threshold_yellow_min?: number | null
  threshold_yellow_max?: number | null
  threshold_red_min?: number | null
  threshold_red_max?: number | null
  responsible_report?: string
  responsible_monitoring?: string
  definition_date?: string
  is_active: boolean
  generated_by_ai: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type IndicatorGenerationResult = {
  nombre_proceso: string
  objetivo_proceso: string
  indicadores: Array<{
    nombre: string
    objetivo: string
    formula: string
    fuente_datos: string
    unidad_medida: string
    frecuencia: string
    meta: string
    umbral_verde_min: number | null
    umbral_verde_max: number | null
    umbral_amarillo_min: number | null
    umbral_amarillo_max: number | null
    umbral_rojo_min: number | null
    umbral_rojo_max: number | null
    responsable_reporte: string
    responsable_monitoreo: string
  }>
}
