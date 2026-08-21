import { useMemo, useState } from 'react'
import { getRiskLevel, type RiskItem, type RiskLevel } from '@/types/risk'
import type { Process } from '@/types/process'
import {
  Dashboard, Grid, Card, Stat, Donut, HBars, Insight, Badge,
  Th, Td, EmptyRow, VerMasRow, TableWrap, type Datum,
} from '../components/reportUi'
import { useVerMas } from '../components/reportPaging'
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

export function RisksReport({ processes, allRisks }: { processes: Process[]; allRisks: RiskItem[] }) {
  const org = useOrgLabels()
  const COLS = 20 + (org.hasL2 ? 1 : 0)
  const processMap = useMemo(() => new Map(processes.map((p) => [p.id, p])), [processes])
  const ids = useMemo(() => new Set(processes.map((p) => p.id)), [processes])
  const risks = useMemo(() => allRisks.filter((r) => ids.has(r.process_id)), [allRisks, ids])
  const [fLevel, setFLevel] = useState('')

  const shown = useMemo(() => fLevel
    ? risks.filter((r) => getRiskLevel(r.inherentProbability, r.inherentImpact).label === fLevel)
    : risks, [risks, fLevel])
  const { visibles, ocultas, verMas } = useVerMas(shown)

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
  const topProc = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    risks.forEach((r) => {
      const lvl = getRiskLevel(r.inherentProbability, r.inherentImpact).label
      if (lvl === 'Extremo' || lvl === 'Alto') {
        const n = processMap.get(r.process_id)?.name || '—'
        m.set(n, (m.get(n) || 0) + 1)
      }
    })
    return [...m.entries()].map(([label, value]) => ({ label, value, color: '#f97316' })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [risks, processMap])

  const critInh = byInh[0].value + byInh[1].value
  const critRes = byRes[0].value + byRes[1].value
  const sinControl = risks.filter((r) => ctrlAvg(r) < 17).length
  const avgEff = risks.length ? Math.round(risks.reduce((s, r) => s + ctrlAvg(r), 0) / risks.length) : 0

  return (
    <Dashboard>
      <Grid cols={4}>
        <Stat label="Riesgos" value={risks.length} sub="identificados" tone="cyan" />
        <Stat label="Extremos + altos" value={critInh} sub={`${risks.length ? Math.round(critInh / risks.length * 100) : 0}% inherente`} tone="red" />
        <Stat label="Críticos residuales" value={critRes} sub={`tras controles (${critInh - critRes} mitigados)`} tone="amber" />
        <Stat label="Control promedio" value={effLabel(avgEff).label} sub={`${avgEff}/40 de efectividad`} tone="emerald" />
      </Grid>

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
        <Card title="Por categoría"><HBars data={byCat} /></Card>
        <Card title="Procesos más expuestos" sub="Con más riesgos extremos/altos."><HBars data={topProc} /></Card>
      </div>

      <div className="space-y-2">
        {critRes > 0 && <Insight tone="crit">{critRes} riesgo(s) siguen en nivel extremo o alto <b>después</b> de los controles. Son la prioridad del plan de tratamiento.</Insight>}
        {sinControl > 0 && <Insight tone="warn">{sinControl} riesgo(s) tienen control deficiente o débil (&lt;17/40). Reforzar el control baja el residual.</Insight>}
        {critInh - critRes > 0 && <Insight tone="ok">Los controles ya bajaron {critInh - critRes} riesgo(s) desde crítico. Documenta esas evidencias para la auditoría.</Insight>}
      </div>

      <TableWrap minWidth={1900}>
        <thead>
          <tr className="bg-white/[0.03] border-b border-white/5">
            <Th>{org.l0}</Th><Th>{org.l1}</Th>{org.hasL2 && <Th>{org.l2}</Th>}<Th>Proceso</Th><Th>Riesgo</Th><Th>Descripción</Th>
            <Th>Causa</Th><Th>Evento</Th><Th>Efecto</Th><Th>Categoría</Th><Th>Actividad</Th>
            <Th>P.I</Th><Th>I.I</Th><Th>Nivel Inh.</Th><Th>Controles</Th><Th>Efectividad</Th><Th>Mitiga</Th><Th>Controles (detalle)</Th>
            <Th>P.R</Th><Th>I.R</Th><Th>Nivel Res.</Th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((r) => {
            const proc = processMap.get(r.process_id)
            const inh = getRiskLevel(r.inherentProbability, r.inherentImpact)
            const res = getRiskLevel(r.residualProbability, r.residualImpact)
            const eff = effLabel(ctrlAvg(r))
            return (
              <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors align-top">
                <Td>{proc?.management || '-'}</Td>
                <Td>{proc?.coordination || '-'}</Td>
                {org.hasL2 && <Td>{proc?.operative || '-'}</Td>}
                <Td className="max-w-[150px]"><div className="truncate">{proc?.name || '-'}</div></Td>
                <Td className="text-white font-medium max-w-[200px]"><div className="truncate" title={r.title}>{r.title}</div></Td>
                <Td className="max-w-[260px]"><div className="truncate" title={r.description}>{r.description || '-'}</div></Td>
                <Td className="max-w-[160px]"><div className="truncate" title={r.riskCause}>{r.riskCause || '-'}</div></Td>
                <Td className="max-w-[160px]"><div className="truncate" title={r.riskEvent}>{r.riskEvent || '-'}</div></Td>
                <Td className="max-w-[160px]"><div className="truncate" title={r.riskEffect}>{r.riskEffect || '-'}</div></Td>
                <Td>{r.category}</Td>
                <Td className="max-w-[130px]"><div className="truncate">{r.processStep || '-'}</div></Td>
                <Td>{r.inherentProbability}</Td>
                <Td>{r.inherentImpact}</Td>
                <Td><Badge label={inh.label} hex={inh.hex} /></Td>
                <Td>{r.controls.length}</Td>
                <Td><Badge label={eff.label} hex={eff.hex} /></Td>
                <Td>{mitigaSet(r) || '-'}</Td>
                <Td className="max-w-[260px]"><div className="truncate" title={ctrlDescs(r)}>{ctrlDescs(r) || '-'}</div></Td>
                <Td>{r.residualProbability}</Td>
                <Td>{r.residualImpact}</Td>
                <Td><Badge label={res.label} hex={res.hex} /></Td>
              </tr>
            )
          })}
          {shown.length === 0 && <EmptyRow cols={COLS} />}
          <VerMasRow cols={COLS} ocultas={ocultas} onVerMas={verMas} />
        </tbody>
      </TableWrap>
    </Dashboard>
  )
}
