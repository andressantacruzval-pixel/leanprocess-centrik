import { useState } from 'react'
import { Zap, Target, Sparkles, ArrowLeft, Download, RotateCcw, BarChart3, Loader2, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useInventoryStore } from '@/stores/inventoryStore'
import type { InvDoc, InvFile, InvMetodo } from '../types'
import { globalStats } from '../inventoryStats'
import { generateMacro } from '../inventoryAi'
import { InventoryTree } from './InventoryTree'

// Paso 2 — Generación embebida. La IA corre AQUÍ (Edge Function ai-proxy): se
// recorre el mapa macroproceso por macroproceso y las tarjetas se generan solas.
// No hay que copiar prompts ni pegar JSON en otra IA.

const ORDER: Record<string, number> = { Productivo: 0, Apoyo: 1, 'Estratégico': 2 }

interface Props {
  companyId: string
  doc: InvDoc
  onBack: () => void
  onClose: () => void
}

export function WizardGenerate({ companyId, doc, onBack, onClose }: Props) {
  const setMetodo = useInventoryStore((s) => s.setMetodo)
  const mergeText = useInventoryStore((s) => s.mergeText)
  const reset = useInventoryStore((s) => s.reset)
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [curr, setCurr] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)

  const metodo = doc.proyecto.metodo
  const G = globalStats(doc.macros, doc.areas)

  // Índices de macros en orden de trabajo (productivos → apoyo → estratégicos).
  const workOrder = () =>
    doc.macros.map((m, i) => ({ m, i })).sort((a, b) => (ORDER[a.m.tipo] ?? 9) - (ORDER[b.m.tipo] ?? 9) || a.i - b.i)

  const pendingIdx = () => {
    const fresh = useInventoryStore.getState().getDoc(companyId)
    return workOrder().find((x) => !(fresh.macros[x.i]?.procesos.length))?.i ?? -1
  }

  const genOne = async (idx: number): Promise<boolean> => {
    const P = useInventoryStore.getState().getDoc(companyId)
    setCurr(P.macros[idx]?.nombre ?? '')
    try {
      const json = await generateMacro(P.proyecto, P.macros, P.areas, idx, companyId)
      const r = mergeText(companyId, json)
      if (!r.ok) { setMsg({ ok: false, t: `«${P.macros[idx]?.nombre}»: ${r.error}` }); return false }
      return true
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Error de IA'
      setMsg({ ok: false, t: err === 'INSUFFICIENT_CREDITS' ? 'Sin tokens de IA suficientes. Recarga para continuar.' : err })
      return false
    }
  }

  // Big Bang: recorre TODOS los macros pendientes en secuencia.
  const genAll = async () => {
    setBusy(true); setMsg(null)
    const order = workOrder().map((x) => x.i)
    let done = 0
    for (const idx of order) {
      const fresh = useInventoryStore.getState().getDoc(companyId)
      if (fresh.macros[idx]?.procesos.length) continue // ya levantado
      const ok = await genOne(idx)
      if (!ok) break
      done++
    }
    setCurr(''); setBusy(false)
    if (done) setMsg({ ok: true, t: `Inventario generado para ${done} macroproceso(s) ✓` })
  }

  // Incremental: genera solo el siguiente macroproceso pendiente.
  const genNext = async () => {
    const idx = pendingIdx()
    if (idx < 0) { setMsg({ ok: true, t: 'No queda ningún macroproceso pendiente ✓' }); return }
    setBusy(true); setMsg(null)
    await genOne(idx)
    setCurr(''); setBusy(false)
  }

  const exportJson = () => {
    const file: InvFile = { tipo: 'ai-process-manager-inventario', version: 1, ...doc }
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Inventario-${(doc.proyecto.cliente || 'empresa').replace(/[^\w-]+/g, '-')}-v${doc.proyecto.ver}.json`
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500)
  }

  const cards: { id: InvMetodo; icon: typeof Zap; title: string; desc: string }[] = [
    { id: 'bigbang', icon: Zap, title: 'Big Bang', desc: 'Genera todo el inventario de una pasada, macroproceso por macroproceso.' },
    { id: 'incremental', icon: Target, title: 'Incremental', desc: 'Genera un macroproceso a la vez para revisar entre cada uno.' },
  ]
  const pending = doc.macros.filter((m) => !m.procesos.length).length

  return (
    <div className="space-y-5">
      <header>
        <div className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 mb-1">Paso 2 · Generación con IA</div>
        <h2 className="text-2xl font-bold text-white">La IA levanta el inventario aquí mismo</h2>
        <p className="text-sm text-white/50 mt-1">Corre dentro de la app. Las tarjetas se generan solas conforme avanza, sin copiar prompts ni pegar nada.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => {
          const on = metodo === c.id
          return (
            <button key={c.id} onClick={() => setMetodo(companyId, c.id)} disabled={busy}
              className={`text-left rounded-2xl border p-4 transition-all disabled:opacity-60 ${on ? 'border-cyan-500/50 bg-cyan-500/[0.06] shadow-lg shadow-cyan-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <c.icon size={17} className={on ? 'text-cyan-400' : 'text-white/50'} />
                <h3 className="text-[15px] font-bold text-white">{c.title}</h3>
                {on && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Elegido</span>}
              </div>
              <p className="text-[12.5px] text-white/55 leading-relaxed">{c.desc}</p>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3 flex-wrap">
            {metodo === 'bigbang' ? (
              <button onClick={genAll} disabled={busy || !pending} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold shadow-lg shadow-cyan-500/30 disabled:opacity-40 disabled:shadow-none">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {busy ? 'Generando…' : (pending ? `Generar inventario (${pending} pendiente${pending > 1 ? 's' : ''})` : 'Todo generado ✓')}
              </button>
            ) : (
              <button onClick={genNext} disabled={busy || !pending} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold shadow-lg shadow-cyan-500/30 disabled:opacity-40 disabled:shadow-none">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {busy ? 'Generando…' : (pending ? 'Generar siguiente macroproceso' : 'Todo generado ✓')}
              </button>
            )}
            {busy && curr && <span className="text-[12px] text-cyan-300 inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> {curr}…</span>}
            {!busy && msg && <span className={`text-[12px] inline-flex items-center gap-1.5 ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>{!msg.ok && <AlertTriangle size={12} />}{msg.t}</span>}
          </div>

          <InventoryTree macros={doc.macros} />
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h4 className="text-[11px] uppercase tracking-wide text-white/50 mb-2">Avance del inventario</h4>
            <div className="flex items-end gap-2"><span className="text-3xl font-black text-cyan-400 leading-none">{G.pct}%</span><span className="text-[11px] text-white/40 mb-1">{G.done}/{G.M} macros</span></div>
            <div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all" style={{ width: `${G.pct}%` }} /></div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Stat label="Procesos" value={G.P} />
              <Stat label="Subprocesos" value={G.S} />
              <Stat label="Áreas hoja" value={G.A} />
              <Stat label="Por validar" value={G.ded} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
            <button onClick={() => navigate('/app/reports?tab=inventario')} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[13px] font-medium hover:bg-cyan-500/15"><BarChart3 size={14} /> Ver reporte del inventario</button>
            <button onClick={exportJson} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/15 text-white/70 text-[13px] hover:bg-white/5"><Download size={14} /> Exportar (.json)</button>
            <button onClick={() => { if (!busy && confirm('¿Vaciar lo generado? El mapa y las áreas se conservan.')) { reset(companyId); setMsg(null) } }} disabled={busy} className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-white/40 text-[13px] hover:bg-white/5 hover:text-red-300 disabled:opacity-40"><RotateCcw size={14} /> Reiniciar</button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onBack} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/15 text-white/70 text-sm hover:bg-white/5 disabled:opacity-40"><ArrowLeft size={15} /> Atrás</button>
        <div className="flex-1" />
        <button onClick={onClose} disabled={busy} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold shadow-lg shadow-cyan-500/30 disabled:opacity-40">Cerrar</button>
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
