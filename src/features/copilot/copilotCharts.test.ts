import { describe, it, expect } from 'vitest'
import type { ScopedData } from './copilotData'
import { detectVisual } from './copilotCharts'
import type { Process } from '@/types/process'

function data(): ScopedData {
  const proc = (id: string, name: string): Process => ({ id, company_id: 'co', macroprocess_id: 'm', name, is_critical: false } as Process)
  return {
    activeCompanyId: 'co', macroprocesses: [],
    processes: [proc('p1', 'Gestión de Webinars'), proc('p2', 'Compras')],
    processIds: new Set(['p1', 'p2']),
    risks: [], indicators: [], procedures: [], audits: {}, analyses: {}, improvements: [],
  } as unknown as ScopedData
}

describe('detectVisual — intención determinista de gráfico/heatmap', () => {
  it('mapa de calor de toda la empresa → HEATMAP sin proceso', () => {
    const w = detectVisual('muéstrame el mapa de calor de toda la empresa', data())
    expect(w?.name).toBe('HEATMAP')
    expect(w?.params.process).toBeUndefined()
  })

  it('mapa de calor de un proceso concreto → HEATMAP con proceso', () => {
    const w = detectVisual('mapa de calor de riesgos de Gestión de Webinars', data())
    expect(w?.name).toBe('HEATMAP')
    expect(w?.params.process).toBe('Gestión de Webinars')
  })

  it('gráfico de pastel de riesgos por nivel → CHART risks/level/pie', () => {
    const w = detectVisual('gráfico de pastel de riesgos por nivel', data())
    expect(w?.name).toBe('CHART')
    expect(w?.params).toMatchObject({ entity: 'risks', groupBy: 'level', chartType: 'pie' })
  })

  it('gráfico de riesgos operacionales → filtro categoría, agrupa por nivel', () => {
    const w = detectVisual('gráfico de riesgos operacionales', data())
    expect(w?.params).toMatchObject({ entity: 'risks', category: 'Operacional', groupBy: 'level' })
  })

  it('gráfico de indicadores con y sin meta → CHART indicators/meta', () => {
    const w = detectVisual('gráfico de indicadores con y sin meta', data())
    expect(w?.params).toMatchObject({ entity: 'indicators', groupBy: 'meta' })
  })

  it('pregunta sin intención de gráfico → null', () => {
    expect(detectVisual('¿qué procesos no tienen indicadores?', data())).toBeNull()
    expect(detectVisual('dame el total de riesgos operacionales', data())).toBeNull()
  })
})
