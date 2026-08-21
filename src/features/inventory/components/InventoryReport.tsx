import { useMemo, useState } from 'react'
import { Map, AlertTriangle, CheckCircle2, XCircle, X } from 'lucide-react'
import { useInventoryData } from '../useInventoryData'
import { allSubs, countBy, leafAreas, type FlatSub } from '../inventoryUtils'
import { findings, globalStats, type FindingLevel } from '../inventoryStats'
import { TIPO_COLOR, type InvTipo } from '../types'

// Reporte unificado del Inventario: filtros gráficos + tabla + gráficos + hallazgos.
// Fuente única = el inventario de la empresa (mapa Nivel 0 de la app + lo generado
// por la IA). Sustituye a los dos reportes separados (tabla y dashboard).

const FRANJAS: InvTipo[] = ['Productivo', 'Apoyo', 'Estratégico']

export function InventoryReport() {
  const { appMacros, appAreas, doc } = useInventoryData()
  const macros = doc?.macros?.length ? doc.macros : appMacros
  const areas = doc?.areas?.length ? doc.areas : appAreas

  const [fTipo, setFTipo] = useState('')
  const [fMacro, setFMacro] = useState('')
  const [fArea, setFArea] = useState('')
  const [fOrigen, setFOrigen] = useState('')

  const all = useMemo(() => allSubs(macros), [macros])
  const hojas = useMemo(() => leafAreas(areas, macros), [areas, macros])

  const subs = useMemo(() => all.filter((s) =>
    (!fTipo || s.tipo === fTipo) &&
    (!fMacro || s.macro === fMacro) &&
    (!fArea || s.area === fArea) &&
    (!fOrigen || s.origen === fOrigen)
  ), [all, fTipo, fMacro, fArea, fOrigen])

  if (!all.length) {
    return (
      <div className="p-10 text-center">
        <Map size={28} className="mx-auto text-white/20 mb-3" />
        <h3 className="text-base font-semibold text-white">Aún no hay inventario</h3>
        <p className="text-sm text-white/50 mt-1 max-w-md mx-auto">Abre el <b className="text-white/70">Mapa de Procesos</b> y pulsa <b className="text-white/70">Inventario de Procesos IA</b> para generarlo. Aquí verás la tabla, los gráficos y los hallazgos.</p>
      </div>
    )
  }

  const hasF = fTipo || fMacro || fArea || fOrigen
  const conf = subs.filter((s) => s.origen === 'confirmado').length
  const objOk = subs.filter((s) => (s.objetivo || '').trim().length >= 15).length
  const areasConCarga = new Set(subs.map((s) => s.area).filter(Boolean)).size
  const porArea = countBy(subs, 'area')
  const porMacro = countBy(subs, 'macro')
  const maxArea = Math.max(1, ...porArea.map((x) => x.value))
  const maxMacro = Math.max(1, ...porMacro.map((x) => x.value))
  const G = globalStats(macros, areas)
  const F = findings(macros, areas)

  return (
    <div className="p-3 sm:p-4 space-y-5">
      {/* Filtros gráficos */}
      <div className="flex items-center gap-2 flex-wrap">
        <Sel value={fTipo} onChange={setFTipo} placeholder="Franja" options={FRANJAS.map((t) => ({ v: t, l: t }))} />
        <Sel value={fMacro} onChange={setFMacro} placeholder="Macroproceso" options={macros.map((m) => ({ v: m.nombre, l: m.nombre }))} />
        <Sel value={fArea} onChange={setFArea} placeholder="Área" options={hojas.map((a) => ({ v: a, l: a }))} />
        <Sel value={fOrigen} onChange={setFOrigen} placeholder="Estado" options={[{ v: 'confirmado', l: 'Confirmado' }, { v: 'deducido', l: 'Deducido' }]} />
        {hasF && <button onClick={() => { setFTipo(''); setFMacro(''); setFArea(''); setFOrigen('') }} className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70"><X size={12} /> Limpiar</button>}
        <span className="ml-auto text-[11px] text-white/30">{subs.length}{subs.length !== all.length ? ` de ${all.length}` : ''} subprocesos</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Subprocesos" value={subs.length} sub="el trabajo real" accent />
        <Kpi label="Procesos" value={new Set(subs.map((s) => s.macro + '||' + s.proceso)).size} sub="agrupaciones" />
        <Kpi label="Áreas con carga" value={`${areasConCarga}/${hojas.length}`} sub={`${Math.max(0, hojas.length - areasConCarga)} sin trabajo`} />
        <Kpi label="Macroprocesos" value={`${new Set(subs.map((s) => s.macro)).size}/${G.M}`} sub="cubiertos" />
        <Kpi label="Confirmado" value={`${subs.length ? Math.round(conf / subs.length * 100) : 0}%`} sub={`${subs.length - conf} por validar`} />
        <Kpi label="Con objetivo" value={`${subs.length ? Math.round(objOk / subs.length * 100) : 0}%`} sub={`${subs.length - objOk} sin redactar`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Carga por área" sub="Clic en una barra para filtrar.">
          <div className="space-y-1.5">
            {porArea.map((d) => <BarRow key={d.label} label={d.label} value={d.value} max={maxArea} color="#06b6d4" onClick={() => setFArea(fArea === d.label ? '' : d.label)} />)}
          </div>
        </Card>
        <Card title="Subprocesos por macroproceso" sub="Color por franja. Clic para filtrar.">
          <div className="space-y-1.5">
            {porMacro.map((d) => {
              const m = macros.find((x) => x.nombre === d.label)
              return <BarRow key={d.label} label={d.label} value={d.value} max={maxMacro} color={m ? TIPO_COLOR[m.tipo] : '#3987e5'} onClick={() => setFMacro(fMacro === d.label ? '' : d.label)} />
            })}
          </div>
        </Card>
      </div>

      {/* Tabla */}
      <Card title="Inventario detallado" sub="Área → macroproceso → proceso → subproceso, con objetivo y estado.">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="text-left text-white/40 border-b border-white/10">
                <Th>Área</Th><Th>Macroproceso</Th><Th>Proceso</Th><Th>Subproceso</Th><Th>Objetivo</Th><Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <Td>{s.area || <span className="text-white/25">—</span>}</Td>
                  <Td><span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full shrink-0" style={{ background: TIPO_COLOR[(s.tipo as InvTipo)] ?? '#3987e5' }} />{s.macro}</span></Td>
                  <Td className="text-cyan-300">{s.proceso}</Td>
                  <Td className="text-white/85">{s.nombre}</Td>
                  <Td className="text-white/45 max-w-[280px]">{s.objetivo}</Td>
                  <Td><OriginBadge s={s} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Hallazgos */}
      <Card title="Hallazgos automáticos" sub="Cruces sobre el inventario completo. Material directo para el informe.">
        <div className="space-y-2">{F.map((f, i) => <FindingRow key={i} lvl={f.lvl} text={f.t} />)}</div>
      </Card>
    </div>
  )
}

function Sel({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: { v: string; l: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="appearance-none bg-white/[0.03] border border-white/10 rounded-lg pl-2.5 pr-6 py-1.5 text-[11px] text-white/70 outline-none cursor-pointer focus:ring-2 focus:ring-cyan-500/50">
      <option value="">{placeholder}: todos</option>
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
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

function OriginBadge({ s }: { s: FlatSub }) {
  const ok = s.origen === 'confirmado'
  return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: ok ? 'rgba(22,163,74,.14)' : 'rgba(245,158,11,.14)', color: ok ? '#16a34a' : '#d97706' }}>{ok ? 'Confirmado' : 'Deducido'}</span>
}

function Th({ children }: { children: React.ReactNode }) { return <th className="py-2 px-2 font-medium uppercase tracking-wide text-[10px]">{children}</th> }
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
