import { ArrowRight } from 'lucide-react'
import { liteSignupUrl } from '@/features/auth/lite'

export default function LandingCtaBand() {
  return (
    <section aria-label="Llamada a la acción" className="mx-auto max-w-6xl px-6 py-8">
      <div className="rounded-lg border border-primary-200 bg-primary-50 px-8 py-16 text-center">
        <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
          Comienza a optimizar tus procesos hoy mismo
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-gray-500">
          Sin tarjeta de crédito. Sin instalación. Empieza gratis en menos de un minuto.
        </p>
        <a
          href={liteSignupUrl}
          className="inline-flex items-center gap-2 rounded-lg px-8 py-3.5 font-medium text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] bg-primary-500 hover:bg-primary-600"
        >
          Empezar ahora gratis <ArrowRight size={18} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}
