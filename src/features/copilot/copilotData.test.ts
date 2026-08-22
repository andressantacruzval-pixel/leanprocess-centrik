import { describe, it, expect } from 'vitest'
import type { ScopedData } from './copilotData'
import {
  hasAdequateControl,
  risksWithoutAdequateControl,
  computeChart,
  findProcessByName,
  risksForWidget,
} from './copilotData'
import type { RiskItem, ControlItem } from '@/types/risk'
import type { Process } from '@/types/process'

function ctrl(score: number): ControlItem {
  return {
    id: 'c' + score, description: '', doc: 1, type: 1, segregation: 1, evidence: 1,
    freq: 1, nature: 1, training: 1, monitoring: 1, mitigates: 'Ambos', score,
    effectiveness: score >= 17 ? 'Regular' : 'Debil',
  }
}

function risk(id: string, process_id: string, controls: ControlItem[], extra?: Partial<RiskItem>): RiskItem {
  return {
    id, process_id, processStep: 'Validar solicitud', title: 'Riesgo ' + id,
    riskCause: '', riskEvent: '', riskEffect: '', description: '', category: 'Operacional',
    inherentProbability: 4, inherentImpact: 4, controls,
    residualProbability: 4, residualImpact: 4, created_at: '', ...extra,
  }
}

function proc(id: string, name: string, coordination: string): Process {
  return { id, company_id: 'co', macroprocess_id: 'm1', name, coordination, is_critical: false } as Process
}

function makeData(): ScopedData {
  const processes = [proc('p1', 'Alta de Cliente', 'Comercial'), proc('p2', 'Compras', 'Operaciones')]
  const risks = [
    risk('r1', 'p1', [ctrl(10)]),            // sin control adecuado (Comercial)
    risk('r2', 'p1', [ctrl(25)]),            // con control adecuado
    risk('r3', 'p2', []),                     // sin control (Operaciones)
    risk('r4', 'p2', [ctrl(9)], { category: 'Cumplimiento' }), // sin adecuado, otra categoría
  ]
  return {
    activeCompanyId: 'co',
    macroprocesses: [{ id: 'm1', company_id: 'co', name: 'Cadena de valor', category: 'productivo' }],
    processes,
    processIds: new Set(['p1', 'p2']),
    risks,
    indicators: [],
    procedures: [],
    audits: {},
    analyses: {},
    improvements: [],
  } as unknown as ScopedData
}

describe('copilotData — carril determinista', () => {
  it('hasAdequateControl usa el umbral de score ≥ 17', () => {
    expect(hasAdequateControl(risk('x', 'p1', [ctrl(16)]))).toBe(false)
    expect(hasAdequateControl(risk('x', 'p1', [ctrl(17)]))).toBe(true)
  })

  it('risksWithoutAdequateControl encuentra los que no tienen control fuerte', () => {
    const out = risksWithoutAdequateControl(makeData())
    expect(out.map((r) => r.risk.id).sort()).toEqual(['r1', 'r3', 'r4'])
  })

  it('computeChart: riesgos sin control adecuado por área', () => {
    const data = computeChart(makeData(), { entity: 'risks', groupBy: 'area', control: 'inadequate' })
    const byLabel = Object.fromEntries(data.map((d) => [d.label, d.value]))
    expect(byLabel['Comercial']).toBe(1) // r1
    expect(byLabel['Operaciones']).toBe(2) // r3 + r4
  })

  it('computeChart: filtra por categoría operativa', () => {
    const data = computeChart(makeData(), { entity: 'risks', groupBy: 'area', control: 'inadequate', category: 'Operacional' })
    const byLabel = Object.fromEntries(data.map((d) => [d.label, d.value]))
    expect(byLabel['Comercial']).toBe(1)
    expect(byLabel['Operaciones']).toBe(1) // solo r3 (r4 es Cumplimiento)
  })

  it('risksForWidget filtra por control/categoría y ordena por severidad', () => {
    const out = risksForWidget(makeData(), { control: 'inadequate', category: 'Operacional' })
    expect(out.map((r) => r.risk.id).sort()).toEqual(['r1', 'r3'])
  })

  it('risksForWidget sin filtros devuelve todos los riesgos', () => {
    expect(risksForWidget(makeData(), {}).length).toBe(4)
  })

  it('findProcessByName tolera coincidencia parcial', () => {
    expect(findProcessByName(makeData(), 'alta de cliente')?.id).toBe('p1')
    expect(findProcessByName(makeData(), 'Compras')?.id).toBe('p2')
  })
})
