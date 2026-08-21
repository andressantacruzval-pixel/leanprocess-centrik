import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useMembershipStore } from '@/stores/membershipStore'
import { useUiStore } from '@/stores/uiStore'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'
import { toast } from '@/stores/toastStore'
import { MainLayout } from '@/components/layout'
import { PageSpinner } from '@/components/ui/PageSpinner'
import { RedirectToLite, liteSignupUrl, LOCAL_AUTH } from '@/features/auth/lite'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

// ── Lazy-loaded pages ─────────────────────────────────────────────────
// Each page becomes its own chunk. Users only download what they visit.
// Critical-path pages (Landing, Login) stay eager for instant first paint.
const Landing = lazy(() => import('@/pages/Landing'))
const LocalLoginPage = lazy(() => import('@/features/auth/pages/LocalLoginPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'))
const OnboardingPage = lazy(() => import('@/features/onboarding/pages/OnboardingPage'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const ProcessMapPage = lazy(() => import('@/features/process/pages/ProcessMapPage'))
const ProcessMapOnboardingPage = lazy(() => import('@/pages/ProcessMapOnboardingPage'))
const FlowchartOnboardingPage = lazy(() => import('@/pages/FlowchartOnboardingPage'))
const ProcessLevelsPage = lazy(() => import('@/features/process/pages/ProcessLevelsPage'))
const ProcessDetailPage = lazy(() => import('@/features/process/pages/ProcessDetailPage'))
const ProcessCharacterizationPage = lazy(() => import('@/pages/ProcessCharacterizationPage'))
const ProcedurePage = lazy(() => import('@/features/procedure/pages/ProcedurePage'))
const KpiPage = lazy(() => import('@/features/kpi/pages/KpiPage'))
const BpmnEditorPage = lazy(() => import('@/features/bpmn/pages/BpmnEditorPage'))
const AiConsultantPage = lazy(() => import('@/features/ai-consultant/pages/AiConsultantPage'))
const IndicatorsPage = lazy(() => import('@/features/kpi/pages/IndicatorsPage'))
const OrgStructurePage = lazy(() => import('@/features/org-structure/pages/OrgStructurePage'))
const CatalogsPage = lazy(() => import('@/features/catalog/pages/CatalogsPage'))
const SettingsPage = lazy(() => import('@/features/auth/pages/SettingsPage'))
const HeatMapPage = lazy(() => import('@/features/risk/pages/HeatMapPage'))
const AdminPage = lazy(() => import('@/features/analytics/pages/AdminPage'))
const ReportsPage = lazy(() => import('@/features/reporting/pages/ReportsPage'))
const AchievementsPage = lazy(() => import('@/features/gamification/pages/AchievementsPage'))
const PresentationPage = lazy(() => import('@/features/presentation/pages/PresentationPage'))
const AdminBillingPage = lazy(() => import('@/features/analytics/pages/AdminBillingPage'))
const ApiDocsPage = lazy(() => import('@/pages/ApiDocsPage'))
const HubEntry = lazy(() => import('@/pages/HubEntry'))
const NotFound = lazy(() => import('@/pages/NotFound'))

// ── React Query — stale-while-revalidate por defecto ──────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,   // 2 min antes de refetch
      gcTime: 10 * 60 * 1000,     // 10 min en cache
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * Solo `profiles.is_admin`. Hasta ahora el panel de admin únicamente se
 * ocultaba del sidebar: cualquiera con sesión podía escribir /app/admin y ver
 * la interfaz (RLS tapaba los datos ajenos, pero la pantalla cargaba).
 * Se monta dentro de ProtectedRoute, así que aquí la sesión ya está resuelta.
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore((s) => s.profile)
  const loading = useAuthStore((s) => s.loading)
  if (loading) return <PageSpinner />
  if (!profile?.is_admin) return <Navigate to="/app" replace />
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const profile = useAuthStore((s) => s.profile)
  const allCompanies = useWorkspaceStore((s) => s.companies)
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId)

  // Carga global (empresas + billing) — DEBE terminar antes de evaluar
  // needsOnboarding, si no el usuario verá el spinner el primer instante
  // y luego saltará a onboarding porque `companies` aún no se cargó.
  const { ready: bootstrapReady, error: bootstrapError } = useAuthBootstrap()

  // Use user.id as fallback when profile hasn't loaded yet (race condition)
  const userId = profile?.id ?? user?.id
  // Filter companies: admin sees all, regular user sees only theirs
  const companies = profile?.is_admin
    ? allCompanies
    : allCompanies.filter((c) => c.user_id === userId)
  const startTrialIfNeeded = useWorkspaceStore((s) => s.startTrialIfNeeded)
  const subscription = useWorkspaceStore((s) => s.subscription)
  const syncCompany = useCompanyStore((s) => s.syncWithActiveCompany)
  const legacyCompany = useCompanyStore((s) => s.company)
  const ensureOwner = useMembershipStore((s) => s.ensureOwner)
  const location = useLocation()

  // Bootstrap del trial para que los gates de billing tengan contexto.
  useEffect(() => {
    if (user && !subscription) {
      startTrialIfNeeded(user.id)
    }
  }, [user, subscription, startTrialIfNeeded])

  // Migracion de datos legacy: si el usuario tenia una empresa en el
  // antiguo companyStore pero aun no esta en el nuevo workspaceStore,
  // la traemos como primera empresa (sin cobro).
  useEffect(() => {
    if (!user) return
    if (companies.length === 0 && legacyCompany) {
      useWorkspaceStore.setState({
        companies: [legacyCompany],
        activeCompanyId: legacyCompany.id,
      })
      ensureOwner(legacyCompany.id, user.id, profile?.email ?? '', profile?.full_name)
    }
  }, [user, companies.length, legacyCompany, ensureOwner, profile])

  // Sync bidireccional: companyStore siempre refleja la empresa activa.
  useEffect(() => {
    if (!activeCompanyId) return
    const active = companies.find((c) => c.id === activeCompanyId) ?? null
    if (active) {
      syncCompany(active)
    }
  }, [activeCompanyId, companies, syncCompany])

  // Notificar de fallo de bootstrap una sola vez — si no se pudo cargar las
  // empresas, el usuario verá onboarding incorrecto pero al menos sabrá por qué.
  useEffect(() => {
    if (bootstrapError) {
      toast.error('No se pudo cargar tus empresas desde la nube. Revisa tu conexión.')
    }
  }, [bootstrapError])

  if (loading || !bootstrapReady) return <PageSpinner />
  if (!user) return <RedirectToLite />

  const activeCompany = companies.find((c) => c.id === activeCompanyId) ?? null
  const needsOnboarding = !activeCompany || !activeCompany.onboarding_completed

  if (needsOnboarding && !location.pathname.startsWith('/onboarding')) {
    return <Navigate to="/onboarding" />
  }

  return <>{children}</>
}

function ProtectedOnboarding({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const profile = useAuthStore((s) => s.profile)
  const allCompanies = useWorkspaceStore((s) => s.companies)
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId)
  const { ready: bootstrapReady } = useAuthBootstrap()

  if (loading || !bootstrapReady) return <PageSpinner />
  if (!user) return <RedirectToLite />

  // Solo redirigir a /app si la empresa ACTIVA ya completó el onboarding.
  // Usar .some() causaba un loop cuando el usuario tenía una empresa completada
  // (A) y cambiaba a una nueva sin completar (B): ProtectedRoute enviaba a
  // /onboarding por B, y este guard rebotaba a /app por A → loop infinito.
  const userId = profile?.id ?? user.id
  const ownCompanies = profile?.is_admin ? allCompanies : allCompanies.filter((c) => c.user_id === userId)
  const activeCompany = ownCompanies.find((c) => c.id === activeCompanyId) ?? null
  if (activeCompany?.onboarding_completed) {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}

function App() {
  const initializeAuth = useAuthStore((s) => s.initializeAuth)
  const theme = useUiStore((s) => s.theme)

  useEffect(() => {
    return initializeAuth()
  }, [initializeAuth])

  // Aplica el tema (claro/oscuro) al <html> para que la capa CSS de tema actúe.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            {/* El login y el registro viven solo en Lite (ver features/auth/lite.tsx) */}
            <Route path="/login" element={LOCAL_AUTH ? <LocalLoginPage /> : <RedirectToLite />} />
            <Route path="/register" element={LOCAL_AUTH ? <LocalLoginPage signup /> : <RedirectToLite to={liteSignupUrl} />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/hub-entry" element={<HubEntry />} />
            <Route path="/app/hub-entry" element={<HubEntry />} />
            <Route path="/onboarding" element={<ProtectedOnboarding><OnboardingPage /></ProtectedOnboarding>} />
            <Route path="/app" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="process-map" element={<ProcessMapPage />} />
              <Route path="process-map/onboarding" element={<ProcessMapOnboardingPage />} />
              <Route path="process/:processId/flowchart/onboarding" element={<FlowchartOnboardingPage />} />
              <Route path="process-levels" element={<ProcessLevelsPage />} />
              <Route path="process/:id" element={<ProcessDetailPage />} />
              <Route path="process/:processId/characterization" element={<ProcessCharacterizationPage />} />
              <Route path="process/:processId/procedure" element={<ProcedurePage />} />
              <Route path="process/:processId/indicators" element={<KpiPage />} />
              <Route path="bpmn/:processId" element={<BpmnEditorPage />} />
              <Route path="ai-consultant" element={<AiConsultantPage />} />
              <Route path="indicators" element={<IndicatorsPage />} />
              <Route path="indicators/:processId" element={<IndicatorsPage />} />
              <Route path="org-structure" element={<OrgStructurePage />} />
              <Route path="catalogs" element={<CatalogsPage />} />
              <Route path="heat-map" element={<HeatMapPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="achievements" element={<AchievementsPage />} />
              <Route path="presentation" element={<PresentationPage />} />
              <Route path="api-docs" element={<ApiDocsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
              <Route path="admin/billing" element={<AdminRoute><AdminBillingPage /></AdminRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}

export default App
