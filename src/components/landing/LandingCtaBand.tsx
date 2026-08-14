import { ArrowRight } from 'lucide-react'
import { liteSignupUrl } from '@/features/auth/lite'

export default function LandingCtaBand() {
  return (
    <section aria-label="Llamada a la acción" className="mx-auto max-w-6xl px-6 py-8">
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-8 py-16 text-center">
        <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
          Comienza a optimizar tus procesos hoy mismo
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-white/50">
          Sin tarjeta de crédito. Sin instalación. Empieza gratis en menos de un minuto.
        </p>
        <a
          href={liteSignupUrl}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3.5 font-medium text-white shadow-[0_0_24px_rgba(6,182,212,0.25)] transition-all duration-200 hover:scale-[1.02] hover:from-cyan-400 hover:to-blue-500 hover:shadow-[0_0_36px_rgba(6,182,212,0.45)] active:scale-[0.99]"
        >
          Empezar ahora gratis <ArrowRight size={18} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}
