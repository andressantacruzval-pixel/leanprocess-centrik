import { describe, it, expect } from 'vitest'
import { processMapUrl } from './processMapUrl'

describe('processMapUrl', () => {
  it('un subproceso vuelve junto a sus hermanos, no al nivel de encima', () => {
    expect(processMapUrl({ macroprocess_id: 'M1', parent_process_id: 'P1' }))
      .toBe('/app/process-map?macro=M1&parent=P1')
  })

  it('un proceso de nivel 2 vuelve a su macroproceso', () => {
    expect(processMapUrl({ macroprocess_id: 'M1', parent_process_id: null }))
      .toBe('/app/process-map?macro=M1')
  })

  it('sin proceso cae a la raiz del mapa en vez de romper', () => {
    expect(processMapUrl(null)).toBe('/app/process-map')
    expect(processMapUrl(undefined)).toBe('/app/process-map')
  })

  it('escapa los ids en vez de concatenarlos a pelo', () => {
    // Los ids son uuid, pero concatenar sin escapar es la clase de atajo que
    // muerde el dia que alguien mete otra cosa en la URL.
    expect(processMapUrl({ macroprocess_id: 'a b&c', parent_process_id: null }))
      .toBe('/app/process-map?macro=a+b%26c')
  })
})
