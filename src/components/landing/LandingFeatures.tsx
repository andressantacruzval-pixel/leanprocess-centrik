import { Map, Layers, GitBranch, Sparkles, FileText, BarChart2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: Map,
    title: 'Mapa de Procesos',
    description:
      'Visualiza macroprocesos organizados por categoría: estratégicos, productivos y de apoyo, con jerarquía completa.',
  },
  {
    icon: Layers,
    title: 'Niveles Configurables',
    description:
      'Define tu propia jerarquía de procesos, subprocesos y actividades según las necesidades de tu organización.',
  },
  {
    icon: GitBranch,
    title: 'Editor BPMN',
    description:
      'Modela diagramas de flujo con un editor visual intuitivo compatible con Bizagi. Exporta en formato estándar.',
  },
  {
    icon: Sparkles,
    title: 'Inteligencia Artificial',
    description:
      'Genera descripciones, análisis SIPOC y diagramas BPMN completos con IA en segundos, sin experiencia previa.',
  },
  {
    icon: FileText,
    title: 'Procedimientos',
    description:
      'Documenta paso a paso cada proceso con instrucciones claras, responsables, evidencias y controles.',
  },
  {
    icon: BarChart2,
    title: 'KPIs y Riesgos',
    description:
      'Define indicadores clave de desempeño, mide resultados e identifica y controla riesgos operacionales.',
  },
]

export default function LandingFeatures() {
  return (
    <section id="features" aria-labelledby="features-title" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-14 text-center">
        <h2 id="features-title" className="mb-4 text-3xl font-bold text-white md:text-4xl">
          Soluciones para el crecimiento acelerado de tus procesos
        </h2>
        <p className="mx-auto max-w-xl text-white/50">
          Todo lo que necesitas para gestionar, documentar y optimizar los procesos de tu organización.
        </p>
      </div>

      <ul role="list" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <li key={title}>
            <article className="group h-full rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 transition-all duration-200 hover:border-white/[0.12] hover:shadow-[0_0_24px_rgba(6,182,212,0.06)]">
              <div className="mb-4 w-fit rounded-xl bg-cyan-500/10 p-2.5 transition-colors duration-200 group-hover:bg-cyan-500/20">
                <Icon className="text-cyan-400" size={22} aria-hidden="true" />
              </div>
              <h3 className="mb-2 font-semibold text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-white/50">{description}</p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
