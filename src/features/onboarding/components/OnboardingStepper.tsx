import { Check } from 'lucide-react'

const steps = [
  { number: 1, label: 'Empresa' },
  { number: 2, label: 'Niveles de Procesos' },
  { number: 3, label: 'Estructura Org.' },
  { number: 4, label: 'Organigrama' },
  { number: 5, label: 'Codificacion' },
]

interface OnboardingStepperProps {
  currentStep: number
}

/**
 * Los cuatro pasos del alta.
 *
 * La versión completa pedía ~520px de ancho mínimo (4 círculos de 40px + 3 conectores
 * de 64px + etiquetas con `whitespace-nowrap` como «Niveles de Procesos»), sin envolver
 * y dentro de un padre con `px-4`. Es la PRIMERA pantalla que ve alguien, y desbordaba.
 *
 * Por debajo de `sm` se sustituye por la versión que cabe: el paso actual y una barra
 * de avance. Es la misma información —dónde estoy y cuánto queda— sin fingir que los
 * cuatro rótulos entran en 375px.
 */
export function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
  const actual = steps.find((s) => s.number === currentStep) ?? steps[0]

  return (
    <>
      {/* Compacto — móvil */}
      <div className="sm:hidden w-full max-w-2xl mx-auto py-6">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm font-semibold text-cyan-400">{actual.label}</span>
          <span className="text-xs text-white/40">
            Paso {currentStep} de {steps.length}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-cyan-400 transition-all duration-300"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Completo — a partir de sm */}
      <div className="hidden sm:flex items-center justify-center gap-2 w-full max-w-2xl mx-auto py-6">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.number
          const isCurrent = currentStep === step.number
          const isFuture = currentStep < step.number

          return (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-cyan-500 text-white'
                      : isCurrent
                      ? 'bg-cyan-500 text-white ring-4 ring-cyan-500/20'
                      : 'bg-white/20 text-white/40'
                  }`}
                >
                  {isCompleted ? <Check size={18} /> : step.number}
                </div>
                <span
                  className={`mt-2 text-xs font-medium text-center ${
                    isCurrent || isCompleted ? 'text-cyan-400' : 'text-white/20'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-8 lg:w-16 h-0.5 mx-2 mb-6 transition-all duration-300 ${
                    isFuture ? 'bg-white/20' : 'bg-cyan-400'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
