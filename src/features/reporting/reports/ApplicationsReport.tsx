import { useMemo, useState } from 'react'
import { Search, Zap } from 'lucide-react'
import { useApplicationStore } from '@/stores/applicationStore'
import { useProcessStore } from '@/stores/processStore'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { parseBpmnXml } from '@/utils/bpmnParser'
import { techRisk, DEPLOYMENT_OPTIONS, type Application } from '@/types/application'
import { Dashboard, Grid, Card, Stat, Donut, HBars, Insight, Badge, type Datum } from '../components/reportUi'
import { DataTable, type Column } from '../components/DataTable'

const deployLabel = (v: string) => DEPLOYMENT_OPTIONS.find((o) => o.value === v)?.label ?? (v || '—')
const ownLabel = (v: string) => (v === 'propia' ? 'Propia' : v === 'terceros' ? 'Terceros' : v === 'mixta' ? 'Mixta' : '—')
const RISK_HEX: Record<string, string> = { bajo: '#10b981', medio: '#facc15', alto: '#f97316', critico: '#ef4444' }

interface AppRow {
  app: Application
  processNames: string[]
  activities: number
  cargos: string[]
  dailyMinutes: number
  risk: ReturnType<typeof techRisk>
}

// Reporte de Aplicaciones / Software: inventario + uso por proceso/actividad/cargo,
// tiempo consumido (del análisis de valor) y semáforo de riesgo tecnológico.
export function ApplicationsReport() {
  const companyId = useWorkspaceStore((s) => s.activeCompanyId)
  const allApps = useApplicationStore((s) => s.applications)
  const allUsages = useApplicationStore((s) => s.usages)
  const allProcesses = useProcessStore((s) => s.processes)
  const analyses = useValueAnalysisStore((s) => s.analyses)

  const apps = useMemo(() => allApps.filter((a) => a.company_id === companyId), [allApps, companyId])
  const usages = useMemo(() => allUsages.filter((u) => u.company_id === companyId), [allUsages, companyId])
  const procById = useMemo(() => new Map(allProcesses.map((p) => [p.id, p])), [allProcesses])

  // Lanes (cargos) por nodo: se parsea el BPMN de los procesos con uso de apps.
  const laneByProc = useMemo(() => {
    const m = new Map<string, Map<string, string>>()
    const procIds = new Set(usages.map((u) => u.process_id).filter(Boolean) as string[])
    for (const pid of procIds) {
      const xml = procById.get(pid)?.bpmn_xml
      if (!xml) continue
      try {
        const parsed = parseBpmnXml(xml)
        const nodeMap = new Map<string, string>()
        parsed.activities.forEach((a) => { if (a.laneName) nodeMap.set(a.id, a.laneName) })
        m.set(pid, nodeMap)
      } catch { /* no-op */ }
    }
    return m
  }, [usages, procById])

  const timeOf = (processId: string | null, nodeId: string | null) => {
    if (!processId || !nodeId) return 0
    return (analyses[processId] ?? []).find((v) => v.bpmnNodeId === nodeId)?.dailyMinutes ?? 0
  }

  const rows = useMemo<AppRow[]>(() => apps.map((app) => {
    const us = usages.filter((u) => u.application_id === app.id)
    const processNames = [...new Set(us.map((u) => (u.process_id ? procById.get(u.process_id)?.name : null)).filter((n): n is string => !!n))]
    const cargos = [...new Set(us.map((u) => (u.process_id && u.bpmn_element_id ? laneByProc.get(u.process_id)?.get(u.bpmn_element_id) : null)).filter((c): c is string => !!c))]
    const dailyMinutes = us.reduce((s, u) => s + timeOf(u.process_id, u.bpmn_element_id), 0)
    const activities = us.filter((u) => u.bpmn_element_id).length
    return { app, processNames, activities, cargos, dailyMinutes, risk: techRisk(app) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [apps, usages, procById, laneByProc, analyses])

  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase()
    return query ? rows.filter((r) => r.app.name.toLowerCase().includes(query) || (r.app.category || '').toLowerCase().includes(query) || (r.app.vendor || '').toLowerCase().includes(query)) : rows
  }, [rows, q])

  // ── Distribuciones ────────────────────────────────────────────────────────
  const byDeployment = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    apps.forEach((a) => { const k = a.deployment || 'sin_definir'; m.set(k, (m.get(k) || 0) + 1) })
    const colors: Record<string, string> = { on_premise: '#f97316', cloud_saas: '#06b6d4', cloud_iaas: '#6366f1', hibrido: '#a855f7', sin_definir: '#6b7280' }
    return [...m.entries()].map(([k, value]) => ({ label: deployLabel(k) === '—' ? 'Sin definir' : deployLabel(k), value, color: colors[k] ?? '#6366f1' }))
  }, [apps])
  const byOwnership = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    apps.forEach((a) => { const k = a.ownership || 'sin_definir'; m.set(k, (m.get(k) || 0) + 1) })
    const colors: Record<string, string> = { propia: '#10b981', terceros: '#0ea5e9', mixta: '#a855f7', sin_definir: '#6b7280' }
    return [...m.entries()].map(([k, value]) => ({ label: ownLabel(k) === '—' ? 'Sin definir' : ownLabel(k), value, color: colors[k] ?? '#6366f1' }))
  }, [apps])
  const byRisk = useMemo<Datum[]>(() => {
    const order = ['critico', 'alto', 'medio', 'bajo']
    const m = new Map<string, number>()
    rows.forEach((r) => m.set(r.risk.level, (m.get(r.risk.level) || 0) + 1))
    return order.filter((k) => m.get(k)).map((k) => ({ label: { critico: 'Crítico', alto: 'Alto', medio: 'Medio', bajo: 'Bajo' }[k]!, value: m.get(k)!, color: RISK_HEX[k] }))
  }, [rows])
  const byCategory = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    apps.forEach((a) => { if (a.category) m.set(a.category, (m.get(a.category) || 0) + 1) })
    return [...m.entries()].map(([label, value]) => ({ label, value, color: '#0ea5e9' })).sort((a, b) => b.value - a.value)
  }, [apps])

  const cloud = apps.filter((a) => a.deployment?.startsWith('cloud')).length
  const withApi = apps.filter((a) => a.has_api).length
  const totalMinutes = rows.reduce((s, r) => s + r.dailyMinutes, 0)
  const automationCandidates = rows.filter((r) => r.app.has_api && r.dailyMinutes > 0).sort((a, b) => b.dailyMinutes - a.dailyMinutes).slice(0, 5)
  const highRisk = rows.filter((r) => r.risk.level === 'critico' || r.risk.level === 'alto').length

  const columns = useMemo<Column<AppRow>[]>(() => [
    { key: 'code', header: 'Código', accessor: (r) => r.app.code || '' },
    { key: 'name', header: 'Aplicación', accessor: (r) => r.app.name, className: 'text-white font-medium max-w-[200px]', cell: (r) => <div className="truncate" title={r.app.name}>{r.app.name}</div> },
    { key: 'cat', header: 'Categoría', accessor: (r) => r.app.category || '' },
    { key: 'own', header: 'Propiedad', accessor: (r) => ownLabel(r.app.ownership) },
    { key: 'dep', header: 'Despliegue', accessor: (r) => deployLabel(r.app.deployment) },
    { key: 'vendor', header: 'Proveedor', accessor: (r) => r.app.vendor || '' },
    { key: 'crit', header: 'Criticidad', accessor: (r) => r.app.criticality || 0 },
    { key: 'api', header: 'API', accessor: (r) => (r.app.has_api ? 'Sí' : 'No'), cell: (r) => r.app.has_api ? <Badge label="API" hex="#10b981" /> : <span className="text-white/30">No</span> },
    { key: 'risk', header: 'Riesgo tecnológico', accessor: (r) => r.risk.score, cell: (r) => <Badge label={r.risk.label} hex={r.risk.hex} /> },
    { key: 'nproc', header: '# Procesos', accessor: (r) => r.processNames.length },
    { key: 'procs', header: 'Procesos', accessor: (r) => r.processNames.join(', '), className: 'max-w-[220px]', cell: (r) => <div className="truncate" title={r.processNames.join(', ')}>{r.processNames.join(', ') || '-'}</div> },
    { key: 'nact', header: '# Actividades', accessor: (r) => r.activities },
    { key: 'cargos', header: 'Cargos', accessor: (r) => r.cargos.join(', '), className: 'max-w-[180px]', cell: (r) => <div className="truncate" title={r.cargos.join(', ')}>{r.cargos.join(', ') || '-'}</div> },
    { key: 'time', header: 'Tiempo (min/día)', accessor: (r) => Math.round(r.dailyMinutes) },
    { key: 'status', header: 'Estado', accessor: (r) => r.app.status || '' },
  ], [])

  return (
    <Dashboard>
      <Grid cols={4}>
        <Stat label="Aplicaciones" value={apps.length} sub="en el inventario" tone="cyan" />
        <Stat label="En la nube" value={cloud} sub={`${apps.length ? Math.round(cloud / apps.length * 100) : 0}% cloud · resto on-premise`} tone="cyan" />
        <Stat label="Con API" value={withApi} sub="candidatas a automatizar" tone="emerald" />
        <Stat label="Riesgo tecnológico alto" value={highRisk} sub="crítico o alto" tone="red" />
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Despliegue" sub="On-premise vs. nube."><Donut data={byDeployment} center={String(apps.length)} unit="apps" /></Card>
        <Card title="Propiedad" sub="Propias vs. de terceros."><Donut data={byOwnership} center={String(apps.length)} unit="apps" /></Card>
        <Card title="Semáforo de riesgo tecnológico" sub="Criticidad + legado + sin API + auth débil."><Donut data={byRisk} center={String(apps.length)} unit="apps" /></Card>
      </div>

      {byCategory.length > 0 && <Card title="Por categoría"><HBars data={byCategory} /></Card>}

      <div className="space-y-2">
        {automationCandidates.length > 0 && (
          <Insight tone="ok">
            <span className="inline-flex items-center gap-1"><Zap size={13} /> Candidatas a automatización</span>: {automationCandidates.map((r) => `${r.app.name} (${Math.round(r.dailyMinutes)} min/día)`).join(' · ')}. Tienen API y consumen tiempo — prioriza integrarlas o robotizarlas.
          </Insight>
        )}
        {highRisk > 0 && <Insight tone="crit">{highRisk} aplicación(es) con riesgo tecnológico alto/crítico. Revisa las on-premise sin API, con autenticación débil o marcadas para reemplazo.</Insight>}
      </div>

      <div className="flex items-center gap-2 px-1">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar aplicación…"
            className="pl-7 pr-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11.5px] text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 w-52" />
        </div>
        <span className="text-[10px] text-white/25">Tiempo total: {Math.round(totalMinutes)} min/día</span>
      </div>

      <DataTable columns={columns} rows={shown} minWidth={1900} rowKey={(r) => r.app.id} />
    </Dashboard>
  )
}
