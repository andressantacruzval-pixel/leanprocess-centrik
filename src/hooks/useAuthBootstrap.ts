import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useBillingStore } from '@/stores/billingStore'

export interface AuthBootstrapState {
  /**
   * `false` mientras se intenta cargar empresas y billing del usuario autenticado.
   * Pasa a `true` tras éxito O fallo — nunca bloquea el UI indefinidamente.
   */
  ready: boolean
  /** Error de la primera promesa rechazada, si la hubo. Útil para mostrar toast de reintento. */
  error: Error | null
}

/**
 * Carga global por-usuario ejecutada al montar ProtectedRoute / ProtectedOnboarding.
 *
 * Responsabilidades:
 *  - Leer la lista de empresas del usuario desde Supabase (`loadCompaniesFromDB`).
 *  - Cargar el contexto de billing (wallet, packages, costos, addon prices).
 *
 * Lo que NO hace:
 *  - NO carga data per-empresa (procesos, riesgos, KPIs, etc.) — esa responsabilidad
 *    vive en `useWorkspaceSync` dentro de `MainLayout`.
 *  - NO respeta el rehidratado de localStorage — siempre consulta DB como fuente de verdad.
 *
 * Contexto del bug que resuelve:
 *  Antes, `loadCompaniesFromDB` vivía dentro de `useWorkspaceSync`, montado en
 *  `MainLayout`. Si `ProtectedRoute` decidía redirigir a `/onboarding` antes de que
 *  `MainLayout` montara, el hook nunca corría → las empresas del usuario nunca se
 *  cargaban → el usuario veía onboarding aunque ya tuviera empresa completada.
 *  Este hook rompe ese deadlock ejecutando la carga antes del gate de onboarding.
 */
export function useAuthBootstrap(): AuthBootstrapState {
  const user = useAuthStore((s) => s.user)
  const authLoading = useAuthStore((s) => s.loading)
  const loadCompanies = useWorkspaceStore((s) => s.loadCompaniesFromDB)
  const loadWallet = useBillingStore((s) => s.loadWallet)
  const loadPackages = useBillingStore((s) => s.loadPackages)
  const loadOperationCosts = useBillingStore((s) => s.loadOperationCosts)
  const loadAddonPrices = useBillingStore((s) => s.loadAddonPrices)

  const [ready, setReady] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const doneForUser = useRef<string | null>(null)

  // setState en effect es intencional: este hook es el bootstrap de auth y
  // sincroniza estado de React con la sesión de Supabase (sistema externo).
  // Múltiples ramas pueden marcar ready/error al término de cada flujo de carga.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      // Sin sesión: no hay nada que cargar, el gate puede continuar.
      doneForUser.current = null
      setReady(true)
      setError(null)
      return
    }
    if (doneForUser.current === user.id) return

    doneForUser.current = user.id
    setReady(false)
    setError(null)

    Promise.allSettled([
      loadCompanies(user.id),
      loadWallet(user.id),
      loadPackages(),
      loadOperationCosts(),
      loadAddonPrices(),
    ])
      .then((results) => {
        const firstReject = results.find((r) => r.status === 'rejected')
        if (firstReject && firstReject.status === 'rejected') {
          const reason = firstReject.reason
          const err = reason instanceof Error ? reason : new Error(String(reason))
          setError(err)
          // Errores de red transitorios (cambio de red, pérdida de conexión):
          // resetear el ref para que el próximo render reintente la carga.
          const msg = err.message.toLowerCase()
          if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network changed')) {
            doneForUser.current = null
          }
        }
      })
      .finally(() => setReady(true))
  }, [user, authLoading, loadCompanies, loadWallet, loadPackages, loadOperationCosts, loadAddonPrices])
  /* eslint-enable react-hooks/set-state-in-effect */

  return { ready, error }
}
