/**
 * notificationStore
 * ─────────────────
 * Smart notifications based on current app state.
 * DB-backed: las notificaciones del sistema se cargan desde la tabla `notifications`.
 * Las smart notifications (contextuales) son efímeras y no se insertan en DB.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { generateId } from '@/utils/id'
import { identityMigration } from '@/utils/storeUtils'

export interface Notification {
  id: string
  type: 'info' | 'warning' | 'achievement' | 'streak'
  title: string
  description: string
  actionUrl?: string
  read: boolean
  createdAt: number
}

interface NotificationState {
  notifications: Notification[]
  /** IDs de notificaciones que vienen de Supabase (solo estas se sincronizan al marcar leídas) */
  dbNotificationIds: Set<string>
  generateSmartNotifications: () => void
  markRead: (id: string) => void
  markAllRead: () => void
  /** Elimina notificaciones leídas con más de 7 días de antigüedad — SOLO localStorage */
  purgeOldNotifications: () => number
  unreadCount: number
  loadFromDB: (userId: string, companyId: string) => Promise<void>
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      dbNotificationIds: new Set<string>(),
      unreadCount: 0,

      generateSmartNotifications: () => {
        // Use generateNotificationsWithContext() instead — it accepts
        // pre-computed data from React components and avoids circular deps.
        // This method is kept as a no-op for backward compat.
      },

      markRead: (id: string) => {
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          )
          return {
            notifications,
            unreadCount: notifications.filter((n) => !n.read).length,
          }
        })
        // Sincronizar en DB solo si la notificación vino del servidor
        if (get().dbNotificationIds.has(id)) {
          void (async () => {
            const { supabase } = await import('@/lib/supabase')
            await supabase.from('notifications').update({ read: true }).eq('id', id)
          })()
        }
      },

      markAllRead: () => {
        const dbIds = [...get().dbNotificationIds]
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }))
        if (dbIds.length > 0) {
          void (async () => {
            const { supabase } = await import('@/lib/supabase')
            await supabase.from('notifications').update({ read: true }).in('id', dbIds)
          })()
        }
      },

      purgeOldNotifications: () => {
        // SOLO limpia localStorage — nunca toca DB
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
        const before = get().notifications.length
        set((s) => {
          const filtered = s.notifications.filter(
            (n) => !n.read || n.createdAt >= cutoff
          )
          return {
            notifications: filtered,
            unreadCount: filtered.filter((n) => !n.read).length,
          }
        })
        return before - get().notifications.length
      },

      loadFromDB: async (userId: string, companyId: string) => {
        try {
          const { supabase } = await import('@/lib/supabase')
          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(50)
          if (error || !data) return

          const dbIds = new Set<string>(data.map((n) => n.id))
          const dbNotifications: Notification[] = data.map((n) => ({
            id: n.id,
            type: n.type as Notification['type'],
            title: n.title,
            description: n.message ?? '',
            actionUrl: n.link ?? undefined,
            read: n.read,
            createdAt: new Date(n.created_at).getTime(),
          }))

          // Merge: notificaciones de DB + smart notifications locales (sin duplicar por id)
          const existing = get().notifications.filter((n) => !dbIds.has(n.id))
          const merged = [...dbNotifications, ...existing].slice(0, 50)
          set({
            notifications: merged,
            dbNotificationIds: dbIds,
            unreadCount: merged.filter((n) => !n.read).length,
          })
        } catch { /* silent */ }
      },
    }),
    {
      name: 'lean-process-notifications',
      version: 2,
      partialize: (state) => ({
        notifications: state.notifications,
      }),
      migrate: identityMigration(),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<NotificationState>) }
        const notifications = merged.notifications ?? []
        return {
          ...merged,
          dbNotificationIds: new Set<string>(),
          unreadCount: notifications.filter((n: Notification) => !n.read).length,
        }
      },
    }
  )
)

/**
 * Generate notifications with full context (called from React components).
 * This avoids the lazy require issues by accepting pre-computed data.
 */
export function generateNotificationsWithContext(ctx: {
  processesWithoutKpis: { count: number; firstId?: string }
  streakData: { todayDone: boolean; current: number }
  nearAchievements: Array<{ title: string; pct: number }>
  lowHealthCount: number
  tokenData?: { available: number; wasRenewed?: boolean; purchaseCompleted?: boolean }
}) {
  const store = useNotificationStore.getState()
  const existing = store.notifications
  const existingTitles = new Set(existing.map((n) => n.title))
  const newNotifications: Notification[] = []

  const addIfNew = (n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => {
    if (existingTitles.has(n.title)) return
    newNotifications.push({
      ...n,
      id: generateId(),
      read: false,
      createdAt: Date.now(),
    })
    existingTitles.add(n.title)
  }

  // 1. Processes without KPIs
  if (ctx.processesWithoutKpis.count > 0) {
    addIfNew({
      type: 'warning',
      title: `Tienes ${ctx.processesWithoutKpis.count} procesos sin KPIs definidos`,
      description: 'Definir KPIs te ayuda a medir el rendimiento de tus procesos.',
      actionUrl: ctx.processesWithoutKpis.firstId
        ? `/app/process/${ctx.processesWithoutKpis.firstId}/indicators`
        : '/app/process-map',
    })
  }

  // 2. (retirada) El aviso de "tu racha se rompe hoy" salió el 2026-08-08 junto con
  //    el resto de la racha: presionaba por entrar, no por avanzar. Y la campana
  //    acababa de hacerse visible, así que habría empezado a insistir justo ahora.

  // 3. Near achievements (>=90%)
  for (const ach of ctx.nearAchievements) {
    addIfNew({
      type: 'achievement',
      title: `Estas al ${Math.round(ach.pct * 100)}% de desbloquear '${ach.title}'`,
      description: 'Sigue asi, estas muy cerca de un nuevo logro.',
      actionUrl: '/app/achievements',
    })
  }

  // 4. Low health processes
  if (ctx.lowHealthCount > 0) {
    addIfNew({
      type: 'warning',
      title: `${ctx.lowHealthCount} procesos necesitan atencion`,
      description: 'Algunos procesos tienen menos del 33% de completitud.',
      actionUrl: '/app/process-map',
    })
  }

  // 5. Token notifications
  if (ctx.tokenData) {
    const { available, wasRenewed, purchaseCompleted } = ctx.tokenData
    if (available < 100 && available >= 0) {
      addIfNew({
        type: 'warning',
        title: 'Tokens de IA bajos',
        description: `Te quedan ${available} tokens. Recarga para seguir usando IA.`,
        actionUrl: '/app/billing',
      })
    }
    if (wasRenewed) {
      addIfNew({
        type: 'info',
        title: 'Tokens renovados',
        description: 'Tu cuota mensual de tokens IA ha sido renovada.',
        actionUrl: '/app/billing',
      })
    }
    if (purchaseCompleted) {
      addIfNew({
        type: 'info',
        title: 'Compra de tokens confirmada',
        description: 'Los tokens han sido agregados a tu balance.',
        actionUrl: '/app/billing',
      })
    }
  }

  if (newNotifications.length > 0) {
    const merged = [...newNotifications, ...existing].slice(0, 50)
    useNotificationStore.setState({
      notifications: merged,
      unreadCount: merged.filter((n) => !n.read).length,
    })
  }
}
