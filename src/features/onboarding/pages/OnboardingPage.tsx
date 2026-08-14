import { useNavigate } from 'react-router-dom'
import { useCompanyStore } from '@/stores/companyStore'
import {
  OnboardingLayout,
  StepCompanyName,
  StepProcessLevels,
  StepOrgLevels,
  StepOrgChart,
  StepDocCode,
} from '@/components/onboarding'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const onboardingStep = useCompanyStore((s) => s.onboardingStep)
  const setOnboardingStep = useCompanyStore((s) => s.setOnboardingStep)
  const completeOnboarding = useCompanyStore((s) => s.completeOnboarding)

  const step = onboardingStep < 1 ? 1 : onboardingStep

  const goNext = () => setOnboardingStep(step + 1)
  const goBack = () => setOnboardingStep(step - 1)

  const handleComplete = async () => {
    await completeOnboarding()
    navigate('/app', { replace: true })
  }

  return (
    <OnboardingLayout currentStep={step}>
      {step === 1 && <StepCompanyName onNext={goNext} />}
      {step === 2 && <StepProcessLevels onNext={goNext} onBack={goBack} />}
      {step === 3 && <StepOrgLevels onNext={goNext} onBack={goBack} />}
      {/* La codificacion se pregunta al final: necesita las areas ya cargadas. */}
      {step === 4 && <StepOrgChart onComplete={goNext} onBack={goBack} />}
      {step === 5 && <StepDocCode onComplete={handleComplete} onBack={goBack} />}
    </OnboardingLayout>
  )
}
