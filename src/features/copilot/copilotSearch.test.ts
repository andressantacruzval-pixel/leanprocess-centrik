import { describe, it, expect } from 'vitest'
import { keywords, expandSynonyms, scoreText, fuzzyEq, bestMatch } from './copilotSearch'

describe('copilotSearch — retrieval híbrido', () => {
  it('fuzzyEq tolera un typo', () => {
    expect(fuzzyEq('personal', 'peronal')).toBe(true)
    expect(fuzzyEq('personal', 'proveedor')).toBe(false)
  })

  it('expandSynonyms trae el grupo del dominio', () => {
    const terms = expandSynonyms(keywords('contratación de personal'))
    const set = new Set(terms.map((t) => t.term))
    expect(set.has('reclutamiento')).toBe(true)
    expect(set.has('seleccion')).toBe(true)
  })

  it('scoreText puntúa sinónimo y fuzzy', () => {
    const terms = expandSynonyms(keywords('reclutamiento'))
    // El texto usa "contratacion", sinónimo de "reclutamiento".
    expect(scoreText('busqueda y contratacion de personal', terms)).toBeGreaterThan(0)
  })

  it('bestMatch reencuentra un nombre con typo', () => {
    const names = ['Búsqueda y Contratación de Personal', 'Gestión de Webinars', 'Compras']
    expect(bestMatch('contratacion de peronal', names)).toBe('Búsqueda y Contratación de Personal')
    expect(bestMatch('xyz inexistente', names)).toBeNull()
  })
})
