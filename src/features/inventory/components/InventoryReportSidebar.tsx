import { X } from 'lucide-react'
import type { InvMacro, InvTipo } from '../types'
import { TIPO_COLOR } from '../types'
import { BANDERAS, type RepFilters } from '../inventoryReportData'

// Barra lateral del reporte de inventario: navegación por franja/macroproceso
// y filtros de caracterización (crítico, efectivo, nivel, gerencia, área).

const FRANJAS: InvTipo[] = ['Productivo', 'Apoyo', 'Estratégico']

interface Props {
  macros: InvMacro[]
  hojas: string[]
  niveles: string[]
  gerencias: string[]
  gerenciaLabel: string
  frecuencias: string[]
  tiposProceso: string[]
  f: RepFilters
  set: <K extends keyof RepFilters>(k: K, v: string) => void
  clear: () => void
  shown: number
  total: number
}

export function InventoryReportSidebar({ macros, hojas, niveles, gerencias, gerenciaLabel, frecuencias, tiposProceso, f, set, clear, shown, total }: Props) {
  const hasF = Object.values(f).some(Boolean)
  return (
    <aside className="lg:w-64 shrink-0 lg:sticky lg:top-3 self-start space-y-4 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Navegación</span>
          {hasF && <button onClick={clear} className="inline-flex items-center gap-1 text-[10px] text-primary-700 hover:text-primary-700"><X size={11} /> Limpiar</button>}
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
                      className={`w-full text-left text-[12px] rounded-md px-2 py-1 truncate transition-colors ${f.macro === m.nombre ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}`}>
                      {m.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Filtros de caracterización</span>
        <Sel label="Área" value={f.area} onChange={(v) => set('area', v)} options={hojas} />
        <Sel label="Estado" value={f.origen} onChange={(v) => set('origen', v)} options={[{ v: 'confirmado', l: 'Confirmado' }, { v: 'deducido', l: 'Deducido' }]} />
        <Sel label="Proceso crítico" value={f.critico} onChange={(v) => set('critico', v)} options={[{ v: 'si', l: 'Sí' }, { v: 'no', l: 'No' }]} />
        <Sel label="Mov. de efectivo" value={f.efectivo} onChange={(v) => set('efectivo', v)} options={[{ v: 'si', l: 'Sí' }, { v: 'no', l: 'No' }]} />
        <Sel label="Nivel de ejecución" value={f.nivel} onChange={(v) => set('nivel', v)} options={niveles} />
        <Sel label={gerenciaLabel} value={f.gerencia} onChange={(v) => set('gerencia', v)} options={gerencias} />
        <Sel label="Frecuencia" value={f.frecuencia} onChange={(v) => set('frecuencia', v)} options={frecuencias} />
        <Sel label="Tipo de proceso" value={f.tipoProceso} onChange={(v) => set('tipoProceso', v)} options={tiposProceso} />
        <Sel label="Bandera activa" value={f.bandera} onChange={(v) => set('bandera', v)} options={BANDERAS.map((b) => ({ v: b.key as string, l: b.label }))} />
        <div className="pt-1 text-[11px] text-gray-500">{shown}{shown !== total ? ` de ${total}` : ''} subprocesos</div>
      </div>
    </aside>
  )
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: (string | { v: string; l: string })[] }) {
  const opts = options.map((o) => (typeof o === 'string' ? { v: o, l: o } : o))
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-800 outline-none cursor-pointer focus:ring-2 focus:ring-primary-500">
        <option value="">Todos</option>
        {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  )
}
