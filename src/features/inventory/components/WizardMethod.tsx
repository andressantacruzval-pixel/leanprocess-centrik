import { useMemo, useState } from 'react'
import { Zap, Target, Copy, LifeBuoy, ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useInventoryStore } from '@/stores/inventoryStore'
import type { InvDoc, InvMetodo } from '../types'
import { buildInventoryPrompt, buildRescuePrompt } from '../inventoryPrompt'

// Paso 2 — Método y prompt. Los dos métodos usan el mismo canon; cambia cuánto
// pregunta la IA antes de entregar. El prompt se arma con el mapa y las áreas reales.

interface Props {
  companyId: string
  doc: InvDoc
  onBack: () => void
  onNext: () => void
}

export function WizardMethod({ companyId, doc, onBack, onNext }: Props) {
  const setMetodo = useInventoryStore((s) => s.setMetodo)
  const [modo, setModo] = useState<'todos' | 'foco'>('todos')
  const [foco, setFoco] = useState(0)
  const [copied, setCopied] = useState('')
  const metodo = doc.proyecto.metodo

  const prompt = useMemo(
    () => buildInventoryPrompt(doc.proyecto, doc.macros, doc.areas, { modo, focoIndex: foco }),
    [doc, modo, foco]
  )
  const tokens = Math.round(prompt.length / 4)

  const copy = (text: string, tag: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(tag); setTimeout(() => setCopied(''), 1800) }).catch(() => {})
  }

  const cards: { id: InvMetodo; icon: typeof Zap; title: string; desc: string; pros: string[] }[] = [
    { id: 'bigbang', icon: Zap, title: 'Big Bang', desc: 'La IA deduce el inventario completo de una pasada, con mínimas preguntas.', pros: ['Primera versión en 10–15 min', 'Pocas interacciones', 'Todo llega como “deducido”: hay que depurar'] },
    { id: 'incremental', icon: Target, title: 'Incremental', desc: 'Macroproceso por macroproceso, con 2–5 preguntas cortas. Sale confirmado.', pros: ['Más preciso: “confirmado”, no deducido', 'Captura el trabajo informal', 'Más tiempo, en varias sesiones'] },
  ]

  return (
    <div className="space-y-5">
      <header>
        <div className="text-[11px] font-mono uppercase tracking-widest text-cyan-400 mb-1">Paso 2 · Entrevista con IA</div>
        <h2 className="text-2xl font-bold text-white">Elige el método y copia el prompt</h2>
        <p className="text-sm text-white/50 mt-1">Pégalo en tu chat de IA. Te irá devolviendo bloques JSON que capturas en el siguiente paso.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => {
          const on = metodo === c.id
          return (
            <button key={c.id} onClick={() => setMetodo(companyId, c.id)}
              className={`text-left rounded-2xl border p-5 transition-all ${on ? 'border-cyan-500/50 bg-cyan-500/[0.06] shadow-lg shadow-cyan-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                <c.icon size={18} className={on ? 'text-cyan-400' : 'text-white/50'} />
                <h3 className="text-base font-bold text-white">{c.title}</h3>
                {on && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Elegido</span>}
              </div>
              <p className="text-[13px] text-white/60 leading-relaxed">{c.desc}</p>
              <ul className="mt-3 space-y-1">
                {c.pros.map((p) => (<li key={p} className="text-[12px] text-white/45 flex gap-1.5"><span className="text-cyan-400">·</span>{p}</li>))}
              </ul>
            </button>
          )
        })}
      </div>

      {/* Alcance */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Alcance de esta conversación</h3>
        <div className="flex gap-2 mb-3 max-w-md">
          <Seg on={modo === 'todos'} onClick={() => setModo('todos')}>Todos los macroprocesos</Seg>
          <Seg on={modo === 'foco'} onClick={() => setModo('foco')}>Uno a la vez</Seg>
        </div>
        {modo === 'foco' && (
          <select value={foco} onChange={(e) => setFoco(+e.target.value)}
            className="w-full max-w-md px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
            {doc.macros.map((m, i) => (<option key={m.nombre + i} value={i}>{m.nombre}</option>))}
          </select>
        )}
      </div>

      {/* Prompt */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <button onClick={() => copy(prompt, 'main')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold shadow-lg shadow-cyan-500/30">
            {copied === 'main' ? <Check size={15} /> : <Copy size={15} />} Copiar el prompt completo
          </button>
          <button onClick={() => copy(buildRescuePrompt(doc.macros), 'rescue')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 text-white/70 text-[13px] hover:bg-white/5">
            {copied === 'rescue' ? <Check size={14} /> : <LifeBuoy size={14} />} Prompt de rescate
          </button>
          <span className="text-[11px] text-white/40 ml-auto">≈ {tokens.toLocaleString()} tokens</span>
        </div>
        <pre className="max-h-72 overflow-y-auto rounded-xl bg-[#06100a] border border-white/10 p-4 text-[11px] leading-relaxed text-cyan-100/80 whitespace-pre-wrap font-mono">{prompt}</pre>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/15 text-white/70 text-sm hover:bg-white/5"><ArrowLeft size={15} /> Atrás</button>
        <div className="flex-1" />
        <button onClick={onNext} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-semibold shadow-lg shadow-cyan-500/30">Ya tengo la respuesta <ArrowRight size={15} /></button>
      </div>
    </div>
  )
}

function Seg({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex-1 px-3 py-2 rounded-lg text-[13px] font-medium border transition-all ${on ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' : 'border-white/10 bg-white/5 text-white/50 hover:text-white/70'}`}>{children}</button>
  )
}
