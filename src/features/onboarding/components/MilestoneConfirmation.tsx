import { useOnboardingStore } from '@/features/onboarding/onboardingStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { CheckCircle2, X } from 'lucide-react'

export function MilestoneConfirmation() {
  const pendingConfirmation = useOnboardingStore((s) => s.pendingConfirmation)
  const milestones = useOnboardingStore((s) => s.milestones)
  const confirmAndComplete = useOnboardingStore((s) => s.confirmAndComplete)
  const cancelConfirmation = useOnboardingStore((s) => s.cancelConfirmation)
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId)

  if (!pendingConfirmation) return null

  const milestone = milestones.find((m) => m.id === pendingConfirmation)
  if (!milestone) return null

  return (
    <div className="fixed inset-0 z-[10010] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={cancelConfirmation}
      />

      {/* Modal — `w-full max-w-[400px]`, no `w-[400px]`: el ancho fijo era mas ancho
          que un iPhone SE. Y con tope de alto, que en movil apaisado no cabia. */}
      <div className="relative w-full max-w-[400px] max-h-[85vh] flex flex-col bg-[#0d1420] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top accent */}
        <div className="h-1 shrink-0 bg-gradient-to-r from-cyan-500 to-emerald-500" />

        <div className="p-6 overflow-y-auto">
          {/* Close */}
          <button
            onClick={cancelConfirmation}
            aria-label="Cerrar"
            className="absolute top-2 right-2 p-2.5 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>

          {/* Icon */}
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4 mx-auto">
            <CheckCircle2 className="text-emerald-400" size={28} />
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-white text-center mb-1">
            Hito detectado
          </h3>

          {/* Milestone name */}
          <p className="text-sm text-cyan-400 font-semibold text-center mb-2">
            {milestone.title}
          </p>

          {/* Description */}
          <p className="text-[12px] text-white/50 text-center mb-6 leading-relaxed">
            Parece que completaste este paso: <span className="text-white/70">{milestone.description}</span>.
            <br />
            Confirmas que esta listo?
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={cancelConfirmation}
              className="flex-1 px-4 py-2.5 rounded-xl text-[12px] font-medium text-white/40 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white/60 transition-all"
            >
              Aun no
            </button>
            <button
              onClick={() => confirmAndComplete(pendingConfirmation, activeCompanyId ?? undefined)}
              className="flex-1 px-4 py-2.5 rounded-xl text-[12px] font-bold text-white bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 transition-all shadow-lg shadow-emerald-500/20"
            >
              Si, esta listo!
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
