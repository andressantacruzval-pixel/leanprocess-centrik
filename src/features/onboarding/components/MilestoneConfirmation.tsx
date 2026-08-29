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
        className="absolute inset-0 bg-gray-900/45"
        onClick={cancelConfirmation}
      />

      {/* Modal — `w-full max-w-[400px]`, no `w-[400px]`: el ancho fijo era mas ancho
          que un iPhone SE. Y con tope de alto, que en movil apaisado no cabia. */}
      <div className="relative w-full max-w-[400px] max-h-[85vh] flex flex-col bg-white border border-primary-300 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top accent */}
        <div className="h-1 shrink-0 bg-primary-500" />

        <div className="p-6 overflow-y-auto">
          {/* Close */}
          <button
            onClick={cancelConfirmation}
            aria-label="Cerrar"
            className="absolute top-2 right-2 p-2.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <X size={16} />
          </button>

          {/* Icon */}
          <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-emerald-50 border border-emerald-200 mb-4 mx-auto">
            <CheckCircle2 className="text-emerald-600" size={28} />
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-gray-900 text-center mb-1">
            Hito detectado
          </h3>

          {/* Milestone name */}
          <p className="text-sm text-primary-600 font-semibold text-center mb-2">
            {milestone.title}
          </p>

          {/* Description */}
          <p className="text-[12px] text-gray-500 text-center mb-6 leading-relaxed">
            Parece que completaste este paso: <span className="text-gray-700">{milestone.description}</span>.
            <br />
            Confirmas que esta listo?
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={cancelConfirmation}
              className="flex-1 px-4 py-2.5 rounded-lg text-[12px] font-medium text-gray-500 bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:text-gray-600 transition-all"
            >
              Aun no
            </button>
            <button
              onClick={() => confirmAndComplete(pendingConfirmation, activeCompanyId ?? undefined)}
              className="flex-1 px-4 py-2.5 rounded-lg text-[12px] font-bold text-white transition-all shadow-lg bg-primary-500 hover:bg-primary-600"
            >
              Si, esta listo!
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
