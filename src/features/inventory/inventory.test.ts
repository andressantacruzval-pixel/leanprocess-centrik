import { describe, it, expect } from 'vitest'
import type { InvArea, InvMacro, InvProyecto } from './types'
import { buildInventoryPrompt, buildRescuePrompt } from './inventoryPrompt'
import { parseChunk, mergeChunk } from './inventoryMerge'
import { globalStats, findings, stats } from './inventoryStats'
import { leafAreas } from './inventoryUtils'

const proyecto: InvProyecto = { consultor: 'AS', cliente: 'Centrik', alcance: 'Toda la empresa', sector: 'Software B2B', fecha: '', ver: '1.0', metodo: 'incremental' }
const macros: InvMacro[] = [
  { nombre: 'Gestión del talento humano', tipo: 'Apoyo', procesos: [] },
  { nombre: 'Comercialización', tipo: 'Productivo', procesos: [] },
]
const areas: InvArea[] = [
  { nombre: 'Gerencia Comercial', padre: '' },
  { nombre: 'Ventas', padre: 'Gerencia Comercial' },
  { nombre: 'Talento Humano', padre: '' },
]

describe('inventory methodology', () => {
  it('leafAreas returns only leaves', () => {
    expect(leafAreas(areas, macros).sort()).toEqual(['Talento Humano', 'Ventas'])
  })

  it('prompt (incremental) carries context, canon, areas and progress line', () => {
    const p = buildInventoryPrompt(proyecto, macros, areas, { modo: 'todos', focoIndex: 0 })
    expect(p).toContain('Centrik')
    expect(p).toContain('MÉTODO: INCREMENTAL')
    expect(p).toContain('Ventas')
    expect(p).toContain('AVANCE: X/2 macroprocesos')
    expect(p).not.toContain('MÉTODO: BIG BANG')
  })

  it('prompt (bigbang) switches method', () => {
    const p = buildInventoryPrompt({ ...proyecto, metodo: 'bigbang' }, macros, areas, { modo: 'todos', focoIndex: 0 })
    expect(p).toContain('MÉTODO: BIG BANG')
    expect(p).toContain('Matriz de contribución')
  })

  it('rescue prompt references the total', () => {
    expect(buildRescuePrompt(macros)).toContain('X/2 macroprocesos')
  })

  it('parse + merge fuses an AI JSON block (fenced)', () => {
    const ai = '```json\n' + JSON.stringify({
      tipo: 'inventario-macroproceso',
      macroproceso: 'Gestión del talento humano',
      procesos: [{
        nombre: 'Búsqueda y Contratación de Personal',
        subprocesos: [
          { nombre: 'Entrevistas y evaluaciones', area: 'Talento Humano', objetivo: 'Evaluar a los candidatos para elegir al mejor perfil del cargo.', origen: 'confirmado' },
          { nombre: 'Contratación de personal', area: 'Talento Humano', objetivo: 'Formalizar la vinculación del candidato elegido con contrato y afiliaciones.', origen: 'confirmado' },
        ],
      }],
    }) + '\n```'
    const parsed = parseChunk(ai)
    const { macros: m2, report } = mergeChunk(macros, areas, parsed)
    expect(report.sNew).toBe(2)
    expect(report.pNew).toBe(1)
    const th = m2.find((x) => x.nombre === 'Gestión del talento humano')!
    expect(th.procesos[0].subprocesos.length).toBe(2)
    // fusión no destructiva: el otro macro sigue vacío
    expect(m2.find((x) => x.nombre === 'Comercialización')!.procesos.length).toBe(0)
    // stats coherentes
    const g = globalStats(m2, areas)
    expect(g.S).toBe(2)
    expect(stats(th).S).toBe(2)
    // hallazgo: hay un área hoja (Ventas) sin carga
    const f = findings(m2, areas)
    expect(f.some((x) => x.lvl === 'crit' && /sin ningún subproceso/.test(x.t))).toBe(true)
  })

  it('rejects non-JSON gracefully', () => {
    expect(() => parseChunk('hola sin json')).toThrow()
  })
})
