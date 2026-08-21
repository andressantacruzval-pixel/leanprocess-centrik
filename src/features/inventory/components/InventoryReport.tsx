import { useMemo, useState } from 'react'
import { Map, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useInventoryData } from '../useInventoryData'
import { useInventoryStore } from '@/stores/inventoryStore'
import { countBy, leafAreas } from '../inventoryUtils'
import { findings, type FindingLevel } from '../inventoryStats'
import { useInventoryReportRows, EMPTY_FILTERS, BANDERAS, type RepFilters, type InvReportRow } from '../inventoryReportData'
import { TIPO_COLOR, type InvTipo } from '../types'
import { OriginBadge } from './OriginBadge'
import { InventoryReportSidebar } from './InventoryReportSidebar'

// Reporte unificado del Inventario: barra lateral (navegación + filtros) + KPIs
// + gráficos + tabla con TODA la caracterización (crítico, efectivo, nivel,
// gerencia, área) y el SIPOC completo por fila + hallazgos automáticos.

export function InventoryReport() {
  const { companyId, appMacros, appAreas, doc } = useInventoryData()
  const editSub = useInventoryStore((s) => s.editSub)
  const macros = doc?.macros?.length ? doc.macros : appMacros
  const areas = doc?.areas?.length ? doc.areas : appAreas

  const [f, setF] = useState<RepFilters>(EMPTY_FILTERS)
  const set = <K extends keyof RepFilters>(k: K, v: string) => setF((p) => ({ ...p, [k]: v }))

  const all = useInventoryReportRows(companyId, macros)
  const hojas = useMemo(() => leafAreas(areas, macros), [areas, macros])
  const niveles = useMemo(() => [...new Set(all.map((r) => r.nivelEjecucion).filter(Boolean))].sort(), [all])
  const gerencias = useMemo(() => [...new Set(all.map((r) => r.gerencia).filter(Boolean))].sort(), [all])
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

  if (!all.length) {
    return (
      <div className="p-10 text-center">
        <Map size={28} className="mx-auto text-white/20 mb-3" />
        <h3 className="text-base font-semibold text-white">Aún no hay inventario</h3>
        <p className="text-sm text-white/50 mt-1 max-w-md mx-auto">Abre el <b className="text-white/70">Mapa de Procesos</b> y pulsa <b className="text-white/70">Inventario de Procesos IA</b> para generarlo. Aquí verás la tabla, los gráficos y los hallazgos.</p>
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
    <div className="p-3 sm:p-4 flex flex-col lg:flex-row gap-4 text-white/80">
      <InventoryReportSidebar macros={macros} hojas={hojas} niveles={niveles} gerencias={gerencias}
        frecuencias={frecuencias} tiposProceso={tiposProceso}
        f={f} set={set} clear={() => setF(EMPTY_FILTERS)} shown={subs.length} total={all.length} />

      <div className="min-w-0 flex-1 space-y-5">
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
        <Card title="Inventario detallado" sub="Caracterización completa y SIPOC por subproceso. Desliza para ver todas las columnas.">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="text-left text-white/45 border-b border-white/10">
                  <Th>Área</Th><Th>Macroproceso</Th><Th>Proceso</Th><Th>Subproceso</Th><Th>Objetivo</Th>
                  <Th>Responsable</Th><Th>Crítico</Th><Th>Efectivo</Th><Th>Nivel ejec.</Th><Th>Gerencia</Th>
                  <Th>Frecuencia</Th><Th>Tipo proceso</Th><Th>Tipo ejec.</Th><Th>Medio entrega</Th><Th>Supervisión</Th>
                  <Th>Banderas</Th>
                  <Th>Proveedores</Th><Th>Entradas</Th><Th>Salidas</Th><Th>Clientes</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <Td className="text-white/70">{s.area || <span className="text-white/25">—</span>}</Td>
                    <Td className="text-white/85"><span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full shrink-0" style={{ background: TIPO_COLOR[(s.tipo as InvTipo)] ?? '#3987e5' }} />{s.macro}</span></Td>
                    <Td className="text-cyan-300">{s.proceso}</Td>
                    <Td className="text-white font-medium">{s.nombre}</Td>
                    <Td className="text-white/50 max-w-[220px]"><div className="truncate" title={s.objetivo}>{s.objetivo || <span className="text-white/20">—</span>}</div></Td>
                    <Td className="text-white/60 max-w-[130px]"><div className="truncate">{s.responsable || <span className="text-white/20">—</span>}</div></Td>
                    <Td><Bool v={s.critico} yes="Sí" danger /></Td>
                    <Td><Bool v={s.efectivo} yes="Sí" /></Td>
                    <Td className="text-white/60">{s.nivelEjecucion || <span className="text-white/20">—</span>}</Td>
                    <Td className="text-white/60">{s.gerencia || <span className="text-white/20">—</span>}</Td>
                    <Td className="text-white/60">{s.frecuencia || <span className="text-white/20">—</span>}</Td>
                    <Td className="text-white/60">{s.tipoProceso || <span className="text-white/20">—</span>}</Td>
                    <Td className="text-white/60">{s.tipoEjecucion || <span className="text-white/20">—</span>}</Td>
                    <Td className="text-white/60">{s.medioEntrega || <span className="text-white/20">—</span>}</Td>
                    <Td className="text-white/60">{s.supervision || <span className="text-white/20">—</span>}</Td>
                    <Td><Banderas row={s} /></Td>
                    <Td className="text-white/55 max-w-[200px]">{s.proveedores || <span className="text-white/20">—</span>}</Td>
                    <Td className="text-white/55 max-w-[200px]">{s.entradas || <span className="text-white/20">—</span>}</Td>
                    <Td className="text-white/55 max-w-[200px]">{s.salidas || <span className="text-white/20">—</span>}</Td>
                    <Td className="text-white/55 max-w-[200px]">{s.clientes || <span className="text-white/20">—</span>}</Td>
                    <Td>
                      <button
                        title={s.origen === 'confirmado' ? 'Aceptado — clic para volver a deducido' : 'Deducido por IA — clic para aceptar'}
                        onClick={() => editSub(companyId, s.mi, s.pi, s.si, { origen: s.origen === 'confirmado' ? 'deducido' : 'confirmado' })}
                        className="inline-flex items-center gap-1.5 hover:opacity-80"
                      >
                        <OriginBadge origen={s.origen} />
                        <span className="text-[11px] text-white/50">{s.origen === 'confirmado' ? 'Aceptado' : 'Deducido'}</span>
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  if (v == null) return <span className="text-white/20">—</span>
  if (!v) return <span className="text-white/30">No</span>
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${danger ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'}`}>{yes}</span>
}

// Chips compactos con las banderas de cumplimiento/continuidad activas.
const BANDERA_SHORT: Record<string, string> = {
  contingencia: 'Conting.', impuestos: 'Impuestos', contabilidad: 'Contab.', datosPersonales: 'Datos pers.', terceros: 'Terceros',
}
function Banderas({ row }: { row: InvReportRow }) {
  const activas = BANDERAS.filter((b) => row[b.key] === true)
  if (!activas.length) return <span className="text-white/20">—</span>
  return (
    <div className="flex flex-wrap gap-1 max-w-[190px]">
      {activas.map((b) => (
        <span key={b.key} title={b.label} className="inline-flex items-center rounded bg-amber-500/12 text-amber-300 px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap">
          {BANDERA_SHORT[b.key as string]}
        </span>
      ))}
    </div>
  )
}

function Kpi({ label, value, sub, accent }: { label: string; value: number | string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-cyan-500/30 bg-cyan-500/[0.06]' : 'border-white/10 bg-white/5'}`}>
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
      <div className={`text-2xl font-black mt-1 leading-none tabular-nums ${accent ? 'text-cyan-400' : 'text-white'}`}>{value}</div>
      <div className="text-[10px] text-white/35 mt-1">{sub}</div>
    </div>
  )
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      {sub && <p className="text-[12px] text-white/40 mt-0.5 mb-3">{sub}</p>}
      {children}
    </div>
  )
}

function BarRow({ label, value, max, color, onClick }: { label: string; value: number; max: number; color: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 group text-left">
      <span className="w-36 shrink-0 text-[12px] text-white/60 truncate text-right group-hover:text-white/90">{label}</span>
      <span className="flex-1 h-5 rounded-md bg-white/5 overflow-hidden">
        <span className="h-full rounded-md flex items-center justify-end px-2" style={{ width: `${Math.max(6, value / max * 100)}%`, background: color }}>
          <span className="text-[10px] font-bold text-white/90">{value}</span>
        </span>
      </span>
    </button>
  )
}

function Th({ children }: { children: React.ReactNode }) { return <th className="py-2 px-2 font-medium uppercase tracking-wide text-[10px] whitespace-nowrap">{children}</th> }
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <td className={`py-2 px-2 align-top ${className}`}>{children}</td> }

const F_ICON: Record<FindingLevel, { icon: typeof XCircle; color: string }> = {
  crit: { icon: XCircle, color: '#d03b3b' },
  ser: { icon: AlertTriangle, color: '#ec835a' },
  warn: { icon: AlertTriangle, color: '#f59e0b' },
  ok: { icon: CheckCircle2, color: '#16a34a' },
}
function FindingRow({ lvl, text }: { lvl: FindingLevel; text: string }) {
  const { icon: Icon, color } = F_ICON[lvl]
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
      <Icon size={15} className="mt-0.5 shrink-0" style={{ color }} />
      <p className="text-[12.5px] text-white/70 leading-snug">{text}</p>
    </div>
  )
}
