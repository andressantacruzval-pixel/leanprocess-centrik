import { describe, it, expect } from 'vitest'
import { calculateResidual, type ControlItem } from './risk'

/**
 * La formula del riesgo residual llevaba en produccion desde el principio SIN un
 * solo test, y gobierna 188 riesgos reales. Se añade al hacerla visible en vivo en
 * el modal: hasta ahora el usuario no veia el resultado hasta guardar y reabrir, asi
 * que un error de calculo era practicamente invisible.
 */

const control = (score: number, mitigates: ControlItem['mitigates']): ControlItem =>
  ({ score, mitigates } as ControlItem)

describe('calculateResidual', () => {
  it('sin controles, el residual es el inherente', () => {
    expect(calculateResidual(5, 5, [])).toEqual({ residualProbability: 5, residualImpact: 5 })
  })

  it('un control OPTIMO (>=33) baja 2; uno BUENO (>=25) baja 1', () => {
    expect(calculateResidual(5, 5, [control(33, 'Ambos')]))
      .toEqual({ residualProbability: 3, residualImpact: 3 })
    expect(calculateResidual(5, 5, [control(25, 'Ambos')]))
      .toEqual({ residualProbability: 4, residualImpact: 4 })
  })

  it('un control REGULAR o peor (<25) no reduce nada', () => {
    // No es un descuido: por debajo de 25 el control no se considera eficaz.
    expect(calculateResidual(5, 5, [control(24, 'Ambos')]))
      .toEqual({ residualProbability: 5, residualImpact: 5 })
  })

  it('`mitigates` decide que eje baja', () => {
    expect(calculateResidual(5, 5, [control(33, 'Probabilidad')]))
      .toEqual({ residualProbability: 3, residualImpact: 5 })
    expect(calculateResidual(5, 5, [control(33, 'Impacto')]))
      .toEqual({ residualProbability: 5, residualImpact: 3 })
  })

  it('nunca baja de 1, aunque se acumulen controles', () => {
    const muchos = [control(33, 'Ambos'), control(33, 'Ambos'), control(33, 'Ambos')]
    expect(calculateResidual(2, 2, muchos)).toEqual({ residualProbability: 1, residualImpact: 1 })
  })

  it('los controles SIN evaluar (score 0) se ignoran', () => {
    // Los que extrae la IA nacen en 0: no deben rebajar un riesgo que nadie ha valorado.
    expect(calculateResidual(4, 4, [control(0, 'Ambos')]))
      .toEqual({ residualProbability: 4, residualImpact: 4 })
  })

  it('acumula linealmente y sin saturacion — el punto debil conocido', () => {
    // Tres controles optimos dejan un 5x5 en 1x1. Documentado a proposito: si algun
    // dia se decide que el efecto tenga rendimientos decrecientes, este test es el
    // que hay que cambiar, y asi el cambio se ve.
    const tres = [control(33, 'Ambos'), control(33, 'Ambos'), control(33, 'Ambos')]
    expect(calculateResidual(5, 5, tres)).toEqual({ residualProbability: 1, residualImpact: 1 })
  })
})
