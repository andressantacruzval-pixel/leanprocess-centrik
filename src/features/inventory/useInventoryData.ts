import { useMemo } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useInventoryStore } from '@/stores/inventoryStore'
import { CAT_TO_TIPO, type InvArea, type InvMacro } from './types'

const CAT_ORDER: Record<string, number> = { productivo: 0, apoyo: 1, estrategico: 2 }

/**
 * Traduce los datos vivos de la app (mapa Nivel 0 = macroprocesos, y áreas =
 * estructura organizacional) al modelo del inventario. NO crea áreas: las lee de
 * Estructura Organizacional. Devuelve también el documento del inventario ya
 * fusionado con el mapa actual.
 */
export function useInventoryData() {
  const companyId = useWorkspaceStore((s) => s.activeCompanyId) ?? ''
  const macroprocesses = useProcessStore((s) => s.macroprocesses)
  const orgUnits = useCompanyStore((s) => s.orgUnits)
  const company = useCompanyStore((s) => s.company)
  const doc = useInventoryStore((s) => s.byCompany[companyId])

  const appMacros = useMemo<InvMacro[]>(() => {
    return macroprocesses
      .filter((m) => m.company_id === companyId)
      .slice()
      .sort((a, b) => (CAT_ORDER[a.category] - CAT_ORDER[b.category]) || a.sort_order - b.sort_order)
      .map((m) => ({ nombre: m.name, tipo: CAT_TO_TIPO[m.category], procesos: [] }))
  }, [macroprocesses, companyId])

  const appAreas = useMemo<InvArea[]>(() => {
    const byId = new Map(orgUnits.map((u) => [u.id, u]))
    return orgUnits
      .filter((u) => u.company_id === companyId)
      .map((u) => ({ nombre: u.name, padre: u.parent_id ? (byId.get(u.parent_id)?.name ?? '') : '' }))
  }, [orgUnits, companyId])

  return { companyId, company, appMacros, appAreas, doc }
}
