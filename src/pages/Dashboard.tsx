import { useMemo, useState, useEffect, type ComponentType } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { usePlanLimits } from '@/hooks/useActiveCompany'
import { avisarSiSinCupo, mensajeSinCupo } from '@/lib/planGateMessage'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useProcessStore } from '@/stores/processStore'
import { useRiskStore } from '@/stores/riskStore'
import { useIndicatorStore } from '@/stores/indicatorStore'
import { useProcedureStore } from '@/stores/procedureStore'
import { useAuditStore } from '@/stores/auditStore'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'
import { useImprovementStore } from '@/stores/improvementStore'
import { useCompanyStore } from '@/stores/companyStore'
import { useBenchmarkStore } from '@/features/benchmarking/benchmarkStore'
import { useDashboardSnapshotStore } from '@/stores/dashboardSnapshotStore'
import { getRiskLevel } from '@/types/risk'
import {
  Layers, BarChart3, GitBranch, ShieldAlert, ClipboardCheck,
  Activity, FileText, TrendingUp, AlertTriangle, BookOpen,
  ArrowRight, Map, Zap, Target, LayoutDashboard, Lightbulb, CheckCircle2,
  Footprints, Building2, Crown, Workflow, Shield, ShieldCheck, ShieldPlus,
  BookMarked, Flame, Sparkles, Trophy, Star, Award, Share2, Users,
  ChevronDown, ChevronUp, Search, X,
  type LucideProps,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { OnboardingChecklist } from '@/features/onboarding/components/OnboardingChecklist'
import { BenchmarkCard } from '@/features/benchmarking/components/BenchmarkCard'
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker'
import { useAchievementTracker } from '@/hooks/useAchievementTracker'
import { useAchievementProgress } from '@/hooks/useAchievementProgress'
import { useAchievementStore } from '@/features/gamification/achievementStore'
import { useProcessHealth } from '@/hooks/useProcessHealth'
import { isDocumentable } from '@/lib/processLevels'

// ── Icon map for nudge badges ──
const NUDGE_ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  Footprints, Layers, Building2, Crown, GitBranch, Workflow,
  ShieldAlert, Shield, ShieldCheck, ShieldPlus, BookOpen, BookMarked,
  TrendingUp, BarChart3, Activity, ClipboardCheck, FileText, Flame,
  Sparkles, Trophy, Star, Award, Share2, Users,
}

// ── Route map: achievement category → achievements page ──
const CATEGORY_ROUTE: Record<string, string> = {
  procesos: '/app/achievements',
  riesgos: '/app/achievements',
  documentacion: '/app/achievements',
  analisis: '/app/achievements',
  maestria: '/app/achievements',
  comunidad: '/app/achievements',
}

const quickLinks = [
  { path: '/app/process-map', icon: Map, label: 'Mapa de Procesos', description: 'Visualiza y gestiona tu mapa de procesos' },
  { path: '/app/process-levels', icon: Layers, label: 'Procesos por Niveles', description: 'Administra la jerarquia de procesos' },
  { path: '/app/heat-map', icon: ShieldAlert, label: 'Mapa de Calor', description: 'Visualiza riesgos por proceso' },
  { path: '/app/reports', icon: FileText, label: 'Reportes', description: 'Inventario, riesgos, KPIs, valor, auditoria' },
]

export default function Dashboard() {
  const plan = usePlanLimits()
  const profile = useAuthStore((s) => s.profile)
  const activeCompanyId = useWorkspaceStore((s) => s.activeCompanyId)
  const allStoreProcesses = useProcessStore((s) => s.processes)
  const allStoreMacros = useProcessStore((s) => s.macroprocesses)
  const allStoreRisks = useRiskStore((s) => s.risks)
  const allStoreIndicators = useIndicatorStore((s) => s.indicators)
  const allStoreProcedures = useProcedureStore((s) => s.procedures)
  const allAudits = useAuditStore((s) => s.audits)
  const allAnalyses = useValueAnalysisStore((s) => s.analyses)
  const allStoreImprovements = useImprovementStore((s) => s.opportunities)

  // Filter by active company
  const processes = useMemo(() => allStoreProcesses.filter((p) => !p.company_id || p.company_id === activeCompanyId), [allStoreProcesses, activeCompanyId])
  const macroprocesses = useMemo(() => allStoreMacros.filter((m) => !m.company_id || m.company_id === activeCompanyId), [allStoreMacros, activeCompanyId])

  const processLevelCount = useCompanyStore((s) => s.company?.process_level_count ?? 3)
  const processLevelNames = useCompanyStore((s) => s.processLevelNames)
  const getLevelName = (level: number) =>
    processLevelNames.find((l) => l.level_number === level)?.name ?? `Nivel ${level}`

  // Tabla de Cobertura: solo los procesos del nivel más bajo declarado.
  // NO "los que no tienen hijos" — una rama vacía no es una hoja, y confundirlo
  // es lo que invitaba a documentar en el nivel intermedio. Ver @/lib/processLevels.
  const documentableProcesses = useMemo(
    () => processes.filter((p) => isDocumentable(p, processLevelCount)),
    [processes, processLevelCount]
  )
  // Cobertura: búsqueda + expandir para llegar a CUALQUIER subproceso desde el
  // dashboard (antes solo se veían 10 y el resto quedaba inalcanzable).
  const [coverageQuery, setCoverageQuery] = useState('')
  const [coverageExpanded, setCoverageExpanded] = useState(false)
  const coverageFiltered = useMemo(() => {
    const q = coverageQuery.trim().toLowerCase()
    if (!q) return documentableProcesses
    return documentableProcesses.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.management || '').toLowerCase().includes(q) ||
      (p.coordination || '').toLowerCase().includes(q))
  }, [documentableProcesses, coverageQuery])
  const coverageVisible = (coverageExpanded || coverageQuery.trim()) ? coverageFiltered : coverageFiltered.slice(0, 10)

  // El nivel más bajo es, por definición, el número de niveles declarado.
  const coverageLabel = getLevelName(processLevelCount)
  const processIds = useMemo(() => new Set(processes.map((p) => p.id)), [processes])
  const allRisks = useMemo(() => allStoreRisks.filter((r) => processIds.has(r.process_id)), [allStoreRisks, processIds])
  const allIndicators = useMemo(() => allStoreIndicators.filter((i) => !i.company_id || i.company_id === activeCompanyId), [allStoreIndicators, activeCompanyId])
  const allProcedures = useMemo(() => allStoreProcedures.filter((p) => processIds.has(p.process_id)), [allStoreProcedures, processIds])
  const improvementsByProcess = useMemo(() => {
    const counts: Record<string, number> = {}
    allStoreImprovements.forEach((o) => { if (processIds.has(o.processId)) counts[o.processId] = (counts[o.processId] || 0) + 1 })
    return counts
  }, [allStoreImprovements, processIds])

  const improvementStats = useMemo(() => {
    const opps = allStoreImprovements.filter((o) => processIds.has(o.processId))
    const abiertas = opps.filter((o) => o.status !== 'cerrada' && o.status !== 'descartada').length
    const cerradas = opps.filter((o) => o.status === 'cerrada').length
    const quickWins = opps.filter((o) => (o.costScore + o.complexityScore + o.timeScore) >= 12 && o.status !== 'cerrada' && o.status !== 'descartada').length
    return { total: opps.length, abiertas, cerradas, quickWins }
  }, [allStoreImprovements, processIds])

  // Weekly digest stores
  const scoreHistory = useBenchmarkStore((s) => s.scoreHistory)
  const recordSnapshot = useDashboardSnapshotStore((s) => s.recordSnapshot)
  const getLastSnapshot = useDashboardSnapshotStore((s) => s.getLastSnapshot)
  const [digestOpen, setDigestOpen] = useState(false)

  const stats = useMemo(() => {
    const bpmnCount = processes.filter(p => p.bpmn_xml).length
    const procedureCount = allProcedures.length
    const processesWithBpmn = new Set(processes.filter(p => p.bpmn_xml).map(p => p.id))
    const processesWithProcedure = new Set(allProcedures.map(p => p.process_id))
    const bpmnWithoutProcedure = [...processesWithBpmn].filter(id => !processesWithProcedure.has(id)).length

    // Risks
    const totalRisks = allRisks.length
    const totalControls = allRisks.reduce((s, r) => s + r.controls.length, 0)
    const highRisks = allRisks.filter(r => {
      const level = getRiskLevel(r.inherentProbability, r.inherentImpact)
      return level.label === 'Extremo' || level.label === 'Alto'
    }).length
    const processesWithRisks = new Set(allRisks.map(r => r.process_id))

    // KPIs
    const totalKpis = allIndicators.length
    const processesWithKpis = new Set(allIndicators.map(i => i.process_id))
    const processesWithoutKpis = processes.filter(p => p.bpmn_xml && !processesWithKpis.has(p.id)).length

    // Audit
    const auditEntries = Object.entries(allAudits)
    const totalAuditItems = auditEntries.reduce((s, [, items]) => s + items.length, 0)
    const processesWithAudit = auditEntries.filter(([, items]) => items.length > 0).length
    const processesWithoutAudit = processes.filter(p => p.bpmn_xml && !(allAudits[p.id]?.length > 0)).length

    // Value Analysis
    const analysisEntries = Object.entries(allAnalyses)
    const allValueActivities = analysisEntries.flatMap(([, acts]) => acts)
    const nvaActivities = allValueActivities.filter(a => a.classification === 'NVA')
    const nvabnActivities = allValueActivities.filter(a => a.classification === 'NVABN')
    const vaActivities = allValueActivities.filter(a => a.classification === 'VA')
    const totalNvaMinutes = nvaActivities.reduce((s, a) => s + a.dailyMinutes, 0)
    const totalDailyMinutes = allValueActivities.reduce((s, a) => s + a.dailyMinutes, 0)
    const vaEfficiency = totalDailyMinutes > 0 ? Math.round((vaActivities.reduce((s, a) => s + a.dailyMinutes, 0) / totalDailyMinutes) * 100) : 0

    const depth1Ids = new Set(
      processes.filter((p) => p.parent_process_id === null).map((p) => p.id)
    )
    const depth1Count = depth1Ids.size
    const depth2Count = processes.filter(
      (p) => p.parent_process_id !== null && depth1Ids.has(p.parent_process_id!)
    ).length

    return {
      macroCount: macroprocesses.length,
      processCount: processes.length,
      depth1Count,
      depth2Count,
      bpmnCount,
      procedureCount,
      bpmnWithoutProcedure,
      totalRisks,
      totalControls,
      highRisks,
      processesWithRisks: processesWithRisks.size,
      totalKpis,
      processesWithoutKpis,
      totalAuditItems,
      processesWithAudit,
      processesWithoutAudit,
      nvaCount: nvaActivities.length,
      nvabnCount: nvabnActivities.length,
      vaCount: vaActivities.length,
      totalNvaMinutesDaily: Math.round(totalNvaMinutes),
      vaEfficiency,
    }
  }, [processes, macroprocesses, allRisks, allIndicators, allProcedures, allAudits, allAnalyses])

  // Record weekly snapshot
  useEffect(() => {
    if (!activeCompanyId) return
    recordSnapshot({
      macroCount: stats.macroCount,
      processCount: stats.processCount,
      depth1Count: stats.depth1Count,
      depth2Count: stats.depth2Count,
      bpmnCount: stats.bpmnCount,
      procedureCount: stats.procedureCount,
      totalRisks: stats.totalRisks,
      totalControls: stats.totalControls,
      totalKpis: stats.totalKpis,
      totalAuditItems: stats.totalAuditItems,
      vaEfficiency: stats.vaEfficiency,
    }, activeCompanyId)
  }, [stats, recordSnapshot, activeCompanyId])

  const prevSnapshot = getLastSnapshot()

  // Weekly digest data
  const weeklyDigest = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)

    // Count processes created this week
    const processesThisWeek = processes.filter((p) => {
      if (!p.created_at) return false
      return new Date(p.created_at) >= weekAgo
    }).length

    // Maturity score delta
    let scoreDelta = 0
    if (scoreHistory.length >= 2) {
      const latest = scoreHistory[scoreHistory.length - 1]
      // Find most recent entry older than 7 days
      const prev = [...scoreHistory].reverse().find(
        (e) => new Date(e.date) < weekAgo
      )
      if (prev) scoreDelta = latest.score - prev.score
    }

    return {
      processesThisWeek,
      totalRisks: allRisks.length,
      totalKpis: allIndicators.length,
      scoreDelta,
    }
  }, [processes, allRisks.length, allIndicators.length, scoreHistory])

  // Process health scores
  const healthMap = useProcessHealth()

  // Auto-detect onboarding milestones and achievements
  useOnboardingTracker()
  useAchievementTracker()

  // Near-achievement nudges
  const progress = useAchievementProgress()
  const unlockedAchievements = useAchievementStore((s) => s.unlockedAchievements)
  const catalog = useAchievementStore((s) => s.catalog)

  const nudges = useMemo(() => {
    const unlockedIds = new Set(unlockedAchievements.map((u) => u.achievementId))
    return catalog
      .filter((a) => {
        if (unlockedIds.has(a.id)) return false
        const p = progress[a.id]
        if (!p || p.target <= 0) return false
        const pct = p.current / p.target
        return pct >= 0.7 && pct < 1
      })
      .map((a) => {
        const p = progress[a.id]
        const remaining = p.target - p.current
        return { ...a, remaining, current: p.current, target: p.target }
      })
      .slice(0, 2)
  }, [catalog, unlockedAchievements, progress])

  return (
    <div className="space-y-6">
      {/* La racha se retiró el 2026-08-08: medía asistencia, no avance, y además
          chocaba con el desplegable de perfil de la cabecera nueva. */}
      <PageHeader
        icon={LayoutDashboard}
        title={`Bienvenido${profile?.full_name ? `, ${profile.full_name}` : ''}`}
        subtitle="Tu espacio de gestion de procesos"
      />

      {/* Near-achievement nudges */}
      {nudges.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {nudges.map((nudge) => {
            const Icon = NUDGE_ICON_MAP[nudge.icon] ?? Star
            const route = CATEGORY_ROUTE[nudge.category] ?? '/app/process-map'
            return (
              <Link
                key={nudge.id}
                to={route}
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 transition-colors hover:border-primary-300 hover:bg-primary-50"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50">
                  <Icon className="h-4 w-4 text-primary-600" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-amber-700">
                    Te falta{nudge.remaining === 1 ? '' : 'n'} {nudge.remaining} para desbloquear <span className="font-semibold text-gray-900">'{nudge.title}'</span>
                  </span>
                  <span className="text-[10px] text-primary-600">+{nudge.points} pts</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Weekly Digest */}
      <div className="ck-card">
        <div className="p-4">
          <button
            onClick={() => setDigestOpen((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-gray-900">Resumen Semanal</span>
            </div>
            {digestOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>
          {digestOpen && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs text-gray-600">
              <div className="flex flex-col gap-0.5">
                <span className="text-lg font-bold text-primary-600">{weeklyDigest.processesThisWeek}</span>
                <span>Creaste {weeklyDigest.processesThisWeek} procesos</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-lg font-bold text-red-600">{weeklyDigest.totalRisks}</span>
                <span>Identificaste {weeklyDigest.totalRisks} riesgos</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-lg font-bold text-emerald-600">{weeklyDigest.totalKpis}</span>
                <span>Definiste {weeklyDigest.totalKpis} KPIs</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className={`text-lg font-bold ${weeklyDigest.scoreDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {weeklyDigest.scoreDelta >= 0 ? '+' : ''}{weeklyDigest.scoreDelta}
                </span>
                <span>Tu score de madurez {weeklyDigest.scoreDelta >= 0 ? 'subio' : 'bajo'} {Math.abs(weeklyDigest.scoreDelta)} puntos</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Onboarding Checklist */}
      <OnboardingChecklist />

      {/* ═══ Row 1: Process Overview ═══ */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Procesos</h2>
        <div className={`grid grid-cols-2 gap-3 ${processLevelCount >= 3 ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
          <StatCard icon={Layers}    color="cyan"    label={getLevelName(1)}   value={stats.macroCount}    prevValue={prevSnapshot?.macroCount} />
          <StatCard icon={BarChart3} color="blue"    label={getLevelName(2)}   value={stats.depth1Count}   prevValue={prevSnapshot?.depth1Count} />
          {processLevelCount >= 3 && (
            <StatCard icon={Workflow} color="indigo" label={getLevelName(3)}   value={stats.depth2Count}   prevValue={prevSnapshot?.depth2Count} />
          )}
          <StatCard icon={GitBranch} color="purple"  label="Diagramas BPMN"   value={stats.bpmnCount}     prevValue={prevSnapshot?.bpmnCount} />
          <StatCard icon={BookOpen}  color="emerald" label="Procedimientos"    value={stats.procedureCount}
            badge={stats.bpmnWithoutProcedure > 0 ? `${stats.bpmnWithoutProcedure} sin procedimiento` : undefined}
            badgeColor="amber"
            prevValue={prevSnapshot?.procedureCount}
          />
        </div>
      </div>

      {/* ═══ Row 2: Risks & Controls ═══ */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Riesgos y Controles</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={ShieldAlert} color="red" label="Riesgos Identificados" value={stats.totalRisks}
            badge={stats.highRisks > 0 ? `${stats.highRisks} alto/extremo` : undefined}
            badgeColor="red"
            prevValue={prevSnapshot?.totalRisks}
          />
          <StatCard icon={Target} color="amber" label="Controles" value={stats.totalControls} prevValue={prevSnapshot?.totalControls} />
          <StatCard icon={ClipboardCheck} color="violet" label="Items de Auditoria" value={stats.totalAuditItems}
            badge={stats.processesWithoutAudit > 0 ? `${stats.processesWithoutAudit} sin auditoria` : undefined}
            badgeColor="amber"
            prevValue={prevSnapshot?.totalAuditItems}
          />
          <StatCard icon={TrendingUp} color="cyan" label="KPIs Definidos" value={stats.totalKpis}
            badge={stats.processesWithoutKpis > 0 ? `${stats.processesWithoutKpis} sin KPIs` : undefined}
            badgeColor="amber"
            prevValue={prevSnapshot?.totalKpis}
          />
        </div>
      </div>

      {/* ═══ Row 3: Value Analysis ═══ */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Analisis de Valor</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Activity} color="emerald" label="Actividades VA" value={stats.vaCount} />
          <StatCard icon={Zap} color="red" label="Actividades NVA" value={stats.nvaCount}
            badge={stats.totalNvaMinutesDaily > 0 ? `${stats.totalNvaMinutesDaily} min/dia desperdicio` : undefined}
            badgeColor="red"
          />
          <StatCard icon={AlertTriangle} color="amber" label="Actividades NVABN" value={stats.nvabnCount} />
          <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 hover:border-emerald-200 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-emerald-50 rounded-lg ring-1 ring-emerald-500">
                <TrendingUp className="text-emerald-600" size={16} />
              </div>
              <span className="text-xs text-gray-500">Eficiencia VA</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{stats.vaEfficiency}%</p>
            <div className="mt-2 h-1.5 rounded-full bg-gray-50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-primary-500"
                style={{ width: `${Math.min(stats.vaEfficiency, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Row 4: Mejoras ═══ */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Mejoras</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Lightbulb} color="amber" label="Oportunidades" value={improvementStats.total} />
          <StatCard icon={Zap} color="emerald" label="Quick wins" value={improvementStats.quickWins} />
          <StatCard icon={Activity} color="cyan" label="Abiertas" value={improvementStats.abiertas} />
          <StatCard icon={CheckCircle2} color="violet" label="Cerradas" value={improvementStats.cerradas} />
        </div>
      </div>

      {/* ═══ Row 5: Coverage Matrix ═══ */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cobertura por Proceso</h2>
          <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg border border-gray-200 px-2.5 py-1.5 w-full max-w-[260px]">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input type="text" value={coverageQuery} onChange={(e) => setCoverageQuery(e.target.value)}
              placeholder={`Buscar ${coverageLabel.toLowerCase()}…`}
              className="bg-transparent text-xs text-gray-900 placeholder-gray-400 outline-none flex-1 min-w-0" />
            {coverageQuery && <button onClick={() => setCoverageQuery('')} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={12} /></button>}
          </div>
        </div>
        {/* `overflow-x-auto`, no `overflow-hidden`: son 8 columnas de datos y antes se
            aplastaban dentro de un contenedor que ademas impedia desplazarlas. */}
        <div className="bg-gray-50 rounded-lg border border-gray-100 overflow-x-auto">
          <div className="min-w-[860px]">
          <div className="grid grid-cols-10 gap-px bg-gray-50 text-[10px] text-gray-400 uppercase">
            <div className="bg-white px-3 py-2 col-span-2">{coverageLabel}</div>
            <div className="bg-white px-3 py-2 text-center">BPMN</div>
            <div className="bg-white px-3 py-2 text-center">Procedimiento</div>
            <div className="bg-white px-3 py-2 text-center">KPIs</div>
            <div className="bg-white px-3 py-2 text-center">Riesgos</div>
            <div className="bg-white px-3 py-2 text-center">Auditoria</div>
            <div className="bg-white px-3 py-2 text-center">Valor</div>
            <div className="bg-white px-3 py-2 text-center">Mejoras</div>
            <div className="bg-white px-3 py-2 text-center">Madurez</div>
          </div>
          <div className={coverageExpanded || coverageQuery.trim() ? 'max-h-[480px] overflow-y-auto' : ''}>
          {coverageVisible.map((p) => {
            const hasBpmn = !!p.bpmn_xml
            const hasProcedure = allProcedures.some(pr => pr.process_id === p.id)
            const kpiCount = allIndicators.filter(i => i.process_id === p.id).length
            const riskCount = allRisks.filter(r => r.process_id === p.id).length
            const auditCount = allAudits[p.id]?.length || 0
            const valueCount = allAnalyses[p.id]?.length || 0
            const improvementCount = improvementsByProcess[p.id] || 0
            const health = healthMap[p.id]

            // Sin cupo, la caracterizacion rebota (tiene `useDocumentableGuard`), asi
            // que la fila deja de ser un enlace: pulsar y que te expulsen es peor que
            // no poder pulsar. La tabla de cobertura se sigue viendo entera.
            const sinCupo = !plan.puedeDocumentar(p.id)
            // Sin cupo la fila deja de ser enlace, pero SIGUE respondiendo: al pulsarla
            // explica por que. Una fila muerta no dice nada.
            const Fila = sinCupo ? 'div' : Link
            const propsDeFila = sinCupo
              ? {
                  title: mensajeSinCupo(plan.level, plan.cap),
                  onClick: () => { avisarSiSinCupo(true, plan.level, plan.cap) },
                }
              : { to: `/app/process/${p.id}/characterization` }

            return (
              <Fila
                key={p.id}
                {...(propsDeFila as { to: string })}
                className={`grid grid-cols-10 gap-px bg-gray-50 transition-colors group ${
                  sinCupo ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
                }`}
              >
                <div className="bg-white px-3 py-2 col-span-2 text-[11px] text-gray-700 group-hover:text-primary-600 truncate transition-colors">
                  {p.name}
                </div>
                <CoverageCell active={hasBpmn} />
                <CoverageCell active={hasProcedure} />
                <CoverageCell active={kpiCount > 0} count={kpiCount} />
                <CoverageCell active={riskCount > 0} count={riskCount} />
                <CoverageCell active={auditCount > 0} count={auditCount} />
                <CoverageCell active={valueCount > 0} count={valueCount} />
                <CoverageCell active={improvementCount > 0} count={improvementCount} />
                <div className="bg-white px-3 py-2 flex items-center justify-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${
                    (health?.score ?? 0) >= 67 ? 'bg-emerald-500' :
                    (health?.score ?? 0) >= 33 ? 'bg-amber-500' :
                    'bg-red-500'
                  }`} />
                  <span className={`text-[10px] ${
                    (health?.score ?? 0) >= 67 ? 'text-emerald-600' :
                    (health?.score ?? 0) >= 33 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>{health?.score ?? 0}%</span>
                </div>
              </Fila>
            )
          })}
          {coverageQuery.trim() && coverageFiltered.length === 0 && (
            <div className="bg-white px-3 py-4 text-center text-[11px] text-gray-400">
              Ningún {coverageLabel.toLowerCase()} coincide con «{coverageQuery.trim()}».
            </div>
          )}
          </div>
          {!coverageQuery.trim() && documentableProcesses.length > 10 && (
            <button onClick={() => setCoverageExpanded((v) => !v)}
              className="w-full bg-white px-3 py-2 text-center text-[11px] text-primary-700 hover:text-primary-700 inline-flex items-center justify-center gap-1.5 transition-colors">
              {coverageExpanded
                ? (<><ChevronUp size={13} /> Ver menos</>)
                : (<><ChevronDown size={13} /> Ver todos ({documentableProcesses.length})</>)}
            </button>
          )}
          </div>
          {/* El estado vacio queda FUERA del `min-w`: no tiene columnas que desplazar */}
          {documentableProcesses.length === 0 && (
            <div className="bg-white">
              <EmptyState
                icon={Layers}
                title={processes.length > 0 ? `Sin ${coverageLabel.toLowerCase()}s` : 'Sin procesos'}
                description={
                  processes.length > 0
                    ? `Tu estructura declara ${processLevelCount} niveles, asi que la documentacion se genera en el nivel de ${coverageLabel.toLowerCase()}. Baja un nivel en el mapa y crea los ${coverageLabel.toLowerCase()}s.`
                    : 'Crea tu primer proceso para ver la cobertura'
                }
                actionLabel="Ir al Mapa de Procesos"
                actionHref="/app/process-map"
              />
            </div>
          )}
        </div>
      </div>

      {/* ═══ Benchmarking ═══ */}
      <BenchmarkCard />

      {/* ═══ Quick Links ═══ */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Accesos rapidos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="group bg-gray-50 rounded-lg border border-gray-100 p-4 hover:border-primary-200 hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-50 rounded-lg ring-1 ring-primary-500 group-hover:ring-primary-500 transition-all">
                    <link.icon className="text-primary-600" size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{link.label}</h3>
                    <p className="text-[10px] text-gray-400">{link.description}</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-primary-600 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──

const COLOR_MAP: Record<string, { bg: string; ring: string; text: string; hoverBorder: string }> = {
  cyan:    { bg: 'bg-primary-50',    ring: 'ring-primary-500',    text: 'text-primary-600',    hoverBorder: 'hover:border-primary-200' },
  blue:    { bg: 'bg-blue-50',    ring: 'ring-blue-500',    text: 'text-blue-600',    hoverBorder: 'hover:border-blue-200' },
  purple:  { bg: 'bg-primary-50',  ring: 'ring-primary-500',  text: 'text-primary-600',  hoverBorder: 'hover:border-primary-200' },
  emerald: { bg: 'bg-emerald-50', ring: 'ring-emerald-500', text: 'text-emerald-600', hoverBorder: 'hover:border-emerald-200' },
  red:     { bg: 'bg-red-50',     ring: 'ring-red-500',     text: 'text-red-600',     hoverBorder: 'hover:border-red-200' },
  amber:   { bg: 'bg-amber-50',   ring: 'ring-amber-500',   text: 'text-amber-600',   hoverBorder: 'hover:border-amber-200' },
  violet:  { bg: 'bg-primary-50',  ring: 'ring-primary-500',  text: 'text-primary-600', hoverBorder: 'hover:border-primary-200' },
}

function StatCard({ icon: Icon, color, label, value, badge, badgeColor, prevValue }: {
  icon: React.ElementType; color: string; label: string; value: number
  badge?: string; badgeColor?: string; prevValue?: number
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.cyan
  const diff = prevValue !== undefined ? value - prevValue : undefined
  return (
    <div className={`bg-gray-50 rounded-lg border border-gray-100 p-4 ${c.hoverBorder} transition-colors`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-2 ${c.bg} rounded-lg ring-1 ${c.ring}`}>
          <Icon className={c.text} size={16} />
        </div>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {diff !== undefined && diff !== 0 && (
        <p className={`text-[9px] mt-0.5 ${diff > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {diff > 0 ? `↑ ${diff}` : `↓ ${Math.abs(diff)}`}
        </p>
      )}
      {badge && (
        <p className={`text-[9px] mt-1 ${badgeColor === 'red' ? 'text-red-600' : 'text-amber-600'}`}>
          {badge}
        </p>
      )}
    </div>
  )
}

function CoverageCell({ active, count }: { active: boolean; count?: number }) {
  return (
    <div className="bg-white px-3 py-2 flex items-center justify-center">
      {active ? (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {count !== undefined && count > 0 && (
            <span className="text-[10px] text-gray-500">{count}</span>
          )}
        </span>
      ) : (
        <span className="w-2 h-2 rounded-full bg-gray-100" />
      )}
    </div>
  )
}
