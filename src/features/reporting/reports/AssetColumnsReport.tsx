import { useMemo, useState } from 'react'
import { Search, Columns3, Route } from 'lucide-react'
import type { Process } from '@/types/process'
import type { InformationAsset, AssetColumn } from '@/types/asset'
import { useAssetStore } from '@/stores/assetStore'
import { buildStages, treatmentAt, type Stage } from '@/features/assets/journey/assetLifecycle'
import { STATE_COLORS, STATE_LABELS } from '@/features/assets/journey/journeyGraph'
import { AssetLifecycleModal } from '@/features/assets/journey/AssetLifecycleModal'

interface Row { asset: InformationAsset; col: AssetColumn }

// Reporte por COLUMNAS: la trazabilidad del tratamiento de cada columna a lo largo
// de los procesos. Filas = columnas de cada activo (con su activo al lado);
// columnas = procesos; el cruce = el tratamiento que recibe esa columna en ese
// proceso (dónde se capta = su proceso origen). Se lee de izquierda a derecha con
// la barra de desplazamiento horizontal. Clic en un cruce → ficha de ciclo de vida.
export function AssetColumnsReport({ processes, assets }: { processes: Process[]; assets: InformationAsset[] }) {
  const operations = useAssetStore((s) => s.operations)
  const ids = useMemo(() => new Set(processes.map((p) => p.id)), [processes])
  const list = useMemo(() => assets.filter((a) => a.process_id && ids.has(a.process_id) && (a.columns?.length ?? 0) > 0), [assets, ids])

  // Etapas por activo (proceso → etapa) reutilizando la lógica del ciclo de vida.
  const stagesByAsset = useMemo(() => {
    const m = new Map<string, Map<string, Stage>>()
    for (const a of list) m.set(a.id, new Map(buildStages(a, operations, processes).map((s) => [s.procId, s])))
    return m
  }, [list, operations, processes])

  // Procesos que aparecen en el recorrido de alguna columna (columnas de la matriz).
  const procCols = useMemo(() => {
    const set = new Set<string>()
    stagesByAsset.forEach((sm) => sm.forEach((_s, pid) => set.add(pid)))
    const nameOf = (id: string) => processes.find((p) => p.id === id)?.name ?? 'Sin proceso'
    return [...set].map((id) => ({ id, name: nameOf(id) })).sort((a, b) => a.name.localeCompare(b.name))
  }, [stagesByAsset, processes])

  const rows = useMemo<Row[]>(() => list.flatMap((a) => (a.columns ?? []).map((col) => ({ asset: a, col }))), [list])

  const [q, setQ] = useState('')
  const [treatFilter, setTreatFilter] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<{ asset: InformationAsset; procId: string | null } | null>(null)

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((r) => r.col.name.toLowerCase().includes(query) || (r.col.code ?? '').toLowerCase().includes(query) || r.asset.name.toLowerCase().includes(query))
  }, [rows, q])

  const usedTreatments = useMemo(() => {
    const s = new Set<string>()
    rows.forEach((r) => { const sm = stagesByAsset.get(r.asset.id); sm?.forEach((st) => { const t = treatmentAt(st, r.col); if (typeof t === 'string') s.add(t) }) })
    return [...s]
  }, [rows, stagesByAsset])
  const toggleTreat = (t: string) => setTreatFilter((prev) => { const n = new Set(prev); if (n.has(t)) n.delete(t); else n.add(t); return n })
  const dimCell = (t: string | null | undefined) => treatFilter.size > 0 && !(typeof t === 'string' && treatFilter.has(t))

  // Primera fila de cada activo en el orden mostrado (para el separador + etiqueta).
  const firstOfAsset = useMemo(() => {
    const s = new Set<number>(); const seen = new Set<string>()
    shown.forEach((r, i) => { if (!seen.has(r.asset.id)) { seen.add(r.asset.id); s.add(i) } })
    return s
  }, [shown])

  if (list.length === 0) return <p className="text-[12px] text-white/40 py-10 text-center">No hay activos con columnas registradas en el alcance actual.</p>

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white/80"><Columns3 size={14} className="text-cyan-400" /> Trazabilidad por columna</div>
        <div className="relative ml-2">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar columna o activo…"
            className="pl-7 pr-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11.5px] text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 w-52" />
        </div>
        <div className="w-px h-5 bg-white/10 mx-0.5" />
        {usedTreatments.map((t) => (
          <button key={t} onClick={() => toggleTreat(t)}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10.5px] font-medium transition-colors ${treatFilter.has(t) ? 'border-white/25 text-white bg-white/5' : 'border-white/8 text-white/45'}`}>
            <span className="w-2 h-2 rounded-full" style={{ background: STATE_COLORS[t] ?? '#64748b' }} /> {STATE_LABELS[t] ?? t}
          </button>
        ))}
        {treatFilter.size > 0 && <button onClick={() => setTreatFilter(new Set())} className="text-[10.5px] text-white/45 hover:text-white/80 underline">Limpiar</button>}
      </div>

      <div className="overflow-auto max-h-[70vh]">
        <table className="border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-30 bg-[#0b1220] px-3 py-2 text-[10px] uppercase tracking-wide text-white/40 border-b border-r border-white/10 min-w-[230px]">Activo · Columna</th>
              {procCols.map((p) => (
                <th key={p.id} className="sticky top-0 z-20 bg-[#0b1220] px-2.5 py-2 border-b border-l border-white/8 min-w-[120px] align-bottom">
                  <div className="text-[11px] font-medium text-white/85 leading-tight">{p.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => {
              const sm = stagesByAsset.get(r.asset.id)
              const newAsset = firstOfAsset.has(i)
              return (
                <tr key={`${r.asset.id}:${r.col.name}`} className="hover:bg-white/[0.02]">
                  <td className={`sticky left-0 z-10 bg-[#0b1220] px-3 py-1.5 border-r border-white/10 align-top ${newAsset ? 'border-t border-white/10' : 'border-b border-white/5'}`}>
                    {newAsset && (
                      <button onClick={() => setDetail({ asset: r.asset, procId: null })} className="flex items-center gap-1 text-[10px] text-cyan-300/80 hover:text-cyan-200 mb-0.5" title="Ver ciclo de vida del activo">
                        <Route size={10} className="shrink-0" /><span className="truncate max-w-[200px]">{r.asset.name}</span>
                      </button>
                    )}
                    <div className="flex items-center gap-1.5 pl-3.5">
                      {r.col.code && <span className="text-[9px] font-mono text-white/40 shrink-0">{r.col.code}</span>}
                      <span className="text-[11.5px] text-white/85 leading-tight">{r.col.name}</span>
                    </div>
                  </td>
                  {procCols.map((p) => {
                    const st = sm?.get(p.id)
                    const t = st ? treatmentAt(st, r.col) : undefined
                    const dim = dimCell(t)
                    return (
                      <td key={p.id} onClick={() => st && setDetail({ asset: r.asset, procId: p.id })}
                        className={`px-2.5 py-1.5 border-l border-white/8 align-middle ${newAsset ? 'border-t border-white/10' : 'border-b border-white/5'} ${st ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`} style={{ opacity: dim ? 0.2 : 1 }}>
                        {t === undefined ? (
                          <span className="text-white/12 text-[12px]">·</span>
                        ) : t === null ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">Sin definir</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9.5px] px-1.5 py-0.5 rounded text-white whitespace-nowrap" style={{ background: `${STATE_COLORS[t] ?? '#64748b'}33`, border: `1px solid ${STATE_COLORS[t] ?? '#64748b'}` }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATE_COLORS[t] ?? '#64748b' }} />{STATE_LABELS[t] ?? t}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {detail && <AssetLifecycleModal asset={detail.asset} initialProcId={detail.procId} onClose={() => setDetail(null)} />}
    </div>
  )
}
