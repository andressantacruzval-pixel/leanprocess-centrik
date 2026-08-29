import { useState } from 'react'
import { Plus, Trash2, MapPin, Home } from 'lucide-react'
import { useAssetStore } from '@/stores/assetStore'
import { useCatalogStore } from '@/features/catalog/catalogStore'
import { CreatableSelect } from '@/components/ui/CreatableSelect'
import { ASSET_OPERATIONS, type AssetColumn, type InformationAsset } from '@/types/asset'
import { STATE_COLORS, STATE_LABELS } from './journeyGraph'
import { KIND_LABEL, treatmentAt, columnsAvailableAt, type Stage } from './assetLifecycle'

// Editor de UNA etapa (subproceso) del recorrido del activo. Muestra la ficha de
// cada columna (código · nombre · descripción, heredados del origen) y su
// TRATAMIENTO en este subproceso — editable aquí, sin tocar el activo origen. En
// las etapas de transferencia se elige qué columnas llegan; en el origen, el
// tratamiento base. La franja de puntos («trazabilidad») muestra el tratamiento
// de esa columna en cada etapa, para ir viendo hacia atrás qué se hizo.
export function AssetStageEditor({ asset, stage, stages, onGoToStage }: {
  asset: InformationAsset; stage: Stage; stages: Stage[]; onGoToStage: (procId: string) => void
}) {
  const updateAsset = useAssetStore((s) => s.updateAsset)
  const updateJourneyLink = useAssetStore((s) => s.updateJourneyLink)
  const allOps = useAssetStore((s) => s.operations)
  const op = allOps.find((o) => o.id === stage.opId)
  const getCatalogByType = useCatalogStore((s) => s.getCatalogByType)
  const addCatalogItem = useCatalogStore((s) => s.addCatalogItem)
  const mediumOpts = getCatalogByType('transfer_medium').map((c) => ({ value: c.value, label: c.value }))

  const isOrigin = stage.kind === 'origin'
  const originCols = asset.columns ?? []
  const arriving = op?.columns ?? []
  const arrivingNames = new Set(arriving.map((c) => c.name))

  // Texto del enlace (medio/justificación): estado local, se persiste al salir.
  const [just, setJust] = useState(op?.justification ?? '')
  const [medium, setMedium] = useState(op?.medium ?? '')
  const [mediumDetail, setMediumDetail] = useState(op?.medium_detail ?? '')

  // Persiste el enlace con las columnas dadas y los textos locales actuales.
  const commit = (cols: AssetColumn[], j = just, m = medium, md = mediumDetail) => {
    if (!op) return
    updateJourneyLink(op.id, cols, j, op.dest_operation, m, md)
  }

  const setOriginTreatment = (idx: number, treatment: string) =>
    updateAsset(asset.id, { columns: originCols.map((c, i) => (i === idx ? { ...c, operation: treatment } : c)) })
  const setLinkTreatment = (name: string, treatment: string) =>
    commit(arriving.map((c) => (c.name === name ? { ...c, operation: treatment } : c)))
  const addColToLink = (c: AssetColumn) => commit([...arriving, { ...c }])
  const removeColFromLink = (name: string) => commit(arriving.filter((c) => c.name !== name))

  const sel = 'bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-[12px] text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary-500'

  // Franja de trazabilidad para una columna: un punto por etapa (coloreado por su
  // tratamiento), la etapa actual resaltada. Clic → navega a esa etapa.
  const Trail = ({ col }: { col: AssetColumn }) => (
    <div className="flex items-center gap-1 mt-1">
      {stages.map((st) => {
        const t = treatmentAt(st, col)
        const here = st.procId === stage.procId
        const bg = t === undefined ? 'transparent' : (STATE_COLORS[t as string] ?? '#64748b')
        return (
          <button key={st.procId} onClick={() => onGoToStage(st.procId)} title={`${st.name}: ${typeof t === 'string' ? (STATE_LABELS[t] ?? t) : t === null ? 'sin definir' : 'no viaja'}`}
            className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform hover:scale-125"
            style={{ background: bg, border: t === undefined ? '1px dashed rgba(255,255,255,0.2)' : `1px solid ${here ? '#fff' : 'transparent'}`, boxShadow: here ? '0 0 0 2px rgba(34,211,238,0.5)' : undefined }} />
        )
      })}
    </div>
  )

  const rows = isOrigin ? originCols : arriving
  // Solo se pueden incorporar columnas DISPONIBLES en el subproceso de origen del
  // enlace (las que llegaron a él); una columna que no se envió al paso anterior no
  // puede reenviarse desde aquí.
  const sourceCols = op ? columnsAvailableAt(asset, op.process_id, allOps) : originCols
  const notArriving = sourceCols.filter((c) => !arrivingNames.has(c.name))

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: isOrigin ? 'rgba(34,211,238,0.12)' : 'rgba(148,163,184,0.12)', color: isOrigin ? '#67e8f9' : '#cbd5e1' }}>
          {isOrigin ? <Home size={11} /> : <MapPin size={11} />}{KIND_LABEL[stage.kind]}
        </span>
        <span className="text-gray-500">{isOrigin ? 'Tratamiento base del activo en su proceso.' : 'Tratamiento que reciben aquí las columnas que llegan.'}</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-[11.5px] text-gray-400 py-6 text-center">{isOrigin ? 'Este activo no tiene columnas. Agrégalas en su ficha.' : 'Aún no llega ninguna columna a este subproceso. Incorpóralas abajo.'}</p>
      ) : rows.map((c, idx) => {
        const canon = originCols.find((o) => o.name === c.name) ?? c
        return (
          <div key={c.name} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] text-gray-900 flex items-center gap-1.5">
                  {canon.code && <span className="text-[10px] font-mono text-gray-500 shrink-0">{canon.code}</span>}
                  <span className="font-medium truncate">{canon.name}</span>
                </p>
                {canon.description && <p className="text-[10.5px] text-gray-500 mt-0.5 line-clamp-2">{canon.description}</p>}
                <Trail col={canon} />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <select className={sel} value={(isOrigin ? canon.operation : c.operation) ?? ''}
                  onChange={(e) => (isOrigin ? setOriginTreatment(idx, e.target.value) : setLinkTreatment(c.name, e.target.value))}>
                  <option value="">Tratamiento…</option>
                  {ASSET_OPERATIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {!isOrigin && <button onClick={() => removeColFromLink(c.name)} title="Esta columna ya no llega aquí" className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={13} /></button>}
              </div>
            </div>
          </div>
        )
      })}

      {!isOrigin && notArriving.length > 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 p-2.5">
          <p className="text-[9.5px] text-gray-500 uppercase tracking-wide mb-1.5">Incorporar columnas disponibles en el origen del enlace ({notArriving.length})</p>
          <div className="flex flex-wrap gap-1">
            {notArriving.map((c) => (
              <button key={c.name} onClick={() => addColToLink(c)} className="text-[10px] px-1.5 py-0.5 rounded-md border border-dashed border-gray-200 text-gray-500 hover:text-primary-700 hover:border-primary-300 inline-flex items-center gap-1"><Plus size={10} /> {c.name}</button>
            ))}
          </div>
        </div>
      )}

      {!isOrigin && op && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 space-y-2">
          <p className="text-[9.5px] text-gray-500 uppercase tracking-wide">Medio y justificación de la transferencia</p>
          <input value={just} onChange={(e) => setJust(e.target.value)} onBlur={() => commit(arriving)} placeholder="¿Por qué llega este dato aquí?"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44 shrink-0"><CreatableSelect options={mediumOpts} value={medium} onChange={(v) => { setMedium(v); commit(arriving, just, v, mediumDetail) }} onCreateOption={(v) => addCatalogItem('transfer_medium', v)} placeholder="Medio…" /></div>
            <input value={mediumDetail} onChange={(e) => setMediumDetail(e.target.value)} onBlur={() => commit(arriving)} placeholder="Detalle del medio (buzón, ruta, carpeta…)"
              className="flex-1 min-w-[150px] bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500" />
          </div>
        </div>
      )}
    </div>
  )
}
