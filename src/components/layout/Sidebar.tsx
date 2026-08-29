import { Link, useLocation } from 'react-router-dom'
import { useUiStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useOnboardingStore } from '@/features/onboarding/onboardingStore'
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher'
import { IS_PHASE_1 } from '@/lib/phaseFlags'
import { SupportMenu } from '@/components/layout/SupportMenu'
import {
  LayoutDashboard,
  Map,
  Layers,
  Building2,
  BookOpen,
  Shield,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Award,
  Presentation,
  Bot,
  Route,
  LogOut,
  X,
  //Code,
} from 'lucide-react'

// El Hub vive en Lite. Apuntaba al dominio viejo `herramientas.ia.andres-santacruz.com`, que hoy solo
// es un 308 hacia aquí: funcionaba de rebote y se rompería el día que se retire ese dominio.
const HUB_URL = `${import.meta.env.VITE_LITE_URL ?? 'https://www.leanprocess.app'}/hub`

const navItems = [
  { path: '/app', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/app/copilot', icon: Bot, label: 'Copiloto' },
  { path: '/app/process-map', icon: Map, label: 'Mapa de Procesos' },
  { path: '/app/process-levels', icon: Layers, label: 'Procesos por Niveles' },
  { path: '/app/heat-map', icon: ShieldAlert, label: 'Mapa de Calor' },
  { path: '/app/data-journey', icon: Route, label: 'Data Journey' },
  { path: '/app/reports', icon: FileText, label: 'Reportes' },
  { path: '/app/achievements', icon: Award, label: 'Logros' },
  { path: '/app/org-structure', icon: Building2, label: 'Estructura Organizacional' },
  { path: '/app/catalogs', icon: BookOpen, label: 'Catalogo General' },
  { path: '/app/presentation', icon: Presentation, label: 'Presentacion' },
  //{ path: '/app/api-docs', icon: Code, label: 'API' },
  // Configuracion salio de aqui el 2026-08-08: vive en el menu de perfil, que es
  // donde la busca cualquiera. La ruta /app/settings sigue existiendo.
]

export function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const drawerOpen = useUiStore((s) => s.drawerOpen)
  const setDrawerOpen = useUiStore((s) => s.setDrawerOpen)
  const profile = useAuthStore((s) => s.profile)
  const location = useLocation()
  const onboardingDismissed = useOnboardingStore((s) => s.dismissed)
  const reopenOnboarding = useOnboardingStore((s) => s.reopen)
  /**
   * Con todos los hitos hechos no queda guia que reabrir: la checklist ya solo tiene
   * la tarjeta de felicitacion, sin pasos ni tours. El boton abria eso una y otra vez.
   */
  const onboardingCompleto = useOnboardingStore((s) => s.milestones.every((m) => m.completed))
  const companies = useWorkspaceStore((s) => s.companies)
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId)
  const activeCompanyName = companies.find((c) => c.id === activeCompanyId)?.name ?? 'Mi empresa'

  // En movil la barra es un cajon: siempre ancha, dentro o fuera de la pantalla.
  // En escritorio esta siempre visible y alterna entre panel y rail de iconos.
  // Por eso el contenido mira a las dos: con el cajon abierto hacen falta las
  // etiquetas aunque la preferencia de escritorio sea el rail.
  const expandido = sidebarOpen || drawerOpen

  return (
    <aside
      className={`fixed left-0 top-0 h-full flex flex-col w-64 border-r border-gray-200 transition-all duration-300 z-40 lg:translate-x-0 bg-white ${
        drawerOpen ? 'translate-x-0' : '-translate-x-full'
      } ${sidebarOpen ? 'lg:w-64' : 'lg:w-16'}`}
    >
      {/* Cabecera: solo el isotipo, centrado, en los dos estados. El nombre de marca
          salio de aqui — la barra ya dice de que producto es con el logo, y sin el
          texto el rail y el panel se leen igual, sin un salto de composicion. */}
      <div className="relative flex items-center justify-center p-4 border-b border-gray-200 shrink-0">
        <img
          src="/logo.png"
          alt="Lean Process"
          width={36}
          height={36}
          className="w-9 h-9 shrink-0"
        />
        {/* Cerrar el cajon en movil. En escritorio el mando es el boton del borde. */}
        <button
          onClick={() => setDrawerOpen(false)}
          aria-label="Cerrar menu"
          className="lg:hidden absolute right-2 p-2.5 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/*
        Contraer / expandir: un boton circular montado sobre el borde derecho de la
        barra, no dentro de la cabecera. Puesto ahi cumple dos cosas que dentro no
        podia: se explica solo —esta sobre la linea que va a mover— y deja de competir
        por el sitio del logo, que ahora manda en la cabecera.

        `-right-3` con `w-6` lo deja a caballo del borde, mitad dentro y mitad fuera:
        por eso la barra NO puede recortar por overflow, y por eso el boton se ve igual
        con el panel abierto que con el rail.
      */}
      <button
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Contraer barra lateral' : 'Expandir barra lateral'}
        title={sidebarOpen ? 'Contraer' : 'Expandir'}
        className="hidden lg:flex absolute -right-3 bottom-6 z-50 w-6 h-6 items-center justify-center rounded-full
                   bg-white border border-gray-200 text-gray-500 shadow-lg hover:bg-surface-section
                   hover:text-primary-600 hover:border-primary-300 focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-primary-500 transition-colors"
      >
        {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Workspace switcher */}
      <div className="py-3 border-b border-gray-200 shrink-0">
        {IS_PHASE_1 ? (
          <div className={expandido ? 'px-3' : 'px-2'}>
            <div className={`flex items-center py-2 rounded-lg bg-gray-50 border border-gray-100 ${expandido ? 'gap-2 px-3' : 'justify-center'}`}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center ring-1 ring-primary-500 shrink-0 bg-primary-100">
                <Building2 size={14} className="text-primary-600" />
              </div>
              {expandido && (
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400">Empresa</div>
                  <div className="text-sm font-medium text-gray-800 truncate">{activeCompanyName}</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <WorkspaceSwitcher collapsed={!expandido} />
        )}
      </div>

      {/*
        Navigation — scrollable en vertical: con 10 items + Admin no cabe en una ventana
        baja ni en un movil apaisado, y el bloque de abajo se le montaba encima.

        ⚠️ `overflow-x-hidden` NO es decorativo. CSS no permite un eje `visible` y el otro
        no: al poner `overflow-y-auto`, el navegador convierte `overflow-x` en `auto` por
        su cuenta. Con eso, cualquier cosa mas ancha que la barra —los tooltips del rail,
        que van a proposito en `left-full`, o una etiqueta larga en el cajon— creaba un
        SCROLL LATERAL dentro de la navegacion, arrastrable con el raton.
      */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1 mt-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              // En el rail el titulo nativo sustituye al globo de antes: aquel vivia
              // fuera del ancho de la barra y ahora quedaria recortado.
              title={expandido ? undefined : item.label}
              className={`ck-nav-item ${isActive ? 'is-active' : ''} ${expandido ? '' : 'justify-center'}`}
            >
              <item.icon size={16} className="shrink-0" />
              {expandido && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}

        {profile?.is_admin && (
          <Link
            to="/app/admin"
            title={expandido ? undefined : 'Admin'}
            className={`ck-nav-item ${location.pathname === '/app/admin' ? 'is-active' : ''} ${
              expandido ? '' : 'justify-center'
            }`}
          >
            <Shield size={16} className="shrink-0" />
            {/* Antes miraba `sidebarOpen`: en el cajon movil se quedaba sin etiqueta. */}
            {expandido && <span className="truncate">Admin</span>}
          </Link>
        )}
      </nav>

      {/* Bottom: onboarding reopen + branding. Estatico, no `absolute`: en flujo
          normal no puede montarse sobre la navegacion cuando esta crece. */}
      <div className={`shrink-0 pb-4 pt-2 space-y-2 ${expandido ? 'px-4' : 'px-2'}`}>
        {onboardingDismissed && !onboardingCompleto && (
          <button
            onClick={reopenOnboarding}
            title={expandido ? undefined : 'Guia de inicio'}
            className={`ck-nav-item w-full ${expandido ? '' : 'justify-center'}`}
          >
            <GraduationCap size={16} className="shrink-0" />
            {expandido && <span className="truncate">Guia de inicio</span>}
          </button>
        )}
        <SupportMenu collapsed={!expandido} />
        <a
          href={HUB_URL}
          title={expandido ? undefined : 'Salir'}
          className={`ck-nav-item w-full ${expandido ? '' : 'justify-center'}`}
        >
          <LogOut size={16} className="shrink-0" />
          {expandido && <span className="truncate">Salir</span>}
        </a>
        {expandido && (
          <div className="text-center">
            <p className="text-[10px] text-gray-300 uppercase tracking-widest">Powered by AI</p>
          </div>
        )}
      </div>
    </aside>
  )
}
