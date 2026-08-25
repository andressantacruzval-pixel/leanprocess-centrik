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
  // Si (por datos antiguos) hubiera varias operaciones al mismo proceso, se fusionan
  // sus columnas por nombre para que ninguna quede invisible. El id de enlace y el
  // tratamiento en destino los aporta la primera; las nuevas ya no se duplican
  // (addJourneyLink hace upsert).
  const add = (procId: string, kind: StageKind, o: AssetOperationRow) => {
    const ex = map.get(procId)
    if (!ex || ex.kind === 'origin') { map.set(procId, { procId, name: nameOf(procId), kind, opId: o.id, cols: [...(o.columns ?? [])], dest: o.dest_operation }); return }
    const names = new Set((ex.cols ?? []).map((c) => c.name))
    ex.cols = [...(ex.cols ?? []), ...(o.columns ?? []).filter((c) => !names.has(c.name))]
  }
  for (const o of rel) {
    if (o.target_process_id) add(o.target_process_id, 'target', o)
    if (o.source_process_id) add(o.source_process_id, 'source', o)
  }
  return [...map.values()].sort((a, b) => (a.kind === 'origin' ? -1 : b.kind === 'origin' ? 1 : a.name.localeCompare(b.name)))
}

// Columnas DISPONIBLES en un subproceso para reenviar más adelante. En el proceso
// origen son todas las del activo; en cualquier otro subproceso son SOLO las que
// llegaron allí (la unión de las columnas de las operaciones que lo entregan). Una
// columna que no se envió a un subproceso no puede reenviarse desde él.
export function columnsAvailableAt(asset: InformationAsset, procId: string | null, ops: AssetOperationRow[]): AssetColumn[] {
  if (!procId || procId === (asset.process_id ?? null)) return asset.columns ?? []
  const seen = new Set<string>(); const out: AssetColumn[] = []
  for (const o of ops) {
    if (o.asset_id === asset.id && o.target_process_id === procId) {
      for (const c of o.columns ?? []) if (!seen.has(c.name)) { seen.add(c.name); out.push(c) }
    }
  }
  return out
}

// Tratamiento de una columna en una etapa. undefined = no viaja ahí · null =
// presente sin tratamiento definido · string = el tratamiento declarado.
export function treatmentAt(stage: Stage, col: AssetColumn): string | null | undefined {
  if (stage.kind === 'origin') return col.operation ?? null
  const oc = (stage.cols ?? []).find((c) => c.name === col.name)
  if (!oc) return undefined
  return oc.operation ?? stage.dest ?? 'transfiere'
}
