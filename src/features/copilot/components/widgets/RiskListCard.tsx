import { Link } from 'react-router-dom'
import { ShieldAlert, ShieldCheck, ArrowRight } from 'lucide-react'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { getRiskLevel } from '@/types/risk'
import { risksForWidget, type RiskWidgetFilter, type ControlFilter } from '../../copilotData'
import { docPath, HEAT_MAP_PATH } from './docLinks'

// Lista de riesgos REALES (deterministas). Evita que el modelo invente títulos:
// el modelo solo elige el filtro, el sistema pone los riesgos exactos.
export function RiskListCard({ params }: { params: Record<string, string> }) {
  const data = useCompanyScopedData()
  const control = params.control as ControlFilter | undefined
  const filter: RiskWidgetFilter = {
    process: params.process || undefined,
    control: control === 'inadequate' || control === 'none' || control === 'any' ? control : undefined,
    level: params.level || undefined,
    category: params.category || undefined,
  }
  const rows = risksForWidget(data, filter).slice(0, 12)

  if (!rows.length) {
    return (
      <div className="text-[12px] text-gray-500 border border-gray-200 rounded-lg px-3 py-2.5">
        No hay riesgos que cumplan ese criterio en la documentación.
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {rows.map(({ risk, processName, level, executor, adequate }) => {
        const hex = getRiskLevel(risk.inherentProbability, risk.inherentImpact).hex
        const proc = data.processes.find((p) => p.id === risk.process_id)
        return (
          <div key={risk.id} className={`rounded-lg border p-2.5 ${adequate ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-start gap-2">
              {adequate ? <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" /> : <ShieldAlert size={14} className="mt-0.5 shrink-0 text-red-600" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12.5px] font-semibold text-gray-900">{risk.title}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-gray-900" style={{ background: hex }}>{level}</span>
                  <span className="text-[10px] text-gray-500">{risk.category}</span>
                </div>
                <div className="text-[10.5px] text-gray-500 mt-0.5">{processName} · Ejecutor: {executor}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10.5px] font-medium ${adequate ? 'text-emerald-700' : 'text-red-700'}`}>{adequate ? 'Con control adecuado' : 'Sin control adecuado'}</span>
                  {proc && (
                    <Link to={docPath('characterization', proc.id)} className="text-[10.5px] text-primary-700 hover:underline inline-flex items-center gap-0.5">
                      ver <ArrowRight size={10} />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
      <Link to={HEAT_MAP_PATH} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-primary-700 pt-0.5">
        Ver todos en el mapa de calor <ArrowRight size={11} />
      </Link>
    </div>
  )
}
