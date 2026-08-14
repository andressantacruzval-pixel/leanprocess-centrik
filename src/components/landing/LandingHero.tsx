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
      <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-400">
        <Sparkles size={14} aria-hidden="true" />
        Plataforma todo-en-uno con inteligencia artificial
      </span>

      <h1
        id="hero-title"
        className="mb-6 text-5xl font-bold leading-tight text-white md:text-7xl"
      >
        Gestión de procesos{' '}
        <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          simplificada con IA
        </span>
      </h1>

      <p className="mx-auto mb-10 max-w-2xl text-lg text-white/50">
        Documenta, modela y optimiza tus procesos de negocio con herramientas inteligentes.
        Desde el mapa de procesos hasta diagramas BPMN, todo en un solo lugar.
      </p>

      <div className="mb-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <a
          href={liteSignupUrl}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3.5 font-medium text-white shadow-[0_0_24px_rgba(6,182,212,0.25)] transition-all duration-200 hover:scale-[1.02] hover:from-cyan-400 hover:to-blue-500 hover:shadow-[0_0_36px_rgba(6,182,212,0.45)] active:scale-[0.99]"
        >
          Comenzar ahora <ArrowRight size={18} aria-hidden="true" />
        </a>
        <a
          href={liteLoginUrl}
          className="rounded-xl border border-white/10 px-8 py-3.5 font-medium text-white/70 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
        >
          Ya tengo cuenta
        </a>
      </div>

      <dl className="flex flex-col items-center justify-center gap-10 sm:flex-row">
        {stats.map(({ value, label }) => (
          <div key={label} className="text-center">
            <dd className="text-2xl font-bold text-white">{value}</dd>
            <dt className="mt-0.5 text-sm text-white/40">{label}</dt>
          </div>
        ))}
      </dl>
    </section>
  )
}
