import { useState } from 'react'
import { Zap, Target, ArrowLeft, BarChart3, RotateCcw, Loader2, Sparkles, CheckCheck, AlertTriangle, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useInventoryStore } from '@/stores/inventoryStore'
import type { InvDoc, InvTipo } from '../types'
import { TIPO_COLOR } from '../types'
import { leafAreas } from '../inventoryUtils'
import { stats, globalStats } from '../inventoryStats'
import { generateMacro } from '../inventoryAi'
import { volcarAceptadosAlMapa, volcarMacroAlMapa, pendientesDeVolcar } from '../volcarAlMapa'
import { InventoryMacroEditor } from './InventoryMacroEditor'
import { InventoryChat } from './InventoryChat'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'

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

  const doVolcar = async (fn: () => Promise<{ procesos: number; subprocesos: number; failed: number }>) => {
    if (volcando) return
    setVolcando(true); setVolcadoMsg('')
    try {
      const r = await fn()
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
  const volcarTodo = () => doVolcar(() => volcarAceptadosAlMapa(companyId))
  const volcarGrupo = (mi: number) => doVolcar(() => volcarMacroAlMapa(companyId, mi))

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
        <div className="text-[11px] font-mono uppercase tracking-widest text-primary-600 mb-1">Paso 2 · Estudio del inventario</div>
        <h2 className="text-2xl font-bold text-gray-900">Elige un macroproceso y levántalo</h2>
        <p className="text-sm text-gray-500 mt-1">Los grises aún no tienen procesos; los de color ya están levantados. Clic para trabajar en uno.</p>
        <p className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-amber-700">
          <Zap size={12} className="fill-amber-700" /> Levantar cada macroproceso con IA consume <TokenCostBadge operationKey="inventory" /> tokens.
        </p>
        {/* Conteo global de lo levantado */}
        <div className="flex flex-wrap items-center gap-2.5 mt-3">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary-50 border border-primary-200 px-3 py-1.5 text-[13px] text-primary-700">
            <span className="text-lg font-bold text-primary-700 leading-none">{G.P}</span> procesos
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-[13px] text-blue-700">
            <span className="text-lg font-bold text-blue-700 leading-none">{G.S}</span> subprocesos
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 border border-gray-200 px-3 py-1.5 text-[13px] text-gray-600">
            <span className="text-lg font-bold text-gray-800 leading-none">{G.M}</span> macroprocesos
          </span>
          {G.ded > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-[13px] text-amber-700">
              <span className="text-lg font-bold text-amber-700 leading-none">{G.ded}</span> por validar
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
                      className={`text-left rounded-lg border px-3 py-2 transition-all ${on ? 'ring-2 ring-primary-500' : ''} ${levantado ? 'bg-gray-50' : 'bg-gray-50 border-dashed'}`}
                      style={{ borderColor: on ? undefined : (levantado ? TIPO_COLOR[tipo] + '66' : 'rgba(255,255,255,0.08)') }}>
                      <div className="flex items-center gap-2">
                        <i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: levantado ? TIPO_COLOR[tipo] : 'rgba(255,255,255,0.15)' }} />
                        <span className={`text-[13px] font-medium ${levantado ? 'text-gray-900' : 'text-gray-400'}`}>{m.nombre}</span>
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
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: TIPO_COLOR[selMacro.tipo] }} />
            <h3 className="text-base font-bold text-gray-900 flex-1 min-w-0">{selMacro.nombre}</h3>
            {stats(selMacro).ded > 0 && (
              <button onClick={() => acceptMacro(companyId, sel!)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] hover:bg-emerald-50"><CheckCheck size={13} /> Aceptar todo</button>
            )}
            {(() => { const n = pendientesDeVolcar(companyId, sel!); return n > 0 ? (
              <button onClick={() => volcarGrupo(sel!)} disabled={volcando} title="Carga al mapa solo los subprocesos aceptados de ESTE macroproceso" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 border border-primary-300 text-primary-700 text-[12px] hover:bg-primary-50 disabled:opacity-40">{volcando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Volcar al mapa ({n})</button>
            ) : null })()}
          </div>

          {/* Métodos */}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => runBigBang(sel!)} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] font-semibold shadow-lg disabled:opacity-50 bg-primary-500">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />} {selMacro.procesos.length ? 'Regenerar con Big Bang' : 'Big Bang (auto)'}
              <span className="text-gray-800"><TokenCostBadge operationKey="inventory" className="text-gray-800" /></span>
            </button>
            <button onClick={() => setMode(mode === 'chat' ? 'none' : 'chat')} disabled={busy} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-[13px] font-semibold transition-all disabled:opacity-50 ${mode === 'chat' ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              <Target size={15} /> Incremental (chat)
              <TokenCostBadge operationKey="inventory" />
            </button>
            {busy && <span className="text-[12px] text-primary-700 inline-flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Generando «{selMacro.nombre}»…</span>}
            {err && <span className="text-[12px] text-red-700 inline-flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</span>}
          </div>

          {/* Qué hace cada modo (para el usuario final) */}
          <p className="text-[11.5px] text-gray-500 leading-snug">
            <b className="text-gray-700">Big Bang (auto):</b> la IA genera de una vez todos los procesos y subprocesos de este macroproceso a partir de la información de tu empresa. Rápido para arrancar; luego ajustas.
            {'  ·  '}
            <b className="text-gray-700">Incremental (chat):</b> los construyes paso a paso conversando con la IA, guiando y validando cada parte. Ideal para casos complejos o cuando quieres control fino.
          </p>

          {/* Chat incremental acotado a este macro */}
          {mode === 'chat' && <InventoryChat companyId={companyId} doc={doc} focoIndex={sel!} />}

          {/* Editor en vivo del macro */}
          <InventoryMacroEditor companyId={companyId} macro={selMacro} mi={sel!} areas={areas} />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
          <Sparkles size={24} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">Elige un macroproceso arriba para empezar a levantarlo.</p>
        </div>
      )}

      {/* Barra inferior */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-40"><ArrowLeft size={15} /> Atrás</button>
        <div className="hidden sm:flex items-center gap-2 text-[12px] text-gray-500">
          <span className="font-semibold text-primary-600">{G.pct}%</span> · {G.S} subprocesos · {G.ded} por validar
        </div>
        <div className="flex-1" />
        {volcadoMsg && <span className="text-[12px] text-emerald-700">{volcadoMsg}</span>}
        <button onClick={volcarTodo} disabled={busy || volcando || !porVolcar} title={porVolcar ? 'Carga al mapa TODOS los subprocesos aceptados de todos los macroprocesos' : 'No hay subprocesos aceptados nuevos'} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] hover:bg-emerald-50 disabled:opacity-40">{volcando ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Volcar todo lo aceptado{porVolcar ? ` (${porVolcar})` : ''}</button>
        <button onClick={() => navigate('/app/reports?tab=inventario')} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary-50 border border-primary-200 text-primary-700 text-[13px] hover:bg-primary-50"><BarChart3 size={14} /> Reporte</button>
        <button onClick={() => { if (!busy && confirm('¿Vaciar lo levantado? El mapa y las áreas se conservan.')) { reset(companyId); setSel(null) } }} disabled={busy} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 text-gray-500 text-[13px] hover:text-red-700 disabled:opacity-40"><RotateCcw size={14} /> Reiniciar</button>
        <button onClick={onClose} disabled={busy} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold shadow-lg disabled:opacity-40 bg-primary-500">Cerrar</button>
      </div>
    </div>
  )
}
