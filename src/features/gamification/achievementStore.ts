/**
 * achievementStore
 * ────────────────
 * Badges / achievements gamification system.
 *
 * Arquitectura:
 * - Supabase (achievements + user_achievements) es la fuente de verdad
 * - Zustand + localStorage actúa como caché local con fallback offline
 * - catalog: catálogo de achievements cargado desde DB al iniciar sesión
 * - unlockAchievement: optimistic update local → fire-and-forget a Supabase
 * - loadFromDB: sincroniza logros desbloqueados del usuario desde Supabase
 * - loadCatalog: carga el catálogo de achievements desde DB (activos)
 *
 * Circle community: https://process-masters.circle.so/c/automatizacion-y-herramientas/
 * n8n sync: domingos 23:59 — lee la vista gamification_sync de Supabase
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { identityMigration } from '@/utils/storeUtils'
import { useAuthStore } from '@/stores/authStore'
import {
  getAchievements,
  unlockAchievement as unlockAchievementDB,
  getUserAchievements,
  markAchievementShared as markAchievementSharedDB,
  updateTotalPoints,
} from '@/services/achievements.service'
import type { AchievementRow } from '@/lib/schemas/achievement.schema'

// ── Types ────────────────────────────────────────────────────────────────

// Alias para compatibilidad con componentes que importan Achievement
export type Achievement = AchievementRow

export interface UnlockedAchievement {
  achievementId: string
  unlockedAt: number
  sharedToCommunity: boolean
}

export interface CommunityEvent {
  id: string
  type: 'achievement_unlocked' | 'milestone_reached' | 'report_shared' | 'process_published'
  payload: Record<string, unknown>
  timestamp: number
  synced: boolean  // N8N webhook consumed this
}

export interface CommunityPost {
  id: string
  type: 'achievement' | 'report' | 'process' | 'benchmark'
  title: string
  description: string
  metadata: Record<string, unknown>
  createdAt: number
  exportUrl?: string  // Circle post URL after publishing
}

// ── Store ────────────────────────────────────────────────────────────────

interface AchievementState {
  unlockedAchievements: UnlockedAchievement[]
  totalPoints: number
  communityQueue: CommunityEvent[]
  communityPosts: CommunityPost[]
  /** Newly unlocked IDs not yet shown to user */
  pendingNotifications: string[]
  webhookUrl: string | null
  /** Catálogo de achievements cargado desde DB (reemplaza el array hardcodeado) */
  catalog: AchievementRow[]
  /** true después del primer loadCatalog() exitoso */
  catalogLoaded: boolean
  /** true después del primer loadFromDB() completado (éxito O error) — bloquea useAchievementTracker */
  achievementsLoaded: boolean

  unlockAchievement: (id: string) => boolean
  isUnlocked: (id: string) => boolean
  getUnlockedList: () => (AchievementRow & { unlockedAt: number; sharedToCommunity: boolean })[]
  getLockedList: () => AchievementRow[]

  /** Carga el catálogo de achievements activos desde DB */
  loadCatalog: () => Promise<void>
  /** Carga los logros desbloqueados del usuario desde Supabase (fuente de verdad) */
  loadFromDB: (userId: string) => Promise<void>

  /** Creates a community event for N8N webhook consumption */
  publishToCommunity: (type: CommunityEvent['type'], payload: Record<string, unknown>) => void
  /** Creates a community post (for user to share to Circle) */
  createCommunityPost: (post: Omit<CommunityPost, 'id' | 'createdAt'>) => CommunityPost
  /** Mark community event as synced (called by N8N integration) */
  markEventSynced: (eventId: string) => void
  /** Mark achievement as shared to community */
  markShared: (achievementId: string) => void
  /** Dismiss a pending notification */
  dismissNotification: (achievementId: string) => void
  dismissAllNotifications: () => void

  setWebhookUrl: (url: string | null) => void
}

function uid() {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
}

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      unlockedAchievements: [],
      totalPoints: 0,
      communityQueue: [],
      communityPosts: [],
      pendingNotifications: [],
      webhookUrl: null,
      catalog: [],
      catalogLoaded: false,
      achievementsLoaded: false,

      loadCatalog: async () => {
        const { data, error } = await getAchievements()
        if (error || !data) return
        set({ catalog: data, catalogLoaded: true })
      },

      unlockAchievement: (id) => {
        if (get().isUnlocked(id)) return false
        const achievement = get().catalog.find((a) => a.id === id)
        if (!achievement) return false

        const unlocked: UnlockedAchievement = {
          achievementId: id,
          unlockedAt: Date.now(),
          sharedToCommunity: false,
        }

        set((s) => ({
          unlockedAchievements: [...s.unlockedAchievements, unlocked],
          totalPoints: s.totalPoints + achievement.points,
          pendingNotifications: [...s.pendingNotifications, id],
        }))

        // Add to community queue for N8N
        get().publishToCommunity('achievement_unlocked', {
          achievementId: id,
          title: achievement.title,
          description: achievement.description,
          points: achievement.points,
          tier: achievement.tier,
          category: achievement.category,
          totalPoints: get().totalPoints,
        })

        // Persistir en Supabase — fire-and-forget
        const userId = useAuthStore.getState().user?.id
        if (userId) {
          void unlockAchievementDB(userId, id)
        }

        return true
      },

      isUnlocked: (id) => get().unlockedAchievements.some((u) => u.achievementId === id),

      getUnlockedList: () => {
        const { unlockedAchievements, catalog } = get()
        return unlockedAchievements
          .map((u) => {
            const def = catalog.find((a) => a.id === u.achievementId)
            if (!def) return null
            return { ...def, unlockedAt: u.unlockedAt, sharedToCommunity: u.sharedToCommunity }
          })
          .filter(Boolean) as (AchievementRow & { unlockedAt: number; sharedToCommunity: boolean })[]
      },

      getLockedList: () => {
        const unlocked = new Set(get().unlockedAchievements.map((u) => u.achievementId))
        return get().catalog.filter((a) => !unlocked.has(a.id))
      },

      publishToCommunity: (type, payload) => {
        const event: CommunityEvent = {
          id: uid(),
          type,
          payload,
          timestamp: Date.now(),
          synced: false,
        }
        set((s) => ({ communityQueue: [...s.communityQueue.slice(-100), event] }))
      },

      createCommunityPost: (post) => {
        const full: CommunityPost = { ...post, id: uid(), createdAt: Date.now() }
        set((s) => ({ communityPosts: [...s.communityPosts, full] }))
        return full
      },

      markEventSynced: (eventId) => {
        set((s) => ({
          communityQueue: s.communityQueue.map((e) =>
            e.id === eventId ? { ...e, synced: true } : e
          ),
        }))
      },

      markShared: (achievementId) => {
        set((s) => ({
          unlockedAchievements: s.unlockedAchievements.map((u) =>
            u.achievementId === achievementId ? { ...u, sharedToCommunity: true } : u
          ),
        }))
        const userId = useAuthStore.getState().user?.id
        if (userId) {
          void markAchievementSharedDB(userId, achievementId)
        }
      },

      dismissNotification: (achievementId) => {
        set((s) => ({
          pendingNotifications: s.pendingNotifications.filter((id) => id !== achievementId),
        }))
      },

      dismissAllNotifications: () => set({ pendingNotifications: [] }),

      setWebhookUrl: (url) => set({ webhookUrl: url }),

      loadFromDB: async (userId) => {
        try {
          const { data, error } = await getUserAchievements(userId)
          if (error || !data) return

          const unlockedAchievements: UnlockedAchievement[] = data.map((row) => ({
            achievementId: row.achievement_id,
            unlockedAt: new Date(row.unlocked_at).getTime(),
            sharedToCommunity: row.shared_to_community,
          }))

          // Recalcular totalPoints desde el catálogo en store
          const totalPoints = unlockedAchievements.reduce((sum, ua) => {
            const def = get().catalog.find((a) => a.id === ua.achievementId)
            return sum + (def?.points ?? 0)
          }, 0)

          set({ unlockedAchievements, totalPoints })

          // fire-and-forget: mantener profiles.total_points sincronizado en DB
          void updateTotalPoints(userId, totalPoints)
        } finally {
          // SIEMPRE desbloquear el tracker, incluso si la carga falló
          set({ achievementsLoaded: true })
        }
      },
    }),
    {
      name: 'lean-process-achievements',
      version: 4,
      partialize: (state) => ({
        unlockedAchievements: state.unlockedAchievements,
        totalPoints: state.totalPoints,
        communityQueue: state.communityQueue.slice(-100),
        communityPosts: state.communityPosts,
        webhookUrl: state.webhookUrl,
        // catalog y catalogLoaded se omiten: deben recargarse desde DB cada sesión
        // para reflejar cambios de puntos o logros sin forzar limpieza de localStorage
      }),
      migrate: identityMigration(),
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
