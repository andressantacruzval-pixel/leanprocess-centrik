import { ShieldAlert, TrendingUp, Activity, CheckSquare, BarChart3, Lightbulb, ClipboardCheck } from 'lucide-react'
import type { Slide } from '../presentationTypes'
import type { Macroprocess, Process } from '@/types/process'
import type { RiskItem } from '@/types/risk'
import type { StoredIndicator } from '@/stores/indicatorStore'
import type { ValueActivity } from '@/utils/valueAnalysis'
import type { AuditItem } from '@/lib/procedureAi'
import {
  type ImprovementOpportunity, priorityScore, priorityLabel,
  IMPROVEMENT_TYPE_LABELS, IMPROVEMENT_TYPE_COLORS, IMPROVEMENT_TYPE_OPTIONS,
} from '@/types/improvement'
import type { ProcessHealthMap } from '@/hooks/useProcessHealth'

// ── Category display helpers ──────────────────────────────────────────────

const categoryLabel: Record<string, string> = {
  estrategico: 'Estrategico',
  productivo: 'Productivo',
  apoyo: 'Apoyo',
}

const categoryColor: Record<string, string> = {
  estrategico: 'text-cyan-400',
  productivo: 'text-emerald-400',
  apoyo: 'text-amber-400',
}

const categoryBorder: Record<string, string> = {
  estrategico: 'border-cyan-500/30',
  productivo: 'border-emerald-500/30',
  apoyo: 'border-amber-500/30',
}

// ── Props ────────────────────────────────────────────────────────────────

export interface SlideRendererProps {
  slide: Slide
  macroprocesses: Macroprocess[]
  processes: Process[]
  risks: RiskItem[]
  indicators: StoredIndicator[]
  analyses: Record<string, ValueActivity[]>
  audits: Record<string, AuditItem[]>
  improvements: ImprovementOpportunity[]
  procedures: unknown[]
  healthMap: ProcessHealthMap
}

// ── Component ────────────────────────────────────────────────────────────

export function SlideRenderer({ slide, macroprocesses, processes, risks, indicators, analyses, audits, improvements, procedures, healthMap }: SlideRendererProps) {
  switch (slide.type) {
    // ─── Title ─────────────────────────────────────────────────────
    case 'title':
      return (
        <div className="flex flex-col items-center justify-center h-full gap-6">
          {/* La portada la proyecta el cliente delante de su equipo: aqui el isotipo
              de marca vale mas que un icono generico de presentacion. */}
          <img src="/logo.png" alt="" width={96} height={96} className="w-24 h-24" />
          <h1 className="text-6xl font-bold tracking-tight text-white">Lean Process</h1>
          <p className="text-2xl text-gray-400">Gestion de Procesos</p>
          <div className="mt-8 text-lg text-gray-500">
            {new Date().toLocaleDateString('es-EC', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>
      )

    // ─── Map Overview ───────────────────────────────────────────────
    case 'map-overview': {
      const categories = ['estrategico', 'productivo', 'apoyo'] as const
      return (
        <div className="flex flex-col h-full px-8 lg:px-16 py-8 lg:py-12">
          <h2 className="text-4xl font-bold text-white mb-12 text-center">Mapa de Procesos</h2>
          <div className="flex-1 grid grid-rows-3 gap-6">
            {categories.map((cat) => {
              const macros = macroprocesses.filter((m) => m.category === cat)
              return (
                <div key={cat} className={`rounded-xl border ${categoryBorder[cat]} bg-white/[0.02] p-6`}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`text-sm font-semibold uppercase tracking-widest ${categoryColor[cat]}`}>
                      {categoryLabel[cat]}
                    </span>
                    <span className="text-xs text-gray-500">
                      {macros.length} macroproceso{macros.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {macros.map((m) => {
                      const count = processes.filter((p) => p.macroprocess_id === m.id).length
                      return (
                        <div
                          key={m.id}
                          className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-gray-300"
                        >
                          {m.name}
                          <span className="ml-2 text-gray-500">({count})</span>
                        </div>
                      )
                    })}
                    {macros.length === 0 && (
                      <p className="text-sm text-gray-600 italic">Sin macroprocesos</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    // ─── Per-macroprocess ───────────────────────────────────────────
    case 'macroprocess': {
      const { macro, children } = slide.data as { macro: Macroprocess; children: Process[] }
      return (
        <div className="flex flex-col h-full px-8 lg:px-16 py-8 lg:py-12">
          <div className="flex items-center gap-4 mb-10">
            <span className={`text-xs font-semibold uppercase tracking-widest ${categoryColor[macro.category]}`}>
              {categoryLabel[macro.category]}
            </span>
            <span className="text-gray-600">|</span>
            <h2 className="text-4xl font-bold text-white">{macro.name}</h2>
          </div>

          {children.length === 0 ? (
            <p className="text-gray-500 text-lg mt-12 text-center">
              No hay subprocesos registrados en este macroproceso.
            </p>
          ) : (
            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-min">
              {children.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-1"
                >
                  <span className="text-sm font-medium text-white truncate">{p.name}</span>
                  {p.code && <span className="text-xs text-gray-500">{p.code}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    // ─── Risk Heatmap ───────────────────────────────────────────────
    case 'risk-heatmap': {
      const matrix: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0) as number[])
      for (const r of risks) {
        const prob = Math.max(1, Math.min(5, r.inherentProbability ?? 0))
        const imp = Math.max(1, Math.min(5, r.inherentImpact ?? 0))
        if (prob >= 1 && imp >= 1) {
          matrix[5 - prob][imp - 1]++
        }
      }
      const heatColor = (row: number, col: number) => {
        const score = (5 - row) * (col + 1)
        if (score >= 15) return 'bg-red-600/80 text-white'
        if (score >= 10) return 'bg-orange-500/70 text-white'
        if (score >= 5) return 'bg-yellow-500/60 text-gray-900'
        return 'bg-emerald-500/50 text-white'
      }
      const probLabels = ['Muy Alta', 'Alta', 'Media', 'Baja', 'Muy Baja']
      const impLabels = ['Muy Bajo', 'Bajo', 'Medio', 'Alto', 'Muy Alto']

      let high = 0, medium = 0, low = 0
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const score = (5 - r) * (c + 1)
          if (score >= 15) high += matrix[r][c]
          else if (score >= 5) medium += matrix[r][c]
          else low += matrix[r][c]
        }
      }

      return (
        <div className="flex flex-col h-full px-6 lg:px-12 py-6 lg:py-10">
          <div className="flex items-center gap-3 mb-8">
            <ShieldAlert className="w-8 h-8 text-red-400" />
            <h2 className="text-4xl font-bold text-white">Mapa de Calor de Riesgos</h2>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex gap-2">
              <div className="flex flex-col justify-center mr-2">
                <span className="text-xs text-gray-400 -rotate-90 whitespace-nowrap tracking-widest uppercase">Probabilidad</span>
              </div>
              <div className="flex flex-col gap-1">
                {matrix.map((row, ri) => (
                  <div key={ri} className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 w-16 text-right mr-2">{probLabels[ri]}</span>
                    {row.map((count, ci) => (
                      <div
                        key={ci}
                        className={`w-16 h-16 rounded-lg flex items-center justify-center text-lg font-bold transition ${heatColor(ri, ci)} ${count > 0 ? 'ring-1 ring-white/20' : 'opacity-60'}`}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    ))}
                  </div>
                ))}
                <div className="flex items-center gap-1 mt-1 ml-[4.5rem]">
                  {impLabels.map((l) => (
                    <span key={l} className="w-16 text-center text-xs text-gray-500">{l}</span>
                  ))}
                </div>
                <div className="text-center mt-1 ml-[4.5rem]">
                  <span className="text-xs text-gray-400 uppercase tracking-widest">Impacto</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-10 mt-6 pt-4 border-t border-white/5">
            <span className="text-sm text-gray-400">Total: <span className="text-white font-bold">{risks.length}</span> riesgos</span>
            <span className="text-sm"><span className="inline-block w-3 h-3 rounded bg-red-600/80 mr-1" /> Alto: <span className="text-red-400 font-semibold">{high}</span></span>
            <span className="text-sm"><span className="inline-block w-3 h-3 rounded bg-yellow-500/60 mr-1" /> Medio: <span className="text-yellow-400 font-semibold">{medium}</span></span>
            <span className="text-sm"><span className="inline-block w-3 h-3 rounded bg-emerald-500/50 mr-1" /> Bajo: <span className="text-emerald-400 font-semibold">{low}</span></span>
          </div>
        </div>
      )
    }

    // ─── KPI Dashboard ──────────────────────────────────────────────
    case 'kpi-dashboard': {
      const kpiByProcess: Record<string, { processName: string; kpis: string[] }> = {}
      for (const ind of indicators) {
        if (!kpiByProcess[ind.process_id]) {
          const proc = processes.find((p) => p.id === ind.process_id)
          kpiByProcess[ind.process_id] = { processName: proc?.name ?? 'Sin proceso', kpis: [] }
        }
        kpiByProcess[ind.process_id].kpis.push(ind.name)
      }
      const kpiEntries = Object.entries(kpiByProcess)

      return (
        <div className="flex flex-col h-full px-6 lg:px-12 py-6 lg:py-10">
          <div className="flex items-center gap-3 mb-8">
            <TrendingUp className="w-8 h-8 text-emerald-400" />
            <h2 className="text-4xl font-bold text-white">Indicadores de Gestion</h2>
            <span className="ml-auto text-sm text-gray-500">{indicators.length} KPIs en {kpiEntries.length} procesos</span>
          </div>
          <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-2 gap-4 auto-rows-min">
            {kpiEntries.map(([pid, entry]) => (
              <div key={pid} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-cyan-400 truncate">{entry.processName}</span>
                  <span className="text-xs text-gray-500 ml-2 shrink-0">{entry.kpis.length} KPI{entry.kpis.length !== 1 ? 's' : ''}</span>
                </div>
                <ul className="space-y-1">
                  {entry.kpis.map((name, i) => (
                    <li key={i} className="text-xs text-gray-300 truncate flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // ─── Value Analysis ─────────────────────────────────────────────
    case 'value-analysis': {
      const allActs = Object.entries(analyses).flatMap(([pid, acts]) => acts.map((a) => ({ ...a, process_id: pid })))
      const vaCount = allActs.filter((a) => a.classification === 'VA').length
      const nvaCount = allActs.filter((a) => a.classification === 'NVA').length
      const nvaBnCount = allActs.filter((a) => a.classification === 'NVABN').length
      const classifiedTotal = vaCount + nvaCount + nvaBnCount
      const efficiency = classifiedTotal > 0 ? Math.round((vaCount / classifiedTotal) * 100) : 0

      const vaAngle = classifiedTotal > 0 ? (vaCount / classifiedTotal) * 360 : 0
      const nvaAngle = classifiedTotal > 0 ? (nvaCount / classifiedTotal) * 360 : 0
      const nvaBnAngle = classifiedTotal > 0 ? (nvaBnCount / classifiedTotal) * 360 : 0
      const ring = `conic-gradient(#34d399 0deg ${vaAngle}deg, #f87171 ${vaAngle}deg ${vaAngle + nvaAngle}deg, #fbbf24 ${vaAngle + nvaAngle}deg ${vaAngle + nvaAngle + nvaBnAngle}deg, transparent ${vaAngle + nvaAngle + nvaBnAngle}deg)`

      const perProcess = Object.entries(analyses).map(([pid, acts]) => {
        const proc = processes.find((p) => p.id === pid)
        const va = acts.filter((a) => a.classification === 'VA').length
        const classified = acts.filter((a) => a.classification !== null).length
        const eff = classified > 0 ? Math.round((va / classified) * 100) : 0
        return { name: proc?.name ?? pid, total: acts.length, va, eff }
      })

      return (
        <div className="flex flex-col h-full px-6 lg:px-12 py-6 lg:py-10">
          <div className="flex items-center gap-3 mb-8">
            <Activity className="w-8 h-8 text-emerald-400" />
            <h2 className="text-4xl font-bold text-white">Analisis de Valor</h2>
          </div>
          <div className="flex-1 flex items-start justify-center gap-16">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-52 h-52">
                <div className="w-full h-full rounded-full" style={{ background: ring }} />
                <div className="absolute inset-6 rounded-full bg-[#070b14] flex flex-col items-center justify-center">
                  <span className="text-5xl font-bold text-white">{efficiency}%</span>
                  <span className="text-xs text-gray-400 mt-1">Eficiencia VA</span>
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-400" /> VA: {vaCount}</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-400" /> NVA: {nvaCount}</span>
                <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-400" /> NVABN: {nvaBnCount}</span>
              </div>
              <span className="text-xs text-gray-500">{allActs.length} actividades totales</span>
            </div>
            <div className="flex-1 max-h-[24rem] overflow-y-auto space-y-2">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Por Proceso</h3>
              {perProcess.map((pp) => (
                <div key={pp.name} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2">
                  <span className="flex-1 text-sm text-white truncate">{pp.name}</span>
                  <span className="text-xs text-gray-500">{pp.total} act.</span>
                  <span className={`text-sm font-semibold ${pp.eff >= 60 ? 'text-emerald-400' : pp.eff >= 30 ? 'text-amber-400' : 'text-red-400'}`}>{pp.eff}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    // ─── Programa de Auditoria ──────────────────────────────────────
    case 'audit-program': {
      const rows = Object.entries(audits).flatMap(([pid, items]) =>
        items.map((it) => ({ ...it, process: processes.find((p) => p.id === pid)?.name ?? pid })))
      const covered = Object.entries(audits).filter(([, items]) => items.length > 0).length
      const byResp = new globalThis.Map<string, number>()
      rows.forEach((r) => byResp.set(r.responsable || 'Sin asignar', (byResp.get(r.responsable || 'Sin asignar') || 0) + 1))
      const topResp = [...byResp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      const maxResp = Math.max(1, ...topResp.map(([, n]) => n))
      return (
        <div className="flex flex-col h-full px-6 lg:px-12 py-6 lg:py-10">
          <div className="flex items-center gap-3 mb-8">
            <ClipboardCheck className="w-8 h-8 text-cyan-400" />
            <h2 className="text-4xl font-bold text-white">Programa de Auditoria</h2>
          </div>
          <div className="flex gap-6 mb-8">
            <StatBox value={rows.length} label="Puntos de control" tone="text-cyan-400" />
            <StatBox value={`${covered}/${processes.length}`} label="Procesos cubiertos" tone="text-emerald-400" />
            <StatBox value={byResp.size} label="Responsables" tone="text-violet-400" />
          </div>
          <div className="flex-1 grid grid-cols-2 gap-10 min-h-0">
            <div className="min-h-0 flex flex-col">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Carga por responsable</h3>
              <div className="space-y-2">
                {topResp.map(([name, n]) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-40 text-right text-sm text-gray-300 truncate">{name}</span>
                    <span className="flex-1 h-5 rounded bg-white/5 overflow-hidden">
                      <span className="h-full rounded bg-violet-400/80 flex items-center justify-end px-2" style={{ width: `${Math.max(8, n / maxResp * 100)}%` }}>
                        <span className="text-[11px] font-bold text-white">{n}</span>
                      </span>
                    </span>
                  </div>
                ))}
                {!topResp.length && <p className="text-sm text-gray-500">Sin puntos de control aun.</p>}
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto space-y-2">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Puntos de control</h3>
              {rows.slice(0, 12).map((r, i) => (
                <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-white truncate">{r.queAuditar || r.actividad}</span>
                    <span className="text-[11px] text-cyan-300 shrink-0">{r.frecuencia}</span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">{r.process} · {r.responsable || 'sin responsable'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    // ─── Oportunidades de Mejora ────────────────────────────────────
    case 'improvements': {
      const opps = improvements
      const abiertas = opps.filter((o) => o.status !== 'cerrada' && o.status !== 'descartada').length
      const quickWins = opps.filter((o) => priorityLabel(priorityScore(o)).tone === 'high' && o.status !== 'cerrada' && o.status !== 'descartada').length
      const cerradas = opps.filter((o) => o.status === 'cerrada').length
      const byType = IMPROVEMENT_TYPE_OPTIONS
        .map((t) => ({ t, n: opps.filter((o) => o.type === t).length }))
        .filter((x) => x.n > 0)
      const maxType = Math.max(1, ...byType.map((x) => x.n))
      const top = [...opps]
        .sort((a, b) => priorityScore(b) - priorityScore(a))
        .slice(0, 8)
      return (
        <div className="flex flex-col h-full px-6 lg:px-12 py-6 lg:py-10">
          <div className="flex items-center gap-3 mb-8">
            <Lightbulb className="w-8 h-8 text-amber-400" />
            <h2 className="text-4xl font-bold text-white">Oportunidades de Mejora</h2>
          </div>
          <div className="flex gap-6 mb-8">
            <StatBox value={opps.length} label="Oportunidades" tone="text-cyan-400" />
            <StatBox value={quickWins} label="Quick wins" tone="text-emerald-400" />
            <StatBox value={abiertas} label="Abiertas" tone="text-amber-400" />
            <StatBox value={cerradas} label="Cerradas" tone="text-violet-400" />
          </div>
          <div className="flex-1 grid grid-cols-2 gap-10 min-h-0">
            <div className="min-h-0 flex flex-col">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Por tipo de mejora</h3>
              <div className="space-y-2">
                {byType.map(({ t, n }) => (
                  <div key={t} className="flex items-center gap-3">
                    <span className="w-44 text-right text-sm text-gray-300 truncate">{IMPROVEMENT_TYPE_LABELS[t]}</span>
                    <span className="flex-1 h-5 rounded bg-white/5 overflow-hidden">
                      <span className="h-full rounded flex items-center justify-end px-2" style={{ width: `${Math.max(8, n / maxType * 100)}%`, background: IMPROVEMENT_TYPE_COLORS[t] }}>
                        <span className="text-[11px] font-bold text-white">{n}</span>
                      </span>
                    </span>
                  </div>
                ))}
                {!byType.length && <p className="text-sm text-gray-500">Sin oportunidades aun.</p>}
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto space-y-2">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Prioritarias (quick wins primero)</h3>
              {top.map((o) => {
                const prio = priorityLabel(priorityScore(o))
                return (
                  <div key={o.id} className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-white truncate">{o.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: `${IMPROVEMENT_TYPE_COLORS[o.type]}22`, color: IMPROVEMENT_TYPE_COLORS[o.type] }}>{IMPROVEMENT_TYPE_LABELS[o.type]}</span>
                    </div>
                    <div className="text-xs text-gray-500">{prio.label} · {priorityScore(o)}/15 · {o.progressPct}% avance</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )
    }

    // ─── Coverage Matrix ────────────────────────────────────────────
    case 'coverage': {
      const checkLabels = [
        { key: 'bpmn' as const, label: 'BPMN' },
        { key: 'procedure' as const, label: 'Proced.' },
        { key: 'kpis' as const, label: 'KPIs' },
        { key: 'risks' as const, label: 'Riesgos' },
        { key: 'audit' as const, label: 'Auditoria' },
        { key: 'valueAnalysis' as const, label: 'Valor' },
        { key: 'improvements' as const, label: 'Mejoras' },
      ]
      return (
        <div className="flex flex-col h-full px-6 lg:px-12 py-6 lg:py-10">
          <div className="flex items-center gap-3 mb-8">
            <CheckSquare className="w-8 h-8 text-cyan-400" />
            <h2 className="text-4xl font-bold text-white">Cobertura por Proceso</h2>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 text-gray-400 font-semibold">Proceso</th>
                  {checkLabels.map((cl) => (
                    <th key={cl.key} className="text-center py-2 text-gray-400 font-semibold w-20">{cl.label}</th>
                  ))}
                  <th className="text-center py-2 text-gray-400 font-semibold w-20">Madurez</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((p) => {
                  const h = healthMap[p.id]
                  return (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2 text-white truncate max-w-[16rem]">{p.name}</td>
                      {checkLabels.map((cl) => (
                        <td key={cl.key} className="text-center py-2">
                          {h?.checks[cl.key] ? (
                            <span className="text-emerald-400">&#10003;</span>
                          ) : (
                            <span className="text-gray-600">&#8212;</span>
                          )}
                        </td>
                      ))}
                      <td className="text-center py-2">
                        <span className={`font-semibold ${(h?.score ?? 0) >= 80 ? 'text-emerald-400' : (h?.score ?? 0) >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                          {h?.score ?? 0}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // ─── Organization Stats ─────────────────────────────────────────
    case 'org-stats': {
      const orgAllActs = Object.values(analyses).flat()
      const orgVa = orgAllActs.filter((a) => a.classification === 'VA').length
      const orgClassified = orgAllActs.filter((a) => a.classification !== null).length
      const orgEfficiency = orgClassified > 0 ? Math.round((orgVa / orgClassified) * 100) : 0

      const healthScores = Object.values(healthMap)
      const avgHealth = healthScores.length > 0 ? Math.round(healthScores.reduce((sum, h) => sum + h.score, 0) / healthScores.length) : 0

      const orgStats = [
        { label: 'Procesos', value: processes.length, color: 'text-cyan-400', sub: `${macroprocesses.length} macroprocesos` },
        { label: 'Riesgos', value: risks.length, color: 'text-red-400', sub: 'identificados' },
        { label: 'KPIs', value: indicators.length, color: 'text-emerald-400', sub: 'definidos' },
        { label: 'Procedimientos', value: procedures.length, color: 'text-purple-400', sub: 'documentados' },
        { label: 'Eficiencia VA', value: `${orgEfficiency}%`, color: 'text-amber-400', sub: `${orgClassified} actividades` },
        { label: 'Madurez Promedio', value: `${avgHealth}%`, color: 'text-cyan-400', sub: `${healthScores.length} procesos evaluados` },
      ]

      return (
        <div className="flex flex-col items-center justify-center h-full gap-10 px-16">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-cyan-400" />
            <h2 className="text-4xl font-bold text-white">Estadisticas Organizacionales</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {orgStats.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-6 lg:px-10 py-6 lg:py-8">
                <span className={`text-6xl font-bold ${s.color}`}>{s.value}</span>
                <span className="text-lg text-gray-300 font-medium">{s.label}</span>
                <span className="text-xs text-gray-500">{s.sub}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // ─── Summary ────────────────────────────────────────────────────
    case 'summary': {
      const stats = [
        { label: 'Procesos', value: processes.length, color: 'text-cyan-400' },
        { label: 'Riesgos', value: risks.length, color: 'text-red-400' },
        { label: 'KPIs', value: indicators.length, color: 'text-emerald-400' },
        { label: 'Macroprocesos', value: macroprocesses.length, color: 'text-amber-400' },
      ]
      return (
        <div className="flex flex-col items-center justify-center h-full gap-12">
          <h2 className="text-4xl font-bold text-white">Resumen Ejecutivo</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-2">
                <span className={`text-7xl font-bold ${s.color}`}>{s.value}</span>
                <span className="text-lg text-gray-400">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    default:
      return null
  }
}

function StatBox({ value, label, tone }: { value: number | string; label: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3">
      <div className={`text-3xl font-bold ${tone}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  )
}
