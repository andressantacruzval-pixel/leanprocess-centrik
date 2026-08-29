import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useInventoryData } from '../useInventoryData'
import type { InvDoc } from '../types'
import { WizardBase } from './WizardBase'
import { InventoryStudio } from './InventoryStudio'

// Asistente del Inventario de Procesos, lanzado desde el Mapa de Procesos.
// Dos pasos: (1) Base — confirma el mapa Nivel 0 y las áreas leídas de la app;
// (2) Chat con IA — un chat EMBEBIDO donde la IA levanta el inventario siguiendo
// la metodología (Big Bang o Incremental). Todo ocurre aquí: sin IA externa, sin
// pegar prompts ni JSON. Las tarjetas se generan solas conforme el chat avanza.

const STEPS = ['Base', 'Estudio del inventario']

interface Props { onClose: () => void }

export function InventoryWizard({ onClose }: Props) {
  const { companyId, company, appMacros, appAreas, doc } = useInventoryData()
  const seed = useInventoryStore((s) => s.seed)
  const setProyecto = useInventoryStore((s) => s.setProyecto)
  const [step, setStep] = useState(0)

  // Siembra el mapa y las áreas de la app al abrir (sin pisar lo ya levantado).
  useEffect(() => {
    if (companyId) seed(companyId, appMacros, appAreas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  // Autocompleta el contexto con lo que ya se cargó en el onboarding: NO se le
  // vuelve a preguntar al usuario. Nombre de empresa, sector (industria) y alcance.
  useEffect(() => {
    if (!companyId || !company) return
    setProyecto(companyId, {
      cliente: company.name ?? '',
      sector: company.industry ?? '',
      alcance: doc?.proyecto.alcance || 'Toda la organización',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, company?.name, company?.industry])

  const view: InvDoc = useMemo(
    () => doc ?? { proyecto: { consultor: '', cliente: company?.name ?? '', alcance: 'Toda la organización', sector: company?.industry ?? '', fecha: '', ver: '1.0', metodo: 'incremental' }, areas: appAreas, macros: appMacros },
    [doc, appAreas, appMacros, company?.name, company?.industry]
  )

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-surface-ground">
      {/* Cabecera + progreso */}
      <div className="shrink-0 border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg grid place-items-center text-white font-black text-sm shadow-lg bg-primary-500">I</div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-gray-900 leading-none">Inventario de Procesos</div>
              <div className="text-[10px] text-gray-500 mt-0.5">área → macroproceso → proceso → subproceso</div>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => setStep(i)} className="flex-1 group">
                <div className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-primary-500' : 'bg-gray-100'}`} />
                <div className={`text-[10px] mt-1 text-left ${i === step ? 'text-primary-600 font-semibold' : 'text-gray-400'}`}>{i + 1}. {s}</div>
              </button>
            ))}
          </div>
          <button onClick={onClose} className="shrink-0 p-2 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6">
          {step === 0 && <WizardBase companyId={companyId} doc={view} onNext={() => setStep(1)} />}
          {step === 1 && <InventoryStudio companyId={companyId} doc={view} onBack={() => setStep(0)} onClose={onClose} />}
        </div>
      </div>
    </div>
  )
}
