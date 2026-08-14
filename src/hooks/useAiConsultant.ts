import { useState, useCallback, useRef, useEffect } from 'react'
import {
  conductProcessInterview,
  conductFreeConversation,
  generateBpmnFromInterview,
  generateBpmnDirect,
  generateBpmnFromFile,
  refineBpmnDiagram,
  validateBpmnFile,
  fileToBase64,
} from '@/lib/bpmnAi'
import type { ChatMessage } from '@/features/ai-consultant/components/ConsultantChat'

export type ConsultantPhase = 'welcome' | 'consulting' | 'generating' | 'reviewing'
export type InputMode = 'voice' | 'text'
// Modo de la conversación activa: 'interview' = preguntas guiadas, 'conversation' = libre
export type ConversationMode = 'interview' | 'conversation'

// Notification chime (660Hz + 880Hz)
function playNotificationChime() {
  try {
    const ctx = new AudioContext()
    const now = ctx.currentTime
    ;[660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now)
      gain.gain.setValueAtTime(0, now + i * 0.12)
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.12 + 0.05)
      gain.gain.linearRampToValueAtTime(0, now + i * 0.12 + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + i * 0.12)
      osc.stop(now + i * 0.12 + 0.4)
    })
    setTimeout(() => ctx.close(), 1000)
  } catch {
    // Audio not available
  }
}

export function useAiConsultant() {
  const [phase, setPhase] = useState<ConsultantPhase>('welcome')
  const [conversationMode, setConversationMode] = useState<ConversationMode>('interview')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [bpmnXml, setBpmnXml] = useState('')
  const [interviewSummary, setInterviewSummary] = useState('')
  const [allWords, setAllWords] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isRefining, setIsRefining] = useState(false)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthActiveRef = useRef(false)

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      synthActiveRef.current = false
    }
  }, [])

  const speakText = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-ES'
    utterance.rate = 1.0
    synthActiveRef.current = true
    utterance.onend = () => { synthActiveRef.current = false }
    utterance.onerror = () => { synthActiveRef.current = false }
    window.speechSynthesis.speak(utterance)
  }, [])

  const stopAllAudio = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    if (recognitionRef.current) recognitionRef.current.stop()
    setIsListening(false)
    synthActiveRef.current = false
  }, [])

  const addMessage = useCallback((role: 'user' | 'assistant', text: string) => {
    const msg: ChatMessage = { role, text, timestamp: new Date() }
    setMessages((prev) => [...prev, msg])
    const words = text.split(/\s+/).filter((w) => w.length > 2)
    setAllWords((prev) => [...prev, ...words])
    return msg
  }, [])

  // ── Función interna: iniciar generación BPMN tras chat ────────────────────

  const triggerBpmnGeneration = useCallback(async (summary: string, historyMessages: ChatMessage[]) => {
    setInterviewSummary(summary)
    const fullTranscript = historyMessages
      .map((m) => `${m.role === 'user' ? 'Usuario' : 'Consultor'}: ${m.text}`)
      .join('\n\n')

    addMessage('assistant', 'Excelente! Ya tengo toda la información necesaria. Voy a generar tu diagrama BPMN...')
    playNotificationChime()

    setPhase('generating')
    setIsProcessing(false)

    try {
      const { xml } = await generateBpmnFromInterview(summary, fullTranscript)
      setBpmnXml(xml)
      setPhase('reviewing')
      playNotificationChime()
    } catch (genErr) {
      setError(genErr instanceof Error ? genErr.message : 'Error al generar el diagrama')
      setPhase('consulting')
    }
  }, [addMessage])

  // ── Tab 1 y Tab 2: iniciar chat (mode determina el comportamiento) ────────
  // AiConsultantDrawer llama startInterview() sin mode → usa 'interview' por defecto
  // AiConsultantPage (Tab 1) pasa mode='conversation'

  const startInterview = useCallback(async (initialContext?: string, mode: ConversationMode = 'interview') => {
    setConversationMode(mode)
    setPhase('consulting')
    setMessages([])
    setAllWords([])
    setIsProcessing(true)

    try {
      const userGreeting = initialContext
        ? `Hola, necesito tu ayuda para levantar un proceso. Te doy contexto: ${initialContext}`
        : 'Hola, necesito tu ayuda para levantar un proceso.'

      const callFn = mode === 'conversation' ? conductFreeConversation : conductProcessInterview
      const aiResponse = await callFn([], userGreeting)
      addMessage('assistant', aiResponse)
      playNotificationChime()
      if (inputMode === 'voice') speakText(aiResponse)
    } catch {
      const fallback = mode === 'conversation'
        ? 'Hola! Soy tu consultor de procesos. Descríbeme el proceso que quieres diagramar, con la libertad que quieras.'
        : 'Hola! Soy tu consultor de procesos. Voy a hacerte algunas preguntas para entender tu proceso de negocio. Para empezar, ¿cuál es el nombre del proceso que deseas documentar?'
      addMessage('assistant', fallback)
    } finally {
      setIsProcessing(false)
    }
  }, [addMessage, inputMode, speakText])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return
    setError(null)
    setInputValue('')

    addMessage('user', text)
    setIsProcessing(true)

    try {
      const history = messages.map((m) => ({ role: m.role, text: m.text }))

      let aiResponse: string
      if (conversationMode === 'conversation') {
        aiResponse = await conductFreeConversation(history, text)
      } else {
        aiResponse = await conductProcessInterview(history, text)
      }

      const trimmedResponse = aiResponse.trim()

      // Detectar marcador según el modo activo
      const MARKER_INTERVIEW = 'ENTREVISTA_COMPLETA'
      const MARKER_FREE = 'DIAGRAMA_LISTO:'

      const interviewDone = conversationMode === 'interview' && trimmedResponse.includes(MARKER_INTERVIEW)
      const freeDone = conversationMode === 'conversation' && trimmedResponse.includes(MARKER_FREE)

      if (interviewDone || freeDone) {
        const marker = interviewDone ? MARKER_INTERVIEW : MARKER_FREE
        const markerIdx = trimmedResponse.indexOf(marker)
        const afterMarker = trimmedResponse.slice(markerIdx + marker.length).trim()
        const summary = afterMarker || trimmedResponse
        const currentMessages = [...messages, { role: 'user' as const, text, timestamp: new Date() }]
        await triggerBpmnGeneration(summary, currentMessages)
      } else {
        addMessage('assistant', aiResponse)
        playNotificationChime()
        if (inputMode === 'voice') speakText(aiResponse)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en la comunicación con IA')
    } finally {
      setIsProcessing(false)
    }
  }, [messages, isProcessing, conversationMode, addMessage, inputMode, speakText, triggerBpmnGeneration])

  // ── Tab 3: Entrada directa (texto) ─────────────────────────────────────────

  const generateDirect = useCallback(async (description: string) => {
    if (!description.trim()) return
    setError(null)
    setPhase('generating')
    const words = description.split(/\s+/).filter((w) => w.length > 2)
    setAllWords(words)
    try {
      const { xml } = await generateBpmnDirect(description)
      setBpmnXml(xml)
      setPhase('reviewing')
      playNotificationChime()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el diagrama')
      setPhase('welcome')
    }
  }, [])

  // ── Tab 4: Carga de archivo ─────────────────────────────────────────────────

  const generateFromFile = useCallback(async (file: File, description?: string) => {
    const validation = validateBpmnFile(file)
    if (!validation.valid) {
      setError(validation.error ?? 'Archivo inválido')
      return
    }
    setError(null)
    setPhase('generating')
    setAllWords(file.name.split('.')[0].split(/\s+/))

    try {
      const base64 = await fileToBase64(file)
      const { xml } = await generateBpmnFromFile(base64, file.type, description)
      setBpmnXml(xml)
      setPhase('reviewing')
      playNotificationChime()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo')
      setPhase('welcome')
    }
  }, [])

  // ── Voice / STT ────────────────────────────────────────────────────────────

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      if (transcript.trim()) {
        setInputValue(transcript)
        setTranscript('')
      }
      return
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      setError('Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge.')
      return
    }

    if ('speechSynthesis' in window) window.speechSynthesis.cancel()

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'es-ES'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final_ = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final_ += event.results[i][0].transcript
        } else {
          interim += event.results[i][0].transcript
        }
      }
      if (final_) {
        setTranscript('')
        setInputValue((prev) => prev + ' ' + final_)
      } else {
        setTranscript(interim)
      }
    }

    recognition.onerror = () => { setIsListening(false) }
    recognition.onend = () => { setIsListening(false) }
    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
  }, [isListening, transcript])

  // ── Refinamiento ───────────────────────────────────────────────────────────

  const refine = useCallback(async (instruction: string) => {
    if (!bpmnXml || isRefining) return
    setIsRefining(true)
    setError(null)
    try {
      const { xml } = await refineBpmnDiagram(bpmnXml, instruction)
      setBpmnXml(xml)
      playNotificationChime()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al refinar el diagrama')
    } finally {
      setIsRefining(false)
    }
  }, [bpmnXml, isRefining])

  const exportBpmn = useCallback(() => {
    if (!bpmnXml) return
    const blob = new Blob([bpmnXml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'proceso.bpmn'
    a.click()
    URL.revokeObjectURL(url)
  }, [bpmnXml])

  const reset = useCallback(() => {
    stopAllAudio()
    setPhase('welcome')
    setConversationMode('interview')
    setMessages([])
    setAllWords([])
    setBpmnXml('')
    setInterviewSummary('')
    setError(null)
    setInputValue('')
    setTranscript('')
  }, [stopAllAudio])

  return {
    phase,
    conversationMode,
    messages,
    isProcessing,
    isListening,
    transcript,
    inputValue,
    setInputValue,
    inputMode,
    setInputMode,
    bpmnXml,
    setBpmnXml,
    interviewSummary,
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
    stopAllAudio,
  }
}
