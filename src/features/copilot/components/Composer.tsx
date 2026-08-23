import { useCallback, useState } from 'react'
import { Send, Mic, Square, Loader2, Microscope } from 'lucide-react'
import { useSpeechDictation } from '@/hooks/useSpeechDictation'

// Caja de entrada: texto + dictado por voz + investigación profunda + enviar/detener.
export function Composer({ isStreaming, onSend, onStop, onDeepResearch }: {
  isStreaming: boolean
  onSend: (text: string) => void
  onStop: () => void
  onDeepResearch: (text: string) => void
}) {
  const [value, setValue] = useState('')
  const [deep, setDeep] = useState(false)

  const appendVoice = useCallback((chunk: string) => {
    setValue((prev) => {
      const sep = prev && !/\s$/.test(prev) ? ' ' : ''
      return prev + sep + chunk
    })
  }, [])
  const dictado = useSpeechDictation({ onFinal: appendVoice })

  const submit = useCallback(() => {
    const t = value.trim()
    if (isStreaming) return
    if (!t && !deep) return
    dictado.stop()
    if (deep) { onDeepResearch(t); setDeep(false) } else { onSend(t) }
    setValue('')
  }, [value, isStreaming, deep, onSend, onDeepResearch, dictado])

  return (
    <div className="border-t border-white/5 bg-[#0b111c] p-3">
      {dictado.listening && (
        <div className="mb-2 flex items-center gap-2 text-[11.5px] text-cyan-300">
          <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>
          {dictado.interim ? <span className="italic text-cyan-200/80 truncate">{dictado.interim}</span> : 'Escuchando… habla con naturalidad.'}
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setDeep((d) => !d)}
          title="Investigación profunda: analiza toda la empresa y entrega un informe"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-medium border transition-colors ${
            deep ? 'bg-violet-500/15 text-violet-300 border-violet-500/30' : 'bg-white/5 text-white/45 border-white/10 hover:text-violet-300 hover:border-violet-500/30'
          }`}
        >
          <Microscope size={13} /> Investigación profunda {deep ? '· activada' : ''}
        </button>
        {deep && <span className="text-[11px] text-white/35">Recorre todos tus procesos y arma un informe con gráficos.</span>}
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          placeholder={deep ? 'Tema del informe (opcional): riesgos, cumplimiento, un área…' : 'Pregúntale al copiloto sobre tus procesos, riesgos, indicadores…'}
          rows={1}
          className="flex-1 resize-none max-h-32 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-[13.5px] text-white placeholder-white/25 focus:outline-none focus:border-cyan-500/50"
        />
        {dictado.supported && (
          <button
            onClick={dictado.toggle}
            title={dictado.listening ? 'Detener dictado' : 'Dictar por voz'}
            className={`shrink-0 h-10 w-10 flex items-center justify-center rounded-xl border transition-colors ${
              dictado.listening ? 'bg-red-500/15 text-red-300 border-red-500/30' : 'bg-white/5 text-white/50 border-white/10 hover:text-cyan-300 hover:border-cyan-500/30'
            }`}
          >
            <Mic size={17} />
          </button>
        )}
        {isStreaming ? (
          <button onClick={onStop} title="Detener" className="shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-white/10 text-white/70 hover:bg-white/15">
            <Square size={15} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!value.trim() && !deep}
            title={deep ? 'Generar informe' : 'Enviar'}
            className={`shrink-0 h-10 w-10 flex items-center justify-center rounded-xl text-white disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity ${deep ? 'bg-gradient-to-br from-violet-500 to-fuchsia-600' : 'bg-gradient-to-br from-cyan-500 to-blue-600'}`}
          >
            {isStreaming ? <Loader2 size={16} className="animate-spin" /> : deep ? <Microscope size={16} /> : <Send size={16} />}
          </button>
        )}
      </div>
    </div>
  )
}
