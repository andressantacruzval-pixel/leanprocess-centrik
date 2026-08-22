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
      <div className="text-[12px] text-white/35 border border-white/10 rounded-xl px-3 py-2">
        Riesgo «{params.title}» no encontrado en la documentación.
      </div>
    )
  }

  const { risk, processName, level, executor, adequate } = resolved
  const hex = getRiskLevel(risk.inherentProbability, risk.inherentImpact).hex
  const proc = data.processes.find((p) => p.id === risk.process_id)

  return (
    <div className={`rounded-xl border p-3 ${adequate ? 'border-white/10 bg-white/[0.03]' : 'border-red-500/25 bg-red-500/[0.06]'}`}>
      <div className="flex items-start gap-2">
        {adequate ? <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" /> : <ShieldAlert size={16} className="mt-0.5 shrink-0 text-red-400" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-white">{risk.title}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: hex }}>{level}</span>
          </div>
          <div className="text-[11px] text-white/45 mt-0.5">{processName} · Ejecutor: {executor}</div>
          {risk.description && <p className="text-[12px] text-white/60 mt-1 leading-snug">{risk.description}</p>}
          <div className={`text-[11.5px] mt-1.5 font-medium ${adequate ? 'text-emerald-300' : 'text-red-300'}`}>
            {adequate ? 'Con control adecuado.' : 'Sin control adecuado — requiere atención.'}
          </div>
          {proc && (
            <div className="flex flex-wrap gap-2 mt-2">
              <Link to={docPath('characterization', proc.id)} className="inline-flex items-center gap-1 text-[11px] text-cyan-300 hover:underline">
                Ver en caracterización <ArrowRight size={11} />
              </Link>
              <Link to={HEAT_MAP_PATH} className="inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-cyan-300">
                Mapa de calor <ArrowRight size={11} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
