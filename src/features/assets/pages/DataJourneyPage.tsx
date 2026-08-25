import { useMemo } from 'react'
import { Route, Database, ArrowLeftRight } from 'lucide-react'
import { useCompanyStore } from '@/stores/companyStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useAssetStore } from '@/stores/assetStore'
import { DataJourneyGraph } from '@/features/assets/journey/DataJourneyGraph'

// Data Journey — mapa interactivo del viaje de los activos de información entre
// macroprocesos → procesos → subprocesos. 100% interactivo: arrastra nodos,
// expande niveles con un clic, busca y filtra activos y estados.
export default function DataJourneyPage() {
  const company = useCompanyStore((s) => s.company)
  const companyId = useWorkspaceStore((s) => s.activeCompanyId)
  const assets = useAssetStore((s) => s.assets)
  const operations = useAssetStore((s) => s.operations)

  const stats = useMemo(() => {
    const scoped = assets.filter((a) => a.company_id === companyId)
    const transfers = operations.filter((o) => o.company_id === companyId && (o.source_process_id || o.target_process_id))
    return { assets: scoped.length, transfers: transfers.length }
  }, [assets, operations, companyId])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-white/5 bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Route size={24} className="text-cyan-400" />
              Data Journey
            </h1>
            <p className="text-white/40 mt-1">
              {company?.name ? `${company.name} · ` : ''}Cómo viajan los activos de información entre tus procesos
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2 text-sm text-white/40">
              <Database size={16} className="text-cyan-400" />
              <span className="font-semibold">{stats.assets}</span><span>activos</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/40">
              <ArrowLeftRight size={16} className="text-cyan-400" />
              <span className="font-semibold">{stats.transfers}</span><span>transferencias</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <DataJourneyGraph />
      </div>
    </div>
  )
}
