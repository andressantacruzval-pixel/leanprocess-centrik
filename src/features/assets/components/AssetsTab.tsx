import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck, Database, Sparkles, Loader2 } from 'lucide-react'
import { useAssetStore } from '@/stores/assetStore'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import { getRiskLevel } from '@/types/risk'
import { assetCriticality, type InformationAsset } from '@/types/asset'
import { identifyAssetsFromProcess } from '@/lib/assetAi'
import { parseBpmnXml } from '@/utils/bpmnParser'
import { toast } from '@/stores/toastStore'
import type { BpmnModelerInstance } from '@/types/bpmn'
import { placeDataStoreNear } from '../placeAssetNode'
import { AssetFormModal } from './AssetFormModal'

// Panel de Activos de Información del proceso (rail derecho / ventana emergente).
// Muestra TODOS los activos del proceso (los anclados a cualquier nodo del
// diagrama y los del proceso), consultables y editables como los demás módulos.
// Con `modeler`, la IA además coloca nodos «Almacén de datos» para los críticos.
interface Props {
  processId: string
  processName: string
  isExpanded?: boolean
  modeler?: BpmnModelerInstance | null
}

export function AssetsTab({ processId, processName, isExpanded, modeler }: Props) {
  const assets = useAssetStore((s) => s.assets)
  const getOperation = useAssetStore((s) => s.getOperation)
  const addAsset = useAssetStore((s) => s.addAsset)
  const setOperation = useAssetStore((s) => s.setOperation)
  const deleteAsset = useAssetStore((s) => s.deleteAsset)

  const process = useProcessStore((s) => s.processes.find((p) => p.id === processId))
  const company = useCompanyStore((s) => s.company)
  const getSipocByProcess = useCatalogStore((s) => s.getSipocByProcess)
  const budget = useTokenBudget({ operationKey: 'asset_identification' })
  const [identifying, setIdentifying] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<InformationAsset | null>(null)
  const [litId, setLitId] = useState<string | null>(null)

  const list = assets.filter((a) => a.process_id === processId)

  // «Encender la luz» del nodo del activo en el diagrama al pulsar su fila.
  const canvasOf = () => modeler?.get('canvas') as unknown as { addMarker: (id: string, m: string) => void; removeMarker: (id: string, m: string) => void } | undefined
  const highlight = (asset: InformationAsset) => {
    const canvas = canvasOf()
    if (!canvas || !asset.bpmn_element_id) { setLitId(asset.id); return }
    if (litId) { const prev = list.find((a) => a.id === litId); if (prev?.bpmn_element_id) try { canvas.removeMarker(prev.bpmn_element_id, 'asset-lit') } catch { /* no-op */ } }
    try { canvas.addMarker(asset.bpmn_element_id, 'asset-lit') } catch { /* no-op */ }
    setLitId(asset.id)
  }
  // Al seleccionar cualquier nodo del diagrama, se apaga el resaltado del activo.
  useEffect(() => {
    if (!modeler) return
    const bus = modeler.get('eventBus')
    const off = () => {
      const canvas = canvasOf()
      list.forEach((a) => { if (a.bpmn_element_id && canvas) try { canvas.removeMarker(a.bpmn_element_id, 'asset-lit') } catch { /* no-op */ } })
      setLitId(null)
    }
    bus.on('selection.changed', off)
    return () => { bus.off('selection.changed', off) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeler])

  const handleIdentify = async () => {
    if (identifying) return
    setIdentifying(true)
    try {
      const suggestions = await budget.run(() => identifyAssetsFromProcess({
        companyName: company?.name || '',
        industry: company?.industry || undefined,
        processName,
        description: process?.description || undefined,
        bpmnXml: process?.bpmn_xml || undefined,
        activities: process?.bpmn_xml ? parseBpmnXml(process.bpmn_xml).activities.map((a) => a.name).filter(Boolean) : [],
        sipoc: getSipocByProcess(processId),
        existingAssetNames: list.map((a) => a.name),
      }))
      if (!suggestions) return
      let added = 0
      for (const s of suggestions) {
        const crit = assetCriticality(s.confidentiality, s.integrity, s.availability)
        // Para los críticos (C·I·D ≥ 4) se crea un nodo Almacén de datos en el flujo.
        const nodeId = crit >= 4 && modeler ? placeDataStoreNear(modeler, s.relatedActivity, s.name) : null
        const created = addAsset({
          process_id: processId,
          bpmn_element_id: nodeId,
          name: s.name, description: s.description, asset_type: s.asset_type, format: s.format,
          owner: s.owner, custodian: s.custodian, location: s.location,
          confidentiality: s.confidentiality, integrity: s.integrity, availability: s.availability,
          has_personal_data: s.has_personal_data, personal_data_category: s.personal_data_category,
          retention_period: s.retention_period, disposal_method: s.disposal_method,
          status: 'en_revision',
        })
        if (created) { added++; if (s.operation) setOperation(created.id, processId, s.operation) }
      }
      if (added) toast.success(`${added} activo(s) identificados. Revísalos y ajústalos.`)
      else toast.info('La IA no encontró activos nuevos para este proceso.')
    } catch (err) {
      console.warn('[AssetsTab] identify error', err)
      toast.error('No se pudieron identificar los activos. Intenta de nuevo.')
    } finally {
      setIdentifying(false)
    }
  }

  return (
    <div className={`flex flex-col h-full ${isExpanded ? 'max-w-3xl mx-auto w-full' : ''}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Database size={isExpanded ? 16 : 14} className="text-indigo-400" />
          <span className={`font-semibold text-white ${isExpanded ? 'text-sm' : 'text-xs'}`}>Activos de información</span>
          {list.length > 0 && <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">{list.length}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleIdentify}
            disabled={identifying || budget.isConsuming}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600/80 to-cyan-600/80 text-white hover:from-purple-500 hover:to-cyan-500 text-[11px] font-medium transition-colors disabled:opacity-50"
            title="La IA identifica los activos del proceso y coloca los críticos en el flujograma"
          >
            {(identifying || budget.isConsuming) ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {(identifying || budget.isConsuming) ? 'Identificando…' : 'Identificar con IA'}
            <TokenCostBadge operationKey="asset_identification" />
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/20 text-[11px] font-medium transition-colors"
          >
            <Plus size={12} /> Activo
          </button>
        </div>
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
            <div key={a.id} className={`group rounded-lg border p-3 transition-colors ${litId === a.id ? 'border-amber-400/50 bg-amber-500/[0.06]' : 'border-white/8 bg-white/[0.03]'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => highlight(a)} title={a.bpmn_element_id ? 'Ver dónde está en el diagrama' : 'Sin nodo en el diagrama'}>
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
          modeler={modeler}
          onClose={() => { setShowForm(false); setEditing(null) }}
        />
      )}
      <InsufficientTokensModal
        open={budget.showInsufficientModal}
        onClose={budget.closeInsufficientModal}
        operationKey="asset_identification"
      />
    </div>
  )
}
