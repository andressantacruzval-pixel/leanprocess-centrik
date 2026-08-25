import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Route, ChevronLeft, ChevronRight, LayoutGrid, ListTree } from 'lucide-react'
import { useAssetStore } from '@/stores/assetStore'
import { useProcessStore } from '@/stores/processStore'
import type { InformationAsset } from '@/types/asset'
import { buildStages, KIND_LABEL } from './assetLifecycle'
import { AssetLifecycleMatrix } from './AssetLifecycleMatrix'
import { AssetStageEditor } from './AssetStageEditor'

interface Props {
  asset: InformationAsset
  initialProcId?: string | null
  onClose: () => void
}

// Ciclo de vida del dato: recorrido de un activo por sus subprocesos. Vista
// «Por subproceso» (stepper con barra de navegación inferior para editar el
// tratamiento de cada columna en cada subproceso) y vista «Matriz» (resumen).
export function AssetLifecycleModal({ asset, initialProcId, onClose }: Props) {
  const liveAsset = useAssetStore((s) => s.assets.find((a) => a.id === asset.id)) ?? asset
  const allOps = useAssetStore((s) => s.operations)
  const processes = useProcessStore((s) => s.processes)

  const stages = useMemo(() => buildStages(liveAsset, allOps, processes), [liveAsset, allOps, processes])
  const [mode, setMode] = useState<'stepper' | 'matrix'>('stepper')
  const [idx, setIdx] = useState(() => {
    const i = initialProcId ? stages.findIndex((s) => s.procId === initialProcId) : 0
    return i >= 0 ? i : 0
  })
  const safeIdx = Math.min(idx, Math.max(0, stages.length - 1))
  const stage = stages[safeIdx]
  const goToStage = (procId: string) => { const i = stages.findIndex((s) => s.procId === procId); if (i >= 0) { setIdx(i); setMode('stepper') } }

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`bg-[#0d1420] rounded-2xl shadow-xl w-full ${mode === 'matrix' ? 'max-w-4xl' : 'max-w-2xl'} max-h-[88vh] flex flex-col border border-white/10`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Route size={15} className="text-cyan-400" /><h3 className="text-sm font-semibold text-white truncate">Ciclo de vida · {liveAsset.name}</h3></div>
            <p className="text-[11px] text-white/40 mt-0.5">Cómo viaja cada columna por los subprocesos y qué tratamiento recibe en cada uno.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              <button onClick={() => setMode('stepper')} className={`inline-flex items-center gap-1 px-2 py-1.5 text-[10.5px] ${mode === 'stepper' ? 'bg-cyan-500/20 text-cyan-200' : 'text-white/50 hover:bg-white/5'}`}><ListTree size={12} /> Por subproceso</button>
              <button onClick={() => setMode('matrix')} className={`inline-flex items-center gap-1 px-2 py-1.5 text-[10.5px] ${mode === 'matrix' ? 'bg-cyan-500/20 text-cyan-200' : 'text-white/50 hover:bg-white/5'}`}><LayoutGrid size={12} /> Matriz</button>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60"><X size={18} /></button>
          </div>
        </div>

        {mode === 'matrix' ? (
          <AssetLifecycleMatrix asset={liveAsset} stages={stages} onGoToStage={goToStage} />
        ) : !stage ? (
          <p className="text-[12px] text-white/40 p-8 text-center">Este activo no tiene recorrido registrado.</p>
        ) : (
          <>
            {/* Encabezado de la etapa actual */}
            <div className="px-5 py-2.5 border-b border-white/5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide" style={{ color: stage.kind === 'origin' ? '#67e8f9' : '#94a3b8' }}>{KIND_LABEL[stage.kind]}</span>
                <span className="text-[14px] font-semibold text-white">{stage.name}</span>
              </div>
            </div>
            <AssetStageEditor key={stage.procId} asset={liveAsset} stage={stage} stages={stages} onGoToStage={goToStage} />
          </>
        )}

        {/* Barra de navegación inferior entre subprocesos */}
        {mode === 'stepper' && stages.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-white/5 shrink-0">
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={safeIdx === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={14} /> Anterior</button>
            <div className="flex-1 overflow-x-auto">
              <div className="flex items-center gap-1.5 justify-center min-w-min px-1">
                {stages.map((s, i) => (
                  <button key={s.procId} onClick={() => setIdx(i)} title={s.name}
                    className={`px-2 py-1 rounded-lg text-[10.5px] whitespace-nowrap border transition-colors ${i === safeIdx ? 'bg-cyan-500/20 text-cyan-100 border-cyan-500/40' : 'text-white/50 border-white/8 hover:bg-white/5'}`}>
                    <span className="opacity-60 mr-1">{i + 1}.</span>{s.name}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setIdx((i) => Math.min(stages.length - 1, i + 1))} disabled={safeIdx >= stages.length - 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed">Siguiente <ChevronRight size={14} /></button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
