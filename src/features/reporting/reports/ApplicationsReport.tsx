import { useCallback, useMemo, useState } from 'react'
import { Search, Zap, LayoutDashboard, ListTree, ChevronRight, ChevronDown, MonitorSmartphone, Trash2, UserCog } from 'lucide-react'
import { useApplicationStore } from '@/stores/applicationStore'
import { useProcessStore } from '@/stores/processStore'
import { useValueAnalysisStore } from '@/stores/valueAnalysisStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { parseBpmnXml } from '@/utils/bpmnParser'
import { scaleToPeriod } from '@/utils/valueAnalysis'
import { scaleDaily, PERIOD_LABELS, PERIOD_OPTIONS, type CargoPeriod } from '@/features/cargos/cargoData'
import { techRisk, DEPLOYMENT_OPTIONS, type Application, type ApplicationUsage } from '@/types/application'
import type { Process } from '@/types/process'
import { Dashboard, Grid, Card, Stat, Donut, HBars, Insight, Badge, Th, Td, EmptyRow, TableWrap, type Datum } from '../components/reportUi'
import { DataTable, type Column } from '../components/DataTable'
import { hierarchyColumns } from '../components/hierarchyColumns'
import { resolveProcessHierarchy } from '@/lib/reportHierarchy'
import { useOrgLabels } from '@/hooks/useOrgLabels'

interface UsageDetail { activity: string; process: Process | undefined; path: string; cargo: string; dailyMinutes: number }
interface CargoRow { app: Application; cargo: string; process: Process | undefined; activity: string; dailyMinutes: number }
// Actividad conectada a un nodo de aplicación (por asociación del diagrama).
interface ActDetail { key: string; name: string; cargo: string; dailyMinutes: number }

const deployLabel = (v: string) => DEPLOYMENT_OPTIONS.find((o) => o.value === v)?.label ?? (v || '—')
const ownLabel = (v: string) => (v === 'propia' ? 'Propia' : v === 'terceros' ? 'Terceros' : v === 'mixta' ? 'Mixta' : '—')
const RISK_HEX: Record<string, string> = { bajo: '#10b981', medio: '#facc15', alto: '#f97316', critico: '#ef4444' }
const RISK_LEVEL_LABEL: Record<string, string> = { critico: 'Crítico', alto: 'Alto', medio: 'Medio', bajo: 'Bajo' }
// Etiqueta de despliegue/propiedad tal como la muestran los donuts (para casar el clic).
const depLabelForRow = (r: AppRow) => { const l = deployLabel(r.app.deployment); return l === '—' ? 'Sin definir' : l }
const ownLabelForRow = (r: AppRow) => { const l = ownLabel(r.app.ownership); return l === '—' ? 'Sin definir' : l }
type ChartPick = { k: 'deployment' | 'ownership' | 'risk' | 'category'; v: string }
const matchPick = (r: AppRow, p: ChartPick): boolean => {
  switch (p.k) {
    case 'deployment': return depLabelForRow(r) === p.v
    case 'ownership': return ownLabelForRow(r) === p.v
    case 'risk': return RISK_LEVEL_LABEL[r.risk.level] === p.v
    case 'category': return (r.app.category || '') === p.v
  }
}
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
  const [view, setView] = useState<'resumen' | 'actividades' | 'porCargo'>('resumen')

  // Cargos por proceso. El cargo NO es el lane del nodo de app (una computadora no
  // tiene cargo), sino el lane de la ACTIVIDAD conectada al nodo (por la asociación
  // del diagrama), igual que el manual de funciones. Se guarda: el lane por
  // id/nombre de actividad + la adyacencia por asociaciones (nodo app ↔ actividad).
  const laneByProc = useMemo(() => {
    const laneOf = new Map<string, Map<string, string>>()
    const adj = new Map<string, Map<string, string[]>>()
    const actNames = new Map<string, Map<string, string>>()
    const procIds = new Set(usages.map((u) => u.process_id).filter(Boolean) as string[])
    for (const pid of procIds) {
      const xml = procById.get(pid)?.bpmn_xml
      if (!xml) continue
      try {
        const parsed = parseBpmnXml(xml)
        const lm = new Map<string, string>()
        const nm = new Map<string, string>()
        parsed.activities.forEach((a) => {
          if (a.laneName) { lm.set(a.id, a.laneName); if (a.name) lm.set(a.name, a.laneName) }
          nm.set(a.id, a.name || '')
        })
        laneOf.set(pid, lm)
        actNames.set(pid, nm)
        const am = new Map<string, string[]>()
        const link = (a?: string | null, b?: string | null) => { if (!a || !b) return; (am.get(a) ?? am.set(a, []).get(a))!.push(b); (am.get(b) ?? am.set(b, []).get(b))!.push(a) }
        const doc = new DOMParser().parseFromString(xml, 'application/xml')
        for (const el of Array.from(doc.querySelectorAll('*'))) {
          if (el.localName === 'association') link(el.getAttribute('sourceRef'), el.getAttribute('targetRef'))
          else if (el.localName === 'dataInputAssociation' || el.localName === 'dataOutputAssociation') {
            const ref = Array.from(el.children).find((c) => c.localName === 'sourceRef' || c.localName === 'targetRef')?.textContent?.trim()
            link(el.parentElement?.getAttribute('id'), ref)
          }
        }
        adj.set(pid, am)
      } catch { /* no-op */ }
    }
    return { laneOf, adj, actNames }
  }, [usages, procById])

  // Cargo de un uso = lane de la actividad conectada al nodo (asociación), o por el
  // nombre de la actividad guardado en el uso.
  const cargoOf = useCallback((processId: string | null, nodeId: string | null, activityName: string | null): string => {
    if (!processId) return ''
    const lm = laneByProc.laneOf.get(processId); if (!lm) return ''
    for (const n of (nodeId ? laneByProc.adj.get(processId)?.get(nodeId) ?? [] : [])) {
      const lane = lm.get(n); if (lane) return lane
    }
    return (activityName && lm.get(activityName)) || ''
  }, [laneByProc])

  const timeOf = useCallback((processId: string | null, nodeId: string | null) => {
    if (!processId || !nodeId) return 0
    return (analyses[processId] ?? []).find((v) => v.bpmnNodeId === nodeId)?.dailyMinutes ?? 0
  }, [analyses])

  // Un nodo de aplicación puede estar asociado a VARIAS actividades del mismo
  // subproceso (varias flechas). El uso guarda solo el nodo de la app, así que las
  // actividades reales se leen de la ADYACENCIA de asociaciones (nodo app ↔ tareas),
  // igual que el cargo. Devuelve una entrada POR actividad conectada.
  const connectedActivities = useCallback((u: ApplicationUsage): ActDetail[] => {
    if (!u.process_id) return []
    const lm = laneByProc.laneOf.get(u.process_id)
    const am = laneByProc.adj.get(u.process_id)
    const nm = laneByProc.actNames.get(u.process_id)
    const neighbors = u.bpmn_element_id ? (am?.get(u.bpmn_element_id) ?? []) : []
    const actNeighbors = neighbors.filter((n) => nm?.has(n))
    if (actNeighbors.length) {
      return actNeighbors.map((id) => ({
        key: `${u.process_id}:${id}`,
        name: nm?.get(id) || u.activity_name || '',
        cargo: lm?.get(id) || '',
        dailyMinutes: timeOf(u.process_id, id),
      }))
    }
    // Sin asociación explícita a una actividad: se usa el ancla guardado en el uso
    // (el nodo de la app). Sin nodo (uso a nivel de proceso) no hay actividad.
    if (!u.bpmn_element_id) return []
    return [{
      key: `${u.process_id}:${u.bpmn_element_id}`,
      name: u.activity_name || '',
      cargo: cargoOf(u.process_id, u.bpmn_element_id, u.activity_name),
      dailyMinutes: timeOf(u.process_id, u.bpmn_element_id),
    }]
  }, [laneByProc, cargoOf, timeOf])

  const rows = useMemo<AppRow[]>(() => dedupApps.map((app) => {
    const us = usages.filter((u) => (canonId.get(u.application_id) ?? u.application_id) === app.id)
    const processNames = [...new Set(us.map((u) => (u.process_id ? procById.get(u.process_id)?.name : null)).filter((n): n is string => !!n))]
    // Actividades DISTINTAS conectadas a los nodos de la app (una app puede tocar
    // varias actividades por subproceso). Se deduplica por clave proceso:actividad.
    const acts = new Map<string, ActDetail>()
    for (const u of us) for (const d of connectedActivities(u)) if (!acts.has(d.key)) acts.set(d.key, d)
    const details = [...acts.values()]
    const cargos = [...new Set(details.map((d) => d.cargo).filter((c): c is string => !!c))]
    const dailyMinutes = details.reduce((s, d) => s + d.dailyMinutes, 0)
    return { app, processNames, activities: details.length, cargos, dailyMinutes, risk: techRisk(app) }
  }), [dedupApps, canonId, usages, procById, connectedActivities])

  // Vista «Por aplicación»: periodo/unidad configurables + detalle de actividades.
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [period, setPeriod] = useState<CargoPeriod>('mes')
  const [unit, setUnit] = useState<'min' | 'h'>('min')
  const toggleRow = (k: string) => setOpen((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const fmtT = (dm: number) => { if (!dm) return '-'; const v = scaleDaily(dm, period, unit); return unit === 'h' ? (Math.round(v * 10) / 10).toLocaleString('es') : Math.round(v).toLocaleString('es') }
  const unitLabel = `${unit === 'h' ? 'h' : 'min'}/${PERIOD_LABELS[period].toLowerCase()}`

  // Actividades (con su ruta jerárquica, CARGO y tiempo) por aplicación (canónica).
  // Una fila POR actividad conectada al nodo de la app (no por uso): un nodo puede
  // estar asociado a varias actividades del subproceso. Se deduplica por app+actividad.
  const usagesByApp = useMemo(() => {
    const m = new Map<string, UsageDetail[]>()
    const seen = new Map<string, Set<string>>()
    for (const u of usages) {
      const key = canonId.get(u.application_id) ?? u.application_id
      const p = u.process_id ? procById.get(u.process_id) : undefined
      const h = resolveProcessHierarchy(p, macroMap, procById)
      const path = p ? [p.management, p.coordination, org.hasL2 ? p.operative : null, h.macro, h.proceso, h.subproceso].filter(Boolean).join(' › ') : '—'
      const arr = m.get(key) ?? []
      const seenSet = seen.get(key) ?? new Set<string>()
      const dets = connectedActivities(u)
      if (dets.length) {
        for (const d of dets) {
          if (seenSet.has(d.key)) continue
          seenSet.add(d.key)
          arr.push({ activity: d.name, process: p, path, cargo: d.cargo, dailyMinutes: d.dailyMinutes })
        }
      } else {
        // Uso a nivel de proceso (sin nodo/actividad concreta).
        arr.push({ activity: u.activity_name || '', process: p, path, cargo: '', dailyMinutes: 0 })
      }
      m.set(key, arr)
      seen.set(key, seenSet)
    }
    return m
  }, [usages, canonId, procById, macroMap, org, connectedActivities])

  const [q, setQ] = useState('')
  // Filtro por clic en los gráficos del resumen (despliegue, propiedad, riesgo,
  // categoría). Clic de nuevo en el mismo corte lo quita. Igual que Riesgos/Activos.
  const [pick, setPick] = useState<ChartPick | null>(null)
  const togglePick = useCallback((k: ChartPick['k'], v: string) => setPick((p) => (p && p.k === k && p.v === v ? null : { k, v })), [])
  const shown = useMemo(() => {
    let base = pick ? rows.filter((r) => matchPick(r, pick)) : rows
    const query = q.trim().toLowerCase()
    if (query) base = base.filter((r) => r.app.name.toLowerCase().includes(query) || (r.app.category || '').toLowerCase().includes(query) || (r.app.vendor || '').toLowerCase().includes(query))
    return base
  }, [rows, q, pick])

  // Vista «Por cargo»: una fila por aplicación × cargo × actividad (qué cargos usan
  // cada aplicación, con jerarquía y tiempo) → sirve para levantar perfiles.
  const cargoRows = useMemo<CargoRow[]>(() => {
    const out: CargoRow[] = []
    for (const app of dedupApps) for (const d of usagesByApp.get(app.id) ?? []) {
      if (!d.cargo) continue
      out.push({ app, cargo: d.cargo, process: d.process, activity: d.activity, dailyMinutes: d.dailyMinutes })
    }
    return out.sort((a, b) => a.app.name.localeCompare(b.app.name) || a.cargo.localeCompare(b.cargo))
  }, [dedupApps, usagesByApp])
  const cargoShown = useMemo(() => {
    const query = q.trim().toLowerCase()
    return query ? cargoRows.filter((r) => r.app.name.toLowerCase().includes(query) || r.cargo.toLowerCase().includes(query) || r.activity.toLowerCase().includes(query)) : cargoRows
  }, [cargoRows, q])
  const cargoCols = useMemo<Column<CargoRow>[]>(() => [
    { key: 'app', header: 'Aplicación', accessor: (r) => r.app.name, className: 'text-gray-900 font-medium max-w-[180px]', cell: (r) => <div className="truncate" title={r.app.name}>{r.app.name}</div> },
    { key: 'cargo', header: 'Cargo', accessor: (r) => r.cargo, className: 'max-w-[160px]', cell: (r) => <div className="truncate text-primary-700" title={r.cargo}>{r.cargo}</div> },
    ...hierarchyColumns<CargoRow>(org, (r) => { const p = r.process; return { management: p?.management, coordination: p?.coordination, operative: p?.operative, ...resolveProcessHierarchy(p, macroMap, procById) } }),
    { key: 'act', header: 'Actividad', accessor: (r) => r.activity, className: 'max-w-[200px]', cell: (r) => <div className="truncate" title={r.activity}>{r.activity || '—'}</div> },
    { key: 'tdia', header: 'Min/día', accessor: (r) => Math.round(r.dailyMinutes), cell: (r) => r.dailyMinutes ? Math.round(r.dailyMinutes * 10) / 10 : '-' },
    { key: 'tmes', header: 'Min/mes', accessor: (r) => Math.round(scaleToPeriod(r.dailyMinutes, 'mes')), cell: (r) => r.dailyMinutes ? Math.round(scaleToPeriod(r.dailyMinutes, 'mes')) : '-' },
    { key: 'tanio', header: 'Hrs/año', accessor: (r) => Math.round(scaleToPeriod(r.dailyMinutes, 'año') / 60 * 10) / 10, cell: (r) => r.dailyMinutes ? Math.round(scaleToPeriod(r.dailyMinutes, 'año') / 60 * 10) / 10 : '-' },
  ], [org, macroMap, procById])

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
    { key: 'name', header: 'Aplicación', accessor: (r) => r.app.name, className: 'text-gray-900 font-medium max-w-[200px]', cell: (r) => <div className="truncate" title={r.app.name}>{r.app.name}</div> },
    { key: 'cat', header: 'Categoría', accessor: (r) => r.app.category || '' },
    { key: 'own', header: 'Propiedad', accessor: (r) => ownLabel(r.app.ownership) },
    { key: 'dep', header: 'Despliegue', accessor: (r) => deployLabel(r.app.deployment) },
    { key: 'vendor', header: 'Proveedor', accessor: (r) => r.app.vendor || '' },
    { key: 'crit', header: 'Criticidad', accessor: (r) => r.app.criticality || 0 },
    { key: 'api', header: 'API', accessor: (r) => (r.app.has_api ? 'Sí' : 'No'), cell: (r) => r.app.has_api ? <Badge label="API" hex="#10b981" /> : <span className="text-gray-400">No</span> },
    { key: 'risk', header: 'Riesgo tecnológico', accessor: (r) => r.risk.score, cell: (r) => <Badge label={r.risk.label} hex={r.risk.hex} /> },
    { key: 'nproc', header: '# Procesos', accessor: (r) => r.processNames.length },
    { key: 'procs', header: 'Procesos', accessor: (r) => r.processNames.join(', '), className: 'max-w-[220px]', cell: (r) => <div className="truncate" title={r.processNames.join(', ')}>{r.processNames.join(', ') || '-'}</div> },
    { key: 'nact', header: '# Actividades', accessor: (r) => r.activities },
    { key: 'cargos', header: 'Cargos', accessor: (r) => r.cargos.join(', '), className: 'max-w-[180px]', cell: (r) => <div className="truncate" title={r.cargos.join(', ')}>{r.cargos.join(', ') || '-'}</div> },
    { key: 'tdia', header: 'Min/día', accessor: (r) => Math.round(r.dailyMinutes), cell: (r) => r.dailyMinutes ? Math.round(r.dailyMinutes * 10) / 10 : '-' },
    { key: 'tmes', header: 'Min/mes', accessor: (r) => Math.round(scaleToPeriod(r.dailyMinutes, 'mes')), cell: (r) => r.dailyMinutes ? Math.round(scaleToPeriod(r.dailyMinutes, 'mes')) : '-' },
    { key: 'tanio', header: 'Hrs/año', accessor: (r) => Math.round(scaleToPeriod(r.dailyMinutes, 'año') / 60 * 10) / 10, cell: (r) => r.dailyMinutes ? Math.round(scaleToPeriod(r.dailyMinutes, 'año') / 60 * 10) / 10 : '-' },
    { key: 'status', header: 'Estado', accessor: (r) => r.app.status || '' },
    { key: 'del', header: '', accessor: () => '', cell: (r) => <button onClick={() => delApp(r)} title="Eliminar del catálogo" className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={13} /></button> },
  ], [delApp])

  return (
    <Dashboard>
      <Grid cols={4}>
        <Stat label="Aplicaciones" value={dedupApps.length} sub="en el inventario" tone="cyan" />
        <Stat label="En la nube" value={cloud} sub={`${dedupApps.length ? Math.round(cloud / dedupApps.length * 100) : 0}% cloud · resto on-premise`} tone="cyan" />
        <Stat label="Con API" value={withApi} sub="candidatas a automatizar" tone="emerald" />
        <Stat label="Riesgo tecnológico alto" value={highRisk} sub="crítico o alto" tone="red" />
      </Grid>

      <div className="flex rounded-lg border border-gray-200 overflow-hidden w-max flex-wrap">
        <button onClick={() => setView('resumen')} className={`inline-flex items-center gap-1 px-3 py-1.5 text-[11px] ${view === 'resumen' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-50'}`}><LayoutDashboard size={13} /> Resumen</button>
        <button onClick={() => setView('actividades')} className={`inline-flex items-center gap-1 px-3 py-1.5 text-[11px] ${view === 'actividades' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-50'}`}><ListTree size={13} /> Por aplicación / actividad</button>
        <button onClick={() => setView('porCargo')} className={`inline-flex items-center gap-1 px-3 py-1.5 text-[11px] ${view === 'porCargo' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-50'}`}><UserCog size={13} /> Por cargo</button>
      </div>

      {view === 'resumen' && (<>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Despliegue" sub="Clic para filtrar la tabla."><Donut data={byDeployment} center={String(dedupApps.length)} unit="apps" onSlice={(l) => togglePick('deployment', l)} active={pick?.k === 'deployment' ? pick.v : undefined} /></Card>
        <Card title="Propiedad" sub="Clic para filtrar la tabla."><Donut data={byOwnership} center={String(dedupApps.length)} unit="apps" onSlice={(l) => togglePick('ownership', l)} active={pick?.k === 'ownership' ? pick.v : undefined} /></Card>
        <Card title="Semáforo de riesgo tecnológico" sub="Clic para filtrar la tabla."><Donut data={byRisk} center={String(dedupApps.length)} unit="apps" onSlice={(l) => togglePick('risk', l)} active={pick?.k === 'risk' ? pick.v : undefined} /></Card>
      </div>

      {byCategory.length > 0 && <Card title="Por categoría" sub="Clic para filtrar la tabla."><HBars data={byCategory} onBar={(l) => togglePick('category', l)} active={pick?.k === 'category' ? pick.v : undefined} /></Card>}

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
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar aplicación…"
            className="pl-7 pr-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-[11.5px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 w-52" />
        </div>
        {pick && (
          <button onClick={() => setPick(null)} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border border-primary-300 text-primary-700 bg-primary-50 hover:bg-primary-100">
            {pick.v} <span className="text-primary-700">✕</span>
          </button>
        )}
        <span className="text-[10px] text-gray-400">Tiempo total: {Math.round(totalMinutes)} min/día · {Math.round(scaleToPeriod(totalMinutes, 'mes'))} min/mes · {Math.round(scaleToPeriod(totalMinutes, 'año') / 60 * 10) / 10} hrs/año</span>
      </div>

      <DataTable columns={columns} rows={shown} minWidth={2100} rowKey={(r) => r.app.id} />
      </>)}

      {view === 'actividades' && (<>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-[240px]">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar aplicación…" className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-[11.5px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">Periodo
            <select value={period} onChange={(e) => setPeriod(e.target.value as CargoPeriod)} className="appearance-none bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] text-gray-800 outline-none cursor-pointer focus:ring-2 focus:ring-primary-500">
              {PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
            </select>
          </label>
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
            {(['min', 'h'] as const).map((u) => <button key={u} onClick={() => setUnit(u)} className={`px-2 py-1 rounded-md text-[11px] ${unit === u ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>{u === 'h' ? 'Horas' : 'Minutos'}</button>)}
          </div>
        </div>
      </div>

      <TableWrap minWidth={1000}>
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <Th> </Th><Th>Aplicación</Th><Th>Categoría</Th><Th>Propiedad</Th><Th>Riesgo</Th><Th>Procesos</Th><Th>Actividades</Th><Th>{unitLabel}</Th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const dets = usagesByApp.get(r.app.id) ?? []
            const isOpen = open.has(r.app.id)
            return [
              <tr key={r.app.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <Td>{dets.length > 0 && <button onClick={() => toggleRow(r.app.id)} className="text-gray-500 hover:text-gray-800">{isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>}</Td>
                <Td className="text-gray-900 font-medium"><span className="inline-flex items-center gap-1.5"><MonitorSmartphone size={12} className="text-primary-700 shrink-0" />{r.app.name}</span></Td>
                <Td className="text-gray-600">{r.app.category || '—'}</Td>
                <Td className="text-gray-600">{ownLabel(r.app.ownership)}</Td>
                <Td><Badge label={r.risk.label} hex={r.risk.hex} /></Td>
                <Td className="tabular-nums">{r.processNames.length}</Td>
                <Td className="tabular-nums text-gray-800">{r.activities}</Td>
                <Td className="tabular-nums">{fmtT(r.dailyMinutes)}</Td>
              </tr>,
              isOpen && (
                <tr key={r.app.id + '-d'} className="bg-gray-900/45">
                  <td colSpan={8} className="px-3 py-2">
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
                        <span>Actividades de «{r.app.name}» ({dets.length})</span><span>{unitLabel}</span>
                      </div>
                      {dets.length === 0 ? <p className="text-[11px] text-gray-400">Sin actividades ancladas (uso a nivel de proceso).</p> : (
                        <div className="space-y-1">
                          {dets.map((d, i) => (
                            <div key={i} className="grid grid-cols-[1fr_auto] items-start gap-3 text-[11px]">
                              <span className="min-w-0">
                                <span className="text-gray-800">{d.activity || '(sin actividad)'}</span>
                                {d.cargo && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-md bg-primary-50 text-primary-700 align-middle">{d.cargo}</span>}
                                <span className="block text-[10px] text-gray-400 truncate" title={d.path}>{d.path}</span>
                              </span>
                              <span className="text-gray-600 tabular-nums w-24 text-right">{fmtT(d.dailyMinutes)}</span>
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

      {view === 'porCargo' && (<>
      <div className="flex items-center gap-2 px-1">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar aplicación, cargo o actividad…" className="pl-7 pr-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-[11.5px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 w-64" />
        </div>
        <span className="text-[10px] text-gray-400">Qué cargos usan cada aplicación (para levantar perfiles y necesidades).</span>
      </div>
      <DataTable columns={cargoCols} rows={cargoShown} minWidth={1700} rowKey={(r, i) => `${r.app.id}:${r.cargo}:${i}`} />
      </>)}
    </Dashboard>
  )
}
