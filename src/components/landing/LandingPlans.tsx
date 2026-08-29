import { Check, ArrowRight } from 'lucide-react'
import { SOPORTE_WHATSAPP } from '@/lib/soporte'

const planFeatures = [
  '1 empresa / workspace',
  '1,000 tokens de IA mensuales',
  'Generación con IA: procedimientos, BPMN y SIPOC',
  'Mapa de procesos interactivo',
  'Comunidad Process Masters',
  'Exportación a PDF y Word',
]

export default function LandingPlans() {
  return (
    <section id="plans" aria-labelledby="plans-title" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-14 text-center">
        <h2 id="plans-title" className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
          Empieza a optimizar tus procesos
        </h2>
        <p className="mx-auto max-w-lg text-gray-500">
          Obtén acceso a todas las herramientas esenciales con un plan mensual flexible.
        </p>
      </div>

      <div className="flex justify-center">
        <article
          aria-label="Plan Community"
          className="w-full max-w-md rounded-lg border border-primary-300 bg-gray-50 p-8 transition-all duration-300 hover:border-primary-300"
        >
          <header className="mb-6">
            <span className="mb-4 inline-block rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-600">
              Plan mensual
            </span>
            <p className="text-3xl font-bold text-gray-900">Plan Community</p>
          </header>

          <hr className="mb-6 border-gray-100" />

          <ul role="list" className="mb-8 space-y-3">
            {planFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <Check className="mt-0.5 shrink-0 text-primary-600" size={16} aria-hidden="true" />
                <span className="text-sm text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>

          <a
            href={SOPORTE_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg py-3.5 font-medium text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] bg-primary-500 hover:bg-primary-600"
          >
            Contáctanos para más información <ArrowRight size={18} aria-hidden="true" />
          </a>
          <p className="text-center text-xs text-gray-400">
            Contáctanos y te damos todos los detalles del plan
          </p>
        </article>
      </div>
    </section>
  )
}
