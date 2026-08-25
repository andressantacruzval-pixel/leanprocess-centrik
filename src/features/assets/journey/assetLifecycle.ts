import type { InformationAsset, AssetColumn } from '@/types/asset'
import type { Process } from '@/types/process'
import type { AssetOperationRow } from '@/services/assets.service'

// Una etapa del recorrido de un activo: el subproceso origen (donde vive) y cada
// subproceso al que se transfiere / del que proviene. El tratamiento de cada
// columna es POR ETAPA (por subproceso), no del activo global.
export type StageKind = 'origin' | 'target' | 'source'
export interface Stage {
  procId: string
  name: string
  kind: StageKind
  opId?: string // enlace de transferencia (etapas target/source)
  cols?: AssetColumn[] // columnas que llegan a esa etapa
  dest?: string // tratamiento en destino declarado a nivel de enlace (compat.)
}

export const KIND_LABEL: Record<StageKind, string> = { origin: 'Origen', target: 'Recibe', source: 'Viene de' }

// Construye las etapas del recorrido: origen primero, luego el resto por nombre.
export function buildStages(asset: InformationAsset, ops: AssetOperationRow[], processes: Process[]): Stage[] {
  const nameOf = (id?: string | null) => processes.find((p) => p.id === id)?.name ?? 'Sin proceso'
  const rel = ops.filter((o) => o.asset_id === asset.id && (o.target_process_id || o.source_process_id))
  const map = new Map<string, Stage>()
  const home = asset.process_id ?? '__home'
  map.set(home, { procId: home, name: nameOf(asset.process_id), kind: 'origin' })
  for (const o of rel) {
    if (o.target_process_id && !map.has(o.target_process_id))
      map.set(o.target_process_id, { procId: o.target_process_id, name: nameOf(o.target_process_id), kind: 'target', opId: o.id, cols: o.columns ?? [], dest: o.dest_operation })
    if (o.source_process_id && !map.has(o.source_process_id))
      map.set(o.source_process_id, { procId: o.source_process_id, name: nameOf(o.source_process_id), kind: 'source', opId: o.id, cols: o.columns ?? [], dest: o.dest_operation })
  }
  return [...map.values()].sort((a, b) => (a.kind === 'origin' ? -1 : b.kind === 'origin' ? 1 : a.name.localeCompare(b.name)))
}

// Tratamiento de una columna en una etapa. undefined = no viaja ahí · null =
// presente sin tratamiento definido · string = el tratamiento declarado.
export function treatmentAt(stage: Stage, col: AssetColumn): string | null | undefined {
  if (stage.kind === 'origin') return col.operation ?? null
  const oc = (stage.cols ?? []).find((c) => c.name === col.name)
  if (!oc) return undefined
  return oc.operation ?? stage.dest ?? 'transfiere'
}
