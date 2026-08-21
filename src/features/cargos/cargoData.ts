import { useMemo } from 'react'
import { useProcessStore } from '@/stores/processStore'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { parseBpmnXml } from '@/utils/bpmnParser'
import type { ValueActivity, ValueClassification } from '@/utils/valueAnalysis'
import type { Process } from '@/types/process'

// Analítica por CARGO. El dato ya existe: cada actividad del BPMN conoce su lane
// (= cargo) y el análisis de valor persiste ese lane con su clasificación y
// tiempo. Aquí se agrega por cargo (nombre normalizado) cruzando:
//  · el análisis de valor (con tiempo VA/NVA/NVABN) cuando existe, y
//  · el BPMN estructural (sin tiempo) para los procesos aún sin análisis.
// El catálogo de cargos da la fuente canónica para conciliar variantes.

export const CARGO_CATALOG = 'cargo'

export function normCargo(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface CargoActivity {
  processId: string
  processName: string
  activityName: string
  classification: ValueClassification | null
  /** Minutos/día normalizados (base para escalar a cualquier periodo). */
  dailyMinutes: number
}

export interface CargoAgg {
  key: string
  cargo: string
  inCatalog: boolean
  processes: Set<string>
  activities: CargoActivity[]
  // Minutos/DÍA (base). Se escalan a día/semana/mes/semestre/año en la UI/export.
  vaDaily: number
  nvaDaily: number
  nvabnDaily: number
  totalDaily: number
}

// ─── Escalado de tiempos (mismas convenciones que el análisis de valor) ─────

export type CargoPeriod = 'dia' | 'semana' | 'mes' | 'semestre' | 'anio'

/** Días laborables por periodo (mes=20, año=240; semestre=120). */
const PERIOD_DAYS: Record<CargoPeriod, number> = { dia: 1, semana: 5, mes: 20, semestre: 120, anio: 240 }

export const PERIOD_LABELS: Record<CargoPeriod, string> = { dia: 'Día', semana: 'Semana', mes: 'Mes', semestre: 'Semestre', anio: 'Año' }
export const PERIOD_OPTIONS: CargoPeriod[] = ['dia', 'semana', 'mes', 'semestre', 'anio']

/** Convierte minutos/día a la unidad pedida (minutos u horas) para un periodo. */
export function scaleDaily(dailyMinutes: number, period: CargoPeriod, unit: 'min' | 'h'): number {
  const mins = dailyMinutes * PERIOD_DAYS[period]
  return unit === 'h' ? mins / 60 : mins
}

export interface CargoData {
  cargos: CargoAgg[]
  sinCatalogar: CargoAgg[]
  catalogCount: number
}

/**
 * Agregación pura por cargo. La usan tanto el hook (UI) como el exportador.
 * `catalogValues` es la lista de cargos del catálogo (para marcar inCatalog).
 */
export function computeCargos(procs: Process[], analyses: Record<string, ValueActivity[]>, catalogValues: string[]): CargoData {
  const catalogKeys = new Map(catalogValues.map((v) => [normCargo(v), v]))

  const map = new Map<string, CargoAgg>()
    const ensure = (name: string): CargoAgg => {
      const key = normCargo(name)
      let a = map.get(key)
      if (!a) {
        a = {
          key, cargo: catalogKeys.get(key) ?? name, inCatalog: catalogKeys.has(key),
          processes: new Set(), activities: [], vaDaily: 0, nvaDaily: 0, nvabnDaily: 0, totalDaily: 0,
        }
        map.set(key, a)
      }
      return a
    }

    for (const p of procs) {
      const acts = analyses[p.id]
      if (acts && acts.length) {
        for (const a of acts) {
          const lane = (a.laneName || '').trim()
          if (!lane) continue
          const agg = ensure(lane)
          agg.processes.add(p.id)
          const dm = a.dailyMinutes || 0
          agg.activities.push({ processId: p.id, processName: p.name, activityName: a.name, classification: a.classification, dailyMinutes: dm })
          agg.totalDaily += dm
          if (a.classification === 'VA') agg.vaDaily += dm
          else if (a.classification === 'NVA') agg.nvaDaily += dm
          else if (a.classification === 'NVABN') agg.nvabnDaily += dm
        }
      } else if (p.bpmn_xml) {
        // Sin análisis de valor: estructura desde el BPMN (sin tiempo).
        try {
          const parsed = parseBpmnXml(p.bpmn_xml)
          for (const act of parsed.activities) {
            const lane = (act.laneName || '').trim()
            if (!lane) continue
            const agg = ensure(lane)
            agg.processes.add(p.id)
            agg.activities.push({ processId: p.id, processName: p.name, activityName: act.name, classification: null, dailyMinutes: 0 })
          }
        } catch { /* xml inválido → se ignora */ }
      }
    }

  // Cargos del catálogo aún sin uso → aparecen con cero para que se vean.
  catalogValues.forEach((v) => { if (!map.has(normCargo(v))) ensure(v) })

  const cargos = [...map.values()].sort((a, b) => b.activities.length - a.activities.length || b.totalDaily - a.totalDaily)
  const sinCatalogar = cargos.filter((c) => !c.inCatalog && c.activities.length > 0)
  return { cargos, sinCatalogar, catalogCount: catalogValues.length }
}

export function useCargoData(companyId: string): CargoData {
  const processes = useProcessStore((s) => s.processes)
  const analyses = useValueAnalysisStore((s) => s.analyses)
  const catalogItems = useCatalogStore((s) => s.catalogItems)

  return useMemo(() => {
    const procs = processes.filter((p) => p.company_id === companyId)
    const catalogValues = catalogItems.filter((c) => c.catalog_type === CARGO_CATALOG && c.is_active).map((c) => c.value)
    return computeCargos(procs, analyses, catalogValues)
  }, [processes, analyses, catalogItems, companyId])
}
