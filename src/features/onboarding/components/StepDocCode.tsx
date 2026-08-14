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
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
          <FileCode2 className="text-cyan-400" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Como numeramos tus documentos</h2>
        <p className="text-white/50 text-sm">
          Cada procedimiento llevara un codigo unico. Elige como se compone.
        </p>
        <p className="text-amber-300/70 text-xs mt-2">
          Se define una sola vez: cambiarlo despues afectaria a los documentos ya emitidos.
        </p>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-white/70 mb-2">
          Prefijo del procedimiento
        </label>
        <input
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          maxLength={12}
          placeholder={DEFAULT_DOC_CODE_PREFIX}
          className="w-full sm:w-48 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono uppercase placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
        />
      </div>

      <div className="space-y-2.5 mb-6">
        <label className="block text-sm font-medium text-white/70">Orden de los segmentos</label>
        {DOC_CODE_PATTERNS.map((opt) => {
          const active = pattern === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => setPattern(opt.value)}
              className={`w-full flex items-center justify-between gap-4 px-5 py-4 rounded-xl border text-left transition-all ${
                active
                  ? 'bg-cyan-500/10 border-cyan-500/40'
                  : 'bg-white/[0.03] border-white/10 hover:border-white/20'
              }`}
            >
              <span className={`text-sm font-medium ${active ? 'text-white' : 'text-white/70'}`}>
                {opt.label}
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-xs text-white/40">{opt.example}</span>
                {active && <Check size={16} className="text-cyan-400" />}
              </span>
            </button>
          )
        })}
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/10 px-5 py-4 mb-6">
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
          Asi quedara tu primer procedimiento
        </p>
        <p className="text-cyan-300 font-mono text-lg font-semibold">{preview}</p>
        {!areaEjemplo && pattern !== 'tipo-num' && (
          <p className="text-white/40 text-xs mt-2">
            El area se anade cuando el proceso tenga una asignada.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-2.5 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          Anterior
        </button>
        <button
          onClick={handleComplete}
          className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-semibold hover:from-cyan-500 hover:to-blue-500 transition-colors"
        >
          <Check size={18} />
          Finalizar
        </button>
      </div>
    </div>
  )
}
