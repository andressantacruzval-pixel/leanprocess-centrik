import { ArrowRight, Sparkles } from 'lucide-react'
import { liteLoginUrl, liteSignupUrl } from '@/features/auth/lite'

const stats = [
  { value: 'BPMN 2.0', label: 'compatible con Bizagi' },
  { value: 'IA integrada', label: 'generación automática' },
  { value: '10+', label: 'herramientas incluidas' },
]

export default function LandingHero() {
  return (
    <section aria-labelledby="hero-title" className="mx-auto max-w-6xl px-6 py-24 text-center">
      <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary-300 bg-primary-50 px-4 py-1.5 text-sm text-primary-600">
        <Sparkles size={14} aria-hidden="true" />
        Plataforma todo-en-uno con inteligencia artificial
      </span>

      <h1
        id="hero-title"
        className="mb-6 text-5xl font-bold leading-tight text-gray-900 md:text-7xl"
      >
        Gestión de procesos{' '}
        <span className="text-primary-500">
          simplificada con IA
        </span>
      </h1>

      <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-500">
        Documenta, modela y optimiza tus procesos de negocio con herramientas inteligentes.
        Desde el mapa de procesos hasta diagramas BPMN, todo en un solo lugar.
      </p>

      <div className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a
          href={liteSignupUrl}
          className="flex items-center gap-2 rounded-lg px-8 py-3.5 font-medium text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] bg-primary-500 hover:bg-primary-600"
        >
          Comenzar ahora <ArrowRight size={18} aria-hidden="true" />
        </a>
        <a
          href={liteLoginUrl}
          className="rounded-lg border border-gray-200 px-8 py-3.5 font-medium text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
        >
          Ya tengo cuenta
        </a>
      </div>

      <dl className="flex flex-col items-center justify-center gap-10 sm:flex-row">
        {stats.map(({ value, label }) => (
          <div key={label} className="text-center">
            <dd className="text-2xl font-bold text-gray-900">{value}</dd>
            <dt className="mt-0.5 text-sm text-gray-500">{label}</dt>
          </div>
        ))}
      </dl>
    </section>
  )
}
