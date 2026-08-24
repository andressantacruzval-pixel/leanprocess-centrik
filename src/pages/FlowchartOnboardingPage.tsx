import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, FileUp, MessageSquare, Mic, Sparkles, Type, Loader2 } from 'lucide-react'
import { BpmnModeler } from '@/features/bpmn/components/BpmnModeler'
import { useProcesses } from '@/hooks/useProcesses'
import { useTokenBudget } from '@/hooks/useTokenBudget'
import { useVoiceToText } from '@/hooks/useVoiceToText'
import { TokenCostBadge } from '@/components/ui/TokenCostBadge'
import { generateBpmnDirect, generateBpmnFromFile, validateBpmnFile, fileToBase64 } from '@/lib/bpmnAi'
import { FlowchartChatMode } from '@/pages/FlowchartChatMode'
import { IS_PHASE_1 } from '@/lib/phaseFlags'
import { useDocumentableGuard } from '@/hooks/useDocumentableGuard'

type Phase = 'select' | 'chat' | 'direct' | 'file' | 'generating' | 'preview'
type Mode = 'chat' | 'direct' | 'file'

export default function FlowchartOnboardingPage() {
  const navigate = useNavigate()
  const { processId } = useParams()

  // Genera un BPMN con IA y lo guarda en el proceso: solo en el nivel mas bajo
  // declarado. Cubre tambien a FlowchartChatMode, que se monta desde aqui.
  // Ver @/lib/processLevels.
  useDocumentableGuard(processId)
  const { processes, updateProcess } = useProcesses()
  const process = useMemo(
    () => processes.find((p) => p.id === processId),
    [processes, processId]
  )

  const bpmnBudget = useTokenBudget({ operationKey: 'bpmn_generation' })
  const bpmnFileBudget = useTokenBudget({ operationKey: 'bpmn_file_generation' })

  const [phase, setPhase] = useState<Phase>('select')
  const [selectedMode, setSelectedMode] = useState<Mode>(IS_PHASE_1 ? 'direct' : 'chat')
  const [directText, setDirectText] = useState('')
  const [fileRef, setFileRef] = useState<File | null>(null)
  const [fileContext, setFileContext] = useState('')
  const [previewXml, setPreviewXml] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleBack = useCallback(() => {
    if (phase === 'select') {
      if (process) navigate(`/app/process/${process.id}/characterization`)
      else navigate(-1)
    } else if (phase === 'chat' || phase === 'direct' || phase === 'file') {
      setPhase('select')
    } else if (phase === 'preview') {
      setPhase(selectedMode === 'direct' ? 'direct' : 'file')
    } else {
      navigate(-1)
    }
  }, [phase, process, navigate, selectedMode])

  // Chat mode: receives dagre XML + chat messages, upgrades via BIZAGI_PROMPT_MAESTRO
  const handleSaveFromChat = useCallback(async (
    dagreXml: string,
    messages: Array<{ role: string; text: string }>
  ) => {
    if (!process) return
    setIsSaving(true)
    setPhase('generating')

    const transcript = messages
      .map((m) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.text}`)
      .join('\n\n')

    let finalXml = dagreXml
    try {
      const result = await bpmnBudget.run(() => generateBpmnDirect(
        `Proceso: "${process.name}"\n\n${transcript}\n\n---\nDiagrama actual (usa de referencia para las actividades y flujo):\n${dagreXml}`,
        { skipPreprocess: true }
      ))
      if (result) finalXml = result.xml
    } catch {
      // Fallback silencioso: usa el dagre XML sin degradar la experiencia
    }

    try {
      await updateProcess(process.id, { bpmn_xml: finalXml })
      navigate(`/app/process/${process.id}/characterization`)
    } catch {
      setError('Error al guardar el diagrama. Inténtalo de nuevo.')
      setPhase('chat')
    } finally {
      setIsSaving(false)
    }
  }, [process, updateProcess, navigate, bpmnBudget])

  // Dictado por voz → anexa cada fragmento final al texto, respetando espacios.
  // Así, al parar y reanudar, sigue sobre lo ya dictado (y sobre lo editado a mano).
  const appendTranscript = useCallback((chunk: string) => {
    setDirectText((prev) => {
      const sep = prev && !/\s$/.test(prev) ? ' ' : ''
      return prev + sep + chunk
    })
  }, [])
  const dictado = useVoiceToText({ onText: appendTranscript })

  // Direct text mode
  const handleGenerateDirect = useCallback(async () => {
    if (!directText.trim()) return
    setError(null)
    setPhase('generating')
    try {
      const result = await bpmnBudget.run(() => generateBpmnDirect(directText))
      if (result) {
        setPreviewXml(result.xml)
        setPhase('preview')
      } else {
        setPhase('direct')
      }
    } catch (err) {
      console.warn('[FlowchartOnboarding] generateDirect error', err)
      const detail = err instanceof Error ? err.message : ''
      setError(detail || 'Error al generar el diagrama. Inténtalo de nuevo.')
      setPhase('direct')
    }
  }, [directText, bpmnBudget])

  // File upload mode
  const handleGenerateFromFile = useCallback(async () => {
    if (!fileRef) return
    const validation = validateBpmnFile(fileRef)
    if (!validation.valid) {
      setError(validation.error ?? 'Archivo inválido')
      return
    }
    setError(null)
    setPhase('generating')
    try {
      const base64 = await fileToBase64(fileRef)
      const result = await bpmnFileBudget.run(() => generateBpmnFromFile(base64, fileRef.type, fileContext || undefined))
      if (result) {
        setPreviewXml(result.xml)
        setPhase('preview')
      } else {
        setPhase('file')
      }
    } catch {
      setError('Error al procesar el archivo. Inténtalo de nuevo.')
      setPhase('file')
    }
  }, [fileRef, fileContext, bpmnFileBudget])

  // Preview mode: save and navigate to BPMN editor
  const handleSavePreview = useCallback(async () => {
    if (!process || !previewXml) return
    setIsSaving(true)
    try {
      await updateProcess(process.id, { bpmn_xml: previewXml })
      navigate(`/app/process/${process.id}/characterization`)
    } catch {
      setError('Error al guardar el diagrama. Inténtalo de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }, [process, previewXml, updateProcess, navigate])

  const pageTitle = process ? `Diagramar · ${process.name}` : 'Diagramar con IA'

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBack}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
        >
          <ArrowLeft size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-cyan-400" />
            <h1 className="text-lg font-semibold text-white truncate">{pageTitle}</h1>
          </div>
          {phase === 'select' && (
            <p className="text-[11px] text-white/40">Elige cómo quieres crear tu diagrama BPMN</p>
          )}
          {phase === 'chat' && (
            <p className="text-[11px] text-white/40">Habla o escribe — el flujograma se arma en vivo mientras conversas.</p>
          )}
          {phase === 'generating' && (
            <p className="text-[11px] text-amber-400 animate-pulse">Generando diagrama con IA...</p>
          )}
          {phase === 'preview' && (
            <p className="text-[11px] text-white/40">Revisa el diagrama y guárdalo para abrirlo en el editor</p>
          )}
        </div>
      </div>

      {/* Phase: select */}
      {phase === 'select' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {/* Mode tabs */}
          <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
            {([
              ...(IS_PHASE_1 ? [] : [{ mode: 'chat' as Mode, icon: MessageSquare, label: 'Chat en vivo' }]),
              { mode: 'direct' as Mode, icon: Type, label: 'Prompt directo' },
              { mode: 'file' as Mode, icon: FileUp, label: 'Cargar archivo' },
            ] as const).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setSelectedMode(mode)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  selectedMode === mode
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Mode content */}
          <div className="w-full max-w-xl">
            {selectedMode === 'chat' && (
              <div className="flex flex-col gap-4 p-6 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-white/70 text-sm">
                  Conversa con el asistente y el diagrama BPMN se construye en vivo mientras describes el proceso.
                </p>
                <button
                  onClick={() => setPhase('chat')}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium transition-all"
                >
                  Iniciar chat
                </button>
              </div>
            )}

            {selectedMode === 'direct' && (
              <div className="flex flex-col gap-4 p-6 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-white/70 text-sm">
                    Describe el proceso en texto libre —escríbelo o díctalo con el micrófono— y la IA generará el diagrama BPMN completo.
                  </p>
                  {dictado.supported && (
                    <button
                      type="button"
                      onClick={dictado.toggle}
                      disabled={dictado.transcribing}
                      title={dictado.recording ? 'Detener y transcribir' : 'Dictar por voz'}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-60 ${
                        dictado.recording
                          ? 'bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25'
                          : 'bg-white/5 text-cyan-300 border-cyan-500/25 hover:bg-cyan-500/10'
                      }`}
                    >
                      {dictado.transcribing
                        ? (<><Loader2 size={14} className="animate-spin" /> Transcribiendo…</>)
                        : dictado.recording
                        ? (<><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" /></span> Detener y transcribir</>)
                        : (<><Mic size={14} /> Dictar por voz <TokenCostBadge operationKey="transcription" /></>)}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <textarea
                    value={directText}
                    onChange={(e) => setDirectText(e.target.value)}
                    placeholder="Describe el proceso paso a paso: quién hace qué, cuándo, y qué decisiones se toman... o pulsa «Dictar por voz» y habla."
                    rows={6}
                    className="w-full resize-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                  {(dictado.recording || dictado.transcribing) && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-cyan-500/[0.06] border border-cyan-500/20 px-3 py-2">
                      {dictado.transcribing
                        ? <Loader2 size={13} className="mt-0.5 shrink-0 text-cyan-300 animate-spin" />
                        : <Mic size={13} className="mt-0.5 shrink-0 text-cyan-300 animate-pulse" />}
                      <p className="text-[12px] leading-snug text-white/60">
                        {dictado.transcribing
                          ? 'Transcribiendo tu voz…'
                          : 'Grabando… habla con naturalidad y pulsa «Detener y transcribir» cuando termines. El texto aparecerá arriba.'}
                      </p>
                    </div>
                  )}
                </div>
                {dictado.error && <p className="text-red-400 text-xs">{dictado.error}</p>}
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button
                  onClick={() => { dictado.stop(); setSelectedMode('direct'); handleGenerateDirect() }}
                  disabled={!directText.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Generar diagrama
                </button>
              </div>
            )}

            {selectedMode === 'file' && (
              <div className="flex flex-col gap-4 p-6 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-white/70 text-sm">
                  Sube una imagen (JPG, PNG, WebP), PDF o documento Word con el proceso documentado y la IA generará el diagrama BPMN.
                </p>
                <label className="flex flex-col items-center justify-center gap-2 h-32 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-cyan-500/40 transition-colors">
                  <FileUp size={24} className="text-white/30" />
                  <span className="text-white/40 text-sm">
                    {fileRef ? fileRef.name : 'Haz clic o arrastra tu archivo aquí'}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) { setFileRef(f); setError(null) }
                    }}
                  />
                </label>
                <input
                  type="text"
                  value={fileContext}
                  onChange={(e) => setFileContext(e.target.value)}
                  placeholder="Contexto adicional (opcional)"
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-cyan-500/50"
                />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button
                  onClick={() => { setSelectedMode('file'); handleGenerateFromFile() }}
                  disabled={!fileRef}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Analizar y generar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phase: chat */}
      {phase === 'chat' && process && (
        <FlowchartChatMode
          process={process}
          onSave={handleSaveFromChat}
          isSaving={isSaving}
        />
      )}

      {/* Phase: generating */}
      {phase === 'generating' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
          <p className="text-white/60 text-sm">Generando tu diagrama BPMN con IA...</p>
          <p className="text-white/30 text-xs">Esto puede tardar unos segundos</p>
        </div>
      )}

      {/* Phase: preview */}
      {phase === 'preview' && (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="flex-1 bg-[#0a0f1a] border border-white/5 rounded-2xl overflow-hidden">
            <BpmnModeler xml={previewXml} readOnly hidePalette className="h-full" />
          </div>
          <div className="flex items-center justify-end gap-3">
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              onClick={handleSavePreview}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Check size={14} />
              {isSaving ? 'Guardando...' : 'Guardar y abrir editor'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
