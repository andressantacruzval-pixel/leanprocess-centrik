import { describe, it, expect } from 'vitest'
import type { ScopedData } from './copilotData'
import { extractPlan, specToWidget } from './copilotPlan'
import type { Process } from '@/types/process'

function data(): ScopedData {
  const proc = (id: string, name: string): Process => ({ id, company_id: 'co', macroprocess_id: 'm', name, is_critical: false } as Process)
  return {
    activeCompanyId: 'co', macroprocesses: [],
    processes: [proc('p1', 'Gestión de Webinars')],
    processIds: new Set(['p1']),
    risks: [], indicators: [], procedures: [], audits: {}, analyses: {}, improvements: [],
  } as unknown as ScopedData
}

describe('copilotPlan — capa de consulta estructurada', () => {
  it('extractPlan separa el bloque json y limpia el texto', () => {
    const buf = 'Aquí tienes el mapa de calor residual.\n```json\n{"widget":{"kind":"heatmap","basis":"residual"}}\n```'
    const { text, spec } = extractPlan(buf)
    expect(text).toBe('Aquí tienes el mapa de calor residual.')
    expect(spec).toMatchObject({ kind: 'heatmap', basis: 'residual' })
  })

  it('extractPlan sin bloque devuelve el texto tal cual', () => {
    const { text, spec } = extractPlan('respuesta simple')
    expect(text).toBe('respuesta simple')
    expect(spec).toBeNull()
  })

  it('specToWidget: heatmap residual', () => {
    const w = specToWidget({ kind: 'heatmap', basis: 'residual' }, data())
    expect(w).toEqual({ name: 'HEATMAP', params: expect.objectContaining({ basis: 'residual' }) })
  })

  it('specToWidget: chart valida entidad y tipo', () => {
    const w = specToWidget({ kind: 'chart', entity: 'risks', groupBy: 'level', chartType: 'pie' }, data())
    expect(w?.name).toBe('CHART')
    expect(w?.params).toMatchObject({ entity: 'risks', groupBy: 'level', chartType: 'pie' })
  })

  it('specToWidget: process resuelve el nombre exacto', () => {
    const w = specToWidget({ kind: 'process', process: 'gestion de webinars' }, data())
    expect(w).toEqual({ name: 'PROCESS', params: { name: 'Gestión de Webinars' } })
  })

  it('specToWidget: none/null → null', () => {
    expect(specToWidget({ kind: 'none' }, data())).toBeNull()
    expect(specToWidget(null, data())).toBeNull()
  })
})
