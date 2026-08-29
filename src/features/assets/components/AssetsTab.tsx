import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck, Database, Sparkles, Loader2, Shield, BarChart3, Route } from 'lucide-react'
import { useAssetStore } from '@/stores/assetStore'
import { useProcessStore } from '@/stores/processStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import { getRiskLevel } from '@/types/risk'
import { assetCriticality, type InformationAsset } from '@/types/asset'
import { assetInherentImpact, calculateAssetResidual } from '@/types/assetRisk'
import { identifyAssetsFromProcess } from '@/lib/assetAi'
import { parseBpmnXml } from '@/utils/bpmnParser'
import { toast } from '@/stores/toastStore'
import type { BpmnModelerInstance, BpmnEventBus, BpmnElement, BpmnElementRegistry } from '@/types/bpmn'
import { placeDataStoreNear, removeNode } from '../placeAssetNode'
import { isApplicationBO } from '../../applications/placeApplicationNode'
import { AssetFormModal } from './AssetFormModal'
import { AssetRiskModal } from './AssetRiskModal'
import { AssetHeatMap } from './AssetHeatMap'
import { ReceivedAssetsPanel } from './ReceivedAssetsPanel'
import { AssetLifecycleModal } from '../journey/AssetLifecycleModal'

// Nodos del diagrama que representan almacenes/objetos de datos (activos).
const DATA_NODE_TYPES = new Set([
  'bpmn:DataStoreReference', 'bpmn:DataStore', 'bpmn:DataObjectReference', 'bpmn:DataObject',
])

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
  const assetControls = useAssetStore((s) => s.assetControls)

  const process = useProcessStore((s) => s.processes.find((p) => p.id === processId))
  const company = useCompanyStore((s) => s.company)
  const getSipocByProcess = useCatalogStore((s) => s.getSipocByProcess)
  const budget = useTokenBudget({ operationKey: 'asset_identification' })
  const [identifying, setIdentifying] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<InformationAsset | null>(null)
  const [litId, setLitId] = useState<string | null>(null)
  const [riskAsset, setRiskAsset] = useState<InformationAsset | null>(null)
  const [lifecycleAsset, setLifecycleAsset] = useState<InformationAsset | null>(null)
  const [showHeat, setShowHeat] = useState(false)

  const list = assets.filter((a) => a.process_id === processId)

  // Nodos «Almacén/Objeto de datos» del diagrama que aún NO están registrados como
  // activo. Aparecen cuando el flujograma (o la IA) dibuja el nodo pero no se creó
  // la ficha del activo. Se detectan en vivo del modeler y se pueden registrar.
  const [diagVer, setDiagVer] = useState(0)
  useEffect(() => {
    if (!modeler) return
    const bus = modeler.get('eventBus') as BpmnEventBus
    const bump = () => setDiagVer((v) => v + 1)
    ;['shape.added', 'shape.removed', 'element.changed', 'import.done'].forEach((e) => bus.on(e, bump))
    return () => { ['shape.added', 'shape.removed', 'element.changed', 'import.done'].forEach((e) => bus.off(e, bump)) }
  }, [modeler])

  const unregistered = useMemo(() => {
    if (!modeler) return [] as { id: string; name: string }[]
    const covered = new Set(list.filter((a) => a.bpmn_element_id).map((a) => a.bpmn_element_id as string))
    try {
      const registry = modeler.get('elementRegistry') as BpmnElementRegistry
      return (registry.filter(() => true) as BpmnElement[])
        // Excluye los nodos de Aplicación — esos son del módulo de apps.
        .filter((el) => DATA_NODE_TYPES.has(el.type) && !covered.has(el.id) && !isApplicationBO(el.businessObject))
        .map((el) => ({ id: el.id, name: (el.businessObject?.name || '').trim() || 'Almacén de datos' }))
    } catch { return [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeler, list, diagVer])

  const registerNode = (node: { id: string; name: string }) =>
    addAsset({ process_id: processId, bpmn_element_id: node.id, name: node.name, status: 'en_revision' })
  const registerAllNodes = () => { unregistered.forEach(registerNode); if (unregistered.length) toast.success(`${unregistered.length} activo(s) registrados desde el diagrama.`) }

  // Riesgo por activo (inherente y residual) reutilizando la matriz 5×5.
  const riskOf = (a: InformationAsset) => {
    const controls = assetControls.filter((c) => c.asset_id === a.id)
    const inhImp = assetInherentImpact(a.confidentiality, a.integrity, a.availability)
    const res = calculateAssetResidual(a.confidentiality, a.integrity, a.availability, a.probability, controls)
    return { inhImp, inhProb: a.probability || 0, resImp: res.residualImpact, resProb: res.rProb }
  }
  const heat = useMemo(() => {
    const inh: { p: number; i: number }[] = []
    const resd: { p: number; i: number }[] = []
    list.forEach((a) => {
      const r = riskOf(a)
      if (r.inhProb && r.inhImp) inh.push({ p: r.inhProb, i: r.inhImp })
      if (r.resProb && r.resImp) resd.push({ p: r.resProb, i: r.resImp })
    })
    return { inh, resd }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, assetControls])

  // Borra el activo del catálogo y, si tiene nodo en el diagrama, también lo quita.
  // Se borra el activo PRIMERO para que el listener de «nodo eliminado» no intente
  // desvincular un activo que ya no existe (evita una escritura huérfana en la nube).
  const removeAsset = (a: InformationAsset) => {
    if (!confirm(`¿Eliminar el activo «${a.name}»? Se quita del catálogo y del diagrama.`)) return
    deleteAsset(a.id)
    if (modeler && a.bpmn_element_id) removeNode(modeler, a.bpmn_element_id)
  }

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Database size={isExpanded ? 16 : 14} className="text-primary-600" />
          <span className={`font-semibold text-gray-900 ${isExpanded ? 'text-sm' : 'text-xs'}`}>Activos de información</span>
          {list.length > 0 && <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded-md text-gray-500">{list.length}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {list.length > 0 && (
            <button
              onClick={() => setShowHeat((v) => !v)}
              className={`p-1.5 rounded-md border transition-colors ${showHeat ? 'text-primary-600 bg-primary-100 border-primary-300' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border-gray-200'}`}
              title="Mapa de calor de riesgo de activos"
            >
              <BarChart3 size={13} />
            </button>
          )}
          <button
            onClick={handleIdentify}
            disabled={identifying || budget.isConsuming}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white text-[11px] font-medium transition-colors disabled:opacity-50 bg-primary-500 hover:bg-primary-600"
            title="La IA identifica los activos del proceso y coloca los críticos en el flujograma"
          >
            {(identifying || budget.isConsuming) ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {(identifying || budget.isConsuming) ? 'Identificando…' : 'Identificar con IA'}
            <TokenCostBadge operationKey="asset_identification" />
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 text-[11px] font-medium transition-colors"
          >
            <Plus size={12} /> Activo
          </button>
        </div>
      </div>

      {showHeat && list.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
            <AssetHeatMap points={heat.inh} label="Riesgo Inherente" />
            <AssetHeatMap points={heat.resd} label="Riesgo Residual" />
          </div>
          <p className="text-[9px] text-gray-400 text-center mt-2">Probabilidad × mayor impacto C·I·D. Evalúa cada activo con el botón de escudo.</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <ReceivedAssetsPanel processId={processId} />
        {unregistered.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-amber-700">{unregistered.length} nodo(s) de datos en el diagrama sin registrar como activo.</p>
              <button onClick={registerAllNodes} className="shrink-0 px-2 py-1 rounded-lg bg-amber-100 text-amber-700 border border-amber-300 text-[10.5px] font-medium hover:bg-amber-100">Registrar todos</button>
            </div>
            <div className="space-y-1">
              {unregistered.map((n) => (
                <div key={n.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-gray-50 border border-gray-100">
                  <Database size={12} className="text-gray-500 shrink-0" />
                  <span className="text-[11px] text-gray-700 truncate flex-1">{n.name}</span>
                  <button onClick={() => registerNode(n)} className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] text-primary-700 hover:bg-primary-50" title="Registrar como activo"><Plus size={11} /> Registrar</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {list.length === 0 && unregistered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <ShieldCheck size={24} className="text-gray-300 mb-3" />
            <p className="text-xs text-gray-400 mb-1">Aún no hay activos de información</p>
            <p className="text-[10px] text-gray-300">Regístralos aquí o desde un nodo «Almacén de datos» del diagrama.</p>
          </div>
        ) : list.map((a) => {
          const crit = a.criticality || 0
          const lvl = crit ? getRiskLevel(crit, crit) : null
          const op = getOperation(a.id, processId)?.operation
          const r = riskOf(a)
          const inhLvl = r.inhProb && r.inhImp ? getRiskLevel(r.inhProb, r.inhImp) : null
          const resLvl = r.resProb && r.resImp ? getRiskLevel(r.resProb, r.resImp) : null
          return (
            <div key={a.id} className={`group rounded-lg border p-3 transition-colors ${litId === a.id ? 'border-amber-300 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => highlight(a)} title={a.bpmn_element_id ? 'Ver dónde está en el diagrama' : 'Sin nodo en el diagrama'}>
                  <p className="text-[13px] font-medium text-gray-900 flex items-center gap-1.5"><ShieldCheck size={12} className="text-primary-700 shrink-0" />{a.name}</p>
                  {a.description && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{a.description}</p>}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {a.asset_type && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-500">{a.asset_type}</span>}
                    {op && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary-50 text-primary-700">{op}</span>}
                    {a.label && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-500">{a.label}</span>}
                    {a.owner && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-500">Prop: {a.owner}</span>}
                    {a.columns?.length ? <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary-50 text-primary-700">{a.columns.length} campos</span> : null}
                    {lvl && <span className={`text-[9px] px-1.5 py-0.5 rounded-md text-gray-900 ${lvl.color}`} title="Criticidad C·I·D (mayor de las tres)">C·I·D {crit}</span>}
                    {a.has_personal_data && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">Datos personales</span>}
                    {inhLvl && (
                      <span className="inline-flex items-center gap-1 text-[9px]" title="Riesgo inherente → residual">
                        <span className={`px-1.5 py-0.5 rounded-md text-gray-900 ${inhLvl.color}`}>{inhLvl.label}</span>
                        <span className="text-gray-400">→</span>
                        <span className={`px-1.5 py-0.5 rounded-md text-gray-900 ${resLvl?.color ?? 'bg-gray-100'}`}>{resLvl?.label ?? '—'}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => { setEditing(a); setShowForm(true) }} title="Editar / ampliar" className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-gray-50"><Pencil size={13} /></button>
                  <button onClick={() => setLifecycleAsset(a)} title="Ver ciclo de vida del dato (por subproceso)" className="p-1.5 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50"><Route size={13} /></button>
                  <button onClick={() => setRiskAsset(a)} title="Evaluar riesgo del activo" className="p-1.5 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50"><Shield size={13} /></button>
                  <button onClick={() => removeAsset(a)} title="Eliminar" className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>
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
      {riskAsset && (
        <AssetRiskModal asset={riskAsset} onClose={() => setRiskAsset(null)} />
      )}
      {lifecycleAsset && (
        <AssetLifecycleModal asset={lifecycleAsset} onClose={() => setLifecycleAsset(null)} />
      )}
      <InsufficientTokensModal
        open={budget.showInsufficientModal}
        onClose={budget.closeInsufficientModal}
        operationKey="asset_identification"
      />
    </div>
  )
}
