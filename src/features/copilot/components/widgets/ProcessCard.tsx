import { Link } from 'react-router-dom'
import { Workflow, ArrowRight, AlertTriangle } from 'lucide-react'
import { useCompanyScopedData } from '@/hooks/useCompanyScopedData'
import { findProcessByName, macroNameById, areaOf, macroOf, resolveRisks } from '../../copilotData'
import { docPath } from './docLinks'

// Ficha resumen de un proceso: macro, área, cobertura documental y accesos.
export function ProcessCard({ params }: { params: Record<string, string> }) {
  const data = useCompanyScopedData()
  const p = findProcessByName(data, params.name ?? '')

  if (!p) {
    return (
      <div className="text-[12px] text-gray-400 border border-gray-200 rounded-lg px-3 py-2">
        Proceso «{params.name}» no encontrado.
      </div>
    )
  }

  const macros = macroNameById(data)
  const risks = resolveRisks(data).filter((r) => r.risk.process_id === p.id)
  const sinControl = risks.filter((r) => !r.adequate).length
  const kpis = data.indicators.filter((i) => i.process_id === p.id).length
  const hasProc = data.procedures.some((pr) => pr.process_id === p.id)

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center gap-2">
        <Workflow size={15} className="text-primary-600 shrink-0" />
        <span className="text-[13px] font-semibold text-gray-900 truncate">{p.name}</span>
        {p.is_critical && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">CRÍTICO</span>}
      </div>
      <div className="text-[11px] text-gray-500 mt-0.5">{macroOf(p, macros)} · {areaOf(p)}</div>
      {p.description && <p className="text-[12px] text-gray-600 mt-1.5 leading-snug line-clamp-2">{p.description}</p>}

      <div className="flex flex-wrap gap-1.5 mt-2 text-[10.5px]">
        <Chip label={`${risks.length} riesgos`} />
        {sinControl > 0 && <Chip label={`${sinControl} sin control`} danger />}
        <Chip label={`${kpis} KPIs`} />
        <Chip label={hasProc ? 'con procedimiento' : 'sin procedimiento'} muted={!hasProc} />
        <Chip label={p.bpmn_xml ? 'con flujograma' : 'sin flujograma'} muted={!p.bpmn_xml} />
      </div>

      <div className="flex flex-wrap gap-2 mt-2.5">
        <Link to={docPath('characterization', p.id)} className="inline-flex items-center gap-1 text-[11px] text-primary-700 hover:underline">
          Abrir caracterización <ArrowRight size={11} />
        </Link>
        {p.bpmn_xml && (
          <Link to={docPath('flowchart', p.id)} className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-primary-700">
            Flujograma <ArrowRight size={11} />
          </Link>
        )}
      </div>
    </div>
  )
}

function Chip({ label, danger, muted }: { label: string; danger?: boolean; muted?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${
      danger ? 'bg-red-50 text-red-700 border-red-200' : muted ? 'bg-gray-50 text-gray-400 border-gray-200' : 'bg-gray-50 text-gray-600 border-gray-200'
    }`}>
      {danger && <AlertTriangle size={9} />}{label}
    </span>
  )
}
