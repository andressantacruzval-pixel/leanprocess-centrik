import type { StoredIndicator } from './indicatorStore'

// Mapeo al schema DB de la tabla public.indicators.
// Mantener este mapeo aislado del store para preservar el archivo bajo el cap de 300 líneas.
export function toRow(ind: StoredIndicator): Record<string, unknown> {
  return {
    id: ind.id,
    process_id: ind.process_id,
    company_id: ind.company_id ?? null,
    name: ind.name,
    description: ind.description || null,
    formula: ind.formula || null,
    data_source: ind.data_source || null,
    unit: ind.unit || null,
    frequency: ind.frequency || null,
    target_value: ind.target_value ? Number(ind.target_value) : null,
    threshold_green_min: ind.threshold_green_min ?? null,
    threshold_green_max: ind.threshold_green_max ?? null,
    threshold_yellow_min: ind.threshold_yellow_min ?? null,
    threshold_yellow_max: ind.threshold_yellow_max ?? null,
    threshold_red_min: ind.threshold_red_min ?? null,
    threshold_red_max: ind.threshold_red_max ?? null,
    owner: ind.owner || null,
    reporter: ind.reporter || '',
    created_at: ind.created_at,
    updated_at: ind.updated_at,
  }
}
