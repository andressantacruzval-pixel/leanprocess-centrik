import { Map, Building2, ArrowRight, Info, Briefcase } from 'lucide-react'
import type { InvDoc } from '../types'
import { TIPO_COLOR } from '../types'
import { leafAreas } from '../inventoryUtils'

// Paso 1 — Base: todo se LEE de la app. El mapa Nivel 0 (macroprocesos) y las
// áreas (Estructura Organizacional), y el contexto (nombre/sector) del onboarding.
// No se pregunta nada ni se crean áreas: solo se confirma y se pasa al chat.

interface Props {
  companyId: string
  doc: InvDoc
  onNext: () => void
}

const FRANJAS = ['Productivo', 'Apoyo', 'Estratégico'] as const

export function WizardBase({ doc, onNext }: Props) {
  const hojas = leafAreas(doc.areas, doc.macros)
  const P = doc.proyecto

  return (
    <div className="space-y-5">
      <header>
        <div className="text-[11px] font-mono uppercase tracking-widest text-primary-600 mb-1">Paso 1 · Punto de partida</div>
        <h2 className="text-2xl font-bold text-gray-900">Esto es lo que la IA usará</h2>
        <p className="text-sm text-gray-500 mt-1">Todo se toma de tu empresa: el mapa de procesos, la estructura organizacional y los datos del onboarding. No hay que cargar ni escribir nada.</p>
      </header>

      {/* Contexto (del onboarding, solo lectura) */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase size={16} className="text-primary-600" />
          <h3 className="text-sm font-semibold text-gray-900">Contexto de la empresa</h3>
          <span className="text-[11px] text-gray-500">· del onboarding</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill label="Organización" value={P.cliente || '—'} />
          <Pill label="Sector" value={P.sector || 'no definido'} />
          <Pill label="Alcance" value={P.alcance || 'Toda la organización'} />
        </div>
      </div>

      {/* Mapa Nivel 0 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Map size={16} className="text-primary-600" />
          <h3 className="text-sm font-semibold text-gray-900">Mapa de procesos Nivel 0</h3>
          <span className="text-[11px] text-gray-500">· {doc.macros.length} macroproceso(s)</span>
        </div>
        {doc.macros.length ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {doc.macros.map((m, i) => (
                <span key={m.nombre + i} className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-700">
                  <i className="w-2 h-2 rounded-full" style={{ background: TIPO_COLOR[m.tipo] }} />{m.nombre}
                </span>
              ))}
            </div>
            <div className="flex gap-3 mt-3 text-[11px] text-gray-500">
              {FRANJAS.map((t) => (<span key={t} className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ background: TIPO_COLOR[t] }} />{t}</span>))}
            </div>
          </>
        ) : (
          <p className="text-sm text-amber-700 flex items-center gap-2"><Info size={14} /> No hay macroprocesos en el mapa. Créalos primero en el Mapa de Procesos.</p>
        )}
      </div>

      {/* Áreas */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Building2 size={16} className="text-primary-600" />
          <h3 className="text-sm font-semibold text-gray-900">Estructura organizacional</h3>
          <span className="text-[11px] text-gray-500">· {hojas.length} área(s) hoja (reciben subprocesos)</span>
        </div>
        {hojas.length ? (
          <div className="flex flex-wrap gap-1.5">
            {hojas.map((a, i) => (<span key={a + i} className="text-[11px] px-2.5 py-1 rounded-full bg-primary-50 border border-primary-200 text-primary-600">{a}</span>))}
          </div>
        ) : (
          <p className="text-sm text-amber-700 flex items-center gap-2"><Info size={14} /> No hay áreas en Estructura Organizacional. La IA te preguntará por ellas en el chat.</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onNext} disabled={!doc.macros.length} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold shadow-lg disabled:opacity-40 disabled:shadow-none bg-primary-500">
          Empezar el chat con la IA <ArrowRight size={15} />
        </button>
      </div>
    </div>
  )
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
      <span className="text-gray-500">{label}:</span><span className="text-gray-800 font-medium">{value}</span>
    </span>
  )
}
