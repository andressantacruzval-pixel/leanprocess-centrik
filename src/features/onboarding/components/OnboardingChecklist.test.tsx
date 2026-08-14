import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { OnboardingChecklist } from './OnboardingChecklist'
import { useOnboardingStore } from '@/features/onboarding/onboardingStore'

/**
 * El fallo que cubre esta prueba no era de logica: era un comentario que prometia
 * «auto-dismiss after first view» sin codigo detras. La felicitacion se quedaba
 * clavada en el dashboard, reaparecia en cada recarga, y el boton «Guia de inicio»
 * la reabria — un bucle que reporto el cliente.
 *
 * Un temporizador no se ve leyendo el componente, asi que se fija aqui.
 */
const marcarTodos = (completado: boolean) =>
  useOnboardingStore.setState((s) => ({
    dismissed: false,
    milestones: s.milestones.map((m) => ({ ...m, completed: completado })),
  }))

describe('OnboardingChecklist — la felicitacion se retira sola', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('con todo completado se muestra y se descarta sola', () => {
    marcarTodos(true)
    render(<OnboardingChecklist />)

    expect(screen.getByText('Lean Process Master')).toBeTruthy()
    expect(useOnboardingStore.getState().dismissed).toBe(false)

    act(() => { vi.advanceTimersByTime(8000) })

    // `dismissed` persiste, asi que no vuelve en la siguiente recarga.
    expect(useOnboardingStore.getState().dismissed).toBe(true)
  })

  it('sin terminar NO se descarta: ahi la checklist todavia sirve', () => {
    marcarTodos(false)
    render(<OnboardingChecklist />)

    act(() => { vi.advanceTimersByTime(30000) })

    expect(useOnboardingStore.getState().dismissed).toBe(false)
  })
})
