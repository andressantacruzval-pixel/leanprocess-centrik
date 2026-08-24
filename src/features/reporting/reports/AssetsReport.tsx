import { useMemo, useState } from 'react'
import type { Process, Macroprocess } from '@/types/process'
import type { InformationAsset } from '@/types/asset'
import { useAssetStore } from '@/stores/assetStore'
import { Dashboard, Grid, Card, Stat, Donut, HBars, Insight, Badge, type Datum } from '../components/reportUi'
import { DataTable, type Column } from '../components/DataTable'
import { hierarchyColumns } from '../components/hierarchyColumns'
import { resolveProcessHierarchy } from '@/lib/reportHierarchy'
import { OrgTopChart, type OrgTopItem } from '../components/OrgTopChart'
import { useOrgLabels } from '@/hooks/useOrgLabels'

// Reporte de Activos de Información (ISO 27001): tablero (criticidad C·I·D, tipos,
// datos personales, más críticos por área) + tabla con toda la ficha del activo.

function critBand(n: number): { label: string; hex: string } {
  if (n >= 5) return { label: 'Crítico', hex: '#ef4444' }
  if (n === 4) return { label: 'Alto', hex: '#f97316' }
  if (n === 3) return { label: 'Medio', hex: '#facc15' }
  if (n >= 1) return { label: 'Bajo', hex: '#10b981' }
  return { label: 'Sin clasificar', hex: '#6b7280' }
}
const BANDS = ['Crítico', 'Alto', 'Medio', 'Bajo', 'Sin clasificar']
const BAND_HEX: Record<string, string> = { 'Crítico': '#ef4444', 'Alto': '#f97316', 'Medio': '#facc15', 'Bajo': '#10b981', 'Sin clasificar': '#6b7280' }

export function AssetsReport({ processes, assets, macroMap, processMap }: {
  processes: Process[]; assets: InformationAsset[]; macroMap: Map<string, Macroprocess>; processMap: Map<string, Process>
}) {
  const org = useOrgLabels()
  const operations = useAssetStore((s) => s.operations)
  const ids = useMemo(() => new Set(processes.map((p) => p.id)), [processes])
  const list = useMemo(() => assets.filter((a) => a.process_id && ids.has(a.process_id)), [assets, ids])
  const opByAsset = useMemo(() => {
    const m = new Map<string, string>()
    operations.forEach((o) => { if (o.asset_id && o.operation) m.set(o.asset_id, o.operation) })
    return m
  }, [operations])

  const [fBand, setFBand] = useState('')
  const [fType, setFType] = useState('')

  const shown = useMemo(() => {
    let out = list
    if (fBand) out = out.filter((a) => critBand(a.criticality || 0).label === fBand)
    if (fType) out = out.filter((a) => a.asset_type === fType)
    return out
  }, [list, fBand, fType])

  const columns = useMemo<Column<InformationAsset>[]>(() => [
    ...hierarchyColumns<InformationAsset>(org, (a) => {
      const p = a.process_id ? processMap.get(a.process_id) : undefined
      return { management: p?.management, coordination: p?.coordination, operative: p?.operative, ...resolveProcessHierarchy(p, macroMap, processMap) }
    }),
    { key: 'code', header: 'Código', accessor: (a) => a.code || '' },
    { key: 'name', header: 'Activo', accessor: (a) => a.name || '', className: 'text-white font-medium max-w-[200px]', cell: (a) => <div className="truncate" title={a.name}>{a.name}</div> },
    { key: 'type', header: 'Tipo', accessor: (a) => a.asset_type || '' },
    { key: 'format', header: 'Formato', accessor: (a) => a.format || '' },
    { key: 'op', header: 'Operación', accessor: (a) => opByAsset.get(a.id) || '' },
    { key: 'owner', header: 'Propietario', accessor: (a) => a.owner || '' },
    { key: 'custodian', header: 'Custodio', accessor: (a) => a.custodian || '' },
    { key: 'location', header: 'Ubicación', accessor: (a) => a.location || '', className: 'max-w-[160px]', cell: (a) => <div className="truncate" title={a.location}>{a.location || '-'}</div> },
    { key: 'c', header: 'C', accessor: (a) => a.confidentiality ?? 0 },
    { key: 'i', header: 'I', accessor: (a) => a.integrity ?? 0 },
    { key: 'a', header: 'D', accessor: (a) => a.availability ?? 0 },
    { key: 'crit', header: 'Criticidad', accessor: (a) => a.criticality || 0, cell: (a) => { const b = critBand(a.criticality || 0); return <Badge label={`${a.criticality || 0} · ${b.label}`} hex={b.hex} /> } },
    { key: 'label', header: 'Clasificación', accessor: (a) => a.label || '' },
    { key: 'pd', header: 'Datos personales', accessor: (a) => (a.has_personal_data ? 'Sí' : 'No'), cell: (a) => a.has_personal_data ? <Badge label={a.personal_data_category || 'Sí'} hex="#d97706" /> : <span className="text-white/30">No</span> },
    { key: 'ret', header: 'Retención', accessor: (a) => a.retention_period || '' },
    { key: 'disp', header: 'Disposición', accessor: (a) => a.disposal_method || '' },
    { key: 'status', header: 'Estado', accessor: (a) => a.status || '' },
  ], [org, processMap, macroMap, opByAsset])

  const byBand = useMemo<Datum[]>(() => BANDS.map((b) => ({
    label: b, color: BAND_HEX[b], value: list.filter((a) => critBand(a.criticality || 0).label === b).length,
  })).filter((d) => d.value > 0), [list])
  const byType = useMemo<Datum[]>(() => {
    const m = new Map<string, number>()
    list.forEach((a) => { if (a.asset_type) m.set(a.asset_type, (m.get(a.asset_type) || 0) + 1) })
    return [...m.entries()].map(([label, value]) => ({ label, value, color: '#6366f1' })).sort((a, b) => b.value - a.value)
  }, [list])
  const criticosItems = useMemo<OrgTopItem[]>(() => list
    .filter((a) => (a.criticality || 0) >= 4)
    .map((a) => { const p = a.process_id ? processMap.get(a.process_id) : undefined; return { management: p?.management, coordination: p?.coordination, operative: p?.operative, process: p?.name } }),
    [list, processMap])

  const criticos = list.filter((a) => (a.criticality || 0) >= 4).length
  const conDatos = list.filter((a) => a.has_personal_data).length
  const sinClasif = list.filter((a) => !a.criticality).length

  return (
    <Dashboard>
      <Grid cols={4}>
        <Stat label="Activos" value={list.length} sub="de información" tone="cyan" />
        <Stat label="Críticos + altos" value={criticos} sub={`${list.length ? Math.round(criticos / list.length * 100) : 0}% del total`} tone="red" />
        <Stat label="Con datos personales" value={conDatos} sub="requieren protección" tone="amber" />
        <Stat label="Sin clasificar C·I·D" value={sinClasif} sub="pendientes de valorar" tone="violet" />
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Criticidad (C·I·D)" sub="Mayor de las tres dimensiones. Clic para filtrar la tabla.">
          <Donut data={byBand} center={String(list.length)} unit="activos" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {byBand.map((d) => <button key={d.label} onClick={() => setFBand(fBand === d.label ? '' : d.label)} className={`text-[10px] px-2 py-1 rounded-md border ${fBand === d.label ? 'border-white/40 text-white' : 'border-white/10 text-white/50'}`}>{d.label}</button>)}
          </div>
        </Card>
        <Card title="Por tipo de activo" sub="Clic para filtrar la tabla."><HBars data={byType} onBar={(l) => setFType(fType === l ? '' : l)} active={fType} /></Card>
      </div>

      <OrgTopChart title="Activos más críticos" sub="Criticidad alta/crítica por nivel organizacional." items={criticosItems} org={org} color="#ef4444" />

      <div className="space-y-2">
        {criticos > 0 && <Insight tone="crit">{criticos} activo(s) con criticidad alta o crítica. Prioriza su protección y su evaluación de riesgo (amenaza × vulnerabilidad).</Insight>}
        {conDatos > 0 && <Insight tone="warn">{conDatos} activo(s) contienen datos personales. Verifica base legal, retención y método de disposición.</Insight>}
        {sinClasif > 0 && <Insight tone="warn">{sinClasif} activo(s) sin clasificación C·I·D. Sin valorarlos no se puede priorizar su riesgo.</Insight>}
      </div>

      <DataTable columns={columns} rows={shown} minWidth={1700} rowKey={(a) => a.id} />
    </Dashboard>
  )
}
