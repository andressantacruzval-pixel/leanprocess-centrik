import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useOnboardingStore } from '@/features/onboarding/onboardingStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { X, ArrowRight, ArrowLeft, CheckCircle2, MousePointer2 } from 'lucide-react'
import { TOURS } from '@/features/onboarding/tourSteps'
export type { TourStep } from '@/features/onboarding/tourSteps'

export function GuidedTour() {
  const navigate = useNavigate()
  const location = useLocation()
  const activeTour = useOnboardingStore((s) => s.activeTooltip)
  const setActiveTour = useOnboardingStore((s) => s.setActiveTooltip)
  const completeMilestone = useOnboardingStore((s) => s.completeMilestone)
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId)

  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  /**
   * Alto real del tooltip. Antes se estimaba en 200px y el tooltip real pasa de 260
   * con titulo, texto, aviso y botonera: la fila «Anterior / Siguiente» acababa fuera
   * de la pantalla en viewports bajos.
   *
   * Se mide con una ref de CALLBACK, no leyendo `ref.current` en el render —eso es
   * acceder a una ref durante el render, que React prohibe y el linter caza. El
   * callback corre en el commit, cuando el nodo ya existe y medirlo es legal.
   */
  const [altoTooltip, setAltoTooltip] = useState(260)
  const medirTooltip = useCallback((nodo: HTMLDivElement | null) => {
    if (nodo) setAltoTooltip(nodo.offsetHeight)
  }, [])

  const steps = activeTour ? TOURS[activeTour] || [] : []
  const step = steps[currentStep]

  // Measure target element position
  const measureTarget = useCallback(() => {
    if (!step) return
    const el = document.querySelector(step.target)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    } else {
      setTargetRect(null)
    }
  }, [step])

  // Navigate + measure on step change
  useEffect(() => {
    if (!step) return
    if (step.route && location.pathname !== step.route) {
      navigate(step.route)
      const t = setTimeout(measureTarget, 600)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(measureTarget, 300)
      return () => clearTimeout(t)
    }
  }, [step, currentStep, location.pathname, measureTarget, navigate])

  // Re-measure on resize
  useEffect(() => {
    if (!step) return
    window.addEventListener('resize', measureTarget)
    return () => window.removeEventListener('resize', measureTarget)
  }, [measureTarget, step])

  const closeTour = useCallback(() => {
    setActiveTour(null)
    setCurrentStep(0)
    setTargetRect(null)
  }, [setActiveTour, setCurrentStep])

  const nextStep = useCallback(() => {
    if (step?.completeMilestone) completeMilestone(step.completeMilestone, { companyId: activeCompanyId ?? undefined })
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      closeTour()
    }
  }, [currentStep, steps.length, step, closeTour, completeMilestone, activeCompanyId, setCurrentStep])

  const prevStep = useCallback(() => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }, [currentStep])

  // Handle click on spotlight target
  useEffect(() => {
    if (!step?.clickToAdvance || !targetRect) return
    const el = document.querySelector(step.target)
    if (!el) return
    const handler = () => { setTimeout(nextStep, 200) }
    el.addEventListener('click', handler, { once: true })
    return () => el.removeEventListener('click', handler)
  }, [step, targetRect, nextStep])

  if (!activeTour || !step || steps.length === 0) return null

  // ── Tooltip positioning ───────────────────────────────────────────────

  const padding = 12
  // Ancho fluido con techo. Era una constante de 340px: ocupaba el 91% de una pantalla
  // de 375 —tapando el propio elemento que el tour senala— y a 320px desbordaba 75px,
  // porque el clamp inferior (10) ganaba al superior, que salia negativo.
  const tooltipW = Math.min(340, window.innerWidth - 20)
  const tooltipStyle: React.CSSProperties = { position: 'fixed', zIndex: 10002, width: tooltipW }

  if (targetRect) {
    const placement = step.placement || 'bottom'
    const cx = targetRect.left + targetRect.width / 2
    const cy = targetRect.top + targetRect.height / 2

    const clampX = (x: number) =>
      Math.max(10, Math.min(x, Math.max(10, window.innerWidth - tooltipW - 10)))
    const altura = altoTooltip
    const clampY = (y: number) =>
      Math.max(10, Math.min(y, Math.max(10, window.innerHeight - altura - 10)))

    switch (placement) {
      case 'bottom':
        tooltipStyle.left = clampX(cx - tooltipW / 2)
        tooltipStyle.top = clampY(targetRect.bottom + padding)
        break
      case 'top':
        tooltipStyle.left = clampX(cx - tooltipW / 2)
        tooltipStyle.top = Math.max(10, targetRect.top - padding - altura)
        break
      case 'right': {
        const rightX = targetRect.right + padding
        if (rightX + tooltipW > window.innerWidth - 10) {
          tooltipStyle.left = clampX(targetRect.left - tooltipW - padding)
        } else {
          tooltipStyle.left = rightX
        }
        tooltipStyle.top = clampY(cy - 60)
        break
      }
      case 'left': {
        const leftX = targetRect.left - tooltipW - padding
        if (leftX < 10) {
          tooltipStyle.left = clampX(targetRect.right + padding)
        } else {
          tooltipStyle.left = leftX
        }
        tooltipStyle.top = clampY(cy - 60)
        break
      }
    }
  } else {
    tooltipStyle.left = Math.max(10, window.innerWidth / 2 - tooltipW / 2)
    tooltipStyle.top = Math.max(10, window.innerHeight / 2 - 80)
  }

  return (
    <>
      {/* Overlay with spotlight cutout */}
      <div ref={overlayRef} className="fixed inset-0 z-[10000]" style={{ pointerEvents: 'none' }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={targetRect.left - 6} y={targetRect.top - 6}
                  width={targetRect.width + 12} height={targetRect.height + 12}
                  rx={8} fill="black"
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#spotlight-mask)" />
        </svg>

        {targetRect && (
          <div
            className="absolute border-2 border-primary-500 rounded-lg animate-pulse"
            style={{
              left: targetRect.left - 6, top: targetRect.top - 6,
              width: targetRect.width + 12, height: targetRect.height + 12,
              boxShadow: '0 0 20px rgba(34,211,238,0.4), 0 0 60px rgba(34,211,238,0.1)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Clickable area on the target */}
      {targetRect && (
        <div
          className="fixed z-[10001] cursor-pointer"
          style={{
            left: targetRect.left - 6, top: targetRect.top - 6,
            width: targetRect.width + 12, height: targetRect.height + 12,
          }}
          onClick={() => {
            const el = document.querySelector(step.target) as HTMLElement
            if (el) el.click()
            if (step.clickToAdvance) setTimeout(nextStep, 200)
          }}
        />
      )}

      {/* Tooltip card */}
      <div key={currentStep} ref={medirTooltip} style={tooltipStyle} className="pointer-events-auto">
        <div className="bg-white border border-primary-300 rounded-lg shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-gray-50">
            <div
              className="h-full transition-all duration-300 bg-primary-500"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] text-primary-600 uppercase tracking-wider font-semibold">
                Paso {currentStep + 1} de {steps.length}
              </span>
              <button onClick={closeTour} className="p-1 text-gray-300 hover:text-gray-500 transition-colors">
                <X size={14} />
              </button>
            </div>

            <h3 className="text-sm font-bold text-gray-900 mb-1">{step.title}</h3>
            <p className="text-[13px] text-gray-700 leading-relaxed mb-4">{step.content}</p>

            {step.clickToAdvance && targetRect && (
              <div className="flex items-center gap-2 mb-3 bg-primary-50 rounded-lg px-3 py-2 border border-primary-200">
                <MousePointer2 size={14} className="text-primary-600 animate-bounce" />
                <span className="text-[10px] text-primary-600 font-medium">Haz clic en el elemento resaltado</span>
              </div>
            )}

            {!targetRect && (
              <div className="flex items-center gap-2 mb-3 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                <span className="text-[10px] text-amber-600 font-medium">
                  Navega manualmente a esta seccion y luego avanza al siguiente paso.
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={prevStep}
                disabled={currentStep === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium text-gray-400 hover:text-gray-600 disabled:opacity-20 transition-colors"
              >
                <ArrowLeft size={12} /> Anterior
              </button>

              {!step.clickToAdvance && (
                <button
                  onClick={nextStep}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[10px] font-medium text-white transition-all shadow-lg bg-primary-500 hover:bg-primary-600"
                >
                  {currentStep === steps.length - 1 ? (
                    <><CheckCircle2 size={12} /> Completar</>
                  ) : (
                    <>Siguiente <ArrowRight size={12} /></>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
