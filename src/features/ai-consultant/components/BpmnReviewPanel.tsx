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
        <div className="rounded-lg p-3 text-center border border-primary-200 bg-primary-50">
          <Layers size={16} className="mx-auto text-primary-600 mb-1" />
          <p className="text-xl font-bold text-primary-700">{taskCount}</p>
          <p className="text-[10px] text-primary-600 uppercase tracking-wider">Tareas</p>
        </div>
        <div className="rounded-lg p-3 text-center border border-primary-200 bg-primary-50">
          <GitBranch size={16} className="mx-auto text-primary-600 mb-1" />
          <p className="text-xl font-bold text-primary-700">{gatewayCount}</p>
          <p className="text-[10px] text-primary-600 uppercase tracking-wider">Compuertas</p>
        </div>
        <div className="rounded-lg p-3 text-center border border-blue-200 bg-primary-50">
          <Code2 size={16} className="mx-auto text-blue-600 mb-1" />
          <p className="text-xl font-bold text-blue-700">{laneCount}</p>
          <p className="text-[10px] text-blue-600 uppercase tracking-wider">Carriles</p>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Diagrama BPMN</h4>
        <div className="flex bg-gray-50 rounded-lg p-0.5 border border-gray-200">
          <button
            onClick={() => setViewMode('visual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
              viewMode === 'visual' ? 'bg-primary-100 text-primary-700' : 'text-gray-400 hover:text-gray-500'
            }`}
          >
            <Eye size={12} /> Visual
          </button>
          <button
            onClick={() => setViewMode('xml')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
              viewMode === 'xml' ? 'bg-primary-100 text-primary-700' : 'text-gray-400 hover:text-gray-500'
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
        <pre className="bg-gray-900/45 text-primary-600 rounded-lg p-4 text-[11px] overflow-auto max-h-80 font-mono border border-gray-100 leading-relaxed">
          {bpmnXml.substring(0, 3000)}{bpmnXml.length > 3000 ? '\n...' : ''}
        </pre>
      )}

      {/* Refinement with AI */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Refinar con IA</h4>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleVoiceRefine}
            className={`p-2.5 rounded-lg transition-all ${
              isListening
                ? 'bg-red-100 text-red-600 ring-1 ring-red-500 animate-pulse'
                : 'bg-gray-50 text-gray-500 hover:text-gray-800 hover:bg-gray-100 border border-gray-200'
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
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
            disabled={isRefining}
          />
          <button
            onClick={handleRefine}
            disabled={!instruction.trim() || isRefining}
            className="p-2.5 rounded-lg text-white disabled:opacity-30 transition-all bg-primary-500 hover:bg-primary-600"
          >
            {isRefining ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onExport}
          className="flex-1 flex items-center justify-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-all"
        >
          <Download size={18} />
          Exportar .bpmn
        </button>
        <button
          onClick={onSaveToProcess}
          disabled={isSaving || saved}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
            saved
              ? 'bg-emerald-100 text-emerald-600 border border-emerald-300'
              : 'text-white disabled:opacity-50 bg-primary-500 hover:bg-primary-600'
          }`}
        >
          {isSaving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          {saved ? savedButtonLabel : saveButtonLabel}
        </button>
      </div>

      {isListening && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Escuchando instruccion de refinamiento...
        </div>
      )}

      <p className="text-[11px] text-gray-300 flex items-center gap-1">
        <Send size={10} />
        Edita visualmente o refina con instrucciones de voz/texto.
      </p>
    </div>
  )
}
