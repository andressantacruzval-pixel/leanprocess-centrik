import { useEffect, useRef } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useAuthStore } from '@/stores/authStore'
import { useBillingStore } from '@/stores/billingStore'
import { useRiskStore } from '@/stores/riskStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { useProcedureStore } from '@/stores/procedureStore'
import { useAuditStore } from '@/stores/auditStore'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'
import { useImprovementStore } from '@/stores/improvementStore'
import { useAssetStore } from '@/stores/assetStore'
import { useApplicationStore } from '@/stores/applicationStore'
import { useMembershipStore } from '@/stores/membershipStore'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { generateNotificationsWithContext, useNotificationStore } from '@/features/notifications/notificationStore'
import { useAchievementStore } from '@/features/gamification/achievementStore'
import { useStreakStore } from '@/features/gamification/streakStore'
import { useOnboardingStore } from '@/features/onboarding/onboardingStore'
import { useDashboardSnapshotStore } from '@/stores/dashboardSnapshotStore'

/**
 * Sincroniza la data PER-EMPRESA en los stores locales cada vez que cambia la
 * empresa activa. Se invoca una sola vez dentro de MainLayout.
 *
 * La carga GLOBAL por-usuario (empresas + billing) vive en `useAuthBootstrap`,
 * que corre dentro de ProtectedRoute ANTES de decidir onboarding vs app. Eso
 * rompe el deadlock previo donde las empresas solo se cargaban si MainLayout
 * montaba, pero MainLayout no montaba hasta tener empresas.
 *
 * Stores sincronizados per-empresa:
 *  org, procesos, riesgos, indicadores, procedimientos, auditorías,
 *  análisis de valor, changelog, memberships.
 */
export function useWorkspaceSync() {
  const user = useAuthStore((s) => s.user)
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId)
  const loadOrg = useCompanyStore((s) => s.loadOrgFromDB)
  const loadProcesses = useProcessStore((s) => s.loadFromDB)
  const loadRisks = useRiskStore((s) => s.loadFromDB)
  const loadIndicators = useIndicatorStore((s) => s.loadFromDB)
  const loadProcedures = useProcedureStore((s) => s.loadFromDB)
  const loadAudits = useAuditStore((s) => s.loadFromDB)
  const loadValueAnalysis = useValueAnalysisStore((s) => s.loadFromDB)
  const loadImprovements = useImprovementStore((s) => s.loadFromDB)
  const loadAssets = useAssetStore((s) => s.loadFromDB)
  const loadApplications = useApplicationStore((s) => s.loadFromDB)
  const loadMemberships = useMembershipStore((s) => s.loadFromDB)
  const loadCatalogs = useCatalogStore((s) => s.loadFromDB)
  const loadOnboardingMilestones = useOnboardingStore((s) => s.loadMilestonesFromDB)
  const loadSnapshots = useDashboardSnapshotStore((s) => s.loadFromDB)
  const loadNotifications = useNotificationStore((s) => s.loadFromDB)

  // Track the last synced company to avoid re-fetching on unrelated re-renders
  const lastSyncedRef = useRef<string | null>(null)

  // El catálogo de achievements es global (no depende de usuario ni empresa):
  // cargar una vez al montar la app.
  const loadCatalog = useAchievementStore((s) => s.loadCatalog)
  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  // Los logros desbloqueados son per-usuario: cargar una vez al identificarse
  const loadAchievements = useAchievementStore((s) => s.loadFromDB)
  const lastAchievementUserRef = useRef<string | null>(null)

  // Streak es per-usuario: cargar una vez al identificarse
  const loadStreak = useStreakStore((s) => s.loadFromDB)
  const lastStreakUserRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user) return
    if (lastAchievementUserRef.current !== user.id) {
      lastAchievementUserRef.current = user.id
      void loadAchievements(user.id)
    }
    if (lastStreakUserRef.current !== user.id) {
      lastStreakUserRef.current = user.id
      void loadStreak(user.id)
    }
  }, [user, loadAchievements, loadStreak])

  // Notificación de balance bajo de tokens — depende de billing, que carga
  // en useAuthBootstrap. Se dispara una vez por usuario al montar.
  const notifiedLowBalanceRef = useRef(false)
  useEffect(() => {
    if (!user || notifiedLowBalanceRef.current) return
    const wallet = useBillingStore.getState().wallet
    if (!wallet) return
    const available = Math.max(0, wallet.monthlyAllocation - wallet.used) + wallet.bonusBalance
    if (available < 100) {
      notifiedLowBalanceRef.current = true
      generateNotificationsWithContext({
        processesWithoutKpis: { count: 0 },
        streakData: { todayDone: true, current: 0 },
        nearAchievements: [],
        lowHealthCount: 0,
        tokenData: { available },
      })
    }
  }, [user])

  // Load per-company data whenever active company changes
  useEffect(() => {
    if (!activeCompanyId || !user) return
    if (lastSyncedRef.current === activeCompanyId) return

    lastSyncedRef.current = activeCompanyId

    const sync = async () => {
      await Promise.allSettled([
        loadOrg(activeCompanyId),
        loadProcesses(activeCompanyId),
        loadRisks(activeCompanyId),
        loadIndicators(activeCompanyId),
        loadProcedures(activeCompanyId),
        loadAudits(activeCompanyId),
        loadValueAnalysis(activeCompanyId),
        loadImprovements(activeCompanyId),
        loadAssets(activeCompanyId),
        loadApplications(activeCompanyId),
        // El historial YA NO se carga aqui. Traia 500 filas de toda la empresa al
        // iniciar sesion para acabar mostrando 50 de un solo proceso — y en la
        // empresa con 1.289 entradas perdia 789 sin decirlo. Ahora lo pide
        // `ChangeTimeline` del proceso abierto, de 50 en 50. Ver changeLogStore.
        loadMemberships(activeCompanyId),
        loadCatalogs(activeCompanyId),
        loadOnboardingMilestones(activeCompanyId),
        loadSnapshots(activeCompanyId),
        loadNotifications(user.id, activeCompanyId),
      ])
    }
    sync()
  }, [
    activeCompanyId, user,
    loadOrg, loadProcesses, loadRisks, loadIndicators, loadProcedures,
    loadAudits, loadValueAnalysis, loadImprovements, loadAssets, loadApplications, loadMemberships, loadCatalogs,
    loadOnboardingMilestones, loadSnapshots, loadNotifications,
  ])
}
