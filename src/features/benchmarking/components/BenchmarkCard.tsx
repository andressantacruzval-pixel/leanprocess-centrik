/**
 * BenchmarkCard
 * ─────────────
 * Anonymous benchmarking: compares user's organization metrics
 * against industry averages.
 */

import { useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useProcessStore } from '@/stores/processStore'
import { useRiskStore } from '@/stores/riskStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { useProcedureStore } from '@/stores/procedureStore'
import { useAuditStore } from '@/stores/auditStore'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useBenchmarkStore } from '@/features/benchmarking/benchmarkStore'
import { isDocumentable } from '@/lib/processLevels'
import { usePlanLimits } from '@/hooks/useActiveCompany'
import { TrendingUp, TrendingDown, Minus, BarChart3, Info, ArrowRight } from 'lucide-react'

interface BenchmarkMetric {
  label: string
  userValue: number
  industryAvg: number
  unit: string
  higherIsBetter: boolean
}

// Simulated industry averages (in production, fetched from API)
const INDUSTRY_AVERAGES: Record<string, Record<string, number>> = {
  default: {
    processDocumentation: 45,  // % of processes documented
    riskCoverage: 38,          // % of processes with risks
    kpiCoverage: 32,           // % of processes with KPIs
    procedureCoverage: 28,     // % of processes with procedures
    auditCoverage: 15,         // % of processes with audit
    vaEfficiency: 62,          // % VA activities
    controlsPerRisk: 1.2,
    avgProcesses: 12,
  },
  'Seguros': { processDocumentation: 65, riskCoverage: 72, kpiCoverage: 55, procedureCoverage: 48, auditCoverage: 40, vaEfficiency: 58, controlsPerRisk: 2.1, avgProcesses: 25 },
  'Tecnologia': { processDocumentation: 52, riskCoverage: 35, kpiCoverage: 42, procedureCoverage: 30, auditCoverage: 18, vaEfficiency: 68, controlsPerRisk: 1.4, avgProcesses: 18 },
  'Manufactura': { processDocumentation: 58, riskCoverage: 55, kpiCoverage: 48, procedureCoverage: 45, auditCoverage: 32, vaEfficiency: 55, controlsPerRisk: 1.8, avgProcesses: 22 },
  'Salud': { processDocumentation: 70, riskCoverage: 68, kpiCoverage: 52, procedureCoverage: 55, auditCoverage: 45, vaEfficiency: 60, controlsPerRisk: 2.3, avgProcesses: 20 },
  'Educacion': { processDocumentation: 35, riskCoverage: 25, kpiCoverage: 28, procedureCoverage: 22, auditCoverage: 12, vaEfficiency: 65, controlsPerRisk: 1.0, avgProcesses: 10 },
  'Retail': { processDocumentation: 40, riskCoverage: 30, kpiCoverage: 35, procedureCoverage: 25, auditCoverage: 15, vaEfficiency: 50, controlsPerRisk: 1.1, avgProcesses: 15 },
  'Consultoria': { processDocumentation: 55, riskCoverage: 42, kpiCoverage: 45, procedureCoverage: 38, auditCoverage: 22, vaEfficiency: 70, controlsPerRisk: 1.5, avgProcesses: 16 },
}

function getIndustryAvg(industry: string | undefined) {
  if (!industry) return INDUSTRY_AVERAGES.default
  for (const key of Object.keys(INDUSTRY_AVERAGES)) {
    if (industry.toLowerCase().includes(key.toLowerCase())) return INDUSTRY_AVERAGES[key]
  }
  return INDUSTRY_AVERAGES.default
}

// ── Sparkline SVG component ──────────────────────────────────────────

function Sparkline({ data }: { data: { date: string; score: number }[] }) {
  if (data.length < 2) return null

  const w = 100
  const h = 30
  const pad = 2
  const scores = data.map((d) => d.score)
  const min = Math.min(...scores) - 5
  const max = Math.max(...scores) + 5
  const range = max - min || 1

  const points = scores
    .map((s, i) => {
      const x = pad + (i / (scores.length - 1)) * (w - 2 * pad)
      const y = h - pad - ((s - min) / range) * (h - 2 * pad)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={w} height={h} className="block">
      <polyline
        points={points}
        fill="none"
        stroke="rgba(34,211,238,0.6)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot on last point */}
      {scores.length > 0 && (() => {
        const lastIdx = scores.length - 1
        const cx = pad + (lastIdx / (scores.length - 1)) * (w - 2 * pad)
        const cy = h - pad - ((scores[lastIdx] - min) / range) * (h - 2 * pad)
        return <circle cx={cx} cy={cy} r="2" fill="#22d3ee" />
      })()}
    </svg>
  )
}

// ── Recommendation link helper ───────────────────────────────────────

interface RecommendationInfo {
  text: string
  to: string
}

export function BenchmarkCard() {
  const plan = usePlanLimits()
  const allProcesses = useProcessStore((s) => s.processes)
  const risks = useRiskStore((s) => s.risks)
  const indicators = useIndicatorStore((s) => s.indicators)
  const procedures = useProcedureStore((s) => s.procedures)
  const audits = useAuditStore((s) => s.audits)
  const analyses = useValueAnalysisStore((s) => s.analyses)
  const company = useCompanyStore((s) => s.company)
  const scoreHistory = useBenchmarkStore((s) => s.scoreHistory)
  const recordScore = useBenchmarkStore((s) => s.recordScore)

  // Solo los procesos del nivel más bajo declarado: son los únicos que admiten
  // documentación, así que los agrupadores ni cuentan como denominador de
  // cobertura ni deben sugerirse. Ver @/lib/processLevels.
  const processes = useMemo(
    () => allProcesses.filter((p) => isDocumentable(p, company?.process_level_count ?? 3)),
    [allProcesses, company?.process_level_count]
  )

  const metrics = useMemo<BenchmarkMetric[]>(() => {
    const total = processes.length || 1
    const avg = getIndustryAvg(company?.industry)

    const withRisks = processes.filter(p => risks.filter(r => r.process_id === p.id).length > 0).length
    const withKpis = processes.filter(p => indicators.filter(i => i.process_id === p.id).length > 0).length
    const withProcs = processes.filter(p => procedures.some(pr => pr.process_id === p.id)).length
    const withAudit = processes.filter(p => (audits[p.id]?.length ?? 0) > 0).length

    const allActivities = Object.values(analyses).flat()
    const vaCount = allActivities.filter(a => a.classification === 'VA').length
    const vaEff = allActivities.length > 0 ? Math.round((vaCount / allActivities.length) * 100) : 0

    const allControls = risks.reduce((sum, r) => sum + (r.controls?.length ?? 0), 0)
    const ctrlPerRisk = risks.length > 0 ? +(allControls / risks.length).toFixed(1) : 0

    return [
      { label: 'Documentacion de procesos', userValue: Math.round((withProcs / total) * 100), industryAvg: avg.procedureCoverage, unit: '%', higherIsBetter: true },
      { label: 'Cobertura de riesgos', userValue: Math.round((withRisks / total) * 100), industryAvg: avg.riskCoverage, unit: '%', higherIsBetter: true },
      { label: 'Cobertura de KPIs', userValue: Math.round((withKpis / total) * 100), industryAvg: avg.kpiCoverage, unit: '%', higherIsBetter: true },
      { label: 'Cobertura de auditoria', userValue: Math.round((withAudit / total) * 100), industryAvg: avg.auditCoverage, unit: '%', higherIsBetter: true },
      { label: 'Eficiencia VA', userValue: vaEff, industryAvg: avg.vaEfficiency, unit: '%', higherIsBetter: true },
      { label: 'Controles por riesgo', userValue: ctrlPerRisk, industryAvg: avg.controlsPerRisk, unit: '', higherIsBetter: true },
    ]
  }, [processes, risks, indicators, procedures, audits, analyses, company])

  // Calculate maturity score (0-100)
  const maturityScore = useMemo(() => {
    let score = 0
    let weight = 0
    for (const m of metrics) {
      const ratio = m.userValue / Math.max(m.industryAvg, 1)
      score += Math.min(ratio, 2) * 100 // cap at 200% of industry
      weight++
    }
    return weight > 0 ? Math.min(100, Math.round(score / weight)) : 0
  }, [metrics])

  // Record maturity score for trend tracking
  useEffect(() => {
    if (maturityScore > 0) {
      recordScore(maturityScore)
    }
  }, [maturityScore, recordScore])

  // Compute trend delta from score history
  const trendDelta = useMemo(() => {
    if (scoreHistory.length < 2) return null
    const oldest = scoreHistory[0]
    const newest = scoreHistory[scoreHistory.length - 1]
    const diff = newest.score - oldest.score
    const weeks = scoreHistory.length - 1
    return { diff, weeks }
  }, [scoreHistory])

  // Build recommendation map for metrics below industry average
  const recommendations = useMemo(() => {
    const map: Record<string, RecommendationInfo | null> = {}

    /**
     * ⚠️ Solo se recomienda sobre procesos que el plan DEJA documentar.
     *
     * Sin este filtro el consejo caía siempre en el peor sitio posible: las
     * recomendaciones buscan justo procesos SIN documentación, que son exactamente
     * los que el cupo bloquea. Un cliente topado leía "Genera un procedimiento",
     * pulsaba, y la pantalla lo expulsaba. Ahora el consejo apunta a algo que sí
     * puede hacer, o no aparece.
     */
    const candidatos = processes.filter((p) => plan.puedeDocumentar(p.id))

    // Find first process without a procedure
    const procWithoutProcedure = candidatos.find(
      (p) => !procedures.some((pr) => pr.process_id === p.id)
    )
    // Find first process without risks
    const procWithoutRisks = candidatos.find(
      (p) => risks.filter((r) => r.process_id === p.id).length === 0
    )
    // Find first process without KPIs
    const procWithoutKpis = candidatos.find(
      (p) => indicators.filter((i) => i.process_id === p.id).length === 0
    )
    // Find first process without audit
    const procWithoutAudit = candidatos.find(
      (p) => (audits[p.id]?.length ?? 0) === 0
    )
    // First process (for VA)
    const firstProcess = candidatos[0]
    // First process with risks but few controls
    const procFewControls = candidatos.find((p) => {
      const processRisks = risks.filter((r) => r.process_id === p.id)
      if (processRisks.length === 0) return false
      const totalControls = processRisks.reduce((s, r) => s + (r.controls?.length ?? 0), 0)
      return totalControls / processRisks.length < 1
    })

    map['Documentacion de procesos'] = procWithoutProcedure
      ? { text: 'Genera un procedimiento', to: `/app/process/${procWithoutProcedure.id}/procedure` }
      : null
    map['Cobertura de riesgos'] = procWithoutRisks
      ? { text: 'Identifica riesgos', to: `/app/process/${procWithoutRisks.id}/characterization` }
      : null
    map['Cobertura de KPIs'] = procWithoutKpis
      ? { text: 'Define KPIs', to: `/app/process/${procWithoutKpis.id}/indicators` }
      : null
    map['Cobertura de auditoria'] = procWithoutAudit
      ? { text: 'Programa auditorias', to: `/app/process/${procWithoutAudit.id}/characterization` }
      : null
    map['Eficiencia VA'] = firstProcess
      ? { text: 'Clasifica actividades', to: `/app/process/${firstProcess.id}/characterization?tab=analisis` }
      : null
    map['Controles por riesgo'] = procFewControls
      ? { text: 'Define controles', to: `/app/process/${procFewControls.id}/characterization` }
      : null

    return map
  }, [processes, risks, indicators, procedures, audits, plan])

  const industry = company?.industry || 'General'

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
      {/* Header with maturity score */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 size={16} className="text-primary-600" />
              Benchmarking — {industry}
            </h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Comparacion anonima con el promedio de tu industria</p>
          </div>
          <div className="text-center">
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15" fill="none"
                  stroke={maturityScore >= 70 ? '#10b981' : maturityScore >= 40 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 15}`}
                  strokeDashoffset={`${2 * Math.PI * 15 * (1 - maturityScore / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-gray-900">{maturityScore}</span>
              </div>
            </div>
            <p className="text-[9px] text-gray-400 mt-1">Score Madurez</p>

            {/* Sparkline trend */}
            {scoreHistory.length >= 2 && (
              <div className="mt-1 flex flex-col items-center">
                <Sparkline data={scoreHistory} />
                {trendDelta && (
                  <span
                    className={`text-[9px] mt-0.5 ${
                      trendDelta.diff > 0
                        ? 'text-emerald-600'
                        : trendDelta.diff < 0
                        ? 'text-red-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {trendDelta.diff > 0
                      ? `↑ ${trendDelta.diff} pts (${trendDelta.weeks} sem)`
                      : trendDelta.diff < 0
                      ? `↓ ${Math.abs(trendDelta.diff)} pts (${trendDelta.weeks} sem)`
                      : 'Sin cambio'}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="p-4 space-y-3">
        {metrics.map((m) => {
          const diff = m.userValue - m.industryAvg
          const isAbove = m.higherIsBetter ? diff > 0 : diff < 0
          const isEqual = Math.abs(diff) < 2
          const isBelowAvg = m.higherIsBetter ? diff < 0 : diff > 0
          const rec = isBelowAvg ? recommendations[m.label] : null

          return (
            <div key={m.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">{m.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-900">
                    {m.userValue}{m.unit}
                  </span>
                  {isEqual ? (
                    <Minus size={12} className="text-gray-300" />
                  ) : isAbove ? (
                    <TrendingUp size={12} className="text-emerald-600" />
                  ) : (
                    <TrendingDown size={12} className="text-red-600" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isAbove ? 'bg-primary-500'
                        : isEqual ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, m.userValue)}%` }}
                  />
                </div>
                <span className="text-[9px] text-gray-300 w-16 text-right">
                  Ind: {m.industryAvg}{m.unit}
                </span>
              </div>
              {/* Actionable recommendation */}
              {rec && (
                <Link
                  to={rec.to}
                  className="inline-flex items-center gap-1 text-[10px] text-primary-600 hover:text-primary-700 transition-colors mt-0.5"
                >
                  {rec.text}
                  <ArrowRight size={10} />
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 pb-3">
        <div className="flex items-start gap-1.5 bg-gray-50 rounded-lg p-2">
          <Info size={12} className="text-gray-300 mt-0.5 shrink-0" />
          <p className="text-[9px] text-gray-300 leading-relaxed">
            Datos anonimizados de organizaciones similares en tu industria. Actualizado mensualmente.
          </p>
        </div>
      </div>
    </div>
  )
}
