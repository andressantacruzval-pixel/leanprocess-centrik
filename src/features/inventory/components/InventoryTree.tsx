import { useState } from 'react'
import { ChevronDown, ChevronRight, Layers } from 'lucide-react'
import type { InvMacro } from '../types'
import { TIPO_COLOR } from '../types'
import { stats } from '../inventoryStats'

// Tarjetas del inventario: macroproceso → proceso → subproceso. Cada macro es una
// tarjeta plegable con su % de avance; los subprocesos muestran su área, objetivo
// y origen (verde = confirmado, ámbar = deducido por la IA).

interface Props {
  macros: InvMacro[]
}

export function InventoryTree({ macros }: Props) {
  const conCarga = macros.filter((m) => m.procesos.length)
  if (!conCarga.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
        <Layers size={26} className="mx-auto text-white/20 mb-2" />
        <p className="text-sm text-white/50">Aún no hay procesos levantados.</p>
        <p className="text-xs text-white/30 mt-1">Pega la respuesta de la IA arriba y las tarjetas se irán generando aquí.</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {macros.map((m, i) => (m.procesos.length ? <MacroCard key={m.nombre + i} macro={m} defaultOpen={i === 0 || conCarga.length <= 3} /> : null))}
    </div>
  )
}

function MacroCard({ macro, defaultOpen }: { macro: InvMacro; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const s = stats(macro)
  const color = TIPO_COLOR[macro.tipo]
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        {open ? <ChevronDown size={16} className="text-white/40 shrink-0" /> : <ChevronRight size={16} className="text-white/40 shrink-0" />}
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-white truncate">{macro.nombre}</span>
          <span className="block text-[11px] text-white/40">{macro.tipo} · {s.P} proceso(s) · {s.S} subproceso(s)</span>
        </span>
        <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color }}>{s.pct}%</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {macro.procesos.map((p, pi) => (
            <div key={p.nombre + pi} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="text-[13px] font-medium text-cyan-300 mb-2">{p.nombre}</div>
              <div className="space-y-1.5">
                {(p.subprocesos || []).map((sub, si) => (
                  <div key={sub.nombre + si} className="flex items-start gap-2 rounded-lg px-2.5 py-2 bg-white/[0.03] border border-white/5">
                    <span
                      title={sub.origen === 'confirmado' ? 'Confirmado con el cliente' : 'Deducido por la IA · pendiente de validar'}
                      className="mt-1 w-2 h-2 rounded-full shrink-0"
                      style={{ background: sub.origen === 'confirmado' ? '#16a34a' : '#f59e0b' }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] text-white/85 leading-snug">{sub.nombre}</div>
                      {sub.objetivo && <div className="text-[11px] text-white/40 mt-0.5 leading-snug">{sub.objetivo}</div>}
                    </div>
                    {sub.area && <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{sub.area}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
