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
        <h2 id="plans-title" className="mb-4 text-3xl font-bold text-white md:text-4xl">
          Empieza a optimizar tus procesos
        </h2>
        <p className="mx-auto max-w-lg text-white/50">
          Obtén acceso a todas las herramientas esenciales con un plan mensual flexible.
        </p>
      </div>

      <div className="flex justify-center">
        <article
          aria-label="Plan Community"
          className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-white/[0.03] p-8 transition-all duration-300 hover:border-cyan-500/50 hover:shadow-[0_0_40px_rgba(6,182,212,0.1)]"
        >
          <header className="mb-6">
            <span className="mb-4 inline-block rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-400">
              Plan mensual
            </span>
            <p className="text-3xl font-bold text-white">Plan Community</p>
          </header>

          <hr className="mb-6 border-white/[0.06]" />

          <ul role="list" className="mb-8 space-y-3">
            {planFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <Check className="mt-0.5 shrink-0 text-cyan-400" size={16} aria-hidden="true" />
                <span className="text-sm text-white/70">{feature}</span>
              </li>
            ))}
          </ul>

          <a
            href={SOPORTE_WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3.5 font-medium text-white shadow-[0_0_24px_rgba(6,182,212,0.25)] transition-all duration-200 hover:scale-[1.02] hover:from-cyan-400 hover:to-blue-500 hover:shadow-[0_0_36px_rgba(6,182,212,0.45)] active:scale-[0.99]"
          >
            Contáctanos para más información <ArrowRight size={18} aria-hidden="true" />
          </a>
          <p className="text-center text-xs text-white/30">
            Contáctanos y te damos todos los detalles del plan
          </p>
        </article>
      </div>
    </section>
  )
}
