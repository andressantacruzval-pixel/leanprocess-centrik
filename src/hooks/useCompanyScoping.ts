/**
 * useCompanyScoping
 * -----------------
 * Hooks que devuelven la data de los stores existentes
 * (processStore, indicatorStore, catalogStore) FILTRADA por la empresa
 * activa. Esto permite que los componentes existentes migren a
 * multi-empresa gradualmente sin romper nada.
 *
 * Patron: todos los items (procesos, indicadores, SIPOC, ...) aceptan
 * un `company_id` opcional. Los items sin company_id se consideran
 * "legacy" y pertenecen a la empresa activa (pre-migracion).
 */

import { useMemo } from 'react'
import { useProcessStore } from '@/stores/processStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { useCatalogStore } from '@/stores/catalogStore'
import { useActiveCompany } from './useActiveCompany'

function matchesCompany(itemCompanyId: string | undefined | null, activeId: string | null) {
  if (!activeId) return true
  if (!itemCompanyId) return true // legacy: pertenece a la activa
  return itemCompanyId === activeId
}

export function useScopedProcesses() {
  const { activeCompanyId } = useActiveCompany()
  const macroprocesses = useProcessStore((s) => s.macroprocesses)
  const processes = useProcessStore((s) => s.processes)

  return useMemo(
    () => ({
      macroprocesses: macroprocesses.filter((m) =>
        matchesCompany((m as { company_id?: string }).company_id, activeCompanyId)
      ),
      processes: processes.filter((p) =>
        matchesCompany((p as { company_id?: string }).company_id, activeCompanyId)
      ),
    }),
    [macroprocesses, processes, activeCompanyId]
  )
}

export function useScopedIndicators(processId?: string) {
  const { activeCompanyId } = useActiveCompany()
  const indicators = useIndicatorStore((s) => s.indicators)

  return useMemo(() => {
    return indicators.filter((i) => {
      if (processId && i.process_id !== processId) return false
      return matchesCompany((i as { company_id?: string }).company_id, activeCompanyId)
    })
  }, [indicators, processId, activeCompanyId])
}

export function useScopedSipoc(processId?: string) {
  const { activeCompanyId } = useActiveCompany()
  const sipocEntries = useCatalogStore((s) => s.sipocEntries)

  return useMemo(() => {
    return sipocEntries.filter((e) => {
      if (processId && e.process_id !== processId) return false
      return matchesCompany((e as { company_id?: string }).company_id, activeCompanyId)
    })
  }, [sipocEntries, processId, activeCompanyId])
}
