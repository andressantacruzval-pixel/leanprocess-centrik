import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalyticsStore, type DateRange, type AdminMetrics } from '@/stores/analyticsStore'
import { Download, ChevronDown, Zap, Loader2 } from 'lucide-react'
import { TABS, type TabId } from '../adminConstants'
import { downloadCsv, generateCsvForTab } from '../adminUtils'
import { UsersTab } from '../tabs/UsersTab'
import { FeaturesTab } from '../tabs/FeaturesTab'
import { EngagementTab } from '../tabs/EngagementTab'
import { RevenueTab } from '../tabs/RevenueTab'
import { AchievementsTab } from '../tabs/AchievementsTab'
import { UsersDetailTab } from '../tabs/UsersDetailTab'
import { AdminBillingReportingTab } from '../components/AdminBillingReportingTab'
import { DateRangePicker } from '../components/DateRangePicker'

const EMPTY_METRICS: AdminMetrics = {
  totalUsers: 0, activeToday: 0, activeThisWeek: 0, activeThisMonth: 0,
  byPlan: { free: 0, community: 0, pro: 0, max: 0 },
  byStatus: { trial: 0, active: 0, pastDue: 0, canceled: 0, paused: 0 },
  trialConversion: 0, monthlyChurn: 0, mrr: 0, arpu: 0, ltv: 0,
  featureUsage: [], featureUsageByPlan: [], retentionCohorts: [],
  conversionFunnel: [], revenueByMonth: [], addOnsSold: [], aiUsage: [],
  avgSessionsPerWeek: 0, avgSessionDuration: 0, processesPerUser: [],
  onboardingCompletion: [], dailyActiveUsers: [], activityHeatmap: [],
  registrationsByDay: [], onboardingStateDistribution: [],
  totalAiCostUsd: 0, avgFeaturesPerUser: 0,
  featureUsageByDay: [], avgProcessesPerCompany: 0, usersWithOnboarding: [],
}

export default function AdminPage() {
  const navigate = useNavigate()
  const fetchAdminMetrics = useAnalyticsStore((s) => s.fetchAdminMetrics)
  const adminMetrics = useAnalyticsStore((s) => s.adminMetrics)
  const isLoadingMetrics = useAnalyticsStore((s) => s.isLoadingMetrics)
  const [range, setRange] = useState<DateRange>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const metrics = adminMetrics ?? EMPTY_METRICS

  const handlePickerSelect = (r: DateRange, from?: string, to?: string) => {
    setRange(r)
    setCustomFrom(from ?? '')
    setCustomTo(to ?? '')
  }

  useEffect(() => {
    const from = range === 'custom' && customFrom ? `${customFrom}T00:00:00.000Z` : undefined
    const to   = range === 'custom' && customTo   ? `${customTo}T23:59:59.999Z`   : undefined
    void fetchAdminMetrics(range, from, to)
  }, [range, customFrom, customTo, fetchAdminMetrics])

  const [tab, setTab] = useState<TabId>('users')
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const [planFilter, setPlanFilter] = useState<'all' | 'free' | 'community' | 'pro' | 'max'>('all')
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const dismissAlert = useCallback((key: string) => {
    setDismissedAlerts(prev => new Set(prev).add(key))
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const alerts = useMemo(() => {
    const list: { key: string; variant: 'red' | 'amber'; message: string }[] = []
    if (metrics.monthlyChurn > 7) {
      list.push({ key: 'high-churn', variant: 'red', message: `Churn mensual elevado: ${metrics.monthlyChurn}%` })
    }
    const dau = metrics.dailyActiveUsers
    if (dau.length >= 14) {
      const last7  = dau.slice(-7).reduce((s, d) => s + d.count, 0) / 7
      const prior7 = dau.slice(-14, -7).reduce((s, d) => s + d.count, 0) / 7
      if (prior7 > 0 && ((prior7 - last7) / prior7) * 100 > 20) {
        list.push({ key: 'dau-drop', variant: 'amber', message: `DAU en descenso vs semana anterior` })
      }
    }
    return list
  }, [metrics])

  const handleExportCsv = useCallback(() => {
    const csv = generateCsvForTab(tab, metrics)
    const label = range === 'custom' ? `${customFrom}_${customTo}` : range
    downloadCsv(`admin-${tab}-${label}.csv`, csv)
    setExportOpen(false)
  }, [tab, metrics, range, customFrom, customTo])

  const handleExportPdf = useCallback(() => {
    setExportOpen(false)
    document.body.classList.add('print-admin')
    window.print()
    document.body.classList.remove('print-admin')
  }, [])

  const planData = useMemo(() => [
    { name: 'Free',      value: metrics.byPlan.free },
    { name: 'Community', value: metrics.byPlan.community },
    { name: 'Pro',       value: metrics.byPlan.pro },
    { name: 'Max',       value: metrics.byPlan.max },
  ], [metrics])

  const filteredFeatureUsage = useMemo(() => {
    if (planFilter === 'all') return metrics.featureUsage
    return metrics.featureUsageByPlan.map((f) => ({
      feature: f.feature,
      usersCount: Math.round(f[planFilter] * metrics.totalUsers / 100),
      percentage: f[planFilter],
    }))
  }, [metrics, planFilter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Panel de Administracion</h1>
            {isLoadingMetrics && <Loader2 size={16} className="animate-spin text-cyan-400" />}
          </div>
          <p className="text-white/40 text-sm mt-1">Datos reales de todos los usuarios de la plataforma</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate('/app/admin/billing')}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-500/20 transition-colors"
          >
            <Zap size={13} />
            Panel de Billing
          </button>

          {/* DateRangePicker */}
          <DateRangePicker
            range={range}
            customFrom={customFrom}
            customTo={customTo}
            onSelect={handlePickerSelect}
          />

          {/* Export */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white/40 hover:text-white/60 bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all"
            >
              <Download size={14} />
              Exportar
              <ChevronDown size={12} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-44 bg-[#111827] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                <button onClick={handleExportCsv} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white/70 hover:bg-white/[0.06] transition-colors">
                  <Download size={14} /> Exportar CSV
                </button>
                <button onClick={handleExportPdf} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white/70 hover:bg-white/[0.06] transition-colors">
                  <Download size={14} /> Exportar PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.03] p-1 rounded-xl border border-white/5 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                ${active
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04] border border-transparent'
                }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'users' && (
        <UsersTab
          metrics={metrics}
          range={range}
          alerts={alerts}
          dismissedAlerts={dismissedAlerts}
          dismissAlert={dismissAlert}
          planData={planData}
        />
      )}
      {tab === 'features' && (
        <FeaturesTab
          metrics={metrics}
          planFilter={planFilter}
          setPlanFilter={setPlanFilter}
          filteredFeatureUsage={filteredFeatureUsage}
        />
      )}
      {tab === 'engagement'   && <EngagementTab metrics={metrics} />}
      {tab === 'user_detail'  && <UsersDetailTab metrics={metrics} />}
      {tab === 'revenue'      && <RevenueTab metrics={metrics} />}
      {tab === 'achievements' && <AchievementsTab />}
      {tab === 'ai_usage'     && <AdminBillingReportingTab />}
    </div>
  )
}
