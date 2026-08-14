import { describe, it, expect } from 'vitest'
import { planCap, planTokens, planPrice, planName, clampLevel, hasNextLevel, PLAN_MAX_LEVEL } from './plans'

describe('la escalera, nivel por nivel', () => {
  it.each([
    [0, 20, 1000, 0],
    [1, 30, 2000, 20],
    [2, 40, 3000, 40],
    [3, 50, 4000, 60],
  ])('nivel %i => %i procesos, %i tokens, +$%i', (nivel, cap, tokens, precio) => {
    expect(planCap(nivel)).toBe(cap)
    expect(planTokens(nivel)).toBe(tokens)
    expect(planPrice(nivel)).toBe(precio)
  })
})

describe('clampLevel — un dato corrupto degrada al plan base, no revienta', () => {
  it.each([
    [null, 0],
    [undefined, 0],
    [-5, 0],
    [NaN, 0],
    [2.7, 2],
    [99, PLAN_MAX_LEVEL],
  ])('%s => %i', (entrada, esperado) => {
    expect(clampLevel(entrada as number)).toBe(esperado)
  })

  it('un nivel fuera de rango nunca da mas cupo que el maximo', () => {
    expect(planCap(99)).toBe(planCap(PLAN_MAX_LEVEL))
    expect(planTokens(99)).toBe(planTokens(PLAN_MAX_LEVEL))
  })
})

describe('hasNextLevel', () => {
  it('hay escalon hasta el ultimo, y en el ultimo la salida es Enterprise', () => {
    expect(hasNextLevel(0)).toBe(true)
    expect(hasNextLevel(PLAN_MAX_LEVEL - 1)).toBe(true)
    expect(hasNextLevel(PLAN_MAX_LEVEL)).toBe(false)
  })
})

describe('el contrato del nivel base', () => {
  // El nivel 0 va incluido en la comunidad: si algun dia cuesta, es un cambio
  // de modelo comercial, no un ajuste. Que el test lo diga en voz alta.
  it('el nivel base no cuesta nada adicional', () => {
    expect(planPrice(0)).toBe(0)
  })

  it('cada escalon suma exactamente 10 procesos y 1.000 tokens', () => {
    for (let n = 0; n < PLAN_MAX_LEVEL; n++) {
      expect(planCap(n + 1) - planCap(n)).toBe(10)
      expect(planTokens(n + 1) - planTokens(n)).toBe(1000)
    }
  })
})

describe('el nombre del plan sale del NIVEL, no de la membresia', () => {
  // El fallo que motiva estos tests: el muro llamaba "Community" a quien acababa
  // de pagar, porque miraba `profiles.plan_type` (que vale 'community' para todo
  // el que viene de la comunidad) en vez del nivel comprado.
  it.each([
    [0, 'Plan Community'],
    [1, 'Plan Plus'],
    [2, 'Plan Pro'],
    [3, 'Plan Max'],
  ])('nivel %i => %s', (nivel, nombre) => {
    expect(planName(nivel)).toBe(nombre)
  })

  it('ningun nivel de pago se llama como el base', () => {
    for (let n = 1; n <= PLAN_MAX_LEVEL; n++) {
      expect(planName(n)).not.toBe(planName(0))
    }
  })

  // El nombre ya trae "Plan": si un texto antepone la palabra queda "tu plan Plan Plus".
  it('todos los nombres empiezan por "Plan"', () => {
    for (let n = 0; n <= PLAN_MAX_LEVEL; n++) {
      expect(planName(n).startsWith('Plan ')).toBe(true)
    }
  })

  it('un nivel corrupto degrada al nombre base en vez de quedar indefinido', () => {
    expect(planName(null)).toBe('Plan Community')
    expect(planName(undefined)).toBe('Plan Community')
    expect(planName(-5)).toBe('Plan Community')
    expect(planName(99)).toBe('Plan Max')
  })
})
