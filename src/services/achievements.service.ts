import { supabase } from '@/lib/supabase'
import type { ServiceResult } from '@/services/types'
import {
  AchievementRowSchema,
  AchievementCreateSchema,
  UserAchievementInsertSchema,
  UserAchievementUpdateSchema,
} from '@/lib/schemas/achievement.schema'
import type { AchievementRow, AchievementCreate } from '@/lib/schemas/achievement.schema'

export interface UserAchievementRow {
  id: string
  user_id: string
  achievement_id: string
  unlocked_at: string
  shared_to_community: boolean
  created_at: string
}

// ── 1. Catálogo (solo activos — para usuarios) ────────────────────────────

export async function getAchievements(): ServiceResult<AchievementRow[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error) return { data: null, error: new Error(error.message) }

  const parsed = (data ?? []).map((row) => AchievementRowSchema.parse(row))
  return { data: parsed, error: null }
}

// ── 1b. Catálogo completo (activos + inactivos — para admin) ─────────────

export async function getAllAchievements(): ServiceResult<AchievementRow[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('sort_order')

  if (error) return { data: null, error: new Error(error.message) }

  const parsed = (data ?? []).map((row) => AchievementRowSchema.parse(row))
  return { data: parsed, error: null }
}

// ── 2. Logros desbloqueados del usuario ───────────────────────────────────

export async function getUserAchievements(userId: string): ServiceResult<UserAchievementRow[]> {
  const { data, error } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })

  if (error) return { data: null, error: new Error(error.message) }
  return { data: (data ?? []) as UserAchievementRow[], error: null }
}

// ── 3. Registrar logro desbloqueado ───────────────────────────────────────

export async function unlockAchievement(
  userId: string,
  achievementId: string,
): ServiceResult<UserAchievementRow> {
  const row = UserAchievementInsertSchema.parse({
    user_id: userId,
    achievement_id: achievementId,
    unlocked_at: new Date().toISOString(),
    shared_to_community: false,
  })

  const { data, error } = await supabase
    .from('user_achievements')
    .insert(row)
    .select()
    .single()

  if (error) {
    // 23505 = violación de UNIQUE constraint: el logro ya estaba desbloqueado.
    // No es un error real — el estado local ya es correcto.
    if (error.code === '23505') return { data: null, error: null }
    return { data: null, error: new Error(error.message) }
  }

  return { data: data as UserAchievementRow, error: null }
}

// ── 4. Admin: crear achievement ───────────────────────────────────────────

export async function createAchievement(data: AchievementCreate): ServiceResult<AchievementRow> {
  const validated = AchievementCreateSchema.parse(data)
  const { data: row, error } = await supabase
    .from('achievements')
    .insert(validated)
    .select()
    .single()
  if (error) return { data: null, error: new Error(error.message) }
  return { data: AchievementRowSchema.parse(row), error: null }
}

// ── 5. Admin: actualizar achievement ──────────────────────────────────────

export async function updateAchievement(
  id: string,
  patch: Partial<AchievementCreate>,
): ServiceResult<AchievementRow> {
  const { data: row, error } = await supabase
    .from('achievements')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) return { data: null, error: new Error(error.message) }
  return { data: AchievementRowSchema.parse(row), error: null }
}

// ── 6. Admin: activar / desactivar achievement ────────────────────────────

export async function toggleAchievementActive(id: string, isActive: boolean): ServiceResult<void> {
  const { error } = await supabase
    .from('achievements')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) return { data: null, error: new Error(error.message) }
  return { data: null, error: null }
}

// ── 7b. Sincronizar total_points en profiles ─────────────────────────────

export async function updateTotalPoints(
  userId: string,
  totalPoints: number,
): ServiceResult<null> {
  const { error } = await supabase
    .from('profiles')
    .update({ total_points: totalPoints })
    .eq('id', userId)
  if (error) return { data: null, error: new Error(error.message) }
  return { data: null, error: null }
}

// ── 7. Marcar logro como compartido ──────────────────────────────────────

export async function markAchievementShared(
  userId: string,
  achievementId: string,
): ServiceResult<void> {
  const update = UserAchievementUpdateSchema.parse({ shared_to_community: true })

  const { error } = await supabase
    .from('user_achievements')
    .update(update)
    .eq('user_id', userId)
    .eq('achievement_id', achievementId)

  if (error) return { data: null, error: new Error(error.message) }
  return { data: null, error: null }
}
