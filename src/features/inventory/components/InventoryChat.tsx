import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, Loader2, Sparkles, User } from 'lucide-react'
import { streamAiProxy, type AiMessage } from '@/lib/aiClient'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import { useInventoryStore } from '@/stores/inventoryStore'
import type { InvDoc } from '../types'
import { buildInventoryPrompt } from '../inventoryPrompt'

// Chat embebido para el método INCREMENTAL, acotado a UN macroproceso. La IA
// pregunta (candidatos, agrupación) y tú confirmas; cada bloque que emite se
// fusiona solo y aparece en las tarjetas. Sin IA externa, sin pegar JSON.

interface Props {
  companyId: string
  doc: InvDoc
  focoIndex: number
}

interface Msg { role: 'user' | 'assistant'; content: string }

export function InventoryChat({ companyId, doc, focoIndex }: Props) {
  const mergeText = useInventoryStore((s) => s.mergeText)
  const [messages, setMessages] = useState<Msg[]>([])
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  // Prompt de sistema: metodología INCREMENTAL acotada a este macroproceso.
  const systemPrompt = useMemo(
    () => buildInventoryPrompt({ ...doc.proyecto, metodo: 'incremental' }, doc.macros, doc.areas, { modo: 'foco', focoIndex }),
    [doc.proyecto, doc.macros, doc.areas, focoIndex]
  )

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, streaming])

  const runTurn = async (history: Msg[]) => {
    setBusy(true); setError('')
    let acc = ''
    try {
      const gen = streamAiProxy(history as AiMessage[], { systemPrompt, feature: 'inventory', companyId, temperature: 0.4, maxOutputTokens: 4096 })
      for await (const chunk of gen) { acc += chunk; setStreaming(acc) }
      setStreaming('')
      setMessages([...history, { role: 'assistant', content: acc }])
      if (acc) mergeText(companyId, acc)
    } catch (e) {
      setStreaming('')
      const m = e instanceof Error ? e.message : 'Error de IA'
      setError(m === 'INSUFFICIENT_CREDITS' ? 'Sin tokens de IA suficientes.' : m)
    } finally { setBusy(false) }
  }

  // Arranca solo al montar (chat acotado al macro).
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    const first: Msg = { role: 'user', content: `Empecemos con el macroproceso «${doc.macros[focoIndex]?.nombre}». Sigue tu protocolo incremental.` }
    setMessages([first]); void runTurn([first])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return
    setInput('')
    const next = [...messages, { role: 'user' as const, content: t }]
    setMessages(next); await runTurn(next)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 flex flex-col" style={{ height: '46vh' }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)}
        {streaming && <Bubble role="assistant" content={streaming} streaming />}
        {busy && !streaming && <div className="flex items-center gap-2 text-[12px] text-gray-500 pl-1"><Loader2 size={13} className="animate-spin" /> La IA está pensando…</div>}
        {error && <div className="text-[12px] text-red-700 bg-red-50 border border-red-300 rounded-lg px-3 py-2">{error}</div>}
      </div>
      <div className="shrink-0 border-t border-gray-200 p-2.5">
        <div className="flex items-center gap-1 mb-2 text-[10.5px] text-gray-400">
          <Sparkles size={11} className="text-primary-600" />
          Inventario con IA · consume <TokenCostBadge operationKey="inventory" /> por macroproceso
        </div>
        <div className="flex gap-2 mb-2 flex-wrap">
          {['Sí, confirmo', 'Sigue ▸'].map((q) => (
            <button key={q} onClick={() => send(q)} disabled={busy} className="text-[11px] px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-800 hover:border-primary-300 disabled:opacity-40">{q}</button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Responde… (ej. «1,3,5,8» o «confirmo»)" rows={1}
            className="flex-1 resize-none max-h-24 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <button onClick={() => send(input)} disabled={busy || !input.trim()} className="shrink-0 p-2.5 rounded-lg text-white shadow-lg disabled:opacity-40 bg-primary-500"><Send size={16} /></button>
        </div>
      </div>
    </div>
  )
}

function Bubble({ role, content, streaming }: { role: 'user' | 'assistant'; content: string; streaming?: boolean }) {
  const user = role === 'user'
  const parts = splitBlocks(content)
  return (
    <div className={`flex gap-2.5 ${user ? 'flex-row-reverse' : ''}`}>
      <div className={`shrink-0 w-7 h-7 rounded-lg grid place-items-center ${user ? 'bg-gray-100' : 'bg-primary-500'}`}>
        {user ? <User size={14} className="text-gray-700" /> : <Sparkles size={14} className="text-gray-900" />}
      </div>
      <div className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${user ? 'bg-primary-50 text-gray-800 border border-primary-200' : 'bg-gray-50 text-gray-800 border border-gray-200'}`}>
        {parts.map((p, i) => p.code
          ? <span key={i} className="inline-flex items-center gap-1.5 my-1 text-[11px] px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">▣ bloque aplicado</span>
          : <span key={i}>{p.text}</span>)}
        {streaming && <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-primary-500 animate-pulse align-middle" />}
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
    out.push({ code: true }); last = m.index + m[0].length
  }
  const tail = content.slice(last).trim()
  if (tail) out.push({ text: tail })
  return out.filter((p) => p.code || (p.text && p.text.length))
}
