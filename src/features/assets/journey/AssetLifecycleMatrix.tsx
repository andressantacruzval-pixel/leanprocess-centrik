import { useMemo, useState } from 'react'
import { Search, ArrowRight, MapPin } from 'lucide-react'
import type { InformationAsset } from '@/types/asset'
import { STATE_COLORS, STATE_LABELS } from './journeyGraph'
import { KIND_LABEL, treatmentAt, type Stage } from './assetLifecycle'

// Vista global (matriz columnas × subprocesos) del recorrido del activo. Solo
// lectura: para editar cada tratamiento se usa la vista «Por subproceso».
export function AssetLifecycleMatrix({ asset, stages, onGoToStage }: { asset: InformationAsset; stages: Stage[]; onGoToStage: (procId: string) => void }) {
  const [q, setQ] = useState('')
  const [treatFilter, setTreatFilter] = useState<Set<string>>(new Set())

  const cols = useMemo(() => {
    const list = asset.columns ?? []
    const query = q.trim().toLowerCase()
    return query ? list.filter((c) => c.name.toLowerCase().includes(query) || (c.code ?? '').toLowerCase().includes(query)) : list
  }, [asset.columns, q])

  const usedTreatments = useMemo(() => {
    const s = new Set<string>()
    for (const c of asset.columns ?? []) for (const st of stages) { const t = treatmentAt(st, c); if (typeof t === 'string') s.add(t) }
    return [...s]
  }, [asset.columns, stages])

  const toggleTreat = (t: string) => setTreatFilter((prev) => { const n = new Set(prev); if (n.has(t)) n.delete(t); else n.add(t); return n })
  const dimCell = (t: string | null | undefined) => treatFilter.size > 0 && !(typeof t === 'string' && treatFilter.has(t))

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-white/5 shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar columna…"
            className="pl-7 pr-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11.5px] text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 w-44" />
        </div>
        <div className="w-px h-5 bg-white/10 mx-0.5" />
        {usedTreatments.length === 0 ? <span className="text-[10.5px] text-white/30">Sin tratamientos declarados aún.</span> : usedTreatments.map((t) => (
          <button key={t} onClick={() => toggleTreat(t)}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10.5px] font-medium transition-colors ${treatFilter.has(t) ? 'border-white/25 text-white bg-white/5' : 'border-white/8 text-white/45'}`}>
            <span className="w-2 h-2 rounded-full" style={{ background: STATE_COLORS[t] ?? '#64748b' }} /> {STATE_LABELS[t] ?? t}
          </button>
        ))}
        {treatFilter.size > 0 && <button onClick={() => setTreatFilter(new Set())} className="text-[10.5px] text-white/45 hover:text-white/80 underline">Limpiar</button>}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {cols.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MapPin size={26} className="text-white/10 mb-3" />
            <p className="text-xs text-white/35">Este activo no tiene columnas registradas.</p>
            <p className="text-[10.5px] text-white/20 mt-1">Agrégalas en la ficha del activo para ver su recorrido.</p>
          </div>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-[#0d1420] px-2.5 py-2 text-[10px] uppercase tracking-wide text-white/40 border-b border-white/10 min-w-[160px]">Columna</th>
                {stages.map((st, i) => (
                  <th key={st.procId} onClick={() => onGoToStage(st.procId)} title="Editar el tratamiento en este subproceso"
                    className="px-2.5 py-2 border-b border-white/10 border-l border-white/5 min-w-[130px] align-bottom cursor-pointer hover:bg-white/[0.03]">
                    <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide" style={{ color: st.kind === 'origin' ? '#67e8f9' : '#94a3b8' }}>
                      {i > 0 && st.kind === 'target' && <ArrowRight size={10} className="text-white/25" />}{KIND_LABEL[st.kind]}
                    </div>
                    <div className="text-[11.5px] font-medium text-white/90 leading-tight mt-0.5">{st.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cols.map((c) => (
                <tr key={c.name} className="hover:bg-white/[0.02]">
                  <td className="sticky left-0 z-10 bg-[#0d1420] px-2.5 py-2 border-b border-white/5 align-top">
                    <div className="flex items-center gap-1.5">
                      {c.code && <span className="text-[9px] font-mono text-white/40 shrink-0">{c.code}</span>}
                      <span className="text-[12px] text-white/85 leading-tight">{c.name}</span>
                    </div>
                  </td>
                  {stages.map((st) => {
                    const t = treatmentAt(st, c)
                    const dim = dimCell(t)
                    return (
                      <td key={st.procId} className="px-2.5 py-2 border-b border-white/5 border-l border-white/5 align-middle" style={{ opacity: dim ? 0.22 : 1 }}>
                        {t === undefined ? (
                          <span className="text-white/15 text-[13px]" title="Esta columna no viaja a este subproceso">—</span>
                        ) : t === null ? (
                          <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-white/5 text-white/40" title="Presente, sin tratamiento definido">Sin definir</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-white" style={{ background: `${STATE_COLORS[t] ?? '#64748b'}33`, border: `1px solid ${STATE_COLORS[t] ?? '#64748b'}` }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATE_COLORS[t] ?? '#64748b' }} />{STATE_LABELS[t] ?? t}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
