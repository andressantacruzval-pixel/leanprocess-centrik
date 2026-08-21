import { useMemo, useState, useCallback } from 'react'
import { Lightbulb, Sparkles, Loader2, Plus } from 'lucide-react'
import { useImprovementStore } from '@/stores/improvementStore'
import { useRiskStore } from '@/stores/riskStore'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'
import { generateImprovementOpportunities } from '@/lib/procedureAi'
import { clampScore } from '@/types/improvement'
import { getRiskLevel } from '@/types/risk'
import { parseBpmnXml } from '@/utils/bpmnParser'
import { ImprovementCard } from './ImprovementCard'

interface Props {
  processId: string
  processName: string
  bpmnXml?: string
  isExpanded?: boolean
}

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Lightbulb size={isExpanded ? 16 : 14} className="text-cyan-400" />
          <span className={`font-semibold text-white ${isExpanded ? 'text-sm' : 'text-xs'}`}>Oportunidades de mejora</span>
          {opportunities.length > 0 && (
            <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">{closedCount}/{opportunities.length} cerradas</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!hasInputs || busy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 text-[11px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {busy ? 'Generando...' : opportunities.length > 0 ? 'Generar más' : 'Generar con IA'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {!hasInputs && opportunities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Lightbulb size={24} className="text-white/10 mb-3" />
            <p className="text-xs text-white/30 mb-1">Aún no hay insumos</p>
            <p className="text-[10px] text-white/20">
              Identifica primero los <b>riesgos</b> y/o haz el <b>análisis de valor</b> del proceso.
              La IA usa esos datos para proponer oportunidades de mejora.
            </p>
          </div>
        )}

        {hasInputs && opportunities.length === 0 && !busy && (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Sparkles size={22} className="text-cyan-400/40 mb-3" />
            <p className="text-xs text-white/40 mb-1">Listo para analizar</p>
            <p className="text-[10px] text-white/25 mb-1">
              {risks.length} riesgo(s) y {activities.length} actividad(es) de valor disponibles.
            </p>
            <p className="text-[10px] text-white/25">Pulsa «Generar con IA» para proponer mejoras.</p>
          </div>
        )}

        {busy && opportunities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 size={22} className="text-cyan-400 animate-spin mb-3" />
            <p className="text-[11px] text-white/40">Analizando riesgos y flujo de valor…</p>
          </div>
        )}

        <div className={isExpanded ? 'grid grid-cols-1 lg:grid-cols-2 gap-3' : 'space-y-3'}>
          {opportunities.map((o) => (
            <ImprovementCard
              key={o.id}
              opportunity={o}
              onChange={(updates) => updateOpportunity(o.id, updates)}
              onDelete={() => deleteOpportunity(o.id)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => addOpportunity(processId)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 text-xs transition-colors"
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
