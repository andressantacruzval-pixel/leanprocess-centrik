import { useCallback, useState } from 'react'
import { Send, Mic, Square, Loader2, Microscope } from 'lucide-react'
import { useVoiceToText } from '@/hooks/useVoiceToText'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'

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
  const dictado = useVoiceToText({ onText: appendVoice })

  const submit = useCallback(() => {
    const t = value.trim()
    if (isStreaming) return
    if (!t && !deep) return
    dictado.stop()
    if (deep) { onDeepResearch(t); setDeep(false) } else { onSend(t) }
    setValue('')
  }, [value, isStreaming, deep, onSend, onDeepResearch, dictado])

  return (
    <div className="border-t border-gray-100 bg-surface-ground p-3">
      {dictado.transcribing && (
        <div className="mb-2 flex items-center gap-2 text-[11.5px] text-primary-700">
          <Loader2 size={13} className="animate-spin" /> Transcribiendo tu voz…
        </div>
      )}
      {dictado.recording && (
        <div className="mb-2 flex items-center gap-2 text-[11.5px] text-primary-700">
          <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span>
          Grabando… pulsa el micrófono para transcribir.
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setDeep((d) => !d)}
          title="Investigación profunda: analiza toda la empresa y entrega un informe"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-medium border transition-colors ${
            deep ? 'bg-primary-50 text-primary-700 border-primary-300' : 'bg-gray-50 text-gray-500 border-gray-200 hover:text-primary-700 hover:border-primary-300'
          }`}
        >
          <Microscope size={13} /> Investigación profunda {deep ? '· activada' : ''}
        </button>
        {deep && <span className="text-[11px] text-gray-400">Recorre todos tus procesos y arma un informe con gráficos.</span>}
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-400">
          Cada consulta consume <TokenCostBadge operationKey="ai_consultant" />
        </span>
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          placeholder={deep ? 'Tema del informe (opcional): riesgos, cumplimiento, un área…' : 'Pregúntale al copiloto sobre tus procesos, riesgos, indicadores…'}
          rows={1}
          className="flex-1 resize-none max-h-32 bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-[13.5px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-300"
        />
        {dictado.supported && (
          <button
            onClick={dictado.toggle}
            disabled={dictado.transcribing}
            title={dictado.recording ? 'Detener y transcribir' : 'Dictar por voz'}
            className={`shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-60 ${
              dictado.recording ? 'bg-red-50 text-red-700 border-red-300' : 'bg-gray-50 text-gray-500 border-gray-200 hover:text-primary-700 hover:border-primary-300'
            }`}
          >
            {dictado.transcribing ? <Loader2 size={16} className="animate-spin" /> : <Mic size={17} />}
          </button>
        )}
        {isStreaming ? (
          <button onClick={onStop} title="Detener" className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
            <Square size={15} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!value.trim() && !deep}
            title={deep ? 'Generar informe' : 'Enviar'}
            className={`shrink-0 h-10 w-10 flex items-center justify-center rounded-lg text-white disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity ${deep ? 'bg-primary-500' : 'bg-primary-500'}`}
          >
            {isStreaming ? <Loader2 size={16} className="animate-spin" /> : deep ? <Microscope size={16} /> : <Send size={16} />}
          </button>
        )}
      </div>
    </div>
  )
}
