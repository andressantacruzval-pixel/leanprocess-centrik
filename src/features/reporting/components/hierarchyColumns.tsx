import type { Column } from './DataTable'
import type { OrgLabelsLike, HierarchyValues } from '@/lib/reportHierarchy'

// Columnas de jerarquía (organizacional + procesos) en el orden canónico, para
// cualquier tabla que use DataTable. Se anteponen a las columnas propias del
// reporte: `[...hierarchyColumns(org, resolve), ...columnasPropias]`.

const dash = (s?: string | null) => (s && s.trim() ? s : '—')

export function hierarchyColumns<T>(org: OrgLabelsLike, resolve: (row: T) => HierarchyValues): Column<T>[] {
  return [
    { key: 'h_l0', header: org.l0, width: 130, accessor: (r) => resolve(r).management ?? '', cell: (r) => <div className="truncate text-white/70" title={resolve(r).management ?? ''}>{dash(resolve(r).management)}</div> },
    { key: 'h_l1', header: org.l1, width: 130, accessor: (r) => resolve(r).coordination ?? '', cell: (r) => <div className="truncate text-white/70" title={resolve(r).coordination ?? ''}>{dash(resolve(r).coordination)}</div> },
    { key: 'h_l2', header: org.l2, width: 130, hidden: !org.hasL2, accessor: (r) => resolve(r).operative ?? '', cell: (r) => <div className="truncate text-white/70" title={resolve(r).operative ?? ''}>{dash(resolve(r).operative)}</div> },
    { key: 'h_macro', header: 'Macroproceso', width: 150, accessor: (r) => resolve(r).macro, cell: (r) => <div className="truncate text-white/85" title={resolve(r).macro}>{dash(resolve(r).macro)}</div> },
    { key: 'h_proc', header: 'Proceso', width: 150, accessor: (r) => resolve(r).proceso, cell: (r) => <div className="truncate text-cyan-300" title={resolve(r).proceso}>{dash(resolve(r).proceso)}</div> },
    { key: 'h_sub', header: 'Subproceso', width: 160, accessor: (r) => resolve(r).subproceso, cell: (r) => <div className="truncate text-white/85" title={resolve(r).subproceso}>{dash(resolve(r).subproceso)}</div> },
  ]
}
