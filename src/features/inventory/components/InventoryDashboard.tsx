import { useMemo } from 'react'
import { Map, AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { useInventoryData } from '../useInventoryData'
import { allSubs, countBy, leafAreas } from '../inventoryUtils'
import { findings, globalStats, type FindingLevel } from '../inventoryStats'
import { TIPO_COLOR } from '../types'

// Dashboard del inventario para Reportes: quién carga qué, qué área quedó sin
// trabajo, qué se hace dos veces. Lee el documento del inventario de la empresa
// activa (mapa Nivel 0 desde la app + lo levantado con la IA).

export function InventoryDashboard() {
  const { appMacros, appAreas, doc } = useInventoryData()
  const macros = doc?.macros?.length ? doc.macros : appMacros
  const areas = doc?.areas?.length ? doc.areas : appAreas

  const { subs, hojas, G, porArea, porMacro, conf, F } = useMemo(() => {
    const subs = allSubs(macros)
    const hojas = leafAreas(areas, macros)
    return {
      subs, hojas,
      G: globalStats(macros, areas),
      porArea: countBy(subs, 'area'),
      porMacro: countBy(subs, 'macro'),
      conf: subs.filter((s) => s.origen === 'confirmado').length,
      F: findings(macros, areas),
    }
  }, [macros, areas])

  if (!subs.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
        <Map size={28} className="mx-auto text-white/20 mb-3" />
        <h3 className="text-base font-semibold text-white">Aún no hay inventario levantado</h3>
        <p className="text-sm text-white/50 mt-1 max-w-md mx-auto">Abre el <b className="text-white/70">Mapa de Procesos</b> y usa el botón <b className="text-white/70">Inventario de Procesos IA</b> para generarlo. El dashboard aparecerá aquí en cuanto captures el primer bloque.</p>
      </div>
    )
  }

  const areasConCarga = new Set(subs.map((s) => s.area).filter(Boolean)).size
  const objOk = subs.filter((s) => (s.objetivo || '').trim().length >= 15).length
  const maxArea = Math.max(1, ...porArea.map((x) => x.value))
  const maxMacro = Math.max(1, ...porMacro.map((x) => x.value))

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi label="Subprocesos" value={subs.length} sub="el trabajo real" accent />
        <Kpi label="Procesos" value={G.P} sub="agrupaciones" />
        <Kpi label="Áreas con carga" value={`${areasConCarga}/${hojas.length}`} sub={`${Math.max(0, hojas.length - areasConCarga)} sin trabajo`} />
        <Kpi label="Macroprocesos" value={`${macros.filter((m) => m.procesos.length).length}/${G.M}`} sub="cubiertos" />
        <Kpi label="Confirmado" value={`${subs.length ? Math.round(conf / subs.length * 100) : 0}%`} sub={`${subs.length - conf} por validar`} />
        <Kpi label="Con objetivo" value={`${subs.length ? Math.round(objOk / subs.length * 100) : 0}%`} sub={`${subs.length - objOk} sin redactar`} />
      </div>

      {/* Carga por área */}
      <Card title="Carga de trabajo por área" sub="Subprocesos asignados a cada área hoja. Barras largas: revisar capacidad; cortas: fusión o trabajo no levantado.">
        <div className="space-y-2">
          {porArea.map((d) => (
            <BarRow key={d.label} label={d.label} value={d.value} max={maxArea} color="#06b6d4" />
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Subprocesos por macroproceso" sub="Color por franja del mapa Nivel 0.">
          <div className="space-y-2">
            {porMacro.map((d) => {
              const m = macros.find((x) => x.nombre === d.label)
              return <BarRow key={d.label} label={d.label} value={d.value} max={maxMacro} color={m ? TIPO_COLOR[m.tipo] : '#3987e5'} />
            })}
          </div>
        </Card>
        <Card title="Estado del levantamiento" sub="Confirmado con el cliente frente a deducido por la IA.">
          <div className="flex h-6 rounded-full overflow-hidden border border-white/10 mt-2">
            {conf > 0 && <div style={{ width: `${conf / subs.length * 100}%`, background: '#16a34a' }} title={`Confirmado: ${conf}`} />}
            {subs.length - conf > 0 && <div style={{ width: `${(subs.length - conf) / subs.length * 100}%`, background: '#f59e0b' }} title={`Deducido: ${subs.length - conf}`} />}
          </div>
          <div className="flex gap-4 mt-3 text-[12px]">
            <span className="inline-flex items-center gap-1.5 text-white/60"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#16a34a' }} /> Confirmado ({conf})</span>
            <span className="inline-flex items-center gap-1.5 text-white/60"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} /> Deducido ({subs.length - conf})</span>
          </div>
        </Card>
      </div>

      {/* Hallazgos */}
      <Card title="Hallazgos automáticos" sub="Cruces que solo aparecen con el inventario anclado al área. Material directo para el informe.">
        <div className="space-y-2">
          {F.map((f, i) => <FindingRow key={i} lvl={f.lvl} text={f.t} />)}
        </div>
      </Card>
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

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 shrink-0 text-[12px] text-white/60 truncate text-right">{label}</span>
      <div className="flex-1 h-5 rounded-md bg-white/5 overflow-hidden">
        <div className="h-full rounded-md flex items-center justify-end px-2" style={{ width: `${Math.max(6, value / max * 100)}%`, background: color }}>
          <span className="text-[10px] font-bold text-white/90">{value}</span>
        </div>
      </div>
    </div>
  )
}

const F_ICON: Record<FindingLevel, { icon: typeof Info; color: string }> = {
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
