import { useState } from 'react'
import { Plus, Download, RotateCcw, ArrowLeft, Copy, Check, BarChart3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useInventoryStore } from '@/stores/inventoryStore'
import type { InvDoc, InvFile } from '../types'
import { globalStats } from '../inventoryStats'
import { buildInventoryPrompt } from '../inventoryPrompt'
import { InventoryTree } from './InventoryTree'

// Paso 3 — Levantamiento: pega el JSON que devolvió la IA; se fusiona (nunca
// reemplaza) y las tarjetas se generan/actualizan al instante.

interface Props {
  companyId: string
  doc: InvDoc
  onBack: () => void
  onClose: () => void
}

export function WizardCapture({ companyId, doc, onBack, onClose }: Props) {
  const mergeText = useInventoryStore((s) => s.mergeText)
  const reset = useInventoryStore((s) => s.reset)
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const G = globalStats(doc.macros, doc.areas)

  const doMerge = () => {
    const r = mergeText(companyId, text)
    if (r.ok) {
      const R = r.report
      const parts: string[] = []
      if (R.aNew) parts.push(`+${R.aNew} área(s)`)
      if (R.pNew) parts.push(`+${R.pNew} proceso(s)`)
      if (R.sNew) parts.push(`+${R.sNew} subproceso(s)`)
      if (R.sUpd) parts.push(`${R.sUpd} actualizado(s)`)
      setMsg({ ok: true, t: parts.length ? 'Fusionado: ' + parts.join(' · ') : 'Sin cambios nuevos.' })
      setText('')
    } else setMsg({ ok: false, t: r.error })
  }

  const nextPendingIdx = () => {
    const order = ['Productivo', 'Apoyo', 'Estratégico']
    const sorted = doc.macros.map((m, i) => ({ m, i })).sort((a, b) => order.indexOf(a.m.tipo) - order.indexOf(b.m.tipo) || a.i - b.i)
    const empty = sorted.find((x) => !x.m.procesos.length)
    return empty ? empty.i : -1
  }

  const copyNext = () => {
    const i = nextPendingIdx()
    if (i < 0) { setMsg({ ok: true, t: 'No queda ningún macroproceso sin levantar ✓' }); return }
    const p = buildInventoryPrompt(doc.proyecto, doc.macros, doc.areas, { modo: 'foco', focoIndex: i })
    navigator.clipboard.writeText(p).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); setMsg({ ok: true, t: `Prompt de «${doc.macros[i].nombre}» copiado ✓` }) }).catch(() => {})
  }

  const exportJson = () => {
    const file: InvFile = { tipo: 'ai-process-manager-inventario', version: 1, ...doc }
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Inventario-${(doc.proyecto.cliente || 'empresa').replace(/[^\w-]+/g, '-')}-v${doc.proyecto.ver}.json`
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500)
  }

  return (
    <div className="space-y-5">
      <header>
        <div className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 mb-1">Paso 3 · Levantamiento</div>
        <h2 className="text-2xl font-bold text-white">Pega la respuesta y mira crecer el inventario</h2>
        <p className="text-sm text-white/50 mt-1">Cada bloque JSON se fusiona con lo que ya tienes, nunca lo reemplaza.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Pega aquí el bloque JSON que te dio la IA. Acepta un macroproceso, varios o el inventario completo."
              className="w-full min-h-32 rounded-xl bg-[#06100a] border border-white/10 p-3 text-[12px] font-mono text-cyan-100/80 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-y" spellCheck={false} />
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button onClick={doMerge} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold shadow-lg shadow-cyan-500/30"><Plus size={15} /> Fusionar al inventario</button>
              {msg && <span className={`text-[12px] ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{msg.t}</span>}
            </div>
          </div>

          <InventoryTree macros={doc.macros} />
        </div>

        {/* Panel lateral */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h4 className="text-[11px] uppercase tracking-wide text-white/50 mb-2">Avance del inventario</h4>
            <div className="flex items-end gap-2"><span className="text-3xl font-black text-cyan-400 leading-none">{G.pct}%</span><span className="text-[11px] text-white/40 mb-1">{G.done}/{G.M} macros al 100%</span></div>
            <div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${G.pct}%` }} /></div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Stat label="Procesos" value={G.P} />
              <Stat label="Subprocesos" value={G.S} />
              <Stat label="Áreas con carga" value={`${G.conArea ? new Set(doc.macros.flatMap((m) => m.procesos.flatMap((p) => p.subprocesos.map((s) => s.area).filter(Boolean)))).size : 0}/${G.A}`} />
              <Stat label="Por validar" value={G.ded} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
            <button onClick={copyNext} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[13px] font-medium hover:bg-cyan-500/15">{copied ? <Check size={14} /> : <Copy size={14} />} Prompt del siguiente pendiente</button>
            <button onClick={() => navigate('/app/reports?tab=inventario-ia')} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/15 text-white/70 text-[13px] hover:bg-white/5"><BarChart3 size={14} /> Ver dashboard en Reportes</button>
            <button onClick={exportJson} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/15 text-white/70 text-[13px] hover:bg-white/5"><Download size={14} /> Exportar (.json)</button>
            <button onClick={() => { if (confirm('¿Vaciar los procesos levantados? El mapa y las áreas se conservan.')) reset(companyId) }} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-white/40 text-[13px] hover:bg-white/5 hover:text-red-300"><RotateCcw size={14} /> Reiniciar levantamiento</button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/15 text-white/70 text-sm hover:bg-white/5"><ArrowLeft size={15} /> Prompt</button>
        <div className="flex-1" />
        <button onClick={onClose} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold shadow-lg shadow-cyan-500/30">Cerrar</button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
      <div className="text-lg font-bold text-white leading-none tabular-nums">{value}</div>
      <div className="text-[10px] text-white/40 mt-1">{label}</div>
    </div>
  )
}
