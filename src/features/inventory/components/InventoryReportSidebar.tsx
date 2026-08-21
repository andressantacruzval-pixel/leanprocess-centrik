import { X } from 'lucide-react'
import type { InvMacro, InvTipo } from '../types'
import { TIPO_COLOR } from '../types'
import type { RepFilters } from '../inventoryReportData'

// Barra lateral del reporte de inventario: navegación por franja/macroproceso
// y filtros de caracterización (crítico, efectivo, nivel, gerencia, área).

const FRANJAS: InvTipo[] = ['Productivo', 'Apoyo', 'Estratégico']

interface Props {
  macros: InvMacro[]
  hojas: string[]
  niveles: string[]
  gerencias: string[]
  f: RepFilters
  set: <K extends keyof RepFilters>(k: K, v: string) => void
  clear: () => void
  shown: number
  total: number
}

export function InventoryReportSidebar({ macros, hojas, niveles, gerencias, f, set, clear, shown, total }: Props) {
  const hasF = Object.values(f).some(Boolean)
  return (
    <aside className="lg:w-64 shrink-0 lg:sticky lg:top-3 self-start space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Navegación</span>
          {hasF && <button onClick={clear} className="inline-flex items-center gap-1 text-[10px] text-cyan-300 hover:text-cyan-200"><X size={11} /> Limpiar</button>}
        </div>
        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {FRANJAS.map((tipo) => {
            const ms = macros.filter((m) => m.tipo === tipo)
            if (!ms.length) return null
            return (
              <div key={tipo}>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: TIPO_COLOR[tipo] }}>
                  <i className="w-1.5 h-1.5 rounded-full" style={{ background: TIPO_COLOR[tipo] }} /> {tipo}s
                </div>
                <div className="space-y-0.5">
                  {ms.map((m) => (
                    <button key={m.nombre} onClick={() => set('macro', f.macro === m.nombre ? '' : m.nombre)}
                      className={`w-full text-left text-[12px] rounded-md px-2 py-1 truncate transition-colors ${f.macro === m.nombre ? 'bg-cyan-500/15 text-cyan-200' : 'text-white/60 hover:bg-white/5 hover:text-white/90'}`}>
                      {m.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Filtros de caracterización</span>
        <Sel label="Área" value={f.area} onChange={(v) => set('area', v)} options={hojas} />
        <Sel label="Estado" value={f.origen} onChange={(v) => set('origen', v)} options={[{ v: 'confirmado', l: 'Confirmado' }, { v: 'deducido', l: 'Deducido' }]} />
        <Sel label="Proceso crítico" value={f.critico} onChange={(v) => set('critico', v)} options={[{ v: 'si', l: 'Sí' }, { v: 'no', l: 'No' }]} />
        <Sel label="Mov. de efectivo" value={f.efectivo} onChange={(v) => set('efectivo', v)} options={[{ v: 'si', l: 'Sí' }, { v: 'no', l: 'No' }]} />
        <Sel label="Nivel de ejecución" value={f.nivel} onChange={(v) => set('nivel', v)} options={niveles} />
        <Sel label="Gerencia" value={f.gerencia} onChange={(v) => set('gerencia', v)} options={gerencias} />
        <div className="pt-1 text-[11px] text-white/40">{shown}{shown !== total ? ` de ${total}` : ''} subprocesos</div>
      </div>
    </aside>
  )
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: (string | { v: string; l: string })[] }) {
  const opts = options.map((o) => (typeof o === 'string' ? { v: o, l: o } : o))
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-white/35 mb-0.5">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-white/[0.03] border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] text-white/80 outline-none cursor-pointer focus:ring-2 focus:ring-cyan-500/50">
        <option value="">Todos</option>
        {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  )
}
