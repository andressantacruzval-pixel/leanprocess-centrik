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

// Nombres de las unidades organizacionales por nivel de profundidad, tomados de
// la estructura VIVA del organigrama (no de los valores usados en procesos). Así
// TODAS las gerencias/jefaturas/áreas aparecen en los filtros aunque todavía no
// tengan procesos asociados. Mapeo por profundidad en el árbol: 0 = management,
// 1 = coordination, 2 = operative (coherente con CharacterizationPanel).
export interface OrgUnitNames { managements: string[]; areas: string[]; operatives: string[] }

const uniqSort = (arr: (string | null | undefined)[]): string[] =>
  [...new Set(arr.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'es'))

export function useOrgUnitNamesByLevel(): OrgUnitNames {
  const units = useCompanyStore((s) => s.orgUnits)
  return useMemo(() => {
    const mgmtIds = new Set(units.filter((u) => !u.parent_id).map((u) => u.id))
    const areaUnits = units.filter((u) => u.parent_id && mgmtIds.has(u.parent_id))
    const areaIds = new Set(areaUnits.map((u) => u.id))
    const opUnits = units.filter((u) => u.parent_id && areaIds.has(u.parent_id))
    return {
      managements: uniqSort(units.filter((u) => !u.parent_id).map((u) => u.name)),
      areas: uniqSort(areaUnits.map((u) => u.name)),
      operatives: uniqSort(opUnits.map((u) => u.name)),
    }
  }, [units])
}
