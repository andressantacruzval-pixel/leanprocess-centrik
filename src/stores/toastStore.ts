import { create } from 'zustand'
import { generateId } from '@/utils/id'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  /** Congela la cuenta atrás mientras el puntero está encima. */
  pauseToast: (id: string) => void
  /** La reanuda con el tiempo que le quedaba, no desde el principio. */
  resumeToast: (id: string) => void
}

/**
 * Cuánto dura un aviso, según lo que cuesta leerlo.
 *
 * Antes eran 3 segundos fijos para todo. Sirve para "Guardado" y se queda corto para
 * un mensaje de tres líneas: al usuario le desaparecía a media lectura. Se calcula por
 * palabras y se acota por arriba para que un texto largo no se quede clavado.
 */
function duracionSegunTexto(mensaje: string): number {
  const palabras = mensaje.trim().split(/\s+/).length
  return Math.min(12_000, Math.max(3_000, palabras * 400))
}

/**
 * El reloj de cada aviso. Guarda lo que le queda para poder pausarlo y reanudarlo,
 * en vez de reiniciarlo — reiniciar al salir el ratón alarga el aviso cada vez que
 * uno pasa por encima sin querer.
 */
interface Reloj {
  timeout: ReturnType<typeof setTimeout>
  restante: number
  arrancadoEn: number
}
const relojes = new Map<string, Reloj>()

function programar(id: string, ms: number, cerrar: (id: string) => void) {
  const timeout = setTimeout(() => {
    relojes.delete(id)
    cerrar(id)
  }, ms)
  relojes.set(id, { timeout, restante: ms, arrancadoEn: Date.now() })
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const cerrar = (id: string) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    const duracion = toast.duration ?? duracionSegunTexto(toast.message)

    // Un mensaje repetido NO apila otro aviso: le reinicia el reloj al que ya está.
    // Las puertas del tope de plan son siete y todas dicen lo mismo; sin esto, pulsar
    // tres seguidas levantaba tres tarjetas idénticas y tapaba media pantalla.
    const yaEsta = get().toasts.find((t) => t.type === toast.type && t.message === toast.message)
    if (yaEsta) {
      const reloj = relojes.get(yaEsta.id)
      if (reloj) clearTimeout(reloj.timeout)
      programar(yaEsta.id, duracion, cerrar)
      return
    }

    const id = generateId()
    set((s) => ({ toasts: [...s.toasts, { ...toast, id, duration: duracion }] }))
    programar(id, duracion, cerrar)
  },

  removeToast: (id) => {
    const reloj = relojes.get(id)
    if (reloj) { clearTimeout(reloj.timeout); relojes.delete(id) }
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  pauseToast: (id) => {
    const reloj = relojes.get(id)
    if (!reloj) return
    clearTimeout(reloj.timeout)
    const consumido = Date.now() - reloj.arrancadoEn
    // Mínimo 1 s al soltar: si se pausa justo antes de expirar, desaparecería en
    // cuanto el ratón salga y parecería que el aviso huye del puntero.
    relojes.set(id, { ...reloj, restante: Math.max(1_000, reloj.restante - consumido) })
  },

  resumeToast: (id) => {
    const reloj = relojes.get(id)
    if (!reloj) return
    const cerrar = (tid: string) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== tid) }))
    programar(id, reloj.restante, cerrar)
  },
}))

export const toast = {
  success: (message: string) => useToastStore.getState().addToast({ type: 'success', message }),
  error: (message: string) => useToastStore.getState().addToast({ type: 'error', message }),
  info: (message: string) => useToastStore.getState().addToast({ type: 'info', message }),
  warning: (message: string) => useToastStore.getState().addToast({ type: 'warning', message }),
}
