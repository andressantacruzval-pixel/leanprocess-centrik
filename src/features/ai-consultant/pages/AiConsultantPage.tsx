import { useState, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  MessageSquare, ListChecks, PenLine, Paperclip,
  Mic, RotateCcw, Sparkles, Loader2, AlertCircle, Upload, X,
} from 'lucide-react'
import { useAiConsultant } from '@/hooks/useAiConsultant'
import { ConsultantChat } from '@/features/ai-consultant/components/ConsultantChat'
import { WaveformVisualizer } from '@/features/ai-consultant/components/WaveformVisualizer'
import { WordCloud } from '@/features/ai-consultant/components/WordCloud'
import { BpmnReviewPanel } from '@/features/ai-consultant/components/BpmnReviewPanel'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { useDocumentableGuard } from '@/hooks/useDocumentableGuard'
import { InsufficientTokensModal } from '@/components/ui/InsufficientTokensModal'

type ActiveTab = 'conversation' | 'interview' | 'direct' | 'file'

const TABS: { id: ActiveTab; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'conversation', label: 'Conversación', icon: MessageSquare, color: 'cyan' },
  { id: 'interview',    label: 'Entrevista',   icon: ListChecks,    color: 'purple' },
  { id: 'direct',       label: 'Directa',      icon: PenLine,       color: 'blue' },
  { id: 'file',         label: 'Archivo',       icon: Paperclip,     color: 'amber' },
]

const TAB_COLORS: Record<ActiveTab, string> = {
  conversation: 'from-cyan-600 to-blue-600',
  interview:    'from-purple-600 to-cyan-600',
  direct:       'from-blue-600 to-indigo-600',
  file:         'from-amber-600 to-orange-600',
}

export default function AiConsultantPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const processId = searchParams.get('processId')

  // `handleSaveToProcess` inserta en `bpmn_diagrams` con el processId que venga
  // por query param, sin pasar por ninguna pantalla protegida. Sin processId
  // (consultor general) el hook no hace nada. Ver @/lib/processLevels.
  useDocumentableGuard(processId ?? undefined)
  const user = useAuthStore((s) => s.user)

  const [activeTab, setActiveTab] = useState<ActiveTab>('conversation')
  const [directDescription, setDirectDescription] = useState('')
  const [fileDescription, setFileDescription] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    phase,
    messages,
    isProcessing,
    isListening,
    transcript,
    inputValue,
    setInputValue,
    bpmnXml,
    setBpmnXml,
    allWords,
    error,
    isRefining,
    startInterview,
    sendMessage,
    generateDirect,
    generateFromFile,
    toggleListening,
    refine,
    exportBpmn,
    reset,
  } = useAiConsultant()

  const interviewBudget = useTokenBudget({ operationKey: 'flowchart_interview_turn' })

  const handleSendMessage = useCallback(async (text: string) => {
    await interviewBudget.run(async () => {
      await sendMessage(text)
    })
  }, [interviewBudget, sendMessage])

  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSaveToProcess() {
    if (!bpmnXml || !user || !processId) return
    setIsSaving(true)
    try {
      const { error: insertError } = await supabase.from('bpmn_diagrams').insert({
        process_id: processId,
        name: 'Diagrama generado por IA',
        diagram_xml: bpmnXml,
        generated_by_ai: true,
        version: 1,
      })
      if (insertError) {
        console.warn('[AiConsultantPage] Error al guardar diagrama:', insertError.message)
        return
      }
      setSaveSuccess(true)
      setSaved(true)
      setTimeout(() => navigate(`/app/process/${processId}`), 1500)
    } finally {
      setIsSaving(false)
    }
  }

  function handleFileSelect(file: File) {
    setSelectedFile(file)
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  async function handleGenerateDirect() {
    await interviewBudget.run(async () => {
      await generateDirect(directDescription)
    })
  }

  async function handleGenerateFromFile() {
    if (!selectedFile) return
    await interviewBudget.run(async () => {
      await generateFromFile(selectedFile, fileDescription || undefined)
    })
  }

  // Dictar en el textarea de entrada directa
  function handleDirectVoice() {
    toggleListening()
  }

  // Cuando termina de dictar, agrega el transcript al textarea
  const directWithTranscript = directDescription + (transcript ? ' ' + transcript : '')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="text-cyan-400" size={28} />
            Consultor de Procesos IA
          </h1>
          <p className="text-white/40 mt-1">Genera diagramas BPMN 2.0 profesionales con inteligencia artificial</p>
        </div>
        {phase !== 'welcome' && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-xl text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors"
          >
            <RotateCcw size={16} />
            Nueva consulta
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle size={20} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Success banner */}
      {saveSuccess && (
        <div className="flex items-center gap-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-4 py-3">
          <Sparkles size={20} className="text-cyan-400 shrink-0" />
          <p className="text-sm text-cyan-400">Diagrama guardado exitosamente!</p>
        </div>
      )}

      {/* ─── WELCOME PHASE — selector de 4 modos ──────────────────────────── */}
      {phase === 'welcome' && (
        <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
          {/* Tab selector */}
          <div className="flex border-b border-white/5">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white/[0.05] text-white border-b-2 border-cyan-400'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="p-8">

            {/* ── Tab 1: Conversación libre ── */}
            {activeTab === 'conversation' && (
              <div className="max-w-xl mx-auto text-center">
                <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-cyan-500/10 flex items-center justify-center">
                  <MessageSquare size={28} className="text-cyan-400" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">Conversación libre</h2>
                <p className="text-white/40 text-sm mb-6">
                  Describe tu proceso como quieras. La IA te hará preguntas de clarificación cuando lo necesite
                  y generará el diagrama cuando tenga suficiente información.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-8 text-xs text-white/30">
                  <span className="px-3 py-1 bg-white/5 rounded-full border border-white/5">Sin orden fijo</span>
                  <span className="px-3 py-1 bg-white/5 rounded-full border border-white/5">Chat adaptativo</span>
                  <span className="px-3 py-1 bg-white/5 rounded-full border border-white/5">Voz + texto</span>
                </div>
                <button
                  onClick={() => startInterview(undefined, 'conversation')}
                  className={`inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r ${TAB_COLORS.conversation} text-white rounded-xl font-medium hover:opacity-90 transition-all shadow-lg shadow-cyan-500/20`}
                >
                  <MessageSquare size={18} />
                  Iniciar conversación
                </button>
              </div>
            )}

            {/* ── Tab 2: Entrevista guiada ── */}
            {activeTab === 'interview' && (
              <div className="max-w-xl mx-auto text-center">
                <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <ListChecks size={28} className="text-purple-400" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">Entrevista guiada</h2>
                <p className="text-white/40 text-sm mb-6">
                  La IA te hace preguntas una a una en orden lógico: nombre, objetivo, pasos, decisiones, roles y cierre.
                  Ideal para procesos que aún no tienes del todo definidos.
                </p>
                <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto mb-8">
                  {[
                    { step: '1', label: 'Entrevista', color: 'purple' },
                    { step: '2', label: 'Generación', color: 'cyan' },
                    { step: '3', label: 'Revisión', color: 'blue' },
                  ].map(({ step, label, color }) => (
                    <div key={step} className={`p-3 bg-${color}-500/10 border border-${color}-500/20 rounded-xl`}>
                      <p className={`font-semibold text-${color}-400 text-xs`}>{step}. {label}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => startInterview(undefined, 'interview')}
                  className={`inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r ${TAB_COLORS.interview} text-white rounded-xl font-medium hover:opacity-90 transition-all shadow-lg shadow-purple-500/20`}
                >
                  <ListChecks size={18} />
                  Iniciar entrevista
                </button>
              </div>
            )}

            {/* ── Tab 3: Entrada directa ── */}
            {activeTab === 'direct' && (
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <PenLine size={28} className="text-blue-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white mb-1">Entrada directa</h2>
                  <p className="text-white/40 text-sm">
                    Describe tu proceso completo en un solo bloque. Puedes dictarlo por voz.
                    La IA genera el diagrama sin preguntas adicionales.
                  </p>
                </div>

                <div className="relative mb-4">
                  <textarea
                    value={directWithTranscript}
                    onChange={(e) => setDirectDescription(e.target.value)}
                    placeholder="Describe el proceso completo aquí... Ej: 'El proceso de compras inicia cuando el área operativa solicita un material. El jefe de compras revisa la solicitud y si el monto es menor a $1000 aprueba directamente, si no, requiere autorización de gerencia. Una vez aprobado, compras contacta proveedores y genera la orden de compra...'"
                    rows={7}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm resize-none focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all"
                  />
                  {isListening && (
                    <div className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-red-500/20 rounded-lg">
                      <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                      <span className="text-xs text-red-400">Escuchando...</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDirectVoice}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      isListening
                        ? 'bg-red-500/20 border-red-500/30 text-red-400'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white/80'
                    }`}
                  >
                    <Mic size={16} />
                    {isListening ? 'Detener' : 'Dictar'}
                  </button>
                  <button
                    onClick={handleGenerateDirect}
                    disabled={!directWithTranscript.trim() || isProcessing || interviewBudget.isConsuming}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg ${
                      directWithTranscript.trim() && !isProcessing
                        ? `bg-gradient-to-r ${TAB_COLORS.direct} text-white hover:opacity-90 shadow-blue-500/20`
                        : 'bg-white/5 text-white/30 cursor-not-allowed'
                    }`}
                  >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    Generar diagrama
                  </button>
                </div>
                <p className="text-xs text-white/20 mt-3 text-center">
                  Tip: menciona roles, pasos en orden, puntos de decisión y cómo termina el proceso
                </p>
              </div>
            )}

            {/* ── Tab 4: Carga de archivo ── */}
            {activeTab === 'file' && (
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Paperclip size={28} className="text-amber-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-white mb-1">Carga de archivo</h2>
                  <p className="text-white/40 text-sm">
                    Sube un PDF, imagen (pizarrón, flujograma), audio o video de tu proceso.
                    La IA lo analiza y genera el BPMN automáticamente.
                  </p>
                </div>

                {/* Drop zone */}
                <div
                  onDrop={handleFileDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                    selectedFile
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.m4a,.ogg,.mp4,.webm,.mov"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <Upload size={20} className="text-amber-400" />
                      <span className="text-sm text-amber-400 font-medium">{selectedFile.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }}
                        className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                      >
                        <X size={12} className="text-white/60" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={32} className="mx-auto text-white/20 mb-3" />
                      <p className="text-sm text-white/50">Arrastra tu archivo aquí o haz clic para seleccionar</p>
                      <p className="text-xs text-white/20 mt-2">PDF, imágenes, audio o video — máximo 10 MB</p>
                    </>
                  )}
                </div>

                {/* Optional context description */}
                <div className="mt-3 mb-4">
                  <input
                    type="text"
                    value={fileDescription}
                    onChange={(e) => setFileDescription(e.target.value)}
                    placeholder="Contexto adicional (opcional): nombre del proceso, área, etc."
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 text-sm focus:outline-none focus:border-amber-500/50 transition-all"
                  />
                </div>

                <button
                  onClick={handleGenerateFromFile}
                  disabled={!selectedFile || isProcessing || interviewBudget.isConsuming}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all shadow-lg ${
                    selectedFile && !isProcessing
                      ? `bg-gradient-to-r ${TAB_COLORS.file} text-white hover:opacity-90 shadow-amber-500/20`
                      : 'bg-white/5 text-white/30 cursor-not-allowed'
                  }`}
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Analizar y generar diagrama
                </button>

                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
                  {['PDF', 'JPG / PNG', 'MP3 / WAV', 'MP4 / WebM'].map((type) => (
                    <span key={type} className="text-xs text-white/20">{type}</span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ─── CONSULTING PHASE (Tab 1 y Tab 2) ────────────────────────────── */}
      {phase === 'consulting' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden flex flex-col h-[min(600px,70vh)] min-h-[360px]">
            <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-400 animate-pulse' : 'bg-cyan-400'}`} />
              <span className="text-sm font-medium text-white/60">
                {isProcessing ? 'Procesando respuesta...' : isListening ? 'Escuchando...' : 'Consulta en curso'}
              </span>
            </div>
            <ConsultantChat
              messages={messages}
              isListening={isListening}
              isProcessing={isProcessing || interviewBudget.isConsuming}
              transcript={transcript}
              onSendMessage={handleSendMessage}
              inputValue={inputValue}
              onInputChange={setInputValue}
              onToggleListen={toggleListening}
            />
          </div>

          <div className="space-y-4">
            <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-6">
              <h3 className="text-sm font-medium text-white/40 mb-3">Visualizador de audio</h3>
              <WaveformVisualizer isActive={isListening} />
              {isListening && (
                <p className="text-xs text-cyan-400 mt-2 text-center animate-pulse">
                  Micrófono activo — habla ahora
                </p>
              )}
            </div>
            <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4">
              <h3 className="text-sm font-medium text-white/40 mb-2">Palabras clave del proceso</h3>
              <WordCloud words={allWords} />
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
              <h3 className="text-sm font-medium text-blue-400 mb-2">Consejos</h3>
              <ul className="text-xs text-blue-400/70 space-y-1.5">
                <li>— Sé específico con las actividades y su orden</li>
                <li>— Menciona quién es responsable de cada paso</li>
                <li>— Indica las decisiones y sus posibles caminos</li>
                <li>— Describe las excepciones o errores comunes</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ─── GENERATING PHASE ──────────────────────────────────────────────── */}
      {phase === 'generating' && (
        <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-12 text-center">
          <Loader2 size={48} className="mx-auto text-cyan-400 animate-spin mb-6" />
          <h2 className="text-xl font-semibold text-white mb-2">Generando diagrama BPMN...</h2>
          <p className="text-white/40">La IA está construyendo el XML con coordenadas precisas. Puede tomar unos segundos.</p>
        </div>
      )}

      {/* ─── REVIEWING PHASE ───────────────────────────────────────────────── */}
      {phase === 'reviewing' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white/[0.03] rounded-2xl border border-white/5 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Diagrama BPMN Generado</h2>
            <BpmnReviewPanel
              bpmnXml={bpmnXml}
              isRefining={isRefining}
              onRefine={refine}
              onExport={exportBpmn}
              onSaveToProcess={handleSaveToProcess}
              onXmlChange={(xml) => setBpmnXml(xml)}
              isSaving={isSaving}
              saved={saved}
            />
          </div>
          <div className="space-y-4">
            <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4">
              <h3 className="text-sm font-medium text-white/40 mb-2">Palabras clave identificadas</h3>
              <WordCloud words={allWords} />
            </div>
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4">
              <h3 className="text-sm font-medium text-purple-400 mb-2">Qué puedes hacer</h3>
              <ul className="text-xs text-purple-400/70 space-y-1.5">
                <li>— Refinar el diagrama con instrucciones de texto</li>
                <li>— Exportar como archivo .bpmn compatible con Bizagi</li>
                <li>— Guardar el diagrama en un proceso existente</li>
                <li>— Iniciar una nueva consulta desde cero</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <InsufficientTokensModal
        open={interviewBudget.showInsufficientModal}
        onClose={interviewBudget.closeInsufficientModal}
        operationKey="flowchart_interview_turn"
      />
    </div>
  )
}
