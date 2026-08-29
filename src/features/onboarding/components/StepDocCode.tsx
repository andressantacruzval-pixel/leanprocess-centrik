import { useState } from 'react'
import { ArrowLeft, Check, FileCode2 } from 'lucide-react'
import { useCompanyStore } from '@/stores/companyStore'
import {
  DOC_CODE_PATTERNS,
  DEFAULT_DOC_CODE_PATTERN,
  DEFAULT_DOC_CODE_PREFIX,
  buildDocCode,
  type DocCodePattern,
} from '@/utils/docCode'

interface StepDocCodeProps {
  onComplete: () => void
  onBack: () => void
}

/**
 * Paso 5: como se numeran los documentos.
 *
 * Va DESPUES del organigrama a proposito: la pregunta solo tiene sentido cuando ya
 * existen las areas, porque una de las combinaciones las usa y aqui se ven en la
 * vista previa. Es lo que pidio Andres en el sync del 11-ago.
 *
 * Se elige una vez y no se expone en Configuracion: cambiarlo despues descuadraria
 * los documentos ya emitidos.
 */
export function StepDocCode({ onComplete, onBack }: StepDocCodeProps) {
  const company = useCompanyStore((s) => s.company)
  const setDocCodeConfig = useCompanyStore((s) => s.setDocCodeConfig)
  const orgUnits = useCompanyStore((s) => s.orgUnits)

  const [pattern, setPattern] = useState<DocCodePattern>(
    company?.doc_code_pattern ?? DEFAULT_DOC_CODE_PATTERN
  )
  const [prefix, setPrefix] = useState(company?.doc_code_prefix ?? DEFAULT_DOC_CODE_PREFIX)

  // Un area real del organigrama recien construido: la vista previa enseña el
  // codigo que va a salir de verdad, no un ejemplo inventado.
  //
  // SOLO unidades con padre. La raiz lleva el nombre de la EMPRESA, no de un area,
  // y con un organigrama recien creado es la unica que hay: el respaldo a
  // `orgUnits[0]` enseñaba «PRO-TERRAFRESCA-001» como si la empresa fuera un area.
  // Sin areas todavia, mejor no inventarse una — el aviso de abajo lo explica.
  const areaEjemplo = orgUnits.find((u) => u.parent_id !== null)?.name ?? null

  const preview = buildDocCode({ pattern, prefix, areaName: areaEjemplo, seq: 1 })

  const handleComplete = () => {
    setDocCodeConfig(pattern, prefix.trim() || DEFAULT_DOC_CODE_PREFIX)
    onComplete()
  }

  return (
    <div className="flex flex-col flex-1 px-4 w-full max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-lg bg-primary-50 flex items-center justify-center mx-auto mb-4">
          <FileCode2 className="text-primary-600" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Como numeramos tus documentos</h2>
        <p className="text-gray-500 text-sm">
          Cada procedimiento llevara un codigo unico. Elige como se compone.
        </p>
        <p className="text-amber-700 text-xs mt-2">
          Se define una sola vez: cambiarlo despues afectaria a los documentos ya emitidos.
        </p>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Prefijo del procedimiento
        </label>
        <input
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          maxLength={12}
          placeholder={DEFAULT_DOC_CODE_PREFIX}
          className="w-full sm:w-48 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-mono uppercase placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div className="space-y-2.5 mb-6">
        <label className="block text-sm font-medium text-gray-700">Orden de los segmentos</label>
        {DOC_CODE_PATTERNS.map((opt) => {
          const active = pattern === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => setPattern(opt.value)}
              className={`w-full flex items-center justify-between gap-4 px-5 py-4 rounded-lg border text-left transition-all ${
                active
                  ? 'bg-primary-50 border-primary-300'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className={`text-sm font-medium ${active ? 'text-gray-900' : 'text-gray-700'}`}>
                {opt.label}
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-xs text-gray-500">{opt.example}</span>
                {active && <Check size={16} className="text-primary-600" />}
              </span>
            </button>
          )
        })}
      </div>

      <div className="rounded-lg bg-gray-50 border border-gray-200 px-5 py-4 mb-6">
        <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
          Asi quedara tu primer procedimiento
        </p>
        <p className="text-primary-700 font-mono text-lg font-semibold">{preview}</p>
        {!areaEjemplo && pattern !== 'tipo-num' && (
          <p className="text-gray-500 text-xs mt-2">
            El area se anade cuando el proceso tenga una asignada.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-2.5 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={18} />
          Anterior
        </button>
        <button
          onClick={handleComplete}
          className="flex items-center gap-2 px-8 py-2.5 text-white rounded-lg font-semibold transition-colors bg-primary-500 hover:bg-primary-600"
        >
          <Check size={18} />
          Finalizar
        </button>
      </div>
    </div>
  )
}
