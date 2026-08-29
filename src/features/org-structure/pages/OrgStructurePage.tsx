import { useState } from 'react'
import { useCompanyStore } from '@/stores/companyStore'
import { OrgChart } from '@/features/org-structure'
import { OrgLevelManager } from '@/features/org-structure/components/OrgLevelManager'
import { Building2, Users, Layers, Settings2 } from 'lucide-react'

export default function OrgStructurePage() {
  const company = useCompanyStore((s) => s.company)
  const orgUnits = useCompanyStore((s) => s.orgUnits)
  const orgLevelDefinitions = useCompanyStore((s) => s.orgLevelDefinitions)

  const [levelManagerOpen, setLevelManagerOpen] = useState(false)

  const usedLevels = new Set(orgUnits.map((u) => u.org_level_definition_id)).size

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 size={24} className="text-primary-600" />
              Estructura Organizacional
            </h1>
            {company && (
              <p className="text-gray-500 mt-1">{company.name}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users size={16} className="text-primary-600" />
              <span className="font-semibold">{orgUnits.length}</span>
              <span>unidades</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Layers size={16} className="text-primary-600" />
              <span className="font-semibold">{usedLevels}</span>
              <span>de {orgLevelDefinitions.length} niveles</span>
            </div>
            <button
              onClick={() => setLevelManagerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <Settings2 size={14} />
              Gestionar niveles
            </button>
          </div>
        </div>
      </div>

      {/* Chart — `min-h-0` para que el hijo pueda encogerse dentro del flex, y
          `flex flex-col` para que su `flex-1` tenga contra que crecer. Sin las dos,
          el lienzo no llega al fondo de la pantalla. */}
      <div className="flex-1 min-h-0 flex flex-col">
        <OrgChart />
      </div>

      <OrgLevelManager
        open={levelManagerOpen}
        onClose={() => setLevelManagerOpen(false)}
      />
    </div>
  )
}
