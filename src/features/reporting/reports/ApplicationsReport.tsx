import { useCallback, useMemo, useState } from 'react'
import { Search, Zap, LayoutDashboard, ListTree, ChevronRight, ChevronDown, MonitorSmartphone, Trash2 } from 'lucide-react'
import { useApplicationStore } from '@/stores/applicationStore'
import { useProcessStore } from '@/stores/processStore'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { parseBpmnXml } from '@/utils/bpmnParser'
import { scaleToPeriod } from '@/utils/valueAnalysis'
import { scaleDaily, PERIOD_LABELS, PERIOD_OPTIONS, type CargoPeriod } from '@/features/cargos/cargoData'
import { techRisk, DEPLOYMENT_OPTIONS, type Application } from '@/types/application'
import type { Process } from '@/types/process'
import { Dashboard, Grid, Card, Stat, Donut, HBars, Insight, Badge, Th, Td, EmptyRow, TableWrap, type Datum } from '../components/reportUi'
import { DataTable, type Column } from '../components/DataTable'
import { resolveProcessHierarchy } from '@/lib/reportHierarchy'
import { useOrgLabels } from '@/hooks/useOrgLabels'

interface UsageDetail { activity: string; process: Process | undefined; path: string; cargo: string; dailyMinutes: number }

const deployLabel = (v: string) => DEPLOYMENT_OPTIONS.find((o) => o.value === v)?.label ?? (v || '—')
const ownLabel = (v: string) => (v === 'propia' ? 'Propia' : v === 'terceros' ? 'Terceros' : v === 'mixta' ? 'Mixta' : '—')
const RISK_HEX: Record<string, string> = { bajo: '#10b981', medio: '#facc15', alto: '#f97316', critico: '#ef4444' }
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

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
  const deleteApplication = useApplicationStore((s) => s.deleteApplication)
  const allProcesses = useProcessStore((s) => s.processes)
  const allMacros = useProcessStore((s) => s.macroprocesses)
  const analyses = useValueAnalysisStore((s) => s.analyses)
  const org = useOrgLabels()

  const apps = useMemo(() => allApps.filter((a) => a.company_id === companyId), [allApps, companyId])
  // Deduplica por nombre: si hay aplicaciones repetidas se muestran UNA vez y se
  // agregan sus usos. canonId mapea cada id de app a su id canónico.
  const { dedupApps, canonId } = useMemo(() => {
    const byName = new Map<string, Application>(); const canon = new Map<string, string>()
    for (const a of apps) {
      const k = norm(a.name); const first = byName.get(k)
      if (first) canon.set(a.id, first.id)
      else { byName.set(k, a); canon.set(a.id, a.id) }
    }
    return { dedupApps: [...byName.values()], canonId: canon }
  }, [apps])
  const usages = useMemo(() => allUsages.filter((u) => u.company_id === companyId), [allUsages, companyId])
  const procById = useMemo(() => new Map(allProcesses.map((p) => [p.id, p])), [allProcesses])
  const macroMap = useMemo(() => new Map(allMacros.map((m) => [m.id, m])), [allMacros])
  const [view, setView] = useState<'resumen' | 'actividades'>('resumen')

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

  const rows = useMemo<AppRow[]>(() => dedupApps.map((app) => {
    const us = usages.filter((u) => (canonId.get(u.application_id) ?? u.application_id) === app.id)
    const processNames = [...new Set(us.map((u) => (u.process_id ? procById.get(u.process_id)?.name : null)).filter((n): n is string => !!n))]
    const cargos = [...new Set(us.map((u) => (u.process_id && u.bpmn_element_id ? laneByProc.get(u.process_id)?.get(u.bpmn_element_id) : null)).filter((c): c is string => !!c))]
    const dailyMinutes = us.reduce((s, u) => s + timeOf(u.process_id, u.bpmn_element_id), 0)
    const activities = us.filter((u) => u.bpmn_element_id).length
    return { app, processNames, activities, cargos, dailyMinutes, risk: techRisk(app) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [dedupApps, canonId, usages, procById, laneByProc, analyses])

  // Vista «Por aplicación»: periodo/unidad configurables + detalle de actividades.
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [period, setPeriod] = useState<CargoPeriod>('mes')
  const [unit, setUnit] = useState<'min' | 'h'>('min')
  const toggleRow = (k: string) => setOpen((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const fmtT = (dm: number) => { if (!dm) return '-'; const v = scaleDaily(dm, period, unit); return unit === 'h' ? (Math.round(v * 10) / 10).toLocaleString('es') : Math.round(v).toLocaleString('es') }
  const unitLabel = `${unit === 'h' ? 'h' : 'min'}/${PERIOD_LABELS[period].toLowerCase()}`

  // Actividades (con su ruta jerárquica, CARGO y tiempo) por aplicación (canónica).
  const usagesByApp = useMemo(() => {
    const m = new Map<string, UsageDetail[]>()
    for (const u of usages) {
      const key = canonId.get(u.application_id) ?? u.application_id
      const p = u.process_id ? procById.get(u.process_id) : undefined
      const h = resolveProcessHierarchy(p, macroMap, procById)
      const path = p ? [p.management, p.coordination, org.hasL2 ? p.operative : null, h.macro, h.proceso, h.subproceso].filter(Boolean).join(' › ') : '—'
      const arrV = u.process_id ? (analyses[u.process_id] ?? []) : []
      const dm = arrV.find((v) => v.bpmnNodeId === u.bpmn_element_id)?.dailyMinutes ?? 0
      const cargo = (u.process_id && u.bpmn_element_id ? laneByProc.get(u.process_id)?.get(u.bpmn_element_id) : '') || ''
      const arr = m.get(key) ?? []
      arr.push({ activity: u.activity_name || '', process: p, path, cargo, dailyMinutes: dm })
      m.set(key, arr)
    }
    return m
  }, [usages, canonId, procById, macroMap, org, analyses, laneByProc])

  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase()
    return query ? rows.filter((r) => r.app.name.toLowerCase().includes(query) || (r.app.category || '').toLowerCase().includes(query) || (r.app.vendor || '').toLowerCase().includes(query)) : rows
  }, [rows, q])

  // ── Distribuciones ────────────────────────────────────────────────────────
  const byDeployment = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    dedupApps.forEach((a) => { const k = a.deployment || 'sin_definir'; m.set(k, (m.get(k) || 0) + 1) })
    const colors: Record<string, string> = { on_premise: '#f97316', cloud_saas: '#06b6d4', cloud_iaas: '#6366f1', hibrido: '#a855f7', sin_definir: '#6b7280' }
    return [...m.entries()].map(([k, value]) => ({ label: deployLabel(k) === '—' ? 'Sin definir' : deployLabel(k), value, color: colors[k] ?? '#6366f1' }))
  }, [dedupApps])
  const byOwnership = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    dedupApps.forEach((a) => { const k = a.ownership || 'sin_definir'; m.set(k, (m.get(k) || 0) + 1) })
    const colors: Record<string, string> = { propia: '#10b981', terceros: '#0ea5e9', mixta: '#a855f7', sin_definir: '#6b7280' }
    return [...m.entries()].map(([k, value]) => ({ label: ownLabel(k) === '—' ? 'Sin definir' : ownLabel(k), value, color: colors[k] ?? '#6366f1' }))
  }, [dedupApps])
  const byRisk = useMemo<Datum[]>(() => {
    const order = ['critico', 'alto', 'medio', 'bajo']
    const m = new Map<string, number>()
    rows.forEach((r) => m.set(r.risk.level, (m.get(r.risk.level) || 0) + 1))
    return order.filter((k) => m.get(k)).map((k) => ({ label: { critico: 'Crítico', alto: 'Alto', medio: 'Medio', bajo: 'Bajo' }[k]!, value: m.get(k)!, color: RISK_HEX[k] }))
  }, [rows])
  const byCategory = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    dedupApps.forEach((a) => { if (a.category) m.set(a.category, (m.get(a.category) || 0) + 1) })
    return [...m.entries()].map(([label, value]) => ({ label, value, color: '#0ea5e9' })).sort((a, b) => b.value - a.value)
  }, [dedupApps])

  const cloud = dedupApps.filter((a) => a.deployment?.startsWith('cloud')).length
  const withApi = dedupApps.filter((a) => a.has_api).length
  const totalMinutes = rows.reduce((s, r) => s + r.dailyMinutes, 0)
  const automationCandidates = rows.filter((r) => r.app.has_api && r.dailyMinutes > 0).sort((a, b) => b.dailyMinutes - a.dailyMinutes).slice(0, 5)
  const highRisk = rows.filter((r) => r.risk.level === 'critico' || r.risk.level === 'alto').length

  // Eliminación desde el CATÁLOGO (solo aquí): confirma listando los procesos
  // donde se usa antes de borrar la app y sus usos. Elimina también duplicados.
  const delApp = useCallback((row: AppRow) => {
    const names = row.processNames
    const msg = names.length ? `Se usa en ${names.length} proceso(s): ${names.join(', ')}.\nSe quitarán sus nodos de esos diagramas.` : 'No se usa en ningún proceso.'
    if (!confirm(`¿Eliminar «${row.app.name}» del catálogo de aplicaciones?\n\n${msg}`)) return
    apps.filter((a) => norm(a.name) === norm(row.app.name)).forEach((a) => deleteApplication(a.id))
  }, [apps, deleteApplication])

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
    { key: 'tdia', header: 'Min/día', accessor: (r) => Math.round(r.dailyMinutes), cell: (r) => r.dailyMinutes ? Math.round(r.dailyMinutes * 10) / 10 : '-' },
    { key: 'tmes', header: 'Min/mes', accessor: (r) => Math.round(scaleToPeriod(r.dailyMinutes, 'mes')), cell: (r) => r.dailyMinutes ? Math.round(scaleToPeriod(r.dailyMinutes, 'mes')) : '-' },
    { key: 'tanio', header: 'Hrs/año', accessor: (r) => Math.round(scaleToPeriod(r.dailyMinutes, 'año') / 60 * 10) / 10, cell: (r) => r.dailyMinutes ? Math.round(scaleToPeriod(r.dailyMinutes, 'año') / 60 * 10) / 10 : '-' },
    { key: 'status', header: 'Estado', accessor: (r) => r.app.status || '' },
    { key: 'del', header: '', accessor: () => '', cell: (r) => <button onClick={() => delApp(r)} title="Eliminar del catálogo" className="p-1 rounded text-white/25 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button> },
  ], [delApp])

  return (
    <Dashboard>
      <Grid cols={4}>
        <Stat label="Aplicaciones" value={dedupApps.length} sub="en el inventario" tone="cyan" />
        <Stat label="En la nube" value={cloud} sub={`${dedupApps.length ? Math.round(cloud / dedupApps.length * 100) : 0}% cloud · resto on-premise`} tone="cyan" />
        <Stat label="Con API" value={withApi} sub="candidatas a automatizar" tone="emerald" />
        <Stat label="Riesgo tecnológico alto" value={highRisk} sub="crítico o alto" tone="red" />
      </Grid>

      <div className="flex rounded-lg border border-white/10 overflow-hidden w-max">
        <button onClick={() => setView('resumen')} className={`inline-flex items-center gap-1 px-3 py-1.5 text-[11px] ${view === 'resumen' ? 'bg-cyan-500/20 text-cyan-200' : 'text-white/50 hover:bg-white/5'}`}><LayoutDashboard size={13} /> Resumen</button>
        <button onClick={() => setView('actividades')} className={`inline-flex items-center gap-1 px-3 py-1.5 text-[11px] ${view === 'actividades' ? 'bg-cyan-500/20 text-cyan-200' : 'text-white/50 hover:bg-white/5'}`}><ListTree size={13} /> Por aplicación / actividad</button>
      </div>

      {view === 'resumen' ? (<>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Despliegue" sub="On-premise vs. nube."><Donut data={byDeployment} center={String(dedupApps.length)} unit="apps" /></Card>
        <Card title="Propiedad" sub="Propias vs. de terceros."><Donut data={byOwnership} center={String(dedupApps.length)} unit="apps" /></Card>
        <Card title="Semáforo de riesgo tecnológico" sub="Criticidad + legado + sin API + auth débil."><Donut data={byRisk} center={String(dedupApps.length)} unit="apps" /></Card>
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
        <span className="text-[10px] text-white/25">Tiempo total: {Math.round(totalMinutes)} min/día · {Math.round(scaleToPeriod(totalMinutes, 'mes'))} min/mes · {Math.round(scaleToPeriod(totalMinutes, 'año') / 60 * 10) / 10} hrs/año</span>
      </div>

      <DataTable columns={columns} rows={shown} minWidth={2100} rowKey={(r) => r.app.id} />
      </>) : (<>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-[240px]">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar aplicación…" className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11.5px] text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/50" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[11px] text-white/50">Periodo
            <select value={period} onChange={(e) => setPeriod(e.target.value as CargoPeriod)} className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/80 outline-none cursor-pointer focus:ring-2 focus:ring-cyan-500/50">
              {PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
            </select>
          </label>
          <div className="inline-flex rounded-lg border border-white/10 p-0.5">
            {(['min', 'h'] as const).map((u) => <button key={u} onClick={() => setUnit(u)} className={`px-2 py-1 rounded text-[11px] ${unit === u ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/40 hover:text-white/70'}`}>{u === 'h' ? 'Horas' : 'Minutos'}</button>)}
          </div>
        </div>
      </div>

      <TableWrap minWidth={1000}>
        <thead>
          <tr className="bg-white/[0.03] border-b border-white/5">
            <Th> </Th><Th>Aplicación</Th><Th>Categoría</Th><Th>Propiedad</Th><Th>Riesgo</Th><Th>Procesos</Th><Th>Actividades</Th><Th>{unitLabel}</Th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const dets = usagesByApp.get(r.app.id) ?? []
            const isOpen = open.has(r.app.id)
            return [
              <tr key={r.app.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                <Td>{dets.length > 0 && <button onClick={() => toggleRow(r.app.id)} className="text-white/40 hover:text-white/80">{isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>}</Td>
                <Td className="text-white font-medium"><span className="inline-flex items-center gap-1.5"><MonitorSmartphone size={12} className="text-sky-300 shrink-0" />{r.app.name}</span></Td>
                <Td className="text-white/60">{r.app.category || '—'}</Td>
                <Td className="text-white/60">{ownLabel(r.app.ownership)}</Td>
                <Td><Badge label={r.risk.label} hex={r.risk.hex} /></Td>
                <Td className="tabular-nums">{r.processNames.length}</Td>
                <Td className="tabular-nums text-white/85">{r.activities}</Td>
                <Td className="tabular-nums">{fmtT(r.dailyMinutes)}</Td>
              </tr>,
              isOpen && (
                <tr key={r.app.id + '-d'} className="bg-black/20">
                  <td colSpan={8} className="px-3 py-2">
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-white/35 mb-1.5">
                        <span>Actividades de «{r.app.name}» ({dets.length})</span><span>{unitLabel}</span>
                      </div>
                      {dets.length === 0 ? <p className="text-[11px] text-white/30">Sin actividades ancladas (uso a nivel de proceso).</p> : (
                        <div className="space-y-1">
                          {dets.map((d, i) => (
                            <div key={i} className="grid grid-cols-[1fr_auto] items-start gap-3 text-[11px]">
                              <span className="min-w-0">
                                <span className="text-white/80">{d.activity || '(sin actividad)'}</span>
                                {d.cargo && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 align-middle">{d.cargo}</span>}
                                <span className="block text-[10px] text-white/35 truncate" title={d.path}>{d.path}</span>
                              </span>
                              <span className="text-white/55 tabular-nums w-24 text-right">{fmtT(d.dailyMinutes)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ),
            ]
          })}
          {shown.length === 0 && <EmptyRow cols={8} />}
        </tbody>
      </TableWrap>
      </>)}
    </Dashboard>
  )
}
