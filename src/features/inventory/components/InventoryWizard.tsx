import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useInventoryData } from '../useInventoryData'
import type { InvDoc, InvFile } from '../types'
import { WizardBase } from './WizardBase'
import { WizardGenerate } from './WizardGenerate'

// Asistente del Inventario de Procesos, lanzado desde el Mapa de Procesos.
// Dos pasos: (1) Base — lee el mapa Nivel 0 y las áreas de la app; (2) Generación
// — la IA levanta el inventario AQUÍ mismo, macroproceso por macroproceso, y las
// tarjetas se generan solas. El reporte completo (tabla + gráficos) vive en Reportes.

const STEPS = ['Base', 'Generación con IA']

interface Props { onClose: () => void }

export function InventoryWizard({ onClose }: Props) {
  const { companyId, company, appMacros, appAreas, doc } = useInventoryData()
  const seed = useInventoryStore((s) => s.seed)
  const replaceDoc = useInventoryStore((s) => s.replaceDoc)
  const setProyecto = useInventoryStore((s) => s.setProyecto)
  const [step, setStep] = useState(0)

  // Siembra el mapa y las áreas de la app al abrir (sin pisar lo ya levantado).
  useEffect(() => {
    if (companyId) seed(companyId, appMacros, appAreas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  // Rellena el cliente por defecto con el nombre de la empresa.
  useEffect(() => {
    if (companyId && company?.name && !(doc?.proyecto.cliente)) setProyecto(companyId, { cliente: company.name })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, company?.name])

  const view: InvDoc = useMemo(
    () => doc ?? { proyecto: { consultor: '', cliente: company?.name ?? '', alcance: '', sector: '', fecha: '', ver: '1.0', metodo: 'incremental' }, areas: appAreas, macros: appMacros },
    [doc, appAreas, appMacros, company?.name]
  )

  const importFile = (text: string) => {
    try {
      const o = JSON.parse(text) as InvFile
      if (o.tipo !== 'ai-process-manager-inventario') throw new Error('bad')
      replaceDoc(companyId, { proyecto: { ...view.proyecto, ...o.proyecto }, areas: o.areas || [], macros: o.macros || [] })
      setStep(1)
    } catch { alert('Ese archivo no es un inventario válido.') }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#070b14]/95 backdrop-blur-md">
      {/* Cabecera + progreso */}
      <div className="shrink-0 border-b border-white/10 bg-[#0a0f1a]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 grid place-items-center text-white font-black text-sm shadow-lg shadow-cyan-500/30">I</div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-white leading-none">Inventario de Procesos</div>
              <div className="text-[10px] text-white/40 mt-0.5">área → macroproceso → proceso → subproceso</div>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => setStep(i)} className="flex-1 group">
                <div className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-white/10'}`} />
                <div className={`text-[10px] mt-1 text-left ${i === step ? 'text-cyan-400 font-semibold' : 'text-white/30'}`}>{i + 1}. {s}</div>
              </button>
            ))}
          </div>
          <button onClick={onClose} className="shrink-0 p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6">
          {step === 0 && (
            <WizardBase
              companyId={companyId} doc={view}
              onImport={importFile}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <WizardGenerate
              companyId={companyId} doc={view}
              onBack={() => setStep(0)} onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}
