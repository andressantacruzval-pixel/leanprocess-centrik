import { useMemo, useState } from 'react'
import { Map, AlertTriangle, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react'
import { useInventoryData } from '../useInventoryData'
import { useInventoryStore } from '@/stores/inventoryStore'
import { useCompanyStore } from '@/stores/companyStore'
import { countBy, leafAreas } from '../inventoryUtils'
import { findings, type FindingLevel } from '../inventoryStats'
import { useInventoryReportRows, EMPTY_FILTERS, BANDERAS, type RepFilters, type InvReportRow } from '../inventoryReportData'
import { exportInventoryExcel } from '../inventoryExcel'
import { TIPO_COLOR } from '../types'
import { OriginBadge } from './OriginBadge'
import { InventoryReportSidebar } from './InventoryReportSidebar'
import { DataTable, type Column } from '@/features/reporting/components/DataTable'
import { hierarchyColumns } from '@/features/reporting/components/hierarchyColumns'
import { useOrgLabels, useOrgUnitNamesByLevel } from '@/hooks/useOrgLabels'
import { usePlanLimits } from '@/hooks/useActiveCompany'
import { planName } from '@/lib/plans'
import { avisarSiSinCupo } from '@/lib/planGateMessage'

const boolTxt = (v: boolean | null): string => (v == null ? '' : v ? 'Sí' : 'No')
const banderasTxt = (s: InvReportRow): string => BANDERAS.filter((b) => s[b.key] === true).map((b) => b.label).join(', ')

// Reporte unificado del Inventario: barra lateral (navegación + filtros) + KPIs
// + gráficos + tabla con TODA la caracterización (crítico, efectivo, nivel,
// gerencia, área) y el SIPOC completo por fila + hallazgos automáticos.

export function InventoryReport() {
  const org = useOrgLabels()
  const orgNames = useOrgUnitNamesByLevel()
  const companyName = useCompanyStore((s) => s.company?.name) ?? 'Empresa'
  const { companyId, appMacros, appAreas, doc } = useInventoryData()
  const editSub = useInventoryStore((s) => s.editSub)
  const macros = doc?.macros?.length ? doc.macros : appMacros
  const areas = doc?.areas?.length ? doc.areas : appAreas

  const plan = usePlanLimits()

  const [f, setF] = useState<RepFilters>(EMPTY_FILTERS)
  const set = <K extends keyof RepFilters>(k: K, v: string) => setF((p) => ({ ...p, [k]: v }))

  const all = useInventoryReportRows(companyId, macros)
  const hojas = useMemo(() => leafAreas(areas, macros), [areas, macros])
  const niveles = useMemo(() => [...new Set(all.map((r) => r.nivelEjecucion).filter(Boolean))].sort(), [all])
  // Unión con la estructura viva del organigrama: todas las gerencias aparecen
  // aunque aún no tengan subprocesos (#3), sin perder valores huérfanos.
  const gerencias = useMemo(
    () => [...new Set([...orgNames.managements, ...all.map((r) => r.gerencia).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'es')),
    [orgNames, all]
  )
  const frecuencias = useMemo(() => [...new Set(all.map((r) => r.frecuencia).filter(Boolean))].sort(), [all])
  const tiposProceso = useMemo(() => [...new Set(all.map((r) => r.tipoProceso).filter(Boolean))].sort(), [all])

  const subs = useMemo(() => all.filter((s) =>
    (!f.tipo || s.tipo === f.tipo) &&
    (!f.macro || s.macro === f.macro) &&
    (!f.area || s.area === f.area) &&
    (!f.origen || s.origen === f.origen) &&
    (!f.nivel || s.nivelEjecucion === f.nivel) &&
    (!f.gerencia || s.gerencia === f.gerencia) &&
    (!f.frecuencia || s.frecuencia === f.frecuencia) &&
    (!f.tipoProceso || s.tipoProceso === f.tipoProceso) &&
    (!f.critico || (f.critico === 'si' ? s.critico === true : s.critico === false)) &&
    (!f.efectivo || (f.efectivo === 'si' ? s.efectivo === true : s.efectivo === false)) &&
    (!f.bandera || s[f.bandera as keyof InvReportRow] === true)
  ), [all, f])

  const columns = useMemo<Column<InvReportRow>[]>(() => [
    ...hierarchyColumns<InvReportRow>(org, (s) => ({
      management: s.gerencia, coordination: s.coordinacion, operative: s.operativo,
      macro: s.macro, proceso: s.proceso, subproceso: s.nombre,
    })),
    { key: 'area', header: 'Área', width: 120, accessor: (s) => s.area || '', cell: (s) => <div className="truncate text-gray-700">{s.area || '—'}</div> },
    { key: 'objetivo', header: 'Objetivo', width: 220, accessor: (s) => s.objetivo || '', cell: (s) => <div className="truncate text-gray-500" title={s.objetivo}>{s.objetivo || '—'}</div> },
    { key: 'responsable', header: 'Responsable', width: 140, accessor: (s) => s.responsable || '', cell: (s) => <div className="truncate">{s.responsable || '—'}</div> },
    { key: 'critico', header: 'Crítico', width: 80, accessor: (s) => boolTxt(s.critico), cell: (s) => <Bool v={s.critico} yes="Sí" danger /> },
    { key: 'efectivo', header: 'Mov. efectivo', width: 100, accessor: (s) => boolTxt(s.efectivo), cell: (s) => <Bool v={s.efectivo} yes="Sí" /> },
    { key: 'nivel', header: 'Nivel ejec.', width: 120, accessor: (s) => s.nivelEjecucion || '', cell: (s) => <div className="truncate">{s.nivelEjecucion || '—'}</div> },
    { key: 'frecuencia', header: 'Frecuencia', width: 120, accessor: (s) => s.frecuencia || '', cell: (s) => <div className="truncate">{s.frecuencia || '—'}</div> },
    { key: 'tipoProceso', header: 'Tipo proceso', width: 130, accessor: (s) => s.tipoProceso || '', cell: (s) => <div className="truncate">{s.tipoProceso || '—'}</div> },
    { key: 'tipoEjec', header: 'Tipo ejec.', width: 130, accessor: (s) => s.tipoEjecucion || '', cell: (s) => <div className="truncate">{s.tipoEjecucion || '—'}</div> },
    { key: 'medio', header: 'Medio entrega', width: 130, accessor: (s) => s.medioEntrega || '', cell: (s) => <div className="truncate">{s.medioEntrega || '—'}</div> },
    { key: 'supervision', header: 'Supervisión', width: 120, accessor: (s) => s.supervision || '', cell: (s) => <div className="truncate">{s.supervision || '—'}</div> },
    { key: 'banderas', header: 'Banderas', width: 170, accessor: (s) => banderasTxt(s), cell: (s) => <Banderas row={s} /> },
    { key: 'proveedores', header: 'Proveedores', width: 180, accessor: (s) => s.proveedores || '', cell: (s) => <div className="truncate text-gray-600" title={s.proveedores}>{s.proveedores || '—'}</div> },
    { key: 'entradas', header: 'Entradas', width: 180, accessor: (s) => s.entradas || '', cell: (s) => <div className="truncate text-gray-600" title={s.entradas}>{s.entradas || '—'}</div> },
    { key: 'salidas', header: 'Salidas', width: 180, accessor: (s) => s.salidas || '', cell: (s) => <div className="truncate text-gray-600" title={s.salidas}>{s.salidas || '—'}</div> },
    { key: 'clientes', header: 'Clientes', width: 180, accessor: (s) => s.clientes || '', cell: (s) => <div className="truncate text-gray-600" title={s.clientes}>{s.clientes || '—'}</div> },
    {
      key: 'estado', header: 'Estado', width: 120, accessor: (s) => (s.origen === 'confirmado' ? 'Aceptado' : 'Deducido'),
      cell: (s) => (
        <button
          title={s.origen === 'confirmado' ? 'Aceptado — clic para volver a deducido' : 'Deducido por IA — clic para aceptar'}
          onClick={() => editSub(companyId, s.mi, s.pi, s.si, { origen: s.origen === 'confirmado' ? 'deducido' : 'confirmado' })}
          className="inline-flex items-center gap-1.5 hover:opacity-80"
        >
          <OriginBadge origen={s.origen} />
          <span className="text-[11px] text-gray-500">{s.origen === 'confirmado' ? 'Aceptado' : 'Deducido'}</span>
        </button>
      ),
    },
  ], [org, companyId, editSub])

  if (!all.length) {
    return (
      <div className="p-10 text-center">
        <Map size={28} className="mx-auto text-gray-300 mb-3" />
        <h3 className="text-base font-semibold text-gray-900">Aún no hay inventario</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">Abre el <b className="text-gray-700">Mapa de Procesos</b> y pulsa <b className="text-gray-700">Inventario de Procesos IA</b> para generarlo. Aquí verás la tabla, los gráficos y los hallazgos.</p>
      </div>
    )
  }

  const conf = subs.filter((s) => s.origen === 'confirmado').length
  const criticos = subs.filter((s) => s.critico === true).length
  const efectivo = subs.filter((s) => s.efectivo === true).length
  const areasConCarga = new Set(subs.map((s) => s.area).filter(Boolean)).size
  const porArea = countBy(subs, 'area')
  const porMacro = countBy(subs, 'macro')
  const maxArea = Math.max(1, ...porArea.map((x) => x.value))
  const maxMacro = Math.max(1, ...porMacro.map((x) => x.value))
  const F = findings(macros, areas)

  return (
    <div className="p-3 sm:p-4 flex flex-col lg:flex-row gap-4 text-gray-800">
      <InventoryReportSidebar macros={macros} hojas={hojas} niveles={niveles} gerencias={gerencias} gerenciaLabel={org.l0}
        frecuencias={frecuencias} tiposProceso={tiposProceso}
        f={f} set={set} clear={() => setF(EMPTY_FILTERS)} shown={subs.length} total={all.length} />

      <div className="min-w-0 flex-1 space-y-5">
        <div className="flex justify-end">
          <button onClick={() => exportInventoryExcel(subs, companyName, org)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors">
            <FileSpreadsheet size={13} /> Exportar Excel (todas las columnas)
          </button>
        </div>

        {/* Uso del plan — cuántos procesos has documentado y cuántos te quedan */}
        {plan.isCommunity && plan.cap !== null && (
          <PlanUsageBanner documented={plan.documented.count} cap={plan.cap} level={plan.level}
            reached={plan.documented.reached} hasNext={plan.hasNextLevel} />
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Kpi label="Subprocesos" value={subs.length} sub="el trabajo real" accent />
          <Kpi label="Procesos" value={new Set(subs.map((s) => s.macro + '||' + s.proceso)).size} sub="agrupaciones" />
          <Kpi label="Críticos" value={criticos} sub={`${subs.length ? Math.round(criticos / subs.length * 100) : 0}% del total`} />
          <Kpi label="Mov. efectivo" value={efectivo} sub="tocan dinero" />
          <Kpi label="Áreas con carga" value={`${areasConCarga}/${hojas.length}`} sub={`${Math.max(0, hojas.length - areasConCarga)} sin trabajo`} />
          <Kpi label="Confirmado" value={`${subs.length ? Math.round(conf / subs.length * 100) : 0}%`} sub={`${subs.length - conf} por validar`} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card title="Carga por área" sub="Clic en una barra para filtrar.">
            <div className="space-y-1.5">
              {porArea.map((d) => <BarRow key={d.label} label={d.label} value={d.value} max={maxArea} color="#06b6d4" onClick={() => set('area', f.area === d.label ? '' : d.label)} />)}
            </div>
          </Card>
          <Card title="Subprocesos por macroproceso" sub="Color por franja. Clic para filtrar.">
            <div className="space-y-1.5">
              {porMacro.map((d) => {
                const m = macros.find((x) => x.nombre === d.label)
                return <BarRow key={d.label} label={d.label} value={d.value} max={maxMacro} color={m ? TIPO_COLOR[m.tipo] : '#3987e5'} onClick={() => set('macro', f.macro === d.label ? '' : d.label)} />
              })}
            </div>
          </Card>
        </div>

        {/* Tabla */}
        <Card title="Inventario detallado" sub="Caracterización completa y SIPOC por subproceso. Ordena y filtra por columna; arrastra el borde de la cabecera para ajustar el ancho.">
          <DataTable columns={columns} rows={subs} minWidth={1200} rowKey={(s) => `${s.mi}-${s.pi}-${s.si}`} />
        </Card>

        {/* Hallazgos */}
        <Card title="Hallazgos automáticos" sub="Cruces sobre el inventario completo. Material directo para el informe.">
          <div className="space-y-2">{F.map((fd, i) => <FindingRow key={i} lvl={fd.lvl} text={fd.t} />)}</div>
        </Card>
      </div>
    </div>
  )
}

function Bool({ v, yes, danger }: { v: boolean | null; yes: string; danger?: boolean }) {
  if (v == null) return <span className="text-gray-300">—</span>
  if (!v) return <span className="text-gray-400">No</span>
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${danger ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{yes}</span>
}

// Chips compactos con las banderas de cumplimiento/continuidad activas.
const BANDERA_SHORT: Record<string, string> = {
  contingencia: 'Conting.', impuestos: 'Impuestos', contabilidad: 'Contab.', datosPersonales: 'Datos pers.', terceros: 'Terceros',
}
function Banderas({ row }: { row: InvReportRow }) {
  const activas = BANDERAS.filter((b) => row[b.key] === true)
  if (!activas.length) return <span className="text-gray-300">—</span>
  return (
    <div className="flex flex-wrap gap-1 max-w-[190px]">
      {activas.map((b) => (
        <span key={b.key} title={b.label} className="inline-flex items-center rounded-md bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap">
          {BANDERA_SHORT[b.key as string]}
        </span>
      ))}
    </div>
  )
}

// Banner de uso del plan: documentados vs cupo y cuántos quedan por levantar.
// Crear procesos es libre; el cupo gobierna DOCUMENTAR, así que el número que
// importa aquí es cuántos puedes caracterizar/diagramar dentro de tu plan.
function PlanUsageBanner({ documented, cap, level, reached, hasNext }: { documented: number; cap: number; level: number; reached: boolean; hasNext: boolean }) {
  const restantes = Math.max(0, cap - documented)
  const pct = Math.min(100, Math.round((documented / cap) * 100))
  const near = !reached && documented >= cap * 0.8
  const barColor = reached ? '#d03b3b' : near ? '#f59e0b' : '#06b6d4'
  return (
    <div className={`rounded-lg border p-4 ${reached ? 'border-red-300 bg-red-50' : near ? 'border-amber-300 bg-amber-50' : 'border-primary-200 bg-primary-50'}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Documentación de tu {planName(level)}</div>
          <div className="text-2xl font-black mt-0.5 leading-none tabular-nums text-gray-900">
            {documented} <span className="text-gray-500 text-lg font-bold">/ {cap}</span>
            <span className="text-[12px] font-medium text-gray-500 ml-2">procesos documentados</span>
          </div>
          <div className="text-[11px] mt-1 text-gray-500">
            {reached
              ? 'Has usado todo el cupo de documentación de tu plan. Puedes seguir armando el mapa; para documentar más, amplía tu plan.'
              : `Te quedan ${restantes} proceso${restantes === 1 ? '' : 's'} por documentar en tu plan. Crear la tarjeta del proceso es libre.`}
          </div>
        </div>
        {hasNext && (
          <button onClick={() => avisarSiSinCupo(true, level, cap)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
              reached ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 'bg-gray-50 text-primary-700 border-primary-200 hover:bg-primary-50'
            }`}>
            Ampliar plan
          </button>
        )}
      </div>
      <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(3, pct)}%`, background: barColor }} />
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, accent }: { label: string; value: number | string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${accent ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-black mt-1 leading-none tabular-nums ${accent ? 'text-primary-600' : 'text-gray-900'}`}>{value}</div>
      <div className="text-[10px] text-gray-400 mt-1">{sub}</div>
    </div>
  )
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      {sub && <p className="text-[12px] text-gray-500 mt-0.5 mb-3">{sub}</p>}
      {children}
    </div>
  )
}

function BarRow({ label, value, max, color, onClick }: { label: string; value: number; max: number; color: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 group text-left">
      <span className="w-36 shrink-0 text-[12px] text-gray-600 truncate text-right group-hover:text-gray-800">{label}</span>
      <span className="flex-1 h-5 rounded-md bg-gray-50 overflow-hidden">
        <span className="h-full rounded-md flex items-center justify-end px-2" style={{ width: `${Math.max(6, value / max * 100)}%`, background: color }}>
          <span className="text-[10px] font-bold text-gray-800">{value}</span>
        </span>
      </span>
    </button>
  )
}


const F_ICON: Record<FindingLevel, { icon: typeof XCircle; color: string }> = {
  crit: { icon: XCircle, color: '#d03b3b' },
  ser: { icon: AlertTriangle, color: '#ec835a' },
  warn: { icon: AlertTriangle, color: '#f59e0b' },
  ok: { icon: CheckCircle2, color: '#16a34a' },
}
function FindingRow({ lvl, text }: { lvl: FindingLevel; text: string }) {
  const { icon: Icon, color } = F_ICON[lvl]
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
      <Icon size={15} className="mt-0.5 shrink-0" style={{ color }} />
      <p className="text-[12.5px] text-gray-700 leading-snug">{text}</p>
    </div>
  )
}
