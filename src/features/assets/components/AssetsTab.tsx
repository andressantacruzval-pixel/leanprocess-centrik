import { useState } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck, Database } from 'lucide-react'
import { useAssetStore } from '@/stores/assetStore'
import { getRiskLevel } from '@/types/risk'
import type { InformationAsset } from '@/types/asset'
import { AssetFormModal } from './AssetFormModal'

// Panel de Activos de Información del proceso (rail derecho / ventana emergente).
// Muestra TODOS los activos del proceso (los anclados a cualquier nodo del
// diagrama y los del proceso), consultables y editables como los demás módulos.
interface Props {
  processId: string
  processName: string
  isExpanded?: boolean
}

export function AssetsTab({ processId, isExpanded }: Props) {
  const assets = useAssetStore((s) => s.assets)
  const getOperation = useAssetStore((s) => s.getOperation)
  const deleteAsset = useAssetStore((s) => s.deleteAsset)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<InformationAsset | null>(null)

  const list = assets.filter((a) => a.process_id === processId)

  return (
    <div className={`flex flex-col h-full ${isExpanded ? 'max-w-3xl mx-auto w-full' : ''}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Database size={isExpanded ? 16 : 14} className="text-indigo-400" />
          <span className={`font-semibold text-white ${isExpanded ? 'text-sm' : 'text-xs'}`}>Activos de información</span>
          {list.length > 0 && <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">{list.length}</span>}
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/20 text-[11px] font-medium transition-colors"
        >
          <Plus size={12} /> Activo
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <ShieldCheck size={24} className="text-white/10 mb-3" />
            <p className="text-xs text-white/30 mb-1">Aún no hay activos de información</p>
            <p className="text-[10px] text-white/20">Regístralos aquí o desde un nodo «Almacén de datos» del diagrama.</p>
          </div>
        ) : list.map((a) => {
          const crit = a.criticality || 0
          const lvl = crit ? getRiskLevel(crit, crit) : null
          const op = getOperation(a.id, processId)?.operation
          return (
            <div key={a.id} className="group rounded-lg border border-white/8 bg-white/[0.03] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white flex items-center gap-1.5"><ShieldCheck size={12} className="text-indigo-300 shrink-0" />{a.name}</p>
                  {a.description && <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">{a.description}</p>}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {a.asset_type && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">{a.asset_type}</span>}
                    {op && <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300">{op}</span>}
                    {a.label && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">{a.label}</span>}
                    {a.owner && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/45">Prop: {a.owner}</span>}
                    {lvl && <span className={`text-[9px] px-1.5 py-0.5 rounded text-white ${lvl.color}`} title="Criticidad C·I·D (mayor de las tres)">C·I·D {crit}</span>}
                    {a.has_personal_data && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">Datos personales</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => { setEditing(a); setShowForm(true) }} title="Editar / ampliar" className="p-1.5 rounded text-white/30 hover:text-cyan-400 hover:bg-white/5"><Pencil size={13} /></button>
                  <button onClick={() => { if (confirm(`¿Eliminar el activo «${a.name}»?`)) deleteAsset(a.id) }} title="Eliminar" className="p-1.5 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showForm && (
        <AssetFormModal
          processId={processId}
          bpmnElementId={editing?.bpmn_element_id ?? null}
          asset={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
