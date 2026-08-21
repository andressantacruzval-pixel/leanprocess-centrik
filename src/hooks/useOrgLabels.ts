import { useMemo } from 'react'
import { useCompanyStore } from '@/stores/companyStore'

// Etiquetas de los niveles organizacionales SEGÚN los parametrizó el usuario
// (organigrama). Los reportes deben usar estos nombres —no "Gerencia"/"Área"
// fijos— para ser coherentes con la caracterización. Mapeo de campos del
// proceso: management → nivel 0, coordination → nivel 1, operative → nivel 2.
export interface OrgLabels { l0: string; l1: string; l2: string; hasL2: boolean }

export function useOrgLabels(): OrgLabels {
  const defs = useCompanyStore((s) => s.orgLevelDefinitions)
  return useMemo(() => {
    const sorted = [...defs].sort((a, b) => a.level_number - b.level_number)
    return {
      l0: sorted[0]?.level_name ?? 'Gerencia',
      l1: sorted[1]?.level_name ?? 'Jefatura',
      l2: sorted[2]?.level_name ?? 'Área',
      hasL2: sorted.length >= 3,
    }
  }, [defs])
}
