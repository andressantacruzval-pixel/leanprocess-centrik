import { useCallback, useEffect, useRef } from 'react'
import { X, Sparkles, Mic, Loader2 } from 'lucide-react'
import { useAiConsultant } from '@/hooks/useAiConsultant'
import { ConsultantChat } from '@/features/ai-consultant/components/ConsultantChat'
import { WaveformVisualizer } from '@/features/ai-consultant/components/WaveformVisualizer'
import { WordCloud } from '@/features/ai-consultant/components/WordCloud'
import { useProcessStore } from '@/stores/processStore'

interface AiConsultantDrawerProps {
  open: boolean
  onClose: () => void
  processName: string
  companyName: string
  industry: string
  macroName: string
  parentName: string
  processId: string
  description: string
  sipocEntries: { supplier_name: string; input_description: string; output_description: string; customer_name: string }[]
  onBpmnGenerated: (xml: string) => void
}

export function AiConsultantDrawer({
  open,
  onClose,
  processName,
  companyName,
  industry,
  macroName,
  parentName,
  processId,
  description,
  sipocEntries,
  onBpmnGenerated,
}: AiConsultantDrawerProps) {
  const consultant = useAiConsultant()
  const updateProcess = useProcessStore((s) => s.updateProcess)
  const autoLoadedRef = useRef(false)

  // Cleanup audio and reset when drawer closes
  useEffect(() => {
    if (!open) {
      consultant.stopAllAudio()
      consultant.reset()
      autoLoadedRef.current = false
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // AUTO-LOAD: When BPMN is generated, load directly to canvas
  useEffect(() => {
    if (consultant.phase === 'reviewing' && consultant.bpmnXml && !autoLoadedRef.current) {
      autoLoadedRef.current = true
      // Save to store + load to canvas + close drawer
      updateProcess(processId, { bpmn_xml: consultant.bpmnXml })
      onBpmnGenerated(consultant.bpmnXml)
      // Small delay so user sees the transition
      setTimeout(() => {
        onClose()
      }, 400)
    }
  }, [consultant.phase, consultant.bpmnXml]) // eslint-disable-line react-hooks/exhaustive-deps

  const startWithContext = useCallback(() => {
    consultant.reset()

    let contextInfo = `El proceso se llama "${processName}"`
    contextInfo += `, pertenece a la empresa ${companyName}`
    if (industry) contextInfo += ` del sector ${industry}`
    contextInfo += `. Esta dentro del macroproceso "${macroName}"`
    if (parentName) contextInfo += ` > proceso "${parentName}"`
    if (description) contextInfo += `. Descripcion: ${description}`

    if (sipocEntries.length > 0) {
      contextInfo += `. SIPOC: `
      sipocEntries.forEach((e, i) => {
        const parts: string[] = []
        if (e.supplier_name) parts.push(`Proveedor: ${e.supplier_name}`)
        if (e.input_description) parts.push(`Entrada: ${e.input_description}`)
        if (e.output_description) parts.push(`Salida: ${e.output_description}`)
        if (e.customer_name) parts.push(`Cliente: ${e.customer_name}`)
        if (parts.length) contextInfo += `${i > 0 ? '; ' : ''}${parts.join(', ')}`
      })
    }

    consultant.startInterview(contextInfo)
  }, [consultant, companyName, industry, macroName, parentName, processName, description, sipocEntries])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        } bg-gray-900/45`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-[800px] transform transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col bg-white border-l border-gray-200 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-900/45">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary-100">
                <Sparkles size={16} className="text-primary-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Consultor IA</h2>
                <p className="text-[11px] text-gray-400">{processName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-all border border-gray-100"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* ─── WELCOME PHASE ─── */}
            {consultant.phase === 'welcome' && (
              <div className="relative overflow-hidden rounded-lg border border-gray-100 p-10 text-center bg-white">
                {/* Orbital rings decoration */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-64 rounded-full border border-primary-200 animate-orbit" />
                  <div className="absolute w-48 h-48 rounded-full border border-primary-200 animate-orbit-reverse" />
                  <div className="absolute w-32 h-32 rounded-full border border-blue-200 animate-orbit" style={{ animationDuration: '12s' }} />
                </div>

                {/* Central icon */}
                <div className="relative z-10">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ring-1 ring-primary-500 animate-pulse-glow bg-primary-100">
                    <Mic size={36} className="text-primary-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    Consultor IA
                  </h2>
                  <p className="text-sm text-primary-600 font-medium mb-1">{processName}</p>
                  <p className="text-gray-400 max-w-md mx-auto mb-3 text-sm">
                    El consultor conoce el contexto de tu proceso. Te entrevistara para generar un diagrama BPMN profesional.
                  </p>

                  {/* Context badges */}
                  <div className="flex flex-wrap justify-center gap-2 mb-6">
                    <span className="px-3 py-1 bg-gray-50 rounded-full text-[11px] text-gray-500 border border-gray-100">
                      {companyName} {industry && `(${industry})`}
                    </span>
                    <span className="px-3 py-1 bg-gray-50 rounded-full text-[11px] text-gray-500 border border-gray-100">
                      {macroName} {parentName && `> ${parentName}`}
                    </span>
                    {description && (
                      <span className="px-3 py-1 bg-gray-50 rounded-full text-[11px] text-gray-500 border border-gray-100 max-w-xs truncate">
                        {description.substring(0, 60)}...
                      </span>
                    )}
                  </div>

                  {/* Mode selector + start */}
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="flex bg-gray-50 rounded-lg p-1 border border-gray-200">
                      <button
                        onClick={() => consultant.setInputMode('text')}
                        className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                          consultant.inputMode === 'text'
                            ? 'text-white shadow-lg bg-primary-500'
                            : 'text-gray-500 hover:text-gray-600'
                        }`}
                      >
                        Chat
                      </button>
                      <button
                        onClick={() => consultant.setInputMode('voice')}
                        className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                          consultant.inputMode === 'voice'
                            ? 'text-white shadow-lg bg-primary-500'
                            : 'text-gray-500 hover:text-gray-600'
                        }`}
                      >
                        Voz + Chat
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={startWithContext}
                    className="inline-flex items-center gap-2.5 px-8 py-3 text-white rounded-lg font-semibold transition-all shadow-xl bg-primary-500 hover:bg-primary-600"
                  >
                    <Sparkles size={18} />
                    Iniciar Consulta
                  </button>
                </div>
              </div>
            )}

            {/* ─── CONSULTING PHASE ─── */}
            {consultant.phase === 'consulting' && (
              <div className="rounded-lg border border-gray-100 overflow-hidden bg-white">
                {/* Top bar */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-900/45 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      consultant.isProcessing
                        ? 'bg-amber-500 animate-pulse'
                        : consultant.isListening
                          ? 'bg-red-500 animate-pulse'
                          : 'bg-primary-500'
                    }`} />
                    <span className="text-sm font-medium text-gray-600">
                      {consultant.isProcessing ? 'Analizando...' : consultant.isListening ? 'Escuchando...' : 'Entrevista en curso'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Mode toggle */}
                    <div className="flex bg-gray-50 rounded-lg p-0.5">
                      <button
                        onClick={() => consultant.setInputMode('text')}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                          consultant.inputMode === 'text' ? 'bg-primary-100 text-primary-700' : 'text-gray-400'
                        }`}
                      >
                        Chat
                      </button>
                      <button
                        onClick={() => consultant.setInputMode('voice')}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                          consultant.inputMode === 'voice' ? 'bg-primary-100 text-primary-700' : 'text-gray-400'
                        }`}
                      >
                        Voz
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex h-[min(520px,60vh)] min-h-[320px]">
                  {/* Chat area */}
                  <div className="flex-1 flex flex-col min-w-0">
                    {/* Voice waveform (only in voice mode) */}
                    {consultant.inputMode === 'voice' && (
                      <div className="px-4 pt-3">
                        <WaveformVisualizer isActive={consultant.isListening} />
                      </div>
                    )}

                    {/* Chat */}
                    <div className="flex-1 min-h-0">
                      <ConsultantChat
                        messages={consultant.messages}
                        isProcessing={consultant.isProcessing}
                        transcript={consultant.transcript}
                        isListening={consultant.isListening}
                        onSendMessage={consultant.sendMessage}
                        inputValue={consultant.inputValue}
                        onInputChange={consultant.setInputValue}
                      />
                    </div>

                    {/* Voice button (voice mode) */}
                    {consultant.inputMode === 'voice' && (
                      <div className="px-4 pb-3 flex justify-center">
                        <button
                          onClick={consultant.toggleListening}
                          className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                            consultant.isListening
                              ? 'bg-red-100 ring-2 ring-red-500 text-red-600'
                              : 'text-white shadow-lg bg-primary-500'
                          }`}
                        >
                          {consultant.isListening ? (
                            <>
                              <span className="absolute inset-0 rounded-full bg-red-100 animate-ping" />
                              <Mic size={22} />
                            </>
                          ) : (
                            <Mic size={22} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Word Cloud sidebar */}
                  <div className="w-56 border-l border-gray-100 bg-gray-900/45 hidden lg:block">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">Palabras clave</p>
                    </div>
                    <div className="h-[calc(100%-32px)]">
                      <WordCloud words={consultant.allWords} maxWords={20} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── GENERATING PHASE ─── */}
            {consultant.phase === 'generating' && (
              <div className="rounded-lg border border-gray-100 p-16 text-center relative overflow-hidden bg-white">
                {/* Animated orbital rings */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 rounded-full border border-primary-200 animate-orbit" />
                  <div className="absolute w-32 h-32 rounded-full border border-primary-200 animate-orbit-reverse" />
                </div>

                <div className="relative z-10">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center animate-pulse-glow bg-primary-100">
                    <Loader2 size={36} className="text-primary-600 animate-spin" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Generando diagrama BPMN</h2>
                  <p className="text-gray-500 text-sm">Procesando la informacion de la entrevista...</p>

                  {/* Progress dots */}
                  <div className="flex justify-center gap-1.5 mt-6">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-primary-500"
                        style={{
                          animation: `pulse 1.5s ease-in-out ${i * 0.2}s infinite`,
                          opacity: 0.2,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── REVIEWING PHASE (auto-loads to canvas) ─── */}
            {consultant.phase === 'reviewing' && (
              <div className="rounded-lg border border-gray-100 p-16 text-center relative overflow-hidden bg-white">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 rounded-full border border-emerald-200 animate-orbit" />
                </div>
                <div className="relative z-10">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-primary-100">
                    <Sparkles size={36} className="text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Diagrama generado</h2>
                  <p className="text-gray-500 text-sm">Cargando al editor principal...</p>
                  <div className="flex justify-center gap-1.5 mt-6">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-emerald-500"
                        style={{ animation: `pulse 1s ease-in-out ${i * 0.15}s infinite`, opacity: 0.3 }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Error display */}
            {consultant.error && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                {consultant.error}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
