import { describe, it, expect } from 'vitest'
import { RiskRowSchema, ControlRowSchema } from './risk.schema'
import { generateId } from '@/utils/id'

describe('RiskRowSchema', () => {
  const base = {
    id: generateId(),
    process_id: generateId(),
    company_id: 'company-1',
    title: 'Riesgo de prueba',
  }

  it('accepts a minimal valid row', () => {
    expect(() => RiskRowSchema.parse(base)).not.toThrow()
  })

  it('accepts a fully populated row', () => {
    expect(() =>
      RiskRowSchema.parse({
        ...base,
        process_step: 'Paso 1',
        risk_cause: 'Falla del proceso',
        risk_event: 'Error en validacion',
        risk_effect: 'Datos incorrectos',
        category: 'Operacional',
        inherent_probability: 3,
        inherent_impact: 5,
        residual_probability: 2,
        residual_impact: 3,
        bpmn_element_id: null,
      })
    ).not.toThrow()
  })

  it('rejects non-UUID id', () => {
    expect(() => RiskRowSchema.parse({ ...base, id: 'not-a-uuid' })).toThrow()
  })

  it('rejects empty title', () => {
    expect(() => RiskRowSchema.parse({ ...base, title: '' })).toThrow()
  })

  it('rejects title > 500 chars', () => {
    expect(() => RiskRowSchema.parse({ ...base, title: 'a'.repeat(501) })).toThrow()
  })

  it('rejects invalid category', () => {
    expect(() =>
      RiskRowSchema.parse({ ...base, category: 'Desconocido' })
    ).toThrow()
  })

  it('rejects probability out of range', () => {
    expect(() => RiskRowSchema.parse({ ...base, inherent_probability: 0 })).toThrow()
    expect(() => RiskRowSchema.parse({ ...base, inherent_impact: 6 })).toThrow()
  })
})

describe('ControlRowSchema', () => {
  const base = {
    id: generateId(),
    risk_id: generateId(),
  }

  it('accepts minimal row', () => {
    expect(() => ControlRowSchema.parse(base)).not.toThrow()
  })

  it('rejects ScoreValue not in [1,3,5]', () => {
    expect(() => ControlRowSchema.parse({ ...base, type: 2 })).toThrow()
    expect(() => ControlRowSchema.parse({ ...base, nature: 4 })).toThrow()
  })

  it('accepts valid ScoreValues', () => {
    expect(() => ControlRowSchema.parse({ ...base, type: 1, nature: 3, doc: 5 })).not.toThrow()
  })

  it('accepts valid mitigates values', () => {
    expect(() => ControlRowSchema.parse({ ...base, mitigates: 'Probabilidad' })).not.toThrow()
    expect(() => ControlRowSchema.parse({ ...base, mitigates: 'Ambos' })).not.toThrow()
  })

  it('rejects invalid mitigates value', () => {
    expect(() => ControlRowSchema.parse({ ...base, mitigates: 'Nada' })).toThrow()
  })
})
