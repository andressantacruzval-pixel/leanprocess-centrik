/**
 * useActiveCompany
 * ----------------
 * Hooks de conveniencia alrededor de workspaceStore para que los
 * componentes no tengan que conocer los detalles del store.
 *
 * - `useActiveCompany()`: la empresa activa + helpers de billing.
 * - `useCompanyList()`: lista memo-izada de empresas del usuario.
 * - `useBillingSummary()`: desglose mensual (para settings/facturacion).
 */

import { useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useMembershipStore } from '@/stores/membershipStore'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useCatalogStore } from '@/stores/catalogStore'
import { useProcessHealth } from '@/hooks/useProcessHealth'
import { isDocumentable } from '@/lib/processLevels'
import { planCap, clampLevel, hasNextLevel } from '@/lib/plans'

export function useActiveCompany() {
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId)
  const { companies } = useCompanyList()
  const canCreateCompanyGate = useWorkspaceStore((s) => s.canCreateCompanyGate)

  const active = useMemo(
    () => companies.find((c) => c.id === activeCompanyId) ?? null,
    [companies, activeCompanyId]
  )

  return {
    activeCompanyId,
    activeCompany: active,
    hasCompany: !!active,
    companyCount: companies.length,
    createGate: canCreateCompanyGate(),
  }
}

export function useCompanyList() {
  const allCompanies = useWorkspaceStore((s) => s.companies)
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId)
  const profile = useAuthStore((s) => s.profile)

  // Admin sees all companies; regular users see only their own
  const companies = useMemo(() => {
    if (profile?.is_admin) return allCompanies
    if (!profile?.id) return []
    return allCompanies.filter((c) => c.user_id === profile.id)
  }, [allCompanies, profile])

  return { companies, activeCompanyId }
}

export function useBillingSummary() {
  const subscription = useWorkspaceStore((s) => s.subscription)
  const addOns = useWorkspaceStore((s) => s.addOns)
  const getMonthlyTotal = useWorkspaceStore((s) => s.getMonthlyTotal)

  return useMemo(
    () => ({
      subscription,
      addOns,
      breakdown: getMonthlyTotal(),
    }),
    [subscription, addOns, getMonthlyTotal]
  )
}

/**
 * Bootstrap: cuando un usuario loggea y aun no tiene suscripcion, le
 * arranca automaticamente un trial. Se usa una sola vez en App.tsx.
 */
export function useEnsureTrialBootstrap() {
  const user = useAuthStore((s) => s.user)
  const startTrialIfNeeded = useWorkspaceStore((s) => s.startTrialIfNeeded)
  const subscription = useWorkspaceStore((s) => s.subscription)

  if (user && !subscription) {
    startTrialIfNeeded(user.id)
  }
}

/**
 * Cuotas del plan de la empresa activa.
 *
 * Un plan es UN número (`planCap`) y gobierna dos cosas distintas:
 *   - `processes`:  cuántos se pueden CREAR en el nivel más bajo declarado
 *   - `documented`: cuántos se pueden DOCUMENTAR
 *
 * La unidad es el subproceso: documentarlo lo desbloquea entero, así que un
 * proceso con siete artefactos cuenta UNO. Ver `@/lib/plans`.
 *
 * Solo cuenta: el bloqueo real vive en la base de datos (mig. `20260731000009`).
 * Aquí se refleja para poder avisar antes de que el usuario choque.
 */
export function usePlanLimits() {
  const profile = useAuthStore((s) => s.profile)
  const processes = useProcessStore((s) => s.processes)
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId)
  const processLevelCount = useCompanyStore((s) => s.company?.process_level_count ?? 3)
  const sipocEntries = useCatalogStore((s) => s.sipocEntries)
  const healthMap = useProcessHealth()

  // plan_type viene de profiles.plan_type (Lite). workspaceStore.subscription.plan_id
  // siempre vale 'plan_base_monthly' (trial hardcodeado) — no sirve para detectar el plan real.
  const isCommunity = profile?.plan_type === 'community'
  const level = clampLevel(profile?.plan_level)
  const cap = isCommunity ? planCap(level) : null

  const { processCount, documentedCount, documentedIds } = useMemo(() => {
    const propios = processes.filter(
      (p) => p.company_id === activeCompanyId && isDocumentable(p, processLevelCount)
    )
    // `useProcessHealth` ya evalúa 6 de los 7 artefactos; SIPOC es el que no mira.
    const conSipoc = new Set(sipocEntries.map((e) => e.process_id))
    const documentados = propios.filter(
      (p) => Object.values(healthMap[p.id]?.checks ?? {}).some(Boolean) || conSipoc.has(p.id)
    )
    return {
      processCount: propios.length,
      documentedCount: documentados.length,
      documentedIds: new Set(documentados.map((p) => p.id)),
    }
  }, [processes, activeCompanyId, processLevelCount, healthMap, sipocEntries])

  const documentadosLleno = cap !== null && documentedCount >= cap

  return {
    level,
    cap,
    isCommunity,
    hasNextLevel: hasNextLevel(level),
    processes: { count: processCount, reached: cap !== null && processCount >= cap },
    documented: { count: documentedCount, reached: documentadosLleno },
    /**
     * Si a ESTE proceso se le puede añadir documentación.
     *
     * Un proceso que ya cuenta dentro del cupo se puede **terminar** sin volver a
     * pagar: la cuota solo frena empezar uno nuevo. Es la misma regla que aplica el
     * trigger `enforce_documentable_level` en la base — aquí solo se refleja para
     * poder bloquear el botón antes de que el usuario choque.
     */
    puedeDocumentar: (processId: string) => documentedIds.has(processId) || !documentadosLleno,
  }
}

/**
 * Helper para contar miembros activos de la empresa activa (incluye
 * owner). Util para "usados/incluidos" en UI.
 */
export function useActiveCompanyMembers() {
  const { activeCompanyId } = useActiveCompany()
  const memberships = useMembershipStore((s) => s.memberships)

  return useMemo(() => {
    if (!activeCompanyId) return []
    return memberships.filter(
      (m) => m.company_id === activeCompanyId && m.status !== 'revoked'
    )
  }, [activeCompanyId, memberships])
}
