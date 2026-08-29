import { Link } from 'react-router-dom'
import { ShieldAlert, ShieldCheck, ArrowRight } from 'lucide-react'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { getRiskLevel } from '@/types/risk'
import { findRisk } from '../../copilotData'
import { docPath, HEAT_MAP_PATH } from './docLinks'

// Ficha/alerta de un riesgo, con su nivel, ejecutor y estado de control.
export function RiskAlertCard({ params }: { params: Record<string, string> }) {
  const data = useCompanyScopedData()
  const resolved = findRisk(data, params.process ?? '', params.title ?? '')

  if (!resolved) {
    return (
      <div className="text-[12px] text-gray-400 border border-gray-200 rounded-lg px-3 py-2">
        Riesgo «{params.title}» no encontrado en la documentación.
      </div>
    )
  }

  const { risk, processName, level, executor, adequate } = resolved
  const hex = getRiskLevel(risk.inherentProbability, risk.inherentImpact).hex
  const proc = data.processes.find((p) => p.id === risk.process_id)

  return (
    <div className={`rounded-lg border p-3 ${adequate ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'}`}>
      <div className="flex items-start gap-2">
        {adequate ? <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <ShieldAlert size={16} className="mt-0.5 shrink-0 text-red-600" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-gray-900">{risk.title}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-gray-900" style={{ background: hex }}>{level}</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">{processName} · Ejecutor: {executor}</div>
          {risk.description && <p className="text-[12px] text-gray-600 mt-1 leading-snug">{risk.description}</p>}
          <div className={`text-[11.5px] mt-1.5 font-medium ${adequate ? 'text-emerald-700' : 'text-red-700'}`}>
            {adequate ? 'Con control adecuado.' : 'Sin control adecuado — requiere atención.'}
          </div>
          {proc && (
            <div className="flex flex-wrap gap-2 mt-2">
              <Link to={docPath('characterization', proc.id)} className="inline-flex items-center gap-1 text-[11px] text-primary-700 hover:underline">
                Ver en caracterización <ArrowRight size={11} />
              </Link>
              <Link to={HEAT_MAP_PATH} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-primary-700">
                Mapa de calor <ArrowRight size={11} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
