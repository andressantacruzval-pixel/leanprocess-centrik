import { useEffect } from 'react'
import { useCompanyStore } from '@/stores/companyStore'
import { OrgChart } from '@/features/org-structure/components/OrgChart'
import { ArrowLeft, ArrowRight } from 'lucide-react'

interface StepOrgChartProps {
  onComplete: () => void
  onBack: () => void
}

export function StepOrgChart({ onComplete, onBack }: StepOrgChartProps) {
  const company = useCompanyStore((s) => s.company)
  const addOrgUnit = useCompanyStore((s) => s.addOrgUnit)
  const updateOrgUnit = useCompanyStore((s) => s.updateOrgUnit)

  // Sincronizar el nodo raíz con el nombre actual de la empresa.
  // Se ejecuta cuando cambia el nombre o el ID para cubrir:
  // 1. Empresa nueva sin unidades previas → crea el nodo raíz.
  // 2. Usuario regresó al paso 1, cambió el nombre y volvió → actualiza el nodo.
  // 3. Onboarding sobre session previa con unidades de otra empresa →
  //    filtra por company.id para no reutilizar unidades ajenas.
  useEffect(() => {
    if (!company?.name) return
    const units = useCompanyStore.getState().orgUnits
    const rootUnit = units.find(
      (u) => u.parent_id === null && (u.company_id === company.id || u.company_id === '')
    )
    if (!rootUnit) {
      addOrgUnit(company.name, null)
    } else if (rootUnit.name !== company.name) {
      updateOrgUnit(rootUnit.id, { name: company.name })
    }
  }, [company?.name, company?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col flex-1 px-4 w-full max-w-6xl mx-auto">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold text-white mb-2">
          Construye tu organigrama
        </h2>
        <p className="text-white/40">
          Agrega las areas y departamentos de tu empresa
        </p>
      </div>

      <div className="flex-1 min-h-[400px] bg-white/[0.03] rounded-xl border border-white/10 overflow-hidden">
        <OrgChart compact />
      </div>

      {/* Navigation */}
      <div className="flex justify-center gap-3 py-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-6 py-2.5 border border-white/10 text-white/70 rounded-xl font-medium hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={18} />
          Anterior
        </button>
        <button
          onClick={onComplete}
          className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-semibold hover:from-cyan-500 hover:to-blue-500 transition-colors"
        >
          Siguiente
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}
