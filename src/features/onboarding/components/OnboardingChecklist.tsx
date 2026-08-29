import { useEffect } from 'react'
import { useOnboardingStore } from '@/features/onboarding/onboardingStore'
import {
  ChevronDown, ChevronUp, X, CheckCircle2, Circle, ArrowRight, Trophy,
} from 'lucide-react'

/** Lo que dura la felicitacion en pantalla antes de retirarse sola. */
const MS_FELICITACION = 8000

export function OnboardingChecklist() {
  const milestones = useOnboardingStore((s) => s.milestones)
  const dismissed = useOnboardingStore((s) => s.dismissed)
  const showChecklist = useOnboardingStore((s) => s.showChecklist)
  const toggleChecklist = useOnboardingStore((s) => s.toggleChecklist)
  const dismiss = useOnboardingStore((s) => s.dismiss)
  const progress = useOnboardingStore((s) => s.progress)
  const setActiveTooltip = useOnboardingStore((s) => s.setActiveTooltip)

  const { completed, total, percent } = progress()
  const todoListo = completed === total

  /**
   * La felicitacion se retira sola.
   *
   * Aqui habia un comentario que prometia «auto-dismiss after first view» y el codigo
   * que lo hacia no existia: la tarjeta se quedaba en el dashboard hasta que alguien
   * pulsara la X, reaparecia en cada recarga, y el boton «Guia de inicio» del sidebar
   * la volvia a abrir. Felicitar por haber terminado y luego pedir que cierres el aviso
   * cada vez que entras es lo contrario de una felicitacion.
   *
   * `dismiss()` persiste, asi que se ve una vez y no vuelve.
   */
  useEffect(() => {
    if (dismissed || !todoListo) return
    const t = setTimeout(dismiss, MS_FELICITACION)
    return () => clearTimeout(t)
  }, [dismissed, todoListo, dismiss])

  if (dismissed) return null
  if (todoListo) {
    return (
      <div className="rounded-lg border border-primary-200 p-5 bg-primary-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary-100">
              <Trophy className="text-primary-600" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Lean Process Master</h3>
              <p className="text-[10px] text-gray-500">Has completado todas las funcionalidades</p>
            </div>
          </div>
          <button onClick={dismiss} className="text-gray-300 hover:text-gray-500 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
      {/* Header */}
      <button
        onClick={toggleChecklist}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none" stroke="#22d3ee" strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 15}`}
                strokeDashoffset={`${2 * Math.PI * 15 * (1 - percent / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-primary-600">
              {percent}%
            </span>
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900">Primeros pasos</h3>
            <p className="text-[10px] text-gray-400">{completed} de {total} completados</p>
          </div>
        </div>
        {showChecklist ? <ChevronUp size={16} className="text-gray-300" /> : <ChevronDown size={16} className="text-gray-300" />}
      </button>

      {/* Milestones */}
      {showChecklist && (
        <div className="px-4 pb-4 space-y-1">
          {milestones.map((m) => {
            return (
              <div
                key={m.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  m.completed
                    ? 'bg-emerald-50 opacity-60'
                    : 'hover:bg-gray-50 cursor-pointer group'
                }`}
                onClick={() => {
                  if (!m.completed) {
                    setActiveTooltip(m.id)
                  }
                }}
              >
                {m.completed ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                ) : (
                  <Circle size={16} className="text-gray-300 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${m.completed ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                    {m.title}
                  </p>
                  <p className="text-[11px] text-gray-400">{m.description}</p>
                </div>
                {!m.completed && (
                  <ArrowRight size={12} className="text-gray-300 group-hover:text-primary-600 transition-colors shrink-0" />
                )}
              </div>
            )
          })}

          <button
            onClick={dismiss}
            className="w-full mt-2 text-[10px] text-gray-300 hover:text-gray-500 transition-colors py-1"
          >
            Ocultar guia
          </button>
        </div>
      )}
    </div>
  )
}
