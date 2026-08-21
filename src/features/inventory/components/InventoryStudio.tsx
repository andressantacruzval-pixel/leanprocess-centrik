import { useState } from 'react'
import { Zap, Target, ArrowLeft, BarChart3, RotateCcw, Loader2, Sparkles, CheckCheck, AlertTriangle, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useInventoryStore } from '@/stores/inventoryStore'
import type { InvDoc, InvTipo } from '../types'
import { TIPO_COLOR } from '../types'
import { leafAreas } from '../inventoryUtils'
import { stats, globalStats } from '../inventoryStats'
import { generateMacro } from '../inventoryAi'
import { volcarAceptadosAlMapa, pendientesDeVolcar } from '../volcarAlMapa'
import { InventoryMacroEditor } from './InventoryMacroEditor'
import { InventoryChat } from './InventoryChat'

// Paso 2 — Estudio del inventario. Mapa de macroprocesos (gris = sin levantar,
// color = levantado). Eliges uno y decides Big Bang (auto) o Incremental (chat).
// Todo es editable en vivo (agregar/editar/eliminar/aceptar).

const FRANJAS: InvTipo[] = ['Productivo', 'Apoyo', 'Estratégico']

interface Props { companyId: string; doc: InvDoc; onBack: () => void; onClose: () => void }

export function InventoryStudio({ companyId, doc, onBack, onClose }: Props) {
  const mergeText = useInventoryStore((s) => s.mergeText)
  const acceptMacro = useInventoryStore((s) => s.acceptMacro)
  const reset = useInventoryStore((s) => s.reset)
  const navigate = useNavigate()
  const [sel, setSel] = useState<number | null>(null)
  const [mode, setMode] = useState<'none' | 'chat'>('none')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [volcadoMsg, setVolcadoMsg] = useState('')

  const areas = leafAreas(doc.areas, doc.macros)
  const G = globalStats(doc.macros, doc.areas)
  const selMacro = sel != null ? doc.macros[sel] : null
  const porVolcar = pendientesDeVolcar(companyId)
  const [volcando, setVolcando] = useState(false)

  const volcar = async () => {
    if (volcando) return
    setVolcando(true); setVolcadoMsg('')
    try {
      const r = await volcarAceptadosAlMapa(companyId)
      const base = (r.procesos || r.subprocesos)
        ? `Volcado al mapa: +${r.procesos} proceso(s) y +${r.subprocesos} subproceso(s) ✓`
        : 'No había nada nuevo aceptado por volcar.'
      setVolcadoMsg(r.failed ? `${base} · ${r.failed} no se pudieron guardar (reintenta o revisa el límite de plan).` : base)
    } catch {
      setVolcadoMsg('No se pudo volcar al mapa. Reintenta.')
    } finally {
      setVolcando(false)
      setTimeout(() => setVolcadoMsg(''), 6000)
    }
  }

  const runBigBang = async (mi: number) => {
    setBusy(true); setErr(''); setMode('none')
    try {
      const P = useInventoryStore.getState().getDoc(companyId)
      const json = await generateMacro(P.proyecto, P.macros, P.areas, mi, companyId)
      const r = mergeText(companyId, json)
      if (!r.ok) setErr(r.error)
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Error de IA'
      setErr(m === 'INSUFFICIENT_CREDITS' ? 'Sin tokens de IA suficientes.' : m)
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <header>
        <div className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 mb-1">Paso 2 · Estudio del inventario</div>
        <h2 className="text-2xl font-bold text-white">Elige un macroproceso y levántalo</h2>
        <p className="text-sm text-white/50 mt-1">Los grises aún no tienen procesos; los de color ya están levantados. Clic para trabajar en uno.</p>
        {/* Conteo global de lo levantado */}
        <div className="flex flex-wrap items-center gap-2.5 mt-3">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 px-3 py-1.5 text-[13px] text-cyan-200">
            <span className="text-lg font-bold text-cyan-300 leading-none">{G.P}</span> procesos
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/25 px-3 py-1.5 text-[13px] text-blue-200">
            <span className="text-lg font-bold text-blue-300 leading-none">{G.S}</span> subprocesos
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-[13px] text-white/60">
            <span className="text-lg font-bold text-white/80 leading-none">{G.M}</span> macroprocesos
          </span>
          {G.ded > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 text-[13px] text-amber-200">
              <span className="text-lg font-bold text-amber-300 leading-none">{G.ded}</span> por validar
            </span>
          )}
        </div>
      </header>

      {/* Mapa de macroprocesos */}
      <div className="space-y-3">
        {FRANJAS.map((tipo) => {
          const items = doc.macros.map((m, i) => ({ m, i })).filter((x) => x.m.tipo === tipo)
          if (!items.length) return null
          return (
            <div key={tipo}>
              <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: TIPO_COLOR[tipo] }}>
                <i className="w-2 h-2 rounded-full" style={{ background: TIPO_COLOR[tipo] }} /> {tipo}s
              </div>
              <div className="flex flex-wrap gap-2">
                {items.map(({ m, i }) => {
                  const levantado = m.procesos.length > 0
                  const st = stats(m)
                  const on = sel === i
                  return (
                    <button key={i} onClick={() => { setSel(i); setMode('none'); setErr('') }}
                      className={`text-left rounded-xl border px-3 py-2 transition-all ${on ? 'ring-2 ring-cyan-500/60' : ''} ${levantado ? 'bg-white/5' : 'bg-white/[0.02] border-dashed'}`}
                      style={{ borderColor: on ? undefined : (levantado ? TIPO_COLOR[tipo] + '66' : 'rgba(255,255,255,0.08)') }}>
                      <div className="flex items-center gap-2">
                        <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: levantado ? TIPO_COLOR[tipo] : 'rgba(255,255,255,0.15)' }} />
                        <span className={`text-[13px] font-medium ${levantado ? 'text-white' : 'text-white/35'}`}>{m.nombre}</span>
                      </div>
                      <div className="text-[10px] mt-0.5 pl-4.5 ml-0.5" style={{ color: levantado ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.25)' }}>
                        {levantado ? `${st.S} subproc. · ${st.ded} por validar` : 'sin levantar'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Panel del macroproceso seleccionado */}
      {selMacro ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: TIPO_COLOR[selMacro.tipo] }} />
            <h3 className="text-base font-bold text-white flex-1 min-w-0">{selMacro.nombre}</h3>
            {stats(selMacro).ded > 0 && (
              <button onClick={() => acceptMacro(companyId, sel!)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[12px] hover:bg-emerald-500/15"><CheckCheck size={13} /> Aceptar todo</button>
            )}
          </div>

          {/* Métodos */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => runBigBang(sel!)} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-[13px] font-semibold shadow-lg shadow-cyan-500/30 disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />} {selMacro.procesos.length ? 'Regenerar con Big Bang' : 'Big Bang (auto)'}
            </button>
            <button onClick={() => setMode(mode === 'chat' ? 'none' : 'chat')} disabled={busy} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-[13px] font-semibold transition-all disabled:opacity-50 ${mode === 'chat' ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' : 'border-white/15 text-white/70 hover:bg-white/5'}`}>
              <Target size={15} /> Incremental (chat)
            </button>
            {busy && <span className="text-[12px] text-cyan-300 inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Generando «{selMacro.nombre}»…</span>}
            {err && <span className="text-[12px] text-red-300 inline-flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</span>}
          </div>

          {/* Chat incremental acotado a este macro */}
          {mode === 'chat' && <InventoryChat companyId={companyId} doc={doc} focoIndex={sel!} />}

          {/* Editor en vivo del macro */}
          <InventoryMacroEditor companyId={companyId} macro={selMacro} mi={sel!} areas={areas} />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <Sparkles size={24} className="mx-auto text-white/20 mb-2" />
          <p className="text-sm text-white/50">Elige un macroproceso arriba para empezar a levantarlo.</p>
        </div>
      )}

      {/* Barra inferior */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/15 text-white/70 text-sm hover:bg-white/5 disabled:opacity-40"><ArrowLeft size={15} /> Atrás</button>
        <div className="hidden sm:flex items-center gap-2 text-[12px] text-white/50">
          <span className="font-semibold text-cyan-400">{G.pct}%</span> · {G.S} subprocesos · {G.ded} por validar
        </div>
        <div className="flex-1" />
        {volcadoMsg && <span className="text-[12px] text-emerald-300">{volcadoMsg}</span>}
        <button onClick={volcar} disabled={busy || volcando || !porVolcar} title={porVolcar ? 'Crea en el mapa los procesos/subprocesos aceptados' : 'No hay subprocesos aceptados nuevos'} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[13px] hover:bg-emerald-500/15 disabled:opacity-40">{volcando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Volcar al mapa{porVolcar ? ` (${porVolcar})` : ''}</button>
        <button onClick={() => navigate('/app/reports?tab=inventario')} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[13px] hover:bg-cyan-500/15"><BarChart3 size={14} /> Reporte</button>
        <button onClick={() => { if (!busy && confirm('¿Vaciar lo levantado? El mapa y las áreas se conservan.')) { reset(companyId); setSel(null) } }} disabled={busy} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 text-white/40 text-[13px] hover:text-red-300 disabled:opacity-40"><RotateCcw size={14} /> Reiniciar</button>
        <button onClick={onClose} disabled={busy} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold shadow-lg shadow-cyan-500/30 disabled:opacity-40">Cerrar</button>
      </div>
    </div>
  )
}
