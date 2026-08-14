import { describe, it, expect } from 'vitest'
import {
  AchievementRowSchema,
  UserAchievementInsertSchema,
  UserAchievementUpdateSchema,
} from './achievement.schema'
import { generateId } from '@/utils/id'

const baseAchievement = {
  id: 'first-process',
  title: 'Primer Paso',
  description: 'Crea tu primer subproceso',
  icon: 'Footprints',
  category: 'procesos',
  points: 10,
  tier: 'bronze',
}

describe('AchievementRowSchema', () => {
  it('acepta una fila válida mínima', () => {
    expect(() => AchievementRowSchema.parse(baseAchievement)).not.toThrow()
  })

  it('acepta una fila completa con todos los campos opcionales', () => {
    expect(() =>
      AchievementRowSchema.parse({
        ...baseAchievement,
        criteria: 'Crea 1 subproceso',
        is_active: true,
        sort_order: 1,
      })
    ).not.toThrow()
  })

  it('rechaza category inválida', () => {
    expect(() =>
      AchievementRowSchema.parse({ ...baseAchievement, category: 'invalida' })
    ).toThrow()
  })

  it('rechaza tier inválido', () => {
    expect(() =>
      AchievementRowSchema.parse({ ...baseAchievement, tier: 'diamond' })
    ).toThrow()
  })

  it('rechaza points en cero', () => {
    expect(() =>
      AchievementRowSchema.parse({ ...baseAchievement, points: 0 })
    ).toThrow()
  })

  it('rechaza points negativos', () => {
    expect(() =>
      AchievementRowSchema.parse({ ...baseAchievement, points: -5 })
    ).toThrow()
  })

  it('rechaza title vacío', () => {
    expect(() =>
      AchievementRowSchema.parse({ ...baseAchievement, title: '' })
    ).toThrow()
  })

  it('rechaza id vacío', () => {
    expect(() =>
      AchievementRowSchema.parse({ ...baseAchievement, id: '' })
    ).toThrow()
  })

  it('aplica default: criteria=""', () => {
    const result = AchievementRowSchema.parse(baseAchievement)
    expect(result.criteria).toBe('')
  })

  it('aplica default: is_active=true', () => {
    const result = AchievementRowSchema.parse(baseAchievement)
    expect(result.is_active).toBe(true)
  })

  it('acepta todas las categorías válidas', () => {
    const categories = ['procesos', 'riesgos', 'documentacion', 'analisis', 'maestria', 'comunidad']
    for (const category of categories) {
      expect(() =>
        AchievementRowSchema.parse({ ...baseAchievement, category })
      ).not.toThrow()
    }
  })

  it('acepta todos los tiers válidos', () => {
    const tiers = ['bronze', 'silver', 'gold', 'platinum']
    for (const tier of tiers) {
      expect(() =>
        AchievementRowSchema.parse({ ...baseAchievement, tier })
      ).not.toThrow()
    }
  })
})

describe('UserAchievementInsertSchema', () => {
  it('acepta un insert válido', () => {
    expect(() =>
      UserAchievementInsertSchema.parse({
        user_id: generateId(),
        achievement_id: 'first-process',
      })
    ).not.toThrow()
  })

  it('rechaza user_id que no es UUID', () => {
    expect(() =>
      UserAchievementInsertSchema.parse({
        user_id: 'not-a-uuid',
        achievement_id: 'first-process',
      })
    ).toThrow()
  })

  it('rechaza achievement_id vacío', () => {
    expect(() =>
      UserAchievementInsertSchema.parse({
        user_id: generateId(),
        achievement_id: '',
      })
    ).toThrow()
  })

  it('aplica default shared_to_community=false', () => {
    const result = UserAchievementInsertSchema.parse({
      user_id: generateId(),
      achievement_id: 'first-process',
    })
    expect(result.shared_to_community).toBe(false)
  })

  it('acepta unlocked_at como datetime ISO', () => {
    expect(() =>
      UserAchievementInsertSchema.parse({
        user_id: generateId(),
        achievement_id: 'first-process',
        unlocked_at: new Date().toISOString(),
      })
    ).not.toThrow()
  })

  it('rechaza unlocked_at con formato inválido', () => {
    expect(() =>
      UserAchievementInsertSchema.parse({
        user_id: generateId(),
        achievement_id: 'first-process',
        unlocked_at: 'not-a-date',
      })
    ).toThrow()
  })
})

describe('UserAchievementUpdateSchema', () => {
  it('acepta shared_to_community: true', () => {
    expect(() =>
      UserAchievementUpdateSchema.parse({ shared_to_community: true })
    ).not.toThrow()
  })

  it('acepta shared_to_community: false', () => {
    expect(() =>
      UserAchievementUpdateSchema.parse({ shared_to_community: false })
    ).not.toThrow()
  })

  it('rechaza shared_to_community de tipo string', () => {
    expect(() =>
      UserAchievementUpdateSchema.parse({ shared_to_community: 'yes' })
    ).toThrow()
  })

  it('rechaza un objeto vacío (campo requerido)', () => {
    expect(() => UserAchievementUpdateSchema.parse({})).toThrow()
  })
})
