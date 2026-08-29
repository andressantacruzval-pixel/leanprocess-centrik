import { useMemo, useState, useCallback } from 'react'
import { Lightbulb, Sparkles, Loader2, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useImprovementStore } from '@/stores/improvementStore'
import { useRiskStore } from '@/stores/riskStore'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import { generateImprovementOpportunities } from '@/lib/procedureAi'
import {
  clampScore, SCORE_LABELS, STATUS_LABELS, priorityScore, priorityLabel,
  type ScoreValue, type ImprovementStatus, type ImprovementOpportunity,
} from '@/types/improvement'
import { getRiskLevel } from '@/types/risk'
import { parseBpmnXml } from '@/utils/bpmnParser'
import { ImprovementCard } from './ImprovementCard'

interface Props {
  processId: string
  processName: string
  bpmnXml?: string
  isExpanded?: boolean
}

const STATUS_CHIP: Record<ImprovementStatus, string> = {
  propuesta:   'bg-slate-500/15 text-gray-500',
  aprobada:    'bg-blue-50 text-blue-700',
  en_progreso: 'bg-amber-50 text-amber-700',
  cerrada:     'bg-emerald-50 text-emerald-600',
  descartada:  'bg-red-50 text-red-700',
}
// Estados terminales: van al final, atenuados (consultables, pero no primero).
const TERMINAL_STATUS = new Set<ImprovementStatus>(['cerrada', 'descartada'])

export function ImprovementTab({ processId, processName, bpmnXml, isExpanded }: Props) {
  const company = useCompanyStore((s) => s.company)
  const allOpportunities = useImprovementStore((s) => s.opportunities)
  const opportunities = useMemo(
    () => allOpportunities.filter((o) => o.processId === processId),
    [allOpportunities, processId]
  )
  const addOpportunity = useImprovementStore((s) => s.addOpportunity)
  const updateOpportunity = useImprovementStore((s) => s.updateOpportunity)
  const deleteOpportunity = useImprovementStore((s) => s.deleteOpportunity)
  const importAiOpportunities = useImprovementStore((s) => s.importAiOpportunities)

  const allRisks = useRiskStore((s) => s.risks)
  const risks = useMemo(() => allRisks.filter((r) => r.process_id === processId), [allRisks, processId])
  const analyses = useValueAnalysisStore((s) => s.analyses)
  const activities = useMemo(() => analyses[processId] ?? [], [analyses, processId])

  const [isGenerating, setIsGenerating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const budget = useTokenBudget({ operationKey: 'improvement_opportunities' })

  const hasInputs = risks.length > 0 || activities.length > 0

  const handleGenerate = useCallback(async () => {
    if (!hasInputs || isGenerating) return
    setIsGenerating(true)
    await budget.run(async () => {
      const bpmnSummary = bpmnXml
        ? parseBpmnXml(bpmnXml).activities.map((a) => `- ${a.name}${a.laneName ? ` (${a.laneName})` : ''}`).join('\n')
        : undefined
      const results = await generateImprovementOpportunities({
        processName,
        companyName: company?.name,
        bpmnSummary,
        risks: risks.map((r) => ({
          title: r.title,
          level: getRiskLevel(r.inherentProbability, r.inherentImpact).label,
          processStep: r.processStep,
        })),
        valueActivities: activities.map((a) => ({ name: a.name, classification: a.classification })),
      })
      const mapped = results
        .filter((r) => r.name)
        .map((r) => ({
          name: r.name,
          description: r.description ?? '',
          costScore: clampScore(r.costScore),
          complexityScore: clampScore(r.complexityScore),
          timeScore: clampScore(r.timeScore),
        }))
      if (mapped.length > 0) importAiOpportunities(processId, mapped)
    })
    setIsGenerating(false)
  }, [hasInputs, isGenerating, budget, bpmnXml, processName, company?.name, risks, activities, importAiOpportunities, processId])

  const busy = isGenerating || budget.isConsuming
  const closedCount = opportunities.filter((o) => o.status === 'cerrada').length

  // Activas arriba; terminales (cerradas/descartadas) al final, atenuadas.
  const activeOpps = useMemo(() => opportunities.filter((o) => !TERMINAL_STATUS.has(o.status)), [opportunities])
  const terminalOpps = useMemo(() => opportunities.filter((o) => TERMINAL_STATUS.has(o.status)), [opportunities])

  const renderRow = (o: ImprovementOpportunity, dim: boolean) => {
    const isOpen = openId === o.id
    const total = priorityScore(o)
    const prio = priorityLabel(total)
    const prioCls = prio.tone === 'high'
      ? 'bg-emerald-50 text-emerald-600'
      : prio.tone === 'mid' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
    return (
      <div key={o.id} className={`rounded-lg border border-gray-100 bg-gray-50 overflow-hidden ${dim ? 'opacity-60 hover:opacity-100 transition-opacity' : ''}`}>
        <button
          type="button"
          onClick={() => setOpenId(isOpen ? null : o.id)}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
        >
          {isOpen
            ? <ChevronDown size={14} className="text-gray-500 shrink-0" />
            : <ChevronRight size={14} className="text-gray-500 shrink-0" />}
          <span className="flex-1 text-xs font-medium text-gray-900 truncate">{o.name}</span>
          <span className={`text-[8px] px-1.5 py-0.5 rounded-md shrink-0 ${STATUS_CHIP[o.status]}`}>{STATUS_LABELS[o.status]}</span>
          <span className={`text-[8px] px-1 py-0.5 rounded-md shrink-0 ${prioCls}`}>{total}/15</span>
        </button>
        {isOpen && (
          <div className="px-3 pb-3">
            <ImprovementCard
              opportunity={o}
              onChange={(updates) => updateOpportunity(o.id, updates)}
              onDelete={() => { deleteOpportunity(o.id); setOpenId(null) }}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Lightbulb size={isExpanded ? 16 : 14} className="text-primary-600" />
          <span className={`font-semibold text-gray-900 ${isExpanded ? 'text-sm' : 'text-xs'}`}>Oportunidades de mejora</span>
          {opportunities.length > 0 && (
            <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded-md text-gray-500">{closedCount}/{opportunities.length} cerradas</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!hasInputs || busy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200 text-[11px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {busy ? 'Generando...' : opportunities.length > 0 ? 'Generar más' : 'Generar con IA'}
          <TokenCostBadge operationKey="improvement_opportunities" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {opportunities.length > 0 && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-[9px] text-gray-400 uppercase mb-2">
              {opportunities.length} oportunidad(es) · {closedCount} cerrada(s)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <MiniPie title="Costo" kind="cost" values={opportunities.map((o) => o.costScore)} />
              <MiniPie title="Complejidad" kind="complexity" values={opportunities.map((o) => o.complexityScore)} />
              <MiniPie title="Tiempo" kind="time" values={opportunities.map((o) => o.timeScore)} />
            </div>
          </div>
        )}
        {!hasInputs && opportunities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Lightbulb size={24} className="text-gray-300 mb-3" />
            <p className="text-xs text-gray-400 mb-1">Aún no hay insumos</p>
            <p className="text-[10px] text-gray-300">
              Identifica primero los <b>riesgos</b> y/o haz el <b>análisis de valor</b> del proceso.
              La IA usa esos datos para proponer oportunidades de mejora.
            </p>
          </div>
        )}

        {hasInputs && opportunities.length === 0 && !busy && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Sparkles size={22} className="text-primary-600 mb-3" />
            <p className="text-xs text-gray-500 mb-1">Listo para analizar</p>
            <p className="text-[10px] text-gray-400 mb-1">
              {risks.length} riesgo(s) y {activities.length} actividad(es) de valor disponibles.
            </p>
            <p className="text-[10px] text-gray-400">Pulsa «Generar con IA» para proponer mejoras.</p>
          </div>
        )}

        {busy && opportunities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 size={22} className="text-primary-600 animate-spin mb-3" />
            <p className="text-[11px] text-gray-500">Analizando riesgos y flujo de valor…</p>
          </div>
        )}

        <div className="space-y-2">
          {activeOpps.map((o) => renderRow(o, false))}

          {terminalOpps.length > 0 && (
            <div className="flex items-center gap-2 pt-3 pb-1">
              <div className="flex-1 h-px bg-gray-50" />
              <span className="text-[9px] uppercase tracking-wide text-gray-400">
                Cerradas / descartadas ({terminalOpps.length})
              </span>
              <div className="flex-1 h-px bg-gray-50" />
            </div>
          )}
          {terminalOpps.map((o) => renderRow(o, true))}
        </div>

        <button
          type="button"
          onClick={() => addOpportunity(processId)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 text-xs transition-colors"
        >
          <Plus size={13} /> Añadir oportunidad manual
        </button>
      </div>

      <InsufficientTokensModal
        open={budget.showInsufficientModal}
        onClose={budget.closeInsufficientModal}
        operationKey="improvement_opportunities"
      />
    </div>
  )
}

const SCORE_COLORS: Record<ScoreValue, string> = { 5: '#34d399', 3: '#fbbf24', 1: '#f87171' }

function MiniPie({ title, kind, values }: {
  title: string
  kind: 'cost' | 'complexity' | 'time'
  values: ScoreValue[]
}) {
  const data = ([5, 3, 1] as ScoreValue[])
    .map((v) => ({ name: SCORE_LABELS[kind][v], value: values.filter((x) => x === v).length, color: SCORE_COLORS[v] }))
    .filter((d) => d.value > 0)

  return (
    <div className="rounded-lg bg-gray-50 p-1.5">
      <p className="text-[9px] text-gray-500 text-center mb-1">{title}</p>
      <div className="h-[70px]">
        {data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={16} outerRadius={30} paddingAngle={2}>
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 10 }}
                itemStyle={{ color: '#fff' }}
                formatter={(value, name) => [`${value}`, name] as [string, string]}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex flex-col gap-0.5 mt-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-[8px] text-gray-500">{d.name} ({d.value})</span>
          </div>
        ))}
      </div>
    </div>
  )
}
