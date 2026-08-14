import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

interface FaqItem {
  question: string
  answer: ReactNode
}

const faqs: FaqItem[] = [
  {
    question: '¿Qué es LeanProcess?',
    answer:
      'LeanProcess es una plataforma SaaS de gestión de procesos empresariales. Permite mapear, documentar y optimizar procesos de negocio con herramientas como el editor BPMN, generación de procedimientos con IA, KPIs, análisis de riesgos y análisis de valor, todo en un solo lugar.',
  },
  {
    question: '¿Cómo funciona la inteligencia artificial?',
    answer:
      'La IA de LeanProcess opera mediante un sistema de tokens. Cada acción de IA —generar un diagrama BPMN, crear un procedimiento, analizar riesgos o realizar un análisis SIPOC— consume tokens de tu presupuesto mensual. El plan Community incluye 1,000 tokens al mes, que se renuevan automáticamente.',
  },
  {
    question: '¿El plan Community es realmente gratuito?',
    answer:
      'Sí. El plan Community es completamente gratuito y no tiene fecha de expiración. No se requiere tarjeta de crédito para registrarte. Incluye acceso a todas las funciones esenciales de la plataforma, 1,000 tokens de IA mensuales y acceso inmediato a la comunidad Process Masters.',
  },
  {
    question: '¿Puedo exportar mis procesos y documentos?',
    answer:
      'Sí. LeanProcess permite exportar en múltiples formatos: PDF, Word (.docx), Excel (.xlsx) y PowerPoint (.pptx). También puedes exportar tus diagramas BPMN en formato XML compatible con Bizagi para continuar trabajando en otras herramientas.',
  },
  {
    question: '¿Qué es la comunidad Process Masters?',
    answer: (
      <>
        Process Masters es la comunidad oficial de LeanProcess. Es un espacio donde puedes compartir
        logros, aprender de otros profesionales de procesos, acceder a recursos exclusivos y conectar con
        expertos de toda Latinoamérica.{' '}
        <a
          href="https://process-masters.circle.so"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:underline"
        >
          Únete aquí
        </a>
        .
      </>
    ),
  },
]

export default function LandingFaq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-4xl px-6 py-20">
      <div className="mb-14 text-center">
        <h2 id="faq-title" className="mb-4 text-3xl font-bold text-white md:text-4xl">
          Preguntas frecuentes
        </h2>
        <p className="text-white/50">Todo lo que necesitas saber antes de comenzar.</p>
      </div>

      <div className="space-y-3">
        {faqs.map(({ question, answer }) => (
          <details
            key={question}
            className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] px-6"
          >
            <summary className="flex cursor-pointer select-none list-none items-center justify-between py-5 font-medium text-white">
              <span>{question}</span>
              <ChevronDown
                className="shrink-0 text-white/40 transition-transform duration-200 group-open:rotate-180"
                size={18}
                aria-hidden="true"
              />
            </summary>
            <div className="pb-5 text-sm leading-relaxed text-white/50">{answer}</div>
          </details>
        ))}
      </div>
    </section>
  )
}
