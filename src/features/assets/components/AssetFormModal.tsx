import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ShieldCheck, Wand2, ArrowRight, ArrowLeft } from 'lucide-react'
import type { AssetColumn } from '@/types/asset'
import { useAssetStore } from '@/stores/assetStore'
import { useProcessStore } from '@/stores/processStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import { orgProcPrefix, buildAssetCode } from '../assetCodes'
import type { BpmnModelerInstance } from '@/types/bpmn'
import { renameNode } from '../placeAssetNode'
import { JourneyLinkModal } from '../journey/JourneyLinkModal'
import { AssetColumnsEditor } from './AssetColumnsEditor'
import { ASSET_STATUSES, type InformationAsset } from '@/types/asset'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

interface Props {
  processId: string
  bpmnElementId?: string | null
  asset?: InformationAsset | null
  modeler?: BpmnModelerInstance | null
  onClose: () => void
}

export function AssetFormModal({ processId, bpmnElementId, asset, modeler, onClose }: Props) {
  const addAsset = useAssetStore((s) => s.addAsset)
  const updateAsset = useAssetStore((s) => s.updateAsset)
  const setOperation = useAssetStore((s) => s.setOperation)
  const existingOp = useAssetStore((s) => (asset ? s.getOperation(asset.id, processId)?.operation : undefined))
  const getCatalogByType = useCatalogStore((s) => s.getCatalogByType)
  const addCatalogItem = useCatalogStore((s) => s.addCatalogItem)
  const opts = (type: string) => getCatalogByType(type).map((c) => ({ value: c.value, label: c.value }))

  const setJourneyDetailed = useAssetStore((s) => s.setJourneyDetailed)
  const allProcesses = useProcessStore((s) => s.processes)
  const journeyProcesses = allProcesses.filter((p) => p.id !== processId)
  const procName = (id: string) => allProcesses.find((p) => p.id === id)?.name ?? 'Proceso'

  // Enlaces del Data Journey con detalle: qué columnas viajan + justificación.
  type Link = { columns: AssetColumn[]; justification: string }
  const initLinks = (dir: 'to' | 'from'): Record<string, Link> => {
    if (!asset) return {}
    const ops = useAssetStore.getState().operations.filter((o) => o.asset_id === asset.id && o.process_id === processId && (dir === 'to' ? o.target_process_id : o.source_process_id))
    const m: Record<string, Link> = {}
    ops.forEach((o) => { const pid = dir === 'to' ? o.target_process_id : o.source_process_id; if (pid) m[pid] = { columns: o.columns ?? [], justification: o.justification ?? '' } })
    return m
  }
  const [toLinks, setToLinks] = useState<Record<string, Link>>(() => initLinks('to'))
  const [fromLinks, setFromLinks] = useState<Record<string, Link>>(() => initLinks('from'))
  const [linkPicker, setLinkPicker] = useState<{ direction: 'to' | 'from'; procId: string } | null>(null)

  const journeyToggle = (direction: 'to' | 'from', procId: string) => {
    const links = direction === 'to' ? toLinks : fromLinks
    const setLinks = direction === 'to' ? setToLinks : setFromLinks
    if (links[procId]) { const n = { ...links }; delete n[procId]; setLinks(n) }
    else setLinkPicker({ direction, procId })
  }
  const confirmLink = (_dir: 'to' | 'from', cols: AssetColumn[], justification: string) => {
    if (!linkPicker) return
    const setLinks = linkPicker.direction === 'to' ? setToLinks : setFromLinks
    setLinks((prev) => ({ ...prev, [linkPicker.procId]: { columns: cols, justification } }))
    setLinkPicker(null)
  }

  const [f, setF] = useState({
    name: asset?.name ?? '', code: asset?.code ?? '', asset_type: asset?.asset_type ?? '',
    format: asset?.format ?? '', description: asset?.description ?? '',
    owner: asset?.owner ?? '', custodian: asset?.custodian ?? '', users: asset?.users ?? '',
    location: asset?.location ?? '',
    confidentiality: asset?.confidentiality ?? null as number | null,
    integrity: asset?.integrity ?? null as number | null,
    availability: asset?.availability ?? null as number | null,
    has_personal_data: asset?.has_personal_data ?? false,
    personal_data_category: asset?.personal_data_category ?? '',
    legal_requirements: asset?.legal_requirements ?? '',
    retention_period: asset?.retention_period ?? '', disposal_method: asset?.disposal_method ?? '',
    status: asset?.status ?? 'activo',
    operation: existingOp ?? '',
  })
  const set = (k: keyof typeof f, v: unknown) => setF((p) => ({ ...p, [k]: v }))

  // Columnas / campos del activo (el editor gestiona alta, IA y auto-código).
  const [columns, setColumns] = useState<AssetColumn[]>(() => asset?.columns ?? [])

  // Codificación automática del activo (organización · proceso · ACT · nnn).
  const process = useProcessStore((s) => s.processes.find((p) => p.id === processId))
  const companyId = useWorkspaceStore((s) => s.activeCompanyId)
  const allAssets = useAssetStore((s) => s.assets)
  const prefix = orgProcPrefix(process?.management, process?.coordination, process?.name)
  const autoAssetCode = () => {
    const seq = allAssets.filter((a) => a.company_id === companyId).length + 1
    set('code', buildAssetCode(prefix, seq))
  }

  const save = () => {
    if (!f.name.trim()) return
    const payload: Partial<InformationAsset> = {
      process_id: processId, bpmn_element_id: bpmnElementId ?? asset?.bpmn_element_id ?? null,
      name: f.name.trim(), code: f.code, asset_type: f.asset_type, format: f.format, description: f.description,
      owner: f.owner, custodian: f.custodian, users: f.users, location: f.location,
      confidentiality: f.confidentiality, integrity: f.integrity, availability: f.availability,
      has_personal_data: f.has_personal_data, personal_data_category: f.personal_data_category,
      legal_requirements: f.legal_requirements, retention_period: f.retention_period,
      disposal_method: f.disposal_method, status: f.status,
      columns: columns.filter((c) => c.name.trim()),
    }
    let id = asset?.id
    if (asset) updateAsset(asset.id, payload)
    else { const created = addAsset(payload); id = created?.id }
    if (id && f.operation) setOperation(id, processId, f.operation)
    if (id) {
      setJourneyDetailed(id, processId, 'to', Object.entries(toLinks).map(([pid, v]) => ({ processId: pid, columns: v.columns, justification: v.justification })))
      setJourneyDetailed(id, processId, 'from', Object.entries(fromLinks).map(([pid, v]) => ({ processId: pid, columns: v.columns, justification: v.justification })))
    }
    // Al guardar, las columnas confirmadas se suman al catálogo de campos.
    const fieldSet = new Set(getCatalogByType('asset_field').map((c) => norm(c.value)))
    columns.filter((c) => c.name.trim()).forEach((c) => {
      if (!fieldSet.has(norm(c.name))) { addCatalogItem('asset_field', c.name.trim()); fieldSet.add(norm(c.name)) }
    })
    // Sincroniza el nombre con el nodo del diagrama (bidireccional).
    const nodeId = payload.bpmn_element_id ?? asset?.bpmn_element_id
    if (modeler && nodeId) renameNode(modeler, nodeId, f.name.trim())
    onClose()
  }

  const inp = 'w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-[13px] text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-cyan-500/50'
  const lbl = 'block text-[10px] font-medium text-white/50 mb-1 uppercase tracking-wide'

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed z-[71] inset-0 m-auto h-[90vh] w-[95vw] max-w-2xl bg-[#0a0f1a] rounded-2xl border border-white/10 flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center"><ShieldCheck size={15} className="text-indigo-400" /></div>
            <h3 className="text-sm font-semibold text-white">{asset ? 'Editar activo de información' : 'Nuevo activo de información'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-white/40 hover:text-white/80 hover:bg-white/5"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Identificación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className={lbl}>Nombre *</label><input className={inp} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. Base de datos de clientes" /></div>
            <div><label className={lbl}>Código</label>
              <div className="flex gap-1.5">
                <input className={inp} value={f.code} onChange={(e) => set('code', e.target.value)} placeholder={`${prefix}-ACT-001`} />
                <button type="button" onClick={autoAssetCode} title="Generar código automático (organización · proceso · ACT)" className="shrink-0 inline-flex items-center gap-1 px-2 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10.5px] font-medium hover:bg-indigo-500/25"><Wand2 size={12} /></button>
              </div>
            </div>
            <div><label className={lbl}>Tipo</label><CreatableSelect options={opts('asset_type')} value={f.asset_type} onChange={(v) => set('asset_type', v)} onCreateOption={(v) => addCatalogItem('asset_type', v)} placeholder="Tipo de activo…" /></div>
            <div><label className={lbl}>Formato / Soporte</label><CreatableSelect options={opts('asset_format')} value={f.format} onChange={(v) => set('format', v)} onCreateOption={(v) => addCatalogItem('asset_format', v)} placeholder="Digital, Físico…" /></div>
            <div><label className={lbl}>Operación en este proceso</label><CreatableSelect options={opts('asset_operation')} value={f.operation} onChange={(v) => set('operation', v)} onCreateOption={(v) => addCatalogItem('asset_operation', v)} placeholder="Operación…" /></div>
            <div className="sm:col-span-2"><label className={lbl}>Descripción</label><textarea rows={2} className={`${inp} resize-none`} value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
          </div>

          {/* Responsabilidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={lbl}>Propietario</label><input className={inp} value={f.owner} onChange={(e) => set('owner', e.target.value)} /></div>
            <div><label className={lbl}>Custodio</label><input className={inp} value={f.custodian} onChange={(e) => set('custodian', e.target.value)} /></div>
            <div><label className={lbl}>Usuarios</label><input className={inp} value={f.users} onChange={(e) => set('users', e.target.value)} /></div>
            <div><label className={lbl}>Ubicación / Repositorio</label><CreatableSelect options={opts('asset_location')} value={f.location} onChange={(v) => set('location', v)} onCreateOption={(v) => addCatalogItem('asset_location', v)} placeholder="Sistema, servidor, ubicación…" /></div>
          </div>

          {/* La clasificación C·I·D (impacto) se valora en «Riesgo del activo»
              para no evaluar lo mismo dos veces. */}

          {/* Columnas / campos del activo (editor con IA + auto-código) */}
          <AssetColumnsEditor
            columns={columns}
            setColumns={setColumns}
            assetName={f.name || asset?.name || ''}
            assetType={f.asset_type}
            description={f.description}
            getCodeBase={() => (f.code.trim() ? f.code.trim() : prefix)}
          />

          {/* Legal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-[12px] text-white/70 sm:col-span-2"><input type="checkbox" checked={f.has_personal_data} onChange={(e) => set('has_personal_data', e.target.checked)} className="accent-cyan-500" /> Contiene datos personales</label>
            {f.has_personal_data && <div className="sm:col-span-2"><label className={lbl}>Categoría de datos personales</label><CreatableSelect options={opts('personal_data_category')} value={f.personal_data_category} onChange={(v) => set('personal_data_category', v)} onCreateOption={(v) => addCatalogItem('personal_data_category', v)} placeholder="Sensibles, financieros…" /></div>}
            <div className="sm:col-span-2"><label className={lbl}>Requisitos legales / contractuales</label><input className={inp} value={f.legal_requirements} onChange={(e) => set('legal_requirements', e.target.value)} /></div>
            <div><label className={lbl}>Periodo de retención</label><CreatableSelect options={opts('retention_period')} value={f.retention_period} onChange={(v) => set('retention_period', v)} onCreateOption={(v) => addCatalogItem('retention_period', v)} placeholder="Mensual, Anual…" /></div>
            <div><label className={lbl}>Método de disposición</label><CreatableSelect options={opts('disposal_method')} value={f.disposal_method} onChange={(v) => set('disposal_method', v)} onCreateOption={(v) => addCatalogItem('disposal_method', v)} placeholder="Eliminación segura…" /></div>
            <div><label className={lbl}>Estado</label><select className={inp} value={f.status} onChange={(e) => set('status', e.target.value)}>{ASSET_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
          </div>

          {/* Trazabilidad (Data Journey): de qué procesos viene y a cuáles va */}
          <div>
            <p className="text-[11px] font-semibold text-white/70 mb-2">Trazabilidad — Data Journey <span className="text-white/35 font-normal">(hacia dónde fluye este activo)</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={`${lbl} flex items-center gap-1`}><ArrowLeft size={11} /> Viene de los procesos</label>
                <ProcessPicker processes={journeyProcesses} selected={Object.keys(fromLinks)} onToggle={(id) => journeyToggle('from', id)} countOf={(id) => fromLinks[id]?.columns.length} />
              </div>
              <div>
                <label className={`${lbl} flex items-center gap-1`}><ArrowRight size={11} /> Va a los procesos</label>
                <ProcessPicker processes={journeyProcesses} selected={Object.keys(toLinks)} onToggle={(id) => journeyToggle('to', id)} countOf={(id) => toLinks[id]?.columns.length} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/5 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/5 border border-white/10">Cancelar</button>
          <button onClick={save} disabled={!f.name.trim()} className="px-4 py-2 rounded-lg text-[12px] font-medium bg-gradient-to-r from-indigo-600 to-cyan-600 text-white hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40">{asset ? 'Guardar cambios' : 'Crear activo'}</button>
        </div>
      </div>

      {linkPicker && (
        <JourneyLinkModal
          assetName={f.name || asset?.name || 'Activo'}
          columns={columns.filter((c) => c.name.trim())}
          targetName={procName(linkPicker.procId)}
          fixedDirection={linkPicker.direction}
          initialSelected={(linkPicker.direction === 'to' ? toLinks : fromLinks)[linkPicker.procId]?.columns.map((c) => c.name)}
          initialJustification={(linkPicker.direction === 'to' ? toLinks : fromLinks)[linkPicker.procId]?.justification}
          onConfirm={confirmLink}
          onClose={() => setLinkPicker(null)}
        />
      )}
    </>,
    document.body
  )
}

// Selector múltiple de procesos (checkbox chips) para la trazabilidad.
function ProcessPicker({ processes, selected, onToggle, countOf }: {
  processes: { id: string; name: string }[]
  selected: string[]
  onToggle: (id: string) => void
  countOf?: (id: string) => number | undefined
}) {
  const [q, setQ] = useState('')
  const shown = q ? processes.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : processes
  return (
    <div className="border border-white/10 rounded-lg bg-white/[0.02]">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar proceso…"
        className="w-full bg-transparent border-b border-white/10 px-2.5 py-1.5 text-[12px] text-white placeholder-white/25 focus:outline-none"
      />
      <div className="max-h-32 overflow-y-auto p-1.5 space-y-0.5">
        {shown.length === 0 && <p className="text-[11px] text-white/30 px-1.5 py-2">Sin procesos.</p>}
        {shown.map((p) => (
          <label key={p.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-white/5 cursor-pointer">
            <input type="checkbox" checked={selected.includes(p.id)} onChange={() => onToggle(p.id)} className="accent-cyan-500 shrink-0" />
            <span className="text-[12px] text-white/70 truncate flex-1">{p.name}</span>
            {selected.includes(p.id) && <span className="text-[9px] text-cyan-300 shrink-0">{countOf?.(p.id) ?? 0} campos</span>}
          </label>
        ))}
      </div>
    </div>
  )
}
