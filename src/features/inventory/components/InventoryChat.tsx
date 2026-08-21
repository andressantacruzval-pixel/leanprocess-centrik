import { useEffect, useMemo, useRef, useState } from 'react'
import { Zap, Target, Send, ArrowLeft, BarChart3, RotateCcw, Loader2, Sparkles, Layers, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { streamAiProxy, type AiMessage } from '@/lib/aiClient'
import { useInventoryStore } from '@/stores/inventoryStore'
import type { InvDoc, InvMetodo } from '../types'
import { globalStats } from '../inventoryStats'
import { buildInventoryPrompt } from '../inventoryPrompt'
import { InventoryTree } from './InventoryTree'

// Paso 2 — CHAT EMBEBIDO. La IA corre dentro de la app (streamAiProxy) siguiendo
// la metodología del inventario. Interactúas por chat: en Big Bang confirmas y la
// IA suelta el inventario por macroproceso; en Incremental te pregunta macro por
// macro. Cada vez que la IA emite un bloque, se fusiona solo y aparecen las
// tarjetas. No hay IA externa, ni prompts que copiar, ni JSON que pegar.

interface Props {
  companyId: string
  doc: InvDoc
  onBack: () => void
  onClose: () => void
}

interface Msg { role: 'user' | 'assistant'; content: string }

export function InventoryChat({ companyId, doc, onBack, onClose }: Props) {
  const setMetodo = useInventoryStore((s) => s.setMetodo)
  const mergeText = useInventoryStore((s) => s.mergeText)
  const reset = useInventoryStore((s) => s.reset)
  const navigate = useNavigate()

  const [started, setStarted] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const metodo = doc.proyecto.metodo
  const G = globalStats(doc.macros, doc.areas)

  // Prompt de sistema = metodología completa con el mapa y las áreas reales.
  const systemPrompt = useMemo(
    () => buildInventoryPrompt(doc.proyecto, doc.macros, doc.areas, { modo: 'todos', focoIndex: 0 }),
    [doc.proyecto, doc.macros, doc.areas]
  )

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streaming])

  const runTurn = async (history: Msg[]) => {
    setBusy(true); setError('')
    let acc = ''
    try {
      const gen = streamAiProxy(history as AiMessage[], {
        systemPrompt, feature: 'inventory', companyId, temperature: 0.4, maxOutputTokens: 4096,
      })
      for await (const chunk of gen) { acc += chunk; setStreaming(acc) }
      setStreaming('')
      setMessages([...history, { role: 'assistant', content: acc }])
      // Fusiona en silencio cualquier bloque JSON que la IA haya emitido.
      if (acc) mergeText(companyId, acc)
    } catch (e) {
      setStreaming('')
      const m = e instanceof Error ? e.message : 'Error de IA'
      setError(m === 'INSUFFICIENT_CREDITS' ? 'Sin tokens de IA suficientes. Recarga para continuar.' : m)
    } finally {
      setBusy(false)
    }
  }

  const start = async () => {
    setStarted(true)
    const first: Msg = { role: 'user', content: 'Empecemos el levantamiento del inventario. Sigue tu protocolo.' }
    setMessages([first])
    await runTurn([first])
  }

  const send = async (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    setInput('')
    const next = [...messages, { role: 'user' as const, content: t }]
    setMessages(next)
    await runTurn(next)
  }

  const restart = () => {
    if (busy) return
    if (!confirm('¿Reiniciar? Se borra el chat y lo levantado; el mapa y las áreas se conservan.')) return
    reset(companyId); setMessages([]); setStreaming(''); setError(''); setStarted(false)
  }

  const methodCards: { id: InvMetodo; icon: typeof Zap; title: string; desc: string }[] = [
    { id: 'bigbang', icon: Zap, title: 'Big Bang', desc: 'La IA deduce todo el inventario; tú confirmas y lo suelta por macroproceso.' },
    { id: 'incremental', icon: Target, title: 'Incremental', desc: 'La IA te pregunta macro por macro y tú vas confirmando.' },
  ]

  return (
    <div className="space-y-4">
      <header>
        <div className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 mb-1">Paso 2 · Chat con IA</div>
        <h2 className="text-2xl font-bold text-white">Levanta el inventario conversando</h2>
        <p className="text-sm text-white/50 mt-1">Todo ocurre aquí dentro. Conforme confirmas, las tarjetas se generan solas a la derecha.</p>
      </header>

      {/* Selección de método (antes de empezar) */}
      {!started && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {methodCards.map((c) => {
            const on = metodo === c.id
            return (
              <button key={c.id} onClick={() => setMetodo(companyId, c.id)}
                className={`text-left rounded-2xl border p-4 transition-all ${on ? 'border-cyan-500/50 bg-cyan-500/[0.06] shadow-lg shadow-cyan-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
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
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chat */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 flex flex-col" style={{ height: '62vh' }}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {!started && (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 grid place-items-center mb-3 shadow-lg shadow-cyan-500/30"><Sparkles size={22} className="text-white" /></div>
                <h3 className="text-base font-semibold text-white">Listo para empezar</h3>
                <p className="text-sm text-white/50 mt-1 max-w-sm">La IA ya tiene tu mapa, tus áreas y el contexto de la empresa. Pulsa empezar y sigue la conversación.</p>
                <button onClick={start} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold shadow-lg shadow-cyan-500/30">
                  <Sparkles size={15} /> Empezar levantamiento
                </button>
              </div>
            )}
            {messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)}
            {streaming && <Bubble role="assistant" content={streaming} streaming />}
            {busy && !streaming && <div className="flex items-center gap-2 text-[12px] text-white/40 pl-1"><Loader2 size={13} className="animate-spin" /> La IA está pensando…</div>}
            {error && <div className="text-[12px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
          </div>

          {started && (
            <div className="shrink-0 border-t border-white/10 p-3">
              <div className="flex gap-2 mb-2 flex-wrap">
                {['Sí, confirmo', 'Sigue ▸', 'Reescribe el último bloque en forma nominal'].map((q) => (
                  <button key={q} onClick={() => send(q)} disabled={busy} className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white/90 hover:border-cyan-500/40 disabled:opacity-40">{q}</button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
                  placeholder="Escribe tu respuesta… (ej. «1,3,5,8» o «confirmo»)"
                  rows={1}
                  className="flex-1 resize-none max-h-28 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
                <button onClick={() => send(input)} disabled={busy || !input.trim()} className="shrink-0 p-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30 disabled:opacity-40"><Send size={16} /></button>
              </div>
            </div>
          )}
        </div>

        {/* Panel derecho: avance + tarjetas */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h4 className="text-[11px] uppercase tracking-wide text-white/50 mb-2">Avance</h4>
            <div className="flex items-end gap-2"><span className="text-3xl font-black text-cyan-400 leading-none">{G.pct}%</span><span className="text-[11px] text-white/40 mb-1">{G.done}/{G.M} macros</span></div>
            <div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all" style={{ width: `${G.pct}%` }} /></div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Stat label="Procesos" value={G.P} /><Stat label="Subprocesos" value={G.S} />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => navigate('/app/reports?tab=inventario')} className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-medium hover:bg-cyan-500/15"><BarChart3 size={13} /> Reporte</button>
              <button onClick={restart} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-white/10 text-white/40 text-[11px] hover:text-red-300 disabled:opacity-40"><RotateCcw size={13} /> Reiniciar</button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <h4 className="text-[11px] uppercase tracking-wide text-white/50 mb-2 flex items-center gap-1.5"><Layers size={12} /> Inventario en vivo</h4>
            <div className="max-h-[38vh] overflow-y-auto pr-1"><InventoryTree macros={doc.macros} /></div>
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

// Renderiza una burbuja; oculta los bloques de código JSON y los reemplaza por un
// chip, para que el chat se lea limpio (el JSON ya se convirtió en tarjetas).
function Bubble({ role, content, streaming }: { role: 'user' | 'assistant'; content: string; streaming?: boolean }) {
  const user = role === 'user'
  const parts = splitBlocks(content)
  return (
    <div className={`flex gap-2.5 ${user ? 'flex-row-reverse' : ''}`}>
      <div className={`shrink-0 w-7 h-7 rounded-lg grid place-items-center ${user ? 'bg-white/10' : 'bg-gradient-to-br from-cyan-500 to-blue-600'}`}>
        {user ? <User size={14} className="text-white/70" /> : <Sparkles size={14} className="text-white" />}
      </div>
      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${user ? 'bg-cyan-500/15 text-white/90 border border-cyan-500/20' : 'bg-white/5 text-white/80 border border-white/10'}`}>
        {parts.map((p, i) => p.code
          ? <span key={i} className="inline-flex items-center gap-1.5 my-1 text-[11px] px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">▣ bloque de inventario aplicado</span>
          : <span key={i}>{p.text}</span>)}
        {streaming && <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-cyan-400 animate-pulse align-middle" />}
      </div>
    </div>
  )
}

function splitBlocks(content: string): { text?: string; code?: boolean }[] {
  const out: { text?: string; code?: boolean }[] = []
  const re = /```[\s\S]*?```/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(content))) {
    if (m.index > last) out.push({ text: content.slice(last, m.index).trim() })
    out.push({ code: true })
    last = m.index + m[0].length
  }
  const tail = content.slice(last).trim()
  if (tail) out.push({ text: tail })
  return out.filter((p) => p.code || (p.text && p.text.length))
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
      <div className="text-lg font-bold text-white leading-none tabular-nums">{value}</div>
      <div className="text-[10px] text-white/40 mt-1">{label}</div>
    </div>
  )
}
