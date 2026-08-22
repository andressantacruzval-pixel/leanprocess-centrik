import { Fragment, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import {
  getRiskLevel, heatMapCellColor, PROBABILITY_LABELS, IMPACT_LABELS, RISK_CATEGORIES,
  type RiskItem, type RiskLevel, type RiskCategory,
} from '@/types/risk'
import type { Process } from '@/types/process'
import {
  Dashboard, Grid, Card, Stat, Donut, HBars, Insight, Badge, type Datum,
} from '../components/reportUi'
import { DataTable, type Column } from '../components/DataTable'
import { OrgTopChart, type OrgTopItem } from '../components/OrgTopChart'
import { useOrgLabels } from '@/hooks/useOrgLabels'

// Reporte de Riesgos: tablero (nivel inherente/residual, categorías, control,
// procesos más expuestos) + tabla con TODA la caracterización del riesgo
// (causa, evento, efecto, categoría, controles y su efectividad, residual).

const LEVEL_HEX: Record<RiskLevel, string> = { Extremo: '#ef4444', Alto: '#f97316', Moderado: '#facc15', Bajo: '#10b981' }
const LEVELS: RiskLevel[] = ['Extremo', 'Alto', 'Moderado', 'Bajo']

function ctrlAvg(r: RiskItem): number {
  if (!r.controls.length) return 0
  return r.controls.reduce((s, c) => s + (c.score || 0), 0) / r.controls.length
}
function ctrlDescs(r: RiskItem): string {
  return r.controls.map((c) => c.description?.trim()).filter(Boolean).join(' · ')
}
function mitigaSet(r: RiskItem): string {
  return [...new Set(r.controls.map((c) => c.mitigates).filter(Boolean))].join(', ')
}
function effLabel(score: number): { label: string; hex: string } {
  if (score === 0) return { label: 'Sin control', hex: '#6b7280' }
  if (score >= 33) return { label: 'Óptimo', hex: '#22d3ee' }
  if (score >= 25) return { label: 'Bueno', hex: '#10b981' }
  if (score >= 17) return { label: 'Regular', hex: '#facc15' }
  if (score >= 9) return { label: 'Débil', hex: '#f97316' }
  return { label: 'Deficiente', hex: '#ef4444' }
}

// Mapa de calor 5×5: probabilidad (filas, 5→1) × impacto (columnas, 1→5).
const PROB_ROWS = [5, 4, 3, 2, 1]
const IMP_COLS = [1, 2, 3, 4, 5]

function HeatMap({ risks, mode, onCell, selected }: {
  risks: RiskItem[]; mode: 'inh' | 'res'; onCell: (p: number, i: number) => void
  selected: { p: number; i: number } | null
}) {
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    risks.forEach((r) => {
      const p = mode === 'inh' ? r.inherentProbability : r.residualProbability
      const i = mode === 'inh' ? r.inherentImpact : r.residualImpact
      const k = `${p}-${i}`
      m[k] = (m[k] || 0) + 1
    })
    return m
  }, [risks, mode])
  return (
    <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1 text-[10px]">
      {PROB_ROWS.map((p) => (
        <Fragment key={p}>
          <span className="flex items-center justify-end pr-1 text-right leading-tight text-white/40">{PROBABILITY_LABELS[p]}</span>
          {IMP_COLS.map((i) => {
            const c = counts[`${p}-${i}`] || 0
            const isSel = selected?.p === p && selected?.i === i
            return (
              <button key={i} type="button" disabled={c === 0} onClick={() => onCell(p, i)}
                title={`${PROBABILITY_LABELS[p]} × ${IMPACT_LABELS[i]}`}
                className={`aspect-square rounded flex items-center justify-center font-bold text-white transition-all ${heatMapCellColor(p, i)} ${c === 0 ? 'opacity-20 cursor-default' : 'cursor-pointer hover:ring-2 hover:ring-white/70'} ${isSel ? 'ring-2 ring-white scale-105' : ''}`}>
                {c > 0 ? c : ''}
              </button>
            )
          })}
        </Fragment>
      ))}
      <span />
      {IMP_COLS.map((i) => <span key={i} className="text-center leading-tight pt-0.5 text-white/40">{IMPACT_LABELS[i]}</span>)}
    </div>
  )
}

export function RisksReport({ processes, allRisks }: { processes: Process[]; allRisks: RiskItem[] }) {
  const org = useOrgLabels()
  const processMap = useMemo(() => new Map(processes.map((p) => [p.id, p])), [processes])
  const ids = useMemo(() => new Set(processes.map((p) => p.id)), [processes])
  const risks = useMemo(() => allRisks.filter((r) => ids.has(r.process_id)), [allRisks, ids])
  const [fLevel, setFLevel] = useState('')

  // Mapas de calor interactivos: filtro por tipo de riesgo + clic en un cuadrante
  // que filtra la TABLA a los riesgos de esa casilla (inherente o residual).
  const [heatCategory, setHeatCategory] = useState<RiskCategory | ''>('')
  const [heatCell, setHeatCell] = useState<{ mode: 'inh' | 'res'; p: number; i: number } | null>(null)
  const heatRisks = useMemo(() => heatCategory ? risks.filter((r) => r.category === heatCategory) : risks, [risks, heatCategory])
  const pickCell = (mode: 'inh' | 'res', p: number, i: number) =>
    setHeatCell((prev) => (prev && prev.mode === mode && prev.p === p && prev.i === i ? null : { mode, p, i }))

  const shown = useMemo(() => {
    let out = heatRisks
    if (heatCell) {
      out = out.filter((r) => {
        const p = heatCell.mode === 'inh' ? r.inherentProbability : r.residualProbability
        const i = heatCell.mode === 'inh' ? r.inherentImpact : r.residualImpact
        return p === heatCell.p && i === heatCell.i
      })
    }
    if (fLevel) out = out.filter((r) => getRiskLevel(r.inherentProbability, r.inherentImpact).label === fLevel)
    return out
  }, [heatRisks, heatCell, fLevel])

  const columns = useMemo<Column<RiskItem>[]>(() => [
    { key: 'l0', header: org.l0, accessor: (r) => processMap.get(r.process_id)?.management || '' },
    { key: 'l1', header: org.l1, accessor: (r) => processMap.get(r.process_id)?.coordination || '' },
    { key: 'l2', header: org.l2, hidden: !org.hasL2, accessor: (r) => processMap.get(r.process_id)?.operative || '' },
    { key: 'proc', header: 'Proceso', accessor: (r) => processMap.get(r.process_id)?.name || '', className: 'max-w-[150px]', cell: (r) => <div className="truncate">{processMap.get(r.process_id)?.name || '-'}</div> },
    { key: 'title', header: 'Riesgo', accessor: (r) => r.title || '', className: 'text-white font-medium max-w-[200px]', cell: (r) => <div className="truncate" title={r.title}>{r.title}</div> },
    { key: 'desc', header: 'Descripción', accessor: (r) => r.description || '', className: 'max-w-[260px]', cell: (r) => <div className="truncate" title={r.description}>{r.description || '-'}</div> },
    { key: 'cause', header: 'Causa', accessor: (r) => r.riskCause || '', className: 'max-w-[160px]', cell: (r) => <div className="truncate" title={r.riskCause}>{r.riskCause || '-'}</div> },
    { key: 'event', header: 'Evento', accessor: (r) => r.riskEvent || '', className: 'max-w-[160px]', cell: (r) => <div className="truncate" title={r.riskEvent}>{r.riskEvent || '-'}</div> },
    { key: 'effect', header: 'Efecto', accessor: (r) => r.riskEffect || '', className: 'max-w-[160px]', cell: (r) => <div className="truncate" title={r.riskEffect}>{r.riskEffect || '-'}</div> },
    { key: 'cat', header: 'Categoría', accessor: (r) => r.category || '' },
    { key: 'step', header: 'Actividad', accessor: (r) => r.processStep || '', className: 'max-w-[130px]', cell: (r) => <div className="truncate">{r.processStep || '-'}</div> },
    { key: 'pi', header: 'P.I', accessor: (r) => r.inherentProbability },
    { key: 'ii', header: 'I.I', accessor: (r) => r.inherentImpact },
    { key: 'lvlInh', header: 'Nivel Inh.', accessor: (r) => getRiskLevel(r.inherentProbability, r.inherentImpact).label, cell: (r) => { const inh = getRiskLevel(r.inherentProbability, r.inherentImpact); return <Badge label={inh.label} hex={inh.hex} /> } },
    { key: 'nctrl', header: 'Controles', accessor: (r) => r.controls.length },
    { key: 'eff', header: 'Efectividad', accessor: (r) => effLabel(ctrlAvg(r)).label, cell: (r) => { const eff = effLabel(ctrlAvg(r)); return <Badge label={eff.label} hex={eff.hex} /> } },
    { key: 'mit', header: 'Mitiga', accessor: (r) => mitigaSet(r) || '', cell: (r) => mitigaSet(r) || '-' },
    { key: 'ctrlDet', header: 'Controles (detalle)', accessor: (r) => ctrlDescs(r) || '', className: 'max-w-[260px]', cell: (r) => <div className="truncate" title={ctrlDescs(r)}>{ctrlDescs(r) || '-'}</div> },
    { key: 'pr', header: 'P.R', accessor: (r) => r.residualProbability },
    { key: 'ir', header: 'I.R', accessor: (r) => r.residualImpact },
    { key: 'lvlRes', header: 'Nivel Res.', accessor: (r) => getRiskLevel(r.residualProbability, r.residualImpact).label, cell: (r) => { const res = getRiskLevel(r.residualProbability, r.residualImpact); return <Badge label={res.label} hex={res.hex} /> } },
  ], [org, processMap])

  const byInh = useMemo<Datum[]>(() => LEVELS.map((l) => ({
    label: l, color: LEVEL_HEX[l],
    value: risks.filter((r) => getRiskLevel(r.inherentProbability, r.inherentImpact).label === l).length,
  })), [risks])
  const byRes = useMemo<Datum[]>(() => LEVELS.map((l) => ({
    label: l, color: LEVEL_HEX[l],
    value: risks.filter((r) => getRiskLevel(r.residualProbability, r.residualImpact).label === l).length,
  })), [risks])
  const byCat = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    risks.forEach((r) => m.set(r.category, (m.get(r.category) || 0) + 1))
    return [...m.entries()].map(([label, value]) => ({ label, value, color: '#8b5cf6' })).sort((a, b) => b.value - a.value)
  }, [risks])
  const expuestosItems = useMemo<OrgTopItem[]>(() => risks
    .filter((r) => { const l = getRiskLevel(r.inherentProbability, r.inherentImpact).label; return l === 'Extremo' || l === 'Alto' })
    .map((r) => { const p = processMap.get(r.process_id); return { management: p?.management, coordination: p?.coordination, operative: p?.operative, process: p?.name } }),
    [risks, processMap])

  const critInh = byInh[0].value + byInh[1].value
  const critRes = byRes[0].value + byRes[1].value
  const sinControl = risks.filter((r) => ctrlAvg(r) < 17).length
  const avgEff = risks.length ? Math.round(risks.reduce((s, r) => s + ctrlAvg(r), 0) / risks.length) : 0
  const totalControles = risks.reduce((s, r) => s + r.controls.length, 0)
  const riesgosSinControl = risks.filter((r) => r.controls.length === 0).length

  return (
    <Dashboard>
      <Grid cols={6}>
        <Stat label="Riesgos" value={risks.length} sub="identificados" tone="cyan" />
        <Stat label="Extremos + altos" value={critInh} sub={`${risks.length ? Math.round(critInh / risks.length * 100) : 0}% inherente`} tone="red" />
        <Stat label="Críticos residuales" value={critRes} sub={`tras controles (${critInh - critRes} mitigados)`} tone="amber" />
        <Stat label="Control promedio" value={effLabel(avgEff).label} sub={`${avgEff}/40 de efectividad`} tone="emerald" />
        <Stat label="Total de controles" value={totalControles} sub={`${risks.length ? (totalControles / risks.length).toFixed(1) : 0} por riesgo`} tone="violet" />
        <Stat label="Riesgos sin control" value={riesgosSinControl} sub={`${risks.length ? Math.round(riesgosSinControl / risks.length * 100) : 0}% del total`} tone="red" />
      </Grid>

      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h3 className="text-sm font-semibold text-white">Mapas de calor</h3>
          <label className="flex items-center gap-2 text-[11px] text-white/50">
            Tipo de riesgo
            <select value={heatCategory} onChange={(e) => setHeatCategory(e.target.value as RiskCategory | '')}
              className="bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white/80 outline-none cursor-pointer">
              <option value="">Todos</option>
              {RISK_CATEGORIES.map((c) => <option key={c} value={c} className="bg-[#0d1117]">{c}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Riesgo inherente" sub="Antes de los controles. Clic en un cuadrante para filtrar la tabla.">
            <HeatMap risks={heatRisks} mode="inh" onCell={(p, i) => pickCell('inh', p, i)} selected={heatCell?.mode === 'inh' ? heatCell : null} />
          </Card>
          <Card title="Riesgo residual" sub="Después de los controles. Clic en un cuadrante para filtrar la tabla.">
            <HeatMap risks={heatRisks} mode="res" onCell={(p, i) => pickCell('res', p, i)} selected={heatCell?.mode === 'res' ? heatCell : null} />
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Riesgo inherente" sub="Antes de controles. Clic para filtrar la tabla.">
          <Donut data={byInh} center={String(risks.length)} unit="riesgos" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {LEVELS.map((l) => <button key={l} onClick={() => setFLevel(fLevel === l ? '' : l)} className={`text-[10px] px-2 py-1 rounded-md border ${fLevel === l ? 'border-white/40 text-white' : 'border-white/10 text-white/50'}`}>{l}</button>)}
          </div>
        </Card>
        <Card title="Riesgo residual" sub="Después de aplicar los controles evaluados.">
          <Donut data={byRes} center={`${critInh ? Math.round((critInh - critRes) / critInh * 100) : 0}%`} unit="reducción crítica" />
        </Card>
        <Card title="Por categoría" sub="Clic para filtrar mapas y tabla."><HBars data={byCat} onBar={(l) => setHeatCategory(heatCategory === l ? '' : (l as RiskCategory))} active={heatCategory} /></Card>
        <OrgTopChart title="Más expuestos" sub="Riesgos extremos/altos por nivel." items={expuestosItems} org={org} color="#f97316" />
      </div>

      <div className="space-y-2">
        {critRes > 0 && <Insight tone="crit">{critRes} riesgo(s) siguen en nivel extremo o alto <b>después</b> de los controles. Son la prioridad del plan de tratamiento.</Insight>}
        {sinControl > 0 && <Insight tone="warn">{sinControl} riesgo(s) tienen control deficiente o débil (&lt;17/40). Reforzar el control baja el residual.</Insight>}
        {critInh - critRes > 0 && <Insight tone="ok">Los controles ya bajaron {critInh - critRes} riesgo(s) desde crítico. Documenta esas evidencias para la auditoría.</Insight>}
      </div>

      {heatCell && (
        <div className="flex items-center gap-2 flex-wrap -mb-1">
          <span className="text-[11px] text-white/45">Tabla filtrada por cuadrante:</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            {heatCell.mode === 'inh' ? 'Inherente' : 'Residual'} · {PROBABILITY_LABELS[heatCell.p]} × {IMPACT_LABELS[heatCell.i]}
            <button onClick={() => setHeatCell(null)} className="hover:text-white" title="Quitar filtro"><X size={12} /></button>
          </span>
        </div>
      )}

      <DataTable columns={columns} rows={shown} minWidth={1900} rowKey={(r) => r.id} />
    </Dashboard>
  )
}
