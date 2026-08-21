import { useMemo, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { FILAS_POR_TANDA, useVerMas } from './reportPaging'
import { TableWrap } from './reportUi'

// Tabla de reportes con control POR COLUMNA: ordenar A→Z / Z→A y filtrar por
// "contiene" (texto libre) o "exactamente igual" (valor de la lista). Centraliza
// la lógica para que cada reporte solo declare sus columnas (accessor + celda) y
// se mantenga bajo el tope de 300 líneas. El menú usa position:fixed para no
// quedar recortado por el overflow-x del contenedor de la tabla.

type FilterMode = 'contains' | 'equals'

export interface Column<T> {
  key: string
  header: string
  accessor: (row: T) => string | number   // valor plano para ordenar/filtrar
  cell?: (row: T) => React.ReactNode        // render de la celda (default: accessor)
  className?: string                         // clases extra del <td>
  sortable?: boolean                         // default true
  filterable?: boolean                       // default true
  hidden?: boolean                           // columnas condicionales (p.ej. nivel 2)
}

interface ColFilter { mode: FilterMode; value: string }

const asStr = (v: string | number): string => (typeof v === 'number' ? String(v) : v)

export function DataTable<T>({ columns, rows, rowKey, minWidth }: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T, i: number) => string
  minWidth: number
}) {
  const cols = useMemo(() => columns.filter((c) => !c.hidden), [columns])
  const colByKey = useMemo(() => new Map(cols.map((c) => [c.key, c])), [cols])
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const [filters, setFilters] = useState<Record<string, ColFilter>>({})
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  // Valores distintos por columna, para el modo "exactamente igual".
  const distinct = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const c of cols) {
      if (c.filterable === false) continue
      const set = new Set<string>()
      for (const r of rows) { const s = asStr(c.accessor(r)).trim(); if (s) set.add(s) }
      m[c.key] = [...set].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
    }
    return m
  }, [cols, rows])

  const processed = useMemo(() => {
    let out = rows
    const active = Object.entries(filters).filter(([, f]) => f.value)
    if (active.length) {
      out = out.filter((r) => active.every(([key, f]) => {
        const col = colByKey.get(key); if (!col) return true
        const s = asStr(col.accessor(r))
        return f.mode === 'equals' ? s === f.value : s.toLowerCase().includes(f.value.toLowerCase())
      }))
    }
    if (sort) {
      const col = colByKey.get(sort.key)
      if (col) {
        const dir = sort.dir === 'asc' ? 1 : -1
        out = [...out].sort((a, b) => {
          const va = col.accessor(a), vb = col.accessor(b)
          if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
          return asStr(va).localeCompare(asStr(vb), 'es', { numeric: true }) * dir
        })
      }
    }
    return out
  }, [rows, filters, sort, colByKey])

  const { visibles, ocultas, verMas } = useVerMas(processed)

  const openMenu = (e: React.MouseEvent, key: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const left = Math.min(rect.left, window.innerWidth - 238)
    setMenuPos({ top: rect.bottom + 4, left: Math.max(8, left) })
    setOpenKey(openKey === key ? null : key)
  }
  const setFilter = (key: string, patch: Partial<ColFilter>) =>
    setFilters((prev) => ({ ...prev, [key]: { mode: prev[key]?.mode ?? 'contains', value: prev[key]?.value ?? '', ...patch } }))
  const clearCol = (key: string) => {
    setFilters((prev) => { const n = { ...prev }; delete n[key]; return n })
    setSort((s) => (s?.key === key ? null : s))
  }

  const openCol = openKey ? colByKey.get(openKey) : null
  const openF = openKey ? filters[openKey] : undefined
  const isActive = (key: string) => !!filters[key]?.value || sort?.key === key
  const btnCls = (on: boolean) => `flex-1 text-[10px] py-1 rounded-md border transition-colors ${on ? 'border-cyan-400/50 text-cyan-300 bg-cyan-500/10' : 'border-white/10 text-white/50 hover:text-white/80'}`

  return (
    <>
      <TableWrap minWidth={minWidth}>
        <thead>
          <tr className="bg-white/[0.03] border-b border-white/5">
            {cols.map((c) => (
              <th key={c.key} className="px-3 py-2.5 text-[9px] font-semibold text-white/35 uppercase tracking-wider whitespace-nowrap sticky top-0 bg-[#0d1117] z-10">
                {c.sortable === false && c.filterable === false ? (
                  <span>{c.header}</span>
                ) : (
                  <button onClick={(e) => openMenu(e, c.key)} className={`inline-flex items-center gap-1 hover:text-white/70 transition-colors ${isActive(c.key) ? 'text-cyan-300' : ''}`}>
                    {c.header}
                    {sort?.key === c.key
                      ? <span className="text-cyan-300 text-[8px]">{sort.dir === 'asc' ? '▲' : '▼'}</span>
                      : <ChevronDown size={11} className="opacity-50" />}
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibles.map((r, i) => (
            <tr key={rowKey(r, i)} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors align-top">
              {cols.map((c) => (
                <td key={c.key} className={`px-3 py-2 text-[11px] text-white/65 whitespace-nowrap ${c.className ?? ''}`}>
                  {c.cell ? c.cell(r) : (asStr(c.accessor(r)) || '-')}
                </td>
              ))}
            </tr>
          ))}
          {processed.length === 0 && (
            <tr><td colSpan={cols.length} className="px-3 py-8 text-center text-[11px] text-white/20">No hay datos para mostrar</td></tr>
          )}
          {ocultas > 0 && (
            <tr>
              <td colSpan={cols.length} className="px-3 py-3 text-center">
                <button onClick={verMas} className="px-4 py-1.5 rounded-lg text-[11px] font-medium text-white/50 hover:text-white/80 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-colors">
                  Ver {Math.min(ocultas, FILAS_POR_TANDA)} más · quedan {ocultas}
                </button>
                <p className="mt-1.5 text-[10px] text-white/20">La descarga incluye las {ocultas} restantes</p>
              </td>
            </tr>
          )}
        </tbody>
      </TableWrap>

      {openKey && openCol && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpenKey(null)} />
          <div className="fixed z-50 w-[230px] rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl p-3 space-y-2.5" style={{ top: menuPos.top, left: menuPos.left }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white/70 truncate">{openCol.header}</span>
              <button onClick={() => setOpenKey(null)} className="text-white/30 hover:text-white/60"><X size={13} /></button>
            </div>
            {openCol.sortable !== false && (
              <div className="flex gap-1">
                <button onClick={() => setSort({ key: openKey, dir: 'asc' })} className={btnCls(sort?.key === openKey && sort.dir === 'asc')}>A → Z</button>
                <button onClick={() => setSort({ key: openKey, dir: 'desc' })} className={btnCls(sort?.key === openKey && sort.dir === 'desc')}>Z → A</button>
              </div>
            )}
            {openCol.filterable !== false && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  <button onClick={() => setFilter(openKey, { mode: 'contains' })} className={btnCls((openF?.mode ?? 'contains') === 'contains')}>Contiene</button>
                  <button onClick={() => setFilter(openKey, { mode: 'equals', value: '' })} className={btnCls(openF?.mode === 'equals')}>Igual a</button>
                </div>
                {openF?.mode === 'equals' ? (
                  <select value={openF?.value ?? ''} onChange={(e) => setFilter(openKey, { value: e.target.value })}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/80 outline-none cursor-pointer">
                    <option value="">Cualquiera</option>
                    {(distinct[openKey] ?? []).map((v) => <option key={v} value={v} className="bg-[#0d1117]">{v}</option>)}
                  </select>
                ) : (
                  <input value={openF?.value ?? ''} onChange={(e) => setFilter(openKey, { value: e.target.value })} placeholder="Escribe para filtrar…"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/80 outline-none placeholder-white/25" />
                )}
              </div>
            )}
            {isActive(openKey) && (
              <button onClick={() => clearCol(openKey)} className="w-full text-[10px] py-1 rounded-md text-white/40 hover:text-white/70 border border-white/5">Limpiar columna</button>
            )}
          </div>
        </>
      )}
    </>
  )
}
