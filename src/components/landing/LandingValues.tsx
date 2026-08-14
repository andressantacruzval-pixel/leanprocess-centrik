import { Target, Eye } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Value {
  icon: LucideIcon
  title: string
  description: string
}

const values: Value[] = [
  {
    icon: Target,
    title: 'Nuestra Misión',
    description:
      'Ayudar a las organizaciones latinoamericanas a documentar, modelar y optimizar sus procesos de negocio con herramientas inteligentes y accesibles. Eliminamos la complejidad de la gestión por procesos para que cualquier equipo pueda operar con excelencia.',
  },
  {
    icon: Eye,
    title: 'Nuestra Visión',
    description:
      'Ser la plataforma de referencia para la gestión de procesos en Latinoamérica, donde cualquier organización —sin importar su tamaño— pueda operar con excelencia operacional apoyada en inteligencia artificial y comunidad de conocimiento.',
  },
]

export default function LandingValues() {
  return (
    <section aria-labelledby="values-title" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-14 text-center">
        <h2 id="values-title" className="mb-4 text-3xl font-bold text-white md:text-4xl">
          Nuestro compromiso con la excelencia
        </h2>
        <p className="mx-auto max-w-lg text-white/50">
          Construimos LeanProcess con un propósito claro, con integridad y orientados al cliente.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {values.map(({ icon: Icon, title, description }) => (
          <article key={title} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8">
            <div className="mb-4 w-fit rounded-xl bg-cyan-500/10 p-2.5">
              <Icon className="text-cyan-400" size={22} aria-hidden="true" />
            </div>
            <h3 className="mb-3 text-xl font-semibold text-white">{title}</h3>
            <p className="leading-relaxed text-white/50">{description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
