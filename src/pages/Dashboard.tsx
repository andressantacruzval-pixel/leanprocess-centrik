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
import { useCompanyStore } from '@/stores/companyStore'
import { useBenchmarkStore } from '@/features/benchmarking/benchmarkStore'
import { useDashboardSnapshotStore } from '@/stores/dashboardSnapshotStore'
import { getRiskLevel } from '@/types/risk'
import {
  Layers, BarChart3, GitBranch, ShieldAlert, ClipboardCheck,
  Activity, FileText, TrendingUp, AlertTriangle, BookOpen,
  ArrowRight, Map, Zap, Target, LayoutDashboard,
  Footprints, Building2, Crown, Workflow, Shield, ShieldCheck, ShieldPlus,
  BookMarked, Flame, Sparkles, Trophy, Star, Award, Share2, Users,
  ChevronDown, ChevronUp,
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
  // El nivel más bajo es, por definición, el número de niveles declarado.
  const coverageLabel = getLevelName(processLevelCount)
  const processIds = useMemo(() => new Set(processes.map((p) => p.id)), [processes])
  const allRisks = useMemo(() => allStoreRisks.filter((r) => processIds.has(r.process_id)), [allStoreRisks, processIds])
  const allIndicators = useMemo(() => allStoreIndicators.filter((i) => !i.company_id || i.company_id === activeCompanyId), [allStoreIndicators, activeCompanyId])
  const allProcedures = useMemo(() => allStoreProcedures.filter((p) => processIds.has(p.process_id)), [allStoreProcedures, processIds])

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
                className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/5"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
                  <Icon className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-amber-300">
                    Te falta{nudge.remaining === 1 ? '' : 'n'} {nudge.remaining} para desbloquear <span className="font-semibold text-white">'{nudge.title}'</span>
                  </span>
                  <span className="text-[10px] text-cyan-400/70">+{nudge.points} pts</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Weekly Digest */}
      <div className="rounded-2xl border border-transparent bg-white/[0.03] p-[1px]" style={{ backgroundImage: 'linear-gradient(#0a0f1a, #0a0f1a), linear-gradient(135deg, #f59e0b, #06b6d4)', backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' }}>
        <div className="rounded-2xl bg-[#0a0f1a] p-4">
          <button
            onClick={() => setDigestOpen((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-white">Resumen Semanal</span>
            </div>
            {digestOpen ? (
              <ChevronUp className="h-4 w-4 text-white/40" />
            ) : (
              <ChevronDown className="h-4 w-4 text-white/40" />
            )}
          </button>
          {digestOpen && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs text-white/60">
              <div className="flex flex-col gap-0.5">
                <span className="text-lg font-bold text-cyan-400">{weeklyDigest.processesThisWeek}</span>
                <span>Creaste {weeklyDigest.processesThisWeek} procesos</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-lg font-bold text-red-400">{weeklyDigest.totalRisks}</span>
                <span>Identificaste {weeklyDigest.totalRisks} riesgos</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-lg font-bold text-emerald-400">{weeklyDigest.totalKpis}</span>
                <span>Definiste {weeklyDigest.totalKpis} KPIs</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className={`text-lg font-bold ${weeklyDigest.scoreDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Procesos</h2>
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
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Riesgos y Controles</h2>
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
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Analisis de Valor</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Activity} color="emerald" label="Actividades VA" value={stats.vaCount} />
          <StatCard icon={Zap} color="red" label="Actividades NVA" value={stats.nvaCount}
            badge={stats.totalNvaMinutesDaily > 0 ? `${stats.totalNvaMinutesDaily} min/dia desperdicio` : undefined}
            badgeColor="red"
          />
          <StatCard icon={AlertTriangle} color="amber" label="Actividades NVABN" value={stats.nvabnCount} />
          <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4 hover:border-emerald-500/20 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg ring-1 ring-emerald-500/20">
                <TrendingUp className="text-emerald-400" size={16} />
              </div>
              <span className="text-xs text-white/40">Eficiencia VA</span>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{stats.vaEfficiency}%</p>
            <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all"
                style={{ width: `${Math.min(stats.vaEfficiency, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Row 4: Coverage Matrix ═══ */}
      <div>
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Cobertura por Proceso</h2>
        {/* `overflow-x-auto`, no `overflow-hidden`: son 8 columnas de datos y antes se
            aplastaban dentro de un contenedor que ademas impedia desplazarlas. */}
        <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-x-auto">
          <div className="min-w-[760px]">
          <div className="grid grid-cols-9 gap-px bg-white/5 text-[10px] text-white/30 uppercase">
            <div className="bg-[#0a0f1a] px-3 py-2 col-span-2">{coverageLabel}</div>
            <div className="bg-[#0a0f1a] px-3 py-2 text-center">BPMN</div>
            <div className="bg-[#0a0f1a] px-3 py-2 text-center">Procedimiento</div>
            <div className="bg-[#0a0f1a] px-3 py-2 text-center">KPIs</div>
            <div className="bg-[#0a0f1a] px-3 py-2 text-center">Riesgos</div>
            <div className="bg-[#0a0f1a] px-3 py-2 text-center">Auditoria</div>
            <div className="bg-[#0a0f1a] px-3 py-2 text-center">Valor</div>
            <div className="bg-[#0a0f1a] px-3 py-2 text-center">Salud</div>
          </div>
          {documentableProcesses.slice(0, 10).map((p) => {
            const hasBpmn = !!p.bpmn_xml
            const hasProcedure = allProcedures.some(pr => pr.process_id === p.id)
            const kpiCount = allIndicators.filter(i => i.process_id === p.id).length
            const riskCount = allRisks.filter(r => r.process_id === p.id).length
            const auditCount = allAudits[p.id]?.length || 0
            const valueCount = allAnalyses[p.id]?.length || 0
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
                className={`grid grid-cols-9 gap-px bg-white/5 transition-colors group ${
                  sinCupo ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/[0.08]'
                }`}
              >
                <div className="bg-[#0a0f1a] px-3 py-2 col-span-2 text-[11px] text-white/70 group-hover:text-cyan-400 truncate transition-colors">
                  {p.name}
                </div>
                <CoverageCell active={hasBpmn} />
                <CoverageCell active={hasProcedure} />
                <CoverageCell active={kpiCount > 0} count={kpiCount} />
                <CoverageCell active={riskCount > 0} count={riskCount} />
                <CoverageCell active={auditCount > 0} count={auditCount} />
                <CoverageCell active={valueCount > 0} count={valueCount} />
                <div className="bg-[#0a0f1a] px-3 py-2 flex items-center justify-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${
                    (health?.score ?? 0) >= 67 ? 'bg-emerald-400' :
                    (health?.score ?? 0) >= 33 ? 'bg-amber-400' :
                    'bg-red-400'
                  }`} />
                  <span className={`text-[10px] ${
                    (health?.score ?? 0) >= 67 ? 'text-emerald-400/70' :
                    (health?.score ?? 0) >= 33 ? 'text-amber-400/70' :
                    'text-red-400/70'
                  }`}>{health?.score ?? 0}%</span>
                </div>
              </Fila>
            )
          })}
          {documentableProcesses.length > 10 && (
            <div className="bg-[#0a0f1a] px-3 py-2 text-center text-[10px] text-white/20">
              +{documentableProcesses.length - 10} procesos mas...
            </div>
          )}
          </div>
          {/* El estado vacio queda FUERA del `min-w`: no tiene columnas que desplazar */}
          {documentableProcesses.length === 0 && (
            <div className="bg-[#0a0f1a]">
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
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Accesos rapidos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className="group bg-white/[0.03] rounded-2xl border border-white/5 p-4 hover:border-cyan-500/20 hover:bg-white/[0.05] transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/10 rounded-lg ring-1 ring-cyan-500/20 group-hover:ring-cyan-500/40 transition-all">
                    <link.icon className="text-cyan-400" size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-white">{link.label}</h3>
                    <p className="text-[10px] text-white/30">{link.description}</p>
                  </div>
                </div>
                <ArrowRight size={14} className="text-white/10 group-hover:text-cyan-400/50 transition-colors" />
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
  cyan:    { bg: 'bg-cyan-500/10',    ring: 'ring-cyan-500/20',    text: 'text-cyan-400',    hoverBorder: 'hover:border-cyan-500/20' },
  blue:    { bg: 'bg-blue-500/10',    ring: 'ring-blue-500/20',    text: 'text-blue-400',    hoverBorder: 'hover:border-blue-500/20' },
  purple:  { bg: 'bg-purple-500/10',  ring: 'ring-purple-500/20',  text: 'text-purple-400',  hoverBorder: 'hover:border-purple-500/20' },
  emerald: { bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/20', text: 'text-emerald-400', hoverBorder: 'hover:border-emerald-500/20' },
  red:     { bg: 'bg-red-500/10',     ring: 'ring-red-500/20',     text: 'text-red-400',     hoverBorder: 'hover:border-red-500/20' },
  amber:   { bg: 'bg-amber-500/10',   ring: 'ring-amber-500/20',   text: 'text-amber-400',   hoverBorder: 'hover:border-amber-500/20' },
  violet:  { bg: 'bg-violet-500/10',  ring: 'ring-violet-500/20',  text: 'text-violet-400', hoverBorder: 'hover:border-violet-500/20' },
}

function StatCard({ icon: Icon, color, label, value, badge, badgeColor, prevValue }: {
  icon: React.ElementType; color: string; label: string; value: number
  badge?: string; badgeColor?: string; prevValue?: number
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.cyan
  const diff = prevValue !== undefined ? value - prevValue : undefined
  return (
    <div className={`bg-white/[0.03] rounded-2xl border border-white/5 p-4 ${c.hoverBorder} transition-colors`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-2 ${c.bg} rounded-lg ring-1 ${c.ring}`}>
          <Icon className={c.text} size={16} />
        </div>
        <span className="text-xs text-white/40">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {diff !== undefined && diff !== 0 && (
        <p className={`text-[9px] mt-0.5 ${diff > 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
          {diff > 0 ? `↑ ${diff}` : `↓ ${Math.abs(diff)}`}
        </p>
      )}
      {badge && (
        <p className={`text-[9px] mt-1 ${badgeColor === 'red' ? 'text-red-400/70' : 'text-amber-400/70'}`}>
          {badge}
        </p>
      )}
    </div>
  )
}

function CoverageCell({ active, count }: { active: boolean; count?: number }) {
  return (
    <div className="bg-[#0a0f1a] px-3 py-2 flex items-center justify-center">
      {active ? (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          {count !== undefined && count > 0 && (
            <span className="text-[10px] text-white/40">{count}</span>
          )}
        </span>
      ) : (
        <span className="w-2 h-2 rounded-full bg-white/10" />
      )}
    </div>
  )
}
