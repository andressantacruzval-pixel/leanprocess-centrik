import { useState, useCallback, useMemo, useEffect } from 'react'
import { Activity, Sparkles, Loader2, Clock, TrendingUp, Zap, BarChart3, Pencil } from 'lucide-react'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'
import { useCompanyStore } from '@/stores/companyStore'
import { classifyActivitiesValue } from '@/lib/claude'
import { parseBpmnXml } from '@/utils/bpmnParser'
import {
  type ValueActivity, type ValueClassification, type TimePeriod, type Frequency,
  CLASSIFICATION_COLORS, PERIOD_OPTIONS,
  computeKPIs, scaleToPeriod, formatTime, computePareto,
} from '@/utils/valueAnalysis'
import { EditValueActivityModal } from './EditValueActivityModal'

interface Props {
  processId: string
  processName: string
  bpmnXml?: string
  isExpanded?: boolean
}

export function ValueAnalysisTab({ processId, processName, bpmnXml, isExpanded }: Props) {
  const company = useCompanyStore((s) => s.company)
  const allAnalyses = useValueAnalysisStore((s) => s.analyses)
  const activities = useMemo(() => allAnalyses[processId] || [], [allAnalyses, processId])
  const syncFromBpmn = useValueAnalysisStore((s) => s.syncFromBpmn)
  const setActivities = useValueAnalysisStore((s) => s.setActivities)
  const updateActivity = useValueAnalysisStore((s) => s.updateActivity)

  const [isClassifying, setIsClassifying] = useState(false)
  const classifyBudget = useTokenBudget({ operationKey: 'value_classification' })
  const [editingActivity, setEditingActivity] = useState<ValueActivity | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('mes')
  const [view, setView] = useState<'list' | 'pareto'>('list')

  // Sync BPMN activities on mount or when bpmnXml changes
  useEffect(() => {
    if (!bpmnXml) return
    const parsed = parseBpmnXml(bpmnXml)
    const bpmnActivities = parsed.activities.map((a) => ({
      id: a.id,
      name: a.name,
      laneName: a.laneName,
    }))
    if (bpmnActivities.length > 0) {
      syncFromBpmn(processId, bpmnActivities)
    }
  }, [bpmnXml, processId, syncFromBpmn])

  const kpis = useMemo(() => computeKPIs(activities), [activities])
  const paretoItems = useMemo(() => computePareto(activities, selectedPeriod), [activities, selectedPeriod])

  const pieData = useMemo(() => {
    const data: { name: string; value: number; color: string }[] = []
    if (kpis.vaCount > 0) data.push({ name: 'VA', value: kpis.vaCount, color: CLASSIFICATION_COLORS.VA.hex })
    if (kpis.nvaCount > 0) data.push({ name: 'NVA', value: kpis.nvaCount, color: CLASSIFICATION_COLORS.NVA.hex })
    if (kpis.nvabnCount > 0) data.push({ name: 'NVABN', value: kpis.nvabnCount, color: CLASSIFICATION_COLORS.NVABN.hex })
    return data
  }, [kpis])

  const pieTimeData = useMemo(() => {
    const data: { name: string; value: number; color: string }[] = []
    if (kpis.vaDailyMinutes > 0) data.push({ name: 'VA', value: Math.round(kpis.vaDailyMinutes), color: CLASSIFICATION_COLORS.VA.hex })
    if (kpis.nvaDailyMinutes > 0) data.push({ name: 'NVA', value: Math.round(kpis.nvaDailyMinutes), color: CLASSIFICATION_COLORS.NVA.hex })
    if (kpis.nvabnDailyMinutes > 0) data.push({ name: 'NVABN', value: Math.round(kpis.nvabnDailyMinutes), color: CLASSIFICATION_COLORS.NVABN.hex })
    return data
  }, [kpis])

  const handleClassify = useCallback(async () => {
    if (!bpmnXml || isClassifying) return
    setIsClassifying(true)
    await classifyBudget.run(async () => {
      const parsed = parseBpmnXml(bpmnXml)
      const bpmnActivities = parsed.activities.map((a) => ({
        id: a.id, name: a.name, laneName: a.laneName,
      }))
      syncFromBpmn(processId, bpmnActivities)
      const results = await classifyActivitiesValue(bpmnActivities, processName, company?.name)
      // setActivities hace DELETE+INSERT garantizando persistencia incluso para actividades
      // nuevas (generadas por syncFromBpmn) que aún no existen en la DB.
      const synced = useValueAnalysisStore.getState().analyses[processId] ?? []
      const byBpmnId = new Map(results.map((r) => [r.id, r.classification as ValueClassification]))
      const classified = synced.map((a) => ({
        ...a,
        classification: byBpmnId.get(a.bpmnNodeId) ?? a.classification,
      }))
      setActivities(processId, classified)
    })
    setIsClassifying(false)
  }, [bpmnXml, processName, company?.name, isClassifying, processId, classifyBudget, setActivities, syncFromBpmn])

  const handleSaveEdit = useCallback((updates: { frequency: Frequency; timePerOccurrence: number; occurrences: number; classification: ValueClassification | null }) => {
    if (!editingActivity) return
    updateActivity(processId, editingActivity.id, updates)
    setEditingActivity(null)
  }, [editingActivity, processId, updateActivity])

  const classifiedCount = activities.filter((a) => a.classification !== null).length
  const hasTimeData = activities.some((a) => a.timePerOccurrence > 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Activity size={isExpanded ? 16 : 14} className="text-primary-600" />
          <span className={`font-semibold text-gray-900 ${isExpanded ? 'text-sm' : 'text-xs'}`}>Análisis de Valor</span>
          {activities.length > 0 && (
            <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded-md text-gray-500">
              {classifiedCount}/{activities.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleClassify}
          disabled={!bpmnXml || isClassifying || classifyBudget.isConsuming}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 border border-primary-200 text-[11px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {(isClassifying || classifyBudget.isConsuming) ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {(isClassifying || classifyBudget.isConsuming) ? 'Generando...' : classifiedCount > 0 ? 'Reclasificar' : 'Clasificar con IA'}
          <TokenCostBadge operationKey="value_classification" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {!isClassifying && activities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Activity size={24} className="text-gray-300 mb-3" />
            <p className="text-xs text-gray-400 mb-1">Sin actividades</p>
            <p className="text-[10px] text-gray-300 mb-4">
              {bpmnXml
                ? 'Clasifica las actividades del flujograma con IA.'
                : 'Necesitas un diagrama BPMN primero.'}
            </p>
          </div>
        )}

        {!isClassifying && activities.length > 0 && (
          <div className="p-3 space-y-4">
            {/* KPI Cards */}
            {classifiedCount > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <KpiCard
                  label="Eficiencia VA"
                  value={`${Math.round(kpis.vaEfficiency)}%`}
                  icon={<TrendingUp size={12} />}
                  color="text-emerald-600"
                  bgColor="bg-emerald-50"
                />
                <KpiCard
                  label="Desperdicio"
                  value={`${Math.round(kpis.wastePercentage)}%`}
                  icon={<Zap size={12} />}
                  color="text-red-600"
                  bgColor="bg-red-50"
                />
                <KpiCard
                  label="Ciclo"
                  value={formatTime(kpis.cycleTimeMinutes)}
                  icon={<Clock size={12} />}
                  color="text-blue-600"
                  bgColor="bg-blue-50"
                />
              </div>
            )}

            {/* Charts */}
            {classifiedCount > 0 && pieData.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Activity count pie */}
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-[9px] text-gray-400 uppercase mb-2">Distribución</p>
                  <div className="h-[100px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={2}>
                          {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 10 }}
                          itemStyle={{ color: '#fff' }}
                          formatter={(value) => [`${value} actividades`, ''] as [string, string]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-3 mt-1">
                    {pieData.map((d) => (
                      <div key={d.name} className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-[8px] text-gray-500">{d.name} ({d.value})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Time distribution pie */}
                {hasTimeData && pieTimeData.length > 0 && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[9px] text-gray-400 uppercase mb-2">Tiempo (min/día)</p>
                    <div className="h-[100px]">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <PieChart>
                          <Pie data={pieTimeData} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={40} paddingAngle={2}>
                            {pieTimeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 10 }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value) => [`${value} min`, ''] as [string, string]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-3 mt-1">
                      {pieTimeData.map((d) => (
                        <div key={d.name} className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="text-[8px] text-gray-500">{d.name} ({d.value}m)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* If no time data, show hint */}
                {!hasTimeData && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 flex flex-col items-center justify-center">
                    <Clock size={16} className="text-gray-300 mb-2" />
                    <p className="text-[9px] text-gray-400 text-center">Edita las actividades para agregar tiempos y ver análisis temporal</p>
                  </div>
                )}
              </div>
            )}

            {/* Period selector + View toggle */}
            {hasTimeData && classifiedCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {PERIOD_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setSelectedPeriod(p.value)}
                      className={`px-2.5 py-2 rounded-md text-[11px] transition-colors ${
                        selectedPeriod === p.value
                          ? 'bg-primary-100 text-primary-600'
                          : 'text-gray-400 hover:text-gray-500'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setView('list')}
                    aria-label="Vista de lista"
                    className={`p-2.5 rounded transition-colors ${view === 'list' ? 'text-primary-600' : 'text-gray-300'}`}
                  >
                    <Activity size={12} />
                  </button>
                  <button
                    onClick={() => setView('pareto')}
                    aria-label="Vista de Pareto"
                    className={`p-2.5 rounded transition-colors ${view === 'pareto' ? 'text-primary-600' : 'text-gray-300'}`}
                  >
                    <BarChart3 size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Annualized Time Summary */}
            {hasTimeData && classifiedCount > 0 && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[9px] text-gray-400 uppercase mb-2">
                  Tiempo {PERIOD_OPTIONS.find((p) => p.value === selectedPeriod)?.label}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <TimeStat label="Total" minutes={scaleToPeriod(kpis.totalDailyMinutes, selectedPeriod)} color="text-gray-900" />
                  <TimeStat label="VA" minutes={scaleToPeriod(kpis.vaDailyMinutes, selectedPeriod)} color="text-emerald-600" />
                  <TimeStat label="NVA" minutes={scaleToPeriod(kpis.nvaDailyMinutes, selectedPeriod)} color="text-red-600" />
                  <TimeStat label="NVABN" minutes={scaleToPeriod(kpis.nvabnDailyMinutes, selectedPeriod)} color="text-amber-600" />
                </div>
              </div>
            )}

            {/* Activity List / Pareto */}
            {view === 'list' ? (
              <div className={isExpanded ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : 'space-y-1.5'}>
                {activities.map((a) => (
                  <ActivityRow
                    key={a.id}
                    activity={a}
                    period={selectedPeriod}
                    onEdit={() => setEditingActivity(a)}
                    onClassify={(cls) => updateActivity(processId, a.id, { classification: cls })}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {paretoItems.map((item, i) => (
                  <ParetoRow key={item.activity.id} item={item} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingActivity && (
        <EditValueActivityModal
          activity={editingActivity}
          onSave={handleSaveEdit}
          onClose={() => setEditingActivity(null)}
        />
      )}
      <InsufficientTokensModal
        open={classifyBudget.showInsufficientModal}
        onClose={classifyBudget.closeInsufficientModal}
        operationKey="value_classification"
      />
    </div>
  )
}

// ── Sub-components ──

function KpiCard({ label, value, icon, color, bgColor }: { label: string; value: string; icon: React.ReactNode; color: string; bgColor: string }) {
  return (
    <div className={`rounded-lg border border-gray-100 ${bgColor} p-2.5`}>
      <div className={`flex items-center gap-1 ${color} mb-1`}>{icon}<span className="text-[8px] uppercase">{label}</span></div>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  )
}

function TimeStat({ label, minutes, color }: { label: string; minutes: number; color: string }) {
  return (
    <div className="text-center">
      <p className="text-[8px] text-gray-400 uppercase">{label}</p>
      <p className={`text-[11px] font-semibold ${color}`}>{formatTime(minutes)}</p>
    </div>
  )
}

const TOGGLE_STYLES: Record<ValueClassification, { active: string; inactive: string }> = {
  VA:    { active: 'bg-emerald-100 text-emerald-600 border-emerald-300', inactive: 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100' },
  NVA:   { active: 'bg-red-100 text-red-600 border-red-300',            inactive: 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100' },
  NVABN: { active: 'bg-amber-100 text-amber-600 border-amber-300',      inactive: 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100' },
}

function ActivityRow({
  activity, period, onEdit, onClassify,
}: {
  activity: ValueActivity
  period: TimePeriod
  onEdit: () => void
  onClassify: (cls: ValueClassification) => void
}) {
  const cls = activity.classification ? CLASSIFICATION_COLORS[activity.classification] : null
  const scaled = scaleToPeriod(activity.dailyMinutes, period)
  const maxBar = 100

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 group hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-900 truncate">{activity.name}</p>
            {activity.laneName && (
              <p className="text-[11px] text-gray-400">{activity.laneName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Botones toggle manuales — 0 tokens */}
          <div className="flex gap-1">
            {(['VA', 'NVA', 'NVABN'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onClassify(type)}
                className={`px-3 py-2 rounded-md text-[11px] font-medium border transition-all ${
                  activity.classification === type
                    ? TOGGLE_STYLES[type].active
                    : TOGGLE_STYLES[type].inactive
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          {activity.timePerOccurrence > 0 && (
            <span className="text-[9px] text-gray-400 font-mono">{formatTime(scaled)}</span>
          )}
          <button
            type="button"
            onClick={onEdit}
            title="Editar actividad"
            className="p-1 rounded-md text-gray-400 group-hover:text-gray-800 group-hover:bg-gray-100 hover:!text-primary-600 hover:!bg-primary-50 transition-all"
          >
            <Pencil size={12} />
          </button>
        </div>
      </div>
      {/* Time bar */}
      {activity.dailyMinutes > 0 && cls && (
        <div className="mt-1.5 h-1 rounded-full bg-gray-50 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min((scaled / maxBar) * 100, 100)}%`,
              backgroundColor: cls.hex,
              opacity: 0.6,
            }}
          />
        </div>
      )}
    </div>
  )
}

function ParetoRow({ item, index }: { item: { activity: ValueActivity; scaledMinutes: number; cumulativePercent: number; isCritical: boolean }; index: number }) {
  const cls = item.activity.classification ? CLASSIFICATION_COLORS[item.activity.classification] : null

  return (
    <div className={`rounded-lg border p-2.5 flex items-center gap-2 ${
      item.isCritical ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'
    }`}>
      <span className={`text-[9px] font-bold w-4 text-right ${item.isCritical ? 'text-amber-600' : 'text-gray-300'}`}>
        {index + 1}
      </span>
      {cls && (
        <span className={`text-[8px] px-1 py-0.5 rounded-md font-bold ${cls.bg} ${cls.text}`}>
          {item.activity.classification}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-900 truncate">{item.activity.name}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[10px] font-mono text-gray-600">{formatTime(item.scaledMinutes)}</p>
        <p className={`text-[8px] font-mono ${item.isCritical ? 'text-amber-600' : 'text-gray-300'}`}>
          {Math.round(item.cumulativePercent)}%
        </p>
      </div>
    </div>
  )
}
