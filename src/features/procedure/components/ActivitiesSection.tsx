import { useState } from 'react'
import { Plus, Trash2, AlertTriangle, Sparkles, Loader2, X } from 'lucide-react'
import type { ProcedureActivity } from '@/lib/claude'
import { ACCIONES_AL_PASAR } from '@/lib/constants'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import { EditableText } from './EditableText'

interface ActivitiesSectionProps {
  actividades: ProcedureActivity[]
  updateActivity: (index: number, updates: Partial<ProcedureActivity>) => void
  addActivity: () => void
  removeActivity: (index: number) => void
  /** Enriquece la actividad con IA (consume tokens). Devuelve true si tuvo éxito. */
  onEnrich?: (index: number, instruction: string) => Promise<boolean>
}

export function ActivitiesSection({
  actividades,
  updateActivity,
  addActivity,
  removeActivity,
  onEnrich,
}: ActivitiesSectionProps) {
  // Panel de detalle IA por actividad: qué fila está abierta, el texto y el estado.
  const [aiIdx, setAiIdx] = useState<number | null>(null)
  const [instruction, setInstruction] = useState('')
  const [enriching, setEnriching] = useState(false)

  const openAi = (i: number) => { setAiIdx(i); setInstruction('') }
  const closeAi = () => { setAiIdx(null); setInstruction(''); setEnriching(false) }

  const runEnrich = async (i: number) => {
    if (!onEnrich || !instruction.trim() || enriching) return
    setEnriching(true)
    const ok = await onEnrich(i, instruction.trim())
    setEnriching(false)
    if (ok) closeAi()
  }

  return (
    <div className="space-y-0">
      {actividades.map((activity, i) => (
        <div
          key={i}
          className={`group border-l-4 ${activity.esDecision ? 'border-l-amber-500 bg-amber-100' : 'border-l-blue-500 bg-transparent'} py-4 pl-5 pr-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              {/* Activity number + name */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${activity.esDecision ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {i + 1}
                </span>
                <EditableText
                  value={activity.nombre}
                  onChange={v => updateActivity(i, { nombre: v })}
                  className="text-gray-900 text-[13px] font-semibold"
                  placeholder="Nombre de la actividad..."
                />
                {activity.esDecision && (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                )}
              </div>

              {/* Executor */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Responsable:</span>
                <EditableText
                  value={activity.ejecutor}
                  onChange={v => updateActivity(i, { ejecutor: v })}
                  className="text-gray-600 text-[12px] font-medium"
                  placeholder="Rol / cargo..."
                />
              </div>

              {/* Description */}
              <EditableText
                value={activity.descripcion}
                onChange={v => updateActivity(i, { descripcion: v })}
                className="text-gray-600 text-[12px] leading-relaxed"
                multiline
                placeholder="Descripcion detallada de la actividad..."
              />

              {/* Decision logic */}
              {activity.esDecision && (
                <div className="mt-2 p-2.5 bg-amber-100 border border-amber-500 rounded-md">
                  <p className="text-[9px] uppercase tracking-wider font-bold text-amber-600 mb-1">Logica de Decision</p>
                  <EditableText
                    value={activity.decisiones}
                    onChange={v => updateActivity(i, { decisiones: v })}
                    className="text-amber-800 text-[12px]"
                    placeholder="SI: ... / NO: ..."
                  />
                </div>
              )}

              {/* Panel de detalle con IA */}
              {aiIdx === i && onEnrich && (
                <div className="mt-2.5 p-2.5 rounded-lg border border-primary-500 bg-primary-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-primary-700 uppercase tracking-wider">
                      <Sparkles className="w-3 h-3" /> Detallar con IA
                    </span>
                    <button onClick={closeAi} title="Cerrar" className="text-primary-600 hover:text-primary-700 p-1 -m-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    rows={2}
                    autoFocus
                    disabled={enriching}
                    placeholder="¿Qué quieres detallar o agregar? Ej.: incluye los sistemas usados, criterios de aceptación y qué pasa si falla."
                    className="w-full px-2.5 py-2 text-[12px] text-gray-700 bg-white border border-primary-500 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none disabled:opacity-60"
                  />
                  <div className="flex items-center justify-end gap-2 mt-2">
                    <button
                      onClick={() => runEnrich(i)}
                      disabled={!instruction.trim() || enriching}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-[11px] font-medium transition-all disabled:opacity-40 bg-primary-500 hover:bg-primary-600"
                    >
                      {enriching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {enriching ? 'Generando...' : 'Generar detalle'}
                      <span className="text-gray-800"><TokenCostBadge operationKey="activity_detail" className="text-gray-800" /></span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Acciones — siempre en el DOM: ver ACCIONES_AL_PASAR */}
            <div className={`flex flex-col gap-1 shrink-0 ${ACCIONES_AL_PASAR}`}>
              {onEnrich && (
                <button
                  onClick={() => (aiIdx === i ? closeAi() : openAi(i))}
                  title="Detallar esta actividad con IA (5 tokens)"
                  className={`p-2 rounded ${aiIdx === i ? 'text-primary-600 bg-primary-100' : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'}`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => updateActivity(i, { esDecision: !activity.esDecision })}
                title={activity.esDecision ? 'Quitar decision' : 'Marcar como decision'}
                className={`p-2 rounded ${activity.esDecision ? 'text-amber-600 bg-amber-100' : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'}`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => removeActivity(i)} title="Eliminar actividad" className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {actividades.length === 0 && (
        <p className="py-6 text-center text-gray-400 text-xs italic">Sin actividades registradas</p>
      )}

      <button onClick={addActivity} className="mt-3 flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium">
        <Plus className="w-3 h-3" /> Agregar actividad
      </button>
    </div>
  )
}
