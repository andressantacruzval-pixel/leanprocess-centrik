// Orden canónico de columnas de jerarquía para TODOS los reportes y exportables:
// primero la estructura organizacional (según cuántos niveles tenga la empresa),
// luego la estructura de procesos (macroproceso · proceso · subproceso), y
// después el resto de la información. Este módulo es la única fuente de ese orden.

import type { Process, Macroprocess } from '@/types/process'

export interface OrgLabelsLike {
  l0: string
  l1: string
  l2: string
  hasL2: boolean
}

export interface ProcessHierarchy {
  macro: string
  proceso: string
  subproceso: string
}

/**
 * Resuelve macroproceso · proceso · subproceso para un proceso dado. Si el
 * proceso tiene padre, él es el "subproceso" y el padre es el "proceso"; si no,
 * él es el "proceso" y no hay subproceso.
 */
export function resolveProcessHierarchy(
  p: Process | undefined,
  macroMap: Map<string, Macroprocess>,
  processMap: Map<string, Process>,
): ProcessHierarchy {
  if (!p) return { macro: '', proceso: '', subproceso: '' }
  const parent = p.parent_process_id ? processMap.get(p.parent_process_id) : null
  return {
    macro: macroMap.get(p.macroprocess_id)?.name ?? '',
    proceso: parent ? parent.name : p.name,
    subproceso: parent ? p.name : '',
  }
}

/** Encabezados en orden objetivo para exportables (Excel/PDF/etc.). */
export function hierarchyHeaders(org: OrgLabelsLike): string[] {
  return [org.l0, org.l1, ...(org.hasL2 ? [org.l2] : []), 'Macroproceso', 'Proceso', 'Subproceso']
}

export interface HierarchyValues extends ProcessHierarchy {
  management?: string | null
  coordination?: string | null
  operative?: string | null
}

/** Celdas en el mismo orden que `hierarchyHeaders`. */
export function hierarchyCells(v: HierarchyValues, org: OrgLabelsLike): string[] {
  return [
    v.management ?? '',
    v.coordination ?? '',
    ...(org.hasL2 ? [v.operative ?? ''] : []),
    v.macro ?? '',
    v.proceso ?? '',
    v.subproceso ?? '',
  ]
}
