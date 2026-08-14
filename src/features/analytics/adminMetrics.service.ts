import { supabase } from '@/lib/supabase'
import type { AdminMetrics, DateRange, OnboardingUserSummary } from '@/stores/analyticsStore'

const FEATURE_LABEL: Record<string, string> = {
  bpmn_generation:       'Generar BPMN',
  bpmn_interview:        'Entrevista BPMN',
  procedure_generation:  'Generar Procedimiento',
  risk_identification:   'Identificar Riesgos',
  audit_generation:      'Generar Auditoría',
  kpi_generation:        'Generar KPIs',
  value_classification:  'Clasificar Valor VA/NVA',
  ai_consultant:         'Consultor IA',
  text_improvement:      'Mejorar Texto',
}

const MILESTONE_LABELS: Record<string, string> = {
  'company':        'Empresa',
  'org-structure':  'Organigrama',
  'process-map':    'Mapa de Procesos',
  'bpmn':           'BPMN',
  'procedure':      'Procedimiento',
  'kpi':            'KPI',
  'risk':           'Riesgos',
  'audit':          'Auditoría',
  'value-analysis': 'Análisis Valor',
  'report':         'Reporte',
}

function fromDate(range: DateRange, customFrom?: string): string | null {
  if (customFrom) return customFrom
  if (range === 'all') return null
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

export async function fetchRealAdminMetrics(
  range: DateRange,
  customFrom?: string,
  customTo?: string,
): Promise<AdminMetrics> {
  const since = fromDate(range, customFrom)
  const until = customTo ?? null
  const month30Since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  type AiLogRow = { feature: string; tokens_used: number; user_id: string; created_at: string; estimated_cost_usd?: number }

  const buildAiQuery = () => {
    let q = supabase.from('ai_usage_log').select('feature, tokens_used, user_id, created_at, estimated_cost_usd')
    if (since) q = q.gte('created_at', since)
    if (until) q = q.lte('created_at', until)
    return q as unknown as Promise<{ data: AiLogRow[] | null; error: { message: string } | null }>
  }

  const [
    profilesRes, companiesRes, membershipsRes,
    processesRes, macroprocessesRes, bpmnRes, proceduresRes,
    risksRes, indicatorsRes, auditsRes, valueRes,
    aiUsageRes, activeUsersRes,
  ] = await Promise.all([
    supabase.from('profiles').select('id, plan_type, full_name, email, created_at') as unknown as Promise<{
      data: { id: string; plan_type: string | null; full_name: string | null; email: string; created_at: string }[] | null
      error: { message: string } | null
    }>,
    supabase.from('companies').select('id, user_id, name, onboarding_completed, milestone_completions, process_level_count'),
    supabase.from('memberships').select('user_id'),
    supabase.from('processes').select('id, company_id, parent_process_id'),
    supabase.from('macroprocesses').select('id, company_id'),
    supabase.from('bpmn_diagrams').select('process_id'),
    supabase.from('procedures').select('company_id'),
    supabase.from('risks').select('company_id'),
    supabase.from('indicators').select('company_id'),
    supabase.from('audits').select('id, process_id'),
    supabase.from('value_activities').select('company_id'),
    buildAiQuery(),
    supabase.from('ai_usage_log').select('user_id, created_at').gte('created_at', month30Since).limit(10000),
  ])

  if (profilesRes.error)    console.warn('[adminMetrics] profiles:', profilesRes.error.message)
  if (companiesRes.error)   console.warn('[adminMetrics] companies:', companiesRes.error.message)
  if (membershipsRes.error) console.warn('[adminMetrics] memberships:', membershipsRes.error.message)
  if (activeUsersRes.error) console.warn('[adminMetrics] activeUsers:', activeUsersRes.error.message)

  const profiles       = profilesRes.data      ?? []
  const companies      = companiesRes.data      ?? []
  const memberships    = membershipsRes.data    ?? []
  const processes      = processesRes.data      ?? []
  const macroprocesses = macroprocessesRes.data ?? []
  const bpmn           = bpmnRes.data           ?? []
  const procedures     = proceduresRes.data     ?? []
  const risks          = risksRes.data          ?? []
  const indicators     = indicatorsRes.data     ?? []
  const audits         = auditsRes.data         ?? []
  const valueActs      = valueRes.data          ?? []
  const aiLogs         = (aiUsageRes.data       ?? []) as { feature: string; tokens_used: number; user_id: string; created_at: string; estimated_cost_usd?: number }[]
  const activeLogsAll  = activeUsersRes.data    ?? []

  // ── Usuarios únicos ───────────────────────────────────────────────────────
  const uniqueUserIds = new Set<string>([
    ...companies.map(c => c.user_id as string).filter(Boolean),
    ...memberships.map(m => m.user_id as string).filter(Boolean),
  ])
  const totalUsers     = uniqueUserIds.size > 0 ? uniqueUserIds.size : profiles.length
  const totalCompanies = Math.max(companies.length, 1)

  // ── Plan distribution — field correcto: plan_id ──────────────────────────
  const appProfiles = profiles.filter(p => uniqueUserIds.has(p.id))
  const srcProfiles = appProfiles.length > 0 ? appProfiles : profiles
  const byPlan = { free: 0, community: 0, pro: 0, max: 0 }
  for (const p of srcProfiles) {
    const plan = p.plan_type ?? 'free'
    if (plan === 'community' || plan === 'pro' || plan === 'max') byPlan[plan as 'community' | 'pro' | 'max']++
    else byPlan.free++
  }

  // ── Usuarios activos ──────────────────────────────────────────────────────
  const now = Date.now()
  const activeToday = new Set(
    activeLogsAll
      .filter(l => new Date(l.created_at as string).getTime() > now - 24 * 60 * 60 * 1000)
      .map(l => l.user_id as string)
  ).size
  const activeThisWeek = new Set(
    activeLogsAll
      .filter(l => new Date(l.created_at as string).getTime() > now - 7 * 24 * 60 * 60 * 1000)
      .map(l => l.user_id as string)
  ).size
  const activeThisMonth = new Set(activeLogsAll.map(l => l.user_id as string)).size

  // ── Single pass over aiLogs ───────────────────────────────────────────────
  const RANGE_DAYS: Partial<Record<DateRange, number>> = { '7d': 7, '90d': 90, 'all': 180 }
  const dauDays = RANGE_DAYS[range] ?? 30

  const dauByDay: Record<string, Set<string>> = {}
  const featuresPerUser: Record<string, Set<string>> = {}
  const fByDayMap: Record<string, Record<string, number>> = {}
  const aiByFeature: Record<string, { tokens: number; users: Set<string> }> = {}
  const aiByUser: Record<string, { cost: number; tokens: number }> = {}
  let aiCostAccum = 0
  const aiUserSet = new Set<string>()

  for (const log of aiLogs) {
    const day = log.created_at.slice(0, 10)
    const feat = FEATURE_LABEL[log.feature] ?? log.feature

    if (!dauByDay[day]) dauByDay[day] = new Set()
    dauByDay[day].add(log.user_id)

    if (!featuresPerUser[log.user_id]) featuresPerUser[log.user_id] = new Set()
    featuresPerUser[log.user_id].add(log.feature)

    if (!fByDayMap[day]) fByDayMap[day] = {}
    fByDayMap[day][feat] = (fByDayMap[day][feat] ?? 0) + 1

    if (!aiByFeature[log.feature]) aiByFeature[log.feature] = { tokens: 0, users: new Set() }
    aiByFeature[log.feature].tokens += log.tokens_used ?? 0
    aiByFeature[log.feature].users.add(log.user_id)

    if (!aiByUser[log.user_id]) aiByUser[log.user_id] = { cost: 0, tokens: 0 }
    aiByUser[log.user_id].cost   += log.estimated_cost_usd ?? 0
    aiByUser[log.user_id].tokens += log.tokens_used ?? 0

    aiCostAccum += log.estimated_cost_usd ?? 0
    aiUserSet.add(log.user_id)
  }

  const totalAiCostUsd = Math.round(aiCostAccum * 100) / 100
  const usersWithAI = aiUserSet.size
  const fCounts = Object.values(featuresPerUser).map(s => s.size)
  const avgFeaturesPerUser = fCounts.length > 0 ? Math.round((fCounts.reduce((s, n) => s + n, 0) / fCounts.length) * 10) / 10 : 0

  const dailyActiveUsers: { date: string; count: number }[] = []
  for (let i = dauDays - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = d.toISOString().slice(0, 10)
    dailyActiveUsers.push({ date: ds, count: dauByDay[ds]?.size ?? 0 })
  }

  // ── Registros por día ─────────────────────────────────────────────────────
  const regsByDay: Record<string, number> = {}
  for (const p of profiles) regsByDay[p.created_at.slice(0, 10)] = (regsByDay[p.created_at.slice(0, 10)] ?? 0) + 1
  const registrationsByDay: { date: string; count: number }[] = []
  for (let i = dauDays - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = d.toISOString().slice(0, 10)
    registrationsByDay.push({ date: ds, count: regsByDay[ds] ?? 0 })
  }

  // ── Onboarding state distribution ────────────────────────────────────────
  const completedCount = companies.filter(c => c.onboarding_completed).length
  const inProgressCount = companies.filter(c => {
    if (c.onboarding_completed) return false
    const m = c.milestone_completions as Record<string, boolean> | null
    return m != null && Object.values(m).some(v => v === true)
  }).length
  const onboardingStateDistribution = [
    { state: 'completed' as const,   count: completedCount },
    { state: 'in_progress' as const, count: inProgressCount },
    { state: 'not_started' as const, count: companies.length - completedCount - inProgressCount },
  ]

  // ── Feature usage by day (derived from consolidated loop) ────────────────
  const featureUsageByDay = Object.entries(fByDayMap)
    .flatMap(([date, feats]) => Object.entries(feats).map(([feature, count]) => ({ date, feature, count })))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ── Feature adoption ──────────────────────────────────────────────────────
  const procToCompany: Record<string, string> = {}
  for (const p of processes) procToCompany[p.id] = p.company_id

  const companiesWithProcesses  = new Set(processes.map(p => p.company_id)).size
  const companiesWithBpmn       = new Set(bpmn.map(b => procToCompany[b.process_id]).filter(Boolean)).size
  const companiesWithProcedures = new Set(procedures.map(p => p.company_id)).size
  const companiesWithRisks      = new Set(risks.map(r => r.company_id)).size
  const companiesWithIndicators = new Set(indicators.map(i => i.company_id)).size
  const companiesWithAudits     = new Set(audits.map(a => procToCompany[a.process_id]).filter(Boolean)).size
  const companiesWithValue      = new Set(valueActs.map(v => v.company_id)).size

  const featureUsage = [
    { feature: 'Mapa de Procesos', usersCount: companiesWithProcesses,  percentage: pct(companiesWithProcesses,  totalCompanies) },
    { feature: 'Diagrama BPMN',    usersCount: companiesWithBpmn,        percentage: pct(companiesWithBpmn,        totalCompanies) },
    { feature: 'Riesgos',          usersCount: companiesWithRisks,       percentage: pct(companiesWithRisks,       totalCompanies) },
    { feature: 'KPIs',             usersCount: companiesWithIndicators,  percentage: pct(companiesWithIndicators,  totalCompanies) },
    { feature: 'Procedimientos',   usersCount: companiesWithProcedures,  percentage: pct(companiesWithProcedures,  totalCompanies) },
    { feature: 'Consultor IA',     usersCount: usersWithAI,              percentage: pct(usersWithAI,              totalUsers)     },
    { feature: 'Análisis de Valor',usersCount: companiesWithValue,       percentage: pct(companiesWithValue,       totalCompanies) },
    { feature: 'Auditoría',        usersCount: companiesWithAudits,      percentage: pct(companiesWithAudits,      totalCompanies) },
  ].sort((a, b) => b.percentage - a.percentage)

  // ── Onboarding funnel ────────────────────────────────────────────────────
  const milestoneKeys = ['company','org-structure','process-map','bpmn','procedure','kpi','risk','audit','value-analysis','report']
  const onboardingCompletion = milestoneKeys.map(key => {
    const completed = companies.filter(c => {
      const m = c.milestone_completions as Record<string, boolean> | null
      return m?.[key] === true
    }).length
    return { step: MILESTONE_LABELS[key] ?? key, completed, percentage: pct(completed, totalCompanies) }
  })

  // ── Conversion funnel ─────────────────────────────────────────────────────
  const companiesOnboarded = companies.filter(c => c.onboarding_completed).length
  const conversionFunnel = [
    { step: 'Registro',            count: totalUsers,              percentage: 100 },
    { step: 'Empresa configurada', count: companiesOnboarded,      percentage: pct(companiesOnboarded,      totalUsers) },
    { step: 'Primer proceso',      count: companiesWithProcesses,  percentage: pct(companiesWithProcesses,  totalUsers) },
    { step: 'Primer BPMN',         count: companiesWithBpmn,       percentage: pct(companiesWithBpmn,       totalUsers) },
    { step: 'Procedimiento IA',    count: companiesWithProcedures, percentage: pct(companiesWithProcedures, totalUsers) },
  ]

  // ── AI usage by feature ───────────────────────────────────────────────────
  const aiUsage = Object.entries(aiByFeature)
    .map(([f, d]) => ({
      feature: FEATURE_LABEL[f] ?? f,
      totalTokens: d.tokens,
      avgPerUser: d.users.size > 0 ? Math.round(d.tokens / d.users.size) : 0,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens)

  // ── Processes per company ─────────────────────────────────────────────────
  const procCountByCompany: Record<string, number> = {}
  for (const p of processes) procCountByCompany[p.company_id] = (procCountByCompany[p.company_id] ?? 0) + 1
  const procCounts = Object.values(procCountByCompany)
  const processesPerUser = [
    { bucket: '1-5',   count: procCounts.filter(n => n >= 1  && n <= 5).length  },
    { bucket: '6-10',  count: procCounts.filter(n => n >= 6  && n <= 10).length },
    { bucket: '11-20', count: procCounts.filter(n => n >= 11 && n <= 20).length },
    { bucket: '21-50', count: procCounts.filter(n => n >= 21 && n <= 50).length },
    { bucket: '50+',   count: procCounts.filter(n => n > 50).length             },
  ]
  const avgProcessesPerCompany = companies.length > 0
    ? Math.round((processes.length / companies.length) * 10) / 10
    : 0

  const profileMap: Record<string, typeof profiles[0]> = {}
  for (const p of profiles) profileMap[p.id] = p

  const macroByCompany: Record<string, number> = {}
  for (const m of macroprocesses) macroByCompany[m.company_id] = (macroByCompany[m.company_id] ?? 0) + 1

  const topProcessByCompany: Record<string, number> = {}
  const subProcessByCompany: Record<string, number> = {}
  for (const p of processes) {
    if (p.parent_process_id) subProcessByCompany[p.company_id] = (subProcessByCompany[p.company_id] ?? 0) + 1
    else topProcessByCompany[p.company_id] = (topProcessByCompany[p.company_id] ?? 0) + 1
  }

  const bpmnByCompany: Record<string, number> = {}
  for (const b of bpmn) {
    const cid = procToCompany[b.process_id]
    if (cid) bpmnByCompany[cid] = (bpmnByCompany[cid] ?? 0) + 1
  }

  const procedureByCompany: Record<string, number> = {}
  for (const pr of procedures) { const cid = pr.company_id; if (cid) procedureByCompany[cid] = (procedureByCompany[cid] ?? 0) + 1 }

  const riskByCompany: Record<string, number> = {}
  for (const r of risks) { const cid = r.company_id; if (cid) riskByCompany[cid] = (riskByCompany[cid] ?? 0) + 1 }

  const indicatorByCompany: Record<string, number> = {}
  for (const i of indicators) { const cid = i.company_id; if (cid) indicatorByCompany[cid] = (indicatorByCompany[cid] ?? 0) + 1 }

  const auditByCompany: Record<string, number> = {}
  for (const a of audits) {
    const cid = procToCompany[a.process_id]
    if (cid) auditByCompany[cid] = (auditByCompany[cid] ?? 0) + 1
  }

  const valueByCompany: Record<string, number> = {}
  for (const v of valueActs) valueByCompany[v.company_id] = (valueByCompany[v.company_id] ?? 0) + 1

  const usersWithOnboarding: OnboardingUserSummary[] = companies
    .filter(c => c.onboarding_completed)
    .map(c => {
      const uid     = c.user_id as string
      const cid     = c.id as string
      const profile = profileMap[uid]
      const ai      = aiByUser[uid] ?? { cost: 0, tokens: 0 }
      return {
        id:                   uid,
        name:                 profile?.full_name ?? profile?.email ?? 'Sin nombre',
        email:                profile?.email ?? '',
        companyId:            cid,
        companyName:          (c.name as string) ?? 'Sin empresa',
        plan:                 profile?.plan_type ?? 'free',
        createdAt:            profile?.created_at ?? '',
        totalAiCostUsd:       Math.round(ai.cost * 100) / 100,
        totalTokens:          ai.tokens,
        processLevelCount:    (c.process_level_count as number) ?? 0,
        macroprocessCount:    macroByCompany[cid]      ?? 0,
        topLevelProcessCount: topProcessByCompany[cid] ?? 0,
        subprocessCount:      subProcessByCompany[cid] ?? 0,
        bpmnCount:            bpmnByCompany[cid]       ?? 0,
        procedureCount:       procedureByCompany[cid]  ?? 0,
        riskCount:            riskByCompany[cid]       ?? 0,
        indicatorCount:       indicatorByCompany[cid]  ?? 0,
        auditCount:           auditByCompany[cid]      ?? 0,
        valueActivityCount:   valueByCompany[cid]      ?? 0,
      }
    })

  return {
    totalUsers,
    activeToday,
    activeThisWeek,
    activeThisMonth,
    byPlan,
    byStatus: { trial: 0, active: companiesOnboarded, pastDue: 0, canceled: 0, paused: 0 },
    trialConversion: 0,
    monthlyChurn: 0,
    mrr: 0, arpu: 0, ltv: 0,
    featureUsage,
    featureUsageByPlan: featureUsage.map(f => ({ feature: f.feature, free: 0, community: 0, pro: 0, max: 0 })),
    retentionCohorts: [],
    conversionFunnel,
    revenueByMonth: [],
    addOnsSold: [],
    aiUsage,
    avgSessionsPerWeek: 0,
    avgSessionDuration: 0,
    processesPerUser,
    onboardingCompletion,
    dailyActiveUsers,
    activityHeatmap: [],
    registrationsByDay,
    onboardingStateDistribution,
    totalAiCostUsd,
    avgFeaturesPerUser,
    featureUsageByDay,
    avgProcessesPerCompany,
    usersWithOnboarding,
  }
}
