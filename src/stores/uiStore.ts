import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * El muro de plan que ve el cliente al topar. Vive aqui y no en un store propio
 * porque son tres campos: `avisarSiSinCupo()` es una funcion suelta, sin acceso a
 * React, y necesita algun sitio desde donde encender el modal.
 */
interface MuroDePlan {
  abierto: boolean
  nivel: number
  cupo: number | null
  /**
   * Contra qué tope se chocó. La oferta es la misma —el escalón siguiente— pero la
   * frase de contexto no: son DOS cuotas distintas sobre el mismo número, y decirle
   * «has documentado 20 de 20» a quien intentaba CREAR el 21 le manda a buscar un
   * problema que no tiene.
   */
  motivo: 'documentar' | 'crear'
}

interface UiState {
  /** Escritorio (≥lg): barra expandida (w-64) o rail de iconos (w-16). */
  sidebarOpen: boolean
  /**
   * Movil (<lg): el cajon deslizante. Es un estado DISTINTO de `sidebarOpen`, no el
   * mismo booleano con dos lecturas: el cajon arranca cerrado y se cierra al navegar,
   * mientras que la preferencia de escritorio tiene que sobrevivir a la navegacion.
   * Compartirlos obligaba a colapsar la barra en cada ruta para que el cajon no
   * apareciera abierto al entrar.
   */
  drawerOpen: boolean
  muro: MuroDePlan
  toggleSidebar: () => void
  setSidebarOpen: (value: boolean) => void
  toggleDrawer: () => void
  setDrawerOpen: (value: boolean) => void
  abrirMuroDePlan: (nivel: number, cupo: number | null, motivo?: 'documentar' | 'crear') => void
  cerrarMuroDePlan: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      drawerOpen: false,
      muro: { abierto: false, nivel: 0, cupo: null, motivo: 'documentar' },
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (value) => set({ sidebarOpen: value }),
      toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
      setDrawerOpen: (value) => set({ drawerOpen: value }),
      abrirMuroDePlan: (nivel, cupo, motivo = 'documentar') =>
        set({ muro: { abierto: true, nivel, cupo, motivo } }),
      cerrarMuroDePlan: () => set((s) => ({ muro: { ...s.muro, abierto: false } })),
    }),
    {
      name: 'lean-process-ui',
      version: 2,
      /**
       * Se guarda SOLO `sidebarOpen`, y los otros dos campos quedan fuera a proposito:
       *
       * - `drawerOpen` guardado abriria el cajon movil solo al cargar la pagina, tapando
       *   la pantalla con un menu que el cliente no ha pedido.
       * - `muro` guardado reabriria el modal de pago en cada visita. Es lo que ve quien
       *   ha topado el cupo: perseguirle con el al entrar es lo contrario de vender.
       *
       * `darkMode` tampoco: hoy no lo lee nadie y persistir un ajuste muerto solo crea
       * una clave de localStorage que confunde el dia que se implemente de verdad.
       */
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen }),
      /**
       * v2: se retira `theme`. La interfaz tiene un solo aspecto —el de la familia
       * Centrik— asi que el conmutador claro/oscuro dejo de existir. Sin esto, quien
       * ya tuviera 'dark' guardado arrastraria para siempre una clave que nadie lee.
       */
      migrate: (state, version) => {
        const previo = (state ?? {}) as Record<string, unknown>
        if (version < 2) delete previo.theme
        return { sidebarOpen: previo.sidebarOpen !== false }
      },
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
    }
  )
)
