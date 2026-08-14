import { useState } from 'react'
import { Download, RefreshCw, Mic, MicOff, Send, Loader2, CheckCircle2, Code2, GitBranch, Layers, Eye, Code } from 'lucide-react'
import { BpmnModeler } from '@/features/bpmn/components/BpmnModeler'

interface BpmnReviewPanelProps {
  bpmnXml: string
  isRefining: boolean
  onRefine: (instruction: string) => void
  onExport: () => void
  onSaveToProcess: () => void
  onXmlChange?: (xml: string) => void
  isSaving: boolean
  saved: boolean
  saveButtonLabel?: string
  savedButtonLabel?: string
}

export function BpmnReviewPanel({
  bpmnXml,
  isRefining,
  onRefine,
  onExport,
  onSaveToProcess,
  onXmlChange,
  isSaving,
  saved,
  saveButtonLabel = 'Guardar en proceso',
  savedButtonLabel = 'Guardado',
}: BpmnReviewPanelProps) {
  const [instruction, setInstruction] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null)
  const [viewMode, setViewMode] = useState<'visual' | 'xml'>('visual')

  function toggleVoiceRefine() {
    if (isListening && recognition) {
      recognition.stop()
      setIsListening(false)
      return
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) return

    const rec = new SpeechRecognitionAPI()
    rec.lang = 'es-ES'
    rec.continuous = false
    rec.interimResults = true

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }
      if (finalTranscript) setInstruction(finalTranscript)
    }

    rec.onend = () => setIsListening(false)
    rec.start()
    setRecognition(rec)
    setIsListening(true)
  }

  function handleRefine() {
    if (!instruction.trim() || isRefining) return
    onRefine(instruction.trim())
    setInstruction('')
  }

  // Count elements
  const taskCount = (bpmnXml.match(/<(bpmn:)?task/gi) || []).length
      + (bpmnXml.match(/<(bpmn:)?userTask/gi) || []).length
  const gatewayCount = (bpmnXml.match(/Gateway/gi) || []).length
  const laneCount = (bpmnXml.match(/<(bpmn:)?lane/gi) || []).length

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 rounded-xl p-3 text-center border border-cyan-500/20">
          <Layers size={16} className="mx-auto text-cyan-400 mb-1" />
          <p className="text-xl font-bold text-cyan-300">{taskCount}</p>
          <p className="text-[10px] text-cyan-400/60 uppercase tracking-wider">Tareas</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-3 text-center border border-purple-500/20">
          <GitBranch size={16} className="mx-auto text-purple-400 mb-1" />
          <p className="text-xl font-bold text-purple-300">{gatewayCount}</p>
          <p className="text-[10px] text-purple-400/60 uppercase tracking-wider">Compuertas</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-3 text-center border border-blue-500/20">
          <Code2 size={16} className="mx-auto text-blue-400 mb-1" />
          <p className="text-xl font-bold text-blue-300">{laneCount}</p>
          <p className="text-[10px] text-blue-400/60 uppercase tracking-wider">Carriles</p>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider">Diagrama BPMN</h4>
        <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/10">
          <button
            onClick={() => setViewMode('visual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-all ${
              viewMode === 'visual' ? 'bg-cyan-600/20 text-cyan-300' : 'text-white/30 hover:text-white/50'
            }`}
          >
            <Eye size={12} /> Visual
          </button>
          <button
            onClick={() => setViewMode('xml')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium transition-all ${
              viewMode === 'xml' ? 'bg-cyan-600/20 text-cyan-300' : 'text-white/30 hover:text-white/50'
            }`}
          >
            <Code size={12} /> XML
          </button>
        </div>
      </div>

      {/* BPMN Visual Editor or XML Preview */}
      {viewMode === 'visual' ? (
        <BpmnModeler
          xml={bpmnXml}
          onXmlChange={onXmlChange}
        />
      ) : (
        <pre className="bg-black/40 text-cyan-400/80 rounded-xl p-4 text-[11px] overflow-auto max-h-80 font-mono border border-white/5 leading-relaxed">
          {bpmnXml.substring(0, 3000)}{bpmnXml.length > 3000 ? '\n...' : ''}
        </pre>
      )}

      {/* Refinement with AI */}
      <div>
        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Refinar con IA</h4>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleVoiceRefine}
            className={`p-2.5 rounded-xl transition-all ${
              isListening
                ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30 animate-pulse'
                : 'bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10 border border-white/10'
            }`}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
            placeholder="Ej: Agrega una tarea de revision antes del fin..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            disabled={isRefining}
          />
          <button
            onClick={handleRefine}
            disabled={!instruction.trim() || isRefining}
            className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 disabled:opacity-30 transition-all"
          >
            {isRefining ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onExport}
          className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
        >
          <Download size={18} />
          Exportar .bpmn
        </button>
        <button
          onClick={onSaveToProcess}
          disabled={isSaving || saved}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
            saved
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50'
          }`}
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          {saved ? savedButtonLabel : saveButtonLabel}
        </button>
      </div>

      {isListening && (
        <div className="flex items-center gap-2 text-sm text-red-400/80">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Escuchando instruccion de refinamiento...
        </div>
      )}

      <p className="text-[11px] text-white/20 flex items-center gap-1">
        <Send size={10} />
        Edita visualmente o refina con instrucciones de voz/texto.
      </p>
    </div>
  )
}
