import { describe, it, expect } from 'vitest'
import { lowestProcessDepth, processDepth, isDocumentable } from './processLevels'

const sinPadre = { parent_process_id: null }
const conPadre = { parent_process_id: 'algun-uuid' }

describe('lowestProcessDepth', () => {
  it('1 y 2 niveles => el nivel mas bajo es depth 1', () => {
    expect(lowestProcessDepth(1)).toBe(1)
    expect(lowestProcessDepth(2)).toBe(1)
  })

  it('3 niveles => el nivel mas bajo es depth 2', () => {
    expect(lowestProcessDepth(3)).toBe(2)
  })

  it('sin valor asume 3, que es el default de companies.process_level_count', () => {
    expect(lowestProcessDepth(null)).toBe(2)
    expect(lowestProcessDepth(undefined)).toBe(2)
  })
})

describe('processDepth', () => {
  it('distingue por parent_process_id', () => {
    expect(processDepth(sinPadre)).toBe(1)
    expect(processDepth(conPadre)).toBe(2)
  })
})

describe('isDocumentable', () => {
  it('en 3 niveles solo el subproceso admite documentacion', () => {
    expect(isDocumentable(sinPadre, 3)).toBe(false)
    expect(isDocumentable(conPadre, 3)).toBe(true)
  })

  it('en 2 niveles el proceso admite documentacion', () => {
    expect(isDocumentable(sinPadre, 2)).toBe(true)
    expect(isDocumentable(conPadre, 2)).toBe(false)
  })

  it('en 1 nivel el proceso admite documentacion', () => {
    expect(isDocumentable(sinPadre, 1)).toBe(true)
  })

  // El caso Marsacot: 3 niveles declarados, proceso de nivel 2 sin subprocesos.
  // "No tiene hijos" no lo convierte en hoja.
  it('un proceso de nivel 2 sin hijos NO es documentable en una estructura de 3', () => {
    expect(isDocumentable({ parent_process_id: null }, 3)).toBe(false)
  })
})
