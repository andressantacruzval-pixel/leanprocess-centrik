import { z } from 'zod'

export const AchievementCategorySchema = z.enum([
  'procesos', 'riesgos', 'documentacion', 'analisis', 'maestria', 'comunidad',
])

export const AchievementTierSchema = z.enum(['bronze', 'silver', 'gold', 'platinum'])

// Valida filas del catálogo que llegan desde DB
export const AchievementRowSchema = z.object({
  id:          z.string().min(1).max(100),
  title:       z.string().min(1).max(200),
  description: z.string().max(500),
  icon:        z.string().min(1).max(100),
  category:    AchievementCategorySchema,
  points:      z.number().int().positive(),
  tier:        AchievementTierSchema,
  criteria:    z.string().max(300).default(''),
  is_active:   z.boolean().default(true),
  sort_order:  z.number().int().default(0),
})

// Valida el INSERT hacia user_achievements
export const UserAchievementInsertSchema = z.object({
  user_id:             z.string().uuid(),
  achievement_id:      z.string().min(1).max(100),
  unlocked_at:         z.string().datetime().optional(),
  shared_to_community: z.boolean().default(false),
})

// Valida la actualización de shared_to_community
export const UserAchievementUpdateSchema = z.object({
  shared_to_community: z.boolean(),
})

// Schema para crear/editar achievements desde el admin panel
export const AchievementCreateSchema = AchievementRowSchema

export type AchievementRow        = z.infer<typeof AchievementRowSchema>
export type AchievementCreate     = z.infer<typeof AchievementCreateSchema>
export type UserAchievementInsert = z.infer<typeof UserAchievementInsertSchema>
export type UserAchievementUpdate = z.infer<typeof UserAchievementUpdateSchema>
