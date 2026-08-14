import { describe, it, expect } from 'vitest'
import {
  buildDocCode,
  nextDocSeq,
  needsDocCode,
  DOC_CODE_SENTINEL,
} from './docCode'

describe('buildDocCode', () => {
  it('arma los tres patrones', () => {
    const base = { prefix: 'PRO', areaName: 'Ventas', seq: 1 } as const
    expect(buildDocCode({ ...base, pattern: 'tipo-area-num' })).toBe('PRO-VENTAS-001')
    expect(buildDocCode({ ...base, pattern: 'area-tipo-num' })).toBe('VENTAS-PRO-001')
    expect(buildDocCode({ ...base, pattern: 'tipo-num' })).toBe('PRO-001')
  })

  it('omite el area cuando el proceso no tiene una asignada, sin dejar hueco', () => {
    expect(buildDocCode({ pattern: 'tipo-area-num', prefix: 'PRO', areaName: null, seq: 7 }))
      .toBe('PRO-007')
    expect(buildDocCode({ pattern: 'area-tipo-num', prefix: 'PRO', areaName: '', seq: 7 }))
      .toBe('PRO-007')
  })

  it('normaliza tildes, espacios y simbolos del area', () => {
    expect(buildDocCode({ pattern: 'tipo-area-num', prefix: 'pro', areaName: 'Gestión & Calidad', seq: 12 }))
      .toBe('PRO-GESTIONCALID-012')
  })

  it('cae a los valores por defecto cuando la empresa no configuro nada', () => {
    expect(buildDocCode({ pattern: null, prefix: null, areaName: null, seq: 3 })).toBe('PRO-003')
  })

  it('rellena a tres digitos y no se rompe por encima de 999', () => {
    expect(buildDocCode({ pattern: 'tipo-num', prefix: 'PRO', seq: 1 })).toBe('PRO-001')
    expect(buildDocCode({ pattern: 'tipo-num', prefix: 'PRO', seq: 1000 })).toBe('PRO-1000')
  })
})

describe('nextDocSeq', () => {
  it('toma max+1, no count+1: un borrado no hace repetir un numero', () => {
    // Se crearon 001, 002 y 003 y se borro el 002. `count+1` daria 003 (repetido).
    expect(nextDocSeq(['PRO-VENTAS-001', 'PRO-VENTAS-003'])).toBe(4)
  })

  it('empieza en 1 sin documentos previos', () => {
    expect(nextDocSeq([])).toBe(1)
  })

  it('ignora codigos sin numero final y valores vacios', () => {
    expect(nextDocSeq(['SIN-NUMERO', null, undefined, '', 'PRO-005'])).toBe(6)
  })

  it('convive con el codigo viejo, que termina en 001', () => {
    expect(nextDocSeq([DOC_CODE_SENTINEL])).toBe(2)
  })
})

describe('needsDocCode', () => {
  it('reconoce el centinela y el vacio como «sin codificar»', () => {
    expect(needsDocCode(DOC_CODE_SENTINEL)).toBe(true)
    expect(needsDocCode('')).toBe(true)
    expect(needsDocCode(null)).toBe(true)
  })

  it('respeta un codigo ya asignado o escrito a mano', () => {
    expect(needsDocCode('PRO-VENTAS-001')).toBe(false)
    expect(needsDocCode('MI-CODIGO-PROPIO')).toBe(false)
  })
})
