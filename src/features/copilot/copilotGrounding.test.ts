import { describe, it, expect } from 'vitest'
import type { ScopedData } from './copilotData'
import { groundWidgets } from './copilotGrounding'
import type { Process } from '@/types/process'

function proc(id: string, name: string): Process {
  return { id, company_id: 'co', macroprocess_id: 'm1', name, is_critical: false } as Process
}

function data(): ScopedData {
  return {
    activeCompanyId: 'co',
    macroprocesses: [],
    processes: [proc('p1', 'Gestión de Webinars'), proc('p2', 'Búsqueda y Contratación de Personal')],
    processIds: new Set(['p1', 'p2']),
    risks: [], indicators: [], procedures: [], audits: {}, analyses: {}, improvements: [],
  } as unknown as ScopedData
}

describe('copilotGrounding — guardarraíl', () => {
  it('corrige el nombre de un proceso con typo', () => {
    const out = groundWidgets(data(), [{ name: 'PROCESS', params: { name: 'gestion de webinar' } }])
    expect(out).toHaveLength(1)
    expect(out[0].params.name).toBe('Gestión de Webinars')
  })

  it('descarta una cita a un proceso inexistente', () => {
    const out = groundWidgets(data(), [{ name: 'CITE', params: { process: 'proceso fantasma zzz', doc: 'procedure' } }])
    expect(out).toHaveLength(0)
  })

  it('deja pasar widgets deterministas', () => {
    const out = groundWidgets(data(), [{ name: 'CHART', params: { entity: 'risks', groupBy: 'level' } }])
    expect(out).toHaveLength(1)
  })
})
