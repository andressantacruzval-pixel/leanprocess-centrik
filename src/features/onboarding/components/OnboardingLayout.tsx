import { OnboardingStepper } from './OnboardingStepper'

interface OnboardingLayoutProps {
  currentStep: number
  children: React.ReactNode
}

export function OnboardingLayout({ currentStep, children }: OnboardingLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-ground flex flex-col">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-100 px-6 py-4">
        <h1 className="text-xl font-bold text-primary-600 text-center">
          Lean Process
        </h1>
      </div>

      {/* Stepper */}
      <div className="bg-gray-50 border-b border-gray-100 px-4">
        <OnboardingStepper currentStep={currentStep} />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col py-8">
        {children}
      </div>
    </div>
  )
}
