import { describe, it, expect, beforeEach } from 'vitest'
import { useUiStore } from './uiStore'

const CLAVE = 'lean-process-ui'

/**
 * Lo que importa aqui no es que `sidebarOpen` se guarde —eso se ve a simple vista—
 * sino que los otros dos campos NO se guarden. Son dos fallos que no darian error de
 * compilacion ni de tipos, y que solo se notan usando la aplicacion:
 *
 *   `drawerOpen` guardado  → el cajon movil aparece abierto al cargar
 *   `muro` guardado        → el modal de pago reaparece en cada visita
 *
 * Ampliar el `partialize` es justo el cambio que alguien hara sin pensarlo.
 */
describe('uiStore — que se guarda entre sesiones', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState({
      sidebarOpen: true,
      drawerOpen: false,
      muro: { abierto: false, nivel: 0, cupo: null, motivo: 'documentar' },
    })
  })

  const guardado = () => JSON.parse(localStorage.getItem(CLAVE) ?? '{}').state ?? {}

  it('guarda la preferencia de barra lateral', () => {
    useUiStore.getState().toggleSidebar()
    expect(useUiStore.getState().sidebarOpen).toBe(false)
    expect(guardado().sidebarOpen).toBe(false)

    useUiStore.getState().toggleSidebar()
    expect(guardado().sidebarOpen).toBe(true)
  })

  it('NO guarda el cajon movil: se abriria solo al cargar la pagina', () => {
    useUiStore.getState().setDrawerOpen(true)
    expect(useUiStore.getState().drawerOpen).toBe(true)
    expect(guardado()).not.toHaveProperty('drawerOpen')
  })

  it('NO guarda el muro de plan: reabriria el modal de pago en cada visita', () => {
    useUiStore.getState().abrirMuroDePlan(1, 20, 'crear')
    expect(useUiStore.getState().muro.abierto).toBe(true)
    expect(guardado()).not.toHaveProperty('muro')
  })
})
