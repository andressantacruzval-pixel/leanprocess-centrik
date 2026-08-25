import { ArrowDownLeft, Trash2, ShieldCheck } from 'lucide-react'
import { useAssetStore } from '@/stores/assetStore'
import { useProcessStore } from '@/stores/processStore'
import { ASSET_OPERATIONS } from '@/types/asset'
import { STATE_COLORS } from '../journey/journeyGraph'

// Activos que OTROS procesos envían a este proceso (integración bidireccional del
// Data Journey). Muestra de qué proceso viene, con qué justificación, qué columnas
// llegan y cuáles existen pero no llegan. Permite fijar el tratamiento en destino
// y quitar la relación (se elimina también la flecha del Data Journey).
export function ReceivedAssetsPanel({ processId }: { processId: string }) {
  const operations = useAssetStore((s) => s.operations)
  const assets = useAssetStore((s) => s.assets)
  const deleteOperation = useAssetStore((s) => s.deleteOperation)
  const updateJourneyLink = useAssetStore((s) => s.updateJourneyLink)
  const processes = useProcessStore((s) => s.processes)

  const incoming = operations.filter((o) => o.target_process_id === processId)
  if (incoming.length === 0) return null

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/[0.05] p-2.5 space-y-2">
      <p className="text-[11px] font-semibold text-cyan-200/90 flex items-center gap-1.5"><ArrowDownLeft size={13} /> Recibidos de otros procesos ({incoming.length})</p>
      {incoming.map((o) => {
        const asset = assets.find((a) => a.id === o.asset_id)
        if (!asset) return null
        const sourceName = processes.find((p) => p.id === o.process_id)?.name ?? 'otro proceso'
        const arriving = o.columns ?? []
        const arrivingNames = new Set(arriving.map((c) => c.name))
        const notArriving = (asset.columns ?? []).filter((c) => !arrivingNames.has(c.name))
        return (
          <div key={o.id} className="rounded-lg border border-white/8 bg-white/[0.03] p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-white flex items-center gap-1.5"><ShieldCheck size={12} className="text-indigo-300 shrink-0" />{asset.name}</p>
                <p className="text-[10px] text-white/45 mt-0.5">Viene de <span className="text-white/70">{sourceName}</span></p>
              </div>
              <button onClick={() => { if (confirm(`¿Quitar la relación de «${asset.name}» recibido de ${sourceName}? Se elimina también del Data Journey.`)) deleteOperation(o.id) }} title="Quitar relación" className="p-1.5 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 shrink-0"><Trash2 size={13} /></button>
            </div>

            {o.justification && <p className="text-[10.5px] text-white/40 mt-1 italic">“{o.justification}”</p>}

            <div className="mt-1.5">
              <p className="text-[9.5px] text-white/40 uppercase tracking-wide mb-1">Columnas que llegan ({arriving.length})</p>
              <div className="flex flex-wrap gap-1">
                {arriving.length === 0 ? <span className="text-[10px] text-white/30">Ninguna declarada.</span> : arriving.map((c) => (
                  <span key={c.name} className="text-[9.5px] px-1.5 py-0.5 rounded bg-white/8 text-white/70 inline-flex items-center gap-1">
                    {c.code && <span className="text-white/40 font-mono">{c.code}</span>}{c.name}
                    {c.operation && <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATE_COLORS[c.operation] ?? '#64748b' }} />}
                  </span>
                ))}
              </div>
            </div>

            {notArriving.length > 0 && (
              <div className="mt-1.5">
                <p className="text-[9.5px] text-white/30 uppercase tracking-wide mb-1">Existen pero no llegan ({notArriving.length})</p>
                <div className="flex flex-wrap gap-1">
                  {notArriving.map((c) => <span key={c.name} className="text-[9.5px] px-1.5 py-0.5 rounded border border-white/10 text-white/35">{c.name}</span>)}
                </div>
              </div>
            )}

            <div className="mt-2 flex items-center gap-2">
              <span className="text-[9.5px] text-white/40">Tratamiento aquí:</span>
              <select value={o.dest_operation ?? ''} onChange={(e) => updateJourneyLink(o.id, arriving, o.justification ?? '', e.target.value)}
                className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50">
                <option value="">Sin definir…</option>
                {ASSET_OPERATIONS.filter((op) => op.value !== 'transfiere').map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
              </select>
              {o.dest_operation && <span className="w-2 h-2 rounded-full" style={{ background: STATE_COLORS[o.dest_operation] ?? '#64748b' }} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}
