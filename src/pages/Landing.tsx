import LandingHeader from '@/components/landing/LandingHeader'
import LandingHero from '@/components/landing/LandingHero'
import LandingFeatures from '@/components/landing/LandingFeatures'
import LandingCtaBand from '@/components/landing/LandingCtaBand'
import LandingPlans from '@/components/landing/LandingPlans'
import LandingValues from '@/components/landing/LandingValues'
import LandingFaq from '@/components/landing/LandingFaq'
import LandingFooter from '@/components/landing/LandingFooter'

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface-ground">
      <LandingHeader />
      <main id="main-content">
        <LandingHero />
        <LandingFeatures />
        <LandingCtaBand />
        <LandingPlans />
        <LandingValues />
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  )
}
