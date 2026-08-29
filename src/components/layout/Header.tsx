import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import {
  Bell, CheckCheck, AlertTriangle, Trophy, Flame, Info, Zap,
  ChevronDown, Settings, CreditCard, LogOut, Menu as MenuIcon, Sun, Moon,
} from 'lucide-react'
import { useUiStore } from '@/stores/uiStore'
import { SearchTrigger } from '@/features/search/GlobalSearch'
import { liteHubUrl } from '@/features/auth/lite'
import { planName } from '@/lib/plans'
import {
  useNotificationStore,
  generateNotificationsWithContext,
  type Notification,
} from '@/features/notifications/notificationStore'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { isDocumentable } from '@/lib/processLevels'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { useStreakStore } from '@/features/gamification/streakStore'
import { useAchievementStore } from '@/features/gamification/achievementStore'
import { useProcessHealth } from '@/hooks/useProcessHealth'
import { useAchievementProgress } from '@/hooks/useAchievementProgress'

/**
 * Un solo estado para los dos menús: abrir uno cierra el otro sin código extra,
 * y basta un `ref` sobre toda la zona derecha para el clic fuera.
 */
type Menu = 'notificaciones' | 'perfil' | null

export function Header() {
  const profile = useAuthStore((s) => s.profile)
  const signOut = useAuthStore((s) => s.signOut)
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  const [menu, setMenu] = useState<Menu>(null)
  const open = menu === 'notificaciones'
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const drawerOpen = useUiStore((s) => s.drawerOpen)
  const toggleDrawer = useUiStore((s) => s.toggleDrawer)

  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)

  // Data for smart notification generation
  const processes = useProcessStore((s) => s.processes)
  const processLevelCount = useCompanyStore((s) => s.company?.process_level_count ?? 3)
  const indicators = useIndicatorStore((s) => s.indicators)
  const currentStreak = useStreakStore((s) => s.currentStreak)
  const getStreakData = useStreakStore((s) => s.getStreakData)
  const unlockedAchievements = useAchievementStore((s) => s.unlockedAchievements)
  const catalog = useAchievementStore((s) => s.catalog)
  const healthMap = useProcessHealth()
  const progress = useAchievementProgress()

  // Generate smart notifications on mount and when data changes
  useEffect(() => {
    const processIdsWithKpis = new Set(indicators.map((i) => i.process_id))
    // Solo los del nivel más bajo declarado: empujar a documentar un proceso
    // agrupador manda al usuario a una pantalla que ya no le deja hacer nada.
    // Ver @/lib/processLevels.
    const processesWithoutKpis = processes.filter(
      (p) => isDocumentable(p, processLevelCount) && !processIdsWithKpis.has(p.id)
    )
    const streakData = getStreakData()

    // Near achievements (>=90%)
    const unlockedIds = new Set(unlockedAchievements.map((u) => u.achievementId))
    const nearAchievements = catalog
      .filter((a) => {
        if (unlockedIds.has(a.id)) return false
        const p = progress[a.id]
        if (!p || p.target <= 0) return false
        return (p.current / p.target) >= 0.9
      })
      .map((a) => ({
        title: a.title,
        pct: progress[a.id].current / progress[a.id].target,
      }))

    // Low health processes
    const lowHealthCount = Object.values(healthMap).filter((h) => h.score < 33).length

    generateNotificationsWithContext({
      processesWithoutKpis: {
        count: processesWithoutKpis.length,
        firstId: processesWithoutKpis[0]?.id,
      },
      streakData: { todayDone: streakData.todayDone, current: streakData.current },
      nearAchievements,
      lowHealthCount,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processes.length, indicators.length, currentStreak])

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMenu(null)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenu(null)
    }
    if (menu) {
      document.addEventListener('mousedown', handleOutsideClick)
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menu])

  const typeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle size={14} className="text-amber-600" />
      case 'achievement': return <Trophy size={14} className="text-primary-600" />
      case 'streak': return <Flame size={14} className="text-amber-600" />
      default: return <Info size={14} className="text-primary-600" />
    }
  }

  const unreadNotifications = notifications.filter((n) => !n.read)
  const visibleNotifications = unreadNotifications.slice(0, 8)

  // El saldo que se enseña es el TOTAL (plan + comprados). `credits` a secas
  // subestima a quien haya recargado. Ver `docs/Lite/creditos.md`.
  const tokens = profile?.credits_total ?? profile?.credits ?? 0
  const nombre = profile?.full_name || profile?.email || ''
  const inicial = (nombre.trim()[0] ?? '?').toUpperCase()

  return (
    /*
     * ⚠️ `relative z-50` NO es decorativo: sin él los menús salen POR DEBAJO de las
     * tarjetas. `backdrop-blur-xl` crea un contexto de apilamiento, así que el `z-50`
     * de los desplegables solo compite DENTRO de la cabecera; y como la cabecera va
     * antes que el <main> en el DOM y no tenía z-index propio, el contenido de la
     * página se pintaba encima. Mismo tropiezo que la capa de planes del Hub.
     */
    <header className="relative z-50 h-14 bg-white border-b border-gray-100 grid grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-2 lg:gap-4 px-4 lg:px-6">
      {/* En escritorio la izquierda queda libre a propósito: el logo vive en la barra
          lateral. En móvil esa barra sale del flujo, así que su único mando —la
          hamburguesa— tiene que vivir aquí; dentro del propio cajón no se alcanza. */}
      <button
        onClick={toggleDrawer}
        aria-label="Abrir menú"
        aria-expanded={drawerOpen}
        className="lg:hidden p-2.5 -ml-1.5 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-800 transition-colors"
      >
        <MenuIcon size={20} />
      </button>
      <div className="hidden lg:block" />

      {/* Fluido: crece con la ventana hasta 560px y encoge sin romperse. Un ancho
          fijo se veía diminuto en las pantallas anchas, que es donde se usa. */}
      <div className="min-w-0 w-full lg:justify-self-center lg:w-[clamp(180px,34vw,560px)]">
        <SearchTrigger />
      </div>

      {/* Todo lo del usuario a la derecha, igual que en el Hub */}
      <div className="flex items-center gap-1 sm:gap-2 justify-self-end" ref={dropdownRef}>
        {/*
          El chip de tokens, calcado del `CreditChip` del Hub: misma píldora ámbar,
          mismo hover y el mismo aviso debajo. No es capricho — es la misma persona
          mirando el mismo saldo, y que cambie de forma al cambiar de aplicación
          hace dudar de si es el mismo número.

          Abre en pestaña NUEVA, a diferencia del Hub, que abre una capa encima. Desde
          App hay que salir a Lite igualmente, y así el cliente no pierde lo que
          estuviera haciendo.
        */}
        {profile != null && (
          <div className="relative group">
            <a
              href={`${liteHubUrl}?plan=abierto`}
              target="_blank"
              rel="noopener noreferrer"
              title="Conseguir más tokens"
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-amber-50
                         hover:bg-amber-50 border border-amber-200 hover:border-amber-300 transition-colors"
            >
              <Zap size={11} className="text-amber-600 fill-amber-600" />
              <span className="text-xs font-semibold text-amber-600 tabular-nums tracking-[0.2px]">
                {tokens.toLocaleString()}
              </span>
              {/* La palabra sobra en movil: el rayo ambar ya dice que es el saldo. */}
              <span className="hidden sm:inline text-[11px] text-gray-600">tokens</span>
            </a>

            <span
              aria-hidden
              className="pointer-events-none absolute top-[calc(100%+7px)] right-0 z-10 px-2.5 py-1 rounded-lg
                         whitespace-nowrap bg-amber-500 text-white text-[11px] font-bold opacity-0 -translate-y-[3px]
                         group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150
                         motion-reduce:transition-none"
            >
              Conseguir más tokens
            </span>
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenu((m) => (m === 'notificaciones' ? null : 'notificaciones'))}
            aria-haspopup="menu"
            aria-expanded={open}
            className="relative p-2 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
            title="Notificaciones"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            // Anclado a la derecha: un ancho fijo de 320px se sale de una pantalla de
            // 375px, asi que se acota al viewport menos el padding del header.
            <div className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white border border-gray-200 rounded-lg shadow-2xl z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Notificaciones
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      markAllRead()
                      setMenu(null)
                    }}
                    className="flex items-center gap-1 text-[10px] text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    <CheckCheck size={12} />
                    Marcar todo como leido
                  </button>
                )}
              </div>

              {/* Notification list — only unread */}
              <div className="max-h-[300px] overflow-y-auto">
                {visibleNotifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-[11px] text-gray-300">
                    No hay notificaciones pendientes
                  </div>
                ) : (
                  visibleNotifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        markRead(n.id)
                        if (n.actionUrl) {
                          navigate(n.actionUrl)
                          setMenu(null)
                        }
                      }}
                      className="w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                    >
                      <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-gray-800 leading-tight">
                          {n.title}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                          {n.description}
                        </p>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-1" />
                    </button>
                  ))
                )}
              </div>

              {unreadNotifications.length > 8 && (
                <div className="px-4 py-2 border-t border-gray-100 text-center">
                  <span className="text-[10px] text-gray-300">
                    +{unreadNotifications.length - 8} mas
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Menú de perfil */}
        {profile != null && (
          <div className="relative">
            <button
              onClick={() => setMenu((m) => (m === 'perfil' ? null : 'perfil'))}
              aria-haspopup="menu"
              aria-expanded={menu === 'perfil'}
              // El tour de onboarding apunta aquí desde que Configuración salió
              // del sidebar. Un selector propio y no `a[href=…]`: aquello se rompió
              // justo por depender de dónde estaba el enlace.
              data-tour="perfil"
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
              title={nombre}
            >
              <span className="w-7 h-7 rounded-full ring-1 ring-primary-500 flex items-center justify-center text-[11px] font-semibold text-primary-700 bg-primary-500">
                {inicial}
              </span>
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform ${menu === 'perfil' ? 'rotate-180' : ''}`}
              />
            </button>

            {menu === 'perfil' && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-[min(16rem,calc(100vw-2rem))] bg-white border border-gray-200 rounded-lg shadow-2xl z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-[13px] font-medium text-gray-800 truncate">{nombre}</p>
                  {profile.email && profile.full_name && (
                    <p className="text-[11px] text-gray-400 truncate">{profile.email}</p>
                  )}
                  <p className="text-[11px] text-primary-600 mt-1">
                    {planName(profile.plan_level)}
                  </p>
                </div>

                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(null)
                    navigate('/app/settings')
                  }}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 text-[12px] text-gray-700 hover:bg-gray-50 hover:text-gray-800 transition-colors"
                >
                  <Settings size={14} className="text-gray-500" />
                  Configuracion
                </button>

                {/* La facturación vive en el Hub: una sola pantalla para las dos apps */}
                <a
                  role="menuitem"
                  href={`${liteHubUrl}?plan=pagos`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenu(null)}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 text-[12px] text-gray-700 hover:bg-gray-50 hover:text-gray-800 transition-colors"
                >
                  <CreditCard size={14} className="text-gray-500" />
                  Facturacion
                </a>

                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(null)
                    void signOut()
                  }}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-2.5 text-[12px] text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors border-t border-gray-100"
                >
                  <LogOut size={14} className="text-gray-400" />
                  Cerrar sesion
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
