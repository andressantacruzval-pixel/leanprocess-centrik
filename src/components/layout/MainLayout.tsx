import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { GuidedTour } from '@/features/onboarding/components/GuidedTour'
import { MilestoneConfirmation } from '@/features/onboarding/components/MilestoneConfirmation'
import { GlobalSearch } from '@/features/search/GlobalSearch'
import { AchievementToast } from '@/features/gamification/components/AchievementToast'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { PlanUpgradeModal } from '@/components/ui/PlanUpgradeModal'
import { ProcessAdvisor } from '@/components/advisor/ProcessAdvisor'
import { useUiStore } from '@/stores/uiStore'
import { usePageTracker } from '@/hooks/usePageTracker'
import { useWorkspaceSync } from '@/hooks/useWorkspaceSync'

// Fase 2: cambiar a true para reactivar el botón flotante del asesor
const SHOW_AI_ADVISOR = false

export function MainLayout() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const drawerOpen = useUiStore((s) => s.drawerOpen)
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen)
  const location = useLocation()
  usePageTracker()
  useWorkspaceSync()

  // Navegar cierra el cajon. Antes esto colapsaba la barra de escritorio en CADA ruta,
  // que es por lo que nunca se veia expandida pese al `sidebarOpen: true` del store.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname, setDrawerOpen])

  useEffect(() => {
    if (!drawerOpen) return
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', alPulsar)
    return () => document.removeEventListener('keydown', alPulsar)
  }, [drawerOpen, setDrawerOpen])

  return (
    <div className="flex h-screen bg-surface-ground">
      <Sidebar />
      {/* Fondo del cajon. Solo existe en movil: en >=lg la barra esta siempre a la vista. */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-gray-900/45 lg:hidden"
          aria-hidden
        />
      )}
      {/* Sin margen en movil (la barra sale del flujo); el margen es solo de escritorio. */}
      <div className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'}`}>
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6 bg-surface-ground">
          <Outlet />
        </main>
      </div>
      <GuidedTour />
      <MilestoneConfirmation />
      <GlobalSearch />
      <AchievementToast />
      <ToastContainer />
      {/* Una sola vez para las ocho puertas. Lo enciende `avisarSiSinCupo()`. */}
      <PlanUpgradeModal />
      {SHOW_AI_ADVISOR && <ProcessAdvisor />}
    </div>
  )
}
