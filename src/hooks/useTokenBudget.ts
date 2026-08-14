import { useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'

interface TokenBudgetOptions {
  operationKey: string
  onInsufficientTokens?: () => void
}

export interface TokenBudgetResult {
  cost: number
  canAfford: boolean
  isConsuming: boolean
  run: <T>(fn: () => Promise<T>) => Promise<T | null>
  showInsufficientModal: boolean
  closeInsufficientModal: () => void
}

/**
 * Los créditos se descuentan en el Edge Function ai-proxy vía consume_credits().
 * Este hook ya no bloquea en cliente — simplemente ejecuta fn() y captura el
 * error 402 (INSUFFICIENT_CREDITS) que devuelve el proxy si no hay saldo.
 */
export function useTokenBudget({ onInsufficientTokens }: TokenBudgetOptions): TokenBudgetResult {
  const [isConsuming, setIsConsuming] = useState(false)
  const [showInsufficientModal, setShowInsufficientModal] = useState(false)
  const refreshCredits = useAuthStore((s) => s.refreshCredits)

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    if (isConsuming) return null
    setIsConsuming(true)
    try {
      return await fn()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('INSUFFICIENT_CREDITS') || msg.includes('Créditos insuficientes')) {
        setShowInsufficientModal(true)
        onInsufficientTokens?.()
        return null
      }
      throw err
    } finally {
      setIsConsuming(false)
      void refreshCredits()
    }
  }, [isConsuming, onInsufficientTokens, refreshCredits])

  return {
    cost: 0,
    canAfford: true,
    isConsuming,
    run,
    showInsufficientModal,
    closeInsufficientModal: () => setShowInsufficientModal(false),
  }
}
