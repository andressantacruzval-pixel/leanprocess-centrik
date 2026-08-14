/**
 * Los avisos tienen tres comportamientos que se rompen sin que nadie lo note, porque
 * dependen de relojes y solo se ven mirando la pantalla en el momento justo.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useToastStore, toast } from './toastStore'

describe('avisos', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })
  afterEach(() => vi.useRealTimers())

  it('el mismo mensaje no apila tarjetas: reinicia el reloj del que ya está', () => {
    // Las siete puertas del tope de plan dicen todas lo mismo. Pulsar tres seguidas
    // levantaba tres tarjetas identicas y tapaba media pantalla.
    toast.warning('Has alcanzado el límite de tu plan')
    toast.warning('Has alcanzado el límite de tu plan')
    toast.warning('Has alcanzado el límite de tu plan')

    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('un mensaje largo dura más que uno corto', () => {
    toast.success('Guardado')
    toast.info('Un mensaje bastante más largo que necesita bastante más tiempo para leerse entero sin prisa')

    const [corto, largo] = useToastStore.getState().toasts
    expect(largo.duration!).toBeGreaterThan(corto.duration!)
  })

  it('con el puntero encima no se cierra; al salir, sigue contando', () => {
    toast.info('Guardado')
    const { id } = useToastStore.getState().toasts[0]

    useToastStore.getState().pauseToast(id)
    vi.advanceTimersByTime(60_000) // una eternidad con el raton encima
    expect(useToastStore.getState().toasts).toHaveLength(1)

    useToastStore.getState().resumeToast(id)
    vi.advanceTimersByTime(60_000)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('sin tocar nada, se cierra solo', () => {
    toast.success('Guardado')
    vi.advanceTimersByTime(60_000)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
